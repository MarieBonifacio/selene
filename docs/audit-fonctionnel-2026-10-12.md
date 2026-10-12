# Audit fonctionnel et diagnostic des couleurs (12 octobre 2026)

Commit examiné : `0d22363f05e0e6932c5b629127c498c65ef0b30f` (`main` et `claude/lucid-hawking-t99f2a`, identiques au
12 octobre 2026 ; c'est aussi le commit de référence du 10 octobre). Une PR est ouverte,
[MarieBonifacio/selene#160](https://github.com/MarieBonifacio/selene/pull/160) (RGPD, `a-faire.md`, `backlog.md`). Elle
ne touche ni le code ni les fonctions étudiées ici.

Ce document **ne modifie aucun code**. Le correctif des couleurs est un **plan**, à valider avant d'écrire la moindre
ligne. Les nouveaux modules ne sont pas développés. Ce qui a été lu, exécuté, observé ou laissé non vérifié est récapitulé
en [H](#h-traçabilité).

Conventions :

- **[O]** : fait observé, dans le code (`fichier:ligne`) ou dans un navigateur piloté.
- **[H]** : hypothèse ou jugement produit, à confirmer par l'usage.
- Mesures faites sous Chromium 141 (Playwright), avec le jeu d'essai du cahier (`docs/recette/donnees/jeu-essai.json`) :
  - « bureau » : 1280 × 800 ;
  - « téléphone » : émulation d'un iPhone 13 (390 × 844, tactile, échelle 3). **Une émulation ne remplace pas un vrai
    iPhone.**

---

## A. Diagnostic des couleurs

### A.1 Reproduction

**Signalement** : « Le changement de couleurs dans les réglages ne fonctionne pas. »

**Parcours rejoué avec les vrais contrôles** : Réglages → I. Apparence et rythme → Palette, puis un clic (bureau) ou un
toucher (téléphone) sur chacun des quatre boutons. On passe ensuite par l'accueil et par quatre espaces :
- Yoga : Programme, sans domaine ;
- Chantier : Tâches, domaine « Maison » ;
- Tableau : Collection, domaine « Création » ;
- Écriture : Cumul, domaine « Création ».

**Attendu** : d'après NAV-010, étape 1, « l'accent passe au rouge amanite partout, aussitôt ». D'après l'infobulle
(`src/app/views/reglages-aide.js:20`), « Seul l'accent change ».

**Observé** : techniquement, la chaîne fonctionne de bout en bout. **Visuellement, presque rien ne change**, et sur
certains écrans rien du tout. Le réglage est fonctionnel, mais il est imperceptible et ne dit pas ce qu'il fait. Pour
la personne qui clique, cela revient au même que s'il ne marchait pas.

### A.2 Les sept vérifications demandées

| # | Vérification | Méthode | Résultat |
|---|---|---|---|
| 1 | Le clic ou le toucher est reçu | `page.click` (bureau), `page.tap` (téléphone) sur `[data-act="pal"]` | **[O]** Reçu sur les quatre palettes, les deux appareils. Le bouton passe à `.on`. |
| 2 | La valeur en mémoire | `S().config.palette` puis `site.save()` (`reglages.js:240`) ; lecture de la copie enregistrée | **[O]** `config.palette` vaut la palette choisie dans `selene-site-v1`. |
| 3 | L'attribut du document | `document.documentElement.dataset.palette`, posé par `applyTheme()` (`src/app/shell/render.js:24-31`) | **[O]** `nigredo`, `albedo`, `citrinitas` ou `rubedo`, aussitôt, sans rechargement. |
| 4 | Les couleurs calculées de composants visibles | Relevé de toutes les couleurs calculées (pseudo-éléments compris) des éléments visibles, avant et après ; comparaison de captures | **[O]** Elles changent, mais sur très peu de composants (A.3). |
| 5 | Conservation | Navigation (Bilan), rechargement, nouvel onglet du même profil, sur bureau et téléphone | **[O]** Conservée partout (`citrinitas` relu après chaque étape ; pastille du téléphone `rgb(131, 99, 26)` après rechargement et dans un nouvel onglet). |
| 6 | Réécriture par la synchronisation | Fusion à trois voies `mergeDocs` (`src/core/sync.js:53-57`) appelée sur trois cas, sans réseau | **[O]** Un appareil qui change la palette pendant qu'un autre modifie autre chose : la palette est gardée. Deux changements concurrents : le plus récent gagne. **Un appareil utilisé sans compte qui rejoint un compte : la palette du compte l'emporte**, voulu par CPT-005 (`store.js:132-136`). C'est le seul cas où un choix « revient en arrière ». |
| 7 | Version publiée, cache PWA | Workflow Pages du commit `0d22363` ; lecture de `sw.js` | **[O]** Déployé le 8 octobre 2026 ([run 179](https://github.com/MarieBonifacio/selene/actions/runs/37709510988)), CI verte sous Chromium, **WebKit** et Firefox. Le service worker sert la page « réseau d'abord » (`sw.js:12-17`) : une ancienne version ne s'affiche que hors ligne. Le code de la palette n'a pas changé récemment. **Non lu directement** : le site publié, injoignable depuis ce conteneur (le mandataire répond 403). |

Les quatre modes, mesurés sur la bordure de `.swatch.on`, pour chaque palette **[O]** :

| Mode | `data-mode` | Accent obtenu (Nigredo / Albedo / Citrinitas / Rubedo) |
|---|---|---|
| Suivre l'appareil, appareil clair | aucun (média) | `#3d6a45` / `#5a6a5c` / `#83631a` / `#973a30` |
| Suivre l'appareil, appareil sombre | aucun (média) | `#8fbf86` / `#bccab8` / `#d4a94c` / `#d56455` |
| Toujours clair, appareil sombre | `light` | valeurs claires |
| Toujours sombre, appareil clair | `dark` | valeurs sombres |
| Suivre le soleil, 14 h à Paris | `light` | valeurs claires |
| Suivre le soleil, 22 h à Paris | `dark` | valeurs sombres |

### A.3 Mesures : ce qui change vraiment à l'écran

**Part des pixels qui changent entre Nigredo et une autre palette** (bruit entre deux captures identiques : 0 %) **[O]**

| Écran | Bureau clair (Albedo · Citrinitas · Rubedo) | Bureau sombre (Rubedo) | Téléphone clair (Albedo · Citrinitas · Rubedo) |
|---|---|---|---|
| Réglages (là où l'on clique) | 0,16 · 0,18 · 0,19 % | 0,19 % | 0,68 · 0,71 · 0,72 % |
| Accueil | 0,32 · 0,34 · 0,35 % | 0,35 % | 0,07 · 0,08 · 0,08 % |
| Yoga (Programme, sans domaine) | 1,68 · 1,73 · 1,74 % | 1,74 % | 5,19 · 5,24 · 5,25 % |
| Chantier (Tâches, domaine) | **0,00 (14 pixels)** · 0,02 · 0,02 % | 0,02 % | 0,07 · 0,08 · 0,08 % |
| Écriture (Cumul, domaine) | 0,35 · 0,37 · 0,38 % | 0,38 % | 1,26 · 1,28 · 1,28 % |

**Composants qui changent, de Nigredo à Rubedo** (relevé des couleurs calculées ; `accent-color` hérité n'est compté que
pour les cases à cocher) **[O]**

- **Réglages, téléphone : deux composants**, plus le bouton choisi.
  - le point de 4 px sous l'onglet « Espaces » ;
  - la pastille « 6 à trier » (16 × 16 px) ;
  - le liseré du bouton de palette sélectionné.
- **Réglages, bureau** :
  - le liseré du bouton choisi ;
  - le filet gauche du sommaire (« I Apparence et rythme ») ;
  - les sigils (18 px) des quatre espaces **sans domaine** (Boîte, Yoga, Musique, Carnet).
- **Accueil** :
  - sur bureau : le bouton « Garder » de la capture (`.btn.acc`), le filet de l'onglet actif et ces sigils ;
  - sur téléphone : le point de 4 px de l'onglet actif et la pastille. Le cercle du minuteur (`.halo`) change aussi,
    mais il est invisible tant que le minuteur ne tourne pas (`stroke-dashoffset` plein).
- **Yoga** (le cas le plus visible) : bouton « Noter une séance », jauge `.bar`, jours notés du calendrier (`.cal i.on`),
  sigil.
- **Chantier** : rien de perceptible.
  - Les cases « fait » changent d'`accent-color`, mais seulement une fois cochées.
  - Le bouton principal « Ajouter une tâche » est `.btn.solid`, à l'encre (`taches.js:125`).
  - Le filet et le sigil de l'espace prennent la teinte de domaine (`.t1`…`.t7`, `src/shell.html:220,226`).

Captures comparées, avec en rouge les pixels qui changent (fichiers de session, non versionnés) :
`preuve-telephone-reglages.png`, `preuve-telephone-accueil.png`, `preuve-bureau-chantier-albedo.png`.

**Pourquoi si peu de surface** **[O]**

- Sur 243 boutons écrits dans `src/`, 21 sont `.btn.acc` (fond d'accent) et 3 sont `.btn.solid` (encre). Les 219 autres
  sont des `.btn` à bordure d'encre ou des boutons « fantômes ».
- L'accent n'est utilisé que pour des filets de 2 px, des points de 4 px, des pastilles, des jauges, le focus clavier et
  la surbrillance de recherche (`src/shell.html`, 55 emplois de `var(--accent)`).
- Les espaces rangés dans un domaine prennent leur **teinte de domaine** à la place de l'accent : neuf espaces sur treize
  dans le jeu d'essai. Ce choix est voulu et documenté (ESP-005, commentaire de `shell.html:20`). Effet pervers : plus la
  personne range ses espaces par domaines, moins elle voit sa palette. L'ordre est puni.

### A.4 Distances perceptuelles, contraste, aperçu

ΔE2000 = distance perceptuelle entre deux couleurs. Sous 2 environ, l'œil ne voit pas de différence ; vers 10, les
deux couleurs sont nettement distinctes, mais encore apparentées. Valeurs calculées à partir des couleurs mesurées **[O]**.

| Palette (clair) | Contraste sur le fond, et du texte `.btn.acc` | Couleur d'état ou teinte la plus proche | Pastille d'aperçu contre la couleur appliquée |
|---|---|---|---|
| Nigredo `#3d6a45` | 4,96:1 | teinte 7 (ΔE 9,5), « ok » (9,7) | `#6f9a68`, ΔE 18,9 |
| Albedo `#5a6a5c` | 4,55:1 | **teinte 1 (ΔE 0 : identique)**, **`--muted` (ΔE 1,4)** | `#aab7a6`, ΔE 27,1 |
| Citrinitas `#83631a` | **4,41:1 (sous 4,5)** | **`--warn` (ΔE 3,3)** | `#c99a3c`, ΔE 21,5 |
| Rubedo `#973a30` | 5,60:1 | `--alarm` (ΔE 8,5) | `#c0554a`, ΔE 11,4 |

En sombre : Citrinitas reste à ΔE 2,7 de `--warn`, Rubedo à 7,1 de `--alarm`, Albedo à 4,9 de la teinte 1.

Entre palettes, en clair : Nigredo et Albedo ne sont qu'à **ΔE 10,8**. Les trois autres paires sont au-delà de 22.

Ce que ces chiffres veulent dire :

1. **Albedo** est le gris des textes secondaires. En clair, un élément « accentué » est indiscernable d'un texte atténué
   et d'un espace de teinte 1.
2. **Citrinitas** a la couleur des avertissements. Le commentaire de tête de la feuille de style l'interdit pourtant :
   « ok, warn, alarm et info informent : ils ne se prêtent jamais leurs teintes » (`src/shell.html:10`).
3. **Citrinitas en clair échoue WCAG 1.4.3** pour le texte posé sur l'accent. 4,41:1 au lieu de 4,5:1, sur
   `.btn.acc` (14,7 px, graisse 500) et sur `mark` (surbrillance de recherche). **Bug d'accessibilité.**
4. **Rubedo** rend la pastille « 6 à trier » rouge : elle ressemble à une alerte.
5. **Les pastilles d'aperçu mentent.** Leurs couleurs sont codées à part (`reglages.js:36`), et ne sont ni la valeur
   claire ni la valeur sombre réellement appliquées. En clair, la pastille d'Albedo est un vert-gris pâle, alors que
   l'accent obtenu est un gris foncé.

### A.5 Hypothèses : verdict

| Hypothèse | Verdict | Preuve |
|---|---|---|
| Action sans effet | **Réfutée** (Chromium ; WebKit de CI) | Vérifications 1 à 4 ; NAV-010 étape 1 verte sous WebKit en CI au commit `0d22363` |
| Préférence non conservée | **Réfutée** (local) ; **un cas voulu** (compte qui l'emporte, CPT-005) | Vérifications 5 et 6 |
| Règle CSS écrasée | **Réfutée** pour l'accent ; **priorité voulue** des teintes de domaine, qui masque l'accent | `shell.html:220,226` ; Chantier : 14 pixels |
| Ancienne version affichée | **Peu probable** | Service worker « réseau d'abord » ; déploiement du 8 octobre ; non lu directement |
| Changement effectif mais trop discret | **Confirmée** | A.3 : 0,07 à 0,72 % des pixels sur téléphone, hors Programme |
| Ambiguïté « couleur d'accent » contre « thème complet » | **Confirmée** | Titre « Palette » ; aide visible poétique (« Quatre étapes de l'Œuvre, prises dans le sous-bois ») ; seul le « ? » dit « Seul l'accent change » ; pastilles infidèles |

**Cause** : il n'y a pas de panne dans la chaîne. La cause est une **conception du réglage** qui produit un effet presque
invisible et ne l'annonce pas, aggravée par trois défauts concrets :
- les pastilles d'aperçu sont infidèles ;
- Albedo se confond avec le gris des textes ;
- les teintes de domaine passent avant l'accent.

S'y ajoutent deux défauts annexes qui relèvent de l'accessibilité et de la sémantique : le contraste de Citrinitas, et
la proximité de Citrinitas et Rubedo avec les couleurs d'état.

**Ce qui reste non vérifié** :
- un vrai iPhone et un vrai Safari : seul le WebKit de Playwright sous Linux a tourné, en CI ;
- le site publié, lu directement ;
- une synchronisation réelle entre deux appareils : seule la fusion a été rejouée, sans serveur ;
- **observation annexe, non mesurée** : en mode « Toujours sombre » sur un appareil clair, aucune propriété CSS
  `color-scheme` n'est posée, et les balises `theme-color` suivent l'appareil (`build.py:65-66`). Les menus natifs
  (`<select>`) et la barre du navigateur Android peuvent donc rester clairs. C'est à vérifier sur appareil : si le
  signalement visait « les couleurs » au sens du mode, ce pourrait en être une autre cause.

### A.6 Correctif minimal proposé (plan, non appliqué)

Principe : **ne pas transformer les palettes en thèmes complets**. On garde fond, texte, teintes de domaine et couleurs
d'état. On rend visible et vrai ce qui existe déjà.

1. **Dire ce que fait le réglage** (`reglages.js:78`, `reglages-aide.js`, dictionnaire `src/app/i18n/en.js`).
   - Titre « Palette » → « **Couleur d'accent** ». Les noms alchimiques restent sur les boutons.
   - Aide visible : « Elle colore les repères : bouton principal, espace ouvert, jauges, cases cochées, recherche. Le
     fond, le texte et les couleurs d'alerte ne changent pas ; clair ou sombre se règle dans Mode. »
2. **Un aperçu fidèle, en direct.**
   - Généraliser les règles `:root[data-palette="…"]` en `[data-palette="…"]` (`shell.html:25-27`), et ajouter la règle
     de Nigredo, aujourd'hui implicite.
   - Chaque bouton porte `data-palette="<id>"`. Sa pastille prend `var(--acc-l)`, ou `var(--acc-d)` dans les deux blocs
     sombres.
   - Retirer les codes hexadécimaux de `PALETTES` (`reglages.js:36`), pour n'avoir qu'**une seule source de vérité**.
   - Sous les boutons, une bande d'aperçu inerte (`aria-hidden`, `inert`) qui réutilise les vraies classes : un
     `.btn.acc` « Bouton principal », un filet actif, une `.bar` à 60 %, une `.check` cochée. Elle reflète la palette
     courante sans code à maintenir.
3. **Rendre les accents distincts et non sémantiques**, sans toucher aux couleurs d'état.
   - **Contraintes testables** :
     - texte sur accent : 4,5:1 au moins dans les deux modes ;
     - ΔE2000 de 10 au moins avec `alarm`, `warn`, `ok`, `info`, `muted` et les sept teintes ;
     - ΔE2000 de 15 au moins entre deux palettes.
   - **Candidats calculés** par une recherche dans l'espace LCh : la couleur la plus proche de l'actuelle qui respecte
     les contraintes. À juger à l'œil :

     | Palette | Clair | Sombre |
     |---|---|---|
     | Nigredo | `#36633f` | `#88cb8e` |
     | Albedo | `#4b5758` | `#cadfd0` |
     | Citrinitas | `#6d6408`, olive : la « résine » perd son ambre | `#d6ba3f` |
     | Rubedo | `#983b36` | `#cb5c53` |

   - La contrainte coûte surtout à Citrinitas. Si l'ambre est tenu pour identitaire, il reste deux voies :
     - assouplir la règle de `shell.html:10` pour les seuls usages décoratifs ;
     - ou ne plus peindre la pastille de compte (`.pip`) à l'accent.

     **Seuil minimal non négociable** : corriger le 4,41:1 de Citrinitas et détacher Albedo du gris `--muted`.
4. **Ne pas** étendre l'accent aux espaces rangés dans un domaine, ni repeindre les boutons `.btn` : ce serait une
   refonte (G). On mesure d'abord si les étapes 1 à 3 suffisent.

Effort estimé : **1,5 à 2 jours** (CSS, copie, traduction anglaise, tests, cahier). Hypothèse : une personne qui connaît
le code ; validation visuelle des candidats en 30 minutes sur un vrai téléphone.

### A.7 Non-régression et NAV-010

**Tests à ajouter ou modifier**
- `tests/browser/fenetre.js`, NAV-010 étape 1 : garder la sonde, et **ajouter la lecture de composants réels** :
  - `.btn.acc` de la capture sur l'accueil (fond) ;
  - `#nav a.on` (filet gauche) sur bureau, `nav.tabbar .on::after` sur téléphone ;
  - `.swatch.on` (bordure).
- Même fichier : **rechargement**, puis la palette relue sur un composant (étape nouvelle, voir plus bas).
- Après correctif : **la pastille de chaque bouton égale l'accent appliqué** dans le mode courant, clair et sombre.
- `tests/browser/contraste.js` : pour **chaque palette × clair et sombre**, le texte de `.btn.acc` à 4,5:1 au moins.
  Échouerait aujourd'hui sur Citrinitas clair.
- Nouveau test Node (`tests/palette.test.js`) : lire les valeurs dans `src/shell.html` et vérifier les distances ΔE2000
  de A.6. Échouerait aujourd'hui sur Albedo et Citrinitas.
- Rejouer le scénario sous `SELENE_BROWSER=webkit` (déjà dans la matrice de CI) et en émulation tactile (`tap`).

**NAV-010 proposé** (`docs/recette/manuels/navigation-reglages.md`)

| Étape | Action précise | Résultat attendu observable |
|---|---|---|
| 1 | Réglages → Apparence et rythme → Couleur d'accent « Rubedo, amanite ». | Aussitôt, la bande d'aperçu, le bouton « Garder » de l'accueil, l'onglet actif et la jauge d'un Programme passent au rouge amanite. Le fond, le texte, « En retard » et les teintes des espaces rangés dans un domaine ne changent pas. |
| 1 bis | Comparer la pastille de chaque bouton à la bande d'aperçu, en clair puis en sombre. | Mêmes couleurs. |
| 2 | Mode « Toujours clair », puis « Toujours sombre ». | Inchangé. |
| 3 | « Suivre le soleil ». | Inchangé. |
| 4 | « Nom affiché ». | Inchangé. |
| 5 (nouvelle) | Recharger la page, puis l'ouvrir dans un autre onglet. | La couleur choisie est toujours appliquée. |

Plateformes : ajouter IOS (vrai iPhone), ce qu'aucune émulation ne remplace.

Anomalies à inscrire dans `docs/recette/perimetre.md`. A67 et suivants sont les numéros libres au 12 octobre :
- palette imperceptible, avec aperçu infidèle ;
- contraste de Citrinitas.

---

## B. Lecture fonctionnelle de Selene

**Promesse**. Trois formulations coexistent :
- l'écran d'entrée : « Garde tes fragments, tes sources et tes hypothèses reliés. Et retrouve ce que tu avais oublié,
  jusqu'au dernier chapitre » (`src/app/services/auth.js:462`) ;
- la fiche Play : un carnet de recherche pour les longs projets d'écriture ;
- le README, plus intime : un tableau de bord personnel sous la lune.

Le produit tient les deux premières bien mieux que la troisième. Sa valeur distinctive est **la pensée reliée sur la
durée** : provenance, statut épistémique, liens, tensions, motifs, relecture, sortes, dossier. Ce n'est pas la gestion
de la vie quotidienne.

**Parcours forts** **[O]**

- **Capturer puis ranger** :
  - la capture reconnaît « 12 € », « 25 min » et « Module : » ;
  - le Vasculum trie une note à la fois ;
  - la provenance (`origin`) et les liens survivent au rangement (MOD-014 à MOD-016, PEN-002, PEN-005).
- **Écrire long** : Cumul avec fragments, palimpseste, chapitres, Arc, Dossier de passation (MOD-009 à MOD-012,
  MOD-021, PEN-008).
- **Sources** :
  - par DOI ou par lien ;
  - Zotero en lecture ;
  - « documente… » ;
  - références communes par OpenAlex ;
  - BibTeX et CSL-JSON (EXT-001 à EXT-004, EXT-016, EXT-018, EXT-020).
- **Revenir** :
  - pont de reprise ;
  - relecture hebdomadaire ;
  - sortes pondérées par l'oubli ;
  - Bilan et planche (PEN-006, PEN-009, PEN-010, PEN-013, PEN-016).
- **Sobriété assumée** : trois tâches du jour au plus, aucune série ni gamification, aucun envoi des mots du radar.

**Ruptures principales** **[O]**

1. **Ce qui sort de Selene ne revient pas.** Le radar dépose du texte, l'agenda est en lecture seule, le dossier est un
   export à sens unique.
2. **Les états de vie des choses sont pauvres et hétérogènes.** Fait ou pas fait pour une tâche, statuts libres sans date
   de passage pour une collection, aucune fin pour un programme, ni pause, ni abandon, ni archive.
3. **Corriger est plus difficile qu'ajouter.** On ne peut pas :
   - retirer un lien ;
   - lister ou modifier les sessions d'un cumul ;
   - consulter l'historique au-delà de 8, 12 ou 20 lignes ;
   - annuler le rangement d'une note.
4. **Le téléphone perd des chemins** : Dehors et la palette de commandes n'y ont pas d'entrée.
5. **Des informations enregistrées ne servent à rien** : l'historique des ponts (`resumeLog`) n'est jamais affiché.

**Complexité** **[H]**
- Le vocabulaire est riche : sigil, domaine, jachère, concordance, palimpseste, sortes, Vasculum, Dehors, passeur.
- Le glossaire des Réglages le compense en partie.
- Le risque n'est pas le nombre de fonctions, mais leur **éparpillement de configuration**. Les mots du radar se règlent
  dans Ciel, la clé OpenAlex dans Dehors, Zotero et le calendrier dans Connexions, et le passeur demande un secret côté
  serveur.

---

## C. Tableau des manques

Classes : **Bug** · **Parcours incomplet** · **Absente** (fonctionnalité absente) · **Peu découvrable** ·
**Incohérence** · **Limite assumée** · **À valider** (idée à valider auprès des utilisateurs).
Priorités : **P1** à traiter dans le prochain lot ; **P2** dans les deux suivants ; **P3** quand le parcours concerné
est retravaillé.

| Parcours | Constat | Preuve | Impact utilisateur | Existant réutilisable | Action proposée | Priorité |
|---|---|---|---|---|---|---|
| Réglages → apparence | **Bug** (perçu) : la palette change si peu qu'on la croit cassée ; aperçu infidèle ; Albedo ≈ gris des textes | A.3, A.4 ; `reglages.js:36,78` ; NAV-010 | Réglage jugé « cassé » ; confiance entamée | Variables `--acc-l` et `--acc-d`, classes réelles | Plan A.6 | **P1** |
| Accessibilité | **Bug** : Citrinitas clair, texte sur accent à 4,41:1 | A.4 ; `shell.html:26,354,627` ; TRV-006 | Bouton principal et surbrillance sous le seuil WCAG AA | — | Valeur recalibrée et test par palette (A.7) | **P1** |
| Rappels (Soins) | **Bug** : le journal affiche l'identifiant du geste (« m40pghqd ») au lieu de son nom, et « note » pour une observation | Reproduit ; `rappels.js:22` (`esc(l.type)`), alors que `recent` et `review` traduisent (`:39-40`) ; MOD-013 | Journal illisible pour tout geste créé dans les Réglages : le modèle « Soins » démarre sans geste (`domain.js:506`) | La recherche du libellé de `recent` | Afficher le libellé (et « Observation ») ; test TN sur un geste créé | **P1** |
| Chercher → ouvrir | **Bug ou incohérence** : la recherche parcourt les espaces désactivés, puis « ouvrir » renvoie à l'accueil | Reproduit : « héron » trouvé, `#carnet/c1` → accueil et bulle « « Carnet » est désactivé » ; `recherche.js:48` ; NAV-006, ESP-006 | Impasse : on trouve sans pouvoir lire | Facette d'espace (NAV-005) | Exclure les espaces désactivés, ou les marquer « désactivé » avec « Réactiver » | **P1** |
| Téléphone → Dehors, palette ⌘K | **Peu découvrable** (bloquant) : aucune entrée vers Dehors ni vers la palette sous 900 px | Reproduit : `.pal-hint` invisible, feuille Capturer sans palette ; `sheets.js:17-24`, `nav.js:41-54` ; NAV-001, NAV-003, EXT-013 | Sans clavier, pas d'ajout de flux ni de veille, pas de clé OpenAlex | Feuille Espaces, rubrique « Système » | Ajouter « Nouveautés » (si `dehorsOn()`) et « Aller à… » dans la feuille Espaces | **P1** |
| Programme | **Parcours incomplet** : aucune fin. Après la durée prévue, « Pas encore de séance… » revient chaque jour | `programme.js:74-81` (`alerts` ne regarde pas `weeks`) ; MOD-007 | Culpabilisation passive, contraire au ton de l'app | `summary` connaît la semaine | Au-delà de la durée : un état « terminé », plus d'alerte, et « Prolonger » | P2 |
| Liens et tensions | **Parcours incomplet** : un lien ne se retire jamais ; un « contredit » posé par erreur ne se ferme que par une synthèse | Aucune action de retrait dans `src/` ; `links.js:95-106` ; PEN-003, PEN-004 | Graphe pollué, tensions fantômes dans le Bilan et la Relecture | `removeWithUndo` | « retirer » sur la fiche (PEN-007), avec Annuler | P2 |
| Cumul (Écriture) | **Parcours incomplet** : sessions ni listées, ni modifiables, ni supprimables ; correction par valeur négative | `cumul.js:104-113` ; MOD-009 | Une faute de frappe fausse durablement compteur et projection | Liste paginée (MOD-025) | Journal des sessions paginé, avec suppression et Annuler | P2 |
| Historiques | **Parcours incomplet** : « Fait récemment » limité à 8, le journal des Rappels à 20, celui du Programme à 12 ; au-delà, rien n'est visible ni corrigeable | `taches.js:124`, `rappels.js:16`, `programme.js:48` | Erreurs anciennes définitives ; une recherche mène à une tâche faite qu'on ne peut pas déplier | `paged()` et « Voir les suivants » | Paginer ces trois listes | P2 |
| Annulation | **Incohérence** : ranger une note et passer un palier se font sans Annuler, alors que les suppressions en ont un | `notes.js:59-60`, `programme.js:115-117` ; MOD-015, MOD-008, MOD-022 | Geste irréversible, et non dit | `toastUndo` | Annuler de 6 s sur ces deux gestes | P2 |
| Radar → sortie | **Parcours incomplet** : « garder » aplatit l'événement en note texte dans la boîte ; date, lieu et lien perdent leur structure | `radar.js:80-85` ; structure disponible `core/radar.js:35` (`from`, `to`, `place`, `city`, `url`) ; EXT-010 | Date à retaper ; aucun rappel ; aucun lien avec budget ou calendrier | Tâches (échéance, lieu, coût → budget, pluie) | Proposition E2 | P2 |
| Radar, passeur | **Incohérence et erreur sans solution** : le code dit le portail « CORS ouvert », la doc dit le contraire (vérifié le 29 septembre). Sans passeur, le radar échoue. Le passeur est réservé aux comptes listés par l'opératrice, et son message renvoie à « docs/passeur.md » | `core/radar.js:2`, `features/radar.js:23` contre `docs/connexions.md` (5d) ; `passeur.js:41-50` ; EXT-010, EXT-012 | Fonction proposée mais inutilisable pour un compte de bêta ordinaire | — | Aligner commentaires et doc ; message pour l'utilisatrice (« réservé pendant la bêta ») ; masquer le bouton si le passeur est fermé | P2 |
| Reprendre un projet | **Information enregistrée mais inexploitée** : l'historique des ponts (`resumeLog`) est écrit, jamais affiché | `domain.js:412` ; lu seulement par `bridge.js:37` et `backup.js:101` ; PEN-006 | Après des semaines, on perd le fil des intentions successives | Pont de reprise | « Fil des reprises » dans l'espace (E3) | P2 |
| Statuts de collection | **Absente** : aucune date de changement de statut | `collection.js:101` (le commentaire le reconnaît) | Ni « en attente depuis », ni bilan des changements | `epLog` (même idée, pour les notes) | `statusAt` au changement (sert E1 et le Bilan) | P2 |
| Actif, pause, abandon | **Incohérence** : aucun statut commun ; une tâche ne s'abandonne pas, elle se supprime ; la seule pause, c'est désactiver un espace | Rapport des types, §3-4 ; `actions.js:203` | Listes qui grossissent, deuils de tâches sans trace | Désactivation, statuts libres de collection | D'abord : « abandonner » une tâche (gardée, motif facultatif) et « en attente » (E1) | P2 |
| Démarches | **Absente** : aucun état « j'attends une réponse » | `domain.js:16-26` (tâche : `done` seulement) | Relances oubliées, date d'envoi perdue | Tâches (échéance, étapes), mode révision | Proposition E1 | P2 |
| Tâches → Aujourd'hui | **À valider** : une tâche en retard non étoilée n'apparaît que repliée dans « Où en sont les choses » ; le résumé du matin ne compte que les échéances du jour | Reproduit (« Repeindre la rambarde », en retard de 27 jours) ; `accueil.js:37-41`, `digest.js:25` ; MOD-001, PLT-005 | Peut-être voulu (« Trois choses »), mais un retard ne fait jamais signe | `summary` « N en retard » | Demander aux testeurs ; au moins le compter dans le résumé du matin | P3 |
| Configuration réservée aux modèles | **Peu découvrable** : le mode Sources et les fragments d'un Cumul ne s'activent que par le modèle | `collection.js:81-98` (pas de `col-sources`) ; Cumul sans réglage `scraps` | Un espace créé « vide » ne peut jamais les avoir | Cases Musique, Concordance, Révision | Deux cases de plus dans « régler » | P3 |
| Arc, liens, sources | **Incohérence** : un Arc ne place ni note ni tâche ; les liens ne vont qu'entre notes et fragments ; une source ne documente pas une tâche | `arc.js:17-24`, `links.js:26-33`, `sources.js:150` | Le « projet » éclaté entre modules ne se recoud pas | Références `module/id` | À valider (G : page de projet) | P3 |
| Dehors → Sources | **Passage qui perd une information** : « garder » va dans le premier espace Sources ; le projet du flux est perdu | `dehors.js:259,264` | Sources mal rangées quand on en a plusieurs | Projet du flux | Choisir l'espace cible, ou retenir le projet | P3 |
| États vides | **État vide qui n'aide pas** : collection vide en colonnes, rien de visible (lecteur d'écran seulement) ; en liste, « Rien dans ce filtre. » même sans filtre | `collection.js:73,79` ; TRV-015 | Page muette au premier usage | Textes d'état vide de l'app | Une phrase qui dit quoi ajouter, et le bouton | P3 |
| Imports | **Données difficiles à corriger** : sauvegarde JSON = remplacement total sans Annuler ; Markdown dédoublonné au texte identique ; pas de suppression en lot | `backup.js`, `notes.js:95-133` ; DON-002, MOD-026 | Un mauvais import se corrige note par note | `origin` (provenance) | « Annuler le dernier import Markdown » (marqué dans `origin`) | P3 |
| Références personnelles | **Incohérence** avec « aucun contenu personnel » (`domain.js:474-475`) | Éclipses « visibles depuis Lille » (`core/sky.js:195-213`) ; commentaires du radar sur Lille ; exemple « Chantier : plombier » (`agenda.js:41,62`) ; sigils déduits de « moth » ou « phidippus » (`sigils.js:46`) | Faible (repli silencieux), mais l'éclipse ne parle qu'à une région | Calcul astronomique existant | Généraliser ou étiqueter « table régionale » | P3 |
| Notes | **Limite assumée** : une note ne se modifie pas | README:109 | — | Fragments à palimpseste | Garder ; le dire dans l'état vide du Carnet | — |
| Documentation | **Doc en retard** : le README cite `src/app.js` et `types.js` (disparus) et 8 modèles au lieu de 14 | README:5,37 ; `domain.js:476-510` | Contributeurs induits en erreur | — | Mettre à jour | P3 |

---

## D. Comparatif des idées

Pour chaque idée, la question posée dans l'ordre : modèle préconfiguré, puis extension d'un module, puis fonction
transverse, puis nouveau type.

| Idée | Besoin | Valeur supplémentaire | Modèle / extension / fonction transverse / nouveau type | Effort | Entretien utilisateur | Dépendances | Recommandation |
|---|---|---|---|---|---|---|---|
| **1. En attente de réponse** | Démarches, candidatures, envois, devis : la balle est dans l'autre camp | Date d'envoi, « depuis N jours », relance qui revient seule ; pièces = étapes | **Extension de Tâches** (le mode révision des collections parle de « décision maintenue ») | 2 à 3 j | Une date de relance, facultative | Aucune | **E1, en premier** |
| **2. Sortie préparée depuis le radar** | Passer de « ça a l'air bien » à « j'y vais » | Date structurée, lieu, lien, coût vers le budget, pluie le jour J, fichier `.ics` | **Amélioration du Radar** + **fonction transverse** `.ics` | 2 à 3 j | Nul | OpenAgenda via Opendatasoft (existant, passeur si pas de CORS) ; import `.ics` à confirmer sur appareil | **E2**, après le correctif passeur et radar |
| **3. Reprendre selon le temps et l'élan déclarés** | « J'ai 10 minutes et peu d'énergie : par quoi reprendre ? » | Une proposition tirée des ponts, de l'effort des tâches, de la boîte et des révisions, sans rien inférer | **Fonction transverse** (ponts, `effort`, Vasculum, alertes) | 3 à 4 j | Nul (deux choix par usage) | Aucune | **E3, à prototyper** |
| 4. Fil des reprises | Revenir après des semaines : qu'avais-je prévu, et l'ai-je fait ? | Rend utile une donnée déjà stockée (`resumeLog`) | **Amélioration** (pont de reprise) | 0,5 à 1 j | Nul | Aucune | Oui, petit gain sûr (inclus dans E3) |
| 5. Essais personnels | Intention, essai, observation, conclusion | Une date de bilan et une conclusion écrite ; statut épistémique déjà là | **Modèle** de Collection (révision), avec des libellés de révision configurables | 0,5 j (+1 j pour les libellés) | Moyen | Aucune ; **aucune inférence médicale** | À valider ; proche de Décisions et des paliers |
| 6. Entretien et durée de vie des objets | Détartrer, réviser, garantie qui expire | Faible : les Rappels font déjà les gestes récurrents | **Modèles** Rappels « Entretien » + Collection « Objets » | 0,5 j | **Élevé** (inventaire) | Aucune | Pas maintenant |
| 7. Page de projet par domaine | Voir un projet entier : ponts, tâches, sources, tensions | Recoudre ce qui est éclaté entre espaces | Nouvelle **vue** transverse (pas un type) | 5 à 8 j | Faible | Aucune | Plus tard, si E3 montre le besoin |
| 8. Décisions réévaluées après expérience | Relire une décision à la lumière de ce qui s'est passé | **Déjà couvert** : modèle Décisions, rendez-vous de révision, « relire » et « maintenue », palier → décision (MOD-008, MOD-019) | — | — | — | — | **Écartée** (existe) |

Écartées d'emblée, comme le demande la mission : réseau social, classements, séries, nouveau chatbot (l'assistant n'est
pas déployé pour la bêta, décision du 7 octobre 2026), recommandations « pour toi ».

**Aucune nouvelle catégorie de module n'est justifiée aujourd'hui.** Les trois propositions retenues tiennent dans des
extensions et des fonctions transverses.

---

## E. Trois propositions approfondies

### E1. « En attente de réponse », sur les Tâches

- **Besoin et contexte**. Les démarches où l'on a fait sa part et où l'on attend : dossier administratif, candidature,
  manuscrit envoyé, devis, réclamation, relance d'un directeur de thèse. On oublie de relancer, et la date d'envoi se
  perd. GTD (*Getting Things Done*, David Allen) en fait une liste à part, « Waiting For », pour une raison simple : une
  attente n'est pas une action, et la mêler aux actions rend les deux illisibles.
- **Scénario en quatre gestes** :
  1. tâche « Dossier CAF : changement de situation », étapes « RIB », « attestation », « formulaire » ;
  2. une fois envoyé : « **J'attends une réponse** », qui demande « de qui ? » (facultatif) et « relancer le » (proposé :
     dans 14 jours) ;
  3. la tâche passe dans une section « **En attente** », avec « depuis 3 j · relancer le 26/10 » ;
  4. le 26/10, elle revient sur « Aujourd'hui » avec deux boutons : « **relancé** » (relance reportée de 14 jours, et
     consignée) et « **réponse reçue** » (la tâche revient à faire, ou se termine).
- **Bénéfice** :
  - face à une note : une date qui revient seule ;
  - face à une tâche simple : l'attente ne pollue ni les échéances ni les « trois choses » ;
  - face à une collection : les étapes (les pièces), l'échéance et le coût restent ceux des Tâches.
- **Existant** :
  - Tâches : échéance, étapes, note, coût vers le budget ;
  - le mécanisme d'alerte avec actions (Rappels) ;
  - « Annuler » (`toastUndo`) ;
  - le résumé du matin, qui reprend les alertes à actions (`digest.js:24`).
- **Interactions** :
  - Aujourd'hui (alerte) ;
  - résumé du matin et widget (natifs) ;
  - Chercher (la note, déjà indexée) ;
  - Bilan (« N attentes closes ce cycle ») ;
  - assistant : rien.
- **Nouvelles données strictement nécessaires** :
  `wait: { since: "AAAA-MM-JJ", who: "≤ 80 car.", next: "AAAA-MM-JJ" | null, log: [{ date, kind: "relance" }] }` sur une
  tâche. Rien d'autre.
- **Saisie et entretien** : un geste pour entrer en attente ; une date, préremplie ; un geste par relance.
- **Hors ligne** : intégral (local-first). **Synchronisation** : un champ d'entrée, fusionné entrée par entrée comme le
  reste (`sync.js`).
- **Confidentialité** : « de qui » peut nommer un organisme ou une personne. Ce texte reste dans le document, comme une
  note, et n'est envoyé nulle part. **Dépendances externes** : aucune.
- **MVP** :
  - le bouton, la section, l'alerte à deux actions, Annuler ;
  - **exclus** : pièces jointes (fichiers), modèles de relance par courriel, rappels push hors du résumé du matin.
- **Critères d'acceptation** :
  1. une tâche en attente n'apparaît plus dans les échéances ni dans le tirage au sort, et figure dans « En attente »
     avec « depuis N j » ;
  2. à la date de relance, l'alerte paraît sur l'accueil et dans le résumé du matin ;
  3. « relancé » consigne la relance et reporte la date, avec Annuler ;
  4. « réponse reçue » efface l'attente, avec Annuler ;
  5. sauvegarde et restauration gardent `wait` (DON-007) ;
  6. la même tâche, modifiée sur deux appareils, garde les deux changements ;
  7. textes traduits, `npm run check` vert.
- **Effort** : 2 à 3 jours, dont un jour de tests (TU du noyau, TN `taches.js`), un cas MOD-0xx et la traduction anglaise.
- **Vérifier l'utilité avant de développer** : pendant trois semaines, cinq testeurs écrivent « ATTENTE » en tête des
  tâches concernées et datent la relance dans l'échéance. On compte combien en tiennent plus de deux et combien de
  relances ont lieu.
- **Condition d'abandon** : moins d'une attente active par testeur après un mois, ou des testeurs qui reviennent à
  l'échéance simple. Dans ce cas, garder seulement le marqueur textuel.

### E2. Du radar à une sortie préparée, et le fichier `.ics`

- **Besoin**. Un événement repéré dans le radar culturel doit devenir une sortie réellement préparée : la date, le lieu,
  le billet, le trajet, le budget.
- **Scénario en trois gestes** :
  1. Radar → « **en faire une sortie** », à côté de « garder ». Une tâche se crée dans le premier espace Tâches, ou
     dans celui choisi s'il y en a plusieurs :
     - titre = l'événement ;
     - échéance = le premier jour ;
     - lieu (`room`, dont le libellé par défaut est justement « Lieu ») = la salle ;
     - note = la ville, les dates complètes et le lien ;
  2. le formulaire s'ouvre, prérempli : on ajoute « réserver » en étape et le prix en coût ;
  3. sur la tâche datée, « **Ajouter à mon calendrier** » télécharge un fichier `.ics`.
- **Bénéfice face à la note actuelle** :
  - la date est structurée, donc dans « Cette semaine » et le résumé du matin ;
  - la pluie le jour prévu s'affiche si la tâche est « à ciel ouvert » (EXT-009) ;
  - le coût est proposé au budget quand la sortie est faite (MOD-003) ;
  - le lien reste cliquable.
- **Existant** :
  - les éléments du radar ont déjà `from`, `to`, `place`, `city` et `url` (`core/radar.js:35`) ;
  - le formulaire de tâche s'ouvre déjà après un rangement (`taches.js:161`) ;
  - `downloadFile` couvre l'artefact, le natif (feuille de partage) et le web (`lib/download.js`).
- **Fonction transverse `.ics`**. Un fichier iCalendar (RFC 5545) d'un seul `VEVENT` : `UID`, `DTSTAMP` et `DTSTART`
  (obligatoire sans propriété `METHOD`), date sans heure, `SUMMARY`, `LOCATION`, `URL`, `DESCRIPTION` (sources en F).
  Aucune API, aucun compte. Utilisable plus tard pour toute date : relance (E1), révision d'une décision.
- **Nouvelles données** : aucune. Seule la correspondance radar → tâche est nouvelle.
- **Saisie et entretien** : nuls.
- **Hors ligne** : le radar exige le réseau, comme aujourd'hui ; la sortie créée et le `.ics` fonctionnent hors ligne.
- **Confidentialité** : rien de plus ne part. Le portail reçoit toujours la zone et les dates, jamais les mots. Le `.ics`
  est un fichier local, que la personne ouvre elle-même.
- **Dépendances et limites** :
  - le portail d'OpenAgenda est servi par Opendatasoft ;
  - sans en-tête CORS, il faut le passeur, réservé aux comptes listés : à régler d'abord (C, P2) ;
  - le comportement de l'import `.ics` téléchargé depuis une PWA sur iPhone, et partagé depuis l'app Android vers un
    agenda, est **à confirmer sur vrais appareils**.
- **MVP** :
  - « en faire une sortie » vers une tâche ;
  - `.ics` sur une tâche datée ;
  - **exclus** : écriture directe dans Google Agenda ou iCloud, billetterie, itinéraire, concerts par une API musicale.
- **Critères d'acceptation** :
  1. depuis le radar, une tâche est créée avec titre, échéance (le premier jour), lieu et lien exacts, et le formulaire
     s'ouvre ;
  2. sans espace Tâches, le bouton n'apparaît pas et « garder » reste ;
  3. le `.ics` produit est valide (UID unique, DTSTAMP, DTSTART en date) et s'importe dans au moins un agenda testé ;
  4. un test TN couvre le radar → tâche, avec réponse simulée du portail ;
  5. EXT-010 est mis à jour.
- **Effort** : 2 à 3 jours (1 pour le radar → tâche, 1 pour le `.ics` et ses tests, 0,5 pour les essais sur appareils).
- **Vérifier l'utilité avant de développer** : regarder sur un mois ce que deviennent les notes « gardées » du radar.
  Combien sont rangées en tâche, avec la date retapée à la main ?
- **Condition d'abandon** : si moins d'un événement par mois et par personne est gardé, le radar ne justifie pas
  davantage. On revoit alors son existence avec le critère déjà appliqué à la carte céleste.

### E3. Reprendre selon le temps et l'élan déclarés, avec le fil des reprises

- **Besoin**. Revenir à Selene avec une capacité donnée (« 10 minutes, peu d'élan ») et obtenir **une** chose à
  reprendre, sans tableau de bord à entretenir. C'est l'antidote à la paralysie du choix : quand tout est possible, on ne
  fait rien, et on finit par fermer l'app en se jugeant.
- **Scénario en deux gestes** :
  1. sur l'accueil, dans le bloc « Reprendre » existant, « **J'ai…** » : [10 min] [30 min] [1 h ou plus] × [peu
     d'élan] [de l'élan] ;
  2. trois propositions au plus, chacune avec son geste :
     - le **pont de reprise** le plus ancien encore ouvert : « Je m'étais arrêtée à… », puis ouvrir ;
     - une **tâche d'effort compatible** (`effort` 1 pour 10 min ou peu d'élan, 2 au plus pour 30 min) : l'étoiler, ou
       lancer le minuteur de 15 minutes ;
     - **trier la boîte** une note à la fois (Vasculum), si elle déborde et qu'on a peu de temps ;
     - une **décision à réexaminer** échue, si l'élan est faible.

  « Autre chose » passe à la suivante. L'ordre est déterministe : aucun hasard, aucun apprentissage.
- **Fil des reprises** : dans chaque espace, sous le pont, la liste repliable des ponts précédents (`resumeLog` : texte,
  date, « repris » ou « remplacé »). C'est la mémoire des intentions.
- **Bénéfice** :
  - face à « Tirer une petite tâche au sort » (MOD-004), qui ne voit que les tâches et le hasard : la capacité
    déclarée oriente, les ponts passent en premier ;
  - face aux Sortes, qui servent la pensée oubliée : celle-ci sert l'action à reprendre.
- **Existant** :
  - ponts et `resumeLog` (PEN-006) ;
  - `effort` des tâches ;
  - Vasculum ;
  - alertes de révision ;
  - minuteur ;
  - bloc « Reprendre » de l'accueil (NAV-011).
- **Nouvelles données** : aucune synchronisée. Le dernier choix (durée, élan) est gardé **sur cet appareil**, comme
  « Ouvrir sur ».
- **Saisie et entretien** : nuls au-delà des ponts et de l'effort, qui existent déjà.
- **Hors ligne** : intégral. **Confidentialité** : rien ne sort. Rien n'est inféré : la capacité est **déclarée**, jamais
  devinée d'après l'heure ou l'usage. **Dépendances** : aucune. Le suivi « Reprendre la main » est exclu (sensible).
- **MVP** :
  - le sélecteur, trois sources (ponts, tâches, Vasculum) et le fil des reprises ;
  - **exclus** : estimation de durée par tâche, apprentissage des préférences, notification.
- **Critères d'acceptation** :
  1. avec 10 min et peu d'élan, aucune tâche d'effort 3 n'est proposée ;
  2. un pont de plus de 14 jours passe avant une tâche ;
  3. jamais plus de trois propositions, jamais d'espace désactivé ni sensible ;
  4. le fil des reprises montre les ponts passés dans l'ordre, et « Annuler » d'un « fait » le respecte (`bridge.js:37`) ;
  5. tests TU de la fonction de choix (pure, dans `src/core/`) et TN de l'accueil.
- **Effort** : 3 à 4 jours (1 pour la fonction pure et ses tests, 1 pour l'interface, 0,5 à 1 pour le fil des reprises,
  0,5 pour le cahier et la traduction).
- **Vérifier l'utilité avant de développer** : un test en « magicien d'Oz » (un humain joue la fonction à la main).
  Pendant deux semaines, à chaque ouverture, cinq testeurs notent « temps et élan », reçoivent les trois propositions
  calculées à la main, et disent si elles servaient. Le fil des reprises, lui, peut se livrer seul (0,5 à 1 jour) :
  il ne coûte presque rien.
- **Condition d'abandon** : moins d'un usage par semaine et par testeur après trois semaines, ou moins d'une proposition
  sur trois acceptée. Retirer le sélecteur et garder le fil.

---

## F. Ordre de travail recommandé

1. **Corriger les dysfonctionnements** (environ 4 jours) :
   - couleur d'accent : plan A.6 et tests A.7 ;
   - libellé des Rappels ;
   - espaces désactivés dans la recherche ;
   - entrées « Nouveautés » et « Aller à… » dans la feuille Espaces sur téléphone ;
   - fin d'un Programme ;
   - message du passeur et cohérence code-doc sur le CORS du radar.
2. **Compléter les parcours existants** (environ 5 jours) :
   - retirer un lien ;
   - journal des sessions d'un Cumul ;
   - pagination des historiques ;
   - Annuler sur « ranger » et « passer un palier » ;
   - `statusAt` des collections ;
   - fil des reprises ;
   - états vides des collections ;
   - cases Sources et Fragments.
3. **Expérimenter** :
   - E1 « En attente » d'abord (le moins risqué, le plus général) ;
   - E2 « Sortie » ensuite, une fois le passeur ou le radar réglé ;
   - E3 « Reprendre selon le temps » en magicien d'Oz avant tout code.

   Chacune a sa condition d'abandon écrite d'avance, comme la carte céleste (`docs/a-faire.md`).

## G. Ce qu'il vaut mieux ne pas développer maintenant

| Écarté | Raison précise |
|---|---|
| Palettes transformées en thèmes complets (fond, teintes de domaine) | Refonte visuelle non demandée ; risque sur les contrastes vérifiés par TRV-006 ; d'abord mesurer l'effet de A.6 |
| Écriture directe dans Google Agenda ou iCloud | OAuth avec des portées classées « sensibles », donc une vérification de l'app par Google (sources en F) ; l'iCloud par CalDAV n'est pas vérifié ici. Le `.ics` couvre le besoin sans compte ni serveur |
| Module « Objets » (entretien, garanties) | Inventaire coûteux à entretenir ; les Rappels couvrent les gestes récurrents |
| Page de projet par domaine | 5 à 8 jours ; attendre les signaux de E3 et du fil des reprises |
| Statuts unifiés (actif, pause, abandon, archive) pour les neuf types | Refonte du modèle de données de tous les types ; commencer par « abandonner une tâche » et « en attente » |
| Nouveaux outils pour l'assistant | Assistant non déployé pour la bêta (décision du 7 octobre 2026) |
| Recommandations « pour toi » dans le radar ou Dehors | Contraire aux décisions : le radar n'envoie jamais les mots ; la veille « ne classe rien selon ce qui te donnerait raison » (`docs/connexions.md`) |
| Concerts par une API musicale tierce | Faisabilité à confirmer (non vérifiée) ; MusicBrainz ne donne que des sorties |
| Export CSV générique | Aucun signal de demande ; la sauvegarde JSON existe, et les Sources s'exportent déjà |
| Séries, points, classements | Écartés par ADR 26 et `regulation.md` |

## H. Traçabilité

**Lu** :
- dans le code : `src/core/domain.js`, `src/core/sync.js`, `src/core/radar.js`, `src/app/registry.js` ;
- les modules (par délégation complète, puis vérification ciblée des lignes citées) ;
- les fonctions transverses et les vues : `reglages.js`, `render.js`, `accueil.js`, `nav.js`, `sheets.js`, `radar.js`,
  `passeur.js` ;
- `src/shell.html`, `sw.js`, `build.py` ;
- la documentation : README, `architecture.md`, `evolution-ui.md`, `connexions.md`, `a-faire.md`, `validation.md`,
  `regulation.md` ;
- la recette : `README.md`, `backlog.md`, `perimetre.md`, `matrice.md`, les manuels (identifiants, NAV-010, CPT-005,
  TRV-006) ;
- `tests/browser/fenetre.js`, `contraste.js`, `run.js`, `helpers.js` ;
- la PR ouverte #160 (fichiers modifiés).

**Exécuté** :
- `python3 build.py --check` (vert) ;
- `npm test` (333 sur 333) ;
- `npm run build:dist` ;
- `tests/browser/run.js fenetre` sous Chromium (vert, NAV-010 compris) ;
- quatre scripts de session, non versionnés :
  - mesures de palette sur 5 écrans × 4 palettes × 3 contextes ;
  - composants et modes ;
  - parcours rappels, tâche en retard, espace désactivé, palette sur téléphone ;
  - conservation sur téléphone ;
- la fusion `mergeDocs` sur trois cas ;
- le calcul de ΔE2000, des contrastes et des candidats ;
- lecture, par l'API GitHub, des jobs du commit `0d22363` (CI verte : Chromium, WebKit, Firefox ; déploiement Pages).

**Observé** : tout ce qui est marqué **[O]**.

**Non vérifié** :
- un vrai iPhone, un vrai Safari, Android et Windows ;
- le site publié, lu directement (le mandataire répond 403) ;
- l'en-tête CORS actuel du portail Opendatasoft (même blocage) ;
- une synchronisation réelle à deux appareils ;
- l'effet de « Toujours sombre » sur les menus natifs ;
- le classement exact de la portée `calendar.events` chez Google (sensible ou restreinte : les sources divergent) ;
- **l'intérêt des propositions E1 à E3 pour les utilisateurs** : aucune observation d'usage n'existe encore (la recette
  ne compte aucune campagne au 12 octobre 2026, d'après la PR #160).

Sources externes consultées pour E2 et G :
- RFC 5545, section 3.6.1, composant `VEVENT` : [icalendar.org](https://icalendar.org/iCalendar-RFC-5545/3-6-1-event-component.html) ;
- Google, vérification des portées sensibles : [developers.google.com](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) ;
- classement des portées Agenda selon un intégrateur : [Nylas](https://developer.nylas.com/docs/cookbook/calendar/google-calendar-oauth.md).
