/* La carte céleste des liaisons : une entrée et son voisinage, placés par le temps et le type de lien. */
import { CARTE_MAX, carteLayout, carteNeighbourhood } from "../../core/carte.js";
import { LINK_TYPES } from "../../core/domain.js";
import { CLICK, SHEETS } from "../registry.js";
import { esc } from "../lib/dom.js";
import { fmt } from "../lib/format.js";
import { tr, trn } from "../i18n/index.js";
import { linkLabel } from "../lib/labels.js";
import { isConcordance, motifForms, motifHit } from "./concordance.js";
import { excerpt, refHTML, thoughtItems } from "./links.js";
import { openTensions } from "./tensions.js";
import { openSheet } from "../shell/sheets.js";
import { tintOf } from "../shell/sigils.js";
import { S, label } from "../state/site.js";

/* La carte céleste des liaisons.
   Une lentille secondaire (carte.js pour la géométrie) : le voisinage d'une entrée (fiche Spécimen) ou les entrées
   d'un motif (Motifs) et leurs liens directs, jamais la totalité. Le type de lien se lit à la forme du trait, pas à la
   couleur (comme les statuts) ; la tension ouverte s'ajoute en cinabre. Chaque étoile est un lien, au clavier aussi ;
   la table des liaisons dit la même chose en texte, et c'est elle seule qu'on voit d'abord sur un téléphone. */
