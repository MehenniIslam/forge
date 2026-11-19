# Forge – sèche, muscu & calisthénie (PWA iPhone, 100 % hors ligne)

App web installable sur l'écran d'accueil de l'iPhone. Aucune inscription, aucun serveur, aucun abonnement : **toutes les données restent sur le téléphone** (IndexedDB).

## Contenu du dossier

| Fichier / dossier | Rôle |
|---|---|
| `index.html` | La page de l'app (balises Apple, barre d'onglets, minuteur) |
| `css/style.css` | Le style sombre, gros boutons, encoche et barre du bas gérées |
| `js/app.js` | Démarrage, navigation entre les onglets, mode hors ligne |
| `js/calc.js` | **Tous les calculs** (calories, plan, tractions, progression, import Santé) |
| `js/data.js` | Données de départ : profil, aliments, programme, idées de repas, skills |
| `js/db.js` | Stockage local (IndexedDB), sauvegarde / restauration JSON |
| `js/views/*.js` | Un fichier par écran (accueil, nutrition, séance, calis, progrès, réglages, aide, import Santé) |
| `sw.js` | Service worker : garde l'app en cache pour le hors ligne (**numéro de version à changer à chaque mise à jour**) |
| `manifest.webmanifest`, `icons/` | Nom, couleurs et icônes de l'app installée |
| `GUIDE-RACCOURCI.md` | Guide pas à pas du raccourci Apple Santé (aussi affiché dans l'app) |
| `tests/` | Tests automatiques des calculs (`node --test tests/`) |
| `tools/` | Petit serveur local et générateur d'icônes (facultatifs) |

## 1. Tester l'app sur le Mac

Ouvrir `index.html` en double-cliquant **ne marche pas** (le navigateur bloque les modules et le mode hors ligne sur les fichiers locaux). Il faut un petit serveur :

1. Ouvre l'app **Terminal** (Cmd + Espace → tape « Terminal » → Entrée).
2. Tape `cd ` (avec un espace), **glisse le dossier de l'app** dans la fenêtre du Terminal, puis Entrée.
3. Tape `python3 -m http.server 8000` puis Entrée. (Si le Mac propose d'installer les « outils de développement en ligne de commande », accepte, attends la fin, puis relance la commande.)
4. Ouvre Safari ou Chrome à l'adresse **http://localhost:8000**.
5. Pour arrêter : reviens dans le Terminal et fais **Ctrl + C**.

Astuce : dans Chrome, clic droit → Inspecter → icône téléphone, pour voir l'app au format iPhone.

## 2. L'app en ligne (GitHub Pages)

L'app est publiée gratuitement sur **GitHub Pages** : **https://mehenniislam.github.io/forge/**

Le code est public, mais **il ne contient aucune donnée personnelle** : le profil est vide et se remplit sur le téléphone au premier lancement (écran de bienvenue). Ce que tu saisis dans l'app ne quitte jamais ton iPhone.

## 3. Installer l'app sur l'iPhone

1. Ouvre l'adresse ci-dessus dans **Safari** (obligatoirement Safari).
2. Bouton **Partager** (carré avec une flèche) → **« Sur l'écran d'accueil »** → **Ajouter**.
3. Ouvre l'app **depuis l'icône** (pas depuis Safari : les deux ont des données séparées).
4. Remplis l'écran de bienvenue (sexe, âge, taille, poids, date de début, max de tractions, option halal, aliments à exclure).
5. Ouvre-la une fois avec Internet : elle se met en cache et marche ensuite en mode avion.
6. Réglages de l'app → vérifie « Stockage protégé », puis fais une première sauvegarde.
7. Suis ensuite le guide **Raccourci Santé** (Réglages → Aide).

## 4. Mettre à jour l'app plus tard sans perdre les données

Les données sont dans le téléphone, pas dans les fichiers : remplacer les fichiers ne les efface pas, **à condition de garder la même adresse**.

1. Par sécurité : dans l'app, **Réglages → Exporter mes données**.
2. Modifie les fichiers.
3. Ouvre `sw.js` et augmente le numéro de version : `const VERSION = 'v1.0.0';` → `'v1.0.1'`.
4. Envoie les fichiers sur GitHub, au choix :
   - depuis le dossier, dans un terminal : `git add -A`, puis `git commit -m "Mise à jour"`, puis `git push` ;
   - ou sur **github.com/MehenniIslam/forge** → **Add file → Upload files** → glisse les fichiers modifiés → **Commit changes**.
5. Attends 1 à 2 minutes (GitHub reconstruit le site), puis ouvre l'app sur l'iPhone avec Internet : un bandeau **« Nouvelle version installée »** apparaît → **Recharger**.

Ne supprime jamais l'icône de l'app : ça efface ses données. Si ça arrive, réinstalle-la et choisis **« J'ai déjà une sauvegarde »** sur l'écran de bienvenue (ou Réglages → Restaurer une sauvegarde).

## Tests

Avec Node.js installé : `node --test tests/` vérifie les calculs (métabolisme, objectifs, plan, programme tractions, double progression, ajustements, import Santé, option halal, suggestions sans aliments exclus).
