/* Le cahier de recette manuelle à cocher (npm run recette -- campagne) : dist/recette/campagne.html, à publier en
   artefact avec la capacité « db ». Une case par étape de chaque cas manuel, plus l'état final et le nettoyage ; un
   résultat par cas (réussi, échoué, bloqué, non applicable, non exécuté : campagnes.md) ; les coches rangées par
   campagne dans la base de l'artefact, partagées entre appareils ; le compte rendu en Markdown, au format de
   comptes-rendus/modele.md. La page est une vue : les cas font foi dans docs/recette/manuels/, et une campagne ne
   devient un fait qu'une fois son compte rendu versé dans comptes-rendus/ par une PR.
   Chaque étape porte l'empreinte de son texte : une étape réécrite après avoir été cochée ressort « à revérifier ».
   Le script de la page est dans recette-campagne.client.js (vérifié par eslint comme le reste). */
import fs from "node:fs";
import path from "node:path";
import { ROOT, REC, REPO, read, git, esc, cellsOf, inline as inlineMd, FONTS, TOKENS } from "./recette-md.mjs";

const OUT = path.join(ROOT, "dist/recette/campagne.html");
// La page de lecture publiée (npm run recette -- page) : le cahier entier, pour ce que cette page ne reprend pas.
const LECTURE = "https://claude.ai/artifact/KjK5krMMJve526HKuiUEgn";

