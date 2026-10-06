# Maintenir le cahier de recette

Un cahier de recette qui n'est pas tenu à jour devient pire qu'absent : il fait croire qu'une règle est vérifiée alors
qu'elle a changé. Ces règles le gardent juste ; `npm run recette` vérifie ce qui se vérifie mécaniquement, la relecture de
la PR fait le reste. La liste de contrôle courte vit dans le modèle de PR (`.github/pull_request_template.md`).

## Principes

- **Les identifiants sont stables.** `CPT-007` désigne la même règle pour toujours : on ne renumérote jamais, on ne
  réutilise jamais un identifiant retiré, on ne déduit rien de l'ordre. Un cas nouveau prend le numéro libre suivant de
  son fichier (le plus grand jamais attribué, retirés compris, plus un).
- **Définitions et résultats sont séparés.** Les cas (`manuels/`) disent ce qui doit se passer ; les comptes rendus
  (`comptes-rendus/`) disent ce qui s'est passé, une campagne par fichier, jamais réécrit.
- **L'inventaire ne décrit que ce qui existe.** Un test proposé va dans le [backlog](backlog.md), jamais dans
  [automatises.md](automatises.md). Un test décrit l'est d'après ses assertions, pas d'après son nom.
- **Le cahier suit le code, la documentation suit le cahier.** Quand un cas découvre que la documentation dit autre
  chose, on le note (contradiction dans [perimetre.md](perimetre.md), correction dans le [backlog](backlog.md#documentation)) ;
  on ne corrige pas l'app pour la faire coller au cahier sans décision.
- **Pas de code de test recopié.** Un cas renvoie au test par son identifiant et son fichier ; il ne colle pas ses lignes.

## Selon le changement

### Une nouvelle fonctionnalité

1. Ajouter ses cas dans le fichier du domaine (`manuels/`), au format complet (le modèle : n'importe quel cas existant) :
   fonctionnalité et règle, objectif et risque, priorité, plateformes, préconditions, données concrètes, automatisés
   associés, source, étapes avec un résultat observable par étape, état final, nettoyage. Une incertitude s'écrit
   `[À ARBITRER]` avec la question exacte, et rejoint les [décisions en attente](backlog.md#decisions).
2. Un nouveau domaine : un nouveau fichier et un nouveau préfixe de trois lettres, déclarés dans la table du
   [README](README.md#ce-que-contient-le-dossier) (le script lit les préfixes là).
3. Ajouter la ligne de chaque cas dans la table du haut du fichier et dans la [matrice](matrice.md), avec son état de
   couverture.
4. Relier les tests automatiques dans les deux sens : « Automatisés associés » du cas, colonne « Cas manuels » de
   l'inventaire.
5. Mettre à jour la cartographie de [perimetre.md](perimetre.md#cartographie-fonctionnelle) (statut *disponible*,
   *partielle*…).
6. Si un jeu de données doit changer : modifier `scripts/recette-jeux.mjs`, puis `npm run recette -- jeux`, puis décrire
   le fichier dans [donnees/README.md](donnees/README.md).

### Une modification de comportement

1. Retrouver les cas concernés : par la [matrice](matrice.md) (colonne des tests touchés par la PR), par la recherche du
   nom de la fonction ou du texte d'interface dans `docs/recette/`.
2. Mettre à jour leurs résultats attendus, leurs données et leur ligne « Source » ; garder l'identifiant tant que le cas
   vérifie la même règle.
3. Si la règle elle-même disparaît ou change de nature (le cas vérifierait autre chose) : **retirer** l'ancien cas et en
   créer un nouveau (voir « Une suppression »).
4. Relancer `npm run recette`.

### La correction d'une anomalie

1. Le cas qui reproduit l'anomalie existe-t-il ? Sinon, le créer depuis les étapes du ticket.
2. Ajouter un test automatique qui échoue avant la correction et passe après, quand c'est raisonnable ; le décrire dans
   l'inventaire et le relier au cas ; mettre à jour l'état de la ligne dans la matrice.
3. Dans [perimetre.md](perimetre.md#anomalies-et-observations), compléter la ligne de l'anomalie par « Corrigée : PR …,
   commit … » ; ne pas supprimer la ligne. Dans le [backlog](backlog.md), barrer l'élément lié et le dater.

### Une nouvelle automatisation

1. Lire les assertions du test, puis l'ajouter à [automatises.md](automatises.md) : identifiant (`TU-<CODE>-nn`, numéro
   libre suivant ; `TN-<fichier>` pour un scénario ; `TD-…`, `TR-…`, `TS-…`), chemin, nom exact, ce qu'il vérifie
   réellement, ce qui est simulé, s'il tourne en CI, ses limites, les cas manuels liés.
2. Relier les cas manuels (dans les deux sens) ; revoir l'état de couverture de leurs lignes dans la matrice (une ligne ne
   passe à *couvert automatiquement* que si chaque étape du cas a son résultat principal vérifié en CI).
3. Barrer l'élément du backlog qui la proposait, avec la date et la PR.

### Une suppression (fonctionnalité, cas ou test)

- **Un cas** : retirer son bloc et sa ligne de table, ajouter son identifiant à la ligne « Identifiants retirés » de son
  fichier, avec la date et la raison (`CPT-016 (2026-12-01, inscription par lien magique abandonnée)`) ; retirer sa ligne
  de la matrice et sa mention dans l'inventaire. L'historique reste dans git.
- **Un test** : retirer sa ligne ou sa fiche de l'inventaire et ajouter son identifiant à la ligne « Identifiants retirés »
  d'[automatises.md](automatises.md) ; retirer sa mention des cas manuels ; revoir l'état de couverture des lignes
  concernées (un cas qui perd son seul test passe à *documenté pour recette manuelle*).
- **Une fonctionnalité** : ses cas et ses tests, comme ci-dessus ; son statut dans [perimetre.md](perimetre.md).

### Un changement de CI ou d'outils

- Mettre à jour la section « La CI » et la colonne « En CI » d'[automatises.md](automatises.md), les critères d'entrée de
  [campagnes.md](campagnes.md) si un job est renommé, la table « Référence de version » du [README](README.md#référence-de-version)
  si une version d'outil change (Node, Playwright, Deno, Rust).
- Un test sorti de la CI (désactivé, filtré, rendu manuel) se dit dans l'inventaire (« États particuliers ») ; jamais en
  silence.

### Un changement de format des données (`SCHEMA_VERSION`)

Régénérer les jeux (`npm run recette -- jeux`) ; relire les cas qui les emploient (colonne de droite de
[donnees/README.md](donnees/README.md)) ; ajouter si besoin un jeu de l'ancien format pour le cas de migration ;
rejouer [donnees-sauvegardes.md](manuels/donnees-sauvegardes.md) et [synchronisation.md](manuels/synchronisation.md) en
non-régression ciblée.

## La vérification de cohérence

```sh
npm run recette              # vérifie ; code de sortie 1 et la liste des écarts s'il y en a
npm run recette -- jeux      # régénère docs/recette/donnees/*.json (déterministe : sans changement du noyau, git ne voit rien)
npm run recette -- donnees   # écrit dist/recette/volume.json, le jeu de volume (non versionné)
npm run recette -- page      # écrit dist/recette/cahier.html, le cahier en une page (non versionnée)
```

La page `dist/recette/cahier.html` se lit sans le dépôt : sommaire, « Aller à » un cas ou un test, liens internes,
états de couverture. Elle est publiée en artefact (<https://claude.ai/artifact/KjK5krMMJve526HKuiUEgn>, privé à la
responsable, qui choisit avec qui le partager) ; après une PR qui change le cahier, la régénérer et la republier à la
même adresse. C'est une vue : le cahier fait foi ici, et la page dit de quel commit elle vient.

Ce que `npm run recette` vérifie (`scripts/recette.mjs`, sans réseau ni navigateur, en quelques secondes) :

- les cas : identifiant unique, au préfixe de son fichier, jamais un identifiant retiré, tous les champs du format, au
  moins une étape numérotée, plateformes connues, table du fichier d'accord avec les cas (priorité, plateformes) ;
- l'inventaire : chaque test Node (`test(…)`), chaque scénario de navigateur, chaque test Deno et Rust du dépôt y figure ;
  aucun scénario inventorié n'a disparu ; aucun test retiré n'y est encore décrit ;
- le lien cas ↔ tests dans les deux sens, et la matrice (une ligne par cas, les mêmes tests, un état défini) ;
- chaque lien relatif des documents de recette et du modèle de PR : fichier présent, ancre présente (ancres calculées
  comme GitHub) ;
- les totaux annoncés : ceux du tableau de tête de l'inventaire (tests Node et fichiers, scénarios, tests Deno et Rust)
  et le décompte des cas par état de la matrice, comparés à ce que le dépôt contient (deux PR qui ajoutent chacune un test
  écrivent le même nouveau total sans conflit, et faux une fois fusionnées) ;
- les jeux de données : chaque sauvegarde s'importe, chaque `refus-*` est refusé, chaque export Instagram est reconnu,
  chaque fichier est décrit dans `donnees/README.md`.

Ce qu'il ne vérifie pas : qu'un résultat attendu est juste, qu'un test passe (il ne lance aucun test), que la description
d'un test correspond à ses assertions. Cela reste la relecture de la PR. La CI le lance à chaque pull request (job *Check › recette*, voir
[BL-12](backlog.md#bl-12)) ; il fait aussi partie de `npm run check`.

## Liste de contrôle (aussi dans le modèle de PR)

- [ ] Comportement modifié : cas manuels mis à jour (attendus, données, source), ou « aucun cas concerné ».
- [ ] Nouvelle fonctionnalité : cas ajoutés (format complet), ligne de matrice, cartographie du périmètre.
- [ ] Test ajouté, modifié ou supprimé : inventaire et lien avec les cas mis à jour.
- [ ] Anomalie corrigée : cas de reproduction, test automatique si raisonnable, anomalie marquée corrigée.
- [ ] CI ou outils changés : inventaire et référence de version à jour.
- [ ] `npm run recette` vert.
