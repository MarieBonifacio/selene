# Selene

Tableau de bord personnel : chantier de l'appartement, pratique de kundalini, écriture, october.moth, Phidippus, musique et capture rapide, sous la lune du jour et une lisière de sapins.

Aucune dépendance de production, aucun client vendorisé : le build hébergé (GitHub Pages) parle directement, via `fetch`, aux API REST de Supabase (Auth + PostgREST) pour les comptes multi-utilisateurs — voir « Comptes et synchronisation » plus bas. La source éditable est dans `src/` : `shell.html` (gabarit), `sync.js` (fusion à trois voies), `store.js` (persistance et synchronisation), `auth.js` (comptes Supabase, hébergé uniquement), `backup.js` (sauvegarde), `domain.js` (règles métier et registre pur des types de module), `app.js` (interface et orchestration), `types.js` (affichage de chaque type de module), `assistant.js` (Claude) et `boot.js` (démarrage). Ajouter un type de module = une entrée dans `MODULE_TYPES` (`domain.js`) et une dans `TYPE_UI` (`types.js`), rien d'autre. `python3 build.py` génère `selene.html` pour claude.ai et `index.html` pour GitHub Pages. Ne modifie pas directement les HTML générés.

Vérification locale (Node 22) : `python3 build.py --check`, `node --test tests/*.test.js`, puis l'analyse statique `python3 build.py --bundle .lint/selene.js && npx eslint@10.11.0 .lint/selene.js sw.js`. Fonctionnement interne, synchronisation et décisions d'architecture : [docs/architecture.md](docs/architecture.md).

## Publier avec GitHub Pages

1. Pousser ce dépôt sur GitHub.
2. Settings → Pages → Build and deployment → Source : « GitHub Actions ». Le workflow `pages.yml` publie alors `main` seulement si les vérifications (`check.yml`) passent, et seulement les fichiers du site.
3. Le site est servi à `https://<utilisateur>.github.io/<dépôt>/`.
4. Après une mise à jour, recharger l'app sur chaque appareil : une ancienne version restée ouverte ne connaît pas les règles de synchronisation récentes.

## Installer sur iPhone

