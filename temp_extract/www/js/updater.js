
/**
 * PouchainApp - Système de Mise à Jour Automatique (In-App)
 * Détecte les versions native (APK) et live (Bundle R2).
 */

const UPDATER_CONFIG = {
    checkUrl: "https://pouchain-worker.pouchainapp.workers.dev/update/check"
};

class AppUpdater {
    constructor() {
        this.isUpdateInProgress = false;
        this.currentVersion = "0.0.0";
    }

    async init() {
        // 1. Détecter la version (Priorité: LocalStorage > Plugin Stats > APK Info)
        await this.detectCurrentVersion();

        // 2. Vérification Cloudflare
        const updateFound = await this.checkForUpdate();
        
        // 3. Signal au plugin que l'app a démarré avec succès
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
            try {
                await window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
            } catch (e) { }
        }

        this.syncVersionDisplay();
        return updateFound;
    }

    /**
     * Détermine la version actuelle sur le téléphone avec fallback LocalStorage
     */
    async detectCurrentVersion() {
        // FALLBACK 1 : On regarde si on a noté une version après une MAJ réussie
        const savedVersion = localStorage.getItem('pouchain_last_version');
        if (savedVersion) {
            this.currentVersion = savedVersion;
        }

        // FALLBACK 2 : On demande au plugin sa version réelle de Bundle
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
            try {
                const stats = await window.Capacitor.Plugins.CapacitorUpdater.getStats();
                if (stats.currentBundle && stats.currentBundle.version) {
                    this.currentVersion = stats.currentBundle.version;
                    // On resynchronise le localStorage pour la prochaine fois
                    localStorage.setItem('pouchain_last_version', this.currentVersion);
                }
            } catch (e) { }
        }

        // FALLBACK 3 : Si toujours pas de version (premier lancement), on demande à l'APK
        if (this.currentVersion === "0.0.0" || this.currentVersion === "1.0") {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                try {
                    const info = await window.Capacitor.Plugins.App.getInfo();
                    this.currentVersion = info.version;
                } catch (e) { }
            }
        }
    }

    syncVersionDisplay() {
        const elements = document.querySelectorAll('.app-version-display');
        elements.forEach(el => {
            el.innerText = `v${this.currentVersion}`;
        });
    }

    async checkForUpdate() {
        try {
            const checkUrl = `${UPDATER_CONFIG.checkUrl}?current_version=${this.currentVersion}&t=${Date.now()}`;
            console.log("[Updater] Checking for version:", this.currentVersion);

            const response = await fetch(checkUrl);
            if (!response.ok) return false;
            
            const data = await response.json();

            // SÉCURITÉ : Si le serveur dit qu'on est déjà sur cette version, on stoppe
            if (data.newVersion === this.currentVersion) {
                return false;
            }

            if (data.updateAvailable && data.url) {
                this.isUpdateInProgress = true; 
                this.showUpdateModal(data.newVersion, data.url);
                return true;
            }
            return false;
        } catch (err) {
            console.error("[Updater] Network error during check:", err);
            return false;
        }
    }

    isUpdating() {
        return this.isUpdateInProgress;
    }

    showUpdateModal(newVersion, downloadUrl) {
        const existing = document.getElementById('update-modal-overlay');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="update-modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); z-index: 100000; display: flex; align-items: center; justify-content: center; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; box-sizing: border-box;">
                <div style="background: white; border-radius: 20px; padding: 35px 25px; width: 100%; max-width: 380px; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.4);">
                    <div style="font-size: 60px; margin-bottom: 20px;">🚀</div>
                    <h2 style="margin: 0 0 12px 0; color: #1c1c1e; font-size: 22px; font-weight: 800;">Mise à jour requise</h2>
                    <p style="margin: 0 0 25px 0; color: #666; font-size: 15px; line-height: 1.5;">Installation de la version <strong>v${newVersion}</strong> en cours...</p>
                    <div id="update-progress-container" style="margin-top: 10px;">
                        <div style="background: #f2f2f7; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 12px;">
                            <div id="update-progress-bar" style="background: #2da140; width: 0%; height: 100%; transition: width 0.2s linear;"></div>
                        </div>
                        <p style="margin: 0; font-size: 14px; color: #1c1c1e; font-weight: 600;">Téléchargement : <span id="update-progress-percent">0</span>%</p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.startUpdate(newVersion, downloadUrl);
    }

    async startUpdate(newVersion, downloadUrl) {
        const { CapacitorUpdater } = window.Capacitor.Plugins;
        try {
            const progressBar = document.getElementById('update-progress-bar');
            const progressPercent = document.getElementById('update-progress-percent');
            
            const listener = await CapacitorUpdater.addListener('downloadJSProgress', (data) => {
                const percent = Math.round(data.percent);
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressPercent) progressPercent.innerText = percent;
            });

            // Téléchargement
            const bundle = await CapacitorUpdater.download({ url: downloadUrl, version: newVersion });
            
            // IMPORTANT : On note la version EN AVANCE pour briser la boucle au redémarrage
            localStorage.setItem('pouchain_last_version', newVersion);
            
            // Installation et Redémarrage
            await CapacitorUpdater.set(bundle);
        } catch (err) {
            console.error("[Updater] Update failed:", err);
            alert("Échec de la mise à jour : " + err.message);
        }
    }
}

export const updater = new AppUpdater();
