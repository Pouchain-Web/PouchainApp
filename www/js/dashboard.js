
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

// Controller Logic
async function initDashboard() {
    // 1. Check Auth
    const session = await auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Determine View
    const role = await auth.getUserRole();
    const isMobile = window.innerWidth <= 768; // Simple check

    // Gestion du bouton retour physique Android (Capacitor)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
            console.log("Hardware back button pressed.");

            // 1. Fermer les modales ouvertes
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                console.log("Closing modal via back button");
                modal.remove();
                return;
            }

            // 2. Gestion du mode paysage (plans)
            const isLandscape = document.querySelector('.landscape-mode');
            if (isLandscape) {
                if (typeof window.renderMobileMap === "function") {
                    window.renderMobileMap();
                    return;
                }
            }

            // 3. Gestion de la recherche
            const searchInput = document.getElementById('search-input');
            const searchView = document.getElementById('search-results-view');
            if (searchInput && searchView && !searchView.classList.contains('hidden')) {
                console.log("Clearing search via back button");
                searchInput.value = '';
                // Simule l'input pour remettre l'interface à zéro (catégories)
                const event = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(event);
                return;
            }

            // 4. Navigation logique (Bouton retour de l'interface)
            const docList = document.getElementById('document-list');
            if (docList && !docList.classList.contains('hidden')) {
                const backBtn = document.getElementById('back-btn');
                if (backBtn) {
                    console.log("Simulating interface back button");
                    backBtn.click();
                    return;
                }
            }

            // 5. Quitter uniquement si on est à la racine
            if (canGoBack) {
                window.history.back();
            } else {
                console.log("Exiting app...");
                window.Capacitor.Plugins.App.exitApp();
            }
        });
    }

    // 3. Render View
    if (role === 'admin' && !isMobile) {
        await renderAdminView(session);
    } else {
        await renderMobileView();
    }
}

// Global utility for opening files
window.openFile = function (key) {
    if (!key) return;
    const url = `${config.api.workerUrl}/get/${key}`;
    const ext = key.split('.').pop().toLowerCase();
    const isViewable = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'mov'].includes(ext);

    if (isViewable) {
        window.viewMobileFile(key, url, ext);
    } else {
        window.open(url, '_blank');
    }
};

