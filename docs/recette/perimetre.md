# Périmètre de la recette

Ce qui est réellement dans Selene au commit de référence (`768eb34`, 4 octobre 2026, complété jusqu'à `362f379`, 5 octobre, puis relu
contre `cab3ec8`, 6 octobre), d'après le code, les tests et la documentation lus ensemble. Quand ils divergent, la divergence est notée plus bas plutôt que tranchée en silence.

Statuts : **disponible** (dans `main`, atteignable par l'interface), **partielle** (une partie seulement est livrée, ou elle
dépend d'un réglage serveur ou d'un compte que le dépôt ne peut pas garantir), **autre branche** (dans une branche ou une
PR non fusionnée), **envisagée** (décrite dans un document, absente du code). Les cas manuels ne couvrent que le
disponible et le partiel ; l'envisagé figure ici pour qu'on ne le teste pas par erreur.

## Cibles

| Cible | Statut | Construite et vérifiée en CI | Essai sur un vrai appareil |
|---|---|---|---|
| Site hébergé (`index.html`, GitHub Pages), navigateur d'ordinateur | disponible | build, tests unitaires, 80 scénarios dans Chromium, WebKit et Firefox (Firefox non bloquant jusqu'au 20 octobre 2026, [BL-13](backlog.md#bl-13)) ; publié par `pages.yml` seulement si Check est vert | Chromium et Firefox : oui, par la CI ; Safari : moteur WebKit en CI, pas Safari lui-même |
| PWA installée (iPhone, Android) | disponible | service worker et manifeste vérifiés (`hors-ligne.js`, `build.test.js`) | jamais fait ([a-faire.md](../a-faire.md#essayer-sur-de-vrais-appareils)) |
| Artefact claude.ai (`selene.html`) | disponible | testé dans une VM Node (faux DOM), jamais dans claude.ai | jamais fait (« Hors CI » dans [architecture.md](../architecture.md#vérification)) |
| App Android (Capacitor) | disponible, non publiée | APK de débogage compilé, chemin de signature éprouvé avec une clé jetable (`android.yml`) ; lancé sur un émulateur Android 15 : démarrage, relance, mise à jour vers l'édition des stores (`android-fumee.yml`, [BL-07](backlog.md#bl-07)) | jamais fait |
| App iOS (Capacitor) | partielle | compilée pour le simulateur, sans signature (`ios.yml`) ; l'installer demande un compte Apple Developer | jamais fait |
| App Windows (Tauri) | disponible, non publiée | tests Rust et installateur NSIS (`desktop.yml`) ; non signé sans certificat ; installé et lancé sur le runner Windows : données relues après relance, une seule fenêtre ([BL-08](backlog.md#bl-08)) | jamais fait |
| Firefox sur téléphone | non visé (décision du 6 octobre 2026, [BL-13](backlog.md#bl-13)) | — | — |
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
| Synchronisation de l'artefact par la base de claude.ai, dans l'espace privé de chacun | disponible, jamais essayée hors VM ; anomalie A17 ouverte | `ART` | ADR 1, ADR 33 |
| Hors-ligne de la PWA (service worker) | disponible | `Web`, `Mob` | `sw.js` |

### Connexions externes

Toutes **disponibles** dans les cibles hébergées et absentes de l'artefact, sauf mention : Sources (Crossref, Microlink, ou
le passeur), Musique (MusicBrainz, Cover Art Archive), ciel et météo (Open-Meteo ; étoiles filantes et éclipses en table
fixe jusqu'en 2030, sans réseau), pluie sur les tâches, radar culturel (OpenAgenda, par le passeur quand la lecture directe
est refusée), import Instagram (sur l'appareil, aussi dans l'artefact), passeur, Dehors, Artist Watch, veille de recherche
(OpenAlex), « ce que tes sources ont en commun », calendrier iCal, Zotero en lecture seule, « Envoyer à Selene » (partage
Android, favori, Raccourci iOS, liens `selene://`). Depuis `89d1ba0` : l'**export des sources en BibTeX et en CSL-JSON** (sur l'appareil, sans service). Depuis
`14e1961` : dans les apps, « Ma position » ne demande que la **position approximative**. Depuis `a5929fc` : dans les apps,
les **exports passent par la feuille de partage** du système. Depuis `7ffb4ce` : l'**import de notes Markdown** (Obsidian,
Zettlr) dans un module de notes. Depuis `f2c7009` : la **relecture de la semaine** (accueil, bilan). Depuis `c2f3610` : la
politique de confidentialité permet de **demander la suppression d'un compte sans l'app**. Le passeur et Dehors exigent un compte connecté **et** que le compte
figure dans `PASSEUR_USERS` : pour un compte de recette, c'est un réglage serveur à faire (partielle, de ce point de vue).

### Assistant

**Disponible** : dans l'artefact par le compte claude.ai, dans les cibles hébergées par la fonction `assistant` et la clé
de la personne (chiffrée côté serveur). Quatre outils d'écriture (ajouter une tâche, en terminer une, déposer dans la
boîte, enregistrer une opération), chacun soumis à l'accord de la personne. **Partielle** pour la recette : il faut une
clé Anthropic de test, à la dépense plafonnée.

### Reprendre la main

**Disponible, restreint** : proposé à la création au seul compte marqué `selene_personnel` ; un suivi existant reste
ouvert partout dans l'édition complète (web, APK de la Release GitHub, Windows) ; un nouveau suivi est gardé sur
l'appareil, jamais synchronisé. **Absent des versions des stores** (AAB de Google Play, app iOS, TestFlight compris),
construites sans le type (règle 2.3.1 d'Apple ; [regulation.md](../regulation.md#absent-des-versions-des-stores)) : un
suivi créé ailleurs y est gardé tel quel, sans être ouvert (`RLM-030`). **Exclu de cette livraison**, et donc à ne pas
tester : toute série d'abstinence ([regulation.md](../regulation.md#marques-et-récompense-facultatives)).

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
| Publication dans les stores (workflow `release.yml`) : APK et Windows en édition complète, AAB et iOS en édition des stores | partielle : chaque plateforme est sautée tant que ses secrets manquent | `AND`, `IOS`, `WIN` |

### Hors application

La page publique de test (`essai.html` : audience, liste d'attente) est **disponible** et entre dans la recette
([transverse.md](manuels/transverse.md)). Le test d'isolation entre comptes (`npm run isolation`) est un outil à lancer
contre un projet de préproduction ; il n'est pas une fonctionnalité de l'app. Le workflow *Sauvegarde* (la copie chiffrée
de la base, chaque lundi) non plus : c'est un outil d'exploitation, vérifié par [TRV-017](manuels/transverse.md#trv-017),
qui n'a encore jamais tourné faute de ses réglages ([a-faire.md](../a-faire.md#régler-le-projet-supabase-si-ce-nest-pas-déjà-fait)).
Les pages du cahier publiées en artefact (`npm run recette -- page`) sont des vues du cahier, pas de l'app.

## Travaux parallèles

| Branche ou PR | État | Effet sur la recette |
|---|---|---|
| PR #78 (Dependabot) : Playwright 1.56.1 → 1.63.0, `@tauri-apps/cli` 2.12.0 → 2.12.1 | fusionnée (`5197c5f`) : Playwright 1.63.0 sur `main` ; la référence de version du [README](README.md) le dit | — |
| `fix/assistant-tool-permissions`, `refactor/domain-operations`, `refactor/source-and-backups` (24 septembre) | sans PR ouverte, sans ancêtre commun avec `main` (historique réécrit) ; leur contenu y a été repris autrement (permissions de l'assistant vérifiées à l'exécution : `TU-APP-02`) | hors périmètre |
| `fix/radar-reliability` (30 septembre, 2 commits) | sans PR ouverte ; le radar de `main` a changé depuis (jeu national OpenAgenda) | hors périmètre, vraisemblablement remplacée |
| `claude/elegant-hawking-so41zq`, `claude/funny-dijkstra-lupho0` (29 septembre) | sans PR ouverte, plus de 80 commits d'écart | hors périmètre |

## Contradictions entre documentation, code et tests

Relevées pendant l'analyse ; toutes corrigées depuis, le 5 octobre 2026 (voir [backlog.md](backlog.md#documentation)).

| # | Où | Ce qui est écrit | Ce que font le code et les tests | Conséquence pour la recette |
|---|---|---|---|---|
| C1 | README (section « Reprendre la main ») ; [regulation.md](../regulation.md#parcours), étape 2 du parcours | Connectée, on choisit « où le garder » : sur l'appareil, « ou synchronisé avec un accord explicite ». | Aucun choix : un nouveau suivi reste sur l'appareil (`subjectForm`, `TU-REG-27`, `TN-regulation-appareil`). La section « Hors de l'offre publique » du même document le dit. | Les cas suivent le code et la section la plus récente ; l'étape 2 et le README sont périmés. **Corrigée** le 5 octobre 2026, avec l'édition des stores (README, regulation.md). |
| C2 | README (section « Reprendre la main ») | L'espace est présenté comme un espace facultatif ouvert à toutes et tous. | Il n'est proposé qu'au compte marqué `selene_personnel` (`offered`, `TU-REG-30`). | Les cas d'offre (`RLM-001`, `RLM-002`) distinguent les deux comptes. **Corrigée** le 5 octobre 2026, avec l'édition des stores (README, regulation.md). |
| C3 | [evolution-ui.md](../evolution-ui.md#architecture-de-navigation) | Raccourcis `c`, `t`, `g a/b/r`, `j`/`k`, `x`, `e`, `?`, rail de sigils repliable, panneau de détail, double toucher sur Espaces. | Absents du code. | Classés « envisagés », aucun cas. **Corrigée** le 5 octobre 2026. |
| C4 | [a-faire.md](../a-faire.md#essayer-sur-de-vrais-appareils) | « Les contrôles automatiques sont faits (axe-core sur quinze vues…) ». | Le balayage axe-core a été fait une fois, à la main, le 4 octobre ([evolution-ui.md](../evolution-ui.md)) ; aucun test ne le rejoue. Seuls ses correctifs sont figés (`TN-contraste`, `TN-cibles`, `TN-cibles-ordinateur`). | Couverture d'accessibilité « partielle », pas « automatique » ; automatisation proposée ([backlog.md](backlog.md)). **Corrigée** le 5 octobre 2026. |
| C5 | [regulation.md](../regulation.md#parcours-manuel-cinq-minutes), étape 1 | « Accueil → Reprendre la main → Ajouter ». | Les modèles de l'accueil ne s'affichent que dans le bloc « Composer ton espace », réservé aux comptes neufs ; un compte existant passe par Réglages → Espaces → Créer un espace. | `RLM-001` passe par les Réglages. **Corrigée** le 5 octobre 2026. |
| C6 | README, « Vérification locale » | `npm run check` = « build, tests unitaires, syntaxe, eslint, passeur ». | Il lance aussi `npm run i18n` (`package.json`). | Aucune ; à compléter dans le README. **Déjà corrigée** dans le README, constaté le 5 octobre 2026. |

## Anomalies et observations

Constatées pendant la recette. Une anomalie corrigée garde sa ligne, complétée par « Corrigée : PR … »
([maintenance.md](maintenance.md#la-correction-dune-anomalie)) ; une anomalie ouverte est à qualifier par un ticket.
**Aucune ouverte au 6 octobre 2026** ; à surveiller : A2 et A9. Ce qu'il reste à faire pour chacune est dans le
[backlog](backlog.md#reste-a-faire).

| # | Constat | Preuve | Gravité proposée |
|---|---|---|---|
| A1 | **Test instable** `tests/browser/activite.js` sous WebKit : le scénario échoue sur « aucune erreur JavaScript » quand une requête `app_state` est interrompue par le rechargement (« … due to access control checks »). Un correctif (« recharger sans requête en vol », commit `78b240d`) n'a pas suffi. Reste à savoir si le défaut est dans le test ou dans l'app (une promesse rejetée non rattrapée au rechargement, que le journal des erreurs pourrait aussi envoyer). | Échecs des runs Actions `37166847299` (PR #78, 4 octobre, 01 h 08) et `37180520608` (`main`, commit `5549d3b`, 05 h 43) ; vert au commit suivant. | P2 (fiabilité de la CI) ; **correctif côté test sur `main`** (`3a79a01`, « attendre vraiment la fin des requêtes avant de recharger ») : **confirmé** : aucun échec d'`activite.js` en 32 exécutions WebKit de la CI depuis (18 sur des PR, 13 déploiements, 1 échec dû à A9 ; relevé du 5 octobre) |
| A2 | `tests/browser/secours.js` a échoué deux fois (Chromium, WebKit) pendant le développement de sa propre branche `fix/journal-de-secours`, avant le correctif « déclencher pagehide puis fermer ». Aucun échec depuis : à surveiller, pas à classer instable. | Runs `37161823890`, `37163578221` (3 et 4 octobre) | — |
| A3 | Un fichier de sauvegarde hostile (identifiant piégé) est refusé avec le message générique « Fichier illisible ou pas une sauvegarde Selene. », sans dire quel champ pose problème. Le refus est le bon ; le message ne permet pas à la personne de comprendre si son fichier est abîmé ou piégé. | Import de `donnees/refus-hostile.json` dans Chromium (4 octobre) ; voir [DON-005](manuels/donnees-sauvegardes.md#don-005) | **Corrigée** (PR #99 : trois causes distinguées, « pas du JSON », « pas une sauvegarde Selene », « contenu invalide », sans nommer le champ ; test `TU-BAK-09`) ; P3 |
| A4 | Quand la fonction `assistant` a répondu 404 (non déployée) ou 503 (non configurée), coller une clé dans Réglages → Assistant affiche « Clé non enregistrée : L'assistant hébergé demande d'être connectée à ton compte. », alors que la personne **est** connectée ; la vraie cause (« Assistant non déployé ») n'est montrée nulle part, et la vue Assistant dit « Pas encore branché. Colle ta clé API dans Réglages. » comme si seule la clé manquait. Même message « Pas encore branché » quand la fonction est injoignable. Cause lue dans le code : `assistantEtat = "absent"` rend `assistantPret()` faux, et `assistantCall` répond alors par le message « demande d'être connectée » (`src/app/features/assistant.js`). | Sonde Chromium, faux Supabase répondant 404 à `/functions/v1/assistant` (4 octobre) ; voir [AST-007](manuels/assistant.md#ast-007) | **Corrigée** (PR #98 : la vue Assistant et les Réglages disent « non déployé », « non configuré » ou « injoignable » ; test `TN-assistant-injoignable`) ; P3 |
| A5 | Typographie des dates abrégées en fin de phrase : « Objectif enregistré, à partir du 14 oct.. D'ici là, rien ne change. », « Supprimé : 1 verre standard le 10 sept.. Cette journée est à reconfirmer. » (point doublé) ; « à partir du 1 septembre 2026 » (au lieu de « 1er ») ; le résumé destiné à l'assistant, montré tel quel à la personne avant le partage, écrit « au plus 1.5 verres standard » et « 0 verres standard ». Aucun effet sur les données. | Sonde Chromium avec `donnees/rlm-en-cours.json` (4 octobre) ; voir [RLM-013](manuels/reprendre-la-main.md#rlm-013), [RLM-014](manuels/reprendre-la-main.md#rlm-014), [RLM-021](manuels/reprendre-la-main.md#rlm-021) | **Corrigée** (PR #98 : dates en lettres dans les messages, « 1er » en français, résumé de l'assistant en virgule décimale et au singulier ; tests `TU-I18N-18`, `TU-REG-36`, `TN-regulation`) ; P3 |
| A6 | Un suivi « Reprendre la main » tout juste créé par une personne connectée, pas encore configuré, affiche dans « Confidentialité et données » : « Encore synchronisé avec ton compte, depuis sa création : sur le serveur de Selene… garde-le sur un appareil », avec le bouton « Garder sur cet appareil seulement… ». Il n'a encore aucun contenu (le serveur n'en a que le nom) et passe sur l'appareil dès la configuration : rien ne fuit, mais le texte contredit la promesse « gardé sur l'appareil » au moment où la personne le lit pour la première fois. | Sonde Chromium, compte personnel sur faux Supabase (4 octobre) ; voir [RLM-003](manuels/reprendre-la-main.md#rlm-003) | **Corrigée** (PR #99 : « Pas encore configuré : ton compte n'en garde que le nom… » avant la configuration ; test `TU-REG-37`) ; P3 |
| A7 | Se déconnecter en choisissant « L'effacer définitivement » (garde de déconnexion) efface le contenu du suivi de l'appareil, mais **son talon reste sur le compte** (nom, appareil détenteur). De retour sur le même appareil, l'espace affiche « Ce suivi devait être gardé sur cet appareil, mais ses données n'y sont plus (stockage du navigateur ou de l'app effacé ?). Une sauvegarde complète faite ici peut les restaurer ; sinon, tu peux retirer ce suivi. » : un effacement voulu se présente comme un accident, et le nom d'un suivi « effacé définitivement » survit. | Sonde Chromium, compte personnel sur faux Supabase : talons lus sur le faux serveur après la déconnexion, puis écran au retour (4 octobre) ; voir [RLM-023](manuels/reprendre-la-main.md#rlm-023) | **Corrigée** (PR #101 : décision de la responsable, l'effacement retire aussi le talon du compte ; tests `TU-REG-38` et `TN-regulation-appareil`) ; P3 |
| A8 | Import de notes Markdown : si le navigateur ne peut pas lire un des fichiers choisis (fichier déplacé, supprimé ou resté dans un nuage après sa sélection), **tout l'import échoue sans message** : `Promise.all` sur `f.text()` rejette, et la promesse n'est rattrapée nulle part (`src/app/modules/notes.js`, `importMarkdown`, et le gestionnaire `notes-md`). La personne ne voit rien se passer ; le journal des erreurs reçoit l'erreur. | Sonde Chromium (5 octobre) : fichiers donnés par chemin, dont un au nom accentué que l'outil de test ne relisait pas (artefact de l'outil, qui a déclenché la condition) : « The requested file could not be read » en erreur de page, aucun message. Les mêmes fichiers donnés en mémoire s'importent entiers. Cause lue dans le code. Voir [MOD-026](manuels/types-de-module.md#mod-026) | **Corrigée** (PR #98 : les fichiers illisibles sont ignorés et comptés ; tests `TU-MKD-05`, `TN-import-markdown`) ; P3 |
| A9 | **Test instable** `tests/browser/regulation.js` sous WebKit, étape « cocher le partage » : le scénario coche la case de partage avec l'assistant (`box.check({ force: true })`) et attend la boîte de confirmation (`#cdlg[open]`), qui ne vient pas en 30 s. Le clic, tombé pendant un rendu, s'est perdu : rien n'a ouvert la boîte. Vert sur `main` (4188d74) le même jour ; la PR qui l'a vu échouer ne touchait pas l'app. | Run `37323531605` (5 octobre, PR #100) ; reproduit en local (Chromium) en perdant volontairement le premier clic : même délai dépassé, même ligne. | P3 (fiabilité de la CI) ; **correctif côté test** (PR #100 : la case est recochée tant que la boîte ne s'ouvre pas, trois fois au plus ; si l'app ne l'ouvre jamais, le scénario échoue comme avant) : stabilité à confirmer sur plusieurs exécutions WebKit |
| A10 | **Échec isolé** de `tests/browser/dehors.js`, premier contrôle « une porte dans la navigation ; rien encore », pendant une suite complète locale sous Chromium (6 scénarios en parallèle). Le code de Dehors et ce scénario n'étaient pas modifiés. Cause probable, lue dans le test : un délai fixe (`waitForTimeout(600)`) avant le premier contrôle, alors que la vue n'affiche « Aucun flux suivi » qu'une fois la session prête (`dehorsOn`, `src/app/features/dehors.js`) ; le contrôle suivant, un instant plus tard, passait. | 5 octobre, branche `fix/anomalie-a7` : 1 échec en 11 exécutions (non reproduit en 6 exécutions seules, 3 sous charge de 17 scénarios, 1 suite complète) | **Corrigée côté test** (PR #103 : le scénario attend le texte, plus un délai). Reproduite d'abord : le processeur de Chromium ralenti ×8 ou ×15 (protocole DevTools), l'ancien scénario échoue à chaque fois sur ce contrôle, le nouveau passe ; P3 |
| A11 | **Test instable** `tests/browser/mot-de-passe.js` : trois échecs **sur `main`**, donc trois déploiements bloqués, sur du code déjà vert en PR. Le 4 octobre à 00 h 43 (fusion de #75, Chromium) : « et entrer » ; à 05 h 25 (fusion de #83, WebKit) : « Réglages, Compte : le changement est proposé, ouvert » ; le 5 octobre à 15 h 38 (fusion de #104, une PR de documentation seule, Chromium) : « et entrer », quelques minutes avant la fusion du correctif. Cause, lue dans le test et reproduite : chaque contrôle suit une pause fixe (300 à 500 ms) au lieu d'attendre l'état attendu ; avec le processeur ralenti ×8 ou ×15, l'ancien scénario échoue sur « et entrer », « fermées : plus de « Créer un compte »… » et « connexion avec un mot de passe devenu trop court : on entre… ». | Runs Pages `37165798203`, `37179846517` et `37333915406` ; sondes locales sous ralentissement (5 octobre) | **Corrigée côté test** (PR #103 : attendre l'état aux cinq contrôles concernés ; les délais qui vérifient qu'aucune requête ne part restent, une absence ne s'attend pas) ; P2 (fiabilité du déploiement) |
| A12 | **Confidentialité de l'artefact claude.ai** : `selene.html` rangeait le carnet entier (site, board) dans les documents `site/state` et `board/state` de l'espace `db` de l'artefact. Ce sont des documents partagés : d'après le contrat de `db`, toute personne connectée à qui l'on donne le lien les lit, et, sur un abonnement d'équipe, les membres qui peuvent ouvrir l'artefact les réécrivent. Partager l'artefact pour montrer l'outil montrait le carnet. | Lecture du contrat `db` de claude.ai (sous-arbre `data/users/<id>/` seul privé) et de `src/app/boot.js` (6 octobre) ; voir [PLT-011](manuels/plateformes.md#plt-011) | **Corrigée** (ADR 33 : le sous-arbre privé de chaque personne, les anciens documents partagés rapatriés par la propriétaire puis effacés ; tests `TU-ART-01` à `TU-ART-05`). Aucun artefact Selene n'était publié sur le compte ; P1 |
| A13 | **Espace zombie** : un espace supprimé sur un appareil (A) pendant qu'un autre (B), hors ligne, y ajoutait ou modifiait quelque chose **revenait sur les deux appareils**, avec la modification de B, et retrouvait sa place dans la navigation. Cause : la fusion à trois voies garde une entrée supprimée d'un côté si l'autre l'a modifiée (`core/sync.js`), et la normalisation rend une place dans la navigation à tout module présent. Le cahier posait la question (SYN-006) en croyant que la suppression gagnait déjà, comme `TU-SYN-05` le laisse penser : ce test ne couvre que l'autre appareil sans modification. | Sonde Node, deux appareils sur faux Supabase : B modifie `phidippus` hors ligne, A le supprime ; après synchronisation, présent sur A et B (6 octobre) ; voir [SYN-006](manuels/synchronisation.md#syn-006) | **Corrigée** (ADR 34 : pierres tombales dans `config.deleted`, l'appareil qui perd ses modifications le dit ; tests `TU-SYN-22` et `TU-SYN-23`) ; P1 |
| A14 | **Premier passage sous Firefox** (PR #111, le 6 octobre) : 74 scénarios sur 78 verts. Quatre échecs, quatre causes. `cibles.js` : les onglets d'une collection et les liens « ouvrir ↗ » des sources n'offraient que 43 px au doigt, un vrai défaut (une marge négative faisait passer le bas des onglets sous la bordure de leur conteneur défilant, que Firefox rogne ; la zone agrandie du lien suivait une ligne plus basse). `secours.js` : le scénario lisait le stockage depuis une adresse absente, à laquelle le serveur des scénarios répond 404 sans contenu, que Firefox ne finit jamais de charger (et que le Chromium du conteneur de développement refuse : c'était l'échec local qu'on croyait propre à l'environnement). `mot-de-passe.js` et `veille.js` : deux contrôles suivaient une pause fixe au lieu d'attendre l'état (comme A11). | Run *Check › browser (firefox)* `37425980591` (6 octobre) | **Corrigée** : les onglets et le lien gardent 44 px dans les trois moteurs ; la page sans script de la politique de confidentialité pour lire le stockage ; attendre l'état, et recopier ce qui s'affiche si la vérification échoue. Second passage (PR #112) : 77 sur 78 ; `veille.js` disait « aucune requête partie » : sous Firefox piloté par Playwright, Tab ne quittait pas le champ de la clé, dont l'enregistrement, qui redessine la page, effaçait ensuite l'ORCID tapé dans le champ suivant ; le scénario quitte désormais le champ autrement si Tab ne l'a pas fait, et le dit dans le journal. Troisième passage : **78 sur 78** (le journal confirme : « Tab n'a pas quitté le champ de la clé »). P3 (Firefox non bloquant jusqu'au 20 octobre) |
| A15 | **La saisie de l'écran de connexion s'effaçait sous les doigts.** L'écran se redessine aussi sans geste : un autre onglet qui enregistre, la fin du démarrage, la réponse du serveur sur les inscriptions. Il était alors remplacé d'un bloc, et l'adresse et le mot de passe en cours de frappe disparaissaient, avec le curseur. Envoyé ensuite, le formulaire au champ requis vide ne partait pas, sans un mot. Trouvé par Firefox le 6 octobre (PR #115, `mot-de-passe.js` : « envoi non configuré… », message vide), reproduit dans Chromium par un second onglet qui enregistre pendant la frappe. | Run *Check › browser (firefox)* `37434206840` (6 octobre) ; sonde Chromium | **Corrigée** (PR #116) : l'écran se redessine en gardant ce qui est tapé et le curseur ; après un envoi, les mots de passe repartent à vide comme avant. Vérifié par `TN-mot-de-passe` (contrôle « un autre onglet enregistre pendant la frappe »), qui échoue sans le correctif. P2 |
| A16 | **Test instable** `tests/browser/mot-de-passe.js` sous Firefox, après la correction d'A15. Sur le déploiement de `main` du 6 octobre (`cab3ec8`, fusion de la PR #117, qui ne touche pas l'app), trois contrôles échouent : « envoi non configuré (SMTP intégré de Supabase) : dit, en français » (message affiché vide), « un autre type de lien : le jeton est effacé de l'adresse, rien d'autre », « une invitation : choisir son mot de passe ». Vert sur `729d8bd`, sur la PR #116 et sur la PR #118, au même code d'app. Le job est resté vert (`continue-on-error`, [BL-17](backlog.md#bl-17)) : seul son journal le disait. Cause supposée, lue dans le test et non reproduite (Firefox absent de l'environnement de travail) : `open()` attend 500 ms au lieu d'un état, et `attendre()` avale son propre dépassement de délai, si bien qu'un contrôle lit un écran qui n'est pas encore prêt ; un défaut de l'app n'est pas exclu. | Run *Pages* `37477429918`, job *Check › browser (firefox)* (6 octobre) ; reproduit dans Chromium en retardant la réponse d'IndexedDB : dès 550 ms, l'ancien scénario échoue à chaque fois sur les cinq contrôles qui suivent l'ouverture d'un lien, dont les deux de Firefox | **Corrigée côté test** (PR #120) : cause confirmée pour les deux contrôles des liens, l'app ne démarre qu'une fois IndexedDB ouverte, après l'événement `load` où `goto` rend la main. Les scénarios attendent son premier rendu (`ouvrir()` de `helpers.js`) ; les envois attendent la réponse ; `attendre()` dit dans le journal quel état n'est pas venu. Le premier contrôle (message vide) avait une autre cause : rejoué 21 fois sous Firefox dans la CI de la PR (trois à la fois), il a échoué une fois, et le nouveau journal a dit « demande jamais partie ; formulaire de demande de lien, adresse remplie » : un clic d'envoi resté sans aucun effet. Aucun rendu intercalé n'a été trouvé dans le code, et des polices retardées ne le reproduisent pas sous Chromium : la cause propre à Firefox n'est pas établie. Le scénario attend désormais les polices avant d'agir (`ouvrir()`), et renvoie une fois un clic sans effet, en le disant dans le journal ; si l'app ne répond jamais, il échoue comme avant. Le même défaut dormait dans sept autres scénarios, débusqués par un démarrage ralenti (`SELENE_LENT`) et corrigés ; un job *Check › browser (chromium, démarrage lent)* le rejoue à chaque PR. Dès sa deuxième course, ce job en a trouvé un d'une autre sorte : `parcours-e2.js` lisait le stockage aussitôt après un clic, avant que l'app y ait écrit (« la source documente l'idée choisie ») ; il attend désormais l'écriture. P2 |
| A17 | **Artefact claude.ai : un suivi « Reprendre la main » d'avant le 3 octobre part dans la base de claude.ai.** Un suivi encore marqué synchronisé (`storage: "account"`), arrivé dans l'artefact par une sauvegarde complète, y reste tel quel : l'artefact relié à sa base (capacités `db` et `user`) range tout le document `site`, contenu du suivi compris (saisies, notes), dans `data/users/<id>/site`. L'écran « Confidentialité et données » dit pourtant « Sur cet appareil : sans compte, rien n'est envoyé au serveur de Selene. » et ne propose pas de ramener le suivi sur l'appareil : ce texte (`whereText`) et le bandeau « Ce suivi doit revenir sur un appareil » (`choiceHTML`) dépendent de `synced()`, faux dans l'artefact, qui n'a pas de compte Selene. Vrai à la lettre (le serveur de Selene ne reçoit rien), faux dans ce qu'il laisse croire. Variante non essayée : le même suivi versé dans un compte Selene au premier envoi. | Sonde Node (VM, fausse base qui suit le contrat de claude.ai) avec `donnees/rlm-synchronise-ancien.json` : les écritures vont à `data/users/u-proprio/site`, le suivi y figure avec `storage: "account"` et sa saisie (note « Pause café ») ; lecture de `src/app/modules/regulation.js` et `src/app/services/artifact-db.js` (6 octobre) ; voir [PLT-011](manuels/plateformes.md#plt-011), [RLM-024](manuels/reprendre-la-main.md#rlm-024) | **Corrigée** (PR #121), comme décidé le 6 octobre : dans l'artefact, un suivi qui n'est pas sur l'appareil y est ramené à l'entrée des données (lecture, import, synchronisation), avant toute écriture, et la base n'en reçoit que le talon ; l'appareil le dit une fois ; « Confidentialité et données » dit ce que garde l'espace privé de claude.ai. La variante est réelle et corrigée de même : sur un appareil sans compte, le suivi importé partait entier au compte au versement (sonde du 6 octobre), il y reste désormais sur l'appareil. Tests `TU-ART-06`, `TU-ART-07`, `TU-REG-41`, qui échouent sans le correctif. P1 en gravité, probabilité faible (aucun artefact publié) |
| A18 | **Au lancement d'un appareil connecté, l'écran d'entrée s'affiche jusqu'aux premières réponses du serveur.** La personne, connectée, voit « Commencer sans compte », « Créer un compte », « J'ai déjà un compte » pendant la première synchronisation, à chaque ouverture : le premier rendu a lieu avant que la session gardée sur l'appareil soit lue (`authBoot`, après le premier `render()` de `boot.js`), et le suivant n'arrive qu'une fois les deux documents branchés (`authConnectStores`, trois allers-retours). Ses données sont pourtant déjà là, sur l'appareil. Toucher « Commencer sans compte » pendant ce temps marque l'appareil « sans compte » alors qu'il est connecté. | Sonde Chromium (6 octobre) : un appareil connecté, son carnet déjà sur place, faux PostgREST fidèle : l'écran d'entrée de 250 à 950 ms à 300 ms de latence par requête, de 250 ms à 3,3 s à 1,5 s ; trouvé en corrigeant A16 | **Corrigée** (PR #122) : la session gardée se lit avant le premier rendu, si les données de l'appareil sont celles de ce compte ; l'app s'affiche d'emblée, comme au démarrage hors ligne, et la synchronisation suit ; un seul branchement à la fois. Même sonde après correction : l'app dès 340 ms environ, à 300 ms comme à 1,5 s de latence, sans écran d'entrée. Tests `TU-AUTH-07` (échoue sans le correctif) et `TU-AUTH-08` (des données d'un autre compte ne s'affichent jamais sous la session). P2 |

**Relevé de la CI au 5 octobre** (les 60 derniers runs de *Check* sur les PR, du 2 au 5 octobre, et les 40 derniers
déploiements *Pages* de `main`, du 1er au 4, plus ceux des PR #97 à #104, le 5) : 7 runs de PR et 5 déploiements en
échec, chacun pour un seul scénario.

| Scénario | Échecs | Où | État |
|---|---|---|---|
| `activite.js` (A1) | 2 | PR #78, `main` (WebKit), 4 octobre | corrigé côté test (`3a79a01`), confirmé |
| `secours.js` (A2) | 2 | sa propre branche, avant son correctif | aucun échec depuis |
| `identite.js` | 2 | `main` (Chromium, 2 octobre), une branche (WebKit, 3 octobre) | corrigé côté test le 3 octobre (`31122f6`, mesurer la feuille après son animation) ; aucun échec depuis |
| `sync-deux-appareils.js` | 2 | deux commits consécutifs d'une branche en cours (3 octobre) | non qualifié : jamais sur `main`, aucun échec depuis |
| `mot-de-passe.js` (A11) | 3 | `main` (Chromium puis WebKit, 4 octobre ; Chromium, 5 octobre, juste avant le correctif) | corrigé côté test (PR #103) ; le déploiement suivant est passé |
| `regulation.js` (A9) | 1 | PR #100 (WebKit, 5 octobre) | corrigé côté test par la #100 |

La cause commune des échecs qualifiés : un scénario qui attend un délai fixe là où il faudrait attendre un état. C'est la
règle des scénarios ([`until`](../../tests/browser/helpers.js), `ouvrir` et `waitForFunction`), écrite dans `helpers.js` ;
les passages qui l'enfreignent encore cassent quand la machine de la CI est chargée. Depuis le 6 octobre 2026 (A16), le
job *Check › browser (chromium, démarrage lent)* les débusque à chaque PR : la base de l'app y répond avec 1,5 s de
retard, et un scénario qui compte sur un délai après l'ouverture y échoue à coup sûr.

## Points à arbitrer

La liste à jour, avec ce que chaque question bloque, est dans [backlog.md](backlog.md#decisions). Relevées pendant
l'analyse : Firefox (cible ou non) ; le compte de recette marqué `selene_personnel` ; la date qui change app ouverte
(`TRV-004`) ; le message d'un import refusé (A3) ; puis, en écrivant les cas : les anomalies A4, A6 et A7, la langue du
résumé destiné à l'assistant (`RLM-028`), le message d'une date d'objectif trop lointaine (`RLM-014`), l'appareil vidé
(`RLM-029`), les seuils de réactivité (`TRV-007`), l'espace `db` de claude.ai (`PLT-011`).

## Blocages rencontrés pendant l'analyse

Ce qui n'a pas pu être exécuté dans l'environnement de travail (conteneur Linux, sans appareil) :

- **WebKit** et **Firefox** : navigateurs non installés (et installation non permise) ; la suite navigateur n'a tourné
  que dans Chromium. La CI la joue dans les trois moteurs.
- **Tests Rust** (`cargo test`, `native/tauri`) : Tauri ne compile pas sans `webkit2gtk-4.1`, absent ; la CI les lance sous
  Windows.
- **Compilations Android et iOS** : ni SDK Android configuré, ni Xcode ; vérifiées par la CI (`android.yml`, `ios.yml`).
- **Tout essai sur appareil réel, sur claude.ai, contre le vrai projet Supabase ou une vraie clé Anthropic** : impossible
  ici, et à faire à la main selon les cas manuels.