function carteData(arg) {
  const cut = String(arg).indexOf(":"), kind = String(arg).slice(0, cut), ref = String(arg).slice(cut + 1);
  const items = thoughtItems(), byRef = new Map(items.map(it => [it.ref, it])), adj = new Map();
  const add = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (const it of items) for (const l of it.e.links || []) if (byRef.has(l.to) && l.to !== it.ref) { add(it.ref, l.to); add(l.to, it.ref); }
  let refs, capped = false, title, center = null;
  if (kind === "ref") {
    const hit = byRef.get(ref); if (!hit) return null;
    ({ refs, capped } = carteNeighbourhood(ref, adj, 2)); center = ref; title = tr`Voisinage de « ${excerpt(hit.e, 50)} »`;
  } else {
    const [mod, id] = ref.split("/"), inst = Object.hasOwn(S().modules, mod) ? S().modules[mod] : null, motif = inst && isConcordance(inst) && inst.entries.find(x => x.id === id);
    if (!motif) return null;
    const m = motifForms(motif), core = items.filter(it => motifHit(m, it.e.text || "")).sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).map(it => it.ref);
    const set = new Set(core.slice(0, CARTE_MAX));
    capped = core.length > CARTE_MAX;
    for (const r of [...set]) for (const n of [...(adj.get(r) || [])].sort()) { if (set.has(n)) continue; if (set.size < CARTE_MAX) set.add(n); else capped = true; }
    refs = [...set]; title = tr`Motif « ${motif.title} »`;
  }
  const inSet = new Set(refs), open = new Set(openTensions().map(t => `${t.a}|${t.b}`)), edges = [];
  const nodes = refs.map(r => byRef.get(r)).filter(Boolean).map(it => ({ ref: it.ref, mod: it.mod, date: it.e.date, links: (adj.get(it.ref) || new Set()).size }));
  for (const r of refs) for (const l of (byRef.get(r) || { e: {} }).e.links || []) if (inSet.has(l.to) && l.to !== r) edges.push({ from: r, to: l.to, type: l.type, open: l.type === "contredit" && open.has(`${r}|${l.to}`) });
  return { title, center, capped, byRef, edges, layout: carteLayout(nodes, edges, S().config.modules.map(m => m.id)) };
}
const LINE_DASH = { derive: "", contredit: "2 3", echo: "6 4", documente: "7 3 1.5 3" };
const lineSample = (type, open) => `<svg width="30" height="8" aria-hidden="true"><path class="ln ln-${type}${open ? " open" : ""}" d="M1,4H29"${LINE_DASH[type] ? ` stroke-dasharray="${LINE_DASH[type]}"` : ""}/></svg>`;
SHEETS.carte = arg => {
  const c = carteData(arg); if (!c) return `<p class="empty">${tr`Cette entrée ou ce motif n'existe plus.`}</p>`;
  const L = c.layout, when = d => esc(fmt(d, { day: "numeric", month: "short", year: "numeric" }));
  const star = s => { const it = c.byRef.get(s.ref), e = it.e;
    return `<a href="#${esc(it.mod)}/${esc(e.id)}" class="${tintOf(it.mod)}${s.ref === c.center ? " center" : ""}"><title>${esc(excerpt(e, 90))} · ${esc(label(it.mod))}${e.date ? ` · ${when(e.date)}` : ""}</title><circle class="hit" cx="${s.x}" cy="${s.y}" r="12"/><circle cx="${s.x}" cy="${s.y}" r="${s.r}"/></a>`; }; // .hit : une cible de doigt, invisible
  const stars = trn(L.stars.length, "{0} étoile", "{0} étoiles"), lines = trn(L.lines.length, "{0} lien", "{0} liens");
  const svg = `<svg viewBox="0 0 ${L.width} ${L.height}" class="carte-svg" role="group" aria-label="${tr`Carte : ${stars}, ${lines}`}">
    ${L.bands.map((b, i) => `<g class="band"><rect x="0" y="${b.y}" width="${L.width}" height="64"${i % 2 ? ` class="odd"` : ""}/><text x="6" y="${b.y + 36}">${esc(label(b.mod).slice(0, 16))}</text></g>`).join("")}
    ${L.span && L.span.from !== L.span.to ? `<text class="axis" x="${L.span.x0}" y="${L.height - 3}">${when(L.span.from)}</text><text class="axis" x="${L.span.x1}" y="${L.height - 3}" text-anchor="end">${when(L.span.to)}</text>` : ""}
    <g>${L.lines.map(l => `<path class="ln ln-${l.type}${l.open ? " open" : ""}" d="${l.d}"${LINE_DASH[l.type] ? ` stroke-dasharray="${LINE_DASH[l.type]}"` : ""}/>`).join("")}</g>
    <g class="stars">${L.stars.map(star).join("")}</g></svg>`;
  const linked = new Set(c.edges.flatMap(e => [e.from, e.to])), lonely = L.stars.filter(s => !linked.has(s.ref));
  return `<div class="carte">
    <h2 id="sheetTitle">${esc(c.title)}</h2>
    <p class="hint">${tr`${stars}, ${lines}. Le temps de gauche à droite, une bande par espace ; la taille d'une étoile dit son nombre de liens.`}${c.capped ? " " + tr`${CARTE_MAX} étoiles au plus : au-delà, c'est une nébuleuse, pas une carte ; les plus proches sont gardées.` : ""}</p>
    <button class="btn sm carte-toggle" data-act="carte-toggle" aria-expanded="false">${tr`Voir la carte`}</button>
    <div class="carte-sky">${svg}</div>
    <p class="carte-legend">${Object.keys(LINK_TYPES).map(k => `<span>${lineSample(k)}${esc(linkLabel(k))}</span>`).join("")}<span>${lineSample("contredit", true)}${tr`tension ouverte`}</span></p>
    <h3>${tr`Table des liaisons`}</h3>
    <ul class="carte-table">${c.edges.map(e => `<li>${refHTML(e.from)} <span class="hint">${esc(linkLabel(e.type))}</span> ${refHTML(e.to)}${e.open ? ` <span class="late">${tr`tension ouverte`}</span>` : ""}</li>`).join("") || `<li class="empty">${tr`Aucun lien entre ces étoiles.`}</li>`}</ul>
    ${lonely.length ? `<p class="hint" style="margin-top:10px">${tr`Sans lien ici : ${lonely.map(s => refHTML(s.ref)).join(", ")}.`}</p>` : ""}
  </div>`;
};
CLICK["carte"] = el => openSheet("carte", `${el.dataset.k}:${el.dataset.v}`);
CLICK["carte-toggle"] = el => { const on = el.closest(".carte").classList.toggle("show-sky"); el.setAttribute("aria-expanded", on); el.textContent = on ? tr`Masquer la carte` : tr`Voir la carte`; };
