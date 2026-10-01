/* Les libellés que le noyau définit en français (statuts épistémiques, types de lien, le ciel), pour l'affichage. Leurs
   clés (obs, hyp…, derive, contredit…) sont ce qui s'enregistre ; leurs noms se traduisent ici. Le noyau, pur, ne peut
   pas importer la traduction : ils y sont marqués ici, et tests/i18n.test.js vérifie que ces listes suivent les siennes. */
import { EP_STATUS, LINK_TYPES, localizeConfig } from "../../core/domain.js";
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
/* Les erreurs du noyau (coreError, core/domain.js) : traduites par leur code, le message français restant celui que
   l'assistant lit. Une erreur sans code connu (réseau, service, saisie) garde son message, déjà dans la langue de
   l'interface. CORE_FIELDS : les noms de champ que le noyau donne à « … : à remplir » ; un champ d'une collection porte
   le libellé choisi par la personne, qui passe tel quel. */
export const CORE_FIELDS = [N_("Tâche"), N_("Note"), N_("Nom du module")];
export const CORE_ERRORS = {
  "required": a => tr`${tr(String(a.label))} : à remplir`,
  "task-missing": () => tr`Tâche introuvable`,
  "today-limit": () => tr`Trois tâches du jour maximum`,
  "amount": () => tr`Montant invalide`,
  "date": () => tr`Date invalide`,
  "link": () => tr`Lien invalide`,
  "value": () => tr`Valeur invalide`,
  "no-journal": () => tr`Ce module ne tient pas de journal`,
  "id-reserved": () => tr`Identifiant réservé`,
  "id-taken": () => tr`Identifiant déjà utilisé`,
  "type-unknown": () => tr`Type de module inconnu`,
  "module-missing": () => tr`Module introuvable`,
  "backup-too-big": () => tr`Sauvegarde trop volumineuse`,
  "backup-format": () => tr`Fichier illisible ou pas une sauvegarde Selene.`,
  "backup-too-new": () => tr`Sauvegarde créée par une version plus récente de Selene : mets l'application à jour d'abord.`
};
export const errMsg = (e, fallback = "") => e && Object.hasOwn(CORE_ERRORS, e.code) ? CORE_ERRORS[e.code](e.args || {}) : (e && e.message) || fallback;
/* Un modèle de module (MODULE_TEMPLATES) dans la langue de l'interface : nom, phrase d'aide, réglages de départ. Le
   module créé garde ces mots-là, devenus les siens : ils ne se retraduisent pas si la langue change ensuite. */
export const localTemplate = tpl => ({ ...tpl, ...(tpl.name ? { name: tr(tpl.name) } : {}), ...(tpl.hint ? { hint: tr(tpl.hint) } : {}),
  config: localizeConfig(JSON.parse(JSON.stringify(tpl.config || {})), tr) });
