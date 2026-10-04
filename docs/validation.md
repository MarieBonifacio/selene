# Valider Selene : le kit des expériences (E1 à E5)

Le plan de l'audit (section 8) teste cinq hypothèses en 90 jours, chacune avec un seuil **fixé avant** de regarder les
résultats. Ce document donne de quoi les mener : qui recruter, quoi dire, quoi noter, comment décider. Les outils
techniques sont ailleurs : la page publique de test dans [essai.md](essai.md), la mesure d'usage de la bêta dans
[compte.md](compte.md#mesure-dusage-bêta). Les cases à cocher sont dans [a-faire.md](a-faire.md).

L'ordre compte. E1 (le problème existe-t-il ?) et E3 (la promesse attire-t-elle ?) se mènent ensemble, dans les deux
premières semaines. E2 (le parcours tient-il ?) suit, avant d'inviter qui que ce soit. E4 (s'en sert-on encore au bout
d'un mois ?) puis E5 (paie-t-on ?) viennent ensuite. Une expérience sous son seuil n'est pas un échec : c'est une
information qui coûte moins cher maintenant qu'après six mois de développement.

**Le principe qui vaut pour toutes : parler de la vie des gens, pas de Selene.** On demande ce qui s'est passé, pas
ce qui se passerait. « Utiliseriez-vous… ? » obtient un oui poli et ne prédit rien. « La dernière fois que… » obtient
un fait. C'est la méthode du *Mom Test* (Rob Fitzpatrick, 2013) : même votre mère ne peut pas vous mentir si vous lui
demandez ce qu'elle a fait mardi.

## E1 : dix entretiens sur le problème

**L'hypothèse** : les personnes qui mènent un long projet documenté (une thèse, un essai, un livre) perdent
régulièrement la trace de leurs idées et de leurs sources, et ont déjà essayé d'y remédier. **Seuil** : au moins 6 sur
10 décrivent ce problème **sans y être amenées**. On note aussi combien paient déjà un outil.

**Qui.** Des doctorants en sciences humaines, des essayistes, des auteurs de long format. Ni amis, ni famille, ni
collègues proches : ils vous font plaisir, c'est leur défaut. Varier les disciplines et les âges ; écarter qui n'a pas
de projet en cours.

**Où recruter.** Les mêmes communautés qu'E3 (listes de doctorants, Mastodon, forums d'écriture, une école doctorale)
et le bouche-à-oreille au second degré : « connaîtriez-vous quelqu'un qui… ». Un message court :

> Bonjour, je prépare un outil pour les personnes qui écrivent un long texte documenté (thèse, essai, livre). Avant
> d'en écrire une ligne de plus, je cherche à comprendre comment vous travaillez vraiment. 45 minutes en visio, sur
> votre façon de garder vos idées et vos sources ; je ne vous vendrai rien et je ne vous montrerai rien avant la fin.
> En remerciement, un bon d'achat de 15 € (librairie). Intéressé·e ? Répondez simplement à ce message.

**Avant l'entretien.** Demander l'accord pour prendre des notes (et pour enregistrer, si vous enregistrez : un oui
explicite, sinon rien). Chaque personne reçoit un code (P1 à P10) ; les notes ne portent que ce code. Les adresses de
contact s'effacent une fois le bon d'achat envoyé : ce sont des données personnelles, et vous n'en avez plus besoin.

**Le guide (45 minutes).**

| Temps | Moment | Questions | À éviter |
|---|---|---|---|
| 2 min | Accueil | « Je cherche à comprendre, pas à vendre. Il n'y a pas de bonne réponse. » | présenter Selene |
| 5 min | Le projet | « Sur quoi travaillez-vous en ce moment ? Depuis quand ? Où en êtes-vous ? » | |
| 15 min | **Le dernier épisode réel** | « Racontez-moi la dernière fois que vous avez cherché une idée ou une source sans la retrouver. » Puis : « Qu'avez-vous fait ensuite ? Combien de temps ça a pris ? Comment ça s'est fini ? » | « Est-ce que ça vous arrive souvent ? » (on le saura par les faits) |
| 10 min | Les outils | « Où gardez-vous vos notes, vos sources, vos brouillons ? Montrez-moi, si vous voulez. Depuis quand ? Qu'est-ce qui vous agace ? Qu'avez-vous essayé et abandonné ? » | défendre ou critiquer un outil |
| 5 min | L'argent | « Payez-vous pour un de ces outils ? Combien, et qui paie ? » | « Combien paieriez-vous pour… ? » |
| 8 min | Clôture | « Qu'est-ce que je n'ai pas demandé et que j'aurais dû ? » Puis, seulement maintenant, si la personne le veut : une minute de Selene, et sa réaction. | |

**Juste après, la grille** (dix minutes, à chaud) :

| Code | Problème décrit sans y être amené (oui / non) | Fréquence citée | Outils actuels | Paie déjà (combien) | Contournement le plus parlant | Citation |
|---|---|---|---|---|---|---|
| P1 | | | | | | |

