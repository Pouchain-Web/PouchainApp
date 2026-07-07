import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

const forceSignatureBlackColor = async (dataUrlOrUrl) => {
    if (window.forceSignatureBlackColor) {
        return await window.forceSignatureBlackColor(dataUrlOrUrl);
    }
    return dataUrlOrUrl;
};

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
            try { datesList = JSON.parse(datesList); } catch (e) { datesList = []; }
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
        const dateRespField = form.getTextField(dateRespFieldName);
        const textVal = `Le ${dateAcceptation} par ${adminName}`;
        dateRespField.setText(textVal);

        try {
            const { StandardFonts } = PDFLib;
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const maxFieldWidth = 135; // Maximum space width inside the box
            let fontSize = 10;
            let textWidth = helveticaFont.widthOfTextAtSize(textVal, fontSize);
            while (textWidth > maxFieldWidth && fontSize > 6.5) {
                fontSize -= 0.5;
                textWidth = helveticaFont.widthOfTextAtSize(textVal, fontSize);
            }
            dateRespField.setFontSize(fontSize);
        } catch (fontErr) {
            console.error("Could not scale font size dynamically:", fontErr);
            if (textVal.length > 30) dateRespField.setFontSize(7.5);
            else if (textVal.length > 25) dateRespField.setFontSize(8.5);
            else dateRespField.setFontSize(10);
        }

        // Dessiner l'image de la signature mobile de façon optimale et sans débordement
        if (requestData.signature) {
            try {
                const blackSigUrl = await forceSignatureBlackColor(requestData.signature);
                const sigImageBytes = await window.getSignatureBytes(blackSigUrl);
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
                const sigImageBytes = await window.getSignatureBytes(blackSigUrl);
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
    window.adminCurrentFolder = null;
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
        modal.style.zIndex = "2000000";
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
        let isSigned = false;

        const checkAndResize = () => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
                canvas.width = Math.round(rect.width);
                canvas.height = Math.round(rect.height);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#000000'; // Signature en noir
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        };

        // Adjust resolution after modal renders
        setTimeout(checkAndResize, 350);

        let drawing = false;
        let lastX = 0;
        let lastY = 0;

        function drawStart(x, y) {
            checkAndResize();
            drawing = true;
            isSigned = true;
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
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            isSigned = false;
        });

        // Close button
        document.getElementById('close-sig-modal').addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        // Save button
        document.getElementById('save-sig-btn').addEventListener('click', () => {
            if (!isSigned) {
                alert("Veuillez signer avant de valider.");
                return;
            }
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
        if (typeof window.renderAdminConges === 'function') window.renderAdminConges();
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
            if (typeof window.renderAdminConges === 'function') window.renderAdminConges();
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
    await window.updateAllBadges();
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
