# Données et sauvegardes

La sauvegarde complète (export et import), les refus d'import, les migrations d'anciens formats, le stockage de l'appareil
et la taille d'un espace. Toutes les cibles ; les cas de taille et de stockage IndexedDB concernent les cibles hébergées.

**Préconditions communes** : un navigateur ou un profil réservé à la recherche ; les fichiers de [`donnees/`](../donnees/)
à portée (téléchargés depuis le dépôt). Importer **remplace tout l'état**, sur tous les appareils du compte : ne jamais le
faire sur un compte réel. En mode sans compte, l'import ne concerne que l'appareil.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [DON-001](#don-001) | Exporter une sauvegarde complète | P1 | Web, Mob, AND, IOS, WIN, ART |
| [DON-002](#don-002) | Importer une sauvegarde : tout est remplacé, partout | P1 | Web, Mob, AND, IOS, WIN, ART |
| [DON-003](#don-003) | Renoncer à un import au moment de confirmer | P1 | Web, Mob |
| [DON-004](#don-004) | Import d'une sauvegarde plus récente refusé | P1 | Web, Mob |
| [DON-005](#don-005) | Import d'un fichier hostile ou abîmé refusé | P1 | Web, Mob |
| [DON-006](#don-006) | Migration d'une ancienne sauvegarde (format 1) | P1 | Web, Mob, ART |
| [DON-007](#don-007) | Aller-retour export puis import sur un autre navigateur | P1 | Web, Mob, ART |
| [DON-008](#don-008) | Données relues après relance ; deux onglets ouverts | P1 | Web, Mob |
| [DON-009](#don-009) | Taille de l'espace et alerte | P3 | Web |
| [DON-010](#don-010) | Une valeur numérique hors bornes dans les Réglages | P2 | Web, Mob |

Identifiants retirés : aucun.

---

<a id="don-001"></a>
### DON-001 — Exporter une sauvegarde complète

- **Fonctionnalité et règle** : Réglages → Compte et données → Sauvegarde → « Exporter » : tout l'état dans un fichier JSON
  (`selene-AAAA-MM-JJ.json`, format `selene-v1`) ; la clé API n'y figure jamais ; un suivi « Reprendre la main » gardé sur
  l'appareil y est en entier.
- **Objectif, risque vérifié** : sauvegarde incomplète (la seule assurance contre la perte d'un appareil) ; secret exporté.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN, ART
- **Préconditions** : jeu d'essai importé ; puis, pour l'étape 4, [`donnees/rlm-en-cours.json`](../donnees/rlm-en-cours.json) importé.
- **Données** : aucune.
- **Automatisés associés** : `TU-MOD-04`, `TU-REG-34`, `TU-BAK-01`
- **Source** : [DOC] README, « Données » ; [DOC] [regulation.md](../../regulation.md#confidentialité) ; [TEST] `TU-REG-34`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « Exporter ». | Un fichier `selene-` suivi de la date du jour, `.json`, se télécharge (dans les apps : la feuille d'enregistrement ou de partage du système). |
| 2 | L'ouvrir dans un éditeur de texte. | `"format": "selene-v1"`, `"exportedAt"`, `"board"`, `"site"` ; les treize espaces et leurs entrées. |
| 3 | Y chercher `access_token`, `refresh_token`, `sk-ant`, `selene-api-key`. | Aucune occurrence. |
| 4 | Avec `rlm-en-cours.json` importé : exporter, chercher `Repas de famille`. | Présent : le contenu du suivi gardé sur l'appareil est dans la sauvegarde. |

- **État final attendu** : un fichier exporté.
- **Nettoyage** : supprimer le fichier du disque après usage (il est en clair).

---

<a id="don-002"></a>
### DON-002 — Importer une sauvegarde : tout est remplacé, partout

- **Fonctionnalité et règle** : « Importer » remplace tout l'état par celui du fichier, sur tous les appareils, sans fusion ;
  une confirmation le demande d'abord.
- **Objectif, risque vérifié** : fusion inattendue (doublons) ; import qui ne se propage pas.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN, ART
- **Préconditions** : compte de recette A connecté sur deux appareils, avec une capture `avant import DON-002`.
- **Données** : [`donnees/jeu-essai.json`](../donnees/jeu-essai.json).
- **Automatisés associés** : `TU-SYN-15`, `TU-MOD-25`, `TN-sauvegarde-complete`
- **Source** : [DOC] README, « Comptes et synchronisation » ; [DOC] [reglages-aide.js](../../../src/app/views/reglages-aide.js) (« Importer remplace tout l'état actuel… ») ; [TEST] `TU-SYN-15`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Appareil 1 : Sauvegarde → « Importer », choisir le fichier. | « Remplacer tout l'état actuel par celui du fichier ? » |
| 2 | Confirmer. | « Sauvegarde importée. » ; les treize espaces du jeu ; la capture `avant import DON-002` n'existe plus. |
| 3 | Appareil 2 : attendre 30 s ou revenir sur l'onglet. | Même état, sans doublon (une seule « Boîte », un seul « Chantier »). |

- **État final attendu** : le compte A contient exactement le jeu d'essai.
- **Nettoyage** : aucun (le jeu d'essai sert ailleurs).

---

<a id="don-003"></a>
### DON-003 — Renoncer à un import au moment de confirmer

- **Fonctionnalité et règle** : la confirmation d'import peut être refusée ; rien ne change alors.
- **Objectif, risque vérifié** : état remplacé alors que la personne a refusé.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai importé ; une capture `à garder DON-003`.
- **Données** : [`donnees/ancien-format-1.json`](../donnees/ancien-format-1.json).
- **Automatisés associés** : `TU-SYN-15`, `TN-sauvegarde-complete`
- **Source** : [CODE] `imp` (`shell/actions.js`) : l'état n'est remplacé qu'après « ok ».

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « Importer », choisir le fichier. | La confirmation s'affiche. |
| 2 | « Annuler ». | Aucun message « Sauvegarde importée. » ; la capture `à garder DON-003` et les treize espaces sont toujours là. |
| 3 | Recharger. | Idem. |

- **État final attendu** : inchangé.
- **Nettoyage** : supprimer la capture.

---

<a id="don-004"></a>
### DON-004 — Import d'une sauvegarde plus récente refusé

- **Fonctionnalité et règle** : un import d'un format plus récent que l'app est refusé, avec un message explicite.
- **Objectif, risque vérifié** : une version ancienne qui écrase ou abîme des données qu'elle ne sait pas lire.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai importé.
- **Données** : [`donnees/refus-version-future.json`](../donnees/refus-version-future.json) (format 99).
- **Automatisés associés** : `TU-BAK-07`, `TN-sauvegarde-complete`
- **Source** : [DOC] [architecture.md](../../architecture.md#données) ; [TEST] `TU-BAK-07`. Vérifié dans Chromium le 4 octobre 2026.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « Importer », choisir le fichier. | Aucune confirmation ; message « Sauvegarde créée par une version plus récente de Selene : mets l'application à jour d'abord. » |
| 2 | Parcourir l'app. | Le jeu d'essai est intact ; aucune note « venue du futur ». |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.

---

<a id="don-005"></a>
### DON-005 — Import d'un fichier hostile ou abîmé refusé

- **Fonctionnalité et règle** : un fichier de sauvegarde est traité comme hostile : identifiants, bornes des nombres, dates
  réelles, types connus ; tout écart est refusé avant d'importer ; rien ne s'exécute.
- **Objectif, risque vérifié** : injection de script par une sauvegarde ; état corrompu.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai importé.
- **Données** : [`donnees/refus-hostile.json`](../donnees/refus-hostile.json) (identifiant de module piégé, texte `<script>`) ;
  un fichier texte quelconque renommé `photo.json` ; un JSON valide sans `format`.
- **Automatisés associés** : `TU-BAK-02`, `TU-BAK-04`, `TU-BAK-05`, `TU-BAK-09`, `TN-injection`, `TN-sauvegarde-complete`
- **Source** : [DOC] [architecture.md](../../architecture.md#sécurité) ; [TEST] `TU-BAK-05`, `TU-BAK-09`. Vérifié dans Chromium les 4 et 5 octobre 2026.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Importer `refus-hostile.json`. | Aucune confirmation ; « Le contenu de cette sauvegarde n'est pas valide : le fichier est peut-être abîmé ou a été modifié. Rien n'a été importé. » ; aucune alerte JavaScript ne s'ouvre. |
| 2 | Importer `photo.json`, puis le JSON sans `format`. | `photo.json` : « Ce fichier ne se lit pas comme une sauvegarde : il est peut-être abîmé ou incomplet. Rien n'a été importé. » ; le JSON sans `format` : « Ce fichier n'est pas une sauvegarde Selene. Rien n'a été importé. » Aucune confirmation dans les deux cas. |
| 3 | Parcourir l'app. | Le jeu d'essai est intact. |

- **État final attendu** : inchangé.
- **Nettoyage** : aucun.
- **Remarque** : le message ne dit pas quel champ est refusé, ni si le fichier est abîmé ou piégé : c'est voulu (le détail reste dans le journal). Anomalie [A3](../perimetre.md#anomalies-et-observations) corrigée.

---

<a id="don-006"></a>
### DON-006 — Migration d'une ancienne sauvegarde (format 1)

- **Fonctionnalité et règle** : chaque ancienne section (`kundalini`, `ecriture`, `phidippus`, `moth`, `musique`, `inbox`,
  `budget`) devient un module générique, et les tâches de l'ancien document `board` vont dans le module Chantier ; noms
  personnalisés et choix de partage gardés ; un statut inconnu retombe sur le premier.
- **Objectif, risque vérifié** : perte de données d'un ancien utilisateur à la mise à jour.
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : mode sans compte, navigateur aux données effacées.
- **Données** : [`donnees/ancien-format-1.json`](../donnees/ancien-format-1.json).
- **Automatisés associés** : `TU-MOD-01`, `TU-MOD-12`, `TU-MOD-17`, `TU-MOD-21`, `TU-SYN-20`, `TN-sauvegarde-complete`
- **Source** : [DOC] [architecture.md](../../architecture.md#données) ; [TEST] `TU-MOD-01`. Vérifié dans Chromium le 4 octobre 2026 (étapes 2 à 5).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Importer le fichier, confirmer. | « Sauvegarde importée. » |
| 2 | Ouvrir Chantier. | La tâche « Poser le velux » (Chambre, 250 €, étape « Devis » cochée). |
| 3 | Ouvrir Kundalini et Écriture. | Kundalini : programme commencé le 6 janvier 2025, une séance de 20 min « Premier jour ». Écriture : « Mon livre », objectif 40 000, chapitre « Prologue », 500 mots, fragment « Une phrase qui passe ». |
| 4 | Ouvrir l'espace de rappels. | Il s'appelle « Aragne » (nom personnalisé gardé) ; une entrée de repas « Un grillon » le 6 janvier 2025. |
| 5 | Ouvrir october.moth et Musique. | october.moth en colonnes : « Le lichen » en « Prêt », « Ancien statut » en « Idée » (statut inconnu → premier). Musique en liste : « Dead Can Dance », « Aion », « Retenu ». |
| 6 | Ouvrir la Capture et le Budget (janvier 2025). | La note « acheter des clous » ; une dépense de 42,50 € dans l'enveloppe Courses (300 €). |
| 7 | Réglages → Assistant → « Ce que Claude peut lire ». | Budget décoché, les autres cochés (choix d'origine). |
| 8 | Exporter, puis réimporter cet export. | Accepté ; rien ne change. |

- **État final attendu** : un compte au format 8 avec toutes les anciennes données.
- **Nettoyage** : effacer les données du site.

---

<a id="don-007"></a>
### DON-007 — Aller-retour export puis import sur un autre navigateur

- **Fonctionnalité et règle** : « pour passer d'une version à l'autre » (claude.ai ↔ site, navigateur ↔ app) : exporter puis
  importer reproduit l'état.
- **Objectif, risque vérifié** : perte d'un type de donnée au passage (liens, statuts, provenance, paliers).
- **Priorité** : P1 · **Plateformes** : Web, Mob, ART
- **Préconditions** : navigateur 1 avec le jeu d'essai modifié : un fragment de plus avec un statut, un lien, un palier coché ;
  navigateur 2 (ou l'artefact claude.ai) aux données effacées, mode sans compte.
- **Données** : aucune de plus.
- **Automatisés associés** : `TU-BAK-01`, `TU-MOD-04`, `TU-MOD-09`
- **Source** : [DOC] README, « Données » ; [TEST] `TU-BAK-01`, `TU-MOD-09`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Navigateur 1 : exporter. | Un fichier. |
| 2 | Navigateur 2 : importer ce fichier. | « Sauvegarde importée. » |
| 3 | Comparer, espace par espace, le nombre d'entrées et trois entrées au hasard. | Identiques ; le fragment ajouté garde son statut, son lien et sa provenance ; le palier coché l'est encore. |
| 4 | Comparer les Réglages (palette, domaines, ordre, partage avec l'assistant). | Identiques. |

- **État final attendu** : deux navigateurs au même état.
- **Nettoyage** : effacer les données du navigateur 2.

---

<a id="don-008"></a>
### DON-008 — Données relues après relance ; deux onglets ouverts

- **Fonctionnalité et règle** : la version web garde ses données dans IndexedDB (base `selene`, magasin `kv`), les secrets
  dans localStorage ; un autre onglet se met à jour (BroadcastChannel).
- **Objectif, risque vérifié** : données perdues à la fermeture du navigateur ; deux onglets qui s'écrasent.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai importé, mode sans compte.
- **Données** : capture `relance DON-008`.
- **Automatisés associés** : `TN-indexeddb`, `TU-PLT-16`
- **Source** : [DOC] ADR 13 ([architecture.md](../../architecture.md#adr-13--les-données-de-la-version-web-dans-indexeddb)) ; [TEST] `tests/browser/indexeddb.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Selene dans deux onglets. | — |
| 2 | Onglet 1 : capturer le texte des données. | Onglet 2 : la capture apparaît dans la boîte en quelques secondes, sans recharger. |
| 3 | Outils → Application → IndexedDB → `selene` → `kv`. | Les clés `selene-site-v1` (et sa base `-base` si connecté) ; Local Storage ne contient que des secrets et réglages d'appareil, pas `selene-site-v1`. |
| 4 | Quitter complètement le navigateur, le relancer, rouvrir Selene. | La capture est là. |

- **État final attendu** : une capture de plus.
- **Nettoyage** : la supprimer.

---

<a id="don-009"></a>
### DON-009 — Taille de l'espace et alerte

- **Fonctionnalité et règle** : Réglages → Sauvegarde dit ce que pèse l'espace (le serveur en garde 5 Mo au plus) ; à partir de
  3 Mo, la ligne passe en alerte et nomme les modules les plus lourds ; au-delà de la limite, le serveur refuse et
  l'indicateur dit « Trop volumineux pour le serveur ».
- **Objectif, risque vérifié** : historique qui grossit jusqu'à ne plus se synchroniser, sans prévenir.
- **Priorité** : P3 · **Plateformes** : Web
- **Préconditions** : version hébergée ; jeu de volume ([donnees/README.md](../donnees/README.md#volume), plus de 3 Mo).
- **Données** : aucune.
- **Automatisés associés** : `TN-taille`
- **Source** : [DOC] [compte.md](../../compte.md#taille-dun-espace) ; [TEST] `tests/browser/taille.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Jeu d'essai : Réglages → Compte et données → Sauvegarde. | « Ton espace pèse … Ko ; le serveur en garde 5,0 Mo au plus. » |
| 2 | Importer le jeu de volume, revenir à la Sauvegarde. | La ligne passe en alerte : « Il approche de la limite… Exporte une sauvegarde, puis allège les plus lourds : … » avec les modules les plus lourds (Écriture, Boîte). |

- **État final attendu** : jeu de volume importé.
- **Nettoyage** : réimporter le jeu d'essai.

---

<a id="don-010"></a>
### DON-010 — Une valeur numérique hors bornes dans les Réglages

- **Fonctionnalité et règle** : un nombre de réglage reste dans les bornes que la validation des sauvegardes accepte (1 à 520
  semaines, 1 à 7 séances), pour qu'un export puisse toujours être réimporté.
- **Objectif, risque vérifié** : l'app accepte une valeur que sa propre sauvegarde refuserait ensuite.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : jeu d'essai.
- **Données** : Yoga, durée `600` puis `-4` ; séances par semaine `9`.
- **Automatisés associés** : `TU-MOD-44`
- **Source** : [TEST] `TU-MOD-44`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | « régler » Yoga : durée en semaines `600`, quitter le champ. | La valeur devient 520. |
| 2 | Durée `-4`. | La valeur devient 1. |
| 3 | Séances par semaine `9`. | La valeur devient 7. |
| 4 | Exporter, puis réimporter. | Import accepté. |

- **État final attendu** : Yoga à 1 semaine, 7 séances.
- **Nettoyage** : réimporter le jeu d'essai.
