/* Le rendu : thème, mémo par rendu, render() et renderNow(), défilement retenu, changement de route. */
import { platform } from "../../platform.js";
import { approxPlace, sunPosition } from "../../core/sky.js";
import { SHEETS, TYPE_UI, VIEWS } from "../registry.js";
import { $, esc, pageSize, toast } from "../lib/dom.js";
import { applyLang, tr, trp, uiLocale } from "../i18n/index.js";
import { todayISO } from "../lib/format.js";
import { bridgeBar, bridgeOpen, setBridgeOpen } from "../features/bridge.js";
import { dehorsOn } from "../features/dehors.js";
import { notifySoon } from "../features/digest.js";
import { widgetSoon } from "../features/widget.js";
import { applyShare, sharePending } from "../features/share.js";
import { timerLabel } from "../features/timer.js";
import { setOpenId } from "../modules/taches.js";
import { moon, moonSVG } from "../scene/moon.js";
import { skyConf, skyWatch } from "../scene/sky.js";
import { authGate, authPaint } from "../services/auth.js";
import { backTo, barHTML, focusEntry, navHTML, noteVisit, routeOf, trackBack } from "./nav.js";
import { closeOverlays, sheetArg, sheetKind } from "./sheets.js";
import { plateHTML, tintOf } from "./sigils.js";
import { loadDraft, saveDraft } from "../state/drafts.js";
import { S, absentModule, enabled, label } from "../state/site.js";

function applyTheme() {
  const c = S().config, r = document.documentElement;
  r.dataset.palette = c.palette;
  // « Suivre le soleil » : sombre du crépuscule (le soleil à 3° sous l'horizon) à l'aube, au lieu réglé ou estimé.
  // Deux bascules par jour, comme le mode automatique d'iOS : jamais un fondu continu de l'interface.
  if (c.mode === "sun") { const pl = skyConf() || approxPlace(); r.dataset.mode = sunPosition(Date.now(), +pl.lat, +pl.lon).alt < -3 ? "dark" : "light"; }
  else if (c.mode === "auto") delete r.dataset.mode; else r.dataset.mode = c.mode;
}
/* Le squelette (src/shell.html) est écrit en français, pour le premier affichage, avant tout script ; ses textes
   suivent la langue quand elle change. Les autres se redessinent à chaque rendu. */
