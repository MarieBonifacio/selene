# Architecture de Selene

Ce document décrit l'état actuel du code et, en fin de fichier, les décisions qui l'ont façonné
(ADR : contexte, décision, alternatives écartées, conséquences). Il remplace l'ancien plan de
refactorisation, dont toutes les étapes sont livrées ou abandonnées au profit de ce qui suit.

## Deux cibles, une source

`python3 build.py` (`npm run build`) assemble **un seul script**, enveloppé dans une fonction immédiatement
exécutée, et l'insère dans `src/shell.html`. Tout le code est en **modules ES** (imports et exports explicites),
assemblés par esbuild (`scripts/bundle.mjs`, appelé par `build.py`) en deux temps :

1. la **plateforme** (`src/platform.js`), qui pose `__platform` et ouvre le stockage ;
2. l'**application** (`src/app/index.js` et tout ce qu'il importe, noyau `src/core/` compris), évaluée dans
   `platform.ready`, qui pose `__selene` (lu par les tests seulement). Ses imports de `platform.js` sont servis par
   `__platform` : une seule façade, un seul état.

Le build demande donc Python, Node et `npm ci` (esbuild). Pourquoi ce découpage : ADR 9 et ADR 22.

| Sortie | Pour | Particularités |
|---|---|---|
| `selene.html` | artefact claude.ai | synchro par `window.claude.use("db")`, assistant sans clé |
| `index.html` | PWA sur GitHub Pages | CSP, manifeste, service worker, comptes Supabase |

`hosted()` (= `platform.runtime() !== "artifact"`, voir `platform.js`) distingue les deux au démarrage. Ne jamais modifier les HTML générés :
la CI (`build.py --check`) refuse un HTML qui ne correspond pas aux sources.

Les ajouts propres à `index.html` (CSP, manifeste, service worker) se font dans le **squelette**, avant d'y
poser le script : le JavaScript peut contenir `<title>` ou `</body>` dans ses chaînes (la planche de lunaison
téléchargée en a), et un remplacement textuel ne doit jamais l'atteindre. Seul `</script` y est interdit, et
`build.py` le refuse : il fermerait la balise au milieu d'une chaîne.

Connexions externes (Crossref, Microlink, Open-Meteo…) : chaque hôte est nommé dans la CSP de `build.py`
(`connect-src`), et rien ne part sans un geste de l'utilisatrice. Principes et état : [connexions.md](connexions.md).

### Couches et ordre de chargement

Trois couches, vérifiées par `tests/architecture.test.js` :

- **`src/core/`, le noyau** : pur (ni DOM, ni stockage, ni réseau), n'importe que lui-même ;
- **`src/platform.js`** : le seul accès aux API de l'hôte (stockage, `window.claude`, coquilles natives) ;
- **`src/app/`, l'interface** : n'importe que `src/app`, le noyau et la plateforme.

Chaque fichier ne voit que ce qu'il importe : eslint (`no-undef`) le vérifie fichier par fichier, et l'interface n'a
pas le stockage du navigateur dans ses globales. Un module n'écrit jamais dans la variable d'un autre (un import est
en lecture seule) : il appelle une fonction de ce module. Au **chargement** (hors des fonctions), un module n'utilise
un import que si ce dernier ne dépend pas, même de loin, de lui : l'ordre d'évaluation ne peut rien casser. Les cycles
entre fonctions restent permis (un appel a lieu quand tout est chargé) ; les tables que les parties remplissent en se
chargeant (`VIEWS`, `SHEETS`, `CLICK`, `CHANGE`) vivent dans `src/app/registry.js`, qui ne dépend de rien.

| Module (`src/core/`) | Rôle | Importe |
|---|---|---|
| `sync.js` | fusion à trois voies, pure | — |
| `backup.js` | export / validation d'import | `domain.js` |
| `domain.js` | règles métier, registre pur `MODULE_TYPES`, `SCHEMA_VERSION` | — |
| `sky.js` | ciel de l'accueil, pur : soleil, lune, levers et couchers, météo → scène, saisons, mouvement du vent, contraste du texte | — |
| `carte.js` | carte céleste des liaisons, pure : placement déterministe (temps, bandes), voisinage borné | — |
| `sources.js` | sources, pur : adresses normalisées, DOI, traduction des réponses Crossref et Microlink | — |
| `musique.js` | musique, pur : traduction des réponses MusicBrainz, albums studio, parutions récentes, pochettes | — |
| `radar.js` | radar culturel, pur : requête OpenAgenda (zone et dates), traduction tolérante, tri par tes mots | — |
| `instagram.js` | mémoire éditoriale, pur : lecture de l'export Instagram (posts, reels), encodage de Meta réparé, éléments de collection | — |
| `veille.js` | Research Watch, pur : ce que l'on suit (recherche, ORCID, OpenAlex), requête, traduction des résultats ; « cité par tes sources » (références communes, couplage bibliographique, auteurs qui reviennent) | — |
| `agenda.js` | calendrier dédié, pur : lecture iCalendar (fuseaux, journées entières), récurrences dépliées sur une fenêtre | — |
| `zotero.js` | Zotero, pur : ce que permet une clé, une fiche traduite en Source (DOI, revue, auteurs, lien vers la fiche) | — |
| `biblio.js` | les sources en BibTeX et en CSL-JSON, pur : genre reconnu dans chaque langue, auteurs redécoupés, clés de citation, échappement LaTeX | `sources.js` |
| `markdown.js` | venir d'Obsidian ou de Zettlr, pur : en-tête YAML, titre, date (en-tête, nom, fichier), statut épistémique, liens `[[…]]` résolus entre les notes du lot et vers celles déjà là | — |

L'interface est rangée par **fonctionnalité** : ce qui sert une même chose (sa vue, son état, ses actions) vit dans
le même fichier, et chaque fichier commence par une phrase qui dit son rôle.

| Dossier (`src/app/`) | Contenu |
|---|---|
| `registry.js` | les registres : `VIEWS`, `SHEETS`, `CLICK`, `CHANGE`, `TYPE_UI` et `registerType` ; ne dépend de rien |
| `lib/` | sans état ni interface propre : `dom.js` (sélecteur, échappement, messages, pagination), `format.js` (dates, nombres, pluriels), `download.js`, `labels.js` (ce que le noyau nomme en français, traduit pour l'affichage : statuts, liens, ciel, erreurs, modèles de module) |
| `i18n/` | les langues de l'interface : `tr`, `trp`, `trn`, `N_`, la langue en vigueur et ses formats, un dictionnaire par langue (`en.js`) ; ne dépend de rien d'autre. Règles : [i18n.md](i18n.md) |
| `state/` | `store.js` (un document JSON synchronisé, qui ne connaît pas l'interface), `site.js` (les deux documents, leur normalisation, `S()`), `drafts.js` |
| `services/` | ce qui parle à un serveur ou à l'hôte : `auth.js` (Supabase, suppression du compte), `passeur.js`, `host.js` (espaces de noms de claude.ai), `erreurs.js` (les codes d'erreur des fonctions serveur, traduits) |
| `scene/` | le paysage de l'accueil : `moon.js`, `forest.js`, `sky.js` (lieu, météo, scène) |
| `ui/` | `dialogs.js` : confirmation et formulaire générique |
| `shell/` | la charpente de la page : `nav.js`, `render.js`, `actions.js` (délégation des événements), `sheets.js`, `palette.js`, `sigils.js` |
| `modules/` | un fichier par type de module (`programme`, `cumul`, `rappels`, `collection`, `taches`, `budget`, `notes`, `arc`), qui s'enregistre par `registerType` ; `entries.js` et `groups.js`, ce qu'ils partagent |
| `features/` | ce qui traverse les modules : liaisons, concordance, fiche Spécimen, Vasculum, carte, sources, citations, musique, radar, Dehors (et sa lecture des flux), agenda, Zotero, assistant, résumé du matin, partage, pont de reprise, sortes, tensions, dérive lexicale, test lunaire, dossier, minuteur |
| `views/` | les pages fixes : `accueil`, `bilan`, `planche`, `recherche`, `reglages` |
| `boot.js`, `index.js` | le démarrage ; le point d'entrée, qui nomme chaque fichier (l'ordre d'évaluation) |

Une action (`data-act`) vit avec ce qu'elle modifie : `CLICK["bilan-nav"]` dans `views/bilan.js`, les actions d'un
type dans son `registerType`. Aucun fichier ne réaffecte la variable d'un autre : `setBilanOffset`, `setSearchQuery`,
`setBridgeOpen`, `trackBack`… appartiennent à leur propriétaire.

## Données

Deux documents JSON par personne, chacun géré par un store (`makeStore`) :

- `site` (clé `selene-site-v1`) : tout — configuration et **modules** sous `modules` ;
- `board` (clé `selene-board-v1`) : jusqu'au format 5, les tâches du Chantier. Ce n'est plus qu'un
  **point d'entrée** : `absorbBoard` verse ce qui y arrive (une ancienne version de l'app restée ouverte
  peut encore y écrire) dans le module Chantier, puis le vide, et le vidage part au serveur. Le site est
  toujours connecté **avant** le board : versées dans un site pas encore synchronisé, les tâches rendraient
  ses données de départ « non vierges » et la synchro les fusionnerait au lieu de les remplacer.

`site.schemaVersion` vaut 8 (1 = anciennes sections `kundalini`, `ecriture`, `phidippus` à la racine ;
2 = modules génériques ; 3 = october.moth et Musique deviennent des collections ; 4 = la Capture devient
un module Notes ; 5 = le Budget devient générique ; 6 = le Chantier devient un module Tâches ; 7 = le suivi de régulation et ses objectifs versionnés ; 8 = un suivi gardé sur un seul appareil, ADR 27). Chaque ancienne section
est convertie par `SECTION_TO_MODULE` (`domain.js`) ; si une ancienne version de l'app la réécrit après
coup, ses entrées absentes sont absorbées dans le module au lieu d'être perdues. Une version de l'app qui lit un numéro plus grand que le sien
refuse de fusionner et d'écrire (« recharge la page ») ; un import plus récent est refusé.

### Données de départ

Un compte neuf part de `siteSeed()` : une boîte de réception, rien de personnel, et le drapeau
`config.welcome` qui affiche sur l'accueil le bloc « Composer ton espace » jusqu'à « C'est bon ». Il pose une
question, « Sur quoi travailles-tu ? », à trois réponses (`WELCOME_PATHS`, `views/accueil.js`) ; chacune installe
trois modèles qui vont ensemble (`installModules`, un seul enregistrement) et referme le bloc. La liste entière
(`MODULE_TEMPLATES`, dans `domain.js`) reste derrière « Choisir moi-même ». Ce drapeau est exclu de la complétion des réglages manquants :
un compte existant ne le reçoit jamais. Les données de départ doivent rester « vierges » (`updatedAt` à 0,
aucun identifiant aléatoire) pour qu'un appareil neuf adopte le serveur au lieu de fusionner.

