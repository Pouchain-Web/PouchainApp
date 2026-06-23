import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminMaterialRequests = async function () {
    window.adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-material').classList.add('active');

    const content = document.getElementById('admin-content');
    content.innerHTML = `<div style="text-align:center; padding: 50px;"><div class="loader-spinner"></div></div>`;

    try {
        const [requests, categories, configData, allUsers, archivedFiles] = await Promise.all([
            api.getMaterialRequests(),
            api.getMaterialCategories(),
            api.getMaterialConfig(),
            api.listUsers(),
            api.getArchivedMaterialRequests()
        ]);

        // Process archives: Fetch content of each CSV and parse it
        let historyConfirmed = [];
        let historyRefused = [];

        try {
            console.log("Chargement de l'historique R2...", archivedFiles);
            const archiveContents = await Promise.all(
                archivedFiles.map(async f => {
                    try {
                        const r = await fetch(`${config.api.workerUrl}/get/${f.key}?t=${Date.now()}`);
                        if (!r.ok) return null;
                        return { key: f.key, csv: await r.text() };
                    } catch (e) {
                        console.error(`Echec fetch archive ${f.key}:`, e);
                        return null;
                    }
                })
            );

            archiveContents.forEach(fileData => {
                if (!fileData || !fileData.csv) return;
                const lines = fileData.csv.split('\n').filter(l => l.trim());
                if (lines.length <= 1) return; // Only header
                const rows = lines.slice(1);
                rows.forEach(row => {
                    // Robust CSV splitting: handle commas inside quotes and empty fields
                    const cols = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < row.length; i++) {
                        const char = row[i];
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === ',' && !inQuotes) {
                            cols.push(current);
                            current = '';
                        } else current += char;
                    }
                    cols.push(current);

                    if (cols.length < 11) {
                        console.warn("Ligne archive corrompue ou courte:", cols);
                        return;
                    }

                    const clean = (s) => (s || '').replace(/^"|"$/g, '').trim();
                    const status = clean(cols[7]);
                    const userId = clean(cols[1]);

                    // Déterminer le secteur : soit via la colonne CSV (index 11), soit en devinant via allUsers (rétrocompatibilité)
                    let reqSecteur = cols.length > 11 ? clean(cols[11]) : null;
                    if (!reqSecteur) {
                        const u = allUsers.find(u => u.id === userId);
                        reqSecteur = u ? u.secteur : 'AIA'; // Fallback par défaut
                    }

                    const item = {
                        id: clean(cols[0]),
                        user_name: clean(cols[2]),
                        material_name: clean(cols[4]),
                        quantity: clean(cols[5]),
                        comment: clean(cols[6]),
                        status: status,
                        date: clean(cols[8]),
                        handled_by: clean(cols[10]) || 'Admin',
                        secteur: reqSecteur,
                        source_key: fileData.key
                    };
                    if (status === 'received') historyConfirmed.push(item);
                    else if (status === 'refused') historyRefused.push(item);
                });
            });

            // Sort history by date desc
            historyConfirmed.sort((a, b) => new Date(b.date) - new Date(a.date));
            historyRefused.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Filtre par secteur courant de l'administrateur
            const currentMatSecteur = window.currentUserProfile?.secteur || 'AIA';
            const secNormalized = currentMatSecteur.trim().toLowerCase();
            if (secNormalized !== 'tout') {
                historyConfirmed = historyConfirmed.filter(item => item.secteur === currentMatSecteur);
                historyRefused = historyRefused.filter(item => item.secteur === currentMatSecteur);
            }
        } catch (err) {
            console.error("Erreur générale archives:", err);
        }

        const groups = {
            'requested': { label: 'En attente', color: '#ffec99', icon: '⏳' },
            'ordered': { label: 'Commandé', color: '#a5d8ff', icon: '📦' },
            'refused': { label: 'Refusé', color: '#ffc9c9', icon: '❌' },
            'received': { label: 'Reçu / Livré', color: '#b2f2bb', icon: '✅' }
        };

        let html = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #FF9500, #FF3B30); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(255, 149, 0, 0.2);">
                        <span style="font-size: 28px;">📦</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Demande de Matériel</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Gestion des demandes collaborateurs</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn-secondary" onclick="openAdminCategoryMgmtModal()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px; color: white; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 16px;">⚙️</span> Catégories
                    </button>
                    <button onclick="window.renderAdminMaterialRequests()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>
            
            <div style="flex: 1; overflow-y: auto; padding-right: 10px;">

            <div class="material-admin-container" style="display: grid; gap: 40px; padding-bottom: 60px;">
        `;

        // Filtre secteur — 'Tout' affiche toutes les demandes, sinon uniquement celles du secteur courant.
        // Pour un nouveau secteur, aucun changement nécessaire ici.
        const matSecteur = window.currentUserProfile?.secteur || 'AIA';
        const isMatTout = matSecteur.trim().toLowerCase() === 'tout';
        const sectorUserIds = isMatTout
            ? null
            : new Set(allUsers.filter(u => u.secteur === matSecteur).map(u => u.id));
        const mainRequests = sectorUserIds
            ? requests.filter(r => sectorUserIds.has(r.user_id))
            : requests;

        // Group by category
        const catMap = new Map();
        mainRequests.forEach(r => {
            const cat = r.category || 'Non classé';
            if (!catMap.has(cat)) catMap.set(cat, []);
            catMap.get(cat).push(r);
        });

        if (mainRequests.length === 0) {
            html += `<div style="text-align:center; padding: 50px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                        <p style="font-size: 18px; color: #888;">Aucune demande en cours</p>
                    </div>`;
        } else {
            for (const [catName, catRequests] of catMap) {
                html += `
                    <section class="mat-admin-section">
                        <div class="mat-admin-header" style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
                            <h2 style="font-size: 20px; font-weight: 700; color: #fff; margin:0;">📁 ${catName}</h2>
                            <span style="background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 20px; font-size: 13px; color: #fff; font-weight:600;">${catRequests.length} demandes</span>
                        </div>
                        <div style="overflow-x: auto;">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th>Utilisateur</th>
                                        <th>Matériel / Photo</th>
                                        <th>Commentaire</th>
                                        <th>Statut</th>
                                        <th>Date</th>
                                        <th style="text-align: right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                catRequests.forEach(req => {
                    const userName = [req.profiles?.first_name, req.profiles?.last_name].filter(Boolean).join(' ') || 'Inconnu';
                    const reqSecteur = req.profiles?.secteur || 'AIA';
                    const statusInfo = groups[req.status] || { label: req.status, color: '#fff' };

                    html += `
                        <tr>
                            <td>
                                <div style="font-weight: 600;">${userName}</div>
                                ${isMatTout ? `<div style="font-size: 10px; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px; display: inline-block; margin-top: 4px; color: #bbb;">Secteur: ${reqSecteur}</div>` : ''}
                            </td>
                            <td>
                                <div style="color: #fff; font-weight: 700; font-size: 15px;">${window.escapeHTML(req.material_name)}</div>
                                ${req.image_path ? `
                                    <div style="margin-top: 10px;">
                                        <a href="${config.api.workerUrl}/get/${encodeURIComponent(req.image_path)}" target="_blank" style="text-decoration: none; color: #58a6ff; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(88, 166, 255, 0.1); border: 1px solid rgba(88, 166, 255, 0.2); border-radius: 12px; width: fit-content; transition: 0.2s;" onmouseover="this.style.background='rgba(88, 166, 255, 0.2)'" onmouseout="this.style.background='rgba(88, 166, 255, 0.1)'">
                                            🖼️ Voir la photo
                                        </a>
                                    </div>
                                ` : '<div style="margin-top: 6px; color: #444; font-size: 11px; font-style: italic;">Sans photo</div>'}
                            </td>
                            <td style="max-width: 300px;"><div style="font-size: 13px; color: #bbb; white-space: pre-wrap;">${window.escapeHTML(req.comment || '')}</div></td>
                            <td>
                                <span class="mat-status-badge" style="background: ${statusInfo.color}; color: #000;">
                                    ${statusInfo.icon} ${statusInfo.label}
                                </span>
                            </td>
                            <td style="font-size: 13px; color: #888;">${new Date(req.created_at).toLocaleString('fr-FR')}</td>
                            <td style="text-align: right;">
                                <div class="mat-btn-group">
                                    <button class="mat-btn requested" onclick="openConfirmStatusModal('${req.id}', 'requested')" title="En attente">⏳ En attente</button>
                                    <button class="mat-btn ordered" onclick="openConfirmStatusModal('${req.id}', 'ordered')" title="Commander">📦 Commander</button>
                                    <button class="mat-btn refused" onclick="openConfirmStatusModal('${req.id}', 'refused')" title="Refuser">❌ Refuser</button>
                                    <button class="mat-btn received" onclick="openConfirmStatusModal('${req.id}', 'received')" title="Livrer">✅ Livrer</button>
                                </div>
                            </td>
                        </tr>
                    `;
                });

                html += `
                                </tbody>
                            </table>
                        </div>
                    </section>
                `;
            }
        }

        // --- Historique (Archives R2) ---
        const renderHistoryTable = (items, title, color) => `
            <div style="margin-bottom: 40px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <h3 style="color: ${color}; font-size: 16px; font-weight: 800; margin:0; text-transform: uppercase; border-left: 4px solid ${color}; padding-left: 12px;">${title}</h3>
                    <span style="background: rgba(255,255,255,0.05); padding: 2px 10px; border-radius: 12px; font-size: 12px; color: #888;">${items.length} entrées</span>
                </div>
                <div style="overflow-x: auto; background: rgba(0,0,0,0.2); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px);">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Émetteur (Demandeur)</th>
                                <th>Matériel</th>
                                <th>Quantité</th>
                                <th>Traité par (Admin)</th>
                                <th>Date</th>
                                <th style="text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `
                                <tr>
                                    <td colspan="6" style="text-align:center; padding: 40px; color: #555; background: rgba(0,0,0,0.1);">
                                        <div style="font-size: 24px; margin-bottom: 8px;">📑</div>
                                        Aucune donnée archivée dans cette catégorie
                                    </td>
                                </tr>
                            ` : items.map(item => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 700; color: #eee;">${item.user_name}</div>
                                        ${isMatTout ? `<div style="font-size: 10px; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px; display: inline-block; margin-top: 4px; color: #bbb;">Secteur: ${item.secteur}</div>` : ''}
                                    </td>
                                    <td><div style="font-size: 14px; color: #bbb;">${item.material_name}</div></td>
                                    <td><div style="font-weight: 800; color: #fff;">${item.quantity}</div></td>
                                    <td><div style="color: #34C759; font-size: 13px; display:flex; align-items:center; gap:6px;">🛡️ ${item.handled_by}</div></td>
                                    <td><div style="font-size: 12px; color: #555;">${new Date(item.date).toLocaleDateString()}</div></td>
                                    <td style="text-align: right;">
                                        <button class="mat-btn refused" onclick="deleteArchivedRequest('${item.id}', '${item.source_key}')" style="padding: 6px 12px; font-size: 12px;" title="Supprimer de l'historique">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        html += `
            <section class="mat-admin-section" style="margin-top: 60px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 40px;">
                <header style="margin-bottom: 32px;">
                    <h2 style="font-size: 22px; font-weight: 800; color: #fff; margin:0; display:flex; align-items:center; gap:12px;">📊 Historique des demandes (Archives R2)</h2>
                    <p style="color: #666; font-size: 13px; margin-top: 4px;">Ces données sont extraites en temps réel de votre stockage d'archives Cloudflare R2.</p>
                </header>

                ${renderHistoryTable(historyConfirmed, 'Confirmées / Livrées', '#34C759')}
                ${renderHistoryTable(historyRefused, 'Demandes Refusées', '#FF3B30')}
            </section>
        `;

        html += `</div></div></div>`; // Close scroll area, material-admin-container, and outer container

        content.innerHTML = html;

        window.deleteArchivedRequest = async (id, key) => {
            try {
                await api.deleteArchivedMaterialRequest(id, key);
                renderAdminMaterialRequests(); // Refresh
            } catch (e) {
                alert("Erreur lors de la suppression: " + e.message);
            }
        };

        window.openConfirmStatusModal = function (id, status) {
            const statusLabels = {
                'requested': { label: 'En attente ⏳', color: '#ffd43b' },
                'ordered': { label: 'Commandée 📦', color: '#4dabf7' },
                'refused': { label: 'Refusée ❌', color: '#ff8787' },
                'received': { label: 'Livrée ✅', color: '#69db7c' }
            };
            const info = statusLabels[status];

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.zIndex = '1000002';
            modal.innerHTML = `
                <div class="modal-box glass-panel" style="width: 450px; padding: 30px; animation: modalPop 0.3s ease-out; background: #1C1C1E; color: white; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin-top: 0; font-size: 18px; font-weight: 800; color: ${status === 'requested' ? '#f59f00' : (status === 'ordered' ? '#228be6' : (status === 'refused' ? '#fa5252' : '#40c057'))};">
                        Changer le statut en : ${info.label}
                    </h3>
                    <p style="font-size: 14px; color: #aaa; margin: 15px 0;">
                        Vous pouvez ajouter un commentaire (optionnel) qui sera envoyé à l'utilisateur dans sa notification :
                    </p>
                    <textarea id="status-admin-comment" class="form-input" style="width: 100%; height: 80px; resize: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; color: white; font-size: 14px; margin-bottom: 20px;" placeholder="Votre commentaire ici..."></textarea>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 8px 16px; font-size: 13px; cursor: pointer;">Annuler</button>
                        <button class="btn-primary" id="confirm-status-btn" style="padding: 8px 20px; font-size: 13px; font-weight: bold; cursor: pointer; background: ${status === 'requested' ? '#f59f00' : (status === 'ordered' ? '#228be6' : (status === 'refused' ? '#fa5252' : '#40c057'))}; border: none; color: #000; border-radius: 20px;">Confirmer</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('#confirm-status-btn').onclick = async () => {
                const comment = modal.querySelector('#status-admin-comment').value.trim();
                modal.remove();
                await window.updateReqStatus(id, status, comment);
            };
        };

        window.updateReqStatus = async (id, status, adminComment = '') => {
            try {
                const profile = await auth.getCurrentProfile();
                const adminName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Admin';

                // Now we just update status, deletion happens during archiving
                await api.updateMaterialRequestStatus(id, status, adminName, adminComment);
                renderAdminMaterialRequests();
                window.updateMaterialBadge(); // Update sidebar badge
            } catch (e) {
                alert("Erreur: " + e.message);
            }
        };

        window.openAdminCategoryMgmtModal = () => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-box glass-panel" style="width: 450px; padding: 40px;">
                    <h2 style="margin-top: 0; margin-bottom: 24px; font-weight: 800; color: white;">Gérer les catégories</h2>
                    <div style="margin-bottom: 32px; max-height: 300px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 16px; padding: 8px;">
                        ${categories.map(c => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <span style="font-weight: 500; font-size: 15px;">${c.name}</span>
                                <button onclick="deleteCat('${c.id}')" style="background: transparent; color: #fa5252; border: none; cursor: pointer; padding: 8px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="new-cat-name" class="form-input" style="flex:1;" placeholder="Nouvelle catégorie...">
                        <button class="btn-primary" onclick="addCat()">Ajouter</button>
                    </div>
                    <div style="margin-top: 32px; text-align: right;">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            window.deleteCat = async (id) => {
                if (!confirm("Supprimer cette catégorie ?")) return;
                try {
                    await api.deleteMaterialCategory(id);
                    modal.remove();
                    renderAdminMaterialRequests();
                } catch (e) {
                    alert(e.message);
                }
            };

            window.addCat = async () => {
                const name = document.getElementById('new-cat-name').value.trim();
                if (!name) return;
                try {
                    await api.addMaterialCategory(name);
                    modal.remove();
                    renderAdminMaterialRequests();
                } catch (e) {
                    alert(e.message);
                }
            };
        };

        window.openAdminAlertConfigModal = () => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';

            const currentAlertUsers = new Set(configData.alert_users || []);

            modal.innerHTML = `
                <div class="modal-box glass-panel" style="width: 550px; padding: 40px;">
                    <h2 style="margin-top: 0; margin-bottom: 24px; font-weight: 800; color: white;">Configuration des alertes Planning</h2>
                    <p style="color: #aaa; font-size: 14px; margin-bottom: 24px;">Sélectionnez les personnes qui recevront une tâche "Check besoin de matériel" sur leur planning dès qu'une demande est faite.</p>
                    
                    <div style="max-height: 400px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 20px; padding: 16px; margin-bottom: 32px; border: 1px solid rgba(255,255,255,0.05);">
                        ${allUsers.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || '')).map(u => `
                            <label style="display: flex; align-items: center; gap: 16px; padding: 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; border-radius: 12px; margin-bottom: 4px;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                                <input type="checkbox" class="alert-user-cb" value="${u.id}" ${currentAlertUsers.has(u.id) ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--primary);">
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight: 600; font-size: 15px; color: #eee;">${u.first_name || ''} ${u.last_name || ''}</span>
                                    <span style="font-size: 12px; color: #777;">${u.email}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                        <button class="btn-primary" onclick="saveAlertConfig()">Enregistrer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            window.triggerMaterialReminder = async () => {
                const btn = document.getElementById('btn-test-reminders');
                if (btn) {
                    btn.disabled = true;
                    btn.innerText = "⌛ Test en cours...";
                }

                try {
                    const result = await api.sendMaterialReminders();
                    if (result.success) {
                        const detail = result.detail ? `\n⚠️ ${result.detail}` : '';
                        const pushLine = result.pushSent != null ? `\nPush délivrés : ${result.pushSent}` : '';
                        alert(`✅ Test réussi !\nDemandes trouvées : ${result.count}\nAdmins notifiés : ${result.notified}${pushLine}${detail}`);
                    } else {
                        alert(`⚠️ ${result.message || 'Aucune notification envoyée.'}`);
                    }
                } catch (e) {
                    alert("❌ Erreur lors du test : " + e.message);
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerText = "🔔 Tester les rappels (+7j)";
                    }
                }
            };

            window.saveAlertConfig = async () => {
                const cbs = document.querySelectorAll('.alert-user-cb:checked');
                const selectedIds = Array.from(cbs).map(cb => cb.value);

                try {
                    await api.saveMaterialConfig(selectedIds);
                    modal.remove();
                    renderAdminMaterialRequests();
                } catch (e) {
                    alert(e.message);
                }
            };
        };

    } catch (e) {
        content.innerHTML = `<div style="color:red; margin:50px;">Erreur lors du chargement: ${e.message}</div>`;
    }
};

