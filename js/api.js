import config from './config.js';
import { auth } from './auth.js';

const getAuthHeaders = async () => {
    const session = await auth.getSession();
    const token = session ? session.access_token : '';
    return {
        'Authorization': `Bearer ${token}`
    };
};

export const api = {
    // List all files (moved below)


    // Upload a file (Admin only)
    async uploadFile(file, pathPrefix = '', onProgress) {
        const authHeaders = await getAuthHeaders();
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('key', pathPrefix + file.name);

            const xhr = new XMLHttpRequest();
            xhr.open('PUT', `${config.api.workerUrl}/upload`);
            xhr.setRequestHeader('Authorization', authHeaders.Authorization);

            // Track progress
            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        onProgress(percent);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        resolve({ message: "Upload success (non-JSON response)" });
                    }
                } else {
                    reject(new Error(`Upload Error (${xhr.status}): ${xhr.responseText}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network Error'));
            xhr.send(formData);
        });
    },

    // Delete a file
    async deleteFile(key) {
        const response = await fetch(`${config.api.workerUrl}/delete`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ key })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Delete Error (${response.status}): ${errText}`);
        }
        return await response.json();
    },

    // Rename a file
    async renameFile(oldKey, newKey) {
        const response = await fetch(`${config.api.workerUrl}/admin/files/rename`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ oldKey, newKey })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Rename Error (${response.status}): ${errText}`);
        }
        return await response.json();
    },

    // Rename a folder (and its content)
    async renameFolder(oldPrefix, newPrefix) {
        const response = await fetch(`${config.api.workerUrl}/admin/folders/rename`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ oldPrefix, newPrefix })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Rename Folder Error (${response.status}): ${errText}`);
        }
        return await response.json();
    },

    // List all files
    async listFiles(userId = null) {
        let url = `${config.api.workerUrl}/list`;
        if (userId) {
            url += `?userId=${encodeURIComponent(userId)}`;
        }

        const response = await fetch(url, {
            headers: { ...(await getAuthHeaders()) }
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getFileAccess(path) {
        const url = `${config.api.workerUrl}/admin/access/get?path=${encodeURIComponent(path)}`;
        const response = await fetch(url, {
            headers: { ...(await getAuthHeaders()) }
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json(); // Returns array of user_ids
    },

    async setFileAccess(path, userIds) {
        const response = await fetch(`${config.api.workerUrl}/admin/access/set`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ path, userIds })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- User Management (Admin) ---
    async listUsers() {
        const response = await fetch(`${config.api.workerUrl}/admin/users`, {
            headers: { ...(await getAuthHeaders()) }
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async createUser(email, password, role) {
        const response = await fetch(`${config.api.workerUrl}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ email, password, role })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async inviteUser(email, role, redirectTo) {
        const response = await fetch(`${config.api.workerUrl}/admin/users/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ email, role, redirectTo })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async sendPasswordReset(email, redirectTo) {
        const response = await fetch(`${config.api.workerUrl}/admin/users/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ email, redirectTo })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteUser(id) {
        const response = await fetch(`${config.api.workerUrl}/admin/users`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    }
};
