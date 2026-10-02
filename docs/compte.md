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
Users → *Invite user*) suit le même chemin : son lien demande de choisir le mot de passe du compte. C'est ce qui permet
de fermer les inscriptions publiques et d'inviter les comptes un par un.

À régler une fois dans le projet Supabase :

- *Authentication → URL Configuration* : **Site URL** = `https://mariebonifacio.github.io/selene/`, et la même adresse
  dans **Redirect URLs**. Le site demande à revenir sur la page ouverte (`redirect_to`) ; une adresse absente de la
  liste est ignorée au profit de la Site URL. Les apps n'en demandent pas : le lien s'ouvre dans le navigateur, sur le
  site, puis on se connecte dans l'app avec le nouveau mot de passe.
- *Authentication → Emails* : traduire les modèles *Reset password* et *Invite user*.
- L'envoi d'e-mails intégré à Supabase n'autorise que quelques messages par heure, pour tout le projet : brancher un
  SMTP (même page, *SMTP Settings*) avant d'ouvrir Selene à d'autres. Au-delà de la limite, Selene répond « Trop de
  demandes ».

## Politique de confidentialité

`confidentialite.html`, à la racine, publiée avec le site : <https://mariebonifacio.github.io/selene/confidentialite.html>.
C'est l'adresse à donner à l'App Store et à Google Play. Sa version anglaise, `privacy.html`
(<https://mariebonifacio.github.io/selene/privacy.html>), dit la même chose ; les Réglages lient celle de la langue de
l'interface. Elles doivent suivre le code : un nouveau service appelé, une nouvelle donnée gardée, et les deux changent
avec (`build.test.js` vérifie qu'elles ont les mêmes sections, les mêmes liens, la même date, et nomment chaque service).
