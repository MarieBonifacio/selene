# Selene sur ordinateur

Une coquille [Tauri 2](https://tauri.app) autour de la page native (`dist/native/index.html`, ADR 14) : la même Selene
dans la WebView du système (WebView2 sous Windows), avec un petit cœur Rust (`native/tauri/src/main.rs`).

## Ce que l'app ajoute

- **Des données dans un dossier à elle** (`%APPDATA%\io.github.mariebonifacio.selene\selene` sous Windows) : un fichier
  par clé, écrit par un fichier temporaire renommé (une coupure n'en laisse jamais un à moitié écrit), sans plafond
  de taille.
- **Les secrets dans le coffre du système** : le Gestionnaire d'identification de Windows (Trousseau sous macOS,
  Secret Service sous Linux), par la crate `keyring`. Seule la liste de leurs noms, qui n'est pas secrète, est gardée
  dans un fichier à côté. La clé Anthropic, elle, reste au serveur (docs/assistant.md).
- **Une fenêtre à elle**, hors du navigateur. Le raccourci global de capture, l'icône de la zone de notification et
  le glisser-déposer de fichiers viennent ensuite (phase 10).

## Installer (Windows)

1. Onglet *Actions* du dépôt → *Desktop* → la dernière exécution verte → artefact **selene-windows** (un zip contenant
   `Selene_…_x64-setup.exe`).
2. Lancer l'installateur. Il n'est pas encore signé : Windows (SmartScreen) avertira d'un « éditeur inconnu » ;
   *Informations complémentaires* → *Exécuter quand même*. La signature vient avec la publication (phase 14).

## Construire soi-même

Il faut Node 22, Rust (rustup) et, sous Windows, WebView2 (déjà présent sur Windows 10 et 11).
```sh
npm ci
npm run build:dist               # dist/native, la page de l'app
cd native/tauri
cargo test                       # le cœur Rust
npx tauri build                  # → target/release/bundle/nsis/Selene_…_x64-setup.exe
npx tauri dev                    # la fenêtre, sans installer
```

## Connexions

L'app a pour origine `http://tauri.localhost` sous Windows (`tauri://localhost` sous macOS et Linux) ; les fonctions
Supabase l'acceptent par défaut. La page parle au cœur Rust par le protocole `ipc:` (`http://ipc.localhost` sous
Windows), autorisé dans la CSP de la page native seulement.

## Tester

`tests/native-boot.test.js` vérifie que l'amorçage appelle les six commandes avec les bons arguments ; les tests Rust
(`cargo test`) vérifient l'encodage des noms de fichiers ; le workflow *Desktop* compile et teste sous Windows, puis
produit l'installateur. L'essai de la fenêtre elle-même reste à faire à la main : premier lancement, données relues
après fermeture, déconnexion (les secrets quittent le Gestionnaire d'identification), mise à jour par-dessus.
