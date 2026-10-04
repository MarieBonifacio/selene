/* L'accueil : le paysage, « Aujourd'hui », où en sont les choses, les brouillons à reprendre. */
import { platform } from "../../platform.js";
import { MODULE_TEMPLATES, inboxId } from "../../core/domain.js";
import { radarWords } from "../../core/radar.js";
import { CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { localTemplate } from "../lib/labels.js";
import { ago, todayISO } from "../lib/format.js";
import { tr, trn, trp } from "../i18n/index.js";
import { agendaHTML } from "../features/agenda.js";
import { backend } from "../features/assistant.js";
import { bridgeStale } from "../features/bridge.js";
import { dehorsLine } from "../features/dehors.js";
import { radarConf, radarPlace } from "../features/radar.js";
import { relectureLine } from "../features/relecture.js";
import { sortesSection } from "../features/sortes.js";
import { taskHTML, taskModules, todayTasks } from "../modules/taches.js";
import { forestSVG } from "../scene/forest.js";
import { moon } from "../scene/moon.js";
import { heroStyle, sceneNow, skyLive } from "../scene/sky.js";
import { installModules, offered } from "../shell/actions.js";
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
    const r = inst && !TYPE_UI[inst.type].sensitive && inst.resume, bridge = r ? `<small class="resume ${bridgeStale(r) ? "stale" : ""}">↳ ${esc(r.text)} · ${ago(r.at)}</small>` : "";
    return `<div class="over-wrap${more.length ? " has-more" : ""} ${tintOf(id)}"><a class="over" href="#${esc(id)}"><b>${sigil(id)}${esc(label(id))}</b><span>${summaryFor(id)}${bridge}</span></a>${more.length ? `<details class="more"><summary><span class="sr">${tr`Derniers éléments de ${esc(label(id))}`}</span></summary><ul>${more.map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : ""}</div>`;
  };
  // Regroupées par domaine quand il y en a (un titre en petites capitales par domaine), sinon une seule liste.
  const ds = domains().map(d => ({ ...d, ids: d.ids.filter(id => id !== inbox) })).filter(d => d.ids.length), named = ds.some(d => d.name);
  const rows = ds.map(d => `${named ? `<p class="grp over-grp">${esc(d.name || tr`Espaces`)}</p>` : ""}${d.ids.map(row).join("")}`).join("") + (enabled("assistant") ? row("assistant") : "");
  return `
  ${s.config.welcome ? welcomeHTML() : ""}
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
  <section><div class="row sec-head" style="align-items:baseline"><h2>${tr`Où en sont les choses`}</h2><span class="spacer"></span><a class="btn ghost sm" href="#bilan">${bilanMode() === "mois" ? tr`Bilan du mois` : tr`Bilan du cycle`}</a></div>${rows}</section>
  ${relectureLine()}${sortesSection()}`;
};
const SUMMARY = {
  assistant: () => { const b = backend(); return b === "sample" ? tr`Branché via claude.ai` : b === "api" ? tr`Branché via ta clé API` : tr`Pas encore branché`; }
};
export function summaryFor(id) {
  const inst = Object.hasOwn(S().modules, id) ? S().modules[id] : null;
  return inst ? TYPE_UI[inst.type].summary(id, inst) : SUMMARY[id] ? SUMMARY[id]() : "";
}
function resumeSection() {
  const s = S(), drafts = pendingDrafts().filter(d => !TYPE_UI[s.modules[d.view]?.type]?.sensitive), last = liveRecents().find(r => !TYPE_UI[s.modules[r.id]?.type]?.sensitive), lines = [];
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
/* Le premier accueil (U3 de l'audit) : une question plutôt que treize modèles de même poids (loi de Hick : le temps d'un
   choix croît avec le nombre d'options). Chaque réponse installe trois espaces qui vont ensemble ; « Choisir moi-même »
   garde la liste entière. Le premier chemin sert la promesse de Selene : un long projet d'écriture, ses sources. */
export const WELCOME_PATHS = [
  { id: "ecrire", name: () => tr`Un long texte`, hint: () => tr`Thèse, livre, mémoire : les mots écrits, les sources, ce qui reste à faire`, tpls: ["ecriture", "sources", "taches"] },
  { id: "jours", name: () => tr`Mes journées`, hint: () => tr`Ce qui est à faire, ce qui me passe par la tête, ce qui revient`, tpls: ["taches", "carnet", "rappels"] },
  { id: "culture", name: () => tr`Ce que je lis, écoute, regarde`, hint: () => tr`Ce qui attend d'être découvert, des disques, un carnet`, tpls: ["decouvertes", "musique", "carnet"] }
];
const tplOf = id => MODULE_TEMPLATES.find(t => t.id === id);
function welcomeHTML() {
  return `<section class="welcome"><h2>${tr`Composer ton espace`}</h2>
    <p class="hint">${tr`Sur quoi travailles-tu ? Trois espaces pour commencer : tout se renomme, se règle ou se retire ensuite dans Réglages.`}</p>
    <div class="paths">${WELCOME_PATHS.map(w => `<button type="button" class="path" data-act="welcome-path" data-path="${w.id}"><b>${esc(w.name())}</b><span>${esc(w.hint())}</span><small>${esc(w.tpls.map(id => tr(tplOf(id).name)).join(" · "))}</small></button>`).join("")}</div>
    <details id="welcome-all" class="welcome-all"><summary>${tr`Choisir moi-même, parmi tous les modèles`}</summary>
      <p class="hint">${tr`Ajoute ce que tu veux suivre, autant de fois que tu veux.`}</p>
      ${MODULE_TEMPLATES.filter(t => offered(t.type)).map(t => `<div class="set" style="grid-template-columns:1fr auto"><div><b>${esc(tr(t.name))}</b><div class="hint" style="margin:2px 0 0">${esc(tr(t.hint))}</div></div><button class="btn sm" data-act="tpl-add" data-tpl="${esc(t.id)}">${tr`Ajouter`}</button></div>`).join("")}
    </details>
    <div class="row" style="margin-top:12px"><button class="btn" data-act="welcome-done">${tr`C'est bon`}</button></div></section>`;
}
CLICK["welcome-path"] = el => {
  const w = WELCOME_PATHS.find(x => x.id === el.dataset.path); if (!w) return;
  S().config.welcome = false;
  const made = installModules(w.tpls.map(id => localTemplate(tplOf(id))));
  if (made.length) toast(tr`Pour commencer : ${made.join(", ")}. Tout se renomme ou se retire dans Réglages.`);
};
CLICK["welcome-done"] = () => { S().config.welcome = false; site.save(); render(); };
