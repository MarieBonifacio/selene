# Cahier de recette de Selene

Le référentiel qualité de Selene : ce qu'il faut essayer à la main, ce que les tests automatiques vérifient vraiment,
ce qui relie l'un à l'autre, et ce qui manque. Il complète la documentation technique ([architecture.md](../architecture.md#vérification))
et la liste des démarches manuelles ([a-faire.md](../a-faire.md)) ; il ne remplace ni l'une ni l'autre.

Ce que ce cahier n'est pas : une preuve. Un cas manuel écrit n'a pas été exécuté ; un test automatique qui existe ne
valide pas toute la fonctionnalité qu'il touche. Seuls les comptes rendus de campagne disent ce qui a été essayé, quand,
sur quoi et avec quel résultat.

## Référence de version

| | |
|---|---|
| Rédigé à partir de | `main`, commit `768eb34` (4 octobre 2026), format des données `SCHEMA_VERSION` 8 |
| Outils de test à cette date | Node 22, Playwright 1.56.1 (Chromium 141, WebKit en CI), Deno 2.9.6, Rust (cœur Tauri), Python 3 |
| Mise à jour | à chaque PR qui change un comportement, un test ou la CI ([maintenance.md](maintenance.md)) |

Pour savoir quelles règles valaient lors d'une ancienne campagne : son compte rendu note le commit testé et celui du
cahier ; `git log -- docs/recette/` et `git show <commit>:docs/recette/…` rendent le cahier tel qu'il était alors.

## Ce que contient le dossier

| Document | Rôle |
|---|---|
| [perimetre.md](perimetre.md) | La cartographie fonctionnelle : ce qui est disponible, partiel, sur une autre branche ou seulement envisagé ; les contradictions relevées entre documentation, code et tests ; les anomalies constatées pendant l'analyse. |
| [manuels/](manuels/) | Les cas de recette manuelle, un fichier par domaine (voir ci-dessous). |
| [automatises.md](automatises.md) | L'inventaire vérifié des tests automatiques : ce que chacun vérifie, ce qu'il simule, où et quand il tourne. |
| [matrice.md](matrice.md) | La traçabilité : fonctionnalité ou règle, risque, cas manuels, tests automatiques, couverture réelle, action. |
| [campagnes.md](campagnes.md) | Les trois campagnes (smoke, non-régression ciblée, recette complète), leurs critères d'entrée et de sortie. |
| [comptes-rendus/](comptes-rendus/) | Le modèle de compte rendu et l'historique des campagnes, un fichier par campagne, jamais réécrit. |
| [backlog.md](backlog.md) | Les lacunes et les automatisations à prioriser. |
| [maintenance.md](maintenance.md) | Les règles qui gardent ce cahier juste au fil des évolutions, et la vérification de cohérence. |
| [donnees/](donnees/) | Des jeux de données synthétiques à importer pour préparer un état initial reproductible. |

Les cas manuels, par domaine :

| Fichier | Préfixe | Domaine |
|---|---|---|
| [entree-et-comptes.md](manuels/entree-et-comptes.md) | `CPT` | Premier lancement, sans compte, connexion, mot de passe, session, déconnexion, suppression du compte |
| [navigation-reglages.md](manuels/navigation-reglages.md) | `NAV` | Navigation, palette, recherche, Réglages, langue, apparence |
| [espaces.md](manuels/espaces.md) | `ESP` | Créer, renommer, ranger, désactiver, supprimer un espace ; boîte de réception |
| [types-de-module.md](manuels/types-de-module.md) | `MOD` | Tâches, budget, programme et paliers, écriture, rappels, notes et tri, collections, décisions, motifs, arc, capture, minuteur, « Annuler », brouillons |
| [penser-avec.md](manuels/penser-avec.md) | `PEN` | Statut épistémique, provenance, liaisons et tensions, pont de reprise, fiche, carte, dossier, sortes, bilan, test lunaire, vocabulaire, planche |
| [donnees-sauvegardes.md](manuels/donnees-sauvegardes.md) | `DON` | Export, import, refus d'import, migrations, stockage de l'appareil, taille |
| [synchronisation.md](manuels/synchronisation.md) | `SYN` | Deux appareils, hors ligne, conflits, fermeture, version ancienne, hors-ligne de la PWA |
| [connexions.md](manuels/connexions.md) | `EXT` | Sources, musique, ciel et météo, radar, Instagram, passeur, Dehors, veilles, calendrier, Zotero, « Envoyer à Selene » |
| [assistant.md](manuels/assistant.md) | `AST` | Clé, partage, accord avant écriture, panne |
| [reprendre-la-main.md](manuels/reprendre-la-main.md) | `RLM` | Le suivi des addictions « Reprendre la main » |
| [plateformes.md](manuels/plateformes.md) | `PLT` | PWA, apps Android, iOS et Windows, artefact claude.ai, notifications, widget, partage |
| [transverse.md](manuels/transverse.md) | `TRV` | Accessibilité, dates et fuseaux, volumes, sécurité, confidentialité, page publique de test |

## Lancer une campagne

1. Choisir la campagne ([campagnes.md](campagnes.md)) : smoke avant toute mise en ligne, ciblée pour une PR, complète avant
   une livraison importante (une version des stores, une ouverture de bêta).
2. Vérifier les critères d'entrée : CI verte sur le commit à tester, environnement et comptes de recette prêts (plus bas).
3. Copier [comptes-rendus/modele.md](comptes-rendus/modele.md) en `comptes-rendus/AAAA-MM-JJ-<campagne>.md`, y noter le
   commit testé, le commit du cahier, l'environnement et la liste des cas.
4. Exécuter chaque cas tel qu'écrit, noter le résultat réellement observé, pas celui qu'on attendait.
5. Ouvrir un ticket par écart (titre, cas, étapes, observé, attendu, plateforme), le lier dans le compte rendu.
6. Conclure selon les critères de sortie, avec les réserves, et verser le compte rendu dans une PR.

## Conventions

### Identifiants

- **Cas manuel** : `PRÉFIXE-nnn` (`RLM-007`). Le numéro est attribué une fois, dans l'ordre d'écriture ; il ne dépend ni du
  titre ni de la place du cas dans son fichier. Un cas déplacé garde son numéro ; un cas retiré passe dans la liste des
  identifiants retirés de son fichier et son numéro n'est jamais réattribué.
- **Test automatique** : `TU-CODE-nn` (test unitaire Node, un par `test(…)`), `TN-<fichier>` (scénario de navigateur, un
  par fichier de `tests/browser/`), `TD-CODE-nn` (test Deno des fonctions serveur), `TR-TAU-nn` (test Rust du cœur Tauri),
  `TS-NOM` (contrôle statique, script ou compilation). Mêmes règles : jamais renumérotés, jamais réattribués. Un fichier de
  scénario renommé garde son identifiant.

### Priorité

| Priorité | Définition | Conséquence d'un échec |
|---|---|---|
| **P1, critique** | Perte, corruption ou fuite de données ; sécurité ; confidentialité du suivi sensible ; parcours essentiel impossible (entrer, capturer, retrouver, synchroniser, sauvegarder). | Bloque la livraison. |
| **P2, majeure** | Fonctionnalité importante dégradée, sans perte de données ; un contournement existe. | Livraison sous réserve écrite, avec un ticket daté. |
| **P3, mineure** | Confort, présentation, cas rare. | N'empêche pas la livraison. |

### Plateformes

| Code | Plateforme |
|---|---|
| `Web` | Navigateur d'ordinateur, version hébergée (GitHub Pages) : Chrome ou Edge (Chromium), Safari (WebKit) |
| `Mob` | Navigateur ou PWA installée sur téléphone : Safari sous iOS, Chrome sous Android |
| `AND` | App Android (Capacitor) |
| `IOS` | App iOS (Capacitor, TestFlight) |
| `WIN` | App Windows (Tauri) |
| `ART` | Artefact claude.ai (`selene.html`) |

« Hébergées » désigne `Web`, `Mob`, `AND`, `IOS` et `WIN` : tout ce qui n'est pas l'artefact. Firefox n'est ni cité ni
testé par le dépôt : sa prise en charge est à clarifier ([perimetre.md](perimetre.md#points-à-arbitrer)).

### Source du comportement attendu

Chaque cas dit d'où vient son résultat attendu : **[DOC]** une page de `docs/` ou le README, **[CODE]** le code à la date
de référence, **[TEST]** l'assertion d'un test automatique, **[RÈGLE]** une règle confirmée par la responsable du produit,
**[À ARBITRER]** une question ouverte, posée en toutes lettres. Un comportement seulement observé n'est pas un attendu : un
cas dont la seule source est [CODE] décrit le comportement actuel, qui peut être un défaut.

### États

- **Résultat d'exécution** (comptes rendus) : *non exécuté*, *réussi*, *échoué*, *bloqué* (impossible à mener : préalable
  manquant, environnement indisponible), *non applicable* (la plateforme ou la configuration ne s'y prête pas, avec la
  raison). Bloqué n'est jamais réussi.
- **Couverture** (matrice) : *couvert automatiquement*, *couvert partiellement*, *documenté pour recette manuelle*, *non
  couvert*, *à clarifier*, *hors périmètre*.
- **Statut d'une fonctionnalité** (périmètre) : *disponible*, *partielle*, *autre branche ou PR*, *envisagée*.

## Environnement et données de recette

Ne jamais exécuter un cas sur un compte ou un appareil qui porte de vraies données : beaucoup de cas importent une
sauvegarde (ce qui remplace tout l'état du compte, sur tous ses appareils), suppriment un espace ou un compte.

- **Comptes** : deux comptes dédiés à la recette (A et B), créés par invitation dans le projet Supabase, aux adresses qui
  ne servent qu'à ça, mots de passe de 10 caractères au moins. Les cas de « Reprendre la main » qui testent l'offre de
  l'espace demandent un compte marqué `selene_personnel` ([regulation.md](../regulation.md#hors-de-loffre-publique)) :
  marquer un compte de recette plutôt que le compte personnel est à décider par la responsable.
- **Mesures à ne pas polluer** : sur chaque appareil de recette connecté, couper « Compter mes jours d'usage, pour la bêta »
  (Réglages → Compte et données) avant tout essai, et exclure les comptes de recette des requêtes de la bêta
  ([compte.md](../compte.md#mesure-dusage-bêta)). Sur la page publique de test, toujours ajouter `?src=recette` à
  l'adresse, pour que ces visites se reconnaissent et s'effacent.
- **Navigateur** : un profil dédié (ou une fenêtre privée quand le cas le permet), outils de développement disponibles
  pour l'onglet Réseau, le stockage et la simulation hors ligne.
- **Jeux de données** : [donnees/](donnees/) fournit des sauvegardes synthétiques (aucun contenu personnel, aucun secret),
  vérifiées par `npm run recette`. Les importer dans Réglages → Compte et données → Sauvegarde → Importer, en mode
  « sans compte » de préférence.
- **Date** : beaucoup d'écrans dépendent du jour (accueil, bilan, sept derniers jours). Les jeux de données n'utilisent
  que des dates passées choisies pour que leur effet ne dépende pas du jour d'exécution (un rappel ou une décision
  « en retard » le restent) ; un cas qui exige une date précise le dit.
