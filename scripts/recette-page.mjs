/* Le cahier de recette en une seule page HTML (npm run recette -- page) : dist/recette/cahier.html, à publier en
   artefact pour le lire sans le dépôt. La page est une vue : le cahier fait foi dans docs/recette/.
   Sans dépendance : un convertisseur Markdown réduit aux constructions que le cahier emploie (titres, paragraphes,
   listes, tableaux, citations, blocs de code, filets ; liens, gras, italique, code, barré). Tout le HTML du texte est
   échappé, sauf les ancres <a id="…"></a> : le cahier cite des pièges d'injection, qui doivent rester du texte. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REC = path.join(ROOT, "docs/recette");
const REPO = "https://github.com/MarieBonifacio/selene";
const OUT = path.join(ROOT, "dist/recette/cahier.html");
const read = f => fs.readFileSync(f, "utf8");
const git = args => { try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return ""; } };
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- les documents, dans l'ordre de lecture ---------- */
// Les cas manuels dans l'ordre de la table du point d'entrée (README.md), qui fait foi comme pour npm run recette.
const readme = read(path.join(REC, "README.md"));
const manuels = [...readme.matchAll(/^\| \[[^\]]+\]\((manuels\/[^)]+\.md)\) \| `[A-Z]{3}` \|/gm)].map(m => m[1]);
const comptes = fs.readdirSync(path.join(REC, "comptes-rendus")).filter(f => f.endsWith(".md") && f !== "modele.md").sort().reverse();
const ORDER = [
  ["Le cahier", ["README.md", "perimetre.md", "campagnes.md"]],
  ["Cas manuels", manuels],
  ["Tests automatiques", ["automatises.md", "matrice.md"]],
  ["Pilotage", ["backlog.md", "maintenance.md", "donnees/README.md"]],
  ["Comptes rendus", [...comptes.map(f => `comptes-rendus/${f}`), "comptes-rendus/modele.md"]]
];
const listed = new Set(ORDER.flatMap(([, fs]) => fs));
const all = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? all(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.relative(REC, path.join(dir, e.name))] : []);
// Un document nouveau n'est jamais oublié ; les notes des jeux de données (donnees/coffre-markdown/) sont des données.
const strays = all(REC).filter(f => !listed.has(f) && !f.startsWith("donnees/")).sort();
if (strays.length) ORDER.push(["Autres", strays]);

