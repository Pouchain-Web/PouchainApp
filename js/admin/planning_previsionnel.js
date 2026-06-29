import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Cache for parsed data
let parsedPlanningData = null;
let currentChecks = [];
let activeExpandedMarket = null;
let activeExpandedUser = null;
let ppUsersList = [];
let selectedWeekFilter = getISOWeekNumber(new Date()) || 1;

window.renderAdminPlanningPrevisionnel = async function () {
    const content = document.getElementById('admin-content');
    if (!content) {
        if (window.currentAdminSession) renderAdminView(window.currentAdminSession);
        setTimeout(() => window.renderAdminPlanningPrevisionnel(), 300);
        return;
    }

    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-planning-previsionnel');
    if (navItem) navItem.classList.add('active');

    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 20px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: rgba(0,0,0,0.4); padding: 15px 25px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #007AFF, #00C7BE); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0, 122, 255, 0.2);">
                        <span style="font-size: 28px;">📅</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Planning Prévisionnel</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Suivi annuel de la métrologie et de la maintenance préventive</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="form-group" style="margin-bottom:0; display:flex; align-items:center; gap:8px;">
                        <label style="margin:0; font-size:13px; color:#8E8E93;">Semaine :</label>
                        <select id="pp-week-select" class="form-input" style="width: 80px; padding: 6px; font-size: 13px;" onchange="window.changePPWeek(this.value)">
                            ${Array.from({ length: 52 }, (_, i) => `<option value="${i+1}" ${selectedWeekFilter === i+1 ? 'selected' : ''}>S${i+1}</option>`).join('')}
                        </select>
                    </div>
                    <label class="btn-primary" style="border-radius: 12px; height: 40px; padding: 0 16px; background: #007AFF; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s; font-size: 13px;">
                        📤 Importer Excel (.xlsm)
                        <input type="file" id="excel-upload-input" accept=".xlsm" style="display:none;" onchange="window.uploadPPExcel(this)">
                    </label>
                    <button onclick="window.renderAdminPlanningPrevisionnel()" title="Rafraîchir" style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Content Workspace -->
            <div id="pp-workspace" style="flex:1; overflow-y:auto; padding-right:5px;">
                <div style="display:flex; justify-content:center; padding: 40px;"><div class="loader" style="border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div></div>
            </div>
        </div>
    `;

    // Load data
    await loadPPData();
};

window.changePPWeek = function (val) {
    selectedWeekFilter = parseInt(val);
    renderPPWorkspace();
};

window.uploadPPExcel = async function (input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
        window.showToast("Analyse du fichier Excel...");
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const parsed = parseWorkbook(workbook);
                
                window.showToast("Téléchargement du fichier original...");
                await api.uploadFile(file, 'planning_previsionnel.xlsm');
                
                window.showToast("Génération des données simplifiées...");
                const jsonBlob = new Blob([JSON.stringify(parsed)], { type: 'application/json' });
                const jsonFile = new File([jsonBlob], 'planning_previsionnel_data.json');
                await api.uploadFile(jsonFile, 'planning_previsionnel_data.json');
                
                window.showToast("Importation réussie !");
                parsedPlanningData = parsed;
                renderPPWorkspace();
            } catch (err) {
                alert("Erreur lors de la lecture de l'Excel : " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        alert("Erreur d'import : " + e.message);
    }
};

async function loadPPData() {
    try {
        // 1. Fetch checkmarks from database
        currentChecks = await api.getPlanningPrevisionnelChecks();

        // 2. Fetch users
        const users = await api.listUsers(true);
        const adminSecteur = (window.currentUserProfile && window.currentUserProfile.secteur) || 'Tout';
        if (adminSecteur !== 'Tout') {
            ppUsersList = users.filter(u => u.secteur === adminSecteur);
        } else {
            ppUsersList = users;
        }

        // 3. Fetch the JSON data from R2 first (faster)
        if (!parsedPlanningData) {
            let res = await fetch(`${config.api.workerUrl}/get/planning_previsionnel_data.json`);
            if (res.ok) {
                parsedPlanningData = await res.json();
            } else {
                // Fallback to Excel parse if JSON is missing
                res = await fetch(`${config.api.workerUrl}/get/planning_previsionnel.xlsm`);
                if (!res.ok) {
                    document.getElementById('pp-workspace').innerHTML = `
                        <div style="text-align:center; padding: 60px 20px; color:#8E8E93; background:rgba(255,255,255,0.02); border-radius:20px; border: 1px dashed rgba(255,255,255,0.1); margin-top:20px;">
                            <span style="font-size:60px; display:block; margin-bottom:20px;">📊</span>
                            <h2 style="color:white; margin-bottom:10px;">Aucun planning prévisionnel disponible</h2>
                            <p style="font-size:14px; margin-bottom:20px; max-width:400px; margin-left:auto; margin-right:auto;">
                                Veuillez importer le fichier Excel prévisionnel <strong>planning_previsionnel.xlsm</strong> en utilisant le bouton ci-dessus.
                            </p>
                        </div>
                    `;
                    return;
                }
                const buffer = await res.arrayBuffer();
                const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                parsedPlanningData = parseWorkbook(workbook);
            }
        }

        renderPPWorkspace();
    } catch (e) {
        console.error(e);
        document.getElementById('pp-workspace').innerHTML = `<div style="color:red; padding: 20px;">Erreur de chargement: ${e.message}</div>`;
    }
}

function parseWorkbook(workbook) {
    const data = [];
    const sheetNames = ['AIACP', 'Feuil1'];
    const uploadWeek = getISOWeekNumber(new Date()) || 1;

    sheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (json.length < 5) return;

        for (let r = 4; r < json.length; r++) {
            const row = json[r];
            if (!row || !row[0]) continue;

            const eqId = String(row[0]).trim();
            if (!eqId.startsWith("MI") && !eqId.startsWith("mi")) continue;

            const marketNo = String(row[1] || '').trim();
            const marketName = String(row[2] || '').trim();

            const eqObj = {
                sheet: sheetName,
                id: eqId,
                market_no: marketNo,
                market_name: marketName,
                go_number: String(row[3] || '').trim(),
                machine: String(row[4] || '').trim(),
                brand: String(row[5] || '').trim(),
                model: String(row[6] || '').trim(),
                serial: String(row[7] || '').trim(),
                building: String(row[8] || '').trim(),
                location: String(row[9] || '').trim(),
                upload_week: uploadWeek,
                tasks: {}
            };

            for (let w = 1; w <= 52; w++) {
                const colIdx = 11 + (w - 1) * 3;
                const pVal = row[colIdx];
                const cVal = row[colIdx + 1];
                const mVal = row[colIdx + 2];

                if (pVal || cVal || mVal) {
                    eqObj.tasks[w] = {};
                    if (pVal) eqObj.tasks[w].preventif = String(pVal).trim();
                    if (cVal) eqObj.tasks[w].controle = String(cVal).trim();
                    if (mVal) eqObj.tasks[w].metrologie = String(mVal).trim();
                }
            }

            data.push(eqObj);
        }
    });

    return data;
}

function renderPPWorkspace() {
    const container = document.getElementById('pp-workspace');
    if (!parsedPlanningData) return;

    const markets = {};

    parsedPlanningData.forEach(eq => {
        let prefix = "Sans MI";
        const cleanId = eq.id.toUpperCase();
        if (cleanId.startsWith("MI")) {
            const num = cleanId.substring(2, 4);
            if (!isNaN(parseInt(num))) {
                prefix = num;
            }
        }

        const marketKey = prefix;
        if (!markets[marketKey]) {
            markets[marketKey] = {
                code: prefix,
                name: eq.market_name || (prefix === "Sans MI" ? "Équipements sans MI" : `Marché ${prefix}`),
                no: eq.market_no || "",
                equipments: [],
                overdueCount: 0
            };
        }
        markets[marketKey].equipments.push(eq);
    });

    Object.keys(markets).forEach(mKey => {
        const m = markets[mKey];
        m.equipments.forEach(eq => {
            const uploadW = eq.upload_week || 1;
            Object.keys(eq.tasks).forEach(wStr => {
                const w = parseInt(wStr);
                if (w < selectedWeekFilter && w >= uploadW) {
                    const types = ['preventif', 'controle', 'metrologie'];
                    types.forEach(type => {
                        if (eq.tasks[w][type]) {
                            const isChecked = currentChecks.some(c => c.equipment_id === eq.id && c.week_number === w && c.task_type === type);
                            if (!isChecked) {
                                m.overdueCount++;
                            }
                        }
                    });
                }
            });
        });
    });

    const sortedMarkets = Object.values(markets).sort((a, b) => {
        if (a.code === "Sans MI") return 1;
        if (b.code === "Sans MI") return -1;
        return parseInt(a.code) - parseInt(b.code);
    });

    container.innerHTML = `
        <!-- Marchés Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top:10px;">
            ${sortedMarkets.map(m => {
                const isExpanded = activeExpandedMarket === m.code;
                const badgeColor = m.overdueCount > 0 ? '#FF3B30' : 'rgba(255,255,255,0.1)';
                const badgeTextColor = 'white';
                
                return `
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 20px; overflow: hidden; transition: all 0.3s; display:flex; flex-direction:column; ${isExpanded ? 'grid-column: 1 / -1;' : ''}">
                        <!-- Market Card Title -->
                        <div onclick="window.togglePPMarket('${m.code}')" style="padding: 20px; background: rgba(0,0,0,0.2); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-size: 12px; font-weight: 700; color: #007AFF; text-transform: uppercase; letter-spacing: 1px;">Marché ${m.code}</span>
                                <h3 style="margin: 6px 0 0 0; font-size: 16px; font-weight: 700; color: white;">${window.escapeHTML(m.name)}</h3>
                                ${m.no ? `<p style="margin: 4px 0 0 0; font-size:11px; color:#8E8E93;">${window.escapeHTML(m.no)}</p>` : ''}
                            </div>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="background: ${badgeColor}; color: ${badgeTextColor}; border-radius: 12px; padding: 4px 10px; font-size: 12px; font-weight: 800; display:flex; align-items:center; gap:6px;" title="Tâches en retard">
                                    ⚠️ ${m.overdueCount}
                                </div>
                                <span style="color:#8E8E93; font-size:20px; transition: transform 0.3s; transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0)'};">➔</span>
                            </div>
                        </div>

                        <!-- Sub-list of equipments -->
                        ${isExpanded ? renderMarketEquipments(m) : ''}
                    </div>
                `;
            }).join('')}
        </div>

        <!-- Section Suivi par Technicien -->
        <div style="margin-top: 40px; margin-bottom: 30px;">
            <h2 style="color: white; font-size: 18px; font-weight: 800; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
                <span>👥</span> Suivi par Technicien (${ppUsersList.length})
            </h2>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${ppUsersList.map(u => {
                    const isUserExpanded = activeExpandedUser === u.id;
                    const assignedList = (u.assigned_markets || '').split(',').map(s => s.trim().padStart(2, '0')).filter(Boolean);
                    
                    // Count/find overdue tasks for this user
                    const overdueTasks = [];
                    parsedPlanningData.forEach(eq => {
                        let prefix = "Sans MI";
                        const cleanId = eq.id.toUpperCase();
                        if (cleanId.startsWith("MI")) {
                            const num = cleanId.substring(2, 4);
                            if (!isNaN(parseInt(num))) {
                                prefix = num;
                            }
                        }
                        
                        if (assignedList.includes(prefix.padStart(2, '0'))) {
                            const uploadW = eq.upload_week || 1;
                            Object.keys(eq.tasks).forEach(wStr => {
                                const w = parseInt(wStr);
                                if (w < selectedWeekFilter && w >= uploadW) {
                                    const types = ['preventif', 'controle', 'metrologie'];
                                    types.forEach(type => {
                                        if (eq.tasks[w][type]) {
                                            const isChecked = currentChecks.some(c => c.equipment_id === eq.id && c.week_number === w && c.task_type === type);
                                            if (!isChecked) {
                                                overdueTasks.push({
                                                    eq,
                                                    week: w,
                                                    type,
                                                    desc: eq.tasks[w][type]
                                                });
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });

                    const overdueBadgeColor = overdueTasks.length > 0 ? '#FF3B30' : 'rgba(255,255,255,0.1)';
                    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;

                    return `
                        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 20px; overflow: hidden; display:flex; flex-direction:column;">
                            <div onclick="window.togglePPUser('${u.id}')" style="padding: 15px 20px; background: rgba(0,0,0,0.15); cursor: pointer; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #007AFF, #00C7BE); display: flex; align-items: center; justify-content: center; font-weight:700; color:white; font-size:16px;">
                                        ${name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 style="margin:0; font-size: 15px; color:white; font-weight:700;">${window.escapeHTML(name)}</h4>
                                        <span style="font-size:11px; color:#8E8E93;">${window.escapeHTML(u.email)} ${u.secteur ? `• Secteur: ${window.escapeHTML(u.secteur)}` : ''}</span>
                                    </div>
                                </div>
                                
                                <div style="display:flex; align-items:center; gap:15px; margin-left:auto;">
                                    <div style="text-align:right;">
                                        <span style="font-size: 11px; color: #8E8E93; display:block;">Marchés</span>
                                        <span style="font-size: 13px; color: #007AFF; font-weight:700;">${assignedList.length > 0 ? assignedList.join(', ') : 'Aucun'}</span>
                                    </div>
                                    
                                    <div style="background: ${overdueBadgeColor}; color: white; border-radius: 12px; padding: 4px 10px; font-size: 12px; font-weight: 800; display:flex; align-items:center; gap:6px;" title="Retards">
                                        ⚠️ ${overdueTasks.length}
                                    </div>
                                    
                                    <button onclick="window.openPPUserMarketsModal('${u.id}', event)" class="btn-primary" style="background:#007AFF; border:none; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; color:white; transition: all 0.2s;" onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007AFF'">
                                        Marchés attitrés
                                    </button>
                                    
                                    <span style="color:#8E8E93; font-size:16px; transition: transform 0.3s; transform: ${isUserExpanded ? 'rotate(90deg)' : 'rotate(0)'};">➔</span>
                                </div>
                            </div>
                            
                            ${isUserExpanded ? `
                                <div style="background: rgba(0,0,0,0.3); padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.05);">
                                    <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #FF3B30; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Équipements en retard :</h5>
                                    ${overdueTasks.length === 0 ? `
                                        <p style="margin:0; font-size:13px; color:#8E8E93; font-style:italic;">Aucun retard pour cet utilisateur</p>
                                    ` : `
                                        <div style="display:flex; flex-direction:column; gap:8px;">
                                            ${overdueTasks.map(ot => {
                                                const typeLabel = ot.type === 'preventif' ? 'Préventif' : (ot.type === 'controle' ? 'Contrôle' : 'Métrologie');
                                                return `
                                                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; font-size:13px;">
                                                        <div style="display:flex; flex-direction:column;">
                                                            <div>
                                                                <span style="font-weight:700; color:#007AFF; margin-right:8px;">${window.escapeHTML(ot.eq.id)}</span>
                                                                <strong style="color:white;">${window.escapeHTML(ot.eq.machine || 'Machine')}</strong>
                                                                <span style="font-size:11px; color:#8E8E93; margin-left:8px;">(Onglet: ${window.escapeHTML(ot.eq.sheet || '')})</span>
                                                            </div>
                                                            <div style="margin-top:4px; font-size:12px; color:#8E8E93;">
                                                                <strong>S${ot.week} - ${typeLabel}</strong>: ${window.escapeHTML(ot.desc)}
                                                            </div>
                                                        </div>
                                                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; color:#8E8E93; font-size:12px;">
                                                            <input type="checkbox" style="width:16px; height:16px; cursor:pointer;" onchange="window.savePPCheck('${ot.eq.id}', ${ot.week}, '${ot.type}', this.checked)">
                                                            Acquitter
                                                        </label>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    `}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

window.togglePPUser = function (userId) {
    if (activeExpandedUser === userId) {
        activeExpandedUser = null;
    } else {
        activeExpandedUser = userId;
    }
    renderPPWorkspace();
};

window.togglePPMarket = function (code) {
    if (activeExpandedMarket === code) {
        activeExpandedMarket = null;
    } else {
        activeExpandedMarket = code;
    }
    renderPPWorkspace();
};

function renderMarketEquipments(market) {
    return `
        <div style="background: rgba(0,0,0,0.4); padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); overflow-x:auto;">
            <div style="display: flex; flex-direction: column; gap: 20px;">
                ${market.equipments.map(eq => {
                    const uploadW = eq.upload_week || 1;
                    const overdueTasks = [];
                    Object.keys(eq.tasks).forEach(wStr => {
                        const w = parseInt(wStr);
                        if (w < selectedWeekFilter && w >= uploadW) {
                            const types = ['preventif', 'controle', 'metrologie'];
                            types.forEach(type => {
                                if (eq.tasks[w][type]) {
                                    const isChecked = currentChecks.some(c => c.equipment_id === eq.id && c.week_number === w && c.task_type === type);
                                    if (!isChecked) {
                                        overdueTasks.push({ week: w, type, value: eq.tasks[w][type] });
                                    }
                                }
                            });
                        }
                    });

                    const currentWeekTasks = eq.tasks[selectedWeekFilter] || {};

                    return `
                        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 15px; display:flex; flex-direction:column; gap:12px;">
                            <!-- Eq Info -->
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:10px;">
                                <div>
                                    <span style="font-size:13px; font-weight:700; color:#007AFF;">${window.escapeHTML(eq.id)}</span>
                                    <strong style="font-size:14px; color:white; margin-left:8px;">${window.escapeHTML(eq.machine || 'Machine')}</strong>
                                    <div style="font-size:12px; color:#8E8E93; margin-top:4px;">
                                        ${eq.brand ? `Marque: ${window.escapeHTML(eq.brand)} | ` : ''}
                                        ${eq.model ? `Modèle: ${window.escapeHTML(eq.model)} | ` : ''}
                                        ${eq.serial ? `Série: ${window.escapeHTML(eq.serial)} | ` : ''}
                                        ${eq.location ? `Loc: ${window.escapeHTML(eq.location)}` : ''}
                                    </div>
                                </div>
                                <span class="badge" style="background:rgba(255,255,255,0.05); color:#8E8E93; font-size:11px;">Feuille: ${eq.sheet}</span>
                            </div>

                            <!-- Overdue Tasks (Reportées) -->
                            ${overdueTasks.length > 0 ? `
                                <div style="background:rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); border-radius:10px; padding: 8px 12px; display:flex; flex-direction:column; gap:8px;">
                                    <div style="font-size:12px; font-weight:700; color:#FF3B30;">⚠️ TÂCHES EN RETARD EN ATTENTE :</div>
                                    <div style="display:flex; gap:15px; flex-wrap:wrap;">
                                        ${overdueTasks.map(t => {
                                            const label = t.type === 'preventif' ? 'Préventif' : (t.type === 'controle' ? 'Contrôle' : 'Métrologie');
                                            return `
                                                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:white; cursor:pointer;">
                                                    <input type="checkbox" style="width:18px; height:18px; cursor:pointer;" onchange="window.savePPCheck('${eq.id}', ${t.week}, '${t.type}', this.checked)">
                                                    <span><strong>S${t.week} - ${label}</strong> (${window.escapeHTML(t.value)})</span>
                                                </label>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Current Week Tasks -->
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <div style="font-size:12px; font-weight:700; color:#8E8E93;">Tâches Semaine en cours (S${selectedWeekFilter}) :</div>
                                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                                    ${['preventif', 'controle', 'metrologie'].map(type => {
                                        const val = currentWeekTasks[type];
                                        if (!val) return '';
                                        
                                        const label = type === 'preventif' ? 'Préventif' : (type === 'controle' ? 'Contrôle' : 'Métrologie');
                                        const isChecked = currentChecks.some(c => c.equipment_id === eq.id && c.week_number === selectedWeekFilter && c.task_type === type);
                                        
                                        return `
                                            <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:white; cursor:pointer;">
                                                <input type="checkbox" style="width:18px; height:18px; cursor:pointer;" ${isChecked ? 'checked' : ''} onchange="window.savePPCheck('${eq.id}', ${selectedWeekFilter}, '${type}', this.checked)">
                                                <span><strong>${label}</strong> (${window.escapeHTML(val)})</span>
                                            </label>
                                        `;
                                    }).filter(Boolean).join('') || `<span style="font-size:12px; color:#8E8E93; font-style:italic;">Aucune tâche programmée cette semaine</span>`}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

window.savePPCheck = async function (eqId, week, type, checked) {
    try {
        await api.savePlanningPrevisionnelCheck(eqId, week, type, checked);
        window.showToast("Statut enregistré.");
        currentChecks = await api.getPlanningPrevisionnelChecks();
        renderPPWorkspace();
    } catch (e) {
        alert("Erreur lors de la sauvegarde : " + e.message);
    }
};

window.openPPUserMarketsModal = async function (userId, event) {
    if (event) event.stopPropagation();
    try {
        const u = ppUsersList.find(x => x.id === userId);
        if (!u) return;
        
        const cleanName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
        
        // Scan for all unique market codes and their names from Excel data
        const marketNames = {};
        parsedPlanningData.forEach(eq => {
            let prefix = "Sans MI";
            const cleanId = eq.id.toUpperCase();
            if (cleanId.startsWith("MI")) {
                const num = cleanId.substring(2, 4);
                if (!isNaN(parseInt(num))) {
                    prefix = num;
                }
            }
            if (prefix !== "Sans MI" && eq.market_name) {
                marketNames[prefix] = eq.market_name;
            }
        });

        const allUniqueMarkets = Array.from(new Set(parsedPlanningData.map(eq => {
            let prefix = "Sans MI";
            const cleanId = eq.id.toUpperCase();
            if (cleanId.startsWith("MI")) {
                const num = cleanId.substring(2, 4);
                if (!isNaN(parseInt(num))) {
                    prefix = num;
                }
            }
            return prefix;
        }))).filter(m => m !== "Sans MI").sort((a,b) => parseInt(a) - parseInt(b));
        
        const assignedList = (u.assigned_markets || '').split(',').map(s => s.trim().padStart(2, '0')).filter(Boolean);
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'user-markets-modal';
        overlay.style.zIndex = '1000000';
        
        overlay.innerHTML = `
            <div class="modal-box" style="max-width: 520px; width: 100%;">
                <div class="modal-header" style="display:flex; align-items:center; gap:10px;">
                    <span>⚙️</span> Affecter les marchés à ${window.escapeHTML(cleanName)}
                </div>
                <p style="margin-bottom: 20px; color: #8E8E93; font-size:13.5px; line-height:1.5;">
                    Sélectionnez les marchés qui doivent être visibles par ce technicien sur l'application mobile.
                </p>
                
                <div style="max-height: 320px; overflow-y: auto; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px; margin-bottom: 24px;">
                    ${allUniqueMarkets.map(mCode => {
                        const isAssigned = assignedList.includes(mCode.padStart(2, '0'));
                        const realName = marketNames[mCode] || `Marché ${mCode}`;
                        return `
                            <label style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; cursor:pointer; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.02); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'">
                                <input type="checkbox" class="user-market-checkbox" data-market-code="${mCode}" ${isAssigned ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; flex-shrink:0;">
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-size:14px; font-weight:700; color:white;">Marché ${mCode}</span>
                                    <span style="font-size:12px; color:#8E8E93;">${window.escapeHTML(realName)}</span>
                                </div>
                            </label>
                        `;
                    }).join('')}
                </div>
                
                <div class="modal-actions" style="justify-content:flex-end; gap:12px;">
                    <button class="btn-secondary" onclick="closeModal('user-markets-modal')" style="border-radius:12px; height:40px; padding:0 16px;">Annuler</button>
                    <button class="btn-primary" id="save-user-markets-btn" style="border-radius:12px; height:40px; padding:0 16px; background:#007AFF;">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        document.getElementById('save-user-markets-btn').onclick = async () => {
            const btn = document.getElementById('save-user-markets-btn');
            btn.disabled = true;
            btn.innerText = "Enregistrement...";
            
            try {
                const checkboxes = document.querySelectorAll('.user-market-checkbox');
                const selected = [];
                checkboxes.forEach(box => {
                    if (box.checked) {
                        selected.push(box.getAttribute('data-market-code'));
                    }
                });
                
                const newVal = selected.join(',');
                await api.updateUserProfile(u.id, u.first_name, u.last_name, u.secteur, u.societe, newVal);
                
                window.showToast("Marchés mis à jour.");
                closeModal('user-markets-modal');
                await loadPPData();
            } catch (err) {
                alert("Erreur lors de la sauvegarde : " + err.message);
                btn.disabled = false;
                btn.innerText = "Enregistrer";
            }
        };
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};
