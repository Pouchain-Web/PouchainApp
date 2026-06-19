// Injection des styles pour les modales personnalisées
const style = document.createElement('style');
style.textContent = `
    @keyframes modalBounce {
        0% { transform: scale(0.8); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }
    .modal-box {
        animation: modalBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .admin-pointage-row {
        transition: background-color 0.2s ease;
    }
    .admin-pointage-row:hover {
        background: rgba(255, 255, 255, 0.05) !important;
    }
`;
document.head.appendChild(style);

import { auth } from './auth.js';
import { api } from './api.js';
import config from './config.js';

// Module Imports
import './admin/planning.js';
import './admin/users.js';
import './admin/documents.js';
import './admin/pointage.js';
import './admin/overtime.js';
import './admin/conges.js';
import './admin/rtt.js';
import './admin/material.js';
import './admin/vehicles.js';
import './admin/notifications.js';
import './admin/ht_torques.js';
import './admin/prevention.js';
import './admin/about.js';


window.adminCurrentFolder = null;
window.adminFilesCache = [];
window.currentAdminSession = null;
window.PRESET_ACTIVITIES = [
    "Montage AIA 1", "Montage AIA 2", "Maintenance HT", "Travaux Ligne",
    "Logistique", "Atelier", "Bureau", "Déplacement", "Réunion", "Formation",
    "Repos", "Congés Payés", "RTT", "Maladie"
];
window.MEAL_OPTIONS = ["Aucun", "1 Repas", "2 Repas", "3 Repas", "Repas GD", "Ticket Resto", "Panier Chantier"];
window.TRAJET_OPTIONS = ["Aucune", "Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z6+"];
window.HOUR_OPTIONS = Array.from({ length: 22 }, (_, i) => (i + 1) * 0.5);
window.uploadQueue = [];
window.isQueueProcessing = false;
window.isQueueMinimized = false;
window.slideInterval = null;
window.draggedFolder = null;
window.selectedColor = '#007AFF';

// Global ticking clock controller for fullscreen TV mode
window.initFullscreenClock = function () {
    if (window.tvClockInterval) {
        clearInterval(window.tvClockInterval);
    }
    const update = () => {
        const elements = document.querySelectorAll('.fullscreen-clock, #fullscreen-clock');
        elements.forEach(el => {
            el.innerText = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        });
    };
    update();
    window.tvClockInterval = setInterval(update, 1000);
};

window.stopFullscreenClock = function () {
    if (window.tvClockInterval) {
        clearInterval(window.tvClockInterval);
        window.tvClockInterval = null;
    }
};

// Start clock ticking initially in case fullscreen clock is already present
window.initFullscreenClock();

