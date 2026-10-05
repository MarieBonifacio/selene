# Compte rendu — 2026-10-04-mise-en-place

Pas une campagne de recette : le relevé de ce qui a été **réellement exécuté** pendant la rédaction du cahier, pour que la
première campagne parte d'un état connu. Aucun cas manuel n'a été joué de bout en bout ; lire le code d'un test ne vaut
pas son exécution, et rien ici ne le prétend.

## Identification

| | |
|---|---|
| Identifiant de campagne | `2026-10-04-mise-en-place` |
| Type | vérification automatisée et sondes ponctuelles (hors des trois campagnes) |
| Date(s) | 4 octobre 2026 |
| Version testée | `main`, commit `768eb34`, puis `1ca8c4f` fusionné dans la branche `docs/cahier-de-recette` (le cahier ne modifie pas le code de l'app) |
| Commit du cahier utilisé | branche `docs/cahier-de-recette` (ce compte rendu en fait partie) |
| Environnement | conteneur Linux de développement, Node 22, Playwright 1.56.1 avec Chromium 141, Deno 2.9.6 ; page servie en local ; Supabase, Anthropic et les services externes **simulés** (interception des requêtes) |
| Exécutant(s) | Claude Code (session de mise en place), à la demande de la responsable du produit |
| Comptes et données | aucun compte réel ; comptes simulés ; jeux de [donnees/](../donnees/) |

## Critères d'entrée

- [x] Commit identifié (`768eb34`)
- [ ] CI verte sur ce commit : non vérifiée depuis l'environnement (les runs cités dans [perimetre.md](../perimetre.md) sont
  ceux de la CI GitHub, lus, pas relancés)
