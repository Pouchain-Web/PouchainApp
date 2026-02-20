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
            "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
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
            if (url.pathname.includes('/admin/')) {
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
                let objects = listing.objects;

                // 2. Apply Access Control if userId provided (or strictly enforce if we want)
                // If no userId, and we have restrictions, we should probably hide restricted files (Public View)

                const supabaseUrl = env.SUPABASE_URL || "https://kezjltaafvqnoktfrqym.supabase.co";
                const serviceKey = env.SUPABASE_SERVICE_KEY;

                if (serviceKey) {
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
                                // allowedPaths are paths this user is explicitly granted
                                const userAllowed = new Set(
                                    userId ? rules.filter(r => r.user_id === userId).map(r => r.path) : []
                                );

                                objects = objects.filter(obj => {
                                    const parts = obj.key.split('/');
                                    let currentPath = "";
                                    for (let i = 0; i < parts.length; i++) {
                                        if (i > 0) currentPath += "/";
                                        currentPath += parts[i];

                                        // Check strict path (file or folder w/o slash if stored that way)
                                        if (restrictedPaths.has(currentPath) && !userAllowed.has(currentPath)) return false;

                                        // Check folder path (with slash)
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
                        // If DB fails, default to showing content? Or hiding?
                        // For now logging and proceeding (fail open or closed? Safe is closed, but maybe confusing)
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
                        last_name: profile ? profile.last_name : null
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

            // 2d. Update User Role (PUT /admin/users/role)
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

            // 404
            return new Response("Not Found", { status: 404, headers: corsHeaders });

        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
        }
    }
};

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
