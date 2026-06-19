import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminVehicles = async function () {
    window.adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-vehicles').classList.add('active');

    const content = document.getElementById('admin-content');
    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #007AFF, #0056b3); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0, 122, 255, 0.2);">
                        <span style="font-size: 28px;">🚐</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Flotte Automobile</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Gestion des véhicules et abonnements</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn-primary" onclick="openAddVehicleModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #34C759; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 18px;">+</span> Ajouter véhicule
                    </button>
                    <button class="btn-secondary" onclick="openDkvManagementModal()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px; color: #34C759; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 16px;">💳</span> DKV
                    </button>
                    <button class="btn-secondary" onclick="openTollManagementModal()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px; color: #007AFF; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 16px;">🛣️</span> Badges
                    </button>
                    <button onclick="window.renderAdminVehicles()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>
        <div id="admin-vehicle-list-wrapper">
            <div class="loader-spinner" style="margin: 50px auto;"></div>
        </div>
    `;

    try {
        const [allVehicles, users] = await Promise.all([
            api.getVehicles(),
            api.listUsers()
        ]);

        // Filtre secteur — véhicules affectés au secteur courant + non affectés.
        // 'Tout' affiche tout. Pour ajouter un secteur, aucun changement nécessaire ici.
        const vehSecteur = window.currentUserProfile?.secteur || 'AIA';
        const vehicles = vehSecteur === 'Tout'
            ? allVehicles
            : allVehicles.filter(v => !v.assigned_user_id || v.profiles?.secteur === vehSecteur);

        let html = `
            <div class="admin-table-container glass-panel" style="padding: 24px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Véhicule</th>
                            <th>Immatriculation</th>
                            <th>Kilométrage</th>
                            <th>Affectation</th>
                            <th>Entretien</th>
                            <th>Contrôle Tech.</th>
                            <th style="text-align: right; width: 170px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (vehicles.length === 0) {
            html += `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #888;">Aucun véhicule enregistré</td></tr>`;
        } else {
            vehicles.forEach(v => {
                const userName = v.profiles ? `${v.profiles.first_name} ${v.profiles.last_name}`.trim() : '<span style="color:#666">Non affecté</span>';

                // Alert logic
                let maintenanceAlert = false;
                let maintenanceCritical = false;
                let maintenanceLabel = "OK";

                if (v.next_maintenance_km) {
                    const diff = v.next_maintenance_km - v.last_mileage;
                    if (diff <= 0) { maintenanceCritical = true; maintenanceLabel = "Dépassé (km)"; }
                    else if (diff <= 2000) { maintenanceAlert = true; maintenanceLabel = "Bientôt (km)"; }
                }

                if (v.next_maintenance_date && !maintenanceCritical) {
                    const today = new Date();
                    const target = new Date(v.next_maintenance_date);
                    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 0) { maintenanceCritical = true; maintenanceLabel = "Dépassé (date)"; }
                    else if (diffDays <= 30) { maintenanceAlert = true; maintenanceLabel = "Bientôt (date)"; }
                }

                const maintenanceStyle = maintenanceCritical ? 'background: #FF3B30; color: white;' : (maintenanceAlert ? 'background: #FF9500; color: white;' : 'background: rgba(52, 199, 89, 0.1); color: #34C759;');
                const maintenanceIcon = maintenanceCritical ? '🔴' : (maintenanceAlert ? '⚠️' : '✅');

                // CT logic
                let ctAlert = false;
                let ctCritical = false;
                let ctLabel = "OK";
                const today = new Date();

                if (v.last_ct_date) {
                    const ctDate = new Date(v.last_ct_date);
                    const nextCt = new Date(ctDate);
                    nextCt.setMonth(nextCt.getMonth() + (v.ct_interval_months || 12));
                    const diffDays = Math.ceil((nextCt - today) / (1000 * 60 * 60 * 24));

                    if (diffDays <= 0) {
                        ctCritical = true;
                        ctLabel = "À faire !";
                    } else if (diffDays <= 60) {
                        ctAlert = true;
                        ctLabel = `Dans ${diffDays} j.`;
                    } else {
                        ctLabel = nextCt.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                    }
                } else {
                    ctAlert = true;
                    ctLabel = "Non renseigné";
                }

                const ctStyle = ctCritical ? 'background: #FF3B30; color: white;' : (ctAlert ? 'background: #FF9500; color: white;' : 'background: rgba(0, 122, 255, 0.1); color: #007AFF;');
                const ctIcon = ctCritical ? '🔴' : (ctAlert ? '⚠️' : '🛡️');

                html += `
                    <tr class="vehicle-row" style="cursor: pointer;" onclick="if(!event.target.closest('button')) openVehicleDetailModal('${v.id}')">
                        <td>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.05); border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1);">
                                    <img src="${config.api.workerUrl}/get/vehicles/photos/${v.id}.png?t=${Date.now()}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3202/3202926.png'; this.style.filter='invert(1)'; this.style.opacity='0.2';" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; color: white; font-size: 15px;">${v.make || ''} ${v.model || 'Inconnu'}</div>
                                </div>
                            </div>
                        </td>
                        <td><span style="background: #FFF; color: #000; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: 'JetBrains Mono', monospace; border: 2px solid #222; font-size: 13px; letter-spacing: 1px;">${v.plate_number}</span></td>
                        <td>
                            <div style="font-weight: 600; font-size: 15px;">${(v.last_mileage || 0).toLocaleString()} <span style="font-size: 12px; color: #666;">km</span></div>
                        </td>
                        <td><div style="color: #bbb; font-weight: 500;">${userName}</div></td>
                        <td>
                            <div style="${maintenanceStyle} padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                                <span>${maintenanceIcon}</span> ${maintenanceLabel}
                            </div>
                        </td>
                        <td>
                            <div style="${ctStyle} padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                                <span>${ctIcon}</span> ${ctLabel}
                            </div>
                        </td>
                        <td style="text-align: right;">
                            <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center;">
                                <button class="btn-sm btn-secondary" style="margin:0; padding: 8px 12px; border-radius: 10px; font-weight: 600;" onclick="openAddVehicleModal('${v.id}')">✏️ Modifier</button>
                                <button class="btn-sm" style="background: rgba(255, 59, 48, 0.15); color: #FF3B30; border: 1px solid rgba(255,59,48,0.2); padding: 8px 10px; border-radius: 10px; cursor: pointer; transition: 0.2s; height: 36px; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(255, 59, 48, 0.3)'" onmouseout="this.style.background='rgba(255, 59, 48, 0.15)'" onclick="deleteAdminVehicle('${v.id}')">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div>`;
        const wrapper = document.getElementById('admin-vehicle-list-wrapper');
        if (wrapper) wrapper.innerHTML = html;

        // Add hover effect style if missing
        if (!document.getElementById('vehicle-table-style')) {
            const style = document.createElement('style');
            style.id = 'vehicle-table-style';
            style.innerHTML = `
                .vehicle-row:hover { background: rgba(255,255,255,0.03); }
            `;
            document.head.appendChild(style);
        }

        // Global update badge for vehicles
        updateVehicleSidebarBadge(vehicles);

    } catch (e) {
        const wrapper = document.getElementById('admin-vehicle-list-wrapper');
        if (wrapper) wrapper.innerHTML = `<div style="color:red; padding:20px;">Erreur: ${e.message}</div>`;
        else content.innerHTML = `<div style="color:red; padding:20px;">Erreur: ${e.message}</div>`;
    }
};

