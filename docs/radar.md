# Radar culturel : contrat et diagnostic

## Source vérifiée le 30 septembre 2026

- Catalogue : https://public.opendatasoft.com/explore/dataset/evenements-publics-openagenda/
- API : https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records
- Contrat API : https://help.opendatasoft.com/apis/ods-explore-v2/
- États OpenAgenda : https://developers.openagenda.com/evenements/structure/
- Attribution : OpenAgenda ; catalogue public Opendatasoft, Licence Ouverte v1.0 annoncée dans les métadonnées.

L'ancien domaine `opendata.lillemetropole.fr` redirige vers l'accueil HTML de `data.lillemetropole.fr`,
sans conserver le chemin API. Remplacer uniquement le domaine renvoie 404. Le relais CORS ne répare pas cela.
Le catalogue public renvoie du JSON sans clé et `Access-Control-Allow-Origin: *`. Une lecture autour de
50.6, 3.1, du 30 septembre au 14 octobre 2026, a renvoyé 1 378 candidats sur 14 pages (1 316 lors de la lecture précédente) ; les occurrences détaillées doivent
encore être filtrées : 1 247 événements possédaient une occurrence dans la fenêtre. Des événements ont un `updatedat` du 29 septembre 2026. La métadonnée globale
`data_processed` affiche pourtant 2024 : ne pas confondre cette valeur avec la fraîcheur de chaque événement.

`tests/fixtures/radar-openagenda.json` conserve deux enregistrements de cette source, limités aux champs utiles,
pour tester son contrat sans réseau ni dépendance à la date d'exécution. Les textes publics sont attribués à
OpenAgenda via la source ci-dessus et leurs URL canoniques dans la fixture.

## Contrat conservé

Le noyau reste dans `src/core/radar.js` (pur) ; l'orchestration et les vues dans le bloc radar de `src/types.js`.
Transport direct, puis passeur existant uniquement en cas d'échec réseau ; aucune clé, SDK ou nouveau serveur.
La CSP nomme uniquement le nouveau domaine. Stockage par `platform.storage`, compatible avec les coffres natifs.
Les préférences `config.radar.words` et les notes déjà gardées ne changent pas de format.

- Périmètre produit : lieu choisi dans Ciel à moins de 35 km de Lille (50.63, 3.06), puis rayon de recherche
  de 20 km autour de ce lieu arrondi au dixième. Pas une limite administrative ni une garantie d'exhaustivité.
- Requête sans mots personnels, champs explicites ; tri `firstdate_begin,uid`, pages de 100 via `offset`.
- `results` et `total_count` obligatoires, dates valides ; un schéma incompatible n'est jamais un agenda vide.
- `timings` est un tableau encodé en JSON ; prochaine occurrence dans la fenêtre, dates en Europe/Paris.
  Sans détail, la plage est indicative. États programmés/reprogrammés acceptés ; en ligne, reportés,
  complets ou annulés écartés. Une séance reprogrammée est indiquée dans la vue.
- Recherche locale sur titre, tous les mots-clés, description courte et longue, lieu et ville.
  Mots entiers et expressions, accents/casse neutralisés ; pas de moteur sémantique ni de synonymes implicites.
- Cinq propositions au plus. Une fermeture, une nouvelle recherche ou une déconnexion invalide l'ancien chargement.

## Limites explicites

20 pages maximum (2 000 candidats), 2 Mio par réponse directe, 16 Mio cumulés avant arrêt de pagination (le lot déjà lancé peut dépasser ce seuil),
90 secondes pour le direct, trois pages simultanées au plus. Le passeur conserve sa limite propre ; un appel au relais déjà engagé peut finir
après l'annulation, mais sa réponse ne peut plus modifier l'interface ni remplir le cache.
Si la source bouge pendant la pagination (total modifié), si une page échoue ou si une limite est atteinte,
les résultats sont partiels, avec le nombre lu ; ils ne sont pas mis en cache comme complets.
La pagination par offset ne garantit pas un instantané atomique si le fournisseur modifie des enregistrements
à total constant pendant la lecture. Déduplication globale par UID et ordre stable réduisent ce risque.

Cache v2, six heures, uniquement pour les lectures complètes et valides ; un cache v1 est ignoré.
« Actualiser » le contourne. Un quota de stockage refusé n'empêche pas l'affichage.
La dépendance à un fournisseur public implique des quotas et des indisponibilités possibles ; les états vides,
les erreurs et les lectures partielles restent distincts.

## Vérifier

- `node --test tests/radar*.test.js` : contrat, vrais champs, pagination, cache, limites et erreurs.
- `node tests/browser/run.js radar` : interface, filtrage, confidentialité des mots, sauvegarde, relais et erreurs.
- Contrôle réel séparé de la CI : construire l'URL par `radarUrl({lat:50.6,lon:3.1}, 'AAAA-MM-JJ')`, lire les pages,
  vérifier HTTP, type JSON, CORS, `total_count`, `timings` et une date `updatedat` récente via les champs complets.
  Le portail public peut être indisponible sans que le code ait régressé : ne pas rendre la CI dépendante du réseau.
