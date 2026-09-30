/* Les liaisons entre pensées (fragments, notes, sources) : références « module/id », liens entrants, marges,
   dérivation, tensions à résoudre, statut épistémique. */
import { EP_STATUS, LINK_TYPES, addLink, setEpStatus } from "../../core/domain.js";
import { CHANGE, CLICK, TYPE_UI } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { ago, fmt, todayISO, uid } from "../lib/format.js";
import { motifsOf } from "./concordance.js";
import { dossierFile } from "./dossier.js";
import { modOf } from "../modules/collection.js";
import { originHTML } from "../modules/entries.js";
import { idOf } from "../shell/actions.js";
import { routeOf } from "../shell/nav.js";
import { memoInRender, render } from "../shell/render.js";
import { closeSheet } from "../shell/sheets.js";
import { S, enabled, label, site } from "../state/site.js";
import { openForm } from "../ui/dialogs.js";

export function epCounts(from, to) {
  const out = {};
  for (const inst of Object.values(S().modules)) { const ui = TYPE_UI[inst.type]; if (ui && ui.texts) for (const t of ui.texts(inst)) if (t.ep && t.date && t.date >= from && t.date < to) out[t.ep] = (out[t.ep] || 0) + 1; }
  return out;
}
/* ---- liaisons entre fragments et notes (ce qui se pense : fragments d'un cumul, notes) ---- */
export function thoughtItems() {
  const out = [];
  for (const [mod, m] of Object.entries(S().modules)) {
    const list = m.type === "notes" ? m.entries : m.type === "cumul" ? m.scraps || [] : null;
    if (list) for (const e of list) out.push({ ref: `${mod}/${e.id}`, mod, e });
  }
  return out;
}
/* « module/id » → l'entrée, par un index des entrées du module construit une fois par rendu (une liste de
   fragments liés ferait sinon autant de parcours complets que de liens). */
