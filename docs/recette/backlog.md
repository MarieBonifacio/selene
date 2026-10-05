# Backlog qualité

Ce que la recette a révélé et qui reste à faire : automatisations à prioriser, lacunes qui ne s'automatisent pas,
anomalies à qualifier, documentation à corriger, décisions à prendre. Rien de tout cela n'a été implémenté par la
mise en place du cahier : ce sont des propositions, à transformer en tickets par la responsable du produit. Chaque élément
garde son identifiant `BL-nn` (jamais renuméroté) ; un élément fait est barré dans la table et daté, pas supprimé.

**Priorités** : celles des cas ([README](README.md#priorité)). P1 : un défaut ici perd ou expose des données, ou casse un
parcours essentiel ; P2 : une fonction importante ; P3 : du confort.

| Identifiant | Proposition | Type | Priorité | Cas liés |
|---|---|---|---|---|
| [BL-01](#bl-01) | Scénario « l'appareil détenteur a perdu son stockage » | automatisation | P1 | RLM-029 |
| [BL-02](#bl-02) | Figer le sort du talon après « L'effacer définitivement » | décision puis automatisation | P1 | RLM-023 |
| [BL-03](#bl-03) | Rejouer l'isolation entre comptes chaque semaine en CI | automatisation | P1 | TRV-016 |
| [BL-04](#bl-04) | Balayage d'accessibilité rejoué à chaque PR | automatisation | P2 | TRV-001, TRV-002, TRV-003, TRV-006, TRV-014 |
| [BL-05](#bl-05) | Stabiliser `tests/browser/activite.js` sous WebKit | fiabilité de la CI | P2 | TRV-011 |
| [BL-06](#bl-06) | Assistant : dire « non déployé » ou « injoignable », et le tester | correctif puis automatisation | P2 | AST-007 |
| [BL-07](#bl-07) | Fumée de l'app Android sur émulateur, en CI | automatisation | P2 | PLT-003, PLT-004 |
| [BL-08](#bl-08) | Fumée de l'app Windows installée, en CI | automatisation | P3 | PLT-009, PLT-010 |
| [BL-09](#bl-09) | Seuils de performance sur le jeu de volume | décision puis automatisation | P2 | TRV-007 |
| [BL-10](#bl-10) | Minuit, app ouverte : horloge simulée | décision puis automatisation | P3 | TRV-004 |
| [BL-11](#bl-11) | claude.ai : ce qui ne s'automatise pas | lacune assumée | P2 | AST-009, PLT-011 |
| [BL-12](#bl-12) | ~~`npm run recette` dans la CI~~ (fait, voir ci-dessous) | outillage | P2 | tous |
| [BL-13](#bl-13) | Firefox : cible ou non ? | décision | P3 | — |

---

<a id="bl-01"></a>
### BL-01 — Scénario « l'appareil détenteur a perdu son stockage »

- **Risque couvert** : un suivi « Reprendre la main » gardé sur l'appareil dont le stockage a été vidé (nettoyage du
  navigateur, réinstallation) : un écran vide sans explication, ou un nom impossible à retirer. Aucun test ne couvre ce
  chemin ([RLM-029](manuels/reprendre-la-main.md#rlm-029), seul cas « à clarifier » sans automatique).
- **Scénario** : compte personnel sur faux Supabase (comme `tests/browser/regulation-appareil.js`) ; créer et configurer un
  suivi, une saisie ; exporter la sauvegarde complète ; effacer `selene-local-v1` du stockage (identité d'appareil
  gardée) ; recharger : le message « Ce suivi devait être gardé sur cet appareil… » ; importer la sauvegarde : la saisie
  revient ; refaire l'effacement puis retirer le nom : plus de talon côté serveur.
- **Niveau** : scénario de navigateur (mode H), Chromium et WebKit.
- **Dépendances** : aucune (helpers existants `storeSet`, `storeJSON`).
- **Bénéfice attendu** : un chemin de perte de données sensible vérifié à chaque PR ; RLM-029 passe à « couvert
  partiellement ».

<a id="bl-02"></a>
### BL-02 — Figer le sort du talon après « L'effacer définitivement »

- **Risque couvert** : anomalie [A7](perimetre.md#anomalies-et-observations) : après une déconnexion avec effacement, le nom
  du suivi survit sur le compte et l'app présente l'effacement voulu comme un accident.
- **Scénario** : après décision (retirer le talon, ou garder et reformuler le message), étendre la fin de
  `tests/browser/regulation-appareil.js` : déconnexion avec effacement, puis lecture du faux serveur et retour sur le même
  appareil.
- **Niveau** : scénario de navigateur (mode H).
- **Dépendances** : la décision de la responsable (question posée dans [RLM-023](manuels/reprendre-la-main.md#rlm-023)) ;
  un correctif si le comportement change.
- **Bénéfice attendu** : la promesse « effacer définitivement » tenue et vérifiée.

<a id="bl-03"></a>
### BL-03 — Rejouer l'isolation entre comptes chaque semaine en CI

- **Risque couvert** : un compte qui lit l'espace d'un autre, la pire fuite possible. `npm run isolation` n'est lancé
  qu'à la main ([TRV-016](manuels/transverse.md#trv-016)) ; les tests de la CI tournent contre une base simulée.
- **Scénario** : un workflow programmé (hebdomadaire, et à chaque changement de `supabase/schema.sql`) qui lance
  `npm run isolation` contre le projet de préproduction ; l'échec ouvre une alerte.
- **Niveau** : intégration contre un vrai projet Supabase.
- **Dépendances** : le projet de préproduction (docs/compte.md) ; six secrets GitHub (`ISOLATION_*`), jamais une clé
  secrète ; la comparaison des règles avec la production reste manuelle.
- **Bénéfice attendu** : une régression des règles RLS vue dans la semaine, pas au premier incident.

<a id="bl-04"></a>
### BL-04 — Balayage d'accessibilité rejoué à chaque PR

- **Risque couvert** : contradiction [C4](perimetre.md#contradictions-entre-documentation-code-et-tests) : le balayage axe-core
  des quinze vues a été fait une fois, à la main ; seuls ses correctifs sont figés (contraste, cibles). Une régression
  d'accessibilité (champ sans libellé, rôle manquant, contraste) passerait la CI.
- **Scénario** : un scénario de navigateur qui ouvre les vues principales (accueil, chaque type d'espace du jeu d'essai,
  recherche, bilan, planche, réglages, une boîte de dialogue ouverte), en clair et en sombre, et lance axe-core avec les
  règles WCAG 2.1 A et AA ; zéro violation sérieuse ou critique ; les exceptions justifiées listées dans le test.
- **Niveau** : scénario de navigateur (mode A), Chromium et WebKit.
- **Dépendances** : une dépendance de développement (`axe-core`), contraire à l'habitude du dépôt de s'en passer :
  [À ARBITRER] ; sinon, un sous-ensemble de règles écrit à la main (libellés, rôles, noms accessibles).
- **Bénéfice attendu** : TRV-001 à TRV-003, TRV-006 et TRV-014 gardent leur part manuelle (lecteur d'écran réel,
  appareil réel), mais les régressions mécaniques sont arrêtées par la CI.

<a id="bl-05"></a>
### BL-05 — Stabiliser `tests/browser/activite.js` sous WebKit

- **Risque couvert** : anomalie [A1](perimetre.md#anomalies-et-observations) : le scénario échoue de temps en temps sous WebKit
  (« aucune erreur JavaScript » : une requête interrompue par le rechargement). Une CI qui rougit sans raison apprend à
  ignorer le rouge, et un vrai défaut passera ce jour-là.
- **Scénario** : reproduire en boucle (`SELENE_BROWSER=webkit`, 50 exécutions) ; établir si la promesse rejetée vient de
  l'app (alors la rattraper, et le journal des erreurs ne doit pas l'envoyer) ou du test (attendre la fin des requêtes
  avant de recharger) ; jamais désactiver le scénario.
- **Niveau** : scénario de navigateur.
- **Dépendances** : WebKit de Playwright (absent de l'environnement d'analyse ; présent en CI).
- **Bénéfice attendu** : une CI à laquelle on peut croire.
- **État** : le commit `3a79a01` de `main` corrige le test (attente de 1,2 s sans requête avant le rechargement). Reste à
  confirmer sur une série d'exécutions WebKit de la CI ; si elle tient, barrer cet élément.

<a id="bl-06"></a>
### BL-06 — Assistant : dire « non déployé » ou « injoignable », et le tester

- **Risque couvert** : anomalie [A4](perimetre.md#anomalies-et-observations) : après un 404 ou un 503 de la fonction, coller une
  clé affiche « L'assistant hébergé demande d'être connectée à ton compte. » alors que la personne l'est ; la vue dit
  « Colle ta clé » quand c'est le service qui manque.
- **Scénario** : après correctif, étendre `tests/browser/assistant-injoignable.js` : fonction qui répond 404, puis 503,
  puis refuse la connexion ; vérifier le message affiché à l'enregistrement de la clé et dans la vue Assistant.
- **Niveau** : scénario de navigateur (mode H).
- **Dépendances** : le correctif (produit).
- **Bénéfice attendu** : une panne de déploiement diagnostiquée en une phrase plutôt qu'en un ticket.

<a id="bl-07"></a>
### BL-07 — Fumée de l'app Android sur émulateur, en CI

- **Risque couvert** : le workflow *Android* construit l'APK sans jamais le lancer ([TS-APK](automatises.md#ts-apk)) : une app
  qui démarre vide, ou qui perd sa session à la relance, passe la CI ([PLT-003](manuels/plateformes.md#plt-003)).
- **Scénario** : sur un émulateur Android de la CI, installer l'APK de débogage, le lancer, vérifier que la page
  s'affiche (WebView débogable), garder une capture, tuer l'app, la relancer, relire la capture ; lister
  `files/selene` (`adb shell run-as`).
- **Niveau** : bout en bout natif (émulateur).
- **Dépendances** : un runner avec accélération matérielle (émulateur), une action d'émulateur ; 10 à 15 minutes par
  exécution : limiter aux PR qui touchent `src/native/`, `native/android/` ou la page native.
- **Bénéfice attendu** : le lancement à froid et la persistance vérifiés avant chaque version Android ; le reste de PLT-003
  et PLT-004 (partage, rotation, clavier) reste manuel.

<a id="bl-08"></a>
### BL-08 — Fumée de l'app Windows installée, en CI

- **Risque couvert** : l'installateur se construit ([TS-WIN-NSIS](automatises.md#ts-win-nsis)) sans être installé ni lancé :
  données non relues, deux fenêtres, secrets restés au Gestionnaire d'identification ([PLT-009](manuels/plateformes.md#plt-009),
  [PLT-010](manuels/plateformes.md#plt-010)).
- **Scénario** : sur le runner Windows, installer en silence, lancer, piloter la fenêtre par WebDriver (`tauri-driver`) :
  garder une capture, quitter, relancer, relire ; relancer une seconde fois et compter les fenêtres.
- **Niveau** : bout en bout natif.
- **Dépendances** : `tauri-driver` et le pilote de WebView2 ; le raccourci global et la zone de notification restent
  manuels.
- **Bénéfice attendu** : la persistance et l'instance unique vérifiées à chaque version.

<a id="bl-09"></a>
### BL-09 — Seuils de performance sur le jeu de volume

- **Risque couvert** : une vue qui devient lente à mesure que l'historique grossit ([TRV-007](manuels/transverse.md#trv-007)).
  `npm run bench` mesure, mais aucun seuil n'existe : une régression d'un facteur dix ne fait rien échouer.
- **Scénario** : fixer des seuils (par exemple, chaque vue sous 150 ms dans la VM du banc, sur le corpus du banc) ;
  faire échouer `npm run bench` au-delà ; le lancer en CI.
- **Niveau** : VM Node (faux DOM : ni mise en page ni peinture, donc des seuils relatifs, pas une promesse sur téléphone).
- **Dépendances** : la décision des seuils (question posée dans TRV-007) ; une marge contre la variabilité des runners.
- **Bénéfice attendu** : les régressions de complexité (une boucle quadratique sur 5 500 textes) arrêtées par la CI.

<a id="bl-10"></a>
### BL-10 — Minuit, app ouverte : horloge simulée

- **Risque couvert** : une app restée ouverte la nuit qui date de la veille ce qu'on note au réveil
  ([TRV-004](manuels/transverse.md#trv-004)).
- **Scénario** : après décision (quelles vues doivent suivre la date d'elles-mêmes), un scénario de navigateur avec une
  horloge simulée (`page.clock` de Playwright) : 23 h 58, attendre, vérifier l'en-tête, la date par défaut d'un formulaire
  et la date d'une capture.
- **Niveau** : scénario de navigateur.
- **Dépendances** : la décision de la responsable.
- **Bénéfice attendu** : un défaut de date invisible en journée, vérifié une fois pour toutes.

<a id="bl-11"></a>
### BL-11 — claude.ai : ce qui ne s'automatise pas

- **Lacune** : aucun test ne fait tourner Selene dans le vrai claude.ai. `TU-APP-01` exécute `selene.html` hors de
  claude.ai ; le mode A des scénarios simule `window.claude`. L'accord de claude.ai, le modèle sans clé (`sample`) et
  l'espace `db` (qui relie les données de l'artefact) ne sont vérifiés qu'à la main
  ([AST-009](manuels/assistant.md#ast-009), [PLT-011](manuels/plateformes.md#plt-011)).
- **Proposition** : garder ces deux cas dans **chaque** recette complète et dans la smoke quand l'artefact change ;
  documenter dans `docs/architecture.md` ce que Selene attend de l'espace `db` (le dépôt ne le dit pas).
- **Priorité** : P2.

<a id="bl-12"></a>
### BL-12 — `npm run recette` dans la CI (fait le 5 octobre 2026)

- **Risque couvert** : un cahier de recette qui ment : un test renommé, ajouté ou supprimé sans que l'inventaire suive, un
  cas qui cite un test disparu, un lien cassé. Les deux fusions de `main` faites pendant la rédaction l'avaient montré.
- **Fait** : un job `recette` dans `check.yml`, sur les pull requests (et à la demande de *Check*), jamais quand
  `pages.yml` appelle *Check* (un cahier en retard ne doit pas empêcher de publier). Il ne coûte que quelques secondes :
  pas de `npm ci`, pas de navigateur, pas de réseau. Chaque écart devient une annotation rattachée au fichier fautif, avec
  le geste qui le corrige et, pour un test à inventorier, l'identifiant libre à lui donner ; la liste complète est dans le
  résumé du job. `npm run recette` fait aussi partie de `npm run check`, donc du geste local habituel.
- **Reste à la responsable** : rendre ce job **obligatoire** pour fusionner (Settings → Branches → règle de protection →
  *Require status checks* → `recette`) ou le laisser consultatif. Le cahier ne dit pas lequel : c'est un choix de rigueur
  contre friction.

<a id="bl-13"></a>
### BL-13 — Firefox : cible ou non ?

- **Question** : aucun document ne dit si Firefox est pris en charge ; aucun test ne le lance. Si oui, ajouter le moteur
  à la matrice de *Check › browser* et les plateformes du cahier ; si non, le dire dans le README.

---

<a id="anomalies"></a>
## Anomalies à qualifier

Constatées pendant la mise en place du cahier, décrites avec leur preuve dans
[perimetre.md](perimetre.md#anomalies-et-observations) : A1 (WebKit, `activite.js`, voir [BL-05](#bl-05)), A2 (à surveiller),
A3 (message d'un import refusé), A4 (assistant, voir [BL-06](#bl-06)), A5 (typographie des dates : « oct.. », « 1 septembre »,
« 1.5 verres »), A6 (texte « encore synchronisé » sur un suivi neuf), A7 (talon après effacement, voir [BL-02](#bl-02)), A8 (import Markdown : un fichier illisible fait échouer tout l'import sans message).
Aucune n'a été corrigée : chacune devient un ticket, ou est classée « comportement voulu » par la responsable, et le cas
concerné est mis à jour en conséquence ([maintenance.md](maintenance.md)).

<a id="documentation"></a>
## Documentation à corriger

Les contradictions C1 à C6 de [perimetre.md](perimetre.md#contradictions-entre-documentation-code-et-tests). Le cahier suit le
code et les tests ; la documentation, elle, n'a pas été modifiée.

| # | Fichier | Correction proposée |
|---|---|---|
| C1 | README (« Reprendre la main ») ; `docs/regulation.md`, « Parcours », étape 2 | Retirer le choix « où le garder » : un nouveau suivi est gardé sur l'appareil, sans question. |
| C2 | README (« Reprendre la main ») | Dire que l'espace n'est proposé qu'au compte marqué `selene_personnel`. |
| C3 | `docs/evolution-ui.md` | Marquer « envisagés » les raccourcis et le rail de sigils, absents du code. |
| C4 | `docs/a-faire.md` | Écrire que le balayage axe-core a été fait une fois, à la main (voir [BL-04](#bl-04)). |
| C5 | `docs/regulation.md`, « Parcours manuel », étape 1 | Passer par Réglages → Espaces → « + Créer un espace » pour un compte existant. |
| C6 | README, « Vérification locale » | Ajouter `npm run i18n` à la description de `npm run check`. |

<a id="decisions"></a>
## Décisions en attente

Les questions marquées [À ARBITRER] dans les cas, et ce qu'elles bloquent :

| Question | Cas | Bloque |
|---|---|---|
| Un suivi neuf, pas encore configuré, peut-il se dire « encore synchronisé » ? (A6) | [RLM-003](manuels/reprendre-la-main.md#rlm-003) | le résultat attendu de l'étape 1 |
| Effacer définitivement un suivi à la déconnexion retire-t-il aussi son nom du compte ? (A7) | [RLM-023](manuels/reprendre-la-main.md#rlm-023) | [BL-02](#bl-02) |
| Le résumé destiné à l'assistant doit-il être traduit à l'affichage ? | [RLM-028](manuels/reprendre-la-main.md#rlm-028) | l'étape 5 |
| Quel message pour une date d'objectif à plus d'un an ? | [RLM-014](manuels/reprendre-la-main.md#rlm-014) | l'étape 3 |
| Comment l'app doit-elle dire qu'un appareil vidé est le détenteur ? | [RLM-029](manuels/reprendre-la-main.md#rlm-029) | [BL-01](#bl-01) |
| Quelles vues suivent la date d'elles-mêmes à minuit ? | [TRV-004](manuels/transverse.md#trv-004) | [BL-10](#bl-10) |
| Quels seuils de réactivité ? | [TRV-007](manuels/transverse.md#trv-007) | [BL-09](#bl-09) |
| Que doit dire l'assistant quand sa fonction est injoignable ou non déployée ? (A4) | [AST-007](manuels/assistant.md#ast-007) | [BL-06](#bl-06) |
| Que fait claude.ai de l'espace `db` d'un artefact ? | [PLT-011](manuels/plateformes.md#plt-011) | l'étape 4 |
| Marquer `selene_personnel` un compte de recette (P) ? | `RLM-*` (chemin P) | les cas d'offre et de stockage |
| Une dépendance de développement pour l'accessibilité ? | — | [BL-04](#bl-04) |
| ~~`npm run recette` en CI ?~~ : oui, fait | — | [BL-12](#bl-12) |
| Firefox ? | — | [BL-13](#bl-13) |

Les questions ouvertes d'avant ce cahier ([ESP-006](manuels/espaces.md#esp-006), [SYN-006](manuels/synchronisation.md#syn-006))
sont posées dans les cas eux-mêmes.
