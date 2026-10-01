# Publier Selene

Tout ce qui peut être automatisé l'est : **pousser une étiquette `v1.2.3` construit, signe et publie** (workflow
*Publication*, `.github/workflows/release.yml`). Ce qui reste, ce sont les comptes, les clés et les formulaires des
stores : des démarches qu'aucun robot ne peut faire à ta place, et c'est heureux.

```sh
git tag v1.0.0 && git push origin v1.0.0
```

| Plateforme | Ce que fait le workflow | Secrets nécessaires (sinon, sauté avec un avis) |
|---|---|---|
| Android | APK signé (installation directe, joint à la Release) et AAB signé (Google Play, en artefact) | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| Windows | installateur NSIS joint à la Release, signé si un certificat est fourni | facultatifs : `WINDOWS_CERTIFICATE_BASE64`, `WINDOWS_CERTIFICATE_PASSWORD` |
| iOS | archive signée, envoyée à TestFlight | `IOS_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8` |

La version vient de l'étiquette : `1.2.3` partout, et un numéro de build croissant (`10203`) que les deux stores
exigent. Lancé à la main (Actions → Publication → Run workflow, avec une version), il construit et signe sans créer
de Release : utile pour un essai.

Les secrets se posent dans GitHub : Settings → Secrets and variables → Actions → New repository secret.

## Android : Google Play

1. **La clé d'envoi**, une fois, sur ton ordinateur (Java installé) :
   ```sh
   keytool -genkeypair -keystore selene-upload.jks -alias selene -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 selene-upload.jks   # macOS : base64 -i selene-upload.jks
   ```
   Le résultat du `base64` va dans `ANDROID_KEYSTORE_BASE64` ; les deux mots de passe et l'alias (`selene`) dans les
   trois autres secrets. **Garde le fichier `.jks` et ses mots de passe hors du dépôt, en deux endroits sûrs.** Avec
   la signature des apps par Google Play (activée par défaut), une clé d'envoi perdue se remplace, mais c'est une
   démarche.
2. **Le compte** : [Play Console](https://play.google.com/console), 25 $ une fois. Un compte personnel récent doit
   faire tester l'app en test fermé (12 testeurs, 14 jours) avant la production.
3. **L'app** : Créer une application (« Selene », gratuite, application). Le nom de paquet est
   `io.github.mariebonifacio.selene` : il ne changera plus jamais.
4. **Le premier AAB** s'envoie à la main : pousser l'étiquette, récupérer `selene-1.0.0.aab` dans les artefacts de la
   course *Publication*, et le déposer dans Tests → Test interne.
5. **Les formulaires** (Contenu de l'application) :
   - Politique de confidentialité : `https://mariebonifacio.github.io/selene/confidentialite.html` (en anglais :
     `https://mariebonifacio.github.io/selene/privacy.html`, pour une fiche anglaise) ;
   - Sécurité des données : collecte l'adresse e-mail (gestion du compte) et le contenu créé (fonctionnement de
     l'app), et la position approximative (le lieu du ciel, arrondi à ~10 km, facultatif : fonctionnalité de l'app),
     liés au compte, non partagés, chiffrés en transit, supprimables par l'utilisateur (dans l'app) ;
   - Suppression du compte : dans l'app (Réglages → Compte), et l'adresse de la politique pour la demander ;
   - Publicités : non. Public cible : adultes. Questionnaire de classification : aucun contenu sensible.
6. **La fiche** : description, icône 512 px (`icon-512.png`), image de présentation 1024 × 500, au moins deux captures
   d'écran de téléphone : `npm run screenshots` (ou Actions → Captures → Run workflow, polices comprises) les produit
   dans `dist/store/android/`, en 1080 × 1920, sur un espace de démonstration fictif.

## iOS : App Store

1. **Le compte** : [Apple Developer Program](https://developer.apple.com/programs/), 99 $ par an. Ton identifiant
   d'équipe (Team ID, 10 caractères, dans Membership) va dans `IOS_TEAM_ID`.
2. **L'identifiant de l'app** : Certificates, Identifiers & Profiles → Identifiers → `io.github.mariebonifacio.selene`
   (aucune capacité particulière à cocher).
3. **L'app dans App Store Connect** : Apps → + → Nouvelle app, avec cet identifiant.
4. **La clé d'API** : App Store Connect → Utilisateurs et accès → Intégrations → Clés d'API de l'App Store Connect →
   générer une clé avec le rôle **Admin** (la signature automatique crée elle-même le certificat de distribution et le
   profil). Son identifiant va dans `APPSTORE_KEY_ID`, l'identifiant de l'émetteur dans `APPSTORE_ISSUER_ID`, le
   contenu du fichier `.p8` (téléchargeable une seule fois) dans `APPSTORE_KEY_P8`.
5. **TestFlight** : après l'envoi, la version apparaît dans TestFlight (quelques minutes de traitement) ; l'installer
   par l'app TestFlight sur l'iPhone.
6. **Les formulaires** : Confidentialité de l'app (mêmes réponses que pour Google Play : e-mail, contenu et position
   approximative, liés à l'identité, pas de suivi), adresse de la politique, catégorie Productivité, captures d'écran 6,9 pouces
   (`dist/store/ios/`, 1320 × 2868, par la même commande).

Ce chemin n'a pas pu être essayé sans compte Apple : la première course dira s'il manque quelque chose.

## Windows

Sans certificat, l'installateur marche, mais SmartScreen avertit (« Windows a protégé votre ordinateur ») jusqu'à ce
que l'installateur ait acquis une réputation. Un certificat de signature de code (OV, quelques centaines d'euros par
an, ou Azure Trusted Signing, quelques euros par mois mais réservé à certaines entités) supprime cet avertissement
plus vite. Un certificat `.pfx` : son contenu en base64 dans `WINDOWS_CERTIFICATE_BASE64`, son mot de passe dans
`WINDOWS_CERTIFICATE_PASSWORD`. Le Microsoft Store est une autre voie, gratuite pour un particulier, qui signe lui-même.

## À chaque version

1. Vérifier que `confidentialite.html` et `privacy.html` disent toujours vrai, et la même chose (le test de
   `build.test.js` le vérifie pour les services, les sections, les liens et la date).
2. `git tag v1.2.3 && git push origin v1.2.3`.
3. Google Play : promouvoir l'AAB (artefact de la course) du test interne vers la production.
4. App Store : soumettre la version TestFlight à la vérification.
