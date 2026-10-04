# Transverse

Ce qui traverse toutes les fonctionnalités : accessibilité, dates et fuseaux, volume, sécurité de l'affichage, CSP,
journaux et mesures, politique de confidentialité, page publique de test, mise en page, états vides, isolation entre
comptes. Ces cas se rejouent à chaque recette complète ; plusieurs ont un équivalent automatique partiel, aucun n'en a
d'intégral (un lecteur d'écran réel, un vrai téléphone et un vrai projet Supabase échappent aux scénarios simulés).

**Préconditions communes** : version hébergée ; jeu d'essai importé ([donnees/jeu-essai.json](../donnees/jeu-essai.json)) ;
Chrome avec les outils de développement, sauf mention contraire. **Ne pas polluer la production** : les cas qui
provoquent un envoi de mesure (journal des erreurs, mesure d'usage, audience de la page de test) bloquent d'abord la
requête dans les outils de développement (Network → clic droit → *Block request URL*, ou panneau *Request blocking*) ;
une requête bloquée reste listée dans Network avec sa charge utile, qu'on lit sans qu'elle atteigne le serveur.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [TRV-001](#trv-001) | Lecteur d'écran : une heure sans regarder l'écran | P2 | Web, Mob, AND, IOS |
| [TRV-002](#trv-002) | Clavier seul | P2 | Web, WIN |
| [TRV-003](#trv-003) | Cibles tactiles et cibles à la souris | P3 | Web, Mob |
| [TRV-004](#trv-004) | La date change pendant que l'app est ouverte | P2 | Web, Mob |
| [TRV-005](#trv-005) | Changement d'heure et de fuseau | P2 | Web |
| [TRV-006](#trv-006) | Contraste et mouvement réduit | P3 | Web, Mob |
| [TRV-007](#trv-007) | Gros historique : réactivité | P2 | Web, Mob, AND, IOS |
| [TRV-008](#trv-008) | Un texte piégé reste du texte, partout | P1 | Web, ART |
| [TRV-009](#trv-009) | Aucune violation de CSP, aucun appel vers un hôte non déclaré | P1 | Web |
| [TRV-010](#trv-010) | Journal des erreurs anonyme, et son interrupteur | P2 | Web |
| [TRV-011](#trv-011) | Mesure d'usage de la bêta, et son interrupteur | P2 | Web |
| [TRV-012](#trv-012) | Politique de confidentialité | P2 | Web |
| [TRV-013](#trv-013) | Page publique de test | P2 | Web, Mob |
| [TRV-014](#trv-014) | Téléphone et ordinateur : rien ne déborde | P2 | Web, Mob |
| [TRV-015](#trv-015) | États vides | P3 | Web, Mob |
| [TRV-016](#trv-016) | Isolation entre comptes sur le vrai projet | P1 | Web |

Identifiants retirés : aucun.

---

<a id="trv-001"></a>
### TRV-001 — Lecteur d'écran : une heure sans regarder l'écran

- **Fonctionnalité et règle** : chaque écran a un titre de page qui le nomme ; aller à un espace met le focus sur son
  titre ; les messages d'état sont courts, annoncés poliment ; « Annuler » est annoncé avec son raccourci et reste
  le temps qu'il faut ; les boîtes de dialogue prennent le focus.
- **Objectif, risque vérifié** : une app utilisable seulement par qui la voit ; les scénarios automatiques vérifient des
  attributs, pas ce qu'un lecteur d'écran dit vraiment.
- **Priorité** : P2 · **Plateformes** : Web, Mob, AND, IOS
- **Préconditions** : un lecteur d'écran réel : NVDA (Windows, Chrome), VoiceOver (macOS, Safari ; iOS), ou TalkBack
  (Android) ; l'écran éteint ou masqué pendant les étapes 2 à 6 (« rideau d'écran » de VoiceOver, ou luminosité à zéro).
- **Données** : capture `Lu sans voir TRV-001` ; recherche `lisière`.
- **Automatisés associés** : `TN-ecran-lu`, `TN-annuler`
- **Source** : [TEST] `tests/browser/ecran-lu.js`, `tests/browser/annuler.js` ; [DOC]
  [evolution-ui.md](../../evolution-ui.md).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Selene ; écouter l'annonce. | Le titre de la page nomme l'écran, puis l'app (« Accueil — Selene », ou le nom affiché choisi dans les Réglages). |
| 2 | Aller dans Écriture par la navigation. | Le lecteur annonce le titre « Écriture » ; le focus est sur le titre, la page n'a pas sauté en bas. |
| 3 | Revenir à l'accueil ; garder la capture des données. | Un message court est annoncé (la note gardée), sans interrompre brutalement la lecture en cours. |
| 4 | Supprimer la note dans la Boîte ; écouter le message ; déclencher « Annuler » (Entrée sur le message, ou Ctrl+Z hors d'un champ). | Le message annonce la suppression et le raccourci d'annulation ; la note revient. |
| 5 | Touche `/` (ordinateur) ou la recherche (téléphone) ; chercher les données ; parcourir les résultats. | Le curseur est dans le champ de recherche ; les résultats sont lus groupés par espace, chacun avec son espace. |
| 6 | Ouvrir puis fermer une boîte de dialogue (par exemple « suppr. » puis « Annuler »). | Le focus entre dans la boîte, puis revient où il était. |
| 7 | Rallumer l'écran ; noter dans le compte rendu chaque endroit où il a fallu regarder. | Aucun : chaque étape a pu se faire à l'oreille. Sinon, chaque endroit est une anomalie à ouvrir. |

- **État final attendu** : inchangé (la note restaurée puis supprimée, au choix de l'exécutant).
- **Nettoyage** : supprimer la note.

---

<a id="trv-002"></a>
### TRV-002 — Clavier seul

- **Fonctionnalité et règle** : tout se fait au clavier : navigation, création, saisie, colonnes (`[` et `]` sur une carte),
  carte céleste (étoile suivie au clavier), formulaires de « Reprendre la main » ; Échap ferme ; le focus reste visible.
- **Objectif, risque vérifié** : une action réservée à la souris ; un focus perdu après une action.
- **Priorité** : P2 · **Plateformes** : Web, WIN
- **Préconditions** : souris débranchée ou laissée de côté.
- **Données** : tâche `Clavier TRV-002`.
- **Automatisés associés** : `TN-ecran-lu`, `TN-carte`, `TN-ecrans`, `TN-regulation`
- **Source** : [TEST] les scénarios cités ; [DOC] README (« `[` et `]` sur la carte qui a le focus »).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Tab depuis le haut de la page jusqu'à « Chantier » ; Entrée. | Le focus est visible à chaque arrêt (contour) ; Chantier s'ouvre, focus sur son titre. |
| 2 | Créer la tâche des données au clavier seul (Tab, saisie, Entrée). | La tâche est créée ; le focus revient dans l'espace, pas en haut de la page. |
| 3 | Tableau (colonnes) : Tab jusqu'à la carte « Lichens d'automne », `]`, puis `[`. | La carte passe à la colonne suivante puis revient ; elle garde le focus ; la colonne est annoncée. |
| 4 | Ouvrir la fiche d'un fragment d'Écriture, puis sa carte du voisinage ; parcourir les étoiles au clavier. | Chaque étoile se suit au clavier ; la table des liaisons est atteignable. |
| 5 | Ouvrir un formulaire (par exemple « + » d'une tâche), Échap. | Le formulaire se ferme sans rien enregistrer ; le focus revient sur le bouton qui l'a ouvert. |
| 6 | Si un suivi « Reprendre la main » est présent ([RLM-028](reprendre-la-main.md#rlm-028)) : « J'ai une envie » au clavier. | Le formulaire s'ouvre avec le focus dedans. Sinon : non applicable. |

- **État final attendu** : une tâche de plus.
- **Nettoyage** : la supprimer.

---

<a id="trv-003"></a>
### TRV-003 — Cibles tactiles et cibles à la souris

- **Fonctionnalité et règle** : sur téléphone, chaque contrôle offre au moins 44 × 44 px au doigt ; à la souris, chaque
  petite cible garde 24 px d'air (WCAG 2.5.8) ; les actions d'une ligne (« suppr. ») sont cachées au repos sur écran
  tactile, un toucher les montre pour une ligne à la fois.
- **Objectif, risque vérifié** : un « suppr. » touché par erreur ; un bouton impossible à viser.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : un téléphone réel (ou l'émulation 390 × 844 avec le toucher activé) ; un ordinateur.
- **Données** : aucune.
- **Automatisés associés** : `TN-cibles`, `TN-cibles-ordinateur`, `TN-interface`
- **Source** : [TEST] `tests/browser/cibles.js`, `tests/browser/cibles-ordinateur.js`, `tests/browser/interface.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Téléphone : parcourir Accueil, Boîte, Chantier, Budget, Réglages, en touchant chaque bouton de petite taille (« fait », « voir », étoile, flèches). | Chaque toucher atteint le bon bouton du premier coup ; outils de développement : la zone cliquable mesure au moins 44 × 44 px. |
| 2 | Téléphone : Boîte, regarder une note au repos, puis la toucher. | Au repos, pas de « suppr. » ; au toucher, les actions de cette ligne seulement apparaissent. |
| 3 | Ordinateur : survoler une ligne d'une liste. | Les actions de la ligne apparaissent au survol ; deux petites cibles voisines sont séparées d'au moins 24 px (mesure dans les outils de développement). |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="trv-004"></a>
### TRV-004 — La date change pendant que l'app est ouverte

- **Fonctionnalité et règle** : laissée ouverte sur l'accueil, Selene se redessine toutes les cinq minutes : passé minuit,
  la date, la lune, « Aujourd'hui » et le cycle en cours suivent ; une saisie après minuit porte la nouvelle date ; les
  cycles lunaires se suivent sans trou.
- **Objectif, risque vérifié** : une app restée ouverte la nuit qui date du jour d'avant ce qu'on note au réveil.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : un ordinateur de recette dont on peut régler l'heure (horloge automatique coupée) ; Selene ouverte
  sur l'accueil ; heure du système réglée à 23 h 55.
- **Données** : capture `Après minuit TRV-004`.
- **Automatisés associés** : `TU-MOD-37`
- **Source** : [CODE] `skyTick` (`src/app/boot.js`, rendu de l'accueil toutes les cinq minutes) ; [TEST] `TU-MOD-37`
  (cycles sans trou) ; [À ARBITRER] étape 3.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Noter la date affichée par l'en-tête ; laisser l'app ouverte, au premier plan, jusqu'à 00 h 06. | L'en-tête affiche le nouveau jour au plus tard cinq minutes après minuit, sans rechargement. |
| 2 | Garder la capture des données ; ouvrir la Boîte. | La note porte la nouvelle date. |
| 3 | Refaire l'étape 1 sur une autre vue (par exemple Chantier). | Comportement actuel lu dans le code : seule la vue d'accueil (ou le mode « Suivre le soleil ») se redessine d'elle-même ; ailleurs, la date change au prochain geste. [À ARBITRER] : est-ce acceptable ? Les dates par défaut des formulaires ouverts avant minuit gardent la veille. |
| 4 | Bilan : lire le cycle lunaire en cours. | Il contient la nouvelle date ; pas de trou entre le cycle précédent et celui-ci. |

- **État final attendu** : une note de plus.
- **Nettoyage** : la supprimer ; rétablir l'heure automatique.

---

<a id="trv-005"></a>
### TRV-005 — Changement d'heure et de fuseau

- **Fonctionnalité et règle** : les dates sont locales et déclarées : un voyage ou un changement d'heure ne reclasse
  aucune entrée ; un événement récurrent du calendrier à 18 h 30 à Paris reste à 18 h 30 après le changement d'heure.
- **Objectif, risque vérifié** : une note de 23 h 30 qui glisse au lendemain ; un rendez-vous décalé d'une heure en
  novembre.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : Chrome, outils de développement → Sensors ; pour l'étape 4, un calendrier dédié branché
  ([EXT-015](connexions.md#ext-015)) avec un événement hebdomadaire à 18 h 30, heure de Paris, qui traverse le dernier
  dimanche d'octobre (sinon : étape non applicable).
- **Données** : capture `Fuseau TRV-005`.
- **Automatisés associés** : `TU-REG-05`, `TU-AGD-02`
- **Source** : [DOC] [regulation.md](../../regulation.md#règles) (dates locales) ; [TEST] `TU-REG-05`, `TU-AGD-02`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sensors → Location → fuseau `Europe/Paris` ; recharger ; garder la capture des données. | La note est datée du jour J. |
| 2 | Fuseau `America/Los_Angeles` ; recharger ; ouvrir la Boîte. | La note est toujours datée de J (pas de la veille), même si « aujourd'hui » à Los Angeles est un autre jour. |
| 3 | Fuseau `Pacific/Auckland` ; recharger. | Toujours J. |
| 4 | Fuseau `Europe/Paris` ; agenda : lire l'événement de la semaine avant et celle après le changement d'heure. | 18 h 30 les deux semaines. |

- **État final attendu** : une note de plus.
- **Nettoyage** : supprimer la note ; Sensors → « No override ».

---

<a id="trv-006"></a>
### TRV-006 — Contraste et mouvement réduit

- **Fonctionnalité et règle** : le texte garde un contraste de 4,5:1 (le nom d'un espace éteint, le texte posé sur le
  ciel, à toute heure, par tout temps, en clair et en sombre) ; « Ciel vivant » n'anime que `transform`, s'immobilise hors
  de vue, quand il est décoché ou quand le système demande moins de mouvement.
- **Objectif, risque vérifié** : un texte illisible sur un ciel clair ; une animation imposée à qui en souffre.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : outils de développement → Rendering ; un lieu réglé pour le ciel avec la météo
  ([EXT-007](connexions.md#ext-007)).
- **Données** : aucune.
- **Automatisés associés** : `TN-contraste`, `TN-ciel-vivant`, `TU-SKY-07`
- **Source** : [TEST] `tests/browser/contraste.js`, `tests/browser/ciel-vivant.js`, `TU-SKY-07`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Espaces : éteindre « Plantes » ; en thème clair puis sombre, inspecter le nom « Plantes » (sélecteur de couleur des outils de développement). | Contraste affiché d'au moins 4,5. |
| 2 | Accueil, en clair puis en sombre, de jour puis de nuit (mode « Suivre le soleil », ou heure du système) : inspecter le texte posé sur le ciel. | Contraste d'au moins 4,5 à chaque fois. |
| 3 | Rendering → *Emulate CSS media feature prefers-reduced-motion* : `reduce` ; observer le ciel une minute. | Nuages, brume et pluie immobiles. |
| 4 | Retirer l'émulation ; Réglages → décocher « Ciel vivant : nuages, brume, pluie ou neige bougent… ». | Le ciel est immobile ; le réglage reste décoché après rechargement, sur cet appareil seulement. |

- **État final attendu** : « Plantes » éteinte, ciel vivant décoché.
- **Nettoyage** : rallumer « Plantes » ; recocher « Ciel vivant » ; retirer l'émulation.

---

<a id="trv-007"></a>
### TRV-007 — Gros historique : réactivité

- **Fonctionnalité et règle** : avec des années d'usage (le jeu de volume : 4 000 fragments, 1 500 notes, plus de 3 Mo), les
  vues qui parcourent tout (accueil, motifs, bilan, planche, recherche) restent utilisables, sur ordinateur et sur
  téléphone.
- **Objectif, risque vérifié** : une app qui fige le téléphone au bout de deux ans d'usage.
- **Priorité** : P2 · **Plateformes** : Web, Mob, AND, IOS
- **Préconditions** : chemin « sans compte » (pour ne pas peser sur un compte) ; le jeu de volume généré par
  `npm run recette -- donnees` et importé ([donnees/README.md](../donnees/README.md#volume)) ; un téléphone de milieu de
  gamme pour les étapes 4 et 5.
- **Données** : recherche `lune porte`.
- **Automatisés associés** : `TS-BENCH`
- **Source** : [TEST] `npm run bench` (mesure seulement, dans une VM sans mise en page : 30 à 60 ms par vue le
  4 octobre 2026) ; [À ARBITRER] aucun seuil d'acceptation n'existe : à fixer par la responsable du produit.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ordinateur : outils de développement → Performance → enregistrer ; ouvrir successivement Accueil, Motifs (créer l'espace depuis le modèle s'il manque), Écriture, Bilan, la planche, puis chercher les données. | Chaque vue s'affiche entière ; aucun avertissement « la page ne répond pas ». Noter dans le compte rendu la durée de la plus longue tâche de chaque vue. |
| 2 | Écriture : faire défiler jusqu'aux fragments les plus anciens. | La liste se pagine ; le plus ancien fragment (« aulne-NAV006… ») est atteignable. |
| 3 | Réglages → Compte et données → Sauvegarde. | La ligne de taille est en alerte (voir [DON-009](donnees-sauvegardes.md#don-009)). |
| 4 | Téléphone (PWA ou app) : importer le même fichier ; refaire l'étape 1 en chronométrant. | Les vues s'affichent ; noter les durées. Repère du dépôt : compter 3 à 5 fois plus que sur ordinateur. |
| 5 | Téléphone : taper une capture de 200 caractères dans l'accueil. | Les caractères s'affichent sans retard perceptible pendant la frappe. |

- **État final attendu** : jeu de volume importé.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="trv-008"></a>
### TRV-008 — Un texte piégé reste du texte, partout

- **Fonctionnalité et règle** : tout ce qu'une personne écrit, importe ou reçoit (nom d'espace, note, fragment, tâche,
  motif, titre d'une page, export Instagram) s'affiche comme du texte, jamais comme du HTML, dans chaque vue et dans les
  fichiers produits (planche téléchargée) ; un identifiant piégé dans une sauvegarde est refusé.
- **Objectif, risque vérifié** : une injection de script (XSS, *cross-site scripting* : faire exécuter du code par la page
  d'autrui) qui volerait la session ou les données.
- **Priorité** : P1 · **Plateformes** : Web, ART
- **Préconditions** : communes ; console des outils de développement ouverte (*Preserve log*).
- **Données** : `<img src=x onerror=alert('TRV008')>` (appelé ci-dessous « le piège ») ; `"><script>alert('TRV008')</script>`.
- **Automatisés associés** : `TN-injection`, `TN-csp`, `TN-marges`, `TN-carte`, `TN-planche`, `TN-sources`
- **Source** : [TEST] les scénarios cités ; [CODE] `esc` (`src/app/lib/dom.js`), `parseBackup` (identifiants).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Accueil : capturer le piège. Chantier : créer une tâche intitulée par la seconde donnée. Motifs : ajouter un motif nommé par le piège. Réglages → Espaces : renommer « Carnet » par le piège. | Partout, le texte s'affiche tel quel, chevrons visibles ; aucune image cassée, aucune alerte. |
| 2 | Parcourir Accueil, Boîte, Chantier, Motifs, la navigation, la palette (Ctrl+K, taper `TRV008`), la recherche `TRV008`, le Bilan, la planche. | Même constat dans chaque vue ; console : aucune exécution, aucun message `TRV008`. |
| 3 | Planche → télécharger le fichier ; l'ouvrir dans le navigateur. | Le piège y est du texte ; aucune alerte. |
| 4 | Importer [`donnees/refus-hostile.json`](../donnees/refus-hostile.json). | Refusé : « Fichier illisible ou pas une sauvegarde Selene. » ; rien ne change. |
| 5 | Importer l'export Instagram de recette ([EXT-011](connexions.md#ext-011)). | Le titre « Trois ailes <img src=x onerror=alert('recette')> » s'affiche en texte. |
| 6 | Artefact : refaire l'étape 1 pour la capture. | Même constat. |

- **État final attendu** : des contenus piégés inertes.
- **Nettoyage** : supprimer la note, la tâche, le motif ; renommer l'espace « Carnet » ; supprimer l'import Instagram.

---

<a id="trv-009"></a>
### TRV-009 — Aucune violation de CSP, aucun appel vers un hôte non déclaré

- **Fonctionnalité et règle** : la politique de sécurité du contenu (CSP, *Content Security Policy* : la liste de ce que
  la page a le droit de charger et de joindre) n'autorise que deux scripts identifiés par leur empreinte, les polices du
  site, et en réseau : le site, `*.supabase.co`, `api.open-meteo.com`, `geocoding-api.open-meteo.com`, `api.crossref.org`,
  `api.microlink.io`, `musicbrainz.org`, `public.opendatasoft.com`, `api.openalex.org`, `api.zotero.org` (images :
  `coverartarchive.org`, `*.archive.org`) ; aucune police chez Google.
- **Objectif, risque vérifié** : une fonction cassée par la CSP en production seulement ; un appel vers un tiers non
  annoncé dans la politique de confidentialité.
- **Priorité** : P1 · **Plateformes** : Web
- **Préconditions** : site publié (GitHub Pages) au commit en recette ; connectée au compte A ; console (*Preserve log*)
  et Network ouverts.
- **Données** : aucune.
- **Automatisés associés** : `TN-csp`, `TU-BLD-02`, `TU-SKY-08`
- **Source** : [CODE] la balise CSP de `index.html` ; [TEST] `tests/browser/csp.js`, `TU-BLD-02`, `TU-SKY-08`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Afficher la source de la page ; lire la balise `Content-Security-Policy`. | `script-src` liste `'self'` et deux empreintes `sha256-…`, sans `'unsafe-inline'` ; `connect-src` est exactement la liste ci-dessus. |
| 2 | Parcourir Accueil, chaque espace du jeu d'essai, Recherche, Bilan, la planche, Réglages, Assistant ; dans Sources, chercher un DOI ; dans Musique, préciser un album. | Console : aucun message « Refused to … because it violates the following Content Security Policy directive ». |
| 3 | Network : trier par domaine. | Aucun domaine hors de la liste ; aucun `fonts.googleapis.com` ni `fonts.gstatic.com`. |

- **État final attendu** : inchangé.
- **Nettoyage** : annuler les ajouts faits dans Sources et Musique.

---

<a id="trv-010"></a>
### TRV-010 — Journal des erreurs anonyme, et son interrupteur

- **Fonctionnalité et règle** : une erreur de programmation qui échappe à l'app part, anonyme, vers la table `erreurs` :
  genre (`TypeError`…), lieu (`fichier:ligne:colonne`), vue, version, plateforme ; jamais le message, ni le compte, ni
  un jeton (la clé publique seule) ; au plus cinq par chargement, une fois chacune ; « Envoyer les erreurs de l'app,
  anonymes » (Réglages → Compte) coupe l'envoi pour l'appareil.
- **Objectif, risque vérifié** : un texte personnel envoyé dans un message d'erreur ; un interrupteur sans effet.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : connectée au compte A ; Network : bloquer `*rest/v1/erreurs*` ; console ouverte.
- **Données** : dans la console : `setTimeout(() => { throw new TypeError("TRV010 texte privé") })`.
- **Automatisés associés** : `TN-journal`, `TU-JRN-01`, `TU-JRN-02`, `TU-JRN-05`
- **Source** : [DOC] [compte.md](../../compte.md#journal-des-erreurs) ; [TEST] `tests/browser/journal.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Compte. | Case « Envoyer les erreurs de l'app, anonymes », cochée, avec « Seulement les erreurs de programmation… Ce réglage vaut pour cet appareil. » |
| 2 | Exécuter la donnée dans la console. | Network : une requête (bloquée) vers `/rest/v1/erreurs` ; charge utile : `genre` « TypeError », un `lieu`, une `vue`, une `version`, `plateforme` « web » ; **pas** de « TRV010 texte privé » ; en-têtes : `apikey`, pas d'`Authorization` portant la session. |
| 3 | Exécuter la donnée une seconde fois. | Pas de seconde requête (même genre, même lieu). |
| 4 | Décocher la case ; recharger ; exécuter la donnée. | Aucune requête ; après rechargement, la case est toujours décochée. |

- **État final attendu** : envoi coupé sur cet appareil.
- **Nettoyage** : recocher la case ; vider la liste de blocage.

---

<a id="trv-011"></a>
### TRV-011 — Mesure d'usage de la bêta, et son interrupteur

- **Fonctionnalité et règle** : une saisie (pas une ouverture, pas un réglage, pas un espace vide créé) envoie une ligne
  `{ jour }` vers `activite`, avec la session, sans le texte ; une fois par jour et par chargement ; rien n'est écrit sur
  l'appareil pour s'en souvenir ; « Compter mes jours d'usage, pour la bêta » (Réglages → Compte) la coupe ; sans compte,
  rien ne part.
- **Objectif, risque vérifié** : une mesure qui embarquerait le contenu ; un traceur déguisé (stockage sur l'appareil) ;
  un droit d'opposition sans effet.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : connectée au compte A ; Network : bloquer `*rest/v1/activite*` ; case de la mesure **cochée** pour
  ce cas (elle est coupée d'ordinaire sur les appareils de recette).
- **Données** : capture `Mesure TRV-011` ; puis `Seconde TRV-011`.
- **Automatisés associés** : `TN-activite`, `TU-ACT-01`, `TU-ACT-02`, `TU-ACT-03`
- **Source** : [DOC] [compte.md](../../compte.md#mesure-dusage-bêta) ; [TEST] `tests/browser/activite.js` (instable sous
  WebKit, anomalie [A1](../perimetre.md#anomalies-et-observations)).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Recharger ; changer la palette dans Réglages ; créer un espace vide depuis un type. | Aucune requête vers `/rest/v1/activite`. |
| 2 | Garder la première capture. | Une requête (bloquée) : charge utile `{"jour":"<J>"}` seulement ; en-tête `Authorization` (la session) ; pas de « Mesure TRV-011 ». |
| 3 | Garder la seconde capture. | Aucune nouvelle requête. |
| 4 | Application → Local Storage et IndexedDB : chercher une trace de la mesure. | Aucune clé propre à la mesure d'usage. |
| 5 | Décocher la case ; recharger ; capturer de nouveau. | Aucune requête ; la case reste décochée après rechargement. |

- **État final attendu** : mesure coupée sur cet appareil.
- **Nettoyage** : supprimer les notes et l'espace vide ; vider la liste de blocage.

---

<a id="trv-012"></a>
### TRV-012 — Politique de confidentialité

- **Fonctionnalité et règle** : `confidentialite.html` et `privacy.html` sont publiées, sans script, à la même date, avec
  les sections de l'article 13 du RGPD (responsable, contact par courriel, bases légales, durées, transferts, réclamation à
  la CNIL) ; elles nomment chaque service contacté ; les Réglages lient celle de la langue de l'interface.
- **Objectif, risque vérifié** : une politique qui ne correspond plus à l'app (un service appelé sans être annoncé).
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : site publié au commit en recette.
- **Données** : aucune.
- **Automatisés associés** : `TU-BLD-03`, `TU-BLD-04`, `TN-compte`, `TN-hors-ligne`
- **Source** : [DOC] [compte.md](../../compte.md#politique-de-confidentialité) ; [TEST] `TU-BLD-03`, `TU-BLD-04`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Compte : suivre le lien « ce que Selene garde, et où ». | `confidentialite.html` s'ouvre (interface en français). |
| 2 | Lire la page. | Responsable nommée, contact par courriel, une base légale par usage, durées (sauvegardes 30 jours au plus), transferts, lien vers la réclamation à la CNIL ; date de mise à jour. |
| 3 | Comparer avec la liste des hôtes de [TRV-009](#trv-009) et avec Anthropic (assistant). | Chaque service y est nommé. |
| 4 | Basculer l'interface en anglais ; suivre le lien. | `privacy.html`, même date, mêmes sections. |
| 5 | Outils de développement : Sources ou Network de la page. | Aucun script chargé par la politique. |

- **État final attendu** : interface en anglais.
- **Nettoyage** : remettre le français.

---

<a id="trv-013"></a>
### TRV-013 — Page publique de test

- **Fonctionnalité et règle** : `essai.html` dit la promesse, montre trois captures, le prix prévu ; une ouverture laisse
  une ligne d'audience (page, événement, lien d'arrivée), pas un rechargement ; ni cookie ni stockage ; la liste d'attente
  exige une adresse complète et l'accord ; « Essayer sans compte » ouvre l'app directement.
- **Objectif, risque vérifié** : une mesure qui deviendrait un traceur ; des inscriptions perdues.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : site publié ; Network : bloquer `*rest/v1/audience*` et `*rest/v1/attente*` (aucune écriture en
  production) ; toujours `?src=recette` dans l'adresse.
- **Données** : `essai.html?src=recette` ; adresses `recette@` puis `recette@example.test`.
- **Automatisés associés** : `TN-essai`, `TU-BLD-05`
- **Source** : [DOC] [essai.md](../../essai.md) ; [TEST] `tests/browser/essai.js`, `TU-BLD-05`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'adresse des données. | La promesse « Garde tes fragments, tes sources et tes hypothèses reliés », trois captures, le prix ; Network : une requête (bloquée) vers `/rest/v1/audience` avec la page, l'événement et `recette`. |
| 2 | Recharger. | Aucune nouvelle requête d'audience. |
| 3 | Application : Cookies, Local Storage, Session Storage, IndexedDB de l'origine. | Rien d'écrit par la page. |
| 4 | Liste d'attente : `recette@`, envoyer ; puis `recette@example.test` sans cocher l'accord. | Chaque fois un message qui dit ce qui manque ; aucune requête vers `/rest/v1/attente`. |
| 5 | Adresse complète, accord coché, envoyer. | Une requête (bloquée) vers `/rest/v1/attente` ; le refus du serveur est dit, l'adresse reste dans le champ. |
| 6 | « Essayer sans compte ». | `index.html#sans-compte` : l'app s'ouvre directement, sans écran d'entrée. |
| 7 | Téléphone : refaire l'étape 1. | Aucun défilement horizontal. |

- **État final attendu** : inchangé côté serveur.
- **Nettoyage** : vider la liste de blocage. Si une requête est partie par erreur, la personne qui administre le projet
  supprime les lignes `src = 'recette'` d'`audience` et d'`attente`.

---

<a id="trv-014"></a>
### TRV-014 — Téléphone et ordinateur : rien ne déborde

- **Fonctionnalité et règle** : aucune vue ne défile horizontalement, de 320 px à 1 280 px ; sur téléphone, l'en-tête tient
  sur une ligne (10 % de l'écran au plus) ; les colonnes défilent dans leur cadre ; les formulaires prennent la largeur.
- **Objectif, risque vérifié** : un bouton hors de l'écran ; une page qui glisse sous le doigt.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : émulation des outils de développement (320 × 640, 390 × 844, 1 280 × 900) et un téléphone réel.
- **Données** : aucune.
- **Automatisés associés** : `TN-reglages`, `TN-en-tete`, `TN-regulation`, `TN-identite`
- **Source** : [TEST] les scénarios cités.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | À 320 px : parcourir Accueil, chaque espace, Recherche, Bilan, planche, Réglages (chaque chapitre déplié). | Aucun défilement horizontal de la page ; le Tableau défile dans son propre cadre. |
| 2 | À 390 px : mesurer la hauteur de l'en-tête. | Une ligne, au plus 84 px (10 % de 844). |
| 3 | Ouvrir un formulaire (tâche, élément de collection). | Il occupe la largeur de l'écran ; aucun champ coupé. |
| 4 | À 1 280 px : même parcours. | Barre latérale à gauche, contenu sans débordement. |
| 5 | Téléphone réel : parcours rapide de l'étape 1. | Même constat. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="trv-015"></a>
### TRV-015 — États vides

- **Fonctionnalité et règle** : un espace ou une liste sans contenu le dit par une phrase, jamais par un blanc ; la
  phrase propose quoi faire quand c'est utile.
- **Objectif, risque vérifié** : un écran vide pris pour un bug ou une perte de données.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : chemin « sans compte » dans un profil neuf, sans import.
- **Données** : aucune.
- **Automatisés associés** : `TN-budget`, `TN-notes`
- **Source** : [CODE] les messages `class="empty"` des modules ; [TEST] `tests/browser/budget.js`, `tests/browser/notes.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir la Boîte. | « Vide. Le silence d'une clairière, ou celui d'un cerveau. » |
| 2 | Accueil. | « Rien de prévu. Un module de tâches remplirait cet espace, si tu y tiens. » |
| 3 | Créer un espace depuis le modèle « Tâches » ; l'ouvrir. | « Aujourd'hui » : « Coche l'étoile d'une tâche. » ; la liste : « Plus rien ici. Soit c'est fini, soit tu as filtré trop fort. » |
| 4 | Créer un espace depuis le modèle « Budget » ; l'ouvrir. | « Aucune opération ce mois-ci. Suspect. » |
| 5 | Créer un espace depuis le modèle « Carnet » ; l'ouvrir. | « Rien pour l'instant. » |
| 6 | Chercher `zzz-introuvable`. | « Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire. » |

- **État final attendu** : trois espaces vides de plus.
- **Nettoyage** : les supprimer.

---

<a id="trv-016"></a>
### TRV-016 — Isolation entre comptes sur le vrai projet

- **Fonctionnalité et règle** : chaque compte ne voit et ne modifie que sa ligne (règles RLS, *Row Level Security* : des
  règles posées dans la base, ligne par ligne) ; `npm run isolation` le prouve sur un projet de préproduction, et la
  comparaison des règles prouve que la production a les mêmes.
- **Objectif, risque vérifié** : un compte qui lit l'espace d'un autre : la fuite la plus grave possible ; les tests
  automatiques tournent contre une base simulée et ne prouvent rien sur les règles réellement posées.
- **Priorité** : P1 · **Plateformes** : Web
- **Préconditions** : la personne qui administre Supabase ; un projet de préproduction monté avec `supabase/schema.sql` et
  deux comptes de test ; le fichier `.env.isolation` (jamais versionné, jamais une clé secrète), selon
  [compte.md](../../compte.md#vérifier-lisolation-entre-comptes) ; Node 22.
- **Données** : aucune.
- **Automatisés associés** : `TU-ISO-01`, `TS-ISOLATION`
- **Source** : [DOC] [compte.md](../../compte.md#vérifier-lisolation-entre-comptes) ; [TEST] `TU-ISO-01` (le script, contre
  une base simulée).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | `npm run isolation`. | Douze requêtes refusées, ligne de B intacte ; code de sortie 0. Rien de secret affiché. Code 1 : fuite, ne rien publier ; code 2 : impossible de conclure. |
| 2 | Dans le *SQL Editor* de la préproduction **et** de la production, lancer la requête de comparaison des règles de compte.md ; comparer ligne à ligne. | Résultats identiques ; `relrowsecurity` vaut `true` partout ; `app_state` a trois règles limitées à `auth.uid() = user_id` ; `assistant_keys` n'en a aucune. |

- **État final attendu** : inchangé (la préproduction garde ses lignes de test).
- **Nettoyage** : aucun.
