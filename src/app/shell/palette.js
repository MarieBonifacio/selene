/* La palette de commandes (Ctrl+K) : chercher un espace, une action, y aller au clavier. */
import { platform } from "../../platform.js";
import { inboxId } from "../../core/domain.js";
import { CLICK } from "../registry.js";
import { $, esc } from "../lib/dom.js";
import { fmt } from "../lib/format.js";
import { tr } from "../i18n/index.js";
import { dehorsOn } from "../features/dehors.js";
import { tick } from "../features/timer.js";
import { addNote, afterCapture } from "../modules/notes.js";
import { liveRecents } from "./nav.js";
import { render } from "./render.js";
import { closeOverlays, closeSheet, openSheet } from "./sheets.js";
import { S, enabled, label, site } from "../state/site.js";
import { bilanMode, setBilanOffset } from "../views/bilan.js";
import { fold, searchAll, setSearchQuery } from "../views/recherche.js";

/* ---- palette de commandes (⌘K) : aller à un espace ou une vue, agir, garder une phrase, chercher ---- */
let palIdx = 0, palItems = [];
const goTo = hash => () => { closeOverlays(); if (location.hash === "#" + hash) render(); else location.hash = hash; };
function paletteItems(q) {
  const s = S(), f = fold(q.trim()), out = [], match = t => !f || fold(t).includes(f);
  const spaces = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id)).map(m => [m.id, label(m.id)]);
  if (!f) for (const r of liveRecents().slice(0, 3)) out.push({ k: tr`Récent`, t: label(r.id), run: goTo(r.id) });
  for (const [id, t] of spaces) if (match(t) && !out.some(o => o.t === t)) out.push({ k: tr`Espace`, t, run: goTo(id) });
  for (const [id, t] of [["accueil", tr`Aujourd'hui`], ["bilan", tr`Bilan`], ["recherche", tr`Chercher`], ...(dehorsOn() ? [["dehors", tr`Nouveautés · Dehors`]] : []), ["reglages", tr`Réglages`], ...(enabled("assistant") ? [["assistant", label("assistant")]] : [])])
    if (match(t)) out.push({ k: tr`Vue`, t, run: goTo(id) });
  const other = bilanMode() === "mois" ? "lune" : "mois";
  for (const [t, run] of [[tick ? tr`Mettre le minuteur en pause` : tr`Lancer le minuteur (15 min)`, () => { closeOverlays(); $("#timerBtn").click(); }],
    [tr`Capturer…`, () => openSheet("capture")],
    [tr`Trier la boîte, une note à la fois`, () => CLICK["vasculum"]()],
    [other === "lune" ? tr`Bilan par cycle lunaire` : tr`Bilan par mois`, () => { platform.storage.set("selene-bilan", other); setBilanOffset(0); goTo("bilan")(); }]])
    if (match(t)) out.push({ k: tr`Action`, t, run });
  if (f) {
    const inbox = inboxId(s.modules), text = q.trim();
    if (inbox) out.push({ k: tr`Garder`, t: tr`« ${text} » dans ${label(inbox)}`, run: () => { const item = addNote(S().modules[inbox], text); site.save(); closeOverlays(); render(); afterCapture(inbox, item, tr`Gardé. Tu peux oublier, c'est écrit.`); } });
    for (const h of searchAll(text).slice(0, 6)) out.push({ k: label(h.id), t: h.text.replace(/\s+/g, " ").slice(0, 110), sub: h.date ? fmt(h.date) : "", run: goTo(h.id + (h.eid ? "/" + h.eid : "")) });
    out.push({ k: tr`Chercher`, t: tr`« ${text} » partout`, run: () => { setSearchQuery(text); goTo("recherche")(); } });
  }
  return out;
}
function renderPalette() {
  palItems = paletteItems($("#palIn").value); palIdx = Math.max(0, Math.min(palIdx, palItems.length - 1));
  $("#palList").innerHTML = palItems.map((it, i) => `<li id="pal-${i}" role="option" aria-selected="${i === palIdx}" data-i="${i}"><span class="k">${esc(it.k)}</span><span class="t">${esc(it.t)}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ""}</li>`).join("")
    || `<li class="empty" aria-disabled="true">${tr`Rien. Ni espace, ni action, ni trace écrite.`}</li>`;
  if (palItems.length) $("#palIn").setAttribute("aria-activedescendant", `pal-${palIdx}`); else $("#palIn").removeAttribute("aria-activedescendant");
  const a = document.getElementById(`pal-${palIdx}`); if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
}
export function openPalette() {
  const d = $("#palette"); if (d.open) return d.close();
  closeSheet(); $("#palIn").value = ""; palIdx = 0; renderPalette(); d.showModal(); $("#palIn").focus();
}
$("#palIn").addEventListener("input", () => { palIdx = 0; renderPalette(); });
$("#palIn").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); palIdx = (palIdx + (e.key === "ArrowDown" ? 1 : -1) + palItems.length) % Math.max(1, palItems.length); renderPalette(); }
  else if (e.key === "Enter" && palItems[palIdx]) { e.preventDefault(); palItems[palIdx].run(); }
});
$("#palList").addEventListener("click", e => { const li = e.target.closest && e.target.closest("li[data-i]"); if (li && palItems[+li.dataset.i]) palItems[+li.dataset.i].run(); });
CLICK["palette-open"] = () => openPalette();
