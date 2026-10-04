/* Les textes d'aide de la page Réglages : chapitres, infobulles, premier accueil et vocabulaire. Réunis ici pour
   qu'une traduction n'ait qu'un fichier à reprendre, clé par clé. Des phrases entières, jamais assemblées morceau par
   morceau (l'ordre des mots change d'une langue à l'autre) ; celles qui citent un nom sont des fonctions, pour que la
   traduction le place où sa grammaire le veut. Du texte brut : l'affichage l'échappe.
   Des accesseurs (get) : chaque lecture traduit dans la langue en vigueur, sans que la page ait à le savoir. */
import { tr, trp } from "../i18n/index.js";

/* Les chapitres, du plus courant au plus rare ; leur numéro (I, II…) suit cet ordre. */
export const CHAPTERS = [
  { id: "reg-apparence", get title() { return tr`Apparence et rythme`; }, get intro() { return tr`Ce que tu vois en ouvrant Selene, et quand elle te fait signe.`; } },
  { id: "reg-espaces", get title() { return tr`Espaces`; }, get intro() { return tr`Les pages de ta navigation : les afficher, les nommer, les ranger, régler chacune, en créer d'autres.`; } },
  { id: "reg-ciel", get title() { return tr`Ciel et alentours`; }, get intro() { return tr`Un lieu, et tout ce qui en découle : l'heure et la météo du ciel de l'accueil, la lune à sa place, le radar culturel.`; } },
  { id: "reg-assistant", get title() { return tr`Assistant`; }, get intro() { return tr`Claude dans le tableau de bord : ce qu'il lit, ce qu'il peut faire, avec quel modèle.`; } },
  { id: "reg-connexions", get title() { return tr`Connexions`; }, get intro() { return tr`Ce qui relie Selene au reste : un lien envoyé d'ailleurs, ta bibliothèque Zotero, et le passeur qui lit pour toi ce que le navigateur ne peut pas lire.`; } },
  { id: "reg-compte", get title() { return tr`Compte et données`; }, get intro() { return tr`Emporter tes données, les ramener, et, en dernier recours, tout effacer.`; } }
];

/* Les infobulles : ce qui ne va pas de soi, en quelques lignes. */
export const TIPS = {
  get palette() { return tr`Les quatre étapes du Grand Œuvre des alchimistes : nigredo, l'œuvre au noir (la mousse) ; albedo, au blanc (le lichen) ; citrinitas, au jaune (la résine) ; rubedo, au rouge (l'amanite). Seul l'accent change : les couleurs qui informent (retard, succès, alerte) restent les mêmes.`; },
  get mode() { return tr`« Suivre l'appareil » obéit au réglage clair ou sombre du système. « Suivre le soleil » passe en sombre au crépuscule et en clair à l'aube, au lieu réglé dans Ciel et alentours (à défaut, d'après ton fuseau horaire).`; },
  get name() { return tr`Le nom en tête de l'app et dans l'onglet du navigateur.`; },
  get openOn() { return tr`Propre à cet appareil : le téléphone peut rouvrir le dernier espace où tu étais, et l'ordinateur toujours l'accueil.`; },
  get langue() { return tr`Celle de l'appareil, par défaut. Choisie ici, elle suit ton compte sur tous tes appareils. Ce que tu écris reste dans ta langue : la recherche, les motifs et la dérive lisent chaque texte dans la sienne.`; },
  get espaces() { return tr`Un espace (un « module » dans la documentation) est une page de ta navigation, faite d'un type : tâches, collection, notes, budget… Deux espaces du même type ne partagent rien d'autre.`; },
  get domaine() { return tr`Un mot libre : Maison, Création… Les espaces d'un même domaine se regroupent dans la navigation et le sommaire de l'accueil, et prennent sa teinte. Laissé vide, l'espace se range sous « Espaces ».`; },
  get suppr() { return tr`✕ efface un espace et toutes ses données, sur tous tes appareils, une fois son nom retapé. L'Assistant n'a pas de données : il se décoche, c'est tout.`; },
  get regler() { return tr`Les réglages propres à l'espace : son sigil, ceux de son type (statuts, catégories, enveloppes…) et son regroupement. Ils s'ouvrent aussi depuis l'espace lui-même, par « régler ».`; },
  get sigil() { return tr`Le signe gravé de l'espace : dans la navigation, en tête de sa planche, et au tri de la boîte de réception. Sa teinte vient de son domaine.`; },
  get grouper() { return tr`Un registre au-dessus de la liste : une ligne par groupe (pièce, catégorie, étiquette…), avec son avancement en pourcentage.`; },
  get creer() { return tr`Un modèle arrive prêt à servir : statuts, catégories, sigil. Un type vide part de rien. Le nom est libre, et rien n'empêche d'avoir trois collections.`; },
  get lieu() { return tr`Un seul lieu sert à tout : le ciel et sa météo, « Suivre le soleil » et le radar culturel. Il est arrondi à une dizaine de kilomètres avant de quitter l'appareil.`; },
  get assistantKey() { return tr`Ta clé de la console Anthropic. Vérifiée, puis gardée chiffrée sur le serveur et attachée à ton compte : la page ne la revoit jamais. Chaque échange est facturé sur ton compte Anthropic : fixe-lui une limite de dépense dans la console.`; },
  get assistantModel() { return tr`Haiku répond vite et coûte le moins ; Opus raisonne le mieux et coûte le plus ; Sonnet se tient entre les deux.`; },
  get assistantActions() { return tr`Coché, Claude peut, quand tu le lui demandes, ajouter ou terminer une tâche (premier espace de tâches), déposer une note dans la boîte de réception et noter une opération (premier budget). Décoché, il lit et répond, rien de plus.`; },
  get assistantShare() { return tr`Claude ne voit que les espaces cochés. Un nouvel espace est coché d'office : décoche ce qui doit rester entre toi et toi.`; },
  get passeur() { return tr`Par sécurité, un navigateur refuse de lire la plupart des autres sites (la politique de même origine, que seul CORS assouplit). Le passeur, une petite fonction de ton projet Supabase, lit à ta place les pages, flux et calendriers, puis oublie tout.`; },
  get importer() { return tr`Importer remplace tout l'état actuel par celui du fichier, sur tous tes appareils : aucune fusion. Exporte d'abord, si tu tiens à ce que tu as.`; }
};

