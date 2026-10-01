/* Les libellés que le noyau définit en français (statuts épistémiques, types de lien), pour l'affichage. Leurs clés
   (obs, hyp…, derive, contredit…) sont ce qui s'enregistre ; leurs noms se traduisent ici. Le noyau, pur, ne peut pas
   importer la traduction : ils y sont marqués ici, et tests/i18n.test.js vérifie que cette liste suit la sienne. */
import { EP_STATUS, LINK_TYPES } from "../../core/domain.js";
import { N_, tr } from "../i18n/index.js";

export const CORE_LABELS = [N_("observé"), N_("hypothèse"), N_("interprétation"), N_("inexpliqué"),
  N_("dérive de"), N_("contredit"), N_("fait écho à"), N_("documente")];
export const epLabel = k => k ? tr(EP_STATUS[k] || k) : tr`sans statut`;
export const linkLabel = k => tr(LINK_TYPES[k] || k);
