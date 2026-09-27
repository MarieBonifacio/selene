# Selene

Tableau de bord personnel : chantier de l'appartement, pratique de kundalini, écriture, october.moth, Phidippus, musique et capture rapide, sous la lune du jour et une lisière de sapins.

Aucune dépendance de production, aucun client vendorisé : le build hébergé (GitHub Pages) parle directement, via `fetch`, aux API REST de Supabase (Auth + PostgREST) pour les comptes multi-utilisateurs — voir « Comptes et synchronisation » plus bas. La source éditable est dans `src/` : `shell.html` (interface), `store.js` (persistance), `auth.js` (comptes Supabase, hébergé uniquement), `backup.js` (sauvegarde), `domain.js` (règles métier) et `app.js` (interface et orchestration). `python3 build.py` génère `selene.html` pour claude.ai et `index.html` pour GitHub Pages. Ne modifie pas directement les HTML générés.

Vérification locale : `python3 build.py --check` puis `node --test tests/*.test.js` (Node 22). [Plan de refactorisation](docs/refactoring.md).

## Publier avec GitHub Pages

1. Pousser ce dépôt sur GitHub.
2. Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Le site est servi à `https://<utilisateur>.github.io/<dépôt>/`.

## Installer sur iPhone

1. Ouvrir l'adresse GitHub Pages dans **Safari** (pas un autre navigateur).
2. Bouton Partager → « Sur l'écran d'accueil ».
3. L'app s'ouvre en plein écran, fonctionne hors ligne (sauf l'assistant) et garde ses données sur l'appareil.

Les données de l'app installée sont séparées de celles de Safari : exporter depuis l'ancienne version, importer dans l'app.

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

Une fois configuré, ouvrir `index.html` affiche un écran de connexion/inscription avant le tableau de bord. Les données restent isolées par compte (RLS) ; l'artefact claude.ai (`selene.html`) n'est pas concerné et continue de fonctionner sans connexion (même code partagé, mais `auth.js` ne s'active que hors claude.ai).
