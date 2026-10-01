/* Ce que les types de module lisent dans leurs entrées : dernière date, total, dernière valeur, entrées récentes,
   provenance. */
import { esc, toast, toastUndo } from "../lib/dom.js";
import { fmt } from "../lib/format.js";
import { tr } from "../i18n/index.js";
import { render } from "../shell/render.js";
import { S, site } from "../state/site.js";

/* Retire un élément d'une liste d'un module (entries, scraps…) ; « Annuler » le remet à sa place. */
export function removeWithUndo(id, list, itemId) {
  const inst = S().modules[id], i = inst[list].findIndex(x => x.id === itemId);
  if (i < 0) return;
  const item = inst[list][i], name = String(item.title || item.text || item.note || item.type || tr`l'élément`);
  inst[list] = inst[list].filter(x => x.id !== itemId); site.save(); render();
  toastUndo(tr`Supprimé : « ${name.length > 40 ? name.slice(0, 40) + "…" : name} ».`, () => {
    const cur = S().modules[id]; // relu : une synchro a pu passer entre-temps
    if (!cur || cur[list].some(x => x.id === itemId)) return;
    cur[list].splice(Math.min(i, cur[list].length), 0, item); site.save(); render(); toast(tr`Rétabli. Rien ne s'est passé.`);
  });
}
export const lastOf = (inst, type) => inst.entries.filter(x => x.type === type).map(x => x.date).sort().pop();
export const totalOf = inst => inst.entries.reduce((a, x) => a + (+x.value || 0), 0);
export const instOf = el => S().modules[el.dataset.mod];
export const lastValue = inst => { const e = [...inst.entries].sort((a, b) => a.date.localeCompare(b.date)).reverse().find(x => x.value != null); return e ? e.value : null; };
export const recentBy = (list, n = 3) => [...list].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, n);
export const within = (list, from, to, key = "date") => list.filter(x => x[key] && x[key] >= from && x[key] < to);
/* D'où vient une entrée rangée depuis une boîte : le lieu et la date, et le texte d'origine s'il a changé. */
export function originHTML(e, current) {
  const o = e.origin; if (!o) return "";
  const same = String(current ?? "").trim() === o.text.trim(), short = o.text.length > 90 ? o.text.slice(0, 90) + "…" : o.text;
  const from = o.date ? tr`de ${esc(o.from)}, ${fmt(o.date)}` : tr`de ${esc(o.from)}`;
  return `<span class="origin" title="${esc(o.text)}">↳ ${same ? from : tr`${from} : « ${esc(short)} »`}</span>`;
}