function localizeShell() {
  const set = (sel, v, attr) => { const el = $(sel); if (el) { if (attr) el.setAttribute(attr, v); else el.textContent = v; } };
  set(".brand", tr`Aujourd'hui (appui long : minuteur de 15 min)`, "title");
  set("#timerBtn", timerLabel());
  set("#timerReset", tr`Réinitialiser le minuteur`, "aria-label");
  set("#nav", tr`Navigation principale`, "aria-label");
  set("#bar", tr`Navigation rapide`, "aria-label");
  set("#palette", tr`Aller, agir, chercher`, "aria-label");
  set("#palIn", tr`Aller, agir, chercher…`, "placeholder");
  set("#palList", tr`Suggestions`, "aria-label");
  set('#cdlg button[value="ok"]', tr`Confirmer`);
  set('#cdlg button[value="cancel"]', trp("formulaire", "Annuler"));
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
let redirectedFrom = null; // l'espace fermé dont l'adresse vient d'être détournée vers l'accueil (dit une fois)
let renderDay = null;
// Le jour du dernier rendu : boot.js redessine quand il change (minuit, TRV-004).
export const renderedDay = () => renderDay;
/* Le focus clavier sur un bouton, un lien ou une case survit à un rendu (A37). Une synchro, un autre onglet ou la fin d'un
   envoi redessinent la page ; le focus retombait alors au début du document, et Entrée ne faisait plus rien (WCAG 2.4.3).
   L'élément se retrouve par ce qui le désigne (balise, href, aria-label, data-*), l'entrée qui le porte (sa tâche, son
   fragment…) et son rang parmi ses pareils : jamais la case d'une autre tâche. Une entrée disparue ne rend le focus à
   rien, comme avant. Les champs à identifiant ont leur propre restauration, valeur et curseur compris (ci-dessous). */
const FOCUSABLE = "button, a[href], input, select, textarea, summary, [tabindex]";
const KEYED = "[data-id], [data-task], [data-item], [data-oa], [data-i], [data-rg], [data-vi], [data-ci]";
const dataSig = el => Object.keys(el.dataset).sort().map(k => `${k}=${el.dataset[k]}`).join(",");
const focusSig = el => { const o = el.parentElement && el.parentElement.closest(KEYED); return [el.tagName, el.getAttribute("href") || "", el.getAttribute("aria-label") || "", dataSig(el), o ? dataSig(o) : ""].join("|"); };
const alike = (zone, el, sig) => [...zone.querySelectorAll(FOCUSABLE)].filter(x => x.tagName === el.tagName && x.dataset.act === el.dataset.act && focusSig(x) === sig);
/* Un rendu né d'un geste (clic, touche, saisie) laisse le focus à ce que le geste en fait : le rendre ici réactiverait un
   bouton sous la même touche Entrée (la feuille « Capturer », fermée par Entrée, se rouvrait par son bouton). Seuls les
   rendus de fond, hors de tout geste en cours (synchro, autre onglet, fin d'un envoi, minuterie), le rendent. */
const inGesture = () => { const e = window.event; return !!e && /^(key|mouse|pointer|touch|click|dblclick|auxclick|contextmenu|input|change|submit|reset|focus|blur|select)/.test(e.type); };
function focusMark() {
  if (inGesture()) return null;
  const el = document.activeElement, zone = el && el !== document.body && el.closest ? el.closest("#main, #nav, #bar") : null;
  if (!zone || el.id) return null;
  const sig = focusSig(el);
  return { zone: zone.id, tag: el.tagName, act: el.dataset.act, sig, n: alike(zone, el, sig).indexOf(el) };
}
function focusBack(m) {
  if (!m || m.n < 0 || (document.activeElement && document.activeElement !== document.body)) return;
  const zone = document.getElementById(m.zone), el = zone && alike(zone, { tagName: m.tag, dataset: { act: m.act } }, m.sig)[m.n];
  if (el) try { el.focus({ preventScroll: true }); } catch {}
}
/* Un rendu de fond tombé entre l'appui et le relâchement remplaçait l'élément pressé : le relâchement atterrissait sur son
   remplaçant, et le navigateur ne donne « click » qu'à l'élément qui a reçu les deux. Le clic se perdait sans un mot (A40 :
   « confirmer » une journée, sous Firefox, à la fin d'un envoi au serveur ; A9 sous WebKit). Pendant un appui, un rendu de
   fond attend donc le relâchement, et part juste après le clic qui le suit ; deux secondes au plus (un appui long, un
   relâchement jamais reçu). */
let pressAt = 0, held = false;
const pressing = () => pressAt && Date.now() - pressAt < 2000;
const release = () => { pressAt = 0; if (held) { held = false; setTimeout(render); } };
document.addEventListener("pointerdown", e => { if (e.isPrimary) pressAt = Date.now(); }, true);
for (const t of ["pointerup", "pointercancel", "dragstart"]) document.addEventListener(t, release, true);
if (typeof window !== "undefined") window.addEventListener("blur", release); // la fenêtre quittée en plein appui
export function render() {
  if (pressing() && !inGesture()) {
    if (!held) { held = true; setTimeout(() => { if (held) { held = false; render(); } }, 2000 - (Date.now() - pressAt)); }
    return;
  }
  renderMemo = new Map(); renderDay = todayISO();
  try { renderNow(); } finally { renderMemo = null; }
  skyWatch();
  notifySoon();
  widgetSoon();
  if (sharePending) applyShare();
}
function renderNow() {
  applyTheme();
  if (applyLang(S().config.lang)) localizeShell(); // avant tout texte, écran de connexion compris (la langue de l'appareil, tant qu'aucun compte n'est lu)
  const s = S(), m = moon();
  $("#brandName").textContent = s.config.name || "Selene";
  document.title = s.config.name || "Selene";
  $("#miniMoon").innerHTML = moonSVG(m.p, 40);
  $("#dateline").textContent = new Date().toLocaleDateString(uiLocale(), { weekday: "long", day: "numeric", month: "long" }) + ", " + m.name.toLowerCase();
  // L'écran de connexion : la lune du jour, mais ni navigation, ni minuteur (rien à minuter avant d'être entrée).
  const gate = authGate();
  if (gate) document.documentElement.dataset.auth = ""; else delete document.documentElement.dataset.auth;
  if (gate) { $("#nav").innerHTML = ""; $("#bar").innerHTML = ""; authPaint($("#main")); return; }
  let view = routeOf().view;
  // Les vues fixes priment toujours ; hasOwn évite qu'un « #constructor » trouve Object.prototype.
  const fixed = v => v === "accueil" || v === "reglages" || v === "recherche" || v === "bilan" || (v === "dehors" && dehorsOn());
  const asked = view;
  if (!fixed(view) && (!(Object.hasOwn(s.modules, view) || Object.hasOwn(VIEWS, view)) || !enabled(view))) view = "accueil";
  /* L'adresse d'un espace qui existe mais ne s'ouvre pas (désactivé, ou absent de cette édition) mène à l'accueil, et le
     dit une fois par visite de cette adresse (ESP-006) ; une adresse inconnue y mène sans un mot. */
  if (view !== asked && Object.hasOwn(s.modules, asked)) {
    if (redirectedFrom !== asked) { redirectedFrom = asked; toast(absentModule(asked) ? tr`Cet espace ne s'ouvre pas dans cette version de Selene.` : tr`« ${label(asked)} » est désactivé : Réglages → Espaces pour le rouvrir.`); }
  } else redirectedFrom = null;
  const inst = !fixed(view) && Object.hasOwn(s.modules, view) ? s.modules[view] : null;
  const mark = view === lastView ? focusMark() : null; // avant que la navigation ne soit redessinée
  $("#nav").innerHTML = navHTML(view);
  $("#bar").innerHTML = barHTML(view);
  if (inst && view !== lastView) noteVisit(view);
  // Un champ sans id n'est pas restauré (ci-dessous) : tant qu'il a le focus, ne pas redessiner la vue, sinon une synchro
  // arrivant pendant la frappe effacerait la saisie. Pire : le champ retiré perd le focus, son « change » part pendant le
  // rendu et en relance un autre, imbriqué (A33 : la clé OpenAlex de Dehors). Les Réglages, sans id, en entier.
  const ae = document.activeElement, typing = ae && ae.closest && ae.closest("#main") &&
    (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !["checkbox", "radio", "file", "button"].includes(ae.type)));
  if (typing && view === lastView && (view === "reglages" || !ae.id)) return;
  const keep = {}; let focusId = null, caret = null;
  $("#main").querySelectorAll("[data-draft]").forEach(el => saveDraft(lastView, el)); // un champ vidé par l'envoi efface son brouillon
  if (view === lastView) $("#main").querySelectorAll("input[id],textarea[id],select[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
  // Un bloc déplié (details à identifiant : les réglages d'un espace) le reste après un changement fait dedans.
  const opened = view === lastView ? [...$("#main").querySelectorAll("details[id][open]")].map(d => d.id) : [];
  // Toute la sélection, pas le seul curseur : un texte sélectionné pour être remplacé le reste après un rendu de fond, au
  // lieu de se replier au début, où la frappe s'insérait devant l'ancien texte (A53).
  if (document.activeElement && document.activeElement.id && keep[document.activeElement.id] != null) { const a = document.activeElement; focusId = a.id; try { caret = a.selectionStart == null ? null : [a.selectionStart, a.selectionEnd, a.selectionDirection]; } catch {} }
  const back = backTo && backTo.to === view ? `<a class="back" href="#${esc(backTo.from)}">‹ ${esc(backTo.label)}</a>` : "";
  // Un espace : sa planche (sigil, numéro, « Je m'arrête ici… » tant qu'aucun pont n'est posé, « régler »), son pont, sa vue ;
  // le tout dans la teinte de son domaine.
  // Pas de pont dans un espace sensible (ADR 27) : son texte partirait dans le document synchronisé, même pour un suivi
  // gardé sur l'appareil seulement.
  const bridgeable = inst && !TYPE_UI[inst.type].sensitive, bridging = bridgeable && (inst.resume || bridgeOpen === view);
  $("#main").innerHTML = back + (inst ? `<div class="view ${tintOf(view)}">${plateHTML(view, bridging || !bridgeable ? "" : `<button class="btn ghost sm" data-act="bridge-edit" data-mod="${esc(view)}">${tr`Je m'arrête ici…`}</button>`)}${bridging ? bridgeBar(view, inst) : ""}${TYPE_UI[inst.type].view(view)}</div>` : VIEWS[view]());
  // La feuille « régler » ouverte se redessine aussi, sauf pendant une frappe dans l'un de ses champs.
  const fa = document.activeElement, typingSheet = fa && fa.closest && fa.closest("#sheet") && (fa.tagName === "TEXTAREA" || (fa.tagName === "INPUT" && !["checkbox", "radio"].includes(fa.type)));
  if (["module", "specimen", "vasculum"].includes(sheetKind) && $("#sheet").open && !typingSheet) $("#sheetBody").innerHTML = SHEETS[sheetKind](sheetArg);
  // Le titre de la page dit l'écran (onglet, historique, lecteur d'écran : WCAG 2.4.2) : « Écriture — Selene ».
  const h2 = $("#main h2"), here = h2 && String(h2.textContent || "").replace(/\s+/g, " ").trim();
  document.title = here ? `${here} — ${s.config.name || "Selene"}` : s.config.name || "Selene";
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && v !== "" && el.value !== v) el.value = v; }
  for (const id of opened) { const el = document.getElementById(id); if (el && el.tagName === "DETAILS") el.open = true; }
  if (view !== lastView) $("#main").querySelectorAll("[data-draft]").forEach(el => { const v = loadDraft(view, el); if (v) el.value = v; });
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret) el.setSelectionRange(caret[0], caret[1], caret[2] || "none"); } catch {} } }
  else focusBack(mark);
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
  // Le lien suivi (menu, barre du bas) vient d'être redessiné : le focus retombait sur la page entière, et un lecteur
  // d'écran n'annonçait rien. Il va au titre du nouvel écran, sans défiler ; jamais pris à un champ qui l'a déjà.
  const fa = document.activeElement;
  if (!fa || fa === document.body) { const h = $("#main h2"); if (h) { if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }
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
