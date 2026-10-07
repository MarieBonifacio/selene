# Inventaire des tests automatiques

Ce que les tests de Selene vérifient réellement, lu dans le corps de chaque test et non dans son seul nom ; ce qu'ils
simulent ; où et quand ils tournent ; ce qu'ils ne prouvent pas. État au commit `cab3ec8` (6 octobre 2026 ; rédigé sur `768eb34`, complété à chaque PR des tests ajoutés ou modifiés depuis). Les
automatisations seulement proposées sont dans [backlog.md](backlog.md), jamais ici.

Identifiants retirés : aucun.

## En bref

| Suite | Commande | Contenu | En CI | Exécution du 4 octobre 2026 (conteneur Linux, Node 22, Playwright 1.56.1) |
|---|---|---|---|---|
| Tests unitaires et d'intégration Node | `npm test` | 325 tests, 32 fichiers `tests/*.test.js` | oui : *Check › build-and-test*, à chaque PR et avant chaque déploiement | **268 réussis** sur `768eb34` (12,4 s) ; **277 réussis** sur `1ca8c4f` fusionné ; 0 échec, 0 ignoré |
| Scénarios de navigateur | `npm run test:browser` | 81 scénarios `tests/browser/*.js` (73 au commit `768eb34`, environ 1 034 appels de vérification dans le code à cette date) | oui : *Check › browser*, Chromium, WebKit et Firefox (non bloquant jusqu'au 20 octobre 2026), plus Chromium au démarrage lent et au processeur ralenti | Chromium : **73 verts, 1 067 vérifications** sur `768eb34`, **1 071** sur `1ca8c4f` fusionné ; WebKit : non exécuté (navigateur absent) |
| Fonctions serveur (Deno) | `npm run test:functions` | 16 tests, 4 fichiers, plus le typage | oui : *Check › passeur* ; et avant chaque déploiement de fonction | **16 réussis**, typage vert |
| Cœur Rust de l'app Windows | `cargo test --locked` dans `native/tauri` | 3 tests | oui : *Desktop* (Windows), si la PR touche `src/` ou `native/tauri/` | **non exécuté** (`webkit2gtk-4.1` absent) ; vert en CI sur `768eb34` |
| Contrôles statiques | `build:check`, `test:syntax`, `lint`, `i18n` | voir `TS-*` | oui : *Check › build-and-test* | **tous verts** ; 1 696 textes traduits sur 1 696 |
| Compilations natives | *Android*, *iOS*, *Desktop* | APK, simulateur, installateur | oui, filtrées par chemins | non exécutées ici ; **vertes** sur `main` `768eb34` |
| Cohérence du cahier de recette | `npm run recette` | identifiants, lien cas ↔ tests, présence de chaque test dans l'inventaire, totaux annoncés, matrice et son décompte, liens, jeux de données | oui : *Check › recette*, sur les PR | **vert** (`TS-RECETTE`) |
| Outils hors CI | `isolation`, `liens`, `screenshots` | préproduction, liens mensuels, captures | non, ou planifié | le `bench` est en CI depuis le 6 octobre 2026, avec un seuil (`TS-BENCH`) |

Aucun test n'est désactivé, ignoré ou réduit à un seul cas (`skip`, `only`, `todo` : aucun). Chaque test unitaire
contient au moins une assertion (six tests de `sync.test.js` passent par l'assistant `same()`, qui appelle
`assert.deepEqual`) ; chaque scénario de navigateur en contient au moins trois.

## Comment un échec fait échouer

- **`node --test`** : une assertion qui échoue lève une exception, le test échoue, la commande sort en erreur et la CI
  s'arrête.
- **Scénarios de navigateur** (runner maison, `tests/browser/run.js` et `helpers.js`) : `check(condition, message)`
  affiche ✓ ou ✗ et, sur ✗, met le code de sortie du scénario à 1 ; une promesse rejetée non rattrapée (`unhandledRejection`)
  aussi ; une exception non rattrapée termine le scénario en erreur ; un scénario de plus de 3 minutes est tué et compte
  comme un échec. `run.js` les lance six à la fois et sort en 1 si un seul a échoué. Points d'attention : un scénario
  sans aucun `check` passerait (vérifié : aucun) ; un `check` dans une boucle compte une fois par tour ; la vérification
  finale « aucune erreur JavaScript » de presque chaque scénario rattrape toute erreur de la page (`pageerror`), y compris
  une requête interrompue, ce qui explique l'instabilité A1. En CI, `run.js` écrit aussi les scénarios en échec et leurs
  contrôles dans le résumé du job.
- **Attendre un état, jamais un délai** : un scénario ouvre ou recharge l'app par `ouvrir()` de `helpers.js`, qui attend
  son premier rendu (`demarree`) ou, connecté, l'app elle-même (`entree`) : sur le web, elle ne démarre qu'une fois
  IndexedDB ouverte, après l'événement `load` où `goto` rend la main (A16). `SELENE_LENT=<ms>` fait répondre la base de
  l'app avec ce retard : un scénario qui compte sur un délai y échoue à coup sûr. La CI rejoue toute la suite ainsi, à
  1 500 ms (*Check › browser (chromium, démarrage lent)*). `SELENE_CPU=<facteur>` ralentit le processeur de Chromium
  (protocole DevTools), contre les délais fixes qui suivent un geste ; la CI la rejoue à ×4, quatre scénarios à la fois
  (*Check › browser (chromium, processeur ralenti)*, [BL-22](backlog.md#bl-22)).
- **Un faux Supabase fidèle** : `fauxSupabase(ctx, autre)` de `helpers.js` répond comme PostgREST pour `app_state` (une
  ligne par compte, lecture filtrée, création, écriture conditionnelle), sur le modèle de `fakeSupabase` des tests Node ;
  `autre` sert ce qui est propre au scénario (le passeur, une fonction). Un scénario « connecté » l'est donc vraiment :
  son branchement réussit, l'app ne le retente pas en fond (A31), et `synchro(p)` (l'indicateur `#saving`) est vide.
  Dix-huit scénarios s'en servent ([BL-23](backlog.md#bl-23)) ; les autres tiennent leur propre table de lignes, aussi
  fidèle (`sync-deux-appareils.js`, `hors-ligne-reel.js`, `regulation*.js`, `secours.js`, `sauvegarde-complete.js`,
  `sans-compte.js`, `sources.js`), ou ne se connectent pas.
- **Le jeu d'essai du cahier** : `donnee(nom)` de `helpers.js` lit un jeu de `docs/recette/donnees/` tel quel. `budget.js`,
  `quotidien.js`, `liaisons.js` et `recherche-minuteur.js` y vérifient ce que MOD-005, MOD-007, MOD-009, DON-010, PEN-003,
  PEN-004, PEN-005, MOD-012 et NAV-004 attendent de lui, chiffres et textes compris ;
  `sauvegarde-complete.js` en importe les fichiers.
- **`deno test`** : assertion levée ; **`deno check`** : erreur de typage.
- **`cargo test`** : `assert!` ou `assert_eq!` en échec.
- **`build.py --check`** : sort en erreur si un HTML généré ne correspond plus aux sources.
- **`eslint`** : toute règle en erreur. **`npm run i18n`** : code 1 si un texte marqué n'a pas sa traduction ou si une
  traduction est orpheline.
- **`npm run liens`** : code 1 seulement pour une page disparue (404, 410, domaine inconnu) ; un refus (401, 403, 429,
  5xx, délai) n'est qu'une annotation, sans échec.
- **`npm run isolation`** : 0 (étanche), 1 (fuite), 2 (impossible de conclure).

## Niveaux, et ce qui est simulé

| Code | Niveau | Ce qui tourne vraiment | Ce qui est simulé |
|---|---|---|---|
| U | Unitaire | un module pur du noyau (`src/core`), importé tel quel | les entrées |
| S | Statique | lecture du code ou des fichiers produits par le build | rien n'est exécuté |
| I-A | Intégration simulée, artefact | le script entier de `selene.html` | navigateur : faux DOM qui garde des chaînes `innerHTML`, stockage en mémoire ; aucun rendu ni événement réel, les actions sont appelées directement |
| I-H | Intégration simulée, hébergé | le script entier de `index.html` | même faux DOM ; un faux PostgREST en mémoire (`tests/hosted-harness.js`), partagé entre plusieurs « appareils » |
| I-P, I-N | Plateforme, amorçage natif | `src/platform.js`, `src/native/boot.js` | stockages, IndexedDB, coffres, plugins Capacitor et commandes Tauri factices |
| C | Contrat | une fonction serveur (Deno) ou un script | faux Supabase Auth, PostgREST, Anthropic, réseau et DNS |
| N | Navigateur réel (Playwright) | la vraie page dans Chromium, WebKit ou Firefox : rendu, focus, clavier, stockage, service worker | selon le mode : **A** `index.html` avec un `window.claude` factice (l'app se croit dans l'artefact : stockage localStorage, ni compte ni synchronisation) ; **H** version hébergée, faux Supabase par interception réseau ; **N** coquille native simulée ; **P** page publique |

Jamais réels, dans aucun test : le projet Supabase (Auth, PostgREST, RLS, fonctions déployées), Anthropic, les services
externes (Crossref, Microlink, MusicBrainz, Open-Meteo, OpenAgenda, OpenAlex, Zotero), claude.ai, un appareil Android, iOS
ou Windows. (Firefox l'est depuis le 6 octobre 2026, dans *Check › browser*.)

## La CI

| Workflow | Déclencheurs | Ce qu'il lance | Environnement |
|---|---|---|---|
| *Check* (`check.yml`) | toute PR ; à la demande ; appelé par *Pages* | job `build-and-test` : `npm ci`, `build:check`, `test`, `test:syntax`, `lint`, `i18n`, `bench` (seuil de 150 ms, `TS-BENCH`) (10 min) ; job `passeur` : `test:functions` (10 min) ; job `recette` : `npm run recette` (5 min ; sans `npm ci`, sur les PR seulement, jamais quand *Pages* appelle *Check*) ; job `browser` : `build:check` puis `test:browser`, matrice Chromium, WebKit, Firefox, Chromium au démarrage lent (`SELENE_LENT=1500` : la base de l'app répond avec 1,5 s de retard, contre les délais fixes après l'ouverture, A16) et Chromium au processeur ralenti (`SELENE_CPU=4`, `SELENE_JOBS=4` : contre les délais fixes après un geste, BL-22), aucun n'interrompant les autres ; Firefox non bloquant jusqu'au 20 octobre 2026 ([BL-13](backlog.md#bl-13)), son échec signalé par un avertissement ([BL-17](backlog.md#bl-17)) ; les scénarios et contrôles en échec listés dans le résumé du job (15 min) | Ubuntu, Node de `.nvmrc` (22), navigateurs Playwright en cache selon `package-lock.json` |
| *Pages* (`pages.yml`) | push sur `main` ; à la demande | *Check* entier, puis seulement s'il est vert : `build:dist` et déploiement de `dist/web` | Ubuntu |
| *Android* (`android.yml`) | PR et push sur `main` touchant `src/`, `native/`, `capacitor.config.json`, `package*.json`, `build.py` | `build:dist`, `cap sync`, APK de débogage, puis version signée avec une clé jetable et `apksigner verify` | Ubuntu, Java 21 |
| *Android sur émulateur* (`android-fumee.yml`) | PR touchant `src/native/`, `src/platform.js`, `native/android/`, `capacitor.config.json`, `package*.json`, `build.py`, `scripts/bundle.mjs` ou le script ; push sur `main` touchant `src/` ou les mêmes ; à la demande | deux APK de débogage (édition complète, édition des stores), un émulateur Android 15 hors ligne, `node scripts/android-fumee.mjs` (`TS-ANDROID-FUMEE`) ; captures et journal en artefact | Ubuntu, KVM, Java 21 |
| *iOS* (`ios.yml`) | idem, chemins iOS | compilation pour le simulateur, sans signature | macOS, Xcode |
| *Desktop* (`desktop.yml`) | idem, chemins Tauri | `cargo test --locked`, puis installateur NSIS, puis la fumée de l'app installée (`TS-WIN-FUMEE`) ; captures en artefact | Windows |
| *Assistant*, *Compte*, *Passeur* | push sur `main` touchant leur fonction ou `_shared` ; à la demande | `test:functions` puis déploiement ; sautés avec un avis si les secrets manquent | Ubuntu |
| *Liens* (`liens.yml`) | le 3 de chaque mois à 6 h 17 UTC ; à la demande | `npm run liens` | Ubuntu |
| *Isolation* (`isolation.yml`) | le lundi à 4 h 41 UTC ; push sur `main` touchant `supabase/schema.sql`, le script ou le workflow ; à la demande | `npm run isolation` contre le projet de préproduction (`TS-ISOLATION`) ; sauté avec un avis tant que les six secrets `ISOLATION_*` manquent (jamais lancé au 6 octobre 2026) ; un échec rend le run rouge | Ubuntu, Node de `.nvmrc` |
| *Sauvegarde* (`sauvegarde.yml`) | le lundi à 3 h 23 UTC ; à la demande | `scripts/sauvegarde.sh` : la base vidée en lecture seule et chiffrée pour la clé publique age (`TS-SAUVEGARDE`) ; seule l'archive chiffrée est publiée en artefact, 30 jours ; sautée avec un avis tant que ses réglages manquent (jamais lancée au 6 octobre 2026) | Ubuntu, CLI Supabase |
| *Publication* (`release.yml`) | étiquette `v*` ; à la demande | APK et AAB signés, installateur Windows, archive iOS pour TestFlight ; chaque plateforme sautée sans ses secrets | Ubuntu, Windows, macOS |
| *Captures* (`screenshots.yml`) | à la demande | captures des stores | Ubuntu |

À savoir : *Check* n'a pas de déclencheur `push` (une branche sans PR n'est pas testée ; `main` l'est par *Pages*) ; les
compilations natives ne tournent pas sur une PR qui ne touche que la documentation ou les tests ; les déploiements de
fonctions ne rejouent leurs tests que si les secrets sont présents.

## Tests unitaires et d'intégration Node

Commande commune : `npm test` (tous) ou `node --test tests/<fichier>` (un fichier), après `npm ci` et `python3 build.py`
(les tests d'intégration lisent `selene.html` et `index.html`). En CI : *Check › build-and-test*. Environnement : Node 22,
sans navigateur.


### Mesure d'usage de la bêta — `tests/activite.test.js`

- **Niveau** : Intégration simulée (I-H). **Sujet** : `src/app/services/activite.js`, table `activite` de `supabase/schema.sql`.
- **Simulé** : Build hébergé (`index.html`) dans une VM Node, faux DOM, faux PostgREST (`hosted-harness.js`) ; le schéma SQL est lu comme du texte, pas exécuté.
- **Limites** : Le comportement de la table réelle (déclencheur, purge à 90 jours, RLS) n'est pas exécuté ici : la documentation dit l'avoir essayé une fois contre PostgreSQL 16 ([compte.md](../compte.md#mesure-dusage-bêta)).

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-act-01"></a>`TU-ACT-01` | activité : une saisie, un jour, avec la session ; rien de ce qui est écrit | Une note saisie envoie une seule ligne `{ jour }` (date du jour), avec le jeton de la session et la clé publique ; le texte saisi et l'adresse n'apparaissent nulle part ; une seconde saisie le même jour n'envoie rien. | [TRV-011](manuels/transverse.md#trv-011) |
| <a id="tu-act-02"></a>`TU-ACT-02` | activité : un réglage, un espace neuf et vide ne comptent pas ; le contenu, si | Changer la palette ou créer un espace vide n'envoie rien ; une note dans cet espace envoie une ligne. | [TRV-011](manuels/transverse.md#trv-011) |
| <a id="tu-act-03"></a>`TU-ACT-03` | activité : jamais sans compte, ni coupée ; réseau coupé, la saisie suivante réessaie | Sans session : rien. Interrupteur coupé : rien, et l'état reste coupé. Réseau coupé : la saisie suivante, réseau revenu, envoie la ligne. | [CPT-002](manuels/entree-et-comptes.md#cpt-002), [TRV-011](manuels/transverse.md#trv-011) |
| <a id="tu-act-04"></a>`TU-ACT-04` | activité : la clé du contenu ignore les réglages et les espaces vides | La « clé de contenu » ignore le nom, la boîte et les espaces vides, et change dès qu'une entrée apparaît. | — |
| <a id="tu-act-05"></a>`TU-ACT-05` | activité : la table, écrite pour soi seulement, jamais relue, bornée par son déclencheur | Dans `schema.sql` : suppression en cascade avec le compte, RLS active, insertion limitée à soi, aucune règle de lecture ou modification, déclencheur `security definer` qui impose l'identité et purge au-delà de 90 jours. | — |

### Calendrier iCal — `tests/agenda.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/agenda.js`.
- **Simulé** : Rien : fonctions pures, fuseau forcé à `Europe/Paris` (`process.env.TZ`).
- **Limites** : Récurrences simples seulement (hebdomadaire, quotidienne, mensuelle, exceptions) ; aucun calendrier réel de Google ou Apple.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-agd-01"></a>`TU-AGD-01` | lecture : lignes repliées, échappements, UTC, fuseau, journée entière, annulé écarté | Lignes repliées, échappements, heures UTC, fuseau `TZID`, journée entière, événement annulé écarté ; l'heure de Tokyo convertie. | [EXT-015](manuels/connexions.md#ext-015) |
| <a id="tu-agd-02"></a>`TU-AGD-02` | récurrences : hebdomadaire par jours, quotidienne limitée, exception déplacée, exclusion | Récurrence hebdomadaire par jours avec exclusion, quotidienne limitée à trois, exception déplacée ; 18 h 30 à Paris conservé après le changement d'heure ; un 31 absent de février est sauté. | [EXT-015](manuels/connexions.md#ext-015), [TRV-005](manuels/transverse.md#trv-005) |

### Application assemblée (artefact) — `tests/app.test.js`

- **Niveau** : Intégration simulée (I-A). **Sujet** : `selene.html` entier : assistant, résumé du matin, widget, erreurs d'action.
- **Simulé** : Script de `selene.html` dans une VM Node, faux DOM (chaînes `innerHTML`), stockage en mémoire, `window.claude` absent ou factice.
- **Limites** : Aucun rendu réel, aucun clic réel ; l'assistant est appelé par ses fonctions, sans modèle.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-app-01"></a>`TU-APP-01` | built artifact boots, persists an assistant-created task, and survives reload | Sans session, l'écran d'entrée ; « Commencer sans compte » ouvre l'app ; une tâche créée par l'outil de l'assistant est relue après un nouveau lancement sur le même stockage. | [CPT-002](manuels/entree-et-comptes.md#cpt-002), [AST-009](manuels/assistant.md#ast-009), [PLT-011](manuels/plateformes.md#plt-011) |
| <a id="tu-app-02"></a>`TU-APP-02` | assistant actions respect module and global permissions at execution time | Un outil de l'assistant refuse d'agir si le module est désactivé ou si « Autoriser Claude à modifier » est décoché, vérifié au moment de l'exécution. | [AST-003](manuels/assistant.md#ast-003), [AST-005](manuels/assistant.md#ast-005) |
| <a id="tu-app-03"></a>`TU-APP-03` | assistant : chaque écriture attend l’accord, qui voit ce qui serait écrit ; un refus ne change rien (T14) | Chaque écriture de l'assistant ouvre une confirmation qui montre le texte brut à écrire ; refuser n'écrit rien et renvoie « Refusé par la personne » au modèle. | [AST-004](manuels/assistant.md#ast-004) |
| <a id="tu-app-04"></a>`TU-APP-04` | résumé du matin : un par jour qui a quelque chose, à l’heure choisie, en texte brut, jamais dans le passé | Le résumé du matin : une notification par jour qui a quelque chose, à l'heure choisie, en texte brut, jamais dans le passé. | [PLT-005](manuels/plateformes.md#plt-005) |
| <a id="tu-app-05"></a>`TU-APP-05` | widget : la lune du jour, puis les tâches choisies et les rappels du jour, trois au plus, sans doublon | Le widget reçoit la lune du jour puis, au plus trois lignes, les tâches choisies et les rappels du jour, sans doublon. | [PLT-006](manuels/plateformes.md#plt-006) |
| <a id="tu-app-06"></a>`TU-APP-06` | une action qui échoue le dit : jamais un clic sans effet visible | Une action qui lève une erreur affiche « Cette action n'a pas abouti : … » au lieu de rester sans effet. | — |

### Couches et ordre de chargement — `tests/architecture.test.js`

- **Niveau** : Statique (S). **Sujet** : graphe des imports de `src/`.
- **Simulé** : Analyse du code source (espree), sans exécution.
- **Limites** : Vérifie la structure, pas le comportement.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-arch-01"></a>`TU-ARCH-01` | les couches : le noyau est pur, l’application ne passe que par la plateforme | Le noyau `src/core` n'importe que lui-même ; `src/app` ne passe que par `src/platform.js` ; la plateforme et les registres ne dépendent de rien. | — |
| <a id="tu-arch-02"></a>`TU-ARCH-02` | rien ne s’exécute au chargement qui dépende d’un module en cycle avec soi ; aucune écriture dans un import | Aucun code exécuté au chargement ne dépend d'un module en cycle ; aucun module n'écrit dans un import. | — |
| <a id="tu-arch-03"></a>`TU-ARCH-03` | aucun module n’est chargé sans servir : chaque fichier de src/app et src/core est atteint | Chaque fichier de `src/app` et `src/core` est atteint depuis le point d'entrée. | — |

### L'artefact claude.ai et son espace `db` — `tests/artifact.test.js`

- **Niveau** : Intégration simulée (I-A). **Sujet** : `selene.html` dans un artefact : où vont ses données (ADR 33).
- **Simulé** : Script de `selene.html` dans une VM Node, faux DOM, stockage en mémoire ; un faux claude.ai (`db` et `user`) qui applique la règle de la plateforme : un document sous `data/users/<id>/` n'existe que pour `<id>`, propriétaire comprise.
- **Limites** : Le vrai claude.ai n'est pas joint : ses règles d'accès sont celles de son contrat écrit, pas observées ([PLT-011](manuels/plateformes.md#plt-011), [BL-11](backlog.md#bl-11)).

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-art-01"></a>`TU-ART-01` | la propriétaire : son carnet passe dans son espace privé, l’ancien document partagé est effacé | Les anciens `site/state` et `board/state` partagés sont versés dans `data/users/<id>/site` et `…/board` de la propriétaire, sans perte, puis effacés ; ses écritures suivantes ne vont que dans son sous-arbre. | [PLT-011](manuels/plateformes.md#plt-011) |
| <a id="tu-art-02"></a>`TU-ART-02` | la propriétaire dans un autre navigateur, vierge : elle retrouve son carnet, déjà rapatrié | Un second navigateur de la même personne lit son carnet dans son sous-arbre privé. | [PLT-011](manuels/plateformes.md#plt-011) |
| <a id="tu-art-03"></a>`TU-ART-03` | quelqu’un à qui l’on a donné le lien : un Selene à soi, vide ; il ne lit ni ne garde le carnet de la propriétaire | Une autre personne, dont le navigateur avait synchronisé l'ancien document partagé, en oublie la copie ; ce qu'elle note va dans son propre sous-arbre, rien chez la propriétaire ; elle n'efface rien de partagé ; rouvert, son carnet reste. | [PLT-011](manuels/plateformes.md#plt-011) |
| <a id="tu-art-04"></a>`TU-ART-04` | un usage seulement local, sans synchronisation passée : gardé, et rangé dans l’espace privé | Ce qui a été noté dans un artefact sans `db` est gardé et rejoint le sous-arbre de la personne. | [PLT-011](manuels/plateformes.md#plt-011) |
| <a id="tu-art-05"></a>`TU-ART-05` | sans identité, en lecture seule, ou dans le navigateur d’un autre compte : rien ne part, rien ne se perd | Publié sans `user` : aucune écriture, nulle part, la note reste dans le navigateur et « Non synchronisé » s'affiche ; en lecture seule : aucune écriture ; un autre compte claude.ai dans le même navigateur : rien n'est envoyé, rien n'est effacé, et l'état le dit. | [PLT-011](manuels/plateformes.md#plt-011) |
| <a id="tu-art-06"></a>`TU-ART-06` | A17 : un ancien suivi encore marqué synchronisé est ramené dans ce navigateur ; la base n’en reçoit que le talon, et l’écran le dit | Un suivi `storage: "account"` (`donnees/rlm-synchronise-ancien.json`) lu dans l'artefact relié : le document privé `data/users/<id>/site` n'en a que le talon (`device`, aucune saisie, aucun objectif, sujet effacé, plus d'accord), ni la note ni le sujet ; la saisie est dans le document local ; la bulle dit « … est désormais gardé dans ce navigateur seulement… » ; « Où vivent ces données » dit ce que garde l'espace privé de claude.ai, plus « rien n'est envoyé au serveur de Selene », plus de bandeau. | [PLT-011](manuels/plateformes.md#plt-011), [RLM-024](manuels/reprendre-la-main.md#rlm-024) |
| <a id="tu-art-07"></a>`TU-ART-07` | A17 : importé, déjà dans la base, ou sans base : un ancien suivi synchronisé ne quitte jamais ce navigateur | Importé (le local, puis le site, comme `shell/actions.js`) dans un artefact relié : la base n'a que le talon. Déjà dans la base, écrit par une version d'avant : relu par un navigateur neuf, il y passe, la base n'en garde plus que le talon, la saisie reste. Publié sans base : gardé dans le navigateur, et l'écran dit « Dans ce navigateur seulement : rien de ce suivi n'est synchronisé, ni par Selene ni par claude.ai. ». | [PLT-011](manuels/plateformes.md#plt-011), [RLM-024](manuels/reprendre-la-main.md#rlm-024) |

### Session et rafraîchissement du jeton — `tests/auth.test.js`

- **Niveau** : Intégration simulée (I-H). **Sujet** : `src/app/services/auth.js`.
- **Simulé** : Build hébergé dans une VM, `fetch` remplacé (panne réseau, 503, 400, faux PostgREST), minuteurs et événement `online` déclenchés à la main.
- **Limites** : Supabase Auth réel jamais appelé ; l'écran de connexion n'est vu que par la présence de `authForm` dans le HTML.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-auth-01"></a>`TU-AUTH-01` | offline at boot: an expired session is kept and the app runs locally, with a visible warning | Session expirée et réseau coupé au démarrage : la session est gardée (mémoire et stockage), l'app s'affiche (pas `authForm`), « Non synchronisé » est affiché, aucune synchro. | [CPT-012](manuels/entree-et-comptes.md#cpt-012), [SYN-004](manuels/synchronisation.md#syn-004) |
| <a id="tu-auth-02"></a>`TU-AUTH-02` | server error (5xx) during refresh keeps the session too | Un 503 au rafraîchissement garde aussi la session. | [CPT-012](manuels/entree-et-comptes.md#cpt-012) |
| <a id="tu-auth-03"></a>`TU-AUTH-03` | an explicit refusal (400 invalid refresh token) ends the session and shows the login screen | Un refus explicite (400 « Invalid Refresh Token ») efface la session et affiche l'écran de connexion. | [CPT-012](manuels/entree-et-comptes.md#cpt-012) |
| <a id="tu-auth-04"></a>`TU-AUTH-04` | successful refresh connects both stores to Supabase | Un rafraîchissement réussi relie les deux stores au serveur, en un seul appel `/token`. | — |
| <a id="tu-auth-05"></a>`TU-AUTH-05` | concurrent refreshes share one request (refresh tokens are single-use) | Trois rafraîchissements simultanés ne font qu'une requête (les jetons de rafraîchissement sont à usage unique). | — |
| <a id="tu-auth-06"></a>`TU-AUTH-06` | offline boot recovers: sync resumes on the next keep-alive once the network is back | Démarrage hors ligne puis retour du réseau : au tour suivant du minuteur de 5 min, le jeton est rafraîchi, les stores reliés, l'indicateur se vide. | [CPT-012](manuels/entree-et-comptes.md#cpt-012) |
| <a id="tu-auth-07"></a>`TU-AUTH-07` | A18 : a signed-in device opens on the app, not on the entry screen, even while the server is slow | Serveur retenu : dès le démarrage, l'app (pas `authForm`), avant toute réponse du serveur ; une fois le serveur relâché, les deux documents branchés, toujours l'app. Échoue sans la lecture de la session avant le premier rendu. | [CPT-012](manuels/entree-et-comptes.md#cpt-012) |
| <a id="tu-auth-08"></a>`TU-AUTH-08` | A18 : data of another account on the device is never shown under this session: entry screen until the switch | Une session gardée pour u1, des données d'appareil de u0 (`selene-auth-last-uid`) : l'écran d'entrée tant que le serveur n'a pas répondu, pas les données de u0 ; après le changement de compte (`authConnectStores`), connecté et synchronisé. | [CPT-012](manuels/entree-et-comptes.md#cpt-012), [CPT-014](manuels/entree-et-comptes.md#cpt-014) |
| <a id="tu-auth-09"></a>`TU-AUTH-09` | A24 : the network back during a failing connect: the sync resumes at once, not at the 5-minute timer | Démarrage hors ligne, serveur retenu : le réseau revient (`online`) pendant le branchement du démarrage, dont les requêtes, parties hors ligne, échouent une fois relâchées ; les deux documents se branchent aussitôt, sans attendre le minuteur, et l'indicateur se vide. Échoue sans le correctif d'A24. | [CPT-012](manuels/entree-et-comptes.md#cpt-012), [SYN-004](manuels/synchronisation.md#syn-004) |
| <a id="tu-auth-10"></a>`TU-AUTH-10` | A24 : a reconnect that fails right after « online » is retried within seconds, not at the 5-minute timer | Démarrage hors ligne ; le réseau revient (`online`), mais la première tentative échoue encore : elle est retentée dans les secondes qui suivent, les deux documents se branchent, l'indicateur se vide. Échoue sans les reprises. | [CPT-012](manuels/entree-et-comptes.md#cpt-012), [SYN-004](manuels/synchronisation.md#syn-004) |
| <a id="tu-auth-11"></a>`TU-AUTH-11` | A24 : with no « online » event at all, a failed boot connect is retried on its own within seconds | Démarrage hors ligne ; le réseau revient sans aucun événement `online` (comme derrière un portail captif, où `navigator.onLine` reste vrai) : le branchement raté est retenté de lui-même, les deux documents se branchent en quelques secondes, l'indicateur se vide. Échoue sans les reprises automatiques. | [CPT-012](manuels/entree-et-comptes.md#cpt-012), [SYN-004](manuels/synchronisation.md#syn-004) |

### Sauvegardes : format et refus — `tests/backup.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/backup.js` (`parseBackup`, `createBackup`).
- **Simulé** : Rien.
- **Limites** : Valide la forme des fichiers ; l'import complet (remplacement, synchronisation) est testé ailleurs (`TU-SYN-15`).

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-bak-01"></a>`TU-BAK-01` | export v1 round trips without changing data | Exporter puis relire une sauvegarde rend exactement les mêmes données. | [DON-001](manuels/donnees-sauvegardes.md#don-001), [DON-007](manuels/donnees-sauvegardes.md#don-007) |
| <a id="tu-bak-02"></a>`TU-BAK-02` | malformed nested collections are rejected before import | Six formes abîmées sont refusées : étapes non liste, opérations non liste, module `null`, élément de boîte non objet, date d'écriture non numérique, format `selene-v2`. | [DON-005](manuels/donnees-sauvegardes.md#don-005) |
| <a id="tu-bak-03"></a>`TU-BAK-03` | older v1 backups with missing optional sections can be restored | Une ancienne sauvegarde v1 sans budget ni liste de modules se restaure. | — |
| <a id="tu-bak-04"></a>`TU-BAK-04` | oversized backup is rejected | Un fichier de plus de 5 000 000 caractères est refusé. | [DON-005](manuels/donnees-sauvegardes.md#don-005) |
| <a id="tu-bak-05"></a>`TU-BAK-05` | hostile backups are rejected: markup in ids, absurd numbers, bad dates | Douze sauvegardes hostiles sont refusées : balisage dans un identifiant de module, identifiant réservé, nombres absurdes ou en HTML, dates impossibles, valeur « NaN », entrée sans identifiant, fréquence négative, clé de partage piégée, montant textuel. | [DON-005](manuels/donnees-sauvegardes.md#don-005) |
| <a id="tu-bak-06"></a>`TU-BAK-06` | a well-formed custom module still imports | Un module personnalisé bien formé (`lecture-2`) s'importe avec ses entrées. | — |
| <a id="tu-bak-07"></a>`TU-BAK-07` | a backup from a newer schema is refused with an explicit message | Une sauvegarde au format 99 est refusée avec le message « … plus récente … ». | [DON-004](manuels/donnees-sauvegardes.md#don-004) |
| <a id="tu-bak-08"></a>`TU-BAK-08` | connexions externes : Dehors et le radar, validés comme le reste | Flux de Dehors, veilles et mots du radar sont validés : adresse `javascript:`, identifiant piégé, plus de cent flux, plus de trente veilles, mots de plus de 300 caractères, genre de veille inconnu sont refusés. | — |
| <a id="tu-bak-09"></a>`TU-BAK-09` | un fichier refusé dit pourquoi : pas du JSON, pas une sauvegarde, contenu invalide, version trop récente | Cinq refus, chacun avec son code et sa phrase affichée (par `errMsg`, donc la phrase de l'interface) : un texte qui n'est pas du JSON (« ne se lit pas comme une sauvegarde »), un JSON sans le bon `format` (« n'est pas une sauvegarde Selene »), un identifiant de module piégé et des tâches absentes (la même phrase « contenu … n'est pas valide »), un format 99 (« plus récente ») ; quatre phrases distinctes pour les cinq cas ; les trois premières disent « Rien n'a été importé. » ; la phrase affichée ne nomme ni le champ ni l'identifiant piégé, le message technique, lui, les garde. | [DON-005](manuels/donnees-sauvegardes.md#don-005) |

### Sources en BibTeX et en CSL-JSON — `tests/biblio.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/biblio.js` (`splitAuthors`, `parseName`, `sourceKind`, `sourcesBibtex`, `sourcesCsl`, `sourcesCslJson`).
- **Simulé** : Rien.
- **Limites** : Vérifie le texte produit ; la lecture par un vrai outil (LaTeX, Zotero, citeproc) a été faite hors du dépôt par l'auteur de la fonction, pas par ces tests.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-bib-01"></a>`TU-BIB-01` | auteurs : virgules, « et », « ; », initiales rendues à leur nom, « et al. » | Une ligne d'auteurs se redécoupe (virgules, « et », « ; », « et al. » noté à part) ; une initiale seule revient à son nom ; le nom de famille commence à la particule (« de La Fontaine ») ; un seul mot reste une institution. | [EXT-020](manuels/connexions.md#ext-020) |
| <a id="tu-bib-02"></a>`TU-BIB-02` | genre : l’étiquette reconnue en français ou en anglais, sinon aucun | L'étiquette d'une source donne son genre en français ou en anglais (« Thesis » → thèse) ; une étiquette inconnue n'en donne aucun. | [EXT-020](manuels/connexions.md#ext-020) |
| <a id="tu-bib-03"></a>`TU-BIB-03` | BibTeX : type, champs, clé lisible, échappement, DOI sans adresse redondante | `@article` avec auteurs « Nom, Prénom » et `and others`, revue, année et mois, DOI sans adresse doi.org ; une page en `@misc` avec site, adresse et date de consultation, caractères de LaTeX échappés ; une clé prise reçoit une lettre ; accolades équilibrées dans chaque entrée ; aucune source, aucun texte. | [EXT-020](manuels/connexions.md#ext-020) |
| <a id="tu-bib-04"></a>`TU-BIB-04` | BibTeX : chaque genre a son type et le site sa place ; majuscules protégées dans le titre | Livre, chapitre, actes, thèse, rapport, vidéo : le bon type et le site au bon champ (éditeur, ouvrage, école…) ; un mot à majuscule protégé dans le titre ; une institution reste un seul nom ; une entrée vide reste lisible. | [EXT-020](manuels/connexions.md#ext-020) |
| <a id="tu-bib-05"></a>`TU-BIB-05` | CSL-JSON : type, noms structurés, date en parties, consultation pour une page | L'article et la page en CSL-JSON, champ par champ (type, noms structurés, date en parties, DOI, adresse, date de consultation) ; le type de chaque genre. | [EXT-020](manuels/connexions.md#ext-020) |

### Sorties du build, politique de confidentialité, page de test — `tests/build.test.js`

- **Niveau** : Statique (S). **Sujet** : `build.py --dist`, `confidentialite.html`, `privacy.html`, `essai.html`.
- **Simulé** : Lance `python3 build.py --dist` puis lit les fichiers produits.
- **Limites** : Contrôle le contenu des pages, pas leur affichage ; les mentions RGPD sont cherchées par motifs de texte.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-bld-01"></a>`TU-BLD-01` | web et artefact : exactement les fichiers versionnés (vérifiés par build.py --check) | `dist/web` et `dist/artifact` contiennent exactement les fichiers versionnés ; icônes copiées à l'identique. | — |
| <a id="tu-bld-02"></a>`TU-BLD-02` | polices : servies par le site et les apps, avec leurs licences ; Google Fonts dans l’artefact seulement | Site et apps : 24 fichiers de polices servis par le site, CSP `font-src 'self'`, rien chez Google ; l'artefact seul charge Google Fonts ; le service worker ne met pas Google en cache. | [TRV-009](manuels/transverse.md#trv-009) |
| <a id="tu-bld-03"></a>`TU-BLD-03` | politique de confidentialité : publiée avec le site (en français et en anglais), sans script ni ressource extérieure, et liée depuis les Réglages | Les politiques française et anglaise sont publiées, sans script, avec la même date, nomment chaque service contacté par l'app, et sont liées depuis les Réglages. | [TRV-012](manuels/transverse.md#trv-012) |
| <a id="tu-bld-04"></a>`TU-BLD-04` | politique de confidentialité : ce que demande l’article 13 du RGPD, dans les deux langues | Dans les deux langues : sections de l'article 13, responsable nommée, contact par courriel (jamais un ticket public), bases légales 6.1.a, 6.1.b, 9.2.a, 6.1.f, hébergement à Paris, lien de réclamation à la CNIL. | [TRV-012](manuels/transverse.md#trv-012) |
| <a id="tu-bld-05"></a>`TU-BLD-05` | page publique de test (E3) : statique, son script et ses styles autorisés par leur empreinte, Supabase seul en réseau | `essai.html` : un seul script et deux feuilles de style autorisés par empreinte, rien d'inline, réseau limité au projet Supabase, aucun stockage ni cookie, images et aperçu publiés, « Essayer sans compte » vers `index.html#sans-compte`, prix affiché. | [TRV-013](manuels/transverse.md#trv-013) |
| <a id="tu-bld-06"></a>`TU-BLD-06` | le script produit ne dépend pas de la machine : aucun chemin absolu | Le script produit ne contient aucun chemin absolu de la machine de build. | — |
| <a id="tu-bld-07"></a>`TU-BLD-07` | natif : l’amorçage puis le même script, sans service worker ni manifeste | La page native contient l'amorçage puis le même script que le web, sans service worker ni manifeste ; chaque CSP n'autorise que ses propres scripts. | — |
| <a id="tu-bld-08"></a>`TU-BLD-08` | supprimer son compte sans l’app : une adresse à donner à Google Play, dans les deux langues | Les deux politiques ont une section « supprimer son compte » (étapes, ce qui est effacé, ce qui reste, sans pouvoir se connecter) avec un courriel de demande ; la section des droits y renvoie ; `docs/publication.md` donne cette adresse pour la Play Console. | [TRV-012](manuels/transverse.md#trv-012) |
| <a id="tu-bld-09"></a>`TU-BLD-09` | politique de confidentialité : le texte et les liens se lisent (4,5:1 au moins, WCAG AA), dans les deux langues | Le texte, le texte secondaire et les liens des deux politiques gardent un contraste de 4,5:1 sur leur fond. | [TRV-012](manuels/transverse.md#trv-012) |
| <a id="tu-bld-10"></a>`TU-BLD-10` | un projet Supabase de préproduction (la recette) : seulement dans dist/, avec une clé publique, et rien du projet de l’app | `SELENE_SUPABASE_URL` et `SELENE_SUPABASE_KEY` : refusés hors de `--dist` ; une clé secrète, une variable seule ou une adresse qui n'est pas celle d'un projet Supabase sont refusées ; avec `--dist`, la page web, la page de test et la page native parlent au projet de recette et ne contiennent rien du projet de l'app. | — |
| <a id="tu-bld-11"></a>`TU-BLD-11` | la fumée Windows : seule sa variante ouvre un port de débogage, la configuration publiée jamais | `native/tauri/tauri.conf.json` ne contient ni `remote-debugging` ni `additionalBrowserArgs` ; la variante de `scripts/windows-fumee.mjs` recopie chaque fenêtre telle quelle et n'ajoute que les arguments de wry et le port. | [PLT-009](manuels/plateformes.md#plt-009) |

### Carte céleste — `tests/carte.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/carte.js`.
- **Simulé** : Rien.
- **Limites** : Le dessin SVG et l'interaction sont dans `TN-carte`.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-cart-01"></a>`TU-CART-01` | carte : la même entrée toujours au même endroit, quel que soit l’ordre reçu | La même entrée est toujours à la même place, quel que soit l'ordre reçu. | [PEN-014](manuels/penser-avec.md#pen-014) |
| <a id="tu-cart-02"></a>`TU-CART-02` | carte : le temps de gauche à droite, une bande par espace dans l’ordre de la navigation | Le temps de gauche à droite (sans date : colonne du bord), une bande par espace dans l'ordre de la navigation, plus de liens = plus grosse étoile. | [PEN-014](manuels/penser-avec.md#pen-014) |
| <a id="tu-cart-03"></a>`TU-CART-03` | carte : les liens ne relient que des étoiles présentes, la tension ouverte est marquée | Un lien vers une entrée absente est omis ; la tension ouverte est marquée. | [PEN-014](manuels/penser-avec.md#pen-014) |
| <a id="tu-cart-04"></a>`TU-CART-04` | carte : vingt étoiles le même jour dans la même bande ne s’empilent pas au même point | Vingt étoiles le même jour dans la même bande sont étagées sans sortir de la bande. | [PEN-014](manuels/penser-avec.md#pen-014) |
| <a id="tu-cart-05"></a>`TU-CART-05` | carte : le voisinage, en largeur d’abord, coupé à 80 en gardant les plus proches | Le voisinage est parcouru en largeur, deux degrés au plus, et coupé à 80 en gardant les plus proches. | [PEN-014](manuels/penser-avec.md#pen-014) |

### Déclarations de confidentialité des stores — `tests/confidentialite-stores.test.js`

- **Niveau** : Statique (S) : lecture des fichiers de l'app iOS, de l'app Android, de `docs/publication.md`, des textes des fiches (`docs/fiches/`) et du code. **Sujet** : `native/ios/App/App/PrivacyInfo.xcprivacy`, `AndroidManifest.xml`, `Info.plist`, `InfoPlist.strings`, `docs/fiches/`.
- **Simulé** : Rien (aucune compilation, aucun lancement).
- **Limites** : Prouve que les déclarations existent et concordent entre elles ; pas ce que l'App Store ou Google Play en feront, ni ce que l'app fait réellement à l'exécution. Pour les fiches : les limites de longueur et les mots interdits, pas la justesse de chaque phrase (relecture humaine).

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-cst-01"></a>`TU-CST-01` | le manifeste est une ressource de l’app iOS | Le manifeste de confidentialité est copié dans l'app iOS (phase « Copy Bundle Resources »). | — |
| <a id="tu-cst-02"></a>`TU-CST-02` | aucun pistage, et la raison des dates de fichiers | Aucun pistage, aucun domaine de pistage ; la raison déclarée pour la lecture des dates de fichiers, liée à l'usage réel de `Filesystem.readdir` par l'amorçage natif. | — |
| <a id="tu-cst-03"></a>`TU-CST-03` | les données déclarées, et leur ligne dans la fiche Google Play | Les six types de données déclarés à Apple ont chacun leur ligne dans la fiche Google Play de `docs/publication.md` ; aucun ne sert au pistage ; seul le diagnostic (journal des erreurs) n'est pas lié au compte. | — |
| <a id="tu-cst-04"></a>`TU-CST-04` | « Ma position » dans les apps : la position approximative seule, et la phrase d’iOS en deux langues | Android ne demande que la position approximative (ni précise, ni en arrière-plan) ; iOS a sa phrase d'explication, en anglais et en français ; la position est arrondie au dixième avant d'être gardée. | [EXT-007](manuels/connexions.md#ext-007) |
| <a id="tu-cst-05"></a>`TU-CST-05` | les fiches des stores : limites de chaque champ, deux langues, rien de « Reprendre la main », l’adresse de la politique | Chaque champ des fiches Google Play (titre, description courte, description complète) et App Store (nom, sous-titre, texte promotionnel, description, mots-clés) existe en `fr-FR` et en `en-GB`, non vide et sous la limite du store (mots-clés d'Apple comptés en octets) ; aucun ne nomme « Reprendre la main », le tabac, l'alcool, le cannabis, une addiction, la santé ou le médical ; chaque description donne l'adresse de la politique dans sa langue ; les mots-clés sont séparés par des virgules, sans doublon ni nom d'une autre app ; `docs/publication.md` renvoie aux fiches. | — |

### Dehors : tri explicable — `tests/dehors.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/app/features/dehors-feed.js`.
- **Simulé** : Flux déjà lus, en mémoire.
- **Limites** : Ni lecture de flux réels, ni passeur.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-deh-01"></a>`TU-DEH-01` | sans croisement : du plus récent au plus ancien, comme avant | Sans croisement, les éléments vont du plus récent au plus ancien, sans raison affichée. | [EXT-013](manuels/connexions.md#ext-013) |
| <a id="tu-deh-02"></a>`TU-DEH-02` | motifs croisés : ce qui a des raisons passe devant, et les dit ; un lien paru dans deux flux, une fois | Ce qui croise tes sources ou tes motifs passe devant avec sa raison en toutes lettres ; un lien paru dans deux flux n'apparaît qu'une fois (« aussi dans… »). | [EXT-013](manuels/connexions.md#ext-013) |
| <a id="tu-deh-03"></a>`TU-DEH-03` | écarté par sa clé : il ne revient pas par un autre flux ; « seulement mes motifs » filtre encore ; max | Un élément écarté ne revient pas par un autre flux ; « seulement mes motifs » filtre ; le plafond est respecté et le total compté. | [EXT-013](manuels/connexions.md#ext-013) |

### Règles métier partagées — `tests/domain.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/domain.js`.
- **Simulé** : Rien.
- **Limites** : Deux règles seulement (tâches, budget et capture) ; le reste du domaine est couvert par `modules.test.js`.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-dom-01"></a>`TU-DOM-01` | task rules are shared by the UI and assistant | Titre vide refusé, titre nettoyé ; quatrième tâche du jour refusée ; une tâche faite quitte l'étoile et porte sa date ; la défaire efface la date ; tâche inconnue refusée. | [MOD-002](manuels/types-de-module.md#mod-002) |
| <a id="tu-dom-02"></a>`TU-DOM-02` | budget and capture reject invalid input without changing collections | Montants 0, −1, Infinity, « hello » et date du 30 février refusés sans rien ajouter ; capture vide refusée ; valeurs valides gardées, texte nettoyé. | [MOD-005](manuels/types-de-module.md#mod-005) |

### Édition des stores — `tests/edition.test.js`

- **Niveau** : Intégration (I). **Sujet** : `scripts/bundle.mjs` et `build.py` avec `SELENE_EDITION=stores`,
  `src/app/modules/regulation.stores.js`, `absentModule` et `shownModule` (`state/site.js`), `offered`,
  `services/device-guard.js`.
- **Simulé** : Le fichier lance `SELENE_EDITION=stores python3 build.py --dist` dans un dossier temporaire, puis
  démarre la page web produite dans une VM Node (`tests/hosted-harness.js`, option `html`) avec un faux Supabase en
  mémoire ; l'appareil A tourne dans l'édition complète (`index.html`), B et C dans celle des stores.
- **Limites** : Ni l'AAB ni l'app iOS ne sont construits ni lancés ; le contenu exclu est vérifié par des marques (les
  actions `rlm-…`, le format d'export), pas octet par octet. Les traductions et le noyau du type restent dans
  l'édition des stores, par choix ([regulation.md](../regulation.md#absent-des-versions-des-stores)).

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-edi-01"></a>`TU-EDI-01` | l’édition des stores ne contient ni l’écran, ni les formulaires, ni l’export du suivi ; l’édition complète, si | Les trois sorties de l'édition des stores (web, native, artefact) n'ont aucune action `rlm-…` ni le format d'export du suivi, et enregistrent le type comme absent ; l'édition complète versionnée a les deux et pas la marque d'absence. | [RLM-030](manuels/reprendre-la-main.md#rlm-030) |
| <a id="tu-edi-02"></a>`TU-EDI-02` | les fichiers versionnés restent l’édition complète : build.py n’écrit l’édition des stores que dans dist/ | `build.py --check` avec `SELENE_EDITION=stores` échoue (« seulement avec --dist ») ; une édition inconnue est refusée. | — |
| <a id="tu-edi-03"></a>`TU-EDI-03` | un compte qui a des suivis, ouvert dans l’édition des stores : rien n’est proposé, montré ni partagé | Un suivi gardé sur A et un ancien suivi synchronisé et partagé arrivent dans le document de B ; pour le compte personnel, ni proposé ni créable (modèle, type vide) ; jamais actif ; absent de la navigation et de l'accueil ; son adresse mène à l'accueil ; rien à l'assistant malgré le partage ; dans les Réglages, une ligne à la case désactivée, la phrase qui l'explique, et rien dans « Ce que Claude peut lire ». | [RLM-030](manuels/reprendre-la-main.md#rlm-030) |
| <a id="tu-edi-04"></a>`TU-EDI-04` | l’édition des stores rend le document comme il est venu : l’édition complète retrouve ses suivis entiers | Une modification faite dans l'édition des stores part au serveur ; les deux suivis, leur place, leur nom et leur partage y restent identiques ; A les retrouve ouverts et entiers. | [RLM-030](manuels/reprendre-la-main.md#rlm-030) |
| <a id="tu-edi-05"></a>`TU-EDI-05` | supprimer depuis l’édition des stores : la confirmation dit ce qui part ; le détenteur ne perd rien | Supprimer un suivi gardé sur A : le texte « son nom reviendra », et A rend le nom sans rien perdre ; supprimer l'ancien suivi synchronisé : le texte « efface son contenu de ton compte, partout », et il quitte le serveur. | [RLM-030](manuels/reprendre-la-main.md#rlm-030) |
| <a id="tu-edi-06"></a>`TU-EDI-06` | le même appareil, passé de l’édition complète à celle des stores : la copie locale reste, la déconnexion la protège | Le même stockage relancé dans l'édition des stores : la copie locale est là, entière, sans être ouverte ; « Se déconnecter » ouvre la garde (exporter ou effacer, le nom du suivi) ; l'effacement confirmé retire la copie et le nom du compte, sans toucher l'autre suivi. | [RLM-030](manuels/reprendre-la-main.md#rlm-030) |

### Langues de l'interface — `tests/i18n.test.js`

- **Niveau** : Unitaire et statique (U, S). **Sujet** : `src/app/i18n/`, dictionnaire `en.js`, déclarations des coquilles natives.
- **Simulé** : Fonctions de traduction appelées directement ; sources lues comme du texte.
- **Limites** : Ne juge pas la qualité des traductions ; l'interface traduite à l'écran est dans `TN-langue`.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-i18n-01"></a>`TU-I18N-01` | le français est la source : le texte tel qu’écrit, valeurs comprises | Le français est la source : le texte tel qu'écrit, valeurs comprises. | — |
| <a id="tu-i18n-02"></a>`TU-I18N-02` | une traduction : clé « … {0} … », valeurs déplaçables, repli sur le français | Une traduction utilise la clé « … {0} … », peut déplacer les valeurs, et retombe sur le français sans traduction. | — |
| <a id="tu-i18n-03"></a>`TU-I18N-03` | le contexte distingue deux sens d’un même mot (gettext : msgctxt) | Le contexte (`trp`) distingue deux sens d'un même mot. | — |
| <a id="tu-i18n-04"></a>`TU-I18N-04` | pluriels : les catégories du CLDR de chaque langue (0 est singulier en français, pluriel en anglais) | Pluriels selon le CLDR : 0 singulier en français, pluriel en anglais. | — |
| <a id="tu-i18n-05"></a>`TU-I18N-05` | la langue en vigueur : le choix du compte s’il est proposé, sinon l’appareil, sinon le français | La langue en vigueur : celle du compte si elle est proposée, sinon celle de l'appareil, sinon le français. | [NAV-009](manuels/navigation-reglages.md#nav-009) |
| <a id="tu-i18n-06"></a>`TU-I18N-06` | pseudo-langue : chaque texte traduit se voit (⟦ ⟧, accents, un tiers plus long), les valeurs restent intactes | La pseudo-langue marque chaque texte traduit (⟦ ⟧, accents, un tiers plus long) sans toucher aux valeurs. | — |
| <a id="tu-i18n-07"></a>`TU-I18N-07` | tri dans la langue : « é » se range avec « e », pas après « z » | Le tri suit la langue : « é » se range avec « e ». | — |
| <a id="tu-i18n-08"></a>`TU-I18N-08` | plural : le « s » d’un mot choisi par la personne, au moment que dictent les règles de la langue | Le « s » d'un mot choisi par la personne s'ajoute selon les règles de la langue. | — |
| <a id="tu-i18n-09"></a>`TU-I18N-09` | les libellés du noyau (statuts, liens) sont tous marqués pour la traduction | Les libellés du noyau (statuts, liens) sont tous marqués pour la traduction. | — |
| <a id="tu-i18n-10"></a>`TU-I18N-10` | le ciel du noyau est couvert : temps, pluies d’étoiles, éclipses (2026-2030, depuis Lille), vents | Les textes du ciel (temps, pluies d'étoiles, éclipses 2026-2030, vents) sont tous traduits. | — |
| <a id="tu-i18n-11"></a>`TU-I18N-11` | chaque erreur du noyau a sa traduction : codes levés par coreError, champs nommés par requireText | Chaque code d'erreur levé par le noyau et chaque champ nommé ont une traduction. | — |
| <a id="tu-i18n-12"></a>`TU-I18N-12` | chaque erreur des fonctions serveur a son code, et chaque code sa traduction | Chaque erreur des fonctions serveur a un code, et chaque code une traduction. | — |
| <a id="tu-i18n-13"></a>`TU-I18N-13` | les genres de source du noyau sont tous dans la liste à traduire | Les genres de source du noyau sont dans la liste à traduire. | — |
| <a id="tu-i18n-14"></a>`TU-I18N-14` | les coquilles natives déclarent les langues proposées, ni plus ni moins (iOS, Android, installateur Windows) | iOS (`CFBundleLocalizations`), Android (`locales_config.xml`) et l'installateur Windows déclarent exactement les langues proposées. | [PLT-007](manuels/plateformes.md#plt-007) |
| <a id="tu-i18n-15"></a>`TU-I18N-15` | un modèle de module se crée dans la langue de l’interface ; les valeurs du code ne bougent pas | Un modèle se crée dans la langue de l'interface ; les valeurs internes (affichage, mode de saisie) ne changent pas. | [NAV-009](manuels/navigation-reglages.md#nav-009) |
| <a id="tu-i18n-16"></a>`TU-I18N-16` | un texte enregistré dans une langue se reconnaît dans toutes (provenances) | Une provenance enregistrée dans une langue se reconnaît dans l'autre. | — |
| <a id="tu-i18n-17"></a>`TU-I18N-17` | les noms tr, trp, trn et N_ sont réservés dans src/app : aucune variable ne les masque | Aucune variable de `src/app` ne masque `tr`, `trp`, `trn` ou `N_`. | — |
| <a id="tu-i18n-18"></a>`TU-I18N-18` | dates : en français, le premier du mois s’écrit « 1er » (avec un mois en lettres seulement) ; en anglais, rien ne change | En français, le premier du mois s'écrit « 1er » avec un mois en lettres (« 1er septembre 2026 », « mardi 1er septembre 2026 », « 1er sept. ») ; 2, 11 et 21 ne changent pas ; la date numérique (« 01/09 ») reste telle quelle ; en anglais, la date est celle de la langue. | [NAV-009](manuels/navigation-reglages.md#nav-009), [RLM-014](manuels/reprendre-la-main.md#rlm-014) |

### Export Instagram — `tests/instagram.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/instagram.js`.
- **Simulé** : Exports synthétiques.
- **Limites** : Le format réel de Meta peut changer : seul un vrai export le dira.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-ig-01"></a>`TU-IG-01` | encodage : les octets de Meta retrouvent leur sens, un texte juste reste intact | L'encodage de Meta est réparé (« Ã© » redevient « é », émojis compris) sans abîmer un texte déjà juste. | [EXT-011](manuels/connexions.md#ext-011) |
| <a id="tu-ig-02"></a>`TU-IG-02` | lecture : un seul média ou un carrousel, posts et reels, stories ignorées | Un média seul ou un carrousel, posts et reels lus ; stories ignorées ; entrée invalide → liste vide. | [EXT-011](manuels/connexions.md#ext-011) |
| <a id="tu-ig-03"></a>`TU-IG-03` | élément : la première ligne en titre, la légende en texte, le jour en date, l’origine validée | Première ligne en titre, légende en texte, jour de publication en date ; un reel sans légende prend sa date pour titre ; l'origine `ig` est valide. | [EXT-011](manuels/connexions.md#ext-011) |

### Le script d'isolation entre comptes — `tests/isolation.test.js`

- **Niveau** : Contrat (C). **Sujet** : `scripts/isolation.mjs`.
- **Simulé** : Une fausse base qui applique les règles RLS de `schema.sql`, puis percée d'un trou à la fois ; aucun réseau.
- **Limites** : Prouve que le script détecte une fuite ; ne prouve rien sur les règles du vrai projet : c'est `TS-ISOLATION`, à lancer à la main sur la préproduction.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-iso-01"></a>`TU-ISO-01` | isolation : une base conforme à supabase/schema.sql refuse les douze requêtes (code 0) | Contre une base conforme à `schema.sql`, les douze requêtes interdites sont refusées : code de sortie 0. | [TRV-016](manuels/transverse.md#trv-016) |
| <a id="tu-iso-02"></a>`TU-ISO-02` | isolation : chaque trou dans les règles fait échouer le test (code 1) et se voit à sa ligne | Chaque trou percé dans les règles (lecture, écriture, suppression, clés, administration) fait sortir en 1 et se voit à sa ligne. | — |
| <a id="tu-iso-03"></a>`TU-ISO-03` | isolation : une écriture passée sans rien renvoyer se voit au contrôle final | Une écriture passée sans rien renvoyer (« muette ») est découverte au contrôle final de la ligne de B. | — |
| <a id="tu-iso-04"></a>`TU-ISO-04` | isolation : un montage qui ne prouverait rien arrête tout (code 2), sans lancer les douze | Un montage qui ne prouverait rien (table absente, droits cassés) arrête tout avec le code 2, sans lancer les douze requêtes. | — |
| <a id="tu-iso-05"></a>`TU-ISO-05` | isolation : le projet de l’app est refusé avant toute requête | L'adresse du projet de l'app est refusée avant toute requête. | — |
| <a id="tu-iso-06"></a>`TU-ISO-06` | isolation : la clé secrète du projet est refusée avant toute requête | Une clé secrète (`service_role`, `sb_secret_`) est refusée avant toute requête. | — |
| <a id="tu-iso-07"></a>`TU-ISO-07` | isolation : un refus pour une autre raison que la règle reste douteux | Un refus pour une autre raison que la règle (409…) est marqué douteux (code 2). | — |
| <a id="tu-iso-08"></a>`TU-ISO-08` | isolation : les écritures à refuser ne demandent rien en retour, comme un compte malveillant | Les écritures à refuser demandent `return=minimal`, comme un compte malveillant. | — |
| <a id="tu-iso-09"></a>`TU-ISO-09` | isolation : le script est déclaré et documenté, chaque variable nommée | Le script est déclaré dans `package.json`, documenté, chaque variable d'environnement nommée. | — |
| <a id="tu-iso-10"></a>`TU-ISO-10` | workflow Isolation : chaque lundi, aux règles changées et à la demande ; lecture seule ; sans secrets, sauté ou en échec selon qui le lance | Le workflow lu tel quel : à la demande, planifié, rejoué quand `schema.sql`, le script ou le workflow changent sur `main` ; jeton en lecture seule ; actions épinglées par empreinte ; les six variables viennent des secrets ; ni `set -x` ni écho d'un secret ; il lance `npm run isolation`. Son premier pas, joué dans bash : sans secrets, planifié ou poussé, sauté avec un avis qui nomme ce qui manque ; lancé à la main, en échec, et dit ; avec les six, prêt. | [TRV-016](manuels/transverse.md#trv-016) |

### Journal des erreurs — `tests/journal.test.js`

- **Niveau** : Intégration simulée (I-H). **Sujet** : `src/app/services/journal.js`, table `erreurs`.
- **Simulé** : Build hébergé dans une VM, faux PostgREST qui enregistre les envois.
- **Limites** : La table réelle (purge à 30 jours, plafond horaire) n'est pas exécutée.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-jrn-01"></a>`TU-JRN-01` | journal : une erreur de programmation part sans compte, sans jeton, sans son message | Une exception non rattrapée part sans session ni jeton : genre, lieu `fichier:ligne:colonne`, empreinte du code ; ni le message, ni l'adresse, ni l'identifiant du compte. | [TRV-010](manuels/transverse.md#trv-010) |
| <a id="tu-jrn-02"></a>`TU-JRN-02` | journal : les erreurs attendues ne partent pas (validation, noyau, réseau, abandon) | Validations, erreurs du noyau, coupures réseau et abandons ne partent pas ; un stockage plein (`QuotaExceededError`) part. | [TRV-010](manuels/transverse.md#trv-010) |
| <a id="tu-jrn-03"></a>`TU-JRN-03` | journal : une fois chaque erreur, cinq au plus par chargement | La même erreur ne part qu'une fois ; cinq envois au plus par chargement. | — |
| <a id="tu-jrn-04"></a>`TU-JRN-04` | journal : l’écran dit la vue ou le type, jamais l’identifiant d’un module (tiré de son nom) | L'écran est désigné par la vue ou `module:<type>`, jamais par l'identifiant d'un module ; un type sensible n'est désigné que par `module`. | — |
| <a id="tu-jrn-05"></a>`TU-JRN-05` | journal : une action qui échoue sur un défaut part avec son nom ; coupé dans les Réglages, plus rien | Une action qui échoue sur un défaut part avec son nom ; l'interrupteur des Réglages (activé par défaut) coupe l'envoi pour l'appareil. | [TRV-010](manuels/transverse.md#trv-010) |
| <a id="tu-jrn-06"></a>`TU-JRN-06` | journal : le premier cadre de la pile, réduit au fichier, pour Chrome, Firefox et Safari | Le premier cadre de la pile est réduit au nom de fichier, aux formats de Chrome, Firefox et Safari. | — |
| <a id="tu-jrn-07"></a>`TU-JRN-07` | journal : l’empreinte du code est la même dans le site, l’artefact et les apps, et la table est dans le schéma | L'empreinte du code est la même dans le site, l'artefact et les apps ; la table `erreurs` est dans le schéma, sans règle de lecture ou de modification. | — |

### Vérification des liens de santé — `tests/liens.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `scripts/liens.mjs`.
- **Simulé** : Réponses réseau fabriquées.
- **Limites** : Le vrai passage mensuel est `TS-LIENS`.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-lnk-01"></a>`TU-LNK-01` | liens : les adresses https des sources et de l’interface, sans ponctuation ni doublon | Le script relève les adresses https des sources de santé et de l'interface, sans ponctuation ni doublon, dont chaque hôte cité. | — |
| <a id="tu-lnk-02"></a>`TU-LNK-02` | liens : une page disparue fait échouer, un refus est seulement signalé | Une page disparue (404, 410, domaine inconnu) fait échouer ; un refus (401, 403, 429, 5xx, délai) est seulement signalé. | — |

### Modules, migrations, interface et « penser avec » — `tests/modules.test.js`

- **Niveau** : Intégration simulée (I-A), parfois unitaire. **Sujet** : `selene.html` entier : registres de types, migrations, accueil, recherche, liaisons, bilan….
- **Simulé** : Script de `selene.html` dans une VM Node, faux DOM (HTML lu comme une chaîne), stockage en mémoire, jeu d'essai `tests/fixtures/site-demo.json` (format 6, migré au chargement) sauf mention.
- **Limites** : Aucun rendu ni clic réels : les actions sont appelées directement (`CLICK[…]`) ; ce que voit l'écran n'est vérifié que par motifs de HTML.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-mod-01"></a>`TU-MOD-01` | legacy site data (pre-generic-modules) migrates in place without data loss | Un document du format 1 (sections à la racine) devient des modules génériques : séances, mots, chapitres, fragments, journal gardés ; nom personnalisé conservé ; migration idempotente. | [DON-006](manuels/donnees-sauvegardes.md#don-006) |
| <a id="tu-mod-02"></a>`TU-MOD-02` | a deleted built-in module is never resurrected by later S() calls | Un module supprimé n'est pas recréé par la normalisation au chargement suivant. | [ESP-007](manuels/espaces.md#esp-007), [SYN-006](manuels/synchronisation.md#syn-006) |
| <a id="tu-mod-03"></a>`TU-MOD-03` | creating and deleting a custom module of each type works end to end | Créer un programme, un cumul et des rappels, y écrire, refuser un identifiant déjà pris, supprimer, refuser de supprimer deux fois. | [ESP-003](manuels/espaces.md#esp-003) |
| <a id="tu-mod-04"></a>`TU-MOD-04` | backup export/import round trips the new generic module shape | Un export puis import garde les modules génériques et leurs entrées. | [DON-001](manuels/donnees-sauvegardes.md#don-001), [DON-007](manuels/donnees-sauvegardes.md#don-007) |
| <a id="tu-mod-05"></a>`TU-MOD-05` | module ids never shadow fixed routes or Object.prototype names | « Réglages », « Accueil », « Constructor » ne donnent jamais l'identifiant d'une route fixe ou d'un nom de `Object.prototype` ; création forcée refusée. | [NAV-012](manuels/navigation-reglages.md#nav-012) |
| <a id="tu-mod-06"></a>`TU-MOD-06` | fixed views win over a colliding module id already present in stored data | Un module nommé `reglages` déjà présent dans les données ne masque pas les Réglages ; `#constructor` ne plante pas et ramène à l'accueil. | [NAV-012](manuels/navigation-reglages.md#nav-012) |
| <a id="tu-mod-07"></a>`TU-MOD-07` | journal entries reject non-numeric values instead of storing NaN | Une valeur « beaucoup » est refusée (pas de NaN) ; une valeur négative est permise dans un cumul (mots coupés). | — |
| <a id="tu-mod-08"></a>`TU-MOD-08` | type registries: the pure and the UI halves declare exactly the same types | Les registres de types (données et interface) ont les mêmes clés ; chaque type a `view`, `settings`, `summary`, `context` ; ses actions sont branchées. | — |
| <a id="tu-mod-09"></a>`TU-MOD-09` | every registered type works end to end through the registry alone | Chaque type, créé par le registre seul : une entrée, sa vue, ses réglages, son résumé, son contexte ; privé tant que non partagé avec l'assistant, présent une fois partagé ; tout passe la validation d'import. | [ESP-010](manuels/espaces.md#esp-010), [DON-007](manuels/donnees-sauvegardes.md#don-007), [AST-003](manuels/assistant.md#ast-003) |
| <a id="tu-mod-10"></a>`TU-MOD-10` | S() is a pure read: calling it never changes the stored document | Lire le document (`S()`) ne le modifie jamais ; la migration a lieu une fois, au chargement. | — |
| <a id="tu-mod-11"></a>`TU-MOD-11` | a re-render in Settings never wipes a field being typed in (any settings block) | Un rendu pendant la frappe dans un champ de réglage ne remplace pas la page ; une case à cocher, si. | [ESP-011](manuels/espaces.md#esp-011) |
| <a id="tu-mod-12"></a>`TU-MOD-12` | format 2 → 3: october.moth and Musique become collections without losing anything | Format 2 → 3 : october.moth et Musique deviennent des collections ; nom, statut, regroupement et choix de partage gardés ; statut inconnu → premier statut ; résultat importable. | [DON-006](manuels/donnees-sauvegardes.md#don-006) |
| <a id="tu-mod-13"></a>`TU-MOD-13` | a legacy section written late by an old app version is absorbed, not lost | Une ancienne section réécrite tard par une vieille version est absorbée dans le module, sans perte ni doublon. | — |
| <a id="tu-mod-14"></a>`TU-MOD-14` | collection items: required title, disabled fields keep their value, unknown status falls back | Titre obligatoire (« Artiste : à remplir ») ; statut inconnu → premier ; un champ absent du formulaire garde sa valeur ; date invalide → vide. | [MOD-018](manuels/types-de-module.md#mod-018) |
| <a id="tu-mod-15"></a>`TU-MOD-15` | collection grouping: done threshold and a disabled grouping field never break the panel | Le pourcentage d'un groupe suit le seuil « fait » ; un regroupement sur un champ masqué retombe sur le titre sans casser le panneau. | [MOD-018](manuels/types-de-module.md#mod-018) |
| <a id="tu-mod-16"></a>`TU-MOD-16` | backup: collections are validated (statuses, dates) but need no journal date | Une collection exportée se réimporte ; statut unique, date impossible, champ non textuel, affichage inconnu sont refusés. | — |
| <a id="tu-mod-17"></a>`TU-MOD-17` | format 3 → 4: the Capture becomes the designated Notes inbox, items and privacy kept | Format 3 → 4 : la Capture devient la boîte de réception (module Notes), ses notes, son nom et son partage gardés. | [DON-006](manuels/donnees-sauvegardes.md#don-006) |
| <a id="tu-mod-18"></a>`TU-MOD-18` | only one inbox survives, even when two devices each designated one | Deux boîtes désignées (deux appareils) : une seule survit après normalisation. | [ESP-009](manuels/espaces.md#esp-009), [SYN-008](manuels/synchronisation.md#syn-008) |
| <a id="tu-mod-19"></a>`TU-MOD-19` | a note can be filed into any module that accepts it, and nowhere else | Les destinations d'une note : tâches, écriture (si carnet), collections, rappels ; ni un programme, ni la boîte elle-même ; rangée, la note quitte la boîte et devient une observation. | [MOD-015](manuels/types-de-module.md#mod-015) |
| <a id="tu-mod-20"></a>`TU-MOD-20` | without an inbox, the assistant loses its capture tool instead of failing | Sans boîte de réception, l'outil « capturer » de l'assistant disparaît. | [ESP-009](manuels/espaces.md#esp-009) |
| <a id="tu-mod-21"></a>`TU-MOD-21` | format 4 → 5: the Budget becomes a generic module, operations, envelopes and settings kept | Format 4 → 5 : le Budget devient un module générique ; opérations, enveloppes, regroupement et nom gardés ; importable. | [DON-006](manuels/donnees-sauvegardes.md#don-006) |
| <a id="tu-mod-22"></a>`TU-MOD-22` | budget: renaming a group renames its envelope, the assistant writes into the first budget module | Renommer un groupe du budget renomme l'enveloppe ; l'outil de l'assistant écrit dans le premier budget. | [MOD-006](manuels/types-de-module.md#mod-006) |
| <a id="tu-mod-23"></a>`TU-MOD-23` | a new account starts nearly empty, with nothing personal, and is offered templates | Un compte neuf n'a que la boîte, rien de personnel, et voit « Composer ton espace » ; un modèle s'ajoute deux fois ; le nouvel espace est partagé avec l'assistant ; « C'est bon » referme le bloc. | [ESP-001](manuels/espaces.md#esp-001), [ESP-002](manuels/espaces.md#esp-002), [ESP-010](manuels/espaces.md#esp-010) |
| <a id="tu-mod-24"></a>`TU-MOD-24` | existing accounts never see the welcome block (it is not a missing default) | Un compte existant ne voit jamais le bloc d'accueil. | [ESP-002](manuels/espaces.md#esp-002) |
| <a id="tu-mod-25"></a>`TU-MOD-25` | every template builds a module that passes its own backup validation | Chaque modèle crée un module qui passe sa propre validation d'import ; les réglages du modèle complètent ceux du type. | [ESP-003](manuels/espaces.md#esp-003), [DON-002](manuels/donnees-sauvegardes.md#don-002) |
| <a id="tu-mod-26"></a>`TU-MOD-26` | the seed stays pristine: a fresh device adopts the server instead of merging | Les données de départ sont vierges (`updatedAt` 0) et identiques d'un appel à l'autre. | [SYN-009](manuels/synchronisation.md#syn-009) |
| <a id="tu-mod-27"></a>`TU-MOD-27` | deleting an item offers « Annuler », which puts it back where it was | Supprimer un élément affiche « Supprimé : « deux » » et « Annuler », qui le remet à sa place ; un second « Annuler » ne fait rien. | [MOD-022](manuels/types-de-module.md#mod-022) |
| <a id="tu-mod-28"></a>`TU-MOD-28` | writing: in « total » mode the app records the difference, cuts included | Mode total : 1 000 puis 1 600 enregistre +600 ; 1 450 enregistre −150 ; le même total n'enregistre rien. | [MOD-009](manuels/types-de-module.md#mod-009) |
| <a id="tu-mod-29"></a>`TU-MOD-29` | writing: a projected end date from the last 30 days, and honest when there is no pace | Sans élan : « Pas assez d'élan… » ; 30 000 mots en 30 jours : « 1 000 mots par jour » ; objectif dépassé : « Objectif atteint ». | [MOD-010](manuels/types-de-module.md#mod-010) |
| <a id="tu-mod-30"></a>`TU-MOD-30` | home: a due reminder can be done, a session logged with the last duration, due items surface | L'accueil propose « fait » sur un rappel dû, « Noter 25 min » (dernière durée) et l'élément en retard ; noter enregistre 25 à la date du jour. | [MOD-007](manuels/types-de-module.md#mod-007), [MOD-013](manuels/types-de-module.md#mod-013) |
| <a id="tu-mod-31"></a>`TU-MOD-31` | drafts are kept per view and field, and emptied when the field is sent | Un brouillon est gardé par vue et par champ, et effacé quand le champ est vidé. | [MOD-023](manuels/types-de-module.md#mod-023) |
| <a id="tu-mod-32"></a>`TU-MOD-32` | search: every module, accents and case ignored, all words required, highlight stays aligned | La recherche parcourt tous les modules, ignore accents et casse, exige tous les mots, surligne au bon endroit même après un émoji, échappe le HTML ; `recherche` est une route réservée. | [NAV-004](manuels/navigation-reglages.md#nav-004) |
| <a id="tu-mod-33"></a>`TU-MOD-33` | timer end: the open module proposes the obvious next step | À la fin du minuteur, un programme en minutes propose « Noter 15 min » ; en pages, rien. | [MOD-024](manuels/types-de-module.md#mod-024) |
| <a id="tu-mod-34"></a>`TU-MOD-34` | a finished task with a cost offers to move it into the budget envelope | Terminer une tâche à 250 € propose de l'ajouter à l'enveloppe « Travaux » ; accepter crée la dépense ; l'enveloppe est devinée dans la langue de la personne. | [MOD-003](manuels/types-de-module.md#mod-003) |
| <a id="tu-mod-35"></a>`TU-MOD-35` | capture patterns: money, minutes and « module : text » are recognised, nothing else | « 12,50 € courses… », « €12.50 courses », « 25 min kundalini », « 25 mins … », « Phidippus : … », « Écriture: … » sont reconnus ; « acheter du pain », « rdv : 14h… », « 25 min de marche », « 0 € » ne le sont pas ; ranger retire la note de la boîte. | [MOD-014](manuels/types-de-module.md#mod-014) |
| <a id="tu-mod-36"></a>`TU-MOD-36` | writing workshop: fragments follow chapters and export as Markdown | L'export Markdown range les fragments sous leurs chapitres dans l'ordre, puis « Hors chapitre » ; le panneau compte les fragments par chapitre. | [MOD-011](manuels/types-de-module.md#mod-011) |
| <a id="tu-mod-37"></a>`TU-MOD-37` | review periods: lunar cycles tile time exactly, months too, and the current one contains today | Les cycles lunaires se suivent sans trou (29 à 30 jours) et contiennent aujourd'hui ; les mois aussi, à travers le changement d'année. | [PEN-010](manuels/penser-avec.md#pen-010), [TRV-004](manuels/transverse.md#trv-004) |
| <a id="tu-mod-38"></a>`TU-MOD-38` | review: each module sums what happened in the period, next to the previous one | Le bilan de chaque type pour la période (« 2 séances, 45 min », « 40,00 € dépensés », « 1 tâche terminée, 250,00… », « Rien de noté ») et la période d'avant. | [PEN-010](manuels/penser-avec.md#pen-010) |
| <a id="tu-mod-39"></a>`TU-MOD-39` | epistemic status: « ? » marks a hypothesis, changes are dated, search filters by status | « ? » en tête seulement marque une hypothèse ; capture marquée, « ? » retiré ; changement daté ; vide retire ; `statut:` et `status:` filtrent, abréviations comprises ; décompte du bilan ; statut piégé refusé à l'import. | [PEN-001](manuels/penser-avec.md#pen-001) |
| <a id="tu-mod-40"></a>`TU-MOD-40` | provenance: what is filed from a box keeps a frozen copy of the note it came from | Une note rangée laisse au fragment une copie de son texte, de sa date et de sa boîte ; le statut suit là où il se lit ; deux rangements gardent la première naissance ; « ↳ de Capture, 3 sept. » affiché ; provenance malformée refusée. | [PEN-002](manuels/penser-avec.md#pen-002) |
| <a id="tu-mod-41"></a>`TU-MOD-41` | resumption bridge: the next step noted on leaving shows on the module and at home, and its fate is kept | Fin du minuteur : le champ du pont s'ouvre ; le pont s'affiche dans le module et sur l'accueil ; remplacé puis repris : historique « remplacé », « repris » ; « Annuler » le remet ; pont malformé refusé. | [PEN-006](manuels/penser-avec.md#pen-006) |
| <a id="tu-mod-42"></a>`TU-MOD-42` | decisions: a revision date comes back whatever the state, the reason is reread, « maintenue » is logged | Une décision « Prise » échue revient sur l'accueil, pas une « Abandonnée » ni une future ; « maintenue » date le réexamen et lève le rendez-vous ; « Annuler » rétablit ; une collection ordinaire ne fait pas revenir ce qui est fait. | [MOD-019](manuels/types-de-module.md#mod-019) |
| <a id="tu-mod-43"></a>`TU-MOD-43` | concordance: motifs counted as whole words across modules, with neighbours and fallow ones | Les motifs se comptent en mot entier, pluriel toléré (« lunettes » exclu), hors de leur propre module, variantes comprises ; voisins dès deux rencontres ; jachère sauf « Épuisé » ; jachère négative refusée à l'import. | [MOD-020](manuels/types-de-module.md#mod-020) |
| <a id="tu-mod-44"></a>`TU-MOD-44` | settings numbers stay within what backup validation accepts, so an export can always be restored | Un nombre de réglage hors bornes (600 semaines, −4) est ramené à 520 ou 1 ; chaque champ porte le maximum de sa validation ; l'export reste importable. | [DON-010](manuels/donnees-sauvegardes.md#don-010) |
| <a id="tu-mod-45"></a>`TU-MOD-45` | decisions: editing an overdue revision date counts as a review; an ordinary edit does not | Déplacer une date de révision échue compte comme un réexamen ; changer seulement le titre, ou une date future, non ; seulement en mode révision. | [MOD-019](manuels/types-de-module.md#mod-019) |
| <a id="tu-mod-46"></a>`TU-MOD-46` | concordance: multi-word variants, accents, and the same answer as before the inverted index | Variantes de plusieurs mots avec espaces quelconques, après ponctuation, sans accents ; « papillon de jour » et « mothra » exclus. | [MOD-020](manuels/types-de-module.md#mod-020) |
| <a id="tu-mod-47"></a>`TU-MOD-47` | lexical drift: words proper to the period against the six before, stopwords and plurals handled | Sous cinq textes, le bilan le dit ; mots émergents et absents par rapport aux six périodes d'avant, une fois par texte, mots vides et nombres écartés ; « + » ajoute un motif une seule fois ; le module Motifs n'entre pas dans le corpus. | [PEN-012](manuels/penser-avec.md#pen-012) |
| <a id="tu-mod-48"></a>`TU-MOD-48` | texts in several languages: each read in its own (stopwords, plurals); motifs find English plurals too | La langue d'un texte est devinée ; mots vides et pluriels anglais traités dans un texte anglais ; règles françaises dans un texte français ; les motifs trouvent les pluriels des deux langues. | [PEN-012](manuels/penser-avec.md#pen-012) |
| <a id="tu-mod-49"></a>`TU-MOD-49` | links: derive, contradict, backlinks, tensions resolved by a synthesis of both | Lien de type inconnu ou mal formé refusé ; « dériver » relie la prochaine entrée ; lien entrant « a donné » ; tension ouverte puis levée par une synthèse des deux ; cible supprimée « (supprimé) » ; lien piégé refusé à l'import. | [PEN-003](manuels/penser-avec.md#pen-003), [PEN-004](manuels/penser-avec.md#pen-004), [PEN-005](manuels/penser-avec.md#pen-005) |
| <a id="tu-mod-50"></a>`TU-MOD-50` | links: a filed note carries its links and the links aimed at it follow it | Une note rangée emporte ses liens sortants, et les liens qui la visaient la suivent. | [PEN-005](manuels/penser-avec.md#pen-005) |
| <a id="tu-mod-51"></a>`TU-MOD-51` | links: added on two devices to the same entry, both survive the merge | Deux liens ajoutés à la même entrée sur deux appareils survivent tous deux à la fusion. | [SYN-002](manuels/synchronisation.md#syn-002) |
| <a id="tu-mod-52"></a>`TU-MOD-52` | dossier: dated, labelled entries with status, provenance and links as internal cross-references | Le dossier : entrées datées et étiquetées, statut, provenance, liens en renvois internes numérotés, en-tête YAML et préambule. | [PEN-008](manuels/penser-avec.md#pen-008) |
| <a id="tu-mod-53"></a>`TU-MOD-53` | dossier de passation : les sources qui documentent une entrée, en références avec leur DOI | Le dossier cite les sources qui documentent une entrée (`[S1]`, `[S2]`, numérotées à la première citation) et les liste en références avec leur DOI ; sans source, pas de section. | [PEN-008](manuels/penser-avec.md#pen-008) |
| <a id="tu-mod-54"></a>`TU-MOD-54` | long lists show a hundred items, then « voir les suivants » | Une liste de 250 notes en montre 100, du plus récent, puis « Voir les 100 suivants (150 de plus) », jusqu'à tout montrer. | [NAV-006](manuels/navigation-reglages.md#nav-006), [MOD-025](manuels/types-de-module.md#mod-025) |
| <a id="tu-mod-55"></a>`TU-MOD-55` | arc: placing, empty stations stay visible, removal, station lifecycle | Trois étapes de départ ; fragments et éléments de collection placables, pas les motifs ; étapes vides affichées « Vide. » ; retrait, renommage, cible supprimée ; placements et étapes piégés refusés à l'import. | [MOD-021](manuels/types-de-module.md#mod-021) |
| <a id="tu-mod-56"></a>`TU-MOD-56` | tiers: criteria are self-written and self-checked, the app never advances a tier on its own | Paliers invisibles tant qu'on n'en ajoute pas ; critère vidé supprimé ; cocher n'avance jamais ; « Passer au palier suivant » date le passage ; une décision préremplie s'ouvre sans rien enregistrer avant validation. | [MOD-008](manuels/types-de-module.md#mod-008) |
| <a id="tu-mod-57"></a>`TU-MOD-57` | palimpsest: editing a fragment keeps its earlier text, capped, visible in place | Texte identique ou vide : pas une modification ; chaque modification garde l'ancienne version, dix au plus (la plus ancienne perdue) ; affichage « modifié aujourd'hui », « 10 versions antérieures » ; versions piégées refusées. | [MOD-012](manuels/types-de-module.md#mod-012) |
| <a id="tu-mod-58"></a>`TU-MOD-58` | sortes: only what has been silent long enough is drawn, weighted by how long | Seul ce qui dort depuis 14 jours au moins est tiré ; une retouche le sort du bassin ; un module désactivé n'apporte rien ; tensions et motifs en jachère entrent, pas un motif jamais rencontré ni épuisé. | [ESP-006](manuels/espaces.md#esp-006), [PEN-009](manuels/penser-avec.md#pen-009) |
| <a id="tu-mod-59"></a>`TU-MOD-59` | lunar test: the Rayleigh statistic tells concentrated activity from spread activity, honestly | Sous 40 événements : « Pas assez de matière… » ; activité concentrée : R > 0,9 et p < 0,001 près de la pleine lune ; répartie : non significatif (« La lune plaide non coupable »). | [PEN-011](manuels/penser-avec.md#pen-011) |
| <a id="tu-mod-60"></a>`TU-MOD-60` | sortes : une source gardée et reliée à rien entre au bassin ; reliée, elle en sort | Une source gardée et reliée à rien entre au bassin des sortes (sans date : au seuil de 14 jours) ; reliée, elle en sort ; date `kept` piégée refusée. | [PEN-009](manuels/penser-avec.md#pen-009) |
| <a id="tu-mod-61"></a>`TU-MOD-61` | new templates contain no personal data or imposed budget and care presets | Les modèles ne contiennent aucune entrée ni donnée personnelle, ni enveloppe ni soin imposés. | [ESP-001](manuels/espaces.md#esp-001) |
| <a id="tu-mod-62"></a>`TU-MOD-62` | programme installation waits for a chosen practice and validates its settings | Le modèle Protocole ne crée rien tant que le formulaire n'est pas validé ; 9 séances par semaine refusées ; les valeurs saisies sont gardées. | [ESP-004](manuels/espaces.md#esp-004) |
| <a id="tu-mod-63"></a>`TU-MOD-63` | l’adresse d’un espace désactivé mène à l’accueil, et le dit une fois par visite ; une adresse inconnue, sans un mot | Ouvert, l'espace s'affiche ; désactivé, son adresse mène à l'accueil et « « Chantier » est désactivé : Réglages → Espaces pour le rouvrir. » s'affiche une fois (un autre rendu ne le répète pas, revenir à l'adresse le redit) ; une adresse qui ne désigne aucun espace mène à l'accueil sans message. | [ESP-006](manuels/espaces.md#esp-006) |
| <a id="tu-mod-64"></a>`TU-MOD-64` | minuit : chaque vue suit la date d’elle-même, une minute après au plus ; jamais sous un formulaire ouvert ni pendant une saisie | Horloge simulée : sur le Chantier, rien avant minuit ; passé minuit, pas de rendu tant qu'un formulaire est ouvert (son contenu reste) ou qu'un champ est en cours de saisie ; la minute suivante, l'en-tête dit « mercredi 7 octobre » ; ensuite, plus de rendu à chaque minute. | [TRV-004](manuels/transverse.md#trv-004) |
| <a id="tu-mod-65"></a>`TU-MOD-65` | une entrée se nomme par son titre, sinon par son texte : une source, pas par son résumé (A28) | Une source gardée avec un résumé se nomme par son titre, dans `excerpt` comme dans un lien (`refHTML`) ; une note, qui n'a pas de titre, par son texte, espaces resserrés ; une entrée au titre vide, par son texte. Échoue sans le correctif d'A28. | [EXT-001](manuels/connexions.md#ext-001), [EXT-016](manuels/connexions.md#ext-016) |
| <a id="tu-mod-66"></a>`TU-MOD-66` | une synchro pendant une frappe dans un champ sans identifiant ne redessine pas la vue, dans toutes les vues (A33) | Une vue ouverte (le Chantier, les Réglages), le focus dans un champ sans identifiant : un rendu (synchro, autre onglet) laisse la vue telle quelle ; un champ à identifiant, lui, est restauré et la vue se redessine (hors Réglages). Échoue sans le correctif d'A33. | [SYN-001](manuels/synchronisation.md#syn-001), [EXT-014](manuels/connexions.md#ext-014) |

### Notes Markdown (Obsidian, Zettlr) — `tests/markdown.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/markdown.js` (`frontMatter`, `mdNote`, `mdImport`).
- **Simulé** : Rien.
- **Limites** : La lecture des fichiers par le navigateur (`File.text()`) est hors de ces tests ; voir `TN-import-markdown` et l'anomalie A8.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-mkd-01"></a>`TU-MKD-01` | en-tête YAML : clés, guillemets, listes en ligne et en lignes ; sans en-tête, le texte tel quel | L'en-tête YAML (clés, guillemets, listes en ligne ou en lignes, fins de ligne Windows, marque d'ordre des octets) ; sans en-tête, le texte tel quel. | [MOD-026](manuels/types-de-module.md#mod-026) |
| <a id="tu-mkd-02"></a>`TU-MKD-02` | une note : titre (en-tête, puis « # », puis nom), corps sans le titre répété, date, statut | Titre pris dans l'en-tête, puis le premier « # », puis le nom ; corps sans titre répété ni lignes vides en trop ; date de l'en-tête, du nom, d'un identifiant Zettelkasten, sinon du fichier ; une date impossible refusée ; statut épistémique en français ou en anglais. | [MOD-026](manuels/types-de-module.md#mod-026) |
| <a id="tu-mkd-03"></a>`TU-MKD-03` | liens [[…]] : l’alias ou la cible dans le texte, une image intégrée retirée, commentaires effacés | Un lien `[[…]]` laisse son alias ou sa cible dans le texte ; une image intégrée et les commentaires (`%% %%`, `<!-- -->`) disparaissent ; une note trop longue est coupée, et marquée comme telle. | [MOD-026](manuels/types-de-module.md#mod-026) |
| <a id="tu-mkd-04"></a>`TU-MKD-04` | un coffre : Markdown seul, hors .obsidian et .trash, doublons écartés, ordre des dates, liens résolus | Un coffre : seulement les `.md`, hors `.obsidian` et `.trash`, doublons écartés, notes dans l'ordre des dates, liens résolus par titre ou alias (ni vers soi, ni vers une note inconnue, ni deux fois), liens vers une note déjà importée retrouvés sans la recréer. | [MOD-026](manuels/types-de-module.md#mod-026) |
| <a id="tu-mkd-05"></a>`TU-MKD-05` | lire les fichiers choisis : un fichier illisible n’empêche pas les autres, et il est compté | Un fichier dont la lecture échoue (ou qui n'a pas de `text()`) n'empêche pas la lecture des autres, qui gardent leur ordre et leur chemin ; il est compté ; aucun fichier lisible : zéro lu, le nombre d'illisibles ; liste vide ou absente sans erreur. | [MOD-026](manuels/types-de-module.md#mod-026) |

### MusicBrainz — `tests/musique.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/musique.js`.
- **Simulé** : Réponses MusicBrainz fabriquées.
- **Limites** : L'API réelle et son quota (une requête par seconde) ne sont pas appelés.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-mus-01"></a>`TU-MUS-01` | recherche d’artiste : le nom entre guillemets, sans casser la syntaxe | La recherche d'artiste met le nom entre guillemets et échappe les guillemets. | [EXT-005](manuels/connexions.md#ext-005) |
| <a id="tu-mus-02"></a>`TU-MUS-02` | discographie : albums et EP studio seulement, du plus ancien au plus récent, sans doublon | Discographie : albums et EP studio, du plus ancien au plus récent, sans doublon ; parutions après une date (date partielle = premier jour). | [EXT-005](manuels/connexions.md#ext-005) |
| <a id="tu-mus-03"></a>`TU-MUS-03` | pochettes et validation : un identifiant MusicBrainz ou rien | L'adresse de pochette n'accepte qu'un identifiant MusicBrainz ; la référence `mb` est validée. | [EXT-005](manuels/connexions.md#ext-005) |

### Amorçage des coquilles natives — `tests/native-boot.test.js`

- **Niveau** : Intégration simulée (I-N). **Sujet** : `src/native/boot.js`.
- **Simulé** : Faux plugins Capacitor (fichiers, trousseau, notifications, widget) et faux `invoke` Tauri, dans une VM.
- **Limites** : Aucun appareil, aucun vrai plugin : le comportement des systèmes (Android, iOS, Windows) reste à essayer à la main.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-nat-01"></a>`TU-NAT-01` | hors d’une coquille native : rien | Hors coquille native, l'amorçage ne fait rien. | — |
| <a id="tu-nat-02"></a>`TU-NAT-02` | storage : un fichier par clé, écrit par un temporaire renommé, relu tel quel | Un fichier par clé, écrit dans un temporaire puis renommé, relu tel quel ; premier lancement : dossier créé. | [PLT-003](manuels/plateformes.md#plt-003) |
| <a id="tu-nat-03"></a>`TU-NAT-03` | storage : une coupure avant le renommage laisse la dernière écriture complète, jamais un fichier à moitié | Une coupure avant le renommage laisse la dernière écriture complète. | [PLT-003](manuels/plateformes.md#plt-003) |
| <a id="tu-nat-04"></a>`TU-NAT-04` | secrets : dans le trousseau, sous le préfixe selene: | Les secrets vont dans le trousseau sous le préfixe `selene:` ; seuls les siens sont relus. | — |
| <a id="tu-nat-05"></a>`TU-NAT-05` | bouton retour : l’historique, sinon quitter ; mise en pause : pagehide | Bouton retour : l'historique, sinon quitter ; mise en arrière-plan : `pagehide` (qui envoie ce qui attend). | [PLT-004](manuels/plateformes.md#plt-004), [PLT-012](manuels/plateformes.md#plt-012) |
| <a id="tu-nat-06"></a>`TU-NAT-06` | Tauri : les coffres passent par les six commandes de l’app, avec leurs arguments | Sous Tauri, les coffres passent par les six commandes avec leurs arguments. | [PLT-009](manuels/plateformes.md#plt-009) |
| <a id="tu-nat-07"></a>`TU-NAT-07` | liens selene:// (iOS, Android) : partage rangé dans la file, capture relayée, autres ignorés | Un lien `selene://share` est rangé pour la page (`selene-share`), `selene://capture` relayé ; les autres schémas ignorés. | [EXT-017](manuels/connexions.md#ext-017), [PLT-004](manuels/plateformes.md#plt-004), [PLT-008](manuels/plateformes.md#plt-008) |
| <a id="tu-nat-08"></a>`TU-NAT-08` | notifications : la liste donnée remplace tout ce qui était programmé, avec de vraies dates ; haptique légère | La liste de notifications remplace tout ce qui était programmé, avec de vraies dates (`Date`) ; liste vide = tout annuler ; retour haptique léger. | [PLT-005](manuels/plateformes.md#plt-005) |
| <a id="tu-nat-09"></a>`TU-NAT-09` | widget (Android) : la lune et des lignes de texte, rien d’autre, vers le plugin de l’app | Le widget Android reçoit la lune et des lignes de texte, rien d'autre. | [PLT-006](manuels/plateformes.md#plt-006) |
| <a id="tu-nat-10"></a>`TU-NAT-10` | fichiers donnés : écrits dans le cache de l’app, un seul à la fois, puis confiés à la feuille de partage | Un export est écrit dans le cache de l'app puis confié à la feuille de partage ; au lancement et avant chaque export, l'ancien est effacé ; un nom piégé ne sort pas du dossier ; une feuille refermée remonte à la page comme un refus. | [PLT-013](manuels/plateformes.md#plt-013) |

### Couche plateforme : stockage, secrets, secours — `tests/platform.test.js`

- **Niveau** : Intégration simulée (I-P). **Sujet** : `src/platform.js`.
- **Simulé** : `platform.js` traduit en CommonJS (esbuild), évalué avec de faux `localStorage`, IndexedDB et coffres.
- **Limites** : IndexedDB est simulé ; le vrai navigateur est dans `TN-indexeddb` et `TN-secours`.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-plt-01"></a>`TU-PLT-01` | seul platform.js touche au stockage du navigateur, à window.claude et à navigator.storage | Seul `platform.js` touche à `localStorage`, `sessionStorage`, `window.claude` et `navigator.storage`. | — |
| <a id="tu-plt-02"></a>`TU-PLT-02` | les secrets (session, clés d’API, adresse privée d’agenda) ne passent jamais par platform.storage | Session, clés d'API et adresse d'agenda ne passent jamais par le stockage ordinaire. | — |
| <a id="tu-plt-03"></a>`TU-PLT-03` | web : stockage, secrets et session, lus et écrits | Sur le web : stockage, secrets et session lus et écrits ; les secrets partagent `localStorage`, la session est à part. | — |
| <a id="tu-plt-04"></a>`TU-PLT-04` | stockage refusé (navigation privée, quota) : null ou false, jamais une exception | Un stockage refusé (navigation privée, quota) rend `null` ou `false`, jamais une exception. | — |
| <a id="tu-plt-05"></a>`TU-PLT-05` | runtime : artefact claude.ai ou web, et ses espaces de noms | Le runtime distingue l'artefact claude.ai et le web, et leurs espaces de noms. | [PLT-011](manuels/plateformes.md#plt-011) |
| <a id="tu-plt-06"></a>`TU-PLT-06` | web : platform.ready démarre aussitôt, de façon synchrone (comme avant la façade) | Sur le web, l'app démarre aussitôt. | — |
| <a id="tu-plt-07"></a>`TU-PLT-07` | natif : rien ne démarre avant l’hydratation des deux coffres ; ensuite, lectures synchrones | En natif, rien ne démarre avant l'hydratation des deux coffres ; ensuite, lectures synchrones. | [PLT-003](manuels/plateformes.md#plt-003) |
| <a id="tu-plt-08"></a>`TU-PLT-08` | natif : écriture immédiate en mémoire, dans l’ordre vers le coffre, et flush attend la fin | En natif, une écriture est lue aussitôt, part dans l'ordre vers le coffre, et `flush` attend la fin. | — |
| <a id="tu-plt-09"></a>`TU-PLT-09` | natif : un coffre qui refuse une écriture ne casse rien ; un coffre illisible n’ouvre pas une app vide | Un coffre qui refuse une écriture ne casse rien ; un coffre illisible empêche le démarrage (pour ne pas écraser les données). | [PLT-003](manuels/plateformes.md#plt-003) |
| <a id="tu-plt-10"></a>`TU-PLT-10` | secours : à la fermeture, la dernière valeur de chaque clé en route, le document avant sa base ; retirée quand l’écriture aboutit | À la fermeture, la dernière valeur de chaque clé en route est copiée dans `localStorage` (document avant sa base), puis retirée quand l'écriture aboutit. | — |
| <a id="tu-plt-11"></a>`TU-PLT-11` | secours : une écriture plus récente, dans un autre onglet, retire la copie laissée par le premier | Une écriture plus récente dans un autre onglet retire la copie de secours laissée par le premier. | — |
| <a id="tu-plt-12"></a>`TU-PLT-12` | secours : une écriture refusée par IndexedDB (quota, transaction annulée) reste à sauver, jusqu’à la suivante qui aboutit | Une écriture refusée par IndexedDB reste à sauver jusqu'à la suivante qui aboutit. | — |
| <a id="tu-plt-13"></a>`TU-PLT-13` | secours : un reste refusé ici cède à une écriture qui a abouti dans un autre onglet | Un reste refusé cède à une écriture qui a abouti dans un autre onglet. | — |
| <a id="tu-plt-14"></a>`TU-PLT-14` | secours : si IndexedDB refuse de les reprendre, les copies restent pour le démarrage suivant | Si IndexedDB refuse de reprendre les copies au démarrage, elles restent pour le démarrage suivant. | — |
| <a id="tu-plt-15"></a>`TU-PLT-15` | secours : au démarrage, les copies rejoignent IndexedDB (effacements compris), puis quittent localStorage | Au démarrage, les copies rejoignent IndexedDB (effacements compris) puis quittent `localStorage`, qui ne garde que les secrets. | — |
| <a id="tu-plt-16"></a>`TU-PLT-16` | migration : les clés ordinaires passent dans IndexedDB, les secrets restent, IndexedDB l’emporte | Migration : les clés ordinaires passent de `localStorage` à IndexedDB, les secrets restent, la valeur d'IndexedDB l'emporte si elle existe. | [DON-008](manuels/donnees-sauvegardes.md#don-008) |
| <a id="tu-plt-17"></a>`TU-PLT-17` | migration : si IndexedDB refuse l’écriture, rien ne quitte localStorage | Si IndexedDB refuse la migration, rien ne quitte `localStorage`. | — |
| <a id="tu-plt-18"></a>`TU-PLT-18` | les secrets déclarés par platform sont ceux que la déconnexion efface | Les secrets déclarés par la plateforme sont exactement ceux que la déconnexion efface. | [CPT-013](manuels/entree-et-comptes.md#cpt-013) |
| <a id="tu-plt-19"></a>`TU-PLT-19` | notifications et haptique : absentes sur le web, relayées vers la coquille native | Notifications et haptique : absentes sur le web, relayées vers la coquille native. | [PLT-005](manuels/plateformes.md#plt-005) |
| <a id="tu-plt-20"></a>`TU-PLT-20` | widget : absent sur le web, relayé vers la coquille native qui en a un | Widget : absent sur le web, relayé vers la coquille qui en a un. | [PLT-006](manuels/plateformes.md#plt-006) |
| <a id="tu-plt-21"></a>`TU-PLT-21` | un démarrage impossible se dit dans la langue de l’appareil (l’anglais ou, sinon, le français) | Un démarrage impossible est annoncé dans la langue de l'appareil. | — |

### Radar culturel — `tests/radar.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/radar.js`.
- **Simulé** : Réponses OpenAgenda fabriquées.
- **Limites** : Le portail réel (champs, CORS) n'est pas appelé.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-rad-01"></a>`TU-RAD-01` | requête : la zone arrondie et deux semaines, sans aucun mot | La requête OpenAgenda porte la zone arrondie (20 km) et deux semaines, tout le jeu (`limit=-1`), triée par date, jamais les mots. | [EXT-010](manuels/connexions.md#ext-010) |
| <a id="tu-rad-02"></a>`TU-RAD-02` | réponse : champs tolérants, adresse https seulement, doublons écartés | Réponse lue avec des champs tolérants ; seules les adresses https sont gardées ; doublons écartés ; réponse invalide → liste vide. | [EXT-010](manuels/connexions.md#ext-010) |
| <a id="tu-rad-03"></a>`TU-RAD-03` | tri : tes mots sans accents ni casse, du plus tôt au plus tard, cinq au plus | Tri sur l'appareil par tes mots sans accents ni casse, du plus tôt au plus tard, cinq au plus. | [EXT-010](manuels/connexions.md#ext-010) |

### Reprendre la main — `tests/regulation.test.js`

- **Niveau** : Unitaire pur (U) puis intégration simulée (I-A, I-H). **Sujet** : `src/core/regulation.js`, `src/app/modules/regulation.js`, `src/app/state/local.js`.
- **Simulé** : Noyau pur (horloge et date passées en paramètres) ; puis `selene.html` ou `index.html` dans une VM, faux DOM, faux PostgREST pour le stockage sur l'appareil.
- **Limites** : Les formulaires sont soumis par leur fonction de rappel, sans vrai clic ; l'affichage réel est dans `TN-regulation` et `TN-regulation-appareil`.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-reg-01"></a>`TU-REG-01` | un suivi naît sans sujet ; le sujet et la première version d’objectif se choisissent ensemble, puis le sujet est figé | Un suivi naît sans sujet ; aucune saisie avant le sujet ; sujet et première version d'objectif ensemble ; ensuite le sujet est figé (`reg-subject-locked`). | [RLM-003](manuels/reprendre-la-main.md#rlm-003), [RLM-006](manuels/reprendre-la-main.md#rlm-006) |
| <a id="tu-reg-02"></a>`TU-REG-02` | les quatre sujets et les trois intentions : observer ne juge pas, réduire compare à la limite choisie, l’arrêt vise zéro | Quatre sujets × trois intentions : observer ne juge pas, réduire compare à la limite, l'arrêt vise zéro ; une journée confirmée à zéro atteint l'arrêt. | [RLM-007](manuels/reprendre-la-main.md#rlm-007) |
| <a id="tu-reg-03"></a>`TU-REG-03` | unités entières et décimales, valeurs invalides, non finies, négatives ou démesurées | « 0,25 » accepté, 0,1 + 0,2 = 0,3 ; valeurs hors pas, non finies, négatives, démesurées ou absentes refusées ; 1 440 minutes par jour au plus ; rien d'enregistré après un refus. | [RLM-005](manuels/reprendre-la-main.md#rlm-005) |
| <a id="tu-reg-04"></a>`TU-REG-04` | dates impossibles et à venir refusées pour les événements ; une date d’effet d’objectif peut être à venir | Dates impossibles ou à venir refusées pour les événements et la confirmation ; une date d'effet d'objectif peut être à venir (un an au plus), et son refus a son message (« date d'effet », jamais « consommation ») ; réduire à 0 ou 2,5 cigarettes refusé. | [RLM-007](manuels/reprendre-la-main.md#rlm-007), [RLM-014](manuels/reprendre-la-main.md#rlm-014), [RLM-015](manuels/reprendre-la-main.md#rlm-015) |
| <a id="tu-reg-05"></a>`TU-REG-05` | minuit, fuseaux et changements d’heure : des dates locales, jamais reclassées | Dates locales déclarées, jamais reclassées par le fuseau ou le changement d'heure (Paris, Los Angeles, 29 mars, 25 octobre). | [RLM-015](manuels/reprendre-la-main.md#rlm-015), [TRV-005](manuels/transverse.md#trv-005) |
| <a id="tu-reg-06"></a>`TU-REG-06` | absence de données ≠ zéro : une journée n’est complète qu’après confirmation de ce qui a été vu | Rien de noté : inconnue, pas zéro ; partielle : ni verdict ni abstinence ; zéro seulement une fois confirmé. | [RLM-008](manuels/reprendre-la-main.md#rlm-008) |
| <a id="tu-reg-07"></a>`TU-REG-07` | ajout, correction, suppression ou changement de date d’une quantité rouvrent la journée ; une note, non | Ajout, correction de quantité, suppression ou changement de date rouvrent une journée confirmée ; retoucher une note ne rouvre rien. | [RLM-009](manuels/reprendre-la-main.md#rlm-009), [RLM-011](manuels/reprendre-la-main.md#rlm-011), [RLM-013](manuels/reprendre-la-main.md#rlm-013) |
| <a id="tu-reg-08"></a>`TU-REG-08` | la confirmation refuse un instantané qui n’est plus celui que la personne a vu | Une confirmation portant un instantané qui n'est plus le bon est refusée (`reg-day-changed`), rien n'est validé. | [RLM-012](manuels/reprendre-la-main.md#rlm-012) |
| <a id="tu-reg-09"></a>`TU-REG-09` | total quotidien : jamais additionné à ses propres saisies, refusé s’il est plus bas | Le total déclaré n'ajoute que la différence ; même total → rien ; total inférieur refusé ; total à zéro n'ajoute ni ne confirme rien. | [RLM-010](manuels/reprendre-la-main.md#rlm-010) |
| <a id="tu-reg-10"></a>`TU-REG-10` | objectifs versionnés : la journée confirmée garde le sien, la nouvelle cible ne réécrit rien | À date d'effet égale, la dernière version créée ; une journée confirmée garde son objectif, même corrigée puis reconfirmée ; une version ajoutée n'en modifie aucune ; journée inconnue sans verdict. | [RLM-014](manuels/reprendre-la-main.md#rlm-014) |
| <a id="tu-reg-11"></a>`TU-REG-11` | le début du suivi borne les périodes : rien d’antérieur ne compte comme inconnu ou échec | Le début du suivi (première date connue) borne les périodes : rien d'antérieur ne compte. | [RLM-019](manuels/reprendre-la-main.md#rlm-019) |
| <a id="tu-reg-12"></a>`TU-REG-12` | comparaison de deux périodes : seulement si les couvertures sont suffisantes et voisines | Deux périodes ne se comparent qu'avec au moins quatre journées complètes chacune et deux d'écart au plus. | [RLM-019](manuels/reprendre-la-main.md#rlm-019) |
| <a id="tu-reg-13"></a>`TU-REG-13` | envie : jamais un échec ni une marque ; choisir un appui n’est pas l’avoir fait ; « je l’ai fait » ne compte qu’une fois | Une envie (même avec un appui) ne donne pas de marque ; « je l'ai fait » crée une action d'identifiant déduit, une seule fois ; sans appui choisi, rien à déclarer. | [RLM-016](manuels/reprendre-la-main.md#rlm-016) |
| <a id="tu-reg-14"></a>`TU-REG-14` | marques : une par date d’action ; ni envie, ni consommation, ni pause ; un écart ne retire rien ; une correction, si | Une marque par date d'action ; deux actions le même jour = une ; envie, consommation, pause n'en donnent pas ; un écart ne retire rien ; supprimer l'action corrige. | [RLM-018](manuels/reprendre-la-main.md#rlm-018) |
| <a id="tu-reg-15"></a>`TU-REG-15` | appuis et récompense : une action par ligne, sans doublon ; seuil borné ; récompenses masquées par défaut | Appuis une action par ligne, sans doublon, vingt au plus ; seuil de récompense 1 à 365 ; marques masquées par défaut. | [RLM-018](manuels/reprendre-la-main.md#rlm-018) |
| <a id="tu-reg-16"></a>`TU-REG-16` | pause de cinq minutes : échéance persistée, recalculée au retour, interrompue sans trace ni récompense | La pause garde son échéance absolue, se recalcule après relecture, s'affiche « terminée » puis disparaît ; ne donne rien ; modifier l'envie garde son état. | [RLM-017](manuels/reprendre-la-main.md#rlm-017) |
| <a id="tu-reg-17"></a>`TU-REG-17` | corrections : identifiant, instant de saisie et type conservés ; correction datée à part | Une correction garde l'identifiant, l'instant et le type, et porte sa date de correction ; le type ne change pas. | [RLM-011](manuels/reprendre-la-main.md#rlm-011) |
| <a id="tu-reg-18"></a>`TU-REG-18` | deux appareils hors ligne : marques dédupliquées, confirmation unique, quantité tardive qui rouvre la journée | Deux appareils hors ligne : marques dédupliquées, une seule confirmation par date ; une quantité tardive rouvre la journée confirmée de l'autre. | — |
| <a id="tu-reg-19"></a>`TU-REG-19` | deux appareils qui commencent le même suivi avec deux sujets : la fusion le signale, et la sauvegarde reste restaurable | Deux appareils qui commencent le même suivi avec deux sujets : la fusion le signale ; l'état fusionné se restaure. | — |
| <a id="tu-reg-20"></a>`TU-REG-20` | sauvegardes : un suivi complet se restaure ; un import invalide est refusé champ par champ | Un suivi complet se restaure, un suivi non configuré aussi ; vingt et un imports invalides refusés champ par champ ; version trop récente refusée. | — |
| <a id="tu-reg-21"></a>`TU-REG-21` | partage avec l’assistant désactivé à la création, depuis le modèle comme depuis un type vide | Créé depuis le modèle comme depuis un type vide, le suivi n'est pas partagé avec l'assistant ; les autres types restent partagés ; le modèle est le dernier de la liste. | [RLM-001](manuels/reprendre-la-main.md#rlm-001) |
| <a id="tu-reg-22"></a>`TU-REG-22` | confidentialité : aucune surface transversale ne lit les détails du suivi | Aucun mot du suivi n'apparaît dans le contexte de l'assistant, l'accueil (sauf « Suivi privé »), le bilan (pas même une ligne), la planche, la recherche, les motifs, le test lunaire, la dérive, les liaisons, les sortes, l'arc, le widget, le résumé du matin ; une note ne s'y range pas. | [RLM-020](manuels/reprendre-la-main.md#rlm-020) |
| <a id="tu-reg-23"></a>`TU-REG-23` | partage choisi : un résumé explicite seulement, confirmé sur son texte exact ; l’arrêt ne promet pas l’oubli | Cocher le partage ouvre le résumé exact ; annuler ne partage rien ; confirmer partage ; le résumé ne contient ni notes, ni déclencheurs, ni appuis, ni récompense. | [RLM-021](manuels/reprendre-la-main.md#rlm-021) |
| <a id="tu-reg-24"></a>`TU-REG-24` | l’écran du module : textes échappés, quatre actions, alcool informé sans répétition, export et suppression présents | L'écran échappe les textes, montre les quatre actions, ne mentionne le delirium tremens qu'une fois (replié), propose export et suppression. | [RLM-004](manuels/reprendre-la-main.md#rlm-004), [RLM-025](manuels/reprendre-la-main.md#rlm-025) |
| <a id="tu-reg-40"></a>`TU-REG-40` | mes sept derniers jours : rien de confirmé, une phrase au lieu du tableau ; sans semaine d’avant, pas sa colonne (U9) | Un suivi configuré aujourd'hui : « Mes sept derniers jours » ne montre pas de tableau mais « Rien à comparer pour l'instant… », la règle « ne vaut jamais zéro » et, dans la liste des jours, le bouton qui confirme aujourd'hui ; une journée confirmée : le tableau, une seule colonne de valeurs (six cellules), « Pas encore de semaine précédente » ; un suivi commencé il y a huit jours sans confirmation : toujours la phrase ; une journée confirmée dans la semaine d'avant : la colonne « Les 7 d'avant » (douze cellules). | [RLM-019](manuels/reprendre-la-main.md#rlm-019) |
| <a id="tu-reg-41"></a>`TU-REG-41` | A17 : un appareil sans compte qui rejoint un compte : un ancien suivi synchronisé, venu d’une sauvegarde, reste sur l’appareil ; le compte n’en reçoit que le nom | Sans compte, après l'import de `donnees/rlm-synchronise-ancien.json` : rien ne part, et c'est dit. Au versement dans un compte (session lue au démarrage, `authConnectStores`) : le serveur n'a que le talon (`device`, aucune saisie, aucun objectif, sujet effacé), ni la note ; la saisie reste sur l'appareil ; la bulle dit « … reste sur cet appareil seulement… ». | [RLM-024](manuels/reprendre-la-main.md#rlm-024) |
| <a id="tu-reg-25"></a>`TU-REG-25` | formulaire commun : un champ nombre garde ses bornes par défaut ; un champ date peut refuser l’avenir | Le formulaire commun : un champ nombre sans bornes garde `min="0" step="1"` ; un champ date peut refuser l'avenir (`max`). | [RLM-005](manuels/reprendre-la-main.md#rlm-005), [RLM-015](manuels/reprendre-la-main.md#rlm-015) |
| <a id="tu-reg-26"></a>`TU-REG-26` | sur cet appareil seulement, sans question : le serveur ne reçoit que le talon, jamais le contenu | Sur l'appareil seulement, sans question : le serveur ne reçoit que le talon (nom, présence), jamais le contenu ; le résumé partagé se lit sur la copie locale. | [RLM-022](manuels/reprendre-la-main.md#rlm-022) |
| <a id="tu-reg-27"></a>`TU-REG-27` | plus de synchronisation : ni choix du compte à la création, ni action pour y revenir | Plus de synchronisation : aucun choix « sur mon compte » à la création, stockage `device` posé sans question, aucune action ne synchronise. | [RLM-003](manuels/reprendre-la-main.md#rlm-003) |
| <a id="tu-reg-28"></a>`TU-REG-28` | un suivi encore synchronisé avec un accord : un bandeau, puis gardé sur l’appareil ; jamais l’inverse | Un suivi encore synchronisé avec un accord : bandeau ; rien ne change tant que la personne n'a pas choisi ; « garder sur cet appareil » laisse au serveur le talon, rien de perdu ; jamais l'inverse. | [RLM-024](manuels/reprendre-la-main.md#rlm-024) |
| <a id="tu-reg-29"></a>`TU-REG-29` | un suivi synchronisé d’avant la question : le même bandeau, rien ne change en silence ; sans compte, pas de question | Un suivi synchronisé d'avant la question : même bandeau, données laissées où elles sont ; sans compte, pas de question. | [RLM-024](manuels/reprendre-la-main.md#rlm-024) |
| <a id="tu-reg-30"></a>`TU-REG-30` | hors de l’offre publique : l’espace n’est proposé qu’au compte marqué personnel par le serveur | L'espace n'est proposé (accueil, Réglages) qu'au compte marqué personnel ; sans compte et sur un compte ordinaire, ni modèle ni type, et la création elle-même refuse ; les autres types restent proposés. | [RLM-001](manuels/reprendre-la-main.md#rlm-001), [RLM-002](manuels/reprendre-la-main.md#rlm-002) |
| <a id="tu-reg-31"></a>`TU-REG-31` | un autre appareil du compte : le nom seulement ; les données renvoyées reviennent au détenteur ; retirer le nom ailleurs | Un autre appareil voit le nom seulement ; les données renvoyées par un appareil resté hors ligne reviennent au détenteur ; retirer le nom ailleurs : le détenteur le recrée sans perte ; détenteur disparu : retrait définitif. | [RLM-022](manuels/reprendre-la-main.md#rlm-022), [RLM-026](manuels/reprendre-la-main.md#rlm-026) |
| <a id="tu-reg-39"></a>`TU-REG-39` | l’appareil détenteur se reconnaît : le talon dit le navigateur et le système, et depuis quand ; vidé, on le lit sur lui-même | `describeDevice` (Chrome, Edge, Firefox, Safari, l'app ; Windows, Linux, iPhone, Mac, Android) ; le talon envoyé au compte porte « Chrome · Windows » et la date, rien du contenu, et ne se réécrit pas à chaque synchronisation ; le même navigateur vidé (nouvelle identité) lit « Il le garde sur : Chrome · Windows, depuis le … » et ce qu'une sauvegarde complète faite ici permet ; un talon d'avant, sans description, n'a pas cette phrase. | [RLM-029](manuels/reprendre-la-main.md#rlm-029), [RLM-022](manuels/reprendre-la-main.md#rlm-022) |
| <a id="tu-reg-32"></a>`TU-REG-32` | se déconnecter avec un suivi gardé ici : exporter ou effacer, jamais une perte silencieuse | Se déconnecter avec un suivi gardé ici ouvre la garde avant tout effacement ; plus de synchronisation proposée ; rien mis de côté ni envoyé. | [RLM-023](manuels/reprendre-la-main.md#rlm-023) |
| <a id="tu-reg-38"></a>`TU-REG-38` | se déconnecter en effaçant : le nom du suivi part aussi du compte ; renoncer à la dernière confirmation ne touche à rien | Compte personnel sur serveur simulé : avant, le compte garde le talon ; « L'effacer définitivement » puis **Annuler** à la dernière confirmation : toujours connectée, contenu local intact, talon toujours sur le serveur ; puis confirmé : plus de session, plus de suivi local, et le site sur le serveur ne contient plus le module, ni sa place dans la navigation, ni le nom ni la note. Le chemin « exporter » n'est pas joué ici (le banc Node ne télécharge pas de fichier). | [RLM-023](manuels/reprendre-la-main.md#rlm-023) |
| <a id="tu-reg-33"></a>`TU-REG-33` | changement de compte sur le même appareil : les suivis locaux suivent leur compte, jamais montrés à l’autre | Changement de compte : les suivis locaux du compte précédent sont mis de côté, jamais montrés au suivant, retrouvés à son retour. | [CPT-014](manuels/entree-et-comptes.md#cpt-014), [RLM-027](manuels/reprendre-la-main.md#rlm-027) |
| <a id="tu-reg-42"></a>`TU-REG-42` | A48 : un autre compte s’est connecté puis déconnecté ; au retour, le suivi mis de côté revient | Le premier compte change de place avec un second, qui se déconnecte (le document local reste vide, sans propriétaire) ; au retour du premier, son suivi mis de côté revient entier et la mise de côté disparaît. Sans le correctif d'A48, le suivi restait de côté, invisible. | [RLM-027](manuels/reprendre-la-main.md#rlm-027) |
| <a id="tu-reg-34"></a>`TU-REG-34` | sauvegarde complète : le contenu gardé sur l’appareil y est ; restauré ailleurs, cet appareil en devient le détenteur | La sauvegarde complète contient le suivi entier (le site seul n'a que le talon) ; restaurée ailleurs, cet appareil en devient le détenteur. | [DON-001](manuels/donnees-sauvegardes.md#don-001), [RLM-025](manuels/reprendre-la-main.md#rlm-025) |
| <a id="tu-reg-35"></a>`TU-REG-35` | validation : stockage, appareil détenteur et accord ont une forme contrôlée | Stockage, appareil détenteur (et sa description : un nom de 80 caractères au plus, une date valide) et accord ont une forme contrôlée à l'import. | — |
| <a id="tu-reg-36"></a>`TU-REG-36` | résumé de l’assistant : en français, virgule décimale, 0 et 1 au singulier, sans note ni appui | Le résumé destiné à l'assistant : limite décimale en virgule (« 1,5 verre standard »), zéro et un au singulier, pluriel dès 2 (« 4,5 verres standard », « 2,25 verres standard »), jamais de point décimal ; ni notes, ni appuis ; avertissement propre à l'alcool ; les autres sujets ; un suivi non configuré. | [RLM-021](manuels/reprendre-la-main.md#rlm-021) |
| <a id="tu-reg-37"></a>`TU-REG-37` | un suivi neuf, pas encore configuré, ne se dit pas « encore synchronisé » ; il le devient sur l’appareil à la configuration | Sur un compte personnel (serveur simulé), un suivi neuf dit « Pas encore configuré : ton compte n'en garde que le nom… son contenu restera sur cet appareil seulement » et ne contient ni « Encore synchronisé », ni « depuis sa création », ni « quittera alors le serveur » ; une fois configuré (formulaire, sujet « alcool »), le texte devient « Sur cet appareil seulement. Ton compte n'en garde que le nom » et le premier a disparu. | [RLM-003](manuels/reprendre-la-main.md#rlm-003) |

### Sauvegarde chiffrée de la base — `tests/sauvegarde.test.js`

- **Niveau** : Unitaire, avec processus (U). **Sujet** : `scripts/sauvegarde.sh`, `.github/workflows/sauvegarde.yml`.
- **Simulé** : La CLI Supabase et age, remplacés en tête du `PATH` par de faux outils qui écrivent des vidages synthétiques et notent leurs arguments ; aucune base, aucun réseau.
- **Limites** : Ne prouve ni que le vrai vidage rend les comptes (`auth.users`), ni qu'une archive se restaure : c'est [TRV-017](manuels/transverse.md#trv-017). Le vrai passage est `TS-SAUVEGARDE`.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-sav-01"></a>`TU-SAV-01` | sauvegarde : rôles, schéma et données vidés, archivés, chiffrés pour la clé publique ; rien en clair ne reste | Les trois vidages (rôles, schéma, données) dans cet ordre ; un seul fichier `selene-base-<date>.tar.gz.age`, chiffré pour la clé publique donnée et contenant les trois ; le dossier temporaire des vidages en clair effacé ; le mot de passe de l'adresse jamais écrit. | [TRV-017](manuels/transverse.md#trv-017) |
| <a id="tu-sav-02"></a>`TU-SAV-02` | sauvegarde : refusée sans la table app_state, ou pour une clé privée, ou sans adresse ; jamais un fichier trompeur | Un schéma sans `public.app_state` : échec, aucun fichier, rien de chiffré, dossier temporaire effacé ; une clé privée age (`AGE-SECRET-KEY-…`) à la place de la publique : refusée avant toute lecture de la base ; sans adresse : rien n'est lu. | [TRV-017](manuels/transverse.md#trv-017) |
| <a id="tu-sav-03"></a>`TU-SAV-03` | workflow Sauvegarde : planifié et à la demande, lecture seule, actions épinglées, seul le fichier chiffré publié, 30 jours | Le workflow : planifié et à la demande ; jeton du dépôt en lecture seule ; chaque action épinglée par empreinte de commit ; l'adresse en secret, la clé publique en variable, le mot de passe masqué ; seul `*.age` publié, 30 jours au plus, échec sans fichier ; ni `set -x`, ni `--debug`, ni écho de l'adresse. | [TRV-017](manuels/transverse.md#trv-017) |

### Ciel de l'accueil — `tests/sky.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/sky.js`.
- **Simulé** : Dates et lieux fixés, météo fabriquée.
- **Limites** : Précision astronomique à quelques minutes ou degrés près ; Open-Meteo réel jamais appelé.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-sky-01"></a>`TU-SKY-01` | soleil : hauteur à Paris (solstices, minuit) | Hauteur du soleil à Paris aux solstices et à minuit. | — |
| <a id="tu-sky-02"></a>`TU-SKY-02` | soleil : lever et coucher à Paris, le 28 septembre 2026 | Lever et coucher du soleil à Paris le 28 septembre 2026, à quelques minutes près. | — |
| <a id="tu-sky-03"></a>`TU-SKY-03` | lune : la pleine lune est haute à minuit et couchée à midi | La pleine lune est haute vers minuit et couchée vers midi. | — |
| <a id="tu-sky-04"></a>`TU-SKY-04` | lune : placée dans la fenêtre, face au sud, l’est à gauche | La lune est placée face au sud, l'est à gauche (à droite dans l'hémisphère austral) ; sous l'horizon, nulle part. | — |
| <a id="tu-sky-05"></a>`TU-SKY-05` | sans lieu : longitude déduite du fuseau d’hiver | Sans lieu, la longitude est déduite du fuseau d'hiver (approximation). | [EXT-007](manuels/connexions.md#ext-007) |
| <a id="tu-sky-06"></a>`TU-SKY-06` | météo : codes WMO → sept états | Les codes météo WMO donnent sept états ; une valeur invalide, aucun. | — |
| <a id="tu-sky-07"></a>`TU-SKY-07` | scène : le texte posé sur le ciel garde 4,5:1, à toute heure, par tout temps, dans les deux modes | Le texte posé sur le ciel garde un contraste de 4,5:1 à toute heure, par tout temps, en clair et en sombre. | [TRV-006](manuels/transverse.md#trv-006) |
| <a id="tu-sky-08"></a>`TU-SKY-08` | la version hébergée autorise Open-Meteo, et rien de plus | La CSP hébergée autorise Open-Meteo, et rien de plus pour le ciel. | [EXT-007](manuels/connexions.md#ext-007), [TRV-009](manuels/transverse.md#trv-009) |
| <a id="tu-sky-09"></a>`TU-SKY-09` | scène : étoiles, halo et lune suivent la lumière réelle | Étoiles, halo et lune suivent la lumière réelle. | — |
| <a id="tu-sky-10"></a>`TU-SKY-10` | ciel vivant : le vent réel donne le sens, la vitesse et la pente | Le vent mesuré donne le sens, la vitesse et la pente du ciel vivant. | [EXT-008](manuels/connexions.md#ext-008) |
| <a id="tu-sky-11"></a>`TU-SKY-11` | saisons : la phénologie des feuillus à Lille, et à l’envers au sud | Phénologie des feuillus à Lille (débourrement, plein feuillage, rouille, nu), inversée au sud. | [EXT-008](manuels/connexions.md#ext-008) |
| <a id="tu-sky-12"></a>`TU-SKY-12` | saisons : couleurs éteintes la nuit, givre seulement s’il est mesuré | Couleurs éteintes la nuit ; givre seulement si la température mesurée est sous zéro. | [EXT-008](manuels/connexions.md#ext-008) |
| <a id="tu-sky-13"></a>`TU-SKY-13` | ciel des jours qui viennent : étoiles filantes la veille et le jour du maximum, pas après | Étoiles filantes annoncées la veille et le jour du maximum, pas après. | [EXT-009](manuels/connexions.md#ext-009) |
| <a id="tu-sky-14"></a>`TU-SKY-14` | éclipses : visibles depuis Lille, annoncées sept jours avant, jamais ailleurs | Éclipses visibles depuis Lille annoncées sept jours avant, jamais ailleurs. | [EXT-009](manuels/connexions.md#ext-009) |
| <a id="tu-sky-15"></a>`TU-SKY-15` | pluie : 1 mm ou 60 % de probabilité, dans les cinq jours | Pluie retenue à partir de 1 mm ou 60 % de probabilité, dans les cinq jours. | [EXT-009](manuels/connexions.md#ext-009) |

### Sources — `tests/sources.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/sources.js`.
- **Simulé** : Réponses Crossref et Microlink fabriquées.
- **Limites** : Services réels non appelés.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-src-01"></a>`TU-SRC-01` | adresses : traceurs retirés, fragment oublié, deux liens vers la même page reconnus | Adresses débarrassées des traceurs et du fragment ; `javascript:` refusé ; deux liens vers la même page reconnus ; lien trouvé dans un texte. | [EXT-002](manuels/connexions.md#ext-002) |
| <a id="tu-src-02"></a>`TU-SRC-02` | DOI : dans un texte, dans une adresse, sans la ponctuation qui suit ; il prime sur l’adresse | DOI trouvé dans un texte ou une adresse, sans la ponctuation qui suit, en minuscules ; il prime sur l'adresse pour la clé de doublon. | [EXT-001](manuels/connexions.md#ext-001) |
| <a id="tu-src-03"></a>`TU-SRC-03` | Crossref → source : titre, trois auteurs puis « et al. », revue, date partielle, résumé sans balises | Une réponse Crossref devient une source : titre, trois auteurs puis « et al. », revue, date partielle, résumé sans balises. | [EXT-001](manuels/connexions.md#ext-001) |
| <a id="tu-src-04"></a>`TU-SRC-04` | Microlink → source, et sans réseau : l’adresse seule | Une réponse Microlink devient une source ; sans réseau, l'adresse seule. | [EXT-003](manuels/connexions.md#ext-003) |
| <a id="tu-src-05"></a>`TU-SRC-05` | validation : jamais un lien exécutable, un DOI et une date bien formés | La validation refuse un lien exécutable, un DOI ou une date mal formés. | — |

### Synchronisation entre appareils — `tests/sync.test.js`

- **Niveau** : Intégration simulée (I-H). **Sujet** : `src/app/state/store.js`, `src/core/sync.js`, `services/auth.js`.
- **Simulé** : Plusieurs « appareils » (un stockage chacun) qui partagent un faux PostgREST en mémoire, avec écriture conditionnelle ; minuteurs déclenchés à la main.
- **Limites** : Ni vrai réseau, ni vrai Supabase, ni deux vrais navigateurs (voir `TN-sync-deux-appareils`) ; le délai de 30 s n'est pas attendu, le relevé est déclenché à la main.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-syn-01"></a>`TU-SYN-01` | a fresh device adopts the server as is, without duplicating seeded items | Un appareil neuf adopte le serveur tel quel, sans dupliquer les éléments de départ. | [SYN-009](manuels/synchronisation.md#syn-009) |
| <a id="tu-syn-02"></a>`TU-SYN-02` | concurrent additions on two devices are both kept | Deux ajouts simultanés sur deux appareils sont gardés tous les deux. | [SYN-002](manuels/synchronisation.md#syn-002) |
| <a id="tu-syn-03"></a>`TU-SYN-03` | a deletion on one device and an edit on another both apply | Une suppression sur un appareil et une modification d'une autre entrée sur l'autre s'appliquent toutes deux. | [SYN-003](manuels/synchronisation.md#syn-003) |
| <a id="tu-syn-04"></a>`TU-SYN-04` | delete versus edit of the same entry keeps the edited entry (no silent loss) | Supprimée sur A, modifiée sur B : l'entrée modifiée est conservée. | [SYN-003](manuels/synchronisation.md#syn-003) |
| <a id="tu-syn-05"></a>`TU-SYN-05` | a deleted module stays deleted on the other device | Un module supprimé sur un appareil reste supprimé sur l'autre. | [ESP-007](manuels/espaces.md#esp-007), [SYN-006](manuels/synchronisation.md#syn-006) |
| <a id="tu-syn-22"></a>`TU-SYN-22` | un espace supprimé sur un appareil reste supprimé, même modifié hors ligne sur un autre, qui le dit | B modifie un espace hors ligne pendant que A le supprime par les Réglages (la confirmation dit « sur tous tes appareils ») ; une fois B synchronisé, l'espace n'existe plus nulle part, ni dans la navigation ; B affiche « « Aragog modifié » a été supprimé depuis un autre appareil ; tes modifications d'ici n'ont pas été gardées. » ; la pierre tombale ne garde pas le nom ; un nouvel espace du même nom vit, sous un autre identifiant. | [SYN-006](manuels/synchronisation.md#syn-006), [ESP-007](manuels/espaces.md#esp-007) |
| <a id="tu-syn-23"></a>`TU-SYN-23` | les pierres tombales : sans compte, la confirmation ne parle pas d’autres appareils ; au-delà de 400 jours, elles s’effacent | `deleteModuleInstance` pose une empreinte (`t` + 16 chiffres hexadécimaux), pas l'identifiant ; `buryDeleted` retire un espace qu'une fusion aurait gardé, avec son nom, ses groupes et son partage ; une pierre tombale de plus de 400 jours s'efface ; sans compte, la confirmation ne dit pas « sur tous tes appareils ». | [SYN-006](manuels/synchronisation.md#syn-006) |
| <a id="tu-syn-06"></a>`TU-SYN-06` | a write that races another device is refused, re-read and merged (compare-and-swap) | Une écriture en concurrence est refusée par la condition, relue, refusionnée, réessayée. | — |
| <a id="tu-syn-07"></a>`TU-SYN-07` | edits made offline are kept locally and pushed once back online | Hors ligne : « Non synchronisé », la saisie est dans le stockage local et marquée en attente ; au retour, elle part. | [SYN-004](manuels/synchronisation.md#syn-004) |
| <a id="tu-syn-08"></a>`TU-SYN-08` | polling brings remote changes without writing anything back | Le relevé périodique apporte les changements distants sans rien réécrire. | [SYN-001](manuels/synchronisation.md#syn-001) |
| <a id="tu-syn-09"></a>`TU-SYN-09` | an idle poll reads only the date of the last write, not the document | Un relevé sans changement ne lit que la date de la dernière écriture ; un changement fait relire le seul document changé. | [SYN-001](manuels/synchronisation.md#syn-001) |
| <a id="tu-syn-10"></a>`TU-SYN-10` | a poll still pushes edits that could not be sent, even when the server has nothing new | Un relevé pousse ce qui n'avait pas pu partir, même si le serveur n'a rien de neuf. | [SYN-004](manuels/synchronisation.md#syn-004) |
| <a id="tu-syn-11"></a>`TU-SYN-11` | a document the server refuses as too large stays local, and the status says why | Un document refusé comme trop volumineux (code 23514) reste local, l'indicateur dit « Trop volumineux pour le serveur ». | — |
| <a id="tu-syn-12"></a>`TU-SYN-12` | closing the page: a small document leaves in one keepalive write; past 64 KiB none is tried, and the sync stays planned | À la fermeture, un petit document part en une écriture `keepalive` ; au-delà de 64 Kio, aucune n'est tentée et la synchro reste prévue. | [SYN-005](manuels/synchronisation.md#syn-005) |
| <a id="tu-syn-13"></a>`TU-SYN-13` | signing out pushes pending edits first, then stops every poller | Se déconnecter pousse d'abord ce qui attend, puis arrête tous les minuteurs ; la base de l'ancien compte est effacée. | [CPT-013](manuels/entree-et-comptes.md#cpt-013), [CPT-014](manuels/entree-et-comptes.md#cpt-014) |
| <a id="tu-syn-14"></a>`TU-SYN-14` | without a base, a device with real local data merges instead of being overwritten | Sans base, un appareil qui a de vraies données locales fusionne au lieu d'être écrasé. | [CPT-005](manuels/entree-et-comptes.md#cpt-005) |
| <a id="tu-syn-15"></a>`TU-SYN-15` | importing a backup replaces the account state instead of merging into it | Importer une sauvegarde remplace l'état du compte au lieu de fusionner. | [DON-002](manuels/donnees-sauvegardes.md#don-002), [DON-003](manuels/donnees-sauvegardes.md#don-003) |
| <a id="tu-syn-16"></a>`TU-SYN-16` | an outdated app never merges into data written by a newer schema | Une version ancienne ne fusionne jamais dans des données d'un format plus récent : rien d'écrit, « recharge la page », saisie locale gardée. | [SYN-007](manuels/synchronisation.md#syn-007) |
| <a id="tu-syn-17"></a>`TU-SYN-17` | signing out removes the chat history and the API key from the device | Se déconnecter efface de l'appareil la conversation, l'ancienne clé API et les brouillons. | [CPT-013](manuels/entree-et-comptes.md#cpt-013), [AST-008](manuels/assistant.md#ast-008) |
| <a id="tu-syn-18"></a>`TU-SYN-18` | tasks still written to the old board document (outdated app) land in the Chantier module | Des tâches encore écrites dans l'ancien document `board` par une vieille version arrivent dans le module Chantier. | — |
| <a id="tu-syn-19"></a>`TU-SYN-19` | a task deleted after the migration is not resurrected by a new device | Une tâche supprimée après la migration n'est pas ressuscitée par un nouvel appareil. | — |
| <a id="tu-syn-20"></a>`TU-SYN-20` | pre-format-6 device: its local board tasks move into the Chantier module at load | Un appareil d'avant le format 6 verse ses tâches locales dans le Chantier au chargement. | [DON-006](manuels/donnees-sauvegardes.md#don-006) |
| <a id="tu-syn-21"></a>`TU-SYN-21` | a new device meeting pre-format-6 data on the server: tasks absorbed, nothing duplicated | Un nouvel appareil face à des données d'avant le format 6 sur le serveur : tâches absorbées, rien de dupliqué. | [SYN-009](manuels/synchronisation.md#syn-009) |

### Veille OpenAlex — `tests/veille.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/veille.js`.
- **Simulé** : Réponses OpenAlex fabriquées.
- **Limites** : API réelle non appelée.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-vei-01"></a>`TU-VEI-01` | ce que l’on suit : un ORCID, un identifiant OpenAlex, sinon une recherche | Ce que l'on suit : un ORCID, un identifiant OpenAlex, sinon une recherche (200 caractères au plus). | [EXT-014](manuels/connexions.md#ext-014) |
| <a id="tu-vei-02"></a>`TU-VEI-02` | requête : depuis une date, la plus récente d’abord, la clé seulement si elle existe | Requête OpenAlex depuis une date, la plus récente d'abord, clé seulement si elle existe. | [EXT-014](manuels/connexions.md#ext-014) |
| <a id="tu-vei-03"></a>`TU-VEI-03` | résultats : résumé remis en ordre, DOI, revue et auteurs ; le reste écarté | Résultats : résumé remis en ordre, DOI, revue, auteurs ; le reste écarté. | [EXT-014](manuels/connexions.md#ext-014) |
| <a id="tu-vei-04"></a>`TU-VEI-04` | cité par tes sources : les requêtes, par lots de cinquante, sans DOI douteux | « Cité par tes sources » : requêtes par lots de cinquante DOI, sans DOI douteux. | [EXT-018](manuels/connexions.md#ext-018) |
| <a id="tu-vei-05"></a>`TU-VEI-05` | cité par tes sources : une notice → identifiant, références, auteurs | Une notice OpenAlex donne identifiant, références et auteurs. | [EXT-018](manuels/connexions.md#ext-018) |
| <a id="tu-vei-06"></a>`TU-VEI-06` | cité par tes sources : références communes, couplage bibliographique, auteurs qui reviennent | Références communes (au moins deux sources), couplage bibliographique (deux références partagées), auteurs qui reviennent. | [EXT-018](manuels/connexions.md#ext-018) |

### Zotero — `tests/zotero.test.js`

- **Niveau** : Unitaire pur (U). **Sujet** : `src/core/zotero.js`.
- **Simulé** : Réponses Zotero fabriquées.
- **Limites** : API réelle non appelée.

| Identifiant | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|
| <a id="tu-zot-01"></a>`TU-ZOT-01` | clé : à qui, et si elle peut écrire | La clé : à qui elle est, et si elle peut écrire. | [EXT-016](manuels/connexions.md#ext-016) |
| <a id="tu-zot-02"></a>`TU-ZOT-02` | fiche : titre, auteurs, revue, date normalisée, DOI, lien vers la fiche ; pièces jointes écartées | Une fiche Zotero devient une source (titre, auteurs, revue, date, DOI, lien vers la fiche) ; pièces jointes et fiches invalides écartées. | [EXT-016](manuels/connexions.md#ext-016) |
| <a id="tu-zot-03"></a>`TU-ZOT-03` | validation : une clé Zotero de huit caractères, un lien vers zotero.org seulement | Validation : clé de huit caractères majuscules, lien vers zotero.org seulement. | [EXT-016](manuels/connexions.md#ext-016) |

## Scénarios de navigateur

Commande : `npm run test:browser` (tous, après `build:dist`) ou `npm run test:browser -- <nom>` ; `SELENE_BROWSER=webkit`
pour WebKit, `SELENE_BROWSER=firefox` pour Firefox. En CI : *Check › browser*, Chromium, WebKit et Firefox (non bloquant jusqu'au 20 octobre 2026), à chaque PR et avant chaque déploiement. Données : le jeu
d'essai `tests/fixtures/site-demo.json` (format 6, migré au chargement) sauf mention ; navigateur en `fr-FR` sauf mention.
Un identifiant par fichier ; les comportements qu'il distingue sont listés, chacun repérable par le message de sa
vérification dans le code. Mode : A (artefact simulé), H (hébergé, faux Supabase), N (coquille simulée), P (page
publique) ; écran : T téléphone, O ordinateur.


<a id="tn-sans-compte"></a>
#### `TN-sans-compte` — Écran d'entrée et Selene sans compte

- **Fichier** : [`tests/browser/sans-compte.js`](../../tests/browser/sans-compte.js) · **mode** H · **écran** O
- **Conditions** : Écran d'entrée sans session ; faux Supabase en mémoire.
- **Vérifie** : l'écran d'entrée dit la promesse, la lune du jour, pas de minuteur ; chacun de ses textes, la phrase, les trois puces, « Commencer sans compte » et sa phrase, le panneau du compte, ses champs et ses boutons ; la promesse à gauche sur ordinateur, en haut à 390 px, sans défilement horizontal, chaque bouton dans l'écran (CPT-001) ; « Commencer sans compte » ouvre l'app et sa première question ; le choix survit au rechargement, et à l'onglet fermé puis rouvert (CPT-002) ; rien de ce qui est écrit ne part au serveur : ni `app_state` ni `activite`, rien que la lecture des inscriptions ; Réglages → Compte : ce que veut dire « sans compte », effacer le navigateur efface tout, exporter de temps en temps ; l'assistant demande un compte ; revenir de l'écran d'entrée laisse l'espace à l'identique ; créer un compte verse la capture et l'espace Écriture dans le compte neuf ; le choix « sans compte » s'efface ; se connecter à un compte existant : capture gardée, espaces des deux côtés gardés, réglages du compte appliqués ; la capture dit « Gardé. Tu peux oublier, c'est écrit. » et se retrouve dans la boîte après rechargement (CPT-002).
- **Limites** : Supabase Auth et PostgREST simulés.
- **Cas manuels** : [CPT-001](manuels/entree-et-comptes.md#cpt-001), [CPT-002](manuels/entree-et-comptes.md#cpt-002), [CPT-003](manuels/entree-et-comptes.md#cpt-003), [CPT-004](manuels/entree-et-comptes.md#cpt-004), [CPT-005](manuels/entree-et-comptes.md#cpt-005), [AST-001](manuels/assistant.md#ast-001)

<a id="tn-mot-de-passe"></a>
#### `TN-mot-de-passe` — Mot de passe, invitation, messages de connexion

- **Fichier** : [`tests/browser/mot-de-passe.js`](../../tests/browser/mot-de-passe.js) · **mode** H · **écran** O
- **Conditions** : Faux Supabase Auth (recover, verify, user, settings).
- **Vérifie** : un autre onglet enregistre pendant la frappe : l'écran se redessine, adresse, mot de passe et curseur gardés (A15) ; connexion refusée : message durable, en couleur d'alerte (`--alarm`), toujours là dix secondes plus tard, adresse gardée ; le réseau coupé pour la connexion : « Impossible de joindre le serveur. Vérifie ta connexion. » (CPT-006) ; mot de passe oublié : demande avec retour vers la page, réponse neutre ; 429 et SMTP non configuré dits en français ; inscriptions fermées lues une fois : plus de « Créer un compte » ; lien de récupération : le jeton quitte l'adresse ; deux saisies différentes refusées avant envoi ; même mot de passe dit ; lien expiré ou jeton refusé : nouvelle demande proposée ; invitation : choisir son mot de passe puis entrer ; session gardée qui attend puis reprend si on annule ; dix caractères à l'inscription ; ancien mot de passe court : on entre et Selene le dit ; changement vérifié par une connexion fraîche puis envoyé avec l'actuel ; le jeton d'une invitation quitte l'adresse ; une invitation déjà servie : « Cette invitation a expiré, ou elle a déjà servi : demande qu'on te la renvoie. » (CPT-010).
- **Limites** : Aucun e-mail réel : le contenu et la délivrabilité des courriels restent à essayer à la main.
- **Cas manuels** : [CPT-006](manuels/entree-et-comptes.md#cpt-006), [CPT-007](manuels/entree-et-comptes.md#cpt-007), [CPT-008](manuels/entree-et-comptes.md#cpt-008), [CPT-009](manuels/entree-et-comptes.md#cpt-009), [CPT-010](manuels/entree-et-comptes.md#cpt-010), [CPT-011](manuels/entree-et-comptes.md#cpt-011), [CPT-016](manuels/entree-et-comptes.md#cpt-016), [CPT-017](manuels/entree-et-comptes.md#cpt-017)

<a id="tn-compte"></a>
#### `TN-compte` — Supprimer son compte

- **Fichier** : [`tests/browser/compte.js`](../../tests/browser/compte.js) · **mode** H · **écran** O
- **Conditions** : Faux Supabase, fausse fonction `compte`.
- **Vérifie** : Réglages → Compte propose la suppression et lie la politique de confidentialité ; sans « supprimer » tapé, ou annulé à la confirmation : rien ne part ; la demande part avec la session ; un échec est dit et rien n'est effacé ; une réussite efface la session et les données de l'appareil.
- **Limites** : La fonction serveur réelle est testée à part (`TD-CPT-*`) ; jamais les deux ensemble.
- **Cas manuels** : [CPT-015](manuels/entree-et-comptes.md#cpt-015), [TRV-012](manuels/transverse.md#trv-012)

<a id="tn-activite"></a>
#### `TN-activite` — Mesure d'usage de la bêta

- **Fichier** : [`tests/browser/activite.js`](../../tests/browser/activite.js) · **mode** H · **écran** O · **état** : instable sous WebKit jusqu'à `3a79a01`, correctif confirmé (32 exécutions WebKit de la CI sans échec, 4 et 5 octobre)
- **Conditions** : Faux Supabase qui enregistre les envois à `/rest/v1/activite`.
- **Vérifie** : ouvrir ne compte pas ; une capture envoie un jour, avec la session, sans le texte ; le même jour, une fois ; rien n'est écrit sur l'appareil pour la mesure ; l'interrupteur de Réglages → Compte la coupe, même après un rechargement.
- **Limites** : Instable sous WebKit (A1, [perimetre.md](perimetre.md#anomalies-et-observations)) ; le commit `3a79a01` attend désormais 1,2 s sans requête vers Supabase avant de recharger. Stabilité à confirmer sur plusieurs exécutions WebKit de la CI.
- **Cas manuels** : [TRV-011](manuels/transverse.md#trv-011)

<a id="tn-journal"></a>
#### `TN-journal` — Journal des erreurs

- **Fichier** : [`tests/browser/journal.js`](../../tests/browser/journal.js) · **mode** H · **écran** O
- **Conditions** : Faux Supabase ; erreurs provoquées dans la page.
- **Vérifie** : une exception et une promesse rejetée partent, leur nom seulement, sans message ni compte, clé publique seule ; écran, plateforme et version envoyés ; une erreur réseau ou répétée ne part pas ; coupé dans les Réglages : plus rien, réglage gardé au rechargement.
- **Limites** : Table réelle non exercée.
- **Cas manuels** : [TRV-010](manuels/transverse.md#trv-010)

<a id="tn-navigation"></a>
#### `TN-navigation` — Navigation, palette, reprise

- **Fichier** : [`tests/browser/navigation.js`](../../tests/browser/navigation.js) · **mode** A · **écran** O puis T
- **Conditions** : 150 fragments (le plus ancien au-delà de la première page).
- **Vérifie** : ordinateur : barre latérale avec le Bilan ; domaines en titres ; ⌘K ouvre la palette (« Aller, agir, chercher… »), un espace trouvé par son nom, un texte mène à son entrée dépliée et surlignée ; la palette garde une phrase dans la boîte, lance le minuteur, ne propose que garder ou chercher quand rien n'est trouvé (C12), et Échap la ferme ; la puce ramène à la recherche telle qu'elle était ; l'accueil propose de reprendre le dernier espace et son brouillon ; « Ouvrir sur : là où j'en étais » ; téléphone : barre basse ; Espaces ouvre une feuille ; toucher un espace y mène ; Capturer garde dans la boîte ; le voile ferme ; le brouillon de capture survit à la fermeture ; téléphone : les cinq entrées de la barre dans l'ordre, « Aujourd'hui » actif sur l'accueil, la capture par ⊕ dite (NAV-001) ; ordinateur : « Aujourd'hui », « Bilan » et « Chercher » en tête de la barre latérale, les domaines en petites capitales (Spectral SC, en minuscules), et seul le lien de l'espace ouvert porte `aria-current="page"` (NAV-002) ; un mot unique, un seul résultat ; ouvert depuis la recherche, l'entrée lointaine dépliée, à l'écran, surlignée ; la puce rend la même requête et le même résultat (NAV-006). « Ouvrir sur : là où j'en étais » : « L'app rouvrira le dernier espace où tu étais. », le réglage marqué « cet appareil » ; « L'accueil » remis : « L'app s'ouvrira sur l'accueil. », et l'app rouvre sur l'accueil (NAV-011). Mutation vérifiée : `aria-current` posé sur un second lien, l'entrée ouverte sans surlignage, le message ou la marque « cet appareil » retirés, « L'accueil » non enregistré, et ces contrôles échouent.
- **Cas manuels** : [NAV-001](manuels/navigation-reglages.md#nav-001), [NAV-002](manuels/navigation-reglages.md#nav-002), [NAV-003](manuels/navigation-reglages.md#nav-003), [NAV-006](manuels/navigation-reglages.md#nav-006), [NAV-011](manuels/navigation-reglages.md#nav-011), [ESP-005](manuels/espaces.md#esp-005), [MOD-023](manuels/types-de-module.md#mod-023), [MOD-025](manuels/types-de-module.md#mod-025)

<a id="tn-interface"></a>
#### `TN-interface` — Interface : lune, rappels, actions de ligne, défilement

- **Fichier** : [`tests/browser/interface.js`](../../tests/browser/interface.js) · **mode** A · **écran** O et T
- **Conditions** : Plusieurs rappels dus ; 30 fragments.
- **Vérifie** : la lune entière même sur écran étroit ; rappels regroupés par module ; onglet actif `aria-current` ; tactile : « suppr. » caché au repos, un toucher montre les actions d'une ligne à la fois ; champs à 16 px au moins ; ordinateur : actions au survol ; chaque vue retrouve sa position ; barre latérale collante.
- **Cas manuels** : [NAV-001](manuels/navigation-reglages.md#nav-001), [NAV-002](manuels/navigation-reglages.md#nav-002), [NAV-013](manuels/navigation-reglages.md#nav-013), [MOD-013](manuels/types-de-module.md#mod-013), [TRV-003](manuels/transverse.md#trv-003)

<a id="tn-routes"></a>
#### `TN-routes` — Routes

- **Fichier** : [`tests/browser/routes.js`](../../tests/browser/routes.js) · **mode** A · **écran** —
- **Conditions** : Jeu d'essai.
- **Vérifie** : chaque route s'affiche ; `#constructor`, `#nimportequoi`, `#__proto__` ramènent à l'accueil ; un module « Réglages » ne masque pas les Réglages.
- **Cas manuels** : [NAV-012](manuels/navigation-reglages.md#nav-012)

<a id="tn-reglages"></a>
#### `TN-reglages` — Réglages en chapitres

- **Fichier** : [`tests/browser/reglages.js`](../../tests/browser/reglages.js) · **mode** A · **écran** O, T (390 et 320 px)
- **Conditions** : Jeu d'essai.
- **Vérifie** : six chapitres et un sommaire ; chaque espace une fois ; bloc déplié qui le reste ; l'objectif d'Écriture changé, gardé à l'écran et dans le stockage (NAV-007) ; infobulles au clic, jamais au seul survol, entières dans l'écran, fermées par Échap ou un clic ailleurs, et sur téléphone celle du « ? » le plus près du bord droit (NAV-008) ; le sommaire mène au chapitre, le focus suit, le chapitre lu est marqué ; premier accueil repliable et rouvrable ; rien ne déborde, même à 320 px ; « + Créer un espace » : les modèles décrits avec « Créer », « Sur mesure » et ses deux champs ; « Tableau de production » créé, dit, en colonnes ; une collection vide nommée, en liste, ses trois statuts (ESP-003) ; un type vide sans nom : « Donne un nom au module. », rien de créé ; supprimer un espace fait retaper son nom : une autre casse est refusée (« Nom incorrect, rien n'a été supprimé. »), le nom exact le supprime de la navigation et des Réglages, et il ne revient pas au rechargement (ESP-003, ESP-007). Mutation vérifiée (NAV-008) : une bulle ouverte au survol, une bulle qui n'est plus retenue au bord droit, et ces contrôles échouent.
- **Cas manuels** : [NAV-007](manuels/navigation-reglages.md#nav-007), [NAV-008](manuels/navigation-reglages.md#nav-008), [EXT-019](manuels/connexions.md#ext-019), [TRV-014](manuels/transverse.md#trv-014), [ESP-003](manuels/espaces.md#esp-003), [ESP-007](manuels/espaces.md#esp-007)

<a id="tn-langue"></a>
#### `TN-langue` — Langue de l'interface

- **Fichier** : [`tests/browser/langue.js`](../../tests/browser/langue.js) · **mode** A · **écran** O et T (375 px)
- **Conditions** : Navigateur en anglais (`en-US`), puis pseudo-langue.
- **Vérifie** : appareil en anglais : `<html lang="en">`, date, lune, navigation, bilan, recherche, budget (€12.00) en anglais ; valeurs enregistrées inchangées ; le sélecteur passe en français sans recharger, choix enregistré dans le compte ; pseudo-langue : chaque texte traduit marqué, attributs et squelette compris ; retour à l'anglais immédiat.
- **Cas manuels** : [NAV-009](manuels/navigation-reglages.md#nav-009)

<a id="tn-saisie"></a>
#### `TN-saisie` — Une saisie de réglage survit à un rendu

- **Fichier** : [`tests/browser/saisie.js`](../../tests/browser/saisie.js) · **mode** A · **écran** —
- **Conditions** : Rendu forcé pendant la frappe ; puis un rendu forcé sur un champ dont tout le texte est sélectionné (A53).
- **Vérifie** : la saisie survit au rendu ; elle est enregistrée en quittant le champ ; tout le texte sélectionné, un rendu de fond : la sélection reste entière, et la frappe la remplace (A53). Mutation vérifiée : la sélection repliée sur son début, comme avant le correctif, et ce contrôle échoue (« nouveauancien texte »).
- **Cas manuels** : [ESP-011](manuels/espaces.md#esp-011)

<a id="tn-ecran-lu"></a>
#### `TN-ecran-lu` — Ce que dit un lecteur d'écran

- **Fichier** : [`tests/browser/ecran-lu.js`](../../tests/browser/ecran-lu.js) · **mode** A · **écran** O
- **Conditions** : Clavier ; un second onglet du site, sans l'app, qui écrit dans le stockage.
- **Vérifie** : le titre de la page nomme l'écran ; Entrée sur un lien du menu met le focus au titre, sans défiler ; Tab repart du contenu ; « / » met le curseur dans la recherche ; messages d'état courts, région permanente annoncée poliment ; un rendu de fond (l'autre onglet enregistre) garde le focus sur un bouton, et Entrée ouvre alors son formulaire ; sur la case d'une tâche, même quand une autre tâche disparaît ; la tâche elle-même disparue, le focus ne passe pas à la case d'une autre (A37) ; un bouton pressé pendant que l'autre onglet enregistre : relâché, le clic ouvre son formulaire, et l'écran se redessine ensuite (A40). Mutation vérifiée : sans la restauration, ou sans l'entrée dans la signature, ces contrôles échouent ; sans l'attente du relâchement, le clic se perd et le contrôle d'A40 échoue.
- **Limites** : Aucun lecteur d'écran réel : la région et le focus sont lus dans le DOM.
- **Cas manuels** : [NAV-004](manuels/navigation-reglages.md#nav-004), [TRV-001](manuels/transverse.md#trv-001), [TRV-002](manuels/transverse.md#trv-002)

<a id="tn-compte-neuf"></a>
#### `TN-compte-neuf` — Compte neuf et modèles

- **Fichier** : [`tests/browser/compte-neuf.js`](../../tests/browser/compte-neuf.js) · **mode** A · **écran** —
- **Conditions** : Données de départ vierges.
- **Vérifie** : une question, pas de tâche fictive, rien de personnel, trois réponses ; les treize modèles derrière « Choisir moi-même » ; trois modules ajoutés visibles ; tirage au sort avec un module de tâches ; le programme porte la pratique choisie, sans budget ni soin imposé ; son formulaire, « Choisir ton sport ou ta pratique » et ses quatre libellés ; « Annuler » ne crée rien ; neuf séances refusées avec leur message ; le protocole créé pas encore commencé (ESP-004) ; « C'est bon » referme, et le bloc ne revient pas ; « Un long texte » installe Écriture, Sources et Tâches et le dit ; chaque réponse dit les trois espaces qu'elle installe (ESP-001) ; les états vides d'un compte neuf : la boîte, un espace de tâches, un Carnet (TRV-015).
- **Cas manuels** : [ESP-001](manuels/espaces.md#esp-001), [ESP-002](manuels/espaces.md#esp-002), [ESP-003](manuels/espaces.md#esp-003), [ESP-004](manuels/espaces.md#esp-004), [MOD-004](manuels/types-de-module.md#mod-004), [TRV-015](manuels/transverse.md#trv-015)

<a id="tn-types"></a>
#### `TN-types` — Chaque type par le registre

- **Fichier** : [`tests/browser/types.js`](../../tests/browser/types.js) · **mode** A · **écran** —
- **Conditions** : Jeu d'essai.
- **Vérifie** : formulaire repris du nom choisi ; séance notée, alerte et résumé fournis par le type ; catégories d'un cumul ; types et fréquences de rappels ; alerte de retard ; journal ; fragment ajouté puis supprimé après confirmation ; chaque route de module s'affiche.
- **Cas manuels** : [ESP-003](manuels/espaces.md#esp-003), [ESP-007](manuels/espaces.md#esp-007), [MOD-007](manuels/types-de-module.md#mod-007), [MOD-013](manuels/types-de-module.md#mod-013)

<a id="tn-identite"></a>
#### `TN-identite` — Identité des espaces

- **Fichier** : [`tests/browser/identite.js`](../../tests/browser/identite.js) · **mode** A · **écran** O et T
- **Conditions** : Domaines réglés ; pour ESP-008, sur téléphone, le jeu d'essai du cahier.
- **Vérifie** : sigil par espace, teinte par domaine, planche en chiffres romains ; « régler » ouvre un tiroir ; sigil choisi gardé, et le même dessin dans la navigation et en tête de l'espace ; réglage appliqué aussitôt ; Chantier renommé `Appartement` dans les Réglages : la navigation, l'accueil et l'en-tête le disent ; Musique montée de deux crans : devant ceux qu'elle a doublés dans son domaine, son numéro de planche change ; le nom vidé, l'ancien gardé (ESP-005). Mutation vérifiée : le renommage ignoré, le nom vide accepté, la planche figée, le sigil d'un autre espace en tête, et ces contrôles échouent ; trois polices ; le kanban défile dans son cadre ; formulaire plein largeur sur téléphone. Puis, sur téléphone et le jeu d'essai (ESP-008) : « régler » en tête de Tableau, un tiroir du bas, pleine largeur, l'espace dessous ; « Sous-titre » nommé `Lieu`, et le formulaire d'ajout qui le propose ; le tiroir fermé par son voile, toujours dans Tableau. Mutation vérifiée : « régler » qui mène aux Réglages sur un écran étroit, le tiroir latéral de l'ordinateur sur téléphone, le sous-titre jamais proposé, et ces contrôles échouent.
- **Cas manuels** : [ESP-005](manuels/espaces.md#esp-005), [ESP-008](manuels/espaces.md#esp-008), [TRV-014](manuels/transverse.md#trv-014)

<a id="tn-taches"></a>
#### `TN-taches` — Tâches

- **Fichier** : [`tests/browser/taches.js`](../../tests/browser/taches.js) · **mode** A · **écran** —
- **Conditions** : Données au format 5 avec un `board`.
- **Vérifie** : tâches du `board` versées dans le module, nom personnalisé gardé, `board` vidé ; échéances (« En retard de 3 j »), coûts, étapes, filtre par pièce, budget estimé ; une tâche complète ajoutée par le formulaire, sa pièce nouvelle dans le registre ; troisième tâche du jour acceptée, quatrième refusée, aussi entre deux modules, « Trois, c'est le plafond. Termine ou retire-en une. », l'étoile éteinte ; une tâche faite quitte « Aujourd'hui », l'accueil n'en montre plus que deux (MOD-002) ; le tirage, la journée pleine : « Aujourd'hui est plein. Le hasard respecte les plafonds. » ; réglages : types, coûts désactivés, « Lieu » ; une note rangée ouvre le formulaire de tâche ; « 1/2 étapes » ; un titre vide refusé par le formulaire ; la tâche et son étape cochée relues après rechargement (MOD-001).
- **Cas manuels** : [MOD-001](manuels/types-de-module.md#mod-001), [MOD-002](manuels/types-de-module.md#mod-002), [MOD-004](manuels/types-de-module.md#mod-004)

<a id="tn-budget"></a>
#### `TN-budget` — Budget

- **Fichier** : [`tests/browser/budget.js`](../../tests/browser/budget.js) · **mode** A · **écran** —
- **Conditions** : Données au format 4 (budget en section) ; puis le jeu d'essai du cahier (`jeu-essai.json`).
- **Vérifie** : revenus, dépenses, solde migrés ; jauge 40 % puis 50 % après ajout ; mois précédent vide ; clic sur une enveloppe filtre ; renommer l'enveloppe renomme ses opérations ; ajout d'enveloppe ; second budget indépendant ; résumé d'accueil ; un montant nul refusé, et dit ; un montant négatif compté en valeur absolue, le sens venant du type (MOD-005) ; sur le jeu d'essai du cahier, septembre 2026 : revenus, dépenses et solde, les jauges de Courses et de Travaux (MOD-005, étape 1) ; Courses renommée `Marché` dans les Réglages : « « Courses » s'appelle désormais « Marché ». » (A41), la jauge Marché à 120 sur 300, les opérations de septembre et d'août renommées ; supprimée après « Supprimer l'enveloppe « Marché » ? Les opérations restent. » : la jauge disparaît, les opérations restent, comptées dans les dépenses (MOD-006). Mutation vérifiée : sans le message, ou sans la suppression, ces contrôles échouent.
- **Cas manuels** : [MOD-005](manuels/types-de-module.md#mod-005), [MOD-006](manuels/types-de-module.md#mod-006), [TRV-015](manuels/transverse.md#trv-015)

<a id="tn-collections"></a>
#### `TN-collections` — Collections

- **Fichier** : [`tests/browser/collections.js`](../../tests/browser/collections.js) · **mode** A · **écran** —
- **Conditions** : Données au format 2.
- **Vérifie** : post migré dans sa colonne ; ajout, avancée jusqu'à « Publié », phrase de fin, modification ; filtre par groupe et par statut ; album sans sous-titre : « préciser album » ; champ masqué, statut ajouté et renommé, colonnes ; titre vidé → gardé ; statut supprimé après confirmation, qui le nomme et compte ses éléments, versés au statut voisin ; à deux statuts : « Deux statuts minimum : sinon rien ne peut avancer. ».
- **Cas manuels** : [MOD-017](manuels/types-de-module.md#mod-017), [MOD-018](manuels/types-de-module.md#mod-018)

<a id="tn-ecrans"></a>
#### `TN-ecrans` — Écrans : marges, tableaux, recherche

- **Fichier** : [`tests/browser/ecrans.js`](../../tests/browser/ecrans.js) · **mode** A · **écran** O et T
- **Conditions** : Jeu d'essai.
- **Vérifie** : date en marge ; registre en lignes ; glisser une carte change son statut, et la page rechargée la montre dans sa colonne ; « ] » et « [ » au clavier, focus gardé, colonne annoncée ; téléphone : une colonne à la fois par onglets ; recherche : résultats groupés par espace ; chaque puce et son nombre, « Tout statut » sans nombre (C15) ; facettes période, statut, espace, avec décomptes ; recliquer défait ; un filtre posé, « Chercher « … » partout » de la palette repart sans filtre (A38), « / » ramène la page telle qu'on l'a laissée, son filtre dit (C16).
- **Cas manuels** : [NAV-005](manuels/navigation-reglages.md#nav-005), [MOD-017](manuels/types-de-module.md#mod-017), [TRV-002](manuels/transverse.md#trv-002)

<a id="tn-notes"></a>
#### `TN-notes` — Notes et boîte de réception

- **Fichier** : [`tests/browser/notes.js`](../../tests/browser/notes.js) · **mode** A · **écran** O
- **Conditions** : Données au format 6 sans boîte désignée, puis avec ; puis le jeu d'essai, sur ordinateur (MOD-015).
- **Vérifie** : compteur de la boîte ; « à trier » sur l'accueil ; capture rapide par Entrée ; destinations selon ce que chaque type accepte ; vers le Chantier, le formulaire de tâche ; désigner une autre boîte retire l'ancienne désignation, case décochée à l'écran ; sans boîte, « Aucune boîte de réception. Coche… » à la place du champ, qui revient avec la case. Puis, sur le jeu d'essai : les destinations sous une note, sans « → Yoga » ni « → Boîte » ; « → Chantier » ouvre « Modifier la tâche », titre prérempli ; enregistrée, une seule tâche, la note partie (MOD-015). Mutation vérifiée : un programme proposé en destination, le titre non prérempli, et ces contrôles échouent.
- **Cas manuels** : [ESP-009](manuels/espaces.md#esp-009), [MOD-014](manuels/types-de-module.md#mod-014), [MOD-015](manuels/types-de-module.md#mod-015), [TRV-015](manuels/transverse.md#trv-015)

<a id="tn-import-markdown"></a>
#### `TN-import-markdown` — Venir d'Obsidian ou de Zettlr

- **Fichier** : [`tests/browser/import-markdown.js`](../../tests/browser/import-markdown.js) · **mode** A · **écran** O
- **Conditions** : Données de démonstration avec un Carnet ; trois fichiers Markdown en mémoire, puis un dossier temporaire avec `.obsidian` et une image.
- **Vérifie** : dans les réglages d'un module de notes, des fichiers ou tout un dossier ; confirmation qui dit combien, de quand à quand, où, et les liens ; annulé : rien ; importé : titre en première ligne, date de l'en-tête ou du nom, statut « hypothèse », lien remplacé par son alias, image intégrée retirée, `[[…]]` devenus « fait écho à » dans les deux sens, et le message le dit ; une note longue montre son début (« la suite ») ; paragraphes gardés ; texte piégé affiché en texte ; réimport : « Rien de nouveau », sans question ; un dossier : `.obsidian` et images laissés, un lien vers une note déjà importée la retrouve ; aucun appel réseau ; un fichier que le navigateur ne peut pas lire : ignoré et compté (« 1 fichier illisible, ignoré. »), les autres importés ; aucun lisible : un message, rien d'importé.
- **Limites** : Fichiers en mémoire ; l'échec de lecture est simulé en remplaçant `Blob.prototype.text` pour un nom de fichier (anomalie A8, corrigée : [perimetre.md](perimetre.md#anomalies-et-observations)).
- **Cas manuels** : [MOD-026](manuels/types-de-module.md#mod-026)

<a id="tn-atelier-capture"></a>
#### `TN-atelier-capture` — Atelier d'écriture et capture qui comprend

- **Fichier** : [`tests/browser/atelier-capture.js`](../../tests/browser/atelier-capture.js) · **mode** A · **écran** O
- **Conditions** : Chapitres réglés ; puis le jeu d'essai, sur ordinateur, dans un contexte à part (MOD-011) ; pour MOD-014, le jeu d'essai dans un contexte neuf, l'horloge figée au 7 octobre 2026.
- **Vérifie** : dernier chapitre présélectionné, fragments rattachés, déplacés, filtrés, export Markdown ; chapitre supprimé : fragments hors chapitre ; bandeau « 12,50 € en dépense dans Budget (Courses) ? », rangé ; proposition qui reste dans la boîte ; note ordinaire juste gardée. Puis, sur le jeu d'essai : le chapitre présélectionné, un fragment ajouté au Prologue et le compte du panneau, le filtre, l'ordre de l'export, la confirmation de la suppression et le nombre de fragments inchangé (MOD-011). Mutation vérifiée : le premier chapitre présélectionné au lieu du dernier, les fragments supprimés avec leur chapitre, l'export sans titres de chapitre, et ces contrôles échouent. Puis la capture et ses trois motifs (MOD-014) : le bandeau d'une dépense et son « Rangé : … », la dépense du jour ; une séance proposée, ignorée, puis rangée depuis la boîte ; une observation rangée dans Plantes ; « rdv : 14h… » et une note ordinaire sans bandeau ni « Ranger ». Mutation vérifiée : l'enveloppe tue, la séance non écrite, « rdv » pris pour un espace, et ces contrôles échouent.
- **Cas manuels** : [MOD-011](manuels/types-de-module.md#mod-011), [MOD-014](manuels/types-de-module.md#mod-014)

<a id="tn-quotidien"></a>
#### `TN-quotidien` — Le quotidien sur téléphone

- **Fichier** : [`tests/browser/quotidien.js`](../../tests/browser/quotidien.js) · **mode** A · **écran** T et O
- **Conditions** : Programme commencé, élément en retard ; puis, sur ordinateur, le jeu d'essai du cahier (`jeu-essai.json`), le protocole de Yoga commencé trois semaines plus tôt pour que son calendrier couvre hier ; pour MOD-013, le jeu d'essai, l'horloge figée au 7, puis au 8 octobre 2026.
- **Vérifie** : séance en un geste, élément en retard, « fait » sur un rappel, dernière durée ; paysage réduit à la deuxième ouverture du jour ; brouillon restauré puis effacé ; suppression avec « Annuler » ; écriture en total : +1 200 puis +650 ; projection ; en mode total, une coupe et un même total, avec leurs messages (MOD-009) ; sur le jeu d'essai : « 5 300 mots sur 50 000 », « Je saisis » sur « Le total atteint (l'app calcule la différence) », puis `6000`, `5800`, `5800` avec leurs trois messages et leurs totaux (MOD-009) ; « Noter 25 min » pour Yoga, « Séance de yoga faite. », une séance de 30 min hier au calendrier et au journal, les deux relues au rechargement (MOD-007) ; dans les réglages de Yoga, 600 semaines deviennent 520, −4 devient 1, 9 séances deviennent 7, et la sauvegarde exportée se réimporte (DON-010) ; le jeu tel quel, sans saisie d'Écriture depuis trente jours : « Pas assez d'élan ces 30 derniers jours pour prédire une fin. La prophétie attendra. » ; 8 300 saisis (3 000 de plus) : « Au rythme des 30 derniers jours (100 mots par jour), objectif atteint vers le … », la date calculée par le moteur (MOD-010). Puis les rappels de Plantes (MOD-013) : la ligne de l'accueil et son « fait », « Arrosage : aujourd'hui, tous les 3 j », l'observation datée, la fréquence mise à 1 et le rappel revenu le lendemain, rien pour Rempotage à fréquence 0. Mutation vérifiée : un « fait » qui ne lève pas le rappel, une fréquence 0 comptée comme 30 jours, la fréquence non enregistrée, et ces contrôles échouent.
- **Cas manuels** : [MOD-007](manuels/types-de-module.md#mod-007), [MOD-009](manuels/types-de-module.md#mod-009), [MOD-010](manuels/types-de-module.md#mod-010), [MOD-013](manuels/types-de-module.md#mod-013), [MOD-022](manuels/types-de-module.md#mod-022), [MOD-023](manuels/types-de-module.md#mod-023), [DON-010](manuels/donnees-sauvegardes.md#don-010)

<a id="tn-paliers"></a>
#### `TN-paliers` — Paliers d'un programme

- **Fichier** : [`tests/browser/paliers.js`](../../tests/browser/paliers.js) · **mode** A · **écran** T
- **Conditions** : Programme commencé.
- **Vérifie** : palier et critère affichés, rien de coché ; cocher ne fait pas avancer ; passer au palier : message, date, historique ; décision préremplie, rien d'enregistré avant validation ; suppression confirmée ; pas de débordement ; sur le jeu d'essai, Yoga : « Souffle », « 0 sur 2 critères coché. Coché ou non, rien ne fait avancer le palier à ta place. » ; les deux cochés, « 2 sur 2 critères cochés. Tous cochés. Le passage reste ton choix, pas une formalité automatique. », sans passage ; rechargé, toujours cochés ; « Passer au palier suivant » daté du jour, le formulaire « Noter la décision : « Souffle » » au titre prérempli « Palier « Souffle » atteint (Yoga) », sans bulle (C17) ; « Annuler » n'ajoute aucune décision (MOD-008). Mutation vérifiée : l'une ou l'autre phrase changée, et son contrôle échoue.
- **Cas manuels** : [MOD-008](manuels/types-de-module.md#mod-008)

<a id="tn-arc"></a>
#### `TN-arc` — Arcs

- **Fichier** : [`tests/browser/arc.js`](../../tests/browser/arc.js) · **mode** A · **écran** T et O
- **Conditions** : Un fragment ; puis le jeu d'essai, sur ordinateur (MOD-021).
- **Vérifie** : trois étapes vides visibles ; placement sous sa station ; étape renommée ; placement retiré puis rétabli par « Annuler » ; suppression d'étape confirmée (avec ses placements) ; cible supprimée dite ; résumé d'accueil. Puis, sur le jeu d'essai : un élément du Tableau placé à l'Étape 2, retiré puis remis ; la suppression de l'étape, son message, annulée puis confirmée ; l'élément resté dans Tableau (MOD-021). Mutation vérifiée : le nombre de placements tu dans la question, les placements gardés après la suppression, et ces contrôles échouent.
- **Cas manuels** : [MOD-021](manuels/types-de-module.md#mod-021)

<a id="tn-annuler"></a>
#### `TN-annuler` — « Annuler » à la portée de tous

- **Fichier** : [`tests/browser/annuler.js`](../../tests/browser/annuler.js) · **mode** A · **écran** O
- **Conditions** : Trois fragments.
- **Vérifie** : raccourci annoncé (`aria-keyshortcuts`) ; survolé ou focalisé, le message reste au-delà de six secondes ; Entrée annule ; Ctrl+Z hors d'un champ annule ; dans un champ, non ; ⌘Z aussi ; message parti : plus rien.
- **Cas manuels** : [MOD-022](manuels/types-de-module.md#mod-022), [TRV-001](manuels/transverse.md#trv-001)

<a id="tn-minuit"></a>
#### `TN-minuit` — Minuit, l'app restée ouverte

- **Fichier** : [`tests/browser/minuit.js`](../../tests/browser/minuit.js) · **mode** A · **écran** O
- **Conditions** : Horloge simulée (`page.clock`) à 23 h 58, fuseau `Europe/Paris` ; la vue Kundalini (un protocole commencé), pas l'accueil.
- **Vérifie** : avant minuit, le 6 octobre ; un formulaire ouvert avant minuit garde sa date par défaut et ses valeurs, et la page attend qu'il se ferme ; fermé, l'en-tête passe au 7 octobre une minute après au plus, sans geste, sur la même vue ; une capture faite après minuit porte la nouvelle date ; « Fuseau TRV-005 » gardée à Paris peu après minuit, datée du 7 octobre, puis la même mémoire relue au même instant à Los Angeles (encore le 6) et à Auckland : toujours « 7 oct. » (TRV-005, étapes 1 à 3 ; mutation vérifiée : la date du jour prise en UTC) ; aucune erreur JavaScript.
- **Cas manuels** : [TRV-004](manuels/transverse.md#trv-004), [TRV-005](manuels/transverse.md#trv-005)

<a id="tn-en-tete"></a>
#### `TN-en-tete` — En-tête et minuteur

- **Fichier** : [`tests/browser/en-tete.js`](../../tests/browser/en-tete.js) · **mode** A · **écran** T et O
- **Conditions** : —
- **Vérifie** : téléphone : en-tête sur une ligne (10 % de l'écran au plus), minuteur absent au repos, lancé depuis Capturer, pause, reprise, remise à zéro ; ordinateur : minuteur dans la barre latérale.
- **Cas manuels** : [MOD-024](manuels/types-de-module.md#mod-024), [TRV-014](manuels/transverse.md#trv-014)

<a id="tn-recherche-minuteur"></a>
#### `TN-recherche-minuteur` — Recherche et fin du minuteur

- **Fichier** : [`tests/browser/recherche-minuteur.js`](../../tests/browser/recherche-minuteur.js) · **mode** A · **écran** —
- **Conditions** : Horloge simulée pour quinze minutes ; puis le jeu d'essai du cahier (`jeu-essai.json`), sur ordinateur et sur téléphone.
- **Vérifie** : « / » ouvre la recherche ; sans accents, tous les mots, surlignage ; frappe continue ; fin des 15 min sur un protocole : « Noter 15 min » ; sur l'Écriture : curseur dans le compteur ; accueil sans tâche du jour : « Aucune tâche choisie. » ; le tirage : « Le sort a désigné : « … ». Pas de recours possible. », l'étoile allumée et dite (`aria-pressed`, A30) ; tâche finie : « Fait. 250,00 € estimés : les passer au budget (Travaux) ? », rien d'ajouté sans le bouton, « Ajouté à Budget. L'argent, lui, était déjà parti. », la dépense au Budget du mois ; l'onglet dit « Chercher — … » ; un mot qu'aucun texte ne contient : « Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire. » (NAV-004) ; sur le jeu d'essai : `LISIERE` tapé, les résultats groupés par espace (la Boîte, trois fragments, le motif), surlignés, la frappe sans perdre le champ ; `lisière seuil`, `lisiere zzz`, `brouillard` (le motif « brume » par sa variante) ; sur téléphone, depuis la barre basse, les mêmes résultats (NAV-004).
- **Cas manuels** : [NAV-004](manuels/navigation-reglages.md#nav-004), [MOD-003](manuels/types-de-module.md#mod-003), [MOD-024](manuels/types-de-module.md#mod-024), [TRV-015](manuels/transverse.md#trv-015), [MOD-004](manuels/types-de-module.md#mod-004)

<a id="tn-signatures"></a>
#### `TN-signatures` — Fiche, minuteur et tri

- **Fichier** : [`tests/browser/signatures.js`](../../tests/browser/signatures.js) · **mode** A · **écran** O et T
- **Conditions** : Horloge simulée.
- **Vérifie** : fiche dans un tiroir : provenance, liens entrants, motifs, histoire du statut ; changer le statut ; « Voir dans… », et le fragment y est surligné, à l'écran (PEN-007) ; anneau du minuteur à mi-course et à la fin ; appui long sur la lune ; trier : la plus ancienne d'abord, rangement reconnu, « Plus tard », supprimer avec « Annuler » visible, qui remet la note ; rangée par sigil, jusqu'à « La boîte est vide. Tout a trouvé sa place, ou presque. ».
- **Cas manuels** : [MOD-016](manuels/types-de-module.md#mod-016), [MOD-024](manuels/types-de-module.md#mod-024), [PEN-007](manuels/penser-avec.md#pen-007)

<a id="tn-pensee"></a>
#### `TN-pensee` — Statut, provenance, pont, décisions, motifs

- **Fichier** : [`tests/browser/pensee.js`](../../tests/browser/pensee.js) · **mode** A · **écran** T et O
- **Conditions** : Jeu d'essai et collections ajoutées ; pour MOD-019, PEN-001 et PEN-002, le jeu d'essai sur ordinateur, l'horloge figée au 7 octobre 2026 à 10 h à Paris.
- **Vérifie** : « ? » devant une capture : hypothèse ; provenance du fragment rangé ; statut changé et daté ; pont : « Je m'arrête ici… » sans pont ; le champ « Le prochain geste, pour la prochaine fois… » s'ouvre et prend le focus ; « Garder » : « Noté. La prochaine fois commencera ici. », le pont en haut du module ; sur l'accueil « ↳ … · aujourd'hui » ; « fait » : « Repris. Le pont est levé. », le pont disparaît de l'écran et des données ; « Annuler » le remet, à l'écran comme dans les données (PEN-006 ; mutation vérifiée sur les deux messages et la date) ; sur le jeu d'essai, la note `Des lisières et des lisérés.` gardée dans le Carnet, la jachère réglée à un jour depuis « régler » : « brume » passe « en jachère », avec ses lunaisons d'absence, « lisière », vue aujourd'hui, reste vivante, « phalène », épuisé, n'y est jamais, bien qu'absent depuis le 18 août 2026 (C18) ; la phrase dit « plus de 1 jour » (MOD-020, A42 ; mutation vérifiée : un motif épuisé admis en jachère, la phrase au pluriel) ; décision : rendez-vous ; revient sur l'accueil ; « relire » ; « maintenue » ; motifs : absent, variantes, voisins, « voir » ; bilan par statut et motifs apparus, mène à la recherche filtrée. Puis, sur le jeu d'essai, sur ordinateur, l'horloge figée au 7 octobre 2026 : la décision échue sur l'accueil, pas l'abandonnée ; « relire » ; « maintenue », sa bulle, la ligne partie, la fiche et son réexamen daté ; « Annuler » qui rétablit le rendez-vous ; la date déplacée qui note un réexamen « revue » (MOD-019) ; le message entier d'une hypothèse capturée, un « ? » qui n'est pas en tête, l'histoire du statut dans la fiche, `statut:hypothèse` et `status:hyp`, le statut du bilan de septembre qui mène à la recherche (PEN-001) ; « Ranger » qui retire la note de la boîte, la provenance en marge, et une note rangée deux fois qui garde sa première naissance (PEN-002). Mutation vérifiée : le message de « maintenue », l'annulation, le réexamen « revue », l'histoire du statut, l'abréviation `hyp`, la première naissance, et ces contrôles échouent.
- **Cas manuels** : [MOD-019](manuels/types-de-module.md#mod-019), [MOD-020](manuels/types-de-module.md#mod-020), [PEN-001](manuels/penser-avec.md#pen-001), [PEN-002](manuels/penser-avec.md#pen-002), [PEN-006](manuels/penser-avec.md#pen-006)

<a id="tn-liaisons"></a>
#### `TN-liaisons` — Liaisons et tensions

- **Fichier** : [`tests/browser/liaisons.js`](../../tests/browser/liaisons.js) · **mode** A · **écran** T
- **Conditions** : Fragments liés ; puis, sur ordinateur, le jeu d'essai du cahier (`jeu-essai.json`).
- **Vérifie** : dériver : bandeau, curseur, « Dérivé, et relié à sa source. », le bandeau parti, lien vers la source dit des deux côtés ; « contredit » : « Tension ouverte. Elle attendra sa synthèse. », listée au bilan depuis le jour, avec « résoudre » et « dossier » ; « résoudre » ouvre la synthèse qui la lève, « Synthèse gardée. La tension est levée. » ; dossier : entrées numérotées et renvois ; dossier d'une recherche ; dossier d'une tension ; sur le jeu d'essai, ce qui dérive de « La lisière n'est pas une frontière… » et qui la contredit (PEN-003), et sa tension au Bilan, « ouverte il y a N j » depuis le 15 août 2026 (PEN-004) ; le palimpseste d'un fragment modifié : le message, « modifié aujourd'hui », la version antérieure datée, rien de plus sans changement, le texte vidé refusé (MOD-012) ; une note liée « fait écho à », rangée dans Écriture avec son lien, puis la cible supprimée : « fait écho à (supprimé) » (PEN-005).
- **Cas manuels** : [PEN-003](manuels/penser-avec.md#pen-003), [PEN-004](manuels/penser-avec.md#pen-004), [PEN-008](manuels/penser-avec.md#pen-008), [MOD-012](manuels/types-de-module.md#mod-012), [PEN-005](manuels/penser-avec.md#pen-005)

<a id="tn-marges"></a>
#### `TN-marges` — Marges

- **Fichier** : [`tests/browser/marges.js`](../../tests/browser/marges.js) · **mode** A · **écran** O (1100, 1280, 1440 px) et T
- **Conditions** : Fragments avec provenance, liens, motifs.
- **Vérifie** : marge à droite, alignée ; retouche, provenance, liens, motifs qui mènent à la recherche ; largeur de texte constante ; liste étroite et téléphone : sous le texte ; aucun débordement ; texte piégé inerte.
- **Cas manuels** : [PEN-015](manuels/penser-avec.md#pen-015), [TRV-008](manuels/transverse.md#trv-008)

<a id="tn-sortes"></a>
#### `TN-sortes` — Sortes

- **Fichier** : [`tests/browser/sortes.js`](../../tests/browser/sortes.js) · **mode** A · **écran** T
- **Conditions** : Matière ancienne et récente.
- **Vérifie** : section présente, « Tirer » ; résultat d'un des trois genres ; rien de deux jours ; « Retirer ».
- **Cas manuels** : [PEN-009](manuels/penser-avec.md#pen-009)

<a id="tn-bilan"></a>
#### `TN-bilan` — Bilan

- **Fichier** : [`tests/browser/bilan.js`](../../tests/browser/bilan.js) · **mode** A · **écran** O (900 px)
- **Conditions** : Horloge figée au milieu d'un mois.
- **Vérifie** : cycle en cours : séances, mots ; mode mois et période d'avant ; remonter puis revenir ; mode retenu sur l'appareil.
- **Cas manuels** : [PEN-010](manuels/penser-avec.md#pen-010)

<a id="tn-lune"></a>
#### `TN-lune` — Test lunaire

- **Fichier** : [`tests/browser/lune.js`](../../tests/browser/lune.js) · **mode** A · **écran** T
- **Conditions** : Cinquante notes concentrées sur une phase.
- **Vérifie** : nombre d'événements annoncé ; concentration forte, p très bas ; avertissement sur les tests multiples ; sous le seuil, le bilan le dit.
- **Cas manuels** : [PEN-011](manuels/penser-avec.md#pen-011)

<a id="tn-vocabulaire"></a>
#### `TN-vocabulaire` — Dérive lexicale du bilan

- **Fichier** : [`tests/browser/vocabulaire.js`](../../tests/browser/vocabulaire.js) · **mode** A · **écran** T
- **Conditions** : Notes sur sept mois.
- **Vérifie** : comparaison aux six périodes d'avant ; émergents (pluriel ramené), absents ; aucun mot vide ; sans module Motifs, pas de « + » ; un mot mène à la recherche ; « + » en fait un motif aussitôt compté, et le dit (« … devient un motif de … On verra s'il revient. ») ; sur le jeu d'essai, le Bilan du mois en cours, sous le seuil : « Pas encore assez de textes datés pour parler de dérive : 0 texte dans la période, … (5 de chaque côté au moins). », aucun mot proposé (PEN-012, étape 1). Mutation vérifiée : la condition du seuil retirée du message, et le contrôle échoue.
- **Cas manuels** : [PEN-012](manuels/penser-avec.md#pen-012)

<a id="tn-planche"></a>
#### `TN-planche` — Planche de lunaison

- **Fichier** : [`tests/browser/planche.js`](../../tests/browser/planche.js) · **mode** A · **écran** O et T · **état** : conditionnel (une vérification Chromium seulement)
- **Conditions** : Lunaison de Meeus calculée.
- **Vérifie** : numéro, règle, quartiers, ligne par espace, motifs apparus, « Venu du dehors », statuts, tension ; lunaison précédente et retour ; impression du navigateur ; fichier téléchargé autonome sans script, ouvert hors ligne sous son nom : la planche seule, sans rien demander au réseau (PEN-013) ; impression sans barre ni boutons ; une seule page A4 (Chromium seulement : `page.pdf`) ; lisible sur téléphone ; motif piégé inerte.
- **Limites** : La vérification d'une seule page A4 ne tourne que dans Chromium.
- **Cas manuels** : [PEN-013](manuels/penser-avec.md#pen-013), [TRV-008](manuels/transverse.md#trv-008)

<a id="tn-relecture"></a>
#### `TN-relecture` — Relecture de la semaine

- **Fichier** : [`tests/browser/relecture.js`](../../tests/browser/relecture.js) · **mode** A · **écran** O
- **Conditions** : Un Carnet avec deux hypothèses (l'une documentée par une source), deux notes anciennes en tension, un espace Sources.
- **Vérifie** : l'accueil propose la relecture avec ce qui attend (choses endormies, tension, hypothèse sans source) ; la page s'ouvre, le titre de la page la nomme ; trois choses endormies différentes, un tirage stable d'un rendu à l'autre ; la tension ouverte et ses deux entrées ; l'hypothèse sans source, pas celle qu'une source documente ; « Retirer » refait le tirage ; « Relecture faite » : retour à l'accueil, jour retenu sur l'appareil, ligne disparue pour une semaine, message ; toujours à portée depuis le bilan ; elle revient sept jours plus tard.
- **Limites** : Le tirage est aléatoire et pondéré : le test vérifie sa forme, pas les choses tirées.
- **Cas manuels** : [PEN-016](manuels/penser-avec.md#pen-016)

<a id="tn-carte"></a>
#### `TN-carte` — Carte céleste

- **Fichier** : [`tests/browser/carte.js`](../../tests/browser/carte.js) · **mode** A · **écran** O et T
- **Conditions** : Fragments liés, un motif à 120 occurrences.
- **Vérifie** : la fiche mène à la carte du voisinage (deux degrés) ; temps, bandes, forme du trait, tensions marquées ; table des liaisons ; carte identique à la réouverture ; étoile suivie au clavier ; carte d'un motif : 80 étoiles au plus, et l'app le dit ; téléphone : la table d'abord, la carte sur demande ; pas de débordement ; fragment piégé inerte.
- **Cas manuels** : [PEN-014](manuels/penser-avec.md#pen-014), [TRV-002](manuels/transverse.md#trv-002), [TRV-008](manuels/transverse.md#trv-008)

<a id="tn-sources-oubliees"></a>
#### `TN-sources-oubliees` — Sources oubliées et sources qui documentent

- **Fichier** : [`tests/browser/sources-oubliees.js`](../../tests/browser/sources-oubliees.js) · **mode** A · **écran** O
- **Conditions** : Sources gardées il y a longtemps.
- **Vérifie** : les sortes annoncent une source oubliée (titre, revue, depuis quand) ; « documente… » vers une note ou un fragment, « Reliée. Elle apparaît en marge de ce qu'elle documente. » ; la carte s'efface ; le fragment dit qui le documente, la source ce qu'elle documente ; relier deux fois : « Déjà reliée ainsi. », un seul lien ; dossier avec DOI.
- **Cas manuels** : [PEN-009](manuels/penser-avec.md#pen-009), [EXT-004](manuels/connexions.md#ext-004), [PEN-008](manuels/penser-avec.md#pen-008)

<a id="tn-indexeddb"></a>
#### `TN-indexeddb` — Stockage IndexedDB

- **Fichier** : [`tests/browser/indexeddb.js`](../../tests/browser/indexeddb.js) · **mode** H · **écran** O
- **Conditions** : Document dans localStorage au départ.
- **Vérifie** : migration vers IndexedDB (secrets laissés) ; capture écrite et relue après relance ; un autre onglet se met à jour ; un document de plus de 5 millions de caractères est enregistré ; synchronisé pour de vrai (BL-23).
- **Cas manuels** : [DON-008](manuels/donnees-sauvegardes.md#don-008)

<a id="tn-secours"></a>
#### `TN-secours` — Copie de secours quand IndexedDB refuse

- **Fichier** : [`tests/browser/secours.js`](../../tests/browser/secours.js) · **mode** H · **écran** —
- **Conditions** : Écriture IndexedDB annulée pour de bon, serveur injoignable.
- **Vérifie** : la perte est réelle dans IndexedDB ; la copie de secours la garde à la fermeture ; au démarrage suivant, elle rejoint IndexedDB, part au serveur, et les copies sont effacées.
- **Limites** : Aucun cas manuel : provoquer un refus d'IndexedDB à la main n'est pas praticable. Deux échecs pendant sa branche de correction (A2).
- **Cas manuels** : —

<a id="tn-taille"></a>
#### `TN-taille` — Taille d'un espace

- **Fichier** : [`tests/browser/taille.js`](../../tests/browser/taille.js) · **mode** H · **écran** O
- **Conditions** : Limite abaissée par le test.
- **Vérifie** : Réglages → Sauvegarde dit la taille en octets UTF-8 et la limite ; près de la limite, l'alerte conseille d'exporter une sauvegarde, puis d'alléger les plus lourds, et nomme le plus lourd ; refus du serveur (23514) dit en clair.
- **Cas manuels** : [DON-009](manuels/donnees-sauvegardes.md#don-009)

<a id="tn-sync-deux-appareils"></a>
#### `TN-sync-deux-appareils` — Deux appareils du même compte

- **Fichier** : [`tests/browser/sync-deux-appareils.js`](../../tests/browser/sync-deux-appareils.js) · **mode** H · **écran** —
- **Conditions** : Deux contextes de navigateur, un faux Supabase partagé.
- **Vérifie** : le premier appareil crée la ligne ; fusion : les deux captures sur le serveur ; B affiche ce qu'a écrit A ; une saisie faite juste avant la fermeture part à la réouverture ; sur un second compte rempli du jeu d'essai, deux appareils coupés du réseau (requêtes refusées, `setOffline`), l'horloge avancée jusqu'aux relèves de 30 s : l'indicateur muet tant que rien n'est écrit (C21), une suppression d'un côté et une modification de l'autre (la tâche modifiée gardée, l'autre supprimée, sur les deux), deux boîtes de réception désignées (une seule après la fusion, la même, où va la capture) (SYN-003, SYN-008) ; un format plus récent sur le serveur : le message « recharge la page », la capture gardée sur l'appareil, rien d'écrit, le serveur intact (SYN-007). Mutation vérifiée : la suppression qui l'emporte sur la modification, la boîte unique non rétablie, le refus du format plus récent retiré, une relève ratée qui parlerait, et ces contrôles échouent.
- **Limites** : Un seul faux serveur ; pas de vrai réseau ni de latence réelle ; la version plus récente de SYN-007 n'est qu'un document posé sur le faux serveur.
- **Cas manuels** : [SYN-001](manuels/synchronisation.md#syn-001), [SYN-002](manuels/synchronisation.md#syn-002), [SYN-003](manuels/synchronisation.md#syn-003), [SYN-005](manuels/synchronisation.md#syn-005), [SYN-007](manuels/synchronisation.md#syn-007), [SYN-008](manuels/synchronisation.md#syn-008)

<a id="tn-hors-ligne"></a>
#### `TN-hors-ligne` — Service worker

- **Fichier** : [`tests/browser/hors-ligne.js`](../../tests/browser/hors-ligne.js) · **mode** H · **écran** O
- **Conditions** : L'app, puis la politique et la page de présentation ouvertes.
- **Vérifie** : le service worker tient la page ; le cache garde l'app, pas la dernière page visitée.
- **Limites** : La coupure réseau simulée par Playwright n'atteint pas le service worker : le cache est lu, la page n'est pas rouverte hors ligne. Sous WebKit, la page de test, tenue par le service worker, échappe aux routes : sa mesure d'audience partait vers le vrai projet jusqu'à BL-21 (A20) ; le réseau fermé l'arrête, et le journal le dit.
- **Cas manuels** : [SYN-010](manuels/synchronisation.md#syn-010), [PLT-001](manuels/plateformes.md#plt-001), [TRV-012](manuels/transverse.md#trv-012)

<a id="tn-reseau-ferme"></a>
#### `TN-reseau-ferme` — Le réseau fermé aux scénarios

- **Fichier** : [`tests/browser/reseau-ferme.js`](../../tests/browser/reseau-ferme.js) · **mode** A · **écran** —
- **Conditions** : Le mandataire fermé de `helpers.js` (`engine.launch`, [BL-21](backlog.md#bl-21)), que tous les scénarios reçoivent ; une cible publique en lecture seule, autorisée par la politique de sécurité d'`index.html` (une prévision météo). Deux temps : le service worker bloqué, puis permis (sous Firefox et WebKit, une requête vers un autre hôte passe par le service worker, que les routes n'atteignent pas).
- **Vérifie** : une requête que ni les routes ni le serveur des scénarios ne servent échoue ; une requête routée et le serveur des scénarios sont servis ; une fois la page tenue par le service worker (le chemin d'A20 sous WebKit), la même requête échoue encore. Dans les trois moteurs.
- **Limites** : L'échec voulu peut s'écrire à la console : seuls les messages qui nomment la cible sont écartés du contrôle « aucune erreur JavaScript ». Le mandataire retiré (mutation du 6 octobre 2026, CI de la PR #124), le scénario échoue dans les quatre jobs : la cible répond 200. Le journal de chaque scénario nomme toute requête arrêtée par le mandataire (« · réseau fermé : … »). Ne dit rien des tests Node (`tests/*.test.js`), qui n'ouvrent pas de navigateur, ni de `npm run isolation`, qui vise la préproduction exprès.
- **Cas manuels** : —

<a id="tn-sauvegarde-complete"></a>
#### `TN-sauvegarde-complete` — La sauvegarde complète, geste entier, sur deux appareils

- **Fichier** : [`tests/browser/sauvegarde-complete.js`](../../tests/browser/sauvegarde-complete.js) · **mode** H · **écran** O
- **Conditions** : Deux appareils du même compte sur un faux Supabase partagé, puis un appareil sans compte ; les jeux du cahier (`jeu-essai.json`, `ancien-format-1.json`, `refus-version-future.json`, `refus-hostile.json`), choisis par le champ « Importer ».
- **Vérifie** : importer demande « Remplacer tout l'état actuel par celui du fichier ? », puis « Sauvegarde importée. » ; l'appareil 1 a les treize espaces du jeu, la capture d'avant disparue ; le compte aussi ; l'appareil 2, à la relève, le même état, sans doublon (une seule boîte). Renoncer : aucun « Sauvegarde importée. », rien ne change, rien ne part. Un fichier plus récent, puis un fichier piégé : refusés avec leur message exact, sans confirmation, rien ne part, aucune boîte d'alerte. Sans compte, le format 1 migré au format courant, la tâche, le livre, le fragment, la note et le nom « Aragne » gardés. Rechargé après ces refus : toujours les treize espaces du jeu, à l'identique (DON-003). Mutation vérifiée : un import qui ignore « Annuler » fait échouer trois contrôles ; un renoncement qui s'écrirait plus tard fait échouer celui du rechargement ; deux navigateurs sans compte : le jeu d'essai modifié dans le premier (une note liée puis rangée dans Écriture, son statut, un palier coché), exporté (un fichier), importé dans le second (« Sauvegarde importée. ») ; espace par espace, identiques à l'horodatage près ; le fragment ajouté garde son statut, son lien et sa provenance, le palier reste coché ; palette, domaines, ordre et partage avec l'assistant identiques (DON-007). Mutation vérifiée : la provenance retirée à l'export, l'ordre des espaces inversé, et ces contrôles échouent.
- **Limites** : Faux serveur ; ni feuille de partage des apps, ni choix du fichier sur téléphone, ni artefact ; l'affichage de chaque espace migré n'est pas parcouru.
- **Cas manuels** : [DON-002](manuels/donnees-sauvegardes.md#don-002), [DON-003](manuels/donnees-sauvegardes.md#don-003), [DON-004](manuels/donnees-sauvegardes.md#don-004), [DON-005](manuels/donnees-sauvegardes.md#don-005), [DON-006](manuels/donnees-sauvegardes.md#don-006), [DON-007](manuels/donnees-sauvegardes.md#don-007), [TRV-008](manuels/transverse.md#trv-008)

<a id="tn-hors-ligne-reel"></a>
#### `TN-hors-ligne-reel` — Hors ligne pour de vrai : rechargée sans réseau, puis le retour du réseau

- **Fichier** : [`tests/browser/hors-ligne-reel.js`](../../tests/browser/hors-ligne-reel.js) · **mode** H · **écran** O
- **Conditions** : Un compte connecté sur un faux Supabase, le service worker permis ; une première visite, puis le réseau coupé (`setOffline`) et le serveur de fichiers rendu injoignable par une route, que Chromium applique au service worker.
- **Vérifie** : en ligne, une capture part au serveur ; le service worker tient la page ; sous Chromium, hors ligne et rechargée, l'app s'ouvre depuis le cache, pas l'écran d'entrée, avec ses données ; une capture hors ligne affiche « Non synchronisé — enregistré sur cet appareil seulement » et rien ne part ; au retour du réseau, elle arrive au serveur sans rien perdre et l'indicateur s'efface. Cache vidé avant le rechargement, le scénario échoue (vérifié).
- **Limites** : Sous Firefox, le service worker échappe à la coupure simulée : le rechargement hors ligne n'y est pas éprouvé (le scénario le dit), le reste l'est. Sous WebKit, le scénario n'est pas joué, et le dit : une page tenue par le service worker y échappe aux routes de Playwright, et ses requêtes partaient vers le vrai serveur (A20 du [périmètre](perimetre.md#anomalies-et-observations)). Le moment du retour du réseau, relatif au branchement du démarrage, n'est pas maîtrisé : le scénario n'a pris A24 que sous le processeur ralenti, que `TU-AUTH-09` à `TU-AUTH-11` prouvent à coup sûr. En échec, il écrit le journal du réseau : chaque requête vue par le faux serveur et ce qu'il en a fait, celles qui ont échoué, ce que la page a vu (`online`, `offline`, `navigator.onLine`). Ni mode Avion, ni PWA installée, ni appareil réel.
- **Cas manuels** : [SYN-004](manuels/synchronisation.md#syn-004), [SYN-010](manuels/synchronisation.md#syn-010)

<a id="tn-injection"></a>
#### `TN-injection` — Identifiants et nombres piégés

- **Fichier** : [`tests/browser/injection.js`](../../tests/browser/injection.js) · **mode** A · **écran** —
- **Conditions** : Données corrompues injectées.
- **Vérifie** : aucun script injecté exécuté ; aucune balise injectée dans la page.
- **Cas manuels** : [DON-005](manuels/donnees-sauvegardes.md#don-005), [TRV-008](manuels/transverse.md#trv-008)

<a id="tn-csp"></a>
#### `TN-csp` — Politique de sécurité du contenu

- **Fichier** : [`tests/browser/csp.js`](../../tests/browser/csp.js) · **mode** A puis H · **écran** —
- **Conditions** : Un faux Supabase pour la page hébergée (avant BL-21, elle lisait les réglages d'inscription du vrai projet).
- **Vérifie** : deux empreintes, pas de `'unsafe-inline'` ; le script principal et celui du service worker s'exécutent ; polices du site ; 12 vues sans violation ; un `onerror=` ou un `<script>` injecté ne s'exécute pas et le navigateur le signale.
- **Cas manuels** : [CPT-001](manuels/entree-et-comptes.md#cpt-001), [TRV-008](manuels/transverse.md#trv-008), [TRV-009](manuels/transverse.md#trv-009)

<a id="tn-accessibilite"></a>
#### `TN-accessibilite` — Balayage axe-core des vues principales

- **Fichier** : [`tests/browser/accessibilite.js`](../../tests/browser/accessibilite.js) · **mode** A · **écran** O
- **Conditions** : axe-core 4.14.0 (dépendance de développement figée, MPL-2.0, jamais embarquée), règles WCAG 2.0, 2.1 et 2.2 A et AA ; en clair puis en sombre (`colorScheme`) ; `bypassCSP` pour injecter axe.
- **Vérifie** : aucune violation « serious » ni « critical » sur l'accueil, la Boîte, chaque type d'espace du jeu d'essai (Chantier, Écriture, Kundalini, Phidippus, Moth, Musique, Budget), la recherche, le bilan, les Réglages, et le formulaire d'une tâche ouvert ; les exceptions, aucune à ce jour, sont listées dans le test avec leur raison ; aucune erreur JavaScript.
- **Cas manuels** : [TRV-001](manuels/transverse.md#trv-001), [TRV-002](manuels/transverse.md#trv-002), [TRV-003](manuels/transverse.md#trv-003), [TRV-006](manuels/transverse.md#trv-006), [TRV-014](manuels/transverse.md#trv-014)

<a id="tn-contraste"></a>
#### `TN-contraste` — Contraste d'un espace éteint

- **Fichier** : [`tests/browser/contraste.js`](../../tests/browser/contraste.js) · **mode** A · **écran** O
- **Conditions** : Thèmes clair et sombre.
- **Vérifie** : le nom d'un espace éteint garde 4,5:1 dans les deux thèmes.
- **Cas manuels** : [TRV-006](manuels/transverse.md#trv-006)

<a id="tn-cibles"></a>
#### `TN-cibles` — Cibles tactiles

- **Fichier** : [`tests/browser/cibles.js`](../../tests/browser/cibles.js) · **mode** A · **écran** T (390 × 844, pointeur grossier)
- **Conditions** : Quinze écrans, dont un espace Sources (liens « ouvrir ↗ », boutons d'export) depuis `89d1ba0`.
- **Vérifie** : chaque écran demandé est bien affiché ; chaque contrôle offre 44 × 44 px au doigt.
- **Cas manuels** : [TRV-003](manuels/transverse.md#trv-003)

<a id="tn-cibles-ordinateur"></a>
#### `TN-cibles-ordinateur` — Cibles à la souris

- **Fichier** : [`tests/browser/cibles-ordinateur.js`](../../tests/browser/cibles-ordinateur.js) · **mode** A · **écran** O
- **Conditions** : Douze écrans, volets ouverts.
- **Vérifie** : chaque écran demandé est bien affiché ; chaque petite cible garde 24 px d'air (WCAG 2.5.8).
- **Cas manuels** : [TRV-003](manuels/transverse.md#trv-003)

<a id="tn-sources"></a>
#### `TN-sources` — Sources et « Envoyer à Selene »

- **Fichier** : [`tests/browser/sources.js`](../../tests/browser/sources.js) · **mode** H puis A · **écran** O
- **Conditions** : Crossref, Microlink simulés ; partage par `?url=`.
- **Vérifie** : « Recherche… » le temps que Crossref réponde (sa réponse retenue, EXT-001) ; un seul appel à Crossref pour un DOI ; aperçu, « Trouvée : « … » » pour le lecteur d'écran ; gardée avec « À lire », « Gardée : « … » » par son titre (A28) et « La relier à une idée » ; lien vers l'original à part ; doublon reconnu et nommé, « Garder » désactivé ; page par Microlink, titre piégé en texte, l'aperçu sans l'adresse ; adresse nettoyée ; Microlink bloqué : la phrase entière, gardée avec son adresse pour titre ; quota épuisé : gardable avec l'adresse seule ; ni lien ni DOI : la phrase entière, aucun appel ; note → source avec provenance, « Rangée dans Sources : « … » » ; lien partagé : attend la connexion, puis note de la boîte, l'adresse de la page nettoyée, une seule fois ; favori ; export BibTeX (clé lisible, auteurs « Nom, Prénom », revue, DOI ; une page en `@misc`, caractères de LaTeX échappés) et CSL-JSON (types, noms structurés, DOI, adresse et date de consultation) ; Selene dans le menu « Partager » d'Android (manifeste).
- **Cas manuels** : [EXT-001](manuels/connexions.md#ext-001), [EXT-002](manuels/connexions.md#ext-002), [EXT-003](manuels/connexions.md#ext-003), [EXT-004](manuels/connexions.md#ext-004), [EXT-017](manuels/connexions.md#ext-017), [PLT-002](manuels/plateformes.md#plt-002), [TRV-008](manuels/transverse.md#trv-008), [EXT-020](manuels/connexions.md#ext-020)

<a id="tn-passeur"></a>
#### `TN-passeur` — Le passeur côté Selene

- **Fichier** : [`tests/browser/passeur.js`](../../tests/browser/passeur.js) · **mode** H puis A · **écran** O
- **Conditions** : Faux passeur.
- **Vérifie** : connectée : les pages passent par le passeur, avec la session ; Microlink non sollicité ; métadonnées, flux repéré, rien de la page exécuté ; og:url d'un autre site ignorée ; DOI de la page complété par Crossref ; passeur absent (404) ou refusé (403) : Microlink prend le relais, sans insister, et l'aide le dit ; identifiant pour `PASSEUR_USERS` ; « Vérifier » ; artefact : pas de passeur.
- **Cas manuels** : [EXT-012](manuels/connexions.md#ext-012), [EXT-019](manuels/connexions.md#ext-019)

<a id="tn-dehors"></a>
#### `TN-dehors` — Dehors

- **Fichier** : [`tests/browser/dehors.js`](../../tests/browser/dehors.js) · **mode** H puis A · **écran** O
- **Conditions** : Faux passeur qui sert des flux.
- **Vérifie** : une porte dans la navigation ; sonde du passeur ; le champ « L'adresse d'un site ou d'un flux… » ; suivre un site par son flux annoncé, « Suivi : … » ; la semaine écoulée, rangée par projet ; titre piégé inerte ; lien `javascript:` neutralisé ; page sans flux ou flux déjà suivi : dit ; garder (source avec provenance), vers une note, vu ; douze au plus ; ligne d'accueil sans pastille ; seulement mes motifs ; tout marquer comme vu (synchronisé), « Tout est vu. Dehors se tait jusqu'à la prochaine parution. » ; ETag et 304 ; pas de relecture avant trois heures ; retirer un flux ; artefact : pas de Dehors ; synchronisé pour de vrai (BL-23) ; un flux suivi pendant qu'une relecture attend un site lent (le faux passeur le retient jusqu'à ce que le flux soit suivi, A46) garde ses éléments, au cache et à l'écran (A44 ; le contrôle échoue sans le correctif).
- **Cas manuels** : [EXT-013](manuels/connexions.md#ext-013), [EXT-019](manuels/connexions.md#ext-019)

<a id="tn-dehors-croise"></a>
#### `TN-dehors-croise` — Motifs croisés dans Dehors

- **Fichier** : [`tests/browser/dehors-croise.js`](../../tests/browser/dehors-croise.js) · **mode** H · **écran** O
- **Conditions** : Deux flux, une veille OpenAlex simulée.
- **Vérifie** : même article dans deux flux compté une fois ; d'abord le plus de raisons, puis une raison, puis le reste ; « déjà gardée » ; cache réduit à ce qui croise tes sources ; « vu » partout ; la veille d'un auteur ne compte pas son nom comme raison.
- **Cas manuels** : [EXT-013](manuels/connexions.md#ext-013)

<a id="tn-artist-watch"></a>
#### `TN-artist-watch` — Artist Watch

- **Fichier** : [`tests/browser/artist-watch.js`](../../tests/browser/artist-watch.js) · **mode** H · **écran** O
- **Conditions** : MusicBrainz simulé.
- **Vérifie** : rien sans la case ; le réglage dit combien d'artistes ; une requête par artiste relié, une seconde d'écart ; le mois écoulé, titre piégé inerte, rangé sous Musique ; ajouté à Musique et quitte Dehors ; pas de nouvelle demande dans la semaine ; décoché : réglage et cache retirés.
- **Cas manuels** : [EXT-014](manuels/connexions.md#ext-014)

<a id="tn-veille"></a>
#### `TN-veille` — Veille de recherche

- **Fichier** : [`tests/browser/veille.js`](../../tests/browser/veille.js) · **mode** H · **écran** O
- **Conditions** : OpenAlex simulé.
- **Vérifie** : rien avant la première veille ; « En veille : … Première lecture… » ; une requête depuis un mois, sans clé ; articles avec revue, autrice, résumé ; garder : source avec DOI et provenance « Veille » ; ORCID et clé : « Clé OpenAlex gardée dans ce navigateur. », clé hors des données synchronisées ; une veille en double : « Déjà en veille. », seule bulle depuis le clic, rien d'ajouté (le journal des bulles le dit sinon : A36) ; pas de nouvelle demande dans la semaine ; quota épuisé dit ; se déconnecter efface la clé et ce que le dehors a apporté ; synchronisé pour de vrai (BL-23) ; une synchro pendant la frappe de la clé ne l'efface pas (A33).
- **Cas manuels** : [CPT-013](manuels/entree-et-comptes.md#cpt-013), [EXT-014](manuels/connexions.md#ext-014), [SYN-001](manuels/synchronisation.md#syn-001)

<a id="tn-cites"></a>
#### `TN-cites` — Ce que tes sources ont en commun

- **Fichier** : [`tests/browser/cites.js`](../../tests/browser/cites.js) · **mode** H · **écran** O
- **Conditions** : OpenAlex simulé ; chaque contrôle attend les requêtes ou l'écriture qu'il lit (A21) ; le premier clic attend que le branchement du démarrage ait fini, plus aucune requête vers Supabase en vol depuis 2,5 s (`calme()`, A27, A31).
- **Vérifie** : rien avant le clic ; deux appels ; OpenAlex ne reçoit que des DOI ; références communes (tes sources exclues), couplage, auteurs qui reviennent ; titres piégés inertes ; résultat sur l'appareil seulement ; garder une référence ; suivre un auteur dans la veille ; cache ; une seule source à DOI : pas de bouton.
- **Cas manuels** : [EXT-018](manuels/connexions.md#ext-018)

<a id="tn-agenda"></a>
#### `TN-agenda` — Calendrier dédié

- **Fichier** : [`tests/browser/agenda.js`](../../tests/browser/agenda.js) · **mode** H · **écran** O
- **Conditions** : Faux passeur qui sert un `.ics` ; horloge fixée. Avant chaque rechargement, plus aucune requête en vol depuis 2,5 s (`calme()` de `helpers.js`, A19, A31).
- **Vérifie** : rien sans adresse ; `webcal://` devient `https://` ; adresse gardée dans ce navigateur, hors synchronisation, jamais réaffichée ; le plombier sous Chantier ; récurrence ; le passé écarté ; journée entière demain ; titre piégé inerte ; cache d'une heure ; « oublier » retire adresse et cache, et le dit : « Calendrier oublié sur cet appareil. » (EXT-015) ; synchronisé pour de vrai, et l'adresse secrète absente des données du serveur (BL-23) ; le Yoga de 18 h 30, heure de Paris, le mardi d'avant et celui d'après le changement d'heure du 25 octobre : 18 h 30 les deux fois (TRV-005, étape 4 ; mutation vérifiée : la récurrence calée sur une heure UTC fixe).
- **Cas manuels** : [CPT-013](manuels/entree-et-comptes.md#cpt-013), [EXT-015](manuels/connexions.md#ext-015), [TRV-005](manuels/transverse.md#trv-005)

<a id="tn-zotero"></a>
#### `TN-zotero` — Zotero en lecture seule

- **Fichier** : [`tests/browser/zotero.js`](../../tests/browser/zotero.js) · **mode** H puis A · **écran** O
- **Conditions** : API Zotero et passeur simulés.
- **Vérifie** : rien sans clé ; clé en en-tête, à qui elle est, lecture seule ; clé hors synchronisation ; recherche, pièces jointes écartées, titre piégé inerte ; garder : source reliée à la fiche, « Gardée, reliée à Zotero : « … » », nommée par son titre et non par son résumé (A28) ; doublon par clé, « déjà gardée » ; récents ; relais par le passeur ; clé qui peut écrire signalée ; clé refusée dite ; artefact : pas de Zotero.
- **Cas manuels** : [EXT-016](manuels/connexions.md#ext-016), [EXT-019](manuels/connexions.md#ext-019)

<a id="tn-musique"></a>
#### `TN-musique` — Musique et MusicBrainz

- **Fichier** : [`tests/browser/musique.js`](../../tests/browser/musique.js) · **mode** A · **écran** O
- **Conditions** : MusicBrainz simulé.
- **Vérifie** : l'espace ouvert sans rien cliquer, aucune requête à MusicBrainz (EXT-006) ; homonymes : Selene demande ; discographie studio sans live ; titre piégé inerte ; album choisi (identifiants, année) et « « Bergtatt » : c'est noté. » (EXT-005), autre album ajouté ; une requête par seconde au plus ; pochette, ou rien si absente ; nouvelles sorties : l'année écoulée, puis rien le même jour ; service muet dit ; réglable par collection.
- **Cas manuels** : [EXT-005](manuels/connexions.md#ext-005), [EXT-006](manuels/connexions.md#ext-006)

<a id="tn-radar"></a>
#### `TN-radar` — Radar culturel

- **Fichier** : [`tests/browser/radar.js`](../../tests/browser/radar.js) · **mode** H puis A · **écran** O
- **Conditions** : Portail OpenAgenda simulé ; horloge fixée.
- **Vérifie** : rien à l'ouverture ; un appel au clic ; le portail reçoit la zone et les dates, jamais les mots ; cinq au plus, filtrés ; le reste compté ; titre piégé inerte ; garder dans la boîte ; cache d'une heure ; 400 : second essai sans sélection ; panne dite ; lecture directe refusée : le passeur, retenu ; artefact : dit ce qui manque ; sans mots ou sans lieu : pas de bouton ; mots synchronisés.
- **Cas manuels** : [EXT-010](manuels/connexions.md#ext-010), [EXT-019](manuels/connexions.md#ext-019)

<a id="tn-instagram"></a>
#### `TN-instagram` — Import Instagram

- **Fichier** : [`tests/browser/instagram.js`](../../tests/browser/instagram.js) · **mode** A · **écran** O
- **Conditions** : Exports synthétiques (`posts_1.json`, `reels.json`).
- **Vérifie** : import dans les réglages d'une collection ; confirmation (combien, dates, où) ; annuler ne verse rien ; publications au dernier statut, encodage réparé, titre et date ; reel sans légende ; réimport sans doublon ; fichier illisible ou mauvais fichier dit ; légende piégée inerte ; pas de rappel dans « Aujourd'hui ».
- **Cas manuels** : [EXT-011](manuels/connexions.md#ext-011), [TRV-008](manuels/transverse.md#trv-008)

<a id="tn-ciel-chantier"></a>
#### `TN-ciel-chantier` — Ciel et chantier

- **Fichier** : [`tests/browser/ciel-chantier.js`](../../tests/browser/ciel-chantier.js) · **mode** A · **écran** O
- **Conditions** : Open-Meteo simulé ; horloge fixée à plusieurs dates.
- **Vérifie** : Géminides et Perséides la veille du maximum ; éclipses annoncées, avec mise en garde ; rien depuis Marseille ; rien un soir ordinaire ; un seul appel Open-Meteo ; « balcon » : pluie des cinq jours ; « Jardin » comme lieu ; rien sur une tâche d'intérieur ou faite ; « sec jusqu'à » ; mots réglables ; sans lieu : pas de météo, mais les étoiles filantes.
- **Cas manuels** : [EXT-009](manuels/connexions.md#ext-009)

<a id="tn-ciel-vivant"></a>
#### `TN-ciel-vivant` — Ciel vivant

- **Fichier** : [`tests/browser/ciel-vivant.js`](../../tests/browser/ciel-vivant.js) · **mode** A · **écran** O et T
- **Conditions** : Météo de Lille simulée (vent, précipitations).
- **Vérifie** : nuages, brume, pluie suivent le vent ; seul `transform` est animé ; phase tirée de l'horloge ; hors de vue, immobile ; décoché ou mouvement réduit : immobile ; réglage propre à l'appareil, gardé au rechargement, le ciel immobile et la case décochée (TRV-006) ; vent d'est, neige, brume ; téléphone sans débordement.
- **Cas manuels** : [EXT-008](manuels/connexions.md#ext-008), [TRV-006](manuels/transverse.md#trv-006)

<a id="tn-fenetre"></a>
#### `TN-fenetre` — La Fenêtre

- **Fichier** : [`tests/browser/fenetre.js`](../../tests/browser/fenetre.js) · **mode** A · **écran** O
- **Conditions** : Horloge de Paris simulée ; Open-Meteo simulé ; pour NAV-010, le jeu d'essai du cahier, un appareil réglé en clair.
- **Vérifie** : midi sans étoiles, minuit étoilé ; sans lieu, ni heure ni météo ; recherche de lieux ; lieu arrondi au dixième ; météo demandée une fois ; pluie dessinée ; lune placée et texte opposé ; météo de plus de trois heures ignorée ; « Suivre le soleil » clair l'après-midi, sombre le soir. Puis, sur le jeu d'essai (NAV-010) : « Rubedo, amanite » change l'accent dans la navigation et le contenu, sans recharger ; « Toujours clair » puis « Toujours sombre » : le fond bascule, titre et aide à 4,5:1 au moins, l'amanite éclaircie ; `Herbier` dans l'en-tête et l'onglet (« Réglages — Herbier »). Mutation vérifiée : la palette sans nouveau rendu, « Toujours sombre » laissé à l'appareil, l'onglet qui garde « Selene », et ces contrôles échouent.
- **Cas manuels** : [NAV-010](manuels/navigation-reglages.md#nav-010), [EXT-007](manuels/connexions.md#ext-007)

<a id="tn-saisons"></a>
#### `TN-saisons` — Saisons de la lisière

- **Fichier** : [`tests/browser/saisons.js`](../../tests/browser/saisons.js) · **mode** A · **écran** O
- **Conditions** : Horloge fixée à quatre dates ; météo simulée.
- **Vérifie** : rouille en octobre, débourrement en avril, plein feuillage en juillet, branches nues en janvier ; givre à −3 °C seulement, pas à 4 °C ; sans lieu, jamais de givre supposé.
- **Cas manuels** : [EXT-008](manuels/connexions.md#ext-008)

<a id="tn-assistant"></a>
#### `TN-assistant` — Assistant hébergé

- **Fichier** : [`tests/browser/assistant.js`](../../tests/browser/assistant.js) · **mode** H · **écran** O
- **Conditions** : Faux Supabase, fausse fonction `assistant`.
- **Vérifie** : état de la clé demandé au serveur ; la clé part une fois, la page n'en garde que l'indice, rien dans localStorage ; la question part vers la fonction sans clé ; réponse affichée ; jamais d'appel à `api.anthropic.com` ; clé effacée du serveur ; une clé laissée par une ancienne version est confiée puis effacée de l'appareil ; avant toute clé : le texte, un champ masqué et vide, pas de bouton « Oublier » ; deux clés refusées, champ vidé, refus du serveur dit tel quel ; la clé acceptée : son message, son indice, « Oublier » ; rien dans IndexedDB non plus (AST-001) ; un nouvel espace Carnet `Journal privé ESP-010` et sa note `mot-témoin-ESP010` : coché d'office dans « Ce que Claude peut lire », le mot-témoin part avec une question ; décoché, l'en-tête « Données partagées » n'en parle plus et la même question ne l'emporte plus, ni le nom de l'espace (ESP-010 ; mutation vérifiée : pas coché d'office, le partage ignoré à l'envoi ou dans l'en-tête) ; sur le jeu d'essai : la question part avec les données (date, lune, BUDGET et ses enveloppes, CHANTIER et ses tâches à identifiant) ; Budget décoché, ni l'en-tête ni la requête n'en parlent ; Plantes éteinte, absente de la liste, de l'en-tête et de la requête, puis rallumée, cochée (AST-003) ; Budget éteint, les outils offerts sans `ajouter_operation`, et le faux modèle qui l'appelle quand même est refusé à l'exécution, sans fenêtre d'accord ; en lecture seule, aucun outil, « Tu ne peux rien modifier : conseille seulement. », la tâche tentée refusée (AST-005) ; « Effacer la conversation ? », « Annuler » qui la garde, « Confirmer » qui la vide et rend les suggestions, la déconnexion qui l'efface de l'appareil (AST-008). Mutation vérifiée : le partage ou l'extinction ignorés à l'envoi, le choix de partage perdu à l'extinction, le refus contourné à l'exécution, des outils en lecture seule, « Annuler » qui efface, la conversation gardée à la déconnexion, et ces contrôles échouent. Un huitième mutant, qui offrirait l'outil d'un espace éteint, est équivalent : `firstOfType` ne retient déjà que les espaces affichés, la garde est double.
- **Limites** : Aucun modèle réel ; la fonction réelle est testée à part (`TD-AST-*`).
- **Cas manuels** : [AST-001](manuels/assistant.md#ast-001), [AST-002](manuels/assistant.md#ast-002), [AST-003](manuels/assistant.md#ast-003), [AST-005](manuels/assistant.md#ast-005), [AST-006](manuels/assistant.md#ast-006), [AST-008](manuels/assistant.md#ast-008), [ESP-010](manuels/espaces.md#esp-010)

<a id="tn-assistant-accord"></a>
#### `TN-assistant-accord` — Accord avant chaque écriture

- **Fichier** : [`tests/browser/assistant-accord.js`](../../tests/browser/assistant-accord.js) · **mode** H · **écran** O
- **Conditions** : Le faux assistant tente une injection indirecte (consigne glissée dans une source).
- **Vérifie** : la fenêtre dit ce qui serait écrit, rien interprété comme du HTML ; refusé : rien n'est écrit, le modèle l'apprend ; confirmé : la note est déposée et le modèle l'apprend.
- **Cas manuels** : [AST-004](manuels/assistant.md#ast-004)

<a id="tn-assistant-injoignable"></a>
#### `TN-assistant-injoignable` — Fonction assistant injoignable

- **Fichier** : [`tests/browser/assistant-injoignable.js`](../../tests/browser/assistant-injoignable.js) · **mode** H · **écran** O
- **Conditions** : Refus CORS, hors ligne ; puis une fonction qui répond 404, puis 503.
- **Vérifie** : l'état de la clé est demandé une fois, pas en boucle ; la page ne se redessine pas sans cesse ; les boutons répondent ; la vue Assistant et les Réglages disent « Assistant injoignable (hors ligne, ou pas encore déployé). » plutôt que « Colle ta clé API » ; coller une clé donne la cause, pas « demande d'être connectée » ; une fonction qui répond 404 (« Assistant non déployé ») ou 503 (« Assistant non configuré ») : le même diagnostic, une seule demande, aucune boucle.
- **Cas manuels** : [AST-007](manuels/assistant.md#ast-007)

<a id="tn-regulation"></a>
#### `TN-regulation` — Reprendre la main, parcours complet

- **Fichier** : [`tests/browser/regulation.js`](../../tests/browser/regulation.js) · **mode** A puis H · **écran** T puis O
- **Conditions** : Sans compte, puis compte personnel (`selene_personnel`) sur un faux Supabase.
- **Vérifie** : sans compte : l'espace n'est pas proposé ; compte personnel : modèle en dernier, non partagé ; écran d'accueil du suivi ; un sujet par suivi ; nom prérempli ; alcool : sevrage, médecin ou CSAPA, urgences avant l'objectif ; sous les actions, le bloc replié « Alcool : sevrage, urgences, aide », déplié avec ses trois paragraphes, « alcool-info-service.fr » ouvert dans un nouvel onglet, `noopener` (RLM-004) ; aujourd'hui inconnue ; sept derniers jours : le premier jour, une phrase au lieu d'un tableau vide, puis, une journée confirmée, le tableau sans colonne pour une semaine d'avant qui n'existe pas (U9) ; décimale gardée ; point du jour avec date et total ; consommation après confirmation : à reconfirmer ; total déclaré : complément ; modification dans un autre onglet pendant la boîte : rien validé ; reconfirmation sur le total à jour ; envie, pause à échéance absolue au rechargement, « je l'ai fait » une seule fois, pause arrêtée ; marques masquées puis une par jour ; récompense ; serveur : le nom seulement ; pas de pont ; accueil, recherche, bilan, planche sans détail ; partage confirmé sur le résumé, annulable, arrêtable ; tabac, réseaux sociaux, cannabis : unités, « 1,5 » cigarette refusé ; téléphone sans débordement, cibles de 44 px ; clavier et libellés ; anglais. ; dates dans les messages : objectif à venir et suppression d'une saisie avec la date en lettres et un seul point (jamais « oct.. ») ; le formulaire de consommation explique le verre standard sans répéter l'avertissement du sevrage (RLM-004).
- **Cas manuels** : [RLM-001](manuels/reprendre-la-main.md#rlm-001), [RLM-002](manuels/reprendre-la-main.md#rlm-002), [RLM-004](manuels/reprendre-la-main.md#rlm-004), [RLM-005](manuels/reprendre-la-main.md#rlm-005), [RLM-008](manuels/reprendre-la-main.md#rlm-008), [RLM-009](manuels/reprendre-la-main.md#rlm-009), [RLM-010](manuels/reprendre-la-main.md#rlm-010), [RLM-012](manuels/reprendre-la-main.md#rlm-012), [RLM-016](manuels/reprendre-la-main.md#rlm-016), [RLM-017](manuels/reprendre-la-main.md#rlm-017), [RLM-018](manuels/reprendre-la-main.md#rlm-018), [RLM-019](manuels/reprendre-la-main.md#rlm-019), [RLM-020](manuels/reprendre-la-main.md#rlm-020), [RLM-021](manuels/reprendre-la-main.md#rlm-021), [RLM-028](manuels/reprendre-la-main.md#rlm-028), [TRV-002](manuels/transverse.md#trv-002), [TRV-014](manuels/transverse.md#trv-014)

<a id="tn-regulation-appareil"></a>
#### `TN-regulation-appareil` — Reprendre la main, deux appareils

- **Fichier** : [`tests/browser/regulation-appareil.js`](../../tests/browser/regulation-appareil.js) · **mode** H · **écran** O et T
- **Conditions** : Deux appareils du même compte, faux Supabase lu directement ; la fonction `assistant` y répond « pas de clé » (RLM-026 allume l'assistant).
- **Vérifie** : compte ordinaire : non proposé à l'accueil ni dans les Réglages ; aucun choix de stockage ; le serveur connaît le nom, ni note, ni sujet, ni objectif ; contenu dans le stockage local ; B voit le nom, pas le contenu ; supprimer de B prévient qu'on ne retire que le nom ; déconnexion : la garde nomme ce qui n'existe qu'ici ; annuler ne déconnecte pas ; effacer demande une dernière confirmation ; ensuite plus rien sur l'appareil, **et le nom du suivi a aussi quitté le compte** (le site lu sur le faux serveur n'a plus le module) ; chemin S, sans compte, `rlm-en-cours.json` importé : « Faire évoluer mon objectif » sans champ de sujet, des réglages sans sujet ni unité, plus de « Commencer : choisir ce que je veux suivre » (RLM-006) ; « suppr. » sur une saisie d'une journée confirmée, dit, avec « Annuler » qui la rétablit ; « laisser inconnue » sur une journée ; l'envie et l'action d'un jour supprimées, chacune dite (RLM-013). Mutation vérifiée : le choix du sujet rouvert, un champ de sujet dans l'objectif, « à reconfirmer » tu, « Annuler » qui ne rétablit rien, les messages de la journée et de l'envie changés, et ces contrôles échouent ; « Exporter ce suivi » : sa demande, le fichier `selene-regulation-v1` lu (format, restauration, sujet, 2 objectifs, 7 entrées, la note), la sauvegarde complète qui le contient, l'export du suivi refusé à l'import sans boîte de remplacement, la sauvegarde complète réimportée à l'identique (RLM-025) ; l'horloge figée à Paris : J+1 refusé par les quatre formulaires datés, un objectif à J+1 accepté et dit, une saisie de J relue à Auckland toujours du 7, exportée avec sa zone `Europe/Paris` (RLM-015). Mutation vérifiée : la demande d'export, une entrée en moins dans le fichier, le refus d'import, la date maximale retirée, la phrase de l'objectif à venir, la zone, et ces contrôles échouent ; un second compte personnel et ses deux appareils : supprimer le suivi depuis celui qui le garde, sans l'avertissement du talon, un nom mal retapé refusé, le bon nom qui le retire de la navigation, de « Ce que Claude peut lire » et de `selene-local-v1`, puis de l'autre appareil et du compte (RLM-026). Mutation vérifiée : un début de nom accepté, la copie locale gardée, l'avertissement du talon montré au détenteur, et ces contrôles échouent ; la pierre tombale retirée ne change rien ici (l'appareil 2 n'a rien modifié : `TU-SYN-05` et `TU-SYN-22` la prouvent)
- **Cas manuels** : [RLM-002](manuels/reprendre-la-main.md#rlm-002), [RLM-003](manuels/reprendre-la-main.md#rlm-003), [RLM-022](manuels/reprendre-la-main.md#rlm-022), [RLM-023](manuels/reprendre-la-main.md#rlm-023), [RLM-006](manuels/reprendre-la-main.md#rlm-006), [RLM-013](manuels/reprendre-la-main.md#rlm-013), [RLM-015](manuels/reprendre-la-main.md#rlm-015), [RLM-025](manuels/reprendre-la-main.md#rlm-025), [RLM-026](manuels/reprendre-la-main.md#rlm-026)

<a id="tn-regulation-perdu"></a>
#### `TN-regulation-perdu` — Reprendre la main, l'appareil détenteur a perdu son stockage

- **Fichier** : [`tests/browser/regulation-perdu.js`](../../tests/browser/regulation-perdu.js) · **mode** H · **écran** O
- **Conditions** : Compte personnel, faux Supabase lu directement ; seul `selene-local-v1` est effacé du stockage (l'identité de l'appareil reste) ; pour RLM-027, la connexion par le formulaire y répond pour deux adresses, l'une d'un compte personnel, et la session n'est posée qu'une fois (retirée à la main, elle ne revient pas) ; pour RLM-011, RLM-007 et RLM-019, sans compte, `rlm-a-configurer.json` configuré dans un navigateur neuf à chaque cas, l'horloge figée au 7 octobre 2026, 20 h, à Paris.
- **Vérifie** : la sauvegarde complète contient le suivi gardé ici ; après l'effacement et un rechargement, l'espace avoue la perte et propose la restauration, sans contenu ni l'explication d'un autre appareil ; l'identité de l'appareil est restée ; la sauvegarde réimportée (après confirmation) rend le suivi entier, de nouveau gardé ici, sans rien envoyer au compte ; perdu encore, le retrait par les Réglages ne prévient pas comme un autre appareil, le dit, et le nom quitte le compte ; aucune erreur JavaScript. Puis un autre compte sur le même appareil (RLM-027) : la session d'un compte personnel retirée à la main, l'écran d'entrée ; un autre compte connecté par le formulaire ne voit pas le suivi, mis de côté sous `selene-local-v1:<compte>` ; déconnecté sans garde ; le premier reconnecté retrouve son suivi entier, et la mise de côté disparaît (A48). Mutation vérifiée : le retour sans la mise de côté (A48), la mise de côté supprimée, le document local gardé au changement de compte, et ces contrôles échouent. Puis le journal d'un suivi sans compte, venu de `TN-regulation-appareil` qui dépassait ses 3 minutes sous processeur ralenti (A51) : une saisie confirmée corrigée (« Corriger une saisie », sans « Je note »), dite « à reconfirmer », marquée « corrigé », déplacée d'un jour, puis les deux journées reconfirmées (RLM-011) ; réduire, observer, viser l'arrêt : les confirmations, les messages d'objectif, le point du jour à zéro, les verdicts des sept jours, le tableau et ses changements d'objectif, la limite zéro refusée (RLM-007). Mutation vérifiée : ces messages, « Je note » rendu à la correction, « corrigé » tu, « observée » tu, et ces contrôles échouent ; deux semaines en regard, depuis J-13 : la phrase avant toute confirmation, puis le tableau à deux colonnes et sa phrase, comparables, inégales, trop peu remplies (RLM-019). Mutation vérifiée : la phrase remplacée par le tableau, l'écart admis porté à trois, le minimum ramené à trois, la moyenne sur toutes les journées, la colonne « Les 7 d'avant » retirée, et ces contrôles échouent.
- **Cas manuels** : [RLM-029](manuels/reprendre-la-main.md#rlm-029), [DON-001](manuels/donnees-sauvegardes.md#don-001), [RLM-027](manuels/reprendre-la-main.md#rlm-027), [RLM-007](manuels/reprendre-la-main.md#rlm-007), [RLM-011](manuels/reprendre-la-main.md#rlm-011), [RLM-019](manuels/reprendre-la-main.md#rlm-019)

<a id="tn-natif"></a>
#### `TN-natif` — Coquille native simulée

- **Fichier** : [`tests/browser/natif.js`](../../tests/browser/natif.js) · **mode** N · **écran** O
- **Conditions** : `window.seleneNative` : deux coffres asynchrones côté Node ; faux Supabase.
- **Vérifie** : données et session lues depuis les coffres, rien dans localStorage, tout relu après relance ; la page envoie au widget la lune et trois lignes au plus ; notifications proposées, activées : la semaine programmée à 8 h 30 en texte brut ; changer l'heure reprogramme ; haptique à la capture. ; sauvegarde et exports confiés à la feuille de partage de la coquille, jamais à un téléchargement ; feuille refermée : rien ne s'affiche ; écriture refusée : la personne le sait.
- **Limites** : Aucune vraie coquille Capacitor : le pont est simulé.
- **Cas manuels** : [PLT-003](manuels/plateformes.md#plt-003), [PLT-005](manuels/plateformes.md#plt-005), [PLT-006](manuels/plateformes.md#plt-006), [PLT-013](manuels/plateformes.md#plt-013)

<a id="tn-bureau"></a>
#### `TN-bureau` — App de bureau simulée

- **Fichier** : [`tests/browser/bureau.js`](../../tests/browser/bureau.js) · **mode** N · **écran** O
- **Conditions** : Faux cœur Rust derrière `window.__TAURI__.core.invoke`.
- **Vérifie** : données et session par `store_load` et `secret_load`, rien dans localStorage ; Ctrl+Alt+S ouvre la capture ; `selene://share` dépose dans la boîte par `store_write`.
- **Limites** : Ni fenêtre Tauri réelle, ni raccourci global du système.
- **Cas manuels** : [EXT-017](manuels/connexions.md#ext-017), [PLT-009](manuels/plateformes.md#plt-009), [PLT-010](manuels/plateformes.md#plt-010)

<a id="tn-parcours-e2"></a>
#### `TN-parcours-e2` — Les six tâches du test E2

- **Fichier** : [`tests/browser/parcours-e2.js`](../../tests/browser/parcours-e2.js) · **mode** H · **écran** T
- **Conditions** : Sans compte ; Crossref simulé.
- **Vérifie** : Écriture et Sources installées ; trois idées par ⊕ ; source gardée par son DOI ; « documente… » proposé et relié ; Chercher retrouve sans accent ni casse ; l'Écriture vide mène au tri ; trois fragments triés, lien suivi ; dossier téléchargé.
- **Limites** : Le robot sait où cliquer : ne mesure pas la facilité pour une personne (c'est l'objet d'E2, [validation.md](../validation.md#e2--tester-le-parcours-deux-fois-cinq-personnes)).
- **Cas manuels** : [PEN-008](manuels/penser-avec.md#pen-008), [EXT-004](manuels/connexions.md#ext-004)

<a id="tn-essai"></a>
#### `TN-essai` — Page publique de test

- **Fichier** : [`tests/browser/essai.js`](../../tests/browser/essai.js) · **mode** P · **écran** T
- **Conditions** : Faux Supabase (tables `audience`, `attente`).
- **Vérifie** : une ouverture : une ligne d'audience (page, événement, lien d'arrivée), clé publique seule ; un rechargement ne compte pas ; polices du site ; pas de défilement horizontal ; adresse incomplète ou sans accord : dit, rien n'envoyé ; refus du serveur dit, adresse gardée ; inscription : adresse, lien, projet ; formulaire vidé ; ni cookie ni stockage ; « Essayer sans compte » ouvre l'app directement.
- **Cas manuels** : [TRV-013](manuels/transverse.md#trv-013)

## Fonctions serveur (Deno)

Commande : `npm run test:functions` (typage par `deno check`, puis `deno test --allow-env`). En CI : *Check › passeur*, et
avant chaque déploiement (*Assistant*, *Compte*, *Passeur*). Niveau C : la vraie fonction, contre de faux Supabase Auth,
PostgREST, Anthropic, réseau et DNS. Limite commune : ni le projet réel, ni les secrets réels, ni le déploiement.

| Identifiant | Fichier | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|---|
| <a id="td-ast-01"></a>`TD-AST-01` | [`assistant/assistant_test.ts`](../../supabase/functions/assistant/assistant_test.ts) | fermé : origine, session, configuration | Origine non listée, session absente ou expirée, secret de chiffrement absent : refus avec leur code d'erreur. | — |
| <a id="td-ast-02"></a>`TD-AST-02` | [`assistant/assistant_test.ts`](../../supabase/functions/assistant/assistant_test.ts) | clé : vérifiée par Anthropic, chiffrée, jamais rendue ; oubliée | Une clé refusée par Anthropic n'est pas gardée ; acceptée, elle est chiffrée en base (jamais en clair), la réponse n'en rend que l'indice ; « oublier » l'efface. | [AST-001](manuels/assistant.md#ast-001), [AST-006](manuels/assistant.md#ast-006) |
| <a id="td-ast-03"></a>`TD-AST-03` | [`assistant/assistant_test.ts`](../../supabase/functions/assistant/assistant_test.ts) | message : relayé avec la clé du compte, champs filtrés et bornés | Seuls modèle, `max_tokens` (borné), consigne, messages et outils (bornés) partent vers Anthropic, avec la clé du compte. | [AST-002](manuels/assistant.md#ast-002) |
| <a id="td-ast-04"></a>`TD-AST-04` | [`assistant/assistant_test.ts`](../../supabase/functions/assistant/assistant_test.ts) | chiffrement lié au compte : une ligne copiée sous un autre compte ne se déchiffre pas | L'identifiant du compte entre dans le chiffrement : une ligne déplacée ne se déchiffre pas. | — |
| <a id="td-cpt-01"></a>`TD-CPT-01` | [`compte/compte_test.ts`](../../supabase/functions/compte/compte_test.ts) | supprimer : les données puis le compte, seulement les siens | Efface `app_state`, puis `assistant_keys`, puis le compte, pour le seul compte de la session. | [CPT-015](manuels/entree-et-comptes.md#cpt-015) |
| <a id="td-cpt-02"></a>`TD-CPT-02` | [`compte/compte_test.ts`](../../supabase/functions/compte/compte_test.ts) | refus : sans session, origine inconnue, sans confirmation, action inconnue, non configurée | Chaque cas renvoie son refus, rien n'est effacé. | [CPT-015](manuels/entree-et-comptes.md#cpt-015) |
| <a id="td-cpt-03"></a>`TD-CPT-03` | [`compte/compte_test.ts`](../../supabase/functions/compte/compte_test.ts) | panne : le compte n'est jamais effacé avant ses données ; un nouvel essai termine | Une panne pendant l'effacement laisse le compte ; un second appel termine. | [CPT-015](manuels/entree-et-comptes.md#cpt-015) |
| <a id="td-gar-01"></a>`TD-GAR-01` | [`passeur/garde_test.ts`](../../supabase/functions/passeur/garde_test.ts) | IP privées, réservées, locales : refusées ; publiques : acceptées | Plages privées, réservées, boucle locale, métadonnées refusées. | [EXT-012](manuels/connexions.md#ext-012) |
| <a id="td-gar-02"></a>`TD-GAR-02` | [`passeur/garde_test.ts`](../../supabase/functions/passeur/garde_test.ts) | adresses : http(s), ports usuels, sans identifiants ni nom local ; les IP déguisées sont reconnues | Schémas, ports, identifiants dans l'adresse, noms locaux, IP écrites en décimal ou en hexadécimal. | [EXT-012](manuels/connexions.md#ext-012) |
| <a id="td-gar-03"></a>`TD-GAR-03` | [`passeur/garde_test.ts`](../../supabase/functions/passeur/garde_test.ts) | types : du texte selon le genre, jamais un binaire | Le type de contenu doit correspondre au genre demandé (`feed`, `page`, `ics`, `json`). | — |
| <a id="td-gar-04"></a>`TD-GAR-04` | [`passeur/garde_test.ts`](../../supabase/functions/passeur/garde_test.ts) | encodage : en-tête, déclaration XML, balise meta, sinon UTF-8 | L'encodage est lu dans cet ordre. | — |
| <a id="td-gar-05"></a>`TD-GAR-05` | [`passeur/garde_test.ts`](../../supabase/functions/passeur/garde_test.ts) | configuration : origines par défaut, comptes fermés par défaut | Sans `PASSEUR_USERS`, personne n'est admis. | — |
| <a id="td-pas-01"></a>`TD-PAS-01` | [`passeur/passeur_test.ts`](../../supabase/functions/passeur/passeur_test.ts) | fermé : origine, session, compte listé, liste obligatoire | Origine, session et appartenance à `PASSEUR_USERS` exigées. | [EXT-012](manuels/connexions.md#ext-012) |
| <a id="td-pas-02"></a>`TD-PAS-02` | [`passeur/passeur_test.ts`](../../supabase/functions/passeur/passeur_test.ts) | lecture : texte, métadonnées, GET conditionnel transmis, 304 sans corps | Le texte et ses métadonnées reviennent ; `If-None-Match` et `If-Modified-Since` transmis ; un 304 revient sans corps. | [EXT-012](manuels/connexions.md#ext-012) |
| <a id="td-pas-03"></a>`TD-PAS-03` | [`passeur/passeur_test.ts`](../../supabase/functions/passeur/passeur_test.ts) | SSRF : IP privée écrite, nom qui résout vers le privé, redirection vers les métadonnées | Chacun est refusé, redirections revérifiées. | [EXT-012](manuels/connexions.md#ext-012) |
| <a id="td-pas-04"></a>`TD-PAS-04` | [`passeur/passeur_test.ts`](../../supabase/functions/passeur/passeur_test.ts) | limites : binaire refusé, 2 Mo, genre inconnu, site en erreur | Chacun refusé ou rapporté avec son code. | [EXT-012](manuels/connexions.md#ext-012) |

## Cœur Rust de l'app Windows

Commande : `cargo test --locked` dans `native/tauri`. En CI : *Desktop*, sous Windows, si la PR touche `src/` ou
`native/tauri/`. Niveau U. Non exécutable dans un Linux sans `webkit2gtk-4.1`. Limite : la fenêtre, le raccourci global,
la zone de notification et le Gestionnaire d'identification ne sont pas testés.

| Identifiant | Fichier | Nom exact du test | Ce qui est vérifié | Cas manuels |
|---|---|---|---|---|
| <a id="tr-tau-01"></a>`TR-TAU-01` | [`native/tauri/src/main.rs`](../../native/tauri/src/main.rs) | noms_de_fichiers | Une clé (accents, barres obliques, caractères interdits compris) devient un nom de fichier hexadécimal et revient intacte ; un hexadécimal invalide est refusé. | [PLT-010](manuels/plateformes.md#plt-010) |
| <a id="tr-tau-02"></a>`TR-TAU-02` | [`native/tauri/src/main.rs`](../../native/tauri/src/main.rs) | langue_du_menu | Les étiquettes de langue en anglais donnent le menu anglais, toutes les autres le français ; les trois entrées du menu. | [PLT-009](manuels/plateformes.md#plt-009) |
| <a id="tr-tau-03"></a>`TR-TAU-03` | [`native/tauri/src/main.rs`](../../native/tauri/src/main.rs) | partage_en_json | Un partage piégé (guillemets, `</script>`) est transmis à la page en JSON, sans pouvoir s'exécuter. | [PLT-009](manuels/plateformes.md#plt-009) |

## Contrôles statiques, scripts et compilations

| Identifiant | Commande | Ce qui est vérifié | En CI | Limites | Cas manuels |
|---|---|---|---|---|---|
| <a id="ts-build-check"></a>`TS-BUILD-CHECK` | `npm run build:check` | Les HTML générés (`index.html`, `selene.html`) correspondent aux sources. | oui, *Check* (deux jobs) | Ne dit rien de leur comportement. | — |
| <a id="ts-syntax"></a>`TS-SYNTAX` | `npm run test:syntax` | `node --check` sur chaque source de `src/`, `src/app/`, `src/core/`, `src/native/`, `scripts/`. | oui, *Check* | Ne couvre pas les sous-dossiers de `src/app/` (le lint, si). | — |
| <a id="ts-lint"></a>`TS-LINT` | `npm run lint` | eslint, module par module : variables non déclarées ou inutilisées, globales limitées par couche. | oui, *Check* | Règles intégrées seulement. | — |
| <a id="ts-i18n"></a>`TS-I18N` | `npm run i18n` | Chaque texte marqué a sa traduction anglaise, sans orphelin, valeurs `{n}` comprises. | oui, *Check* | Ne juge pas la qualité des traductions. | — |
| <a id="ts-deno-check"></a>`TS-DENO-CHECK` | `deno check` (dans `test:functions`) | Typage des fonctions serveur. | oui, *Check › passeur* | — | — |
| <a id="ts-liens"></a>`TS-LIENS` | `npm run liens` | Les adresses de santé citées répondent ; une page disparue fait échouer. | planifié : le 3 de chaque mois | Un site qui refuse le robot n'est qu'annoté (lien ameli, [a-faire.md](../a-faire.md#tout-de-suite-une-minute)). | — |
| <a id="ts-isolation"></a>`TS-ISOLATION` | `npm run isolation`, et le workflow *Isolation* | Douze requêtes interdites refusées par un vrai projet Supabase de préproduction. | planifié : chaque lundi, à chaque changement des règles sur `main`, et à la demande ; **sauté** tant que les six secrets `ISOLATION_*` manquent ; à la main, sur son poste | Ne prouve rien sur la production tant que ses règles n'ont pas été comparées ([compte.md](../compte.md#vérifier-lisolation-entre-comptes)). | [TRV-016](manuels/transverse.md#trv-016) |
| <a id="ts-bench"></a>`TS-BENCH` | `npm run bench` | Le rendu des vues sur 5 500 textes (1,92 M caractères, document de 2,59 Mo) dans une VM Node : la médiane de cinq passages, après une chauffe ; échoue si une mesure dépasse 150 ms (décision du 6 octobre 2026, BL-09). Le 6 octobre : accueil 43 ms, motifs 33 ms, bilan 46 ms, planche 37 ms, carte d'un motif 53 ms, recherche 4 ms, tirage des sortes 43 ms. | **oui** : *Check › build-and-test*, à chaque PR et avant chaque déploiement | Faux DOM : ni mise en page ni peinture ; compter 3 à 5 fois plus sur téléphone selon le script. | [TRV-007](manuels/transverse.md#trv-007) |
| <a id="ts-recette"></a>`TS-RECETTE` | `npm run recette` | Cohérence du cahier de recette : identifiants, format des cas (un résultat attendu à chaque étape), lien cas ↔ tests dans les deux sens, présence de chaque test du dépôt dans l'inventaire, totaux du tableau de tête, matrice et son décompte par état, liens et ancres, jeux de données importables ou refusés ([maintenance.md](maintenance.md#la-vérification-de-cohérence)). | **oui** : *Check › recette*, sur les PR (jamais avant un déploiement de *Pages*) ; aussi dans `npm run check` | Ne lance aucun test et ne juge pas la justesse d'un résultat attendu. | — |
| <a id="ts-apk"></a>`TS-APK` | workflow *Android* | L'APK de débogage se construit ; le chemin de signature de la publication fonctionne (clé jetable, `apksigner verify`). | oui, filtré par chemins | Aucun lancement de l'app. | — |
| <a id="ts-android-fumee"></a>`TS-ANDROID-FUMEE` | workflow *Android sur émulateur* (`scripts/android-fumee.mjs`) | Sur un émulateur Android 15 hors ligne, l'APK de débogage démarre dans la coquille Capacitor sur son écran d'entrée ; une note capturée sans compte survit à l'app tuée puis relancée (sans repasser par l'écran d'entrée ; `files/selene` contient `selene-site-v1`, et aucun `.tmp` n'y reste au repos : un `.tmp` vu juste après une navigation est une écriture en route, revue après huit secondes sans geste) ; la mise à jour par l'APK de l'édition des stores la garde, et l'édition est la bonne ; aucune exception JavaScript pendant que le script est attaché. | oui, filtré par chemins | Émulateur, pas un téléphone ; ni session connectée, ni synchronisation, ni partage, rotation ou clavier ; les exceptions d'avant l'attache de chaque lancement échappent au script. | [PLT-003](manuels/plateformes.md#plt-003) |
| <a id="ts-ios-sim"></a>`TS-IOS-SIM` | workflow *iOS* | Le projet iOS et ses plugins compilent pour le simulateur. | oui, filtré par chemins | Aucun lancement, aucune signature. | [PLT-008](manuels/plateformes.md#plt-008) |
| <a id="ts-win-nsis"></a>`TS-WIN-NSIS` | workflow *Desktop* | L'installateur Windows se construit (après `TR-TAU-*`). | oui, filtré par chemins | Aucun lancement ; non signé sans certificat. | [PLT-009](manuels/plateformes.md#plt-009) |
| <a id="ts-win-fumee"></a>`TS-WIN-FUMEE` | workflow *Desktop* (`scripts/windows-fumee.mjs`) | Sur le runner Windows, le projet Supabase de l'app rendu injoignable (fichier `hosts`) : l'installateur NSIS s'installe en silence ; l'app démarre dans la coquille Tauri sur son écran d'entrée, édition complète ; une note capturée sans compte survit à l'app tuée puis relancée (sans repasser par l'écran d'entrée ; `%APPDATA%\io.github.mariebonifacio.selene\selene` contient `selene-site-v1`, sans `.tmp` au repos) ; une seconde Selene lancée pendant que la première tourne ne reste pas ; aucune exception JavaScript pendant que le script est attaché. La page est pilotée par le protocole de débogage de Chrome, que WebView2 ouvre dans une variante de la fumée, construite après le dépôt de l'installateur publié et jamais déposée (`additionalBrowserArgs` de Tauri : la variable `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` est ignorée quand wry fixe ses propres arguments). | oui, filtré par chemins | Ni session connectée, ni synchronisation, ni raccourci global, zone de notification, Gestionnaire d'identification ou mise à jour par-dessus. | [PLT-009](manuels/plateformes.md#plt-009), [PLT-010](manuels/plateformes.md#plt-010) |
| <a id="ts-sauvegarde"></a>`TS-SAUVEGARDE` | workflow *Sauvegarde* (`scripts/sauvegarde.sh`) | La base vidée par la CLI Supabase (rôles, schéma, données), refusée sans la table `app_state`, puis chiffrée pour la clé publique age du projet ; seule l'archive chiffrée est publiée en artefact, 30 jours. | planifié : chaque lundi, et à la demande ; **sauté** tant que `SUPABASE_DB_URL` et `SAUVEGARDE_CLE_AGE` manquent | Ne dit pas que l'archive se restaure ([TRV-017](manuels/transverse.md#trv-017)) ; une semaine au plus de modifications perdues ; s'arrête après 60 jours sans activité du dépôt. | [TRV-017](manuels/transverse.md#trv-017) |
| <a id="ts-pages"></a>`TS-PAGES` | workflow *Pages* | Le site n'est publié que si *Check* est vert. | oui, push sur `main` | Une mise à jour des actions de CI peut casser le déploiement sans casser *Check* ([a-faire.md](../a-faire.md#à-tenir-dans-la-durée)). | — |
| <a id="ts-captures"></a>`TS-CAPTURES` | `npm run screenshots` | Produit les captures des stores. | à la demande | Aucune vérification. | — |
| <a id="ts-release"></a>`TS-RELEASE` | workflow *Publication* | Construit et signe les versions publiées : l'APK et l'installateur Windows en édition complète, l'AAB et l'archive iOS en édition des stores (`SELENE_EDITION=stores`, sans « Reprendre la main »). | sur étiquette | Chaque plateforme est sautée tant que ses secrets manquent. | — |

## États particuliers

- **Stabilisés côté test, à surveiller** : `TN-activite` sous WebKit (A1 : deux échecs le 4 octobre, aucun depuis le
  correctif en 32 exécutions WebKit de la CI) ; `TN-mot-de-passe` (A11 : trois échecs sur `main`, les 4 et 5 octobre ;
  A16 : trois contrôles sous Firefox le 6 octobre, l'app pas encore démarrée, corrigé par la PR #120 avec
  `TN-regulation-appareil`, `TN-regulation-perdu`, `TN-sources`, `TN-dehors-croise`, `TN-dehors`, `TN-artist-watch` et
  `TN-agenda`, qui comptaient sur le même délai ; `TN-parcours-e2`, qui lisait le stockage avant l'écriture, trouvé par
  le job « démarrage lent ») ; `TN-agenda` sous WebKit (A19, un rechargement coupait une requête, corrigé par la PR #123
  comme A1) ; `TN-cites` sous Firefox (A21, une attente fixe, corrigé par la PR #124) ; `TN-natif` sous WebKit (A22, le coffre lu avant
  que l'écriture y arrive, corrigé par la PR #125) ; `TN-dehors` sous Chromium (A23, la vue lue avant le flux, corrigé par la
  PR #126) et
  `TN-dehors` (A10), qui attendent désormais l'état plutôt qu'un délai ; `TN-regulation` sous WebKit (A9, corrigé par la
  #100) ; `TN-identite` (deux échecs les 2 et 3 octobre, corrigé par `31122f6`). Relevé complet :
  [perimetre.md](perimetre.md#anomalies-et-observations).
- **À surveiller** : `TN-secours`, deux échecs pendant sa branche de correction, aucun depuis (A2).
- **Conditionnel** : une vérification de `TN-planche` (une page A4) ne tourne que dans Chromium ; les compilations natives
  ne tournent que si la PR touche leurs chemins ; les tests des fonctions ne se rejouent avant déploiement que si les secrets
  sont là.
- **Non bloquant** : *Check › browser (firefox)*, jusqu'au 20 octobre 2026 au moins ([BL-13](backlog.md#bl-13)) ; un échec y
  laisse le job vert, avec un avertissement et la liste dans le résumé du job ([BL-17](backlog.md#bl-17)).
- **Hors CI** : `TS-CAPTURES` ; `TS-LIENS` seulement une fois par mois ; `TS-SAUVEGARDE` et `TS-ISOLATION` chaque lundi,
  sautés tant que leurs réglages manquent. (`TS-BENCH` est en CI depuis le 6 octobre 2026.)
- **Désactivé, ignoré, sans assertion** : aucun.
- **Playwright** : 1.63.0 depuis la fusion de la PR #78 (`5197c5f`) ; les navigateurs de la CI sont les siens.

