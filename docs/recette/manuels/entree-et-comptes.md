# Entrée, comptes et session

Le premier lancement, Selene sans compte, la connexion, les mots de passe, la session, la déconnexion et la suppression
du compte. Concerne les cibles hébergées : l'artefact claude.ai n'a ni écran d'entrée ni compte.

**Préconditions communes** : site hébergé (`https://mariebonifacio.github.io/selene/`) ou build local `npm run build:dist`
servi depuis `dist/web` (il parle au même projet Supabase) ; profil de navigateur dédié ; comptes de recette A et B
([README](../README.md#environnement-et-données-de-recette)) ; sur un appareil connecté, la mesure d'usage coupée.
« Effacer les données du site » : outils de développement → Application → Stockage → *Clear site data* (Chromium), ou
Réglages → Safari → Avancé → Données des sites web (iOS).

| Identifiant | Titre | Priorité | Plateformes |
|---|---|---|---|
| [CPT-001](#cpt-001) | L'écran d'entrée dit ce que fait Selene et propose ses trois chemins | P2 | Web, Mob, AND, IOS, WIN |
| [CPT-002](#cpt-002) | « Commencer sans compte » ouvre l'app entière ; rien ne part au serveur ; le choix survit au rechargement | P1 | Web, Mob, AND, IOS, WIN |
| [CPT-003](#cpt-003) | Sans compte : Réglages explique ce que cela implique ; l'assistant demande un compte | P2 | Web, Mob |
| [CPT-004](#cpt-004) | Créer un compte après un usage sans compte verse ce qui a été noté dans le compte neuf | P1 | Web, Mob, AND, IOS, WIN |
| [CPT-005](#cpt-005) | Se connecter à un compte existant après un usage sans compte : tout est gardé, les réglages du compte l'emportent | P1 | Web, Mob |
| [CPT-006](#cpt-006) | Connexion refusée : message durable, adresse conservée | P2 | Web, Mob |
| [CPT-007](#cpt-007) | Inscription : dix caractères au moins ; inscriptions fermées, sur invitation | P2 | Web |
| [CPT-008](#cpt-008) | Mot de passe oublié : réponse neutre, lien, nouveau mot de passe, jeton retiré de l'adresse | P1 | Web, Mob |
| [CPT-009](#cpt-009) | Lien de récupération expiré ou déjà utilisé | P2 | Web |
| [CPT-010](#cpt-010) | Invitation : choisir son mot de passe et entrer | P1 | Web, Mob |
| [CPT-011](#cpt-011) | Changer de mot de passe demande l'actuel | P2 | Web, Mob |
| [CPT-012](#cpt-012) | Réseau coupé au démarrage, session expirée : l'app s'ouvre sans déconnecter et reprend au retour du réseau | P1 | Web, Mob, AND, IOS |
| [CPT-013](#cpt-013) | Se déconnecter : ce qui attend part d'abord, l'appareil est vidé | P1 | Web, Mob, AND, IOS, WIN |
| [CPT-014](#cpt-014) | Deux comptes sur le même appareil, l'un après l'autre : rien de A n'apparaît pour B | P1 | Web, AND, WIN |
| [CPT-015](#cpt-015) | Supprimer son compte depuis l'app | P1 | Web, AND, IOS |
| [CPT-016](#cpt-016) | Ancien mot de passe trop court : on entre, et Selene propose de le changer | P3 | Web |
| [CPT-017](#cpt-017) | Lien de récupération ouvert alors qu'une autre session est active | P3 | Web |

Identifiants retirés : aucun.

---

<a id="cpt-001"></a>
### CPT-001 — L'écran d'entrée dit ce que fait Selene et propose ses trois chemins

- **Fonctionnalité et règle** : écran d'entrée de la version hébergée : la promesse d'abord, puis « Commencer sans compte »,
  puis le compte (U1 de l'audit, ADR 28).
- **Objectif, risque vérifié** : une personne nouvelle ne comprend pas ce qu'est Selene ou croit qu'un compte est obligatoire.
- **Priorité** : P2 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : données du site effacées ; aucune session.
- **Données** : aucune.
- **Automatisés associés** : `TN-sans-compte`, `TN-csp`
- **Source** : [DOC] [compte.md](../../compte.md#sans-compte) ; [TEST] `tests/browser/sans-compte.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir l'adresse du site. | L'écran d'entrée s'affiche, pas l'accueil. À gauche (en haut sur téléphone), le titre « Garde tes fragments, tes sources et tes hypothèses reliés. », la phrase « Et retrouve ce que tu avais oublié, jusqu'au dernier chapitre. » et trois puces (compteur de mots ; sources complétées depuis un lien ou un DOI ; « Ni publicité ni traceur »). La lune du jour est visible ; aucun minuteur. |
| 2 | Lire le bouton principal et la phrase sous lui. | Bouton « Commencer sans compte » ; dessous : « Rien à créer : tout reste sur cet appareil. Un compte, plus tard, le retrouve sur tes autres appareils, avec ce que tu auras noté. » |
| 3 | Lire le panneau de droite (en dessous sur téléphone). | Titre « J'ai déjà un compte », champs « E-mail » et « Mot de passe », boutons « Se connecter », « Mot de passe oublié ? », et « Créer un compte » si les inscriptions sont ouvertes. |
| 4 | Sur téléphone (390 px de large), faire défiler la page. | Aucun défilement horizontal ; tous les boutons sont visibles et utilisables. |

- **État final attendu** : rien n'a été créé ni envoyé ; aucune donnée dans le stockage du site hormis l'identifiant d'appareil.
- **Nettoyage** : aucun.

---

<a id="cpt-002"></a>
### CPT-002 — « Commencer sans compte » ouvre l'app entière ; rien ne part au serveur ; le choix survit au rechargement

- **Fonctionnalité et règle** : Selene sans compte : l'app entière sur l'appareil, rien de ce qui est écrit ne part au
  serveur ; le choix est gardé sur l'appareil.
- **Objectif, risque vérifié** : fuite d'un texte saisi sans compte vers le serveur ; perte des données au rechargement.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : données du site effacées ; outils de développement ouverts sur l'onglet Réseau, enregistrement actif,
  « Preserve log » coché.
- **Données** : capture `Recette CPT-002 sans compte`.
- **Automatisés associés** : `TN-sans-compte`, `TU-ACT-03`, `TU-APP-01`
- **Source** : [DOC] [compte.md](../../compte.md#sans-compte) ; [TEST] `tests/browser/sans-compte.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Cliquer « Commencer sans compte ». | L'accueil s'affiche avec le bloc « Composer ton espace » (« Sur quoi travailles-tu ? »), la navigation et le minuteur. |
| 2 | Dans « Capturer » (ou ⊕ sur téléphone), saisir les données puis « Garder ». | Message « Gardé. Tu peux oublier, c'est écrit. » ; « 1 élément à trier » sous le champ. |
| 3 | Dans l'onglet Réseau, filtrer sur `supabase.co`. | Aucune requête vers `/rest/v1/app_state` ni `/rest/v1/activite` ; au plus une requête `/auth/v1/settings` (lecture de l'ouverture des inscriptions), qui ne porte aucun texte saisi. |
| 4 | Recharger la page. | L'app s'ouvre directement (pas l'écran d'entrée) ; la capture est toujours dans la boîte de réception. |
| 5 | Fermer l'onglet, rouvrir le site. | Même résultat qu'à l'étape 4. |

- **État final attendu** : la capture est dans la boîte, sur cet appareil seulement ; le serveur n'a aucune ligne pour cet appareil.
- **Nettoyage** : effacer les données du site.

---

<a id="cpt-003"></a>
### CPT-003 — Sans compte : Réglages explique ce que cela implique ; l'assistant demande un compte

- **Fonctionnalité et règle** : Réglages → Compte et données, sans compte ; l'assistant hébergé garde la clé sur le serveur,
  donc exige un compte.
- **Objectif, risque vérifié** : une personne croit ses données sauvegardées ailleurs ; un champ de clé qui échouerait.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : mode sans compte actif (CPT-002, étape 1).
- **Données** : aucune.
- **Automatisés associés** : `TN-sans-compte`
- **Source** : [CODE] `localAccountHTML` (`services/auth.js`) ; [TEST] `tests/browser/sans-compte.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Ouvrir Réglages, chapitre « Compte et données ». | Le texte dit que tout reste sur cet appareil, qu'effacer les données du navigateur ou désinstaller efface tout, et conseille d'exporter ; bouton « Créer un compte ou me connecter ». La case « Envoyer les erreurs de l'app, anonymes » est présente. |
| 2 | Chapitre « Espaces » : cocher « Assistant ». | L'assistant s'active ; dans le chapitre « Assistant », le texte « Sans compte, pas d'assistant : ta clé serait gardée sur le serveur, attachée à un compte. » et le bouton « Créer un compte ou me connecter » ; aucun champ de clé. |
| 3 | Cliquer « Créer un compte ou me connecter ». | L'écran d'entrée s'affiche ; le bouton principal dit « Revenir à Selene sans compte ». |
| 4 | Cliquer « Revenir à Selene sans compte ». | L'app revient, intacte. |

- **État final attendu** : inchangé, assistant activé.
- **Nettoyage** : décocher « Assistant ».

---

<a id="cpt-004"></a>
### CPT-004 — Créer un compte après un usage sans compte verse ce qui a été noté dans le compte neuf

- **Fonctionnalité et règle** : se connecter ensuite verse l'appareil dans le compte ; un compte neuf reçoit l'appareil tel quel.
- **Objectif, risque vérifié** : perte des notes prises sans compte au moment de créer le compte.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : inscriptions ouvertes dans le projet (sinon, faire créer le compte par invitation et suivre CPT-005) ;
  SMTP configuré si la confirmation par e-mail est exigée ; adresse jetable dédiée.
- **Données** : chemin « Un long texte » ; capture `Recette CPT-004 à verser` ; adresse `recette-c+cpt004@…`, mot de passe
  `lisiere-recette-2026`.
- **Automatisés associés** : `TN-sans-compte`
- **Source** : [DOC] [compte.md](../../compte.md#sans-compte), ADR 28 ; [TEST] `tests/browser/sans-compte.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Données effacées, « Commencer sans compte », choisir « Un long texte ». | Message « Pour commencer : Écriture, Sources, Tâches… » ; trois espaces dans la navigation. |
| 2 | Capturer le texte des données. | La boîte compte 1 élément. |
| 3 | Réglages → Compte et données → « Créer un compte ou me connecter » ; « Créer un compte » ; saisir l'adresse et le mot de passe ; « Créer le compte ». | Si une confirmation est exigée : « Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi. » ; sinon, l'app s'ouvre connectée. |
| 4 | (Si besoin) confirmer par le lien reçu, puis se connecter. | L'app s'ouvre connectée ; l'indicateur d'enregistrement ne dit pas « Non synchronisé ». |
| 5 | Vérifier la navigation et la boîte. | Écriture, Sources, Tâches et la capture `Recette CPT-004 à verser` sont présents. |
| 6 | Sur un second navigateur, se connecter au même compte. | Les mêmes espaces et la même capture apparaissent. |

- **État final attendu** : le compte neuf contient exactement ce qui avait été noté sans compte ; le choix « sans compte » n'est plus actif.
- **Nettoyage** : supprimer le compte de recette (CPT-015) ou le garder pour d'autres cas.

---

<a id="cpt-005"></a>
### CPT-005 — Se connecter à un compte existant après un usage sans compte : tout est gardé, les réglages du compte l'emportent

- **Fonctionnalité et règle** : un compte qui a déjà ses données garde ses réglages ; ce qui a été noté sans compte le rejoint.
- **Objectif, risque vérifié** : écrasement des données du compte par celles de l'appareil, ou l'inverse.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : compte A existant avec un espace « Carnet A » et la palette « Rubedo » (Réglages → Apparence et rythme).
- **Données** : sur l'appareil sans compte : capture `Recette CPT-005 appareil`, palette par défaut.
- **Automatisés associés** : `TN-sans-compte`, `TU-SYN-14`
- **Source** : [DOC] [compte.md](../../compte.md#sans-compte) ; [TEST] `tests/browser/sans-compte.js`, `TU-SYN-14`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Sur un navigateur aux données effacées : « Commencer sans compte », capturer le texte des données. | La boîte compte 1 élément. |
| 2 | Réglages → Compte et données → « Créer un compte ou me connecter », se connecter avec le compte A. | L'app s'ouvre connectée. |
| 3 | Vérifier la navigation et la boîte. | « Carnet A » est présent ; la capture `Recette CPT-005 appareil` est dans la boîte. |
| 4 | Vérifier l'apparence. | La palette « Rubedo » du compte est appliquée. |

- **État final attendu** : l'union des deux contenus, réglages du compte.
- **Nettoyage** : supprimer la capture ; remettre la palette du compte A si besoin.

---

<a id="cpt-006"></a>
### CPT-006 — Connexion refusée : message durable, adresse conservée

- **Fonctionnalité et règle** : messages de l'écran de connexion.
- **Objectif, risque vérifié** : un message d'erreur qui disparaît avant d'être lu ; une adresse à retaper.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : écran d'entrée, panneau « J'ai déjà un compte ».
- **Données** : adresse du compte A, mot de passe `mauvais-mot-de-passe`.
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [TEST] `tests/browser/mot-de-passe.js` (« une connexion refusée : le message reste affiché »).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Saisir les données, « Se connecter ». | Un message d'erreur s'affiche sous le formulaire, en couleur d'alerte. |
| 2 | Attendre dix secondes sans rien toucher. | Le message est toujours là. |
| 3 | Regarder le champ « E-mail ». | L'adresse tapée y est encore. |
| 4 | Couper le réseau (outils de développement → Network → Offline), recommencer. | « Impossible de joindre le serveur. Vérifie ta connexion. » |

- **État final attendu** : non connecté, rien de changé.
- **Nettoyage** : rétablir le réseau.

---

<a id="cpt-007"></a>
### CPT-007 — Inscription : dix caractères au moins ; inscriptions fermées, sur invitation

- **Fonctionnalité et règle** : un nouveau mot de passe compte dix caractères au moins (`PW_MIN`) ; inscriptions fermées
  (`disable_signup`), l'écran ne propose plus de créer un compte.
- **Objectif, risque vérifié** : mot de passe faible accepté ; bouton d'inscription qui échoue alors que le serveur la refuse.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : connaître l'état du réglage *Allow new users to sign up* du projet.
- **Données** : mot de passe `court1234` (9 caractères).
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [DOC] [compte.md](../../compte.md#mots-de-passe) ; [TEST] `tests/browser/mot-de-passe.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Inscriptions ouvertes : « Créer un compte », lire l'aide sous le mot de passe. | « 10 caractères au moins. Une courte phrase fait un bon mot de passe, facile à retenir. » |
| 2 | Saisir une adresse et `court1234`, « Créer le compte ». | Le navigateur refuse l'envoi (champ en erreur, longueur minimale) ; aucune requête `/auth/v1/signup`. |
| 3 | Inscriptions fermées : recharger l'écran d'entrée. | Plus de bouton « Créer un compte » ; le texte dit « Connecte-toi pour retrouver tes données. Selene n'ouvre de compte que sur invitation. » ; « Mot de passe oublié ? » reste. |

- **État final attendu** : aucun compte créé.
- **Nettoyage** : aucun.

---

<a id="cpt-008"></a>
### CPT-008 — Mot de passe oublié : réponse neutre, lien, nouveau mot de passe, jeton retiré de l'adresse

- **Fonctionnalité et règle** : `POST /auth/v1/recover` ; même réponse que l'adresse ait un compte ou non ; le jeton du lien
  quitte aussitôt l'adresse ; nouveau mot de passe saisi deux fois.
- **Objectif, risque vérifié** : énumération des comptes ; jeton gardé dans l'historique ; perte d'accès au compte.
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : SMTP configuré, ou compte de recette membre de l'équipe du projet ([compte.md](../../compte.md#mot-de-passe-oublié-invitation)) ; accès à la boîte de réception du compte B.
- **Données** : adresse du compte B ; adresse inexistante `personne-cpt008@exemple.invalid` ; nouveau mot de passe `brume-sur-la-lisiere`.
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [DOC] [compte.md](../../compte.md#mot-de-passe-oublié-invitation) ; [TEST] `tests/browser/mot-de-passe.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Écran d'entrée → « Mot de passe oublié ? ». | Titre « Mot de passe oublié » ; un seul champ, l'adresse déjà saisie s'il y en avait une ; « Envoyer le lien », « Revenir à la connexion ». |
| 2 | Saisir l'adresse inexistante, « Envoyer le lien ». | « Si un compte existe à cette adresse, un e-mail vient de partir : son lien te ramène ici… Regarde aussi dans les indésirables. » |
| 3 | Recommencer avec l'adresse du compte B. | Exactement le même message qu'à l'étape 2. |
| 4 | Ouvrir l'e-mail reçu par B, suivre le lien. | Selene s'ouvre sur « Nouveau mot de passe » ; la barre d'adresse ne contient plus de `#access_token` ni de `type=recovery`. |
| 5 | Saisir deux mots de passe différents. | Refus avant tout envoi : « Les deux mots de passe ne sont pas identiques. » |
| 6 | Saisir deux fois le nouveau mot de passe, « Enregistrer et me connecter ». | « Mot de passe enregistré. » ; l'app s'ouvre connectée au compte B. |
| 7 | Se déconnecter, se reconnecter avec le nouveau mot de passe. | Connexion réussie. L'ancien mot de passe est refusé. |

- **État final attendu** : compte B avec le nouveau mot de passe ; aucun jeton dans l'historique du navigateur.
- **Nettoyage** : noter le nouveau mot de passe de B dans le coffre de recette.

---

<a id="cpt-009"></a>
### CPT-009 — Lien de récupération expiré ou déjà utilisé

- **Fonctionnalité et règle** : un lien expiré ou déjà servi le dit, sans jamais afficher le texte porté par le lien.
- **Objectif, risque vérifié** : un message fabriqué dans un lien affiché tel quel (hameçonnage) ; impasse sans nouveau lien.
- **Priorité** : P2 · **Plateformes** : Web
- **Préconditions** : un lien de récupération déjà utilisé (fin de CPT-008).
- **Données** : le même lien ; puis l'adresse du site suivie de `#error=access_denied&error_code=otp_expired&error_description=Votre+compte+est+bloque+appelez+le+0800`.
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [DOC] [compte.md](../../compte.md#mot-de-passe-oublié-invitation) ; [TEST] `tests/browser/mot-de-passe.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Rouvrir le lien déjà utilisé. | « Ce lien ne fonctionne plus : il a expiré, ou il a déjà servi. Demande-en un autre. » ; l'écran propose d'en demander un autre. |
| 2 | Ouvrir l'adresse fabriquée des données. | Le même message ; la phrase « Votre compte est bloqué… » n'apparaît nulle part ; l'erreur quitte la barre d'adresse. |

- **État final attendu** : non connecté.
- **Nettoyage** : aucun.

---

<a id="cpt-010"></a>
### CPT-010 — Invitation : choisir son mot de passe et entrer

- **Fonctionnalité et règle** : une invitation (*Add user → Send invitation*) suit le chemin du lien de récupération et
  demande de choisir le mot de passe du compte.
- **Objectif, risque vérifié** : une personne invitée ne peut pas entrer (bêta fermée bloquée).
- **Priorité** : P1 · **Plateformes** : Web, Mob
- **Préconditions** : accès au tableau de bord Supabase (responsable) ; SMTP configuré ; adresse jetable.
- **Données** : adresse `recette-invite+cpt010@…` ; mot de passe `invitation-recette-2026`.
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [DOC] [compte.md](../../compte.md#mot-de-passe-oublié-invitation) ; [TEST] `tests/browser/mot-de-passe.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dans Supabase : Authentication → Users → *Invite user* avec l'adresse. | Un e-mail d'invitation part. |
| 2 | Suivre le lien de l'e-mail. | Selene s'ouvre sur « Bienvenue » : « Bienvenue. Choisis le mot de passe de ton compte. » ; le jeton n'est plus dans l'adresse. |
| 3 | Saisir deux fois le mot de passe, « Enregistrer et me connecter ». | L'app s'ouvre connectée, compte neuf (bloc « Composer ton espace »). |
| 4 | Rouvrir le même lien. | « Cette invitation a expiré, ou elle a déjà servi : demande qu'on te la renvoie. » |

- **État final attendu** : un compte neuf, connecté.
- **Nettoyage** : supprimer ce compte (CPT-015).

---

<a id="cpt-011"></a>
### CPT-011 — Changer de mot de passe demande l'actuel

- **Fonctionnalité et règle** : changer de mot de passe demande toujours l'actuel, vérifié par une connexion fraîche ;
  chaque refus du serveur est traduit.
- **Objectif, risque vérifié** : un appareil laissé ouvert suffit à changer le mot de passe.
- **Priorité** : P2 · **Plateformes** : Web, Mob
- **Préconditions** : connecté avec le compte B.
- **Données** : actuel faux `pas-le-bon-mot`, nouveau `nouvelle-lisiere-2026`.
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [DOC] [compte.md](../../compte.md#mots-de-passe) ; [TEST] `tests/browser/mot-de-passe.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Compte et données → « Changer mon mot de passe ». | Trois champs : « Mot de passe actuel », « Nouveau mot de passe », « Le même, une seconde fois ». |
| 2 | Actuel faux, nouveau saisi deux fois, « Changer le mot de passe ». | « Le mot de passe actuel n'est pas le bon. » ; rien ne change. |
| 3 | Actuel juste, nouveau identique à l'actuel. | « C'est déjà ton mot de passe : choisis-en un autre. » (ou « Mot de passe inchangé. »). |
| 4 | Actuel juste, nouveau différent saisi deux fois. | « Mot de passe changé. » ; toujours connecté. |
| 5 | Se reconnecter sur un autre navigateur avec le nouveau. | Connexion réussie. |

- **État final attendu** : compte B avec le nouveau mot de passe.
- **Nettoyage** : noter le mot de passe dans le coffre de recette.

---

<a id="cpt-012"></a>
### CPT-012 — Réseau coupé au démarrage, session expirée : l'app s'ouvre sans déconnecter et reprend au retour du réseau

- **Fonctionnalité et règle** : seul un refus explicite du serveur (400 ou 401 au rafraîchissement) ferme la session ;
  réseau coupé ou 5xx laissent travailler en local, avec « Non synchronisé ». Un appareil connecté s'ouvre sur l'app et
  ce qu'il garde, avant toute réponse du serveur, jamais sur l'écran d'entrée (A18).
- **Objectif, risque vérifié** : une coupure réseau déconnecte, donc vide l'appareil et perd ce qui n'était pas envoyé.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS
- **Préconditions** : connecté au compte A ; la session doit être expirée au moment du test : laisser l'app fermée plus d'une
  heure (durée des jetons du projet), sans se déconnecter.
- **Données** : capture `Recette CPT-012 hors ligne`.
- **Automatisés associés** : `TU-AUTH-01`, `TU-AUTH-02`, `TU-AUTH-03`, `TU-AUTH-06`, `TU-AUTH-07`, `TU-AUTH-08`
- **Source** : [DOC] [architecture.md](../../architecture.md#session) ; [TEST] `TU-AUTH-01` à `TU-AUTH-08` ; anomalie A18 : avant le
  6 octobre 2026, l'écran d'entrée restait affiché jusqu'aux premières réponses du serveur.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Couper le réseau (mode avion, ou outils → Offline), puis ouvrir Selene. | L'app s'ouvre, pas l'écran d'entrée ; l'indicateur dit « Non synchronisé — enregistré sur cet appareil seulement ». |
| 2 | Capturer le texte des données. | La capture apparaît dans la boîte. |
| 3 | Rétablir le réseau ; attendre jusqu'à cinq minutes (ou revenir sur l'onglet). | L'indicateur s'efface ; aucune demande de connexion. |
| 4 | Sur un second appareil connecté au compte A, ouvrir la boîte. | La capture y est. |
| 5 | Premier appareil, réseau rétabli mais ralenti (outils de développement → Network → « Slow 3G », ou un téléphone en 3G) : recharger Selene. | L'app s'affiche d'emblée, avec la capture : à aucun moment l'écran d'entrée (« Commencer sans compte », « J'ai déjà un compte ») ; l'indicateur d'enregistrement s'efface une fois le serveur joint. |

- **État final attendu** : session renouvelée, capture synchronisée.
- **Nettoyage** : supprimer la capture.

---

<a id="cpt-013"></a>
### CPT-013 — Se déconnecter : ce qui attend part d'abord, l'appareil est vidé

- **Fonctionnalité et règle** : la déconnexion pousse d'abord ce qui attend (et demande confirmation si c'est impossible),
  puis efface de l'appareil les données, la base, les brouillons, la conversation avec l'assistant et les secrets de
  l'appareil (clés OpenAlex et Zotero, adresse d'agenda) ; la clé Anthropic reste au compte.
- **Objectif, risque vérifié** : perte silencieuse de saisies ; données d'une personne laissées sur un appareil partagé.
- **Priorité** : P1 · **Plateformes** : Web, Mob, AND, IOS, WIN
- **Préconditions** : connecté au compte A, sans suivi « Reprendre la main » gardé sur l'appareil (sinon voir RLM-023).
- **Données** : capture `Recette CPT-013 avant départ` ; un brouillon `brouillon CPT-013` laissé dans la capture.
- **Automatisés associés** : `TU-SYN-13`, `TU-SYN-17`, `TU-PLT-18`, `TN-veille`, `TN-agenda`
- **Source** : [DOC] README, « Comptes et synchronisation » ; [TEST] `TU-SYN-13`, `TU-SYN-17`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Couper le réseau ; capturer `Recette CPT-013 avant départ`. | « Non synchronisé » s'affiche. |
| 2 | Réglages → Compte et données → « Se déconnecter ». | Confirmation : « Des modifications n'ont pas pu être envoyées (hors ligne ?). Elles seront perdues si tu te déconnectes maintenant. Te déconnecter quand même ? ». |
| 3 | Répondre « Annuler ». | Toujours connecté ; la capture est là. |
| 4 | Rétablir le réseau, attendre que l'indicateur s'efface ; taper le brouillon dans la capture sans le garder ; « Se déconnecter ». | Pas de confirmation ; l'écran d'entrée s'affiche. |
| 5 | Outils de développement → Application : IndexedDB `selene`, Local Storage. | Plus de `selene-site-v1`, ni de brouillon (`selene-draft:…`), ni de conversation (`selene-chat`), ni de session ; seul l'identifiant d'appareil (`selene-device-id`) peut rester. |
| 6 | Se reconnecter au compte A. | La capture `Recette CPT-013 avant départ` est là (elle était partie avant la déconnexion) ; le brouillon n'est pas revenu. |

- **État final attendu** : appareil vide après déconnexion ; le compte a tout ce qui avait été envoyé.
- **Nettoyage** : supprimer la capture.

---

<a id="cpt-014"></a>
### CPT-014 — Deux comptes sur le même appareil, l'un après l'autre : rien de A n'apparaît pour B

- **Fonctionnalité et règle** : la déconnexion vide l'appareil ; un suivi gardé sur l'appareil par A est mis de côté, jamais
  montré à B (ADR 27).
- **Objectif, risque vérifié** : fuite de données entre deux personnes qui partagent un appareil.
- **Priorité** : P1 · **Plateformes** : Web, AND, WIN
- **Préconditions** : comptes A et B ; A a une capture `Secret de A CPT-014`.
- **Données** : aucune de plus.
- **Automatisés associés** : `TU-SYN-13`, `TU-REG-33`, `TU-AUTH-08`
- **Source** : [DOC] [regulation.md](../../regulation.md#confidentialité) (changement de compte) ; [TEST] `TU-REG-33`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Connecté avec A, vérifier la capture ; se déconnecter. | Écran d'entrée. |
| 2 | Se connecter avec B. | L'accueil de B s'affiche. |
| 3 | Chercher `Secret` (touche « / »). | « Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire. » |
| 4 | Parcourir la navigation et la boîte de B. | Aucun espace ni aucune note de A. |
| 5 | Se déconnecter, se reconnecter avec A. | La capture de A est là. |

- **État final attendu** : chaque compte ne voit que ses données.
- **Nettoyage** : supprimer la capture de A.

---

<a id="cpt-015"></a>
### CPT-015 — Supprimer son compte depuis l'app

- **Fonctionnalité et règle** : Réglages → Compte et données → « Supprimer mon compte » : taper « supprimer », confirmer ; la
  fonction `compte` efface `app_state`, la clé d'assistant, puis le compte ; l'appareil est vidé ; un échec n'efface rien.
- **Objectif, risque vérifié** : suppression impossible (exigence des stores, RGPD) ; suppression partielle ; suppression par
  erreur.
- **Priorité** : P1 · **Plateformes** : Web, AND, IOS
- **Préconditions** : fonction `compte` déployée ; compte jetable créé pour l'occasion (jamais A ni B) ; accès au tableau de
  bord Supabase pour vérifier.
- **Données** : compte `recette-jetable+cpt015@…` avec une capture `à effacer CPT-015`.
- **Automatisés associés** : `TN-compte`, `TD-CPT-01`, `TD-CPT-02`, `TD-CPT-03`
- **Source** : [DOC] [compte.md](../../compte.md#supprimer-son-compte), ADR 20 ; [TEST] `tests/browser/compte.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Connecté au compte jetable : Réglages → Compte et données. | Bouton « Supprimer mon compte » et lien « ce que Selene garde, et où » vers la politique de confidentialité. |
| 2 | Cliquer « Supprimer mon compte » sans rien taper. | Rien ne part ; l'invite « Tape « supprimer » pour confirmer. » s'affiche. |
| 3 | Taper `supprimer`, valider, puis répondre « Annuler » à « Supprimer ton compte et toutes ses données… C'est définitif. ». | Rien ne part ; toujours connecté. |
| 4 | Couper le réseau, recommencer jusqu'à confirmer. | « Compte non supprimé : … » ; la capture est toujours là, toujours connecté. |
| 5 | Rétablir le réseau, recommencer jusqu'à confirmer. | « Compte supprimé. Il ne reste rien de toi ici… » ; écran d'entrée. |
| 6 | Supabase → Authentication → Users ; Table Editor → `app_state`. | Le compte et sa ligne ont disparu. |
| 7 | Essayer de se connecter avec le compte supprimé. | Connexion refusée. |

- **État final attendu** : compte, données et clé d'assistant effacés ; appareil vide.
- **Nettoyage** : aucun.

---

<a id="cpt-016"></a>
### CPT-016 — Ancien mot de passe trop court : on entre, et Selene propose de le changer

- **Fonctionnalité et règle** : la connexion n'impose aucune longueur ; si le serveur signale `weak_password`, Selene le dit
  et ouvre « Changer mon mot de passe ».
- **Objectif, risque vérifié** : un compte ancien bloqué par la nouvelle règle.
- **Priorité** : P3 · **Plateformes** : Web
- **Préconditions** : un compte de recette dont le mot de passe compte moins de 10 caractères (créé avant le réglage, ou
  réglé par la responsable dans Supabase).
- **Données** : ce compte.
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [DOC] [compte.md](../../compte.md#mots-de-passe) ; [TEST] `tests/browser/mot-de-passe.js`.

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Se connecter avec ce compte. | La connexion réussit ; message « Ton mot de passe est plus court que ce que le serveur demande désormais : change-le dans Réglages, Compte. » |
| 2 | Ouvrir Réglages → Compte et données. | Le bloc « Changer mon mot de passe » est déjà ouvert, avec l'avertissement. |
| 3 | Changer le mot de passe (CPT-011, étape 4). | L'avertissement disparaît. |

- **État final attendu** : mot de passe conforme.
- **Nettoyage** : aucun.

---

<a id="cpt-017"></a>
### CPT-017 — Lien de récupération ouvert alors qu'une autre session est active

- **Fonctionnalité et règle** : déjà connectée à un autre compte, le lien passe d'abord ; annuler reprend la session gardée.
- **Objectif, risque vérifié** : le lien d'un compte change le mot de passe d'un autre, ou ferme la session en cours.
- **Priorité** : P3 · **Plateformes** : Web
- **Préconditions** : connecté au compte A ; un lien de récupération valide pour le compte B (CPT-008, étapes 1 à 3).
- **Données** : aucune.
- **Automatisés associés** : `TN-mot-de-passe`
- **Source** : [TEST] `tests/browser/mot-de-passe.js` (« déjà connectée à un autre compte : le lien passe d'abord »).

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Dans le navigateur où A est connecté, ouvrir le lien de B. | L'écran « Nouveau mot de passe » s'affiche. |
| 2 | Cliquer « Annuler ». | L'app revient connectée au compte A, avec ses données. |

- **État final attendu** : A connecté, mot de passe de B inchangé.
- **Nettoyage** : aucun.
