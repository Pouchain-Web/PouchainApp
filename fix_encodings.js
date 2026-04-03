const fs = require('fs');
let content = fs.readFileSync('worker.js', 'utf8');

// The original badly encoded text is technically correctly utf-8 encoded mojibake here
// We can just use the literal strings provided by view_file outputs

content = content.replace("ðŸ“… Nouvelle tÃ¢che :", "📅 Nouvelle tâche :");
content = content.replace("ConfirmÃ©e âœ…", "Confirmée ✅");
content = content.replace("CommandÃ©e ðŸ“¦", "Commandée 📦");
content = content.replace("RefusÃ©e âœ•", "Refusée ❌");
content = content.replace("ReÃ§ue ðŸ‘ ", "Reçue 👍");

// For Matériel : we'll use a regex matching the exact prefix to replace the emoji securely
content = content.replace(/ðŸ›\\s?ï¸\\s+MatÃ©riel :/g, "🛠️ Matériel :");
// also handle the specific case seen in file:
content = content.replace("ðŸ› ï¸  MatÃ©riel :", "🛠️ Matériel :");

content = content.replace("ðŸš¨ Nouvelle demande :", "🚨 Nouvelle demande :");
content = content.replace("ðŸš— Rappel : Veuillez mettre Ã  jour le kilomÃ©trage de votre vÃ©hicule", "🚗 Rappel : Veuillez mettre à jour le kilométrage de votre véhicule");
content = content.replace("â ³ Ã‰chÃ©ance vÃ©hicule", "⏳ Échéance véhicule");
content = content.replace("'VÃ©hicule'", "'Véhicule'");
content = content.replace("Ã‰chÃ©ances ContrÃ´le Technique", "Échéances Contrôle Technique");
content = content.replace("Aucun abonnÃ© trouvÃ©", "Aucun abonné trouvé");
content = content.replace("Notification(s) envoyÃ©e(s) avec succÃ¨s.", "Notification(s) envoyée(s) avec succès.");

fs.writeFileSync('worker.js', content, 'utf8');
console.log('Fixed worker.js encodings');
