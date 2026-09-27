# Selene

Tableau de bord personnel : chantier de l'appartement, pratique de kundalini, écriture, october.moth, Phidippus, musique et capture rapide, sous la lune du jour et une lisière de sapins.

Aucune dépendance de production, aucun client vendorisé : le build hébergé (GitHub Pages) parle directement, via `fetch`, aux API REST de Supabase (Auth + PostgREST) pour les comptes multi-utilisateurs — voir « Comptes et synchronisation » plus bas. La source éditable est dans `src/` : `shell.html` (gabarit), `sync.js` (fusion à trois voies), `store.js` (persistance et synchronisation), `auth.js` (comptes Supabase, hébergé uniquement), `backup.js` (sauvegarde), `domain.js` (règles métier et registre pur des types de module), `app.js` (interface et orchestration), `types.js` (affichage de chaque type de module), `assistant.js` (Claude) et `boot.js` (démarrage). Ajouter un type de module = une entrée dans `MODULE_TYPES` (`domain.js`) et une dans `TYPE_UI` (`types.js`), rien d'autre. `python3 build.py` génère `selene.html` pour claude.ai et `index.html` pour GitHub Pages. Ne modifie pas directement les HTML générés.

Vérification locale (Node 22) : `python3 build.py --check`, `node --test tests/*.test.js`, puis l'analyse statique `python3 build.py --bundle .lint/selene.js && npx eslint@10.11.0 .lint/selene.js sw.js`, et les parcours dans un vrai navigateur `node tests/browser/run.js` (Playwright 1.56.1 et Chromium : `npm i --no-save playwright@1.56.1 && npx playwright install chromium` ; `node tests/browser/run.js budget` n'en lance qu'un). Fonctionnement interne, synchronisation et décisions d'architecture : [docs/architecture.md](docs/architecture.md).

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

## Au quotidien

- **Brouillons** : le texte en cours d'un champ libre (capture, note, fragment, observation, message à l'assistant) survit à la fermeture de l'app, sur cet appareil.
- **Annuler** : supprimer un élément affiche « Annuler » pendant quelques secondes, au lieu d'une confirmation.
- **Accueil** : « fait » sur un rappel en retard, « Noter N min » pour la séance du jour (dernière durée), éléments prévus ou en retard ; chaque ligne se déplie sur ses derniers éléments. Sur téléphone, le paysage se réduit à partir de la deuxième ouverture du jour.
- **Chercher** (touche « / » sur ordinateur) : dans tous les modules, sans tenir compte des accents.
- **Minuteur** : à la fin des 15 minutes, le module ouvert propose la suite (noter la séance, donner le nouveau total).
- **Écriture** : saisie du total atteint (l'app calcule la différence), dernier chapitre présélectionné, fin estimée au rythme des 30 derniers jours.
- **Tâches → Budget** : terminer une tâche qui a un coût propose de l'ajouter en dépense (enveloppe réglable).
- **Atelier d'écriture** : un fragment se rattache à un chapitre (le dernier utilisé par défaut), la liste se filtre par chapitre, et « Exporter en Markdown » assemble les fragments sous leurs chapitres.
- **Bilan** (lien sur l'accueil) : pour chaque module, ce qui s'est passé pendant le cycle lunaire en cours (d'une nouvelle lune à la suivante) ou le mois, à côté de la période précédente ; ‹ › pour remonter le temps. Une information, pas un score.
- **Capture qui comprend** trois motifs, et seulement trois : « 12 € courses » (une dépense), « 25 min kundalini » (une séance), « Phidippus : une note » (rangée dans le module nommé). La note part toujours d'abord dans la boîte de réception ; l'app propose seulement de la ranger (bandeau, puis bouton « Ranger » dans la boîte).

## Penser avec

- **Pont de reprise** : en haut de chaque module, « Je m'arrête ici… » note le prochain geste ; il s'affiche au retour dans le module et sur l'accueil, sous sa ligne. Le champ s'ouvre de lui-même à la fin du minuteur (l'ignorer suffit). « fait » le lève ; ce qui était prévu et ce qu'il en est advenu restent dans un court historique.
- **Statut épistémique** : un fragment ou une note peut se dire *observé*, *hypothèse*, *interprétation* ou *inexpliqué* (vide par défaut). Un « ? » en tête d'une saisie en fait une hypothèse. Chaque changement est daté ; « statut:hypothèse » dans la recherche filtre ; le bilan compte les idées de la période par statut.
- **Provenance** : une note rangée depuis une boîte disparaît, mais ce qui en naît (fragment, tâche, élément…) garde une copie de son texte, de sa date et de sa boîte d'origine (« ↳ de Capture, 3 sept. »). Rangée deux fois, elle garde sa première naissance.
- **Décisions** (modèle de module) : une collection dont la date est un rendez-vous de révision. Arrivée à échéance, une décision revient sur l'accueil quel que soit son état (sauf « Abandonnée ») : « relire » montre la raison écrite alors, « maintenue » note le réexamen et lève le rendez-vous. Réglable sur toute collection (« La date est un rendez-vous de révision »).

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
