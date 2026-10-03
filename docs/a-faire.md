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
  [parcours manuel](regulation.md#parcours-manuel-cinq-minutes), étapes 1 à 9. À voir en particulier : le choix
  « sur cet appareil » proposé d'abord, l'autre appareil qui n'affiche que le nom, l'accord demandé avant de
  synchroniser, la garde à la déconnexion.
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
- [ ] **Le test d'isolation entre comptes**, sur un projet de préproduction, puis la comparaison de ses règles avec
  celles de la production ([compte.md](compte.md#vérifier-lisolation-entre-comptes)).

## Publier dans les stores

Le chemin complet (comptes, clés, secrets, premier envoi) est dans [publication.md](publication.md). Pour
« Reprendre la main », qui contient des données de santé :

- [ ] **Google Play, Contenu de l'application** : la sécurité des données (*Santé et forme → Informations de santé* :
  facultatif, collecté seulement si la personne synchronise un suivi avec son accord), la déclaration des applications
  de santé si la Console la présente, le questionnaire de classification (références au tabac, à l'alcool et aux
  drogues), une fiche sans revendication médicale ([publication.md](publication.md#android--google-play), étape 5).
- [ ] **App Store Connect** : la confidentialité de l'app (*Santé et forme → Santé*), la classification par âge, la
  règle 1.4.3 ([publication.md](publication.md#ios--app-store), étape 6).
- [ ] **En remplissant la sécurité des données**, vérifier dans l'aide de chaque console comment elle compte les
  sauvegardes du système : un suivi gardé « sur cet appareil » peut être copié par la sauvegarde automatique d'Android
  ou par iCloud, sous le compte Google ou Apple de la personne, sans que Selene le reçoive jamais
  ([regulation.md](regulation.md#confidentialité), « Sauvegardes du système »).

## Conformité (RGPD)

La politique de confidentialité remplit l'article 13 : responsable, bases légales, durées, transferts
([compte.md](compte.md#politique-de-confidentialité)). Restent les obligations qu'aucune page ne remplit :

- [ ] **Le registre des activités de traitement** (article 30). La dispense des structures de moins de 250 personnes
  ne s'applique pas quand le traitement porte sur des données de santé, ce qui est le cas dès qu'un suivi est
  synchronisé. La CNIL publie un modèle. Y décrire : le compte et sa synchronisation, les suivis de santé synchronisés,
  l'assistant, la sécurité, avec pour chacun les données, la base légale, la durée et les sous-traitants.
- [ ] **L'analyse d'impact (AIPD, article 35)** : évaluer si elle est obligatoire (données de santé d'un côté, le
  critère de « grande échelle » de l'autre) et écrire la conclusion avec ses raisons, même si elle est négative.
- [ ] **L'hébergement de données de santé (HDS**, article L.1111-8 du Code de la santé publique) : faire confirmer par
  un juriste qu'un carnet tenu par la personne elle-même, hors de tout cadre de soins, n'y est pas soumis.
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
