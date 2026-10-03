/* Les captures de la page publique de test (essai.html, docs/essai.md) : `npm run essai:captures` → essai/*.jpg, à
   versionner. Trois écrans de téléphone (780 × 1560) et l'aperçu des partages (1200 × 630, og:image).
   Un espace de démonstration fictif, au service de la promesse de la page (un long projet d'écriture, ses fragments,
   ses sources) : construit avec les règles mêmes de l'app (src/core/domain.js), vérifié par la validation des
   sauvegardes, sans donnée personnelle. Le sujet de thèse et ses fragments sont inventés ; les sources citées existent
   (Michelet, Reynaud, Woolf), ou restent génériques (« Registres de service d'un phare »), pour qu'aucune capture ne
   montre une fausse référence. Selene s'ouvre dans Chromium, à une date et une heure fixes, sans réseau. */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { MODULE_TEMPLATES, createFromTemplate, addTask, setTaskToday, addJournalEntry, saveCollectionItem, addLink, SCHEMA_VERSION } from "../src/core/domain.js";
import { createBackup, parseBackup } from "../src/core/backup.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const NOW = "2026-10-06T21:40:00+02:00", TODAY = "2026-10-06";
const day = n => { const d = new Date(TODAY + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let n = 0; const id = () => `essai${(++n).toString(36).padStart(4, "0")}`;
const tpl = name => MODULE_TEMPLATES.find(t => t.id === name);

function demoSite() {
  n = 0;
  const modules = {}, make = (template, name, key) => createFromTemplate(modules, tpl(template), name, key);

  const these = make("ecriture", "Thèse", "these");
  const chapitres = [["c1", "I. Les feux", 30000], ["c2", "II. Les gardiens", 30000], ["c3", "III. La relève", 30000]];
  Object.assign(these.config, { title: "Les gardiens de phare de la Manche, 1850-1914", goal: 90000, entryMode: "delta",
    categories: chapitres.map(([cid, name, goal]) => ({ id: cid, name, goal })) });
  addJournalEntry(these, { value: 21400, category: "c1" }, id(), day(-210));
  for (let i = 120; i >= 40; i -= 4) addJournalEntry(these, { value: 380 + (i * 41) % 520, category: "c2" }, id(), day(-i));
  for (let i = 30; i >= 0; i -= 2) addJournalEntry(these, { value: 300 + (i * 57) % 450, category: "c3" }, id(), day(-i));
  const fragments = [
    [-190, "c2", "Le registre ne dit jamais la peur. Il dit : vent de nord-ouest, feu allumé à 17 h 40, rien à signaler."],
    [-184, "c3", "La relève se faisait au jusant, quand la mer laissait passer la barque ; certaines semaines, elle ne passait pas."],
    [-150, "c1", "Une lumière n'a de sens que pour qui ne la voit pas encore : le phare est écrit pour le large, pas pour la côte."],
    [-61, "c2", "Hypothèse : ce n'est pas l'isolement qui use les gardiens, c'est l'attente de la relève."],
    [-21, "c1", "Comparer les lampes à huile de colza et les premiers feux au pétrole : la portée double, pas la fatigue."],
    [-4, "c3", "Fin du chapitre III : revenir à la lettre du gardien, la relève manquée de décembre."]
  ].map(([d, category, text]) => ({ id: id(), date: day(d), category, text }));
  these.scraps.push(...fragments);

  const sources = make("sources", "Sources", "sources");
  const ref = (title, subtitle, tag, status, text, date) => saveCollectionItem(sources, { title, subtitle, tag, status: sources.config.statuses[status], text }, id(), day(date));
  ref("Registres de service d'un phare de la Manche", "Archives départementales", "Archive", 2, "Relèves, vents et incidents, consignés jour après jour.", -200);
  ref("La Mer", "Jules Michelet", "Livre", 1, "Le chapitre sur les phares : la lumière comme veille humaine.", -170);
  ref("Mémoire sur l'éclairage et le balisage des côtes de France", "Léonce Reynaud", "Rapport", 2, "Les ordres de feux et leurs portées.", -160);
  ref("La Promenade au phare", "Virginia Woolf", "Roman", 0, "", -40);
  // Les registres documentent le fragment sur la relève ; Michelet, celui sur la lumière.
  addLink(sources.entries[0], `these/${fragments[1].id}`, "documente", id(), day(-184));
  addLink(sources.entries[1], `these/${fragments[2].id}`, "documente", id(), day(-150));

  const carnet = make("carnet", "Carnet", "carnet");
  Object.assign(carnet.config, { inbox: true, placeholder: "Une idée, une piste, une référence…" });
  ["Demander à l'archiviste les registres de 1880 à 1885", "Idée : ouvrir le chapitre II par une nuit sans relève", "Relire Michelet, livre II"].forEach((text, i) => addJournalEntry(carnet, { text }, id(), day(-i * 3)));

  const taches = make("taches", "Tâches", "taches");
  for (const [title, due] of [["Relire le chapitre II", 2], ["Écrire au service des archives", 5], ["Mettre à jour la bibliographie", null]])
    addTask(taches.entries, { title, room: "", cat: taches.config.cats[0], due: due == null ? null : day(due) }, id(), day(-10));
  setTaskToday(taches.entries, taches.entries[0].id, true);

  const order = ["these", "sources", "carnet", "taches"];
  return {
    updatedAt: Date.parse(NOW), schemaVersion: SCHEMA_VERSION, boardMerged: true,
    config: {
      name: "Selene", palette: "nigredo", mode: "dark", lang: "fr", labels: {}, groups: {}, welcome: false,
      modules: [...order.map(m => ({ id: m, on: true })), { id: "assistant", on: false }],
      sky: { name: "Brest, Bretagne, France", lat: 48.4, lon: -4.5, weather: false, realMoon: true },
      assistant: { model: "claude-sonnet-5", actions: false, share: Object.fromEntries(order.map(m => [m, false])) }
    },
    modules
  };
}

/* ---- la page, servie telle que publiée (dist/web) ---- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
function serve() {
  const server = createServer(async (req, res) => {
    const p = path.join(root, "dist", "web", decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(path.join(root, "dist", "web"))) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }).end(await readFile(p)); }
    catch { res.writeHead(404).end(); }
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok(server)));
}

const site = demoSite();
parseBackup(createBackup({ updatedAt: 0, tasks: [] }, site)); // une donnée que l'app refuserait arrête tout ici
const server = await serve(), base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const dir = path.join(root, "essai");
await mkdir(dir, { recursive: true });
const shoot = async ({ viewport, deviceScaleFactor, mobile }, shots) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, isMobile: mobile, hasTouch: mobile, colorScheme: "dark", locale: "fr-FR", timezoneId: "Europe/Paris", serviceWorkers: "block", reducedMotion: "reduce" });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort()); // rien ne sort : ni météo, ni radar
  await ctx.addInitScript(doc => { window.claude = { use: async () => null }; if (!localStorage.getItem("selene-site-v1")) localStorage.setItem("selene-site-v1", doc); }, JSON.stringify(site));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  // `to` : l'élément amené en haut de l'écran (le téléphone saute l'en-tête de l'app, pour montrer le contenu).
  for (const [name, hash, { search, to } = {}] of shots) {
    await page.goto(base + hash); await page.waitForFunction(() => document.querySelector("#main")?.children.length, null, { timeout: 10000 });
    if (search) { await page.fill("#searchIn", search); await page.waitForTimeout(300); }
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600);
    await page.evaluate(sel => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const el = sel && document.querySelector(sel);
      window.scrollTo(0, el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 16) : 0);
    }, to || null);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(dir, `${name}.jpg`), type: "jpeg", quality: 82 });
    console.log(`essai/${name}.jpg`);
  }
  if (errors.length) throw new Error(`Erreurs JavaScript : ${errors.join(" | ")}`);
  await ctx.close();
};
try {
  await shoot({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, mobile: true }, [
    ["ecriture", "#these", { to: "#main h2" }], ["sources", "#sources", { to: "#main h2" }], ["recherche", "#recherche", { search: "relève", to: "#searchIn" }]]);
  await shoot({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, mobile: false }, [["apercu", "#these"]]);
} finally { await browser.close(); server.close(); }
