/* Les libellés que le noyau définit en français (statuts épistémiques, types de lien, le ciel), pour l'affichage. Leurs
   clés (obs, hyp…, derive, contredit…) sont ce qui s'enregistre ; leurs noms se traduisent ici. Le noyau, pur, ne peut
   pas importer la traduction : ils y sont marqués ici, et tests/i18n.test.js vérifie que ces listes suivent les siennes. */
import { EP_STATUS, LINK_TYPES } from "../../core/domain.js";
import { windName } from "../../core/sky.js";
import { N_, tr } from "../i18n/index.js";

export const CORE_LABELS = [N_("observé"), N_("hypothèse"), N_("interprétation"), N_("inexpliqué"),
  N_("dérive de"), N_("contredit"), N_("fait écho à"), N_("documente")];
export const epLabel = k => k ? tr(EP_STATUS[k] || k) : tr`sans statut`;
export const linkLabel = k => tr(LINK_TYPES[k] || k);
/* Le ciel (core/sky.js) : l'état du temps, les pluies d'étoiles filantes, la note d'une éclipse. */
export const SKY_LABELS = [N_("dégagé"), N_("voilé"), N_("couvert"), N_("brume"), N_("pluie"), N_("neige"), N_("orage"),
  N_("Quadrantides"), N_("Lyrides"), N_("Perséides"), N_("Orionides"), N_("Léonides"), N_("Géminides"),
  N_("90 % du Soleil masqué, maximum vers 20 h 14")];
/* Une éclipse : le noyau donne le corps et le type en français (« soleil », « partielle ») ; chacune a sa phrase entière,
   l'ordre des mots changeant d'une langue à l'autre (« partial solar eclipse »). */
export const ECLIPSE_TEXT = {
  "soleil/partielle": w => tr`Éclipse partielle de Soleil ${w}`, "soleil/annulaire": w => tr`Éclipse annulaire de Soleil ${w}`,
  "soleil/totale": w => tr`Éclipse totale de Soleil ${w}`, "lune/partielle": w => tr`Éclipse partielle de Lune ${w}`,
  "lune/totale": w => tr`Éclipse totale de Lune ${w}`, "lune/pénombre": w => tr`Éclipse de Lune par la pénombre ${w} : un voile léger, à peine perceptible`
};
export const eclipseText = (body, type, when) => { const k = `${body}/${type}`; return Object.hasOwn(ECLIPSE_TEXT, k) ? ECLIPSE_TEXT[k](when) : `Éclipse ${type} de ${body} ${when}`; };
/* Le vent, d'où il vient : le noyau le nomme en français (« d'ouest ») ; chaque direction a sa phrase. */
export const WIND_TEXT = {
  "du nord": n => tr`vent du nord ${n} km/h`, "du nord-est": n => tr`vent du nord-est ${n} km/h`, "d'est": n => tr`vent d'est ${n} km/h`,
  "du sud-est": n => tr`vent du sud-est ${n} km/h`, "du sud": n => tr`vent du sud ${n} km/h`, "du sud-ouest": n => tr`vent du sud-ouest ${n} km/h`,
  "d'ouest": n => tr`vent d'ouest ${n} km/h`, "du nord-ouest": n => tr`vent du nord-ouest ${n} km/h`
};
export const windText = (dir, n) => { const k = windName(dir); return Object.hasOwn(WIND_TEXT, k) ? WIND_TEXT[k](n) : `vent ${k} ${n} km/h`; };
