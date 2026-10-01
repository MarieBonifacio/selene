/* La dérive lexicale : les mots qui montent et qui s'effacent dans tes textes, d'une période à l'autre. */
import { TYPE_UI } from "../registry.js";
import { esc } from "../lib/dom.js";
import { tr, trn } from "../i18n/index.js";
import { isConcordance } from "./concordance.js";
import { memoInRender } from "../shell/render.js";
import { S, enabled } from "../state/site.js";
import { bilanOffset, periodOf } from "../views/bilan.js";
import { fold } from "../views/recherche.js";

/* Dérive lexicale.
   Les mots propres à la période, comparés aux six précédentes (même découpage : cycles ou mois), dans tous
   les textes datés de tous les modules. Un mot compte une fois par texte (fréquence documentaire) : un texte
   qui répète « lune » dix fois ne fait pas une obsession. Rien n'est enregistré ; tout est recalculé. */
const DRIFT_REF = 6, DRIFT_MIN_TEXTS = 5;
// Mots vides (repliés, sans accents) : ceux qui ne disent rien du sujet. Les mots de moins de 3 lettres sont écartés d'office.
const STOPWORDS = new Set(("les des une est pas que qui quoi dont par pour sur sous dans avec sans entre vers chez mais donc car comme aussi alors ainsi " +
  "encore deja bien tres trop plus moins tout toute tous toutes rien cette ces cet son ses mon mes ton tes notre nos votre vos leur leurs " +
  "elle elles ils nous vous lui eux meme autre autres cela ceci celui celle ceux celles quand puis apres avant depuis pendant jusqu ici " +
  "etre avoir fait faire faut peut peux sont etait etaient ete suis sommes etes avons avez ont avait avaient sera seront serait aurait " +
  "chaque aucun aucune quelque quelques parce lorsque oui non fois jour jours aujourd hui demain hier chose choses the and for with this " +
  "that from are was have not but").split(" "));
/* Les mots d'un texte, sous leur forme repliée (clé) et telle qu'écrite (pour l'afficher), pluriel en s/x ramené au singulier. */
const driftCache = new Map();
export function driftWords(text) {
  let out = driftCache.get(text);
  if (!out) {
    out = new Map();
    // Replié une seule fois (un fold par mot remplirait son cache de mots isolés et en chasserait les textes) ;
    // fold garde lettres et séparateurs à leur place, donc les deux découpages se correspondent mot pour mot.
    const sep = /[^\p{L}\p{N}]+/u, raws = String(text).toLowerCase().split(sep), keys = fold(text).split(sep);
    for (let i = 0; i < raws.length; i++) {
      const raw = raws[i];
      let k = keys.length === raws.length ? keys[i] : fold(raw);
      if (k.length < 3 || /\d/.test(k) || STOPWORDS.has(k)) continue;
      if (k.length > 4 && /[sx]$/.test(k)) k = k.slice(0, -1);
      if (!out.has(k)) out.set(k, raw);
    }
    if (driftCache.size >= 20000) driftCache.clear();
    driftCache.set(text, out);
  }
  return out;
}
export function lexicalDrift(mode, offset) {
  const cur = periodOf(mode, offset), oldest = periodOf(mode, offset + DRIFT_REF);
  const now = new Map(), before = new Map(), shown = new Map(); let nNow = 0, nBefore = 0;
  for (const inst of Object.values(S().modules)) {
    const ui = TYPE_UI[inst.type];
    if (!ui || !ui.texts || isConcordance(inst)) continue;
    for (const t of ui.texts(inst)) {
      if (!t.date || t.date < oldest.from || t.date >= cur.to) continue;
      const inCur = t.date >= cur.from, bag = inCur ? now : before;
      if (inCur) nNow++; else nBefore++;
      for (const [k, raw] of driftWords(t.text)) { bag.set(k, (bag.get(k) || 0) + 1); if (!shown.has(k)) shown.set(k, raw); }
    }
  }
  // Émergent : présent dans au moins deux textes de la période, et bien plus fréquent qu'avant (rapport lissé,
  // pondéré par le nombre de textes : un mot vu deux fois ne pèse pas autant qu'un mot vu dix fois).
  const rate = (n, total) => (n + 0.5) / (total + 1);
  const rising = [...now].filter(([, n]) => n >= 2).map(([k, n]) => ({ k, n, before: before.get(k) || 0, score: n * Math.log(rate(n, nNow) / rate(before.get(k) || 0, nBefore)) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.k.localeCompare(b.k)).slice(0, 8);
  // En extinction : fréquent avant (au moins trois textes), absent de la période.
  const fading = [...before].filter(([k, n]) => n >= 3 && !now.has(k)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([k, n]) => ({ k, n }));
  return { enough: nNow >= DRIFT_MIN_TEXTS && nBefore >= DRIFT_MIN_TEXTS, nNow, nBefore, rising, fading, word: k => shown.get(k) };
}
export function driftSection(mode, cur) {
  const d = memoInRender("drift", () => lexicalDrift(mode, bilanOffset)), motifs = Object.keys(S().modules).find(k => enabled(k) && isConcordance(S().modules[k]));
  const texts = n => trn(n, "{0} texte", "{0} textes"), month = mode === "mois";
  if (!d.enough) return `<section><h3>${tr`Vocabulaire`}</h3><p class="hint">${month ? tr`Pas encore assez de textes datés pour parler de dérive : ${texts(d.nNow)} dans la période, ${texts(d.nBefore)} dans les six mois d'avant (${DRIFT_MIN_TEXTS} de chaque côté au moins).` : tr`Pas encore assez de textes datés pour parler de dérive : ${texts(d.nNow)} dans la période, ${texts(d.nBefore)} dans les six cycles d'avant (${DRIFT_MIN_TEXTS} de chaque côté au moins).`}</p></section>`;
  const known = motifs ? new Set(S().modules[motifs].entries.map(e => fold(e.title))) : new Set();
  const chip = (k, extra) => `<span class="chip"><button class="btn ghost sm" data-act="search-for" data-q="${esc(d.word(k))}">${esc(d.word(k))}${extra}</button>${motifs && !known.has(fold(d.word(k))) ? `<button class="btn ghost sm" data-act="motif-add" data-mod="${esc(motifs)}" data-q="${esc(d.word(k))}" title="${tr`En faire un motif`}" aria-label="${tr`En faire un motif`}">+</button>` : ""}</span>`;
  return `<section><h3>${tr`Vocabulaire`}</h3><p class="hint">${month ? tr`Les mots propres à la période, comparés aux six mois d'avant (${texts(d.nNow)} contre ${d.nBefore}). Une piste, pas un diagnostic : deux occurrences ne font pas une obsession.` : tr`Les mots propres à la période, comparés aux six cycles d'avant (${texts(d.nNow)} contre ${d.nBefore}). Une piste, pas un diagnostic : deux occurrences ne font pas une obsession.`}${motifs ? " " + tr`« + » en fait un motif.` : ""}</p>
    ${d.rising.length ? `<p class="hint" style="margin:0 0 4px">${tr`Émergent`}</p><div class="row">${d.rising.map(x => chip(x.k, ` · ${x.n}${x.before ? " " + tr`(avant ${x.before})` : ""}`)).join("")}</div>` : `<p class="empty">${tr`Aucun mot ne se détache. Constance, ou routine.`}</p>`}
    ${d.fading.length ? `<p class="hint" style="margin:12px 0 4px">${tr`Absent cette fois, fréquent avant`}</p><div class="row">${d.fading.map(x => chip(x.k, " · " + tr`${x.n} avant`)).join("")}</div>` : ""}</section>`;
}