export function refFind(ref) {
  const [mod, id] = String(ref).split("/"), m = Object.hasOwn(S().modules, mod) ? S().modules[mod] : null;
  if (!m || TYPE_UI[m.type]?.sensitive) return null;
  const e = memoInRender("refs:" + mod, () => new Map([...m.entries, ...(m.scraps || [])].map(x => [x.id, x]))).get(id);
  return e ? { mod, e } : null;
}
export const excerpt = (e, n = 60) => { const t = String(e.text || e.title || e.note || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
/* Liens entrants : pour chaque entrée, qui la vise et comment. Calculé une fois par rendu. */
export const backlinks = () => memoInRender("backlinks", () => {
  const by = new Map();
  for (const it of [...thoughtItems(), ...sourceItems()]) for (const l of it.e.links || []) { if (!by.has(l.to)) by.set(l.to, []); by.get(l.to).push({ from: it.ref, type: l.type }); }
  return by;
});
/* Les Sources (éléments des collections de sources) : elles ne pensent pas, elles documentent. Leurs liens partent
   vers les notes et fragments qu'elles appuient (« documente »), et reviennent en marge de ceux-ci (« documenté par »). */
export function sourceItems() {
  const out = [];
  for (const [mod, m] of Object.entries(S().modules)) if (m.type === "collection" && m.config.sources && enabled(mod)) for (const e of m.entries) out.push({ ref: `${mod}/${e.id}`, mod, e });
  return out;
}
export const LINK_BACK = { derive: "a donné", contredit: "contredit par", echo: "écho de", documente: "documenté par" };
export function refHTML(ref) {
  const hit = refFind(ref);
  return hit ? `<a href="#${esc(hit.mod)}/${esc(hit.e.id)}">« ${esc(excerpt(hit.e))} »</a>` : `<i>(supprimé)</i>`;
}
/* Sur la ligne du statut : « fiche », « dériver » et « lier… » (les liens eux-mêmes sont dans la marge, margHTML). */
export function linksHTML(mod) {
  return `<span class="acts ra"><button class="btn ghost sm" data-act="specimen" data-mod="${esc(mod)}">fiche</button><button class="btn ghost sm" data-act="derive-start" data-mod="${esc(mod)}">dériver</button><button class="btn ghost sm" data-act="link-form" data-mod="${esc(mod)}">lier…</button></span>`;
}
/* Les marginalia : ce qui accompagne une pensée sans en être (retouche, provenance, liens sortants et entrants,
   motifs présents), dans un <aside> rendu une seule fois. Le CSS seul le place : dans la marge droite, face au texte,
   sur un grand écran (notes latérales à la Tufte) ; sous le texte ailleurs. Rendu même vide, pour que la colonne de
   texte garde la même largeur d'une ligne à l'autre. */
export function margHTML(mod, e, text) {
  const out = (e.links || []).map(l => `<span>${esc(LINK_TYPES[l.type])} ${refHTML(l.to)}</span>`);
  const inc = (backlinks().get(`${mod}/${e.id}`) || []).map(b => `<span>${esc(LINK_BACK[b.type])} ${refHTML(b.from)}</span>`);
  const motifs = motifsOf(text);
  const parts = [e.editedAt ? `<span class="hint">modifié ${ago(e.editedAt)}</span>` : "", originHTML(e, text),
    out.length || inc.length ? `<span class="links">${[...out, ...inc].join("")}</span>` : "",
    motifs.length ? `<span class="m-motifs"><span class="m-lab">motifs</span>${motifs.map(m => `<button type="button" data-act="search-for" data-q="${esc(m.e.title)}">${esc(m.e.title)}</button>`).join("")}</span>` : ""];
  return `<aside class="marg" aria-label="En marge">${parts.join("")}</aside>`;
}
/* Dérivation en cours, par module : la prochaine entrée écrite dérivera de ces références (une, ou deux pour
   résoudre une tension). Propre à l'appareil, oubliée si l'on quitte l'app. */
const deriveFrom = {};
export function deriveBanner(mod) {
  const refs = deriveFrom[mod]; if (!refs || !refs.length) return "";
  return `<div class="derive">${refs.length > 1 ? "Synthèse de" : "Dérivé de"} ${refs.map(refHTML).join(" et ")} <button class="btn ghost sm" data-act="derive-cancel" data-mod="${esc(mod)}">annuler</button></div>`;
}
export function applyDerive(mod, item) {
  for (const ref of deriveFrom[mod] || []) if (ref !== `${mod}/${item.id}`) addLink(item, ref, "derive", uid(), todayISO());
  const n = (deriveFrom[mod] || []).length; delete deriveFrom[mod];
  return n;
}
function linkForm(mod, id) {
  const self = `${mod}/${id}`, choices = thoughtItems().filter(x => x.ref !== self).sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).slice(0, 300);
  if (!choices.length) return toast("Rien d'autre à quoi le lier. Une pensée seule ne se contredit pas encore.");
  openForm("Lier à une autre entrée", [
    { n: "type", l: "Cette entrée…", t: "select", o: Object.entries(LINK_TYPES) },
    { n: "to", l: "…quelle autre", t: "select", o: choices.map(x => [x.ref, `${label(x.mod)} · ${x.e.date ? fmt(x.e.date) + " · " : ""}${excerpt(x.e, 70)}`]) }
  ], { type: "echo" }, v => {
    const hit = refFind(self); if (!hit) return toast("Cette entrée a disparu entre-temps.");
    if (!addLink(hit.e, v.to, v.type, uid(), todayISO())) return toast("Déjà lié ainsi.");
    site.save(); render(); toast(v.type === "contredit" ? "Tension ouverte. Elle attendra sa synthèse." : "Lié.");
  });
}
/* Le statut épistémique d'un fragment ou d'une note, modifiable sur place ; vide par défaut. Vide, c'est une action
   (discrète, comme les autres actions de ligne) ; posé, c'est une information, toujours visible. */
export const epSelect = (id, e) => `<select class="ep ${e.ep ? "on" : "ra"}" data-act="ep-set" data-mod="${esc(id)}" aria-label="Statut">${[["", "statut…"], ...Object.entries(EP_STATUS)].map(([k, l]) => `<option value="${k}" ${(e.ep || "") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
/* Liaisons, communes aux fragments et aux notes (l'entrée est cherchée par sa référence « module/id »). */
CLICK["derive-start"] = el => {
  const mod = el.dataset.mod, id = idOf(el); if (!refFind(`${mod}/${id}`)) return;
  deriveFrom[mod] = [`${mod}/${id}`]; closeSheet(); // depuis une fiche : on va écrire dans l'espace de l'entrée
  if (routeOf().view !== mod) { location.hash = mod; return; }
  render();
  const inp = $("#scrapIn") || $("#noteIn"); if (inp) inp.focus();
};
CLICK["derive-cancel"] = el => { delete deriveFrom[el.dataset.mod]; render(); };
CLICK["link-form"] = el => linkForm(el.dataset.mod, idOf(el));
/* Résoudre une tension : écrire, dans le module de la première entrée, une synthèse qui dérive des deux. */
CLICK["tension-resolve"] = el => {
  const a = el.dataset.a, b = el.dataset.b, hit = refFind(a); if (!hit) return;
  deriveFrom[hit.mod] = [a, b];
  if (location.hash === "#" + hit.mod) render(); else location.hash = hit.mod;
};
/* Dossier d'une tension : les deux entrées, puis leur voisinage direct (ce qui les lie ou les vise). */
CLICK["tension-dossier"] = el => {
  const refs = [el.dataset.a, el.dataset.b], seen = new Set(refs);
  for (const it of thoughtItems()) for (const l of it.e.links || []) {
    if (refs.includes(it.ref) && !seen.has(l.to)) seen.add(l.to);
    if (refs.includes(l.to) && !seen.has(it.ref)) seen.add(it.ref);
  }
  const items = [...seen].map(refFind).filter(Boolean).map(h => ({ mod: h.mod, text: h.e.text, date: h.e.date, e: h.e }));
  if (items.length < 2) return toast("L'une des deux entrées a disparu.");
  dossierFile(`Tension — ${excerpt(items[0].e, 40)}`, `« ${excerpt(items[0].e, 80)} » contredit « ${excerpt(items[1].e, 80)} », et leur voisinage`, items);
};
/* Statut épistémique, commun aux fragments et aux notes : l'élément est cherché dans les deux listes du module. */
CHANGE["ep-set"] = el => {
  const inst = S().modules[modOf(el)], id = idOf(el), item = inst && [...inst.entries, ...(inst.scraps || [])].find(x => x.id === id);
  if (!item) return;
  setEpStatus(item, el.value, todayISO()); site.save(); render();
};
/* Le statut épistémique codé par la forme, pas par la couleur : observé plein, hypothèse pointillée,
   interprétation à moitié, inexpliqué pointé. */
const EP_GLYPH = { obs: `<circle cx="8" cy="8" r="5" fill="currentColor"/>`, hyp: `<circle cx="8" cy="8" r="5" stroke-dasharray="2 2"/>`,
  int: `<circle cx="8" cy="8" r="5"/><path d="M8 3a5 5 0 0 1 0 10z" fill="currentColor" stroke="none"/>`, inx: `<circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/>` };
export const epGlyph = ep => Object.hasOwn(EP_GLYPH, ep || "") ? `<svg class="ep-glyph" viewBox="0 0 16 16" aria-hidden="true">${EP_GLYPH[ep]}</svg>` : "";
