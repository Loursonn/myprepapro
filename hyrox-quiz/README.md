# Déploiement — 15 minutes

## 1. Personnaliser (`index.html`, bloc `CONFIG` en haut du script)
- `WHATSAPP` : ton numéro au format `33612345678`
- `SHEET_WEBHOOK` : URL de l'étape 2 (vide pour tester sans). Fichier : `test/index.html`. Le numéro WhatsApp est aussi dans `index.html` (bouton final).
- Ligne `og:image` : remplace `TON-DOMAINE.fr` par ton domaine (l'image `og.jpg` est fournie)
- **Pavot** : dépose `pavot.woff2` dans `/assets`. Sans le fichier, Instrument Serif prend le relais.

## 2. Leads → Google Sheets (gratuit)
1. Google Sheet vide → `Extensions` → `Apps Script`, colle :
```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const d = e.parameter;
  const keys = Object.keys(d);
  if (sheet.getLastRow() === 0) sheet.appendRow(keys);
  sheet.appendRow(keys.map(k => d[k]));
  return ContentService.createTextOutput("ok");
}
```
2. `Déployer` → `Nouveau déploiement` → **Application Web** → Exécuter : **Moi** → Accès : **Tout le monde**
3. Copie l'URL `/exec` dans `SHEET_WEBHOOK`

Une ligne par quiz terminé (dès l'affichage de la note) : date, prénom, tel, réponses, scores, profil.

## 3. Vercel
`Add New` → `Project` → glisse-dépose le dossier `hyrox-quiz` entier (`index.html` = site, `test/` = quiz, `assets/`, `og.jpg`) → Framework `Other` → Deploy.
`Settings` → `Domains` → `quiz.hugoyoxx.fr` (ou ton domaine).

## 4. Embed sur ton site (si tu en as un)
```html
<iframe src="https://quiz.hugoyoxx.fr" style="width:100%;height:760px;border:0;border-radius:18px" title="Test niveau Hyrox"></iframe>
```
Sinon l'URL seule en bio Insta suffit — c'est exactement ce que fait le site que tu m'as montré.

## 5. Tester
5 parcours pour voir les 5 profils (Sprint final = délai « <4 » ou « 4-8 semaines »). Vérifie la ligne dans le Sheet et le message WhatsApp pré-rempli.

## Modifier
Questions dans `Q` (le chiffre après chaque réponse = points), textes de résultat dans `PROFILES`.
