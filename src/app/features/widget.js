/* Le widget d'écran d'accueil (ADR 24, Android) : la lune du jour et les trois choses qui attendent, envoyées à la
   coquille native quand elles changent. Le widget ne calcule rien : il montre ce que Selene lui a dit en dernier, et
   l'ouvrir suffit à le remettre à l'heure. */
import { platform } from "../../platform.js";
import { todayISO } from "../lib/format.js";
import { todayTasks } from "../modules/taches.js";
import { moon } from "../scene/moon.js";
import { dayDigest } from "./digest.js";

const WIDGET_LINES = 3;
/* Ce que montre le widget : les tâches choisies pour aujourd'hui d'abord, puis les rappels et échéances du jour. */
export function widgetData() {
  const m = moon(), lines = [];
  for (const [, t] of todayTasks()) if (!lines.includes(t.title)) lines.push(t.title);
  for (const x of dayDigest(todayISO())) if (!lines.includes(x) && !lines.some(l => x === `Échéance : ${l}`)) lines.push(x);
  return { moon: `${m.name} · ${Math.round(m.illum * 100)} %`, lines: lines.slice(0, WIDGET_LINES) };
}
let widgetTimer = null, widgetSent = null;
export function widgetSoon() {
  if (!platform.widget.supported()) return;
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => {
    const data = widgetData(), sig = JSON.stringify(data);
    if (sig === widgetSent) return;
    widgetSent = sig;
    platform.widget.update(data).catch(() => { widgetSent = null; });
  }, 1000);
}
