import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminPointage = async function (targetWeek, targetYear) {
    setActiveNav('nav-pointage');
    const container = document.getElementById('admin-content');

    const now = new Date();
    const currentWeek = window.getISOWeekNumber(now);
    const currentYear = now.getFullYear();

    const week = parseInt(targetWeek) || currentWeek;
    const year = parseInt(targetYear) || currentYear;

    // ISO week date range calculation
    const getWeekDateRange = (w, y) => {
        const jan4 = new Date(y, 0, 4);
        const day = jan4.getDay();
        const diffToMonday = jan4.getDate() - day + (day === 0 ? -6 : 1);
        const mondayOfWeek1 = new Date(y, 0, diffToMonday);
        const startOfWeek = new Date(mondayOfWeek1);
        startOfWeek.setDate(mondayOfWeek1.getDate() + (w - 1) * 7);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const startStr = startOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const endStr = endOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        return `du ${startStr} au ${endStr}`;
    };

    window.navigatePointageWeek = (currentW, currentY, offset) => {
        let nextW = currentW + offset;
        let nextY = currentY;
        if (nextW < 1) {
            nextW = 52;
            nextY -= 1;
        } else if (nextW > 52) {
            nextW = 1;
            nextY += 1;
        }
        window.renderAdminPointage(nextW, nextY);
    };

    container.innerHTML = `
        <div style="padding: 30px; background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(40px); border-radius: 40px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 12px 40px rgba(0,0,0,0.4);">
            <div class="glass-header" style="display: flex; align-items: center; justify-content: space-between; padding: 25px; background: #121212; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 30px; box-shadow: 0 8px 20px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: linear-gradient(135deg, #FF3B30 0%, #FF9500 100%); width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 8px 16px rgba(255, 59, 48, 0.3);">📝</div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #fff;">Pointage Intelligent</h1>
                        </div>
                        <p style="margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.5);">Suivi hebdomadaire et relances collaborateurs</p>
                    </div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-primary" onclick="exportPointageToExcel(${week}, ${year})" style="display: flex; align-items: center; gap: 8px; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 12px 24px; border-radius: 14px; font-weight: 700; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#2C2C2E'" onmouseout="this.style.background='#1C1C1E'">
                        📊 Exporter Semaine ${week}
                    </button>
                </div>
            </div>

        <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 25px;">
            <div>
                <div class="glass-card" style="background: #121212; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <div style="padding: 22px 30px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="color: #34C759; font-size: 18px;">●</span>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; color: rgba(255,255,255,0.7);">Tableau de bord - Semaine ${week}</span>
                                <span style="font-size: 11px; color: #8E8E93; font-weight: 500; margin-top: 2px;">${getWeekDateRange(week, year)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <!-- Week browsing arrows -->
                            <div style="display: flex; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; height: 38px;">
                                <button onclick="window.navigatePointageWeek(${week}, ${year}, -1)" title="Semaine précédente" style="background: none; border: none; color: white; width: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">◀</button>
                                <div style="width: 1px; background: rgba(255,255,255,0.1); height: 100%;"></div>
                                <button onclick="window.navigatePointageWeek(${week}, ${year}, 1)" title="Semaine suivante" style="background: none; border: none; color: white; width: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">▶</button>
                            </div>
                            <select class="form-input" style="width: auto; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.1); color: white; height: 38px; border-radius: 10px; padding: 0 12px;" id="pointage-week-select" onchange="renderAdminPointage(this.value, document.getElementById('pointage-year-select').value)">
                                ${Array.from({ length: 52 }, (_, i) => i + 1).map(w => `<option value="${w}" style="background-color: #1c1c1e; color: white;" ${w === week ? 'selected' : ''}>S${w}</option>`).join('')}
                            </select>
                            <select class="form-input" style="width: auto; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.1); color: white; height: 38px; border-radius: 10px; padding: 0 12px;" id="pointage-year-select" onchange="renderAdminPointage(document.getElementById('pointage-week-select').value, this.value)">
                                ${[year - 1, year, year + 1].map(y => `<option value="${y}" style="background-color: #1c1c1e; color: white;" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <th style="padding: 18px 30px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px;">Collaborateur</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Lun</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Mar</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Mer</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Jeu</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Ven</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Sam</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Dim</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Total</th>
                                    <th style="padding: 18px 30px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Statut</th>
                                    <th style="padding: 18px 30px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Accès</th>
                                </tr>
                            </thead>
                            <tbody id="pointage-table-body">
                                <tr><td colspan="11" style="text-align:center; padding: 60px; color: rgba(255,255,255,0.3);">Chargement des données...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div id="pointage-sidebar">
                 <!-- Stats and tools -->
                 <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="glass-card" style="background: #121212; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 800;">Récapitulatif</h3>
                        <div id="pointage-stats-content">
                            <div class="loader" style="margin: auto;"></div>
                        </div>
                    </div>
                    
                    <div class="glass-card" style="background: #121212; border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 28px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 800; color: #34C759;">Notifications</h3>
                        <p style="margin: 0 0 15px 0; font-size: 12px; color: rgba(255,255,255,0.5);">Envoyez un rappel automatique aux collaborateurs qui n'ont pas encore validé leur semaine.</p>
                        <button id="btn-notify-missing" class="btn-primary" style="width: 100%; background: #34C759; border: none; box-shadow: 0 6px 15px rgba(52, 199, 89, 0.3); height: 45px; border-radius: 14px; font-weight: 800; color: white; cursor: pointer;" onclick="notifyMissingPointages()">🔔 Rappel pointage</button>
                    </div>
                 </div>
            </div>
        </div>

        <div class="glass-card" style="margin-top: 30px; background: #121212; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                <span>🛠️ Gestion des Activités de Pointage</span>
            </h3>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255,255,255,0.5);">Ajoutez, renommez ou supprimez les activités sur lesquelles les utilisateurs peuvent pointer.</p>
            <div style="display:flex; gap: 12px; margin-bottom: 20px; max-width: 500px;">
                <input type="text" id="new-activity-name" class="form-input" placeholder="Ajouter une nouvelle activité (ex: Chantier XYZ)..." style="flex:1; height: 44px; font-size:14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; padding: 0 14px;">
                <button onclick="window.adminAddActivity()" class="btn-primary" style="height:44px; padding: 0 25px; font-size:14px; border-radius: 12px; font-weight: 700;">Ajouter l'activité</button>
            </div>
            <div id="activities-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
                <!-- populated dynamically -->
            </div>
        </div>

        <div class="glass-card" style="margin-top: 30px; background: #121212; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                <span>📩 Demandes de Modification de Pointage</span>
            </h3>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255,255,255,0.5);">Acceptez ou refusez les demandes de modification pour redonner l'accès au pointage de la semaine publiée.</p>
            <div id="modification-requests-container" style="overflow-x: auto;">
                <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.3);">Chargement des demandes...</div>
            </div>
        </div>
    </div>
    `;

    // Global helper methods for activities management
    window.renderAdminActivitiesList = function () {
        const container = document.getElementById('activities-list-container');
        if (!container) return;
        container.innerHTML = '';
        (window.presetActivitiesFull || []).forEach(act => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);";
            row.innerHTML = `
                <span id="act-label-${act.id}" style="font-size:13px; color:#fff; font-weight:600;">${window.escapeHTML(act.name)}</span>
                <div style="display:flex; gap: 8px;">
                    <button onclick="window.adminRenameActivity(${act.id}, '${window.escapeHTML(act.name).replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Renommer">✏️</button>
                    <button onclick="window.adminDeleteActivity(${act.id})" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Supprimer">🗑️</button>
                </div>
            `;
            container.appendChild(row);
        });
    };

    window.adminAddActivity = async function () {
        const input = document.getElementById('new-activity-name');
        const name = input.value.trim();
        if (!name) return alert("Veuillez saisir un nom d'activité.");
        try {
            await api.savePointageActivity({ name });
            input.value = '';
            // Reset cache & re-render
            window.presetActivities = [];
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de l'ajout: " + e.message);
        }
    };

    window.adminRenameActivity = async function (id, oldName) {
        const newName = prompt("Saisissez le nouveau nom de l'activité:", oldName);
        if (!newName || newName.trim() === oldName) return;
        try {
            await api.savePointageActivity({ id, name: newName.trim() });
            window.presetActivities = [];
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de la modification: " + e.message);
        }
    };

    window.adminDeleteActivity = async function (id) {
        if (!confirm("Voulez-vous vraiment supprimer cette activité ?")) return;
        try {
            await api.deletePointageActivity(id);
            window.presetActivities = [];
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de la suppression: " + e.message);
        }
    };

    // Render list immediately
    window.renderAdminActivitiesList();

    window.renderAdminModificationRequests = async function () {
        const reqContainer = document.getElementById('modification-requests-container');
        if (!reqContainer) return;
        try {
            const allRequests = await api.getPendingPointageModificationRequests();
            const pointageAdminSecteur = window.currentUserProfile?.secteur || 'Tout';
            const requests = pointageAdminSecteur === 'Tout'
                ? allRequests
                : allRequests.filter(r => r.profiles && r.profiles.secteur === pointageAdminSecteur);
            if (!Array.isArray(requests) || requests.length === 0) {
                reqContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.3); font-size: 13px;">Aucune demande de modification en attente.</div>`;
                return;
            }

            let html = `
                <table class="admin-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <th style="padding: 12px 15px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Collaborateur</th>
                            <th style="padding: 12px 15px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Semaine / Année</th>
                            <th style="padding: 12px 15px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Motif</th>
                            <th style="padding: 12px 15px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            requests.forEach(r => {
                const name = r.profiles ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}` : 'Utilisateur';
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 12px 15px; font-weight: 700; color: #fff;">${window.escapeHTML(name)}</td>
                        <td style="padding: 12px 15px; text-align: center; color: #E5E5EA;">Semaine ${r.week_number} (${r.year})</td>
                        <td style="padding: 12px 15px; color: #8E8E93; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.escapeHTML(r.comment)}">${window.escapeHTML(r.comment || 'Aucun motif')}</td>
                        <td style="padding: 12px 15px; text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button onclick="window.decideModificationRequest('${r.id}', true)" style="background:#34C759; border:none; color:white; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor:pointer; box-shadow: 0 2px 6px rgba(52,199,89,0.2);">Accepter</button>
                                <button onclick="window.decideModificationRequest('${r.id}', false)" style="background:#FF3B30; border:none; color:white; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor:pointer; box-shadow: 0 2px 6px rgba(255,59,48,0.2);">Refuser</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
            reqContainer.innerHTML = html;
        } catch (e) {
            reqContainer.innerHTML = `<div style="color: #FF3B30; text-align: center; padding: 20px; font-size:13px;">Erreur de chargement: ${e.message}</div>`;
        }
    };

    window.decideModificationRequest = async function (requestId, approved) {
        try {
            await api.decidePointageModificationRequest(requestId, approved);
            window.showToast(approved ? "✅ Demande de modification acceptée." : "❌ Demande de modification refusée.");
            await window.renderAdminModificationRequests();
            await window.updatePointageBadge();
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de la décision: " + e.message);
        }
    };

    window.renderAdminModificationRequests();

    try {
        const supabaseClient = window.supabase.createClient(config.supabase.url, config.supabase.anonKey);
        const [allUsers, pointages, activities, modRequestsRes] = await Promise.all([
            api.listUsers(),
            api.getAllPointages(week, year),
            api.getPointageActivities(),
            supabaseClient
                .from('pointage_modification_requests')
                .select('*')
                .eq('week_number', week)
                .eq('year', year)
        ]);
        const modRequests = modRequestsRes.data || [];
        const pointageAdminSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = pointageAdminSecteur === 'Tout'
            ? allUsers
            : allUsers.filter(u => u.secteur === pointageAdminSecteur);

        window.adminPointagesCache = pointages;
        window.presetActivitiesFull = activities;
        window.presetActivities = activities.map(a => a.name);

        // Render activities list now that we have loaded the dynamic list
        window.renderAdminActivitiesList();

        const tableBody = document.getElementById('pointage-table-body');
        tableBody.innerHTML = '';

        const missingUsers = [];

        users.forEach(user => {
            const userPointages = pointages.filter(p => p.user_id === user.id);
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const dayValues = days.map(dayName => {
                const p = userPointages.find(up => {
                    const d = new Date(up.date);
                    const options = { weekday: 'long', timeZone: 'UTC' };
                    return d.toLocaleDateString('en-US', options) === dayName;
                });
                if (!p) return 0;
                return (p.activities || []).reduce((acc, act) => acc + parseFloat(act.hours || 0), 0);
            });

            const total = dayValues.reduce((acc, v) => acc + v, 0);
            const isFullyComplete = dayValues.slice(0, 5).every(v => v >= 7);

            if (!isFullyComplete) missingUsers.push(user);

            // Compute lock status (excluding leaves, matching mobile logic)
            const isPublished = userPointages.some(p => {
                if (p.status !== 'published') return false;
                if (!p.activities || !Array.isArray(p.activities)) return false;
                return p.activities.some(act => {
                    const name = act.activity_name;
                    if (!name) return false;
                    const lowerName = name.toLowerCase();
                    const isLeave = lowerName.startsWith('cp\\') ||
                                    lowerName.startsWith('rtt\\') ||
                                    lowerName.startsWith('formation\\') ||
                                    lowerName.startsWith('cpe\\') ||
                                    lowerName.startsWith('cpef\\') ||
                                    lowerName.startsWith('cs\\') ||
                                    lowerName.startsWith('repos\\');
                    return !isLeave;
                });
            });
            const userRequests = modRequests.filter(r => r.user_id === user.id);
            userRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const latestReq = userRequests[0];
            const hasApprovedReq = latestReq && latestReq.status === 'approved';
            const isLocked = isPublished && !hasApprovedReq;

            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            row.style.cursor = 'pointer';
            row.className = 'admin-pointage-row';
            row.onclick = () => window.openAdminPointageEditModal(user, week, year);
            row.innerHTML = `
                <td style="padding: 15px 25px;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700; color: #fff;">${window.escapeHTML(user.first_name || '')} ${window.escapeHTML(user.last_name || '')}</span>
                        <span style="font-size: 11px; color: rgba(255,255,255,0.4);">${window.escapeHTML(user.societe || 'Pouchain')}</span>
                    </div>
                </td>
                ${dayValues.map((v, i) => {
                let color = 'rgba(255,255,255,0.2)';
                let bg = 'transparent';
                if (i < 5) {
                    if (v >= 7) { color = '#34C759'; bg = 'rgba(52, 199, 89, 0.05)'; }
                    else if (v > 0) { color = '#FF9500'; bg = 'rgba(255, 149, 0, 0.05)'; }
                    else { color = '#FF3B30'; bg = 'rgba(255, 59, 48, 0.03)'; }
                } else if (v > 0) { color = '#5856D6'; bg = 'rgba(88, 86, 214, 0.05)'; }

                return `<td style="padding: 15px; text-align: center; background: ${bg};">
                                <span style="font-weight: 800; color: ${color}; font-size: 13px;">${v > 0 ? v + 'h' : '-'}</span>
                            </td>`;
            }).join('')}
                <td style="padding: 15px; text-align: center; font-weight: 800; color: #fff; background: rgba(255,255,255,0.02);">${total}h</td>
                <td style="padding: 15px 25px; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; background: ${isFullyComplete ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)'}; color: ${isFullyComplete ? '#34C759' : '#FF3B30'}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid ${isFullyComplete ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)'};">
                        <span style="font-size: 12px;">●</span>
                        ${isFullyComplete ? 'OK' : 'Relancer'}
                    </div>
                </td>
                <td style="padding: 15px 25px; text-align: center;" onclick="event.stopPropagation();">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                        <span onclick="window.toggleUserWeekLock('${user.id}', ${week}, ${year}, ${isLocked}, ${latestReq ? `'${latestReq.id}'` : 'null'})" style="font-size: 18px; cursor: pointer;" title="${isLocked ? 'Semaine verrouillée - Cliquer pour déverrouiller' : 'Semaine déverrouillée - Cliquer pour verrouiller'}">
                            ${isLocked ? '🔒' : '🔓'}
                        </span>
                        <button onclick="window.exportSingleUserPointage('${user.id}', ${week}, ${year})" style="background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)';" onmouseout="this.style.transform='scale(1)';" title="Exporter en PDF">
                            📥
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        const statsContent = document.getElementById('pointage-stats-content');
        statsContent.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Effectif total</span>
                    <span style="font-weight: 800; font-size: 16px;">${users.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Semaines validées</span>
                    <span style="font-weight: 800; font-size: 16px; color: #34C759;">${users.length - missingUsers.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Semaines incomplètes</span>
                    <span style="font-weight: 800; font-size: 16px; color: #FF3B30;">${missingUsers.length}</span>
                </div>
                <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0;"></div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: rgba(255,255,255,0.4);">
                        <span>Progression globale</span>
                        <span>${Math.round(((users.length - missingUsers.length) / users.length) * 100)}%</span>
                    </div>
                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${((users.length - missingUsers.length) / users.length) * 100}%; background: linear-gradient(90deg, #34C759, #32D74B); border-radius: 3px;"></div>
                    </div>
                </div>
            </div>
        `;

        window.lastMissingUsers = missingUsers;

    } catch (e) {
        alert("Erreur lors du chargement des pointages: " + e.message);
    }
};

window.notifyMissingPointages = async function () {
    const users = window.lastMissingUsers;
    if (!users || users.length === 0) return;
    if (!confirm(`Envoyer un rappel aux ${users.length} utilisateurs ?`)) return;
    try {
        await api.notifyMissingPointage(users.map(u => u.id), "Rappel : Vos pointages de la semaine sont incomplets.");
        alert("Notifications envoyées !");
    } catch (e) { alert("Erreur: " + e.message); }
};

window.exportPointageToExcel = async function (week, year) {
    try {
        const [allUsers, pointages] = await Promise.all([api.listUsers(), api.getAllPointages(week, year)]);
        const pointageAdminSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = pointageAdminSecteur === 'Tout'
            ? allUsers
            : allUsers.filter(u => u.secteur === pointageAdminSecteur);
        if (pointages.length === 0) return alert("Aucun pointage pour cette semaine.");

        const activeUsers = users.filter(user => pointages.some(p => p.user_id === user.id));

        if (activeUsers.length === 0) {
            return alert("Aucun pointage n'a été trouvé pour cette semaine.");
        }

        const defaultPath = `Y:\\Archive\\Doc personnel et Sécurité\\Pointages\\2026\\`;
        try {
            await navigator.clipboard.writeText(defaultPath);
        } catch (err) {
            console.warn("Could not copy path to clipboard:", err);
        }

        let dirHandle = null;
        const useDirectoryPicker = typeof window.showDirectoryPicker === 'function';

        if (useDirectoryPicker) {
            const confirmed = confirm(
                `Vous allez exporter ${activeUsers.length} fichier(s) PDF (un par personne).\n\n` +
                `Le chemin par défaut a été copié dans votre presse-papier :\n` +
                `${defaultPath}\n\n` +
                `⚠️ IMPORTANT : Ne sélectionnez pas directement la racine du lecteur (ex: Y:\\) sinon le navigateur refusera par sécurité.\n` +
                `Double-cliquez pour entrer dans les dossiers jusqu'au dossier final '2026', ou collez le chemin complet dans la barre d'adresse de l'explorateur qui va s'ouvrir.`
            );

            if (confirmed) {
                try {
                    dirHandle = await window.showDirectoryPicker();
                } catch (err) {
                    console.warn("Directory picker failed or was cancelled:", err);
                    const fallback = confirm(
                        `Impossible d'accéder au dossier ou action annulée.\n\n` +
                        `Souhaitez-vous télécharger les ${activeUsers.length} fichiers PDF individuellement dans votre dossier 'Téléchargements' par défaut ?`
                    );
                    if (!fallback) return;
                }
            } else {
                return;
            }
        } else {
            const confirmed = confirm(
                `Votre navigateur ne prend pas en charge la sélection directe de dossier.\n` +
                `${activeUsers.length} fichiers PDF vont être téléchargés individuellement dans votre dossier Téléchargements.\n\n` +
                `Continuer ?`
            );
            if (!confirmed) return;
        }

        // Load jspdf-autotable dynamically if not present
        if (!window.jspdf || !window.jspdf.jsPDF.API.autoTable) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.onload = () => {
                    const script2 = document.createElement('script');
                    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
                    script2.onload = resolve;
                    script2.onerror = reject;
                    document.head.appendChild(script2);
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const monday = window.getMondayOfISOWeek(week, year);

        const formatDM = (d) => {
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            return `${dd}/${mm}`;
        };

        const getPeriodString = (m) => {
            const sunday = new Date(m);
            sunday.setUTCDate(m.getUTCDate() + 6);
            const formatDate = (d) => {
                const dd = String(d.getUTCDate()).padStart(2, '0');
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                return `${dd}/${mm}/${yyyy}`;
            };
            return `Du ${formatDate(m)} au ${formatDate(sunday)}`;
        };

        const periodStr = getPeriodString(monday);

        const { jsPDF } = window.jspdf;

        for (const user of activeUsers) {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            const up = pointages.filter(p => p.user_id === user.id);
            const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
            const userSociete = user.societe || 'Pouchain';

            const drawHeaderCell = (text, x, y, w, h, bgColor, textColor) => {
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(x, y, w, h, "F");
                doc.setDrawColor(191, 191, 191);
                doc.rect(x, y, w, h, "S");
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(8.5);
                doc.text(text, x + 3, y + 5);
            };

            const bgBlue = [221, 235, 247];
            const textBlue = [31, 78, 120];

            drawHeaderCell(`SOCIÉTÉ: ${userSociete.toUpperCase()}`, 14, 14, 107.6, 8, bgBlue, textBlue);
            drawHeaderCell(`SEMAINE: ${week}`, 121.6, 14, 80.7, 8, bgBlue, textBlue);
            drawHeaderCell(`ANNÉE: ${year}`, 202.3, 14, 80.7, 8, bgBlue, textBlue);

            drawHeaderCell(`COLLABORATEUR: ${userFullName}`, 14, 22, 107.6, 8, bgBlue, textBlue);
            drawHeaderCell(`PÉRIODE: ${periodStr}`, 121.6, 22, 161.4, 8, bgBlue, textBlue);

            const bodyRows = [];
            const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
            let totalWeekHours = 0;
            let totalWeekNightHours = 0;

            days.forEach((dayName, dayIdx) => {
                const date = new Date(monday);
                date.setUTCDate(monday.getUTCDate() + dayIdx);
                const isoDate = date.toISOString().split('T')[0];

                const p = up.find(pt => pt.date === isoDate) || {
                    date: isoDate,
                    activities: [],
                    night_hours: 0,
                    grand_deplacement: false,
                    vehicule_pouchain: false,
                    repas: "",
                    trajet: ""
                };

                const activities = p.activities || [];
                if ((dayIdx === 5 || dayIdx === 6) && activities.length === 0) {
                    return; // Ignorer samedi / dimanche s'il n'y a pas d'activité
                }

                const numRows = Math.max(3, activities.length);
                const dayTotalHours = activities.reduce((acc, act) => acc + (parseFloat(act.hours) || 0), 0);
                totalWeekHours += dayTotalHours;
                totalWeekNightHours += parseFloat(p.night_hours) || 0;

                const isGreenDay = (dayIdx % 2 === 1);
                const rowBgColor = isGreenDay ? [226, 239, 218] : [255, 255, 255];
                const dayLabel = `${dayName} ${formatDM(date)}`;

                for (let subIdx = 0; subIdx < numRows; subIdx++) {
                    const act = activities[subIdx] || {};
                    const isFirst = (subIdx === 0);
                    const zoneVal = (p.trajet === "Aucune" || p.trajet === "Aucun") ? "" : (p.trajet || "");
                    const transportVal = p.vehicule_pouchain ? "" : zoneVal;

                    const row = [];

                    if (isFirst) {
                        row.push({ content: dayLabel, rowSpan: numRows, styles: { fillColor: rowBgColor, fontStyle: 'bold', valign: 'middle', halign: 'center' } });
                    }

                    row.push({ content: act.activity_name || "", styles: { fillColor: rowBgColor, halign: 'left' } });
                    row.push({ content: act.hours !== undefined && act.hours !== null ? String(act.hours) : "", styles: { fillColor: rowBgColor, halign: 'center' } });

                    if (isFirst) {
                        row.push({ content: String(dayTotalHours || 0), rowSpan: numRows, styles: { fillColor: rowBgColor, fontStyle: 'bold', valign: 'middle', halign: 'center' } });
                        row.push({ content: String(p.night_hours || 0), rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                        row.push({ content: p.grand_deplacement ? "OUI" : "NON", rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                        row.push({ content: p.repas || "", rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                        row.push({ content: transportVal, rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                        row.push({ content: zoneVal, rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                        row.push({ content: "", rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                    }

                    bodyRows.push(row);
                }
            });

            bodyRows.push([
                { content: "TOTAL HEURES SEMAINE", colSpan: 3, styles: { fillColor: [217, 217, 217], fontStyle: 'bold', halign: 'left' } },
                { content: String(totalWeekHours), styles: { fillColor: [217, 217, 217], fontStyle: 'bold', halign: 'center' } },
                { content: String(totalWeekNightHours), styles: { fillColor: [217, 217, 217], fontStyle: 'bold', halign: 'center' } },
                { content: "", colSpan: 5, styles: { fillColor: [217, 217, 217] } }
            ]);

            doc.autoTable({
                startY: 34,
                head: [[
                    { content: "Jour", styles: { halign: 'center' } },
                    { content: "Activité", styles: { halign: 'center' } },
                    { content: "Heures", styles: { halign: 'center' } },
                    { content: "Durée totale", styles: { halign: 'center' } },
                    { content: "Heures de Nuit", styles: { halign: 'center' } },
                    { content: "GD", styles: { halign: 'center' } },
                    { content: "Repas", styles: { halign: 'center' } },
                    { content: "Transport", styles: { halign: 'center' } },
                    { content: "Trajet", styles: { halign: 'center' } },
                    { content: "Prime", styles: { halign: 'center' } }
                ]],
                body: bodyRows,
                theme: 'grid',
                styles: {
                    fontSize: 7.5,
                    cellPadding: 1.8,
                    lineColor: [153, 153, 153],
                    lineWidth: 0.15,
                    textColor: [0, 0, 0]
                },
                headStyles: {
                    fillColor: [55, 86, 35],
                    textColor: [255, 255, 255],
                    fontSize: 8,
                    fontStyle: 'bold',
                    lineWidth: 0.15,
                    lineColor: [153, 153, 153]
                },
                columnStyles: {
                    0: { cellWidth: 32 },
                    1: { cellWidth: 78 },
                    2: { cellWidth: 15 },
                    3: { cellWidth: 22 },
                    4: { cellWidth: 26 },
                    5: { cellWidth: 14 },
                    6: { cellWidth: 28 },
                    7: { cellWidth: 20 },
                    8: { cellWidth: 18 },
                    9: { cellWidth: 16 }
                },
                margin: { left: 14, right: 14 }
            });

            const formattedName = `${user.last_name || ''}_${user.first_name || ''}`.trim() || user.email;
            const safeName = formattedName.replace(/[^a-zA-Z0-9_ -]/g, "");
            const filename = `Recap_Hebdo_S${week}_${year}_${safeName}.pdf`;

            if (dirHandle) {
                const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(doc.output('blob'));
                await writable.close();
            } else {
                doc.save(filename);
            }
        }

        if (dirHandle) {
            window.showToast("🚀 Export PDF par personne terminé avec succès !");
        }
    } catch (e) {
        alert("Erreur lors de l'export PDF: " + e.message);
        console.error(e);
    }
};

window.exportSingleUserPointage = async function (userId, week, year) {
    try {
        const [allUsers, pointages] = await Promise.all([api.listUsers(), api.getAllPointages(week, year)]);
        const user = allUsers.find(u => u.id === userId);
        if (!user) return alert("Utilisateur introuvable.");

        const userPointages = pointages.filter(p => p.user_id === userId);
        if (userPointages.length === 0) return alert("Aucun pointage pour cet utilisateur cette semaine.");

        // Load jspdf-autotable dynamically if not present
        if (!window.jspdf || !window.jspdf.jsPDF.API.autoTable) {
            window.showToast("Chargement du module PDF...");
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.onload = () => {
                    const script2 = document.createElement('script');
                    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
                    script2.onload = resolve;
                    script2.onerror = reject;
                    document.head.appendChild(script2);
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const monday = window.getMondayOfISOWeek(week, year);

        const formatDM = (d) => {
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            return `${dd}/${mm}`;
        };

        const getPeriodString = (m) => {
            const sunday = new Date(m);
            sunday.setUTCDate(m.getUTCDate() + 6);
            const formatDate = (d) => {
                const dd = String(d.getUTCDate()).padStart(2, '0');
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                return `${dd}/${mm}/${yyyy}`;
            };
            return `Du ${formatDate(m)} au ${formatDate(sunday)}`;
        };

        const periodStr = getPeriodString(monday);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
        const userSociete = user.societe || 'Pouchain';

        const drawHeaderCell = (text, x, y, w, h, bgColor, textColor) => {
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.rect(x, y, w, h, "F");
            doc.setDrawColor(191, 191, 191);
            doc.rect(x, y, w, h, "S");
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(8.5);
            doc.text(text, x + 3, y + 5);
        };

        const bgBlue = [221, 235, 247];
        const textBlue = [31, 78, 120];

        drawHeaderCell(`SOCIÉTÉ: ${userSociete.toUpperCase()}`, 14, 14, 107.6, 8, bgBlue, textBlue);
        drawHeaderCell(`SEMAINE: ${week}`, 121.6, 14, 80.7, 8, bgBlue, textBlue);
        drawHeaderCell(`ANNÉE: ${year}`, 202.3, 14, 80.7, 8, bgBlue, textBlue);

        drawHeaderCell(`COLLABORATEUR: ${userFullName}`, 14, 22, 107.6, 8, bgBlue, textBlue);
        drawHeaderCell(`PÉRIODE: ${periodStr}`, 121.6, 22, 161.4, 8, bgBlue, textBlue);

        const bodyRows = [];
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        let totalWeekHours = 0;
        let totalWeekNightHours = 0;

        days.forEach((dayName, dayIdx) => {
            const date = new Date(monday);
            date.setUTCDate(monday.getUTCDate() + dayIdx);
            const isoDate = date.toISOString().split('T')[0];

            const p = userPointages.find(pt => pt.date === isoDate) || {
                date: isoDate,
                activities: [],
                night_hours: 0,
                grand_deplacement: false,
                vehicule_pouchain: false,
                repas: "",
                trajet: ""
            };

            const activities = p.activities || [];
            if ((dayIdx === 5 || dayIdx === 6) && activities.length === 0) {
                return;
            }

            const numRows = Math.max(3, activities.length);
            const dayTotalHours = activities.reduce((acc, act) => acc + (parseFloat(act.hours) || 0), 0);
            totalWeekHours += dayTotalHours;
            totalWeekNightHours += parseFloat(p.night_hours) || 0;

            const isGreenDay = (dayIdx % 2 === 1);
            const rowBgColor = isGreenDay ? [226, 239, 218] : [255, 255, 255];
            const dayLabel = `${dayName} ${formatDM(date)}`;

            for (let subIdx = 0; subIdx < numRows; subIdx++) {
                const act = activities[subIdx] || {};
                const isFirst = (subIdx === 0);
                const zoneVal = (p.trajet === "Aucune" || p.trajet === "Aucun") ? "" : (p.trajet || "");
                const transportVal = p.vehicule_pouchain ? "" : zoneVal;

                const row = [];

                if (isFirst) {
                    row.push({ content: dayLabel, rowSpan: numRows, styles: { fillColor: rowBgColor, fontStyle: 'bold', valign: 'middle', halign: 'center' } });
                }

                row.push({ content: act.activity_name || "", styles: { fillColor: rowBgColor, halign: 'left' } });
                row.push({ content: act.hours !== undefined && act.hours !== null ? String(act.hours) : "", styles: { fillColor: rowBgColor, halign: 'center' } });

                if (isFirst) {
                    row.push({ content: String(dayTotalHours || 0), rowSpan: numRows, styles: { fillColor: rowBgColor, fontStyle: 'bold', valign: 'middle', halign: 'center' } });
                    row.push({ content: String(p.night_hours || 0), rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                    row.push({ content: p.grand_deplacement ? "OUI" : "NON", rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                    row.push({ content: p.repas || "", rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                    row.push({ content: transportVal, rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                    row.push({ content: zoneVal, rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                    row.push({ content: "", rowSpan: numRows, styles: { fillColor: rowBgColor, valign: 'middle', halign: 'center' } });
                }

                bodyRows.push(row);
            }
        });

        bodyRows.push([
            { content: "TOTAL HEURES SEMAINE", colSpan: 3, styles: { fillColor: [217, 217, 217], fontStyle: 'bold', halign: 'left' } },
            { content: String(totalWeekHours), styles: { fillColor: [217, 217, 217], fontStyle: 'bold', halign: 'center' } },
            { content: String(totalWeekNightHours), styles: { fillColor: [217, 217, 217], fontStyle: 'bold', halign: 'center' } },
            { content: "", colSpan: 5, styles: { fillColor: [217, 217, 217] } }
        ]);

        doc.autoTable({
            startY: 34,
            head: [[
                { content: "Jour", styles: { halign: 'center' } },
                { content: "Activité", styles: { halign: 'center' } },
                { content: "Heures", styles: { halign: 'center' } },
                { content: "Durée totale", styles: { halign: 'center' } },
                { content: "Heures de Nuit", styles: { halign: 'center' } },
                { content: "GD", styles: { halign: 'center' } },
                { content: "Repas", styles: { halign: 'center' } },
                { content: "Transport", styles: { halign: 'center' } },
                { content: "Trajet", styles: { halign: 'center' } },
                { content: "Prime", styles: { halign: 'center' } }
            ]],
            body: bodyRows,
            theme: 'grid',
            styles: {
                fontSize: 7.5,
                cellPadding: 1.8,
                lineColor: [153, 153, 153],
                lineWidth: 0.15,
                textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [55, 86, 35],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                lineWidth: 0.15,
                lineColor: [153, 153, 153]
            },
            columnStyles: {
                0: { cellWidth: 32 },
                1: { cellWidth: 78 },
                2: { cellWidth: 15 },
                3: { cellWidth: 22 },
                4: { cellWidth: 26 },
                5: { cellWidth: 14 },
                6: { cellWidth: 28 },
                7: { cellWidth: 20 },
                8: { cellWidth: 18 },
                9: { cellWidth: 16 }
            },
            margin: { left: 14, right: 14 }
        });

        const formattedName = `${user.last_name || ''}_${user.first_name || ''}`.trim() || user.email;
        const safeName = formattedName.replace(/[^a-zA-Z0-9_ -]/g, "");
        const filename = `Recap_Hebdo_S${week}_${year}_${safeName}.pdf`;

        doc.save(filename);
        window.showToast("🚀 PDF généré avec succès !");
    } catch (e) {
        alert("Erreur lors de l'export PDF: " + e.message);
    }
};

window.exportOvertimeToExcel = async function () {
    try {
        const data = await api.getAdminOvertimeAll();
        if (data.length === 0) return alert("Aucune donnée à exporter.");

        const headers = ["Employé", "Email", "Solde Heures Sup (h)"];
        const rows = data.map(u => [
            `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
            u.email,
            u.overtime_balance || 0
        ]);

        let csvContent = "\ufeff" + headers.join(";") + "\n";
        rows.forEach(r => {
            csvContent += r.map(cell => `"${cell}"`).join(";") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `Recap_Heures_Sup_${today}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Erreur lors de l'export: " + e.message);
    }
};

window.getMondayOfISOWeek = function (w, y) {
    const simple = new Date(Date.UTC(y, 0, 4));
    const day = simple.getUTCDay() || 7;
    simple.setUTCDate(simple.getUTCDate() - day + 1);
    simple.setUTCDate(simple.getUTCDate() + (w - 1) * 7);
    return simple;
};

window.generateAdminActivityRowHtml = function (isoDate, idx, act = { activity_name: '', hours: 7 }) {
    return `
        <div class="admin-activity-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
            <input type="text" list="preset-activities-list" class="form-input p-act-name" data-date="${isoDate}" data-idx="${idx}" value="${window.escapeHTML(act.activity_name || '')}" placeholder="Activité (ex: Montage AIA 1...)" style="flex: 1; height: 38px; padding: 0 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; font-size: 14px;">
            <select class="form-input p-act-hours" data-date="${isoDate}" data-idx="${idx}" style="width: 90px; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; padding: 0 8px; font-size: 14px; font-weight: 700;">
                ${window.HOUR_OPTIONS.map(h => `<option value="${h}" style="background-color: #1c1c1e; color: white;" ${parseFloat(act.hours) === h ? 'selected' : ''}>${h}h</option>`).join('')}
            </select>
            <button onclick="this.parentElement.remove()" style="background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); color: #FF3B30; border-radius: 10px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;">✕</button>
        </div>
    `;
};

window.addAdminActivityToDay = function (isoDate) {
    const container = document.getElementById(`admin-activities-${isoDate}`);
    const idx = container.querySelectorAll('.admin-activity-row').length;
    const div = document.createElement('div');
    div.innerHTML = window.generateAdminActivityRowHtml(isoDate, idx, { activity_name: '', hours: 7 });
    container.appendChild(div.firstElementChild);
};

window.openAdminPointageEditModal = function (user, week, year) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000001';
    modal.style.backdropFilter = 'blur(10px)';

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const monday = window.getMondayOfISOWeek(week, year);

    let daysHtml = '';

    days.forEach((dayName, i) => {
        const date = new Date(monday);
        date.setUTCDate(monday.getUTCDate() + i);
        const isoDate = date.toISOString().split('T')[0];
        const dateDisplay = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

        // Find existing pointage in cache
        const p = (window.adminPointagesCache || []).find(pt => pt.user_id === user.id && pt.date === isoDate) || {
            date: isoDate,
            activities: i < 5 ? [{ activity_name: '', hours: 7 }] : [],
            night_hours: 0,
            grand_deplacement: false,
            vehicule_pouchain: false,
            repas: "Aucun",
            trajet: "Aucune"
        };

        const isWeekend = i >= 5;

        daysHtml += `
            <div class="day-card" data-date="${isoDate}" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                    <div>
                        <span style="font-weight: 800; font-size: 16px; color: ${isWeekend ? '#8E8E93' : '#fff'};">${dayName}</span>
                        <span style="font-size: 13px; color: #8E8E93; margin-left: 8px;">${dateDisplay}</span>
                    </div>
                    ${isWeekend ? '<span style="font-size: 10px; font-weight: 800; color: #8E8E93; text-transform: uppercase; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 6px;">Week-end</span>' : ''}
                </div>
 
                <div class="day-activities" id="admin-activities-${isoDate}">
                    ${(p.activities || []).map((act, idx) => window.generateAdminActivityRowHtml(isoDate, idx, act)).join('')}
                </div>
                
                <button onclick="window.addAdminActivityToDay('${isoDate}')" style="background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); width: 100%; padding: 10px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 15px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">+ Ajouter activité</button>
 
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                    <div class="form-group">
                        <label style="font-size: 11px; font-weight: 800; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 6px;">Repas</label>
                        <select class="p-repas-select" data-date="${isoDate}" style="width: 100%; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0 8px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                            ${window.MEAL_OPTIONS.map(opt => `<option value="${opt}" style="background-color: #1c1c1e; color: white;" ${p.repas === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-size: 11px; font-weight: 800; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 6px;">Zone</label>
                        <select class="p-trajet-select" data-date="${isoDate}" style="width: 100%; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0 8px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                            ${window.TRAJET_OPTIONS.map(opt => `<option value="${opt}" style="background-color: #1c1c1e; color: white;" ${p.trajet === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" class="p-gd-check" data-date="${isoDate}" ${p.grand_deplacement ? 'checked' : ''} style="width: 18px; height: 18px; border-radius: 4px; cursor: pointer;" />
                            <label style="font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;">Grand Déplacement (GD)</label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 12px; font-weight: 600; color: #8E8E93;">Nuit:</label>
                            <input type="number" class="p-night-input" data-date="${isoDate}" value="${p.night_hours || 0}" step="0.5" style="width: 60px; height: 32px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0 8px; border-radius: 8px; text-align: center; font-size: 13px; font-weight: 800;" />
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="p-vp-check" data-date="${isoDate}" ${p.vehicule_pouchain ? 'checked' : ''} style="width: 18px; height: 18px; border-radius: 4px; cursor: pointer;" />
                        <label style="font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;">Véhicule Pouchain</label>
                    </div>
                </div>
            </div>
        `;
    });

    const userPointages = (window.adminPointagesCache || []).filter(pt => pt.user_id === user.id);
    const isAlreadyPublished = userPointages.some(pt => pt.status === 'published');
    const actionBtnText = isAlreadyPublished ? "💾 Mettre à jour" : "🚀 Publier la semaine";

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 700px; padding: 40px; border-radius: 32px; background: rgba(28, 28, 30, 0.95); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: modalPop 0.3s ease-out; max-height: 95vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0;">
                <div>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: white;">Modifier les pointages</h2>
                    <p style="margin: 4px 0 0 0; color: #8E8E93; font-size: 14px;">Pour ${fullName} — Semaine ${week} (${year})</p>
                </div>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.05); border: none; color: #fff; width: 40px; height: 40px; border-radius: 20px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
 
            <datalist id="preset-activities-list">
                ${(window.presetActivities || window.PRESET_ACTIVITIES).map(a => `<option value="${a}">`).join('')}
            </datalist>
 
            <div style="flex: 1; overflow-y: auto; padding-right: 10px; margin-bottom: 25px;">
                ${daysHtml}
            </div>
 
            <div style="display: flex; gap: 15px; flex-shrink: 0;">
                <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.05); color: white; border: none; font-weight: 700; cursor: pointer; font-size: 15px;">Annuler</button>
                <button onclick="window.saveAdminPointages('${user.id}', ${week}, ${year}, 'published', this, '${fullName.replace(/'/g, "\\'")}')" style="flex: 2; padding: 16px; border-radius: 16px; background: #007AFF; color: white; border: none; font-weight: 800; cursor: pointer; font-size: 15px; box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);">${actionBtnText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.saveAdminPointages = async function (targetUserId, week, year, status, btn, fullName = '') {
    const modal = btn.closest('.modal-overlay');
    const dayCards = modal.querySelectorAll('.day-card');
    const allData = [];

    for (const card of dayCards) {
        const isoDate = card.getAttribute('data-date');
        const activities = [];

        const rowEls = card.querySelectorAll('.admin-activity-row');
        rowEls.forEach(row => {
            const name = row.querySelector('.p-act-name').value.trim();
            const hours = parseFloat(row.querySelector('.p-act-hours').value) || 0;
            if (name && hours > 0) {
                activities.push({ activity_name: name, hours, project_name: "" });
            }
        });

        // Preserving published status: admin cannot downgrade a published week to draft.
        // This protects the lock mechanism on the mobile side.
        const existingPointage = (window.adminPointagesCache || []).find(
            pt => pt.user_id === targetUserId && pt.date === isoDate
        );

        const effectiveStatus = (existingPointage && existingPointage.status === 'published' && status === 'draft')
            ? 'published'
            : status;

        allData.push({
            user_id: targetUserId,
            date: isoDate,
            week_number: week,
            year,
            activities,
            night_hours: parseFloat(card.querySelector('.p-night-input').value) || 0,
            grand_deplacement: card.querySelector('.p-gd-check').checked,
            vehicule_pouchain: card.querySelector('.p-vp-check').checked,
            repas: card.querySelector('.p-repas-select').value,
            trajet: card.querySelector('.p-trajet-select').value,
            status: effectiveStatus
        });
    }

    const oldText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Enregistrement...";

    try {
        await Promise.all(allData.map(data => api.submitPointage(data)));
        window.showToast(status === 'published' ? "🚀 Semaine enregistrée avec succès !" : "💾 Brouillon enregistré avec succès.");
        modal.remove();
        await window.renderAdminPointage(week, year);

        if (status === 'published') {
            await window.showPointageLockPopup(targetUserId, week, year, fullName);
        }
    } catch (e) {
        alert("Erreur lors de l'enregistrement: " + e.message);
        btn.disabled = false;
        btn.innerText = oldText;
    }
};

window.showPointageLockPopup = async function (targetUserId, week, year, fullName) {
    const supabaseClient = window.supabase.createClient(config.supabase.url, config.supabase.anonKey);

    // 1. Fetch latest request and pointages to check current lock status
    const pointages = await api.getAllPointages(week, year);
    const userPointages = pointages.filter(p => p.user_id === targetUserId);
    const isPublished = userPointages.some(p => {
        if (p.status !== 'published') return false;
        if (!p.activities || !Array.isArray(p.activities)) return false;
        return p.activities.some(act => {
            const name = act.activity_name;
            if (!name) return false;
            const lowerName = name.toLowerCase();
            const isLeave = lowerName.startsWith('cp\\') ||
                            lowerName.startsWith('rtt\\') ||
                            lowerName.startsWith('formation\\') ||
                            lowerName.startsWith('cpe\\') ||
                            lowerName.startsWith('cpef\\') ||
                            lowerName.startsWith('cs\\') ||
                            lowerName.startsWith('repos\\');
            return !isLeave;
        });
    });

    let hasApprovedReq = false;
    let latestReq = null;

    try {
        const { data: reqs } = await supabaseClient
            .from('pointage_modification_requests')
            .select('*')
            .eq('user_id', targetUserId)
            .eq('week_number', week)
            .eq('year', year)
            .order('created_at', { ascending: false })
            .limit(1);
        latestReq = reqs && reqs[0];
        hasApprovedReq = latestReq && latestReq.status === 'approved';
    } catch (err) {
        console.error("Error fetching modification request:", err);
    }

    // Lock status:
    // If not published -> unlocked (non verrouillée)
    // If published but has approved request -> unlocked (non verrouillée)
    // If published and no approved request -> locked (verrouillée)
    const isLocked = isPublished && !hasApprovedReq;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000002';
    modal.style.backdropFilter = 'blur(10px)';

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 450px; padding: 35px; border-radius: 28px; background: rgba(28, 28, 30, 0.95); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 30px 80px rgba(0,0,0,0.5); text-align: center; animation: modalPop 0.3s ease-out;">
            <div style="font-size: 48px; margin-bottom: 20px;">${isLocked ? '🔒' : '🔓'}</div>
            <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 800; color: white;">Accès aux pointages</h2>
            <p style="margin: 0 0 20px 0; color: #8E8E93; font-size: 14px;">Semaine ${week} (${year}) pour ${fullName}</p>
            
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 15px; margin-bottom: 25px;">
                <span style="font-size: 11px; color: #8E8E93; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 5px;">Statut actuel</span>
                <span style="font-size: 16px; font-weight: 800; color: ${isLocked ? '#FF3B30' : '#34C759'};">
                    ${isLocked ? 'Semaine verrouillée' : 'Semaine non verrouillée'}
                </span>
            </div>

            <p style="font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.5; margin-bottom: 25px;">
                Voulez-vous verrouiller l'accès au pointage de cette semaine pour l'utilisateur ?
            </p>

            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button id="btn-lock-week" class="btn-primary" style="width: 100%; height: 48px; background: #FF3B30; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    🔒 Laisser verrouillée
                </button>
                <button id="btn-unlock-week" class="btn-primary" style="width: 100%; height: 48px; background: #34C759; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    🔓 Déverrouiller l'accès
                </button>
                <button onclick="this.closest('.modal-overlay').remove()" style="width: 100%; height: 48px; background: rgba(255,255,255,0.08); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer;">
                    Fermer
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-lock-week').onclick = async () => {
        const btnLock = modal.querySelector('#btn-lock-week');
        btnLock.disabled = true;
        btnLock.innerText = "Enregistrement...";
        try {
            await api.toggleUserWeekLock(targetUserId, week, year, true, latestReq ? latestReq.id : null);
            window.showToast("🔒 Semaine verrouillée avec succès !");
            modal.remove();
            await window.renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur: " + e.message);
            btnLock.disabled = false;
            btnLock.innerText = "🔒 Laisser verrouillée";
        }
    };

    modal.querySelector('#btn-unlock-week').onclick = async () => {
        const btnUnlock = modal.querySelector('#btn-unlock-week');
        btnUnlock.disabled = true;
        btnUnlock.innerText = "Déverrouillage...";
        try {
            await api.toggleUserWeekLock(targetUserId, week, year, false, null);
            window.showToast("🔓 Semaine déverrouillée avec succès !");
            modal.remove();
            await window.renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur: " + e.message);
            btnUnlock.disabled = false;
            btnUnlock.innerText = "🔓 Déverrouiller l'accès";
        }
    };
};

window.toggleUserWeekLock = async function (targetUserId, week, year, currentIsLocked, latestReqId) {
    try {
        if (currentIsLocked) {
            await api.toggleUserWeekLock(targetUserId, week, year, false, null);
            window.showToast("🔓 Semaine déverrouillée avec succès !");
        } else {
            await api.toggleUserWeekLock(targetUserId, week, year, true, latestReqId);
            window.showToast("🔒 Semaine verrouillée avec succès !");
        }
        await renderAdminPointage(week, year);
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

// --- MODULE: GESTION DES CONGÉS (Admin) ---
window.updateAllBadges = async function () {
    if (document.hidden) return; // Ignore if tab is hidden to save requests
    try {
        const summary = await api.getAdminBadgesSummary();

        // 1. Congés
        const congesBadge = document.getElementById('conges-badge');
        if (congesBadge) {
            congesBadge.textContent = summary.conges;
            congesBadge.style.display = summary.conges > 0 ? 'flex' : 'none';
        }

        // 2. RTT
        const rttBadge = document.getElementById('rtt-badge');
        if (rttBadge) {
            rttBadge.textContent = summary.rtt;
            rttBadge.style.display = summary.rtt > 0 ? 'flex' : 'none';
        }

        // 3. Récupération
        const navRecupBadge = document.getElementById('nav-recup-badge');
        if (navRecupBadge) {
            navRecupBadge.textContent = summary.recup;
            navRecupBadge.style.display = summary.recup > 0 ? 'flex' : 'none';
        }
        const innerRecupBadge = document.getElementById('recup-badge');
        if (innerRecupBadge) {
            innerRecupBadge.textContent = summary.recup;
            innerRecupBadge.style.display = summary.recup > 0 ? 'flex' : 'none';
        }

        // 4. Pointage Intelligent
        const ptgBadge = document.getElementById('pointage-modification-badge');
        if (ptgBadge) {
            ptgBadge.textContent = summary.pointageModifications;
            ptgBadge.style.display = summary.pointageModifications > 0 ? 'flex' : 'none';
        }

        // 5. Demande de matériel
        const matBadge = document.getElementById('mat-request-badge');
        if (matBadge) {
            matBadge.textContent = summary.material;
            matBadge.style.display = summary.material > 0 ? 'flex' : 'none';
        }

        // 6. Statut du matériel ATS (Stock)
        const matStockBadge = document.getElementById('mat-stock-request-badge');
        if (matStockBadge) {
            matStockBadge.textContent = summary.materialStock;
            matStockBadge.style.display = summary.materialStock > 0 ? 'flex' : 'none';
        }
        const innerMatStockBadge = document.getElementById('requests-badge');
        const innerMatBtn = document.getElementById('material-requests-btn');
        if (innerMatStockBadge) {
            innerMatStockBadge.textContent = summary.materialStock;
            innerMatStockBadge.style.display = summary.materialStock > 0 ? 'block' : 'none';
            if (innerMatBtn) {
                if (summary.materialStock > 0) innerMatBtn.classList.add('clignotant');
                else innerMatBtn.classList.remove('clignotant');
            }
        }

        // 7. Statut du matériel GT
        const matGTBadge = document.getElementById('mat-stock-gt-request-badge');
        const gtSidebarBadge = document.getElementById('gt-requests-badge');
        if (matGTBadge) {
            matGTBadge.textContent = summary.materialGT;
            matGTBadge.style.display = summary.materialGT > 0 ? 'flex' : 'none';
        }
        if (gtSidebarBadge) {
            gtSidebarBadge.textContent = summary.materialGT;
            gtSidebarBadge.style.display = summary.materialGT > 0 ? 'flex' : 'none';
        }

        // 8. Statut du matériel Aspi
        const matAspiBadge = document.getElementById('mat-stock-aspi-request-badge');
        const aspiSidebarBadge = document.getElementById('aspi-requests-badge');
        if (matAspiBadge) {
            matAspiBadge.textContent = summary.materialAspi;
            matAspiBadge.style.display = summary.materialAspi > 0 ? 'flex' : 'none';
        }
        if (aspiSidebarBadge) {
            aspiSidebarBadge.textContent = summary.materialAspi;
            aspiSidebarBadge.style.display = summary.materialAspi > 0 ? 'flex' : 'none';
        }

        // 9. Signalements
        const reportsBadge = document.getElementById('reports-badge');
        if (reportsBadge) {
            reportsBadge.textContent = summary.reports;
            reportsBadge.style.display = summary.reports > 0 ? 'flex' : 'none';
        }
    } catch (e) {
        console.warn("Could not update all badges summary", e);
    }
};

window.updateCongesBadge = async function () {
    await window.updateAllBadges();
};

window.updateRecupBadge = async function () {
    await window.updateAllBadges();
};

window.updatePointageBadge = async function () {
    await window.updateAllBadges();
};

window.generateRecupPDFPlaceholder = async function (requestData) {
    console.log("PDF generation started for recup request:", requestData);
    try {
        const parsedCommentData = window.parseCongeAdminComment(requestData.admin_comment);
        let user = requestData.profiles || {};
        if (Array.isArray(user)) {
            user = user[0] || {};
        }

        const first_name = user.first_name || requestData.first_name || '';
        const last_name = user.last_name || requestData.last_name || '';
        const secteur = user.secteur || requestData.secteur || '';
        const societeVal = user.societe || requestData.societe || 'Pouchain';
        const societe = societeVal.toLowerCase();

        const templateName = societe === 'cepp'
            ? 'MOD-GRH-04 Demande absence CEPP v2.pdf'
            : 'MOD-GRH-05 Demande absence POUCHAIN v2.pdf';

        console.log(`Loading PDF template: ${templateName}`);

        const response = await fetch(`./${templateName}`);
        if (!response.ok) throw new Error(`Impossible de charger le modèle ${templateName}`);
        const templateBytes = await response.arrayBuffer();

        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(templateBytes);
        const form = pdfDoc.getForm();
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        const nom = (last_name || '').toUpperCase();
        const prenom = first_name || '';
        const service = (societe === 'cepp') ? 'PAC' : ((!secteur || secteur === 'Tout') ? 'PAC' : secteur);

        // Fill Identity
        form.getTextField('Text1').setText(nom);
        form.getTextField('Text2').setText(prenom);
        form.getTextField('Text3').setText(service);

        const formatStrDate = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        };

        const getLocalYYYYMMDD = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const getReturnDate = (endDateStr, endTimeStr) => {
            if (endTimeStr) {
                const parts = endTimeStr.split(':');
                if (parts.length >= 2) {
                    const hour = parseInt(parts[0], 10);
                    const minute = parseInt(parts[1], 10);
                    const timeDecimal = hour + (minute / 60);
                    if (timeDecimal < 16.0) {
                        return endDateStr;
                    }
                }
            }
            let nextDate = new Date(endDateStr + 'T12:00:00');
            do {
                nextDate.setDate(nextDate.getDate() + 1);
            } while (nextDate.getDay() === 0 || nextDate.getDay() === 6 || window.isJoursFerieFrance(getLocalYYYYMMDD(nextDate)));

            return getLocalYYYYMMDD(nextDate);
        };

        const du = formatStrDate(requestData.date);
        const au = formatStrDate(requestData.date);
        const joursCount = requestData.hours ? `${requestData.hours} heures` : '1 jour';
        const motif = requestData.start_time ? `Repos/Recup (de ${requestData.start_time} à ${requestData.end_time})` : "Repos/Recup";
        const retour = formatStrDate(getReturnDate(requestData.date, requestData.end_time));

        if (societe === 'cepp') {
            form.getTextField('Text4').setText(du);
            form.getTextField('Text7').setText(au);
            form.getTextField('Text10').setText(joursCount);
            form.getTextField('Text14').setText(motif);
            form.getTextField('Text17').setText(retour);
        } else {
            form.getTextField('Text4').setText(du);
            form.getTextField('Text5').setText(au);
            form.getTextField('Text6').setText(joursCount);
            form.getTextField('Text7').setText(motif);
            form.getTextField('Text8').setText(retour);
        }

        // Submission date
        const dateSoumission = formatStrDate(requestData.created_at ? requestData.created_at.split('T')[0] : getLocalYYYYMMDD(new Date()));
        form.getTextField('Text20').setText(`Le ${dateSoumission}`);

        // Select checkbox / radio group
        try {
            form.getRadioGroup('Group1').select('Choice1');
        } catch (e) {
            console.warn("Could not select Group1", e);
        }

        // Date and signature of admin
        const dateAcceptation = formatStrDate(getLocalYYYYMMDD(new Date()));
        let adminName = requestData.admin_name || parsedCommentData.admin_name;
        if (!adminName) {
            const currentAdmin = window.currentUserProfile;
            adminName = currentAdmin ? `${currentAdmin.first_name || ''} ${currentAdmin.last_name || ''}`.trim() : 'Admin';
        }
        const dateRespFieldName = societe === 'cepp' ? 'Text25' : 'Text24';
        const dateRespField = form.getTextField(dateRespFieldName);
        const textVal = `Le ${dateAcceptation} par ${adminName}`;
        dateRespField.setText(textVal);

        try {
            const { StandardFonts } = PDFLib;
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const maxFieldWidth = 135; // Maximum space width inside the box
            let fontSize = 10;
            let textWidth = helveticaFont.widthOfTextAtSize(textVal, fontSize);
            while (textWidth > maxFieldWidth && fontSize > 6.5) {
                fontSize -= 0.5;
                textWidth = helveticaFont.widthOfTextAtSize(textVal, fontSize);
            }
            dateRespField.setFontSize(fontSize);
        } catch (fontErr) {
            console.error("Could not scale font size dynamically:", fontErr);
            if (textVal.length > 30) dateRespField.setFontSize(7.5);
            else if (textVal.length > 25) dateRespField.setFontSize(8.5);
            else dateRespField.setFontSize(10);
        }

        // Draw employee signature
        if (requestData.signature) {
            try {
                const blackSigUrl = await window.forceSignatureBlackColor(requestData.signature);
                const sigImageBytes = await window.getSignatureBytes(blackSigUrl);
                const sigImage = await pdfDoc.embedPng(sigImageBytes);

                const sigCoords = societe === 'cepp'
                    ? { x: 430, y: 278, width: 90, height: 35 }
                    : { x: 430, y: 250, width: 90, height: 35 };

                firstPage.drawImage(sigImage, sigCoords);
            } catch (sigErr) {
                console.warn("Could not embed signature image", sigErr);
            }
        }

        // Draw admin signature
        const adminSignature = requestData.admin_signature || parsedCommentData.admin_signature;
        if (adminSignature) {
            try {
                const blackSigUrl = await window.forceSignatureBlackColor(adminSignature);
                const sigImageBytes = await window.getSignatureBytes(blackSigUrl);
                const sigImage = await pdfDoc.embedPng(sigImageBytes);

                const adminSigCoords = societe === 'cepp'
                    ? { x: 430, y: 130, width: 135, height: 52.5 }
                    : { x: 430, y: 85, width: 135, height: 52.5 };

                firstPage.drawImage(sigImage, adminSigCoords);
            } catch (sigErr) {
                console.warn("Could not embed admin signature image", sigErr);
            }
        }

        form.flatten();

        const pdfBytes = await pdfDoc.save();

        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Demande_Recup_${nom}_${prenom}_${du.replace(/\//g, '-')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log("PDF generated and download triggered successfully!");
    } catch (err) {
        console.error("Error generating Recup PDF:", err);
        alert("Erreur lors de la génération du PDF: " + err.message);
    }
};

window.openAdminRecupRequestsModal = async function () {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000002';
    modal.style.backdropFilter = 'blur(10px)';

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 800px; padding: 40px; border-radius: 32px; background: rgba(28, 28, 30, 0.95); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: modalPop 0.3s ease-out; max-height: 90vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0;">
                <div>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: white;">Demandes de récupération d'heures</h2>
                    <p style="margin: 4px 0 0 0; color: #8E8E93; font-size: 14px;">Validez ou refusez les demandes de récupération (Repos/Recup)</p>
                </div>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.05); border: none; color: #fff; width: 40px; height: 40px; border-radius: 20px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
            
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-shrink: 0; background: rgba(255,255,255,0.03); padding: 5px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05);">
                <button id="recup-tab-pending" style="flex: 1; padding: 10px; border-radius: 10px; border: none; background: #007AFF; color: white; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.2s;">En attente</button>
                <button id="recup-tab-history" style="flex: 1; padding: 10px; border-radius: 10px; border: none; background: transparent; color: #8E8E93; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.2s;">Historique</button>
            </div>

            <div id="recup-requests-list" style="flex: 1; overflow-y: auto; padding-right: 10px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 20px;">
                <div style="text-align: center; padding: 40px; color: #8E8E93;">Chargement...</div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    let activeTab = 'pending';

    const renderList = () => {
        const listContainer = document.getElementById('recup-requests-list');
        if (!listContainer || !window.pendingRecupRequestsCache) return;

        const requests = window.pendingRecupRequestsCache;

        if (activeTab === 'pending') {
            const pending = requests.filter(r => r.status === 'pending');
            if (pending.length === 0) {
                listContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #8E8E93; font-weight: 600; font-size: 15px;">Aucune demande de récupération en attente. 🙌</div>`;
                return;
            }

            listContainer.innerHTML = pending.map(r => {
                const user = r.profiles || {};
                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Employé';
                const balance = parseFloat(user.overtime_balance) || 0;
                const formattedDate = new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

                return `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px;">
                            <div>
                                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: white;">${fullName}</h3>
                                <p style="margin: 4px 0 0 0; color: #8E8E93; font-size: 12px;">Société: ${(user.societe || 'Pouchain').toUpperCase()} | Secteur: ${user.secteur || 'Non défini'}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 12px; color: #8E8E93; font-weight: 700; text-transform: uppercase;">Solde d'heures sup</div>
                                <div style="font-size: 16px; font-weight: 800; color: ${balance >= 0 ? '#34C759' : '#FF3B30'};">${window.formatOvertimeDuration(balance)}</div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div>
                                <div style="font-size: 11px; font-weight: 800; color: #8E8E93; text-transform: uppercase; margin-bottom: 4px;">Détails de récupération</div>
                                <div style="font-size: 14px; font-weight: 700; color: white;">Date : ${formattedDate}</div>
                                <div style="font-size: 14px; font-weight: 700; color: #FF9500; margin-top: 2px;">Durée : ${r.hours} heures</div>
                                ${r.start_time ? `<div style="font-size: 13px; font-weight: 600; color: #8E8E93; margin-top: 4px;">Horaire : de ${r.start_time} à ${r.end_time}</div>` : ''}
                            </div>
                            <div>
                                <div style="font-size: 11px; font-weight: 800; color: #8E8E93; text-transform: uppercase; margin-bottom: 6px;">Signature du salarié</div>
                                <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; background: white; height: 80px; display: flex; align-items: center; justify-content: center; padding: 5px;">
                                    <img src="${r.signature}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Signature salarié">
                                </div>
                            </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-size: 12px; font-weight: 700; color: #8E8E93;">Commentaire de l'administrateur</label>
                            <input type="text" id="recup-comment-${r.id}" placeholder="Ex: Approuvé pour récupération AIA..." style="height: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; padding: 0 12px; font-size: 14px; outline: none;">
                        </div>

                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 5px;">
                            <button onclick="window.decideAdminRecupRequest('${r.id}', 'refuse', this)" style="padding: 10px 20px; border-radius: 10px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); color: #FF3B30; font-weight: 700; font-size: 13px; cursor: pointer;">Refuser</button>
                            <button onclick="window.decideAdminRecupRequest('${r.id}', 'approve', this)" style="padding: 10px 24px; border-radius: 10px; background: #34C759; border: none; color: white; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(52, 199, 89, 0.25);">Valider & Signer</button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            const history = requests.filter(r => r.status !== 'pending');
            if (history.length === 0) {
                listContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #8E8E93; font-weight: 600; font-size: 15px;">Aucune demande dans l'historique.</div>`;
                return;
            }

            listContainer.innerHTML = history.map(r => {
                const user = r.profiles || {};
                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Employé';
                const formattedDate = new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

                let parsedComment = r.admin_comment || '';
                try {
                    const parsed = JSON.parse(r.admin_comment);
                    parsedComment = parsed.comment || '';
                } catch(e) {}

                const statusColor = r.status === 'approved' ? '#34C759' : '#FF3B30';
                const statusText = r.status === 'approved' ? 'Acceptée' : 'Refusée';

                return `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                            <div>
                                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: white;">${fullName}</h3>
                                <p style="margin: 2px 0 0 0; color: #8E8E93; font-size: 11px;">Date de récupération : ${formattedDate} (${r.hours}h) ${r.start_time ? `de ${r.start_time} à ${r.end_time}` : ''}</p>
                            </div>
                            <span style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; background: ${statusColor}1A; color: ${statusColor}; border: 1px solid ${statusColor}33;">${statusText}</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                            <div style="font-size: 13px; color: #8E8E93; max-width: 70%;">
                                <span style="font-weight: 700; color: white;">Justification:</span> ${parsedComment || 'Aucun commentaire'}
                            </div>
                            ${r.status === 'approved' ? `
                                <button onclick="window.downloadHistoryRecupPDF('${r.id}')" style="padding: 8px 16px; border-radius: 10px; background: rgba(0, 122, 255, 0.1); border: 1px solid rgba(0, 122, 255, 0.2); color: #007AFF; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                    📥 Télécharger PDF
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    };

    const loadRequests = async () => {
        try {
            const requests = await api.getAdminRecupRequests();
            window.pendingRecupRequestsCache = requests;
            renderList();
        } catch (e) {
            const listContainer = document.getElementById('recup-requests-list');
            if (listContainer) {
                listContainer.innerHTML = `<div style="color: #FF3B30; padding: 20px; text-align: center;">Erreur de chargement: ${e.message}</div>`;
            }
        }
    };

    loadRequests();

    document.getElementById('recup-tab-pending').onclick = () => {
        activeTab = 'pending';
        document.getElementById('recup-tab-pending').style.background = '#007AFF';
        document.getElementById('recup-tab-pending').style.color = 'white';
        document.getElementById('recup-tab-history').style.background = 'transparent';
        document.getElementById('recup-tab-history').style.color = '#8E8E93';
        renderList();
    };

    document.getElementById('recup-tab-history').onclick = () => {
        activeTab = 'history';
        document.getElementById('recup-tab-history').style.background = '#007AFF';
        document.getElementById('recup-tab-history').style.color = 'white';
        document.getElementById('recup-tab-pending').style.background = 'transparent';
        document.getElementById('recup-tab-pending').style.color = '#8E8E93';
        renderList();
    };

    window.downloadHistoryRecupPDF = async function (id) {
        const reqObj = (window.pendingRecupRequestsCache || []).find(r => r.id === id);
        if (reqObj) {
            await window.generateRecupPDFPlaceholder(reqObj);
        } else {
            alert("Impossible de trouver les informations de cette demande.");
        }
    };

    window.decideAdminRecupRequest = async function (id, action, btn) {
        const comment = document.getElementById(`recup-comment-${id}`).value.trim();
        const currentAdmin = window.currentUserProfile || {};
        const adminName = `${currentAdmin.first_name || ''} ${currentAdmin.last_name || ''}`.trim() || 'Admin';

        if (action === 'refuse') {
            if (confirm("Voulez-vous vraiment refuser cette demande ?")) {
                const oldText = btn.innerText;
                btn.disabled = true;
                btn.innerText = "Refus...";
                try {
                    await api.actionRecupRequest(id, 'refuse', adminName, null, comment);
                    window.showToast("Demande refusée.");
                    loadRequests();
                    window.updateRecupBadge();
                    window.renderAdminOvertime();
                } catch (e) {
                    alert("Erreur: " + e.message);
                    btn.disabled = false;
                    btn.innerText = oldText;
                }
            }
        } else if (action === 'approve') {
            let adminSignature = null;
            try {
                adminSignature = await window.openAdminSignatureModal();
            } catch (e) {
                console.error("Signature failed", e);
            }
            if (!adminSignature) {
                return;
            }

            const oldText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Approbation...";

            try {
                await api.actionRecupRequest(id, 'approve', adminName, null, comment, adminSignature);
                window.showToast("Demande approuvée avec succès !");

                const reqObj = (window.pendingRecupRequestsCache || []).find(r => r.id === id);
                if (reqObj) {
                    reqObj.admin_signature = adminSignature;
                    reqObj.admin_comment = comment;
                    reqObj.admin_name = adminName;
                    await window.generateRecupPDFPlaceholder(reqObj);
                } else {
                    console.warn("Could not find request in cache to generate PDF.");
                }

                loadRequests();
                window.updateRecupBadge();
                window.renderAdminOvertime();
            } catch (e) {
                alert("Erreur: " + e.message);
                btn.disabled = false;
                btn.innerText = oldText;
            }
        }
    };
};

window.parseCongeAdminComment = function (commentStr) {
    if (!commentStr) return { comment: '', admin_name: '', admin_signature: '' };
    if (typeof commentStr === 'string' && commentStr.startsWith('{') && commentStr.endsWith('}')) {
        try {
            const data = JSON.parse(commentStr);
            return {
                comment: data.comment || '',
                admin_name: data.admin_name || '',
                admin_signature: data.admin_signature || null
            };
        } catch (e) { }
    }
    return { comment: commentStr, admin_name: '', admin_signature: null };
};

window.forceSignatureBlackColor = async function(dataUrlOrUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                // Rendre les pixels blancs/clairs transparents, et les pixels foncés noirs
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    const brightness = (r + g + b) / 3;
                    if (a < 30 || brightness > 220) {
                        // Pixel transparent ou très clair => on le rend transparent
                        data[i + 3] = 0;
                    } else {
                        // Pixel foncé (trait de la signature) => on le force en noir opaque
                        data[i] = 0;
                        data[i + 1] = 0;
                        data[i + 2] = 0;
                        data[i + 3] = 255;
                    }
                }
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                resolve(dataUrlOrUrl);
            }
        };
        img.onerror = () => resolve(dataUrlOrUrl);
        img.src = dataUrlOrUrl;
    });
}

window.getSignatureBytes = async function(urlOrDataUrl) {
    if (!urlOrDataUrl) return null;
    if (urlOrDataUrl.startsWith('data:')) {
        const base64Content = urlOrDataUrl.split(',')[1];
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } else {
        return await fetch(urlOrDataUrl).then(res => res.arrayBuffer());
    }
};
