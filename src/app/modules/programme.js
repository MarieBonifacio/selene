/* Type « programme » : un protocole de séances sur des semaines, ses paliers (critères cochés à la main), son rythme. */
import { addJournalEntry } from "../../core/domain.js";
import { registerType } from "../registry.js";
import { esc, toast, toastAction } from "../lib/dom.js";
import { addDaysTo, diffDays, fmt, plural, streakOf, todayISO, uid } from "../lib/format.js";
import { collectionForm } from "./collection.js";
import { instOf, lastValue, recentBy, totalOf, within } from "./entries.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";

function programmeGroupPanel(id) {
  const inst = S().modules[id], c = inst.config, now = todayISO();
  const days = new Set(inst.entries.map(x => x.date)), cur = Math.min(52, +c.weeks || 12, Math.floor(diffDays(now, c.start) / 7) + 1), out = [];
  for (let w = 0; w < cur; w++) { let n = 0; for (let d = 0; d < 7; d++) if (days.has(addDaysTo(c.start, w * 7 + d))) n++; const den = +c.perWeek || 1; out.push({ name: `Semaine ${w + 1}`, pct: Math.min(100, Math.round(100 * n / den)), sub: `${n} sur ${den} séances` }); }
  return `<section><h3 style="margin:0 0 4px">Par semaine</h3><p class="hint">Objectif : ${esc(c.perWeek)} séances par semaine, réglable dans Réglages.</p>
    <div class="rooms">${out.map(g => `<div class="room ${g.pct > 100 ? "over" : ""}"><div class="fill" style="width:${Math.min(100, g.pct)}%"></div><small>${esc(g.name)}</small><b>${g.pct} %</b><small>${esc(g.sub)}</small></div>`).join("") || `<p class="empty">Rien à regrouper pour l'instant.</p>`}</div></section>`;
}
/* ---- paliers d'un programme : des critères rédigés et cochés à la main, jamais un passage automatique ---- */
export const tierCurrent = c => (c.tiers || []).find(t => !t.advancedAt) || null;
/* Premier module Décisions (une collection réglée en mode révision) actif, ou aucun. */
export const firstDecisions = () => (S().config.modules.find(m => m.on && Object.hasOwn(S().modules, m.id) && S().modules[m.id].type === "collection" && S().modules[m.id].config.review) || {}).id || null;
function tiersPanel(id) {
  const inst = S().modules[id], c = inst.config;
  if (!c.tiers.length) return "";
  const passed = c.tiers.filter(t => t.advancedAt), cur = tierCurrent(c), crit = cur ? (cur.criteria || []) : [];
  const done = crit.filter(cr => cr.done).length;
  return `<section style="margin-top:28px"><h3 style="margin:0 0 4px">Paliers</h3>
    ${passed.length ? `<p class="hint">${passed.map(t => `« ${esc(t.name)} » atteint le ${fmt(t.advancedAt)}`).join(" · ")}</p>` : ""}
    ${cur ? `<b>${esc(cur.name)}</b>
      <ul class="plain">${crit.map(cr => `<li class="item" data-id="${esc(cr.id)}"><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" data-act="tier-check" data-mod="${esc(id)}" ${cr.done ? "checked" : ""}>${esc(cr.text)}</label></li>`).join("") || `<li class="empty">Aucun critère écrit. Ajoutes-en dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a>.</li>`}</ul>
      <p class="hint" style="margin:4px 0">${crit.length ? `${done} sur ${plural(crit.length, "critère")} coché${done > 1 ? "s" : ""}. ` : ""}${crit.length && done === crit.length ? "Tous cochés. Le passage reste ton choix, pas une formalité automatique." : "Coché ou non, rien ne fait avancer le palier à ta place."}</p>
      <button class="btn sm" data-act="tier-advance" data-mod="${esc(id)}">Passer au palier suivant</button>`
      : `<p class="hint">Tous les paliers sont franchis.</p>`}
  </section>`;
}
registerType("programme", {
  view(id) {
    const inst = S().modules[id], c = inst.config, now = todayISO();
    if (!c.start) return `<h2>${esc(label(id))}</h2><p class="hint">Un protocole de ${esc(c.weeks)} semaines, une séance à la fois.</p><button class="btn acc" data-act="prog-start" data-mod="${esc(id)}">Commencer aujourd'hui</button> <a class="btn ghost" href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">ou choisir une autre date</a>`;
    const days = new Set(inst.entries.map(x => x.date)), W = Math.min(52, Math.max(1, Math.round(+c.weeks) || 12));
    const week = Math.min(W, Math.floor(diffDays(now, c.start) / 7) + 1);
    const pct = Math.min(100, Math.round(100 * (diffDays(now, c.start) + 1) / (W * 7)));
    let cal = "";
    for (let w = 0; w < W; w++) { cal += `<span>S${w + 1}</span>`; for (let d = 0; d < 7; d++) { const day = addDaysTo(c.start, w * 7 + d); cal += `<i class="${days.has(day) ? "on" : ""} ${day === now ? "today" : ""} ${day > now ? "future" : ""}" title="${fmt(day)}"></i>`; } }
    const recent = [...inst.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    return `<div class="row" style="margin-bottom:20px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn acc" data-act="entry-add" data-mod="${esc(id)}">Noter une séance</button></div>
  <div class="two"><section>
    <div class="big">Semaine ${week} <span class="hint" style="font-size:1.1rem">sur ${W}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">${inst.entries.length} séances, ${totalOf(inst)} ${esc(c.unitLabel)} au total, série actuelle de ${streakOf([...days])} jour(s).</p>
    <div class="cal">${cal}</div>
    <div style="margin-top:28px">${programmeGroupPanel(id)}</div>
    ${tiersPanel(id)}
  </section><section><h3>Journal</h3><p class="hint">Ce que le corps a fait, ce que la tête en a pensé.</p>
    <ul class="plain">${recent.map(x => `<li class="item" data-id="${esc(x.id)}"><span class="jdate">${fmt(x.date, { weekday: "short", day: "numeric", month: "short" })}</span><div>${esc(x.value ?? "?")} ${esc(c.unitLabel)}${x.note ? `<div class="note" style="margin:2px 0 0">${esc(x.note)}</div>` : ""}</div><button class="btn ghost sm ra" data-act="entry-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Aucune séance notée.</li>`}</ul>
  </section></div>`;
  },
  settings: (id, { config: c }) => `<div class="field-row"><label>Début du protocole<input type="date" data-set-mod="${esc(id)}.start" value="${esc(c.start || "")}"></label><label>Durée (semaines)<input type="number" min="1" max="520" data-set-mod="${esc(id)}.weeks" value="${esc(c.weeks)}"></label></div>
    <div class="field-row" style="margin-top:8px"><label>Unité<input data-set-mod="${esc(id)}.unitLabel" value="${esc(c.unitLabel)}" placeholder="min"></label><label>Séances visées par semaine<input type="number" min="1" max="7" data-set-mod="${esc(id)}.perWeek" value="${esc(c.perWeek)}"></label></div>
    <div style="margin-top:14px"><span class="hint" style="margin:0">Paliers : des critères que tu écris, jamais franchis tout seuls</span>
    ${c.tiers.map((t, ti) => `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--rule)">
      <div class="set" data-tri="${ti}" style="grid-template-columns:1fr auto"><input data-act="tier-name" data-mod="${esc(id)}" value="${esc(t.name)}" aria-label="Nom du palier"><div class="row"><button class="btn ghost sm" data-act="tier-up" data-mod="${esc(id)}" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="tier-del" data-mod="${esc(id)}">suppr.</button></div></div>
      <div style="margin:6px 0 0 10px">${(t.criteria || []).map((cr, ci) => `<div class="set" data-tri="${ti}" data-cri="${ci}" style="grid-template-columns:1fr auto"><input data-act="crit-text" data-mod="${esc(id)}" value="${esc(cr.text)}" placeholder="12 séances à 20 min…" aria-label="Critère"><button class="btn ghost sm" data-act="crit-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}
      <button class="btn ghost sm" data-act="crit-add" data-mod="${esc(id)}" data-tri="${ti}" style="margin-top:4px">+ critère</button></div></div>`).join("")}
    <button class="btn sm" data-act="tier-add" data-mod="${esc(id)}" style="margin-top:10px">Ajouter un palier</button></div>`,
  summary(id, inst) {
    const c = inst.config;
    if (!c.start) return "Pas encore commencé";
    const w = Math.min(c.weeks, Math.floor(diffDays(todayISO(), c.start) / 7) + 1), cur = tierCurrent(c);
    return `Semaine ${w} sur ${esc(c.weeks)}, ${plural(inst.entries.length, "séance")}, série de ${streakOf(inst.entries.map(x => x.date))} j${cur ? `, palier « ${esc(cur.name)} »` : ""}`;
  },
  alerts(id, inst, now) {
    if (!inst.config.start) return [];
    const done = inst.entries.some(x => x.date === now), name = esc(label(id)).toLowerCase(), last = lastValue(inst), m = esc(id);
    const actions = done ? "" : last != null
      ? `<button class="btn sm" data-act="prog-quick" data-mod="${m}">Noter ${esc(last)} ${esc(inst.config.unitLabel)}</button><button class="btn ghost sm" data-act="entry-add" data-mod="${m}">autre…</button>`
      : `<button class="btn ghost sm" data-act="entry-add" data-mod="${m}">noter</button>`;
    return [{ text: done ? `Séance de ${name} faite.` : `Pas encore de séance de ${name} aujourd'hui.`, actions }];
  },
  recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${x.value ?? "?"} ${inst.config.unitLabel}${x.note ? " · " + x.note : ""}`),
  review: (inst, from, to) => { const es = within(inst.entries, from, to); return `${plural(es.length, "séance")}, ${es.reduce((a, x) => a + (+x.value || 0), 0)} ${inst.config.unitLabel}`; },
  texts: inst => inst.entries.filter(x => x.note).map(x => ({ text: x.note, date: x.date, eid: x.id })),
  timerDone(id, inst, minutes) {
    if (!/^min/i.test(inst.config.unitLabel)) return false; // une séance comptée autrement qu'en minutes : rien à déduire
    toastAction(`Quinze minutes. Les noter dans ${label(id)} ?`, `Noter ${minutes} min`, () => {
      const cur = S().modules[id]; if (!cur) return;
      addJournalEntry(cur, { date: todayISO(), value: minutes }, uid(), todayISO()); site.save(); render(); toast("Noté. Le corps a fait sa part.");
    }, 15000);
    return true;
  },
  context(inst, nm) {
    const c = inst.config, cur = tierCurrent(c);
    const tier = cur ? ` Palier actuel : « ${cur.name} » (${(cur.criteria || []).filter(x => x.done).length}/${(cur.criteria || []).length} critères cochés).` : "";
    return `\n${nm} : ${c.start ? `protocole de ${c.weeks} semaines commencé le ${c.start}, ${inst.entries.length} séances, objectif ${c.perWeek}/semaine. Dernières notes : ${inst.entries.slice(-3).map(x => `${x.date} ${x.value ?? "?"} ${c.unitLabel} ${x.note || ""}`).join(" ; ")}${tier}` : "pas commencé"}`;
  },
  add(id, inst) {
    openForm("Noter une séance", [{ row: [{ n: "date", l: "Date", t: "date", req: true }, { n: "value", l: `Durée (${inst.config.unitLabel})`, t: "number" }] }, { n: "note", l: "Ce qui s'est passé", t: "textarea", rows: 4 }],
      { date: todayISO(), value: lastValue(inst) ?? "" }, v => { addJournalEntry(inst, { date: v.date, value: v.value, note: v.note }, uid(), todayISO()); site.save(); render(); });
  },
  click: {
    "prog-quick": el => { const inst = instOf(el), v = lastValue(inst); addJournalEntry(inst, { date: todayISO(), value: v }, uid(), todayISO()); site.save(); render(); toast(`${v} ${inst.config.unitLabel} notées. Le corps a fait sa part.`); },
    "prog-start": el => { instOf(el).config.start = todayISO(); site.save(); render(); },
    "tier-add": el => { instOf(el).config.tiers.push({ id: uid(), name: `Palier ${instOf(el).config.tiers.length + 1}`, criteria: [] }); site.save(); render(); },
    "tier-up": el => { const a = instOf(el).config.tiers, i = +el.closest("[data-tri]").dataset.tri; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } },
    "tier-del": async el => {
      const t = instOf(el).config.tiers[+el.closest("[data-tri]").dataset.tri];
      if (!await ask(`Supprimer le palier « ${t.name} » ? Ses critères disparaissent avec lui ; l'historique du palier franchi n'y touche pas.`)) return;
      instOf(el).config.tiers.splice(+el.closest("[data-tri]").dataset.tri, 1); site.save(); render();
    },
    "crit-add": el => { instOf(el).config.tiers[+el.dataset.tri].criteria.push({ id: uid(), text: "", done: false }); site.save(); render(); },
    "crit-del": el => { const r = el.closest("[data-cri]").dataset; instOf(el).config.tiers[+r.tri].criteria.splice(+r.cri, 1); site.save(); render(); },
    // Le passage est le geste ; la décision reste à rédiger, jamais créée toute seule.
    "tier-advance": el => {
      const inst = instOf(el), cur = tierCurrent(inst.config); if (!cur) return;
      cur.advancedAt = todayISO(); site.save(); render();
      const dec = firstDecisions();
      if (!dec) return toast(`Palier « ${cur.name} » atteint.`);
      const dc = S().modules[dec].config;
      collectionForm(dec, { title: `Palier « ${cur.name} » atteint (${label(el.dataset.mod)})`, status: dc.statuses[Math.min(1, dc.statuses.length - 1)] }, `Noter la décision : « ${cur.name} »`);
    }
  },
  change: {
    "tier-check": el => { const cur = tierCurrent(instOf(el).config), cr = cur && (cur.criteria || []).find(x => x.id === idOf(el)); if (cr) { cr.done = el.checked; site.save(); render(); } },
    "tier-name": el => { const t = instOf(el).config.tiers[+el.closest("[data-tri]").dataset.tri]; t.name = el.value.trim() || t.name; site.save(); el.blur(); render(); },
    "crit-text": el => { const r = el.closest("[data-cri]").dataset, cr = instOf(el).config.tiers[+r.tri].criteria[+r.cri]; cr.text = el.value.trim(); if (!cr.text) instOf(el).config.tiers[+r.tri].criteria.splice(+r.cri, 1); site.save(); el.blur(); render(); }
  }
});
