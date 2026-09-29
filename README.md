# Selene

Tableau de bord personnel : chantier de l'appartement, pratique de kundalini, écriture, october.moth, Phidippus, musique et capture rapide, sous la lune du jour et une lisière de sapins.

Aucune dépendance de production, aucun client vendorisé : le build hébergé (GitHub Pages) parle directement, via `fetch`, aux API REST de Supabase (Auth + PostgREST) pour les comptes multi-utilisateurs — voir « Comptes et synchronisation » plus bas. La source éditable est dans `src/` : `shell.html` (gabarit), `core/` (le noyau pur, en modules ES : `sync.js` fusion à trois voies, `backup.js` sauvegarde, `domain.js` règles métier et registre pur des types de module, et la traduction des services externes), `store.js` (persistance et synchronisation), `auth.js` (comptes Supabase, hébergé uniquement), `app.js` (interface et orchestration), `types.js` (affichage de chaque type de module), `assistant.js` (Claude) et `boot.js` (démarrage). Ajouter un type de module = une entrée dans `MODULE_TYPES` (`domain.js`) et une dans `TYPE_UI` (`types.js`), rien d'autre. `python3 build.py` (après `npm ci` : esbuild y assemble le noyau) génère `selene.html` pour claude.ai et `index.html` pour GitHub Pages. Ne modifie pas directement les HTML générés.