- [x] `npm run recette` vert sur la branche du cahier
- [ ] Comptes, clé de recette et appareils : sans objet ici (aucun essai réel)
- [x] Jeux de données disponibles ; jeu de volume généré (3,49 Mo)
- [ ] Gestionnaire de tickets : sans objet (les anomalies sont consignées dans [perimetre.md](../perimetre.md#anomalies-et-observations))

## Résultats des suites automatiques

| Suite | Commande | Résultat | Remarque |
|---|---|---|---|
| Tests Node | `npm test` | **réussi** : 268 tests, 0 échec, 0 ignoré | |
| Contrôles de `npm run check` | build, syntaxe, eslint, i18n, fonctions Deno | **réussi** | i18n : 1 696 textes, anglais traduit à 100 % |
| Fonctions Deno | `npm run test:functions` | **réussi** : 16 tests | |
| Scénarios de navigateur, Chromium | `npm run test:browser` | **réussi** : 73 scénarios, 1 067 vérifications | |
| Scénarios de navigateur, WebKit | `SELENE_BROWSER=webkit npm run test:browser` | **bloqué** | WebKit absent de l'environnement ; la CI les joue |
| Tests Rust | `cargo test` (`native/tauri`) | **bloqué** | `webkit2gtk-4.1` absent ; la CI les joue sous Windows |
| Compilations Android, iOS, Windows | workflows *Android*, *iOS*, *Desktop* | **bloqué** | ni SDK Android, ni Xcode, ni Windows ici ; la CI les compile |
| Isolation entre comptes | `npm run isolation` | **bloqué** | aucun projet de préproduction ni compte de test fournis |
| Banc de mesure | `npm run bench` | mesuré (aucun seuil) | accueil 31 ms, motifs 42 ms, bilan 46 ms, planche 38 ms, carte d'un motif 56 ms, recherche 3 ms, sortes 46 ms |
| Cohérence du cahier | `npm run recette` | **réussi** | 190 cas, 393 tests inventoriés, liens et jeux de données vérifiés |

Relancés en fin de rédaction sur la branche du cahier (commit `7c4b4f8`, code de l'app identique à `768eb34`) :
`npm run check` (268 tests Node, 16 tests Deno, build, syntaxe, eslint, i18n) et `npm run test:browser` sous Chromium
(73 scénarios, 1 067 vérifications) : **réussis**, mêmes résultats.

Puis, après la fusion de `main` (`1ca8c4f`, quatorze commits arrivés pendant la rédaction) dans la branche du cahier :
`npm run check` (277 tests Node, 16 tests Deno) et `npm run test:browser` sous Chromium (73 scénarios, 1 071
vérifications) : **réussis**. Playwright local : 1.56.1 (le `package.json` fusionné demande 1.63.0 ; la CI utilisera
celle-ci).

Enfin, le 5 octobre, après la fusion de `main` (`362f379` : exports natifs, import Markdown, relecture de la semaine,
suppression de compte sans l'app) : `npm run check` (284 tests Node, 16 tests Deno) et `npm run test:browser` sous
Chromium (75 scénarios, 1 101 vérifications) : **réussis**. La CI de la PR (Chromium, WebKit avec Playwright 1.63, iOS,
Android, Windows) était verte sur `8810be2`.

## Sondes ponctuelles dans Chromium

Des scripts jetables (non versionnés), qui pilotent la vraie page `index.html` avec un faux Supabase, pour vérifier les
résultats attendus des cas avant de les écrire. Ce ne sont pas des exécutions de cas : elles couvrent quelques étapes,
avec des services simulés.

| Ce qui a été vérifié | Cas dont les attendus en viennent | Constat |
|---|---|---|
| Chaque jeu de données s'importe (ou est refusé), treize vues sans erreur JavaScript, suivi restauré sur l'appareil, ancienne sauvegarde migrée | DON-001 à DON-006, RLM-* | conforme |
| Contenu exact de la requête envoyée à la fonction `assistant` (consigne, espaces partagés, outils, lecture seule) | AST-002, AST-003, AST-005 | conforme |
| Fonction `assistant` qui répond 404, ou injoignable | AST-007 | anomalie **A4** |
| Écrans de « Reprendre la main » avec les jeux de recette : verdicts, sept derniers jours, objectif gardé, totaux, suppressions, export | RLM-007 à RLM-019, RLM-025 | conforme ; anomalie **A5** (typographie) |
| Création et configuration par le compte personnel, garde de déconnexion | RLM-001, RLM-003, RLM-023 | anomalies **A6** et **A7** |
| Stockage de l'appareil effacé, identité gardée | RLM-029 | conforme à ce qu'écrit le code ; question posée |
| Interface en anglais, section « Confidentialité et données » | RLM-028 | résumé de l'assistant resté en français (question posée) |
| Import de notes Markdown, relecture de la semaine, sur le jeu d'essai et le coffre de recette | MOD-026, PEN-016 | conforme ; anomalie **A8** (un fichier illisible fait échouer l'import sans message) |

## Cas manuels

Les 190 cas : **non exécutés**. Ils demandent des appareils réels, le vrai projet Supabase, claude.ai, une clé Anthropic de
recette ou un lecteur d'écran, qui n'étaient pas disponibles ici.

## Synthèse

| Priorité | Réussis | Échoués | Bloqués | Non applicables | Non exécutés |
|---|---|---|---|---|---|
| P1 | 0 | 0 | 0 | 0 | 70 |
| P2 | 0 | 0 | 0 | 0 | 79 |
| P3 | 0 | 0 | 0 | 0 | 41 |

Anomalies relevées : A1 à A8 ([perimetre.md](../perimetre.md#anomalies-et-observations)), aucune corrigée.

## Réserves

Toute la couverture « plateformes réelles » reste à faire : la première recette complète devra exécuter en priorité les
cas P1 marqués *couvert partiellement* dans la [matrice](../matrice.md).

## Décision

Aucune : ce relevé ne conclut pas sur une livraison.

## Addendum du 5 octobre 2026

Les anomalies **A4** (assistant), **A5** (typographie des dates et résumé de l'assistant) et **A8** (import Markdown) ont été
corrigées par la PR #98, chacune avec un test vérifié en échec sur l'ancien code. Les autres (A1 à A3, A6, A7) restent
ouvertes ; A1 a reçu un correctif du test sur `main` (`3a79a01`), à confirmer sur la durée.

Les anomalies **A3** (message d'un import de sauvegarde refusé : trois causes distinguées, rien n'est dit du champ fautif)
et **A6** (texte « encore synchronisé » d'un suivi neuf) ont été corrigées par la PR #99, chacune avec un test vérifié en
échec sur l'ancien code (`TU-BAK-09`, `TU-REG-37`). Restent ouvertes : A1 et A2 (stabilité de la CI, à confirmer sur la
durée) et **A7** (le talon d'un suivi effacé à la déconnexion), qui attend une décision de produit.

**A7** (le talon d'un suivi effacé à la déconnexion) a été corrigée par la PR #101, après décision de la responsable :
l'effacement retire aussi le nom du compte. Deux tests le vérifient, tous deux en échec sur l'ancien code (`TU-REG-38`, fin de
`TN-regulation-appareil`). Pendant la vérification de cette PR, un échec isolé de `dehors.js` a été consigné comme **A9**
(délai fixe au démarrage du scénario, sans lien avec le correctif).
