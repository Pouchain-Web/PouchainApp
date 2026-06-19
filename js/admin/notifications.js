import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminNotifications = async function () {
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-notifications').classList.add('active');
    const container = document.getElementById('admin-content');

    // Structure HTML Ultra Premium avec Glassmorphism et SCROLLABLE
    container.innerHTML = `
        <div style="height: 100%; width: 100%; position: relative; overflow: hidden; background: url('https://images.unsplash.com/photo-1550745165-9bc0b25272a7?auto=format&fit=crop&q=80&w=2070') center/cover no-repeat fixed; border-radius: 20px;">
            <div style="position: absolute; inset: 0; background: rgba(10, 10, 10, 0.6); backdrop-filter: blur(25px); pointer-events: none; z-index: 0;"></div>
            
            <div style="position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; z-index: 1;">
                <div style="padding: 40px; min-height: 100%; display: flex; flex-direction: column; color: white; gap: 40px; max-width: 1400px; margin: 0 auto; box-sizing: border-box;">
                
                <!-- HEADER -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <h1 style="font-size: 36px; font-weight: 800; margin: 0; letter-spacing: -1px;">🔔 Centre de Notifications</h1>
                        <p style="color: #aaa; font-size: 16px; margin-top: 10px;">Gérez les communications directes et les automatisations du système.</p>
                    </div>
                </div>

                <!-- SECTION 1: ENVOI DIRECT -->
                <div style="display: grid; grid-template-columns: 1fr 400px; gap: 40px;">
                    <div class="glass-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 40px; display: flex; flex-direction: column; gap: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
                        <h2 style="margin:0; font-size: 20px; font-weight: 800; color: var(--primary);">🚀 Message Instantané</h2>
                        <div>
                            <label style="display:block; margin-bottom:12px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; font-size: 11px;">Contenu du message</label>
                            <textarea id="notif-message" class="form-input" rows="5" 
                                      placeholder="Ex: N'oubliez pas votre pointage KIZEO..." 
                                      style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; width: 100%; color: white; padding: 20px; font-size: 17px; resize: none; transition: all 0.3s ease;"></textarea>
                            <div id="char-count" style="text-align: right; margin-top: 8px; font-size: 12px; color: #666;">0 / 200</div>
                        </div>


                        <div id="notif-status" style="min-height: 30px; text-align: center;"></div>

                        <button class="btn btn-primary" onclick="window.sendCustomNotification()" id="btn-send-notif" 
                                style="height: 60px; border-radius: 20px; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 10px 30px rgba(0, 122, 255, 0.25);">
                            <span>Envoyer le message</span>
                        </button>
                    </div>

                    <!-- Recipient Selection -->
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 30px; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="padding: 20px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 800; font-size: 14px;">Destinataires</span>
                            <button onclick="window.toggleAllRecipients()" style="background: none; border: none; color: var(--primary); font-weight: 700; cursor: pointer; font-size: 12px;">Tout cocher</button>
                        </div>
                        
                        <div id="recipient-list" style="height: 300px; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 6px;">
                            <div style="text-align:center; padding: 30px; color: #555;">Chargement...</div>
                        </div>

                        <div style="padding: 15px; background: rgba(0,0,0,0.1); border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                            <span id="selected-count" style="font-size: 12px; color: #777;">0 sélectionné(s)</span>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: AUTOMATISATIONS & RÉGLAGES -->
                <div>
                    <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 25px; display: flex; align-items: center; gap: 12px;">
                        <span style="background: var(--primary); width: 12px; height: 12px; border-radius: 3px;"></span>
                        Réglages des Automatisations
                    </h2>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 25px;">
                        
                        <!-- CARD: PLANNING -->
                        <div class="automation-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 30px; transition: 0.3s;">
                            <div style="font-size: 32px; margin-bottom: 15px;">📅</div>
                            <h3 style="margin:0; font-size: 18px; font-weight: 800;">Alerte Planning</h3>
                            <p style="color: #888; font-size: 13px; margin: 10px 0 20px;">Prévenir automatiquement le salarié lorsqu'une nouvelle tâche lui est assignée.</p>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 12px; font-weight: 700; color: #aaa;">STATUT : <b id="st-planning">ACTIF</b></span>
                                <label class="switch-ui"><input type="checkbox" id="auto-planning" checked onchange="saveAutoSettings()"><span class="slider"></span></label>
                            </div>
                        </div>

                        <!-- CARD: VÉHICULE (KILOMÉTRAGE) -->
                        <div class="automation-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 30px;">
                            <div style="font-size: 32px; margin-bottom: 15px;">🚗</div>
                            <h3 style="margin:0; font-size: 18px; font-weight: 800;">Rappel Kilométrage</h3>
                            <p style="color: #888; font-size: 13px; margin: 10px 0 20px;">Rappel automatique chaque vendredi à 14h pour tous les détenteurs d'un véhicule.</p>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 12px; font-weight: 700; color: #aaa;">STATUT : <b id="st-mileage">ACTIF</b></span>
                                <label class="switch-ui"><input type="checkbox" id="auto-mileage" checked onchange="saveAutoSettings()"><span class="slider"></span></label>
                            </div>
                        </div>

                        <!-- CARD: VÉHICULE (ÉCHÉANCES) -->
                        <div class="automation-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 30px;">
                            <div style="font-size: 32px; margin-bottom: 15px;">⏳</div>
                            <h3 style="margin:0; font-size: 18px; font-weight: 800;">Échéances Véhicule</h3>
                            <p style="color: #888; font-size: 13px; margin: 10px 0 20px;">Alerter le conducteur 500km ou 1 mois avant un entretien ou un contrôle technique.</p>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 12px; font-weight: 700; color: #aaa;">STATUT : <b id="st-deadline">ACTIF</b></span>
                                <label class="switch-ui"><input type="checkbox" id="auto-deadline" checked onchange="saveAutoSettings()"><span class="slider"></span></label>
                            </div>
                        </div>

                        <!-- CARD: MATÉRIEL (SUIVI) -->
                        <div class="automation-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 25px; padding: 30px;">
                            <div style="font-size: 32px; margin-bottom: 15px;">🛠️</div>
                            <h3 style="margin:0; font-size: 18px; font-weight: 800;">Statut Matériel</h3>
                            <p style="color: #888; font-size: 13px; margin: 10px 0 20px;">Notifier le demandeur dès qu'une commande est confirmée, commandée ou refusée.</p>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 12px; font-weight: 700; color: #aaa;">STATUT : <b id="st-material">ACTIF</b></span>
                                <label class="switch-ui"><input type="checkbox" id="auto-material" checked onchange="saveAutoSettings()"><span class="slider"></span></label>
                            </div>
                        </div>

                        <!-- CARD: MAINTENANCE PARC -->
                        <div class="automation-card" style="background: rgba(255,149,0,0.05); border: 1px solid rgba(255,149,0,0.1); border-radius: 25px; padding: 30px; grid-column: 1 / -1;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 40px;">
                                <div style="flex: 1;">
                                    <div style="font-size: 32px; margin-bottom: 10px;">📋</div>
                                    <h3 style="margin:0; font-size: 18px; font-weight: 800; color: #FF9500;">Échéance obligatoire réglementaire</h3>
                                    <p style="color: #888; font-size: 13px; margin: 10px 0;">Alertes automatiques (Push/Web) avant l'échéance obligatoire réglementaire calculée.</p>
                                </div>
                                <div style="text-align: right; min-width: 250px;">
                                    <div style="font-size: 11px; font-weight: 800; color: #FF9500; margin-bottom: 12px; letter-spacing: 1px;">DÉLAI D'AVERTISSEMENT</div>
                                    <div style="display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                        <input type="range" id="maint-alert-days" min="7" max="60" value="30" style="flex: 1; accent-color: #FF9500;" oninput="document.getElementById('maint-alert-days-val').innerText = this.value + ' jours'" onchange="saveAutoSettings()">
                                        <span id="maint-alert-days-val" style="font-weight: 800; color: white; font-size: 14px; min-width: 65px;">30 jours</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="border-top: 1px dashed rgba(255,149,0,0.2); padding-top: 25px; margin-top: 25px; display: flex; align-items: center; justify-content: space-between;">
                                <div style="flex: 1;">
                                    <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #FF9500;">Alerte réglementaire & durée de validité</h4>
                                    <p style="color: #888; font-size: 12px; margin: 0;">Prévenir les admin 1 mois avant par notification push, puis une fois par semaine pour les éléments proches de l'échéance.</p>
                                </div>
                                <label class="switch-ui"><input type="checkbox" id="auto-maint-validity" checked onchange="saveAutoSettings()"><span class="slider"></span></label>
                            </div>

                            <div style="border-top: 1px dashed rgba(255,149,0,0.2); padding-top: 25px; margin-top: 25px;">
                                <h4 style="margin: 0 0 15px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #888;">Qui doit recevoir ces alertes ?</h4>
                                <div id="maint-alert-users" style="display: flex; flex-wrap: wrap; gap: 10px;">
                                    <!-- Liste des administrateurs pour maintenance -->
                                    <div style="font-size: 11px; color: #555;">Chargement des administrateurs...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 3: ALERTES ADMINISTRATEURS -->
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 40px; margin-bottom: 60px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                        <div>
                            <h2 style="margin:0; font-size: 22px; font-weight: 800; color: #FF9500;">🚨 Alertes Administrateurs</h2>
                            <p style="color: #888; font-size: 14px; margin-top: 5px;">Configurer qui reçoit une notification immédiate pour chaque nouvelle demande de matériel.</p>
                        </div>
                        <button class="btn btn-secondary" onclick="window.saveAdminAlertSettings()" style="padding: 10px 25px; border-radius:12px;">Enregistrer les destinataires</button>
                    </div>
                    
                    <div id="admin-alert-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                        <!-- Liste des admins avec cases à cocher -->
                        <div style="text-align:center; padding: 20px; color: #666;">Chargement des administrateurs...</div>
                    </div>

                    <div style="margin-top: 25px; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 25px; display: flex; justify-content: flex-end;">
                        <button id="btn-test-reminders" class="btn btn-secondary" style="border-color: #FF9500; color: #FF9500; font-size: 13px; background: rgba(255, 149, 0, 0.05); padding: 12px 20px; border-radius: 12px;" onclick="window.triggerMaterialReminder()">🔔 Tester les rappels de demandes (+7j)</button>
                    </div>
                </div>

                <!-- SECTION 4: NOTIFICATIONS PLANIFIÉES (CUSTOM) -->
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 40px; margin-bottom: 100px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                        <div>
                            <h2 style="margin:0; font-size: 22px; font-weight: 800; color: #5856D6;">📅 Programmations Personnalisées</h2>
                            <p style="color: #aaa; font-size: 14px; margin-top: 5px;">Envoyer des notifications automatiques personnalisées sur le téléphone des collaborateurs.</p>
                        </div>
                        <button class="btn btn-primary" onclick="window.showCreateScheduleModal()" style="padding: 12px 25px; border-radius: 12px; background: #5856D6; border-color: #5856D6;">
                            + Nouveau Planning
                        </button>
                    </div>

                    <div id="scheduled-notifications-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
                        <!-- Les programmations seront injectées ici -->
                        <div style="text-align:center; padding: 40px; color: #555; grid-column: 1 / -1;">Chargement des programmations...</div>
                    </div>
                </div>

            </div>
        </div>
        
        <style>
            .automation-card:hover { transform: translateY(-5px); background: rgba(255,255,255,0.08); }
            
            /* Styles pour les Switchs */
            .switch-ui { position: relative; display: inline-block; width: 46px; height: 26px; }
            .switch-ui input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .4s; border-radius: 34px; border: 1px solid rgba(255,255,255,0.1); }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            input:checked + .slider { background-color: var(--primary); border-color: var(--primary); }
            input:focus + .slider { box-shadow: 0 0 1px var(--primary); }
            input:checked + .slider:before { transform: translateX(20px); }
            
            .admin-alert-row {
                padding: 15px 20px;
                background: rgba(0,0,0,0.2);
                border-radius: 15px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                border: 1px solid transparent;
            }
            .admin-alert-row:hover { background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.1); }
            .admin-alert-row.selected { border-color: #FF9500; background: rgba(255, 149, 0, 0.1); }
            .admin-alert-row .admin-status-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #444; background: transparent; transition: all 0.2s ease; }
            .admin-alert-row.selected .admin-status-dot { border-color: #FF9500; background: #FF9500; }

            .schedule-card {
                background: rgba(255,255,255,0.03); 
                border: 1px solid rgba(255,255,255,0.05); 
                border-radius: 20px; 
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 15px;
                transition: 0.2s;
            }
            .schedule-card:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); }
        </style>
    `;

    const list = document.getElementById('recipient-list');
    if (list) list.innerHTML = '<div style="padding: 20px; color: #888;">⌛ Chargement des utilisateurs...</div>';

    try {
        // Chargement des données avec Promise.allSettled pour plus de robustesse
        const results = await Promise.allSettled([
            api.listUsers(),
            api.getNotificationSubscribers(),
            api.getNotificationConfig(),
            api.getNotificationSchedules().catch(() => [])
        ]);

        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0 && failed.some(f => {
            const msg = (f.reason && f.reason.message) || String(f.reason || "");
            return msg.includes("Unauthorized");
        })) {
            if (list) list.innerHTML = `<div style="padding: 20px; color: #FF3B30; text-align:center;">
                <p>⚠️ Session expirée ou accès refusé.</p>
                <button onclick="location.reload()" class="btn" style="margin-top:10px; background:rgba(255,255,255,0.1); color:white; border:none; padding:8px 15px; border-radius:10px;">Réessayer</button>
             </div>`;
            return;
        }

        const users = results[0].status === 'fulfilled' ? results[0].value : [];
        const subsResult = results[1].status === 'fulfilled' ? results[1].value : [];
        const configRes = results[2].status === 'fulfilled' ? results[2].value : {};
        const schedules = results[3].status === 'fulfilled' ? results[3].value : [];

        const secteur = window.currentUserProfile?.secteur || 'AIA';
        const filteredUsers = (secteur === 'Tout') ? users : users.filter(u => u.secteur === secteur);

        // Affichage des programmations :
        // Les anciennes configurations n'ont pas forcément un secteur défini (null).
        // On affiche les programmations correspondant au secteur courant ou à 'Tout'.
        const filteredSchedules = secteur === 'Tout'
            ? schedules
            : schedules.filter(s => !s.secteur || s.secteur === 'Tout' || s.secteur === secteur);

        if (results[0].status === 'rejected' || results[1].status === 'rejected') {
            console.error("Certaines APIs de notification ont échoué", results);
            if (list) list.innerHTML = `<div style="padding: 20px; color: #FF3B30; text-align:center;">
                <p>⚠️ Erreur lors du chargement des abonnés.</p>
                <p style="font-size:10px; opacity:0.6;">${results[0].status === 'rejected' ? results[0].reason : results[1].reason}</p>
            </div>`;
        }

        const subscriberUserIds = new Set(subsResult.filter(Boolean).map(s => s.user_id));
        const adminAlertIds = new Set(configRes.admin_alert_ids || []);

        // Appliquer les réglages d'automatisation (toggles)
        const checkEl = (id) => document.getElementById(id);
        if (checkEl('auto-planning')) checkEl('auto-planning').checked = configRes.auto_planning !== false;
        if (checkEl('auto-mileage')) checkEl('auto-mileage').checked = configRes.auto_mileage !== false;
        if (checkEl('auto-deadline')) checkEl('auto-deadline').checked = configRes.auto_deadline !== false;
        if (checkEl('auto-material')) checkEl('auto-material').checked = configRes.auto_material !== false;
        if (checkEl('auto-maint-validity')) checkEl('auto-maint-validity').checked = configRes.auto_maint_validity !== false;

        if (checkEl('maint-alert-days')) {
            checkEl('maint-alert-days').value = configRes.maint_alert_days || 30;
            if (checkEl('maint-alert-days-val')) {
                checkEl('maint-alert-days-val').innerText = (configRes.maint_alert_days || 30) + ' jours';
            }
        }
        const maintAlertUserIds = new Set(configRes.maint_alert_userIds || []);

        // Remplir la liste des destinataires (Envoi direct)
        if (list) {
            list.innerHTML = "";
            if (users.length === 0 && results[0].status === 'fulfilled') {
                list.innerHTML = '<div style="padding: 20px; color: #888; text-align:center;">Aucun utilisateur trouvé.</div>';
            }
        }
        // filteredUsers est déjà limité au secteur courant (calculé ligne ~9050).
        // Pour un nouveau secteur, aucun changement nécessaire ici.
        const validUsers = filteredUsers.filter(u => u && u.id);
        validUsers.sort((a, b) => {
            const subA = subscriberUserIds.has(a.id);
            const subB = subscriberUserIds.has(b.id);
            if (subA !== subB) return subB ? 1 : -1;
            return (a.first_name || "").localeCompare(b.first_name || "");
        });

        validUsers.forEach(u => {
            const isSubbed = subscriberUserIds.has(u.id);
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
            const div = document.createElement('div');
            div.className = `recipient-row ${isSubbed ? 'subbed' : ''}`;
            div.dataset.userId = u.id;
            div.onclick = () => { div.classList.toggle('selected'); window.updateSelectedCount(); };
            div.innerHTML = `
                <div class="checkbox-visual" style="width: 20px; height: 20px; border-radius: 6px; border: 2px solid rgba(255,255,255,0.2); display: flex; align-items:center; justify-content:center;">
                    <div class="check-mark" style="width: 10px; height: 10px; background: var(--primary); border-radius: 2px; opacity: 0; transition: 0.2s;"></div>
                </div>
                <div style="flex:1;">
                    <span style="font-weight: 700; font-size: 13px; ${!isSubbed ? 'opacity: 0.5;' : ''}">${name}</span>
                    <div style="font-size:10px; opacity: 0.6;">${isSubbed ? '✓ Joignable' : '✕ Non inscrit'}</div>
                </div>
            `;
            list.appendChild(div);
        });

        // Remplir les alertes Administrateurs & Maintenance
        const adminList = document.getElementById('admin-alert-list');
        const maintUserList = document.getElementById('maint-alert-users');
        adminList.innerHTML = "";
        maintUserList.innerHTML = "";
        const admins = filteredUsers.filter(u => u.role === 'admin');

        admins.forEach(u => {
            const isSelected = adminAlertIds.has(u.id);
            const div = document.createElement('div');
            div.className = `admin-alert-row ${isSelected ? 'selected' : ''}`;
            div.dataset.adminId = u.id;
            div.onclick = () => { div.classList.toggle('selected'); };
            div.innerHTML = `
                <div class="admin-status-dot"></div>
                <span style="font-weight: 600; font-size: 14px;">${u.first_name} ${u.last_name}</span>
            `;
            adminList.appendChild(div);

            // Version maintenance (plus petite)
            const isMaintSelected = maintAlertUserIds.has(u.id);
            const mBadge = document.createElement('div');
            mBadge.className = `admin-badge-select ${isMaintSelected ? 'active' : ''}`;
            mBadge.style.cssText = `padding: 8px 15px; border-radius: 10px; background: ${isMaintSelected ? '#FF9500' : 'rgba(255,149,0,0.1)'}; color: ${isMaintSelected ? 'white' : '#FF9500'}; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: 1px solid ${isMaintSelected ? '#FF9500' : 'rgba(255,149,0,0.2)'};`;
            mBadge.dataset.userId = u.id;
            mBadge.innerText = `${u.first_name} ${u.last_name}`;
            mBadge.onclick = () => {
                mBadge.classList.toggle('active');
                if (mBadge.classList.contains('active')) {
                    mBadge.style.background = '#FF9500';
                    mBadge.style.color = 'white';
                } else {
                    mBadge.style.background = 'rgba(255,149,0,0.1)';
                    mBadge.style.color = '#FF9500';
                }
                window.saveAutoSettings();
            };
            maintUserList.appendChild(mBadge);
        });

        // Remplir SECTION 4: Schedules Planifiés (filtrés par secteur)
        const scheduleList = document.getElementById('scheduled-notifications-list');
        scheduleList.innerHTML = "";
        if (!filteredSchedules || (Array.isArray(filteredSchedules) && filteredSchedules.length === 0)) {
            scheduleList.innerHTML = `<div style="text-align:center; padding: 40px; color: #555; grid-column: 1 / -1;">Aucune programmation active.</div>`;
        } else if (Array.isArray(filteredSchedules)) {
            const schedules = filteredSchedules;
            const daysNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
            const monthNames = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

            schedules.forEach(s => {
                let targetLabel = "";
                if (s.target_type === 'all') {
                    const secLabel = s.secteur && s.secteur !== 'Tout' ? ` (${s.secteur})` : '';
                    targetLabel = "🌍 Tous les collaborateurs" + secLabel;
                } else {
                    const ids = s.target_user_ids || (s.user_id ? [s.user_id] : []);
                    if (ids.length === 1) {
                        const u = users.find(u => u.id === ids[0]);
                        targetLabel = `👤 ${u ? u.first_name + ' ' + u.last_name : 'Inconnu'}`;
                    } else {
                        targetLabel = `👥 ${ids.length} collaborateurs sélectionnés`;
                    }
                }

                let freqInfo = "";
                const timeString = s.hour !== undefined && s.hour !== null
                    ? ` à ${s.hour}h${(s.minute || 0).toString().padStart(2, '0')}`
                    : "";

                if (s.frequency === 'daily') freqInfo = "Chaque jour" + timeString;
                else if (s.frequency === 'weekly') freqInfo = `Chaque ${daysNames[s.day_of_week]}` + timeString;
                else if (s.frequency === 'monthly') freqInfo = `Chaque ${s.day_of_month} du mois` + timeString;
                else if (s.frequency === 'yearly') freqInfo = `Chaque ${s.day_of_month} ${monthNames[s.month]}` + timeString;

                const card = document.createElement('div');
                card.className = 'schedule-card';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span style="font-size:12px; font-weight:800; color:#5856D6; text-transform:uppercase;">${freqInfo}</span>
                        <button onclick="window.deleteSchedule('${s.id}')" style="background:rgba(255,59,48,0.1); border:none; padding:8px; border-radius:10px; color:#FF3B30; cursor:pointer; transition:0.2s;">🗑️</button>
                    </div>
                    <div style="font-size:15px; color:white; font-weight:600; line-height:1.4;">${window.escapeHTML(s.message)}</div>
                    ${s.app_url ? `<div style="font-size:12px; color:#5AC8FA; margin-top:5px; word-break:break-all;">🔗 ${window.escapeHTML(s.app_url)}</div>` : ''}
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
                        <span style="font-size:12px; color:#888;">${targetLabel}</span>
                        <span style="font-size:10px; color:#555;">Dernier envoi: ${s.last_sent_at ? new Date(s.last_sent_at).toLocaleDateString() : 'Jamais'}</span>
                    </div>
                `;
                scheduleList.appendChild(card);
            });
        }

        window.showCreateScheduleModal = () => {
            const modal = document.createElement('div');
            modal.id = 'modal-schedule'; // Unique ID for easier removal
            modal.className = 'modal-overlay';
            modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";

            // Sort users and filter for multi-selection
            filteredUsers.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
            const userSelectionHTML = filteredUsers.map(u => `
                <div class="sch-user-option" data-id="${u.id}" style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; background:rgba(255,255,255,0.03); cursor:pointer; transition:0.2s;" onclick="this.classList.toggle('selected'); this.style.background = this.classList.contains('selected') ? 'rgba(88, 86, 214, 0.3)' : 'rgba(255,255,255,0.03)'">
                    <div style="width:18px; height:18px; border:2px solid rgba(255,255,255,0.2); border-radius:4px; display:flex; align-items:center; justify-content:center;">
                        <div class="check" style="width:10px; height:10px; background:#5856D6; border-radius:2px; opacity:0; transition:0.2s;"></div>
                    </div>
                    <span style="font-size:13px; font-weight:600;">${u.first_name} ${u.last_name}</span>
                </div>
            `).join('');

            modal.innerHTML = `
                <div class="modal-box" style="padding: 35px; border-radius: 35px; width: 100%; max-width: 650px; background: #1C1C1E; color: white; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 30px 60px rgba(0,0,0,0.5); max-height:90vh; overflow-y:auto;">
                    <h2 style="margin: 0 0 30px 0; font-size: 26px; font-weight:800; letter-spacing:-1px;">✨ Nouvelle Programmation</h2>
                    
                    <div style="margin-bottom: 25px;">
                        <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Message de la notification</label>
                        <textarea id="sch-message" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:18px; color:white; padding:18px; resize:none; height:100px; font-size:16px; outline:none;" placeholder="Ex: N'oubliez pas votre pointage KIZEO..."></textarea>
                    </div>

                    <div style="margin-bottom: 25px;">
                        <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">URL de l'application (Optionnel)</label>
                        <input type="text" id="sch-app-url" value="${localStorage.getItem('last_notif_app_url') || ''}" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:15px; font-size:15px; outline:none;" placeholder="Ex: kizeo:// ou https://...">
                        <p style="font-size: 11px; color: #555; margin-top: 5px;">Si renseignée, cliquer sur la notification ouvrira cette application.</p>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                        <div>
                            <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Destinataires</label>
                            <select id="sch-target-type" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:12px; font-size:15px; outline:none;" onchange="window.toggleSchUserBlock(this.value)">
                                <option value="all">🌍 Tous les collaborateurs ${secteur !== 'Tout' ? '(' + secteur + ')' : ''}</option>
                                <option value="specific">👤 Sélection spécifique</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Heure exacte d'envoi</label>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <select id="sch-hour" style="flex:1; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:12px; font-size:15px; outline:none;">
                                    ${Array.from({ length: 24 }, (_, i) => `<option value="${i}" ${i === 8 ? 'selected' : ''}>${i}h</option>`).join('')}
                                </select>
                                <span style="font-weight:800;">:</span>
                                <select id="sch-minute" style="flex:1; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:12px; font-size:15px; outline:none;">
                                    ${Array.from({ length: 60 }, (_, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${i.toString().padStart(2, '0')}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div id="sch-user-selector-block" style="display:none; margin-bottom: 25px;">
                        <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Collaborateurs ciblés</label>
                        <div id="sch-user-list" style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 18px; padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            ${userSelectionHTML}
                        </div>
                    </div>

                    <div style="margin-bottom: 30px;">
                        <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Fréquence</label>
                        <select id="sch-frequency" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:12px; font-size:15px; outline:none;" onchange="window.updateScheduleFields(this.value)">
                            <option value="daily">🔄 Chaque jour</option>
                            <option value="weekly">📅 Hebdomadaire (Jour Fixe)</option>
                            <option value="monthly">📆 Mensuel (Date Fixe)</option>
                            <option value="yearly">🎉 Annuel</option>
                        </select>
                    </div>

                    <div id="sch-day-week" style="display:none; margin-bottom: 25px;">
                        <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Jour de la semaine</label>
                        <select id="sch-val-day-week" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:12px; font-size:15px; outline:none;">
                            <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5" selected>Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
                        </select>
                    </div>

                    <div id="sch-day-month" style="display:none; margin-bottom: 25px;">
                        <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Jour du mois (1-31)</label>
                        <input type="number" id="sch-val-day-month" min="1" max="31" value="1" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:12px; font-size:15px; outline:none;">
                    </div>

                    <div id="sch-month" style="display:none; margin-bottom: 30px;">
                        <label style="display:block; margin-bottom:10px; font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Mois</label>
                        <select id="sch-val-month" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:white; padding:12px; font-size:15px; outline:none;">
                            <option value="1">Janvier</option><option value="2">Février</option><option value="3">Mars</option><option value="4">Avril</option><option value="5">Mai</option><option value="6">Juin</option><option value="7">Juillet</option><option value="8">Août</option><option value="9">Septembre</option><option value="10">Octobre</option><option value="11">Novembre</option><option value="12">Décembre</option>
                        </select>
                    </div>

                    <div style="display:flex; gap:15px; margin-top:10px;">
                        <button onclick="document.getElementById('modal-schedule').remove()" class="btn btn-secondary" style="flex:1; border-radius:18px; height:55px; background:rgba(255,255,255,0.05); border:none;">Annuler</button>
                        <button onclick="window.saveNewSchedule(this)" class="btn btn-primary" style="flex:1; background:#5856D6; border-color:#5856D6; border-radius:18px; height:55px; font-weight:800;">🚀 Créer le planning</button>
                    </div>
                </div>
                
                <style>
                    .sch-user-option.selected { border-color: #5856D6 !important; }
                    .sch-user-option.selected .check { opacity: 1 !important; }
                    select option { background: #2C2C2E; color: white; padding: 10px; }
                </style>
            `;
            document.body.appendChild(modal);

            window.toggleSchUserBlock = (val) => {
                const block = document.getElementById('sch-user-selector-block');
                block.style.display = val === 'specific' ? 'block' : 'none';
            };

            window.updateScheduleFields = (freq) => {
                document.getElementById('sch-day-week').style.display = freq === 'weekly' ? 'block' : 'none';
                document.getElementById('sch-day-month').style.display = (freq === 'monthly' || freq === 'yearly') ? 'block' : 'none';
                document.getElementById('sch-month').style.display = freq === 'yearly' ? 'block' : 'none';
            };

            window.saveNewSchedule = async (btn) => {
                const message = document.getElementById('sch-message').value.trim();
                const appUrl = document.getElementById('sch-app-url').value.trim();
                const targetType = document.getElementById('sch-target-type').value;
                const frequency = document.getElementById('sch-frequency').value;
                const hourVal = parseInt(document.getElementById('sch-hour').value);
                const minuteVal = parseInt(document.getElementById('sch-minute').value);

                const selectedUsers = Array.from(document.querySelectorAll('.sch-user-option.selected')).map(el => el.dataset.id);

                if (!message) return alert("Veuillez saisir un message.");
                if (targetType === 'specific' && selectedUsers.length === 0) return alert("Veuillez sélectionner au moins un collaborateur.");

                const payload = {
                    message,
                    target_type: targetType,
                    target_user_ids: targetType === 'specific' ? selectedUsers : null,
                    user_id: targetType === 'specific' && selectedUsers.length === 1 ? selectedUsers[0] : null,
                    app_url: appUrl || null,
                    frequency: frequency,
                    hour: hourVal,
                    minute: minuteVal,
                    day_of_week: frequency === 'weekly' ? parseInt(document.getElementById('sch-val-day-week').value) : null,
                    day_of_month: (frequency === 'monthly' || frequency === 'yearly') ? parseInt(document.getElementById('sch-val-day-month').value) : null,
                    month: frequency === 'yearly' ? parseInt(document.getElementById('sch-val-month').value) : null,
                    active: true,
                    secteur: window.currentUserProfile?.secteur || 'Tout'
                };

                btn.disabled = true;
                btn.innerText = "Création...";

                try {
                    await api.saveNotificationSchedule(payload);
                    if (appUrl) localStorage.setItem('last_notif_app_url', appUrl);
                    document.getElementById('modal-schedule').remove();
                    renderAdminNotifications();
                } catch (e) {
                    alert("Erreur: " + e.message);
                    btn.disabled = false;
                    btn.innerText = "🚀 Créer le planning";
                }
            };
        };

        window.deleteSchedule = (id) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); z-index:10001; display:flex; align-items:center; justify-content:center; padding:20px;";
            modal.innerHTML = `
                <div style="background:#1C1C1E; padding:35px; border-radius:30px; border:1px solid rgba(255,255,255,0.1); width:100%; max-width:400px; text-align:center; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <div style="font-size:50px; margin-bottom:20px;">🗑️</div>
                    <h3 style="margin:0 0 10px 0; font-size:20px; font-weight:800; color:white;">Supprimer ?</h3>
                    <p style="color:#888; font-size:14px; margin-bottom:30px; line-height:1.5;">Êtes-vous sûr de vouloir supprimer cette notification automatisée ? Cette action est irréversible.</p>
                    <div style="display:flex; gap:12px;">
                        <button onclick="this.closest('.modal-overlay').remove()" style="flex:1; padding:15px; border-radius:15px; border:none; background:rgba(255,255,255,0.05); color:white; font-weight:700; cursor:pointer; transition:0.2s;">Annuler</button>
                        <button id="confirm-delete-btn" style="flex:1; padding:15px; border-radius:15px; border:none; background:#FF3B30; color:white; font-weight:800; cursor:pointer; transition:0.2s;">Supprimer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#confirm-delete-btn').onclick = async () => {
                const btn = modal.querySelector('#confirm-delete-btn');
                btn.disabled = true;
                btn.innerText = "Suppression...";
                try {
                    await api.deleteNotificationSchedule(id);
                    modal.remove();
                    renderAdminNotifications();
                } catch (e) {
                    alert("Erreur: " + e.message);
                    btn.disabled = false;
                    btn.innerText = "Supprimer";
                }
            };
        };

        window.updateSelectedCount();

    } catch (e) {
        console.error("Render error", e);
        const list = document.getElementById('recipient-list');
        if (list) list.innerHTML = `<div style="padding: 20px; color: #FF3B30; text-align:center;">⚠️ Une erreur est survenue lors de l'affichage :<br><small>${e.message}</small></div>`;
    }
};

window.toggleAllRecipients = function () {
    const rows = document.querySelectorAll('.recipient-row');
    if (!rows.length) return;
    const allSelected = Array.from(rows).every(r => r.classList.contains('selected'));
    rows.forEach(r => r.classList.toggle('selected', !allSelected));
    window.updateSelectedCount();
};

window.updateSelectedCount = function () {
    const countEl = document.getElementById('selected-count');
    if (!countEl) return;

    const selected = document.querySelectorAll('.recipient-row.selected');
    countEl.innerText = `${selected.length} destinataire(s) sélectionné(s)`;

    // Styliser les checkboxes visuelles
    document.querySelectorAll('.recipient-row').forEach(r => {
        const check = r.querySelector('.check-mark');
        const box = r.querySelector('.checkbox-visual');
        if (check && box) {
            if (r.classList.contains('selected')) {
                check.style.opacity = '1';
                box.style.borderColor = 'var(--primary)';
            } else {
                check.style.opacity = '0';
                box.style.borderColor = 'rgba(255,255,255,0.2)';
            }
        }
    });
};

window.setNotifTemplate = function (text) {
    const textarea = document.getElementById('notif-message');
    if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input'));
    }
};

window.sendCustomNotification = async function () {
    const selectedRows = document.querySelectorAll('.recipient-row.selected');
    const message = document.getElementById('notif-message') ? document.getElementById('notif-message').value.trim() : "";
    const btn = document.getElementById('btn-send-notif');
    const status = document.getElementById('notif-status');

    if (!message) {
        showSuccessModal("⚠️ Veuillez saisir un message.");
        return;
    }

    if (selectedRows.length === 0) {
        if (!confirm("📢 Aucun collaborateur sélectionné. Voulez-vous envoyer ce message à TOUS les collaborateurs ?")) return;
    }

    const userIds = Array.from(selectedRows).map(r => r.dataset.userId);
    const payload = userIds.length > 0 ? { userIds, message } : { userId: 'all', message };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⌛ Envoi...";
    }

    try {
        const result = await api.sendNotification(userIds.length > 0 ? null : 'all', message, userIds.length > 0 ? userIds : null);

        if (result.success) {
            if (status) status.innerHTML = `<span style='color: #34C759; font-weight: 800;'>✅ Notification envoyée !</span>`;
            if (document.getElementById('notif-message')) document.getElementById('notif-message').value = "";

            selectedRows.forEach(r => r.classList.remove('selected'));
            window.updateSelectedCount();

            setTimeout(() => { if (status) status.innerHTML = ''; }, 5000);
        } else {
            if (status) status.innerHTML = `<span style='color: #FF3B30;'>⚠️ ${result.details || 'Échec'}</span>`;
        }
    } catch (e) {
        if (status) status.innerHTML = `<span style='color: #FF3B30;'>❌ ${e.message}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = "Envoyer le message";
        }
    }
};

window.saveAutoSettings = async () => {
    const autoPlanning = document.getElementById('auto-planning').checked;
    const autoMileage = document.getElementById('auto-mileage').checked;
    const autoDeadline = document.getElementById('auto-deadline').checked;
    const autoMaterial = document.getElementById('auto-material').checked;
    const autoMaintValidity = document.getElementById('auto-maint-validity').checked;
    const maintAlertDays = document.getElementById('maint-alert-days').value;

    const maintBadges = document.querySelectorAll('.admin-badge-select.active');
    const maintAlertUserIds = Array.from(maintBadges).map(b => b.dataset.userId);

    const payload = {
        auto_planning: autoPlanning,
        auto_mileage: autoMileage,
        auto_deadline: autoDeadline,
        auto_material: autoMaterial,
        auto_maint_validity: autoMaintValidity,
        maint_alert_days: parseInt(maintAlertDays),
        maint_alert_userIds: maintAlertUserIds
    };

    try {
        await api.saveNotificationConfig(payload);
    } catch (e) {
        console.error("Save config error", e);
    }
};

window.saveAdminAlertSettings = async () => {
    const selectedRows = document.querySelectorAll('.admin-alert-row.selected');
    const selectedIds = Array.from(selectedRows).map(el => el.dataset.adminId);
    const btn = document.querySelector('button[onclick="window.saveAdminAlertSettings()"]');

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerText = "⏳ Enregistrement...";
        }

        await api.saveMaterialConfig(selectedIds);

        if (btn) {
            btn.innerText = "✅ Enregistré";
            btn.style.background = "#34C759";
            btn.style.color = "white";
            btn.style.borderColor = "#34C759";

            showSuccessModal("Destinataires mis à jour avec succès !<br>Ils recevront désormais les alertes immédiates et les rappels hebdomadaires.");

            setTimeout(() => {
                btn.innerText = "Enregistrer les destinataires";
                btn.style.background = "";
                btn.style.color = "";
                btn.style.borderColor = "";
                btn.disabled = false;
            }, 3000);
        }
    } catch (e) {
        showSuccessModal(`❌ Erreur lors de l'enregistrement : ${e.message}`);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Enregistrer les destinataires";
        }
    }
};

window.triggerMaterialReminder = async () => {
    const btn = document.getElementById('btn-test-reminders');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⌛ Test en cours...";
    }

    try {
        const result = await api.sendMaterialReminders();
        if (result.success) {
            showSuccessModal(`✅ Test réussi !<br><br>Demandes trouvées : <b>${result.count}</b><br>Admins notifiés : <b>${result.notified}</b>`);
        } else {
            showSuccessModal(`⚠️ ${result.message || 'Aucune notification envoyée.'}`);
        }
    } catch (e) {
        showSuccessModal(`❌ Erreur lors du test : ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = "🔔 Tester les rappels de demandes (+7j)";
        }
    }
};

