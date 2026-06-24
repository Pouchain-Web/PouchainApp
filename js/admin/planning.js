import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.isClosedDay = function (dateStr) {
    if (!window.currentClosedDays) return false;
    for (const item of window.currentClosedDays) {
        if (typeof item === 'string') {
            if (dateStr === item) return true;
        } else if (item && item.start && item.end) {
            if (dateStr >= item.start && dateStr <= item.end) return true;
        }
    }
    return false;
};

window.addClosedDay = async function () {
    if (!window.currentClosedDays) window.currentClosedDays = [];
    const today = new Date().toISOString().split('T')[0];
    window.currentClosedDays.push({ start: today, end: today });
    await api.setPlanningClosedDays(window.currentClosedDays);
    if (window.renderAdminPlanning && window.currentPlanningMonday) {
        window.renderAdminPlanning(window.currentPlanningMonday, !!document.getElementById('planning-v2-container'), true);
    }
};

window.updateClosedDay = async function (index, field, value) {
    if (!window.currentClosedDays || typeof window.currentClosedDays[index] === 'undefined') return;
    let item = window.currentClosedDays[index];
    if (typeof item === 'string') {
        item = { start: item, end: item };
        window.currentClosedDays[index] = item;
    }
    item[field] = value;

    // Auto correct order
    if (item.start && item.end && item.start > item.end) {
        const temp = item.start;
        item.start = item.end;
        item.end = temp;
    }

    await api.setPlanningClosedDays(window.currentClosedDays);
    if (window.renderAdminPlanning && window.currentPlanningMonday) {
        window.renderAdminPlanning(window.currentPlanningMonday, !!document.getElementById('planning-v2-container'), true);
    }
};

window.removeClosedDay = async function (index) {
    if (!window.currentClosedDays) return;
    window.currentClosedDays.splice(index, 1);
    await api.setPlanningClosedDays(window.currentClosedDays);
    if (window.renderAdminPlanning && window.currentPlanningMonday) {
        window.renderAdminPlanning(window.currentPlanningMonday, !!document.getElementById('planning-v2-container'), true);
    }
};

