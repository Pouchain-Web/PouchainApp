
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
    window.open(url, '_blank');
};

// --- Mobile View (User / Mobile) ---
let mobileFilesCache = []; // Cache for search
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
            document.querySelector('.mobile-search-container').classList.remove('hidden');
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
        generateMobileCategories(files, myVehicle);
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

    if (myVehicle) {
        const autoCard = document.createElement('div');
        autoCard.className = 'category-card';
        autoCard.innerHTML = `
            <div class="category-icon" style="background-color: #34C759;">🚗</div>
            <div class="category-title" style="font-weight:bold;">Mon Auto</div>
        `;
        autoCard.onclick = () => renderMobileVehicleApp(myVehicle);
        grid.prepend(autoCard);
    }

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

window.renderMobilePlanning = async function (dateStr = new Date().toISOString().split('T')[0]) {
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
        const tasks = await api.getTasks(dateStr);
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
            const d = new Date(current);
            d.setDate(d.getDate() + offset);
            renderMobilePlanning(d.toISOString().split('T')[0]);
        };

        let html = `
            <div style="background: ${bg}; display: flex; flex-direction: column; height: calc(100vh - 60px);">
                <!-- Fixed Header Block (Navigation arrows + Day Title) -->
                <div style="position: fixed; top: 110px; left: 0; right: 0; z-index: 150; background: ${bg}; padding: 16px 16px 0 16px; border-bottom: 1px solid ${subtleBorder}; box-shadow: 0 4px 10px rgba(0,0,0,${dk ? '0.2' : '0.02'});">
                    <div style="margin-bottom: 16px; background: ${cardBg}; padding: 12px; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,${dk ? '0.3' : '0.06'}); display: flex; align-items: center; gap: 10px;">
                        <button onclick="changeMobileDay('${dateStr}', -1)" style="border:none; background: ${btnBg}; color: ${textColor}; border-radius: 50%; width: 44px; height: 44px; font-size: 20px; display: flex; align-items:center; justify-content:center;">◀</button>
                        <div style="flex:1; position: relative;">
                            <input type="date" class="form-input" style="width:100%; border:none; background:transparent; font-weight:bold; text-align:center; font-size: 14px; color: ${textColor};" value="${dateStr}" onchange="renderMobilePlanning(this.value)">
                        </div>
                        <button onclick="changeMobileDay('${dateStr}', 1)" style="border:none; background: ${btnBg}; color: ${textColor}; border-radius: 50%; width: 44px; height: 44px; font-size: 20px; display: flex; align-items:center; justify-content:center;">▶</button>
                    </div>

                    <div style="font-weight: 700; color: ${textColor}; font-size: 18px; margin-bottom: 15px; text-transform: capitalize; padding-left: 8px;">
                        ${displayDate}
                    </div>
                </div>

                <!-- Scrollable Task List -->
                <div style="flex: 1; overflow-y: auto; padding: 130px 16px 100px 16px;">
                    <div class="timeline" style="position: relative; padding-left: 20px; border-left: 3px solid ${timelineBorder}; margin-left: 10px;">
        `;

        if (tasks.length === 0) {
            html += `<div style="color:#8E8E93; text-align:center; padding: 60px 0; font-size: 16px;">
                <div style="font-size: 40px; margin-bottom: 12px;">🌟</div>
                Aucune tâche prévue aujourd'hui
            </div>`;
        } else {
            tasks.forEach(t => {
                const parts = t.title.split(':::DESC:::');
                const mainTitle = parts[0];
                const desc = parts[1] || '';
                const isAllDay = (t.start_time.indexOf('00:00') === 0 && t.end_time.indexOf('00:00') === 0);
                const isDone = t.done === 'true';

                html += `
                    <div style="position: relative; margin-bottom: 24px;">
                        <div style="position: absolute; left: -28px; top: 18px; width: 14px; height: 14px; border-radius: 50%; background: ${isDone ? '#8e8e93' : '#2da140'}; border: 4px solid ${dotBorderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
                        
                        <div style="background: ${isDone ? doneCardBg : cardBg}; border: 1px solid ${isDone ? doneBorder : normalBorder}; border-left: 5px solid ${isDone ? '#8e8e93' : '#2da140'}; border-radius: 16px; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,${dk ? '0.3' : '0.05'}); opacity: ${isDone ? '0.75' : '1'};">
                            <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                ${!isAllDay ? `<div style="font-size: 13px; color: ${isDone ? '#8e8e93' : '#2da140'}; font-weight: 700;">🕒 ${t.start_time.substring(0, 5)} - ${t.end_time.substring(0, 5)}</div>` : '<div></div>'}
                                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight:600; color: ${isDone ? '#2da140' : '#8e8e93'}; background: ${chipBg}; padding: 4px 10px; border-radius: 20px;">
                                    <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleMobileTaskDone('${t.id}', this.checked, '${dateStr}')" style="accent-color: #2da140; width: 16px; height: 16px;">
                                    ${isDone ? 'Fait' : 'À faire'}
                                </label>
                            </div>
                            <div style="font-weight: 700; font-size: 17px; color: ${textColor}; text-decoration: ${isDone ? 'line-through' : 'none'};">${window.escapeHTML(mainTitle)}</div>
                            
                            ${desc ? `
                            <button style="background: transparent; color: #007aff; font-weight: 600; border: none; padding: 12px 0 0 0; font-size: 14px; cursor: pointer;" onclick="openMobileTaskDetailModal('${window.escapeHTML(mainTitle)}', \`${window.escapeHTML(desc)}\`)">Voir détails</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
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
                renderMobilePlanning(date);
            } catch (e) {
                alert("Erreur: " + e.message);
            }
        };

    } catch (e) {
        document.getElementById('list-content').innerHTML = `<div style="color:red; margin:20px; padding: 16px; background: #ffe5e5; border-radius: 12px; border: 1px solid #ffcccc;">Erreur: ${e.message}</div>`;
    }
};

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