window.openDkvManagementModal = async function () {
    const renderDkvList = async (container) => {
        try {
            const cards = await api.getDkvCards();
            if (cards.length === 0) {
                container.innerHTML = `<div style="text-align:center; color:#888; padding:20px;">Aucune carte enregistrée</div>`;
                return;
            }
            container.innerHTML = cards.map(c => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid #333; border-radius: 12px; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 700; color: white;">${c.card_number}</div>
                        <div style="font-size: 11px; color: #888;">${c.description || 'Pas de description'}</div>
                    </div>
                    <button onclick="handleDeleteDkvCard('${c.id}')" style="background:none; border:none; color:#FF3B30; cursor:pointer; font-size:18px;">🗑️</button>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Erreur lors du chargement: ${e.message}</div>`;
        }
    };

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '100010';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 450px; padding: 32px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
                <h2 style="margin:0;">💳 Cartes DKV</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
            </div>

            <div style="margin-bottom: 24px; border-bottom: 1px solid #333; padding-bottom: 20px;">
                <h4 style="margin:0 0 12px 0; color:#34C759;">Ajouter une carte</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                    <input type="text" id="new-dkv-number" class="form-input" placeholder="N° de carte">
                    <input type="text" id="new-dkv-desc" class="form-input" placeholder="Description">
                </div>
                <button class="btn-primary" style="width:100%; height:40px; padding:0; background:#34C759;" onclick="handleAddDkvCard()">Ajouter la carte</button>
            </div>

            <div id="dkv-list-container" style="max-height:300px; overflow-y:auto;">
                <div class="loader-spinner" style="margin:20px auto;"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const listContainer = document.getElementById('dkv-list-container');
    renderDkvList(listContainer);

    window.handleAddDkvCard = async () => {
        const cardNumber = document.getElementById('new-dkv-number').value.trim();
        const description = document.getElementById('new-dkv-desc').value.trim();
        if (!cardNumber) return alert("N° de carte obligatoire");

        try {
            await api.saveDkvCard({ card_number: cardNumber, description });
            document.getElementById('new-dkv-number').value = '';
            document.getElementById('new-dkv-desc').value = '';
            renderDkvList(listContainer);
        } catch (e) { alert(e.message); }
    };

    window.handleDeleteDkvCard = async (id) => {
        if (!confirm("Supprimer cette carte ?")) return;
        try {
            await api.deleteDkvCard(id);
            renderDkvList(listContainer);
        } catch (e) { alert(e.message); }
    };
};

window.openTollManagementModal = async function () {
    const renderTollList = async (container) => {
        try {
            const cards = await api.getTollCards();
            if (cards.length === 0) {
                container.innerHTML = `<div style="text-align:center; color:#888; padding:20px;">Aucun badge enregistré</div>`;
                return;
            }
            container.innerHTML = cards.map(c => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid #333; border-radius: 12px; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 700; color: white;">${c.card_number}</div>
                        <div style="font-size: 11px; color: #888;">${c.description || 'Pas de description'}</div>
                    </div>
                    <button onclick="handleDeleteTollCard('${c.id}')" style="background:none; border:none; color:#FF3B30; cursor:pointer; font-size:18px;">🗑️</button>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Erreur lors du chargement: ${e.message}</div>`;
        }
    };

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '100011';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 450px; padding: 32px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
                <h2 style="margin:0;">🛣️ Badges Télépéage</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
            </div>

            <div style="margin-bottom: 24px; border-bottom: 1px solid #333; padding-bottom: 20px;">
                <h4 style="margin:0 0 12px 0; color:#007AFF;">Ajouter un badge</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                    <input type="text" id="new-toll-number" class="form-input" placeholder="N° de badge">
                    <input type="text" id="new-toll-desc" class="form-input" placeholder="Description">
                </div>
                <button class="btn-primary" style="width:100%; height:40px; padding:0; background:#007AFF;" onclick="handleAddTollCard()">Ajouter le badge</button>
            </div>

            <div id="toll-list-container" style="max-height:300px; overflow-y:auto;">
                <div class="loader-spinner" style="margin:20px auto;"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const listContainer = document.getElementById('toll-list-container');
    renderTollList(listContainer);

    window.handleAddTollCard = async () => {
        const cardNumber = document.getElementById('new-toll-number').value.trim();
        const description = document.getElementById('new-toll-desc').value.trim();
        if (!cardNumber) return alert("N° de badge obligatoire");

        try {
            await api.saveTollCard({ card_number: cardNumber, description });
            document.getElementById('new-toll-number').value = '';
            document.getElementById('new-toll-desc').value = '';
            renderTollList(listContainer);
        } catch (e) { alert(e.message); }
    };

    window.handleDeleteTollCard = async (id) => {
        if (!confirm("Supprimer ce badge ?")) return;
        try {
            await api.deleteTollCard(id);
            renderTollList(listContainer);
        } catch (e) { alert(e.message); }
    };
};

window.openAddVehicleModal = async function (vehicleId = null) {
    try {
        const [allUsers, dkvCards, tollCards] = await Promise.all([
            api.listUsers(),
            api.getDkvCards(),
            api.getTollCards()
        ]);
        const vehModalSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = vehModalSecteur === 'Tout' ? allUsers : allUsers.filter(u => u.secteur === vehModalSecteur);
        users.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

        let existing = null;
        if (vehicleId) {
            const vehicles = await api.getVehicles();
            existing = vehicles.find(v => v.id === vehicleId);
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '100009';

        modal.innerHTML = `
            <div class="modal-box glass-panel" style="width: 500px; padding: 32px; animation: modalPop 0.3s ease-out;">
                <h2 style="margin-top: 0; margin-bottom: 24px;">${existing ? 'Modifier le véhicule' : 'Ajouter un véhicule'}</h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label">Marque</label>
                        <input type="text" id="v-make" class="form-input" value="${existing?.make || ''}" placeholder="Ex: Renault">
                    </div>
                    <div>
                        <label class="form-label">Modèle</label>
                        <input type="text" id="v-model" class="form-input" value="${existing?.model || ''}" placeholder="Ex: Master">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div>
                        <label class="form-label">Immatriculation</label>
                        <input type="text" id="v-plate" class="form-input" value="${existing?.plate_number || ''}" placeholder="Ex: AB-123-CD">
                    </div>
                    <div>
                        <label class="form-label">Collaborateur affecté</label>
                        <select id="v-user" class="form-input">
                            <option value="">-- Sans propriétaire (Véhicule Commun) --</option>
                            ${users.map(u => `<option value="${u.id}" ${existing?.assigned_user_id === u.id ? 'selected' : ''}>${u.first_name || ''} ${u.last_name || ''}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div>
                        <label class="form-label">Carte DKV / Essence</label>
                        <select id="v-dkv" class="form-input">
                            <option value="">-- Aucune --</option>
                            ${dkvCards.map(c => `<option value="${c.card_number}" ${existing?.dkv_card === c.card_number ? 'selected' : ''}>${c.card_number} (${c.description || 'DKV'})</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Badge Télépéage</label>
                        <select id="v-toll" class="form-input">
                            <option value="">-- Aucun --</option>
                            ${tollCards.map(c => `<option value="${c.card_number}" ${existing?.toll_card === c.card_number ? 'selected' : ''}>${c.card_number} (${c.description || 'Badge'})</option>`).join('')}
                        </select>
                    </div>
                </div>

                <h3 style="font-size: 14px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 16px;">Planification Entretien</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div>
                        <label class="form-label">Prochain entretien (km)</label>
                        <input type="number" id="v-m-km" class="form-input" value="${existing?.next_maintenance_km || ''}" placeholder="Ex: 50000">
                    </div>
                    <div>
                        <label class="form-label">Date limite entretien</label>
                        <input type="date" id="v-m-date" class="form-input" value="${existing?.next_maintenance_date || ''}">
                    </div>
                </div>

                <h3 style="font-size: 14px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 16px;">Contrôle Technique</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                    <div>
                        <label class="form-label">Dernier CT (date)</label>
                        <input type="date" id="v-ct-date" class="form-input" value="${existing?.last_ct_date || ''}">
                    </div>
                    <div>
                        <label class="form-label">Fréquence (mois)</label>
                        <input type="number" id="v-ct-interval" class="form-input" value="${existing?.ct_interval_months || 12}" placeholder="Ex: 12">
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <label class="form-label">Photo du véhicule (PNG recommandé)</label>
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div id="v-photo-preview" style="width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <img src="${existing ? `${config.api.workerUrl}/get/vehicles/photos/${existing.id}.png?t=${Date.now()}` : ''}" onerror="this.style.display='none'" onload="this.style.display='block'" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <input type="file" id="v-photo" accept="image/png, image/jpeg" class="form-input" style="flex: 1;" onchange="const reader = new FileReader(); reader.onload = (e) => { const img = document.querySelector('#v-photo-preview img'); img.src = e.target.result; img.style.display='block'; }; reader.readAsDataURL(this.files[0])">
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                    <button id="save-v-btn" class="btn-primary" style="padding: 10px 24px;">🚀 Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('save-v-btn').onclick = async () => {
            const data = {
                id: vehicleId,
                make: document.getElementById('v-make').value,
                model: document.getElementById('v-model').value,
                plate_number: document.getElementById('v-plate').value,
                assigned_user_id: document.getElementById('v-user').value || null,
                dkv_card: document.getElementById('v-dkv').value,
                toll_card: document.getElementById('v-toll').value,
                next_maintenance_km: document.getElementById('v-m-km').value ? parseInt(document.getElementById('v-m-km').value) : null,
                next_maintenance_date: document.getElementById('v-m-date').value || null,
                last_ct_date: document.getElementById('v-ct-date').value || null,
                ct_interval_months: document.getElementById('v-ct-interval').value ? parseInt(document.getElementById('v-ct-interval').value) : 12
            };

            if (!data.plate_number) return alert("L'immatriculation est obligatoire.");

            document.getElementById('save-v-btn').disabled = true;
            document.getElementById('save-v-btn').innerText = "Enregistrement...";

            try {
                const savedVehicle = await api.saveVehicle(data);

                // Photo upload
                const photoInput = document.getElementById('v-photo');
                if (photoInput.files.length > 0) {
                    await api.uploadVehiclePhoto(savedVehicle.id, photoInput.files[0]);
                }

                modal.remove();
                renderAdminVehicles();
            } catch (e) {
                alert("Erreur: " + e.message);
                document.getElementById('save-v-btn').disabled = false;
                document.getElementById('save-v-btn').innerText = "🚀 Enregistrer";
            }
        };

    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.deleteAdminVehicle = async function (id) {
    if (!confirm("Voulez-vous vraiment supprimer ce véhicule ?")) return;
    try {
        await api.deleteVehicle(id);
        renderAdminVehicles();
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

// Global badge update for admin sidebar (Material Orders)
window.updateMaterialBadge = async function () {
    await window.updateAllBadges();
};

// Global badge update for admin sidebar (Material Stock Modifications)
window.updateMaterialStockBadge = async function () {
    await window.updateAllBadges();
};

// --- MOBILE VEHICLES LIST ---
window.updateVehicleSidebarBadge = function (vehicles) {
    // Filtre par secteur — les véhicules non affectés sont visibles partout
    const vBadgeSecteur = window.currentUserProfile?.secteur;
    const sectorVehicles = (!vBadgeSecteur || vBadgeSecteur === 'Tout')
        ? vehicles
        : vehicles.filter(v => !v.assigned_user_id || v.profiles?.secteur === vBadgeSecteur);

    let alertCount = 0;
    const today = new Date();

    sectorVehicles.forEach(v => {
        let isAlert = false;
        if (v.next_maintenance_km && (v.next_maintenance_km - v.last_mileage <= 2000)) isAlert = true;
        if (v.next_maintenance_date) {
            const target = new Date(v.next_maintenance_date);
            const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) isAlert = true;
        }

        // CT Alert
        if (!v.last_ct_date) {
            isAlert = true;
        } else {
            const nextCt = new Date(v.last_ct_date);
            nextCt.setMonth(nextCt.getMonth() + (v.ct_interval_months || 12));
            const diffDays = Math.ceil((nextCt - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 60) isAlert = true;
        }

        if (isAlert) alertCount++;
    });

    const badge = document.getElementById('vehicle-badge');
    if (badge) {
        if (alertCount > 0) {
            badge.textContent = alertCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
};

window.openVehicleDetailModal = async function (vehicleId) {
    try {
        const [vehicles, logs] = await Promise.all([
            api.getVehicles(),
            api.getVehicleAllLogs(vehicleId)
        ]);
        const v = vehicles.find(veh => veh.id === vehicleId);
        if (!v) return;

        const existing = document.getElementById('vehicle-detail-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'vehicle-detail-modal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '100010';

        modal.innerHTML = `
            <div class="modal-box" style="width: 1150px; max-width: 95vw; padding: 0; overflow: hidden; display: flex; flex-direction: column; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
                <!-- Header -->
                <div style="padding: 32px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; font-weight: 700;">Administration de flotte</div>
                        <h2 style="margin: 0; font-size: 28px; font-weight: 800; color: #1a1a1c;">
                            ${v.make || ''} ${v.model || 'Inconnu'} 
                            <span style="background: #000; color: #fff; padding: 4px 12px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 18px; margin-left: 12px; vertical-align: middle;">${v.plate_number}</span>
                        </h2>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap: wrap;">
                        <button class="btn-primary" onclick="updateAdminVehicleMileage('${v.id}', ${v.last_mileage || 0})" style="padding: 10px 18px; border-radius: 12px; background: #5AC8FA; color: #fff; border: none; font-weight: 700; display: flex; align-items: center; gap: 8px;">📍 Mise à jour KM</button>
                        <button class="btn-primary" onclick="logAdminVehicleFuel('${v.id}', '${v.dkv_card || ''}')" style="padding: 10px 18px; border-radius: 12px; background: #FF9500; color: #fff; border: none; font-weight: 700; display: flex; align-items: center; gap: 8px;">⛽ Saisie Essence</button>
                        <button class="btn-primary" onclick="openAddVehicleEventModal('${v.id}')" style="padding: 10px 18px; border-radius: 12px; background: #2da140; color: #fff; border: none; font-weight: 700;">➕ Ajouter événement</button>
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 18px; border-radius: 12px; background: #eee; color: #333; border: none; font-weight: 700;">Fermer</button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 320px 1fr; height: 600px;">
                    <!-- Left Column: Info -->
                    <div style="padding: 32px; background: #ffffff; border-right: 1px solid #eee; overflow-y: auto;">
                        <!-- Vehicle Image -->
                        <div style="width: 100%; height: 180px; background: #f8f9fa; border-radius: 20px; overflow: hidden; margin-bottom: 24px; border: 1px solid #eee; display: flex; align-items: center; justify-content: center;">
                            <img src="${config.api.workerUrl}/get/vehicles/photos/${v.id}.png?t=${Date.now()}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3202/3202926.png'; this.style.opacity='0.1'; this.style.width='64px'; this.style.height='64px';" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>

                        <h3 style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 1px; font-weight: 700;">Cartes & Badges</h3>
                        <div style="padding: 20px; border-radius: 20px; margin-bottom: 32px; background: #f8f9fa; border: 1px solid #f1f3f5;">
                            <div style="margin-bottom: 16px;">
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Carte DKV / Essence</div>
                                <div style="font-family: 'JetBrains Mono', monospace; font-size: 15px; color: #1a1a1c; font-weight: 700;">${v.dkv_card || '<span style="color:#ccc; font-weight:400;">Non renseigné</span>'}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Badge Télépéage</div>
                                <div style="font-family: 'JetBrains Mono', monospace; font-size: 15px; color: #1a1a1c; font-weight: 700;">${v.toll_card || '<span style="color:#ccc; font-weight:400;">Non renseigné</span>'}</div>
                            </div>
                        </div>

                        <h3 style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 1px; font-weight: 700;">Entretien Prévu</h3>
                        <div style="padding: 20px; border-radius: 20px; margin-bottom: 16px; background: #fff; border: 1px solid #eee; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="margin-bottom: 16px;">
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Échéance Kilométrique</div>
                                <div style="font-size: 20px; font-weight: 900; color: #34C759;">${v.next_maintenance_km ? v.next_maintenance_km.toLocaleString() + ' km' : '--'}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Échéance Date</div>
                                <div style="font-size: 20px; font-weight: 900; color: #FF9500;">${v.next_maintenance_date ? new Date(v.next_maintenance_date).toLocaleDateString() : '--'}</div>
                            </div>
                        </div>

                        <h3 style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 1px; font-weight: 700;">Contrôle Technique</h3>
                        <div style="padding: 20px; border-radius: 20px; margin-bottom: 32px; background: #fff; border: 1px solid #eee; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="margin-bottom: 16px;">
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Dernier CT</div>
                                <div style="font-size: 18px; font-weight: 800; color: #1a1a1c;">${v.last_ct_date ? new Date(v.last_ct_date).toLocaleDateString() : 'N/A'}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Prochain CT (est.)</div>
                                <div style="font-size: 18px; font-weight: 800; color: #5856D6;">
                                    ${(() => {
                if (!v.last_ct_date) return '--';
                const next = new Date(v.last_ct_date);
                next.setMonth(next.getMonth() + (v.ct_interval_months || 12));
                return next.toLocaleDateString();
            })()}
                                </div>
                            </div>
                        </div>

                        <h3 style="font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 1px; font-weight: 700;">Historique</h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${logs.slice(0, 5).map(l => `
                                <div style="font-size: 12px; padding: 12px; border-radius: 14px; background: #f8f9fa; border: 1px solid #f1f3f5; position: relative;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding-right: 20px;">
                                        <div>
                                            <span style="font-weight: 800; color: ${l.type === 'issue' ? '#FF3B30' : (l.type === 'event' ? '#007AFF' : '#495057')}; font-size: 10px;">${l.type.toUpperCase()}</span>
                                            <span style="color: #adb5bd; font-size: 10px; font-weight:700; margin-left: 8px;">${new Date(l.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button onclick="handleDeleteVehicleLog('${l.id}', '${vehicleId}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ff3b30; cursor: pointer; font-size: 16px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.5; font-weight: 900;" title="Supprimer">&times;</button>
                                    <div style="color: #212529; font-weight: 500; word-break: break-word; padding-right: 20px;">
                                        ${l.type === 'mileage' ? '<b>' + l.value + '</b> km' : l.description}
                                        ${l.image_path ? `<br><a href="${config.api.workerUrl}/get/${l.image_path}" target="_blank" style="color:var(--primary); font-size:10px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; margin-top:5px; font-weight:700;">📎 Voir pièce jointe</a>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Right Column: Charts & Stats -->
                    <div style="padding: 32px; display: flex; flex-direction: column; gap: 20px; overflow: hidden; background: #fcfcfd;">
                        
                        <!-- Tab Switcher -->
                        <div style="display: flex; background: #f0f0f0; padding: 4px; border-radius: 14px; width: fit-content;">
                            <button id="tab-mil" onclick="window.switchVehicleView('mileage')" style="border: none; background: #fff; padding: 8px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; color: #1a1a1c; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: 0.2s;">📍 Kilométrage</button>
                            <button id="tab-fue" onclick="window.switchVehicleView('fuel')" style="border: none; background: transparent; padding: 8px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; color: #888; transition: 0.2s;">⛽ Essence</button>
                        </div>

                        <!-- View Container -->
                        <div id="vehicle-tabs-container" style="flex: 1; display: flex; flex-direction: column;">
                            
                            <!-- Mileage View -->
                            <div id="view-mileage" style="flex: 1; display: flex; flex-direction: column; gap: 20px;">
                                <div style="flex: 1; background: #ffffff; border-radius: 24px; padding: 24px; border: 1px solid #eee; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; min-height: 0;">
                                    <h3 style="margin-top: 0; font-size: 16px; color: #1a1a1c; font-weight: 800; margin-bottom: 24px;">📈 Historique du compteur</h3>
                                    <div style="flex: 1; position: relative;"><canvas id="mileageChart"></canvas></div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div style="padding: 20px; border-radius: 20px; background: #fff; border: 1px solid #eee;">
                                        <div style="font-size: 10px; color: #888; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Dernière Activité</div>
                                        <div style="font-size: 16px; font-weight: 800;">${v.profiles ? v.profiles.first_name + ' ' + v.profiles.last_name : 'N/A'}</div>
                                    </div>
                                    <div style="padding: 20px; border-radius: 20px; background: #fff; border: 1px solid #eee;">
                                        <div style="font-size: 10px; color: #888; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Compteur Actuel</div>
                                        <div style="font-size: 22px; font-weight: 900; color: #34C759;">${(v.last_mileage || 0).toLocaleString()} km</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Fuel View (Hidden by default) -->
                            <div id="view-fuel" style="flex: 1; display: none; flex-direction: column; gap: 20px;">
                                <div id="fuel-stats-grid-tabs" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;"></div>
                                <div style="flex: 1; background: #ffffff; border-radius: 24px; padding: 24px; border: 1px solid #eee; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; min-height: 0;">
                                    <h3 style="margin-top: 0; font-size: 16px; color: #007AFF; font-weight: 800; margin-bottom: 24px;">⛽ Évolution des Coûts (€)</h3>
                                    <div style="flex: 1; position: relative;"><canvas id="fuelChart"></canvas></div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // --- Data Processing ---
        const fuelLogs = logs.filter(l => l.type === 'fuel').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const mileageLogs = logs.filter(l => l.type === 'mileage').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        let totalEuro = 0, totalLiters = 0, avgCons = 0, totalPersonalEuro = 0;
        const fuelDataPoints = fuelLogs.map(l => {
            const match = l.description.match(/Plein : ([\d.]+) L pour ([\d.]+) € à ([\d.]+) km/);
            if (match) {
                const [_, vol, eur, kms] = match;
                const cost = parseFloat(eur);
                totalEuro += cost;
                totalLiters += parseFloat(vol);
                if (l.is_personal) {
                    totalPersonalEuro += cost;
                }
                return { date: l.created_at, vol: parseFloat(vol), eur: cost, kms: parseFloat(kms) };
            }
            return null;
        }).filter(d => d !== null);

        if (fuelDataPoints.length >= 2) {
            const totalKm = fuelDataPoints[fuelDataPoints.length - 1].kms - fuelDataPoints[0].kms;
            const litersForPeriod = fuelDataPoints.slice(1).reduce((sum, d) => sum + d.vol, 0);
            if (totalKm > 0) avgCons = (litersForPeriod / totalKm) * 100;
        }

        // --- View Switching Logic ---
        window.switchVehicleView = (view) => {
            const vMil = document.getElementById('view-mileage');
            const vFue = document.getElementById('view-fuel');
            const tMil = document.getElementById('tab-mil');
            const tFue = document.getElementById('tab-fue');

            if (view === 'mileage') {
                vMil.style.display = 'flex'; vFue.style.display = 'none';
                tMil.style.background = '#fff'; tMil.style.color = '#1a1a1c'; tMil.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                tFue.style.background = 'transparent'; tFue.style.color = '#888'; tFue.style.boxShadow = 'none';
            } else {
                vMil.style.display = 'none'; vFue.style.display = 'flex';
                tFue.style.background = '#fff'; tFue.style.color = '#007AFF'; tFue.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                tMil.style.background = 'transparent'; tMil.style.color = '#888'; tMil.style.boxShadow = 'none';

                // Init Fuel Stats if in fuel view
                document.getElementById('fuel-stats-grid-tabs').innerHTML = `
                    <div style="background: rgba(52, 199, 89, 0.05); padding: 8px; border-radius: 16px; border: 1px solid rgba(52,199,89,0.1); text-align: center;">
                        <div style="font-size: 8px; color: #34C759; font-weight: 800; text-transform: uppercase;">Conso.</div>
                        <div style="font-size: 13px; font-weight: 900;">${avgCons > 0 ? avgCons.toFixed(1) : '--'}</div>
                    </div>
                    <div style="background: rgba(0, 122, 255, 0.05); padding: 8px; border-radius: 16px; border: 1px solid rgba(0,122,255,0.1); text-align: center;">
                        <div style="font-size: 8px; color: #007AFF; font-weight: 800; text-transform: uppercase;">Budget T.</div>
                        <div style="font-size: 13px; font-weight: 900;">${totalEuro.toLocaleString()}€</div>
                    </div>
                    <div style="background: rgba(255, 59, 48, 0.05); padding: 8px; border-radius: 16px; border: 1px solid rgba(255,59,48,0.1); text-align: center;">
                        <div style="font-size: 8px; color: #FF3B30; font-weight: 800; text-transform: uppercase;">Perso</div>
                        <div style="font-size: 13px; font-weight: 900;">${totalPersonalEuro.toLocaleString()}€</div>
                    </div>
                    <div style="background: rgba(255, 149, 0, 0.05); padding: 8px; border-radius: 16px; border: 1px solid rgba(255,149,0,0.1); text-align: center;">
                        <div style="font-size: 8px; color: #FF9500; font-weight: 800; text-transform: uppercase;">Volume</div>
                        <div style="font-size: 13px; font-weight: 900;">${totalLiters.toLocaleString()}L</div>
                    </div>
                `;
            }
        };

        // --- Initial Charts ---
        // 1. Mileage
        new Chart(document.getElementById('mileageChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: mileageLogs.map(l => new Date(l.created_at).toLocaleDateString()),
                datasets: [{
                    label: 'Compteur',
                    data: mileageLogs.map(l => parseInt(l.value)),
                    borderColor: '#34C759',
                    backgroundColor: 'rgba(52, 199, 89, 0.05)',
                    borderWidth: 3, fill: true, tension: 0.4,
                    pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#34C759'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // 2. Fuel
        new Chart(document.getElementById('fuelChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: fuelDataPoints.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Coût (€)',
                    data: fuelDataPoints.map(d => d.eur),
                    backgroundColor: 'rgba(0, 122, 255, 0.2)',
                    borderColor: '#007AFF',
                    borderWidth: 2, borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

// Start
// Event Modal for Vehicle
window.openAddVehicleEventModal = function (vehicleId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '100020';
    modal.innerHTML = `
        <div class="modal-box" style="width: 450px; background: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#1a1a1c; font-weight:800; font-size:20px;">Nouvel événement</h3>
            <div style="display:flex; flex-direction:column; gap:18px; margin-top:20px;">
                <div>
                    <label style="display:block; font-size:12px; color:#888; margin-bottom:6px; font-weight:700; text-transform:uppercase;">Date de l'événement</label>
                    <input type="date" id="event-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" style="width:100%; padding:12px; border-radius:10px; border:1px solid #ddd;">
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:#888; margin-bottom:6px; font-weight:700; text-transform:uppercase;">Nom / Description</label>
                    <input type="text" id="event-desc" class="form-control" placeholder="Ex: Facture révision, Contrôle technique..." style="width:100%; padding:12px; border-radius:10px; border:1px solid #ddd;">
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:#888; margin-bottom:6px; font-weight:700; text-transform:uppercase;">Pièce jointe (PDF, Image...)</label>
                    <input type="file" id="event-file" class="form-control" style="width:100%; padding:10px; border:1px dashed #ccc; border-radius:10px; background:#fcfcfd;">
                </div>
                
                <div style="display:flex; gap:12px; margin-top:10px;">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex:1; padding:12px; border-radius:12px; border:none; background:#eee; color:#333; font-weight:700;">Annuler</button>
                    <button class="btn-primary" id="save-event-btn" style="flex:2; padding:12px; border-radius:12px; border:none; background:#2da140; color:#fff; font-weight:700;">Enregistrer l'événement</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const saveBtn = modal.querySelector('#save-event-btn');
    saveBtn.onclick = async () => {
        const dateStr = modal.querySelector('#event-date').value;
        const desc = modal.querySelector('#event-desc').value;
        const fileInput = modal.querySelector('#event-file');

        if (!desc) return alert("Veuillez saisir une description");

        saveBtn.disabled = true;
        saveBtn.innerText = "Téléchargement en cours...";

        try {
            let filePath = null;
            if (fileInput.files.length > 0) {
                const uploadRes = await api.uploadFile(fileInput.files[0], 'fleet/events/');
                filePath = uploadRes.key;
            }

            saveBtn.innerText = "Enregistrement...";
            await api.submitVehicleLog({
                vehicle_id: vehicleId,
                type: 'event',
                description: desc,
                event_date: dateStr ? (new Date(dateStr + 'T12:00:00')).toISOString() : new Date().toISOString(),
                image_path: filePath
            });

            modal.remove();
            await window.openVehicleDetailModal(vehicleId);
        } catch (e) {
            console.error(e);
            alert("Erreur: " + e.message);
            saveBtn.disabled = false;
            saveBtn.innerText = "Enregistrer l'événement";
        }
    };
};

window.handleDeleteVehicleLog = async function (id, vehicleId) {
    try {
        await api.deleteVehicleLog(id);
        await window.openVehicleDetailModal(vehicleId);
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.updateAdminVehicleMileage = function (vehicleId, current) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "100050";
    modal.innerHTML = `
        <div class="modal-box" style="padding: 30px; border-radius: 24px; background: #fff; width: 400px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <h2 style="margin-top: 0; margin-bottom: 20px; color: #1c1c1e; font-size: 20px;">Mise à jour du compteur (Admin)</h2>
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 13px; color: #8E8E93; margin-bottom: 8px; font-weight: 700; text-transform: uppercase;">Nouveau kilométrage</label>
                <input type="number" id="admin-mileage-input" style="width: 100%; padding: 15px; border: 1px solid #ddd; border-radius: 12px; font-size: 18px; font-weight: 800;" value="${current || 0}">
                <p style="font-size: 11px; color: #8E8E93; margin-top: 8px;">Dernier relevé enregistré : <b>${current || 0} km</b></p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="admin-save-mileage-btn" class="btn-primary" style="flex: 1; background: #5AC8FA;">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('admin-mileage-input');
    input.focus();
    input.select();

    document.getElementById('admin-save-mileage-btn').onclick = async () => {
        const val = parseInt(input.value);
        if (isNaN(val)) return alert("Veuillez entrer un nombre valide.");

        const btn = document.getElementById('admin-save-mileage-btn');
        btn.disabled = true;
        btn.innerText = "Enregistrement...";

        try {
            await api.submitVehicleLog({ vehicle_id: vehicleId, type: 'mileage', value: val.toString() });
            modal.remove();
            await window.openVehicleDetailModal(vehicleId);
        } catch (e) {
            alert("Erreur: " + e.message);
            btn.disabled = false;
            btn.innerText = "Enregistrer";
        }
    };
};

window.logAdminVehicleFuel = async function (vehicleId, dkvCard) {
    let allCards = [];
    try { allCards = await api.getDkvCards(); } catch (e) { }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "100050";
    modal.innerHTML = `
        <div class="modal-box" style="padding: 30px; border-radius: 24px; background: #fff; width: 450px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <h2 style="margin-top: 0; margin-bottom: 20px; color: #1c1c1e; font-size: 20px;">Saisie d'un plein (Admin)</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #8E8E93; margin-bottom: 6px; font-weight:700; text-transform:uppercase;">Carte DKV utilisée</label>
                <select id="admin-fuel-dkv" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 12px; font-size: 15px; font-weight: 700;">
                    ${dkvCard ? `<option value="${dkvCard}">Carte du véhicule (${dkvCard})</option>` : ''}
                    <option value="">-- Autre carte --</option>
                    ${allCards.map(c => `<option value="${c.card_number}" ${dkvCard === c.card_number ? 'disabled' : ''}>${c.card_number} (${c.description || 'DKV'})</option>`).join('')}
                </select>
            </div>

            <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="admin-fuel-is-personal" style="width: 18px; height: 18px; accent-color: #34C759; cursor: pointer;">
                <label for="admin-fuel-is-personal" style="font-size: 13px; color: #1c1c1e; font-weight: bold; cursor: pointer;">Plein effectué avec ma carte perso</label>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div>
                    <label style="display: block; font-size: 12px; color: #8E8E93; margin-bottom: 6px; font-weight:700; text-transform:uppercase;">Volume (L)</label>
                    <input type="number" id="admin-fuel-volume" step="0.01" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 12px; font-size: 16px; font-weight: 700;" placeholder="ex: 45.5">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #8E8E93; margin-bottom: 6px; font-weight:700; text-transform:uppercase;">Montant (€)</label>
                    <input type="number" id="admin-fuel-amount" step="0.01" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 12px; font-size: 16px; font-weight: 700;" placeholder="ex: 85.20">
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 12px; color: #8E8E93; margin-bottom: 6px; font-weight:700; text-transform:uppercase;">Compteur à la saisie</label>
                <input type="number" id="admin-fuel-km" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 12px; font-size: 16px; font-weight: 700;" placeholder="Kilométrage actuel">
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="admin-save-fuel-btn" class="btn-primary" style="flex: 1; background: #FF9500;">Valider Plein</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const checkbox = document.getElementById('admin-fuel-is-personal');
    const dkvSelect = document.getElementById('admin-fuel-dkv');
    checkbox.onchange = () => {
        if (checkbox.checked) {
            dkvSelect.disabled = true;
            dkvSelect.style.opacity = '0.5';
        } else {
            dkvSelect.disabled = false;
            dkvSelect.style.opacity = '1';
        }
    };

    document.getElementById('admin-fuel-volume').focus();

    document.getElementById('admin-save-fuel-btn').onclick = async () => {
        const volume = document.getElementById('admin-fuel-volume').value;
        const amount = document.getElementById('admin-fuel-amount').value;
        const km = document.getElementById('admin-fuel-km').value;
        const usedDkv = dkvSelect.value;
        const isPersonal = checkbox.checked;

        if (!volume || !amount || !km || (!isPersonal && !usedDkv)) return alert("Veuillez remplir tous les champs.");

        const btn = document.getElementById('admin-save-fuel-btn');
        btn.disabled = true;
        btn.innerText = "Envoi...";

        const cardLabel = isPersonal ? 'Carte Perso' : usedDkv;
        const description = `Plein : ${volume} L pour ${amount} € à ${km} km (Carte : ${cardLabel})`;

        try {
            await api.submitVehicleLog({
                vehicle_id: vehicleId,
                type: 'fuel',
                value: amount,
                description: description,
                current_mileage: km,
                is_personal: isPersonal
            });
            modal.remove();
            await window.openVehicleDetailModal(vehicleId);
        } catch (e) {
            alert("Erreur: " + e.message);
            btn.disabled = false;
            btn.innerText = "Valider Plein";
        }
    };
};

// --- GESTION DU PARC : MAINTENANCE MATERIEL ---
window.renderAdminMaintenance = async function () {
    const content = document.getElementById('admin-content');
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-maintenance');
    if (navItem) navItem.classList.add('active');

    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #007AFF, #0056b3); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0, 122, 255, 0.2);">
                        <span style="font-size: 28px;">📋</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Échéance obligatoire réglementaire</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Suivi des validités et contrôles réglementaires</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn-primary" onclick="window.openMachineEditModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #34C759; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 18px;">+</span> Ajouter Matériel
                    </button>
                    <button class="btn-secondary" onclick="window.openManageFamiliesModal()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 16px;">📁</span> Familles
                    </button>
                    <button onclick="window.renderAdminMaintenance()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Filters Bar -->
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 24px; padding: 0 10px;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="maintenance-search" placeholder="Rechercher par identifiant, type, nom..." style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 20px 0 45px; font-size: 14px; outline: none;">
                    <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; opacity: 0.5;">🔍</span>
                </div>

                <div style="position: relative; min-width: 250px;">
                    <select id="maintenance-family-filter" style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 35px 0 16px; font-size: 14px; appearance: none; cursor: pointer; outline: none; font-weight: 600;">
                        <option value="" style="background: #1c1c1e;">🛠️ Toutes les familles</option>
                    </select>
                    <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
                </div>
            </div>
            <style>
                .maint-search-input:focus { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.3) !important; width: 380px !important; }
                .btn-maintenance-sub:hover { background: rgba(255,255,255,0.1) !important; transform: translateY(-1px); }
            </style>

            <div style="flex: 1; overflow-y: auto; padding: 40px;">
                <div class="glass-panel" style="overflow: hidden; border-radius: 20px;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th style="width: 60px;">Photo</th>
                                <th>ID (MI)</th>
                                <th>Nom / Marque</th>
                                <th>Famille</th>
                                <th>N° de Série</th>
                                <th>Attribution</th>
                                <th>Statut VGP</th>
                                <th>Validité Maint.</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="maintenance-table-body">
                            <tr><td colspan="9" style="text-align: center; padding: 40px;">Chargement du matériel...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    try {
        const [machines, families] = await Promise.all([
            api.getMachines(),
            api.getMachineFamilies()
        ]);

        const tbody = document.getElementById('maintenance-table-body');
        const familyFilter = document.getElementById('maintenance-family-filter');

        // Populate family filter
        families.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.name;
            opt.innerText = f.name;
            familyFilter.appendChild(opt);
        });

        const renderTable = () => {
            const searchText = document.getElementById('maintenance-search').value.toLowerCase();
            const selectedFamily = familyFilter.value;

            const list = machines.filter(m => {
                const matchesSearch = m.machine_id.toLowerCase().includes(searchText) ||
                    (m.name && m.name.toLowerCase().includes(searchText)) ||
                    (m.serial_number && m.serial_number.toLowerCase().includes(searchText)) ||
                    (m.assigned_to && m.assigned_to.toLowerCase().includes(searchText));
                const matchesFamily = !selectedFamily || m.family === selectedFamily;
                return matchesSearch && matchesFamily;
            });

            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: #8E8E93;">Aucun matériel trouvé</td></tr>`;
                return;
            }

            tbody.innerHTML = list.map(m => {
                const nextDate = m.next_maintenance_date ? new Date(m.next_maintenance_date) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let validityHtml = '--';
                if (nextDate) {
                    let color = '#2da140';
                    if (nextDate < today) color = '#FF3B30';
                    else if (nextDate < new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)) color = '#FF9500';
                    validityHtml = `<div style="color: ${color}; font-weight: 700;">${nextDate.toLocaleDateString('fr-FR')}</div>`;
                }

                // VGP Status Badge
                let vgpStatusHtml = '<span style="color: #8E8E93;">--</span>';
                if (m.vgp_status === 'OK') vgpStatusHtml = '<span class="badge badge-success">VGP OK</span>';
                else if (m.vgp_status === 'KO') vgpStatusHtml = '<span class="badge badge-danger">VGP KO</span>';

                const photoUrl = `${config.api.workerUrl}/get/machines_photos/${m.id}.png?t=${Date.now()}`;

                return `
                    <tr onclick="window.openMachineDetailModal('${m.id}')" style="cursor: pointer; opacity: ${m.status_active === false ? '0.5' : '1'};">
                        <td>
                            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1);">
                                <img src="${photoUrl}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3202/3202926.png'; this.style.opacity='0.2'; this.style.filter='invert(1)';" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        </td>
                        <td><div style="font-weight: 700; color: white;">${window.escapeHTML(m.machine_id)}</div></td>
                        <td>
                            <div style="font-weight: 600; color: rgba(255,255,255,0.9);">${window.escapeHTML(m.name || '--')}</div>
                            <div style="font-size: 11px; color: #8E8E93;">${window.escapeHTML(m.brand || '--')}</div>
                        </td>
                        <td><span class="badge" style="background: rgba(255,255,255,0.05); color: #8E8E93;">${window.escapeHTML(m.family || '--')}</span></td>
                        <td><code style="font-size: 11px;">${window.escapeHTML(m.serial_number || '--')}</code></td>
                        <td><div style="font-size: 13px;">👤 ${window.escapeHTML(m.assigned_to || '--')}</div></td>
                        <td>${vgpStatusHtml}</td>
                        <td>${validityHtml}</td>
                        <td style="text-align: right;">
                            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                <button onclick="event.stopPropagation(); window.openMachineEditModal('${m.id}')" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 50px; background: rgba(255, 149, 0, 0.15); border: 1px solid rgba(255, 149, 0, 0.3); color: #FF9500; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                                    <span style="font-size: 14px;">✏️</span> Modifier
                                </button>
                                <button onclick="event.stopPropagation(); window.deleteAdminMachine('${m.id}')" title="Supprimer" style="width: 36px; height: 36px; border-radius: 50px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); color: #FF3B30; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        renderTable();

        document.getElementById('maintenance-search').oninput = renderTable;
        familyFilter.onchange = renderTable;

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: #FF3B30;">Erreur: ${e.message}</td></tr>`;
    }
};

window.openMachineDetailModal = async function (id) {
    try {
        const machines = await api.getMachines();
        const m = machines.find(item => item.id === id);
        if (!m) return;

        const history = await api.getMachineMaintenanceHistory(m.id);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '1000000';
        modal.innerHTML = `
            <div class="modal-box glass-panel" style="width: 900px; padding: 0; overflow: hidden; display: flex; flex-direction: column; background: #1C1C1E; border-radius: 24px;">
                <div style="padding: 30px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: flex-start; gap: 30px;">
                    <div style="width: 140px; height: 140px; background: rgba(0,0,0,0.3); border-radius: 20px; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0;">
                        <img src="${config.api.workerUrl}/get/machines_photos/${m.id}.png?t=${Date.now()}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3202/3202926.png'; this.style.opacity='0.2'; this.style.filter='invert(1)';" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div>
                                <h2 style="margin: 0; font-size: 28px; font-weight: 800; color: white;">${window.escapeHTML(m.name || m.description || m.machine_id)}</h2>
                                <p style="margin: 4px 0 0; color: #8E8E93; font-size: 16px;"><strong>ID :</strong> ${window.escapeHTML(m.machine_id)} | ${window.escapeHTML(m.description || '')}</p>
                            </div>
                            <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; color: white; cursor: pointer; opacity: 0.5; font-size: 24px;">&times;</button>
                        </div>
                        <div style="display: flex; gap: 24px;">
                            <div style="background: rgba(255,255,255,0.05); padding: 12px 20px; border-radius: 12px;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #8E8E93; letter-spacing: 0.5px; margin-bottom: 4px;">Marque</div>
                                <div style="font-weight: 600; font-size: 15px;">${window.escapeHTML(m.brand || '--')}</div>
                            </div>
                            <div style="background: rgba(255,255,255,0.05); padding: 12px 20px; border-radius: 12px;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #8E8E93; letter-spacing: 0.5px; margin-bottom: 4px;">Emplacement</div>
                                <div style="font-weight: 600; font-size: 15px;">${window.escapeHTML(m.location || '--')}</div>
                            </div>
                            <div style="background: rgba(255,255,255,0.05); padding: 12px 20px; border-radius: 12px;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #8E8E93; letter-spacing: 0.5px; margin-bottom: 4px;">Prochaine Maintenance</div>
                                <div style="font-weight: 600; font-size: 15px; color: ${m.next_maintenance_date ? '#FF9500' : 'inherit'}">${m.next_maintenance_date ? new Date(m.next_maintenance_date).toLocaleDateString('fr-FR') : '--'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="flex: 1; display: grid; grid-template-columns: 1fr 380px; overflow: hidden;">
                    <div style="padding: 30px; border-right: 1px solid rgba(255,255,255,0.1); overflow-y: auto; display: flex; flex-direction: column; gap: 30px;">
                        <!-- Attachments Section -->
                        <div>
                            <h3 style="margin-top: 0; font-size: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">📎 Documents & Fichiers Liés</h3>
                            ${!m.attachments || m.attachments.length === 0 ? `
                                <div style="color: #8E8E93; font-size: 13px; font-style: italic;">Aucun document lié à ce matériel.</div>
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    ${m.attachments.map(file => {
                                        const sizeStr = file.size ? `(${(file.size / (1024 * 1024)).toFixed(2)} Mo)` : '';
                                        return `
                                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                                                <span style="font-size: 13px; font-weight: 600; color: #FFF; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;">📄 ${file.name}</span>
                                                <a href="${config.api.workerUrl}/get/${encodeURIComponent(file.key)}" target="_blank" class="btn-sm" style="background: rgba(255, 149, 0, 0.1); color: #FF9500; border: 1px solid rgba(255,149,0,0.2); padding: 6px 12px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 12px; display: inline-block;">Ouvrir</a>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `}
                        </div>

                        <div>
                            <h3 style="margin-top: 0; font-size: 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">📋 Historique de Maintenance</h3>
                            ${history.length === 0 ? `
                                <div style="text-align: center; color: #8E8E93; padding: 40px 20px;">
                                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">🔧</div>
                                    <p>Aucun historique enregistré pour ce matériel.</p>
                                </div>
                            ` : history.map(h => `
                                <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.05);">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                                        <div style="font-weight: 700; font-size: 15px;">${new Date(h.date).toLocaleDateString('fr-FR')}</div>
                                        <div style="font-size: 12px; color: #8E8E93; background: rgba(45, 161, 64, 0.1); color: #2da140; padding: 4px 10px; border-radius: 10px;">Effectué par ${h.profiles ? (h.profiles.first_name + ' ' + h.profiles.last_name) : 'Admin'}</div>
                                    </div>
                                    <div style="font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.9);">${window.escapeHTML(h.details || 'Maintenance de contrôle.')}</div>
                                    ${h.next_maintenance_date ? `<div style="margin-top: 12px; font-size: 12px; color: #8E8E93;">🗓️ Date de validité fixée au : <strong>${new Date(h.next_maintenance_date).toLocaleDateString('fr-FR')}</strong></div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div style="padding: 30px; background: rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; font-size: 18px; margin-bottom: 24px;">🔧 Enregistrer une Maintenance</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label class="form-label">Type d'intervention</label>
                            <select id="maint-type" class="form-input">
                                <option value="Maintenance" ${m.last_control_type === 'Maintenance' ? 'selected' : ''}>Contrôle / Entretien</option>
                                <option value="VGP" ${m.last_control_type === 'VGP' ? 'selected' : ''}>VGP (Vérification Générale Périodique)</option>
                                <option value="Remise en service" ${m.last_control_type === 'Remise en service' ? 'selected' : ''}>Remise en service</option>
                            </select>
                        </div>

                        <div id="vgp-specifics" style="display: ${m.last_control_type === 'VGP' ? 'block' : 'none'}; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                            <label class="form-label">État de conformité VGP</label>
                            <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                                <button class="btn-secondary vgp-choice ${m.vgp_status === 'OK' ? 'active' : ''}" data-val="OK" style="flex: 1; ${m.vgp_status === 'OK' ? 'background: #2da140; color: white;' : ''}">✅ Conforme</button>
                                <button class="btn-secondary vgp-choice ${m.vgp_status === 'KO' ? 'active' : ''}" data-val="KO" style="flex: 1; ${m.vgp_status === 'KO' ? 'background: #FF3B30; color: white;' : ''}">❌ Non-conforme</button>
                            </div>
                            <label class="form-label">Observations Techniques</label>
                            <input type="text" id="vgp-obs" class="form-input" placeholder="Détails de non-conformité..." value="${m.vgp_observations || ''}">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label class="form-label">Détails de l'intervention</label>
                            <textarea id="maint-details" class="form-input" style="height: 80px; resize: none;" placeholder="Ex: Remplacement des filtres..."></textarea>
                        </div>

                        <div style="margin-bottom: 24px;">
                            <label class="form-label">Durée de validité (Prochaine maintenance)</label>
                            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                                <input type="range" id="maint-slider" min="1" max="24" value="${m.periodicity || 12}" style="flex: 1; accent-color: var(--primary);">
                                <span id="maint-months-text" style="font-weight: 700; width: 80px; text-align: right; color: var(--primary);">${m.periodicity || 12} mois</span>
                            </div>
                            <div id="maint-next-preview" style="font-size: 12px; color: #8E8E93; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                                Date estimée : <strong>Calcul...</strong>
                            </div>
                        </div>
                        <button id="save-maint-btn" class="btn-primary" style="width: 100%; height: 50px; font-weight: 700;">Valider Intervention</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const slider = document.getElementById('maint-slider');
        const sliderText = document.getElementById('maint-months-text');
        const previewText = document.getElementById('maint-next-preview');

        const updatePreview = () => {
            const months = parseInt(slider.value);
            sliderText.innerText = `${months} mois`;
            const date = new Date();
            date.setMonth(date.getMonth() + months);
            previewText.innerHTML = `Date estimée : <strong>${date.toLocaleDateString('fr-FR')}</strong>`;
            return date.toISOString().split('T')[0];
        };

        slider.oninput = updatePreview;
        updatePreview();

        document.getElementById('maint-type').onchange = (e) => {
            document.getElementById('vgp-specifics').style.display = e.target.value === 'VGP' ? 'block' : 'none';
        };

        const vgpChoices = document.querySelectorAll('.vgp-choice');
        vgpChoices.forEach(btn => {
            btn.onclick = () => {
                vgpChoices.forEach(b => b.classList.remove('active'));
                vgpChoices.forEach(b => {
                    b.style.background = 'rgba(255,255,255,0.03)';
                    b.style.color = '#fff';
                });
                btn.classList.add('active');
                if (btn.dataset.val === 'OK') { btn.style.background = '#2da140'; btn.style.color = 'white'; }
                else { btn.style.background = '#FF3B30'; btn.style.color = 'white'; }
            };
        });

        document.getElementById('save-maint-btn').onclick = async () => {
            const details = document.getElementById('maint-details').value.trim();
            const type = document.getElementById('maint-type').value;
            const nextDate = updatePreview();

            let vgpStatus = null;
            let vgpObservations = null;
            if (type === 'VGP') {
                const activeChoice = document.querySelector('.vgp-choice.active');
                vgpStatus = activeChoice ? activeChoice.dataset.val : null;
                vgpObservations = document.getElementById('vgp-obs').value.trim();
                if (!vgpStatus) return alert("Veuillez sélectionner le statut de conformité VGP.");
            }

            if (!confirm(`Confirmez-vous l'enregistrement de cette intervention (${type}) ?`)) return;

            const btn = document.getElementById('save-maint-btn');
            btn.disabled = true;
            btn.innerText = "Validation...";

            try {
                await api.saveMachineMaintenance(m.id, details, nextDate, vgpStatus, vgpObservations, type);
                modal.remove();
                window.renderAdminMaintenance();
            } catch (e) {
                alert("Erreur: " + e.message);
                btn.disabled = false;
                btn.innerText = "Valider Intervention";
            }
        };

    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.openManageFamiliesModal = async function () {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000000';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 400px; padding: 30px; background: #1C1C1E; border-radius: 24px;">
            <h2 style="margin-top: 0; margin-bottom: 20px;">📁 Gérer les Familles</h2>
            <div style="margin-bottom: 20px; display: flex; gap: 10px;">
                <input type="text" id="new-family-name" class="form-input" placeholder="Nom de la famille (ex: Pelle)">
                <button id="add-family-btn" class="btn-primary">Ajouter</button>
            </div>
            <div id="families-list" style="max-height: 300px; overflow-y: auto; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                Chargement...
            </div>
            <div style="margin-top: 25px; text-align: right;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const refreshFamilies = async () => {
        const listDiv = document.getElementById('families-list');
        try {
            const families = await api.getMachineFamilies();
            if (families.length === 0) {
                listDiv.innerHTML = '<p style="color: #8E8E93; text-align: center;">Aucune famille définie.</p>';
                return;
            }
            listDiv.innerHTML = families.map(f => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span>${window.escapeHTML(f.name)}</span>
                    <button class="btn-sm" onclick="window.deleteFamily('${f.id}')" style="background: rgba(255,59,48,0.1); border: 1px solid rgba(255,59,48,0.2); color: #FF3B30;">&times;</button>
                </div>
            `).join('');
        } catch (e) { listDiv.innerHTML = 'Erreur: ' + e.message; }
    };

    window.deleteFamily = async (id) => {
        if (!confirm("Supprimer cette famille ?")) return;
        try { await api.deleteMachineFamily(id); refreshFamilies(); } catch (e) { alert(e.message); }
    };

    document.getElementById('add-family-btn').onclick = async () => {
        const name = document.getElementById('new-family-name').value.trim();
        if (!name) return;
        try {
            await api.addMachineFamily(name);
            document.getElementById('new-family-name').value = '';
            refreshFamilies();
        } catch (e) { alert(e.message); }
    };

    refreshFamilies();
};

window.openMachineEditModal = async function (id = null) {
    let m = null;
    let families = [];
    try {
        const [machines, fams] = await Promise.all([
            api.getMachines(),
            api.getMachineFamilies()
        ]);
        families = fams;
        if (id) m = machines.find(x => x.id === id);
    } catch (e) { console.error(e); }

    let currentAttachments = m?.attachments || [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000001';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 700px; padding: 0; background: #1C1C1E; border-radius: 28px; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;">
            <div style="padding: 24px 30px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-weight: 800;">${m ? '✏️ Modifier' : '🚜 Nouveau'} Matériel</h2>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 13px; color: #8E8E93;">Actif ?</span>
                    <label class="switch">
                        <input type="checkbox" id="m-active" ${m?.status_active !== false ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <div style="flex: 1; overflow-y: auto; padding: 30px;">
                <!-- SECTION: IDENTIFICATION -->
                <h3 style="font-size: 14px; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">🆔 Identification</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <div>
                        <label class="form-label">Identifiant (MI)</label>
                        <input type="text" id="m-id" class="form-input" value="${m?.machine_id || ''}" placeholder="Ex: MI_001">
                    </div>
                    <div>
                        <label class="form-label">Nom du matériel</label>
                        <input type="text" id="m-name" class="form-input" value="${m?.name || ''}" placeholder="Ex: Mini-pelle 3T">
                    </div>
                    <div>
                        <label class="form-label">Famille</label>
                        <input type="text" id="m-family" list="m-family-list" class="form-input" value="${m?.family || ''}" placeholder="Sélectionner ou saisir...">
                        <datalist id="m-family-list">
                            ${families.map(f => `<option value="${f.name}"></option>`).join('')}
                        </datalist>
                    </div>
                    <div>
                        <label class="form-label">Numéro de Série</label>
                        <input type="text" id="m-serial" class="form-input" value="${m?.serial_number || m?.description || ''}" placeholder="Numéro constructeur">
                    </div>
                </div>

                <!-- SECTION: ATTRIBUTION & ÉTAT -->
                <h3 style="font-size: 14px; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin: 30px 0 20px;">👤 Attribution</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <div>
                        <label class="form-label">Attribué à (Salarié / Chantier)</label>
                        <input type="text" id="m-assigned" class="form-input" value="${m?.assigned_to || m?.location || ''}" placeholder="Nom du responsable">
                    </div>
                    <div>
                        <label class="form-label">Marque / Description</label>
                        <input type="text" id="m-brand" class="form-input" value="${m?.brand || ''}" placeholder="Ex: Kubota, JCB...">
                    </div>
                </div>

                <!-- SECTION: CALENDRIER & VGP -->
                <h3 style="font-size: 14px; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin: 30px 0 20px;">📅 Suivi Technique</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <div>
                        <label class="form-label">Date Mise en Service</label>
                        <input type="date" id="m-commissioning" class="form-input" value="${m?.commissioning_date || ''}">
                    </div>
                    <div>
                        <label class="form-label">Durée de validité (mois)</label>
                        <input type="number" id="m-periodicity" class="form-input" value="${m?.periodicity || 12}" min="1" max="60">
                    </div>
                    <div>
                        <label class="form-label">Échéance obligatoire réglementaire</label>
                        <input type="date" id="m-expiration" class="form-input" value="${m?.expiration_date || ''}">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: flex-end;">
                        <button class="btn-secondary" onclick="document.getElementById('m-photo-input').click()" style="height: 50px;">📷 Changer la Photo</button>
                        <input type="file" id="m-photo-input" accept="image/png, image/jpeg" style="display: none;" onchange="alert('Photo prête pour envoi')">
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <label class="form-label">Commentaires / Notes SQE</label>
                    <textarea id="m-comments" class="form-input" style="height: 100px; resize: none;" placeholder="Notes libres...">${m?.comments || ''}</textarea>
                </div>

                <!-- SECTION: DOCUMENTS JOINTS -->
                <div style="margin-bottom: 24px;">
                    <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>📎 Documents & Fichiers liés (R2)</span>
                        <button class="btn-secondary" type="button" onclick="document.getElementById('m-attachments-input').click()" style="height: auto; padding: 6px 15px; font-size: 12px;">Ajouter des fichiers</button>
                    </label>
                    <input type="file" id="m-attachments-input" multiple style="display: none;" onchange="window.handleUploadMachineAttachments(this)">
                    
                    <div id="m-attachments-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); min-height: 50px;">
                        <!-- Rendered dynamically -->
                    </div>
                </div>
            </div>

            <div style="padding: 24px 30px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="save-machine-btn" class="btn-primary" style="padding: 10px 30px; font-weight: 700;">Enregistrer les modifications</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const cleanUpHelpers = () => {
        delete window.removeMachineAttachment;
        delete window.handleUploadMachineAttachments;
    };

    window.removeMachineAttachment = (index) => {
        currentAttachments.splice(index, 1);
        renderAttachments();
    };

    window.handleUploadMachineAttachments = async (input) => {
        if (!input.files || input.files.length === 0) return;
        const files = Array.from(input.files);
        const listDiv = document.getElementById('m-attachments-list');
        
        input.disabled = true;
        
        for (const file of files) {
            const loadingDiv = document.createElement('div');
            loadingDiv.style.cssText = "display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; font-size: 12px; color: #888;";
            loadingDiv.innerHTML = `<span>⏳ Upload de ${file.name}...</span>`;
            listDiv.appendChild(loadingDiv);
            
            try {
                const uploaded = await api.uploadMachineAttachment(file);
                currentAttachments.push({ name: uploaded.name, key: uploaded.key, size: uploaded.size });
            } catch (e) {
                alert(`Erreur d'upload pour ${file.name}: ` + e.message);
            }
        }
        
        input.disabled = false;
        input.value = "";
        renderAttachments();
    };

    const renderAttachments = () => {
        const listDiv = document.getElementById('m-attachments-list');
        if (!listDiv) return;
        if (currentAttachments.length === 0) {
            listDiv.innerHTML = `<div style="text-align: center; color: #555; font-size: 12px; padding: 10px 0; font-style: italic;">Aucun document lié</div>`;
            return;
        }
        listDiv.innerHTML = currentAttachments.map((file, index) => {
            const sizeStr = file.size ? `(${(file.size / (1024 * 1024)).toFixed(2)} Mo)` : '';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px;">
                    <a href="${config.api.workerUrl}/get/${encodeURIComponent(file.key)}" target="_blank" style="color: #FF9500; text-decoration: underline; font-size: 13px; font-weight: 600;">📄 ${file.name} ${sizeStr}</a>
                    <button type="button" onclick="window.removeMachineAttachment(${index})" style="background: none; border: none; color: #FF3B30; font-weight: 900; cursor: pointer; font-size: 16px;">&times;</button>
                </div>
            `;
        }).join('');
    };

    // Render initially
    renderAttachments();

    document.getElementById('save-machine-btn').onclick = async () => {
        const btn = document.getElementById('save-machine-btn');
        btn.disabled = true;
        btn.innerText = "Traitement...";

        const data = {
            id: id,
            machine_id: document.getElementById('m-id').value.trim(),
            name: document.getElementById('m-name').value.trim(),
            family: document.getElementById('m-family').value.trim(),
            serial_number: document.getElementById('m-serial').value.trim(),
            brand: document.getElementById('m-brand').value.trim(),
            assigned_to: document.getElementById('m-assigned').value.trim(),
            periodicity: parseInt(document.getElementById('m-periodicity').value) || 12,
            status_active: document.getElementById('m-active').checked,
            commissioning_date: document.getElementById('m-commissioning').value || null,
            expiration_date: document.getElementById('m-expiration').value || null,
            comments: document.getElementById('m-comments').value.trim(),
            attachments: currentAttachments,
            // Legacy mapping for compatibility
            description: document.getElementById('m-serial').value.trim(),
            type: document.getElementById('m-family').value.trim()
        };

        if (!data.machine_id) return (alert("Identifiant requis"), btn.disabled = false, btn.innerText = "Enregistrer");

        try {
            const saved = await api.saveMachine(data);
            const photoInput = document.getElementById('m-photo-input');
            if (photoInput.files.length > 0) {
                btn.innerText = "Upload photo...";
                await api.uploadMachinePhoto(saved.id || id, photoInput.files[0]);
            }
            cleanUpHelpers();
            modal.remove();
            window.renderAdminMaintenance();
        } catch (e) {
            alert("Erreur: " + e.message);
            btn.disabled = false;
            btn.innerText = "Enregistrer";
        }
    };
};

window.deleteAdminMachine = async function (id) {
    if (!confirm("Voulez-vous vraiment supprimer ce matériel ? Cette action est irréversible et supprimera également l'historique de maintenance associé.")) return;
    try {
        await api.deleteMachine(id);
        window.renderAdminMaintenance();
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

// --- MACHINES & SCHEMATICS ---
// --- MACHINES & SCHEMATICS (MAP ALTERNATIVE) ---
window.currentBuilding = null;
window.machineIcons = [];
