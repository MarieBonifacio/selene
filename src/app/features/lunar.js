/* Le test lunaire : ton activité suit-elle la lune ? Un test honnête, qui dit quand il n'y a pas assez de données. */
import { TYPE_UI } from "../registry.js";
import { esc } from "../lib/dom.js";
import { tr, trn } from "../i18n/index.js";
import { isConcordance } from "./concordance.js";
import { NEW_MOON_REF, SYNODIC, moonName } from "../scene/moon.js";
import { S } from "../state/site.js";

/* Test lunaire.
   Test de Rayleigh (statistique circulaire) : l'activité (tout ce qui est daté, le même corpus que la
   recherche) se concentre-t-elle autour d'une phase de la lune, plutôt que d'être uniformément répartie sur
   le cycle ? Un résultat nul a de la valeur : il dit que la lune n'y est pour rien. Un seul test, ici — le
   répéter ailleurs avec d'autres découpages ferait courir le risque classique des tests multiples : à force
   d'essayer, on finit par trouver un faux signal. */
export const LUNAR_MIN_N = 40;
export const lunarPhase = date => { const t = ((Date.parse(date + "T12:00:00Z") - NEW_MOON_REF) / 86400000 % SYNODIC + SYNODIC) % SYNODIC; return t / SYNODIC; };
export function lunarTest() {
  const angles = [];
  for (const inst of Object.values(S().modules)) {
    const ui = TYPE_UI[inst.type];
    if (!ui || !ui.texts || isConcordance(inst)) continue;
    for (const t of ui.texts(inst)) if (t.date) angles.push(lunarPhase(t.date) * 2 * Math.PI);
  }
  const n = angles.length;
  if (n < LUNAR_MIN_N) return { n, enough: false };
  let c = 0, s = 0;
  for (const a of angles) { c += Math.cos(a); s += Math.sin(a); }
  const R = Math.sqrt(c * c + s * s) / n, Z = n * R * R;
  // Approximation asymptotique classique du p (Zar, Biostatistical Analysis) ; suffisante au-delà de 40 événements.
  const p = Math.exp(-Z) * (1 + (2 * Z - Z * Z) / (4 * n) - (24 * Z - 132 * Z * Z + 76 * Z ** 3 - 9 * Z ** 4) / (288 * n * n));
  const meanPhase = (Math.atan2(s, c) / (2 * Math.PI) + 1) % 1;
  return { n, enough: true, R, p: Math.max(0, Math.min(1, p)), meanPhase };
}
export function lunarSection() {
  const r = lunarTest();
  if (!r.enough) return `<section><h3>${tr`Lune`}</h3><p class="hint">${trn(r.n, "Pas assez de matière pour un test honnête : {0} événement daté au lieu de {1} au moins. Reviens quand le corpus aura grandi.", "Pas assez de matière pour un test honnête : {0} événements datés au lieu de {1} au moins. Reviens quand le corpus aura grandi.", LUNAR_MIN_N)}</p></section>`;
  const sig = r.p < .05;
  return `<section><h3>${tr`Lune`}</h3><p class="hint">${trn(r.n, "Test de Rayleigh sur {0} événement daté : ta lune éclaire-t-elle vraiment ton activité, ou est-ce une histoire qu'on se raconte ? Un seul test compte ici ; le refaire ailleurs sous d'autres formes userait sa valeur (tests multiples).", "Test de Rayleigh sur {0} événements datés : ta lune éclaire-t-elle vraiment ton activité, ou est-ce une histoire qu'on se raconte ? Un seul test compte ici ; le refaire ailleurs sous d'autres formes userait sa valeur (tests multiples).")}</p>
    <p>${sig
      ? tr`Concentration autour de ${esc(moonName(r.meanPhase).toLowerCase())} (R = ${r.R.toFixed(2)}, p = ${r.p.toFixed(3)}). Ce n'est pas rien, mais ce n'est pas une preuve : une seule corrélation, jamais répétée ni contrôlée.`
      : tr`Rien de concentré (R = ${r.R.toFixed(2)}, p = ${r.p.toFixed(3)}) : la répartition ne se distingue pas de l'uniforme. La lune plaide non coupable, ce qui est aussi une réponse.`}</p></section>`;
}
