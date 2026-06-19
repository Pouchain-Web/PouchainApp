import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminHTTorques = async () => {
    setActiveNav('nav-ht-torques');
    const content = document.getElementById('admin-content');

    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #F59F00, #F08C00); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(245, 159, 0, 0.2);">
                        <span style="font-size: 28px;">⚡</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Couples de Serrage HT</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Gestion de la base de données par modèle de cellule</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="search-box" style="margin: 0;">
                        <input type="text" id="ht-search" placeholder="Rechercher..." oninput="window.filterHTTable(this.value)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 12px; height: 46px; padding: 0 16px; width: 250px;">
                    </div>
                    <button class="btn-primary" onclick="window.openHTTorqueModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #34C759; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 18px;">+</span> Ajouter une fiche
                    </button>
                    <button onclick="window.renderAdminHTTorques()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <div style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <div class="admin-table-container glass-panel" style="padding: 24px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                    <table class="admin-table">
                        <thead>
                            <tr id="ht-torque-thead-tr">
                                <th>Marque</th>
                                <th>Modèle</th>
                                <th>Type / Détails</th>
                                <th>Couple Câbles</th>
                                <th>Couple Barres</th>
                                <th>Internes / Disjoncteurs</th>
                                <th style="text-align: right; width: 120px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="ht-torque-tbody">
                            <tr><td colspan="7" class="loading-state" style="text-align: center; padding: 40px; color: #888;">Chargement des données...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    try {
        const torques = await api.getHTTorques();
        window.allHTTorques = torques;
        window.renderHTTorqueTable(torques);
    } catch (e) {
        console.error(e);
        document.getElementById('ht-torque-tbody').innerHTML = `<tr><td colspan="7" class="error-state">Erreur: ${e.message}</td></tr>`;
    }
};

window.renderHTTorqueTable = (data) => {
    const tbody = document.getElementById('ht-torque-tbody');
    const theadTr = document.getElementById('ht-torque-thead-tr');

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Aucun couple de serrage trouvé.</td></tr>`;
        return;
    }

    // Collecter toutes les colonnes personnalisées uniques présentes dans les données
    const customLabels = new Set();
    data.forEach(t => {
        if (t.extra_torques) {
            Object.keys(t.extra_torques).forEach(label => {
                if (label && label.trim()) customLabels.add(label.trim());
            });
        }
    });
    const sortedCustomLabels = Array.from(customLabels).sort();

    // Mettre à jour l'en-tête du tableau
    theadTr.innerHTML = `
        <th style="text-align: left;">MARQUE</th>
        <th style="text-align: left;">MODÈLE</th>
        <th style="text-align: left;">TYPE / DÉTAILS</th>
        <th style="text-align: center;">COUPLE CÂBLES</th>
        <th style="text-align: center;">COUPLE BARRES</th>
        <th style="text-align: center;">INTERNES / DISJONCTEURS</th>
        ${sortedCustomLabels.map(label => `<th style="text-align: center;">${window.escapeHTML(label.toUpperCase())}</th>`).join('')}
        <th style="text-align: right; width: 120px;">ACTIONS</th>
    `;

    const purpleBadgeStyle = 'background: rgba(175, 82, 222, 0.1); color: #AF52DE;';

    tbody.innerHTML = data.map(t => {
        const extraTorques = t.extra_torques || {};
        const customCells = sortedCustomLabels.map(label => {
            const val = extraTorques[label] || '-';
            return `<td style="text-align: center;"><span class="badge" style="${purpleBadgeStyle}">${window.escapeHTML(val)}</span></td>`;
        }).join('');

        return `
            <tr>
                <td style="font-weight: 700; color: #fff; text-align: left;">${window.escapeHTML(t.marque)}</td>
                <td style="text-align: left;">${window.escapeHTML(t.modele)}</td>
                <td style="color: rgba(255,255,255,0.5); text-align: left;">${window.escapeHTML(t.type || '-')}</td>
                <td style="text-align: center;"><span class="badge" style="${purpleBadgeStyle}">${window.escapeHTML(t.couple_cable || '-')}</span></td>
                <td style="text-align: center;"><span class="badge" style="${purpleBadgeStyle}">${window.escapeHTML(t.couple_barre || '-')}</span></td>
                <td style="text-align: center;"><span class="badge" style="${purpleBadgeStyle}">${window.escapeHTML(t.couple_interne || '-')}</span></td>
                ${customCells}
                <td style="text-align: right;">
                    <div class="action-buttons">
                        <button class="icon-btn edit" onclick='window.openHTTorqueModal(${JSON.stringify(t).replace(/'/g, "&#39;")})' title="Modifier">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                        </button>
                        <button class="icon-btn delete" onclick="window.deleteHTTorque('${t.id}')" title="Supprimer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.filterHTTable = (query) => {
    const q = query.toLowerCase();
    const filtered = window.allHTTorques.filter(t =>
        t.marque.toLowerCase().includes(q) ||
        t.modele.toLowerCase().includes(q) ||
        (t.type && t.type.toLowerCase().includes(q))
    );
    window.renderHTTorqueTable(filtered);
};

