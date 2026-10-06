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
| [BL-02](#bl-02) | ~~Figer le sort du talon après « L'effacer définitivement »~~ (fait, voir ci-dessous) | décision puis automatisation | P1 | RLM-023 |
| [BL-03](#bl-03) | Rejouer l'isolation entre comptes chaque semaine en CI | automatisation | P1 | TRV-016 |
| [BL-04](#bl-04) | Balayage d'accessibilité rejoué à chaque PR | automatisation | P2 | TRV-001, TRV-002, TRV-003, TRV-006, TRV-014 |
| [BL-05](#bl-05) | ~~Stabiliser `tests/browser/activite.js` sous WebKit~~ (fait, voir ci-dessous) | fiabilité de la CI | P2 | TRV-011 |
| [BL-06](#bl-06) | ~~Assistant : dire « non déployé » ou « injoignable », et le tester~~ (fait) | correctif puis automatisation | P2 | AST-007 |
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
- **État** : étapes 1 à 3 en place le 5 octobre 2026 (`TN-regulation-perdu`). RLM-029 reste « à clarifier » tant que son
  étape 4 (l'identité de l'appareil perdue elle aussi) attend sa décision.

<a id="bl-02"></a>
### BL-02 — Figer le sort du talon après « L'effacer définitivement » (fait le 5 octobre 2026)

- **Risque couvert** : anomalie [A7](perimetre.md#anomalies-et-observations) : après une déconnexion avec effacement, le nom
  du suivi survit sur le compte et l'app présente l'effacement voulu comme un accident.
- **Scénario** : après décision (retirer le talon, ou garder et reformuler le message), étendre la fin de
  `tests/browser/regulation-appareil.js` : déconnexion avec effacement, puis lecture du faux serveur et retour sur le même
  appareil.
- **Niveau** : scénario de navigateur (mode H).
- **Dépendances** : la décision de la responsable (question posée dans [RLM-023](manuels/reprendre-la-main.md#rlm-023)) ;
  un correctif si le comportement change.
- **Bénéfice attendu** : la promesse « effacer définitivement » tenue et vérifiée.
- **Fait** : décision de la responsable : l'effacement retire aussi le talon du compte. Le correctif (`eraseTrackers`,
  `src/app/services/device-guard.js` depuis la PR #102) supprime la copie locale puis le module du site avant la synchronisation de la
  déconnexion ; la fin de `tests/browser/regulation-appareil.js` lit le faux serveur après l'effacement, et `TU-REG-38`
  couvre l'annulation. Le chemin « exporter » garde le talon (le contenu est dans le fichier) ; il reste à jouer à la main
  (RLM-023, étapes 4 à 6).

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
### BL-05 — Stabiliser `tests/browser/activite.js` sous WebKit (fait, confirmé le 5 octobre 2026)

- **Risque couvert** : anomalie [A1](perimetre.md#anomalies-et-observations) : le scénario échoue de temps en temps sous WebKit
  (« aucune erreur JavaScript » : une requête interrompue par le rechargement). Une CI qui rougit sans raison apprend à
  ignorer le rouge, et un vrai défaut passera ce jour-là.
- **Scénario** : reproduire en boucle (`SELENE_BROWSER=webkit`, 50 exécutions) ; établir si la promesse rejetée vient de
  l'app (alors la rattraper, et le journal des erreurs ne doit pas l'envoyer) ou du test (attendre la fin des requêtes
  avant de recharger) ; jamais désactiver le scénario.
- **Niveau** : scénario de navigateur.
- **Dépendances** : WebKit de Playwright (absent de l'environnement d'analyse ; présent en CI).
- **Bénéfice attendu** : une CI à laquelle on peut croire.
- **État** : le commit `3a79a01` de `main` corrige le test (attente de 1,2 s sans requête avant le rechargement).
  **Confirmé** : aucun échec d'`activite.js` en 32 exécutions WebKit de la CI depuis (relevé du 5 octobre, dans
  [perimetre.md](perimetre.md#anomalies-et-observations)). Les autres scénarios instables relevés (A9, A10, A11) avaient
  la même cause, un délai fixe à la place d'un état attendu, et ont reçu le même remède.

<a id="bl-06"></a>
### BL-06 — Assistant : dire « non déployé » ou « injoignable », et le tester (fait le 5 octobre 2026)

- **Risque couvert** : anomalie [A4](perimetre.md#anomalies-et-observations) : après un 404 ou un 503 de la fonction, coller une
  clé affiche « L'assistant hébergé demande d'être connectée à ton compte. » alors que la personne l'est ; la vue dit
  « Colle ta clé » quand c'est le service qui manque.
- **Scénario** : après correctif, étendre `tests/browser/assistant-injoignable.js` : fonction qui répond 404, puis 503,
  puis refuse la connexion ; vérifier le message affiché à l'enregistrement de la clé et dans la vue Assistant.
- **Niveau** : scénario de navigateur (mode H).
- **Dépendances** : le correctif (produit).
- **Bénéfice attendu** : une panne de déploiement diagnostiquée en une phrase plutôt qu'en un ticket.
- **Fait** : la vue Assistant et les Réglages disent « Assistant non déployé (voir docs/assistant.md). » (404), « Assistant non configuré. » (503) ou « Assistant injoignable (hors ligne, ou pas encore déployé). » ; coller une clé donne la même cause. Le diagnostic ne redessine la page qu'une fois, là où il se lit, et la pause de cinq minutes empêche toute boucle (la régression du 30 septembre reste gardée par le même scénario). Tests : `TN-assistant-injoignable` (404, 503, injoignable).

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
- **État** : en place le 5 octobre 2026 (`TS-ANDROID-FUMEE`) : workflow *Android sur émulateur*, sans action tierce
  (sdkmanager et l'émulateur du SDK du runner), émulateur Android 15 hors ligne ; la WebView est pilotée par le
  protocole de débogage de Chrome (`scripts/android-fumee.mjs`, sans dépendance). Il éprouve aussi la mise à jour vers
  l'APK de l'édition des stores. Ni session connectée, ni synchronisation : elles demanderaient un faux serveur joignable
  depuis l'émulateur. Premier passage vert le 5 octobre 2026 (PR #105) : le premier lancement réel de l'app, en
  2 min 40. Mis au point en chemin : `ANDROID_AVD_HOME` commun à avdmanager et à l'émulateur (sinon « Unknown AVD
  name »), chaque attente bornée, et le coffre jugé au repos (deux `.tmp` d'écritures en route avaient été vus une fois,
  juste après une navigation).

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
- **Décision de la responsable (5 octobre 2026)** : le job est **obligatoire** pour fusionner. C'est un réglage du
  dépôt, pas un fichier : il n'est appliqué que lorsqu'il est fait dans Settings → Branches → règle de protection de
  `main` → *Require status checks to pass* → `recette` (proposé dans la liste une fois que le job a tourné sur une pull
  request). Tant que ce n'est pas fait, le job reste consultatif ; le cahier ne peut pas le vérifier depuis le dépôt.
  Il ne bloque que les pull requests : il ne tourne pas quand `pages.yml` appelle *Check*, pour qu'un cahier en retard
  n'empêche jamais de publier.
- **Réglage recommandé** (analyse du 5 octobre 2026 ; `main` n'était alors pas protégée, et ce réglage ne s'applique pas
  depuis une session de travail : il demande les droits d'administration du dépôt). Settings → Rules → Rulesets → *New
  branch ruleset*, cible : la branche par défaut (ou l'ancienne *Branch protection rule* sur `main`, équivalente) :
  - *Require a pull request before merging*, sans approbation obligatoire (la responsable fusionne seule) : sans cette
    case, un envoi direct sur `main` contourne le contrôle.
  - *Require status checks to pass* → `recette` (décidé). `build-and-test` peut s'y ajouter sans risque : rapide et
    déterministe. **Jamais** `apk`, `simulator` ni `windows` : ils ne tournent que si la PR touche leurs chemins, et un
    contrôle requis qui ne tourne pas bloque la PR pour toujours (« Expected — Waiting for status »).
  - *Require branches to be up to date before merging* : **recommandé**. Plusieurs sessions travaillent en parallèle ;
    chaque PR est vérifiée contre le `main` de son dernier envoi, pas contre celui du moment de la fusion. Le 5 octobre,
    #100 et #101 ajoutaient chacune un test et écrivaient le même total (290) : vertes séparément, fausses ensemble (291),
    et deux sessions peuvent de même attribuer le même identifiant libre. Le prix : quand `main` a bougé, mettre la
    branche à jour (bouton *Update branch*) et attendre la CI, environ cinq minutes.
  - Laisser à l'administratrice la possibilité de passer outre (*bypass*), pour un correctif urgent.
  - Vérifier ensuite : la branche `main` apparaît comme protégée dans la liste des branches.
- **Complément du 5 octobre 2026** : `npm run recette` compare désormais les totaux annoncés (tableau de tête de
  l'inventaire, décompte de la matrice) à ce que le dépôt contient ; l'erreur de total de la fusion de #100 et #101
  aurait été arrêtée par le contrôle.

<a id="bl-13"></a>
### BL-13 — Firefox : cible ou non ?

- **Question** : aucun document ne dit si Firefox est pris en charge ; aucun test ne le lance. Si oui, ajouter le moteur
  à la matrice de *Check › browser* et les plateformes du cahier ; si non, le dire dans le README.

---

<a id="anomalies"></a>
## Anomalies à qualifier

Constatées pendant la mise en place du cahier, décrites avec leur preuve dans
[perimetre.md](perimetre.md#anomalies-et-observations) : A1 (WebKit, `activite.js`, voir [BL-05](#bl-05)), A2 (à surveiller),
A3 (message d'un import refusé : **corrigée**), A4 (assistant, voir [BL-06](#bl-06) : **corrigée**), A5 (typographie des dates : « oct.. », « 1 septembre »,
« 1.5 verres » : **corrigée**), A6 (texte « encore synchronisé » sur un suivi neuf : **corrigée**), A7 (talon après effacement, voir [BL-02](#bl-02) : **corrigée**), A8 (import Markdown : un fichier illisible fait échouer tout l'import sans message : **corrigée**), A9 (WebKit, `regulation.js` : un clic perdu sur la case de partage ; correctif côté test, à surveiller), A10 (`dehors.js` : un délai fixe au démarrage : **corrigée** côté test), A11 (`mot-de-passe.js` : trois déploiements bloqués : **corrigée** côté test, PR #103).
A4, A5 et A8, puis A3 et A6, puis A7, ont été corrigées le 5 octobre 2026 (leurs cas et leurs tests mis à jour dans la même PR). A1, A9, A10 et A11 (stabilité de la CI) ont été corrigées côté test, A1 confirmée ; reste à suivre A2
(aucun échec depuis sa branche) ; toute nouvelle anomalie devient un ticket, ou est classée « comportement voulu » par la responsable, et le cas
concerné est mis à jour en conséquence ([maintenance.md](maintenance.md)).

<a id="documentation"></a>
## Documentation à corriger

Les contradictions C1 à C6 de [perimetre.md](perimetre.md#contradictions-entre-documentation-code-et-tests). Le cahier suit le
code et les tests ; chaque correction faite est barrée et datée.

| # | Fichier | Correction proposée |
|---|---|---|
| C1 | README (« Reprendre la main ») ; `docs/regulation.md`, « Parcours », étape 2 | ~~Retirer le choix « où le garder » : un nouveau suivi est gardé sur l'appareil, sans question.~~ Fait le 5 octobre 2026, avec l'édition des stores. |
| C2 | README (« Reprendre la main ») | ~~Dire que l'espace n'est proposé qu'au compte marqué `selene_personnel`.~~ Fait le 5 octobre 2026, avec l'édition des stores. |
| C3 | `docs/evolution-ui.md` | ~~Marquer « envisagés » les raccourcis et le rail de sigils, absents du code.~~ Fait le 5 octobre 2026. |
| C4 | `docs/a-faire.md` | ~~Écrire que le balayage axe-core a été fait une fois, à la main (voir [BL-04](#bl-04)).~~ Fait le 5 octobre 2026. |
| C5 | `docs/regulation.md`, « Parcours manuel », étape 1 | ~~Passer par Réglages → Espaces → « + Créer un espace » pour un compte existant.~~ Fait le 5 octobre 2026. |
| C6 | README, « Vérification locale » | ~~Ajouter `npm run i18n` à la description de `npm run check`.~~ Déjà fait dans le README (« traductions »), constaté le 5 octobre 2026. |

<a id="decisions"></a>
## Décisions en attente

Les questions marquées [À ARBITRER] dans les cas, et ce qu'elles bloquent :

| Question | Cas | Bloque |
|---|---|---|
| ~~Un suivi neuf, pas encore configuré, peut-il se dire « encore synchronisé » ? (A6)~~ : non, corrigé le 5 octobre 2026 | [RLM-003](manuels/reprendre-la-main.md#rlm-003) | — |
| ~~Effacer définitivement un suivi à la déconnexion retire-t-il aussi son nom du compte ? (A7)~~ : oui, corrigé le 5 octobre 2026 | [RLM-023](manuels/reprendre-la-main.md#rlm-023) | — |
| Le résumé destiné à l'assistant doit-il être traduit à l'affichage ? | [RLM-028](manuels/reprendre-la-main.md#rlm-028) | l'étape 5 |
| Quel message pour une date d'objectif à plus d'un an ? | [RLM-014](manuels/reprendre-la-main.md#rlm-014) | l'étape 3 |
| Comment l'app doit-elle dire qu'un appareil vidé est le détenteur ? | [RLM-029](manuels/reprendre-la-main.md#rlm-029) | [BL-01](#bl-01) |
| Quelles vues suivent la date d'elles-mêmes à minuit ? | [TRV-004](manuels/transverse.md#trv-004) | [BL-10](#bl-10) |
| Quels seuils de réactivité ? | [TRV-007](manuels/transverse.md#trv-007) | [BL-09](#bl-09) |
| ~~Que doit dire l'assistant quand sa fonction est injoignable ou non déployée ? (A4)~~ : « non déployé », « non configuré » ou « injoignable », corrigé le 5 octobre 2026 (PR #98) | [AST-007](manuels/assistant.md#ast-007) | — |
| ~~Que fait claude.ai de l'espace `db` d'un artefact ?~~ : ses documents sont partagés avec tous ceux qui ont le lien ; Selene range désormais les siens dans le sous-arbre privé de chacun (A12, ADR 33), le 6 octobre 2026 | [PLT-011](manuels/plateformes.md#plt-011) | — |
| Marquer `selene_personnel` un compte de recette (P) ? | `RLM-*` (chemin P) | les cas d'offre et de stockage |
| Une dépendance de développement pour l'accessibilité ? | — | [BL-04](#bl-04) |
| ~~`npm run recette` en CI ?~~ : oui, fait, et obligatoire pour fusionner (réglage du dépôt à appliquer) | — | [BL-12](#bl-12) |
| Firefox ? | — | [BL-13](#bl-13) |

Les questions ouvertes d'avant ce cahier ([ESP-006](manuels/espaces.md#esp-006), [SYN-006](manuels/synchronisation.md#syn-006))
sont posées dans les cas eux-mêmes.
