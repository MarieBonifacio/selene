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
- **Une fenêtre à elle**, hors du navigateur, et **une seule** : relancer Selene, ou cliquer un lien `selene://`,
  ramène la fenêtre existante.
- **`Ctrl+Alt+S`, de n'importe où** : la fenêtre revient et la capture s'ouvre. Si une autre app a déjà pris ce
  raccourci, Selene démarre quand même, sans lui.
- **La zone de notification** : une icône et son menu (Capturer, Ouvrir Selene, Quitter). Fermer la fenêtre l'y
  range, pour que le raccourci reste actif ; *Quitter* pousse d'abord ce qui attend. Le menu parle la langue du système
  (anglais ou français ; le français sinon) : il existe avant la page, et ne peut pas lui demander la sienne. Sous
  Windows, `GetUserDefaultUILanguage` (kernel32, appelée directement, sans crate) ; ailleurs, `LC_ALL`, `LC_MESSAGES`,
  `LANG`.
- **Les liens `selene://`** : `selene://capture` ouvre la capture ; `selene://share?url=…&title=…&text=…` dépose un
  lien dans la boîte de réception, comme le partage d'Android ou de la PWA (même quand le lien lance l'app).
- **Le glisser-déposer** est laissé à la page (Tauri ne l'intercepte pas).

## Installer (Windows)

Versions publiées : l'installateur de chaque Release GitHub (docs/publication.md), signé si un certificat est fourni.

1. Onglet *Actions* du dépôt → *Desktop* → la dernière exécution verte → artefact **selene-windows** (un zip contenant
   `Selene_…_x64-setup.exe`).
2. Lancer l'installateur, en français ou en anglais selon la langue de Windows (le français sinon, comme le menu). Il
   n'est pas encore signé : Windows (SmartScreen) avertira d'un « éditeur inconnu » ;
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
(`cargo test`) vérifient l'encodage des noms de fichiers ; le workflow *Desktop* compile et teste sous Windows, produit
l'installateur, puis l'installe et le lance (`scripts/windows-fumee.mjs`, BL-08 du cahier de recette) : écran
d'entrée, une note capturée sans compte et relue après l'app tuée puis relancée, une seule instance. Restent à faire à
la main : la déconnexion (les secrets quittent le Gestionnaire d'identification), la mise à jour par-dessus, le
raccourci global et la zone de notification.
