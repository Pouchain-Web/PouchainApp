import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminOvertime = async function () {
    const content = document.getElementById('admin-content');

    // Set Active Nav
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-overtime');
    if (navItem) navItem.classList.add('active');

    if (!window.escapeHTML) {
        window.escapeHTML = (str) => {
            if (!str) return '';
            return str.replace(/[&<>"']/g, function (m) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[m];
            });
        };
    }

    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #FF9500, #FF3B30); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(255, 149, 0, 0.2);">
                        <span style="font-size: 28px;">⏳</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Gestion des Heures Supplémentaires</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Suivi des soldes et historique des employés</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <button onclick="window.openAdminRecupRequestsModal()" id="btn-recup-requests" title="Demandes de récupération" style="height: 46px; padding: 0 20px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 700; font-size: 14px; position: relative;">
                        📬 Récupérations
                        <span id="recup-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4);">0</span>
                    </button>

                    <button onclick="window.renderAdminOvertime()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 24px; padding: 0 10px;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="overtime-search" placeholder="Rechercher un employé..." style="width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 45px; font-size: 14px; outline: none;">
                    <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; opacity: 0.5;">🔍</span>
                </div>
            </div>

            <div id="overtime-list-container" style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <div id="overtime-loader" style="text-align:center; padding: 80px;">
                    <div class="loader" style="border: 3px solid rgba(255,255,255,0.1); border-top-color: #FF9500; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <div id="overtime-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding-bottom: 40px;"></div>
            </div>
        </div>
    `;

    try {
        let data = await api.getAdminOvertimeAll();
        // Supprimer l'utilisateur Patrick Prayez de l'affichage
        data = data.filter(u => {
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
            return !fullName.includes("patrick prayez");
        });
        const loader = document.getElementById('overtime-loader');
        if (loader) loader.remove();

        const renderGrid = (items) => {
            const grid = document.getElementById('overtime-grid');
            if (!grid) return;

            // TRI : Par secteur d'abord, puis par prénom
            const sortedItems = [...items].sort((a, b) => {
                const sectA = a.secteur || "";
                const sectB = b.secteur || "";
                if (sectA !== sectB) return sectA.localeCompare(sectB);
                return (a.first_name || '').localeCompare(b.first_name || '');
            });

            if (sortedItems.length === 0) {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #71717a; padding: 120px; font-size: 18px;">Aucun employé trouvé</div>`;
                return;
            }

            grid.innerHTML = sortedItems.map(u => {
                const balance = parseFloat(u.overtime_balance) || 0;
                const balanceColor = balance > 0 ? '#34C759' : (balance < 0 ? '#FF3B30' : '#8E8E93');
                const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || "Utilisateur";
                const initial = (u.first_name || u.last_name || "U")[0].toUpperCase();

                return `
                    <div class="overtime-card" onclick="window.renderAdminOvertimeLogs(${JSON.stringify(u).replace(/"/g, '&quot;')})" style="background: rgba(45, 45, 50, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 24px; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 20px; position: relative; overflow: hidden;">
                        <div style="width: 50px; height: 50px; border-radius: 25px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #fff; border: 1px solid rgba(255,255,255,0.1);">
                            ${initial}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 800; color: white; font-size: 16px; margin-bottom: 4px;">${fullName}</div>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <span style="font-size: 11px; background: rgba(255,255,255,0.05); color: #8E8E93; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); font-weight: 600;">${u.secteur || 'Non défini'}</span>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 900; color: ${balanceColor};">${window.formatOvertimeDuration(balance)}</div>
                            <div style="font-size: 10px; color: #8E8E93; font-weight: 700; text-transform: uppercase;">Solde</div>
                        </div>
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: ${balanceColor}; opacity: 0.4;"></div>
                    </div>
                `;
            }).join('');
        };

        renderGrid(data);
        window.updateRecupBadge();

        const searchInput = document.getElementById('overtime-search');
        searchInput.oninput = () => {
            const search = searchInput.value.toLowerCase();
            const filtered = data.filter(u =>
                (u.first_name || '').toLowerCase().includes(search) ||
                (u.last_name || '').toLowerCase().includes(search) ||
                (u.email || '').toLowerCase().includes(search)
            );
            renderGrid(filtered);
        };

    } catch (e) {
        console.error(e);
        document.getElementById('overtime-list-container').innerHTML = `<div style="color:red; padding: 20px;">Erreur: ${e.message}</div>`;
    }
};

