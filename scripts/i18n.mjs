/* Les traductions, vérifiées (npm run i18n) : relève dans src/app chaque texte marqué pour la traduction, puis le
   confronte à chaque dictionnaire (src/app/i18n/). Lecture de l'arbre syntaxique (espree), pas d'expressions
   régulières : un tr`…` sur deux lignes ou dans une interpolation est trouvé comme les autres.
   - tr`texte ${x}` → « texte {0} » ; tr("texte"), N_("texte") → « texte » ; trp("ctx", "texte") → « ctx\u0004texte » ;
     trn(n, "une forme", "des formes") → pluriel rangé sous la forme singulière ;
   - échoue (code 1) sur : une traduction orpheline (son texte français a changé ou disparu : la retraduire), un type
     inattendu (pluriel contre texte simple), des valeurs {n} perdues ou inventées, un texte manquant dans une langue
     proposée (READY_LANGS), un trp, trn ou N_ dont le texte n'est pas écrit en toutes lettres ;
   - sinon, dit la couverture de chaque langue. `--missing` liste ce qui reste à traduire, avec son emplacement. */
import { parse } from "espree";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const APP = path.join(root, "src", "app"), I18N = path.join(APP, "i18n");
const { LANGS, READY_LANGS } = await import(pathToFileURL(path.join(I18N, "index.js")).href);

const files = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? (p === I18N ? [] : files(p)) : e.name.endsWith(".js") ? [p] : [];
});
const used = new Map(), errors = []; // clé → { plural, forms, where: [fichier:ligne…] }
const text = node => node && node.type === "Literal" && typeof node.value === "string" ? node.value
  : node && node.type === "TemplateLiteral" && !node.expressions.length ? node.quasis[0].value.cooked : null;
function note(key, where, plural = null) {
  const u = used.get(key);
  if (!u) return used.set(key, { plural, where: [where] });
  if (!!u.plural !== !!plural) errors.push(`${where} : « ${key} » sert à la fois de texte simple et de pluriel`);
  u.where.push(where);
}
function visit(node, where) {
  if (!node || typeof node.type !== "string") return;
  const at = () => `${where}:${node.loc.start.line}`;
  if (node.type === "TaggedTemplateExpression" && node.tag.type === "Identifier" && node.tag.name === "tr")
    note(node.quasi.quasis.map(q => q.value.cooked).reduce((k, p, i) => k + "{" + (i - 1) + "}" + p), at());
  if (node.type === "CallExpression" && node.callee.type === "Identifier") {
    const [a, b, c] = node.arguments, name = node.callee.name;
    if (name === "tr" && text(a) != null) note(text(a), at()); // tr(variable) : une clé marquée ailleurs par N_
    if (name === "N_") { if (text(a) == null) errors.push(`${at()} : N_ attend un texte écrit en toutes lettres`); else note(text(a), at()); }
    if (name === "trp") { if (text(a) == null || text(b) == null) errors.push(`${at()} : trp attend un contexte et un texte écrits en toutes lettres`); else note(text(a) + "\u0004" + text(b), at()); }
    if (name === "trn") { if (text(b) == null || text(c) == null) errors.push(`${at()} : trn attend ses deux formes écrites en toutes lettres`); else note(text(b), at(), { one: text(b), other: text(c) }); }
  }
  for (const [k, v] of Object.entries(node)) if (k !== "loc" && k !== "range" && v && typeof v === "object") (Array.isArray(v) ? v : [v]).forEach(x => visit(x, where));
}
for (const f of files(APP)) {
  const ast = parse(fs.readFileSync(f, "utf8"), { ecmaVersion: "latest", sourceType: "module", loc: true });
  visit(ast, path.relative(root, f).split(path.sep).join("/"));
}

const holes = s => [...new Set(String(s).match(/\{\d+\}/g) || [])].sort().join(" ");
const shown = k => k.replace("\u0004", " ▸ ");
const report = [], missingList = [];
for (const [code, L] of Object.entries(LANGS)) {
  if (!L.dict) continue; // le français (la source) et la pseudo-langue n'ont pas de dictionnaire
  const dict = L.dict, missing = [];
  for (const [key, u] of used) {
    if (!Object.hasOwn(dict, key)) { missing.push(key); continue; }
    const v = dict[key];
    if (u.plural) {
      if (!v || typeof v !== "object" || typeof v.other !== "string") { errors.push(`${code} : « ${shown(key)} » est un pluriel : { one, other… } attendu`); continue; }
      const allowed = new Set([...holes(u.plural.one).split(" "), ...holes(u.plural.other).split(" ")].filter(Boolean));
      for (const [cat, form] of Object.entries(v)) {
        if (!["zero", "one", "two", "few", "many", "other"].includes(cat) || typeof form !== "string") errors.push(`${code} : « ${shown(key)} », forme « ${cat} » inconnue`);
        else if (holes(form).split(" ").some(h => h && !allowed.has(h))) errors.push(`${code} : « ${shown(key)} », forme « ${cat} » : une valeur {n} inventée`);
      }
    } else if (typeof v !== "string") errors.push(`${code} : « ${shown(key)} » est un texte simple : une chaîne attendue`);
    else if (holes(v) !== holes(key)) errors.push(`${code} : « ${shown(key)} » → « ${v} » : les valeurs {n} ne correspondent pas (${holes(key) || "aucune"} contre ${holes(v) || "aucune"})`);
  }
  for (const key of Object.keys(dict)) if (!used.has(key)) errors.push(`${code} : traduction orpheline « ${shown(key)} » (texte français changé ou disparu)`);
  if (READY_LANGS.includes(code) && missing.length) errors.push(`${code} est proposée (READY_LANGS) mais ${missing.length} texte(s) n'y sont pas traduits`);
  const n = used.size, done = n - missing.length;
  report.push(`  ${code} : ${done}/${n} traduits (${n ? Math.floor(100 * done / n) : 100} %)${READY_LANGS.includes(code) ? ", proposée" : ""}`);
  for (const key of missing) missingList.push(`  ${code} ← « ${shown(key)} »  (${used.get(key).where[0]})`);
}

process.stdout.write(`i18n : ${used.size} textes marqués dans src/app\n${report.join("\n")}\n`);
if (process.argv.includes("--missing") && missingList.length) process.stdout.write("À traduire :\n" + missingList.join("\n") + "\n");
if (errors.length) { process.stderr.write("\n" + errors.join("\n") + "\n"); process.exitCode = 1; }
