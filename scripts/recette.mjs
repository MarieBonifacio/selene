/* Le cahier de recette (docs/recette) tient-il debout ? Une vérification légère, sans réseau ni navigateur :
     - les cas manuels : identifiants uniques, au bon préfixe, jamais un identifiant retiré, tous les champs du format,
       la table de chaque fichier d'accord avec ses cas ;
     - le lien entre cas manuels et tests automatiques, dans les deux sens (docs/recette/automatises.md) ;
     - chaque test du dépôt (Node, navigateur, Deno, Rust) présent dans l'inventaire, et rien d'inventé ;
     - chaque lien relatif des documents de recette : le fichier existe, l'ancre aussi ;
     - les jeux de données : chaque sauvegarde s'importe (ou est refusée, pour les « refus-* »), chaque fichier est décrit.
   Usage : npm run recette            (vérifier ; code de sortie 1 au premier écart, tous listés)
           npm run recette -- donnees (écrire dist/recette/volume.json, le jeu de volume, voir docs/recette/donnees/README.md)
   Le script ne lit que le dépôt ; il n'exécute aucun test (il ne dit donc jamais qu'un test passe). */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { createBackup, parseBackup } from "../src/core/backup.js";
import { igPosts } from "../src/core/instagram.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REC = path.join(ROOT, "docs/recette");
const read = f => fs.readFileSync(f, "utf8");
const rel = f => path.relative(ROOT, f);
const problems = [];
const fail = (where, what) => problems.push(`${where} : ${what}`);

if (process.argv[2] === "donnees") { volume(); process.exit(0); }
if (process.argv[2] === "jeux") { await import("./recette-jeux.mjs"); process.exit(0); }

/* ---------- cas manuels ---------- */
// Les fichiers et leurs préfixes : la table du point d'entrée fait foi (docs/recette/README.md).
const readme = read(path.join(REC, "README.md"));
const FILES = [...readme.matchAll(/^\| \[[^\]]+\]\(manuels\/([a-z-]+\.md)\) \| `([A-Z]{3})` \|/gm)].map(m => ({ file: m[1], prefix: m[2] }));
if (!FILES.length) fail("docs/recette/README.md", "table des fichiers de cas introuvable");
const PLATFORMS = new Set(["Web", "Mob", "AND", "IOS", "WIN", "ART"]);
const FIELDS = ["**Fonctionnalité et règle**", "**Objectif, risque vérifié**", "**Priorité**", "**Plateformes**", "**Préconditions**",
  "**Données**", "**Automatisés associés**", "**Source**", "| Étape | Action précise | Résultat attendu observable |", "**État final attendu**", "**Nettoyage**"];
