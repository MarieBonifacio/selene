/* Mise en forme et petits calculs sans état : identifiants, dates ISO locales, écarts en jours, dates lisibles, « il
   y a… », sommes d'argent, pluriels, séries de jours. Dates et sommes suivent la langue de l'interface (i18n). */
import { tr, uiLocale } from "../i18n/index.js";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
export const todayISO = () => iso(new Date());
export const addDaysTo = (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((new Date(a + "T12:00") - new Date(b + "T12:00")) / 86400000);
// Formater une date coûte cher (un formateur Intl reconstruit à chaque appel) et une liste de fragments en affiche
// des milliers : fonction pure, donc résultats gardés, dans une limite de taille. La langue fait partie de la clé.
const fmtCache = new Map();
/* En français, le premier du mois s'écrit « 1er » (« 1er septembre », « 1er sept. ») : Intl donne « 1 septembre ». Seulement
   avec un mois en lettres : « 01/09 » reste « 01/09 ». */
function dateText(s, loc, o) {
  const d = new Date(s + "T12:00");
  if (d.getDate() !== 1 || !/^fr/i.test(loc) || (o.month !== "long" && o.month !== "short")) return d.toLocaleDateString(loc, o);
  return new Intl.DateTimeFormat(loc, o).formatToParts(d).map(p => p.type === "day" ? "1er" : p.value).join("");
}
export const fmt = (s, o = { day: "numeric", month: "short" }) => {
  if (!s) return "";
  const loc = uiLocale(), k = loc + s + JSON.stringify(o);
  let v = fmtCache.get(k);
  if (v === undefined) { v = dateText(s, loc, o); if (fmtCache.size >= 5000) fmtCache.clear(); fmtCache.set(k, v); }
  return v;
};
export const ago = s => { if (!s) return tr`jamais`; const n = diffDays(todayISO(), s); return n === 0 ? tr`aujourd'hui` : n === 1 ? tr`hier` : tr`il y a ${n} j`; };
export const money = n => (+n || 0).toLocaleString(uiLocale(), { style: "currency", currency: "EUR" }); // la langue change la présentation, pas la monnaie
export function streakOf(dates) {
  const set = new Set(dates); let n = 0; const d = new Date();
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
/* Un nombre et un mot choisi par la personne (« fragment », d'après son libellé « Fragments ») : le « s » est sa
   morphologie à elle ; seul le moment de l'ajouter suit les règles de pluriel de la langue de l'interface (en
   français, 0 et 1 au singulier ; en anglais, 0 au pluriel). Les textes de Selene, eux, passent par trn. */
const pluralRules = new Map();
export const plural = (n, word) => {
  const loc = uiLocale(); if (!pluralRules.has(loc)) pluralRules.set(loc, new Intl.PluralRules(loc));
  return `${n} ${word}${pluralRules.get(loc).select(n) === "one" ? "" : "s"}`;
};
