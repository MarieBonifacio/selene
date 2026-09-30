# Selene sous Android

Une coquille [Capacitor](https://capacitorjs.com) autour de la page native (`dist/native/index.html`, ADR 14) : la même
Selene, avec ce qu'un téléphone offre en plus.

## Ce que l'app ajoute à la PWA

- **Des données hors d'atteinte du navigateur.** Un fichier par clé dans le dossier privé de l'app, sans le plafond
  de `localStorage` ni l'éviction d'une WebView ; chaque écriture passe par un fichier temporaire renommé ensuite,
  pour qu'une coupure n'en laisse jamais un à moitié écrit.
- **Les secrets dans le Keystore.** Session, clés OpenAlex et Zotero, adresse d'agenda : chiffrés (AES-GCM) par une
  clé que garde l'Android Keystore (plugin `@aparajita/capacitor-secure-storage`, lu avant adoption : aucun appel
  réseau, des préférences privées à l'app). La clé Anthropic, elle, reste au serveur (docs/assistant.md).
- **« Partager » → Selene.** Un lien ou un texte partagé depuis n'importe quelle app arrive dans la boîte de
  réception, par le même chemin que le partage de la PWA (`?title=&text=`).
- **Le bouton retour** remonte l'historique de Selene ; au bout, il ferme l'app.
- **La mise en arrière-plan** pousse ce qui attend (comme la fermeture d'un onglet).

Le code propre à Android tient en trois fichiers : `src/native/boot.js` (les coffres, le bouton retour),
`native/android/app/src/main/java/.../MainActivity.java` (le partage) et le filtre `SEND` de l'`AndroidManifest.xml`.

## Installer (usage personnel)

1. Onglet *Actions* du dépôt → *Android* → la dernière exécution verte → artefact **selene-android-debug** (un zip
   contenant `app-debug.apk`). Chaque PR qui touche `src/`, `native/` ou le build en produit un.
2. Sur le téléphone : ouvrir l'APK, autoriser l'installation depuis cette source, installer.

C'est un APK **de débogage**, signé par une clé jetable : Android refusera de le mettre à jour par-dessus une version
signée autrement (désinstaller d'abord ; les données locales partent avec l'app, celles du compte restent sur le
serveur). La signature de publication et le Play Store viennent avec la phase de publication (phase 14).

## Construire soi-même

Il faut Node 22, Java 21 et le SDK Android (Android Studio l'installe).
```sh
npm ci
npm run build:dist          # dist/native, la page de l'app
npx cap sync android        # la copie dans native/android, avec les plugins
cd native/android && ./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```
`npx cap open android` ouvre le projet dans Android Studio.

## Connexions

L'app a pour origine `https://localhost`. Les fonctions Supabase (passeur, assistant) l'acceptent par défaut, avec
`capacitor://localhost` pour iOS ; les autres services (Crossref, MusicBrainz…) répondent à toute origine.

## Tester

`tests/native-boot.test.js` éprouve l'amorçage avec de faux plugins (fichiers, écriture interrompue, secrets
préfixés, bouton retour, mise en pause) ; `tests/browser/natif.js` fait tourner la page native sur des coffres
simulés derrière un pont asynchrone ; le workflow *Android* compile l'APK à chaque PR concernée. L'essai sur un vrai
téléphone reste à faire à la main : lancement à froid, hors ligne puis en ligne, partage depuis Chrome, bouton retour,
rotation, clavier, synchronisation avec la PWA.
