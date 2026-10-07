/* La concordance : des motifs (une collection) comptés dans les textes de tous les autres modules ; voisins, jachère,
   index par rendu. */
import { saveCollectionItem } from "../../core/domain.js";
import { CLICK, TYPE_UI } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { ago, diffDays, todayISO, uid } from "../lib/format.js";
import { collate, tr, trn } from "../i18n/index.js";
import { SYNODIC } from "../scene/moon.js";
import { memoInRender, render } from "../shell/render.js";
import { S, enabled, label, site } from "../state/site.js";
import { fold } from "../views/recherche.js";

CLICK["motif-add"] = el => {
  const inst = S().modules[el.dataset.mod], word = el.dataset.q; if (!inst || !word) return;
  if (inst.entries.some(e => fold(e.title) === fold(word))) return toast(tr`« ${word} » est déjà un motif.`);
  saveCollectionItem(inst, { title: word }, uid()); site.save(); render();
  toast(tr`« ${word} » devient un motif de ${label(el.dataset.mod)}. On verra s'il revient.`);
};
/* ---- concordance : une collection de motifs, comptés dans les textes de tous les autres modules ----
   Mot entier (« lune » ne trouve pas « lunettes »), sans accents ni casse, pluriel toléré (voir pluralForms) ; les variantes
   (sous-titre, séparées par des virgules) comptent comme le motif. Tout est calculé à la lecture, sur l'historique
   existant : rien n'est enregistré, donc rien à migrer ni à synchroniser. */
export const isConcordance = inst => inst.type === "collection" && !!inst.config.concordance;
const reEscape = v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* Les mots d'un texte déjà replié, découpé une fois pour toutes (même frontière de mot que motifMatcher). */
const wordsCache = new Map();
function wordsOf(f) {
  let w = wordsCache.get(f);
  if (!w) { w = new Set(f.split(/[^\p{L}\p{N}]+/u)); if (wordsCache.size >= 20000) wordsCache.clear(); wordsCache.set(f, w); }
  return w;
}
/* Les formes d'un mot au pluriel, en français et en anglais à la fois : -s, -x, -es (« box », « boxes »), -y → -ies
   (« story », « stories »). Engendrées depuis le motif, jamais repliées depuis le texte : une forme qui n'existe pas ne
   trouve rien, donc mêler les deux langues ne fusionne pas deux mots (là où replier le texte, comme la dérive, le ferait :
   « parties » n'est pas « party »). */
const pluralForms = v => [v, v + "s", v + "x", v + "es", ...(/[^aeiou]y$/.test(v) ? [v.slice(0, -1) + "ies"] : [])];
/* Un motif et ses variantes, repliés : celles d'un seul mot (cherchées dans l'ensemble des mots d'un texte, avec leurs
   pluriels) et, pour celles de plusieurs mots, une expression régulière au mot entier. */
