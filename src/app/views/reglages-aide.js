/* Les textes d'aide de la page Réglages : chapitres, infobulles, premier accueil et vocabulaire. Réunis ici pour
   qu'une traduction n'ait qu'un fichier à reprendre, clé par clé. Des phrases entières, jamais assemblées morceau par
   morceau (l'ordre des mots change d'une langue à l'autre) ; celles qui citent un nom sont des fonctions, pour que la
   traduction le place où sa grammaire le veut. Du texte brut : l'affichage l'échappe. */

/* Les chapitres, du plus courant au plus rare ; leur numéro (I, II…) suit cet ordre. */
export const CHAPTERS = [
  { id: "reg-apparence", title: "Apparence et rythme", intro: "Ce que tu vois en ouvrant Selene, et quand elle te fait signe." },
  { id: "reg-espaces", title: "Espaces", intro: "Les pages de ta navigation : les afficher, les nommer, les ranger, régler chacune, en créer d'autres." },
  { id: "reg-ciel", title: "Ciel et alentours", intro: "Un lieu, et tout ce qui en découle : l'heure et la météo du ciel de l'accueil, la lune à sa place, le radar culturel." },
  { id: "reg-assistant", title: "Assistant", intro: "Claude dans le tableau de bord : ce qu'il lit, ce qu'il peut faire, avec quel modèle." },
  { id: "reg-connexions", title: "Connexions", intro: "Ce qui relie Selene au reste : un lien envoyé d'ailleurs, ta bibliothèque Zotero, et le passeur qui lit pour toi ce que le navigateur ne peut pas lire." },
  { id: "reg-compte", title: "Compte et données", intro: "Emporter tes données, les ramener, et, en dernier recours, tout effacer." }
];

/* Les infobulles : ce qui ne va pas de soi, en quelques lignes. */
export const TIPS = {
  palette: "Les quatre étapes du Grand Œuvre des alchimistes : nigredo, l'œuvre au noir (la mousse) ; albedo, au blanc (le lichen) ; citrinitas, au jaune (la résine) ; rubedo, au rouge (l'amanite). Seul l'accent change : les couleurs qui informent (retard, succès, alerte) restent les mêmes.",
  mode: "« Suivre l'appareil » obéit au réglage clair ou sombre du système. « Suivre le soleil » passe en sombre au crépuscule et en clair à l'aube, au lieu réglé dans Ciel et alentours (à défaut, d'après ton fuseau horaire).",
  name: "Le nom en tête de l'app et dans l'onglet du navigateur.",
  openOn: "Propre à cet appareil : le téléphone peut rouvrir le dernier espace où tu étais, et l'ordinateur toujours l'accueil.",
  espaces: "Un espace (un « module » dans la documentation) est une page de ta navigation, faite d'un type : tâches, collection, notes, budget… Deux espaces du même type ne partagent rien d'autre.",
  domaine: "Un mot libre : Maison, Création… Les espaces d'un même domaine se regroupent dans la navigation et le sommaire de l'accueil, et prennent sa teinte. Laissé vide, l'espace se range sous « Espaces ».",
  suppr: "✕ efface un espace et toutes ses données, sur tous tes appareils, une fois son nom retapé. L'Assistant n'a pas de données : il se décoche, c'est tout.",
  regler: "Les réglages propres à l'espace : son sigil, ceux de son type (statuts, catégories, enveloppes…) et son regroupement. Ils s'ouvrent aussi depuis l'espace lui-même, par « régler ».",
  sigil: "Le signe gravé de l'espace : dans la navigation, en tête de sa planche, et au tri de la boîte de réception. Sa teinte vient de son domaine.",
  grouper: "Un registre au-dessus de la liste : une ligne par groupe (pièce, catégorie, étiquette…), avec son avancement en pourcentage.",
  creer: "Un modèle arrive prêt à servir : statuts, catégories, sigil. Un type vide part de rien. Le nom est libre, et rien n'empêche d'avoir trois collections.",
  lieu: "Un seul lieu sert à tout : le ciel et sa météo, « Suivre le soleil » et le radar culturel. Il est arrondi à une dizaine de kilomètres avant de quitter l'appareil.",
  assistantKey: "Ta clé de la console Anthropic. Vérifiée, puis gardée chiffrée sur le serveur et attachée à ton compte : la page ne la revoit jamais. Chaque échange est facturé sur ton compte Anthropic : fixe-lui une limite de dépense dans la console.",
  assistantModel: "Haiku répond vite et coûte le moins ; Opus raisonne le mieux et coûte le plus ; Sonnet se tient entre les deux.",
  assistantActions: "Coché, Claude peut, quand tu le lui demandes, ajouter ou terminer une tâche (premier espace de tâches), déposer une note dans la boîte de réception et noter une opération (premier budget). Décoché, il lit et répond, rien de plus.",
  assistantShare: "Claude ne voit que les espaces cochés. Un nouvel espace est coché d'office : décoche ce qui doit rester entre toi et toi.",
  passeur: "Par sécurité, un navigateur refuse de lire la plupart des autres sites (la politique de même origine, que seul CORS assouplit). Le passeur, une petite fonction de ton projet Supabase, lit à ta place les pages, flux et calendriers, puis oublie tout.",
  importer: "Importer remplace tout l'état actuel par celui du fichier, sur tous tes appareils : aucune fusion. Exporte d'abord, si tu tiens à ce que tu as."
};