window.renderAdminOvertimeLogs = async function (user) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000000';
    modal.style.backdropFilter = 'blur(10px)';

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 900px; padding: 40px; border-radius: 32px; background: rgba(28, 28, 30, 0.9); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: modalPop 0.3s ease-out; max-height: 95vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div>
                    <h2 style="margin: 0; font-size: 24px; font-weight: 800;">Historique & Évolution</h2>
                    <p style="margin: 4px 0 0 0; color: #8E8E93; font-size: 14px;">${fullName}</p>
                </div>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <button onclick='window.openAdminOvertimeAdjustmentModal(${JSON.stringify(user).replace(/'/g, "&#39;")})' style="background: #34C759; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; box-shadow: 0 4px 12px rgba(52, 199, 89, 0.2);">
                        <span>✏️</span> Ajuster le solde
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.05); border: none; color: #fff; width: 40px; height: 40px; border-radius: 20px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
                </div>
            </div>

            <div style="background: rgba(0,0,0,0.2); border-radius: 24px; padding: 20px; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.05);">
                <canvas id="overtime-chart" style="width: 100%; height: 250px;"></canvas>
            </div>

            <div id="logs-container" style="min-height: 200px;">
                <div style="text-align:center; padding: 40px;"><div class="loader-spinner"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const logs = await api.getAdminOvertimeLogs(user.id);
        const container = document.getElementById('logs-container');

        if (logs.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#8E8E93; padding: 40px;">Aucun log pour cet employé.</div>`;
            return;
        }

        // --- RENDU DU GRAPHIQUE ---
        const initChart = () => {
            try {
                const chartCanvas = document.getElementById('overtime-chart');
                if (!chartCanvas) return;

                const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
                let cumulative = 0;
                const chartData = sortedLogs.map(log => {
                    cumulative += parseFloat(log.hours);
                    return { x: new Date(log.date).getTime(), y: cumulative };
                });

                // Ajouter un point de départ à 0 la veille du premier log
                if (chartData.length > 0) {
                    const firstTime = chartData[0].x;
                    chartData.unshift({ x: firstTime - 86400000, y: 0 });
                }

                const ctx = chartCanvas.getContext('2d');
                if (window.overtimeChartInstance) window.overtimeChartInstance.destroy();

                window.overtimeChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        datasets: [{
                            label: 'Solde cumulé (h)',
                            data: chartData,
                            borderColor: '#34C759',
                            backgroundColor: 'rgba(52, 199, 89, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 5,
                            pointHoverRadius: 8,
                            pointBackgroundColor: '#34C759',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: { top: 10, bottom: 10, left: 10, right: 10 } },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: chartData.length > 5 ? 'day' : 'hour',
                                    displayFormats: {
                                        hour: 'HH:mm',
                                        day: 'dd/MM'
                                    }
                                },
                                grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                                ticks: { color: '#8E8E93', maxRotation: 0 }
                            },
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                                ticks: {
                                    color: '#8E8E93',
                                    callback: value => value + 'h'
                                }
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(28, 28, 30, 0.95)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                padding: 12,
                                cornerRadius: 12,
                                displayColors: false,
                                callbacks: {
                                    label: (context) => ` Solde : ${window.formatOvertimeDuration(context.parsed.y)}`
                                }
                            }
                        }
                    }
                });
            } catch (err) {
                console.error("Erreur rendu graphique:", err);
            }
        };

        // On attend un tout petit peu que le DOM soit calculé
        requestAnimationFrame(() => {
            setTimeout(initChart, 200);
        });

        // --- RENDU DU TABLEAU ---
        let html = `
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
                <thead>
                    <tr style="color: #8E8E93; font-size: 12px; text-transform: uppercase; font-weight: 800;">
                        <th style="text-align: left; padding: 0 15px;">Date</th>
                        <th style="text-align: center;">Heures</th>
                        <th style="text-align: left; padding: 0 15px;">Type</th>
                        <th style="text-align: left;">Commentaire</th>
                        <th style="text-align: right; padding: 0 15px;">Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        logs.forEach(log => {
            const hColor = log.hours > 0 ? '#34C759' : '#FF3B30';
            html += `
                <tr style="background: rgba(255,255,255,0.03); border-radius: 12px; transition: 0.2s;">
                    <td style="padding: 15px; border-radius: 12px 0 0 12px; font-weight: 600;">${new Date(log.date).toLocaleDateString('fr-FR')}</td>
                    <td style="text-align: center; font-weight: 900; color: ${hColor}; font-size: 16px;">${window.formatOvertimeDuration(log.hours)}</td>
                    <td style="padding: 15px; font-size: 13px; color: #AEAEB2;">${log.type === 'ajout' ? '➕ Ajout' : '➖ Déduction'}</td>
                    <td style="padding: 15px; font-size: 13px; color: #D1D1D6; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.escapeHTML(log.comment || '')}">${window.escapeHTML(log.comment || '—')}</td>
                    <td style="padding: 15px; text-align: right; border-radius: 0 12px 12px 0;">
                        <button onclick="window.deleteOvertimeLogByAdmin('${log.id}', '${user.id}', this)" style="background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); color: #FF3B30; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">Supprimer</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (e) {
        document.getElementById('logs-container').innerHTML = `<div style="color:red; padding: 20px;">Erreur: ${e.message}</div>`;
    }
};

