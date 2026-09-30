/* Le rendu : thème, mémo par rendu, render() et renderNow(), défilement retenu, changement de route. */
import { hosted, platform } from "../../platform.js";
import { approxPlace, sunPosition } from "../../core/sky.js";
import { SHEETS, TYPE_UI, VIEWS } from "../registry.js";
import { $, esc, pageSize } from "../lib/dom.js";
import { applyLang, uiLocale } from "../i18n/index.js";
import { bridgeBar, bridgeOpen, setBridgeOpen } from "../features/bridge.js";
import { dehorsOn } from "../features/dehors.js";
import { notifySoon } from "../features/digest.js";
import { applyShare, sharePending } from "../features/share.js";
import { setOpenId } from "../modules/taches.js";
import { moon, moonSVG } from "../scene/moon.js";
import { skyConf, skyWatch } from "../scene/sky.js";
import { authReady, authSession, authView } from "../services/auth.js";
import { backTo, barHTML, focusEntry, navHTML, noteVisit, routeOf, trackBack } from "./nav.js";
import { closeOverlays, sheetArg, sheetKind } from "./sheets.js";
import { plateHTML, tintOf } from "./sigils.js";
import { loadDraft, saveDraft } from "../state/drafts.js";
import { S, enabled } from "../state/site.js";

function applyTheme() {
  const c = S().config, r = document.documentElement;
  r.dataset.palette = c.palette;
  // « Suivre le soleil » : sombre du crépuscule (le soleil à 3° sous l'horizon) à l'aube, au lieu réglé ou estimé.
  // Deux bascules par jour, comme le mode automatique d'iOS : jamais un fondu continu de l'interface.
  if (c.mode === "sun") { const pl = skyConf() || approxPlace(); r.dataset.mode = sunPosition(Date.now(), +pl.lat, +pl.lon).alt < -3 ? "dark" : "light"; }
  else if (c.mode === "auto") delete r.dataset.mode; else r.dataset.mode = c.mode;
}
export let lastView = null;
/* Calculs coûteux partagés par plusieurs parties d'un même rendu (la concordance sert la vue, l'accueil et
   le bilan) : gardés le temps d'un rendu seulement, pendant lequel les données ne bougent pas. */
