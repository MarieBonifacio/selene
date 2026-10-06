# Backlog qualité

Ce que la recette a révélé et qui reste à faire : automatisations à prioriser, lacunes qui ne s'automatisent pas,
anomalies à qualifier, documentation à corriger, décisions à prendre. Rien de tout cela n'a été implémenté par la
mise en place du cahier : ce sont des propositions, à transformer en tickets par la responsable du produit. Chaque élément
garde son identifiant `BL-nn` (jamais renuméroté) ; un élément fait est barré dans la table et daté, pas supprimé.

**Priorités** : celles des cas ([README](README.md#priorité)). P1 : un défaut ici perd ou expose des données, ou casse un
parcours essentiel ; P2 : une fonction importante ; P3 : du confort.

<a id="reste-a-faire"></a>
## Reste à faire, d'un coup d'œil

Tout ce qui reste ouvert, du plus urgent au moins urgent dans chaque groupe, tenu à jour le 6 octobre 2026. Une ligne
renvoie à son détail, qui fait foi ; une chose faite est barrée et datée ici comme dans son détail, jamais retirée. Les
démarches à la main qui ne touchent pas la qualité (stores, RGPD, validation du marché) restent dans
[a-faire.md](../a-faire.md) seulement. « Une session » : une session Claude Code ouverte sur ce dépôt, qui fait le
travail dans une PR ; « la responsable » : la responsable du produit.

### À corriger

| Quoi | Qui | Priorité | Échéance ou condition | Détail |
|---|---|---|---|---|
| A17 : dans l'artefact claude.ai relié à sa base, un suivi « Reprendre la main » d'avant le 3 octobre part en entier dans la base de claude.ai, sous un texte qui dit que rien n'est envoyé | une session (comportement décidé le 6 octobre : ramené sur l'appareil, avec un avis) | P1 | avant toute publication de l'artefact | [A17](perimetre.md#anomalies-et-observations), [décision](#decisions) |
| A16 : `tests/browser/mot-de-passe.js` instable sous Firefox | une session | P2 | avant que Firefox devienne bloquant | [A16](perimetre.md#anomalies-et-observations) |
| BL-17 : un échec sous Firefox ne se voit pas (le job reste vert) | une session | P2 | avec A16 | [BL-17](#bl-17) |

### À automatiser

| Quoi | Qui | Priorité | Échéance ou condition | Détail |
|---|---|---|---|---|
| BL-14 : la sauvegarde complète dans un vrai navigateur, sur deux appareils | une session | P1 | — | [BL-14](#bl-14) |
| BL-15 : le hors-ligne réel (réseau coupé, page rechargée) | une session | P1 | — | [BL-15](#bl-15) |
| BL-03 : l'isolation entre comptes rejouée chaque semaine | une session, une fois la préproduction et ses six secrets en place | P1 | après un premier `npm run isolation` réussi à la main (TRV-016) | [BL-03](#bl-03) |
| BL-20 : un résultat observable à chaque étape, contrôlé par `npm run recette` | une session | P3 | — | [BL-20](#bl-20) |
| BL-19 : nommer, dans la matrice, les étapes que les tests ne couvrent pas | une session | P3 | les 73 cas P1 d'abord | [BL-19](#bl-19) |
| BL-18 : la page du cahier à cocher sous contrôle de la CI | une session | P3 | si la PR #118 est fusionnée | [BL-18](#bl-18) |
| BL-16 : la fumée de l'app iOS sur simulateur | une session | P3 | avant la première version iOS | [BL-16](#bl-16) |

### À exécuter (recette à la main)

| Quoi | Qui | Priorité | Échéance ou condition | Détail |
|---|---|---|---|---|
| La sauvegarde de la base, réglée puis restaurée sur un projet neuf ([TRV-017](manuels/transverse.md#trv-017)) | la personne qui administre Supabase | P1 | avant tout autre réglage du projet | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait) |
| L'isolation entre comptes sur la préproduction ([TRV-016](manuels/transverse.md#trv-016)) | la personne qui administre Supabase | P1 | avant d'inviter les bêta-testeurs | [compte.md](../compte.md#vérifier-lisolation-entre-comptes) |
| La première smoke : aucun des 192 cas n'a encore été exécuté | la responsable | P1 | avant la prochaine mise en ligne qui change un comportement | [campagnes.md](campagnes.md#smoke) |
| Les appareils réels : [PLT-001](manuels/plateformes.md#plt-001), [PLT-003](manuels/plateformes.md#plt-003), [PLT-008](manuels/plateformes.md#plt-008), [PLT-010](manuels/plateformes.md#plt-010) ; [TRV-007](manuels/transverse.md#trv-007) sur un téléphone d'entrée de gamme ; une heure de lecteur d'écran ([TRV-001](manuels/transverse.md#trv-001)) | la responsable | P1 et P2 | avant la bêta | [a-faire.md](../a-faire.md#essayer-sur-de-vrais-appareils) |
| L'artefact dans le vrai claude.ai : [PLT-011](manuels/plateformes.md#plt-011), [AST-009](manuels/assistant.md#ast-009) | la responsable | P2 | après A17, à la publication de l'artefact | [BL-11](#bl-11) |
| La recette complète | la responsable | P1 | avant une version des stores ou l'ouverture de la bêta, puis chaque trimestre | [campagnes.md](campagnes.md#complete) |

### À régler (hors du dépôt)

| Quoi | Qui | Priorité | Échéance ou condition | Détail |
|---|---|---|---|---|
| Protéger `main` : PR obligatoire, contrôles `recette` et `build-and-test` requis | la personne qui administre le dépôt | P2 | dès que possible : `main` n'est pas protégée au 6 octobre 2026 | [BL-12](#bl-12), [a-faire.md](../a-faire.md#tout-de-suite-une-minute) |
| Firefox bloquant : retirer `continue-on-error` de `check.yml` | une session, à la demande | P2 | le 20 octobre 2026, si la condition proposée plus bas est remplie | [BL-13](#bl-13) |
| Les réglages du projet Supabase (SMTP, fonction `compte`, tables, compte personnel marqué, Postgres, offre Pro) | la personne qui administre Supabase | P1 et P2 | voir chaque ligne | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait) |

### À décider

| Question | Proposition | Échéance | Détail |
|---|---|---|---|
| À quelle condition Firefox devient-il bloquant ? | A16 corrigé, puis vingt passages Firefox consécutifs sans échec, lus dans le journal du pas (pas seulement « job vert ») ; sinon, décaler la date plutôt que bloquer sur un scénario instable | 20 octobre 2026 | [BL-13](#bl-13), [BL-17](#bl-17) |
| L'assistant hébergé : le déployer pour la bêta ? | Non, et l'écrire : il n'est pas prioritaire pour la bêta, et sans lui la gestion des clés et le registre RGPD restent plus simples | avant d'inviter les bêta-testeurs | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait), [assistant.md](../assistant.md) |
| La PR #118 (le cahier à cocher) : la fusionner ? | Oui : outillage seul, CI verte, et c'est le support qui manque pour exécuter une campagne ; puis [BL-18](#bl-18) | avant la première smoke | PR #118 |
| L'offre Pro de Supabase avant la bêta ? | Oui (une sauvegarde par jour, pas de mise en pause) ; décision de budget | avant d'inviter les bêta-testeurs | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait) |
| La carte céleste : la garder ? | Selon le critère écrit d'avance : retirée si elle n'a pas été ouverte pendant un mois | fin octobre 2026 | [evolution-ui.md](../evolution-ui.md#vague-4--les-pistes-expérimentales) |

### À surveiller

| Quoi | Depuis | Ce qui clôt | Détail |
|---|---|---|---|
| A2 : `secours.js`, deux échecs sur sa propre branche | 4 octobre 2026 | aucun échec jusqu'au 20 octobre : classer « non reproduit » | [perimetre.md](perimetre.md#anomalies-et-observations) |
| A9 : `regulation.js` sous WebKit, un clic perdu | 5 octobre 2026 | aucun échec jusqu'au 20 octobre : confirmée | [perimetre.md](perimetre.md#anomalies-et-observations) |
| `sync-deux-appareils.js` : deux échecs sur une branche en cours, jamais sur `main` | 3 octobre 2026 | aucun échec jusqu'au 20 octobre : classer « non reproduit » | [perimetre.md](perimetre.md#anomalies-et-observations) |

### Moins urgent, sans décision à prendre

Décrit dans un document, absent du code, et donc hors de la recette tant que rien n'est décidé : les raccourcis clavier
et le rail de sigils (C3), l'extension de partage iOS native (elle demande un compte Apple Developer), Tauri sous macOS
et Linux ([perimetre.md](perimetre.md#cibles)).

## Propositions numérotées

| Identifiant | Proposition | Type | Priorité | Cas liés |
|---|---|---|---|---|
| [BL-01](#bl-01) | ~~Scénario « l'appareil détenteur a perdu son stockage »~~ (fait) | automatisation | P1 | RLM-029 |
| [BL-02](#bl-02) | ~~Figer le sort du talon après « L'effacer définitivement »~~ (fait, voir ci-dessous) | décision puis automatisation | P1 | RLM-023 |
| [BL-03](#bl-03) | Rejouer l'isolation entre comptes chaque semaine en CI | automatisation | P1 | TRV-016 |
| [BL-04](#bl-04) | ~~Balayage d'accessibilité rejoué à chaque PR~~ (fait) | automatisation | P2 | TRV-001, TRV-002, TRV-003, TRV-006, TRV-014 |
| [BL-05](#bl-05) | ~~Stabiliser `tests/browser/activite.js` sous WebKit~~ (fait, voir ci-dessous) | fiabilité de la CI | P2 | TRV-011 |
| [BL-06](#bl-06) | ~~Assistant : dire « non déployé » ou « injoignable », et le tester~~ (fait) | correctif puis automatisation | P2 | AST-007 |
| [BL-07](#bl-07) | ~~Fumée de l'app Android sur émulateur, en CI~~ (fait, verte depuis le 5 octobre) | automatisation | P2 | PLT-003, PLT-004 |
| [BL-08](#bl-08) | ~~Fumée de l'app Windows installée, en CI~~ (fait, verte depuis le 6 octobre) | automatisation | P3 | PLT-009, PLT-010 |
| [BL-09](#bl-09) | ~~Seuils de performance sur le jeu de volume~~ (fait) | décision puis automatisation | P2 | TRV-007 |
| [BL-10](#bl-10) | ~~Minuit, app ouverte : horloge simulée~~ (fait) | décision puis automatisation | P3 | TRV-004 |
| [BL-11](#bl-11) | claude.ai : ce qui ne s'automatise pas | lacune assumée | P2 | AST-009, PLT-011 |
| [BL-12](#bl-12) | ~~`npm run recette` dans la CI~~ (fait, voir ci-dessous) | outillage | P2 | tous |
| [BL-13](#bl-13) | ~~Firefox : cible ou non ?~~ (décidé, en place) | décision | P3 | — |
| [BL-14](#bl-14) | La sauvegarde complète dans un vrai navigateur, sur deux appareils | automatisation | P1 | DON-002, DON-003, DON-004, DON-005, DON-006 |
| [BL-15](#bl-15) | Le hors-ligne réel : réseau coupé, page rechargée, retour du réseau | automatisation | P1 | SYN-004, PLT-001, SYN-010 |
| [BL-16](#bl-16) | Fumée de l'app iOS sur simulateur, en CI | automatisation | P3 | PLT-008 |
| [BL-17](#bl-17) | Un échec sous Firefox doit se voir tant qu'il n'est pas bloquant | fiabilité de la CI | P2 | tous |
| [BL-18](#bl-18) | La page du cahier à cocher sous contrôle de la CI (si la PR #118 est fusionnée) | outillage | P3 | tous |
| [BL-19](#bl-19) | Matrice : nommer les étapes que les tests ne couvrent pas | traçabilité | P3 | les 73 cas P1 d'abord |
| [BL-20](#bl-20) | Un résultat observable à chaque étape, contrôlé par `npm run recette` | outillage | P3 | onze étapes, voir ci-dessous |

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
- **État** : **fait**. Étapes 1 à 3 en place le 5 octobre 2026 (`TN-regulation-perdu`) ; étape 4 (l'identité de
  l'appareil perdue elle aussi) tranchée et figée le 6 (`TU-REG-39` : le talon décrit l'appareil détenteur). RLM-029
  est « couvert partiellement ».

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
- **Dépendances** : une dépendance de développement, `axe-core` 4.14.0 en version exacte (décision du 6 octobre 2026 :
  MPL-2.0, sans dépendance, jamais embarquée dans l'application).
- **Bénéfice attendu** : TRV-001 à TRV-003, TRV-006 et TRV-014 gardent leur part manuelle (lecteur d'écran réel,
  appareil réel), mais les régressions mécaniques sont arrêtées par la CI.
- **État** : **fait** le 6 octobre 2026 (`TN-accessibilite`). Premier passage : 8 boutons « régler » des Réglages dont
  le nom accessible ne contenait pas le texte visible (`label-content-name-mismatch`, WCAG 2.5.3), corrigés dans la
  même PR ; aucune exception.

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
- **État** : en place le 6 octobre 2026 (`TS-WIN-FUMEE`, `scripts/windows-fumee.mjs`), sans `tauri-driver` : une
  variante de l'app, construite après le dépôt de l'installateur publié et jamais déposée, ouvre le protocole de débogage
  de Chrome (`additionalBrowserArgs` ; la variable `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` est ignorée quand wry fixe ses
  propres arguments, constaté au deuxième essai), et le script reprend les étapes de la fumée Android. Le projet Supabase de l'app est rendu injoignable sur le runner (fichier `hosts`)
  avant l'essai. Premier passage vert le 6 octobre 2026, au troisième essai (PR #113, quatorze secondes de fumée) :
  installée sous `%LOCALAPPDATA%\Selene`, la note retrouvée après l'app tuée puis relancée, le coffre sans temporaire,
  une seule Selene après le second lancement, aucune exception JavaScript.

<a id="bl-09"></a>
### BL-09 — Seuils de performance sur le jeu de volume

- **Risque couvert** : une vue qui devient lente à mesure que l'historique grossit ([TRV-007](manuels/transverse.md#trv-007)).
  `npm run bench` mesure, mais aucun seuil n'existe : une régression d'un facteur dix ne fait rien échouer.
- **Scénario** : fixer des seuils (par exemple, chaque vue sous 150 ms dans la VM du banc, sur le corpus du banc) ;
  faire échouer `npm run bench` au-delà ; le lancer en CI.
- **Niveau** : VM Node (faux DOM : ni mise en page ni peinture, donc des seuils relatifs, pas une promesse sur téléphone).
- **Dépendances** : la décision des seuils (question posée dans TRV-007) ; une marge contre la variabilité des runners.
- **Bénéfice attendu** : les régressions de complexité (une boucle quadratique sur 5 500 textes) arrêtées par la CI.
- **État** : **fait** le 6 octobre 2026. Seuils décidés par la responsable : 150 ms par vue dans la VM du banc (médiane
  de cinq passages, bloquant en CI : *Check › build-and-test*) ; sur un téléphone d'entrée de gamme, 200 ms visés et
  500 ms au plus ([TRV-007](manuels/transverse.md#trv-007), à la main).

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
- **État** : **fait** le 6 octobre 2026. Décision : chaque vue suit la date une minute après minuit au plus et au retour
  au premier plan, jamais sous un formulaire ouvert ni pendant une saisie ; un formulaire ouvert garde ses valeurs.
  `TU-MOD-64` (Node) et `TN-minuit` (navigateur, `page.clock`).

<a id="bl-11"></a>
### BL-11 — claude.ai : ce qui ne s'automatise pas

- **Lacune** : aucun test ne fait tourner Selene dans le vrai claude.ai. `TU-APP-01` exécute `selene.html` hors de
  claude.ai ; le mode A des scénarios simule `window.claude`. L'accord de claude.ai, le modèle sans clé (`sample`) et
  l'espace `db` (qui relie les données de l'artefact) ne sont vérifiés qu'à la main
  ([AST-009](manuels/assistant.md#ast-009), [PLT-011](manuels/plateformes.md#plt-011)).
- **Proposition** : garder ces deux cas dans **chaque** recette complète et dans la smoke quand l'artefact change ;
  documenter dans `docs/architecture.md` ce que Selene attend de l'espace `db` (le dépôt ne le dit pas).
- **Priorité** : P2.
- **État** : le volet documentation est fait (ADR 33 de `docs/architecture.md`, le 6 octobre 2026). Reste le volet
  manuel, après la correction d'A17 : publier l'artefact avec `db` et `user`, puis jouer PLT-011 et AST-009 dans le vrai
  claude.ai.

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
- **Décision** (responsable, 6 octobre 2026) : oui sur ordinateur. Firefox est le troisième navigateur d'ordinateur en
  France, 12,25 % en juillet 2026 selon StatCounter, à égalité avec Edge, et son public, soucieux de vie privée, est
  celui de Selene. Firefox sur téléphone n'est pas visé.
- **État** : en place le 6 octobre 2026 : `SELENE_BROWSER=firefox`, matrice *Check › browser* à trois moteurs ; non
  bloquant jusqu'au 20 octobre (`continue-on-error` sur le pas des scénarios, pour Firefox seulement), puis bloquant :
  retirer la ligne dans `check.yml` (voir [a-faire.md](../a-faire.md#tout-de-suite-une-minute)). README : « Navigateurs pris
  en charge ». Premier passage (PR #111) : 74 scénarios sur 78 ; les quatre échecs ont chacun leur cause, corrigée
  (anomalie A14 de [perimetre.md](perimetre.md#anomalies-et-observations)). Après correction (PR #112) : 78 sur 78.
  Le 6 octobre encore, sur la PR #115 : 77 sur 78, et l'échec était un vrai défaut de l'app, que Chromium et WebKit ne
  montraient pas (A15, corrigé par la PR #116). Le job « vert » ne le disait pas : avant de le rendre bloquant, lire son
  journal reste le seul moyen de savoir.
- **Condition proposée pour le 20 octobre** (à confirmer par la responsable) : A16 corrigé, puis vingt passages Firefox
  consécutifs sans échec, lus dans le journal du pas (« 0/78 scénario(s) en échec », ou l'avertissement de
  [BL-17](#bl-17) absent) ; sinon, décaler la date plutôt que rendre bloquant un scénario instable, qui apprendrait à
  relancer la CI sans la lire.

<a id="bl-14"></a>
### BL-14 — La sauvegarde complète dans un vrai navigateur, sur deux appareils

- **Risque couvert** : une sauvegarde qui ne restaure pas, la perte la plus grave après celle de la base. Le format et les
  refus sont vérifiés en Node (`tests/backup.test.js`), mais aucun scénario de navigateur ne joue le geste entier :
  confirmer « Remplacer tout l'état actuel », voir l'autre appareil du compte adopter l'état importé sans doublon
  ([DON-002](manuels/donnees-sauvegardes.md#don-002), « partout »), renoncer au dernier moment
  ([DON-003](manuels/donnees-sauvegardes.md#don-003)), refuser un fichier plus récent
  ([DON-004](manuels/donnees-sauvegardes.md#don-004)) ou hostile ([DON-005](manuels/donnees-sauvegardes.md#don-005)),
  migrer un format 1 ([DON-006](manuels/donnees-sauvegardes.md#don-006)). `TN-regulation-perdu` exporte et importe,
  mais pour le seul suivi « Reprendre la main ».
- **Scénario** : deux contextes du même compte sur faux Supabase (comme `tests/browser/sync-deux-appareils.js`) ;
  importer `donnees/jeu-essai.json` sur A : la boîte de confirmation, puis « Sauvegarde importée » ; B, dans les 30 s :
  le même état, sans doublon ; importer de nouveau puis annuler à la confirmation : rien ne change, rien ne part ;
  `refus-version-future.json` et `refus-hostile.json` : refusés avec leur message, l'état intact ;
  `ancien-format-1.json` : migré, ses espaces présents.
- **Niveau** : scénario de navigateur (mode H), dans les trois moteurs.
- **Dépendances** : aucune (`setInputFiles` de Playwright, jeux de données existants).
- **Bénéfice attendu** : cinq cas P1 passent d'une couverture en Node à un geste vérifié dans un vrai navigateur ; reste
  manuel : la feuille de partage des apps et le choix du fichier sur téléphone.

<a id="bl-15"></a>
### BL-15 — Le hors-ligne réel : réseau coupé, page rechargée, retour du réseau

- **Risque couvert** : la promesse « fonctionne hors ligne » n'est éprouvée par aucun test : aucun des 78 scénarios ne
  coupe le réseau (`context.setOffline`), et `tests/browser/hors-ligne.js` vérifie le service worker sans jamais
  recharger la page sans réseau ([SYN-004](manuels/synchronisation.md#syn-004),
  [SYN-010](manuels/synchronisation.md#syn-010), [PLT-001](manuels/plateformes.md#plt-001)).
- **Scénario** : version hébergée sur faux Supabase, service worker autorisé ; une première visite (le service worker
  s'installe et prend la main), puis `setOffline(true)` et rechargement : l'app s'affiche, avec les données ; une
  capture : « Non synchronisé » et la capture gardée sur l'appareil ; `setOffline(false)` : la capture arrive sur le faux
  serveur, l'indicateur s'efface.
- **Niveau** : scénario de navigateur (mode H). Le service worker sous WebKit et Firefox pilotés peut demander une
  variante : la constater, ne pas désactiver le scénario.
- **Dépendances** : aucune.
- **Bénéfice attendu** : le hors-ligne vérifié à chaque PR ; reste manuel : la PWA installée sur iPhone, le mode Avion.

<a id="bl-16"></a>
### BL-16 — Fumée de l'app iOS sur simulateur, en CI

- **Risque couvert** : le workflow *iOS* compile l'app pour le simulateur sans jamais la lancer : une app qui démarre
  vide passe la CI ([PLT-008](manuels/plateformes.md#plt-008)).
- **Scénario** : comme la fumée Android ([BL-07](#bl-07)) : installer sur un simulateur (`xcrun simctl`), lancer,
  capturer une note par l'inspecteur Web de Safari (`ios-webkit-debug-proxy`, ou le protocole de l'inspecteur), tuer,
  relancer, relire ; vérifier que l'édition des stores n'offre pas « Reprendre la main ».
- **Niveau** : bout en bout natif (simulateur).
- **Dépendances** : runner macOS (environ dix fois le coût d'une minute Linux) ; un pilote de la WebView du simulateur, à
  choisir.
- **Bénéfice attendu** : le lancement et la persistance vérifiés avant la première version iOS.
- **Priorité** : P3 tant que la publication iOS n'est pas proche (compte Apple Developer à ouvrir).

<a id="bl-17"></a>
### BL-17 — Un échec sous Firefox doit se voir tant qu'il n'est pas bloquant

- **Risque couvert** : `continue-on-error` garde le job *Check › browser (firefox)* vert quand un scénario échoue, sans
  annotation ni résumé. Le site a été publié le 6 octobre (`cab3ec8`) avec un échec Firefox que seul le journal disait
  (A16), et la PR #115 a été fusionnée de même avant que A15 soit vu. Un échec que personne ne lit n'apprend rien.
- **Proposition** : donner un identifiant au pas des scénarios ; un pas suivant, `if: steps.<id>.outcome == 'failure'`,
  écrit une annotation `::warning::` (visible sur la page de la PR et du run) et une ligne dans le résumé du job, avec
  les scénarios en échec. Retiré le jour où Firefox devient bloquant, avec `continue-on-error`.
- **Niveau** : CI.
- **Bénéfice attendu** : chaque échec Firefox vu le jour même ; le compte des vingt passages de la [condition
  proposée](#bl-13) se fait à l'œil.

<a id="bl-18"></a>
### BL-18 — La page du cahier à cocher sous contrôle de la CI (si la PR #118 est fusionnée)

- **Risque couvert** : la PR #118 génère `dist/recette/campagne.html` (une case par étape) ; ses 62 vérifications ont été
  faites une fois, à la main, et ne sont pas versionnées ; le générateur ne tourne pas en CI. Un cas réécrit dans un format
  qu'il ne reconnaît plus casserait la page sans que rien ne rougisse. L'empreinte d'une étape cochée couvre son texte,
  pas les préconditions ni les données du cas : un cas dont seules les données changent garderait ses coches.
- **Proposition** : lancer `npm run recette -- campagne` dans le job *Check › recette* (il s'arrête déjà sans rien écrire
  sur un format inconnu) ; versionner le test de la page (fausse base `window.claude`, comme la PR le décrit) ; étendre
  l'empreinte aux préconditions et aux données.
- **Niveau** : outillage de la recette.
- **Dépendances** : la fusion de la PR #118 (décision de la responsable, [plus bas](#decisions)).

<a id="bl-19"></a>
### BL-19 — Matrice : nommer les étapes que les tests ne couvrent pas

- **Risque couvert** : le 6 octobre 2026, 124 lignes de la [matrice](matrice.md) portaient la même lacune générique (« Serveur et services
  simulés, une partie des étapes seulement : garder le cas en recette complète. »). On ne sait pas, ligne à ligne, quelles
  étapes restent sans preuve, donc ce qu'une campagne ciblée peut sauter.
- **Proposition** : pour chaque cas P1 d'abord (73), écrire les étapes non couvertes (« étapes 2 et 5 : appareil réel »),
  comme le font déjà PLT-003 ou RLM-029. En chemin, relier `TN-regulation-perdu` à DON-001 et DON-002 s'il en vérifie
  vraiment une étape (il exporte et importe, mais un seul module) ; `TS-ANDROID-FUMEE` ne couvre pas RLM-030 (il ne crée
  aucun suivi) : ne pas le relier.
- **Niveau** : documentation du cahier.
- **Bénéfice attendu** : une non-régression ciblée qui sait ce qu'elle peut sauter.

<a id="bl-20"></a>
### BL-20 — Un résultat observable à chaque étape, contrôlé par `npm run recette`

- **Risque couvert** : la règle de [maintenance.md](maintenance.md#une-nouvelle-fonctionnalité) (« un résultat observable
  par étape ») n'est pas contrôlée. Le 6 octobre 2026, douze étapes avaient « — » pour attendu, et SYN-005, un cas de la
  smoke, avait un attendu qui ne pouvait pas échouer (« arrivée, ou au plus tard dès que A1 rouvrira »), sur un jeu de
  données trop petit pour éprouver le chemin qu'il prétendait vérifier. SYN-005 est réécrit le même jour.
- **Proposition** : écrire l'état observable des onze étapes restantes : DON-008 (1), ESP-010 (1), ESP-011 (1, 2),
  NAV-013 (1), PLT-012 (1), SYN-003 (2, 3), SYN-007 (1), SYN-008 (1), MOD-023 (1) ; puis faire refuser par
  `scripts/recette.mjs` une étape sans attendu. Une étape de pure préparation dit ce qu'on doit voir avant de continuer.
- **Niveau** : documentation et outillage du cahier.
- **Bénéfice attendu** : chaque étape peut échouer, donc chaque *réussi* veut dire quelque chose.

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

Puis, le 6 octobre 2026 : A12 (artefact : le carnet dans des documents partagés de claude.ai : **corrigée**, ADR 33), A13
(espace supprimé qui revenait : **corrigée**, ADR 34), A14 (premier passage sous Firefox, quatre causes : **corrigée**),
A15 (saisie de l'écran de connexion effacée par un rendu : **corrigée**, PR #116), **A16** (`mot-de-passe.js` instable
sous Firefox : ouverte, P2, [à corriger](#reste-a-faire) avant que Firefox devienne bloquant) et **A17** (artefact : un
suivi « Reprendre la main » d'avant le 3 octobre part dans la base de claude.ai : ouverte, P1, comportement décidé,
[plus bas](#decisions)).

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
| ~~Le résumé destiné à l'assistant doit-il être traduit à l'affichage ?~~ : non, c'est le texte envoyé ; l'interface dit qu'il part en français, le 6 octobre 2026 | [RLM-028](manuels/reprendre-la-main.md#rlm-028) | — |
| ~~Quel message pour une date d'objectif à plus d'un an ?~~ : « Choisis une date d'effet valide : passée, aujourd'hui, ou au plus tard dans un an. », le 6 octobre 2026 | [RLM-014](manuels/reprendre-la-main.md#rlm-014) | — |
| ~~Comment l'app doit-elle dire qu'un appareil vidé est le détenteur ?~~ : le talon décrit l'appareil détenteur (navigateur ou app, système, date) et le message envisage que ce soit celui-ci, le 6 octobre 2026 | [RLM-029](manuels/reprendre-la-main.md#rlm-029) | — |
| ~~Quelles vues suivent la date d'elles-mêmes à minuit ?~~ : toutes, une minute après au plus, jamais sous un formulaire ouvert ni pendant une saisie, le 6 octobre 2026 | [TRV-004](manuels/transverse.md#trv-004) | — |
| ~~Quels seuils de réactivité ?~~ : 150 ms par vue dans le banc (CI) ; sur téléphone, 200 ms visés, 500 ms au plus, le 6 octobre 2026 | [TRV-007](manuels/transverse.md#trv-007) | — |
| ~~Que doit dire l'assistant quand sa fonction est injoignable ou non déployée ? (A4)~~ : « non déployé », « non configuré » ou « injoignable », corrigé le 5 octobre 2026 (PR #98) | [AST-007](manuels/assistant.md#ast-007) | — |
| ~~Que fait claude.ai de l'espace `db` d'un artefact ?~~ : ses documents sont partagés avec tous ceux qui ont le lien ; Selene range désormais les siens dans le sous-arbre privé de chacun (A12, ADR 33), le 6 octobre 2026 | [PLT-011](manuels/plateformes.md#plt-011) | — |
| ~~Marquer `selene_personnel` un compte de recette (P) ?~~ : oui, dans un projet de recette, jamais dans celui de l'app (`SELENE_SUPABASE_URL`), le 6 octobre 2026 | `RLM-*` (chemin P) | — |
| ~~Une dépendance de développement pour l'accessibilité ?~~ : oui, `axe-core` en version exacte, le 6 octobre 2026 | — | — |
| ~~`npm run recette` en CI ?~~ : oui, fait, et obligatoire pour fusionner (réglage du dépôt à appliquer) | — | [BL-12](#bl-12) |
| ~~Firefox ?~~ : oui sur ordinateur, non bloquant jusqu'au 20 octobre 2026, le 6 octobre | — | [BL-13](#bl-13) |
| ~~Dans l'artefact, que devient un suivi « Reprendre la main » d'avant le 3 octobre, encore marqué synchronisé ? (A17)~~ : il est ramené sur l'appareil au chargement, avec un avis, et l'écran dit vrai sur ce que voit claude.ai ; jamais dans la base de l'artefact. Décidé le 6 octobre 2026 (la recommandation retenue par la responsable) ; correctif à venir | [PLT-011](manuels/plateformes.md#plt-011), [RLM-024](manuels/reprendre-la-main.md#rlm-024) | la publication de l'artefact |
| À quelle condition Firefox devient-il bloquant ? Proposition : A16 corrigé, puis vingt passages consécutifs sans échec, lus dans le journal ; sinon décaler la date | — | [BL-13](#bl-13) |
| L'assistant hébergé : le déployer pour la bêta ? Proposition : non, et l'écrire | [AST-001](manuels/assistant.md#ast-001) à [AST-007](manuels/assistant.md#ast-007) | la recette de l'assistant hébergé |
| La PR #118 (le cahier à cocher) : la fusionner ? Proposition : oui, puis [BL-18](#bl-18) | — | l'exécution des campagnes sur la page |

Les questions ouvertes d'avant ce cahier sont tranchées depuis le 6 octobre 2026 : l'adresse d'un espace désactivé
mène à l'accueil et le dit ([ESP-006](manuels/espaces.md#esp-006)) ; un espace supprimé reste supprimé, même modifié
hors ligne ailleurs, qui le dit ([SYN-006](manuels/synchronisation.md#syn-006), anomalie A13, ADR 34).