/* ---------- les domaines, dans l'ordre du point d'entrée ---------- */
const readme = read(path.join(REC, "README.md"));
const domaines = [...readme.matchAll(/^\| \[[^\]]+\]\((manuels\/[^)]+\.md)\) \| `([A-Z]{3})` \|/gm)].map(m => ({ f: m[1], p: m[2] }));
const caseIds = new Set();
for (const d of domaines) for (const m of read(path.join(REC, d.f)).matchAll(/^### ([A-Z]{3}-\d{3}) — /gm)) caseIds.add(m[1]);

/* ---------- liens ---------- */
// Un cas cité mène à sa carte dans la page ; tout le reste du dépôt, à GitHub (les ancres y fonctionnent aussi).
function href(raw, from) {
  if (/^(https?:|mailto:)/.test(raw)) return { url: raw, out: true };
  const [p, frag = ""] = raw.split("#");
  const id = decodeURIComponent(frag).toUpperCase();
  const abs = p ? path.resolve(path.dirname(path.join(REC, from)), decodeURIComponent(p)) : path.join(REC, from);
  if (caseIds.has(id) && abs.startsWith(path.join(REC, "manuels") + path.sep)) return { url: "#" + id.toLowerCase() };
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  const kind = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? "tree" : "blob";
  return { url: `${REPO}/${kind}/main/${rel}${frag ? "#" + frag : ""}`, out: true };
}
const inline = (text, from) => inlineMd(text, from, { href, anchor: (_, id) => `x-${id}` });

// Les blocs d'une introduction de domaine : titres, listes (avec leurs lignes de suite), paragraphes.
function blocks(lines, from) {
  const out = [];
  let i = 0;
  const isList = l => /^\s*[-*]\s+\S/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim() || /^---+\s*$/.test(l)) { i++; continue; }
    const h = l.match(/^#{2,6} (.+)$/);
    if (h) { out.push(`<h4>${inline(h[1], from)}</h4>`); i++; continue; }
    if (isList(l)) {
      const items = [];
      while (i < lines.length && lines[i].trim() && (isList(lines[i]) || /^\s+\S/.test(lines[i]))) {
        if (isList(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/, "")); else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      out.push(`<ul>${items.map(t => `<li>${inline(t, from)}</li>`).join("")}</ul>`); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^#{2,6} /.test(lines[i]) && (!buf.length || !isList(lines[i]))) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(" "), from)}</p>`);
  }
  return out.join("");
}

// L'empreinte d'un texte (FNV-1a, 32 bits) : elle date une coche, pas un secret.
const empreinte = s => { let h = 0x811c9dc5; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

/* ---------- les cas ---------- */
// Le format est vérifié par npm run recette ; ce lecteur s'arrête net s'il ne le reconnaît plus, plutôt que de
// publier un cahier à cocher amputé.
const problems = [];
function champs(lines) {
  const out = [];
  for (const l of lines) {
    const m = l.match(/^- \*\*([^*]+)\*\* : (.*)$/);
    if (m) out.push([m[1], m[2]]);
    else if (/^\s+\S/.test(l) && out.length) out[out.length - 1][1] += " " + l.trim();
  }
  return out;
}
const cas = [];
for (const d of domaines) {
  const text = read(path.join(REC, d.f)).replace(/\r/g, "");
  const lines = text.split("\n");
  d.t = text.match(/^# (.+)$/m)?.[1] ?? d.f;
  const tableAt = lines.findIndex(l => /^\| Identifiant \|/.test(l));
  d.intro = blocks(lines.slice(1, tableAt), d.f);
  for (const part of text.split(/^<a id="[a-z]{3}-\d{3}"><\/a>\n/m).slice(1)) {
    const pl = part.split("\n");
    const head = pl[0].match(/^### ([A-Z]{3}-\d{3}) — (.+)$/);
    if (!head) { problems.push(`${d.f} : un cas sans titre « ### XXX-000 — … » après son ancre`); continue; }
    const [, id, titre] = head;
    const start = pl.findIndex(l => /^\| Étape \| Action précise \| Résultat attendu observable \|$/.test(l));
    if (start < 0) { problems.push(`${id} : pas de tableau d'étapes`); continue; }
    let end = start + 2;
    while (end < pl.length && /^\|/.test(pl[end])) end++;
    const avant = champs(pl.slice(1, start)), apres = champs(pl.slice(end).filter(l => !/^---+\s*$/.test(l)));
    const get = (arr, k) => (arr.find(([l]) => l === k) || [])[1];
    const prio = (get(avant, "Priorité") || "").match(/^(P[123]) · \*\*Plateformes\*\* : (.+)$/);
    if (!prio) { problems.push(`${id} : ligne « Priorité · Plateformes » illisible`); continue; }
    const etapes = pl.slice(start + 2, end).map(cellsOf).map(([n, a, r]) => ({ n, a: inline(a, d.f), r: inline(r, d.f), h: empreinte(`${a}\u0001${r}`) }));
    if (!etapes.length || etapes.some(e => !/^\d+$/.test(e.n))) { problems.push(`${id} : étapes absentes ou mal numérotées`); continue; }
    const fin = get(apres, "État final attendu"), net = get(apres, "Nettoyage");
    if (!fin || !net) { problems.push(`${id} : « État final attendu » ou « Nettoyage » manquant après les étapes`); continue; }
    const ctx = ["Fonctionnalité et règle", "Automatisés associés", "Source"];
    cas.push({
      id, d: d.p, t: inline(titre, d.f), tt: titre.replace(/[`*]/g, ""), pr: prio[1], pl: prio[2].split(/,\s*/),
      obj: inline(get(avant, "Objectif, risque vérifié") || "", d.f),
      pre: inline(get(avant, "Préconditions") || "", d.f), don: inline(get(avant, "Données") || "", d.f),
      ctx: ctx.filter(k => get(avant, k)).map(k => [k, inline(get(avant, k), d.f)]),
      e: etapes,
      fin: { html: inline(fin, d.f), h: empreinte(fin) },
      net: /^aucun\.?$/i.test(net.trim()) ? null : { html: inline(net, d.f), h: empreinte(net) },
      x: apres.filter(([l]) => l !== "État final attendu" && l !== "Nettoyage").map(([l, v]) => [l, inline(v, d.f)])
    });
  }
}
if (cas.length !== caseIds.size) problems.push(`${caseIds.size} titres de cas, ${cas.length} cas lus`);
if (problems.length) { console.error(`Cahier à cocher non écrit : le format des cas n'est plus reconnu.\n- ${problems.join("\n- ")}`); process.exit(1); }

/* ---------- la couverture (matrice.md) et les campagnes (campagnes.md) ---------- */
const cov = new Map();
for (const l of read(path.join(REC, "matrice.md")).split("\n").filter(l => /^\| /.test(l))) {
  const c = cellsOf(l);
  if (c.length < 6) continue;
  for (const m of c[2].matchAll(/\[([A-Z]{3}-\d{3})\]/g)) { const s = cov.get(m[1]) || new Set(); s.add(c[4]); cov.set(m[1], s); }
}
for (const c of cas) c.cov = [...(cov.get(c.id) || [])];

const camp = read(path.join(REC, "campagnes.md"));
const smokeText = camp.slice(camp.indexOf("## Smoke"), camp.indexOf("<a id=\"ciblee\">"));
const smoke = [...smokeText.matchAll(/^\| \d+ \| \[([A-Z]{3}-\d{3})\]\([^)]*\) \| (.+) \|$/gm)].map(m => ({ id: m[1], why: m[2] }));
// « Selon la livraison, ajouter : [PLT-003](…) (version Android), … [PLT-011](…) et [AST-009](…) (artefact), … »
const livraison = (smokeText.match(/\*\*Selon la livraison\*\*, ajouter : ([\s\S]+?)\.\n\n/)?.[1] ?? "").replace(/\n/g, " ")
  .replace(/\[([A-Z]{3}-\d{3})\]\([^)]*\)/g, "$1").split(/\),\s*/)
  .map(s => ({ ids: s.match(/[A-Z]{3}-\d{3}/g) || [], why: s.match(/\(([^)]+)\)?\s*$/)?.[1] ?? "" })).filter(s => s.ids.length);
for (const id of [...smoke.map(s => s.id), ...livraison.flatMap(s => s.ids)]) if (!caseIds.has(id)) problems.push(`campagnes.md : la smoke cite ${id}, absent des cas`);
if (smoke.length < 10 || !livraison.length) problems.push(`campagnes.md : smoke illisible (${smoke.length} cas, ${livraison.length} ajouts selon la livraison)`);
if (problems.length) { console.error(`Cahier à cocher non écrit.\n- ${problems.join("\n- ")}`); process.exit(1); }

/* ---------- la page ---------- */
const commit = git(["rev-parse", "--short", "HEAD"]) || "inconnu";
const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).replace(/^1 /, "1er ");
const nEtapes = cas.reduce((n, c) => n + c.e.length, 0);
const data = { commit, date, repo: REPO, lecture: LECTURE, domaines: domaines.map(({ p, t, f, intro }) => ({ p, t, f, intro })), cas, smoke, livraison };
// Dans un <script type="application/json">, « </ » fermerait la balise : les chevrons voyagent échappés.
const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const client = read(path.join(ROOT, "scripts/recette-campagne.client.js"));

const html = `<title>Cahier à cocher Selene</title>
${FONTS}
<style>
/* Pensée pour la recette en main : un téléphone à côté de l'appareil testé, ou l'inverse. Au téléphone (600 px et
   moins) : une seule bande d'avancement collée en haut, les étapes sur toute la largeur de la carte, l'attendu dans un
   encadré sous l'action, des champs à 16 px (Safari iOS zoome en dessous), des cibles de 44 px. Sur ordinateur : la
   barre de campagne collée en haut, les étapes en deux colonnes (action, attendu). */
${TOKENS}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f-text);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:2px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button,input,select,textarea{font:inherit;font-family:var(--f-ui);color:var(--ink)}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px 80px}
@media (min-width:900px){.wrap{padding:0 28px 96px}}
/* En-tête */
.mast{padding:22px 0 14px}
.eyebrow{font-family:var(--f-label);text-transform:lowercase;letter-spacing:.08em;color:var(--muted);margin:0 0 4px;font-size:.95rem}
h1{font-family:var(--f-display);font-weight:600;font-size:clamp(2rem,6vw,3rem);line-height:1;margin:0 0 10px;text-wrap:balance}
.meta{font-family:var(--f-ui);font-size:.86rem;color:var(--ink-2);margin:0 0 8px;font-variant-numeric:tabular-nums}
.note{font-size:.94rem;color:var(--ink-2);max-width:72ch;margin:6px 0 0}
.how{padding-left:1.3em}
.about>summary{font-family:var(--f-ui);font-size:.88rem;color:var(--ink-2);cursor:pointer;min-height:36px;display:flex;align-items:center;gap:6px;list-style:none}
.about>summary::-webkit-details-marker{display:none}
.about>summary::before{content:"▸";color:var(--muted)}
.about[open]>summary::before{content:"▾"}
.banner{font-family:var(--f-ui);font-size:.88rem;border:1px solid var(--rule-strong);border-left:3px solid var(--warn);background:var(--surface-2);padding:9px 12px;border-radius:3px;margin:12px 0 0}
.banner[hidden]{display:none}
/* Barre de campagne */
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--rule-strong);padding:10px 0;margin:0 0 6px}
.srow{display:flex;gap:4px 10px;align-items:baseline}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.row>label{font-family:var(--f-ui);font-size:.84rem;color:var(--ink-2)}
select,input[type=text],input[type=search],textarea{border:1px solid var(--rule-strong);border-radius:3px;background:var(--surface-2);padding:8px 9px;font-size:.9rem;min-height:40px}
select{max-width:100%}
textarea{width:100%;min-height:64px;resize:vertical;line-height:1.4}
@media (max-width:600px),(pointer:coarse){select,input[type=text],input[type=search],textarea{font-size:16px}}
.btn{border:1px solid var(--rule-strong);border-radius:3px;background:var(--surface);padding:8px 12px;font-size:.88rem;min-height:40px;cursor:pointer}
.btn:hover{background:var(--surface-2)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--bg)}
.btn:disabled{opacity:.55;cursor:default}
.grow{flex:1 1 220px;min-width:0}
@media (max-width:520px){.bar .btn{padding:6px 9px;font-size:.84rem;min-height:38px}.bar .wide{display:none}.bar select.grow{flex-basis:100%}}
.progress{height:6px;background:var(--rule);border-radius:3px;overflow:hidden;margin:9px 0 6px;display:flex}
.progress span{display:block;height:100%}
.p-reussi{background:var(--ok)} .p-echoue{background:var(--alarm)} .p-bloque{background:var(--warn)} .p-na{background:var(--muted)}
.counts{flex:1;min-width:0;font-family:var(--f-ui);font-size:.82rem;color:var(--ink-2);font-variant-numeric:tabular-nums}
.save{font-family:var(--f-ui);font-size:.8rem;color:var(--muted);margin-left:auto;white-space:nowrap}
.save.err{color:var(--alarm);white-space:normal}
/* Au téléphone, l'enveloppe s'efface (display: contents) : les commandes défilent avec la page, seule la bande
   d'avancement reste collée, et elle colle par rapport à la page entière. */
@media (max-width:600px){
  .bar{display:contents}
  .controls{padding:4px 0 8px}
  .status{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--rule-strong);padding:7px 0;margin:0 0 4px}
  .status .progress{margin:0 0 5px}
  .counts{font-size:.8rem;line-height:1.35}
  .save{font-size:.75rem}
}
/* Panneaux : nouvelle campagne, campagne, compte rendu */
.panel{border:1px solid var(--rule-strong);border-radius:3px;background:var(--surface);padding:14px;margin:10px 0}
.panel[hidden]{display:none}
.panel h2{font-family:var(--f-display);font-weight:600;font-size:1.45rem;margin:0 0 10px;line-height:1.1}
.panel h3{font-family:var(--f-label);text-transform:lowercase;letter-spacing:.06em;font-weight:500;font-size:.95rem;color:var(--muted);margin:14px 0 6px}
.fields{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:700px){.fields{grid-template-columns:1fr 1fr}}
.fields label{display:flex;flex-direction:column;gap:4px;font-family:var(--f-ui);font-size:.82rem;color:var(--ink-2)}
.choices{display:flex;flex-wrap:wrap;gap:6px 16px;font-family:var(--f-ui);font-size:.88rem}
.choices label{display:flex;gap:7px;align-items:center;min-height:36px;cursor:pointer}
.hint{font-family:var(--f-ui);font-size:.8rem;color:var(--muted);margin:4px 0 0}
.crit{font-family:var(--f-ui);font-size:.86rem;margin:8px 0 0;padding:8px 10px;border-radius:3px;background:var(--surface-2);border-left:3px solid var(--rule-strong)}
.crit.ok{border-left-color:var(--ok)} .crit.ko{border-left-color:var(--alarm)} .crit.wait{border-left-color:var(--warn)}
.crit ul{margin:4px 0 0;padding-left:1.2em}
table.syn{border-collapse:collapse;font-family:var(--f-ui);font-size:.84rem;font-variant-numeric:tabular-nums;margin:6px 0;width:100%;max-width:560px}
table.syn th,table.syn td{border-bottom:1px solid var(--rule);padding:5px 8px;text-align:right}
table.syn th:first-child,table.syn td:first-child{text-align:left}
/* Filtres */
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0 6px}
.frow,.fmore{display:contents}
.fbtn{display:none}
.filters select,.filters input{flex:1 1 150px;min-width:0}
@media (max-width:600px){
  .filters{display:block}
  .frow{display:flex;gap:8px}
  .frow input{flex:1}
  .fbtn{display:block}
  .fmore{display:none}
  .filters.open .fmore{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
  .fmore select{min-width:0;width:100%}
}
/* Domaines et cas */
.dom{margin:26px 0 0}
.dom>h2{font-family:var(--f-display);font-weight:600;font-size:1.6rem;line-height:1.1;margin:0 0 4px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.dom>h2 .n{font-family:var(--f-ui);font-size:.82rem;font-weight:400;color:var(--muted);font-variant-numeric:tabular-nums}
.intro{font-size:.92rem;color:var(--ink-2);margin:0 0 8px}
.intro>summary,.ctx>summary{font-family:var(--f-ui);font-size:.85rem;cursor:pointer;min-height:36px;display:flex;align-items:center;gap:6px;list-style:none}
.intro>summary::-webkit-details-marker,.ctx>summary::-webkit-details-marker{display:none}
.intro>summary::before,.ctx>summary::before{content:"▸";color:var(--muted)}
.intro[open]>summary::before,.ctx[open]>summary::before{content:"▾"}
.intro p,.intro li{max-width:76ch}
.intro h4{font-family:var(--f-label);text-transform:lowercase;letter-spacing:.05em;font-weight:500;margin:10px 0 4px}
details.case{border:1px solid var(--rule);border-radius:3px;background:var(--surface-2);margin:8px 0;scroll-margin-top:130px}
@media (max-width:600px){details.case{scroll-margin-top:72px}}
details.case[open]{border-color:var(--rule-strong)}
details.case:target,details.case.flash{box-shadow:0 0 0 3px var(--hl)}
details.case>summary{list-style:none;cursor:pointer;padding:10px 12px;display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"id ct sp" "id cm cm";gap:4px 10px;align-items:start;min-height:44px}
.cid{grid-area:id} .ct{grid-area:ct} .sp{grid-area:sp} .cm{grid-area:cm}
@media (max-width:600px){
  details.case>summary{grid-template-areas:"id cm sp" "ct ct ct";padding:10px;gap:6px 8px;align-items:center}
  .cm .pl,.cm .cov{display:none}
  .ct{font-size:1.04rem}
  .dom>h2{font-size:1.4rem}
  .mast{padding:14px 0 6px}
  h1{font-size:1.9rem}
}
details.case>summary::-webkit-details-marker{display:none}
.cid{font-family:var(--f-mono);font-size:.8rem;font-weight:500;color:var(--accent);background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:1px 6px;white-space:nowrap;margin-top:2px}
.ct{font-family:var(--f-text);font-size:1rem;line-height:1.35}
.cm{display:flex;flex-wrap:wrap;gap:4px 10px;font-family:var(--f-ui);font-size:.78rem;color:var(--muted);align-items:center}
.sp{font-family:var(--f-ui);font-size:.8rem;font-variant-numeric:tabular-nums;color:var(--ink-2);white-space:nowrap;margin-top:3px}
.prio{font-family:var(--f-mono);font-size:.75rem;font-weight:500;padding:0 5px;border-radius:3px;border:1px solid currentColor}
.prio-1{color:var(--alarm)} .prio-2{color:var(--warn)} .prio-3{color:var(--muted)}
.pill{font-family:var(--f-ui);font-size:.76rem;font-weight:500;padding:0 8px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.r-reussi{color:var(--ok)} .r-echoue{color:var(--alarm)} .r-bloque{color:var(--warn)} .r-na{color:var(--muted)} .r-todo{color:var(--muted);border-style:dashed}
.out>summary{opacity:.6}
.body{padding:2px 12px 14px;border-top:1px solid var(--rule)}
.body p{margin:8px 0;max-width:76ch}
.kv .lbl{display:block;line-height:1.25}
.facts{display:none;font-family:var(--f-ui);font-size:.8rem;color:var(--muted)}
@media (max-width:600px){.body{padding:2px 10px 12px}.facts{display:block}}
.lbl{font-family:var(--f-label);text-transform:lowercase;letter-spacing:.05em;color:var(--muted);font-size:.9rem}
.ctx{margin:6px 0;font-size:.9rem;color:var(--ink-2)}
code{font-family:var(--f-mono);font-size:.84em;background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:0 4px;overflow-wrap:anywhere}
/* Les étapes : la case et son numéro, l'action, l'attendu */
.steps{margin:10px 0 4px;border:1px solid var(--rule);border-radius:3px;background:var(--bg)}
.sh{display:none}
.step{display:grid;grid-template-columns:48px 1fr;gap:2px 10px;padding:8px 10px 8px 4px;border-top:1px solid var(--rule)}
.step:first-of-type{border-top:0}
@media (min-width:760px){
  .sh{display:grid;grid-template-columns:48px 1fr 1fr;gap:10px;padding:6px 10px 6px 4px;font-family:var(--f-ui);font-size:.78rem;font-weight:600;color:var(--ink-2);background:var(--surface);border-bottom:1px solid var(--rule-strong)}
  .step{grid-template-columns:48px 1fr 1fr}
  .step .a{grid-column:2} .step .r{grid-column:3}
}
.step .ck{grid-row:1/3;display:flex;align-items:flex-start;justify-content:center;gap:4px;cursor:pointer;padding-top:2px;min-height:44px}
@media (min-width:760px){.step .ck{grid-row:1}}
.ck input{width:22px;height:22px;margin:0;accent-color:var(--accent);cursor:pointer}
.ck .num{font-family:var(--f-mono);font-size:.78rem;color:var(--muted);padding-top:2px}
.step .a,.step .r{font-size:.94rem;overflow-wrap:anywhere;min-width:0}
.step .r{color:var(--ink-2)}
@media (max-width:759px){
  .steps{border:0;border-radius:0;background:none;margin:8px -12px 4px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
  .step{grid-template-columns:40px 1fr;padding:10px 12px 10px 0}
  .step .a,.step .r{font-size:1rem}
  .step .r{margin-top:6px;padding:5px 9px 6px;background:var(--surface);border-left:2px solid var(--ok);border-radius:0 3px 3px 0}
  .step .r::before{content:"attendu";display:block;font-family:var(--f-label);letter-spacing:.05em;color:var(--muted);font-size:.84rem;line-height:1.3}
  .step .r code{background:var(--bg)}
  .step.done .r{border-left-color:var(--rule-strong)}
}
@media (max-width:600px){.steps{margin-left:-10px;margin-right:-10px}.step{padding-right:10px}}
.step.done .a,.step.done .r{color:var(--muted)}
.step.stale{background:color-mix(in srgb,var(--warn) 10%,transparent)}
.stale-msg{grid-column:2/-1;font-family:var(--f-ui);font-size:.78rem;color:var(--warn)}
.step.fin .a .lbl{display:block}
/* Le résultat du cas */
.res{margin:12px 0 0;padding:10px 0 0;border-top:1px dashed var(--rule)}
.seg{display:flex;flex-wrap:wrap;gap:6px}
.seg label{display:flex;align-items:center;gap:6px;border:1px solid var(--rule-strong);border-radius:999px;padding:6px 12px;min-height:40px;font-family:var(--f-ui);font-size:.86rem;cursor:pointer;background:var(--surface)}
.seg input{accent-color:var(--accent);margin:0}
.seg label:has(input:checked){border-color:currentColor;font-weight:600}
.res .fields{margin-top:10px}
.obs{display:flex;flex-direction:column;gap:4px;font-family:var(--f-ui);font-size:.82rem;color:var(--ink-2);margin-top:10px}
.more{margin-top:8px}
.more>summary{font-family:var(--f-ui);font-size:.85rem;color:var(--ink-2);cursor:pointer;min-height:40px;display:flex;align-items:center;gap:6px;list-style:none}
.more>summary::-webkit-details-marker{display:none}
.more>summary::before{content:"▸";color:var(--muted)}
.more[open]>summary::before{content:"▾"}
.more .fields{margin-top:4px}
.cnav{display:flex;gap:8px;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px dashed var(--rule)}
@media (max-width:600px){
  .seg{display:grid;grid-template-columns:1fr 1fr}
  .seg label{justify-content:flex-start;border-radius:3px}
  .seg label.r-todo{grid-column:1/-1}
  .cnav .btn{flex:1}
}
.warn{font-family:var(--f-ui);font-size:.82rem;color:var(--warn);margin:6px 0 0}
.warn:empty{display:none}
.who{font-family:var(--f-ui);font-size:.78rem;color:var(--muted);margin:8px 0 0}
.empty{font-family:var(--f-ui);color:var(--muted);padding:20px 0}
footer{font-family:var(--f-ui);font-size:.8rem;color:var(--muted);border-top:1px solid var(--rule);margin-top:40px;padding-top:12px}
fieldset{border:0;margin:0;padding:0;min-width:0}
fieldset:disabled .ck,fieldset:disabled .seg label{cursor:default}
@media print{
  .bar,.filters,.banner,.panel,.res .who,footer .tools{display:none!important}
  body{background:#fff;color:#000;font-size:11pt}
  details.case{break-inside:avoid;border-color:#999}
  .step{break-inside:avoid}
}
</style>
<div class="wrap">
  <header class="mast">
    <p class="eyebrow">selene · recette manuelle</p>
    <h1>Le cahier à cocher</h1>
    <p class="meta">Cahier au commit <code>${esc(commit)}</code>, généré le ${esc(date)} · ${cas.length} cas · ${nEtapes} étapes</p>
    <details class="about" id="about"><summary>Mode d'emploi</summary>
    <p class="note">Une case par étape : coche quand le résultat attendu est observé, pas avant. Le résultat du cas reste ta décision. Les cas font foi dans <a href="${REPO}/tree/main/docs/recette/manuels" rel="noopener">docs/recette/manuels</a> ; le cahier entier se lit dans <a href="${LECTURE}" rel="noopener">la page de lecture</a>.</p>
    <ol class="note how"><li>« Nouvelle campagne » : smoke, ciblée ou complète.</li><li>Ouvre un cas, fais chaque étape, coche quand l'attendu est observé.</li><li>Choisis le résultat du cas ; s'il n'est pas « réussi », écris ce que tu as observé.</li><li>« Compte rendu » : le Markdown à compléter et à verser par une PR.</li></ol>
    </details>
    <p class="banner" id="banner" hidden></p>
  </header>

  <div class="bar" id="bar">
    <div class="row controls">
      <select id="campSel" class="grow" aria-label="Campagne"><option value="">Aucune campagne : lecture seule</option></select>
      <button class="btn" id="newBtn" type="button">Nouvelle<span class="wide"> campagne</span></button>
      <button class="btn" id="infoBtn" type="button" disabled>Campagne</button>
      <button class="btn" id="crBtn" type="button" disabled>Compte rendu</button>
    </div>
    <div class="status" id="status">
      <div class="progress" id="prog" aria-hidden="true"></div>
      <div class="srow"><div class="counts" id="counts">Choisis ou crée une campagne : les coches s'y rangent.</div><span class="save" id="save" aria-live="polite"></span></div>
    </div>
  </div>

  <section class="panel" id="newPanel" hidden aria-labelledby="newT">
    <h2 id="newT">Nouvelle campagne</h2>
    <div class="choices" id="typeChoices" role="radiogroup" aria-label="Type">
      <label><input type="radio" name="type" value="smoke" checked> Smoke (une heure environ)</label>
      <label><input type="radio" name="type" value="ciblee"> Non-régression ciblée</label>
      <label><input type="radio" name="type" value="complete"> Recette complète</label>
    </div>
    <div id="optSmoke"><h3>Selon la livraison, ajouter</h3><div class="choices" id="livraison"></div></div>
    <div id="optCiblee" hidden>
      <h3>Domaines touchés</h3><div class="choices" id="doms"></div>
      <h3>Priorités</h3><div class="choices" id="prios"></div>
      <div class="choices"><label><input type="checkbox" id="skipAuto"> Sauter les cas « couverts automatiquement » (CI verte, tests non modifiés par la PR)</label></div>
      <div class="fields"><label>Cas en plus (identifiants séparés par des espaces ou des virgules)<input type="text" id="extra" placeholder="DON-005, RLM-023" autocomplete="off"></label></div>
      <p class="hint">Les règles du choix : <a href="${REPO}/blob/main/docs/recette/campagnes.md#ciblee" rel="noopener">campagnes.md, non-régression ciblée</a>.</p>
    </div>
    <div class="fields" style="margin-top:12px">
      <label>Identifiant de campagne<input type="text" id="nom" autocomplete="off"></label>
      <label>Version testée (branche, commit, version des apps)<input type="text" id="version" autocomplete="off" placeholder="main 1a2b3c4 ; APK 1.4.0"></label>
      <label>Environnement (site, navigateurs, appareils)<input type="text" id="env" autocomplete="off" placeholder="Pages ; Firefox 131 ; iPhone 13, iOS 18"></label>
    </div>
    <p class="hint" id="newCount"></p>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="createBtn" type="button">Créer la campagne</button><button class="btn" id="cancelNew" type="button">Annuler</button></div>
  </section>

  <section class="panel" id="infoPanel" hidden aria-labelledby="infoT">
    <h2 id="infoT">Campagne</h2>
    <div class="fields">
      <label>Version testée<input type="text" id="iVersion" autocomplete="off"></label>
      <label>Environnement<input type="text" id="iEnv" autocomplete="off"></label>
    </div>
    <p class="hint" id="iMeta"></p>
    <h3>Synthèse</h3><div id="iSyn"></div>
    <div id="iCrit"></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="archBtn" type="button">Archiver la campagne</button><label class="choices"><input type="checkbox" id="showArch"> Montrer les campagnes archivées</label></div>
  </section>

  <section class="panel" id="crPanel" hidden aria-labelledby="crT">
    <h2 id="crT">Compte rendu</h2>
    <p class="hint">Au format de <a href="${REPO}/blob/main/docs/recette/comptes-rendus/modele.md" rel="noopener">comptes-rendus/modele.md</a> : à compléter (exécutants, comptes, réserves, décision), puis à verser dans <code>docs/recette/comptes-rendus/</code> par une PR. Aucune donnée personnelle ni aucun secret.</p>
    <textarea id="crText" rows="14" readonly spellcheck="false"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn primary" id="copyBtn" type="button">Copier</button><span class="save" id="copyMsg" aria-live="polite"></span></div>
  </section>

  <div class="filters" id="filters" role="search">
    <div class="frow"><input type="search" id="q" placeholder="Chercher : RLM-023, sauvegarde…" aria-label="Chercher un cas" autocomplete="off"><button class="btn fbtn" id="fBtn" type="button" aria-expanded="false" aria-controls="fmore">Filtres</button></div>
    <div class="fmore" id="fmore">
    <select id="fDom" aria-label="Domaine"><option value="">Tous les domaines</option></select>
    <select id="fPrio" aria-label="Priorité"><option value="">Toutes priorités</option><option>P1</option><option>P2</option><option>P3</option></select>
    <select id="fRes" aria-label="Résultat">
      <option value="">Tous les résultats</option><option value="todo">Non exécutés</option><option value="encours">Commencés, sans résultat</option>
      <option value="reussi">Réussis</option><option value="echoue">Échoués</option><option value="bloque">Bloqués</option><option value="na">Non applicables</option><option value="stale">À revérifier</option>
    </select>
    <select id="fScope" aria-label="Portée"><option value="camp">Cas de la campagne</option><option value="all">Tout le cahier</option></select>
    <button class="btn" id="openAll" type="button">Tout déplier</button>
    </div>
  </div>

  <main id="list"></main>
  <footer>Source : <a href="${REPO}/tree/main/docs/recette/manuels" rel="noopener">docs/recette/manuels</a> au commit ${esc(commit)}. Pour mettre cette page à jour : <code>npm run recette -- campagne</code>, puis republier <code>dist/recette/campagne.html</code> à la même adresse ; les coches restent, et une étape réécrite depuis sa coche ressort « à revérifier ».</footer>
</div>
<script type="application/json" id="data">${json}</script>
<script>
${client}</script>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`${path.relative(ROOT, OUT)} : ${(html.length / 1e6).toFixed(2)} Mo ; ${domaines.length} domaines, ${cas.length} cas, ${nEtapes} étapes ; smoke de ${smoke.length} cas, ${livraison.length} ajouts selon la livraison.`);