let renderMemo = null;
export function memoInRender(key, compute) {
  if (!renderMemo) return compute();
  if (!renderMemo.has(key)) renderMemo.set(key, compute());
  return renderMemo.get(key);
}
export function render() {
  renderMemo = new Map();
  try { renderNow(); } finally { renderMemo = null; }
  skyWatch();
  notifySoon();
  if (sharePending) applyShare();
}
function renderNow() {
  applyTheme();
  applyLang(S().config.lang); // avant tout texte, écran de connexion compris (la langue de l'appareil, tant qu'aucun compte n'est lu)
  if (hosted() && authReady() && !authSession) { $("#nav").innerHTML = ""; $("#bar").innerHTML = ""; $("#main").innerHTML = authView(); return; }
  const s = S(), m = moon();
  let view = routeOf().view;
  // Les vues fixes priment toujours ; hasOwn évite qu'un « #constructor » trouve Object.prototype.
  const fixed = v => v === "accueil" || v === "reglages" || v === "recherche" || v === "bilan" || (v === "dehors" && dehorsOn());
  if (!fixed(view) && (!(Object.hasOwn(s.modules, view) || Object.hasOwn(VIEWS, view)) || !enabled(view))) view = "accueil";
  const inst = !fixed(view) && Object.hasOwn(s.modules, view) ? s.modules[view] : null;
  $("#brandName").textContent = s.config.name || "Selene";
  document.title = s.config.name || "Selene";
  $("#miniMoon").innerHTML = moonSVG(m.p, 40);
  $("#dateline").textContent = new Date().toLocaleDateString(uiLocale(), { weekday: "long", day: "numeric", month: "long" }) + ", " + m.name.toLowerCase();
  $("#nav").innerHTML = navHTML(view);
  $("#bar").innerHTML = barHTML(view);
  if (inst && view !== lastView) noteVisit(view);
  // Les champs des Réglages n'ont pas d'id (donc pas de restauration ci-dessous) : tant que l'un d'eux
  // a le focus, ne pas redessiner, sinon une synchro arrivant pendant la frappe effacerait la saisie.
  const ae = document.activeElement, typing = ae && ae.closest && ae.closest("#main") &&
    (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !["checkbox", "radio", "file", "button"].includes(ae.type)));
  if (typing && view === "reglages" && lastView === "reglages") return;
  const keep = {}; let focusId = null, caret = null;
  $("#main").querySelectorAll("[data-draft]").forEach(el => saveDraft(lastView, el)); // un champ vidé par l'envoi efface son brouillon
  if (view === lastView) $("#main").querySelectorAll("input[id],textarea[id],select[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
  if (document.activeElement && document.activeElement.id && keep[document.activeElement.id] != null) { focusId = document.activeElement.id; try { caret = document.activeElement.selectionStart; } catch {} }
  const back = backTo && backTo.to === view ? `<a class="back" href="#${esc(backTo.from)}">‹ ${esc(backTo.label)}</a>` : "";
  // Un espace : sa planche (sigil, numéro, « Je m'arrête ici… » tant qu'aucun pont n'est posé, « régler »), son pont, sa vue ;
  // le tout dans la teinte de son domaine.
  const bridging = inst && (inst.resume || bridgeOpen === view);
  $("#main").innerHTML = back + (inst ? `<div class="view ${tintOf(view)}">${plateHTML(view, bridging ? "" : `<button class="btn ghost sm" data-act="bridge-edit" data-mod="${esc(view)}">Je m'arrête ici…</button>`)}${bridging ? bridgeBar(view, inst) : ""}${TYPE_UI[inst.type].view(view)}</div>` : VIEWS[view]());
  // La feuille « régler » ouverte se redessine aussi, sauf pendant une frappe dans l'un de ses champs.
  const fa = document.activeElement, typingSheet = fa && fa.closest && fa.closest("#sheet") && (fa.tagName === "TEXTAREA" || (fa.tagName === "INPUT" && !["checkbox", "radio"].includes(fa.type)));
  if (["module", "specimen", "vasculum"].includes(sheetKind) && $("#sheet").open && !typingSheet) $("#sheetBody").innerHTML = SHEETS[sheetKind](sheetArg);
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && v !== "" && el.value !== v) el.value = v; }
  if (view !== lastView) $("#main").querySelectorAll("[data-draft]").forEach(el => { const v = loadDraft(view, el); if (v) el.value = v; });
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch {} } }
  if (view !== lastView) revealed = null;
  if (revealed) $("#main").querySelectorAll(".item[data-id], .card[data-id]").forEach(el => { if (el.dataset.id === revealed) el.classList.add("reveal"); });
  lastView = view;
}
/* Position de défilement de chaque vue, pour la session : revenir quelque part, c'est retrouver où l'on en était. */
const scrollMemo = (() => { try { return JSON.parse(platform.session.get("selene-scrolls")) || {}; } catch { return {}; } })();
export function rememberScroll() {
  if (!lastView) return;
  scrollMemo[lastView] = Math.round(window.scrollY || 0);
  try { platform.session.set("selene-scrolls", JSON.stringify(scrollMemo)); } catch {}
}
window.addEventListener("hashchange", () => {
  const { view, entry } = routeOf();
  if (lastView !== view) rememberScroll(); // « / » a déjà dessiné la recherche, et gardé la position d'avant
  trackBack(view, entry, lastView);
  closeOverlays();
  setOpenId(null); setBridgeOpen(null); for (const k of Object.keys(pageSize)) delete pageSize[k];
  if (entry && Object.hasOwn(S().modules, view) && S().modules[view].type === "taches") setOpenId(entry); // une tâche visée s'ouvre
  render();
  const t = platform.session.get("selene-scroll"); platform.session.remove("selene-scroll"); const el = t && document.getElementById(t);
  if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView(); }
  else if (!(entry && focusEntry(entry))) window.scrollTo(0, scrollMemo[lastView] || 0);
});
/* Sur un écran tactile, les actions d'une ligne (.ra) apparaissent quand on touche la ligne ailleurs que sur un contrôle.
   Une seule ligne à la fois ; retenue par son identifiant pour survivre aux rendus. Écouté sur #main, pas sur
   document : WebKit (Safari iOS) n'envoie le « click » d'un toucher sur une simple ligne que si elle, ou un ancêtre
   sous <body>, a un écouteur de clic. */
let revealed = null;
const touchUI = () => { try { return window.matchMedia("(hover: none), (pointer: coarse)").matches; } catch { return false; } };
$("#main").addEventListener("click", e => {
  const row = e.target.closest && e.target.closest(".item[data-id], .card[data-id]");
  if (!row || !row.querySelector(".ra") || e.target.closest("a,button,input,select,textarea,label,summary") || !touchUI()) return;
  revealed = revealed === row.dataset.id ? null : row.dataset.id;
  $("#main").querySelectorAll(".reveal").forEach(el => el.classList.remove("reveal"));
  if (revealed) row.classList.add("reveal");
});