window.renderAdminPlanning = async function (mondayStr = null, isTV = false, isRefresh = false) {
    if (window.planningRefreshInProgress) {
        console.log("Planning refresh already in progress, skipping...");
        return;
    }

    const content = document.getElementById('admin-content');
    if (!content && !isTV) {
        if (window.currentAdminSession) renderAdminView(window.currentAdminSession);
        setTimeout(() => window.renderAdminPlanning(mondayStr, isTV), 300);
        return;
    }

    window.planningRefreshInProgress = true;

    if (window.planningRefreshInterval) clearInterval(window.planningRefreshInterval);

    // Auto-refresh logic
    window.lastAutoSortTime = window.lastAutoSortTime || Date.now();
    window.planningRefreshInterval = setInterval(async () => {
        const tvContainer = document.getElementById('planning-tv-container');
        const navPlanning = document.getElementById('nav-planning');
        const isTVActive = !!tvContainer;
        const isPlanningActive = isTVActive || (navPlanning && navPlanning.classList.contains('active'));

        if (isPlanningActive) {
            const isAnyFS = !!document.fullscreenElement || isTVActive;
            const currentMonday = document.querySelector('[data-monday]');
            const mondayToUse = currentMonday ? currentMonday.getAttribute('data-monday') : null;

            // 1. Auto-refresh (15s) only if in a fullscreen/TV mode
            if (isAnyFS) {
                renderAdminPlanning(mondayToUse, isTVActive, true);
            }

            // 2. Auto-sort every 60 seconds (always if page open)
            const now = Date.now();
            if (now - window.lastAutoSortTime > 60000) {
                window.lastAutoSortTime = now;
                console.log("Auto-tri du planning en arrière-plan...");
                await window.autoSortPlanningUsers(mondayToUse, isTVActive, true); // isSilent = true
                if (!isAnyFS) {
                    renderAdminPlanning(mondayToUse, false, true);
                }
            }
        } else {
            clearInterval(window.planningRefreshInterval);
        }
    }, 15000);

    window.adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-planning');
    if (navItem) navItem.classList.add('active');
    const existingContainer = document.getElementById('planning-tv-container') || document.getElementById('integrated-planning-container');
    const isCurrentlyFullscreen = (!!document.fullscreenElement) || (existingContainer && existingContainer.id === 'planning-tv-container') || (new URLSearchParams(window.location.search).get('fullscreen'));

    if (!existingContainer && !isRefresh) {
        content.innerHTML = `<div style="display:flex; justify-content:center; padding: 40px;"><div class="loader" style="border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div></div>`;
    }

    // Compute Monday
    let currentMonday;
    if (mondayStr) {
        currentMonday = new Date(mondayStr + 'T12:00:00');
        // Force to Monday
        const day = currentMonday.getDay();
        const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
        currentMonday.setDate(diff);
    } else {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        currentMonday = new Date(now.getFullYear(), now.getMonth(), diff);
    }
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);

    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${currentMonday.getFullYear()}-${pad(currentMonday.getMonth() + 1)}-${pad(currentMonday.getDate())}`;
    const endStr = `${currentSunday.getFullYear()}-${pad(currentSunday.getMonth() + 1)}-${pad(currentSunday.getDate())}`;

    try {
        let closedDays = [];
        let fsConfig = { timer: 40, files: [] };
        try {
            [closedDays, fsConfig] = await Promise.all([
                api.getPlanningClosedDays(),
                api.getPlanningSlideshowConfig()
            ]);
        } catch (e) {
            console.warn("Could not fetch planning configs:", e);
        }
        window.currentClosedDays = closedDays || [];
        window.currentSlideshowConfig = fsConfig || { timer: 40, files: [] };

        const allUsers = await api.listUsers();

        // Filtre secteur — 'Tout' affiche tous les utilisateurs, sinon uniquement le secteur courant.
        // Pour ajouter un nouveau secteur, aucun changement nécessaire ici.
        const planningAdminSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = planningAdminSecteur === 'Tout'
            ? allUsers
            : allUsers.filter(u => u.secteur === planningAdminSecteur);

        let tasks = [];
        try {
            tasks = await api.getAdminTasks(startStr, endStr);
        } catch (e) {
            console.warn("Could not fetch tasks:", e);
        }

        const tasksByUserDate = {};

        // --- Ghost Users Logic ---
        // Anciens collaborateurs avec des tâches archivées mais plus dans la DB.
        // On ne les affiche qu'en mode "Tout" : leur secteur est inconnu, ils ne
        // doivent pas polluer le planning d'un secteur spécifique.
        const currentIds = new Set(users.map(u => u.id));
        if (planningAdminSecteur === 'Tout') {
            tasks.forEach(t => {
                if (t.user_id && !currentIds.has(t.user_id)) {
                    users.push({
                        id: t.user_id,
                        first_name: t.user_name || "Ancien",
                        last_name: t.user_name ? "" : "Collaborateur",
                        is_ghost: true
                    });
                    currentIds.add(t.user_id);
                }
            });
        }

        users.forEach(u => tasksByUserDate[u.id] = {});
        tasks.forEach(t => {
            if (!tasksByUserDate[t.user_id]) tasksByUserDate[t.user_id] = {};
            if (!tasksByUserDate[t.user_id][t.date]) tasksByUserDate[t.user_id][t.date] = [];
            tasksByUserDate[t.user_id][t.date].push(t);
        });

        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            let d = new Date(currentMonday);
            d.setDate(currentMonday.getDate() + i);
            weekDays.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        }

        const formatShortDate = (dStr) => {
            const d = new Date(dStr + 'T12:00:00');
            const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
        };

        const displayStart = new Date(startStr + 'T12:00:00').toLocaleDateString('fr-FR');
        const displayEnd = new Date(endStr + 'T12:00:00').toLocaleDateString('fr-FR');

        if (!document.getElementById('planning-styles')) {
            const style = document.createElement('style');
            style.id = 'planning-styles';
            style.innerHTML = `
                .planning-inline { 
                    background: ${window.currentUserProfile?.preferences?.planning_bg || '#1C1C1E'} !important;
                    color: ${window.currentUserProfile?.preferences?.planning_text || '#FFFFFF'} !important;
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                }
                .planning-inline header { background: transparent !important; margin-bottom: 12px !important; padding: 16px 20px !important; border-bottom: none !important; }
                .planning-inline header h1 { color: white !important; }
                .planning-inline header span { color: inherit !important; opacity: 0.9; }
                .planning-inline .p-grid-bg { background: rgba(255,255,255,0.03) !important; border: 1px solid rgba(255,255,255,0.05) !important; border-radius: 8px; }
                .planning-inline .p-head { background: #2a2a2a !important; color: white !important; border-top:none; border-bottom: 1px solid var(--border) !important; }
                .planning-inline .p-user { background: #202020 !important; color: white !important; border-bottom: 1px solid var(--border) !important; }
                .planning-inline .p-cell { border-color: rgba(255,255,255,0.05) !important; border-right: 1px solid rgba(255,255,255,0.05) !important; }
                .planning-inline .p-task { border-left: 3px solid var(--primary) !important; border: 1px solid rgba(255,255,255,0.1) !important; background: rgba(255,255,255,0.05); display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 4px !important; position: relative !important; overflow: hidden !important; cursor: pointer !important; transition: background 0.2s ease; z-index: 1; min-height: 24px; padding: 4px 6px !important; }
                .planning-inline .p-task:hover { background: rgba(255,255,255,0.1) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                .planning-inline .p-task-title { color: inherit !important; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; font-size: 11px; font-weight: 800; }
                .p-task-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; align-items: center; }
                .p-task:hover .p-task-actions { opacity: 1; pointer-events: auto; }
                .planning-inline .p-add-btn { background: rgba(255,255,255,0.05) !important; color: inherit !important; opacity: 0.6; border: 1px dashed rgba(255,255,255,0.2) !important; }
                .planning-inline .p-add-btn:hover { background: rgba(255,255,255,0.1) !important; opacity: 1; }
                
                .p-reorder-btn { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.5); font-size: 9px; line-height: 1; padding: 2px 5px; cursor: pointer; border-radius: 3px; transition: 0.15s; }
                .p-reorder-btn:hover { background: rgba(255,255,255,0.2); color: white; }

                /* ===== FULLSCREEN: TV / Wall Display Mode (LIGHT THEME) ===== */
                .planning-fullscreen { background: #f8f9fa !important; color: #212529 !important; }

                .planning-fullscreen header {
                    background: #ffffff !important;
                    border-bottom: 3px solid #FF3B30 !important;
                    margin-bottom: 0 !important;
                    padding: 20px 50px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
                }
                .planning-fullscreen header h1 { font-size: 28px !important; color: #FF3B30 !important; letter-spacing: 1px; }
                .planning-fullscreen header span { font-size: 22px !important; color: #495057 !important; }
                .planning-fullscreen .p-header-controls { display: none !important; }

                .planning-fullscreen #planning-scroll-area { padding: 0 !important; }
                .planning-fullscreen .p-grid-bg { background: #ffffff !important; border: none !important; border-radius: 0 !important; height: 100% !important; }

                .planning-fullscreen .p-head {
                    background: #f1f3f5 !important;
                    color: #FF3B30 !important;
                    border-color: #dee2e6 !important;
                    font-size: 20px !important;
                    font-weight: 700 !important;
                    padding: 16px 0 !important;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 2px solid #FF3B30 !important;
                }

                .planning-fullscreen .p-user {
                    background: #ffffff !important;
                    color: #212529 !important;
                    border-color: #dee2e6 !important;
                    font-size: 19px !important;
                    font-weight: 800 !important;
                    padding: 16px 24px !important;
                    border-bottom: 1px solid #dee2e6 !important;
                }

                .planning-fullscreen .p-cell {
                    border-color: #f1f3f5 !important;
                    border-right: 1px solid #f1f3f5 !important;
                    border-bottom: 1px solid #dee2e6 !important;
                    padding: 6px 8px !important;
                    background: #ffffff !important;
                }
                
                #planning-scroll-area::-webkit-scrollbar { width: 8px; }
                #planning-scroll-area::-webkit-scrollbar-track { background: #f8f9fa; }
                #planning-scroll-area::-webkit-scrollbar-thumb { background: #FF3B3033; border-radius: 4px; }
                #planning-scroll-area::-webkit-scrollbar-thumb:hover { background: #FF3B3066; }

                .planning-fullscreen .p-task {
                    border-left: 6px solid currentColor !important;
                    background: #fff !important;
                    padding: 8px 12px !important;
                    margin-bottom: 6px !important;
                    border-radius: 8px !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
                    border: 1px solid rgba(0,0,0,0.03) !important;
                    transition: all 0.2s ease;
                    position: relative;
                    z-index: 1;
                    overflow: hidden;
                }
                .planning-fullscreen .p-task:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
                .planning-fullscreen .p-task-title { color: #212529 !important; font-size: 15px !important; font-weight: 700 !important; line-height: 1.3 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .planning-fullscreen .p-task-title, #p-v2-main .p-task-title { 
                    white-space: normal !important; 
                    display: -webkit-box !important; 
                    -webkit-line-clamp: 2 !important; 
                    -webkit-box-orient: vertical !important; 
                    overflow: hidden !important; 
                    text-overflow: ellipsis !important;
                    word-break: break-word !important;
                    line-height: 1.1 !important;
                }
                .planning-fullscreen .p-task-time { font-size: 13px !important; font-weight: 800 !important; margin-bottom: 4px !important; color: #495057 !important; }
                .planning-fullscreen .p-add-btn { display: none !important; }
                .planning-fullscreen .p-task button { display: none !important; }
                .planning-fullscreen .p-reorder-controls { display: none !important; }
                
                /* Reorder buttons (inline mode only) */
                .p-reorder-btn {
                    background: rgba(255,255,255,0.08);
                    border: none;
                    color: rgba(255,255,255,0.5);
                    font-size: 9px;
                    line-height: 1;
                    padding: 2px 5px;
                    cursor: pointer;
                    border-radius: 3px;
                    transition: 0.15s;
                }
                .p-reorder-btn:hover { background: rgba(255,255,255,0.2); color: white; }

                /* ===== FULLSCREEN TV: Planning (2/3) + Slideshow (1/3) ===== */
                #planning-tv-container {
                    display: none;
                    position: fixed;
                    top: 0; left: 0;
                    width: 100vw; height: 100vh;
                    z-index: 100000;
                    background: #f8f9fa;
                    flex-direction: column;
                    overflow: hidden;
                }
                #planning-tv-container.active { display: flex; }
                #p-tv-main { flex: 2; display: flex; flex-direction: column; overflow: hidden; border-right: 2px solid #ddd; background: #fff; }
                #p-tv-side { flex: 1; min-width: 33vw; background: #000; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
                #p-tv-slideshow { width: 100%; height: 100%; object-fit: contain; transition: opacity 0.5s ease-in-out; background: #000; }
                #p-tv-pdfviewer { width: 100%; height: 100%; border: none; display: none; }
                
                .tv-exit-btn {
                    position: absolute;
                    top: 20px; right: 20px;
                    z-index: 100001;
                    background: rgba(0,0,0,0.5);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px; height: 40px;
                    font-size: 20px;
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(4px);
                }
                .tv-exit-btn:hover { background: rgba(255,0,0,0.7); }
                
                /* Classic Fullscreen: Hide footer */
                .planning-fullscreen #planning-footer-config { display: none !important; }

                /* TV Ticker & Badge Animations */
                @keyframes ticker {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-100%, 0, 0); }
                }
                @keyframes flashRed {
                    0%, 100% { background-color: #FF3B30; box-shadow: 0 0 8px rgba(255,59,48,0.5); }
                    50% { background-color: #FF453A; box-shadow: 0 0 15px rgba(255,69,58,0.8); }
                }
            `;
            document.head.appendChild(style);
        }

        const userCount = users.length || 1;

        // Sort users by saved order
        const savedOrder = JSON.parse(localStorage.getItem('planning_user_order') || '[]');
        if (savedOrder.length > 0) {
            users.sort((a, b) => {
                const ia = savedOrder.indexOf(a.id);
                const ib = savedOrder.indexOf(b.id);
                // Users not in savedOrder go to the end
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });
        }
        // Save current order (including any new users)
        localStorage.setItem('planning_user_order', JSON.stringify(users.map(u => u.id)));

        let headerHTML = "";
        if (isCurrentlyFullscreen) {
            headerHTML = `
                <header style="display: flex; align-items: center; justify-content: space-between; padding: 15px 40px; background: #ffffff; border-bottom: 3px solid #FF3B30; box-shadow: 0 4px 20px rgba(0,0,0,0.05); height: 70px; box-sizing: border-box;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="logo-pouchain.svg" alt="Pouchain" style="height: 35px; width: auto;">
                        <span style="font-size: 20px; font-weight: 800; color: #212529; border-left: 2px solid #dee2e6; padding-left: 15px; letter-spacing: -0.5px;">Planning Hebdomadaire</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <button onclick="changePlanningWeek('${startStr}', -7)" style="height: 36px; width: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e9ecef; color: #495057; border: none; font-size: 14px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#dee2e6'" onmouseout="this.style.background='#e9ecef'">◀</button>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-weight: 700; font-size: 16px; color: #495057;">Du ${displayStart} au ${displayEnd}</div>
                            <div style="font-weight: 800; font-size: 16px; color: #FF3B30; background: rgba(255,59,48,0.08); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,59,48,0.15);">Semaine ${window.getISOWeekNumber(startStr)}</div>
                        </div>
                        <button onclick="changePlanningWeek('${startStr}', 7)" style="height: 36px; width: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e9ecef; color: #495057; border: none; font-size: 14px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#dee2e6'" onmouseout="this.style.background='#e9ecef'">▶</button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div id="fullscreen-date" style="font-size: 16px; font-weight: 700; color: #495057; text-transform: capitalize;">
                            ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div id="fullscreen-clock" class="fullscreen-clock" style="font-size: 20px; font-weight: 800; color: #FF3B30; background: rgba(255, 59, 48, 0.08); border: 1px solid rgba(255, 59, 48, 0.15); padding: 6px 18px; border-radius: 20px; font-family: monospace; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; height: 36px; box-sizing: border-box;">
                            ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>
                </header>
            `;
        } else {
            headerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: rgba(0,0,0,0.4); padding: 20px 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #007AFF, #00C7BE); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0, 122, 255, 0.2);">
                        <span style="font-size: 28px;">📅</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Planning Hebdomadaire</h1>
                        <div style="margin: 4px 0 0 0; font-size: 14px; color: white; font-weight: 600;">
                            Du ${displayStart} au ${displayEnd}
                        </div>
                    </div>
                </div>

                <div style="margin-left: auto; margin-right: 30px; display: flex; align-items: center;">
                    <div style="font-weight: 900; font-size: 52px; color: #5AC8FA; letter-spacing: -2px; line-height: 1; position: relative; text-shadow: 0 0 20px rgba(90, 200, 250, 0.3);">
                        S${window.getISOWeekNumber(startStr)}
                        <div style="position: absolute; bottom: -8px; right: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #5AC8FA; font-weight: 800; opacity: 0.6;">Semaine</div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="display:flex; gap: 8px; align-items:center; background: rgba(255,255,255,0.05); padding: 5px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                        <button class="btn-sm btn-secondary p-header-controls" onclick="changePlanningWeek('${startStr}', -7)" style="background: none; border: none; color: white; padding: 8px 12px; cursor: pointer; border-radius: 8px;">◀</button>
                        <button class="btn-sm btn-secondary p-header-controls" onclick="changePlanningWeek('${startStr}', 7)" style="background: none; border: none; color: white; padding: 8px 12px; cursor: pointer; border-radius: 8px;">▶</button>
                    </div>
                    
                    <div class="p-header-controls" style="display:flex; gap: 10px;">
                        <button class="btn-secondary" onclick="openPlanningExportModal()" style="border-radius: 12px; height: 44px; padding: 0 15px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; font-size: 13px; font-weight: 600; cursor: pointer;">📤 Export</button>
                        <button class="btn-secondary" onclick="togglePlanningFullscreen()" id="fullscreen-btn" style="border-radius: 12px; height: 44px; padding: 0 15px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; font-size: 13px; font-weight: 600; cursor: pointer;">⛶ TV</button>
                        <button class="btn-primary" onclick="openNewTaskModal('${startStr}')" style="border-radius: 12px; height: 44px; padding: 0 20px; background: #007AFF; font-weight: 700; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">+</span> Tâche
                        </button>
                    </div>
                </div>
            </div>
            `;
        }

        // Ensure we define startStr globally for toggleRefresh
        window.currentPlanningMonday = startStr;

        let gridHTML = `
                <div id="planning-scroll-area" style="flex: 1; overflow-y: auto; overflow-x: auto; padding: ${isCurrentlyFullscreen ? '0 40px 20px 40px' : '0 20px 20px 20px'};">
                    <div class="p-grid-bg" style="display: grid; grid-template-columns: 200px repeat(7, minmax(130px, 1fr)); grid-template-rows: auto repeat(${userCount}, minmax(min-content, 1fr));">
                        <div class="p-head" style="padding: 10px; font-weight:bold; position: sticky; top: 0; left: 0; z-index: 11; border-right: 1px solid; border-bottom: 1px solid; background: inherit;">
                            Collaborateur
                        </div>
                        ${weekDays.map(d => {
            let style = 'background: inherit;';
            if (window.isClosedDay(d)) {
                style = 'background-color: #ff3b30 !important; color: #fff !important; border-bottom: 3px solid #fff !important; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.1);';
            } else if (d === new Date().toISOString().split('T')[0]) {
                style = 'background-color: #FF3B30 !important; color: #fff !important; border-bottom: 3px solid #fff !important; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.1);';
            } else if (window.isJoursFerieFrance(d)) {
                style = 'background: repeating-linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px) !important; color: inherit;';
            }
            return `<div class="p-head" style="padding: 10px; font-weight:bold; text-align:center; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid; border-right: 1px solid; ${style}">${formatShortDate(d)}</div>`;
        }).join('')}
        `;

        let rowsHTML = '';
        users.forEach((u, idx) => {
            const userName = (u.first_name || '') + ' ' + (u.last_name || '');
            const displayedName = userName.trim() || u.email;
            const safeName = window.escapeHTML(displayedName);
            const userColor = u.color ? u.color : '#FF3B30';

            const upBtn = idx > 0 ? `<button class="p-reorder-btn" onclick="reorderPlanningUser(${idx}, ${idx - 1}, '${startStr}')" title="Monter">▲</button>` : '';
            const downBtn = idx < users.length - 1 ? `<button class="p-reorder-btn" onclick="reorderPlanningUser(${idx}, ${idx + 1}, '${startStr}')" title="Descendre">▼</button>` : '';

            rowsHTML += '<div class="p-user" style="padding: 8px 12px; font-weight:600; font-size: 13px; display: flex; align-items: center; gap: 6px; border-right: 1px solid; border-bottom: 1px solid; position: sticky; left: 0; z-index: 9; border-left: 4px solid ' + userColor + ' !important; background-color: #202020; background-image: linear-gradient(90deg, ' + userColor + '20, #202020);">';
            rowsHTML += '<span style="flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + safeName + '">' + safeName + '</span>';
            rowsHTML += '<span class="p-reorder-controls" style="display:flex; flex-direction:column; gap:1px; margin-left: auto;">' + upBtn + downBtn + '</span>';
            rowsHTML += '</div>';

            weekDays.forEach(d => {
                let cellStyle = '';
                if (window.isClosedDay(d)) {
                    cellStyle = 'background: rgba(255, 59, 48, 0.15) !important;';
                } else if (d === new Date().toISOString().split('T')[0]) {
                    cellStyle = 'background: rgba(255, 59, 48, 0.15) !important;';
                } else if (window.isJoursFerieFrance(d)) {
                    cellStyle = 'background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(120,120,120,0.1) 10px, rgba(120,120,120,0.1) 20px) !important;';
                }
                const rawTasks = (tasksByUserDate[u.id] && tasksByUserDate[u.id][d]) ? tasksByUserDate[u.id][d] : [];
                // Tri automatique: 1. Non faites en haut, 2. Toute la journée en haut, 3. Chronologique
                const dayTasks = [...rawTasks].sort((a, b) => {
                    const doneA = a.done === 'true' ? 1 : 0;
                    const doneB = b.done === 'true' ? 1 : 0;
                    if (doneA !== doneB) return doneA - doneB;

                    const isAllDayA = (a.start_time.indexOf('00:00') === 0 && a.end_time.indexOf('00:00') === 0);
                    const isAllDayB = (b.start_time.indexOf('00:00') === 0 && b.end_time.indexOf('00:00') === 0);
                    if (isAllDayA !== isAllDayB) return isAllDayA ? -1 : 1;

                    return a.start_time.localeCompare(b.start_time);
                });

                rowsHTML += `<div class="p-cell" style="padding: 4px; border-bottom: 1px solid; min-height: 50px; display: flex; flex-direction: column; gap: 4px; position:relative; ${cellStyle}">`;

                dayTasks.forEach(t => {
                    const parsedTitle = t.title.split(':::DESC:::')[0];
                    const taskDesc = t.title.includes(':::DESC:::') ? t.title.split(':::DESC:::')[1] : '';
                    const isAllDay = (t.start_time.indexOf('00:00') === 0 && t.end_time.indexOf('00:00') === 0);
                    const isDone = t.done === 'true' || t.done === true;

                    // Store task data for click handler
                    const taskDataEscaped = JSON.stringify(t).replace(/"/g, '&quot;');

                    let timeHtml = '';
                    if (!isAllDay) {
                        timeHtml = `<div class="p-task-time" style="font-size: 10px; font-weight:bold; margin-bottom: 2px;">${t.start_time.substring(0, 5)} - ${t.end_time.substring(0, 5)}</div>`;
                    }
                    rowsHTML += `
                        <div class="p-task" data-task-id="${t.id}" data-task-done="${isDone}" onclick="window.openEditTaskModal(${taskDataEscaped}, '${startStr}', event)" style="background: ${userColor}30 !important; padding: 4px 6px; border-radius: 4px; border-left: 4px solid ${userColor} !important; ${isDone ? 'opacity: 0.4; filter: grayscale(0.8);' : ''}">
                            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                                ${timeHtml}
                                <div class="p-task-title" style="font-size: 11px; font-weight: 800; line-height: 1.2; ${isDone ? 'text-decoration: line-through;' : ''}" title="${window.escapeHTML(parsedTitle)}">${window.escapeHTML(parsedTitle)}</div>
                            </div>
                            <div class="p-task-actions">
                                <button class="btn-sm" style="background: transparent; border:none; color: ${isDone ? '#34C759' : '#fff'}; padding: 2px; font-size: 14px; cursor: pointer; line-height:1;" onclick="event.stopPropagation(); window.toggleAdminTaskStatus('${t.id}', ${isDone}, '${startStr}', event)" title="${isDone ? 'Marquer comme en cours' : 'Valider la tâche'}">${isDone ? '✅' : '✔️'}</button>
                                <button class="btn-sm" style="background: transparent; border:none; color: #ff6b6b; padding: 2px; font-size: 14px; cursor: pointer; line-height:1;" onclick="event.stopPropagation(); window.deleteAdminTask('${t.id}', '${startStr}')" title="Supprimer">×</button>
                            </div>
                        </div>
                    `;
                });

                rowsHTML += `<button class="p-add-btn" style="margin-top:auto; border-radius: 4px; cursor: pointer; padding: 2px; font-size: 11px; width: 100%; transition: 0.2s;" onclick="openNewTaskModal('${d}', '${u.id}', '${startStr}')">+ Ajouter</button>`;
                rowsHTML += `</div>`;
            });
        });

        rowsHTML += `
                    </div>
                </div>
        `;

        const finalContent = headerHTML + gridHTML + rowsHTML;

        // --- Fullscreen TV (Planning 2/3 + Slideshow 1/3) injection point ---
        const tvContainer = document.getElementById('planning-tv-container');
        if (tvContainer && tvContainer.classList.contains('active')) {
            const tvMain = document.getElementById('p-tv-main');
            if (tvMain) {
                tvMain.innerHTML = `
                    <div id="planning-fullscreen-container" class="planning-fullscreen" data-monday="${startStr}" style="height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden;">
                        ${finalContent}
                    </div>
                `;
                window.initFullscreenClock();
                window.planningRefreshInProgress = false;
                return;
            }
        }

        // --- Integrated Slideshow Configuration Section (Bottom of Planning) ---
        fsConfig = window.currentSlideshowConfig || { timer: 40, files: [] };

        const slideshowConfigHTML = `
            <div id="integrated-fs-config" style="display: flex; align-items: center; gap: 40px; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">📺 Slideshow</h2>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="btn-sm btn-secondary" onclick="window.openFSDocsManagerModal()" style="background: rgba(255,255,255,0.05); font-size: 11px; padding: 6px 14px; border-radius: 8px; color: #fff; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;">Voir les documents</button>
                        <button class="btn-sm btn-primary" onclick="document.getElementById('fs-upload-input').click()" style="font-size: 11px; padding: 6px 14px; border-radius: 8px; cursor: pointer;">Upload</button>
                        <input type="file" id="fs-upload-input" style="display:none;" multiple accept="image/*,application/pdf" onchange="handleFSDirectUpload(this)">
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.02); padding: 10px 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <label style="font-weight: 700; color: var(--primary); font-size: 11px; text-transform: uppercase;">⏱️ Temporisation</label>
                    <input type="number" id="fs-timer" class="form-input" value="${fsConfig.timer || 40}" min="3" style="width: 60px; text-align: center; height: 30px; font-size: 13px;" onchange="saveFSConfig(true)">
                    <button class="btn-primary" onclick="saveFSConfig()" style="height: 30px; font-size: 11px; padding: 0 15px;">💾</button>
                </div>

                <div id="fs-files-mini-grid" style="flex: 1; display: flex; align-items: center; gap: 10px; color: #aaa; font-size: 13px;">
                    <span style="font-size: 18px;">📁</span>
                    <span><strong>${(fsConfig.files || []).length}</strong> document(s) configuré(s) pour le diaporama</span>
                </div>


                <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start; margin-left: auto; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px;">
                    <label style="font-weight: 800; color: #ff3b30; font-size: 12px; text-transform: uppercase;">🔒 Jours Fermés (Général)</label>
                    <div style="display: flex; flex-direction: column; gap: 4px; max-height: 80px; overflow-y: auto; width: 100%; padding-right: 5px; scrollbar-width: thin;" id="closed-days-list">
                        ${(window.currentClosedDays || []).map((interval, i) => {
            const start = interval.start || interval;
            const end = interval.end || interval;
            return `
                            <div style="display:flex; align-items:center; gap: 8px;">
                                <input type="date" class="form-input" style="height: 24px; font-size: 11px; padding: 0 4px;" value="${start}" onchange="window.updateClosedDay(${i}, 'start', this.value)">
                                <span style="color:#fff; font-size:10px;">au</span>
                                <input type="date" class="form-input" style="height: 24px; font-size: 11px; padding: 0 4px;" value="${end}" onchange="window.updateClosedDay(${i}, 'end', this.value)">
                                <button onclick="window.removeClosedDay(${i})" style="background: rgba(255, 59, 48, 0.2); border: 1px solid rgba(255,59,48,0.5); color: #fff; padding: 2px 6px; border-radius: 4px; cursor:pointer; font-size:10px; flex-shrink:0;">✕</button>
                            </div>`;
        }).join('')}
                    </div>
                    ${(window.currentClosedDays || []).length === 0 ? `<span style="color: #666; font-size: 10px; font-style: italic;">Aucun intervalle configuré</span>` : ''}
                    <button class="btn-sm btn-primary" style="font-size: 10px; padding: 4px 10px; margin-top: 2px;" onclick="window.addClosedDay()">+ Ajouter Intervalle</button>
                </div>
            </div>
        `;

        if (existingContainer) {
            existingContainer.setAttribute('data-monday', startStr);
            const mainArea = document.getElementById('planning-main-desktop');
            const footerArea = document.getElementById('planning-footer-config');
            if (mainArea) {
                mainArea.innerHTML = finalContent;
                if (footerArea) {
                    footerArea.innerHTML = `
                             <div style="width: 100%; max-width: 1400px; margin: 0 auto;">
                                 ${slideshowConfigHTML}
                             </div>
                    `;
                }
            } else {
                // Fallback for V2 or if structure changed
                existingContainer.innerHTML = `
                    <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
                        <div id="planning-main-desktop" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                            ${finalContent}
                        </div>
                        <div id="planning-footer-config" style="height: 15vh; min-height: 120px; border-top: 2px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.3); padding: 5px 30px; overflow: hidden; display: flex; align-items: center; flex-shrink: 0;">
                            <div style="width: 100%; max-width: 1400px; margin: 0 auto;">
                                ${slideshowConfigHTML}
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            const containerClass = isCurrentlyFullscreen ? 'planning-fullscreen' : 'planning-inline';
            const containerStyle = isCurrentlyFullscreen
                ? 'height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 0; background: #f8f9fa;'
                : 'height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 30px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;';

            content.innerHTML = `
                <div id="integrated-planning-container" class="${containerClass}" data-monday="${startStr}" style="${containerStyle}">
                    <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
                        <div id="planning-main-desktop" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                            ${finalContent}
                        </div>
                        <div id="planning-footer-config" style="height: 15vh; min-height: 120px; border-top: 2px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.3); padding: 5px 30px; overflow: hidden; display: flex; align-items: center; flex-shrink: 0; margin: 0 -30px -30px -30px; ${isCurrentlyFullscreen ? 'display: none !important;' : ''}">
                            <div style="width: 100%; max-width: 1400px; margin: 0 auto;">
                                ${slideshowConfigHTML}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        window.planningRefreshInProgress = false;
    } catch (e) {
        window.planningRefreshInProgress = false;
        console.error("Planning Error:", e);
        if (content) content.innerHTML = `<div style="color:var(--danger); padding:20px;">Erreur lors du chargement du planning : ${e.message}</div>`;
    }
};

window.openPlanningExportModal = async function () {
    try {
        const allUsers = await api.listUsers();
        const exportSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = exportSecteur === 'Tout' ? allUsers : allUsers.filter(u => u.secteur === exportSecteur);
        users.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '100008';

        const today = new Date().toISOString().split('T')[0];

        modal.innerHTML = `
            <div class="modal-box glass-panel" style="width: 550px; padding: 40px; animation: modalPop 0.3s ease-out;">
                <h2 style="margin-top: 0; margin-bottom: 24px; font-weight: 800; color: white; display: flex; align-items: center; gap: 12px;">
                    <span>📤 Exporter les données</span>
                </h2>
                <p style="color: #aaa; font-size: 14px; margin-bottom: 32px;">Sélectionnez la période et les collaborateurs pour générer un fichier CSV.</p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px;">
                    <div>
                        <label style="display: block; font-size: 13px; color: #888; margin-bottom: 8px;">Date de début</label>
                        <input type="date" id="export-start-date" class="form-input" style="width: 100%;" value="${today}">
                    </div>
                    <div>
                        <label style="display: block; font-size: 13px; color: #888; margin-bottom: 8px;">Date de fin</label>
                        <input type="date" id="export-end-date" class="form-input" style="width: 100%;" value="${today}">
                    </div>
                </div>

                <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 13px; color: #888;">Collaborateurs</label>
                    <button id="toggle-all-btn" class="btn-sm" style="background: transparent; color: var(--primary); border: none; font-size: 12px; cursor: pointer;" onclick="toggleAllExportUsers()">Tout déselectionner</button>
                </div>

                <div style="max-height: 250px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 16px; padding: 8px; margin-bottom: 32px; border: 1px solid rgba(255,255,255,0.05);">
                    ${users.map(u => `
                        <label style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; border-radius: 10px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <input type="checkbox" class="export-user-cb" value="${u.id}" checked style="width: 18px; height: 18px; accent-color: var(--primary);">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 600; font-size: 14px; color: #eee;">${u.first_name || ''} ${u.last_name || ''}</span>
                                <span style="font-size: 11px; color: #666;">${u.email}</span>
                            </div>
                        </label>
                    `).join('')}
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                    <button id="start-export-btn" class="btn-primary" style="padding: 10px 24px;">Générer le CSV</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        window.toggleAllExportUsers = () => {
            const cbs = document.querySelectorAll('.export-user-cb');
            const btn = document.getElementById('toggle-all-btn');
            const anyChecked = Array.from(cbs).some(cb => cb.checked);

            cbs.forEach(cb => cb.checked = !anyChecked);
            btn.innerText = !anyChecked ? "Tout déselectionner" : "Tout sélectionner";
        };

        document.getElementById('start-export-btn').onclick = async () => {
            const start = document.getElementById('export-start-date').value;
            const end = document.getElementById('export-end-date').value;
            const selectedUserIds = Array.from(document.querySelectorAll('.export-user-cb:checked')).map(cb => cb.value);

            if (!start || !end) return alert("Veuillez choisir une période.");
            if (selectedUserIds.length === 0) return alert("Veuillez sélectionner au moins un collaborateur.");

            const btn = document.getElementById('start-export-btn');
            btn.disabled = true;
            btn.innerText = "Chargement...";

            try {
                const tasks = await api.getAdminTasks(start, end);
                const filteredTasks = tasks.filter(t => selectedUserIds.includes(t.user_id));

                // Create CSV
                const headers = ["Date", "Employé", "Début", "Fin", "Tâche", "Statut"];
                const userMap = {};
                users.forEach(u => userMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email);

                const rows = filteredTasks.map(t => [
                    t.date,
                    userMap[t.user_id] || "Inconnu",
                    t.start_time.substring(0, 5),
                    t.end_time.substring(0, 5),
                    t.title.replace(/:::DESC:::.*$/, '').replace(/"/g, '""'),
                    t.done === 'true' ? "Terminé" : "En cours"
                ]);

                let csvContent = "\ufeff" + headers.join(";") + "\n";
                rows.forEach(r => {
                    csvContent += r.map(cell => `"${cell}"`).join(";") + "\n";
                });

                // Download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `Export_Planning_${start}_au_${end}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                modal.remove();
            } catch (e) {
                alert("Erreur lors de l'export: " + e.message);
                btn.disabled = false;
                btn.innerText = "Générer le CSV";
            }
        };

    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.reorderPlanningUser = function (fromIndex, toIndex, weekStartStr) {
    const order = JSON.parse(localStorage.getItem('planning_user_order') || '[]');
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= order.length || toIndex >= order.length) return;
    // Swap
    const tmp = order[fromIndex];
    order[fromIndex] = order[toIndex];
    order[toIndex] = tmp;
    localStorage.setItem('planning_user_order', JSON.stringify(order));
    renderAdminPlanning(weekStartStr);
};

window.autoSortPlanningUsers = async function (weekStartStr, isV2 = false, isSilent = false) {
    try {
        const allUsers = await api.listUsers();
        const sortSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = sortSecteur === 'Tout' ? allUsers : allUsers.filter(u => u.secteur === sortSecteur);
        // Compute week range
        const monday = new Date(weekStartStr + 'T12:00:00');
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const pad = (n) => String(n).padStart(2, '0');
        const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
        const endStr = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;

        let tasks = [];
        try { tasks = await api.getAdminTasks(startStr, endStr); } catch (e) { }

        // Count tasks per user
        const userTasks = {};
        users.forEach(u => {
            userTasks[u.id] = [];
        });
        tasks.forEach(t => {
            if (!userTasks[t.user_id]) userTasks[t.user_id] = [];
            userTasks[t.user_id].push(t);
        });

        // Helper to check if user has AT LEAST ONE task of type AT, AM, CP or RECUP
        const hasInactifTask = (uid) => {
            const uT = userTasks[uid] || [];
            return uT.some(t => {
                const title = (t.title || "").toUpperCase().split(':::DESC:::')[0].trim();
                return ["AT", "AM", "CP", "RECUP"].some(code =>
                    title === code || title.startsWith(code + " ") || title.startsWith(code + "-") || title.startsWith(code + " -")
                );
            });
        };

        // Sort strategy scores
        // Score 0: Has ONLY active tasks
        // Score 1: Zero tasks
        // Score 2: Has AT LEAST ONE inactive task (AM/CP/AT...)
        users.sort((a, b) => {
            const aT = userTasks[a.id] || [];
            const bT = userTasks[b.id] || [];

            const aInactif = hasInactifTask(a.id);
            const bInactif = hasInactifTask(b.id);

            let aScore = 0;
            if (aInactif) aScore = 2; // Inactif takes priority for the bottom
            else if (aT.length === 0) aScore = 1;

            let bScore = 0;
            if (bInactif) bScore = 2;
            else if (bT.length === 0) bScore = 1;

            if (aScore !== bScore) return aScore - bScore;

            // If same score, sort by count DESC
            return bT.length - aT.length;
        });

        localStorage.setItem('planning_user_order', JSON.stringify(users.map(u => u.id)));
        renderAdminPlanning(weekStartStr, isV2);
    } catch (e) {
        console.error("Erreur tri automatique:", e);
        if (!isSilent) alert("Erreur tri automatique: " + e.message);
    }
};

window.changePlanningWeek = function (currentMondayStr, offsetDays) {
    // Parse as local date (add T12:00 to avoid UTC midnight issues)
    const d = new Date(currentMondayStr + 'T12:00:00');
    d.setDate(d.getDate() + offsetDays);
    // Force recalculate to Monday of that week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    renderAdminPlanning(`${yyyy}-${mm}-${dd}`);
};

window.startTVFooter = function () {
    if (window.tvWeatherInterval) clearInterval(window.tvWeatherInterval);
    if (window.tvTickerInterval) clearInterval(window.tvTickerInterval);

    const updateWeather = async () => {
        const weatherEl = document.getElementById('p-tv-weather');
        if (!weatherEl) return;

        let city = "Cuers";
        let lat = 43.2375;
        let lon = 6.0717;

        try {
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
            if (weatherRes.ok) {
                const weatherData = await weatherRes.json();
                const temp = Math.round(weatherData.current.temperature_2m);
                const code = weatherData.current.weather_code;

                let emoji = "☀️";
                let desc = "Ensoleillé";
                if (code === 0) { emoji = "☀️"; desc = "Ensoleillé"; }
                else if (code >= 1 && code <= 3) { emoji = "🌤️"; desc = "Éclaircies"; }
                else if (code === 45 || code === 48) { emoji = "🌫️"; desc = "Brouillard"; }
                else if (code >= 51 && code <= 55) { emoji = "🌧️"; desc = "Bruine"; }
                else if (code >= 61 && code <= 65) { emoji = "🌧️"; desc = "Pluie"; }
                else if (code >= 71 && code <= 75) { emoji = "🌨️"; desc = "Neige"; }
                else if (code >= 80 && code <= 82) { emoji = "🌦️"; desc = "Averses"; }
                else if (code >= 95) { emoji = "⛈️"; desc = "Orageux"; }

                weatherEl.innerHTML = `<span style="color:#FFCC00; font-size:18px; display:inline-block; vertical-align:middle; margin-right:4px;">${emoji}</span> <span style="color:#FFFFFF; text-transform: capitalize; margin-right:6px;">${city}</span> <span style="color:#0A84FF; font-size:15px; font-weight:700;">${temp}°C</span>`;
            } else {
                weatherEl.innerText = "Météo indisponible";
            }
        } catch (e) {
            console.error("Failed to fetch weather:", e);
            weatherEl.innerText = "Erreur météo";
        }
    };

    const updateTicker = async () => {
        const ticker = document.getElementById('p-tv-ticker');
        if (!ticker) return;

        const fallbackNews = [
            "⚠️ Sécurité : Le port des EPI (casque, gants, chaussures de sécurité) est obligatoire sur tous nos chantiers. Soyez vigilants.",
            "🌱 Environnement : Pensez au tri sélectif de vos déchets de chantier. Préservons nos ressources !",
            "🚗 Éco-conduite : Réduisons notre consommation en adoptant une conduite souple. Chaque geste compte pour la planète !",
            "📞 Assistance : Un problème sur un équipement ? Contactez immédiatement le support technique au numéro habituel.",
            "📋 Qualité : Respectez scrupuleusement les procédures de contrôle avant chaque mise en service.",
            "🤝 Cohésion : Merci à toutes les équipes pour leur implication sur les chantiers cette semaine !",
            "💡 Suggestion : Une idée pour améliorer la sécurité ou la productivité ? Partagez-la avec votre responsable d'équipe.",
            "⚙️ Maintenance : Pensez à vérifier l'état de votre matériel avant le départ sur site.",
            "📅 Information : Le planning de la semaine prochaine est en cours de finalisation, consultez vos notifications."
        ];

        let selectedNews = [];
        try {
            const response = await fetch(`${config.api.workerUrl}/planning/news`);
            if (response.ok) {
                selectedNews = await response.json();
            }
        } catch (e) {
            console.warn("Could not fetch planning news from worker, falling back to corporate messages:", e);
        }

        if (selectedNews.length === 0) {
            const shuffled = [...fallbackNews].sort(() => 0.5 - Math.random());
            selectedNews = shuffled.slice(0, 4);
        }

        const selected = selectedNews.join("   •   ");
        ticker.innerText = selected;
        const duration = Math.max(20, Math.round(selected.length / 12));
        ticker.style.animationDuration = `${duration}s`;
    };

    updateWeather();
    updateTicker();

    window.tvWeatherInterval = setInterval(updateWeather, 15 * 60 * 1000);
    window.tvTickerInterval = setInterval(updateTicker, 3 * 60 * 1000);
};

window.stopTVFooter = function () {
    if (window.tvWeatherInterval) {
        clearInterval(window.tvWeatherInterval);
        window.tvWeatherInterval = null;
    }
    if (window.tvTickerInterval) {
        clearInterval(window.tvTickerInterval);
        window.tvTickerInterval = null;
    }
};

window.togglePlanningFullscreen = function () {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('fullscreen')) {
        window.open('dashboard.html?fullscreen=1', '_blank', 'noopener,noreferrer');
        return;
    }

    let tv = document.getElementById('planning-tv-container');

    // If opening
    if (!tv) {
        tv = document.createElement('div');
        tv.id = 'planning-tv-container';
        tv.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:999999; background:#fff; display:flex; flex-direction:column; overflow:hidden;";
        tv.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:row; height:calc(100% - 50px); overflow:hidden; width:100%;">
                <div id="p-tv-main" style="flex:2; height:100%; overflow:hidden; border-right:2px solid #ddd; display:flex; flex-direction:column; background:#fff;"></div>
                <div id="p-tv-side" style="flex:1; height:100%; min-width:33vw; background:#000; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    <img id="p-tv-slideshow" src="logo-pouchain.svg" style="max-width:100%; max-height:100%; object-fit:contain; transition:opacity 0.6s ease-in-out; background:#000;">
                    <iframe id="p-tv-pdfviewer" style="width:100%; height:100%; border:none; display:none;"></iframe>
                </div>
            </div>
            <div id="p-tv-footer" style="height:50px; background:#1C1C1E; color:#FFFFFF; display:flex; align-items:center; justify-content:space-between; border-top:2px solid #2C2C2E; padding:0 20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow:hidden; box-sizing:border-box; z-index:1000002; width:100%;">
                <div style="display:flex; align-items:center; background:#FF3B30; color:white; font-weight:bold; padding:6px 12px; border-radius:4px; font-size:14px; text-transform:uppercase; letter-spacing:1px; white-space:nowrap; margin-right:15px; animation:flashRed 2s infinite;">
                    ⚡ FLASH INFO
                </div>
                <div style="flex:1; overflow:hidden; white-space:nowrap; display:flex; align-items:center; position:relative;">
                    <div id="p-tv-ticker" style="display:inline-block; padding-left:100%; animation:ticker 25s linear infinite; font-size:15px; font-weight:500; color:#E5E5EA;">
                        Chargement des flash infos en cours...
                    </div>
                </div>
                <div id="p-tv-weather" style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; border-left:1px solid #2C2C2E; padding-left:15px; margin-left:15px; color:#FFFFFF; white-space:nowrap;">
                    Chargement météo...
                </div>
            </div>
        `;
        document.body.appendChild(tv);
        tv.classList.add('active');
        tv.requestFullscreen().catch(e => console.warn("FS failed", e));

        startSlideshow();
        renderAdminPlanning(window.currentPlanningMonday, true); // Render grid into p-tv-main

        // Initialize the fullscreen clock ticking
        window.initFullscreenClock();
        window.startTVFooter();
    } else {
        // Closing
        tv.classList.remove('active');
        stopSlideshow();
        window.stopFullscreenClock();
        window.stopTVFooter();
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        setTimeout(() => {
            if (tv && tv.parentNode) tv.parentNode.removeChild(tv);
            renderAdminPlanning(window.currentPlanningMonday);
        }, 300);
    }
};

function startSlideshow() {
    if (window.slideInterval) clearInterval(window.slideInterval);

    const fsConfig = window.currentSlideshowConfig || { timer: 40, files: [] };
    const img = document.getElementById('p-tv-slideshow');
    const pdf = document.getElementById('p-tv-pdfviewer');
    if (!img && !pdf) return;

    if (!fsConfig.files || fsConfig.files.length === 0) {
        if (img) { img.src = 'logo-pouchain.svg'; img.style.display = 'block'; }
        if (pdf) pdf.style.display = 'none';
        return;
    }

    let currentIndex = 0;

    const showNext = () => {
        const fileKey = fsConfig.files[currentIndex];
        if (!fileKey) {
            currentIndex = 0;
            return;
        }

        let url = `${config.api.workerUrl}/get/${fileKey.replace(/^\/+/, '')}`;
        const isPdf = fileKey.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            url += '#toolbar=0&navpanes=0';
            if (img) img.style.display = 'none';
            if (pdf) {
                pdf.style.display = 'block';
                pdf.src = url;
            }
        } else {
            if (pdf) { pdf.style.display = 'none'; pdf.src = ''; }
            if (img) {
                img.style.display = 'block';
                const nextImg = new Image();
                nextImg.onload = () => {
                    img.src = url;
                    img.style.opacity = '1';
                };
                nextImg.onerror = () => {
                    console.error("Slideshow error on:", url);
                    img.src = 'logo-pouchain.svg';
                };
                nextImg.src = url;
            }
        }
        currentIndex = (currentIndex + 1) % fsConfig.files.length;
    };

    showNext();
    if (fsConfig.files.length > 1) {
        window.slideInterval = setInterval(showNext, Math.max(fsConfig.timer || 40, 3) * 1000);
    }
}

function stopSlideshow() {
    if (window.slideInterval) clearInterval(window.slideInterval);
    window.slideInterval = null;
}

window.handleFSDirectUpload = async function (input) {
    if (!input.files || input.files.length === 0) return;

    const btns = document.querySelectorAll('button[onclick*="fs-upload-input"]');
    const originalTexts = Array.from(btns).map(btn => btn.innerText);
    btns.forEach(btn => {
        btn.disabled = true;
        btn.innerText = "Téléchargement...";
    });

    try {
        const config = window.currentSlideshowConfig || { timer: 40, files: [] };

        for (const file of input.files) {
            const res = await api.uploadFile(file, 'fullscreen_slides/');
            if (res && res.key && !config.files.includes(res.key)) {
                config.files.push(res.key);
            }
        }

        window.currentSlideshowConfig = config;
        localStorage.setItem('planning_fs_config', JSON.stringify(config));
        try {
            await api.setPlanningSlideshowConfig(config);
        } catch (e2) {
            console.error("Could not save config to R2:", e2);
        }
        showSuccessModal(`${input.files.length} fichier(s) ajouté(s) au diaporama.`);

        // If the modal is currently open, refresh its content
        const overlay = document.getElementById('fs-docs-manager-modal');
        if (overlay) {
            window.renderFSDocsManagerModalContent(overlay, config.files || []);
        }

        if (document.getElementById('planning-tv-container')) {
            stopSlideshow();
            startSlideshow();
        }

        renderAdminPlanning(window.currentPlanningMonday);
    } catch (e) {
        alert("Erreur lors du téléchargement : " + e.message);
    } finally {
        btns.forEach((btn, idx) => {
            btn.disabled = false;
            btn.innerText = originalTexts[idx] || "Upload";
        });
        input.value = '';
    }
};

window.openFSDocsManagerModal = function () {
    const config = window.currentSlideshowConfig || { timer: 40, files: [] };
    const files = config.files || [];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '1000001';
    overlay.id = 'fs-docs-manager-modal';
    
    window.renderFSDocsManagerModalContent(overlay, files);
    document.body.appendChild(overlay);
};

window.renderFSDocsManagerModalContent = function (overlay, files) {
    const workerUrl = (config && config.api && config.api.workerUrl) ? config.api.workerUrl : 'https://worker.pouchain.fr';
    overlay.innerHTML = `
        <div class="modal-box glass-panel" style="width: 600px; max-height: 80vh; display: flex; flex-direction: column; padding: 0; border: 1px solid rgba(255,255,255,0.1); background: #1a1a1a;">
            <div class="modal-header" style="padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight:800; font-size:18px; display:flex; justify-content:space-between; align-items:center;">
                <span>📺 Documents du Diaporama</span>
                <span style="font-size: 13px; color: #888; font-weight: normal;">${files.length} document(s)</span>
            </div>
            
            <div style="overflow-y: auto; flex: 1; padding: 20px 30px; display: flex; flex-direction: column; gap: 12px;">
                ${files.map((f, i) => {
                    const isPdf = f.toLowerCase().endsWith('.pdf');
                    const cleanName = f.replace('fullscreen_slides/', '');
                    const url = `${workerUrl}/get/${f}`;
                    return `
                        <div style="display: flex; align-items: center; gap: 15px; padding: 12px 15px; border-radius: 10px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0;">
                                <div style="width: 48px; height: 48px; border-radius: 6px; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
                                    ${isPdf ? `<span style="font-size: 20px;">📕</span>` : `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">`}
                                </div>
                                <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                                    <span style="font-size: 14px; font-weight: 600; color: #eee; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${cleanName}">${cleanName}</span>
                                    <span style="font-size: 11px; color: #666; text-transform: uppercase;">${isPdf ? 'Document PDF' : 'Image'}</span>
                                </div>
                            </div>
                            <button onclick="window.removeFSFileFromModal(${i})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
                                🗑️
                            </button>
                        </div>
                    `;
                }).join('')}
                
                ${files.length === 0 ? `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: #666; text-align: center;">
                        <span style="font-size: 40px; margin-bottom: 15px;">📁</span>
                        <p style="margin: 0; font-size: 14px; font-style: italic;">Aucun document configuré pour le diaporama</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="modal-footer" style="padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.1);">
                <button class="btn-sm btn-primary" onclick="document.getElementById('fs-upload-input').click();" style="padding: 8px 16px; font-size: 12px; cursor: pointer;">
                    📤 Téléverser un document
                </button>
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 8px 16px; font-size: 12px; cursor: pointer;">
                    Fermer
                </button>
            </div>
        </div>
    `;
};

window.removeFSFileFromModal = async function (index) {
    await window.removeFSFile(index);
    const overlay = document.getElementById('fs-docs-manager-modal');
    if (overlay) {
        const updatedConfig = window.currentSlideshowConfig || { timer: 40, files: [] };
        window.renderFSDocsManagerModalContent(overlay, updatedConfig.files || []);
    }
};


window.removeFSFile = async function (index) {
    const config = window.currentSlideshowConfig || { timer: 40, files: [] };
    config.files.splice(index, 1);
    window.currentSlideshowConfig = config;
    localStorage.setItem('planning_fs_config', JSON.stringify(config));
    try {
        await api.setPlanningSlideshowConfig(config);
    } catch (e) {
        console.error("Could not save config to R2:", e);
    }

    if (document.getElementById('planning-tv-container')) {
        stopSlideshow();
        startSlideshow();
    }

    renderAdminPlanning(window.currentPlanningMonday);
};

window.saveFSConfig = async function (silent = false) {
    const timer = parseInt(document.getElementById('fs-timer').value) || 40;
    const config = window.currentSlideshowConfig || { timer: 40, files: [] };
    config.timer = timer;
    window.currentSlideshowConfig = config;
    localStorage.setItem('planning_fs_config', JSON.stringify(config));
    try {
        await api.setPlanningSlideshowConfig(config);
    } catch (e) {
        console.error("Could not save config to R2:", e);
    }

    if (document.getElementById('planning-tv-container')) {
        stopSlideshow();
        startSlideshow();
    }

    if (!silent) showSuccessModal("Configuration enregistrée !");
};

window.deleteAdminTask = async function (taskId, currentWeekStartStr) {
    if (confirm("Voulez-vous vraiment supprimer cette tâche ?")) {
        try {
            await api.deleteAdminTask(taskId);
            const isV2 = !!document.getElementById('planning-v2-container');
            window.autoSortPlanningUsers(currentWeekStartStr, isV2);
        } catch (e) {
            alert("Erreur de suppression: " + e.message);
        }
    }
};

window.toggleAdminTaskStatus = async function (taskId, currentStatusLegacy, currentWeekStartStr, event) {
    // Optimistic UI Update
    const btn = event ? event.target.closest('button') : null;
    const taskEl = event ? event.target.closest('.p-task') : null;

    // Check current state from DOM if available, otherwise use legacy param
    const currentStatus = taskEl ? (taskEl.getAttribute('data-task-done') === 'true') : !!currentStatusLegacy;
    const nextStatus = !currentStatus;

    if (taskEl) {
        taskEl.setAttribute('data-task-done', nextStatus);
        const titleEl = taskEl.querySelector('.p-task-title');
        if (nextStatus) {
            taskEl.style.opacity = '0.4';
            taskEl.style.filter = 'grayscale(0.8)';
            if (titleEl) titleEl.style.textDecoration = 'line-through';
            if (btn) {
                btn.innerHTML = '✅';
                btn.style.color = '#34C759';
                btn.title = 'Marquer comme en cours';
            }
        } else {
            taskEl.style.opacity = '1';
            taskEl.style.filter = 'none';
            if (titleEl) titleEl.style.textDecoration = 'none';
            if (btn) {
                btn.innerHTML = '✔️';
                btn.style.color = '#fff';
                btn.title = 'Valider la tâche';
            }
        }
    }

    try {
        await api.updateTaskAdmin(taskId, nextStatus);

        // Refresh only in fullscreen mode
        const isFS = !!document.fullscreenElement;
        if (isFS) renderAdminPlanning(currentWeekStartStr);
    } catch (e) {
        console.error("Task Update Error:", e);
        alert("Erreur de mise à jour: " + e.message);
        // Rollback on error
        renderAdminPlanning(currentWeekStartStr);
    }
};

window.openNewTaskModal = async function (defaultDateStr, prefillUserId = '', currentWeekStartStr = null) {
    const refWeek = currentWeekStartStr || defaultDateStr;
    try {
        const users = await api.listUsers();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'new-task-modal';
        overlay.innerHTML = `
            <div class="modal-box" style="width: 480px;">
                <div class="modal-header">Nouvelle Tâche</div>
                <form id="new-task-form" onsubmit="event.preventDefault(); submitNewTask('${refWeek}')">
                    <div style="display: flex; gap: 16px;">
                        <div class="form-group" style="flex:1;">
                            <label>Date de début <span id="week-num-display" style="margin-left: 10px; font-weight: 800; color: #FF3B30; font-size: 12px; text-transform: uppercase;">Semaine ${window.getISOWeekNumber(defaultDateStr)}</span></label>
                            <input type="date" class="form-input" id="task-date" required value="${defaultDateStr}" onchange="document.getElementById('task-date-end').value = this.value; document.getElementById('week-num-display').innerText = 'Semaine ' + window.getISOWeekNumber(this.value)">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Date de fin</label>
                            <input type="date" class="form-input" id="task-date-end" required value="${defaultDateStr}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Salarié Assigné</label>
                        <select class="form-input" id="task-user-id" required>
                            <option value="">-- Choisir un salarié --</option>
                            ${users.map(u => `<option value="${u.id}" ${u.id === prefillUserId ? 'selected' : ''}>${window.escapeHTML(u.first_name || '')} ${window.escapeHTML(u.last_name || '')}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Titre de la tâche</label>
                        <input type="text" class="form-input" id="task-title" required placeholder="Ex: Intervention chez M. Dupont" maxlength="38">
                    </div>
                    <div class="form-group">
                        <label>Description détaillée (Optionnelle, visible par le contacté sur mobile)</label>
                        <textarea class="form-input" id="task-desc" rows="2" placeholder="Saisissez des instructions complémentaires..."></textarea>
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                        <input type="checkbox" id="task-has-time" style="width:16px; height:16px;" onchange="document.getElementById('task-time-container').style.display = this.checked ? 'flex' : 'none'">
                        <label for="task-has-time" style="margin:0; font-weight:normal; cursor:pointer;">Définir des horaires précis</label>
                    </div>
                    <div id="task-time-container" style="display: none; gap: 16px; margin-bottom: 16px;">
                        <div class="form-group" style="flex:1; margin-bottom:0;">
                            <label>Heure de début</label>
                            <input type="time" class="form-input" id="task-start" value="09:00">
                        </div>
                        <div class="form-group" style="flex:1; margin-bottom:0;">
                            <label>Heure de fin</label>
                            <input type="time" class="form-input" id="task-end" value="10:00">
                        </div>
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                        <input type="checkbox" id="task-remind-tomorrow" style="width:16px; height:16px;">
                        <label for="task-remind-tomorrow" style="margin:0; font-weight:normal; cursor:pointer;">Rappeler la veille (Notification à 15h30)</label>
                    </div>
                     <div class="modal-actions" style="margin-top: 24px;">
                        <button type="button" class="btn-secondary" onclick="closeModal('new-task-modal')">Annuler</button>
                        <button type="submit" class="btn-primary">Ajouter</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.submitNewTask = async function (refWeekStr) {
    const userId = document.getElementById('task-user-id').value;
    const taskDateStr = document.getElementById('task-date').value;
    const taskDateEndStr = document.getElementById('task-date-end').value;
    const titleMain = document.getElementById('task-title').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    const title = desc ? titleMain + ':::DESC:::' + desc : titleMain;
    const hasTime = document.getElementById('task-has-time').checked;
    const remindTomorrow = document.getElementById('task-remind-tomorrow').checked;

    let startTime = "00:00";
    let endTime = "00:00";

    if (hasTime) {
        startTime = document.getElementById('task-start').value;
        endTime = document.getElementById('task-end').value;
        if (!startTime || !endTime) return alert("Veuillez remplir les horaires.");
    }

    if (!userId || !taskDateStr || !taskDateEndStr || !title) return alert("Veuillez remplir tous les champs.");

    const startDate = new Date(taskDateStr);
    const endDate = new Date(taskDateEndStr);
    if (endDate < startDate) return alert("La date de fin ne peut pas être avant la date de début.");

    const promises = [];
    const current = new Date(startDate);

    // Build array of promises and execute parallelly
    while (current <= endDate) {
        promises.push(api.saveAdminTask({
            user_id: userId,
            title: title,
            date: current.toISOString().split('T')[0],
            start_time: startTime + ":00",
            end_time: endTime + ":00",
            remind_tomorrow: remindTomorrow
        }));
        current.setDate(current.getDate() + 1);
    }

    try {
        await Promise.all(promises);
        closeModal('new-task-modal');
        // Determine if we are in Fullscreen V2 to pass it to the sort
        const isV2 = !!document.getElementById('planning-v2-container');
        window.autoSortPlanningUsers(refWeekStr, isV2);
    } catch (e) {
        alert("Erreur lors de l'ajout: " + e.message);
    }
};


window.openEditTaskModal = async function (task, refWeek, event) {
    if (event) event.stopPropagation();

    // Split title and description
    const parts = task.title.split(':::DESC:::');
    const title = parts[0];
    const desc = parts[1] || '';
    const isAllDay = (task.start_time.indexOf('00:00') === 0 && task.end_time.indexOf('00:00') === 0);

    try {
        const users = await api.listUsers();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'edit-task-modal';
        overlay.innerHTML = `
            <div class="modal-box" style="width: 480px;">
                <div class="modal-header">Modifier la Tâche</div>
                <form id="edit-task-form" onsubmit="event.preventDefault(); submitEditTask('${task.id}', '${refWeek}')">
                    <div class="form-group">
                        <label>Date <span id="edit-week-num-display" style="margin-left: 10px; font-weight: 800; color: #FF3B30; font-size: 12px; text-transform: uppercase;">Semaine ${window.getISOWeekNumber(task.date)}</span></label>
                        <input type="date" class="form-input" id="edit-task-date" required value="${task.date}" onchange="document.getElementById('edit-week-num-display').innerText = 'Semaine ' + window.getISOWeekNumber(this.value)">
                    </div>
                    <div class="form-group">
                        <label>Salarié Assigné</label>
                        <select class="form-input" id="edit-task-user-id" required>
                            ${users.map(u => `<option value="${u.id}" ${u.id === task.user_id ? 'selected' : ''}>${window.escapeHTML(u.first_name || '')} ${window.escapeHTML(u.last_name || '')}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Titre de la tâche</label>
                        <input type="text" class="form-input" id="edit-task-title" required value="${window.escapeHTML(title)}" maxlength="38">
                    </div>
                    <div class="form-group">
                        <label>Description détaillée</label>
                        <textarea class="form-input" id="edit-task-desc" rows="3">${window.escapeHTML(desc)}</textarea>
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                        <input type="checkbox" id="edit-task-has-time" style="width:16px; height:16px;" ${!isAllDay ? 'checked' : ''} onchange="document.getElementById('edit-task-time-container').style.display = this.checked ? 'flex' : 'none'">
                        <label for="edit-task-has-time" style="margin:0; font-weight:normal; cursor:pointer;">Définir des horaires précis</label>
                    </div>
                    <div id="edit-task-time-container" style="display: ${!isAllDay ? 'flex' : 'none'}; gap: 16px; margin-bottom: 20px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:12px; color:#888; margin-bottom:4px;">Heure de début</label>
                            <input type="time" class="form-input" id="edit-task-start" value="${task.start_time.substring(0, 5)}">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:12px; color:#888; margin-bottom:4px;">Heure de fin</label>
                            <input type="time" class="form-input" id="edit-task-end" value="${task.end_time.substring(0, 5)}">
                        </div>
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                        <input type="checkbox" id="edit-task-remind-tomorrow" style="width:16px; height:16px;" ${task.remind_tomorrow === 'true' || task.remind_tomorrow === true ? 'checked' : ''}>
                        <label for="edit-task-remind-tomorrow" style="margin:0; font-weight:normal; cursor:pointer;">Rappeler la veille (Notification à 15h30)</label>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="closeModal('edit-task-modal')">Annuler</button>
                        <button type="submit" class="btn-primary">Enregistrer les modifications</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);

        window.submitEditTask = async (taskId, refWeekStr) => {
            const userId = document.getElementById('edit-task-user-id').value;
            const newTitle = document.getElementById('edit-task-title').value;
            const newDesc = document.getElementById('edit-task-desc').value;
            const newDate = document.getElementById('edit-task-date').value;
            const hasTime = document.getElementById('edit-task-has-time').checked;
            const remindTomorrow = document.getElementById('edit-task-remind-tomorrow').checked;

            let startTime = "00:00:00";
            let endTime = "00:00:00";
            if (hasTime) {
                startTime = document.getElementById('edit-task-start').value + ":00";
                endTime = document.getElementById('edit-task-end').value + ":00";
            }

            const fullTitle = newDesc ? `${newTitle}:::DESC:::${newDesc}` : newTitle;

            try {
                await api.saveAdminTask({
                    id: taskId,
                    user_id: userId,
                    title: fullTitle,
                    date: newDate,
                    start_time: startTime,
                    end_time: endTime,
                    remind_tomorrow: remindTomorrow
                });
                closeModal('edit-task-modal');
                const isV2 = !!document.getElementById('planning-v2-container');
                window.autoSortPlanningUsers(refWeekStr, isV2);
            } catch (e) {
                alert("Erreur lors de la modification: " + e.message);
            }
        };

    } catch (e) {
        alert("Erreur: " + e.message);
    }
};
