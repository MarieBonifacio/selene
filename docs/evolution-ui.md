# Évolution de l'interface : le « Cabinet nocturne »

Plan validé pour faire évoluer l'interface, la navigation et l'apparence de Selene **sans refonte gratuite** :
garder ce qui a une identité, raffiner ce qui est faible, retirer ce qui fait du bruit. Ce document est la
référence des chantiers d'interface ; chaque vague se coche ici au fil des livraisons. Il ne décrit pas le
fonctionnement interne (voir [architecture.md](architecture.md)).

> L'application doit être belle parce que sa structure, ses proportions et ses interactions sont justes,
> pas parce qu'on lui a ajouté vingt effets décoratifs.

## Ce qu'on garde

- **La scène** : la lune réelle au-dessus d'une lisière de sapins, un halo qui suit déjà la phase. C'est le totem.
- **Les palettes alchimiques** (nigredo, albedo, citrinitas, rubedo : mousse, lichen, résine, amanite).
- **La mise en page éditoriale** : des listes à filets plutôt que des cartes ; l'accueil est un sommaire, pas un tableau de bord.
- **La sobriété** : rayons de 2 à 3 px, pas d'ombres portées, pas d'emoji.
- **La microcopie cynique**, qui change seulement de place (voir Règles).
- **Le filet de marge** (bordure gauche en couleur d'accent : pont de reprise, dérivation, statut, message de l'assistant),
  désormais une règle du système : il signifie « actif, sélectionné, en cours ».
- **Les mécanismes de reprise** (pont, brouillons, paysage réduit), à mettre en scène.

## Ce qu'on corrige

1. Navigation plate et instable : jusqu'à 12 onglets de même rang dans un bandeau qui défile sans le dire,
   en haut de l'écran, non collant ; le Bilan n'y figure pas.
2. Sur iPhone, ≈ 500 pt avant « Aujourd'hui » au premier lancement, et **la lune hors cadre** (le SVG en
   `xMidYMax slice` ne garde que x ≈ 256 → 744 à 390 × 240 pt ; la lune est à x ≈ 790).
3. Une seule voix typographique : données, actions et prose se ressemblent.
4. Actions répétées sur chaque ligne (`suppr.`, `modifier`, `dériver`, `lier…`) : bruit constant.
5. Collisions sémantiques : accent, succès, étiquettes et « bientôt » tous en vert.
6. Pertes de contexte : « ouvrir » mène en haut du module, « régler » exile dans une page Réglages géante,
   chaque changement de route remet le défilement à zéro.
7. Formulaires : champs à ≈ 15 px (le `label` est à .88rem et les champs héritent), donc zoom d'iOS au focus.
8. La richesse du système de connaissance (provenance, statut épistémique, liens, motifs) écrasée en méta de 14 px.

## Principes

1. **La structure d'abord.** Le décor n'occupe que le ciel et les marges ; le reste est papier, encre et filets.
2. **Une seule scène.** La lisière est le seul élément illustré.
3. **Le XIXe siècle par la composition, jamais par la texture** : petites capitales, planches numérotées,
   filets, dates en marge, italique « nom latin », hachures. Ni parchemin, ni sceau de cire.
4. **Une étrangeté par écran, au plus.**
5. **Le contemporain par l'interaction** : sheets, palette de commandes, verre fumé, transitions précises.
6. **Stabilité topologique** : les repères ne bougent jamais, seul le contenu change.
7. **L'environnement change, l'interface reste** : seuls les jetons de scène varient avec le temps.
8. **Le mot courant d'abord, le nom de Selene en second** (U5 de l'audit) : « Nouveautés · Dehors », « Trier la
   boîte · Vasculum », « depuis la nouvelle lune » plutôt que « cette lunaison ». Le nom propre reste, en italique
   et en retrait (`.aka`) ; le lexique des Réglages (Aide) les explique tous. Les origines enregistrées dans les
   données (`origin.from` : « Dehors », « Veille ») ne changent pas : ce sont des valeurs, pas des libellés.

## Architecture de navigation

Trois strates, aujourd'hui confondues :

| Strate | Contenu | Rôle |
|---|---|---|
| Lentilles | Aujourd'hui (accueil), Bilan, Chercher, Motifs | regarder à travers les espaces |
| Espaces | les modules, regroupés en **domaines** (champ facultatif `group` dans `config.modules`) | travailler dans un contexte |
| Système | Réglages, Assistant, Compte, Sauvegarde | régler l'outil |

