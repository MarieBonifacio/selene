/* Mise en forme et petits calculs sans état : identifiants, dates ISO locales, écarts en jours, dates lisibles, « il
   y a… », sommes d'argent, pluriels, séries de jours. Dates et sommes suivent la langue de l'interface (i18n). */
import { uiLocale } from "../i18n/index.js";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
export const todayISO = () => iso(new Date());
export const addDaysTo = (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((new Date(a + "T12:00") - new Date(b + "T12:00")) / 86400000);
// Formater une date coûte cher (un formateur Intl reconstruit à chaque appel) et une liste de fragments en affiche
// des milliers : fonction pure, donc résultats gardés, dans une limite de taille. La langue fait partie de la clé.
const fmtCache = new Map();
export const fmt = (s, o = { day: "numeric", month: "short" }) => {
  if (!s) return "";
  const loc = uiLocale(), k = loc + s + JSON.stringify(o);
  let v = fmtCache.get(k);
  if (v === undefined) { v = new Date(s + "T12:00").toLocaleDateString(loc, o); if (fmtCache.size >= 5000) fmtCache.clear(); fmtCache.set(k, v); }
  return v;
};
export const ago = s => { if (!s) return "jamais"; const n = diffDays(todayISO(), s); return n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} j`; };
export const money = n => (+n || 0).toLocaleString(uiLocale(), { style: "currency", currency: "EUR" }); // la langue change la présentation, pas la monnaie
export function streakOf(dates) {
  const set = new Set(dates); let n = 0; const d = new Date();
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