export function motifForms(e) {
  const vs = [e.title, ...String(e.subtitle || "").split(",")].map(v => fold(v.trim())).filter(v => v.length >= 2);
  const single = vs.filter(v => !/[^\p{L}\p{N}]/u.test(v)), multi = vs.filter(v => !single.includes(v));
  return { single, re: multi.length ? new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${multi.map(v => reEscape(v).replace(/\s+/g, "\\s+")).join("|")})(?:s|x|es)?(?=$|[^\\p{L}\\p{N}])`, "u") : null };
}
/* Pour chaque motif : les textes où il apparaît ({ mod, date }), et ses voisins (motifs présents dans les mêmes textes). */
export const concordance = inst => memoInRender(inst, () => computeConcordance(inst));
function computeConcordance(inst) {
  const corpus = [];
  for (const [mid, m] of Object.entries(S().modules)) {
    const ui = TYPE_UI[m.type];
    if (!isConcordance(m) && ui && ui.texts) for (const t of ui.texts(m)) { const f = fold(t.text); corpus.push({ mod: mid, f, w: wordsOf(f), date: t.date || null }); }
  }
  // Index inversé : chaque forme de mot → les motifs qu'elle désigne. Un texte se parcourt alors mot à mot,
  // au lieu d'être confronté à chaque motif (le coût suit la longueur des textes, plus leur nombre × motifs).
  const forms = new Map(), multi = [], hits = inst.entries.map(() => []), near = inst.entries.map(() => new Map());
  inst.entries.forEach((e, i) => {
    const m = motifForms(e);
    for (const v of m.single) for (const f of pluralForms(v)) { if (!forms.has(f)) forms.set(f, new Set()); forms.get(f).add(i); }
    if (m.re) multi.push([i, m.re]);
  });
  for (const d of corpus) {
    const set = new Set();
    for (const w of d.w) { const ms = forms.get(w); if (ms) for (const i of ms) set.add(i); }
    for (const [i, re] of multi) if (!set.has(i) && re.test(d.f)) set.add(i);
    const found = [...set];
    for (const i of found) { hits[i].push(d); for (const j of found) if (j !== i) near[i].set(j, (near[i].get(j) || 0) + 1); }
  }
  return inst.entries.map((e, i) => {
    const dated = hits[i].filter(d => d.date).sort((a, b) => b.date.localeCompare(a.date));
    // Un voisinage d'une seule rencontre n'est pas une constellation : au moins deux.
    const neighbours = [...near[i]].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([j, n]) => ({ name: inst.entries[j].title, n }));
    return { e, hits: hits[i], last: dated[0] || null, neighbours };
  });
}
const alive = (inst, e) => inst.config.statuses.indexOf(e.status) < inst.config.doneFrom;
/* En jachère : un motif vivant déjà apparu, mais plus depuis fallowDays jours (en lunaisons pour le dire). */
export const fallow = (inst, r) => alive(inst, r.e) && r.last && diffDays(todayISO(), r.last.date) > (+inst.config.fallowDays || 90);
const moons = days => Math.max(1, Math.floor(days / SYNODIC));
export function concordanceView(id, inst, head) {
  const c = inst.config, rows = concordance(inst), sleeping = rows.filter(r => fallow(inst, r));
  const order = (a, b) => alive(inst, b.e) - alive(inst, a.e) || b.hits.length - a.hits.length || collate(a.e.title, b.e.title);
  const line = r => {
    const e = r.e, n = r.hits.length;
    const where = r.last ? " · " + tr`dernière ${ago(r.last.date)} (${esc(label(r.last.mod))})` : n ? " · " + tr`jamais daté` : "";
    return `<li class="item motif" data-id="${esc(e.id)}"><span></span><div><b>${esc(e.title)}</b>${e.subtitle ? ` <i class="hint">${esc(e.subtitle)}</i>` : ""}${c.fields.tag && e.tag ? ` <span class="tag">${esc(e.tag)}</span>` : ""}
      <div class="meta"><span>${n ? trn(n, "{0} occurrence", "{0} occurrences") : tr`jamais rencontré`}${where}</span>${fallow(inst, r) ? `<span class="late">${tr`en jachère`}</span>` : ""}</div>
      ${r.neighbours.length ? `<div class="meta"><span>${tr`voisins : ${r.neighbours.map(x => `${esc(x.name)} (${x.n})`).join(", ")}`}</span></div>` : ""}
      ${c.fields.text && e.text ? `<div class="note" style="margin:2px 0 0">${esc(e.text)}</div>` : ""}</div>
      <div class="row"><select data-act="col-st" aria-label="${esc(c.statusLabel)}">${c.statuses.map(st => `<option ${st === e.status ? "selected" : ""}>${esc(st)}</option>`).join("")}</select>${n ? `<button class="btn ghost sm" data-act="search-for" data-q="${esc(e.title)}">${tr`voir`}</button><button class="btn ghost sm ra" data-act="carte" data-k="motif" data-v="${esc(id)}/${esc(e.id)}">${tr`carte`}</button>` : ""}<button class="btn ghost sm ra" data-act="specimen">${tr`fiche`}</button><button class="btn ghost sm ra" data-act="col-edit">${tr`modifier`}</button><button class="btn ghost sm ra" data-act="col-del">${tr`suppr.`}</button></div></li>`;
  };
  return `<div data-mod="${esc(id)}">${head}
  ${sleeping.length ? `<section><h3>${tr`En jachère`}</h3><p class="hint">${trn(+c.fallowDays || 90, "Vivants, mais absents depuis plus de {0} jour. Reposés, pas perdus.", "Vivants, mais absents depuis plus de {0} jours. Reposés, pas perdus.")}</p><div class="row">${sleeping.map(r => `<button class="btn ghost sm" data-act="search-for" data-q="${esc(r.e.title)}">${esc(r.e.title)} · ${trn(moons(diffDays(todayISO(), r.last.date)), "{0} lunaison", "{0} lunaisons")}</button>`).join("")}</div></section>` : ""}
  <ul class="plain">${[...rows].sort(order).map(line).join("") || `<li class="empty">${tr`Aucun motif. Ajoute un mot qui revient ; l'app comptera ses retours.`}</li>`}</ul></div>`;
}
export function concordanceSummary(inst) {
  const sleeping = concordance(inst).filter(r => fallow(inst, r)).length;
  return trn(inst.entries.length, "{0} motif", "{0} motifs") + (sleeping ? ", " + tr`${sleeping} en jachère` : "");
}
/* Les motifs apparus dans une période, les plus fréquents d'abord : une ligne de bilan. */
export function motifsIn(inst, from, to) {
  return concordance(inst).map(r => ({ name: r.e.title, n: r.hits.filter(d => d.date && d.date >= from && d.date < to).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
}
/* Les motifs (collections en concordance) présents dans un texte, selon la règle même de la concordance. */
/* Les motifs et leurs formes, calculés une fois par rendu : les marges en demandent pour chaque ligne affichée, et
   chaque forme à plusieurs mots est une expression régulière qu'on ne recompilerait pas cent fois. */
const motifIndex = () => memoInRender("motifIndex", () => {
  const out = [];
  for (const [id, inst] of Object.entries(S().modules)) if (isConcordance(inst) && enabled(id)) for (const e of inst.entries) out.push({ id, e, m: motifForms(e) });
  return out;
});
/* Un texte contient-il ce motif (ses formes, motifForms) ? Au pluriel près, sans accents. */
export function motifHit(m, text) {
  const f = fold(text), w = wordsOf(f);
  return m.single.some(v => pluralForms(v).some(x => w.has(x))) || !!(m.re && m.re.test(f));
}
export function motifsOf(text) {
  return motifIndex().filter(({ m }) => motifHit(m, text)).map(({ id, e }) => ({ id, e }));
}