window.renderAdminPlanning = async function (mondayStr = null) {
    if (window.planningRefreshInterval) clearInterval(window.planningRefreshInterval);
    
    // Auto-refresh every 15 seconds if we are on the planning page
    window.planningRefreshInterval = setInterval(() => {
        const navPlanning = document.getElementById('nav-planning');
        if (navPlanning && navPlanning.classList.contains('active')) {
            const currentMonday = document.querySelector('[data-monday]');
            const mondayToUse = currentMonday ? currentMonday.getAttribute('data-monday') : null;
            renderAdminPlanning(mondayToUse);
        } else {
            clearInterval(window.planningRefreshInterval);
        }
    }, 15000);

    adminCurrentFolder = null;
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-planning').classList.add('active');

    const content = document.getElementById('admin-content');
    const existingContainer = document.getElementById('planning-fullscreen-container');
    const isCurrentlyFullscreen = existingContainer && (!!document.fullscreenElement);
    
    if (!existingContainer) {
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
                .planning-inline .p-task { border-left: 3px solid var(--primary) !important; border: 1px solid rgba(255,255,255,0.1) !important; background: rgba(255,255,255,0.05); }
                .planning-inline .p-task-title { color: white !important; }
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
                }
                .planning-fullscreen .p-task-title { color: #212529 !important; font-size: 15px !important; font-weight: 700 !important; line-height: 1.3 !important; }
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
                        <button class="btn-sm btn-secondary" onclick="autoSortPlanningUsers('${startStr}')" title="Trier par nombre de tâches">⇅ Tri auto</button>
                        <button class="btn-primary" onclick="openNewTaskModal('${startStr}')">+ Nouvelle Tâche</button>
                        <button class="btn-secondary" onclick="togglePlanningFullscreen()" id="fullscreen-btn" title="Activer/Désactiver le plein écran">⛶ Plein Écran</button>
                    </div>
                </header>
        `;

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
                    const isAllDay = (t.start_time.indexOf('00:00') === 0 && t.end_time.indexOf('00:00') === 0);
                    const isDone = t.done === 'true';
                    let timeHtml = '';
                    if (!isAllDay) {
                        timeHtml = `<div class="p-task-time" style="font-size: 10px; font-weight:bold; margin-bottom: 2px;">${t.start_time.substring(0, 5)} - ${t.end_time.substring(0, 5)}</div>`;
                    }
                    rowsHTML += `
                        <div class="p-task" style="background: ${userColor}30 !important; padding: 4px 6px; border-radius: 4px; position: relative; border-left: 4px solid ${userColor} !important; color: ${userColor}; ${isDone ? 'opacity: 0.4; filter: grayscale(0.8);' : ''}">
                            ${timeHtml}
                            <div class="p-task-title" style="font-size: 11px; font-weight: 500; word-break: break-word; line-height: 1.2; ${isDone ? 'text-decoration: line-through;' : ''}">${window.escapeHTML(parsedTitle)}</div>
                            <button class="btn-sm" style="position: absolute; top: 0px; right: 2px; background: transparent; border:none; color: #ff6b6b; padding: 2px; font-size: 14px; cursor: pointer; line-height:1;" onclick="deleteAdminTask('${t.id}', '${startStr}')" title="Supprimer">×</button>
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

        if (existingContainer) {
            existingContainer.setAttribute('data-monday', startStr);
            // Don't replace the element, just its content to keep fullscreen alive
            existingContainer.innerHTML = finalContent;
        } else {
            content.innerHTML = `
                <div id="planning-fullscreen-container" class="planning-inline" data-monday="${startStr}" style="height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 8px; transition: 0.3s;">
                    ${finalContent}
                </div>
            `;
        }

    } catch (e) {
        content.innerHTML = `<div style="color:var(--danger); padding:20px;">Erreur lors du chargement du planning : ${e.message}</div>`;
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
    const el = document.getElementById('planning-fullscreen-container');
    const scrollArea = document.getElementById('planning-scroll-area');
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
    const el = document.getElementById('planning-fullscreen-container');
    const scrollArea = document.getElementById('planning-scroll-area');
    if (el && !document.fullscreenElement) {
        el.classList.remove('planning-fullscreen');
        el.classList.add('planning-inline');
        if (scrollArea) scrollArea.style.padding = '0 20px 20px 20px'; // restore
    }
});

