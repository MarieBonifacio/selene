# Jeux de données de recette

Des sauvegardes Selene **synthétiques** : aucun contenu personnel, aucun secret, aucune adresse réelle. Chaque fichier est
produit par un générateur à partir des fonctions du noyau (`src/core`), donc conforme au format du commit de référence, et
vérifié à chaque `npm run recette` : une sauvegarde s'importe, un fichier `refus-*` est refusé, un export Instagram est
reconnu. Les dates sont passées et choisies pour que l'effet d'un fichier ne dépende pas du jour d'exécution (un rappel
« en retard » le reste) ; un cas qui exige une date relative (`J-1`…) le dit et fait les saisies lui-même.

**Importer** : Réglages → Compte et données → Sauvegarde → Importer, puis « Confirmer » à « Remplacer tout l'état actuel par
celui du fichier ? ». Sur un compte, cela remplace l'état **sur tous ses appareils** : de préférence en mode « sans
compte », ou sur un compte de recette dédié, jamais sur un compte qui porte de vraies données.

| Fichier | Contenu | Cas qui l'emploient |
|---|---|---|
| [jeu-essai.json](jeu-essai.json) | Le jeu de référence, au format 8 : treize espaces (Boîte, Chantier, Yoga, Écriture, Plantes, Budget, Tableau, Sources, Motifs, Décisions, Musique, Arc, Carnet), deux domaines (« Maison », « Création »), des fragments liés qui parlent de « lisière » et de « brume » (et un, du 18 août 2026, de « phalène », motif épuisé), un rappel en retard (Plantes), une décision à réexaminer, des enveloppes de budget ; assistant éteint, tous les espaces partagés. | La plupart des cas (préconditions communes) |
| [ancien-format-1.json](ancien-format-1.json) | Une sauvegarde d'une très ancienne version : tâches encore dans le document `board`, modules historiques (`kundalini`, `moth`, `phidippus` renommé « Aragne »). L'import doit la migrer : la tâche « Poser le velux » rejoint le Chantier. | [DON-003](../manuels/donnees-sauvegardes.md#don-003), [DON-006](../manuels/donnees-sauvegardes.md#don-006) |
| [refus-version-future.json](refus-version-future.json) | Une sauvegarde qui se dit au format 99 : à refuser (une version plus ancienne ne doit jamais écraser des données qu'elle ne comprend pas). | [DON-004](../manuels/donnees-sauvegardes.md#don-004) |
| [refus-hostile.json](refus-hostile.json) | Un identifiant de module piégé (`"><img src=x onerror=alert(1)>`) et une note contenant `<script>` : à refuser, sans rien exécuter. | [DON-005](../manuels/donnees-sauvegardes.md#don-005), [TRV-008](../manuels/transverse.md#trv-008) |
| [rlm-a-configurer.json](rlm-a-configurer.json) | Une Boîte et un suivi « Reprendre la main » nommé « Carnet du soir », pas encore configuré, non partagé avec l'assistant. Permet tout l'usage quotidien du suivi en mode « sans compte ». | [RLM-004](../manuels/reprendre-la-main.md#rlm-004), RLM-005, RLM-007 à RLM-012, RLM-015 à RLM-017, [RLM-019](../manuels/reprendre-la-main.md#rlm-019) |
| [rlm-en-cours.json](rlm-en-cours.json) | « Carnet du soir », alcool : objectif « au plus 2 verres standard » dès le 1er septembre 2026, puis « au plus 1,5 » dès le 20 ; le 10 septembre, 1,5 verre (« Repas de famille ») et 1 verre, journée confirmée ; le 11, une envie (intensité 6, « Après le travail », appui « Marcher quelques minutes », jugé utile) et une action, journée confirmée à zéro ; le 12, 1 verre non confirmé. Gardé « sur l'appareil » : restauré, l'appareil qui l'importe en devient le détenteur. | [DON-001](../manuels/donnees-sauvegardes.md#don-001), [RLM-002](../manuels/reprendre-la-main.md#rlm-002), [RLM-006](../manuels/reprendre-la-main.md#rlm-006), [RLM-013](../manuels/reprendre-la-main.md#rlm-013), [RLM-014](../manuels/reprendre-la-main.md#rlm-014), [RLM-018](../manuels/reprendre-la-main.md#rlm-018), [RLM-020](../manuels/reprendre-la-main.md#rlm-020), [RLM-021](../manuels/reprendre-la-main.md#rlm-021), [RLM-025](../manuels/reprendre-la-main.md#rlm-025), [RLM-028](../manuels/reprendre-la-main.md#rlm-028) |
| [rlm-synchronise-ancien.json](rlm-synchronise-ancien.json) | « Carnet du soir », tabac, observer, **encore synchronisé** avec un accord daté du 1er septembre 2026 (`storage: "account"`, `consent`), 3 cigarettes le 15 septembre (« Pause café »). | [RLM-024](../manuels/reprendre-la-main.md#rlm-024) |
| [instagram-posts_1.json](instagram-posts_1.json) | Un export Instagram synthétique, avec l'encodage abîmé de Meta (« PhalÃ¨ne… » pour « Phalène… ») et un carrousel dont le titre contient `<img src=x onerror=alert('recette')>`. | [EXT-011](../manuels/connexions.md#ext-011), [TRV-008](../manuels/transverse.md#trv-008) |
| [instagram-reels.json](instagram-reels.json) | Un reel daté du 21 juin 2026, sans titre. | [EXT-011](../manuels/connexions.md#ext-011) |
| [coffre-markdown/](coffre-markdown/) | Un petit coffre Obsidian : « Le seuil.md » (en-tête : date du 5 janvier 2024, `statut: hypothèse`, alias « Seuil », lien `[[La lisière\|lisière]]`), « 2024-02-10 Lecture.md » (date dans le nom, lien `[[Seuil]]`, image intégrée, texte piégé), « 202403011530 Idée.md » (identifiant Zettlr, commentaire `%% %%`), et `.obsidian/workspace.md`, à ignorer. | [MOD-026](../manuels/types-de-module.md#mod-026) |

<a id="volume"></a>
## Volume

Le **jeu de volume** n'est pas versionné (plus de 3 Mo) : on le produit à la demande.

```sh
npm run recette -- donnees     # écrit dist/recette/volume.json
```

C'est le jeu d'essai augmenté de **4 000 fragments** dans Écriture et de **1 500 notes** dans la Boîte, datés du
1er janvier 2023 au 30 septembre 2026, au texte pseudo-aléatoire déterministe (le même fichier à chaque exécution), avec
quelques mots du jeu d'essai (« lune », « porte », « lisière », « brume »…) pour que motifs et recherche aient de quoi
travailler. Le document `site` pèse environ 3,5 Mo : au-dessus du seuil d'alerte (3 Mo), sous la limite du serveur
(5 Mo). Le plus ancien fragment contient le mot unique `aulne-NAV006`. Le générateur vérifie que le fichier s'importe.

Cas qui l'emploient : [NAV-006](../manuels/navigation-reglages.md#nav-006), [MOD-025](../manuels/types-de-module.md#mod-025),
[PEN-011](../manuels/penser-avec.md#pen-011), [DON-009](../manuels/donnees-sauvegardes.md#don-009),
[TRV-007](../manuels/transverse.md#trv-007).

## Ajouter ou modifier un jeu

1. Modifier le générateur, `scripts/recette-jeux.mjs`, plutôt que le fichier : il construit chaque jeu avec les fonctions
   du noyau, si bien qu'un format qui évolue casse le générateur, pas silencieusement les cas. Puis
   `npm run recette -- jeux` (déterministe : sans changement, git ne voit rien).
2. Aucun contenu réel : ni nom, ni adresse, ni texte copié d'une vraie personne ; les adresses en `example.test`.
3. Un fichier qui doit être refusé commence par `refus-` ; un export Instagram par `instagram-`.
4. Décrire le fichier dans la table ci-dessus (contenu, cas) : `npm run recette` signale un fichier non décrit.
5. Changer un fichier existant oblige à relire les résultats attendus des cas qui l'emploient (colonne de droite).
