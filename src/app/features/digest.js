/* Le résumé du matin (ADR 19) : notifications locales programmées dans les coquilles mobiles. */
import { platform } from "../../platform.js";
import { TYPE_UI } from "../registry.js";
import { esc } from "../lib/dom.js";
import { iso, plural } from "../lib/format.js";
import { allTasks } from "../modules/taches.js";
import { S, enabled } from "../state/site.js";

/* Le résumé du matin (ADR 19).
   Dans une coquille native seulement : une notification par jour, à l'heure choisie (réglage propre à l'appareil),
   pour les sept jours qui viennent. Elle dit ce qui demande un geste ce jour-là : les rappels de l'accueil qui
   proposent une action (un rappel déjà honoré n'en propose plus), et les tâches qui arrivent à échéance. Le système
   garde la liste et la sonne app fermée ; chaque rendu la recalcule et ne la renvoie que si elle a changé. Ouvrir
   Selene au moins une fois par semaine suffit à la tenir à jour : l'oubli prolongé a, lui, sa propre sanction. */
export const NOTIFY_KEY = "selene-notify", NOTIFY_AT = "08:30";
export const notifyConf = () => {
  let c = null; try { c = JSON.parse(platform.storage.get(NOTIFY_KEY) || "null"); } catch {}
  return { on: !!(c && c.on), at: c && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.at) ? c.at : NOTIFY_AT };
};
const plainText = html => String(html).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]).replace(/\s+/g, " ").trim();
export function dayDigest(day) {
  const s = S(), out = [];
  for (const [id, inst] of Object.entries(s.modules)) if (enabled(id) && TYPE_UI[inst.type].alerts) for (const a of TYPE_UI[inst.type].alerts(id, inst, day)) if (a.actions) out.push(plainText(a.text));
  for (const [id, t] of allTasks()) if (enabled(id) && !t.done && t.due === day) out.push(`Échéance : ${t.title}`);
  return out;
}
export function digestPlan(nowMs = Date.now(), days = 7) {
  const { on, at } = notifyConf(); if (!on) return [];
  const [h, m] = at.split(":").map(Number), plan = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(nowMs); d.setDate(d.getDate() + i); d.setHours(h, m, 0, 0);
    if (d.getTime() <= nowMs) continue; // l'heure est passée : ce jour-là, l'app est déjà ouverte
    const items = dayDigest(iso(d)); if (!items.length) continue; // un jour sans rien ne mérite pas qu'on sonne
    plan.push({ id: 100 + i, at: d.toISOString(), title: `Selene : ${plural(items.length, "chose")} ${i ? "ce jour" : "aujourd'hui"}`,
      body: items.slice(0, 3).join(" · ") + (items.length > 3 ? ` · et ${items.length - 3} de plus` : "") });
  }
  return plan;
}
let notifyTimer = null, notifySent = null;
export function notifySoon() {
  if (!platform.notifications.supported()) return;
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    const plan = digestPlan(), sig = JSON.stringify(plan);
    if (sig === notifySent) return;
    notifySent = sig;
    platform.notifications.replace(plan).catch(() => { notifySent = null; });
  }, 1500);
}
export const notifySettingsHTML = () => {
  if (!platform.notifications.supported()) return "";
  const c = notifyConf();
  return `<section id="notify-cfg"><h4>Notifications</h4><p class="hint">Sur cet appareil : chaque matin, ce qui t'attend (rappels, échéances), programmé par le téléphone lui-même, même app fermée. Rien ne part sur un serveur. Les jours sans rien, silence.</p>
    <div class="field-row"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-act="notify-on" ${c.on ? "checked" : ""}>Résumé du matin</label>
    <label>Heure<input type="time" data-act="notify-at" value="${esc(c.at)}"></label></div></section>`;
};
