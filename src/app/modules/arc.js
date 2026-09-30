/* Type « arc » : des étapes où l'on loge des fragments et des éléments venus d'autres modules. */
import { registerType } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { fmt, plural, todayISO, uid } from "../lib/format.js";
import { isConcordance } from "../features/concordance.js";
import { excerpt, refFind } from "../features/links.js";
import { instOf, removeWithUndo, within } from "./entries.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";

/* ---- arc : des étapes, où l'on loge des fragments et des éléments de collection venus d'autres modules ----
   Un arc n'impose aucune grille ; ses étapes sont nommées par l'utilisatrice. Ce qui n'est logé nulle part
   ne se voit pas ici : c'est le vide dans une colonne qui porte l'information, pas une liste de manquants. */
export function arcCandidates() {
  const out = [];
  for (const [mod, m] of Object.entries(S().modules)) {
    if (m.type === "cumul") for (const e of m.scraps || []) out.push({ ref: `${mod}/${e.id}`, mod, e });
    else if (m.type === "collection" && !isConcordance(m)) for (const e of m.entries) out.push({ ref: `${mod}/${e.id}`, mod, e });
  }
  return out;
}
function arcPlace(id) {
  const inst = S().modules[id], c = inst.config;
  if (!c.stations.length) return toast("Ajoute une étape avant de placer quoi que ce soit.");
  const choices = arcCandidates().filter(x => x.mod !== id).sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).slice(0, 300);
  if (!choices.length) return toast("Rien à placer pour l'instant : un fragment ou un élément de collection, d'abord.");
  openForm("Placer dans l'arc", [
    { n: "station", l: "Étape", t: "select", o: c.stations.map(s => [s.id, s.name]) },
    { n: "ref", l: "Élément", t: "select", o: choices.map(x => [x.ref, `${label(x.mod)} · ${x.e.date ? fmt(x.e.date) + " · " : ""}${excerpt(x.e, 70)}`]) }
  ], {}, v => {
    const cur = S().modules[id]; // relu : une synchro a pu remplacer les données pendant la saisie
    if (!cur) return toast("Ce module a été supprimé entre-temps.");
    if (cur.entries.some(p => p.station === v.station && p.ref === v.ref)) return toast("Déjà à cette étape.");
    cur.entries.push({ id: uid(), station: v.station, ref: v.ref, at: todayISO() });
    site.save(); render();
  });
}
function arcEmpty(inst) { return inst.config.stations.filter(st => !inst.entries.some(p => p.station === st.id)); }
registerType("arc", {
  view(id) {
    const inst = S().modules[id], c = inst.config;
    const placed = st => [...inst.entries].filter(p => p.station === st.id).sort((a, b) => (a.at || "").localeCompare(b.at || ""));
    const card = p => {
      const hit = refFind(p.ref);
      return `<div class="card" data-id="${esc(p.id)}">${hit ? `<span class="tag">${esc(label(hit.mod))}</span><p style="margin:6px 0"><a href="#${esc(hit.mod)}/${esc(hit.e.id)}">${esc(excerpt(hit.e, 140))}</a></p>${hit.e.date ? `<div class="meta">${fmt(hit.e.date)}</div>` : ""}` : `<i>(supprimé)</i>`}<div class="row"><button class="btn ghost sm ra" data-act="arc-remove" data-mod="${esc(id)}">retirer</button></div></div>`;
    };
    return `<div data-mod="${esc(id)}"><div class="row" style="margin-bottom:20px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn acc" data-act="arc-place" data-mod="${esc(id)}">Placer un élément</button></div>
    ${c.stations.length ? `<div class="board">${c.stations.map(st => `<div class="col"><h3>${esc(st.name)} <span class="hint" style="font-size:.95rem">${placed(st).length}</span></h3>${placed(st).map(card).join("") || `<p class="empty">Vide.</p>`}</div>`).join("")}</div>`
      : `<p class="hint">Aucune étape pour l'instant. Ajoute-en dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a>.</p>`}</div>`;
  },
  settings: (id, { config: c }) => `<div><span class="hint" style="margin:0">Étapes, dans l'ordre</span>${c.stations.map((st, i) => `<div class="set" data-sti="${i}" style="grid-template-columns:1fr auto"><input data-act="stat-name" data-mod="${esc(id)}" value="${esc(st.name)}" aria-label="Nom de l'étape"><div class="row"><button class="btn ghost sm" data-act="stat-up" data-mod="${esc(id)}" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="stat-del" data-mod="${esc(id)}">suppr.</button></div></div>`).join("")}<button class="btn sm" data-act="stat-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter une étape</button></div>`,
  summary(id, inst) {
    const empty = arcEmpty(inst).length;
    return `${plural(inst.entries.length, "élément")} sur ${plural(inst.config.stations.length, "étape")}${empty ? `, ${plural(empty, "vide")}` : ""}`;
  },
  recent: inst => [...inst.entries].sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 3).map(p => {
    const hit = refFind(p.ref), st = inst.config.stations.find(s => s.id === p.station);
    return `${st ? st.name : "?"} · ${hit ? excerpt(hit.e, 50) : "(supprimé)"}`;
  }),
  review: (inst, from, to) => { const n = within(inst.entries, from, to, "at").length; return n ? `${n} placé${n > 1 ? "s" : ""}` : "Rien placé"; },
  context(inst, nm) {
    const c = inst.config, empty = arcEmpty(inst).map(s => s.name);
    return `\n${nm} : arc de ${c.stations.length} étapes (${c.stations.map(s => s.name).join(" → ")}), ${inst.entries.length} éléments placés${empty.length ? `, vide à : ${empty.join(", ")}` : ""}.`;
  },
  click: {
    "arc-place": el => arcPlace(el.dataset.mod),
    "arc-remove": el => removeWithUndo(el.dataset.mod, "entries", idOf(el)),
    "stat-add": el => { const c = instOf(el).config; if (c.stations.length >= 12) return toast("Douze étapes. Au-delà, ce n'est plus un arc, c'est un calendrier."); c.stations.push({ id: uid(), name: `Étape ${c.stations.length + 1}` }); site.save(); render(); },
    "stat-up": el => { const a = instOf(el).config.stations, i = +el.closest("[data-sti]").dataset.sti; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } },
    "stat-del": async el => {
      const inst = instOf(el), c = inst.config, i = +el.closest("[data-sti]").dataset.sti, st = c.stations[i];
      const n = inst.entries.filter(p => p.station === st.id).length;
      if (!await ask(`Supprimer l'étape « ${st.name} » ?${n ? ` ${plural(n, "placement")} seront retirés.` : ""}`)) return;
      inst.entries = inst.entries.filter(p => p.station !== st.id);
      c.stations.splice(i, 1); site.save(); render();
    }
  },
  change: {
    "stat-name": el => { const st = instOf(el).config.stations[+el.closest("[data-sti]").dataset.sti]; st.name = el.value.trim() || st.name; site.save(); el.blur(); render(); }
  }
});
