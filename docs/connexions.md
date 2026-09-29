# Connexions externes

Selene reste une page statique : tout ce qui vient du dehors passe par le navigateur, qui ne lit la réponse d'un autre
domaine que si ce domaine l'autorise (en-tête CORS `Access-Control-Allow-Origin`). Les API modernes le font souvent,
les flux RSS presque jamais : ceux-là attendront un petit intermédiaire (phase 2, une fonction Supabase fermée).
L'artefact claude.ai ne sort pas : ces fonctions n'existent que dans la version hébergée.

## Principes

- **Tirer, jamais pousser.** Rien n'arrive sans qu'on le demande : un bouton, une vue ouverte. Pas de pastille, pas de fil infini.
- **Quatre niveaux** : une *référence* s'affiche et s'oublie ; un *cache* vit sur l'appareil (30 jours) ; une *archive*
  est ce qu'on a gardé (synchronisée) ; un *import* devient une donnée Selene. Supabase ne reçoit que les deux derniers.
- **La Source** : un élément de collection qui porte `src = { url, doi, site, date }`. Elle n'a pas de statut
  épistémique (un article n'est pas une affirmation de l'utilisatrice) ; on la relie à un fragment par « documente ».
- **Aucun secret dans le code publié.** Une clé personnelle se saisit et reste sur l'appareil, comme la clé Anthropic.
- **Chaque service peut disparaître** (Pocket, Omnivore, l'API Instagram des comptes personnels l'ont fait) : ce qui a
  été gardé l'est dans Selene, pas chez eux.

## Phase 1 : presque gratuit (sans intermédiaire, sans compte)

**5a : Sources**
- [x] Modèle « Sources » (collection, drapeau `sources`) : titre, auteurs, type, résumé et notes, statuts À lire / Lue / Utilisée.
- [x] Coller un lien ou un DOI, « Chercher » : un DOI est complété par Crossref (sans clé), une page par Microlink
      (25 par jour sans clé ; il voit l'adresse demandée). Aperçu, puis « Garder ». Hors ligne ou quota épuisé : gardée
      avec son adresse seule.
- [x] Adresse normalisée (traceurs `utm_*`, `fbclid`… retirés), doublons reconnus par DOI ou adresse.
- [x] Une note de la boîte qui contient un lien ou un DOI : « Garder comme source », avec sa provenance.
- [x] Envoyer à Selene depuis ailleurs : `?url=&title=&text=` à l'ouverture dépose une note dans la boîte ;
      partage Android (Web Share Target du manifeste), favori « Envoyer à Selene » et Raccourci iOS (Réglages). Sur la
      version hébergée, le lien attend la connexion au compte avant d'être déposé (jamais dans le vide).

**5b : Musique**
- [x] Drapeau `music` d'une collection (artiste en titre, album en sous-titre ; réglable, posé sur Musique et le modèle
      « Musique ») ; `mb = { a, rg, y }` validé (identifiants MusicBrainz, année).
