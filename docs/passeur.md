# Le passeur

Une fonction Supabase Edge (`supabase/functions/passeur`) qui va chercher, pour toi seule, ce que le navigateur n'a
pas le droit de lire lui-même. Les flux RSS, la plupart des pages et les calendriers n'envoient pas l'en-tête CORS
(`Access-Control-Allow-Origin`) : sans intermédiaire, la page de Selene ne peut pas lire leur réponse.

Il ne sert que la version hébergée (GitHub Pages), connectée à ton compte. Sans lui, Selene continue de marcher :
les pages passent par Microlink, et ce qui demande le passeur (Dehors, calendrier) le dit.

## Ce qu'il fait, et ce qu'il refuse

- **Une requête** : `POST { url, genre, etag?, modifie? }`, où `genre` vaut `feed` (flux), `page` ou `ics`
  (calendrier). Réponse : `{ status, url, type, etag, modifie, texte }`, ou `{ erreur }`.
- **Fermé.** Il faut une session Supabase valide (vérifiée auprès de Supabase Auth), d'un compte listé dans le secret
  `PASSEUR_USERS`, appelée depuis une origine listée dans `PASSEUR_ORIGINS`. Sans liste de comptes, il refuse tout
  (*fermé par défaut*). Un proxy ouvert est une porte que tout internet finit par trouver.
- **Protégé contre la SSRF** (*Server-Side Request Forgery* : faire appeler par le serveur une adresse qu'il est seul à
  joindre, comme les métadonnées du nuage en `169.254.169.254`). Seuls http et https sont acceptés, sur les ports
  usuels, sans identifiants dans l'adresse ni nom de réseau local. Toute IP, qu'elle soit écrite dans l'adresse
  (y compris déguisée : `2130706433`, `0x7f.1`, `[::ffff:10.0.0.1]`) ou obtenue par le DNS, doit être publique.
  Chaque redirection est revérifiée (4 au plus).
- **Sobre.** 2 Mo et 8 secondes au plus par requête, du texte seulement (jamais une image ou un binaire), 150 appels par
  dizaine de minutes. Il transmet l'`ETag` et la date `Last-Modified` : un site qui n'a pas changé répond « 304 »,
  sans contenu.
- **Muet.** Il ne garde rien : ni cache, ni journal des adresses demandées. Supabase journalise les invocations
  (heure, durée, code de réponse), pas leur contenu.

Risque résiduel, assumé : entre la vérification DNS et l'appel, un nom pourrait changer d'adresse (*DNS rebinding*).
Les fonctions tournent dans le nuage de Supabase, hors du réseau privé de ta base ; la fenêtre est de quelques
millisecondes, et l'adresse des métadonnées est de toute façon refusée à chaque saut.

## Déployer par GitHub Actions (recommandé)

Le workflow `.github/workflows/passeur.yml` déploie depuis les serveurs de GitHub : ton jeton ne passe ni par ton
terminal ni par une conversation. Il tourne à la demande (onglet Actions → Passeur → *Run workflow*) et à chaque
changement de la fonction sur `main`, après ses tests Deno.

1. **Un jeton Supabase** : [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) →
   *Generate new token* (nom : « selene-github »). Attention : un jeton personnel n'est **pas restreint**, il donne accès
   à tous tes projets Supabase. Il ne doit vivre qu'ici, et peut être révoqué juste après le déploiement (il faudra
   alors en recréer un pour redéployer).
2. **Dans le dépôt GitHub** : *Settings → Secrets and variables → Actions*.
   - onglet *Secrets* → *New repository secret* : `SUPABASE_ACCESS_TOKEN` = le jeton ;
   - onglet *Variables* → *New repository variable* : `PASSEUR_USERS` = ton identifiant (Réglages → Passeur → copier).
3. **Lancer** : onglet *Actions* → *Passeur* → *Run workflow* (ou demande à Claude de le déclencher).
4. **Vérifier** : Réglages → Passeur → « Vérifier ».

Les secrets d'un dépôt ne sont jamais montrés dans les journaux (GitHub les masque) ni transmis aux PR venues de forks.

## Déployer à la main (une fois, dix minutes)

Il faut Node.js (pour `npx`) et ton projet Supabase, celui de `SUPABASE_URL` dans `src/auth.js`.

1. **Se connecter et lier le projet** (la référence est le sous-domaine de `SUPABASE_URL`) :
   ```sh
   npx supabase login
   npx supabase link --project-ref pxnrzrmzritezftefdlj
   ```
2. **Dire qui a le droit** : dans Selene, Réglages → Passeur, copie ton identifiant, puis :
   ```sh
   npx supabase secrets set PASSEUR_USERS=<ton identifiant>
   ```
   Plusieurs comptes : séparés par des virgules. Si Selene n'est pas servie depuis `https://mariebonifacio.github.io`,
   ajoute `PASSEUR_ORIGINS=https://ton-origine` (sans chemin, séparées par des virgules).
3. **Déployer**, depuis la racine du dépôt :
   ```sh
   npx supabase functions deploy passeur --no-verify-jwt
   ```
   `--no-verify-jwt` coupe la vérification automatique de la passerelle, prévue pour les anciennes clés JWT : avec les
   nouvelles clés (`sb_publishable_…`), c'est la fonction qui vérifie ta session, en la présentant à Supabase Auth.
4. **Vérifier** : Réglages → Passeur → « Vérifier ». Le passeur lit la page de Selene elle-même et répond.

Coût : l'offre gratuite de Supabase compte 500 000 invocations par mois ; un usage personnel en fait quelques milliers.

## Couper

- Retirer un compte : `npx supabase secrets set PASSEUR_USERS=…` sans lui (ou vide : plus personne).
- Tout arrêter : `npx supabase functions delete passeur`. Selene revient à Microlink pour les pages.

Recommandé en plus (voir `supabase/schema.sql`) : fermer les inscriptions publiques et inviter les comptes.

## Tester

```sh
npx --yes deno@2.9.6 check supabase/functions/passeur/index.ts
npx --yes deno@2.9.6 test supabase/functions/passeur/
```

`garde_test.ts` éprouve les adresses qu'une SSRF essaierait ; `passeur_test.ts` rejoue le passeur de bout en bout avec
un faux réseau et un faux DNS : origine, session, compte, redirection vers les métadonnées, 2 Mo, 304. La CI les lance
à chaque poussée (job `passeur`).
