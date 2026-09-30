/* La fiche Spécimen : tout ce qu'on sait d'une entrée, au même endroit. Le texte, son étiquette (date, chapitre,
   étiquette, état, statut épistémique), sa provenance, ses liens sortants et entrants, les motifs qui s'y trouvent,
   l'histoire de son statut et de ses réexamens. Un tiroir sur ordinateur, une feuille sur téléphone ; elle se
   redessine à chaque changement. */
import { EP_STATUS, LINK_TYPES } from "../../core/domain.js";
import { CLICK, SHEETS } from "../registry.js";
import { esc } from "../lib/dom.js";
import { fmt } from "../lib/format.js";
import { motifsOf } from "./concordance.js";
import { LINK_BACK, backlinks, epGlyph, epSelect, refFind, refHTML } from "./links.js";
import { srcMeta } from "./sources.js";
import { modOf } from "../modules/collection.js";
import { originHTML } from "../modules/entries.js";
import { idOf } from "../shell/actions.js";
import { openSheet } from "../shell/sheets.js";
import { sigil, tintOf } from "../shell/sigils.js";
import { S, label } from "../state/site.js";

SHEETS.specimen = ref => {
  const hit = refFind(ref); if (!hit) return `<p class="empty">Cette entrée n'existe plus.</p>`;
  const { mod, e } = hit, inst = S().modules[mod], c = inst.config, text = String(e.text || e.note || "");
  const thought = inst.type === "notes" || (inst.type === "cumul" && (inst.scraps || []).includes(e));
  const long = d => fmt(d, { day: "numeric", month: "long", year: "numeric" }), when = e.date || e.due || e.created;
  const chapter = inst.type === "cumul" && e.category ? (c.categories.find(x => x.id === e.category) || {}).name : "";
  const links = [...(e.links || []).map(l => `<li>${esc(LINK_TYPES[l.type])} ${refHTML(l.to)}</li>`), ...(backlinks().get(`${mod}/${e.id}`) || []).map(b => `<li>${esc(LINK_BACK[b.type])} ${refHTML(b.from)}</li>`)];
  const motifs = motifsOf([e.title, e.subtitle, text].filter(Boolean).join(" "));
  const statusOf = k => k ? EP_STATUS[k] : "sans statut";
  const log = [...(e.epLog || [])].reverse().map(x => `<li>${x.date ? long(x.date) + " : " : ""}${esc(statusOf(x.from))} → ${epGlyph(x.to)}${esc(statusOf(x.to))}</li>`);
  const reviews = [...(e.reviews || [])].reverse().map(r => `<li>${esc(r.verdict)}, le ${long(r.date)}</li>`);
  return `<div class="spec ${tintOf(mod)}" data-mod="${esc(mod)}" data-id="${esc(e.id)}">
    <div class="plate">${sigil(mod)}<span class="pl">${esc(label(mod))}</span></div>
    ${e.title ? `<h2 id="sheetTitle">${esc(e.title)}</h2>${e.subtitle ? `<p class="hint">${esc(e.subtitle)}</p>` : ""}` : `<h2 id="sheetTitle" class="sr">Fiche de l'entrée</h2>`}
    ${text ? `<blockquote class="spec-text">${esc(text)}</blockquote>` : ""}
    <p class="spec-label">${[when ? long(when) : "", chapter, e.tag, e.status].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("")}${e.ep ? `<span>${epGlyph(e.ep)}${esc(EP_STATUS[e.ep])}</span>` : ""}</p>
    ${thought ? `<div class="row">${epSelect(mod, e)}<span class="spacer"></span>${links.length ? `<button class="btn ghost sm" data-act="carte" data-k="ref" data-v="${esc(mod)}/${esc(e.id)}">carte du voisinage</button>` : ""}<button class="btn ghost sm" data-act="derive-start" data-mod="${esc(mod)}">dériver</button><button class="btn ghost sm" data-act="link-form" data-mod="${esc(mod)}">lier…</button></div>`
      : inst.type === "collection" && inst.config.sources ? `<div class="row"><span class="spacer"></span><button class="btn ghost sm" data-act="src-link" data-ref="${esc(mod)}/${esc(e.id)}">documente…</button></div>` : ""}
    ${e.src ? `<p class="meta">${srcMeta(e)}</p>` : ""}
    ${e.origin ? `<h3>Provenance</h3><p class="meta">${originHTML(e, text || e.title)}</p>` : ""}
    ${links.length ? `<h3>Liens</h3><ul>${links.join("")}</ul>` : ""}
    ${motifs.length ? `<h3>Motifs</h3><div class="row">${motifs.map(m => `<button class="btn ghost sm" data-act="search-for" data-q="${esc(m.e.title)}">${esc(m.e.title)}</button>`).join("")}</div>` : ""}
    ${log.length ? `<h3>Statut, au fil du temps</h3><ul class="meta" style="display:block">${log.join("")}</ul>` : ""}
    ${reviews.length ? `<h3>Réexamens</h3><ul>${reviews.join("")}</ul>` : ""}
    <div class="row" style="margin-top:18px"><a class="btn sm" href="#${esc(mod)}/${esc(e.id)}">Voir dans ${esc(label(mod))}</a>${inst.type === "collection" ? `<button class="btn ghost sm" data-act="col-edit">modifier</button>` : ""}</div>
  </div>`;
};
CLICK["specimen"] = el => { const mod = modOf(el), id = idOf(el); if (mod && id) openSheet("specimen", `${mod}/${id}`); };
