# Architecture de Selene

Ce document décrit l'état actuel du code et, en fin de fichier, les décisions qui l'ont façonné
(ADR : contexte, décision, alternatives écartées, conséquences). Il remplace l'ancien plan de
refactorisation, dont toutes les étapes sont livrées ou abandonnées au profit de ce qui suit.

## Deux cibles, une source

`python3 build.py` concatène les fichiers de `src/` dans **un seul script**, enveloppé dans une
fonction immédiatement exécutée, et l'insère dans `src/shell.html` :

| Sortie | Pour | Particularités |
|---|---|---|
| `selene.html` | artefact claude.ai | synchro par `window.claude.use("db")`, assistant sans clé |
| `index.html` | PWA sur GitHub Pages | CSP, manifeste, service worker, comptes Supabase |

`hosted()` (= `!window.claude`) distingue les deux au démarrage. Ne jamais modifier les HTML générés :
la CI (`build.py --check`) refuse un HTML qui ne correspond pas aux sources.

### Ordre de chargement

Tous les fichiers partagent la même portée. Au **chargement**, un fichier ne peut utiliser que ce que
les précédents ont déclaré (les `const` sont inaccessibles avant leur ligne) ; à l'**exécution**
(dans une fonction appelée plus tard), tout est visible.

| Fichier | Rôle | Dépend au chargement de |
|---|---|---|
| `sync.js` | fusion à trois voies, pure | — |
| `store.js` | un document JSON : localStorage + synchro | — |
| `auth.js` | comptes et adaptateur Supabase (hébergé seulement) | — |
| `backup.js` | export / validation d'import | — |
| `domain.js` | règles métier, registre pur `MODULE_TYPES`, `SCHEMA_VERSION` | — |
| `app.js` | utilitaires, modules fixes, normalisation, stores, vues, rendu, actions | `store.js`, `domain.js` |
| `types.js` | registre d'affichage `TYPE_UI`, branché dans `CLICK` / `CHANGE` | `app.js` |
| `assistant.js` | contexte, outils, appels à Claude | — |
| `boot.js` | cycle de vie (flush, onglets), démarrage | tout |

## Données

Deux documents JSON par personne, chacun géré par un store (`makeStore`) :

- `board` (clé `selene-board-v1`) : les tâches du chantier ;
- `site` (clé `selene-site-v1`) : tout le reste — configuration, budget, moth, musique, capture et
  les **modules génériques** sous `modules`.

`site.schemaVersion` vaut 2 depuis les modules génériques (1 = anciennes sections `kundalini`,
`ecriture`, `phidippus` à la racine). Une version de l'app qui lit un numéro plus grand que le sien
refuse de fusionner et d'écrire (« recharge la page ») ; un import plus récent est refusé.

### Normalisation à l'entrée, lecture pure

`normalizeSite()` (migration des anciens formats, champs ajoutés depuis, entrées de navigation
manquantes) est passée au store, qui l'applique à **tout ce qui entre** : lecture locale, résultat de
synchro, import, réinitialisation, mise à jour venue d'un autre onglet. `S()` ne fait que lire.
Un module absent n'est jamais recréé : il a été supprimé exprès.

### Modules

- **Fixes** (`MODULE_DEFS`) : chantier, october.moth, musique, budget, assistant, capture. Code dédié,
  activables et renommables, pas supprimables.
- **Génériques** (`site.modules[id] = { type, label, config, entries, scraps? }`) : instances d'un
  type du registre. Kundalini, Écriture et Phidippus en sont ; on peut en créer et en supprimer.

