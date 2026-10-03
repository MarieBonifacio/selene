# Ce qui reste à faire à la main

Ce que ni le code ni la CI ne peuvent faire : essayer Selene sur de vrais appareils, remplir les formulaires des
stores, tenir les obligations de la responsable du traitement. Une case par démarche, avec un lien vers le détail.
Une démarche faite : cocher la case, ou retirer la ligne, de préférence dans la PR qui la rend inutile.

Tenue à jour le 3 octobre 2026. Les étapes marquées *(si ce n'est pas déjà fait)* sont des réglages de mise en place
dont le dépôt ne peut pas savoir s'ils ont eu lieu.

## Tout de suite (une minute)

- [ ] **Le lien ameli** cité par [regulation.md](regulation.md#alcool) (« repères de consommation »,
  `https://www.assurance-maladie.ameli.fr/index.php/assure/sante/themes/alcool-sante/definition-reperes-consommation`).
  Le workflow *Liens* du 3 octobre 2026 a reçu un refus (403) : le site bloque le robot de GitHub, ce qui ne dit rien
  de la page. L'ouvrir dans un navigateur : si elle s'affiche, rien à faire ; sinon, remplacer l'adresse dans
  `docs/regulation.md`. Ce lien n'apparaît pas dans l'interface.

## Essayer sur de vrais appareils

La CI compile les trois apps et joue tous les parcours dans Chromium et WebKit, mais aucun vrai appareil n'a encore
lancé Selene. Avant chaque essai, recharger l'app une fois sur les appareils déjà connectés : une ancienne version ne
connaît pas le format 8 et refuse d'écrire.

- [ ] **« Reprendre la main » sur deux appareils du même compte** : le
  [parcours manuel](regulation.md#parcours-manuel-cinq-minutes), étapes 1 à 9. À voir en particulier : l'espace
  proposé au seul compte marqué personnel, aucun choix de stockage, l'autre appareil qui n'affiche que le nom, aucun
  bouton vers le compte, la garde à la déconnexion.
- [ ] **Android**, avec l'APK de la course *Android* : lancement à froid, hors ligne puis en ligne, partage depuis
  Chrome, bouton retour, rotation, clavier, synchronisation avec la PWA ([android.md](android.md#tester)).
- [ ] **iPhone**, par TestFlight une fois le compte Apple ouvert : lancement à froid, hors ligne puis en ligne,
  Raccourci de partage, rotation, clavier, encoches, synchronisation ([ios.md](ios.md#tester)).
- [ ] **Windows**, avec l'installateur de la course *Desktop* : premier lancement, données relues après fermeture,
  déconnexion, mise à jour par-dessus ([desktop.md](desktop.md#tester)).
- [ ] **La PWA installée sur iPhone** et **l'artefact claude.ai** ([architecture.md](architecture.md), « Hors CI »).

## Régler le projet Supabase *(si ce n'est pas déjà fait)*

- [ ] **SMTP d'abord**, puis les adresses de retour (*URL Configuration*), puis la traduction des modèles d'e-mail :
  sans SMTP, les liens « mot de passe oublié » et les invitations n'atteignent que l'équipe du projet
  ([compte.md](compte.md#mot-de-passe-oublié-invitation)).
- [ ] **La fonction `compte`** déployée (workflow *Compte*), puis un essai : créer un compte jetable, le supprimer
  depuis l'app, vérifier qu'il a disparu ([compte.md](compte.md#déployer)).
- [ ] **Marquer le compte personnel**, une fois, dans l'éditeur SQL : sans cette marque, « Reprendre la main » n'est
  proposé à personne ([regulation.md](regulation.md#hors-de-loffre-publique)). Ne pas se déconnecter pour l'obtenir
  plus vite : la déconnexion vide l'appareil.
- [ ] **Ramener sur un appareil un suivi encore synchronisé**, s'il en existe un : son bandeau « Ce suivi doit revenir
  sur un appareil » le propose. Selene ne synchronise plus les suivis de santé depuis le 3 octobre 2026.
- [ ] **Le test d'isolation entre comptes**, sur un projet de préproduction, puis la comparaison de ses règles avec
  celles de la production ([compte.md](compte.md#vérifier-lisolation-entre-comptes)).

## Publier dans les stores

Le chemin complet (comptes, clés, secrets, premier envoi) est dans [publication.md](publication.md).
« Reprendre la main » est hors de l'offre publique depuis le 3 octobre 2026
([regulation.md](regulation.md#hors-de-loffre-publique)) :

- [ ] **Exclure le type « Reprendre la main » des versions des stores**, à la construction, avant le premier envoi.
  Le masquer ne suffit pas : la règle 2.3.1 d'Apple refuse les fonctions cachées.
- [ ] **Google Play, Contenu de l'application**, et **App Store Connect** : les déclarations se remplissent alors sans
  données de santé ni références au tabac, à l'alcool ou aux drogues ([publication.md](publication.md#android--google-play),
  étape 5 ; [publication.md](publication.md#ios--app-store), étape 6).

## Conformité (RGPD)

La politique de confidentialité remplit l'article 13 : responsable, bases légales, durées, transferts
([compte.md](compte.md#politique-de-confidentialité)). Restent les obligations qu'aucune page ne remplit :

- [ ] **Le registre des activités de traitement** (article 30). La dispense des structures de moins de 250 personnes
  ne s'applique pas à un traitement qui n'est pas occasionnel, comme un compte synchronisé en continu. La CNIL publie
  un modèle. Y décrire : le compte et sa synchronisation, l'assistant, la sécurité, avec pour chacun les données, la
  base légale, la durée et les sous-traitants ; et les suivis de santé encore synchronisés, tant qu'il en reste.
- [ ] **L'analyse d'impact (AIPD, article 35)** : évaluer si elle est obligatoire, et écrire la conclusion avec ses
  raisons, même négative. Depuis que les suivis de santé ne passent plus par le serveur, le critère des données
  sensibles ne joue plus que pour ceux d'avant le 3 octobre 2026.
- [ ] **L'hébergement de données de santé (HDS**, article L.1111-8 du Code de la santé publique) : la question ne se
  pose plus une fois les derniers suivis synchronisés ramenés sur un appareil (plus haut). D'ici là, ou si la
  synchronisation revenait, la faire trancher par un juriste.
- [ ] **L'accord de sous-traitance de Supabase** (DPA, article 28), à demander sur
  <https://supabase.com/legal/dpa> ([compte.md](compte.md#politique-de-confidentialité)).

## À tenir dans la durée

Pas de case ici : ce sont des engagements, pas des tâches.

- Les promesses de la politique de confidentialité (sauvegardes 30 jours au plus, e-mails gardés un an au plus,
  réponse aux demandes sous un mois, base à Paris) : [compte.md](compte.md#politique-de-confidentialité).
- À chaque version : relire les deux politiques, pousser l'étiquette, promouvoir dans les stores
  ([publication.md](publication.md#à-chaque-version)).
- Le workflow *Liens*, le 3 de chaque mois : une annotation ⚠️ (refus) se vérifie dans un navigateur ; un échec ✗
  (page disparue) demande une nouvelle adresse officielle.