window.openHTTorqueModal = (data = null) => {
    const isEdit = !!data;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000';

    // Fonction interne pour générer une ligne de couple personnalisé
    const createExtraRow = (label = '', value = '') => {
        const div = document.createElement('div');
        div.className = 'form-row extra-torque-row';
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <div class="form-group" style="flex: 2;">
                <input type="text" class="form-input extra-label" value="${label}" placeholder="Nom de la colonne (ex: Moteur)">
            </div>
            <div class="form-group" style="flex: 2;">
                <input type="text" class="form-input extra-value" value="${value}" placeholder="Valeur (ex: 15 Nm)">
            </div>
            <button class="icon-btn delete" style="margin-top: 4px; height: 46px; width: 46px; border-radius: 12px; background: rgba(255, 59, 48, 0.1);" onclick="this.parentElement.remove()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        return div;
    };

    modal.innerHTML = `
        <div class="modal-box" style="width: 550px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2>${isEdit ? 'Modifier' : 'Ajouter'} un couple de serrage</h2>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            
            <div class="modal-body">
                <div class="form-row">
                    <div class="form-group">
                        <label>Marque</label>
                        <input type="text" id="ht-marque" class="form-input" value="${data?.marque || ''}" placeholder="ex: Schneider, Alstom...">
                    </div>
                    <div class="form-group">
                        <label>Modèle</label>
                        <input type="text" id="ht-modele" class="form-input" value="${data?.modele || ''}" placeholder="ex: RM6, SM6, Fluokit...">
                    </div>
                </div>

                <div class="form-group">
                    <label>Type de cellule / Détails supplémentaires</label>
                    <input type="text" id="ht-type" class="form-input" value="${data?.type || ''}" placeholder="ex: Tous types, VM6-S, SMAirset...">
                </div>

                <div class="form-divider">Paramètres de serrage standards (Nm)</div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Couple Câbles HTA</label>
                        <input type="text" id="ht-couple-cable" class="form-input" value="${data?.couple_cable || ''}" placeholder="ex: 50 Nm">
                    </div>
                    <div class="form-group">
                        <label>Couple Jeux de Barres</label>
                        <input type="text" id="ht-couple-barre" class="form-input" value="${data?.couple_barre || ''}" placeholder="ex: 28 Nm">
                    </div>
                </div>

                <div class="form-group">
                    <label>Connexions Internes / Disjoncteurs</label>
                    <input type="text" id="ht-couple-interne" class="form-input" value="${data?.couple_interne || ''}" placeholder="ex: 28 Nm">
                </div>

                <div class="form-divider">Couples supplémentaires</div>
                <div id="ht-extra-torques-list"></div>
                <button id="add-extra-torque-btn" class="btn" style="width: 100%; background: rgba(255,255,255,0.05); color: #fff; border: 1px dashed rgba(255,255,255,0.2); padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer; margin-top: 10px;">
                    + Ajouter un couple personnalisé
                </button>
            </div>

            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="save-ht-btn" class="btn-primary">${isEdit ? 'Mettre à jour' : 'Enregistrer'}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const listContainer = document.getElementById('ht-extra-torques-list');

    // Charger les couples existants
    if (data?.extra_torques) {
        Object.entries(data.extra_torques).forEach(([label, value]) => {
            listContainer.appendChild(createExtraRow(label, value));
        });
    }

    document.getElementById('add-extra-torque-btn').onclick = () => {
        listContainer.appendChild(createExtraRow());
    };

    document.getElementById('save-ht-btn').onclick = async () => {
        const btn = document.getElementById('save-ht-btn');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Enregistrement...`;

        try {
            // Collecter les couples personnalisés
            const extra_torques = {};
            document.querySelectorAll('.extra-torque-row').forEach(row => {
                const label = row.querySelector('.extra-label').value.trim();
                const value = row.querySelector('.extra-value').value.trim();
                if (label) extra_torques[label] = value;
            });

            const payload = {
                marque: document.getElementById('ht-marque').value,
                modele: document.getElementById('ht-modele').value,
                type: document.getElementById('ht-type').value,
                couple_cable: document.getElementById('ht-couple-cable').value,
                couple_barre: document.getElementById('ht-couple-barre').value,
                couple_interne: document.getElementById('ht-couple-interne').value,
                extra_torques: extra_torques
            };
            if (isEdit) payload.id = data.id;

            await api.saveHTTorque(payload);
            modal.remove();
            window.renderAdminHTTorques();
            window.showToast("Données enregistrées avec succès", "success");
        } catch (e) {
            alert("Erreur: " + e.message);
            btn.disabled = false;
            btn.innerText = isEdit ? 'Mettre à jour' : 'Enregistrer';
        }
    };
};

window.deleteHTTorque = async (id) => {
    if (!confirm("Voulez-vous vraiment supprimer cet enregistrement ?")) return;
    try {
        await api.deleteHTTorque(id);
        window.renderAdminHTTorques();
        window.showToast("Enregistrement supprimé", "info");
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};
