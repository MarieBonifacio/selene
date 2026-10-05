# Connexions externes

Tout ce qui vient du dehors : Sources (Crossref, Microlink, le passeur), Musique (MusicBrainz), ciel et météo (Open-Meteo),
radar culturel (OpenAgenda), import Instagram, passeur, Dehors, Artist Watch, veille de recherche (OpenAlex), calendrier,
Zotero, « ce que tes sources ont en commun », « Envoyer à Selene ». Principe commun : rien ne part sans un geste, et chaque
service peut tomber en panne sans casser l'app ([connexions.md](../../connexions.md#principes)).

**Préconditions communes** : version hébergée (ces fonctions n'existent pas dans l'artefact, voir EXT-019) ; réseau ouvert
vers les services ; jeu d'essai importé. Pour le passeur, Dehors, le calendrier et le relais Zotero : connectée au compte de
recette A **et** son identifiant ajouté au secret `PASSEUR_USERS` du projet ([passeur.md](../../passeur.md)). Pour
observer les appels : outils de développement → Network. « Couper un service » : clic droit sur une requête → *Block
request domain*, ou mode hors ligne.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [EXT-001](#ext-001) | Source par DOI | P2 | Web, Mob |
| [EXT-002](#ext-002) | Source par lien ; adresse nettoyée ; doublon | P2 | Web, Mob |
| [EXT-003](#ext-003) | Service muet : la source gardée avec son adresse | P2 | Web, Mob |
| [EXT-004](#ext-004) | « Garder comme source » et « documente… » | P2 | Web, Mob |
| [EXT-005](#ext-005) | Musique : préciser l'album par MusicBrainz | P3 | Web, Mob |
| [EXT-006](#ext-006) | Musique : nouvelles sorties | P3 | Web, Mob |
| [EXT-007](#ext-007) | Ciel : lieu, météo, sans lieu | P3 | Web, Mob, AND, IOS |
| [EXT-008](#ext-008) | Ciel vivant, saisons, givre | P3 | Web, Mob |
| [EXT-009](#ext-009) | Étoiles filantes, éclipses, pluie sur les tâches | P3 | Web, Mob |
| [EXT-010](#ext-010) | Radar culturel | P3 | Web, Mob |
| [EXT-011](#ext-011) | Import d'un export Instagram | P3 | Web, ART |
| [EXT-012](#ext-012) | Passeur : vérifier, identifiant, relais | P2 | Web |
| [EXT-013](#ext-013) | Dehors : suivre, lire, garder, marquer comme vu | P2 | Web, Mob |
| [EXT-014](#ext-014) | Veille de recherche et Artist Watch | P3 | Web |
| [EXT-015](#ext-015) | Calendrier dédié | P3 | Web, Mob |
| [EXT-016](#ext-016) | Zotero en lecture seule | P3 | Web |
| [EXT-017](#ext-017) | « Envoyer à Selene » : un lien venu d'ailleurs | P2 | Web, Mob, AND, IOS, WIN |
| [EXT-018](#ext-018) | Ce que tes sources ont en commun | P3 | Web |
| [EXT-019](#ext-019) | Dans l'artefact : les connexions absentes le disent | P3 | ART |
| [EXT-020](#ext-020) | Exporter ses sources en BibTeX et en CSL-JSON | P2 | Web, Mob |

Identifiants retirés : aucun.

---

<a id="ext-001"></a>
### EXT-001 — Source par DOI

- **Fonctionnalité et règle** : dans un module de Sources, coller un DOI ; « Chercher » complète titre, auteurs, revue et date par
  Crossref (sans clé), en un seul appel ; « Garder » ; statut de départ « À lire ».
- **Objectif, risque vérifié** : métadonnées fausses ; appels multiples ; DOI mal reconnu.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; supprimer la source « Depersonalization and the self » (pour éviter le doublon).
- **Données** : `https://doi.org/10.1016/j.concog.2020.102946`.
- **Automatisés associés** : `TN-sources`, `TU-SRC-02`, `TU-SRC-03`
- **Source** : [DOC] [connexions.md](../../connexions.md#phase-1--presque-gratuit-sans-intermédiaire-sans-compte), 5a ; [TEST] `tests/browser/sources.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Sources, coller les données dans « Un lien ou un DOI… », Entrée (ou « Chercher »). | « Recherche… » puis « Trouvée : « Depersonalization and the self » » ; un aperçu : titre, auteurs, revue « Consciousness and Cognition », année 2020 ; une seule requête vers `api.crossref.org`. |
| 2 | « Garder ». | « Gardée : « Depersonalization… » » ; la source apparaît au statut « À lire », avec son DOI ; le champ se vide ; le message propose « La relier à une idée ». |
| 3 | Cliquer « ouvrir ↗ » sur la source. | L'article s'ouvre dans un nouvel onglet. |

- **État final attendu** : la source à nouveau gardée.
- **Nettoyage** : aucun.

---

<a id="ext-002"></a>
### EXT-002 — Source par lien ; adresse nettoyée ; doublon

- **Fonctionnalité et règle** : une page est complétée par Microlink (ou le passeur, connectée) ; l'adresse est débarrassée des
  traceurs (`utm_*`, `fbclid`…) ; un doublon (même DOI ou même adresse) est reconnu.
- **Objectif, risque vérifié** : traceurs conservés ; sources en double.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : `https://fr.wikipedia.org/wiki/Lisi%C3%A8re?utm_source=recette&fbclid=abc` ; puis `https://doi.org/10.1016/j.concog.2020.102946`.
- **Automatisés associés** : `TN-sources`, `TU-SRC-01`
- **Source** : [DOC] [connexions.md](../../connexions.md#phase-1--presque-gratuit-sans-intermédiaire-sans-compte), 5a ; [TEST] `TU-SRC-01`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Coller la première adresse, « Chercher ». | Aperçu avec titre de la page et site ; l'adresse affichée n'a plus `utm_source` ni `fbclid`. |
| 2 | « Garder ». | Source gardée avec l'adresse nettoyée. |
| 3 | Coller le DOI du jeu d'essai, « Chercher ». | « Déjà gardée dans Sources : « Depersonalization… » » ; « Garder » est désactivé. |
| 4 | Coller `pas une adresse`. | « Ni lien ni DOI reconnu. Un lien commence par https://, un DOI par 10. » ; aucune requête. |

- **État final attendu** : une source de plus.
- **Nettoyage** : la supprimer.

---

<a id="ext-003"></a>
### EXT-003 — Service muet : la source gardée avec son adresse

- **Fonctionnalité et règle** : hors ligne ou quota épuisé (Microlink : 25 par jour sans clé), la source est gardée avec son
  adresse seule.
- **Objectif, risque vérifié** : un lien perdu parce que le service ne répond pas.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; bloquer `api.microlink.io` (et le passeur, s'il est utilisé) dans les outils de développement.
- **Données** : `https://exemple.org/article-recette-ext003`.
- **Automatisés associés** : `TN-sources`, `TU-SRC-04`
- **Source** : [DOC] [connexions.md](../../connexions.md#phase-1--presque-gratuit-sans-intermédiaire-sans-compte) ; [TEST] `tests/browser/sources.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Coller l'adresse, « Chercher ». | « Métadonnées indisponibles (hors ligne, service muet ou quota du jour atteint) : elle sera gardée avec son adresse seule. » |
| 2 | « Garder ». | La source est gardée, son titre est l'adresse. |

- **État final attendu** : une source minimale de plus.
- **Nettoyage** : la supprimer ; débloquer le domaine.

---

<a id="ext-004"></a>
### EXT-004 — « Garder comme source » et « documente… »

- **Fonctionnalité et règle** : une note de la boîte qui contient un lien ou un DOI devient une source d'un geste, avec sa
  provenance ; une source se relie à la note ou au fragment qu'elle documente, et apparaît en marge de celui-ci.
- **Objectif, risque vérifié** : lien perdu entre une idée et sa source (tâche 4 du test E2).
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; supprimer la source « Depersonalization and the self ».
- **Données** : note « À lire : https://doi.org/10.1016/j.concog.2020.102946 ».
- **Automatisés associés** : `TN-sources`, `TN-parcours-e2`, `TN-sources-oubliees`
- **Source** : [DOC] README, « Sources », « Sources oubliées » ; [TEST] `tests/browser/sources.js`, `tests/browser/parcours-e2.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dans la boîte, « Garder comme source » sur la note. | « Rangée dans Sources : « Depersonalization… » » ; la note quitte la boîte ; la source porte sa provenance. |
| 2 | Sur la source, « documente… » → « Le brouillard efface la route… ». | « Reliée. Elle apparaît en marge de ce qu'elle documente. » |
| 3 | Ouvrir Écriture. | Le fragment dit qui le documente (en marge, ou dessous). |
| 4 | Sur la source, « documente… » → le même fragment. | « Déjà reliée ainsi. » |

- **État final attendu** : source reliée.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="ext-005"></a>
### EXT-005 — Musique : préciser l'album par MusicBrainz

- **Fonctionnalité et règle** : dans une collection marquée « Musique », « préciser l'album » cherche l'artiste (choix en cas
  d'homonymie), puis sa discographie studio (albums et EP, sans live ni compilation) avec pochettes ; « choisir » ou
  « ajouter » ; une requête par seconde au plus ; une pochette absente s'efface.
- **Objectif, risque vérifié** : mauvais artiste ; quota de MusicBrainz dépassé (blocage).
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (Musique : « Kate Bush » sans album).
- **Données** : élément « Kate Bush ».
- **Automatisés associés** : `TN-musique`, `TU-MUS-01`, `TU-MUS-02`, `TU-MUS-03`
- **Source** : [DOC] README, « Musique et MusicBrainz » ; [TEST] `tests/browser/musique.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur « Kate Bush », « préciser l'album ». | Si plusieurs artistes : « Plusieurs artistes portent ce nom : » et une liste ; sinon directement la discographie. |
| 2 | Choisir Kate Bush (si demandé). | « Discographie studio (albums et EP) selon MusicBrainz… », du plus ancien au plus récent, pochettes affichées ou effacées (jamais d'icône cassée) ; aucun album live. |
| 3 | « choisir » sur « Hounds of Love ». | « « Hounds of Love » : c'est noté. » ; l'élément porte l'album, l'année et sa pochette dans la liste. |
| 4 | Dans Network, regarder les requêtes à `musicbrainz.org`. | Au moins une seconde entre deux requêtes. |

- **État final attendu** : Kate Bush relié à MusicBrainz.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="ext-006"></a>
### EXT-006 — Musique : nouvelles sorties

- **Fonctionnalité et règle** : « Nouvelles sorties » demande, à la demande seulement, ce que les artistes reliés ont publié
  depuis la dernière vérification (la première fois, l'année écoulée) ; jamais en arrière-plan.
- **Objectif, risque vérifié** : requêtes non demandées ; mêmes sorties signalées deux fois.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : EXT-005 joué (au moins un artiste relié).
- **Données** : aucune.
- **Automatisés associés** : `TN-musique`
- **Source** : [DOC] README, « Musique et MusicBrainz » ; [TEST] `tests/browser/musique.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Musique sans rien cliquer, regarder Network. | Aucune requête à MusicBrainz. |
| 2 | « Nouvelles sorties ». | La liste des parutions de l'année écoulée, ou « Rien de neuf. Le silence est aussi une nouvelle. » ; ce qui est déjà dans la liste est signalé. |
| 3 | Recommencer le même jour. | « Rien de neuf… ». |
| 4 | Bloquer `musicbrainz.org`, recommencer. | « MusicBrainz ne répond pas… » et « Réessayer ». |

- **État final attendu** : inchangé.
- **Nettoyage** : débloquer le domaine.

---

<a id="ext-007"></a>
### EXT-007 — Ciel : lieu, météo, sans lieu

- **Fonctionnalité et règle** : Réglages → Ciel et alentours : une ville ou la position de l'appareil, arrondies à une dizaine
  de kilomètres ; météo en direct (Open-Meteo, sans clé) ; sans lieu, l'heure est estimée d'après le fuseau, sans météo.
- **Objectif, risque vérifié** : position précise envoyée ; ciel faux.
- **Priorité** : P3 · **Plateformes** : Web, Mob, AND, IOS
- **Préconditions** : aucun lieu réglé.
- **Données** : ville `Lille`.
- **Automatisés associés** : `TN-fenetre`, `TU-SKY-05`, `TU-SKY-08`, `TU-CST-04`
- **Source** : [DOC] README, « Le ciel de l'accueil » ; [DOC] [android.md](../../android.md), [ios.md](../../ios.md) (« Ma position ») ;
  [TEST] `tests/browser/fenetre.js`, `TU-CST-04` (permissions déclarées par les apps).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Accueil sans lieu, regarder Network. | Aucune requête à Open-Meteo ; la lune à sa place d'origine, aucune heure affichée sous le ciel. |
| 2 | Réglages → Ciel et alentours : « Une ville… » = `Lille`, « Chercher », « Choisir » la bonne ligne. | « Lieu gardé. Le ciel de l'accueil est désormais celui d'ici. » ; coordonnées affichées au dixième de degré « arrondis à une dizaine de kilomètres ». |
| 3 | Revenir à l'accueil. | Une ligne de données sous le ciel (température, temps, vent) ; la requête à Open-Meteo porte des coordonnées au dixième. |
| 4 | « Utiliser ma position », refuser l'autorisation du navigateur. | « Position refusée ou indisponible. Une ville fera l'affaire. » |
| 5 | « retirer » le lieu. | « Lieu retiré : l'heure redevient estimée, sans météo. » |
| 6 | App Android ou iOS seulement (sinon : non applicable) : « Utiliser ma position », lire la demande d'autorisation du système, l'accepter. | Android : la demande porte sur la position **approximative** seule (jamais « précise », jamais « toute la journée ») ; sous Android 11 ou avant, la demande échoue et l'app propose une ville. iOS : la phrase d'explication de Selene, dans la langue du téléphone, pour « lorsque l'app est active ». Les coordonnées gardées sont au dixième de degré. |

- **État final attendu** : sans lieu.
- **Nettoyage** : aucun.

---

<a id="ext-008"></a>
### EXT-008 — Ciel vivant, saisons, givre

- **Fonctionnalité et règle** : le « Ciel vivant » (par appareil) anime nuages, brume, pluie ou neige au rythme du vent mesuré ;
  immobile si le système demande moins d'animations ; les feuillus suivent la saison (à l'envers au sud) ; le givre ne vient
  que d'une température mesurée sous zéro.
- **Objectif, risque vérifié** : animation imposée (accessibilité) ; givre inventé d'après le calendrier.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : EXT-007 étape 2 (Lille, météo active).
- **Données** : aucune.
- **Automatisés associés** : `TN-ciel-vivant`, `TN-saisons`, `TU-SKY-10`, `TU-SKY-11`, `TU-SKY-12`
- **Source** : [DOC] README, « Le ciel de l'accueil » ; [TEST] `tests/browser/ciel-vivant.js`, `tests/browser/saisons.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Ciel : cocher « Ciel vivant ». | Sur l'accueil, nuages (et pluie s'il pleut) bougent dans le sens du vent indiqué par la ligne de données ; la mention « cet appareil » est sur ce réglage. |
| 2 | Activer « Réduire les animations » du système (macOS : Accessibilité → Affichage ; outils Chrome : Rendering → `prefers-reduced-motion: reduce`). | Le ciel s'immobilise. |
| 3 | Regarder les feuillus de la lisière. | Leur état correspond à la saison de Lille (en octobre : rouille). |
| 4 | Si la température mesurée est positive : regarder les cimes. | Pas de givre. |

- **État final attendu** : ciel vivant activé.
- **Nettoyage** : le décocher ; rétablir les animations.

---

<a id="ext-009"></a>
### EXT-009 — Étoiles filantes, éclipses, pluie sur les tâches

- **Fonctionnalité et règle** : une ligne sous le ciel la veille et le soir d'une grande pluie d'étoiles filantes (partout), ou
  dans la semaine d'une éclipse visible depuis Lille et ses environs (table fixe jusqu'en 2030, sans réseau) ; une tâche à
  ciel ouvert (« balcon », « jardin »… dans le titre ou le lieu) montre la pluie prévue sur cinq jours.
- **Objectif, risque vérifié** : annonce fausse ou hors zone ; appel météo supplémentaire.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : EXT-007 étape 2 ; jeu d'essai (« Repeindre la rambarde du balcon », « Nettoyer les gouttières du
  jardin », « Poser une étagère » au Salon).
- **Données** : pour les étoiles filantes, régler la date de l'appareil au 12 décembre (veille des Géminides).
- **Automatisés associés** : `TN-ciel-chantier`, `TU-SKY-13`, `TU-SKY-14`, `TU-SKY-15`
- **Source** : [DOC] README, « Ciel et chantier » ; [DOC] [connexions.md](../../connexions.md), 5c ; [TEST] `tests/browser/ciel-chantier.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Chantier. | Sous « Repeindre la rambarde du balcon » et « Nettoyer les gouttières du jardin » : « pluie prévue … » ou « sec jusqu'à … » ; rien sous « Poser une étagère » ; une seule requête Open-Meteo pour le ciel et ces prévisions. |
| 2 | « régler » Chantier : la ligne « Tâches à ciel ouvert (mots…) » propose des mots par défaut ; y ajouter `salon`. | « Poser une étagère » montre aussi la prévision. |
| 3 | Date de l'appareil au 12 décembre, accueil. | Une ligne sur les Géminides (taux théorique et réserve sur la lune et la ville). |
| 4 | Lieu réglé à `Marseille`, date de l'appareil sept jours avant une éclipse de la table (par exemple le 5 août 2026). | Aucune ligne d'éclipse depuis Marseille (la table ne vaut que pour Lille et ses environs). |

- **État final attendu** : mots « à ciel ouvert » modifiés.
- **Nettoyage** : retirer `salon` ; remettre la date automatique et le lieu Lille.

---

<a id="ext-010"></a>
### EXT-010 — Radar culturel

- **Fonctionnalité et règle** : Réglages → Radar culturel, quelques mots ; sur l'accueil, à la demande, cinq événements au plus
  autour du lieu du ciel (OpenAgenda) dans les deux semaines ; le portail voit la zone et les dates, jamais les mots (le tri
  se fait sur l'appareil) ; « garder » dépose un événement dans la boîte.
- **Objectif, risque vérifié** : mots de la personne envoyés au portail ; requêtes non demandées.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : lieu réglé (Lille) ; connectée si la lecture directe est refusée (le passeur relaie).
- **Données** : mots `concert, poésie, exposition`.
- **Automatisés associés** : `TN-radar`, `TU-RAD-01`, `TU-RAD-02`, `TU-RAD-03`
- **Source** : [DOC] README, « Radar culturel » ; [DOC] [connexions.md](../../connexions.md), 5d ; [TEST] `tests/browser/radar.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sans mots : accueil. | Pas de bouton « Radar culturel ». |
| 2 | Réglages : saisir les mots, quitter le champ ; accueil. | Le bouton « Radar culturel » apparaît ; aucune requête tant qu'on ne clique pas. |
| 3 | Cliquer le bouton. | « Recherche… » puis cinq événements au plus, du plus tôt au plus tard, avec date et lieu ; le reste compté (« N autres correspondent aussi… ») ; la requête (à `opendatasoft.com` ou au passeur) ne contient pas `concert`, `poésie` ni `exposition`. |
| 4 | « garder » sur un événement. | « Gardé dans Boîte. » ; une note avec titre, date, lieu et lien. |
| 5 | Rouvrir le radar dans l'heure. | Servi sans nouvelle requête (cache de l'appareil). |

- **État final attendu** : une note de plus.
- **Nettoyage** : la supprimer ; effacer les mots.

---

<a id="ext-011"></a>
### EXT-011 — Import d'un export Instagram

- **Fonctionnalité et règle** : dans les réglages de toute collection, « Importer un export Instagram » (fichiers JSON) ; lu sur
  l'appareil, rien n'est envoyé ; confirmation (combien, de quand à quand, où) ; chaque publication devient un élément au
  dernier statut ; encodage de Meta réparé ; un second import n'ajoute que les nouvelles.
- **Objectif, risque vérifié** : texte abîmé (« Ã© ») ; doublons ; script exécuté depuis une légende.
- **Priorité** : P3 · **Plateformes** : Web, ART
- **Préconditions** : jeu d'essai.
- **Données** : [`donnees/instagram-posts_1.json`](../donnees/instagram-posts_1.json) et [`donnees/instagram-reels.json`](../donnees/instagram-reels.json)
  (trois publications synthétiques, dont une légende piégée) ; un fichier `photo.json` qui n'est pas du JSON.
- **Automatisés associés** : `TN-instagram`, `TU-IG-01`, `TU-IG-02`, `TU-IG-03`
- **Source** : [DOC] README, « Mémoire éditoriale » ; [DOC] [connexions.md](../../connexions.md), 5e ; [TEST] `tests/browser/instagram.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → « régler » Tableau → « Importer un export Instagram » ; choisir les deux fichiers ensemble ; regarder Network. | Confirmation « Importer 3 publications (du 14 septembre 2025 au 21 juin 2026) dans Tableau, au statut « Publié » ? » ; aucune requête réseau. |
| 2 | « Annuler ». | Rien n'est versé. |
| 3 | Recommencer et confirmer. | « 3 publications importées dans Tableau. » ; dans Tableau, colonne Publié : « Phalène du bouleau 🌙 » (accents et émoji justes), « Trois ailes <img…> » affiché comme du texte (aucune alerte), « Reel du 2026-06-21 ». |
| 4 | Réimporter les mêmes fichiers. | « Rien de nouveau : tout est déjà là. » |
| 5 | Importer `photo.json`. | « Ce fichier n'est pas un export Instagram lisible (JSON). » |
| 6 | Ouvrir l'accueil. | Ces publications passées ne deviennent pas des rappels dans « Aujourd'hui ». |

- **État final attendu** : trois éléments de plus dans Tableau.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="ext-012"></a>
### EXT-012 — Passeur : vérifier, identifiant, relais

- **Fonctionnalité et règle** : le passeur (fonction Supabase) lit pages, flux et calendriers que le navigateur ne peut pas
  lire ; fermé aux comptes de `PASSEUR_USERS`, protégé contre la SSRF ; Réglages → Connexions → Passeur : état, « Vérifier »,
  identifiant à copier ; absent ou refusé, Microlink prend le relais sans insister.
- **Objectif, risque vérifié** : passeur ouvert à tout le monde ; app bloquée quand il manque.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : connectée au compte A listé dans `PASSEUR_USERS` ; puis au compte B non listé.
- **Données** : page `https://www.cnrtl.fr/definition/lisière` dans Sources.
- **Automatisés associés** : `TN-passeur`, `TD-PAS-01`, `TD-PAS-02`, `TD-PAS-03`, `TD-PAS-04`, `TD-GAR-01`, `TD-GAR-02`
- **Source** : [DOC] [passeur.md](../../passeur.md) ; [TEST] `tests/browser/passeur.js`, `TD-PAS-*`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Compte A : Réglages → Connexions → Passeur → « Vérifier ». | « Passeur : il répond, et il te reconnaît. » ; l'identifiant du compte est affiché, « copier » → « Identifiant copié. » |
| 2 | Sources : chercher la page des données. | Une requête vers la fonction `passeur` (avec la session), aucune vers Microlink ; titre et site remplis. |
| 3 | Compte B : « Vérifier ». | « Refusé à ce compte : son identifiant n'est pas dans PASSEUR_USERS, ou cette adresse n'est pas admise. » |
| 4 | Compte B : chercher la même page. | Microlink prend le relais ; l'aide le dit ; une seule tentative vers le passeur. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="ext-013"></a>
### EXT-013 — Dehors : suivre, lire, garder, marquer comme vu

- **Fonctionnalité et règle** : les flux suivis, rangés par projet ; seulement le nouveau depuis la dernière visite, douze au
  plus, d'abord ce qui croise ce que la personne garde, avec la raison en toutes lettres ; « garder » en fait une source, « vers
  une note », « vu » ; « Tout marquer comme vu » ; sur l'accueil, une ligne de texte s'il y a du nouveau, jamais de pastille ;
  relecture au plus toutes les trois heures.
- **Objectif, risque vérifié** : fil infini, notifications intrusives, élément revenu après « vu ».
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : connectée, passeur ouvert au compte.
- **Données** : adresse de site `https://www.inrae.fr` (ou toute revue qui annonce un flux) ; projet `Écriture`.
- **Automatisés associés** : `TN-dehors`, `TN-dehors-croise`, `TU-DEH-01`, `TU-DEH-02`, `TU-DEH-03`
- **Source** : [DOC] README, « Dehors » ; [DOC] [connexions.md](../../connexions.md), 6b et 7c ; [TEST] `tests/browser/dehors.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Navigation → « Nouveautés · Dehors ». | « Aucun flux suivi… » et le champ « L'adresse d'un site ou d'un flux… ». |
| 2 | Coller l'adresse, choisir le projet, « Suivre ». | « Suivi : … » ; les éléments de la semaine écoulée, douze au plus, du plus récent au plus ancien (ou par raison de croisement), rangés sous le projet ; « Et N autres, qui attendront. » s'il y en a plus. |
| 3 | « garder » sur un élément. | Il devient une source (provenance « Dehors ») et quitte Dehors. |
| 4 | « vu » sur un autre. | Il disparaît. |
| 5 | Accueil. | Une ligne « Dehors : N nouveautés » s'il en reste ; aucune pastille numérique dans la navigation. |
| 6 | « Tout marquer comme vu ». | « Tout est vu. Dehors se tait jusqu'à la prochaine parution. » ; l'accueil se tait. |
| 7 | Recoller la même adresse. | « Ce flux est déjà suivi. » |

- **État final attendu** : un flux suivi, une source de plus.
- **Nettoyage** : « retirer » le flux (confirmer « Ne plus suivre « … » ? ») ; supprimer la source.

---

<a id="ext-014"></a>
### EXT-014 — Veille de recherche et Artist Watch

- **Fonctionnalité et règle** : dans Dehors, « Veille de recherche » (recherches, ORCID, OpenAlex), une fois par semaine ;
  « garder » crée une source avec DOI et provenance « Veille : … » ; clé OpenAlex facultative, gardée dans ce navigateur,
  jamais synchronisée ; Artist Watch : les sorties des artistes reliés à MusicBrainz, une fois par semaine.
- **Objectif, risque vérifié** : clé envoyée au compte ; requêtes trop fréquentes.
- **Priorité** : P3 · **Plateformes** : Web
- **Préconditions** : connectée ; un artiste relié (EXT-005).
- **Données** : recherche `forest edge ecology`.
- **Automatisés associés** : `TN-veille`, `TN-artist-watch`, `TU-VEI-01`, `TU-VEI-02`, `TU-VEI-03`
- **Source** : [DOC] README, « Dehors » ; [DOC] [connexions.md](../../connexions.md), 6c et 6d ; [TEST] `tests/browser/veille.js`, `tests/browser/artist-watch.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dehors → « Veille de recherche » : saisir la recherche, « Veiller ». | « En veille : forest edge ecology. Première lecture… » ; des articles du mois écoulé avec revue, auteurs et résumé ; une requête à `api.openalex.org` sans `api_key`. |
| 2 | « garder » sur un article. | Une source avec DOI, revue, auteurs et provenance « Veille : forest edge ecology ». |
| 3 | Saisir une clé OpenAlex de test dans « Clé OpenAlex (facultative) ». | « Clé OpenAlex gardée dans ce navigateur. » ; exporter une sauvegarde : la clé n'y est pas. |
| 4 | Cocher « Les sorties de mes artistes… ». | Une requête par artiste relié, une seconde d'écart ; les sorties du mois écoulé, avec « ajouter à Musique ». |
| 5 | Rouvrir Dehors dans la semaine. | Ni OpenAlex ni MusicBrainz ne sont redemandés (sauf « Relire maintenant »). |

- **État final attendu** : une veille, Artist Watch activé.
- **Nettoyage** : arrêter la veille ; décocher Artist Watch ; supprimer la source ; « oublier » la clé.

---

<a id="ext-015"></a>
### EXT-015 — Calendrier dédié

- **Fonctionnalité et règle** : l'adresse iCal secrète d'un calendrier « Selene », gardée dans ce navigateur seulement (jamais
  synchronisée, jamais réaffichée, effacée à la déconnexion) ; lue par le passeur au plus une fois par heure ; aujourd'hui et
  demain s'affichent sous « Aujourd'hui » ; « Chantier : plombier » se range sous Chantier.
- **Objectif, risque vérifié** : adresse secrète synchronisée ou affichée ; événement passé encore montré.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : connectée, passeur ouvert ; un calendrier Google ou Apple de recette avec, aujourd'hui dans plus d'une
  heure, l'événement `Chantier : plombier`, et demain un événement d'une journée entière `Marché`.
- **Données** : l'adresse iCal secrète du calendrier (Google : « Adresse secrète au format iCal » ; Apple : lien `webcal://`).
- **Automatisés associés** : `TN-agenda`, `TU-AGD-01`, `TU-AGD-02`
- **Source** : [DOC] README, « Calendrier dédié » ; [DOC] [connexions.md](../../connexions.md), 6e ; [TEST] `tests/browser/agenda.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Connexions → Calendrier : coller l'adresse. | « Adresse gardée dans ce navigateur. Lecture… » puis « Lu … : N événements à venir ou récurrents. » ; l'adresse n'est plus affichée dans le champ. |
| 2 | Accueil. | Sous « Aujourd'hui » : « plombier » à son heure, rangé sous Chantier ; « Demain » : « Marché », journée entière. |
| 3 | Exporter une sauvegarde, y chercher l'adresse. | Absente. |
| 4 | « oublier ». | « Calendrier oublié sur cet appareil. » ; l'accueil ne montre plus le calendrier. |

- **État final attendu** : aucun calendrier.
- **Nettoyage** : supprimer les événements de recette.

---

<a id="ext-016"></a>
### EXT-016 — Zotero en lecture seule

- **Fonctionnalité et règle** : Réglages → Zotero : une clé créée sur zotero.org avec « Allow library access » seulement ; dans
  ce navigateur, jamais synchronisée ; « Vérifier » dit à qui elle est et signale une clé qui peut écrire ; dans un module de
  Sources, chercher ou voir les dix dernières fiches ; « garder » crée une Source reliée à sa fiche ; doublons reconnus.
- **Objectif, risque vérifié** : clé à droits d'écriture acceptée sans alerte ; doublons.
- **Priorité** : P3 · **Plateformes** : Web
- **Préconditions** : un compte Zotero de recette avec deux fiches (un article à DOI, un livre sans DOI) ; une clé en lecture
  seule et une clé avec écriture.
- **Données** : recherche `lisière` (ou un mot du titre des fiches).
- **Automatisés associés** : `TN-zotero`, `TU-ZOT-01`, `TU-ZOT-02`, `TU-ZOT-03`
- **Source** : [DOC] README, « Zotero » ; [DOC] [connexions.md](../../connexions.md), 6f ; [TEST] `tests/browser/zotero.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Coller la clé en lecture seule, « Vérifier ». | « Bibliothèque de …, en lecture seule. » ; la clé n'est plus affichée. |
| 2 | Sources → « Chercher dans Zotero » : la recherche des données. | Les fiches de la bibliothèque (pièces jointes écartées). |
| 3 | « garder » sur le livre sans DOI. | « Gardée, reliée à Zotero : « … » » ; un lien « Zotero ↗ » vers la fiche ; refaire « garder » : « déjà gardée ». |
| 4 | « récents ». | Les dix dernières fiches ajoutées. |
| 5 | Coller la clé avec écriture, « Vérifier ». | « Bibliothèque de … : attention, cette clé peut écrire ; une clé en lecture seule suffit. » |

- **État final attendu** : une source reliée à Zotero.
- **Nettoyage** : « oublier » la clé ; supprimer la source ; révoquer les clés de recette.

---

<a id="ext-017"></a>
### EXT-017 — « Envoyer à Selene » : un lien venu d'ailleurs

- **Fonctionnalité et règle** : un lien lu ailleurs arrive dans la boîte de réception : `?url=&title=&text=` à l'ouverture,
  menu « Partager » d'Android, favori « Envoyer à Selene », Raccourci iOS, liens `selene://share` ; sur la version hébergée,
  le lien attend la connexion avant d'être déposé ; une seule fois.
- **Objectif, risque vérifié** : lien perdu ou déposé deux fois.
- **Priorité** : P2 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : jeu d'essai ; pour l'étape 4, déconnectée.
- **Données** : `index.html?url=https%3A%2F%2Fexemple.org%2Flisiere%3Futm_source%3Dx&title=Lisi%C3%A8re` ajouté à l'adresse du site.
- **Automatisés associés** : `TN-sources`, `TN-bureau`, `TU-NAT-07`
- **Source** : [DOC] README, « Envoyer à Selene » ; [DOC] [connexions.md](../../connexions.md), 5a ; [TEST] `tests/browser/sources.js`, `TU-NAT-07`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'adresse des données. | « Reçu dans Boîte : « Garder comme source » le complétera. » ; une note avec le titre et l'adresse nettoyée ; l'adresse de la page ne contient plus `?url=`. |
| 2 | Recharger. | Le lien n'est pas déposé une seconde fois. |
| 3 | Réglages → Connexions : cliquer le bouton « Envoyer à Selene » dans Selene. | Une explication (« Glisse ce bouton dans la barre de favoris… ») au lieu d'une action. |
| 4 | Déconnectée (écran d'entrée), ouvrir l'adresse des données ; puis se connecter. | Rien n'est déposé avant la connexion ; après, la note arrive dans la boîte. |

- **État final attendu** : une note de plus.
- **Nettoyage** : la supprimer.

---

<a id="ext-018"></a>
### EXT-018 — Ce que tes sources ont en commun

- **Fonctionnalité et règle** : à la demande, dans un module de Sources (dès deux sources à DOI) : d'après OpenAlex, les textes
  cités par plusieurs sources, les sources qui citent les mêmes textes, les auteurs qui reviennent ; OpenAlex ne reçoit que les
  DOI ; le résultat reste sur l'appareil.
- **Objectif, risque vérifié** : titres ou notes envoyés à OpenAlex ; suggestions qui incluent ses propres sources.
- **Priorité** : P3 · **Plateformes** : Web
- **Préconditions** : jeu d'essai ; ajouter une seconde source à DOI (EXT-001 avec `10.1038/nrn2575`).
- **Données** : aucune de plus.
- **Automatisés associés** : `TN-cites`, `TU-VEI-04`, `TU-VEI-05`, `TU-VEI-06`
- **Source** : [DOC] README, « Ce que tes sources ont en commun » ; [DOC] [connexions.md](../../connexions.md), 7b ; [TEST] `tests/browser/cites.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Sources, regarder Network. | Le bouton « Ce que tes sources ont en commun » ; aucune requête à OpenAlex. |
| 2 | Cliquer le bouton. | « Lecture des bibliographies de tes sources… » puis « OpenAlex connaît N de tes 2 sources à DOI. » ; les requêtes ne contiennent que des DOI. |
| 3 | Lire les sections. | « Cité par plusieurs de tes sources », « Tes sources qui se parlent », « Ces auteurs reviennent », ou « Rien en commun pour l'instant… » ; tes propres sources n'y figurent pas comme suggestions. |

- **État final attendu** : inchangé.
- **Nettoyage** : supprimer la seconde source.

---

<a id="ext-019"></a>
### EXT-019 — Dans l'artefact : les connexions absentes le disent

- **Fonctionnalité et règle** : l'artefact claude.ai ne sort pas : pas de Dehors, de passeur, de Zotero, de calendrier ; les
  Réglages disent où vivent ces connexions ; le radar dit ce qui manque.
- **Objectif, risque vérifié** : bouton qui échoue sans explication.
- **Priorité** : P3 · **Plateformes** : ART
- **Préconditions** : `selene.html` ouvert comme artefact dans claude.ai.
- **Données** : aucune.
- **Automatisés associés** : `TN-dehors`, `TN-passeur`, `TN-zotero`, `TN-reglages`, `TN-radar`
- **Source** : [DOC] [connexions.md](../../connexions.md) ; [TEST] les scénarios cités, partie « artefact ».

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Connexions. | « Les connexions (Envoyer à Selene, Zotero, le passeur, le calendrier) vivent dans la version web ou l'app installée. L'artefact claude.ai s'en passe. » |
| 2 | Ouvrir l'adresse de Dehors (si atteignable). | Retour à l'accueil. |
| 3 | Radar (mots et lieu réglés). | « L'agenda ne se laisse pas lire directement par le navigateur : il faut ton passeur (version hébergée, connectée). » |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="ext-020"></a>
### EXT-020 — Exporter ses sources en BibTeX et en CSL-JSON

- **Fonctionnalité et règle** : sous le filtre d'un module de Sources, « Exporter en BibTeX » (`.bib`, pour LaTeX, BibTeX ou
  biblatex) et « CSL-JSON » (`.csl.json`, pour Zotero, Zettlr ou Pandoc) : tout l'espace, quel que soit le filtre ; rien
  ne part vers un service. L'étiquette donne le genre (article, livre, page…), les auteurs sont redécoupés, la clé de
  citation est lisible, les caractères de LaTeX échappés. Un nom d'un seul mot est lu comme une institution (limite
  documentée).
- **Objectif, risque vérifié** : des sources enfermées dans Selene ; un fichier que LaTeX ou Zotero ne lit pas (accolade
  déséquilibrée, caractère non échappé) ; un export amputé par le filtre affiché.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (Sources : « Depersonalization and the self », article avec DOI ; « La forêt, lieu commun »,
  page) ; pour l'étape 5, Zotero installé sur l'ordinateur de recette (sinon : étape non applicable).
- **Données** : aucune autre.
- **Automatisés associés** : `TN-sources`, `TU-BIB-01`, `TU-BIB-02`, `TU-BIB-03`, `TU-BIB-04`, `TU-BIB-05`
- **Source** : [DOC] [connexions.md](../../connexions.md), 7f ; [TEST] `tests/biblio.test.js`, `tests/browser/sources.js` ; résultats
  des étapes 2 et 3 calculés avec `src/core/biblio.js` sur le jeu d'essai.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Sources ; filtre « Lue ». | Seule « La forêt, lieu commun » est listée ; à côté du filtre, les boutons « Exporter en BibTeX » et « CSL-JSON ». |
| 2 | « Exporter en BibTeX » ; ouvrir le fichier dans un éditeur de texte. | Fichier `sources-<J>.bib`, **deux** entrées malgré le filtre : `@article{ciaunica2020depersonalization,` avec `author = {{Ciaunica} and {Charlton} and {Farmer}}`, `journal = {Consciousness and Cognition}`, `year = {2020}`, `doi = {10.1016/j.concog.2020.102946}` (sans `url`) ; puis `@misc{foret2025,` avec `howpublished = {exemple.org}`, `month = nov`, `url = {https://exemple.org/foret}`, `urldate = {2026-08-05}`. |
| 3 | « CSL-JSON » ; ouvrir le fichier. | Fichier `sources-<J>.csl.json` : un tableau de deux objets, `"type": "article-journal"` avec `"DOI"`, puis `"type": "webpage"` avec `"URL"` et `"accessed"`. |
| 4 | Network pendant les deux exports. | Aucune requête : tout se fait sur l'appareil. |
| 5 | Zotero : Fichier → Importer… → le fichier `.csl.json`. | Deux documents importés, un article de revue et une page web, titres intacts (accents compris). |
| 6 | Supprimer les deux sources ; regarder la barre du filtre. | Les boutons d'export disparaissent (rien à exporter). |

- **État final attendu** : Sources vide ; deux fichiers téléchargés.
- **Nettoyage** : réimporter le jeu d'essai ; supprimer les fichiers téléchargés (et l'import Zotero).