/* Le premier accueil, replié d'un geste (sur cet appareil), puis rouvert depuis le sommaire. */
export const GUIDE = {
  get title() { return tr`Comment cette page est rangée`; },
  get body() { return tr`En chapitres, du plus courant au plus rare : l'apparence, tes espaces, le ciel, l'assistant, les connexions, puis ton compte et tes données. Un « ? » explique ce qui ne va pas de soi.`; },
  get device() { return tr`Un réglage suit ton compte sur tous tes appareils, sauf ceux marqués « cet appareil » : l'ouverture, le ciel vivant, les notifications, la clé Zotero et l'adresse du calendrier restent là où tu les as faits.`; },
  get wit() { return tr`Ce qui est irréversible le dit, et te fait retaper un nom : un peu de bureaucratie sauve des données.`; },
  get glossaryTitle() { return tr`Le vocabulaire de Selene`; },
  get dismiss() { return tr`Compris`; },
  get reopen() { return tr`Guide et vocabulaire`; }
};
/* Le vocabulaire, traduit à chaque appel. « Modèle » y est un gabarit d'espace (trp « gabarit ») : le même mot
   nomme ailleurs le modèle de l'assistant (Model, en anglais), ici un Template. */
export const glossary = () => [
  [tr`Espace`, tr`Une page de ta navigation (un « module » dans la documentation), d'un type donné.`],
  [tr`Type`, tr`La mécanique d'un espace : tâches, collection, notes, budget, programme, rappels, objectif cumulatif ou arc.`],
  [trp("gabarit", "Modèle"), tr`Un type déjà garni (statuts, catégories, sigil), pour commencer sans rien régler.`],
  [tr`Domaine`, tr`Un regroupement d'espaces (Maison, Création…) dans la navigation et l'accueil, avec sa teinte.`],
  [tr`Sigil, planche`, tr`Le signe gravé d'un espace et son numéro (Pl. III), selon l'ordre de la navigation.`],
  [tr`Boîte de réception`, tr`L'espace de notes qui reçoit la capture rapide ; ce qu'elle contient se range ensuite ailleurs.`],
  [tr`Passeur`, tr`Ta fonction, sur le serveur, qui lit pour Selene ce que le navigateur n'a pas le droit de lire.`],
  // Les noms propres à Selene, que l'interface donne après le mot courant (U5 de l'audit).
  [tr`Nouveautés (Dehors)`, tr`Ce qui est paru dans les flux, les veilles et les sorties que tu suis, depuis ta dernière visite.`],
  [tr`Tri (Vasculum)`, tr`La boîte de réception, une note à la fois : chacune se range d'un geste, attend ou se jette.`],
  [tr`Jachère`, tr`Un motif vivant, mais absent depuis un moment : reposé, pas perdu.`],
  [tr`Lunaison`, tr`Un tour de la lune, d'une nouvelle lune à la suivante (29,5 jours) : le Bilan et la planche s'y découpent.`],
  [tr`Cet appareil`, tr`Un réglage qui ne suit pas ton compte : il reste sur l'appareil où tu l'as fait.`]
];

/* Les autres textes de la page. */
export const TEXTS = {
  get toc() { return tr`Sommaire`; },
  tipAbout: subject => tr`En savoir plus : ${subject}`,
  get device() { return tr`cet appareil`; },
  get deviceTitle() { return tr`Ce réglage reste sur cet appareil : il ne suit pas ton compte.`; },
  get legend() { return tr`Coche pour afficher, renomme sur place, range par domaine, ordonne avec ↑ ↓, et ✕ pour supprimer.`; },
  get domaine() { return tr`Domaine`; },
  get suppr() { return tr`Supprimer`; },
  get reglerShort() { return tr`régler`; },
  regler: name => tr`Régler « ${name} »`,
  get assistantHere() { return tr`réglé au chapitre Assistant`; },
  get create() { return tr`Créer un espace`; },
  get fromTemplate() { return tr`D'un modèle`; },
  get fromTemplateHint() { return tr`Prêts à servir, tout se renomme ensuite.`; },
  get add() { return tr`Créer`; },
  addAria: name => tr`Créer un espace « ${name} »`,
  get custom() { return tr`Sur mesure`; },
  get customHint() { return tr`Un modèle sous un autre nom, ou un type vide.`; },
  get sigil() { return tr`Sigil`; },
  get assistantOff() { return tr`L'assistant est éteint. Coche « Assistant » parmi tes espaces : il lira ce que tu lui confies et, si tu l'y autorises, agira pour toi.`; },
  get toEspaces() { return tr`Aller aux espaces`; },
  get artifactOnly() { return tr`Les connexions (Envoyer à Selene, Zotero, le passeur, le calendrier) vivent dans la version web ou l'app installée. L'artefact claude.ai s'en passe.`; },
  get danger() { return tr`Zone sensible`; }
};
