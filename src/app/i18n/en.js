/* Le dictionnaire anglais : le texte français, tel qu'écrit dans le code (la clé), et sa traduction. {0}, {1}… sont les
   valeurs, dans l'ordre du texte français ; la traduction les place où sa grammaire le veut. Un pluriel : un objet
   { one, other } sous la forme singulière française. Un contexte : "contexte\u0004texte". Une typographie propre
   (guillemets “ ”, pas d'espace avant « : »). Ce qui manque ici reste en français ; `npm run i18n` dit quoi, et
   refuse une traduction dont le texte français a changé ou disparu. Rangé par fichier source. */
export default {
  // lib/dom.js
  "toast\u0004Annuler": "Undo",
  "Voir les {0} suivants ({1} de plus)": "Show the next {0} ({1} more)",
  // ui/dialogs.js
  "Enregistrer": "Save",
  "formulaire\u0004Annuler": "Cancel",
  // scene/moon.js
  "Nouvelle lune": "New moon",
  "Premier croissant": "Waxing crescent",
  "Premier quartier": "First quarter",
  "Gibbeuse croissante": "Waxing gibbous",
  "Pleine lune": "Full moon",
  "Gibbeuse décroissante": "Waning gibbous",
  "Dernier quartier": "Last quarter",
  "Dernier croissant": "Waning crescent",
  "Phase de la lune": "Moon phase",
  // views/reglages.js
  "Langue": "Language",
  "Langue de l'appareil": "Device language"
};
