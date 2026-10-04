# Périmètre de la recette

Ce qui est réellement dans Selene au commit de référence (`768eb34`, 4 octobre 2026), d'après le code, les tests et la
documentation lus ensemble. Quand ils divergent, la divergence est notée plus bas plutôt que tranchée en silence.

Statuts : **disponible** (dans `main`, atteignable par l'interface), **partielle** (une partie seulement est livrée, ou elle
dépend d'un réglage serveur ou d'un compte que le dépôt ne peut pas garantir), **autre branche** (dans une branche ou une
PR non fusionnée), **envisagée** (décrite dans un document, absente du code). Les cas manuels ne couvrent que le
disponible et le partiel ; l'envisagé figure ici pour qu'on ne le teste pas par erreur.

## Cibles

| Cible | Statut | Construite et vérifiée en CI | Essai sur un vrai appareil |
|---|---|---|---|
| Site hébergé (`index.html`, GitHub Pages), navigateur d'ordinateur | disponible | build, tests unitaires, 73 scénarios dans Chromium et WebKit ; publié par `pages.yml` seulement si Check est vert | Chromium : oui, par la CI ; Safari : moteur WebKit en CI, pas Safari lui-même |
| PWA installée (iPhone, Android) | disponible | service worker et manifeste vérifiés (`hors-ligne.js`, `build.test.js`) | jamais fait ([a-faire.md](../a-faire.md#essayer-sur-de-vrais-appareils)) |
| Artefact claude.ai (`selene.html`) | disponible | testé dans une VM Node (faux DOM), jamais dans claude.ai | jamais fait (« Hors CI » dans [architecture.md](../architecture.md#vérification)) |
| App Android (Capacitor) | disponible, non publiée | APK de débogage compilé, chemin de signature éprouvé avec une clé jetable (`android.yml`) | jamais fait |
| App iOS (Capacitor) | partielle | compilée pour le simulateur, sans signature (`ios.yml`) ; l'installer demande un compte Apple Developer | jamais fait |
| App Windows (Tauri) | disponible, non publiée | tests Rust et installateur NSIS (`desktop.yml`) ; non signé sans certificat | jamais fait |
| Firefox | à clarifier | aucun test, aucune mention | — |
| Tauri sous macOS ou Linux | envisagée | le code le permet (Trousseau, Secret Service), aucune construction | — |

## Cartographie fonctionnelle

« Héb. » : toutes les cibles hébergées (`Web`, `Mob`, `AND`, `IOS`, `WIN`). Les cas manuels de chaque ligne sont dans la
[matrice](matrice.md).

### Entrée, comptes et session

| Fonctionnalité | Statut | Point d'entrée | Cibles | Références |
|---|---|---|---|---|
| Écran d'entrée : promesse, « Commencer sans compte », « Créer un compte », « J'ai déjà un compte » | disponible | ouverture du site sans session | Héb. | [compte.md](../compte.md#sans-compte), `services/auth.js` |
| Selene sans compte, puis versement dans un compte | disponible | « Commencer sans compte » ; Réglages → Compte et données | Héb. | ADR 28 |
| Inscription, connexion, inscriptions fermées (sur invitation) | disponible | écran de connexion | Héb. | [compte.md](../compte.md#mot-de-passe-oublié-invitation) |
| Mot de passe oublié, lien de récupération, invitation | partielle : le code est livré, l'envoi d'e-mails dépend du SMTP du projet (non vérifiable depuis le dépôt) | « Mot de passe oublié ? » | Héb. | [a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait) |
| Mots de passe de 10 caractères, changement avec le mot de passe actuel | disponible | Réglages → Compte et données | Héb. | `PW_MIN` |
| Session : jeton rafraîchi, réseau coupé ou 5xx gardent la session, refus 400/401 la ferment | disponible | — | Héb. | [architecture.md](../architecture.md#session) |
| Déconnexion : envoi de ce qui attend, appareil vidé, garde des suivis locaux | disponible | Réglages → Compte et données → Se déconnecter | Héb. | — |
| Suppression du compte | partielle : dépend du déploiement de la fonction `compte` (à vérifier, [a-faire.md](../a-faire.md)) | Réglages → Compte et données → Supprimer mon compte | Héb. | ADR 20 |

### Navigation, recherche, réglages

| Fonctionnalité | Statut | Point d'entrée | Cibles | Références |
|---|---|---|---|---|
| Barre basse (téléphone), barre latérale (ordinateur), feuille Espaces, ⊕ Capturer | disponible | — | Héb., `ART` | [evolution-ui.md](../evolution-ui.md#architecture-de-navigation) |
| Palette de commandes | disponible | ⌘K ou Ctrl+K | idem | `shell/palette.js` |
| Recherche : sans accents, tous les mots, facettes, `statut:`, lien profond, retour à la recherche | disponible | « Chercher », touche `/` | idem | README, « Chercher » |
| Réglages en six chapitres, sommaire, infobulles « ? », premier accueil | disponible | Réglages | idem | `views/reglages.js` |
| Langue : français, anglais, celle de l'appareil par défaut | disponible | Réglages → Apparence et rythme → Langue | idem | [i18n.md](../i18n.md) |
| Apparence : palette, mode (dont « Suivre le soleil »), nom affiché, « Ouvrir sur » | disponible | Réglages → Apparence et rythme | idem | — |
| Mémoire du défilement par vue | disponible | — | idem | — |
| Raccourcis `c`, `t`, `g a/b/r`, `j`/`k`, `x`, `e`, `?` ; rail de sigils repliable ; panneau de détail à droite ; double toucher sur Espaces | **envisagée** : décrits comme cible dans [evolution-ui.md](../evolution-ui.md#architecture-de-navigation), absents du code (seuls `/`, ⌘K, ⌘Z et `[`/`]` existent) | — | — | contradiction C3 |

### Espaces et types de module

| Fonctionnalité | Statut | Point d'entrée | Cibles | Références |
|---|---|---|---|---|
| Premier accueil « Composer ton espace » (trois chemins, ou tous les modèles) | disponible (comptes neufs) | accueil | Héb., `ART` | `views/accueil.js` |
| Créer depuis un modèle ou un type vide, renommer, domaine, ordre, sigil, activer, supprimer (nom retapé) | disponible | Réglages → Espaces | idem | README, « Modules » |
| Réglages d'un espace sur place (« régler ») | disponible | en tête de l'espace | idem | — |
| Boîte de réception (une seule), capture rapide, « Trier une à une » | disponible | accueil, ⊕, boîte | idem | — |
| Capture qui comprend trois motifs (« 12 € courses », « 25 min … », « Module : texte ») | disponible | capture | idem | README |
| Tâches : étoile « Aujourd'hui » plafonnée à trois tous modules confondus, étapes, coûts vers le budget, tirage au sort, pluie sur les tâches à ciel ouvert | disponible | espace Tâches | idem (pluie : Héb.) | — |
| Budget : opérations, enveloppes, mois par mois | disponible | espace Budget | idem | — |
| Programme : calendrier, séances, paliers cochés à la main, décision proposée | disponible | espace Programme | idem | — |
| Objectif cumulatif : saisie en écart ou en total, chapitres, fragments, palimpseste, export Markdown, fin estimée | disponible | espace Écriture | idem | — |
| Rappels, Notes, Collections (colonnes, liste, glisser, `[` `]`), Décisions, Motifs, Arc | disponible | espaces correspondants | idem | — |
| Minuteur de quinze minutes, « Annuler » (six secondes, ⌘Z), brouillons | disponible | partout | idem | — |

### Penser avec

Statut épistémique, provenance, liaisons et tensions, pont de reprise, fiche, dossier de passation, sortes, bilan
(cycle ou mois), test lunaire, vocabulaire, planche de lunaison : **disponibles**, dans toutes les cibles. La carte
céleste est **disponible mais expérimentale** : un critère d'abandon est écrit d'avance (retirée si elle n'est pas ouverte
pendant un mois, à juger fin octobre 2026, [evolution-ui.md](../evolution-ui.md#vague-4--les-pistes-expérimentales)).

### Données et synchronisation

| Fonctionnalité | Statut | Cibles | Références |
|---|---|---|---|
| Sauvegarde complète (export, import qui remplace tout), refus des fichiers hostiles ou trop récents | disponible | toutes | `core/backup.js` |
| Migration des formats 1 à 8 au chargement et à l'import | disponible | toutes | [architecture.md](../architecture.md#données) |
| Stockage IndexedDB (web), copie de secours dans localStorage, coffres natifs | disponible | Héb. | ADR 11, ADR 13 |
| Taille d'un espace : alerte à 3 Mo, refus du serveur au-delà de 5 Mo | partielle : la contrainte serveur n'existe que si elle a été posée sur le projet | Héb. connectées | [compte.md](../compte.md#taille-dun-espace) |
| Synchronisation Supabase : fusion à trois voies, écriture conditionnelle, relecture toutes les 30 s, envoi à la fermeture | disponible | Héb. connectées | ADR 3, ADR 4 |
| Synchronisation de l'artefact par la base de claude.ai | disponible, jamais essayée hors VM | `ART` | ADR 1 |
| Hors-ligne de la PWA (service worker) | disponible | `Web`, `Mob` | `sw.js` |

### Connexions externes

Toutes **disponibles** dans les cibles hébergées et absentes de l'artefact, sauf mention : Sources (Crossref, Microlink, ou
le passeur), Musique (MusicBrainz, Cover Art Archive), ciel et météo (Open-Meteo ; étoiles filantes et éclipses en table
fixe jusqu'en 2030, sans réseau), pluie sur les tâches, radar culturel (OpenAgenda, par le passeur quand la lecture directe
est refusée), import Instagram (sur l'appareil, aussi dans l'artefact), passeur, Dehors, Artist Watch, veille de recherche
(OpenAlex), « ce que tes sources ont en commun », calendrier iCal, Zotero en lecture seule, « Envoyer à Selene » (partage
Android, favori, Raccourci iOS, liens `selene://`). Le passeur et Dehors exigent un compte connecté **et** que le compte
figure dans `PASSEUR_USERS` : pour un compte de recette, c'est un réglage serveur à faire (partielle, de ce point de vue).

### Assistant

**Disponible** : dans l'artefact par le compte claude.ai, dans les cibles hébergées par la fonction `assistant` et la clé
de la personne (chiffrée côté serveur). Quatre outils d'écriture (ajouter une tâche, en terminer une, déposer dans la
boîte, enregistrer une opération), chacun soumis à l'accord de la personne. **Partielle** pour la recette : il faut une
clé Anthropic de test, à la dépense plafonnée.

### Reprendre la main

**Disponible, restreint** : proposé à la création au seul compte marqué `selene_personnel` ; un suivi existant reste
ouvert partout ; un nouveau suivi est gardé sur l'appareil, jamais synchronisé. **Envisagé** : l'exclusion du type des
versions des stores, à la construction (exigée par la règle 2.3.1 d'Apple avant une publication). **Exclu de cette
livraison**, et donc à ne pas tester : toute série d'abstinence ([regulation.md](../regulation.md#marques-et-récompense-facultatives)).

### Plateformes natives

| Fonctionnalité | Statut | Cibles |
|---|---|---|
| Coffres natifs (fichiers, Keystore, Trousseau, Gestionnaire d'identification) | disponible | `AND`, `IOS`, `WIN` |
| Partage vers Selene : menu « Partager » (Android), Raccourci (iOS), liens `selene://` | disponible | `AND`, `IOS`, `WIN` |
| Extension de partage iOS native | envisagée (demande un App Group, donc un compte Apple Developer) | `IOS` |
| Bouton retour, mise en arrière-plan qui envoie ce qui attend | disponible | `AND` (retour), `AND`/`IOS` |
| Résumé du matin (notifications locales), retour haptique | disponible | `AND`, `IOS` |
| Widget d'écran d'accueil | disponible | `AND` |
| Instance unique, Ctrl+Alt+S, zone de notification | disponible | `WIN` |
| Installateur Windows signé | partielle : signé seulement si un certificat est fourni aux secrets | `WIN` |
| Publication dans les stores (workflow `release.yml`) | partielle : chaque plateforme est sautée tant que ses secrets manquent | `AND`, `IOS`, `WIN` |

### Hors application

La page publique de test (`essai.html` : audience, liste d'attente) est **disponible** et entre dans la recette
([transverse.md](manuels/transverse.md)). Le test d'isolation entre comptes (`npm run isolation`) est un outil à lancer
contre un projet de préproduction ; il n'est pas une fonctionnalité de l'app.

## Travaux parallèles

| Branche ou PR | État | Effet sur la recette |
|---|---|---|
| PR #78 (Dependabot) : Playwright 1.56.1 → 1.63.0, `@tauri-apps/cli` 2.12.0 → 2.12.1 | ouverte ; son Check a échoué le 4 octobre sur `activite.js` (WebKit), l'instabilité connue (A1) | change les navigateurs de la CI : à la fusion, mettre à jour la référence de version et rejouer la suite navigateur |
| `fix/assistant-tool-permissions`, `refactor/domain-operations`, `refactor/source-and-backups` (24 septembre) | sans PR ouverte, sans ancêtre commun avec `main` (historique réécrit) ; leur contenu y a été repris autrement (permissions de l'assistant vérifiées à l'exécution : `TU-APP-02`) | hors périmètre |
| `fix/radar-reliability` (30 septembre, 2 commits) | sans PR ouverte ; le radar de `main` a changé depuis (jeu national OpenAgenda) | hors périmètre, vraisemblablement remplacée |
| `claude/elegant-hawking-so41zq`, `claude/funny-dijkstra-lupho0` (29 septembre) | sans PR ouverte, plus de 80 commits d'écart | hors périmètre |

## Contradictions entre documentation, code et tests

Relevées pendant l'analyse ; aucune n'a été corrigée ici (la correction revient à la responsable, voir [backlog.md](backlog.md#documentation)).

| # | Où | Ce qui est écrit | Ce que font le code et les tests | Conséquence pour la recette |
|---|---|---|---|---|
| C1 | README (section « Reprendre la main ») ; [regulation.md](../regulation.md#parcours), étape 2 du parcours | Connectée, on choisit « où le garder » : sur l'appareil, « ou synchronisé avec un accord explicite ». | Aucun choix : un nouveau suivi reste sur l'appareil (`subjectForm`, `TU-REG-27`, `TN-regulation-appareil`). La section « Hors de l'offre publique » du même document le dit. | Les cas suivent le code et la section la plus récente ; l'étape 2 et le README sont périmés. |
| C2 | README (section « Reprendre la main ») | L'espace est présenté comme un espace facultatif ouvert à toutes et tous. | Il n'est proposé qu'au compte marqué `selene_personnel` (`offered`, `TU-REG-30`). | Les cas d'offre (`RLM-001`, `RLM-002`) distinguent les deux comptes. |
| C3 | [evolution-ui.md](../evolution-ui.md#architecture-de-navigation) | Raccourcis `c`, `t`, `g a/b/r`, `j`/`k`, `x`, `e`, `?`, rail de sigils repliable, panneau de détail, double toucher sur Espaces. | Absents du code. | Classés « envisagés », aucun cas. |
| C4 | [a-faire.md](../a-faire.md#essayer-sur-de-vrais-appareils) | « Les contrôles automatiques sont faits (axe-core sur quinze vues…) ». | Le balayage axe-core a été fait une fois, à la main, le 4 octobre ([evolution-ui.md](../evolution-ui.md)) ; aucun test ne le rejoue. Seuls ses correctifs sont figés (`TN-contraste`, `TN-cibles`, `TN-cibles-ordinateur`). | Couverture d'accessibilité « partielle », pas « automatique » ; automatisation proposée ([backlog.md](backlog.md)). |
| C5 | [regulation.md](../regulation.md#parcours-manuel-cinq-minutes), étape 1 | « Accueil → Reprendre la main → Ajouter ». | Les modèles de l'accueil ne s'affichent que dans le bloc « Composer ton espace », réservé aux comptes neufs ; un compte existant passe par Réglages → Espaces → Créer un espace. | `RLM-001` passe par les Réglages. |
| C6 | README, « Vérification locale » | `npm run check` = « build, tests unitaires, syntaxe, eslint, passeur ». | Il lance aussi `npm run i18n` (`package.json`). | Aucune ; à compléter dans le README. |

## Anomalies et observations

Constatées, pas corrigées. Chacune est à qualifier par un ticket.

| # | Constat | Preuve | Gravité proposée |
|---|---|---|---|
| A1 | **Test instable** `tests/browser/activite.js` sous WebKit : le scénario échoue sur « aucune erreur JavaScript » quand une requête `app_state` est interrompue par le rechargement (« … due to access control checks »). Un correctif (« recharger sans requête en vol », commit `78b240d`) n'a pas suffi. Reste à savoir si le défaut est dans le test ou dans l'app (une promesse rejetée non rattrapée au rechargement, que le journal des erreurs pourrait aussi envoyer). | Échecs des runs Actions `37166847299` (PR #78, 4 octobre, 01 h 08) et `37180520608` (`main`, commit `5549d3b`, 05 h 43) ; vert au commit suivant. | P2 (fiabilité de la CI) |
| A2 | `tests/browser/secours.js` a échoué deux fois (Chromium, WebKit) pendant le développement de sa propre branche `fix/journal-de-secours`, avant le correctif « déclencher pagehide puis fermer ». Aucun échec depuis : à surveiller, pas à classer instable. | Runs `37161823890`, `37163578221` (3 et 4 octobre) | — |
| A3 | Un fichier de sauvegarde hostile (identifiant piégé) est refusé avec le message générique « Fichier illisible ou pas une sauvegarde Selene. », sans dire quel champ pose problème. Le refus est le bon ; le message ne permet pas à la personne de comprendre si son fichier est abîmé ou piégé. | Import de `donnees/refus-hostile.json` dans Chromium (4 octobre) | P3, [À ARBITRER] |

## Points à arbitrer

- **Firefox** : cible prise en charge ou non ? Aucun test ne le couvre ; s'il l'est, ajouter le moteur à la matrice de CI.
- **Compte de recette marqué `selene_personnel`** : nécessaire pour tester l'offre de « Reprendre la main » sans utiliser le
  compte personnel.
- **Date qui change, app ouverte** : l'accueil, « Aujourd'hui » et le point du jour suivent la date au rendu suivant ; aucune
  règle ne dit s'ils doivent se redessiner d'eux-mêmes à minuit (cas `TRV-004`).
- **Message d'un import refusé** (A3).

## Blocages rencontrés pendant l'analyse

Ce qui n'a pas pu être exécuté dans l'environnement de travail (conteneur Linux, sans appareil) :

- **WebKit** : navigateur non installé (et installation non permise) ; la suite navigateur n'a tourné que dans Chromium.
  La CI la joue dans les deux moteurs.
- **Tests Rust** (`cargo test`, `native/tauri`) : Tauri ne compile pas sans `webkit2gtk-4.1`, absent ; la CI les lance sous
  Windows.
- **Compilations Android et iOS** : ni SDK Android configuré, ni Xcode ; vérifiées par la CI (`android.yml`, `ios.yml`).
- **Tout essai sur appareil réel, sur claude.ai, contre le vrai projet Supabase ou une vraie clé Anthropic** : impossible
  ici, et à faire à la main selon les cas manuels.