/* Le premier accueil, replié d'un geste (sur cet appareil), puis rouvert depuis le sommaire. */
export const GUIDE = {
  title: "Comment cette page est rangée",
  body: "En chapitres, du plus courant au plus rare : l'apparence, tes espaces, le ciel, l'assistant, les connexions, puis ton compte et tes données. Un « ? » explique ce qui ne va pas de soi.",
  device: "Un réglage suit ton compte sur tous tes appareils, sauf ceux marqués « cet appareil » : l'ouverture, le ciel vivant, les notifications, la clé Zotero et l'adresse du calendrier restent là où tu les as faits.",
  wit: "Ce qui est irréversible le dit, et te fait retaper un nom : un peu de bureaucratie sauve des données.",
  glossaryTitle: "Le vocabulaire de Selene",
  dismiss: "Compris",
  reopen: "Guide et vocabulaire"
};
export const GLOSSARY = [
  ["Espace", "Une page de ta navigation (un « module » dans la documentation), d'un type donné."],
  ["Type", "La mécanique d'un espace : tâches, collection, notes, budget, programme, rappels, objectif cumulatif ou arc."],
  ["Modèle", "Un type déjà garni (statuts, catégories, sigil), pour commencer sans rien régler."],
  ["Domaine", "Un regroupement d'espaces (Maison, Création…) dans la navigation et l'accueil, avec sa teinte."],
  ["Sigil, planche", "Le signe gravé d'un espace et son numéro (Pl. III), selon l'ordre de la navigation."],
  ["Boîte de réception", "L'espace de notes qui reçoit la capture rapide ; ce qu'elle contient se range ensuite ailleurs."],
  ["Passeur", "Ta fonction, sur le serveur, qui lit pour Selene ce que le navigateur n'a pas le droit de lire."],
  ["Cet appareil", "Un réglage qui ne suit pas ton compte : il reste sur l'appareil où tu l'as fait."]
];

/* Les autres textes de la page. */
export const TEXTS = {
  toc: "Sommaire",
  tipAbout: subject => `En savoir plus : ${subject}`,
  device: "cet appareil",
  deviceTitle: "Ce réglage reste sur cet appareil : il ne suit pas ton compte.",
  legend: "Coche pour afficher, renomme sur place, range par domaine, ordonne avec ↑ ↓, et ✕ pour supprimer.",
  domaine: "Domaine",
  suppr: "Supprimer",
  reglerShort: "régler",
  regler: name => `Régler « ${name} »`,
  assistantHere: "réglé au chapitre Assistant",
  create: "Créer un espace",
  fromTemplate: "D'un modèle",
  fromTemplateHint: "Prêts à servir, tout se renomme ensuite.",
  add: "Créer",
  addAria: name => `Créer un espace « ${name} »`,
  custom: "Sur mesure",
  customHint: "Un modèle sous un autre nom, ou un type vide.",
  sigil: "Sigil",
  assistantOff: "L'assistant est éteint. Coche « Assistant » parmi tes espaces : il lira ce que tu lui confies et, si tu l'y autorises, agira pour toi.",
  toEspaces: "Aller aux espaces",
  artifactOnly: "Les connexions (Envoyer à Selene, Zotero, le passeur, le calendrier) vivent dans la version web ou l'app installée. L'artefact claude.ai s'en passe.",
  danger: "Zone sensible"
};
