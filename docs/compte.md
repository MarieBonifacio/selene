# Le compte : suppression et confidentialité

L'App Store (règle 5.1.1(v)) et Google Play exigent qu'une app où l'on crée un compte permette de le **supprimer
depuis l'app**, et qu'elle publie une **politique de confidentialité**. Selene fait les deux.

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

## Politique de confidentialité

`confidentialite.html`, à la racine, publiée avec le site : <https://mariebonifacio.github.io/selene/confidentialite.html>.
C'est l'adresse à donner à l'App Store et à Google Play. Sa version anglaise, `privacy.html`
(<https://mariebonifacio.github.io/selene/privacy.html>), dit la même chose ; les Réglages lient celle de la langue de
l'interface. Elles doivent suivre le code : un nouveau service appelé, une nouvelle donnée gardée, et les deux changent
avec (`build.test.js` vérifie qu'elles ont les mêmes sections, les mêmes liens, la même date, et nomment chaque service).
