/* La lune de Selene : phase calculée (lunaison synodique), nom, dessin. */
import { N_, tr } from "../i18n/index.js";

/* Mois synodique moyen (d'une nouvelle lune à la suivante) et une nouvelle lune de référence. */
export const SYNODIC = 29.530588853, NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
const MOON_NAMES = [N_("Nouvelle lune"), N_("Premier croissant"), N_("Premier quartier"), N_("Gibbeuse croissante"), N_("Pleine lune"), N_("Gibbeuse décroissante"), N_("Dernier quartier"), N_("Dernier croissant")];
export const moonName = p => tr(MOON_NAMES[Math.floor(((p + 1 / 16) % 1) * 8)]);
export function moon() {
  const syn = SYNODIC, ref = NEW_MOON_REF;
  const age = (((Date.now() - ref) / 86400000) % syn + syn) % syn;
  const p = age / syn;
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const nextFull = p < .5 ? (0.5 - p) * syn : (1.5 - p) * syn;
  const nextNew = (1 - p) * syn;
  return { p, age, illum, name: moonName(p), nextFull: Math.round(nextFull), nextNew: Math.round(nextNew) };
}
export function moonSVG(p, size = 100) {
  const r = 46, c = 50, rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  let d;
  if (p < .5) d = `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${p < .25 ? 0 : 1} ${c},${c - r}Z`;
  else d = `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${p < .75 ? 0 : 1} ${c},${c - r}Z`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${tr`Phase de la lune`}"><circle cx="50" cy="50" r="${r}" fill="var(--moon-shadow)" stroke="var(--rule)" stroke-width=".8"/><path d="${d}" fill="var(--moon)"/></svg>`;
}
