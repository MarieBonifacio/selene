/* Type « tâches » : échéances, lieux, étapes, coûts ; « Aujourd'hui » plafonné à trois, tous modules confondus ;
   tirage au sort ; « j'attends une réponse » (une tâche dont la suite dépend de quelqu'un d'autre). */
import { RELAUNCH_DAYS, addBudgetEntry, addTask, clearTaskWaiting, relaunchTask, setTaskDone, setTaskToday, setTaskWaiting } from "../../core/domain.js";
import { icsEvent } from "../../core/agenda.js";
import { rainDays } from "../../core/sky.js";
import { registerType } from "../registry.js";
import { $, esc, paged, toast, toastAction, toastUndo } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { addDaysTo, diffDays, fmt, money, todayISO, uid } from "../lib/format.js";
import { N_, collate, tr, trn } from "../i18n/index.js";
import { firstOfType } from "../features/assistant.js";
import { modOf } from "./collection.js";
import { instOf, originHTML, removeWithUndo, within } from "./entries.js";
import { gFilter, gMatch, gcfg, groupPanel, itemGroups } from "./groups.js";
import { freshWeather, skyConf } from "../scene/sky.js";
import { render } from "../shell/render.js";
import { S, enabled, label, site } from "../state/site.js";
import { openForm } from "../ui/dialogs.js";
import { fold } from "../views/recherche.js";

/* ---- tâches : échéances, lieux, étapes, coûts ; « Aujourd'hui » plafonné à trois, tous modules confondus ---- */
export const taskModules = () => Object.keys(S().modules).filter(k => S().modules[k].type === "taches" && enabled(k));
export const allTasks = () => taskModules().flatMap(id => S().modules[id].entries.map(t => [id, t]));
export const todayTasks = () => allTasks().filter(([, t]) => !t.done && t.today);
const todayElsewhere = id => todayTasks().filter(([m]) => m !== id).length;
const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
export const taskFilters = {};
 // filtres par module : { room, cat } (propres à l'appareil, non enregistrés)
const tf = id => taskFilters[id] || (taskFilters[id] = { room: "", cat: "" });
const roomsOf = id => [...new Set(S().modules[id].entries.map(t => t.room).filter(Boolean))].sort(collate);
const doneLines = [N_("Fait. Le monde s'effondre un peu moins vite."), N_("Un de moins. L'entropie note ta résistance."), N_("Coché. Personne n'applaudit, alors je le fais."), N_("Terminé. Ton futur toi te déteste un peu moins."), N_("Réglé. Le chaos recule d'un centimètre.")];
let openId = null;
export const setOpenId = id => { openId = id; };
 // la tâche dépliée (une route « #module/tâche » la choisit aussi)
const taskOf = el => { const li = el.closest("[data-task]"), inst = li && S().modules[li.dataset.mod]; return (inst && inst.entries.find(t => t.id === li.dataset.task)) || null; };
const taskMod = el => el.closest("[data-task]").dataset.mod;
function dueLabel(t) {
  if (!t.due) return { txt: tr`Sans date`, cls: "" };
  const n = diffDays(t.due, todayISO());
  if (n < 0) return { txt: tr`En retard de ${-n} j`, cls: "late" };
  if (n === 0) return { txt: tr`Aujourd'hui`, cls: "late" };
  if (n === 1) return { txt: tr`Demain`, cls: "soon" };
  if (n <= 7) return { txt: tr`Dans ${n} j`, cls: "soon" };
  return { txt: fmt(t.due), cls: "" };
}
/* Une tâche en attente : depuis quand, de qui, quand relancer, combien de relances déjà (E1). */
const waitMeta = (t, withNext = true) => [tr`depuis le ${fmt(t.wait.since)}`, t.wait.who && tr`chez ${esc(t.wait.who)}`,
  withNext && (t.wait.next ? tr`relancer le ${fmt(t.wait.next)}` : tr`sans date de relance`),
  (t.wait.log || []).length && trn(t.wait.log.length, "relancé {0} fois", "relancé {0} fois")].filter(Boolean).join(" · ");
