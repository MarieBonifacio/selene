# Synchronisation et hors-ligne

Deux appareils du même compte, les écritures simultanées, le hors-ligne, la fermeture d'un onglet, une version ancienne
restée ouverte, et le hors-ligne de la PWA. Concerne les cibles hébergées connectées (et `SYN-010` la PWA).

**Préconditions communes** : compte de recette A connecté sur deux appareils ou deux navigateurs (« A1 » et « A2 ») ; jeu
d'essai importé sur le compte (DON-002). La synchronisation part environ une seconde après une modification ; l'autre
appareil la voit dans les 30 s, ou dès qu'on revient sur son onglet. « Couper le réseau » : mode avion, ou outils de
développement → Network → Offline.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [SYN-001](#syn-001) | Une saisie faite sur un appareil apparaît sur l'autre | P1 | Web, Mob, AND, IOS, WIN |
| [SYN-002](#syn-002) | Ajouts simultanés sur deux appareils | P1 | Web, Mob |
| [SYN-003](#syn-003) | Supprimée d'un côté, modifiée de l'autre : l'entrée est gardée | P1 | Web, Mob |
| [SYN-004](#syn-004) | Hors ligne, puis retour du réseau | P1 | Web, Mob, AND, IOS, WIN |
| [SYN-005](#syn-005) | Saisie juste avant de fermer l'onglet | P1 | Web, Mob |
| [SYN-006](#syn-006) | Un espace supprimé sur un appareil ne revient pas | P1 | Web, Mob |
| [SYN-007](#syn-007) | Une version ancienne restée ouverte ne fusionne rien | P1 | Web |
| [SYN-008](#syn-008) | Deux boîtes de réception désignées sur deux appareils | P2 | Web |
| [SYN-009](#syn-009) | Un appareil neuf adopte le compte sans doublon | P1 | Web, Mob, AND, IOS, WIN |
| [SYN-010](#syn-010) | Hors-ligne de la PWA | P2 | Web, Mob |

Identifiants retirés : aucun.

---

<a id="syn-001"></a>
### SYN-001 — Une saisie faite sur un appareil apparaît sur l'autre

- **Fonctionnalité et règle** : chaque modification part au bout d'une seconde ; les autres appareils la voient dans les 30 s
  ou au retour sur l'onglet ; un relevé sans changement ne lit que la date de la dernière écriture.
- **Objectif, risque vérifié** : appareils désynchronisés.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : A1 et A2 ouverts sur l'accueil.
- **Données** : capture `de A1 SYN-001`.
- **Automatisés associés** : `TN-sync-deux-appareils`, `TU-SYN-08`, `TU-SYN-09`, `TU-MOD-66`, `TN-veille`, `TU-SYN-24`
- **Source** : [DOC] README, « Comptes et synchronisation » ; [DOC] [architecture.md](../../architecture.md#synchronisation) ; [TEST] `tests/browser/sync-deux-appareils.js` ; [ANOMALIE] A33.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | A1 : capturer le texte des données. | L'indicateur d'enregistrement dit « Enregistrement… » puis s'efface. |
| 2 | A2 : laisser l'onglet visible et attendre jusqu'à 30 s. | La capture apparaît dans la boîte de A2 sans recharger. |
| 3 | A2 : passer sur un autre onglet ; A1 : supprimer la capture (laisser passer « Annuler ») ; A2 : revenir sur l'onglet. | La capture disparaît de A2 dès le retour. |
| 4 | A2 : Nouveautés · Dehors → déplier « Clé OpenAlex (facultative) », y taper `cle-de-recette` sans quitter le champ ; A1 : capturer `pendant la frappe` ; A2 : attendre 30 s, champ toujours actif. | Sur A2, la clé tapée reste, le curseur dans le champ, le bloc ouvert (A33). Le champ quitté, la capture apparaît dans la boîte de A2. Effacer ensuite la clé (vider le champ). |

- **État final attendu** : identique sur les deux appareils.
- **Nettoyage** : aucun.

---

<a id="syn-002"></a>
### SYN-002 — Ajouts simultanés sur deux appareils

- **Fonctionnalité et règle** : deux appareils modifiés en même temps : les modifications sont fusionnées (trois voies,
  entrée par entrée), pas écrasées ; deux liens ajoutés à la même entrée survivent tous deux.
- **Objectif, risque vérifié** : écrasement silencieux d'une saisie (le défaut historique de « la dernière écriture gagne »).
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : A1 et A2 sur Chantier ; A2 hors ligne.
- **Données** : A1 : tâche `Tâche de A1 SYN-002` ; A2 : tâche `Tâche de A2 SYN-002` ; A1 et A2 : un lien chacun depuis le même
  fragment « Le brouillard efface la route… » (« fait écho à » une entrée différente).
- **Automatisés associés** : `TU-SYN-02`, `TU-MOD-51`, `TN-sync-deux-appareils`
- **Source** : [DOC] ADR 3 ; [TEST] `TU-SYN-02`, `TU-MOD-51`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | A2 hors ligne : ajouter sa tâche et son lien. | « Non synchronisé — enregistré sur cet appareil seulement ». |
| 2 | A1 en ligne : ajouter sa tâche et son lien. | Partis. |
| 3 | A2 : rétablir le réseau, attendre 30 s. | A2 a les deux tâches et les deux liens. |
| 4 | A1 : attendre 30 s ou revenir sur l'onglet. | A1 a aussi les deux tâches et les deux liens ; aucune tâche en double. |

- **État final attendu** : deux tâches et deux liens de plus, sur les deux appareils.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="syn-003"></a>
### SYN-003 — Supprimée d'un côté, modifiée de l'autre : l'entrée est gardée

- **Fonctionnalité et règle** : une entrée supprimée d'un côté mais modifiée de l'autre est conservée (pas de perte
  silencieuse) ; une suppression et une modification qui touchent deux entrées différentes s'appliquent toutes deux.
- **Objectif, risque vérifié** : perte d'une modification.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : A1 et A2 sur Chantier, à jour.
- **Données** : tâche « Appeler le plombier » ; tâche « Poser une étagère ».
- **Automatisés associés** : `TU-SYN-04`, `TU-SYN-03`, `TN-sync-deux-appareils`
- **Source** : [DOC] README, « Comptes et synchronisation » ; [TEST] `TU-SYN-03`, `TU-SYN-04`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Couper le réseau sur A1 et A2. | Rien ne change à l'écran : l'indicateur ne parle qu'à la première écriture qui ne part pas, même après une relève du serveur (toutes les 30 s). |
| 2 | A1 : supprimer « Appeler le plombier » (laisser passer « Annuler ») et « Poser une étagère ». | Les deux tâches disparaissent de la liste d'A1 ; « Non synchronisé — enregistré sur cet appareil seulement ». |
| 3 | A2 : modifier « Appeler le plombier » (note `urgent, mardi`). | Sur A2, « Appeler le plombier » porte la note `urgent, mardi` ; « Non synchronisé — enregistré sur cet appareil seulement ». |
| 4 | Rétablir le réseau sur A1, attendre, puis sur A2, attendre 30 s ; revenir sur A1. | Sur les deux : « Appeler le plombier » existe avec la note `urgent, mardi` ; « Poser une étagère » est supprimée. |

- **État final attendu** : une tâche supprimée, une conservée modifiée.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="syn-004"></a>
### SYN-004 — Hors ligne, puis retour du réseau

- **Fonctionnalité et règle** : hors ligne, l'app continue de fonctionner et affiche « Non synchronisé » ; tout part au retour
  du réseau ; une coupure ne déconnecte pas.
- **Objectif, risque vérifié** : perte de saisies faites hors ligne.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : A1 et A2 connectés.
- **Données** : sur A1 hors ligne : une capture, un fragment, une dépense de 9 €.
- **Automatisés associés** : `TU-SYN-07`, `TU-SYN-10`, `TU-AUTH-01`, `TU-AUTH-09`, `TU-AUTH-10`, `TU-AUTH-11`, `TN-hors-ligne-reel`
- **Source** : [DOC] README, « Comptes et synchronisation » ; [TEST] `TU-SYN-07`, `TU-SYN-10`, `tests/browser/hors-ligne-reel.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | A1 : couper le réseau ; saisir les trois éléments. | Chaque saisie est acceptée ; « Non synchronisé — enregistré sur cet appareil seulement ». |
| 2 | A1 : recharger la page (toujours hors ligne). | L'app s'ouvre (service worker ou app native), les trois saisies sont là, toujours connectée. |
| 3 | A1 : rétablir le réseau. | L'indicateur s'efface dans les 30 s. |
| 4 | A2 : vérifier. | Les trois saisies sont arrivées. |

- **État final attendu** : synchronisé.
- **Nettoyage** : supprimer les trois saisies.

---

<a id="syn-005"></a>
### SYN-005 — Saisie juste avant de fermer l'onglet

- **Fonctionnalité et règle** : une saisie part au serveur 0,9 s après la dernière frappe. Si l'onglet se ferme avant,
  une écriture `keepalive` part sans relecture, à condition que le document pèse moins de 60 000 octets
  (`KEEPALIVE_MAX`) ; plus lourd, rien ne part à la fermeture : la saisie reste sur l'appareil et part au lancement
  suivant.
- **Objectif, risque vérifié** : la dernière saisie perdue parce qu'on ferme aussitôt.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : A1 et A2 connectés au compte A, A2 laissé visible sur la boîte. Étapes 1 à 3 : un espace léger
  (compte neuf, ou le jeu d'essai, qui pèse une douzaine de Ko). Étapes 4 à 6 : le jeu de volume importé sur A1 et arrivé sur
  A2.
- **Données** : captures `dernière seconde SYN-005` puis `dernière seconde lourde SYN-005` ; le jeu de volume
  (`npm run recette -- donnees`, `dist/recette/volume.json`, 3,5 Mo environ).
- **Automatisés associés** : `TN-sync-deux-appareils`, `TU-SYN-12`
- **Source** : [DOC] [architecture.md](../../architecture.md#lire-fusionner-écrire-sous-condition) ; [CODE] `s.flush`
  et `KEEPALIVE_MAX` (`src/app/state/store.js`) ; [TEST] `TU-SYN-12`, `tests/browser/sync-deux-appareils.js`. Réécrit le
  6 octobre 2026 : l'ancienne version acceptait « arrivée, ou au plus tard à la réouverture » et ne pouvait pas
  échouer, et son étape « document plus gros » utilisait le jeu d'essai, trop léger pour sortir du chemin `keepalive`
  ([BL-20](../backlog.md#bl-20)).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | A1 : Réglages → Compte et données → Sauvegarde : lire la taille de l'espace. | « Ton espace pèse N Ko ; le serveur en garde 5,0 Mo au plus. », avec N de 55 au plus (le seuil est de 60 000 octets ; la marge couvre l'arrondi). Plus lourd : cas *bloqué*, préparer un espace léger. |
| 2 | A1 : sur l'accueil, capturer `dernière seconde SYN-005`, valider par Entrée, puis fermer l'onglet aussitôt au clavier (Ctrl+W, ⌘W sur Mac), en moins d'une seconde. Ne pas rouvrir A1. | L'onglet se ferme sans demander de confirmation. |
| 3 | A2 : attendre 30 s sans toucher A1. | La capture `dernière seconde SYN-005` est dans la boîte d'A2, alors qu'A1 est resté fermé (envoi à la fermeture). |
| 4 | A1 : rouvrir Selene, importer le jeu de volume, attendre qu'A2 l'affiche ; puis lire la taille comme à l'étape 1. | « Ton espace pèse 3,5 Mo environ… » (plus de 60 Ko) ; l'avertissement « Il approche de la limite… » est attendu à cette taille. |
| 5 | A1 : capturer `dernière seconde lourde SYN-005`, valider par Entrée et fermer aussitôt comme à l'étape 2 ; A2 : attendre 30 s. | La capture n'est **pas** sur A2 : rien ne part à la fermeture d'un document de cette taille. Présente sur A2 : refaire en fermant plus vite ; présente deux fois de suite après une fermeture immédiate, c'est un écart (le seuil n'est pas appliqué). |
| 6 | A1 : rouvrir Selene ; A2 : attendre 30 s. | Sur A1, la capture est dans la boîte (elle était restée sur l'appareil) ; sur A2, elle arrive dans les 30 s. |

- **État final attendu** : les deux captures sur les deux appareils.
- **Nettoyage** : réimporter le jeu d'essai sur A1 (le jeu de volume ralentit les autres cas).

---

<a id="syn-006"></a>
### SYN-006 — Un espace supprimé sur un appareil ne revient pas

- **Fonctionnalité et règle** : un module supprimé reste supprimé sur l'autre appareil, même si celui-ci l'a modifié hors
  ligne entre-temps : la suppression gagne (décision du 6 octobre 2026), grâce à une pierre tombale (`config.deleted`,
  une empreinte de l'identifiant et la date) ; l'appareil qui perd ses modifications le dit ; la normalisation ne recrée
  jamais un module absent.
- **Objectif, risque vérifié** : espace qui ressuscite (et ses données avec).
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : A1 et A2 à jour ; A2 hors ligne.
- **Données** : espace « Arc ».
- **Automatisés associés** : `TU-SYN-05`, `TU-SYN-22`, `TU-SYN-23`, `TU-MOD-02`
- **Source** : [DOC] [architecture.md](../../architecture.md#normalisation-à-lentrée-lecture-pure) (ADR 34) ; [CODE]
  `buryDeleted` (`core/domain.js`) ; [TEST] `TU-SYN-05`, `TU-SYN-22`, `TU-SYN-23` ; anomalie A13 : avant le
  6 octobre 2026, l'espace revenait sur les deux appareils, avec la modification d'A2.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | A1 : supprimer « Arc » (nom retapé). | La confirmation dit « … la suppression définitive de ses données, sur tous tes appareils. » ; puis « « Arc » supprimé. » |
| 2 | A2 (hors ligne) : ouvrir Arc et y placer un élément. | Accepté localement. |
| 3 | A2 : rétablir le réseau, attendre 30 s. | Arc disparaît d'A2 : « « Arc » a été supprimé depuis un autre appareil ; tes modifications d'ici n'ont pas été gardées. » |
| 4 | Recharger A1 et A2. | Arc est absent des deux appareils, navigation comprise ; aucune erreur. |

- **État final attendu** : Arc absent des deux appareils.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="syn-007"></a>
### SYN-007 — Une version ancienne restée ouverte ne fusionne rien

- **Fonctionnalité et règle** : une version de l'app qui lit un format plus récent que le sien refuse de fusionner et
  d'écrire : « recharge la page » ; sa saisie reste locale.
- **Objectif, risque vérifié** : une vieille version qui écrase des données qu'elle ne comprend pas.
- **Priorité** : P1 · **Plateformes** : Web
- **Préconditions** : difficile à provoquer en production : il faut une version antérieure au format courant. Méthode :
  servir localement un build d'un commit antérieur au format 8 (avant le 3 octobre 2026, par exemple `git checkout` d'un
  commit de septembre, `npm ci && npm run build:dist`, servir `dist/web`) **connecté au même compte de recette**, pendant que
  la version courante a déjà écrit.
- **Données** : sur l'ancienne version, capture `vieille version SYN-007`.
- **Automatisés associés** : `TU-SYN-16`, `TN-sync-deux-appareils`
- **Source** : [DOC] [architecture.md](../../architecture.md#données) ; [TEST] `TU-SYN-16`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Version courante (A1) : ajouter une note (le serveur passe au format 8). | La note s'affiche sur A1, et l'indicateur d'enregistrement s'efface (partie au serveur). |
| 2 | Ancienne version (A2), même compte : attendre la synchronisation. | L'indicateur dit « Selene a été mise à jour sur un autre appareil : recharge la page pour synchroniser ». |
| 3 | A2 : capturer le texte des données. | Gardé sur l'appareil seulement ; rien n'est écrit au serveur. |
| 4 | A1 : vérifier. | Aucune donnée abîmée ; la capture de A2 n'est pas arrivée. |

- **État final attendu** : serveur intact.
- **Nettoyage** : fermer l'ancienne version.

---

<a id="syn-008"></a>
### SYN-008 — Deux boîtes de réception désignées sur deux appareils

- **Fonctionnalité et règle** : une seule boîte à la fois, garantie y compris après une fusion entre appareils.
- **Objectif, risque vérifié** : deux boîtes, captures dispersées.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : A1 et A2 hors ligne, à jour.
- **Données** : A1 désigne « Carnet » ; A2 désigne un nouvel espace Notes `Vrac SYN-008`.
- **Automatisés associés** : `TU-MOD-18`, `TN-sync-deux-appareils`
- **Source** : [DOC] [architecture.md](../../architecture.md#modules) ; [TEST] `TU-MOD-18`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Hors ligne, chacun désigne sa boîte. | Sur A1, « Carnet » a « Boîte de réception » coché ; sur A2, `Vrac SYN-008` ; « Non synchronisé » des deux côtés. |
| 2 | Rétablir le réseau, attendre la synchronisation des deux. | Une seule boîte désignée sur les deux appareils (la même) ; la capture rapide va dans celle-ci. |

- **État final attendu** : une boîte.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="syn-009"></a>
### SYN-009 — Un appareil neuf adopte le compte sans doublon

- **Fonctionnalité et règle** : un appareil vierge adopte le serveur (ses données de départ sont « vierges ») ; un appareil
  qui a de vraies données fusionne sans rien supprimer.
- **Objectif, risque vérifié** : doublons à la première connexion (boîte en double, éléments de départ dupliqués).
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : compte A avec le jeu d'essai ; un appareil ou profil neuf.
- **Données** : aucune.
- **Automatisés associés** : `TU-SYN-01`, `TU-MOD-26`, `TU-SYN-21`
- **Source** : [DOC] [architecture.md](../../architecture.md#données-de-départ) ; [TEST] `TU-SYN-01`, `TU-MOD-26`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur l'appareil neuf, « J'ai déjà un compte » → se connecter avec A. | Le compte s'affiche. |
| 2 | Compter les boîtes de réception et les espaces. | Exactement ceux du compte : une seule boîte, treize espaces, pas de bloc « Composer ton espace ». |
| 3 | Ouvrir la boîte. | Les six notes du jeu, chacune une fois. |

- **État final attendu** : appareil identique au compte.
- **Nettoyage** : se déconnecter de l'appareil neuf.

---

<a id="syn-010"></a>
### SYN-010 — Hors-ligne de la PWA

- **Fonctionnalité et règle** : le service worker garde l'app pour le hors-ligne (réseau d'abord pour la page, cache ensuite) ;
  la politique de confidentialité et la page de présentation ne prennent jamais sa place dans le cache.
- **Objectif, risque vérifié** : PWA qui ne s'ouvre pas hors ligne, ou qui s'ouvre sur une autre page.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : site hébergé ; une première visite de l'app en ligne ; la PWA installée de préférence (PLT-001).
- **Données** : aucune.
- **Automatisés associés** : `TN-hors-ligne`, `TN-hors-ligne-reel`
- **Source** : [CODE] `sw.js` ; [TEST] `tests/browser/hors-ligne.js` (qui lit le cache) et `tests/browser/hors-ligne-reel.js` (qui rouvre l'app hors ligne, sous Chromium).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | En ligne : ouvrir l'app, puis `confidentialite.html`, puis `essai.html?src=recette`. | Les trois pages s'affichent. |
| 2 | Couper le réseau ; ouvrir l'adresse de l'app (ou la PWA installée). | L'app s'ouvre, pas la politique ni la page de présentation ; les données de l'appareil sont là. |
| 3 | Hors ligne, ouvrir `confidentialite.html`. | Erreur réseau du navigateur (cette page n'est pas gardée hors ligne) : comportement attendu. |

- **État final attendu** : inchangé.
- **Nettoyage** : rétablir le réseau.
