# Penser avec

Les fonctions qui relient et relisent ce qui est écrit : statut épistémique, provenance, liaisons et tensions, pont de
reprise, fiche, dossier de passation, sortes, bilan, test lunaire, vocabulaire, planche, carte, marges. Toutes les cibles,
artefact compris.

**Préconditions communes** : le jeu [`donnees/jeu-essai.json`](../donnees/jeu-essai.json) importé, en mode sans compte. Dans
Écriture : « Toute lisière est un seuil… » **dérive de** « La lisière n'est pas une frontière… » ; « La lisière est au
contraire une frontière nette… » la **contredit** (une tension ouverte) ; la source « Depersonalization and the self »
**documente** « Le brouillard efface la route… » ; « Les sapins gardent la nuit… » est une **hypothèse**. Les dates du jeu
sont en août et septembre 2026 : pour le bilan, remonter jusqu'à ces périodes.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [PEN-001](#pen-001) | Statut épistémique : « ? » en tête, changement daté, filtre de recherche | P2 | Web, Mob, ART |
| [PEN-002](#pen-002) | Provenance d'une note rangée | P2 | Web, Mob |
| [PEN-003](#pen-003) | Dériver : liens dans les deux sens | P2 | Web, Mob |
| [PEN-004](#pen-004) | Contredire, résoudre, synthèse | P2 | Web, Mob |
| [PEN-005](#pen-005) | Liens d'une note rangée ; cible supprimée | P2 | Web, Mob |
| [PEN-006](#pen-006) | Pont de reprise | P2 | Web, Mob |
| [PEN-007](#pen-007) | Fiche d'une entrée | P3 | Web, Mob |
| [PEN-008](#pen-008) | Dossier de passation | P2 | Web, Mob |
| [PEN-009](#pen-009) | Sortes : tirage pondéré par l'oubli | P3 | Web, Mob |
| [PEN-010](#pen-010) | Bilan : cycle ou mois, période d'avant, remonter le temps | P2 | Web, Mob |
| [PEN-011](#pen-011) | Test lunaire | P3 | Web, Mob |
| [PEN-012](#pen-012) | Vocabulaire du bilan | P3 | Web, Mob |
| [PEN-013](#pen-013) | Planche de lunaison : impression et téléchargement | P3 | Web |
| [PEN-014](#pen-014) | Carte céleste des liaisons | P3 | Web, Mob |
| [PEN-015](#pen-015) | Marges : sur grand écran, sous le texte ailleurs | P3 | Web, Mob |

Identifiants retirés : aucun.

---

<a id="pen-001"></a>
### PEN-001 — Statut épistémique : « ? » en tête, changement daté, filtre de recherche

- **Fonctionnalité et règle** : un fragment ou une note peut se dire observé, hypothèse, interprétation ou inexpliqué (vide
  par défaut) ; un « ? » en tête de saisie en fait une hypothèse (et disparaît du texte) ; chaque changement est daté ;
  `statut:hypothèse` (ou `status:hypothesis`) filtre la recherche ; le bilan compte les idées par statut.
- **Objectif, risque vérifié** : une hypothèse traitée comme un fait ; statut perdu.
- **Priorité** : P2 · **Plateformes** : Web, Mob, ART
- **Préconditions** : jeu d'essai.
- **Données** : capture `? les hêtres gèlent avant les sapins` ; capture `pourquoi ? parce que`.
- **Automatisés associés** : `TU-MOD-39`, `TN-pensee`
- **Source** : [DOC] README, « Statut épistémique » ; [TEST] `TU-MOD-39`, `tests/browser/pensee.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Capturer `? les hêtres gèlent avant les sapins`. | Message « Gardé comme hypothèse. Elle attendra ses preuves. » ; dans la boîte, le texte sans « ? », statut « hypothèse ». |
| 2 | Capturer `pourquoi ? parce que`. | Texte gardé tel quel, sans statut (le « ? » n'est pas en tête). |
| 3 | Sur la première note, changer « statut… » en « inexpliqué ». | Le statut change sur place ; la fiche de la note (PEN-007) montre l'histoire : hypothèse → inexpliqué, datée. |
| 4 | Chercher `statut:hypothèse`. | Les hypothèses seules : « Les sapins gardent la nuit… », « la brume précède la pluie » ; pas la note passée à inexpliqué. |
| 5 | Chercher `status:hyp`. | Mêmes résultats. |
| 6 | Bilan, période de septembre 2026 (mois). | « Statut des idées notées » compte les hypothèses de la période ; cliquer un statut mène à la recherche filtrée. |

- **État final attendu** : deux notes de plus.
- **Nettoyage** : les supprimer.

---

<a id="pen-002"></a>
### PEN-002 — Provenance d'une note rangée

- **Fonctionnalité et règle** : une note rangée depuis une boîte disparaît, mais ce qui en naît garde une copie de son texte,
  de sa date et de sa boîte (« ↳ de Boîte, 23 sept. ») ; rangée deux fois, elle garde sa première naissance.
- **Objectif, risque vérifié** : perte de l'origine d'une idée.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : note « Écriture : la lisière comme seuil » (23 septembre 2026).
- **Automatisés associés** : `TU-MOD-40`, `TN-pensee`
- **Source** : [DOC] README, « Provenance » ; [TEST] `TU-MOD-40`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dans la boîte, « Ranger : « la lisière comme seuil » dans Écriture ». | La note quitte la boîte ; un fragment « la lisière comme seuil » apparaît dans Écriture. |
| 2 | Lire le fragment (en marge sur grand écran, dessous ailleurs). | « ↳ de Boîte, 23 sept. » et le texte complet d'origine « Écriture : la lisière comme seuil ». |
| 3 | Ranger « Penser à rappeler la quincaillerie » dans Carnet, puis, depuis Carnet, la ranger dans Écriture. | Le fragment final porte « ↳ de Boîte, 2 août » (la première naissance), pas Carnet. |

- **État final attendu** : deux fragments nés de notes, avec leur provenance.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="pen-003"></a>
### PEN-003 — Dériver : liens dans les deux sens

- **Fonctionnalité et règle** : « dériver » : la prochaine entrée écrite dans l'espace découle de la source ; chaque entrée
  montre ses liens et ceux qui la visent (« a donné… »).
- **Objectif, risque vérifié** : lien perdu ou à sens unique.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : fragment `La coupe trace la lisière, le temps l'efface.`
- **Automatisés associés** : `TU-MOD-49`, `TN-liaisons`
- **Source** : [DOC] README, « Liaisons » ; [TEST] `TU-MOD-49`, `tests/browser/liaisons.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur « Les sapins gardent la nuit… », « dériver ». | Un bandeau « Dérivé de « Les sapins gardent la nuit… » » ; le curseur est dans le champ de fragment. |
| 2 | Écrire le fragment des données, « Garder ». | « Dérivé, et relié à sa source. » ; le nouveau fragment montre « dérive de » la source ; le bandeau a disparu. |
| 3 | Lire la source. | Elle montre « a donné « La coupe trace la lisière… » ». |
| 4 | Lire « La lisière n'est pas une frontière… » (jeu d'essai). | Elle montre ce qui en dérive (« Toute lisière est un seuil… ») et qui la contredit. |

- **État final attendu** : un fragment dérivé de plus.
- **Nettoyage** : le supprimer.

---

<a id="pen-004"></a>
### PEN-004 — Contredire, résoudre, synthèse

- **Fonctionnalité et règle** : chaque « contredit » reste une tension ouverte jusqu'à une synthèse qui dérive des deux ;
  « résoudre » ouvre cette synthèse dans l'espace de la première entrée.
- **Objectif, risque vérifié** : tension oubliée ou levée sans synthèse.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (une tension ouverte).
- **Données** : synthèse `La lisière est une frontière que le regard refuse de voir.`
- **Automatisés associés** : `TU-MOD-49`, `TN-liaisons`
- **Source** : [DOC] README, « Tensions » ; [TEST] `TU-MOD-49`, `tests/browser/liaisons.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir le Bilan. | « Tensions ouvertes » : « La lisière est au contraire… » contredit « La lisière n'est pas une frontière… », « ouverte il y a … » ; boutons « résoudre » et « dossier ». |
| 2 | « résoudre ». | Écriture s'ouvre avec le bandeau « Synthèse de « … » et « … » ». |
| 3 | Écrire la synthèse des données, « Garder ». | « Synthèse gardée. La tension est levée. » |
| 4 | Revenir au Bilan. | Plus de tension ouverte. |
| 5 | Sur un fragment, « lier… » → « contredit » → choisir un autre fragment. | « Tension ouverte. Elle attendra sa synthèse. » ; la tension apparaît au Bilan. |

- **État final attendu** : une tension levée, une nouvelle ouverte.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="pen-005"></a>
### PEN-005 — Liens d'une note rangée ; cible supprimée

- **Fonctionnalité et règle** : une note rangée emporte ses liens, et ceux qui la visaient la suivent ; un lien vers une
  entrée supprimée le dit (« (supprimé) »).
- **Objectif, risque vérifié** : liens cassés ou silencieusement perdus.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : note « la brume précède la pluie » ; fragment « Le brouillard efface la route… ».
- **Automatisés associés** : `TU-MOD-50`, `TU-MOD-49`
- **Source** : [DOC] README, « Liaisons » ; [TEST] `TU-MOD-50`, `TU-MOD-49`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur la note « la brume précède la pluie », « lier… » → « fait écho à » → « Le brouillard efface la route… ». | « Lié. » |
| 2 | Ranger la note dans Écriture (« → Écriture »). | Le nouveau fragment montre « fait écho à « Le brouillard efface la route… » ». |
| 3 | Supprimer « Le brouillard efface la route… » (laisser passer « Annuler »). | Le fragment né de la note affiche le lien « fait écho à (supprimé) ». |

- **État final attendu** : un lien vers une entrée supprimée, signalé.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="pen-006"></a>
### PEN-006 — Pont de reprise

- **Fonctionnalité et règle** : en haut de chaque espace, « Je m'arrête ici… » note le prochain geste ; il s'affiche au retour
  dans l'espace et sur l'accueil, sous sa ligne ; « fait » le lève, « Annuler » le remet ; ce qui était prévu et ce qu'il en
  est advenu restent dans un historique ; jamais de pont dans « Reprendre la main ».
- **Objectif, risque vérifié** : le prochain geste oublié.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : `réécrire l'ouverture du chapitre 2`.
- **Automatisés associés** : `TU-MOD-41`, `TN-pensee`
- **Source** : [DOC] README, « Pont de reprise » ; [TEST] `TU-MOD-41`, `tests/browser/pensee.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dans Écriture, « Je m'arrête ici… ». | Un champ « Le prochain geste, pour la prochaine fois… » prend le focus. |
| 2 | Saisir les données, « Garder ». | « Noté. La prochaine fois commencera ici. » ; en haut de l'espace « Reprendre : réécrire l'ouverture du chapitre 2 ». |
| 3 | Ouvrir l'accueil. | Sous la ligne d'Écriture : « ↳ réécrire l'ouverture du chapitre 2 · aujourd'hui ». |
| 4 | Dans Écriture, « fait ». | « Repris. Le pont est levé. » ; le pont disparaît. |
| 5 | « Annuler » dans le message. | Le pont revient. |

- **État final attendu** : pont présent.
- **Nettoyage** : « fait ».

---

<a id="pen-007"></a>
### PEN-007 — Fiche d'une entrée

- **Fonctionnalité et règle** : « fiche » réunit tout ce qu'on sait d'une entrée : provenance, statut et son histoire, liens
  dans les deux sens, motifs présents ; « Voir dans… » ferme la fiche et mène à l'entrée.
- **Objectif, risque vérifié** : information éparpillée, introuvable.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : fragment « La lisière n'est pas une frontière… ».
- **Automatisés associés** : `TN-signatures`
- **Source** : [DOC] README, « Fiche » ; [TEST] `tests/browser/signatures.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur le fragment, « fiche ». | Un tiroir « Fiche de l'entrée », sans quitter l'espace : texte, liens entrants (dérive, contredit), motifs présents (« lisière »). |
| 2 | Changer le statut depuis la fiche (« observé »). | La fiche se redessine ; l'histoire du statut montre le changement daté. |
| 3 | « Voir dans Écriture ». | La fiche se ferme ; le fragment est surligné dans Écriture. |

- **État final attendu** : statut « observé ».
- **Nettoyage** : remettre le statut vide.

---

<a id="pen-008"></a>
### PEN-008 — Dossier de passation

- **Fonctionnalité et règle** : un export Markdown pour une lecture assistée : chaque entrée garde date, espace, statut et
  provenance ; ses liens deviennent des renvois `[n]` ; les sources qui la documentent sont citées `[S1]` et listées en
  références avec leur DOI ; un en-tête YAML ; un préambule sur les statuts. Trois entrées : « Dossier » des fragments
  (suit le filtre de chapitre), « Exporter en dossier » d'une recherche, « dossier » d'une tension.
- **Objectif, risque vérifié** : dossier incomplet, ou qui présente une hypothèse comme un fait.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : recherche `lisière`.
- **Automatisés associés** : `TU-MOD-52`, `TU-MOD-53`, `TN-liaisons`, `TN-parcours-e2`
- **Source** : [DOC] README, « Dossier de passation » ; [TEST] `TU-MOD-52`, `TU-MOD-53`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Écriture → « Dossier ». | Un fichier `.md` se télécharge. |
| 2 | Ouvrir le fichier dans un éditeur de texte. | En-tête YAML entre `---` (périmètre, nombre d'entrées, `references: 1`) ; un préambule (ne pas traiter une hypothèse comme un fait ; une source qui documente ne prouve pas) ; chaque fragment daté, avec son statut ; « Toute lisière est un seuil… » renvoie par `[n]` à celui dont il dérive ; « Le brouillard efface la route… » porte `*Documenté par : [S1]*` ; une section « Références » : « [S1] … (2020). *Depersonalization and the self*. Consciousness and Cognition. https://doi.org/10.1016/j.concog.2020.102946 ». |
| 3 | Chercher `lisière`, « Exporter en dossier ». | Un dossier qui contient tous les résultats affichés. |
| 4 | Bilan → tension → « dossier ». | Un dossier avec les deux entrées en tension et leur voisinage. |

- **État final attendu** : trois fichiers téléchargés.
- **Nettoyage** : les supprimer du disque.

---

<a id="pen-009"></a>
### PEN-009 — Sortes : tirage pondéré par l'oubli

- **Fonctionnalité et règle** : sur l'accueil, un tirage dans le seul matériau de la personne : un fragment ou une note pas
  retouché depuis 14 jours au moins, une tension ouverte, un motif en jachère, une source gardée et reliée à rien ; plus
  c'est ancien, plus ça a de chances de sortir ; rien en dessous du seuil.
- **Objectif, risque vérifié** : tirage d'une entrée récente ; tirage vide sans explication.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai (entrées d'août et septembre 2026, plus de 14 jours avant la date du test).
- **Données** : aucune.
- **Automatisés associés** : `TU-MOD-58`, `TU-MOD-60`, `TN-sortes`, `TN-sources-oubliees`
- **Source** : [DOC] README, « Sortes », « Sources oubliées » ; [TEST] `TU-MOD-58`, `tests/browser/sortes.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Accueil → section des sortes → « Tirer ». | Une carte : un fragment ou une note « endormi(e) » (« N jours sans y toucher »), une tension ouverte, ou une source oubliée (« gardée il y a …, jamais relue »). |
| 2 | « Retirer » plusieurs fois. | Toujours un tirage parmi ces genres ; jamais une entrée datée de moins de 14 jours. |
| 3 | Sur un compte neuf (données effacées, une capture du jour). | « Rien d'assez ancien à tirer. Reviens dans deux semaines. » |
| 4 | Sur une source oubliée tirée, « documente… » → une note. | La source quitte le bassin (elle n'est plus reliée à rien). |

- **État final attendu** : inchangé, ou une source reliée.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="pen-010"></a>
### PEN-010 — Bilan : cycle ou mois, période d'avant, remonter le temps

- **Fonctionnalité et règle** : pour chaque module, ce qui s'est passé pendant le cycle lunaire en cours (d'une nouvelle lune
  à la suivante) ou le mois, à côté de la période précédente ; ‹ › pour remonter ; le mode est retenu sur l'appareil ; une
  information, pas un score.
- **Objectif, risque vérifié** : sommes fausses ; périodes qui se chevauchent ou laissent des trous.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : mode « Mois », septembre 2026.
- **Automatisés associés** : `TU-MOD-37`, `TU-MOD-38`, `TN-bilan`
- **Source** : [DOC] README, « Bilan » ; [TEST] `TU-MOD-37`, `TU-MOD-38`, `tests/browser/bilan.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir le Bilan. | Mode « Cycle lunaire » par défaut : « Cycle du … au … » (29 ou 30 jours, contenant aujourd'hui). |
| 2 | Choisir « Mois », remonter avec ‹ jusqu'à septembre 2026. | Une ligne par espace : Yoga « 2 séances, 55 min », Budget « 165,00 € dépensés… », Plantes et les autres ; chaque ligne a « avant : … » (août). |
| 3 | Remonter à août 2026. | Yoga « 2 séances, 45 min » ; Budget « 210,00 € dépensés… ». |
| 4 | Recharger. | Le mode « Mois » est retenu. |
| 5 | Lire toute la page. | Aucune note, aucun trophée, aucun pourcentage de réussite. |

- **État final attendu** : mode Mois retenu sur l'appareil.
- **Nettoyage** : remettre « Cycle lunaire ».

---

<a id="pen-011"></a>
### PEN-011 — Test lunaire

- **Fonctionnalité et règle** : un test de Rayleigh sur tout ce qui est daté ; sous 40 événements, le bilan le dit plutôt
  que d'inventer une tendance ; un seul test, et l'écran rappelle le piège des tests multiples.
- **Objectif, risque vérifié** : faux signal présenté comme une découverte.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai, puis jeu de volume ([donnees/README.md](../donnees/README.md#volume)).
- **Données** : aucune.
- **Automatisés associés** : `TU-MOD-59`, `TN-lune`
- **Source** : [DOC] README, « Test lunaire » ; [TEST] `TU-MOD-59`, `tests/browser/lune.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Jeu d'essai : Bilan, section « Lune ». | « Pas assez de matière pour un test honnête : N événements datés au lieu de 40 au moins. Reviens quand le corpus aura grandi. » |
| 2 | Jeu de volume : Bilan, section « Lune ». | « Test de Rayleigh sur N événements datés… » avec l'avertissement sur les tests multiples ; puis soit « Concentration autour de … (R = …, p = …) », soit « Rien de concentré (R = …, p = …) … La lune plaide non coupable ». |

- **État final attendu** : inchangé.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="pen-012"></a>
### PEN-012 — Vocabulaire du bilan

- **Fonctionnalité et règle** : les mots propres à la période, comparés aux six périodes d'avant ; *émergent* (dans au moins
  deux textes, bien plus fréquent) et *absent cette fois, fréquent avant* (au moins trois textes avant, aucun maintenant) ;
  mots vides, nombres et mots courts écartés ; pluriel ramené au singulier ; chaque mot mène à la recherche ; « + » en fait
  un motif ; sous cinq textes de chaque côté, le bilan le dit.
- **Objectif, risque vérifié** : tendance inventée sur trop peu de textes.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; un module Motifs (présent).
- **Données** : six notes datées d'aujourd'hui contenant `héron` (deux fois au moins dans des notes distinctes) et des mots variés.
- **Automatisés associés** : `TU-MOD-47`, `TU-MOD-48`, `TN-vocabulaire`
- **Source** : [DOC] README, « Vocabulaire » ; [TEST] `TU-MOD-47`, `tests/browser/vocabulaire.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Bilan (mode Mois, mois en cours) avant d'ajouter les notes. | « Pas encore assez de textes datés pour parler de dérive : … (5 de chaque côté au moins). » |
| 2 | Ajouter les six notes, revenir au Bilan. | La section « Vocabulaire » compare aux six mois d'avant ; « héron » figure parmi les émergents ; aucun mot vide (« le », « avec »…). |
| 3 | Cliquer « héron ». | La recherche s'ouvre sur « héron ». |
| 4 | Revenir, cliquer « + » à côté de « héron ». | « « héron » devient un motif de Motifs. On verra s'il revient. » ; le bouton disparaît pour ce mot ; le motif est aussitôt compté dans Motifs. |

- **État final attendu** : six notes et un motif de plus.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="pen-013"></a>
### PEN-013 — Planche de lunaison : impression et téléchargement

- **Fonctionnalité et règle** : bouton « Planche » du Bilan : le cycle mis en page comme une planche d'atlas numérotée (lunaison
  de Meeus) ; « Imprimer ou enregistrer en PDF » (une page A4) ; « Télécharger » en `.html` autonome ; jamais rien de
  « Reprendre la main ».
- **Objectif, risque vérifié** : impression sur plusieurs pages ; fichier téléchargé qui exécute du script.
- **Priorité** : P3 · **Plateformes** : Web
- **Préconditions** : jeu d'essai.
- **Données** : lunaison couvrant fin août / septembre 2026.
- **Automatisés associés** : `TN-planche`
- **Source** : [DOC] README, « Planche de lunaison » ; [TEST] `tests/browser/planche.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Bilan → « Planche » ; « Lunaison précédente » jusqu'à une lunaison de septembre 2026. | « Planche N » (numéro de Meeus), « Lunaison du … au … », règle de lunaison avec les quartiers, une ligne par espace, motifs apparus, statuts, tensions, « Venu du dehors ». |
| 2 | « Imprimer ou enregistrer en PDF », aperçu d'impression. | Une seule page A4 ; ni barre latérale ni boutons. |
| 3 | « Télécharger », ouvrir le fichier téléchargé hors ligne. | La planche s'affiche seule ; le fichier ne contient aucune balise `<script>` (vérifier par « Afficher la source »). |
| 4 | Sur téléphone, ouvrir la planche. | Lisible, sans débordement horizontal. |

- **État final attendu** : un fichier `.html` téléchargé.
- **Nettoyage** : le supprimer.

---

<a id="pen-014"></a>
### PEN-014 — Carte céleste des liaisons

- **Fonctionnalité et règle** : expérimentale ; depuis la fiche d'une entrée liée (« carte du voisinage », deux degrés) ou d'un
  motif (« carte ») : les entrées en étoiles, le temps de gauche à droite, une bande par espace, les liens codés par la forme
  du trait (tensions ouvertes en cinabre) ; 80 étoiles au plus ; une table des liaisons en texte, seule d'abord sur téléphone.
- **Objectif, risque vérifié** : carte illisible ou inaccessible au clavier ; page qui déborde.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : fragment « La lisière n'est pas une frontière… » ; motif « lisière ».
- **Automatisés associés** : `TN-carte`, `TU-CART-01`, `TU-CART-02`, `TU-CART-03`, `TU-CART-04`, `TU-CART-05`
- **Source** : [DOC] README, « Carte céleste » ; [DOC] [evolution-ui.md](../../evolution-ui.md#vague-4--les-pistes-expérimentales) ; [TEST] `tests/browser/carte.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Fiche du fragment → « carte du voisinage ». | Une feuille large : l'étoile de départ cerclée ; les deux fragments liés ; le lien « contredit » marqué comme tension ouverte ; « Table des liaisons » qui dit la même chose en texte. |
| 2 | Fermer, rouvrir. | Chaque étoile est à la même place. |
| 3 | Tab jusqu'à une étoile, Entrée. | L'étoile reçoit le focus (anneau visible) puis mène à son entrée ; la feuille se ferme. |
| 4 | Motifs → « carte » de « lisière ». | Les entrées du motif et leurs voisines directes. |
| 5 | Téléphone : même chose. | La table d'abord ; « Voir la carte » la déplie ; la page ne déborde pas (la carte défile dans son cadre). |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="pen-015"></a>
### PEN-015 — Marges : sur grand écran, sous le texte ailleurs

- **Fonctionnalité et règle** : sur un grand écran, fragments et notes portent en marge, face au texte, provenance, liens,
  motifs et date de retouche ; sur un écran étroit, tout passe sous le texte ; rien n'est perdu.
- **Objectif, risque vérifié** : information cachée sur téléphone ; texte qui change de largeur.
- **Priorité** : P3 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai ; une note rangée dans Écriture (PEN-002, étape 1) pour avoir une provenance.
- **Données** : aucune.
- **Automatisés associés** : `TN-marges`
- **Source** : [DOC] README, « Marges » ; [TEST] `tests/browser/marges.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Fenêtre de 1440 px : ouvrir Écriture. | À droite de chaque fragment, derrière un filet : provenance, liens, motifs (qui mènent à la recherche) ; les actions restent sur la ligne du texte. |
| 2 | Cliquer un motif en marge. | La recherche s'ouvre sur ce motif. |
| 3 | Réduire la fenêtre à 900 px, puis téléphone. | La marge passe sous le texte ; aucune information ne disparaît ; aucun débordement. |

- **État final attendu** : inchangé.
- **Nettoyage** : réimporter le jeu d'essai si PEN-002 a été joué.
