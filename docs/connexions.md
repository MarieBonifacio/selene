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

**5b : Musique** : discographies MusicBrainz (1 requête par seconde, sans clé) et pochettes Cover Art Archive (en image).

**5c : Ciel et chantier** : pluie prévue sur une tâche extérieure (Open-Meteo) ; étoiles filantes et éclipses visibles
depuis Lille, en table fixe (aucun réseau).

**5d : Radar culturel** : événements de la Métropole de Lille (OpenData MEL, OpenAgenda), filtrés par tes mots.

**5e : Mémoire éditoriale** : l'export Instagram (JSON) importé dans une collection (légende, date, lien).

## Phase 2 et 3

Voir l'exploration du 28 septembre 2026 : l'intermédiaire (flux, pages, calendrier), Dehors, veille de recherche
(OpenAlex), Artist Watch, newsletters ; puis motifs croisés, « cité par tes sources », sources oubliées.
