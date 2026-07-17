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
let currentExcelFileKey = 'planning_previsionnel.xlsm';

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
                border-collapse: separate;
                border-spacing: 0;
                background: rgba(255,255,255,0.02);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px;
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
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Maintenance Prévisionnelle</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Suivi mensuel et annuel de la métrologie et de la maintenance préventive</p>
                    </div>
                </div>

                <!-- Navigation Tabs -->
                <div style="display: flex; gap: 10px;">
                    <button id="tab-btn-matrix" class="pp-tab-btn ${selectedTab === 'matrix' ? 'active' : ''}" onclick="window.switchPPTab('matrix')">📅 Matrice Annuelle</button>
                    <button id="tab-btn-tech" class="pp-tab-btn ${selectedTab === 'tech' ? 'active' : ''}" onclick="window.switchPPTab('tech')">👥 Suivi Techniciens</button>
                    <button id="tab-btn-import" class="pp-tab-btn ${selectedTab === 'import' ? 'active' : ''}" onclick="window.switchPPTab('import')">📤 Fichier Excel (ref)</button>
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

                parsedPlanningData = parsed;

                window.showToast("Synchronisation avec le planning normal...");
                await window.syncAllPrevisionnelTasks(new Date().getFullYear());

                window.showToast("Importation réussie !");
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

