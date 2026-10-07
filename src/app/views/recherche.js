/* La recherche : dans tous les textes, sans accents ni casse, par période et statut. */
import { EP_STATUS } from "../../core/domain.js";
import { CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { esc } from "../lib/dom.js";
import { fmt } from "../lib/format.js";
import { epLabel } from "../lib/labels.js";
import { tr, trn, trp } from "../i18n/index.js";
import { dossierFile } from "../features/dossier.js";
import { epGlyph, thoughtItems } from "../features/links.js";
import { render } from "../shell/render.js";
import { sigil, tintOf } from "../shell/sigils.js";
import { S, label } from "../state/site.js";
import { periodOf } from "./bilan.js";

/* Recherche.
   Dans tous les textes de tous les modules (chaque type dit lesquels : TYPE_UI[type].texts), sans tenir
   compte des accents ni de la casse ; tous les mots doivent apparaître. */
export let searchQuery = "";
/* Une recherche lancée d'ailleurs (un mot du bilan, un motif, « Chercher « … » partout » de la palette) repart sans
   filtre : « partout » le promet (evolution-ui.md ; A38). Revenir à la page Chercher (« / », « ‹ Recherche ») la laisse
   telle qu'elle était, ses filtres dits par « N résultats sur M ». */
export const searchFresh = q => { searchQuery = q; Object.assign(searchFacets, { mod: "", period: "", ep: "" }); };
document.addEventListener("input", e => { if (e.target.id === "searchIn") { searchQuery = e.target.value; render(); } });
// Chaque caractère devient sa forme sans accent et en minuscule, de même longueur exactement (sinon il reste tel
// quel : emoji sur deux unités, « İ » qui devient deux lettres) : les positions restent alignées pour surligner.
// Fonction pure et appelée sur tout l'historique à chaque recherche ou concordance : ses résultats sont gardés
// (jamais périmés, puisque la même entrée donne toujours la même sortie), dans une limite de taille.
const foldCache = new Map();
export const fold = s => {
  s = String(s);
  let f = foldCache.get(s);
  if (f === undefined) {
    f = [...s].map(ch => { const b = ch.normalize("NFD")[0].toLowerCase(); return b.length === ch.length ? b : ch; }).join("");
    if (foldCache.size >= 20000) foldCache.clear();
    foldCache.set(s, f);
  }
  return f;
};
/* « statut:hypothèse » (ou « statut:hyp ») ne garde que ce qui porte ce statut ; seul, il les liste tous. « status: »,
   ou le mot de la langue en vigueur, vaut « statut: », et le libellé se dit en français ou dans cette langue
   (« status:hypothesis »). Un statut inconnu ou vide ne trouve rien, plutôt que d'être ignoré en silence. */
const isEpWord = w => /^statu[ts]:/.test(w) || w.startsWith(fold(trp("recherche", "statut")) + ":");
const epQuery = w => { const q = w.slice(w.indexOf(":") + 1); return (q && Object.keys(EP_STATUS).find(k => fold(EP_STATUS[k]).startsWith(q) || fold(epLabel(k)).startsWith(q))) || null; };
export function searchAll(q) {
  const words = fold(q).split(/\s+/).filter(Boolean), st = words.find(isEpWord), want = st ? epQuery(st) : null;
  const terms = words.filter(w => !isEpWord(w)), out = [];
  if ((st && !want) || (!terms.length && !want)) return out;
  for (const m of S().config.modules) {
    const inst = Object.hasOwn(S().modules, m.id) ? S().modules[m.id] : null, ui = inst && TYPE_UI[inst.type];
    if (!ui || !ui.texts) continue;
    for (const t of ui.texts(inst)) { const f = fold(t.text); if ((!want || t.ep === want) && terms.every(w => f.includes(w))) out.push({ id: m.id, ...t }); }
  }
  return out;
}
export function highlight(text, q) {
  const f = fold(text), marks = [];
  for (const w of fold(q).split(/\s+/).filter(w => w && !isEpWord(w))) { let i = f.indexOf(w); while (i >= 0) { marks.push([i, i + w.length]); i = f.indexOf(w, i + w.length); } }
  marks.sort((a, b) => a[0] - b[0]);
  let html = "", pos = 0;
  for (const [a, b] of marks) { if (a < pos) continue; html += esc(text.slice(pos, a)) + `<mark>${esc(text.slice(a, b))}</mark>`; pos = b; }
  return html + esc(text.slice(pos));
}
/* Facettes de la recherche : un espace, une période (la lunaison ou le mois en cours), un statut. Propres à
   l'appareil ; une recherche lancée d'ailleurs (un mot du bilan, un motif) repart sans filtre. */
const searchFacets = { mod: "", period: "", ep: "" };
const facetPeriod = k => k ? periodOf(k, 0) : null;
function facetFilter(hits, skip = "") {
  const f = searchFacets, per = skip !== "period" && facetPeriod(f.period);
  return hits.filter(h => (skip === "mod" || !f.mod || h.id === f.mod) && (!per || (h.date && h.date >= per.from && h.date < per.to)) && (skip === "ep" || !f.ep || h.ep === f.ep));
}
VIEWS.recherche = () => {
  const all = searchAll(searchQuery), hits = facetFilter(all), f = searchFacets, s = S();
  // Chaque facette compte ce que donneraient ses valeurs, les autres facettes restant appliquées.
  const chip = (k, v, text, n) => `<button type="button" class="chip-f ${f[k] === v ? "on" : ""}" data-act="facet" data-k="${k}" data-v="${esc(v)}" aria-pressed="${f[k] === v}">${text}${n != null ? ` <span>${n}</span>` : ""}</button>`;
  const byMod = facetFilter(all, "mod"), byPer = facetFilter(all, "period"), byEp = facetFilter(all, "ep");
  const mods = s.config.modules.map(m => m.id).filter(id => byMod.some(h => h.id === id));
  const facets = all.length ? `<div class="facets">
    <div class="row">${chip("mod", "", tr`Tous les espaces`, byMod.length)}${mods.map(id => chip("mod", id, `${sigil(id)}${esc(label(id))}`, byMod.filter(h => h.id === id).length)).join("")}</div>
    <div class="row">${[["", tr`Toute date`], ["lune", tr`Depuis la nouvelle lune`], ["mois", tr`Ce mois-ci`]].map(([v, t]) => chip("period", v, t, v ? byPer.filter(h => { const p = facetPeriod(v); return h.date && h.date >= p.from && h.date < p.to; }).length : byPer.length)).join("")}
      ${Object.keys(EP_STATUS).some(k => byEp.some(h => h.ep === k)) ? `<span class="spacer"></span>${chip("ep", "", tr`Tout statut`, null)}${Object.keys(EP_STATUS).filter(k => byEp.some(h => h.ep === k)).map(k => chip("ep", k, `${epGlyph(k)}${esc(epLabel(k))}`, byEp.filter(h => h.ep === k).length)).join("")}` : ""}</div></div>` : "";
  // Groupés par espace, dans l'ordre de la navigation ; 80 résultats au plus, les plus récents d'abord dans chaque espace.
  let budget = 80;
  const groups = s.config.modules.map(m => m.id).map(id => [id, hits.filter(h => h.id === id).sort((a, b) => (b.date || "").localeCompare(a.date || ""))]).filter(([, l]) => l.length).map(([id, l]) => {
    const shown = l.slice(0, Math.max(0, budget)); budget -= shown.length;
    return shown.length ? `<p class="grp search-grp ${tintOf(id)}">${sigil(id)}${esc(label(id))} <span>${l.length}</span></p><ul class="plain">${shown.map(h => `<li class="item"><span class="jdate">${h.date ? fmt(h.date) : ""}</span><div>${highlight(h.text.length > 240 ? h.text.slice(0, 240) + "…" : h.text, searchQuery)}${h.ep ? `<div class="meta"><span>${epGlyph(h.ep)}${esc(epLabel(h.ep))}</span></div>` : ""}</div><a class="btn ghost sm" href="#${esc(h.id)}${h.eid ? "/" + esc(h.eid) : ""}">${tr`ouvrir`}</a></li>`).join("")}</ul>` : "";
  }).join("");
  const filtered = hits.length !== all.length;
  return `<h2>${tr`Chercher`}</h2><p class="hint">${tr`Dans tous tes modules : notes, fragments, tâches, légendes, journaux. Les accents ne comptent pas. « ${`${trp("recherche", "statut")}:${epLabel("hyp")}`} » ne garde que les hypothèses (de même pour ${["obs", "int", "inx"].map(epLabel).join(", ")}). Touche « / » pour venir ici.`}</p>
  <input id="searchIn" type="search" value="${esc(searchQuery)}" placeholder="${tr`Un mot, un bout de phrase…`}" aria-label="${tr`Chercher`}" autocomplete="off" style="max-width:520px">
  ${searchQuery.trim() ? `<div class="row" style="margin-top:12px"><p class="hint" style="margin:0">${hits.length ? filtered ? trn(hits.length, "{0} résultat sur {1}", "{0} résultats sur {1}", all.length) : trn(hits.length, "{0} résultat", "{0} résultats") : all.length ? tr`Rien avec ces filtres.` : tr`Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire.`}</p>${hits.length ? `<span class="spacer"></span><button class="btn ghost sm" data-act="search-dossier" title="${tr`Les résultats affichés, avec dates, statuts, provenance et liens, pour une lecture assistée`}">${tr`Exporter en dossier`}</button>` : ""}</div>
  ${facets}${groups}` : ""}`;
};
// Tous les résultats (pas seulement les 80 affichés), dans l'ordre du temps ; un fragment ou une note garde ses
// statut, provenance et liens (retrouvés par module et texte : la recherche ne renvoie que des textes).
CLICK["search-dossier"] = () => {
  const q = searchQuery.trim(), thoughts = thoughtItems();
  const items = facetFilter(searchAll(q)).map(h => ({ mod: h.id, text: h.text, date: h.date, e: (thoughts.find(x => x.mod === h.id && x.e.text === h.text) || {}).e }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (items.length) dossierFile(tr`Recherche — ${q}`, tr`Résultats de la recherche « ${q} »`, items);
};
CLICK["facet"] = el => { const k = el.dataset.k; if (Object.hasOwn(searchFacets, k)) { searchFacets[k] = searchFacets[k] === el.dataset.v ? "" : el.dataset.v; render(); } };
CLICK["search-for"] = el => { searchFresh(el.dataset.q); if (location.hash === "#recherche") render(); else location.hash = "recherche"; };
