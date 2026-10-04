/* La relecture de la semaine : dix minutes avec ce qui dort, ce qui se contredit, ce qui attend ses preuves. */
import { platform } from "../../platform.js";
import { CLICK } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { ago, diffDays, todayISO } from "../lib/format.js";
import { tr, trn, trp } from "../i18n/index.js";
import { epLabel } from "../lib/labels.js";
import { backlinks, excerpt, thoughtItems } from "./links.js";
import { sortesCard, sortesPool } from "./sortes.js";
import { openTensions, tensionSection } from "./tensions.js";
import { render } from "../shell/render.js";
import { label } from "../state/site.js";

/* Relecture (idée 4 de l'audit).
   Les motifs, les sortes et les tensions sont calculés, mais restent invisibles tant qu'on ne va pas les chercher. Une
   fois par semaine, une page les rassemble : trois choses endormies (le tirage des sortes, sans remise), les tensions
   ouvertes, les hypothèses qu'aucune source ne documente. Rien n'est noté ni compté : « Relecture faite » retient le
   jour sur cet appareil (selene-relecture), et l'accueil la repropose sept jours plus tard, s'il y a de quoi relire. */
const KEY = "selene-relecture", EVERY = 7;
const lastDone = () => { try { return platform.storage.get(KEY) || ""; } catch { return ""; } };
let drawn = null; // le tirage de la visite : stable d'un rendu à l'autre, refait par « Retirer »
/* Les hypothèses sans source : une note ou un fragment au statut « hypothèse » que rien ne documente. */
export function unsourcedHyps() {
  const back = backlinks();
  return thoughtItems().filter(it => it.e.ep === "hyp" && !(back.get(it.ref) || []).some(b => b.type === "documente"))
    .sort((a, b) => (a.e.date || "").localeCompare(b.e.date || ""));
}
/* Trois tirages sans remise, pondérés par l'oubli, hors tensions (elles ont leur section). */
function drawThree() {
  const pool = sortesPool().filter(x => x.kind !== "tension"), out = [];
  while (out.length < 3 && pool.length) {
    let r = Math.random() * pool.reduce((a, x) => a + x.days, 0), i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].days; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
const material = () => ({ sleeping: sortesPool().filter(x => x.kind !== "tension").length, tensions: openTensions().length, hyps: unsourcedHyps().length });
/* Sur l'accueil : une ligne, seulement quand la dernière relecture a sept jours (ou jamais) et qu'il y a de quoi. */
export function relectureLine() {
  const last = lastDone();
  if (last && diffDays(todayISO(), last) < EVERY) return "";
  const m = material(); if (!m.sleeping && !m.tensions && !m.hyps) return "";
  const parts = [m.sleeping && trn(Math.min(3, m.sleeping), "{0} chose endormie", "{0} choses endormies"), m.tensions && trn(m.tensions, "{0} tension ouverte", "{0} tensions ouvertes"), m.hyps && trn(m.hyps, "{0} hypothèse sans source", "{0} hypothèses sans source")].filter(Boolean);
  return `<p class="hint relecture-go"><a class="btn ghost sm" href="#bilan/relecture">${tr`Relecture de la semaine`}</a> ${tr`dix minutes : ${parts.join(", ")}`}</p>`;
}
export function relectureView() {
  if (!drawn) drawn = drawThree();
  const hyps = unsourcedHyps(), last = lastDone();
  const hypList = hyps.slice(0, 8).map(it => `<li class="item"><span></span><div><a href="#${esc(it.mod)}/${esc(it.e.id)}">${tr`« ${esc(excerpt(it.e, 120))} »`}</a><div class="meta"><span>${esc(label(it.mod))}</span>${it.e.date ? `<span>${tr`notée ${ago(it.e.date)}`}</span>` : ""}</div></div></li>`).join("");
  return `<div class="row" style="margin-bottom:14px"><a class="btn ghost sm" href="#bilan">‹ ${tr`Bilan`}</a></div>
  <h2>${tr`Relecture de la semaine`}</h2>
  <p class="hint">${tr`Dix minutes : ce qui dort, ce qui se contredit, ce qui attend ses preuves. Rien n'est noté ; relire suffit.`}${last ? " " + tr`Dernière relecture ${ago(last)}.` : ""}</p>
  <section><h3>${tr`Trois choses endormies`}</h3><p class="hint">${tr`Tirées au sort, pondérées par l'oubli : plus c'est ancien, plus ça a de chances de revenir.`}</p>
    ${drawn.length ? drawn.map(sortesCard).join("") : `<p class="empty">${tr`Rien d'assez ancien pour l'instant : il faut deux semaines de silence.`}</p>`}
    ${drawn.length ? `<button class="btn ghost sm" data-act="relecture-draw">${tr`Retirer`}</button>` : ""}</section>
  ${tensionSection() || `<section><h3>${tr`Tensions ouvertes`}</h3><p class="empty">${tr`Aucune. Rien ne se contredit, ou rien n'a encore été relié ainsi.`}</p></section>`}
  <section><h3>${tr`Hypothèses sans source`}</h3><p class="hint">${tr`Notées « hypothèse », et qu'aucune source ne documente encore. Une hypothèse n'est pas une faiblesse, c'est une dette à rembourser.`}</p>
    ${hyps.length ? `<ul class="plain">${hypList}</ul>${hyps.length > 8 ? `<p class="hint"><button class="btn ghost sm" data-act="search-for" data-q="${esc(trp("recherche", "statut"))}:${esc(epLabel("hyp"))}">${tr`Voir les ${hyps.length}`}</button></p>` : ""}` : `<p class="empty">${tr`Aucune : chaque hypothèse a sa source, ou aucune n'est notée.`}</p>`}</section>
  <div class="row" style="margin:18px 0 34px"><button class="btn acc" data-act="relecture-done">${tr`Relecture faite`}</button></div>`;
}
CLICK["relecture-draw"] = () => { drawn = drawThree(); render(); };
CLICK["relecture-done"] = () => {
  try { platform.storage.set(KEY, todayISO()); } catch {}
  drawn = null; location.hash = "accueil";
  toast(tr`Relecture faite. La prochaine, dans une semaine.`);
};