window.viewMobileFile = function(key, url, ext) {
    const filename = key.split('/').pop();
    const modal = document.createElement('div');
    modal.className = 'file-viewer-overlay modal-overlay'; // Add modal-overlay for hardware back button support
    modal.id = 'active-file-viewer';
    
    let renderHtml = '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        renderHtml = `<img src="${url}" alt="${filename}">`;
    } else if (ext === 'pdf') {
        renderHtml = `<iframe src="${url}"></iframe>`;
    } else if (['mp4', 'mov'].includes(ext)) {
        renderHtml = `<video src="${url}" controls autoplay></video>`;
    }

    modal.innerHTML = `
        <div class="viewer-header">
            <span class="viewer-title">${filename}</span>
            <button class="close-viewer-btn" onclick="this.closest('.file-viewer-overlay').remove()">×</button>
        </div>
        <div class="viewer-body">
            ${renderHtml}
        </div>
    `;
    document.body.appendChild(modal);
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

    // Inject file viewer styles
    if (!document.getElementById('file-viewer-styles')) {
        const style = document.createElement('style');
        style.id = 'file-viewer-styles';
        style.innerHTML = `
            .file-viewer-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #000000;
                z-index: 100050;
                display: flex;
                flex-direction: column;
                animation: viewerIn 0.3s cubic-bezier(0.1, 0.7, 0.1, 1);
            }
            @keyframes viewerIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .viewer-header {
                height: 60px;
                padding: 0 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(28, 28, 30, 0.85);
                backdrop-filter: blur(10px);
                border-bottom: 1px solid rgba(255,255,255,0.1);
                color: #fff;
            }
            .viewer-title { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 15px; }
            .close-viewer-btn { background: #38383A; color: #fff; border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; }
            .viewer-body {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
            }
            .viewer-body img { max-width: 100%; max-height: 100%; object-fit: contain; }
            .viewer-body video { width: 100%; max-height: 100%; }
            .viewer-body iframe { width: 100%; height: 100%; border: none; background: #fff; }
        `;
        document.head.appendChild(style);
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
        if (session) {
            try {
                const supabaseClient = window.supabase.createClient(config.supabase.url, config.supabase.anonKey);
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('preferences')
                    .eq('id', session.user.id)
                    .single();
                
                let currentPreferences = (profile && profile.preferences) || {};
                if (typeof currentPreferences === 'string') currentPreferences = JSON.parse(currentPreferences);
                
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
        generateMobileCategories(files, myVehicle);

        // Check for missing vehicle information ONLY for assigned vehicle
        const assignedVehicle = myVehicle ? myVehicle.assigned : null;
        if (assignedVehicle) {
            const missing = [];
            if (!assignedVehicle.next_maintenance_date) missing.push("Date limite d'entretien");
            if (!assignedVehicle.next_maintenance_km && assignedVehicle.next_maintenance_km !== 0) missing.push("Prochain entretien (km)");
            if (!assignedVehicle.toll_card) missing.push("Badge Télépéage");
            if (!assignedVehicle.dkv_card) missing.push("Carte DKV");

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
                            dkv_card: document.getElementById('mi-dkv').value || null
                        };
                        const response = await fetch(`${config.api.workerUrl}/my-vehicle`, {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify(payload)
                        });
                        if (!response.ok) throw new Error(await response.text());
                        
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

function generateMobileCategories(files, myVehicle = null) {
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

    // Add Special App Cards
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
    
    const mapCard = document.createElement('div');
    mapCard.className = 'category-card';
    mapCard.innerHTML = `
        <div class="category-icon" style="background-color: #5856D6;">🗺️</div>
        <div class="category-title" style="font-weight:bold;">Carte</div>
    `;
    mapCard.onclick = () => renderMobileMap();

    grid.prepend(mapCard);
    if (typeof autoCard !== 'undefined') grid.prepend(autoCard);
    grid.prepend(matosCard);
    grid.prepend(planningCard);
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
                                : `<div style="font-weight:800; font-size:14px; color:${textColor};">${new Date(weekRange.startDate).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})} - ${new Date(weekRange.endDate).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}</div>`
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
    item.onclick = () => window.openFile(doc.key);

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

    document.body.innerHTML = `
    <div class="admin-layout">
        <aside class="sidebar">
            <h2>Pouchain <span>Admin</span></h2>
            <div style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-bottom: 24px;">
                Bienvenue <br><span id="admin-welcome-name" style="color: white; font-weight: 600;">${session.user.email}</span>
            </div>
            <div style="margin-bottom: 24px;">
                <input type="text" id="admin-global-search" class="form-input" placeholder="🔍 Rechercher un document..." style="width:100%; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);" oninput="handleAdminGlobalSearch(this.value)">
            </div>
            <nav id="admin-nav">
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminFolders()" class="active" id="nav-docs">📂 Documents</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminUsers()" id="nav-users">👥 Utilisateurs</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminPlanning()" id="nav-planning">📅 Planning</a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMaterialRequests()" id="nav-material" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>📦 Demande de matériel</span>
                    <span id="mat-request-badge" style="background: var(--danger, #FF3B30); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 59, 48, 0.4);">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminVehicles()" id="nav-vehicles" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🚗 Gestion des véhicules</span>
                    <span id="vehicle-badge" style="background: var(--warning, #FF9500); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 0 10px rgba(255, 149, 0, 0.4);">0</span>
                </a>
                <a href="#" onclick="document.getElementById('admin-global-search').value = ''; renderAdminMap()" id="nav-map">🗺️ Carte des Machines</a>
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
                </div>
                <button id="logout-btn" class="logout-btn" style="width: 100%;">Déconnexion</button>
            </div>
        </aside>
        
        <main class="content" id="admin-content">
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
            .select('first_name, last_name, preferences')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            if (profile.first_name && profile.last_name) {
                document.getElementById('admin-welcome-name').textContent = `${profile.first_name} ${profile.last_name}`;
            }
            // Preferences logic removed (always dark mode)
        }
    } catch (e) {
        console.warn("Could not fetch user profile details", e);
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
    window.materialBadgeInterval = setInterval(() => window.updateMaterialBadge(), 30000);
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
                await window.autoSortPlanningUsers(mondayToUse, true); // true = silent (no full reload)
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
    const isCurrentlyFullscreen = (!!document.fullscreenElement) || (existingContainer && existingContainer.id === 'planning-v2-container');
    
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
        const users = await api.listUsers();
        let tasks = [];
        try {
            tasks = await api.getAdminTasks(startStr, endStr);
        } catch (e) {
            console.warn("Could not fetch tasks:", e);
        }

        const tasksByUserDate = {};
        
        // --- Ghost Users Logic ---
        // If archived tasks exist for users no longer in the DB, we add them dynamically
        const currentIds = new Set(users.map(u => u.id));
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
                .planning-inline { background: rgba(20,20,20,0.75) !important; color: white !important; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
                .planning-inline header { background: transparent !important; margin-bottom: 12px !important; padding: 16px 20px !important; border-bottom: none !important; }
                .planning-inline header h1, .planning-inline header span { color: white !important; }
                .planning-inline .p-grid-bg { background: rgba(0,0,0,0.35) !important; border: 1px solid var(--border) !important; border-radius: 8px; }
                .planning-inline .p-head { background: #2a2a2a !important; color: white !important; border-top:none; border-bottom: 1px solid var(--border) !important; }
                .planning-inline .p-user { background: #202020 !important; color: white !important; border-bottom: 1px solid var(--border) !important; }
                .planning-inline .p-cell { border-color: rgba(255,255,255,0.05) !important; border-right: 1px solid rgba(255,255,255,0.05) !important; }
                .planning-inline .p-task { border-left: 3px solid var(--primary) !important; border: 1px solid rgba(255,255,255,0.1) !important; background: rgba(255,255,255,0.05); display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 4px !important; position: relative !important; overflow: hidden !important; cursor: pointer !important; transition: background 0.2s ease; z-index: 1; min-height: 24px; padding: 4px 6px !important; }
                .planning-inline .p-task:hover { background: rgba(255,255,255,0.1) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                .planning-inline .p-task-title { color: white !important; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; font-size: 11px; font-weight: 800; }
                .p-task-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; align-items: center; }
                .p-task:hover .p-task-actions { opacity: 1; pointer-events: auto; }
                .planning-inline .p-add-btn { background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.5) !important; border: 1px dashed rgba(255,255,255,0.2) !important; }
                .planning-inline .p-add-btn:hover { background: rgba(255,255,255,0.1) !important; color: white !important; }
                
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
                .planning-fullscreen .p-task:hover .p-task-title { white-space: normal; overflow: visible; text-overflow: unset; }
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

        let headerHTML = `
                <header style="z-index: 100; display: flex; align-items: center; justify-content: space-between;">
                    <h1 style="margin: 0; display:flex; align-items:center; gap: 15px; font-size: 20px;">
                        📅 Planning Semaine
                    </h1>
                    <div style="display:flex; gap: 12px; align-items:center;">
                        <button class="btn-sm btn-secondary p-header-controls" onclick="changePlanningWeek('${startStr}', -7)">◀</button>
                        <span style="font-weight:600; font-size: 14px;">Du ${displayStart} au ${displayEnd}</span>
                        <button class="btn-sm btn-secondary p-header-controls" onclick="changePlanningWeek('${startStr}', 7)">▶</button>
                    </div>
                    <div class="p-header-controls" style="display:flex; gap: 12px;">
                        <button class="btn-sm btn-secondary" onclick="openPlanningExportModal()" title="Exporter les données du planning">📤 Exporter les données</button>
                        <button class="btn-secondary" onclick="togglePlanningFullscreen()" id="fullscreen-btn" title="Activer/Désactiver le plein écran">⛶ Plein Écran</button>
                        <button class="btn-sm btn-secondary" onclick="togglePlanningFullscreenV2()" id="fullscreen-v2-btn" title="Plein Écran N°2 (Planning + Diaporama)">🖥️ Plein Écran N°2</button>
                        <button class="btn-primary" onclick="openNewTaskModal('${startStr}')">+ Nouvelle Tâche</button>
                    </div>
                </header>
        `;

        // Ensure we define startStr globally for toggleRefresh
        window.currentPlanningMonday = startStr;

        let gridHTML = `
                <div id="planning-scroll-area" style="flex: 1; overflow-y: auto; overflow-x: auto; padding: ${isCurrentlyFullscreen ? '0 40px 20px 40px' : '0 20px 20px 20px'};">
                    <div class="p-grid-bg" style="display: grid; grid-template-columns: 200px repeat(7, minmax(130px, 1fr)); grid-template-rows: auto repeat(${userCount}, minmax(min-content, 1fr));">
                        <div class="p-head" style="padding: 10px; font-weight:bold; position: sticky; top: 0; left: 0; z-index: 11; border-right: 1px solid; border-bottom: 1px solid; background: inherit;">
                            Collaborateur
                        </div>
                        ${weekDays.map(d => {
                            const isToday = d === new Date().toISOString().split('T')[0];
                            const todayStyle = isToday ? 'background-color: #2da140 !important; color: #fff !important; border-bottom: 3px solid #fff !important; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.1);' : 'background: inherit;';
                            return `<div class="p-head" style="padding: 10px; font-weight:bold; text-align:center; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid; border-right: 1px solid; ${todayStyle}">${formatShortDate(d)}</div>`;
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
                const isToday = d === new Date().toISOString().split('T')[0];
                const todayStyle = isToday ? 'background: rgba(45, 161, 64, 0.15) !important;' : '';
                const rawTasks = (tasksByUserDate[u.id] && tasksByUserDate[u.id][d]) ? tasksByUserDate[u.id][d] : [];
                // Tri: Tâches non faites en haut, faites en bas
                const dayTasks = [...rawTasks].sort((a, b) => {
                    const doneA = a.done === 'true' ? 1 : 0;
                    const doneB = b.done === 'true' ? 1 : 0;
                    return doneA - doneB;
                });

                rowsHTML += `<div class="p-cell" style="padding: 4px; border-bottom: 1px solid; min-height: 50px; display: flex; flex-direction: column; gap: 4px; position:relative; ${todayStyle}">`;

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
                        <div class="p-task" data-task-id="${t.id}" data-task-done="${isDone}" onclick="window.openEditTaskModal(${taskDataEscaped}, '${startStr}', event)" style="background: ${userColor}30 !important; padding: 4px 6px; border-radius: 4px; border-left: 4px solid ${userColor} !important; color: ${userColor}; ${isDone ? 'opacity: 0.4; filter: grayscale(0.8);' : ''}">
                            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                                ${timeHtml}
                                <div class="p-task-title" style="font-size: 11px; font-weight: 800; line-height: 1.2; ${isDone ? 'text-decoration: line-through;' : ''}" title="${window.escapeHTML(parsedTitle)}">${window.escapeHTML(parsedTitle)}</div>
                            </div>
                            <div class="p-task-actions">
                                <button class="btn-sm" style="background: transparent; border:none; color: ${isDone ? '#34C759' : '#fff'}; padding: 2px; font-size: 14px; cursor: pointer; line-height:1;" onclick="window.toggleAdminTaskStatus('${t.id}', ${isDone}, '${startStr}', event)" title="${isDone ? 'Marquer comme en cours' : 'Valider la tâche'}">${isDone ? '✅' : '✔️'}</button>
                                <button class="btn-sm" style="background: transparent; border:none; color: #ff6b6b; padding: 2px; font-size: 14px; cursor: pointer; line-height:1;" onclick="window.deleteAdminTask('${t.id}', '${startStr}')" title="Supprimer">×</button>
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
        } catch (e) {}

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
            </div>
        `;

        if (existingContainer) {
            existingContainer.setAttribute('data-monday', startStr);
            const mainArea = document.getElementById('planning-main-desktop');
            if (mainArea) {
                mainArea.innerHTML = finalContent;
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
            content.innerHTML = `
                <div id="integrated-planning-container" class="planning-inline" data-monday="${startStr}" style="height: calc(100vh - 80px); width: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 8px;">
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
                </div>
            `;
        }
    } catch (e) {
        console.error("Planning Error:", e);
        if (content) content.innerHTML = `<div style="color:var(--danger); padding:20px;">Erreur lors du chargement du planning : ${e.message}</div>`;
    }
};

window.openPlanningExportModal = async function() {
    try {
        const users = await api.listUsers();
        users.sort((a,b) => (a.first_name || '').localeCompare(b.first_name || ''));

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

window.showConfirmModal = function(title, message, callback) {
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

window.showInfoModal = function(title, message) {
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

window.autoSortPlanningUsers = async function (weekStartStr) {
    try {
        const users = await api.listUsers();
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
        const taskCount = {};
        const userTasks = {};
        users.forEach(u => {
            taskCount[u.id] = 0;
            userTasks[u.id] = [];
        });
        tasks.forEach(t => { 
            taskCount[t.user_id] = (taskCount[t.user_id] || 0) + 1; 
            if(!userTasks[t.user_id]) userTasks[t.user_id] = [];
            userTasks[t.user_id].push(t);
        });
        
        // Helper to check if tasks are only AT or RECUP
        const isOnlyInactif = (uid) => {
            const uT = userTasks[uid] || [];
            if (uT.length === 0) return 0; // 0 tasks is handled separately
            return uT.every(t => {
                const title = (t.title || "").toUpperCase();
                return title.includes("AT") || title.includes("RECUP");
            });
        };

        // Sort strategy scores
        // Score 0: Has active tasks (not only AT/RECUP)
        // Score 1: Zero tasks
        // Score 2: Has only AT/RECUP (inactive)
        users.sort((a, b) => {
            const aT = userTasks[a.id] || [];
            const bT = userTasks[b.id] || [];
            
            const aInactif = isOnlyInactif(a.id);
            const bInactif = isOnlyInactif(b.id);
            
            let aScore = 0;
            if (aT.length === 0) aScore = 1;
            else if (aInactif) aScore = 2;
            
            let bScore = 0;
            if (bT.length === 0) bScore = 1;
            else if (bInactif) bScore = 2;
            
            if (aScore !== bScore) return aScore - bScore;
            
            // If same score, sort by count DESC
            return bT.length - aT.length;
        });

        localStorage.setItem('planning_user_order', JSON.stringify(users.map(u => u.id)));
        renderAdminPlanning(weekStartStr);
    } catch (e) {
        alert("Erreur tri automatique: " + e.message);
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
    const el = document.getElementById('integrated-planning-container');
    const scrollArea = document.getElementById('planning-scroll-area');
    if (!el) return;

    if (!document.fullscreenElement) {
        el.classList.remove('planning-inline');
        el.classList.add('planning-fullscreen');
        if (scrollArea) scrollArea.style.padding = '0 40px 20px 40px';
        el.requestFullscreen().catch(err => {
            alert(`Erreur plein écran: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
};

// Listen for fullscreen exit to restore padding safely
document.addEventListener('fullscreenchange', () => {
    const el = document.getElementById('integrated-planning-container');
    const scrollArea = document.getElementById('planning-scroll-area');
    if (el && !document.fullscreenElement) {
        el.classList.remove('planning-fullscreen');
        el.classList.add('planning-inline');
        if (scrollArea) scrollArea.style.padding = '0 20px 20px 20px'; // restore
    }
});

// --- Fullscreen V2 Logic (Split Screen) ---
window.togglePlanningFullscreenV2 = function() {
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
            document.exitFullscreen().catch(() => {});
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
    } catch(e) {
        // Fallback to reading the one we just saved if local storage parse fails
        try { fsConfig = JSON.parse(localStorage.getItem('planning_fs_config')); } catch(e2) {}
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

window.handleFSDirectUpload = async function(input) {
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

window.openFSDocPicker = async function() {
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

window.addSelectedFSDocs = function() {
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


window.removeFSFile = function(index) {
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

window.saveFSConfig = function(silent = false) {
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
            renderAdminPlanning(currentWeekStartStr);
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
                            <label>Date de début</label>
                            <input type="date" class="form-input" id="task-date" required value="${defaultDateStr}" onchange="document.getElementById('task-date-end').value = this.value">
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
            end_time: endTime + ":00"
        }));
        current.setDate(current.getDate() + 1);
    }

    try {
        await Promise.all(promises);
        closeModal('new-task-modal');
        renderAdminPlanning(refWeekStr);
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
                        <label>Date</label>
                        <input type="date" class="form-input" id="edit-task-date" required value="${task.date}">
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
                    end_time: endTime
                });
                closeModal('edit-task-modal');
                renderAdminPlanning(refWeekStr);
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
        const users = await api.listUsers();

        content.innerHTML = `
            <header>
                <h1>Utilisateurs</h1>
                <div class="actions">
                    <button class="btn-primary" onclick="openNewUserModal()">+ Nouvel Utilisateur</button>
                </div>
            </header>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Prénom</th>
                                <th>Nom</th>
                                <th>Email</th>
                                <th>Rôle</th>
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
                    ? `<span class="badge" style="background:${u.role === 'admin' ? 'var(--badge-admin-bg)' : 'var(--badge-user-bg)'}; color:${u.role === 'admin' ? 'var(--badge-admin-text)' : 'var(--badge-user-text)'}">${u.role}</span>`
                    : `<select class="form-input" style="padding: 4px 8px; font-size: 13px; width: auto;" onchange="changeUserRole('${u.id}', this.value)">
                                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
                                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                                           </select>`
                }
                                </td>
                                <td>${new Date(u.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn-sm btn-view" onclick="openEditUserModal('${u.id}', '${jsFirstName}', '${jsLastName}', '${userColor}')" title="Modifier le nom">✏️ Editer</button>
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

             <div class="form-group">
                <label>Rôle</label>
                <select class="form-input" id="new-user-role">
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                </select>
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
    const mode = document.getElementById('new-user-modal').getAttribute('data-mode') || 'manual';

    if (!email) return alert("Veuillez remplir l'email.");
    if (!firstName || !lastName) return alert("Veuillez remplir le prénom et le nom.");


    try {
        // Calculate Redirect URL (reset-password.html in same directory)
        const redirectTo = window.location.origin + window.location.pathname.replace('dashboard.html', '') + 'reset-password.html';
        console.log("Sending Invite with Redirect To:", redirectTo);

        if (mode === 'manual') {
            const password = "123456";

            await api.createUser(email, password, role, firstName, lastName);
            showSuccessModal("Utilisateur créé avec succès !<br><br><span style='font-size:14.5px;color:rgba(100,100,100,0.9); font-weight:normal;'>Le mot de passe temporaire de l'utilisateur est <b>123456</b>.<br>Il sera invité à le changer dès sa première connexion.</span>");
        } else {
            await api.inviteUser(email, role, redirectTo, firstName, lastName);
            showSuccessModal("Invitation envoyée avec succès !");
        }

        closeModal('new-user-modal');
        renderAdminUsers();
    } catch (e) {
        alert("Erreur : " + e.message);
    }
};


window.showSuccessModal = function (message) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'success-modal';
    overlay.innerHTML = `
        <div class="modal-box" style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 20px;">Succès</h3>
            <p style="margin-bottom: 24px; color: var(--text-secondary);">${message}</p>
            <button class="btn-primary" style="width: 100%; justify-content: center;" onclick="closeModal('success-modal')">OK</button>
        </div>
    `;
    document.body.appendChild(overlay);
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

window.openEditUserModal = function (id, firstName, lastName, color = '#2da140') {
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

    try {
        await api.updateUserProfile(id, firstName, lastName);
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

    adminFilesCache.forEach(file => {
        const parts = file.key.split('/');
        if (parts.length > 1) {
            const folderName = parts[0];

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
        }
    });

    const content = document.getElementById('admin-content');
    let html = `
        <header>
            <h1>Dossiers</h1>
            <div class="actions">
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
                        return await r.text();
                    } catch(e) { 
                        console.error(`Echec fetch archive ${f.key}:`, e);
                        return null; 
                    }
                })
            );
            
            archiveContents.forEach(csv => {
                if (!csv) return;
                const lines = csv.split('\n').filter(l => l.trim());
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
                    const item = {
                        id: clean(cols[0]),
                        user_name: clean(cols[2]),
                        material_name: clean(cols[4]),
                        quantity: clean(cols[5]),
                        comment: clean(cols[6]),
                        status: status,
                        date: clean(cols[8]),
                        handled_by: clean(cols[10]) || 'Admin'
                    };
                    if (status === 'received') historyConfirmed.push(item);
                    else if (status === 'refused') historyRefused.push(item);
                });
            });
            
            // Sort history by date desc
            historyConfirmed.sort((a,b) => new Date(b.date) - new Date(a.date));
            historyRefused.sort((a,b) => new Date(b.date) - new Date(a.date));
            
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
            <header style="position: sticky; top: -32px; margin: -32px -40px 32px -40px; padding: 32px 40px 20px; background: rgba(0,0,0,0.6); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: white;">Demande de matériel</h1>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-secondary" onclick="openAdminCategoryMgmtModal()">⚙️ Catégories</button>
                    <button class="btn-secondary" onclick="openAdminAlertConfigModal()">🔔 Config Alertes</button>
                </div>
            </header>

            <div class="material-admin-container" style="display: grid; gap: 40px; padding-bottom: 60px;">
        `;

        // Filter out acquitted requests if they are 'received'? 
        // User says "L'admin peux aquitter une demande pour la faire disparaitre"
        // So we filter 'received' out of the main list, but maybe have a toggle?
        const mainRequests = requests;

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
                    const statusInfo = groups[req.status] || { label: req.status, color: '#fff' };
                    
                    html += `
                        <tr>
                            <td><div style="font-weight: 600;">${userName}</div></td>
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
                                    <td><div style="font-weight: 700; color: #eee;">${item.user_name}</div></td>
                                    <td><div style="font-size: 14px; color: #bbb;">${item.material_name}</div></td>
                                    <td><div style="font-weight: 800; color: #fff;">${item.quantity}</div></td>
                                    <td><div style="color: #34C759; font-size: 13px; display:flex; align-items:center; gap:6px;">🛡️ ${item.handled_by}</div></td>
                                    <td><div style="font-size: 12px; color: #555;">${new Date(item.date).toLocaleDateString()}</div></td>
                                    <td style="text-align: right;">
                                        <button class="mat-btn refused" onclick="deleteArchivedRequest('${item.id}', '${item.date}')" style="padding: 6px 12px; font-size: 12px;" title="Supprimer de l'historique">🗑️</button>
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
        
        html += `</div>`; // Close material-admin-container

        content.innerHTML = html;

        window.deleteArchivedRequest = async (id, date) => {
            try {
                const year = new Date(date).getFullYear();
                const key = `archives/material_requests/${year}.csv`;
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
                        ${allUsers.sort((a,b) => (a.first_name || '').localeCompare(b.first_name || '')).map(u => `
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
window.renderAdminVehicles = async function() {
    adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-vehicles').classList.add('active');

    const content = document.getElementById('admin-content');
    content.innerHTML = `
        <header style="position: sticky; top: -32px; margin: -32px -40px 32px -40px; padding: 32px 40px 20px; background: rgba(0,0,0,0.6); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: white;">🚐 Flotte Automobile</h1>
            <div style="display: flex; gap: 12px;">
                <button class="btn-primary" onclick="openAddVehicleModal()">➕ Ajouter un véhicule</button>
                <button class="btn-secondary" style="border-color: #34C759; color: #34C759;" onclick="openDkvManagementModal()">💳 Gestion DKV</button>
                <button class="btn-secondary" style="border-color: #007AFF; color: #007AFF;" onclick="openTollManagementModal()">🛣️ Badges</button>
            </div>
        </header>
        <div id="admin-vehicle-list-wrapper">
            <div class="loader-spinner" style="margin: 50px auto;"></div>
        </div>
    `;

    try {
        const [vehicles, users] = await Promise.all([
            api.getVehicles(),
            api.listUsers()
        ]);

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

window.openDkvManagementModal = async function() {
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
        if(!cardNumber) return alert("N° de carte obligatoire");
        
        try {
            await api.saveDkvCard({ card_number: cardNumber, description });
            document.getElementById('new-dkv-number').value = '';
            document.getElementById('new-dkv-desc').value = '';
            renderDkvList(listContainer);
        } catch(e) { alert(e.message); }
    };

    window.handleDeleteDkvCard = async (id) => {
        if(!confirm("Supprimer cette carte ?")) return;
        try {
            await api.deleteDkvCard(id);
            renderDkvList(listContainer);
        } catch(e) { alert(e.message); }
    };
};

window.openTollManagementModal = async function() {
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
        if(!cardNumber) return alert("N° de badge obligatoire");
        
        try {
            await api.saveTollCard({ card_number: cardNumber, description });
            document.getElementById('new-toll-number').value = '';
            document.getElementById('new-toll-desc').value = '';
            renderTollList(listContainer);
        } catch(e) { alert(e.message); }
    };

    window.handleDeleteTollCard = async (id) => {
        if(!confirm("Supprimer ce badge ?")) return;
        try {
            await api.deleteTollCard(id);
            renderTollList(listContainer);
        } catch(e) { alert(e.message); }
    };
};

window.openAddVehicleModal = async function(vehicleId = null) {
    try {
        const [users, dkvCards, tollCards] = await Promise.all([
            api.listUsers(),
            api.getDkvCards(),
            api.getTollCards()
        ]);
        users.sort((a,b) => (a.first_name || '').localeCompare(b.first_name || ''));
        
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
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                    <div>
                        <label class="form-label">Prochain entretien (km)</label>
                        <input type="number" id="v-m-km" class="form-input" value="${existing?.next_maintenance_km || ''}" placeholder="Ex: 50000">
                    </div>
                    <div>
                        <label class="form-label">Date limite entretien</label>
                        <input type="date" id="v-m-date" class="form-input" value="${existing?.next_maintenance_date || ''}">
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
                next_maintenance_date: document.getElementById('v-m-date').value || null
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

window.deleteAdminVehicle = async function(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce véhicule ?")) return;
    try {
        await api.deleteVehicle(id);
        renderAdminVehicles();
    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

// Global badge update for admin sidebar
window.updateMaterialBadge = async function() {
    try {
        const requests = await api.getMaterialRequests();
        const pendingCount = requests.filter(r => r.status === 'requested').length;
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

// --- MOBILE VEHICLES LIST ---
window.renderMobileVehiclesList = async function(myVehicleData) {
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
window.renderMobileVehicleApp = async function(vehicle) {
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
                            <div style="font-size: 11px; color: #8E8E93;">${new Date(log.created_at).toLocaleDateString('fr-FR')} à ${new Date(log.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = `<div style="color:red; text-align:center; padding:40px;">Erreur: ${e.message}</div>`;
    }
};

window.mobileAlert = function(title, message) {
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

window.updateMobileMileage = function(vehicleId, current) {
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

window.reportMobileVehicleIssue = function(vehicleId) {
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

window.logMobileFuel = async function(vehicleId, dkvCard) {
    const dk = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = dk ? '#1C1C1E' : '#ffffff';
    const textColor = dk ? '#ffffff' : '#1c1c1e';
    const inputBg = dk ? '#2C2C2E' : '#f2f2f7';

    // Fetch DKV cards for selection if it's a common vehicle OR if we want to allow picking
    let allCards = [];
    try { allCards = await api.getDkvCards(); } catch(e) {}

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

window.updateVehicleSidebarBadge = function(vehicles) {
    let alertCount = 0;
    const today = new Date();
    
    vehicles.forEach(v => {
        let isAlert = false;
        if (v.next_maintenance_km && (v.next_maintenance_km - v.last_mileage <= 2000)) isAlert = true;
        if (v.next_maintenance_date) {
            const target = new Date(v.next_maintenance_date);
            const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) isAlert = true;
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

window.openVehicleDetailModal = async function(vehicleId) {
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
            <div class="modal-box" style="width: 900px; max-width: 95vw; padding: 0; overflow: hidden; display: flex; flex-direction: column; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
                <!-- Header -->
                <div style="padding: 32px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; font-weight: 700;">Administration de flotte</div>
                        <h2 style="margin: 0; font-size: 28px; font-weight: 800; color: #1a1a1c;">
                            ${v.make || ''} ${v.model || 'Inconnu'} 
                            <span style="background: #000; color: #fff; padding: 4px 12px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 18px; margin-left: 12px; vertical-align: middle;">${v.plate_number}</span>
                        </h2>
                    </div>
                    <div style="display:flex; gap:12px;">
                        <button class="btn-primary" onclick="openAddVehicleEventModal('${v.id}')" style="padding: 10px 20px; border-radius: 12px; background: #2da140; color: #fff; border: none; font-weight: 700;">➕ Ajouter événement</button>
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; border-radius: 12px; background: #eee; color: #333; border: none; font-weight: 700;">Fermer</button>
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
                        <div style="padding: 20px; border-radius: 20px; margin-bottom: 32px; background: #fff; border: 1px solid #eee; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="margin-bottom: 16px;">
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Échéance Kilométrique</div>
                                <div style="font-size: 20px; font-weight: 900; color: #34C759;">${v.next_maintenance_km ? v.next_maintenance_km.toLocaleString() + ' km' : '--'}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #888; margin-bottom: 4px; font-weight: 600;">Échéance Date</div>
                                <div style="font-size: 20px; font-weight: 900; color: #FF9500;">${v.next_maintenance_date ? new Date(v.next_maintenance_date).toLocaleDateString() : '--'}</div>
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
        const fuelLogs = logs.filter(l => l.type === 'fuel').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        const mileageLogs = logs.filter(l => l.type === 'mileage').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

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
window.openAddVehicleEventModal = function(vehicleId) {
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
        } catch(e) {
            console.error(e);
            alert("Erreur: " + e.message);
            saveBtn.disabled = false;
            saveBtn.innerText = "Enregistrer l'événement";
        }
    };
};

window.handleDeleteVehicleLog = async function(id, vehicleId) {
    try {
        await api.deleteVehicleLog(id);
        await window.openVehicleDetailModal(vehicleId);
    } catch(e) {
        alert("Erreur: " + e.message);
    }
};

// --- MACHINES & SCHEMATICS ---
// --- MACHINES & SCHEMATICS (MAP ALTERNATIVE) ---
window.currentBuilding = null;
window.machineIcons = [];

window.renderAdminMap = async function() {
    const content = document.getElementById('admin-content');
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-map');
    if (navItem) navItem.classList.add('active');

    try {
        const buildings = await api.getBuildings();
        content.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
                <div style="padding: 20px; background: rgba(0,0,0,0.2); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h2 style="margin:0; color: white;">🏢 Plans des Bâtiments</h2>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="machine-global-search" placeholder="Rechercher MI... (ID)" class="form-input" style="width: 250px;">
                        <button class="btn-primary" onclick="window.openAddBuildingModal()">+ Nouveau Bâtiment</button>
                    </div>
                </div>
                <div id="buildings-grid" style="flex: 1; padding: 30px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; overflow-y: auto; background: var(--bg-darker, #000);">
                    ${buildings.length === 0 ? `
                        <div style="grid-column: 1/-1; text-align: center; color: #8E8E93; padding-top: 100px;">
                            <div style="font-size: 64px; margin-bottom: 20px;">🏢</div>
                            <h3>Aucun bâtiment configuré</h3>
                            <p>Commencez par ajouter un bâtiment et son plan SVG.</p>
                        </div>
                    ` : buildings.map(b => `
                        <div class="category-card" onclick="window.renderBuildingSchematic('${b.id}')" style="background: rgba(255,255,255,0.05); padding: 25px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; position: relative;">
                            <div style="font-size: 40px; margin-bottom: 15px;">🏪</div>
                            <h3 style="margin:0; color: white; font-size: 20px;">${b.name}</h3>
                            <div style="margin-top: 10px; font-size: 13px; color: #8E8E93;">Cliquer pour voir le plan</div>
                            <button onclick="event.stopPropagation(); window.handleDeleteBuilding('${b.id}')" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.5;">🗑️</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        const globalSearch = document.getElementById('machine-global-search');
        globalSearch.oninput = async (e) => {
            const val = e.target.value.trim().toUpperCase();
            if (val.length < 3) return;
            const machines = await api.getMachines();
            const found = machines.find(m => m.machine_id === val);
            if (found && found.building_id) window.renderBuildingSchematic(found.building_id, found.id);
        };
    } catch (e) { alert("Erreur: " + e.message); }
};

window.renderMobileMap = async function() {
    window.stopPlacingMachine();
    document.body.classList.remove('hide-main-nav');
    const container = document.getElementById('list-content');
    if (container) {
        container.style.position = '';
        container.style.inset = '';
        container.style.zIndex = '';
        container.classList.remove('landscape-mode');
    }
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    const searchContainer = document.querySelector('.mobile-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');
    document.getElementById('selected-category-title').innerText = "Plans Bâtiments";
    mobileCurrentPath = "map";
    try {
        const buildings = await api.getBuildings();
        container.innerHTML = `
            <div style="padding: 20px; display: grid; gap: 15px; background: var(--bg-color);">
                <div style="position: relative;">
                    <input type="text" id="mobile-machine-search" placeholder="🔍 Rechercher N° MI..." style="width:100%; padding: 14px; border-radius: 14px; border:none; background: rgba(142, 142, 147, 0.12); color: var(--text-color);">
                    <div id="m-suggestions" style="display:none; position: absolute; left:0; right:0; top: 100%; max-height: 200px; overflow-y: auto; background: var(--bg-color); border-radius: 0 0 14px 14px; box-shadow: 0 10px 15px rgba(0,0,0,0.2); z-index: 1000; border-top: 1px solid rgba(142,142,147,0.1);"></div>
                </div>
                ${buildings.map(b => `
                    <div style="background: rgba(142, 142, 147, 0.1); padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 15px;" onclick="window.renderBuildingSchematic('${b.id}')">
                        <div style="font-size: 32px;">🏢</div>
                        <div style="flex:1;"><div style="font-weight: bold; color: var(--text-color);">${b.name}</div><div style="font-size: 12px; color: #8E8E93;">Voir le plan</div></div>
                        <div style="color: #8E8E93;">→</div>
                    </div>
                `).join('')}
            </div>
        `;
        const mSearch = document.getElementById('mobile-machine-search');
        const mSugg = document.getElementById('m-suggestions');
        mSearch.oninput = async (e) => {
            const val = e.target.value.trim().toUpperCase();
            if (val.length < 2) { mSugg.style.display = 'none'; return; }
            const machines = await api.getMachines();
            const filtered = machines.filter(m => (m.machine_id || "").toUpperCase().includes(val)).slice(0, 5);
            if (filtered.length > 0) {
                mSugg.style.display = 'block';
                mSugg.innerHTML = filtered.map(m => `
                    <div onclick="window.renderBuildingSchematic('${m.building_id}', '${m.id}')" style="padding: 12px 15px; border-bottom: 1px solid rgba(142,142,147,0.1); color: var(--text-color); display: flex; justify-content: space-between;">
                        <span>${m.machine_id}</span>
                        <small style="opacity: 0.6;">Bât. ${m.building_id ? buildings.find(b => b.id === m.building_id)?.name : 'N/A'}</small>
                    </div>
                `).join('');
            } else { mSugg.style.display = 'none'; }
        };
    } catch (e) { container.innerHTML = `<p style="padding:20px;">Erreur: ${e.message}</p>`; }
};

window.renderBuildingSchematic = async function(buildingId, highlightMachineId = null) {
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
                        <button onclick="${isMobile ? 'window.renderMobileMap()' : 'window.renderAdminMap()'}" style="background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 5px;">
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
                        if(window.isPlacingMachine) return; 
                        window.renderMachineDetailsUI(m.id); 
                    };
                    sc.appendChild(pin);
                }
            });
            if (highlightMachineId) window.focusMachineOnSchematic(highlightMachineId);
        };
    } catch (e) { alert("Erreur: " + e.message); }
};

