# Types de module

Ce que fait chaque type d'espace, et les gestes communs (capture, « Annuler », brouillons, minuteur). Vaut pour toutes les
cibles, artefact compris, sauf mention.

**Préconditions communes** : le jeu [`donnees/jeu-essai.json`](../donnees/jeu-essai.json) importé, en mode sans compte. Il
contient notamment : Chantier (cinq tâches, dont « Repeindre la rambarde du balcon » en retard, à 120 €, avec trois
étapes), Budget (enveloppes Courses 300 € et Travaux 500 € ; opérations de septembre 2026), Yoga (programme commencé le
3 août 2026, dernière séance de 25 min), Écriture (mode « total », chapitres Prologue et La forêt, six fragments), Plantes
(Arrosage tous les 3 jours, en retard), Tableau (colonnes Idée → Publié), Décisions (une décision échue), Motifs, Musique,
Arc, Carnet, et une Boîte de six notes. Les opérations du Budget sont en septembre 2026 : « Mois précédent » y mène.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [MOD-001](#mod-001) | Tâches : créer, étapes, effort, coût, échéance, regroupement, filtre | P1 | Web, Mob, ART |
| [MOD-002](#mod-002) | Étoile « Aujourd'hui » : trois tâches au plus, tous modules confondus | P1 | Web, Mob, ART |
| [MOD-003](#mod-003) | Terminer une tâche à coût : proposition d'ajout au budget | P2 | Web, Mob |
| [MOD-004](#mod-004) | « Tirer une petite tâche au sort » | P3 | Web, Mob |
| [MOD-005](#mod-005) | Budget : opérations, jauges, mois, filtre, montants invalides | P1 | Web, Mob, ART |
| [MOD-006](#mod-006) | Budget : renommer ou supprimer une enveloppe | P2 | Web, Mob |
| [MOD-007](#mod-007) | Programme : séance notée, calendrier, « Noter N min » depuis l'accueil | P2 | Web, Mob |
| [MOD-008](#mod-008) | Paliers : critères cochés à la main, passage voulu, décision préremplie | P2 | Web, Mob |
| [MOD-009](#mod-009) | Écriture en mode total : la différence, les coupes, le même total | P1 | Web, Mob, ART |
| [MOD-010](#mod-010) | Écriture : fin estimée sur trente jours | P3 | Web, Mob |
| [MOD-011](#mod-011) | Atelier d'écriture : chapitres, filtre, export Markdown | P2 | Web, Mob |
| [MOD-012](#mod-012) | Palimpseste : modifier un fragment garde ses versions | P2 | Web, Mob |
| [MOD-013](#mod-013) | Rappels : types, fréquences, « fait » depuis l'accueil | P2 | Web, Mob |
| [MOD-014](#mod-014) | Capture rapide et ses trois motifs reconnus | P1 | Web, Mob, AND, IOS, WIN, ART |
| [MOD-015](#mod-015) | Ranger une note de la boîte dans un espace | P2 | Web, Mob |
| [MOD-016](#mod-016) | Trier la boîte une note à la fois | P2 | Web, Mob |
| [MOD-017](#mod-017) | Collection en colonnes : avancer, glisser, clavier, téléphone | P2 | Web, Mob |
| [MOD-018](#mod-018) | Collection : champs, statuts, titre obligatoire | P2 | Web, Mob |
| [MOD-019](#mod-019) | Décisions : rendez-vous de révision, « relire », « maintenue » | P2 | Web, Mob |
| [MOD-020](#mod-020) | Motifs : concordance, voisins, jachère | P2 | Web, Mob |
| [MOD-021](#mod-021) | Arc : placer, étape vide, retirer, supprimer une étape | P3 | Web, Mob |
| [MOD-022](#mod-022) | « Annuler » après une suppression ; ⌘Z ou Ctrl+Z | P1 | Web, Mob, ART |
| [MOD-023](#mod-023) | Brouillons : survivent à la fermeture, s'effacent une fois gardés | P2 | Web, Mob, AND, IOS |
| [MOD-024](#mod-024) | Minuteur de quinze minutes et la suite proposée | P3 | Web, Mob |
| [MOD-025](#mod-025) | Longues listes : cent, puis « Voir les suivants » | P3 | Web, Mob |
| [MOD-026](#mod-026) | Importer des notes Markdown (Obsidian, Zettlr) | P2 | Web, Mob, ART |

Identifiants retirés : aucun.

---

<a id="mod-001"></a>
### MOD-001 — Tâches : créer, étapes, effort, coût, échéance, regroupement, filtre

- **Fonctionnalité et règle** : une tâche a un titre obligatoire, un lieu (« Pièce » dans Chantier), un type, une date
  butoir, un effort, un coût facultatif, des étapes ; le registre en tête regroupe par pièce avec un pourcentage fait.
- **Objectif, risque vérifié** : tâche perdue ou mal enregistrée (étapes, coût).
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai.
- **Données** : `Fixer la tringle` ; pièce `Chambre` ; type Bricolage ; date butoir dans 3 jours ; effort « Moyen » ; coût `40` ;
  étapes `Percer` et `Visser` (une par ligne).
- **Automatisés associés** : `TN-taches`
- **Source** : [DOC] README, « Modules » ; [TEST] `tests/browser/taches.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Chantier. | Les tâches non faites, l'échéance en retard de « Repeindre la rambarde du balcon » signalée (« En retard de … j ») ; « 1/3 étapes » ; « 120 € » ; un registre par pièce (Balcon, Salon, Salle de bain, Jardin…). |
| 2 | « Ajouter une tâche », remplir les données, « Enregistrer ». | La tâche apparaît dans « Cette semaine », avec « 0/2 étapes » et « 40 € » ; la pièce « Chambre » apparaît dans le registre. |
| 3 | Cocher l'étape « Percer » de la nouvelle tâche. | « 1/2 étapes ». |
| 4 | Cliquer « Chambre » dans le registre. | Seules les tâches de la Chambre restent ; recliquer défait le filtre. |
| 5 | « Ajouter une tâche », titre vide, « Enregistrer ». | Refus (champ obligatoire) ; rien d'ajouté. |
| 6 | Recharger. | La tâche et son étape cochée sont toujours là. |

- **État final attendu** : une tâche de plus.
- **Nettoyage** : la supprimer.

---

<a id="mod-002"></a>
### MOD-002 — Étoile « Aujourd'hui » : trois tâches au plus, tous modules confondus

- **Fonctionnalité et règle** : l'étoile « Faire aujourd'hui » est plafonnée à trois tâches tous modules de tâches
  confondus ; l'accueil les réunit ; une tâche faite quitte l'étoile.
- **Objectif, risque vérifié** : plafond contourné par un second module ; tâche faite qui encombre « Aujourd'hui ».
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai ; créer un second espace du modèle « Tâches » nommé `Bureau` avec une tâche `Classer les factures`.
- **Données** : aucune de plus.
- **Automatisés associés** : `TN-taches`, `TU-DOM-01`
- **Source** : [DOC] README, « Tâches » ; [TEST] `tests/browser/taches.js`, `TU-DOM-01`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dans Chantier, cliquer l'étoile ★ de trois tâches non faites. | Les trois étoiles sont allumées. |
| 2 | Ouvrir l'accueil. | « Aujourd'hui » liste ces trois tâches. |
| 3 | Dans Bureau, cliquer l'étoile de « Classer les factures ». | « Trois, c'est le plafond. Termine ou retire-en une. » ; l'étoile reste éteinte. |
| 4 | Dans Chantier, cocher « Marquer comme fait » sur une des trois. | Elle quitte l'étoile ; l'accueil n'en montre plus que deux. |
| 5 | Dans Bureau, rallumer l'étoile. | Acceptée ; l'accueil montre les tâches des deux modules. |

- **État final attendu** : trois tâches du jour, dont une de Bureau.
- **Nettoyage** : supprimer Bureau ; réimporter le jeu d'essai.

---

<a id="mod-003"></a>
### MOD-003 — Terminer une tâche à coût : proposition d'ajout au budget

- **Fonctionnalité et règle** : terminer une tâche qui a un coût propose de l'ajouter en dépense, enveloppe devinée
  (« Travaux »).
- **Objectif, risque vérifié** : dépense oubliée ; dépense ajoutée sans accord.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : tâche « Poser une étagère » (35 €).
- **Automatisés associés** : `TU-MOD-34`, `TN-recherche-minuteur`
- **Source** : [DOC] README, « Tâches → Budget » ; [TEST] `TU-MOD-34`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Cocher « Marquer comme fait » sur « Poser une étagère ». | Message « Fait. 35,00 € estimés : les passer au budget (Travaux) ? » avec un bouton. |
| 2 | Laisser passer le message sans cliquer. | Aucune opération ajoutée au Budget. |
| 3 | Sous « Fait récemment », « annuler » sur la tâche, puis la recocher ; cette fois cliquer le bouton du message (C11). | « Ajouté à Budget. L'argent, lui, était déjà parti. » ; le Budget du mois en cours montre une dépense de 35,00 € dans Travaux, note « Poser une étagère ». |

- **État final attendu** : tâche faite ; une dépense de 35 €.
- **Nettoyage** : supprimer la dépense ; « annuler » la tâche sous « Fait récemment ».

---

<a id="mod-004"></a>
### MOD-004 — « Tirer une petite tâche au sort »

- **Fonctionnalité et règle** : sans tâche choisie, l'accueil propose de tirer une tâche au sort, plafond respecté.
- **Objectif, risque vérifié** : tirage qui dépasse le plafond ou tire une tâche faite.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai, aucune étoile allumée.
- **Données** : aucune.
- **Automatisés associés** : `TN-compte-neuf`, `TN-recherche-minuteur`, `TN-taches`
- **Source** : [CODE] `task-pick` (`modules/taches.js`) ; [TEST] `tests/browser/compte-neuf.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'accueil. | « Aucune tâche choisie. » et le bouton « Tirer une petite tâche au sort ». |
| 2 | Cliquer le bouton. | « Le sort a désigné : « … ». Pas de recours possible. » ; une tâche non faite apparaît dans « Aujourd'hui », étoile allumée. |
| 3 | Allumer deux autres étoiles dans Chantier, puis tirer encore (bouton « Tirer au sort » de l'espace, s'il est proposé). | « Aujourd'hui est plein. Le hasard respecte les plafonds. » |

- **État final attendu** : trois étoiles.
- **Nettoyage** : éteindre les étoiles.

---

<a id="mod-005"></a>
### MOD-005 — Budget : opérations, jauges, mois, filtre, montants invalides

- **Fonctionnalité et règle** : des opérations (dépenses, revenus) mois par mois, des enveloppes à plafond mensuel et leurs
  jauges ; un montant doit être positif.
- **Objectif, risque vérifié** : somme fausse ; montant invalide enregistré (NaN qui contamine les totaux).
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai.
- **Données** : dépense `30`, enveloppe `Courses`, note `pain` ; montants invalides `0`, `-5`, `abc`.
- **Automatisés associés** : `TN-budget`, `TU-DOM-02`
- **Source** : [DOC] README, « Budget » ; [TEST] `tests/browser/budget.js`, `TU-DOM-02`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Budget, « Mois précédent » jusqu'à septembre 2026. | Revenus 2 000,00 €, dépenses 165,00 €, solde 1 835,00 € ; jauge Courses 40 % (120 sur 300), Travaux 9 % (45 sur 500). |
| 2 | Revenir au mois en cours ; ajouter la dépense des données. | La jauge Courses du mois montre 30 sur 300 ; l'opération est listée. |
| 3 | Tenter d'ajouter `0`, puis `-5`, puis taper `abc` dans le montant. | `0` : « Un montant, même symbolique. », aucune opération ajoutée ; `-5` : une dépense de 5,00 € (le sens vient du type choisi, Dépense ou Revenu, pas du signe) ; `abc` : le champ, numérique, ne prend pas de lettres (ou les ignore : « Un montant, même symbolique. »). |
| 4 | Cliquer l'enveloppe « Courses » du registre. | Seules ses opérations restent ; recliquer défait. |
| 5 | Ouvrir l'accueil. | La ligne Budget dit « Ce mois-ci : 30,00 € dépensés, solde … ». |

- **État final attendu** : une dépense de 30 € ce mois-ci.
- **Nettoyage** : la supprimer.

---

<a id="mod-006"></a>
### MOD-006 — Budget : renommer ou supprimer une enveloppe

- **Fonctionnalité et règle** : renommer une enveloppe renomme ses opérations ; la supprimer garde les opérations.
- **Objectif, risque vérifié** : opérations orphelines ou perdues.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : renommer `Courses` en `Marché`.
- **Automatisés associés** : `TN-budget`, `TU-MOD-22`
- **Source** : [TEST] `tests/browser/budget.js`, `TU-MOD-22`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → « régler » sous Budget → renommer l'enveloppe Courses en `Marché`, quitter le champ. | Message « « Courses » s'appelle désormais « Marché ». » |
| 2 | Budget, septembre 2026. | La jauge s'appelle Marché, 120 sur 300 ; les opérations de 120 € et (août) 210 € portent « Marché ». |
| 3 | Supprimer l'enveloppe Marché (confirmer « Supprimer l'enveloppe « Marché » ? Les opérations restent. »). | La jauge disparaît ; les opérations restent, comptées dans les dépenses. |

- **État final attendu** : plus d'enveloppe Courses ni Marché ; opérations intactes.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-007"></a>
### MOD-007 — Programme : séance notée, calendrier, « Noter N min » depuis l'accueil

- **Fonctionnalité et règle** : un protocole de N semaines, un calendrier, un objectif de séances par semaine ; l'accueil
  propose « Noter N min » avec la dernière durée.
- **Objectif, risque vérifié** : séance non enregistrée, ou à la mauvaise date.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; aucune séance de Yoga aujourd'hui.
- **Données** : séance de `30` min, hier.
- **Automatisés associés** : `TN-quotidien`, `TN-types`, `TU-MOD-30`
- **Source** : [DOC] README, « Accueil » ; [TEST] `TU-MOD-30`, `tests/browser/quotidien.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'accueil. | Une ligne propose « Noter 25 min » pour Yoga (dernière durée). |
| 2 | Cliquer « Noter 25 min ». | « Séance de Yoga faite. » ; dans Yoga, une séance de 25 min datée d'aujourd'hui. |
| 3 | Dans Yoga, « Noter une séance » : 30 min, date d'hier. | La séance apparaît à la date d'hier dans le journal et le calendrier. |
| 4 | Recharger. | Les deux séances sont là. |

- **État final attendu** : deux séances de plus.
- **Nettoyage** : les supprimer.

---

<a id="mod-008"></a>
### MOD-008 — Paliers : critères cochés à la main, passage voulu, décision préremplie

- **Fonctionnalité et règle** : des critères écrits et cochés par la personne ; rien ne fait franchir un palier
  automatiquement ; « Passer au palier suivant » est le seul geste qui compte ; avec un module Décisions actif, une décision
  préremplie s'ouvre, jamais enregistrée sans validation.
- **Objectif, risque vérifié** : l'app décide à la place de la personne ; décision enregistrée à son insu.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (palier « Souffle », deux critères, et un module Décisions).
- **Données** : aucune.
- **Automatisés associés** : `TN-paliers`, `TU-MOD-56`
- **Source** : [DOC] README, « Paliers » ; [TEST] `tests/browser/paliers.js`, `TU-MOD-56`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Yoga. | Le palier « Souffle » et ses deux critères, non cochés ; « Coché ou non, rien ne fait avancer le palier à ta place. » |
| 2 | Cocher les deux critères. | « 2 sur 2 coché. Tous cochés. Le passage reste ton choix, pas une formalité automatique. » ; le palier n'a pas changé. |
| 3 | Recharger. | Toujours « Souffle », critères cochés. |
| 4 | « Passer au palier suivant ». | « Palier « Souffle » atteint. » ; « « Souffle » atteint le [date du jour] » dans l'historique ; un formulaire « Noter la décision : « Souffle » » s'ouvre, titre prérempli. |
| 5 | Annuler le formulaire. | Aucune décision ajoutée dans Décisions. |

- **État final attendu** : palier franchi, aucune décision nouvelle.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-009"></a>
### MOD-009 — Écriture en mode total : la différence, les coupes, le même total

- **Fonctionnalité et règle** : en mode « total », on saisit le total atteint et l'app enregistre la différence ; un total plus
  bas est une coupe (négative), pas une erreur ; le même total n'enregistre rien.
- **Objectif, risque vérifié** : totaux faux, double comptage.
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai (total actuel 5 300 mots).
- **Données** : totaux `6000`, puis `5800`, puis `5800`.
- **Automatisés associés** : `TU-MOD-28`, `TN-quotidien`
- **Source** : [DOC] README, « Écriture » ; [TEST] `TU-MOD-28`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Écriture, lire le total. | 5 300 mots sur 50 000 ; « Je saisis » propose « Le total atteint (l'app calcule la différence) ». |
| 2 | Saisir `6000`, « Ajouter ». | « +700 mots. Ça avance, que tu y croies ou non. » ; total 6 000. |
| 3 | Saisir `5800`. | « -200 mots. Couper, c'est aussi écrire. » ; total 5 800. |
| 4 | Saisir `5800`. | « Même total qu'avant. Rien de neuf, ou alors en silence. » ; aucune entrée ajoutée. |

- **État final attendu** : deux entrées (+700, −200).
- **Nettoyage** : les supprimer.

---

<a id="mod-010"></a>
### MOD-010 — Écriture : fin estimée sur trente jours

- **Fonctionnalité et règle** : fin estimée au rythme des trente derniers jours ; sans élan, l'app le dit au lieu d'inventer.
- **Objectif, risque vérifié** : projection absurde ou inventée.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (aucune saisie dans les trente derniers jours si le test a lieu après le 2 octobre 2026).
- **Données** : un ajout de `3000` mots aujourd'hui.
- **Automatisés associés** : `TU-MOD-29`, `TN-quotidien`
- **Source** : [TEST] `TU-MOD-29`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Écriture. | « Pas assez d'élan ces 30 derniers jours pour prédire une fin. La prophétie attendra. » |
| 2 | Ajouter 3 000 mots (total 8 300). | Une fin estimée s'affiche, avec un rythme d'environ 100 mots par jour. |

- **État final attendu** : une entrée de plus.
- **Nettoyage** : la supprimer.

---

<a id="mod-011"></a>
### MOD-011 — Atelier d'écriture : chapitres, filtre, export Markdown

- **Fonctionnalité et règle** : un fragment se rattache à un chapitre (le dernier utilisé par défaut) ; la liste se filtre ;
  supprimer un chapitre met ses fragments hors chapitre ; « Exporter en Markdown » range les fragments sous leurs chapitres.
- **Objectif, risque vérifié** : fragment perdu à la suppression d'un chapitre ; export incomplet.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : fragment `Le ruisseau coupe la lisière en deux.`
- **Automatisés associés** : `TN-atelier-capture`, `TU-MOD-36`
- **Source** : [DOC] README, « Atelier d'écriture » ; [TEST] `tests/browser/atelier-capture.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Écriture, regarder le chapitre présélectionné du champ de fragment. | Le chapitre du dernier fragment rattaché. |
| 2 | Choisir « Prologue », ajouter le fragment des données. | Il apparaît, rattaché au Prologue ; le panneau des chapitres compte un fragment de plus pour Prologue. |
| 3 | Filtrer « Par chapitre » sur « La forêt ». | Seuls les fragments de La forêt restent. |
| 4 | « Exporter en Markdown ». | Un fichier `.md` se télécharge : `## Prologue` puis ses fragments, `## La forêt` puis les siens, `## Hors chapitre` puis « Une phrase sans chapitre… ». |
| 5 | Supprimer le chapitre « Prologue » (confirmer). | Ses fragments passent « hors chapitre » ; aucun n'est supprimé. |

- **État final attendu** : un fragment de plus, chapitre Prologue supprimé.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-012"></a>
### MOD-012 — Palimpseste : modifier un fragment garde ses versions

- **Fonctionnalité et règle** : un fragment modifié garde l'ancienne version dessous, repliable, dix versions au plus (la plus
  ancienne s'efface la première) ; texte identique ou vide : pas une modification.
- **Objectif, risque vérifié** : perte d'une formulation antérieure.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : fragment « Les sapins gardent la nuit plus longtemps que les hêtres. » → `Les sapins gardent la nuit ; les hêtres la rendent.`
- **Automatisés associés** : `TU-MOD-57`
- **Source** : [DOC] README, « Palimpseste » ; [TEST] `TU-MOD-57`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur le fragment, « modifier » ; remplacer le texte ; « Enregistrer ». | « Modifié. L'ancienne version reste lisible dessous. » ; le fragment affiche le nouveau texte, « modifié aujourd'hui », et « 1 version antérieure » dépliable. |
| 2 | Déplier les versions. | L'ancien texte, daté. |
| 3 | « modifier » sans rien changer, « Enregistrer ». | Rien de nouveau : toujours une version antérieure. |
| 4 | « modifier », vider le texte, « Enregistrer ». | Refusé ou ignoré : le texte reste. |

- **État final attendu** : fragment modifié, une version antérieure.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-013"></a>
### MOD-013 — Rappels : types, fréquences, « fait » depuis l'accueil

- **Fonctionnalité et règle** : des types d'événements avec une fréquence en jours (0 = sans rappel) et un journal ;
  l'accueil propose « fait » sur un rappel en retard, une ligne par module.
- **Objectif, risque vérifié** : rappel qui ne revient pas, ou qui revient alors qu'il a été fait.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (Arrosage tous les 3 jours, dernier le 1er septembre 2026).
- **Données** : observation `Nouvelle pousse sur le ficus`.
- **Automatisés associés** : `TN-types`, `TN-quotidien`, `TN-interface`, `TU-MOD-30`
- **Source** : [DOC] README, « Accueil » ; [TEST] `tests/browser/types.js`, `TU-MOD-30`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'accueil. | Dans « Aujourd'hui », une ligne pour Plantes (Arrosage en retard) avec « fait ». |
| 2 | Cliquer « fait ». | La ligne disparaît ; dans Plantes, « Arrosage : aujourd'hui ». |
| 3 | Dans Plantes, noter l'observation des données. | Elle apparaît au journal, datée d'aujourd'hui. |
| 4 | Réglages → « régler » sous Plantes : fréquence d'Arrosage à `1`. | Le lendemain (ou en avançant la date de l'appareil d'un jour), le rappel revient sur l'accueil. |
| 5 | Rempotage (fréquence 0) : vérifier l'accueil. | Jamais de rappel pour Rempotage. |

- **État final attendu** : Arrosage fait aujourd'hui.
- **Nettoyage** : remettre la fréquence à 3.

---

<a id="mod-014"></a>
### MOD-014 — Capture rapide et ses trois motifs reconnus

- **Fonctionnalité et règle** : la capture comprend trois motifs, et seulement trois : « 12 € courses » (une dépense), « 25 min
  kundalini » (une séance dans le programme nommé), « Module : une note » ; la note part toujours d'abord dans la boîte ;
  l'app propose de la ranger (bandeau, puis « Ranger » dans la boîte).
- **Objectif, risque vérifié** : une capture rangée sans accord, ou mal interprétée (« rdv : 14h » pris pour un module).
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN, ART
- **Préconditions** : jeu d'essai.
- **Données** : `8,40 € courses légumes` ; `20 min yoga` ; `Plantes : feuilles jaunes` ; `rdv : 14h chez le dentiste` ; `acheter du pain`.
- **Automatisés associés** : `TU-MOD-35`, `TN-atelier-capture`, `TN-notes`
- **Source** : [DOC] README, « Capture qui comprend » ; [TEST] `TU-MOD-35`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Capturer `8,40 € courses légumes`. | La note est dans la boîte ; un bandeau propose « 8,40 € en dépense dans Budget (Courses) ? ». |
| 2 | Accepter le bandeau. | « Rangé : 8,40 € en dépense dans Budget (Courses). » ; la note quitte la boîte ; la dépense est dans le Budget du mois. |
| 3 | Capturer `20 min yoga`, ignorer le bandeau. | La note reste dans la boîte, avec un bouton « Ranger : 20 min dans Yoga ». |
| 4 | Dans la boîte, cliquer ce bouton. | Une séance de 20 min dans Yoga, à la date de la note ; la note quitte la boîte. |
| 5 | Capturer `Plantes : feuilles jaunes`, ranger. | Une observation « feuilles jaunes » dans le journal de Plantes. |
| 6 | Capturer `rdv : 14h chez le dentiste`, puis `acheter du pain`. | Aucun bandeau ni bouton « Ranger » : notes simplement gardées. |

- **État final attendu** : une dépense, une séance, une observation ; deux notes dans la boîte.
- **Nettoyage** : supprimer ce qui a été créé.

---

<a id="mod-015"></a>
### MOD-015 — Ranger une note de la boîte dans un espace

- **Fonctionnalité et règle** : chaque note propose « → module » vers les espaces qui savent la recevoir (tâches, cumul avec
  carnet, collections, rappels, autres notes ; ni un programme, ni la boîte elle-même) ; vers des tâches, le formulaire
  s'ouvre pour compléter.
- **Objectif, risque vérifié** : note perdue au rangement ; destination absurde.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : note « Penser à rappeler la quincaillerie ».
- **Automatisés associés** : `TU-MOD-19`, `TN-notes`
- **Source** : [DOC] [architecture.md](../../architecture.md#modules) ; [TEST] `TU-MOD-19`, `tests/browser/notes.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir la boîte, regarder les boutons sous la note. | « → Chantier », « → Écriture », « → Tableau », « → Plantes », « → Carnet »… ; ni « → Yoga », ni « → Boîte ». |
| 2 | « → Chantier ». | Le formulaire « Nouvelle tâche » s'ouvre, titre prérempli. |
| 3 | « Enregistrer ». | La tâche est dans Chantier ; la note a quitté la boîte. |

- **État final attendu** : une tâche de plus, une note de moins.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-016"></a>
### MOD-016 — Trier la boîte une note à la fois

- **Fonctionnalité et règle** : « Trier une à une » (Vasculum) : une note à la fois, la plus ancienne d'abord ; rangée d'un
  geste, laissée pour plus tard, ou supprimée avec « Annuler ».
- **Objectif, risque vérifié** : note sautée ou supprimée sans retour.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (six notes).
- **Données** : aucune.
- **Automatisés associés** : `TN-signatures`
- **Source** : [DOC] README, « Trier une à une » ; [TEST] `tests/browser/signatures.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Boîte → « Trier une à une ». | Une feuille « À trier · 1 sur 6 » montre la plus ancienne (« Penser à rappeler la quincaillerie », 2 août). |
| 2 | « Plus tard ». | La suivante (« 12,50 € courses du marché ») ; rien n'a changé. |
| 3 | « Ranger : 12,50 € en dépense dans Budget (Courses) ». | La note suivante arrive ; la dépense est au Budget. |
| 4 | « Supprimer » sur la note suivante. | Un message avec « Annuler » reste visible dans la feuille ; « Annuler » la remet. |
| 5 | Ranger les notes restantes par le sigil d'un espace, jusqu'à la fin. | « La boîte est vide. Tout a trouvé sa place, ou presque. » (si toutes ont été rangées). |

- **État final attendu** : boîte vide ou presque.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-017"></a>
### MOD-017 — Collection en colonnes : avancer, glisser, clavier, téléphone

- **Fonctionnalité et règle** : en colonnes, sur ordinateur une carte se glisse d'une colonne à l'autre (ou `[` et `]` sur la
  carte qui a le focus) ; sur téléphone, une colonne à la fois par un sélecteur ; la dernière colonne affiche sa phrase de fin.
- **Objectif, risque vérifié** : statut impossible à changer au clavier ou sur téléphone.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (Tableau : Idée, En cours, Prêt, Publié).
- **Données** : carte « Lichens d'automne » (Idée).
- **Automatisés associés** : `TN-ecrans`, `TN-collections`
- **Source** : [DOC] README, « Collection » ; [TEST] `tests/browser/ecrans.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ordinateur : ouvrir Tableau. | Quatre colonnes côte à côte, pas de sélecteur. |
| 2 | Glisser « Lichens d'automne » dans « En cours ». | Elle y reste après rechargement. |
| 3 | Lui donner le focus (Tab), appuyer sur `]` deux fois. | Elle avance jusqu'à « Publié », garde le focus ; un lecteur d'écran annonce sa nouvelle colonne. |
| 4 | Appuyer sur `[`. | Elle recule à « Prêt ». |
| 5 | Téléphone : ouvrir Tableau. | Un sélecteur d'onglets, une colonne à la fois ; aucun débordement horizontal. |
| 6 | Toucher l'onglet « Publié ». | La colonne Publié s'affiche. |

- **État final attendu** : « Lichens d'automne » en Prêt.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-018"></a>
### MOD-018 — Collection : champs, statuts, titre obligatoire

- **Fonctionnalité et règle** : chaque champ se renomme ou se masque (nom vide) ; deux à douze statuts ; supprimer un statut
  demande confirmation et déplace ses éléments ; le titre est obligatoire ; un statut inconnu retombe sur le premier.
- **Objectif, risque vérifié** : éléments perdus à la suppression d'un statut ; collection inutilisable.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : collection Musique ; nouveau statut `À réécouter`.
- **Automatisés associés** : `TN-collections`, `TU-MOD-14`, `TU-MOD-15`
- **Source** : [DOC] README, « Collection » ; [TEST] `tests/browser/collections.js`, `TU-MOD-14`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « régler » Musique : vider le nom du champ « Note » (texte long). | Le formulaire d'ajout ne propose plus ce champ ; les notes existantes ne sont pas effacées. |
| 2 | « Ajouter un statut », le nommer `À réécouter`. | Le statut apparaît dans les filtres et le formulaire. |
| 3 | Mettre « Dead Can Dance » à « À réécouter », puis supprimer ce statut. | Confirmation « Supprimer le statut « À réécouter » ? » avec « 1 élément passera à « … ». » ; après accord, Dead Can Dance a un statut existant. |
| 4 | Modifier « Kate Bush », vider le titre, « Enregistrer ». | Refus : « Artiste : à remplir » ; le titre reste. |
| 5 | Supprimer des statuts jusqu'à n'en garder qu'un. | Refus : « Deux statuts minimum : sinon rien ne peut avancer. » |

- **État final attendu** : Musique avec ses statuts d'origine, champ « Note » masqué.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-019"></a>
### MOD-019 — Décisions : rendez-vous de révision, « relire », « maintenue »

- **Fonctionnalité et règle** : la date d'une décision est un rendez-vous de révision ; échue, elle revient sur l'accueil
  quel que soit son état, sauf « Abandonnée » ; « relire » montre la raison écrite alors ; « maintenue » note le réexamen et
  lève le rendez-vous ; déplacer une date échue compte comme un réexamen.
- **Objectif, risque vérifié** : décision jamais réexaminée ; réexamen non tracé.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (« Enduit à la chaux… » Prise, échue ; « Placo » Abandonnée, échue).
- **Données** : aucune.
- **Automatisés associés** : `TU-MOD-42`, `TU-MOD-45`, `TN-pensee`
- **Source** : [DOC] README, « Décisions » ; [TEST] `TU-MOD-42`, `TU-MOD-45`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'accueil. | « « Enduit à la chaux pour le mur nord » : à réexaminer (Décisions) » avec « relire » et « maintenue » ; rien pour « Placo ». |
| 2 | « relire ». | La raison s'affiche : « Humidité du mur nord. Réviser si le devis dépasse 1 200 €. » |
| 3 | « maintenue ». | « Maintenue. La raison d'alors tient encore. » ; la ligne quitte l'accueil ; dans la fiche de la décision, un réexamen daté d'aujourd'hui. |
| 4 | « Annuler » dans le message. | La décision revient, rendez-vous rétabli. |
| 5 | Modifier la décision et mettre sa date dans six mois. | Elle quitte l'accueil ; un réexamen « revue » est noté. |

- **État final attendu** : décision réexaminée, nouvelle date.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-020"></a>
### MOD-020 — Motifs : concordance, voisins, jachère

- **Fonctionnalité et règle** : chaque motif (variantes en sous-titre) est cherché dans les autres modules, en mot entier,
  sans accents ni casse, pluriel toléré ; voisins dès deux rencontres ; un motif vivant absent depuis N jours est en jachère ;
  un motif « Épuisé » ne l'est jamais.
- **Objectif, risque vérifié** : comptes faux (« lune » qui trouve « lunettes ») ; jachère mal calculée.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; dans Carnet, ajouter la note `Des lisières et des lisérés.`
- **Données** : réglage « En jachère après (jours d'absence) » à `1`.
- **Automatisés associés** : `TU-MOD-43`, `TU-MOD-46`, `TN-pensee`
- **Source** : [DOC] README, « Motifs » ; [TEST] `TU-MOD-43`, `TU-MOD-46`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Motifs. | « lisière » compte ses occurrences dans Écriture, la Boîte et le Carnet (« lisières » compté, « lisérés » non) ; « brume » compte aussi « brouillard » ; dernière apparition et espace indiqués. |
| 2 | Lire les voisins de « lisière ». | « brume » n'y figure que s'ils se rencontrent dans au moins deux mêmes textes (sinon, aucun voisin). |
| 3 | « régler » Motifs : jachère après `1` jour. | « lisière » et « brume » passent « En jachère » (sauf s'ils apparaissent dans un texte daté d'aujourd'hui — « lisière » apparaît dans la note du Carnet ajoutée aujourd'hui, donc reste vivant) ; « phalène », épuisé, n'y est jamais. |
| 4 | « voir » sur « brume ». | La recherche s'ouvre sur ce motif. |

- **État final attendu** : jachère à 1 jour.
- **Nettoyage** : remettre 90 ; supprimer la note du Carnet.

---

<a id="mod-021"></a>
### MOD-021 — Arc : placer, étape vide, retirer, supprimer une étape

- **Fonctionnalité et règle** : des étapes nommées par la personne, où placer des fragments et des éléments de collection ;
  une étape vide reste affichée ; supprimer une étape retire ses placements, avec confirmation.
- **Objectif, risque vérifié** : étape vide cachée ; placement perdu sans confirmation.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (Arc : trois étapes, « La lisière n'est pas une frontière… » placé à l'Étape 1).
- **Données** : élément « Brume sur l'étang » (Tableau).
- **Automatisés associés** : `TN-arc`, `TU-MOD-55`
- **Source** : [DOC] README, « Arcs » ; [TEST] `tests/browser/arc.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Arc. | Trois colonnes ; Étape 1 avec un élément ; Étapes 2 et 3 affichées « Vide. » |
| 2 | « Placer un élément » : « Brume sur l'étang » à l'Étape 2. | Il apparaît sous Étape 2. |
| 3 | « retirer » sur ce placement, puis « Annuler ». | Retiré, puis remis. |
| 4 | Supprimer l'Étape 2 (« Supprimer l'étape « Étape 2 » ? 1 placement sera retiré. »), répondre « Annuler ». | Rien ne change. |
| 5 | Recommencer et confirmer. | L'étape et son placement disparaissent ; l'élément reste dans Tableau. |

- **État final attendu** : deux étapes.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-022"></a>
### MOD-022 — « Annuler » après une suppression ; ⌘Z ou Ctrl+Z

- **Fonctionnalité et règle** : supprimer un élément affiche « Annuler » quelques secondes au lieu d'une confirmation ; le
  message reste tant qu'il est survolé ou a le focus ; ⌘Z ou Ctrl+Z annule hors d'un champ ; dans un champ, le raccourci
  reste au champ.
- **Objectif, risque vérifié** : suppression définitive par un geste malheureux (WCAG 2.2.1 : délai réglable).
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai.
- **Données** : fragments d'Écriture.
- **Automatisés associés** : `TN-annuler`, `TU-MOD-27`, `TN-quotidien`
- **Source** : [DOC] README, « Annuler » ; [TEST] `tests/browser/annuler.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « suppr. » sur un fragment. | Il disparaît ; message « Supprimé : « … ». » avec « Annuler ». |
| 2 | Cliquer « Annuler ». | « Rétabli. Rien ne s'est passé. » ; le fragment revient à sa place. |
| 3 | Supprimer un autre fragment, garder la souris sur le message vingt secondes. | Le message reste ; en quittant, il part et la suppression tient. |
| 4 | Supprimer un fragment, puis Ctrl+Z (⌘Z sur Mac) hors de tout champ. | Le fragment revient. |
| 5 | Supprimer un fragment, cliquer dans le champ de fragment, Ctrl+Z. | Le raccourci agit dans le champ ; le fragment n'est pas remis. |
| 6 | Attendre que le message parte (plus de six secondes), Ctrl+Z hors champ. | Rien ne revient. |

- **État final attendu** : deux fragments supprimés (étapes 5 et 6).
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-023"></a>
### MOD-023 — Brouillons : survivent à la fermeture, s'effacent une fois gardés

- **Fonctionnalité et règle** : le texte en cours d'un champ libre (capture, note, fragment, observation, message à
  l'assistant) survit à la fermeture de l'app, sur cet appareil ; gardé, il s'efface.
- **Objectif, risque vérifié** : texte perdu à la fermeture (téléphone qui recharge l'onglet).
- **Priorité** : P2 · **Plateformes** : Web, Mob, AND, IOS
- **Préconditions** : jeu d'essai.
- **Données** : `brouillon MOD-023 à moitié écrit` dans le champ de fragment d'Écriture.
- **Automatisés associés** : `TU-MOD-31`, `TN-quotidien`, `TN-navigation`
- **Source** : [DOC] README, « Brouillons » ; [TEST] `TU-MOD-31`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Taper le brouillon dans le champ de fragment, sans le garder ; fermer l'onglet (ou tuer l'app). | Avant de fermer : le brouillon est dans le champ, et la liste des fragments n'a rien de nouveau. |
| 2 | Rouvrir Selene. | L'accueil propose de reprendre « Écriture … en cours » ; dans Écriture, le champ contient le brouillon. |
| 3 | « Garder ». | Le fragment est ajouté ; le champ est vide ; l'accueil ne mentionne plus le brouillon. |
| 4 | Rouvrir l'app. | Le champ est vide. |

- **État final attendu** : un fragment de plus.
- **Nettoyage** : le supprimer.

---

<a id="mod-024"></a>
### MOD-024 — Minuteur de quinze minutes et la suite proposée

- **Fonctionnalité et règle** : le minuteur se lance depuis Capturer, la palette ou un appui long sur la petite lune ; l'anneau
  se referme ; à la fin, le module ouvert propose la suite (noter la séance, donner le nouveau total) et le pont de reprise
  s'ouvre.
- **Objectif, risque vérifié** : minuteur qui ne finit pas, ou fin sans suite.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; quinze minutes disponibles (ou une horloge accélérée : non disponible à la main).
- **Données** : aucune.
- **Automatisés associés** : `TN-en-tete`, `TN-signatures`, `TN-recherche-minuteur`, `TU-MOD-33`
- **Source** : [DOC] README, « Minuteur » ; [TEST] `tests/browser/en-tete.js`, `TU-MOD-33`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Téléphone : ⊕ Capturer → « Lancer le minuteur (15 min) ». | La feuille se ferme ; l'en-tête montre le temps qui reste et « Pause », sur la même ligne. |
| 2 | « Pause », puis « Reprendre ». | Le temps s'arrête, puis repart. |
| 3 | Ouvrir Yoga et attendre la fin. | L'anneau autour de la petite lune s'est refermé ; un message propose « Noter 15 min » ; le champ « Je m'arrête ici… » s'ouvre. |
| 4 | « Noter 15 min ». | Une séance de 15 min, aujourd'hui. |
| 5 | Ordinateur : appui long sur la petite lune. | Le minuteur démarre, sans suivre le lien de l'accueil. |

- **État final attendu** : une séance de 15 min.
- **Nettoyage** : la supprimer ; remettre le minuteur à zéro.

---

<a id="mod-025"></a>
### MOD-025 — Longues listes : cent, puis « Voir les suivants »

- **Fonctionnalité et règle** : fragments, notes, collections : cent éléments, du plus récent, puis « Voir les 100 suivants
  (N de plus) ».
- **Objectif, risque vérifié** : liste interminable qui fige le téléphone ; éléments anciens inaccessibles.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu de volume importé ([donnees/README.md](../donnees/README.md#volume)).
- **Données** : la boîte (1 500 notes) ou Écriture (4 000 fragments).
- **Automatisés associés** : `TU-MOD-54`, `TN-navigation`
- **Source** : [DOC] README, « Longues listes » ; [TEST] `TU-MOD-54`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir la boîte. | Cent notes, puis « Voir les 100 suivants (1 400 de plus) ». |
| 2 | Cliquer le bouton. | Deux cents notes ; le bouton se met à jour. |
| 3 | Mesurer à l'œil le temps d'ouverture de la boîte sur téléphone. | Moins de deux secondes (repère indicatif, voir TRV-007). |

- **État final attendu** : inchangé.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="mod-026"></a>
### MOD-026 — Importer des notes Markdown (Obsidian, Zettlr)

- **Fonctionnalité et règle** : dans les réglages d'un module de notes, « Importer des notes Markdown » (des fichiers) ou
  « …ou tout un dossier » (un coffre) : chaque fichier `.md` devient une note, titre en première ligne, datée par son
  en-tête (`date`, `created`), sinon par son nom (date ou identifiant Zettlr), sinon par le fichier ; `statut: hypothèse`
  lui donne son statut ; un lien `[[…]]` vers une autre note du lot (ou déjà importée) devient « fait écho à » ; une image
  intégrée et les commentaires disparaissent ; `.obsidian` et `.trash` sont ignorés ; une confirmation dit combien, de
  quand à quand, où ; un second import n'ajoute que ce qui manque ; tout est lu sur l'appareil.
- **Objectif, risque vérifié** : notes perdues ou dupliquées à l'import ; dates fausses ; réglages de l'éditeur importés
  comme des notes ; texte piégé interprété ; contenu envoyé à un service.
- **Priorité** : P2 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai (le Carnet n'a qu'une note) ; le dossier [`donnees/coffre-markdown/`](../donnees/coffre-markdown/)
  copié sur l'appareil (trois notes et un `.obsidian/workspace.md`) ; Network ouvert.
- **Données** : les fichiers `Le seuil.md`, `2024-02-10 Lecture.md`, `202403011530 Idée.md`, puis le dossier entier.
- **Automatisés associés** : `TN-import-markdown`, `TU-MKD-01`, `TU-MKD-02`, `TU-MKD-03`, `TU-MKD-04`, `TU-MKD-05`
- **Source** : [DOC] [connexions.md](../../connexions.md) (venir d'Obsidian ou de Zettlr) ; [TEST] `tests/browser/import-markdown.js`,
  `tests/markdown.test.js` ; textes vérifiés par une sonde Chromium le 5 octobre 2026.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Espaces → « régler » sous Carnet. | « Importer des notes Markdown » et « …ou tout un dossier », avec l'explication « Un coffre Obsidian, un dossier Zettlr ou quelques fichiers .md : chaque fichier devient une note… Les fichiers sont lus sur cet appareil ; un second import n'ajoute que ce qui manque. » |
| 2 | « Importer des notes Markdown » → choisir les trois fichiers. | « Importer 3 notes (du 5 janvier 2024 au 1er mars 2024) dans Carnet ? 2 liens [[…]] deviennent « fait écho à ». » |
| 3 | « Annuler ». | Le Carnet n'a toujours qu'une note. |
| 4 | Refaire l'étape 2, « Confirmer ». | « 3 notes importées dans Carnet. 2 liens. » ; aucune requête dans Network. |
| 5 | Ouvrir le Carnet. | « Le seuil » (5 janv.) : « Le paratexte comme lisière du texte. », statut hypothèse, « fait écho à « La lisière… » » ; « La lisière » (10 févr.) : « Renvoie au Seuil. », sans « schema.png », et `<img src=x onerror=alert('recette')>` affiché en texte, sans alerte ; « 202403011530 Idée » (1er mars 2024) sans « commentaire privé ». |
| 6 | Réglages → « …ou tout un dossier » → choisir le dossier `coffre-markdown`. | « Rien de nouveau : ces notes sont déjà là. », sans question ; `workspace.md` n'est pas devenu une note. |

- **Un fichier illisible** (déplacé ou supprimé après son choix, resté dans un nuage hors ligne) est ignoré et compté : « … 1 fichier illisible, ignoré. » à la confirmation et après l'import ; si aucun fichier n'est lisible : « Aucun de ces fichiers n'a pu être lu : ils ont peut-être été déplacés ou supprimés depuis leur choix. ». Pas reproductible à la main de façon fiable : couvert par `TN-import-markdown` et `TU-MKD-05` (anomalie A8, corrigée).
- **État final attendu** : le Carnet a quatre notes.
- **Nettoyage** : réimporter le jeu d'essai.