// --- VEHICLE MANAGEMENT (Admin) ---
window.renderAdminMaterialTracking = async function () {
    const content = document.getElementById('admin-content');
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-material-stock');
    if (navItem) navItem.classList.add('active');

    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #FF9500, #FF3B30); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(255, 59, 48, 0.2);">
                        <span style="font-size: 28px;">📦</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Statut du matériel ATS</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Gestion et inventaire du stock</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn-primary" id="material-requests-btn" onclick="window.openMaterialRequestsModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #5856D6; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s; position: relative;">
                        <span style="font-size: 18px;">🔔</span> Demandes
                        <span id="requests-badge" style="display: none; position: absolute; top: -5px; right: -5px; background: #FF3B30; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; border: 2px solid #1c1c1e;">0</span>
                    </button>
                    <button onclick="window.openQrExportModal()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 8px; color: white; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Exporter QR Codes PDF">
                        <span style="font-size: 16px;">📱</span> QR Codes
                    </button>
                    <button class="btn-primary" onclick="window.openEditMaterialModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #34C759; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 18px;">+</span> Ajouter Matériel
                    </button>
                    <button onclick="window.exportMaterialToExcel()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(52, 199, 89, 0.1); border: 1px solid rgba(52, 199, 89, 0.2); display: flex; align-items: center; gap: 8px; color: #34C759; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Exporter vers Excel (CSV)">
                        <span style="font-size: 16px;">📊</span> Exporter
                    </button>
                    <button onclick="window.renderAdminMaterialTracking()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Filters Bar -->
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 24px; padding: 0 10px;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="material-search" placeholder="Rechercher par nom, type, référence..." style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 85px 0 45px; font-size: 14px; outline: none;">
                    <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; opacity: 0.5;">🔍</span>
                    <button id="inverse-search-toggle" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #8E8E93; font-size: 11px; font-weight: 700; padding: 5px 10px; cursor: pointer; transition: all 0.2s;">INVERSE</button>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; background: rgba(255, 59, 48, 0.1); padding: 0 16px; border-radius: 12px; height: 48px; border: 1px solid rgba(255, 59, 48, 0.2); cursor: pointer;" onclick="if(event.target.id !== 'material-filter-missing') { const cb = document.getElementById('material-filter-missing'); cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }">
                    <input type="checkbox" id="material-filter-missing" style="width: 18px; height: 18px; accent-color: #FF3B30; cursor: pointer;">
                    <span style="color: #FF3B30; font-size: 14px; font-weight: 700; pointer-events: none;">Manquants</span>
                </div>

                <div style="position: relative; min-width: 200px;">
                    <select id="material-filter-location" style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 35px 0 16px; font-size: 14px; appearance: none; cursor: pointer; outline: none; font-weight: 600;">
                        <option value="" style="background: #1c1c1e;">📍 Tous les lieux</option>
                    </select>
                    <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
                </div>
            </div>

            <div id="material-list-container" style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <div id="material-list-loader" style="text-align:center; padding: 80px;">
                    <div class="loader" style="border: 3px solid rgba(255,255,255,0.1); border-top-color: #34C759; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <div id="material-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding-bottom: 40px;"></div>
            </div>
        </div>
    `;

    // Ensure we have clignotant style
    if (!document.getElementById('clignotant-style')) {
        const style = document.createElement('style');
        style.id = 'clignotant-style';
        style.innerHTML = `
            @keyframes pulse-red {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7); }
                70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 59, 48, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
            }
            .clignotant {
                animation: clignote 1.5s infinite;
            }
            @keyframes clignote {
                0% { opacity: 1; }
                50% { opacity: 0.6; transform: scale(1.02); }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Update badge immediately
    window.updateMaterialStockBadge();

    try {
        const stock = await api.getMaterialStock();

        // Populate locations filter
        const locations = [...new Set(stock.map(s => s.lieu_de_stockage).filter(Boolean))].sort();
        const filterSelect = document.getElementById('material-filter-location');
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc;
            opt.textContent = loc;
            opt.style.background = "#1c1c1e";
            opt.style.color = "white";
            filterSelect.appendChild(opt);
        });

        const renderGrid = (items) => {
            const grid = document.getElementById('material-grid');
            const countBadge = document.getElementById('material-count-badge');
            if (countBadge) countBadge.innerText = `${items.length} articles`;

            if (items.length === 0) {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #71717a; padding: 120px; font-size: 18px;">Aucun matériel trouvé</div>`;
                return;
            }
            grid.innerHTML = items.map(item => {
                const isMissing = (item.nb_souhaite || 0) > (item.stock_reel || 0);
                const missingQty = (item.nb_souhaite || 0) - (item.stock_reel || 0);

                return `
                    <div class="material-card" onclick="window.openEditMaterialModal('${item.id}')" style="background: rgba(45, 45, 50, 0.4); backdrop-filter: blur(20px); border: 1px solid ${isMissing ? 'rgba(255, 59, 48, 0.3)' : 'rgba(255,255,255,0.05)'}; border-radius: 24px; padding: 24px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; gap: 16px; position: relative; overflow: hidden;">
                        
                        <!-- Header: Info & Stock -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                            <div style="display: flex; gap: 15px; flex: 1;">
                                <div style="width: 60px; height: 60px; border-radius: 14px; background: ${item.photo_url ? '#000' : 'rgba(255,255,255,0.03)'}; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                                    ${item.photo_url ?
                        `<img src="${config.api.workerUrl}/get/${item.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` :
                        `<span style="font-size: 24px;">${item.type === 'Électroportatif' ? '🔌' : '🛠️'}</span>`
                    }
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 800; color: white; font-size: 15px; line-height: 1.3; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.designation || 'Sans nom'}</div>
                                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        <span style="font-size: 9px; color: #5856D6; background: rgba(88, 86, 214, 0.1); padding: 3px 6px; border-radius: 5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(88, 86, 214, 0.15);">${item.type || 'MATÉRIEL'}</span>
                                        ${item.qr_ref ? `<span style="font-size: 9px; color: #FF9500; background: rgba(255, 149, 0, 0.1); padding: 3px 6px; border-radius: 5px; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; border: 1px solid rgba(255, 149, 0, 0.15);">${item.qr_ref}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <div style="background: ${item.stock_reel > 0 ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)'}; color: ${item.stock_reel > 0 ? '#34C759' : '#FF453A'}; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; border: 1px solid ${item.stock_reel > 0 ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)'};">
                                    ${item.stock_reel || 0}
                                </div>
                                <div style="font-size: 10px; color: #8E8E93; margin-top: 6px; font-weight: 700; text-transform: uppercase;">Cible: ${item.nb_souhaite || 0}</div>
                            </div>
                        </div>

                        <!-- Metadata: Ref & Supplier -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 14px; border: 1px solid rgba(255,255,255,0.03);">
                            <div style="overflow: hidden;">
                                <div style="font-size: 9px; color: #8E8E93; font-weight: 800; text-transform: uppercase; margin-bottom: 2px;">Référence</div>
                                <div style="font-size: 12px; color: #D1D1D6; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.reference_fournisseur || ''}">${item.reference_fournisseur || '—'}</div>
                            </div>
                            <div style="overflow: hidden;">
                                <div style="font-size: 9px; color: #8E8E93; font-weight: 800; text-transform: uppercase; margin-bottom: 2px;">Fournisseur</div>
                                <div style="font-size: 12px; color: #D1D1D6; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.fournisseur || ''}">${item.fournisseur || '—'}</div>
                            </div>
                        </div>

                        <!-- Description -->
                        <div style="font-size: 13px; color: #AEAEB2; line-height: 1.5; font-weight: 400; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 40px;">
                            ${item.caracteristiques || 'Aucune description détaillée.'}
                        </div>

                        <!-- Footer: Location & Status -->
                        <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                            <div style="display: flex; align-items: center; gap: 6px; color: #8E8E93; font-size: 12px; font-weight: 500;">
                                <span style="font-size: 14px;">📍</span> ${item.lieu_de_stockage || 'Non localisé'}
                            </div>
                            ${isMissing ? `<span style="background: #FF3B30; color: white; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 900; box-shadow: 0 4px 12px rgba(255, 59, 48, 0.2);">MANQUANT: ${missingQty}</span>` : ''}
                        </div>

                        <!-- Status bar at bottom -->
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: ${isMissing ? '#FF3B30' : '#34C759'}; opacity: 0.6;"></div>
                    </div>
                `;
            }).join('');
        };

        const loader = document.getElementById('material-list-loader');
        if (loader) loader.remove();
        renderGrid(stock);

        const searchInput = document.getElementById('material-search');
        const locationFilter = document.getElementById('material-filter-location');
        const missingFilter = document.getElementById('material-filter-missing');
        const inverseBtn = document.getElementById('inverse-search-toggle');
        let isInverse = false;

        const handleFilter = () => {
            const search = searchInput.value.toLowerCase();
            const location = locationFilter.value;
            const onlyMissing = missingFilter.checked;

            const filtered = stock.filter(s => {
                let matchesSearch = (s.designation || '').toLowerCase().includes(search) ||
                    (s.type || '').toLowerCase().includes(search) ||
                    (s.caracteristiques || '').toLowerCase().includes(search) ||
                    (s.reference_fournisseur || '').toLowerCase().includes(search) ||
                    (s.qr_ref || '').toLowerCase().includes(search) ||
                    (s.fournisseur || '').toLowerCase().includes(search);

                if (search && isInverse) {
                    matchesSearch = !matchesSearch;
                }

                const matchesLocation = !location || s.lieu_de_stockage === location;
                const matchesMissing = !onlyMissing || (s.nb_souhaite || 0) > (s.stock_reel || 0);
                return matchesSearch && matchesLocation && matchesMissing;
            });
            renderGrid(filtered);
        };

        inverseBtn.onclick = () => {
            isInverse = !isInverse;
            inverseBtn.classList.toggle('active', isInverse);
            inverseBtn.style.background = isInverse ? '#FF3B30' : 'rgba(255,255,255,0.05)';
            inverseBtn.style.color = isInverse ? 'white' : '#8E8E93';
            inverseBtn.style.borderColor = isInverse ? '#FF3B30' : 'rgba(255,255,255,0.1)';
            handleFilter();
        };

        searchInput.oninput = handleFilter;
        locationFilter.onchange = handleFilter;
        missingFilter.onchange = handleFilter;
        missingFilter.onclick = (e) => { e.stopPropagation(); handleFilter(); };

        // Save stock for modal
        window._currentStock = stock;

    } catch (e) {
        console.error(e);
        document.getElementById('material-list-container').innerHTML = `<div style="color:red; padding: 20px;">Erreur lors du chargement du stock: ${e.message}</div>`;
    }
};