window.deleteAdminTask = async function (taskId, currentWeekStartStr) {
    try {
        await api.deleteAdminTask(taskId);
        renderAdminPlanning(currentWeekStartStr);
    } catch (e) {
        alert("Erreur: " + e.message);
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

window.renderAdminUsers = async function () {
    adminCurrentFolder = null; // Clear folder view state
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-users').classList.add('active');

    const content = document.getElementById('admin-content');
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
        const [requests, categories, configData, allUsers] = await Promise.all([
            api.getMaterialRequests(),
            api.getMaterialCategories(),
            api.getMaterialConfig(),
            api.listUsers()
        ]);

        const groups = {
            'requested': { label: 'En attente', color: '#ffec99', icon: '⏳' },
            'ordered': { label: 'Commandé', color: '#a5d8ff', icon: '📦' },
            'refused': { label: 'Refusé', color: '#ffc9c9', icon: '❌' },
            'received': { label: 'Reçu / Acquitté', color: '#b2f2bb', icon: '✅' }
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
        const mainRequests = requests.filter(r => r.status !== 'received');
        const archivedRequests = requests.filter(r => r.status === 'received');

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
                                    <button class="mat-btn received" onclick="updateReqStatus('${req.id}', 'received')" title="Acquitter">✅ Acquitter</button>
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

        content.innerHTML = html;

        window.updateReqStatus = async (id, status) => {
            try {
                if (status === 'refused' || status === 'received') {
                    // Permanently delete these ones as requested
                    await api.deleteMaterialRequest(id);
                } else {
                    await api.updateMaterialRequestStatus(id, status);
                }
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
    content.innerHTML = `<div style="text-align:center; padding: 50px;"><div class="loader-spinner"></div></div>`;

    try {
        const [vehicles, users] = await Promise.all([
            api.getVehicles(),
            api.listUsers()
        ]);

        let html = `
            <header style="position: sticky; top: -32px; margin: -32px -40px 32px -40px; padding: 32px 40px 20px; background: rgba(0,0,0,0.6); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: white;">Gestion du parc véhicule</h1>
                <button class="btn-primary" onclick="openAddVehicleModal()">+ Ajouter un véhicule</button>
            </header>

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
                            <div style="font-weight: 700; color: white; font-size: 15px;">${v.make || ''} ${v.model || 'Inconnu'}</div>
                            <div style="font-size: 11px; color: #666;">ID: ${v.id.split('-')[0]}</div>
                        </td>
                        <td><span style="background: #FFF; color: #000; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: 'JetBrains Mono', monospace; border: 2px solid #222; font-size: 13px; letter-spacing: 1px;">${v.plate_number}</span></td>
                        <td>
                            <div style="font-weight: 600; font-size: 15px;">${v.last_mileage.toLocaleString()} <span style="font-size: 12px; color: #666;">km</span></div>
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
        content.innerHTML = html;

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
        content.innerHTML = `<div style="color:red; padding:20px;">Erreur: ${e.message}</div>`;
    }
};

window.openAddVehicleModal = async function(vehicleId = null) {
    try {
        const users = await api.listUsers();
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
                            <option value="">-- Non affecté --</option>
                            ${users.map(u => `<option value="${u.id}" ${existing?.assigned_user_id === u.id ? 'selected' : ''}>${u.first_name || ''} ${u.last_name || ''}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <h3 style="font-size: 14px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 16px;">Cartes & Administration</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div>
                        <label class="form-label">Carte DKV / Essence</label>
                        <input type="text" id="v-dkv" class="form-input" value="${existing?.dkv_card || ''}" placeholder="N° de carte">
                    </div>
                    <div>
                        <label class="form-label">Badge Télépéage</label>
                        <input type="text" id="v-toll" class="form-input" value="${existing?.toll_card || ''}" placeholder="N° du badge">
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
            try {
                await api.saveVehicle(data);
                modal.remove();
                renderAdminVehicles();
            } catch (e) {
                alert("Erreur: " + e.message);
                document.getElementById('save-v-btn').disabled = false;
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

// --- MOBILE VEHICLE APP ---
window.renderMobileVehicleApp = async function(vehicle) {
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    const searchContainer = document.querySelector('.mobile-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');

    document.getElementById('selected-category-title').innerText = "Mon Auto";
    document.getElementById('mobile-upload-btn').style.display = 'none';

    mobileCurrentPath = "auto";

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
                <div style="background: linear-gradient(135deg, #34C759, #28a745); border-radius: 24px; padding: 24px; color: white; margin-bottom: 24px; box-shadow: 0 8px 16px rgba(52, 199, 89, 0.2);">
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">Mon véhicule</div>
                    <div style="font-size: 24px; font-weight: 800; margin-bottom: 16px;">${vehicle.make || ''} ${vehicle.model || 'Auto'}</div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="background: white; color: black; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-family: monospace; font-size: 16px;">${vehicle.plate_number}</span>
                        <span style="font-size: 14px; opacity: 0.9;">${vehicle.year || ''}</span>
                    </div>
                </div>

                <!-- Mileage Card -->
                <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <div style="font-size: 12px; color: #8E8E93; text-transform: uppercase; font-weight: 600;">Kilométrage actuel</div>
                            <div style="font-size: 32px; font-weight: 800; color: ${textColor};">${vehicle.last_mileage.toLocaleString()} <span style="font-size: 16px; font-weight: 600; color: #8E8E93;">km</span></div>
                        </div>
                        <button class="btn-primary" onclick="updateMobileMileage('${vehicle.id}', ${vehicle.last_mileage})" style="padding: 10px 20px; border-radius: 12px; background: #34C759;">Mettre à jour</button>
                    </div>
                    <div style="font-size: 12px; color: #8E8E93;">Dernier relevé : ${new Date(vehicle.updated_at).toLocaleDateString('fr-FR')}</div>
                </div>

                <!-- Quick Actions -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
                    <button style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; cursor: pointer;" onclick="reportMobileVehicleIssue('${vehicle.id}')">
                        <span style="font-size: 24px;">⚠️</span>
                        <span style="font-weight: 600; color: ${textColor}; font-size: 14px;">Signaler un souci</span>
                    </button>
                    <button style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; background: ${cardBg}; border: 1px solid ${border}; border-radius: 20px; cursor: pointer; filter: grayscale(1); opacity: 0.5;" onclick="alert('Bientôt disponible')">
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
                const icon = log.type === 'mileage' ? '📍' : (log.type === 'issue' ? '⚠️' : '🔧');
                html += `
                    <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; padding: 14px; margin-bottom: 10px; display: flex; gap: 14px; align-items: center;">
                        <div style="font-size: 20px; background: ${dk ? '#2C2C2E' : '#f2f2f7'}; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px;">${icon}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: ${textColor}; font-size: 14px;">
                                ${log.type === 'mileage' ? `Mise à jour : ${parseInt(log.value).toLocaleString()} km` : log.description}
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

window.updateMobileMileage = function(vehicleId, current) {
    const val = prompt("Entrez le kilométrage actuel au compteur :", current);
    if (val === null) return;
    const newMileage = parseInt(val);
    if (isNaN(newMileage) || newMileage < current) return alert("Veuillez entrer un kilométrage valide (supérieur ou égal à l'actuel).");

    api.submitVehicleLog({ vehicle_id: vehicleId, type: 'mileage', value: newMileage.toString() })
        .then(() => api.getMyVehicle())
        .then(updated => renderMobileVehicleApp(updated))
        .catch(e => alert("Erreur: " + e.message));
};

window.reportMobileVehicleIssue = function(vehicleId) {
    const desc = prompt("Décrivez brièvement le problème (bruit, choc, voyant...) :");
    if (!desc) return;

    api.submitVehicleLog({ vehicle_id: vehicleId, type: 'issue', description: desc })
        .then(() => api.getMyVehicle())
        .then(updated => renderMobileVehicleApp(updated))
        .catch(e => alert("Erreur: " + e.message));
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

        const modal = document.createElement('div');
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
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; border-radius: 12px; background: #eee; color: #333; border: none;">Fermer</button>
                </div>

                <div style="display: grid; grid-template-columns: 320px 1fr; height: 600px;">
                    <!-- Left Column: Info -->
                    <div style="padding: 32px; background: #ffffff; border-right: 1px solid #eee; overflow-y: auto;">
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
                                <div style="font-size: 12px; padding: 12px; border-radius: 14px; background: #f8f9fa; border: 1px solid #f1f3f5;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                        <span style="font-weight: 800; color: ${l.type === 'issue' ? '#FF3B30' : '#495057'}; font-size: 10px;">${l.type.toUpperCase()}</span>
                                        <span style="color: #adb5bd; font-size: 10px; font-weight:700;">${new Date(l.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div style="color: #212529; font-weight: 500;">${l.type === 'mileage' ? '<b>' + l.value + '</b> km' : l.description}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Right Column: Chart -->
                    <div style="padding: 40px; display: flex; flex-direction: column; gap: 32px; overflow-y: auto; background: #fcfcfd;">
                        <div style="flex: 1; min-height: 350px; background: #ffffff; border-radius: 24px; padding: 24px; border: 1px solid #eee; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                            <h3 style="margin-top: 0; font-size: 16px; color: #1a1a1c; font-weight: 800; margin-bottom: 24px;">📈 Évolution du kilométrage</h3>
                            <canvas id="mileageChart"></canvas>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                            <div style="padding: 24px; border-radius: 24px; background: #fff; border: 1px solid #eee;">
                                <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: 700; text-transform: uppercase;">Dernière Activité</div>
                                <div style="font-size: 20px; font-weight: 800; color: #1a1a1c;">${v.profiles ? v.profiles.first_name + ' ' + v.profiles.last_name : 'N/A'}</div>
                                <div style="font-size: 12px; color: #adb5bd; font-weight: 500;">${v.updated_at ? new Date(v.updated_at).toLocaleString() : ''}</div>
                            </div>
                            <div style="padding: 24px; border-radius: 24px; background: #fff; border: 1px solid #eee;">
                                <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: 700; text-transform: uppercase;">Compteur Actuel</div>
                                <div style="font-size: 32px; font-weight: 950; color: #34C759;">${v.last_mileage.toLocaleString()} <span style="font-size: 16px; opacity: 0.3; font-weight: 400;">km</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Render Chart
        const mileageLogs = logs.filter(l => l.type === 'mileage').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        const ctx = document.getElementById('mileageChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: mileageLogs.map(l => new Date(l.created_at).toLocaleDateString()),
                datasets: [{
                    label: 'Kilométrage',
                    data: mileageLogs.map(l => parseInt(l.value)),
                    borderColor: '#34C759',
                    backgroundColor: 'rgba(52, 199, 89, 0.05)',
                    borderWidth: 4,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#34C759',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#adb5bd', font: { weight: '600', size: 10 } }
                    },
                    y: {
                        grid: { color: '#f1f3f5' },
                        ticks: { color: '#adb5bd', font: { weight: '600', size: 10 } }
                    }
                }
            }
        });

    } catch (e) {
        alert("Erreur: " + e.message);
    }
};

// Start
initDashboard();

