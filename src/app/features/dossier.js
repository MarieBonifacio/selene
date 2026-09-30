/* Dossier de passation : un périmètre exporté en Markdown (avec références à la manière de l'APA), pour être relu
   ailleurs. */
import { EP_STATUS, LINK_TYPES, slugId } from "../../core/domain.js";
import { downloadFile } from "../lib/download.js";
import { fmt, todayISO } from "../lib/format.js";
import { excerpt, refFind, sourceItems } from "./links.js";
import { label } from "../state/site.js";

/* ---- dossier de passation : un périmètre exporté en Markdown pour être relu ailleurs (NotebookLM, Claude,
   Obsidian). Chaque entrée garde sa date, son module, son statut, sa provenance ; ses liens deviennent des renvois
   numérotés quand leur cible est dans le dossier. Le préambule dit comment lire les statuts, pour qu'un modèle ne
   traite pas une hypothèse comme un fait. items : [{ mod, text, date?, e? }] (e : l'entrée, si on la connaît). */
const yamlStr = v => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
/* Une Source en référence bibliographique, à la manière de l'APA : auteurs (année). Titre. Revue. DOI, sinon adresse. */
function sourceCitation(e) {
  const x = e.src || {}, one = v => String(v || "").replace(/\s+/g, " ").trim(), year = /^\d{4}/.test(x.date || "") ? x.date.slice(0, 4) : "s. d.";
  const where = x.doi ? `https://doi.org/${x.doi}` : x.url && /^https?:\/\//i.test(x.url) ? x.url : "";
  return [`${one(e.subtitle) || "Anonyme"} (${year}).`, `*${one(e.title) || "Sans titre"}*.`, x.site ? `${one(x.site)}.` : "", where].filter(Boolean).join(" ");
}
export function dossierMarkdown(title, scope, items) {
  const num = new Map(items.map((it, i) => [it.e ? `${it.mod}/${it.e.id}` : "", i + 1]).filter(([k]) => k));
  const refText = ref => { if (num.has(ref)) return `[${num.get(ref)}]`; const hit = refFind(ref); return hit ? `« ${excerpt(hit.e, 80)} » (hors dossier)` : "(supprimé)"; };
  // Les Sources : celles qui documentent une entrée du dossier (leur lien pointe vers elle), et celles qui y figurent elles-mêmes.
  const srcs = sourceItems(), refs = new Map(), cite = s => { if (!refs.has(s.ref)) refs.set(s.ref, { n: refs.size + 1, e: s.e }); return `[S${refs.get(s.ref).n}]`; };
  const body = items.map((it, i) => {
    const e = it.e || {}, meta = [it.date ? fmt(it.date, { day: "numeric", month: "long", year: "numeric" }) : "", label(it.mod), e.ep ? EP_STATUS[e.ep] : ""].filter(Boolean).join(" · ");
    const lines = [`## ${i + 1}. ${meta}`, "", String(it.text).trim(), ""], ref = it.e ? `${it.mod}/${e.id}` : "";
    if (e.origin && e.origin.text.trim() !== String(it.text).trim()) lines.push(`*Provenance : ${e.origin.from}${e.origin.date ? `, ${fmt(e.origin.date, { day: "numeric", month: "long", year: "numeric" })}` : ""} : « ${e.origin.text.trim()} »*`, "");
    const self = ref && srcs.find(s => s.ref === ref);
    if (self) lines.push(`*Référence : ${cite(self)}*`, "");
    if ((e.links || []).length) lines.push(`*Liens : ${e.links.map(l => `${LINK_TYPES[l.type]} ${refText(l.to)}`).join(" ; ")}*`, "");
    const by = ref ? srcs.filter(s => s.ref !== ref && (s.e.links || []).some(l => l.to === ref && l.type === "documente")) : [];
    if (by.length) lines.push(`*Documenté par : ${by.map(cite).join(", ")}*`, "");
    return lines.join("\n");
  });
  const head = ["---", `titre: ${yamlStr(title)}`, `source: "Selene"`, `exporte_le: "${todayISO()}"`, `perimetre: ${yamlStr(scope)}`, ...(refs.size ? [`references: ${refs.size}`] : []), `entrees: ${items.length}`, "---", "", `# ${title}`, "",
    "> Chaque entrée porte sa date, son module et, s'il est indiqué, son statut épistémique : *observé* (ce qui s'est présenté), " +
    "*hypothèse* (une conjecture à tester), *interprétation* (une lecture, un cadre appliqué), *inexpliqué* (laissé ouvert à dessein). " +
    "Ne pas traiter une hypothèse comme un fait, ni combler un inexpliqué. Les renvois [n] désignent les entrées de ce dossier" +
    (refs.size ? " ; les renvois [Sn], les références en fin de dossier (avec leur DOI quand il existe). Qu'une source documente une entrée ne la prouve pas." : "."), ""];
  const biblio = refs.size ? ["## Références", "", ...[...refs.values()].map(r => `[S${r.n}] ${sourceCitation(r.e)}`).join("\n\n").split("\n")] : [];
  return [...head, ...body, ...biblio].join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
export const dossierFile = (title, scope, items) => downloadFile(`dossier-${slugId(title, [])}-${todayISO()}.md`, dossierMarkdown(title, scope, items), "text/markdown", title);
