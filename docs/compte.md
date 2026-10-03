# Le compte : suppression et confidentialité

L'App Store (règle 5.1.1(v)) et Google Play exigent qu'une app où l'on crée un compte permette de le **supprimer
depuis l'app**, et qu'elle publie une **politique de confidentialité**. Selene fait les deux.

## Sans compte

L'écran d'entrée du site et des apps propose **« Commencer sans compte »** (ADR 28) : Selene marche alors entière sur
l'appareil, et rien de ce qu'on y écrit ne part au serveur. Le choix est gardé sur l'appareil (`selene-sans-compte`).
*Réglages → Compte* dit ce qu'il implique et ouvre la connexion ; se connecter ensuite verse l'appareil dans le compte
(un compte existant garde ses réglages). Le relecteur de l'App Store n'a donc pas besoin d'un compte de démonstration.

## Supprimer son compte

Réglages → Compte → *Supprimer mon compte* : on tape « supprimer », on confirme. La page appelle la fonction Supabase
Edge `compte` (`supabase/functions/compte`), qui, pour le compte de la session et lui seul :

1. efface sa ligne `app_state` (tout le tableau de bord) ;
2. efface sa clé d'assistant chiffrée (`assistant_keys`) ;
3. supprime le compte de Supabase Auth (les clés étrangères `on delete cascade` rattraperaient une table oubliée).

Puis l'appareil est vidé, comme à la déconnexion. Si une étape échoue, le compte n'est jamais supprimé avant ses
données, et un nouvel essai termine le travail.

La suppression demande la clé serveur du projet, que seule une fonction Edge peut détenir : Supabase la lui fournit
(`SUPABASE_SERVICE_ROLE_KEY`) ; `COMPTE_DB_KEY` la remplace si besoin (une nouvelle clé `sb_secret_…`). Origines
autorisées : `COMPTE_ORIGINS`, sinon celles de l'assistant et du passeur (site publié, apps).

### Déployer

Le workflow **Compte** (`.github/workflows/compte.yml`) déploie la fonction quand elle change sur `main`, ou à la
demande (Actions → Compte → Run workflow). Il n'a besoin que du secret `SUPABASE_ACCESS_TOKEN`, déjà utilisé par
l'assistant et le passeur. Tant qu'elle n'est pas déployée, le bouton le dit (« pas encore installée sur le serveur »).

Premier essai conseillé : créer un compte jetable, le supprimer depuis l'app, vérifier dans Supabase
(Authentication → Users) qu'il a disparu.

## Mot de passe oublié, invitation

Écran de connexion → *Mot de passe oublié ?* : on donne son adresse et Supabase envoie un lien
(`POST /auth/v1/recover`). La réponse est la même, que l'adresse ait un compte ou non : personne ne peut s'en servir
pour savoir qui est inscrit. Le lien ramène à Selene avec un jeton après le `#`. Selene l'efface aussitôt de
l'adresse (ni l'historique ni un favori ne le gardent), le garde en mémoire et demande le nouveau mot de passe deux
fois (`PUT /auth/v1/user`) : le jeton devient alors la session. Un lien expiré ou déjà utilisé le dit, sans jamais
afficher le texte d'erreur porté par le lien (n'importe qui peut en fabriquer un). Une invitation (Authentication →
Users → *Add user* → *Send invitation*) suit le même chemin : son lien demande de choisir le mot de passe du compte.
C'est ce qui permet de fermer les inscriptions publiques (*Authentication → Sign In / Providers → Allow new users to
sign up*) et d'inviter les comptes un par un. Selene le lit sur le serveur (`GET /auth/v1/settings`, `disable_signup`) :
inscriptions fermées, l'écran de connexion ne propose plus de créer un compte et dit que l'on entre sur invitation.

À régler une fois dans le projet Supabase, dans cet ordre :

