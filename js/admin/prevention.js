import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminPreventionPlans = async function () {
    document.querySelectorAll('#admin-nav a').forEach(a => a.classList.remove('active'));
    const navItem = document.getElementById('nav-prevention');
    if (navItem) navItem.classList.add('active');
    
    const container = document.getElementById('admin-content');
    container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: white;">
            <div class="loader" style="border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--primary, #FF3B30); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
        </div>
    `;

    try {
        const [summary, plans, subSignatures] = await Promise.all([
            api.getPreventionSignaturesSummary(),
            api.getPreventionPlans(),
            api.getAdminSubcontractorSignatures().catch(() => [])
        ]);

        container.innerHTML = `
            <div style="height: 100%; width: 100%; position: relative; overflow: hidden; background: url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=2070') center/cover no-repeat fixed; border-radius: 20px;">
                <div style="position: absolute; inset: 0; background: rgba(10, 10, 10, 0.75); backdrop-filter: blur(25px); pointer-events: none; z-index: 0;"></div>
                
                <div style="position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; z-index: 1;">
                    <div style="padding: 40px; min-height: 100%; display: flex; flex-direction: column; color: white; gap: 30px; max-width: 1400px; margin: 0 auto; box-sizing: border-box;">
                        
                        <!-- HEADER -->
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px;">
                            <div>
                                <h1 style="font-size: 32px; font-weight: 800; margin: 0; letter-spacing: -1px;">📋 Plan de prévention</h1>
                                <p style="color: #aaa; font-size: 15px; margin-top: 5px;">Suivez et gérez la signature des plans de prévention par vos collaborateurs et sous-traitants.</p>
                            </div>
                            <button class="btn btn-primary" onclick="window.openAddPreventionPlanModal()" style="height: 46px; padding: 0 24px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor:pointer;">
                                + Nouveau Plan
                            </button>
                        </div>

                        <!-- SPLIT GRID -->
                        <div style="display: grid; grid-template-columns: 1fr 450px; gap: 30px;">
                            
                            <!-- LEFT PANE: COLLABORATEURS -->
                            <div class="glass-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 30px; box-shadow: 0 15px 35px rgba(0,0,0,0.2);">
                                <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 800; color: #5856D6;">👥 Signature des Collaborateurs</h2>
                                
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                        <thead>
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #aaa; font-size: 12px; text-transform: uppercase;">
                                                <th style="padding: 12px 8px;">Nom</th>
                                                <th style="padding: 12px 8px;">Société</th>
                                                <th style="padding: 12px 8px;">Secteur</th>
                                                <th style="padding: 12px 8px; text-align: center;">Avancement</th>
                                                <th style="padding: 12px 8px; text-align: right;">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${summary.map(u => {
                                                const isAllSigned = u.signedCount === u.totalCount && u.totalCount > 0;
                                                const badgeBg = isAllSigned ? '#34C759' : '#FF3B30';
                                                
                                                return `
                                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px;">
                                                        <td style="padding: 16px 8px; font-weight:600;">${window.escapeHTML(u.last_name || '')} ${window.escapeHTML(u.first_name || '')}</td>
                                                        <td style="padding: 16px 8px; color:#ccc;">${window.escapeHTML(u.societe || 'Pouchain')}</td>
                                                        <td style="padding: 16px 8px; color:#ccc;">${window.escapeHTML(u.secteur || 'Tout')}</td>
                                                        <td style="padding: 16px 8px; text-align: center;">
                                                            <span style="background:${badgeBg}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">
                                                                ${u.signedCount}/${u.totalCount}
                                                            </span>
                                                        </td>
                                                        <td style="padding: 16px 8px; text-align: right;"><div style="display:flex; justify-content:flex-end; gap:8px; align-items:center;">
                                                            ${u.signedCount > 0 ? `
                                                                <button class="btn-sm" onclick="window.downloadSignaturesPDF('${u.id}', '${u.last_name.replace(/'/g, "\\'")}', '${u.first_name.replace(/'/g, "\\'")}', '${u.secteur.replace(/'/g, "\\'")}', '${u.societe.replace(/'/g, "\\'")}', this)" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15); color:white; font-size: 11px; padding:6px 12px; border-radius:6px; cursor:pointer;" title="Télécharger le document PDF signé">
                                                                    📄 PDF
                                                                </button>
                                                                <button class="btn-sm" onclick="window.openEditSignatureDatesModal('${u.id}', '${u.last_name.replace(/'/g, "\\'")}', '${u.first_name.replace(/'/g, "\\'")}')" style="background:#5856D6; border:none; color:white; font-size: 11px; padding:6px 12px; border-radius:6px; cursor:pointer; margin-left: 4px;" title="Modifier les dates de signature">
                                                                    ✏️ Dates
                                                                </button>
                                                            ` : ''}
                                                            ${!isAllSigned && u.totalCount > 0 ? `
                                                                <button class="btn-sm" onclick="window.remindUserToSign('${u.id}')" style="background:#FF9500; border:none; color:white; font-size: 11px; padding:6px 12px; border-radius:6px; cursor:pointer;" title="Envoyer une notification push de rappel">
                                                                    🔔 Rappeler
                                                                </button>
                                                            ` : ''}
                                                        </div></td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- RIGHT PANE: PLANS DISPONIBLES -->
                            <div class="glass-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 30px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:20px;">
                                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--primary);">📄 Plans Actifs</h2>
                                
                                <div style="display:flex; flex-direction:column; gap:12px; max-height: 500px; overflow-y:auto;">
                                    ${plans.map(p => `
                                        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
                                            <div style="max-width:70%;">
                                                <h4 style="margin:0; font-size:14px; font-weight:700; color:white;">${window.escapeHTML(p.title)}</h4>
                                                <span style="font-size:11px; color:#8E8E93;">Secteur : ${p.secteur}</span>
                                            </div>
                                            <div style="display:flex; gap:10px; align-items:center;">
                                                <button onclick="window.openEditPreventionPlanModal('${p.id}', '${p.title.replace(/'/g, "\\'")}', '${p.secteur}')" style="background:none; border:none; color:#FF9500; font-size:16px; cursor:pointer; opacity:0.7;" title="Modifier ce plan">
                                                    ✏️
                                                </button>
                                                <button onclick="window.deletePreventionPlan('${p.id}')" style="background:none; border:none; color:#FF3B30; font-size:16px; cursor:pointer; opacity:0.7;" title="Supprimer ce plan">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                        </div>

                        <!-- NEW BOTTOM PANEL: SOUS-TRAITANTS -->
                        <div class="glass-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 30px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); margin-top: 20px;">
                            <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 800; color: #5856D6;">🤝 Signature des Sous-Traitants</h2>
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #aaa; font-size: 12px; text-transform: uppercase;">
                                            <th style="padding: 12px 8px;">Nom / Prénom</th>
                                            <th style="padding: 12px 8px;">Entreprise</th>
                                            <th style="padding: 12px 8px;">Plan de prévention</th>
                                            <th style="padding: 12px 8px;">Accompagnateur</th>
                                            <th style="padding: 12px 8px; text-align: center;">Date de signature</th>
                                            <th style="padding: 12px 8px; text-align: center;">Signature</th>
                                            <th style="padding: 12px 8px; text-align: right;">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(() => {
                                            if (subSignatures.length === 0) {
                                                return `
                                                    <tr>
                                                        <td colspan="7" style="padding: 30px; text-align: center; color: #aaa; font-style: italic; font-size: 14px;">Aucune signature de sous-traitant pour le moment.</td>
                                                    </tr>
                                                `;
                                            }

                                            const groupedSubs = new Map();
                                            subSignatures.forEach(s => {
                                                const key = `${(s.last_name || '').toLowerCase().trim()}_${(s.first_name || '').toLowerCase().trim()}_${(s.company || '').toLowerCase().trim()}`;
                                                if (!groupedSubs.has(key)) {
                                                    groupedSubs.set(key, {
                                                        first_name: s.first_name,
                                                        last_name: s.last_name,
                                                        company: s.company,
                                                        signatures: []
                                                    });
                                                }
                                                groupedSubs.get(key).signatures.push(s);
                                            });

                                            let index = 0;
                                            return Array.from(groupedSubs.values()).map(sub => {
                                                const groupId = `group-${index++}`;
                                                
                                                // Parent Row
                                                let subHtml = `
                                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; background: rgba(255,255,255,0.02); cursor: pointer;" onclick="window.toggleSubcontractorGroup('${groupId}')">
                                                        <td style="padding: 16px 8px; font-weight:600; display: flex; align-items: center; gap: 8px;">
                                                            <span id="arrow-${groupId}" style="font-size: 10px; color: #5856D6; transition: transform 0.2s; display: inline-block;">▶</span>
                                                            ${window.escapeHTML(sub.last_name || '')} ${window.escapeHTML(sub.first_name || '')}
                                                        </td>
                                                        <td style="padding: 16px 8px; color:#ccc;">${window.escapeHTML(sub.company || '')}</td>
                                                        <td style="padding: 16px 8px; color:#aaa;" colspan="4">${sub.signatures.length} plan(s) signé(s)</td>
                                                        <td style="padding: 16px 8px; text-align: right; white-space: nowrap;" onclick="event.stopPropagation()">
                                                            <button class="btn-sm" onclick="window.downloadSubcontractorPDF('${sub.last_name.replace(/'/g, "\\'")}', '${sub.first_name.replace(/'/g, "\\'")}', '${sub.company.replace(/'/g, "\\'")}', this)" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15); color:white; font-size: 11px; padding:6px 12px; border-radius:6px; cursor:pointer;" title="Télécharger le document PDF de signatures">
                                                                📄 PDF global
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `;

                                                // Child Rows (Signatures)
                                                sub.signatures.forEach(sig => {
                                                    const plan = plans.find(p => p.id === sig.plan_id);
                                                    const planTitle = plan ? plan.title : 'Plan supprimé';
                                                    const dateVal = sig.signed_at ? sig.signed_at.split('T')[0] : '';
                                                    
                                                    let companionName = 'Non spécifié';
                                                    if (sig.signed_by_user_id) {
                                                        const companion = summary.find(p => p.id === sig.signed_by_user_id);
                                                        if (companion) {
                                                            companionName = `${companion.first_name || ''} ${companion.last_name || ''}`;
                                                        }
                                                    }

                                                    subHtml += `
                                                        <tr class="${groupId}" style="border-bottom: 1px solid rgba(255,255,255,0.02); font-size: 13px; background: rgba(0,0,0,0.2); display: none;">
                                                            <td style="padding: 12px 8px; padding-left: 24px; color:#8E8E93;" colspan="2">↳ Plan de prévention</td>
                                                            <td style="padding: 12px 8px; color:#ccc; font-weight: 500;">${window.escapeHTML(planTitle)}</td>
                                                            <td style="padding: 12px 8px; color:#aaa;">${window.escapeHTML(companionName)}</td>
                                                            <td style="padding: 12px 8px; text-align: center;">
                                                                <input type="date" value="${dateVal}" onchange="window.updateSubcontractorDate('${sig.id}', this.value)" style="padding:4px 8px; border:none; border-radius:6px; background:#2C2C2E; color:white; font-size:12px; cursor:pointer;">
                                                            </td>
                                                            <td style="padding: 6px 8px; text-align: center;">
                                                                <img src="${sig.signature_data}" style="max-height:30px; background:white; border-radius:6px; padding:2px; border:1px solid rgba(255,255,255,0.1); cursor:pointer;" onclick="window.openSubcontractorSigImage('${sig.signature_data}', '${sig.first_name.replace(/'/g, "\\'")} ${sig.last_name.replace(/'/g, "\\'")}')" title="Agrandir la signature">
                                                            </td>
                                                            <td style="padding: 12px 8px; text-align: right;">
                                                                <button onclick="window.deleteSubcontractorSig('${sig.id}')" style="background:none; border:none; color:#FF3B30; font-size:14px; cursor:pointer; opacity:0.7;" title="Supprimer cette signature">
                                                                    🗑️
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    `;
                                                });

                                                return subHtml;
                                            }).join('');
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div style="color:#FF3B30; padding:40px;">Erreur : ${e.message}</div>`;
    }
};

window.remindUserToSign = async function(userId) {
    try {
        await api.sendNotification(null, "🔔 Rappel : Veuillez signer les plans de prévention en attente dans votre application.", [userId]);
        window.showToast("Notification de rappel envoyée !");
    } catch(err) {
        alert("Erreur lors de l'envoi de la notification : " + err.message);
    }
};

window.downloadSignaturesPDF = async function(userId, lastName, firstName, secteur, societe, btn) {
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ PDF...";
    }
    try {
        const [signatures, plans] = await Promise.all([
            api.getAdminUserPreventionSignatures(userId).catch(() => []),
            api.getPreventionPlans().catch(() => [])
        ]);

        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([595.276, 841.890]);
        const { width, height } = page.getSize();
        
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Header
        page.drawText("FICHE DE SIGNATURES - PRISE EN COMPTE DES PLANS DE PRÉVENTION", {
            x: 50,
            y: height - 60,
            size: 14,
            font: fontBold,
            color: rgb(0.18, 0.63, 0.25)
        });
        
        page.drawLine({
            start: { x: 50, y: height - 75 },
            end: { x: width - 50, y: height - 75 },
            thickness: 1.5,
            color: rgb(0.8, 0.8, 0.8)
        });
        
        // Info Box
        page.drawText(`Collaborateur : ${firstName || ''} ${lastName || ''}`, {
            x: 50,
            y: height - 105,
            size: 12,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1)
        });
        
        page.drawText(`Société : ${societe || 'Pouchain'}`, {
            x: 50,
            y: height - 125,
            size: 11,
            font: font,
            color: rgb(0.3, 0.3, 0.3)
        });
        
        page.drawText(`Secteur : ${secteur || 'Tout'}`, {
            x: 50,
            y: height - 145,
            size: 11,
            font: font,
            color: rgb(0.3, 0.3, 0.3)
        });
        
        page.drawText(`Date de mise à jour : ${new Date().toLocaleDateString('fr-FR')}`, {
            x: width - 200,
            y: height - 105,
            size: 11,
            font: font,
            color: rgb(0.4, 0.4, 0.4)
        });
        
        // Table Header
        let yPos = height - 190;
        
        page.drawRectangle({
            x: 50,
            y: yPos - 5,
            width: width - 100,
            height: 25,
            color: rgb(0.9, 0.9, 0.95)
        });
        
        page.drawText("Plan de prévention", { x: 60, y: yPos, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Date de signature", { x: 300, y: yPos, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Signature", { x: 450, y: yPos, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        
        page.drawLine({
            start: { x: 50, y: yPos - 5 },
            end: { x: width - 50, y: yPos - 5 },
            thickness: 1,
            color: rgb(0.7, 0.7, 0.7)
        });
        
        yPos -= 35;
        
        const userPlans = plans.filter(pl => pl.secteur === 'Tout' || pl.secteur === secteur || secteur === 'Tout');
        for (const plan of userPlans) {
            const sig = signatures.find(s => s.plan_id === plan.id);
            
            page.drawLine({
                start: { x: 50, y: yPos - 5 },
                end: { x: width - 50, y: yPos - 5 },
                thickness: 0.5,
                color: rgb(0.8, 0.8, 0.8)
            });
            
            const maxTitleLen = 35;
            let titleText = plan.title;
            if (titleText.length > maxTitleLen) titleText = titleText.substring(0, maxTitleLen) + "...";
            
            page.drawText(titleText, { x: 60, y: yPos + 10, size: 10, font: font, color: rgb(0.1, 0.1, 0.1) });
            
            if (sig) {
                const dateStr = new Date(sig.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' });
                page.drawText(dateStr, { x: 300, y: yPos + 10, size: 9, font: font, color: rgb(0.1, 0.6, 0.2) });
                
                try {
                    const sigImageBytes = await fetch(sig.signature_data).then(res => res.arrayBuffer());
                    const sigImage = await pdfDoc.embedPng(sigImageBytes);
                    page.drawImage(sigImage, {
                        x: 450,
                        y: yPos - 2,
                        width: 70,
                        height: 30
                    });
                } catch(imgErr) {
                    console.error("Error drawing signature image in PDF:", imgErr);
                    page.drawText("[Erreur image]", { x: 450, y: yPos + 10, size: 8, font: font, color: rgb(0.8, 0.1, 0.1) });
                }
            } else {
                page.drawText("Non signé", { x: 300, y: yPos + 10, size: 9, font: font, color: rgb(0.8, 0.1, 0.1) });
            }
            
            yPos -= 45;
            
            if (yPos < 60) {
                page = pdfDoc.addPage([595.276, 841.890]);
                yPos = height - 60;
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Signatures_${lastName || ''}_${firstName || ''}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch(err) {
        console.error("PDF generation failed:", err);
        alert("Erreur de génération du PDF : " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📄 PDF";
        }
    }
};

window.openEditSignatureDatesModal = async function(userId, lastName, firstName) {
    const bg = '#1C1C1E';
    const textColor = '#FFFFFF';
    const inputBg = '#2C2C2E';
    const border = 'rgba(255,255,255,0.1)';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "15000";
    modal.innerHTML = `
        <div class="modal-box" style="background: ${bg}; color: ${textColor}; width: 90%; max-width: 550px; padding: 30px; border-radius: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid ${border}; text-align: left;">
            <h2 style="margin-top:0; font-size:22px; font-weight:800; border-bottom:1px solid ${border}; padding-bottom:15px; margin-bottom:20px;">✏️ Modifier les Dates de Signature</h2>
            <p style="color: #aaa; font-size: 14px; margin-bottom: 20px;">Collaborateur : <strong>${firstName} ${lastName}</strong></p>
            
            <div id="edit-dates-loader" style="text-align: center; padding: 30px 0;">
                <div class="loader" style="border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--primary, #FF3B30); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; display: inline-block;"></div>
            </div>
            
            <div id="edit-dates-content" style="display: none; max-height: 350px; overflow-y: auto; margin-bottom: 25px; padding-right: 5px;"></div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="height: 46px; padding: 0 24px; border-radius: 12px; cursor:pointer;">Annuler</button>
                <button id="save-sig-dates-btn" class="btn btn-primary" style="height: 46px; padding: 0 24px; border-radius: 12px; cursor:pointer;" disabled>Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const [signatures, plans] = await Promise.all([
            api.getAdminUserPreventionSignatures(userId).catch(() => []),
            api.getPreventionPlans().catch(() => [])
        ]);

        const loader = document.getElementById('edit-dates-loader');
        const contentDiv = document.getElementById('edit-dates-content');
        const saveBtn = document.getElementById('save-sig-dates-btn');

        if (loader) loader.style.display = 'none';
        if (contentDiv) contentDiv.style.display = 'block';

        if (signatures.length === 0) {
            contentDiv.innerHTML = `<p style="color: #8E8E93; text-align: center; padding: 20px 0;">Aucune signature trouvée pour ce collaborateur.</p>`;
            return;
        }

        let html = '';
        signatures.forEach(sig => {
            const plan = plans.find(p => p.id === sig.plan_id);
            if (!plan) return;
            const dateVal = sig.signed_at ? sig.signed_at.split('T')[0] : '';
            html += `
                <div class="sig-date-row" data-sig-id="${sig.id}" data-original-date="${dateVal}" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                    <span style="font-size: 14px; font-weight: 700; color: #fff;">${window.escapeHTML(plan.title)}</span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="date" class="sig-date-input" value="${dateVal}" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: ${inputBg}; color: ${textColor}; font-size: 14px;">
                    </div>
                </div>
            `;
        });

        contentDiv.innerHTML = html;
        saveBtn.disabled = false;

        saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            saveBtn.innerText = "Enregistrement...";
            
            try {
                const rows = contentDiv.querySelectorAll('.sig-date-row');
                for (const row of rows) {
                    const sigId = row.dataset.sigId;
                    const originalDate = row.dataset.originalDate;
                    const input = row.querySelector('.sig-date-input');
                    const newDateVal = input.value;
                    
                    if (newDateVal && newDateVal !== originalDate) {
                        // On enregistre à midi UTC pour éviter les décalages de fuseau horaire
                        const newTimestamp = `${newDateVal}T12:00:00Z`;
                        await api.updatePreventionSignatureDate(sigId, newTimestamp);
                    }
                }
                modal.remove();
                window.showToast("Dates de signature mises à jour avec succès.");
                window.renderAdminPreventionPlans();
            } catch (err) {
                alert("Erreur lors de la modification des dates : " + err.message);
                saveBtn.disabled = false;
                saveBtn.innerText = "Enregistrer";
            }
        };

    } catch (err) {
        console.error("Error opening edit signature dates modal:", err);
        modal.remove();
        alert("Impossible de charger les signatures : " + err.message);
    }
};

