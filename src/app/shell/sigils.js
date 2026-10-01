/* Les sigles des modules : icônes, sceaux dessinés, teintes, chiffres romains, planche de choix. */
import { CLICK } from "../registry.js";
import { esc } from "../lib/dom.js";
import { N_, tr } from "../i18n/index.js";
import { domains } from "./nav.js";
import { render } from "./render.js";
import { S, label, site } from "../state/site.js";
import { fold } from "../views/recherche.js";

/* Icônes de la barre basse : un trait fin, sans remplissage (une seule exception : la lunaison du bilan). */
export const ICONS = {
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.2a8.2 8.2 0 1 0 4.3 12.6A6.6 6.6 0 0 1 15.5 4.2z"/></svg>`,
  cabinet: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16M7.5 8h1.5M15 8h1.5M7.5 16h1.5M15 16h1.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20"/></svg>`,
  lunation: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>`
};
/* ---- sigils : un glyphe gravé par espace (trait fin, grille de 24), choisi dans cette famille ----
   Botanique, instruments, bêtes discrètes : de quoi reconnaître un espace avant d'en lire le nom. */
const SIGILS = {
  phalene: [N_("Phalène"), `<path d="M12 6.5v12.5M12 8.5C8.5 4.5 3.5 5 4 9s4.5 5 8 3M12 8.5c3.5-4 8.5-3.5 8 .5s-4.5 5-8 3M12 12.5c-3 1-5.5 3.2-4.4 5.5S11 17.6 12 15M12 12.5c3 1 5.5 3.2 4.4 5.5S13 17.6 12 15M11.4 6.6 9.4 3.4M12.6 6.6l2-3.2"/>`],
  salticide: [N_("Araignée sauteuse"), `<circle cx="12" cy="9.6" r="3"/><circle cx="12" cy="16.2" r="3.4"/><path d="M9.4 8.6 5 5.6M9.2 10.6l-5.2-.2M9.3 14.4 4.6 16M10 18.3l-3.6 3M14.6 8.6 19 5.6M14.8 10.6l5.2-.2M14.7 14.4l4.7 1.6M14 18.3l3.6 3"/><circle cx="10.9" cy="8.9" r=".45"/><circle cx="13.1" cy="8.9" r=".45"/>`],
  plume: [N_("Plume"), `<path d="M19.5 4C11.5 5 7 11 6 19.5M19.5 4c-1 6.5-5.5 10.5-12 12.5M10.2 12.2l3.2 1M12.4 9.2l3.2.8M6 19.5l-1.8 1.5"/>`],
  diapason: [N_("Diapason"), `<path d="M9 3v8a3 3 0 0 0 6 0V3M12 14v7M10.2 21h3.6"/>`],
  equerre: [N_("Équerre"), `<path d="M4 3.5v17h17zM7.5 11.5v5.5H13z"/>`],
  trebuchet: [N_("Trébuchet"), `<path d="M12 4v16M8.5 20h7M5 7.5h14M5 7.5l-2.6 5h5.2zM19 7.5l-2.6 5h5.2zM11 4h2"/>`],
  vasculum: [N_("Boîte d'herborisation"), `<rect x="3.5" y="9" width="17" height="9" rx="4.5"/><path d="M6.2 9.4c0-4.2 11.6-4.2 11.6 0M9 9.2v8.6"/>`],
  spirale: [N_("Souffle"), `<path d="M12 12.4c0-1.2 1.6-1.6 2.1-.4.6 1.4-.8 2.8-2.3 2.8-1.9 0-3.1-1.6-3-3.3.1-2.4 2.3-4.2 4.8-4 3 .2 5 2.8 4.8 5.7-.3 3.6-3.4 6.1-7 5.8-4.2-.4-7.2-4-6.8-8.2"/>`],
  loupe: [N_("Loupe"), `<circle cx="10" cy="10" r="5.5"/><path d="M14.1 14.1 20 20"/>`],
  sceau: [N_("Sceau"), `<circle cx="12" cy="10.5" r="5"/><circle cx="12" cy="10.5" r="2.2"/><path d="M9.2 14.6 7.6 21l4.4-2 4.4 2-1.6-6.4"/>`],
  lanterne: [N_("Lanterne"), `<path d="M9 5.5h6M10 5.5V3.6h4v1.9M8 7.5h8l-1.2 10.5H9.2zM7.4 18h9.2M12 10.5v4"/>`],
  fougere: [N_("Fougère"), `<path d="M12 21C12 13.5 10.4 7.5 6.5 3.5M11.8 16.8 7.6 15.6M11.4 13.6 7.2 11.4M10.3 10.4 7.4 7.4M11.8 16.2l3.1-2.8M11.4 12.9l3-3.3M10.3 9.6l2-3"/>`],
  sablier: [N_("Sablier"), `<path d="M6.5 3h11M6.5 21h11M8 3c0 5.2 8 6 8 9s-8 3.8-8 9M16 3c0 5.2-8 6-8 9s8 3.8 8 9"/>`],
  compas: [N_("Compas"), `<circle cx="12" cy="4.6" r="1.6"/><path d="M11.2 6.1 6 20.5M12.8 6.1l5.2 14.4M8 15h8"/>`],
  clef: [N_("Clef"), `<circle cx="7.5" cy="12" r="3.6"/><path d="M11.1 12H21M17.2 12v3.2M20 12v2.6"/>`],
  feuille: [N_("Feuille"), `<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l8-8"/>`],
  champignon: [N_("Champignon"), `<path d="M4 12.2a8 7 0 0 1 16 0zM9.5 12.2v6.3a2.5 2 0 0 0 5 0v-6.3"/>`],
  croissant: [N_("Croissant"), `<path d="M15.2 4.2a8.2 8.2 0 1 0 4.6 12.7 6.6 6.6 0 0 1-4.6-12.7z"/>`]
};
/* Le sigil d'un espace : celui choisi, sinon un défaut selon son nom (les espaces d'origine), puis selon son type. */
function sigilOf(id) {
  const s = S(), m = s.config.modules.find(x => x.id === id), inst = Object.hasOwn(s.modules, id) ? s.modules[id] : null;
  if (m && Object.hasOwn(SIGILS, m.sigil || "")) return m.sigil;
  if (id === "assistant") return "lanterne";
  const name = fold(`${id} ${label(id) || ""}`);
  for (const [re, k] of [[/moth|phalene|papillon/, "phalene"], [/phidippus|araignee|spider/, "salticide"], [/musique|album|disque/, "diapason"], [/champignon|mycel/, "champignon"]]) if (re.test(name)) return k;
  if (!inst) return "feuille";
  if (inst.type === "collection") return inst.config.concordance ? "loupe" : inst.config.review ? "sceau" : "fougere";
  if (inst.type === "notes") return inst.config.inbox ? "vasculum" : "feuille";
  return { taches: "equerre", programme: "spirale", cumul: "plume", rappels: "sablier", budget: "trebuchet", arc: "compas" }[inst.type] || "feuille";
}
const sigilSVG = k => `<svg class="sig" viewBox="0 0 24 24" aria-hidden="true">${SIGILS[k][1]}</svg>`;
export const sigil = id => sigilSVG(sigilOf(id));
/* Teinte d'un domaine : l'ordre d'apparition des domaines nommés donne t1…t7 ; un espace sans domaine prend l'accent (t0). */
export function tintOf(id) {
  const m = S().config.modules.find(x => x.id === id), g = m && String(m.group || "").trim();
  if (!g) return "t0";
  const named = domains().map(d => d.name).filter(Boolean);
  return `t${(named.indexOf(g) % 7) + 1}`;
}
const ROMAN = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const roman = n => { let out = ""; for (const [v, r] of [[50, "L"], [40, "XL"], ...ROMAN]) while (n >= v) { out += r; n -= v; } return out; };
/* La planche d'un espace : son sigil et son numéro (l'ordre de la navigation), en tête de sa page. */
export function plateHTML(id, extra = "") {
  const n = S().config.modules.filter(m => m.on && Object.hasOwn(S().modules, m.id)).findIndex(m => m.id === id) + 1;
  return `<div class="plate ${tintOf(id)}">${sigil(id)}<span class="pl">${tr`Pl. ${roman(n)}`}</span><span class="spacer"></span>${extra}<button class="btn ghost sm" data-act="goto-groups" data-mod="${esc(id)}">${tr`régler`}</button></div>`;
}
export function sigilPicker(mod) {
  const cur = sigilOf(mod);
  return `<div class="sigils" role="radiogroup" aria-label="${tr`Sigil de l'espace`}">${Object.entries(SIGILS).map(([k, [name]]) => `<button type="button" role="radio" aria-checked="${k === cur}" class="${k === cur ? "on" : ""}" data-act="sigil-set" data-mod="${esc(mod)}" data-s="${k}" title="${esc(tr(name))}" aria-label="${esc(tr(name))}">${sigilSVG(k)}</button>`).join("")}</div>`;
}
CLICK["sigil-set"] = el => { const m = S().config.modules.find(x => x.id === el.dataset.mod); if (!m) return; m.sigil = el.dataset.s; site.save(); render(); };
