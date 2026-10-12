# RGPD : le registre, l'analyse d'impact, les contrats

Les obligations de la responsable du traitement qu'aucune page ne remplit ([a-faire.md](a-faire.md#conformité-rgpd)) :
le registre des activités de traitement (article 30), la décision sur l'analyse d'impact (article 35), la question de
l'hébergement de données de santé, les contrats avec les sous-traitants (article 28). La politique de confidentialité
(`confidentialite.html`, [compte.md](compte.md#politique-de-confidentialité)) informe les personnes ; ce document-ci
décrit les traitements pour la responsable, et pour la CNIL si elle le demande.

**Brouillon du 12 octobre 2026**, écrit par une session Claude Code d'après le code, `supabase/schema.sql` et la
politique du 4 octobre 2026. Ce n'est pas un avis juridique : à relire, compléter (les mentions **À COMPLÉTER**) et
valider par la responsable, qui le date alors ci-dessous. Il se tient ensuite comme la politique : un nouveau service,
une nouvelle donnée gardée, une durée changée, et ce fichier change dans la même PR.

| Version | Date | Par | Ce qui change |
|---|---|---|---|
| Brouillon | 12 octobre 2026 | une session Claude Code | Première rédaction |
| **À COMPLÉTER** | | la responsable | Relu et validé |

## Le registre des activités de traitement (article 30)

**Pourquoi il en faut un.** L'article 30.5 dispense les structures de moins de 250 personnes, sauf pour un traitement
qui n'est pas occasionnel : un compte synchronisé en continu ne l'est pas. Le registre doit pouvoir être remis à la CNIL
sur demande (article 30.4). Ce fichier suit les rubriques du modèle de la CNIL : une fiche par traitement.

**Le responsable du traitement.** Marie Bonifacio, développeuse, personne physique, éditrice de Selene ;
`mariebonifacio.pro@gmail.com`. Adresse postale : **À COMPLÉTER**, de préférence hors de ce dépôt public (dans la copie
remise à la CNIL), puis celle de la micro-entreprise le jour où elle existe. Pas de délégué à la protection des données :
il n'est obligatoire (article 37) ni pour une personne privée, ni sans suivi systématique ou données sensibles **à grande
échelle**. Pas de représentant dans l'Union : la responsable y est établie.

### Les destinataires et sous-traitants

| Qui | Rôle | Traitements | Où | Contrat (article 28) et transferts |
|---|---|---|---|---|
| Supabase, Inc. | Sous-traitant : base Postgres, authentification, fonctions du serveur | T1 à T9 | Base à Paris (eu-west-3) ; fonctions dans le centre de données le plus proche de la personne ; société américaine | DPA **à signer** ([plus bas](#les-contrats-de-sous-traitance-article-28)). À vérifier dans le DPA : clauses contractuelles types ou adhésion au *Data Privacy Framework* |
| GitHub, Inc. | Hébergeur du site (GitHub Pages) ; garde les sauvegardes chiffrées de la base (artefacts du workflow *Sauvegarde*, 30 jours) | T5 (adresses IP des visites), T1 (sauvegardes) | États-Unis | **À VÉRIFIER** : l'accord de GitHub applicable au compte. Les sauvegardes sont chiffrées pour une clé que GitHub n'a pas : c'est la mesure supplémentaire la plus forte qui soit pour un transfert |
| Brevo (Sendinblue SAS) | Sous-traitant prévu : l'envoi des e-mails du compte (mot de passe oublié, invitations), une fois le SMTP branché | T1 | France | Son accord de traitement fait partie de ses conditions. **Pas encore branché** au 12 octobre 2026 ; la politique le nommera alors ([compte.md](compte.md#politique-de-confidentialité)) |
| Google (Gmail) | La boîte de contact ; l'envoi des messages d'invitation et de la liste d'attente | T8, T10, T11, T12 | États-Unis, Union | Une boîte Gmail personnelle n'a pas d'accord de sous-traitance : Google y agit selon ses propres conditions. Tenable pour quelques échanges ; une adresse professionnelle avec un accord de traitement (Google Workspace, ou une messagerie européenne) est à envisager avec la bêta, et avant la prévente (E5) |
| Anthropic, PBC | L'assistant : les questions partent sous la clé de la personne | T3 | États-Unis | **Inactif** : l'assistant n'est pas déployé pour la bêta (décision du 7 octobre 2026). Le rôle d'Anthropic est à qualifier le jour où il l'est |

**Pas des destinataires.** Les services que Selene appelle depuis l'appareil (Open-Meteo, Crossref, OpenAlex, Zotero,
MusicBrainz, Cover Art Archive, Microlink, OpenAgenda par Opendatasoft) reçoivent la requête directement de l'appareil :
rien ne passe par la responsable, qui ne les choisit que comme fonctions de l'outil. La politique les nomme, par
transparence. De même, l'artefact claude.ai garde les données de chacun dans le sous-arbre privé de son compte
claude.ai, hors de portée de la responsable (ADR 33) ; à réexaminer s'il est publié et ouvert à d'autres.

### T1 — Les comptes et leur synchronisation

- **Finalité** : retrouver son carnet sur plusieurs appareils ; entrer par une invitation, retrouver l'accès par un lien.
- **Base légale** : l'exécution du contrat (article 6.1.b), le service demandé en créant un compte.
- **Personnes** : les titulaires d'un compte (la responsable, les bêta-testeurs invités).
- **Données** : adresse e-mail, mot de passe haché (Supabase Auth), date de création et de connexion ; le tableau de bord
  (`app_state` : documents `site` et `board`, contenu libre saisi par la personne : tâches, notes, sources, réglages, dont
  le lieu choisi pour le ciel, arrondi au dixième de degré) ; d'un suivi « Reprendre la main » gardé sur un appareil, le
  nom seulement ; la marque `selene_personnel` d'un seul compte.
- **Destinataires** : la responsable (tableau de bord Supabase), Supabase ; Brevo pour les e-mails, une fois branché.
- **Durée** : tant que le compte existe ; sa suppression efface aussitôt la ligne (`on delete cascade`) ; les sauvegardes
  de la base gardent une donnée effacée 30 jours au plus.
- **Remarque** : le contenu est libre, et une personne peut y écrire des données sensibles (sa santé, ses opinions) sans
  qu'on le lui demande. La responsable ne lit pas les tableaux de bord, mais le peut techniquement : l'accès à son compte
  Supabase est donc la mesure de sécurité qui compte le plus ([plus bas](#la-sécurité-article-32)).

### T2 — Les suivis « Reprendre la main » encore synchronisés (données de santé, en extinction)

- **Finalité** : montrer à la personne son propre suivi (tabac, cannabis, alcool, réseaux sociaux) sur ses appareils.
- **Base légale** : le consentement explicite et daté (article 9.2.a), retirable à tout moment : le suivi revient alors
  sur un seul appareil.
- **Personnes** : les comptes qui ont créé un suivi synchronisé avant le 3 octobre 2026. Combien : **À COMPLÉTER** avec
  la requête ci-dessous (vraisemblablement le seul compte de la responsable).
- **Données** : quantités, envies, déclencheurs, actions, objectifs, notes d'un suivi.
- **Durée** : jusqu'à ce que la personne garde le suivi sur un appareil, ce que Selene lui propose à chaque ouverture ;
  le serveur n'en garde alors que le nom. Aucun nouveau suivi n'est synchronisé depuis le 3 octobre 2026.
- **Ce qui l'éteint** : la requête de [l'hébergement de données de santé](#lhébergement-de-données-de-santé-hds) ne
  renvoie plus rien. Ce traitement sort alors du registre.

### T3 — L'assistant (inactif)

- **Finalité** : répondre aux questions de la personne, avec ce qu'elle a choisi de lui laisser lire.
- **Base légale** : l'exécution du contrat (article 6.1.b), la fonction demandée.
- **Données** : la clé d'API Anthropic de la personne, chiffrée (AES-GCM, liée au compte) dans `assistant_keys`, et son
  indice ; les questions et le contexte choisi, transmis sans être gardés.
- **Durée** : la clé, jusqu'à ce qu'elle soit retirée ou le compte supprimé ; les questions, aucune.
- **État** : non déployé (décision du 7 octobre 2026) ; la table existe, vide. À rouvrir avant tout déploiement.

### T4 — Le passeur

- **Finalité** : lire pour la personne les flux, pages et calendriers que le navigateur ne peut pas lire seul.
- **Base légale** : l'exécution du contrat (article 6.1.b).
- **Données** : les adresses demandées, la session du compte (la fonction est fermée aux autres).
- **Durée** : aucune, la fonction ne garde rien ; seuls restent les journaux techniques (T5).

### T5 — La sécurité et les journaux techniques

- **Finalité** : protéger le service et les comptes (nombre d'essais limité, refus des abus, diagnostic d'un incident).
- **Base légale** : l'intérêt légitime (article 6.1.f).
- **Données** : adresse IP, date, requête.
- **Destinataires** : Supabase, GitHub, chacun pour ses propres journaux.
- **Durée** : de 1 à 7 jours chez Supabase, selon l'offre ; chez GitHub, selon sa politique.

### T6 — Le journal des erreurs

- **Finalité** : corriger les défauts de Selene.
- **Base légale** : l'intérêt légitime (article 6.1.f), avec un droit d'opposition : l'interrupteur de *Réglages → Compte*.
- **Données** : le type d'une erreur de programmation, l'endroit du code, l'écran, la version, la plateforme (table
  `erreurs`) ; ni compte, ni texte saisi. Des données anonymes en elles-mêmes ; l'adresse IP passe pendant l'envoi (T5),
  d'où leur place ici.
- **Durée** : 30 jours ; le déclencheur purge à chaque écriture.
- **Mise en balance** : un but légitime (la qualité du service) ; le minimum nécessaire (rien qui désigne la personne) ;
  un impact quasi nul, annoncé, et que l'on peut couper.

### T7 — La mesure d'usage de la bêta

- **Finalité** : savoir si Selene sert encore au bout d'un mois (E4 : 40 % des invités actifs le premier jour, 25 % en
  semaine 4).
- **Base légale** : l'intérêt légitime (article 6.1.f), avec un droit d'opposition : l'interrupteur de *Réglages →
  Compte* ; les jours déjà comptés s'effacent sur demande.
- **Personnes** : les comptes qui saisissent quelque chose, sauf opposition ; jamais depuis l'artefact, jamais sans compte.
- **Données** : (compte, jour) dans `activite`, rien d'autre : ni le contenu, ni l'heure, ni l'appareil.
- **Durée** : 90 jours, jamais plus que le compte ; le déclencheur purge, la suppression du compte efface.
- **Mise en balance** : un but légitime et précis (décider de la suite du projet) ; le minimum nécessaire (un jour, pas
  un geste) ; rien n'est écrit sur l'appareil (l'article 82 de la loi Informatique et Libertés ne s'applique pas) ;
  annoncée dans la politique et dans le message d'invitation, et que l'on peut couper.

### T8 — La liste d'attente de la page de test

- **Finalité** : écrire une fois aux inscrits, à l'ouverture de la bêta.
- **Base légale** : le consentement (article 6.1.a), donné en cochant la case, retirable en écrivant à l'adresse de
  contact.
- **Personnes** : les visiteurs de `essai.html` qui s'inscrivent.
- **Données** : adresse e-mail, date, lien d'arrivée (`?src=`), et le type de projet si la personne le dit (`attente`).
- **Destinataires** : la responsable, Supabase ; Google, pour l'envoi de l'unique e-mail (en copie cachée).
- **Durée** : jusqu'à cet e-mail, puis effacée à la main ([essai.md](essai.md#écrire-aux-inscrits-puis-effacer)) ; deux
  ans au plus (le déclencheur).

### T9 — La mesure d'audience de la page de test

- **Finalité** : savoir si la page intéresse, et par quel lien.
- **Base légale** : l'intérêt légitime (article 6.1.f).
- **Données** : la date, la page, l'événement (ouverture ou clic sur « Essayer »), le lien d'arrivée (`audience`) ; ni
  adresse IP gardée, ni identifiant, rien d'écrit sur l'appareil. Anonymes en elles-mêmes ; l'adresse IP passe pendant
  l'envoi (T5).
- **Durée** : 13 mois (le déclencheur).

### T10 — Les échanges à l'adresse de contact et les demandes de droits

- **Finalité** : répondre aux questions ; traiter les demandes d'accès, de rectification, d'effacement, d'opposition et
  de suppression de compte.
- **Base légale** : l'obligation légale pour les demandes de droits (article 6.1.c, articles 12 à 22) ; l'intérêt
  légitime pour les autres échanges (article 6.1.f). La politique ne nomme pas encore cette base
  ([points à trancher](#points-à-trancher)).
- **Données** : l'adresse, le message, ce qu'il contient.
- **Durée** : le temps de répondre, puis un an au plus après le dernier échange.

### T11 — Les entretiens et les tests de tâches (E1, E2)

- **Finalité** : comprendre comment les personnes travaillent (E1), observer le parcours de Selene (E2)
  ([validation.md](validation.md)).
- **Base légale** : le consentement (article 6.1.a), demandé avant l'entretien pour les notes, et par un oui explicite
  pour un enregistrement.
- **Personnes** : les personnes recrutées pour un entretien ou un test.
- **Données** : l'adresse de contact, jusqu'à l'envoi du bon d'achat ; les notes, sous un code (P1 à P10) ; un
  enregistrement, s'il y a eu accord.
- **Durée** : les adresses, effacées après l'envoi du bon d'achat ; les notes et les enregistrements, **À COMPLÉTER**.
  Proposition : les enregistrements effacés une fois les notes prises ; les notes codées gardées jusqu'à la fin des
  expériences (E5), puis le journal des décisions seul.
- **L'information à donner (article 13)**, à lire ou envoyer avant l'entretien, à compléter par la durée choisie :

  > Je prends des notes pendant notre échange, sous un code et sans votre nom, pour comprendre comment vous travaillez et
  > décider de la suite de Selene ; je ne les partage avec personne. Si vous l'acceptez, j'enregistre aussi, et
  > j'efface l'enregistrement une fois mes notes prises. Votre adresse ne sert qu'à vous envoyer le bon d'achat, puis je
  > l'efface. Vous pouvez retirer votre accord, demander à voir ou effacer ce qui vous concerne en m'écrivant à
  > mariebonifacio.pro@gmail.com, et saisir la CNIL si ma réponse ne vous convient pas.

### T12 — La bêta fermée : invitations et retours (E4)

- **Finalité** : inviter les bêta-testeurs, leur écrire en semaine 2, recueillir leurs réponses en semaine 4.
- **Base légale** : l'exécution du contrat pour l'invitation et le compte (article 6.1.b) ; l'intérêt légitime pour les
  retours (article 6.1.f), auxquels chacun est libre de ne pas répondre.
- **Données** : l'adresse, les messages échangés, les réponses aux trois questions.
- **Durée** : les réponses, **À COMPLÉTER** (proposition : jusqu'au journal des décisions d'E4, puis seules les synthèses
  sans nom).

### À venir, hors du registre tant qu'ils n'existent pas

- **La prévente (E5)** : acheteurs, paiements (Stripe), factures ; la comptabilité se garde dix ans (obligation légale,
  article L123-22 du Code de commerce). Une fiche à écrire avant la première vente, avec les conditions de vente.
- **L'assistant déployé** (T3 à rouvrir), **Brevo branché** (T1 à compléter).

## La sécurité (article 32)

Ce qui est en place :

- HTTPS partout (GitHub Pages, Supabase) ; aucun script tiers, les polices servies par le site ; une politique de
  sécurité du contenu (CSP) stricte, vérifiée par le cas [TRV-009](recette/manuels/transverse.md#trv-009).
- Chaque table sous RLS : une ligne par compte, lisible par lui seul ; `assistant_keys`, sans aucune règle, ne s'ouvre
  qu'à la fonction. L'app ne connaît que la clé publique, et le build refuse la clé secrète.
- Les mots de passe hachés par Supabase Auth, 10 caractères au moins, l'actuel exigé pour en changer.
- La clé d'assistant chiffrée (AES-GCM), liée au compte, jamais renvoyée à la page.
- Les purges par déclencheur (journal 30 jours, mesure d'usage 90 jours, liste d'attente deux ans, audience 13 mois) et
  des plafonds horaires sur les tables que la page peut écrire.
- Les actions de la CI épinglées par empreinte, pour qu'un tag déplacé par un tiers ne change pas ce qui s'exécute.

Ce qui manque au 12 octobre 2026 ([a-faire.md](a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait)) :

- **La sauvegarde** : le workflow *Sauvegarde* saute toutes ses étapes faute de réglages ; aucune copie de la base
  n'existe.
- **Le test d'isolation** sur un vrai projet, et ses secrets pour le rejouer chaque lundi.
- **La double authentification** sur les comptes Supabase, GitHub et Google de la responsable : **À VÉRIFIER**. Chacun
  ouvre toutes les données ; un mot de passe volé suffirait sans elle.
- Côté Supabase : la longueur minimale de 10 et le mot de passe actuel exigé, côté serveur
  ([compte.md](compte.md#mots-de-passe)).

## Les violations de données (article 33)

Toute violation (une base ouverte par erreur, un secret publié, un compte d'administration volé) se note ici, même sans
conséquence (article 33.5). S'il y a un risque pour les personnes, la notifier à la CNIL sous 72 heures
(<https://notifications.cnil.fr>) ; s'il est élevé, prévenir aussi les personnes (article 34).

| Date | Ce qui s'est passé | Données et personnes touchées | Ce qui a été fait | Notifiée ? |
|---|---|---|---|---|
| — | Aucune au 12 octobre 2026 | — | — | — |

## L'analyse d'impact (article 35) : est-elle obligatoire ?

Elle l'est pour un traitement « susceptible d'engendrer un risque élevé ». Deux repères : la liste des types de
traitements pour lesquels la CNIL l'exige (délibération n° 2018-327 du 11 octobre 2018), et les neuf critères des lignes
directrices européennes (WP 248 rév. 01, reprises par la CNIL) ; un traitement qui en remplit deux appelle en général
une analyse.

| Critère | Selene au 12 octobre 2026 |
|---|---|
| 1. Évaluation ou notation | Non. Les motifs et bilans se calculent sur l'appareil, pour la personne seule. |
| 2. Décision automatique à effet juridique | Non. |
| 3. Surveillance systématique | Non. La mesure d'usage compte des jours, pas des comportements, et se coupe. |
| 4. Données sensibles ou à caractère hautement personnel | **Oui.** Un carnet personnel synchronisé (notes, idées, projets) en relève : les lignes directrices citent les notes et les applications qui consignent la vie. S'y ajoutent les suivis de santé d'avant le 3 octobre (T2), en extinction. |
| 5. Grande échelle | Non. Une bêta fermée d'une quinzaine de comptes. |
| 6. Croisement d'ensembles de données | Non. |
| 7. Personnes vulnérables | Non. « Reprendre la main », qui s'adresse à des personnes qui veulent réduire une consommation, n'est plus proposé au public. |
| 8. Usage innovant | Non. L'assistant, un usage de l'IA qui pourrait le devenir, n'est pas déployé. |
| 9. Exclusion d'un droit ou d'un service | Non. |

Aucun type de la liste de la CNIL ne correspond (**à vérifier** sur la liste en vigueur au moment de valider).

**Conclusion proposée** : pas d'analyse d'impact obligatoire au 12 octobre 2026. Un seul critère est rempli ; la
synchronisation de données de santé est close aux nouveaux suivis et s'éteint ; l'échelle est celle d'une bêta fermée.
Les mesures de [la sécurité](#la-sécurité-article-32) répondent au risque du critère 4, à condition que ce qui manque
soit fait avant d'inviter les bêta-testeurs.

**À réexaminer**, et cette conclusion à réécrire, dès que l'un de ces changements arrive : « Reprendre la main » ouvert
au public, ou des données de santé synchronisées de nouveau ; l'assistant déployé ; Selene ouverte au-delà d'une bêta
fermée ; un nouveau croisement de données ou une nouvelle catégorie de personnes.

## L'hébergement de données de santé (HDS)

L'article L.1111-8 du Code de la santé publique impose un hébergeur certifié pour les données de santé « recueillies à
l'occasion d'activités de prévention, de diagnostic, de soins ou de suivi social et médico-social », y compris pour le
compte du patient lui-même. Supabase n'est pas certifié HDS. Qu'un suivi personnel de consommation entre dans ces
activités (la prévention ?) est une question de juriste ; elle ne se pose que tant qu'un suivi « Reprendre la main »
garde son contenu sur le serveur.

Pour le savoir, dans l'*SQL Editor* du projet de l'app (lecture seule) :

```sql
select u.email, m.key as espace, m.value->>'label' as nom,
       coalesce(m.value->'config'->>'storage', '(d''avant le choix)') as stockage
from public.app_state a
join auth.users u on u.id = a.user_id
cross join lateral jsonb_each(coalesce(a.site->'modules', '{}'::jsonb)) m
where m.value->>'type' = 'regulation'
  and coalesce(m.value->'config'->>'storage', '') <> 'device'
order by 1, 2;
```

Chaque ligne est un suivi dont le contenu est encore sur le serveur (synchronisé avec un accord, ou d'avant la question).
Un suivi gardé sur un appareil n'y apparaît pas : le serveur n'en a que le nom. La requête a été essayée le 12 octobre 2026
contre PostgreSQL 16, sur des lignes synthétiques tirées de `donnees/rlm-synchronise-ancien.json` : elle trouve le suivi
synchronisé et celui d'avant le choix, ignore celui gardé sur un appareil et le compte sans suivi.

- **Aucune ligne** : la question HDS ne se pose plus, T2 sort du registre ; cocher la case de
  [a-faire.md](a-faire.md#conformité-rgpd).
- **Des lignes, toutes au compte de la responsable** : ouvrir Selene sur l'appareil choisi et accepter le bandeau « Ce
  suivi doit revenir sur un appareil » ; relancer la requête à la synchronisation suivante.
- **Des lignes d'autres comptes** : Selene le leur propose à chaque ouverture, sans choisir l'appareil à leur place.
  D'ici leur choix, ou si la synchronisation revenait, la question va à un juriste.

## Les contrats de sous-traitance (article 28)

1. **Supabase** : demander le DPA sur <https://supabase.com/legal/dpa>, en suivant la procédure de la page, au nom de la
   responsable. Garder l'exemplaire signé hors du dépôt, et noter ici la date de signature : **À COMPLÉTER**.
2. **GitHub** : **À VÉRIFIER**, l'accord de protection des données que les conditions de GitHub appliquent au compte,
   et le noter dans la table des sous-traitants.
3. **Brevo** : à la création du compte, avant de brancher le SMTP ; puis nommer Brevo dans les deux politiques.
4. **Google** : voir la table des sous-traitants ; une adresse professionnelle avec un accord de traitement avant la
   prévente.

## Points à trancher

| Point | Proposition | Où |
|---|---|---|
| ~~La « version courte » de la politique dit « Selene […] ne mesure rien » (*measures nothing* en anglais), alors que la même page décrit la mesure d'usage de la bêta (T7) et la mesure d'audience de la page de test (T9). Une information qui doit être loyale et transparente (articles 5.1.a et 12) ne peut pas se contredire.~~ Fait le 12 octobre 2026, sur décision de la responsable : les deux politiques, datées du 12 octobre. | « Selene ne vend rien, ne montre aucune publicité et n'a aucun traceur. Elle ne compte que deux choses, sans rien lire de ce que tu écris : tes jours d'usage pendant la bêta, si tu ne coupes pas cette mesure, et les ouvertures de sa page de présentation. » Et l'anglais à l'identique. | `confidentialite.html`, `privacy.html` |
| La base légale des échanges à l'adresse de contact (T10) n'est pas dans « Pourquoi, et sur quelle base ». | Ajouter la ligne : demandes de droits, obligation légale (6.1.c) ; autres échanges, intérêt légitime (6.1.f). | les deux politiques |
| Les durées des notes d'entretien (T11) et des retours de bêta (T12). | Celles proposées dans leurs fiches. | ce fichier, puis l'information de T11 |
| La double authentification des comptes d'administration. | L'activer partout où elle ne l'est pas. | Supabase, GitHub, Google |
