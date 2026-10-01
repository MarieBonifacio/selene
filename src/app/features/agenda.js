/* Agenda : un calendrier iCal dédié, aujourd'hui et demain, lu par le passeur. */
import { platform } from "../../platform.js";
import { icsBetween, icsParse } from "../../core/agenda.js";
import { CHANGE, CLICK } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { tr, trn } from "../i18n/index.js";
import { dehorsOn, dehorsWhen } from "./dehors.js";
import { hm } from "../scene/sky.js";
import { passeurFetch, passeurPret } from "../services/passeur.js";
import { render } from "../shell/render.js";
import { S, label } from "../state/site.js";
import { fold } from "../views/recherche.js";

/* Agenda : un calendrier dédié, aujourd'hui et demain (agenda.js pour la lecture iCal).
   L'adresse iCal secrète est une capacité au porteur : qui la possède lit l'agenda. Elle reste donc dans ce navigateur
   (jamais synchronisée, effacée à la déconnexion) et ne voyage que vers ton passeur, qui ne garde rien. Lue au plus
   une fois par heure, onglet visible. Un préfixe « Chantier : » range l'événement sous l'espace de ce nom. */
const ICS_URL = "selene-ics-url", ICS_CACHE = "selene-ics";
const icsUrl = () => platform.secrets.get(ICS_URL) || "";
function icsCache() { try { const c = JSON.parse(platform.storage.get(ICS_CACHE) || "null"); if (c && Array.isArray(c.events)) return c; } catch {} return { at: 0, events: [], err: "" }; }
let agendaBusy = false;
export async function agendaRefresh(force = false) {
  const url = icsUrl();
  if (agendaBusy || !url || !passeurPret() || document.visibilityState !== "visible") return;
  if (!force && Date.now() - icsCache().at < 3600000) return;
  agendaBusy = true;
  const c = icsCache();
  try {
    const r = await passeurFetch(url, "ics");
    if (r.status >= 200 && r.status < 300 && typeof r.texte === "string") {
      const now = Date.now(), ev = icsParse(r.texte);
      // On ne garde que ce qui peut encore servir : les récurrences, et ce qui n'est pas fini depuis plus d'un jour.
      c.events = ev.filter(e => e.rrule || e.end > now - 86400000).slice(0, 800); c.err = ev.length || /BEGIN:VCALENDAR/.test(r.texte) ? "" : tr`ce n'est pas un calendrier iCal`;
    } else c.err = r.erreur || tr`le calendrier répond ${r.status}`;
  } catch (e) { c.err = e.message; }
  c.at = Date.now();
  try { platform.storage.set(ICS_CACHE, JSON.stringify(c)); } catch {}
  agendaBusy = false; render();
}
/* « Chantier : plombier » → l'espace Chantier, et « plombier ». */
function agendaRoute(summary) {
  const m = String(summary).match(/^([^:]{2,40}?)\s*:\s*(.+)$/); if (!m) return { mod: "", text: summary };
  const mod = S().config.modules.find(x => x.on && Object.hasOwn(S().modules, x.id) && fold(label(x.id)) === fold(m[1].trim()));
  return mod ? { mod: mod.id, text: m[2].trim() } : { mod: "", text: summary };
}
export function agendaHTML() {
  if (!dehorsOn() || !icsUrl()) return "";
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const day = n => { const a = new Date(t0); a.setDate(a.getDate() + n); return a.getTime(); };
  const hhmm = t => hm(t).replace(" h 00", " h");
  const block = (n, name) => {
    const occ = icsBetween(icsCache().events, Math.max(day(n), n ? 0 : Date.now() - 3600000), day(n + 1));
    if (!occ.length) return "";
    return `<div class="agenda-day"><p class="hint" style="margin:10px 0 2px">${name}</p><ul class="plain">${occ.slice(0, 8).map(o => { const r = agendaRoute(o.summary);
      return `<li class="agenda-ev"><span class="when">${o.allDay ? tr`journée` : `${esc(hhmm(o.start))}${o.end - o.start > 0 && o.end - o.start < 86400000 ? `–${esc(hhmm(o.end))}` : ""}`}</span> ${r.mod ? `<a class="tag" href="#${esc(r.mod)}">${esc(label(r.mod))}</a> ` : ""}${esc(r.text)}${o.location ? ` <span class="hint" style="margin:0">· ${esc(o.location)}</span>` : ""}</li>`; }).join("")}</ul></div>`;
  };
  return block(0, tr`Aujourd'hui, au calendrier`) + block(1, tr`Demain`);
}
export function agendaSettingsHTML() {
  const c = icsCache(), has = !!icsUrl();
  return `<section id="agenda"><h3>${tr`Calendrier`}</h3><p class="hint">${tr`Un seul calendrier, dédié (crée-en un « Selene ») : aujourd'hui et demain s'affichent sous « Aujourd'hui ». Un titre « Chantier : plombier » se range sous Chantier. Google : paramètres de l'agenda → Intégrer l'agenda → Adresse secrète au format iCal. Apple : partager en public, lien webcal.`}</p>
    <label>${tr`Adresse iCal secrète`}<input type="password" data-act="ics-url" value="${has ? "••••••••" : ""}" autocomplete="off" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></label>
    <p class="hint" style="margin-top:6px">${tr`Qui possède cette adresse lit tout le calendrier : elle reste dans ce navigateur, n'est jamais synchronisée, ne passe que par ton passeur (qui ne garde rien), et s'efface à la déconnexion. Si elle fuit, réinitialise-la dans l'agenda.`}</p>
    ${has ? `<p class="row" style="margin:0"><span>${esc(agendaBusy ? tr`Lecture…` : c.err ? tr`Ne répond pas : ${c.err}` : c.at ? trn(c.events.length, "Lu {1} : {0} événement à venir ou récurrent.", "Lu {1} : {0} événements à venir ou récurrents.", dehorsWhen(c.at)) : tr`Pas encore lu.`)}</span><button class="btn sm" data-act="ics-check">${tr`Relire`}</button><button class="btn ghost sm" data-act="ics-forget">${tr`oublier`}</button></p>` : ""}</section>`;
}
CHANGE["ics-url"] = el => {
  let v = el.value.trim(); if (v.startsWith("•")) return;
  v = v.replace(/^webcal:\/\//i, "https://");
  if (v && !/^https:\/\//i.test(v)) { el.value = ""; return toast(tr`Une adresse https:// (ou webcal://) est attendue.`); }
  try { if (v) platform.secrets.set(ICS_URL, v); else platform.secrets.remove(ICS_URL); platform.storage.remove(ICS_CACHE); } catch {}
  el.blur(); render();
  if (v) { toast(tr`Adresse gardée dans ce navigateur. Lecture…`); agendaRefresh(true); }
};
CLICK["ics-check"] = () => agendaRefresh(true);
CLICK["ics-forget"] = () => { platform.secrets.remove(ICS_URL); platform.storage.remove(ICS_CACHE); render(); toast(tr`Calendrier oublié sur cet appareil.`); };
