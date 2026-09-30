# Selene sous iOS

La même coquille Capacitor que sous Android (docs/android.md), autour de la même page native : un projet Xcode dans
`native/ios`, dont les plugins arrivent par Swift Package Manager.

## Ce que l'app ajoute

- **Des données hors de Safari** : un fichier par clé dans le dossier privé de l'app (écriture par fichier
  temporaire renommé). Contrairement au `localStorage` d'une WebView ou d'une PWA, iOS ne les évince pas quand
  l'espace manque.
- **Les secrets dans le Trousseau** (même plugin qu'Android : `@aparajita/capacitor-secure-storage`).
- **Les liens `selene://`** : `selene://share?url=…&title=…&text=…` dépose un lien dans la boîte de réception,
  `selene://capture` ouvre la capture, que l'app tourne ou que le lien la lance.
- La mise en arrière-plan pousse ce qui attend.
- **Le résumé du matin** (Réglages → Notifications) : programmé par iOS pour la semaine qui vient, il sonne app fermée.
  iOS garde au plus 64 notifications en attente par app ; Selene en programme sept.
- **Un léger retour haptique** à la capture.

## « Partager → Selene » par un Raccourci

En attendant une extension de partage native (qui demande un App Group, donc un compte Apple Developer), un Raccourci
iOS suffit :
1. App *Raccourcis* → nouveau raccourci → *Afficher dans la feuille de partage* (types : URL, texte).
2. Action *Ouvrir les URL* avec l'adresse `selene://share?url=` suivie de la variable *Entrée du raccourci* (encodée
   par l'action *Encoder l'URL*).
3. Nommer le raccourci « Selene ». Il apparaît dans *Partager* de Safari et des autres apps.

## Installer

Installer une app sur un iPhone demande de la signer : un compte Apple Developer (99 $ par an), puis TestFlight, ou
Xcode et un iPhone branché (profil de développement). C'est la phase de publication (phase 14). En attendant, le
workflow *iOS* prouve que le projet se compile (simulateur, sans signature).

## Construire soi-même (sur un Mac)

Il faut Node 22 et Xcode.
```sh
npm ci
npm run build:dist          # dist/native, la page de l'app
npx cap sync ios            # la copie dans native/ios, avec les plugins
npx cap open ios            # Xcode : choisir un simulateur ou un iPhone, puis Run
```

## Connexions

L'app a pour origine `capacitor://localhost` ; les fonctions Supabase l'acceptent par défaut.

## Tester

`tests/native-boot.test.js` éprouve l'amorçage (dont les liens `selene://`, au lancement et en cours de route) ; le
workflow *iOS* compile le projet sur un Mac de GitHub. L'essai sur un vrai iPhone reste à faire à la main : lancement
à froid, hors ligne puis en ligne, Raccourci de partage, rotation, clavier, encoches (safe areas), synchronisation
avec les autres appareils.
