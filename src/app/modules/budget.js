/* Type « budget » : opérations et enveloppes à plafond mensuel. */
import { addBudgetEntry } from "../../core/domain.js";
import { TYPE_UI, registerType } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { fmt, iso, money, todayISO, uid } from "../lib/format.js";
import { modOf } from "./collection.js";
import { instOf, recentBy, removeWithUndo, within } from "./entries.js";
import { gFilter, gMatch, groupPanel } from "./groups.js";
import { allTasks } from "./taches.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { ask } from "../ui/dialogs.js";

/* ---- budget : opérations, enveloppes à plafond mensuel ---- */
export const budMonths = {};
 // mois affiché, par module (propre à l'appareil, non enregistré)
const monthOf = id => budMonths[id] || (budMonths[id] = todayISO().slice(0, 7));
const inMonth = (inst, m) => inst.entries.filter(e => (e.date || "").slice(0, 7) === m);
const sumOf = (es, type) => es.filter(e => e.type === type).reduce((a, e) => a + (+e.amount || 0), 0);
registerType("budget", {
  view(id) {
    const inst = S().modules[id], m = monthOf(id), es = inMonth(inst, m), out = sumOf(es, "dépense"), inn = sumOf(es, "revenu");
    const shown = es.filter(e => gMatch(id, e)).sort((a, x) => x.date.localeCompare(a.date));
    const mLabel = new Date(m + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const tasksLeft = allTasks().filter(([m, t]) => !t.done && t.cost && S().modules[m].config.costs).reduce((a, [, t]) => a + +t.cost, 0);
    const defDate = m === todayISO().slice(0, 7) ? todayISO() : m + "-01";
    return `<div data-mod="${esc(id)}"><div class="row" style="margin-bottom:6px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span>
    <button class="btn ghost" data-act="bud-month" data-d="-1" aria-label="Mois précédent">‹</button><b style="min-width:9ch;text-align:center;text-transform:capitalize">${mLabel}</b><button class="btn ghost" data-act="bud-month" data-d="1" aria-label="Mois suivant">›</button></div>
  <div class="stats"><div><span>Revenus</span><b class="big pos">${money(inn)}</b></div><div><span>Dépenses</span><b class="big">${money(out)}</b></div><div><span>Solde</span><b class="big ${inn - out < 0 ? "neg" : "pos"}">${money(inn - out)}</b></div></div>
  <datalist id="envList">${inst.config.envelopes.map(v => `<option value="${esc(v.name)}">`).join("")}</datalist>
  <div class="row" style="margin-bottom:26px">
    <select id="bType" style="max-width:130px" aria-label="Type"><option>dépense</option><option>revenu</option></select>
    <input id="bAmt" type="number" step="0.01" min="0" placeholder="Montant" style="max-width:130px" inputmode="decimal" aria-label="Montant">
    <input id="bCat" list="envList" placeholder="Enveloppe" style="max-width:170px" aria-label="Enveloppe">
    <input id="bNote" placeholder="Note" style="max-width:220px" aria-label="Note">
    <input id="bDate" type="date" value="${defDate}" style="max-width:160px" aria-label="Date">
    <button class="btn acc" data-act="bud-add">Ajouter</button></div>
  <div class="two"><section><h3>Opérations</h3><p class="hint">L'argent ne disparaît pas, il change simplement de propriétaire.</p>
    <ul class="plain">${shown.map(e => `<li class="item" data-id="${esc(e.id)}"><span class="jdate">${fmt(e.date)}</span><div>${esc(e.note || e.cat || e.type)}<div class="meta">${e.cat ? `<span class="tag">${esc(e.cat)}</span>` : ""}</div></div><div class="row"><b class="${e.type === "revenu" ? "pos" : ""}">${e.type === "revenu" ? "+" : "−"}${money(e.amount)}</b><button class="btn ghost sm ra" data-act="bud-del">suppr.</button></div></li>`).join("") || `<li class="empty">Aucune opération ce mois-ci. Suspect.</li>`}</ul></section>
  <div>${groupPanel(id, "Part de chaque enveloppe mensuelle déjà consommée. Le rouge signale le dépassement.")}
    ${tasksLeft ? `<p class="hint">Les tâches en cours estiment encore ${money(tasksLeft)} de dépenses à venir.</p>` : ""}</div></div></div>`;
  },
  settings: (id, { config: c }) => `<div><span class="hint" style="margin:0">Enveloppes mensuelles</span>${c.envelopes.map((v, i) => `<div class="set" data-vi="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="env-name" data-mod="${esc(id)}" value="${esc(v.name)}" aria-label="Nom de l'enveloppe"><input type="number" min="0" data-act="env-limit" data-mod="${esc(id)}" value="${esc(v.limit || "")}" placeholder="€ / mois" aria-label="Plafond mensuel"><button class="btn ghost sm" data-act="env-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}<button class="btn sm" data-act="env-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter une enveloppe</button></div>`,
  recent: inst => recentBy(inst.entries).map(e => `${fmt(e.date)} · ${e.note || e.cat || e.type} · ${e.type === "revenu" ? "+" : "−"}${money(e.amount)}`),
  review: (inst, from, to) => { const es = within(inst.entries, from, to), out = sumOf(es, "dépense"), inn = sumOf(es, "revenu"); return `${money(out)} dépensés, ${money(inn)} reçus, solde ${money(inn - out)}`; },
  texts: inst => inst.entries.filter(e => e.note || e.cat).map(e => ({ text: [e.note, e.cat, money(e.amount)].filter(Boolean).join(" · "), date: e.date, eid: e.id })),
  summary(id, inst) {
    const es = inMonth(inst, todayISO().slice(0, 7)), out = sumOf(es, "dépense"), bal = sumOf(es, "revenu") - out;
    return `Ce mois-ci : ${money(out)} dépensés, solde <span class="${bal < 0 ? "neg" : "pos"}">${money(bal)}</span>`;
  },
  context(inst, nm) {
    const mo = todayISO().slice(0, 7), es = inMonth(inst, mo);
    return `\n${nm} (${mo}) : dépenses ${sumOf(es, "dépense")} €, revenus ${sumOf(es, "revenu")} €. Enveloppes : ${TYPE_UI.budget.envelopeGroups(inst, mo).map(g => `${g.name} ${g.sub}`).join(" ; ")}`;
  },
  // Consommation de chaque enveloppe sur un mois ; les dépenses hors enveloppe connue forment leur propre groupe.
  envelopeGroups(inst, m) {
    const sums = new Map();
    inMonth(inst, m).filter(e => e.type === "dépense").forEach(e => { const k = e.cat || "Sans enveloppe"; sums.set(k, (sums.get(k) || 0) + (+e.amount || 0)); });
    const out = inst.config.envelopes.map((v, i) => { const s = sums.get(v.name) || 0; sums.delete(v.name); return { name: v.name, num: s, den: +v.limit || 0, pct: +v.limit ? Math.round(100 * s / v.limit) : null, sub: `${money(s)} sur ${money(v.limit)}`, order: i }; });
    for (const [n, s] of sums) out.push({ name: n, num: s, den: 0, pct: null, sub: money(s), order: 900 });
    return out;
  },
  grouper: (inst, id) => ({
    fields: { cat: "Enveloppe" }, renamable: ["cat"], filterable: true,
    items: () => inst.entries, key: e => e.cat || "Sans enveloppe", store: () => site,
    groups: () => TYPE_UI.budget.envelopeGroups(inst, monthOf(id)),
    rename: (from, to) => inst.config.envelopes.forEach(v => { if (v.name === from) v.name = to; })
  }),
  click: {
    "bud-month": el => { const id = modOf(el), [y, mo] = monthOf(id).split("-").map(Number), d = new Date(y, mo - 1 + +el.dataset.d, 15); budMonths[id] = iso(d).slice(0, 7); gFilter[id] = ""; render(); },
    "bud-add": el => {
      const amt = Math.abs(+$("#bAmt").value); if (!Number.isFinite(amt) || !amt) return toast("Un montant, même symbolique.");
      try { addBudgetEntry(S().modules[modOf(el)].entries, { amount: amt, type: $("#bType").value, cat: $("#bCat").value.trim(), note: $("#bNote").value.trim(), date: $("#bDate").value }, uid(), todayISO()); } catch (e) { return toast(e.message); }
      ["#bAmt", "#bNote"].forEach(q => $(q).value = ""); site.save(); render();
    },
    "bud-del": el => removeWithUndo(modOf(el), "entries", idOf(el)),
    "env-add": el => { instOf(el).config.envelopes.push({ id: uid(), name: "Nouvelle enveloppe", limit: 100 }); site.save(); render(); },
    "env-del": async el => { const c = instOf(el).config, i = +el.closest("[data-vi]").dataset.vi; if (await ask(`Supprimer l'enveloppe « ${c.envelopes[i].name} » ? Les opérations restent.`)) { c.envelopes.splice(i, 1); site.save(); render(); } }
  },
  change: {
    "env-name": el => { const inst = instOf(el), v = inst.config.envelopes[+el.closest("[data-vi]").dataset.vi], to = el.value.trim(); if (to && to !== v.name) { inst.entries.forEach(e => { if (e.cat === v.name) e.cat = to; }); v.name = to; } site.save(); el.blur(); render(); },
    "env-limit": el => { instOf(el).config.envelopes[+el.closest("[data-vi]").dataset.vi].limit = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
  }
});
