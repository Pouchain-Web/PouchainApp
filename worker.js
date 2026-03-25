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

        // 2. Security Check
        // If you want "public" view for files, allow GET without secret.
        const user = await getUser(request, env);

        // Check Auth (Skip for basic GET if you want public links)
        if (!url.pathname.startsWith('/get/')) {
            if (!user) {
                return new Response("Unauthorized", { status: 401, headers: corsHeaders });
            }

            // Check Admin for /admin/ routes
            if (url.pathname.startsWith('/admin/')) {
                const admin = await isAdmin(user, env);
                if (!admin) {
                    return new Response("Forbidden: Admin access required", { status: 403, headers: corsHeaders });
                }
            }
        }

        try {
            // --- ROUTE: LIST FILES ---
            if (method === "GET" && url.pathname.endsWith("/list")) { // /list or /api/list
                const userId = url.searchParams.get('userId');

                // 1. List from R2
                const listing = await env.MY_BUCKET.list();
                // Hide internal folders from listing
                let objects = listing.objects.filter(obj => !obj.key.startsWith('material_requests/'));

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 2. Admin desktop (no userId param) bypasses access control and sees everything.
                //    Mobile view always passes userId — access control is enforced for everyone there,
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
                // extract key after /get/
                const parts = url.pathname.split('/get/');
                if (parts.length < 2) return new Response("Invalid Path", { status: 400, headers: corsHeaders });

                const key = decodeURIComponent(parts[1]);
                // CHANGED: Using env.MY_BUCKET
                const object = await env.MY_BUCKET.get(key);

                if (!object) {
                    return new Response("File not found", { status: 404, headers: corsHeaders });
                }

                const headers = new Headers(corsHeaders);
                object.writeHttpMetadata(headers);
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

                // CHANGED: Using env.MY_BUCKET
                await env.MY_BUCKET.put(key, file);
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

                // Auto-carry forward: Move overdue unfinished tasks to today
                try {
                    const overdueUrl = `${supabaseUrl}/rest/v1/tasks?date=lt.${today}&done=neq.true`;
                    const resOverdue = await fetch(overdueUrl, {
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                    });
                    if (resOverdue.ok) {
                        const overdue = await resOverdue.json();
                        for (const ot of overdue) {
                            await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${ot.id}`, {
                                method: "PATCH",
                                headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                                body: JSON.stringify({ date: today })
                            });
                        }
                    }
                } catch(e) {}

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

            // --- ROUTE: PLANNING (User Mobile) ---
            if (method === "GET" && url.pathname.endsWith("/tasks")) {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                const { searchParams } = new URL(request.url);
                const date = searchParams.get('date'); // optional

                let queryUrl = `${supabaseUrl}/rest/v1/tasks?user_id=eq.${user.id}&select=*`;
                if (date) queryUrl += `&date=eq.${date}`;
                queryUrl += `&order=date.asc,start_time.asc`;

                const response = await fetch(queryUrl, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!response.ok) return new Response(await response.text(), { status: response.status, headers: corsHeaders });
                return new Response(await response.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "PATCH" && url.pathname.endsWith("/tasks")) {
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

            if (method === "PATCH" && url.pathname === "/admin/material/requests") {
                const body = await request.json();
                const { id, status } = body;
                if (!id || !status) return new Response("Missing id or status", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${id}`, {
                    method: "PATCH",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ status, updated_at: new Date().toISOString() })
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname === "/admin/material/requests") {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                // 1. Fetch image path before delete
                const checkRes = await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${id}&select=image_path`, {
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

                // 2. Delete from Supabase
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
                        "Prefer": "resolution=merge-duplicates"
                    },
                    body: JSON.stringify(upsertBody)
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "DELETE" && url.pathname.endsWith("/admin/vehicles")) {
                const body = await request.json();
                const { id } = body;
                if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${id}`, {
                    method: "DELETE",
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
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

            // --- ROUTE: VEHICLES (Mobile / My Vehicle) ---
            if (method === "GET" && url.pathname.endsWith("/my-vehicle")) {
                if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;
                const res = await fetch(`${supabaseUrl}/rest/v1/vehicles?assigned_user_id=eq.${user.id}&select=*`, {
                    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                });
                if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });
                const data = await res.json();
                return new Response(JSON.stringify(data[0] || null), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

                // 2. If it's a mileage update, update the vehicle last_mileage
                if (type === 'mileage' && value) {
                    await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${vehicle_id}`, {
                        method: "PATCH",
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ last_mileage: parseInt(value), updated_at: new Date().toISOString() })
                    });
                }

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

                // 2. Add Planning Alerts
                try {
                    const configRes = await fetch(`${supabaseUrl}/rest/v1/material_request_config?id=eq.1&select=alert_users`, {
                        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                    });
                    if (configRes.ok) {
                        const configData = await configRes.json();
                        const alertUsers = configData[0]?.alert_users || [];
                        const today = new Date().toISOString().split('T')[0];
                        
                        // Insert tasks for each alert user
                        for (const targetUserId of alertUsers) {
                            // Check for existing pending task today
                            const existingRes = await fetch(`${supabaseUrl}/rest/v1/tasks?user_id=eq.${targetUserId}&date=eq.${today}&title=eq.${encodeURIComponent("Check besoin de matériel")}&done=eq.false&select=id`, {
                                headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
                            });
                            const existingData = await existingRes.json();
                            if (existingData.length > 0) continue; // Skip if there's already a pending one

                            await fetch(`${supabaseUrl}/rest/v1/tasks`, {
                                method: "POST",
                                headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    user_id: targetUserId,
                                    title: "Check besoin de matériel",
                                    date: today,
                                    start_time: "00:00:00",
                                    end_time: "00:00:00",
                                    done: "false"
                                })
                            });
                        }
                    }
                } catch (e) {
                    console.error("Alert Planning Error:", e);
                }

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 404
            return new Response("Not Found", { status: 404, headers: corsHeaders });

        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
        }
    },

    // Déclencheur CRON planifié pour ping Supabase et garder le projet actif (évite la pause après 1 semaine d'inactivité)
    async scheduled(event, env, ctx) {
        const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
        const serviceKey = env.SUPABASE_SERVICE_KEY;

        if (serviceKey) {
            try {
                // Requête simple pour maintenir l'activité de la base de données
                const res = await fetch(`${supabaseUrl}/rest/v1/profiles?limit=1`, {
                    headers: {
                        "apikey": serviceKey,
                        "Authorization": `Bearer ${serviceKey}`
                    }
                });

                if (res.ok) {
                    console.log("Ping Supabase keep-alive réussi.");
                } else {
                    console.error("Ping Supabase keep-alive échoué:", res.status, await res.text());
                }

                // 2. Weekly Archive Cleanup (Runs every time, but only Monday carries work)
                // Assuming CRON is set for Monday morning.
                const day = new Date().getDay();
                if (day === 1) { // Monday
                    console.log("Démarrage de l'archivage hebdomadaire automatique...");
                    const resArchive = await performArchiving(env);
                    console.log(`Archivage auto terminé : ${resArchive.count} tâches traitées.`);
                }

            } catch (err) {
                console.error("Erreur dans le handler scheduled:", err);
            }
        } else {
            console.error("Aucune clé SUPABASE_SERVICE_KEY trouvée.");
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
        const archiveKey = `archives/planning/Planning de l'année ${year} CSV Format.csv`;
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
