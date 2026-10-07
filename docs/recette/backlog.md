# Backlog qualité

Ce que la recette a révélé et qui reste à faire : automatisations à prioriser, lacunes qui ne s'automatisent pas,
anomalies à qualifier, documentation à corriger, décisions à prendre. Rien de tout cela n'a été implémenté par la
mise en place du cahier : ce sont des propositions, à transformer en tickets par la responsable du produit. Chaque élément
garde son identifiant `BL-nn` (jamais renuméroté) ; un élément fait est barré dans la table et daté, pas supprimé.

**Priorités** : celles des cas ([README](README.md#priorité)). P1 : un défaut ici perd ou expose des données, ou casse un
parcours essentiel ; P2 : une fonction importante ; P3 : du confort.

<a id="reste-a-faire"></a>
## Reste à faire, d'un coup d'œil

Tout ce qui reste ouvert, du plus urgent au moins urgent dans chaque groupe, tenu à jour le 7 octobre 2026. Une ligne
renvoie à son détail, qui fait foi ; une chose faite est barrée et datée ici comme dans son détail, jamais retirée. Les
démarches à la main qui ne touchent pas la qualité (stores, RGPD, validation du marché) restent dans
[a-faire.md](../a-faire.md) seulement. « Une session » : une session Claude Code ouverte sur ce dépôt, qui fait le
travail dans une PR ; « la responsable » : la responsable du produit.

### À corriger

| Quoi | Qui | Priorité | Échéance ou condition | Détail |
|---|---|---|---|---|
| A45 : `tests/browser/regulation-appareil.js` instable sous WebKit (RLM-015, le bouton d'objectif introuvable après les refus), outillé ; établir la cause s'il échoue encore | une session | P3 | au prochain échec de ce contrôle | [A45](perimetre.md#anomalies-et-observations) |
| ~~A44 : suivre un flux pendant une relecture de Dehors effaçait ses éléments~~ (fait le 7 octobre 2026, PR #141) | une session | P2 | — | [A44](perimetre.md#anomalies-et-observations) |
| A43 : `tests/browser/regulation.js` instable sous Firefox (« les quatre actions ont une cible de 44 px au moins »), revenu le 7 octobre avec 0 px (la vue n'était pas affichée), outillé davantage ; établir la cause s'il échoue encore | une session | P3 | au prochain échec de ce contrôle | [A43](perimetre.md#anomalies-et-observations) |
| ~~A42 : « En jachère » disait « plus de 1 jours »~~ (fait le 7 octobre 2026, PR #137) | une session | P3 | — | [A42](perimetre.md#anomalies-et-observations) |
| ~~A41 : renommer une enveloppe dans les Réglages renommait ses opérations sans le dire~~ (fait le 7 octobre 2026, PR #136) | une session | P3 | — | [A41](perimetre.md#anomalies-et-observations) |
| ~~A40 : un rendu de fond tombé pendant un appui faisait perdre le clic (la boîte de confirmation jamais ouverte)~~ (fait le 7 octobre 2026, PR #135) | une session | P2 | — | [A40](perimetre.md#anomalies-et-observations) |
| ~~A39 : `tests/browser/dehors.js` instable sous Firefox (l'élément du flux Atom pas venu)~~ (cause établie le 7 octobre 2026 : A44, corrigée, PR #141) | une session | P3 | — | [A39](perimetre.md#anomalies-et-observations) |
| ~~A38 : « Chercher « … » partout » de la palette gardait les filtres de la recherche précédente~~ (fait le 7 octobre 2026, PR #135) | une session | P2 | — | [A38](perimetre.md#anomalies-et-observations) |
| ~~A37 : un rendu de fond faisait perdre le focus clavier hors des champs (synchro, autre onglet, fin d'un envoi)~~ (fait le 7 octobre 2026, PR #133) | une session | P2 | — | [A37](perimetre.md#anomalies-et-observations) |
| A36 : `tests/browser/veille.js` instable sous Firefox (« une veille en double : dit »), outillé ; établir la cause s'il échoue encore | une session | P3 | au prochain échec de ce contrôle | [A36](perimetre.md#anomalies-et-observations) |
| ~~A35 : `tests/browser/dehors-croise.js` instable sous WebKit (un rechargement pendant une reprise du branchement)~~ (fait le 7 octobre 2026, PR #132) | une session | P3 | — | [A35](perimetre.md#anomalies-et-observations) |
| ~~A34 : `tests/browser/navigation.js` instable sous le processeur ralenti (la palette lue 150 ms après la frappe)~~ (fait le 7 octobre 2026, PR #132) | une session | P3 | — | [A34](perimetre.md#anomalies-et-observations) |
| ~~A33 : une synchro pendant une frappe effaçait la saisie d'un champ sans identifiant, hors des Réglages (la clé OpenAlex de Dehors)~~ (fait le 7 octobre 2026, PR #132) | une session | P2 | — | [A33](perimetre.md#anomalies-et-observations) |
| ~~A32 : `tests/browser/zotero.js` instable sous WebKit (la clé lue 500 ms après sa saisie)~~ (fait le 7 octobre 2026, PR #132) | une session | P3 | — | [A32](perimetre.md#anomalies-et-observations) |
| ~~A31 : les reprises d'A24 rendaient plus fréquentes les requêtes coupées par un rechargement, sous WebKit~~ (fait le 7 octobre 2026, PR #129) | une session | P3 | — | [A31](perimetre.md#anomalies-et-observations) |
| ~~A30 : l'étoile « Faire aujourd'hui » ne disait pas son état au lecteur d'écran~~ (fait le 7 octobre 2026, PR #130) | une session | P2 | — | [A30](perimetre.md#anomalies-et-observations) |
| ~~A29 : `tests/browser/indexeddb.js` instable sous WebKit (un rechargement coupait une écriture en vol)~~ (fait le 7 octobre 2026, PR #129) | une session | P3 | — | [A29](perimetre.md#anomalies-et-observations) |
| ~~A28 : une source se nommait par son résumé (« Gardée : « Nous montrons que… » »), dans les messages, les liens et la carte~~ (fait le 7 octobre 2026, PR #129) | une session | P3 | — | [A28](perimetre.md#anomalies-et-observations) |
| ~~A24 : le réseau revenu pendant un branchement parti hors ligne ne rebranchait plus la synchronisation avant le minuteur de 5 min (régression de la PR #122)~~ (fait le 6 octobre 2026, PR #127) | une session | P2 | — | [A24](perimetre.md#anomalies-et-observations) |
| ~~A25 : `tests/browser/dehors.js` instable sous WebKit~~ (fait le 6 octobre 2026, PR #127) | une session | P3 | — | [A25](perimetre.md#anomalies-et-observations) |
| ~~A26 : `tests/browser/artist-watch.js` instable sous le processeur ralenti~~ (fait le 6 octobre 2026, PR #127) | une session | P3 | — | [A26](perimetre.md#anomalies-et-observations) |
| ~~A27 : `tests/browser/cites.js` instable sous Firefox (un clic fait pendant le branchement du démarrage)~~ (fait le 7 octobre 2026, PR #127) | une session | P3 | — | [A27](perimetre.md#anomalies-et-observations) |
| ~~A17 : dans l'artefact claude.ai relié à sa base, un suivi « Reprendre la main » d'avant le 3 octobre part en entier dans la base de claude.ai, sous un texte qui dit que rien n'est envoyé~~ (fait le 6 octobre 2026, PR #121, avec la même fuite au versement d'un appareil sans compte) | une session | P1 | — | [A17](perimetre.md#anomalies-et-observations), [décision](#decisions) |
| ~~A18 : au lancement d'un appareil connecté, l'écran d'entrée s'affiche jusqu'aux premières réponses du serveur~~ (fait le 6 octobre 2026, PR #122) | une session | P2 | — | [A18](perimetre.md#anomalies-et-observations) |
| ~~A16 : `tests/browser/mot-de-passe.js` instable sous Firefox~~ (fait le 6 octobre 2026, PR #120) | une session | P2 | — | [A16](perimetre.md#anomalies-et-observations) |
| ~~BL-17 : un échec sous Firefox ne se voit pas (le job reste vert)~~ (fait le 6 octobre 2026, PR #120) | une session | P2 | — | [BL-17](#bl-17) |
| ~~BL-22 : les délais fixes qui suivent un geste ne se voient qu'au hasard de la charge de la CI~~ (fait le 6 octobre 2026, PR #127) | une session | P2 | — | [BL-22](#bl-22) |
| ~~BL-21 : fermer le réseau aux scénarios de navigateur (sous WebKit, une page tenue par le service worker échappe aux routes, et ses requêtes vont au vrai serveur)~~ (fait le 6 octobre 2026, PR #124) | une session | P2 | — | [BL-21](#bl-21), [A20](perimetre.md#anomalies-et-observations) |

### À automatiser

| Quoi | Qui | Priorité | Échéance ou condition | Détail |
|---|---|---|---|---|
| ~~BL-14 : la sauvegarde complète dans un vrai navigateur, sur deux appareils~~ (fait le 6 octobre 2026, PR #123) | une session | P1 | — | [BL-14](#bl-14) |
| ~~BL-15 : le hors-ligne réel (réseau coupé, page rechargée)~~ (fait le 6 octobre 2026, PR #123) | une session | P1 | — | [BL-15](#bl-15) |
| ~~BL-03 : l'isolation entre comptes rejouée chaque semaine~~ (fait le 6 octobre 2026, PR #124 : le workflow attend ses six secrets, plus bas) | une session | P1 | — | [BL-03](#bl-03) |
| ~~BL-20 : un résultat observable à chaque étape, contrôlé par `npm run recette`~~ (fait le 6 octobre 2026, PR #124) | une session | P3 | — | [BL-20](#bl-20) |
| ~~BL-19 : nommer, dans la matrice, les étapes que les tests ne couvrent pas~~ (les 73 cas P1 : fait le 6 octobre 2026, PR #125 ; les 88 cas P2 et P3 : fait le 7 octobre 2026) | une session | P3 | — | [BL-19](#bl-19) |
| ~~BL-23 : un faux Supabase commun, qui réponde comme PostgREST~~ (fait le 7 octobre 2026) | une session | P3 | — | [BL-23](#bl-23) |
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
| Les six secrets `ISOLATION_*` du workflow *Isolation* (les valeurs de `.env.isolation`) | la personne qui administre Supabase | P1 | après le premier `npm run isolation` réussi à la main (TRV-016) | [compte.md](../compte.md#vérifier-lisolation-entre-comptes), [BL-03](#bl-03) |
| Protéger `main` : PR obligatoire, contrôles `recette` et `build-and-test` requis | la personne qui administre le dépôt | P2 | dès que possible : `main` n'est pas protégée au 6 octobre 2026 | [BL-12](#bl-12), [a-faire.md](../a-faire.md#tout-de-suite-une-minute) |
| Firefox bloquant : retirer `continue-on-error` de `check.yml` | une session, à la demande | P2 | le 20 octobre 2026, si la condition proposée plus bas est remplie | [BL-13](#bl-13) |
| Les réglages du projet Supabase (SMTP, fonction `compte`, tables, compte personnel marqué, Postgres, offre Pro) | la personne qui administre Supabase | P1 et P2 | voir chaque ligne | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait) |

### À décider

| Question | Proposition | Échéance | Détail |
|---|---|---|---|
| À quelle condition Firefox devient-il bloquant ? | Vingt passages Firefox consécutifs sans échec depuis la correction d'A16 (PR #120) : sans l'avertissement « Scénarios en échec sous firefox (non bloquant) » ; sinon, décaler la date plutôt que bloquer sur un scénario instable | 20 octobre 2026 | [BL-13](#bl-13), [BL-17](#bl-17) |
| L'assistant hébergé : le déployer pour la bêta ? | Non, et l'écrire : il n'est pas prioritaire pour la bêta, et sans lui la gestion des clés et le registre RGPD restent plus simples | avant d'inviter les bêta-testeurs | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait), [assistant.md](../assistant.md) |
| La PR #118 (le cahier à cocher) : la fusionner ? | Oui : outillage seul, CI verte, et c'est le support qui manque pour exécuter une campagne ; puis [BL-18](#bl-18) | avant la première smoke | PR #118 |
| Un appareil **connecté** qui importe une sauvegarde contenant un suivi encore marqué synchronisé : le ramener sur l'appareil ? Aujourd'hui il redevient synchronisé, contenu compris, et le bandeau propose de le ramener ([RLM-024](manuels/reprendre-la-main.md#rlm-024)) | Oui, à l'import, avec la confirmation du bandeau : aucun chemin ne devrait remettre un suivi sur le serveur. Ce n'est pas fait par A17, parce que la règle « Selene ne choisit pas l'appareil à la place de la personne » vaut pour un compte connecté | avant la bêta | [A17](perimetre.md#anomalies-et-observations) |
| L'offre Pro de Supabase avant la bêta ? | Oui (une sauvegarde par jour, pas de mise en pause) ; décision de budget | avant d'inviter les bêta-testeurs | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait) |
| Un montant négatif saisi dans le Budget : le compter en valeur absolue, comme aujourd'hui ? | Oui : le sens vient du type choisi (Dépense, Revenu), et saisir une dépense « −12 » est une habitude des relevés bancaires ; la refuser obligerait à la retaper. Le cahier le dit désormais (C7) | aucune | [MOD-005](manuels/types-de-module.md#mod-005), [C7](perimetre.md#contradictions-entre-documentation-code-et-tests) |
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
| [BL-03](#bl-03) | ~~Rejouer l'isolation entre comptes chaque semaine en CI~~ (fait, en attente de ses secrets) | automatisation | P1 | TRV-016 |
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
| [BL-14](#bl-14) | ~~La sauvegarde complète dans un vrai navigateur, sur deux appareils~~ (fait) | automatisation | P1 | DON-002, DON-003, DON-004, DON-005, DON-006 |
| [BL-15](#bl-15) | ~~Le hors-ligne réel : réseau coupé, page rechargée, retour du réseau~~ (fait) | automatisation | P1 | SYN-004, PLT-001, SYN-010 |
| [BL-16](#bl-16) | Fumée de l'app iOS sur simulateur, en CI | automatisation | P3 | PLT-008 |
| [BL-17](#bl-17) | ~~Un échec sous Firefox doit se voir tant qu'il n'est pas bloquant~~ (fait) | fiabilité de la CI | P2 | tous |
| [BL-18](#bl-18) | La page du cahier à cocher sous contrôle de la CI (si la PR #118 est fusionnée) | outillage | P3 | tous |
| [BL-19](#bl-19) | ~~Matrice : nommer les étapes que les tests ne couvrent pas~~ (fait) | traçabilité | P3 | les 161 cas, étape par étape |
| [BL-20](#bl-20) | ~~Un résultat observable à chaque étape, contrôlé par `npm run recette`~~ (fait) | outillage | P3 | onze étapes, voir ci-dessous |
| [BL-21](#bl-21) | ~~Fermer le réseau aux scénarios de navigateur~~ (fait) | hygiène des essais | P2 | tous les scénarios ; A20 |
| [BL-22](#bl-22) | ~~Débusquer les délais fixes après un geste : un job au processeur ralenti~~ (fait) | fiabilité de la CI | P2 | tous les scénarios ; A10, A11, A16, A21 à A23 |
| [BL-23](#bl-23) | ~~Un faux Supabase commun, qui réponde comme PostgREST~~ (fait) | hygiène des essais | P3 | dix-huit scénarios ; A29, A31, A35 |

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
- **État** : **fait** le 6 octobre 2026 (PR #124) : le workflow *Isolation* (`.github/workflows/isolation.yml`), chaque
  lundi à 4 h 41 UTC, à chaque changement de `supabase/schema.sql`, du script ou du workflow poussé sur `main`, et à la
  demande ; lecture seule, actions épinglées, sauté avec un avis tant que ses six secrets manquent, en échec s'il est lancé
  à la main sans eux (`TU-ISO-10`, qui joue ce premier pas dans bash). Un échec envoie l'e-mail de GitHub. Reste à faire,
  hors du dépôt : poser les six secrets ([compte.md](../compte.md#vérifier-lisolation-entre-comptes)).

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
  consécutifs sans échec : l'avertissement de [BL-17](#bl-17) absent, ou « 81 scénarios, tous verts. » à la fin du
  journal du pas ; sinon, décaler la date plutôt que rendre bloquant un scénario instable, qui apprendrait à
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
- **État** : **fait** le 6 octobre 2026 (PR #123, `TN-sauvegarde-complete`), dans les trois moteurs. L'app écrit dans
  IndexedDB juste après la bulle : le scénario relit le stockage jusqu'à l'état attendu, au lieu de le lire aussitôt.

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
- **État** : **fait** le 6 octobre 2026 (PR #123, `TN-hors-ligne-reel`). La coupure de Playwright n'atteint pas le
  service worker : le serveur de fichiers est aussi rendu injoignable par une route, que Chromium applique au service
  worker ; le rechargement hors ligne n'est donc éprouvé que sous Chromium, le reste sous Firefox aussi. Sous WebKit, le
  scénario n'est pas joué, et le dit : une page tenue par le service worker y échappe aux routes de Playwright, ses
  requêtes partaient vers le vrai serveur (A20, la variante constatée que prévoyait le niveau ; [BL-21](#bl-21) ferme ce
  chemin). Cache vidé avant le rechargement, le scénario échoue : il prouve bien que l'app vient du cache.

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
- **État** : **fait** le 6 octobre 2026 (PR #120). Le pas des scénarios a l'identifiant `scenarios` ; quand il échoue sans
  bloquer, le pas « Signaler l'échec non bloquant » écrit l'avertissement « Scénarios en échec sous firefox (non
  bloquant) », visible sur la PR. Pour tous les moteurs, `tests/browser/run.js` écrit dans le résumé du job les scénarios
  en échec et leurs contrôles (`GITHUB_STEP_SUMMARY`).

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
- **État** : **les 73 cas P1, faits** le 6 octobre 2026 (PR #125). Chaque ligne P1 dit, étape par étape, quel test
  vérifie quoi et ce qui reste, lu dans le corps des tests : 33 lignes réécrites (les 40 autres l'étaient déjà).
  MOD-022 passe « couvert automatiquement » (`TN-annuler` et `TN-quotidien` en vérifient chaque étape). En chemin :
  `TN-regulation-perdu` vérifie vraiment l'étape 4 de DON-001 (la sauvegarde contient le suivi gardé sur
  l'appareil) : relié ; il n'importe qu'un suivi, pas « tout remplacer » : non relié à DON-002. `TN-sauvegarde-complete`
  et `TN-instagram` vérifient les étapes 4 et 5 de TRV-008 : reliés. `TS-ANDROID-FUMEE` reste hors de RLM-030. Ce
  qu'on y lit vaut plan d'automatisation : la plupart des « restent » sont un message exact à relire, ou un geste que
  le scénario fait sans en vérifier l'effet. **Les 88 cas P2 et P3, faits** le 7 octobre 2026 : chaque ligne dit, étape
  par étape, quel test vérifie quoi et ce qui reste, lu dans le corps des tests ; plus aucune ne porte la lacune
  générique. Onze cas passent « couvert automatiquement » (NAV-012 ; CPT-016, CPT-017, NAV-013, PEN-009, PEN-011,
  PEN-014, PEN-015, EXT-010, EXT-011, EXT-018) : le décompte devient 21 automatiques et 171 partiels. En chemin :
  `TN-sources-oubliees` vérifie l'étape 2 de PEN-008 (les références du dossier) et `TN-compte-neuf` et
  `TN-recherche-minuteur` deux états vides de TRV-015 : reliés ; deux attendus faux, C9 et C10, corrigés dans le cahier.
  Ce qui reste est, le plus souvent, un message exact à relire, une seconde plateforme ou un vrai appareil.
  **Le même jour, les messages** : sept cas dont il ne restait qu'un message, ou un geste sans effet vérifié, passent
  « couvert automatiquement » (EXT-005, EXT-013, EXT-015, EXT-016, DON-009, MOD-016, MOD-017) : 28 automatiques et 164
  partiels. Chaque contrôle ajouté échoue si le message change. EXT-001 ne garde que « Recherche… ». En lisant
  `zotero.js`, A28 : une source se nommait par son résumé, corrigée (`TU-MOD-65`). Puis cinq de plus (EXT-014, EXT-004, MOD-018,
  MOD-004, MOD-003) : 33 automatiques et 159 partiels ; PEN-003, PEN-004 et PEN-012 ne gardent qu'un reste chacun.
  En chemin, A30 (l'étoile d'une tâche du jour, muette pour un lecteur d'écran) et C11 (MOD-003 demandait de
  « décocher » une tâche faite, qui n'a plus de case). Enfin trois (NAV-003, ESP-009, CPT-003) : 36 automatiques et
  156 partiels ; C12 (NAV-003 attendait un message que la palette n'affiche jamais). Puis quatre (TRV-015, EXT-002, EXT-003,
  MOD-001) : 40 et 152 ; C13 (EXT-002 attendait une adresse que l'aperçu n'affiche pas). Puis neuf dont il ne restait
  qu'une étape, souvent la dernière (NAV-007, CPT-002, MOD-005, EXT-006, MOD-009, MOD-007, TRV-006, DON-003, MOD-002) :
  49 et 143. Trois se vérifient désormais sur le jeu d'essai du cahier lui-même (`donnee()` dans `helpers.js`) ; chaque
  contrôle ajouté échoue sous un mutant de l'app ; C14 (MOD-007 attendait « Yoga » là où l'app écrit « yoga »). En
  chemin, A37 : un rendu de fond faisait perdre le focus clavier, corrigé. Puis huit (PEN-003, PEN-004, PEN-007, NAV-004,
  RLM-004, EXT-001, CPT-001, PEN-013) : 57 et 135. NAV-004, PEN-003 et PEN-004 se vérifient sur le jeu d'essai ; la réponse
  de Crossref, retenue, laisse lire « Recherche… » ; le fichier de la planche s'ouvre hors ligne. Neuf mutants, neuf
  contrôles qui tombent. Puis quatre (CPT-006, ESP-004, ESP-003, NAV-005) : 61 et 131 ; en chemin, A38 (« Chercher
  « … » partout » gardait les filtres d'avant), corrigé, et deux attendus du cahier, C15 et C16, corrigés dans le cas.
  Puis trois dont seule la règle était prouvée, sans aucun écran (DON-010, MOD-012, PEN-005) : 64 et 128, tous trois sur
  le jeu d'essai. En chemin, A40 : le premier passage Firefox de cette PR a perdu un clic, et la cause était dans l'app
  (un rendu de fond tombé pendant l'appui), corrigée. Puis six (MOD-006, ESP-005, NAV-002, NAV-006, MOD-008, PEN-006) :
  70 et 122 ; MOD-006 et MOD-008 sur le jeu d'essai. En chemin, A41 (renommer une enveloppe dans les Réglages ne le disait
  pas), corrigé, et C17 (deux attendus de MOD-008), corrigé dans le cas. Treize mutants, treize contrôles qui tombent.
  Puis quatre dont il ne restait que l'écran (MOD-010, NAV-011, MOD-020, PEN-012) : 74 et 118, trois sur le jeu d'essai ;
  en chemin, A42 (« plus de 1 jours », dans Motifs), corrigé, et C18 : l'attendu « phalène, épuisé, n'y est jamais » ne
  pouvait pas échouer, « phalène » n'apparaissant dans aucun texte du jeu ; le jeu en gagne une occurrence ancienne. Huit
  mutants, huit contrôles qui tombent.
  Puis trois dont seule la règle était prouvée, sans aucun écran (DON-007, TRV-005, ESP-010) : 77 et 115. DON-007, entre
  deux navigateurs sans compte ; TRV-005, par les fuseaux du navigateur (Paris, Los Angeles, Auckland) et le changement
  d'heure du 25 octobre ; ESP-010, lu dans ce qui part vers la fausse fonction de l'assistant, le mot-témoin vu partir
  d'abord, pour que son absence prouve quelque chose. Sept mutants, sept contrôles qui tombent.
  Puis trois de l'assistant, aussi sans écran (AST-003, AST-005, AST-008) : 80 et 112, sur le jeu d'essai. Le faux modèle
  tente d'écrire même quand aucun outil ne lui est offert : l'app doit refuser à l'exécution, et une fenêtre d'accord
  ouverte se relèverait. Huit mutants : sept tombent ; le huitième est équivalent (l'outil d'un espace éteint n'a déjà
  pas de module, `firstOfType` ne retenant que les espaces affichés : la garde est double).
  Puis deux de « Reprendre la main », sur le chemin S (sans compte, `rlm-en-cours.json` importé : RLM-006, RLM-013) :
  82 et 110. Six mutants, six contrôles qui tombent.
  Puis RLM-025 et RLM-015, sur le même chemin : 84 et 108. RLM-015 fige l'horloge (le 7 octobre à 20 h à Paris, déjà le
  8 à Auckland) : les deux fuseaux ne tombent pas le même jour, quel que soit l'horaire de la CI. En chemin, deux
  contrôles qui passaient à vide : le suivi de ce jeu vit dans le site, pas dans le document local ; une bulle
  « Objectif enregistré » restée de la configuration. Six mutants, six contrôles qui tombent. Puis RLM-011 et RLM-007 :
  86 et 106 ; C19 (RLM-007 attendait une colonne « Les 7 d'avant » que l'app ne montre pas sans semaine précédente).
  Sept mutants, sept contrôles qui tombent. Puis RLM-019 et RLM-026 : 88 et 104 ; C20 (connecté, la suppression se dit
  « sur tous tes appareils »). Neuf mutants, huit contrôles qui tombent ; le neuvième, la pierre tombale retirée, ne
  change rien sur ce chemin (l'appareil 2 n'a rien modifié entre-temps) : `TU-SYN-05` et `TU-SYN-22` la prouvent. Puis
  SYN-003 et SYN-008, deux appareils coupés du réseau et l'horloge avancée jusqu'aux relèves : 90 et 102 ; SYN-007
  reste partiel (l'écriture de la version plus récente n'est qu'un document posé sur le faux serveur) ; C21 (couper le
  réseau ne fait rien dire à l'indicateur). Quatre mutants, quatre contrôles qui tombent. Puis RLM-027 : 91 et 101 ; en
  chemin, A48, un défaut de l'app (le suivi mis de côté ne revenait pas si l'autre compte s'était déconnecté), corrigé
  et prouvé par `TU-REG-42`. Puis MOD-019, PEN-001 et PEN-002, sur le jeu d'essai et l'horloge figée : 94 et 98. Puis
  MOD-011, MOD-015 et MOD-021, de même : 97 et 95 ; C22 (« → Chantier » ouvre « Modifier la tâche », la tâche déjà
  créée). Sept mutants, sept contrôles qui tombent. Puis MOD-013 et MOD-014, de même : 99 et 93 ; C23. Six mutants, six
  contrôles qui tombent. Le journal sans compte passé dans `regulation-perdu.js` (A51). Puis NAV-008, NAV-010 et ESP-008 :
  102 et 90 ; C24. Huit mutants, huit contrôles qui tombent. A53, un défaut de l'app trouvé par `dehors.js` en CI. Puis
  PEN-010, MOD-023 et MOD-024 : 105 et 87 ; C25. Sept mutants, sept contrôles qui tombent. Puis DON-005, CPT-007 et
  ESP-002 : 108 et 84 ; MOD-025 avance (étapes 1 et 2), son temps sur téléphone reste à la main ; C26, A54. Sept mutants,
  sept contrôles qui tombent. Puis EXT-008, EXT-017, EXT-009 et RLM-005 : 112 et 80 ; A55 (le délai de `run.js` suit le
  processeur ralenti). Puis RLM-008, RLM-020 et TRV-012 : 115 et 77 ; C27 (le cahier lisait un tableau que U9 a remplacé par une phrase).
  Puis AST-006 et CPT-013 : 117 et 75 ; A56 (au retour du réseau, ce qui attendait patientait jusqu'au relevé de 30 s). Puis SYN-001 : 118 et 74 ; A57 (rien n'était relevé au retour au premier plan). Puis PEN-008, RLM-017 et ESP-011 : 121 et 71. Puis NAV-009 : 122 et 70. Puis TRV-011, SYN-002, RLM-021 et RLM-022 : 126 et 66 ; A59 (un suivi dont le nom revient après un retrait ailleurs manquait à « Ce que Claude peut lire ») et A60 (une relève plus ancienne que la dernière synchronisation effaçait de l'appareil, jusqu'à la suivante, ce qu'il venait d'envoyer) et A61 (un fichier choisi pendant que la vue se redessine n'était pas importé). Puis RLM-002 : 127 et 65. Puis TRV-002 : 128 et 64. Puis TRV-009 : 129 et 63.

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
- **État** : **fait** le 6 octobre 2026 (PR #124). Les onze étapes ont un état observable ; `scripts/recette.mjs` refuse
  désormais une étape dont le résultat attendu est vide ou « — » (vérifié : DON-008 remis à « — », le contrôle le
  nomme).

<a id="bl-21"></a>
### BL-21 — Fermer le réseau aux scénarios de navigateur

- **Risque couvert** : un scénario qui atteint un vrai serveur. Les scénarios simulent Supabase par des routes de
  Playwright (`ctx.route('https://*.supabase.co/**')`) ; une requête que la route ne voit pas part vers l'adresse
  compilée dans l'app, celle du vrai projet. C'est arrivé le 6 octobre 2026 sous WebKit
  ([A20](perimetre.md#anomalies-et-observations)) : une page tenue par le service worker y échappe aux routes. Avec une
  session factice, le serveur refuse ; mais le journal anonyme des erreurs (`erreurs`) accepte une ligne sans session, et
  une vingtaine de scénarios permettent le service worker. La règle « aucune écriture sur les données de production »
  ne doit pas tenir à la chance.
- **Proposition** : dans `launchOptions` de `tests/browser/helpers.js`, un mandataire (`proxy`) qui envoie tout ce qui
  n'est pas `127.0.0.1` vers un port fermé : une requête que ni les routes ni le serveur de fichiers ne servent échoue,
  dans les trois moteurs, service worker compris. Le vérifier d'abord dans les trois moteurs de la CI (le mandataire
  ne doit gêner ni les routes ni le serveur de fichiers), puis une sonde : une requête non routée vers
  `https://exemple.supabase.co` doit échouer. Ensuite, et seulement ensuite, rejouer `hors-ligne-reel.js` sous WebKit :
  ses requêtes échoueront au lieu de partir, ce qui ne le rendra pas vert, mais sûr.
- **Niveau** : outillage des scénarios.
- **Dépendances** : aucune.
- **Bénéfice attendu** : aucune requête de test ne peut sortir de la CI, quel que soit le moteur ; un scénario qui
  oublie une route échoue au lieu de parler au vrai serveur.
- **État** : **fait** le 6 octobre 2026 (PR #124). Le mandataire est donné à chaque lancement par `engine.launch`
  (`helpers.js`), donc à tous les scénarios ; `TN-reseau-ferme` le vérifie dans les trois moteurs, page tenue par le
  service worker comprise. Le mandataire retiré pour lui seul (mutation, CI de la PR #124), il échoue dans les quatre
  jobs : la cible répond 200 sur les runners. La même course a montré deux choses : sous Firefox et WebKit, une requête
  vers un autre hôte passe par le service worker, que les routes n'atteignent pas (le scénario sépare donc les deux
  temps) ; et `csp.js` lisait, à chaque CI et dans les trois moteurs, les réglages d'inscription du vrai projet
  (`GET /auth/v1/settings`, sans écriture), faute de faux Supabase : il en a un. Le journal de chaque scénario nomme
  désormais toute requête arrêtée par le mandataire ; sous Chromium, plus aucune hors de `reseau-ferme.js`. Sous WebKit,
  le premier passage fermé en a nommé une autre, la plus grave : `hors-ligne.js` ouvre la page de test tenue par le
  service worker, et sa mesure d'audience (`POST /rest/v1/audience`, une écriture anonyme) partait vers le vrai projet
  depuis le 3 octobre au soir ; vérification et nettoyage dans [a-faire.md](../a-faire.md) (A20).
  `hors-ligne-reel.js` reste non joué sous WebKit : ses requêtes y échoueraient désormais au lieu de partir, sans
  atteindre le faux serveur.


<a id="bl-22"></a>
### BL-22 — Débusquer les délais fixes après un geste : un job au processeur ralenti

- **Risque couvert** : six instabilités de la même famille en trois jours (A10, A11, A16, A21, A22, A23) : un scénario
  qui attend un délai fixe là où il faudrait attendre un état, et qui casse quand la machine de la CI est chargée. Le job
  « démarrage lent » (A16) débusque ceux qui suivent l'ouverture de l'app ; ceux qui suivent un geste (un clic, puis une
  lecture du stockage ou d'une bulle) lui échappaient : A21, A22, A23 ont été trouvés un par un, par des PR qui ne les
  touchaient pas. Le 6 octobre 2026, 563 `waitForTimeout` dans 73 scénarios ; certains vérifient une absence, à bon droit.
- **Proposition** : `SELENE_CPU=<facteur>` dans `helpers.js` ralentit le processeur de Chromium (protocole DevTools,
  `Emulation.setCPUThrottlingRate`), pour chaque page ; un job *Check › browser (chromium, processeur ralenti)* rejoue la
  suite à ×4, quatre scénarios à la fois (la lenteur doit venir du ralentissement, pas de leur concurrence).
- **Niveau** : outillage des scénarios et CI.
- **Bénéfice attendu** : un délai fixe après un geste échoue à chaque PR, au lieu d'un jour sur dix.
- **État** : **fait** le 6 octobre 2026 (PR #127). En local, à ×4, deux scénarios sont tombés : `regulation.js` (la bulle
  lue avant qu'elle annonce la suppression) et `zotero.js` (la recherche vérifiée 500 ms après le clic) ; à ×6,
  `radar.js` (le passeur, 500 ms après le clic) et `mot-de-passe.js`, qui dépasse alors seulement les 3 minutes du
  lanceur, sans erreur. Les trois premiers attendent désormais l'état ; ×4 garde de la marge (`mot-de-passe.js` : 33 s
  seul). Son premier passage en CI a trouvé mieux qu'un délai fixe : une régression de l'app, A24 (le retour du réseau
  perdu pendant un branchement en cours), corrigée dans la même PR.

<a id="bl-23"></a>
### BL-23 — Un faux Supabase commun, qui réponde comme PostgREST

- **Risque couvert** : plusieurs scénarios (`agenda.js`, `indexeddb.js`, `dehors.js`, `veille.js`, `zotero.js`…)
  simulent Supabase en répondant `[]` à toute lecture et `{}` (ou rien) à toute écriture. Le branchement au démarrage y échoue après trois essais ; l'app le retente à 2, 5, 15, 30 et 60 s (A24), et
  affiche « Non synchronisé ». Ces scénarios, écrits pour un compte connecté, tournent donc dans un état dégradé qu'ils
  ne disent pas ; leurs rafales de fond rendent les rechargements fragiles (A29, A31), et un défaut qui ne se voit
  qu'avec une synchronisation réussie leur échappe.
- **Proposition** : un faux Supabase partagé dans `helpers.js`, sur le modèle de `fakeSupabase` de
  `tests/hosted-harness.js` et de celui de `sources.js` : une ligne par compte, `GET` filtré, `POST` qui crée, `PATCH`
  conditionnel qui répond `[{ user_id }]`. Les scénarios y passent un à un, chacun vérifié vert sous les trois moteurs.
- **Niveau** : outillage des scénarios.
- **Bénéfice attendu** : les scénarios connectés le sont vraiment ; plus de reprises de fond, donc plus de requêtes
  coupées par un rechargement ; un contrôle possible de l'indicateur « synchronisé » partout.
- **État** : **fait** le 7 octobre 2026 (PR #132). `fauxSupabase(ctx, autre)` dans `helpers.js` ; dix-huit scénarios y passent,
  verts sous Chromium, aussi à ×4. `agenda.js`, `indexeddb.js`, `dehors.js` et `veille.js` vérifient qu'ils sont
  synchronisés pour de vrai (`synchro(p)` vide), un contrôle qui échoue avec l'ancien faux. `agenda.js` vérifie en plus
  que l'adresse secrète du calendrier n'arrive pas au serveur. Trois scénarios ont dû suivre, sans défaut de l'app :
  - `indexeddb.js` déposait un document dans IndexedDB pendant que l'app enregistrait encore la saisie d'avant ;
    synchronisée, l'app le réécrivait par-dessus. Il attend désormais le calme avant de le déposer.
  - `assistant-injoignable.js` comptait les rendus dès l'ouverture, branchement compris (trois rendus, puis plus rien en
    dix secondes) ; il les compte une fois l'app au repos, et une boucle le ferait toujours échouer.
  - `mot-de-passe.js` lisait la bulle d'entrée aussitôt entré ; elle vient une fois le branchement fini, plus long quand
    il réussit, et à ×4 elle n'était pas encore là. Il l'attend.
  La CI a trouvé un quatrième cas sous WebKit, A32 (`zotero.js`, la clé lue 500 ms après sa saisie), corrigé de même ; et,
  sous Firefox, un vrai défaut de l'app que l'ancien faux cachait, A33 : une synchro pendant une frappe effaçait la saisie
  d'un champ sans identifiant, hors des Réglages. Corrigé, prouvé par `TU-MOD-66` et `TN-veille`. Puis A34
  (`navigation.js`, la palette lue trop tôt) et A35 (`dehors-croise.js`, migré à son tour).
  Le calme de 2,5 s avant chaque rechargement (A31) reste : il protège aussi des écritures parties juste avant.

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
A15 (saisie de l'écran de connexion effacée par un rendu : **corrigée**, PR #116), A16 (`mot-de-passe.js` instable
sous Firefox : **corrigée** côté test, PR #120, avec sept scénarios du même genre et un job « démarrage lent »), **A17**
(artefact : un suivi « Reprendre la main » d'avant le 3 octobre partait dans la base de claude.ai : P1, comportement
décidé, **corrigée** par la PR #121, avec la même fuite au versement d'un appareil sans compte dans un compte) et
A18 (au lancement d'un appareil connecté, l'écran d'entrée
s'affichait jusqu'aux premières réponses du serveur : P2, **corrigée** par la PR #122).

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
| ~~Dans l'artefact, que devient un suivi « Reprendre la main » d'avant le 3 octobre, encore marqué synchronisé ? (A17)~~ : il est ramené sur l'appareil au chargement, avec un avis, et l'écran dit vrai sur ce que voit claude.ai ; jamais dans la base de l'artefact. Décidé le 6 octobre 2026 (la recommandation retenue par la responsable) ; corrigé le même jour (PR #121), le versement d'un appareil sans compte compris | [PLT-011](manuels/plateformes.md#plt-011), [RLM-024](manuels/reprendre-la-main.md#rlm-024) | la publication de l'artefact |
| À quelle condition Firefox devient-il bloquant ? Proposition : vingt passages consécutifs sans échec depuis la correction d'A16 (PR #120), sans l'avertissement de [BL-17](#bl-17) ; sinon décaler la date | — | [BL-13](#bl-13) |
| L'assistant hébergé : le déployer pour la bêta ? Proposition : non, et l'écrire | [AST-001](manuels/assistant.md#ast-001) à [AST-007](manuels/assistant.md#ast-007) | la recette de l'assistant hébergé |
| La PR #118 (le cahier à cocher) : la fusionner ? Proposition : oui, puis [BL-18](#bl-18) | — | l'exécution des campagnes sur la page |
| Un montant négatif saisi dans le Budget : le compter en valeur absolue, comme aujourd'hui ? Proposition : oui, le sens vient du type choisi (C7) | [MOD-005](manuels/types-de-module.md#mod-005) | rien : `TN-budget` vérifie le comportement actuel |

Les questions ouvertes d'avant ce cahier sont tranchées depuis le 6 octobre 2026 : l'adresse d'un espace désactivé
mène à l'accueil et le dit ([ESP-006](manuels/espaces.md#esp-006)) ; un espace supprimé reste supprimé, même modifié
hors ligne ailleurs, qui le dit ([SYN-006](manuels/synchronisation.md#syn-006), anomalie A13, ADR 34).