window.downloadPPExcelFile = async function () {
    try {
        window.showToast("Préparation du téléchargement...");
        const downloadUrl = `${config.api.workerUrl}/get/${encodeURI(currentExcelFileKey)}`;
        const authHeaders = await api.getAuthHeaders();
        const response = await fetch(downloadUrl, { headers: authHeaders });
        if (!response.ok) throw new Error("Impossible de récupérer le fichier sur le serveur.");

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const downloadName = currentExcelFileKey.split('/').pop() || 'planning_previsionnel.xlsm';

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        window.showToast("Téléchargement réussi !");
    } catch (e) {
        alert("Erreur de téléchargement : " + e.message);
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

        // Dynamically find Excel file key currently in R2 bucket
        try {
            const files = await api.listFiles(null, true);
            const excelFiles = files.filter(f => f.key.toLowerCase().endsWith('.xlsm') || f.key.toLowerCase().endsWith('.xlsx'));
            if (excelFiles.length > 0) {
                // Sort by upload date descending (latest first)
                excelFiles.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
                currentExcelFileKey = excelFiles[0].key;
            }
        } catch (fileErr) {
            console.warn("Could not list R2 files for excel download:", fileErr);
        }

        if (!parsedPlanningData) {
            let res = await fetch(`${config.api.workerUrl}/get/planning_previsionnel_data.json`);
            if (res.ok) {
                parsedPlanningData = await res.json();
            } else {
                res = await fetch(`${config.api.workerUrl}/get/${encodeURI(currentExcelFileKey)}`);
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
        const downloadName = currentExcelFileKey.split('/').pop() || 'planning_previsionnel.xlsm';
        const downloadUrl = `${config.api.workerUrl}/get/${encodeURI(currentExcelFileKey)}`;
        container.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; color:#8E8E93; background:rgba(255,255,255,0.01); border-radius:20px; border: 1px dashed rgba(255,255,255,0.1); max-width: 650px; margin: 40px auto;">
                <span style="font-size:60px; display:block; margin-bottom:20px;">📊</span>
                <h2 style="color:white; margin-bottom:10px;">Fichier Excel (ref)</h2>
                <p style="font-size:14px; margin-bottom:30px; max-width:480px; margin-left:auto; margin-right:auto; line-height:1.5;">
                    Gérez le fichier Excel de référence. Actuellement détecté dans R2 : <strong>${window.escapeHTML(downloadName)}</strong>. Vous pouvez télécharger le fichier actuellement en service ou en importer un nouveau pour mettre à jour la planification.
                </p>
                <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
                    <button onclick="window.downloadPPExcelFile()" style="display:inline-flex; align-items:center; gap:10px; border-radius:12px; height:46px; padding:0 24px; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); font-weight:700; color:white; text-decoration:none; cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        📥 Télécharger le fichier actuel
                    </button>
                    <label class="btn-primary" style="display:inline-flex; align-items:center; gap:10px; border-radius:12px; height:46px; padding:0 24px; background:#007AFF; font-weight:700; border:none; color:white; cursor:pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        📤 Importer un nouveau fichier (.xlsm)
                        <input type="file" id="excel-upload-input" accept=".xlsm" style="display:none;" onchange="window.uploadPPExcel(this)">
                    </label>
                </div>
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
        const currentYear = new Date().getFullYear();
        // Calculate current ISO week
        const getISOWeek = (date) => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        };
        const currentWeek = getISOWeek(new Date()) || 1;

        container.innerHTML = `
            <div id="pp-matrix-scroll-container" style="overflow-x: auto; border-radius: 12px; background: rgba(0,0,0,0.2); max-height: 70vh; overflow-y: auto; scroll-behavior: smooth;">
                <table class="pp-matrix-table" style="border-collapse: separate; border-spacing: 0; width: 100%;">
                    <thead>
                        <tr>
                            <th style="min-width: 80px; position: sticky; left: 0; background: #1c1c21 !important; z-index: 25 !important; border-bottom: 2px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.08);">MI ID</th>
                            <th style="min-width: 160px; position: sticky; left: 80px; background: #1c1c21 !important; z-index: 25 !important; border-bottom: 2px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.08);">Machine / Détails</th>
                            <th style="min-width: 110px; position: sticky; left: 240px; background: #1c1c21 !important; z-index: 25 !important; border-bottom: 2px solid rgba(255,255,255,0.1); border-right: 2px solid rgba(255,255,255,0.15);">Marché</th>
                            ${Array.from({ length: 52 }, (_, i) => {
                                const wNum = i + 1;
                                const isCurrent = (wNum === currentWeek && selectedYearFilter === currentYear);
                                const highlightStyle = isCurrent ? 'background: rgba(0, 122, 255, 0.25) !important; border-left: 2px solid #007AFF; border-right: 2px solid #007AFF; font-weight: 900; color: #007AFF;' : 'background: #1c1c1e;';
                                return `<th id="pp-header-week-${wNum}" style="text-align:center; min-width: 38px; font-size: 11px; border-bottom: 2px solid rgba(255,255,255,0.1); ${highlightStyle}">S${wNum}</th>`;
                            }).join('')}
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
                                    <td style="font-weight: 800; color: #007AFF; position: sticky; left: 0; background: #1c1c21 !important; z-index: 12 !important; border-bottom: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.08);">${window.escapeHTML(eq.id)}</td>
                                    <td style="position: sticky; left: 80px; background: #1c1c21 !important; z-index: 12 !important; border-bottom: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.08);">
                                        <div style="font-weight: 700; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="${window.escapeHTML(eq.machine || 'Machine')}">${window.escapeHTML(eq.machine || 'Machine')}</div>
                                        <div style="font-size:10px; color:#8E8E93; margin-top:2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="${eq.brand ? `${window.escapeHTML(eq.brand)} ` : ''}${eq.model ? `• ${window.escapeHTML(eq.model)} ` : ''}">
                                            ${eq.brand ? `${window.escapeHTML(eq.brand)}` : ''}
                                            ${eq.model ? ` • ${window.escapeHTML(eq.model)}` : ''}
                                        </div>
                                    </td>
                                    <td style="position: sticky; left: 240px; background: #1c1c21 !important; z-index: 12 !important; border-bottom: 1px solid rgba(255,255,255,0.05); border-right: 2px solid rgba(255,255,255,0.15);">
                                        <span style="font-size:11px; color:#AEAEB2; font-weight:600;">${window.escapeHTML(prefix)}</span>
                                        ${eq.location ? `<div style="font-size:9px; color:#636366; margin-top:2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;" title="${window.escapeHTML(eq.location)}">${window.escapeHTML(eq.location)}</div>` : ''}
                                    </td>
                                    ${Array.from({ length: 52 }, (_, i) => {
                                        const w = i + 1;
                                        const isCurrent = (w === currentWeek && selectedYearFilter === currentYear);
                                        const cellHighlight = isCurrent ? 'background: rgba(0, 122, 255, 0.1) !important; border-left: 1.5px solid rgba(0, 122, 255, 0.4); border-right: 1.5px solid rgba(0, 122, 255, 0.4);' : '';
                                        
                                        const tasksInWeek = [];
                                        if (eq.tasks && eq.tasks[w]) {
                                            ['preventif', 'controle', 'metrologie'].forEach(type => {
                                                if (eq.tasks[w][type]) {
                                                    const isChecked = currentChecks.some(c =>
                                                        c.equipment_id === eq.id &&
                                                        c.task_type === type &&
                                                        (c.week_number === (selectedYearFilter * 100 + w) || (selectedYearFilter === 2026 && c.week_number === w))
                                                    );
                                                    tasksInWeek.push({ type, val: eq.tasks[w][type], isChecked });
                                                }
                                            });
                                        }

                                        if (tasksInWeek.length === 0) {
                                            return `<td style="text-align:center; color:rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); ${cellHighlight}">-</td>`;
                                        }

                                        return `
                                            <td style="text-align:center; vertical-align: middle; padding: 4px 2px; border-bottom: 1px solid rgba(255,255,255,0.05); ${cellHighlight}">
                                                <div style="display:flex; flex-direction: column; justify-content:center; align-items: center; gap:3px;">
                                                    ${tasksInWeek.map(t => {
                                                        const letter = t.type === 'preventif' ? 'P' : (t.type === 'controle' ? 'C' : 'M');
                                                        const label = t.type === 'preventif' ? 'Préventif' : (t.type === 'controle' ? 'Contrôle' : 'Métrologie');

                                                        let stateClass = 'future';
                                                        if (t.isChecked) {
                                                            stateClass = 'checked';
                                                        } else {
                                                            const isPast = selectedYearFilter < currentYear || (selectedYearFilter === currentYear && w < currentWeek);
                                                            if (isPast) {
                                                                stateClass = 'overdue';
                                                            }
                                                        }

                                                        const tooltipText = `S${w} - ${label}: ${t.val.replace(/"/g, '&quot;')}`;

                                                        return `
                                                            <span class="pp-status-dot pp-tooltip ${stateClass}" 
                                                                  data-tooltip="${window.escapeHTML(tooltipText)}"
                                                                  onclick="window.toggleAdminPPCheck(event, '${eq.id}', ${w}, '${t.type}', ${!t.isChecked})"
                                                                  style="width: 16px; height: 16px; font-size: 9px; line-height: 16px; font-weight: 800; border-radius: 4px;">
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

        // Auto-scroll to current week column dynamically measuring the sticky header width
        setTimeout(() => {
            const scrollContainer = document.getElementById('pp-matrix-scroll-container');
            const targetHeader = document.getElementById(`pp-header-week-${currentWeek}`);
            if (scrollContainer && targetHeader) {
                const thirdHeader = scrollContainer.querySelector('thead th:nth-child(3)');
                const stickyWidth = thirdHeader ? (thirdHeader.offsetLeft + thirdHeader.offsetWidth) : 350;
                scrollContainer.scrollLeft = targetHeader.offsetLeft - stickyWidth;
            }
        }, 150);

        return;
    }

    if (selectedTab === 'tech') {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const getISOWeek = (date) => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        };
        const currentWeek = getISOWeek(new Date()) || 1;

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
                                const isPast = selectedYearFilter < currentYear || (selectedYearFilter === currentYear && w < currentWeek);
                                const isCurrentWeek = (selectedYearFilter === currentYear && w === currentWeek);
                                techTasks.push({ eq, week: w, month: taskMonth, type, value: eq.tasks[w][type], isChecked, isPast, isCurrentWeek });
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

            const overdueCount = filteredTechTasks.filter(t => !t.isChecked && t.isPast).length;
            const currentWeekCount = filteredTechTasks.filter(t => !t.isChecked && t.isCurrentWeek).length;
            const activeCount = overdueCount + currentWeekCount;
            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;

            return `
                        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                            <div style="display: grid; grid-template-columns: minmax(220px, 1.2fr) auto auto auto; align-items: center; gap: 20px;">
                                <!-- Column 1: Info User -->
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #007AFF, #00C7BE); display: flex; align-items: center; justify-content: center; font-weight:700; color:white; font-size:16px; box-shadow: 0 4px 10px rgba(0, 122, 255, 0.25);">
                                        ${name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 style="margin:0; font-size: 16px; color:white; font-weight:700;">${window.escapeHTML(name)}</h4>
                                        <span style="font-size:12px; color:#C7C7CC; font-weight: 500;">${window.escapeHTML(u.email)} ${u.secteur ? `• Secteur: ${window.escapeHTML(u.secteur)}` : ''}</span>
                                    </div>
                                </div>

                                <!-- Column 2: Marché & Toggles -->
                                <div style="display:flex; align-items:center; gap:15px;">
                                    <div style="text-align:left; min-width: 90px;">
                                        <span style="font-size:11px; color:#C7C7CC; display:block; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Marchés</span>
                                        <span style="font-size:14px; color:#007AFF; font-weight:700;">${assignedList.length > 0 ? assignedList.join(', ') : 'Aucun'}</span>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:4px; background: rgba(255,255,255,0.04); padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
                                        <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#E5E5EA; cursor:pointer; margin: 0; font-weight: 600;">
                                            <input type="checkbox" onchange="window.toggleUserPPPreference('${u.id}', 'maintenance_planning', this.checked)" ${u.preferences?.maintenance_planning !== false ? 'checked' : ''} style="width:14px; height:14px; cursor:pointer;">
                                            Planning
                                        </label>
                                        <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#E5E5EA; cursor:pointer; margin: 0; font-weight: 600;">
                                            <input type="checkbox" onchange="window.toggleUserPPPreference('${u.id}', 'maintenance_notifications', this.checked)" ${u.preferences?.maintenance_notifications !== false ? 'checked' : ''} style="width:14px; height:14px; cursor:pointer;">
                                            Notifications
                                        </label>
                                        <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#E5E5EA; cursor:pointer; margin: 0; font-weight: 600;">
                                            <input type="checkbox" onchange="window.toggleUserPPPreference('${u.id}', 'maintenance_copy', this.checked)" ${u.preferences?.maintenance_copy === true ? 'checked' : ''} style="width:14px; height:14px; cursor:pointer;">
                                            Copie
                                        </label>
                                    </div>
                                </div>

                                <!-- Column 3: Badges -->
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div onclick="window.openPPTechTasksModal('${u.id}', 'active')" style="background: ${activeCount > 0 ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255,255,255,0.08)'}; color: ${activeCount > 0 ? '#007AFF' : '#C7C7CC'}; border-radius: 10px; padding: 8px 12px; font-size: 12px; font-weight: 700; border: 1px solid ${activeCount > 0 ? 'rgba(0, 122, 255, 0.3)' : 'rgba(255,255,255,0.05)'}; cursor:pointer; display: flex; align-items:center; gap: 6px;" title="Cliquer pour voir les tâches actives et retards">
                                        📋 <span style="font-weight: 800; color: ${activeCount > 0 ? '#007AFF' : '#C7C7CC'};">${activeCount}</span> tâches à faire
                                    </div>
                                </div>

                                <!-- Column 4: Actions -->
                                <div style="display:flex; align-items:center; gap:10px; justify-content: flex-end;">
                                    <button onclick="window.openPPUserMarketsModal('${u.id}', event)" class="btn-primary" style="background:#007AFF; border:none; padding:10px 16px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; color:white; box-shadow: 0 4px 10px rgba(0, 122, 255, 0.25);">
                                        Gérer les Marchés
                                    </button>
                                    <button onclick="window.testPPUserNotification('${u.id}', event)" class="btn-secondary" style="border:1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; color:white; display:flex; align-items:center; gap:6px;" title="Tester l'envoi de notification immédiatement">
                                        🔔 Test
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
        }))).filter(m => m !== "Sans MI").sort((a, b) => parseInt(a) - parseInt(b));

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

                window.showToast("Synchronisation des tâches...");
                const userPrefs = u.preferences || {};
                const planningEnabled = userPrefs.maintenance_planning !== false;
                await window.syncPrevisionnelTasksForUser(u.id, planningEnabled ? newVal : '', new Date().getFullYear());

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

window.openPPTechTasksModal = function (userId, filterType) {
    const u = ppUsersList.find(x => x.id === userId);
    if (!u) return;
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
    const assignedList = (u.assigned_markets || '').split(',').map(s => s.trim().padStart(2, '0')).filter(Boolean);

    const currentYear = new Date().getFullYear();
    const getISOWeek = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };
    const currentWeek = getISOWeek(new Date()) || 1;

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
                        const isPast = selectedYearFilter < currentYear || (selectedYearFilter === currentYear && w < currentWeek);
                        const isCurrentWeek = (selectedYearFilter === currentYear && w === currentWeek);
                        techTasks.push({ eq, week: w, month: taskMonth, type, value: eq.tasks[w][type], isChecked, isPast, isCurrentWeek });
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

    if (filterType === 'active') {
        displayTasks = filteredTasks.filter(t => !t.isChecked && (t.isPast || t.isCurrentWeek));
        // Sort: overdue tasks first, then sorted by week number
        displayTasks.sort((a, b) => {
            if (a.isPast !== b.isPast) return a.isPast ? -1 : 1;
            return a.week - b.week;
        });
        modalTitle = `Tâches à faire & Retards - ${name}`;
        icon = "📋";
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
                    <p style="text-align:center; padding: 20px; color:#8E8E93; font-style:italic; margin:0;">Aucune tâche à faire pour le moment.</p>
                ` : displayTasks.map(t => {
                    const typeLabel = t.type === 'preventif' ? 'Préventif' : (t.type === 'controle' ? 'Contrôle' : 'Métrologie');
                    
                    const statusBadge = t.isPast 
                        ? `<span style="background: rgba(255, 69, 58, 0.12); color: #FF453A; padding: 3px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 800; border: 1px solid rgba(255, 69, 58, 0.25); display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; margin-left: 6px;">⚠️ En retard (S${t.week})</span>`
                        : `<span style="background: rgba(0, 122, 255, 0.12); color: #007AFF; padding: 3px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 800; border: 1px solid rgba(0, 122, 255, 0.25); display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; margin-left: 6px;">⏳ Cette semaine (S${t.week})</span>`;

                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; font-size:13px;">
                            <div>
                                <span style="font-weight:800; color:#007AFF;">${window.escapeHTML(t.eq.id)}</span>
                                <strong style="color:white; margin-left:8px;">${window.escapeHTML(t.eq.machine || 'Machine')}</strong>
                                ${statusBadge}
                                <div style="margin-top:4px; font-size:12px; color:#8E8E93;">
                                    <strong>${typeLabel}</strong>: ${window.escapeHTML(t.value)}
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

window.syncPrevisionnelTasksForUser = async function (userId, assignedMarketsString, year) {
    if (!year) year = new Date().getFullYear();

    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    let deletedCount = 0;
    let createdCount = 0;

    // 1. Delete all existing [PREV] / [AUTO-PREV] tasks for this user in this year
    try {
        const existingTasks = await api.getAdminTasks(startOfYear, endOfYear);
        const tasksToDelete = existingTasks.filter(t => t.user_id === userId && t.title && (t.title.startsWith('[AUTO-PREV]') || t.title.startsWith('[PREV]')));

        for (const t of tasksToDelete) {
            await api.deleteAdminTask(t.id);
            deletedCount++;
        }
    } catch (e) {
        console.error("Error deleting old auto-prev tasks:", e);
    }

    // 2. Parse assigned markets
    const assignedMarkets = (assignedMarketsString || '')
        .split(',')
        .map(m => m.trim().padStart(2, '0'))
        .filter(Boolean);

    console.log(`[Diagnostic] User ${userId} has assigned markets:`, assignedMarkets);
    if (assignedMarkets.length === 0) {
        return { deletedCount, createdCount, status: "No assigned markets" };
    }

    // 3. Load planning previsionnel data if not cached
    if (!parsedPlanningData) {
        try {
            const res = await fetch(`${config.api.workerUrl}/get/planning_previsionnel_data.json`);
            if (res.ok) {
                parsedPlanningData = await res.json();
            }
        } catch (err) {
            console.error("Failed to load previsionnel data for sync:", err);
        }
    }
    if (!parsedPlanningData || !Array.isArray(parsedPlanningData)) {
        return { deletedCount, createdCount, status: "Planning data not found or invalid" };
    }

    // Helper to get Monday date of a week
    const getMondayOfWeek = (w, y) => {
        const jan4 = new Date(y, 0, 4);
        const day = jan4.getDay() || 7;
        const mondayVal = jan4.getTime() - (day - 1) * 24 * 60 * 60 * 1000;
        const targetMonday = new Date(mondayVal + (w - 1) * 7 * 24 * 60 * 60 * 1000);
        const year = targetMonday.getFullYear();
        const month = String(targetMonday.getMonth() + 1).padStart(2, '0');
        const date = String(targetMonday.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    };

    // 4. Group tasks by (week, market_no)
    const grouped = {};

    parsedPlanningData.forEach(eq => {
        // Extract market number from equipment ID digits (e.g. MI02... -> '02') to match assigned_markets
        let eqMarket = "";
        const cleanId = eq.id.toUpperCase();
        if (cleanId.startsWith("MI")) {
            const num = cleanId.substring(2, 4);
            if (!isNaN(parseInt(num))) {
                eqMarket = num.padStart(2, '0');
            }
        }

        if (!eqMarket || !assignedMarkets.includes(eqMarket)) return;

        Object.entries(eq.tasks || {}).forEach(([weekStr, taskTypes]) => {
            const week = parseInt(weekStr);
            const key = `${week}_${eqMarket}`;
            if (!grouped[key]) {
                grouped[key] = {
                    week,
                    market_no: eqMarket,
                    preventif: 0,
                    controle: 0,
                    metrologie: 0
                };
            }
            if (taskTypes.preventif) grouped[key].preventif++;
            if (taskTypes.controle) grouped[key].controle++;
            if (taskTypes.metrologie) grouped[key].metrologie++;
        });
    });

    console.log(`[Diagnostic] Grouped ${Object.keys(grouped).length} weeks for user markets.`);

    // 5. Create new tasks
    for (const g of Object.values(grouped)) {
        if (g.preventif === 0 && g.controle === 0 && g.metrologie === 0) continue;

        const mondayDate = getMondayOfWeek(g.week, year);
        const parts = [];
        if (g.preventif > 0) parts.push(`${g.preventif} prév`);
        if (g.controle > 0) parts.push(`${g.controle} Controle`);
        if (g.metrologie > 0) parts.push(`${g.metrologie} métrologie`);
        const title = `[PREV] MI${g.market_no}, ${parts.join(' ')}`;

        try {
            await api.saveAdminTask({
                user_id: userId,
                title: title,
                date: mondayDate,
                start_time: "00:00:00",
                end_time: "00:00:00",
                done: false
            });
            createdCount++;
        } catch (e) {
            console.error("Error creating auto-prev task:", e);
        }
    }
    return { deletedCount, createdCount, status: "Success" };
};

window.syncAllPrevisionnelTasks = async function (year) {
    if (!year) year = new Date().getFullYear();
    try {
        const users = await api.listUsers(true);
        let totalDeleted = 0;
        let totalCreated = 0;
        let userReports = [];

        for (const u of users) {
            const userPrefs = u.preferences || {};
            const planningEnabled = userPrefs.maintenance_planning !== false;
            const res = await window.syncPrevisionnelTasksForUser(u.id, planningEnabled ? u.assigned_markets : '', year);
            totalDeleted += res.deletedCount;
            totalCreated += res.createdCount;
            if (res.createdCount > 0 || res.deletedCount > 0) {
                userReports.push(`${u.first_name} ${u.last_name}: -${res.deletedCount} / +${res.createdCount} tâches (${res.status})`);
            }
        }

        alert(`[Diagnostic Sync]\n` +
            `Utilisateurs traités : ${users.length}\n` +
            `Total tâches supprimées : ${totalDeleted}\n` +
            `Total tâches créées : ${totalCreated}\n\n` +
            `Détails :\n` + (userReports.length > 0 ? userReports.join('\n') : "Aucune modification de tâche."));
    } catch (e) {
        console.error("Error syncing all users previsionnel tasks:", e);
        alert("Erreur de synchronisation globale : " + e.message);
    }
};

window.toggleUserPPPreference = async function (userId, key, checked) {
    try {
        const u = ppUsersList.find(user => user.id === userId);
        if (!u) return;

        const preferences = u.preferences || {};
        preferences[key] = checked;

        window.showToast("Mise à jour des préférences...");
        await api.updateUserProfile(u.id, u.first_name, u.last_name, u.secteur, u.societe, u.assigned_markets, preferences);
        u.preferences = preferences;

        if (key === 'maintenance_planning') {
            const currentYear = new Date().getFullYear();
            await window.syncPrevisionnelTasksForUser(u.id, checked ? (u.assigned_markets || '') : '', currentYear);
        }
        window.showToast("Préférences sauvegardées.");
    } catch (e) {
        alert("Erreur lors de la mise à jour des préférences : " + e.message);
    }
};

window.testPPUserNotification = async function (userId, event) {
    if (event) event.stopPropagation();
    try {
        const u = ppUsersList.find(user => user.id === userId);
        if (!u) return;

        const assignedList = (u.assigned_markets || '').split(',').map(s => s.trim().padStart(2, '0')).filter(Boolean);
        if (assignedList.length === 0) {
            alert("Cet utilisateur n'a aucun marché affecté.");
            return;
        }

        // Calculate ISO Week (same algorithm as worker)
        const getISOWeek = (date) => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        };
        const currentWeek = getISOWeek(new Date()) || 1;

        const userEquipments = parsedPlanningData.filter(eq => {
            let prefix = "Sans MI";
            const cleanId = eq.id.toUpperCase();
            if (cleanId.startsWith("MI")) {
                const num = cleanId.substring(2, 4);
                if (!isNaN(parseInt(num))) prefix = num;
            }
            return assignedList.includes(prefix.padStart(2, '0'));
        });

        const eqDetails = [];
        userEquipments.forEach(eq => {
            let pCount = 0, cCount = 0, mCount = 0;
            if (eq.tasks) {
                Object.keys(eq.tasks).forEach(wStr => {
                    const w = parseInt(wStr);
                    const types = ['preventif', 'controle', 'metrologie'];
                    if (w < currentWeek) {
                        const uploadW = eq.upload_week || 1;
                        if (w >= uploadW) {
                            types.forEach(type => {
                                if (eq.tasks[wStr][type]) {
                                    const isChecked = currentChecks.some(c =>
                                        c.equipment_id === eq.id &&
                                        c.task_type === type &&
                                        (c.week_number === (selectedYearFilter * 100 + w) || (selectedYearFilter === 2026 && c.week_number === w))
                                    );
                                    if (!isChecked) {
                                        if (type === 'preventif') pCount++;
                                        if (type === 'controle') cCount++;
                                        if (type === 'metrologie') mCount++;
                                    }
                                }
                            });
                        }
                    } else if (w === currentWeek) {
                        types.forEach(type => {
                            if (eq.tasks[wStr][type]) {
                                const isChecked = currentChecks.some(c =>
                                    c.equipment_id === eq.id &&
                                    c.task_type === type &&
                                    (c.week_number === (selectedYearFilter * 100 + w) || (selectedYearFilter === 2026 && c.week_number === w))
                                );
                                if (!isChecked) {
                                    if (type === 'preventif') pCount++;
                                    if (type === 'controle') cCount++;
                                    if (type === 'metrologie') mCount++;
                                }
                            }
                        });
                    }
                });
            }

            if (pCount > 0 || cCount > 0 || mCount > 0) {
                const parts = [];
                if (pCount > 0) parts.push(`${pCount} prév`);
                if (cCount > 0) parts.push(`${cCount} Controle`);
                if (mCount > 0) parts.push(`${mCount} métrologie`);
                eqDetails.push(`${eq.id} ${eq.machine || eq.brand || 'Machine'} (${parts.join(' ')})`);
            }
        });

        if (eqDetails.length === 0) {
            alert("Aucune tâche en attente pour cet utilisateur (le test enverrait une notification vide).");
            return;
        }

        const testMsg = `📅 Maintenance Prév : En attente : ${eqDetails.join(', ')} à voir dans l'app maintenance prévisionnelle.`;
        const finalMsg = testMsg.length > 450 ? testMsg.substring(0, 447) + "..." : testMsg;
        window.showToast("Envoi de la notification réelle...");

        const result = await api.sendNotification(u.id, finalMsg, null, "dashboard.html?tab=planning-previsionnel");
        if (result && result.success === false) {
            alert(`[Envoi Échoué]\n${result.details || 'Aucun appareil enregistré ou erreur de token.'}`);
        } else {
            // Send copy to users in copy
            const copyRecipients = ppUsersList.filter(user => user.preferences?.maintenance_copy === true);
            for (const r of copyRecipients) {
                try {
                    const copyMsg = `[Copie] ${u.first_name || ''} ${u.last_name || ''} a reçu : ${finalMsg}`;
                    await api.sendNotification(r.id, copyMsg, null, "dashboard.html?tab=planning-previsionnel");
                } catch (err) {
                    console.error("Failed to send copy notification to:", r.email, err);
                }
            }
            window.showToast("Notification envoyée avec succès !");
        }
    } catch (e) {
        alert("Erreur lors de l'envoi de la notification : " + e.message);
    }
};