/* Une tâche à ciel ouvert (un des mots réglés dans son titre ou son lieu) : la pluie des cinq prochains jours, lue dans
   la prévision déjà gardée par la Fenêtre (aucun appel de plus). Sans lieu réglé ou sans météo : rien. */
function outdoorRain(c, t) {
  if (t.done) return "";
  const words = String(c.outdoor || "").split(",").map(w => fold(w.trim())).filter(w => w.length > 1), f = fold(`${t.title} ${t.room || ""}`);
  if (!words.some(w => f.includes(w))) return "";
  const sc = skyConf(), w = sc && sc.weather !== false ? freshWeather(sc) : null;
  if (!w || !Array.isArray(w.days) || !w.days.length) return "";
  const today = todayISO(), rain = rainDays(w.days, today, 5), day = d => fmt(d, { weekday: "short", day: "numeric" });
  const tip = `title="${tr`Prévision Open-Meteo pour ${esc(sc.name)}, cinq jours`}"`;
  if (!rain.length) return `<span class="wx" ${tip}>${tr`sec jusqu'à ${esc(day(addDaysTo(today, 4)))}`}</span>`;
  const when = esc(rain.map(day).join(", "));
  return `<span class="wx rain" ${tip}>${t.due && rain.includes(t.due) ? tr`pluie prévue ${when}, le jour prévu` : tr`pluie prévue ${when}`}</span>`;
}
/* Une note de tâche : ses adresses https deviennent des liens (une sortie venue du radar garde celui de l'événement). */
const URL_RE = /(https:\/\/[^\s<>"']*[^\s<>"'.,;:!?)])/;
const noteHTML = s => String(s).split(URL_RE).map((x, i) => i % 2 ? `<a href="${esc(x)}" target="_blank" rel="noopener noreferrer">${esc(x)}</a>` : esc(x)).join("");
export function taskHTML(id, t) {
  const c = S().modules[id].config, d = dueLabel(t), sd = (t.steps || []).filter(x => x.d).length, ef = Math.min(3, Math.max(1, Math.round(+t.effort) || 1));
  return `<li class="item ${t.done ? "done" : ""} ${openId === t.id ? "open" : ""}" data-task="${esc(t.id)}" data-mod="${esc(id)}">
    <input type="checkbox" class="check" data-act="task-done" ${t.done ? "checked" : ""} aria-label="${tr`Marquer comme fait`}">
    <div><button class="t-title" data-act="task-open">${esc(t.title)}</button>
      <div class="meta">${t.room ? `<span class="tag">${esc(t.room)}</span>` : ""}<span class="${t.done ? "" : d.cls}">${esc(d.txt)}</span><span>${esc(t.cat)}</span><span>${"●".repeat(ef)}${"○".repeat(3 - ef)}</span>${(t.steps || []).length ? `<span>${tr`${sd}/${t.steps.length} étapes`}</span>` : ""}${c.costs && t.cost ? `<span>${tr`${esc(t.cost)} €`}</span>` : ""}${outdoorRain(c, t)}</div></div>
    <button class="star ${t.today ? "on" : ""}" data-act="task-today" title="${tr`Faire aujourd'hui`}" aria-label="${tr`Faire aujourd'hui`}" aria-pressed="${t.today ? "true" : "false"}">★</button>
    <div class="details">
      ${(t.steps || []).length ? `<ul class="steps">${t.steps.map((x, i) => `<li><input type="checkbox" data-act="task-step" data-i="${i}" ${x.d ? "checked" : ""} id="s${esc(t.id)}-${i}"><label for="s${esc(t.id)}-${i}" style="font-weight:400;display:inline">${esc(x.t)}</label></li>`).join("")}</ul>` : ""}
      ${t.note ? `<p class="note">${noteHTML(t.note)}</p>` : ""}${t.origin ? `<p class="meta">${originHTML(t, t.title)}</p>` : ""}
      <div class="row"><button class="btn ghost sm" data-act="task-edit">${tr`Modifier`}</button>${t.done || t.wait ? "" : `<button class="btn ghost sm" data-act="task-wait">${tr`J'attends une réponse`}</button>`}${t.due && !t.done ? `<button class="btn ghost sm" data-act="task-ics">${tr`Ajouter à mon calendrier`}</button>` : ""}<button class="btn ghost sm" data-act="task-del">${tr`Supprimer`}</button></div>
    </div></li>`;
}
export function taskForm(id, t) {
  const c = S().modules[id].config;
  $("#roomList").innerHTML = roomsOf(id).map(r => `<option value="${esc(r)}">`).join("");
  openForm(t ? tr`Modifier la tâche` : tr`Nouvelle tâche`, [
    { n: "title", l: tr`Tâche`, req: true },
    { row: [{ n: "room", l: c.groupLabel, list: "roomList" }, { n: "cat", l: c.catLabel, t: "select", o: !t || !t.cat || c.cats.includes(t.cat) ? c.cats : [...c.cats, t.cat] }] },
    { row: [{ n: "due", l: tr`Date butoir`, t: "date" }, { n: "effort", l: tr`Effort`, t: "select", o: [["1", tr`Petit, moins de 30 min`], ["2", tr`Moyen, une demi-journée`], ["3", tr`Gros, un week-end`]] }] },
    ...(c.costs ? [{ n: "cost", l: tr`Coût estimé (€)`, t: "number" }] : []),
    { n: "steps", l: tr`Étapes (une par ligne)`, t: "textarea", rows: 4 },
    { n: "note", l: tr`Note`, t: "textarea", rows: 2 }
  ], t ? { ...t, effort: String(t.effort), steps: (t.steps || []).map(x => x.t).join("\n") } : { room: tf(id).room || (gcfg(id).by === "room" ? gFilter[id] || "" : ""), cat: c.cats[0], effort: "1" }, v => {
    const inst = S().modules[id]; // relu : une synchro a pu remplacer les données pendant la saisie
    if (!inst) return toast(tr`Ce module a été supprimé entre-temps.`);
    const lines = v.steps.split("\n").map(x => x.trim()).filter(Boolean);
    const data = { title: v.title, room: v.room, cat: v.cat, due: v.due || null, effort: +v.effort, cost: "cost" in v ? (v.cost ? +v.cost : null) : (t ? t.cost : null), note: v.note }; // champ absent (coûts désactivés) ≠ champ vidé
    const cur = t && inst.entries.find(x => x.id === t.id);
    if (!cur) addTask(inst.entries, { ...data, steps: lines.map(l => ({ t: l, d: false })) }, uid(), todayISO());
    else { const old = new Map((cur.steps || []).map(x => [x.t, x.d])); Object.assign(cur, data, { steps: lines.map(l => ({ t: l, d: old.get(l) || false })) }); }
    site.save(); render();
  });
}
/* « J'attends une réponse » : la tâche quitte les échéances (elle ne dépend plus de soi) et revient sur l'accueil le jour
   de la relance. Qui doit répondre et quand relancer : deux champs, tous deux facultatifs. */
const keepWait = t => t.wait ? { ...t.wait, log: [...(t.wait.log || [])] } : null;
const putWait = (t, w) => { if (w) t.wait = w; else delete t.wait; };
function waitForm(id, t) {
  openForm(tr`J'attends une réponse`, [{ row: [{ n: "who", l: tr`Qui doit répondre` }, { n: "next", l: tr`Relancer le`, t: "date" }] }],
    { who: t.wait ? t.wait.who : "", next: t.wait ? t.wait.next || "" : addDaysTo(todayISO(), RELAUNCH_DAYS) }, v => {
      const inst = S().modules[id], cur = inst && inst.entries.find(x => x.id === t.id);
      if (!cur) return toast(tr`Cette tâche a été supprimée entre-temps.`);
      const before = keepWait(cur), today = cur.today;
      setTaskWaiting(inst.entries, cur.id, v, todayISO()); site.save(); render();
      toastUndo(tr`« ${cur.title} » attend une réponse. Elle revient le jour de la relance.`, () => { putWait(cur, before); cur.today = today; site.save(); render(); });
    }, tr`La tâche sort des échéances et revient sur l'accueil le jour de la relance.`);
}
/* Enveloppe où vont les coûts d'un module de tâches : celle réglée, sinon une enveloppe « Travaux » (ou « Rénovation »,
   « Repairs », « Renovation », « Home improvement » : le nom choisi par la personne, dans sa langue), sinon aucune. */
const WORKS = /\b(?:travaux|renovation|repairs?|home improvement)\b/;
function costEnvelope(id, bud) {
  const c = S().modules[id].config, envs = bud ? S().modules[bud].config.envelopes : [];
  return c.costEnvelope != null ? c.costEnvelope : ((envs.find(v => WORKS.test(fold(v.name))) || {}).name || "");
}
/* Tirage au sort : dans un module (sa page) ou parmi tous (accueil), plafond de trois respecté. */
export function pickTask(only) {
  if (todayTasks().length >= 3) return toast(tr`Aujourd'hui est plein. Le hasard respecte les plafonds.`);
  const o = allTasks().filter(([m, t]) => !t.done && !t.today && !t.wait && (!only || m === only));
  if (!o.length) return toast(tr`Rien à tirer.`);
  const small = o.filter(([, t]) => t.effort === 1), pool = (small.length ? small : o).sort(([, a], [, b]) => byDue(a, b)).slice(0, 5);
  const [id, t] = pool[Math.floor(Math.random() * pool.length)];
  setTaskToday(S().modules[id].entries, t.id, true, todayElsewhere(id)); site.save(); render();
  toast(tr`Le sort a désigné : « ${t.title} ». Pas de recours possible.`);
}
registerType("taches", {
  view(id) {
    const inst = S().modules[id], c = inst.config, now = todayISO(), o = inst.entries.filter(t => !t.done && !t.wait), f = tf(id);
    const waiting = inst.entries.filter(t => !t.done && t.wait).sort((a, b) => (a.wait.next || "9999").localeCompare(b.wait.next || "9999"));
    const tod = o.filter(t => t.today);
    const cats = [...new Set(inst.entries.map(t => t.cat))];
    // Une tâche du jour vit dans « Aujourd'hui », pas une seconde fois dans les échéances.
    const filtered = o.filter(t => !t.today && (!f.room || t.room === f.room) && (!f.cat || t.cat === f.cat) && gMatch(id, t)).sort(byDue);
    const groups = [
      [tr`En retard`, tr`Le passé ne se repeint pas. Ça, si.`, t => t.due && t.due < now, true],
      [tr`Cette semaine`, tr`Assez proche pour paniquer utilement.`, t => t.due && t.due >= now && diffDays(t.due, now) <= 7],
      [tr`Ce mois-ci`, tr`Le problème de toi dans trois semaines.`, t => t.due && diffDays(t.due, now) > 7 && diffDays(t.due, now) <= 31],
      [tr`Plus tard`, tr`Hors de vue. Pas hors de ta vie.`, t => t.due && diffDays(t.due, now) > 31],
      [tr`Sans date`, tr`Les tâches sans date ne meurent jamais. Elles hantent.`, t => !t.due]
    ].map(([n, h, fn, late]) => { const it = filtered.filter(fn); return it.length ? `<div style="margin-bottom:22px"><h3 class="${late ? "late" : ""}">${n} <span class="hint" style="font-size:1rem">${it.length}</span></h3><p class="hint">${h}</p><ul class="plain">${it.map(t => taskHTML(id, t)).join("")}</ul></div>` : ""; }).join("");
    const spent = inst.entries.filter(t => t.done && t.cost).reduce((a, t) => a + +t.cost, 0), left = inst.entries.filter(t => !t.done && t.cost).reduce((a, t) => a + +t.cost, 0);
    const done = paged(`done:${id}`, inst.entries.filter(t => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")), 8); // les huit dernières, puis « Voir les suivants »
    return `<div data-mod="${esc(id)}"><div class="row" style="margin-bottom:24px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn solid" data-act="task-new">${tr`Ajouter une tâche`}</button><button class="btn" data-act="task-pick">${tr`Tirer au sort`}</button></div>
  <div class="two"><div>
    <section><h3>${tr`Aujourd'hui`}</h3><p class="hint">${tr`Trois tâches maximum, tous modules confondus. Au-delà, c'est une liste de reproches.`}</p><ul class="plain">${tod.map(t => taskHTML(id, t)).join("") || `<li class="empty">${tr`Coche l'étoile d'une tâche.`}</li>`}</ul></section>
    <section><div class="row" style="margin-bottom:12px"><h3 style="margin:0">${tr`Échéances`}</h3><span class="spacer"></span>
      <select data-act="f-room" aria-label="${esc(c.groupLabel)}"><option value="">${tr`${esc(c.groupLabel)} : tout`}</option>${roomsOf(id).map(r => `<option ${r === f.room ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select data-act="f-cat" aria-label="${esc(c.catLabel)}"><option value="">${tr`${esc(c.catLabel)} : tout`}</option>${cats.map(x => `<option ${x === f.cat ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      ${groups || `<p class="empty">${tr`Plus rien ici. Soit c'est fini, soit tu as filtré trop fort.`}</p>`}</section>
    ${waiting.length ? `<section><h3>${tr`En attente`} <span class="hint" style="font-size:1rem">${waiting.length}</span></h3><p class="hint">${tr`La balle est dans un autre camp. Elles reviennent sur l'accueil le jour de la relance.`}</p><ul class="plain">${waiting.map(t => `<li class="item" data-task="${esc(t.id)}" data-mod="${esc(id)}"><span></span><div>${esc(t.title)}<div class="meta"><span class="${t.wait.next && t.wait.next <= now ? "late" : ""}">${waitMeta(t)}</span></div></div><div class="row"><button class="btn ghost sm" data-act="task-relaunch">${tr`relancé`}</button><button class="btn ghost sm" data-act="task-answer">${tr`réponse reçue`}</button></div></li>`).join("")}</ul></section>` : ""}
  </div><aside>
    ${groupPanel(id, tr`La mousse gagne à mesure que tu finis. Clique pour filtrer.`)}
    ${c.costs && (spent || left) ? `<p class="hint">${tr`Budget estimé : ${spent} € engagés, ${left} € encore à prévoir.`}</p>` : ""}
    <section><h3>${tr`Fait récemment`}</h3><ul class="plain">${done.items.map(t => `<li class="item" data-task="${esc(t.id)}" data-mod="${esc(id)}"><span></span><div>${esc(t.title)}<div class="meta">${fmt(t.doneAt)}</div></div><button class="btn ghost sm" data-act="task-undo">${tr`annuler`}</button></li>`).join("") + done.more || `<li class="empty">${tr`Rien pour l'instant. L'histoire ne retiendra rien.`}</li>`}</ul></section>
  </aside></div></div>`;
  },
  settings: (id, { config: c }) => `<div class="field-row"><label>${tr`Nom du regroupement`}<input data-set-mod="${esc(id)}.groupLabel" value="${esc(c.groupLabel)}" placeholder="${tr`Pièce, lieu, client…`}" required></label><label>${tr`Nom des types`}<input data-set-mod="${esc(id)}.catLabel" value="${esc(c.catLabel)}" required></label></div>
    <label style="margin-top:8px;display:block">${tr`Tâches à ciel ouvert (mots dans le titre ou le lieu, séparés par des virgules)`}<input data-set-mod="${esc(id)}.outdoor" value="${esc(c.outdoor || "")}" placeholder="${tr`extérieur, balcon, jardin…`}" maxlength="300"></label>
    <p class="hint" style="margin:4px 0 0">${tr`Elles montrent la pluie des cinq prochains jours, si un lieu est réglé (Réglages → Ciel).`}</p>
    <div class="field-row" style="margin-top:8px"><label>${tr`Types de tâche (un par ligne)`}<textarea data-act="task-cats" data-mod="${esc(id)}" rows="4">${esc(c.cats.join("\n"))}</textarea></label>
    <label style="display:flex;gap:8px;align-items:center;align-self:start;margin-top:26px"><input type="checkbox" data-act="task-costs" data-mod="${esc(id)}" ${c.costs ? "checked" : ""}>${tr`Suivre les coûts estimés`}</label></div>
    ${c.costs && firstOfType("budget") ? `<div class="field-row" style="margin-top:8px"><label>${tr`Enveloppe du budget pour les coûts`}<input data-set-mod="${esc(id)}.costEnvelope" value="${esc(costEnvelope(id, firstOfType("budget")))}" list="env-${esc(id)}" placeholder="${tr`aucune`}"><datalist id="env-${esc(id)}">${S().modules[firstOfType("budget")].config.envelopes.map(v => `<option value="${esc(v.name)}">`).join("")}</datalist></label><span></span></div>` : ""}`,
  summary(id, inst) {
    const now = todayISO(), open = inst.entries.filter(t => !t.done), o = open.filter(t => !t.wait), late = o.filter(t => t.due && t.due < now).length, all = inst.entries.length;
    const w = open.length - o.length;
    return `${late ? `<span class="late">${tr`${late} en retard`}</span>, ` : ""}${tr`${o.length} à faire, ${all ? Math.round(100 * (all - open.length) / all) : 0} % fait`}${w ? ", " + tr`${w} en attente` : ""}`;
  },
  // Une ligne par tâche dont la relance est due : elle ne dépend pas de soi, mais la relancer, si.
  alerts(id, inst, now) {
    return inst.entries.filter(t => !t.done && t.wait && t.wait.next && t.wait.next <= now).map(t => ({
      text: `${tr`« ${esc(t.title)} » : à relancer (${esc(label(id))})`} · ${waitMeta(t, false)}`,
      actions: `<button class="btn sm" data-act="task-relaunch" data-mod="${esc(id)}" data-task="${esc(t.id)}">${tr`relancé`}</button><button class="btn ghost sm" data-act="task-answer" data-mod="${esc(id)}" data-task="${esc(t.id)}">${tr`réponse reçue`}</button>` }));
  },
  context(inst, nm) {
    const o = inst.entries.filter(t => !t.done).sort(byDue), c = inst.config;
    return `\n${nm} : ${o.length} tâches ouvertes sur ${inst.entries.length}.` + o.slice(0, 40).map(t => `\n- [${t.id}] ${t.title} | ${t.room || "?"} | ${t.due ? "échéance " + t.due : "sans date"}${t.today ? " | choisie pour aujourd'hui" : ""}${t.wait ? " | en attente d'une réponse" + (t.wait.who ? " de " + t.wait.who : "") + (t.wait.next ? ", relance le " + t.wait.next : "") : ""}${c.costs && t.cost ? " | " + t.cost + " €" : ""}`).join("");
  },
  grouper: (inst, id) => {
    const c = inst.config, fields = { room: c.groupLabel, cat: c.catLabel, effort: tr`Effort` };
    const key = (t, f) => f === "effort" ? ["", tr`Petit`, tr`Moyen`, tr`Gros`][t.effort || 1] : t[f];
    return { fields, renamable: ["room", "cat"], filterable: true, items: () => inst.entries, key, store: () => site,
      groups: f => itemGroups(inst.entries, t => key(t, f), t => t.done) };
  },
  recent: inst => inst.entries.filter(t => !t.done && !t.wait).sort(byDue).slice(0, 3).map(t => `${t.title} · ${dueLabel(t).txt}`),
  review: (inst, from, to) => { const done = within(inst.entries, from, to, "doneAt"), cost = done.reduce((a, t) => a + (+t.cost || 0), 0); return trn(done.length, "{0} tâche terminée", "{0} tâches terminées") + (inst.config.costs && cost ? ", " + tr`${money(cost)} de coûts estimés` : ""); },
  texts: inst => inst.entries.map(t => ({ text: [t.title, t.room, t.note, ...(t.steps || []).map(x => x.t)].filter(Boolean).join(" · "), date: t.due || t.created, eid: t.id })),
  accept(id, inst, note) { const t = addTask(inst.entries, { title: note.text, cat: inst.config.cats[0] }, uid(), todayISO()); return () => taskForm(id, t); },
  click: {
    "task-open": el => { const t = taskOf(el); openId = openId === t.id ? null : t.id; render(); },
    "task-today": el => { const id = taskMod(el), t = taskOf(el); try { setTaskToday(S().modules[id].entries, t.id, !t.today, todayElsewhere(id)); } catch { return toast(tr`Trois, c'est le plafond. Termine ou retire-en une.`); } site.save(); render(); },
    "task-edit": el => taskForm(taskMod(el), taskOf(el)),
    "task-del": el => removeWithUndo(taskMod(el), "entries", taskOf(el).id),
    "task-undo": el => { setTaskDone(S().modules[taskMod(el)].entries, taskOf(el).id, false, todayISO()); site.save(); render(); },
    "task-new": el => taskForm(modOf(el), null),
    "task-wait": el => waitForm(taskMod(el), taskOf(el)),
    // Un fichier .ics d'une journée, que la personne ouvre dans son agenda : aucun compte, aucune API (E2).
    "task-ics": el => {
      const id = taskMod(el), t = taskOf(el); if (!t || !t.due) return;
      const name = fold(t.title).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "selene";
      downloadFile(`${name}-${t.due}.ics`, icsEvent({ uid: `${t.id}.${id}@selene`, stamp: Date.now(), start: t.due, summary: t.title, location: t.room,
        url: (String(t.note || "").match(URL_RE) || [])[1] || "", description: t.note }), "text/calendar", t.title);
    },
    "task-relaunch": el => {
      const t = taskOf(el); if (!t || !t.wait) return;
      const before = keepWait(t); relaunchTask(S().modules[taskMod(el)].entries, t.id, todayISO()); site.save(); render();
      toastUndo(tr`Relancé. Prochaine relance le ${fmt(t.wait.next)}.`, () => { putWait(t, before); site.save(); render(); });
    },
    "task-answer": el => {
      const t = taskOf(el); if (!t || !t.wait) return;
      const before = keepWait(t); clearTaskWaiting(S().modules[taskMod(el)].entries, t.id); site.save(); render();
      toastUndo(tr`Réponse reçue : « ${t.title} » revient dans les échéances.`, () => { putWait(t, before); site.save(); render(); });
    },
    "task-pick": el => pickTask(el.closest("[data-mod]") ? modOf(el) : null)
  },
  change: {
    "task-done": el => {
      const id = taskMod(el), t = setTaskDone(S().modules[id].entries, taskOf(el).id, el.checked, todayISO()); site.save(); render();
      if (!el.checked) return;
      const bud = firstOfType("budget"), c = S().modules[id].config;
      if (!(c.costs && t.cost && bud)) return toast(tr(doneLines[Math.floor(Math.random() * doneLines.length)]));
      // Proposer, jamais imposer : le coût estimé n'est pas forcément le coût réel.
      const env = costEnvelope(id, bud);
      toastAction(env ? tr`Fait. ${money(t.cost)} estimés : les passer au budget (${env}) ?` : tr`Fait. ${money(t.cost)} estimés : les passer au budget ?`, tr`Ajouter`, () => {
        const b = S().modules[bud]; if (!b) return;
        addBudgetEntry(b.entries, { amount: +t.cost, type: "dépense", cat: env, note: t.title, date: todayISO() }, uid(), todayISO());
        site.save(); render(); toast(tr`Ajouté à ${label(bud)}. L'argent, lui, était déjà parti.`);
      }, 10000);
    },
    "task-step": el => { const t = taskOf(el); t.steps[+el.dataset.i].d = el.checked; site.save(); render(); },
    "f-room": el => { tf(modOf(el)).room = el.value; render(); },
    "f-cat": el => { tf(modOf(el)).cat = el.value; render(); },
    "task-cats": el => { const cats = [...new Set(el.value.split("\n").map(x => x.trim()).filter(Boolean))]; if (cats.length) instOf(el).config.cats = cats; site.save(); el.blur(); render(); },
    "task-costs": el => { instOf(el).config.costs = el.checked; site.save(); render(); }
  }
});
