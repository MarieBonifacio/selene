/* La navigation : routes (#vue/entrée), domaines, barre latérale, espaces récents, retour, entrée visée, ouverture de
   l'app. */
import { platform } from "../../platform.js";
import { inboxId } from "../../core/domain.js";
import { TYPE_UI } from "../registry.js";
import { $, PAGE, esc, pageSize } from "../lib/dom.js";
import { ago, iso } from "../lib/format.js";
import { tr } from "../i18n/index.js";
import { dehorsOn } from "../features/dehors.js";
import { budMonths } from "../modules/budget.js";
import { colFilter } from "../modules/collection.js";
import { fragFilter } from "../modules/cumul.js";
import { gFilter } from "../modules/groups.js";
import { taskFilters } from "../modules/taches.js";
import { render } from "./render.js";
import { ICONS, sigil, tintOf } from "./sigils.js";
import { S, enabled, label, shownModule } from "../state/site.js";
import { searchQuery } from "../views/recherche.js";

/* Navigation.
   Trois strates : lentilles (Aujourd'hui, Bilan, Chercher), espaces regroupés par domaine (config.modules[].group,
   facultatif), système (Assistant, Réglages). Une route peut viser une entrée : « #module/identifiant ». */
export const routeOf = () => { const [view, entry] = location.hash.slice(1).split("/"); return { view: view || "accueil", entry: /^[\w-]{1,64}$/.test(entry || "") ? entry : "" }; };
export const SYSTEM = ["assistant"];
/* Les espaces actifs, par domaine, dans l'ordre de la navigation ; un domaine apparaît là où apparaît son premier espace. */
export function domains() {
  const s = S(), out = new Map();
  for (const m of s.config.modules) if (shownModule(m) && !SYSTEM.includes(m.id)) {
    const g = String(m.group || "").trim(); if (!out.has(g)) out.set(g, []); out.get(g).push(m.id);
  }
  return [...out].map(([name, ids]) => ({ name, ids }));
}
const badgeOf = id => { const m = Object.hasOwn(S().modules, id) && S().modules[id]; return m && TYPE_UI[m.type].badge ? TYPE_UI[m.type].badge(m) : 0; };
/* À droite d'un espace : un point s'il attend une reprise (pont), le nombre d'éléments en attente. */
export function navMarks(id) {
  const n = badgeOf(id), r = Object.hasOwn(S().modules, id) && S().modules[id].resume;
  return n || r ? `<span class="nx">${r ? `<i class="dot" title="${tr`Pont de reprise en attente`}"><span class="sr">${tr`reprise en attente`}</span></i>` : ""}${n ? `<span class="badge">${n}<span class="sr"> ${tr`en attente`}</span></span>` : ""}</span>` : "";
}
export function navHTML(view) {
  const link = (id, text, extra = "", cls = "") => `<a href="#${esc(id)}" class="${id === view ? "on" : ""} ${cls}"${id === view ? ' aria-current="page"' : ""}>${text}${extra}</a>`;
  return `<button type="button" class="pal-hint" data-act="palette-open">${tr`Aller à…`} <kbd>⌘K</kbd></button>
    ${link("accueil", tr`Aujourd'hui`)}${link("bilan", tr`Bilan`)}${link("recherche", tr`Chercher`)}${dehorsOn() ? link("dehors", `${tr`Nouveautés`} <span class="aka">${tr`Dehors`}</span>`) : ""}
    ${domains().map(d => `<p class="grp">${esc(d.name || tr`Espaces`)}</p>${d.ids.map(id => link(id, `${sigil(id)}${esc(label(id))}`, navMarks(id), tintOf(id))).join("")}`).join("")}
    <div class="sys">${enabled("assistant") ? link("assistant", `${sigil("assistant")}${esc(label("assistant"))}`) : ""}${link("reglages", tr`Réglages`)}</div>`;
}
export function barHTML(view) {
  const inbox = inboxId(S().modules), pending = inbox ? S().modules[inbox].entries.length : 0;
  const inSpace = Object.hasOwn(S().modules, view) || view === "reglages" || view === "assistant";
  const link = (id, text, icon) => `<a href="#${id}" class="${view === id ? "on" : ""}"${view === id ? ' aria-current="page"' : ""}>${ICONS[icon]}<span>${text}</span></a>`;
  return `${link("accueil", tr`Aujourd'hui`, "moon")}
    <button type="button" data-act="sheet-espaces" class="${inSpace ? "on" : ""}" aria-haspopup="dialog">${ICONS.cabinet}<span>${tr`Espaces`}</span>${pending ? `<i class="pip">${pending}<span class="sr"> ${tr`à trier`}</span></i>` : ""}</button>
    <button type="button" data-act="sheet-capture" class="cap" aria-haspopup="dialog">${ICONS.plus}<span>${tr`Capturer`}</span></button>
    ${link("recherche", tr`Chercher`, "search")}${link("bilan", tr`Bilan`, "lunation")}`;
}
/* Les derniers espaces ouverts sur cet appareil (jamais synchronisés), le plus récent d'abord. */
const RECENT_KEY = "selene-recent";
function recents() { try { const r = JSON.parse(platform.storage.get(RECENT_KEY)); return Array.isArray(r) ? r.filter(x => x && typeof x.id === "string") : []; } catch { return []; } }
export function noteVisit(id) { try { platform.storage.set(RECENT_KEY, JSON.stringify([{ id, at: new Date().toISOString() }, ...recents().filter(x => x.id !== id)].slice(0, 5))); } catch {} }
export const liveRecents = () => recents().filter(r => Object.hasOwn(S().modules, r.id) && enabled(r.id));
export const agoTime = t => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return !(m >= 0) ? "" : m < 2 ? tr`à l'instant` : m < 60 ? tr`il y a ${m} min` : m < 1440 ? tr`il y a ${Math.round(m / 60)} h` : ago(iso(new Date(t))); };
/* ---- entrée visée par une route « #module/identifiant » : trouvée, montrée, surlignée ---- */
export let backTo = null;
// La puce « retour » : arriver sur une entrée depuis une autre vue y ramène (liste et position comprises).
export function trackBack(view, entry, from) {
  if (entry && from && from !== view) backTo = { from, to: view, label: backLabel(from) };
  else if (!backTo || view !== backTo.to) backTo = null;
}
 // { from, to, label } : la puce « ‹ … » qui ramène d'où l'on vient
const backLabel = v => v === "dehors" ? tr`Nouveautés` : v === "recherche" ? (searchQuery.trim() ? tr`Recherche « ${searchQuery.trim()} »` : tr`Recherche`) : v === "accueil" ? tr`Aujourd'hui` : v === "bilan" ? tr`Bilan` : v === "reglages" ? tr`Réglages` : label(v) || v;
function entryEl(id) { let hit = null; $("#main").querySelectorAll("[data-id], [data-task]").forEach(el => { if (!hit && (el.dataset.id === id || el.dataset.task === id)) hit = el; }); return hit; }
export function focusEntry(id) {
  const view = routeOf().view;
  // Plus loin dans une liste paginée : on déplie ; masquée par un filtre de l'appareil : on le lève, puis on déplie encore.
  const unfold = () => { let el = entryEl(id); for (let i = 0; !el && i < 50; i++) { const more = [...$("#main").querySelectorAll('[data-act="page-more"]')]; if (!more.length) break; for (const b of more) pageSize[b.dataset.k] = (pageSize[b.dataset.k] || PAGE) + 10 * PAGE; render(); el = entryEl(id); } return el; };
  let el = unfold();
  if (!el && Object.hasOwn(S().modules, view)) {
    const inst = S().modules[view], e = inst.type === "budget" && inst.entries.find(x => x.id === id);
    if (e) budMonths[view] = e.date.slice(0, 7); // une opération d'un autre mois : afficher son mois
    fragFilter[view] = "*"; colFilter[view] = ""; gFilter[view] = ""; if (taskFilters[view]) taskFilters[view] = { room: "", cat: "" };
    render(); el = unfold();
  }
  if (!el) return false;
  el.scrollIntoView({ block: "center" }); el.classList.add("flash");
  return true;
}
/* Ouvrir sur l'accueil ou là où l'on en était : propre à l'appareil. */
export const openOn = () => { try { return platform.storage.get("selene-open") === "last" ? "last" : "accueil"; } catch { return "accueil"; } };
