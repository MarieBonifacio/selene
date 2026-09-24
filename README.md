# Selene

Tableau de bord personnel : chantier de l'appartement, pratique de kundalini, écriture, october.moth, Phidippus, musique et capture rapide, sous la lune du jour et une lisière de sapins.

Aucune dépendance de production à installer. La source éditable est dans `src/` : `shell.html` (interface), `store.js` (persistance), `backup.js` (sauvegarde) et `app.js` (application). `python3 build.py` génère `selene.html` pour claude.ai et `index.html` pour GitHub Pages. Ne modifie pas directement les HTML générés.

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

Sur claude.ai, les données sont synchronisées entre appareils par la base de l'artifact.
Hors de claude.ai (GitHub Pages, fichier ouvert en local), cette base n'existe pas : tout est gardé dans le `localStorage` du navigateur, donc propre à chaque appareil et effacé si l'on vide les données du site.

Pour passer d'une version à l'autre : Réglages → Sauvegarde → Exporter, puis Importer sur l'autre.