window.openEditMaterialModal = async function (id = null) {
    const isMobile = window.innerWidth <= 768;
    const item = id ? window._currentStock.find(s => s.id === id) : {
        designation: '',
        type: '',
        caracteristiques: '',
        reference_fournisseur: '',
        fournisseur: '',
        stock_reel: 0,
        nb_souhaite: 0,
        lieu_de_stockage: ''
    };

    if (!item) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000000';
    modal.style.backdropFilter = 'blur(8px)';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 650px; padding: ${isMobile ? '24px' : '40px'}; border-radius: 32px; background: rgba(28, 28, 30, 0.8); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <h2 style="margin:0; font-size: ${isMobile ? '20px' : '24px'}; font-weight: 800;">${id ? 'Modifier' : 'Ajouter'} Matériel</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            
            <form id="edit-material-form" style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; gap: 20px;">

                ${(id && item.qr_ref) ? `
                <div style="grid-column: 1 / -1; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px; color: #FF9500; text-transform: uppercase; font-weight: 700;">📱 QR Code — ${item.qr_ref}</h3>
                    <div style="display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">
                        <canvas id="qr-canvas-modal" style="border-radius: 8px; background: white; padding: 8px;"></canvas>
                        
                        ${item.photo_url ? `
                            <div style="width: 140px; height: 140px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; group;" onclick="window.open('${config.api.workerUrl}/get/${item.photo_url}', '_blank')">
                                <img src="${config.api.workerUrl}/get/${item.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">
                                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 9px; padding: 4px; text-align: center; font-weight: 700;">PHOTO ACTUELLE</div>
                                <button type="button" onclick="event.stopPropagation(); if(confirm('Supprimer la photo ?')) window.deleteMaterialPhoto('${item.id}')" style="position: absolute; top: 5px; right: 5px; background: #FF3B30; color: white; border: none; width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">&times;</button>
                            </div>
                        ` : ''}

                        <div style="flex: 1;">
                            <div style="font-family: monospace; font-size: 22px; color: #FF9500; font-weight: 900; margin-bottom: 8px;">${item.qr_ref}</div>
                            <div style="font-size: 12px; color: #8E8E93; margin-bottom: 16px;">Scannez ce QR code pour accéder directement à cette fiche matériel.</div>
                            <button type="button" onclick="window.downloadSingleQr('${item.qr_ref}', '${(item.designation || 'materiel').replace(/'/g, "\\\\'")}')" style="padding: 10px 16px; background: #FF9500; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 13px;">📥 Télécharger ce QR</button>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div style="${isMobile ? '' : 'grid-column: 1 / -1;'}">
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Désignation</label>
                    <input type="text" name="designation" value="${item.designation || ''}" class="form-input" style="width:100%;" required>
                </div>

                <div style="${isMobile ? '' : 'grid-column: 1 / -1;'}">
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Type / Localisation Principale</label>
                    <input type="text" name="type" list="existing-types" value="${item.type || ''}" class="form-input" style="width:100%;">
                    <datalist id="existing-types">
                        ${[...new Set(window._currentStock.map(s => s.type).filter(Boolean))].sort().map(t => `<option value="${t}">`).join('')}
                    </datalist>
                </div>
                
                <div style="${isMobile ? '' : 'grid-column: 1 / -1;'}">
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Caractéristiques</label>
                    <textarea name="caracteristiques" class="form-input" style="width:100%; height: 80px; resize: vertical;">${item.caracteristiques || ''}</textarea>
                </div>
                
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Référence Fournisseur</label>
                    <input type="text" name="reference_fournisseur" value="${item.reference_fournisseur || ''}" class="form-input" style="width:100%;">
                </div>
                
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Fournisseur</label>
                    <input type="text" name="fournisseur" value="${item.fournisseur || ''}" class="form-input" style="width:100%;">
                </div>
                
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Stock Réel</label>
                    <input type="number" step="0.01" name="stock_reel" value="${item.stock_reel || 0}" class="form-input" style="width:100%;">
                </div>
                
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Nb Souhaité</label>
                    <input type="number" step="0.01" name="nb_souhaite" value="${item.nb_souhaite || 0}" class="form-input" style="width:100%;">
                </div>
                
                <div style="${isMobile ? '' : 'grid-column: 1 / -1;'}">
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Lieu de Stockage</label>
                    <input type="text" name="lieu_de_stockage" list="existing-locations" value="${item.lieu_de_stockage || ''}" class="form-input" style="width:100%;">
                    <datalist id="existing-locations">
                        ${[...new Set(window._currentStock.map(s => s.lieu_de_stockage).filter(Boolean))].sort().map(loc => `<option value="${loc}">`).join('')}
                    </datalist>
                </div>

                <div style="${isMobile ? '' : 'grid-column: 1 / -1;'} display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
                    ${id ? `<button type="button" id="delete-material-btn" style="margin-right: auto; padding: 12px 20px; border-radius: 12px; background: rgba(255, 59, 48, 0.1); border: 1px solid #FF3B30; color: #FF3B30; font-weight: 700; cursor: pointer;">Supprimer</button>` : ''}
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                    <button type="submit" class="btn-primary" style="padding: 12px 30px; font-weight: 700; flex: ${isMobile ? '1' : 'none'};">${id ? 'Enregistrer' : 'Créer'}</button>
                </div>

                ${id ? `
                <div style="grid-column: 1 / -1; margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px; color: #8E8E93; text-transform: uppercase; font-weight: 700;">Historique des logs</h3>
                    <div id="material-history-list" style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 10px;">
                        <div style="text-align:center; color:#8E8E93;">Chargement de l'historique...</div>
                    </div>
                </div>
                ` : ''}

            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // Generate QR code in modal if item has qr_ref
    if (id && item.qr_ref && typeof QRCode !== 'undefined') {
        const canvas = document.getElementById('qr-canvas-modal');
        if (canvas) {
            const qrUrl = `${config.api.workerUrl}/material?ref=${item.qr_ref}`;
            QRCode.toCanvas(canvas, qrUrl, { width: 140, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        }
    }

    if (id) {
        window.loadMaterialHistory(id, 'material-history-list');
    }

    modal.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Sauvegarde...";

        const formData = new FormData(e.target);
        const updates = Object.fromEntries(formData.entries());

        // Convert numbers
        updates.stock_reel = parseFloat(updates.stock_reel) || 0;
        updates.nb_souhaite = parseFloat(updates.nb_souhaite) || 0;

        try {
            if (id) {
                const prevItem = window._currentStock.find(s => s.id === id);
                await api.updateMaterialStock(id, updates);

                // Create logs for changes
                if (prevItem) {
                    if (prevItem.lieu_de_stockage !== updates.lieu_de_stockage) {
                        await api.addMaterialLog(id, 'Deplacement', `Lieu : ${prevItem.lieu_de_stockage || 'Nouveau'} -> ${updates.lieu_de_stockage || 'Non localisé'}`);
                    }
                    if (prevItem.stock_reel !== updates.stock_reel) {
                        await api.addMaterialLog(id, 'Stock', `Quantité : ${prevItem.stock_reel} -> ${updates.stock_reel}`);
                    }
                }

                showToast("Matériel mis à jour");
            } else {
                const created = await api.createMaterialStock(updates);
                if (created && created.id) {
                    await api.addMaterialLog(created.id, 'Creation', 'Matériel ajouté au stock');
                }
                showToast("Matériel ajouté");
            }
            modal.remove();
            renderAdminMaterialTracking(); // Refresh
        } catch (err) {
            alert("Erreur lors de la sauvegarde: " + err.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };

    const deleteBtn = modal.querySelector('#delete-material-btn');
    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (confirm("Voulez-vous vraiment supprimer ce matériel ?")) {
                try {
                    await api.deleteMaterialStock(id);
                    showToast("Matériel supprimé");
                    modal.remove();
                    renderAdminMaterialTracking();
                } catch (err) {
                    alert("Erreur lors de la suppression: " + err.message);
                }
            }
        };
    }
};

// --- QR CODE UTILITIES ---

window.downloadSingleQr = async function (ref, designation) {
    if (typeof QRCode === 'undefined') { alert('QR library not loaded'); return; }
    const qrUrl = `${config.api.workerUrl}/material?ref=${ref}`;
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, qrUrl, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });

    // Create a labeled version
    const labelCanvas = document.createElement('canvas');
    const padding = 40;
    labelCanvas.width = canvas.width + padding * 2;
    labelCanvas.height = canvas.height + padding * 2 + 60;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    ctx.drawImage(canvas, padding, padding);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ref, labelCanvas.width / 2, canvas.height + padding + 35);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(designation.substring(0, 40), labelCanvas.width / 2, canvas.height + padding + 58);

    const link = document.createElement('a');
    link.download = `QR_${ref}.png`;
    link.href = labelCanvas.toDataURL('image/png');
    link.click();
};

window.openQrExportModal = async function () {
    const stock = window._currentStock || [];
    const withRef = stock.filter(s => s.qr_ref);
    const withoutRef = stock.filter(s => !s.qr_ref);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000000';
    modal.style.backdropFilter = 'blur(8px)';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 600px; padding: 40px; border-radius: 32px; background: rgba(28, 28, 30, 0.9); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <h2 style="margin:0; font-size: 24px; font-weight: 800;">📱 Gestion QR Codes</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
                <div style="background: rgba(52, 199, 89, 0.1); border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 16px; padding: 20px; text-align: center;">
                    <div style="font-size: 32px; font-weight: 900; color: #34C759;">${withRef.length}</div>
                    <div style="font-size: 12px; color: #8E8E93; font-weight: 600;">AVEC REF QR</div>
                </div>
                <div style="background: rgba(255, 149, 0, 0.1); border: 1px solid rgba(255, 149, 0, 0.2); border-radius: 16px; padding: 20px; text-align: center;">
                    <div style="font-size: 32px; font-weight: 900; color: #FF9500;">${withoutRef.length}</div>
                    <div style="font-size: 12px; color: #8E8E93; font-weight: 600;">SANS REF QR</div>
                </div>
            </div>

            ${withoutRef.length > 0 ? `
            <button onclick="window.batchGenerateRefs(this)" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #FF9500, #FF3B30); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; margin-bottom: 20px; transition: 0.2s;">
                ⚡ Attribuer les références aux ${withoutRef.length} matériels manquants
            </button>` : ''}

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:10px; font-weight:700; text-transform:uppercase;">Taille des QR codes sur le PDF</label>
                <select id="qr-size-select" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; padding:12px; font-size:15px; outline:none;">
                    <option value="30">Mini (30×30 mm)</option>
                    <option value="60">Petit (60×60 mm) — 6 par page (2×3)</option>
                    <option value="80" selected>Moyen (80×80 mm) — 4 par page (2×2)</option>
                    <option value="100">Grand (100×100 mm) — 2 par page (1×2)</option>
                    <option value="120">Très grand (120×120 mm) — 1 par page</option>
                </select>
            </div>

            <button onclick="window.exportAllQrPdf(this)" style="width: 100%; padding: 16px; background: #5856D6; color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; transition: 0.2s;" ${withRef.length === 0 ? 'disabled style="opacity:0.5"' : ''}>
                📥 Exporter tous les QR codes en PDF (${withRef.length} matériels)
            </button>
            <p style="font-size: 11px; color: #8E8E93; text-align: center; margin-top: 12px;">Les QR codes seront disposés automatiquement sur des feuilles A4</p>
        </div>
    `;
    document.body.appendChild(modal);
};

window.batchGenerateRefs = async function (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Attribution en cours...';
    try {
        const result = await api.generateMaterialRefs();
        showToast(result.message || `${result.count} références générées`);
        btn.closest('.modal-overlay').remove();
        renderAdminMaterialTracking();
    } catch (err) {
        alert('Erreur: ' + err.message);
        btn.disabled = false;
        btn.innerText = '⚡ Réessayer';
    }
};

window.exportAllQrPdf = async function (btn) {
    if (typeof QRCode === 'undefined') { alert('QR library not loaded'); return; }
    const stock = (window._currentStock || []).filter(s => s.qr_ref);
    if (stock.length === 0) { alert('Aucun matériel avec référence QR'); return; }

    btn.disabled = true;
    const origText = btn.innerText;
    btn.innerText = '⏳ Génération du PDF...';

    // Load Logo
    const logoImg = new Image();
    logoImg.src = 'logo-pouchain.svg';
    await new Promise(r => logoImg.onload = r);

    const sizeMm = parseInt(document.getElementById('qr-size-select').value) || 80;
    const pxPerMm = 11.81; // 300 DPI (300 / 25.4)

    // Space allocations
    const logoHMm = sizeMm < 40 ? 6 : 12;
    const nameHMm = sizeMm < 40 ? 8 : 12;
    const refHMm = sizeMm < 40 ? 5 : 8;
    const paddingMm = 2;

    const qrPx = Math.round(sizeMm * pxPerMm);
    const logoPx = Math.round(logoHMm * pxPerMm);
    const namePx = Math.round(nameHMm * pxPerMm);
    const refPx = Math.round(refHMm * pxPerMm);
    const padPx = Math.round(paddingMm * pxPerMm);

    const cellW = qrPx;
    const cellH = logoPx + namePx + qrPx + refPx + (padPx * 2);

    const marginMm = sizeMm < 40 ? 5 : 10;
    const margin = Math.round(marginMm * pxPerMm);
    const pageW = Math.round(210 * pxPerMm); // A4 width
    const pageH = Math.round(297 * pxPerMm); // A4 height

    const cols = Math.floor((pageW - margin) / (cellW + margin)) || 1;
    const rows = Math.floor((pageH - margin) / (cellH + margin)) || 1;
    const perPage = cols * rows;
    const totalPages = Math.ceil(stock.length / perPage);

    const pages = [];

    // Helper for text wrapping
    const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
        const words = (text || '').split(' ');
        let line = '';
        let currentY = y;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    };

    for (let page = 0; page < totalPages; page++) {
        const canvas = document.createElement('canvas');
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);

        const startIdx = page * perPage;
        const endIdx = Math.min(startIdx + perPage, stock.length);

        for (let i = startIdx; i < endIdx; i++) {
            const item = stock[i];
            const localIdx = i - startIdx;
            const col = localIdx % cols;
            const row = Math.floor(localIdx / cols);
            const x = margin + col * (cellW + margin);
            const y = margin + row * (cellH + margin);

            // Draw Cell Border
            ctx.strokeStyle = '#eeeeee';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellW, cellH);

            // 1. Draw Logo
            const logoAspect = logoImg.width / logoImg.height;
            let drawLogoW = cellW * 0.8;
            let drawLogoH = drawLogoW / logoAspect;
            if (drawLogoH > logoPx) {
                drawLogoH = logoPx;
                drawLogoW = drawLogoH * logoAspect;
            }
            ctx.drawImage(logoImg, x + (cellW - drawLogoW) / 2, y + padPx, drawLogoW, drawLogoH);

            // 2. Draw Name (Above QR)
            ctx.fillStyle = '#000000';
            const fontSizeNamePx = Math.max(1.5, sizeMm * 0.08) * pxPerMm;
            ctx.font = `700 ${Math.round(fontSizeNamePx)}px sans-serif`;
            ctx.textAlign = 'center';
            wrapText(ctx, item.designation, x + cellW / 2, y + logoPx + padPx + fontSizeNamePx, cellW - (2 * pxPerMm), fontSizeNamePx * 1.1);

            // 3. Draw QR Code
            const qrCanvas = document.createElement('canvas');
            const qrUrl = `${config.api.workerUrl}/material?ref=${item.qr_ref}`;
            await QRCode.toCanvas(qrCanvas, qrUrl, { width: qrPx - (2 * pxPerMm), margin: 1, color: { dark: '#000000', light: '#ffffff' } });
            ctx.drawImage(qrCanvas, x + (1 * pxPerMm), y + logoPx + namePx + padPx);

            // 4. Draw Ref (Bottom)
            ctx.fillStyle = '#000000';
            const fontSizeRefPx = Math.max(2, sizeMm * 0.1) * pxPerMm;
            ctx.font = `bold ${Math.round(fontSizeRefPx)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(item.qr_ref, x + cellW / 2, y + logoPx + namePx + qrPx + padPx + fontSizeRefPx);
        }

        // Footer
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Page ${page + 1}/${totalPages} — Pouchain App`, pageW - margin, pageH - 10);

        pages.push(canvas);
        btn.innerText = `⏳ Page ${page + 1}/${totalPages}...`;
    }

    // Export all pages into a single PDF using jsPDF
    btn.innerText = '⏳ Création du PDF...';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();
        doc.addImage(pages[i].toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
    doc.save('QR_Codes_Pouchain.pdf');

    btn.disabled = false;
    btn.innerText = origText;
    showToast(`PDF exporté — ${pages.length} page(s), ${stock.length} QR codes`);
};

