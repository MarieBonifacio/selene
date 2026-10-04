# L'assistant hébergé

Une fonction Supabase Edge (`supabase/functions/assistant`) qui garde la clé Anthropic de chaque compte et appelle
Claude pour lui. Sur claude.ai, l'assistant passe par ton compte claude.ai et n'en a pas besoin ; dans la version
hébergée, il n'existe qu'à travers elle.

## Ce qu'elle fait, et ce qu'elle refuse

- **La clé ne revient jamais dans la page.** Tu la colles une fois (Réglages → Assistant) ; la fonction la vérifie
  auprès d'Anthropic (la liste des modèles, un appel gratuit), la **chiffre** (AES-GCM, avec le secret
  `ASSISTANT_KEY_SECRET` ; l'identifiant du compte entre dans le chiffrement, si bien qu'une ligne copiée sous un
  autre compte ne se déchiffre pas) et la range dans la table `assistant_keys`. La page n'en reçoit que les quatre
  derniers caractères. Une faille de la page (XSS) ne peut donc plus la lire, et la CSP interdit de toute façon à
  la page de joindre `api.anthropic.com`.
- **Un relais étroit.** Pour chaque message, seuls le modèle (`claude-…`), `max_tokens` (4 096 au plus), la consigne,
  les messages (100 au plus) et les outils (32 au plus) partent vers Anthropic ; ni flux, ni en-tête, ni paramètre
  choisi par la page. 400 Ko par requête, 60 secondes par réponse, 60 messages par dizaine de minutes et par compte.
- **Chacun paie avec sa clé.** La fonction est ouverte à tout compte connecté, depuis une origine listée dans
  `ASSISTANT_ORIGINS` (par défaut le site publié). Donne à ta clé une limite de dépense dans la console Anthropic.
- **Muette.** Elle ne garde ni les questions ni les réponses. Supabase journalise les invocations (heure, durée,
  code), pas leur contenu.
- **Rien ne s'écrit sans ton accord** (T14 de l'audit). Quand l'assistant veut agir (ajouter une tâche, en terminer
  une, déposer une note, enregistrer une opération), une fenêtre dit ce qui serait écrit, en texte brut : « L'assistant
  voudrait déposer dans la boîte de réception : « … ». D'accord ? ». Un texte que l'assistant lit (une source, un flux,
  une note) peut contenir des consignes que le modèle prendrait pour les tiennes : c'est l'**injection indirecte**.
  Avec cette fenêtre, de telles consignes ne peuvent plus rien écrire en silence. Un refus revient au modèle (« Refusé
  par la personne : rien n'a été modifié. »). Les droits (module actif, actions permises) sont vérifiés avant de
  demander, puis de nouveau à l'exécution (`runTool`, `src/app/features/assistant.js` ;
  `tests/browser/assistant-accord.js`).

## Mettre en place (une fois)

1. **La table** : dans l'éditeur SQL de Supabase, exécute la fin de `supabase/schema.sql` (bloc `assistant_keys`).
   Aucune règle RLS ne l'ouvre : seule la fonction y accède, avec la clé serveur que Supabase lui fournit.
2. **Le secret de chiffrement** : `openssl rand -base64 32`, puis, dans le dépôt GitHub, *Settings → Secrets and
   variables → Actions → New repository secret* : `ASSISTANT_KEY_SECRET` = cette valeur. Garde-la aussi ailleurs
   (gestionnaire de mots de passe) : **la changer rend illisibles les clés déjà enregistrées** (chacun devra coller
   la sienne à nouveau).
3. **Déployer** : onglet *Actions* → *Assistant* → *Run workflow* (il utilise le même `SUPABASE_ACCESS_TOKEN` que
   le passeur, voir docs/passeur.md). Ensuite, chaque changement de la fonction sur `main` la redéploie ; si le
   jeton ou le secret manque, ce déploiement automatique est sauté avec un avis.
4. **Vérifier** : Réglages → Assistant → colle ta clé. « Clé vérifiée et enregistrée » : c'est en place.

À la main, depuis la racine du dépôt :
```sh
npx supabase secrets set ASSISTANT_KEY_SECRET=<32 octets en base64>
npx supabase functions deploy assistant --no-verify-jwt
```
`--no-verify-jwt` : comme le passeur, la fonction vérifie elle-même la session auprès de Supabase Auth.

Une ancienne version de Selene gardait la clé dans le navigateur : au premier lancement connecté, elle est confiée
à la fonction puis effacée de l'appareil.

## Couper

- Pour toi : Réglages → Assistant → « Oublier la clé » l'efface du serveur (sur tous tes appareils).
- Pour tout le monde : `npx supabase functions delete assistant`. L'assistant hébergé dit alors qu'il n'est pas
  déployé ; claude.ai n'est pas concerné.

## Tester

```sh
npm run test:functions
```

`assistant_test.ts` rejoue la fonction avec de faux Supabase Auth, PostgREST et Anthropic : origine, session,
secret absent, clé refusée puis acceptée, jamais en clair dans la base, champs filtrés, bornes, et une ligne copiée
sous un autre compte qui ne se déchiffre pas. La CI les lance à chaque PR (job `passeur`).