- [x] « préciser l'album » ou « discographie » : l'artiste cherché dans MusicBrainz (choix s'il y a homonymie), sa
      discographie studio (albums et EP, sans live ni compilation) avec pochettes ; « choisir » ou « ajouter ».
- [x] « Nouvelles sorties », à la demande : pour chaque artiste relié, les parutions depuis la dernière vérification
      (sur l'appareil ; la première fois, l'année écoulée). Jamais en arrière-plan.
- [x] Une requête par seconde au plus, en file (règle de MusicBrainz) ; pochettes de Cover Art Archive en `<img>`
      (pas besoin de CORS, seulement de la CSP `img-src`) ; une pochette absente s'efface.

**5c : Ciel et chantier**
- [x] Étoiles filantes : les six grandes pluies (calendrier de l'IMO), une ligne sous le ciel la veille et le soir du
      maximum, avec leur taux théorique (ZHR) et la réserve qui s'impose : bien moins en ville, et la lune en efface
      la plupart quand elle est éclairée à plus de 60 %.
- [x] Éclipses visibles depuis Lille jusqu'en 2030, en table fixe (aucun réseau), annoncées une semaine avant ;
      seulement si le lieu réglé est dans le Nord de la France ou en Belgique, là où la table vaut. « Jamais sans
      lunettes d'éclipse » pour le Soleil. Une ligne d'événement renforce le voile de lecture (elle descend sur les arbres).
- [x] Pluie sur une tâche à ciel ouvert : des mots réglables par module (« extérieur, balcon, jardin… », cherchés dans
      le titre et le lieu) ; la pluie des cinq prochains jours (1 mm ou 60 % au moins), « le jour prévu » si l'échéance
      tombe dessus, sinon « sec jusqu'à ». Aucun appel de plus : la prévision quotidienne vient avec la météo du ciel.

**5d : Radar culturel**
- [x] Réglages → Radar culturel : tes mots (`config.radar.words`, 300 caractères au plus, synchronisés).
- [x] Sur l'accueil, un bouton « Radar culturel » (seulement avec des mots et un lieu près de Lille) : les
      événements OpenAgenda du portail open data de la MEL (Opendatasoft, API Explore v2.1, sans clé) des deux
      semaines à venir, à 20 km du lieu du ciel. **Le portail reçoit la zone et les dates, jamais les mots** : le tri
      se fait sur l'appareil (titre, mots-clés, description, lieu ; sans accents ni casse).
- [x] Cinq au plus, du plus tôt au plus tard ; le reste est compté (« des mots plus précis choisiraient mieux »),
      jamais déroulé. « voir » ouvre l'événement à part ; « garder » le dépose dans la boîte (titre, date, lieu, lien).
- [x] Cache de six heures sur l'appareil ; si le portail refuse la sélection de champs (400 : un champ renommé),
      second essai sans elle ; muet : dit, et « Réessayer ». Adresse d'événement gardée seulement si elle est en https.
- [x] Vérifié en conditions réelles le 29 septembre 2026 : le jeu et ses champs sont bien ceux attendus, mais le portail
      **n'envoie pas d'en-tête CORS** (la requête marche ouverte à la main, pas depuis une page). Le radar passe donc
      par le passeur (genre `json`) quand la lecture directe est refusée, et le retient pour la session.

**5e : Mémoire éditoriale**
- [x] Dans les réglages de toute collection : « Importer un export Instagram » (un ou plusieurs fichiers JSON :
      `posts_1.json`, `reels.json`). Lu sur l'appareil, rien n'est envoyé ; les stories sont ignorées.
- [x] Encodage de Meta réparé (UTF-8 relu comme du Latin-1 : « Ã© » redevient « é », les émojis reviennent).
- [x] Chaque publication devient un élément au dernier statut (« Publié ») : première ligne de la légende en titre,
      légende entière en texte, jour de publication en date ; `ig = { t, k }` (instant, post ou reel) validé.
- [x] Confirmation avant tout (combien, de quand à quand, où) ; un second import n'ajoute que les nouvelles.
- Pas de lien : l'export n'en contient pas (seulement le chemin local des médias). La légende et la date, oui.

## Phase 2 : Selene connectée (le passeur, et quelques clés à toi)

**6a : Le passeur** (voir [passeur.md](passeur.md))
- [x] Une fonction Supabase Edge, `supabase/functions/passeur` : `feed`, `page`, `ics`. Fermée (session vérifiée, comptes
      de `PASSEUR_USERS`, sinon personne ; origines de `PASSEUR_ORIGINS`), protégée contre la SSRF (IP écrites ou
      résolues, redirections revérifiées), 2 Mo, 8 secondes, texte seulement, GET conditionnel, rien de gardé.
- [x] Testée avec Deno (garde et parcours complet, faux réseau et faux DNS), en CI (job `passeur`).
- [x] Fiche Source : une page passe par le passeur (OpenGraph, balises `citation_*`, JSON-LD, adresse canonique du
      même site) ; un DOI trouvé dans la page est complété par Crossref ; le flux annoncé est repéré. Passeur absent
      ou refusé : Microlink, sans insister.
- [x] Réglages → Passeur : état, « Vérifier », ton identifiant à copier.
- [x] Déploiement automatisable : `.github/workflows/passeur.yml` (jeton dans les secrets du dépôt, tests Deno d'abord).
- [x] Déployé le 29 septembre 2026 par le workflow (jeton et identifiant dans GitHub) ; « Vérifier » : reconnu.

**6b : Dehors**
- [x] Une vue fixe, « Dehors » (navigation, palette), dans la version hébergée connectée. Suivre l'adresse d'un flux ou
      d'un site (sa page annonce son flux : découverte), rangé sous un projet ; aussi depuis l'aperçu d'une source.
- [x] RSS 2.0, RSS 1.0, Atom, JSON Feed, lus par DOMParser en XML (rien ne s'exécute) ; liens http(s) seulement.
- [x] Le nouveau depuis le « vu jusqu'à » de chaque flux (synchronisé ; au premier abonnement, la semaine écoulée),
      **douze au plus**, groupés par projet, le reste compté ; « Tout marquer comme vu ». Sur l'accueil, une ligne de
      texte, seulement s'il y a du nouveau.
- [x] Pour chaque élément : **garder** (une Source, avec sa provenance « Dehors »), **vers une note**, **vu**.
- [x] Par flux : « seulement ce qui touche mes motifs » (la concordance existante ; le motif est nommé).
- [x] Relecture par le passeur, un flux à la fois, en GET conditionnel (ETag, Last-Modified), au plus toutes les trois
      heures, à l'ouverture (onglet visible) ou sur demande. Le contenu reste sur l'appareil, un mois au plus.
- [x] Newsletters : Kill the Newsletter donne un flux Atom par adresse (conseil affiché, pas pour du courrier privé).

**6c : Artist Watch**
- [x] Dans Dehors, une case : « Les sorties de mes artistes » (synchronisée, `config.dehors.artists`). Les artistes
      reliés à MusicBrainz dans tes collections de musique, trente au plus (les plus récemment ajoutés).
- [x] Une fois par semaine, à l'ouverture (ou « Relire maintenant ») : leurs parutions depuis la dernière vérification
      (la même mémoire que « Nouvelles sorties » ; la première fois, le mois écoulé), une requête par seconde.
      Directement auprès de MusicBrainz (CORS ouvert) : pas besoin du passeur.
- [x] Ces sorties comptent à partir du jour où on les découvre, pas de leur date de parution (MusicBrainz les enregistre
      souvent après coup) ; rangées sous le module de musique, avec « ajouter à Musique » au lieu de « garder ».

**6d : Research Watch**
- [x] Dans Dehors, « Veille de recherche » : des recherches (« depersonalization ») et des auteurs (identifiant OpenAlex
      ou ORCID), trente au plus, rangés par projet, synchronisés (`config.dehors.research`).
- [x] Une fois par semaine (ou « Relire maintenant ») : ce qui est paru depuis la dernière relecture (la première fois,
      le mois écoulé), dix au plus par veille, directement auprès d'OpenAlex (CORS ouvert, pas de passeur). Comptés à
      partir de leur découverte (OpenAlex indexe avec retard) ; revue, auteurs, date et résumé (index inversé remis
      en ordre) affichés.
- [x] « Garder » : une Source avec son DOI, sa revue, ses auteurs, et la provenance « Veille : … ».
- [x] Clé OpenAlex **facultative** : sans elle, une petite limite quotidienne ; une clé gratuite la décuple. Saisie
      par toi, gardée dans ce navigateur, jamais synchronisée ; quota épuisé : dit, avec le remède.
- [x] La veille ne classe rien selon ce qui te donnerait raison, et le dit à l'écran.
- [x] Se déconnecter efface aussi la clé OpenAlex et tout ce que le dehors a apporté sur l'appareil.

**6e : Calendrier dédié**
- [x] Réglages → Calendrier : l'adresse iCal secrète d'un calendrier dédié (Google : « Adresse secrète au format iCal » ;
      Apple : lien webcal, converti en https). C'est une capacité au porteur : **dans ce navigateur seulement**, jamais
      synchronisée, jamais réaffichée, effacée à la déconnexion ; elle ne voyage que vers ton passeur, qui ne garde rien.
- [x] Lue par le passeur au plus une fois par heure (onglet visible) ; iCalendar lu juste assez : lignes repliées,
      journées entières, fuseaux (TZID), récurrences simples (RRULE, EXDATE, exceptions déplacées) ; ce qui est fini
      depuis plus d'un jour n'est pas gardé.
- [x] Sous « Aujourd'hui » : aujourd'hui (ce qui n'est pas encore passé) et demain, huit au plus par jour. « Chantier :
      plombier » se range sous Chantier (le préfixe de la Capture). Selene ne devient pas un agenda.

**6f : Zotero** (lecture seule)
- [x] Réglages → Zotero : une clé créée sur zotero.org avec « Allow library access » seulement ; dans ce navigateur,
      jamais synchronisée, effacée à la déconnexion. « Vérifier » dit à qui elle est, et signale une clé qui peut écrire.
- [x] Dans un module de Sources : chercher dans ta bibliothèque (titre, auteur, année) ou voir les dix dernières fiches ;
      « garder » crée une Source reliée à sa fiche (`zot = { k, l }`, validé), avec DOI, revue, auteurs et date ; un
      lien « Zotero ↗ » y ramène. Doublons reconnus par DOI, adresse ou clé Zotero. Rien n'est importé en masse.
- [x] L'appel part directement vers api.zotero.org (clé en en-tête) ; si le navigateur n'a pas le droit d'en lire la
      réponse (CORS, non documenté par Zotero), le passeur relaie (genre `json`, clé dans l'adresse, jamais journalisée).

## Phase 3 : intelligence ambiante (faire travailler ce qui est déjà gardé)

**7a : Sources oubliées, et des Sources qui documentent**
- [x] Une Source se relie enfin à ce qu'elle documente : « documente… » (sa ligne, sa fiche, sa carte dans les sortes)
      vers une note ou un fragment ; en marge de celui-ci, « documenté par ». Le modèle Sources le promettait ; le
      formulaire « lier… » n'offrait que notes et fragments.
- [x] Les sortes tirent aussi une **source gardée puis reliée à rien**, pondérée par l'oubli depuis le jour où elle a été
      gardée (`kept`, validé ; sinon la date de sa provenance ; sans date, au seuil de quatorze jours) : « gardée il y a
      2 lunaisons, jamais relue ». Reliée, elle quitte le bassin.

**7b : ce que tes sources ont en commun (OpenAlex)**
- [x] À la demande, dans un module de Sources (dès deux sources à DOI) : « Ce que tes sources ont en commun ». OpenAlex
      reçoit les DOI, par lots de cinquante, rien d'autre (ni titres, ni notes, ni adresses).
- [x] **Cité par plusieurs de tes sources** : les références communes (citées par au moins deux de tes sources, hors tes
      sources elles-mêmes), la plus citée d'abord, avec qui les cite ; « garder » en fait une Source (provenance
      « Cité par tes sources »). Gardée, elle rejoint le corpus et cesse d'être une suggestion.
- [x] **Tes sources qui se parlent** : le couplage bibliographique (Kessler, 1963), deux sources qui partagent au moins
      deux références.
- [x] **Ces auteurs reviennent** : un auteur présent dans au moins deux de tes sources ; « suivre dans la veille » l'ajoute
      à Research Watch (version hébergée), sous son nom (`name`, facultatif, validé).
- [x] Cache de l'appareil (`selene-cites`, effacé à la déconnexion) : bibliographies et titres gardés trente jours ; une
      source retirée emporte le sien ; un DOI inconnu d'OpenAlex n'est pas redemandé avant un mois ; un lot refusé
      (400) passe pour inconnu au lieu de tout bloquer.

**7c : motifs croisés dans Dehors (pertinence explicable)**
- [x] Ce qui croise ce que tu gardes passe devant, avec la raison en toutes lettres (« parce que : … ») : un **motif**
      (tous les flux, plus seulement ceux filtrés), un **auteur de tes sources** (veille OpenAlex ; les trois premiers
      auteurs, deux mots au moins ; pas pour la veille d'un auteur, qui l'est par construction), **une de tes sources
      citée** (veille OpenAlex, d'après le cache de 7b), un **lien paru dans deux flux** (« aussi dans… »). Le plus de
      raisons d'abord ; à égalité, et pour tout le reste, le plus récent. Aucun score caché, aucune raison inventée.
- [x] Le même lien (DOI, sinon adresse sans traceurs) paru dans deux flux n'apparaît qu'une fois ; « vu » l'écarte
      partout. Déjà dans tes sources : « déjà gardée » au lieu de « garder ».
- [x] Des références d'un article de veille, le cache de l'appareil ne garde que celles qui sont tes sources (cinq au plus).

**7d : Dehors dans la planche de lunaison**
- [x] Une section « Venu du dehors » : les sources gardées pendant le cycle (`kept`), comptées par provenance (Dehors,
      Veille, Cité par tes sources, Zotero, depuis une note, à la main), et les cinq premières nommées. Ce qui a été lu
      puis laissé n'y figure pas : Dehors ne date pas ses « vu », et une planche n'a pas à tenir le registre de ce qu'on
      a eu raison d'ignorer. À l'impression, la règle se resserre pour que la planche tienne toujours sur une page A4.

**7e : dossier de passation enrichi des DOI**
- [x] Dans le dossier (fragments, recherche, tension), une entrée dit quelles sources la documentent (`*Documenté par :
      [S1], [S2]*`) ; une source qui figure elle-même dans le dossier renvoie à sa référence. En fin de dossier, une
      section « Références » : auteurs (année). *Titre*. Revue. `https://doi.org/…`, sinon l'adresse ; « Anonyme » et
      « s. d. » quand on ne sait pas. Numérotées dans l'ordre de première citation ; l'en-tête YAML les compte
      (`references`). Le préambule rappelle qu'une source qui documente une entrée ne la prouve pas.

La phase 3 est terminée.