- **iPhone** : barre basse à cinq destinations fixes (Aujourd'hui · Espaces · ⊕ Capturer · Chercher · Bilan),
  header compact collant (sigil, nom, ⋯), grand titre qui se replie au défilement. L'en-tête de l'app tient sur
  une ligne (lune, Selene, date ; 60 px, 7 % d'un écran de 844 px, contre 121 avant : U4 de l'audit) : le minuteur
  n'y paraît qu'entamé (temps restant, Pause ou Reprendre, ↺) ; au repos, il se lance depuis la feuille Capturer, la
  palette ou un appui long sur la lune (`tests/browser/en-tete.js`). Capturer est toujours au
  centre (jamais contextuel). Espaces ouvre une sheet : trois récents, domaines, pastilles, ponts ouverts,
  Réglages en pied. *Envisagé, absent du code* : deux touchers de suite qui rouvrent le dernier espace.
  Écartés : bouton flottant, glisser entre espaces. Glisser une ligne : P3, jamais le seul chemin.
- **Desktop** : barre latérale de 232 px (lentilles, domaines, système), palette `⌘K` ou `Ctrl+K` (aller, créer,
  chercher, minuteur), `Échap`. Actions de ligne au survol, aperçu des liens au survol. *Envisagés, absents du code*
  (contradiction C3 du cahier de recette) : la barre repliable en rail de sigils, un panneau de détail à droite, `/`
  pour la palette, les raccourcis `c`, `t`, `g a|b|r`, `j`/`k`, `x`, `e`, `?`.
- **Liens profonds** `#module/entrée` : défilement, surlignage, retour contextuel (« ‹ Recherche « lune » »)
  qui rend la liste et la position. Indispensable en PWA iOS (pas de bouton retour).
- **Mémoire du défilement** par route, pour la session.
- **Réglages contextuels** : les réglages d'un module s'ouvrent dans un tiroir depuis le module ; la page
  Réglages garde l'apparence, les espaces, l'assistant, le compte, la sauvegarde.

## Anatomie d'un écran d'espace

1. En-tête : sigil, `PL. III` en petites capitales, nom en Cormorant, sous-titre en italique, action principale, ⋯.
2. Pont de reprise (filet de marge). « Je m'arrête ici… » passe dans ⋯ et dans la fin du minuteur.
3. Saisie propre au type.
4. Corps : liste, calendrier, kanban, registre.
5. Marge (aside) : regroupements, projections ; section repliée « Détails » sur mobile.

**Accueil** : Reprendre (si pertinent) → Aujourd'hui (tâches puis rappels regroupés par espace) → Capturer
(desktop ; le ⊕ sur mobile) → Sommaire des espaces par domaine. Au retour dans la journée, le ciel devient
le fond de l'en-tête.

**Entrée universelle** : toute entrée (tâche, fragment, note, élément, opération) s'ouvre dans la même fiche.

## Système visuel

### Typographie : trois voix

| Voix | Police | Usage exclusif |
|---|---|---|
| Display | Cormorant Garamond 500/600 | noms d'espaces, h1/h2, phase, gros chiffres de synthèse |
| Texte | Spectral 400/500 + italique | fragments, notes, microcopie, citations |
| Étiquette | Spectral SC | `PL. III`, domaines, dates suspendues, en-têtes de colonnes |
| Fonctionnel | IBM Plex Sans 400/500 | navigation, boutons, champs, méta chiffrée, pastilles, minuteur |

Échelle en rapport 1,25 : 12 · 13,5 · 15 · 17 · 21 · 27 · 34 · 44–56. Chiffres `tabular-nums lining-nums`
pour les données, `oldstyle-nums` dans la prose. Champs à 16 px au moins sur écran tactile. Italique
réservée aux sous-titres, citations et microcopie.

### Couleurs

Règle d'or : **l'accent décore et oriente, les couleurs sémantiques informent ; elles ne se prêtent jamais
leurs teintes.** Une couleur ne porte jamais seule un sens : toujours doublée d'une forme, d'un mot ou d'une position.

| Rôle | Jeton | Nocturne (sombre) | Planche (clair) |
|---|---|---|---|
| Page | `--bg` | `#0e1310` | `#e2e6de` (vers `#ebe8de`, papier d'herbier) |
| Surface 1 | `--surface` | `#151c17` | `#edf0e9` |
| Surface 2 | `--surface-2` | `#1a231d` | `#f4f2ea` |
| Verre fumé | `--glass` | `rgba(14,19,16,.78)` + flou | `rgba(226,230,222,.8)` + flou |
| Encre | `--ink` / `--ink-2` | `#dde2d6` / `#b4bdb0` | `#1a211b` / `#394237` |
| Muet | `--muted` | `#8c998a` | `#5b6859` |
| Filet décoratif | `--rule` | `#243029` | `#c1c9bc` |
| Filet de composant (≥ 3:1) | `--rule-strong` | `#56665a` | `#75816f` |
| Succès | `--ok` | `#6fb3a2` vert-de-gris | `#2f6f62` |
| Bientôt | `--warn` | `#d2a24c` résine | `#7d5a12` |
| Retard, erreur | `--alarm` | `#e5785a` cinabre | `#a8431f` |
| Info | `--info` | `#8fa9c0` ardoise | `#3f5d78` |
| Ornement | `--bronze` | `#a88a5a` | `#8a6d3b` |

Étiquettes : encre secondaire précédée d'un point de couleur. Graphiques : huit teintes minérales à luminance
égale, doublées de plein / hachuré / pointillé. Limite connue : en citrinitas l'accent est proche de la
résine, en rubedo du cinabre ; le mot et la graisse portent alors le sens.

### Matière

- Grain statique à 2–3 % sur `--bg` seulement.
- Élévation sombre : surface plus claire et liseré `inset 0 1px 0 rgba(255,255,255,.04)`.
- Voile des dialogues vert-noir flouté (l'ancien était violacé).
- Le bas du ciel se fond dans la page par la brume, sans bordure.

### Règles

1. Un bouton primaire par écran ; trois niveaux (primaire accent, secondaire filet, tertiaire texte).
2. Le filet de marge est le seul signe de « actif / sélectionné / en cours ».
3. **Plein = constaté, hachuré = estimé, pointillé = hypothétique ou lié.**
4. Cartes pour ce qui se déplace (kanban), filets pour ce qui se lit.
5. Une étrangeté par écran.
6. Le temps ne touche que la scène.
7. Cibles tactiles de 44 pt ; focus toujours visible ; `prefers-reduced-motion` respecté ; texte ≥ 4,5:1, composants ≥ 3:1.
8. États vides : **constat → action → au plus une ligne d'esprit.**
9. Microcopie : l'humour va dans les toasts, les états vides et les premières fois ; les indications sous les
   titres se masquent en densité compacte (une blague lue 300 fois devient du papier peint).
10. Statut épistémique codé par la forme : observé ●, hypothèse ◌, interprétation ◐, inexpliqué ○ pointé.

### Jetons

```css
--s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --s-7:48px; --s-8:64px;
--r-0:0; --r-1:3px; --r-sheet:12px;
--b-hair:1px solid var(--rule); --b-ctl:1px solid var(--rule-strong); --b-mark:2px solid var(--accent);
--ease:cubic-bezier(.2,0,0,1); --t-1:120ms; --t-2:180ms; --t-3:260ms; --t-4:400ms;
```

## Mouvement

Une courbe, quatre durées, aucun rebond. `render()` remplace tout `#main` : les animations d'éléments passent
par la View Transitions API (`view-transition-name`) ou par une classe « vient d'arriver » posée après le rendu.

- Cocher : le cercle se remplit, le barré se trace, la ligne ne se replie qu'après 1,2 s.
- Capturer / ranger : la ligne file vers sa destination, la pastille s'incrémente.
- Nouvel élément : surlignage au crayon qui s'éteint en 1,5 s.
- Changement d'espace : fondu 180 ms, le titre « morphe » depuis la navigation.
- Réduction des mouvements : fondus de 0–80 ms, brume et parallaxe arrêtées.

## Identité des espaces

Sigils gravés (trait de 1,25 px, grille de 20 px), choisis dans une grille, un défaut par type :
phalène (october.moth), salticide (Phidippus), plume et encrier (Écriture), diapason (Musique),
équerre et fil à plomb (Chantier), trébuchet (Budget), vasculum (Capture), spirale de souffle (Kundalini),
loupe (Motifs), sceau (Décisions), lunaison (Bilan), lanterne (Assistant). Numéro de planche selon l'ordre ;
teinte de domaine sur le sigil, le point d'étiquette et le filet actif seulement.

## Interactions signatures

1. **Le Halo** : la mini-lune est l'accueil et le minuteur ; un anneau se referme autour de la vraie phase.
2. **La Lisière** : après plus de 6 h d'absence, « Reprendre » émerge sous les sapins (dernier espace, pont, brouillon).
3. **Le Spécimen** : chaque entrée en fiche d'herbier (provenance, statut, liens, motifs, historique).
4. **Le Vasculum** : tri de la boîte de réception, une note à la fois, espaces cibles en grands sigils.
5. **La Fenêtre** : la scène montre le dehors réel, c'est-à-dire phase, heure et météo (ci-dessous).

## La Fenêtre : lune, heure et météo réelles

| Donnée | Source | Effet | Hors ligne |
|---|---|---|---|
| Hauteur du soleil | calcul local (algorithme solaire NOAA) | dégradé du ciel, lumière, étoiles | oui |
| Phase lunaire | `moon()` | forme, halo, lumière cendrée, étoiles | oui |
| Position de la lune | calcul local | hauteur, absente sous l'horizon, lune de jour | oui |
| Météo | Open-Meteo (sans clé) | nuages, brume, pluie, neige, vent | dernier état, puis neutre |

**Heure du jour** selon la hauteur du soleil, interpolée en continu (recalcul toutes les 5 min) :
nuit (< −18°), crépuscule astronomique puis nautique (−18° → −6°), heure bleue (−6° → 0°),
heure dorée (0° → 6°), jour (> 6°, bleu très désaturé). Le jour, les sapins proches restent vert sombre et les
lointains bleuissent (perspective aérienne).

**Météo** : les codes WMO ramenés à sept états, dessinés en gravure :
clair (0), voilé (1–2, strates horizontales), couvert (3), brume (45, 48, la brume monte et efface le lointain),
pluie (51–67, 80–82, fines hachures obliques), neige (71–77, 85–86, points et givre sur les cimes),
orage (95–99, ciel bas, lueur chaude à l'horizon, **jamais d'éclair qui clignote**). « Ciel vivant » : nuages,
brume, pluie et neige bougent lentement au rythme du vent mesuré (sens, vitesse, pente de la pluie) ; immobile si le
système demande moins d'animations, hors de vue, ou si on le coupe (Réglages → Ciel, par appareil).

**Lune** : la mini-lune du header montre toujours la phase nettement ; seule la lune de la scène peut être
voilée ou pâlie. Étoiles visibles = f(soleil, illumination, nuages). Lumière cendrée sur les croissants.

**Lisibilité** : voile de lecture sous le texte de la scène, opacité selon la luminance calculée du ciel,
4,5:1 dans tous les états ; test de navigateur sur 7 météos × 5 moments × 2 modes.

**Modes** : la scène est tonalisée par le mode (un jour vu depuis une pièce sombre en mode sombre) ;
nouvelle option « Suivre le soleil » (sombre au coucher réel, clair au lever).

**Lieu et vie privée** : « Lieu du ciel » dans Réglages → Apparence (ville ou position, jamais automatique),
coordonnées arrondies au dixième de degré avant tout envoi. Sans lieu : heure approchée par le fuseau, pas de
météo. Rafraîchi toutes les 30 min quand l'app est visible ; au-delà de 3 h sans mise à jour, ciel sans météo
plutôt qu'une pluie périmée. La CSP hébergée (`build.py`) devra autoriser `https://api.open-meteo.com` et
`https://geocoding-api.open-meteo.com` ; l'artefact claude.ai aura probablement l'heure sans la météo.

**Ligne de données** : `Pleine lune · éclairée à 97 %` puis `9 °C · brume · coucher 19 h 34`. Une donnée, pas un conseil.

## Vagues

### Vague 1 : correctifs, couleurs, calme

- [x] La lune de la scène visible sur iPhone (sortie du SVG recadré, entre le ciel et les sapins).
- [x] Champs à 16 px au moins sur écran tactile (fin du zoom d'iOS).
- [x] `accent-color` global (fin des cases bleu système).
- [x] Cibles tactiles de 44 pt pour chaque contrôle sur écran tactile : boutons (44 px de large, zone invisible
  au-dessus et au-dessous), champs, menus, nuanciers, volets, cases (par leur étiquette). Mesurées par
  `tests/browser/cibles.js` sur quinze écrans : ce que le doigt touche, voisins compris, pas la boîte dessinée. Seule
  exception, comme dans WCAG 2.5.8 : un lien dans le fil d'une phrase. Le scénario vérifie aussi que l'écran affiché
  est bien celui demandé : il mesurait l'accueil à la place de la Collection, sous une adresse qui n'existait pas.
  Le quinzième, un espace Sources (absent du jeu d'essai, ajouté au scénario), a montré deux défauts : « ouvrir ↗ »
  offrait 23 px de haut (une zone invisible le porte à 44, surtout vers le texte au-dessus, qui ne se touche pas) ; et
  un bouton passé à la ligne sous un champ (« Utiliser ma position » sous « Ville ») mordait d'1 px sur lui, sa zone
  dépassant de 9 px l'écart de 8 px des lignes : `.row` en garde 10 sur écran tactile.
- [x] À la souris, WCAG 2.5.8 (AA) : une cible de moins de 24 px garde un cercle de 24 px d'air, sans autre cible
  dedans (`tests/browser/cibles-ordinateur.js`, douze écrans, volets ouverts). Balayage axe-core du 4 octobre 2026,
  quinze vues, téléphone et ordinateur, clair et sombre : seul relevé, deux cases empilées à 24 px dans les réglages
  d'une collection, écartées. Rejoué à chaque PR depuis le 6 octobre 2026 (`tests/browser/accessibilite.js`, axe-core
  en dépendance de développement) : il a aussitôt relevé, dans Réglages → Espaces, des boutons « régler » dont le nom
  accessible ne commençait pas par le texte visible (WCAG 2.5.3) ; le texte visible vient désormais d'abord.
- [x] Étoile inactive et bordures de champs visibles (`--rule-strong`).
- [x] Couleurs sémantiques séparées : `--ok` vert-de-gris, `--warn` résine, `--alarm` cinabre, `--info` ardoise ; étiquettes neutres à point.
- [x] Actions de ligne en divulgation progressive (survol ou focus sur ordinateur, toucher de la ligne sur téléphone).
- [x] Navigation collante en verre fumé, `aria-label`, `aria-current`.
- [x] Mémoire du défilement par route.
- [x] Voile des dialogues vert-noir flouté.
- [x] Accueil : plus de « ouvrir » ni de « derniers éléments » répétés (chevron) ; rappels regroupés par espace.
- [x] Tâches : une tâche du jour n'est plus répétée dans « Échéances ».
- [x] Kanban : colonnes vides en zone pointillée.
- [x] Chiffres tabulaires pour montants, minuteur, compteurs.
- [x] Budget sur téléphone : trois statistiques sur une ligne.
- [x] Le ciel se fond dans la page par la brume.

### Vague 2 : navigation

- [x] Shell adaptatif : barre basse sur téléphone (Aujourd'hui · Espaces · ⊕ Capturer · Chercher · Bilan),
      barre latérale collante sur ordinateur (≥ 900 px), feuilles Espaces et Capturer.
- [x] Domaines : un champ « Domaine » par module (Réglages → Espaces) ; la navigation, la feuille Espaces et
      le sommaire de l'accueil se regroupent. Facultatif, synchronisé, validé à l'import (40 caractères).
- [x] Palette de commandes `⌘K` / `Ctrl+K` : aller (récents, espaces, vues), agir (minuteur, capturer,
      mode du bilan), garder une phrase dans la boîte, chercher (textes menant à leur entrée).
- [x] Liens profonds `#module/entrée` (recherche, liaisons, tensions, arcs, palette) : la page qui contient
      l'entrée est dépliée, les filtres de l'appareil levés, l'entrée montrée et surlignée ; une puce « ‹ … »
      ramène d'où l'on vient, avec sa position.
- [x] Reprise : bloc « Reprendre » sous le ciel (dernier espace, son pont, brouillons en cours), et
      « Ouvrir sur : là où j'en étais » (Réglages → Apparence, propre à l'appareil).

Écarts assumés par rapport au plan : « / » garde son rôle (la page Chercher, déjà connue des doigts) et la
palette prend `⌘K` ; « deux touchers sur Espaces rouvrent le dernier espace » devient une rangée de récents en
tête de la feuille (un geste caché ne se découvre pas) ; sur téléphone, la capture de l'accueil laisse la place
au ⊕ de la barre basse. Les derniers espaces ouverts restent sur l'appareil et s'effacent à la déconnexion.

### Vague 3 : système visuel et signatures

Livrée en quatre temps, pour que chaque pull request reste relisible.

**3a : système visuel**
- [x] Typographie à trois voix : Cormorant (titres), Spectral (texte, champs d'écriture), Spectral SC (étiquettes,
      domaines, planches), IBM Plex Sans (boutons, champs, navigation, données) ; chiffres elzéviriens dans la prose,
      alignés ailleurs. Jetons `--f-display`, `--f-text`, `--f-label`, `--f-ui`.
- [x] Sigils : dix-huit glyphes gravés (`SIGILS`), un défaut par type et par nom pour les espaces d'origine
      (phalène, salticide, diapason…), choix dans les réglages du module (`config.modules[].sigil`, validé à l'import).
- [x] Planches : `Pl. IV` en tête de chaque espace (ordre de la navigation), avec « Je m'arrête ici… » et « régler ».
- [x] Teintes de domaine `t0`…`t7` (minérales, hors des teintes d'état) : sigil, point d'étiquette, filet actif.
- [x] Réglages contextuels : « régler » ouvre les réglages du module sur place (tiroir à droite sur ordinateur,
      feuille sur téléphone), redessinés à chaque changement. La page Réglages garde ses blocs.
- [x] Formulaires en feuille sur téléphone.

**3b : la Fenêtre**
- [x] Heure du jour : `src/core/sky.js` (pur, testé seul) calcule la hauteur du soleil ; le ciel s'interpole entre sept
      repères (nuit, crépuscule nautique, heure bleue, horizon cuivré, heure dorée, jour bas, jour), tonalisé par le
      mode (un jour vu depuis une pièce sombre ; une nuit relevée en mode clair). Recalculé toutes les cinq minutes.
- [x] Lune à sa place (face au sud, l'est à gauche ; au nord dans l'hémisphère austral), absente sous l'horizon,
      pâle le jour ; lumière cendrée sur les croissants ; étoiles selon le soleil, la lune et les nuages.
- [x] Météo (Open-Meteo, codes WMO → sept états) dessinée en gravure : strates de nuages, pluie en hachures
      obliques, neige en points, brume qui efface le lointain, orage sans éclair. Cache de 30 min, ignorée après 3 h.
- [x] Voile de lecture calculé : l'encre et l'opacité du voile sous le texte garantissent 4,5:1 (vérifié sur plus de
      5 000 combinaisons heure × temps × mode × phase).
- [x] Réglages → Ciel : une ville (recherche) ou la position de l'appareil, arrondies à ~10 km ; « Météo en direct » ;
      « La lune à sa vraie place ». Mode « Suivre le soleil ». Ligne de données : `9 °C · pluie · coucher 19 h 34`.
- [x] « Ciel vivant » : les nuages et la brume dérivent dans le sens du vent mesuré (Open-Meteo : vitesse et
      direction ; un vent d'ouest pousse vers la gauche, puisque la fenêtre regarde le sud), la pluie tombe penchée
      par lui, plus vite sous l'averse que sous la bruine, la neige descend. La ligne de données dit le vent
      (« vent d'ouest 22 km/h », omis sur téléphone). Coût : des calques animés par `transform` seul, confiés au
      compositeur, soit environ 7 ms de fil principal sur 5 s mesurées, aucune mise en page ; phase prise sur
      l'horloge (un nouveau rendu ne remet pas le ciel à zéro) ; pause hors de vue ; rien si le système demande moins
      d'animations ; se coupe par appareil (Réglages → Ciel).

**3c : signatures**
- [x] Fiche Spécimen (« fiche » dans les actions d'un fragment, d'une note, d'un élément de collection) : texte,
      étiquette, statut codé par la forme (● ◌ ◐ ⊙), provenance, liens sortants et entrants, motifs présents dans le
      texte, histoire du statut et des réexamens ; statut, dériver, lier et modifier sur place. Tiroir sur ordinateur,
      feuille sur téléphone, redessinée à chaque changement.
- [x] Le Halo : l'anneau de la mini-lune se referme au rythme du minuteur et bat une fois à la fin ; un appui long
      sur la mini-lune lance ou met en pause (le bouton du minuteur reste).
- [x] Le Vasculum : « Trier une à une » (boîte, feuille Capturer, palette) ; une note à la fois, la plus ancienne
      d'abord, le rangement reconnu en premier, les espaces en grands sigils, « Plus tard », « Supprimer ».
- [x] Les messages (« Annuler », « Rangé dans… ») se logent dans la fenêtre modale ouverte au lieu de passer dessous.
- [x] Un message à action (« Annuler », « Ranger », « La relier à une idée ») ne part pas sous la main : survolé, ou le
  focus dessus, il attend qu'on le quitte, puis encore deux secondes (WCAG 2.2.1, délai réglable). `⌘Z` / `Ctrl+Z`
  reprend le dernier « Annuler » affiché, hors d'un champ (dans un champ, le raccourci défait la frappe) ; le bouton
  l'annonce (`aria-keyshortcuts`). `tests/browser/annuler.js`.
- [x] Le titre de la page nomme l'écran (« Écriture — Selene » : onglet, historique, lecteur d'écran ; WCAG 2.4.2).
  Suivre un lien du menu ou de la barre du bas porte le focus au titre du nouvel écran, sans défiler : il retombait
  sur la page entière, et rien n'était annoncé. Un champ qui a déjà le focus le garde (« / » et la recherche).
  `tests/browser/ecran-lu.js`.
- [x] Les messages d'état qui naissent avec un contenu redessiné (« Recherche… », une erreur, l'aperçu d'une source,
  « 3 sur 12 artistes… ») portent `data-status` ; une seule région permanente, hors de l'écran (`#sr-say`,
  `role="status"`), répète ce qui change, une fois (`src/app/lib/dom.js`). Un lecteur d'écran n'annonce pas toujours
  une région qui apparaît en même temps que son texte. L'aperçu d'une source dit une phrase courte
  (« Trouvée : « … ». »), pas toute la fiche.

**3d : écrans chargés**
- [x] Journaux à dates suspendues : la date dans la marge, en petites capitales (notes, fragments, rappels,
      séances, opérations, résultats de recherche), et plus répétée dans la ligne de méta.
- [x] Registre au lieu des tuiles : une ligne par groupe (nom, décompte, pourcentage en chiffres alignés), un trait
      de 2 px qui avance sous la ligne ; le groupe filtré porte un filet de marge.
- [x] Kanban adaptatif : sur téléphone, un sélecteur segmenté et une colonne à la fois ; sur ordinateur, glisser une
      carte dans une colonne, ou `[` et `]` sur une carte qui a le focus. Les flèches restent partout. La carte dit au
      lecteur d'écran son titre, sa colonne et ces deux touches ; déplacée, elle garde le focus et dit sa nouvelle colonne.
- [x] Recherche à facettes : espace, période (depuis la nouvelle lune, ce mois-ci), statut ; chaque puce compte ce qu'elle
      donnerait, les autres facettes appliquées ; résultats groupés par espace, « N résultats sur M ». Une recherche
      lancée d'ailleurs (un mot du bilan, un motif, « Chercher « … » partout » de la palette) repart sans filtre ;
      « / » ramène à la page Chercher telle qu'on l'a laissée ; l'export en dossier suit les filtres.

### Vague 4 : les pistes expérimentales

Du moins risqué au plus risqué ; chaque étape se suffit à elle-même (on peut s'arrêter après n'importe laquelle).

**4a : saisons de la lisière**
- [x] Des feuillus (hêtres, bouleaux) mêlés aux sapins du plan lointain : les sapins sont sempervirents, la saison se
      lit dans les feuillus. Phénologie continue (`seasonAt`, sky.js, pure) : débourrement vers la mi-avril, feuillage
      plein de mai à septembre, rouille en octobre, branches nues de novembre à mars ; décalée d'une demi-année au sud.
- [x] Givre sur les cimes d'après la température **mesurée** (≤ 0 °C), jamais d'après le calendrier.
- [x] Image fixe (coût nul) ; pas de feuilles qui tombent.

**4b : marginalia (ordinateur)**
- [x] Dans les fragments et les notes, la retouche, la provenance, les liens (sortants et entrants) et les motifs
      présents passent dans la marge droite, face au texte, derrière un filet (notes latérales à la Tufte). Le statut
      (un menu) et les versions (dépliables) restent avec le texte ; les actions aussi, sur la ligne du statut.
- [x] Un seul `<aside>` rendu ; le CSS seul le place, par une requête de conteneur (la liste elle-même ≥ 700 px, pas
      la fenêtre) : en marge sur un grand écran, sous le texte ailleurs. Au-delà de 1180 px, Écriture empile
      avancement et fragments pour donner la largeur aux fragments. Les formes des motifs sont calculées une fois
      par rendu (`motifIndex`) : Écriture passe de 5,0 à 6,9 ms sur l'historique du banc d'essai.

**4c : planche de lunaison**
- [x] `#bilan/planche` (bouton « Planche » du Bilan) : une planche A4 par cycle, numérotée par la lunaison de Meeus
      (le `k` de `periodOf`) ; règle de lunaison (entrées datées par jour, quartiers en glyphes), une ligne, la période
      d'avant et une sparkline par espace, mots émergents, motifs apparus (première occurrence dans le cycle), statuts,
      tensions ouvertes. ‹ › d'une lunaison à l'autre.
- [x] Feuille de style d'impression (`@page` A4, rien d'autre que la planche, une seule page) ; « Télécharger » en
      .html autonome, sans script, là où l'impression est bloquée. Le style vit en chaîne (`PLANCHE_CSS`), partagé par
      la vue et le fichier.
- [x] `build.py` : les ajouts de `index.html` se font dans le squelette avant d'y poser le script (le `</body>` de la
      planche téléchargée avait cassé la page), et `</script` est refusé dans le JavaScript.

**4d : carte céleste des liaisons (expérimentale)**
- [x] Jamais globale : « carte du voisinage » (fiche Spécimen d'une entrée liée : deux degrés, en largeur d'abord) et
      « carte » d'un motif (Motifs : ses entrées, les plus récentes d'abord, et leurs voisines directes) ; 80 étoiles
      au plus, les plus proches gardées, et l'app le dit (« une nébuleuse, pas une carte »).
- [x] Disposition déterministe (`carte.js`, pur, testé seul) : le temps en abscisse, une bande par espace dans l'ordre
      de la navigation, étagement stable des étoiles d'un même jour ; aucune simulation physique. La taille d'une
      étoile dit son nombre de liens ; sa teinte, son domaine. Liens en arcs légers, codés par le trait (plein :
      dérive de ; pointillé : contredit ; tireté : écho ; trait-point : documente), tensions ouvertes en cinabre.
- [x] Chaque étoile est un lien (clavier compris, anneau d'encre au focus, cible invisible de 12 px) ; la table des
      liaisons dit la même chose en texte, seule d'abord sur téléphone (« Voir la carte » la déplie). Feuille large
      sur ordinateur. 70 ms pour la carte d'un motif sur l'historique du banc d'essai (5 500 textes).
- [ ] Critère d'abandon écrit d'avance : pas ouverte pendant un mois, retirée. (À juger à l'usage, fin octobre 2026.)

### Réglages en chapitres

- [x] Six chapitres numérotés, du plus courant au plus rare : Apparence et rythme, Espaces, Ciel et alentours, Assistant,
      Connexions, Compte et données (la sauvegarde avant l'irréversible, rangé en dernier sous « Zone sensible »). Sommaire
      en tête ; au-delà de 1180 px, dans la marge droite, collant, et il marque le chapitre lu (filet de marge).
- [x] Un espace n'y paraît qu'une fois : sa ligne (afficher, nommer, domaine, ordre, avec son sigil), et dessous ses
      réglages propres, repliés (« régler », avec son type). Un bloc déplié le reste après un changement fait dedans.
- [x] Créer un espace : les modèles s'affichent avec leur description, au lieu d'attendre au fond d'une liste déroulante ;
      « Sur mesure » garde le type vide et le modèle sous un autre nom.
- [x] Infobulles (`ui/tips.js`) : un « ? » à côté de ce qui ne va pas de soi, ouvert au clic ou au toucher, jamais au seul
      survol ; l'API popover ferme par Échap ou un geste ailleurs et passe au-dessus des feuilles ; la bulle est posée dans
      l'écran. Sans l'API, le texte s'affiche en clair.
- [x] « cet appareil » marque ce qui ne suit pas le compte. Premier accueil repliable (comment la page est rangée, le
      vocabulaire de Selene), rouvert depuis le sommaire. Textes d'aide réunis dans `views/reglages-aide.js`, pour la traduction.

## Espace optionnel « Reprendre la main »

Exception locale au principe du bilan sans trophée, demandée pour le suivi des consommations et comportements : progression facultative (masquée par défaut) dans le seul espace de suivi. Jalons fixes, aucune série obligatoire ni remise à zéro après un écart. Le bilan général reste descriptif et n'a pas de ligne pour cet espace, pas plus que la planche de lunaison. Pas de nouvelle scène illustrée ni de teinte d'état pour juger une journée : encre, filets et marques dans l'espace ; la lune et le ciel ne dépendent jamais de ce qui est déclaré. Quatre actions principales, en grille de deux sur téléphone (cibles de 44 px). Voir [regulation.md](regulation.md).
