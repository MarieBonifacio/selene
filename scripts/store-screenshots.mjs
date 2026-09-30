/* Captures d'écran pour les stores (docs/publication.md) : `npm run screenshots` → dist/store/{android,ios}/*.png.
   Un espace de démonstration fictif, construit avec les règles mêmes de l'app (src/core/domain.js) et vérifié par la
   validation des sauvegardes : aucune donnée personnelle, rien qu'une page invalide pourrait montrer. Selene s'ouvre
   dans Chromium, à une date et une heure fixes (la lune et le paysage en dépendent), sans réseau.
   Formats : Google Play veut des côtés entre 320 et 3 840 px, le long au plus double du court (1080 × 1920) ;
   l'App Store, des écrans de 6,9 pouces (1320 × 2868). */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { MODULE_TEMPLATES, createFromTemplate, addTask, setTaskDone, setTaskToday, addBudgetEntry, addJournalEntry, saveCollectionItem, SCHEMA_VERSION } from "../src/core/domain.js";
import { createBackup, parseBackup } from "../src/core/backup.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const NOW = "2026-10-06T09:30:00+02:00", TODAY = "2026-10-06";
const day = n => { const d = new Date(TODAY + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let n = 0; const id = () => `demo${(++n).toString(36).padStart(4, "0")}`;
const tpl = name => MODULE_TEMPLATES.find(t => t.id === name);

/* ---- l'espace de démonstration ---- */
function demoSite() {
  const modules = {};
  const maison = createFromTemplate(modules, tpl("taches"), "Maison", "maison");
  Object.assign(maison.config, { groupLabel: "Pièce", catLabel: "Type", cats: ["Bricolage", "Achat", "Rangement", "Administratif"], costs: true });
  for (const [title, room, cat, due, cost, steps] of [
    ["Repeindre les volets", "Façade", "Bricolage", day(3), 85, [{ t: "Poncer", d: true }, { t: "Sous-couche", d: false }, { t: "Deux couches", d: false }]],
    ["Réparer le robinet de l'évier", "Cuisine", "Bricolage", day(0), 12, []],
    ["Trier les livres du palier", "Bureau", "Rangement", null, null, []],
    ["Commander des bocaux", "Cuisine", "Achat", day(5), 24, []],
    ["Déclarer les travaux à la mairie", "Façade", "Administratif", day(9), null, []],
    ["Tailler la glycine", "Jardin", "Bricolage", day(2), null, []],
    ["Changer l'ampoule du couloir", "Entrée", "Bricolage", null, 6, []],
    ["Vider la cave", "Cave", "Rangement", null, null, []],
    ["Renouveler l'assurance", "Bureau", "Administratif", null, null, []]
  ]) addTask(maison.entries, { title, room, cat, due, cost, steps }, id(), day(-12));
  for (const [i, when] of [[6, -2], [7, -8], [8, -15]]) setTaskDone(maison.entries, maison.entries[i].id, true, day(when));
  setTaskToday(maison.entries, maison.entries[1].id, true); setTaskToday(maison.entries, maison.entries[5].id, true);

  const roman = createFromTemplate(modules, tpl("ecriture"), "Roman", "roman");
  const ch = [["c1", "I. L'arrivée", 18000], ["c2", "II. La crue", 22000], ["c3", "III. Le phare", 20000]].map(([cid, name, goal]) => ({ id: cid, name, goal }));
  Object.assign(roman.config, { title: "Les heures claires", goal: 60000, entryMode: "delta", categories: ch });
  addJournalEntry(roman, { value: 16800, category: "c1" }, id(), day(-40));
  for (let i = 30; i >= 12; i -= 2) addJournalEntry(roman, { value: 420 + (i * 37) % 480, category: "c1" }, id(), day(-i));
  for (let i = 9; i >= 0; i--) addJournalEntry(roman, { value: 380 + (i * 53) % 400, category: "c2" }, id(), day(-i)); // une série en cours
  roman.scraps.push(
    { id: id(), date: day(-3), category: "c2", text: "L'eau n'a pas prévenu : elle a simplement cessé de se tenir à sa place." },
    { id: id(), date: day(-6), category: "c1", text: "Le bac ne traversait plus que deux fois par jour, et personne ne savait dire lesquelles." },
    { id: id(), date: day(-9), category: "c3", text: "Une lumière qui tourne n'éclaire rien longtemps ; c'est pour cela qu'on la voit de loin." });

  const yoga = createFromTemplate(modules, tpl("protocole"), "Yoga", "yoga");
  Object.assign(yoga.config, { unitLabel: "min", start: day(-24), weeks: 8, perWeek: 4 });
  for (const i of [23, 21, 20, 18, 16, 14, 13, 11, 9, 7, 6, 4, 2, 1]) addJournalEntry(yoga, { value: 20 + (i % 3) * 10 }, id(), day(-i));

  const plantes = createFromTemplate(modules, tpl("rappels"), "Plantes", "plantes");
  plantes.config.types = [{ id: "arrosage", label: "Arrosage", every: 3 }, { id: "engrais", label: "Engrais", every: 14 }, { id: "rempotage", label: "Rempotage", every: 0 }];
  for (const [t, i] of [["arrosage", 4], ["arrosage", 7], ["engrais", 9], ["rempotage", 40]]) addJournalEntry(plantes, { type: t }, id(), day(-i));

  const lectures = createFromTemplate(modules, tpl("decouvertes"), "Lectures", "lectures");
  for (const [title, subtitle, tag, status] of [
    ["Mrs Dalloway", "Virginia Woolf", "Roman", "Retenu"], ["Sido", "Colette", "Récit", "Découvert"],
    ["Le Temps retrouvé", "Marcel Proust", "Roman", "À découvrir"], ["Les Vagues", "Virginia Woolf", "Roman", "À découvrir"],
    ["La Maison de Claudine", "Colette", "Récit", "Retenu"], ["Du côté de chez Swann", "Marcel Proust", "Roman", "Découvert"]
  ]) saveCollectionItem(lectures, { title, subtitle, tag, status }, id(), day(-20));

  const carnet = createFromTemplate(modules, tpl("carnet"), "Carnet", "carnet");
  Object.assign(carnet.config, { inbox: true, placeholder: "Une idée, une course, un rêve…" });
  for (const [text, i] of [["Demander à la bibliothèque le livre sur les phares du Nord", 0], ["Idée : la crue racontée par le chien", 1], ["Graines de capucine pour le balcon", 2]])
    addJournalEntry(carnet, { text }, id(), day(-i));

  const budget = createFromTemplate(modules, tpl("budget"), "Budget", "budget");
  budget.config.envelopes = [{ id: id(), name: "Travaux", limit: 400 }, { id: id(), name: "Courses", limit: 350 }, { id: id(), name: "Livres", limit: 40 }];
  for (const [amount, cat, note, i] of [[62.4, "Courses", "Marché", 1], [18, "Livres", "Sido, poche", 3], [36.9, "Travaux", "Papier de verre, sous-couche", 4], [48.2, "Courses", "", 5]])
    addBudgetEntry(budget.entries, { amount, cat, note }, id(), day(-i));

  const order = ["maison", "roman", "yoga", "plantes", "lectures", "budget", "carnet"];
  return {
    updatedAt: Date.parse(NOW), schemaVersion: SCHEMA_VERSION, boardMerged: true,
    config: {
      name: "Selene", palette: "nigredo", mode: "dark", labels: {}, groups: {}, welcome: false,
      modules: [...order.map(m => ({ id: m, on: true })), { id: "assistant", on: false }],
      sky: { name: "Lille, Hauts-de-France, France", lat: 50.6, lon: 3.1, weather: false, realMoon: true },
      assistant: { model: "claude-sonnet-5", actions: false, share: Object.fromEntries(order.map(m => [m, false])) }
    },
    modules
  };
}

/* ---- la page, servie telle que publiée (dist/web) ---- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };
function serve() {
  const server = createServer(async (req, res) => {
    const p = path.join(root, "dist", "web", decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(path.join(root, "dist", "web"))) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }).end(await readFile(p)); }
    catch { res.writeHead(404).end(); }
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok(server)));
}

const DEVICES = {
  android: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 },  // 1080 × 1920
  ios: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 }       // 1320 × 2868
};
const SHOTS = [["01-accueil", "#accueil"], ["02-taches", "#maison"], ["03-ecriture", "#roman"], ["04-bilan", "#bilan"], ["05-lectures", "#lectures"]];

const site = demoSite();
parseBackup(createBackup({ updatedAt: 0, tasks: [] }, site)); // une donnée que l'app refuserait arrête tout ici
const server = await serve(), base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const [device, opts] of Object.entries(DEVICES)) {
    const dir = path.join(root, "dist", "store", device);
    await mkdir(dir, { recursive: true });
    const ctx = await browser.newContext({ ...opts, isMobile: true, hasTouch: true, colorScheme: "dark", locale: "fr-FR", timezoneId: "Europe/Paris", serviceWorkers: "block", reducedMotion: "reduce" });
    // Rien ne sort, sauf les polices de la page (Google Fonts) : pas de météo, pas de radar.
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|fonts\.googleapis\.com|fonts\.gstatic\.com)/, r => r.abort());
    await ctx.addInitScript(doc => { window.claude = { use: async () => null }; if (!localStorage.getItem("selene-site-v1")) localStorage.setItem("selene-site-v1", doc); }, JSON.stringify(site));
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(NOW));
    for (const [name, hash] of SHOTS) {
      await page.goto(base + hash); await page.waitForFunction(() => document.querySelector("#main")?.children.length, null, { timeout: 10000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
      console.log(`${device}/${name}.png`);
    }
    if (errors.length) throw new Error(`Erreurs JavaScript : ${errors.join(" | ")}`);
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
