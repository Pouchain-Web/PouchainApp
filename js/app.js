// App Logic

// Mock Data
const DOCUMENTS = [
    { id: 1, title: "FDS - Acétone", category: "FDS", date: "2023-10-15" },
    { id: 2, title: "FDS - White Spirit", category: "FDS", date: "2023-09-20" },
    { id: 3, title: "Habilitation Élec B1V", category: "Habilitation", date: "2024-01-10" },
    { id: 4, title: "Habilitation CACES", category: "Habilitation", date: "2023-11-05" },
    { id: 5, title: "Plan Bâtiment A", category: "Schéma Plan", date: "2022-05-12" },
    { id: 6, title: "Plan Évacuation", category: "Schéma Plan", date: "2022-06-01" },
    { id: 7, title: "Suivi mensuel EPI", category: "Suivi des EPI/ EPC", date: "2024-02-01" },
    { id: 8, title: "Contrôle Levage", category: "Contrôle manutention", date: "2024-01-20" },
    { id: 9, title: "Inventaire Outillage", category: "Listing matériel Pouchain", date: "2024-02-10" },
    { id: 10, title: "Consignation - Chaudière", category: "Consignation", date: "2024-02-14" },
    { id: 11, title: "Fiche Amélioration - Atelier", category: "Fiche amélioratif", date: "2024-01-30" },
];

const CATEGORIES = [
    { name: "FDS", color: "var(--cat-fds)", icon: "🧪" },
    { name: "Habilitation", color: "var(--cat-habilitation)", icon: "🪪" },
    { name: "Schéma Plan", color: "var(--cat-schema)", icon: "🗺️" },
    { name: "Suivi des EPI/ EPC", color: "var(--cat-epi)", icon: "⛑️" },
    { name: "Contrôle manutention", color: "var(--cat-manutention)", icon: "🏗️" },
    { name: "Listing matériel Pouchain", color: "var(--cat-materiel)", icon: "🛠️" },
    { name: "Consignation", color: "var(--cat-consignation)", icon: "🔒" },
    { name: "Fiche amélioratif", color: "var(--cat-amelioratif)", icon: "💡" }
];

// Login Handling
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // TODO: Add real validation if needed, for now just redirect
    if (email && password) {
        window.location.href = 'dashboard.html';
    } else {
        alert('Veuillez remplir les identifiants');
    }
}

// Dashboard Init
function initDashboard() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    // Render Categories
    CATEGORIES.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-icon" style="background-color: ${cat.color}">${cat.icon}</div>
            <div class="category-title">${cat.name}</div>
        `;
        card.onclick = () => filterDocuments(cat.name);
        grid.appendChild(card);
    });

    // Initial load of documents (hidden or all?)
    // renderDocuments(DOCUMENTS);
}

// Open Document Mock
function openDocument(docTitle) {
    // In a real app, this would open the PDF or file
    alert(`Ouverture du document : ${docTitle}\n(Mode lecture seule)`);
}

function filterDocuments(categoryName) {
    // Basic alert for now, effectively "navigating" to that category
    console.log(`Filtering for ${categoryName}`);

    const docList = document.getElementById('document-list');
    const listContent = document.getElementById('list-content');
    const categoryTitle = document.getElementById('selected-category-title');

    // Filter
    const filtered = DOCUMENTS.filter(doc => doc.category.includes(categoryName) || categoryName === 'All');

    // Update UI
    categoryTitle.innerText = categoryName;
    listContent.innerHTML = '';

    if (filtered.length === 0) {
        listContent.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Aucun document trouvé</div>';
    } else {
        filtered.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'document-item';
            // Add click event to open document
            item.onclick = () => openDocument(doc.title);
            item.innerHTML = `
                <div class="document-info">
                    <span class="document-name">${doc.title}</span>
                    <span class="document-meta">${doc.date}</span>
                </div>
                <div class="doc-download-icon">
                    <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </div>
            `;
            listContent.appendChild(item);
        });
    }

    // Show list, hide grid (simple navigation simulation)
    document.getElementById('categories-view').classList.add('hidden');
    docList.classList.remove('hidden');
}

function showCategories() {
    document.getElementById('categories-view').classList.remove('hidden');
    document.getElementById('document-list').classList.add('hidden');
}

// Search Functionality
function handleSearch(query) {
    const term = query.toLowerCase();

    // If we are in category view, maybe just highlight?
    // For simplicity, let's switch to a "Results" view or filter the visible list

    if (term.length > 0) {
        // Force show list view with search results
        const docList = document.getElementById('document-list');
        const listContent = document.getElementById('list-content');
        const categoryTitle = document.getElementById('selected-category-title');

        const filtered = DOCUMENTS.filter(doc => doc.title.toLowerCase().includes(term));

        categoryTitle.innerText = "Recherche";
        listContent.innerHTML = '';

        if (filtered.length === 0) {
            listContent.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Aucun résultat</div>';
        } else {
            filtered.forEach(doc => {
                const item = document.createElement('div');
                item.className = 'document-item';
                item.onclick = () => openDocument(doc.title);
                item.innerHTML = `
                    <div class="document-info">
                        <span class="document-name">${doc.title}</span>
                        <span class="document-meta">${doc.category} • ${doc.date}</span>
                    </div>
                     <div class="doc-download-icon">👁️</div>
                `;
                listContent.appendChild(item);
            });
        }

        document.getElementById('categories-view').classList.add('hidden');
        docList.classList.remove('hidden');

    } else {
        // If empty, go back to home
        showCategories();
    }
}

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }
});
