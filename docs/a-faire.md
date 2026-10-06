# Ce qui reste à faire à la main

Ce que ni le code ni la CI ne peuvent faire : essayer Selene sur de vrais appareils, remplir les formulaires des
stores, tenir les obligations de la responsable du traitement. Une case par démarche, avec un lien vers le détail.
Une démarche faite : cocher la case, ou retirer la ligne, de préférence dans la PR qui la rend inutile.

Tenue à jour le 6 octobre 2026. Les étapes marquées *(si ce n'est pas déjà fait)* sont des réglages de mise en place
dont le dépôt ne peut pas savoir s'ils ont eu lieu.

## Tout de suite (une minute)

- [ ] **Le lien ameli** cité par [regulation.md](regulation.md#alcool) (« repères de consommation »,
  `https://www.assurance-maladie.ameli.fr/index.php/assure/sante/themes/alcool-sante/definition-reperes-consommation`).
  Le workflow *Liens* du 3 octobre 2026 a reçu un refus (403) : le site bloque le robot de GitHub, ce qui ne dit rien
  de la page. L'ouvrir dans un navigateur : si elle s'affiche, rien à faire ; sinon, remplacer l'adresse dans
  `docs/regulation.md`. Ce lien n'apparaît pas dans l'interface.

- [ ] **L'artefact claude.ai, à publier avec `db` et `user`** (ADR 33 de [architecture.md](architecture.md)), **pas
  avant la fusion de la correction d'A17** (PR #121 : un ancien suivi « Reprendre la main » y partait dans la base de
  claude.ai, [anomalie A17](recette/perimetre.md#anomalies-et-observations)). Aucun artefact Selene n'est publié sur le
  compte au 6 octobre 2026. Le jour où il l'est : dans une session Claude Code
  ouverte sur ce dépôt, demander « Publie `selene.html` comme artefact avec les capacités `db` et `user` » (ou mettre
  à jour l'artefact existant par son lien, avec les mêmes capacités). Sans `user`, Selene y fonctionne mais ne
  synchronise rien entre navigateurs ; elle ne range jamais rien dans un document partagé. Puis jouer
  [PLT-011](recette/manuels/plateformes.md#plt-011) avec un compte claude.ai de recette.

- [ ] **Le 20 octobre 2026 : Firefox devient bloquant** ([BL-13](recette/backlog.md#bl-13)). Lire les dernières courses
  *Check › browser (firefox)* : le job reste vert même quand un scénario échoue ; un échec s'y voit à l'avertissement
  « Scénarios en échec sous firefox (non bloquant) » sur la PR, et à la liste du résumé du job. Condition proposée :
  vingt passages consécutifs sans cet avertissement depuis la correction d'A16 (PR #120, le 6 octobre). Si elle est remplie, retirer la ligne `continue-on-error` du job `browser`
  dans `.github/workflows/check.yml` (une session Claude Code peut le faire : « Firefox devient bloquant ») ; sinon,
  chaque échec propre à Firefox devient une anomalie du cahier, corrigée avant de retirer la ligne, quitte à décaler la
  date.

- [ ] **Protéger la branche `main`** (dix minutes, droits d'administration du dépôt) : `main` n'est pas protégée au
  6 octobre 2026, alors que le contrôle du cahier a été décidé obligatoire. *Settings* → *Rules* → *Rulesets* → *New
  branch ruleset*, cible : la branche par défaut ; cocher *Require a pull request before merging* (sans approbation
  obligatoire), *Require status checks to pass* avec `recette` et `build-and-test`, et *Require branches to be up to
  date before merging* ; ne jamais y mettre `apk`, `simulator` ni `windows`, qui ne tournent pas sur toutes les PR et
  bloqueraient les autres pour toujours. Le détail et les raisons : [BL-12](recette/backlog.md#bl-12). Vérifier
  ensuite que `main` apparaît comme protégée dans la liste des branches.

- [ ] **Le compte de recette P**, pour jouer les cas « Reprendre la main » du chemin P : dans un projet Supabase de
  recette, jamais dans celui de l'app ni sur votre compte personnel. Cinq étapes, dix minutes :
  [README de la recette, « Le compte de recette P »](recette/README.md#le-compte-de-recette-p).

## Essayer sur de vrais appareils

La CI compile les trois apps, joue tous les parcours dans Chromium, WebKit et Firefox, lance l'app Android sur un
émulateur et installe l'app Windows sur une machine Windows de GitHub ; mais aucun vrai appareil n'a encore lancé
Selene. Avant chaque essai, recharger l'app une fois sur les appareils déjà connectés : une ancienne version ne
connaît pas le format 8 et refuse d'écrire.

- [ ] **« Reprendre la main » sur deux appareils du même compte** : le
  [parcours manuel](regulation.md#parcours-manuel-cinq-minutes), étapes 1 à 9. À voir en particulier : l'espace
  proposé au seul compte marqué personnel, aucun choix de stockage, l'autre appareil qui n'affiche que le nom, aucun
  bouton vers le compte, la garde à la déconnexion.
- [ ] **Android**, avec l'APK de la course *Android* : lancement à froid, hors ligne puis en ligne, partage depuis
  Chrome, bouton retour, rotation, clavier, synchronisation avec la PWA, Réglages → Ciel et alentours →
  « Ma position » (Android 12 ou plus : l'accord demandé, puis le lieu « Ma position »), et Réglages → Sauvegarde →
  Exporter : la feuille de partage s'ouvre, « Enregistrer » dans Fichiers ou Drive donne un `.json` que l'on peut
  réimporter (ADR 31) ([android.md](android.md#tester)).
- [ ] **iPhone**, par TestFlight une fois le compte Apple ouvert : lancement à froid, hors ligne puis en ligne,
  Raccourci de partage, rotation, clavier, encoches, synchronisation, « Ma position » (la phrase d'iOS dans la
  langue du téléphone, puis le lieu), et Réglages → Sauvegarde → Exporter (la feuille de partage, puis « Enregistrer
  dans Fichiers ») ([ios.md](ios.md#tester)).
- [ ] **Windows**, avec l'installateur de la course *Desktop* : premier lancement, données relues après fermeture,
  déconnexion, mise à jour par-dessus ([desktop.md](desktop.md#tester)).
- [ ] **La PWA installée sur iPhone** et **l'artefact claude.ai** ([architecture.md](architecture.md), « Hors CI »).
- [ ] **Un lecteur d'écran, une heure** (VoiceOver sur iPhone ou Mac, TalkBack sur Android, NVDA sur Windows) :
  capturer une note, ajouter une source, la retrouver par la recherche, sans regarder l'écran. Le balayage
  axe-core de quinze vues a été fait une fois, à la main, le 4 octobre ([evolution-ui.md](evolution-ui.md)) : ses
  correctifs sont figés par des tests (contraste, cibles), et le balayage lui-même se rejoue à chaque PR depuis le
  6 octobre (`tests/browser/accessibilite.js`, [BL-04](recette/backlog.md#bl-04)) ; les titres d'écran et le focus sont
  testés. Reste à entendre. À vérifier en particulier : le nom de l'écran annoncé à chaque changement (« Écriture — Selene », puis le
  titre de l'écran) ; « Supprimé… Annuler » annoncé, et ⌘Z / Ctrl+Z qui annule ; « Recherche… » puis « Trouvée : … »
  en ajoutant une source. Ce qui reste muet ou se répète : ouvrir un ticket, en nommant le lecteur et l'appareil.

## Jouer la recette

Aucun des 192 cas du [cahier de recette](recette/README.md) n'a encore été exécuté : la CI vérifie ce qui se simule,
pas un usage réel. Ce qui reste à faire côté qualité, d'un coup d'œil (y compris ce qu'une session Claude Code peut
faire) : [backlog de la recette](recette/backlog.md#reste-a-faire).

- [ ] **La première smoke** (une heure environ, sur ordinateur et un téléphone) avant la prochaine mise en ligne qui
  change un comportement : les seize cas de [campagnes.md](recette/campagnes.md#smoke), avec les comptes de recette A et B
  ([README de la recette](recette/README.md#environnement-et-données-de-recette)) ; le compte rendu tiré du
  [modèle](recette/comptes-rendus/modele.md), versé dans `docs/recette/comptes-rendus/` par une PR.
- [ ] **La recette complète** avant l'ouverture de la bêta ou une version des stores, puis chaque trimestre
  (quatre à cinq jours-personne, [campagnes.md](recette/campagnes.md#complete)).

## Régler le projet Supabase *(si ce n'est pas déjà fait)*

- [ ] **Sauvegarder la base, avant tout le reste** (P1) : sur l'offre gratuite, Supabase n'en garde aucune. Le workflow
  *Sauvegarde* la copie chiffrée chaque lundi, une fois réglés une clé age, la variable `SAUVEGARDE_CLE_AGE` et le
  secret `SUPABASE_DB_URL` (dix minutes) ; puis un *Run workflow*, et un exercice de restauration sur un projet neuf,
  supprimé ensuite ([compte.md](compte.md#sauvegarder-la-base), cas [TRV-017](recette/manuels/transverse.md#trv-017)). La clé privée ne va jamais dans GitHub : la perdre rend
  toutes les sauvegardes illisibles.
- [ ] **L'offre Pro de Supabase** (25 $ par mois : une sauvegarde par jour, pas de mise en pause), **avant d'inviter les
  bêta-testeurs** : leurs données ne doivent pas dépendre d'un vidage hebdomadaire. Décision de budget.
- [ ] **Mettre Postgres à jour** (*Project Settings* → *General* → *Service versions*), **après** une sauvegarde
  réussie, jamais avant : aucun retour en arrière n'est possible. Le projet tournait en 17.6 le 2 octobre, 17.11 était
  proposée (T18 de l'audit).
- [ ] **SMTP d'abord**, puis les adresses de retour (*URL Configuration*), puis la traduction des modèles d'e-mail :
  sans SMTP, les liens « mot de passe oublié » et les invitations n'atteignent que l'équipe du projet
  ([compte.md](compte.md#mot-de-passe-oublié-invitation)).
- [ ] **L'assistant hébergé : décider** s'il est déployé pour la bêta. Proposition : non, et l'écrire ici (il n'est pas
  prioritaire pour la bêta ; sans lui, pas de clés d'API à garder ni de traitement de plus au registre RGPD). Le jour
  où c'est oui : la mise en place de [assistant.md](assistant.md#mettre-en-place-une-fois) (le secret
  `ASSISTANT_KEY_SECRET`, la table des clés), puis [AST-001](recette/manuels/assistant.md#ast-001) à
  [AST-007](recette/manuels/assistant.md#ast-007) avec une clé Anthropic de recette à la dépense plafonnée. Au
  6 octobre 2026, ses quatre passages de CI ont sauté le déploiement, faute du secret : à moins d'un déploiement fait
  à la main, l'app dit « Assistant non déployé ».
- [ ] **La fonction `compte`** déployée (workflow *Compte*), puis un essai : créer un compte jetable, le supprimer
  depuis l'app, vérifier qu'il a disparu ([compte.md](compte.md#déployer)).
- [ ] **Marquer le compte personnel**, une fois, dans l'éditeur SQL : sans cette marque, « Reprendre la main » n'est
  proposé à personne ([regulation.md](regulation.md#hors-de-loffre-publique)). Ne pas se déconnecter pour l'obtenir
  plus vite : la déconnexion vide l'appareil.
- [ ] **Ramener sur un appareil un suivi encore synchronisé**, s'il en existe un : son bandeau « Ce suivi doit revenir
  sur un appareil » le propose. Selene ne synchronise plus les suivis de santé depuis le 3 octobre 2026.
- [ ] **Le test d'isolation entre comptes**, sur un projet de préproduction, puis la comparaison de ses règles avec
  celles de la production ([compte.md](compte.md#vérifier-lisolation-entre-comptes)). Ensuite, les six valeurs de
  `.env.isolation` en secrets du dépôt (`ISOLATION_*`, dix minutes) : le workflow *Isolation* le rejoue alors chaque
  lundi et à chaque changement des règles, et écrit par e-mail s'il échoue
  ([compte.md](compte.md#vérifier-lisolation-entre-comptes), « Chaque semaine, sans y penser »).
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

- [x] **Exclure le type « Reprendre la main » des versions des stores**, à la construction : fait le 5 octobre 2026
  (ADR 32). L'AAB et l'app iOS sont l'édition des stores ; l'APK et Windows gardent l'espace. Rien à faire à la main,
  sinon le constater une fois sur le téléphone, au premier envoi : la recette [RLM-030](recette/manuels/reprendre-la-main.md#rlm-030).
  Sur iPhone, le suivi se tient désormais dans la version web.
- [ ] **Google Play, Contenu de l'application**, et **App Store Connect** : les déclarations se remplissent alors sans
  données de santé ni références au tabac, à l'alcool ou aux drogues ([publication.md](publication.md#android--google-play),
  étape 5 ; [publication.md](publication.md#ios--app-store), étape 7).

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
  sur `main` se met à jour par le bouton *Update branch* ou un commentaire `@dependabot rebase`. Les actions sont
  épinglées par empreinte (`actions/checkout@3d3c42e… # v7.0.1`) : un tag déplacé par un tiers ne change rien à
  ce qui s'exécute ; Dependabot met à jour l'empreinte et le commentaire ensemble. Une action ajoutée à la main
  s'épingle de même : `git ls-remote --tags https://github.com/<dépôt>` donne l'empreinte du tag (la ligne en `^{}`
  pour un tag annoté).
