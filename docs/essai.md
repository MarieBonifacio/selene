# La page publique de test (E3)

`essai.html`, publiée avec le site : <https://mariebonifacio.github.io/selene/essai.html>. C'est l'expérience **E3**
de l'audit : savoir si la promesse de Selene attire des inconnus du public visé, avant d'investir davantage. La page
dit la promesse (« Garde tes fragments, tes sources et tes hypothèses reliés »), montre trois captures, annonce le
prix prévu, et propose deux gestes : **s'inscrire sur la liste d'attente** de la bêta, ou **essayer tout de suite,
sans compte** (l'app s'ouvre directement, sans écran d'entrée).

**Le seuil de l'audit** : au moins **10 % d'inscriptions** sur au moins **100 visiteurs qualifiés**. En dessous de
100 visiteurs, aucune conclusion : on ne lit pas l'avenir dans le marc de café. Les visiteurs « qualifiés » sont ceux
qui arrivent par une communauté du public visé (doctorants, chercheurs, essayistes, auteurs de long format), et non
par des amis : c'est le rôle du lien d'arrivée, plus bas.

## Ce que la page fait, et ne fait pas

- **Elle compte des ouvertures, pas des personnes.** Chaque ouverture (pas un rechargement, ni un retour en arrière)
  laisse une ligne dans la table `audience` : la date, la page, et le lien d'arrivée (`?src=`). Un clic sur
  « Essayer » aussi. Ni cookie, ni stockage sur l'appareil, ni adresse IP, ni identifiant : la mesure se passe de
  consentement parce qu'elle ne lit ni n'écrit rien sur l'appareil (article 82 de la loi Informatique et Libertés),
  et le taux calculé est prudent (une même personne qui revient compte deux fois au dénominateur).
- **La liste d'attente** écrit dans la table `attente` : l'adresse (en minuscules), le lien d'arrivée, et ce sur quoi
  la personne travaille si elle le dit (une thèse, un livre, des articles, autre chose). La case d'accord est
  obligatoire (consentement, article 6.1.a du RGPD).
- **Les deux tables s'écrivent avec la clé publique et ne se lisent que dans l'éditeur SQL.** Une adresse déjà
  inscrite est ignorée sans le dire (la page ne révèle pas qui est inscrit). Au-delà de 200 inscriptions ou de
  2 000 lignes d'audience par heure, le reste est ignoré : un robot peut gonfler les chiffres d'une heure, pas remplir
  la base. La liste se purge seule au-delà de deux ans, l'audience au-delà de 13 mois (`supabase/schema.sql`).
- **Sécurité de la page** : une CSP stricte, posée par `build.py` (`default-src 'none'`, son seul script et ses deux
  feuilles de style autorisés par leur empreinte, le projet Supabase seul en réseau). La politique de confidentialité
  a sa section « La page de présentation » ([confidentialite.html](../confidentialite.html#page-de-presentation)).

Les fichiers : `src/essai.html` (la page), `src/essai.js` (son script), `essai/*.jpg` (les captures, produites par
`npm run essai:captures` sur un espace de démonstration fictif), `scripts/essai-captures.mjs`. Le build écrit
`essai.html` à la racine (versionné, comme `index.html`) et le publie avec le site. Tests : `tests/build.test.js`
(CSP, fichiers, liens), `tests/browser/essai.js` (mesure, liste, rien sur l'appareil, « Essayer »).

## Mettre en place (une fois, dix minutes)

1. **Créer les deux tables** : dans le **SQL Editor** de Supabase, coller la partie « La page publique de test » de
   `supabase/schema.sql` (de `create table public.attente` jusqu'à la fin du fichier), puis **Run**. Sans elles, la
   page s'affiche, mais l'inscription répond « n'est pas partie » et rien n'est compté.
2. **Vérifier** sur un téléphone et un ordinateur : ouvrir
   `https://mariebonifacio.github.io/selene/essai.html?src=essai-perso`, s'inscrire avec sa propre adresse, puis
   lancer la requête « Lire les résultats » (plus bas) : une visite et une inscription sous `essai-perso`. Effacer
   ensuite ces lignes de test :

   ```sql
   delete from public.attente where source = 'essai-perso';
   delete from public.audience where source = 'essai-perso';
   ```

3. **L'aperçu des partages** : coller l'adresse de la page dans un message (Signal, Mastodon, Discord) : l'image et le
   titre doivent s'afficher. Si l'aperçu reste vide, attendre quelques minutes après le déploiement (les réseaux
   gardent une copie).

## Diffuser

Un lien par communauté, avec son étiquette (`src`, en minuscules, chiffres et tirets, 30 caractères au plus) : c'est
elle qui dit d'où viennent les visiteurs, et donc s'ils sont « qualifiés ».

```text
https://mariebonifacio.github.io/selene/essai.html?src=reddit-askacademia
https://mariebonifacio.github.io/selene/essai.html?src=mastodon-doctorants
https://mariebonifacio.github.io/selene/essai.html?src=forum-ecrivains
```

Trois à cinq communautés ciblées (l'audit, section 8) : forums et groupes de doctorants, réseaux d'écriture longue,
listes d'un laboratoire. Un message court, qui raconte le problème avant l'outil, et le lien ; jamais la même annonce
copiée partout. Noter, pour chaque étiquette, où et quand le lien a été posté : la requête ne le sait pas.

## Lire les résultats

Dans le **SQL Editor** (lecture seule) :

```sql
-- Par lien d'arrivée : ouvertures de la page, essais, inscriptions, taux d'inscription.
with v as (
  select source, count(*) filter (where evenement = 'visite') as visites, count(*) filter (where evenement = 'essai') as essais
  from public.audience where page = 'essai' group by source
), i as (
  select source, count(*) as inscriptions from public.attente group by source
)
select coalesce(nullif(source, ''), '(direct)') as source, coalesce(visites, 0) as visites, coalesce(essais, 0) as essais,
  coalesce(inscriptions, 0) as inscriptions, round(100.0 * coalesce(inscriptions, 0) / nullif(visites, 0), 1) as "inscrits %"
from v full join i using (source)
order by visites desc nulls last;
```

Sur quoi travaillent les inscrits :

```sql
select coalesce(nullif(projet, ''), '(non dit)') as projet, count(*) from public.attente group by 1 order by 2 desc;
```

**Lire avec prudence** : les ouvertures surestiment les personnes (le taux réel est plutôt meilleur) ; « (direct) »
mélange les amis, les liens recopiés sans étiquette et les robots ; un pic d'une heure à des centaines d'ouvertures
sans inscription est presque toujours un robot. La décision se prend sur les communautés ciblées, pas sur le total.

## Écrire aux inscrits, puis effacer

À l'ouverture de la bêta, **un seul e-mail**, comme promis : récupérer les adresses, les mettre en copie cachée (ou
dans l'outil d'envoi), puis effacer la liste, que la politique de confidentialité dit effacée après cet e-mail.

```sql
select email from public.attente order by at;   -- les adresses, à copier
delete from public.attente;                      -- après l'envoi
```

**Une demande d'effacement** (à `mariebonifacio.pro@gmail.com`, depuis l'adresse inscrite) : la traiter sous un mois.

```sql
delete from public.attente where email = lower('adresse@exemple.org');
```

## Changer la page

Le texte est dans `src/essai.html`, le comportement dans `src/essai.js` ; `npm run build` régénère `essai.html` et
ses empreintes. Un changement de ce que la page recueille change aussi la politique de confidentialité, dans les deux
langues, et la section « Combien de temps ». Les captures se refont par `npm run essai:captures` (puis versionner
`essai/`). Le prix affiché (29,99 € par an, ou 3,99 € par mois) est celui que l'audit recommande ; un autre prix se
change dans la page, sans rien d'autre à toucher.