Vérification locale (Node 22, Python 3) : `npm ci` une fois, puis `npm run check` (build, tests unitaires, syntaxe, eslint, passeur) ; les parcours dans un vrai navigateur : `npx playwright install chromium` une fois, puis `npm run test:browser` (`npm run test:browser -- budget` n'en lance qu'un ; `SELENE_BROWSER=webkit` pour WebKit, après `npx playwright install webkit`). Liste des scripts : [docs/architecture.md](docs/architecture.md#vérification). Performances sur un gros historique : `npm run bench`. Fonctionnement interne, synchronisation et décisions d'architecture : [docs/architecture.md](docs/architecture.md). Évolution de l'interface (principes, système visuel, vagues à venir) : [docs/evolution-ui.md](docs/evolution-ui.md).

## Publier avec GitHub Pages

1. Pousser ce dépôt sur GitHub.
2. Settings → Pages → Build and deployment → Source : « GitHub Actions ». Le workflow `pages.yml` publie alors `main` seulement si les vérifications (`check.yml`) passent, et seulement les fichiers du site.
3. Le site est servi à `https://<utilisateur>.github.io/<dépôt>/`.
4. Après une mise à jour, recharger l'app sur chaque appareil : une ancienne version restée ouverte ne connaît pas les règles de synchronisation récentes.

## Installer sur iPhone

1. Ouvrir l'adresse GitHub Pages dans **Safari** (pas un autre navigateur).
2. Bouton Partager → « Sur l'écran d'accueil ».
3. L'app s'ouvre en plein écran, fonctionne hors ligne (sauf l'assistant) et garde ses données sur l'appareil.

Les données de l'app installée sont séparées de celles de Safari : exporter depuis l'ancienne version, importer dans l'app.

## Modules

Un compte neuf part presque vide (une boîte de réception) : l'accueil propose des **modèles** (tâches, protocole, écriture, budget, tableau de production, liste « à découvrir », soins, carnet), à ajouter autant de fois qu'on veut. Ces modèles restent disponibles dans « + Créer un module », à côté des types vides.

Réglages → Modules : activer, renommer, réordonner, supprimer, et « + Créer un module ». Chaque module est une instance de l'un de ces types (l'exemple entre parenthèses est le module d'origine) ; seul l'Assistant est une fonction, activable, sans données propres.

  - *Programme* : un protocole de N semaines, un calendrier et un objectif de séances par semaine (ex. Kundalini) ;
  - *Objectif cumulatif* : un compteur vers un objectif, avec des catégories et, en option, un carnet de notes libres (ex. Écriture et ses fragments) ;
  - *Rappels* : des types d'événements récurrents avec une fréquence, et un journal (ex. Phidippus) ;
  - *Notes* : des textes datés. L'une des boîtes est la **boîte de réception** (Réglages → Réglages par module) : elle reçoit la capture rapide de l'accueil, et chaque note peut ensuite être rangée d'un geste dans tout module qui sait la recevoir (ex. la Capture) ;
  - *Tâches* : échéances, étapes, effort, coûts facultatifs, regroupées par pièce ou par lieu (le nom se règle) ; l'étoile « Aujourd'hui » est plafonnée à trois tâches **tous modules confondus**, et l'accueil les réunit (ex. le Chantier) ;
  - *Budget* : des opérations (dépenses, revenus), des enveloppes à plafond mensuel et leurs jauges, mois par mois (ex. le Budget) ;
  - *Collection* : des éléments à statuts (titre, sous-titre, étiquette, date, texte : chaque champ se renomme ou se masque), affichés en colonnes ou en liste filtrable (ex. october.moth en colonnes, Musique en liste) ; en colonnes, sur téléphone une colonne à la fois par un sélecteur, sur ordinateur une carte se glisse d'une colonne à l'autre (ou `[` et `]` sur la carte qui a le focus).

Un module se supprime définitivement (✕, puis retaper son nom) : ses données partent avec lui, sur tous les appareils. Ses réglages propres sont dans Réglages → Réglages par module. Un nouveau module est partagé par défaut avec l'assistant ; décocher dans Réglages → Assistant pour le garder privé.

Pour ajouter un *type* de module au code, voir [docs/architecture.md](docs/architecture.md#ajouter-un-type-de-module).

## Au quotidien

- **Brouillons** : le texte en cours d'un champ libre (capture, note, fragment, observation, message à l'assistant) survit à la fermeture de l'app, sur cet appareil.
- **Annuler** : supprimer un élément affiche « Annuler » pendant quelques secondes, au lieu d'une confirmation.
- **Accueil** : « fait » sur un rappel en retard (une ligne par module), « Noter N min » pour la séance du jour (dernière durée), éléments prévus ou en retard ; le chevron d'une ligne la déplie sur ses derniers éléments. Sur téléphone, le paysage se réduit à partir de la deuxième ouverture du jour.
- **Actions de ligne** (supprimer, modifier, dériver, lier…) : au survol sur ordinateur ; sur téléphone, toucher la ligne (« ⋯ » signale qu'il y en a). Chaque vue retrouve sa position de défilement quand on y revient.
- **Navigation** : sur téléphone, une barre en bas (Aujourd'hui, Espaces, ⊕ Capturer, Chercher, Bilan) ; sur ordinateur, une barre latérale. Réglages → Modules : un « Domaine » par module (Maison, Création…) regroupe la navigation et l'accueil. Réglages → Apparence : « Ouvrir sur » l'accueil ou là où tu en étais (propre à l'appareil).
- **Fiche** (« fiche » dans les actions d'un fragment, d'une note ou d'un élément) : tout ce qu'on sait d'une entrée au même endroit : provenance, statut et son histoire, liens dans les deux sens, motifs présents.
- **Trier une à une** (dans la boîte de réception) : une note à la fois, rangée d'un geste dans l'espace de son choix, ou laissée pour plus tard.
- **Minuteur** : l'anneau autour de la petite lune se referme à mesure que les quinze minutes passent ; un appui long sur la petite lune le lance.
- **Le ciel de l'accueil** montre le dehors réel : l'heure (le soleil), la lune à sa place, le temps qu'il fait, et la saison : des feuillus mêlés aux sapins bourgeonnent, verdissent, rouillent puis se dénudent au fil de l'année (à l'envers au sud de l'équateur), et le givre prend les cimes quand la température mesurée passe sous zéro. Réglages → Ciel : une ville ou la position de l'appareil (arrondies à une dizaine de kilomètres), la météo en direct (Open-Meteo, sans clé), la lune à sa vraie place ou toujours visible, et le « Ciel vivant » (nuages, brume, pluie ou neige qui bougent au rythme du vent mesuré ; par appareil, immobile si le système demande moins d'animations). Sans lieu, l'heure est estimée d'après le fuseau horaire, sans météo. Réglages → Apparence → Mode : « Suivre le soleil » passe l'interface en sombre au crépuscule et en clair à l'aube.
- **Identité des espaces** : chaque espace a un sigil gravé (phalène, salticide, plume, diapason…) et un numéro de planche en tête de sa page ; un domaine a sa teinte. « régler », en tête d'un espace, ouvre ses réglages sur place (sigil compris), sans quitter ce qu'on regardait.
- **Palette** (`⌘K` ou `Ctrl+K`) : aller à un espace, lancer le minuteur, garder une phrase dans la boîte, retrouver un texte et y aller directement.
- **Carte céleste** (expérimentale) : depuis la fiche d'une entrée liée (« carte du voisinage ») ou depuis un motif (« carte »), les entrées en étoiles, le temps de gauche à droite, une bande par espace, et leurs liens codés par la forme du trait (les tensions ouvertes en cinabre). Jamais la totalité : 80 étoiles au plus. La table des liaisons en texte l'accompagne, seule d'abord sur téléphone.
- **Planche de lunaison** (bouton « Planche » du Bilan) : le cycle lunaire mis en page comme une planche d'atlas numérotée (lunaison de Meeus) : activité jour par jour, une ligne par espace, mots émergents, motifs apparus, statuts, tensions, et ce qui est venu du dehors (les sources gardées pendant le cycle, par provenance). « Imprimer ou enregistrer en PDF » (une page A4) ou « Télécharger » en .html autonome.
- **Sources** (modèle de module) : colle un lien ou un DOI, « Chercher » complète titre, auteurs, revue et date (Crossref pour un DOI, Microlink pour une page), puis « Garder ». Adresses débarrassées des traceurs, doublons reconnus. Une note de la boîte qui contient un lien devient une source d'un geste (« Garder comme source »), avec sa provenance.
- **Musique et MusicBrainz** : dans une collection marquée « Musique » (artiste, puis album), « préciser l'album » ouvre la discographie studio de l'artiste, pochettes comprises, pour choisir ou ajouter un album ; « Nouvelles sorties » demande, quand tu le veux, ce que tes artistes ont publié depuis ta dernière vérification.
- **Ciel et chantier** : sous le ciel de l'accueil, une ligne la veille et le soir d'une grande pluie d'étoiles filantes (partout), ou dans la semaine d'une éclipse visible depuis Lille et ses environs (table fixe jusqu'en 2030, aucun réseau). Une tâche à ciel ouvert (« balcon », « jardin »… dans le titre ou le lieu, mots réglables) montre la pluie prévue sur cinq jours, lue dans la prévision déjà demandée pour le ciel.
- **Radar culturel** : Réglages → Radar culturel, quelques mots (poésie, jazz…) ; sur l'accueil, à la demande, cinq événements au plus de la Métropole de Lille (OpenAgenda, open data de la MEL) qui en parlent dans les deux semaines. Le portail voit la zone et les dates, jamais tes mots ; « garder » en dépose un dans la boîte.
- **Mémoire éditoriale** : l'export Instagram (Centre de comptes Meta → Télécharger tes informations, format JSON) s'importe dans une collection, october.moth par exemple : légende, date, au statut « Publié », sans doublon. Lu sur l'appareil, rien n'est envoyé.
- **Le passeur** (version hébergée) : une petite fonction dans ton projet Supabase qui lit pour toi les pages, flux et calendriers que le navigateur ne peut pas lire seul. Fermée à ton compte, protégée contre la SSRF, elle ne garde rien. Déploiement : [docs/passeur.md](docs/passeur.md).
- **Dehors** (version hébergée, avec le passeur) : les flux que tu suis (revues, blogs, chaînes, newsletters via Kill the Newsletter), rangés par projet. Seulement le nouveau depuis ta dernière visite, douze au plus, et d'abord ce qui croise ce que tu gardes (un motif, un auteur de tes sources, une de tes sources citée, un lien paru dans deux flux), avec la raison en toutes lettres ; « garder » en fait une source, le reste s'efface en un mois. Sur l'accueil, une ligne de texte s'il y a du nouveau, jamais de pastille. Une case y ajoute **Artist Watch** : chaque semaine, les nouvelles sorties de tes artistes reliés à MusicBrainz. Et une **veille de recherche** : tes recherches et tes auteurs suivis (OpenAlex, ORCID), chaque semaine ; une clé OpenAlex gratuite, facultative, reste dans ton navigateur.
- **Calendrier dédié** (version hébergée, avec le passeur) : l'adresse iCal secrète d'un calendrier « Selene », gardée dans ton navigateur seulement ; aujourd'hui et demain s'affichent sous « Aujourd'hui », et « Chantier : plombier » se range sous Chantier.
- **Zotero** (version hébergée) : ta bibliothèque en lecture seule. Dans un module de Sources, cherche une fiche ou vois les dernières ajoutées, et garde-la comme Source reliée à sa fiche Zotero. La clé (lecture seule) reste dans ton navigateur.
- **Sources oubliées** : une source se relie à la note ou au fragment qu'elle documente (« documente… ») ; les sortes tirent aussi celles qu'on a gardées puis reliées à rien, pondérées par l'oubli.
- **Ce que tes sources ont en commun** (à la demande, dans un module de Sources) : d'après OpenAlex, les textes cités par plusieurs de tes sources (à garder d'un clic), les sources qui citent les mêmes textes (couplage bibliographique), les auteurs qui reviennent (à suivre dans la veille). OpenAlex ne reçoit que les DOI ; le résultat reste sur l'appareil.
- **Envoyer à Selene** : un lien lu ailleurs arrive dans la boîte de réception, par le menu « Partager » d'Android (app installée), un favori à glisser dans la barre (Réglages) ou un Raccourci iOS (`?url=`). Principes des connexions externes : [docs/connexions.md](docs/connexions.md).
- **Marges** : sur un grand écran, les fragments et les notes portent en marge, face au texte, leur provenance, leurs liens, les motifs qu'ils contiennent et leur date de retouche ; sur un écran étroit, tout cela passe sous le texte.
- **Chercher** (touche « / » sur ordinateur) : dans tous les modules, sans tenir compte des accents. Des puces filtrent par espace, par période (cette lunaison, ce mois-ci) et par statut, chacune avec son décompte ; les résultats sont groupés par espace, la date dans la marge. « ouvrir » mène à l'entrée elle-même, surlignée ; la puce « ‹ Recherche » ramène aux résultats. De même pour les liens entre fragments et notes.
- **Reprendre** : sous le ciel de l'accueil, le dernier espace ouvert, son pont de reprise et les brouillons en cours.
- **Minuteur** : à la fin des 15 minutes, le module ouvert propose la suite (noter la séance, donner le nouveau total).
- **Écriture** : saisie du total atteint (l'app calcule la différence), dernier chapitre présélectionné, fin estimée au rythme des 30 derniers jours.
- **Tâches → Budget** : terminer une tâche qui a un coût propose de l'ajouter en dépense (enveloppe réglable).
- **Atelier d'écriture** : un fragment se rattache à un chapitre (le dernier utilisé par défaut), la liste se filtre par chapitre, et « Exporter en Markdown » assemble les fragments sous leurs chapitres.
- **Bilan** (lien sur l'accueil) : pour chaque module, ce qui s'est passé pendant le cycle lunaire en cours (d'une nouvelle lune à la suivante) ou le mois, à côté de la période précédente ; ‹ › pour remonter le temps. Une information, pas un score.
- **Capture qui comprend** trois motifs, et seulement trois : « 12 € courses » (une dépense), « 25 min kundalini » (une séance), « Phidippus : une note » (rangée dans le module nommé). La note part toujours d'abord dans la boîte de réception ; l'app propose seulement de la ranger (bandeau, puis bouton « Ranger » dans la boîte).

## Penser avec

- **Pont de reprise** : en haut de chaque module, « Je m'arrête ici… » note le prochain geste ; il s'affiche au retour dans le module et sur l'accueil, sous sa ligne. Le champ s'ouvre de lui-même à la fin du minuteur (l'ignorer suffit). « fait » le lève ; ce qui était prévu et ce qu'il en est advenu restent dans un court historique.
- **Statut épistémique** : un fragment ou une note peut se dire *observé*, *hypothèse*, *interprétation* ou *inexpliqué* (vide par défaut). Un « ? » en tête d'une saisie en fait une hypothèse. Chaque changement est daté ; « statut:hypothèse » dans la recherche filtre ; le bilan compte les idées de la période par statut.
- **Provenance** : une note rangée depuis une boîte disparaît, mais ce qui en naît (fragment, tâche, élément…) garde une copie de son texte, de sa date et de sa boîte d'origine (« ↳ de Capture, 3 sept. »). Rangée deux fois, elle garde sa première naissance.
- **Liaisons** : sous chaque fragment et chaque note, « dériver » (la prochaine entrée écrite en découle) et « lier… » (dérive de, contredit, fait écho à, documente). Chaque entrée montre ses liens et ceux qui la visent (« a donné… », « contredit par… »). Un lien vers une entrée supprimée le dit. Une note rangée emporte ses liens, et ceux qui la visaient la suivent.
- **Tensions** (dans le bilan) : chaque « contredit » reste ouvert jusqu'à une synthèse qui dérive des deux ; « résoudre » ouvre cette synthèse, dans le module de la première.
- **Dossier de passation** : un export Markdown pensé pour être relu par NotebookLM, Claude ou Obsidian. Chaque entrée garde sa date, son module, son statut et sa provenance ; ses liens deviennent des renvois numérotés `[n]` quand leur cible est dans le dossier. Les sources qui documentent une entrée y sont citées en `[S1]`, `[S2]`…, et listées à la fin, en références avec leur DOI (auteurs, année, titre, revue). Un en-tête YAML décrit le périmètre, et un préambule explique les statuts (ne pas traiter une hypothèse comme un fait). Trois points d'entrée : « Dossier » sur les fragments (suit le filtre de chapitre), « Exporter en dossier » sur une recherche (tous les résultats, donc aussi `statut:hypothèse` ou un motif), « dossier » sur une tension (les deux entrées et leur voisinage).
- **Longues listes** (fragments, notes, collections) : cent éléments, puis « Voir les suivants ».
- **Palimpseste** : un fragment peut être modifié. L'ancienne version reste lisible dessous, repliable, plafonnée à dix versions (la plus ancienne s'efface la première). Aucune UI d'édition sur les notes : c'est propre aux fragments d'un cumul.
- **Sortes** (sur l'accueil) : un tirage pondéré par l'oubli dans ton seul matériau — un fragment ou une note pas retouché depuis 14 jours au moins, une tension ouverte, un motif en jachère. Plus c'est ancien, plus ça a de chances de sortir ; rien en dessous du seuil ne peut être tiré.
- **Test lunaire** (dans le bilan) : un test de Rayleigh (statistique circulaire) sur tout ce qui est daté, pour voir si l'activité se concentre autour d'une phase de la lune plutôt que d'être uniformément répartie. Un résultat nul est une réponse à part entière ; sous 40 événements, le bilan le dit plutôt que d'inventer une tendance. Un seul test, pour ne pas tomber dans les faux signaux des tests multiples.
- **Arcs** (modèle de module) : des étapes nommées par toi, où loger des fragments et des éléments de collection venus de n'importe quel autre module (« Placer un élément »). Vue en colonnes, une par étape ; une étape sans rien dedans reste affichée, vide — c'est elle l'information. Supprimer une étape retire ses placements, avec confirmation. Aucune grille imposée : ni alchimique, ni narrative.
- **Paliers** (sur un programme) : des critères que tu écris toi-même pour une étape (« 12 séances à 20 min »), cochés à la main. Rien ne fait jamais franchir un palier automatiquement, coché ou non : « Passer au palier suivant » est le seul geste qui compte, et il reste ton choix. S'il existe un module Décisions actif, franchir un palier ouvre aussitôt une décision prête à compléter (jamais enregistrée sans ta validation).
- **Décisions** (modèle de module) : une collection dont la date est un rendez-vous de révision. Arrivée à échéance, une décision revient sur l'accueil quel que soit son état (sauf « Abandonnée ») : « relire » montre la raison écrite alors, « maintenue » note le réexamen et lève le rendez-vous. Réglable sur toute collection (« La date est un rendez-vous de révision »).
- **Motifs** (modèle de module) : une concordance. Chaque motif (variantes en sous-titre, séparées par des virgules) est cherché dans les textes de tous les autres modules, en mot entier, sans accents ni casse, pluriel toléré (« lune » ne trouve pas « lunettes »). Pour chacun : occurrences, dernière apparition et où, **voisins** (motifs présents dans les mêmes textes, dès deux rencontres). Un motif vivant absent depuis 90 jours (réglable) est **en jachère**, compté en lunaisons ; un motif « Épuisé » ne l'est jamais. Le bilan dit quels motifs sont apparus dans la période. Calculé à la lecture sur tout l'historique : rien n'est enregistré.
- **Vocabulaire** (dans le bilan) : les mots propres à la période, comparés aux six cycles ou mois d'avant, dans tous les textes datés. *Émergent* : présent dans au moins deux textes, et bien plus fréquent qu'avant (ce qui est neuf passe devant ce qui a seulement grandi). *Absent cette fois, fréquent avant* : vu dans au moins trois textes avant, dans aucun maintenant. Un mot compte une fois par texte ; mots vides, nombres et mots de moins de trois lettres écartés ; pluriel ramené au singulier. Chaque mot mène à la recherche, et « + » en fait un motif. Sous cinq textes de chaque côté, le bilan le dit au lieu d'inventer une tendance.

## Assistant (Claude)

Le module Assistant est désactivé par défaut (Réglages → Modules).

- Sur claude.ai, il passe par ton compte : aucune clé à fournir.
- Hébergé (GitHub Pages), il appelle directement l'API Anthropic depuis le navigateur avec **ta propre clé**, saisie dans Réglages → Assistant. La clé reste dans le `localStorage` de ce navigateur : elle n'est jamais écrite dans le code, dans le dépôt ni dans les exports. Donne-lui une limite de dépense dans la console Anthropic.
- Réglages → Assistant permet de choisir le modèle, les modules que Claude peut lire, et s'il a le droit de modifier le tableau de bord.

## Données

Sur claude.ai, les données sont synchronisées entre appareils par la base de l'artifact, propre à ton compte claude.ai.

Hors de claude.ai (GitHub Pages), tant qu'aucun compte n'est configuré (voir ci-dessous), tout est gardé dans le `localStorage` du navigateur : propre à chaque appareil, effacé si l'on vide les données du site.

Pour passer d'une version à l'autre, ou avant de configurer les comptes : Réglages → Sauvegarde → Exporter, puis Importer sur l'autre.

## Comptes et synchronisation (GitHub Pages)

Le build hébergé peut proposer de vrais comptes (plusieurs personnes, données isolées les unes des autres) synchronisés sur tous les appareils, via [Supabase](https://supabase.com) (Postgres + Auth, offre gratuite suffisante pour cet usage). Tant que ce n'est pas configuré, `index.html` se comporte exactement comme avant (localStorage seul, pas d'écran de connexion).

Pour l'activer :

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL du projet, exécuter `supabase/schema.sql` (crée la table `app_state` avec les règles de sécurité RLS : chacun·e ne voit que sa propre ligne).
3. Dans Authentication → Providers → Email, décider si l'inscription reste ouverte à qui connaît l'URL du site (par défaut) ou si tu préfères la désactiver et inviter chaque personne toi-même (recommandé pour un cercle restreint) — le fichier `supabase/schema.sql` rappelle où ce réglage se trouve.
4. Récupérer l'URL du projet et la clé publique (« anon » / « publishable », Settings → API) et les renseigner dans `src/auth.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY` — cette clé est prévue pour être exposée côté client, la sécurité vient des règles RLS, pas du secret de la clé).
5. `python3 build.py`, puis republier `index.html`.

Une fois configuré, ouvrir `index.html` affiche un écran de connexion/inscription avant le tableau de bord.

Comment la synchronisation se comporte :

- Chaque modification part au bout d'une seconde ; les autres appareils la voient dans les 30 s (ou au retour sur l'onglet).
- Deux appareils modifiés en même temps, ou l'un hors ligne : les modifications sont **fusionnées**, pas écrasées. Une entrée supprimée d'un côté mais modifiée de l'autre est conservée.
- Hors ligne, l'app continue de fonctionner et affiche « Non synchronisé » ; tout part au retour du réseau. Une coupure ne déconnecte pas.
- Importer une sauvegarde remplace l'état du compte (sur tous les appareils), sans fusion.
- Se déconnecter envoie d'abord ce qui attend, puis efface de l'appareil les données, la conversation avec l'assistant et la clé API. Les données restent isolées par compte (RLS) ; l'artefact claude.ai (`selene.html`) n'est pas concerné et continue de fonctionner sans connexion (même code partagé, mais `auth.js` ne s'active que hors claude.ai).
