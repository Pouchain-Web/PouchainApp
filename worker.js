/**
 * Cloudflare Worker for PouchainApp
 * Handles: List, Upload (PUT), Delete (DELETE), Get (GET)
 * 
 * ENVIRONMENT VARIABLES REQUIRED:
 * - MY_BUCKET:  R2 Bucket binding (bind to your 'pouchain-files' bucket)
 * - SECRET_KEY:  String (must match 'x-worker-secret' sent by frontend)
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const method = request.method;

        console.log(`[REQUEST] ${method} ${url.pathname}`);

        // CORS Headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-worker-secret, Authorization",
        };

        // 1. Handle Preflight (OPTIONS)
        if (method === "OPTIONS") {
            return new Response("OK", { headers: corsHeaders });
        }

        // Safety check for R2 binding
        if (!env.MY_BUCKET) {
            return new Response("Erreur de configuration: R2 Bucket (MY_BUCKET) non trouvÃ© dans le Worker.", { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "text/plain" } 
            });
        }

        // 2. Security Check
        const user = await getUser(request, env);

        // Check Auth : Allow public access ONLY for /get/ files and /update/check
        const isPublicPath = url.pathname.startsWith('/get/') || url.pathname.includes('/update/check');
        
        if (!isPublicPath) {
            if (!user) {
                return new Response("Unauthorized", { status: 401, headers: corsHeaders });
            }

            // Check Admin for /admin/ routes
            if (url.pathname.startsWith('/admin/')) {
                // EXCEPTION: grant access to all authenticated users for "Cartes et Parc" and "Maint." apps
                const isParcOrMaintPath = 
                    url.pathname.includes("/admin/machines") || 
                    url.pathname.includes("/admin/machine-families") || 
                    url.pathname.includes("/admin/buildings");
                
                // EXCEPTION: allow GET on vehicles/logs/cards for non-admins
                const isVehicleRead = method === "GET" && (
                    url.pathname.endsWith("/admin/vehicles") || 
                    url.pathname.endsWith("/admin/vehicle/all-logs") ||
                    url.pathname.endsWith("/admin/dkv-cards") ||
                    url.pathname.endsWith("/admin/toll-cards")
                );

                if (!isParcOrMaintPath && !isVehicleRead) {
                    const admin = await isAdmin(user, env);
                    if (!admin) {
                        return new Response("Forbidden: Admin access required", { status: 403, headers: corsHeaders });
                    }
                }
            }
        }

        try {
            // --- ROUTE: CHECK FOR UPDATES (Auto-Detect zip files with version in name) ---
            if (url.pathname.includes("/update/check")) {
                const currentVersion = url.searchParams.get('current_version') || "0.0.0";
                
                // Scan the WHOLE bucket (recursive search for safety)
                const listing = await env.MY_BUCKET.list();
                let latestVersion = "0.0.0";
                let latestVersionFile = null;
                let latestTimestamp = 0;

                console.log(`[Updater] Scanning ${listing.objects.length} files...`);

                for (const obj of listing.objects) {
                    // Match files like V1.0.2.zip or v1.0.2.zip
                    const match = obj.key.match(/[Vv](\d+\.\d+\.\d+)\.zip$/);
                    if (match) {
                        const ver = match[1];
                        const uploadTime = new Date(obj.uploaded).getTime();
                        
                        const cmp = compareVersions(ver, latestVersion);
                        
                        // We take the HIGHEST version. If versions are equal, take the newest upload.
                        if (cmp > 0 || (cmp === 0 && uploadTime > latestTimestamp)) {
                            latestVersion = ver;
                            latestTimestamp = uploadTime;
                            latestVersionFile = obj;
                            console.log(`[Updater] Higher candidate found: ${obj.key} (v${ver})`);
                        }
                    }
                }
                
                const isNewer = compareVersions(latestVersion, currentVersion) > 0;
                console.log(`[Updater] Result: Last Version found: ${latestVersion}. Current App: ${currentVersion}. Update required? ${isNewer}`);
                
                return new Response(JSON.stringify({
                    updateAvailable: isNewer,
                    newVersion: latestVersion,
                    url: latestVersionFile ? `${url.origin}/get/${latestVersionFile.key}` : null,
                    mandatory: true
                }), {
                    headers: { 
                        ...corsHeaders, 
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store, no-cache, must-revalidate"
                    }
                });
            }

            // --- ROUTE: LIST FILES ---
            if (method === "GET" && url.pathname.endsWith("/list")) { // /list or /api/list
                const userId = url.searchParams.get('userId');
                const includeHidden = url.searchParams.get('includeHidden') === 'true';

                // 1. List ALL from R2 (with pagination)
                let objects = [];
                let truncated = true;
                let cursor = undefined;

                while (truncated) {
                    const listing = await env.MY_BUCKET.list({ cursor });
                    objects.push(...listing.objects);
                    truncated = listing.truncated;
                    cursor = listing.cursor;
                }

                // Hide internal folders from listing UNLESS explicitly asked
                if (!includeHidden) {
                    objects = objects.filter(obj => 
                        !obj.key.startsWith('material_requests/') && 
                        !obj.key.startsWith('fleet/') &&
                        !obj.key.startsWith('vehicles/') &&
                        !obj.key.startsWith('archives/') &&
                        !obj.key.startsWith('fullscreen_slides/') &&
                        !obj.key.startsWith('buildings/') &&
                        !obj.key.startsWith('machines/') && 
                        !obj.key.startsWith('machines_photos/') &&
                        !obj.key.startsWith('autre/') &&
                        !obj.key.startsWith('app_dist/') &&
                        !obj.key.startsWith('app_updates/') &&
                        !obj.key.endsWith('.json') &&
                        !obj.key.startsWith('.meta_')
                    );
                }

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 2. Admin desktop (no userId param) bypasses access control and sees everything.
                //    Mobile view always passes userId â€” access control is enforced for everyone there,
                //    even if the caller is an admin.
                const callerIsAdmin = !userId && user ? await isAdmin(user, env) : false;

                if (!callerIsAdmin && serviceKey) {
                    try {
                        // Fetch all rules
                        const rulesRes = await fetch(`${supabaseUrl}/rest/v1/user_file_visibility?select=path,user_id`, {
                            headers: {
                                "apikey": serviceKey,
                                "Authorization": `Bearer ${serviceKey}`
                            }
                        });

                        if (rulesRes.ok) {
                            const rules = await rulesRes.json();
                            if (rules.length > 0) {
                                const restrictedPaths = new Set(rules.map(r => r.path));
                                const userAllowed = new Set(
                                    userId ? rules.filter(r => r.user_id === userId).map(r => r.path) : []
                                );

                                objects = objects.filter(obj => {
                                    const parts = obj.key.split('/');
                                    let currentPath = "";
                                    for (let i = 0; i < parts.length; i++) {
                                        if (i > 0) currentPath += "/";
                                        currentPath += parts[i];

                                        if (restrictedPaths.has(currentPath) && !userAllowed.has(currentPath)) return false;

                                        if (i < parts.length - 1) {
                                            const folderPath = currentPath + "/";
                                            if (restrictedPaths.has(folderPath) && !userAllowed.has(folderPath)) return false;
                                        }
                                    }
                                    return true;
                                });
                            }
                        }
                    } catch (e) {
                        console.error("Access Control Error:", e);
                    }
                }

                return new Response(JSON.stringify(objects), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // --- ROUTE: GET ACCESS (Admin) ---
            if (method === "GET" && url.pathname.endsWith("/admin/access/get")) {
                const path = url.searchParams.get('path');
                if (!path) return new Response("Missing path", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/user_file_visibility?path=eq.${encodeURIComponent(path)}&select=user_id`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });

                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const data = await res.json();
                const userIds = data.map(r => r.user_id);

                return new Response(JSON.stringify(userIds), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: ACCESS SUMMARY (Admin) ---
            // Returns [{ path, ownerName }] for all restricted paths
            if (method === "GET" && url.pathname.endsWith("/admin/access/summary")) {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Fetch all access rules joined with profiles
                const rulesRes = await fetch(
                    `${supabaseUrl}/rest/v1/user_file_visibility?select=path,profiles(first_name,last_name)`,
                    { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
                );

                if (!rulesRes.ok) return new Response(await rulesRes.text(), { status: rulesRes.status, headers: corsHeaders });
                const rules = await rulesRes.json();

                // Build summary: path -> [ownerName, ...] (all owners)
                const summary = {};
                for (const rule of rules) {
                    if (rule.profiles) {
                        const { first_name, last_name } = rule.profiles;
                        const name = [first_name, last_name].filter(Boolean).join(' ') || 'Utilisateur inconnu';
                        if (!summary[rule.path]) summary[rule.path] = [];
                        summary[rule.path].push(name);
                    }
                }

                return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: SET ACCESS (Admin) ---
            if (method === "POST" && url.pathname.endsWith("/admin/access/set")) {
                const body = await request.json();
                const { path, userIds } = body; // userIds is array of strings

                if (!path || !Array.isArray(userIds)) return new Response("Invalid body", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Transaction-like approach not easy via REST, so:
                // 1. Delete all for path
                await fetch(`${supabaseUrl}/rest/v1/user_file_visibility?path=eq.${encodeURIComponent(path)}`, {
                    method: 'DELETE',
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });

                // 2. Insert new
                if (userIds.length > 0) {
                    const rows = userIds.map(uid => ({ path, user_id: uid }));
                    const insertRes = await fetch(`${supabaseUrl}/rest/v1/user_file_visibility`, {
                        method: 'POST',
                        headers: {
                            "apikey": serviceKey,
                            "Authorization": `Bearer ${serviceKey}`,
                            "Content-Type": "application/json",
                            "Prefer": "resolution=merge-duplicates"
                        },
                        body: JSON.stringify(rows)
                    });
                    if (!insertRes.ok) return new Response(await insertRes.text(), { status: insertRes.status, headers: corsHeaders });
                }

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: STORAGE SPACE SUMMARY (Admin) ---
            if (method === "GET" && url.pathname.endsWith("/admin/space")) {
                let totalSize = 0;
                let truncated = true;
                let cursor = undefined;

                while (truncated) {
                    const list = await env.MY_BUCKET.list({ cursor });
                    for (const obj of list.objects) {
                        totalSize += obj.size;
                    }
                    truncated = list.truncated;
                    cursor = list.cursor;
                }

                return new Response(JSON.stringify({
                    usedBytes: totalSize,
                    totalBytes: 10 * 1024 * 1024 * 1024 // 10 GB limit
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: GET FILE CONTENT ---
            // Usage: /get/FolderName/FileName.pdf
            if (method === "GET" && url.pathname.includes("/get/")) {
                const parts = url.pathname.split('/get/');
                if (parts.length < 2) return new Response("Invalid Path", { status: 400, headers: corsHeaders });

                const key = decodeURIComponent(parts[1]);
                const object = await env.MY_BUCKET.get(key);

                if (!object) {
                    return new Response("File not found", { status: 404, headers: corsHeaders });
                }

                const headers = new Headers(corsHeaders);
                object.writeHttpMetadata(headers);
                
                // FORCE INLINE to prevent unwanted download prompts and allow direct viewing
                headers.set("Content-Disposition", "inline");
                
                // FORCE CONTENT TYPE if missing or generic to ensure browser rendering
                const ext = key.split('.').pop().toLowerCase();
                const mimeTypes = {
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                    'pdf': 'application/pdf',
                    'svg': 'image/svg+xml',
                    'apk': 'application/vnd.android.package-archive',
                    'zip': 'application/zip'
                };

                if (!headers.has("Content-Type") || headers.get("Content-Type") === "application/octet-stream") {
                    if (mimeTypes[ext]) {
                        headers.set("Content-Type", mimeTypes[ext]);
                    }
                }

                headers.set("etag", object.httpEtag);
                return new Response(object.body, { headers });
            }

            // --- ROUTE: UPLOAD FILE ---
            // Usage: PUT /upload (FormData: key, file)
            if (method === "PUT" && url.pathname.endsWith("/upload")) {
                const formData = await request.formData();
                const file = formData.get("file");
                const key = formData.get("key");

                if (!file || !key) {
                    return new Response("Missing file or key", { status: 400, headers: corsHeaders });
                }

                // SAFER UPLOAD: convert to ArrayBuffer and pass original content type
                await env.MY_BUCKET.put(key, await file.arrayBuffer(), {
                    httpMetadata: { contentType: file.type || "application/octet-stream" }
                });
                return new Response(JSON.stringify({ message: "Uploaded successfully", key }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // --- ROUTE: DELETE FILE ---
            // Usage: DELETE /delete (JSON: { key })
            if (method === "DELETE" && url.pathname.endsWith("/delete")) {
                const body = await request.json();
                const key = body.key;

                if (!key) {
                    return new Response("Missing key", { status: 400, headers: corsHeaders });
                }

                // CHANGED: Using env.MY_BUCKET
                await env.MY_BUCKET.delete(key);
                return new Response(JSON.stringify({ message: "Deleted successfully", key }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // --- ROUTE: RENAME FILE ---
            // Usage: POST /admin/files/rename (JSON: { oldKey, newKey })
            // R2 doesn't support rename, so we Copy + Delete
            if (method === "POST" && url.pathname.endsWith("/admin/files/rename")) {
                const body = await request.json();
                const { oldKey, newKey } = body;

                if (!oldKey || !newKey) {
                    return new Response("Missing oldKey or newKey", { status: 400, headers: corsHeaders });
                }

                // 1. Get the object
                const object = await env.MY_BUCKET.get(oldKey);
                if (!object) {
                    return new Response("File not found", { status: 404, headers: corsHeaders });
                }

                // 2. Put new object with same body/metadata
                await env.MY_BUCKET.put(newKey, object.body, {
                    httpMetadata: object.httpMetadata,
                    customMetadata: object.customMetadata
                });

                // 3. Delete old object
                await env.MY_BUCKET.delete(oldKey);

                return new Response(JSON.stringify({ message: "Renamed successfully", oldKey, newKey }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // --- ROUTE: RENAME FOLDER ---
            // Usage: POST /admin/folders/rename (JSON: { oldPrefix, newPrefix })
            if (method === "POST" && url.pathname.endsWith("/admin/folders/rename")) {
                const body = await request.json();
                const { oldPrefix, newPrefix } = body;

                if (!oldPrefix || !newPrefix) {
                    return new Response("Missing oldPrefix or newPrefix", { status: 400, headers: corsHeaders });
                }

                // 1. List all objects with old prefix
                let truncated = true;
                let cursor = undefined;
                let objects = [];

                while (truncated) {
                    const list = await env.MY_BUCKET.list({ prefix: oldPrefix, cursor });
                    objects.push(...list.objects);
                    truncated = list.truncated;
                    cursor = list.cursor;
                }

                // 2. Copy each object to new prefix and delete old
                // Note: accurate "folder" rename implies strictly replacing the prefix part
                let count = 0;
                for (const obj of objects) {
                    const oldKey = obj.key;
                    const newKey = oldKey.replace(oldPrefix, newPrefix);

                    // Copy
                    const fileObj = await env.MY_BUCKET.get(oldKey);
                    if (fileObj) {
                        await env.MY_BUCKET.put(newKey, fileObj.body, {
                            httpMetadata: fileObj.httpMetadata,
                            customMetadata: fileObj.customMetadata
                        });
                        // Delete
                        await env.MY_BUCKET.delete(oldKey);
                        count++;
                    }
                }

                return new Response(JSON.stringify({ message: "Folder renamed", count }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }



            // --- ROUTE: ADMIN USER MANAGEMENT ---
            // THESE ROUTES REQUIRE SUPABASE_SERVICE_KEY env var

            // 1. List Users (GET /admin/users)
            if (method === "GET" && url.pathname.endsWith("/admin/users")) {
                if (!env.SUPABASE_SERVICE_KEY) {
                    return new Response("Missing Server Configuration", { status: 500, headers: corsHeaders });
                }

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // We need to fetch from auth.users (Admin API)
                // Cloudflare Worker doesn't support supabase-js well sometimes, so we use direct fetch
                const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`
                    }
                });

                if (!response.ok) {
                    return new Response(await response.text(), { status: response.status, headers: corsHeaders });
                }

                const users = await response.json();

                // Also fetch profiles to get roles if needed, but for now let's just return users
                // We can map roles if we join with profiles table
                // Let's do a second fetch for profiles
                const profilesResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*`, {
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`
                    }
                });
                const profiles = await profilesResponse.json();

                // Merge data
                const result = users.users.map(u => {
                    const profile = profiles.find(p => p.id === u.id);
                    return {
                        id: u.id,
                        email: u.email,
                        created_at: u.created_at,
                        role: profile ? profile.role : 'user',
                        first_name: profile ? profile.first_name : null,
                        last_name: profile ? profile.last_name : null,
                        color: profile ? profile.color : '#2da140'
                    };
                });

                return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2. Create User (POST /admin/users)
            if (method === "POST" && url.pathname.endsWith("/admin/users")) {
                const body = await request.json();
                const { email, password, role, firstName, lastName } = body;

                if (!email || !password) return new Response("Missing email or password", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Create in Auth
                const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
                    method: "POST",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        email_confirm: true // Auto confirm
                    })
                });

                if (!createRes.ok) return new Response(await createRes.text(), { status: createRes.status, headers: corsHeaders });

                const userData = await createRes.json();
                const userId = userData.id;

                // Create Profile with Role
                // Check if profile exists (triggered?) or insert
                const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
                    method: "POST",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify({
                        id: userId,
                        role: role || 'user',
                        first_name: firstName || null,
                        last_name: lastName || null
                    })
                });

                if (!profileRes.ok) {
                    // If profile creation fails, we might want to delete the user... 
                    // But for now, just return error
                    return new Response("User created but profile failed: " + await profileRes.text(), { status: 500, headers: corsHeaders });
                }

                return new Response(JSON.stringify({ message: "User created", user: userData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2b. Invite User (POST /admin/users/invite)
            if (method === "POST" && url.pathname.endsWith("/admin/users/invite")) {
                const body = await request.json();
                const { email, role, redirectTo, firstName, lastName } = body;

                if (!email) return new Response("Missing email", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Create Invite
                const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
                    method: "POST",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        data: { role: role || 'user' }, // Optional: store role in metadata too
                        redirect_to: redirectTo // Pass redirect URL (snake_case)
                    })
                });

                if (!inviteRes.ok) return new Response(await inviteRes.text(), { status: inviteRes.status, headers: corsHeaders });

                const userData = await inviteRes.json();
                const userId = userData.id;

                // Create Profile Logic (same as create)
                const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
                    method: "POST",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify({
                        id: userId,
                        role: role || 'user',
                        first_name: firstName || null,
                        last_name: lastName || null
                    })
                });

                if (!profileRes.ok) {
                    return new Response("User invited but profile failed: " + await profileRes.text(), { status: 500, headers: corsHeaders });
                }

                return new Response(JSON.stringify({ message: "Invitation sent", user: userData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2c. Reset Password (POST /admin/users/reset)
            if (method === "POST" && url.pathname.endsWith("/admin/users/reset")) {
                const body = await request.json();
                const { email, redirectTo } = body;

                if (!email) return new Response("Missing email", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Trigger Reset
                const resetRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
                    method: "POST",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        redirect_to: redirectTo // Pass redirect URL (snake_case)
                    })
                });

                if (!resetRes.ok) return new Response(await resetRes.text(), { status: resetRes.status, headers: corsHeaders });

                return new Response(JSON.stringify({ message: "Reset email sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2d. Update User Password (PUT /admin/users/password)
            if (method === "PUT" && url.pathname.endsWith("/admin/users/password")) {
                const body = await request.json();
                const { id, password } = body;
                if (!id || !password) return new Response("Missing id or password", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
                    method: "PUT",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ password })
                });

                if (!updateRes.ok) return new Response(await updateRes.text(), { status: updateRes.status, headers: corsHeaders });

                return new Response(JSON.stringify({ message: "Password updated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2e. Update User Role (PUT /admin/users/role)
            if (method === "PUT" && url.pathname.endsWith("/admin/users/role")) {
                const body = await request.json();
                const { id, role } = body;
                if (!id || !role) return new Response("Missing id or role", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Update Role in profiles table
                const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${id}`, {
                    method: "PATCH",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    body: JSON.stringify({ role })
                });

                if (!updateRes.ok) return new Response(await updateRes.text(), { status: updateRes.status, headers: corsHeaders });

                return new Response(JSON.stringify({ message: "Role updated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2e. Update User Profile Name (PUT /admin/users/profile)
            if (method === "PUT" && url.pathname.endsWith("/admin/users/profile")) {
                const body = await request.json();
                const { id, firstName, lastName } = body;
                if (!id) return new Response("Missing aid", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Update Name in profiles table
                const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${id}`, {
                    method: "PATCH",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    body: JSON.stringify({ first_name: firstName || null, last_name: lastName || null })
                });

                if (!updateRes.ok) return new Response(await updateRes.text(), { status: updateRes.status, headers: corsHeaders });

                return new Response(JSON.stringify({ message: "Profile updated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2f. Update User Color (PUT /admin/users/color)
            if (method === "PUT" && url.pathname.endsWith("/admin/users/color")) {
                const body = await request.json();
                const { id, color } = body;
                if (!id || !color) return new Response("Missing id or color", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${id}`, {
                    method: "PATCH",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    body: JSON.stringify({ color }) // Update the color column
                });

                if (!updateRes.ok) return new Response(await updateRes.text(), { status: updateRes.status, headers: corsHeaders });

                return new Response(JSON.stringify({ message: "Color updated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 3. Delete User (DELETE /admin/users)
            if (method === "DELETE" && url.pathname.endsWith("/admin/users")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing user ID", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Delete Profile first (Foreign Key Constraint)
                const profileDelRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${id}`, {
                    method: "DELETE",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`
                    }
                });

                // We don't strictly check if profile delete worked, maybe it didn't exist.
                // But if it fails due to other constraints, the user delete will likely fail too or succeed if dependent.
                // Let's assume we proceed to user delete.

                // 2. Delete Auth User
                const delRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
                    method: "DELETE",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`
                    }
                });

                if (!delRes.ok) return new Response(await delRes.text(), { status: delRes.status, headers: corsHeaders });

                return new Response(JSON.stringify({ message: "User deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: PLANNING (Admin) ---

            // 1. Get all tasks (Admin)
            if (method === "GET" && url.pathname.endsWith("/admin/tasks")) {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const { searchParams } = new URL(request.url);
                const startDate = searchParams.get('start_date');
                const endDate = searchParams.get('end_date');
                const dateParam = searchParams.get('date');
                
                const today = new Date().toISOString().split('T')[0];

                let queryUrl = `${supabaseUrl}/rest/v1/tasks?select=*`;
                if (startDate && endDate) {
                    queryUrl += `&date=gte.${startDate}&date=lte.${endDate}`;
                } else if (dateParam) {
                    queryUrl += `&date=eq.${dateParam}`;
                }
                queryUrl += `&order=date.asc,start_time.asc`;

                const response = await fetch(queryUrl, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!response.ok) return new Response(await response.text(), { status: response.status, headers: corsHeaders });
                
                let results = await response.json();

                // FALLBACK: If 0 results in Supabase for a past week, search and parse R2 archives
                if (results.length === 0 && startDate) {
                    try {
                        const listing = await env.MY_BUCKET.list({ prefix: "archives/planning/" });
                        // Sort archives by date (keys usually contain date) to find relevant one faster? 
                        // For now we scan them.
                        for (const obj of listing.objects) {
                            const archive = await env.MY_BUCKET.get(obj.key);
                            if (archive) {
                                const text = await archive.text();
                                const lines = text.split("\n");
                                if (lines.length < 2) continue;
                                const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, ''));
                                const dateIdx = headers.indexOf('date');
                                
                                for (let i = 1; i < lines.length; i++) {
                                    if (!lines[i]) continue;
                                    const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                                    if (row && row.length >= headers.length) {
                                        const cleanRow = row.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
                                        const rowDate = cleanRow[dateIdx];
                                        if (rowDate >= startDate && rowDate <= (endDate || startDate)) {
                                            const task = {};
                                            headers.forEach((h, idx) => { if(h) task[h] = cleanRow[idx]; });
                                            results.push(task);
                                        }
                                    }
                                }
                                if (results.length > 0) break;
                            }
                        }
                    } catch (e) {
                         console.error("Archive retrieval fallback failed", e);
                    }
                }

                return new Response(JSON.stringify(results), { 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // 2. Create/Update task (Admin)
            if (method === "POST" && url.pathname.endsWith("/admin/tasks")) {
                const body = await request.json();
                const { id, user_id, title, date, start_time, end_time, done } = body;
                if (!user_id || !title || !date || !start_time || !end_time) {
                    return new Response("Missing required fields", { status: 400, headers: corsHeaders });
                }

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const payload = { user_id, title, date, start_time, end_time, done };
                if (id) payload.id = id;

                const updateRes = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
                    method: "POST",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(payload)
                });
                
                if (updateRes.ok && !id) {
                    // NEW TASK ALERT
                    try {
                        const configRes = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1&select=auto_planning`, {
                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                        });
                        const configData = await configRes.json();
                        if (configData[0]?.auto_planning !== false) {
                            await sendPushNotification(env, user_id, `📅 Nouvelle tâche : ${title} (${date})`);
                        }
                    } catch(e) { console.error("Auto notif planning failed", e); }
                }

                if (!updateRes.ok) return new Response(await updateRes.text(), { status: updateRes.status, headers: corsHeaders });
                return new Response(JSON.stringify({ message: "Task saved" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 3. Delete task (Admin)
            if (method === "DELETE" && url.pathname.endsWith("/admin/tasks")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing task ID", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const delRes = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!delRes.ok) return new Response(await delRes.text(), { status: delRes.status, headers: corsHeaders });
                return new Response(JSON.stringify({ message: "Task deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 4. Archive old tasks (Admin)
            // Usage: POST /admin/tasks/archive
            if (method === "POST" && url.pathname.endsWith("/admin/tasks/archive")) {
                try {
                    const result = await performArchiving(env);
                    return new Response(JSON.stringify({ 
                        message: result.count > 0 ? "Archived successfuly into yearly files." : "Nothing to archive.", 
                        count: result.count,
                        details: result.details
                    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
                }
            }

            // --- ROUTE: PLANNING (Closed Days) ---
            if (method === "GET" && url.pathname.endsWith("/planning/closed-days")) {
                let closedDays = [];
                try {
                    const obj = await env.MY_BUCKET.get("planning_closed_days.json");
                    if (obj) {
                        closedDays = await obj.json();
                    }
                } catch(e) {}
                return new Response(JSON.stringify(closedDays), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/planning/closed-days")) {
                const body = await request.json();
                if (!Array.isArray(body)) return new Response("Invalid array", { status: 400, headers: corsHeaders });
                await env.MY_BUCKET.put("planning_closed_days.json", JSON.stringify(body), { httpMetadata: { contentType: "application/json" } });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: PLANNING (User Mobile) ---
            if (method === "GET" && url.pathname.endsWith("/tasks")) {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const { searchParams } = new URL(request.url);
                const date = searchParams.get('date');
                const startDate = searchParams.get('startDate');
                const endDate = searchParams.get('endDate');

                let queryUrl = `${supabaseUrl}/rest/v1/tasks?user_id=eq.${user.id}&select=*`;
                if (startDate && endDate) {
                    queryUrl += `&date=gte.${startDate}&date=lte.${endDate}`;
                } else if (date) {
                    queryUrl += `&date=eq.${date}`;
                }
                queryUrl += `&order=date.asc,start_time.asc`;

                const response = await fetch(queryUrl, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!response.ok) return new Response(await response.text(), { status: response.status, headers: corsHeaders });
                return new Response(await response.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "PATCH" && url.pathname === "/tasks") {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const { id, done } = body;
                if (!id) return new Response("Missing task ID", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const patchRes = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${id}&user_id=eq.${user.id}`, {
                    method: "PATCH",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ done })
                });

                if (!patchRes.ok) return new Response(await patchRes.text(), { status: patchRes.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "PATCH" && url.pathname === "/admin/tasks") {
                const body = await request.json();
                const { id, done } = body;
                if (!id) return new Response("Missing task ID", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const patchRes = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${id}`, {
                    method: "PATCH",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ done })
                });

                if (!patchRes.ok) return new Response(await patchRes.text(), { status: patchRes.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname === "/admin/tasks") {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing task ID", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const delRes = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${id}`, {
                    method: "DELETE",
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`
                    }
                });

                if (!delRes.ok) return new Response(await delRes.text(), { status: delRes.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

                                    // --- ROUTE: MATERIAL REQUESTS (Admin) ---
            if (method === "GET" && url.pathname === "/admin/material/requests") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_requests?select=*,profiles(first_name,last_name)&order=created_at.desc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "GET" && url.pathname === "/admin/material/requests/archived") {
                const list = await env.MY_BUCKET.list({ prefix: "archives/material_requests/" });
                return new Response(JSON.stringify(list.objects), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname === "/admin/material/requests/archived") {
                const { id, key } = await request.json();
                const obj = await env.MY_BUCKET.get(key);
                if (obj) {
                    let csv = await obj.text();
                    const lines = csv.split('\n');
                    const newCsv = lines.filter(l => !l.startsWith('"' + id + '"')).join('\n');
                    await env.MY_BUCKET.put(key, newCsv, { httpMetadata: { contentType: "text/csv" } });
                }
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "GET" && url.pathname === "/admin/material/config") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/material/config") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const body = await request.json();
                const res = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1`, {
                    method: "PATCH",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "PATCH" && url.pathname === "/admin/material/requests") {
                const body = await request.json();
                const { id, status, adminName } = body;
                if (!id || !status) return new Response("Missing id or status", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Fetch current data
                const fetchRes = await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${id}&select=*,profiles(first_name,last_name)`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                const data = await fetchRes.json();
                const r = data[0];
                if (!r) return new Response("Not found", { status: 404, headers: corsHeaders });

                // 2. Notify User First
                try {
                    const configRes = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1&select=auto_material`, {
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                    });
                    const configData = await configRes.json();
                    if (configData[0]?.auto_material !== false) {
                        let label = status;
                        if (status === 'confirmed') label = 'Confirmée ✅';
                        if (status === 'ordered') label = 'Commandée 📦';
                        if (status === 'refused') label = 'Refusée ❌';
                        if (status === 'received') label = 'Reçue ✅';
                        await sendPushNotification(env, r.user_id, `🧰 Matériel : Votre demande pour "${r.material_name}" est maintenant ${label}.`);
                    }
                } catch(e) { console.error("Auto material notif failed", e); }

                // 3. Action based on status
                if (status === 'received' || status === 'refused') {
                    const year = new Date().getFullYear();
                    const key = `archives/material_requests/${year}.csv`;
                    let csvContent = "";
                    try {
                        const obj = await env.MY_BUCKET.get(key);
                        if (obj) csvContent = await obj.text();
                    } catch(e) {}
                    if (!csvContent) {
                        csvContent = "id,user_id,user_name,category,material_name,quantity,comment,status,created_at,image_path,handled_by\n";
                    }
                    const escapeCsv = (val) => {
                        if (val === null || val === undefined) return '""';
                        let str = String(val).replace(/"/g, '""');
                        str = str.replace(/\r?\n/g, '  '); // Replace newlines with indent/spaces
                        return '"' + str + '"';
                    };
                    const line = [
                        escapeCsv(r.id), escapeCsv(r.user_id), 
                        escapeCsv(r.profiles ? (r.profiles.first_name + " " + r.profiles.last_name) : 'Inconnu'),
                        escapeCsv(r.category), escapeCsv(r.material_name), escapeCsv(r.quantity), escapeCsv(r.comment),
                        escapeCsv(status), escapeCsv(r.created_at), escapeCsv(r.image_path), escapeCsv(adminName || 'Admin')
                    ].join(',');
                    csvContent += line + "\n";
                    await env.MY_BUCKET.put(key, csvContent, { httpMetadata: { contentType: "text/csv" } });

                    await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${id}`, {
                        method: "DELETE",
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                    });
                    return new Response(JSON.stringify({ success: true, archived: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                } else {
                    const res = await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${id}`, {
                        method: "PATCH",
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
                    });
                    if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            }

            if (method === "DELETE" && url.pathname === "/admin/material/requests") {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const checkRes = await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${id}&select=image_path`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (checkRes.ok) {
                    const data = await checkRes.json();
                    if (data && data[0] && data[0].image_path) {
                        try {
                            await env.MY_BUCKET.delete(data[0].image_path);
                        } catch (e) { console.error("R2 Delete Error:", e); }
                    }
                }

                const res = await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MATERIAL CATEGORIES (Public for Authenticated Users) ---
            if (method === "GET" && url.pathname === "/material/categories") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_categories?select=*&order=name.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MATERIAL CATEGORIES (Admin - Same as above but prefixed) ---
            if (method === "GET" && url.pathname === "/admin/material/categories") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_categories?select=*&order=name.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/material/categories")) {
                const body = await request.json();
                const { name } = body;
                if (!name) return new Response("Missing name", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_categories`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ name })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/material/categories")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_categories?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: VEHICLES (Admin) ---
            if (method === "GET" && url.pathname.endsWith("/admin/vehicles")) {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/vehicles?select=*,profiles(first_name,last_name)&order=plate_number.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/vehicles")) {
                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                
                const { id, ...vehicleData } = body;
                const upsertBody = { ...vehicleData, updated_at: new Date().toISOString() };
                if (id) upsertBody.id = id;

                const res = await fetch(`${supabaseUrl}/rest/v1/vehicles`, {
                    method: "POST",
                    headers: { 
                        "apikey": serviceKey, 
                        "Authorization": `Bearer ${serviceKey}`, 
                        "Content-Type": "application/json",
                        "Prefer": "return=representation,resolution=merge-duplicates"
                    },
                    body: JSON.stringify(upsertBody)
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const savedArr = await res.json();
                return new Response(JSON.stringify(savedArr[0] || { success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/vehicles")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Try to delete photo from R2 if exists
                try {
                    await env.MY_BUCKET.delete(`vehicles/photos/${id}.png`);
                } catch(e) {}

                const res = await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 4. Upload Vehicle Photo (Admin)
            if (method === "POST" && url.pathname.endsWith("/admin/vehicles/photo")) {
                const formData = await request.formData();
                const file = formData.get("file");
                const vehicleId = formData.get("vehicleId");

                if (!file || !vehicleId) {
                    return new Response("Missing file or vehicleId", { status: 400, headers: corsHeaders });
                }

                const key = `vehicles/photos/${vehicleId}.png`;
                await env.MY_BUCKET.put(key, file);

                return new Response(JSON.stringify({ message: "Photo uploaded successfully" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 5. List Archived Material Requests (Admin)
            if (method === "GET" && url.pathname.endsWith("/admin/material/requests/archived")) {
                const list = await env.MY_BUCKET.list({ prefix: "archives/material_requests/" });
                return new Response(JSON.stringify(list.objects), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/material/requests/archived")) {
                const body = await request.json();
                const { id, key } = body;
                if (!id || !key) return new Response("Missing id or key", { status: 400, headers: corsHeaders });

                const obj = await env.MY_BUCKET.get(key);
                if (!obj) return new Response("Archive not found", { status: 404, headers: corsHeaders });

                let csv = await obj.text();
                const lines = csv.split('\n');
                const header = lines[0];
                const rows = lines.slice(1);

                const filtered = rows.filter(row => {
                    if (!row.trim()) return false;
                    // Robust CSV separation for the first column (ID)
                    let firstCol = '';
                    let inQuotes = false;
                    for (let i = 0; i < row.length; i++) {
                        const char = row[i];
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === ',' && !inQuotes) break;
                        else firstCol += char;
                    }
                    // Remove potential double quotes from firstCol
                    const cleanId = firstCol.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
                    return cleanId !== id;
                });

                const newCsv = [header, ...filtered].join('\n');
                await env.MY_BUCKET.put(key, newCsv, { httpMetadata: { contentType: "text/csv" } });

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: VEHICLE LOGS (Admin) ---
            if (method === "GET" && url.pathname.endsWith("/admin/vehicle/all-logs")) {
                const vehicle_id = url.searchParams.get('vehicle_id');
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                let query = `${supabaseUrl}/rest/v1/vehicle_logs?select=*,profiles(first_name,last_name)&order=created_at.desc&limit=100`;
                if (vehicle_id) query += `&vehicle_id=eq.${vehicle_id}`;
                
                const res = await fetch(query, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/vehicle/log")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Fetch to check for attachment
                const checkRes = await fetch(`${supabaseUrl}/rest/v1/vehicle_logs?id=eq.${id}&select=image_path`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (checkRes.ok) {
                    const data = await checkRes.json();
                    if (data && data[0] && data[0].image_path) {
                        try {
                            await env.MY_BUCKET.delete(data[0].image_path);
                        } catch (e) {
                            console.error("R2 Delete Error:", e);
                        }
                    }
                }

                // 2. Delete Log
                const res = await fetch(`${supabaseUrl}/rest/v1/vehicle_logs?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: VEHICLES (Mobile / My Vehicle) ---
            if (method === "GET" && url.pathname.endsWith("/my-vehicle")) {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                
                // 1. Fetch user assigned vehicle
                const res = await fetch(`${supabaseUrl}/rest/v1/vehicles?assigned_user_id=eq.${user.id}&select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                let data = await res.json();

                // 2. Fetch all unassigned (common) vehicles
                const commonRes = await fetch(`${supabaseUrl}/rest/v1/vehicles?assigned_user_id=is.null&select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                let commonData = [];
                if (commonRes.ok) {
                    commonData = await commonRes.json();
                }

                return new Response(JSON.stringify({
                    assigned: data[0] || null,
                    common: commonData
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "PATCH" && url.pathname.endsWith("/my-vehicle")) {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                
                const { id, next_maintenance_date, next_maintenance_km, toll_card, dkv_card, last_ct_date } = body;
                if (!id) return new Response("Missing vehicle ID", { status: 400, headers: corsHeaders });
                
                // Verify user owns it
                const checkRes = await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${id}&assigned_user_id=eq.${user.id}`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!checkRes.ok) return new Response(await checkRes.text(), { status: checkRes.status, headers: corsHeaders });
                const checkData = await checkRes.json();
                if (checkData.length === 0) return new Response("Unauthorized to edit this vehicle", { status: 403, headers: corsHeaders });

                const updateRes = await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${id}`, {
                    method: "PATCH",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        next_maintenance_date: next_maintenance_date || null,
                        last_ct_date: last_ct_date || null,
                        next_maintenance_km: next_maintenance_km ? parseInt(next_maintenance_km) : null,
                        toll_card: toll_card || null,
                        dkv_card: dkv_card || null,
                        updated_at: new Date().toISOString()
                    })
                });
                if (!updateRes.ok) return new Response(await updateRes.text(), { status: updateRes.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/vehicle/log")) {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const { vehicle_id, type, value, description, image_path, event_date } = body;
                if (!vehicle_id || !type) return new Response("Missing parameters", { status: 400, headers: corsHeaders });
                
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Insert Log
                const insertObj = { 
                    vehicle_id, 
                    user_id: user.id, 
                    type, 
                    value, 
                    description, 
                    image_path,
                    created_at: event_date || new Date().toISOString()
                };

                const res = await fetch(`${supabaseUrl}/rest/v1/vehicle_logs`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify(insertObj)
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });

                // 2. If it's a mileage update OR a log with current_mileage, update the vehicle last_mileage
                const mileageVal = type === 'mileage' ? value : body.current_mileage;
                if (mileageVal) {
                    await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${vehicle_id}`, {
                        method: "PATCH",
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ last_mileage: parseInt(mileageVal), updated_at: new Date().toISOString() })
                    });

                    // Si c'est un plein, on ajoute un point de kilomÃ©trage sÃ©parÃ© pour la courbe de suivi
                    if (type === 'fuel') {
                        await fetch(`${supabaseUrl}/rest/v1/vehicle_logs`, {
                            method: "POST",
                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                                vehicle_id, 
                                user_id: user.id, 
                                type: 'mileage', 
                                value: mileageVal, 
                                description: `RelevÃ© auto (Plein)`, 
                                created_at: event_date || new Date().toISOString()
                            })
                        });
                    }
                }

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: DKV CARDS (Admin) ---
            if (method === "GET" && url.pathname.endsWith("/admin/dkv-cards")) {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/dkv_cards?select=*&order=card_number.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const data = await res.json();
                return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/dkv-cards")) {
                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                
                const { id, card_number, description } = body;
                const upsertBody = { card_number, description, updated_at: new Date().toISOString() };
                if (id) upsertBody.id = id;

                const res = await fetch(`${supabaseUrl}/rest/v1/dkv_cards`, {
                    method: "POST",
                    headers: { 
                        "apikey": serviceKey, 
                        "Authorization": `Bearer ${serviceKey}`, 
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(upsertBody)
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/dkv-cards")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/dkv_cards?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: TOLL CARDS (Admin) ---
            if (method === "GET" && url.pathname.endsWith("/admin/toll-cards")) {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/toll_cards?select=*&order=card_number.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const data = await res.json();
                return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/toll-cards")) {
                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const { id, card_number, description } = body;
                const upsertBody = { card_number, description, updated_at: new Date().toISOString() };
                if (id) upsertBody.id = id;
                const res = await fetch(`${supabaseUrl}/rest/v1/toll_cards`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
                    body: JSON.stringify(upsertBody)
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/toll-cards")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/toll_cards?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MATERIAL CONFIG (Admin) ---
            if (method === "GET" && url.pathname.endsWith("/admin/material/config")) {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1&select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const data = await res.json();
                return new Response(JSON.stringify(data[0] || { alert_users: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/material/config")) {
                const body = await request.json();
                const { alert_users } = body;
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_request_config`, {
                    method: "POST",
                    headers: { 
                        "apikey": serviceKey, 
                        "Authorization": `Bearer ${serviceKey}`, 
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify({ id: 1, alert_users, updated_at: new Date().toISOString() })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MATERIAL REQUESTS (User Mobile) ---
            if (method === "GET" && url.pathname === "/material/requests") {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_requests?user_id=eq.${user.id}&select=*&order=status.asc,created_at.desc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/material/requests") {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const { material_name, comment, category, image_path } = body;
                if (!material_name) return new Response("Missing material_name", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Insert Request
                const res = await fetch(`${supabaseUrl}/rest/v1/material_requests`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: user.id, material_name, comment, category, image_path, status: 'requested' })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });

                // 2. Alert Configured Admins
                try {
                    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=first_name,last_name`, { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } });
                    const p = await profileRes.json();
                    const senderName = p[0] ? `${p[0].first_name} ${p[0].last_name}` : 'Un salariÃ©';

                    const configRes = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1&select=alert_users`, {
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                    });
                    if (configRes.ok) {
                        const configData = await configRes.json();
                        const alertUsers = configData[0]?.alert_users || [];
                        if (alertUsers.length > 0) {
                            await sendPushNotification(env, alertUsers, `🚨 Nouvelle demande : ${senderName} demande "${material_name}".`);
                        }
                    }

                    // --- NEW: Email Notification via Resend ---
                    const origin = new URL(request.url).origin;
                    const imageUrl = image_path ? `${origin}/get/${image_path}` : null;
                    const imageHtml = imageUrl ? `<div style="margin-top:20px;"><img src="${imageUrl}" style="max-width:100%; border-radius:12px; border: 1px solid #eee;" alt="Photo matériel"></div>` : '';
                    
                    const emailBody = `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c3e50; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                            <div style="background: #2da140; padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 24px;">🛠️ Nouvelle Demande Matériel</h1>
                            </div>
                            <div style="padding: 30px; background: #ffffff;">
                                <p style="font-size: 16px; margin-top: 0;">Une nouvelle demande vient d'être déposée sur l'application.</p>
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                    <p style="margin: 5px 0;"><strong>👤 Salarié :</strong> ${senderName}</p>
                                    <p style="margin: 5px 0;"><strong>📦 Matériel :</strong> ${material_name}</p>
                                    <p style="margin: 5px 0;"><strong>📁 Catégorie :</strong> ${category || 'Non spécifiée'}</p>
                                    <p style="margin: 5px 0;"><strong>💬 Commentaire :</strong> ${comment || 'Aucun commentaire'}</p>
                                </div>
                                ${imageHtml}
                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="${origin}/dashboard.html" style="background: #2da140; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ouvrir le Dashboard</a>
                                </div>
                            </div>
                            <div style="background: #f1f3f5; padding: 15px; text-align: center; font-size: 12px; color: #7f8c8d;">
                                Ceci est un message automatique envoyé par PouchainApp.
                            </div>
                        </div>
                    `;

                    await sendResendEmail(env, "pprayez@pouchain.fr", `🛠️ Demande Matériel : ${material_name} (${senderName})`, emailBody);

                } catch (e) { console.error("Notification alert failed", e); }

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MACHINE FAMILIES ---
            if (method === "GET" && url.pathname === "/admin/machine-families") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/machine_families?select=*&order=name.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/machine-families") {
                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/machine_families`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname === "/admin/machine-families") {
                const id = url.searchParams.get('id');
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/machine_families?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                return new Response(JSON.stringify({ success: res.ok }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MACHINES (Admin/Map) ---
            if (method === "GET" && url.pathname === "/admin/machines") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/machines?select=*&order=machine_id.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const out = await res.text();
                return new Response(out || "[]", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/machines") {
                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const { 
                    id, machine_id, name, type, description, latitude, longitude, 
                    last_maintenance_date, next_maintenance_date,
                    family, serial_number, periodicity, status_active, 
                    vgp_status, vgp_observations, assigned_to, 
                    commissioning_date, last_control_type, expiration_date, comments
                } = body;
                const upsertBody = { 
                    machine_id, name, type, description, latitude, longitude, 
                    last_maintenance_date, next_maintenance_date,
                    family, serial_number, periodicity, status_active, 
                    vgp_status, vgp_observations, assigned_to, 
                    commissioning_date, last_control_type, expiration_date, comments,
                    updated_at: new Date().toISOString() 
                };
                if (id) upsertBody.id = id;
                const res = await fetch(`${supabaseUrl}/rest/v1/machines?on_conflict=machine_id`, {
                    method: "POST",
                    headers: { 
                        "apikey": serviceKey, 
                        "Authorization": `Bearer ${serviceKey}`, 
                        "Content-Type": "application/json",
                        "Prefer": "return=representation,resolution=merge-duplicates"
                    },
                    body: JSON.stringify(upsertBody)
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const savedArr = await res.json();
                return new Response(JSON.stringify(savedArr[0] || { success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname === "/admin/machines") {
                const id = url.searchParams.get('id');
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Delete Photo from R2 if exists
                try {
                    await env.MY_BUCKET.delete(`machines_photos/${id}.png`);
                } catch(e) {}

                const res = await fetch(`${supabaseUrl}/rest/v1/machines?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MACHINE MAINTENANCE HISTORY ---
            if (method === "GET" && url.pathname === "/admin/machines/maintenance") {
                const machineId = url.searchParams.get('machine_id');
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                let query = `${supabaseUrl}/rest/v1/material_maintenance_history?select=*,profiles(first_name,last_name)&order=date.desc&limit=50`;
                if (machineId) query += `&machine_id=eq.${machineId}`;

                const res = await fetch(query, { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }});
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/machines/maintenance") {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const { machine_id, details, next_maintenance_date, vgp_status, vgp_observations, last_control_type } = body;
                if (!machine_id) return new Response("Missing machine_id", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Insert History Entry
                const histRes = await fetch(`${supabaseUrl}/rest/v1/material_maintenance_history`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        machine_id, user_id: user.id, details, next_maintenance_date, 
                        date: new Date().toISOString() 
                    })
                });
                if (!histRes.ok) return new Response(await histRes.text(), { status: histRes.status, headers: corsHeaders });

                // 2. Update Machine Status & Dates
                const machUpdate = { 
                    last_maintenance_date: new Date().toISOString().split('T')[0],
                    next_maintenance_date: next_maintenance_date,
                    vgp_status: vgp_status || null,
                    vgp_observations: vgp_observations || null,
                    last_control_type: last_control_type || 'Maintenance'
                };
                await fetch(`${supabaseUrl}/rest/v1/machines?id=eq.${machine_id}`, {
                    method: "PATCH",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify(machUpdate)
                });

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MACHINE PHOTO UPLOAD (Admin) ---
            if (method === "POST" && url.pathname === "/admin/machines/photo") {
                const formData = await request.formData();
                const file = formData.get("file");
                const machineId = formData.get("machineId");

                if (!file || !machineId) return new Response("Missing parameters", { status: 400, headers: corsHeaders });

                const key = `machines_photos/${machineId}.png`;
                await env.MY_BUCKET.put(key, file, {
                    httpMetadata: { contentType: file.type || "image/png" }
                });

                return new Response(JSON.stringify({ success: true, key }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: MACHINE LOGS ---
            if (method === "GET" && url.pathname === "/admin/machines/logs") {
                const machine_db_id = url.searchParams.get('machine_db_id');
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                let query = `${supabaseUrl}/rest/v1/machine_logs?select=*,profiles(first_name,last_name)&order=created_at.desc&limit=50`;
                if (machine_db_id) query += `&machine_db_id=eq.${machine_db_id}`;
                const res = await fetch(query, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const out = await res.text();
                return new Response(out || "[]", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/machines/logs") {
                const body = await request.json();
                const { machine_db_id, action_type, description } = body;
                if (!machine_db_id || !action_type) return new Response("Missing parameters", { status: 400, headers: corsHeaders });
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/machine_logs`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ machine_db_id, user_id: user.id, action_type, description, created_at: new Date().toISOString() })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            // --- BUILDINGS API ---
            if (method === "GET" && url.pathname === "/admin/buildings") {
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                
                const res = await fetch(`${supabaseUrl}/rest/v1/buildings?select=*&order=name.asc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/buildings") {
                const body = await request.json();
                const { name, svg_url } = body;
                if (!name || !svg_url) return new Response("Missing parameters", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/buildings`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ name, svg_url, created_at: new Date().toISOString() })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname === "/admin/buildings") {
                const id = url.searchParams.get('id');
                if (!id) return new Response("Missing ID", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/buildings?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "GET" && url.pathname === "/admin/machines/logs") {
                const machine_db_id = url.searchParams.get('machine_db_id');
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                
                let query = `${supabaseUrl}/rest/v1/machine_logs?select=*,profiles(first_name,last_name)&order=created_at.desc&limit=50`;
                if (machine_db_id) query += `&machine_db_id=eq.${machine_db_id}`;
                
                const res = await fetch(query, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/machines/logs") {
                const body = await request.json();
                const { machine_db_id, action_type, description } = body;
                if (!machine_db_id || !action_type) return new Response("Missing parameters", { status: 400, headers: corsHeaders });
                
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/machine_logs`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        machine_db_id, 
                        user_id: user.id, 
                        action_type, 
                        description,
                        created_at: new Date().toISOString()
                    })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: NOTIFICATIONS SUBSCRIBE ---
            if (method === "POST" && url.pathname.endsWith("/notifications/subscribe")) {
                const body = await request.json();
                const { subscription } = body;
                if (!subscription) return new Response("Missing subscription", { status: 400, headers: corsHeaders });
                if (!user) {
                    console.error("Subscribe Error: User not found in request (Auth error)");
                    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                }

                console.log(`Attempting subscribe for user: ${user.id}`);

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                if (!serviceKey) {
                    console.error("Subscribe Error: SUPABASE_SERVICE_KEY is missing in env");
                    return new Response("Server Configuration Error: Missing Service Key", { status: 500, headers: corsHeaders });
                }

                // 1. SUPPRIMER LES ANCIENS JETONS pour cet utilisateur
                // On ne garde que le plus rÃ©cent (celui qui arrive maintenant)
                await fetch(`${supabaseUrl}/rest/v1/user_push_subscriptions?user_id=eq.${user.id}`, {
                    method: 'DELETE',
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });

                // 2. Enregistrer le nouveau jeton
                const res = await fetch(`${supabaseUrl}/rest/v1/user_push_subscriptions`, {
                    method: "POST",
                    headers: { 
                        "apikey": serviceKey, 
                        "Authorization": `Bearer ${serviceKey}`, 
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify({ 
                        user_id: user.id, 
                        subscription: subscription.toJSON ? subscription.toJSON() : subscription 
                    })
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    // Si c'est une erreur de doublon (23505), on considÃ¨re que c'est un succÃ¨s (dÃ©jÃ  enregistrÃ©)
                    if (errorText.includes("23505") || errorText.includes("already exists")) {
                        console.log(`User ${user.id} already subscribed with this token.`);
                        return new Response(JSON.stringify({ success: true, message: "DÃ©jÃ  enregistrÃ©" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                    }
                    console.error(`Supabase Subscribe Error (Table: user_push_subscriptions):`, errorText);
                    return new Response(`Database Error: ${errorText}`, { status: res.status, headers: corsHeaders });
                }

                console.log(`Push Subscription success for user ${user.id}`);
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: ADMIN SEND NOTIFICATION ---
            if (method === "POST" && url.pathname.endsWith("/admin/notifications/send")) {
                const body = await request.json();
                const { userId, userIds, message } = body; // Support either single userId or array userIds
                if (!message) return new Response("Missing message", { status: 400, headers: corsHeaders });

                // check admin
                const isUserAdmin = await isAdmin(user, env);
                if (!isUserAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

                // Multi-target logic
                let result;
                if (userIds && Array.isArray(userIds)) {
                    // Send to specific list
                    result = await sendPushNotification(env, userIds, message);
                } else {
                    // Send to single or all
                    result = await sendPushNotification(env, userId === 'all' ? null : userId, message);
                }
                
                return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: NOTIFICATION CONFIG ---
            if (method === "GET" && url.pathname.endsWith("/admin/notifications/config")) {
                const isUserAdmin = await isAdmin(user, env);
                if (!isUserAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1&select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                const data = await res.json();
                const config = data[0] || {};
                return new Response(JSON.stringify({
                    admin_alert_ids: config.alert_users || [],
                    auto_planning: config.auto_planning !== false,
                    auto_mileage: config.auto_mileage !== false,
                    auto_deadline: config.auto_deadline !== false,
                    auto_material: config.auto_material !== false,
                    maint_alert_days: config.maint_alert_days || 30,
                    maint_alert_userIds: config.maint_alert_userIds || [],
                    maint_alert_reps: config.maint_alert_reps || 1
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/notifications/config")) {
                const isUserAdmin = await isAdmin(user, env);
                if (!isUserAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });
                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const upsertBody = { id: 1, updated_at: new Date().toISOString() };
                if (body.admin_alert_ids) upsertBody.alert_users = body.admin_alert_ids;
                if (body.auto_planning !== undefined) upsertBody.auto_planning = body.auto_planning;
                if (body.auto_mileage !== undefined) upsertBody.auto_mileage = body.auto_mileage;
                if (body.auto_deadline !== undefined) upsertBody.auto_deadline = body.auto_deadline;
                if (body.auto_material !== undefined) upsertBody.auto_material = body.auto_material;
                if (body.maint_alert_days !== undefined) upsertBody.maint_alert_days = body.maint_alert_days;
                if (body.maint_alert_userIds !== undefined) upsertBody.maint_alert_userIds = body.maint_alert_userIds;
                if (body.maint_alert_reps !== undefined) upsertBody.maint_alert_reps = body.maint_alert_reps;

                await fetch(`${supabaseUrl}/rest/v1/material_request_config`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
                    body: JSON.stringify(upsertBody)
                });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: ADMIN LIST SUBSCRIBERS ---
            if (method === "GET" && url.pathname.endsWith("/admin/notifications/subscribers")) {
                const isUserAdmin = await isAdmin(user, env);
                if (!isUserAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // Return all subscriptions
                const res = await fetch(`${supabaseUrl}/rest/v1/user_push_subscriptions?select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });

                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const data = await res.json();
                
                return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: ADMIN NOTIFICATION SCHEDULES ---
            if (method === "GET" && url.pathname.endsWith("/admin/notifications/schedules")) {
                const isUserAdmin = await isAdmin(user, env);
                if (!isUserAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/notification_schedules?select=*&order=created_at.desc`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });

                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname.endsWith("/admin/notifications/schedules")) {
                const isUserAdmin = await isAdmin(user, env);
                if (!isUserAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

                const body = await request.json();
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/notification_schedules`, {
                    method: "POST",
                    headers: { 
                        "apikey": serviceKey, 
                        "Authorization": `Bearer ${serviceKey}`, 
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates,return=representation"
                    },
                    body: JSON.stringify(body)
                });

                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/notifications/schedules")) {
                const isUserAdmin = await isAdmin(user, env);
                if (!isUserAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

                const id = url.searchParams.get('id');
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/notification_schedules?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });

                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- ROUTE: ADMIN SYNC ALL USERS (Mock for now, returns all profiles) ---
            if (method === "POST" && url.pathname.endsWith("/admin/notifications/sync")) {
                 // On renvoie juste le signal de succÃ¨s pour rafraÃ®chir l'interface
                 return new Response(JSON.stringify({ success: true, message: "Synchronisation effectuÃ©e" }), {
                     headers: { ...corsHeaders, "Content-Type": "application/json" }
                 });
            }

            // --- ROUTE: FRITERIE ORDERS (User Mobile) ---
            if (method === "GET" && url.pathname === "/friterie/order") {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/friterie_orders?user_id=eq.${user.id}&select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/friterie/order") {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const { item_name, category, details, sauce } = body;
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/friterie_orders`, {
                    method: "POST",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: user.id, item_name, category, details, sauce })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname === "/friterie/order") {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const { id } = body;
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const res = await fetch(`${supabaseUrl}/rest/v1/friterie_orders?id=eq.${id}&user_id=eq.${user.id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "GET" && url.pathname === "/friterie/all-orders") {
                 if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                 const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                 const serviceKey = env.SUPABASE_SERVICE_KEY;

                 // 1. Fetch Orders
                 const ordersRes = await fetch(`${supabaseUrl}/rest/v1/friterie_orders?select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                 });
                 if (!ordersRes.ok) return new Response(await ordersRes.text(), { status: ordersRes.status, headers: corsHeaders });
                 const orders = await ordersRes.json();

                 // 2. Fetch Profiles for names
                 const profilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,first_name,last_name`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                 });
                 const profiles = profilesRes.ok ? await profilesRes.json() : [];

                 // 3. Merge
                 const enriched = orders.map(o => {
                    const p = profiles.find(p => p.id === o.user_id);
                    return { ...o, profiles: p || null };
                 });

                 return new Response(JSON.stringify(enriched), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "GET" && url.pathname === "/admin/friterie/orders") {
                 const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                 const serviceKey = env.SUPABASE_SERVICE_KEY;
                 const res = await fetch(`${supabaseUrl}/rest/v1/friterie_orders?select=*,profiles(first_name,last_name)`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                 });
                 if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                 return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && url.pathname === "/admin/material/requests/remind") {
                const result = await sendMaterialReminders(env);
                return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 404
            return new Response("Not Found", { status: 404, headers: corsHeaders });
        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
        }
    },

    // DÃ©clencheur CRON planifiÃ© pour ping Supabase et garder le projet actif (Ã©vite la pause aprÃ¨s 1 semaine d'inactivitÃ©)
    async scheduled(event, env, ctx) {
        const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
        const serviceKey = env.SUPABASE_SERVICE_KEY;

        if (serviceKey) {
            try {
                // 1. Keep-alive Supabase
                const res = await fetch(`${supabaseUrl}/rest/v1/profiles?limit=1`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (res.ok) console.log("Ping Supabase keep-alive réussi.");

                // 2. Load Config
                const configRes = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1&select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                const configData = await configRes.json();
                const globalConfig = configData[0] || {};
                
                const now = new Date();
                const day = now.getUTCDay(); // 0:Sun, 1:Mon, ..., 5:Fri, 6:Sat
                const hour = (now.getUTCHours() + 2) % 24; // Paris Time (approx)
                const min = now.getUTCMinutes();

                // AUTOMATIONS
                
                // A. Rappels Hebdomadaires (Vendredi après-midi)
                try {
                    if (day === 5 && hour >= 14 && hour < 16) {
                        const vRes = await fetch(`${supabaseUrl}/rest/v1/vehicles?assigned_user_id=is.not.null&select=*`, {
                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                        });
                        const vehicles = await vRes.json();
                        
                        if (Array.isArray(vehicles)) {
                            // 1. Rappel Kilométrage
                            if (globalConfig.auto_mileage !== false) {
                                const userIds = [...new Set(vehicles.map(v => v.assigned_user_id))];
                                if (userIds.length > 0) {
                                    await sendPushNotification(env, userIds, "🚗 Rappel : Veuillez mettre à jour le kilométrage de votre véhicule dans l'application.");
                                }
                            }

                            // 2. Rappel Contrôle Technique
                            for (const v of vehicles) {
                                if (v.last_ct_date && v.assigned_user_id) {
                                    const lastCt = new Date(v.last_ct_date);
                                    const nextCt = new Date(lastCt);
                                    nextCt.setMonth(nextCt.getMonth() + (v.ct_interval_months || 12));
                                    
                                    const diffDays = Math.ceil((nextCt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                    
                                    if (diffDays <= 60) {
                                        let msg = "";
                                        if (diffDays <= 0) {
                                            msg = `🚨 Contrôle Technique DÉPASSÉ pour votre véhicule (${v.plate_number}) ! Veuillez le faire rapidement.`;
                                        } else {
                                            msg = `🔔 Rappel : Le contrôle technique de votre véhicule (${v.plate_number}) arrive à échéance le ${nextCt.toLocaleDateString('fr-FR')} (dans ${diffDays} jours).`;
                                        }
                                        await sendPushNotification(env, v.assigned_user_id, msg);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { console.error("Weekly reminders error:", e); }

                // C. Friterie Notification (Mercredi 11:00)
                try {
                    if (day === 3 && hour === 11) {
                        const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=user_id`, {
                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                        });
                        if (subRes.ok) {
                            const subsData = await subRes.json();
                            if (Array.isArray(subsData)) {
                                const userIds = [...new Set(subsData.map(s => s.user_id))];
                                if (userIds.length > 0) {
                                    await sendPushNotification(env, userIds, "🍟 Fait ta commande ma belle frite belge !");
                                }
                            }
                        }
                    }
                } catch (e) { console.error("Friterie notification error:", e); }

                // D. Friterie Cleanup (19h00)
                try {
                    if (hour === 19) {
                        await fetch(`${supabaseUrl}/rest/v1/friterie_orders`, {
                            method: "DELETE",
                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                        });
                        console.log("Friterie orders cleared.");
                    }
                } catch (e) { console.error("Friterie cleanup error:", e); }

                // E. Échéances Véhicules
                try {
                    if (globalConfig.auto_deadline !== false) {
                        const vRes = await fetch(`${supabaseUrl}/rest/v1/vehicles?assigned_user_id=is.not.null&select=*`, {
                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                        });
                        const vehicles = await vRes.json();
                        if (Array.isArray(vehicles)) {
                            for (const v of vehicles) {
                                let alertTriggered = false;
                                let reason = "";
                                if (v.next_maintenance_km && v.last_mileage && (v.next_maintenance_km - v.last_mileage < 500)) {
                                    alertTriggered = true;
                                    reason = `Entretien proche (${v.next_maintenance_km} km)`;
                                }
                                if (v.next_maintenance_date) {
                                    const deadline = new Date(v.next_maintenance_date);
                                    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                                    if (diffDays < 30 && diffDays > -1) {
                                        alertTriggered = true;
                                        reason = `Entretien/CT proche (${new Date(v.next_maintenance_date).toLocaleDateString()})`;
                                    }
                                }
                                if (alertTriggered) {
                                    await sendPushNotification(env, v.assigned_user_id, `🚗 Échéance véhicule (${v.plate_number || 'Véhicule'}) : ${reason}.`);
                                }
                            }
                        }
                    }
                } catch (e) { console.error("Vehicle deadlines error:", e); }

                // F. Maintenance Matériel
                try {
                    if (globalConfig.maint_alert_userIds && globalConfig.maint_alert_userIds.length > 0) {
                        const mRes = await fetch(`${supabaseUrl}/rest/v1/machines?next_maintenance_date=is.not.null&select=*`, {
                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                        });
                        if (mRes.ok) {
                            const machines = await mRes.json();
                            if (Array.isArray(machines)) {
                                const alertDays = globalConfig.maint_alert_days || 30;
                                for (const m of machines) {
                                    const deadline = new Date(m.next_maintenance_date);
                                    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                                    if (diffDays <= alertDays && diffDays > 0) {
                                        await sendPushNotification(env, globalConfig.maint_alert_userIds, `🛠️ Maintenance : Le matériel "${m.name || m.machine_id}" arrive à échéance le ${new Date(m.next_maintenance_date).toLocaleDateString()}.`);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { console.error("Material maintenance error:", e); }

                // G. General Scheduled Notifications
                try {
                    const scheduleRes = await fetch(`${supabaseUrl}/rest/v1/notification_schedules?active=eq.true&select=*`, {
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                    });
                    if (scheduleRes.ok) {
                        const schedules = await scheduleRes.json();
                        if (Array.isArray(schedules)) {
                            const todayStr = now.toISOString().split('T')[0];
                            for (const s of schedules) {
                                let shouldSend = false;
                                const lastSentStr = s.last_sent_at ? s.last_sent_at.split('T')[0] : null;
                                if (lastSentStr === todayStr) continue;

                                if (s.hour !== undefined && s.hour !== null && hour !== s.hour) continue;
                                if (s.minute !== undefined && s.minute !== null && min !== s.minute) continue;

                                switch (s.frequency) {
                                    case 'daily': shouldSend = true; break;
                                    case 'weekly': if (day === s.day_of_week) shouldSend = true; break;
                                    case 'monthly': if (now.getUTCDate() === s.day_of_month) shouldSend = true; break;
                                    case 'yearly': if ((now.getUTCMonth() + 1) === s.month && now.getUTCDate() === s.day_of_month) shouldSend = true; break;
                                }

                                if (shouldSend) {
                                    let targetIds = null;
                                    if (s.target_type === 'specific') {
                                        targetIds = s.target_user_ids || (s.user_id ? [s.user_id] : null);
                                    }
                                    const result = await sendPushNotification(env, targetIds, s.message, s.app_url);
                                    if (result.success) {
                                        await fetch(`${supabaseUrl}/rest/v1/notification_schedules?id=eq.${s.id}`, {
                                            method: "PATCH",
                                            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                                            body: JSON.stringify({ last_sent_at: now.toISOString() })
                                        });
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { console.error("General schedules error:", e); }

                // I. Rappel Demandes Matériel (Lundi matin 09:00)
                try {
                    if (day === 1 && hour === 9) {
                        await sendMaterialReminders(env);
                    }
                } catch (e) { console.error("Material reminder error:", e); }

                // H. Archivage Hebdo (Lundi 08:00)
                try {
                    if (day === 1 && hour === 8) {
                        await performArchiving(env);
                    }
                } catch (e) { console.error("Archiving error:", e); }

            } catch (err) {
                console.error("Scheduled global error:", err);
            }
        }
    }
};

async function performArchiving(env) {
    const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
    const serviceKey = env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) return { count: 0, message: "No service key" };

    const now = new Date();
    const dayCurr = now.getDay();
    const diff = (dayCurr === 0 ? -6 : 1) - dayCurr;
    const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    const thresholdStr = currentMonday.toISOString().split('T')[0];

    // 1. Fetch tasks before this Monday
    const fetchUrl = `${supabaseUrl}/rest/v1/tasks?date=lt.${thresholdStr}&select=*&order=date.asc`;
    const fetchRes = await fetch(fetchUrl, { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } });
    if (!fetchRes.ok) throw new Error("Fetch tasks failed: " + await fetchRes.text());
    const oldTasks = await fetchRes.json();
    if (oldTasks.length === 0) return { count: 0, message: "Nothing to archive" };

    // 2. Fetch profiles for name mapping
    const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,first_name,last_name`, {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });
    const profiles = await (profRes.ok ? profRes.json() : []);
    const nameMap = {};
    profiles.forEach(p => {
        nameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id;
    });

    // 3. Group tasks by year
    const tasksByYear = {};
    oldTasks.forEach(t => {
        const year = t.date.split('-')[0];
        if (!tasksByYear[year]) tasksByYear[year] = [];
        tasksByYear[year].push(t);
    });

    const headers = ["id", "user_id", "user_name", "title", "date", "start_time", "end_time", "done", "created_at"];
    const results = [];

    for (const year in tasksByYear) {
        const archiveKey = `archives/planning/Planning de l'annÃ©e ${year} CSV Format.csv`;
        let existingContent = "";
        
        // Check if file exists to append
        const existingObj = await env.MY_BUCKET.get(archiveKey);
        if (existingObj) {
            existingContent = await existingObj.text();
            if (existingContent && !existingContent.endsWith("\n")) existingContent += "\n";
        } else {
            existingContent = headers.join(",") + "\n";
        }

        const newRows = tasksByYear[year].map(t => {
            return headers.map(h => {
                let val = (h === 'user_name') ? (nameMap[t.user_id] || "Inconnu") : (t[h] === null || t[h] === undefined ? "" : t[h]);
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(",");
        }).join("\n") + "\n";

        await env.MY_BUCKET.put(archiveKey, existingContent + newRows, {
            httpMetadata: { contentType: "text/csv" }
        });
        results.push({ year, count: tasksByYear[year].length });
    }

    // 4. Delete archived from Supabase
    await fetch(`${supabaseUrl}/rest/v1/tasks?date=lt.${thresholdStr}`, {
        method: "DELETE",
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });

    return { count: oldTasks.length, details: results };
}

async function getUser(request, env) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return null;
    const token = authHeader.replace("Bearer ", "");

    const response = await fetch(`${env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co"}/auth/v1/user`, {
        headers: {
            "apikey": env.SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) return null;
    return await response.json();
}

async function isAdmin(user, env) {
    if (!user) return false;
    // Verify against profiles table
    const res = await fetch(`${env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co"}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
        headers: {
            "apikey": env.SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
        }
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.length > 0 && data[0].role === 'admin';
}

/**
 * Helper to send Web Push (VAPID) or Native Push (FCM).
 */
