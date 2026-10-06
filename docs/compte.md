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

## Mesure d'usage (bêta)

Pour la bêta fermée (E4 de l'audit), il faut savoir combien d'invités saisissent quelque chose dès le premier jour, et
combien le font encore en semaine 4. Les seuils sont de **40 %** et de **25 %**. On compte des saisies, pas des
ouvertures. `src/app/services/activite.js` envoie une ligne **(compte, jour)** dans la table `activite`, et rien d'autre
: ni ce qui est écrit, ni l'heure, ni l'écran, ni l'appareil.

- **Une saisie** : un enregistrement que la personne a provoqué (un clic, une touche : l'activation utilisateur du
  navigateur) et qui change le contenu d'un espace (entrées, journal…). Changer un réglage ou créer un espace vide ne
  compte pas, pas plus qu'ouvrir l'app ou recevoir une synchronisation.
- **Une fois par jour et par chargement** : la page ne garde rien sur l'appareil pour s'en souvenir, et le serveur
  ignore un doublon. L'article 82 de la loi Informatique et Libertés (traceurs) ne s'applique donc pas. Le RGPD
  s'applique, sur l'intérêt légitime (article 6.1.f), avec un droit d'opposition : l'interrupteur de *Réglages →
  Compte*, qui vaut pour l'appareil.
- **Avec un compte seulement** (la session dit qui), jamais depuis l'artefact claude.ai. Sans compte, rien ne part.

Côté serveur (`supabase/schema.sql`), un compte écrit pour lui seul : le déclencheur impose l'identité de la session,
quoi que la page envoie. Personne ne lit la table par l'API. Le jour doit être aujourd'hui, à un jour près pour les
fuseaux horaires ; un doublon est ignoré en silence. Les lignes de plus de 90 jours sont effacées (assez pour lire les seuils d'une cohorte), et celles d'un compte
supprimé partent avec lui (`on delete cascade`). La table a été essayée contre PostgreSQL 16 et PostgREST, avec des
données synthétiques : 15 cas, dont l'usurpation d'un autre compte, la lecture, la modification, la purge et la
suppression du compte.

**Pour un projet existant**, coller dans l'éditeur SQL la partie « La mesure d'usage de la bêta » de
`supabase/schema.sql`. Tant que la table n'existe pas, l'app reçoit un 404 et rien n'est compté. **Lire les
seuils d'E4**, dans l'éditeur SQL. Sont comptés les comptes créés il y a au moins 28 jours, sauf le vôtre (marqué
`selene_personnel`, étape 2.5 de la liste de lancement) :

```sql
with c as (
  select u.id, u.created_at::date as j0 from auth.users u
  where not coalesce((u.raw_app_meta_data ->> 'selene_personnel')::boolean, false) and u.created_at <= now() - interval '28 days'
)
select count(*) as comptes,
  count(*) filter (where exists (select 1 from public.activite a where a.user_id = c.id and a.jour between c.j0 and c.j0 + 1)) as actifs_j1,
  count(*) filter (where exists (select 1 from public.activite a where a.user_id = c.id and a.jour between c.j0 + 21 and c.j0 + 27)) as actifs_s4
from c;
```

`actifs_j1 / comptes` doit atteindre 40 %, et `actifs_s4 / comptes` 25 %. À 15 invités, un compte pèse près de
7 points : lire les nombres, pas seulement les pourcentages. **Une demande d'effacement** (droit d'opposition, ou
d'effacement) se traite dans l'éditeur SQL :

```sql
delete from public.activite where user_id = (select id from auth.users where email = 'adresse@exemple.org');
```

**Dans le message d'invitation**, une phrase suffit : « Pendant la bêta, Selene compte les jours où tu l'utilises
(rien de ce que tu écris) ; tu peux le couper dans Réglages → Compte. »

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

**Chaque semaine, sans y penser.** Le workflow *Isolation* (`.github/workflows/isolation.yml`) rejoue le même test
chaque lundi, à chaque changement de `supabase/schema.sql` poussé sur `main`, et à la demande (*Actions → Isolation →
Run workflow*). Il lui faut les six valeurs de `.env.isolation`, en **secrets** du dépôt : *Settings → Secrets and
variables → Actions → New repository secret*, une fois par nom (`ISOLATION_URL`, `ISOLATION_CLE`, `ISOLATION_A_EMAIL`,
`ISOLATION_A_MOT_DE_PASSE`, `ISOLATION_B_EMAIL`, `ISOLATION_B_MOT_DE_PASSE`). Tant qu'ils manquent, la planification est
sautée avec un avis ; un lancement à la main échoue en le disant. Un run rouge (code 1 ou 2) est écrit par e-mail à la
personne qui a posé la planification ; ouvrir son journal : chaque requête acceptée y est marquée `✗`, chaque réponse
douteuse `?`. Les comptes de test et leurs mots de passe ne servent qu'à la préproduction : un secret qui fuirait
n'ouvrirait aucune donnée réelle.

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

## Sauvegarder la base

Sur l'offre gratuite, Supabase ne garde **aucune** sauvegarde de la base (T4 de l'audit, P1) : une fausse manœuvre dans
l'éditeur SQL, une migration ratée ou un incident chez l'hébergeur, et les espaces synchronisés de tous les comptes sont
perdus. Deux réponses, de la plus simple à la plus économe :

- **L'offre Pro** (25 $ par mois) : une sauvegarde par jour, gardée 7 jours, restaurable depuis le tableau de bord, et
  un projet qui ne se met plus en pause après une semaine sans visite. Recommandée **avant d'inviter les bêta-testeurs** :
  à partir de là, ce sont les données d'autres personnes.
- **D'ici là, le workflow *Sauvegarde*** (`.github/workflows/sauvegarde.yml`, `scripts/sauvegarde.sh`) : chaque lundi
  et à la demande, la CLI Supabase vide les rôles, le schéma et les données ; l'archive est chiffrée pour une clé publique
  [age](https://age-encryption.org) avant de quitter son dossier temporaire, puis déposée en artefact pour 30 jours. Le
  dépôt est public, ses artefacts téléchargeables par n'importe quel compte GitHub : seule la clé privée, gardée hors de
  GitHub, les ouvre. Le workflow ne fait que lire la base. Il reste utile avec l'offre Pro, comme copie hors de
  Supabase.

### Mettre en place (une fois, dix minutes)

1. **Une paire de clés age**, sur l'ordinateur de la personne qui administre Supabase (installer age : `brew install age`, `sudo apt install age`, ou
   `winget install FiloSottile.age`) :

   ```sh
   age-keygen -o selene-sauvegarde.key
   ```

   La commande affiche `Public key: age1…`. Le fichier `selene-sauvegarde.key` est la clé privée : le ranger dans un
   gestionnaire de mots de passe **et** sur un support hors ligne. Perdu, aucune sauvegarde ne s'ouvre plus ; copié par
   quelqu'un, toutes les sauvegardes se lisent. Il ne va jamais dans GitHub.
2. **GitHub** → *Settings* → *Secrets and variables* → *Actions* → onglet *Variables* → *New repository variable* :
   `SAUVEGARDE_CLE_AGE`, la clé **publique** (`age1…`). Le workflow refuse tout ce qui n'y ressemble pas, une clé privée
   comprise.
3. **Supabase** → *Connect* → *Session pooler* : copier l'adresse (`postgresql://postgres.<projet>:[YOUR-PASSWORD]@…`).
   Le *pooler*, pas la connexion directe : sur l'offre gratuite, celle-ci ne parle qu'IPv6, que les machines de GitHub
   n'ont pas. Remplacer `[YOUR-PASSWORD]` par le mot de passe de la base (*Database* → *Settings* → *Reset database
   password* s'il est perdu : Selene ne s'en sert nulle part ailleurs, l'app et les fonctions passent par les
   clés d'API). Puis, dans GitHub, onglet *Secrets* : `SUPABASE_DB_URL`, cette adresse.
4. **Un premier essai** : *Actions* → *Sauvegarde* → *Run workflow*. Le job dit le nom et la taille du fichier chiffré ;
   l'artefact `selene-base` apparaît en bas de la page du run. Puis l'exercice de restauration ci-dessous, une fois.

Sans ces deux réglages, le passage du lundi est sauté avec un avis, et un lancement à la main échoue en disant ce qui
manque. Un schéma vidé sans la table `app_state` fait échouer le job : ce n'est pas la base de Selene (mauvaise
adresse ?), et une sauvegarde vide ne doit pas passer pour une sauvegarde.