// Utilitaires de sécurité
window.escapeHTML = function (str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Helper to show brief toast notifications
window.showToast = function (message) {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(30, 30, 35, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '50px';
    toast.style.zIndex = '10000001';
    toast.style.backdropFilter = 'blur(10px)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.border = '1px solid rgba(255,255,255,0.1)';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    toast.style.animation = 'modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.getISOWeekNumber = function (dateInput) {
    if (!dateInput) return '';
    let date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        date = new Date(dateInput + 'T12:00:00');
    }
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

window.isJoursFerieFrance = function (dateStr) {
    const d = new Date(dateStr);
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    const md = String(m).padStart(2, '0') + "-" + String(day).padStart(2, '0');
    if (["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"].includes(md)) return true;

    // Pâques
    let a = y % 19, b = Math.floor(y / 100), c = y % 100, d1 = Math.floor(b / 4), e = b % 4;
    let f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d1 - g + 15) % 30;
    let i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    let m1 = Math.floor((a + 11 * h + 22 * l) / 451);
    let n = Math.floor((h + l - 7 * m1 + 114) / 31) - 1, p = ((h + l - 7 * m1 + 114) % 31) + 1;
    let paques = new Date(y, n, p);
    let lPaq = new Date(paques); lPaq.setDate(paques.getDate() + 1);
    let asc = new Date(paques); asc.setDate(paques.getDate() + 39);
    let lPent = new Date(paques); lPent.setDate(paques.getDate() + 50);

    const isSame = (d1, d2) => d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    return isSame(d, lPaq) || isSame(d, asc) || isSame(d, lPent);
};

window.formatOvertimeDuration = function (decimalHours) {
    if (decimalHours === undefined || decimalHours === null) return "0h00";
    const absoluteHours = Math.abs(decimalHours);
    const h = Math.floor(absoluteHours);
    const m = Math.round((absoluteHours - h) * 60);
    const sign = decimalHours >= 0 ? "+" : "-";
    return `${sign} ${h}h${m.toString().padStart(2, '0')}`;
};


async function initDashboard() {
    // Global Styles (Animations)
    if (!document.getElementById('pouchain-global-styles')) {
        const style = document.createElement('style');
        style.id = 'pouchain-global-styles';
        style.innerHTML = `
            @keyframes pulse-red {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7); }
                70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 59, 48, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
            }
            .clignotant { animation: blink 1s infinite; }
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    // 1. Check Auth
    const session = await auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // --- Fullscreen Mode Check (Priority) ---
    const urlParams = new URLSearchParams(window.location.search);
    const fsMode = urlParams.get('fullscreen');

    // 2. Determine View
    const role = await auth.getUserRole();
    const isMobile = window.innerWidth <= 768;

    // Gestion du bouton retour physique Android (Capacitor)
    if (window.Capacitor && window.Capacitor.Plugins) {
        const { App, PushNotifications } = window.Capacitor.Plugins;

        if (App) {
            App.addListener('backButton', ({ canGoBack }) => {
                const isLandscape = document.querySelector('.landscape-mode');
                if (isLandscape) {
                    if (typeof window.renderMobileMaterialTracking === "function") {
                        window.renderMobileMaterialTracking();
                    }
                } else if (canGoBack) {
                    window.history.back();
                } else {
                    App.exitApp();
                }
            });
        }

        if (PushNotifications) {
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Action de notification détectée:', notification);
                // Sur Android, Capacitor ouvre l'app automatiquement si ce listener est présent
            });
        }
    }

    // 3. Render View
    if ((role === 'admin' || role === 'visiteur') && !isMobile) {
        await renderAdminView(session);

        // Popup de bienvenue pour les visiteurs
        if (role === 'visiteur' && !sessionStorage.getItem('visitor_welcomed')) {
            window.showVisitorWelcomeModal();
            sessionStorage.setItem('visitor_welcomed', 'true');
        }

        // Handle Fullscreen Intent after view is ready
        if (fsMode) {
            console.log("Auto-navigating to Planning for Fullscreen mode:", fsMode);
            // Wait a small delay to ensure renderAdminView has finished its async setup
            // --- MISE À JOUR IN-APP ---
            (async () => {
                // Helper global pour comparer les versions
                try {
                    await renderAdminPlanning();
                    window.togglePlanningFullscreen();

                    // Show a non-blocking elegant floating tip at the top
                    const tip = document.createElement('div');
                    tip.id = 'fs-click-tip';
                    tip.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:rgba(0,0,0,0.85); color:#fff; padding:12px 24px; border-radius:30px; font-weight:600; font-size:14px; border:1px solid #2da140; box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events:none; transition:opacity 0.3s; font-family:sans-serif;";
                    tip.innerHTML = "💡 Cliquez n'importe où pour masquer les onglets (Plein Écran)";
                    document.body.appendChild(tip);

                    // Attempt to enter browser fullscreen automatically on first user click or key press anywhere
                    const autoFS = () => {
                        if (!document.fullscreenElement) {
                            const tv = document.getElementById('planning-tv-container');
                            if (tv) tv.requestFullscreen().catch(() => { });
                        }
                        tip.remove();
                        document.removeEventListener('click', autoFS);
                        document.removeEventListener('keydown', autoFS);
                    };
                    document.addEventListener('click', autoFS);
                    document.addEventListener('keydown', autoFS);

                    const onFSChange = () => {
                        if (document.fullscreenElement) {
                            tip.remove();
                            document.removeEventListener('fullscreenchange', onFSChange);
                        }
                    };
                    document.addEventListener('fullscreenchange', onFSChange);
                } catch (e) { }
            })();
        }
    } else {
        await renderMobileView();
    }
}

// Global utility for opening files
window.openFile = function (key) {
    if (!key) return;
    const url = `${config.api.workerUrl}/get/${key}`;
    window.open(url, '_blank');
};

// --- Mobile View (User / Mobile) ---
async function renderAdminView(session) {
    window.currentAdminSession = session;
    // Ensure favicon is present (survives body rewrite)
    if (!document.getElementById('app-favicon')) {
        const favicon = document.createElement('link');
        favicon.id = 'app-favicon';
        favicon.rel = 'icon';
        favicon.type = 'image/png';
        favicon.href = 'favicon.png';
        document.head.appendChild(favicon);
    }
    // Load CSS
    if (!document.getElementById('admin-css')) {
        const link = document.createElement('link');
        link.id = 'admin-css';
        link.rel = 'stylesheet';
        link.href = 'css/admin.css';
        document.head.appendChild(link);
    }

    // Force admin theme to dark mode
    document.documentElement.setAttribute('data-theme', 'dark');

    const isFullscreenTab = !!new URLSearchParams(window.location.search).get('fullscreen');
    document.body.innerHTML = `
    <div class="admin-layout">
        <aside class="sidebar" style="${isFullscreenTab ? 'display: none !important;' : ''}">
            <h2>Pouchain <span>Admin</span></h2>
            <div style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-bottom: 24px;">
                Bienvenue <br><span id="admin-welcome-name" style="color: white; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 4px;" onclick="window.openPersonalSettings()" title="Cliquez pour vos paramètres personnels">${session.user.email}</span>
            </div>
            <div style="margin-bottom: 24px;">
                <input type="text" id="admin-global-search" class="form-input" placeholder="🔍 Rechercher un document..." style="width:100%; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);" oninput="handleAdminGlobalSearch(this.value)">
            </div>
            <nav id="admin-nav" style="visibility: hidden;">
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminFolders()" class="active" id="nav-docs">📂 Documents</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminPlanning()" id="nav-planning">📅 Planning</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminPointage()" id="nav-pointage" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>📝 Pointage Intelligent</span>
                    <span id="pointage-modification-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMaterialRequests()" id="nav-material" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>📦 Demande de matériel</span>
                    <span id="mat-request-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminVehicles()" id="nav-vehicles" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🚗 Gestion des véhicules</span>
                    <span id="vehicle-badge" style="background: var(--warning, #FF9500); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 149, 0, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMaterialTracking()" id="nav-material-stock" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>📦 Statut du matériel ATS</span>
                    <span id="mat-stock-request-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMaterialGTTracking()" id="nav-material-stock-gt" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🗄️ Statut du matériel GT</span>
                    <span id="mat-stock-gt-request-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMaterialAspiTracking()" id="nav-material-stock-aspi" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🧹 Statut du matériel Aspi</span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <span id="mat-stock-aspi-alert-badge" style="background: #FFCC00; color: #ffffffff; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 204, 0, 0.4);">0</span>
                        <span id="mat-stock-aspi-request-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                    </div>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminHTTorques()" id="nav-ht-torques" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>⚡ Couples de Serrage HT</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMaintenance()" id="nav-maintenance">📋 Échéance obligatoire réglementaire</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminPreventionPlans()" id="nav-prevention">📋 Plan de prévention</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminOvertime()" id="nav-overtime" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>⏳ Heures Supplémentaires</span>
                    <span id="nav-recup-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminConges()" id="nav-conges" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🌴 Congés</span>
                    <span id="conges-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminRTT()" id="nav-rtt" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>⚡ RTT</span>
                    <span id="rtt-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminNotifications()" id="nav-notifications">🔔 Notifications</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminUsers()" id="nav-users">👥 Utilisateurs</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminReports()" id="nav-reports" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🐛 Bugs / Améliorations</span>
                    <span id="reports-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminAbout()" id="nav-about">ℹ️ À Propos</a>
            </nav>
            <div style="margin-top: auto;">
                <div id="cloud-storage-usage" style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: rgba(255,255,255,0.8);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Stockage Cloudflare</span>
                        <span id="cloud-storage-text">Calcul...</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden;">
                        <div id="cloud-storage-bar" style="height: 100%; width: 0%; background: var(--primary, #007AFF); transition: width 0.5s ease;"></div>
                    </div>
                    <button class="btn-sm" onclick="openStorageAnalysisModal(event)" style="width:100%; margin-top: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 11px; height: 32px; border-radius: 8px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        📊 Analyser le stockage
                    </button>
                </div>
                <button id="logout-btn" class="logout-btn" style="width: 100%;">Déconnexion</button>
            </div>
        </aside>
        
        <main class="content" id="admin-content" style="${isFullscreenTab ? 'padding: 0 !important;' : ''}">
            <!-- Content Injected Here -->
            <div style="text-align:center; margin-top: 50px;">Chargement...</div>
        </main>
    </div>
    `;

    document.getElementById('logout-btn').onclick = () => auth.logout();

    // Default View
    await refreshAdminData();

    // Fetch user profile to get first and last name, and preferences!
    try {
        const { data: profile } = await window.supabase.createClient(config.supabase.url, config.supabase.anonKey)
            .from('profiles')
            .select('id, first_name, last_name, secteur, preferences')
            .eq('id', session.user.id)
            .single();

        window.currentUserProfile = profile;
        if (profile) {
            if (profile.first_name && profile.last_name) {
                document.getElementById('admin-welcome-name').textContent = `${profile.first_name} ${profile.last_name}`;
            }

            // ─── Config onglets admin par secteur ───────────────────────────────────
            // Pour ajouter un nouveau secteur : ajouter une entrée avec les IDs à masquer.
            const SECTOR_HIDDEN_TABS = {
                'HT': ['nav-material-stock', 'nav-material-stock-gt', 'nav-material-stock-aspi', 'nav-maintenance'],
                // 'NOUVEAU_SECTEUR': ['nav-xyz', 'nav-abc'],
            };
            const secteur = profile.secteur || 'AIA';

            // Masquage automatique des onglets non autorisés
            const hiddenTabs = SECTOR_HIDDEN_TABS[secteur] || [];

            // Si pas HT ou Tout, on masque l'onglet HT Torques
            if (secteur !== 'HT' && secteur !== 'Tout') {
                hiddenTabs.push('nav-ht-torques');
            }

            // Restricted access to RTT for Patrick Prayez & Quentin Vert only
            const userAllowedRTT = profile && (
                ((profile.first_name || '').toLowerCase().trim() === 'patrick' && (profile.last_name || '').toLowerCase().trim() === 'prayez') ||
                ((profile.first_name || '').toLowerCase().trim() === 'quentin' && (profile.last_name || '').toLowerCase().trim() === 'vert')
            );
            if (!userAllowedRTT) {
                document.getElementById('nav-rtt')?.remove();
            }

            hiddenTabs.forEach(id => document.getElementById(id)?.remove());
        }
    } catch (e) {
        console.warn("Could not fetch user profile details", e);
    } finally {
        // Révéler le nav seulement après application du filtre secteur (évite le flash)
        const nav = document.getElementById('admin-nav');
        if (nav) nav.style.visibility = 'visible';
        // Recalculer le badge véhicule maintenant que le profil secteur est connu
        if (window.adminVehiclesCache && window.updateVehicleSidebarBadge) {
            window.updateVehicleSidebarBadge(window.adminVehiclesCache);
        }
    }

    // Fetch and display Cloudflare storage
    try {
        const spaceData = await api.getSpaceUsage();
        const usedGb = (spaceData.usedBytes / (1024 * 1024 * 1024)).toFixed(2);
        const totalGb = (spaceData.totalBytes / (1024 * 1024 * 1024)).toFixed(0);
        const percent = Math.min(100, Math.max(0, (spaceData.usedBytes / spaceData.totalBytes) * 100));

        const bar = document.getElementById('cloud-storage-bar');
        const text = document.getElementById('cloud-storage-text');

        if (bar && text) {
            text.innerHTML = `<b>${usedGb} Go</b> / ${totalGb} Go`;
            bar.style.width = `${percent}%`;
            if (percent > 90) bar.style.backgroundColor = '#FF3B30';
            else if (percent > 75) bar.style.backgroundColor = '#FF9500';
        }
    } catch (e) {
        console.warn("Could not fetch storage usage", e);
        const text = document.getElementById('cloud-storage-text');
        if (text) text.innerText = 'Erreur';
    }

    // Update material requests notification badge + auto refresh every 60s
    if (window.materialBadgeInterval) clearInterval(window.materialBadgeInterval);
    window.updateAllBadges();
    window.materialBadgeInterval = setInterval(() => {
        window.updateAllBadges();
    }, 60000);
}

window.setActiveNav = function (navId) {
    window.adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById(navId);
    if (navItem) navItem.classList.add('active');
}

window.openPersonalSettings = function () {
    const profile = window.currentUserProfile;
    if (!profile) return alert("Chargement du profil en cours...");

    const prefs = profile.preferences || {};
    const currentBg = prefs.planning_bg || '#1C1C1E';
    const currentText = prefs.planning_text || '#FFFFFF';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '100000000';
    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 480px; padding: 40px; animation: modalPop 0.3s ease-out; background: #1C1C1E; color: white; border-radius: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="margin-top: 0; margin-bottom: 24px; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">⚙️</span> Paramètres Personnels
            </h2>
            
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 13px; color: #8E8E93; margin-bottom: 12px; font-weight: 700; text-transform: uppercase;">Couleur de Fond</label>
                <div style="display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 16px;">
                    <input type="color" id="pref-planning-bg" value="${currentBg}" style="width: 50px; height: 50px; border: none; border-radius: 10px; cursor: pointer; background: transparent;">
                    <div style="flex: 1; font-size: 14px;">Couleur principale du planning.</div>
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <label style="display: block; font-size: 13px; color: #8E8E93; margin-bottom: 12px; font-weight: 700; text-transform: uppercase;">Couleur du Texte</label>
                <div style="display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 16px;">
                    <input type="color" id="pref-planning-text" value="${currentText}" style="width: 50px; height: 50px; border: none; border-radius: 10px; cursor: pointer; background: transparent;">
                    <div style="flex: 1;">
                        <div style="font-size: 14px; margin-bottom: 8px;">Choisissez la couleur du texte.</div>
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: var(--primary);">
                            <input type="checkbox" onchange="document.getElementById('pref-planning-text').value = this.checked ? '#000000' : '#FFFFFF'"> 
                            Passer en Noir (Contraste inversé)
                        </label>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn-secondary" style="border-radius: 12px; padding: 10px 20px;" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
                <button id="save-settings-btn" class="btn-primary" style="padding: 10px 24px; background: #2da140; border-radius: 12px; font-weight: 700;">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('save-settings-btn').onclick = async () => {
        const newBg = document.getElementById('pref-planning-bg').value;
        const newText = document.getElementById('pref-planning-text').value;
        const btn = document.getElementById('save-settings-btn');
        btn.disabled = true;
        btn.innerText = "Sauvegarde...";

        try {
            const updatedPrefs = { ...prefs, planning_bg: newBg, planning_text: newText };
            const { error } = await window.supabase.createClient(config.supabase.url, config.supabase.anonKey)
                .from('profiles')
                .update({ preferences: updatedPrefs })
                .eq('id', profile.id);

            if (error) throw error;

            window.currentUserProfile.preferences = updatedPrefs;

            // Immediate CSS override
            let style = document.getElementById('user-planning-custom-bg');
            if (!style) {
                style = document.createElement('style');
                style.id = 'user-planning-custom-bg';
                document.head.appendChild(style);
            }
            style.innerHTML = `
                .planning-inline { background: ${newBg} !important; color: ${newText} !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
                .planning-inline header h1, .planning-inline header span { color: inherit !important; }
            `;

            modal.remove();
        } catch (e) {
            alert("Erreur lors de la sauvegarde : " + e.message);
            btn.disabled = false;
            btn.innerText = "Enregistrer";
        }
    };
}

// --- MODULE: SIGNALEMENTS BUGS / AMÉLIORATIONS ---
window.updateReportsBadge = async function () {
    await window.updateAllBadges();
};

window.showConfirmModal = function (title, message, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '100007';
    overlay.innerHTML = `
        <div class="modal-box" style="max-width:450px; text-align:center; animation: modalPop 0.3s ease-out;">
            <div class="modal-header" style="justify-content:center; border-bottom:none; font-size:20px;">${title}</div>
            <div style="padding: 15px; font-size:15px; line-height:1.5; color:rgba(255,255,255,0.85);">${message}</div>
            <div class="modal-actions" style="justify-content:center; margin-top:10px; border-top:none; gap:15px;">
                <button class="btn-secondary" id="confirm-cancel" style="min-width:100px;">Annuler</button>
                <button class="btn-primary" id="confirm-ok" style="min-width:100px;">Confirmer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('confirm-cancel').onclick = () => overlay.remove();
    document.getElementById('confirm-ok').onclick = () => {
        overlay.remove();
        callback();
    };
};

window.showInfoModal = function (title, message) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '100006';
    overlay.innerHTML = `
        <div class="modal-box" style="max-width:400px; text-align:center; animation: modalPop 0.3s ease-out;">
            <div class="modal-header" style="justify-content:center; border-bottom:none; font-size:20px;">${title}</div>
            <div style="padding: 15px; font-size:15px; line-height:1.5; color:rgba(255,255,255,0.85);">${message}</div>
            <div class="modal-actions" style="justify-content:center; margin-top:10px; border-top:none;">
                <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">Compris</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.refreshAdminData = async function () {
    try {
        const [files, vehicles] = await Promise.all([
            api.listFiles(),
            api.getVehicles()
        ]);

        window.adminFilesCache = files;
        window.adminVehiclesCache = vehicles; // mis en cache pour re-filtrage après chargement du profil
        if (window.updateVehicleSidebarBadge) window.updateVehicleSidebarBadge(vehicles);

        if (window.adminCurrentFolder) {
            renderAdminFiles(window.adminCurrentFolder);
        } else {
            renderAdminFolders();
        }
    } catch (e) {
        console.warn("Refresh admin data error:", e);
    }
}

// Helper: build an owner badge supporting 1 or N owners.
// owners: string[] | null  —  tag: 'div' (folder cards) or 'span' (table rows)
window.makeOwnerBadge = function (owners, tag) {
    if (!owners || (Array.isArray(owners) && owners.length === 0)) return '';
    const list = Array.isArray(owners) ? owners : [owners];
    const baseStyle = `font-size:11px; color:var(--primary); background:color-mix(in srgb, var(--primary) 15%, transparent); border-radius:6px; cursor:default;`;
    if (list.length === 1) {
        const inlineStyle = tag === 'span'
            ? `${baseStyle} padding:2px 7px; margin-left:8px; white-space:nowrap;`
            : `${baseStyle} padding:3px 6px; margin-top:6px; display:inline-flex; align-items:center; gap:4px;`;
        return `<${tag} style="${inlineStyle}" title="${list[0]}">\uD83D\uDC64 ${list[0]}</${tag}>`;
    }
    // Multiple owners
    const tooltip = list.join('\n');
    const inlineStyle = tag === 'span'
        ? `${baseStyle} padding:2px 7px; margin-left:8px; white-space:nowrap;`
        : `${baseStyle} padding:3px 6px; margin-top:6px; display:inline-flex; align-items:center; gap:4px;`;
    return `<${tag} style="${inlineStyle}" title="${tooltip}">\uD83D\uDC65 ${list.length} utilisateurs</${tag}>`;
}

// 1. Render Folders Grid

initDashboard();
