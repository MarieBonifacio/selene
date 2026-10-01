/* Les tensions : deux pensées qui se contredisent, restées sans synthèse. */
import { esc } from "../lib/dom.js";
import { ago } from "../lib/format.js";
import { tr } from "../i18n/index.js";
import { linkLabel } from "../lib/labels.js";
import { refFind, refHTML, thoughtItems } from "./links.js";

/* Tensions.
   Une tension (« contredit ») reste ouverte tant qu'aucune entrée ne dérive des deux à la fois. Ce n'est pas
   une période : une contradiction ne s'éteint pas avec le cycle lunaire. Les plus anciennes d'abord. */
export function openTensions() {
  const items = thoughtItems(), parents = [];
  for (const it of items) { const ps = new Set((it.e.links || []).filter(l => l.type === "derive").map(l => l.to)); if (ps.size > 1) parents.push(ps); }
  const resolved = (a, b) => parents.some(ps => ps.has(a) && ps.has(b));
  const out = [];
  for (const it of items) for (const l of it.e.links || []) if (l.type === "contredit" && refFind(l.to) && !resolved(it.ref, l.to)) out.push({ a: it.ref, b: l.to, date: l.date || "" });
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
export function tensionSection() {
  const ts = openTensions();
  if (!ts.length) return "";
  return `<section><h3>${tr`Tensions ouvertes`}</h3><p class="hint">${tr`Deux entrées qui se contredisent, en attente d'une synthèse qui dérive des deux. Aucune urgence : certaines contradictions sont plus fécondes que leurs solutions.`}</p>
    <ul class="plain">${ts.map(t => `<li class="item"><span></span><div>${refHTML(t.a)} <span class="hint">${esc(linkLabel("contredit"))}</span> ${refHTML(t.b)}${t.date ? `<div class="meta"><span>${tr`ouverte ${ago(t.date)}`}</span></div>` : ""}</div><div class="row"><button class="btn ghost sm" data-act="tension-resolve" data-a="${esc(t.a)}" data-b="${esc(t.b)}">${tr`résoudre`}</button><button class="btn ghost sm" data-act="tension-dossier" data-a="${esc(t.a)}" data-b="${esc(t.b)}">${tr`dossier`}</button></div></li>`).join("")}</ul></section>`;
}