- **SMTP d'abord** (*Authentication → Emails → SMTP Settings → Enable custom SMTP*). Sans lui, Supabase n'envoie
  que 2 e-mails par heure, et **seulement aux membres de l'équipe du projet** (Organization settings → Team) : pour
  tout autre compte, la demande de lien échoue (« Email address not authorized »). Une fois branché, la limite passe à
  30 par heure (*Authentication → Rate Limits* pour la relever).
- *Authentication → URL Configuration* : **Site URL** = `https://mariebonifacio.github.io/selene/` ; dans **Redirect
  URLs**, cette adresse et `https://mariebonifacio.github.io/selene/index.html` (Selene demande à revenir sur la page
  ouverte, `redirect_to`, et l'app installée s'ouvre sur la première). Une adresse absente de la liste est ignorée au
  profit de la Site URL. Les apps n'en demandent pas : le lien s'ouvre dans le navigateur, sur le site, puis on se
  connecte dans l'app avec le nouveau mot de passe.
- *Authentication → Emails → Templates* : traduire *Reset password* et *Invite user*. Sur l'offre gratuite, les
  modèles ne se modifient qu'une fois le SMTP branché.

## Mots de passe

Un nouveau mot de passe (inscription, lien de l'e-mail, changement) compte **10 caractères au moins** (`PW_MIN`,
`services/auth.js`) ; le formulaire le dit, et le navigateur refuse plus court avant tout envoi. La connexion n'impose
rien : un compte plus ancien, au mot de passe plus court, entre toujours. Le serveur le signale alors
(`weak_password` dans la réponse) ; Selene le dit et ouvre *Réglages → Compte → Changer mon mot de passe*.