window.deleteOvertimeLogByAdmin = async function (logId, userId, btn) {
    if (!confirm("Voulez-vous vraiment supprimer ce log ? Cela impactera le solde de l'employé.")) return;

    btn.disabled = true;
    btn.innerText = "...";

    try {
        await api.deleteOvertimeLog(logId);
        window.showToast("Log supprimé avec succès");
        const modal = btn.closest('.modal-overlay');
        modal.remove();
        window.renderAdminOvertime();
    } catch (e) {
        alert("Erreur: " + e.message);
        btn.disabled = false;
        btn.innerText = "Supprimer";
    }
};

window.openAdminOvertimeAdjustmentModal = function (user) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000001';

    const balance = parseFloat(user.overtime_balance) || 0;
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    // Décomposer le solde actuel pour pré-remplir
    const absBalance = Math.abs(balance);
    const currentH = Math.floor(absBalance);
    const currentM = Math.round((absBalance - currentH) * 60);
    const isNegative = balance < -0.0001; // Petite marge pour le flottant

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 450px; padding: 32px; border-radius: 28px; background: rgba(30, 30, 35, 0.95); border: 1px solid rgba(255,255,255,0.1); animation: modalPop 0.25s ease-out;">
            <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800; color: white;">Modifier le solde total</h2>
            <p style="margin: 0 0 24px 0; color: #8E8E93; font-size: 14px;">Mise à jour du compteur pour ${fullName}</p>
            
            <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 16px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #8E8E93; font-size: 13px; font-weight: 600;">Solde actuel :</span>
                <span style="color: white; font-size: 18px; font-weight: 800;">${window.formatOvertimeDuration(balance)}</span>
            </div>

            <div style="margin-bottom: 24px; padding: 24px; background: rgba(0, 122, 255, 0.05); border-radius: 24px; border: 1px solid rgba(0, 122, 255, 0.1);">
                <label style="display: block; color: #007AFF; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 0.5px; text-align: center;">Nouveau solde souhaité</label>
                
                <div style="display: flex; gap: 12px; align-items: center; justify-content: center;">
                    <!-- Bouton bascule de signe -->
                    <button onclick="window.toggleTargetSign()" id="target-sign-btn" style="width: 45px; height: 45px; border-radius: 12px; border: 2px solid ${isNegative ? '#FF3B30' : '#34C759'}; background: ${isNegative ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)'}; color: ${isNegative ? '#FF3B30' : '#34C759'}; font-size: 22px; font-weight: 900; cursor: pointer; margin-top: 18px; transition: all 0.2s;">
                        ${isNegative ? '-' : '+'}
                    </button>

                    <div style="width: 80px;">
                        <label style="display: block; color: #8E8E93; font-size: 11px; margin-bottom: 5px; text-align: center;">Heures</label>
                        <input type="number" id="target-hours" value="${currentH}" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: white; font-size: 18px; font-weight: 800; outline: none; text-align: center;">
                    </div>
                    
                    <div style="font-size: 24px; font-weight: 800; color: #444; margin-top: 18px;">:</div>
                    
                    <div style="width: 80px;">
                        <label style="display: block; color: #8E8E93; font-size: 11px; margin-bottom: 5px; text-align: center;">Minutes</label>
                        <input type="number" id="target-minutes" value="${currentM}" min="0" max="59" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: white; font-size: 18px; font-weight: 800; outline: none; text-align: center;">
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <label style="display: block; color: #8E8E93; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Justification (Obligatoire)</label>
                <textarea id="adj-comment" placeholder="Ex: Correction erreur de saisie, Ajustement fin de mois..." style="width: 100%; height: 80px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: white; font-size: 14px; outline: none; resize: none; font-family: inherit;"></textarea>
            </div>

            <div id="adj-comment-error" style="color: #FF3B30; font-size: 13px; font-weight: 600; margin-bottom: 15px; display: none; text-align: center;"></div>

            <div style="display: flex; gap: 12px;">
                <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.05); color: white; border: none; font-weight: 700; cursor: pointer;">Annuler</button>
                <button onclick="window.submitAdminOvertimeAdjustment('${user.id}', ${balance})" id="btn-save-adj" style="flex: 2; padding: 14px; border-radius: 14px; background: #007AFF; color: white; border: none; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);">Mettre à jour le solde</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    window.targetSign = isNegative ? -1 : 1;
};

