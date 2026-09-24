# Selene

Tableau de bord personnel : chantier de l'appartement, pratique de kundalini, écriture, october.moth, Phidippus, musique et capture rapide, sous la lune du jour et une lisière de sapins.

Un seul fichier, `index.html`, sans dépendance à installer ni étape de compilation.

## Publier avec GitHub Pages

1. Pousser ce dépôt sur GitHub.
2. Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Le site est servi à `https://<utilisateur>.github.io/<dépôt>/`.

## Données

Sur claude.ai, les données sont synchronisées entre appareils par la base de l'artifact.
Hors de claude.ai (GitHub Pages, fichier ouvert en local), cette base n'existe pas : tout est gardé dans le `localStorage` du navigateur, donc propre à chaque appareil et effacé si l'on vide les données du site.