window.deletePreventionPlan = async function(planId) {
    if (!confirm("Voulez-vous vraiment supprimer ce plan de prévention ? Cela supprimera également toutes les signatures associées.")) return;
    try {
        await api.deletePreventionPlan(planId);
        window.showToast("Plan supprimé avec succès.");
        window.renderAdminPreventionPlans();
    } catch(err) {
        alert("Erreur lors de la suppression : " + err.message);
    }
};

window.updateSubcontractorDate = async function(signatureId, dateVal) {
    if (!dateVal) return;
    try {
        // Enregistrer à midi UTC
        const timestamp = `${dateVal}T12:00:00Z`;
        await api.updateSubcontractorSignatureDate(signatureId, timestamp);
        window.showToast("Date du sous-traitant mise à jour avec succès.");
    } catch(err) {
        alert("Erreur lors de la mise à jour de la date : " + err.message);
    }
};

window.openSubcontractorSigImage = function(imgData, name) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "16000";
    modal.onclick = () => modal.remove();
    modal.innerHTML = `
        <div style="background:#fff; padding:20px; border-radius:16px; text-align:center; max-width:90%; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <h4 style="margin:0 0 10px 0; color:#333;">Signature de ${name}</h4>
            <img src="${imgData}" style="max-width:100%; max-height:400px; border:1px solid #ccc; border-radius:8px;">
            <p style="font-size:12px; color:#666; margin:10px 0 0 0;">Cliquer n'importe où pour fermer</p>
        </div>
    `;
    document.body.appendChild(modal);
};

