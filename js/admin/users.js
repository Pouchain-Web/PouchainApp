import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminUsers = async function () {
    const content = document.getElementById('admin-content');
    if (!content) {
        if (window.currentAdminSession) renderAdminView(window.currentAdminSession);
        return;
    }

    window.adminCurrentFolder = null; // Clear folder view state
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
                                <th>Société</th>
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
            const userColor = u.color ? u.color : '#FF3B30';
            return `
                            <tr>
                                <td><div style="display:flex; align-items:center; gap:8px;"><div style="width:12px; height:12px; border-radius:50%; background-color:${userColor};" title="Couleur Planning"></div> ${safeFirstName}</div></td>
                                <td>${safeLastName}</td>
                                <td>${safeEmail}</td>
                                <td>
                                    ${window.currentAdminSession && window.currentAdminSession.user.email === u.email
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
                                    ${window.currentAdminSession && window.currentAdminSession.user.email === u.email
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

window.openEditUserModal = function (id, firstName, lastName, color = '#FF3B30', secteur = 'Tout', societe = 'Pouchain') {
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
        if (window.currentAdminSession && window.currentAdminSession.user.id === id) {
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

