# Reprendre la main

Un espace facultatif pour suivre soi-même le **tabac**, le **cannabis**, l'**alcool** ou les **réseaux sociaux** :
observer, réduire avec une limite quotidienne choisie, ou viser l'arrêt. C'est un carnet autodéclaratif : Selene ne pose
aucun diagnostic, ne calcule aucun protocole de sevrage, ne recommande aucune dose et ne dit jamais qu'une quantité est
sans risque. Décision d'architecture : [ADR 26](architecture.md#adr-26--reprendre-la-main--un-suivi-sensible-dans-un-type-de-module).

## Parcours

1. **Créer** : modèle « Reprendre la main » (accueil, ou Réglages → Espaces → Créer ; il est proposé en dernier), ou
   type vide du même nom. Le suivi naît **non partagé avec l'assistant**.
2. **Configurer** (deux formulaires courts) : le nom (libre, visible dans la navigation) et le sujet, puis l'intention,
   la limite si l'on réduit, et la date d'effet. Pour l'alcool, une information sur le sevrage précède le choix (plus
   bas). Le sujet, donc l'unité, ne change plus : un autre sujet, c'est un autre suivi.
3. **Au quotidien**, quatre actions :
   - **J'ai une envie** : date, intensité 0-10 facultative, contexte ou déclencheur facultatif, un appui à essayer
     (facultatif), un retour après coup (utile, sans changement, difficile), et une pause de cinq minutes si on veut.
     Une envie n'est ni un écart ni un échec, et ne donne pas de marque.
   - **Noter une consommation / durée** : « une de plus » (s'ajoute aux saisies du jour) ou « le total de la journée »
     (seule la différence avec ce qui est déjà noté s'ajoute ; un total plus bas que les saisies est refusé, avec ce
     qu'il faut corriger). Une note de contexte facultative, jamais exigée.
   - **J'ai réalisé une action** : une action de son plan, faite pour de vrai, même un jour avec consommation. Depuis une
     envie, « Je l'ai fait » déclare réalisé l'appui qu'elle avait choisi : choisir n'est pas faire.
   - **Faire mon point du jour** : la date et le total exacts s'affichent ; confirmer dit que toutes les consommations
     de la journée sont notées. Annuler la laisse inconnue, sans pénalité. Les autres journées se confirment depuis le
     bilan (« confirmer ») ou « Confirmer une autre journée… ».
4. **Corriger, supprimer** : « modifier » et « suppr. » sur chaque ligne du journal, avec « Annuler » quelques secondes,
   comme partout dans Selene. Retirer la confirmation d'une journée la rend inconnue (« laisser inconnue »).

## Unités

| Sujet | Unité | Pas, bornes | Ce que l'interface précise |
|---|---|---|---|
| Tabac | cigarettes | entier, 200 au plus par saisie | les substituts nicotiniques (patch, gomme, pastille, spray) ne se comptent pas : ce ne sont pas des cigarettes fumées |
| Cannabis | grammes de produit | au centième, 100 au plus | une estimation, pas une dose de THC : la teneur varie, ces grammes ne mesurent ni l'effet ni le risque |
| Alcool | verres standard français (10 g d'alcool pur) | au dixième, 100 au plus | ≈ 25 cl de bière à 5 % ou 10 cl de vin à 12 % (les deux exemples de la source officielle) ; un verre servi peut en valoir plusieurs |
| Réseaux sociaux | minutes déclarées | entier, 1440 au plus par jour | saisies à la main (temps d'écran du téléphone, par exemple) ; Selene ne mesure ni ne bloque les autres applications |

Les nombres s'écrivent « 1,5 » ou « 1.5 ». Les sommes sont calculées au pas de l'unité, sans flottant résiduel.

## Règles

- **Absence de données ≠ zéro.** Une journée n'est complète qu'après confirmation explicite ; elle garde alors
  l'**instantané exact** de ses consommations (identifiants et quantités, triés). Zéro ne devient une donnée qu'ainsi.
  Une journée partielle ne compte jamais comme une abstinence.
- **Réouverture.** Toute quantité ajoutée, corrigée, supprimée ou déplacée de date, sur cet appareil ou un autre, change
  l'instantané : la journée redevient « à reconfirmer ». Retoucher une note ne rouvre rien.
- **Rien de validé sans l'avoir vu.** La confirmation porte l'instantané que la personne avait sous les yeux ; si une
  synchronisation (ou un autre onglet) a changé la journée pendant la boîte de confirmation, le noyau refuse
  (`reg-day-changed`) et l'interface le dit.
- **Objectifs versionnés.** Chaque changement ajoute une version (identifiant stable, date d'effet passée ou jusqu'à un an
  à venir, instant de création, sujet) ; aucune n'est réécrite. L'objectif d'une date est la version dont la date
  d'effet est la plus récente sans la dépasser. Une journée confirmée garde la version de sa confirmation, même
  corrigée puis reconfirmée. L'écran distingue l'objectif en cours, la prochaine version programmée, l'historique, et
  l'objectif utilisé pour chaque journée. Observer n'attribue ni réussite ni échec. Selene ne baisse jamais une limite
  d'elle-même et n'accélère aucun arrêt.
- **Début du suivi** : la première date connue (objectif ou saisie). Rien d'antérieur ne compte, ni comme inconnu ni
  comme échec. Une journée sans objectif à sa date n'a pas de verdict.
- **Dates locales.** Chaque entrée garde sa date déclarée (`AAAA-MM-JJ`) et, pour information, le fuseau de l'appareil
  (`zone`) : un voyage ou un changement d'heure ne reclasse rien. Les dates à venir sont refusées pour les envies,
  consommations, actions et confirmations. L'horloge de l'appareil n'est pas une preuve : c'est un suivi déclaratif.

## Pause de cinq minutes

Depuis une envie (à sa saisie, ou « Pause de 5 min » sur sa ligne). L'échéance absolue est enregistrée dans l'envie
(`pauseEnd`), donc synchronisée : le temps restant se recalcule chaque seconde et à chaque retour sur la page
(rechargement, veille, autre appareil). Elle s'arrête quand on veut, sans commentaire ; échue, elle s'affiche
« terminée » dix minutes puis disparaît. Aucune marque à l'expiration.

Le minuteur de quinze minutes de Selene n'est pas réutilisé : unique pour toute l'app, en mémoire seulement (perdu au
rechargement), il ouvre à son terme le pont de reprise et la suite propre au module. S'en servir aurait interrompu une
séance en cours et n'aurait pas survécu à un rechargement. La pause en reprend le principe (une échéance absolue
recalculée au retour, `visibilitychange`), sans partager son état.

## Marques et récompense (facultatives)

Masquées par défaut ; à afficher dans « Personnaliser mes appuis et récompenses ». **Une marque par date locale** où au
moins une action du plan a été déclarée réalisée, dans ce suivi seulement. Dérivées des actions (des entrées à
identifiant stable), jamais d'un compteur incrémenté : deux actions, deux appareils ou deux appuis le même jour ne
font qu'une marque ; « Je l'ai fait » porte un identifiant déduit de l'envie. Une envie, une consommation, une
ouverture de l'app ou une pause achevée n'en donnent pas. Un écart n'en retire aucune ; supprimer une action erronée
corrige le compte. Jalons fixes, annoncés : 1, 3, 7, 14, 30. Une récompense personnelle facultative, à un seuil choisi
(1 à 365), gratuite si on veut.

Exclus : aléa, coffre ou loterie, classement, paiement, série obligatoire (aucun « jours consécutifs »), remise à zéro
après une consommation, notification qui menace une perte, score de valeur personnelle. Pas de série d'abstinence dans
cette livraison. La météo, la lune et les scènes de Selene ne dépendent jamais de ce qui est déclaré.

## Bilan sur sept jours

Les sept derniers jours (aujourd'hui compris) en face des sept précédents, dans l'espace seulement : journées suivies,
complètes, inconnues ou à reconfirmer, quantités déclarées (toutes journées, un total partiel restant partiel),
moyenne **sur les seules journées complètes**, objectif atteint parmi les journées évaluables, versions d'objectif
entrées en vigueur pendant ces deux semaines, et la liste des jours avec l'objectif de chacun. Les moyennes ne sont
présentées comme comparables que si chaque période compte au moins quatre journées complètes et si leurs couvertures
diffèrent de deux journées au plus ; sinon l'écran dit pourquoi elles ne se comparent pas.

Les retours sur les appuis (trente derniers jours : choisi lors d'une envie, réalisé, utile / sans changement /
difficile) restent descriptifs : aucune cause, aucune efficacité n'en est tirée.

## Alcool

Avant de choisir un objectif, dans le formulaire (et replié dans l'espace ensuite, jamais à chaque saisie) :

- en cas de dépendance, un arrêt brutal ou une réduction rapide peuvent être dangereux (convulsions, delirium
  tremens) ; préparer le changement avec un médecin ou un CSAPA (centre de soins, d'accompagnement et de prévention en
  addictologie, gratuit, anonymat possible) ;
- Selene ne propose ni calendrier de sevrage, ni dose, ni conseil de traitement ;
- urgence : confusion, hallucinations, convulsions, fortes sueurs avec tremblements → 15 (Samu) ou 112 ; 114 par SMS
  ou visio pour les personnes sourdes ou malentendantes ;
- Alcool Info Service : 0 980 980 930, de 8 h à 2 h, 7 jours sur 7, anonyme et non surtaxé ; lien vers
  alcool-info-service.fr.

Sources (vérifiées le 1er octobre 2026) :

- Alcool Info Service (Santé publique France), [risque d'un arrêt brutal de consommation](https://www.alcool-info-service.fr/questions-reponses/risque-d-un-arret-brutal-de-consommmation)
  (syndrome de sevrage dans les premiers jours, delirium tremens rare mais grave) ;
- Alcool Info Service, [les repères de consommation](https://www.alcool-info-service.fr/sinformer-et-evaluer-sa-consommation/alcool-et-sante/les-reperes-de-consommation-quest-ce-que-cest)
  (verre standard = 10 g d'alcool pur, quel que soit le verre ; 25 cl de bière à 5 %, 10 cl de vin à 12 % ; à la
  maison et même au bar, les doses servies sont souvent plus grandes) et Assurance maladie,
  [repères de consommation](https://www.assurance-maladie.ameli.fr/index.php/assure/sante/themes/alcool-sante/definition-reperes-consommation) ;
- annuaire du service public, [Alcool Info Service](https://lannuaire.service-public.gouv.fr/centres-contact/R20694)
  (numéro et horaires) ;
- 15, 112 et 114 : numéros d'urgence nationaux et européen.

Limite de cette vérification : depuis l'environnement de développement, le proxy réseau bloquait l'accès direct à ces
sites ; leur contenu a été recoupé par les extraits d'un moteur de recherche (titres, résumés, numéros), pas lu page
par page. Les deux exemples gardés sont ceux de la page officielle et se vérifient par le calcul (25 cl × 5 % ×
0,8 g/ml = 10 g ; 10 cl × 12 % × 0,8 ≈ 9,6 g) ; celui de l'alcool fort (3 cl à 40 %), retrouvé seulement dans des
sources non officielles, a été retiré le 2 octobre 2026. À relire page par page avant une publication, depuis un réseau
qui y accède.

Les adresses citées ici et dans l'interface sont vérifiées chaque mois (`npm run liens`, workflow « Liens ») : une page
disparue (404, 410, domaine inconnu) fait échouer la vérification ; un site qui refuse le robot (401, 403, 429, 5xx) est
seulement signalé, puisqu'il dit qui refuse, pas ce qui manque.

L'efficacité clinique de cette gamification n'est pas établie. La gestion des contingences étudiée en soin repose sur
des comportements vérifiés et des renforcements tangibles, encadrés par des soignants ; elle ne valide pas des marques
autodéclarées dans un carnet. Selene présente cet espace comme un outil de suivi personnel, rien de plus.

## Confidentialité

Trois questions distinctes, à ne pas confondre :

- **Affichage.** Le nom de l'espace et sa présence restent visibles (navigation, accueil, Réglages, palette, liste
  « Ce que Claude peut lire »). Ses détails n'apparaissent que dans l'espace : le type n'a ni `texts` (recherche,
  palette, motifs et concordance, dérive lexicale, test lunaire, statuts épistémiques), ni `alerts` (Aujourd'hui,
  résumé du matin, notifications), ni `badge`, ni `accept` (rangement depuis la boîte). `recent` est vide, `review`
  nul ; le bilan général et la planche de lunaison l'ignorent (`TYPE_UI[type].sensitive`), même pour compter des
  événements ; le pont de reprise reste dans l'espace (ni sur sa ligne de l'accueil, ni dans « Reprendre ») ;
  `refFind` ne résout pas un lien vers ses entrées ; le widget ne lit que tâches et rappels. L'accueil n'en montre que
  « Suivi privé : ouvrir pour consulter ».
- **Assistant.** Partage désactivé à la création, depuis le modèle comme depuis un type vide. Le partager (bouton de
  l'espace, ou case des Réglages) ouvre d'abord le **résumé exact** qui partirait, à confirmer : sujet, unité, objectif
  en cours, et pour les sept derniers jours le nombre de journées suivies, complètes et inconnues, la quantité déclarée,
  la moyenne des journées complètes, les objectifs atteints parmi les journées évaluables. Jamais les notes, envies,
  déclencheurs, appuis ni la récompense. Ce résumé est affiché en permanence dans « Confidentialité et données ».
  Arrêter le partage empêche les envois suivants ; ce qui a déjà été envoyé n'est pas retiré (la conversation se
  trouve dans l'Assistant, sur l'appareil).
- **Stockage.** Ce n'est pas un coffre séparé : sans compte, les données restent sur l'appareil ; avec un compte, elles
  sont synchronisées avec le serveur de Selene comme le reste du tableau de bord (chaque compte n'y lit que sa ligne),
  **sans chiffrement de bout en bout**. Elles figurent dans la **sauvegarde complète**. L'**export dédié** (« Exporter ce
  suivi ») est un JSON lisible, non chiffré, au nom neutre (`selene-suivi-AAAA-MM-JJ.json`) : nom, sujet, réglages,
  versions d'objectif, journal complet avec les notes ; pour consulter ou garder, la restauration passant par la
  sauvegarde complète. **Supprimer** le suivi (retaper son nom) l'efface de l'appareil puis, à la synchronisation
  suivante, du compte et des autres appareils ; les fichiers déjà téléchargés restent où ils sont.

## Données et architecture

- `src/core/regulation.js` : règles pures (horloge et date locale passées en paramètres), erreurs à code
  (`coreError`, traduites par `lib/labels.js`). `MODULE_TYPES.regulation` (`core/domain.js`) : défauts,
  normalisation, validation. `src/app/modules/regulation.js` : l'écran, les formulaires (`openForm`), les actions
  `rlm-*`, enregistrés par `registerType` ; `sensitive: true`.
- Instance : `config` (`subject` — nul tant que non configuré —, `supports` : appuis, `rewards`, `reward`, `rewardAt`),
  `goals[]` (`id`, `date` d'effet, `at`, `mode` : `observer` | `reduire` | `arreter`, `limit` : null | 0 | > 0,
  `subject`), `entries[]` :
  - `use` : `value`, `declared` (total déclaré, pour un complément) ;
  - `urge` : `intensity` (null ou 0-10), `strategy`, `outcome`, `pauseEnd` ;
  - `action` : `strategy`, `urge` (l'envie, pour « Je l'ai fait », identifiant `act-<envie>`) ;
  - `day` : identifiant `day-AAAA-MM-JJ`, `goalId` (null sans objectif), `snapshot` ;
  - communs : `id`, `kind`, `date`, `at`, `zone`, `note`, `editedAt` (correction).
- **Format 7** (`SCHEMA_VERSION`, 6 sur main avant ce changement) : une version antérieure ne sait ni afficher ni
  valider ce type ; la garde existante lui interdit de fusionner ou d'écrire (« recharge la page »), et refuse
  l'import d'une sauvegarde plus récente. Aucune migration de données : le type est nouveau.
- **Fusion** : celle du store, à trois voies, entrée par entrée (`id`). Les marques et les confirmations sont dérivées
  ou à identifiant déterministe : pas de double gain, une confirmation par date. Deux appareils hors ligne qui
  commencent le même suivi avec deux sujets : un seul sujet est gardé, l'espace le **signale**
  (`regulationSubjectConflict`) au lieu de relire les quantités en silence.
- **Validation d'import** : la forme seulement (types, bornes larges, identifiants, dates valides, références
  d'objectif) ; rien qu'une fusion légitime puisse violer. Le pas de l'unité, les dates à venir et le plafond de
  1440 minutes sont vérifiés à la saisie.
- Aucune table, aucun serveur, aucune dépendance, aucun système d'événements ajoutés. Un commun modifié :
  `openForm` (description en tête, `max` d'un champ date, bornes d'un champ nombre, suite asynchrone dont l'erreur
  s'affiche) ; un champ nombre sans bornes garde `min="0" step="1"`.

## Vérifier

- `tests/regulation.test.js` : quatre sujets × trois intentions, unités entières et décimales, valeurs invalides, non
  finies, négatives ou démesurées, dates impossibles et à venir, minuit, fuseaux et changements d'heure, journées
  inconnues, complètes, rouvertes, confirmation refusée si l'instantané a changé, total quotidien, versions d'objectif,
  début du suivi, comparabilité, envies et « je l'ai fait » idempotent, marques, appuis et récompense, pause,
  corrections, fusions entre appareils (marques, confirmation, quantité tardive, suppression, conflit de sujet),
  sauvegardes (restauration, 21 imports invalides, version trop récente), et, dans l'app assemblée, chaque surface :
  assistant, recherche, accueil, bilan, planche, widget, résumé du matin, test lunaire, dérive, statuts, liens,
  sortes, arc, rangement de notes, motifs ; partage confirmé depuis les Réglages ; échappement HTML ; formulaire commun.
- `tests/browser/regulation.js` : le parcours complet sur téléphone (Chromium et WebKit en CI), dont la modification
  arrivée d'un autre onglet pendant la confirmation, la pause au rechargement, le partage depuis les Réglages ; puis
  ordinateur, clavier, libellés et anglais.
- `npm run check`, puis `npm run test:browser -- regulation` (`SELENE_BROWSER=webkit` pour WebKit ;
  `SHOTS=dossier` pour des captures).

### Parcours manuel (cinq minutes)

1. Accueil → « Reprendre la main » → Ajouter ; ouvrir l'espace. Réglages → Assistant : la case du suivi est décochée.
2. « Commencer » : nommer, choisir **Alcool** ; lire l'information sur le sevrage ; « Réduire », limite 2.
3. « Noter une consommation » 1,5 ; « Faire mon point du jour » : la date et « 1,5 verre standard au total » s'affichent ;
   confirmer. Noter 1 de plus : la journée passe « à reconfirmer ».
4. « Noter » → « Le total de la journée », hier, 3 : seul le complément s'ajoute ; la confirmation est proposée.
5. « J'ai une envie », un appui, « Oui, lancer la pause » ; recharger la page : le décompte continue. « J'ai fait :… »,
   puis « Arrêter la pause ».
6. « Personnaliser » : afficher les marques, récompense à 1 ; noter une seconde action : toujours une marque.
7. Accueil, Chercher (une note saisie), Bilan, planche : aucun détail. « Confidentialité et données » : lire le résumé ;
   « Partager… » montre le même texte avant de partager.
8. Créer un second suivi **Tabac** : pas d'avertissement alcool ; « 1.5 » cigarette est refusé.