Un identifiant de module sert aussi de route (`#id`) et d'attribut HTML : il doit respecter
`MODULE_ID` (`[a-z0-9-]`, 64 caractères), ne pas être réservé (`accueil`, `reglages`, noms de types,
noms d'`Object.prototype`), et le routage fait toujours primer les vues fixes.

### Ajouter un type de module

1. Une entrée dans `MODULE_TYPES` (`domain.js`) : `label`, `defaults()`, `entry(e, input)`,
   `validate(inst, v)`.
2. Une entrée dans `TYPE_UI` (`types.js`) : `view`, `settings`, `summary`, `context`, et selon le
   besoin `alerts`, `add`, `click`, `change`.

Rien d'autre : création, rendu, accueil, réglages, assistant et validation des sauvegardes passent par
ces deux registres. Les tests vérifient qu'ils ont les mêmes clés et font passer chaque type de bout
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
(onglet visible), au retour en ligne ou au premier plan. À la fermeture, une écriture conditionnelle
`keepalive` sans relecture ; si elle échoue, les données restent locales et partent au lancement suivant.

Sans base (premier contact d'un appareil) : un appareil vierge adopte le serveur, sinon on fusionne
sans rien supprimer. L'import d'une sauvegarde remplace au lieu de fusionner (`replaceAll`).

### Session

Seul un refus explicite du serveur (400 / 401 au rafraîchissement) met fin à la session ; réseau
coupé ou 5xx laissent l'app travailler en local, avec « Non synchronisé » affiché. Le jeton est
rafraîchi s'il lui reste moins de 10 min (vérification toutes les 5 min), jamais deux fois en même
temps (les refresh tokens sont à usage unique). La déconnexion pousse d'abord les modifications en
attente (et demande confirmation si c'est impossible), puis efface de l'appareil les données, la base,
la conversation avec l'assistant et la clé API.

## Sécurité

- **Isolation entre comptes** : RLS sur `app_state` (`auth.uid() = user_id`). La clé publique Supabase
  est faite pour être exposée ; la clé `service_role` ne doit jamais entrer dans ce dépôt.
- **Injection** : toute donnée insérée dans le HTML passe par `esc()` ; les identifiants de module sont
  en plus contraints par `MODULE_ID`. Un fichier de sauvegarde est traité comme hostile : forme des
  identifiants, bornes des nombres, dates réelles, types connus.
- **CSP** du build hébergé : scripts du site seulement, connexions limitées à Anthropic, Google Fonts et
  `*.supabase.co`.
- **Assistant** : ne lit que les modules cochés dans Réglages → Assistant ; ses actions sont revérifiées
  à l'exécution (module actif, écriture autorisée) et passent par les mêmes règles métier que l'interface.

## Vérification

`python3 build.py --check`, `node --test tests/*.test.js`, `node --check` sur chaque source et eslint
sur le script assemblé (`python3 build.py --bundle .lint/selene.js`, puis
`npx eslint@10.11.0 .lint/selene.js sw.js`) tournent en CI ; `pages.yml` ne publie que si tout est vert.

- `tests/hosted-harness.js` : le build hébergé dans une VM Node, avec un faux PostgREST partagé entre
  plusieurs « appareils » ; `auth.test.js` et `sync.test.js` s'en servent.
- `modules.test.js`, `app.test.js`, `backup.test.js`, `domain.test.js` : règles métier, registres,
  routage, sauvegardes hostiles.

Hors CI, à vérifier à la main après un changement d'interface : parcours dans un vrai navigateur, PWA
installée sur iPhone, artefact claude.ai.

## Décisions (ADR)

### ADR 1 — Supabase par appels REST, sans SDK

- **Contexte** : comptes multi-utilisateurs et synchro sur une PWA statique, sans étape de build JS.
- **Décision** : `fetch` direct vers GoTrue (`/auth/v1`) et PostgREST (`/rest/v1`).
- **Écarté** : `@supabase/supabase-js` vendorisé (bundle volumineux, difficile à relire, une copie
  corrompue a déjà été rencontrée) ; un backend maison (un serveur à héberger et surveiller).
- **Conséquences** : ~200 lignes lisibles dans `auth.js` ; le renouvellement de jeton et les erreurs
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

### ADR 5 — Deux registres de types de module, un par couche

- **Contexte** : un type était décrit à une dizaine d'endroits (chirurgie au fusil de chasse).
- **Décision** : `MODULE_TYPES` (pur, dans `domain.js`) et `TYPE_UI` (affichage, dans `types.js`),
  cohérence vérifiée par test.
- **Écarté** : un registre unique (la validation des sauvegardes et les règles métier dépendraient du
  code d'affichage et ne seraient plus testables sans DOM) ; des classes par type (même découpage,
  plus de cérémonie).
- **Conséquences** : ajouter un type = deux entrées ; les modules fixes restent du code dédié tant
  qu'aucun besoin de les dupliquer n'apparaît.

### ADR 6 — Normaliser à l'entrée des données

- **Contexte** : `S()` migrait et complétait les données à chaque appel, donc chaque lecture pouvait
  les modifier et un module supprimé risquait d'être recréé.
- **Décision** : crochet `normalize` du store, appliqué à chaque entrée de données ; `S()` en lecture
  seule.
- **Conséquences** : une seule forme de données en mémoire ; toute nouvelle voie d'entrée doit passer
  par le store.