async function sendPushNotification(env, userId, message, appUrl = null) {
    const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
    const serviceKey = env.SUPABASE_SERVICE_KEY;
    
    let query = `${supabaseUrl}/rest/v1/user_push_subscriptions?select=subscription`;
    if (userId) {
        if (Array.isArray(userId) && userId.length > 0) {
            query += `&user_id=in.(${userId.join(',')})`;
        } else if (typeof userId === 'string') {
            query += `&user_id=eq.${userId}`;
        }
    }
    query += `&order=created_at.desc`;
    
    const res = await fetch(query, {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });
    
    if (!res.ok) return { success: false, error: await res.text() };
    const rawSubs = await res.json();
    if (rawSubs.length === 0) return { success: true, count: 0, message: "Aucun abonné trouvé" };

    // Formatage et parsing des abonnements
    const subs = rawSubs.map(s => {
        let subData = s.subscription;
        if (typeof subData === 'string' && subData.trim().startsWith('{')) {
            try { subData = JSON.parse(subData); } catch(e) { }
        }
        return subData;
    }).filter(Boolean);

    let count = 0;
    let errors = [];

    // Pre-fetch FCM Token if there are Capacitor subscriptions
    let fcmAccessToken = null;
    const hasCapacitor = subs.some(s => s.type === 'capacitor' || s.token);
    if (hasCapacitor) {
        try {
            const sa = typeof env.FIREBASE_SERVICE_ACCOUNT === 'string' ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) : env.FIREBASE_SERVICE_ACCOUNT;
            fcmAccessToken = await getGCPAccessToken(sa);
        } catch (e) {
            console.error("FCM Auth Error:", e);
            errors.push("Auth Firebase échouée : " + e.message);
        }
    }

    const payload = {
        title: "Pouchain App",
        body: message,
        data: {
            message: message,
            click_action: "FCM_PLUGIN_ACTIVITY",
            url: appUrl || ""
        }
    };

    const seenTokens = new Set();
    for (const s of subs) {
        try {
            const token = s.token || (s.type === 'capacitor' ? s.token : null);
            if (!token || seenTokens.has(token)) continue;
            seenTokens.add(token);
            
            if (token) {
                if (!fcmAccessToken) continue;
                
                const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${JSON.parse(env.FIREBASE_SERVICE_ACCOUNT).project_id}/messages:send`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${fcmAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: {
                            token: token,
                            notification: { title: payload.title, body: payload.body },
                            data: {
                                ...payload.data,
                                android_channel_id: "pouchain_notifications"
                            },
                            android: {
                                priority: "high",
                                notification: {
                                    channel_id: "pouchain_notifications",
                                    sound: "default",
                                    click_action: "FCM_PLUGIN_ACTIVITY"
                                }
                            }
                        }
                    })
                });
                if (fcmRes.ok) count++;
            } 
        } catch (err) {
            // Silently skip failed individual tokens
        }
    }

    return { 
        success: count > 0, 
        count, 
        total: subs.length, 
        details: count > 0 ? "Notification(s) envoyée(s) avec succès." : "Aucun appareil réceptif trouvé." 
    };
}

/**
 * Google Auth Helper for Cloudflare Workers
 * Signs a JWT to get an access token for FCM v1 API.
 */
async function getGCPAccessToken(serviceAccountJson) {
    if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
    const sa = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
    
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = btoa(JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: sa.token_uri,
        exp: now + 3600,
        iat: now
    }));

    const decodeRSAPrivateKey = (pem) => {
        // Find the actual base64 content between the headers
        const pemContents = pem
            .replace(/-----BEGIN PRIVATE KEY-----/g, "")
            .replace(/-----END PRIVATE KEY-----/g, "")
            .replace(/\s/g, ""); // Remove ALL spaces, tabs, newlines
            
        const binary = atob(pemContents);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return array.buffer;
    };

    const key = await crypto.subtle.importKey(
        "pkcs8",
        decodeRSAPrivateKey(sa.private_key),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
    const jwt = `${header}.${claim}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "")}`;

    const res = await fetch(sa.token_uri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error);
    return data.access_token;
}

/**
 * Find and notify admins about material requests older than 7 days
 */
async function sendMaterialReminders(env) {
    const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
    const serviceKey = env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) return { success: false, message: "Missing service key" };

    // 1. Fetch Config to get alert_users
    const configRes = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1`, {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });
    const configs = await configRes.json();
    const config = configs[0];
    if (!config || !config.alert_users || config.alert_users.length === 0) {
        return { success: false, message: "No alert users configured" };
    }

    // 2. Fetch Pending Requests older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString();

    const requestsRes = await fetch(`${supabaseUrl}/rest/v1/material_requests?status=eq.requested&created_at=lt.${dateStr}`, {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });
    const requests = await requestsRes.json();
    if (!Array.isArray(requests) || requests.length === 0) {
        return { success: true, count: 0, message: "No old pending requests" };
    }

    // 3. Fetch Alert User Profiles for names
    const usersRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=in.(${config.alert_users.join(',')})&select=id,first_name`, {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
    });
    const profiles = await usersRes.json();

    // 4. Send personalized notifications
    let totalSent = 0;
    for (const p of profiles) {
        const count = requests.length;
        const name = p.first_name || 'Admin';
        const message = count === 1 
            ? `Bonjour ${name}, une demande de matériel est en attente depuis plus d'une semaine. Merci d'indiquer si vous refusez ou commandez cette demande de votre collaborateur.`
            : `Bonjour ${name}, ${count} demandes de matériel sont en attente depuis plus d'une semaine. Merci d'indiquer si vous refusez ou commandez ces demandes de vos collaborateurs.`;
            
        const result = await sendPushNotification(env, [p.id], message);
        if (result && result.success) totalSent++;
    }

    return { success: true, count: requests.length, notified: totalSent };
}

/**
 * Send email via Resend API
 */
async function sendResendEmail(env, to, subject, html) {
    const apiKey = env.RESEND_API_KEY; 
    if (!apiKey) {
        console.error("RESEND_API_KEY missing in environment variables.");
        return { error: "API Key missing" };
    }
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "onboarding@resend.dev",
                to: [to],
                subject: subject,
                html: html
            })
        });
        const data = await res.json();
        if (!res.ok) {
            console.error("Resend API Error:", data);
            return { error: data };
        }
        console.log("Resend email sent successfully:", data);
        return data;
    } catch (e) {
        console.error("Resend Fetch Error:", e);
        return { error: e.message };
    }
}




function compareVersions(v1, v2) {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    // On compare segment par segment jusqu'au plus long
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const valA = a[i] || 0;
        const valB = b[i] || 0;
        if (valA > valB) return 1;
        if (valA < valB) return -1;
    }
    return 0;
}
