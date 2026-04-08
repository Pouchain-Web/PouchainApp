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
    document.getElementById('categories-view').classList.add('hidden');
    document.getElementById('search-results-view').classList.add('hidden');
    const searchContainer = document.querySelector('.mobile-search-container');
    if (searchContainer) searchContainer.classList.add('hidden');
    document.getElementById('document-list').classList.remove('hidden');
    document.getElementById('selected-category-title').innerText = "Plans Bâtiments";
    mobileCurrentPath = "map";
    const container = document.getElementById('list-content');
    try {
        const buildings = await api.getBuildings();
        container.innerHTML = `
            <div style="padding: 20px; display: grid; gap: 15px; background: var(--bg-color);">
                <input type="text" id="mobile-machine-search" placeholder="🔍 Rechercher N° MI..." style="width:100%; padding: 14px; border-radius: 14px; border:none; background: rgba(142, 142, 147, 0.12); color: var(--text-color); margin-bottom: 5px;">
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
        mSearch.oninput = async (e) => {
            const val = e.target.value.trim().toUpperCase();
            if (val.length < 3) return;
            const machines = await api.getMachines();
            const found = machines.find(m => m.machine_id === val);
            if (found && found.building_id) window.renderBuildingSchematic(found.building_id, found.id);
        };
    } catch (e) { container.innerHTML = `<p style="padding:20px;">Erreur: ${e.message}</p>`; }
};

window.renderBuildingSchematic = async function(buildingId, highlightMachineId = null) {
    const isMobile = window.innerWidth <= 768;
    const container = isMobile ? document.getElementById('list-content') : document.getElementById('admin-content');
    try {
        const buildings = await api.getBuildings();
        const b = buildings.find(x => x.id === buildingId);
        if (!b) return;
        const machines = await api.getMachines();
        const bMachines = machines.filter(m => m.building_id === buildingId);

        container.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; background: #000;">
                <div style="padding: 15px 20px; background: rgba(0,0,0,0.4); display: flex; align-items: center; gap: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); z-index: 10;">
                    <button onclick="${isMobile ? 'window.renderMobileMap()' : 'window.renderAdminMap()'}" style="background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        ${isMobile ? '' : 'Retour'}
                    </button>
                    <h3 style="margin: 0; color: white; flex: 1;">${b.name}</h3>
                    ${localStorage.getItem('pouchain_role') === 'admin' ? `<button class="btn-primary" style="padding: 8px 15px; font-size: 13px;" onclick="window.openAddMachineModal(null, null, '${buildingId}')">+ Machine</button>` : ''}
                </div>
                <div id="schematic-viewport" style="flex: 1; position: relative; overflow: auto; display: flex; align-items: center; justify-content: center; background: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 30px 30px;">
                    <div id="schematic-container" style="position: relative; max-width: 95%; max-height: 95%;">
                        <img src="${b.svg_url}" id="schematic-img" style="width: auto; height: auto; max-width: 100%; max-height: 100%; display: block; border-radius: 4px; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                    </div>
                </div>
                <div style="height: 60px; background: #1C1C1E; border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; padding: 0 20px; overflow-x: auto; gap: 10px;">
                    <span style="font-size: 12px; color: #8E8E93; margin-right: 10px;">Machines:</span>
                    ${bMachines.map(m => `<div onclick="window.focusMachineOnSchematic('${m.id}')" style="background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 15px; font-size: 13px; color: white; cursor: pointer; white-space: nowrap;">${m.machine_id}</div>`).join('')}
                </div>
            </div>
        `;
        const schematicImg = document.getElementById('schematic-img');
        schematicImg.onload = () => {
            const container = document.getElementById('schematic-container');
            bMachines.forEach(m => {
                if (m.latitude !== null && m.longitude !== null) {
                    const pin = document.createElement('div');
                    pin.id = `pin-${m.id}`;
                    pin.className = 'machine-pin';
                    pin.style.cssText = `position: absolute; left: ${m.latitude}%; top: ${m.longitude}%; width: 24px; height: 24px; margin: -12px; background: ${m.id === highlightMachineId ? '#FF3B30' : '#5856D6'}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5); cursor: pointer; z-index: ${m.id === highlightMachineId ? 1000 : 100}; transition: all 0.2s ease;`;
                    pin.title = m.machine_id;
                    pin.onclick = (e) => { e.stopPropagation(); window.renderMachineDetailsUI(m.id); };
                    container.appendChild(pin);
                }
            });
            if (localStorage.getItem('pouchain_role') === 'admin') {
                container.onclick = (e) => {
                    const rect = schematicImg.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    window.openAddMachineModal(x, y, buildingId);
                };
            }
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
        setTimeout(() => target.style.transform = 'scale(1)', 1000);
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
            <div style="margin-bottom: 20px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Plan (SVG recommandé)</label><input type="file" id="new-b-svg" accept=".svg,.png,.jpg,.jpeg" style="width:100%;"></div>
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
            <div style="margin-bottom: 15px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Identifiant (MI...)</label><input type="text" id="new-m-id" style="width:100%; padding: 12px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" required></div>
            <div style="margin-bottom: 15px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Type</label><input type="text" id="new-m-type" style="width:100%; padding: 12px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor};" placeholder="Hydraulique, Pompe..."></div>
            <div style="margin-bottom: 20px;"><label style="display:block; font-size: 12px; margin-bottom: 5px; opacity: 0.7;">Photo (Optionnel)</label><input type="file" id="new-m-photo" accept="image/*" style="width:100%;"></div>
            <div style="display:flex; gap: 10px;"><button class="btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">Annuler</button><button class="btn-primary" style="flex:2;" id="save-machine-btn">Enregistrer</button></div>
            <p style="font-size: 10px; opacity: 0.5; margin-top: 15px; text-align:center;">Position: ${x ? x.toFixed(1) : '?'}% / ${y ? y.toFixed(1) : '?'}%</p>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('save-machine-btn').onclick = async () => {
        const id = document.getElementById('new-m-id').value.trim();
        const type = document.getElementById('new-m-type').value.trim();
        const fileInput = document.getElementById('new-m-photo');
        if (!id) return alert("ID requis");
        try {
            let image_url = null;
            if (fileInput.files[0]) {
                const key = `machines/${Date.now()}_${fileInput.files[0].name}`;
                await api.uploadFile(fileInput.files[0], key);
                image_url = `${config.api.workerUrl}/get/${key}`;
            }
            await api.saveMachine({ machine_id: id, type, latitude: x, longitude: y, building_id: buildingId, image_url });
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
                    ${localStorage.getItem('pouchain_role') === 'admin' ? `<button class="btn-secondary" style="width: 50px;" onclick="handleDeleteMachine('${machineDbId}')">🗑️</button>` : ''}
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

window.handleDeleteMachine = async function(id) {
    if (!confirm("Supprimer cette machine ?")) return;
    try {
        await api.deleteMachine(id);
        document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
        if (isMobileView) renderMobileMap(); else renderAdminMap();
    } catch(e) { alert("Erreur: " + e.message); }
};

initDashboard();
