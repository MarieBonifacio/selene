/* Les registres de l'interface : des tables que chaque partie remplit en se chargeant, et que la page consulte
   ensuite. Un module qui ajoute une vue, une feuille ou une action n'a besoin que d'elles, et non de celui qui les
   affiche : c'est ce qui permet de les charger sans ordre imposé entre eux (ce fichier ne dépend de rien).
     VIEWS   les pages (#accueil, #reglages, un module…) : id → () => HTML
     SHEETS  les feuilles (capture, palette, fiche…) : nom → (arg) => HTML
     CLICK   les actions data-act="…" au clic : nom → (élément, événement) => void
     CHANGE  les actions data-act="…" au changement d'un champ : nom → (élément) => void
     TYPE_UI les types de module (plus bas) */
export const VIEWS = {};
export const SHEETS = {};
export const CLICK = {};
export const CHANGE = {};
/* Les types de module, côté interface (le côté données est MODULE_TYPES, src/core/domain.js). Un fichier de
   src/app/modules/ par type, qui s'enregistre par registerType. Ce qu'un type peut fournir :
     sensitive             suivi sensible (docs/regulation.md) : non partagé avec l'assistant à la création, partage confirmé
                           sur le résumé ; ignoré du bilan, de la planche, des liens, des ponts et de la reprise de l'accueil.
                           Un parcours transversal qui lit les modules sans passer par un hook doit le tester. Pas de
                           pont de reprise (render.js). Un suivi peut être gardé sur un seul appareil (state/local.js).
     view(id)              écran du module
     settings(id, inst)    champs du bloc « Réglages par module »
     summary(id, inst)     ligne de l'accueil « Où en sont les choses » (HTML)
     alerts(id, inst, now) rappels du bloc « Aujourd'hui » : [{ text (HTML), actions? }]
     context(inst, name, id) paragraphe envoyé à l'assistant (texte brut)
     cannotDelete(id)      raison de refuser la suppression (texte), ou "" ; onDelete(id) : à faire avant de supprimer
     add(id, inst)         bouton « noter / ajouter » (data-act="entry-add")
     accept(id, inst, note) recevoir une note triée depuis un module Notes ; canAccept(inst) pour conditionner
     badge(inst)           nombre affiché à côté du nom dans la navigation
     recent(inst)          derniers éléments, en texte (lignes dépliables de l'accueil)
     texts(inst)           textes parcourus par la recherche : [{ text, date?, ep?, eid? }] (eid : l'entrée, pour y mener)
     timerDone(id, inst)   suite proposée à la fin du minuteur quand ce module est ouvert
     review(inst, from, to) une ligne de bilan pour la période [from, to[ (dates ISO), ou null
     click / change        actions propres au type, versées dans CLICK / CHANGE */
export const TYPE_UI = {};
/* Enregistre un type : son interface, et ses actions dans les tables communes. Un nom d'action déjà pris est une
   erreur de programmation, signalée au chargement plutôt que d'écraser en silence l'action d'un autre. */
export function registerType(name, ui) {
  if (Object.hasOwn(TYPE_UI, name)) throw new Error(`Type « ${name} » déjà enregistré`);
  TYPE_UI[name] = ui;
  for (const [table, acts] of [[CLICK, ui.click], [CHANGE, ui.change]]) for (const [act, fn] of Object.entries(acts || {})) {
    if (Object.hasOwn(table, act)) throw new Error(`Action « ${act} » du type ${name} déjà définie`);
    table[act] = fn;
  }
}
