# Ce qui reste à faire à la main

Ce que ni le code ni la CI ne peuvent faire : essayer Selene sur de vrais appareils, remplir les formulaires des
stores, tenir les obligations de la responsable du traitement. Une case par démarche, avec un lien vers le détail.
Une démarche faite : cocher la case, ou retirer la ligne, de préférence dans la PR qui la rend inutile.

Tenue à jour le 4 octobre 2026. Les étapes marquées *(si ce n'est pas déjà fait)* sont des réglages de mise en place
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
- [ ] **La table du journal des erreurs** : coller la partie « Le journal des erreurs » de `supabase/schema.sql` dans
  l'éditeur SQL. D'ici là, l'app reçoit un refus et n'envoie rien, sans gêne pour personne
  ([compte.md](compte.md#journal-des-erreurs)).
- [ ] **Les deux tables de la page de test** (`attente`, `audience`) : coller la partie « La page publique de test » de
  `supabase/schema.sql`. Sans elles, la page s'affiche mais l'inscription échoue
  ([essai.md](essai.md#mettre-en-place-une-fois-dix-minutes)).
- [ ] **La table de la mesure d'usage** (`activite`), avant d'inviter les bêta-testeurs : coller la partie « La mesure
  d'usage de la bêta » de `supabase/schema.sql`. Sans elle, rien n'est compté, et la bêta (E4) n'a pas de chiffres
  ([compte.md](compte.md#mesure-dusage-bêta)).

## Valider le problème et le parcours (E1, E2)

Le guide d'entretien, les tâches à faire passer, les grilles et le journal des décisions sont dans
[validation.md](validation.md).

- [ ] **Dix entretiens sur le problème (E1)**, dans les deux premières semaines : recruter hors des proches, parler du
  dernier épisode réel, ne montrer Selene qu'à la fin ; seuil : 6 sur 10 décrivent le problème sans y être amenés
  ([validation.md](validation.md#e1--dix-entretiens-sur-le-problème)).
- [ ] **Deux vagues de cinq tests de tâches (E2)**, avant d'inviter à la bêta : six tâches, sans aide, chronométrées ;
  seuils : 80 % de réussite, premier fragment en moins de 2 minutes. M'envoyer la liste des hésitations entre les deux
  vagues ([validation.md](validation.md#e2--tester-le-parcours-deux-fois-cinq-personnes)).
- [ ] **Le journal des décisions**, une ligne par expérience terminée, avant de passer à la suivante
  ([validation.md](validation.md#le-journal-des-décisions)).

## Valider le marché : la page publique de test (E3)

La page est en ligne avec le site : <https://mariebonifacio.github.io/selene/essai.html>. Tout le mode d'emploi est
dans [essai.md](essai.md).

- [ ] **Vérifier la page**, après la création des tables : une inscription et une visite de test sous `?src=essai-perso`,
  lues dans l'éditeur SQL, puis effacées ; l'aperçu (image, titre) dans un message
  ([essai.md](essai.md#mettre-en-place-une-fois-dix-minutes)).
- [ ] **Diffuser** dans trois à cinq communautés du public visé, avec un lien et une étiquette `?src=` par communauté ;
  noter où et quand chaque lien a été posté ([essai.md](essai.md#diffuser) ; trois messages types dans
  [validation.md](validation.md#e3--diffuser-la-page-publique)).
- [ ] **Lire les résultats** une fois 100 ouvertures venues des communautés ciblées : le seuil de l'audit est de 10 %
  d'inscriptions ([essai.md](essai.md#lire-les-résultats)). En dessous de 100, attendre ou diffuser davantage.
- [ ] **À l'ouverture de la bêta** : un seul e-mail aux inscrits, puis effacer la liste, comme la politique de
  confidentialité le promet ([essai.md](essai.md#écrire-aux-inscrits-puis-effacer)).
- [ ] **Chaque demande d'effacement** reçue à l'adresse de contact : la traiter sous un mois (une requête,
  [essai.md](essai.md#écrire-aux-inscrits-puis-effacer)).

## Mesurer la bêta fermée (E4)

- [ ] **Le message d'invitation**, envoyé de votre adresse juste avant l'invitation de Supabase : un modèle complet,
  avec la phrase sur la mesure d'usage, est dans [validation.md](validation.md#e4--la-bêta-fermée-quatre-semaines) ;
  puis le message de la semaine 2 et les trois questions de la semaine 4.
- [ ] **Lire les seuils** quatre semaines après les premières invitations, avec la requête de
  [compte.md](compte.md#mesure-dusage-bêta) : au moins 40 % des invités actifs le premier jour, au moins 25 % en
  semaine 4. À 15 invités, un compte pèse près de 7 points : lire les nombres, pas seulement les pourcentages.
- [ ] **Chaque opposition ou demande d'effacement** de la mesure : une requête, sous un mois
  ([compte.md](compte.md#mesure-dusage-bêta)).

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
  un modèle. Y décrire : le compte et sa synchronisation, l'assistant, la sécurité, le journal des erreurs, la mesure
  d'usage de la bêta, la liste d'attente et la mesure d'audience de la page de test, avec pour chacun les données, la base légale, la durée et les
  sous-traitants ; et les suivis de santé encore synchronisés, tant qu'il en reste.
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
- Les PR de Dependabot, au début de chaque mois : une pour les actions de CI, une pour les outils npm
  (`.github/dependabot.yml`). Fusionner si Check est vert. Après une mise à jour des actions, regarder que le
  déploiement Pages qui suit réussit : la CI d'une PR ne l'exerce pas, ni la publication des apps. Une PR en retard
  sur `main` se met à jour par un commentaire `@dependabot rebase`.
