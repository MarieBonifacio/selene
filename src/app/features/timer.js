/* Le minuteur de quinze minutes, et le halo de la marque. */
import { TYPE_UI } from "../registry.js";
import { $, toast } from "../lib/dom.js";
import { setBridgeOpen } from "./bridge.js";
import { routeOf } from "../shell/nav.js";
import { render } from "../shell/render.js";
import { S } from "../state/site.js";

/* Au bout des quinze minutes, le module ouvert peut proposer une suite (noter la séance, le nouveau total). */
export function timerDone() {
  const view = routeOf().view, inst = Object.hasOwn(S().modules, view) ? S().modules[view] : null, hook = inst && TYPE_UI[inst.type].timerDone;
  if (inst) { setBridgeOpen(view); render(); } // et le prochain geste, pendant qu'on s'en souvient
  if (!(hook && hook(view, inst, 15))) toast("Quinze minutes. Tu as le droit d'arrêter. Et celui de continuer.");
}
export let left = 900, tick = null, endAt = 0;
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
/* Le Halo : l'anneau de la mini-lune se referme à mesure que le temps passe (visible tant qu'un minuteur est entamé) ;
   à la fin, un seul battement. La lune, elle, reste la vraie phase. */
function haloUpdate(done = false) {
  const h = $("#halo"); if (!h || !h.style || !h.classList) return;
  h.style.setProperty("--p", done ? "1" : String(1 - left / 900));
  h.classList.toggle("on", !done && left > 0 && left < 900);
  h.classList.toggle("done", done);
}
function tickTimer() {
  left = Math.max(0, Math.round((endAt - Date.now()) / 1000)); $("#clock").textContent = mmss(left); haloUpdate();
  if (left <= 0) { clearInterval(tick); tick = null; $("#clock").classList.add("done"); $("#timerBtn").textContent = "Relancer"; haloUpdate(true); timerDone(); try { navigator.vibrate && navigator.vibrate(200); } catch {} }
}
$("#timerBtn").addEventListener("click", () => {
  const b = $("#timerBtn");
  if (tick) { clearInterval(tick); tick = null; b.textContent = "Reprendre"; return; }
  if (left === 0) left = 900; endAt = Date.now() + left * 1000; $("#clock").classList.remove("done"); b.textContent = "Pause";
  tick = setInterval(tickTimer, 500); haloUpdate();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && tick) tickTimer(); });
$("#timerReset").addEventListener("click", () => { clearInterval(tick); tick = null; left = 900; $("#clock").textContent = mmss(left); $("#clock").classList.remove("done"); $("#timerBtn").textContent = "Lancer 15 min"; haloUpdate(); });
/* Un appui long sur la mini-lune lance (ou met en pause) le minuteur ; un clic simple reste un retour à l'accueil.
   Le bouton du minuteur demeure : un geste caché ne doit jamais être le seul chemin. */
let haloPress = null, haloFired = false;
$(".brand").addEventListener("pointerdown", () => { haloFired = false; clearTimeout(haloPress); haloPress = setTimeout(() => { haloFired = true; $("#timerBtn").click(); toast(tick ? "Quinze minutes, dans le halo de la lune." : "Minuteur en pause."); }, 550); });
for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $(".brand").addEventListener(ev, () => clearTimeout(haloPress));
$(".brand").addEventListener("click", e => { if (haloFired) { e.preventDefault(); haloFired = false; } });
$(".brand").addEventListener("contextmenu", e => e.preventDefault());
