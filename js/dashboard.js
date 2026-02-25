
import { auth } from './auth.js';
import { api } from './api.js';
import config from './config.js';

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

    // Structure
    document.body.innerHTML = `
    <!-- Fixed Top Bar -->
    <div class="mobile-top-bar">
        <div class="mobile-header-content">
            <img src="logo-pouchain.svg" alt="Pouchain" class="header-logo" style="height: 32px; width: auto; max-width: 60vw; object-fit: contain;">
            <button id="logout-btn" class="header-btn" title="Déconnexion">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </button>
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
                const { data: profile } = await window.supabase.createClient(config.supabase.url, config.supabase.anonKey)
                    .from('profiles')
                    .select('preferences')
                    .eq('id', session.user.id)
                    .single();
                // Theme and preferences logic removed
            } catch (prefError) {
                console.warn("Could not fetch user profile details for mobile", prefError);
            }
        }

        const files = await api.listFiles(userId);
        mobileFilesCache = files;
        generateMobileCategories(files);
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
    const results = mobileFilesCache.filter(f =>
        !isInternalFile(f.key) && f.key.toLowerCase().includes(normalizedQuery)
    );
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

function generateMobileCategories(files) {
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = '';

    const categories = new Map();
    const uncategorized = [];

    files.forEach(file => {
        const parts = file.key.split('/');
        if (parts.length > 1) {
            const folder = parts[0];
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
        const card = document.createElement('div');
        card.className = 'category-card';
        const color = data.color || colors[colorIdx % colors.length];
        card.innerHTML = `
            <div class="category-icon" style="background-color: ${color}">${data.emoji}</div>
            <div class="category-title">${catName}</div>
        `;
        // Start navigation from root category
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
        card.onclick = () => openMobileFolder(null); // Special case for root files? Or just list them?
        // Actually "Autres" usually implies root files. 
        // Let's treat it as a special render for root files.
        card.onclick = () => {
            showMobileRootFiles(uncategorized);
        };
        grid.appendChild(card);
    }
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
}

// Global scope for admin functions
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
                        ${users.map(u => `
                            <tr>
                                <td>${u.first_name || '-'}</td>
                                <td>${u.last_name || '-'}</td>
                                <td>${u.email}</td>
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
                                    <button class="btn-sm btn-view" onclick="openEditUserModal('${u.id}', '${(u.first_name || '').replace(/'/g, "\\'")}', '${(u.last_name || '').replace(/'/g, "\\'")}')" title="Modifier le nom">✏️ Editer</button>
                                    ${currentAdminSession && currentAdminSession.user.email === u.email
                ? `<button class="btn-sm btn-view" onclick="openChangePasswordModal()" title="Changer mon mot de passe">🔑 Changer Mdp</button>
                                           <span style="color: #8E8E93; font-size: 13px; padding: 6px 12px;">(Vous)</span>`
                : `<button class="btn-sm btn-view" onclick="openAdminChangePasswordModal('${u.id}', '${(u.first_name || '').replace(/'/g, "\\'")}', '${(u.last_name || '').replace(/'/g, "\\'")}', '${u.email}')" title="Changer le mot de passe manuellement">🔑 Changer Mdp</button>
                                           <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}', '${u.email}')">Supprimer</button>`
            }
                                </td>
                            </tr>
                        `).join('')}
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

            <div id="manual-fields">
                <div class="form-group">
                    <label>Mot de passe</label>
                    <input type="password" class="form-input" id="new-user-password" placeholder="Minimum 6 caractères">
                </div>
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
            const password = document.getElementById('new-user-password').value;
            if (!password) return alert("Veuillez remplir le mot de passe.");
            if (password.length < 6) return alert("Mot de passe trop court (min 6).");

            await api.createUser(email, password, role, firstName, lastName);
            showSuccessModal("Utilisateur créé avec succès !");
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
            <p style="margin-bottom: 24px; color: #666;">${message}</p>
            <button class="btn-primary" style="width: 100%; justify-content: center;" onclick="closeModal('success-modal')">OK</button>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.openAdminChangePasswordModal = function (id, firstName, lastName, email) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'admin-change-password-modal';

    const displayName = (firstName && lastName) ? `${firstName} ${lastName}` : email;

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">Changer le mot de passe</div>
            <p style="margin-bottom: 16px; color: #666;">Changer le mot de passe pour <b>${displayName}</b></p>
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
            <p style="margin-bottom: 24px; color: #666;">${message}</p>
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
        `Voulez-vous vraiment supprimer l'utilisateur <b>${email}</b> ?<br>Cette action est irréversible.`,
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

window.openEditUserModal = function (id, firstName, lastName) {
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
                    <input type="text" class="form-input" id="edit-user-firstname" value="${firstName.replace(/"/g, '&quot;')}">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Nom</label>
                    <input type="text" class="form-input" id="edit-user-lastname" value="${lastName.replace(/"/g, '&quot;')}">
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

    try {
        await api.updateUserProfile(id, firstName, lastName);
        showSuccessModal("Profil mis à jour avec succès.");
        closeModal('edit-user-modal');
        // Non-blocking refresh
        renderAdminUsers();

        // If it's our own session, let's refresh page to update the Name in sidebar? Or just let it be.
        // Doing a simple replace is fine. 
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
        adminFilesCache = await api.listFiles();
        if (adminCurrentFolder) {
            renderAdminFiles(adminCurrentFolder);
        } else {
            renderAdminFolders();
        }
    } catch (e) {
        document.getElementById('admin-content').innerHTML = `<div style="color:red">Erreur chargement: ${e.message}</div>`;
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

// Start
initDashboard();