// L'identifiant de section d'un document : son chemin, sans extension ni barre.
const keyOf = rel => rel === "README.md" ? "accueil" : rel.replace(/\/README\.md$/, "").replace(/\.md$/, "").replace(/\//g, "-");
const titleOf = rel => { const m = read(path.join(REC, rel)).match(/^# (.+)$/m); return m ? m[1] : rel; };
// Un titre de navigation court : sans « Compte rendu — », sans « de Selene ».
const navTitle = rel => rel === "README.md" ? "Accueil" : titleOf(rel).replace(/^Compte rendu — /, "").replace(/ de Selene$/, "");

/* ---------- ancres ---------- */
// L'ancre d'un titre telle que GitHub la calcule (même règle que scripts/recette.mjs) : les liens du cahier la visent.
const slug = h => h.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`/g, "").toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/ /g, "-");
// Les ancres écrites à la main (<a id="rlm-023"></a>) gardent leur nom dans la page quand il est unique.
const owner = new Map();
for (const rel of ORDER.flatMap(([, fs]) => fs)) for (const m of read(path.join(REC, rel)).matchAll(/<a id="([^"]+)"><\/a>/g)) if (!owner.has(m[1])) owner.set(m[1], rel);
const anchorId = (rel, id) => owner.get(id) === rel ? id : `${keyOf(rel)}--${id}`;
const targetId = (rel, frag) => owner.get(frag) === rel ? frag : `${keyOf(rel)}--${frag}`;

/* ---------- liens ---------- */
function href(raw, from) {
  if (/^(https?:|mailto:)/.test(raw)) return { url: raw, out: true };
  const [p, frag = ""] = raw.split("#");
  const hash = decodeURIComponent(frag);
  if (!p) return { url: "#" + targetId(from, hash) };
  const abs = path.resolve(path.dirname(path.join(REC, from)), decodeURIComponent(p));
  const inRec = abs.startsWith(REC + path.sep) || abs === REC;
  if (inRec && fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const first = ORDER.flatMap(([, fs]) => fs).find(f => path.join(REC, f).startsWith(abs + path.sep));
    if (first) return { url: "#" + keyOf(first) };
  }
  if (inRec && abs.endsWith(".md") && listed.has(path.relative(REC, abs)) || strays.includes(path.relative(REC, abs))) {
    const rel = path.relative(REC, abs);
    return { url: "#" + (hash ? targetId(rel, hash) : keyOf(rel)) };
  }
  // Le reste du dépôt (code, tests, jeux de données, autre documentation) : sur GitHub.
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  const kind = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? "tree" : "blob";
  return { url: `${REPO}/${kind}/main/${rel}${frag ? "#" + frag : ""}`, out: true };
}

/* ---------- texte en ligne ---------- */
function inline(text, from) {
  const keep = [];
  const hold = html => `\u0000${keep.push(html) - 1}\u0000`;
  let s = text
    .replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`))
    .replace(/<a id="([^"]+)"><\/a>/g, (_, id) => hold(`<span class="anchor" id="${esc(anchorId(from, id))}"></span>`))
    .replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => hold(`<a href="${esc(u)}" rel="noopener">${esc(u)}</a>`));
  s = esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
      const { url, out } = href(h.replace(/&amp;/g, "&"), from);
      return `<a href="${esc(url)}"${out ? ' rel="noopener"' : ""}>${t}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => keep[+n]);
}

/* ---------- blocs ---------- */
const STATES = { "couvert automatiquement": "auto", "couvert partiellement": "partiel", "documenté pour recette manuelle": "manuel", "non couvert": "non", "à clarifier": "clarifier", "hors périmètre": "hors" };
function cellsOf(row) {
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let k = 0; k < s.length; k++) {
    if (s[k] === "\\" && s[k + 1] === "|") { cur += "|"; k++; continue; }
    if (s[k] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += s[k];
  }
  cells.push(cur.trim());
  return cells;
}
function cell(c, from, tag) {
  if (tag === "td" && Object.hasOwn(STATES, c)) return `<td><span class="state st-${STATES[c]}">${esc(c)}</span></td>`;
  if (tag === "td" && /^P[123]$/.test(c)) return `<td><span class="prio prio-${c[1]}">${c}</span></td>`;
  return `<${tag}>${inline(c, from)}</${tag}>`;
}
function table(rows, from) {
  const head = cellsOf(rows[0]), body = rows.slice(/^[\s|:-]+$/.test(rows[1] || "") ? 2 : 1).map(cellsOf);
  const thead = head.some(Boolean) ? `<thead><tr>${head.map(c => cell(c, from, "th")).join("")}</tr></thead>` : "";
  const wide = head.length >= 5 ? " wide" : "";
  return `<div class="tw"><table class="t${wide}">${thead}<tbody>${body.map(r => `<tr>${r.map(c => cell(c, from, "td")).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function list(lines, from) {
  const items = [];
  for (const l of lines) {
    const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (m) items.push({ ind: m[1].length, ord: /\d/.test(m[2]), start: parseInt(m[2], 10), text: m[3], kids: [] });
    else if (items.length) items[items.length - 1].text += " " + l.trim();
  }
  const root = { ind: -1, kids: [] }, stack = [root];
  for (const it of items) {
    while (stack.length > 1 && it.ind <= stack[stack.length - 1].ind) stack.pop();
    stack[stack.length - 1].kids.push(it); stack.push(it);
  }
  const render = arr => {
    if (!arr.length) return "";
    const tag = arr[0].ord ? "ol" : "ul", start = arr[0].ord && arr[0].start !== 1 ? ` start="${arr[0].start}"` : "";
    return `<${tag}${start}>${arr.map(it => `<li>${inline(it.text, from)}${render(it.kids)}</li>`).join("")}</${tag}>`;
  };
  return render(root.kids);
}
// Un titre de cas, de test ou d'élément du backlog : l'identifiant d'abord, en chasse fixe.
const headingHtml = (t, from) => {
  const m = t.match(/^([A-Z]{2,3}-[A-Za-z0-9-]+) — (.+)$/);
  return m ? `<span class="cid">${esc(m[1])}</span> <span class="ctitle">${inline(m[2], from)}</span>` : inline(t, from);
};
function render(rel) {
  const lines = read(path.join(REC, rel)).replace(/\r/g, "").split("\n"), out = [], seen = new Map();
  const isTable = l => /^\s*\|/.test(l), isList = l => /^\s*([-*]|\d+\.)\s+\S/.test(l);
  const isBreak = l => /^(#{1,6} |```|>|---+\s*$)/.test(l) || isTable(l) || isList(l) || /^<a id="[^"]+"><\/a>\s*$/.test(l.trim());
  let i = 0, first = true;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre class="code"><code>${esc(buf.join("\n"))}</code></pre>`); continue;
    }
    const h = l.match(/^(#{1,6}) (.+)$/);
    if (h) {
      const s = slug(h[2]), n = seen.get(s) || 0, id = n ? `${s}-${n}` : s; seen.set(s, n + 1);
      // Le titre du point d'entrée est déjà celui de la page : il n'est pas répété.
      if (!(first && rel === "README.md" && h[1] === "#")) out.push(`<h${h[1].length} id="${esc(`${keyOf(rel)}--${id}`)}">${headingHtml(h[2], rel)}</h${h[1].length}>`);
      first = false; i++; continue;
    }
    if (/^<a id="[^"]+"><\/a>\s*$/.test(l.trim())) { out.push(inline(l.trim(), rel)); i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${inline(buf.join(" "), rel)}</p></blockquote>`); continue;
    }
    if (isTable(l)) { const rows = []; while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]); out.push(table(rows, rel)); continue; }
    if (isList(l)) {
      const buf = [];
      while (i < lines.length && lines[i].trim() && (isList(lines[i]) || /^\s+\S/.test(lines[i]))) buf.push(lines[i++]);
      out.push(list(buf, rel)); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && (!buf.length || !isBreak(lines[i]))) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(" "), rel)}</p>`);
  }
  return out.join("\n");
}

/* ---------- chiffres de tête ---------- */
const manualText = manuels.map(f => read(path.join(REC, f))).join("\n");
const cases = [...manualText.matchAll(/^### ([A-Z]{3}-\d{3}) — (.+)$/gm)];
const autoText = read(path.join(REC, "automatises.md"));
const tests = [...autoText.matchAll(/<a id="(t[undrs]-[^"]+)"><\/a>(?:`([^`]+)`)?/g)];
const backlog = [...read(path.join(REC, "backlog.md")).matchAll(/^### (BL-\d+) — (.+)$/gm)];
const anomalies = [...read(path.join(REC, "perimetre.md")).matchAll(/^\| (A\d+) \|/gm)].length;
const decompte = (read(path.join(REC, "matrice.md")).match(/\*\*Décompte des (\d+) cas manuels\*\* : ([^\n]+)/) || [])[2] || "";
const parts = [...decompte.matchAll(/(\d+) ([^,.]+)/g)].map(m => ({ n: +m[1], label: m[2].trim() }));
const commit = git(["rev-parse", "--short", "HEAD"]) || "inconnu";
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "";
const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).replace(/^1 /, "1er ");

// La liste « Aller à » : les cas, les tests et les éléments du backlog, chacun avec son ancre.
const jump = [
  ...cases.map(m => [m[1].toLowerCase(), `${m[1]} — ${m[2]}`]),
  ...tests.map(m => [m[1], m[2] || m[1].toUpperCase()]),
  ...backlog.map(m => [m[1].toLowerCase(), `${m[1]} — ${m[2]}`])
].filter(([id]) => owner.has(id)).map(([id, label]) => [anchorId(owner.get(id), id), label.replace(/`/g, "")]);

/* ---------- la page ---------- */
const nav = ORDER.map(([group, files]) => `<li class="grp"><span class="grp-t">${esc(group)}</span><ul>${files.map(f => {
  const n = group === "Cas manuels" ? (read(path.join(REC, f)).match(/^### [A-Z]{3}-\d{3} — /gm) || []).length : 0;
  return `<li><a href="#${keyOf(f)}" data-sec="${keyOf(f)}">${esc(navTitle(f))}${n ? ` <span class="n">${n}</span>` : ""}</a></li>`;
}).join("")}</ul></li>`).join("");
const sections = ORDER.flatMap(([, files]) => files).map(f =>
  `<section class="doc" id="${keyOf(f)}"><p class="path">docs/recette/${esc(f)} · <a href="${REPO}/blob/main/docs/recette/${esc(f)}" rel="noopener">voir sur GitHub</a></p>\n${render(f)}\n</section>`).join("\n");
const chips = parts.map(p => `<li class="chip"><span class="state st-${STATES[p.label] || "manuel"}">${p.n}</span> ${esc(p.label)}</li>`).join("");

const html = `<title>Cahier de recette Selene</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Spectral+SC:wght@500&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap">
<style>
/* Mise en page : un sommaire fixe à gauche sur ordinateur, replié en tête sur téléphone ; le texte à 72 caractères,
   les tableaux sur toute la largeur, chacun défilant dans son cadre. Palette et voix : celles de Selene (src/shell.html). */
:root{
  --bg:#e2e6de; --surface:#edf0e9; --surface-2:#f4f2ea; --ink:#1a211b; --ink-2:#394237; --muted:#5b6859;
  --rule:#c1c9bc; --rule-strong:#75816f; --accent:#3d6a45; --ok:#2f6f62; --warn:#7d5a12; --alarm:#a8431f; --info:#3f5d78;
  --hl:rgba(61,106,69,.13);
  --f-display:"Cormorant Garamond",Georgia,serif; --f-text:"Spectral",Georgia,"Times New Roman",serif;
  --f-label:"Spectral SC","Spectral",Georgia,serif; --f-ui:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0e1310; --surface:#151c17; --surface-2:#1a231d; --ink:#dde2d6; --ink-2:#b4bdb0; --muted:#8c998a;
  --rule:#243029; --rule-strong:#56665a; --accent:#8fbf86; --ok:#6fb3a2; --warn:#d2a24c; --alarm:#e5785a; --info:#8fa9c0;
  --hl:rgba(143,191,134,.14); color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0e1310; --surface:#151c17; --surface-2:#1a231d; --ink:#dde2d6; --ink-2:#b4bdb0; --muted:#8c998a;
  --rule:#243029; --rule-strong:#56665a; --accent:#8fbf86; --ok:#6fb3a2; --warn:#d2a24c; --alarm:#e5785a; --info:#8fa9c0;
  --hl:rgba(143,191,134,.14); color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--f-text);font-size:16.5px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:2px}
a:focus-visible,summary:focus-visible,input:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.shell{display:grid;grid-template-columns:minmax(0,1fr);gap:0;padding-inline:16px;max-width:1320px;margin:0 auto}
@media (min-width:980px){.shell{grid-template-columns:270px minmax(0,1fr);gap:40px;padding-inline:28px}}
/* Sommaire */
.side{padding-block:18px 8px}
@media (min-width:980px){.side{position:sticky;top:env(safe-area-inset-top,0px);height:100vh;overflow-y:auto;padding-block:28px}}
.brand{font-family:var(--f-label);text-transform:lowercase;letter-spacing:.07em;color:var(--muted);font-size:.95rem;margin:0 0 12px}
.jump{display:flex;gap:6px;margin:0 0 14px}
.jump input{flex:1;min-width:0;font:inherit;font-family:var(--f-ui);font-size:.88rem;padding:7px 9px;border:1px solid var(--rule-strong);border-radius:3px;background:var(--surface-2);color:var(--ink)}
.jump button{font-family:var(--f-ui);font-size:.85rem;padding:7px 11px;border:1px solid var(--rule-strong);border-radius:3px;background:var(--surface);color:var(--ink);cursor:pointer}
.jump-msg{font-family:var(--f-ui);font-size:.8rem;color:var(--alarm);margin:-8px 0 12px;min-height:1em}
details.toc>summary{font-family:var(--f-ui);font-size:.9rem;color:var(--ink-2);cursor:pointer;padding:6px 0}
@media (min-width:980px){details.toc>summary{display:none}}
.toc ul{list-style:none;margin:0;padding:0}
.toc .grp{margin:0 0 14px}
.toc .grp-t{display:block;font-family:var(--f-label);text-transform:lowercase;letter-spacing:.06em;color:var(--muted);font-size:.9rem;margin:0 0 3px}
.toc a{display:flex;justify-content:space-between;gap:8px;font-family:var(--f-ui);font-size:.86rem;line-height:1.35;color:var(--ink-2);text-decoration:none;padding:4px 8px;border-left:2px solid transparent}
.toc a:hover{color:var(--ink);background:var(--surface)}
.toc a.on{color:var(--ink);background:var(--surface);border-left-color:var(--accent)}
.toc .n{font-variant-numeric:tabular-nums;color:var(--muted);font-size:.8rem}
/* En-tête */
main{min-width:0;padding-block:18px 64px}
@media (min-width:980px){main{padding-block:34px 80px}}
.mast{border-bottom:1px solid var(--rule-strong);padding-bottom:20px;margin-bottom:8px}
.mast .eyebrow{font-family:var(--f-label);text-transform:lowercase;letter-spacing:.08em;color:var(--muted);margin:0 0 6px;font-size:.95rem}
.mast h1{font-family:var(--f-display);font-weight:600;font-size:clamp(2.2rem,5vw,3.3rem);line-height:1;margin:0 0 12px;text-wrap:balance}
.mast .meta{font-family:var(--f-ui);font-size:.88rem;color:var(--ink-2);margin:0 0 14px;font-variant-numeric:tabular-nums}
.mast .meta code{font-size:.85rem}
.mast .note{font-size:.95rem;color:var(--ink-2);max-width:72ch;margin:0 0 14px}
.chips{display:flex;flex-wrap:wrap;gap:8px 14px;list-style:none;margin:0;padding:0;font-family:var(--f-ui);font-size:.85rem;color:var(--ink-2)}
.chip{display:flex;align-items:center;gap:6px}
/* Documents */
.doc{padding-top:26px;border-top:1px solid var(--rule);margin-top:34px}
.doc:first-of-type{border-top:0;margin-top:6px}
.path{font-family:var(--f-mono);font-size:.76rem;color:var(--muted);margin:0 0 4px;overflow-wrap:anywhere}
.path a{color:var(--muted)}
.doc h1,.doc h2,.doc h3,.doc h4{font-family:var(--f-display);font-weight:600;line-height:1.1;text-wrap:balance;scroll-margin-top:16px;margin:1.5em 0 .45em}
.doc h1{font-size:2.15rem;margin-top:.2em}
.doc h2{font-size:1.65rem}
.doc h3{font-size:1.32rem}
.doc h4{font-size:1.12rem}
.cid{font-family:var(--f-mono);font-size:.72em;font-weight:500;letter-spacing:.01em;color:var(--accent);background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:1px 6px;vertical-align:.12em;white-space:nowrap}
.doc p,.doc li,.doc blockquote{max-width:72ch}
.doc ul,.doc ol{padding-left:1.3em}
.doc li{margin:.18em 0}
.doc hr{border:0;border-top:1px dashed var(--rule);margin:26px 0}
.doc blockquote{margin:12px 0;padding:6px 14px;border-left:2px solid var(--rule-strong);color:var(--ink-2)}
code{font-family:var(--f-mono);font-size:.84em;background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:0 4px;overflow-wrap:anywhere}
pre.code{background:var(--surface-2);border:1px solid var(--rule);border-radius:3px;padding:12px 14px;overflow-x:auto;max-width:100%}
pre.code code{background:none;border:0;padding:0;font-size:.82rem;overflow-wrap:normal}
del{color:var(--muted)}
strong{font-weight:600}
/* Tableaux : la donnée en sans-serif, chaque tableau dans son cadre défilant */
.tw{overflow-x:auto;margin:12px 0 18px;border:1px solid var(--rule);border-radius:3px;background:var(--surface-2)}
table.t{border-collapse:collapse;width:100%;font-family:var(--f-ui);font-size:.85rem;line-height:1.45;font-variant-numeric:tabular-nums}
table.t.wide{min-width:820px}
table.t th{text-align:left;font-weight:600;color:var(--ink-2);background:var(--surface);border-bottom:1px solid var(--rule-strong);padding:7px 10px;vertical-align:bottom}
table.t td{border-top:1px solid var(--rule);padding:7px 10px;vertical-align:top}
table.t tr:first-child td{border-top:0}
table.t code{font-size:.82em}
.state{display:inline-block;font-family:var(--f-ui);font-size:.78rem;font-weight:500;line-height:1.3;padding:1px 7px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.st-auto{color:var(--ok)} .st-partiel{color:var(--info)} .st-manuel,.st-hors{color:var(--muted)} .st-non{color:var(--alarm)} .st-clarifier{color:var(--warn)}
.prio{display:inline-block;font-family:var(--f-mono);font-size:.78rem;font-weight:500;padding:0 6px;border-radius:3px;border:1px solid var(--rule-strong)}
.prio-1{color:var(--alarm);border-color:currentColor}.prio-2{color:var(--warn);border-color:currentColor}.prio-3{color:var(--muted)}
/* Cible d'un lien : le cas, le test ou la ligne visés ressortent */
.anchor{display:block;position:relative;top:-16px}
.anchor:target+h3,.anchor:target+h4,h2:target,h3:target,h4:target{background:var(--hl);box-shadow:-8px 0 0 var(--hl),8px 0 0 var(--hl)}
tr:has(.anchor:target) td{background:var(--hl)}
footer.end{font-family:var(--f-ui);font-size:.82rem;color:var(--muted);border-top:1px solid var(--rule);margin-top:48px;padding-top:14px}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
</style>
<div class="shell">
<aside class="side">
  <p class="brand">selene · cahier de recette</p>
  <form class="jump" id="jumpForm" role="search">
    <input id="jumpIn" list="jumpList" placeholder="RLM-023, TU-REG-38…" aria-label="Aller à un cas, un test ou un élément du backlog" autocomplete="off">
    <button type="submit">Aller</button>
  </form>
  <p class="jump-msg" id="jumpMsg" aria-live="polite"></p>
  <datalist id="jumpList">${jump.map(([id, label]) => `<option value="${esc(label)}" data-id="${esc(id)}"></option>`).join("")}</datalist>
  <details class="toc" id="toc"><summary>Sommaire</summary><nav aria-label="Sommaire"><ul>${nav}</ul></nav></details>
</aside>
<main>
  <header class="mast">
    <p class="eyebrow">docs/recette · ${esc(branch || "main")}</p>
    <h1>Cahier de recette de Selene</h1>
    <p class="meta">Généré le ${esc(date)} depuis le commit <code>${esc(commit)}</code> · ${cases.length} cas manuels · ${tests.length} tests automatiques inventoriés · ${backlog.length} éléments de backlog · ${anomalies} anomalies relevées</p>
    <p class="note">Une vue du cahier, pas le cahier : il fait foi dans le dépôt, sous <code>docs/recette/</code>, et <code>npm run recette</code> le garde d'accord avec les tests. Un cas écrit n'a pas été exécuté : seuls les comptes rendus disent ce qui a été essayé.</p>
    ${chips ? `<ul class="chips" aria-label="Couverture des cas manuels">${chips}</ul>` : ""}
  </header>
${sections}
  <footer class="end">Source : <a href="${REPO}/tree/main/docs/recette" rel="noopener">docs/recette</a> au commit ${esc(commit)}. Pour mettre cette page à jour : <code>npm run recette -- page</code>, puis republier <code>dist/recette/cahier.html</code>.</footer>
</main>
</div>
<script>
(function(){
  var toc=document.getElementById('toc');
  try{ if(window.matchMedia('(min-width:980px)').matches) toc.open=true; }catch(e){ toc.open=true; }
  // Aller à un identifiant : l'étiquette choisie dans la liste, ou l'identifiant tapé seul (rlm-023, TU-REG-38).
  var opts={}; document.querySelectorAll('#jumpList option').forEach(function(o){ opts[o.value.toLowerCase()]=o.getAttribute('data-id'); });
  var form=document.getElementById('jumpForm'), input=document.getElementById('jumpIn'), msg=document.getElementById('jumpMsg');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var v=input.value.trim(), id=opts[v.toLowerCase()]||v.split(' — ')[0].trim().toLowerCase();
    var el=id&&document.getElementById(id);
    if(!el){ msg.textContent=v?'« '+v+' » n\\'est ni un cas, ni un test, ni un élément du backlog.':''; return; }
    msg.textContent=''; location.hash=id; if(!window.matchMedia('(min-width:980px)').matches) toc.open=false;
  });
  // Le document en cours de lecture ressort dans le sommaire.
  var links={}; document.querySelectorAll('.toc a[data-sec]').forEach(function(a){ links[a.getAttribute('data-sec')]=a; });
  if('IntersectionObserver' in window){
    var cur=null, io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ if(cur) cur.classList.remove('on'); cur=links[en.target.id]; if(cur) cur.classList.add('on'); } }); },{rootMargin:'-20% 0px -70% 0px'});
    document.querySelectorAll('section.doc').forEach(function(s){ io.observe(s); });
  }
})();
</script>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`${path.relative(ROOT, OUT)} : ${(html.length / 1e6).toFixed(2)} Mo ; ${ORDER.flatMap(([, f]) => f).length} documents, ${cases.length} cas, ${tests.length} tests, ${jump.length} entrées « Aller à ».`);