**Lire.** Compter les « oui » de la première colonne : 6 sur 10 au moins, sinon le problème est rare ou déjà résolu
(Obsidian et Zotero suffisent), et c'est le signal de rester un outil personnel. Relever les contournements : ils disent
ce que Selene doit battre. Vers la dixième, les mêmes réponses reviennent : c'est la saturation, l'échantillon suffit.

## E2 : tester le parcours, deux fois cinq personnes

**L'hypothèse** : le parcours central se fait sans aide. **Seuils** : au moins 80 % de réussite sans aide sur le
parcours, et moins de 2 minutes (médiane) avant le premier fragment. Cinq personnes révèlent l'essentiel des problèmes
fréquents ; on corrige, puis cinq autres vérifient que la correction tient.

**Le dispositif.** Une visio avec partage d'écran, sur l'appareil de la personne (le sien : c'est là qu'elle s'en
servirait). Le lien : `https://mariebonifacio.github.io/selene/index.html#sans-compte`, qui ouvre Selene sans compte et
sans rien écrire sur un serveur. Vous observez, vous ne guidez pas : si la personne bloque plus de deux minutes, vous
aidez, et la tâche compte comme « avec aide ».

**La consigne d'ouverture**, à lire telle quelle :

> Merci. Je teste Selene, pas vous : si quelque chose est difficile, c'est Selene qui a tort, et c'est exactement ce que
> je cherche. Pensez à voix haute : dites ce que vous cherchez, ce que vous croyez qu'il va se passer, ce qui vous
> surprend. Je vais peu parler. Vous pouvez arrêter quand vous voulez.

**Les tâches.**

| # | Tâche (lue à la personne) | Réussie quand |
|---|---|---|
| 1 | « Vous écrivez un long texte. Ouvrez Selene et installez-vous pour ce projet. » | l'accueil a reçu « Un long texte » (ou l'espace Écriture existe) |
| 2 | « Notez trois idées qui vous passent par la tête. » | trois fragments ou captures existent |
| 3 | « Ajoutez cet article comme source : 10.1016/j.concog.2020.102946. » | la source porte son titre et sa revue |
| 4 | « Reliez cette source à l'une de vos idées. » | un lien relie la source et le fragment |
| 5 | « Retrouvez l'idée qui parlait de [un mot de la personne]. » | le fragment est ouvert |
| 6 | « Préparez un dossier de votre projet, à envoyer à quelqu'un. » | le dossier est exporté |

**Ce qu'un robot a déjà vérifié.** Les six tâches se font sur téléphone, par le chemin le plus probable : ⊕ Capturer
pour noter, la feuille Espaces pour aller ailleurs, Chercher pour retrouver (`tests/browser/parcours-e2.js`, à chaque
modification de Selene). Les jouer a fait apparaître deux obstacles, corrigés avant vos testeurs. « documente… » était
rangé dans le menu « … » d'une source ; le message « Gardée » propose maintenant de la relier à une idée. Le dossier de
l'Écriture partait des seuls fragments, alors que les idées notées par ⊕ attendent dans la boîte ; l'Écriture vide mène
maintenant au tri. Le robot sait où cliquer : vos testeurs, non. C'est ce que le test mesure.

**Après chaque tâche, une question** (le SEQ, *Single Ease Question*) : « Dans l'ensemble, cette tâche était… », de
1 (très difficile) à 7 (très facile). Une moyenne sous 5 signale une tâche à revoir, même réussie.

**La grille**, une ligne par personne :

| Code | Premier fragment (min:s) | T1 | T2 | T3 | T4 | T5 | T6 | SEQ moyen | Où elle a hésité |
|---|---|---|---|---|---|---|---|---|---|
| E2-1 | | ✓ / aide / ✗ | | | | | | | |

**Lire.** Le taux de réussite sans aide, tâche par tâche et sur l'ensemble ; la médiane du temps avant le premier
fragment. Puis les problèmes, classés par fréquence (combien de personnes) et gravité (bloquant, gênant, cosmétique) :
corriger d'abord ce qui bloque plusieurs personnes. Me transmettre la liste suffit : je corrige avant la seconde vague.

## E3 : diffuser la page publique

Le mode d'emploi technique est dans [essai.md](essai.md) : un lien par communauté (`?src=…`), la lecture dans l'éditeur
SQL, le seuil de 10 % d'inscriptions sur 100 ouvertures ciblées. Restent les messages. Trois variantes, à adapter ; le
problème d'abord, l'outil ensuite, et jamais la même annonce copiée partout (les modérateurs le voient, les lecteurs
aussi).

**Un forum ou une liste de doctorants** :

> Combien de fois avez-vous cherché une citation, une idée notée en marge, une source « que vous aviez forcément
> lue » ? J'écris un carnet de recherche pour les longs projets : il garde fragments, sources et hypothèses reliés, sur
> votre appareil, sans compte. Il est encore en préparation ; la page dit ce qu'il fera et ce qu'il ne fera pas :
> [lien `?src=forum-…`]. Vos critiques m'intéressent plus que vos encouragements.

**Mastodon** (500 caractères) :

