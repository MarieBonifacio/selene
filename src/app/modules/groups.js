/* Regroupements à pourcentage, communs aux types qui en ont : par quel champ, dans quel ordre, filtre, panneau de
   réglage. */
import { CLICK, TYPE_UI } from "../registry.js";
import { esc } from "../lib/dom.js";
import { collate, tr } from "../i18n/index.js";
import { render } from "../shell/render.js";
import { openSheet } from "../shell/sheets.js";
import { S } from "../state/site.js";

export const gFilter = {};
export const itemGroups = (items, keyFn, doneFn) => {
  const m = new Map();
  for (const it of items) { const k = keyFn(it) || tr`Sans groupe`; const g = m.get(k) || { name: k, num: 0, den: 0 }; g.den++; if (doneFn(it)) g.num++; m.set(k, g); }
  return [...m.values()].map(g => ({ ...g, pct: Math.round(100 * g.num / g.den), sub: tr`${g.num} sur ${g.den}` }));
};
/* Regroupement en pourcentage d'un module : fourni par son type (TYPE_UI[type].grouper), réglé dans inst.config.groups. */
export function grouperFor(mod) {
  const inst = Object.hasOwn(S().modules, mod) ? S().modules[mod] : null;
  return inst && TYPE_UI[inst.type].grouper ? TYPE_UI[inst.type].grouper(inst, mod) : null;
}
export const gcfg = mod => S().modules[mod].config.groups;
export const groupBy = mod => { const G = grouperFor(mod), by = gcfg(mod).by; return G.fields[by] ? by : Object.keys(G.fields)[0]; };
 // un champ désactivé depuis ne casse rien
export function groupPanel(mod, hint) {
  const G = grouperFor(mod), c = gcfg(mod);
  if (!G || !c || !c.on) return "";
  const by = groupBy(mod);
  let gs = G.groups(by);
  if (c.hideDone) gs = gs.filter(g => g.pct !== 100);
  const sorters = { name: (a, b) => (a.order ?? 0) - (b.order ?? 0) || collate(a.name, b.name), pct: (a, b) => (b.pct ?? -1) - (a.pct ?? -1), left: (a, b) => ((a.pct ?? 101)) - ((b.pct ?? 101)) };
  gs.sort(sorters[c.sort] || sorters.name);
  const active = gFilter[mod];
  const title = c.title || tr`Par ${G.fields[by].toLowerCase()}`;
  return `<section><div class="row" style="margin-bottom:4px"><h3 style="margin:0">${esc(title)}</h3><span class="spacer"></span><a class="btn ghost sm" href="#reglages" data-act="goto-groups" data-mod="${esc(mod)}">${tr`régler`}</a></div>
    <p class="hint">${hint}</p>
    <div class="rooms">${gs.map(g => `<button class="room ${active === g.name ? "active" : ""} ${g.pct > 100 ? "over" : ""}" ${G.filterable ? `data-act="grp-filter" data-mod="${esc(mod)}" data-g="${esc(g.name)}"` : "disabled"}><div class="fill" style="width:${Math.min(100, g.pct ?? 0)}%"></div><small>${esc(g.name)}</small><b>${g.pct == null ? "—" : tr`${g.pct} %`}</b><small>${esc(g.sub)}</small></button>`).join("") || `<p class="empty">${tr`Rien à regrouper pour l'instant.`}</p>`}</div></section>`;
}
export const gMatch = (mod, it) => { const v = gFilter[mod]; if (!v) return true; return (grouperFor(mod).key(it, groupBy(mod)) || tr`Sans groupe`) === v; };
CLICK["grp-filter"] = el => { const m = el.dataset.mod, g = el.dataset.g; gFilter[m] = gFilter[m] === g ? "" : g; render(); };
// « régler » : les réglages du module s'ouvrent sur place (une feuille), sans quitter ce qu'on regardait ;
// depuis la page Réglages, le bloc du module se déplie.
CLICK["goto-groups"] = (el, e) => {
  const mod = el.dataset.mod, id = "mreg-" + mod;
  if (location.hash === "#reglages") { const d = document.getElementById(id); if (d) { d.open = true; d.scrollIntoView(); } return; }
  if (e) e.preventDefault();
  openSheet("module", mod);
};