const AUTO_ID = /`(T[UNDRS]-[A-Za-z0-9][A-Za-z0-9-]*)`/g;
const manual = new Map(); // identifiant → { file, priority, autos: Set }
for (const { file, prefix } of FILES) {
  const f = path.join(REC, "manuels", file);
  if (!fs.existsSync(f)) { fail(rel(f), "fichier annoncé par le README, absent"); continue; }
  const text = read(f), where = rel(f);
  const retired = new Set((text.match(/^Identifiants retirés : (.*)$/m)?.[1] ?? "").match(/[A-Z]{3}-\d{3}/g) || []);
  if (!/^Identifiants retirés : /m.test(text)) fail(where, "ligne « Identifiants retirés : » absente");
  const listed = new Map([...text.matchAll(/^\| \[([A-Z]{3}-\d{3})\]\(#([a-z]{3}-\d{3})\) \| .* \| (P[123]) \| ([^|]+) \|$/gm)].map(m => [m[1], { anchor: m[2], priority: m[3], platforms: m[4].trim() }]));
  const blocks = text.split(/^(?=<a id="[a-z]{3}-\d{3}"><\/a>$)/m).slice(1);
  for (const block of blocks) {
    const anchor = block.match(/^<a id="([a-z]{3}-\d{3})"><\/a>/)[1], head = block.match(/^### ([A-Z]{3}-\d{3}) — (.+)$/m);
    if (!head) { fail(where, `ancre ${anchor} sans titre « ### ID — titre »`); continue; }
    const id = head[1], at = `${where} › ${id}`;
    if (anchor !== id.toLowerCase()) fail(at, `ancre « ${anchor} » différente de l'identifiant`);
    if (!id.startsWith(prefix + "-")) fail(at, `préfixe attendu ${prefix}`);
    if (manual.has(id)) fail(at, `identifiant déjà utilisé dans ${manual.get(id).file}`);
    if (retired.has(id)) fail(at, "identifiant retiré, réutilisé");
    for (const field of FIELDS) if (!block.includes(field)) fail(at, `champ manquant : ${field}`);
    const pr = block.match(/\*\*Priorité\*\* : (P[123]) · \*\*Plateformes\*\* : ([^\n]+)/);
    if (!pr) fail(at, "ligne « Priorité · Plateformes » illisible");
    else for (const p of pr[2].split(",").map(x => x.trim())) if (!PLATFORMS.has(p)) fail(at, `plateforme inconnue « ${p} »`);
    const steps = (block.match(/^\| \d+ \| /gm) || []).length;
    if (!steps) fail(at, "aucune étape numérotée");
    const autoLine = (block.match(/^- \*\*Automatisés associés\*\* : (.*)$/m)?.[1] ?? "");
    const autos = new Set([...autoLine.matchAll(AUTO_ID)].map(m => m[1]));
    if (!autos.size && !/^aucun/.test(autoLine)) fail(at, "« Automatisés associés » : ni identifiant, ni « aucun »");
    manual.set(id, { file, priority: pr && pr[1], autos });
    const row = listed.get(id);
    if (!row) fail(at, "absent de la table du fichier");
    else {
      if (pr && row.priority !== pr[1]) fail(at, `priorité ${pr[1]} dans le cas, ${row.priority} dans la table`);
      if (pr && row.platforms !== pr[2].trim()) fail(at, "plateformes différentes entre le cas et la table");
      listed.delete(id);
    }
  }
  for (const id of listed.keys()) fail(where, `${id} dans la table, sans cas`);
}

/* ---------- inventaire des tests automatiques ---------- */
const autoText = read(path.join(REC, "automatises.md"));
const retiredAutos = new Set((autoText.match(/^Identifiants retirés : (.*)$/m)?.[1] ?? "").match(/T[UNDRS]-[A-Za-z0-9-]+/g) || []);
if (!/^Identifiants retirés : /m.test(autoText)) fail("docs/recette/automatises.md", "ligne « Identifiants retirés : » absente");
const autos = new Map(); // identifiant → Set des cas manuels qu'il cite
for (const block of autoText.split(/(?=<a id="t[unrsd]-[a-z0-9-]+"><\/a>)/).slice(1)) {
  const id = (block.match(/`(T[UNDRS]-[A-Za-z0-9-]+)`/) || [])[1], own = block.split(/\n#{2,3} /)[0];
  if (!id) continue;
  if (autos.has(id)) fail("docs/recette/automatises.md", `${id} décrit deux fois`);
  if (retiredAutos.has(id)) fail("docs/recette/automatises.md", `${id} est retiré mais encore décrit`);
  const anchor = block.match(/^<a id="([^"]+)">/)[1];
  if (anchor !== id.toLowerCase()) fail("docs/recette/automatises.md", `ancre « ${anchor} » pour ${id}`);
  autos.set(id, new Set([...own.matchAll(/\[([A-Z]{3}-\d{3})\]\(manuels\//g)].map(m => m[1])));
}
for (const [id, m] of manual) for (const a of m.autos) {
  if (!autos.has(a)) fail(`${m.file} › ${id}`, `${a} absent de l'inventaire`);
  else if (!autos.get(a).has(id)) fail(`automatises.md › ${a}`, `ne cite pas ${id}, qui le cite`);
}
for (const [a, cases] of autos) for (const id of cases) {
  if (!manual.has(id)) fail(`automatises.md › ${a}`, `cite ${id}, qui n'existe pas`);
  else if (!manual.get(id).autos.has(a)) fail(`automatises.md › ${a}`, `cite ${id}, qui ne le cite pas`);
}
// Chaque test du dépôt a sa ligne ; un nom d'inventaire sans test serait une invention.
const listedName = name => autoText.includes(name) || autoText.includes(name.replace(/\|/g, "\\|"));
const testsDir = path.join(ROOT, "tests");
let nodeTests = 0;
for (const f of fs.readdirSync(testsDir).filter(x => x.endsWith(".test.js"))) {
  for (const m of read(path.join(testsDir, f)).matchAll(/^\s*test\((['"`])(.+?)\1/gm)) {
    nodeTests++;
    if (!listedName(m[2])) fail(`tests/${f}`, `test « ${m[2]} » absent de l'inventaire`);
  }
}
const browserDir = path.join(testsDir, "browser");
const scenarios = fs.readdirSync(browserDir).filter(x => x.endsWith(".js") && !["helpers.js", "run.js"].includes(x)).map(x => "TN-" + x.slice(0, -3));
for (const id of scenarios) if (!autos.has(id)) fail(`tests/browser/${id.slice(3)}.js`, `${id} absent de l'inventaire`);
for (const id of autos.keys()) if (id.startsWith("TN-") && !scenarios.includes(id)) fail("automatises.md", `${id} : aucun scénario de ce nom`);
const fnDir = path.join(ROOT, "supabase/functions");
let denoTests = 0;
for (const d of fs.readdirSync(fnDir).filter(x => fs.statSync(path.join(fnDir, x)).isDirectory())) {
  for (const f of fs.readdirSync(path.join(fnDir, d)).filter(x => x.endsWith("_test.ts"))) {
    for (const m of read(path.join(fnDir, d, f)).matchAll(/Deno\.test\((['"`])(.+?)\1/g)) {
      denoTests++;
      if (!listedName(m[2])) fail(`supabase/functions/${d}/${f}`, `test « ${m[2]} » absent de l'inventaire`);
    }
  }
}
const rust = read(path.join(ROOT, "native/tauri/src/main.rs"));
const rustTests = [...rust.matchAll(/#\[test\]\s*fn (\w+)/g)].map(m => m[1]);
for (const name of rustTests) if (!autoText.includes(`| ${name} |`)) fail("native/tauri/src/main.rs", `test ${name} absent de l'inventaire`);

/* ---------- matrice de traçabilité ---------- */
// Chaque cas y a sa ligne, une seule, avec les mêmes tests automatiques que le cas, et un état défini.
const COVERAGE = ["couvert automatiquement", "couvert partiellement", "documenté pour recette manuelle", "non couvert", "à clarifier", "hors périmètre"];
const matrix = read(path.join(REC, "matrice.md")), inMatrix = new Map();
for (const line of matrix.split("\n").filter(l => /^\| .* \| \[[A-Z]{3}-\d{3}\]\(manuels\//.test(l))) {
  const cells = line.split(" | "), id = cells[2].match(/\[([A-Z]{3}-\d{3})\]/)[1];
  if (inMatrix.has(id)) fail("docs/recette/matrice.md", `${id} : deux lignes`);
  inMatrix.set(id, true);
  if (!COVERAGE.includes(cells[4])) fail("docs/recette/matrice.md", `${id} : état « ${cells[4]} » inconnu`);
  const listedAutos = new Set([...cells[3].matchAll(/`(T[UNDRS]-[A-Za-z0-9-]+)`/g)].map(m => m[1])), own = manual.get(id);
  if (own && (listedAutos.size !== own.autos.size || [...own.autos].some(a => !listedAutos.has(a)))) fail("docs/recette/matrice.md", `${id} : tests automatiques différents de ceux du cas`);
}
for (const id of manual.keys()) if (!inMatrix.has(id)) fail("docs/recette/matrice.md", `${id} absent`);
for (const id of inMatrix.keys()) if (!manual.has(id)) fail("docs/recette/matrice.md", `${id} : aucun cas de ce nom`);

/* ---------- liens relatifs et ancres ---------- */
// L'ancre d'un titre telle que GitHub la calcule : minuscules, ponctuation retirée (lettres accentuées gardées),
// chaque espace devient un tiret ; un titre répété reçoit -1, -2…
const slug = h => h.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`/g, "").toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/ /g, "-");
const anchorsCache = new Map();
function anchorsOf(file) {
  if (anchorsCache.has(file)) return anchorsCache.get(file);
  const text = read(file), out = new Set([...text.matchAll(/<a id="([^"]+)"><\/a>/g)].map(m => m[1])), seen = new Map();
  let fence = false;
  for (const line of text.split("\n")) {
    if (/^```/.test(line)) fence = !fence;
    const h = !fence && line.match(/^#{1,6} (.+)$/);
    if (!h) continue;
    const s = slug(h[1]), n = seen.get(s) || 0;
    out.add(n ? `${s}-${n}` : s); seen.set(s, n + 1);
  }
  anchorsCache.set(file, out);
  return out;
}
const mdFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? mdFiles(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : []);
const docs = [...mdFiles(REC), path.join(ROOT, ".github/pull_request_template.md")].filter(f => fs.existsSync(f));
let links = 0;
for (const f of docs) {
  const text = read(f).replace(/^```[\s\S]*?^```/gm, "");
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    links++;
    const [p, hash] = target.split("#"), dest = p ? path.resolve(path.dirname(f), decodeURIComponent(p)) : f;
    if (!fs.existsSync(dest)) { fail(rel(f), `lien vers ${target} : fichier absent`); continue; }
    if (hash && dest.endsWith(".md") && !anchorsOf(dest).has(decodeURIComponent(hash))) fail(rel(f), `lien vers ${target} : ancre absente`);
  }
}

/* ---------- jeux de données ---------- */
const dataDir = path.join(REC, "donnees"), dataReadme = fs.existsSync(path.join(dataDir, "README.md")) ? read(path.join(dataDir, "README.md")) : "";
if (!dataReadme) fail("docs/recette/donnees", "README.md absent");
const dataFiles = fs.readdirSync(dataDir).filter(x => x.endsWith(".json"));
for (const name of dataFiles) {
  const where = `docs/recette/donnees/${name}`, text = read(path.join(dataDir, name));
  if (!dataReadme.includes(`(${name})`)) fail(where, "non décrit dans donnees/README.md");
  if (name.startsWith("instagram-")) {
    let posts = [];
    try { posts = igPosts(JSON.parse(text)); } catch (e) { fail(where, `illisible : ${e.message}`); continue; }
    if (!posts.length) fail(where, "aucune publication reconnue");
    continue;
  }
  let ok = true, error = "";
  try { parseBackup(text); } catch (e) { ok = false; error = e.message; }
  if (name.startsWith("refus-") && ok) fail(where, "devait être refusé à l'import, accepté");
  if (!name.startsWith("refus-") && !ok) fail(where, `refusé à l'import : ${error}`);
}

/* ---------- bilan ---------- */
console.log(`${manual.size} cas manuels dans ${FILES.length} fichiers ; ${autos.size} tests automatiques inventoriés ` +
  `(${nodeTests} Node, ${scenarios.length} navigateur, ${denoTests} Deno, ${rustTests.length} Rust dans le dépôt) ; ` +
  `${links} liens relatifs ; ${dataFiles.length} jeux de données.`);
if (problems.length) {
  console.log(`\n${problems.length} écart(s) :`);
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("Aucun écart.");

/* ---------- le jeu de volume ---------- */
/* Des années d'usage en un fichier : le jeu d'essai, plus 4 000 fragments dans Écriture et 1 500 notes dans la Boîte,
   datés du 1er janvier 2023 au 30 septembre 2026, assez lourd (plus de 3 Mo) pour l'alerte de taille. Le plus ancien
   fragment porte le mot unique « aulne-NAV006 ». Déterministe : le même fichier à chaque exécution. Non versionné
   (dist/ est ignoré par git) : on le régénère. */
function volume() {
  const backup = parseBackup(read(path.join(REC, "donnees/jeu-essai.json")));
  const site = backup.site, ecriture = site.modules.ecriture, inbox = site.modules.inbox;
  const cats = (ecriture.config.categories || []).map(c => c.id).filter(Boolean);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const words = "la lune le seuil une porte basse forêt nuit récit phalène lisière brume lichen mousse cendre miroir aulne hêtre sapin héron".split(" ");
  const vocab = Array.from({ length: 3000 }, (_, i) => "mot" + i.toString(36) + "é");
  const phrase = n => Array.from({ length: n }, () => rnd() < 0.05 ? words[Math.floor(rnd() * words.length)] : vocab[Math.floor(rnd() * vocab.length)]).join(" ");
  const start = Date.UTC(2023, 0, 1), span = Date.UTC(2026, 8, 30) - start;
  const day = i => new Date(start + Math.floor(span * i)).toISOString().slice(0, 10);
  for (let i = 0; i < 4000; i++) {
    const f = { id: `vol-f${i}`, text: (i === 0 ? "aulne-NAV006 : le plus ancien fragment du jeu de volume. " : "") + phrase(60 + (i % 40)), date: day(i / 4000) };
    if (cats.length) f.category = cats[i % cats.length];
    ecriture.scraps.push(f);
  }
  for (let i = 0; i < 1500; i++) inbox.entries.push({ id: `vol-n${i}`, text: phrase(25 + (i % 25)), date: day(i / 1500) });
  const text = createBackup(backup.board, site, "2026-10-04T12:00:00.000Z");
  parseBackup(text); // le fichier doit s'importer : sinon, il ne sert à rien
  const size = Buffer.byteLength(JSON.stringify(site));
  if (size < 3.1e6 || size > 4.6e6) throw new Error(`jeu de volume hors de la fourchette voulue (3,1 à 4,6 Mo) : ${size} octets`);
  const out = path.join(ROOT, "dist/recette/volume.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text + "\n");
  console.log(`${rel(out)} : ${(size / 1e6).toFixed(2)} Mo (document site), ${ecriture.scraps.length} fragments, ${inbox.entries.length} notes.`);
}
