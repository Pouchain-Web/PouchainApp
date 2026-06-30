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

// Map a week number (1-52) in a given year to its respective month (1-12)
function getMonthFromWeek(week, year) {
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay() || 7;
    const mondayVal = jan4.getTime() - (day - 1) * 24 * 60 * 60 * 1000;
    const targetMonday = new Date(mondayVal + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const midWeek = new Date(targetMonday.getTime() + 3 * 24 * 60 * 60 * 1000);
    return midWeek.getMonth() + 1; // 1-12
}

// Get all weeks (1-52) belonging to a given month (1-12) in a year
function getWeeksInMonth(month, year) {
    const weeks = [];
    for (let w = 1; w <= 52; w++) {
        if (getMonthFromWeek(w, year) === month) {
            weeks.push(w);
        }
    }
    return weeks;
}

const MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const MONTH_SHORT_NAMES = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Jui", 
    "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"
];

// Cache for parsed data
let parsedPlanningData = null;
let currentChecks = [];
let ppUsersList = [];
let selectedYearFilter = new Date().getFullYear();
let selectedTab = 'matrix'; // 'matrix' or 'tech' or 'import'
let adminSearchQuery = '';

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

    // Inject Redesign Styles
    if (!document.getElementById('pp-admin-styles')) {
        const style = document.createElement('style');
        style.id = 'pp-admin-styles';
        style.innerHTML = `
            .pp-tab-btn {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                color: #8E8E93;
                padding: 10px 20px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .pp-tab-btn.active {
                background: #007AFF;
                color: white;
                border-color: #007AFF;
                box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
            }
            .pp-matrix-table {
                width: 100%;
                border-collapse: collapse;
                background: rgba(255,255,255,0.02);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px;
                overflow: hidden;
            }
            .pp-matrix-table th {
                background: rgba(0,0,0,0.3);
                padding: 12px 10px;
                font-size: 11px;
                font-weight: 800;
                color: #8E8E93;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                text-align: left;
            }
            .pp-matrix-table td {
                padding: 12px 10px;
                font-size: 13px;
                border-bottom: 1px solid rgba(255,255,255,0.04);
                color: white;
            }
            .pp-matrix-table tr:hover {
                background: rgba(255,255,255,0.02);
            }
            .pp-status-dot {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 900;
                cursor: pointer;
                user-select: none;
                transition: all 0.2s;
                position: relative;
            }
            .pp-status-dot:hover {
                transform: scale(1.15);
            }
            .pp-status-dot.checked {
                background: rgba(52, 199, 89, 0.2);
                color: #34C759;
                border: 1px solid rgba(52, 199, 89, 0.4);
            }
            .pp-status-dot.overdue {
                background: rgba(255, 59, 48, 0.2);
                color: #FF3B30;
                border: 1px solid rgba(255, 59, 48, 0.4);
            }
            .pp-status-dot.future {
                background: rgba(255,255,255,0.06);
                color: #8E8E93;
                border: 1px solid rgba(255,255,255,0.1);
            }
            /* Tooltip */
            .pp-tooltip {
                position: relative;
            }
            .pp-tooltip::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 130%;
                left: 50%;
                transform: translateX(-50%);
                background: #1C1C1E;
                color: white;
                font-size: 11px;
                padding: 6px 10px;
                border-radius: 8px;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.2s;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.1);
                z-index: 1000;
            }
            .pp-tooltip:hover::after {
                opacity: 1;
                visibility: visible;
            }
        `;
        document.head.appendChild(style);
    }

    content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 20px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: rgba(0,0,0,0.4); padding: 15px 25px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #007AFF, #00C7BE); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0, 122, 255, 0.2);">
                        <span style="font-size: 28px;">📊</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Planning Prévisionnel</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Suivi mensuel et annuel de la métrologie et de la maintenance préventive</p>
                    </div>
                </div>

                <!-- Navigation Tabs -->
                <div style="display: flex; gap: 10px;">
                    <button id="tab-btn-matrix" class="pp-tab-btn ${selectedTab === 'matrix' ? 'active' : ''}" onclick="window.switchPPTab('matrix')">📅 Matrice Annuelle</button>
                    <button id="tab-btn-tech" class="pp-tab-btn ${selectedTab === 'tech' ? 'active' : ''}" onclick="window.switchPPTab('tech')">👥 Suivi Techniciens</button>
                    <button id="tab-btn-import" class="pp-tab-btn ${selectedTab === 'import' ? 'active' : ''}" onclick="window.switchPPTab('import')">📤 Importer Fichier</button>
                </div>
            </div>

            <!-- Filters Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #8E8E93; font-size: 13px; font-weight: 600;">Année :</span>
                        <select id="pp-year-select" class="form-input" style="width: 100px; padding: 8px; font-size: 13px;" onchange="window.changePPYear(this.value)">
                            ${[selectedYearFilter - 1, selectedYearFilter, selectedYearFilter + 1].map(y => `<option value="${y}" ${selectedYearFilter === y ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Search Input -->
                <div style="flex: 1; max-width: 400px; display: flex; align-items: center; gap: 10px;">
                    <input type="text" id="pp-search" class="form-input" placeholder="🔍 Rechercher (MI, machine, marché, série...)" value="${window.escapeHTML(adminSearchQuery)}" oninput="window.handlePPSearch(this.value)" style="width: 100%; padding: 8px 12px; font-size: 13px;">
                    <button onclick="window.renderAdminPlanningPrevisionnel()" title="Rafraîchir" style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Workspace -->
            <div id="pp-workspace" style="flex: 1; overflow: auto; background: rgba(0,0,0,0.2); border-radius: 18px; border: 1px solid rgba(255,255,255,0.05); padding: 15px;">
                <div style="display:flex; justify-content:center; padding: 40px;"><div class="loader" style="border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div></div>
            </div>
        </div>
    `;

    await loadPPData();
};

window.switchPPTab = function (tab) {
    selectedTab = tab;
    document.querySelectorAll('.pp-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    renderPPWorkspace();
};

window.changePPYear = function (val) {
    selectedYearFilter = parseInt(val);
    renderPPWorkspace();
};

window.handlePPSearch = function (val) {
    adminSearchQuery = val.trim();
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
                selectedTab = 'matrix';
                window.renderAdminPlanningPrevisionnel();
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
        currentChecks = await api.getPlanningPrevisionnelChecks();
        const users = await api.listUsers(true);
        const adminSecteur = (window.currentUserProfile && window.currentUserProfile.secteur) || 'Tout';
        
        if (adminSecteur !== 'Tout') {
            ppUsersList = users.filter(u => u.secteur === adminSecteur);
        } else {
            ppUsersList = users;
        }

        if (!parsedPlanningData) {
            let res = await fetch(`${config.api.workerUrl}/get/planning_previsionnel_data.json`);
            if (res.ok) {
                parsedPlanningData = await res.json();
            } else {
                res = await fetch(`${config.api.workerUrl}/get/planning_previsionnel.xlsm`);
                if (!res.ok) {
                    selectedTab = 'import';
                    renderPPWorkspace();
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

            const eqObj = {
                sheet: sheetName,
                id: eqId,
                market_no: String(row[1] || '').trim(),
                market_name: String(row[2] || '').trim(),
                machine: String(row[4] || '').trim(),
                brand: String(row[5] || '').trim(),
                model: String(row[6] || '').trim(),
                serial: String(row[7] || '').trim(),
                location: String(row[9] || '').trim(),
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
    if (!container) return;

    if (selectedTab === 'import') {
        container.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; color:#8E8E93; background:rgba(255,255,255,0.01); border-radius:20px; border: 1px dashed rgba(255,255,255,0.1); max-width: 600px; margin: 40px auto;">
                <span style="font-size:60px; display:block; margin-bottom:20px;">📊</span>
                <h2 style="color:white; margin-bottom:10px;">Importer un Planning Prévisionnel</h2>
                <p style="font-size:14px; margin-bottom:30px; max-width:400px; margin-left:auto; margin-right:auto; line-height:1.5;">
                    Veuillez importer le fichier Excel prévisionnel <strong>planning_previsionnel.xlsm</strong>. Les tâches seront automatiquement extraites et synchronisées.
                </p>
                <label class="btn-primary" style="display:inline-flex; align-items:center; gap:10px; border-radius:12px; height:46px; padding:0 24px; background:#007AFF; font-weight:700; border:none; color:white; cursor:pointer;">
                    📥 Sélectionner le fichier (.xlsm)
                    <input type="file" id="excel-upload-input" accept=".xlsm" style="display:none;" onchange="window.uploadPPExcel(this)">
                </label>
            </div>
        `;
        return;
    }

    if (!parsedPlanningData) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color:#8E8E93;">Aucune donnée disponible. Veuillez importer un fichier.</div>`;
        return;
    }

    // Filter data based on search query
    const filteredData = parsedPlanningData.filter(eq => {
        if (!adminSearchQuery) return true;
        const q = adminSearchQuery.toLowerCase();
        return eq.id.toLowerCase().includes(q) ||
               (eq.machine || '').toLowerCase().includes(q) ||
               (eq.market_name || '').toLowerCase().includes(q) ||
               (eq.market_no || '').toLowerCase().includes(q) ||
               (eq.brand || '').toLowerCase().includes(q) ||
               (eq.model || '').toLowerCase().includes(q) ||
               (eq.serial || '').toLowerCase().includes(q);
    });

    if (selectedTab === 'matrix') {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        container.innerHTML = `
            <div style="overflow-x: auto; border-radius: 12px; background: rgba(0,0,0,0.2);">
                <table class="pp-matrix-table">
                    <thead>
                        <tr>
                            <th style="min-width: 100px;">MI ID</th>
                            <th style="min-width: 180px;">Équipement / Machine</th>
                            <th style="min-width: 120px;">Secteur / Marché</th>
                            ${MONTH_SHORT_NAMES.map(m => `<th style="text-align:center; min-width: 45px;">${m}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(eq => {
                            let prefix = "Sans MI";
                            const cleanId = eq.id.toUpperCase();
                            if (cleanId.startsWith("MI")) {
                                const num = cleanId.substring(2, 4);
                                if (!isNaN(parseInt(num))) prefix = `Marché ${num}`;
                            }

                            return `
                                <tr>
                                    <td style="font-weight: 800; color: #007AFF;">${window.escapeHTML(eq.id)}</td>
                                    <td>
                                        <div style="font-weight: 700; color: white;">${window.escapeHTML(eq.machine || 'Machine')}</div>
                                        <div style="font-size:11px; color:#8E8E93; margin-top:2px;">
                                            ${eq.brand ? `${window.escapeHTML(eq.brand)} ` : ''}
                                            ${eq.model ? `• ${window.escapeHTML(eq.model)} ` : ''}
                                            ${eq.serial ? `• N/S: ${window.escapeHTML(eq.serial)}` : ''}
                                        </div>
                                    </td>
                                    <td>
                                        <span style="font-size:12px; color:white; font-weight:600;">${window.escapeHTML(prefix)}</span>
                                        ${eq.location ? `<div style="font-size:10px; color:#8E8E93; margin-top:2px;">${window.escapeHTML(eq.location)}</div>` : ''}
                                    </td>
                                    ${Array.from({ length: 12 }, (_, mIdx) => {
                                        const mNum = mIdx + 1;
                                        // Collect all weeks belonging to this month
                                        const monthWeeks = getWeeksInMonth(mNum, selectedYearFilter);
                                        const tasksInMonth = [];

                                        monthWeeks.forEach(w => {
                                            if (eq.tasks[w]) {
                                                ['preventif', 'controle', 'metrologie'].forEach(type => {
                                                    if (eq.tasks[w][type]) {
                                                        const isChecked = currentChecks.some(c => 
                                                            c.equipment_id === eq.id && 
                                                            c.task_type === type && 
                                                            (c.week_number === (selectedYearFilter * 100 + w) || (selectedYearFilter === 2026 && c.week_number === w))
                                                        );
                                                        tasksInMonth.push({ week: w, type, val: eq.tasks[w][type], isChecked });
                                                    }
                                                });
                                            }
                                        });

                                        if (tasksInMonth.length === 0) {
                                            return `<td style="text-align:center; color:rgba(255,255,255,0.05);">-</td>`;
                                        }

                                        return `
                                            <td style="text-align:center; vertical-align: middle;">
                                                <div style="display:flex; justify-content:center; gap:4px; flex-wrap:wrap; max-width:60px; margin:0 auto;">
                                                    ${tasksInMonth.map(t => {
                                                        const letter = t.type === 'preventif' ? 'P' : (t.type === 'controle' ? 'C' : 'M');
                                                        const label = t.type === 'preventif' ? 'Préventif' : (t.type === 'controle' ? 'Contrôle' : 'Métrologie');
                                                        
                                                        let stateClass = 'future';
                                                        if (t.isChecked) {
                                                            stateClass = 'checked';
                                                        } else {
                                                            // Unchecked. Check if overdue
                                                            const isPast = selectedYearFilter < currentYear || (selectedYearFilter === currentYear && mNum < currentMonth);
                                                            if (isPast) {
                                                                stateClass = 'overdue';
                                                            }
                                                        }

                                                        const tooltipText = `S${t.week} - ${label}: ${t.val.replace(/"/g, '&quot;')}`;

                                                        return `
                                                            <span class="pp-status-dot pp-tooltip ${stateClass}" 
                                                                  data-tooltip="${window.escapeHTML(tooltipText)}"
                                                                  onclick="window.toggleAdminPPCheck(event, '${eq.id}', ${t.week}, '${t.type}', ${!t.isChecked})">
                                                                ${letter}
                                                            </span>
                                                        `;
                                                    }).join('')}
                                                </div>
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        return;
    }

    if (selectedTab === 'tech') {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${ppUsersList.map(u => {
                    const assignedList = (u.assigned_markets || '').split(',').map(s => s.trim().padStart(2, '0')).filter(Boolean);
                    
                    // Filter tasks for this technician's assigned markets
                    const techTasks = [];
                    parsedPlanningData.forEach(eq => {
                        let prefix = "Sans MI";
                        const cleanId = eq.id.toUpperCase();
                        if (cleanId.startsWith("MI")) {
                            const num = cleanId.substring(2, 4);
                            if (!isNaN(parseInt(num))) prefix = num;
                        }
                        
                        if (assignedList.includes(prefix.padStart(2, '0'))) {
                            Object.keys(eq.tasks).forEach(wStr => {
                                const w = parseInt(wStr);
                                const taskMonth = getMonthFromWeek(w, selectedYearFilter);
                                ['preventif', 'controle', 'metrologie'].forEach(type => {
                                    if (eq.tasks[w][type]) {
                                        const isChecked = currentChecks.some(c => 
                                            c.equipment_id === eq.id && 
                                            c.task_type === type && 
                                            (c.week_number === (selectedYearFilter * 100 + w) || (selectedYearFilter === 2026 && c.week_number === w))
                                        );
                                        const isPast = selectedYearFilter < currentYear || (selectedYearFilter === currentYear && taskMonth < currentMonth);
                                        techTasks.push({ eq, week: w, month: taskMonth, type, value: eq.tasks[w][type], isChecked, isPast });
                                    }
                                });
                            });
                        }
                    });

                    // Search filter inside technician tasks
                    const filteredTechTasks = techTasks.filter(t => {
                        if (!adminSearchQuery) return true;
                        const q = adminSearchQuery.toLowerCase();
                        return t.eq.id.toLowerCase().includes(q) ||
                               (t.eq.machine || '').toLowerCase().includes(q) ||
                               t.value.toLowerCase().includes(q);
                    });

                    const pendingCount = filteredTechTasks.filter(t => !t.isChecked).length;
                    const overdueCount = filteredTechTasks.filter(t => !t.isChecked && t.isPast).length;
                    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;

                    return `
                        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; overflow: hidden; padding: 20px; margin-bottom: 15px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #007AFF, #00C7BE); display: flex; align-items: center; justify-content: center; font-weight:700; color:white; font-size:16px;">
                                        ${name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 style="margin:0; font-size: 16px; color:white; font-weight:700;">${window.escapeHTML(name)}</h4>
                                        <span style="font-size:12px; color:#8E8E93;">${window.escapeHTML(u.email)} ${u.secteur ? `• Secteur: ${window.escapeHTML(u.secteur)}` : ''}</span>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:20px;">
                                    <div style="text-align:right;">
                                        <span style="font-size:11px; color:#8E8E93; display:block;">Marchés affectés</span>
                                        <span style="font-size:13px; color:#007AFF; font-weight:700;">${assignedList.length > 0 ? assignedList.join(', ') : 'Aucun'}</span>
                                    </div>
                                    <div onclick="window.openPPTechTasksModal('${u.id}', 'overdue')" style="background: ${overdueCount > 0 ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${overdueCount > 0 ? '#FF3B30' : '#8E8E93'}; border-radius: 12px; padding: 6px 12px; font-size: 12px; font-weight: 800; border: 1px solid ${overdueCount > 0 ? 'rgba(255, 59, 48, 0.3)' : 'transparent'}; cursor:pointer;" title="Cliquer pour voir les retards">
                                        ⚠️ ${overdueCount} en retard
                                    </div>
                                    <div onclick="window.openPPTechTasksModal('${u.id}', 'pending')" style="background: rgba(255,255,255,0.05); color: white; border-radius: 12px; padding: 6px 12px; font-size: 12px; font-weight: 800; cursor:pointer;" title="Cliquer pour voir les tâches à faire">
                                        ⏳ ${pendingCount} à faire
                                    </div>
                                    <button onclick="window.openPPUserMarketsModal('${u.id}', event)" class="btn-primary" style="background:#007AFF; border:none; padding:8px 16px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; color:white;">
                                        Gérer les Marchés
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

window.toggleAdminPPCheck = async function (event, eqId, week, type, targetState) {
    if (event) event.stopPropagation();
    try {
        const encodedWeek = selectedYearFilter * 100 + week;
        await api.savePlanningPrevisionnelCheck(eqId, encodedWeek, type, targetState);
        window.showToast("Statut mis à jour.");
        currentChecks = await api.getPlanningPrevisionnelChecks();
        renderPPWorkspace();
    } catch (e) {
        alert("Erreur lors de la sauvegarde : " + e.message);
    }
};

window.savePPCheck = async function (eqId, week, type, checked) {
    try {
        const encodedWeek = selectedYearFilter * 100 + week;
        await api.savePlanningPrevisionnelCheck(eqId, encodedWeek, type, checked);
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

window.openPPTechTasksModal = function(userId, filterType) {
    const u = ppUsersList.find(x => x.id === userId);
    if (!u) return;
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
    const assignedList = (u.assigned_markets || '').split(',').map(s => s.trim().padStart(2, '0')).filter(Boolean);
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const techTasks = [];
    parsedPlanningData.forEach(eq => {
        let prefix = "Sans MI";
        const cleanId = eq.id.toUpperCase();
        if (cleanId.startsWith("MI")) {
            const num = cleanId.substring(2, 4);
            if (!isNaN(parseInt(num))) prefix = num;
        }
        if (assignedList.includes(prefix.padStart(2, '0'))) {
            Object.keys(eq.tasks).forEach(wStr => {
                const w = parseInt(wStr);
                const taskMonth = getMonthFromWeek(w, selectedYearFilter);
                ['preventif', 'controle', 'metrologie'].forEach(type => {
                    if (eq.tasks[w][type]) {
                        const isChecked = currentChecks.some(c => 
                            c.equipment_id === eq.id && 
                            c.task_type === type && 
                            (c.week_number === (selectedYearFilter * 100 + w) || (selectedYearFilter === 2026 && c.week_number === w))
                        );
                        const isPast = selectedYearFilter < currentYear || (selectedYearFilter === currentYear && taskMonth < currentMonth);
                        techTasks.push({ eq, week: w, month: taskMonth, type, value: eq.tasks[w][type], isChecked, isPast });
                    }
                });
            });
        }
    });

    // Apply global search query filter if active
    const filteredTasks = techTasks.filter(t => {
        if (!adminSearchQuery) return true;
        const q = adminSearchQuery.toLowerCase();
        return t.eq.id.toLowerCase().includes(q) ||
               (t.eq.machine || '').toLowerCase().includes(q) ||
               t.value.toLowerCase().includes(q);
    });

    let displayTasks = [];
    let modalTitle = "";
    let icon = "";
    
    if (filterType === 'overdue') {
        displayTasks = filteredTasks.filter(t => !t.isChecked && t.isPast);
        modalTitle = `Tâches en retard - ${name}`;
        icon = "⚠️";
    } else {
        displayTasks = filteredTasks.filter(t => !t.isChecked);
        modalTitle = `Tâches à faire - ${name}`;
        icon = "⏳";
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'tech-tasks-modal';
    overlay.style.zIndex = '1000000';
    
    overlay.innerHTML = `
        <div class="modal-box" style="max-width: 650px; width: 100%;">
            <div class="modal-header" style="display:flex; align-items:center; gap:10px;">
                <span>${icon}</span> ${window.escapeHTML(modalTitle)}
            </div>
            <p style="margin-bottom: 20px; color: #8E8E93; font-size:13.5px;">
                Marchés du technicien : ${assignedList.join(', ') || 'Aucun'}
            </p>
            
            <div style="max-height: 400px; overflow-y: auto; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px; margin-bottom: 24px;">
                ${displayTasks.length === 0 ? `
                    <p style="text-align:center; padding: 20px; color:#8E8E93; font-style:italic; margin:0;">Aucune tâche dans cette catégorie</p>
                ` : displayTasks.map(t => {
                    const typeLabel = t.type === 'preventif' ? 'Préventif' : (t.type === 'controle' ? 'Contrôle' : 'Métrologie');
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; font-size:13px;">
                            <div>
                                <span style="font-weight:800; color:#007AFF;">${window.escapeHTML(t.eq.id)}</span>
                                <strong style="color:white; margin-left:8px;">${window.escapeHTML(t.eq.machine || 'Machine')}</strong>
                                <div style="margin-top:4px; font-size:12px; color:#8E8E93;">
                                    <strong>Mois: ${MONTH_NAMES[t.month - 1]} (S${t.week}) • ${typeLabel}</strong>: ${window.escapeHTML(t.value)}
                                </div>
                            </div>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#8E8E93; font-weight:700; font-size:12.5px; flex-shrink:0;">
                                <input type="checkbox" style="width:18px; height:18px; cursor:pointer;" ${t.isChecked ? 'checked' : ''} onchange="window.savePPCheckFromModal('${t.eq.id}', ${t.week}, '${t.type}', this.checked, '${userId}', '${filterType}')">
                                Acquitter
                            </label>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="modal-actions" style="justify-content:flex-end;">
                <button class="btn-primary" onclick="closeModal('tech-tasks-modal')" style="border-radius:12px; height:40px; padding:0 24px; background:#007AFF;">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.savePPCheckFromModal = async function (eqId, week, type, checked, userId, filterType) {
    try {
        const encodedWeek = selectedYearFilter * 100 + week;
        await api.savePlanningPrevisionnelCheck(eqId, encodedWeek, type, checked);
        window.showToast("Statut mis à jour.");
        currentChecks = await api.getPlanningPrevisionnelChecks();
        
        // Refresh underlying workspace
        renderPPWorkspace();
        
        // Refresh modal content by closing and reopening it
        closeModal('tech-tasks-modal');
        window.openPPTechTasksModal(userId, filterType);
    } catch (e) {
        alert("Erreur lors de la sauvegarde : " + e.message);
    }
};
