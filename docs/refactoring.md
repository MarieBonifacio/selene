# Plan de refactorisation

## Contraintes vérifiées

- `selene.html` doit rester un fichier autonome utilisable dans Claude.ai.
- `index.html` doit rester une PWA autonome sur GitHub Pages et hors ligne.
- Les clés `selene-board-v1` et `selene-site-v1`, le format `selene-v1` et la synchronisation de la base Claude restent compatibles.
- Aucun backend, compte utilisateur ou dépendance JS de production n'est nécessaire pour ce périmètre personnel.

## Étape 1 — livrée dans cette branche

La source éditable est désormais `src/shell.html`, `src/store.js`, `src/backup.js` et `src/app.js`. `python3 build.py` régénère les deux fichiers HTML publics ; `python3 build.py --check` vérifie leur synchronisation. Les exports v1 gardent le même format et l'import valide les collections et la configuration avant de remplacer l'état. Une CI vérifie le build, la syntaxe et les cas de sauvegarde critiques.

## Étape 2 — logique métier

Extraire progressivement les opérations Chantier, Budget et Capture de `src/app.js` en fonctions sans DOM. Faire appeler ces fonctions par les formulaires et les outils de l'assistant. Ajouter des tests de règles métier (plafond de trois tâches du jour, statut et date de fin, montants positifs). Mesurer la parité fonctionnelle dans les deux HTML avant chaque extraction.

## Étape 3 — persistance et migrations

Conserver les clés v1 pendant la transition. Introduire une interface de dépôt locale et une version de schéma interne ; migrer une copie des données vers IndexedDB uniquement après un test de rechargement et de restauration, puis garder un chemin de retour par export JSON. Vérifier les cas quota plein, fermeture pendant l'écriture et deux onglets ouverts. Ne jamais effacer les données v1 à la première migration.

## Étape 4 — assistant et rendu

Valider les arguments des outils avant mutation ; refuser les identifiants inconnus, dates impossibles et montants non finis. Faire dépendre les outils des fonctions métier. Revoir les chemins `innerHTML` et la CSP, puis décider si l'usage de clé API dans le navigateur est encore acceptable pour une diffusion hors usage personnel.

## Critères de validation avant fusion

1. Création d'une tâche → rechargement → export → import sur un autre contexte → contenu identique.
2. Import invalide → erreur visible et aucune donnée modifiée.
3. Claude.ai : connexion base, export et actions de l'assistant.
4. GitHub Pages : installation PWA, rechargement hors ligne et restauration après actualisation.

Les points 3 et 4 demandent un contrôle manuel dans les environnements concernés ; la CI ne simule pas la base Claude ni Safari iOS.
