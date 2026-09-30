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

## Politique de confidentialité

`confidentialite.html`, à la racine, publiée avec le site : <https://mariebonifacio.github.io/selene/confidentialite.html>.
C'est l'adresse à donner à l'App Store et à Google Play. Elle est liée depuis les Réglages. Elle doit suivre le code :
un nouveau service appelé, une nouvelle donnée gardée, et elle change avec.