window.focusMachineOnSchematic = function(id) {
    const pins = document.querySelectorAll('.machine-pin');
    pins.forEach(p => p.style.background = '#5856D6');
    const target = document.getElementById(`pin-${id}`);
    if (target) {
        target.style.background = '#FF3B30';
        target.style.transform = 'scale(1.5)';
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { if(target) target.style.transform = 'scale(1)'; }, 1000);
    }
};

window.openAddBuildingModal = function() {
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
            window.renderAdminMap();
        } catch(e) { alert("Erreur: " + e.message); }
    };
};

window.handleDeleteBuilding = async function(id) {
    if (!confirm("Supprimer ce bâtiment ?")) return;
    try { await api.deleteBuilding(id); window.renderAdminMap(); } catch(e) { alert("Erreur: " + e.message); }
};

window.startPlacingMachine = function(buildingId) {
    window.isPlacingMachine = true;
    document.getElementById('add-m-btn').style.display = 'none';
    document.getElementById('cancel-m-btn').style.display = 'block';
    document.getElementById('placement-hint').style.display = 'block';
};

window.stopPlacingMachine = function() {
    window.isPlacingMachine = false;
    const addBtn = document.getElementById('add-m-btn');
    const cancelBtn = document.getElementById('cancel-m-btn');
    const hint = document.getElementById('placement-hint');
    if (addBtn) addBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (hint) hint.style.display = 'none';
};