Changer de mot de passe demande toujours le mot de passe actuel. Selene le vérifie par une connexion fraîche
(`POST /token`), qui remplace la session de l'appareil, puis envoie `PUT /user` avec `password` et `current_password` :
un appareil laissé ouvert ne suffit pas, et les deux options de sécurité du serveur ci-dessous sont satisfaites.
Chaque refus du serveur est traduit : trop court (avec la longueur qu'il demande), caractères exigés, mot de passe
connu des fuites, mot de passe inchangé.

À régler dans Supabase, *Authentication → Sign In / Providers → Email* :

- **Minimum password length** : `10`. C'est le serveur qui fait foi ; `PW_MIN` le suit.
- **Require current password when updating** : activé.
- **Secure password change** : au choix ; la connexion fraîche le satisfait.
- **Password requirements** : au choix (Selene traduit le refus).
- *Authentication → Attack Protection → Prevent use of leaked passwords* (HaveIBeenPwned) : offre Pro seulement.

## Taille d'un espace

Le serveur garde un espace de **5 Mo au plus** (le document `site`, en JSON ; 1 Mo pour l'ancien document `board`) :
contrainte `app_state_taille` de `supabase/schema.sql`. Un compte ne remplit pas la base à lui seul, et un historique
qui grossit se voit avant de casser.

- *Réglages → Sauvegarde* dit ce que pèse l'espace. À partir de 3 Mo, la ligne passe en alerte et nomme les trois
  modules les plus lourds.
- Au-delà de la limite, le serveur refuse l'écriture (code Postgres `23514`, ou `413` de la passerelle) : l'indicateur
  d'enregistrement dit « Trop volumineux pour le serveur », et tout reste sur l'appareil.

Pour un projet créé avant le 2 octobre 2026, ajouter la contrainte dans l'éditeur SQL de Supabase, **après** avoir
vérifié qu'aucune ligne ne la dépasse (une ligne plus lourde ne pourrait plus être modifiée) :

```sql
select user_id, octet_length(site::text) as site, octet_length(board::text) as board from public.app_state order by 2 desc;
alter table public.app_state add constraint app_state_taille
  check (octet_length(site::text) < 5000000 and octet_length(board::text) < 1000000) not valid;
```

## Journal des erreurs

Une erreur de programmation qui échappe à l'app (une exception non rattrapée, une promesse rejetée, une action qui
échoue sur un défaut) part, anonyme, dans la table `erreurs` (`src/app/services/journal.js`, T9 de l'audit). Six
informations seulement :
- le **genre** : le nom de l'erreur (`TypeError`…), jamais son message, qui peut citer ce que la personne a écrit ;
- le **lieu** : `fichier:ligne:colonne`, ou le nom de l'action ;
- la **vue** : l'écran, ou `module:<type>`, jamais l'identifiant d'un module (tiré du nom choisi) ; `module` seul pour
  un type sensible ;
- la **version** : l'empreinte du code (`SELENE_BUILD`, posée par `build.py`) ;
- la **plateforme** (`web`, `capacitor`, `tauri`) ;
- l'**heure**, celle du serveur.

Il n'y a ni compte ni jeton : la requête ne porte que la clé publique. Ne partent pas : les validations (une erreur
simple, ou une erreur du noyau avec son code), un réseau coupé, un abandon. Au plus cinq envois par chargement, une fois
chacun ; jamais depuis l'artefact claude.ai. La personne coupe l'envoi dans *Réglages → Compte*, pour cet appareil.

Côté serveur (`supabase/schema.sql`), toute page peut écrire, et personne ne lit par l'API. Chaque champ a sa taille
maximale. Au-delà de 500 entrées par heure, une entrée est ignorée en silence ; au-delà de 30 jours, elle est effacée :
le déclencheur purge à chaque écriture, sans tâche planifiée.

**Pour un projet existant**, coller dans l'éditeur SQL la partie « Le journal des erreurs » de `supabase/schema.sql`.
Avant, l'app reçoit un 404 et n'insiste pas : rien ne casse. **Lire le journal**, dans l'éditeur SQL :

```sql
select genre, lieu, vue, version, plateforme, count(*) as fois, max(at) as derniere
from public.erreurs group by 1, 2, 3, 4, 5 order by derniere desc limit 50;
```

Une même `version` donne les mêmes lignes et colonnes : `npm run build` sur le même commit retrouve l'endroit du code.

## Vérifier l'isolation entre comptes

Chaque compte ne voit que sa propre ligne : ce sont les règles RLS de `supabase/schema.sql` qui l'imposent, dans la
base. Les tests de Selene tournent contre une base simulée et ne prouvent rien sur les règles réellement posées dans un
projet. `npm run isolation` le vérifie sur un vrai projet Supabase. À faire avant d'ouvrir l'app à d'autres personnes,
puis après chaque changement de règles.

Le script connecte deux comptes de test, A et B. Le compte A tente ensuite douze requêtes qui doivent toutes être
refusées :

| # | Requête de A | Réponse attendue |
| - | ------------ | ---------------- |
| 1 | lire la ligne de B | une liste vide |
| 2 | lister toutes les lignes | sa propre ligne seulement |
| 3 | modifier la ligne de B | une liste vide (rien de modifié) |
| 4 | supprimer la ligne de B | une liste vide (rien de supprimé) |
| 5 | créer une ligne au nom de B | `403`, code `42501` (refus de la règle RLS) |
| 6 | écraser la ligne de B par fusion (upsert) | `403`, code `42501` |
| 7 | donner sa propre ligne à B | `403`, code `42501` |
| 8 | lire les clés d'assistant chiffrées | une liste vide |
| 9 | écrire une clé d'assistant, même la sienne | `403`, code `42501` |
| 10 | sans session : lire les lignes | une liste vide |
| 11 | sans session : modifier la ligne de A | une liste vide |
| 12 | lister les comptes (administration de Supabase Auth) | `403` |

Avant ces douze requêtes, un *montage* vérifie que le test peut réellement échouer : chaque compte crée sa ligne, y
inscrit une date propre à ce passage, puis la relit. Sans ce contrôle, une table absente ou des droits cassés pour tout
le monde produiraient douze « refus » qui ne prouvent rien. Après les douze, B relit sa ligne : une écriture passée
sans rien renvoyer se voit là, et la date unique la trahit même si la ligne a été supprimée puis recréée à l'identique.

Les écritures à refuser (5, 6, 7, 9) demandent `return=minimal`, comme le ferait un compte malveillant. Avec
`return=representation`, Postgres applique aussi la règle de *lecture* à la ligne renvoyée, et ce second refus
masquerait une règle d'écriture trop large. Le script a été essayé contre PostgreSQL 16 et PostgREST 12 avec les
règles de `schema.sql` : douze refus. Puis contre les mêmes, percées une à une : lecture ouverte, RLS désactivée,
`assistant_keys` ouverte, montage cassé. Chaque trou fait échouer le test.

**Où le lancer.** Sur un projet de *préproduction*, jamais sur celui de l'app : le script refuse l'adresse inscrite
dans `src/app/services/auth.js`. Il écrit en effet une date dans la ligne de A et, si la base fuit, dans celle de B,
ainsi qu'une fausse clé d'assistant pour A. Ces écritures n'ont rien à faire dans les données de quelqu'un.

1. **Créer le projet de préproduction.** Sur supabase.com : *New project* (l'offre gratuite suffit). Ouvrir ensuite
   *SQL Editor*, coller tout `supabase/schema.sql`, puis *Run*.
2. **Créer deux comptes de test.** *Authentication → Users → Add user → Create new user*, deux fois. Prendre des
   adresses qui ne servent qu'à ça et des mots de passe d'au moins 10 caractères. Laisser *Auto confirm user?* coché :
   aucun e-mail n'est envoyé.
3. **Relever l'adresse et la clé publique.** L'adresse est `https://<ref>.supabase.co`, où `<ref>` est l'identifiant
   qui suit `/project/` dans l'adresse du tableau de bord. La clé est dans *Project Settings → API Keys →
   Publishable key* (`sb_publishable_…`), la même sorte de clé que celle déjà publiée dans l'app.
4. **Écrire `.env.isolation`** à la racine du dépôt. Ce fichier est ignoré par git : les mots de passe ne partent ni
   dans le dépôt ni dans l'historique du terminal. Mettre une valeur entre guillemets si elle contient `#` ou une
   espace. Jamais la clé secrète (`sb_secret_…`, ou `service_role`) : elle passe outre les règles, et le script la
   refuse.

   ```sh
   ISOLATION_URL=https://<ref>.supabase.co
   ISOLATION_CLE=sb_publishable_…
   ISOLATION_A_EMAIL=…
   ISOLATION_A_MOT_DE_PASSE=…
   ISOLATION_B_EMAIL=…
   ISOLATION_B_MOT_DE_PASSE=…
   ```

5. **Lancer** `npm run isolation` (Node 22). Rien de secret ne s'affiche : ni mot de passe, ni jeton, ni adresse
   e-mail.

Ce que dit le code de sortie :

- **0** : douze refus, ligne de B intacte.
- **1** : une requête au moins a été *acceptée* (marquée `✗`), ou la ligne de B a changé. C'est une fuite : ne rien
  publier, et comparer les règles du projet à `supabase/schema.sql`.
- **2** : impossible de conclure. Le montage a échoué (connexion, table absente, droits cassés), ou une réponse est
  *douteuse* (marquée `?`). Par exemple, un `409` montre qu'une contrainte a arrêté l'écriture, pas la règle RLS.

**Le projet de l'app a-t-il les mêmes règles ?** Le test prouve l'étanchéité de la préproduction, et la production
n'est couverte que si ses règles sont identiques. Pour le vérifier, lancer cette lecture (elle ne modifie rien) dans
le *SQL Editor* des deux projets et comparer les deux résultats ligne à ligne :

```sql
select c.relname, c.relrowsecurity, p.policyname, p.cmd, p.roles, p.qual, p.with_check
from pg_class c left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1, 3;
```

Attendu : `relrowsecurity` vaut `true` pour chaque table. `app_state` a trois règles (*select*, *insert*, *update*),
chacune limitée à `auth.uid() = user_id`. `assistant_keys` n'en a aucune.

Les deux vérifications se complètent. Le script mesure ce qu'un compte obtient réellement par l'API. La requête SQL lit
les règles elles-mêmes, y compris une règle trop large que les autres masquent encore. Par exemple, une règle *update*
`with check (true)` ne laisse rien passer aujourd'hui, parce que la règle de lecture refuse aussi la ligne modifiée ;
elle cède dès que quelqu'un élargit la lecture.

## Politique de confidentialité

`confidentialite.html`, à la racine, publiée avec le site : <https://mariebonifacio.github.io/selene/confidentialite.html>.
C'est l'adresse à donner à l'App Store et à Google Play. Sa version anglaise, `privacy.html`
(<https://mariebonifacio.github.io/selene/privacy.html>), dit la même chose ; les Réglages lient celle de la langue de
l'interface. Elles doivent suivre le code : un nouveau service appelé, une nouvelle donnée gardée, et les deux changent
avec (`build.test.js` vérifie qu'elles ont les mêmes sections, les mêmes liens, la même date, et nomment chaque service).

Elle remplit l'article 13 du RGPD, et `build.test.js` le vérifie dans les deux langues :
- la responsable du traitement : Marie Bonifacio, personne physique ;
- une adresse de contact privée (jamais un ticket public) ;
- une base légale par usage : le contrat (6.1.b), le consentement explicite pour la santé synchronisée (9.2.a),
  le consentement pour la liste d'attente de la page de test (6.1.a), l'intérêt légitime pour la sécurité, le journal
  des erreurs et la mesure d'audience (6.1.f) ;
- les durées de conservation ;
- les transferts hors de l'Union ;
- le droit de réclamation auprès de la CNIL.

Ce qu'elle promet, et qu'il faut tenir à la main :

- **Sauvegardes : 30 jours au plus.** Les sauvegardes de l'offre Pro de Supabase (7 jours) le respectent. Une copie
  manuelle (`supabase db dump`) doit être effacée au bout de 30 jours, sinon une donnée supprimée y survit.
- **E-mails reçus à l'adresse de contact : un an au plus** après le dernier échange.
- **Journal des erreurs : 30 jours.** Le déclencheur de la table `erreurs` y veille seul.
- **Liste d'attente : un seul e-mail, à l'ouverture de la bêta, puis effacée** (deux ans au plus : le déclencheur de
  la table `attente` y veille). L'envoi et l'effacement sont à faire à la main ([essai.md](essai.md#écrire-aux-inscrits-puis-effacer)).
- **Mesure d'audience de la page de test : 13 mois.** Le déclencheur de la table `audience` y veille seul.
- **Réponse à une demande de droits sous un mois.** La demande doit venir de l'adresse du compte concerné (ou de
  l'adresse inscrite sur la liste d'attente).
- **La base reste à Paris** (eu-west-3). Un projet déplacé dans une autre région change la section « Hors de l'Union
  européenne ».

Elle change avec ce qui s'ajoute :
- **Brancher Brevo** (SMTP) : nommer Brevo parmi les services, puisque les e-mails du compte passent alors par lui.
- **Un statut d'entreprise** (micro-entreprise) : le nom commercial et le numéro SIREN remplacent « personne
  physique ».
- **Un nouveau service, une nouvelle donnée gardée** : les deux versions changent ensemble, avec une nouvelle date.

**L'accord de traitement des données (DPA) de Supabase** est à demander à <https://supabase.com/legal/dpa>. C'est le
contrat de sous-traitance que l'article 28 du RGPD exige entre la responsable du traitement et son hébergeur.