window.toggleTargetSign = function () {
    window.targetSign = window.targetSign === 1 ? -1 : 1;
    const btn = document.getElementById('target-sign-btn');
    const isNeg = window.targetSign === -1;

    btn.innerText = isNeg ? '-' : '+';
    btn.style.borderColor = isNeg ? '#FF3B30' : '#34C759';
    btn.style.background = isNeg ? 'rgba(255, 59, 48, 0.1)' : 'rgba(52, 199, 89, 0.1)';
    btn.style.color = isNeg ? '#FF3B30' : '#34C759';
};

window.submitAdminOvertimeAdjustment = async function (userId, currentBalance) {
    const btn = document.getElementById('btn-save-adj');
    const targetH = parseFloat(document.getElementById('target-hours').value) || 0;
    const targetM = parseFloat(document.getElementById('target-minutes').value) || 0;
    const comment = document.getElementById('adj-comment').value.trim();
    const errorDiv = document.getElementById('adj-comment-error');

    if (!comment) {
        if (errorDiv) {
            errorDiv.innerText = "⚠️ Veuillez saisir une justification pour ce changement de solde.";
            errorDiv.style.display = 'block';
        }
        document.getElementById('adj-comment').style.borderColor = '#FF3B30';
        return;
    } else {
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        document.getElementById('adj-comment').style.borderColor = 'rgba(255,255,255,0.1)';
    }

    const targetTotalDecimal = window.targetSign * (targetH + (targetM / 60));
    const adjustmentNeeded = targetTotalDecimal - currentBalance;

    // Si la différence est quasi nulle, on ne fait rien
    if (Math.abs(adjustmentNeeded) < 0.0001) {
        window.showToast("Le solde est déjà à cette valeur.");
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ Mise à jour...";

    try {
        await api.addOvertimeLogByAdmin(userId, {
            amount: adjustmentNeeded,
            date: new Date().toISOString().split('T')[0],
            justification: `[Ajustement Solde] ${comment}`
        });

        window.showToast("Solde mis à jour avec succès !");

        // Fermer les deux modales et rafraîchir
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        window.renderAdminOvertime();
    } catch (e) {
        alert("Erreur: " + e.message);
        btn.disabled = false;
        btn.innerText = "Mettre à jour le solde";
    }
};
