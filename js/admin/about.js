import { api } from '../api.js';
import { auth } from '../auth.js';
import config from '../config.js';

window.renderAdminReports = async function () {
    setActiveNav('nav-reports');
    const content = document.getElementById('admin-content');
    content.innerHTML = `<div style="text-align:center; padding: 40px;"><div class="loader-spinner"></div></div>`;

    try {
        const reports = await api.getAdminReports();
        
        let html = `
        <header style="position: sticky; top: -32px; margin: -32px -40px 32px -40px; padding: 32px 40px 20px; background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: space-between;">
            <h1 style="margin: 0;">🐛 Bugs & Améliorations</h1>
            <button class="btn" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);" onclick="renderAdminReports()">🔄 Actualiser</button>
        </header>
        
        <div class="card glass-panel" style="margin-top: 20px; border-radius: 18px; padding: 24px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="overflow-x: auto;">
                <table class="admin-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Utilisateur</th>
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Secteur</th>
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Type</th>
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Description</th>
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Photo</th>
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Date</th>
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Statut</th>
                            <th style="padding: 12px; font-weight: 700; color: #8E8E93;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (reports.length === 0) {
            html += `<tr><td colspan="8" style="padding: 24px; text-align: center; color: #8E8E93;">Aucun signalement trouvé.</td></tr>`;
        } else {
            reports.forEach(r => {
                const userName = r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : 'Inconnu';
                const userSecteur = r.profiles ? (r.profiles.secteur || 'Tout') : 'Tout';
                const typeLabel = r.type === 'bug' ? '🐛 Bug' : '💡 Amélioration';
                const statusBadge = r.status === 'resolved' 
                    ? `<span class="badge" style="background: rgba(52, 199, 89, 0.15); color: #34C759; border: 1px solid rgba(52, 199, 89, 0.2);">Résolu</span>`
                    : `<span class="badge" style="background: rgba(255, 149, 0, 0.15); color: #FF9500; border: 1px solid rgba(255, 149, 0, 0.2);">En attente</span>`;
                
                const dateStr = new Date(r.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                
                const photoCell = r.image_path 
                    ? `<img src="${config.api.workerUrl}/get/${r.image_path}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);" onclick="window.open('${config.api.workerUrl}/get/${r.image_path}', '_blank')">`
                    : `<span style="color:#636366;">Aucune</span>`;

                const isResolved = r.status === 'resolved';
                const actionBtn = isResolved
                    ? `<span style="color:#636366; font-size:13px;">Traité</span>`
                    : `<button class="btn-sm" style="background: #2da140; color: white;" onclick="window.resolveReport('${r.id}')">Ok</button>`;

                const deleteBtn = `<button class="btn-sm btn-delete" style="background: rgba(255, 59, 48, 0.1); color: #FF3B30; border: 1px solid rgba(255, 59, 48, 0.2); margin-left: 6px;" onclick="window.deleteReport('${r.id}')">🗑️</button>`;

                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle;">
                        <td style="padding: 12px; font-weight: 600; color: white;">${window.escapeHTML(userName)}</td>
                        <td style="padding: 12px; color: #8E8E93;"><span class="badge" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);">${window.escapeHTML(userSecteur)}</span></td>
                        <td style="padding: 12px; font-weight: 600; color: white;">${typeLabel}</td>
                        <td style="padding: 12px; max-width: 300px; white-space: pre-wrap; color: rgba(255,255,255,0.9); font-size: 13px;">${window.escapeHTML(r.message)}</td>
                        <td style="padding: 12px;">${photoCell}</td>
                        <td style="padding: 12px; color: #8E8E93; font-size: 13px;">${dateStr}</td>
                        <td style="padding: 12px;">${statusBadge}</td>
                        <td style="padding: 12px;">${actionBtn}${deleteBtn}</td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        </div>
        `;

        content.innerHTML = html;

        window.resolveReport = async (id) => {
            if (!confirm("Voulez-vous marquer ce rapport comme résolu et envoyer une notification de remerciement à l'utilisateur ?")) return;
            try {
                await api.updateReportStatus(id, 'resolved');
                window.updateReportsBadge();
                renderAdminReports();
            } catch (e) {
                alert("Erreur: " + e.message);
            }
        };

        window.deleteReport = async (id) => {
            if (!confirm("Voulez-vous supprimer définitivement ce rapport ?")) return;
            try {
                await api.deleteReport(id);
                window.updateReportsBadge();
                renderAdminReports();
            } catch (e) {
                alert("Erreur: " + e.message);
            }
        };

    } catch (e) {
        content.innerHTML = `<div style="color:#FF3B30; padding:20px;">Erreur lors du chargement des rapports : ${e.message}</div>`;
    }
};

// Global scope for admin functions
window.renderAdminAbout = async function () {
    window.adminCurrentFolder = null;
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
                            📞 <a href="tel:0651654001" style="color: #69db7c; text-decoration: none; font-weight: bold;">06 51 65 40 01</a>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;
};
