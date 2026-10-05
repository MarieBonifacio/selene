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
- **Les exports** (sauvegarde, Markdown, dossier, planche, BibTeX) ouvrent la feuille de partage d'iOS :
  « Enregistrer dans Fichiers », AirDrop, Mail (ADR 31).
- **« Ma position »** pour le ciel de l'accueil : iOS demande l'accord avec la phrase de `Info.plist`
  (`NSLocationWhenInUseUsageDescription`, traduite dans `en.lproj` et `fr.lproj`), « pendant l'utilisation » seulement ;
  Selene arrondit aussitôt la position à un dixième de degré.
- **Sa langue** : l'app déclare le français et l'anglais (`CFBundleLocalizations`, `Info.plist`). WebKit ne donne à
  la page que des langues que l'app déclare : sans elles, un iPhone en français pouvait recevoir l'anglais, la langue de
  développement. iOS les propose aussi dans Réglages → Selene → Langue, pour Selene seule ; un iPhone dans une
  troisième langue peut recevoir l'anglais (la langue de développement) plutôt que le français de repli des autres
  plateformes. Le réglage de langue du compte, s'il est choisi, passe avant (docs/i18n.md).

## Confidentialité pour l'App Store

`App/PrivacyInfo.xcprivacy`, le manifeste de confidentialité qu'Apple exige depuis mai 2024, voyage dans l'app (la CI
le vérifie après la compilation). Il déclare :
- **Une API à justifier** : les dates des fichiers (`NSPrivacyAccessedAPICategoryFileTimestamp`, raison `C617.1`),
  lues par `@capacitor/filesystem` quand l'amorçage relit ses fichiers, dans le dossier privé de l'app. Ce plugin et
  sa bibliothèque n'ont pas de manifeste à eux ; celui de Capacitor ne déclare rien. Sans cette ligne, App Store
  Connect refuse l'envoi (ITMS-91053).
- **Les données qui quittent l'appareil**, avec un compte seulement : l'adresse, le contenu des espaces, le lieu du
  ciel (arrondi à un dixième de degré), le jour de saisie de la mesure d'usage, le journal des erreurs (non lié au
  compte) et la clé de l'assistant. Aucun pistage. La fiche « Confidentialité de l'app » d'App Store Connect en
  reprend les réponses ([publication.md](publication.md#ios--app-store), étape 7).

Un plugin ajouté, une donnée de plus envoyée : le manifeste se relit le même jour, avec la politique.

## « Partager → Selene » par un Raccourci

En attendant une extension de partage native (qui demande un App Group, donc un compte Apple Developer), un Raccourci
iOS suffit :
1. App *Raccourcis* → nouveau raccourci → *Afficher dans la feuille de partage* (types : URL, texte).
2. Action *Ouvrir les URL* avec l'adresse `selene://share?url=` suivie de la variable *Entrée du raccourci* (encodée
   par l'action *Encoder l'URL*).
3. Nommer le raccourci « Selene ». Il apparaît dans *Partager* de Safari et des autres apps.

## Installer

Versions publiées, signées : voir docs/publication.md (une étiquette `v1.2.3` suffit une fois les clés en place).

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
avec les autres appareils, et un export (Réglages → Sauvegarde → Exporter : la feuille de partage, puis « Enregistrer
dans Fichiers »).
