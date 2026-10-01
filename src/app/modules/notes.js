/* Type « notes » : textes datés ; la boîte de réception reçoit la capture rapide, qui reconnaît trois intentions et
   propose de ranger. */
import { addBudgetEntry, addCapture, addJournalEntry, entryIds, epPrefix, retargetLinks, stampOrigin } from "../../core/domain.js";
import { findDoi, findUrl } from "../../core/sources.js";
import { TYPE_UI, registerType } from "../registry.js";
import { $, esc, paged, toast, toastAction } from "../lib/dom.js";
import { fmt, money, todayISO, uid } from "../lib/format.js";
import { tr, trn } from "../i18n/index.js";
import { firstOfType } from "../features/assistant.js";
import { applyDerive, deriveBanner, epSelect, linksHTML, margHTML } from "../features/links.js";
import { sourcesModule } from "../features/sources.js";
import { modOf } from "./collection.js";
import { removeWithUndo, within } from "./entries.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { fold } from "../views/recherche.js";

/* ---- notes : textes datés ; l'une des boîtes reçoit la capture rapide de l'accueil ---- */
/* Trois motifs reconnus à la capture, pas davantage, pour rester prévisible :
     « 12 € courses »          → une dépense dans le premier budget (enveloppe devinée d'après le texte)
     « 25 min kundalini »      → une séance dans le protocole nommé
     « phidippus : une note »  → la note rangée dans le module nommé
   La note part toujours d'abord dans la boîte : reconnaître ne fait que proposer un rangement. */
export function captureIntent(text) {
  const s = S(), t = String(text).trim();
  const mods = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id)).map(m => ({ id: m.id, inst: s.modules[m.id], name: fold(label(m.id)) }));
  let m = t.match(/^(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:os?)?\b)\s*(.*)$/i);
  const bud = firstOfType("budget");
  if (m && bud && +m[1].replace(",", ".") > 0) {
    const amount = +m[1].replace(",", "."), rest = m[2].trim(), env = rest && s.modules[bud].config.envelopes.find(v => fold(rest).includes(fold(v.name)));
    return { to: bud, kind: "budget", amount, note: rest, cat: env ? env.name : "", say: tr`${money(amount)} en dépense dans ${label(bud)}` + (env ? ` (${env.name})` : "") };
  }
  m = t.match(/^(\d+)\s*min(?:utes?)?\s+(.+)$/i);
  if (m) {
    const target = mods.find(x => x.inst.type === "programme" && fold(m[2]).includes(x.name));
    if (target) return { to: target.id, kind: "minutes", value: +m[1], say: tr`${m[1]} min dans ${label(target.id)}` };
  }
  m = t.match(/^([^:]{2,40}?)\s*:\s*(.+)$/);
  if (m) {
    const target = mods.find(x => x.name === fold(m[1].trim())), ui = target && TYPE_UI[target.inst.type];
    if (target && ui.accept && (!ui.canAccept || ui.canAccept(target.inst)))
      return { to: target.id, kind: "accept", text: m[2].trim(), say: tr`« ${m[2].trim().slice(0, 40)} » dans ${label(target.id)}` };
  }
  return null;
}
/* Range une note de la boîte selon un motif reconnu, puis l'en retire. */
export function fileIntent(intent, fromId, noteId) {
  const s = S(), src = s.modules[fromId], note = src && src.entries.find(x => x.id === noteId), target = s.modules[intent.to];
  if (!note || !target || intent.to === fromId) return;
  let then;
  if (intent.kind === "budget") addBudgetEntry(target.entries, { amount: intent.amount, type: "dépense", cat: intent.cat, note: intent.note, date: note.date }, uid(), todayISO());
  else if (intent.kind === "minutes") addJournalEntry(target, { date: note.date, value: intent.value }, uid(), todayISO());
  else then = acceptNote(intent.to, fromId, note, intent.text);
  src.entries = src.entries.filter(x => x.id !== noteId); site.save(); render();
  if (typeof then === "function") then(); else toast(tr`Rangé : ${intent.say}.`);
}
/* Confie une note à un autre module ; ce qui en naît garde sa provenance (et son statut, là où il se lit). */
function acceptNote(toId, fromId, note, text = note.text) {
  const target = S().modules[toId], before = entryIds(target);
  const then = TYPE_UI[target.type].accept(toId, target, { ...note, text });
  const born = stampOrigin(target, before, note, label(fromId));
  if (born.length) retargetLinks(S().modules, `${fromId}/${note.id}`, `${toId}/${born[0].id}`); // les liens la suivent
  return then;
}
/* Saisie d'une note : un « ? » en tête la range parmi les hypothèses. */
export function addNote(inst, raw) {
  const p = epPrefix(raw), item = addCapture(inst.entries, p.text, uid(), todayISO());
  if (p.ep) item.ep = p.ep;
  return item;
}
/* Après une capture : proposer le rangement reconnu, sinon le message habituel. */
export function afterCapture(boxId, item, fallback) {
  const intent = captureIntent(item.text);
  if (intent && intent.to !== boxId) toastAction(tr`${intent.say} ?`, tr`Ranger`, () => fileIntent(intent, boxId, item.id), 10000);
  else if (item.ep) toast(tr`Gardé comme hypothèse. Elle attendra ses preuves.`);
  else if (fallback) toast(fallback);
}
/* Où une note peut être rangée : les modules actifs qui savent la recevoir, dans l'ordre de la navigation.
   Un type peut renvoyer une suite à donner (le formulaire d'une tâche, pour la compléter). */