window.openAddMachineModal = function(x, y, buildingId) {
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
                    ${['🔧','🚜','🏭','⛽','⚡','💧','🌪️','📦','🦾','🌡️'].map(e => `<div onclick="window.selectEmoji(this, '${e}')" style="font-size: 24px; padding: 5px; cursor: pointer; border-radius: 8px; border: 2px solid transparent;">${e}</div>`).join('')}
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
            if (buildingId) window.renderBuildingSchematic(buildingId); else window.renderAdminMap();
        } catch(e) { alert("Erreur: " + e.message); }
    };
};

window.renderMachineDetailsUI = async function(machineDbId) {
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
    } catch(e) { alert("Erreur: " + e.message); }
};

window.openAddMachineLogModal = function(machineDbId) {
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
        } catch(e) { alert("Erreur: " + e.message); }
    };
};

window.handleDeleteMachine = async function(id, buildingId = null) {
    if (!confirm("Supprimer cette machine ?")) return;
    console.log("UI: Starting machine deletion for:", id);
    try {
        await api.deleteMachine(id);
        console.log("UI: Machine deleted successfully, closing modals...");
        document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
        
        console.log("UI: Refreshing view... BuildingId:", buildingId);
        if (buildingId && typeof window.renderBuildingSchematic === "function") {
            window.renderBuildingSchematic(buildingId);
        } else if (typeof window.renderMobileMap === "function") {
            window.renderMobileMap();
        } else {
            renderAdminMap();
        }
    } catch(e) { 
        console.error("UI: Machine deletion FAILED:", e);
        alert("Erreur: " + e.message); 
    }
};

initDashboard();