> Je prépare Selene, un carnet de recherche pour les longs projets d'écriture (thèse, essai, livre) : fragments,
> sources par DOI, hypothèses, tout relié et retrouvable, sur l'appareil d'abord. Gratuit sans compte ; une option
> payante pour synchroniser, plus tard. Si ça vous parle : [lien `?src=mastodon-…`] #doctorat #écriture

**Une liste de laboratoire** (par un ou une collègue qui relaie, de préférence) :

> Bonjour à toutes et à tous, une ancienne connaissance prépare un outil pour garder idées et sources reliées pendant
> la thèse ; elle cherche des retours avant d'aller plus loin. La page : [lien `?src=labo-…`]. Inscription facultative,
> un seul e-mail à l'ouverture de la bêta.

Noter, pour chaque étiquette, où, quand et par qui le lien a été posté : la base ne le sait pas, et c'est ce qui
distinguera un public qualifié d'un public d'amis.

## E4 : la bêta fermée, quatre semaines

**L'hypothèse** : une fois installé, Selene sert chaque semaine. **Seuils** : au moins 40 % des invités actifs le
premier jour, au moins 25 % en semaine 4, par des saisies et non des ouvertures. La table `activite` doit exister avant
la première invitation ([compte.md](compte.md#mesure-dusage-bêta)).

**Qui.** 15 à 30 personnes : des participants d'E1 et d'E2 qui l'ont demandé, puis des inscrits d'E3, inconnus de
préférence. Inviter par Authentication → Users → Invite user (les inscriptions restent fermées).

**L'invitation** (l'e-mail de Supabase dit seulement « Accepter l'invitation » ; ce message-ci part de votre adresse,
juste avant) :

> Bonjour, merci d'essayer Selene pendant quatre semaines. Vous allez recevoir un e-mail « Une invitation à Selene » :
> suivez le lien et choisissez votre mot de passe. Selene est un carnet pour un long projet d'écriture ; commencez par
> y noter trois idées et une source, c'est là qu'il devient utile.
>
> Deux choses à savoir. Pendant la bêta, Selene compte les jours où vous l'utilisez (rien de ce que vous écrivez) ;
> vous pouvez le couper dans Réglages → Compte. Et tout ce qui vous agace m'intéresse : répondez simplement à cet
> e-mail. La politique de confidentialité : https://mariebonifacio.github.io/selene/confidentialite.html

**En semaine 2**, un message court : « Qu'avez-vous fait avec Selene cette semaine ? Qu'est-ce qui vous a manqué ? »
Les réponses comptent plus que leur nombre.

**En semaine 4**, trois questions, et la troisième est la plus importante :

1. « Qu'avez-vous fait avec Selene cette semaine ? »
2. « Qu'est-ce qui vous a empêché de vous en servir davantage ? »
3. « Si Selene disparaissait demain, seriez-vous : très déçu·e, un peu déçu·e, pas déçu·e ? »

La troisième est le test de Sean Ellis : au-delà de 40 % de « très déçu·e » parmi les personnes actives, un produit
a trouvé son public. En dessous, il manque quelque chose que les réponses à la deuxième question disent souvent.

**Lire** les seuils avec la requête de [compte.md](compte.md#mesure-dusage-bêta), quatre semaines après les premières
invitations. À 15 invités, une personne pèse près de 7 points : lire les nombres, pas seulement les pourcentages.

## E5 : la prévente « membre fondateur »

**L'hypothèse** : des inconnus paient avant la sortie. **Seuil** : au moins 10 préventes payées, dont la moitié par
des personnes que vous ne connaissiez pas. L'offre de l'audit : 24,99 € pour un an de Selene+, remis au lancement par
un code d'offre des stores, remboursable sans condition jusqu'au lancement.

**Avant de vendre quoi que ce soit** (rien de cela ne se fait dans le code) : créer la micro-entreprise ; écrire les
conditions générales de vente (prix, ce qui est vendu, date de livraison prévue, remboursement, droit de rétractation,
médiateur de la consommation) et les mentions légales (nom, SIREN, adresse) ; ouvrir un compte Stripe et créer un lien
de paiement. Une relecture par un juriste est recommandée avant la première vente. Ensuite, je peux ajouter l'offre à la
page publique et l'annoncer aux bêta-testeurs et à la liste d'attente.

## Le journal des décisions

Une ligne par expérience terminée, écrite **avant** de passer à la suivante, avec le seuil fixé au départ. C'est ce
journal qui servira au jour 90 ([a-faire.md](a-faire.md), critères de décision de l'audit, section 8).

| Date | Expérience | Résultat | Seuil | Décision |
|---|---|---|---|---|
| | E1 | … sur 10 décrivent le problème sans y être amenés ; … paient déjà | ≥ 6/10 | |
| | E3 | … inscriptions sur … ouvertures ciblées | ≥ 10 % sur ≥ 100 | |
| | E2 (1) | … % de réussite sans aide ; premier fragment en … | ≥ 80 % ; < 2 min | |
| | E2 (2) | | | |
| | E4 | … actifs au jour 1, … en semaine 4, sur … invités | ≥ 40 % ; ≥ 25 % | |
| | E5 | … préventes payées, dont … par des inconnus | ≥ 10, la moitié d'inconnus | |