export function noteTargets(fromId) {
  const s = S();
  return s.config.modules.filter(m => m.on && m.id !== fromId).map(m => m.id).filter(id => {
    const inst = Object.hasOwn(s.modules, id) ? s.modules[id] : null, ui = inst && TYPE_UI[inst.type];
    return ui && ui.accept && (!ui.canAccept || ui.canAccept(inst));
  });
}
registerType("notes", {
  view(id) {
    const inst = S().modules[id], c = inst.config, targets = noteTargets(id);
    return `<div data-mod="${esc(id)}"><div class="row" style="align-items:baseline"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span>${c.inbox && inst.entries.length > 1 ? `<button class="btn sm" data-act="vasculum">${tr`Trier une à une`}</button>` : ""}</div>${c.description ? `<p class="hint">${esc(c.description)}</p>` : ""}
  ${deriveBanner(id)}<div class="capture" style="margin-bottom:18px"><input id="noteIn" data-draft placeholder="${esc(c.placeholder)}" aria-label="${tr`Nouvelle note`}"><button class="btn acc" data-act="note-add">${tr`Garder`}</button></div>
  <ul class="plain margins">${(pg => pg.items.map(x => { const intent = captureIntent(x.text); return `<li class="item" data-id="${esc(x.id)}"><span class="jdate">${fmt(x.date)}</span><div>${esc(x.text)}<div class="meta">${epSelect(id, x)}${linksHTML(id)}</div>
    ${intent && intent.to !== id ? `<div class="row" style="margin-top:6px"><button class="btn sm acc" data-act="note-file">${tr`Ranger : ${esc(intent.say)}`}</button></div>` : ""}
    ${sourcesModule() && (findDoi(x.text) || findUrl(x.text)) ? `<div class="row" style="margin-top:6px"><button class="btn sm" data-act="note-source">${tr`Garder comme source`}</button></div>` : ""}
    ${targets.length ? `<div class="row${c.inbox ? "" : " ra"}" style="margin-top:6px">${targets.map(k => `<button class="btn sm" data-act="note-to" data-to="${esc(k)}">→ ${esc(label(k))}</button>`).join("")}</div>` : ""}</div>
    ${margHTML(id, x, x.text)}<button class="btn ghost sm ra" data-act="note-del">${tr`suppr.`}</button></li>`; }).join("") + pg.more)(paged(`notes:${id}`, [...inst.entries].reverse())) || `<li class="empty">${c.inbox ? tr`Vide. Le silence d'une clairière, ou celui d'un cerveau.` : tr`Rien pour l'instant.`}</li>`}</ul></div>`;
  },
  settings: (id, { config: c }) => `<label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="notes-inbox" data-mod="${esc(id)}" ${c.inbox ? "checked" : ""}>${tr`Boîte de réception : reçoit la capture rapide de l'accueil`}</label>
    <div class="field-row" style="margin-top:8px"><label>${tr`Description`}<input data-set-mod="${esc(id)}.description" value="${esc(c.description)}" placeholder="${tr`Une phrase sous le titre`}"></label><label>${tr`Texte d'invite`}<input data-set-mod="${esc(id)}.placeholder" value="${esc(c.placeholder)}" required></label></div>`,
  summary: (id, inst) => inst.config.inbox ? tr`${inst.entries.length} à trier` : trn(inst.entries.length, "{0} note", "{0} notes"),
  context: (inst, nm) => `\n${nm}${inst.config.inbox ? " (à trier)" : ""} : ${inst.entries.map(x => x.text).join(" ; ") || "vide"}`,
  badge: inst => inst.config.inbox ? inst.entries.length : 0,
  recent: inst => inst.entries.slice(-3).reverse().map(x => x.text.length > 80 ? x.text.slice(0, 80) + "…" : x.text),
  review: (inst, from, to) => trn(within(inst.entries, from, to).length, "{0} note", "{0} notes"),
  texts: inst => inst.entries.map(x => ({ text: x.text, date: x.date, ep: x.ep, eid: x.id })),
  accept: (id, inst, note) => { addCapture(inst.entries, note.text, uid(), note.date); },
  click: {
    "note-add": el => {
      const inp = $("#noteIn"); if (!inp || !inp.value.trim()) return;
      const id = modOf(el), item = addNote(S().modules[id], inp.value), derived = applyDerive(id, item); inp.value = ""; site.save(); render();
      if (derived) toast(derived > 1 ? tr`Synthèse gardée. La tension est levée.` : tr`Dérivé, et relié à sa source.`); else afterCapture(id, item);
    },
    "note-file": el => { const id = modOf(el), note = S().modules[id].entries.find(x => x.id === idOf(el)), intent = note && captureIntent(note.text); if (intent) fileIntent(intent, id, note.id); },
    "note-del": el => removeWithUndo(modOf(el), "entries", idOf(el)),
    "note-to": el => {
      const s = S(), src = s.modules[modOf(el)], note = src.entries.find(x => x.id === idOf(el)), to = el.dataset.to;
      const drop = () => { src.entries = src.entries.filter(x => x !== note); site.save(); };
      const then = acceptNote(to, modOf(el), note);
      drop(); render();
      if (typeof then === "function") then(); else toast(tr`Rangé dans ${label(to)}.`);
    }
  },
  change: {
    "notes-inbox": el => {
      const id = el.dataset.mod;
      for (const [k, inst] of Object.entries(S().modules)) if (inst.type === "notes") inst.config.inbox = el.checked ? k === id : (k === id ? false : inst.config.inbox);
      site.save(); render();
    }
  }
});
