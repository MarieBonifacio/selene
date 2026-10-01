/* La planche de lunaison : une période en une image, téléchargeable. */
import { EP_STATUS } from "../../core/domain.js";
import { CLICK, TYPE_UI } from "../registry.js";
import { esc } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { addDaysTo, fmt, iso, todayISO } from "../lib/format.js";
import { LANGS, N_, sameText, tr, trn, uiLang } from "../i18n/index.js";
import { epLabel } from "../lib/labels.js";
import { concordance, isConcordance } from "../features/concordance.js";
import { lexicalDrift } from "../features/derive.js";
import { epCounts, excerpt, sourceItems } from "../features/links.js";
import { openTensions } from "../features/tensions.js";
import { SYNODIC } from "../scene/moon.js";
import { render } from "../shell/render.js";
import { sigil } from "../shell/sigils.js";
import { S, enabled, label } from "../state/site.js";
import { bilanMode, bilanOffset, periodOf } from "./bilan.js";

/* Planche de lunaison.
   Le bilan d'un cycle mis en page comme une planche d'atlas (A4 portrait), à imprimer ou à enregistrer en PDF par le
   navigateur : vectoriel, net, sans bibliothèque. Numérotée par la lunaison de Meeus : la nouvelle lune de référence
   du code (NEW_MOON_REF, 6 janvier 2000) est sa lunaison 0, donc le k de periodOf est ce numéro. Rien n'y est calculé
   de neuf : chaque chiffre vient du bilan (review, lexicalDrift, concordance, epCounts, openTensions). Son style vit
   ici, en chaîne, pour servir aussi la planche téléchargée, qui doit se suffire à elle-même. */
