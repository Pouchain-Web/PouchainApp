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

const PRESET_ACTIVITIES = [
    "Montage AIA 1", "Montage AIA 2", "Maintenance HT", "Travaux Ligne",
    "Logistique", "Atelier", "Bureau", "Déplacement", "Réunion", "Formation",
    "Repos", "Congés Payés", "RTT", "Maladie"
];
const MEAL_OPTIONS = ["Aucun", "1 Repas", "2 Repas", "3 Repas", "Repas GD", "Ticket Resto", "Panier Chantier"];
const TRAJET_OPTIONS = ["Aucune", "Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z6+"];
const HOUR_OPTIONS = Array.from({ length: 22 }, (_, i) => (i + 1) * 0.5);


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
                window.compareVersions = (v1, v2) => {
                    if (!v1 || !v2) return 0;
                    const s1 = String(v1).toLowerCase().startsWith('v') ? String(v1).slice(1) : String(v1);
                    const s2 = String(v2).toLowerCase().startsWith('v') ? String(v2).slice(1) : String(v2);
                    const a = s1.split('.').map(Number);
                    const b = s2.split('.').map(Number);
                    for (let i = 0; i < Math.max(a.length, b.length); i++) {
                        const valA = a[i] || 0;
                        const valB = b[i] || 0;
                        if (valA > valB) return 1;
                        if (valA < valB) return -1;
                    }
                    return 0;
                };

                try {
                    await renderAdminPlanning();
                    if (fsMode === '2') {
                        window.togglePlanningFullscreenV2();
                    } else {
                        window.togglePlanningFullscreen();
                    }

                    // Show a non-blocking elegant floating tip at the top
                    const tip = document.createElement('div');
                    tip.id = 'fs-click-tip';
                    tip.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:rgba(0,0,0,0.85); color:#fff; padding:12px 24px; border-radius:30px; font-weight:600; font-size:14px; border:1px solid #2da140; box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events:none; transition:opacity 0.3s; font-family:sans-serif;";
                    tip.innerHTML = "💡 Cliquez n'importe où pour masquer les onglets (Plein Écran)";
                    document.body.appendChild(tip);

                    // Attempt to enter browser fullscreen automatically on first user click or key press anywhere
                    const autoFS = () => {
                        if (!document.fullscreenElement) {
                            if (fsMode === '2') {
                                const v2 = document.getElementById('planning-v2-container');
                                if (v2) v2.requestFullscreen().catch(() => {});
                            } else {
                                const el = document.getElementById('integrated-planning-container');
                                if (el) el.requestFullscreen().catch(() => {});
                            }
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
let mobileFilesCache = []; // Cache for search
let mobileVehicleCache = null; // Track vehicle data for the list
let mobileCurrentPath = null; // Track current folder path
let isMobileView = false; // Flag to know which view is active

async function renderMobileView() {
    isMobileView = true;
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
    if (!document.getElementById('mobile-css')) {
        const link = document.createElement('link');
        link.id = 'mobile-css';
        link.rel = 'stylesheet';
        link.href = 'css/style.css';
        document.head.appendChild(link);
    }

    // Local theme logic
    const applyMobileTheme = (isDark) => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.innerHTML = isDark ? `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            ` : `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            `;
        }
    };

    // Structure
    document.body.innerHTML = `
    <!-- Fixed Top Bar -->
    <div class="mobile-top-bar">
        <div class="mobile-header-content">
            <div class="logo-container">
                <img src="logo-pouchain.svg" alt="Pouchain" class="header-logo" style="height: 32px; width: auto; max-width: 60vw; object-fit: contain;">
            </div>
            <div style="display:flex; gap: 12px; align-items: center;">
                <button id="theme-toggle" class="header-btn theme-toggle-btn" title="Changer le thème" style="background: rgba(142, 142, 147, 0.12); color: #8E8E93;">
                   <!-- Icon dynamically filled -->
                </button>
                <button id="logout-btn" class="header-btn" title="Déconnexion">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            </div>
        </div>
        <!-- Search Bar in Top Header -->
        <div class="mobile-search-container">
            <input type="text" class="search-bar" id="search-input" placeholder="Rechercher un document">
        </div>
    </div>

    <div class="dashboard-content" id="main-view">
        <!-- Categories View -->
        <div id="categories-view" class="view-transition">
            <div class="categories-grid" id="categories-grid">
                <div style="grid-column: 1 / -1; width: 100%; text-align: center; color: #8E8E93; margin-top: 40px;">Chargement...</div>
            </div>
        </div>

        <!-- Search Results View -->
        <div id="search-results-view" class="hidden view-transition" style="padding-bottom: 20px;">
            <div id="search-results-list"></div>
        </div>

        <!-- Document List View (Category Drill-down) -->
        <div id="document-list" class="hidden">
            <div class="nav-header">
                <div class="back-button" id="back-btn">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
                        <path d="M15 18L9 12L15 6"></path>
                    </svg>
                    Retour
                </div>
                <div class="nav-title" id="selected-category-title">Catégorie</div>
            </div>
            
            <!-- Mobile Upload Button (shown only inside a folder) -->
            <button id="mobile-upload-btn" onclick="mobileTriggerUpload()" title="Uploader un fichier"
                style="display:none; position:fixed; bottom:24px; right:24px; z-index:9999; align-items:center; justify-content:center; gap:8px; padding:14px 20px; background:var(--primary-color,#2da140); color:white; border:none; border-radius:30px; font-size:16px; font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
                📤 Upload
            </button>

            <div id="list-content" class="view-transition" style="padding-bottom: 90px;"></div>
        </div>
    </div>
    `;

    // Event Listeners
    document.getElementById('logout-btn').onclick = () => auth.logout();

    // Back Button Logic
    // Back Button Logic
    document.getElementById('back-btn').onclick = () => {
        if (mobileCurrentPath === 'auto_detail') {
            window.renderMobileVehiclesList(mobileVehicleCache);
            return;
        }
        if (mobileCurrentPath && mobileCurrentPath.includes('/')) {
            // Go up one level
            const parts = mobileCurrentPath.split('/');
            parts.pop();
            const parentPath = parts.join('/');
            openMobileFolder(parentPath);
        } else {
            // Back to Categories
            document.getElementById('categories-view').classList.remove('hidden');
            document.getElementById('document-list').classList.add('hidden');
            const searchContainer = document.querySelector('.mobile-search-container');
            if (searchContainer) searchContainer.classList.remove('hidden');
            mobileCurrentPath = null;
        }
    };

    // Search Logic
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleMobileSearch(e.target.value);
        });
    }

    // Load Data
    try {
        const session = await auth.getSession();
        const userId = session ? session.user.id : null;

        // Fetch user profile to get preferences
        let userSecteur = 'Tout';
        if (session) {
            try {
                const supabaseClient = window.supabase.createClient(config.supabase.url, config.supabase.anonKey);
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('preferences, secteur')
                    .eq('id', session.user.id)
                    .single();

                let currentPreferences = (profile && profile.preferences) || {};
                if (typeof currentPreferences === 'string') currentPreferences = JSON.parse(currentPreferences);

                userSecteur = (profile && profile.secteur) || 'Tout';

                // Set initial theme
                const isDarkMode = currentPreferences.mobile_dark_mode === true;
                applyMobileTheme(isDarkMode);

                // Theme Toggle Handler
                const themeBtn = document.getElementById('theme-toggle');
                if (themeBtn) {
                    themeBtn.onclick = async () => {
                        const isNewDark = document.documentElement.getAttribute('data-theme') !== 'dark';
                        applyMobileTheme(isNewDark);

                        // Re-render if in planning
                        if (mobileCurrentPath === 'planning') {
                            const dateInput = document.querySelector('input[type="date"]');
                            renderMobilePlanning(dateInput ? dateInput.value : undefined);
                        }

                        // Save to DB
                        currentPreferences.mobile_dark_mode = isNewDark;
                        await supabaseClient
                            .from('profiles')
                            .update({ preferences: currentPreferences })
                            .eq('id', session.user.id);
                    };
                }
            } catch (prefError) {
                console.warn("Could not handle user profile details for mobile theme", prefError);
            }
        }

        const [files, myVehicle] = await Promise.all([
            api.listFiles(userId),
            api.getMyVehicle()
        ]);
        mobileFilesCache = files;
        mobileVehicleCache = myVehicle;
        generateMobileCategories(files, myVehicle, userSecteur);

        // Check for missing vehicle information ONLY for assigned vehicle
        const assignedVehicle = myVehicle ? myVehicle.assigned : null;
        if (assignedVehicle) {
            const missing = [];
            if (!assignedVehicle.next_maintenance_date) missing.push("Date limite d'entretien");
            if (!assignedVehicle.next_maintenance_km && assignedVehicle.next_maintenance_km !== 0) missing.push("Prochain entretien (km)");
            if (!assignedVehicle.toll_card) missing.push("Badge Télépéage");
            if (!assignedVehicle.dkv_card) missing.push("Carte DKV");
            if (!assignedVehicle.last_ct_date) missing.push("Contrôle Technique");

            if (missing.length > 0) {
                const dk = document.documentElement.getAttribute('data-theme') === 'dark';
                const bg = dk ? '#1C1C1E' : '#ffffff';
                const textColor = dk ? '#ffffff' : '#1c1c1e';
                const inputBg = dk ? '#2C2C2E' : '#f2f2f7';

                const modal = document.createElement('div');
                modal.className = 'modal-overlay';
                modal.style.zIndex = "10000";

                modal.innerHTML = `
                    <div id="missing-info-alert" class="modal-box" style="padding: 24px; border-radius: 28px; background: ${bg}; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <div style="font-size: 40px; margin-bottom: 16px;">⚠️</div>
                        <h2 style="margin-top: 0; margin-bottom: 16px; color: ${textColor}; font-size: 20px;">Informations manquantes</h2>
                        <div style="font-size: 15px; color: #8E8E93; margin-bottom: 24px; line-height: 1.5;">
                            Votre véhicule (<strong>${window.escapeHTML(assignedVehicle.plate_number)}</strong>) requiert la mise à jour des informations suivantes :
                            <ul style="text-align: left; margin-top: 12px; color: ${textColor}; padding-left: 20px;">
                                ${missing.map(m => `<li>${m}</li>`).join('')}
                            </ul>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <button id="fill-info-btn" class="btn-primary" style="width: 100%; padding: 14px; font-size: 16px; background: #FF9500;">Remplir les informations</button>
                            <button class="btn-primary" style="width: 100%; padding: 14px; font-size: 16px; background: #8E8E93;" onclick="this.closest('.modal-overlay').remove()">Ignorer pour le moment</button>
                        </div>
                    </div>
                    
                    <div id="missing-info-form" class="modal-box hidden" style="padding: 24px; border-radius: 28px; background: ${bg}; width: 90%; max-width: 400px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <h2 style="margin-top: 0; margin-bottom: 20px; color: ${textColor}; font-size: 20px;">Mettre à jour mon auto</h2>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px;">Date limite d'entretien</label>
                            <input type="date" id="mi-date" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" value="${assignedVehicle.next_maintenance_date || ''}">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px;">Prochain entretien (km)</label>
                            <input type="number" id="mi-km" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" placeholder="Ex: 50000" value="${assignedVehicle.next_maintenance_km || ''}">
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px;">Badge Télépéage</label>
                            <input type="text" id="mi-toll" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" placeholder="N° du badge" value="${assignedVehicle.toll_card || ''}">
                        </div>
                        <div style="margin-bottom: 24px;">
                            <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px;">Carte DKV</label>
                            <input type="text" id="mi-dkv" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" placeholder="N° de carte" value="${assignedVehicle.dkv_card || ''}">
                        </div>
                        <div style="margin-bottom: 24px;">
                            <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px;">Date du dernier Contrôle Technique</label>
                            <input type="date" id="mi-ct" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" value="${assignedVehicle.last_ct_date || ''}">
                        </div>
                        
                        <div style="display: flex; gap: 12px;">
                            <button class="btn-secondary" style="flex: 1;" onclick="document.getElementById('missing-info-form').classList.add('hidden'); document.getElementById('missing-info-alert').classList.remove('hidden');">Retour</button>
                            <button id="submit-mi-btn" class="btn-primary" style="flex: 1; background: #2da140;">Enregistrer</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                document.getElementById('fill-info-btn').onclick = () => {
                    document.getElementById('missing-info-alert').classList.add('hidden');
                    document.getElementById('missing-info-form').classList.remove('hidden');
                };

                document.getElementById('submit-mi-btn').onclick = async () => {
                    const btn = document.getElementById('submit-mi-btn');
                    btn.disabled = true;
                    btn.innerText = "En cours...";
                    try {
                        const payload = {
                            id: assignedVehicle.id,
                            next_maintenance_date: document.getElementById('mi-date').value || null,
                            next_maintenance_km: document.getElementById('mi-km').value || null,
                            toll_card: document.getElementById('mi-toll').value || null,
                            dkv_card: document.getElementById('mi-dkv').value || null,
                            last_ct_date: document.getElementById('mi-ct').value || null
                        };
                        await api.updateMyVehicle(payload);

                        modal.remove();
                    } catch (e) {
                        alert("Erreur: " + e.message);
                        btn.disabled = false;
                        btn.innerText = "Enregistrer";
                    }
                };
            }
        }
    } catch (e) {
        console.error(e);
        document.getElementById('categories-grid').innerHTML = `<div style="color:red; text-align:center;">Erreur de chargement: ${e.message}</div>`;
    }
}

function handleMobileSearch(query) {
    const categoriesView = document.getElementById('categories-view');
    const searchView = document.getElementById('search-results-view');
    const docListView = document.getElementById('document-list');

    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.length === 0) {
        // Show Categories, Hide Search Results
        categoriesView.classList.remove('hidden');
        searchView.classList.add('hidden');
        docListView.classList.add('hidden');
        return;
    }

    // Hide others
    categoriesView.classList.add('hidden');
    docListView.classList.add('hidden');
    searchView.classList.remove('hidden');

    // Filter — exclude internal config files (.keep, .meta_color_*)
    const isInternalFile = (key) => {
        const name = key.split('/').pop();
        return name.endsWith('.keep') || name.startsWith('.meta_') || name.startsWith('.');
    };
    const results = mobileFilesCache.filter(f => {
        // Exclude internal files
        if (isInternalFile(f.key)) return false;

        // Exclude archive files/folders
        const fileName = f.key.split('/').pop().toLowerCase();
        const isInArchiveFolder = f.key.toLowerCase().startsWith('archive/');
        if (isInArchiveFolder || fileName.includes('archive')) return false;

        // Check against search query
        return f.key.toLowerCase().includes(normalizedQuery);
    });
    const container = document.getElementById('search-results-list');
    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#8E8E93; margin-top:40px;">Aucun résultat</div>`;
        return;
    }

    results.forEach(doc => {
        renderMobileDocItem(doc, container);
    });
}

function generateMobileCategories(files, myVehicle = null, userSecteur = 'Tout') {
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = '';

    const categories = new Map();
    const uncategorized = [];

    files.forEach(file => {
        const parts = file.key.split('/');
        if (parts.length > 1) {
            const folder = parts[0];
            if (folder.toLowerCase() === 'archive') return;
            if (!categories.has(folder)) {
                categories.set(folder, { files: [], color: null, emoji: '📁', order: 999, row: 1 });
            }
            const catData = categories.get(folder);

            if (parts[1].startsWith('.meta_color_')) {
                catData.color = parts[1].replace('.meta_color_', '#');
            } else if (parts[1].startsWith('.meta_emoji_')) {
                catData.emoji = decodeURIComponent(parts[1].replace('.meta_emoji_', ''));
            } else if (parts[1].startsWith('.meta_order_')) {
                catData.order = parseInt(parts[1].replace('.meta_order_', ''), 10) || 999;
            } else if (parts[1].startsWith('.meta_row_')) {
                catData.row = parseInt(parts[1].replace('.meta_row_', ''), 10) || 1;
            } else if (!file.key.endsWith('.keep') && !parts[1].startsWith('.meta_')) {
                catData.files.push(file);
            }
        } else {
            if (file.key.toLowerCase().includes('archive')) return;
            uncategorized.push(file);
        }
    });

    const colors = ['rgba(255, 255, 255, 0.2)'];
    let colorIdx = 0;

    const sortedCategories = Array.from(categories.entries()).sort((a, b) => {
        if (a[1].row !== b[1].row) return a[1].row - b[1].row;
        if (a[1].order !== b[1].order) return a[1].order - b[1].order;
        return a[0].localeCompare(b[0]);
    });

    sortedCategories.forEach(([catName, data]) => {
        if (catName.toLowerCase() === 'archive') return;
        const card = document.createElement('div');
        card.className = 'category-card';
        const color = data.color || colors[colorIdx % colors.length];
        card.innerHTML = `
            <div class="category-icon" style="background-color: ${color}">${data.emoji}</div>
            <div class="category-title">${catName}</div>
        `;
        card.onclick = () => openMobileFolder(catName);
        grid.appendChild(card);
        colorIdx++;
    });

    if (uncategorized.length > 0) {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-icon" style="background-color: rgba(255, 255, 255, 0.2)">📄</div>
            <div class="category-title">Autres</div>
        `;
        card.onclick = () => showMobileRootFiles(uncategorized);
        grid.appendChild(card);
    }

    // Add Special App Cards — Filtered by Sector
    if (userSecteur === 'AIA' || userSecteur === 'Tout') {
        const planningCard = document.createElement('div');
        planningCard.className = 'category-card';
        planningCard.innerHTML = `
            <div class="category-icon" style="background-color: var(--primary);">📅</div>
            <div class="category-title" style="font-weight:bold;">Planning</div>
        `;
        planningCard.onclick = () => renderMobilePlanning();

        const matosCard = document.createElement('div');
        matosCard.className = 'category-card';
        matosCard.innerHTML = `
            <div class="category-icon" style="background-color: #FF9500;">📦</div>
            <div class="category-title" style="font-weight:bold;">Mon Matos</div>
        `;
        matosCard.onclick = () => renderMobileMaterialRequests();

        if (myVehicle && (myVehicle.assigned || (myVehicle.common && myVehicle.common.length > 0))) {
            const autoCard = document.createElement('div');
            autoCard.className = 'category-card';
            autoCard.innerHTML = `
                <div class="category-icon" style="background-color: #34C759;">🚗</div>
                <div class="category-title" style="font-weight:bold;">Véhicules</div>
            `;
            autoCard.onclick = () => window.renderMobileVehiclesList(myVehicle);
            grid.prepend(autoCard);
        }

        const matosStockCard = document.createElement('div');
        matosStockCard.className = 'category-card';
        matosStockCard.innerHTML = `
            <div class="category-icon" style="background-color: #5856D6;">📦</div>
            <div class="category-title" style="font-weight:bold;">Stock</div>
        `;
        matosStockCard.onclick = () => renderMobileMaterialTracking();

        grid.prepend(matosStockCard);
        grid.prepend(matosCard);
        grid.prepend(planningCard);
    } else if (userSecteur === 'HT') {
        // HT Section - Placeholder for future apps
        const placeholder = document.createElement('div');
        placeholder.style.cssText = "grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #8E8E93;";
        placeholder.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">🏗️</div>
            <h3 style="color: white; margin-bottom: 10px;">Secteur HT</h3>
            <p>Les applications pour le secteur Haute Tension sont en cours de développement.</p>
        `;
        grid.appendChild(placeholder);
    }
}

window.renderMobileMaterialRequests = async function () {
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    const searchContainer = document.querySelector('.mobile-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');

    document.getElementById('selected-category-title').innerText = "Mon Matos";
    document.getElementById('mobile-upload-btn').style.display = 'none';

    mobileCurrentPath = "matos";

    const container = document.getElementById('list-content');
    container.innerHTML = `<div style="text-align:center; padding: 40px;"><div class="loader-spinner"></div></div>`;

    try {
        const session = await auth.getSession();
        const requests = await api.getMaterialRequests(session.user.id);
        const categories = await api.getMaterialCategories();

        const dk = document.documentElement.getAttribute('data-theme') === 'dark';
        const cardBg = dk ? '#1C1C1E' : '#fff';
        const textColor = dk ? '#FFFFFF' : '#1c1c1e';
        const subtleBorder = dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

        let html = `
            <div style="padding: 16px; padding-bottom: 100px;">
                <button class="btn-primary" onclick="openNewMaterialRequestModal()" style="width: 100%; height: 56px; background: #FF9500; font-size: 16px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3);">
                    + Nouvelle demande
                </button>
        `;

        if (requests.length === 0) {
            html += `<div style="text-align:center; color:#8E8E93; padding: 40px;">Aucune demande de matériel</div>`;
        } else {
            // Group by status
            const groups = {
                'requested': { label: 'En attente', color: '#8E8E93', icon: '⏳' },
                'ordered': { label: 'Commandé', color: '#007AFF', icon: '📦' },
                'refused': { label: 'Refusé', color: '#FF3B30', icon: '❌' },
                'received': { label: 'Reçu / Acquitté', color: '#34C759', icon: '✅' }
            };

            const sortedKeys = ['requested', 'ordered'];

            sortedKeys.forEach(status => {
                const groupRequests = requests.filter(r => r.status === status);
                if (groupRequests.length > 0) {
                    html += `<h3 style="color: ${groups[status].color}; font-size: 14px; text-transform: uppercase; margin: 20px 0 10px 4px; display: flex; align-items: center; gap: 8px;">
                                ${groups[status].icon} ${groups[status].label}
                            </h3>`;

                    groupRequests.forEach(req => {
                        html += `
                            <div style="background: ${cardBg}; border: 1px solid ${subtleBorder}; border-radius: 16px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                    <div style="font-weight: bold; font-size: 17px; color: ${textColor};">${window.escapeHTML(req.material_name)}</div>
                                    <div style="font-size: 12px; color: #8E8E93;">${new Date(req.created_at).toLocaleDateString('fr-FR')}</div>
                                </div>
                                <div style="font-size: 14px; color: #8E8E93; margin-bottom: 8px;">Catégorie: ${window.escapeHTML(req.category || 'Non classé')}</div>
                                ${req.comment ? `<div style="font-size: 14px; color: ${textColor}; background: ${dk ? '#2C2C2E' : '#f2f2f7'}; padding: 10px; border-radius: 12px; line-height: 1.4;">${window.escapeHTML(req.comment)}</div>` : ''}
                            </div>
                        `;
                    });
                }
            });
        }

        html += `</div>`;
        container.innerHTML = html;

        window.openNewMaterialRequestModal = () => {
            const _dk = document.documentElement.getAttribute('data-theme') === 'dark';
            const _inputBg = _dk ? '#2C2C2E' : '#f2f2f7';
            const _textColor = _dk ? '#FFFFFF' : '#000000';

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.zIndex = "10000";

            let categoryOptions = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

            modal.innerHTML = `
                <div class="modal-box" style="padding: 24px; border-radius: 28px; width: 90%; max-width: 400px;">
                    <h2 style="margin-top: 0; margin-bottom: 20px; color: ${_textColor};">Nouvelle demande</h2>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px; text-align: left;">Matériel désiré</label>
                        <input type="text" id="req-name" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${_inputBg}; color: ${_textColor}; font-size: 16px;" placeholder="Ex: Perceuse, Gants...">
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px; text-align: left;">Catégorie</label>
                        <select id="req-category" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${_inputBg}; color: ${_textColor}; font-size: 16px;">
                            ${categoryOptions}
                        </select>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px; text-align: left;">Commentaire / Pourquoi ?</label>
                        <textarea id="req-comment" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${_inputBg}; color: ${_textColor}; font-size: 16px; height: 100px; resize: none;" placeholder="Expliquez votre besoin..."></textarea>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 6px; text-align: left;">Photo (Optionnel)</label>
                        <label id="photo-label" for="req-photo-input" style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 16px; border-radius: 16px; background: ${_inputBg}; color: ${_textColor}; text-align: center; border: 2px dashed rgba(255,255,255,0.1); cursor: pointer; transition: 0.3s; font-weight: 600;">
                            <span>📷 Prendre une photo</span>
                        </label>
                        <input type="file" id="req-photo-input" accept="image/*" capture="environment" style="display: none;" onchange="handleMaterialPhotoSelection(this)">
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex: 1;">Annuler</button>
                        <button class="btn-primary" id="submit-req-btn" style="flex: 1; background: #FF9500;">Envoyer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            let selectedFile = null;
            window.handleMaterialPhotoSelection = (input) => {
                if (input.files && input.files[0]) {
                    selectedFile = input.files[0];
                    const label = document.getElementById('photo-label');
                    label.innerHTML = `<span>✅ ${selectedFile.name.substring(0, 20)}${selectedFile.name.length > 20 ? '...' : ''}</span>`;
                    label.style.borderColor = "#FF9500";
                    label.style.color = "#FF9500";
                    label.style.background = "rgba(255, 149, 0, 0.05)";
                }
            };

            document.getElementById('submit-req-btn').onclick = async () => {
                const name = document.getElementById('req-name').value.trim();
                const category = document.getElementById('req-category').value;
                const comment = document.getElementById('req-comment').value.trim();

                if (!name) {
                    alert("Veuillez indiquer le nom du matériel.");
                    return;
                }

                const btn = document.getElementById('submit-req-btn');
                btn.disabled = true;
                btn.innerText = "Envoi...";

                try {
                    let image_path = null;
                    if (selectedFile) {
                        btn.innerText = "Upload photo...";
                        const timestamp = Date.now();
                        const safeFileName = selectedFile.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
                        const fileName = `${timestamp}_${safeFileName}`;
                        const renamedFile = new File([selectedFile], fileName, { type: selectedFile.type });

                        await api.uploadFile(renamedFile, 'material_requests/');
                        image_path = 'material_requests/' + fileName;
                    }

                    btn.innerText = "Création...";
                    await api.createMaterialRequest({
                        material_name: name,
                        category: category,
                        comment: comment,
                        image_path: image_path
                    });
                    modal.remove();
                    renderMobileMaterialRequests();
                } catch (e) {
                    alert("Erreur: " + e.message);
                    btn.disabled = false;
                    btn.innerText = "Envoyer";
                }
            };
        };

    } catch (e) {
        container.innerHTML = `<div style="color:red; margin:20px;">Erreur: ${e.message}</div>`;
    }
};

window.renderMobilePlanning = async function (dateStr = new Date().toISOString().split('T')[0], mode = 'day') {
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    const searchContainer = document.querySelector('.mobile-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');

    document.getElementById('selected-category-title').innerText = "Planning";
    document.getElementById('mobile-upload-btn').style.display = 'none';

    mobileCurrentPath = "planning"; // Matches back-button logic

    // Add spinner css specifically for mobile if needed
    if (!document.getElementById('spin-style')) {
        const style = document.createElement('style');
        style.id = 'spin-style';
        style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    document.getElementById('list-content').innerHTML = `<div style="text-align:center; padding: 40px;"><div class="loader" style="border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div></div>`;

    try {
        let tasks = [];
        let weekRange = null;

        if (mode === 'day') {
            tasks = await api.getTasks(dateStr);
        } else {
            // Week Mode
            const d = new Date(dateStr + 'T12:00:00');
            const dayNum = d.getDay();
            const diff = d.getDate() - dayNum + (dayNum === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            const startDate = monday.toISOString().split('T')[0];
            const endDate = sunday.toISOString().split('T')[0];
            weekRange = { startDate, endDate };
            tasks = await api.getTasks({ startDate, endDate });
        }
        const displayDate = new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

        // Dark mode detection for inline styles
        const dk = document.documentElement.getAttribute('data-theme') === 'dark';
        const bg = dk ? '#000000' : '#f8f9fa';
        const cardBg = dk ? '#1C1C1E' : '#fff';
        const textColor = dk ? '#FFFFFF' : '#1c1c1e';
        const subtleBorder = dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        const btnBg = dk ? '#2C2C2E' : '#f0f0f0';
        const timelineBorder = dk ? '#38383A' : '#e5e5ea';
        const chipBg = dk ? '#2C2C2E' : '#f0f0f0';
        const doneCardBg = dk ? '#1C1C1E' : '#f2f2f7';
        const doneBorder = dk ? '#38383A' : '#e5e5ea';
        const normalBorder = dk ? '#264d2e' : '#d1e7dd';
        const dotBorderColor = dk ? '#000' : '#fff';

        // Helper to change day
        window.changeMobileDay = (current, offset) => {
            const d = new Date(current + 'T12:00:00');
            d.setDate(d.getDate() + (mode === 'week' ? offset * 7 : offset));
            renderMobilePlanning(d.toISOString().split('T')[0], mode);
        };

        let html = `
            <div style="background: ${bg}; display: flex; flex-direction: column; height: calc(100vh - 60px);">
                <!-- Fixed Header Block -->
                <div style="position: fixed; top: 110px; left: 0; right: 0; z-index: 150; background: ${bg}; padding: 16px; border-bottom: 1px solid ${subtleBorder}; box-shadow: 0 4px 10px rgba(0,0,0,${dk ? '0.2' : '0.01'});">
                    
                    <!-- View Switcher -->
                    <div style="display: flex; background: ${dk ? '#1C1C1E' : '#E5E5EA'}; padding: 4px; border-radius: 12px; margin-bottom: 16px;">
                        <button onclick="renderMobilePlanning('${dateStr}', 'day')" style="flex: 1; border: none; background: ${mode === 'day' ? cardBg : 'transparent'}; color: ${textColor}; padding: 8px; border-radius: 8px; font-weight: 700; font-size: 13px; box-shadow: ${mode === 'day' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'}; transition: 0.3s;">Jour</button>
                        <button onclick="renderMobilePlanning('${dateStr}', 'week')" style="flex: 1; border: none; background: ${mode === 'week' ? cardBg : 'transparent'}; color: ${textColor}; padding: 8px; border-radius: 8px; font-weight: 700; font-size: 13px; box-shadow: ${mode === 'week' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'}; transition: 0.3s;">Semaine</button>
                    </div>

                    <div style="margin-bottom: 12px; background: ${cardBg}; padding: 10px; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,${dk ? '0.2' : '0.04'}); display: flex; align-items: center; gap: 8px;">
                        <button onclick="changeMobileDay('${dateStr}', -1)" style="border:none; background: ${btnBg}; color: ${textColor}; border-radius: 50%; width: 40px; height: 40px; font-size: 18px; display: flex; align-items:center; justify-content:center;">◀</button>
                        <div style="flex:1; position: relative; text-align:center;">
                            ${mode === 'day'
                ? `<input type="date" class="form-input" style="width:100%; border:none; background:transparent; font-weight:bold; text-align:center; font-size: 15px; color: ${textColor}; padding: 0;" value="${dateStr}" onchange="renderMobilePlanning(this.value, 'day')">`
                : `<div style="display:flex; flex-direction:column; align-items:center;">
                                     <span style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: var(--primary); margin-bottom: 2px;">Semaine ${window.getISOWeekNumber(weekRange.startDate)}</span>
                                     <div style="font-weight:800; font-size:14px; color:${textColor};">${new Date(weekRange.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${new Date(weekRange.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                                   </div>`
            }
                        </div>
                        <button onclick="changeMobileDay('${dateStr}', 1)" style="border:none; background: ${btnBg}; color: ${textColor}; border-radius: 50%; width: 40px; height: 40px; font-size: 18px; display: flex; align-items:center; justify-content:center;">▶</button>
                    </div>

                    ${mode === 'day' ? `
                        <div style="font-weight: 800; color: ${textColor}; font-size: 19px; text-transform: capitalize; padding-left: 4px;">
                            ${new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    ` : ''}
                </div>

                <!-- Scrollable Task List -->
                <div style="flex: 1; overflow-y: auto; padding: ${mode === 'day' ? '240px' : '210px'} 16px 100px 16px;">
        `;

        if (tasks.length === 0) {
            html += `<div style="color:#8E8E93; text-align:center; padding: 60px 0; font-size: 16px;">
                <div style="font-size: 40px; margin-bottom: 12px;">🌟</div>
                Aucune tâche prévue
            </div>`;
        } else {
            if (mode === 'day') {
                html += `<div class="timeline" style="position: relative; padding-left: 20px; border-left: 3px solid ${timelineBorder}; margin-left: 10px;">`;
                tasks.forEach(t => { html += renderMobileTaskCard(t, dateStr, mode, dk, cardBg, textColor, subtleBorder, timelineBorder, chipBg, doneCardBg, doneBorder, normalBorder, dotBorderColor); });
                html += `</div>`;
            } else {
                // Group by date
                const grouped = {};
                tasks.forEach(t => {
                    if (!grouped[t.date]) grouped[t.date] = [];
                    grouped[t.date].push(t);
                });

                Object.keys(grouped).sort().forEach(date => {
                    const dayTasks = grouped[date];
                    const d = new Date(date + 'T12:00:00');
                    const dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });

                    html += `<div style="margin-bottom: 32px;">
                                <div style="font-weight: 800; font-size: 14px; text-transform: uppercase; color: ${dk ? '#8E8E93' : '#666'}; margin-bottom: 12px; padding-left: 4px; display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary);"></div>
                                    ${dayLabel}
                                </div>
                                <div class="timeline" style="position: relative; padding-left: 20px; border-left: 3px solid ${timelineBorder}; margin-left: 10px;">
                            `;
                    dayTasks.forEach(t => { html += renderMobileTaskCard(t, dateStr, mode, dk, cardBg, textColor, subtleBorder, timelineBorder, chipBg, doneCardBg, doneBorder, normalBorder, dotBorderColor); });
                    html += `</div></div>`;
                });
            }
        }

        html += `
                </div>
            </div>
        `;
        document.getElementById('list-content').innerHTML = html;

        window.openMobileTaskDetailModal = (title, desc) => {
            const _dk = document.documentElement.getAttribute('data-theme') === 'dark';
            const _modalBg = _dk ? '#1C1C1E' : undefined; // uses .modal-box CSS by default
            const _titleColor = _dk ? '#FFFFFF' : '#1c1c1e';
            const _descBg = _dk ? '#2C2C2E' : '#f2f2f7';
            const _descColor = _dk ? '#E5E5EA' : '#3a3a3c';
            const _borderColor = _dk ? '#38383A' : '#f2f2f7';
            const _closeBtnBg = _dk ? '#FFFFFF' : '#1c1c1e';
            const _closeBtnColor = _dk ? '#000000' : '#FFFFFF';

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.zIndex = "10000";
            modal.innerHTML = `
                <div class="modal-box" style="padding: 24px; border-radius: 28px; animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); text-align: left;">
                    <div style="font-weight: 800; font-size: 22px; margin-bottom: 8px; color: ${_titleColor};">Détails</div>
                    <div style="font-weight: 700; color: #2da140; margin-bottom: 20px; font-size: 17px; line-height: 1.4; border-bottom: 1px solid ${_borderColor}; padding-bottom: 12px;">${title}</div>
                    
                    <div style="background: ${_descBg}; padding: 20px; border-radius: 20px; color: ${_descColor}; font-size: 16px; line-height: 1.6; white-space: pre-wrap; max-height: 45vh; overflow-y: auto; text-align: left; min-height: 60px;">${desc}</div>
                    
                    <div style="margin-top: 24px;">
                        <button class="btn" style="background: ${_closeBtnBg}; color: ${_closeBtnColor}; width: 100%; border-radius: 18px; padding: 16px; font-size: 17px;" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        };

        window.toggleMobileTaskDone = async (taskId, isChecked, date) => {
            try {
                await api.updateTask(taskId, { done: isChecked ? 'true' : 'false' });
                renderMobilePlanning(date, mode);
            } catch (e) {
                alert("Erreur: " + e.message);
            }
        };

    } catch (e) {
        console.error(e);
        document.getElementById('list-content').innerHTML = `<div style="color:red; margin:20px; padding: 16px; background: #ffe5e5; border-radius: 12px; border: 1px solid #ffcccc;">Erreur: ${e.message}</div>`;
    }
};

// Helper to render task card
function renderMobileTaskCard(t, dateStr, mode, dk, cardBg, textColor, subtleBorder, timelineBorder, chipBg, doneCardBg, doneBorder, normalBorder, dotBorderColor) {
    const parts = t.title.split(':::DESC:::');
    const mainTitle = parts[0];
    const desc = parts[1] || '';
    const isAllDay = (t.start_time.indexOf('00:00') === 0 && t.end_time.indexOf('00:00') === 0);
    const isDone = t.done === 'true';

    return `
        <div style="position: relative; margin-bottom: 24px;">
            <div style="position: absolute; left: -28px; top: 18px; width: 14px; height: 14px; border-radius: 50%; background: ${isDone ? '#8e8e93' : '#2da140'}; border: 4px solid ${dotBorderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
            
            <div style="background: ${isDone ? doneCardBg : cardBg}; border: 1px solid ${isDone ? doneBorder : normalBorder}; border-left: 5px solid ${isDone ? '#8e8e93' : '#2da140'}; border-radius: 16px; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,${dk ? '0.3' : '0.05'}); opacity: ${isDone ? '0.75' : '1'};">
                <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    ${!isAllDay ? `<div style="font-size: 13px; color: ${isDone ? '#8e8e93' : '#2da140'}; font-weight: 700;">🕒 ${t.start_time.substring(0, 5)} - ${t.end_time.substring(0, 5)}</div>` : '<div></div>'}
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight:600; color: ${isDone ? '#2da140' : '#8e8e93'}; background: ${chipBg}; padding: 4px 10px; border-radius: 20px;">
                        <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleMobileTaskDone('${t.id}', this.checked, '${dateStr}', '${mode}')" style="accent-color: #2da140; width: 16px; height: 16px;">
                        ${isDone ? 'Fait' : 'À faire'}
                    </label>
                </div>
                <div style="font-weight: 700; font-size: 17px; color: ${textColor}; text-decoration: ${isDone ? 'line-through' : 'none'};">${window.escapeHTML(mainTitle)}</div>
                
                ${desc ? `
                <button style="background: transparent; color: #007aff; font-weight: 600; border: none; padding: 12px 0 0 0; font-size: 14px; cursor: pointer;" onclick="openMobileTaskDetailModal('${window.escapeHTML(mainTitle)}', \`${window.escapeHTML(desc).replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">Voir détails</button>
                ` : ''}
            </div>
        </div>
    `;
}

function showMobileRootFiles(docs) {
    mobileCurrentPath = "Autres"; // Fake path for UI
    renderMobileList("Autres", [], docs);
}

function openMobileFolder(folderPath) {
    mobileCurrentPath = folderPath;
    const title = folderPath.split('/').pop();

    // Filter files and subfolders
    const currentPrefix = folderPath + '/';
    const subfolders = new Set();
    const files = [];

    mobileFilesCache.forEach(f => {
        if (!f.key.startsWith(currentPrefix)) return;

        const relative = f.key.substring(currentPrefix.length);
        const parts = relative.split('/');

        if (parts.length > 1) {
            if (parts[0]) subfolders.add(parts[0]);
        } else {
            const name = parts[0];
            if (name && !name.startsWith('.meta') && !name.endsWith('.keep')) {
                files.push(f);
            }
        }
    });

    renderMobileList(title, Array.from(subfolders).sort(), files);
}

function renderMobileList(title, subfolders, files) {
    // Switch Views
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    document.querySelector('.mobile-search-container').classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');

    // Update Title
    document.getElementById('selected-category-title').innerText = title;

    // Show upload button if inside a real folder (not the fake 'Autres' view)
    const uploadBtn = document.getElementById('mobile-upload-btn');
    if (uploadBtn) {
        uploadBtn.style.display = mobileCurrentPath && mobileCurrentPath !== 'Autres' ? 'flex' : 'none';
    }

    const container = document.getElementById('list-content');
    container.innerHTML = '';

    // Drag & Drop zone on container
    container.ondragover = (e) => { e.preventDefault(); container.style.outline = '2px dashed var(--primary-color, #2da140)'; };
    container.ondragleave = () => { container.style.outline = ''; };
    container.ondrop = async (e) => {
        e.preventDefault();
        container.style.outline = '';
        if (e.dataTransfer.files.length > 0 && mobileCurrentPath && mobileCurrentPath !== 'Autres') {
            const filesToUpload = await promptForFileNamesAndReturn(e.dataTransfer.files);
            addToUploadQueue(filesToUpload, mobileCurrentPath + '/');
        }
    };

    // Render Subfolders
    subfolders.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'document-item';
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div style="display:flex; align-items:center;">
                <div style="font-size:24px; margin-right:12px;">📁</div>
                <div class="document-info">
                    <span class="document-name" style="font-weight:600">${sub}</span>
                </div>
            </div>
            <div style="color:var(--primary-color)">›</div>
        `;
        item.onclick = () => openMobileFolder(mobileCurrentPath + '/' + sub);
        container.appendChild(item);
    });

    // Render Files
    files.forEach(doc => {
        renderMobileDocItem(doc, container);
    });

    if (subfolders.length === 0 && files.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#8E8E93">
                <div style="font-size:48px; margin-bottom:12px;">📂</div>
                <div style="font-weight:600; margin-bottom:8px;">Dossier vide</div>
                <div style="font-size:13px; margin-bottom:20px;">Appuyez sur "Upload" ou glissez des fichiers ici</div>
            </div>`;
    }
}

function renderMobileDocItem(doc, container) {
    const item = document.createElement('div');
    item.className = 'document-item';
    item.onclick = () => window.open(`${config.api.workerUrl}/get/${doc.key}`, '_blank');

    const fullName = doc.key.split('/').pop();
    const extDot = fullName.includes('.') ? '.' + fullName.split('.').pop() : '';
    const baseName = fullName.includes('.') ? fullName.slice(0, fullName.lastIndexOf('.')) : fullName;
    const maxBase = 25 - 3 - extDot.length; // 25 total − '...' − extension
    const displayName = fullName.length > 25
        ? baseName.substring(0, Math.max(maxBase, 1)) + '...' + extDot
        : fullName;
    const ext = extDot.replace('.', '').toLowerCase();
    let icon = '📄';
    if (['pdf'].includes(ext)) icon = '📕';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) icon = '🖼️';
    if (['doc', 'docx'].includes(ext)) icon = '📘';
    if (['xls', 'xlsx', 'csv'].includes(ext)) icon = '📊';

    item.innerHTML = `
        <div style="display:flex; align-items:center;">
            <div style="font-size:24px; margin-right:12px;">${icon}</div>
            <div class="document-info">
                <span class="document-name" title="${fullName}">${displayName}</span>
                <span class="document-meta">${(doc.size / 1024).toFixed(1)} KB</span>
            </div>
        </div>
        <div class="doc-download-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        </div>
    `;
    container.appendChild(item);
}


// --- Admin View (Desktop) ---
let adminCurrentFolder = null; // Track current view
let adminFilesCache = []; // Cache files to avoid re-fetching
let currentAdminSession = null;

async function renderAdminView(session) {
    currentAdminSession = session;
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
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminUsers()" id="nav-users">👥 Utilisateurs</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminPlanning()" id="nav-planning">📅 Planning</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminPointage()" id="nav-pointage">📝 Pointage Intelligent</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminOvertime()" id="nav-overtime">⏳ Heures Supplémentaires</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminConges()" id="nav-conges" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🌴 Congés</span>
                    <span id="conges-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminRTT()" id="nav-rtt" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>⚡ RTT</span>
                    <span id="rtt-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4); animation: pulse-red 2s infinite;">0</span>
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
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMaintenance()" id="nav-maintenance">🛠️ Maintenance Matériel</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminHTTorques()" id="nav-ht-torques" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>⚡ Couples de Serrage HT</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminNotifications()" id="nav-notifications">🔔 Notifications</a>
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
                'HT': ['nav-material-stock', 'nav-material-stock-gt', 'nav-maintenance'],
                // 'NOUVEAU_SECTEUR': ['nav-xyz', 'nav-abc'],
            };
            // ────────────────────────────────────────────────────────────────────────
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

    // Update material requests notification badge + auto refresh every 30s
    if (window.materialBadgeInterval) clearInterval(window.materialBadgeInterval);
    window.updateMaterialBadge();
    window.updateMaterialStockBadge();
    window.updateCongesBadge();
    window.updateRTTBadge();
    window.materialBadgeInterval = setInterval(() => {
        window.updateMaterialBadge();
        window.updateMaterialStockBadge();
        window.updateCongesBadge();
        window.updateRTTBadge();
    }, 30000);
}

function setActiveNav(navId) {
    adminCurrentFolder = null;
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

// Global scope for admin functions
window.renderAdminAbout = async function () {
    adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-about').classList.add('active');

    const content = document.getElementById('admin-content');

    content.innerHTML = `
        <header style="position: sticky; top: -32px; margin: -32px -40px 32px -40px; padding: 32px 40px 20px; background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center;">
            <h1 style="margin: 0;">À Propos & Assistance</h1>
        </header>
        
        <div style="max-width: 900px; margin: 0 auto; padding: 20px;">
            
            <div style="background: rgba(30, 30, 30, 0.95); border-radius: 12px; padding: 30px; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 16px rgba(0,0,0,0.5);">
                <h2 style="margin-top:0; color:var(--primary, #0ca678); font-size: 24px; margin-bottom: 24px;">L'Architecture de Pouchain</h2>
                <p style="color:rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 30px; font-weight: 500;">
                    Bienvenue dans les coulisses ! L'application Pouchain est propulsée par une architecture moderne, rapide et ultra-sécurisée.<br>
                    Voici comment la magie opère entre les trois grands piliers :
                </p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    <!-- Frontend -->
                    <div style="background: rgba(0,0,0,0.7); padding: 20px; border-radius: 8px; border-top: 4px solid #f59f00; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                        <div style="font-size: 40px; margin-bottom: 10px;">✨</div>
                        <h3 style="margin-top: 0; color: white;">L'Interface (Site Web)</h3>
                        <p style="color:rgba(255,255,255,0.85); font-size: 14px; line-height: 1.5;">
                            C'est ce que vous voyez ! Un tableau de bord intelligent qui interagit avec vous de manière fluide. 
                            Aucune donnée sensible n'y est stockée, c'est uniquement le chef d'orchestre visuel.
                        </p>
                    </div>
                    
                    <!-- Cloudflare -->
                    <div style="background: rgba(0,0,0,0.7); padding: 20px; border-radius: 8px; border-top: 4px solid #f76707; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                        <div style="font-size: 40px; margin-bottom: 10px;">🚀</div>
                        <h3 style="margin-top: 0; color: white;">Cloudflare (Le Transporteur)</h3>
                        <p style="color:rgba(255,255,255,0.85); font-size: 14px; line-height: 1.5;">
                            Notre <strong>Worker Cloudflare</strong> agit comme un gardien de sécurité invisible ultra-rapide.<br><br>
                            Il vérifie qui est connecté et accède aux immenses entrepôts <strong>Cloudflare R2</strong>, l'endroit où tous vos fichiers lourds (PDF, Images) sont stockés. La taille limite actuelle est de <strong>10 Go</strong>, mais nous pouvons l'améliorer grandement si nous le souhaitons !
                        </p>
                    </div>
                    
                    <!-- Supabase -->
                    <div style="background: rgba(0,0,0,0.7); padding: 20px; border-radius: 8px; border-top: 4px solid #37b24d; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                        <div style="font-size: 40px; margin-bottom: 10px;">🏦</div>
                        <h3 style="margin-top: 0; color: white;">Supabase (Le Coffre-Fort)</h3>
                        <p style="color:rgba(255,255,255,0.85); font-size: 14px; line-height: 1.5;">
                            C'est notre coffre-fort blindé. Il gère l'authentification (mots de passe cryptés) et la base de données (rôles, profils).<br><br>
                            Grâce à <strong>Row Level Security (RLS)</strong>, chaque donnée est verrouillée et accessible uniquement par les bonnes personnes.
                        </p>
                    </div>
                </div>
            </div>
            
            <div style="background: rgba(30, 30, 30, 0.95); border-radius: 12px; padding: 30px; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 16px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 30px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <h2 style="margin-top:0; color:#007AFF; font-size: 24px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">📲 <span>Application Mobile Pouchain</span></h2>
                    <p style="color:rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 15px; font-weight: 500;">
                        L'application mobile permet aux collaborateurs de saisir leurs pointages hebdomadaires, de faire des demandes de congés et de suivre leurs heures supplémentaires directement sur leur smartphone Android.
                    </p>
                    <p style="color:rgba(255,255,255,0.7); font-size: 14px; line-height: 1.5; margin: 0;">
                        Scannez le QR Code ci-contre avec votre téléphone pour télécharger l'application mobile instantanément.
                    </p>
                </div>
                <div style="background: white; padding: 10px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); flex-shrink: 0; margin: 0 auto;">
                    <img src="qrcode-download.png" alt="Télécharger l'application" style="width: 150px; height: 150px;" />
                </div>
            </div>

            <div style="background: rgba(20, 60, 30, 0.95); border-radius: 12px; padding: 30px; border: 1px solid rgba(55, 178, 77, 0.5); box-shadow: 0 8px 16px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="font-size: 50px;">👨‍💻</div>
                    <div>
                        <h2 style="margin-top: 0; margin-bottom: 8px; color: #fff;">Assistance Technique</h2>
                        <p style="margin: 0; color: rgba(255,255,255,0.9); line-height: 1.5;">En cas de question, de bug ou de besoin d'évolution de la plateforme, n'hésitez pas à contacter le technicien en charge :</p>
                        <div style="margin-top: 15px; font-size: 18px;">
                            <span style="color: #69db7c; font-weight: bold;">Quentin Vert</span> &nbsp;|&nbsp; 
                            📞 <a href="tel:0782697265" style="color: #69db7c; text-decoration: none; font-weight: bold;">07 82 69 72 65</a>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;
};

window.renderAdminPlanning = async function (mondayStr = null, isV2 = false, isRefresh = false) {
    const content = document.getElementById('admin-content');
    if (!content && !isV2) {
        if (currentAdminSession) renderAdminView(currentAdminSession);
        setTimeout(() => window.renderAdminPlanning(mondayStr, isV2), 300);
        return;
    }

    if (window.planningRefreshInterval) clearInterval(window.planningRefreshInterval);

    // Auto-refresh logic
    window.lastAutoSortTime = window.lastAutoSortTime || Date.now();
    window.planningRefreshInterval = setInterval(async () => {
        const navPlanning = document.getElementById('nav-planning');
        if (navPlanning && navPlanning.classList.contains('active')) {
            const isAnyFS = !!document.fullscreenElement || !!document.getElementById('planning-v2-container');
            const currentMonday = document.querySelector('[data-monday]');
            const mondayToUse = currentMonday ? currentMonday.getAttribute('data-monday') : null;

            // 1. Auto-refresh (30s) only if in a fullscreen mode
            if (isAnyFS) {
                const isV2Active = !!document.getElementById('planning-v2-container');
                renderAdminPlanning(mondayToUse, isV2Active, true);
            }

            // 2. Auto-sort every 60 seconds (always if page open)
            const now = Date.now();
            if (now - window.lastAutoSortTime > 60000) {
                window.lastAutoSortTime = now;
                console.log("Auto-tri du planning en arrière-plan...");
                const isV2Active = !!document.getElementById('planning-v2-container');
                await window.autoSortPlanningUsers(mondayToUse, isV2Active, true); // isSilent = true
                if (!isAnyFS) {
                    renderAdminPlanning(mondayToUse, false, true);
                }
            }
        } else {
            clearInterval(window.planningRefreshInterval);
        }
    }, 30000);

    adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-planning');
    if (navItem) navItem.classList.add('active');
    const existingContainer = document.getElementById('planning-v2-container') || document.getElementById('integrated-planning-container');
    const isCurrentlyFullscreen = (!!document.fullscreenElement) || (existingContainer && existingContainer.id === 'planning-v2-container') || (new URLSearchParams(window.location.search).get('fullscreen'));

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
        try { closedDays = await api.getPlanningClosedDays(); } catch (e) { }
        window.currentClosedDays = closedDays;

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
                    border-bottom: 3px solid #2da140 !important;
                    margin-bottom: 0 !important;
                    padding: 20px 50px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
                }
                .planning-fullscreen header h1 { font-size: 28px !important; color: #2da140 !important; letter-spacing: 1px; }
                .planning-fullscreen header span { font-size: 22px !important; color: #495057 !important; }
                .planning-fullscreen .p-header-controls { display: none !important; }

                .planning-fullscreen #planning-scroll-area { padding: 0 !important; }
                .planning-fullscreen .p-grid-bg { background: #ffffff !important; border: none !important; border-radius: 0 !important; height: 100% !important; }

                .planning-fullscreen .p-head {
                    background: #f1f3f5 !important;
                    color: #2da140 !important;
                    border-color: #dee2e6 !important;
                    font-size: 20px !important;
                    font-weight: 700 !important;
                    padding: 16px 0 !important;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 2px solid #2da140 !important;
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
                #planning-scroll-area::-webkit-scrollbar-thumb { background: #2da14033; border-radius: 4px; }
                #planning-scroll-area::-webkit-scrollbar-thumb:hover { background: #2da14066; }

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

                /* ===== FULLSCREEN V2: Planning (3/4) + Slideshow (1/4) ===== */
                #planning-v2-container {
                    display: none;
                    position: fixed;
                    top: 0; left: 0;
                    width: 100vw; height: 100vh;
                    z-index: 100000;
                    background: #f8f9fa;
                    flex-direction: row;
                    overflow: hidden;
                }
                #planning-v2-container.active { display: flex; }
                #p-v2-main { flex: 3; display: flex; flex-direction: column; overflow: hidden; border-right: 2px solid #ddd; background: #fff; }
                #p-v2-side { flex: 1; min-width: 400px; background: #000; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
                #p-v2-slideshow { width: 100%; height: 100%; object-fit: contain; transition: opacity 0.5s ease-in-out; background: #000; }
                #p-v2-pdfviewer { width: 100%; height: 100%; border: none; display: none; }
                
                .v2-exit-btn {
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
                .v2-exit-btn:hover { background: rgba(255,0,0,0.7); }
                
                /* Classic Fullscreen: Hide footer */
                .planning-fullscreen #planning-footer-config { display: none !important; }
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
                <header style="z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 20px 40px; background: rgba(0,0,0,0.2); margin-bottom: 10px;">
                    <h1 style="margin: 0; display:flex; align-items:center; gap: 15px; font-size: 20px; color: white !important;">
                        📅 Planning Semaine
                    </h1>
                    <div style="display:flex; gap: 20px; align-items:center;">
                        <button onclick="changePlanningWeek('${startStr}', -7)" style="height: 40px; width: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #2da140; color: white; border: none; font-size: 16px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#258535'" onmouseout="this.style.background='#2da140'">◀</button>
                        <div style="display: flex; align-items: center; gap: 25px; color: #495057;">
                            <div style="font-weight: 700; font-size: 18px; letter-spacing: 0.5px;">Du ${displayStart} au ${displayEnd}</div>
                            <div style="font-weight: 900; font-size: 28px; color: #2da140; background: rgba(45,161,64,0.08); padding: 5px 15px; border-radius: 10px; border: 1px solid rgba(45,161,64,0.15);">S${window.getISOWeekNumber(startStr)}</div>
                        </div>
                        <button onclick="changePlanningWeek('${startStr}', 7)" style="height: 40px; width: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #2da140; color: white; border: none; font-size: 16px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#258535'" onmouseout="this.style.background='#2da140'">▶</button>
                    </div>
                    <div style="display:flex; align-items:center; gap: 20px;">
                        <div id="fullscreen-clock" style="font-size: 24px; font-weight: 900; color: #2da140; background: rgba(45, 161, 64, 0.08); border: 1px solid rgba(45, 161, 64, 0.15); padding: 5px 15px; border-radius: 10px; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 40px; box-sizing: border-box;">
                            ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div class="p-header-controls" style="display:flex; gap: 12px; align-items: center;">
                            <button class="btn-sm btn-secondary" onclick="openPlanningExportModal()" title="Exporter les données du planning">📤 Export</button>
                            <button class="btn-secondary" onclick="togglePlanningFullscreen()" id="fullscreen-btn" title="Activer/Désactiver le plein écran">⛶ TV</button>
                            <button class="btn-sm btn-secondary" onclick="togglePlanningFullscreenV2()" id="fullscreen-v2-btn" title="Plein Écran N°2 (Planning + Diaporama)">🖥️ V2</button>
                            <button class="btn-primary" onclick="openNewTaskModal('${startStr}')">+ Tâche</button>
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
                style = 'background-color: #2da140 !important; color: #fff !important; border-bottom: 3px solid #fff !important; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.1);';
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
            const userColor = u.color ? u.color : '#2da140';

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
                    cellStyle = 'background: rgba(45, 161, 64, 0.15) !important;';
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

        // --- Fullscreen V2 (Planning 75% + Slideshow 25%) injection point ---
        const v2Container = document.getElementById('planning-v2-container');
        if (v2Container && v2Container.classList.contains('active')) {
            const v2Main = document.getElementById('p-v2-main');
            if (v2Main) {
                // In Fullscreen V2, we force the planning area to look like the secondary mode
                v2Main.innerHTML = `
                    <div id="planning-fullscreen-container" class="planning-fullscreen" data-monday="${startStr}" style="height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden;">
                        ${finalContent}
                    </div>
                `;
                return;
            }
        }

        // --- Integrated Slideshow Configuration Section (Bottom of Planning) ---
        let fsConfig = { timer: 10, files: [] };
        try {
            const saved = localStorage.getItem('planning_fs_config');
            if (saved) fsConfig = JSON.parse(saved);
        } catch (e) { }

        const slideshowConfigHTML = `
            <div id="integrated-fs-config" style="display: flex; align-items: center; gap: 40px; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">📺 Slideshow <small style="font-weight: 400; opacity: 0.5;">(V2)</small></h2>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="btn-sm btn-secondary" onclick="openFSDocPicker()" style="background: rgba(255,255,255,0.05); font-size: 10px; padding: 4px 10px;">Cloud</button>
                        <button class="btn-sm btn-primary" onclick="document.getElementById('fs-upload-input').click()" style="font-size: 10px; padding: 4px 10px;">Upload</button>
                        <input type="file" id="fs-upload-input" style="display:none;" multiple accept="image/*,application/pdf" onchange="handleFSDirectUpload(this)">
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.02); padding: 10px 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <label style="font-weight: 700; color: var(--primary); font-size: 11px; text-transform: uppercase;">⏱️ Temporisation</label>
                    <input type="number" id="fs-timer" class="form-input" value="${fsConfig.timer}" min="3" style="width: 60px; text-align: center; height: 30px; font-size: 13px;" onchange="saveFSConfig(true)">
                    <button class="btn-primary" onclick="saveFSConfig()" style="height: 30px; font-size: 11px; padding: 0 15px;">💾</button>
                </div>

                <div id="fs-files-mini-grid" style="flex: 1; display: flex; gap: 10px; overflow-x: auto; padding: 5px; scrollbar-width: thin;">
                    ${fsConfig.files.map((f, i) => {
            const isPdf = f.toLowerCase().endsWith('.pdf');
            const url = `${config.api.workerUrl}/get/${f}`;
            return `
                            <div style="position: relative; height: 60px; aspect-ratio: 16/10; background: #000; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
                                ${isPdf ? `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background: #1a1a1a; font-size: 14px;">📕</div>` : `<img src="${url}" loading="lazy" style="width:100%; height:100%; object-fit: cover;">`}
                                <button onclick="removeFSFile(${i})" style="position:absolute; top:2px; right:2px; background: rgba(220,38,38,0.9); border:none; color:white; width:18px; height:18px; border-radius:4px; cursor:pointer; font-size:9px;">✕</button>
                            </div>
                        `;
        }).join('')}
                    ${fsConfig.files.length === 0 ? `<div style="color: #666; font-size: 12px; font-style: italic; align-self: center;">Aucun document</div>` : ''}
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
    } catch (e) {
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

window.togglePlanningFullscreen = function () {
    // In the main window, open a NEW window. In the FS window, just toggle.
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('fullscreen')) {
        window.open('dashboard.html?fullscreen=1', '_blank', 'noopener,noreferrer');
        return;
    }

    const el = document.getElementById('integrated-planning-container');
    const scrollArea = document.getElementById('planning-scroll-area');
    if (!el) return;

    if (!document.fullscreenElement) {
        el.classList.remove('planning-inline');
        el.classList.add('planning-fullscreen');
        if (scrollArea) scrollArea.style.padding = '0 40px 20px 40px';
        el.requestFullscreen().catch(err => {
            console.warn(`Erreur plein écran: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
};

window.showFullscreenOverlay = function (mode) {
    const overlay = document.createElement('div');
    overlay.id = 'fs-interaction-overlay';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999999; background:#000; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-family: sans-serif;";
    overlay.innerHTML = `
        <img src="logo-pouchain.svg" style="width: 200px; margin-bottom: 40px;">
        <h1 style="font-size: 32px; margin-bottom: 20px;">Mode Plein Écran ${mode === '2' ? 'N°2' : ''}</h1>
        <p style="font-size: 18px; color: #888; margin-bottom: 50px;">Pour activer l'affichage correct du planning :</p>
        <div style="padding: 20px 40px; border: 2px solid #2da140; border-radius: 12px; background: rgba(45, 161, 64, 0.1); animation: pulse 2s infinite;">
            <p style="font-size: 24px; font-weight: bold; margin: 0; color: #2da140;">Appuyez sur ENTRÉE</p>
        </div>
        <style>
            @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        </style>
    `;
    document.body.appendChild(overlay);

    const handleKey = (e) => {
        if (e.key === 'Enter') {
            document.removeEventListener('keydown', handleKey);
            overlay.remove();
            if (mode === '2') {
                window.togglePlanningFullscreenV2();
            } else {
                window.togglePlanningFullscreen();
            }
        }
    };
    document.addEventListener('keydown', handleKey);
};

// Listen for fullscreen exit to restore padding safely
document.addEventListener('fullscreenchange', () => {
    const el = document.getElementById('integrated-planning-container');
    const scrollArea = document.getElementById('planning-scroll-area');
    const urlParams = new URLSearchParams(window.location.search);

    if (el && !document.fullscreenElement) {
        el.classList.remove('planning-fullscreen');
        el.classList.add('planning-inline');
        if (scrollArea) scrollArea.style.padding = '0 20px 20px 20px'; // restore

        // If we in a dedicated FS window and we exit FS, maybe we should close or show the button?
        // For now we just stay.
    }
});

// --- Fullscreen V2 Logic (Split Screen) ---
window.togglePlanningFullscreenV2 = function () {
    // In the main window, open a NEW window. In the FS window, just toggle.
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('fullscreen')) {
        window.open('dashboard.html?fullscreen=2', '_blank', 'noopener,noreferrer');
        return;
    }

    let v2 = document.getElementById('planning-v2-container');

    // If opening
    if (!v2) {
        v2 = document.createElement('div');
        v2.id = 'planning-v2-container';
        v2.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:999999; background:#fff; display:flex; overflow:hidden;";
        v2.innerHTML = `
            <div id="p-v2-main" style="flex:3; height:100%; overflow:hidden; border-right:2px solid #ddd; display:flex; flex-direction:column; background:#fff;"></div>
            <div id="p-v2-side" style="flex:1; height:100%; min-width:400px; background:#000; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                <button class="v2-exit-btn" onclick="togglePlanningFullscreenV2()" style="position:absolute; top:20px; right:20px; z-index:1001; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:44px; height:44px; cursor:pointer; font-size:24px; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); transition:0.2s;">×</button>
                <img id="p-v2-slideshow" src="logo-pouchain.svg" style="max-width:100%; max-height:100%; object-fit:contain; transition:opacity 0.6s ease-in-out; background:#000;">
                <iframe id="p-v2-pdfviewer" style="width:100%; height:100%; border:none; display:none;"></iframe>
            </div>
        `;
        document.body.appendChild(v2);
        v2.classList.add('active');
        v2.requestFullscreen().catch(e => console.warn("FS failed", e));

        startSlideshow();
        renderAdminPlanning(window.currentPlanningMonday, true); // Render grid into p-v2-main
    } else {
        // Closing
        v2.classList.remove('active');
        stopSlideshow();
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        setTimeout(() => {
            if (v2 && v2.parentNode) v2.parentNode.removeChild(v2);
            renderAdminPlanning(window.currentPlanningMonday);
        }, 300);
    }
};

let slideInterval = null;
function startSlideshow() {
    if (slideInterval) clearInterval(slideInterval);

    const configStr = localStorage.getItem('planning_fs_config');
    let fsConfig = { timer: 10, files: [] };
    try {
        if (configStr) fsConfig = JSON.parse(saved);
    } catch (e) {
        // Fallback to reading the one we just saved if local storage parse fails
        try { fsConfig = JSON.parse(localStorage.getItem('planning_fs_config')); } catch (e2) { }
    }

    const img = document.getElementById('p-v2-slideshow');
    const pdf = document.getElementById('p-v2-pdfviewer');
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

        const url = `${config.api.workerUrl}/get/${fileKey.replace(/^\/+/, '')}`;
        const isPdf = fileKey.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            if (img) img.style.display = 'none';
            if (pdf) {
                pdf.style.display = 'block';
                pdf.src = url;
            }
        } else {
            if (pdf) { pdf.style.display = 'none'; pdf.src = ''; }
            if (img) {
                img.style.display = 'block';
                // Direct update is more reliable than preloading for debugging
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
        slideInterval = setInterval(showNext, Math.max(fsConfig.timer || 10, 3) * 1000);
    }
}

function stopSlideshow() {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = null;
}

window.handleFSDirectUpload = async function (input) {
    if (!input.files || input.files.length === 0) return;

    const btn = document.querySelector('button[onclick*="fs-upload-input"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Téléchargement...";

    try {
        const config = JSON.parse(localStorage.getItem('planning_fs_config') || '{"timer":10,"files":[]}');

        for (const file of input.files) {
            // The API returns the full key (path + filename)
            const res = await api.uploadFile(file, 'fullscreen_slides/');
            if (res && res.key && !config.files.includes(res.key)) {
                config.files.push(res.key);
            }
        }

        localStorage.setItem('planning_fs_config', JSON.stringify(config));
        showSuccessModal(`${input.files.length} fichier(s) ajouté(s) au diaporama.`);

        // Sync live V2
        if (document.getElementById('planning-v2-container')) {
            stopSlideshow();
            startSlideshow();
        }

        renderAdminPlanning(window.currentPlanningMonday);
    } catch (e) {
        alert("Erreur lors du téléchargement : " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
        input.value = ''; // Reset input
    }
};

window.openFSDocPicker = async function () {
    const allFiles = await api.listFiles();
    const images = allFiles.filter(f => {
        const ext = f.key.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext);
    });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '1000001';
    overlay.innerHTML = `
        <div class="modal-box glass-panel" style="width: 700px; max-height: 85vh; display: flex; flex-direction: column; padding:0; border: 1px solid rgba(255,255,255,0.1); background: #1a1a1a;">
            <div class="modal-header" style="padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight:800; font-size:18px;">☁️ Documents sur Cloudflare</div>
            <div style="overflow-y: auto; flex: 1; padding: 20px 30px;">
                <input type="text" id="fs-picker-search" placeholder="Rechercher un fichier..." class="form-input" style="margin-bottom: 20px; width: 100%;" oninput="window.filterFSPicker(this.value)">
                
                <div style="margin-bottom: 15px; font-size: 11px; text-transform: uppercase; color: var(--primary); font-weight: 800; letter-spacing: 1px;">📁 Dossier : fullscreen_slides/</div>
                <div id="fs-picker-list-preferred" style="margin-bottom: 30px; display: grid; grid-template-columns: 1fr; gap: 8px;">
                    ${images.filter(f => f.key.startsWith('fullscreen_slides/')).map(f => `
                        <label style="display:flex; align-items:center; gap:12px; padding: 12px 15px; border-radius: 8px; cursor: pointer; background: rgba(45, 161, 64, 0.05); border: 1px solid rgba(45, 161, 64, 0.1); transition: 0.2s;">
                            <input type="checkbox" class="fs-pick-cb" value="${f.key}">
                            <span style="font-size: 14px; color: #eee; font-family: monospace;">${f.key.replace('fullscreen_slides/', '')}</span>
                        </label>
                    `).join('') || '<div style="color: #444; font-style: italic; padding-left: 15px;">Aucun fichier dans ce dossier</div>'}
                </div>

                <div style="margin-bottom: 15px; font-size: 11px; text-transform: uppercase; color: #666; font-weight: 800; letter-spacing: 1px;">📂 Autres fichiers</div>
                <div id="fs-picker-list-other" style="display: grid; grid-template-columns: 1fr; gap: 4px;">
                    ${images.filter(f => !f.key.startsWith('fullscreen_slides/')).map(f => `
                        <label style="display:flex; align-items:center; gap:12px; padding: 8px 15px; border-radius: 6px; cursor: pointer; transition: 0.2s; border: 1px solid transparent;">
                            <input type="checkbox" class="fs-pick-cb" value="${f.key}">
                            <span style="font-size: 12px; color: #888;">${f.key}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer" style="padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.1);">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button class="btn-primary" onclick="window.addSelectedFSDocs()">Ajouter la sélection</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    window.filterFSPicker = (val) => {
        const q = val.toLowerCase();
        document.querySelectorAll('#fs-picker-list-preferred label, #fs-picker-list-other label').forEach(l => {
            const txt = l.innerText.toLowerCase();
            l.style.display = txt.includes(q) ? 'flex' : 'none';
        });
    };
};

window.addSelectedFSDocs = function () {
    const selected = Array.from(document.querySelectorAll('.fs-pick-cb:checked')).map(cb => cb.value);
    const configStr = localStorage.getItem('planning_fs_config') || '{"timer":10,"files":[]}';
    const fsConfig = JSON.parse(configStr);

    fsConfig.files = [...new Set([...fsConfig.files, ...selected])];
    localStorage.setItem('planning_fs_config', JSON.stringify(fsConfig));

    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();

    showSuccessModal(`${selected.length} document(s) ajouté(s).`);

    // Sync live V2
    if (document.getElementById('planning-v2-container')) {
        stopSlideshow();
        startSlideshow();
    }

    renderAdminPlanning(window.currentPlanningMonday);
};


window.removeFSFile = function (index) {
    const config = JSON.parse(localStorage.getItem('planning_fs_config') || '{"timer":10,"files":[]}');
    config.files.splice(index, 1);
    localStorage.setItem('planning_fs_config', JSON.stringify(config));

    // Sync live V2
    if (document.getElementById('planning-v2-container')) {
        stopSlideshow();
        startSlideshow();
    }

    renderAdminPlanning(window.currentPlanningMonday);
};

window.saveFSConfig = function (silent = false) {
    const timer = parseInt(document.getElementById('fs-timer').value) || 10;
    const config = JSON.parse(localStorage.getItem('planning_fs_config') || '{"timer":10,"files":[]}');
    config.timer = timer;
    localStorage.setItem('planning_fs_config', JSON.stringify(config));

    // Sync live V2
    if (document.getElementById('planning-v2-container')) {
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
                            <label>Date de début <span id="week-num-display" style="margin-left: 10px; font-weight: 800; color: #2da140; font-size: 12px; text-transform: uppercase;">Semaine ${window.getISOWeekNumber(defaultDateStr)}</span></label>
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
                        <label>Date <span id="edit-week-num-display" style="margin-left: 10px; font-weight: 800; color: #2da140; font-size: 12px; text-transform: uppercase;">Semaine ${window.getISOWeekNumber(task.date)}</span></label>
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

window.renderAdminUsers = async function () {
    const content = document.getElementById('admin-content');
    if (!content) {
        if (currentAdminSession) renderAdminView(currentAdminSession);
        return;
    }

    adminCurrentFolder = null; // Clear folder view state
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-users').classList.add('active');
    content.innerHTML = '<div style="text-align:center; margin-top:50px;">Chargement des utilisateurs...</div>';

    try {
        const users = await api.listUsers(true);

        content.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 20px; background: rgba(0,0,0,0.1); backdrop-filter: blur(40px); border-radius: 24px;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: rgba(0,0,0,0.4); padding: 15px 25px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.2);">
                        <span style="font-size: 28px;">👥</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Gestion des Utilisateurs</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Administration des comptes et accès</p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn-primary" onclick="openNewUserModal()" style="border-radius: 12px; height: 46px; padding: 0 20px; background: #6366f1; font-weight: 700; display: flex; align-items: center; gap: 10px; border: none; color: white; cursor: pointer; transition: all 0.2s;">
                        <span style="font-size: 18px;">+</span> Nouvel Utilisateur
                    </button>
                    <button onclick="window.renderAdminUsers()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

                <div class="table-container users-table-container">
                    <table class="users-table">
                        <thead>
                            <tr>
                                <th>Prénom</th>
                                <th>Nom</th>
                                <th>Email</th>
                                <th>Rôle</th>
                                <th>Secteur</th>
                                <th>Date Création</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => {
            const safeFirstName = window.escapeHTML(u.first_name || '-');
            const safeLastName = window.escapeHTML(u.last_name || '-');
            const safeEmail = window.escapeHTML(u.email);
            const jsFirstName = (u.first_name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const jsLastName = (u.last_name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const jsEmail = (u.email || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const userColor = u.color ? u.color : '#2da140';
            return `
                            <tr>
                                <td><div style="display:flex; align-items:center; gap:8px;"><div style="width:12px; height:12px; border-radius:50%; background-color:${userColor};" title="Couleur Planning"></div> ${safeFirstName}</div></td>
                                <td>${safeLastName}</td>
                                <td>${safeEmail}</td>
                                <td>
                                    ${currentAdminSession && currentAdminSession.user.email === u.email
                    ? `<span class="badge" style="background:${u.role === 'admin' ? 'var(--badge-admin-bg)' : (u.role === 'visiteur' ? '#8E8E93' : 'var(--badge-user-bg)')}; color:${u.role === 'admin' ? 'var(--badge-admin-text)' : 'white'}">${u.role}</span>`
                    : `<select class="form-input" style="padding: 4px 8px; font-size: 13px; width: auto;" onchange="changeUserRole('${u.id}', this.value)">
                                             <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
                                             <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                                            </select>`
                }
                                 </td>
                                 <td>
                                     <span class="badge" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);">${window.escapeHTML(u.secteur || 'Tout')}</span>
                                 </td>
                                 <td>
                                     <span class="badge" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);">${window.escapeHTML(u.societe || 'Pouchain')}</span>
                                 </td>
                                 <td>${new Date(u.created_at).toLocaleDateString()}</td>
                                 <td>
                                     <button class="btn-sm btn-view" onclick="openEditUserModal('${u.id}', '${jsFirstName}', '${jsLastName}', '${userColor}', '${u.secteur || 'Tout'}', '${u.societe || 'Pouchain'}')" title="Modifier le nom">✏️ Editer</button>
                                    ${currentAdminSession && currentAdminSession.user.email === u.email
                    ? `<button class="btn-sm btn-view" onclick="openChangePasswordModal()" title="Changer mon mot de passe">🔑 Changer Mdp</button>
                                           <span style="color: #8E8E93; font-size: 13px; padding: 6px 12px;">(Vous)</span>`
                    : `<button class="btn-sm btn-view" onclick="openAdminChangePasswordModal('${u.id}', '${jsFirstName}', '${jsLastName}', '${jsEmail}')" title="Changer le mot de passe manuellement">🔑 Changer Mdp</button>
                                           <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}', '${jsEmail}')">Supprimer</button>`
                }
                                </td>
                            </tr>
                        `}).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div style="color:red">Erreur chargement utilisateurs: ${e.message}</div>`;
    }
};

window.openNewUserModal = function () {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'new-user-modal';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">Nouvel Utilisateur</div>
            
            <div class="tabs" style="display:flex; border-bottom:1px solid #e5e5ea; margin-bottom:16px;">
                <div class="tab-item active" id="tab-manual" onclick="switchUserTab('manual')" style="padding:8px 16px; cursor:pointer; border-bottom:2px solid #007AFF;">Manuel</div>
                <div class="tab-item" id="tab-invite" onclick="switchUserTab('invite')" style="padding:8px 16px; cursor:pointer; border-bottom:2px solid transparent;">Invitation</div>
            </div>

            <div style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label>Prénom</label>
                    <input type="text" class="form-input" id="new-user-firstname" placeholder="Jean">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Nom</label>
                    <input type="text" class="form-input" id="new-user-lastname" placeholder="Dupont">
                </div>
            </div>

            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-input" id="new-user-email" placeholder="email@exemple.com">
            </div>

            <div id="manual-fields" style="background:var(--bg-secondary, #f3f4f6); color:#333; padding:12px; border-radius:6px; margin-bottom:16px; font-size:13px; text-align:left;">
                <b>Mot de passe par défaut :</b><br>
                Le mot de passe généré pour ce compte sera <b>123456</b>.<br>
                L'utilisateur sera obligé de le changer lors de sa toute première connexion à l'application.
            </div>

             <div style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label>Rôle</label>
                    <select class="form-input" id="new-user-role">
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Secteur</label>
                    <select class="form-input" id="new-user-secteur">
                        <option value="Tout">Tout</option>
                        <option value="AIA">AIA</option>
                        <option value="HT">HT</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Société</label>
                    <select class="form-input" id="new-user-societe">
                        <option value="Pouchain">Pouchain</option>
                        <option value="CEPP">CEPP</option>
                    </select>
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal('new-user-modal')">Annuler</button>
                <button class="btn-primary" onclick="createNewUser()">Créer / Envoyer</button>
            </div>
        </div>
            `;
    document.body.appendChild(overlay);
};

window.switchUserTab = function (mode) {
    const manualFields = document.getElementById('manual-fields');
    const tabManual = document.getElementById('tab-manual');
    const tabInvite = document.getElementById('tab-invite');
    const btn = document.querySelector('#new-user-modal .btn-primary');

    if (mode === 'manual') {
        manualFields.style.display = 'block';
        tabManual.style.borderBottomColor = '#007AFF';
        tabInvite.style.borderBottomColor = 'transparent';
        btn.innerText = "Créer";
        document.getElementById('new-user-modal').setAttribute('data-mode', 'manual');
    } else {
        manualFields.style.display = 'none';
        tabManual.style.borderBottomColor = 'transparent';
        tabInvite.style.borderBottomColor = '#007AFF';
        btn.innerText = "Envoyer Invitation";
        document.getElementById('new-user-modal').setAttribute('data-mode', 'invite');
    }
};

window.createNewUser = async function () {
    const firstName = document.getElementById('new-user-firstname').value.trim();
    const lastName = document.getElementById('new-user-lastname').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const role = document.getElementById('new-user-role').value;
    const secteur = document.getElementById('new-user-secteur').value;
    const societe = document.getElementById('new-user-societe').value;
    const mode = document.getElementById('new-user-modal').getAttribute('data-mode') || 'manual';

    if (!email) return alert("Veuillez remplir l'email.");
    if (!firstName || !lastName) return alert("Veuillez remplir le prénom et le nom.");


    try {
        // Calculate Redirect URL (reset-password.html in same directory)
        const redirectTo = window.location.origin + window.location.pathname.replace('dashboard.html', '') + 'reset-password.html';
        console.log("Sending Invite with Redirect To:", redirectTo);

        if (mode === 'manual') {
            const password = "123456";

            await api.createUser(email, password, role, secteur, firstName, lastName, societe);
            showSuccessModal("Utilisateur créé avec succès !<br><br><span style='font-size:14.5px;color:rgba(100,100,100,0.9); font-weight:normal;'>Le mot de passe temporaire de l'utilisateur est <b>123456</b>.<br>Il sera invité à le changer dès sa première connexion.</span>");
        } else {
            await api.inviteUser(email, role, secteur, redirectTo, firstName, lastName, societe);
            showSuccessModal("Invitation envoyée avec succès !");
        }

        closeModal('new-user-modal');
        renderAdminUsers();
    } catch (e) {
        alert("Erreur : " + e.message);
    }
};


window.showCustomModal = function (title, message, icon = '⚠️', color = 'var(--primary-color)') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'custom-modal-' + Date.now();
    overlay.style.zIndex = '1000000';
    overlay.innerHTML = `
        <div class="modal-box" style="text-align: center; max-width: 450px;">
            <div style="font-size: 64px; margin-bottom: 20px;">${icon}</div>
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 24px; font-weight: 800;">${title}</h3>
            <div style="margin-bottom: 30px; color: var(--text-secondary); line-height: 1.6; font-size: 17px;">${message}</div>
            <button class="btn-primary" style="width: 100%; justify-content: center; height: 50px; border-radius: 25px; font-size: 18px; background-color: ${color};" onclick="this.closest('.modal-overlay').remove()">Compris</button>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.showSuccessModal = function (message) {
    window.showCustomModal("Succès", message, '✅', 'var(--primary-color)');
};

window.showVisitorWelcomeModal = function () {
    window.showCustomModal(
        "Bienvenue (Mode Démo)",
        "Vous êtes connecté en tant que <b>Visiteur</b>.<br><br>Vous pouvez explorer toute l'interface admin, consulter les plannings, les documents et les configurations.<br><br>Cependant, <b>aucune modification de données</b> n'est autorisée avec ce compte.",
        "👋",
        '#007AFF'
    );
};

// Redéfinition globale de alert() pour utiliser nos modales élégantes
const _originalAlert = window.alert;
window.alert = function (message) {
    if (!message) return;
    const msgStr = String(message);
    if (msgStr.includes("Désolé")) {
        window.showCustomModal("Accès Limité", msgStr, '🔒', '#8E8E93');
    } else if (msgStr.includes("Succès") || msgStr.includes("réussi") || msgStr.includes("envoyée") || msgStr.includes("ajoutée")) {
        window.showCustomModal("Succès", msgStr, '✅', 'var(--primary-color)');
    } else {
        window.showCustomModal("Information", msgStr, 'ℹ️', '#007AFF');
    }
};

window.openAdminChangePasswordModal = function (id, firstName, lastName, email) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'admin-change-password-modal';

    const displayName = (firstName && lastName) ? `${firstName} ${lastName} ` : email;

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">Changer le mot de passe</div>
            <p style="margin-bottom: 16px; color: var(--text-secondary);">Changer le mot de passe pour <b>${displayName}</b></p>
            <div class="form-group">
                <label>Nouveau mot de passe</label>
                <input type="password" class="form-input" id="admin-new-password-input" placeholder="Minimum 6 caractères">
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal('admin-change-password-modal')">Annuler</button>
                <button class="btn-primary" onclick="submitAdminChangePassword('${id}')">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.submitAdminChangePassword = async function (id) {
    const newPassword = document.getElementById('admin-new-password-input').value;
    if (!newPassword || newPassword.length < 6) {
        return alert("Veuillez entrer un mot de passe d'au moins 6 caractères.");
    }

    try {
        await api.changeUserPassword(id, newPassword);
        showSuccessModal("Mot de passe mis à jour avec succès.");
        closeModal('admin-change-password-modal');
    } catch (e) {
        alert("Erreur lors du changement de mot de passe : " + e.message);
    }
};

window.showConfirmModal = function (title, message, onConfirm, confirmText = 'Supprimer', confirmClass = 'btn-danger') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'confirm-modal';
    overlay.innerHTML = `
        <div class="modal-box" style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 20px;">${title}</h3>
            <p style="margin-bottom: 24px; color: var(--text-secondary);">${message}</p>
            <div class="modal-actions" style="justify-content: center;">
                <button class="btn-secondary" onclick="closeModal('confirm-modal')">Annuler</button>
                <button class="${confirmClass}" id="confirm-btn">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('confirm-btn').onclick = () => {
        closeModal('confirm-modal');
        onConfirm();
    };
};

window.showPromptModal = function (title, defaultValue, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'prompt-modal';

    overlay.innerHTML = `
        <div class="modal-box">
            <h3>${title}</h3>
            <div class="form-group">
                <input type="text" class="form-input" id="prompt-input" value="${defaultValue}" autofocus>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal('prompt-modal')">Annuler</button>
                <button class="btn-primary" id="prompt-confirm-btn">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('prompt-input');
    input.focus();
    input.select();

    // Allow Enter key to confirm
    input.onkeydown = (e) => {
        if (e.key === 'Enter') document.getElementById('prompt-confirm-btn').click();
    };

    document.getElementById('prompt-confirm-btn').onclick = () => {
        const val = input.value;
        if (val && val.trim() !== "") {
            closeModal('prompt-modal');
            onConfirm(val); // Pass value back
        } else {
            alert("Veuillez entrer une valeur.");
        }
    };
};

window.deleteUser = function (id, email) {
    showConfirmModal(
        "Confirmer la suppression",
        `Voulez - vous vraiment supprimer l'utilisateur <b>${email}</b> ?<br>Cette action est irréversible.`,
        async () => {
            try {
                await api.deleteUser(id);
                // No alert needed for success if list updates? 
                // Let's show a small success modal too for consistency or just refresh
                // "Parfait" message from user suggests they like the popup.
                showSuccessModal("Utilisateur supprimé avec succès.");
                renderAdminUsers();
            } catch (e) {
                alert("Erreur suppression: " + e.message);
            }
        }
    );
};

window.openEditUserModal = function (id, firstName, lastName, color = '#2da140', secteur = 'Tout', societe = 'Pouchain') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'edit-user-modal';

    // We escape names carefully
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">Modifier Profil</div>
            <div style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label>Prénom</label>
                    <input type="text" class="form-input" id="edit-user-firstname" value="${firstName.replace(/"/g, '&quot;').replace(/^-$/, '')}">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Nom</label>
                    <input type="text" class="form-input" id="edit-user-lastname" value="${lastName.replace(/"/g, '&quot;').replace(/^-$/, '')}">
                </div>
            </div>
            <div style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label>Secteur</label>
                    <select class="form-input" id="edit-user-secteur">
                        <option value="Tout" ${secteur === 'Tout' ? 'selected' : ''}>Tout</option>
                        <option value="AIA" ${secteur === 'AIA' ? 'selected' : ''}>AIA</option>
                        <option value="HT" ${secteur === 'HT' ? 'selected' : ''}>HT</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Société</label>
                    <select class="form-input" id="edit-user-societe">
                        <option value="Pouchain" ${societe === 'Pouchain' ? 'selected' : ''}>Pouchain</option>
                        <option value="CEPP" ${societe === 'CEPP' ? 'selected' : ''}>CEPP</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Couleur (Planning)</label>
                <div style="display:flex; align-items:center; gap: 12px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px;">
                    <input type="color" id="edit-user-color" value="${color}" style="width: 40px; height: 40px; border:none; background:transparent; cursor:pointer;">
                    <span style="color:var(--text-secondary); font-size: 13px;">S'applique aux tâches et à la case de ce salarié.</span>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal('edit-user-modal')">Annuler</button>
                <button class="btn-primary" onclick="updateUserProfileName('${id}')">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.updateUserProfileName = async function (id) {
    const firstName = document.getElementById('edit-user-firstname').value.trim();
    const lastName = document.getElementById('edit-user-lastname').value.trim();
    const color = document.getElementById('edit-user-color').value;
    const secteur = document.getElementById('edit-user-secteur').value;
    const societe = document.getElementById('edit-user-societe').value;

    try {
        await api.updateUserProfile(id, firstName, lastName, secteur, societe);
        await api.updateUserColor(id, color);

        showSuccessModal("Profil mis à jour avec succès.");
        closeModal('edit-user-modal');
        // Non-blocking refresh
        renderAdminUsers();

        // If it's our own session, update sidebar
        if (currentAdminSession && currentAdminSession.user.id === id) {
            document.getElementById('admin-welcome-name').textContent = `${firstName} ${lastName}`;
        }
    } catch (e) {
        alert("Erreur lors de la mise à jour du profil : " + e.message);
    }
};

window.openChangePasswordModal = function () {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'change-password-modal';

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">Changer mon mot de passe</div>
            <div class="form-group">
                <label>Nouveau mot de passe</label>
                <input type="password" class="form-input" id="new-password-input" placeholder="Minimum 6 caractères">
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal('change-password-modal')">Annuler</button>
                <button class="btn-primary" onclick="submitChangePassword()">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.submitChangePassword = async function () {
    const newPassword = document.getElementById('new-password-input').value;
    if (!newPassword || newPassword.length < 6) {
        return alert("Veuillez entrer un mot de passe d'au moins 6 caractères.");
    }

    try {
        await auth.updatePassword(newPassword);
        showSuccessModal("Mot de passe mis à jour avec succès.");
        closeModal('change-password-modal');
    } catch (e) {
        alert("Erreur lors du changement de mot de passe : " + e.message);
    }
};

window.changeUserRole = async function (id, newRole) {
    try {
        await api.changeUserRole(id, newRole);
        showSuccessModal("Rôle mis à jour avec succès.");
        // Non-blocking refresh
        renderAdminUsers();
    } catch (e) {
        alert("Erreur lors du changement de rôle : " + e.message);
        renderAdminUsers(); // reset UI
    }
};


async function refreshAdminData() {
    try {
        const [files, vehicles] = await Promise.all([
            api.listFiles(),
            api.getVehicles()
        ]);

        adminFilesCache = files;
        window.adminVehiclesCache = vehicles; // mis en cache pour re-filtrage après chargement du profil
        if (window.updateVehicleSidebarBadge) window.updateVehicleSidebarBadge(vehicles);

        if (adminCurrentFolder) {
            renderAdminFiles(adminCurrentFolder);
        } else {
            renderAdminFolders();
        }
    } catch (e) {
        console.warn("Refresh admin data error:", e);
    }
}

// Helper: build an owner badge supporting 1 or N owners.
// owners: string[] | null  —  tag: 'div' (folder cards) or 'span' (table rows)
function makeOwnerBadge(owners, tag) {
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
window.renderAdminFolders = async function () {
    adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-docs').classList.add('active');

    // Fetch ownership map { path -> 'Prénom Nom' }
    let ownerMap = {};
    try { ownerMap = await api.getAccessSummary(); } catch (e) { /* silently ignore */ }

    // Extract Categories and Colors
    const categories = new Map(); // Name -> { color, count, emoji, order, row }

    // Default Colors
    const palette = ['#FF9500', '#AF52DE', '#5856D6', '#FF2D55', '#5AC8FA', '#34C759', '#FF3B30', '#FFCC00'];

    const secteur = window.currentUserProfile?.secteur || 'AIA';

    // Carte secteurs par dossier (extraite des .meta_sectors_)
    const folderSectorMap = {}; // { folderName: ['AIA','HT'] | null }

    adminFilesCache.forEach(file => {
        const parts = file.key.split('/');
        if (parts.length < 2) return;
        const folderName = parts[0];

        // Extraire les métadonnées secteur
        if (parts[1].startsWith('.meta_sectors_')) {
            folderSectorMap[folderName] = parts[1].replace('.meta_sectors_', '').split(',').filter(Boolean);
            return;
        }

        if (!categories.has(folderName)) {
            categories.set(folderName, { color: null, count: 0, emoji: '📁', order: 999, row: 1 });
        }
        const catData = categories.get(folderName);

        if (parts[1].startsWith('.meta_color_')) {
            catData.color = parts[1].replace('.meta_color_', '#');
        } else if (parts[1].startsWith('.meta_emoji_')) {
            catData.emoji = decodeURIComponent(parts[1].replace('.meta_emoji_', ''));
        } else if (parts[1].startsWith('.meta_order_')) {
            catData.order = parseInt(parts[1].replace('.meta_order_', ''), 10) || 999;
        } else if (parts[1].startsWith('.meta_row_')) {
            catData.row = parseInt(parts[1].replace('.meta_row_', ''), 10) || 1;
        } else if (!file.key.endsWith('.keep') && !parts[1].startsWith('.meta_')) {
            catData.count++;
        }
    });

    const content = document.getElementById('admin-content');
    let html = `
        <header>
            <h1>Dossiers</h1>
            <div class="actions">
                ${secteur === 'Tout' ? `<button class="btn-secondary" onclick="openFolderSectorsModal()" style="margin-right:8px;">🔒 Accès secteurs</button>` : ''}
                <button class="btn-primary" onclick="openNewFolderModal()">+ Nouveau Dossier</button>
            </div>
        </header>
        <div class="categories-container" id="admin-categories-container">
            `;

    // Folder Cards
    let idx = 0;

    const sortedCategories = Array.from(categories.entries()).sort((a, b) => {
        if (a[1].order !== b[1].order) return a[1].order - b[1].order;
        return a[0].localeCompare(b[0]);
    });

    // Group by Row
    const rows = new Map();
    sortedCategories.forEach(([cat, data]) => {
        if (!rows.has(data.row)) rows.set(data.row, []);
        rows.get(data.row).push([cat, data]);
    });

    if (rows.size === 0) rows.set(1, []);
    const maxRow = Math.max(...Array.from(rows.keys()), 0);
    // Add empty dropzone row
    rows.set(maxRow + 1, []);

    const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => a - b);

    sortedRowKeys.forEach(rowNum => {
        html += `<div class="folder-row-divider" style="margin-top:20px; margin-bottom:10px; font-weight:bold; color:#666;">Ligne ${rowNum}</div>`;
        html += `<div class="categories-grid" data-row="${rowNum}" id="admin-categories-grid-${rowNum}" 
                    ondragover="handleGridDragOver(event)" 
                    ondragenter="handleGridDragEnter(event)" 
                    ondragleave="handleGridDragLeave(event)" 
                    ondrop="handleGridDrop(event, ${rowNum})"
                    style="min-height: 120px; border: 2px dashed transparent; border-radius: 12px; padding: 10px; transition: all 0.2s;">`;

        const rowItems = rows.get(rowNum);
        rowItems.forEach(([cat, data]) => {
            const color = data.color || palette[idx % palette.length];
            const owners = ownerMap[cat] || ownerMap[cat + '/'] || null;
            const ownerBadge = makeOwnerBadge(owners, 'div');

            html += `
                <div class="category-card"
                    draggable="true"
                    data-folder="${cat}"
                    data-order="${data.order}"
                    data-row="${data.row}"
                    onclick="renderAdminFiles('${cat}')"
                    ondragstart="handleFolderDragStart(event)"
                    ondragover="handleFolderDragOver(event)"
                    ondragenter="handleFolderDragEnter(event)"
                    ondragleave="handleFolderDragLeave(event)"
                    ondrop="handleFolderDrop(event, '${cat}', ${rowNum})"
                    ondragend="handleFolderDragEnd(event)">
                    <button class="edit-folder-btn" onclick="event.stopPropagation(); openEditFolderModal('${cat}', '${color}', '${data.emoji}')" title="Éditer le dossier">✏️</button>
                    <button class="access-folder-btn" onclick="event.stopPropagation(); openAccessModal('${cat}')" title="Gérer la visibilité">👁️</button>
                    <button class="delete-folder-btn" onclick="event.stopPropagation(); deleteFolder('${cat}')" title="Supprimer le dossier">🗑️</button>
                    <div class="category-emoji-large">${data.emoji}</div>
                    <div style="width: 24px; height: 4px; background-color: ${color}; border-radius: 2px; margin-bottom: 12px;"></div>
                    <div class="category-title" title="${cat}">${cat}</div>
                    <div style="font-size:12px; color:#888; margin-top:4px;">${data.count} fichiers</div>
                    ${folderSectorMap[cat] ? `<div style="font-size:10px; margin-top:4px; color:#FF9500; font-weight:600;">${folderSectorMap[cat].join(' · ')}</div>` : ''}
                    ${ownerBadge}
                </div>
                `;
            idx++;
        });

        if (rowItems.length === 0) {
            html += `<div class="empty-row-placeholder" style="color:#aaa; text-align:center; flex:1; padding:20px; font-style:italic;">Déposer un dossier ici pour créer une nouvelle ligne</div>`;
        }

        html += `</div>`;
    });

    // Uncategorized Files
    const rootFiles = adminFilesCache.filter(f => !f.key.includes('/') && !f.key.startsWith('.meta_'));
    if (rootFiles.length > 0) {
        html += `
            <div class="category-card" onclick="renderAdminFiles('')">
                <div class="category-icon" style="background-color: #8E8E93">📄</div>
                <div class="category-title">Divers (Racine)</div>
                <div style="font-size:14px; color:#888; margin-top:8px;">${rootFiles.length} fichiers</div>
            </div>
        `;
    }

    html += `</div>`;
    content.innerHTML = html;
}

// Sector access modal for folders (Tout only)
window.openFolderSectorsModal = function () {
    const AVAILABLE_SECTORS = ['AIA', 'HT'];

    // Build folderSectorMap from cache (same logic as renderAdminFolders)
    const folderSectorMap = {};
    const folderNames = new Set();

    adminFilesCache.forEach(file => {
        const parts = file.key.split('/');
        if (parts.length < 2) return;
        const folderName = parts[0];
        folderNames.add(folderName);
        if (parts[1].startsWith('.meta_sectors_')) {
            folderSectorMap[folderName] = parts[1].replace('.meta_sectors_', '').split(',').filter(Boolean);
        }
    });

    const folders = Array.from(folderNames).filter(f => !f.startsWith('.meta_')).sort();

    if (folders.length === 0) {
        showToast('Aucun dossier trouvé.');
        return;
    }

    let rowsHtml = folders.map(folder => {
        const currentSectors = folderSectorMap[folder] || [];
        const checkboxes = AVAILABLE_SECTORS.map(s => {
            const checked = currentSectors.includes(s) ? 'checked' : '';
            return `<label style="margin-right:12px; cursor:pointer;">
                <input type="checkbox" data-folder="${folder}" data-sector="${s}" ${checked} style="margin-right:4px;">
                ${s}
            </label>`;
        }).join('');
        const badge = currentSectors.length > 0
            ? `<span style="font-size:10px; color:#FF9500; font-weight:600;">${currentSectors.join(' · ')}</span>`
            : `<span style="font-size:10px; color:#888;">Tous</span>`;
        return `<tr>
            <td style="padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.07); font-size:14px;">📁 ${folder}</td>
            <td style="padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.07);">${checkboxes}</td>
            <td style="padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.07);">${badge}</td>
        </tr>`;
    }).join('');

    const modalHtml = `
        <div id="folder-sectors-modal" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">
            <div style="background:#1C1C1E;border-radius:16px;padding:24px;width:min(680px,95vw);max-height:80vh;display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h2 style="margin:0;color:white;font-size:18px;">🔒 Accès secteurs par dossier</h2>
                    <button onclick="document.getElementById('folder-sectors-modal').remove()" style="background:none;border:none;color:#888;font-size:22px;cursor:pointer;">✕</button>
                </div>
                <p style="color:#aaa;font-size:13px;margin:0 0 16px;">Cochez les secteurs autorisés pour chaque dossier. Sans sélection = accessible à tous.</p>
                <div style="overflow-y:auto;flex:1;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="text-align:left;padding:8px;color:#888;font-size:12px;font-weight:500;">Dossier</th>
                                <th style="text-align:left;padding:8px;color:#888;font-size:12px;font-weight:500;">Secteurs autorisés</th>
                                <th style="text-align:left;padding:8px;color:#888;font-size:12px;font-weight:500;">Actuel</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
                <div style="display:flex;gap:12px;margin-top:20px;justify-content:flex-end;">
                    <button onclick="document.getElementById('folder-sectors-modal').remove()" class="btn-secondary">Annuler</button>
                    <button onclick="saveFolderSectors()" class="btn-primary" id="save-folder-sectors-btn">Enregistrer</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.saveFolderSectors = async function () {
    const btn = document.getElementById('save-folder-sectors-btn');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    const checkboxes = document.querySelectorAll('#folder-sectors-modal input[type="checkbox"]');
    const folderSectors = {};
    checkboxes.forEach(cb => {
        const folder = cb.dataset.folder;
        if (!folderSectors[folder]) folderSectors[folder] = [];
        if (cb.checked) folderSectors[folder].push(cb.dataset.sector);
    });

    let errors = 0;
    for (const [folder, sectors] of Object.entries(folderSectors)) {
        try {
            await api.setFolderSectors(folder, sectors);
        } catch (e) {
            console.error(`setFolderSectors failed for ${folder}:`, e);
            errors++;
        }
    }

    document.getElementById('folder-sectors-modal')?.remove();

    if (errors > 0) {
        showToast(`Enregistré avec ${errors} erreur(s).`);
    } else {
        showToast('Accès secteurs mis à jour ✓');
    }

    await refreshAdminData();
    renderAdminFolders();
};

// 2. Render File List (Inside a Folder)
window.renderAdminFiles = async function (folder) {
    adminCurrentFolder = folder;

    const title = folder || "Divers (Racine)";
    const currentPrefix = folder ? folder + '/' : '';

    // Fetch ownership map { path -> 'Prénom Nom' }
    let ownerMap = {};
    try { ownerMap = await api.getAccessSummary(); } catch (e) { /* silently ignore */ }

    const subfolders = new Set();
    const distinctFiles = [];

    adminFilesCache.forEach(f => {
        // Must start with current folder path
        if (!f.key.startsWith(currentPrefix)) return;

        // Get path relative to current folder
        const relativePath = f.key.substring(currentPrefix.length);
        const parts = relativePath.split('/');

        if (parts.length > 1) {
            // It is a subfolder (e.g. "Sub/file.txt" -> "Sub")
            // Avoid adding empty strings if double slash occurs
            if (parts[0]) subfolders.add(parts[0]);
        } else {
            // It is a file directly in this folder
            const name = parts[0];
            if (!name.endsWith('.keep') && !name.startsWith('.meta_') && name !== "") {
                distinctFiles.push(f);
            }
        }
    });

    const sortedSubfolders = Array.from(subfolders).sort();
    // Sort files? They are usually sorted by key in cache, but let's effectively leave them as is or simple sort
    distinctFiles.sort((a, b) => a.key.localeCompare(b.key));

    // Calculate parent folder for "Back" button
    let backAction = "renderAdminFolders()";
    if (folder) {
        const parts = folder.split('/');
        parts.pop(); // remove current folder
        const parentFolder = parts.join('/');
        // If parentFolder is empty, it means we are at top level of files, but still "Files".
        // However, if we want to go back to "Categories", we need to know if we are at root.
        // renderAdminFiles("") renders root.
        // User wants back to go UP.
        // If folder is "A/B", back is "A".
        // If folder is "A", back is "" (Root of files? Or Categories?)
        // Let's assume:
        // - If folder has parts, go to parent.
        // - If folder has NO parts (root), go to renderAdminFolders().

        if (folder.includes('/')) {
            backAction = `renderAdminFiles('${parentFolder}')`;
        } else {
            // We are at "Folder", back goes to Categories
            backAction = `renderAdminFolders()`;
        }

    }

    const content = document.getElementById('admin-content');
    content.innerHTML = `
        <header>
            <div style="display:flex; align-items:center; gap:16px;">
                <button class="btn-primary" style="padding: 8px 16px; background: #E5E5EA; color: #000;" onclick="${backAction}">
                    ← Retour
                </button>
                <h1 style="margin:0;">${title}</h1>
            </div>
            <div class="actions">
                <button class="btn-danger" id="deleteSelectedBtn" style="display:none; align-items:center; gap:8px;" onclick="deleteSelectedItems()">🗑️ Supprimer la sélection (<span id="selectedCount">0</span>)</button>
                <button class="btn-primary" onclick="openNewFolderModal()">+ Nouveau Dossier</button>
                <button class="btn-primary" onclick="triggerUpload('${folder}')">📤 Upload ici</button>
                <input type="file" id="file-input-${folder || 'root'}" hidden>
            </div>
        </header>

        <div class="table-container"
            ondragover="handleDragOver(event)"
            ondragleave="handleDragLeave(event)"
            ondrop="handleDrop(event, '${folder || ''}')">
            <table>
                <thead>
                    <tr>
                        <th style="width:40px; text-align:center;"><input type="checkbox" id="selectAllCheckbox" onclick="toggleSelectAll(this)" style="cursor:pointer; transform: scale(1.2);"></th>
                        <th style="width:40px"></th> <!-- Icon -->
                        <th>Nom</th>
                        <th>Taille</th>
                        <th style="text-align: right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${/* Render Subfolders */ ''}
                    ${sortedSubfolders.map(sub => {
        const fullPath = currentPrefix + sub;
        const owners = ownerMap[fullPath] || ownerMap[fullPath + '/'] || null;
        const ownerBadge = makeOwnerBadge(owners, 'span');
        return `
                        <tr class="folder-row" onclick="renderAdminFiles('${fullPath}')" style="cursor:pointer">
                            <td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox" class="item-checkbox" data-path="${fullPath}" data-type="folder" onclick="updateSelectedCount()" style="cursor:pointer; transform: scale(1.2);"></td>
                            <td style="font-size:20px; text-align:center;">📁</td>
                            <td style="font-weight:600">${sub}${ownerBadge}</td>
                            <td>-</td>
                            <td style="text-align: right">
                                <button class="btn-sm btn-view" onclick="event.stopPropagation(); openAccessModal('${fullPath}')" title="Gérer l'accès">👁️</button>
                                <button class="btn-sm btn-view" onclick="event.stopPropagation(); renameFolder('${fullPath}', '${sub}')" title="Renommer">✏️</button>
                                <button class="btn-sm btn-danger" onclick="event.stopPropagation(); deleteFolder('${fullPath}')">Supprimer</button>
                            </td>
                        </tr>`;
    }).join('')}

                    ${/* Render Files */ ''}
                    ${distinctFiles.map(file => {
        const name = file.key.split('/').pop();
        const ext = name.split('.').pop().toLowerCase();
        let icon = '📄';
        if (['pdf'].includes(ext)) icon = '📕';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) icon = '🖼️';
        if (['doc', 'docx'].includes(ext)) icon = '📘';
        if (['xls', 'xlsx', 'csv'].includes(ext)) icon = '📊';
        const owners = ownerMap[file.key] || null;
        const ownerBadge = makeOwnerBadge(owners, 'span');

        return `
                        <tr onclick="window.openFile(this.getAttribute('data-key'))" data-key="${file.key.replace(/"/g, '&quot;')}" style="cursor: pointer; transition: background-color 0.2s;">
                            <td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox" class="item-checkbox" data-path="${file.key.replace(/"/g, '&quot;')}" data-type="file" onclick="updateSelectedCount()" style="cursor:pointer; transform: scale(1.2);"></td>
                            <td style="font-size:20px; text-align:center;">${icon}</td>
                            <td>${name}${ownerBadge}</td>
                            <td>${(file.size / 1024).toFixed(1)} KB</td>
                            <td style="text-align: right">
                                <button class="btn-sm btn-view" onclick="event.stopPropagation(); openAccessModal('${file.key.replace(/'/g, "\\'")}')" title="Gérer l'accès">👁️</button>
                                <button class="btn-sm btn-view" onclick="event.stopPropagation(); renameFile('${file.key.replace(/'/g, "\\'")}', '${name.replace(/'/g, "\\'")}')" title="Renommer">✏️</button>
                                <button class="btn-sm btn-danger" onclick="event.stopPropagation(); deleteFile('${file.key.replace(/'/g, "\\'")}')">Supprimer</button>
                            </td>
                        </tr>`;
    }).join('')}
                    ${(sortedSubfolders.length === 0 && distinctFiles.length === 0) ?
            '<tr><td colspan="5" style="text-align:center; padding:50px; color:#888; border: 2px dashed #E5E5EA; border-radius: 12px;">📂 Dossier vide<br><small>Glissez des fichiers ici pour uploader</small></td></tr>'
            : ''}
                </tbody>
            </table>
        </div>
    `;
}

window.toggleSelectAll = function (source) {
    const checkboxes = document.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateSelectedCount();
};

window.updateSelectedCount = function () {
    const checked = document.querySelectorAll('.item-checkbox:checked');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const countSpan = document.getElementById('selectedCount');
    if (checked.length > 0) {
        deleteBtn.style.display = 'inline-flex';
        countSpan.textContent = checked.length;
    } else {
        deleteBtn.style.display = 'none';
        countSpan.textContent = '0';
    }

    const selectAllCb = document.getElementById('selectAllCheckbox');
    const allCb = document.querySelectorAll('.item-checkbox');
    if (selectAllCb && allCb.length > 0) {
        selectAllCb.checked = (checked.length === allCb.length);
    }
};

window.deleteSelectedItems = function () {
    const checked = document.querySelectorAll('.item-checkbox:checked');
    if (checked.length === 0) return;

    showConfirmModal(
        "Supprimer la sélection ?",
        `Voulez - vous vraiment supprimer les < b > ${checked.length}</b > éléments sélectionnés ? <br>Les dossiers sélectionnés et tout leur contenu seront supprimés.<br><br>Cette action est irréversible.`,
        async () => {
            let count = 0;
            const overlays = document.createElement('div');
            overlays.className = 'modal-overlay';
            overlays.id = 'delete-loading';
            overlays.innerHTML = `<div class="modal-box" style="text-align:center"><h3>Suppression en cours...</h3><p>Veuillez patienter.</p></div>`;
            document.body.appendChild(overlays);

            for (let i = 0; i < checked.length; i++) {
                const item = checked[i];
                const type = item.getAttribute('data-type');
                const path = item.getAttribute('data-path');

                if (type === 'file') {
                    try {
                        await api.deleteFile(path);
                        count++;
                    } catch (e) {
                        console.error("Error deleting " + path, e);
                    }
                } else if (type === 'folder') {
                    const filesToDelete = adminFilesCache.filter(f => f.key.startsWith(path + '/'));
                    const metaFiles = adminFilesCache.filter(f => {
                        const parts = f.key.split('/');
                        return parts.length > 1 && parts[0] === path && parts[1].startsWith('.meta_');
                    });
                    const allKeys = new Set();
                    filesToDelete.forEach(f => allKeys.add(f.key));
                    metaFiles.forEach(f => allKeys.add(f.key));

                    for (const key of allKeys) {
                        try {
                            await api.deleteFile(key);
                            count++;
                        } catch (e) {
                            console.error("Error deleting " + key, e);
                        }
                    }
                }
            }

            if (document.getElementById('delete-loading')) document.body.removeChild(document.getElementById('delete-loading'));
            showSuccessModal(`${count} éléments supprimés avec succès.`);
            await refreshAdminData();
        }
    );
};

window.renameFile = function (key, currentName) {
    const extIndex = currentName.lastIndexOf('.');
    let baseName = currentName;
    let extension = "";

    if (extIndex !== -1) {
        baseName = currentName.substring(0, extIndex);
        extension = currentName.substring(extIndex); // includes dot
    }

    showPromptModal("Renommer le fichier", baseName, async (newBaseName) => {
        if (!newBaseName || newBaseName === baseName) return;

        // Re-attach extension
        const newName = newBaseName.trim() + extension;

        // Construct new key
        const lastSlashIndex = key.lastIndexOf('/');
        const prefix = lastSlashIndex !== -1 ? key.substring(0, lastSlashIndex + 1) : "";
        const newKey = prefix + newName;

        try {
            await api.renameFile(key, newKey);
            showSuccessModal("Fichier renommé avec succès.");
            await refreshAdminData();
        } catch (e) {
            alert("Erreur lors du renommage : " + e.message);
        }
    });
};

window.renameFolder = function (oldPath, currentName) {
    showPromptModal("Renommer le dossier", currentName, async (newName) => {
        if (!newName || newName === currentName) return;

        // Logic: oldPath = "A/B" 
        const oldPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';

        // Construct new prefix
        const parts = oldPath.split('/');
        if (parts[parts.length - 1] === "") parts.pop(); // handle trailing slash
        parts.pop(); // Remove old name

        const parent = parts.join('/');
        const newPrefix = (parent ? parent + '/' : '') + newName.trim() + '/';

        try {
            // Show a loading message as this can be slow
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.id = 'rename-loading';
            overlay.innerHTML = `< div class="modal-box" style = "text-align:center" ><h3>Renommage en cours...</h3><p>Veuillez patienter.</p></div > `;
            document.body.appendChild(overlay);

            const res = await api.renameFolder(oldPrefix, newPrefix);

            document.body.removeChild(overlay);
            showSuccessModal(`${res.count} éléments déplacés.Dossier renommé.`);
            await refreshAdminData();
        } catch (e) {
            if (document.getElementById('rename-loading')) document.body.removeChild(document.getElementById('rename-loading'));
            alert("Erreur lors du renommage : " + e.message);
        }
    });
};



window.deleteFolder = function (folder) {
    showConfirmModal(
        "Supprimer le dossier ?",
        `Cela va supprimer le dossier "<b>${folder}</b>" et < b > TOUS</b > les fichiers qu'il contient.<br><br>Cette action est irréversible.`,
        async () => {
            // Find all files in folder
            const filesToDelete = adminFilesCache.filter(f => f.key.startsWith(folder + '/'));

            // Find meta files too (colors)
            // Convention: FolderName/.meta_color_HEXCODE - wait, these are named "Folder/.meta..." so they naturally start with "Folder/"
            // But let's double check logic.
            // If file is "CRM/doc.pdf", it starts with "CRM/".
            // If file is "CRM/.meta_color_...", it starts with "CRM/".
            // So the filter above actually covers BOTH.

            // However, the original code had explicit logic for metaFiles.
            // Let's stick to the original logic to be safe, but cleaner.

            const metaFiles = adminFilesCache.filter(f => {
                const parts = f.key.split('/');
                return parts.length > 1 && parts[0] === folder && parts[1].startsWith('.meta_');
            });
            // The first filter likely catches them too unless they are stored differently.
            // If "CRM/.meta..." exists, adminFilesCache has it? Yes listFiles returns all.

            // Let's use a Set to avoid duplicates just in case
            const allKeys = new Set();
            filesToDelete.forEach(f => allKeys.add(f.key));
            metaFiles.forEach(f => allKeys.add(f.key));

            let count = 0;
            for (const key of allKeys) {
                try {
                    await api.deleteFile(key);
                    count++;
                } catch (e) {
                    console.error("Error deleting " + key, e);
                }
            }

            showSuccessModal(`${count} fichiers supprimés. Dossier effacé.`);
            await refreshAdminData();
        }
    );
};

// 3. Folder Creation Modal Logic
let selectedColor = '#007AFF'; // Default

window.openNewFolderModal = function () {
    selectedColor = '#007AFF'; // Reset
    const colors = ['#FF9500', '#AF52DE', '#5856D6', '#FF2D55', '#5AC8FA', '#34C759', '#FF3B30', '#FFCC00']; // iOS Palette

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'new-folder-modal';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">Nouveau Dossier ${adminCurrentFolder ? `<br><small style="font-weight:normal; font-size:14px; color:#888">dans ${adminCurrentFolder}</small>` : ''}</div>

            <div class="form-group">
                <label>Nom du dossier</label>
                <input type="text" class="form-input" id="folder-name-input" placeholder="Ex: FDS, Clients..." autofocus>
            </div>

            <div class="form-group">
                <label>Couleur</label>
                <div class="color-grid">
                    ${colors.map(c => `
                        <div class="color-option" style="background-color: ${c}" onclick="selectColor(this, '${c}')"></div>
                    `).join('')}
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal('new-folder-modal')">Annuler</button>
                <button class="btn-primary" onclick="confirmNewFolder()">Créer</button>
            </div>
        </div>
        `;
    document.body.appendChild(overlay);

    // Select first color by default visually
    setTimeout(() => {
        const first = overlay.querySelector('.color-option');
        if (first) selectColor(first, colors[0]);
    }, 10);
};

window.selectColor = function (el, color) {
    selectedColor = color;
    document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
};

window.closeModal = function (id) {
    const el = document.getElementById(id);
    if (el) document.body.removeChild(el);
};

window.confirmNewFolder = async function () {
    const nameInput = document.getElementById('folder-name-input');
    const name = nameInput.value.trim();
    if (!name) return alert("Veuillez entrer un nom.");

    window.closeModal('new-folder-modal');

    // 1. Create a placeholder to lock folder
    const dummyFile = new File(["placeholder"], ".keep", { type: "text/plain" });

    // 2. Create the color marker file (SHARED CONFIG)
    // Filename: .meta_color_XXXXXX (stripping # for safety)
    const colorHex = selectedColor.replace('#', '');
    const markerFile = new File(["config"], `.meta_color_${colorHex}`, { type: "text/plain" });

    // Construct full path
    const prefix = adminCurrentFolder ? adminCurrentFolder + "/" : "";
    const fullPath = prefix + name + "/";

    try {
        // Upload both (Marker first to ensure color is there)
        await api.uploadFile(markerFile, fullPath);
        await api.uploadFile(dummyFile, fullPath);
        await refreshAdminData(); // This will refresh UI at the end
    } catch (e) {
        alert("Erreur création dossier: " + e.message);
    }
};

window.createNewFolder = async function () {
    // Deprecated for openNewFolderModal
    openNewFolderModal();
};

window.openEditFolderModal = function (folderName, currentColor, currentEmoji) {
    selectedColor = currentColor || '#007AFF';
    const colors = ['#FF9500', '#AF52DE', '#5856D6', '#FF2D55', '#5AC8FA', '#34C759', '#FF3B30', '#FFCC00'];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'edit-folder-modal';

    // Safety for URI decoding if any issues
    const displayEmoji = currentEmoji === '📁' ? '' : currentEmoji;

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">Éditer le Dossier <br><small style="font-weight:normal; font-size:14px; color:#888">${folderName}</small></div>

            <div class="form-group">
                <label>Nom du dossier</label>
                <input type="text" class="form-input" id="edit-folder-name" value="${folderName}">
            </div>

            <div class="form-group">
                <label>Emoji (Optionnel)</label>
                <input type="text" class="form-input" id="edit-folder-emoji" value="${displayEmoji}" placeholder="Ex: 🔧, 🚛..." maxlength="2">
            </div>

            <div class="form-group">
                <label>Couleur</label>
                <div class="color-grid">
                    ${colors.map(c => `
                        <div class="color-option ${c === selectedColor ? 'selected' : ''}" style="background-color: ${c}" onclick="selectColor(this, '${c}')"></div>
                    `).join('')}
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal('edit-folder-modal')">Annuler</button>
                <button class="btn-primary" onclick="confirmEditFolder('${folderName}', '${currentColor}', '${currentEmoji}')">Enregistrer</button>
            </div>
        </div>
        `;
    document.body.appendChild(overlay);
};

window.confirmEditFolder = async function (oldName, oldColor, oldEmoji) {
    const newName = document.getElementById('edit-folder-name').value.trim();
    let newEmoji = document.getElementById('edit-folder-emoji').value.trim();

    if (!newName) return alert("Veuillez entrer un nom.");
    window.closeModal('edit-folder-modal');

    // Show loading indicator
    const content = document.getElementById('admin-categories-grid');
    if (content) content.style.opacity = '0.5';

    const prefix = adminCurrentFolder ? adminCurrentFolder + "/" : "";
    let fullOldPath = prefix + oldName + "/";
    let targetPath = prefix + newName + "/";

    try {
        let needsRefresh = false;

        // 1. Rename Folder if name changed
        if (newName !== oldName) {
            await api.renameFolder(fullOldPath, targetPath);
            fullOldPath = targetPath; // For subsequent metadata updates
            needsRefresh = true;
        }

        // 2. Handle Color Change
        if (selectedColor !== oldColor) {
            const oldColorHex = oldColor ? oldColor.replace('#', '') : null;
            const newColorHex = selectedColor.replace('#', '');

            // Delete old color meta
            if (oldColorHex) {
                try { await api.deleteFile(fullOldPath + `.meta_color_${oldColorHex}`); } catch (e) { }
            }
            // Upload new
            const markerFile = new File(["config"], `.meta_color_${newColorHex}`, { type: "text/plain" });
            await api.uploadFile(markerFile, fullOldPath);
            needsRefresh = true;
        }

        // 3. Handle Emoji Change
        if (newEmoji !== oldEmoji && (newEmoji !== "" || oldEmoji !== '📁')) {
            // Delete old emoji meta
            if (oldEmoji && oldEmoji !== '📁') {
                const encodedOld = encodeURIComponent(oldEmoji);
                try { await api.deleteFile(fullOldPath + `.meta_emoji_${encodedOld}`); } catch (e) { }
            }

            // Upload new emoji meta if provided
            if (newEmoji !== "") {
                const encodedNew = encodeURIComponent(newEmoji);
                const emojiFile = new File(["config"], `.meta_emoji_${encodedNew}`, { type: "text/plain" });
                await api.uploadFile(emojiFile, fullOldPath);
            }
            needsRefresh = true;
        }

        if (needsRefresh) {
            await refreshAdminData();
        } else {
            if (content) content.style.opacity = '1';
        }
    } catch (e) {
        alert("Erreur lors de l'édition : " + e.message);
        if (content) content.style.opacity = '1';
    }
};

// --- Folder Drag and Drop Reordering ---
let draggedFolder = null;

window.handleFolderDragStart = function (e) {
    draggedFolder = e.target.closest('.category-card');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedFolder.dataset.folder);
    setTimeout(() => {
        draggedFolder.style.opacity = '0.5';
    }, 0);
};

window.handleFolderDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.category-card');
    if (card && card !== draggedFolder) {
        card.classList.add('drag-over');
    }
};

window.handleFolderDragEnter = function (e) {
    e.preventDefault();
};

window.handleFolderDragLeave = function (e) {
    const card = e.target.closest('.category-card');
    if (card) {
        card.classList.remove('drag-over');
    }
};

window.handleFolderDrop = async function (e, targetFolderName, targetRowNum) {
    e.preventDefault();
    e.stopPropagation(); // Prevent normal file drop logic

    const card = e.target.closest('.category-card');
    if (card) card.classList.remove('drag-over');

    const sourceFolderName = e.dataTransfer.getData('text/plain');
    if (!sourceFolderName || sourceFolderName === targetFolderName) return;

    await moveFolderAndUpdateOrder(sourceFolderName, targetFolderName, targetRowNum);
};

window.handleGridDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const grid = e.currentTarget;
    if (grid) grid.style.borderColor = 'var(--primary)';
};

window.handleGridDragEnter = function (e) {
    e.preventDefault();
};

window.handleGridDragLeave = function (e) {
    const grid = e.currentTarget;
    if (grid) grid.style.borderColor = 'transparent';
};

window.handleGridDrop = async function (e, rowNum) {
    e.preventDefault();
    e.stopPropagation();

    const grid = e.currentTarget;
    if (grid) grid.style.borderColor = 'transparent';

    const sourceFolderName = e.dataTransfer.getData('text/plain');
    if (!sourceFolderName) return;

    await moveFolderAndUpdateOrder(sourceFolderName, null, rowNum);
};

async function moveFolderAndUpdateOrder(sourceFolderName, targetFolderName, targetRowNum) {
    const container = document.getElementById('admin-categories-container');
    const allCards = Array.from(container.querySelectorAll('.category-card[data-folder]'));

    // Build current state: rowNum -> array of folder names
    const rowMap = new Map();
    allCards.forEach(c => {
        const row = parseInt(c.dataset.row, 10);
        if (!rowMap.has(row)) rowMap.set(row, []);
        rowMap.get(row).push(c.dataset.folder);
    });

    // Find where source is currently
    let sourceRow = -1;
    for (const [r, fList] of rowMap.entries()) {
        if (fList.includes(sourceFolderName)) {
            sourceRow = r;
            break;
        }
    }

    if (sourceRow === -1) return;

    // Remove source from its current row
    const sourceList = rowMap.get(sourceRow);
    sourceList.splice(sourceList.indexOf(sourceFolderName), 1);

    // Ensure target row exists
    if (!rowMap.has(targetRowNum)) rowMap.set(targetRowNum, []);
    const targetList = rowMap.get(targetRowNum);

    if (targetFolderName) {
        // Insert before target
        const targetIdx = targetList.indexOf(targetFolderName);
        if (targetIdx !== -1) {
            targetList.splice(targetIdx, 0, sourceFolderName);
        } else {
            targetList.push(sourceFolderName);
        }
    } else {
        // Append to the target row
        targetList.push(sourceFolderName);
    }

    container.style.opacity = '0.5';
    const prefix = adminCurrentFolder ? adminCurrentFolder + "/" : "";

    try {
        for (const [row, folders] of rowMap.entries()) {
            for (let i = 0; i < folders.length; i++) {
                const folderName = folders[i];
                const card = allCards.find(c => c.dataset.folder === folderName);
                if (!card) continue;

                const oldRow = parseInt(card.dataset.row, 10);
                const oldOrder = parseInt(card.dataset.order, 10) || 999;
                const newRow = row;
                const newOrder = i + 1;

                const fullPath = prefix + folderName + "/";
                let changedAny = false;

                if (oldRow !== newRow) {
                    if (oldRow !== 1) {
                        try { await api.deleteFile(fullPath + `.meta_row_${oldRow}`); } catch (e) { }
                    }
                    if (newRow !== 1 || oldRow !== 1) {
                        const rowFile = new File(["config"], `.meta_row_${newRow}`, { type: "text/plain" });
                        await api.uploadFile(rowFile, fullPath);
                    }
                    changedAny = true;
                }

                if (oldOrder !== newOrder || changedAny) {
                    if (oldOrder !== 999) {
                        try { await api.deleteFile(fullPath + `.meta_order_${oldOrder}`); } catch (e) { }
                    }
                    if (newOrder !== 999 || changedAny) {
                        const orderFile = new File(["config"], `.meta_order_${newOrder}`, { type: "text/plain" });
                        await api.uploadFile(orderFile, fullPath);
                    }
                }
            }
        }
        await refreshAdminData();
    } catch (err) {
        alert("Erreur lors de la réorganisation : " + err.message);
        container.style.opacity = '1';
    }
}

window.handleFolderDragEnd = function (e) {
    if (draggedFolder) {
        draggedFolder.style.opacity = '1';
        draggedFolder = null;
    }
    document.querySelectorAll('.category-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    document.querySelectorAll('.categories-grid').forEach(g => g.style.borderColor = 'transparent');
};

// --- Upload Queue System ---
const uploadQueue = []; // Items: {id, file, prefix, status: 'pending'|'uploading'|'success'|'error', progress: 0, error: null }
let isQueueProcessing = false;
let isQueueMinimized = false;
let mobileUploadActive = false; // Track mobile upload state

// --- Prevent page close during mobile upload ---
window.addEventListener('beforeunload', (e) => {
    if (isMobileView && mobileUploadActive) {
        e.preventDefault();
        e.returnValue = 'Un upload est en cours. Quitter la page pourrait corrompre vos fichiers.';
        return e.returnValue;
    }
});

// Mobile blocking overlay functions
function showMobileUploadOverlay() {
    let overlay = document.getElementById('mobile-upload-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mobile-upload-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.85);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 32px 24px; gap: 20px;
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    updateMobileUploadOverlay();
}

function updateMobileUploadOverlay() {
    const overlay = document.getElementById('mobile-upload-overlay');
    if (!overlay) return;

    const pending = uploadQueue.filter(i => i.status === 'pending').length;
    const uploading = uploadQueue.filter(i => i.status === 'uploading').length;
    const success = uploadQueue.filter(i => i.status === 'success').length;
    const errors = uploadQueue.filter(i => i.status === 'error').length;
    const total = uploadQueue.length;
    const done = success + errors;
    const globalProgress = total > 0 ? Math.round((done / total) * 100) : 0;
    const isAllDone = done === total && total > 0;

    overlay.innerHTML = `
        <div style="text-align:center; color:white;">
            <div style="font-size:48px; margin-bottom:12px;">${isAllDone ? (errors > 0 ? '⚠️' : '✅') : '📤'}</div>
            <div style="font-size:20px; font-weight:700; margin-bottom:6px;">
                ${isAllDone ? (errors > 0 ? 'Upload terminé avec des erreurs' : 'Upload terminé !') : 'Upload en cours...'}
            </div>
            ${!isAllDone ? `<div style="font-size:13px; color:rgba(255,255,255,0.7); margin-bottom:20px;">⚠️ Veuillez ne pas quitter cette page</div>` : ''}
        </div>

        <div style="width:100%; max-width:400px; background:rgba(255,255,255,0.15); border-radius:12px; height:10px; overflow:hidden;">
            <div style="height:100%; width:${globalProgress}%; background:var(--primary-color, #2da140); border-radius:12px; transition:width 0.3s ease;"></div>
        </div>
        <div style="font-size:13px; color:rgba(255,255,255,0.8);">${done} / ${total} fichier(s)</div>

        <div style="width:100%; max-width:400px; display:flex; flex-direction:column; gap:10px; max-height:40vh; overflow-y:auto;">
            ${uploadQueue.map(item => {
        const statusIcon = item.status === 'success' ? '✅' : item.status === 'error' ? '❌' : item.status === 'uploading' ? '⏳' : '🕐';
        const progressBar = item.status === 'uploading'
            ? `<div style="background:rgba(255,255,255,0.2); border-radius:6px; height:6px; margin-top:5px;"><div style="height:100%; width:${item.progress}%; background:white; border-radius:6px; transition:width 0.2s;"></div></div>`
            : '';
        return `
                <div style="background:rgba(255,255,255,0.12); border-radius:10px; padding:10px 14px;">
                    <div style="display:flex; gap:8px; align-items:center; color:white; font-size:13px;">
                        <span>${statusIcon}</span>
                        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.file.name}</span>
                        <span style="font-size:11px; opacity:0.7;">${item.progress}%</span>
                    </div>
                    ${progressBar}
                    ${item.error ? `<div style="font-size:11px; color:#FF6B6B; margin-top:4px;">${item.error}</div>` : ''}
                </div>`;
    }).join('')}
        </div>

        ${isAllDone ? `<button onclick="closeMobileUploadOverlay()" style="margin-top:8px; padding:14px 40px; background:var(--primary-color, #2da140); color:white; border:none; border-radius:24px; font-size:16px; font-weight:700; cursor:pointer;">Fermer</button>` : ''}
    `;
}

window.closeMobileUploadOverlay = function () {
    const overlay = document.getElementById('mobile-upload-overlay');
    if (overlay) overlay.style.display = 'none';
    mobileUploadActive = false;
};

window.addToUploadQueue = function (files, prefix) {
    // 1. Add to queue
    Array.from(files).forEach(file => {
        uploadQueue.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            file: file,
            prefix: prefix,
            status: 'pending',
            progress: 0
        });
    });

    // 2. On mobile: show blocking overlay. On desktop: show regular queue widget.
    if (isMobileView) {
        mobileUploadActive = true;
        showMobileUploadOverlay();
    } else {
        isQueueMinimized = false;
        renderUploadQueue();
    }

    // 3. Start processing if not already
    if (!isQueueProcessing) {
        processUploadQueue();
    }
};

async function processUploadQueue() {
    if (isQueueProcessing) return;
    isQueueProcessing = true;

    while (true) {
        // Find next pending
        const item = uploadQueue.find(i => i.status === 'pending');
        if (!item) break; // All done

        // Update Status
        item.status = 'uploading';
        if (isMobileView) {
            updateMobileUploadOverlay();
        } else {
            renderUploadQueue();
        }

        try {
            await api.uploadFile(item.file, item.prefix, (p) => {
                item.progress = p;
                if (isMobileView) {
                    updateMobileUploadOverlay();
                } else {
                    renderUploadQueue();
                }
            });
            item.status = 'success';
            item.progress = 100;

            const targetFolder = item.prefix ? item.prefix.slice(0, -1) : null;

            // Refresh admin view if on the right folder
            if (adminCurrentFolder === targetFolder) {
                await refreshAdminData();
            }

            // Refresh mobile view if on the right folder
            if (mobileCurrentPath && mobileCurrentPath === targetFolder) {
                try {
                    const session = await auth.getSession();
                    const userId = session ? session.user.id : null;
                    const freshFiles = await api.listFiles(userId);
                    mobileFilesCache = freshFiles;
                    openMobileFolder(mobileCurrentPath);
                } catch (refreshErr) {
                    console.warn('Mobile folder refresh failed:', refreshErr);
                }
            }

        } catch (e) {
            console.error("Upload error", e);
            item.status = 'error';
            item.error = e.message;
        }

        if (isMobileView) {
            updateMobileUploadOverlay();
        } else {
            renderUploadQueue();
        }
    }

    isQueueProcessing = false;

    // Auto-hide or keep open? 
    // Usually keep open to show success, maybe minimize after delay
    // For now keep open.
}

window.toggleQueueMinimize = function () {
    isQueueMinimized = !isQueueMinimized;
    renderUploadQueue();
};

window.closeUploadQueue = function () {
    // Remove completed items
    // Or just clear all? Let's clear connected items or hide
    // For simplicity: Clear completed/error, keep pending? 
    // Usually "Close" means "I've seen it".
    // Let's clear the queue array of finished items
    for (let i = uploadQueue.length - 1; i >= 0; i--) {
        if (['success', 'error'].includes(uploadQueue[i].status)) {
            uploadQueue.splice(i, 1);
        }
    }
    renderUploadQueue();
};

function renderUploadQueue() {
    // Never show the desktop widget on mobile — we have the overlay instead
    if (isMobileView) return;

    let container = document.getElementById('upload-queue-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'upload-queue-container';
        container.className = 'upload-queue-container hidden';
        document.body.appendChild(container);
    }

    // Visibility
    const activeCount = uploadQueue.length;
    if (activeCount === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');

    // Minimized State
    if (isQueueMinimized) {
        container.classList.add('minimized');
    } else {
        container.classList.remove('minimized');
    }

    // Header Stats
    const pending = uploadQueue.filter(i => ['pending', 'uploading'].includes(i.status)).length;
    const title = pending > 0 ? `Envoi de ${pending} fichier(s)...` : `Uploads terminés`;
    const icon = pending > 0 ? '⏳' : '✅';

    container.innerHTML = `
        <div class="upload-queue-header" onclick="toggleQueueMinimize()">
            <div style="display:flex; align-items:center; gap:8px;">
                <span>${icon}</span>
                <span>${title}</span>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:18px;">${isQueueMinimized ? '🔼' : '🔽'}</span>
                <span onclick="event.stopPropagation(); closeUploadQueue()" style="font-size:18px;" title="Fermer">✖️</span>
            </div>
        </div>
        <div class="upload-queue-list">
            ${uploadQueue.map(item => {
        let statusIcon = '⏳';
        let statusText = `${item.progress}%`;
        let statusClass = '';

        if (item.status === 'pending') { statusText = 'En attente...'; statusIcon = '✋'; }
        if (item.status === 'uploading') { statusClass = 'uploading'; } // could animate
        if (item.status === 'success') { statusText = 'OK'; statusIcon = '✅'; statusClass = 'success'; }
        if (item.status === 'error') { statusText = 'Erreur'; statusIcon = '⚠️'; statusClass = 'error'; }

        return `
                <div class="upload-queue-item ${statusClass}">
                    <div class="file-icon">📄</div>
                    <div class="file-info">
                        <div class="file-name" title="${item.file.name}">${item.file.name}</div>
                        <div class="file-progress-bar">
                            <div class="file-progress-fill" style="width: ${item.progress}%"></div>
                        </div>
                        <div class="file-status">
                            <span>${statusText}</span>
                            ${item.error ? `<span style="color:var(--danger)" title="${item.error}">Info</span>` : ''}
                        </div>
                    </div>
                </div>
                `;
    }).join('')}
        </div>
        `;
}

// Helper to prompt for renaming files before upload
window.promptForFileNamesAndReturn = async function (files) {
    if (!isMobileView) {
        return Array.from(files);
    }
    let resultFiles = [];
    const askName = (file) => new Promise(resolve => {
        const originalName = file.name;
        const ext = originalName.includes('.') ? "." + originalName.split('.').pop() : "";
        const baseName = originalName.includes('.') ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'rename-upload-modal';
        overlay.style.zIndex = '100005';
        overlay.innerHTML = `
            <div class="modal-box">
                <div class="modal-header">Nom du document</div>
                <p style="font-size:14px; color:#666; margin-bottom:12px;">Voulez-vous renommer ce document avant l'envoi ?</p>
                <div class="form-group">
                    <input type="text" class="form-input" id="rename-upload-input" value="${baseName.replace(/"/g, '&quot;')}" autofocus>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" id="rename-upload-cancel">Garder l'original</button>
                    <button class="btn-primary" id="rename-upload-confirm">Valider</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const inputEl = document.getElementById('rename-upload-input');
        inputEl.focus();
        inputEl.select();

        // Allow Enter key to confirm
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('rename-upload-confirm').click();
        };

        const cleanup = () => {
            const el = document.getElementById('rename-upload-modal');
            if (el) el.remove();
        };

        document.getElementById('rename-upload-cancel').onclick = () => {
            cleanup();
            resolve(file); // keep original
        };

        document.getElementById('rename-upload-confirm').onclick = () => {
            const newName = inputEl.value.trim();
            cleanup();
            if (newName && newName !== baseName) {
                // Ensure the extension isn't duplicated if user typed it
                let finalName = newName;
                if (!finalName.toLowerCase().endsWith(ext.toLowerCase())) {
                    finalName += ext;
                }
                const renamedFile = new File([file], finalName, { type: file.type });
                resolve(renamedFile);
            } else {
                resolve(file);
            }
        };
    });

    for (let i = 0; i < files.length; i++) {
        const renamed = await askName(files[i]);
        resultFiles.push(renamed);
    }

    return resultFiles;
};

// Redirect triggers to new Queue
window.triggerUpload = function (folder) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
        if (e.target.files.length > 0) {
            const filesToUpload = await promptForFileNamesAndReturn(e.target.files);
            addToUploadQueue(filesToUpload, folder ? folder + "/" : "");
        }
    };
    input.click();
};

// Mobile upload trigger — uses mobileCurrentPath as the folder
window.mobileTriggerUpload = function () {
    if (!mobileCurrentPath || mobileCurrentPath === 'Autres') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
        if (e.target.files.length > 0) {
            const filesToUpload = await promptForFileNamesAndReturn(e.target.files);
            addToUploadQueue(filesToUpload, mobileCurrentPath + "/");
        }
    };
    input.click();
};

// --- Improved Drag & Drop ---
window.handleDragOver = function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
};

window.handleDragLeave = function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

window.handleDrop = async function (e, folder) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const filesToUpload = await promptForFileNamesAndReturn(e.dataTransfer.files);
        addToUploadQueue(filesToUpload, folder + "/");
    }
};

// Global Drop Zone prevention (prevent opening file in browser)
window.addEventListener("dragover", function (e) {
    e = e || event;
    e.preventDefault();
}, false);
window.addEventListener("drop", function (e) {
    e = e || event;
    e.preventDefault();
}, false);

window.deleteFile = function (key) {
    showConfirmModal(
        "Supprimer le fichier ?",
        `Voulez-vous vraiment supprimer "<b>${key.split('/').pop()}</b>" ?<br>Cette action est irréversible.`,
        async () => {
            try {
                await api.deleteFile(key);
                showSuccessModal("Fichier supprimé.");
                await refreshAdminData();
            } catch (e) {
                alert("Erreur suppression: " + e.message);
            }
        }
    );
};

// --- Access Control (Modal) ---
window.openAccessModal = async function (path) {
    // Show loading
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'access-modal';
    overlay.innerHTML = `<div class="modal-box" style="text-align:center"><h3>Chargement...</h3></div>`;
    document.body.appendChild(overlay);

    try {
        // Fetch users and current access in parallel
        const [usersData, currentAccess] = await Promise.all([
            api.listUsers(),
            api.getFileAccess(path)
        ]);

        // usersData might be {users: [], ... } or array depending on worker response
        // My worker currently returns array of local user objects (lines 240 in worker.js)
        const users = Array.isArray(usersData) ? usersData : (usersData.users || []);

        // currentAccess is array of user_ids from worker

        // Build Modal Content
        const modalBox = document.getElementById('access-modal').querySelector('.modal-box');
        modalBox.style.textAlign = 'left';
        modalBox.style.minWidth = '400px';

        // Extract display name for path
        const displayPath = path.split('/').pop() || path;

        let html = `
        <div class="modal-header">Gérer l'accès : ${displayPath}</div>
        <p style="color:#666; font-size:14px; margin-bottom:16px;">
            Sélectionnez les utilisateurs qui peuvent voir ce fichier/dossier.<br>
                <small>Si aucun utilisateur n'est sélectionné, l'élément est visible par tous.</small>
        </p>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #E5E5EA; border-radius: 8px; padding: 0;">
            `;

        if (users.length === 0) {
            html += `<div style="padding:16px; color:#888; text-align:center;">Aucun utilisateur trouvé.</div>`;
        } else {
            users.forEach(u => {
                const isChecked = currentAccess.includes(u.id) ? 'checked' : '';
                const displayName = u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email;
                html += `
                    <label style="display:flex; align-items:center; padding:12px; cursor:pointer; border-bottom:1px solid #f0f0f0;">
                        <input type="checkbox" class="access-checkbox" value="${u.id}" ${isChecked} style="margin-right:12px; width:18px; height:18px; accent-color:#007AFF;">
                        <div>
                            <div style="font-weight:500; font-size:15px;">${displayName}</div>
                            <div style="font-size:12px; color:#888;">${u.email} - ${u.role}</div>
                        </div>
                    </label>
                `;
            });
        }

        html += `
        </div>
        <div class="modal-actions" style="margin-top:20px;">
            <button class="btn-secondary" onclick="closeModal('access-modal')">Annuler</button>
            <button class="btn-primary" onclick="saveFileAccess('${path.replace(/'/g, "\\'")}')">Enregistrer</button>
    </div>
        `;

        modalBox.innerHTML = html;

    } catch (e) {
        alert("Erreur chargement accès : " + e.message);
        closeModal('access-modal');
    }
};

window.saveFileAccess = async function (path) {
    const checkboxes = document.querySelectorAll('#access-modal .access-checkbox:checked');
    const userIds = Array.from(checkboxes).map(cb => cb.value);

    // UX: Show saving
    const btn = document.querySelector('#access-modal .btn-primary');
    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = "Enregistrement...";
        btn.disabled = true;
    }

    try {
        await api.setFileAccess(path, userIds);
        showSuccessModal("Permissions mises à jour avec succès.");
        closeModal('access-modal');
        // Refresh badges without full reload
        if (adminCurrentFolder === null) {
            renderAdminFolders();
        } else {
            renderAdminFiles(adminCurrentFolder);
        }
    } catch (e) {
        alert("Erreur enregistrement : " + e.message);
        if (btn) {
            btn.innerText = "Enregistrer"; // Reset
            btn.disabled = false;
        }
    }
};

window.handleAdminGlobalSearch = function (query) {
    const term = query.toLowerCase().trim();
    if (!term) {
        // Restore previous view
        if (adminCurrentFolder === null) {
            renderAdminFolders();
        } else {
            renderAdminFiles(adminCurrentFolder);
        }
        return;
    }

    // Unselect nav
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));

    // Global Search Algorithm
    // For Folders
    const matchedFolders = new Set();
    // For Files
    const matchedFiles = [];

    adminFilesCache.forEach(file => {
        const parts = file.key.split('/');
        const name = parts[parts.length - 1];
        if (name && !name.startsWith('.meta_') && !name.endsWith('.keep')) {
            if (name.toLowerCase().includes(term)) {
                matchedFiles.push(file);
            }
        }

        if (parts.length > 1) {
            const folderName = parts[0];
            if (folderName.toLowerCase().includes(term)) {
                matchedFolders.add(folderName);
            }
        }
    });

    // Render results
    const content = document.getElementById('admin-content');

    let html = `
        <header>
            <div style="display:flex; align-items:center; gap:16px;">
                <h1 style="margin:0;">Résultats pour "${query}"</h1>
            </div>
            <div class="actions">
                <button class="btn-danger" id="deleteSelectedBtn" style="display:none; align-items:center; gap:8px;" onclick="deleteSelectedItems()">🗑️ Supprimer la sélection (<span id="selectedCount">0</span>)</button>
            </div>
        </header>

        <div class="table-container" style="flex:1;">
            <table>
                <thead>
                    <tr>
                        <th style="width:40px; text-align:center;"><input type="checkbox" id="selectAllCheckbox" onclick="toggleSelectAll(this)" style="cursor:pointer; transform: scale(1.2);"></th>
                        <th style="width:40px"></th>
                        <th>Nom</th>
                        <th>Chemin</th>
                        <th>Taille</th>
                        <th style="text-align: right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    `;

    Array.from(matchedFolders).sort().forEach(folder => {
        html += `
            <tr class="folder-row" onclick="renderAdminFiles('${folder}'); document.getElementById('admin-global-search').value='';" style="cursor:pointer">
                <td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox" class="item-checkbox" data-path="${folder}" data-type="folder" onclick="updateSelectedCount()" style="cursor:pointer; transform: scale(1.2);"></td>
                <td style="font-size:20px; text-align:center;">📁</td>
                <td style="font-weight:600">${folder}</td>
                <td style="color:#888; font-size:13px;">Dossier</td>
                <td>-</td>
                <td style="text-align: right">
                    <button class="btn-sm btn-danger" onclick="event.stopPropagation(); deleteFolder('${folder}')">Supprimer</button>
                </td>
            </tr>
        `;
    });

    matchedFiles.forEach(file => {
        const name = file.key.split('/').pop();
        const ext = name.split('.').pop().toLowerCase();
        let icon = '📄';
        if (['pdf'].includes(ext)) icon = '📕';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) icon = '🖼️';
        if (['doc', 'docx'].includes(ext)) icon = '📘';
        if (['xls', 'xlsx', 'csv'].includes(ext)) icon = '📊';

        const parentPath = file.key.substring(0, file.key.lastIndexOf('/')) || "Racine";

        html += `
                    <tr onclick="window.openFile(this.getAttribute('data-key'))" data-key="${file.key.replace(/" /g, '&quot;')}" style="cursor: pointer; transition: background-color 0.2s;">
                    <td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox" class="item-checkbox" data-path="${file.key.replace(/" /g, '&quot;')}" data-type="file" onclick="updateSelectedCount()" style="cursor:pointer; transform: scale(1.2);"></td>
                    <td style="font-size:20px; text-align:center;">${icon}</td>
                    <td>${name}</td>
                    <td style="color:#888; font-size:13px;">${parentPath}</td>
                    <td>${(file.size / 1024).toFixed(1)} KB</td>
                    <td style="text-align: right">
                        <button class="btn-sm btn-danger" onclick="event.stopPropagation(); deleteFile('${file.key.replace(/'/g, "\\'")}')">Supprimer</button>
                </td>
            </tr>
            `;
    });

    if (matchedFolders.size === 0 && matchedFiles.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center; padding:50px; color:#888;">Aucun résultat trouvé.</td></tr>`;
    }

    html += `</tbody></table></div>`;
    content.innerHTML = html;
};

window.renderAdminMaterialRequests = async function () {
    adminCurrentFolder = null;
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
                                    <button class="mat-btn ordered" onclick="updateReqStatus('${req.id}', 'ordered')" title="Commander">📦 Commander</button>
                                    <button class="mat-btn refused" onclick="updateReqStatus('${req.id}', 'refused')" title="Refuser">❌ Refuser</button>
                                    <button class="mat-btn received" onclick="updateReqStatus('${req.id}', 'received')" title="Livrer">✅ Livrer</button>
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

        window.updateReqStatus = async (id, status) => {
            try {
                const profile = await auth.getCurrentProfile();
                const adminName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Admin';

                // Now we just update status, deletion happens during archiving
                await api.updateMaterialRequestStatus(id, status, adminName);
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
window.renderAdminVehicles = async function () {
    adminCurrentFolder = null;
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
    try {
        const requests = await api.getMaterialRequests();
        const badgeSecteur = window.currentUserProfile?.secteur || 'AIA';
        const sectorRequests = badgeSecteur === 'Tout'
            ? requests
            : requests.filter(r => r.profiles?.secteur === badgeSecteur);
        const pendingCount = sectorRequests.filter(r => r.status === 'requested').length;
        const badge = document.getElementById('mat-request-badge');
        if (badge) {
            if (pendingCount > 0) {
                badge.textContent = pendingCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn("Could not update material badge", e);
    }
};

// Global badge update for admin sidebar (Material Stock Modifications)
window.updateMaterialStockBadge = async function () {
    try {
        const requests = await api.getMaterialStockRequests();
        const pendingCount = requests.filter(r => r.status === 'pending').length;

        // Sidebar badge
        const sidebarBadge = document.getElementById('mat-stock-request-badge');
        if (sidebarBadge) {
            if (pendingCount > 0) {
                sidebarBadge.textContent = pendingCount;
                sidebarBadge.style.display = 'flex';
            } else {
                sidebarBadge.style.display = 'none';
            }
        }

        // Internal button badge (if view is open)
        const innerBadge = document.getElementById('requests-badge');
        const innerBtn = document.getElementById('material-requests-btn');
        if (innerBadge) {
            if (pendingCount > 0) {
                innerBadge.textContent = pendingCount;
                innerBadge.style.display = 'block';
                if (innerBtn) innerBtn.classList.add('clignotant');
            } else {
                innerBadge.style.display = 'none';
                if (innerBtn) innerBtn.classList.remove('clignotant');
            }
        }
    } catch (e) {
        console.warn("Could not update material stock badge", e);
    }
};

// --- MOBILE VEHICLES LIST ---
window.renderMobileVehiclesList = async function (myVehicleData) {
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    const searchContainer = document.querySelector('.mobile-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');

    document.getElementById('selected-category-title').innerText = "Véhicules";
    document.getElementById('mobile-upload-btn').style.display = 'none';

    mobileCurrentPath = "vehicule_list";

    const container = document.getElementById('list-content');
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const cardBg = dk ? '#1C1C1E' : '#fff';
    const textColor = dk ? '#FFFFFF' : '#1c1c1e';
    const border = dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    let html = `<div style="padding: 16px;">`;

    if (myVehicleData && myVehicleData.assigned) {
        html += `
            <h3 style="color: #8E8E93; font-size: 13px; text-transform: uppercase; margin: 10px 0 12px 4px; letter-spacing: 0.5px;">Mon Véhicule</h3>
            <div onclick="window.renderMobileVehicleApp(${JSON.stringify(myVehicleData.assigned).replace(/"/g, '&quot;')})" style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; padding: 16px; display: flex; align-items: center; gap: 16px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                <div style="width: 48px; height: 48px; background: #34C759; border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow:hidden;">
                    <img src="${config.api.workerUrl}/get/vehicles/photos/${myVehicleData.assigned.id}.png?t=${Date.now()}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3202/3202926.png'; this.style.filter='invert(1)'; this.style.opacity='0.2'; this.style.width='24px';" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: ${textColor}; font-size: 17px;">${myVehicleData.assigned.make} ${myVehicleData.assigned.model}</div>
                    <div style="font-size: 14px; color: #8E8E93; font-family: monospace;">${myVehicleData.assigned.plate_number}</div>
                </div>
                <div style="color: #8E8E93; font-size: 20px;">›</div>
            </div>
        `;
    }

    if (myVehicleData && myVehicleData.common && myVehicleData.common.length > 0) {
        html += `<h3 style="color: #8E8E93; font-size: 13px; text-transform: uppercase; margin: 0 0 12px 4px; letter-spacing: 0.5px;">Véhicules Communs</h3>`;
        myVehicleData.common.forEach(cv => {
            html += `
                <div onclick="window.renderMobileVehicleApp(${JSON.stringify(cv).replace(/"/g, '&quot;')})" style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; padding: 16px; display: flex; align-items: center; gap: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                    <div style="width: 48px; height: 48px; background: #007AFF; border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow:hidden;">
                        <img src="${config.api.workerUrl}/get/vehicles/photos/${cv.id}.png?t=${Date.now()}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3202/3202926.png'; this.style.filter='invert(1)'; this.style.opacity='0.2'; this.style.width='24px';" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: ${textColor}; font-size: 17px;">${cv.make} ${cv.model}</div>
                        <div style="font-size: 14px; color: #8E8E93; font-family: monospace;">${cv.plate_number}</div>
                    </div>
                    <div style="color: #8E8E93; font-size: 20px;">›</div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
};

// --- MOBILE VEHICLE APP ---
window.renderMobileVehicleApp = async function (vehicle) {
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    const searchContainer = document.querySelector('.mobile-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');

    document.getElementById('selected-category-title').innerText = "Véhicule";
    document.getElementById('mobile-upload-btn').style.display = 'none';

    mobileCurrentPath = "auto_detail";

    const container = document.getElementById('list-content');
    container.innerHTML = `<div style="text-align:center; padding: 40px;"><div class="loader-spinner"></div></div>`;

    try {
        const logs = await api.getVehicleAllLogs(vehicle.id);
        const dk = document.documentElement.getAttribute('data-theme') === 'dark';
        const cardBg = dk ? '#1C1C1E' : '#fff';
        const textColor = dk ? '#FFFFFF' : '#1c1c1e';
        const border = dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

        let html = `
            <div style="padding: 16px; padding-bottom: 100px;">
                <!-- Vehicle Card -->
                <div style="background: linear-gradient(135deg, #1a1a1c, #2a2a2c); border-radius: 28px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 12px 24px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.05);">
                    <div style="width: 100%; height: 160px; position: relative;">
                         <img src="${config.api.workerUrl}/get/vehicles/photos/${vehicle.id}.png?t=${Date.now()}" onerror="this.src='https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800'; this.style.opacity='0.1';" style="width: 100%; height: 100%; object-fit: cover;">
                         <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(transparent, rgba(0,0,0,0.8));">
                             <div style="font-size: 13px; color: rgba(255,255,255,0.7); font-weight: 500;">${vehicle.assigned_user_id ? 'Mon véhicule' : 'Véhicule commun'}</div>
                             <div style="font-size: 22px; font-weight: 800; color: white;">${vehicle.make || ''} ${vehicle.model || 'Auto'}</div>
                         </div>
                    </div>
                    <div style="padding: 20px; display: flex; gap: 12px; align-items: center; background: rgba(52, 199, 89, 0.1);">
                        <span style="background: white; color: black; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-family: monospace; font-size: 16px;">${vehicle.plate_number}</span>
                    </div>
                </div>

                <!-- Mileage Card -->
                <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <div style="font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 600;">Kilométrage actuel</div>
                            <div style="font-size: 32px; font-weight: 800; color: ${textColor};">${(vehicle.last_mileage || 0).toLocaleString()} <span style="font-size: 16px; font-weight: 600; color: #8E8E93;">km</span></div>
                        </div>
                        <button class="btn-primary" onclick="window.updateMobileMileage('${vehicle.id}', ${vehicle.last_mileage || 0})" style="padding: 10px 20px; border-radius: 12px; background: #34C759;">Mettre à jour</button>
                    </div>
                    <div style="font-size: 12px; color: #8E8E93;">Dernier relevé : ${vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleDateString('fr-FR') : '--'}</div>
                </div>

                <!-- CT Card -->
                <div id="mobile-ct-card" style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between;">
                    <div style="flex: 1;">
                        <div style="font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 600;">Contrôle Technique</div>
                        <div id="mobile-ct-status" style="font-size: 17px; font-weight: 700; color: ${textColor}; margin-top: 4px;">--</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                         <button class="btn-primary" onclick="window.updateMobileCT('${vehicle.id}')" style="padding: 8px 16px; border-radius: 10px; background: #5856D6; font-size: 13px;">Mettre à jour</button>
                         <div id="mobile-ct-badge" style="width: 12px; height: 12px; border-radius: 50%; background: #8E8E93;"></div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
                    <button style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; cursor: pointer;" onclick="reportMobileVehicleIssue('${vehicle.id}')">
                        <span style="font-size: 24px;">⚠️</span>
                        <span style="font-weight: 600; color: ${textColor}; font-size: 14px;">Signaler un souci</span>
                    </button>
                    <button style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; cursor: pointer;" onclick="window.logMobileFuel('${vehicle.id}', '${vehicle.dkv_card || ''}')">
                        <span style="font-size: 24px;">⛽</span>
                        <span style="font-weight: 600; color: ${textColor}; font-size: 14px;">Plein essence</span>
                    </button>
                </div>

                <!-- History -->
                <h3 style="font-size: 18px; margin: 0 0 16px 4px; color: ${textColor};">Historique récent</h3>
        `;

        if (logs.length === 0) {
            html += `<div style="text-align:center; padding: 24px; color: #8E8E93;">Aucun historique</div>`;
        } else {
            logs.slice(0, 5).forEach(log => {
                const icon = log.type === 'mileage' ? '📍' : (log.type === 'issue' ? '⚠️' : (log.type === 'fuel' ? '⛽' : '🔧'));
                html += `
                    <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; padding: 14px; margin-bottom: 10px; display: flex; gap: 14px; align-items: center;">
                        <div style="font-size: 20px; background: ${dk ? '#2C2C2E' : '#f2f2f7'}; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px;">${icon}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: ${textColor}; font-size: 14px;">
                                ${log.type === 'mileage' ? `Mise à jour : ${parseInt(log.value).toLocaleString()} km` : (log.type === 'fuel' ? `Plein : ${log.value} €` : log.description)}
                            </div>
                            <div style="font-size: 11px; color: #8E8E93;">${new Date(log.created_at).toLocaleDateString('fr-FR')} à ${new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        container.innerHTML = html;

        // CT Live Status Update
        const ctStatusEl = document.getElementById('mobile-ct-status');
        const ctBadgeEl = document.getElementById('mobile-ct-badge');
        if (vehicle.last_ct_date && ctStatusEl && ctBadgeEl) {
            const lastCt = new Date(vehicle.last_ct_date);
            const nextCt = new Date(lastCt);
            nextCt.setMonth(nextCt.getMonth() + (vehicle.ct_interval_months || 12));
            const today = new Date();
            const diffDays = Math.ceil((nextCt - today) / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
                ctStatusEl.innerText = "À faire immédiatement !";
                ctStatusEl.style.color = "#FF3B30";
                ctBadgeEl.style.background = "#FF3B30";
            } else if (diffDays <= 60) {
                ctStatusEl.innerText = `Échéance le ${nextCt.toLocaleDateString('fr-FR')} (dans ${diffDays} j.)`;
                ctStatusEl.style.color = "#FF9500";
                ctBadgeEl.style.background = "#FF9500";
            } else {
                ctStatusEl.innerText = `Valable jusqu'au ${nextCt.toLocaleDateString('fr-FR')}`;
                ctBadgeEl.style.background = "#34C759";
            }
        } else if (!vehicle.last_ct_date && ctStatusEl && ctBadgeEl) {
            ctStatusEl.innerText = "Date non renseignée";
            ctStatusEl.style.color = "#FF9500";
            ctBadgeEl.style.background = "#FF9500";
        }

    } catch (e) {
        container.innerHTML = `<div style="color:red; text-align:center; padding:40px;">Erreur: ${e.message}</div>`;
    }
};

window.mobileAlert = function (title, message) {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#ffffff';
    const textColor = dk ? '#ffffff' : '#1c1c1e';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10005";
    modal.innerHTML = `
        <div class="modal-box" style="padding: 24px; border-radius: 28px; background: ${bg}; width: 80%; max-width: 320px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h3 style="margin-top: 0; margin-bottom: 12px; color: ${textColor}; font-size: 18px;">${title}</h3>
            <p style="font-size: 14px; color: #8E8E93; margin-bottom: 20px; line-height: 1.4;">${message}</p>
            <button class="btn-primary" style="width: 100%; padding: 12px; border-radius: 12px; clip-path: inset(0 round 12px);" onclick="this.closest('.modal-overlay').remove()">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.updateMobileMileage = function (vehicleId, current) {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#ffffff';
    const textColor = dk ? '#ffffff' : '#1c1c1e';
    const inputBg = dk ? '#2C2C2E' : '#f2f2f7';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10001";
    modal.innerHTML = `
        <div class="modal-box" style="padding: 24px; border-radius: 28px; background: ${bg}; width: 90%; max-width: 400px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="margin-top: 0; margin-bottom: 20px; color: ${textColor}; font-size: 20px;">Mettre à jour le compteur</h2>
            
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 8px;">Kilométrage actuel (km)</label>
                <input type="number" id="new-mileage-input" style="width: 100%; padding: 16px; border: none; border-radius: 16px; background: ${inputBg}; color: ${textColor}; font-size: 20px; font-weight: bold;" value="${current || 0}">
                <p style="font-size: 11px; color: #8E8E93; margin-top: 8px;">Dernier relevé : ${current || 0} km</p>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="save-mileage-btn" class="btn-primary" style="flex: 1; background: #34C759;">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('new-mileage-input');
    input.focus();
    input.select();

    document.getElementById('save-mileage-btn').onclick = async () => {
        const val = parseInt(input.value);
        if (isNaN(val) || val < current) {
            window.mobileAlert("Kilométrage invalide", "Veuillez entrer un kilométrage supérieur ou égal à l'actuel (" + current + " km).");
            return;
        }

        const btn = document.getElementById('save-mileage-btn');
        btn.disabled = true;
        btn.innerText = "Enregistrement...";

        try {
            await api.submitVehicleLog({ vehicle_id: vehicleId, type: 'mileage', value: val.toString() });
            const updatedData = await api.getMyVehicle();
            mobileVehicleCache = updatedData;

            let targetVehicle = null;
            if (updatedData.assigned && updatedData.assigned.id === vehicleId) targetVehicle = updatedData.assigned;
            else if (updatedData.common) targetVehicle = updatedData.common.find(v => v.id === vehicleId);

            modal.remove();
            if (targetVehicle) window.renderMobileVehicleApp(targetVehicle);
            else window.renderMobileVehiclesList(updatedData);
        } catch (e) {
            window.mobileAlert("Erreur", e.message);
            btn.disabled = false;
            btn.innerText = "Enregistrer";
        }
    };
};

window.reportMobileVehicleIssue = function (vehicleId) {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#ffffff';
    const textColor = dk ? '#ffffff' : '#1c1c1e';
    const inputBg = dk ? '#2C2C2E' : '#f2f2f7';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10001";
    modal.innerHTML = `
        <div class="modal-box" style="padding: 24px; border-radius: 28px; background: ${bg}; width: 90%; max-width: 400px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="margin-top: 0; margin-bottom: 20px; color: ${textColor}; font-size: 20px;">Signaler un souci</h2>
            
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; color: #8E8E93; margin-bottom: 8px;">Description du problème</label>
                <textarea id="issue-desc-input" style="width: 100%; height: 120px; padding: 16px; border: none; border-radius: 16px; background: ${inputBg}; color: ${textColor}; font-size: 15px; resize: none;" placeholder="Bruit suspect, voyant moteur, choc carrosserie..."></textarea>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="save-issue-btn" class="btn-primary" style="flex: 1; background: #FF3B30;">Signaler</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('issue-desc-input').focus();

    document.getElementById('save-issue-btn').onclick = async () => {
        const desc = document.getElementById('issue-desc-input').value.trim();
        if (!desc) {
            window.mobileAlert("Description manquante", "Veuillez décrire brièvement le problème rencontré.");
            return;
        }

        const btn = document.getElementById('save-issue-btn');
        btn.disabled = true;
        btn.innerText = "Envoi...";

        try {
            await api.submitVehicleLog({ vehicle_id: vehicleId, type: 'issue', description: desc });
            const updatedData = await api.getMyVehicle();
            mobileVehicleCache = updatedData;

            let targetVehicle = null;
            if (updatedData.assigned && updatedData.assigned.id === vehicleId) targetVehicle = updatedData.assigned;
            else if (updatedData.common) targetVehicle = updatedData.common.find(v => v.id === vehicleId);

            modal.remove();
            if (targetVehicle) window.renderMobileVehicleApp(targetVehicle);
            else window.renderMobileVehiclesList(updatedData);
        } catch (e) {
            window.mobileAlert("Erreur", e.message);
            btn.disabled = false;
            btn.innerText = "Signaler";
        }
    };
};

window.logMobileFuel = async function (vehicleId, dkvCard) {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#ffffff';
    const textColor = dk ? '#ffffff' : '#1c1c1e';
    const inputBg = dk ? '#2C2C2E' : '#f2f2f7';

    // Fetch DKV cards for selection if it's a common vehicle OR if we want to allow picking
    let allCards = [];
    try { allCards = await api.getDkvCards(); } catch (e) { }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10001";
    modal.innerHTML = `
        <div class="modal-box" style="padding: 24px; border-radius: 28px; background: ${bg}; width: 90%; max-width: 400px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="margin-top: 0; margin-bottom: 20px; color: ${textColor}; font-size: 20px;">Enregistrer un plein</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 13px; color: #8E8E93; margin-bottom: 6px;">Carte DKV utilisée</label>
                <select id="fuel-dkv" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size: 15px; font-weight: bold;">
                    ${dkvCard ? `<option value="${dkvCard}">Carte du véhicule (${dkvCard})</option>` : ''}
                    <option value="">-- Utiliser une autre carte --</option>
                    ${allCards.map(c => `<option value="${c.card_number}" ${dkvCard === c.card_number ? 'disabled' : ''}>${c.card_number} (${c.description || 'DKV'})</option>`).join('')}
                </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <div>
                    <label style="display: block; font-size: 13px; color: #8E8E93; margin-bottom: 6px;">Volume (Litre)</label>
                    <input type="number" id="fuel-volume" step="0.01" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size: 16px; font-weight: bold;" placeholder="Ex: 45.5">
                </div>
                <div>
                    <label style="display: block; font-size: 13px; color: #8E8E93; margin-bottom: 6px;">Montant (€)</label>
                    <input type="number" id="fuel-amount" step="0.01" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size: 16px; font-weight: bold;" placeholder="Ex: 85.20">
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 13px; color: #8E8E93; margin-bottom: 6px;">Kilométrage au compteur</label>
                <input type="number" id="fuel-km" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size: 16px; font-weight: bold;" placeholder="Km actuel">
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="save-fuel-btn" class="btn-primary" style="flex: 1; background: #34C759;">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('fuel-volume').focus();

    document.getElementById('save-fuel-btn').onclick = async () => {
        const volume = document.getElementById('fuel-volume').value;
        const amount = document.getElementById('fuel-amount').value;
        const km = document.getElementById('fuel-km').value;
        const usedDkv = document.getElementById('fuel-dkv').value;

        if (!volume || !amount || !km || !usedDkv) {
            window.mobileAlert("Champs manquants", "Veuillez remplir le volume, le montant, le kilométrage et sélectionner la carte.");
            return;
        }

        const btn = document.getElementById('save-fuel-btn');
        btn.disabled = true;
        btn.innerText = "Envoi...";

        const description = `Plein : ${volume} L pour ${amount} € à ${km} km (Carte : ${usedDkv})`;

        try {
            await api.submitVehicleLog({
                vehicle_id: vehicleId,
                type: 'fuel',
                value: amount,
                description: description,
                current_mileage: km
            });
            const updatedData = await api.getMyVehicle();
            mobileVehicleCache = updatedData;

            let targetVehicle = null;
            if (updatedData.assigned && updatedData.assigned.id === vehicleId) targetVehicle = updatedData.assigned;
            else if (updatedData.common) targetVehicle = updatedData.common.find(v => v.id === vehicleId);

            modal.remove();
            if (targetVehicle) window.renderMobileVehicleApp(targetVehicle);
            else window.renderMobileVehiclesList(updatedData);
        } catch (e) {
            window.mobileAlert("Erreur", e.message);
            btn.disabled = false;
            btn.innerText = "Enregistrer";
        }
    };
};

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
                                <div id="fuel-stats-grid-tabs" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;"></div>
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

        let totalEuro = 0, totalLiters = 0, avgCons = 0;
        const fuelDataPoints = fuelLogs.map(l => {
            const match = l.description.match(/Plein : ([\d.]+) L pour ([\d.]+) € à ([\d.]+) km/);
            if (match) {
                const [_, vol, eur, kms] = match;
                totalEuro += parseFloat(eur);
                totalLiters += parseFloat(vol);
                return { date: l.created_at, vol: parseFloat(vol), eur: parseFloat(eur), kms: parseFloat(kms) };
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
                    <div style="background: rgba(52, 199, 89, 0.05); padding: 12px; border-radius: 16px; border: 1px solid rgba(52,199,89,0.1); text-align: center;">
                        <div style="font-size: 9px; color: #34C759; font-weight: 800; text-transform: uppercase;">Conso. (L/100)</div>
                        <div style="font-size: 16px; font-weight: 900;">${avgCons > 0 ? avgCons.toFixed(1) : '--'}</div>
                    </div>
                    <div style="background: rgba(0, 122, 255, 0.05); padding: 12px; border-radius: 16px; border: 1px solid rgba(0,122,255,0.1); text-align: center;">
                        <div style="font-size: 9px; color: #007AFF; font-weight: 800; text-transform: uppercase;">Budget (€)</div>
                        <div style="font-size: 16px; font-weight: 900;">${totalEuro.toLocaleString()}</div>
                    </div>
                    <div style="background: rgba(255, 149, 0, 0.05); padding: 12px; border-radius: 16px; border: 1px solid rgba(255,149,0,0.1); text-align: center;">
                        <div style="font-size: 9px; color: #FF9500; font-weight: 800; text-transform: uppercase;">Volume (L)</div>
                        <div style="font-size: 16px; font-weight: 900;">${totalLiters.toLocaleString()}</div>
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

    document.getElementById('admin-fuel-volume').focus();

    document.getElementById('admin-save-fuel-btn').onclick = async () => {
        const volume = document.getElementById('admin-fuel-volume').value;
        const amount = document.getElementById('admin-fuel-amount').value;
        const km = document.getElementById('admin-fuel-km').value;
        const usedDkv = document.getElementById('admin-fuel-dkv').value;

        if (!volume || !amount || !km || !usedDkv) return alert("Veuillez remplir tous les champs.");

        const btn = document.getElementById('admin-save-fuel-btn');
        btn.disabled = true;
        btn.innerText = "Envoi...";

        const description = `Plein : ${volume} L pour ${amount} € à ${km} km (Carte : ${usedDkv})`;

        try {
            await api.submitVehicleLog({
                vehicle_id: vehicleId,
                type: 'fuel',
                value: amount,
                description: description,
                current_mileage: km
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
                        <span style="font-size: 28px;">🛠️</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Maintenance Matériel</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Suivi des entretiens et réparations</p>
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
                    <div style="padding: 30px; border-right: 1px solid rgba(255,255,255,0.1); overflow-y: auto;">
                        <h3 style="margin-top: 0; font-size: 18px; margin-bottom: 24px; display: flex; align-items: center; gap: 10px;">📋 Historique de Maintenance</h3>
                        ${history.length === 0 ? `
                            <div style="text-align: center; color: #8E8E93; padding: 60px 20px;">
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
                        <select id="m-family" class="form-input">
                            <option value="">-- Sélectionner --</option>
                            ${families.map(f => `<option value="${f.name}" ${m?.family === f.name ? 'selected' : ''}>${f.name}</option>`).join('')}
                        </select>
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
                        <label class="form-label">Périodicité Maintenance (mois)</label>
                        <input type="number" id="m-periodicity" class="form-input" value="${m?.periodicity || 12}" min="1" max="60">
                    </div>
                    <div>
                        <label class="form-label">Date Expiration VGP / Contrôle</label>
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
            </div>

            <div style="padding: 24px 30px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button id="save-machine-btn" class="btn-primary" style="padding: 10px 30px; font-weight: 700;">Enregistrer les modifications</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('save-machine-btn').onclick = async () => {
        const btn = document.getElementById('save-machine-btn');
        btn.disabled = true;
        btn.innerText = "Traitement...";

        const data = {
            id: id,
            machine_id: document.getElementById('m-id').value.trim(),
            name: document.getElementById('m-name').value.trim(),
            family: document.getElementById('m-family').value,
            serial_number: document.getElementById('m-serial').value.trim(),
            brand: document.getElementById('m-brand').value.trim(),
            assigned_to: document.getElementById('m-assigned').value.trim(),
            periodicity: parseInt(document.getElementById('m-periodicity').value) || 12,
            status_active: document.getElementById('m-active').checked,
            commissioning_date: document.getElementById('m-commissioning').value || null,
            expiration_date: document.getElementById('m-expiration').value || null,
            comments: document.getElementById('m-comments').value.trim(),
            // Legacy mapping for compatibility
            description: document.getElementById('m-serial').value.trim(),
            type: document.getElementById('m-family').value
        };

        if (!data.machine_id) return (alert("Identifiant requis"), btn.disabled = false, btn.innerText = "Enregistrer");

        try {
            const saved = await api.saveMachine(data);
            const photoInput = document.getElementById('m-photo-input');
            if (photoInput.files.length > 0) {
                btn.innerText = "Upload photo...";
                await api.uploadMachinePhoto(saved.id || id, photoInput.files[0]);
            }
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
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #34C759, #2da140); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(52, 199, 89, 0.2);">
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
                                    <div style="font-size: 32px; margin-bottom: 10px;">🚜</div>
                                    <h3 style="margin:0; font-size: 18px; font-weight: 800; color: #FF9500;">Maintenance Matériel</h3>
                                    <p style="color: #888; font-size: 13px; margin: 10px 0;">Alertes automatiques (Push/Web) avant l'échéance de la prochaine maintenance calculée.</p>
                                </div>
                                <div style="text-align: right; min-width: 250px;">
                                    <div style="font-size: 11px; font-weight: 800; color: #FF9500; margin-bottom: 12px; letter-spacing: 1px;">DÉLAI D'AVERTISSEMENT</div>
                                    <div style="display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                        <input type="range" id="maint-alert-days" min="7" max="60" value="30" style="flex: 1; accent-color: #FF9500;" oninput="document.getElementById('maint-alert-days-val').innerText = this.value + ' jours'" onchange="saveAutoSettings()">
                                        <span id="maint-alert-days-val" style="font-weight: 800; color: white; font-size: 14px; min-width: 65px;">30 jours</span>
                                    </div>
                                </div>
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
    const maintAlertDays = document.getElementById('maint-alert-days').value;

    const maintBadges = document.querySelectorAll('.admin-badge-select.active');
    const maintAlertUserIds = Array.from(maintBadges).map(b => b.dataset.userId);

    const payload = {
        auto_planning: autoPlanning,
        auto_mileage: autoMileage,
        auto_deadline: autoDeadline,
        auto_material: autoMaterial,
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


window.renderAdminFriterie = async function () {
    adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-friterie').classList.add('active');

    const content = document.getElementById('admin-content');
    content.innerHTML = `
        <header style="margin: -32px -40px 32px -40px; padding: 32px 40px 20px; background: rgba(30,30,30,0.85); backdrop-filter: blur(16px); z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
            <h1 style="margin: 0;">Gestion Friterie 🍟</h1>
            <div style="display:flex; gap:12px;">
                <button onclick="window.renderAdminFriterie()" class="btn" style="background:rgba(255,255,255,0.05); border:none; color:white; padding:10px 20px; border-radius:12px; font-weight:700;">🔄 Rafraîchir</button>
                <button onclick="window.adminDeleteAllFritOrdersFromAdmin()" class="btn btn-danger" style="background:#FF3B30; color:white; padding:10px 20px; border-radius:12px; font-weight:800; border:none;">🗑️ TOUT EFFACER</button>
            </div>
        </header>
        <div id="frit-orders-container" style="padding: 20px;">
            <div style="text-align:center; padding:50px; color:#888;">Chargement des commandes...</div>
        </div>
    `;

    try {
        const response = await fetch(`${config.api.workerUrl}/admin/friterie/orders`, {
            headers: { 'Authorization': `Bearer ${(await auth.getSession()).access_token}` }
        });
        if (!response.ok) throw new Error(await response.text());
        const orders = await response.json();

        const container = document.getElementById('frit-orders-container');
        if (orders.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:100px; background:rgba(255,255,255,0.03); border-radius:30px; border:2px dashed rgba(255,255,255,0.05);">
                <div style="font-size:60px; margin-bottom:20px;">🍟</div>
                <h3 style="color:white; margin-bottom:10px;">Aucune commande</h3>
                <p style="color:#888;">Les collaborateurs n'ont pas encore commencé à commander.</p>
            </div>`;
            return;
        }

        // Group by user
        const grouped = {};
        orders.forEach(o => {
            let profile = o.profiles;
            if (Array.isArray(profile)) profile = profile[0];
            const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : `User #${o.user_id.substring(0, 5)}`;
            if (!grouped[name]) grouped[name] = [];
            grouped[name].push(o);
        });

        // Stats summary
        const totalItems = orders.length;
        const totalUsers = Object.keys(grouped).length;

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px; margin-bottom:30px;">
                <div class="glass-panel" style="padding:20px; border-radius:15px; text-align:center;">
                    <div style="font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Commandes Totales</div>
                    <div style="font-size:32px; font-weight:900; color:white;">${totalItems}</div>
                </div>
                <div class="glass-panel" style="padding:20px; border-radius:15px; text-align:center;">
                    <div style="font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Collaborateurs</div>
                    <div style="font-size:32px; font-weight:900; color:#FFD60A;">${totalUsers}</div>
                </div>
                <div class="glass-panel" style="padding:20px; border-radius:15px; text-align:center; cursor:pointer;" onclick="renderAdminNotifications()">
                    <div style="font-size:12px; font-weight:700; color:#888; text-transform:uppercase;">Rappel</div>
                    <div style="font-size:14px; font-weight:600; color:#5856D6; margin-top:10px;">🔔 Envoyer un rappel</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap:20px;">
                ${Object.entries(grouped).map(([name, items]) => `
                    <div class="glass-panel" style="padding:25px; border-radius:25px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;">
                            <h3 style="margin:0; font-size:18px; color:white;">${name}</h3>
                            <span style="background:rgba(255,214,10,0.1); color:#FFD60A; padding:4px 12px; border-radius:10px; font-size:12px; font-weight:800;">${items.length} article(s)</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            ${items.map(o => {
            const date = o.created_at ? new Date(o.created_at) : null;
            const timeStr = date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                                    <div style="padding-left:12px; border-left:4px solid #FFD60A; position:relative;">
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                            <span style="font-weight:700; color:white; font-size:15px;">${o.item_name}</span>
                                            <span style="font-size:10px; color:#555;">${timeStr}</span>
                                        </div>
                                        <div style="font-size:13px; color:#888;">Catégorie: ${o.category}</div>
                                        ${o.details ? `<div style="font-size:13px; color:#aaa;">Style: <b>${o.details}</b></div>` : ''}
                                        ${o.sauce ? `<div style="font-size:13px; color:#FF9500; font-weight:700;">Sauce: ${o.sauce}</div>` : ''}
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        document.getElementById('frit-orders-container').innerHTML = `<div style="color:#FF3B30; padding:20px;">Erreur: ${e.message}</div>`;
    }
};

window.adminDeleteAllFritOrdersFromAdmin = async function () {
    if (!confirm("⚠️ ACTION ADMINISTRATIVE : Voulez-vous vraiment effacer TOUTES les commandes de TOUT LE MONDE ? cette action est irréversible (prévu pour le nettoyage hebdomadaire).")) return;
    try {
        const session = await auth.getSession();
        const res = await fetch(`${config.api.workerUrl}/admin/friterie/orders`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!res.ok) throw new Error(await res.text());
        showSuccessModal("Toutes les commandes ont été effacées avec succès.");
        renderAdminFriterie();
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

window.openMaterialRequestsModal = async function () {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal-box" style="width: 800px; max-height: 80vh; display: flex; flex-direction: column; background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div style="padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
                <h2 style="margin: 0; color: white; font-size: 18px; font-weight: 800;">Demandes de modification de stock</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px; opacity: 0.5;">✕</button>
            </div>
            <div id="requests-list-container" style="padding: 24px; overflow-y: auto; flex: 1;">
                <div style="text-align: center; padding: 40px; color: #8E8E93;">Chargement des demandes...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const requests = await api.getMaterialStockRequests();
        const container = document.getElementById('requests-list-container');

        if (requests.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 60px; color: #8E8E93;">Aucune demande en attente 🌟</div>`;
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; color: white;">
                <thead>
                    <tr style="text-align: left; border-bottom: 2px solid rgba(255,255,255,0.05); color: #8E8E93; font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 12px;">Matériel</th>
                        <th style="padding: 12px;">Utilisateur</th>
                        <th style="padding: 12px;">Modification demandée</th>
                        <th style="padding: 12px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(req => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 16px 12px;">
                                <div style="font-weight: 700; color: white;">${req.material_stock.designation}</div>
                                <div style="font-size: 12px; color: #8E8E93; margin-top: 4px;">
                                    <span>Réf QR: <b>${req.material_stock.qr_ref || '—'}</b></span> • 
                                    <span>Réf Fournisseur: <b>${req.material_stock.reference_fournisseur || '—'}</b></span> • 
                                    <span>Catégorie: <b>${req.material_stock.type || '—'}</b></span>
                                </div>
                                <div style="font-size: 12px; color: #8E8E93; margin-top: 4px;">Actuel: ${req.material_stock.stock_reel} à ${req.material_stock.lieu_de_stockage}</div>
                            </td>
                            <td style="padding: 16px 12px;">
                                ${req.profiles.first_name} ${req.profiles.last_name}
                            </td>
                            <td style="padding: 16px 12px;">
                                ${req.comment ? `
                                <div style="margin-bottom: 10px; font-style: italic; color: #FF9500; font-size: 13px; background: rgba(255,149,0,0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,149,0,0.1);">
                                    <span>💬 Commentaire:</span> <strong>${req.comment}</strong>
                                </div>` : ''}
                                ${req.new_designation && req.new_designation !== req.material_stock.designation ?
                                    `<div style="color: #34C759; font-weight: 800; background: rgba(52,199,89,0.1); padding: 4px 8px; border-radius: 6px; margin-bottom: 4px;">📝 Nom : ${req.material_stock.designation} ➔ <span style="font-size: 1.1em;">${req.new_designation}</span></div>` : ''
                                }
                                ${req.new_reference_fournisseur && req.new_reference_fournisseur !== req.material_stock.reference_fournisseur ?
                                    `<div style="color: #007AFF; font-weight: 800; background: rgba(0,122,255,0.1); padding: 4px 8px; border-radius: 6px; margin-bottom: 4px;">🔢 Réf : ${req.material_stock.reference_fournisseur || '—'} ➔ <span style="font-size: 1.1em;">${req.new_reference_fournisseur}</span></div>` : ''
                                }
                                ${req.new_type && req.new_type !== req.material_stock.type ?
                                    `<div style="color: #AF52DE; font-weight: 800; background: rgba(175,82,222,0.1); padding: 4px 8px; border-radius: 6px; margin-bottom: 4px;">📁 Cat : ${req.material_stock.type || '—'} ➔ <span style="font-size: 1.1em;">${req.new_type}</span></div>` : ''
                                }
                                ${req.new_stock_reel !== req.material_stock.stock_reel ?
                                    `<div style="color: #FF9500; font-weight: 800; background: rgba(255,149,0,0.1); padding: 4px 8px; border-radius: 6px; margin-bottom: 4px;">📦 Stock : ${req.material_stock.stock_reel} ➔ <span style="font-size: 1.1em;">${req.new_stock_reel}</span></div>` :
                                    `<div style="color: #8E8E93; font-size: 12px; padding: 4px 8px;">Stock : ${req.new_stock_reel} (inchangé)</div>`
                                }
                                ${req.new_lieu_de_stockage !== req.material_stock.lieu_de_stockage ?
                                    `<div style="color: #5856D6; font-weight: 800; background: rgba(88,86,214,0.1); padding: 4px 8px; border-radius: 6px;">📍 Lieu : ${req.material_stock.lieu_de_stockage || '—'} ➔ <span style="font-size: 1.1em;">${req.new_lieu_de_stockage}</span></div>` :
                                    `<div style="color: #8E8E93; font-size: 12px; padding: 4px 8px;">Lieu : ${req.new_lieu_de_stockage} (inchangé)</div>`
                                }
                                ${req.new_photo_url ?
                                    `<div style="margin-top: 10px; background: rgba(88,86,214,0.1); border-radius: 12px; padding: 10px; border: 1px solid rgba(88,86,214,0.2);">
                                        <div style="font-size: 11px; color: #5856D6; margin-bottom: 6px; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
                                            <span>📸 Nouvelle Photo</span>
                                            <span style="background: #5856D6; color: white; padding: 1px 4px; border-radius: 4px; font-size: 9px;">DÉTECTÉE</span>
                                        </div>
                                        <div style="width: 100%; height: 120px; background: #000; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                            <img src="${config.api.workerUrl}/get/${req.new_photo_url.replace(/^\/+/, '')}" 
                                                 style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;" 
                                                 onclick="window.open('${config.api.workerUrl}/get/${req.new_photo_url.replace(/^\/+/, '')}', '_blank')"
                                                 onerror="this.style.display='none'; this.parentElement.innerHTML = '<div style=color:#FF3B30;font-size:11px;padding:10px;text-align:center;>⚠️ Erreur de chargement<br><small style=opacity:0.7;>${req.new_photo_url}</small></div>'">
                                        </div>
                                     </div>` : ''
                                }
                            </td>
                            <td style="padding: 16px 12px; text-align: right;">
                                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                    <button onclick="handleMaterialRequest('${req.id}', 'approved')" style="background: #34C759; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer;">Approuver</button>
                                    <button onclick="handleMaterialRequest('${req.id}', 'rejected')" style="background: #FF3B30; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer;">Refuser</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        document.getElementById('requests-list-container').innerHTML = `<div style="color: red; text-align: center;">Erreur: ${e.message}</div>`;
    }
};

window.handleMaterialRequest = async function (id, status) {
    if (!confirm(`Voulez-vous vraiment ${status === 'approved' ? 'approuver' : 'refuser'} cette demande ?`)) return;

    try {
        await api.updateMaterialStockRequestStatus(id, status);
        showToast(status === 'approved' ? "Demande approuvée et stock mis à jour" : "Demande refusée");
        document.querySelector('.modal-overlay').remove();
        window.renderAdminMaterialTracking();
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

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
        const data = await api.getAdminOvertimeAll();
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

    if (!comment) {
        return alert("Veuillez saisir une justification pour ce changement de solde.");
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

window.renderAdminPointage = async function (targetWeek, targetYear) {
    setActiveNav('nav-pointage');
    const container = document.getElementById('admin-content');

    const now = new Date();
    const currentWeek = window.getISOWeekNumber(now);
    const currentYear = now.getFullYear();

    const week = parseInt(targetWeek) || currentWeek;
    const year = parseInt(targetYear) || currentYear;

    // ISO week date range calculation
    const getWeekDateRange = (w, y) => {
        const jan4 = new Date(y, 0, 4);
        const day = jan4.getDay();
        const diffToMonday = jan4.getDate() - day + (day === 0 ? -6 : 1);
        const mondayOfWeek1 = new Date(y, 0, diffToMonday);
        const startOfWeek = new Date(mondayOfWeek1);
        startOfWeek.setDate(mondayOfWeek1.getDate() + (w - 1) * 7);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const startStr = startOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const endStr = endOfWeek.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        return `du ${startStr} au ${endStr}`;
    };

    window.navigatePointageWeek = (currentW, currentY, offset) => {
        let nextW = currentW + offset;
        let nextY = currentY;
        if (nextW < 1) {
            nextW = 52;
            nextY -= 1;
        } else if (nextW > 52) {
            nextW = 1;
            nextY += 1;
        }
        window.renderAdminPointage(nextW, nextY);
    };

    container.innerHTML = `
        <div style="padding: 30px; background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(40px); border-radius: 40px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 12px 40px rgba(0,0,0,0.4);">
            <div class="glass-header" style="display: flex; align-items: center; justify-content: space-between; padding: 25px; background: #121212; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 30px; box-shadow: 0 8px 20px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: linear-gradient(135deg, #FF3B30 0%, #FF9500 100%); width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 8px 16px rgba(255, 59, 48, 0.3);">📝</div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #fff;">Pointage Intelligent</h1>
                        </div>
                        <p style="margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.5);">Suivi hebdomadaire et relances collaborateurs</p>
                    </div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-primary" onclick="exportPointageToExcel(${week}, ${year})" style="display: flex; align-items: center; gap: 8px; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 12px 24px; border-radius: 14px; font-weight: 700; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#2C2C2E'" onmouseout="this.style.background='#1C1C1E'">
                        📊 Exporter Semaine ${week}
                    </button>
                </div>
            </div>

        <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 25px;">
            <div>
                <div class="glass-card" style="background: #121212; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <div style="padding: 22px 30px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="color: #34C759; font-size: 18px;">●</span>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; color: rgba(255,255,255,0.7);">Tableau de bord - Semaine ${week}</span>
                                <span style="font-size: 11px; color: #8E8E93; font-weight: 500; margin-top: 2px;">${getWeekDateRange(week, year)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <!-- Week browsing arrows -->
                            <div style="display: flex; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; height: 38px;">
                                <button onclick="window.navigatePointageWeek(${week}, ${year}, -1)" title="Semaine précédente" style="background: none; border: none; color: white; width: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">◀</button>
                                <div style="width: 1px; background: rgba(255,255,255,0.1); height: 100%;"></div>
                                <button onclick="window.navigatePointageWeek(${week}, ${year}, 1)" title="Semaine suivante" style="background: none; border: none; color: white; width: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">▶</button>
                            </div>
                            <select class="form-input" style="width: auto; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.1); color: white; height: 38px; border-radius: 10px; padding: 0 12px;" id="pointage-week-select" onchange="renderAdminPointage(this.value, document.getElementById('pointage-year-select').value)">
                                ${Array.from({ length: 52 }, (_, i) => i + 1).map(w => `<option value="${w}" style="background-color: #1c1c1e; color: white;" ${w === week ? 'selected' : ''}>S${w}</option>`).join('')}
                            </select>
                            <select class="form-input" style="width: auto; background: #1C1C1E; border: 1px solid rgba(255,255,255,0.1); color: white; height: 38px; border-radius: 10px; padding: 0 12px;" id="pointage-year-select" onchange="renderAdminPointage(document.getElementById('pointage-week-select').value, this.value)">
                                ${[year - 1, year, year + 1].map(y => `<option value="${y}" style="background-color: #1c1c1e; color: white;" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <th style="padding: 18px 30px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px;">Collaborateur</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Lun</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Mar</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Mer</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Jeu</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Ven</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Sam</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Dim</th>
                                    <th style="padding: 18px 15px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Total</th>
                                    <th style="padding: 18px 30px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Statut</th>
                                </tr>
                            </thead>
                            <tbody id="pointage-table-body">
                                <tr><td colspan="10" style="text-align:center; padding: 60px; color: rgba(255,255,255,0.3);">Chargement des données...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div id="pointage-sidebar">
                 <!-- Stats and tools -->
                 <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="glass-card" style="background: #121212; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 800;">Récapitulatif</h3>
                        <div id="pointage-stats-content">
                            <div class="loader" style="margin: auto;"></div>
                        </div>
                    </div>
                    
                    <div class="glass-card" style="background: #121212; border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 28px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 800; color: #34C759;">Notifications</h3>
                        <p style="margin: 0 0 15px 0; font-size: 12px; color: rgba(255,255,255,0.5);">Envoyez un rappel automatique aux collaborateurs qui n'ont pas encore validé leur semaine.</p>
                        <button id="btn-notify-missing" class="btn-primary" style="width: 100%; background: #34C759; border: none; box-shadow: 0 6px 15px rgba(52, 199, 89, 0.3); height: 45px; border-radius: 14px; font-weight: 800; color: white; cursor: pointer;" onclick="notifyMissingPointages()">🔔 Rappel pointage</button>
                    </div>
                 </div>
            </div>
        </div>

        <div class="glass-card" style="margin-top: 30px; background: #121212; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                <span>🛠️ Gestion des Activités de Pointage</span>
            </h3>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255,255,255,0.5);">Ajoutez, renommez ou supprimez les activités sur lesquelles les utilisateurs peuvent pointer.</p>
            <div style="display:flex; gap: 12px; margin-bottom: 20px; max-width: 500px;">
                <input type="text" id="new-activity-name" class="form-input" placeholder="Ajouter une nouvelle activité (ex: Chantier XYZ)..." style="flex:1; height: 44px; font-size:14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; padding: 0 14px;">
                <button onclick="window.adminAddActivity()" class="btn-primary" style="height:44px; padding: 0 25px; font-size:14px; border-radius: 12px; font-weight: 700;">Ajouter l'activité</button>
            </div>
            <div id="activities-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
                <!-- populated dynamically -->
            </div>
        </div>

        <div class="glass-card" style="margin-top: 30px; background: #121212; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                <span>📩 Demandes de Modification de Pointage</span>
            </h3>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255,255,255,0.5);">Acceptez ou refusez les demandes de modification pour redonner l'accès au pointage de la semaine publiée.</p>
            <div id="modification-requests-container" style="overflow-x: auto;">
                <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.3);">Chargement des demandes...</div>
            </div>
        </div>
    </div>
    `;

    // Global helper methods for activities management
    window.renderAdminActivitiesList = function () {
        const container = document.getElementById('activities-list-container');
        if (!container) return;
        container.innerHTML = '';
        (window.presetActivitiesFull || []).forEach(act => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);";
            row.innerHTML = `
                <span id="act-label-${act.id}" style="font-size:13px; color:#fff; font-weight:600;">${window.escapeHTML(act.name)}</span>
                <div style="display:flex; gap: 8px;">
                    <button onclick="window.adminRenameActivity(${act.id}, '${window.escapeHTML(act.name).replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Renommer">✏️</button>
                    <button onclick="window.adminDeleteActivity(${act.id})" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Supprimer">🗑️</button>
                </div>
            `;
            container.appendChild(row);
        });
    };

    window.adminAddActivity = async function () {
        const input = document.getElementById('new-activity-name');
        const name = input.value.trim();
        if (!name) return alert("Veuillez saisir un nom d'activité.");
        try {
            await api.savePointageActivity({ name });
            input.value = '';
            // Reset cache & re-render
            window.presetActivities = [];
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de l'ajout: " + e.message);
        }
    };

    window.adminRenameActivity = async function (id, oldName) {
        const newName = prompt("Saisissez le nouveau nom de l'activité:", oldName);
        if (!newName || newName.trim() === oldName) return;
        try {
            await api.savePointageActivity({ id, name: newName.trim() });
            window.presetActivities = [];
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de la modification: " + e.message);
        }
    };

    window.adminDeleteActivity = async function (id) {
        if (!confirm("Voulez-vous vraiment supprimer cette activité ?")) return;
        try {
            await api.deletePointageActivity(id);
            window.presetActivities = [];
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de la suppression: " + e.message);
        }
    };

    // Render list immediately
    window.renderAdminActivitiesList();

    window.renderAdminModificationRequests = async function () {
        const reqContainer = document.getElementById('modification-requests-container');
        if (!reqContainer) return;
        try {
            const allRequests = await api.getPendingPointageModificationRequests();
            const pointageAdminSecteur = window.currentUserProfile?.secteur || 'AIA';
            const requests = pointageAdminSecteur === 'Tout'
                ? allRequests
                : allRequests.filter(r => r.profiles && r.profiles.secteur === pointageAdminSecteur);
            if (!Array.isArray(requests) || requests.length === 0) {
                reqContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.3); font-size: 13px;">Aucune demande de modification en attente.</div>`;
                return;
            }

            let html = `
                <table class="admin-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <th style="padding: 12px 15px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Collaborateur</th>
                            <th style="padding: 12px 15px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Semaine / Année</th>
                            <th style="padding: 12px 15px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Motif</th>
                            <th style="padding: 12px 15px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            requests.forEach(r => {
                const name = r.profiles ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}` : 'Utilisateur';
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 12px 15px; font-weight: 700; color: #fff;">${window.escapeHTML(name)}</td>
                        <td style="padding: 12px 15px; text-align: center; color: #E5E5EA;">Semaine ${r.week_number} (${r.year})</td>
                        <td style="padding: 12px 15px; color: #8E8E93; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.escapeHTML(r.comment)}">${window.escapeHTML(r.comment || 'Aucun motif')}</td>
                        <td style="padding: 12px 15px; text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button onclick="window.decideModificationRequest('${r.id}', true)" style="background:#34C759; border:none; color:white; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor:pointer; box-shadow: 0 2px 6px rgba(52,199,89,0.2);">Accepter</button>
                                <button onclick="window.decideModificationRequest('${r.id}', false)" style="background:#FF3B30; border:none; color:white; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor:pointer; box-shadow: 0 2px 6px rgba(255,59,48,0.2);">Refuser</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
            reqContainer.innerHTML = html;
        } catch (e) {
            reqContainer.innerHTML = `<div style="color: #FF3B30; text-align: center; padding: 20px; font-size:13px;">Erreur de chargement: ${e.message}</div>`;
        }
    };

    window.decideModificationRequest = async function (requestId, approved) {
        try {
            await api.decidePointageModificationRequest(requestId, approved);
            window.showToast(approved ? "✅ Demande de modification acceptée." : "❌ Demande de modification refusée.");
            await window.renderAdminModificationRequests();
            await renderAdminPointage(week, year);
        } catch (e) {
            alert("Erreur lors de la décision: " + e.message);
        }
    };

    window.renderAdminModificationRequests();

    try {
        const [allUsers, pointages, activities] = await Promise.all([
            api.listUsers(),
            api.getAllPointages(week, year),
            api.getPointageActivities()
        ]);
        const pointageAdminSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = pointageAdminSecteur === 'Tout'
            ? allUsers
            : allUsers.filter(u => u.secteur === pointageAdminSecteur);

        window.adminPointagesCache = pointages;
        window.presetActivitiesFull = activities;
        window.presetActivities = activities.map(a => a.name);
        
        // Render activities list now that we have loaded the dynamic list
        window.renderAdminActivitiesList();

        const tableBody = document.getElementById('pointage-table-body');
        tableBody.innerHTML = '';

        const missingUsers = [];

        users.forEach(user => {
            const userPointages = pointages.filter(p => p.user_id === user.id);
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const dayValues = days.map(dayName => {
                const p = userPointages.find(up => {
                    const d = new Date(up.date);
                    const options = { weekday: 'long', timeZone: 'UTC' };
                    return d.toLocaleDateString('en-US', options) === dayName;
                });
                if (!p) return 0;
                return (p.activities || []).reduce((acc, act) => acc + parseFloat(act.hours || 0), 0);
            });

            const total = dayValues.reduce((acc, v) => acc + v, 0);
            const isFullyComplete = dayValues.slice(0, 5).every(v => v >= 7);

            if (!isFullyComplete) missingUsers.push(user);

            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            row.style.cursor = 'pointer';
            row.className = 'admin-pointage-row';
            row.onclick = () => window.openAdminPointageEditModal(user, week, year);
            row.innerHTML = `
                <td style="padding: 15px 25px;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700; color: #fff;">${window.escapeHTML(user.first_name || '')} ${window.escapeHTML(user.last_name || '')}</span>
                        <span style="font-size: 11px; color: rgba(255,255,255,0.4);">${window.escapeHTML(user.societe || 'Pouchain')}</span>
                    </div>
                </td>
                ${dayValues.map((v, i) => {
                let color = 'rgba(255,255,255,0.2)';
                let bg = 'transparent';
                if (i < 5) {
                    if (v >= 7) { color = '#34C759'; bg = 'rgba(52, 199, 89, 0.05)'; }
                    else if (v > 0) { color = '#FF9500'; bg = 'rgba(255, 149, 0, 0.05)'; }
                    else { color = '#FF3B30'; bg = 'rgba(255, 59, 48, 0.03)'; }
                } else if (v > 0) { color = '#5856D6'; bg = 'rgba(88, 86, 214, 0.05)'; }

                return `<td style="padding: 15px; text-align: center; background: ${bg};">
                                <span style="font-weight: 800; color: ${color}; font-size: 13px;">${v > 0 ? v + 'h' : '-'}</span>
                            </td>`;
            }).join('')}
                <td style="padding: 15px; text-align: center; font-weight: 800; color: #fff; background: rgba(255,255,255,0.02);">${total}h</td>
                <td style="padding: 15px 25px; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; background: ${isFullyComplete ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)'}; color: ${isFullyComplete ? '#34C759' : '#FF3B30'}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid ${isFullyComplete ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)'};">
                        <span style="font-size: 12px;">${isFullyComplete ? '●' : '●'}</span>
                        ${isFullyComplete ? 'OK' : 'Relancer'}
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        const statsContent = document.getElementById('pointage-stats-content');
        statsContent.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Effectif total</span>
                    <span style="font-weight: 800; font-size: 16px;">${users.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Semaines validées</span>
                    <span style="font-weight: 800; font-size: 16px; color: #34C759;">${users.length - missingUsers.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Semaines incomplètes</span>
                    <span style="font-weight: 800; font-size: 16px; color: #FF3B30;">${missingUsers.length}</span>
                </div>
                <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0;"></div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: rgba(255,255,255,0.4);">
                        <span>Progression globale</span>
                        <span>${Math.round(((users.length - missingUsers.length) / users.length) * 100)}%</span>
                    </div>
                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${((users.length - missingUsers.length) / users.length) * 100}%; background: linear-gradient(90deg, #34C759, #32D74B); border-radius: 3px;"></div>
                    </div>
                </div>
            </div>
        `;

        window.lastMissingUsers = missingUsers;

    } catch (e) {
        alert("Erreur lors du chargement des pointages: " + e.message);
    }
};

window.notifyMissingPointages = async function () {
    const users = window.lastMissingUsers;
    if (!users || users.length === 0) return;
    if (!confirm(`Envoyer un rappel aux ${users.length} utilisateurs ?`)) return;
    try {
        await api.notifyMissingPointage(users.map(u => u.id), "Rappel : Vos pointages de la semaine sont incomplets.");
        alert("Notifications envoyées !");
    } catch (e) { alert("Erreur: " + e.message); }
};

window.exportPointageToExcel = async function (week, year) {
    try {
        const [allUsers, pointages] = await Promise.all([api.listUsers(), api.getAllPointages(week, year)]);
        const pointageAdminSecteur = window.currentUserProfile?.secteur || 'AIA';
        const users = pointageAdminSecteur === 'Tout'
            ? allUsers
            : allUsers.filter(u => u.secteur === pointageAdminSecteur);
        if (pointages.length === 0) return alert("Aucun pointage pour cette semaine.");

        const activeUsers = users.filter(user => pointages.some(p => p.user_id === user.id));

        if (activeUsers.length === 0) {
            return alert("Aucun pointage n'a été trouvé pour cette semaine.");
        }

        const defaultPath = `Y:\\Archive\\Doc personnel et Sécurité\\Pointages\\2026\\`;
        try {
            await navigator.clipboard.writeText(defaultPath);
        } catch (err) {
            console.warn("Could not copy path to clipboard:", err);
        }

        let dirHandle = null;
        const useDirectoryPicker = typeof window.showDirectoryPicker === 'function';

        if (useDirectoryPicker) {
            const confirmed = confirm(
                `Vous allez exporter ${activeUsers.length} fichier(s) PDF (un par personne).\n\n` +
                `Le chemin par défaut a été copié dans votre presse-papier :\n` +
                `${defaultPath}\n\n` +
                `⚠️ IMPORTANT : Ne sélectionnez pas directement la racine du lecteur (ex: Y:\\) sinon le navigateur refusera par sécurité.\n` +
                `Double-cliquez pour entrer dans les dossiers jusqu'au dossier final '2026', ou collez le chemin complet dans la barre d'adresse de l'explorateur qui va s'ouvrir.`
            );
            
            if (confirmed) {
                try {
                    dirHandle = await window.showDirectoryPicker();
                } catch (err) {
                    console.warn("Directory picker failed or was cancelled:", err);
                    const fallback = confirm(
                        `Impossible d'accéder au dossier ou action annulée.\n\n` +
                        `Souhaitez-vous télécharger les ${activeUsers.length} fichiers PDF individuellement dans votre dossier 'Téléchargements' par défaut ?`
                    );
                    if (!fallback) return;
                }
            } else {
                return;
            }
        } else {
            const confirmed = confirm(
                `Votre navigateur ne prend pas en charge la sélection directe de dossier.\n` +
                `${activeUsers.length} fichiers PDF vont être téléchargés individuellement dans votre dossier Téléchargements.\n\n` +
                `Continuer ?`
            );
            if (!confirmed) return;
        }

        if (typeof html2pdf === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const monday = window.getMondayOfISOWeek(week, year);

        const formatDM = (d) => {
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            return `${dd}/${mm}`;
        };

        const getPeriodString = (m) => {
            const sunday = new Date(m);
            sunday.setUTCDate(m.getUTCDate() + 6);
            const formatDate = (d) => {
                const dd = String(d.getUTCDate()).padStart(2, '0');
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                return `${dd}/${mm}/${yyyy}`;
            };
            return `Du ${formatDate(m)} au ${formatDate(sunday)}`;
        };

        const periodStr = getPeriodString(monday);

        for (const user of activeUsers) {
            const up = pointages.filter(p => p.user_id === user.id);
            const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
            const userSociete = user.societe || 'Pouchain';

            const container = document.createElement('div');
            container.style.width = '275mm';
            container.style.padding = '10mm';
            container.style.background = '#FFFFFF';
            container.style.color = '#000000';
            container.style.fontFamily = 'Arial, sans-serif';
            container.style.boxSizing = 'border-box';

            let rowsHtml = '';
            const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
            let totalWeekHours = 0;
            let totalWeekNightHours = 0;

            days.forEach((dayName, dayIdx) => {
                const date = new Date(monday);
                date.setUTCDate(monday.getUTCDate() + dayIdx);
                const isoDate = date.toISOString().split('T')[0];

                const p = up.find(pt => pt.date === isoDate) || {
                    date: isoDate,
                    activities: [],
                    night_hours: 0,
                    grand_deplacement: false,
                    vehicule_pouchain: false,
                    repas: "",
                    trajet: ""
                };

                const activities = p.activities || [];
                const numRows = Math.max(3, activities.length);

                const dayTotalHours = activities.reduce((acc, act) => acc + (parseFloat(act.hours) || 0), 0);
                totalWeekHours += dayTotalHours;
                totalWeekNightHours += parseFloat(p.night_hours) || 0;

                const isGreenDay = (dayIdx % 2 === 1);
                const dayBg = isGreenDay ? "#E2EFDA" : "#FFFFFF";
                const dayLabel = `${dayName} ${formatDM(date)}`;

                for (let subIdx = 0; subIdx < numRows; subIdx++) {
                    const act = activities[subIdx] || {};
                    const isFirst = (subIdx === 0);

                    const zoneVal = (p.trajet === "Aucune" || p.trajet === "Aucun") ? "" : (p.trajet || "");
                    const transportVal = p.vehicule_pouchain ? "" : zoneVal;

                    rowsHtml += `<tr style="background: ${dayBg}; text-align: center;">`;
                    if (isFirst) {
                        rowsHtml += `
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; font-weight: bold; vertical-align: middle; font-size: 11px;">${dayLabel}</td>
                        `;
                    }

                    rowsHtml += `
                        <td style="padding: 6px; border: 1px solid #BFBFBF; text-align: left; font-size: 11px;">${act.activity_name || ""}</td>
                        <td style="padding: 6px; border: 1px solid #BFBFBF; font-size: 11px;">${act.hours || ""}</td>
                    `;

                    if (isFirst) {
                        rowsHtml += `
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; font-weight: bold; vertical-align: middle; font-size: 11px;">${dayTotalHours || 0}</td>
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; vertical-align: middle; font-size: 11px;">${p.night_hours || 0}</td>
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; vertical-align: middle; font-size: 11px;">${p.grand_deplacement ? "OUI" : "NON"}</td>
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; vertical-align: middle; font-size: 11px;">${p.repas || ""}</td>
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; vertical-align: middle; font-size: 11px;">${transportVal}</td>
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; vertical-align: middle; font-size: 11px;">${zoneVal}</td>
                            <td rowspan="${numRows}" style="padding: 6px; border: 1px solid #BFBFBF; vertical-align: middle; font-size: 11px;"></td>
                        `;
                    }
                    rowsHtml += `</tr>`;
                }
            });

            rowsHtml += `
                <tr style="background: #D9D9D9; font-weight: bold; text-align: center;">
                    <td colspan="3" style="padding: 8px; border: 1px solid #BFBFBF; text-align: left; font-size: 11px;">TOTAL HEURES SEMAINE</td>
                    <td style="padding: 8px; border: 1px solid #BFBFBF; font-size: 11px;">${totalWeekHours}</td>
                    <td style="padding: 8px; border: 1px solid #BFBFBF; font-size: 11px;">${totalWeekNightHours}</td>
                    <td colspan="5" style="padding: 8px; border: 1px solid #BFBFBF; background: #D9D9D9;"></td>
                </tr>
            `;

            container.innerHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
                    <tr>
                        <td style="background: #DDEBF7; font-weight: bold; color: #1F4E78; padding: 8px; border: 1px solid #BFBFBF; width: 40%;">SOCIÉTÉ: ${userSociete.toUpperCase()}</td>
                        <td style="background: #DDEBF7; font-weight: bold; color: #1F4E78; padding: 8px; border: 1px solid #BFBFBF; text-align: center; width: 30%;">SEMAINE: ${week}</td>
                        <td style="background: #DDEBF7; font-weight: bold; color: #1F4E78; padding: 8px; border: 1px solid #BFBFBF; text-align: center; width: 30%;">ANNÉE: ${year}</td>
                    </tr>
                    <tr>
                        <td style="background: #DDEBF7; font-weight: bold; color: #1F4E78; padding: 8px; border: 1px solid #BFBFBF;">COLLABORATEUR: ${userFullName}</td>
                        <td colspan="2" style="background: #DDEBF7; font-weight: bold; color: #1F4E78; padding: 8px; border: 1px solid #BFBFBF; text-align: center;">PÉRIODE: ${periodStr}</td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #375623; color: #FFFFFF; font-weight: bold; text-align: center;">
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 12%; font-size: 11px;">Jour</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 28%; font-size: 11px;">Activité</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 8%; font-size: 11px;">Heures</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 10%; font-size: 11px;">Durée totale</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 10%; font-size: 11px;">Heures de Nuit</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 6%; font-size: 11px;">GD</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 10%; font-size: 11px;">Repas</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 8%; font-size: 11px;">Transport</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 8%; font-size: 11px;">Zone</th>
                            <th style="padding: 8px; border: 1px solid #BFBFBF; width: 6%; font-size: 11px;">Prime</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            `;

            const formattedName = `${user.last_name || ''}_${user.first_name || ''}`.trim() || user.email;
            const safeName = formattedName.replace(/[^a-zA-Z0-9_ -]/g, "");
            const filename = `Recap_Hebdo_S${week}_${year}_${safeName}.pdf`;

            const pdfBlob = await html2pdf().from(container).set({
                margin: 0,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            }).output('blob');

            if (dirHandle) {
                const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(pdfBlob);
                await writable.close();
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(pdfBlob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

        if (dirHandle) {
            window.showToast("🚀 Export PDF par personne terminé avec succès !");
        }
    } catch (e) {
        alert("Erreur lors de l'export PDF: " + e.message);
        console.error(e);
    }
};

window.exportOvertimeToExcel = async function () {
    try {
        const data = await api.getAdminOvertimeAll();
        if (data.length === 0) return alert("Aucune donnée à exporter.");

        const headers = ["Employé", "Email", "Solde Heures Sup (h)"];
        const rows = data.map(u => [
            `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
            u.email,
            u.overtime_balance || 0
        ]);

        let csvContent = "\ufeff" + headers.join(";") + "\n";
        rows.forEach(r => {
            csvContent += r.map(cell => `"${cell}"`).join(";") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `Recap_Heures_Sup_${today}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Erreur lors de l'export: " + e.message);
    }
};

window.getMondayOfISOWeek = function (w, y) {
    const simple = new Date(Date.UTC(y, 0, 4));
    const day = simple.getUTCDay() || 7;
    simple.setUTCDate(simple.getUTCDate() - day + 1);
    simple.setUTCDate(simple.getUTCDate() + (w - 1) * 7);
    return simple;
};

window.generateAdminActivityRowHtml = function (isoDate, idx, act = { activity_name: '', hours: 7 }) {
    return `
        <div class="admin-activity-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
            <input type="text" list="preset-activities-list" class="form-input p-act-name" data-date="${isoDate}" data-idx="${idx}" value="${window.escapeHTML(act.activity_name || '')}" placeholder="Activité (ex: Montage AIA 1...)" style="flex: 1; height: 38px; padding: 0 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; font-size: 14px;">
            <select class="form-input p-act-hours" data-date="${isoDate}" data-idx="${idx}" style="width: 90px; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; padding: 0 8px; font-size: 14px; font-weight: 700;">
                ${HOUR_OPTIONS.map(h => `<option value="${h}" style="background-color: #1c1c1e; color: white;" ${parseFloat(act.hours) === h ? 'selected' : ''}>${h}h</option>`).join('')}
            </select>
            <button onclick="this.parentElement.remove()" style="background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); color: #FF3B30; border-radius: 10px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;">✕</button>
        </div>
    `;
};

window.addAdminActivityToDay = function (isoDate) {
    const container = document.getElementById(`admin-activities-${isoDate}`);
    const idx = container.querySelectorAll('.admin-activity-row').length;
    const div = document.createElement('div');
    div.innerHTML = window.generateAdminActivityRowHtml(isoDate, idx, { activity_name: '', hours: 7 });
    container.appendChild(div.firstElementChild);
};

window.openAdminPointageEditModal = function (user, week, year) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000001';
    modal.style.backdropFilter = 'blur(10px)';

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const monday = window.getMondayOfISOWeek(week, year);

    let daysHtml = '';

    days.forEach((dayName, i) => {
        const date = new Date(monday);
        date.setUTCDate(monday.getUTCDate() + i);
        const isoDate = date.toISOString().split('T')[0];
        const dateDisplay = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

        // Find existing pointage in cache
        const p = (window.adminPointagesCache || []).find(pt => pt.user_id === user.id && pt.date === isoDate) || {
            date: isoDate,
            activities: i < 5 ? [{ activity_name: '', hours: 7 }] : [],
            night_hours: 0,
            grand_deplacement: false,
            vehicule_pouchain: false,
            repas: "Aucun",
            trajet: "Aucune"
        };

        const isWeekend = i >= 5;

        daysHtml += `
            <div class="day-card" data-date="${isoDate}" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                    <div>
                        <span style="font-weight: 800; font-size: 16px; color: ${isWeekend ? '#8E8E93' : '#fff'};">${dayName}</span>
                        <span style="font-size: 13px; color: #8E8E93; margin-left: 8px;">${dateDisplay}</span>
                    </div>
                    ${isWeekend ? '<span style="font-size: 10px; font-weight: 800; color: #8E8E93; text-transform: uppercase; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 6px;">Week-end</span>' : ''}
                </div>
 
                <div class="day-activities" id="admin-activities-${isoDate}">
                    ${(p.activities || []).map((act, idx) => window.generateAdminActivityRowHtml(isoDate, idx, act)).join('')}
                </div>
                
                <button onclick="window.addAdminActivityToDay('${isoDate}')" style="background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); width: 100%; padding: 10px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 15px; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">+ Ajouter activité</button>
 
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                    <div class="form-group">
                        <label style="font-size: 11px; font-weight: 800; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 6px;">Repas</label>
                        <select class="p-repas-select" data-date="${isoDate}" style="width: 100%; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0 8px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                            ${MEAL_OPTIONS.map(opt => `<option value="${opt}" style="background-color: #1c1c1e; color: white;" ${p.repas === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-size: 11px; font-weight: 800; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 6px;">Zone</label>
                        <select class="p-trajet-select" data-date="${isoDate}" style="width: 100%; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0 8px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                            ${TRAJET_OPTIONS.map(opt => `<option value="${opt}" style="background-color: #1c1c1e; color: white;" ${p.trajet === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" class="p-gd-check" data-date="${isoDate}" ${p.grand_deplacement ? 'checked' : ''} style="width: 18px; height: 18px; border-radius: 4px; cursor: pointer;" />
                            <label style="font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;">Grand Déplacement (GD)</label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 12px; font-weight: 600; color: #8E8E93;">Nuit:</label>
                            <input type="number" class="p-night-input" data-date="${isoDate}" value="${p.night_hours || 0}" step="0.5" style="width: 60px; height: 32px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0 8px; border-radius: 8px; text-align: center; font-size: 13px; font-weight: 800;" />
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="p-vp-check" data-date="${isoDate}" ${p.vehicule_pouchain ? 'checked' : ''} style="width: 18px; height: 18px; border-radius: 4px; cursor: pointer;" />
                        <label style="font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;">Véhicule Pouchain</label>
                    </div>
                </div>
            </div>
        `;
    });

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 90%; max-width: 700px; padding: 40px; border-radius: 32px; background: rgba(28, 28, 30, 0.95); color: white; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 40px 100px rgba(0,0,0,0.6); animation: modalPop 0.3s ease-out; max-height: 95vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-shrink: 0;">
                <div>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: white;">Modifier les pointages</h2>
                    <p style="margin: 4px 0 0 0; color: #8E8E93; font-size: 14px;">Pour ${fullName} — Semaine ${week} (${year})</p>
                </div>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: rgba(255,255,255,0.05); border: none; color: #fff; width: 40px; height: 40px; border-radius: 20px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
 
            <datalist id="preset-activities-list">
                ${(window.presetActivities || PRESET_ACTIVITIES).map(a => `<option value="${a}">`).join('')}
            </datalist>
 
            <div style="flex: 1; overflow-y: auto; padding-right: 10px; margin-bottom: 25px;">
                ${daysHtml}
            </div>
 
            <div style="display: flex; gap: 15px; flex-shrink: 0;">
                <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.05); color: white; border: none; font-weight: 700; cursor: pointer; font-size: 15px;">Annuler</button>
                <button onclick="window.saveAdminPointages('${user.id}', ${week}, ${year}, 'published', this)" style="flex: 2; padding: 16px; border-radius: 16px; background: #007AFF; color: white; border: none; font-weight: 800; cursor: pointer; font-size: 15px; box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);">🚀 Publier la semaine</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.saveAdminPointages = async function (targetUserId, week, year, status, btn) {
    const modal = btn.closest('.modal-overlay');
    const dayCards = modal.querySelectorAll('.day-card');
    const allData = [];

    for (const card of dayCards) {
        const isoDate = card.getAttribute('data-date');
        const activities = [];

        const rowEls = card.querySelectorAll('.admin-activity-row');
        rowEls.forEach(row => {
            const name = row.querySelector('.p-act-name').value.trim();
            const hours = parseFloat(row.querySelector('.p-act-hours').value) || 0;
            if (name && hours > 0) {
                activities.push({ activity_name: name, hours, project_name: "" });
            }
        });



        // Preserving published status: admin cannot downgrade a published week to draft.

        // This protects the lock mechanism on the mobile side.

        const existingPointage = (window.adminPointagesCache || []).find(

            pt => pt.user_id === targetUserId && pt.date === isoDate

        );

        const effectiveStatus = (existingPointage && existingPointage.status === 'published' && status === 'draft')

            ? 'published'

            : status;



        allData.push({
            user_id: targetUserId,
            date: isoDate,
            week_number: week,
            year,
            activities,
            night_hours: parseFloat(card.querySelector('.p-night-input').value) || 0,
            grand_deplacement: card.querySelector('.p-gd-check').checked,
            vehicule_pouchain: card.querySelector('.p-vp-check').checked,
            repas: card.querySelector('.p-repas-select').value,
            trajet: card.querySelector('.p-trajet-select').value,
            status: effectiveStatus
        });
    }

    const oldText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Enregistrement...";

    try {
        await Promise.all(allData.map(data => api.submitPointage(data)));
        window.showToast(status === 'published' ? "🚀 Semaine publiée avec succès !" : "💾 Brouillon enregistré avec succès.");
        modal.remove();
        window.renderAdminPointage(week, year);
    } catch (e) {
        alert("Erreur lors de l'enregistrement: " + e.message);
        btn.disabled = false;
        btn.innerText = oldText;
    }
};

// --- MODULE: GESTION DES CONGÉS (Admin) ---
window.updateCongesBadge = async function () {
    try {
        const requests = await api.getAdminCongeRequests();
        const pendingCount = requests.filter(r => r.status === 'pending').length;
        const badge = document.getElementById('conges-badge');
        if (badge) {
            if (pendingCount > 0) {
                badge.textContent = pendingCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn("Could not update conges badge", e);
    }
};

window.parseCongeAdminComment = function (commentStr) {
    if (!commentStr) return { comment: '', admin_name: '', admin_signature: '' };
    if (typeof commentStr === 'string' && commentStr.startsWith('{') && commentStr.endsWith('}')) {
        try {
            const data = JSON.parse(commentStr);
            return {
                comment: data.comment || '',
                admin_name: data.admin_name || '',
                admin_signature: data.admin_signature || null
            };
        } catch (e) { }
    }
    return { comment: commentStr, admin_name: '', admin_signature: null };
};

async function forceSignatureBlackColor(dataUrlOrUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                // Rendre les pixels blancs/clairs transparents, et les pixels foncés noirs
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    const brightness = (r + g + b) / 3;
                    if (a < 30 || brightness > 220) {
                        // Pixel transparent ou très clair => on le rend transparent
                        data[i + 3] = 0;
                    } else {
                        // Pixel foncé (trait de la signature) => on le force en noir opaque
                        data[i] = 0;
                        data[i + 1] = 0;
                        data[i + 2] = 0;
                        data[i + 3] = 255;
                    }
                }
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                resolve(dataUrlOrUrl);
            }
        };
        img.onerror = () => resolve(dataUrlOrUrl);
        img.src = dataUrlOrUrl;
    });
}

window.generateCongePDFPlaceholder = async function (requestData) {
    console.log("PDF generation started for request:", requestData);
    try {
        const parsedCommentData = window.parseCongeAdminComment(requestData.admin_comment);
        let user = requestData.profiles || {};
        if (Array.isArray(user)) {
            user = user[0] || {};
        }

        // Fallback: If profile details are missing, fetch from getAdminCongeUsers API
        if ((!user.first_name || !user.societe) && requestData.user_id) {
            try {
                console.log("Profile incomplete in requestData, fetching fallback from API...");
                const allUsers = await api.getAdminCongeUsers();
                const matchedUser = allUsers.find(u => u.id === requestData.user_id);
                if (matchedUser) {
                    user = matchedUser;
                    console.log("Fallback user details loaded:", user);
                }
            } catch (err) {
                console.error("Error fetching fallback user details:", err);
            }
        }

        const first_name = user.first_name || requestData.first_name || '';
        const last_name = user.last_name || requestData.last_name || '';
        const secteur = user.secteur || requestData.secteur || '';
        const societeVal = user.societe || requestData.societe || 'Pouchain';
        const societe = societeVal.toLowerCase();


        const templateName = societe === 'cepp'
            ? 'MOD-GRH-04 Demande absence CEPP v2.pdf'
            : 'MOD-GRH-05 Demande absence POUCHAIN v2.pdf';

        console.log(`Loading PDF template: ${templateName}`);

        const response = await fetch(`./${templateName}`);
        if (!response.ok) throw new Error(`Impossible de charger le modèle ${templateName}`);
        const templateBytes = await response.arrayBuffer();

        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(templateBytes);
        const form = pdfDoc.getForm();
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        const nom = (last_name || '').toUpperCase();
        const prenom = first_name || '';
        const service = (societe === 'cepp') ? 'PAC' : ((!secteur || secteur === 'Tout') ? 'PAC' : secteur);

        // Remplir les champs d'identité natifs du formulaire PDF
        form.getTextField('Text1').setText(nom);
        form.getTextField('Text2').setText(prenom);
        form.getTextField('Text3').setText(service);

        const formatStrDate = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        };

        const du = formatStrDate(requestData.start_date);

        const motif = requestData.motif || "CP";

        const getLocalYYYYMMDD = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const getReturnDate = (endDateStr) => {
            let nextDate = new Date(endDateStr + 'T12:00:00');
            do {
                nextDate.setDate(nextDate.getDate() + 1);
            } while (nextDate.getDay() === 0 || nextDate.getDay() === 6 || window.isJoursFerieFrance(getLocalYYYYMMDD(nextDate)));

            return getLocalYYYYMMDD(nextDate);
        };

        const groupConsecutiveDates = (dates) => {
            if (!dates || dates.length === 0) return [];
            const sorted = [...new Set(dates)].filter(d => typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)).sort();
            if (sorted.length === 0) return [];
            const groups = [];
            let currentGroup = [sorted[0]];
            for (let i = 1; i < sorted.length; i++) {
                const prev = new Date(sorted[i - 1] + 'T12:00:00');
                const curr = new Date(sorted[i] + 'T12:00:00');
                const diffTime = Math.abs(curr - prev);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let isConsecutive = false;
                if (diffDays === 1) {
                    isConsecutive = true;
                } else {
                    let tempDate = new Date(prev);
                    tempDate.setDate(tempDate.getDate() + 1);
                    let onlyWeekendsOrHolidays = true;
                    while (tempDate < curr) {
                        const day = tempDate.getDay();
                        const isWeekend = day === 0 || day === 6;
                        const dateStr = getLocalYYYYMMDD(tempDate);
                        const isHoliday = window.isJoursFerieFrance(dateStr);
                        if (!isWeekend && !isHoliday) {
                            onlyWeekendsOrHolidays = false;
                            break;
                        }
                        tempDate.setDate(tempDate.getDate() + 1);
                    }
                    if (onlyWeekendsOrHolidays) {
                        isConsecutive = true;
                    }
                }
                if (isConsecutive) {
                    currentGroup.push(sorted[i]);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [sorted[i]];
                }
            }
            groups.push(currentGroup);
            return groups;
        };

        const countBusinessDays = (datesArray) => {
            let count = 0;
            datesArray.forEach(dStr => {
                const d = new Date(dStr + 'T12:00:00');
                const dayOfWeek = d.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = window.isJoursFerieFrance(dStr);
                if (!isWeekend && !isHoliday) {
                    count++;
                }
            });
            return count;
        };

        let datesList = requestData.dates_list;
        if (typeof datesList === 'string') {
            try { datesList = JSON.parse(datesList); } catch(e) { datesList = []; }
        }

        let dateGroups = [];
        if (Array.isArray(datesList) && datesList.length > 0) {
            try {
                dateGroups = groupConsecutiveDates(datesList);
            } catch (err) {
                console.error("Error grouping dates:", err);
            }
        }

        const maxRows = 3;
        if (dateGroups && dateGroups.length > 0) {
            for (let i = 0; i < Math.min(dateGroups.length, maxRows); i++) {
                const group = dateGroups[i];
                const groupStart = group[0];
                const groupEnd = group[group.length - 1];
                const groupJoursCount = String(countBusinessDays(group));
                const groupRetour = formatStrDate(getReturnDate(groupEnd));

                const duGroup = formatStrDate(groupStart);
                const auGroup = formatStrDate(groupEnd);

                if (societe === 'cepp') {
                    const rowFields = [
                        { du: 'Text4', au: 'Text7', jours: 'Text10', motif: 'Text14', retour: 'Text17' },
                        { du: 'Text5', au: 'Text8', jours: 'Text12', motif: 'Text15', retour: 'Text18' },
                        { du: 'Text6', au: 'Text9', jours: 'Text13', motif: 'Text16', retour: 'Text19' }
                    ];
                    const fields = rowFields[i];
                    form.getTextField(fields.du).setText(duGroup);
                    form.getTextField(fields.au).setText(auGroup);
                    form.getTextField(fields.jours).setText(groupJoursCount);
                    form.getTextField(fields.motif).setText(motif);
                    form.getTextField(fields.retour).setText(groupRetour);
                } else {
                    const rowFields = [
                        { du: 'Text4', au: 'Text5', jours: 'Text6', motif: 'Text7', retour: 'Text8' },
                        { du: 'Text9', au: 'Text11', jours: 'Text12', motif: 'Text13', retour: 'Text14' },
                        { du: 'Text15', au: 'Text16', jours: 'Text17', motif: 'Text18', retour: 'Text19' }
                    ];
                    const fields = rowFields[i];
                    form.getTextField(fields.du).setText(duGroup);
                    form.getTextField(fields.au).setText(auGroup);
                    form.getTextField(fields.jours).setText(groupJoursCount);
                    form.getTextField(fields.motif).setText(motif);
                    form.getTextField(fields.retour).setText(groupRetour);
                }
            }
        } else {
            // Robust fallback if no dates list available or calculation fails
            const du = formatStrDate(requestData.start_date);
            const au = formatStrDate(requestData.end_date);
            const joursCount = String(requestData.days_requested || '0');
            const retour = formatStrDate(getReturnDate(requestData.end_date));

            if (societe === 'cepp') {
                form.getTextField('Text4').setText(du);
                form.getTextField('Text7').setText(au);
                form.getTextField('Text10').setText(joursCount);
                form.getTextField('Text14').setText(motif);
                form.getTextField('Text17').setText(retour);
            } else {
                form.getTextField('Text4').setText(du);
                form.getTextField('Text5').setText(au);
                form.getTextField('Text6').setText(joursCount);
                form.getTextField('Text7').setText(motif);
                form.getTextField('Text8').setText(retour);
            }
        }

        // Date de soumission du collaborateur
        const dateSoumission = formatStrDate(requestData.created_at ? requestData.created_at.split('T')[0] : getLocalYYYYMMDD(new Date()));
        form.getTextField('Text20').setText(`Le ${dateSoumission}`);

        // Cocher la case "acceptées"
        try {
            form.getRadioGroup('Group1').select('Choice1');
        } catch (e) {
            console.warn("Could not select Group1", e);
        }

        // Date et signature du responsable (Text25 pour CEPP, Text24 pour Pouchain)
        // Date et signature du responsable (Text25 pour CEPP, Text24 pour Pouchain)
        const dateAcceptation = formatStrDate(getLocalYYYYMMDD(new Date()));
        let adminName = requestData.admin_name || parsedCommentData.admin_name;
        if (!adminName) {
            const currentAdmin = window.currentUserProfile;
            adminName = currentAdmin ? `${currentAdmin.first_name || ''} ${currentAdmin.last_name || ''}`.trim() : 'Admin';
        }
        const dateRespFieldName = societe === 'cepp' ? 'Text25' : 'Text24';
        form.getTextField(dateRespFieldName).setText(`Le ${dateAcceptation} par ${adminName}`);

        // Dessiner l'image de la signature mobile de façon optimale et sans débordement
        if (requestData.signature) {
            try {
                const blackSigUrl = await forceSignatureBlackColor(requestData.signature);
                const sigImageBytes = await fetch(blackSigUrl).then(res => res.arrayBuffer());
                const sigImage = await pdfDoc.embedPng(sigImageBytes);

                const sigCoords = societe === 'cepp'
                    ? { x: 430, y: 278, width: 90, height: 35 } // <-- Coordonnées de la signature pour CEPP
                    : { x: 430, y: 250, width: 90, height: 35 }; // <-- Coordonnées de la signature pour POUCHAIN

                firstPage.drawImage(sigImage, sigCoords);
            } catch (sigErr) {
                console.warn("Could not embed signature image", sigErr);
            }
        }

        // Dessiner l'image de la signature du responsable
        const adminSignature = requestData.admin_signature || parsedCommentData.admin_signature;
        if (adminSignature) {
            try {
                const blackSigUrl = await forceSignatureBlackColor(adminSignature);
                const sigImageBytes = await fetch(blackSigUrl).then(res => res.arrayBuffer());
                const sigImage = await pdfDoc.embedPng(sigImageBytes);

                const adminSigCoords = societe === 'cepp'
                    ? { x: 430, y: 130, width: 135, height: 52.5 } // <-- Coordonnées de la signature du responsable pour CEPP
                    : { x: 430, y: 85, width: 135, height: 52.5 }; // <-- Coordonnées de la signature du responsable pour POUCHAIN

                firstPage.drawImage(sigImage, adminSigCoords);
            } catch (sigErr) {
                console.warn("Could not embed admin signature image", sigErr);
            }
        }

        // Aplatir le formulaire (flatten) pour intégrer définitivement les textes et supprimer les champs bleus interactifs
        form.flatten();

        const pdfBytes = await pdfDoc.save();

        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Demande_Absence_${nom}_${prenom}_${du.replace(/\//g, '-')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log("PDF generated and download triggered successfully!");
    } catch (err) {
        console.error("Error during PDF generation:", err);
        alert("Erreur de génération PDF: " + err.message);
    }
};

window.renderAdminConges = async function () {
    adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-conges');
    if (navItem) navItem.classList.add('active');

    const content = document.getElementById('admin-content');
    content.innerHTML = `<div style="text-align:center; padding: 50px;"><div class="loader-spinner"></div></div>`;

    try {
        const [requests, users] = await Promise.all([
            api.getAdminCongeRequests(),
            api.getAdminCongeUsers()
        ]);

        const adminSecteur = window.currentUserProfile?.secteur || 'AIA';
        const pendingRequests = requests.filter(r => r.status === 'pending');

    let html = `
        <div style="padding: 30px; background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(40px); border-radius: 40px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 12px 40px rgba(0,0,0,0.4);">
            <!-- Header -->
            <div class="glass-header" style="display: flex; justify-content: space-between; align-items: center; padding: 25px; background: #121212; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 30px; box-shadow: 0 8px 20px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #00C6FF, #0072FF); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0, 198, 255, 0.2);">
                            <span style="font-size: 28px;">🌴</span>
                        </div>
                        <div>
                            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Gestion des Congés</h1>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Secteur : <strong style="color:#00C6FF;">${adminSecteur}</strong> | Gérer les congés et soldes salariés</p>
                        </div>
                    </div>
                    <div>
                        <button onclick="window.renderAdminConges()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                </div>

                <!-- Tabs Selector -->
                <div style="display: flex; gap: 15px; margin-bottom: 24px;">
                    <button class="tab-conge-btn active" id="tab-balances-btn" onclick="window.switchCongeAdminTab('balances')" style="padding: 12px 24px; border-radius: 12px; border: none; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: #007AFF; color: white;">
                        📊 Compteurs Salariés (${users.length})
                    </button>
                    <button class="tab-conge-btn" id="tab-pending-btn" onclick="window.switchCongeAdminTab('pending')" style="padding: 12px 24px; border-radius: 12px; border: none; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: rgba(255,255,255,0.05); color: #8E8E93;">
                        ⏳ Demandes en attente (${pendingRequests.length})
                    </button>
                </div>

                <!-- Scrollable Content Area -->
                <div style="flex: 1; overflow-y: auto; padding-right: 5px;">
                    <!-- Tab 1: Balances (default) -->
                    <div id="conge-tab-balances" class="conge-tab-view">
                        ${renderBalancesSection(users)}
                    </div>

                    <!-- Tab 2: Pending requests -->
                    <div id="conge-tab-pending" class="conge-tab-view" style="display: none;">
                        ${renderPendingRequestsSection(pendingRequests)}
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = html;

        window.switchCongeAdminTab = (tab) => {
            const pendingBtn = document.getElementById('tab-pending-btn');
            const balancesBtn = document.getElementById('tab-balances-btn');
            const pendingView = document.getElementById('conge-tab-pending');
            const balancesView = document.getElementById('conge-tab-balances');

            if (tab === 'pending') {
                pendingBtn.style.background = '#007AFF';
                pendingBtn.style.color = 'white';
                balancesBtn.style.background = 'rgba(255,255,255,0.05)';
                balancesBtn.style.color = '#8E8E93';
                pendingView.style.display = 'block';
                balancesView.style.display = 'none';
            } else {
                balancesBtn.style.background = '#007AFF';
                balancesBtn.style.color = 'white';
                pendingBtn.style.background = 'rgba(255,255,255,0.05)';
                pendingBtn.style.color = '#8E8E93';
                balancesView.style.display = 'block';
                pendingView.style.display = 'none';
            }
        };

        window.filterCongeBalances = () => {
            const q = document.getElementById('conge-search-input').value.toLowerCase().trim();
            const rows = document.querySelectorAll('.conge-balance-row');
            rows.forEach(row => {
                const name = row.getAttribute('data-name').toLowerCase();
                const sector = row.getAttribute('data-sector').toLowerCase();
                if (name.includes(q) || sector.includes(q)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        };

    } catch (e) {
        content.innerHTML = `<div style="color:red; text-align:center; padding:50px;">Erreur de chargement des congés: ${e.message}</div>`;
    }
};

function renderPendingRequestsSection(requests) {
    if (requests.length === 0) {
        return `
            <div style="text-align:center; padding: 60px 20px; background: rgba(255,255,255,0.03); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1);">
                <div style="font-size: 40px; margin-bottom: 12px;">🏝️</div>
                <h3 style="color: white; margin: 0; font-size: 16px;">Aucune demande de congés en attente</h3>
                <p style="color: #666; font-size: 13px; margin: 8px 0 0 0;">Les collaborateurs de votre secteur n'ont pas déposé de demandes en attente de traitement.</p>
            </div>
        `;
    }

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; padding-bottom: 40px;">
            ${requests.map(r => {
        const name = [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(' ') || 'Salarié inconnu';
        const startStr = new Date(r.start_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const endStr = new Date(r.end_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const requestDateStr = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        return `
                    <div class="conge-request-card" style="background: rgba(45, 45, 50, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px; transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
                        <!-- Card Header -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h3 style="margin: 0; color: white; font-size: 17px; font-weight: 700;">${window.escapeHTML(name)}</h3>
                                <span style="font-size: 12px; color: #8E8E93; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 6px; display: inline-block; margin-top: 4px;">Secteur : ${r.profiles?.secteur || 'Non défini'}</span>
                            </div>
                            <span style="font-size: 11px; color: #8E8E93;">Déposée le ${requestDateStr}</span>
                        </div>

                        <!-- Date range -->
                        <div style="background: rgba(255, 255, 255, 0.03); border-radius: 16px; padding: 16px; border: 1px solid rgba(255,255,255,0.03);">
                            <div style="font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px;">Dates demandées</div>
                            <div style="color: white; font-size: 14px; font-weight: 600;">Du : <span style="font-weight: 500; color: #eee;">${startStr}</span></div>
                            <div style="color: white; font-size: 14px; font-weight: 600; margin-top: 4px;">Au : <span style="font-weight: 500; color: #eee;">${endStr}</span></div>
                            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                                <span style="font-size: 13px; color: #8E8E93;">Motif :</span>
                                <strong style="font-size: 15px; color: #FF9500;">${r.motif || 'CP'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                                <span style="font-size: 13px; color: #8E8E93;">Jours demandés (ouvrés) :</span>
                                <strong style="font-size: 16px; color: #007AFF;">${r.days_requested} jours</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                                <span style="font-size: 13px; color: #8E8E93;">Solde restant actuel :</span>
                                <strong style="font-size: 14px; color: #8E8E93;">${r.profiles?.conge_solde} jours</strong>
                            </div>
                        </div>

                        <!-- Signature -->
                        <div>
                            <div style="font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">Signature du salarié</div>
                            <div style="background: white; border-radius: 12px; height: 90px; display: flex; align-items: center; justify-content: center; padding: 8px;">
                                <img src="${r.signature}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Signature">
                            </div>
                        </div>

                        <!-- Comment section -->
                        <div>
                            <label style="display: block; font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">Commentaire / Justificatif Admin</label>
                            <textarea id="comment-${r.id}" class="form-input" style="width: 100%; height: 60px; resize: none; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 8px; font-size: 13px;" placeholder="Ajouter une note facultative..."></textarea>
                        </div>

                        <!-- Actions -->
                        <div style="display: flex; gap: 12px; margin-top: 8px;">
                            <button onclick="window.decideCongeRequest('${r.id}', 'refuse', this)" style="flex: 1; height: 44px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); border-radius: 12px; color: #FF3B30; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                                Refuser ❌
                            </button>
                            <button onclick="window.decideCongeRequest('${r.id}', 'approve', this)" style="flex: 1.5; height: 44px; background: #007AFF; border: none; border-radius: 12px; color: white; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);">
                                Valider ✅
                            </button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderBalancesSection(users) {
    return `
        <div class="glass-card" style="background: #121212; border-radius: 28px; padding: 24px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <!-- Search bar -->
            <div style="margin-bottom: 20px; position: relative;">
                <input type="text" id="conge-search-input" oninput="window.filterCongeBalances()" placeholder="Rechercher un salarié ou un secteur..." style="width: 100%; height: 46px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 16px 0 45px; font-size: 14px; outline: none;">
                <span style="position: absolute; left: 16px; top: 13px; color: #8E8E93; font-size: 16px;">🔍</span>
            </div>

            <!-- Table -->
            <div style="overflow-x: auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Salarié</th>
                            <th>Secteur</th>
                            <th>Solde Restant (en jours)</th>
                            <th>Initialisé</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Utilisateur';
        const initLabel = u.conge_initialise ? 'Oui ✅' : 'Non ❌';
        const initColor = u.conge_initialise ? '#34C759' : '#FF3B30';

        return `
                                <tr class="conge-balance-row" data-name="${window.escapeHTML(name)}" data-sector="${window.escapeHTML(u.secteur || 'AIA')}">
                                    <td>
                                        <div style="font-weight: 600; color: white;">${window.escapeHTML(name)}</div>
                                    </td>
                                    <td>
                                        <span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #bbb;">${u.secteur || 'AIA'}</span>
                                    </td>
                                    <td>
                                        <div style="font-size: 16px; font-weight: 800; color: #007AFF;">${u.conge_solde !== null ? u.conge_solde : '0.00'}</div>
                                    </td>
                                    <td>
                                        <span style="color: ${initColor}; font-weight: 700; font-size: 13px;">${initLabel}</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                            <button onclick="window.openAdjustSoldeModal('${u.id}', '${window.escapeHTML(name)}', ${Number(u.conge_solde || 0)})" class="btn-sm" style="background: rgba(175,82,222,0.12); border: 1px solid rgba(175,82,222,0.25); color: #AF52DE; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: 0.2s;" onmouseover="this.style.background='rgba(175,82,222,0.22)'" onmouseout="this.style.background='rgba(175,82,222,0.12)'">
                                                ✏️ Modifier
                                            </button>
                                            <button onclick="window.viewUserCongeHistory('${u.id}', '${window.escapeHTML(name)}')" class="btn-sm" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                                📜 Historique
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

window.openAdminSignatureModal = function () {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = "11000";
        modal.style.backdropFilter = "blur(10px)";
        modal.style.background = "rgba(0, 0, 0, 0.6)";

        modal.innerHTML = `
            <div class="modal-box glass-panel" style="width: 450px; padding: 25px; display: flex; flex-direction: column; gap: 15px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); background: rgba(28,28,30,0.95);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-weight: 800; color: white; font-size: 18px;">Signature du responsable</h3>
                    <button id="close-sig-modal" style="background: none; border: none; font-size: 22px; color: #8E8E93; cursor: pointer;">✕</button>
                </div>
                
                <p style="color: #8E8E93; font-size: 13px; margin: 0;">Veuillez signer ci-dessous pour valider la demande de congés :</p>
                
                <div style="background: white; border-radius: 14px; padding: 5px; height: 180px; position: relative;">
                    <canvas id="admin-sig-canvas" style="width: 100%; height: 100%; border-radius: 10px; display: block; touch-action: none; background: #ffffff; cursor: crosshair;"></canvas>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 10px;">
                    <button id="clear-sig-btn" class="btn-secondary" style="flex: 1; height: 44px; font-weight: 700; border-radius: 12px;">Effacer</button>
                    <button id="save-sig-btn" class="btn-primary" style="flex: 1.5; height: 44px; font-weight: 800; border-radius: 12px; background: #34C759; color: white; border: none; box-shadow: 0 4px 12px rgba(52, 199, 89, 0.25);">Valider la demande</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const canvas = document.getElementById('admin-sig-canvas');
        const ctx = canvas.getContext('2d');

        // Adjust resolution after modal renders to avoid drawing offset
        setTimeout(() => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            ctx.strokeStyle = '#000000'; // Signature en noir
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }, 100);

        let drawing = false;
        let lastX = 0;
        let lastY = 0;

        function drawStart(x, y) {
            drawing = true;
            lastX = x;
            lastY = y;
        }

        function drawMove(x, y) {
            if (!drawing) return;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            lastX = x;
            lastY = y;
        }

        function drawEnd() {
            drawing = false;
        }

        // Mouse Events
        canvas.addEventListener('mousedown', (e) => {
            const canvasRect = canvas.getBoundingClientRect();
            drawStart(e.clientX - canvasRect.left, e.clientY - canvasRect.top);
        });
        canvas.addEventListener('mousemove', (e) => {
            const canvasRect = canvas.getBoundingClientRect();
            drawMove(e.clientX - canvasRect.left, e.clientY - canvasRect.top);
        });
        canvas.addEventListener('mouseup', drawEnd);
        canvas.addEventListener('mouseleave', drawEnd);

        // Touch Events
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                const canvasRect = canvas.getBoundingClientRect();
                drawStart(t.clientX - canvasRect.left, t.clientY - canvasRect.top);
                e.preventDefault();
            }
        });
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                const canvasRect = canvas.getBoundingClientRect();
                drawMove(t.clientX - canvasRect.left, t.clientY - canvasRect.top);
                e.preventDefault();
            }
        });
        canvas.addEventListener('touchend', (e) => {
            drawEnd();
            e.preventDefault();
        });

        // Clear button
        document.getElementById('clear-sig-btn').addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        // Close button
        document.getElementById('close-sig-modal').addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        // Save button
        document.getElementById('save-sig-btn').addEventListener('click', () => {
            const signatureData = canvas.toDataURL('image/png');
            modal.remove();
            resolve(signatureData);
        });
    });
};

window.decideCongeRequest = async function (id, action, btn) {
    const comment = document.getElementById(`comment-${id}`).value.trim();
    const oldText = btn.innerText;

    let adminSignature = null;
    if (action === 'approve') {
        adminSignature = await window.openAdminSignatureModal();
        if (!adminSignature) {
            // L'administrateur a annulé la signature, on ne fait rien
            return;
        }
    }

    btn.disabled = true;
    btn.innerText = action === 'approve' ? "Validation..." : "Refus...";

    try {
        const profile = window.currentUserProfile;
        const adminName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Admin';

        // Call API
        const result = await api.actionCongeRequest(id, action, adminName, null, comment, adminSignature);

        window.showToast(action === 'approve' ? "✅ Demande de congés validée !" : "❌ Demande de congés refusée.");

        if (action === 'approve') {
            try {
                const allReqs = await api.getAdminCongeRequests();
                const reqObj = allReqs.find(x => x.id === id);
                if (reqObj) {
                    reqObj.admin_name = adminName;
                    reqObj.admin_signature = adminSignature;
                    window.generateCongePDFPlaceholder(reqObj);
                }
            } catch (pdfErr) {
                console.error("Placeholder error", pdfErr);
            }
        }

        window.renderAdminConges();
        window.updateCongesBadge();
    } catch (e) {
        alert("Erreur lors de l'action : " + e.message);
        btn.disabled = false;
        btn.innerText = oldText;
    }
};

window.viewUserCongeHistory = async function (userId, name) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10000";

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 500px; padding: 30px; display: flex; flex-direction: column; max-height: 80vh;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-weight: 800; color: white; font-size: 18px;">Historique de ${window.escapeHTML(name)}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; color: #8E8E93; cursor: pointer;">✕</button>
            </div>
            <div id="conge-history-modal-content" style="flex: 1; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 16px; padding: 15px; display: flex; flex-direction: column; gap: 12px;">
                <div style="text-align: center; padding: 20px;">
                    <div class="loader-spinner"></div>
                    <p style="color: #8E8E93; font-size: 13px; margin-top: 8px;">Chargement de l'historique...</p>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const history = await api.getAdminUserApprovedRequests(userId);
        const container = document.getElementById('conge-history-modal-content');

        if (history.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #8E8E93; font-style: italic; padding: 30px 10px;">
                    Aucun historique trouvé pour ce salarié.
                </div>
            `;
            return;
        }

        window.congeHistoryCache = window.congeHistoryCache || {};
        let html = '';
        history.forEach(r => {
            window.congeHistoryCache[r.id] = r;
            const approvedStr = new Date(r.updated_at || r.created_at).toLocaleDateString('fr-FR');
            const parsed = window.parseCongeAdminComment(r.admin_comment);

            if (r.status === 'adjustment') {
                // Entrée d'ajustement manuel du solde
                const delta = Number(parsed.delta ?? r.days_requested ?? 0);
                const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
                const deltaColor = delta >= 0 ? '#34C759' : '#FF3B30';
                const soldeBefore = parsed.solde_before !== undefined ? parsed.solde_before : '?';
                const soldeAfter = parsed.solde_after !== undefined ? parsed.solde_after : '?';
                html += `
                    <div style="background: rgba(175,82,222,0.06); padding: 14px; border-radius: 12px; border: 1px solid rgba(175,82,222,0.15); display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: white; font-size: 14px;">✏️ Ajustement manuel du solde</span>
                            <span style="background: rgba(175,82,222,0.15); color: #AF52DE; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase;">Ajustement</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Modification :</span>
                            <strong style="color: ${deltaColor}; font-size: 14px;">${deltaStr} jour(s)</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Solde avant / après :</span>
                            <span style="color: white;">${soldeBefore} → <strong>${soldeAfter}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Par :</span>
                            <span>${window.escapeHTML(parsed.admin_name || 'Admin')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Le :</span>
                            <span>${approvedStr}</span>
                        </div>
                        ${parsed.comment ? `
                            <div style="font-size: 12px; color: #FF9500; background: rgba(255,149,0,0.05); padding: 6px 10px; border-radius: 8px; margin-top: 4px;">
                                <strong>Raison :</strong> ${window.escapeHTML(parsed.comment)}
                            </div>
                        ` : ''}
                        <div style="margin-top: 8px; text-align: right;">
                            <button onclick="window.deleteCongeHistoryEntry('${r.id}', '${userId}', '${window.escapeHTML(name)}')" class="btn-sm" style="background: rgba(255,59,48,0.15); border: 1px solid rgba(255,59,48,0.25); color: #FF3B30; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,59,48,0.25)'" onmouseout="this.style.background='rgba(255,59,48,0.15)'">
                                🗑️ Supprimer
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Demande de congé validée
                const startStr = new Date(r.start_date).toLocaleDateString('fr-FR');
                const endStr = new Date(r.end_date).toLocaleDateString('fr-FR');
                html += `
                    <div style="background: rgba(255, 255, 255, 0.03); padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: white; font-size: 14px;">Du ${startStr} au ${endStr}</span>
                            <span style="background: rgba(52, 199, 89, 0.15); color: #34C759; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase;">Validée</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Motif :</span>
                            <strong style="color: #FF9500;">${r.motif || 'CP'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Durée décomptée :</span>
                            <strong style="color: white;">${r.days_requested} jours</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Validée le :</span>
                            <span>${approvedStr}</span>
                        </div>
                        ${parsed.comment ? `
                            <div style="font-size: 12px; color: #FF9500; background: rgba(255,149,0,0.05); padding: 6px 10px; border-radius: 8px; margin-top: 4px;">
                                <strong>Note :</strong> ${window.escapeHTML(parsed.comment)}
                            </div>
                        ` : ''}
                        <div style="margin-top: 8px; display: flex; justify-content: flex-end; gap: 8px;">
                            <button onclick="window.deleteCongeHistoryEntry('${r.id}', '${userId}', '${window.escapeHTML(name)}')" class="btn-sm" style="background: rgba(255,59,48,0.15); border: 1px solid rgba(255,59,48,0.25); color: #FF3B30; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,59,48,0.25)'" onmouseout="this.style.background='rgba(255,59,48,0.15)'">
                                🗑️ Supprimer
                            </button>
                            <button onclick="window.generateCongePDFPlaceholder(window.congeHistoryCache['${r.id}'])" class="btn-sm" style="background: #007AFF; border: none; color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; transition: background 0.2s;" onmouseover="this.style.background='#0062CC'" onmouseout="this.style.background='#007AFF'">
                                📄 Télécharger le PDF
                            </button>
                        </div>
                    </div>
                `;
            }
        });
        container.innerHTML = html;
    } catch (e) {
        document.getElementById('conge-history-modal-content').innerHTML = `
            <div style="color: #FF3B30; text-align: center; padding: 20px;">
                Erreur : ${e.message}
            </div>
        `;
    }
};

window.deleteCongeHistoryEntry = async function (requestId, userId, name) {
    if (!confirm("Voulez-vous vraiment supprimer cet événement de l'historique ? Cette action est irréversible.")) {
        return;
    }
    try {
        await api.deleteCongeRequest(requestId);
        window.showToast("✅ Événement supprimé avec succès.");
        // Rafraîchir l'historique et le tableau principal
        if (typeof window.loadAdminCongesTab === 'function') window.loadAdminCongesTab();
        window.viewUserCongeHistory(userId, name);
    } catch (err) {
        window.showToast("❌ Erreur de suppression : " + err.message);
    }
};

window.openAdjustSoldeModal = function (userId, name, currentSolde) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10500";
    modal.style.backdropFilter = "blur(10px)";
    modal.style.background = "rgba(0,0,0,0.6)";

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 420px; padding: 28px; display: flex; flex-direction: column; gap: 18px; border-radius: 24px; border: 1px solid rgba(175,82,222,0.2); background: rgba(28,28,30,0.97);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-weight: 800; color: white; font-size: 18px;">✏️ Modifier le solde</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 22px; color: #8E8E93; cursor: pointer;">✕</button>
            </div>

            <div style="background: rgba(175,82,222,0.08); border: 1px solid rgba(175,82,222,0.15); border-radius: 14px; padding: 14px;">
                <div style="font-size: 13px; color: #8E8E93; margin-bottom: 4px;">Salarié</div>
                <div style="font-weight: 700; color: white; font-size: 15px;">${window.escapeHTML(name)}</div>
                <div style="font-size: 12px; color: #AF52DE; margin-top: 6px;">Solde actuel : <strong>${currentSolde} jour(s)</strong></div>
            </div>

            <div>
                <label style="font-size: 12px; font-weight: 700; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 8px;">Ajustement (positif = ajout, négatif = retrait)</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input id="adj-delta" type="number" step="0.5" value="0" style="flex: 1; height: 44px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; color: white; padding: 0 14px; font-size: 16px; font-weight: 700; text-align: center;">
                    <span style="color: #8E8E93; font-size: 13px;">jour(s)</span>
                </div>
                <div style="margin-top: 10px; font-size: 13px; color: #8E8E93;">Nouveau solde prévu : <strong id="adj-preview" style="color: #AF52DE;">${currentSolde}</strong> jour(s)</div>
            </div>

            <div>
                <label style="font-size: 12px; font-weight: 700; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 8px;">Raison (facultatif)</label>
                <textarea id="adj-reason" rows="2" placeholder="Ex: Rattrapage, correction d'erreur..." style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 10px 14px; font-size: 13px; resize: none; box-sizing: border-box;"></textarea>
            </div>

            <div style="display: flex; gap: 12px;">
                <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="flex: 1; height: 44px; border-radius: 12px;">Annuler</button>
                <button id="adj-confirm-btn" style="flex: 1.5; height: 44px; background: #AF52DE; border: none; border-radius: 12px; color: white; font-weight: 800; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(175,82,222,0.3);">Confirmer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Live preview du nouveau solde
    const deltaInput = document.getElementById('adj-delta');
    const preview = document.getElementById('adj-preview');
    deltaInput.addEventListener('input', () => {
        const newVal = Math.round((currentSolde + Number(deltaInput.value || 0)) * 100) / 100;
        preview.textContent = newVal;
        preview.style.color = Number(deltaInput.value) >= 0 ? '#34C759' : '#FF3B30';
    });

    document.getElementById('adj-confirm-btn').addEventListener('click', async function () {
        const delta = Number(deltaInput.value || 0);
        if (delta === 0) { window.showToast('⚠️ Le delta est 0, aucune modification.'); return; }
        const reason = document.getElementById('adj-reason').value.trim();
        this.disabled = true;
        this.textContent = 'Enregistrement...';
        try {
            const result = await api.adjustCongeSolde(userId, delta, reason);
            modal.remove();
            window.showToast(`✅ Solde mis à jour : ${result.new_solde} jour(s)`);
            // Rafraîchir le tableau
            if (typeof window.loadAdminCongesTab === 'function') window.loadAdminCongesTab();
        } catch (err) {
            this.disabled = false;
            this.textContent = 'Confirmer';
            window.showToast('❌ Erreur : ' + err.message);
        }
    });
};

// ============================================================
// --- STOCK GT TRACKING (Armoires Verticales Tours/Vertimags) ---
// ============================================================

// --- MODULE: GESTION DES RTT (Admin) ---
window.updateRTTBadge = async function () {
    try {
        const requests = await api.getAdminRTTRequests();
        const pendingCount = requests.filter(r => r.status === 'pending').length;
        const badge = document.getElementById('rtt-badge');
        if (badge) {
            if (pendingCount > 0) {
                badge.textContent = pendingCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn("Could not update rtt badge", e);
    }
};

window.parseRTTAdminComment = function (commentStr) {
    if (!commentStr) return { comment: '', admin_name: '', admin_signature: '' };
    if (typeof commentStr === 'string' && commentStr.startsWith('{') && commentStr.endsWith('}')) {
        try {
            const data = JSON.parse(commentStr);
            return {
                comment: data.comment || '',
                admin_name: data.admin_name || '',
                admin_signature: data.admin_signature || null
            };
        } catch (e) {
            return { comment: commentStr, admin_name: '', admin_signature: null };
        }
    }
    return { comment: commentStr, admin_name: '', admin_signature: null };
};

window.generateRTTPDFPlaceholder = async function (requestData) {
    console.log("PDF generation started for RTT request:", requestData);
    try {
        const parsedCommentData = window.parseRTTAdminComment(requestData.admin_comment);
        let user = requestData.profiles || {};
        if (Array.isArray(user)) {
            user = user[0] || {};
        }

        if ((!user.first_name || !user.societe) && requestData.user_id) {
            try {
                const allUsers = await api.getAdminRTTUsers();
                const matchedUser = allUsers.find(u => u.id === requestData.user_id);
                if (matchedUser) {
                    user = matchedUser;
                }
            } catch (err) {
                console.error("Error fetching fallback user details:", err);
            }
        }

        const first_name = user.first_name || requestData.first_name || '';
        const last_name = user.last_name || requestData.last_name || '';
        const secteur = user.secteur || requestData.secteur || '';
        const societeVal = user.societe || requestData.societe || 'Pouchain';
        const societe = societeVal.toLowerCase();

        const templateName = societe === 'cepp'
            ? 'MOD-GRH-04 Demande absence CEPP v2.pdf'
            : 'MOD-GRH-05 Demande absence POUCHAIN v2.pdf';

        const response = await fetch(`./${templateName}`);
        if (!response.ok) throw new Error(`Impossible de charger le modèle ${templateName}`);
        const templateBytes = await response.arrayBuffer();

        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(templateBytes);
        const form = pdfDoc.getForm();
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        const nom = (last_name || '').toUpperCase();
        const prenom = first_name || '';
        const service = (societe === 'cepp') ? 'PAC' : ((!secteur || secteur === 'Tout') ? 'PAC' : secteur);

        form.getTextField('Text1').setText(nom);
        form.getTextField('Text2').setText(prenom);
        form.getTextField('Text3').setText(service);

        const formatStrDate = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        };

        const du = formatStrDate(requestData.start_date);

        const motif = "RTT";

        const getLocalYYYYMMDD = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const getReturnDate = (endDateStr) => {
            let nextDate = new Date(endDateStr + 'T12:00:00');
            do {
                nextDate.setDate(nextDate.getDate() + 1);
            } while (nextDate.getDay() === 0 || nextDate.getDay() === 6 || window.isJoursFerieFrance(getLocalYYYYMMDD(nextDate)));
            return getLocalYYYYMMDD(nextDate);
        };

        const groupConsecutiveDates = (dates) => {
            if (!dates || dates.length === 0) return [];
            const sorted = [...new Set(dates)].filter(d => typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)).sort();
            if (sorted.length === 0) return [];
            const groups = [];
            let currentGroup = [sorted[0]];
            for (let i = 1; i < sorted.length; i++) {
                const prev = new Date(sorted[i - 1] + 'T12:00:00');
                const curr = new Date(sorted[i] + 'T12:00:00');
                const diffTime = Math.abs(curr - prev);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let isConsecutive = false;
                if (diffDays === 1) {
                    isConsecutive = true;
                } else {
                    let tempDate = new Date(prev);
                    tempDate.setDate(tempDate.getDate() + 1);
                    let onlyWeekendsOrHolidays = true;
                    while (tempDate < curr) {
                        const day = tempDate.getDay();
                        const isWeekend = day === 0 || day === 6;
                        const dateStr = getLocalYYYYMMDD(tempDate);
                        const isHoliday = window.isJoursFerieFrance(dateStr);
                        if (!isWeekend && !isHoliday) {
                            onlyWeekendsOrHolidays = false;
                            break;
                        }
                        tempDate.setDate(tempDate.getDate() + 1);
                    }
                    if (onlyWeekendsOrHolidays) {
                        isConsecutive = true;
                    }
                }
                if (isConsecutive) {
                    currentGroup.push(sorted[i]);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [sorted[i]];
                }
            }
            groups.push(currentGroup);
            return groups;
        };

        const countBusinessDays = (datesArray) => {
            let count = 0;
            datesArray.forEach(dStr => {
                const d = new Date(dStr + 'T12:00:00');
                const dayOfWeek = d.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = window.isJoursFerieFrance(dStr);
                if (!isWeekend && !isHoliday) {
                    count++;
                }
            });
            return count;
        };

        let datesList = requestData.dates_list;
        if (typeof datesList === 'string') {
            try { datesList = JSON.parse(datesList); } catch(e) { datesList = []; }
        }

        let dateGroups = [];
        if (Array.isArray(datesList) && datesList.length > 0) {
            try {
                dateGroups = groupConsecutiveDates(datesList);
            } catch (err) {
                console.error("Error grouping RTT dates:", err);
            }
        }

        const maxRows = 3;
        if (dateGroups && dateGroups.length > 0) {
            for (let i = 0; i < Math.min(dateGroups.length, maxRows); i++) {
                const group = dateGroups[i];
                const groupStart = group[0];
                const groupEnd = group[group.length - 1];
                const groupJoursCount = String(countBusinessDays(group));
                const groupRetour = formatStrDate(getReturnDate(groupEnd));

                const duGroup = formatStrDate(groupStart);
                const auGroup = formatStrDate(groupEnd);

                if (societe === 'cepp') {
                    const rowFields = [
                        { du: 'Text4', au: 'Text7', jours: 'Text10', motif: 'Text14', retour: 'Text17' },
                        { du: 'Text5', au: 'Text8', jours: 'Text12', motif: 'Text15', retour: 'Text18' },
                        { du: 'Text6', au: 'Text9', jours: 'Text13', motif: 'Text16', retour: 'Text19' }
                    ];
                    const fields = rowFields[i];
                    form.getTextField(fields.du).setText(duGroup);
                    form.getTextField(fields.au).setText(auGroup);
                    form.getTextField(fields.jours).setText(groupJoursCount);
                    form.getTextField(fields.motif).setText(motif);
                    form.getTextField(fields.retour).setText(groupRetour);
                } else {
                    const rowFields = [
                        { du: 'Text4', au: 'Text5', jours: 'Text6', motif: 'Text7', retour: 'Text8' },
                        { du: 'Text9', au: 'Text11', jours: 'Text12', motif: 'Text13', retour: 'Text14' },
                        { du: 'Text15', au: 'Text16', jours: 'Text17', motif: 'Text18', retour: 'Text19' }
                    ];
                    const fields = rowFields[i];
                    form.getTextField(fields.du).setText(duGroup);
                    form.getTextField(fields.au).setText(auGroup);
                    form.getTextField(fields.jours).setText(groupJoursCount);
                    form.getTextField(fields.motif).setText(motif);
                    form.getTextField(fields.retour).setText(groupRetour);
                }
            }
        } else {
            // Robust fallback if no dates list available or calculation fails
            const du = formatStrDate(requestData.start_date);
            const au = formatStrDate(requestData.end_date);
            const joursCount = String(requestData.days_requested || '0');
            const retour = formatStrDate(getReturnDate(requestData.end_date));

            if (societe === 'cepp') {
                form.getTextField('Text4').setText(du);
                form.getTextField('Text7').setText(au);
                form.getTextField('Text10').setText(joursCount);
                form.getTextField('Text14').setText(motif);
                form.getTextField('Text17').setText(retour);
            } else {
                form.getTextField('Text4').setText(du);
                form.getTextField('Text5').setText(au);
                form.getTextField('Text6').setText(joursCount);
                form.getTextField('Text7').setText(motif);
                form.getTextField('Text8').setText(retour);
            }
        }

        const dateSoumission = formatStrDate(requestData.created_at ? requestData.created_at.split('T')[0] : getLocalYYYYMMDD(new Date()));
        form.getTextField('Text20').setText(`Le ${dateSoumission}`);

        try {
            form.getRadioGroup('Group1').select('Choice1');
        } catch (e) {}

        const dateAcceptation = formatStrDate(getLocalYYYYMMDD(new Date()));
        let adminName = requestData.admin_name || parsedCommentData.admin_name;
        if (!adminName) {
            const currentAdmin = window.currentUserProfile;
            adminName = currentAdmin ? `${currentAdmin.first_name || ''} ${currentAdmin.last_name || ''}`.trim() : 'Admin';
        }
        const dateRespFieldName = societe === 'cepp' ? 'Text25' : 'Text24';
        form.getTextField(dateRespFieldName).setText(`Le ${dateAcceptation} par ${adminName}`);

        if (requestData.signature) {
            try {
                const blackSigUrl = await forceSignatureBlackColor(requestData.signature);
                const sigImageBytes = await fetch(blackSigUrl).then(res => res.arrayBuffer());
                const sigImage = await pdfDoc.embedPng(sigImageBytes);
                const sigCoords = societe === 'cepp'
                    ? { x: 430, y: 278, width: 90, height: 35 }
                    : { x: 430, y: 250, width: 90, height: 35 };
                firstPage.drawImage(sigImage, sigCoords);
            } catch (sigErr) {}
        }

        const adminSignature = requestData.admin_signature || parsedCommentData.admin_signature;
        if (adminSignature) {
            try {
                const blackSigUrl = await forceSignatureBlackColor(adminSignature);
                const sigImageBytes = await fetch(blackSigUrl).then(res => res.arrayBuffer());
                const sigImage = await pdfDoc.embedPng(sigImageBytes);
                const adminSigCoords = societe === 'cepp'
                    ? { x: 430, y: 130, width: 135, height: 52.5 }
                    : { x: 430, y: 85, width: 135, height: 52.5 };
                firstPage.drawImage(sigImage, adminSigCoords);
            } catch (sigErr) {}
        }

        form.flatten();
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Demande_RTT_${nom}_${prenom}_${du.replace(/\//g, '-')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Error during RTT PDF generation:", err);
    }
};

window.renderAdminRTT = async function () {
    const navItem = document.getElementById('nav-rtt');
    if (navItem) {
        document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
        navItem.classList.add('active');
    }

    const adminSecteur = window.currentUserProfile?.secteur || 'AIA';
    const content = document.getElementById('admin-content');
    content.innerHTML = `
        <div style="padding: 30px; display:flex; flex-direction:column; gap: 30px; background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(40px); border-radius: 40px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 12px 40px rgba(0,0,0,0.4);">
            <!-- Header -->
            <div class="glass-header" style="display: flex; justify-content: space-between; align-items: center; padding: 25px; background: #121212; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 30px; box-shadow: 0 8px 20px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #FFD60A, #FF9500); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(255, 214, 10, 0.2);">
                        <span style="font-size: 28px;">⚡</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">Gestion des RTT</h1>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #8E8E93; font-weight: 500;">Secteur : <strong style="color:#FFD60A;">${adminSecteur}</strong> | Validez les demandes de RTT et gérez les soldes</p>
                    </div>
                </div>
                <div>
                    <button onclick="window.renderAdminRTT()" title="Rafraîchir" style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Tabs -->
            <div style="display: flex; gap: 10px; background: rgba(255,255,255,0.02); padding: 6px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); width: fit-content;">
                <button class="tab-rtt-btn active" id="tab-rtt-balances-btn" onclick="window.switchRTTAdminTab('balances')" style="padding: 12px 24px; border-radius: 12px; border: none; font-size: 14px; font-weight: 700; cursor: pointer; background: #007AFF; color: white;">
                    👥 Soldes Collaborateurs
                </button>
                <button class="tab-rtt-btn" id="tab-rtt-pending-btn" onclick="window.switchRTTAdminTab('pending')" style="padding: 12px 24px; border-radius: 12px; border: none; font-size: 14px; font-weight: 700; cursor: pointer; background: rgba(255,255,255,0.05); color: #8E8E93;">
                    ⏳ Demandes en attente
                </button>
            </div>

            <div id="rtt-tab-balances" class="rtt-tab-view">
                <div style="text-align: center; padding: 40px;"><div class="loader-spinner"></div></div>
            </div>
            <div id="rtt-tab-pending" class="rtt-tab-view" style="display: none;">
                <div style="text-align: center; padding: 40px;"><div class="loader-spinner"></div></div>
            </div>
        </div>
    `;

    window.loadAdminRTTTab();
};

window.loadAdminRTTTab = async function () {
    try {
        const [requests, usersData] = await Promise.all([
            api.getAdminRTTRequests(),
            api.getAdminRTTUsers()
        ]);
        const users = usersData.filter(u => {
            const nameLower = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
            return nameLower.includes('patrick') || nameLower.includes('quentin') || nameLower.includes('partick');
        });

        const balancesView = document.getElementById('rtt-tab-balances');
        const pendingView = document.getElementById('rtt-tab-pending');

        if (balancesView) balancesView.innerHTML = renderRTTBalancesSection(users);
        if (pendingView) pendingView.innerHTML = renderRTTPendingRequestsSection(requests);
    } catch (e) {
        console.error(e);
    }
};

window.switchRTTAdminTab = (tab) => {
    const pendingView = document.getElementById('rtt-tab-pending');
    const balancesView = document.getElementById('rtt-tab-balances');
    const pendingBtn = document.getElementById('tab-rtt-pending-btn');
    const balancesBtn = document.getElementById('tab-rtt-balances-btn');

    if (tab === 'pending') {
        if (pendingView) pendingView.style.display = 'block';
        if (balancesView) balancesView.style.display = 'none';
        pendingBtn.className = 'tab-rtt-btn active';
        pendingBtn.style.background = '#007AFF';
        pendingBtn.style.color = 'white';
        balancesBtn.className = 'tab-rtt-btn';
        balancesBtn.style.background = 'rgba(255,255,255,0.05)';
        balancesBtn.style.color = '#8E8E93';
    } else {
        if (pendingView) pendingView.style.display = 'none';
        if (balancesView) balancesView.style.display = 'block';
        balancesBtn.className = 'tab-rtt-btn active';
        balancesBtn.style.background = '#007AFF';
        balancesBtn.style.color = 'white';
        pendingBtn.className = 'tab-rtt-btn';
        pendingBtn.style.background = 'rgba(255,255,255,0.05)';
        pendingBtn.style.color = '#8E8E93';
    }
};

window.filterRTTBalances = () => {
    const q = document.getElementById('rtt-search-input').value.toLowerCase().trim();
    const rows = document.querySelectorAll('.rtt-balance-row');
    rows.forEach(row => {
        const name = row.getAttribute('data-name').toLowerCase();
        const sector = row.getAttribute('data-sector').toLowerCase();
        if (name.includes(q) || sector.includes(q)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
};

function renderRTTBalancesSection(users) {
    return `
        <div class="glass-card" style="background: #121212; border-radius: 28px; padding: 24px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="margin-bottom: 20px; position: relative;">
                <input type="text" id="rtt-search-input" oninput="window.filterRTTBalances()" placeholder="Rechercher un salarié ou un secteur..." style="width: 100%; height: 46px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 0 16px 0 45px; font-size: 14px; outline: none;">
                <span style="position: absolute; left: 16px; top: 13px; color: #8E8E93; font-size: 16px;">🔍</span>
            </div>
            <div style="overflow-x: auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Salarié</th>
                            <th>Secteur</th>
                            <th>Solde Restant (en jours)</th>
                            <th>Initialisé</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => {
                            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Utilisateur';
                            const initLabel = u.rtt_initialise ? 'Oui ✅' : 'Non ❌';
                            const initColor = u.rtt_initialise ? '#34C759' : '#FF3B30';

                            return `
                                <tr class="rtt-balance-row" data-name="${window.escapeHTML(name)}" data-sector="${window.escapeHTML(u.secteur || 'AIA')}">
                                    <td><div style="font-weight: 600; color: white;">${window.escapeHTML(name)}</div></td>
                                    <td><span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #bbb;">${u.secteur || 'AIA'}</span></td>
                                    <td><div style="font-size: 16px; font-weight: 800; color: #007AFF;">${u.rtt_solde !== null ? u.rtt_solde : '0.00'}</div></td>
                                    <td><span style="color: ${initColor}; font-weight: 700; font-size: 13px;">${initLabel}</span></td>
                                    <td style="text-align: right;">
                                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                            <button onclick="window.openAdjustRTTSoldeModal('${u.id}', '${window.escapeHTML(name)}', ${Number(u.rtt_solde || 0)})" class="btn-sm" style="background: rgba(175,82,222,0.12); border: 1px solid rgba(175,82,222,0.25); color: #AF52DE; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: 0.2s;">
                                                ✏️ Modifier
                                            </button>
                                            <button onclick="window.viewUserRTTHistory('${u.id}', '${window.escapeHTML(name)}')" class="btn-sm" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: 0.2s;">
                                                📜 Historique
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderRTTPendingRequestsSection(requests) {
    if (requests.length === 0) {
        return `
            <div style="text-align:center; padding: 60px 20px; background: rgba(255,255,255,0.03); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1);">
                <div style="font-size: 40px; margin-bottom: 12px;">🏝️</div>
                <h3 style="color: white; margin: 0; font-size: 16px;">Aucune demande de RTT en attente</h3>
            </div>
        `;
    }

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; padding-bottom: 40px;">
            ${requests.map(r => {
                const name = [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(' ') || 'Salarié inconnu';
                const startStr = new Date(r.start_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                const endStr = new Date(r.end_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                const requestDateStr = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

                return `
                    <div class="conge-request-card" style="background: rgba(45, 45, 50, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px; transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h3 style="margin: 0; color: white; font-size: 17px; font-weight: 700;">${window.escapeHTML(name)}</h3>
                                <span style="font-size: 12px; color: #8E8E93; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 6px; display: inline-block; margin-top: 4px;">Secteur : ${r.profiles?.secteur || 'Non défini'}</span>
                            </div>
                            <span style="font-size: 11px; color: #8E8E93;">Déposée le ${requestDateStr}</span>
                        </div>

                        <div style="background: rgba(255, 255, 255, 0.03); border-radius: 16px; padding: 16px; border: 1px solid rgba(255,255,255,0.03);">
                            <div style="font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px;">Dates demandées</div>
                            <div style="color: white; font-size: 14px; font-weight: 600;">Du : <span style="font-weight: 500; color: #eee;">${startStr}</span></div>
                            <div style="color: white; font-size: 14px; font-weight: 600; margin-top: 4px;">Au : <span style="font-weight: 500; color: #eee;">${endStr}</span></div>
                            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                                <span style="font-size: 13px; color: #8E8E93;">Jours demandés (ouvrés) :</span>
                                <strong style="font-size: 16px; color: #007AFF;">${r.days_requested} jours</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                                <span style="font-size: 13px; color: #8E8E93;">Solde restant actuel :</span>
                                <strong style="font-size: 14px; color: #8E8E93;">${r.profiles?.rtt_solde} jours</strong>
                            </div>
                        </div>

                        <div>
                            <div style="font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">Signature du salarié</div>
                            <div style="background: white; border-radius: 12px; height: 90px; display: flex; align-items: center; justify-content: center; padding: 8px;">
                                <img src="${r.signature}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Signature">
                            </div>
                        </div>

                        <div>
                            <label style="display: block; font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">Commentaire / Justificatif Admin</label>
                            <textarea id="rtt-comment-${r.id}" class="form-input" style="width: 100%; height: 60px; resize: none; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 8px; font-size: 13px;" placeholder="Ajouter une note facultative..."></textarea>
                        </div>

                        <div style="display: flex; gap: 12px; margin-top: 8px;">
                            <button onclick="window.decideRTTRequest('${r.id}', 'refuse', this)" style="flex: 1; height: 44px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); border-radius: 12px; color: #FF3B30; font-weight: 700; cursor: pointer;">
                                Refuser ❌
                            </button>
                            <button onclick="window.decideRTTRequest('${r.id}', 'approve', this)" style="flex: 1.5; height: 44px; background: #007AFF; border: none; border-radius: 12px; color: white; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);">
                                Valider ✅
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

window.decideRTTRequest = async function (id, action, btn) {
    const comment = document.getElementById(`rtt-comment-${id}`).value.trim();
    const oldText = btn.innerText;

    let adminSignature = null;
    if (action === 'approve') {
        adminSignature = await window.openAdminSignatureModal();
        if (!adminSignature) return;
    }

    // Get request details BEFORE the status transition so it can be resolved from pending requests list
    let reqObj = null;
    if (action === 'approve') {
        try {
            const allReqs = await api.getAdminRTTRequests();
            reqObj = allReqs.find(x => x.id === id);
        } catch (err) {
            console.error("Error fetching RTT request before action:", err);
        }
    }

    btn.disabled = true;
    btn.innerText = action === 'approve' ? "Validation..." : "Refus...";

    try {
        const profile = window.currentUserProfile;
        const adminName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Admin';

        await api.actionRTTRequest(id, action, adminName, null, comment, adminSignature);

        window.showToast(action === 'approve' ? "✅ Demande de RTT validée !" : "❌ Demande de RTT refusée.");

        if (action === 'approve' && reqObj) {
            try {
                reqObj.admin_name = adminName;
                reqObj.admin_signature = adminSignature;
                window.generateRTTPDFPlaceholder(reqObj);
            } catch (pdfErr) {
                console.error("RTT PDF placeholder error", pdfErr);
            }
        }

        window.renderAdminRTT();
        window.updateRTTBadge();
    } catch (e) {
        alert("Erreur lors de l'action RTT : " + e.message);
        btn.disabled = false;
        btn.innerText = oldText;
    }
};

window.viewUserRTTHistory = async function (userId, name) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10000";

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 500px; padding: 30px; display: flex; flex-direction: column; max-height: 80vh;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-weight: 800; color: white; font-size: 18px;">Historique RTT de ${window.escapeHTML(name)}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; color: #8E8E93; cursor: pointer;">✕</button>
            </div>
            <div id="rtt-history-modal-content" style="flex: 1; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 16px; padding: 15px; display: flex; flex-direction: column; gap: 12px;">
                <div style="text-align: center; padding: 20px;">
                    <div class="loader-spinner"></div>
                    <p style="color: #8E8E93; font-size: 13px; margin-top: 8px;">Chargement de l'historique...</p>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const history = await api.getAdminUserApprovedRTTRequests(userId);
        const container = document.getElementById('rtt-history-modal-content');

        if (history.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #8E8E93; font-style: italic; padding: 30px 10px;">
                    Aucun historique RTT trouvé pour ce salarié.
                </div>
            `;
            return;
        }

        window.rttHistoryCache = window.rttHistoryCache || {};
        let html = '';
        history.forEach(r => {
            window.rttHistoryCache[r.id] = r;
            const approvedStr = new Date(r.updated_at || r.created_at).toLocaleDateString('fr-FR');
            const parsed = window.parseRTTAdminComment(r.admin_comment);

            if (r.status === 'adjustment') {
                const delta = Number(parsed.delta ?? r.days_requested ?? 0);
                const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
                const deltaColor = delta >= 0 ? '#34C759' : '#FF3B30';
                const soldeBefore = parsed.solde_before !== undefined ? parsed.solde_before : '?';
                const soldeAfter = parsed.solde_after !== undefined ? parsed.solde_after : '?';
                html += `
                    <div style="background: rgba(175,82,222,0.06); padding: 14px; border-radius: 12px; border: 1px solid rgba(175,82,222,0.15); display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: white; font-size: 14px;">✏️ Ajustement manuel RTT</span>
                            <span style="background: rgba(175,82,222,0.15); color: #AF52DE; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase;">Ajustement</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Modification :</span>
                            <strong style="color: ${deltaColor}; font-size: 14px;">${deltaStr} jour(s)</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Solde avant / après :</span>
                            <span style="color: white;">${soldeBefore} → <strong>${soldeAfter}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Par :</span>
                            <span>${window.escapeHTML(parsed.admin_name || 'Admin')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Le :</span>
                            <span>${approvedStr}</span>
                        </div>
                        ${parsed.comment ? `
                            <div style="font-size: 12px; color: #FF9500; background: rgba(255,149,0,0.05); padding: 6px 10px; border-radius: 8px; margin-top: 4px;">
                                <strong>Raison :</strong> ${window.escapeHTML(parsed.comment)}
                            </div>
                        ` : ''}
                        <div style="margin-top: 8px; text-align: right;">
                            <button onclick="window.deleteRTTHistoryEntry('${r.id}', '${userId}', '${window.escapeHTML(name)}')" class="btn-sm" style="background: rgba(255,59,48,0.15); border: 1px solid rgba(255,59,48,0.25); color: #FF3B30; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; transition: background 0.2s;">
                                🗑️ Supprimer
                            </button>
                        </div>
                    </div>
                `;
            } else {
                const startStr = new Date(r.start_date).toLocaleDateString('fr-FR');
                const endStr = new Date(r.end_date).toLocaleDateString('fr-FR');
                html += `
                    <div style="background: rgba(255, 255, 255, 0.03); padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: white; font-size: 14px;">Du ${startStr} au ${endStr}</span>
                            <span style="background: rgba(52, 199, 89, 0.15); color: #34C759; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase;">Validée</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Durée décomptée :</span>
                            <strong style="color: white;">${r.days_requested} jours</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #8E8E93;">
                            <span>Validée le :</span>
                            <span>${approvedStr}</span>
                        </div>
                        ${parsed.comment ? `
                            <div style="font-size: 12px; color: #FF9500; background: rgba(255,149,0,0.05); padding: 6px 10px; border-radius: 8px; margin-top: 4px;">
                                <strong>Note :</strong> ${window.escapeHTML(parsed.comment)}
                            </div>
                        ` : ''}
                        <div style="margin-top: 8px; display: flex; justify-content: flex-end; gap: 8px;">
                            <button onclick="window.deleteRTTHistoryEntry('${r.id}', '${userId}', '${window.escapeHTML(name)}')" class="btn-sm" style="background: rgba(255,59,48,0.15); border: 1px solid rgba(255,59,48,0.25); color: #FF3B30; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700;">
                                🗑️ Supprimer
                            </button>
                            <button onclick="window.generateRTTPDFPlaceholder(window.rttHistoryCache['${r.id}'])" class="btn-sm" style="background: #007AFF; border: none; color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                📄 Télécharger le PDF
                            </button>
                        </div>
                    </div>
                `;
            }
        });
        container.innerHTML = html;
    } catch (e) {
        document.getElementById('rtt-history-modal-content').innerHTML = `
            <div style="color: #FF3B30; text-align: center; padding: 20px;">Erreur : ${e.message}</div>
        `;
    }
};

window.deleteRTTHistoryEntry = async function (requestId, userId, name) {
    if (!confirm("Voulez-vous vraiment supprimer cet événement de l'historique RTT ? Cette action est irréversible.")) return;
    try {
        await api.deleteRTTRequest(requestId);
        window.showToast("✅ Événement supprimé avec succès.");
        if (typeof window.loadAdminRTTTab === 'function') window.loadAdminRTTTab();
        window.viewUserRTTHistory(userId, name);
    } catch (err) {
        window.showToast("❌ Erreur de suppression : " + err.message);
    }
};

window.openAdjustRTTSoldeModal = function (userId, name, currentSolde) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "10500";
    modal.style.backdropFilter = "blur(10px)";
    modal.style.background = "rgba(0,0,0,0.6)";

    modal.innerHTML = `
        <div class="modal-box glass-panel" style="width: 420px; padding: 28px; display: flex; flex-direction: column; gap: 18px; border-radius: 24px; border: 1px solid rgba(175,82,222,0.2); background: rgba(28,28,30,0.97);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-weight: 800; color: white; font-size: 18px;">✏️ Modifier le solde RTT</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 22px; color: #8E8E93; cursor: pointer;">✕</button>
            </div>

            <div style="background: rgba(175,82,222,0.08); border: 1px solid rgba(175,82,222,0.15); border-radius: 14px; padding: 14px;">
                <div style="font-size: 13px; color: #8E8E93; margin-bottom: 4px;">Salarié</div>
                <div style="font-weight: 700; color: white; font-size: 15px;">${window.escapeHTML(name)}</div>
                <div style="font-size: 12px; color: #AF52DE; margin-top: 6px;">Solde actuel : <strong>${currentSolde} jour(s)</strong></div>
            </div>

            <div>
                <label style="font-size: 12px; font-weight: 700; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 8px;">Ajustement (positif = ajout, négatif = retrait)</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input id="rtt-adj-delta" type="number" step="0.5" value="0" style="flex: 1; height: 44px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; color: white; padding: 0 14px; font-size: 16px; font-weight: 700; text-align: center;">
                    <span style="color: #8E8E93; font-size: 13px;">jour(s)</span>
                </div>
                <div style="margin-top: 10px; font-size: 13px; color: #8E8E93;">Nouveau solde prévu : <strong id="rtt-adj-preview" style="color: #AF52DE;">${currentSolde}</strong> jour(s)</div>
            </div>

            <div>
                <label style="font-size: 12px; font-weight: 700; color: #8E8E93; text-transform: uppercase; display: block; margin-bottom: 8px;">Raison (facultatif)</label>
                <textarea id="rtt-adj-reason" rows="2" placeholder="Ex: Ajustement annuel..." style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; padding: 10px 14px; font-size: 13px; resize: none; box-sizing: border-box;"></textarea>
            </div>

            <div style="display: flex; gap: 12px;">
                <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="flex: 1; height: 44px; border-radius: 12px;">Annuler</button>
                <button id="rtt-adj-confirm-btn" style="flex: 1.5; height: 44px; background: #AF52DE; border: none; border-radius: 12px; color: white; font-weight: 800; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(175,82,222,0.3);">Confirmer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const deltaInput = document.getElementById('rtt-adj-delta');
    const preview = document.getElementById('rtt-adj-preview');
    deltaInput.addEventListener('input', () => {
        const newVal = Math.round((currentSolde + Number(deltaInput.value || 0)) * 100) / 100;
        preview.textContent = newVal;
        preview.style.color = Number(deltaInput.value) >= 0 ? '#34C759' : '#FF3B30';
    });

    document.getElementById('rtt-adj-confirm-btn').addEventListener('click', async function () {
        const delta = Number(deltaInput.value || 0);
        if (delta === 0) { window.showToast('⚠️ Le delta est 0, aucune modification.'); return; }
        const reason = document.getElementById('rtt-adj-reason').value.trim();
        this.disabled = true;
        this.textContent = 'Enregistrement...';
        try {
            const result = await api.adjustRTTSolde(userId, delta, reason);
            modal.remove();
            window.showToast(`✅ Solde RTT mis à jour : ${result.new_solde} jour(s)`);
            if (typeof window.loadAdminRTTTab === 'function') window.loadAdminRTTTab();
        } catch (err) {
            this.disabled = false;
            this.textContent = 'Confirmer';
            window.showToast('❌ Erreur : ' + err.message);
        }
    });
};

window.updateMaterialGTStockBadge = async function () {
    try {
        const requests = await api.getMaterialGTStockRequests();
        const badge = document.getElementById('mat-stock-gt-request-badge');
        if (badge) {
            if (requests && requests.length > 0) {
                badge.style.display = 'flex';
                badge.textContent = requests.length;
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) { /* silent */ }
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
            ['t1','t2','v1','v2','v3','v4','v5'].forEach(k => {
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
    a.download = `stock_gt_${new Date().toISOString().slice(0,10)}.csv`;
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

initDashboard();

setInterval(() => {
    const el = document.getElementById('fullscreen-clock');
    if (el) {
        el.innerText = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}, 1000);