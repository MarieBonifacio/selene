# Navigation, recherche et réglages

Se déplacer, retrouver, régler. Vaut pour toutes les cibles, artefact compris, sauf mention.

**Préconditions communes** : sauf mention, le jeu [`donnees/jeu-essai.json`](../donnees/jeu-essai.json) importé
(Réglages → Compte et données → Sauvegarde → Importer, puis confirmer), de préférence en mode sans compte. Il contient
treize espaces, dont deux domaines (« Maison », « Création »), des fragments qui parlent de « lisière » et de « brume ».
« Téléphone » : un vrai téléphone ou l'émulation des outils de développement à 390 × 844 px, tactile.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [NAV-001](#nav-001) | Téléphone : barre basse, feuille Espaces, voile qui ferme | P1 | Mob, AND, IOS |
| [NAV-002](#nav-002) | Ordinateur : barre latérale, onglet actif annoncé | P2 | Web, WIN, ART |
| [NAV-003](#nav-003) | Palette de commandes (⌘K ou Ctrl+K) | P2 | Web, WIN, ART |
| [NAV-004](#nav-004) | Chercher : sans accents ni casse, tous les mots, surlignage, touche « / » | P1 | Web, Mob, AND, IOS, WIN, ART |
| [NAV-005](#nav-005) | Chercher : facettes d'espace, de période et de statut | P2 | Web, Mob |
| [NAV-006](#nav-006) | « ouvrir » un résultat mène à l'entrée, même lointaine ; retour à la recherche | P2 | Web, Mob |
| [NAV-007](#nav-007) | Réglages : six chapitres, sommaire, chaque espace une seule fois | P2 | Web, Mob |
| [NAV-008](#nav-008) | Infobulles « ? » des Réglages | P3 | Web, Mob |
| [NAV-009](#nav-009) | Langue de l'interface : appareil, choix du compte, bascule sans recharger | P2 | Web, Mob, AND, IOS |
| [NAV-010](#nav-010) | Apparence : palette, mode, « Suivre le soleil », nom affiché | P3 | Web, Mob |
| [NAV-011](#nav-011) | « Ouvrir sur » et le bloc « Reprendre » de l'accueil | P3 | Web, Mob |
| [NAV-012](#nav-012) | Routes inconnues, piégées ou masquées | P2 | Web |
| [NAV-013](#nav-013) | Chaque vue retrouve sa position de défilement | P3 | Web, Mob |

Identifiants retirés : aucun.

---

<a id="nav-001"></a>
### NAV-001 — Téléphone : barre basse, feuille Espaces, voile qui ferme

- **Fonctionnalité et règle** : sur téléphone, une barre en bas à cinq destinations fixes (Aujourd'hui, Espaces, ⊕ Capturer,
  Chercher, Bilan) ; « Espaces » ouvre une feuille ; ⊕ toujours au centre.
- **Objectif, risque vérifié** : un espace inatteignable sur téléphone ; une feuille qui ne se ferme pas.
- **Priorité** : P1 · **Plateformes** : Mob, AND, IOS
- **Préconditions** : jeu d'essai importé ; téléphone en portrait.
- **Données** : capture `Recette NAV-001`.
- **Automatisés associés** : `TN-navigation`, `TN-interface`
- **Source** : [DOC] README, « Navigation » ; [DOC] [evolution-ui.md](../../evolution-ui.md#architecture-de-navigation) ; [TEST] `tests/browser/navigation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'accueil. | Une barre en bas : « Aujourd'hui », « Espaces », « ⊕ » (Capturer), « Chercher », « Bilan » ; aucune barre latérale ; « Aujourd'hui » est marqué actif. |
| 2 | Toucher « Espaces ». | Une feuille monte : espaces récents, domaines « Maison » et « Création » avec leurs espaces, Réglages en pied ; « Aujourd'hui » reste marqué actif dans la barre (on est toujours sur l'accueil). |
| 3 | Toucher « Écriture » dans la feuille. | L'espace Écriture s'affiche ; la feuille est fermée ; « Espaces » est marqué actif dans la barre. |
| 4 | Rouvrir « Espaces », puis toucher la zone sombre au-dessus de la feuille (le voile). | La feuille se ferme sans changer d'écran. |
| 5 | Toucher « ⊕ », saisir les données, « Garder ». | « Gardé. Tu peux oublier, c'est écrit. » ; la feuille se ferme ; la capture est dans la boîte. |
| 6 | Tourner le téléphone en paysage (apps natives seulement), puis revenir en portrait. | La barre reste en bas, rien ne déborde. |

- **État final attendu** : une capture de plus dans la boîte.
- **Nettoyage** : supprimer la capture.

---

<a id="nav-002"></a>
### NAV-002 — Ordinateur : barre latérale, onglet actif annoncé

- **Fonctionnalité et règle** : sur ordinateur, une barre latérale collante (lentilles, domaines, système) ; l'onglet actif
  porte `aria-current`.
- **Objectif, risque vérifié** : navigation perdue au défilement ; lecteur d'écran qui ne sait pas où l'on est.
- **Priorité** : P2 · **Plateformes** : Web, WIN, ART
- **Préconditions** : jeu d'essai ; fenêtre de 1280 px de large au moins.
- **Données** : aucune.
- **Automatisés associés** : `TN-navigation`, `TN-interface`
- **Source** : [TEST] `tests/browser/navigation.js`, `tests/browser/interface.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'accueil. | Barre latérale à gauche avec « Aujourd'hui », « Chercher », « Bilan », puis les domaines « Maison » et « Création » en petites capitales et leurs espaces ; pas de barre basse. |
| 2 | Cliquer « Écriture », puis faire défiler l'espace jusqu'en bas. | La barre latérale reste visible (collante). |
| 3 | Inspecter le lien « Écriture » (clic droit → Inspecter). | Il porte `aria-current="page"` ; les autres non. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="nav-003"></a>
### NAV-003 — Palette de commandes (⌘K ou Ctrl+K)

- **Fonctionnalité et règle** : la palette va à un espace, lance le minuteur, garde une phrase dans la boîte, retrouve un
  texte et y mène.
- **Objectif, risque vérifié** : raccourci inopérant ; une phrase gardée au mauvais endroit.
- **Priorité** : P2 · **Plateformes** : Web, WIN, ART
- **Préconditions** : jeu d'essai ; ordinateur.
- **Données** : `plant`, `phrase NAV-003 gardée`, `hésite`.
- **Automatisés associés** : `TN-navigation`
- **Source** : [DOC] README, « Palette » ; [TEST] `tests/browser/navigation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Hors d'un champ, ⌘K (Mac) ou Ctrl+K. | Une palette s'ouvre, champ « Aller, agir, chercher… » sous le curseur. |
| 2 | Taper `plant`, Entrée. | L'espace « Plantes » s'affiche ; la palette est fermée. |
| 3 | Rouvrir, taper `phrase NAV-003 gardée`, choisir la ligne « « phrase NAV-003 gardée » dans Boîte ». | « Gardé. Tu peux oublier, c'est écrit. » ; la phrase est dans la boîte. |
| 4 | Rouvrir, taper `hésite`, choisir le texte trouvé (fragment d'Écriture). | L'Écriture s'ouvre sur le fragment « La lisière n'est pas une frontière, c'est un lieu où l'on hésite. », surligné. |
| 5 | Rouvrir, choisir « Lancer le minuteur (15 min) ». | Le minuteur démarre (temps qui reste et « Pause »). |
| 6 | Rouvrir, taper `zzzz`. | Deux lignes seulement : « Garder « zzzz » dans Boîte » et « Chercher « zzzz » partout » (C12) ; Échap ferme la palette. |

- **État final attendu** : une phrase de plus dans la boîte ; minuteur lancé.
- **Nettoyage** : supprimer la phrase ; remettre le minuteur à zéro.

---

<a id="nav-004"></a>
### NAV-004 — Chercher : sans accents ni casse, tous les mots, surlignage, touche « / »

- **Fonctionnalité et règle** : la recherche parcourt tous les modules, ignore accents et casse, exige tous les mots, surligne
  le passage ; « / » l'ouvre sur ordinateur.
- **Objectif, risque vérifié** : un texte écrit introuvable (parcours essentiel « retrouver »).
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN, ART
- **Préconditions** : jeu d'essai.
- **Données** : requêtes `LISIERE`, `lisière seuil`, `lisiere zzz`, `brouillard`.
- **Automatisés associés** : `TU-MOD-32`, `TN-recherche-minuteur`, `TN-ecran-lu`
- **Source** : [DOC] README, « Chercher » ; [TEST] `TU-MOD-32`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur ordinateur, hors d'un champ, appuyer sur `/`. | La vue « Chercher » s'ouvre, le curseur dans le champ ; l'onglet du navigateur s'appelle « Chercher — Selene » (le nom donné à Selene dans les Réglages, s'il y en a un, à la place de « Selene »). |
| 2 | Taper `LISIERE`. | Des résultats dans Écriture (les fragments qui contiennent « lisière »), dans la Boîte (« Écriture : la lisière comme seuil ») et dans Motifs (le motif « lisière » lui-même) ; « lisière » est surligné dans chaque extrait ; la frappe n'a jamais perdu le champ. |
| 3 | Remplacer par `lisière seuil`. | Deux résultats seulement, ceux qui contiennent les deux mots : le fragment « Toute lisière est un seuil que l'on traverse sans le voir. » et la note « Écriture : la lisière comme seuil ». |
| 4 | Remplacer par `lisiere zzz`. | « Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire. » |
| 5 | Remplacer par `brouillard`. | Le fragment « Le brouillard efface la route… » et le motif « brume » (dont « brouillard » est une variante) sont trouvés. |
| 6 | Sur téléphone, toucher « Chercher » dans la barre basse et refaire l'étape 2. | Mêmes résultats. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="nav-005"></a>
### NAV-005 — Chercher : facettes d'espace, de période et de statut

- **Fonctionnalité et règle** : des puces filtrent par espace, par période (« Depuis la nouvelle lune », « Ce mois-ci ») et
  par statut, chacune avec son décompte ; elles se combinent ; recliquer défait.
- **Objectif, risque vérifié** : un filtre qui cache des résultats sans le dire.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; ajouter aujourd'hui dans Écriture le fragment `? la lisière respire avec la brume`.
- **Données** : requête `lisière`.
- **Automatisés associés** : `TN-ecrans`
- **Source** : [DOC] README, « Chercher » ; [TEST] `tests/browser/ecrans.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Chercher `lisière`. | Résultats groupés par espace, date en marge ; puces « Tous les espaces » et un espace par groupe, « Toute date », « Depuis la nouvelle lune », « Ce mois-ci », chacune avec un nombre ; « Tout statut », sans nombre (ce serait le total déjà affiché), et les statuts présents, chacun avec le sien (C15). |
| 2 | Cliquer « Ce mois-ci ». | Seul le fragment d'aujourd'hui reste ; le compteur dit « 1 résultat sur N ». |
| 3 | Cliquer la puce « hypothèse ». | Toujours le fragment d'aujourd'hui (marqué hypothèse par le « ? ») ; les nombres des autres puces tiennent compte des filtres appliqués. |
| 4 | Recliquer « Ce mois-ci ». | Le filtre de période est défait ; restent les hypothèses de toutes dates. |
| 5 | Un filtre posé, quitter vers un espace ; puis ⌘K / Ctrl+K, taper un mot, « Chercher « … » partout ». Recommencer avec « / ». | La palette : la recherche repart sans filtre, partout (A38). « / » : la page Chercher telle qu'on l'a laissée, son filtre compris, et dit par « N résultats sur M » (C16). |

- **État final attendu** : un fragment de plus.
- **Nettoyage** : supprimer le fragment ajouté.

---

<a id="nav-006"></a>
### NAV-006 — « ouvrir » un résultat mène à l'entrée, même lointaine ; retour à la recherche

- **Fonctionnalité et règle** : « ouvrir » mène à l'entrée surlignée, dépliant la liste au-delà des cent premières ; la puce
  « ‹ Recherche » ramène aux résultats tels qu'ils étaient.
- **Objectif, risque vérifié** : résultat trouvé mais impossible à atteindre dans une longue liste.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu de volume ([donnees/README.md](../donnees/README.md#volume)) importé, ou au moins 120 fragments dans
  un même espace (la plus ancienne contient un mot unique, par exemple `aulne-NAV006`).
- **Données** : requête `aulne-NAV006`.
- **Automatisés associés** : `TN-navigation`, `TU-MOD-54`
- **Source** : [DOC] README, « Chercher » ; [TEST] `tests/browser/navigation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Chercher le mot unique. | Un résultat. |
| 2 | Cliquer « ouvrir ». | L'espace s'ouvre, la liste dépliée jusqu'à l'entrée, qui est visible et surlignée ; une puce « ‹ Recherche « aulne-NAV006 » » est affichée. |
| 3 | Cliquer la puce. | La recherche revient avec la même requête et le même résultat. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="nav-007"></a>
### NAV-007 — Réglages : six chapitres, sommaire, chaque espace une seule fois

- **Fonctionnalité et règle** : six chapitres, du plus courant au plus rare (Apparence et rythme, Espaces, Ciel et alentours,
  Assistant, Connexions, Compte et données) ; un sommaire, en marge sur grand écran, qui marque le chapitre lu ; chaque
  espace une fois, ses réglages sous sa ligne ; un bloc déplié le reste après un changement.
- **Objectif, risque vérifié** : réglage introuvable ; bloc qui se referme pendant qu'on règle.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : aucune.
- **Automatisés associés** : `TN-reglages`
- **Source** : [DOC] README, « Réglages » ; [DOC] [evolution-ui.md](../../evolution-ui.md#réglages-en-chapitres) ; [TEST] `tests/browser/reglages.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Réglages (fenêtre de 1280 px au moins). | Les six chapitres numérotés dans cet ordre ; le sommaire dans la marge droite. |
| 2 | Cliquer « Compte et données » dans le sommaire. | La page défile jusqu'au chapitre ; le focus est sur son titre ; le sommaire marque ce chapitre. |
| 3 | Dans « Espaces », compter les lignes « Écriture ». | Une seule ligne Écriture ; « régler » dessous déplie ses réglages. |
| 4 | Dans les réglages dépliés d'Écriture, changer l'objectif de 50000 à 60000 et quitter le champ. | La valeur est gardée ; le bloc reste déplié. |
| 5 | Sur téléphone (390 px), tout déplier et faire défiler. | Aucun débordement horizontal. |

- **État final attendu** : objectif d'Écriture à 60 000.
- **Nettoyage** : remettre 50 000.

---

<a id="nav-008"></a>
### NAV-008 — Infobulles « ? » des Réglages

- **Fonctionnalité et règle** : un « ? » ouvre une courte explication, au clic ou au toucher, jamais au seul survol ; Échap ou
  un clic ailleurs la ferme ; la bulle tient dans l'écran.
- **Objectif, risque vérifié** : explication inaccessible au clavier ou coupée par le bord de l'écran.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : Réglages ouverts.
- **Données** : aucune.
- **Automatisés associés** : `TN-reglages`
- **Source** : [TEST] `tests/browser/reglages.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Survoler un « ? » sans cliquer. | Rien ne s'ouvre. |
| 2 | Cliquer le « ? » à côté de « Boîte de réception » (ou un autre). | Une bulle s'ouvre, entière dans l'écran. |
| 3 | Appuyer sur Échap. | Elle se ferme. |
| 4 | Rouvrir, cliquer ailleurs dans la page. | Elle se ferme. |
| 5 | Sur téléphone, toucher un « ? » près du bord droit. | La bulle reste entière dans l'écran. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="nav-009"></a>
### NAV-009 — Langue de l'interface : appareil, choix du compte, bascule sans recharger

- **Fonctionnalité et règle** : français ou anglais, celle de l'appareil par défaut ; un choix dans Réglages s'applique sans
  recharger et suit le compte ; ce que la personne a écrit ne change pas.
- **Objectif, risque vérifié** : interface dans la mauvaise langue ; valeurs enregistrées traduites (corruption des données).
- **Priorité** : P2 · **Plateformes** : Web, Mob, AND, IOS
- **Préconditions** : connecté au compte A (pour vérifier le suivi par le compte) ; jeu d'essai importé ; navigateur réglé en
  anglais (Chrome : Paramètres → Langues, anglais en premier).
- **Données** : aucune.
- **Automatisés associés** : `TN-langue`, `TU-I18N-05`, `TU-I18N-15`, `TU-I18N-18`, `TN-sync-deux-appareils`
- **Source** : [DOC] [i18n.md](../../i18n.md) ; [TEST] `tests/browser/langue.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Selene. | Interface en anglais : navigation (« Today »…), date, phase de la lune ; Budget en `€2,000.00` ; les noms des espaces et les textes saisis restent tels quels (« Chantier », fragments en français). |
| 2 | Réglages → « Appearance and rhythm » → langue : choisir « Français ». | L'interface passe en français aussitôt, sans rechargement ; les langues sont proposées sous leur propre nom (« Français », « English »). |
| 3 | Sur un second appareil réglé en anglais, se connecter au compte A. | L'interface est en français (le choix du compte prime). |
| 4 | Remettre « Langue de l'appareil ». | Les deux appareils repassent à la langue de leur système. |
| 5 | Ouvrir le Budget en anglais et en français. | Les opérations restent des dépenses et revenus ; seuls les libellés changent. |

- **État final attendu** : langue de l'appareil.
- **Nettoyage** : remettre le navigateur en français.

---

<a id="nav-010"></a>
### NAV-010 — Apparence : palette, mode, « Suivre le soleil », nom affiché

- **Fonctionnalité et règle** : quatre palettes (Nigredo, Albedo, Citrinitas, Rubedo) ; mode « Suivre l'appareil »,
  « Toujours sombre », « Toujours clair », « Suivre le soleil » (sombre au crépuscule, clair à l'aube, d'après le lieu du ciel) ;
  « Nom affiché » en tête de l'app et dans l'onglet.
- **Objectif, risque vérifié** : réglage sans effet ; texte illisible dans un thème.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; pour « Suivre le soleil », un lieu réglé (EXT-007).
- **Données** : nom `Herbier`.
- **Automatisés associés** : `TN-fenetre`
- **Source** : [DOC] README, « Le ciel de l'accueil » ; [TEST] `tests/browser/fenetre.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Apparence et rythme → Palette « Rubedo, amanite ». | L'accent passe au rouge amanite partout, aussitôt. |
| 2 | Mode « Toujours clair », puis « Toujours sombre ». | Fond et texte basculent ; le texte reste lisible dans les deux. |
| 3 | Mode « Suivre le soleil », de jour puis après le coucher du soleil du lieu réglé. | Clair de jour, sombre après le crépuscule. |
| 4 | « Nom affiché » : `Herbier`, quitter le champ. | L'en-tête dit « Herbier » ; l'onglet du navigateur, « Réglages — Herbier » (l'écran, puis le nom). |

- **État final attendu** : palette, mode et nom modifiés.
- **Nettoyage** : remettre Nigredo, « Suivre l'appareil », « Selene ».

---

<a id="nav-011"></a>
### NAV-011 — « Ouvrir sur » et le bloc « Reprendre » de l'accueil

- **Fonctionnalité et règle** : « Ouvrir sur » l'accueil ou « Là où j'en étais », propre à l'appareil ; l'accueil propose de
  reprendre le dernier espace ouvert, son pont et ses brouillons.
- **Objectif, risque vérifié** : réglage qui suit le compte alors qu'il est propre à l'appareil.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : brouillon `brouillon NAV-011` dans le champ de fragment d'Écriture.
- **Automatisés associés** : `TN-navigation`
- **Source** : [DOC] README, « Navigation », « Reprendre » ; [TEST] `tests/browser/navigation.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Écriture, taper le brouillon sans le garder ; revenir à l'accueil. | Un bloc « Reprendre » nomme Écriture et le brouillon en cours. |
| 2 | Réglages → Apparence et rythme → « Ouvrir sur » : « Là où j'en étais ». | Message « L'app rouvrira le dernier espace où tu étais. » ; la ligne porte la mention « cet appareil ». |
| 3 | Ouvrir « Budget », fermer l'onglet, rouvrir le site. | L'app s'ouvre sur Budget. |
| 4 | Remettre « L'accueil », fermer et rouvrir. | L'app s'ouvre sur l'accueil. |

- **État final attendu** : « L'accueil ».
- **Nettoyage** : vider le brouillon.

---

<a id="nav-012"></a>
### NAV-012 — Routes inconnues, piégées ou masquées

- **Fonctionnalité et règle** : une route inconnue ou un nom de `Object.prototype` ramène à l'accueil ; un module ne masque
  jamais une vue fixe (`accueil`, `reglages`, `recherche`, `bilan`).
- **Objectif, risque vérifié** : page blanche ou plantage sur une adresse fabriquée.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : jeu d'essai ; créer un espace nommé « Réglages » (type Notes).
- **Données** : adresses `#nimportequoi`, `#constructor`, `#__proto__`, `#reglages`.
- **Automatisés associés** : `TN-routes`, `TU-MOD-05`, `TU-MOD-06`
- **Source** : [DOC] [architecture.md](../../architecture.md#modules) ; [TEST] `tests/browser/routes.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Créer l'espace « Réglages » et regarder son adresse. | Son identifiant n'est pas `reglages` (par exemple `reglages-2`). |
| 2 | Ouvrir successivement les trois premières adresses des données. | Chaque fois l'accueil, sans erreur ; aucune page blanche. |
| 3 | Ouvrir `#reglages`. | La page Réglages s'affiche, pas l'espace créé. |

- **État final attendu** : un espace « Réglages » de plus.
- **Nettoyage** : supprimer cet espace (ESP-007).

---

<a id="nav-013"></a>
### NAV-013 — Chaque vue retrouve sa position de défilement

- **Fonctionnalité et règle** : chaque vue retrouve sa position quand on y revient (pour la session).
- **Objectif, risque vérifié** : perdre sa place dans une longue liste à chaque aller-retour.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (Écriture assez longue pour défiler, ou le jeu de volume).
- **Données** : aucune.
- **Automatisés associés** : `TN-interface`
- **Source** : [DOC] README, « Actions de ligne » ; [TEST] `tests/browser/interface.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dans Écriture, défiler jusqu'au milieu de la liste. | Le haut de la liste n'est plus visible ; noter la première entrée visible. |
| 2 | Aller à l'accueil, puis revenir à Écriture. | La liste est à la même position. |
| 3 | Revenir à l'accueil. | L'accueil est à sa propre position (en haut), pas à celle d'Écriture. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.