window.loadMaterialHistory = async function (materialId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = dk ? '#FFFFFF' : '#1c1c1e';

    try {
        const logs = await api.getMaterialHistory(materialId);
        if (!logs || logs.length === 0) {
            container.innerHTML = `<div style="color: #8E8E93; font-size: 13px; text-align: center; padding: 10px;">Aucun historique disponible</div>`;
            return;
        }

        container.innerHTML = logs.map(log => {
            const date = new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            let userName = 'Système';
            if (log.profiles) {
                userName = `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() || 'Utilisateur inconnu';
            }
            return `
                <div style="padding: 12px; border-left: 3px solid #5856D6; background: rgba(88, 86, 214, 0.05); border-radius: 0 10px 10px 0; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="font-size: 11px; color: #8E8E93; font-weight: 600;">${date} • ${userName}</div>
                        <div style="font-size: 13px; color: ${textColor}; font-weight: 500; margin-top: 4px;">${log.details}</div>
                    </div>
                    <button onclick="window.deleteLog('${log.id}', '${materialId}', '${containerId}')" style="background: none; border: none; color: #FF3B30; opacity: 0.5; cursor: pointer; font-size: 16px; padding: 0 5px;" title="Supprimer ce log">🗑️</button>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div style="color: red; font-size: 12px;">Erreur historique: ${e.message}</div>`;
    }
};

window.deleteLog = async function (logId, materialId, containerId) {
    if (!confirm("Supprimer ce log de l'historique ?")) return;
    try {
        await api.deleteMaterialLog(logId);
        window.loadMaterialHistory(materialId, containerId);
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.deleteMaterialPhoto = async function (id) {
    try {
        const item = window._currentStock ? window._currentStock.find(s => s.id === id) : null;
        const photoKey = item ? item.photo_url : null;

        // 1. Delete from R2 if key exists
        if (photoKey) {
            try {
                await api.deleteFile(photoKey);
            } catch (err) {
                console.warn("Failed to delete from R2, but continuing to clear DB:", err);
            }
        }

        // 2. Clear photo_url in DB
        await api.updateMaterialStock(id, { photo_url: null });

        // Update local data immediately
        if (item) item.photo_url = null;

        window.showToast("Photo supprimée avec succès");

        // Refresh the modal correctly
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
            window.openEditMaterialModal(id);
        }
        window.renderAdminMaterialTracking();
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.exportMaterialToExcel = function () {
    const stock = window._currentStock;
    if (!stock || stock.length === 0) return alert("Aucune donnée à exporter");

    // CSV Header
    const headers = ["Désignation", "Catégorie", "Caractéristiques", "Référence Fournisseur", "Fournisseur", "Stock Réel", "Stock Souhaité", "Lieu de Stockage", "Réf QR"];

    // CSV Content
    const rows = stock.map(item => [
        item.designation || "",
        item.type || "",
        (item.caracteristiques || "").replace(/\n/g, " "),
        item.reference_fournisseur || "",
        item.fournisseur || "",
        item.stock_reel || 0,
        item.nb_souhaite || 0,
        item.lieu_de_stockage || "",
        item.qr_ref || ""
    ]);

    // Escape CSV values
    const csvContent = [headers, ...rows].map(row =>
        row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";")
    ).join("\n");

    // Create Blob and Download (UTF-8 with BOM for Excel compatibility)
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `inventaire_ats_pouchain_${dateStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.renderBuildingSchematic = async function (buildingId, highlightMachineId = null) {
    const isMobile = window.innerWidth <= 768;
    const container = isMobile ? document.getElementById('list-content') : document.getElementById('admin-content');

    // Si c'est mobile et qu'on cherche une machine, on passe en plein écran horizontal (rotation 90)
    if (isMobile && highlightMachineId) {
        document.body.classList.add('hide-main-nav');
        container.classList.add('landscape-mode');
    } else if (isMobile) {
        document.body.classList.remove('hide-main-nav');
        container.classList.remove('landscape-mode');
    }

    try {
        const buildings = await api.getBuildings();
        const b = buildings.find(x => x.id === buildingId);
        if (!b) return console.error('Building not found:', buildingId);
        console.log('Loading Building Plan:', b.name, b.svg_url);
        const machines = await api.getMachines();
        const bMachines = machines.filter(m => m.building_id === buildingId);

        container.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; background: #000; position: relative;">
                ${(isMobile && highlightMachineId) ? `
                    <!-- Bouton retour flottant supprimé au profit du bouton retour Android -->
                ` : `
                    <div style="padding: 15px 20px; background: rgba(0,0,0,0.4); display: flex; align-items: center; gap: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); z-index: 10;">
                        <button onclick="${isMobile ? 'window.renderMobileMaterialTracking()' : 'window.renderAdminMaterialTracking()'}" style="background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                            ${isMobile ? '' : 'Retour'}
                        </button>
                        <h3 style="margin: 0; color: white; flex: 1;">${b.name}</h3>
                        ${localStorage.getItem('pouchain_role') === 'admin' ? `
                            <button id="add-m-btn" class="btn-primary" style="padding: 8px 15px; font-size: 13px;" onclick="window.startPlacingMachine('${buildingId}')">+ Machine</button>
                            <button id="cancel-m-btn" class="btn-secondary" style="padding: 8px 15px; font-size: 13px; display:none;" onclick="window.stopPlacingMachine()">Annuler</button>
                        ` : ''}
                    </div>
                `}
                <div id="placement-hint" style="display:none; background: #FF9500; color: white; text-align: center; padding: 5px; font-size: 13px; font-weight: bold;">Mode Placement : Cliquez n'importe où sur le plan pour placer la machine</div>
                <div id="schematic-viewport" style="flex: 1; position: relative; overflow: ${(isMobile && highlightMachineId) ? 'hidden' : 'auto'}; display: flex; align-items: center; justify-content: center; background: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 30px 30px; width: 100%; height: 100%;">
                    <div id="schematic-container" style="position: relative; max-width: 100%; max-height: 100%; display: flex; align-items: center; justify-content: center;">
                        <img src="${b.svg_url}" id="schematic-img" style="width: auto; height: auto; max-width: 100%; max-height: 100%; display: block; border-radius: 4px; box-shadow: 0 0 20px rgba(0,0,0,0.5);" onerror="console.error('Plan Load Failed:', this.src); alert('Erreur: Impossible de charger le plan (PNG/JPG).')">
                    </div>
                </div>
                ${(isMobile && highlightMachineId) ? '' : `
                    <div style="height: 60px; background: #1C1C1E; border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; padding: 0 20px; overflow-x: auto; gap: 10px;">
                        <span style="font-size: 12px; color: #8E8E93; margin-right: 10px;">Machines:</span>
                        ${bMachines.map(m => `<div onclick="window.focusMachineOnSchematic('${m.id}')" style="background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 15px; font-size: 13px; color: white; cursor: pointer; white-space: nowrap;">${m.machine_id}</div>`).join('')}
                    </div>
                `}
            </div>
        `;
        const schematicImg = document.getElementById('schematic-img');
        schematicImg.onload = () => {
            const sc = document.getElementById('schematic-container');
            sc.onclick = (e) => {
                if (!window.isPlacingMachine) return;
                const rect = schematicImg.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                window.openAddMachineModal(x, y, buildingId);
            };

            bMachines.forEach(m => {
                if (m.x_pos !== null && m.y_pos !== null) {
                    const pin = document.createElement('div');
                    pin.id = `pin-${m.id}`;
                    pin.className = 'machine-pin' + (m.id === highlightMachineId ? ' pin-searched' : '');
                    pin.style.cssText = `position: absolute; left: ${m.x_pos}%; top: ${m.y_pos}%; width: 32px; height: 32px; margin: -16px; display: flex; align-items: center; justify-content: center; font-size: 20px; background: rgba(255,255,255,0.25); border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3); cursor: pointer; z-index: ${m.id === highlightMachineId ? 10000 : 100}; transition: all 0.2s ease; backdrop-filter: blur(5px);`;
                    pin.innerHTML = m.emoji || '🔧';
                    pin.onclick = (ev) => {
                        ev.stopPropagation();
                        if (window.isPlacingMachine) return;
                        window.renderMachineDetailsUI(m.id);
                    };
                    sc.appendChild(pin);
                }
            });
            if (highlightMachineId) window.focusMachineOnSchematic(highlightMachineId);
        };
    } catch (e) { alert("Erreur: " + e.message); }
};

window.focusMachineOnSchematic = function (id) {
    const pins = document.querySelectorAll('.machine-pin');
    pins.forEach(p => p.style.background = '#5856D6');
    const target = document.getElementById(`pin-${id}`);
    if (target) {
        target.style.background = '#FF3B30';
        target.style.transform = 'scale(1.5)';
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { if (target) target.style.transform = 'scale(1)'; }, 1000);
    }
};

window.openAddBuildingModal = function () {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#FFFFFF';
    const textColor = dk ? '#FFFFFF' : '#000000';
    const inputBg = dk ? '#2C2C2E' : '#f2f2f7';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "15000";
    modal.innerHTML = `
        <div class="modal-box" style="background: ${bg}; color: ${textColor}; width: 90%; max-width: 400px; padding: 25px; border-radius: 25px;">
            <h2 style="margin-top:0;">🏢 Nouveau Bâtiment</h2>
            <div style="margin-bottom: 15px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Nom du bâtiment</label><input type="text" id="new-b-name" style="width:100%; padding: 12px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" required></div>
            <div style="margin-bottom: 20px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Plan (PNG recommandé)</label><input type="file" id="new-b-svg" accept=".png,.jpg,.jpeg,.svg" style="width:100%;"></div>
            <div style="display:flex; gap: 10px;"><button class="btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button><button class="btn-primary" style="flex:2;" id="save-building-btn">Ajouter</button></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('save-building-btn').onclick = async () => {
        const name = document.getElementById('new-b-name').value.trim();
        const fileInput = document.getElementById('new-b-svg');
        if (!name || !fileInput.files[0]) return alert("Nom et fichier requis");
        try {
            const key = `buildings/${Date.now()}_${fileInput.files[0].name}`;
            await api.uploadFile(fileInput.files[0], key);
            const svg_url = `${config.api.workerUrl}/get/${key}`;
            await api.saveBuilding({ name, svg_url });
            modal.remove();
            window.renderAdminMaterialTracking();
        } catch (e) { alert("Erreur: " + e.message); }
    };
};

window.handleDeleteBuilding = async function (id) {
    if (!confirm("Supprimer ce bâtiment ?")) return;
    try { await api.deleteBuilding(id); window.renderAdminMaterialTracking(); } catch (e) { alert("Erreur: " + e.message); }
};

window.startPlacingMachine = function (buildingId) {
    window.isPlacingMachine = true;
    document.getElementById('add-m-btn').style.display = 'none';
    document.getElementById('cancel-m-btn').style.display = 'block';
    document.getElementById('placement-hint').style.display = 'block';
};

window.stopPlacingMachine = function () {
    window.isPlacingMachine = false;
    const addBtn = document.getElementById('add-m-btn');
    const cancelBtn = document.getElementById('cancel-m-btn');
    const hint = document.getElementById('placement-hint');
    if (addBtn) addBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (hint) hint.style.display = 'none';
};

window.openAddMachineModal = function (x, y, buildingId) {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#FFFFFF';
    const textColor = dk ? '#FFFFFF' : '#000000';
    const inputBg = dk ? '#2C2C2E' : '#f2f2f7';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "12000";
    modal.innerHTML = `
        <div class="modal-box" style="background: ${bg}; color: ${textColor}; width: 90%; max-width: 400px; padding: 25px; border-radius: 25px;">
            <h2 style="margin-top:0;">🤖 Nouvelle Machine</h2>
            <div style="margin-bottom: 12px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Identifiant (MI...)</label><input type="text" id="new-m-id" style="width:100%; padding: 12px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" required></div>
            <div style="margin-bottom: 12px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Type</label><input type="text" id="new-m-type" style="width:100%; padding: 12px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" placeholder="Hydraulique, Pompe..."></div>
            <div style="margin-bottom: 12px;">
                <label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Emoji Représentatif</label>
                <div style="display:flex; gap: 8px; flex-wrap: wrap;" id="emoji-picker">
                    ${['🔧', '🚜', '🏭', '⛽', '⚡', '💧', '🌪️', '📦', '🦾', '🌡️'].map(e => `<div onclick="window.selectEmoji(this, '${e}')" style="font-size: 24px; padding: 5px; cursor: pointer; border-radius: 8px; border: 2px solid transparent;">${e}</div>`).join('')}
                </div>
                <input type="hidden" id="new-m-emoji" value="🔧">
            </div>
            <div style="margin-bottom: 20px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Photo (Optionnel)</label><input type="file" id="new-m-photo" accept="image/*" style="width:100%;"></div>
            <div style="display:flex; gap: 10px;"><button class="btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button><button class="btn-primary" style="flex:2;" id="save-machine-btn">Enregistrer</button></div>
            <p style="font-size: 10px; opacity: 0.5; margin-top: 15px; text-align:center;">Position : X:${x.toFixed(1)}% | Y:${y.toFixed(1)}%</p>
        </div>
    `;
    document.body.appendChild(modal);

    window.selectEmoji = (el, emoji) => {
        document.querySelectorAll('#emoji-picker div').forEach(d => d.style.borderColor = 'transparent');
        el.style.borderColor = '#007AFF';
        document.getElementById('new-m-emoji').value = emoji;
    };
    // Active le premier par défaut
    window.selectEmoji(document.querySelector('#emoji-picker div'), '🔧');

    document.getElementById('save-machine-btn').onclick = async () => {
        const id = document.getElementById('new-m-id').value.trim();
        const type = document.getElementById('new-m-type').value.trim();
        const emoji = document.getElementById('new-m-emoji').value;
        const fileInput = document.getElementById('new-m-photo');
        if (!id) return alert("ID requis");
        try {
            let image_url = null;
            if (fileInput.files[0]) {
                const key = `machines/${Date.now()}_${fileInput.files[0].name}`;
                await api.uploadFile(fileInput.files[0], key);
                image_url = `${config.api.workerUrl}/get/${key}`;
            }
            await api.saveMachine({ machine_id: id, type, x_pos: x, y_pos: y, building_id: buildingId, image_url, emoji });
            window.stopPlacingMachine();
            modal.remove();
            if (buildingId) window.renderBuildingSchematic(buildingId); else window.renderAdminMaterialTracking();
        } catch (e) { alert("Erreur: " + e.message); }
    };
};

window.renderMachineDetailsUI = async function (machineDbId) {
    try {
        const machines = await api.getMachines();
        const machine = machines.find(m => m.id === machineDbId);
        if (!machine) return;
        const logs = await api.getMachineLogs(machineDbId);
        const dk = document.documentElement.getAttribute('data-theme') === 'dark';
        const bg = dk ? '#1C1C1E' : '#FFFFFF';
        const textColor = dk ? '#FFFFFF' : '#000000';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = "11000";
        modal.innerHTML = `
            <div class="modal-box" style="padding:0; border-radius: 28px; width: 95%; max-width: 500px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; background: ${bg};">
                <div style="position: relative; height: 180px; background: #333;">
                    ${machine.image_url ? `<img src="${machine.image_url}" style="width:100%; height:100%; object-fit: cover;">` : `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size: 60px;">🔧</div>`}
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: white;"><h2 style="margin: 0;">${machine.machine_id}</h2><div style="opacity: 0.8;">${machine.type || ''}</div></div>
                    <button onclick="this.closest('.modal-overlay').remove()" style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.5); border: none; color: white; width: 32px; height: 32px; border-radius: 16px; cursor: pointer;">✕</button>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${logs.length === 0 ? `<p style="text-align:center; color:#8E8E93;">Aucun historique.</p>` : logs.map(l => `
                            <div style="background: rgba(142,142,147,0.1); padding: 12px; border-radius: 12px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><strong>${l.action_type}</strong> <small>${new Date(l.created_at).toLocaleDateString()}</small></div>
                                <div style="font-size: 14px; opacity: 0.9;">${l.description || ''}</div>
                                <div style="font-size: 11px; opacity: 0.5; text-align:right; margin-top:5px;">— ${l.profiles ? l.profiles.first_name : 'Inconnu'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px; background: ${bg};">
                    <button class="btn-primary" style="flex:1;" onclick="openAddMachineLogModal('${machineDbId}')">Ajouter un log</button>
                    ${localStorage.getItem('pouchain_role') === 'admin' ? `<button class="btn-secondary" style="width: 50px;" onclick="handleDeleteMachine('${machineDbId}', '${machine.building_id}')">🗑️</button>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (e) { alert("Erreur: " + e.message); }
};

window.openAddMachineLogModal = function (machineDbId) {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#FFFFFF';
    const textColor = dk ? '#FFFFFF' : '#000000';
    const inputBg = dk ? '#2C2C2E' : '#f2f2f7';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "13000";
    modal.innerHTML = `
        <div class="modal-box" style="background: ${bg}; color: ${textColor}; width: 90%; max-width: 400px; padding: 25px; border-radius: 25px;">
            <h2 style="margin-top:0;">📝 Nouveau Log</h2>
            <div style="margin-bottom: 15px;"><label style="display:block; font-size: 12px; margin-bottom: 5px;">Action</label>
                <select id="log-action" style="width:100%; padding: 12px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor};">
                    <option value="Maintenance">🔧 Maintenance</option>
                    <option value="Réparation">🛠️ Réparation</option>
                    <option value="Contrôle">👁️ Contrôle</option>
                    <option value="Déplacement">🚚 Déplacement</option>
                </select>
            </div>
            <div style="margin-bottom: 20px;"><label style="display:block; font-size: 12px; margin-bottom: 5px;">Notes</label><textarea id="log-desc" style="width:100%; height: 80px; padding: 12px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; resize: none;"></textarea></div>
            <div style="display:flex; gap: 10px;"><button class="btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button><button class="btn-primary" style="flex:2;" id="save-log-btn">Valider</button></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('save-log-btn').onclick = async () => {
        const actionType = document.getElementById('log-action').value;
        const desc = document.getElementById('log-desc').value;
        try {
            await api.addMachineLog(machineDbId, actionType, desc);
            document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
            renderMachineDetailsUI(machineDbId);
        } catch (e) { alert("Erreur: " + e.message); }
    };
};

window.handleDeleteMachine = async function (id, buildingId = null) {
    if (!confirm("Supprimer cette machine ?")) return;
    console.log("UI: Starting machine deletion for:", id);
    try {
        await api.deleteMachine(id);
        console.log("UI: Machine deleted successfully, closing modals...");
        document.querySelectorAll('.modal-overlay').forEach(o => o.remove());

        console.log("UI: Refreshing view... BuildingId:", buildingId);
        if (buildingId && typeof window.renderBuildingSchematic === "function") {
            window.renderBuildingSchematic(buildingId);
        } else if (typeof window.renderMobileMaterialTracking === "function") {
            window.renderMobileMaterialTracking();
        } else {
            renderAdminMaterialTracking();
        }
    } catch (e) {
        console.error("UI: Machine deletion FAILED:", e);
        alert("Erreur: " + e.message);
    }
};

window.openStorageAnalysisModal = async function (event) {
    const originalBtn = event?.currentTarget;
    if (originalBtn) originalBtn.innerText = '📊 Analyse...';

    let fullFiles = [];
    let spaceData = null;
    try {
        // Fetch both the full file list AND the official space usage
        [fullFiles, spaceData] = await Promise.all([
            api.listFiles(null, true),
            api.getSpaceUsage()
        ]);
        if (originalBtn) originalBtn.innerText = '📊 Analyser le stockage';
    } catch (e) {
        console.error("Storage analysis fetch failed", e);
        if (originalBtn) originalBtn.innerText = '📊 Analyser le stockage';
        alert("Erreur lors de la récupération des données complètes.");
        return;
    }

    if (!fullFiles || fullFiles.length === 0) {
        alert("Aucun fichier trouvé pour l'analyse.");
        return;
    }

    // Official total from Cloudflare (matches sidebar)
    const officialTotalSize = spaceData?.usedBytes || 0;

    // Step 1: Pre-calculate total and extension breakdown
    const extStats = {};
    let listedTotalSize = 0;
    const allFiles = [];

    fullFiles.forEach(f => {
        if (f.key.startsWith('.meta_')) return;
        listedTotalSize += f.size;
        allFiles.push(f);
        const ext = f.key.split('.').pop().toLowerCase() || 'inconnu';
        if (!extStats[ext]) extStats[ext] = { size: 0, count: 0 };
        extStats[ext].size += f.size;
        extStats[ext].count++;
    });

    // Use official total if it's larger than what we listed
    const totalSize = Math.max(officialTotalSize, listedTotalSize);

    // Step 2: Categories
    const categories = {
        'Images': { color: '#FF3B30', size: 0, count: 0, exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'], icon: '🖼️' },
        'PDF': { color: '#FF9500', size: 0, count: 0, exts: ['pdf'], icon: '📕' },
        'Documents': { color: '#007AFF', size: 0, count: 0, exts: ['doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'], icon: '📔' },
        'Vidéos': { color: '#AF52DE', size: 0, count: 0, exts: ['mp4', 'mov', 'webm', 'mkv'], icon: '🎬' }
    };

    const finalCategories = {};
    const handledExts = new Set();
    for (const [name, data] of Object.entries(categories)) {
        data.exts.forEach(e => {
            if (extStats[e]) {
                data.size += extStats[e].size;
                data.count += extStats[e].count;
                handledExts.add(e);
            }
        });
        if (data.size > 0) finalCategories[name] = data;
    }

    // Discrepancy between listed files and official storage (System overhead / hidden R2 data)
    if (officialTotalSize > listedTotalSize) {
        finalCategories['Système / Métadonnées'] = {
            color: '#5856D6',
            size: officialTotalSize - listedTotalSize,
            count: 0,
            icon: '⚙️'
        };
    }

    const palette = ['#5AC8FA', '#4CD964', '#FF2D55', '#E5E5EA', '#FFCC00', '#5856D6'];
    let pIdx = 0;
    const remainingExts = Object.entries(extStats).filter(([e]) => !handledExts.has(e));
    const others = { color: '#8E8E93', size: 0, count: 0, icon: '📄' };

    remainingExts.forEach(([ext, stats]) => {
        const percent = (stats.size / totalSize) * 100;
        if (percent > 1.0) {
            finalCategories[ext.toUpperCase()] = {
                color: palette[pIdx % palette.length],
                size: stats.size,
                count: stats.count,
                icon: '📂'
            };
            pIdx++;
        } else {
            others.size += stats.size;
            others.count += stats.count;
        }
    });
    if (others.size > 0) finalCategories['Autres'] = others;

    const topFiles = allFiles.sort((a, b) => b.size - a.size).slice(0, 5);
    const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' Mo';

    // Step 3: BUILD SVG DONUT
    // Radius 40, Circumference = 2 * PI * 40 = 251.32
    const radius = 40;
    const circ = 2 * Math.PI * radius;
    let currentOffset = 0;
    const activeCats = Object.entries(finalCategories).filter(([_, data]) => data.size > 0).sort((a, b) => b[1].size - a[1].size);

    let svgContent = `<circle cx="50" cy="50" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="12"/>`;

    activeCats.forEach(([_, data]) => {
        const p = data.size / totalSize;
        const dashArray = p * circ;
        const dashOffset = -currentOffset;
        svgContent += `<circle cx="50" cy="50" r="${radius}" fill="transparent" 
            stroke="${data.color}" stroke-width="12" 
            stroke-dasharray="${dashArray} ${circ - dashArray}" 
            stroke-dashoffset="${dashOffset}" 
            transform="rotate(-90 50 50)" />`;
        currentOffset += dashArray;
        data.percent = p * 100;
    });

    const donutSVG = `
        <svg viewBox="0 0 100 100" style="width: 250px; height: 250px; filter: drop-shadow(0 15px 30px rgba(0,0,0,0.5)); transform: scale(1.05);">
            ${svgContent}
        </svg>
    `;

    // Step 4: Render Modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay storage-analysis-overlay';
    modal.style.zIndex = "10000001";
    modal.style.padding = "20px";

    // Inject Custom Styles for Scrollbar
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
        .storage-analysis-modal::-webkit-scrollbar { width: 8px; }
        .storage-analysis-modal::-webkit-scrollbar-track { background: transparent; }
        .storage-analysis-modal::-webkit-scrollbar-thumb { background: #000; border-radius: 10px; border: 2px solid #1c1c1c; }
        .storage-analysis-modal::-webkit-scrollbar-thumb:hover { background: #333; }
    `;
    document.head.appendChild(styleTag);

    modal.innerHTML = `
        <div class="modal-box glass-panel storage-analysis-modal" style="width: 750px; max-height: 85vh; overflow-y: auto; padding: 0; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; animation: modalPop 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); background: #111;">
            <!-- Header Opaque and Sticky -->
            <div style="position: sticky; top: 0; background: #000; padding: 30px 40px; z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-weight: 800; font-size: 22px; color: white;">📊 Analyse Avancée du Stockage</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px;">&times;</button>
            </div>

            <div style="padding: 40px;">
                <div style="display: flex; gap: 45px; align-items: center; margin-bottom: 40px; flex-wrap: wrap;">
                    <div style="width: 250px; height: 250px; flex-shrink: 0; position: relative; margin: 0 auto;">
                        ${donutSVG}
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 120px;">
                            <div style="font-size: 10px; color: #888; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">Total</div>
                            <div style="font-size: 22px; font-weight: 900; color: white;">${formatSize(totalSize)}</div>
                        </div>
                    </div>

                    <div style="flex: 1; min-width: 300px; display: grid; grid-template-columns: 1fr; gap: 10px;">
                        ${activeCats.map(([name, data]) => `
                            <div style="display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,0.03); padding: 12px 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${data.color}; box-shadow: 0 0 10px ${data.color}88;"></div>
                                <div style="flex: 1;">
                                    <div style="display:flex; justify-content: space-between; align-items: flex-end;">
                                        <span style="font-weight: 800; font-size: 14px; color: #fff;">${data.icon} ${name}</span>
                                        <span style="font-size: 11px; color: #666;">${data.count} fichiers</span>
                                    </div>
                                    <div style="display:flex; justify-content: space-between; align-items: flex-end; margin-top: 4px;">
                                        <span style="font-size: 14px; color: white; font-weight: 800;">${data.percent.toFixed(1)}%</span>
                                        <span style="font-size: 11px; color: #aaa; font-weight: 600;">${formatSize(data.size)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 35px; margin-bottom: 30px;">
                    <h3 style="font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 25px; font-weight: 900;">📂 Top 5 des fichiers les plus lourds</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${topFiles.map((f, i) => {
        const name = f.key.split('/').pop();
        return `
                                <div style="display: flex; align-items: center; gap: 20px; padding: 15px 25px; background: #000; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
                                    <span style="font-size: 16px; font-weight: 900; color: #333; width: 25px;">#${i + 1}</span>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 14px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${window.escapeHTML(name)}</div>
                                        <div style="font-size: 11px; color: #555; margin-top: 3px;">${f.key}</div>
                                    </div>
                                    <div style="font-weight: 900; color: var(--primary); font-size: 14px;">${formatSize(f.size)}</div>
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>

                <div style="padding: 20px; background: rgba(0,122,255,0.05); border-radius: 12px; border: 1px solid rgba(0,122,255,0.1);">
                    <p style="margin:0; font-size: 13px; color: #aaa; line-height: 1.6;">
                        <strong>Note :</strong> L'analyse inclut uniquement les fichiers indexés. Les fichiers dépassant 1% de l'espace total sont mis en avant individuellement.
                    </p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.renderAdminMaterialGTTracking = async function () {
    const content = document.getElementById('admin-content');
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-material-stock-gt');
    if (navItem) navItem.classList.add('active');

    const GT_COMPAT = ['t1', 't2', 'v1', 'v2', 'v3', 'v4', 'v5'];
    const GT_COMPAT_LABELS = { t1: 'T1', t2: 'T2', v1: 'V1', v2: 'V2', v3: 'V3', v4: 'V4', v5: 'V5' };

    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #5856D6, #3634A3); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(88, 86, 214, 0.3);">
                        <span style="font-size: 28px;">🗄️</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Statut du matériel GT</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Armoires de stockage vertical — Tours / Vertimags</p>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn-primary" id="material-gt-requests-btn" onclick="window.openMaterialGTRequestsModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #5856D6; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s; position: relative;">
                        <span style="font-size: 18px;">🔔</span> Demandes
                        <span id="gt-requests-badge" style="display: none; position: absolute; top: -5px; right: -5px; background: #FF3B30; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; border: 2px solid #1c1c1e;">0</span>
                    </button>
                    <button class="btn-primary" onclick="window.openEditMaterialGTModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #5856D6; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 18px;">+</span> Ajouter Pièce
                    </button>
                    <button onclick="window.openQrGTExportModal()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 8px; color: white; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Exporter QR Codes PDF GT">
                        <span style="font-size: 16px;">📱</span> QR Codes
                    </button>
                    <button onclick="window.exportMaterialGTToExcel()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(88, 86, 214, 0.1); border: 1px solid rgba(88, 86, 214, 0.2); display: flex; align-items: center; gap: 8px; color: #5856D6; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Exporter vers Excel (CSV)">
                        <span style="font-size: 16px;">📊</span> Exporter
                    </button>
                    <button onclick="window.renderAdminMaterialGTTracking()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 24px; padding: 0 10px; flex-wrap: wrap;">
                <div style="position: relative; flex: 1; min-width: 200px;">
                    <input type="text" id="material-gt-search" placeholder="Rechercher par désignation, référence, QR..." style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 16px 0 45px; font-size: 14px; outline: none;">
                    <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; opacity: 0.5;">🔍</span>
                </div>
                <div style="position: relative; min-width: 180px;">
                    <select id="material-gt-filter-location" style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 35px 0 16px; font-size: 14px; appearance: none; cursor: pointer; outline: none; font-weight: 600;">
                        <option value="" style="background: #1c1c1e;">📍 Tous les lieux</option>
                    </select>
                    <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
                </div>
                <div style="position: relative; min-width: 160px;">
                    <select id="material-gt-filter-compat" style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 35px 0 16px; font-size: 14px; appearance: none; cursor: pointer; outline: none; font-weight: 600;">
                        <option value="" style="background: #1c1c1e;">🔧 Compatibilité</option>
                        <option value="t1" style="background: #1c1c1e;">T1</option>
                        <option value="t2" style="background: #1c1c1e;">T2</option>
                        <option value="v1" style="background: #1c1c1e;">V1</option>
                        <option value="v2" style="background: #1c1c1e;">V2</option>
                        <option value="v3" style="background: #1c1c1e;">V3</option>
                        <option value="v4" style="background: #1c1c1e;">V4</option>
                        <option value="v5" style="background: #1c1c1e;">V5</option>
                    </select>
                    <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
                </div>
                <span id="material-gt-count-badge" style="font-size: 12px; color: #8E8E93; font-weight: 600; white-space: nowrap;">— articles</span>
            </div>

            <div id="material-gt-list-container" style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <div id="material-gt-list-loader" style="text-align:center; padding: 80px;">
                    <div class="loader" style="border: 3px solid rgba(255,255,255,0.1); border-top-color: #5856D6; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <div id="material-gt-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding-bottom: 40px;"></div>
            </div>
        </div>
    `;

    window.updateMaterialGTStockBadge();

    try {
        const stock = await api.getMaterialGTStock();
        window._currentGTStock = stock;

        const locations = [...new Set(stock.map(s => s.lieu_de_stockage).filter(Boolean))].sort();
        const filterSelect = document.getElementById('material-gt-filter-location');
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc;
            opt.textContent = loc;
            opt.style.background = '#1c1c1e';
            opt.style.color = 'white';
            filterSelect.appendChild(opt);
        });

        const GT_COMPAT = ['t1', 't2', 'v1', 'v2', 'v3', 'v4', 'v5'];

        const renderGrid = (items) => {
            const grid = document.getElementById('material-gt-grid');
            const countBadge = document.getElementById('material-gt-count-badge');
            if (countBadge) countBadge.innerText = `${items.length} article${items.length !== 1 ? 's' : ''}`;
            if (items.length === 0) {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #71717a; padding: 120px; font-size: 18px;">Aucune pièce trouvée</div>`;
                return;
            }
            grid.innerHTML = items.map(item => {
                const compatBadges = GT_COMPAT
                    .map(k => item[k] ? `<span style="font-size: 10px; color: #5856D6; background: rgba(88,86,214,0.12); padding: 3px 7px; border-radius: 6px; font-weight: 800; border: 1px solid rgba(88,86,214,0.2);">${k.toUpperCase()}</span>` : '')
                    .join('');
                return `
                    <div class="material-card" onclick="window.openEditMaterialGTModal('${item.id}')" style="background: rgba(45, 45, 50, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 24px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; gap: 16px; position: relative; overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                            <div style="display: flex; gap: 15px; flex: 1;">
                                <div style="width: 60px; height: 60px; border-radius: 14px; background: ${item.photo_url ? '#000' : 'rgba(255,255,255,0.03)'}; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                                    ${item.photo_url ? `<img src="${config.api.workerUrl}/get/${item.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 24px;">⚙️</span>`}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 800; color: white; font-size: 15px; line-height: 1.3; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.designation || 'Sans nom'}</div>
                                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        ${item.qr_ref ? `<span style="font-size: 9px; color: #FF9500; background: rgba(255,149,0,0.1); padding: 3px 6px; border-radius: 5px; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; border: 1px solid rgba(255,149,0,0.15);">${item.qr_ref}</span>` : ''}
                                        ${item.ref ? `<span style="font-size: 9px; color: #8E8E93; background: rgba(142,142,147,0.1); padding: 3px 6px; border-radius: 5px; font-weight: 700; border: 1px solid rgba(142,142,147,0.15);">${item.ref}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <div style="background: rgba(88,86,214,0.12); color: #5856D6; min-width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; border: 1px solid rgba(88,86,214,0.2); padding: 0 8px; text-align: center;">
                                    ${item.quantite || '0'}
                                </div>
                                <div style="font-size: 10px; color: #8E8E93; margin-top: 6px; font-weight: 700; text-transform: uppercase;">Quantité</div>
                            </div>
                        </div>

                        <!-- Compatibility badges -->
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${compatBadges || '<span style="font-size: 11px; color: #48484A;">Aucune compatibilité</span>'}
                        </div>

                        <!-- Location -->
                        <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                            <div style="display: flex; align-items: center; gap: 6px; color: #8E8E93; font-size: 12px; font-weight: 500;">
                                <span style="font-size: 14px;">📍</span> ${item.lieu_de_stockage || 'Non localisé'}
                            </div>
                        </div>
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: #5856D6; opacity: 0.5;"></div>
                    </div>
                `;
            }).join('');
        };

        const loader = document.getElementById('material-gt-list-loader');
        if (loader) loader.remove();
        renderGrid(stock);

        const searchInput = document.getElementById('material-gt-search');
        const locationFilter = document.getElementById('material-gt-filter-location');
        const compatFilter = document.getElementById('material-gt-filter-compat');

        const handleFilter = () => {
            const search = searchInput.value.toLowerCase();
            const location = locationFilter.value;
            const compat = compatFilter.value;
            const filtered = stock.filter(s => {
                const matchesSearch = !search ||
                    (s.designation || '').toLowerCase().includes(search) ||
                    (s.ref || '').toLowerCase().includes(search) ||
                    (s.qr_ref || '').toLowerCase().includes(search) ||
                    (s.lieu_de_stockage || '').toLowerCase().includes(search);
                const matchesLocation = !location || s.lieu_de_stockage === location;
                const matchesCompat = !compat || s[compat] === true;
                return matchesSearch && matchesLocation && matchesCompat;
            });
            renderGrid(filtered);
        };

        searchInput.oninput = handleFilter;
        locationFilter.onchange = handleFilter;
        compatFilter.onchange = handleFilter;

        // Update badge in sidebar
        const requests = await api.getMaterialGTStockRequests().catch(() => []);
        const badge = document.getElementById('gt-requests-badge');
        if (badge && requests.length > 0) {
            badge.style.display = 'flex';
            badge.textContent = requests.length;
        }

    } catch (e) {
        console.error(e);
        document.getElementById('material-gt-list-container').innerHTML = `<div style="color:red; padding: 20px;">Erreur lors du chargement: ${e.message}</div>`;
    }
};

window.openEditMaterialGTModal = async function (id = null) {
    const isMobile = window.innerWidth <= 768;
    const GT_COMPAT = ['t1', 't2', 'v1', 'v2', 'v3', 'v4', 'v5'];

    const item = id ? (window._currentGTStock || []).find(s => s.id === id) : {
        designation: '', ref: '', quantite: '0', lieu_de_stockage: '',
        t1: false, t2: false, v1: false, v2: false, v3: false, v4: false, v5: false
    };
    if (!item) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000000';
    modal.style.backdropFilter = 'blur(8px)';

    const compatCheckboxes = GT_COMPAT.map(k => `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); transition: 0.2s;" onmouseover="this.style.background='rgba(88,86,214,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
            <input type="checkbox" id="gt-compat-${k}" name="${k}" ${item[k] ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #5856D6; cursor: pointer;">
            <span style="font-size: 14px; font-weight: 700; color: white;">${k.toUpperCase()}</span>
        </label>
    `).join('');

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 650px; padding: ${isMobile ? '24px' : '40px'}; border-radius: 32px; background: rgba(28,28,30,0.92); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1); max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <h2 style="margin:0; font-size: ${isMobile ? '20px' : '24px'}; font-weight: 800;">${id ? 'Modifier' : 'Ajouter'} Pièce GT</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
            </div>

            ${id && item.qr_ref ? `
            <div style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px; color: #FF9500; text-transform: uppercase; font-weight: 700;">📱 QR Code — ${item.qr_ref}</h3>
                <div style="display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">
                    <canvas id="qr-gt-canvas-modal" style="border-radius: 8px; background: white; padding: 8px;"></canvas>
                    <div style="flex: 1;">
                        <div style="font-family: monospace; font-size: 22px; color: #FF9500; font-weight: 900; margin-bottom: 8px;">${item.qr_ref}</div>
                        <div style="font-size: 12px; color: #8E8E93; margin-bottom: 16px;">Scannez ce QR code pour accéder directement à cette fiche matériel GT.</div>
                        <button type="button" onclick="window.downloadSingleQr('${item.qr_ref}', '${(item.designation || 'materiel').replace(/'/g, "\\\\'")}')" style="padding: 10px 16px; background: #FF9500; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 13px;">📥 Télécharger ce QR</button>
                    </div>
                </div>
            </div>
            ` : ''}

            <form id="edit-material-gt-form" style="display: flex; flex-direction: column; gap: 20px;">
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Désignation *</label>
                    <input type="text" name="designation" value="${item.designation || ''}" class="form-input" style="width:100%;" required>
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Référence Fournisseur</label>
                    <textarea name="ref" class="form-input" style="width:100%; height: 70px; resize: vertical; font-family: monospace; font-size: 12px;">${item.ref || ''}</textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Quantité</label>
                        <input type="text" name="quantite" value="${item.quantite || '0'}" class="form-input" style="width:100%;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Lieu de Stockage</label>
                        <input type="text" name="lieu_de_stockage" value="${item.lieu_de_stockage || ''}" class="form-input" style="width:100%;">
                    </div>
                </div>

                <!-- Compatibility Checkboxes -->
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:12px; font-weight:700; text-transform:uppercase;">Compatibilité Machines</label>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        ${compatCheckboxes}
                    </div>
                </div>

                <!-- Photo -->
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Photo</label>
                    ${item.photo_url ? `
                    <div style="margin-bottom: 12px; position: relative; display: inline-block;">
                        <img src="${config.api.workerUrl}/get/${item.photo_url}" style="width: 120px; height: 90px; object-fit: cover; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                        <button type="button" onclick="if(confirm('Supprimer la photo ?')) { api.deleteMaterialGTPhoto('${item.photo_url}').then(() => api.updateMaterialGTStock('${item.id}', {photo_url: null})).then(() => { window.renderAdminMaterialGTTracking(); this.closest('.modal-overlay').remove(); }); }" style="position: absolute; top: -8px; right: -8px; background: #FF3B30; color: white; border: none; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer;">&times;</button>
                    </div>
                    ` : ''}
                    <input type="file" id="gt-photo-input" accept="image/*" style="display: none;">
                    <button type="button" onclick="document.getElementById('gt-photo-input').click()" style="padding: 10px 18px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; cursor: pointer; font-size: 13px; font-weight: 600;">
                        📷 ${item.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                    </button>
                    <span id="gt-photo-label" style="font-size: 12px; color: #8E8E93; margin-left: 10px;"></span>
                </div>

                <!-- History (if editing) -->
                ${id ? `
                <div>
                    <div style="font-size: 12px; color: #8E8E93; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">📋 Historique</div>
                    <div id="gt-history-container" style="max-height: 150px; overflow-y: auto; background: rgba(255,255,255,0.02); border-radius: 12px; padding: 10px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="color: #48484A; font-size: 12px; text-align: center; padding: 10px;">Chargement...</div>
                    </div>
                    <div style="margin-top: 12px; display: flex; gap: 10px;">
                        <input type="text" id="gt-log-text" placeholder="Ajouter un commentaire..." class="form-input" style="flex: 1; height: 40px;">
                        <button type="button" onclick="window.addGTLog('${item.id}', document.getElementById('gt-log-text').value)" style="padding: 0 18px; height: 40px; background: #5856D6; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;">Ajouter</button>
                    </div>
                </div>
                ` : ''}

                <!-- Actions -->
                <div style="display: flex; gap: 12px; margin-top: 10px; ${id ? 'justify-content: space-between;' : 'justify-content: flex-end;'}">
                    ${id ? `<button type="button" onclick="if(confirm('Supprimer cette pièce GT ?')) window.deleteGTItem('${item.id}')" style="padding: 14px 20px; background: rgba(255,59,48,0.1); border: 1px solid rgba(255,59,48,0.3); border-radius: 14px; color: #FF3B30; font-weight: 700; cursor: pointer; font-size: 14px; transition: 0.2s;">🗑️ Supprimer</button>` : ''}
                    <div style="display: flex; gap: 10px;">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" style="padding: 14px 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; color: white; font-weight: 700; cursor: pointer; font-size: 14px;">Annuler</button>
                        <button type="submit" id="gt-save-btn" style="padding: 14px 30px; background: linear-gradient(135deg, #5856D6, #3634A3); border: none; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; font-size: 14px; transition: 0.2s;">✓ Enregistrer</button>
                    </div>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    // Generate QR code in modal if item has qr_ref
    if (id && item.qr_ref && typeof QRCode !== 'undefined') {
        const canvas = document.getElementById('qr-gt-canvas-modal');
        if (canvas) {
            const qrUrl = `${config.api.workerUrl}/material?ref=${item.qr_ref}`;
            QRCode.toCanvas(canvas, qrUrl, { width: 140, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        }
    }

    // Load history
    if (id) {
        window.loadMaterialGTHistory(id, 'gt-history-container');
    }

    // Photo label
    document.getElementById('gt-photo-input').addEventListener('change', function () {
        const label = document.getElementById('gt-photo-label');
        if (this.files[0]) label.textContent = this.files[0].name;
    });

    // Form submit
    document.getElementById('edit-material-gt-form').onsubmit = async function (e) {
        e.preventDefault();
        const btn = document.getElementById('gt-save-btn');
        btn.disabled = true;
        btn.textContent = 'Enregistrement...';
        try {
            const formData = new FormData(this);
            const data = {
                designation: formData.get('designation'),
                ref: formData.get('ref') || null,
                quantite: formData.get('quantite') || '0',
                lieu_de_stockage: formData.get('lieu_de_stockage') || null,
            };
            // Get compat checkboxes
            ['t1', 't2', 'v1', 'v2', 'v3', 'v4', 'v5'].forEach(k => {
                data[k] = document.getElementById(`gt-compat-${k}`).checked;
            });

            // Photo upload
            const photoFile = document.getElementById('gt-photo-input').files[0];
            if (photoFile) {
                const uploadResult = await api.uploadMaterialGTPhoto(id || 'new', photoFile);
                data.photo_url = uploadResult.key;
            }

            let savedItem;
            if (id) {
                savedItem = await api.updateMaterialGTStock(id, data);
                await api.addMaterialGTLog(id, 'Modification', `Pièce modifiée par l'admin`);
            } else {
                savedItem = await api.createMaterialGTStock(data);
            }

            modal.remove();
            window.showToast('✅ Pièce GT enregistrée avec succès');
            window.renderAdminMaterialGTTracking();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = '✓ Enregistrer';
            window.showToast('❌ Erreur: ' + err.message);
        }
    };
};

window.deleteGTItem = async function (id) {
    try {
        await api.deleteMaterialGTStock(id);
        document.querySelector('.modal-overlay')?.remove();
        window.showToast('✅ Pièce GT supprimée');
        window.renderAdminMaterialGTTracking();
    } catch (e) {
        window.showToast('❌ Erreur: ' + e.message);
    }
};

window.loadMaterialGTHistory = async function (materialId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const logs = await api.getMaterialGTHistory(materialId);
        if (logs.length === 0) {
            container.innerHTML = '<div style="color: #48484A; font-size: 12px; text-align: center; padding: 10px;">Aucun historique</div>';
            return;
        }
        container.innerHTML = logs.map(log => {
            const date = new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const userName = log.profiles ? `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() : 'Inconnu';
            return `
                <div style="padding: 8px 10px; border-left: 3px solid #5856D6; background: rgba(88,86,214,0.05); border-radius: 0 8px 8px 0; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div>
                        <div style="font-size: 10px; color: #8E8E93;">${date} • ${userName}</div>
                        <div style="font-size: 12px; color: #D1D1D6; font-weight: 500; margin-top: 2px;">${log.details}</div>
                    </div>
                    <button onclick="window.deleteGTLog('${log.id}', '${materialId}', '${containerId}')" style="background: none; border: none; color: #FF3B30; opacity: 0.5; cursor: pointer; font-size: 14px;" title="Supprimer">🗑️</button>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div style="color: red; font-size: 12px;">Erreur: ${e.message}</div>`;
    }
};

window.addGTLog = async function (materialId, text) {
    if (!text || !text.trim()) return;
    try {
        await api.addMaterialGTLog(materialId, 'Commentaire', text.trim());
        document.getElementById('gt-log-text').value = '';
        window.loadMaterialGTHistory(materialId, 'gt-history-container');
    } catch (e) {
        window.showToast('❌ Erreur: ' + e.message);
    }
};

window.deleteGTLog = async function (logId, materialId, containerId) {
    if (!confirm('Supprimer ce log ?')) return;
    try {
        await api.deleteMaterialGTLog(logId);
        window.loadMaterialGTHistory(materialId, containerId);
    } catch (e) {
        window.showToast('❌ Erreur: ' + e.message);
    }
};

window.openMaterialGTRequestsModal = async function () {
    try {
        const requests = await api.getMaterialGTStockRequests();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '1000000';
        modal.style.backdropFilter = 'blur(8px)';

        if (requests.length === 0) {
            modal.innerHTML = `
                <div class="modal-box glass-panel" style="max-width: 480px; padding: 40px; border-radius: 32px; background: rgba(28,28,30,0.92); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.1); text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                    <h2 style="margin: 0 0 10px 0; font-size: 22px;">Aucune demande en attente</h2>
                    <p style="color: #8E8E93;">Toutes les demandes GT ont été traitées.</p>
                    <button onclick="this.closest('.modal-overlay').remove()" style="margin-top: 20px; padding: 14px 30px; background: #5856D6; color: white; border: none; border-radius: 14px; font-weight: 700; cursor: pointer;">Fermer</button>
                </div>
            `;
            document.body.appendChild(modal);
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
            return;
        }

        const requestCards = requests.map(req => {
            const mat = req.material_stock_gt || {};
            const user = req.profiles ? `${req.profiles.first_name || ''} ${req.profiles.last_name || ''}`.trim() : 'Inconnu';
            const date = new Date(req.created_at).toLocaleDateString('fr-FR');
            const compatList = ['t1', 't2', 'v1', 'v2', 'v3', 'v4', 'v5'].filter(k => mat[k]).map(k => k.toUpperCase()).join(', ');
            return `
                <div id="gt-req-${req.id}" style="padding: 20px; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px solid rgba(255,255,255,0.07); margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div>
                            <div style="font-weight: 800; color: white; font-size: 15px; margin-bottom: 4px;">${mat.designation || 'Pièce inconnue'}</div>
                            <div style="font-size: 12px; color: #8E8E93; margin-bottom: 6px;">
                                <span>Réf QR: <b>${mat.qr_ref || '—'}</b></span> • 
                                <span>Réf Fournisseur: <b>${mat.ref || '—'}</b></span> • 
                                <span>Compatibilité: <b>${compatList || 'Aucune'}</b></span>
                            </div>
                            <div style="font-size: 12px; color: #8E8E93;">Demande de ${user} • ${date}</div>
                        </div>
                        <span style="background: rgba(255,149,0,0.1); color: #FF9500; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; border: 1px solid rgba(255,149,0,0.2);">EN ATTENTE</span>
                    </div>
                    ${req.comment ? `
                    <div style="margin-top: 10px; font-style: italic; color: #FF9500; font-size: 13px; background: rgba(255,149,0,0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,149,0,0.1); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <span>💬 Commentaire:</span> <strong>${req.comment}</strong>
                    </div>` : ''}
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px; background: rgba(255,255,255,0.02); border-radius: 12px; margin-bottom: 14px; font-size: 13px;">
                        ${req.new_quantite !== undefined ? `
                        <div>
                            <div style="color: #8E8E93; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Quantité actuelle → Nouvelle</div>
                            <div style="color: white;">${mat.quantite || '0'} → <strong style="color: #34C759;">${req.new_quantite}</strong></div>
                        </div>` : ''}
                        ${req.new_lieu_de_stockage ? `
                        <div>
                            <div style="color: #8E8E93; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Lieu actuel → Nouveau</div>
                            <div style="color: white;">${mat.lieu_de_stockage || '—'} → <strong style="color: #34C759;">${req.new_lieu_de_stockage}</strong></div>
                        </div>` : ''}
                        ${req.new_designation ? `
                        <div style="grid-column: 1/-1;">
                            <div style="color: #8E8E93; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Nouvelle désignation</div>
                            <div style="color: white;">${req.new_designation}</div>
                        </div>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.handleGTRequestDecision('${req.id}', 'approved')" style="flex: 1; padding: 12px; background: rgba(52,199,89,0.1); border: 1px solid rgba(52,199,89,0.3); border-radius: 12px; color: #34C759; font-weight: 700; cursor: pointer; font-size: 14px; transition: 0.2s;" onmouseover="this.style.background='rgba(52,199,89,0.2)'" onmouseout="this.style.background='rgba(52,199,89,0.1)'">✅ Approuver</button>
                        <button onclick="window.handleGTRequestDecision('${req.id}', 'rejected')" style="flex: 1; padding: 12px; background: rgba(255,59,48,0.1); border: 1px solid rgba(255,59,48,0.3); border-radius: 12px; color: #FF3B30; font-weight: 700; cursor: pointer; font-size: 14px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,59,48,0.2)'" onmouseout="this.style.background='rgba(255,59,48,0.1)'">❌ Refuser</button>
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-box glass-panel" style="width: 90%; max-width: 620px; padding: 40px; border-radius: 32px; background: rgba(28,28,30,0.92); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); max-height: 88vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;">
                    <h2 style="margin: 0; font-size: 22px; font-weight: 800;">🔔 Demandes GT en attente</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <div id="gt-requests-list">${requestCards}</div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    } catch (e) {
        window.showToast('❌ Erreur: ' + e.message);
    }
};

window.handleGTRequestDecision = async function (requestId, status) {
    try {
        await api.updateMaterialGTStockRequestStatus(requestId, status);
        const card = document.getElementById(`gt-req-${requestId}`);
        if (card) {
            card.style.opacity = '0.4';
            card.style.pointerEvents = 'none';
            card.style.borderColor = status === 'approved' ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)';
        }
        window.showToast(status === 'approved' ? '✅ Demande GT approuvée' : '❌ Demande GT refusée');
        window.updateMaterialGTStockBadge();
        if (window._currentGTStock) window.renderAdminMaterialGTTracking();
    } catch (e) {
        window.showToast('❌ Erreur: ' + e.message);
    }
};

window.exportMaterialGTToExcel = function () {
    const stock = window._currentGTStock;
    if (!stock || stock.length === 0) { window.showToast('⚠️ Aucune donnée à exporter'); return; }
    const GT_COMPAT = ['t1', 't2', 'v1', 'v2', 'v3', 'v4', 'v5'];
    const headers = ['QR Ref', 'Désignation', 'Référence', 'Quantité', 'Lieu de stockage', ...GT_COMPAT.map(k => k.toUpperCase())];
    const rows = stock.map(s => [
        s.qr_ref || '', s.designation || '', s.ref || '', s.quantite || '0', s.lieu_de_stockage || '',
        ...GT_COMPAT.map(k => s[k] ? 'Oui' : '')
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_gt_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('📊 Export GT téléchargé');
};

window.openQrGTExportModal = async function () {
    const stock = window._currentGTStock || [];
    const withRef = stock.filter(s => s.qr_ref);
    const withoutRef = stock.filter(s => !s.qr_ref);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000000';
    modal.style.backdropFilter = 'blur(8px)';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 600px; padding: 40px; border-radius: 32px; background: rgba(28, 28, 30, 0.9); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <h2 style="margin:0; font-size: 24px; font-weight: 800;">📱 Gestion QR Codes GT</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
                <div style="background: rgba(52, 199, 89, 0.1); border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 16px; padding: 20px; text-align: center;">
                    <div style="font-size: 32px; font-weight: 900; color: #34C759;">${withRef.length}</div>
                    <div style="font-size: 12px; color: #8E8E93; font-weight: 600;">AVEC REF QR</div>
                </div>
                <div style="background: rgba(255, 149, 0, 0.1); border: 1px solid rgba(255, 149, 0, 0.2); border-radius: 16px; padding: 20px; text-align: center;">
                    <div style="font-size: 32px; font-weight: 900; color: #FF9500;">${withoutRef.length}</div>
                    <div style="font-size: 12px; color: #8E8E93; font-weight: 600;">SANS REF QR</div>
                </div>
            </div>

            ${withoutRef.length > 0 ? `
            <button onclick="window.batchGenerateGTRefs(this)" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #FF9500, #FF3B30); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; margin-bottom: 20px; transition: 0.2s;">
                ⚡ Attribuer les références aux ${withoutRef.length} matériels manquants
            </button>` : ''}

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:10px; font-weight:700; text-transform:uppercase;">Taille des QR codes sur le PDF</label>
                <select id="qr-gt-size-select" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; padding:12px; font-size:15px; outline:none;">
                    <option value="30">Mini (30×30 mm)</option>
                    <option value="60">Petit (60×60 mm) — 6 par page (2×3)</option>
                    <option value="80" selected>Moyen (80×80 mm) — 4 par page (2×2)</option>
                    <option value="100">Grand (100×100 mm) — 2 par page (1×2)</option>
                    <option value="120">Très grand (120×120 mm) — 1 par page</option>
                </select>
            </div>

            <button onclick="window.exportAllGTQrPdf(this)" style="width: 100%; padding: 16px; background: #5856D6; color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; transition: 0.2s;" ${withRef.length === 0 ? 'disabled style="opacity:0.5"' : ''}>
                📥 Exporter tous les QR codes en PDF (${withRef.length} matériels)
            </button>
            <p style="font-size: 11px; color: #8E8E93; text-align: center; margin-top: 12px;">Les QR codes seront disposés automatiquement sur des feuilles A4</p>
        </div>
    `;
    document.body.appendChild(modal);
};

window.batchGenerateGTRefs = async function (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Attribution en cours...';
    try {
        const result = await api.generateMaterialGTRefs();
        showToast(result.message || `${result.count} références générées`);
        btn.closest('.modal-overlay').remove();
        renderAdminMaterialGTTracking();
    } catch (err) {
        alert('Erreur: ' + err.message);
        btn.disabled = false;
        btn.innerText = '⚡ Réessayer';
    }
};

window.exportAllGTQrPdf = async function (btn) {
    if (typeof QRCode === 'undefined') { alert('QR library not loaded'); return; }
    const stock = (window._currentGTStock || []).filter(s => s.qr_ref);
    if (stock.length === 0) { alert('Aucun matériel avec référence QR'); return; }

    btn.disabled = true;
    const origText = btn.innerText;
    btn.innerText = '⏳ Génération du PDF...';

    // Load Logo
    const logoImg = new Image();
    logoImg.src = 'logo-pouchain.svg';
    await new Promise(r => logoImg.onload = r);

    const sizeMm = parseInt(document.getElementById('qr-gt-size-select').value) || 80;
    const pxPerMm = 11.81; // 300 DPI (300 / 25.4)

    // Space allocations
    const logoHMm = sizeMm < 40 ? 6 : 12;
    const nameHMm = sizeMm < 40 ? 8 : 12;
    const refHMm = sizeMm < 40 ? 5 : 8;
    const paddingMm = 2;

    const qrPx = Math.round(sizeMm * pxPerMm);
    const logoPx = Math.round(logoHMm * pxPerMm);
    const namePx = Math.round(nameHMm * pxPerMm);
    const refPx = Math.round(refHMm * pxPerMm);
    const padPx = Math.round(paddingMm * pxPerMm);

    const cellW = qrPx;
    const cellH = logoPx + namePx + qrPx + refPx + (padPx * 2);

    const marginMm = sizeMm < 40 ? 5 : 10;
    const margin = Math.round(marginMm * pxPerMm);
    const pageW = Math.round(210 * pxPerMm); // A4 width
    const pageH = Math.round(297 * pxPerMm); // A4 height

    const cols = Math.floor((pageW - margin) / (cellW + margin)) || 1;
    const rows = Math.floor((pageH - margin) / (cellH + margin)) || 1;
    const perPage = cols * rows;
    const totalPages = Math.ceil(stock.length / perPage);

    const pages = [];

    // Helper for text wrapping
    const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
        const words = (text || '').split(' ');
        let line = '';
        let currentY = y;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    };

    for (let page = 0; page < totalPages; page++) {
        const canvas = document.createElement('canvas');
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);

        const startIdx = page * perPage;
        const endIdx = Math.min(startIdx + perPage, stock.length);

        for (let i = startIdx; i < endIdx; i++) {
            const item = stock[i];
            const localIdx = i - startIdx;
            const col = localIdx % cols;
            const row = Math.floor(localIdx / cols);
            const x = margin + col * (cellW + margin);
            const y = margin + row * (cellH + margin);

            // Draw Cell Border
            ctx.strokeStyle = '#eeeeee';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellW, cellH);

            // 1. Draw Logo
            const logoAspect = logoImg.width / logoImg.height;
            let drawLogoW = cellW * 0.8;
            let drawLogoH = drawLogoW / logoAspect;
            if (drawLogoH > logoPx) {
                drawLogoH = logoPx;
                drawLogoW = drawLogoH * logoAspect;
            }
            ctx.drawImage(logoImg, x + (cellW - drawLogoW) / 2, y + padPx, drawLogoW, drawLogoH);

            // 2. Draw Name (Above QR)
            ctx.fillStyle = '#000000';
            const fontSizeNamePx = Math.max(1.5, sizeMm * 0.08) * pxPerMm;
            ctx.font = `700 ${Math.round(fontSizeNamePx)}px sans-serif`;
            ctx.textAlign = 'center';
            wrapText(ctx, item.designation, x + cellW / 2, y + logoPx + padPx + fontSizeNamePx, cellW - (2 * pxPerMm), fontSizeNamePx * 1.1);

            // 3. Draw QR Code
            const qrCanvas = document.createElement('canvas');
            const qrUrl = `${config.api.workerUrl}/material?ref=${item.qr_ref}`;
            await QRCode.toCanvas(qrCanvas, qrUrl, { width: qrPx - (2 * pxPerMm), margin: 1, color: { dark: '#000000', light: '#ffffff' } });
            ctx.drawImage(qrCanvas, x + (1 * pxPerMm), y + logoPx + namePx + padPx);

            // 4. Draw Ref (Bottom)
            ctx.fillStyle = '#000000';
            const fontSizeRefPx = Math.max(2, sizeMm * 0.1) * pxPerMm;
            ctx.font = `bold ${Math.round(fontSizeRefPx)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(item.qr_ref, x + cellW / 2, y + logoPx + namePx + qrPx + padPx + fontSizeRefPx);
        }

        // Footer
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Page ${page + 1}/${totalPages} — Pouchain App (GT)`, pageW - margin, pageH - 10);

        pages.push(canvas);
        btn.innerText = `⏳ Page ${page + 1}/${totalPages}...`;
    }

    // Export all pages into a single PDF using jsPDF
    btn.innerText = '⏳ Création du PDF...';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();
        doc.addImage(pages[i].toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
    doc.save('QR_Codes_Pouchain_GT.pdf');

    btn.disabled = false;
    btn.innerText = origText;
    showToast(`PDF exporté — ${pages.length} page(s), ${stock.length} QR codes`);
};

window.updateMaterialAspiStockBadge = async function () {
    await window.updateAllBadges();
    
    // Alerte stock bas (exécutée localement)
    try {
        const stock = await api.getMaterialAspiStock();
        let alertCount = 0;
        stock.forEach(item => {
            const currentQty = parseInt(item.quantite) || 0;
            const targetQty = parseInt(item.cible) || 0;
            if (currentQty < targetQty) {
                alertCount++;
            }
        });
        const alertBadge = document.getElementById('mat-stock-aspi-alert-badge');
        if (alertBadge) {
            if (alertCount > 0) {
                alertBadge.style.display = 'flex';
                alertBadge.textContent = alertCount;
            } else {
                alertBadge.style.display = 'none';
            }
        }
    } catch (e) { /* silent */ }
};

window.renderAdminMaterialAspiTracking = async function () {
    const content = document.getElementById('admin-content');
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-material-stock-aspi');
    if (navItem) navItem.classList.add('active');

    content.innerHTML = `
        <style>
            @keyframes pulse-red-card {
                0% { border-color: rgba(255, 59, 48, 0.35); box-shadow: 0 0 5px rgba(255, 59, 48, 0.1); }
                50% { border-color: rgba(255, 59, 48, 0.85); box-shadow: 0 0 15px rgba(255, 59, 48, 0.4); background: rgba(255, 59, 48, 0.08); }
                100% { border-color: rgba(255, 59, 48, 0.35); box-shadow: 0 0 5px rgba(255, 59, 48, 0.1); }
            }
            .pulse-red-card-anim {
                animation: pulse-red-card 2s infinite !important;
            }
        </style>
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #FF9500, #FF3B30); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(255, 149, 0, 0.3);">
                        <span style="font-size: 28px;">🧹</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Statut du matériel Aspirateur</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Consommables et accessoires d'aspirateurs (Flexible, Sacs, Filtres, Cartouches...)</p>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn-primary" id="material-aspi-requests-btn" onclick="window.openMaterialAspiRequestsModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #FF9500; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s; position: relative;">
                        <span style="font-size: 18px;">🔔</span> Demandes
                        <span id="aspi-requests-badge" style="display: none; position: absolute; top: -5px; right: -5px; background: #FF3B30; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; border: 2px solid #1c1c1e;">0</span>
                    </button>
                    <button class="btn-primary" onclick="window.openEditMaterialAspiModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #FF9500; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 18px;">+</span> Ajouter Pièce
                    </button>
                    <button onclick="window.openQrAspiExportModal()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 8px; color: white; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Exporter QR Codes PDF Aspi">
                        <span style="font-size: 16px;">📱</span> QR Codes
                    </button>
                    <button onclick="window.exportMaterialAspiToExcel()" style="border-radius: 12px; height: 46px; padding: 0 16px; background: rgba(255, 149, 0, 0.1); border: 1px solid rgba(255, 149, 0, 0.2); display: flex; align-items: center; gap: 8px; color: #FF9500; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Exporter vers Excel (CSV)">
                        <span style="font-size: 16px;">📊</span> Exporter
                    </button>
                    <button onclick="window.renderAdminMaterialAspiTracking()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 24px; padding: 0 10px; flex-wrap: wrap;">
                <div style="position: relative; flex: 1; min-width: 200px;">
                    <input type="text" id="material-aspi-search" placeholder="Rechercher par désignation, référence, QR..." style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 16px 0 45px; font-size: 14px; outline: none;">
                    <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; opacity: 0.5;">🔍</span>
                </div>
                <div style="position: relative; min-width: 180px;">
                    <select id="material-aspi-filter-location" style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 35px 0 16px; font-size: 14px; appearance: none; cursor: pointer; outline: none; font-weight: 600;">
                        <option value="" style="background: #1c1c1e;">📍 Tous les lieux</option>
                    </select>
                    <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
                </div>
                <div style="position: relative; min-width: 220px;">
                    <select id="material-aspi-filter-compat" style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 35px 0 16px; font-size: 14px; appearance: none; cursor: pointer; outline: none; font-weight: 600;">
                        <option value="" style="background: #1c1c1e;">🧹 Modèle d'aspirateur</option>
                        <option value="aspi_h13" style="background: #1c1c1e;">H13 HZ200/HZ200</option>
                        <option value="aspi_hz390" style="background: #1c1c1e;">HZ 390S-2 / HZ 390S</option>
                        <option value="aspi_hzd900" style="background: #1c1c1e;">HZD 900 / HZDQ900</option>
                    </select>
                    <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
                </div>
                <div style="position: relative; min-width: 160px;">
                    <select id="material-aspi-filter-cat" style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 35px 0 16px; font-size: 14px; appearance: none; cursor: pointer; outline: none; font-weight: 600;">
                        <option value="" style="background: #1c1c1e;">📁 Toutes catégories</option>
                        <option value="FLEXIBLE" style="background: #1c1c1e;">FLEXIBLE</option>
                        <option value="BEC SUCEUR" style="background: #1c1c1e;">BEC SUCEUR</option>
                        <option value="FILTRE PRIMAIRE" style="background: #1c1c1e;">FILTRE PRIMAIRE</option>
                        <option value="SACS" style="background: #1c1c1e;">SACS</option>
                        <option value="CARTOUCHE" style="background: #1c1c1e;">CARTOUCHE</option>
                        <option value="Autre" style="background: #1c1c1e;">Autre</option>
                    </select>
                    <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5;">▼</span>
                </div>
                <span id="material-aspi-count-badge" style="font-size: 12px; color: #8E8E93; font-weight: 600; white-space: nowrap;">— articles</span>
            </div>

            <div id="material-aspi-list-container" style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <div id="material-aspi-list-loader" style="text-align:center; padding: 80px;">
                    <div class="loader" style="border: 3px solid rgba(255,255,255,0.1); border-top-color: #FF9500; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <div id="material-aspi-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding-bottom: 40px;"></div>
            </div>
        </div>
    `;

    window.updateMaterialAspiStockBadge();

    try {
        const stock = await api.getMaterialAspiStock();
        window._currentAspiStock = stock;

        const locations = [...new Set(stock.map(s => s.lieu_de_stockage).filter(Boolean))].sort();
        const filterSelect = document.getElementById('material-aspi-filter-location');
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc;
            opt.textContent = loc;
            opt.style.background = '#1c1c1e';
            opt.style.color = 'white';
            filterSelect.appendChild(opt);
        });

        const ASPI_COMPAT = ['aspi_h13', 'aspi_hz390', 'aspi_hzd900'];
        const ASPI_COMPAT_LABELS = { aspi_h13: 'H13 HZ200/HZ200', aspi_hz390: 'HZ 390S-2 / HZ 390S', aspi_hzd900: 'HZD 900 / HZDQ900' };

        const renderGrid = (items) => {
            const grid = document.getElementById('material-aspi-grid');
            const countBadge = document.getElementById('material-aspi-count-badge');
            if (countBadge) countBadge.innerText = `${items.length} article${items.length !== 1 ? 's' : ''}`;
            if (items.length === 0) {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #71717a; padding: 120px; font-size: 18px;">Aucune pièce trouvée</div>`;
                return;
            }
            grid.innerHTML = items.map(item => {
                const compatBadges = ASPI_COMPAT
                    .map(k => item[k] ? `<span style="font-size: 10px; color: #FF9500; background: rgba(255,149,0,0.12); padding: 3px 7px; border-radius: 6px; font-weight: 800; border: 1px solid rgba(255,149,0,0.2);">${ASPI_COMPAT_LABELS[k]}</span>` : '')
                    .join('');

                const currentQty = parseInt(item.quantite) || 0;
                const targetQty = parseInt(item.cible) || 0;
                const isUnderTarget = currentQty < targetQty;

                const cardBorder = isUnderTarget ? '1px solid rgba(255, 59, 48, 0.35)' : '1px solid rgba(255,255,255,0.05)';
                const cardBg = isUnderTarget ? 'rgba(255, 59, 48, 0.04)' : 'rgba(45, 45, 50, 0.4)';
                const cardClass = isUnderTarget ? 'material-card pulse-red-card-anim' : 'material-card';
                const qtyBadgeBg = isUnderTarget ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255,149,0,0.12)';
                const qtyBadgeColor = isUnderTarget ? '#FF3B30' : '#FF9500';
                const qtyBadgeBorder = isUnderTarget ? '1px solid rgba(255, 59, 48, 0.3)' : '1px solid rgba(255,149,0,0.2)';
                const bottomLineColor = isUnderTarget ? '#FF3B30' : '#FF9500';

                return `
                    <div class="${cardClass}" onclick="window.openEditMaterialAspiModal('${item.id}')" style="background: ${cardBg}; backdrop-filter: blur(20px); border: ${cardBorder}; border-radius: 24px; padding: 24px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; gap: 16px; position: relative; overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                            <div style="display: flex; gap: 15px; flex: 1;">
                                <div style="width: 60px; height: 60px; border-radius: 14px; background: ${item.photo_url ? '#000' : 'rgba(255,255,255,0.03)'}; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                                    ${item.photo_url ? `<img src="${config.api.workerUrl}/get/${item.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 24px;">🧹</span>`}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 800; color: white; font-size: 15px; line-height: 1.3; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.designation || 'Sans nom'}</div>
                                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        ${item.qr_ref ? `<span style="font-size: 9px; color: #FF9500; background: rgba(255,149,0,0.1); padding: 3px 6px; border-radius: 5px; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; border: 1px solid rgba(255,149,0,0.15);">${item.qr_ref}</span>` : ''}
                                        ${item.ref ? `<span style="font-size: 9px; color: #8E8E93; background: rgba(142,142,147,0.1); padding: 3px 6px; border-radius: 5px; font-weight: 700; border: 1px solid rgba(142,142,147,0.15);">${item.ref}</span>` : ''}
                                        ${item.categorie ? `<span style="font-size: 9px; color: #5856D6; background: rgba(88,86,214,0.1); padding: 3px 6px; border-radius: 5px; font-weight: 700; border: 1px solid rgba(88,86,214,0.15);">${item.categorie}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                                <div style="display: flex; gap: 8px;">
                                    <div style="display: flex; flex-direction: column; align-items: center;">
                                        <div style="background: ${qtyBadgeBg}; color: ${qtyBadgeColor}; min-width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; border: ${qtyBadgeBorder}; padding: 0 8px; text-align: center;">
                                            ${item.quantite || '0'}
                                        </div>
                                        <div style="font-size: 9px; color: #8E8E93; margin-top: 4px; font-weight: 700; text-transform: uppercase;">Stock</div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; align-items: center;">
                                        <div style="background: rgba(255,255,255,0.05); color: #FFFFFF; min-width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; border: 1px solid rgba(255,255,255,0.1); padding: 0 8px; text-align: center;">
                                            ${item.cible || '0'}
                                        </div>
                                        <div style="font-size: 9px; color: #8E8E93; margin-top: 4px; font-weight: 700; text-transform: uppercase;">Cible</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Compatibility badges -->
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${compatBadges || '<span style="font-size: 11px; color: #48484A;">Aucune compatibilité</span>'}
                        </div>

                        <!-- Location -->
                        <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 14px;">
                            <div style="display: flex; align-items: center; gap: 6px; color: #8E8E93; font-size: 12px; font-weight: 500;">
                                <span style="font-size: 14px;">📍</span> ${item.lieu_de_stockage || 'Non localisé'}
                            </div>
                        </div>
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: ${bottomLineColor}; opacity: 0.5;"></div>
                    </div>
                `;
            }).join('');
        };

        const loader = document.getElementById('material-aspi-list-loader');
        if (loader) loader.remove();
        renderGrid(stock);

        const searchInput = document.getElementById('material-aspi-search');
        const locationFilter = document.getElementById('material-aspi-filter-location');
        const compatFilter = document.getElementById('material-aspi-filter-compat');
        const catFilter = document.getElementById('material-aspi-filter-cat');

        const handleFilter = () => {
            const search = searchInput.value.toLowerCase();
            const location = locationFilter.value;
            const compat = compatFilter.value;
            const category = catFilter.value;
            const filtered = stock.filter(s => {
                const matchesSearch = !search ||
                    (s.designation || '').toLowerCase().includes(search) ||
                    (s.ref || '').toLowerCase().includes(search) ||
                    (s.qr_ref || '').toLowerCase().includes(search) ||
                    (s.lieu_de_stockage || '').toLowerCase().includes(search);
                const matchesLocation = !location || s.lieu_de_stockage === location;
                const matchesCompat = !compat || s[compat] === true;
                const matchesCategory = !category || s.categorie === category;
                return matchesSearch && matchesLocation && matchesCompat && matchesCategory;
            });
            renderGrid(filtered);
        };

        searchInput.oninput = handleFilter;
        locationFilter.onchange = handleFilter;
        compatFilter.onchange = handleFilter;
        catFilter.onchange = handleFilter;

        // Update badge in sidebar
        const requests = await api.getMaterialAspiStockRequests().catch(() => []);
        const badge = document.getElementById('aspi-requests-badge');
        if (badge && requests.length > 0) {
            badge.style.display = 'flex';
            badge.textContent = requests.length;
        }

    } catch (e) {
        console.error(e);
        document.getElementById('material-aspi-list-container').innerHTML = `<div style="color:red; padding: 20px;">Erreur lors du chargement: ${e.message}</div>`;
    }
};

window.openEditMaterialAspiModal = async function (id = null) {
    const isMobile = window.innerWidth <= 768;
    const ASPI_COMPAT = ['aspi_h13', 'aspi_hz390', 'aspi_hzd900'];
    const ASPI_COMPAT_LABELS = { aspi_h13: 'H13 HZ200/HZ200', aspi_hz390: 'HZ 390S-2 / HZ 390S', aspi_hzd900: 'HZD 900 / HZDQ900' };

    const item = id ? (window._currentAspiStock || []).find(s => s.id === id) : {
        designation: '', ref: '', quantite: '0', lieu_de_stockage: '', categorie: '',
        aspi_h13: false, aspi_hz390: false, aspi_hzd900: false, cible: '0'
    };
    if (!item) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000000';
    modal.style.backdropFilter = 'blur(8px)';

    const compatCheckboxes = ASPI_COMPAT.map(k => `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); transition: 0.2s;" onmouseover="this.style.background='rgba(255,149,0,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
            <input type="checkbox" id="aspi-compat-${k}" name="${k}" ${item[k] ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #FF9500; cursor: pointer;">
            <span style="font-size: 14px; font-weight: 700; color: white;">${ASPI_COMPAT_LABELS[k]}</span>
        </label>
    `).join('');

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 650px; padding: ${isMobile ? '24px' : '40px'}; border-radius: 32px; background: rgba(28,28,30,0.92); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1); max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <h2 style="margin:0; font-size: ${isMobile ? '20px' : '24px'}; font-weight: 800;">${id ? 'Modifier' : 'Ajouter'} Pièce Aspi</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
            </div>

            ${id && item.qr_ref ? `
            <div style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px; color: #FF9500; text-transform: uppercase; font-weight: 700;">📱 QR Code — ${item.qr_ref}</h3>
                <div style="display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">
                    <canvas id="qr-aspi-canvas-modal" style="border-radius: 8px; background: white; padding: 8px;"></canvas>
                    <div style="flex: 1;">
                        <div style="font-family: monospace; font-size: 22px; color: #FF9500; font-weight: 900; margin-bottom: 8px;">${item.qr_ref}</div>
                        <div style="font-size: 12px; color: #8E8E93; margin-bottom: 16px;">Scannez ce QR code pour accéder directement à cette fiche matériel Aspi.</div>
                        <button type="button" onclick="window.downloadSingleQr('${item.qr_ref}', '${(item.designation || 'materiel').replace(/'/g, "\\\\'")}')" style="padding: 10px 16px; background: #FF9500; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 13px;">📥 Télécharger ce QR</button>
                    </div>
                </div>
            </div>
            ` : ''}

            <form id="edit-material-aspi-form" style="display: flex; flex-direction: column; gap: 20px;">
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Désignation *</label>
                    <input type="text" name="designation" value="${item.designation || ''}" class="form-input" style="width:100%;" required>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Référence Fournisseur</label>
                        <input type="text" name="ref" value="${item.ref || ''}" class="form-input" style="width:100%; font-family: monospace;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Catégorie</label>
                        <select name="categorie" class="form-input" style="width:100%;">
                            <option value="FLEXIBLE" ${item.categorie === 'FLEXIBLE' ? 'selected' : ''}>FLEXIBLE</option>
                            <option value="BEC SUCEUR" ${item.categorie === 'BEC SUCEUR' ? 'selected' : ''}>BEC SUCEUR</option>
                            <option value="FILTRE PRIMAIRE" ${item.categorie === 'FILTRE PRIMAIRE' ? 'selected' : ''}>FILTRE PRIMAIRE</option>
                            <option value="SACS" ${item.categorie === 'SACS' ? 'selected' : ''}>SACS</option>
                            <option value="CARTOUCHE" ${item.categorie === 'CARTOUCHE' ? 'selected' : ''}>CARTOUCHE</option>
                            <option value="Autre" ${item.categorie === 'Autre' || !item.categorie ? 'selected' : ''}>Autre</option>
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                    <div>
                        <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Quantité</label>
                        <input type="text" name="quantite" value="${item.quantite || '0'}" class="form-input" style="width:100%;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Quantité Cible</label>
                        <input type="text" name="cible" value="${item.cible || '0'}" class="form-input" style="width:100%;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Lieu de Stockage</label>
                        <input type="text" name="lieu_de_stockage" value="${item.lieu_de_stockage || ''}" class="form-input" style="width:100%;">
                    </div>
                </div>

                <!-- Compatibility Checkboxes -->
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:12px; font-weight:700; text-transform:uppercase;">Compatibilité Modèles</label>
                    <div style="display:flex; flex-wrap:wrap; gap:10px;">
                        ${compatCheckboxes}
                    </div>
                </div>

                <!-- Image Picker -->
                <div>
                    <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:8px; font-weight:700; text-transform:uppercase;">Photo</label>
                    <div style="display:flex; gap:15px; align-items:center;">
                        <div id="aspi-photo-preview" style="width:70px; height:70px; border-radius:12px; border:2px dashed rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; overflow:hidden; background:rgba(0,0,0,0.2);">
                            ${item.photo_url ? `<img src="${config.api.workerUrl}/get/${item.photo_url}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size: 24px;">📷</span>'}
                        </div>
                        <input type="file" id="aspi-photo-input" accept="image/*" style="display:none;">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('aspi-photo-input').click()" style="height: 40px; padding: 0 16px; font-size: 13px; border-radius: 10px;">Choisir une image</button>
                        ${item.photo_url ? `<button type="button" id="aspi-photo-delete-btn" class="btn-secondary" style="height: 40px; padding: 0 16px; font-size: 13px; border-radius: 10px; background: rgba(255,59,48,0.1); border-color: rgba(255,59,48,0.2); color: #FF3B30;">Supprimer la photo</button>` : ''}
                    </div>
                </div>

                <!-- Action buttons -->
                <div style="display:flex; gap:15px; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:25px;">
                    ${id ? `<button type="button" id="aspi-delete-btn" style="padding:0 24px; height:48px; border-radius:12px; background:rgba(255,59,48,0.15); border:1px solid rgba(255,59,48,0.25); color:#FF3B30; font-weight:700; cursor:pointer; font-size:14px; transition: 0.2s;">Supprimer</button>` : ''}
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="flex:1; height:48px; border-radius:12px; font-size:14px;">Annuler</button>
                    <button type="submit" class="btn-primary" style="flex:1.5; height:48px; border-radius:12px; font-size:14px; font-weight:800; background:#FF9500; border:none; color:white; cursor:pointer; box-shadow:0 8px 16px rgba(255,149,0,0.25);">${id ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
            </form>

            ${id ? `
            <div style="margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 25px;">
                <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 14px; color: #8E8E93; text-transform: uppercase; font-weight: 700;">📋 Historique des modifications</h3>
                <div id="aspi-history-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto;">
                    <div style="text-align: center; color: #8E8E93; padding: 20px;">Chargement...</div>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);

    // Render Modal QR code if exists
    if (id && item.qr_ref) {
        setTimeout(() => {
            const qrCanvas = document.getElementById('qr-aspi-canvas-modal');
            if (qrCanvas) {
                const qrUrl = `${config.api.workerUrl}/material?ref=${item.qr_ref}`;
                QRCode.toCanvas(qrCanvas, qrUrl, { width: 100, margin: 1 });
            }
        }, 100);
    }

    // Load History if exists
    if (id) {
        api.getMaterialAspiHistory(id).then(logs => {
            const container = document.getElementById('aspi-history-list');
            if (!container) return;
            if (logs.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: #8E8E93; font-size: 13px;">Aucun historique pour cette pièce.</div>`;
                return;
            }
            container.innerHTML = logs.map(l => {
                const date = new Date(l.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                const userName = l.profiles ? `${l.profiles.first_name || ''} ${l.profiles.last_name || ''}`.trim() : 'Admin';
                return `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; font-size: 12px;">
                        <div style="flex:1;">
                            <div style="color:white; font-weight: 600; margin-bottom: 2px;">${l.details}</div>
                            <div style="color:#8E8E93; font-size:11px;">Par ${userName} • Action: ${l.action}</div>
                        </div>
                        <div style="color:#8E8E93; font-size: 10px; font-family: monospace;">${date}</div>
                    </div>
                `;
            }).join('');
        }).catch(() => {
            const container = document.getElementById('aspi-history-list');
            if (container) container.innerHTML = `<div style="color:red; text-align:center;">Erreur historique</div>`;
        });
    }

    // Photo picker logic
    const photoInput = document.getElementById('aspi-photo-input');
    const photoPreview = document.getElementById('aspi-photo-preview');
    let selectedPhotoFile = null;

    photoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedPhotoFile = file;
            const reader = new FileReader();
            reader.onload = (re) => {
                photoPreview.innerHTML = `<img src="${re.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
        }
    };

    // Photo delete button
    const photoDeleteBtn = document.getElementById('aspi-photo-delete-btn');
    if (photoDeleteBtn) {
        photoDeleteBtn.onclick = async () => {
            if (confirm('Voulez-vous supprimer définitivement la photo de cette pièce ?')) {
                try {
                    await api.deleteMaterialAspiPhoto(item.photo_url);
                    await api.updateMaterialAspiStock(item.id, { photo_url: null });
                    photoPreview.innerHTML = '<span style="font-size: 24px;">📷</span>';
                    photoDeleteBtn.remove();
                    window.showToast('✅ Photo supprimée');
                    window.renderAdminMaterialAspiTracking();
                } catch (err) {
                    alert('Erreur: ' + err.message);
                }
            }
        };
    }

    // Delete piece button
    const deleteBtn = document.getElementById('aspi-delete-btn');
    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (confirm('Voulez-vous vraiment supprimer définitivement cette pièce du stock ?')) {
                try {
                    if (item.photo_url) {
                        await api.deleteMaterialAspiPhoto(item.photo_url).catch(() => { });
                    }
                    await api.deleteMaterialAspiStock(item.id);
                    modal.remove();
                    window.showToast('🗑️ Pièce supprimée');
                    window.renderAdminMaterialAspiTracking();
                } catch (err) {
                    alert('Erreur de suppression: ' + err.message);
                }
            }
        };
    }

    // Form Submit
    const form = document.getElementById('edit-material-aspi-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Enregistrement...';

        try {
            const formData = new FormData(form);
            const updates = {
                designation: formData.get('designation').trim(),
                ref: formData.get('ref').trim(),
                categorie: formData.get('categorie'),
                quantite: formData.get('quantite').trim(),
                cible: formData.get('cible').trim(),
                lieu_de_stockage: formData.get('lieu_de_stockage').trim(),
                aspi_h13: document.getElementById('aspi-compat-aspi_h13').checked,
                aspi_hz390: document.getElementById('aspi-compat-aspi_hz390').checked,
                aspi_hzd900: document.getElementById('aspi-compat-aspi_hzd900').checked
            };

            let savedItem;
            if (id) {
                // Update
                savedItem = await api.updateMaterialAspiStock(id, updates);
                await api.addMaterialAspiLog(id, 'Edition', `Modification de la pièce par l'administrateur`);
            } else {
                // Creation
                savedItem = await api.createMaterialAspiStock(updates);
                await api.addMaterialAspiLog(savedItem.id, 'Création', `Création initiale de la pièce dans le stock`);
            }

            // If photo selected, upload it
            if (selectedPhotoFile) {
                submitBtn.innerText = 'Upload photo...';
                const uploadResult = await api.uploadMaterialAspiPhoto(savedItem.id, selectedPhotoFile, false);
                await api.updateMaterialAspiStock(savedItem.id, { photo_url: uploadResult.key });
            }

            modal.remove();
            window.showToast('💾 Modifications enregistrées avec succès');
            window.renderAdminMaterialAspiTracking();
        } catch (err) {
            alert('Erreur lors de l\'enregistrement : ' + err.message);
            submitBtn.disabled = false;
            submitBtn.innerText = id ? 'Enregistrer' : 'Ajouter';
        }
    };
};

window.openMaterialAspiRequestsModal = async function () {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '100000';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 750px; padding: 40px; border-radius: 32px; background: rgba(28,28,30,0.95); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); max-height: 85vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 800;">🔔 Demandes de modifications - Stock Aspi</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div id="aspi-requests-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; padding-right: 5px;">
                <div style="text-align: center; color: #8E8E93; padding: 40px;">Chargement...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const requests = await api.getMaterialAspiStockRequests();
        const container = document.getElementById('aspi-requests-list');
        if (!container) return;

        if (requests.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #8E8E93; font-style: italic;">
                    Aucune demande de modification en attente pour le stock Aspirateur.
                </div>
            `;
            return;
        }

        container.innerHTML = requests.map(r => {
            const dateStr = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const userFullName = r.profiles ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() : 'Utilisateur inconnu';
            const aspi = r.material_stock_aspirateur || {};
            return `
                <div id="aspi-req-${r.id}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 15px; transition: 0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span style="font-size: 11px; background: rgba(255,149,0,0.15); color: #FF9500; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">Aspirateur</span>
                            <h3 style="margin: 6px 0 2px 0; font-size: 16px; font-weight: 700; color: white;">${aspi.designation || 'Sans nom'}</h3>
                            <div style="font-size: 12px; color: #8E8E93;">Demandé par <b>${userFullName}</b> • le ${dateStr}</div>
                        </div>
                        ${r.new_photo_url ? `<a href="${config.api.workerUrl}/get/${r.new_photo_url}" target="_blank" style="width: 50px; height: 50px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);"><img src="${config.api.workerUrl}/get/${r.new_photo_url}" style="width:100%; height:100%; object-fit:cover;"></a>` : ''}
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: rgba(0,0,0,0.2); padding: 12px 16px; border-radius: 14px; font-size: 13px;">
                        <div>
                            <div style="color: #8E8E93; margin-bottom: 4px; font-weight: 600;">Quantité</div>
                            <div style="color: white; font-weight: 700;">${aspi.quantite || '0'} ➔ <span style="color: #FF9500; font-size: 15px;">${r.new_quantite}</span></div>
                        </div>
                        <div>
                            <div style="color: #8E8E93; margin-bottom: 4px; font-weight: 600;">Emplacement</div>
                            <div style="color: white; font-weight: 700;">${aspi.lieu_de_stockage || 'Non défini'} ➔ <span style="color: #34C759;">${r.new_lieu_de_stockage}</span></div>
                        </div>
                    </div>

                    ${r.comment ? `
                    <div style="font-size: 13px; color: #FF9500; background: rgba(255,149,0,0.06); border: 1px solid rgba(255,149,0,0.1); padding: 10px 14px; border-radius: 12px; line-height: 1.4;">
                        <b>Motif :</b> "${r.comment}"
                    </div>
                    ` : ''}

                    <div style="display: flex; gap: 12px; align-items: center; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 5px;">
                        <button onclick="window.handleAspiRequestDecision('${r.id}', 'rejected')" style="padding: 10px 18px; border-radius: 10px; background: rgba(255,59,48,0.1); border: 1px solid rgba(255,59,48,0.2); color: #FF3B30; font-weight: 700; cursor: pointer; font-size: 13px;">Refuser</button>
                        <button onclick="window.handleAspiRequestDecision('${r.id}', 'approved')" style="padding: 10px 18px; border-radius: 10px; background: #FF9500; border: none; color: white; font-weight: 800; cursor: pointer; font-size: 13px; box-shadow: 0 4px 10px rgba(255,149,0,0.25);">Approuver</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        const container = document.getElementById('aspi-requests-list');
        if (container) container.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">Erreur lors du chargement.</div>`;
    }
};

window.handleAspiRequestDecision = async function (requestId, status) {
    try {
        await api.updateMaterialAspiStockRequestStatus(requestId, status);
        const card = document.getElementById(`aspi-req-${requestId}`);
        if (card) {
            card.style.opacity = '0.4';
            card.style.pointerEvents = 'none';
            card.style.borderColor = status === 'approved' ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)';
        }
        window.showToast(status === 'approved' ? '✅ Demande Aspi approuvée' : '❌ Demande Aspi refusée');
        window.updateMaterialAspiStockBadge();
        if (window._currentAspiStock) window.renderAdminMaterialAspiTracking();
    } catch (e) {
        window.showToast('❌ Erreur: ' + e.message);
    }
};

window.openQrAspiExportModal = function () {
    const stock = window._currentAspiStock;
    if (!stock || stock.length === 0) { window.showToast('⚠️ Aucun matériel chargé'); return; }
    window.openQrExportModalWithOptions('aspi', stock);
};

window.openQrExportModalWithOptions = async function (type, stock) {
    const withRef = stock.filter(s => s.qr_ref);
    const withoutRef = stock.filter(s => !s.qr_ref);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000000';
    modal.style.backdropFilter = 'blur(8px)';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 600px; padding: 40px; border-radius: 32px; background: rgba(28, 28, 30, 0.9); backdrop-filter: blur(30px); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <h2 style="margin:0; font-size: 24px; font-weight: 800;">📱 Gestion QR Codes ${type.toUpperCase()}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color: #8E8E93; font-size: 24px; cursor: pointer;">&times;</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
                <div style="background: rgba(52, 199, 89, 0.1); border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 16px; padding: 20px; text-align: center;">
                    <div style="font-size: 32px; font-weight: 900; color: #34C759;">${withRef.length}</div>
                    <div style="font-size: 12px; color: #8E8E93; font-weight: 600;">AVEC REF QR</div>
                </div>
                <div style="background: rgba(255, 149, 0, 0.1); border: 1px solid rgba(255, 149, 0, 0.2); border-radius: 16px; padding: 20px; text-align: center;">
                    <div style="font-size: 32px; font-weight: 900; color: #FF9500;">${withoutRef.length}</div>
                    <div style="font-size: 12px; color: #8E8E93; font-weight: 600;">SANS REF QR</div>
                </div>
            </div>

            ${withoutRef.length > 0 ? `
            <button onclick="window.batchGenerate${type === 'aspi' ? 'Aspi' : 'GT'}Refs(this)" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #FF9500, #FF3B30); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; margin-bottom: 20px; transition: 0.2s;">
                ⚡ Attribuer les références aux ${withoutRef.length} matériels manquants
            </button>` : ''}

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size:12px; color:#8E8E93; margin-bottom:10px; font-weight:700; text-transform:uppercase;">Taille des QR codes sur le PDF</label>
                <select id="qr-${type}-size-select" style="width:100%; background:#2C2C2E; border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; padding:12px; font-size:15px; outline:none;">
                    <option value="30">Mini (30×30 mm)</option>
                    <option value="60">Petit (60×60 mm) — 6 par page (2×3)</option>
                    <option value="80" selected>Moyen (80×80 mm) — 4 par page (2×2)</option>
                    <option value="100">Grand (100×100 mm) — 2 par page (1×2)</option>
                    <option value="120">Très grand (120×120 mm) — 1 par page</option>
                </select>
            </div>

            <button onclick="window.exportAll${type === 'aspi' ? 'Aspi' : 'GT'}QrPdf(this)" style="width: 100%; padding: 16px; background: #FF9500; color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; transition: 0.2s;" ${withRef.length === 0 ? 'disabled style="opacity:0.5"' : ''}>
                📥 Exporter tous les QR codes en PDF (${withRef.length} matériels)
            </button>
            <p style="font-size: 11px; color: #8E8E93; text-align: center; margin-top: 12px;">Les QR codes seront disposés automatiquement sur des feuilles A4</p>
        </div>
    `;
    document.body.appendChild(modal);
};

window.batchGenerateAspiRefs = async function (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Attribution en cours...';
    try {
        const result = await api.generateMaterialAspiRefs();
        showToast(result.message || `${result.count} références générées`);
        btn.closest('.modal-overlay').remove();
        renderAdminMaterialAspiTracking();
    } catch (err) {
        alert('Erreur: ' + err.message);
        btn.disabled = false;
        btn.innerText = '⚡ Réessayer';
    }
};

window.exportAllAspiQrPdf = async function (btn) {
    if (typeof QRCode === 'undefined') { alert('QR library not loaded'); return; }
    const stock = (window._currentAspiStock || []).filter(s => s.qr_ref);
    if (stock.length === 0) { alert('Aucun matériel avec référence QR'); return; }

    btn.disabled = true;
    const origText = btn.innerText;
    btn.innerText = '⏳ Génération du PDF...';

    // Load Logo
    const logoImg = new Image();
    logoImg.src = 'logo-pouchain.svg';
    await new Promise(r => logoImg.onload = r);

    const sizeMm = parseInt(document.getElementById('qr-aspi-size-select').value) || 80;
    const pxPerMm = 11.81; // 300 DPI (300 / 25.4)

    // Space allocations
    const logoHMm = sizeMm < 40 ? 6 : 12;
    const nameHMm = sizeMm < 40 ? 8 : 12;
    const refHMm = sizeMm < 40 ? 5 : 8;
    const paddingMm = 2;

    const qrPx = Math.round(sizeMm * pxPerMm);
    const logoPx = Math.round(logoHMm * pxPerMm);
    const namePx = Math.round(nameHMm * pxPerMm);
    const refPx = Math.round(refHMm * pxPerMm);
    const padPx = Math.round(paddingMm * pxPerMm);

    const cellW = qrPx;
    const cellH = logoPx + namePx + qrPx + refPx + (padPx * 2);

    const marginMm = sizeMm < 40 ? 5 : 10;
    const margin = Math.round(marginMm * pxPerMm);
    const pageW = Math.round(210 * pxPerMm); // A4 width
    const pageH = Math.round(297 * pxPerMm); // A4 height

    const cols = Math.floor((pageW - margin) / (cellW + margin)) || 1;
    const rows = Math.floor((pageH - margin) / (cellH + margin)) || 1;
    const perPage = cols * rows;
    const totalPages = Math.ceil(stock.length / perPage);

    const pages = [];

    // Helper for text wrapping
    const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
        const words = (text || '').split(' ');
        let line = '';
        let currentY = y;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    };

    for (let page = 0; page < totalPages; page++) {
        const canvas = document.createElement('canvas');
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);

        const pageStock = stock.slice(page * perPage, (page + 1) * perPage);

        for (let idx = 0; idx < pageStock.length; idx++) {
            const item = pageStock[idx];
            const col = idx % cols;
            const row = Math.floor(idx / cols);

            // Compute positions
            const x = margin + col * (cellW + margin);
            const y = margin + row * (cellH + margin);

            // Draw outer border (light gray)
            ctx.strokeStyle = '#e1e1e1';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellW, cellH);

            // 1. Draw logo
            ctx.drawImage(logoImg, x + cellW / 2 - (35 * pxPerMm) / 2, y + padPx, 35 * pxPerMm, logoPx - padPx);

            // 2. Draw Designation
            ctx.fillStyle = '#000000';
            const fontSizeNamePx = Math.max(3, sizeMm * 0.08) * pxPerMm;
            ctx.font = `bold ${Math.round(fontSizeNamePx)}px sans-serif`;
            ctx.textAlign = 'center';
            wrapText(ctx, item.designation, x + cellW / 2, y + logoPx + padPx + fontSizeNamePx, cellW - (2 * pxPerMm), fontSizeNamePx * 1.1);

            // 3. Draw QR Code
            const qrCanvas = document.createElement('canvas');
            const qrUrl = `${config.api.workerUrl}/material?ref=${item.qr_ref}`;
            await QRCode.toCanvas(qrCanvas, qrUrl, { width: qrPx - (2 * pxPerMm), margin: 1, color: { dark: '#000000', light: '#ffffff' } });
            ctx.drawImage(qrCanvas, x + (1 * pxPerMm), y + logoPx + namePx + padPx);

            // 4. Draw Ref (Bottom)
            ctx.fillStyle = '#000000';
            const fontSizeRefPx = Math.max(2, sizeMm * 0.1) * pxPerMm;
            ctx.font = `bold ${Math.round(fontSizeRefPx)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(item.qr_ref, x + cellW / 2, y + logoPx + namePx + qrPx + padPx + fontSizeRefPx);
        }

        // Footer
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Page ${page + 1}/${totalPages} — Pouchain App (Aspi)`, pageW - margin, pageH - 10);

        pages.push(canvas);
        btn.innerText = `⏳ Page ${page + 1}/${totalPages}...`;
    }

    // Export all pages into a single PDF using jsPDF
    btn.innerText = '⏳ Création du PDF...';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();
        doc.addImage(pages[i].toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
    doc.save('QR_Codes_Pouchain_Aspi.pdf');

    btn.disabled = false;
    btn.innerText = origText;
    showToast(`PDF exporté — ${pages.length} page(s), ${stock.length} QR codes`);
};

window.exportMaterialAspiToExcel = function () {
    const stock = window._currentAspiStock;
    if (!stock || stock.length === 0) { window.showToast('⚠️ Aucune donnée à exporter'); return; }
    const ASPI_COMPAT = ['aspi_h13', 'aspi_hz390', 'aspi_hzd900'];
    const ASPI_COMPAT_LABELS = { aspi_h13: 'H13 HZ200/HZ200', aspi_hz390: 'HZ 390S-2 / HZ 390S', aspi_hzd900: 'HZD 900 / HZDQ900' };
    const headers = ['QR Ref', 'Désignation', 'Référence', 'Catégorie', 'Quantité', 'Lieu de stockage', ...ASPI_COMPAT.map(k => ASPI_COMPAT_LABELS[k])];
    const rows = stock.map(s => [
        s.qr_ref || '', s.designation || '', s.ref || '', s.categorie || '', s.quantite || '0', s.lieu_de_stockage || '',
        ...ASPI_COMPAT.map(k => s[k] ? 'Oui' : '')
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_aspirateurs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('📊 Export Aspirateurs téléchargé');
};
