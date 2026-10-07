# Reprendre la main

L'espace sensible de Selene : un carnet autodéclaratif pour observer, réduire ou viser l'arrêt du tabac, du cannabis, de
l'alcool ou des réseaux sociaux ([regulation.md](../../regulation.md), ADR 26 et 27). Selene n'y pose aucun diagnostic,
ne calcule aucun sevrage, ne dit jamais qu'une quantité est sans risque. Trois promesses portent la plupart des cas
P1 : **une journée sans saisie n'est jamais zéro** ; **rien ne sort de l'espace** (ni vues générales, ni assistant sans
accord lu) ; **rien ne passe par le serveur** (un talon seulement : le nom, la présence, l'appareil détenteur).

## Préconditions communes

Deux chemins, que chaque cas désigne explicitement :

- **Chemin S (sans compte)** — suffit pour tout l'usage quotidien. Navigateur d'ordinateur (profil dédié), écran
  d'entrée → « Commencer sans compte » ; Réglages → Compte et données → Sauvegarde → Importer le jeu de données indiqué
  par le cas → « Confirmer » à « Remplacer tout l'état actuel par celui du fichier ? ». Un suivi importé s'ouvre même
  si l'espace n'est plus proposé à la création (« rien ne disparaît »).
- **Chemin P (compte personnel)** — pour l'offre, le stockage sur l'appareil, les autres appareils et la déconnexion.
  Version de recette (construite pour le projet Supabase de recette), connectée au **compte de recette P**, distinct de
  A et B, marqué `selene_personnel` dans ce projet, jamais dans celui de l'app
  ([README de la recette, « Le compte de recette P »](../README.md#le-compte-de-recette-p),
  [regulation.md](../../regulation.md#hors-de-loffre-publique)) ; « Compter mes jours d'usage, pour la bêta » coupé. Ne
  jamais se déconnecter pour hâter l'arrivée de la marque (la déconnexion vide l'appareil). Importer une sauvegarde
  sur P remplace l'état du compte sur tous ses appareils.

**Plateformes** : `AND` désigne ici l'APK de la Release GitHub, qui a l'espace (édition complète). L'AAB de Google Play
et l'app iOS (TestFlight compris) sont l'édition des stores : l'espace n'y existe pas, ce que vérifie
[RLM-030](#rlm-030) et seulement lui.

**Jeux de données** ([donnees/](../donnees/)) : [`rlm-a-configurer.json`](../donnees/rlm-a-configurer.json) (une Boîte et un
suivi « Carnet du soir » pas encore configuré, non partagé, assistant éteint) ;
[`rlm-en-cours.json`](../donnees/rlm-en-cours.json) (« Carnet du soir », alcool : objectif « au plus 2 verres standard » dès
le 1er septembre 2026 puis « au plus 1,5 » dès le 20 ; le 10 septembre, 1,5 verre « Repas de famille » + 1 verre,
journée confirmée ; le 11, une envie d'intensité 6 « Après le travail », appui « Marcher quelques minutes », jugé
« utile pour moi », une action « Marcher quelques minutes », journée confirmée à zéro ; le 12, 1 verre non confirmé) ;
[`rlm-synchronise-ancien.json`](../donnees/rlm-synchronise-ancien.json) (« Carnet du soir », tabac, observer, encore
synchronisé avec un accord daté du 1er septembre 2026, 3 cigarettes le 15 septembre « Pause café »).

**Configurer un suivi** (opération que les cas citent) : dans l'espace, « Commencer : choisir ce que je veux suivre » →
« Sujet du suivi » → « Enregistrer » → dans « Mon intention », « Intention », « Limite quotidienne pour réduire » (si
« Réduire »), « À partir du » → « Enregistrer ».

**Dates** : `J` désigne le jour de l'exécution, `J-1` la veille, etc. ; l'app affiche les dates courtes sous la forme
« 2 oct. » et les longues sous la forme « vendredi 2 octobre 2026 ». Les champs de quantité acceptent « 1,5 » ou « 1.5 »
selon le navigateur ; les cas écrivent « 1.5 ».

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [RLM-001](#rlm-001) | Compte personnel : l'espace est proposé, en dernier, et naît privé | P1 | Web, Mob |
| [RLM-002](#rlm-002) | Ailleurs : l'espace n'est proposé nulle part | P1 | Web, Mob, ART |
| [RLM-003](#rlm-003) | Premier réglage : nom libre, un sujet, aucune question de stockage | P1 | Web, Mob, AND, WIN |
| [RLM-004](#rlm-004) | Alcool : l'information sur le sevrage avant l'objectif, jamais répétée | P1 | Web, Mob |
| [RLM-005](#rlm-005) | Les quatre unités et leurs bornes | P1 | Web, Mob |
| [RLM-006](#rlm-006) | Le sujet d'un suivi commencé ne change plus | P2 | Web |
| [RLM-007](#rlm-007) | Observer, réduire, viser l'arrêt | P1 | Web, Mob |
| [RLM-008](#rlm-008) | Une journée sans saisie reste inconnue, jamais zéro | P1 | Web, Mob |
| [RLM-009](#rlm-009) | Confirmer une journée, puis la rouvrir par une saisie | P1 | Web, Mob |
| [RLM-010](#rlm-010) | Déclarer le total de la journée | P1 | Web, Mob |
| [RLM-011](#rlm-011) | Corriger une consommation après confirmation | P1 | Web, Mob |
| [RLM-012](#rlm-012) | Confirmation refusée si la journée a changé entre-temps | P1 | Web |
| [RLM-013](#rlm-013) | Supprimer une saisie, laisser une journée inconnue | P2 | Web, Mob |
| [RLM-014](#rlm-014) | Faire évoluer l'objectif : versions, date d'effet, historique | P1 | Web, Mob |
| [RLM-015](#rlm-015) | Dates à venir refusées ; le fuseau ne reclasse rien | P1 | Web |
| [RLM-016](#rlm-016) | Envie, appui choisi, action réalisée | P1 | Web, Mob |
| [RLM-017](#rlm-017) | Pause de cinq minutes : rechargement, fermeture, arrêt | P2 | Web, Mob, AND |
| [RLM-018](#rlm-018) | Marques et récompense : facultatives, dédupliquées, jamais perdues | P1 | Web, Mob |
| [RLM-019](#rlm-019) | Mes sept derniers jours | P2 | Web, Mob |
| [RLM-020](#rlm-020) | Aucun détail hors de l'espace | P1 | Web, Mob |
| [RLM-021](#rlm-021) | Partager le résumé avec l'assistant, puis arrêter | P1 | Web |
| [RLM-022](#rlm-022) | Deux appareils du même compte : le nom seulement | P1 | Web, Mob, AND, WIN |
| [RLM-023](#rlm-023) | Se déconnecter avec un suivi gardé ici | P1 | Web, Mob, AND, WIN |
| [RLM-024](#rlm-024) | Un suivi encore synchronisé revient sur un appareil | P1 | Web, Mob |
| [RLM-025](#rlm-025) | Exporter ce suivi ; la sauvegarde complète le contient | P2 | Web, Mob |
| [RLM-026](#rlm-026) | Supprimer le suivi | P1 | Web, Mob |
| [RLM-027](#rlm-027) | Changement de compte sur le même appareil | P1 | Web |
| [RLM-028](#rlm-028) | Affichage, clavier, libellés, anglais | P2 | Web, Mob |
| [RLM-029](#rlm-029) | Appareil détenteur dont le stockage a été effacé | P2 | Web |
| [RLM-030](#rlm-030) | Versions des stores : l'espace n'existe pas, un suivi créé ailleurs reste intact | P1 | AND, IOS |

Identifiants retirés : aucun.

---

<a id="rlm-001"></a>
### RLM-001 — Compte personnel : l'espace est proposé, en dernier, et naît privé

- **Fonctionnalité et règle** : « Reprendre la main » n'est proposé qu'au compte que le serveur marque
  `selene_personnel` ; proposé en dernier, sans mise en avant ; créé depuis le modèle ou depuis le type vide, il naît
  **non partagé** avec l'assistant.
- **Objectif, risque vérifié** : un suivi de santé envoyé à l'assistant dès sa création ; l'espace mis en avant.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin P ; aucun suivi « Reprendre la main » sur le compte ; Réglages → Espaces → « Activer
  Assistant » coché.
- **Données** : nom `Carnet type vide`.
- **Automatisés associés** : `TN-regulation`, `TU-REG-21`, `TU-REG-30`
- **Source** : [DOC] [regulation.md](../../regulation.md#hors-de-loffre-publique) ; [CODE] `offered`
  (`src/app/shell/actions.js`) ; [TEST] `tests/browser/regulation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Espaces → déplier « + Créer un espace ». | « D'un modèle » : quatorze modèles, le dernier « Reprendre la main », description « Tabac, cannabis, alcool ou réseaux sociaux : observer, réduire ou viser l'arrêt, à ton rythme. Privé par défaut ». Dans « Modèle ou type », « Reprendre la main » est le dernier des « Modèles » et figure parmi les « Types vides ». |
| 2 | « Créer » sur « Reprendre la main ». | Message « Module « Reprendre la main » créé. » ; l'espace apparaît dans la navigation. |
| 3 | Réglages → Assistant → « Ce que Claude peut lire ». | « Reprendre la main » est présent, **décoché**. |
| 4 | Réglages → Espaces : regarder la ligne de l'espace et ses réglages. | « Suivi privé : partage avec l'assistant désactivé à la création, détails exclus des vues générales. Son nom reste visible. », « Appuis et récompenses », « Ouvrir le suivi ». |
| 5 | « Sur mesure » : « Modèle ou type » → « Reprendre la main » (groupe « Types vides »), « Nom » : les données ; « Créer ». | Un second espace « Carnet type vide » ; dans « Ce que Claude peut lire », il est décoché lui aussi. |
| 6 | Ouvrir « Reprendre la main ». | « Suivi personnel et autodéclaratif, sans diagnostic ni programme de sevrage… », « Ce n'est ni un diagnostic, ni un programme de soin : un carnet… », bouton « Commencer : choisir ce que je veux suivre ». |

- **État final attendu** : deux suivis non configurés, non partagés.
- **Nettoyage** : supprimer « Carnet type vide » (Réglages → Espaces → « ✕ », retaper le nom) ; garder « Reprendre la
  main » pour [RLM-003](#rlm-003).

---

<a id="rlm-002"></a>
### RLM-002 — Ailleurs : l'espace n'est proposé nulle part

- **Fonctionnalité et règle** : hors du compte personnel (compte ordinaire, sans compte, artefact), le modèle et le type
  n'apparaissent ni dans l'accueil ni dans les Réglages ; un suivi déjà créé reste ouvert.
- **Objectif, risque vérifié** : l'espace proposé au public malgré la décision T3 du 3 octobre 2026.
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : compte de recette A (non marqué) ; un navigateur pour le chemin S ; `selene.html` ouvert comme
  artefact dans claude.ai.
- **Données** : `rlm-en-cours.json`.
- **Automatisés associés** : `TN-regulation`, `TN-regulation-appareil`, `TU-REG-30`
- **Source** : [DOC] [regulation.md](../../regulation.md#hors-de-loffre-publique) ; [TEST] `tests/browser/regulation-appareil.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Connectée au compte A : Réglages → Espaces → « + Créer un espace ». | Treize modèles, le dernier « Carnet » ; « Reprendre la main » absent de la grille et des deux groupes de « Modèle ou type ». |
| 2 | Chemin S, avant tout import : même vérification ; puis, sur l'accueil d'un état neuf, déplier « Choisir moi-même, parmi tous les modèles ». | Absent partout. |
| 3 | Dans l'artefact : même vérification qu'à l'étape 1. | Absent. |
| 4 | Chemin S : importer `rlm-en-cours.json`, ouvrir « Carnet du soir ». | Le suivi s'ouvre, entier (« Alcool · au plus 1,5 verre standard par jour », journal) ; « + Créer un espace » ne propose toujours pas l'espace. |

- **État final attendu** : rien de créé sur A ; le chemin S porte le jeu importé.
- **Nettoyage** : aucun.

---

<a id="rlm-003"></a>
### RLM-003 — Premier réglage : nom libre, un sujet, aucune question de stockage

- **Fonctionnalité et règle** : deux formulaires courts (nom et sujet, puis intention) ; le nom est enregistré tout de
  suite, le sujet seulement avec la première version d'objectif ; connectée, le suivi passe sur l'appareil dès le
  premier formulaire, **sans question** ; le compte n'en garde que le talon.
- **Objectif, risque vérifié** : un choix « synchroniser » encore proposé (contradiction C1 de la documentation) ; le
  contenu envoyé au serveur ; un sujet figé par un formulaire abandonné.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, WIN
- **Préconditions** : chemin P ; le suivi « Reprendre la main » créé et non configuré ([RLM-001](#rlm-001)) ; outils de
  développement → Network, filtre `app_state`.
- **Données** : nom `Carnet du soir` ; sujet « Tabac » ; intention « Observer, sans cible », à partir de J.
- **Automatisés associés** : `TU-REG-27`, `TU-REG-01`, `TU-REG-37`, `TN-regulation-appareil`
- **Source** : [CODE] `subjectForm`, `chooseDevice`, `whereText` ; [TEST] `TU-REG-27`, `TU-REG-37`, `tests/browser/regulation-appareil.js` ;
  étape 1 : anomalie [A6](../perimetre.md#anomalies-et-observations), corrigée.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'espace, déplier « Confidentialité et données ». | « Où vivent ces données. Pas encore configuré : ton compte n'en garde que le nom. Quand tu auras choisi ce que tu veux suivre, son contenu restera sur cet appareil seulement, sans passer par le serveur de Selene. » ; **pas** « Encore synchronisé avec ton compte… ». |
| 2 | « Commencer : choisir ce que je veux suivre ». | Formulaire « Ce que je veux suivre » : « Un suivi, un sujet, une unité… Le sujet ne change plus ensuite. » puis « Ce suivi reste sur cet appareil : Selene ne synchronise pas les suivis de santé, ton compte n'en garde que le nom. Seule la sauvegarde de ton appareil (Google ou iCloud), si tu l'as activée, peut l'inclure. » ; deux champs : le nom (prérempli « Reprendre la main ») et « Sujet du suivi » (Tabac, Cannabis, Alcool, Réseaux sociaux) ; **aucun** champ de stockage. |
| 3 | Nom : les données ; Sujet : « Tabac » ; « Enregistrer ». Dans « Mon intention », « Annuler ». | La navigation affiche « Carnet du soir » ; l'espace propose de nouveau « Commencer : choisir ce que je veux suivre » (le sujet n'est pas figé). |
| 4 | « Commencer » → « Tabac » → « Enregistrer » → « Observer, sans cible », « À partir du » J → « Enregistrer ». | Message « Objectif enregistré. Les journées déjà confirmées gardent le leur. » ; en-tête « Tabac · observer, sans cible ». |
| 5 | Déplier « Confidentialité et données ». | « Où vivent ces données. Sur cet appareil seulement. Ton compte n'en garde que le nom… Ce n'est pas un coffre chiffré… exporte-le de temps en temps. » ; ni « Garder sur cet appareil seulement… », ni aucun bouton qui synchronise. |
| 6 | Noter une consommation de `3`, contexte `NOTE-RLM003`. Network : ouvrir la dernière requête `PATCH` vers `app_state`, onglet *Payload*. | `site.modules` contient l'espace avec son nom, `"storage":"device"`, un `holder`, `"subject":null`, `"goals":[]`, `"entries":[]` ; aucune occurrence de `NOTE-RLM003` ni de `"tabac"` dans toute la charge utile. |

- **État final attendu** : « Carnet du soir » (tabac, observer) sur cet appareil, une saisie ; un talon sur le compte.
- **Nettoyage** : aucun (sert à [RLM-022](#rlm-022), [RLM-023](#rlm-023), [RLM-026](#rlm-026)).

---

<a id="rlm-004"></a>
### RLM-004 — Alcool : l'information sur le sevrage avant l'objectif, jamais répétée

- **Fonctionnalité et règle** : pour l'alcool, l'information sur le risque du sevrage (convulsions, delirium tremens),
  le recours à un médecin ou un CSAPA, les urgences (15, 112, 114) et Alcool Info Service précèdent le choix de
  l'objectif ; ensuite, elle est repliée dans l'espace, jamais montrée à chaque saisie ; les autres sujets ne l'ont pas.
- **Objectif, risque vérifié** : une réduction rapide encouragée sans information ; une information répétée au point
  d'être ignorée ; des numéros faux.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé.
- **Données** : sujet « Alcool », « Réduire… », limite `2`, à partir de J.
- **Automatisés associés** : `TN-regulation`, `TU-REG-24`
- **Source** : [DOC] [regulation.md](../../regulation.md#alcool) (sources vérifiées le 1er octobre 2026) ; [TEST]
  `tests/browser/regulation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « Commencer » → « Alcool » → « Enregistrer ». | « Mon intention » commence par « Un verre standard contient 10 g d'alcool pur, soit environ 25 cl de bière à 5 % ou 10 cl de vin à 12 %… il peut valoir plusieurs verres standard. », puis « En cas de dépendance à l'alcool… convulsions ou un delirium tremens. Prépare ce changement avec un médecin ou un CSAPA… », « …appelle le 15 (Samu) ou le 112… le 114… », « Alcool Info Service : 0 980 980 930, de 8 h à 2 h, 7 jours sur 7, anonyme et non surtaxé. », **avant** les champs. |
| 2 | Choisir les données, « Enregistrer ». | En-tête « Alcool · au plus 2 verres standard par jour » ; sous les quatre actions, un bloc replié « Alcool : sevrage, urgences, aide ». |
| 3 | Déplier ce bloc ; cliquer « alcool-info-service.fr ». | Les trois paragraphes de l'étape 1 ; le site d'Alcool Info Service s'ouvre dans un nouvel onglet. |
| 4 | « Noter une consommation / durée ». | Le formulaire explique « Une de plus » et « Total de la journée » et le verre standard ; **ni** « CSAPA », **ni** « sevrage », **ni** numéro d'urgence. |
| 5 | Annuler ; réimporter `rlm-a-configurer.json` ; configurer « Tabac ». | « Mon intention » ne contient ni « CSAPA » ni « sevrage » ; l'espace n'a pas de bloc « Alcool : sevrage, urgences, aide ». |

- **État final attendu** : un suivi tabac configuré.
- **Nettoyage** : aucun.

---

<a id="rlm-005"></a>
### RLM-005 — Les quatre unités et leurs bornes

- **Fonctionnalité et règle** : tabac en cigarettes (entier, 200 au plus par saisie), cannabis en grammes de produit (au
  centième, 100 au plus), alcool en verres standard (au dixième, 100 au plus), réseaux sociaux en minutes déclarées
  (entier, 1 440 au plus par saisie et par jour) ; sommes exactes au pas de l'unité.
- **Objectif, risque vérifié** : quantité impossible acceptée ; somme flottante (0,30000000000000004) ; unité mal
  expliquée (substituts nicotiniques comptés, grammes pris pour une dose de THC).
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S ; pour chaque sujet, réimporter `rlm-a-configurer.json` puis configurer le sujet,
  « Observer, sans cible », à partir de J.
- **Données** : celles de chaque étape, toutes à la date J.
- **Automatisés associés** : `TU-REG-03`, `TN-regulation`, `TU-REG-25`
- **Source** : [DOC] [regulation.md](../../regulation.md#unités) ; [CODE] `regulationQuantity`, `REG_QUANTITY`
  (`src/app/lib/labels.js`).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Tabac. Lire l'en-tête ; noter `3`. | « Le nombre de cigarettes fumées. Les substituts nicotiniques (patch, gomme, pastille, spray) ne se comptent pas ici… » ; « Aujourd'hui, déjà noté : 3 cigarettes ». |
| 2 | Tabac : noter `1.5`. | Le navigateur refuse l'envoi (bulle de validation native) ; le formulaire reste ouvert ; rien n'est noté. |
| 3 | Tabac : noter `201`, puis `0`. | Chaque fois, le formulaire se ferme et le message « Indique un nombre entier de cigarettes, 200 au plus. » s'affiche ; le total reste 3 cigarettes. |
| 4 | Cannabis : lire l'en-tête ; noter `0.25`, puis `0.255`, puis `101`. | « …pas une dose de THC : la teneur varie beaucoup… » ; « 0,25 g » ; `0.255` refusé par le navigateur ; `101` : « Indique une quantité en grammes, au centième près (0,25 par exemple), 100 au plus. » |
| 5 | Alcool : noter `0.1`, puis `0.2`. | « Aujourd'hui, déjà noté : 0,3 verre standard » (jamais 0,30000000000000004). |
| 6 | Alcool : noter `0.15`, puis `101`. | `0.15` refusé par le navigateur ; `101` : « Indique un nombre de verres standard, au dixième près (1,5 par exemple), 100 au plus. » |
| 7 | Réseaux sociaux : lire l'en-tête ; noter `1000`, puis `500` à la même date. | « …Selene ne mesure pas ton usage des autres applications et ne les bloque pas. » ; après `500` : « Une journée compte 1440 minutes : ce total les dépasserait. » ; le total reste 1 000 minutes. |
| 8 | Réseaux sociaux : noter `1441`. | « Indique un nombre entier de minutes, 1440 au plus. » |

- **État final attendu** : un suivi réseaux sociaux avec 1 000 minutes à J.
- **Nettoyage** : aucun.

---

<a id="rlm-006"></a>
### RLM-006 — Le sujet d'un suivi commencé ne change plus

- **Fonctionnalité et règle** : le sujet (donc l'unité) est figé avec la première version d'objectif ; un autre sujet,
  c'est un autre suivi. Deux appareils qui commencent le même suivi avec deux sujets : un seul est gardé et l'espace
  le signale (non reproductible à la main, couvert par `TU-REG-19`).
- **Objectif, risque vérifié** : un historique relu dans une autre unité (des cigarettes lues comme des verres).
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : chemin S, `rlm-en-cours.json` importé.
- **Données** : aucune.
- **Automatisés associés** : `TU-REG-01`, `TN-regulation-appareil`
- **Source** : [DOC] [regulation.md](../../regulation.md#parcours), étape 2 ; [CODE] `setupRegulation`, `addRegulationGoal`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir « Carnet du soir » ; « Faire évoluer mon objectif ». | Champs « Intention », « Limite quotidienne pour réduire (verres standard) », « À partir du » ; aucun champ de sujet. |
| 2 | Annuler ; Réglages → Espaces → réglages de « Carnet du soir ». | « Appuis et récompenses », « Ouvrir le suivi » ; aucun réglage de sujet ni d'unité. |
| 3 | L'espace n'affiche pas « Commencer : choisir ce que je veux suivre ». | Confirmé : aucun chemin ne rouvre le choix du sujet. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="rlm-007"></a>
### RLM-007 — Observer, réduire, viser l'arrêt

- **Fonctionnalité et règle** : « Réduire » compare le total d'une journée complète à la limite choisie ; « Observer »
  n'attribue ni réussite ni échec ; « Viser l'arrêt » vise zéro ; une limite de zéro est refusée (choisir l'arrêt) ;
  chaque journée affiche l'objectif qui l'a jugée.
- **Objectif, risque vérifié** : un verdict pendant l'observation ; une limite « 0 » qui ferait de chaque verre un échec
  déguisé ; un verdict jugé avec le mauvais objectif.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Réduire… », limite `2`, à
  partir de `J-3`.
- **Données** : les quantités et dates des étapes.
- **Automatisés associés** : `TU-REG-02`, `TU-REG-04`, `TN-regulation-perdu`
- **Source** : [DOC] [regulation.md](../../regulation.md#règles) ; [CODE] `regulationDay`, `dayStatus` ; vérifié par une
  sonde Chromium le 4 octobre 2026.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Noter `1` à `J-3`, puis « Confirmer une autre journée… » `J-3` → « Confirmer ». Noter `3` à `J-2`, confirmer `J-2`. | Message « Journée du … confirmée. » chaque fois. |
| 2 | « Faire évoluer mon objectif » : « Observer, sans cible », à partir de `J-1`. Noter `2` à `J-1`, confirmer `J-1`. | Message « Objectif enregistré. Les journées déjà confirmées gardent le leur. » |
| 3 | « Faire évoluer mon objectif » : « Viser l'arrêt », à partir de J. « Faire mon point du jour » → « Confirmer ». | La boîte dit « … : 0 verre standard au total. Aucune consommation notée ce jour-là : confirmer en fait une journée à zéro. » ; en-tête « Alcool · viser l'arrêt ». |
| 4 | Lire la liste de « Mes sept derniers jours ». | J : « complète : 0 verre standard · objectif atteint », « objectif du jour : viser l'arrêt » ; J-1 : « complète : 2 verres standard · observée », sans ligne d'objectif ; J-2 : « complète : 3 verres standard · au-delà de l'objectif », « objectif du jour : au plus 2 verres standard par jour » ; J-3 : « complète : 1 verre standard · objectif atteint », même objectif. Aucun jour avant J-3. |
| 5 | Lire le tableau. | « Ces 7 jours » : Journées suivies 4, Complètes (confirmées) 4, Inconnues ou à reconfirmer 0, Quantités déclarées, toutes journées 6 verres standard, Moyenne par journée complète 1,5 verre standard, Objectif atteint « 2 sur 3 journées évaluables » ; pas de colonne « Les 7 d'avant » : le suivi n'a pas encore de semaine précédente, et l'app ne montre pas une colonne de tirets ([C19](../perimetre.md#contradictions-entre-documentation-code-et-tests)) ; « Pas encore de semaine précédente à mettre en regard. » ; « Objectif changé pendant ces deux semaines : à partir du <J-1>, observer, sans cible ; à partir du <J>, viser l'arrêt. » |
| 6 | « Faire évoluer mon objectif » : « Réduire… », limite `0`, à partir de J. | Le formulaire se ferme ; « Pour réduire, indique une limite quotidienne positive dans l'unité du suivi. Pour zéro, choisis plutôt de viser l'arrêt. » ; l'en-tête reste « Alcool · viser l'arrêt ». |

- **État final attendu** : quatre journées complètes, trois versions d'objectif.
- **Nettoyage** : aucun.

---

<a id="rlm-008"></a>
### RLM-008 — Une journée sans saisie reste inconnue, jamais zéro

- **Fonctionnalité et règle** : une journée n'est complète qu'après confirmation explicite ; sans elle, elle est
  « inconnue », même avec des saisies ; zéro ne devient une donnée qu'en confirmant une journée vide ; annuler la
  confirmation ne pénalise rien ; les jours d'avant le début du suivi ne comptent pas.
- **Objectif, risque vérifié** : une journée oubliée comptée comme abstinente (ou comme un échec) ; une moyenne calculée
  sur des journées partielles.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Réduire… », limite `2`, à
  partir de `J-2`.
- **Données** : `1` à `J-1`.
- **Automatisés associés** : `TU-REG-06`, `TN-regulation`, `TN-regulation-perdu`
- **Source** : [DOC] [regulation.md](../../regulation.md#règles) ; [TEST] `TU-REG-06`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Lire l'espace sans rien noter. | « Aujourd'hui, déjà noté : 0 verre standard · pas encore confirmée » ; liste : J, J-1, J-2 « inconnue », chacun avec « confirmer » ; rien avant J-2 ; « Une journée inconnue ne vaut jamais zéro, ni un échec. Les jours d'avant le début du suivi ne comptent pas. » |
| 2 | Lire la section des sept derniers jours. | Pas de tableau tant qu'aucune journée n'est confirmée : « Rien à comparer pour l'instant : ce tableau ne compte que les journées confirmées, et aucune ne l'est encore. « Faire mon point du jour », le soir venu, confirme la première. » |
| 3 | Noter les données. | J-1 : « inconnue · déjà noté : 1 verre standard, pas encore confirmée » ; toujours pas de tableau, la même phrase. |
| 4 | « confirmer » sur J-2 ; lire la boîte ; « Annuler ». | « … : 0 verre standard au total. Aucune consommation notée ce jour-là : confirmer en fait une journée à zéro. Confirmer, c'est dire que toutes les consommations de cette journée sont notées. Annuler la laisse inconnue, sans pénalité. » ; après « Annuler », J-2 reste « inconnue », aucun message. |
| 5 | « confirmer » sur J-2 → « Confirmer ». | « Journée du <J-2> confirmée. » ; J-2 : « complète : 0 verre standard · objectif atteint » ; le tableau paraît : Journées suivies 3, Complètes 1, Inconnues ou à reconfirmer 2, Quantités déclarées 1 verre standard, Moyenne « 0 verre standard », Objectif atteint « 1 sur 1 journée évaluable ». |

- **État final attendu** : J-2 complète à zéro ; J-1 inconnue avec 1 verre ; J inconnue.
- **Nettoyage** : aucun.

---

<a id="rlm-009"></a>
### RLM-009 — Confirmer une journée, puis la rouvrir par une saisie

- **Fonctionnalité et règle** : « Faire mon point du jour » montre la date et le total exacts avant de confirmer ;
  toute quantité ajoutée après coup rend la journée « à reconfirmer » ; retoucher une note ne rouvre rien.
- **Objectif, risque vérifié** : une journée confirmée qui reste complète après un ajout (verdict faux) ; une note
  corrigée qui rouvrirait la journée.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Réduire… », limite `2`, à
  partir de J.
- **Données** : `1.5`, contexte `Apéritif` ; puis `1`.
- **Automatisés associés** : `TU-REG-07`, `TN-regulation`
- **Source** : [DOC] [regulation.md](../../regulation.md#règles) (réouverture) ; [TEST] `tests/browser/regulation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Noter `1.5`, contexte `Apéritif`. | Message « Noté. » ; « Aujourd'hui, déjà noté : 1,5 verre standard · pas encore confirmée ». |
| 2 | « Faire mon point du jour ». | Boîte : « <J en toutes lettres> : 1,5 verre standard au total. 1 saisie : 1,5 verre standard. Confirmer, c'est dire que toutes les consommations de cette journée sont notées… » |
| 3 | « Confirmer ». | « Journée du <J> confirmée. » ; « · journée confirmée » ; dans le journal, « Journée confirmée » avec « laisser inconnue ». |
| 4 | « modifier » sur la saisie de 1,5 ; changer le contexte en `Apéritif chez Camille` ; « Enregistrer ». | « Corrigé. » ; la journée reste « journée confirmée » ; la ligne porte « corrigé ». |
| 5 | Noter `1`. | Message « Noté. La journée du <J> était confirmée : elle est à reconfirmer. » avec un bouton « Confirmer » ; en-tête « · à reconfirmer » ; journal « Confirmation à refaire : la journée a changé depuis » ; liste « à reconfirmer : 2,5 verres standard après une modification ». |
| 6 | « Confirmer » dans le message (ou « Faire mon point du jour »). | Boîte « … : 2,5 verres standard au total. 2 saisies : 1,5 verre standard + 1 verre standard. » ; après confirmation, J « complète : 2,5 verres standard · au-delà de l'objectif ». |

- **État final attendu** : J complète, 2,5 verres standard.
- **Nettoyage** : aucun.

---

<a id="rlm-010"></a>
### RLM-010 — Déclarer le total de la journée

- **Fonctionnalité et règle** : « Le total de la journée » n'ajoute que la différence avec ce qui est déjà noté (un
  complément qui garde le total déclaré) ; un total égal n'ajoute rien ; un total plus bas est refusé avec ce qu'il
  faut corriger ; la confirmation est proposée, jamais supposée.
- **Objectif, risque vérifié** : double compte (1 + 3 au lieu de 3) ; un total plus bas qui effacerait des saisies.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Observer, sans cible », à
  partir de `J-1`.
- **Données** : `1` à `J-1` ; totaux `3`, `3`, `2` à `J-1`.
- **Automatisés associés** : `TU-REG-09`, `TN-regulation`
- **Source** : [DOC] [regulation.md](../../regulation.md#parcours), étape 3 ; [TEST] `TU-REG-09`, `tests/browser/regulation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Noter `1` à `J-1` (« Une consommation de plus »). | « Noté. » |
| 2 | « Noter » → « Je note » : « Le total de la journée : seule la différence avec ce qui est déjà noté s'ajoute », date `J-1`, quantité `3`. | « Complément noté : 2 verres standard, pour un total déclaré de 3 verres standard. » puis une boîte « … : 3 verres standard au total. 2 saisies : 1 verre standard + 2 verres standard. » |
| 3 | « Confirmer ». | J-1 « complète : 3 verres standard · observée » ; journal : « 2 verres standard (complément, total déclaré : 3 verres standard) ». |
| 4 | Total `3` à `J-1` de nouveau. | « Rien à ajouter : ce total est déjà noté pour ce jour-là. » puis la boîte de confirmation (total 3) : « Annuler » ; aucune ligne ajoutée au journal. |
| 5 | Total `2` à `J-1`. | Le formulaire se ferme ; « Le total déclaré (2) est inférieur à ce qui est déjà noté ce jour-là (3). Corrige ou supprime d'abord les saisies concernées dans le journal. » ; rien ne change. |

- **État final attendu** : J-1 complète, 3 verres standard en deux lignes.
- **Nettoyage** : aucun.

---

<a id="rlm-011"></a>
### RLM-011 — Corriger une consommation après confirmation

- **Fonctionnalité et règle** : « modifier » une quantité garde son identifiant, son instant de saisie et son type, date
  la correction à part (« corrigé ») et rouvre la journée ; déplacer une saisie d'une date à l'autre rouvre les deux
  journées.
- **Objectif, risque vérifié** : une correction qui crée un doublon ; une journée qui reste complète avec un total faux.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Observer, sans cible », à
  partir de `J-2` ; noter `1` à `J-2` et `1` à `J-1` ; confirmer `J-2` et `J-1`.
- **Données** : nouvelles valeurs `0.5`, puis date `J-2`.
- **Automatisés associés** : `TU-REG-07`, `TU-REG-17`, `TN-regulation-perdu`
- **Source** : [TEST] `TU-REG-07`, `TU-REG-17` ; [CODE] `useForm`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « modifier » sur la saisie de J-1. | Formulaire « Corriger une saisie » : Date, Quantité, Contexte ; pas de choix « Je note ». |
| 2 | Quantité `0.5` ; « Enregistrer ». | « Noté. La journée du <J-1> était confirmée : elle est à reconfirmer. » ; la ligne montre « 0,5 verre standard » et « corrigé » ; toujours une seule ligne pour J-1. |
| 3 | « modifier » sur cette saisie ; date `J-2`. | J-1 et J-2 sont toutes deux « à reconfirmer » dans la liste (J-1 : 0 verre standard, J-2 : 1,5 verre standard). |
| 4 | Confirmer J-2 puis J-1. | J-2 « complète : 1,5 verre standard · observée » ; J-1 « complète : 0 verre standard · observée ». |

- **État final attendu** : deux journées complètes, totaux corrigés.
- **Nettoyage** : aucun.

---

<a id="rlm-012"></a>
### RLM-012 — Confirmation refusée si la journée a changé entre-temps

- **Fonctionnalité et règle** : la confirmation porte l'instantané que la personne avait sous les yeux ; si une
  synchronisation ou un autre onglet a changé la journée pendant la boîte, rien n'est validé et l'interface le dit.
- **Objectif, risque vérifié** : valider un total que la personne n'a pas vu.
- **Priorité** : P1 · **Plateformes** : Web
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Observer, sans cible », à
  partir de J ; noter `1` à J ; ouvrir l'adresse de Selene dans un second onglet du même navigateur, sur « Carnet du soir ».
- **Données** : `0.5`.
- **Automatisés associés** : `TU-REG-08`, `TN-regulation`
- **Source** : [DOC] [regulation.md](../../regulation.md#règles) ; [TEST] `tests/browser/regulation.js` (« un autre
  onglet ajoute une quantité »).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Onglet 1 : « Faire mon point du jour » ; laisser la boîte ouverte (« 1 verre standard au total »). | Boîte ouverte. |
| 2 | Onglet 2 : noter `0.5` à J. Revenir à l'onglet 1. | Derrière la boîte, l'espace affiche désormais « 1,5 verre standard ». |
| 3 | Onglet 1 : « Confirmer ». | « Les consommations de cette journée ont changé pendant la confirmation (sur cet appareil ou un autre). Rien n'a été validé : vérifie le nouveau total, puis confirme à nouveau. » ; « · pas encore confirmée ». |
| 4 | « Faire mon point du jour » → « Confirmer ». | La boîte dit 1,5 verre standard ; la journée est confirmée. |

- **État final attendu** : J complète à 1,5 verre standard.
- **Nettoyage** : fermer le second onglet.

---

<a id="rlm-013"></a>
### RLM-013 — Supprimer une saisie, laisser une journée inconnue

- **Fonctionnalité et règle** : « suppr. » retire une saisie, avec « Annuler » quelques secondes ; retirer une quantité
  d'une journée confirmée la rouvre ; « laisser inconnue » retire la confirmation.
- **Objectif, risque vérifié** : suppression sans retour ; journée restée complète après suppression.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-en-cours.json` importé.
- **Données** : les saisies du jeu (10 et 11 septembre).
- **Automatisés associés** : `TU-REG-07`, `TN-regulation-appareil`
- **Source** : [DOC] [regulation.md](../../regulation.md#parcours), étape 4 ; [CODE] `removeEntry` ; vérifié par une sonde
  Chromium le 4 octobre 2026.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Journal : « suppr. » sur « 1 verre standard » du 10 sept. | Message « Supprimé : 1 verre standard le 10 septembre 2026. Cette journée est à reconfirmer. » avec « Annuler » (la date en lettres, un seul point : anomalie [A5](../perimetre.md#anomalies-et-observations), corrigée) ; la ligne « Journée confirmée » du 10 devient « Confirmation à refaire : la journée a changé depuis ». |
| 2 | « Annuler » dans les secondes qui suivent. | « Rétabli. Rien ne s'est passé. » ; la saisie revient ; la ligne du 10 redevient « Journée confirmée ». |
| 3 | « laisser inconnue » sur « Journée confirmée » du 11 sept. | « La journée du 11 sept. redevient inconnue. » avec « Annuler » ; la ligne disparaît. |
| 4 | « suppr. » sur l'envie du 11, puis sur l'action du 11. | « Envie du 11 sept. supprimée. » puis « Action du 11 sept. supprimée. » |

- **État final attendu** : le 10 confirmé ; le 11 sans confirmation, sans envie ni action.
- **Nettoyage** : réimporter `rlm-en-cours.json` si un autre cas suit.

---

<a id="rlm-014"></a>
### RLM-014 — Faire évoluer l'objectif : versions, date d'effet, historique

- **Fonctionnalité et règle** : chaque changement ajoute une version (date d'effet passée ou jusqu'à un an à venir),
  aucune n'est réécrite ; l'écran distingue l'objectif en cours, la prochaine version programmée et l'historique ; une
  journée confirmée garde l'objectif de sa confirmation, même corrigée puis reconfirmée.
- **Objectif, risque vérifié** : un nouvel objectif qui rejuge le passé ; une version future appliquée trop tôt.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-en-cours.json` importé.
- **Données** : « Réduire… » `1` à partir de `J+10` ; date `J+400` ; `2` verres à `J-1` ; « Réduire… » `5` à partir de `J-1`.
- **Automatisés associés** : `TU-REG-10`, `TU-REG-04`, `TU-I18N-18`
- **Source** : [DOC] [regulation.md](../../regulation.md#règles) (objectifs versionnés) ; [TEST] `TU-REG-10` ; vérifié par
  une sonde Chromium le 4 octobre 2026 ; [TEST] `TU-REG-04` (le message d'une date d'effet refusée, décision du
  6 octobre 2026 : il ne parle plus de consommation).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Lire « Mes objectifs » ; déplier « Historique : 2 versions ». | « En ce moment : au plus 1,5 verre standard par jour. » ; « à partir du 20 septembre 2026 : au plus 1,5 verre standard par jour (choisi le 20 sept.) », « à partir du 1er septembre 2026 : au plus 2 verres standard par jour (choisi le 1er sept.) » ; « Début du suivi : 1er septembre 2026. » |
| 2 | « Faire évoluer mon objectif » : « Réduire… », limite `1`, à partir de `J+10`. | « Objectif enregistré, à partir du <J+10 en lettres, avec l'année, par exemple 14 octobre 2026>. D'ici là, rien ne change. » (un seul point : anomalie A5, corrigée) ; en-tête inchangé « Alcool · au plus 1,5 verre standard par jour », suivi de « À partir du <J+10> : au plus 1 verre standard par jour. » ; « Historique : 3 versions », la plus récente en tête « (choisi le <J>) ». |
| 3 | « Faire évoluer mon objectif » avec la date `J+400`. | Le formulaire se ferme ; « Choisis une date d'effet valide : passée, aujourd'hui, ou au plus tard dans un an. » ; toujours 3 versions. |
| 4 | Noter `2` à `J-1`, confirmer `J-1`. | J-1 « complète : 2 verres standard · au-delà de l'objectif », « objectif du jour : au plus 1,5 verre standard par jour ». |
| 5 | « Faire évoluer mon objectif » : « Réduire… » `5` à partir de `J-1`. | J-1 garde « au-delà de l'objectif » et « objectif du jour : au plus 1,5 verre standard par jour » ; l'en-tête devient « Alcool · au plus 5 verres standard par jour ». |
| 6 | « modifier » la saisie de J-1 : `2.5` ; puis confirmer J-1. | Après la reconfirmation, J-1 « complète : 2,5 verres standard · au-delà de l'objectif », objectif du jour toujours 1,5 (gardé). |

- **État final attendu** : cinq versions d'objectif ; J-1 jugée avec l'objectif de sa première confirmation.
- **Nettoyage** : aucun.

---

<a id="rlm-015"></a>
### RLM-015 — Dates à venir refusées ; le fuseau ne reclasse rien

- **Fonctionnalité et règle** : envies, consommations, actions et confirmations ne se déclarent pas à l'avance (date
  maximale : aujourd'hui) ; un objectif peut être daté dans l'avenir ; chaque entrée garde sa date déclarée et, pour
  information, le fuseau de l'appareil : un voyage ou un changement d'heure ne la reclasse pas.
- **Objectif, risque vérifié** : une consommation « de demain » ; une saisie de 23 h 30 qui glisse au lendemain après un
  voyage.
- **Priorité** : P1 · **Plateformes** : Web
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Observer, sans cible », à
  partir de `J-1` ; Chrome, outils de développement → ⋮ → More tools → Sensors.
- **Données** : date `J+1` ; `1` à J.
- **Automatisés associés** : `TU-REG-04`, `TU-REG-05`, `TU-REG-25`, `TN-regulation-appareil`
- **Source** : [DOC] [regulation.md](../../regulation.md#règles) (dates locales) ; [TEST] `TU-REG-05`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « Noter » : date `J+1`. Puis « J'ai une envie », « J'ai réalisé une action », « Confirmer une autre journée… » avec `J+1`. | Chaque fois, le navigateur refuse l'envoi (date au-delà du maximum) ; rien n'est enregistré. |
| 2 | « Faire évoluer mon objectif » : « Viser l'arrêt », à partir de `J+1`. | Accepté : « Objectif enregistré, à partir du <J+1>. D'ici là, rien ne change. » |
| 3 | Sensors → Location : fuseau `Europe/Paris` ; recharger ; noter `1` à J. | La saisie apparaît au journal à la date J. |
| 4 | Sensors → Location : fuseau `Pacific/Auckland` (en avance sur Paris), recharger, rouvrir l'espace. | La saisie reste datée J au journal ; elle n'a pas changé de jour. « Aujourd'hui » peut désigner une autre date (celle d'Auckland) : c'est attendu. |
| 5 | Remettre le fuseau d'origine ; exporter le suivi ([RLM-025](#rlm-025)) et chercher la saisie dans le fichier. | La saisie porte `"date"` = J et `"zone": "Europe/Paris"`. |

- **État final attendu** : une saisie à J, un objectif futur.
- **Nettoyage** : Sensors → Location : « No override ».

---

<a id="rlm-016"></a>
### RLM-016 — Envie, appui choisi, action réalisée

- **Fonctionnalité et règle** : une envie n'est ni un écart ni un échec et ne donne pas de marque ; choisir un appui
  n'est pas l'avoir fait ; « Je l'ai fait » déclare réalisé l'appui choisi (une seule action, même appuyé deux fois) ;
  « J'ai réalisé une action » vaut même un jour avec consommation ; les retours restent descriptifs.
- **Objectif, risque vérifié** : une envie comptée comme un échec ; un appui choisi compté comme fait ; des actions en
  double.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Tabac », « Observer, sans cible », à
  partir de J.
- **Données** : intensité `7`, contexte `Après le repas`, appui « Dessiner » ; action « Contacter quelqu'un ».
- **Automatisés associés** : `TU-REG-13`, `TN-regulation`
- **Source** : [DOC] [regulation.md](../../regulation.md#parcours), étape 3 ; [TEST] `TU-REG-13`, `tests/browser/regulation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « J'ai une envie ». | « Une envie n'est ni un écart ni un échec, et ne donne pas de marque. Choisir un appui ne veut pas dire l'avoir fait… » ; champs Date, « Intensité de 0 à 10, facultative », « Contexte ou déclencheur, facultatif », « Un appui que je peux essayer, facultatif » (« Aucun pour l'instant » et les quatre appuis par défaut), « Après coup, cet appui a été… », « Prendre une pause de cinq minutes maintenant ? ». |
| 2 | Intensité `11`. | Refusé par le navigateur (maximum 10). |
| 3 | Les données, pause « Non », « Enregistrer ». | « Envie notée. Ce n'est pas un écart. » ; journal : « Envie · intensité 7/10 · appui choisi : Dessiner », « Après le repas », boutons « Je l'ai fait », « Pause de 5 min », « modifier », « suppr. » ; aucune ligne « Action réalisée ». |
| 4 | « Je l'ai fait » sur l'envie. | « C'est noté : Dessiner. Une action réalisée, pas seulement choisie. » ; journal « Action réalisée : Dessiner » à la date de l'envie ; « Je l'ai fait » disparaît de l'envie. |
| 5 | « modifier » l'envie : « Après coup » → « utile pour moi ». | « Ce que j'en ai dit, ces 30 derniers jours » : « Dessiner : choisi 1 fois lors d'une envie · réalisé 1 fois · utile pour moi ×1 », puis « Une description, pas une conclusion… ». |
| 6 | Noter `2` cigarettes ; « J'ai réalisé une action » : `Contacter quelqu'un` (suggéré par la liste). | Le formulaire dit « …faite pour de vrai, même un jour où tu as consommé. » ; message « Action gardée. Un écart, plus tard, ne l'efface pas. » |

- **État final attendu** : une envie, deux actions, une consommation à J.
- **Nettoyage** : aucun.

---

<a id="rlm-017"></a>
### RLM-017 — Pause de cinq minutes : rechargement, fermeture, arrêt

- **Fonctionnalité et règle** : la pause enregistre une échéance absolue dans l'envie ; le temps restant se recalcule
  chaque seconde et à chaque retour (rechargement, veille, autre appareil) ; elle s'arrête sans commentaire ; échue,
  elle reste « terminée » dix minutes puis disparaît ; aucune marque à l'expiration ; le minuteur de quinze minutes de
  Selene n'est pas touché.
- **Objectif, risque vérifié** : une pause perdue au rechargement ou remise à cinq minutes ; une pause qui récompense.
- **Priorité** : P2 · **Plateformes** : Web, Mob, AND
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Tabac », « Observer, sans cible », à
  partir de J.
- **Données** : envie avec appui « Marcher quelques minutes ».
- **Automatisés associés** : `TU-REG-16`, `TN-regulation`, `TN-regulation-perdu`
- **Source** : [DOC] [regulation.md](../../regulation.md#pause-de-cinq-minutes) ; [TEST] `TU-REG-16`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « J'ai une envie », appui « Marcher quelques minutes », pause « Oui, lancer la pause », « Enregistrer ». | « Envie notée. Cinq minutes, à ton rythme. » ; encadré « Cinq minutes de pause », décompte partant de 5:00 ; « Jusqu'à HH:MM. Elle continue si tu fermes l'app ou si l'écran se met en veille. Tu peux l'arrêter quand tu veux. » ; boutons « J'ai fait : Marcher quelques minutes » et « Arrêter la pause ». |
| 2 | Après environ une minute, recharger la page et rouvrir l'espace. | Le décompte reprend vers 3:5x (pas 5:00) ; même heure « Jusqu'à ». |
| 3 | Fermer l'onglet (ou l'app), attendre une minute, rouvrir. | Le décompte a continué (environ 2:5x). |
| 4 | « Arrêter la pause ». | L'encadré disparaît, sans message. |
| 5 | « Pause de 5 min » sur la ligne de l'envie ; attendre cinq minutes. | À l'échéance : « Pause terminée », « Tu peux noter ce qui t'a aidé, ou simplement fermer cet encadré. » et « Fermer » ; aucune ligne ajoutée au journal ; aucune marque (si les marques sont affichées, leur nombre est inchangé). |
| 6 | Quitter l'espace, y revenir plus de dix minutes après l'échéance. | L'encadré n'est plus là. |

- **État final attendu** : une envie dont la pause est échue.
- **Nettoyage** : aucun.

---

<a id="rlm-018"></a>
### RLM-018 — Marques et récompense : facultatives, dédupliquées, jamais perdues

- **Fonctionnalité et règle** : masquées par défaut ; une marque par date où au moins une action a été déclarée
  réalisée ; ni l'envie, ni la consommation, ni la pause n'en donnent ; un écart n'en retire aucune ; supprimer une action
  erronée corrige le compte ; jalons fixes 1, 3, 7, 14, 30 ; récompense personnelle à un seuil de 1 à 365 ; appuis : une
  action par ligne, sans doublon.
- **Objectif, risque vérifié** : double gain ; une remise à zéro après un écart (mécanique punitive) ; une série
  obligatoire.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-en-cours.json` importé.
- **Données** : récompense `Un livre de poche`, seuil `2` ; appuis existants + lignes `Boire un verre d'eau` et `Dessiner`.
- **Automatisés associés** : `TU-REG-14`, `TU-REG-15`, `TN-regulation`
- **Source** : [DOC] [regulation.md](../../regulation.md#marques-et-récompense-facultatives) ; [TEST] `TU-REG-14`,
  `TU-REG-15`, `tests/browser/regulation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir « Carnet du soir ». | Pas de section « Les gestes restent ». |
| 2 | « Personnaliser mes appuis et récompenses » : « Marques et jalons » → « Affichés dans cet espace », « Ma récompense » : `Un livre de poche`, seuil `2` ; ajouter les deux lignes d'appui ; « Enregistrer ». | « Enregistré. » ; « Les gestes restent » : « 1 marque · une par journée où tu as déclaré une action réalisée. », « ● 1 marque, jalon atteint », « ○ 3 marques, à venir » (puis 7, 14, 30), « Prochain jalon : 3 marques. », « Ma récompense à 2 marques : Un livre de poche · encore 1 » ; « Ce qui peut m'aider » liste « Dessiner » une seule fois et « Boire un verre d'eau ». |
| 3 | « Je l'ai fait » sur l'envie du 11 sept. | Une action « Marcher quelques minutes » datée du 11 ; toujours « 1 marque » (même date que l'action existante). |
| 4 | « J'ai réalisé une action » à J : `Dessiner`. | « 2 marques » ; récompense « atteinte ». |
| 5 | Seconde action à J : `Boire un verre d'eau` ; puis noter une consommation de `1` à J. | Toujours « 2 marques » ; la consommation ne retire rien. |
| 6 | « suppr. » sur l'action « Dessiner » de J. | Toujours « 2 marques » (« Boire un verre d'eau » reste à J). |
| 7 | « suppr. » sur l'action « Boire un verre d'eau » de J. | « 1 marque » ; « Annuler » dans le message → « 2 marques ». |
| 8 | « Personnaliser » : seuil `0`, puis `366`. | Refusé par le navigateur (bornes 1 et 365). |

- **État final attendu** : marques affichées, 2 marques, récompense atteinte.
- **Nettoyage** : aucun.

---

<a id="rlm-019"></a>
### RLM-019 — Mes sept derniers jours

- **Fonctionnalité et règle** : les sept derniers jours en face des sept précédents ; moyenne sur les seules journées
  complètes ; les moyennes ne sont dites comparables que si chaque période compte au moins quatre journées complètes et
  si leurs couvertures diffèrent de deux journées au plus. Sans aucune journée confirmée sur les deux semaines, une phrase
  remplace le tableau ; sans semaine précédente, le tableau n'a pas de colonne pour elle.
- **Objectif, risque vérifié** : une comparaison trompeuse (une semaine bien remplie contre une semaine presque vide) ; un
  tableau de tirets et de zéros, le premier jour, lu comme un échec.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-a-configurer.json` importé ; configurer « Alcool », « Observer, sans cible », à
  partir de `J-13`.
- **Données** : confirmations à zéro de `J-13`, `J-12`, `J-11`, `J-10` ; `2` verres à J ; confirmations de `J-3` à J.
- **Automatisés associés** : `TU-REG-11`, `TU-REG-12`, `TU-REG-40`, `TN-regulation`, `TN-regulation-perdu`
- **Source** : [DOC] [regulation.md](../../regulation.md#bilan-sur-sept-jours) ; [TEST] `TU-REG-12`, `TU-REG-40` ; vérifié
  par une sonde Chromium le 4 octobre 2026 ; l'état sans journée confirmée, le 6 octobre 2026 (U9 de l'audit).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Avant toute confirmation, lire « Mes sept derniers jours ». | Pas de tableau : « Rien à comparer pour l'instant : ce tableau ne compte que les journées confirmées, et aucune ne l'est encore. « Faire mon point du jour », le soir venu, confirme la première. » ; la règle « Une journée inconnue ne vaut jamais zéro, ni un échec » reste au-dessus, la liste des jours et leurs boutons « confirmer » en dessous. |
| 2 | « Confirmer une autre journée… » pour J-13, J-12, J-11, J-10 (chaque fois « Confirmer »). Noter `2` à J ; confirmer J-3, J-2, J-1 et J. | Chaque confirmation : « Journée du … confirmée. » |
| 3 | Lire le tableau. | « Ces 7 jours » / « Les 7 d'avant » : Journées suivies 7 / 7 ; Complètes (confirmées) 4 / 4 ; Inconnues ou à reconfirmer 3 / 3 ; Quantités déclarées, toutes journées 2 verres standard / 0 verre standard ; Moyenne par journée complète 0,5 verre standard / 0 verre standard ; Objectif atteint — / — ; « Les deux périodes sont renseignées de façon voisine : leurs moyennes peuvent se comparer. » |
| 4 | Confirmer aussi J-6, J-5, J-4. | Complètes (confirmées) 7 / 4 ; Moyenne par journée complète 0,29 verre standard / 0 verre standard ; « Les deux périodes ne sont pas renseignées de la même façon (7 et 4 journées complètes) : leurs moyennes ne se comparent pas telles quelles. » |
| 5 | « laisser inconnue » sur les confirmations de J, J-1, J-2 et J-3. | Complètes (confirmées) 3 / 4 ; « Moins de 4 journées complètes dans l'une des périodes : leurs moyennes ne se comparent pas, l'écart dirait surtout ce qui manque. » |

- **État final attendu** : trois journées complètes cette semaine, quatre la précédente.
- **Nettoyage** : aucun.

---

<a id="rlm-020"></a>
### RLM-020 — Aucun détail hors de l'espace

- **Fonctionnalité et règle** : le nom et la présence de l'espace restent visibles (navigation, accueil, Réglages,
  palette) ; ses détails n'apparaissent nulle part ailleurs : ni recherche, ni motifs, ni dérive lexicale, ni test lunaire,
  ni bilan général, ni planche de lunaison, ni reprise sur l'accueil, ni liens, ni rangement depuis la Boîte, ni widget,
  ni notifications ; l'accueil n'en montre que « Suivi privé : ouvrir pour consulter ».
- **Objectif, risque vérifié** : une note de santé visible par-dessus l'épaule, sur l'accueil ou dans une recherche.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-en-cours.json` importé ; créer un espace depuis le modèle « Motifs » ; dans la Boîte,
  garder la note `famille recomposée`.
- **Données** : recherches `Repas de famille`, `Après le travail`, `Marcher` ; motif `famille`.
- **Automatisés associés** : `TU-REG-22`, `TN-regulation`, `TN-regulation-perdu`
- **Source** : [DOC] [regulation.md](../../regulation.md#confidentialité) (affichage) ; [TEST] `TU-REG-22`,
  `tests/browser/regulation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Accueil. | Une carte « Carnet du soir » : « Suivi privé : ouvrir pour consulter » ; aucune quantité, envie ou note ; aucune entrée du suivi dans « Aujourd'hui » ni dans une reprise. |
| 2 | Chercher (barre de recherche) chacune des trois données. | Aucun résultat pour « Repas de famille », « Après le travail » ; « Marcher » ne renvoie rien du suivi. |
| 3 | Palette (Ctrl+K ou ⌘K) : taper `Carnet`, puis `famille`. | « Carnet du soir » propose d'ouvrir l'espace ; `famille` ne renvoie que la note de la Boîte. |
| 4 | Motifs : ajouter le motif `famille`. | Une occurrence, dans la Boîte ; aucune dans « Carnet du soir ». |
| 5 | Bilan (bilan du cycle), puis la planche de lunaison. | Ni le nom « Carnet du soir », ni un détail du suivi. |
| 6 | Accueil → capture : `Carnet du soir : deux verres hier` → « Garder » ; ouvrir la Boîte. | La note est dans la Boîte ; aucune proposition « Ranger » vers « Carnet du soir » (ni message « … ? Ranger », ni bouton « Ranger : … ») ; parmi les boutons « → … » sous chaque note, aucun « → Carnet du soir ». |
| 7 | Ouvrir l'espace. | Aucun bouton « Je m'arrête ici… » (pont de reprise, dont le texte serait synchronisé). |

- **État final attendu** : un espace Motifs et deux notes en plus dans la Boîte.
- **Nettoyage** : supprimer l'espace Motifs et les deux notes.

---

<a id="rlm-021"></a>
### RLM-021 — Partager le résumé avec l'assistant, puis arrêter

- **Fonctionnalité et règle** : le partage n'est possible qu'après lecture du **résumé exact** qui partirait (sujet,
  unité, objectif, chiffres des sept derniers jours), jamais les notes, envies, déclencheurs, appuis ni la récompense ;
  ce résumé est affiché en permanence dans « Confidentialité et données » ; arrêter empêche les envois suivants sans
  retirer ce qui est déjà parti.
- **Objectif, risque vérifié** : un détail intime envoyé à un modèle sans que la personne ait lu ce qui part.
- **Priorité** : P1 · **Plateformes** : Web
- **Préconditions** : chemin P ; `rlm-en-cours.json` importé sur le compte P (cet appareil en devient le détenteur) ;
  assistant activé et clé de recette enregistrée ([AST-001](assistant.md#ast-001)) ; Network filtré sur
  `functions/v1/assistant`.
- **Données** : question `Bonjour ?`.
- **Automatisés associés** : `TU-REG-23`, `TU-REG-36`, `TN-regulation`, `TN-regulation-appareil`
- **Source** : [DOC] [regulation.md](../../regulation.md#confidentialité) (assistant) ; [TEST] `TU-REG-23`,
  `tests/browser/regulation.js` ; vérifié par une sonde Chromium le 4 octobre 2026.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « Carnet du soir » → « Confidentialité et données ». | « Non partagé : l'assistant ne reçoit rien de ce suivi. Si tu le partages, il recevra ce résumé, et rien d'autre : » puis « CARNET DU SOIR : suivi personnel autodéclaratif (alcool, en verres standard (10 g d'alcool pur)). Objectif choisi : au plus 1,5 verre standard par jour. Sept derniers jours : 7 jours suivis, 0 journée complète, 7 inconnues ou à reconfirmer (une journée inconnue ne vaut pas zéro) ; déclaré en tout : 0 verre standard ; moyenne par journée complète : sans objet ; objectif atteint 0 fois sur 0 journée évaluable. Notes, envies… » (virgule décimale, 0 et 1 au singulier : anomalie A5, corrigée ; ces chiffres supposent que la dernière saisie du jeu date de plus de sept jours) ; aucune occurrence de « Repas de famille », « Après le travail », « Marcher ». |
| 2 | « Partager ce résumé avec l'assistant… » ; lire ; « Annuler ». | « Partager avec l'assistant ce résumé de « Carnet du soir » ? Il partira tel quel à chaque question : », le même résumé, puis « Notes, envies, déclencheurs et appuis restent ici. Arrêter le partage plus tard n'efface pas ce qui aura déjà été envoyé. » ; après « Annuler », toujours « Non partagé ». |
| 3 | Réglages → Assistant → cocher « Carnet du soir » dans « Ce que Claude peut lire ». | La case se décoche aussitôt et la même boîte s'ouvre ; « Confirmer » → « Résumé partagé avec l'assistant. » ; la case reste cochée. |
| 4 | Assistant : envoyer la question ; lire `requete.system`. | Contient « CARNET DU SOIR : suivi personnel autodéclaratif (alcool » ; ne contient ni « Repas de famille », ni « Après le travail », ni « Marcher quelques minutes ». |
| 5 | « Carnet du soir » → « Confidentialité et données » → « Ne plus partager avec l'assistant ». | « Partage arrêté. Ce qui a déjà été envoyé dans une conversation n'en est pas retiré. » ; « Non partagé ». |
| 6 | Assistant : envoyer de nouveau la question. | `requete.system` ne contient plus « CARNET DU SOIR » ; l'échange précédent reste dans la conversation. |

- **État final attendu** : suivi non partagé ; une conversation de deux échanges.
- **Nettoyage** : « Effacer la conversation » dans l'Assistant.

---

<a id="rlm-022"></a>
### RLM-022 — Deux appareils du même compte : le nom seulement

- **Fonctionnalité et règle** : sur un autre appareil du compte, le talon seulement (« gardé sur un autre de tes
  appareils »), sans contenu ; y supprimer le suivi ne retire que le nom, et la confirmation le dit ; si le détenteur
  existe encore, il recrée le talon et ne perd rien.
- **Objectif, risque vérifié** : le contenu lisible depuis un autre appareil (donc passé par le serveur) ; un appareil qui
  efface ce qu'il ne voit pas.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, WIN
- **Préconditions** : chemin P sur l'appareil 1 (détenteur), avec le suivi de [RLM-003](#rlm-003) ; un appareil 2 (autre
  navigateur ou téléphone) connecté au compte P.
- **Données** : `2` cigarettes, contexte `NOTE-RLM022`, notées sur l'appareil 1.
- **Automatisés associés** : `TN-regulation-appareil`, `TU-REG-31`, `TU-REG-26`, `TU-REG-39`
- **Source** : [DOC] [regulation.md](../../regulation.md#confidentialité) (autres appareils) ; [TEST]
  `tests/browser/regulation-appareil.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Appareil 1 : noter les données. Appareil 2 : recharger, ouvrir « Carnet du soir ». | « Ce suivi est gardé sur un autre de tes appareils, et seulement là : son contenu ne passe pas par ton compte. Ouvre-le sur cet appareil-là. Il le garde sur : … » (le navigateur et le système de l'appareil 1, la date de sa configuration) « Si c'est celui-ci et que son stockage a été effacé (données du navigateur ou de l'app), une sauvegarde complète faite ici le restaure. Sinon (appareil perdu, Selene réinstallée), tu peux retirer ce nom dans les réglages. » ; ni `NOTE-RLM022`, ni quantité. |
| 2 | Appareil 2 : accueil ; Réglages → Espaces. | Accueil : « Suivi privé : ouvrir pour consulter ». Réglages : « Ouvrir le suivi », mais pas « Appuis et récompenses ». |
| 3 | Appareil 2 : Réglages → Espaces → « ✕ » sur « Carnet du soir ». | Formulaire « Supprimer « Carnet du soir » » avec « Ici, il n'y a que le nom de ce suivi : son contenu est gardé sur un autre appareil. Si cet appareil existe encore, le suivi y reste entier et son nom reviendra : supprime-le plutôt depuis celui-ci. S'il est perdu, ou si Selene y a été réinstallée, retirer ce nom est définitif. » |
| 4 | Retaper `Carnet du soir`, « Enregistrer ». | « « Carnet du soir » supprimé. » ; il disparaît de la navigation de l'appareil 2. |
| 5 | Appareil 1 : recharger (ou attendre la synchronisation, 30 s). Puis appareil 2 : recharger. | Appareil 1 : le suivi est entier (la saisie `NOTE-RLM022` est là). Appareil 2 : le nom « Carnet du soir » est revenu, toujours en talon. |

- **État final attendu** : le suivi entier sur l'appareil 1 ; son talon partout.
- **Nettoyage** : aucun.

---

<a id="rlm-023"></a>
### RLM-023 — Se déconnecter avec un suivi gardé ici

- **Fonctionnalité et règle** : la déconnexion vide l'appareil ; une garde demande d'abord quoi faire de ce qui n'existe
  qu'ici : télécharger une sauvegarde complète puis l'effacer, ou l'effacer (confirmé : le contenu et le nom du suivi
  quittent l'appareil et le compte) ; annuler ne déconnecte pas ; la sauvegarde complète contient le suivi ; restaurée,
  elle refait de l'appareil le détenteur.
- **Objectif, risque vérifié** : perte silencieuse d'un suivi qui n'existe nulle part ailleurs.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, WIN
- **Préconditions** : chemin P, avec le suivi de [RLM-003](#rlm-003) et au moins une saisie dont le contexte est
  `NOTE-RLM003`.
- **Données** : aucune autre.
- **Automatisés associés** : `TN-regulation-appareil`, `TU-REG-32`, `TU-REG-38`
- **Source** : [DOC] [regulation.md](../../regulation.md#confidentialité) (déconnexion) ; [TEST]
  `tests/browser/regulation-appareil.js`, `TU-REG-38` ; étapes 7 à 9 : anomalie [A7](../perimetre.md#anomalies-et-observations),
  corrigée (décision de la responsable : l'effacement retire aussi le talon).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Compte → « Se déconnecter ». | Formulaire « Avant de te déconnecter » : « « Carnet du soir » : gardé sur cet appareil seulement, nulle part ailleurs. Se déconnecter vide cet appareil. » ; « Que faire de ce qui n'existe que sur cet appareil ? » : « Télécharger une sauvegarde complète, puis l'effacer d'ici » (choisi) ou « L'effacer définitivement » ; aucune option de synchronisation. |
| 2 | « Annuler ». | Toujours connectée ; le suivi est intact. |
| 3 | « Se déconnecter » → « L'effacer définitivement » → « Enregistrer » ; dans la boîte, « Annuler ». | « Effacer définitivement « Carnet du soir » ? Il n'en existe aucune autre copie. » ; après « Annuler », toujours connectée, rien d'effacé. |
| 4 | « Se déconnecter » → « Télécharger une sauvegarde complète, puis l'effacer d'ici » → « Enregistrer ». | Un fichier `selene-AAAA-MM-JJ.json` est téléchargé, puis l'écran d'entrée s'affiche. Le fichier contient `NOTE-RLM003` et le sujet `tabac` du suivi. |
| 5 | Se reconnecter au compte P sur le même appareil ; ouvrir « Carnet du soir ». | Le nom est resté sur le compte (le contenu a été exporté, pas effacé) : « Ce suivi devait être gardé sur cet appareil, mais ses données n'y sont plus (stockage du navigateur ou de l'app effacé ?). Une sauvegarde complète faite ici peut les restaurer ; sinon, tu peux retirer ce suivi. » |
| 6 | Réglages → Compte et données → Sauvegarde → Importer le fichier de l'étape 4 → « Confirmer ». | « Sauvegarde importée. » ; le suivi est entier (la saisie `NOTE-RLM003` est là), « Sur cet appareil seulement. » |
| 7 | « Se déconnecter » → « L'effacer définitivement » → « Enregistrer » → « Confirmer » dans la boîte « Effacer définitivement… ». | L'écran d'entrée s'affiche. |
| 8 | Avant de vous reconnecter, Network : ouvrir la dernière requête `PATCH` vers `app_state` envoyée à l'étape 7, onglet *Payload*. | `site.modules` ne contient plus `reprendre-la-main` (l'identifiant que le modèle a donné à l'espace, inchangé quand on l'a nommé « Carnet du soir ») ; `site.config.modules` non plus ; aucune occurrence de `Carnet du soir` ni de `NOTE-RLM003` dans la charge utile. |
| 9 | Se reconnecter au compte P sur le même appareil. | Aucun « Carnet du soir » dans la navigation, ni dans Réglages → Espaces ; l'écran « ses données n'y sont plus » n'apparaît nulle part : l'effacement voulu n'est pas présenté comme un accident. |

- **État final attendu** : connectée au compte P, **sans** le suivi (effacé, nom compris) ; le fichier de l'étape 4 reste la seule
  copie.
- **Nettoyage** : supprimer le fichier téléchargé de l'ordinateur de recette.

---

<a id="rlm-024"></a>
### RLM-024 — Un suivi encore synchronisé revient sur un appareil

- **Fonctionnalité et règle** : un suivi encore synchronisé (accord daté d'avant le 3 octobre 2026, ou d'avant la
  question) affiche un bandeau ; « Le garder sur cet appareil seulement… » le ramène, et le serveur n'en a plus que le
  talon ; Selene ne choisit pas l'appareil à la place de la personne ; aucun chemin ne fait l'inverse ; sans compte, pas
  de question. Là où aucun compte ne le gardait synchronisé, il reste sur l'appareil sans question, et l'appareil le dit
  (A17) : au versement d'un appareil sans compte dans un compte, et dans l'artefact claude.ai ([PLT-011](plateformes.md#plt-011)).
- **Objectif, risque vérifié** : un suivi de santé qui reste sur le serveur sans que la personne le sache ; un choix
  fait à sa place.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin P sur l'appareil 1 ; un appareil 2 connecté au compte P ; Network filtré sur `app_state`.
- **Données** : `rlm-synchronise-ancien.json`.
- **Automatisés associés** : `TU-REG-28`, `TU-REG-29`, `TU-REG-41`, `TU-ART-06`, `TU-ART-07`
- **Source** : [DOC] [regulation.md](../../regulation.md#hors-de-loffre-publique) ; [TEST] `TU-REG-28`, `TU-REG-29`, `TU-REG-41` ; anomalie A17 : avant le 6 octobre 2026, le versement envoyait le suivi entier au compte.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Appareil 1 : importer le jeu ; ouvrir « Carnet du soir ». | Bandeau « Ce suivi doit revenir sur un appareil » : « Selene ne synchronise plus les suivis de santé. Celui-ci l'est encore : garde-le sur l'appareil de ton choix, et son contenu quittera ton compte. Tant que tu n'as pas choisi, rien ne change. » et « Le garder sur cet appareil seulement… ». |
| 2 | Déplier « Confidentialité et données ». | « Encore synchronisé avec ton compte, selon ton accord du 1er septembre 2026 : sur le serveur de Selene (hébergé par Supabase), lisible par ton seul compte, sans chiffrement de bout en bout… » |
| 3 | Appareil 2 : recharger, ouvrir l'espace ; attendre deux minutes sur les deux appareils. | L'appareil 2 voit le même bandeau et la saisie « 3 cigarettes » « Pause café » ; rien ne change de soi-même. |
| 4 | Appareil 1 : « Le garder sur cet appareil seulement… » ; lire ; « Confirmer ». | « Garder « Carnet du soir » sur cet appareil seulement ? À la prochaine synchronisation, ses données quittent ton compte… Les sauvegardes techniques de l'hébergeur peuvent encore le contenir 30 jours au plus… » ; puis « « Carnet du soir » est gardé sur cet appareil seulement. » ; plus de bandeau ; « Sur cet appareil seulement… » ; aucun bouton pour revenir en arrière. |
| 5 | Network : la `PATCH` suivante vers `app_state`. | L'espace n'y a plus que `"storage":"device"`, `holder`, `"subject":null`, `"entries":[]` ; pas de « Pause café ». |
| 6 | Appareil 2 : recharger. | « Ce suivi est gardé sur un autre de tes appareils… » |
| 7 | Chemin S (sans compte) : importer le même jeu ; ouvrir l'espace. | Aucun bandeau ; « Sur cet appareil : sans compte, rien n'est envoyé au serveur de Selene. » |
| 8 | Chemin S, toujours : « J'ai déjà un compte », se connecter au compte B, qui n'a aucun suivi (le versement : ce qui est sur l'appareil rejoint le compte) ; Network filtré sur `app_state`. | « « Carnet du soir » reste sur cet appareil seulement : Selene ne synchronise plus les suivis de santé, ton compte n'en garde que le nom. » ; la `PATCH` vers `app_state` n'a que le talon de l'espace (`"storage":"device"`, `"entries":[]`), pas de « Pause café » ; « Sur cet appareil seulement… » dans « Confidentialité et données ». |

- **État final attendu** : le suivi gardé sur l'appareil 1, un talon sur le compte P ; un autre sur l'appareil du chemin S, un talon sur le compte B.
- **Nettoyage** : supprimer le suivi depuis l'appareil 1 ([RLM-026](#rlm-026)) si la campagne n'en a plus besoin ; sur l'appareil du chemin S, connecté au compte B, supprimer « Carnet du soir » de même, puis se déconnecter.

---

<a id="rlm-025"></a>
### RLM-025 — Exporter ce suivi ; la sauvegarde complète le contient

- **Fonctionnalité et règle** : « Exporter ce suivi » produit un JSON lisible, non chiffré, au nom neutre
  `selene-suivi-AAAA-MM-JJ.json` (nom, sujet, réglages, versions d'objectif, journal complet avec les notes), pour
  consulter, pas pour restaurer ; la sauvegarde complète contient le suivi en entier.
- **Objectif, risque vérifié** : un export incomplet ; un nom de fichier qui trahit le sujet ; une restauration
  impossible.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-en-cours.json` importé.
- **Données** : aucune.
- **Automatisés associés** : `TU-REG-24`, `TU-REG-34`, `TN-regulation-appareil`
- **Source** : [DOC] [regulation.md](../../regulation.md#confidentialité) (export dédié) ; [CODE] `rlm-export` ; vérifié par
  une sonde Chromium le 4 octobre 2026.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « Confidentialité et données » → « Exporter ce suivi ». | « Exporter ce suivi dans un fichier lisible, non chiffré ? Il contient tout le journal, notes comprises. » |
| 2 | « Confirmer » ; ouvrir le fichier dans un éditeur de texte. | Fichier `selene-suivi-<J>.json` ; `"format": "selene-regulation-v1"`, `"about"` qui dit « Restauration : par la sauvegarde complète de Selene. », `module.label` « Carnet du soir », `config.subject` « alcool », 2 objectifs, 7 entrées, dont la note « Repas de famille ». |
| 3 | Réglages → Compte et données → Sauvegarde → « Exporter » ; ouvrir le fichier. | `selene-<J>.json` ; `site.modules["carnet-du-soir"]` porte 7 entrées et « Repas de famille ». |
| 4 | Importer le fichier de l'étape 2. | Refusé : « Ce fichier n'est pas une sauvegarde Selene. Rien n'a été importé. » ; aucune boîte « Remplacer tout l'état… » ; rien ne change. |
| 5 | Importer le fichier de l'étape 3. | « Sauvegarde importée. » ; le suivi est identique. |

- **État final attendu** : inchangé ; deux fichiers téléchargés.
- **Nettoyage** : supprimer les deux fichiers de l'ordinateur de recette.

---

<a id="rlm-026"></a>
### RLM-026 — Supprimer le suivi

- **Fonctionnalité et règle** : supprimer le suivi (retaper son nom) depuis l'appareil détenteur efface sa copie locale,
  puis, à la synchronisation suivante, son talon du compte et des autres appareils ; un nom mal retapé ne supprime
  rien ; les fichiers déjà téléchargés restent où ils sont.
- **Objectif, risque vérifié** : une copie locale orpheline ; un talon qui survit.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : chemin P, appareil 1 détenteur du suivi « Carnet du soir » ; appareil 2 connecté au compte P.
- **Données** : `carnet`, puis `Carnet du soir`.
- **Automatisés associés** : `TU-REG-31`, `TN-regulation-appareil`
- **Source** : [DOC] [regulation.md](../../regulation.md#confidentialité) (supprimer) ; [CODE] `CLICK["mod-del"]`, `onDelete`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Appareil 1 : « Confidentialité et données » → « Supprimer ce suivi… ». | Formulaire « Supprimer « Carnet du soir » », « Retape « Carnet du soir » pour confirmer la suppression définitive de ses données, sur tous tes appareils. » ; pas d'avertissement « il n'y a que le nom ». |
| 2 | Taper `carnet`, « Enregistrer ». | « Nom incorrect, rien n'a été supprimé. » ; le suivi est intact. |
| 3 | Recommencer avec `Carnet du soir`. | « « Carnet du soir » supprimé. » ; il quitte la navigation et Réglages → Assistant. Outils de développement → IndexedDB → `selene` → `kv` → `selene-local-v1` : plus d'entrée `reprendre-la-main` (l'identifiant de l'espace créé depuis le modèle). |
| 4 | Appareil 2 : recharger. | « Carnet du soir » a disparu. |

- **État final attendu** : plus aucun suivi « Carnet du soir » sur le compte P.
- **Nettoyage** : aucun.

---

<a id="rlm-027"></a>
### RLM-027 — Changement de compte sur le même appareil

- **Fonctionnalité et règle** : quand un autre compte se connecte sur l'appareil sans déconnexion préalable (session
  perdue), les suivis locaux du compte précédent sont mis de côté, jamais montrés au suivant, et retrouvés à son retour.
- **Objectif, risque vérifié** : le suivi d'une personne montré à une autre qui se connecte sur le même appareil.
- **Priorité** : P1 · **Plateformes** : Web
- **Préconditions** : chemin P, avec un suivi configuré gardé sur cet appareil et une saisie de contexte `NOTE-RLM027` ;
  le compte de recette A disponible.
- **Données** : aucune autre.
- **Automatisés associés** : `TU-REG-33`, `TU-REG-42`, `TN-regulation-perdu`
- **Source** : [TEST] `TU-REG-33` ; [CODE] `localSwitch`, `authConnectStores` (`src/app/services/auth.js`). Le chemin
  de reproduction (session supprimée à la main) est déduit du code.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Outils de développement → Application → Local Storage → supprimer `selene-auth-session` ; recharger. | L'app n'est plus connectée (écran d'entrée ou formulaire de connexion). |
| 2 | Se connecter au compte A. | Les espaces de A ; aucun suivi du compte P dans la navigation, aucune occurrence de `NOTE-RLM027` (recherche). IndexedDB → `selene` → `kv` : une entrée `selene-local-v1:<identifiant de P>` existe. |
| 3 | Se déconnecter de A (aucune garde : rien n'est gardé ici pour A). | Écran d'entrée. |
| 4 | Se connecter au compte P ; ouvrir le suivi. | Le suivi est entier, la saisie `NOTE-RLM027` est là ; l'entrée `selene-local-v1:<identifiant de P>` a disparu. |

- **État final attendu** : P connecté, son suivi retrouvé.
- **Nettoyage** : aucun.

---

<a id="rlm-028"></a>
### RLM-028 — Affichage, clavier, libellés, anglais

- **Fonctionnalité et règle** : l'espace tient sur téléphone et sur ordinateur sans défilement horizontal ; les quatre
  actions ont une cible d'au moins 44 px ; tout se fait au clavier ; chaque champ a son libellé ; l'écran est traduit en
  anglais. Le résumé destiné à l'assistant reste en français (sa consigne l'est, [i18n.md](../../i18n.md)).
- **Objectif, risque vérifié** : un formulaire inutilisable au clavier ou au lecteur d'écran ; un texte resté en français.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : chemin S, `rlm-en-cours.json` importé.
- **Données** : aucune.
- **Automatisés associés** : `TN-regulation`
- **Source** : [TEST] `tests/browser/regulation.js` (téléphone, ordinateur, clavier, anglais ; la phrase de l'étape 5
  depuis le 6 octobre 2026, décision de la responsable : le résumé reste en français, puisque c'est le texte envoyé, et
  l'interface le dit).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Téléphone (ou émulation 390 × 844) : ouvrir l'espace, faire défiler. | Aucun défilement horizontal ; les quatre boutons d'action sont faciles à toucher (44 px de haut au moins). |
| 2 | Ordinateur (1 280 px) : même lecture. | Aucun défilement horizontal ; le tableau des sept jours est lisible. |
| 3 | Clavier seul : Tab jusqu'à « J'ai une envie », Entrée ; parcourir les champs au Tab ; Échap. | Le formulaire s'ouvre avec le focus à l'intérieur ; chaque champ annonce son libellé (lecteur d'écran ou info-bulle d'accessibilité) ; Échap le ferme sans rien enregistrer. |
| 4 | Réglages → Langue → English ; ouvrir l'espace. | « My last seven days », « I have a craving », « Privacy and data », « standard drink » ; ni « Mes sept derniers jours », ni « J'ai une envie », ni « Confidentialité et données ». |
| 5 | Déplier « Privacy and data ». | Les textes sont en anglais, sauf le résumé destiné à l'assistant : « CARNET DU SOIR : suivi personnel autodéclaratif (alcool… » reste en français, suivi de « Sent word for word, in French: the assistant's instructions are written in French. » |

- **État final attendu** : interface en anglais.
- **Nettoyage** : Réglages → Language → Français.

---

<a id="rlm-029"></a>
### RLM-029 — Appareil détenteur dont le stockage a été effacé

- **Fonctionnalité et règle** : sur l'appareil détenteur dont le stockage a perdu le suivi (identité de l'appareil
  conservée), l'espace l'avoue et propose la restauration par une sauvegarde complète ou le retrait du nom ; si
  l'identité de l'appareil a aussi disparu, l'appareil se croit un autre, mais le talon décrit l'appareil détenteur
  (navigateur ou app, système, date) et le message envisage que ce soit celui-ci, vidé (décision du 6 octobre 2026).
- **Objectif, risque vérifié** : un espace vide sans explication ; un nom impossible à retirer.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : chemin P, avec un suivi configuré et une saisie de contexte `NOTE-RLM029` ; une sauvegarde complète
  téléchargée juste avant (Réglages → Compte et données → Sauvegarde → Exporter).
- **Données** : aucune autre.
- **Automatisés associés** : `TN-regulation-perdu` (étapes 1 à 3, et l'étape 4 sous Chromium), `TU-REG-39` (étape 4)
- **Source** : [CODE] `elsewhereHTML`, `holderText` (`modules/regulation.js`), `describeDevice` (`state/local.js`) ; [TEST]
  `tests/browser/regulation-perdu.js` (étapes 1 à 3, depuis le 5 octobre 2026), `TU-REG-39` (étape 4, depuis le 6).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Outils de développement → Application → IndexedDB → `selene` → `kv` : supprimer **seulement** `selene-local-v1` ; recharger ; ouvrir le suivi. | « Ce suivi devait être gardé sur cet appareil, mais ses données n'y sont plus (stockage du navigateur ou de l'app effacé ?). Une sauvegarde complète faite ici peut les restaurer ; sinon, tu peux retirer ce suivi. » |
| 2 | Importer la sauvegarde complète. | « Sauvegarde importée. » ; le suivi est entier (`NOTE-RLM029`). |
| 3 | Refaire l'étape 1 ; Réglages → Espaces → « ✕ » ; retaper le nom. | Pas d'avertissement « il n'y a que le nom » ; « « … » supprimé. » |
| 4 | Recréer et configurer un suivi ; puis outils de développement → Application → Storage → « Clear site data » ; se reconnecter au compte P ; ouvrir le suivi. | « Ce suivi est gardé sur un autre de tes appareils… », puis « Il le garde sur : Chrome · Windows, depuis le … » (le navigateur et le système de ce poste, la date du jour), puis « Si c'est celui-ci et que son stockage a été effacé (données du navigateur ou de l'app), une sauvegarde complète faite ici le restaure. Sinon (appareil perdu, Selene réinstallée), tu peux retirer ce nom dans les réglages. » |

- **État final attendu** : un talon d'un suivi devenu illisible.
- **Nettoyage** : retirer ce talon (« ✕ », retaper le nom) ; supprimer la sauvegarde téléchargée.

---

<a id="rlm-030"></a>
### RLM-030 — Versions des stores : l'espace n'existe pas, un suivi créé ailleurs reste intact

- **Fonctionnalité et règle** : l'AAB de Google Play et l'app iOS sont construits sans le type (`SELENE_EDITION=stores`,
  ADR 32) : ni proposé, compte personnel compris, ni montré, ni partagé avec l'assistant ; un suivi créé dans l'édition
  complète y est gardé tel quel, une ligne grisée des Réglages le dit, et l'édition complète le retrouve entier ; la
  suppression dit ce qui part. Une copie gardée sur l'appareil par une version précédente reste protégée à la
  déconnexion (règle de [RLM-023](#rlm-023)).
- **Objectif, risque vérifié** : une fonction de santé cachée dans l'app envoyée aux stores (refus par la règle 2.3.1
  d'Apple, déclarations fausses chez Google) ; un suivi abîmé ou effacé par la version qui ne sait pas l'ouvrir.
- **Priorité** : P1 · **Plateformes** : AND, IOS
- **Préconditions** : chemin P sur le web, avec le suivi de [RLM-003](#rlm-003) (gardé sur cet ordinateur) et au moins
  une saisie dont le contexte est `NOTE-RLM003` ; l'édition des stores installée sur un téléphone : l'AAB par la piste
  de test interne de Google Play, ou l'app iOS par TestFlight (tous deux envoyés par le workflow *Publication*). À
  défaut de compte de store : `SELENE_EDITION=stores npm run build:dist && npx cap sync android`, puis lancer depuis
  Android Studio (un `npm run build:dist` sans la variable, puis `npx cap sync android`, rend ensuite l'édition
  complète).
- **Données** : aucune autre.
- **Automatisés associés** : `TU-EDI-01`, `TU-EDI-03`, `TU-EDI-04`, `TU-EDI-05`, `TU-EDI-06`
- **Source** : [DOC] [regulation.md](../../regulation.md#absent-des-versions-des-stores) ; [TEST] `tests/edition.test.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur le téléphone, se connecter au compte P ; Réglages → Espaces → « + Créer un espace ». | Treize modèles, le dernier « Carnet » ; « Reprendre la main » absent de la grille et des deux groupes de « Modèle ou type », bien que le compte soit personnel. |
| 2 | Regarder la navigation, puis l'accueil (« Où en sont les choses »). | « Carnet du soir » n'apparaît nulle part. |
| 3 | Réglages → Espaces : la ligne « Carnet du soir ». | Case d'activation grisée et décochée ; dessous : « Ce suivi a été créé avec une autre version de Selene. Celle-ci ne l'ouvre pas : il est gardé tel quel, sans être lu ni modifié, et reste entier dans la version où il a été créé. » ; pas de « régler ». |
| 4 | Réglages → Assistant → « Ce que Claude peut lire ». | « Carnet du soir » absent. |
| 5 | Réglages → Espaces : sur la ligne « Carnet du soir », « ✕ ». | « Supprimer « Carnet du soir » » : « Ici, il n'y a que le nom de ce suivi : son contenu est gardé sur un autre appareil. Si cet appareil existe encore, le suivi y reste entier et son nom reviendra… » ; « Annuler ». |
| 6 | Sur le téléphone, changer quelque chose d'autre (Réglages → Apparence et rythme → une autre palette) ; puis, sur l'ordinateur, recharger le web et ouvrir « Carnet du soir ». | La palette choisie sur le téléphone est arrivée ; le suivi s'ouvre entier, avec la saisie `NOTE-RLM003`, dans la navigation comme avant. |

- **État final attendu** : compte P inchangé, à la palette près ; le suivi entier sur l'ordinateur.
- **Nettoyage** : remettre la palette d'origine.