Les tests partent d'un jeu d'essai riche, `tests/fixtures/site-demo.json` (les modules d'origine), sauf
ceux qui simulent un vrai compte neuf (`bare: true`).

### Normalisation à l'entrée, lecture pure

`normalizeSite()` (migration des anciens formats, champs ajoutés depuis, entrées de navigation
manquantes) est passée au store, qui l'applique à **tout ce qui entre** : lecture locale, résultat de
synchro, import, réinitialisation, mise à jour venue d'un autre onglet. `S()` ne fait que lire.
Un module absent n'est jamais recréé : il a été supprimé exprès.

### Modules

- **Génériques** (`site.modules[id] = { type, label, config, entries, scraps? }`) : instances d'un
  type du registre (programme, cumul, rappels, collection, notes, budget, taches). Tous les modules de
  contenu en sont ; on peut en créer et en supprimer.
- **Fonction système** (`MODULE_DEFS`) : l'assistant seul, activable comme un module mais sans données
  propres, comme les Réglages.

« Aujourd'hui » (trois tâches au plus) réunit tous les modules de tâches actifs : le plafond est commun.

L'état propre à un appareil (mois affiché d'un budget, filtre d'une collection) est rangé par identifiant
de module, jamais enregistré ni synchronisé. Un regroupement peut déclarer `rename(de, vers)` pour
répercuter un renommage de groupe ailleurs (les enveloppes d'un budget).

**Boîte de réception** : le module Notes marqué `config.inbox` (un seul à la fois, garanti par
`normalizeSite`, y compris après une fusion entre appareils) reçoit la capture rapide de l'accueil et
l'outil `capturer` de l'assistant. Sans boîte, l'accueil l'explique et l'outil disparaît.

**Ranger une note** : chaque type qui peut recevoir une note déclare `accept` (et `canAccept` s'il
faut une condition, comme le carnet d'un cumul) ; `noteTargets()` en déduit les boutons « → module ».

Le regroupement en pourcentage d'un module passe par `grouperFor(id)`, qui le demande à son type
(`TYPE_UI[type].grouper(inst, id)`) ; le réglage est stocké dans `inst.config.groups`.

Une migration faite au chargement (normalisation) est écrite aussitôt dans le stockage local : sans
synchro, le chargement suivant la referait depuis l'ancienne forme.

Un identifiant de module sert aussi de route (`#id`) et d'attribut HTML : il doit respecter
`MODULE_ID` (`[a-z0-9-]`, 64 caractères), ne pas être réservé (`accueil`, `reglages`, noms
d'`Object.prototype`). Les noms de types ne le sont pas : un type n'est pas une route, et le module
`budget` est une instance du type `budget`, et le routage fait toujours primer les vues fixes.

### Ajouter un type de module

1. Une entrée dans `MODULE_TYPES` (`domain.js`) : `label`, `defaults()`, `entry(e, input)`,
   `validate(inst, v)`.
2. Un fichier `src/app/modules/<type>.js` qui appelle `registerType("<type>", { … })` : `view`, `settings`,
   `summary`, `context`, et selon le besoin `alerts`, `add`, `click`, `change` ; puis une ligne dans
   `src/app/index.js`.

Rien d'autre : création, rendu, accueil, réglages, assistant, recherche et validation des sauvegardes
passent par ces deux registres. Crochets facultatifs de `TYPE_UI` (liste complète dans `src/app/registry.js`) :
`alerts` (accueil), `recent` (lignes dépliables), `texts` (recherche), `accept` (ranger une note),
`timerDone` (fin du minuteur), `review` (bilan d'une période), `grouper` (regroupement en pourcentage),
`badge` (navigation). Un élément de `texts` peut porter `ep` (statut épistémique) : la recherche et le
bilan le lisent. Champs communs à tous les types, hors registre (validés par `parseBackup`) : `resume` et
`resumeLog` sur l'instance (pont de reprise), `origin` sur une entrée (provenance, posée par `stampOrigin`
quand une note est rangée), `ep`/`epLog` et `links` sur les fragments et les notes. Les paliers d'un `programme` (`config.tiers`) sont un cas où l'affichage lit et écrit un état (cases cochées)
sans que ce même état ne déclenche jamais d'action : `advancedAt` n'est posé que par le clic explicite sur
« Passer au palier suivant » (`tier-advance`), jamais par la lecture des critères cochés. Ce clic peut ouvrir
`collectionForm` avec un élément préempli sans `id` : `collectionForm` traite alors la sauvegarde comme une
création (`item && item.id ? item.id : uid()`), jamais comme une modification d'un élément existant.

Le type `arc` (étapes + placements référençant `module/id` via `LINK_REF`) réutilise `refFind` pour résoudre
une cible de n'importe quel type, `excerpt` pour l'afficher, et le motif kanban (`.board`/`.col`/`.card`) déjà
utilisé par les collections en colonnes.

Un lien
(`{ id, to: "module/id", type, date }`) vit dans l'entrée d'où il part ; son `id` fait fusionner les liens un par
un entre appareils. Les liens entrants ne sont jamais stockés : ils se recalculent (`backlinks`). Tous facultatifs et additifs : une
version antérieure de l'app les ignore et la fusion les conserve, d'où l'absence de nouveau `SCHEMA_VERSION`.
Une collection peut être en mode `review` (la date est un rendez-vous de révision) ou `concordance` (ses
éléments sont des motifs comptés dans les `texts` des autres modules, voir `concordance()` dans `features/concordance.js`) :
deux réglages de l'instance, pas deux types, pour que tout le reste (formulaire, statuts, sauvegarde) serve tel quel.

### Performances

La recherche, la concordance et le bilan parcourent **tout** l'historique, à chaque rendu. Trois mécanismes
les gardent rapides sans jamais servir un résultat périmé :

- `fold` (texte sans accents ni casse) et `wordsOf` (ses mots) sont des fonctions pures : leurs résultats
  sont gardés dans un cache borné, qu'aucune modification des données ne peut rendre faux.
- La concordance passe par un **index inversé** (forme d'un mot → motifs), construit une fois par calcul :
  un texte se parcourt mot à mot au lieu d'être confronté à chaque motif. Seules les variantes de plusieurs
  mots passent par une expression régulière.
- La dérive lexicale du bilan (`lexicalDrift`, `features/derive.js`) découpe chaque texte une fois (`driftWords`, même cache
  borné) et compte chaque mot une fois par texte, sur sept périodes seulement.

Trois fonctionnalités s'appuient directement sur ce qui précède, sans rien y ajouter de nouveau :
- **Palimpseste** (`editFragmentText`, domain.js) : `f.versions` (plafonné à 10) et `f.editedAt` sur un fragment
  de `cumul.scraps` uniquement ; validé en générique dans backup.js (comme `origin`/`links`), pas dans le
  registre par type.
- **Sortes** (`sortesPool`/`sortesDraw`, `features/sortes.js`) : un tirage pondéré (probabilité proportionnelle au nombre de
  jours de silence) sur trois bassins déjà calculés ailleurs — fragments/notes via `editedAt || date`, tensions
  via `openTensions()`, motifs via `concordance()` + `fallow()`. Rien n'est stocké ; l'état affiché (`sortesLast`)
  est une variable de module, oubliée à la fermeture de l'onglet.
- **Relecture de la semaine** (`#bilan/relecture`, `features/relecture.js`, idée 4 de l'audit) : trois tirages des sortes
  sans remise (hors tensions), les tensions ouvertes (`tensionSection()`), les hypothèses qu'aucun lien « documente »
  ne vise (`backlinks()`). Le tirage vit le temps de la visite ; « Relecture faite » garde le jour sur l'appareil
  (`selene-relecture`), et l'accueil repropose la page sept jours plus tard, s'il y a de quoi relire. Rien n'est compté
  ni synchronisé.
- **Test lunaire** (`lunarTest`, `features/lunar.js`) : un test de Rayleigh sur le même corpus que la dérive lexicale (`ui.texts()`
  de chaque module non-concordance). Piège rencontré en écrivant `sortesPool` : un `if` sans accolades dans une
  boucle peut capturer le `else if` suivant (*dangling else*) et rendre une branche entière inatteignable sans la
  moindre erreur ; d'où la règle désormais suivie dans ces fonctions-là : chaque branche d'un if/else-if qui
  contient un `for`/`if` imbriqué porte ses propres accolades.
- `fmt` (dates) est aussi mis en cache : chaque appel à `toLocaleDateString` reconstruit un formateur `Intl`,
  et une liste de fragments en affiche des milliers. Les références `module/id` se résolvent par un index
  construit une fois par rendu (`refFind`).
- `memoInRender` garde un calcul partagé (la concordance sert la vue, le résumé d'accueil et deux périodes
  du bilan) le temps d'**un** rendu seulement : pendant un rendu les données ne bougent pas, donc aucune
  invalidation à gérer.

`node tests/bench.js` mesure les vues sur un historique réaliste de plusieurs années (~2 millions de
caractères) : à relancer après tout changement qui touche à ce qui parcourt l'historique.
Routes fixes réservées : `accueil`, `reglages`, `recherche`, `bilan`. Les tests vérifient qu'ils ont les mêmes clés et font passer chaque type de bout
en bout (création, entrée, vue, réglages, résumé, contexte, export puis import validé).

## Synchronisation

### Contrat d'un adaptateur

`db.doc(path)` fournit `get()` → `{ exists, data() }`, `onSnapshot(cb, err)` → désabonnement, et soit
`replace(value, attendu, { keepalive })` → booléen (écriture conditionnelle), soit `set(value)`.
Deux implémentations : `window.claude.use("db")` (claude.ai, `set` seulement) et `supabaseDb` (REST).

### Lire, fusionner, écrire sous condition

Chaque store garde, en plus de ses données, une **base** (`<clé>-base`) : le dernier état connu commun
avec le serveur. `sync()` :

1. lit le serveur ;
2. fusionne à trois voies (`mergeDocs(base, local, distant)`) : un côté inchangé depuis la base cède la
   place à l'autre ; si les deux ont changé, les objets fusionnent clé par clé et les listes d'objets
   à `id` entrée par entrée ; une suppression n'est appliquée que si l'autre côté n'a pas modifié
   l'entrée ; pour une simple valeur, le document le plus récent (`updatedAt`) l'emporte ;
3. écrit **sous condition** : le PATCH Supabase porte le filtre `colonne->>updatedAt=eq.<valeur lue>`.
   Zéro ligne modifiée signifie qu'un autre appareil a écrit entre-temps : on relit et on refusionne
   (trois essais) ;
4. adopte le résultat, en refusionnant par-dessus ce que l'utilisatrice a saisi pendant l'aller-retour.

Une seule synchro à la fois par store. Déclencheurs : 900 ms après une modification, toutes les 30 s
(onglet visible), au retour en ligne ou au premier plan. La relecture des 30 s demande d'abord la seule date de la
dernière écriture (`select=u:site->>updatedAt`, quelques octets) : si c'est celle de la base et que l'appareil n'a
rien à envoyer, le document n'est pas relu. Sinon, relecture complète et fusion, comme avant. À la fermeture, une écriture conditionnelle
`keepalive` sans relecture, pour un document de moins de 60 000 octets (les navigateurs refusent au-delà de 64 Kio) ;
sinon, ou si elle échoue, les données restent locales (copie de secours, ADR 13) et partent au lancement suivant.

Sans base (premier contact d'un appareil) : un appareil vierge adopte le serveur, sinon on fusionne
sans rien supprimer. L'import d'une sauvegarde remplace au lieu de fusionner (`replaceAll`).

### Session

Seul un refus explicite du serveur (400 / 401 au rafraîchissement) met fin à la session ; réseau
coupé ou 5xx laissent l'app travailler en local, avec « Non synchronisé » affiché. Le jeton est
rafraîchi s'il lui reste moins de 10 min (vérification toutes les 5 min), jamais deux fois en même
temps (les refresh tokens sont à usage unique). La déconnexion pousse d'abord les modifications en
attente (et demande confirmation si c'est impossible), puis efface de l'appareil les données, la base
et la conversation avec l'assistant ; la clé API, gardée chiffrée par la fonction `assistant`, reste au compte.

## Sécurité

- **Frontière de plateforme** : seul `platform.js` touche à `localStorage`, `sessionStorage`, `window.claude`
  et `navigator.storage` (vérifié par `tests/platform.test.js`). Les secrets de l'appareil (session Supabase,
  clés OpenAlex et Zotero, adresse privée d'agenda) passent par `platform.secrets` : sur le web, le même
  `localStorage` que le reste, donc lisibles par un script qui s'exécuterait dans la page (d'où la CSP
  ci-dessous) ; une coquille native les rangera dans le trousseau du système.
- **Clé Anthropic** : jamais dans la page. La fonction `assistant` (docs/assistant.md) la reçoit une fois, la vérifie
  auprès d'Anthropic, la chiffre (AES-GCM, secret du serveur, identifiant du compte en données associées) dans la
  table `assistant_keys` (RLS sans règle : aucun navigateur n'y accède) et relaie les messages, champs filtrés et
  bornés. La CSP ne permet plus à la page de joindre `api.anthropic.com`.
- **Isolation entre comptes** : RLS sur `app_state` (`auth.uid() = user_id`). La clé publique Supabase
  est faite pour être exposée ; la clé `service_role` ne doit jamais entrer dans ce dépôt.
- **Injection** : toute donnée insérée dans le HTML passe par `esc()` ; les identifiants de module sont
  en plus contraints par `MODULE_ID`. Un fichier de sauvegarde est traité comme hostile : forme des
  identifiants, bornes des nombres, dates réelles, types connus.
- **CSP** du build hébergé : pas de `'unsafe-inline'` pour les scripts ; `build.py` inscrit l'empreinte
  SHA-256 des deux seuls scripts de la page (le script principal, l'enregistrement du service worker), donc
  un script injecté ou un attribut `onerror=` est refusé par le navigateur même si l'échappement faillait
  (`tests/browser/csp.js`). Les styles gardent `'unsafe-inline'` (voir ADR 8). Polices servies par le site
  (`font-src 'self'`, dossier `fonts/`). Connexions limitées à `*.supabase.co` et aux services publics de la phase 1, chacun nommé (Open-Meteo, Crossref, Microlink,
  MusicBrainz, OpenAgenda (Opendatasoft), OpenAlex, Zotero ; images de Cover Art Archive) : voir [connexions.md](connexions.md).
- **Assistant** : ne lit que les modules cochés dans Réglages → Assistant ; ses actions sont revérifiées
  à l'exécution (module actif, écriture autorisée) et passent par les mêmes règles métier que l'interface. Chacune
  attend l'accord de la personne, qui voit en texte brut ce qui serait écrit (T14 : un texte lu par l'assistant peut
  porter une consigne injectée ; `runTool`).

## Vérification

Les outils (esbuild, eslint, Playwright, Deno) sont épinglés dans `package.json` et `package-lock.json` ; la CI les
installe par `npm ci`, et les scripts npm sont les seules commandes, en local comme en CI :

| Script | Ce qu'il fait |
|---|---|
| `npm run build` | `python3 build.py` : assemble la plateforme et l'application (esbuild), génère `selene.html` et `index.html` |
| `npm run build:dist` | les trois sorties dans `dist/` : web (Pages), artefact (claude.ai), natif (Capacitor, Tauri) ; ADR 14 |
| `npm run build:check` | refuse des HTML générés qui ne correspondent pas aux sources |
| `npm test` | tests unitaires Node (`tests/*.test.js`) |
| `npm run test:syntax` | `node --check` sur chaque source (`src/`, `src/app/`, `src/core/`, `src/native/`, `scripts/`), arrêt au premier fichier invalide |
| `npm run lint` | eslint sur chaque module (`src/`, `sourceType: "module"`), l'amorçage natif, `scripts/` et `sw.js` |
| `npm run i18n` | les textes marqués pour la traduction confrontés aux dictionnaires : orphelins, valeurs `{n}`, langues proposées complètes ; ADR 25 |
| `npm run test:functions` | types et tests Deno des fonctions Supabase (passeur, assistant) |
| `npm run test:browser` | parcours Playwright dans Chromium (`npx playwright install chromium` une fois) ; `SELENE_BROWSER=webkit` pour WebKit |
| `npm run check` / `check:all` | tout sauf le navigateur / tout |

`pages.yml` ne publie que si tout est vert.

- `tests/hosted-harness.js` : le build hébergé dans une VM Node, avec un faux PostgREST partagé entre
  plusieurs « appareils » ; `auth.test.js` et `sync.test.js` s'en servent.
- `modules.test.js`, `app.test.js`, `backup.test.js`, `domain.test.js` : règles métier, registres,
  routage, sauvegardes hostiles.
- Les tests d'un module pur l'importent (`require` d'un module ES, Node 22) ; ceux qui ont besoin de toute
  l'application exécutent le script assemblé dans une VM et lisent l'espace de noms `__selene` ;
  `platform.test.js` évalue `platform.js` (traduit en CommonJS par esbuild) avec les globales de chaque cas ;
  `architecture.test.js` vérifie les couches et l'ordre de chargement ; `i18n.test.js`, les langues et la réserve
  des noms de la traduction.

- `tests/browser/` : parcours dans un vrai Chromium (Playwright), un fichier par sujet, lancés par
  `run.js` contre un petit serveur de fichiers statique ; chaque vérification affiche ✓ / ✗ et un seul ✗
  fait échouer la CI (job `browser`). On y voit ce que le faux DOM des tests unitaires ne voit pas :
  focus, rechargements, téléchargements, boîtes de confirmation, synchro à deux appareils (faux Supabase
  par interception réseau), horloge simulée pour le minuteur.

Hors CI, à vérifier à la main : la PWA installée sur iPhone et l'artefact claude.ai.

## Décisions (ADR)

### ADR 1 — Supabase par appels REST, sans SDK

- **Contexte** : comptes multi-utilisateurs et synchro sur une PWA statique, sans étape de build JS.
- **Décision** : `fetch` direct vers GoTrue (`/auth/v1`) et PostgREST (`/rest/v1`).
- **Écarté** : `@supabase/supabase-js` vendorisé (bundle volumineux, difficile à relire, une copie
  corrompue a déjà été rencontrée) ; un backend maison (un serveur à héberger et surveiller).
- **Conséquences** : ~200 lignes lisibles dans `src/app/services/auth.js` ; le renouvellement de jeton et les erreurs
  sont à notre charge (et testés).

### ADR 2 — Une ligne par personne, deux colonnes JSON

- **Contexte** : les données vivaient déjà en deux documents JSON locaux.
- **Décision** : `app_state(user_id, board jsonb, site jsonb, updated_at)`, protégée par RLS.
- **Écarté** : une table par collection (migrations de schéma à chaque évolution, requêtes multiples,
  code de synchro beaucoup plus gros pour un usage personnel).
- **Conséquences** : aucun changement de schéma quand l'app évolue ; la granularité fine de la synchro
  est assurée côté client (ADR 3). Limite : chaque écriture renvoie le document entier.

### ADR 3 — Fusion à trois voies et écriture conditionnelle côté client

- **Contexte** : « le dernier qui écrit gagne » sur tout le document perdait les modifications d'un
  appareil dès que deux travaillaient en parallèle ou hors ligne.
- **Décision** : base gardée localement, fusion par clé et par `id` d'entrée, PATCH conditionnel sur
  `colonne->>updatedAt`.
- **Écarté** : verrous (inutilisables hors ligne) ; CRDT (Conflict-free Replicated Data Types :
  structures qui fusionnent toujours sans conflit, mais au prix d'une bibliothèque et d'un format de
  données entièrement différent) ; horodatage par champ (données alourdies, horloges d'appareils
  divergentes).
- **Conséquences** : rien n'est perdu en cas de modifications concurrentes ; une suppression peut être
  annulée si l'autre appareil avait modifié l'entrée ; pour une même valeur modifiée des deux côtés,
  l'horloge décide.

### ADR 4 — Relecture toutes les 30 s plutôt que Realtime

- **Contexte** : peu d'appareils, peu de modifications, besoin de fonctionner hors ligne.
- **Décision** : relecture périodique (onglet visible) et au retour au premier plan.
- **Écarté** : Supabase Realtime (WebSocket, publication à configurer, reconnexions à gérer).
- **Conséquences** : jusqu'à 30 s de délai entre deux appareils ouverts en même temps ; aucune pièce
  mobile supplémentaire.
- **Révision (2 octobre 2026, audit T8)** : relire le document entier toutes les 30 s coûtait, pour un gros
  historique, plusieurs gigaoctets par mois et par appareil ouvert. La relecture demande désormais la date de la
  dernière écriture, et le document seulement si elle a changé (ou si l'appareil a des modifications à renvoyer).

### ADR 5 — Deux registres de types de module, un par couche

- **Contexte** : un type était décrit à une dizaine d'endroits (chirurgie au fusil de chasse).
- **Décision** : `MODULE_TYPES` (pur, dans `domain.js`) et `TYPE_UI` (affichage, un fichier par type dans `src/app/modules/`),
  cohérence vérifiée par test.
- **Écarté** : un registre unique (la validation des sauvegardes et les règles métier dépendraient du
  code d'affichage et ne seraient plus testables sans DOM) ; des classes par type (même découpage,
  plus de cérémonie).
- **Conséquences** : ajouter un type = deux entrées. Décision ultérieure : tous les modules deviennent
  génériques, par étapes (collection d'abord, puis notes, budget, tâches), chacune avec sa version de
  format ; l'assistant reste une fonction système.

### ADR 6 — Normaliser à l'entrée des données

- **Contexte** : `S()` migrait et complétait les données à chaque appel, donc chaque lecture pouvait
  les modifier et un module supprimé risquait d'être recréé.
- **Décision** : crochet `normalize` du store, appliqué à chaque entrée de données ; `S()` en lecture
  seule.
- **Conséquences** : une seule forme de données en mémoire ; toute nouvelle voie d'entrée doit passer
  par le store.

### ADR 7 — Outils épinglés par package.json, sans dépendance de production

- **Contexte** : la CI installait ses outils à la volée (`npx --yes eslint@…`, `npm i --no-save playwright@…`,
  CLI Supabase `latest`) : versions épinglées une à une, ou pas du tout, et rien de commun avec le poste
  local. Les coquilles natives prévues (Capacitor, Tauri) ajouteront des dizaines de paquets.
- **Décision** : un `package.json` privé, uniquement des `devDependencies` en version exacte, un
  `package-lock.json` versionné, `npm ci` en CI ; `.nvmrc` fixe Node 22 pour la CI et le poste local ;
  la CLI Supabase du déploiement est épinglée.
- **Écarté** : réécrire `build.py` en Node dès maintenant (ce sera le rôle du bundler, plus tard) ;
  `"type": "module"` (les tests sont en CommonJS).
- **Conséquences** : l'application publiée reste sans dépendance ; Python reste requis pour le build tant
  que `build.py` existe ; monter un outil = changer `package.json` et régénérer le lockfile.

### ADR 8 — CSP par empreintes pour les scripts, WebKit en CI

- **Contexte** : `script-src 'unsafe-inline'` laissait l'échappement (`esc()`) seul rempart contre une
  injection. Or la page n'a que deux scripts, tous deux inline par construction (l'artefact claude.ai doit
  tenir en un fichier), et aucun gestionnaire `on…=` dans le HTML produit. Par ailleurs, les coquilles
  natives prévues tourneront dans WebKit (iOS, Tauri sous macOS et Linux), que la CI n'exécutait pas.
- **Décision** : `build.py` calcule l'empreinte SHA-256 de chaque script et l'inscrit dans `script-src` ;
  un scénario vérifie qu'aucune vue ne viole la CSP et qu'un script injecté est bloqué. Les parcours de
  navigateur tournent dans Chromium et WebKit (matrice de `check.yml`, `SELENE_BROWSER`).
- **Écarté** : un fichier `.js` externe (casse l'artefact en un seul fichier) ; un nonce (exige un serveur
  qui en tire un à chaque requête, GitHub Pages sert des fichiers statiques) ; retirer `'unsafe-inline'` de
  `style-src` (l'interface pose plus de 150 attributs `style="…"`, qu'une empreinte ne couvre pas sans
  `'unsafe-hashes'` ; une injection de style peut défigurer ou exfiltrer par sélecteurs, pas exécuter de code).
- **Conséquences** : tout nouveau script inline passe par `build.py` (sinon il est bloqué, et le scénario
  `csp` échoue) ; ne jamais écrire de gestionnaire `onclick=` dans un gabarit : `data-act` et délégation.

### ADR 9 — Le noyau en modules ES, assemblé par esbuild (étendu à toute l’interface : ADR 22)

- **Contexte** : les fichiers de `src/` partageaient une seule portée, concaténés par `build.py` : leurs dépendances
  n'étaient écrites nulle part (l'ordre de chargement seul les trahissait), un fichier pur ne se testait qu'exécuté
  brut dans une VM, et `no-undef` n'avait de sens que sur le script entier.
- **Décision** : les fichiers purs deviennent des modules ES (`src/core/`, `import` / `export` explicites), qu'esbuild
  (version exacte, `package.json`) assemble au format IIFE **en tête** du script unique ; `build.py` y ajoute
  `const { … } = __core;`, avec les noms que liste le métafichier d'esbuild, pour les fichiers historiques. La
  migration part des feuilles : un fichier n'entre au noyau que s'il ne dépend que du noyau.
- **Écarté** : Vite (fait pour un framework et un serveur de développement, dont Selene n'a pas l'usage ; il
  s'appuie lui-même sur esbuild et Rollup) ; une sortie ESM ou des `<script type="module">` (un module ne partage pas
  sa portée avec les fichiers historiques ; plusieurs scripts, ou un fichier externe, cassent l'artefact en un seul
  fichier) ; tout convertir d'un coup (l'interface dépend d'elle-même dans tous les sens et de l'état global : en
  tirer des modules serait y traîner ce code) ; réécrire `build.py` en Node dans le même mouvement.
- **Conséquences** : les deux sorties gardent un seul script inline, dont `build.py` calcule l'empreinte CSP sur le
  texte final, comme avant (ADR 8) ; le build demande Node et `npm ci` en plus de Python ; dans les HTML, le noyau est
  tel qu'esbuild l'écrit (sans commentaires : on le lit dans `src/core/`) ; un module se teste en l'important.
  La ligne `const { … } = __core;` porte `eslint-disable-next-line no-unused-vars` (une exportation peut ne servir
  qu'aux modules entre eux ou aux tests) ; `no-undef` sur le script assemblé signale, lui, tout nom qu'un fichier
  historique utilise sans qu'un module l'exporte. Un fichier historique n'entre au noyau que lorsqu'il ne lit plus
  rien de la portée commune.
- **Restent historiques** : `platform.js` (les API de l'hôte, par nature ; voir ADR 10), `store.js` (`render`, `setSaving`, `clone` d'`app.js`), `auth.js` et `passeur.js`
  (`hosted`, `esc`, l'état et la session), `app.js`, `types.js`, `assistant.js` et `boot.js` (l'interface, qui
  dépend d'elle-même dans tous les sens), `dehors.js` (lit les flux par `window.DOMParser` ; du noyau, il n'emprunte
  que `clip`).

### ADR 10 — Une couche `platform`, seul accès aux API de l'hôte

- **Contexte** : `localStorage`, `sessionStorage` et `window.claude` étaient lus en direct dans six fichiers
  (environ 70 endroits). Les coquilles natives prévues (Capacitor sur mobile, Tauri sur ordinateur) n'offrent
  pas les mêmes API : stockage asynchrone, trousseau du système pour les secrets, pas de service worker.
- **Décision** : `src/platform.js`, premier fichier historique du script (après le noyau, qui n'en a pas besoin), expose `platform.storage` (données de
  l'appareil), `platform.secrets` (session, clés d'API, adresse d'agenda), `platform.session` (durée de
  l'onglet), `platform.claude` (espaces de noms de l'artefact), `platform.runtime()` et `platform.persist()` ;
  `hosted()` y est défini. Toutes les opérations sont sûres (null ou false, jamais d'exception). Un test
  refuse tout accès direct ailleurs.
- **Écarté** : attendre la coquille native pour découper (on découperait sous la pression d'une plateforme) ;
  une API asynchrone dès maintenant (tout le code de rendu lit le stockage de façon synchrone : ce sera
  l'objet d'une façade en mémoire, hydratée au démarrage, avant tout backend natif).
- **Conséquences** : comportement inchangé sur le web et dans l'artefact (mêmes clés, même stockage) ;
  une coquille native n'a qu'un fichier à remplacer ; `authResetLocal` efface les secrets par
  `platform.secrets`, pour qu'aucun ne survive à une déconnexion quel que soit leur coffre.

### ADR 11 — Coffres natifs asynchrones derrière une façade synchrone, démarrage par `platform.ready`

- **Contexte** : tout le code lit le stockage de façon synchrone, et dès son chargement (`makeStore`, la
  session, les préférences). Les coffres d'une coquille native sont asynchrones (Preferences ou SQLite sous
  Capacitor, fichiers ou trousseau sous Tauri) ; et sous iOS, le `localStorage` d'une WebView peut être évincé
  quand l'espace manque : pour une app locale d'abord, c'est la perte de la source de vérité.
- **Décision** : la coquille pose `window.seleneNative = { runtime, storage, secrets }` avant le script, deux
  coffres `{ load, write, remove }` asynchrones. `platform.storage` et `platform.secrets` en tiennent alors une
  copie en mémoire, hydratée une fois ; les lectures restent synchrones, chaque écriture part vers le coffre
  sans être attendue, en file par clé (deux écritures ne s'inversent jamais), et `platform.flush()` attend
  celles en cours (appelé avec `flushAll`, à la mise en arrière-plan). `build.py` place tous les fichiers
  historiques après `platform.js` dans `platform.ready(() => { … })` : sur le web et dans l'artefact, ready
  démarre aussitôt, de façon synchrone (comportement et ordre inchangés) ; en natif, après l'hydratation. Si
  celle-ci échoue, rien ne démarre et un message le dit.
- **Écarté** : une copie en mémoire sur le web aussi (localStorage est déjà synchrone ; une copie serait
  périmée par un autre onglet ou les outils du navigateur, et n'apporterait rien) ; une injection synchrone
  des données par la coquille avant le script (possible sous Tauri et iOS, mais lie le format du stockage au
  code natif, et un document de plusieurs Mo passerait par un script d'initialisation) ; démarrer sur un
  stockage vide quand le coffre est illisible (le premier enregistrement écraserait les vraies données).
- **Conséquences** : une coquille native n'écrit qu'un adaptateur de coffre ; les harnais de test injectent
  leurs accès dans `platform.ready` (avant `});\n})();`) ; `tests/platform.test.js` couvre l'hydratation,
  l'ordre des écritures, `flush`, un coffre qui refuse d'écrire et un coffre illisible. Seuil de sortie de
  `localStorage` (phase 13) : `npm run bench` affiche la taille du document `site`.

### ADR 12 — La clé Anthropic de chacun, gardée et utilisée par le serveur

- **Contexte** : l'assistant hébergé appelait Anthropic depuis le navigateur (`anthropic-dangerous-direct-browser-access`)
  avec une clé gardée dans `localStorage`. Pour une app distribuée, une seule faille de la page suffirait à vider les
  clés de tout le monde, facturées à chacun.
- **Décision** : une fonction Supabase Edge `assistant`, sur le modèle du passeur (session vérifiée, origines
  listées, débit par compte). Elle reçoit la clé une fois, la vérifie gratuitement (liste des modèles), la chiffre
  en AES-GCM (secret `ASSISTANT_KEY_SECRET`, identifiant du compte en données associées : une ligne copiée sous un
  autre compte ne se déchiffre pas) et ne la rend jamais ; elle relaie les messages avec le SDK officiel, en ne
  gardant que modèle, `max_tokens` (4096 au plus), consigne, messages et outils, sans flux ni en-tête choisi par la
  page ; adresse et authentification du SDK fixées dans le code. Ouverte à tout compte connecté : chacun paie avec
  sa clé. Une clé laissée par une ancienne version sur l'appareil est confiée au serveur puis effacée localement.
- **Écarté** : la clé de l'opératrice avec des quotas (sa facture deviendrait la variable d'ajustement de n'importe
  quel compte) ; la clé dans le coffre de l'appareil (le trousseau protège au repos, pas contre un script qui
  s'exécute dans la page et appelle Anthropic avec) ; un chiffrement par la base (pgsodium, Vault : plus de
  surface, et la clé du chiffrement vivrait à côté des données).
- **Conséquences** : `api.anthropic.com` sort de la CSP ; l'assistant hébergé demande un compte connecté et la
  fonction déployée (docs/assistant.md : table, secret, déploiement) ; la déconnexion ne supprime plus la clé,
  « Oublier la clé » l'efface du serveur. Réponses non diffusées en continu (comme avant), 60 s au plus.

### ADR 13 — Les données de la version web dans IndexedDB

- **Contexte** : `localStorage` plafonne vers 5 millions de caractères par site, toutes clés comprises, et chaque
  store y garde deux copies du document (lui et sa base de synchronisation). Un historique réaliste de plusieurs
  années (`npm run bench` : ~2,3 M caractères) en occupait déjà près de 90 %. Au-delà, l'écriture locale échoue
  sans bruit : l'appareil cesse de garder ce qu'on écrit.
- **Décision** : dans la version web, `platform.storage` passe par un coffre IndexedDB (base `selene`, magasin
  `kv`), lu par la même copie en mémoire que les coffres natifs (ADR 11) : lectures synchrones, écritures en file
  par clé. Au démarrage, chaque clé ordinaire de `localStorage` absente d'IndexedDB y est copiée en une
  transaction ; ce n'est qu'ensuite qu'elle quitte `localStorage` (IndexedDB l'emporte quand elle a déjà la clé).
  Les secrets restent dans `localStorage`. Les onglets se préviennent par `BroadcastChannel` (`selene-storage`)
  après chaque écriture validée, puisque IndexedDB n'a pas d'événement `storage`. L'artefact claude.ai reste sur
  `localStorage`.
- **Replis** : IndexedDB absente, ou qui échoue à l'ouverture ou pendant la migration, avant que `localStorage` ait
  été vidé : démarrage sur `localStorage`, rien n'a quitté l'appareil. Échec de lecture après la migration : rien ne
  démarre (ADR 11).
- **Écarté** : ne déplacer que les documents (deux mécanismes à tenir, pour un gain nul) ; une bibliothèque
  (idb-keyval, localForage : une dépendance de production pour vingt lignes) ; alléger la base de synchronisation
  (elle est ce qui permet la fusion à trois voies).
- **Conséquences** : le premier affichage attend l'ouverture d'IndexedDB (quelques millisecondes) ; une écriture
  n'est plus synchrone : une page fermée dans la milliseconde qui suit peut la perdre localement (le serveur, lui,
  reçoit la synchronisation). Les scénarios lisent le stockage par `storeGet` / `storeJSON` et l'écrivent par
  `storeSet` (tests/browser/helpers.js), qui prévient Selene comme un autre onglet ; `tests/browser/indexeddb.js`
  couvre la migration, la relance, deux onglets et un document de plus de 6 M caractères.
- **Révision (3 octobre 2026)** : la perte « dans la milliseconde » était plus large qu'écrit. Une capture faite dans
  la demi-seconde avant la fermeture se perdait une fois sur deux (`tests/browser/sync-deux-appareils.js`, instable
  sur une machine lente), et le serveur ne la rattrapait pas : l'écriture `keepalive` de la fermeture est refusée
  par les navigateurs au-delà de 64 Kio (T13 de l'audit), soit tout espace un peu rempli. Désormais,
  `platform.flush()` (fermeture, mise en arrière-plan) dépose d'abord, de façon synchrone, une **copie de secours**
  de chaque clé encore en route dans `localStorage` (`selene-secours:`), le document avant sa base, faute de place ;
  le démarrage suivant la reverse dans IndexedDB avant la migration (`restoreRescue`). Une écriture qui aboutit
  retire la copie de sa clé, dans tout onglet : une copie n'est jamais plus ancienne que ce qu'IndexedDB tient. Le
  store ne tente plus de `keepalive` au-delà de 60 000 octets et garde sa synchronisation ordinaire prévue
  (`KEEPALIVE_MAX`). Reste une limite : un document plus gros que la place libre de `localStorage` n'a pas de copie.
  Une écriture qu'IndexedDB **refuse** (quota plein, transaction annulée) n'est pas « aboutie » : elle reste en route,
  donc copiée à la fermeture, jusqu'à ce qu'une écriture de la même clé aboutisse ici, ou dans un autre onglet (qui le
  signale : `refresh`). Sans cela, une saisie refusée, serveur injoignable, était perdue des deux côtés
  (`tests/browser/secours.js`, qui annule l'écriture pour de bon).

### ADR 14 — Trois sorties de build : web, artefact, natif

- **Contexte** : `build.py` produisait deux pages versionnées à la racine (`index.html`, `selene.html`) et Pages en
  recopiait une partie à la main. Les coquilles natives demandent une troisième page : sans service worker (non pris
  en charge dans une WebView iOS, inutile quand les fichiers sont déjà sur l'appareil) ni manifeste.
- **Décision** : `python3 build.py --dist` (`npm run build:dist`) écrit `dist/web/` (la PWA et ses fichiers : page,
  service worker, manifeste, icônes), `dist/artifact/selene.html` et `dist/native/index.html` (le même script, une
  seule empreinte dans la CSP, ni `worker-src` ni `manifest-src`). `dist/` n'est pas versionné. Pages publie
  `dist/web`, construit en CI depuis les sources ; `index.html` et `selene.html` restent versionnés à la racine
  (`build.py --check`, les tests, l'artefact à coller dans claude.ai).
- **Écarté** : une variable d'exécution qui ferait sauter le service worker en natif (même page pour tous : une
  empreinte CSP de trop, et le manifeste chargé pour rien) ; retirer tout de suite les pages de la racine (les
  scénarios et la documentation y renvoient ; plus tard).
- **Conséquences** : `tests/build.test.js` vérifie que `dist/web` et `dist/artifact` sont exactement les pages
  versionnées et que la page native n'autorise que son script ; `npm run test:browser` construit `dist/` d'abord, et
  `tests/browser/natif.js` tourne sur `dist/native/index.html`.

### ADR 15 — Android par Capacitor, autour de la page native

- **Contexte** : la PWA ne reçoit pas le partage d'Android hors de Chrome, dépend du stockage d'une WebView évinçable,
  et range les secrets dans `localStorage`.
- **Décision** : Capacitor 8 (`capacitor.config.json`, projet dans `native/android`, versionné sauf ce que
  `cap sync` copie) sert `dist/native`. Un amorçage (`src/native/boot.js`, premier script de la page native, autorisé
  par son empreinte) pose `window.seleneNative` : stockage dans des fichiers privés (plugin Filesystem, écriture par
  fichier temporaire renommé), secrets dans l'Android Keystore (plugin `@aparajita/capacitor-secure-storage`,
  appelé par ses méthodes natives : pas de JavaScript de plugin dans la page), bouton retour relié à l'historique,
  mise en pause changée en `pagehide`. Le partage (`ACTION_SEND`) est rendu à la page sous la forme du Web Share
  Target (`MainActivity`). Les fonctions Supabase acceptent l'origine `https://localhost` par défaut. L'APK de
  débogage est construit en CI (workflow *Android*) ; toutes les versions ont plus de 24 heures à l'adoption.
- **Écarté** : React Native ou Flutter (réécrire une app qui marche) ; Tauri mobile (moins mûr sur mobile) ;
  Preferences pour les données (un document de plusieurs Mo tout entier en mémoire des préférences) ; le JavaScript
  des plugins dans la page (un bundle de plus, et une empreinte CSP à suivre).
- **Conséquences** : Android ne demande que trois fichiers propres ; la dépendance de build `uuid` que tire la CLI de
  Capacitor (via `xcode`) porte un avis de sécurité modéré sans portée ici (API non utilisée, outil de build) ;
  l'essai sur un vrai téléphone reste manuel (docs/android.md).

### ADR 16 — Windows par Tauri 2, avec un cœur Rust à six commandes

- **Contexte** : sur ordinateur, Selene vit dans un onglet parmi d'autres ; ses secrets sont dans `localStorage`.
- **Décision** : Tauri 2 (`native/tauri`) sert `dist/native` dans la WebView du système. L'amorçage natif reconnaît
  `window.__TAURI__` (`withGlobalTauri`) et pose les coffres sur six commandes Rust : `store_*` (un fichier par clé,
  nom en hexadécimal, écriture par temporaire renommé) et `secret_*` (crate `keyring` : Gestionnaire d'identification
  de Windows ; la liste des noms dans un fichier, ces coffres ne sachant pas énumérer). Aucun plugin Tauri ni
  JavaScript de plugin : `core:default` seulement. La CSP de la page native autorise `ipc:` et
  `http://ipc.localhost` ; les fonctions Supabase acceptent `http://tauri.localhost` et `tauri://localhost`. Le
  workflow *Desktop* lance `cargo test` puis construit l'installateur NSIS sous Windows. Les icônes de l'app, et
  celles d'Android, sont tirées de `icon-512.png` (`tauri icon`).
- **Écarté** : Electron (un Chromium par app, cent Mo de plus) ; les plugins `fs` et `stronghold` de Tauri (leur
  JavaScript dans la page, des permissions à régler, pour ce que six fonctions font) ; Tauri pour le mobile
  (Capacitor, ADR 15).
- **Conséquences** : l'installateur n'est pas signé (avertissement SmartScreen) jusqu'à la publication ; le code Rust
  ne se compile qu'en CI (la WebView de Linux manque ici) ; le cœur est volontairement petit, pour être relu d'un
  coup d'œil.

### ADR 17 — Ce que l'app de bureau fait de plus : instance unique, raccourci, zone de notification, liens selene://

- **Contexte** : une app de bureau ne vaut que par ce qu'un onglet ne sait pas faire. Pour Selene, outil de capture,
  c'est d'abord capturer sans chercher la fenêtre.
- **Décision** : côté Rust seulement (aucun JavaScript de plugin, aucune permission de plus pour la page) : les
  plugins `single-instance` (avec `deep-link`), `global-shortcut` et `deep-link` (schéma `selene`), l'icône de la
  zone de notification de Tauri. Le cœur parle à la page par des événements du document (`selene:capture`,
  `selene:share`) injectés dans la WebView ; avant la fin du chargement, ils attendent (un lien peut lancer l'app).
  L'amorçage natif, premier script, range un partage dans la file que Selene lit à son démarrage (`selene-share`,
  celle du Web Share Target) ; Selene, si elle tourne, le prend aussitôt. Les champs passent par JSON, jamais tels
  quels dans le code injecté. Fermer la fenêtre la cache ; *Quitter* déclenche `pagehide` avant de sortir. Le
  raccourci qui échoue (déjà pris) n'empêche pas le démarrage. Tauri n'intercepte plus le glisser-déposer.
- **Écarté** : une seconde fenêtre de capture (une deuxième copie de Selene en mémoire, et deux fenêtres à
  synchroniser) ; le lancement au démarrage de la session (à la demande, plus tard) ; les API JavaScript des plugins.
- **Conséquences** : `tests/browser/bureau.js` fait tourner la page native sur un faux cœur Tauri (coffres,
  capture, partage) ; le test Rust vérifie qu'un texte partagé ne peut pas sortir de sa chaîne JSON.

### ADR 18 — iOS par la même coquille Capacitor ; les liens selene:// partout

- **Contexte** : sous iOS, la PWA dépend d'une WebView dont le stockage peut être évincé, et ne reçoit pas le
  partage. Une extension de partage native demande un App Group, donc un compte Apple Developer.
- **Décision** : `npx cap add ios` (`native/ios`, plugins par Swift Package Manager), les mêmes plugins et le même
  amorçage qu'Android : fichiers privés, Trousseau. Le schéma `selene` est déclaré sous iOS (`CFBundleURLTypes`) et
  Android (filtre `VIEW`) ; l'amorçage change `appUrlOpen` et `getLaunchUrl` en événements `selene:share` et
  `selene:capture`, les mêmes que ceux du cœur Tauri, avec la même file de partage. « Partager → Selene » passe, sous
  iOS, par un Raccourci qui ouvre `selene://share?…` (docs/ios.md). Le workflow *iOS* compile pour le simulateur,
  sans signature. L'icône vient de `icon-512.png`, sur le fond sombre de Selene.
- **Écarté** : une extension de partage tout de suite (App Group et signature, rien d'essayable ici) ; Tauri mobile.
- **Conséquences** : un seul chemin pour les liens sur les trois coquilles ; l'installation sur un iPhone attend la
  publication (compte, signature, TestFlight) ; l'icône 1024 garde un canal alpha, à aplatir pour l'App Store.

### ADR 19 — Notifications locales et retour haptique, dans les coquilles mobiles

- **Contexte** : ce qui rend une app mobile utile quand elle est fermée, c'est de pouvoir se rappeler à soi. Des
  notifications poussées demandent un serveur, des jetons d'appareil (APNs, FCM) et un calendrier côté serveur ;
  Selene n'a qu'un stockage et deux fonctions.
- **Décision** : des notifications **locales** (plugin `@capacitor/local-notifications`), programmées par l'appareil.
  À chaque rendu, Selene calcule le résumé des sept jours qui viennent (rappels de l'accueil qui proposent un geste,
  tâches qui arrivent à échéance ; un jour vide ne sonne pas) et, s'il a changé, remplace toute la liste programmée.
  Le réglage (activé, heure) est propre à l'appareil (`selene-notify`), désactivé par défaut ; la permission est
  demandée au moment où on l'active. `platform.notifications` et `platform.haptic()` n'existent que dans une coquille
  native ; l'amorçage appelle les plugins par `Capacitor.Plugins`, sans leur JavaScript. Android : pas de
  `SCHEDULE_EXACT_ALARM` (retirée du manifeste), une icône de barre d'état monochrome. Retour haptique léger
  (`@capacitor/haptics`) à la capture.
- **Écarté** : les notifications poussées (serveur, jetons, et le contenu des rappels hors de l'appareil) ; les
  notifications Web (il faut que la page tourne, ou un push) ; Windows pour l'instant (la zone de notification suffit).
- **Conséquences** : un rappel prévu dans six jours n'est connu du téléphone que si Selene a été ouverte depuis ; les
  textes sont ceux de l'accueil, en texte brut. Testé par `tests/app.test.js` (le plan), `tests/native-boot.test.js`
  (les appels aux plugins, une vraie `Date`) et `tests/browser/natif.js` (réglage, programmation, haptique).

### ADR 20 — Supprimer son compte depuis l'app ; une politique de confidentialité publiée

- **Contexte** : la publication (App Store, Google Play) exige qu'un compte créé dans l'app puisse y être supprimé, et
  une politique de confidentialité à une adresse publique. Effacer un utilisateur de Supabase Auth demande la clé
  serveur du projet, qu'aucune page ne doit détenir.
- **Décision** : une troisième fonction Edge, `compte`, sur le modèle des deux autres (`_shared/session.ts` : origines,
  session vérifiée, débit). Une seule action, `supprimer`, avec une confirmation tapée ; elle efface les données avant
  le compte, et chaque étape tolère ce qui est déjà parti (un nouvel essai termine). La clé serveur passe seulement
  dans l'en-tête `apikey`. Côté page : un bloc replié dans Réglages → Compte, puis le même vidage de l'appareil qu'à
  la déconnexion. La politique est une page statique, sans script, publiée avec le site.
- **Écarté** : une suppression différée (un délai de grâce demande une tâche planifiée et un état « en suppression ») ;
  une fonction SQL `security definer` appelée par la page (elle ne peut pas effacer `auth.users` proprement).
- **Conséquences** : `compte_test.ts` vérifie l'ordre, l'isolement entre comptes et les pannes ; la politique de
  confidentialité doit être mise à jour avec chaque nouveau service tiers (docs/compte.md).

### ADR 21 — Publier par une étiquette ; les clés dans les secrets, jamais dans le dépôt

- **Contexte** : chaque store veut un paquet signé et un numéro de build croissant ; les clés de signature sont les
  seules choses qui ne se reconstruisent pas.
- **Décision** : un workflow *Publication* déclenché par une étiquette `v1.2.3`, qui calcule la version et le numéro de
  build (`10203`), puis signe par plateforme avec les secrets du dépôt : Gradle lit la clé et la version dans
  l'environnement (sans elles, la version « release » reste non signée) ; Tauri reçoit la version et l'empreinte du
  certificat par `--config` ; iOS utilise la signature automatique d'Xcode avec une clé d'API App Store Connect (pas
  de certificat ni de profil à entretenir), et envoie à TestFlight. Une plateforme sans secrets est sautée avec un
  avis. La Release GitHub rassemble l'APK et l'installateur Windows. Le workflow Android de chaque PR éprouve le
  chemin de signature avec une clé jetable. L'icône iOS 1024 est aplatie sur le fond de Selene (l'App Store refuse
  la transparence).
- **Écarté** : fastlane (une chaîne Ruby de plus pour trois commandes) ; l'envoi automatique à Google Play (un compte
  de service de plus, et le premier envoi est manuel de toute façon).
- **Conséquences** : docs/publication.md liste ce qui reste à faire pour publier (comptes, clés, formulaires), et
  docs/a-faire.md tout ce qui reste à faire à la main ; le chemin iOS n'est éprouvé qu'à la première course avec un
  compte Apple.

### ADR 22 — Tout en modules ES : fin de la portée partagée

- **Contexte** : le noyau était en modules, mais l'interface (≈ 360 Ko en huit fichiers) était concaténée dans une
  seule portée : n'importe quelle fonction voyait et pouvait réaffecter n'importe quelle variable de n'importe quel
  fichier, et l'ordre de la liste de `build.py` décidait de ce qui marchait au chargement. Rien ne disait qui dépend
  de qui, ce qui rendait tout découpage risqué.
- **Décision** : chaque fichier de l'interface devient un module ES dans `src/app/`, avec ses imports et exports
  explicites (générés une fois par analyse de portée, puis tenus à la main), assemblé par esbuild. La plateforme est
  assemblée à part et évaluée d'abord ; l'application l'est dans `platform.ready`, et ses imports de la plateforme
  sont servis par la même instance. Les neuf écritures d'un fichier dans la variable d'un autre passent par une
  fonction de son propriétaire (`setOpenId`, `authToggleMode`, `passeurReset`…). Les registres partagés vont dans un
  module sans dépendance ; le store reçoit ses rappels vers l'interface au lieu de l'importer. Un test d'architecture
  vérifie les couches, l'absence d'écriture croisée et l'absence de cycle dans ce qui s'exécute au chargement ; eslint,
  fichier par fichier, fait de chaque dépendance un import. Les tests qui lançaient l'application lisent un espace de
  noms (`__selene`) au lieu de la portée.
- **Écarté** : un chargement paresseux par `import()` (démarrage asynchrone, et plus de démarrage synchrone sur le
  web) ; une seule passe esbuild avec la plateforme dedans (l'application s'évaluerait avant l'ouverture du
  stockage) ; l'interdiction de tout cycle d'import tout de suite (`app.js` et `types.js` s'appellent l'un l'autre :
  c'est le découpage suivant qui les défera).
- **Conséquences** : un fichier dit ce qu'il utilise ; déplacer une fonction, c'est déplacer ses imports. Le script
  produit est plus court (les commentaires ne sont plus copiés). Étape suivante, faite : ADR 23.

### ADR 23 — L'interface découpée par fonctionnalité

- **Contexte** : une fois en modules (ADR 22), l'interface tenait encore dans deux fichiers de 150 et 210 Ko,
  `app.js` (utilitaires, état, paysage, vues, navigation, rendu, actions) et `types.js` (tous les types de module et
  toutes les fonctionnalités transversales), qui s'appelaient l'un l'autre. Toucher au budget voulait dire ouvrir
  un fichier de 2 000 lignes, et une table d'actions unique modifiait l'état de dix fonctionnalités.
- **Décision** : 58 fichiers, rangés par fonctionnalité (dossiers `lib`, `state`, `services`, `scene`, `ui`, `shell`,
  `modules`, `features`, `views`), chacun annoncé par une phrase. Les coupes suivent les sections que le code avait
  déjà ; chaque déclaration est déplacée telle quelle, avec son commentaire, et les imports sont recalculés par
  analyse de portée. Un type de module s'enregistre par `registerType`, qui verse ses actions dans `CLICK` / `CHANGE`
  et refuse un doublon au chargement (au lieu d'une boucle finale, qui imposait l'ordre). La grande table d'actions
  est éclatée : chaque action rejoint la fonctionnalité qu'elle sert. Les bibliothèques (`lib/`) ne dépendent de rien
  de l'interface : `removeWithUndo` va avec les entrées, les espaces de noms de claude.ai dans `services/host.js`.
  Les écritures d'un fichier dans l'état d'un autre passent par une fonction de son propriétaire.
- **Écarté** : un framework de composants (réécriture, et une dépendance de production pour une page qui n'en a
  aucune) ; un découpage par couche technique seule (`views/`, `controllers/`…), qui disperse une fonctionnalité en
  cinq endroits ; supprimer tous les cycles d'import d'un coup (les vues et le rendu s'appellent encore : ce n'est
  sûr qu'au chargement, et c'est ce que le test d'architecture garde).
- **Conséquences** : le plus gros fichier fait 27 Ko (`features/dehors.js`) ; le test d'architecture a refusé deux
  dépendances au chargement pendant le découpage (`lib/dom.js` qui importait l'état) et elles ont été corrigées plutôt
  que tolérées. Le comportement est inchangé : mêmes 173 tests, mêmes 52 scénarios de navigateur.

### ADR 24 — Un widget d'écran d'accueil sous Android, qui ne calcule rien

- **Contexte** : un widget rend Selene visible sans l'ouvrir. Mais un widget qui recalcule seul (tâches, rappels,
  lune) devrait réimplémenter en Java ce que fait la page, ou réveiller une WebView en arrière-plan.
- **Décision** : le widget montre ce que la page lui a dit en dernier. À chaque rendu, Selene calcule la lune du jour
  et les trois choses qui attendent (tâches choisies pour aujourd'hui, puis rappels et échéances du jour : les mêmes
  que le résumé du matin), et les envoie si elles ont changé, par un plugin Capacitor propre à l'app
  (`WidgetPlugin.java`, enregistré dans `MainActivity`) qui les borne et les garde dans des préférences privées.
  `SeleneWidget.java` (un `AppWidgetProvider`) les affiche ; toucher le widget ouvre l'app, « + » ouvre la capture par
  le lien `selene://capture`. `updatePeriodMillis = 0` : aucun réveil programmé. `platform.widget` n'existe que là où la
  coquille en a un.
- **Écarté** : iOS pour l'instant (WidgetKit demande une extension Swift, un App Group partagé et donc une signature :
  à faire avec le compte Apple) ; un widget qui interroge lui-même le stockage (deux lectures du même document, deux
  vérités possibles).
- **Conséquences** : un widget à jour de la dernière ouverture, pas davantage ; le job *apk* compile le Java du widget
  à chaque PR ; `tests/native-boot.test.js`, `platform.test.js` et `app.test.js` vérifient le pont et le contenu.

### ADR 25 — Plusieurs langues : le français pour clé, un dictionnaire par langue

- **Contexte** : Selene ne parlait que français, et pas seulement par ses mots : de l'ordre de 1 500 textes écrits
  dans les gabarits HTML de 58 fichiers, la locale `fr-FR` inscrite à 25 endroits (dates, sommes, tris), un pluriel
  qui ajoute « s », des mots français servant de clés dans les données enregistrées (`"dépense"`, statuts, noms des
  modules de départ), des algorithmes qui supposent le français (mots vides de la dérive lexicale, pluriel en s/x,
  capture qui comprend, `statut:`), et une consigne « Réponds en français » à l'assistant. L'anglais est demandé.
- **Décision** :
  - un module maison, `src/app/i18n/` : `tr` (gabarit étiqueté : ``tr`Pleine lune dans ${n} j.` `` a pour clé
    « Pleine lune dans {0} j. »), `trp` (un contexte, comme `msgctxt` chez gettext), `trn` (pluriels par
    `Intl.PluralRules`, catégories du CLDR), `N_` (marque sans traduire). Le texte français reste dans le code et sert
    de clé ; ce qu'un dictionnaire ne traduit pas reste en français. Ces quatre noms sont réservés dans `src/app` (un
    test le vérifie) : `t`, le nom attendu, était déjà celui de 127 variables locales (une tâche, un modèle, une heure) ;
  - les formats passent par `Intl` dans la langue en vigueur (`uiLocale()`), les tris par un `Intl.Collator` gardé.
    La région suit la langue (fr → fr-FR, en → en-GB), pas l'appareil ; la monnaie reste l'euro, seule sa
    présentation change ;
  - la langue est un réglage du compte, synchronisé (`config.lang`) ; vide, c'est celle de l'appareil
    (`navigator.languages`) : les données de départ restent identiques d'un appareil à l'autre. Pas de nouveau
    `SCHEMA_VERSION` : le réglage manquant est complété à l'entrée, une ancienne version l'ignore ;
  - une langue n'est proposée (`READY_LANGS`) que complète. `npm run i18n` (CI) relève chaque texte marqué dans l'arbre
    syntaxique et refuse une traduction orpheline, une valeur `{n}` perdue ou inventée, un texte manquant dans une
    langue proposée. La pseudo-langue `qps`, jamais proposée, montre ce qui est passé par la traduction ;
  - on traduit l'affichage, jamais la donnée : les clés enregistrées gardent leur forme, ce que la personne a écrit
    n'est jamais traduit, un modèle l'est au moment où il crée un module. Le noyau reste pur : il rendra des codes
    d'erreur, que l'interface traduit ;
  - l'assistant répond dans la langue de l'interface ; l'app de bureau prendra celle du système pour son menu, que le
    cœur Rust construit avant la page (pas de septième commande, ADR 16).
- **Écarté** : i18next ou FormatJS (une dépendance de production et des dizaines de Ko pour ce qu'`Intl` fait déjà) ;
  des clés inventées (`reglages.apparence.titre`) : 1 500 noms à tenir, un code qui ne se lit plus, et plus de repli
  naturel sur le français ; des dictionnaires chargés à la demande (l'artefact est un seul fichier, et la CSP
  n'autorise que les scripts de la page) ; la seule langue de l'appareil (une anglophone sur un téléphone réglé en
  français ne pourrait pas choisir) ; la région de l'appareil pour les formats (des dates différentes d'un appareil à
  l'autre pour une même personne, et des tests qui dépendraient de la machine).
- **Conséquences** : la langue est appliquée à chaque rendu, avant tout texte ; en changer redessine sans recharger.
  Les dictionnaires voyagent dans le script. Les parcours de navigateur fixent la langue du navigateur (fr-FR,
  `tests/browser/helpers.js`) : sans cela, un runner en anglais basculerait l'interface dès l'ouverture de l'anglais.
  Corriger une virgule dans un texte français rend sa traduction orpheline : `npm run i18n` le dit, il faut la
  reporter. L'étape 1 ne change rien à l'écran (mêmes 52 scénarios verts, plus un pour la langue). Étapes et règles
  d'écriture : [i18n.md](i18n.md).

### ADR 26 — « Reprendre la main » : un suivi sensible dans un type de module

- **Contexte** : un espace facultatif de suivi du tabac, du cannabis, de l'alcool ou des réseaux sociaux est demandé
  (observer, réduire, viser l'arrêt), avec des récompenses facultatives. Ces données touchent à la santé : elles ne
  doivent ni nourrir les analyses transversales de Selene (recherche, motifs, dérive, test lunaire, bilans, planche),
  ni partir vers l'assistant sans un geste explicite. Et une donnée absente ne doit jamais passer pour une
  consommation nulle.
- **Décision** :
  - un type de module ordinaire (`regulation` : `MODULE_TYPES`, `registerType`), règles pures dans
    `core/regulation.js`, horloge et date locale passées en paramètres ; marqué `sensitive` dans `TYPE_UI`. Ses
    détails restent dans l'espace parce qu'il ne fournit aucun des hooks que lisent les surfaces transversales
    (`texts`, `alerts`, `badge`, `accept`) ; les quelques surfaces qui parcourent tous les modules sans hook (bilan,
    planche, liens, pont et reprise de l'accueil) testent `sensitive`. Le partage avec l'assistant est faux à la
    création d'un type sensible, et ne s'active qu'après lecture du résumé exact ;
  - une journée est complète par une confirmation qui garde l'instantané de ses quantités ; le noyau refuse de
    confirmer un instantané qui n'est plus celui que la personne a vu. Les marques sont dérivées des actions (une par
    date), jamais un compteur ; les objectifs, des versions datées jamais réécrites ;
  - `SCHEMA_VERSION` passe de 6 à 7 : une version antérieure planterait sur un type inconnu ; la garde existante
    l'empêche d'écrire.
- **Écarté** : un document ou une table à part, voire un chiffrement propre à cet espace (une infrastructure nouvelle
  pour un besoin que le store et ses fusions couvrent ; et promettre un coffre qu'on n'a pas construit) ; réutiliser
  le minuteur de quinze minutes pour la pause (unique, en mémoire, il déclenche le pont et les suites des modules) ;
  un compteur de points incrémenté (doublé par deux appareils, faux après une correction) ; des séries d'abstinence
  (une pression à tenir, pas un intérêt établi) ; valider à l'import le pas de l'unité ou les dates à venir (une
  fusion légitime pourrait produire un état qu'aucune sauvegarde ne restaurerait plus).
- **Conséquences** : le nom et la présence de l'espace restent visibles ; ses données suivent la synchronisation et les
  sauvegardes du compte, sans chiffrement de bout en bout, ce que l'espace dit lui-même. Tout futur parcours
  transversal qui lit les modules sans passer par un hook doit tester `sensitive` ; `tests/regulation.test.js` vérifie
  chaque surface existante. Fonctionnement, sources et limites : [regulation.md](regulation.md).

### ADR 27 — Un suivi sensible gardé sur un seul appareil : un second document local, l'accord pour synchroniser

- **Contexte** : dans les versions hébergées, un compte est obligatoire et tout le document du site est synchronisé :
  un suivi « Reprendre la main » (des données de santé, RGPD art. 9) finissait donc toujours sur le serveur. Un
  consentement seul aurait été décoratif : rien ne permettait de le refuser ou de le retirer (art. 7.3) sauf à
  renoncer au module. Et la déconnexion vide l'appareil, sans danger tant que tout existe aussi sur le serveur.
- **Décision** :
  - un choix par suivi, à la configuration : « sur cet appareil seulement » (présélectionné, art. 25) ou « sur mon
    compte » après un texte d'accord confirmé, daté et versionné (`config.consent`). Le retrait ramène le contenu sur
    l'appareil ; un suivi d'avant la question affiche un bandeau, rien ne change en silence ;
  - un **second document local** (`state/local.js`, `selene-local-v1`), tenu par le même `makeStore` que le site mais
    jamais relié au serveur ; le site n'en garde qu'un talon (`regulationStub` : nom, présence, `holder`). Le module
    lit son contenu par un accesseur ; ni le cœur de la synchronisation ni les autres types ne changent ;
  - à l'entrée de chaque version du site, le détenteur reprend les saisies qu'un appareil resté hors ligne aurait
    renvoyées dans le talon, et recrée un talon disparu ; les autres appareils ne voient que le nom et ne peuvent pas
    supprimer ;
  - une garde avant la déconnexion (exporter, synchroniser ou effacer) ; à un changement de compte, les suivis locaux
    sont mis de côté pour leur propriétaire ; la sauvegarde complète les contient, la restauration fait de l'appareil
    le détenteur ;
  - pas de pont de reprise dans un espace sensible (son texte irait dans le document synchronisé) ;
  - `SCHEMA_VERSION` 8 : une version 7 écrirait des saisies dans le talon.
- **Écarté** : une projection sortante (un seul document, les données retirées avant chaque envoi et réinjectées après
  chaque fusion) : aucun changement dans le module, mais le cœur de la synchronisation touché, et une suppression faite
  ailleurs ne s'appliquerait plus (la copie locale diffère toujours de la base) ; le chiffrement de bout en bout (une
  phrase secrète à gérer, perdue = données perdues, et des dates en clair qui trahiraient les jours d'activité) ; le
  consentement seul ; un document local par compte en permanence (un appareil partagé garderait les suivis de l'autre
  même après une déconnexion voulue).
- **Conséquences** : un suivi gardé sur l'appareil n'existe que là (l'export régulier est la seule assurance) et n'est
  pas chiffré au repos ; ses saisies ne sont ni sur le serveur ni dans les sauvegardes techniques de l'hébergeur (la
  sauvegarde du système de l'appareil, Google ou iCloud, peut les inclure : gardée et dite, 3 octobre 2026). Tout
  futur accès au contenu d'un type sensible passe par l'accesseur du module. `tests/regulation.test.js` (faux serveur)
  et `tests/browser/regulation-appareil.js` (deux appareils) lisent le serveur pour vérifier qu'aucune saisie n'y
  arrive. Détail : [regulation.md](regulation.md).
- **Révision (3 octobre 2026, T3 de l'audit)** : le choix « sur mon compte » et son accord disparaissent. Un suivi
  configuré connectée va sur l'appareil, sans question ; un suivi encore synchronisé est invité à y revenir, jamais
  l'inverse ; la garde de déconnexion n'offre plus que l'export ou l'effacement. Le type sort de l'offre publique
  (`MODULE_TYPES.regulation.personal`) : seul le compte marqué `selene_personnel` dans ses métadonnées serveur le voit
  proposé. `config.consent` reste lu, pour dire d'où vient un suivi encore synchronisé.

### ADR 28 — Selene sans compte dans la version hébergée

- **Contexte** : le site et les apps ouvraient sur un formulaire de connexion, sans un mot de ce que fait Selene
  (U1 de l'audit, 2 octobre 2026). Un outil « local d'abord » exigeait un compte avant la première note ; seul
  l'artefact claude.ai s'en passait. L'App Store refuse d'exiger un compte quand l'essentiel de l'app n'en dépend pas
  (App Review Guidelines, 5.1.1 (v)), et le relecteur d'Apple demande sinon un compte de démonstration.
- **Décision** (3 octobre 2026) :
  - l'écran d'entrée dit d'abord la promesse (positionnement A de l'audit) et propose **« Commencer sans compte »** ;
    le compte vient ensuite, pour qui en a un. Ni navigation ni minuteur avant d'être entrée ; la lune, si ;
  - sans compte, l'app est entière sur l'appareil, comme l'artefact : `selene-sans-compte` dans `platform.storage`
    (un choix de l'appareil), lu par `localOnly()`. `authGate()` décide de l'écran de connexion à la place de l'app ;
    rien de ce qu'on écrit ne part au serveur. Ce qui exige un compte (passeur, Dehors, assistant, synchronisation)
    reste fermé, comme avant, faute de session ;
  - Réglages → Compte dit ce que veut dire « sans compte » (effacer le navigateur efface tout) et ouvre la connexion ;
  - se connecter ensuite verse l'appareil dans le compte. Un compte neuf le reçoit tel quel ; un compte qui a déjà ses
    données le fusionne sans base commune (ADR 3) : les ajouts des deux côtés restent, et pour une même valeur
    (palette, nom) le compte l'emporte (`yieldToRemote` : la date locale passe à 1, pas à 0, qui ferait adopter le
    serveur et perdre ce qui a été noté). Un autre compte déconnecté plus tôt sur l'appareil n'efface rien : la
    déconnexion avait déjà vidé l'appareil, ce qui s'y trouve appartient à qui se connecte.
- **Écarté** : un compte « invité » anonyme chez Supabase (des lignes sans propriétaire joignable, et des données
  envoyées sans qu'on l'ait demandé) ; un mode démonstration aux données fictives (on ne garde rien de ce qu'on y
  essaie) ; adopter le serveur à la connexion (perdre ce qui a été noté sans compte).
- **Conséquences** : la politique de confidentialité décrit enfin un usage qui existe (« Sans compte ») : rien de ce
  qu'on écrit ne part, seul le journal des erreurs, anonyme, si on ne le coupe pas. Si la connexion échoue hors ligne,
  une modification faite avant la synchronisation suivante redonne la main à l'appareil pour les réglages.
  `tests/browser/sans-compte.js` : l'écran d'entrée, l'app sans compte, le retour, un compte neuf, un compte existant
  sur un appareil où un autre compte s'était déconnecté.

### ADR 29 — Une page publique de test, statique et sans traceur

- **Contexte** : l'audit (E3) demande de savoir si la promesse attire des inconnus du public visé avant d'investir :
  une page d'un écran, une liste d'attente, un prix annoncé, et un taux d'inscription mesuré par communauté.
- **Décision** (4 octobre 2026) : `essai.html`, construite par `build.py` depuis `src/essai.html` et `src/essai.js`,
  publiée avec le site, sans l'app. Une CSP stricte (`default-src 'none'`, script et styles par empreinte, Supabase
  seul en réseau). Deux tables en écriture seule (`attente`, `audience`, `supabase/schema.sql`), bornées par des
  déclencheurs (doublons ignorés en silence, plafonds horaires, purge). La mesure compte des ouvertures, sans cookie ni
  stockage ni identifiant : elle ne demande pas de consentement. « Essayer sans compte » ouvre l'app sur
  `index.html#sans-compte`, qui entre directement sans compte (ADR 28). Les captures viennent d'un espace fictif
  (`scripts/essai-captures.mjs`).
- **Écarté** : un outil de formulaires ou de mesure tiers (des données qui sortent, un traceur, un bandeau de
  consentement) ; une page dans l'app (850 Ko de script et un écran d'entrée, contre 24 Ko ici, pour un visiteur qui ne la
  connaît pas) ; un identifiant de visiteur pour dédoublonner (un traceur, donc un consentement).
- **Conséquences** : le taux mesuré est prudent (un visiteur qui revient compte deux fois). La lecture, l'envoi de
  l'e-mail de bêta et l'effacement de la liste se font à la main, dans l'éditeur SQL ([essai.md](essai.md)). Le
  service worker ne garde plus que l'app pour le hors-ligne (`sw.js` v3) : une page voisine prenait sa place.

### ADR 30 — Une mesure d'usage minimale pour la bêta : un jour, rien d'autre

- **Contexte** : la bêta fermée (E4 de l'audit) se juge sur deux seuils : 40 % des invités actifs le premier jour,
  25 % en semaine 4, mesurés par des saisies et non par des ouvertures. Sans mesure, la décision du jour 90 se prendrait
  à l'impression. Le journal des erreurs (T9) est anonyme par construction ; une rétention, elle, demande de
  reconnaître un même compte d'un jour à l'autre.
- **Décision** (4 octobre 2026) :
  - une table `activite` (compte, jour), clé primaire sur les deux. Elle s'écrit avec la session, pour soi seul : le
    déclencheur impose `auth.uid()`, refuse un autre jour qu'aujourd'hui (à un jour près, pour les fuseaux), ignore un
    doublon et purge au-delà de 90 jours. Personne ne la lit par l'API ; elle s'efface avec le compte (`on delete
    cascade`) ;
  - côté page (`services/activite.js`), on envoie au plus une ligne par jour et par chargement, après un enregistrement
    du site que la personne a provoqué (`navigator.userActivation`) et qui change le contenu d'un espace
    (`contentKey` : tout sauf `type`, `label`, `config`, et sans les champs vides), comparé à la dernière base
    synchronisée. Le store expose `onSave` pour cela. Rien n'est gardé sur l'appareil pour la mesure ;
  - seulement avec un compte, jamais dans l'artefact. Un interrupteur de *Réglages → Compte* la coupe pour
    l'appareil. Base légale : l'intérêt légitime (6.1.f), avec opposition.
- **Écarté** : un service d'analyse tiers (un sous-traitant de plus, des données hors de la base, souvent un traceur) ;
  compter les ouvertures (l'audit demande des saisies) ; un identifiant anonyme gardé sur l'appareil (un traceur au
  sens de l'article 82, donc un consentement) ; compter dans le contenu synchronisé `app_state` (lire les documents des
  personnes pour une autre finalité que la synchronisation) ; un compteur de saisies par jour (plus que ce qu'il faut
  pour deux seuils).
- **Révision (4 octobre 2026)** : la conservation passe de 13 mois à **90 jours**, comme le proposait l'audit
  (section 8) : lire les seuils d'une cohorte demande cinq semaines, et la limitation de la conservation (article
  5.1.e du RGPD) veut la durée la plus courte qui suffise. L'audit proposait aussi le **consentement** pendant la bêta ;
  l'intérêt légitime avec opposition est gardé. La mesure ne lit ni n'écrit rien sur l'appareil (pas d'article 82),
  ne garde qu'un jour par compte, et un interrupteur à allumer soi-même laisserait la bêta presque sans chiffres, donc
  sans décision possible au jour 90. Les invités en sont prévenus dans l'invitation ([validation.md](validation.md#e4--la-bêta-fermée-quatre-semaines)).
- **Conséquences** : la politique de confidentialité nomme la mesure, sa base et sa durée ; la requête des seuils et
  la réponse à une opposition se font dans l'éditeur SQL ([compte.md](compte.md#mesure-dusage-bêta)). Tant que la table
  n'existe pas sur le projet, rien n'est compté. Un appareil sans activation utilisateur connue (navigateur ancien)
  compte tout enregistrement qui change le contenu.

### ADR 31 — Donner un fichier dans les apps mobiles : la feuille de partage du système

- **Contexte** : chaque export (sauvegarde complète, Markdown, dossier, planche, BibTeX, CSL-JSON, suivi) passait par
  `lib/download.js` : le partage du navigateur s'il accepte des fichiers, sinon un lien `<a download>` vers un `blob:`.
  Dans les coquilles Capacitor, ni l'un ni l'autre ne marche : la WebView d'Android n'a pas l'API Web Share, et
  Capacitor ne lui donne pas de `DownloadListener` (un téléchargement y est ignoré, sans erreur) ; sous iOS, Capacitor
  confie un lien qui n'est pas celui de l'app au système, qui ne sait pas ouvrir un `blob:`. Trouvé en lisant les
  sources de Capacitor 8 (4 octobre 2026), jamais vu sur un appareil : aucun n'a encore lancé l'app. Or, sans compte,
  la sauvegarde est la seule copie de ses données.
- **Décision** : dans une coquille, `platform.files.share(nom, données, titre)`. L'amorçage écrit le fichier dans le
  cache de l'app (`@capacitor/filesystem`, dossier `exports`, un seul fichier à la fois, vidé au lancement), puis le
  confie à la feuille de partage du système (`@capacitor/share`) : « Enregistrer dans Fichiers », Drive, e-mail… Android
  le lit par le `FileProvider` de l'app (le cache est dans `file_paths.xml`). Refermer la feuille n'est pas une erreur ;
  une écriture refusée le dit. Le web et l'artefact ne changent pas.
- **Écarté** : un `DownloadListener` et un `WKDownloadDelegate` écrits à la main (du Java et du Swift à tenir, pour
  deux comportements différents) ; le dossier Documents public d'Android (le stockage cloisonné le rend incertain selon
  la version, et la personne ne sait pas où le fichier est allé) ; laisser l'app sans export (la portabilité est promise
  à tous, et l'offre gratuite sans compte en dépend).
- **Conséquences** : un plugin de plus, officiel, sans accès réseau ni API à justifier pour Apple. Un export ne laisse
  pas de copie durable dans l'app : il vit dans le cache jusqu'au suivant ou au prochain lancement. Testé par
  `tests/native-boot.test.js` (cache, nom, feuille, refus) et `tests/browser/natif.js` (la sauvegarde part vers la
  coquille et jamais vers un téléchargement ; refermée, silence ; refusée, un message). Reste à le voir sur un vrai
  téléphone ([a-faire.md](a-faire.md#essayer-sur-de-vrais-appareils)). Sous Windows (Tauri), le téléchargement de la
  WebView reste le chemin, non vérifié.
