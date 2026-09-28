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
- [ ] À vérifier en conditions réelles : les noms de champs viennent des facettes publiques du jeu, l'environnement
      de développement n'atteignant pas le portail.

**5e : Mémoire éditoriale** : l'export Instagram (JSON) importé dans une collection (légende, date, lien).

## Phase 2 et 3

Voir l'exploration du 28 septembre 2026 : l'intermédiaire (flux, pages, calendrier), Dehors, veille de recherche
(OpenAlex), Artist Watch, newsletters ; puis motifs croisés, « cité par tes sources », sources oubliées.
