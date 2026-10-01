/* Les langues de l'interface. Le français est la langue source : ses textes, écrits dans le code, servent de clés
   (comme gettext) ; une autre langue les traduit dans son dictionnaire (en.js), et ce qu'il ne traduit pas encore
   reste en français (repli). Aussi : la langue en vigueur, et ce qui en dépend hors des mots (dates, nombres, tri).
   Les noms tr, trp, trn et N_ sont réservés : aucune variable de src/app ne les reprend (tests/i18n.test.js), sinon
   un tr`…` écrit dans sa portée appellerait autre chose. Méthode, règles et étapes : docs/i18n.md. */
import en from "./en.js";

/* name : l'endonyme (le nom que la langue se donne), affiché dans le sélecteur ; frName : son nom en français, pour la
   consigne de l'assistant ; tag : l'attribut lang de la page (BCP 47) ; locale : les conventions de formatage (dates,
   nombres, tri), fixées par langue et non par appareil : une même personne voit les mêmes formats partout. */
export const LANGS = {
  fr: { name: "Français", frName: "français", tag: "fr", locale: "fr-FR", dict: null },
  en: { name: "English", frName: "anglais", tag: "en", locale: "en-GB", dict: en },
  /* Pseudo-langue de contrôle (qps : la plage « usage privé » de BCP 47, comme qps-ploc chez Microsoft). Chaque texte
     passé par tr() s'y affiche accentué, allongé d'un tiers et entre ⟦ ⟧ : un texte resté nu à l'écran a échappé à la
     traduction, un texte coupé manquera de place dans une langue plus longue. Jamais proposée dans les Réglages. */
  qps: { name: "Pseudo", frName: "français", tag: "qps-ploc", locale: "fr-FR", dict: null, pseudo: true }
};
/* Les langues proposées : celles dont le dictionnaire est complet (npm run i18n refuse d'en proposer une à qui il
   manque un texte). Une langue ajoutée à LANGS attend ici son dernier texte traduit. */
export const READY_LANGS = ["fr", "en"];

/* La langue en vigueur : celle choisie dans les Réglages (config.lang) si elle est proposée, sinon la première langue
   proposée parmi celles de l'appareil (navigator.languages, par ordre de préférence), sinon le français. */
export function resolveLang(pref, device = [], ready = READY_LANGS) {
  if (pref === "qps" || ready.includes(pref)) return pref;
  for (const tag of device) { const base = String(tag || "").toLowerCase().split("-")[0]; if (ready.includes(base)) return base; }
  return "fr";
}
let lang = "fr", collator = null, frRules = null, rules = null;
export const uiLang = () => lang;
export const uiLocale = () => LANGS[lang].locale;
/* Appelée à chaque rendu (render.js) avec config.lang : ne fait quelque chose que si la langue change. Rend vrai alors. */
export function applyLang(pref, ready = READY_LANGS) {
  let device = [];
  try { device = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]; } catch {}
  const next = resolveLang(pref, device, ready);
  if (next === lang) return false;
  lang = next; collator = null; rules = null;
  try { document.documentElement.lang = LANGS[lang].tag; } catch {} // lecteurs d'écran, césure, correcteur des champs
  return true;
}

const ACCENTS = { a: "à", c: "ç", e: "é", i: "ï", n: "ñ", o: "ô", u: "ü", y: "ÿ", A: "Å", C: "Ç", E: "É", I: "Ï", N: "Ñ", O: "Ö", U: "Û", Y: "Ý" };
const pseudo = s => "⟦" + s.replace(/[a-zA-Z]/g, c => ACCENTS[c] || c) + "·".repeat(Math.ceil(s.length / 3)) + "⟧";
// {0}, {1}… : les valeurs, dans l'ordre du texte français ; une traduction peut les déplacer. Un seul passage : une
// valeur qui contiendrait elle-même « {1} » n'est pas remplacée à son tour.
const fill = (tpl, vals) => tpl.replace(/\{(\d+)\}/g, (m, i) => i < vals.length ? String(vals[i]) : m);
function translate(key, source, vals) {
  const L = LANGS[lang], d = L.dict, v = d && Object.hasOwn(d, key) && typeof d[key] === "string" ? d[key] : source;
  return fill(L.pseudo ? pseudo(v) : v, vals);
}
/* tr`Pleine lune dans ${n} j.` : la clé est le texte français, chaque valeur y devenant {0}, {1}… (ici « Pleine lune
   dans {0} j. »). tr("texte") pour une clé venue d'une table marquée par N_. Le résultat a le statut du texte qu'il
   remplace : ce qui vient de la personne s'échappe (esc) avant d'entrer, comme avant. Le nom vient de Qt (tr). */
export function tr(parts, ...vals) {
  const key = typeof parts === "string" ? parts : parts.reduce((k, p, i) => k + "{" + (i - 1) + "}" + p);
  return translate(key, key, vals);
}
/* trp("formulaire", "Annuler") : un même texte français qui se traduit autrement selon l'endroit (« Annuler » : Cancel
   dans un formulaire, Undo après une suppression). Clé : contexte, U+0004, texte, la convention de gettext (msgctxt). */
export const trp = (ctx, text, ...vals) => translate(ctx + "\u0004" + text, text, vals);
/* trn(n, "{0} fragment", "{0} fragments") : la forme qui convient à n. Les catégories viennent du CLDR, par
   Intl.PluralRules (one, few, many, other…) : en français, 0 est au singulier, en anglais au pluriel ; le polonais en a
   quatre. Traduction : un objet { one, other… } rangé sous la forme singulière française. Sans traduction, les règles
   françaises choisissent entre les deux formes françaises. {0} est n ; les valeurs suivantes, {1}, {2}… */
export function trn(n, one, other, ...vals) {
  const L = LANGS[lang], d = L.dict, forms = d && Object.hasOwn(d, one) && typeof d[one] === "object" ? d[one] : null;
  let form;
  if (forms) { if (!rules) rules = new Intl.PluralRules(L.locale); form = forms[rules.select(n)] ?? forms.other; }
  else { if (!frRules) frRules = new Intl.PluralRules("fr-FR"); form = frRules.select(n) === "one" ? one : other; }
  return fill(L.pseudo ? pseudo(form) : form, [n, ...vals]);
}
/* N_("Pleine lune") : marque un texte à traduire sans le traduire tout de suite (une table évaluée une fois, au
   chargement, et traduite à l'affichage par tr(…)). Le nom vient de gettext (gettext_noop). */
export const N_ = s => s;
/* Un texte enregistré dans la langue du moment (une provenance : « Dehors », « Veille »…) se reconnaît ensuite quelle
   que soit la langue : le français, sa traduction dans chaque dictionnaire, ou sa pseudo-traduction. */
export const sameText = (key, s) => s === key || s === pseudo(key) || Object.values(LANGS).some(l => l.dict && l.dict[key] === s);
/* Tri alphabétique dans la langue en vigueur (« é » avec « e », « œ » avec « oe ») : un seul Intl.Collator, gardé
   (localeCompare en construit un par comparaison). */
export function collate(a, b) {
  if (!collator) collator = new Intl.Collator(uiLocale());
  return collator.compare(a, b);
}
/* Le sélecteur des Réglages : « langue de l'appareil » (valeur vide), puis chaque langue proposée, sous son propre nom. */
export const langChoices = () => READY_LANGS.map(k => [k, LANGS[k].name]);
