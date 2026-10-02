# Polices

Les polices de Selene, servies par le site et les apps eux-mêmes : les afficher n'envoie l'adresse IP de personne
chez Google. `build.py` pose `polices.css` dans la page (site, apps) et copie ce dossier dans `dist/web` et
`dist/native`. L'artefact claude.ai, un seul fichier, garde Google Fonts.

| Famille | Faces | Licence |
|---|---|---|
| Cormorant Garamond | 500, 600, 500 italique | `OFL-cormorant-garamond.txt` |
| Spectral | 400, 500, 600, 400 italique | `OFL-spectral.txt` |
| Spectral SC | 500 | `OFL-spectral-sc.txt` |
| IBM Plex Sans | 400, 500, 600, 400 italique | `OFL-ibm-plex-sans.txt` |

Les mêmes faces que demandait la page à Google Fonts, chacune en deux jeux de caractères : latin et latin étendu
(`unicode-range` : le navigateur ne télécharge que ceux que le texte affiché demande). Toutes sous SIL Open Font
License 1.1, qui permet de les redistribuer avec leur licence.

Provenance : les paquets npm `@fontsource/cormorant-garamond`, `@fontsource/spectral`, `@fontsource/spectral-sc` et
`@fontsource/ibm-plex-sans`, version 5.3.0 (fichiers `files/<famille>-<jeu>-<graisse>-<style>.woff2`, et les
`unicode-range` de leurs feuilles `<graisse>.css`). Pour changer de version ou ajouter une face : `npm pack` du paquet,
copier les deux fichiers `latin` et `latin-ext` de la face ici, ajouter leurs deux règles à `polices.css`, puis
`npm run build`.
