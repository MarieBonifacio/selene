# Campagnes de recette

Trois campagnes, du plus court au plus complet. Toutes s'exécutent sur un commit identifié, déjà vert en CI, avec les
comptes et les données de recette ([README](README.md#environnement-et-données-de-recette)), et se terminent par un compte
rendu tiré de [comptes-rendus/modele.md](comptes-rendus/modele.md). Les durées sont des estimations pour une personne
qui connaît l'app, pas des engagements.

## Ce qui vaut pour toutes

**Critères d'entrée** (tous requis, notés dans le compte rendu) :

1. Le commit à tester est identifié (branche, empreinte) et déployé là où la campagne s'exécute : GitHub Pages pour le
   web, artefacts de l'onglet *Actions* (ou TestFlight) pour les apps, `selene.html` publié pour l'artefact.
2. La CI de ce commit est verte : *Check › build-and-test* et *Check › browser* (Chromium **et** WebKit), plus les
   workflows des plateformes visées (*Android*, *iOS*, *Desktop*). Un rouge connu et accepté est écrit en réserve dès
   l'entrée.
3. `npm run recette` passe sur le commit du cahier utilisé : le cahier est cohérent avec les tests qu'il cite (la CI le vérifie
   sur chaque PR, job *Check › recette*).
4. Les comptes de recette (A, B ; P pour « Reprendre la main » ; une clé Anthropic de recette pour l'assistant) et les
   appareils de recette sont prêts ; « Compter mes jours d'usage, pour la bêta » est coupé sur chaque appareil connecté.
5. Les jeux de données sont disponibles ; le jeu de volume est régénéré au commit testé (`npm run recette -- donnees`).
6. Le gestionnaire de tickets est accessible (un ticket par écart).

**Résultats possibles d'un cas** : *réussi*, *échoué* (un résultat observé diffère du résultat attendu : ticket
obligatoire), *bloqué* (impossible à mener : préalable manquant, environnement indisponible ; la cause est écrite),
*non applicable* (la plateforme ou la configuration ne s'y prête pas ; la raison est écrite), *non exécuté* (pas encore
fait). **Bloqué n'est jamais réussi**, et un cas non exécuté à la clôture compte comme non passé.

**Décision** : *go*, *go avec réserves* (chaque réserve écrite : l'écart, son ticket, qui l'accepte, jusqu'à quand), ou
*no-go*. La décision appartient à la responsable du produit ; le compte rendu donne les faits.

**Un écart** : un ticket par écart, avec le cas, la plateforme, les étapes, le résultat observé, le résultat attendu, la
preuve (capture, vidéo, extrait de console ou de Network) ; jamais de donnée personnelle ni de secret dans la preuve.
Un écart dont la cause est le cahier (attendu faux, étape ambiguë) se corrige dans le cahier, pas dans l'app, et se note
comme tel ([maintenance.md](maintenance.md)).

---

<a id="smoke"></a>
## Smoke

**Quand** : avant chaque mise en ligne du site, chaque version d'une app, chaque publication de l'artefact. **But** :
vérifier en une heure environ que rien d'essentiel n'est cassé et qu'aucune donnée n'est exposée. **Où** : le web sur
ordinateur, plus un téléphone (PWA ou app selon la livraison).

| Ordre | Cas | Ce qu'il garantit |
|---|---|---|
| 1 | [CPT-002](manuels/entree-et-comptes.md#cpt-002) | L'app s'ouvre sans compte, rien ne part au serveur |
| 2 | [NAV-001](manuels/navigation-reglages.md#nav-001) | La navigation sur téléphone |
| 3 | [ESP-003](manuels/espaces.md#esp-003) | Créer un espace |
| 4 | [MOD-001](manuels/types-de-module.md#mod-001) | Le type le plus utilisé (tâches) |
| 5 | [MOD-014](manuels/types-de-module.md#mod-014) | La capture rapide |
| 6 | [MOD-022](manuels/types-de-module.md#mod-022) | « Annuler » après une suppression |
| 7 | [NAV-004](manuels/navigation-reglages.md#nav-004) | La recherche |
| 8 | [DON-001](manuels/donnees-sauvegardes.md#don-001) | Exporter une sauvegarde complète |
| 9 | [DON-002](manuels/donnees-sauvegardes.md#don-002) | L'importer : tout est remplacé, sur les deux appareils du compte A |
| 10 | [DON-005](manuels/donnees-sauvegardes.md#don-005) | Un fichier hostile est refusé |
| 11 | [SYN-001](manuels/synchronisation.md#syn-001) | Une saisie passe d'un appareil à l'autre (comptes A) |
| 12 | [SYN-005](manuels/synchronisation.md#syn-005) | Une saisie juste avant de fermer n'est pas perdue |
| 13 | [CPT-013](manuels/entree-et-comptes.md#cpt-013) | Se déconnecter : ce qui attend part, l'appareil est vidé |
| 14 | [RLM-020](manuels/reprendre-la-main.md#rlm-020) | Aucun détail du suivi sensible hors de son espace |
| 15 | [TRV-008](manuels/transverse.md#trv-008) | Un texte piégé reste du texte |
| 16 | [TRV-009](manuels/transverse.md#trv-009) | Aucune violation de CSP, aucun hôte non déclaré |

**Selon la livraison**, ajouter : [PLT-003](manuels/plateformes.md#plt-003) (version Android),
[PLT-008](manuels/plateformes.md#plt-008) (version iOS), [PLT-010](manuels/plateformes.md#plt-010) (version Windows),
[PLT-011](manuels/plateformes.md#plt-011) et [AST-009](manuels/assistant.md#ast-009) (artefact),
[AST-002](manuels/assistant.md#ast-002) (changement de l'assistant).

**Critères de sortie** : tous les cas de la smoke *réussis*. Un seul *échoué* ou *bloqué* : *no-go*, sauf un cas *non
applicable* à la livraison (justifié). Pas de « go avec réserves » en smoke : une smoke qui échoue ne se négocie pas, elle
se corrige ou elle ne part pas.

---

<a id="ciblee"></a>
## Non-régression ciblée

**Quand** : sur une PR qui change un comportement, avant sa fusion ; après la correction d'une anomalie. **But** :
vérifier ce que la PR touche et ce qui en dépend, sans rejouer tout le cahier. **Durée** : de trente minutes à une
demi-journée selon la PR.

**Choisir les cas**, dans cet ordre :

1. Le cas qui reproduit l'anomalie corrigée (créé s'il n'existe pas, [maintenance.md](maintenance.md)).
2. Les cas des domaines que la PR touche, d'après les fichiers modifiés :

   | Fichiers modifiés | Domaines à rejouer (fichiers de cas) |
   |---|---|
   | `src/app/services/auth.js`, `supabase/functions/compte/` | [entree-et-comptes.md](manuels/entree-et-comptes.md) |
   | `src/app/shell/`, `src/app/views/`, `src/app/i18n/` | [navigation-reglages.md](manuels/navigation-reglages.md) |
   | `src/app/registry.js`, `src/core/domain.js` (registre, modèles) | [espaces.md](manuels/espaces.md) |
   | `src/app/modules/<type>.js`, `src/core/domain.js` (règles d'un type) | [types-de-module.md](manuels/types-de-module.md), cas du type |
   | `src/app/features/` (motifs, carte, dérive, sortes, planche, bilan, relecture) | [penser-avec.md](manuels/penser-avec.md) |
   | `src/core/markdown.js` (import de notes), `src/core/biblio.js` (export des sources) | [MOD-026](manuels/types-de-module.md#mod-026), [EXT-020](manuels/connexions.md#ext-020) |
   | `src/core/backup.js`, migrations, `SCHEMA_VERSION` | [donnees-sauvegardes.md](manuels/donnees-sauvegardes.md) **et** [synchronisation.md](manuels/synchronisation.md) |
   | `src/app/state/`, fusion, `src/platform.js` | [synchronisation.md](manuels/synchronisation.md), [donnees-sauvegardes.md](manuels/donnees-sauvegardes.md) |
   | Sources, musique, ciel, radar, Instagram, passeur, Dehors, veille, calendrier, Zotero | [connexions.md](manuels/connexions.md), cas du service |
   | `src/app/features/assistant.js`, `supabase/functions/assistant/` | [assistant.md](manuels/assistant.md) |
   | `src/core/regulation.js`, `src/app/modules/regulation.js`, `src/app/state/local.js` | [reprendre-la-main.md](manuels/reprendre-la-main.md), **tous les P1** |
   | `src/native/`, `native/android/`, `native/ios/`, `native/tauri/` | [plateformes.md](manuels/plateformes.md), cas de la plateforme |
   | `build.py`, CSP, `sw.js`, `confidentialite.html`, `privacy.html`, `essai.html` | [TRV-009](manuels/transverse.md#trv-009), [TRV-012](manuels/transverse.md#trv-012), [TRV-013](manuels/transverse.md#trv-013) |
   | `supabase/schema.sql` | [TRV-016](manuels/transverse.md#trv-016), [synchronisation.md](manuels/synchronisation.md) |

3. Dans ces domaines : les cas P1 et P2. Un cas *couvert automatiquement* ([matrice.md](matrice.md)) peut être sauté si
   la CI de la PR est verte et si la PR ne modifie pas ses tests ; le compte rendu le dit.
4. Les cas dont les tests automatiques associés ont été modifiés ou supprimés par la PR.

**Critères de sortie** : aucun cas P1 *échoué* ni *bloqué* ; chaque P2 ou P3 *échoué* a son ticket et une réserve acceptée
par la responsable ; décision écrite dans la PR (lien vers le compte rendu).

---

<a id="complete"></a>
## Recette complète

**Quand** : avant une livraison importante (une version des stores, l'ouverture de la bêta à de nouvelles personnes, un
changement de format des données), et au moins une fois par trimestre. **But** : tout le cahier, sur chaque plateforme
livrée. **Durée estimée** : quatre à cinq jours-personne pour le web et un téléphone, plus une demi-journée par app native
et une demi-journée pour l'artefact.

**Ordre conseillé** (il réduit les préparations de données) :

1. Transverse non destructif d'abord, sur le jeu d'essai : TRV-009, TRV-012, TRV-014, TRV-003, TRV-006, TRV-001, TRV-002.
2. Entrée et comptes (CPT) avec les comptes A et B ; puis navigation (NAV), espaces (ESP), types de module (MOD), penser
   avec (PEN), sur le jeu d'essai ; le jeu de volume à la fin (NAV-006, MOD-025, PEN-011, DON-009, TRV-007).
3. Données et sauvegardes (DON), synchronisation (SYN) sur deux appareils.
4. Connexions (EXT), assistant (AST).
5. « Reprendre la main » (RLM) : le chemin S pour l'usage quotidien, puis le chemin P (compte P, deux appareils).
6. Plateformes (PLT) sur appareils réels ; artefact.
7. Le reste du transverse : TRV-004, TRV-005, TRV-007, TRV-008, TRV-010, TRV-011, TRV-013, TRV-015, TRV-016 (ce
   dernier par la personne qui administre Supabase).

**Critères de sortie** :

- chaque cas a un résultat (aucun *non exécuté*) ; *non applicable* seulement pour une plateforme non livrée, justifié ;
- aucun P1 *échoué* ; aucun P1 *bloqué* sans acceptation écrite de la responsable (avec la raison et la date de levée) ;
- chaque P2 *échoué* a son ticket et figure dans les réserves ; les P3 *échoués* ont leur ticket ;
- les anomalies et les questions [À ARBITRER] du [backlog](backlog.md#decisions) ont été relues : chacune est tranchée, ou
  reportée en réserve ;
- le compte rendu est versé dans `comptes-rendus/` par une PR.

---

## Ce qu'aucune campagne ne remplace

La CI : une campagne manuelle ne remplace jamais un rouge de la CI, et un vert de la CI ne remplace jamais les cas
manuels *couverts partiellement* (serveur simulé, coquille simulée, une seule plateforme). La matrice dit, ligne à ligne,
ce que l'automatique prouve et ce qu'il laisse à la main.
