import config from './config.js';
import { auth } from './auth.js';

const getAuthHeaders = async () => {
    const session = await auth.getSession();
    const token = session ? session.access_token : '';
    return {
        'Authorization': `Bearer ${token}`
    };
};

// Helper function to block visitors from modifying data
const checkVisitor = async () => {
    const role = await auth.getUserRole();
    if (role === 'visiteur') {
        throw new Error("Désolé, mais vous ne pouvez pas modifier d'informations avec votre niveau d'accès. Votre compte est dédié à la visualisation de l'interface admin de PouchainApp. Bon visionnage !");
    }
};

export const api = {
    // Add shared helper
    getAuthHeaders,

    // List all files (moved below)


    // Upload a file (Admin only)
    async uploadFile(file, pathPrefix = '', onProgress) {
        await checkVisitor();
        const authHeaders = await getAuthHeaders();
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            // If pathPrefix already ends with a filename (or is the full key), don't append file.name again
            const finalKey = pathPrefix.endsWith(file.name) ? pathPrefix : (pathPrefix + file.name);
            formData.append('key', finalKey);

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
        await checkVisitor();
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
        await checkVisitor();
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
        await checkVisitor();
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
    async listFiles(userId = null, includeHidden = false) {
        let url = `${config.api.workerUrl}/list?includeHidden=${includeHidden}`;
        if (userId) {
            url += `&userId=${encodeURIComponent(userId)}`;
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
        await checkVisitor();
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
    async listUsers(includeVisitors = false) {
        const response = await fetch(`${config.api.workerUrl}/admin/users`, {
            headers: { ...(await getAuthHeaders()) }
        });
        if (!response.ok) throw new Error(await response.text());
        const users = await response.json();
        // Filtrer les visiteurs pour qu'ils n'apparaissent pas dans le planning ou les listes, 
        // sauf si explicitement demandé (ex: gestion des utilisateurs)
        if (includeVisitors) return users;
        return users.filter(u => u.role !== 'visiteur');
    },

    async createUser(email, password, role, firstName, lastName) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ email, password, role, firstName, lastName })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async inviteUser(email, role, redirectTo, firstName, lastName) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/users/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ email, role, redirectTo, firstName, lastName })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async sendPasswordReset(email, redirectTo) {
        await checkVisitor();
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

    async changeUserPassword(id, password) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/users/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, password })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteUser(id) {
        await checkVisitor();
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
    },

    async changeUserRole(id, role) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/users/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, role })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateUserProfile(id, firstName, lastName) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/users/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, firstName, lastName })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateUserColor(id, color) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/users/color`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, color })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getAccessSummary() {
        const response = await fetch(`${config.api.workerUrl}/admin/access/summary`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- Planning Management ---
    async getTasks(params = {}) {
        let url = `${config.api.workerUrl}/tasks`;
        const queryParams = [];
        if (typeof params === 'string') {
            queryParams.push(`date=${encodeURIComponent(params)}`);
        } else {
            if (params.date) queryParams.push(`date=${encodeURIComponent(params.date)}`);
            if (params.startDate) queryParams.push(`startDate=${encodeURIComponent(params.startDate)}`);
            if (params.endDate) queryParams.push(`endDate=${encodeURIComponent(params.endDate)}`);
        }
        if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

        const response = await fetch(url, { headers: await getAuthHeaders() });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateTask(id, data) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/tasks`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, ...data })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateTaskAdmin(id, done) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/tasks`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, done })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getAdminTasks(startDate = null, endDate = null) {
        let url = `${config.api.workerUrl}/admin/tasks`;
        if (startDate && endDate) {
            url += `?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
        } else if (startDate) {
            url += `?date=${encodeURIComponent(startDate)}`;
        }
        const response = await fetch(url, { headers: await getAuthHeaders() });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveAdminTask(taskData) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteAdminTask(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/tasks`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async archiveOldTasks() {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/tasks/archive`, {
            method: 'POST',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getPlanningClosedDays() {
        const response = await fetch(`${config.api.workerUrl}/planning/closed-days`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async setPlanningClosedDays(days) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/planning/closed-days`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(days)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getSpaceUsage() {
        const response = await fetch(`${config.api.workerUrl}/admin/space`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- Material Request Management ---
    async getMaterialRequests(userId = null) {
        const role = await auth.getUserRole();
        // If userId is provided, we force the user-specific route (only see your own)
        // Otherwise, if admin/visiteur, see all.
        const isAdminOrVisitor = role === 'admin' || role === 'visiteur';
        const url = `${config.api.workerUrl}${(isAdminOrVisitor && !userId) ? '/admin/material/requests' : '/material/requests'}`;
        const response = await fetch(url, { headers: await getAuthHeaders() });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async createMaterialRequest(data) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/material/requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateMaterialRequestStatus(id, status, adminName = null) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/requests`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, status, adminName })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMaterialCategories() {
        const response = await fetch(`${config.api.workerUrl}/material/categories`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async addMaterialCategory(name) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteMaterialCategory(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/categories`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMaterialConfig() {
        const response = await fetch(`${config.api.workerUrl}/admin/material/config`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveMaterialConfig(alertUsers) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ alert_users: alertUsers })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteArchivedMaterialRequest(id, key) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/requests/archived`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, key })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteMaterialRequest(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/requests`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async archiveMaterialRequests() {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/requests/archive`, {
            method: 'POST',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getArchivedMaterialRequests() {
        const response = await fetch(`${config.api.workerUrl}/admin/material/requests/archived`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- Vehicle Management ---
    async getVehicles() {
        const response = await fetch(`${config.api.workerUrl}/admin/vehicles`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveVehicle(vehicleData) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/vehicles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(vehicleData)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteVehicle(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/vehicles`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async uploadVehiclePhoto(vehicleId, file) {
        await checkVisitor();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('vehicleId', vehicleId);

        const response = await fetch(`${config.api.workerUrl}/admin/vehicles/photo`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: formData
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getVehicleAllLogs(vehicleId = null) {
        let url = `${config.api.workerUrl}/admin/vehicle/all-logs`;
        if (vehicleId) url += `?vehicle_id=${vehicleId}`;
        const response = await fetch(url, { headers: await getAuthHeaders() });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMyVehicle() {
        const response = await fetch(`${config.api.workerUrl}/my-vehicle`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async submitVehicleLog(logData) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/vehicle/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(logData)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteVehicleLog(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/vehicle/log`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getDkvCards() {
        const response = await fetch(`${config.api.workerUrl}/admin/dkv-cards`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveDkvCard(data) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/dkv-cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteDkvCard(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/dkv-cards`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getTollCards() {
        const response = await fetch(`${config.api.workerUrl}/admin/toll-cards`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveTollCard(data) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/toll-cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteTollCard(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/toll-cards`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- MACHINES & SCHEMATICS ---
    async getBuildings() {
        const response = await fetch(`${config.api.workerUrl}/admin/buildings`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveBuilding(buildingData) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/buildings`, {
            method: 'POST',
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(buildingData)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteBuilding(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/buildings?id=${id}`, {
            method: 'DELETE',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMachines() {
        console.log("API: Fetching machines...");
        const response = await fetch(`${config.api.workerUrl}/admin/machines`, {
            headers: await getAuthHeaders()
        });
        console.log("API: getMachines status:", response.status);
        if (!response.ok) {
            const err = await response.text();
            console.error("API: getMachines error:", err);
            throw new Error(err);
        }
        const text = await response.text();
        console.log("API: getMachines body text length:", text.length);
        return text ? JSON.parse(text) : [];
    },

    async saveMachine(machineData) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/machines`, {
            method: 'POST',
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(machineData)
        });
        if (!response.ok) throw new Error(await response.text());
        const text = await response.text();
        return text ? JSON.parse(text) : { success: true };
    },

    async deleteMachine(id) {
        await checkVisitor();
        console.log("API: Deleting machine:", id);
        const response = await fetch(`${config.api.workerUrl}/admin/machines?id=${id}`, {
            method: 'DELETE',
            headers: await getAuthHeaders()
        });
        console.log("API: deleteMachine status:", response.status);
        if (!response.ok) {
            const err = await response.text();
            console.error("API: deleteMachine error:", err);
            throw new Error(err);
        }
        const text = await response.text();
        console.log("API: deleteMachine body text length:", text.length, "content:", text);
        return text ? JSON.parse(text) : { success: true };
    },

    async getMachineLogs(machineDbId = null) {
        let url = `${config.api.workerUrl}/admin/machines/logs`;
        if (machineDbId) url += `?machine_db_id=${machineDbId}`;

        const response = await fetch(url, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async addMachineLog(machineDbId, actionType, description) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/machines/logs`, {
            method: 'POST',
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ machine_db_id: machineDbId, action_type: actionType, description })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- Push Notifications ---
    async sendNotification(userId, message, userIds = null) {
        await checkVisitor();
        const payload = userIds ? { userIds, message } : { userId, message };
        const response = await fetch(`${config.api.workerUrl}/admin/notifications/send`, {
            method: 'POST',
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async subscribePush(subscription) {
        const response = await fetch(`${config.api.workerUrl}/notifications/subscribe`, {
            method: 'POST',
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subscription })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMachineMaintenanceHistory(machineId = null) {
        let url = `${config.api.workerUrl}/admin/machines/maintenance`;
        if (machineId) url += `?machine_id=${machineId}`;
        const response = await fetch(url, { headers: await getAuthHeaders() });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveMachineMaintenance(machineId, details, nextMaintenanceDate, vgpStatus = null, vgpObservations = null, lastControlType = 'Maintenance') {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/machines/maintenance`, {
            method: 'POST',
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                machine_id: machineId,
                details,
                next_maintenance_date: nextMaintenanceDate,
                vgp_status: vgpStatus,
                vgp_observations: vgpObservations,
                last_control_type: lastControlType
            })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMachineFamilies() {
        const response = await fetch(`${config.api.workerUrl}/admin/machine-families`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async addMachineFamily(name) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/machine-families`, {
            method: 'POST',
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteMachineFamily(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/machine-families?id=${id}`, {
            method: 'DELETE',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async uploadMachinePhoto(machineId, file) {
        await checkVisitor();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('machineId', machineId);

        const response = await fetch(`${config.api.workerUrl}/admin/machines/photo`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: formData
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateMyVehicle(payload) {
        await checkVisitor();
        const session = await auth.getSession();
        const response = await fetch(`${config.api.workerUrl}/my-vehicle`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- Notifications Admin ---
    async getNotificationSubscribers() {
        const response = await fetch(`${config.api.workerUrl}/admin/notifications/subscribers`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveNotificationConfig(configData) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/notifications/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(configData)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getNotificationConfig() {
        const response = await fetch(`${config.api.workerUrl}/admin/notifications/config`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getNotificationSchedules() {
        const response = await fetch(`${config.api.workerUrl}/admin/notifications/schedules`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async saveNotificationSchedule(scheduleData) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/notifications/schedules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(scheduleData)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteNotificationSchedule(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/notifications/schedules?id=${id}`, {
            method: 'DELETE',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async sendMaterialReminders() {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/requests/remind`, {
            method: 'POST',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    // --- Material Stock Management ---
    async getMaterialStock() {
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateMaterialStock(id, updates) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id, ...updates })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteMaterialStock(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async createMaterialStock(item) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify(item)
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMaterialHistory(materialId) {
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/logs?material_id=${materialId}`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async addMaterialLog(materialId, action, details) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ material_id: materialId, action, details })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async getMaterialStockRequests() {
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/requests`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async submitMaterialStockRequest(materialId, newStock, newLocation) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ material_id: materialId, new_stock_reel: newStock, new_lieu_de_stockage: newLocation })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async updateMaterialStockRequestStatus(requestId, status) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/requests`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeaders())
            },
            body: JSON.stringify({ id: requestId, status })
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async generateMaterialRefs() {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/generate-refs`, {
            method: 'POST',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async lookupMaterialByRef(ref) {
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/lookup?ref=${encodeURIComponent(ref)}`, {
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteFile(key) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/photo?key=${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    },

    async deleteMaterialLog(id) {
        await checkVisitor();
        const response = await fetch(`${config.api.workerUrl}/admin/material/stock/logs?id=${id}`, {
            method: 'DELETE',
            headers: await getAuthHeaders()
        });
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    }
};