window.deleteSubcontractorSig = async function(signatureId) {
    if (!confirm("Voulez-vous vraiment supprimer cette signature de sous-traitant ?")) return;
    try {
        await api.deleteSubcontractorSignature(signatureId);
        window.showToast("Signature supprimée avec succès.");
        window.renderAdminPreventionPlans();
    } catch(err) {
        alert("Erreur lors de la suppression : " + err.message);
    }
};

window.downloadSubcontractorPDF = async function(lastName, firstName, company, btn) {
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ PDF...";
    }
    try {
        const [subSignatures, plans] = await Promise.all([
            api.getAdminSubcontractorSignatures().catch(() => []),
            api.getPreventionPlans().catch(() => [])
        ]);

        // Filter signatures matching this subcontractor (case insensitive)
        const matchingSigs = subSignatures.filter(s => 
            s.first_name.trim().toLowerCase() === firstName.trim().toLowerCase() &&
            s.last_name.trim().toLowerCase() === lastName.trim().toLowerCase() &&
            s.company.trim().toLowerCase() === company.trim().toLowerCase()
        );

        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([595.276, 841.890]);
        const { width, height } = page.getSize();
        
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Header
        page.drawText("FICHE DE SIGNATURES - PLANS DE PRÉVENTION SOUS-TRAITANTS", {
            x: 50,
            y: height - 60,
            size: 14,
            font: fontBold,
            color: rgb(0.18, 0.63, 0.25)
        });
        
        page.drawLine({
            start: { x: 50, y: height - 75 },
            end: { x: width - 50, y: height - 75 },
            thickness: 1.5,
            color: rgb(0.8, 0.8, 0.8)
        });
        
        // Info Box
        page.drawText(`Sous-traitant : ${firstName} ${lastName}`, {
            x: 50,
            y: height - 105,
            size: 12,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1)
        });
        
        page.drawText(`Entreprise : ${company}`, {
            x: 50,
            y: height - 125,
            size: 11,
            font: font,
            color: rgb(0.3, 0.3, 0.3)
        });
        
        page.drawText(`Date de mise à jour : ${new Date().toLocaleDateString('fr-FR')}`, {
            x: width - 200,
            y: height - 105,
            size: 11,
            font: font,
            color: rgb(0.4, 0.4, 0.4)
        });
        
        // Table Header
        let yPos = height - 170;
        
        page.drawRectangle({
            x: 50,
            y: yPos - 5,
            width: width - 100,
            height: 25,
            color: rgb(0.9, 0.9, 0.95)
        });
        
        page.drawText("Plan de prévention", { x: 60, y: yPos, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Date de signature", { x: 300, y: yPos, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText("Signature", { x: 450, y: yPos, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        
        page.drawLine({
            start: { x: 50, y: yPos - 5 },
            end: { x: width - 50, y: yPos - 5 },
            thickness: 1,
            color: rgb(0.7, 0.7, 0.7)
        });
        
        yPos -= 35;
        
        // For each signature of this subcontractor
        for (const sig of matchingSigs) {
            const plan = plans.find(p => p.id === sig.plan_id);
            if (!plan) continue;

            page.drawLine({
                start: { x: 50, y: yPos - 5 },
                end: { x: width - 50, y: yPos - 5 },
                thickness: 0.5,
                color: rgb(0.8, 0.8, 0.8)
            });
            
            const maxTitleLen = 35;
            let titleText = plan.title;
            if (titleText.length > maxTitleLen) titleText = titleText.substring(0, maxTitleLen) + "...";
            
            page.drawText(titleText, { x: 60, y: yPos + 10, size: 10, font: font, color: rgb(0.1, 0.1, 0.1) });
            
            const dateStr = new Date(sig.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' });
            page.drawText(dateStr, { x: 300, y: yPos + 10, size: 9, font: font, color: rgb(0.1, 0.6, 0.2) });
            
            try {
                const sigImageBytes = await fetch(sig.signature_data).then(res => res.arrayBuffer());
                const sigImage = await pdfDoc.embedPng(sigImageBytes);
                page.drawImage(sigImage, {
                    x: 450,
                    y: yPos - 2,
                    width: 70,
                    height: 30
                });
            } catch(imgErr) {
                console.error("Error drawing signature image in PDF:", imgErr);
                page.drawText("[Erreur image]", { x: 450, y: yPos + 10, size: 8, font: font, color: rgb(0.8, 0.1, 0.1) });
            }
            
            yPos -= 45;
            
            if (yPos < 60) {
                page = pdfDoc.addPage([595.276, 841.890]);
                yPos = height - 60;
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Signatures_SousTraitant_${lastName || ''}_${firstName || ''}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch(err) {
        console.error("PDF generation failed:", err);
        alert("Erreur de génération du PDF : " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📄 PDF";
        }
    }
};



window.openEditPreventionPlanModal = function(planId, currentTitle, currentSecteur) {
    const bg = '#1C1C1E';
    const textColor = '#FFFFFF';
    const inputBg = '#2C2C2E';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "15000";

    modal.innerHTML = `
        <div class="modal-box" style="background: ${bg}; color: ${textColor}; width: 90%; max-width: 480px; padding: 30px; border-radius: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="margin-top:0; font-size:22px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px; margin-bottom:20px;">✏️ Modifier le Plan de Prévention</h2>

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size: 12px; font-weight:700; text-transform:uppercase; margin-bottom: 8px; color:#aaa; letter-spacing:0.5px;">Titre du document</label>
                <input type="text" id="edit-plan-title" style="width:100%; padding: 14px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size:15px; box-sizing:border-box;" required value="${window.escapeHTML(currentTitle)}">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size: 12px; font-weight:700; text-transform:uppercase; margin-bottom: 8px; color:#aaa; letter-spacing:0.5px;">Secteur ciblé</label>
                <select id="edit-plan-secteur" style="width:100%; padding: 14px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size:15px;">
                    <option value="Tout" ${currentSecteur === 'Tout' ? 'selected' : ''}>Tout (Tous les secteurs)</option>
                    <option value="AIA" ${currentSecteur === 'AIA' ? 'selected' : ''}>AIA uniquement</option>
                    <option value="HT" ${currentSecteur === 'HT' ? 'selected' : ''}>HT uniquement</option>
                </select>
            </div>

            <div style="display:flex; gap: 12px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
                <button class="btn-secondary" style="flex:1; height:46px; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer;" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button class="btn-primary" style="flex:2; height:46px; border-radius:12px; font-size:14px; font-weight:700; background:#FF9500; cursor:pointer;" id="update-plan-btn">Enregistrer</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('update-plan-btn').onclick = async () => {
        const title = document.getElementById('edit-plan-title').value.trim();
        const secteur = document.getElementById('edit-plan-secteur').value;
        const updateBtn = document.getElementById('update-plan-btn');

        if (!title) return alert("Veuillez renseigner le titre du document.");

        updateBtn.disabled = true;
        updateBtn.innerText = "Enregistrement...";
        try {
            await api.updatePreventionPlan(planId, title, secteur);
            modal.remove();
            window.showToast("Plan de prévention modifié !");
            window.renderAdminPreventionPlans();
        } catch(err) {
            alert("Erreur : " + err.message);
            updateBtn.disabled = false;
            updateBtn.innerText = "Enregistrer";
        }
    };
};

window.openAddPreventionPlanModal = function() {
    const bg = '#1C1C1E';
    const textColor = '#FFFFFF';
    const inputBg = '#2C2C2E';

    // Récupère les PDFs déjà présents dans Plan de prévention/
    const R2_PREFIX = 'Plan de prévention/';
    const existingPdfs = (window.adminFilesCache || []).filter(f =>
        f.key.startsWith(R2_PREFIX) &&
        !f.key.endsWith('.keep') &&
        !f.key.startsWith('.meta_') &&
        f.key.toLowerCase().endsWith('.pdf')
    );

    const existingOptions = existingPdfs.map(f => {
        const name = f.key.substring(R2_PREFIX.length);
        return `<option value="${f.key.replace(/"/g, '&quot;')}">${name}</option>`;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = "15000";

    modal.innerHTML = `
        <div class="modal-box" style="background: ${bg}; color: ${textColor}; width: 90%; max-width: 480px; padding: 30px; border-radius: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="margin-top:0; font-size:22px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px; margin-bottom:20px;">📋 Nouveau Plan de Prévention</h2>

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size: 12px; font-weight:700; text-transform:uppercase; margin-bottom: 8px; color:#aaa; letter-spacing:0.5px;">Titre du document</label>
                <input type="text" id="new-plan-title" style="width:100%; padding: 14px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size:15px; box-sizing:border-box;" required placeholder="Ex: Plan de prévention chantier X">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size: 12px; font-weight:700; text-transform:uppercase; margin-bottom: 8px; color:#aaa; letter-spacing:0.5px;">Secteur ciblé</label>
                <select id="new-plan-secteur" style="width:100%; padding: 14px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size:15px;">
                    <option value="Tout">Tout (Tous les secteurs)</option>
                    <option value="AIA">AIA uniquement</option>
                    <option value="HT">HT uniquement</option>
                </select>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display:block; font-size: 12px; font-weight:700; text-transform:uppercase; margin-bottom: 8px; color:#aaa; letter-spacing:0.5px;">Source du PDF</label>
                <div style="display:flex; gap:10px; margin-bottom:12px;">
                    <button id="src-existing-btn" onclick="document.getElementById('src-existing').style.display='block'; document.getElementById('src-upload').style.display='none'; this.style.background='#007AFF'; document.getElementById('src-upload-btn').style.background='${inputBg}';" style="flex:1; padding:10px; border:none; border-radius:10px; background:#007AFF; color:white; font-size:13px; font-weight:700; cursor:pointer;">📁 Fichier existant R2</button>
                    <button id="src-upload-btn" onclick="document.getElementById('src-upload').style.display='block'; document.getElementById('src-existing').style.display='none'; this.style.background='#007AFF'; document.getElementById('src-existing-btn').style.background='${inputBg}';" style="flex:1; padding:10px; border:none; border-radius:10px; background:${inputBg}; color:white; font-size:13px; font-weight:700; cursor:pointer;">⬆️ Nouveau fichier</button>
                </div>

                <div id="src-existing" style="display:block;">
                    <select id="new-plan-existing-key" style="width:100%; padding: 14px; border:none; border-radius: 12px; background: ${inputBg}; color: ${textColor}; font-size:14px;">
                        <option value="">-- Choisir un PDF existant --</option>
                        ${existingOptions}
                    </select>
                    ${existingPdfs.length === 0 ? `<p style="color:#aaa; font-size:12px; margin-top:8px;">Aucun PDF trouvé dans Plan de prévention/</p>` : `<p style="color:#aaa; font-size:12px; margin-top:8px;">${existingPdfs.length} fichier(s) disponible(s)</p>`}
                </div>

                <div id="src-upload" style="display:none;">
                    <input type="file" id="new-plan-file" accept=".pdf" style="width:100%; color:white; font-size:14px;">
                    <p style="color:#aaa; font-size:12px; margin-top:8px;">Sera stocké dans : Plan de prévention/</p>
                </div>
            </div>

            <div style="display:flex; gap: 12px; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
                <button class="btn-secondary" style="flex:1; height:46px; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer;" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                <button class="btn-primary" style="flex:2; height:46px; border-radius:12px; font-size:14px; font-weight:700; background:var(--primary, #FF3B30); cursor:pointer;" id="save-plan-btn">Ajouter</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('save-plan-btn').onclick = async () => {
        const title = document.getElementById('new-plan-title').value.trim();
        const secteur = document.getElementById('new-plan-secteur').value;
        const saveBtn = document.getElementById('save-plan-btn');

        const isExistingMode = document.getElementById('src-existing').style.display !== 'none';
        const existingKey = document.getElementById('new-plan-existing-key').value;
        const fileInput = document.getElementById('new-plan-file');

        if (!title) return alert("Veuillez renseigner le titre du document.");

        if (isExistingMode) {
            if (!existingKey) return alert("Veuillez sélectionner un fichier PDF existant.");
            saveBtn.disabled = true;
            saveBtn.innerText = "Enregistrement...";
            try {
                await api.savePreventionPlan(title, existingKey, secteur);
                modal.remove();
                window.showToast("Plan de prévention ajouté !");
                window.renderAdminPreventionPlans();
            } catch(err) {
                alert("Erreur : " + err.message);
                saveBtn.disabled = false;
                saveBtn.innerText = "Ajouter";
            }
        } else {
            if (!fileInput.files[0]) return alert("Veuillez sélectionner un fichier PDF.");
            saveBtn.disabled = true;
            saveBtn.innerText = "Upload...";
            try {
                const key = `Plan de prévention/${Date.now()}_${fileInput.files[0].name}`;
                await api.uploadFile(fileInput.files[0], key);
                await api.savePreventionPlan(title, key, secteur);
                modal.remove();
                window.showToast("Plan de prévention ajouté !");
                window.renderAdminPreventionPlans();
            } catch(err) {
                alert("Erreur lors de l'upload : " + err.message);
                saveBtn.disabled = false;
                saveBtn.innerText = "Ajouter";
            }
        }
    };
};

window.toggleSubcontractorGroup = function(groupId) {
    const rows = document.querySelectorAll(`.${groupId}`);
    const arrow = document.getElementById(`arrow-${groupId}`);
    rows.forEach(r => {
        if (r.style.display === 'none') {
            r.style.display = 'table-row';
        } else {
            r.style.display = 'none';
        }
    });
    if (arrow) {
        if (arrow.style.transform === 'rotate(90deg)') {
            arrow.style.transform = 'rotate(0deg)';
        } else {
            arrow.style.transform = 'rotate(90deg)';
        }
    }
};

