/* L'accueil : le paysage, « Aujourd'hui », où en sont les choses, les brouillons à reprendre. */
import { platform } from "../../platform.js";
import { MODULE_TEMPLATES, inboxId } from "../../core/domain.js";
import { radarWords } from "../../core/radar.js";
import { CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { esc } from "../lib/dom.js";
import { ago, todayISO } from "../lib/format.js";
import { tr, trn, trp } from "../i18n/index.js";
import { agendaHTML } from "../features/agenda.js";
import { backend } from "../features/assistant.js";
import { bridgeStale } from "../features/bridge.js";
import { dehorsLine } from "../features/dehors.js";
import { radarConf, radarPlace } from "../features/radar.js";
import { sortesSection } from "../features/sortes.js";
import { taskHTML, taskModules, todayTasks } from "../modules/taches.js";
import { forestSVG } from "../scene/forest.js";
import { moon } from "../scene/moon.js";
import { heroStyle, sceneNow, skyLive } from "../scene/sky.js";
import { agoTime, domains, liveRecents } from "../shell/nav.js";
import { render } from "../shell/render.js";
import { sigil, tintOf } from "../shell/sigils.js";
import { pendingDrafts } from "../state/drafts.js";
import { S, enabled, label, site } from "../state/site.js";
import { bilanMode } from "./bilan.js";


/* Sur téléphone, le paysage se réduit à un bandeau à partir de la deuxième ouverture du jour ; décidé une fois
   par chargement, pour qu'il ne se replie pas sous les yeux en cours d'utilisation. */
const HERO_COMPACT = (() => { try { const seen = platform.storage.get("selene-hero-day") === todayISO(); platform.storage.set("selene-hero-day", todayISO()); return seen; } catch { return false; } })();
VIEWS.accueil = () => {
  const m = moon(), s = S(), now = todayISO(), win = sceneNow(m);
  const tod = todayTasks().slice(0, 3);
  const alerts = [];
  for (const [id, inst] of Object.entries(s.modules)) if (enabled(id) && TYPE_UI[inst.type].alerts) alerts.push(...TYPE_UI[inst.type].alerts(id, inst, now));
  const inbox = inboxId(s.modules), pending = inbox ? s.modules[inbox].entries.length : 0;
  // Toute la ligne mène au module ; un chevron la déplie sur ses derniers éléments, sans avoir à l'ouvrir.
  const row = id => {
    const inst = Object.hasOwn(s.modules, id) ? s.modules[id] : null, more = inst && TYPE_UI[inst.type].recent ? TYPE_UI[inst.type].recent(inst) : [];
    const r = inst && inst.resume, bridge = r ? `<small class="resume ${bridgeStale(r) ? "stale" : ""}">↳ ${esc(r.text)} · ${ago(r.at)}</small>` : "";
    return `<div class="over-wrap${more.length ? " has-more" : ""} ${tintOf(id)}"><a class="over" href="#${esc(id)}"><b>${sigil(id)}${esc(label(id))}</b><span>${summaryFor(id)}${bridge}</span></a>${more.length ? `<details class="more"><summary><span class="sr">${tr`Derniers éléments de ${esc(label(id))}`}</span></summary><ul>${more.map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : ""}</div>`;
  };
  // Regroupées par domaine quand il y en a (un titre en petites capitales par domaine), sinon une seule liste.
  const ds = domains().map(d => ({ ...d, ids: d.ids.filter(id => id !== inbox) })).filter(d => d.ids.length), named = ds.some(d => d.name);
  const rows = ds.map(d => `${named ? `<p class="grp over-grp">${esc(d.name || tr`Espaces`)}</p>` : ""}${d.ids.map(row).join("")}`).join("") + (enabled("assistant") ? row("assistant") : "");
  return `
  ${s.config.welcome ? `<section><h2>${tr`Composer ton espace`}</h2><p class="hint">${tr`Ajoute ce que tu veux suivre, autant de fois que tu veux. Tout se renomme, se règle ou se supprime ensuite dans Réglages.`}</p>
    ${MODULE_TEMPLATES.map(t => `<div class="set" style="grid-template-columns:1fr auto"><div><b>${esc(tr(t.name))}</b><div class="hint" style="margin:2px 0 0">${esc(tr(t.hint))}</div></div><button class="btn sm" data-act="tpl-add" data-tpl="${esc(t.id)}">${tr`Ajouter`}</button></div>`).join("")}
    <div class="row" style="margin-top:12px"><button class="btn acc" data-act="welcome-done">${tr`C'est bon`}</button></div></section>` : ""}
  <section class="hero${HERO_COMPACT ? " compact" : ""}${win.right ? " txt-right" : ""}${skyLive() ? " live" : ""}" style="${heroStyle(win.sc, win.dark)}" data-weather="${win.sc.weather || ""}" data-leaves="${win.sc.leaves}" data-sun="${win.sun.alt.toFixed(1)}">${forestSVG(m.p, win.sc, win.moonAt, win.mo)}<div class="txt">
    <div class="phase">${m.name}</div>
    <p>${tr`Éclairée à ${Math.round(m.illum * 100)} %, jour ${Math.floor(m.age) + 1} du cycle.`} ${m.p < .5 ? tr`Pleine lune dans ${m.nextFull} j.` : tr`Nouvelle lune dans ${m.nextNew} j.`}</p>
    ${win.lineHTML ? `<p class="sky-line">${win.lineHTML}</p>` : ""}${win.events.map(t => `<p class="sky-line sky-event">${esc(t)}</p>`).join("")}
  </div></section>
  ${resumeSection()}
  <div class="two">
    <section><h2>${tr`Aujourd'hui`}</h2><p class="hint">${tr`Trois choses. La forêt pousse très bien sans que tu la surveilles.`}</p>
      <ul class="plain">
        ${tod.map(([id, t]) => taskHTML(id, t)).join("")}
        ${alerts.map(a => `<li class="item alert"><span></span><div>${a.text}</div>${a.actions ? `<div class="row">${a.actions}</div>` : a.href ? `<a class="btn ghost sm" href="${esc(a.href)}">${tr`voir`}</a>` : ""}</li>`).join("")}
      </ul>
      ${!tod.length ? (taskModules().length ? `<p class="empty">${tr`Aucune tâche choisie.`} <button class="btn ghost sm" data-act="task-pick">${tr`Tirer une petite tâche au sort`}</button></p>` : `<p class="empty">${tr`Rien de prévu. Un module de tâches remplirait cet espace, si tu y tiens.`}</p>`) : ""}
      ${agendaHTML()}
      ${dehorsLine()}
      ${radarPlace() && radarWords(radarConf().words).length ? `<p class="hint radar-go">${tr`${`<button class="btn ghost sm" data-act="radar-open">${tr`Radar culturel`}</button>`} ce qui, près d'ici, parle de tes mots`}</p>` : ""}
    </section>
    <section class="capsec"><h2>${tr`Capturer`}</h2><p class="hint">${tr`Dépose-le ici comme une feuille morte, tu trieras l'humus plus tard.`}</p>
      ${inbox ? `<div class="capture"><input id="capIn" data-draft placeholder="${esc(s.modules[inbox].config.placeholder)}" aria-label="${tr`Capture rapide`}"><button class="btn acc" data-act="cap-add">${tr`Garder`}</button></div>
      ${pending ? `<p class="hint" style="margin-top:8px"><a href="#${esc(inbox)}">${trn(pending, "{0} élément à trier", "{0} éléments à trier")}</a></p>` : ""}`
      : `<p class="hint">${tr`Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans ${`<a href="#reglages">${tr`Réglages`}</a>`}.`}</p>`}
    </section>
  </div>
  <section><div class="row" style="align-items:baseline"><h2>${tr`Où en sont les choses`}</h2><span class="spacer"></span><a class="btn ghost sm" href="#bilan">${bilanMode() === "mois" ? tr`Bilan du mois` : tr`Bilan du cycle`}</a></div>${rows}</section>
  ${sortesSection()}`;
};
const SUMMARY = {
  assistant: () => { const b = backend(); return b === "sample" ? tr`Branché via claude.ai` : b === "api" ? tr`Branché via ta clé API` : tr`Pas encore branché`; }
};
export function summaryFor(id) {
  const inst = Object.hasOwn(S().modules, id) ? S().modules[id] : null;
  return inst ? TYPE_UI[inst.type].summary(id, inst) : SUMMARY[id] ? SUMMARY[id]() : "";
}
function resumeSection() {
  const s = S(), drafts = pendingDrafts(), last = liveRecents()[0], lines = [];
  if (last) {
    const r = s.modules[last.id].resume, mine = drafts.filter(d => d.view === last.id).map(d => d.what);
    if (r || mine.length) lines.push(`<li><a href="#${esc(last.id)}"><b>${esc(label(last.id))}</b></a>${r ? ` — ↳ ${esc(r.text)}` : ""}${mine.length ? ` · ${esc(tr`${mine.join(", ")} en cours`)}` : ""} <span class="hint">· ${agoTime(last.at)}</span></li>`);
  }
  for (const d of drafts) {
    if (last && d.view === last.id) continue;
    if (d.view === "sheet") lines.push(`<li>${esc(tr`${d.what} en cours`)} <button class="btn ghost sm" data-act="sheet-capture">${tr`reprendre`}</button></li>`);
    else if (Object.hasOwn(s.modules, d.view) ? enabled(d.view) : d.view === "assistant" && enabled("assistant")) lines.push(`<li><a href="#${esc(d.view)}"><b>${esc(label(d.view))}</b></a> · ${esc(tr`${d.what} en cours`)}</li>`);
  }
  return lines.length ? `<section class="resume-box" aria-label="${trp("accueil", "Reprendre")}"><h3>${trp("accueil", "Reprendre")}</h3><ul>${lines.join("")}</ul></section>` : "";
}
CLICK["welcome-done"] = () => { S().config.welcome = false; site.save(); render(); };