### Restaurer

À faire une fois, pour savoir que la sauvegarde sert à quelque chose ; puis, le jour d'un incident, de la même façon.
La cible est un **projet Supabase neuf et vide** : ni la production, ni la préproduction, dont les tables existent
déjà (la restauration recrée tout et s'arrêterait à la première). L'offre gratuite n'a que deux projets actifs : mettre
la préproduction en pause le temps de l'exercice, puis **supprimer le projet neuf**, qui contient les données réelles
de tous les comptes. Il faut `psql` (PostgreSQL 17 ou plus récent, comme le serveur) ; le cas
[TRV-017](recette/manuels/transverse.md#trv-017) du cahier de recette suit ces étapes.

```sh
age -d -i selene-sauvegarde.key selene-base-AAAA-MM-JJTHHMMZ.tar.gz.age | tar -xzf -
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<adresse Session pooler du projet neuf>"
```

Puis, dans le *SQL Editor* des deux projets, `select count(*) from app_state;` et `select count(*) from auth.users;` :
les mêmes nombres (au moment de la sauvegarde). Si `auth.users` est vide sur la copie, les comptes ne sont pas dans la
sauvegarde : les lignes d'`app_state` n'auraient plus de propriétaire, et la procédure est à revoir avant de compter
dessus. Effacer ensuite les fichiers déchiffrés (`roles.sql`, `schema.sql`, `data.sql`) : ils contiennent tout, en
clair.

### Ce qu'il faut savoir

- **Une semaine au plus** de modifications perdues, avec un passage par semaine. Avant une opération risquée (mise à jour
  de Postgres, changement de schéma), un *Run workflow* d'abord.
- **30 jours** : GitHub efface l'artefact seul, comme le promet la politique de confidentialité. Une archive téléchargée
  s'efface à la main au même terme, sinon une donnée supprimée y survit.
- **Un workflow planifié s'arrête** quand le dépôt public n'a eu aucune activité pendant 60 jours (GitHub prévient par
  e-mail) : le réactiver depuis l'onglet *Actions*.
- Ce n'est pas une sauvegarde à l'instant près : l'offre Pro, puis sa restauration à un instant donné (*PITR*, en
  option), y répondent.

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
  des erreurs, la mesure d'audience et la mesure d'usage de la bêta (6.1.f) ;
- les durées de conservation ;
- les transferts hors de l'Union ;
- le droit de réclamation auprès de la CNIL.

Ce qu'elle promet, et qu'il faut tenir à la main :

- **Sauvegardes : 30 jours au plus.** Les sauvegardes de l'offre Pro de Supabase (7 jours) et les artefacts du workflow
  *Sauvegarde* (30 jours, effacés par GitHub) le respectent. Une copie manuelle (`supabase db dump`, ou une archive
  téléchargée) doit être effacée au bout de 30 jours, sinon une donnée supprimée y survit
  ([plus haut](#sauvegarder-la-base)).
- **E-mails reçus à l'adresse de contact : un an au plus** après le dernier échange.
- **Journal des erreurs : 30 jours.** Le déclencheur de la table `erreurs` y veille seul.
- **Liste d'attente : un seul e-mail, à l'ouverture de la bêta, puis effacée** (deux ans au plus : le déclencheur de
  la table `attente` y veille). L'envoi et l'effacement sont à faire à la main ([essai.md](essai.md#écrire-aux-inscrits-puis-effacer)).
- **Mesure d'audience de la page de test : 13 mois.** Le déclencheur de la table `audience` y veille seul.
- **Mesure d'usage : 90 jours, jamais plus que le compte.** Le déclencheur de la table `activite` et la suppression du
  compte y veillent seuls ; une demande d'opposition ou d'effacement se traite à la main
  ([plus haut](#mesure-dusage-bêta)).
- **Réponse à une demande de droits sous un mois.** La demande doit venir de l'adresse du compte concerné (ou de
  l'adresse inscrite sur la liste d'attente).
- **Supprimer un compte sur demande, sous un mois** (la section « Supprimer ton compte » de la politique, l'adresse
  donnée à Google Play) : la demande vient de l'adresse du compte. Supabase → **Authentication → Users**, chercher
  l'adresse, **⋯ → Delete user**. Le tableau de bord (`app_state`), la clé d'assistant et la mesure d'usage partent
  avec lui (`on delete cascade`, `supabase/schema.sql`). Si l'adresse figure aussi sur la liste d'attente :
  `delete from public.attente where email = '…';` dans le **SQL Editor**. Puis répondre que c'est fait.
- **La base reste à Paris** (eu-west-3). Un projet déplacé dans une autre région change la section « Hors de l'Union
  européenne ».

Elle change avec ce qui s'ajoute :
- **Brancher Brevo** (SMTP) : nommer Brevo parmi les services, puisque les e-mails du compte passent alors par lui.
- **Un statut d'entreprise** (micro-entreprise) : le nom commercial et le numéro SIREN remplacent « personne
  physique ».
- **Un nouveau service, une nouvelle donnée gardée** : les deux versions changent ensemble, avec une nouvelle date.

**L'accord de traitement des données (DPA) de Supabase** est à demander à <https://supabase.com/legal/dpa>. C'est le
contrat de sous-traitance que l'article 28 du RGPD exige entre la responsable du traitement et son hébergeur.