let plancheOffset = 0;
// Les provenances qui viennent du dehors (origin.from). Enregistrées dans la langue du moment : reconnues dans toutes.
const OUTSIDE = [N_("Dehors"), N_("Veille"), N_("Cité par tes sources"), "Zotero"], FROM_NOTE = N_("depuis une note"), BY_HAND = N_("à la main");
const datedItems = inst => [...(inst.entries || []), ...(inst.scraps || [])].filter(x => x && typeof x.date === "string");
function plancheData(offset, now = Date.now()) {
  const cur = periodOf("lune", offset, now), prev = periodOf("lune", offset + 1, now), s = S(), len = SYNODIC * 86400000;
  const days = []; for (let d = cur.from; d < cur.to; d = addDaysTo(d, 1)) days.push(d);
  const at = new Map(days.map((d, i) => [d, i])), total = days.map(() => 0);
  const rows = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id)).map(m => {
    const inst = s.modules[m.id], ui = TYPE_UI[inst.type];
    if (!ui || isConcordance(inst)) return null;
    const spark = days.map(() => 0);
    for (const x of datedItems(inst)) { const i = at.get(x.date); if (i != null) { spark[i]++; total[i]++; } }
    const review = ui.review ? ui.review(inst, cur.from, cur.to) : "", before = ui.review ? ui.review(inst, prev.from, prev.to) : "";
    return review || spark.some(Boolean) ? { id: m.id, review, before, spark } : null;
  }).filter(Boolean);
  // Les quartiers : nouvelle lune, premier quartier, pleine lune, dernier quartier, au jour près.
  const quarters = [0, .25, .5, .75].map(f => { const d = iso(new Date(cur.start + f * len)); return { f, date: d, i: at.get(d) ?? Math.round(f * days.length) }; });
  const appeared = [];
  for (const [id, inst] of Object.entries(s.modules)) {
    if (!enabled(id) || !isConcordance(inst)) continue;
    for (const r of concordance(inst)) { const ds = r.hits.map(h => h.date).filter(Boolean).sort(); if (ds.length && ds[0] >= cur.from && ds[0] < cur.to) appeared.push({ name: r.e.title, n: ds.filter(d => d < cur.to).length }); }
  }
  // Venu du dehors : les sources gardées pendant le cycle (e.kept), par provenance. Ce qui a été lu puis laissé ne compte pas :
  // Dehors ne date pas ses « vu », et une planche n'a pas à tenir le registre de ce qu'on a eu raison d'ignorer.
  const kept = [];
  for (const { e } of sourceItems()) if (typeof e.kept === "string" && e.kept >= cur.from && e.kept < cur.to)
    kept.push({ title: excerpt(e, 60), from: e.origin ? OUTSIDE.find(f => sameText(f, e.origin.from)) || FROM_NOTE : BY_HAND });
  const drift = lexicalDrift("lune", offset);
  return { k: cur.k, kept, from: cur.from, to: cur.to, days, total, rows, quarters, appeared, n: total.reduce((a, b) => a + b, 0),
    rising: drift.enough ? drift.rising.slice(0, 12).map(x => ({ w: drift.word(x.k), n: x.n })) : null,
    ep: epCounts(cur.from, cur.to), tensions: openTensions().filter(t => !t.date || t.date < cur.to).length };
}
/* La règle de lunaison : un trait par jour, haut comme le nombre d'entrées datées ; les quartiers en glyphes, au-dessus. */
function rulerSVG(p) {
  const n = p.days.length, W = n * 10, max = Math.max(1, ...p.total), sh = (f, x) => {
    const r = 4.5, c = `cx="${x}" cy="9" r="${r}"`;
    if (f === 0) return `<circle ${c} fill="none" stroke="currentColor" stroke-width=".8"/>`;
    if (f === .5) return `<circle ${c} fill="currentColor"/>`;
    const side = f === .25 ? 1 : 0; // premier quartier éclairé à droite (au nord de l'équateur), dernier à gauche
    return `<circle ${c} fill="none" stroke="currentColor" stroke-width=".8"/><path d="M${x},${9 - r}A${r},${r} 0 0 ${side} ${x},${9 + r}Z" fill="currentColor"/>`;
  };
  const bars = p.total.map((v, i) => v ? `<rect x="${i * 10 + 2.5}" y="${(52 - 32 * v / max).toFixed(1)}" width="5" height="${(32 * v / max).toFixed(1)}"/>` : `<rect x="${i * 10 + 4.5}" y="51" width="1" height="1"/>`).join("");
  // L'étiquette d'un quartier au bord de la règle s'y aligne au lieu d'en déborder.
  const q = p.quarters.map(x => { const cx = x.i * 10 + 5, anchor = cx < 20 ? "start" : cx > W - 20 ? "end" : "middle";
    return `${sh(x.f, cx)}<text x="${anchor === "start" ? 0 : anchor === "end" ? W : cx}" y="66" text-anchor="${anchor}">${esc(fmt(x.date, { day: "numeric", month: "short" }))}</text>`; }).join("");
  return `<svg viewBox="0 0 ${W} 70" role="img" aria-label="${tr`Règle de lunaison : entrées datées par jour, ${p.n} en tout`}"><g fill="currentColor" opacity=".85">${bars}</g><path d="M0,52.5H${W}" stroke="currentColor" stroke-width=".5"/>${p.days.map((d, i) => `<path d="M${i * 10 + 5},53v${i % 7 ? 2 : 4}" stroke="currentColor" stroke-width=".4"/>`).join("")}<g font-size="6" fill="currentColor">${q}</g></svg>`;
}
const sparkSVG = (vals, max) => `<svg viewBox="0 0 ${vals.length * 4} 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0,19.5H${vals.length * 4}" stroke="currentColor" stroke-width=".4"/><g fill="currentColor">${vals.map((v, i) => v ? `<rect x="${i * 4 + .6}" y="${(19.5 - 18 * v / max).toFixed(1)}" width="2.8" height="${(18 * v / max).toFixed(1)}"/>` : "").join("")}</g></svg>`;
function plancheHTML(p) {
  const long = d => fmt(d, { day: "numeric", month: "long", year: "numeric" }), max = Math.max(1, ...p.rows.flatMap(r => r.spark));
  const eps = Object.keys(EP_STATUS).filter(k => p.ep[k]);
  return `<article class="planche" aria-labelledby="plTitle">
  <header class="pl-head"><p class="pl-no">${tr`Planche ${p.k}`}</p><h2 id="plTitle">${tr`Lunaison du ${esc(long(p.from))} au ${esc(long(addDaysTo(p.to, -1)))}`}</h2>
    <p class="pl-sub">${trn(p.n, "{0} entrée datée · lunaison n° {1} de Meeus", "{0} entrées datées · lunaison n° {1} de Meeus", p.k)}</p></header>
  <figure class="pl-regle">${rulerSVG(p)}<figcaption>${tr`Règle de lunaison : un trait par jour, haut comme le nombre d'entrées datées ; les phases aux quartiers.`}</figcaption></figure>
  <table class="pl-mods"><caption class="sr">${tr`Par espace : la ligne du cycle, celle du précédent, l'activité jour par jour`}</caption><tbody>
    ${p.rows.map(r => `<tr><th scope="row">${sigil(r.id)}${esc(label(r.id))}</th><td>${esc(r.review || "—")}<small>${tr`avant : ${esc(r.before || "—")}`}</small></td><td class="pl-spark">${sparkSVG(r.spark, max)}</td></tr>`).join("") || `<tr><td>${tr`Aucun espace à résumer.`}</td></tr>`}
  </tbody></table>
  <div class="pl-cols">
    <section><h3>${tr`Mots émergents`}</h3>${p.rising == null ? `<p class="pl-muted">${tr`Pas assez de textes pour en parler.`}</p>` : p.rising.length ? `<ul>${p.rising.map(x => `<li>${esc(x.w)} <span>${x.n}</span></li>`).join("")}</ul>` : `<p class="pl-muted">${tr`Aucun ne se détache.`}</p>`}</section>
    <section><h3>${tr`Motifs apparus`}</h3>${p.appeared.length ? `<ul>${p.appeared.map(x => `<li>${esc(x.name)} <span>${x.n}</span></li>`).join("")}</ul>` : `<p class="pl-muted">${tr`Aucun motif neuf.`}</p>`}</section>
    <section><h3>${tr`Statut des idées`}</h3>${eps.length ? `<ul>${eps.map(k => `<li>${esc(epLabel(k))} <span>${p.ep[k]}</span></li>`).join("")}</ul>` : `<p class="pl-muted">${tr`Aucune idée qualifiée.`}</p>`}</section>
    <section><h3>${tr`Tensions ouvertes`}</h3><p>${p.tensions ? trn(p.tensions, "{0} à ce jour, née avant la fin du cycle.", "{0} à ce jour, nées avant la fin du cycle.") : tr`Aucune.`}</p></section>
    <section class="pl-wide"><h3>${tr`Venu du dehors`}</h3>${p.kept.length ? `<p>${trn(p.kept.length, "{0} source gardée ({1}) :", "{0} sources gardées ({1}) :", [...OUTSIDE, FROM_NOTE, BY_HAND].map(f => [f, p.kept.filter(x => x.from === f).length]).filter(([, n]) => n).map(([f, n]) => `${esc(tr(f))} ${n}`).join(" · "))} <span class="pl-muted">${p.kept.slice(0, 5).map(x => tr`« ${esc(x.title)} »`).join(", ")}${p.kept.length > 5 ? trn(p.kept.length - 5, ", et {0} autre", ", et {0} autres") : ""}.</span></p>` : `<p class="pl-muted">${tr`Rien gardé du dehors.`}</p>`}</section>
  </div>
  <footer class="pl-foot">${esc(S().config.name || "Selene")} · ${tr`planche tirée le ${esc(long(todayISO()))}`}</footer></article>`;
}
const PLANCHE_CSS = `.planche{max-width:820px;margin:0 auto;padding:26px 30px;border:1px solid var(--rule);color:var(--ink)}
.pl-head{text-align:center;border-bottom:1px solid var(--rule);padding-bottom:10px;margin-bottom:12px}
.pl-no{margin:0;font-family:var(--f-label,"Spectral SC",Georgia,serif);text-transform:lowercase;letter-spacing:.14em;color:var(--muted)}
.planche h2{margin:4px 0 2px;font-size:1.6rem;font-weight:500}
.pl-sub,.pl-muted{margin:0;color:var(--muted);font-size:.88rem}
.pl-regle{margin:6px 0 14px}.pl-regle svg{display:block;width:100%;height:auto}
.pl-regle figcaption,.pl-foot{font-size:.76rem;color:var(--muted);text-align:center}
.pl-mods{width:100%;border-collapse:collapse;font-size:.86rem}
.pl-mods th,.pl-mods td{border-top:1px solid var(--rule);padding:6px;text-align:left;vertical-align:top}
.pl-mods th{font-weight:500;white-space:nowrap}
.pl-mods small{display:block;color:var(--muted);font-size:.78rem}
.pl-spark{width:32%}.pl-spark svg{display:block;width:100%;height:22px}
.pl-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 28px;margin-top:14px}
.pl-cols h3{margin:0 0 4px;font-family:var(--f-label,"Spectral SC",Georgia,serif);text-transform:lowercase;letter-spacing:.06em;font-size:.95rem;font-weight:400;border-bottom:1px solid var(--rule)}
.pl-cols ul{list-style:none;margin:0;padding:0;columns:2;column-gap:14px;font-size:.86rem}
.pl-cols li span{color:var(--muted);font-variant-numeric:tabular-nums lining-nums}
.pl-cols p{font-size:.86rem;margin:0}
.pl-cols .pl-wide{grid-column:1/-1}
.pl-foot{margin-top:16px;border-top:1px solid var(--rule);padding-top:6px}
@media (max-width:640px){.planche{padding:16px 12px}.pl-cols{grid-template-columns:minmax(0,1fr)}.pl-spark{width:38%}}
@media print{
  @page{size:A4 portrait;margin:12mm}
  html,body{background:#fff!important}
  .app>.side,nav.tabbar,.pl-tools,#toast,dialog{display:none!important}
  .wrap{max-width:none!important;padding:0!important;margin:0!important}
  .planche{--ink:#141a16;--muted:#4a524d;--rule:#a9b0aa;max-width:none;border:0;padding:0;color:#141a16;background:#fff}
  .pl-mods tr,.pl-cols section,.pl-regle{break-inside:avoid}
  .pl-regle svg{max-width:520px;margin:0 auto}.pl-regle{margin:2px 0 8px}.pl-cols{margin-top:10px;row-gap:8px}.pl-foot{margin-top:10px}
}`;
function ensurePlancheCss() {
  try { if (!document.getElementById("plancheCss")) { const st = document.createElement("style"); st.id = "plancheCss"; st.textContent = PLANCHE_CSS; document.head.appendChild(st); } } catch {}
}
export function plancheView() {
  ensurePlancheCss();
  return `<div class="pl-tools row" style="margin-bottom:14px"><a class="btn ghost sm" href="#bilan">‹ ${tr`Bilan`}</a><span class="spacer"></span><button class="btn ghost" data-act="planche-nav" data-d="1" aria-label="${tr`Lunaison précédente`}">‹</button>${plancheOffset ? `<button class="btn ghost" data-act="planche-nav" data-d="-1" aria-label="${tr`Lunaison suivante`}">›</button>` : ""}<button class="btn sm" data-act="planche-print">${tr`Imprimer ou enregistrer en PDF`}</button><button class="btn ghost sm" data-act="planche-dl" title="${tr`Un fichier .html autonome, si l'impression est bloquée`}">${tr`Télécharger`}</button></div>
  ${plancheHTML(plancheData(plancheOffset))}`;
}
/* La planche téléchargée : un .html autonome, en clair, qui s'imprime tel quel (utile là où window.print est bloqué). */
function plancheFile() {
  const p = plancheData(plancheOffset);
  const doc = `<!doctype html><html lang="${LANGS[uiLang()].tag}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(tr`Planche ${p.k}`)}</title>
<style>:root{--ink:#141a16;--muted:#4a524d;--rule:#a9b0aa}body{margin:0;padding:24px 12px;background:#fbfaf6;color:var(--ink);font-family:Georgia,"Times New Roman",serif}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sig{width:1.05em;height:1.05em;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.14em;margin-right:.5em}
${PLANCHE_CSS}</style></head><body>${plancheHTML(p)}</body></html>`;
  return downloadFile(`planche-${p.k}.html`, doc, "text/html", tr`Planche ${p.k}`);
}
CLICK["planche-open"] = () => { plancheOffset = bilanMode() === "lune" ? bilanOffset : 0; location.hash = "bilan/planche"; };
CLICK["planche-nav"] = el => { plancheOffset = Math.max(0, plancheOffset + +el.dataset.d); render(); };
CLICK["planche-print"] = () => { try { window.print(); } catch { plancheFile(); } };
CLICK["planche-dl"] = () => plancheFile();
