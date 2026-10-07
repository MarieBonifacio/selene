# Espaces

Un espace (un « module » dans le code et la documentation technique) est une page de la navigation, d'un type donné.
Créer, nommer, ranger, désactiver, supprimer, régler ; la boîte de réception. Vaut pour toutes les cibles, artefact compris.

**Préconditions communes** : sauf mention, le jeu [`donnees/jeu-essai.json`](../donnees/jeu-essai.json) importé, en mode
sans compte. Réglages → chapitre « Espaces » : une ligne par espace (case « Activer », nom, domaine, ↑ ↓, ✕, « régler »),
puis « + Créer un espace ».

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [ESP-001](#esp-001) | Compte neuf : « Composer ton espace », chemin « Un long texte » | P1 | Web, Mob, AND, IOS, WIN, ART |
| [ESP-002](#esp-002) | « Choisir moi-même » parmi les modèles ; « C'est bon » ne revient pas | P2 | Web, Mob |
| [ESP-003](#esp-003) | Créer un espace depuis les Réglages : modèle ou type vide | P1 | Web, Mob, ART |
| [ESP-004](#esp-004) | Modèle « Protocole » : rien n'est créé sans pratique choisie ; bornes validées | P2 | Web, Mob |
| [ESP-005](#esp-005) | Renommer, ranger par domaine, ordonner, choisir un sigil | P2 | Web, Mob |
| [ESP-006](#esp-006) | Désactiver puis réactiver un espace : données intactes | P2 | Web, Mob |
| [ESP-007](#esp-007) | Supprimer un espace : nom retapé, rien de plus, pas de retour | P1 | Web, Mob, AND, IOS, WIN, ART |
| [ESP-008](#esp-008) | « régler » ouvre les réglages de l'espace sur place | P3 | Web, Mob |
| [ESP-009](#esp-009) | Boîte de réception : une seule, désignation déplacée, absence expliquée | P2 | Web, Mob |
| [ESP-010](#esp-010) | Partage avec l'assistant d'un nouvel espace | P1 | Web, ART |
| [ESP-011](#esp-011) | Une saisie en cours dans les Réglages survit à un rendu | P2 | Web |

Identifiants retirés : aucun.

---

<a id="esp-001"></a>
### ESP-001 — Compte neuf : « Composer ton espace », chemin « Un long texte »

- **Fonctionnalité et règle** : un compte neuf part presque vide (une boîte de réception) ; l'accueil pose « Sur quoi
  travailles-tu ? » à trois réponses ; chacune installe trois modèles et referme le bloc.
- **Objectif, risque vérifié** : premier contact confus ; données fictives ou personnelles dans un compte neuf.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN, ART
- **Préconditions** : données du site effacées ; « Commencer sans compte » (ou compte neuf).
- **Données** : aucune.
- **Automatisés associés** : `TN-compte-neuf`, `TU-MOD-23`, `TU-MOD-61`
- **Source** : [DOC] README, « Modules » ; [DOC] [architecture.md](../../architecture.md#données-de-départ) ; [TEST] `tests/browser/compte-neuf.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'accueil. | Bloc « Composer ton espace », « Sur quoi travailles-tu ? », trois réponses : « Un long texte », « Mes journées », « Ce que je lis, écoute, regarde », chacune avec les trois espaces qu'elle installe ; aucune tâche ni note fictive. |
| 2 | Vérifier la navigation. | Seule la boîte de réception (« Capture ») ; aucun nom personnel (ni « Kundalini », ni « Phidippus », ni « october.moth »). |
| 3 | Cliquer « Un long texte ». | Message « Pour commencer : Écriture, Sources, Tâches. Tout se renomme ou se retire dans Réglages. » ; le bloc disparaît ; les trois espaces sont dans la navigation. |
| 4 | Ouvrir Écriture, Sources, Tâches. | Chacun est vide (aucune entrée). |
| 5 | Recharger. | Le bloc « Composer ton espace » ne revient pas. |

- **État final attendu** : boîte + Écriture, Sources, Tâches, vides.
- **Nettoyage** : effacer les données du site.

---

<a id="esp-002"></a>
### ESP-002 — « Choisir moi-même » parmi les modèles ; « C'est bon » ne revient pas

- **Fonctionnalité et règle** : la liste entière des modèles derrière « Choisir moi-même », à ajouter autant de fois qu'on
  veut ; « C'est bon » referme le bloc pour de bon ; un compte existant ne le voit jamais.
- **Objectif, risque vérifié** : un modèle impossible à ajouter ; le bloc qui revient ; « Reprendre la main » proposé à tous.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : données effacées ; « Commencer sans compte ».
- **Données** : aucune.
- **Automatisés associés** : `TN-compte-neuf`, `TU-MOD-23`, `TU-MOD-24`
- **Source** : [DOC] README, « Modules » ; [TEST] `tests/browser/compte-neuf.js`, `TU-MOD-23`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Déplier « Choisir moi-même, parmi tous les modèles ». | Treize modèles avec leur description (Tâches, Protocole, Écriture, Budget, Tableau de production, À découvrir, Décisions, Motifs, Musique, Sources, Arc, Soins, Carnet) ; pas « Reprendre la main ». |
| 2 | « Ajouter » sur « Carnet », puis encore sur « Carnet ». | Deux espaces « Carnet » dans la navigation ; la liste reste dépliée. |
| 3 | « C'est bon ». | Le bloc disparaît. |
| 4 | Recharger. | Le bloc ne revient pas. |
| 5 | Importer le jeu d'essai (un compte existant). | Aucun bloc « Composer ton espace ». |

- **État final attendu** : jeu d'essai.
- **Nettoyage** : aucun.

---

<a id="esp-003"></a>
### ESP-003 — Créer un espace depuis les Réglages : modèle ou type vide

- **Fonctionnalité et règle** : Réglages → Espaces → « + Créer un espace » : les modèles avec leur description et un bouton
  « Créer » ; « Sur mesure » : un modèle sous un autre nom, ou un type vide ; sans nom, le nom du modèle.
- **Objectif, risque vérifié** : espace créé au mauvais type ; nom vide accepté.
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai.
- **Données** : type vide « Collection » nommé `Lectures ESP-003` ; modèle « Tableau de production » sans nom.
- **Automatisés associés** : `TN-compte-neuf`, `TN-types`, `TU-MOD-03`, `TU-MOD-25`, `TN-reglages`
- **Source** : [DOC] [evolution-ui.md](../../evolution-ui.md#réglages-en-chapitres) ; [TEST] `tests/browser/types.js`, `TU-MOD-03`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Déplier « + Créer un espace ». | « D'un modèle » : une grille de modèles avec description et « Créer » ; « Sur mesure » : « Modèle ou type » (groupes « Modèles » et « Types vides ») et « Nom » (« Nom du modèle si vide »). |
| 2 | « Créer » sur « Tableau de production ». | Message « Module « Tableau de production » créé. » ; l'espace apparaît, en colonnes Idée, En cours, Prêt, Publié. |
| 3 | « Sur mesure » : type vide « Collection », nom `Lectures ESP-003`, « Créer ». | L'espace `Lectures ESP-003` apparaît, en liste, statuts « À faire », « En cours », « Fait ». |
| 4 | « Sur mesure » : un type vide, nom vide, « Créer ». | « Donne un nom au module. » ; rien n'est créé. |
| 5 | Exporter une sauvegarde (DON-001) puis la réimporter. | Import accepté : les espaces créés passent la validation. |

- **État final attendu** : deux espaces de plus.
- **Nettoyage** : les supprimer (ESP-007).

---

<a id="esp-004"></a>
### ESP-004 — Modèle « Protocole » : rien n'est créé sans pratique choisie ; bornes validées

- **Fonctionnalité et règle** : le modèle Protocole demande le nom de la pratique, l'unité, la durée (1 à 520 semaines) et
  les séances par semaine (1 à 7) ; ouvrir ou annuler ne crée rien.
- **Objectif, risque vérifié** : protocole fantôme créé par un formulaire abandonné ; valeur hors bornes qui rendrait la
  sauvegarde inimportable.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : données effacées, mode sans compte.
- **Données** : `Natation`, unité `longueurs`, 8 semaines, puis 9 séances, puis 2 séances.
- **Automatisés associés** : `TU-MOD-62`, `TN-compte-neuf`
- **Source** : [TEST] `TU-MOD-62`, `tests/browser/compte-neuf.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Accueil → « Choisir moi-même » → « Ajouter » sur Protocole. | Formulaire « Choisir ton sport ou ta pratique » : « Nom du sport ou de la pratique », « Unité suivie (min, km, longueurs…) », « Durée en semaines (1 à 520…) », « Séances par semaine (1 à 7…) ». |
| 2 | « Annuler ». | Aucun espace créé. |
| 3 | Rouvrir ; saisir les données avec 9 séances ; « Enregistrer ». | Refus : « Indique un nom, une unité, 1 à 520 semaines et 1 à 7 séances par semaine. » (ou le champ en erreur) ; rien de créé. |
| 4 | Corriger à 2 séances ; « Enregistrer ». | Espace « Natation » créé : 8 semaines, 2 séances par semaine, unité « longueurs », pas encore commencé. |

- **État final attendu** : un espace Natation vide.
- **Nettoyage** : effacer les données du site.

---

<a id="esp-005"></a>
### ESP-005 — Renommer, ranger par domaine, ordonner, choisir un sigil

- **Fonctionnalité et règle** : le nom se renomme sur place ; un « Domaine » regroupe la navigation et l'accueil, avec sa
  teinte ; ↑ ↓ ordonnent ; le sigil se choisit dans « régler » ; la planche est numérotée selon l'ordre.
- **Objectif, risque vérifié** : renommage perdu ; navigation qui ne suit pas l'ordre.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : nouveau nom `Appartement` pour Chantier ; domaine `Jardin` pour Plantes.
- **Automatisés associés** : `TN-identite`, `TN-navigation`
- **Source** : [DOC] README, « Réglages », « Identité des espaces » ; [TEST] `tests/browser/identite.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Renommer « Chantier » en `Appartement`, quitter le champ. | La navigation, l'accueil et l'en-tête de l'espace disent « Appartement ». |
| 2 | Domaine de « Plantes » : `Jardin`. | Un titre « Jardin » apparaît dans la navigation et sur l'accueil, avec Plantes dessous, d'une autre teinte que « Maison ». |
| 3 | Monter « Musique » de deux crans avec ↑. | L'ordre de la navigation suit ; le numéro de planche (« Pl. … ») de Musique change en tête de son espace. |
| 4 | « régler » sous Écriture → choisir un autre sigil. | Le sigil change dans la navigation et en tête de l'espace. |
| 5 | Vider le nom d'un espace et quitter le champ. | L'ancien nom est gardé. |

- **État final attendu** : renommages et ordre conservés après rechargement.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="esp-006"></a>
### ESP-006 — Désactiver puis réactiver un espace : données intactes

- **Fonctionnalité et règle** : décocher « Activer » retire l'espace de la navigation et de l'accueil, sans toucher à ses
  données ; un espace désactivé n'apporte rien aux sortes ; son adresse mène à l'accueil, et le dit (décision du
  6 octobre 2026).
- **Objectif, risque vérifié** : la désactivation efface ou cache définitivement des données.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : espace « Carnet » (une note : « Le héron revient chaque matin à la même pierre. »).
- **Automatisés associés** : `TU-MOD-58`, `TU-MOD-63`
- **Source** : [CODE] `mod-on` (`shell/actions.js`), `renderNow` (`shell/render.js`) ; [TEST] `TU-MOD-58` (un module
  désactivé ne contribue pas aux sortes), `TU-MOD-63` (l'adresse d'un espace désactivé).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Décocher « Activer Carnet ». | Carnet disparaît de la navigation et de « Où en sont les choses » ; sa ligne reste dans les Réglages, grisée, son nom toujours modifiable. |
| 2 | Ouvrir l'adresse `#carnet`. | L'accueil s'affiche, avec « « Carnet » est désactivé : Réglages → Espaces pour le rouvrir. » ; recharger la page ne le répète pas deux fois. |
| 3 | Recocher « Activer Carnet ». | Carnet revient avec sa note. |

- **État final attendu** : Carnet actif, note intacte.
- **Nettoyage** : aucun.

---

<a id="esp-007"></a>
### ESP-007 — Supprimer un espace : nom retapé, rien de plus, pas de retour

- **Fonctionnalité et règle** : ✕, puis retaper le nom : les données partent, sur tous les appareils ; un mauvais nom ne
  supprime rien ; un espace supprimé n'est jamais recréé.
- **Objectif, risque vérifié** : suppression accidentelle ; espace qui ressuscite au chargement ou par la synchronisation.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN, ART
- **Préconditions** : jeu d'essai ; pour l'étape 5, connecté sur deux appareils (sinon la sauter).
- **Données** : espace « Musique ».
- **Automatisés associés** : `TU-MOD-02`, `TU-SYN-05`, `TU-SYN-22`, `TN-types`, `TN-reglages`
- **Source** : [DOC] README, « Modules » ; [TEST] `TU-MOD-02`, `TU-SYN-05`, `TU-SYN-22` (pierre tombale).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | ✕ sur la ligne « Musique ». | Formulaire « Supprimer « Musique » » : « Retape « Musique » pour confirmer la suppression définitive de ses données. » |
| 2 | Taper `musique` (minuscule), valider. | « Nom incorrect, rien n'a été supprimé. » ; Musique est toujours là. |
| 3 | Recommencer en tapant `Musique`. | « « Musique » supprimé. » ; l'espace disparaît de la navigation et des Réglages. |
| 4 | Recharger. | Musique ne revient pas. |
| 5 | Sur le second appareil, attendre 30 s ou revenir sur l'onglet. | Musique disparaît aussi ; il ne revient pas. |

- **État final attendu** : Musique supprimé partout.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="esp-008"></a>
### ESP-008 — « régler » ouvre les réglages de l'espace sur place

- **Fonctionnalité et règle** : « régler », en tête d'un espace, ouvre ses réglages dans un tiroir sans quitter l'espace ;
  un changement s'applique aussitôt.
- **Objectif, risque vérifié** : réglage sans effet visible ; perte de l'écran en cours.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : espace « Tableau » ; champ « Sous-titre » à renommer en `Lieu`.
- **Automatisés associés** : `TN-identite`
- **Source** : [DOC] README, « Identité des espaces » ; [TEST] `tests/browser/identite.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir « Tableau », cliquer « régler » en tête. | Un tiroir s'ouvre (pleine largeur, du bas, sur téléphone) avec les réglages de Tableau ; l'espace reste dessous. |
| 2 | Donner un nom au champ « Sous-titre » (`Lieu`), quitter le champ. | Le formulaire d'ajout d'un élément propose désormais « Lieu ». |
| 3 | Fermer le tiroir. | Toujours dans Tableau. |

- **État final attendu** : champ « Lieu » activé.
- **Nettoyage** : vider ce nom.

---

<a id="esp-009"></a>
### ESP-009 — Boîte de réception : une seule, désignation déplacée, absence expliquée

- **Fonctionnalité et règle** : un module Notes marqué « Boîte de réception » reçoit la capture rapide ; une seule à la fois ;
  sans boîte, l'accueil l'explique et l'outil « capturer » de l'assistant disparaît.
- **Objectif, risque vérifié** : capture perdue dans le vide ; deux boîtes.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (boîte « Boîte », Notes « Carnet »).
- **Données** : capture `vers le Carnet ESP-009`.
- **Automatisés associés** : `TN-notes`, `TU-MOD-18`, `TU-MOD-20`
- **Source** : [DOC] [architecture.md](../../architecture.md#modules) ; [TEST] `tests/browser/notes.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → « régler » sous Carnet → cocher « Boîte de réception : reçoit la capture rapide de l'accueil ». | La case de « Boîte » se décoche d'elle-même. |
| 2 | Capturer depuis l'accueil le texte des données. | La note arrive dans Carnet, pas dans Boîte. |
| 3 | Décocher la case de Carnet. | Sur l'accueil, à la place du champ : « Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans Réglages. » |
| 4 | Recocher la case de Boîte. | Le champ de capture revient. |

- **État final attendu** : Boîte désignée.
- **Nettoyage** : supprimer la note du Carnet.

---

<a id="esp-010"></a>
### ESP-010 — Partage avec l'assistant d'un nouvel espace

- **Fonctionnalité et règle** : un nouvel espace est partagé par défaut avec l'assistant, sauf « Reprendre la main » ;
  décocher dans Réglages → Assistant le garde privé.
- **Objectif, risque vérifié** : un espace privé envoyé à l'assistant sans que la personne le sache.
- **Priorité** : P1 · **Plateformes** : Web, ART
- **Préconditions** : assistant activé (Réglages → Espaces → cocher « Assistant ») ; connectée (version hébergée) ou artefact.
- **Données** : nouvel espace Carnet `Journal privé ESP-010` avec la note `mot-témoin-ESP010`.
- **Automatisés associés** : `TU-MOD-23`, `TU-MOD-09`, `TN-assistant`
- **Source** : [DOC] README, « Modules » ; [DOC] [reglages-aide.js](../../../src/app/views/reglages-aide.js) (« Un nouvel espace est coché d'office ») ; [TEST] `TU-MOD-23`, `TU-MOD-09`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Créer l'espace des données, y écrire la note. | `Journal privé ESP-010` est dans la navigation ; la note `mot-témoin-ESP010` s'affiche dans l'espace. |
| 2 | Réglages → Assistant → « Ce que Claude peut lire ». | `Journal privé ESP-010` est coché. |
| 3 | Le décocher. | Décoché ; l'en-tête de l'assistant n'en parle plus dans « Données partagées ». |
| 4 | Demander à l'assistant « Cite le mot-témoin de mon journal privé. » | La réponse ne contient pas `mot-témoin-ESP010` (l'assistant ne l'a pas reçu). |

- **État final attendu** : espace privé.
- **Nettoyage** : supprimer l'espace.

---

<a id="esp-011"></a>
### ESP-011 — Une saisie en cours dans les Réglages survit à un rendu

- **Fonctionnalité et règle** : un rendu (une synchronisation qui arrive) ne remplace pas un champ de réglage en cours de
  frappe ; la valeur part en quittant le champ.
- **Objectif, risque vérifié** : saisie effacée sous les doigts.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : connecté au compte A sur deux navigateurs.
- **Données** : nom affiché `Atelier ESP-011`.
- **Automatisés associés** : `TN-saisie`, `TU-MOD-11`
- **Source** : [TEST] `tests/browser/saisie.js`, `TU-MOD-11`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Navigateur 1 : Réglages → « Nom affiché », commencer à taper `Atelier` sans quitter le champ. | Le champ contient `Atelier`, le curseur au bout ; l'en-tête garde l'ancien nom tant que le champ n'est pas quitté. |
| 2 | Navigateur 2 : capturer une note (le navigateur 1 recevra une synchronisation dans les 30 s). | La note est dans la boîte du navigateur 2 ; l'indicateur d'enregistrement s'y efface (partie au serveur). |
| 3 | Navigateur 1 : attendre 40 s sans toucher, puis finir de taper ` ESP-011` et quitter le champ. | Le champ contient bien `Atelier ESP-011` ; rien n'a été effacé ; l'en-tête dit « Atelier ESP-011 ». |

- **État final attendu** : nom affiché modifié.
- **Nettoyage** : remettre « Selene » ; supprimer la note.