1. Ouvrir l'adresse GitHub Pages dans **Safari** (pas un autre navigateur).
2. Bouton Partager → « Sur l'écran d'accueil ».
3. L'app s'ouvre en plein écran, fonctionne hors ligne (sauf l'assistant) et garde ses données sur l'appareil.

Les données de l'app installée sont séparées de celles de Safari : exporter depuis l'ancienne version, importer dans l'app.

## Modules

Un compte neuf part presque vide (une boîte de réception) : l'accueil propose des **modèles** (tâches, protocole, écriture, budget, tableau de production, liste « à découvrir », soins, carnet), à ajouter autant de fois qu'on veut. Ces modèles restent disponibles dans « + Créer un module », à côté des types vides.

Réglages → Modules : activer, renommer, réordonner, supprimer, et « + Créer un module ». Chaque module est une instance de l'un de ces types (l'exemple entre parenthèses est le module d'origine) ; seul l'Assistant est une fonction, activable, sans données propres.

  - *Programme* : un protocole de N semaines, un calendrier et un objectif de séances par semaine (ex. Kundalini) ;
  - *Objectif cumulatif* : un compteur vers un objectif, avec des catégories et, en option, un carnet de notes libres (ex. Écriture et ses fragments) ;
  - *Rappels* : des types d'événements récurrents avec une fréquence, et un journal (ex. Phidippus) ;
  - *Notes* : des textes datés. L'une des boîtes est la **boîte de réception** (Réglages → Réglages par module) : elle reçoit la capture rapide de l'accueil, et chaque note peut ensuite être rangée d'un geste dans tout module qui sait la recevoir (ex. la Capture) ;
  - *Tâches* : échéances, étapes, effort, coûts facultatifs, regroupées par pièce ou par lieu (le nom se règle) ; l'étoile « Aujourd'hui » est plafonnée à trois tâches **tous modules confondus**, et l'accueil les réunit (ex. le Chantier) ;
  - *Budget* : des opérations (dépenses, revenus), des enveloppes à plafond mensuel et leurs jauges, mois par mois (ex. le Budget) ;
  - *Collection* : des éléments à statuts (titre, sous-titre, étiquette, date, texte : chaque champ se renomme ou se masque), affichés en colonnes ou en liste filtrable (ex. october.moth en colonnes, Musique en liste).

Un module se supprime définitivement (✕, puis retaper son nom) : ses données partent avec lui, sur tous les appareils. Ses réglages propres sont dans Réglages → Réglages par module. Un nouveau module est partagé par défaut avec l'assistant ; décocher dans Réglages → Assistant pour le garder privé.

Pour ajouter un *type* de module au code, voir [docs/architecture.md](docs/architecture.md#ajouter-un-type-de-module).

## Assistant (Claude)

Le module Assistant est désactivé par défaut (Réglages → Modules).

- Sur claude.ai, il passe par ton compte : aucune clé à fournir.
- Hébergé (GitHub Pages), il appelle directement l'API Anthropic depuis le navigateur avec **ta propre clé**, saisie dans Réglages → Assistant. La clé reste dans le `localStorage` de ce navigateur : elle n'est jamais écrite dans le code, dans le dépôt ni dans les exports. Donne-lui une limite de dépense dans la console Anthropic.
- Réglages → Assistant permet de choisir le modèle, les modules que Claude peut lire, et s'il a le droit de modifier le tableau de bord.

## Données

Sur claude.ai, les données sont synchronisées entre appareils par la base de l'artifact, propre à ton compte claude.ai.

Hors de claude.ai (GitHub Pages), tant qu'aucun compte n'est configuré (voir ci-dessous), tout est gardé dans le `localStorage` du navigateur : propre à chaque appareil, effacé si l'on vide les données du site.

Pour passer d'une version à l'autre, ou avant de configurer les comptes : Réglages → Sauvegarde → Exporter, puis Importer sur l'autre.

## Comptes et synchronisation (GitHub Pages)

Le build hébergé peut proposer de vrais comptes (plusieurs personnes, données isolées les unes des autres) synchronisés sur tous les appareils, via [Supabase](https://supabase.com) (Postgres + Auth, offre gratuite suffisante pour cet usage). Tant que ce n'est pas configuré, `index.html` se comporte exactement comme avant (localStorage seul, pas d'écran de connexion).

Pour l'activer :

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL du projet, exécuter `supabase/schema.sql` (crée la table `app_state` avec les règles de sécurité RLS : chacun·e ne voit que sa propre ligne).
3. Dans Authentication → Providers → Email, décider si l'inscription reste ouverte à qui connaît l'URL du site (par défaut) ou si tu préfères la désactiver et inviter chaque personne toi-même (recommandé pour un cercle restreint) — le fichier `supabase/schema.sql` rappelle où ce réglage se trouve.
4. Récupérer l'URL du projet et la clé publique (« anon » / « publishable », Settings → API) et les renseigner dans `src/auth.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY` — cette clé est prévue pour être exposée côté client, la sécurité vient des règles RLS, pas du secret de la clé).
5. `python3 build.py`, puis republier `index.html`.

Une fois configuré, ouvrir `index.html` affiche un écran de connexion/inscription avant le tableau de bord.

Comment la synchronisation se comporte :

- Chaque modification part au bout d'une seconde ; les autres appareils la voient dans les 30 s (ou au retour sur l'onglet).
- Deux appareils modifiés en même temps, ou l'un hors ligne : les modifications sont **fusionnées**, pas écrasées. Une entrée supprimée d'un côté mais modifiée de l'autre est conservée.
- Hors ligne, l'app continue de fonctionner et affiche « Non synchronisé » ; tout part au retour du réseau. Une coupure ne déconnecte pas.
- Importer une sauvegarde remplace l'état du compte (sur tous les appareils), sans fusion.
- Se déconnecter envoie d'abord ce qui attend, puis efface de l'appareil les données, la conversation avec l'assistant et la clé API. Les données restent isolées par compte (RLS) ; l'artefact claude.ai (`selene.html`) n'est pas concerné et continue de fonctionner sans connexion (même code partagé, mais `auth.js` ne s'active que hors claude.ai).
