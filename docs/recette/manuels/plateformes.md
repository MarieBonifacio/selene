# Plateformes

Ce que chaque cible ajoute à la page commune, et ce qu'elle peut casser : la PWA installée (iPhone, Android), les apps
Capacitor (Android, iOS), l'app Tauri (Windows), l'artefact claude.ai. Références : [android.md](../../android.md),
[ios.md](../../ios.md), [desktop.md](../../desktop.md), README (« Installer sur iPhone »).

**Préconditions communes** : un appareil de recette (jamais un téléphone ou un PC qui porte de vraies données Selene) ;
le compte de recette A ; le jeu d'essai ([donnees/jeu-essai.json](../donnees/jeu-essai.json)) importé sur le compte A
depuis la version web ; « Compter mes jours d'usage, pour la bêta » coupé sur chaque appareil. Les binaires viennent de
l'onglet *Actions* du dépôt, pour le commit en recette : **selene-android-debug** (APK de débogage), **selene-windows**
(installateur NSIS non signé) ; l'app iOS demande TestFlight ou Xcode et un iPhone (compte Apple Developer). Sans ces
moyens, les cas concernés sont **bloqués**, jamais réussis.

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [PLT-001](#plt-001) | PWA sur iPhone : installation et données séparées | P2 | Mob |
| [PLT-002](#plt-002) | PWA Android : partager un lien vers Selene | P3 | Mob |
| [PLT-003](#plt-003) | Android : lancement à froid, relance, hors ligne | P1 | AND |
| [PLT-004](#plt-004) | Android : partage, bouton retour, rotation, clavier | P2 | AND |
| [PLT-005](#plt-005) | Android et iOS : résumé du matin | P3 | AND, IOS |
| [PLT-006](#plt-006) | Android : widget d'écran d'accueil | P3 | AND |
| [PLT-007](#plt-007) | Android et iOS : langue de l'app | P3 | AND, IOS |
| [PLT-008](#plt-008) | iOS : lancement, Raccourci de partage, encoches, clavier | P2 | IOS |
| [PLT-009](#plt-009) | Windows : fenêtre unique, Ctrl+Alt+S, zone de notification | P2 | WIN |
| [PLT-010](#plt-010) | Windows : données après fermeture, déconnexion, mise à jour par-dessus | P1 | WIN |
| [PLT-011](#plt-011) | Artefact claude.ai : démarrage, données, synchronisation | P1 | ART |
| [PLT-012](#plt-012) | Mise en arrière-plan d'une app mobile : ce qui attend part | P2 | AND, IOS |
| [PLT-013](#plt-013) | Apps mobiles : sauvegarde et exports par la feuille de partage | P1 | AND, IOS |

Identifiants retirés : aucun.

---

<a id="plt-001"></a>
### PLT-001 — PWA sur iPhone : installation et données séparées

- **Fonctionnalité et règle** : depuis Safari, « Sur l'écran d'accueil » installe Selene en plein écran ; l'app installée
  fonctionne hors ligne (sauf ce qui demande le réseau : assistant, connexions) ; ses données sont séparées de celles de
  Safari.
- **Objectif, risque vérifié** : une app installée qui démarre vide sans le dire ; une PWA inutilisable hors ligne.
- **Priorité** : P2 · **Plateformes** : Mob
- **Préconditions** : iPhone de recette ; dans Safari, Selene ouverte « sans compte » avec la capture `Note Safari PLT-001`
  gardée dans la Boîte.
- **Données** : capture `Note PWA PLT-001`.
- **Automatisés associés** : `TN-hors-ligne`
- **Source** : [DOC] README, « Installer sur iPhone » ; [TEST] `tests/browser/hors-ligne.js` (service worker, Chromium).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Safari → bouton Partager → « Sur l'écran d'accueil » → « Ajouter ». | Une icône « Selene » sur l'écran d'accueil. |
| 2 | Ouvrir l'icône. | Selene s'ouvre en plein écran (pas de barre d'adresse Safari), sur l'écran d'entrée : la note `Note Safari PLT-001` n'y est pas (données séparées). |
| 3 | « Se connecter » au compte A. | Les espaces du jeu d'essai arrivent. |
| 4 | Mode Avion ; fermer l'app (balayer dans le sélecteur d'apps) ; la rouvrir. | Selene s'ouvre avec ses données ; garder la capture `Note PWA PLT-001` fonctionne. |
| 5 | Quitter le mode Avion ; ouvrir la version web du compte A sur un ordinateur, attendre 30 s ou recharger. | `Note PWA PLT-001` est dans la Boîte. |

- **État final attendu** : PWA installée et connectée ; une note de plus sur le compte A.
- **Nettoyage** : supprimer la note ; retirer l'icône si l'appareil sert à autre chose.

---

<a id="plt-002"></a>
### PLT-002 — PWA Android : partager un lien vers Selene

- **Fonctionnalité et règle** : installée depuis Chrome, la PWA s'inscrit dans le menu « Partager » d'Android (manifeste
  `share_target`) ; un lien partagé arrive dans la boîte de réception, adresse nettoyée, une seule fois.
- **Objectif, risque vérifié** : Selene absente du menu « Partager » ; lien perdu.
- **Priorité** : P3 · **Plateformes** : Mob
- **Préconditions** : téléphone Android de recette, Chrome ; la PWA non installée.
- **Données** : la page `https://fr.wikipedia.org/wiki/Lisi%C3%A8re?utm_source=recette`.
- **Automatisés associés** : `TN-sources`
- **Source** : [CODE] `manifest.webmanifest` (`share_target`) ; [TEST] `tests/browser/sources.js` (« Selene dans le menu
  « Partager » d'Android (manifeste) ») ; même parcours que [EXT-017](connexions.md#ext-017).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Chrome → l'adresse de Selene → menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »). | Une icône « Selene » ; l'app s'ouvre en plein écran. |
| 2 | Se connecter au compte A dans la PWA. | Les espaces du jeu d'essai. |
| 3 | Chrome → la page des données → Partager. | « Selene » figure dans la feuille de partage. |
| 4 | Choisir « Selene ». | La PWA s'ouvre ; « Reçu dans Boîte… » ; une note avec le titre de la page et l'adresse sans `utm_source`. |
| 5 | Fermer et rouvrir la PWA. | La note n'est pas déposée une seconde fois. |

- **État final attendu** : une note de plus.
- **Nettoyage** : la supprimer.

---

<a id="plt-003"></a>
### PLT-003 — Android : lancement à froid, relance, hors ligne

- **Fonctionnalité et règle** : l'app garde données et session dans son dossier privé et le Keystore (un fichier par clé,
  écrit par un temporaire renommé), jamais dans le stockage de la WebView ; rien ne démarre avant leur lecture ; hors
  ligne, elle s'ouvre avec ses données et synchronise au retour du réseau.
- **Objectif, risque vérifié** : une app qui démarre vide (et écrase le compte) ; une session perdue à chaque lancement ;
  une saisie hors ligne perdue.
- **Priorité** : P1 · **Plateformes** : AND
- **Préconditions** : téléphone (ou émulateur) Android de recette ; APK `selene-android-debug` du commit en recette ; pour
  l'étape 4, `adb` relié au téléphone.
- **Données** : capture `Hors ligne PLT-003`.
- **Automatisés associés** : `TN-natif`, `TU-NAT-02`, `TU-NAT-03`, `TU-PLT-07`, `TU-PLT-09`, `TS-ANDROID-FUMEE`
- **Source** : [DOC] [android.md](../../android.md#ce-que-lapp-ajoute-à-la-pwa) (« L'essai sur un vrai téléphone reste à
  faire à la main ») ; [TEST] `tests/browser/natif.js` (coffres simulés).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Installer l'APK ; lancer Selene. | L'écran d'entrée, la lune du jour. |
| 2 | « Se connecter » au compte A. | Les espaces du jeu d'essai (Chantier, Budget, Écriture…). |
| 3 | Fermer l'app depuis les apps récentes ; la relancer. | Directement l'accueil, connectée, sans écran d'entrée ni écran vide intermédiaire. |
| 4 | `adb shell run-as io.github.mariebonifacio.selene ls files/selene` | Des fichiers (un par clé) ; aucun fichier `.tmp` resté après une écriture achevée. |
| 5 | Mode Avion ; relancer ; garder la capture `Hors ligne PLT-003`. | L'app s'ouvre avec ses données ; la note est dans la Boîte. |
| 6 | Quitter le mode Avion ; attendre 30 s. Sur un ordinateur, version web du compte A : recharger. | La note `Hors ligne PLT-003` est arrivée, une seule fois. |

- **État final attendu** : app connectée ; une note de plus.
- **Nettoyage** : supprimer la note.

---

<a id="plt-004"></a>
### PLT-004 — Android : partage, bouton retour, rotation, clavier

- **Fonctionnalité et règle** : « Partager » → Selene dépose le lien ou le texte dans la boîte ; les liens `selene://share`
  et `selene://capture` ; le bouton retour remonte l'historique de Selene puis ferme l'app ; la rotation et le clavier ne
  cachent rien.
- **Objectif, risque vérifié** : un retour qui quitte au premier appui ; un champ de saisie caché par le clavier.
- **Priorité** : P2 · **Plateformes** : AND
- **Préconditions** : [PLT-003](#plt-003) mené jusqu'à l'étape 3.
- **Données** : la page `https://exemple.org/plt-004?utm_source=x` ; le texte `Phrase partagée PLT-004`.
- **Automatisés associés** : `TU-NAT-05`, `TU-NAT-07`
- **Source** : [DOC] [android.md](../../android.md#ce-que-lapp-ajoute-à-la-pwa) ; [TEST] `TU-NAT-05`, `TU-NAT-07`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Chrome → la page des données → Partager → « Selene ». | Selene s'ouvre ; une note avec l'adresse sans `utm_source` dans la Boîte. |
| 2 | Depuis une app de notes, partager le texte des données vers Selene. | Une note `Phrase partagée PLT-004` dans la Boîte. |
| 3 | Dans Selene : Accueil → Chantier → Réglages ; bouton retour trois fois. | Réglages → Chantier → Accueil, puis l'app se ferme. |
| 4 | Rouvrir ; faire pivoter le téléphone en paysage sur l'accueil, puis sur Chantier. | Rien ne déborde ni ne se superpose ; la barre basse reste utilisable. |
| 5 | Accueil → toucher le champ de capture. | Le clavier s'ouvre ; le champ et le bouton « Garder » restent visibles au-dessus. |

- **État final attendu** : deux notes de plus.
- **Nettoyage** : les supprimer.

---

<a id="plt-005"></a>
### PLT-005 — Android et iOS : résumé du matin

- **Fonctionnalité et règle** : Réglages → « Notifications » (seulement dans les apps mobiles) : une notification par
  jour, à l'heure choisie, pour les sept jours qui viennent, avec ce qui demande un geste (rappels dus, échéances) ; en
  texte brut ; jamais dans le passé ; silence les jours sans rien ; programmée par le téléphone, elle sonne app fermée.
- **Objectif, risque vérifié** : une notification qui ne sonne pas app fermée ; du HTML brut dans la notification ;
  une notification les jours sans rien.
- **Priorité** : P3 · **Plateformes** : AND, IOS
- **Préconditions** : app connectée au compte A (jeu d'essai) ; une tâche `Rendre le livre` à échéance `J+1` dans Chantier.
- **Données** : heure = maintenant + 3 minutes.
- **Automatisés associés** : `TN-natif`, `TU-NAT-08`, `TU-APP-04`, `TU-PLT-19`
- **Source** : [DOC] [android.md](../../android.md#ce-que-lapp-ajoute-à-la-pwa), [ios.md](../../ios.md#ce-que-lapp-ajoute) ;
  [CODE] `digestPlan` (`src/app/features/digest.js`) ; [TEST] `TU-APP-04`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → « Notifications ». (Vérifier aussi sur la version web : la section n'existe pas.) | « Sur cet appareil : chaque matin, ce qui t'attend (rappels, échéances), programmé par le téléphone lui-même, même app fermée. Rien ne part sur un serveur. Les jours sans rien, silence. », case « Résumé du matin », champ « Heure » (08:30 par défaut). |
| 2 | Cocher « Résumé du matin » ; accepter la demande d'autorisation du système. | Case cochée. |
| 3 | Régler l'heure sur les données ; fermer l'app ; attendre. | À l'heure dite, une notification « Selene : N choses aujourd'hui » (N ≥ 1) dont le texte cite au plus trois éléments séparés par « · », dont le rappel Plantes ; aucun chevron ni entité HTML. |
| 4 | Remettre 08:30 ; le lendemain à 08:30 (ou en avançant l'horloge du téléphone d'un jour). | Une notification « Selene : N choses ce jour » qui cite « Échéance : Rendre le livre ». |
| 5 | Décocher « Résumé du matin ». | Plus aucune notification les jours suivants. |

- **État final attendu** : résumé désactivé.
- **Nettoyage** : supprimer la tâche ; remettre l'horloge du téléphone à l'heure automatique.

---

<a id="plt-006"></a>
### PLT-006 — Android : widget d'écran d'accueil

- **Fonctionnalité et règle** : le widget montre la lune du jour et au plus trois lignes (les tâches choisies pour
  aujourd'hui d'abord, puis les rappels et échéances du jour, sans doublon), et un « + » qui ouvre la capture ; il montre
  ce que Selene lui a dit à sa dernière ouverture et ne se réveille pas seul.
- **Objectif, risque vérifié** : un widget qui affiche des données périmées sans le dire ; un détail sensible sur l'écran
  d'accueil.
- **Priorité** : P3 · **Plateformes** : AND
- **Préconditions** : app Android connectée au compte A (jeu d'essai).
- **Données** : étoile « Aujourd'hui » sur la tâche « Poser une étagère ».
- **Automatisés associés** : `TN-natif`, `TU-NAT-09`, `TU-APP-05`, `TU-PLT-20`
- **Source** : [DOC] [android.md](../../android.md#ce-que-lapp-ajoute-à-la-pwa) ; [CODE] `widgetData` ; [TEST] `TU-APP-05`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Appui long sur l'écran d'accueil → Widgets → Selene → le poser. | Le nom de la lune du jour et son pourcentage d'éclairement, comme sur l'accueil de Selene, et un « + ». |
| 2 | Ouvrir Selene, donner l'étoile « Aujourd'hui » à « Poser une étagère », revenir à l'écran d'accueil. | Le widget affiche « Poser une étagère » en première ligne, puis au plus deux rappels ou échéances du jour ; jamais plus de trois lignes. |
| 3 | Toucher « + ». | Selene s'ouvre sur la capture. |
| 4 | Ouvrir un suivi « Reprendre la main » s'il en existe un sur l'appareil (sinon : non applicable). | Le widget n'affiche aucune ligne venant du suivi. |

- **État final attendu** : widget posé ; une tâche étoilée.
- **Nettoyage** : retirer l'étoile ; retirer le widget.

---

<a id="plt-007"></a>
### PLT-007 — Android et iOS : langue de l'app

- **Fonctionnalité et règle** : les apps déclarent exactement le français et l'anglais ; Android 13+ (Paramètres →
  Applications → Selene → Langue) et iOS (Réglages → Selene → Langue) permettent une langue pour Selene seule ; le réglage
  de langue du compte, s'il est choisi, passe avant.
- **Objectif, risque vérifié** : un iPhone en français qui reçoit l'anglais ; une langue proposée mais non traduite.
- **Priorité** : P3 · **Plateformes** : AND, IOS
- **Préconditions** : app installée, connectée au compte A ; Réglages de Selene → « Langue » sur « Langue de l'appareil ».
- **Données** : aucune.
- **Automatisés associés** : `TU-I18N-14`
- **Source** : [DOC] [android.md](../../android.md#ce-que-lapp-ajoute-à-la-pwa), [ios.md](../../ios.md#ce-que-lapp-ajoute),
  [i18n.md](../../i18n.md) ; [TEST] `TU-I18N-14` (déclarations seulement).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Paramètres du système → Selene → Langue. | Deux choix proposés : français et anglais (plus « par défaut du système »). |
| 2 | Choisir l'anglais ; rouvrir Selene. | L'interface est en anglais (« Settings », « Home ») ; sous Android, le widget aussi. |
| 3 | Dans Selene : Settings → Language → Français. | L'interface repasse en français sans recharger, malgré la langue de l'app réglée sur l'anglais. |

- **État final attendu** : langue du compte : français.
- **Nettoyage** : remettre la langue de l'app sur « par défaut du système » ; Réglages de Selene → « Langue de l'appareil ».

---

<a id="plt-008"></a>
### PLT-008 — iOS : lancement, Raccourci de partage, encoches, clavier

- **Fonctionnalité et règle** : données dans le dossier privé de l'app, secrets dans le Trousseau ; `selene://share`
  dépose un lien dans la boîte, que l'app tourne ou que le lien la lance ; l'interface respecte les encoches (safe
  areas) ; le clavier ne cache pas la saisie.
- **Objectif, risque vérifié** : en-tête caché sous l'encoche ; partage perdu au lancement à froid.
- **Priorité** : P2 · **Plateformes** : IOS
- **Préconditions** : iPhone de recette avec encoche ou Dynamic Island ; app installée (TestFlight ou Xcode) et connectée
  au compte A ; le Raccourci « Selene » créé selon [ios.md](../../ios.md#-partager--selene--par-un-raccourci).
- **Données** : la page `https://exemple.org/plt-008`.
- **Automatisés associés** : `TU-NAT-07`, `TS-IOS-SIM`
- **Source** : [DOC] [ios.md](../../ios.md) (« L'essai sur un vrai iPhone reste à faire à la main ») ; [TEST] `TU-NAT-07` ;
  `TS-IOS-SIM` prouve seulement que le projet se compile.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Fermer l'app ; la relancer. | Accueil, connectée, données présentes. |
| 2 | Safari → la page des données → Partager → « Selene » (le Raccourci), app fermée. | Selene se lance ; une note avec l'adresse dans la Boîte. |
| 3 | Refaire l'étape 2 avec l'app ouverte en arrière-plan. | Même résultat ; une seule note par partage. |
| 4 | Parcourir Accueil, un espace, Réglages, en portrait puis en paysage. | Ni l'en-tête ni la barre basse ne passent sous l'encoche, la Dynamic Island ou l'indicateur d'accueil. |
| 5 | Toucher le champ de capture. | Le champ et « Garder » restent visibles au-dessus du clavier. |

- **État final attendu** : deux notes de plus.
- **Nettoyage** : les supprimer.

---

<a id="plt-009"></a>
### PLT-009 — Windows : fenêtre unique, Ctrl+Alt+S, zone de notification

- **Fonctionnalité et règle** : une seule instance (relancer ramène la fenêtre) ; `Ctrl+Alt+S` de n'importe où ramène la
  fenêtre et ouvre la capture (si une autre app tient déjà ce raccourci, Selene démarre sans lui) ; fermer la fenêtre la
  range dans la zone de notification (menu « Capturer (Ctrl+Alt+S) », « Ouvrir Selene », « Quitter ») ; le menu parle la
  langue de Windows ; `selene://share` dépose un lien dans la boîte, transmis à la page sans pouvoir s'exécuter.
- **Objectif, risque vérifié** : deux fenêtres qui s'écrasent l'une l'autre ; un raccourci mort après fermeture ; un
  partage piégé exécuté.
- **Priorité** : P2 · **Plateformes** : WIN
- **Préconditions** : PC Windows 10 ou 11 de recette ; installateur `selene-windows` du commit en recette, installé
  (SmartScreen : « Informations complémentaires » → « Exécuter quand même ») ; connectée au compte A.
- **Données** : dans la boîte de dialogue Exécuter (Win+R) : `selene://share?url=https%3A%2F%2Fexemple.org%2Fplt-009&title=%3C%2Fscript%3E%22Titre%22`.
- **Automatisés associés** : `TN-bureau`, `TU-NAT-06`, `TR-TAU-02`, `TR-TAU-03`, `TS-WIN-NSIS`, `TS-WIN-FUMEE`, `TU-BLD-11`
- **Source** : [DOC] [desktop.md](../../desktop.md#ce-que-lapp-ajoute) ; [TEST] `tests/browser/bureau.js`, `cargo test`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Selene ouverte ; relancer Selene depuis le menu Démarrer. | La fenêtre existante revient au premier plan ; aucune seconde fenêtre. |
| 2 | Donner le focus au Bloc-notes ; `Ctrl+Alt+S`. | La fenêtre de Selene revient, la capture ouverte et prête à la saisie. |
| 3 | Fermer la fenêtre (croix). | La fenêtre disparaît ; l'icône Selene reste dans la zone de notification ; `Ctrl+Alt+S` la fait revenir. |
| 4 | Clic droit sur l'icône. | Windows en français : « Capturer (Ctrl+Alt+S) », « Ouvrir Selene », « Quitter » ; en anglais : « Capture (Ctrl+Alt+S) », « Open Selene », « Quit ». |
| 5 | Win+R → les données → OK. | Selene revient ; une note dans la Boîte avec l'adresse et le titre affiché en texte (`</script>"Titre"`), sans effet. |
| 6 | Menu de l'icône → « Quitter ». | L'app se ferme ; l'icône disparaît. |

- **État final attendu** : une note de plus ; app fermée.
- **Nettoyage** : supprimer la note.

---

<a id="plt-010"></a>
### PLT-010 — Windows : données après fermeture, déconnexion, mise à jour par-dessus

- **Fonctionnalité et règle** : les données vivent dans `%APPDATA%\io.github.mariebonifacio.selene\selene` (un fichier par
  clé, nom encodé en hexadécimal, écrit par un temporaire renommé) ; les secrets dans le Gestionnaire d'identification
  de Windows ; « Quitter » pousse d'abord ce qui attend ; se déconnecter retire les secrets ; une mise à jour par-dessus
  garde les données.
- **Objectif, risque vérifié** : une saisie perdue à la fermeture ; une session restée dans le coffre après déconnexion ;
  une mise à jour qui efface tout.
- **Priorité** : P1 · **Plateformes** : WIN
- **Préconditions** : [PLT-009](#plt-009) étape 1 ; un installateur d'un commit plus récent (ou le même, réinstallé) pour
  l'étape 5.
- **Données** : capture `Avant de quitter PLT-010`.
- **Automatisés associés** : `TN-bureau`, `TR-TAU-01`, `TS-WIN-FUMEE`
- **Source** : [DOC] [desktop.md](../../desktop.md) (« L'essai de la fenêtre elle-même reste à faire à la main ») ;
  [TEST] `TR-TAU-01` (encodage des noms).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Garder la capture des données, puis aussitôt menu de l'icône → « Quitter ». Relancer Selene. | La note est là. Sur un autre appareil du compte A, elle est arrivée. |
| 2 | Explorateur : ouvrir `%APPDATA%\io.github.mariebonifacio.selene\selene`. | Des fichiers aux noms hexadécimaux ; aucun `.tmp` résiduel. |
| 3 | Panneau de configuration → Gestionnaire d'identification → Informations d'identification Windows. | Des entrées dont le nom contient `io.github.mariebonifacio.selene` (au moins la session). |
| 4 | Selene → Réglages → Compte → « Se déconnecter » ; revenir au Gestionnaire d'identification (actualiser). | Plus aucune entrée `io.github.mariebonifacio.selene` ; Selene montre l'écran d'entrée. |
| 5 | Se reconnecter ; installer par-dessus le second installateur, sans désinstaller ; relancer. | Toujours connectée ; les données sont là (dont la note). |

- **État final attendu** : app à jour, connectée ; une note de plus.
- **Nettoyage** : supprimer la note.

---

<a id="plt-011"></a>
### PLT-011 — Artefact claude.ai : démarrage, données, synchronisation

- **Fonctionnalité et règle** : `selene.html` publié comme artefact (capacités `db` et `user`) démarre sans compte
  Selene ni écran d'entrée ; ses données vivent dans le stockage de l'artefact et dans le sous-arbre privé de la
  personne qui l'ouvre (`data/users/<id>/site`, `…/board` ; ADR 33), jamais dans un document partagé : partager le
  lien partage l'outil, pas le carnet ; ce qui demande la version hébergée (compte, connexions, passeur) le dit. Un
  suivi « Reprendre la main » arrivé encore marqué synchronisé (d'avant le 3 octobre 2026, par une sauvegarde) est
  ramené dans ce navigateur : la base n'en reçoit que le talon, et l'écran dit ce que garde l'espace privé (A17).
- **Objectif, risque vérifié** : un artefact qui démarre vide à chaque ouverture ; une fonction hébergée qui échoue sans
  explication ; le carnet lu par toute personne à qui l'on donne le lien (A12) ; un suivi de santé rangé, contenu
  compris, dans la base de claude.ai sous un texte qui dit que rien n'est envoyé (A17).
- **Priorité** : P1 · **Plateformes** : ART
- **Préconditions** : deux comptes claude.ai de recette, R1 et R2 ; `selene.html` construit au commit en recette
  (`python3 build.py`), publié par R1 comme artefact avec les capacités `db` et `user` ; un second navigateur connecté
  à R1 ; un troisième, connecté à R2.
- **Données** : captures `Artefact PLT-011` (R1) et `Artefact PLT-011 R2` (R2) ; `donnees/rlm-synchronise-ancien.json`.
- **Automatisés associés** : `TU-APP-01`, `TU-PLT-05`, `TU-ART-01`, `TU-ART-02`, `TU-ART-03`, `TU-ART-04`, `TU-ART-05`, `TU-ART-06`, `TU-ART-07`
- **Source** : [CODE] `src/app/services/artifact-db.js`, `src/app/boot.js`, `src/platform.js` (runtime « artifact ») ;
  [DOC] ADR 33 de `docs/architecture.md`, contrat `db` de claude.ai (documents partagés par défaut, sous-arbre
  `data/users/<id>/` privé) ; [TEST] `tests/artifact.test.js` (faux claude.ai).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | R1 ouvre l'artefact. | Selene s'ouvre directement : pas d'écran d'entrée ; nulle part de bouton « Se connecter » ni « Créer un compte ». |
| 2 | Garder la capture `Artefact PLT-011` ; recharger l'artefact. | La note est toujours dans la Boîte. |
| 3 | Réglages → Connexions. | « Les connexions (Envoyer à Selene, Zotero, le passeur, le calendrier) vivent dans la version web ou l'app installée. L'artefact claude.ai s'en passe. » (voir [EXT-019](connexions.md#ext-019)). |
| 4 | Ouvrir le même artefact dans le second navigateur, connecté à R1. | La note `Artefact PLT-011` y est. |
| 5 | R1 partage l'artefact avec R2 (menu de partage, niveau Contributeur) ; R2 l'ouvre dans le troisième navigateur. | Un Selene vide : ni la note `Artefact PLT-011`, ni le nom ou les espaces de R1. |
| 6 | R2 garde la capture `Artefact PLT-011 R2` ; R1 recharge l'artefact. | Chez R1, la note de R2 n'apparaît pas ; chez R2, rechargé, elle est là. |
| 7 | R1, premier navigateur : Réglages → Sauvegarde → Importer `rlm-synchronise-ancien.json`, confirmer ; ouvrir « Carnet du soir », déplier « Confidentialité et données ». | « Sauvegarde importée. « Carnet du soir » est désormais gardé dans ce navigateur seulement : Selene ne synchronise plus les suivis de santé, pas même par claude.ai. » ; la saisie « Pause café » est là ; « Où vivent ces données. Dans ce navigateur seulement. L'espace privé de ton compte claude.ai n'en garde que le nom… » ; aucun bandeau « Ce suivi doit revenir sur un appareil ». |
| 8 | R1, second navigateur : recharger, ouvrir « Carnet du soir ». | « Ce suivi est gardé sur un autre de tes appareils, et seulement là… » : le nom seul, ni « Pause café » ni le sujet. |

- **État final attendu** : chez R1, l'état du jeu importé, son suivi dans le premier navigateur seulement ; une note
  dans le Selene de R2 ; aucun document partagé dans l'espace `db` de l'artefact.
- **Nettoyage** : supprimer l'artefact (cela efface son espace `db`).

---

<a id="plt-012"></a>
### PLT-012 — Mise en arrière-plan d'une app mobile : ce qui attend part

- **Fonctionnalité et règle** : passer l'app en arrière-plan déclenche la même poussée que la fermeture d'un onglet
  (`pagehide`) : ce qui attend part tout de suite.
- **Objectif, risque vérifié** : une saisie restée sur le téléphone parce que l'app a été quittée juste après.
- **Priorité** : P2 · **Plateformes** : AND, IOS
- **Préconditions** : app mobile connectée au compte A, en ligne ; la version web du compte A ouverte sur un ordinateur.
- **Données** : capture `Arrière-plan PLT-012`.
- **Automatisés associés** : `TU-NAT-05`
- **Source** : [DOC] [android.md](../../android.md#ce-que-lapp-ajoute-à-la-pwa) (« La mise en arrière-plan pousse ce qui
  attend ») ; [TEST] `TU-NAT-05`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Garder la capture des données, puis immédiatement le geste d'accueil (app en arrière-plan). Ne plus rouvrir l'app. | — |
| 2 | Sur l'ordinateur, attendre 30 s (ou recharger). | `Arrière-plan PLT-012` est dans la Boîte. |

- **État final attendu** : une note de plus.
- **Nettoyage** : la supprimer.

---

<a id="plt-013"></a>
### PLT-013 — Apps mobiles : sauvegarde et exports par la feuille de partage

- **Fonctionnalité et règle** : dans les apps Android et iOS, la WebView ne télécharge rien d'elle-même ; chaque export
  (sauvegarde, Markdown, dossier, planche, BibTeX) est écrit dans le cache de l'app puis ouvre la feuille de partage du
  système (« Enregistrer » dans Fichiers ou Drive, AirDrop, Mail) ; refermer la feuille n'est pas une erreur ; une
  écriture refusée est dite ; l'export précédent est effacé du cache.
- **Objectif, risque vérifié** : une sauvegarde qui ne sort jamais du téléphone (la seule assurance contre la perte d'un
  suivi gardé sur l'appareil) ; un export qui échoue en silence.
- **Priorité** : P1 · **Plateformes** : AND, IOS
- **Préconditions** : app installée au commit en recette, connectée au compte A (jeu d'essai) ; un ordinateur avec la version
  web en mode « sans compte » pour l'étape 5.
- **Données** : aucune.
- **Automatisés associés** : `TN-natif`, `TU-NAT-10`
- **Source** : [DOC] [android.md](../../android.md), [ios.md](../../ios.md) (« Les exports ») ; [TEST] `tests/browser/natif.js`
  (coquille simulée), `TU-NAT-10`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Compte et données → Sauvegarde → « Exporter ». | La feuille de partage du système s'ouvre avec un fichier `selene-<J>.json` ; aucun téléchargement ailleurs. |
| 2 | Android : « Enregistrer » dans Fichiers (ou Drive) ; iOS : « Enregistrer dans Fichiers ». Ouvrir le fichier enregistré. | Le fichier existe ; il contient « Chantier » et les autres espaces. |
| 3 | « Exporter » de nouveau, puis refermer la feuille sans rien choisir. | Aucun message ; l'app reste utilisable. |
| 4 | Sources → « Exporter en BibTeX » ; Bilan → planche → la télécharger. | Chaque fois la feuille de partage, avec `sources-<J>.bib`, puis le fichier de la planche. |
| 5 | Envoyer le fichier de l'étape 2 sur l'ordinateur (Drive, courriel à soi-même) et l'importer dans la version web. | « Sauvegarde importée. » ; les espaces du compte A apparaissent. |

- **État final attendu** : inchangé dans l'app ; des fichiers enregistrés sur le téléphone.
- **Nettoyage** : supprimer les fichiers enregistrés ; réimporter le jeu d'essai sur la version web si besoin.
