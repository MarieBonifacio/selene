/* Les sortes : une entrée ancienne, oubliée, tirée au sort pour être relue. */
import { CLICK } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { diffDays, todayISO } from "../lib/format.js";
import { tr, trn } from "../i18n/index.js";
import { linkLabel } from "../lib/labels.js";
import { concordance, fallow, isConcordance } from "./concordance.js";
import { excerpt, refHTML } from "./links.js";
import { openTensions } from "./tensions.js";
import { SYNODIC } from "../scene/moon.js";
import { render } from "../shell/render.js";
import { S, enabled, label } from "../state/site.js";

/* Sortes.
   Un tirage dans son propre matériau : un fragment ou une note qu'on n'a pas retouché depuis longtemps, une
   tension ouverte, un motif en jachère. Pondéré par l'oubli : plus c'est ancien, plus ça a de chances de
   sortir. Rien n'est enregistré ; le dernier tirage vit dans une variable, oublié à la prochaine ouverture. */
const SORTES_MIN_DAYS = 14;
 // en dessous, ce n'est pas de l'oubli, c'est hier
let sortesLast = null;
// Une entrée tirée au sort qui vient d'être reliée n'est plus oubliée : le tirage affiché s'efface.
export function sortesForget(e) { if (sortesLast && sortesLast.e === e) sortesLast = null; }
export function sortesPool() {
  const now = todayISO(), out = [];
  for (const [mod, m] of Object.entries(S().modules)) {
    if (!enabled(mod)) continue;
    // Accolades obligatoires sur chaque branche : un « if » nu dans un for (comme celui des notes) capturerait
    // sinon le « else if » suivant (dangling else), et la branche motifs ne s'exécuterait jamais.
    if (m.type === "cumul") { for (const f of m.scraps || []) { const last = f.editedAt || f.date; if (last) out.push({ kind: "fragment", mod, e: f, days: diffDays(now, last) }); } }
    else if (m.type === "notes") { for (const e of m.entries) if (e.date) out.push({ kind: "note", mod, e, days: diffDays(now, e.date) }); }
    else if (isConcordance(m)) { for (const r of concordance(m)) if (fallow(m, r)) out.push({ kind: "motif", mod, e: r.e, days: r.last ? diffDays(now, r.last.date) : 3650 }); }
    // Une source gardée et reliée à rien : l'oubli se compte depuis le jour où elle a été gardée (sans date connue,
    // une source ancienne entre au seuil, avec le poids le plus faible).
    else if (m.type === "collection" && m.config.sources) { for (const e of m.entries) if (!(e.links || []).length) { const d = e.kept || (e.origin && e.origin.date); out.push({ kind: "source", mod, e, days: d ? diffDays(now, d) : SORTES_MIN_DAYS }); } }
  }
  for (const t of openTensions()) out.push({ kind: "tension", a: t.a, b: t.b, days: t.date ? diffDays(now, t.date) : SORTES_MIN_DAYS });
  return out.filter(x => x.days >= SORTES_MIN_DAYS);
}
/* Tirage pondéré : chaque candidat pèse son nombre de jours de silence, donc davantage de chances pour ce qui
   dort depuis longtemps, sans jamais exclure ce qui vient tout juste de passer le seuil. */
export function sortesDraw() {
  const pool = sortesPool(); if (!pool.length) return null;
  let r = Math.random() * pool.reduce((a, x) => a + x.days, 0);
  for (const x of pool) { r -= x.days; if (r <= 0) return x; }
  return pool.at(-1);
}
export function sortesCard(x) {
  if (x.kind === "tension") return `<div class="card"><span class="tag">${tr`Tension ouverte`}</span><p>${refHTML(x.a)} <span class="hint">${esc(linkLabel("contredit"))}</span> ${refHTML(x.b)}</p><div class="row"><button class="btn ghost sm" data-act="tension-resolve" data-a="${esc(x.a)}" data-b="${esc(x.b)}">${tr`résoudre`}</button><button class="btn ghost sm" data-act="tension-dossier" data-a="${esc(x.a)}" data-b="${esc(x.b)}">${tr`dossier`}</button></div></div>`;
  if (x.kind === "source") {
    const st = S().modules[x.mod].config.statuses, fresh = x.e.status === st[0], lun = Math.floor(x.days / SYNODIC);
    const url = x.e.src && /^https?:\/\//i.test(x.e.src.url || "") ? x.e.src.url : "";
    return `<div class="card"><span class="tag">${tr`Source oubliée, ${esc(label(x.mod))}`}</span><p><b>${esc(x.e.title)}</b>${x.e.subtitle ? `, <i>${esc(x.e.subtitle)}</i>` : ""}</p>
      <div class="meta">${x.e.src && x.e.src.site ? `<span>${esc(x.e.src.site)}</span>` : ""}<span>${tr`gardée il y a ${lun >= 2 ? tr`${lun} lunaisons` : trn(x.days, "{0} jour", "{0} jours")}, ${fresh ? tr`jamais relue` : tr`reliée à rien`}`}</span></div>
      <div class="row">${url ? `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${tr`ouvrir ↗`}</a>` : ""}<a class="btn ghost sm" href="#${esc(x.mod)}/${esc(x.e.id)}">${tr`voir`}</a><button class="btn ghost sm" data-act="src-link" data-ref="${esc(x.mod)}/${esc(x.e.id)}">${tr`documente…`}</button></div></div>`;
  }
  if (x.kind === "motif") return `<div class="card"><span class="tag">${tr`Motif en jachère, ${esc(label(x.mod))}`}</span><p><b>${esc(x.e.title)}</b></p><div class="row"><a class="btn ghost sm" href="#${esc(x.mod)}">${tr`voir`}</a><button class="btn ghost sm" data-act="search-for" data-q="${esc(x.e.title)}">${tr`chercher`}</button></div></div>`;
  return `<div class="card"><span class="tag">${x.kind === "fragment" ? tr`${esc(label(x.mod))}, fragment endormi` : tr`${esc(label(x.mod))}, note endormie`}</span><p style="white-space:pre-wrap">${esc(excerpt(x.e, 200))}</p><div class="meta"><span>${trn(x.days, "{0} jour sans y toucher", "{0} jours sans y toucher")}</span></div><div class="row"><a class="btn ghost sm" href="#${esc(x.mod)}">${tr`voir`}</a></div></div>`;
}
export function sortesSection() {
  return `<section><h2>${tr`Tirer un sort`}</h2><p class="hint">${tr`Un fragment endormi, une note oubliée, une source gardée puis reliée à rien, une tension ouverte ou un motif en jachère — le hasard pondéré par l'oubli, dans ton seul matériau.`}</p>
    ${sortesLast ? sortesCard(sortesLast) : ""}
    <button class="btn ${sortesLast ? "ghost" : ""} sm" data-act="sortes-draw">${sortesLast ? tr`Retirer` : tr`Tirer`}</button></section>`;
}
CLICK["sortes-draw"] = () => { sortesLast = sortesDraw(); render(); if (!sortesLast) toast(tr`Rien d'assez ancien à tirer. Reviens dans deux semaines.`); };
