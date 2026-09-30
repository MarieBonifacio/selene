/* Les registres de l'interface : des tables que chaque partie remplit en se chargeant, et que la page consulte
   ensuite. Un module qui ajoute une vue, une feuille ou une action n'a besoin que d'elles, et non de celui qui les
   affiche : c'est ce qui permet de les charger sans ordre imposé entre eux (ce fichier ne dépend de rien).
     VIEWS   les pages (#accueil, #reglages, un module…) : id → () => HTML
     SHEETS  les feuilles (capture, palette, fiche…) : nom → (arg) => HTML
     CLICK   les actions data-act="…" au clic : nom → (élément, événement) => void
     CHANGE  les actions data-act="…" au changement d'un champ : nom → (élément) => void */
export const VIEWS = {};
export const SHEETS = {};
export const CLICK = {};
export const CHANGE = {};
