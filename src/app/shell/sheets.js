/* Les feuilles (panneaux du bas ou du côté) : ouverture, fermeture, la feuille des espaces. */
import { inboxId } from "../../core/domain.js";
import { CLICK, SHEETS } from "../registry.js";
import { $, esc } from "../lib/dom.js";
import { tr, trn } from "../i18n/index.js";
import { domains, liveRecents, navMarks } from "./nav.js";
import { lastView } from "./render.js";
import { sigil, tintOf } from "./sigils.js";
import { loadDraft } from "../state/drafts.js";
import { S, enabled, label } from "../state/site.js";
import { summaryFor } from "../views/accueil.js";
import { moduleSettingsHTML } from "../views/reglages.js";
import { tick } from "../features/timer.js";

/* ---- feuilles (sheets) : Espaces et Capturer, depuis la barre basse ---- */
Object.assign(SHEETS, {
  espaces() {
    const rec = liveRecents().filter(r => r.id !== lastView).slice(0, 3);
    const row = id => `<a class="srow ${tintOf(id)}" href="#${esc(id)}">${sigil(id)}<b>${esc(label(id))}</b><span class="sub">${summaryFor(id)}</span>${navMarks(id)}</a>`;
    return `<h2 id="sheetTitle">${tr`Espaces`}</h2>
      ${rec.length ? `<p class="grp">${tr`Récents`}</p><div class="recents">${rec.map(r => `<a class="btn" href="#${esc(r.id)}">${esc(label(r.id))}</a>`).join("")}</div>` : ""}
      ${domains().map(d => `<p class="grp">${esc(d.name || tr`Espaces`)}</p>${d.ids.map(row).join("")}`).join("")}
      <p class="grp">${tr`Système`}</p>${enabled("assistant") ? `<a class="srow" href="#assistant"><b>${esc(label("assistant"))}</b></a>` : ""}<a class="srow" href="#reglages"><b>${tr`Réglages`}</b></a>`;
  },
  module(mod) {
    if (!Object.hasOwn(S().modules, mod)) return `<p class="empty">${tr`Ce module n'existe plus.`}</p>`;
    return `<div data-mod="${esc(mod)}" class="${tintOf(mod)}"><h2 id="sheetTitle" class="sheet-title">${sigil(mod)}${esc(label(mod))}</h2>
      <p class="hint">${tr`Réglages de cet espace, appliqués tout de suite. Nom, domaine et ordre : ${`<a href="#reglages">${tr`Réglages`}</a>`}.`}</p>${moduleSettingsHTML(mod)}</div>`;
  },
  capture() {
    const s = S(), inbox = inboxId(s.modules), n = inbox ? s.modules[inbox].entries.length : 0;
    return `<h2 id="sheetTitle">${tr`Capturer`}</h2>${inbox ? `<div class="capture"><input id="capSheetIn" data-draft placeholder="${esc(s.modules[inbox].config.placeholder)}" aria-label="${tr`Capture rapide`}" enterkeyhint="done"><button class="btn acc" data-act="cap-sheet-add">${tr`Garder`}</button></div>
      <p class="hint" style="margin:10px 0 0">${tr`« 12 € courses », « Mon module : une note » se rangent d'un geste.`}${n ? ` <a href="#${esc(inbox)}">${trn(n, "{0} élément à trier", "{0} éléments à trier")}</a>` : ""}</p>${n > 1 ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="vasculum">${tr`Trier une à une`}</button></div>` : ""}`
      : `<p class="hint">${tr`Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans ${`<a href="#reglages">${tr`Réglages`}</a>`}.`}</p>`}
      <div class="row sheet-timer"><button class="btn sm" data-act="sheet-timer">${tick ? tr`Mettre le minuteur en pause` : tr`Lancer le minuteur (15 min)`}</button></div>`;
  }
});
export let sheetKind = null, sheetArg = null;
 // la feuille ouverte, pour la redessiner après un réglage
export function openSheet(kind, arg) {
  const d = $("#sheet"); closePalette();
  sheetKind = kind; sheetArg = arg;
  $("#sheetBody").innerHTML = SHEETS[kind](arg);
  d.classList.toggle("drawer", kind === "module" || kind === "specimen" || kind === "mb" || kind === "mb-new" || kind === "radar"); // réglages d'un module, fiche : un tiroir à droite sur ordinateur
  d.classList.toggle("wide", kind === "carte"); // la carte céleste veut de la largeur
  if (!d.open) d.showModal();
  const i = $("#capSheetIn"); if (kind === "capture" && i) { i.value = loadDraft("sheet", i); i.focus(); }
}
export function closeSheet() { const d = $("#sheet"); if (d.open) d.close(); }
function closePalette() { const d = $("#palette"); if (d.open) d.close(); }
export function closeOverlays() { closeSheet(); closePalette(); }
/* Un clic sur le voile (hors du cadre) ferme ; un lien suivi depuis une feuille ou la palette la ferme aussi. */
for (const d of ["#sheet", "#palette"]) $(d).addEventListener("click", e => {
  const r = e.currentTarget.getBoundingClientRect();
  if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) e.currentTarget.close();
  else if (e.target.closest && e.target.closest('a[href^="#"]')) e.currentTarget.close();
});
CLICK["sheet-espaces"] = () => openSheet("espaces");
CLICK["sheet-capture"] = () => openSheet("capture");
// Le minuteur, depuis Capturer : sur téléphone, l'en-tête ne le montre qu'entamé (U4).
CLICK["sheet-timer"] = () => { closeSheet(); $("#timerBtn").click(); };
