/* Type « rappels » : des gestes réguliers (arroser, nourrir…), dus quand leur intervalle est passé. */
import { addJournalEntry } from "../../core/domain.js";
import { registerType } from "../registry.js";
import { $, esc } from "../lib/dom.js";
import { ago, diffDays, fmt, todayISO, uid } from "../lib/format.js";
import { tr, trn } from "../i18n/index.js";
import { instOf, lastOf, originHTML, recentBy, within } from "./entries.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { ask } from "../ui/dialogs.js";

registerType("rappels", {
  view(id) {
    const inst = S().modules[id], c = inst.config, now = todayISO();
    const line = t => { const l = lastOf(inst, t.id), due = t.every && (!l || diffDays(now, l) >= t.every); return `<div class="set"><span class="${due ? "late" : ""}">${esc(t.label)}</span><span class="hint" style="margin:0">${ago(l)}${t.every ? `, ${tr`tous les ${esc(t.every)} j`}` : ""}</span><button class="btn sm" data-act="entry-log" data-mod="${esc(id)}" data-t="${esc(t.id)}">${tr`Fait aujourd'hui`}</button></div>`; };
    const recent = [...inst.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    return `<h2>${esc(label(id))}${c.subtitle ? ` <span class="hint" style="font-size:1.2rem">${esc(c.subtitle)}</span>` : ""}</h2>
  <div class="two"><section>
    ${c.types.map(line).join("")}
    <div class="row" style="margin-top:14px"><input id="rapNote" data-draft placeholder="${tr`Observation…`}" aria-label="${tr`Observation`}"><button class="btn" data-act="entry-note" data-mod="${esc(id)}">${tr`Noter`}</button></div>
    <p class="hint" style="margin-top:10px">${tr`Réglable dans ${`<a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">${tr`Réglages`}</a>`}.`}</p>
  </section><section><h3>${tr`Journal`}</h3><ul class="plain">${recent.map(l => `<li class="item" data-id="${esc(l.id)}"><span class="jdate">${fmt(l.date)}</span><div><span class="tag">${esc(l.type)}</span>${l.note ? `<div class="note" style="margin:2px 0 0">${esc(l.note)}</div>` : ""}${l.origin ? `<div class="meta">${originHTML(l, l.note)}</div>` : ""}</div><button class="btn ghost sm ra" data-act="entry-del" data-mod="${esc(id)}">${tr`suppr.`}</button></li>`).join("") || `<li class="empty">${tr`Aucune entrée.`}</li>`}</ul></section></div>`;
  },
  settings: (id, { config: c }) => `<div class="field-row"><label>${tr`Sous-titre (ex. nom propre)`}<input data-set-mod="${esc(id)}.subtitle" value="${esc(c.subtitle || "")}"></label><span></span></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">${tr`Types et rappels`}</span>${c.types.map((t, i) => `<div class="set" data-ti="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="typ-name" data-mod="${esc(id)}" value="${esc(t.label)}" aria-label="${tr`Nom`}"><input type="number" min="0" data-act="typ-every" data-mod="${esc(id)}" value="${esc(t.every || "")}" placeholder="${tr`tous les X j`}" aria-label="${tr`Fréquence`}"><button class="btn ghost sm" data-act="typ-del" data-mod="${esc(id)}">${tr`suppr.`}</button></div>`).join("")}<button class="btn sm" data-act="typ-add" data-mod="${esc(id)}" style="margin-top:8px">${tr`Ajouter un type`}</button></div>`,
  summary(id, inst) {
    const t = inst.config.types[0];
    return t ? tr`${esc(t.label)} : ${ago(lastOf(inst, t.id))}` : trn(inst.entries.length, "{0} entrée", "{0} entrées");
  },
  // Une seule ligne par module sur l'accueil, quel que soit le nombre de rappels dus : « Phidippus : Repas (jamais) · Brumisation (jamais) ».
  alerts(id, inst, now) {
    const due = inst.config.types.filter(t => { const l = lastOf(inst, t.id); return t.every && (!l || diffDays(now, l) >= t.every); });
    if (!due.length) return [];
    const one = due.length === 1;
    return [{ text: tr`${`<b>${esc(label(id))}</b>`} : ${due.map(t => `${esc(t.label)} (${ago(lastOf(inst, t.id))})`).join(" · ")}`,
      actions: due.map(t => `<button class="btn sm" data-act="entry-log" data-mod="${esc(id)}" data-t="${esc(t.id)}">${one ? tr`fait` : tr`${esc(t.label.toLowerCase())} : fait`}</button>`).join("") + `<a class="btn ghost sm" href="#${esc(id)}">${tr`voir`}</a>` }];
  },
  accept: (id, inst, note) => { addJournalEntry(inst, { date: note.date, type: "note", note: note.text }, uid(), todayISO()); },
  recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${(inst.config.types.find(t => t.id === x.type) || {}).label || x.type}${x.note ? " · " + x.note : ""}`),
  review: (inst, from, to) => { const es = within(inst.entries, from, to); if (!es.length) return tr`Rien de noté`; const by = [...new Set(es.map(x => x.type))].map(t => `${((inst.config.types.find(y => y.id === t) || {}).label || t).toLowerCase()} ×${es.filter(x => x.type === t).length}`); return by.join(", "); },
  texts: inst => inst.entries.filter(x => x.note).map(x => ({ text: x.note, date: x.date, eid: x.id })),
  context(inst, nm) {
    const c = inst.config;
    return `\n${nm}${c.subtitle ? ` (${c.subtitle})` : ""} : ${c.types.map(t => `${t.label.toLowerCase()} ${lastOf(inst, t.id) || "jamais"}`).join(", ")}.`;
  },
  click: {
    "entry-log": el => { addJournalEntry(instOf(el), { date: todayISO(), type: el.dataset.t, note: "" }, uid(), todayISO()); site.save(); render(); },
    "entry-note": el => { const v = $("#rapNote").value.trim(); if (!v) return; addJournalEntry(instOf(el), { date: todayISO(), type: "note", note: v }, uid(), todayISO()); $("#rapNote").value = ""; site.save(); render(); },
    "typ-add": el => { instOf(el).config.types.push({ id: uid(), label: tr`Nouveau type`, every: 0 }); site.save(); render(); },
    "typ-del": async el => { const inst = instOf(el), i = +el.closest("[data-ti]").dataset.ti; if (await ask(tr`Supprimer « ${inst.config.types[i].label} » ?`)) { inst.config.types.splice(i, 1); site.save(); render(); } }
  },
  change: {
    "typ-name": el => { const t = instOf(el).config.types[+el.closest("[data-ti]").dataset.ti]; t.label = el.value.trim() || t.label; site.save(); el.blur(); render(); },
    "typ-every": el => { const t = instOf(el).config.types[+el.closest("[data-ti]").dataset.ti]; t.every = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
  }
});
