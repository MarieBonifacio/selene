/* Captures d'écran pour les stores (docs/publication.md) : `npm run screenshots` → dist/store/{fr,en}/{android,ios}/*.png
   (`npm run screenshots -- en` : une seule langue).
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
import { MODULE_TEMPLATES, createFromTemplate, addTask, setTaskDone, setTaskToday, addBudgetEntry, addJournalEntry, saveCollectionItem, localizeConfig, SCHEMA_VERSION } from "../src/core/domain.js";
import en from "../src/app/i18n/en.js";
import { createBackup, parseBackup } from "../src/core/backup.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const NOW = "2026-10-06T09:30:00+02:00", TODAY = "2026-10-06";
const day = n => { const d = new Date(TODAY + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let n = 0; const id = () => `demo${(++n).toString(36).padStart(4, "0")}`;
const tpl = name => MODULE_TEMPLATES.find(t => t.id === name);

/* ---- l'espace de démonstration, en français et en anglais ----
   Même structure, mêmes dates, mêmes chiffres : seuls les mots changent. Les modèles passent par localizeConfig avec le
   dictionnaire de l'app (src/app/i18n/en.js), comme quand une personne crée un espace dans l'interface anglaise ;
   le contenu (tâches, fragments, livres), lui, est écrit ici dans chaque langue. */
const DEMO = {
  fr: {
    names: { maison: "Maison", roman: "Roman", yoga: "Yoga", plantes: "Plantes", lectures: "Lectures", budget: "Budget", carnet: "Carnet" },
    rooms: { groupLabel: "Pièce", catLabel: "Type", cats: ["Bricolage", "Achat", "Rangement", "Administratif"] },
    tasks: [
      ["Repeindre les volets", "Façade", 0, 3, 85, ["Poncer", "Sous-couche", "Deux couches"]],
      ["Réparer le robinet de l'évier", "Cuisine", 0, 0, 12, []],
      ["Trier les livres du palier", "Bureau", 2, null, null, []],
      ["Commander des bocaux", "Cuisine", 1, 5, 24, []],
      ["Déclarer les travaux à la mairie", "Façade", 3, 9, null, []],
      ["Tailler la glycine", "Jardin", 0, 2, null, []],
      ["Changer l'ampoule du couloir", "Entrée", 0, null, 6, []],
      ["Vider la cave", "Cave", 2, null, null, []],
      ["Renouveler l'assurance", "Bureau", 3, null, null, []]
    ],
    novel: { title: "Les heures claires", chapters: ["I. L'arrivée", "II. La crue", "III. Le phare"], scraps: [
      "L'eau n'a pas prévenu : elle a simplement cessé de se tenir à sa place.",
      "Le bac ne traversait plus que deux fois par jour, et personne ne savait dire lesquelles.",
      "Une lumière qui tourne n'éclaire rien longtemps ; c'est pour cela qu'on la voit de loin."] },
    care: ["Arrosage", "Engrais", "Rempotage"],
    books: [["Mrs Dalloway", "Virginia Woolf", "Roman", 2], ["Sido", "Colette", "Récit", 1], ["Le Temps retrouvé", "Marcel Proust", "Roman", 0],
      ["Les Vagues", "Virginia Woolf", "Roman", 0], ["La Maison de Claudine", "Colette", "Récit", 2], ["Du côté de chez Swann", "Marcel Proust", "Roman", 1]],
    envelopes: ["Travaux", "Courses", "Livres"],
    spending: [[62.4, 1, "Marché", 1], [18, 2, "Sido, poche", 3], [36.9, 0, "Papier de verre, sous-couche", 4], [48.2, 1, "", 5]],
    placeholder: "Une idée, une course, un rêve…",
    notes: ["Demander à la bibliothèque le livre sur les phares du Nord", "Idée : la crue racontée par le chien", "Graines de capucine pour le balcon"]
  },
  en: {
    names: { maison: "Home", roman: "Novel", yoga: "Yoga", plantes: "Plants", lectures: "Reading", budget: "Budget", carnet: "Notebook" },
    rooms: { groupLabel: "Room", catLabel: "Type", cats: ["DIY", "Purchase", "Tidying", "Paperwork"] },
    tasks: [
      ["Repaint the shutters", "Front", 0, 3, 85, ["Sand", "Undercoat", "Two coats"]],
      ["Fix the kitchen sink tap", "Kitchen", 0, 0, 12, []],
      ["Sort the books on the landing", "Study", 2, null, null, []],
      ["Order some jars", "Kitchen", 1, 5, 24, []],
      ["File the works notice at the town hall", "Front", 3, 9, null, []],
      ["Prune the wisteria", "Garden", 0, 2, null, []],
      ["Change the hallway bulb", "Hallway", 0, null, 6, []],
      ["Clear out the cellar", "Cellar", 2, null, null, []],
      ["Renew the insurance", "Study", 3, null, null, []]
    ],
    novel: { title: "The Clear Hours", chapters: ["I. The arrival", "II. The flood", "III. The lighthouse"], scraps: [
      "The water gave no warning: it simply stopped keeping to its place.",
      "The ferry only crossed twice a day now, and no one could say which times.",
      "A turning light lights nothing for long; that is why it can be seen from afar."] },
    care: ["Watering", "Feeding", "Repotting"],
    books: [["Mrs Dalloway", "Virginia Woolf", "Novel", 2], ["Sido", "Colette", "Memoir", 1], ["Time Regained", "Marcel Proust", "Novel", 0],
      ["The Waves", "Virginia Woolf", "Novel", 0], ["My Mother's House", "Colette", "Memoir", 2], ["Swann's Way", "Marcel Proust", "Novel", 1]],
    envelopes: ["Repairs", "Groceries", "Books"],
    spending: [[62.4, 1, "Market", 1], [18, 2, "Sido, paperback", 3], [36.9, 0, "Sandpaper, undercoat", 4], [48.2, 1, "", 5]],
    placeholder: "An idea, an errand, a dream…",
    notes: ["Ask the library for the book on the northern lighthouses", "Idea: the flood told by the dog", "Nasturtium seeds for the balcony"]
  }
};
// La traduction des modèles, comme l'interface la ferait : le dictionnaire anglais, sinon le texte français.
const translator = lang => lang === "en" ? s => (typeof en[s] === "string" ? en[s] : s) : s => s;
function demoSite(lang) {
  n = 0;
  const D = DEMO[lang], t = translator(lang), modules = {};
  const make = (template, key) => {
    const base = tpl(template);
    return createFromTemplate(modules, { ...base, config: localizeConfig(JSON.parse(JSON.stringify(base.config || {})), t) }, D.names[key], key, t);
  };
  const maison = make("taches", "maison");
  Object.assign(maison.config, { ...D.rooms, cats: [...D.rooms.cats], costs: true });
  for (const [title, room, c, due, cost, steps] of D.tasks)
    addTask(maison.entries, { title, room, cat: D.rooms.cats[c], due: due == null ? null : day(due), cost, steps: steps.map((s, i) => ({ t: s, d: i === 0 })) }, id(), day(-12));
  for (const [i, when] of [[6, -2], [7, -8], [8, -15]]) setTaskDone(maison.entries, maison.entries[i].id, true, day(when));
  setTaskToday(maison.entries, maison.entries[1].id, true); setTaskToday(maison.entries, maison.entries[5].id, true);

  const roman = make("ecriture", "roman");
  const ch = D.novel.chapters.map((name, i) => ({ id: `c${i + 1}`, name, goal: [18000, 22000, 20000][i] }));
  Object.assign(roman.config, { title: D.novel.title, goal: 60000, entryMode: "delta", categories: ch });
  addJournalEntry(roman, { value: 16800, category: "c1" }, id(), day(-40));
  for (let i = 30; i >= 12; i -= 2) addJournalEntry(roman, { value: 420 + (i * 37) % 480, category: "c1" }, id(), day(-i));
  for (let i = 9; i >= 0; i--) addJournalEntry(roman, { value: 380 + (i * 53) % 400, category: "c2" }, id(), day(-i)); // une série en cours
  roman.scraps.push(...[[-3, "c2"], [-6, "c1"], [-9, "c3"]].map(([d, category], i) => ({ id: id(), date: day(d), category, text: D.novel.scraps[i] })));

  const yoga = make("protocole", "yoga");
  Object.assign(yoga.config, { unitLabel: "min", start: day(-24), weeks: 8, perWeek: 4 });
  for (const i of [23, 21, 20, 18, 16, 14, 13, 11, 9, 7, 6, 4, 2, 1]) addJournalEntry(yoga, { value: 20 + (i % 3) * 10 }, id(), day(-i));

  const plantes = make("rappels", "plantes");
  plantes.config.types = [["arrosage", 3], ["engrais", 14], ["rempotage", 0]].map(([tid, every], i) => ({ id: tid, label: D.care[i], every }));
  for (const [tp, i] of [["arrosage", 4], ["arrosage", 7], ["engrais", 9], ["rempotage", 40]]) addJournalEntry(plantes, { type: tp }, id(), day(-i));

  const lectures = make("decouvertes", "lectures"); // statuts : à découvrir, découvert, retenu, dans la langue du modèle
  for (const [title, subtitle, tag, st] of D.books) saveCollectionItem(lectures, { title, subtitle, tag, status: lectures.config.statuses[st] }, id(), day(-20));

  const budget = make("budget", "budget");
  budget.config.envelopes = D.envelopes.map((name, i) => ({ id: id(), name, limit: [400, 350, 40][i] }));
  for (const [amount, e, note, i] of D.spending) addBudgetEntry(budget.entries, { amount, cat: D.envelopes[e], note }, id(), day(-i));

  const carnet = make("carnet", "carnet");
  Object.assign(carnet.config, { inbox: true, placeholder: D.placeholder });
  D.notes.forEach((text, i) => addJournalEntry(carnet, { text }, id(), day(-i)));

  const order = ["maison", "roman", "yoga", "plantes", "lectures", "budget", "carnet"];
  return {
    updatedAt: Date.parse(NOW), schemaVersion: SCHEMA_VERSION, boardMerged: true,
    config: {
      name: "Selene", palette: "nigredo", mode: "dark", lang, labels: {}, groups: {}, welcome: false,
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

// Les langues de la fiche : l'appareil dit la même que le compte (config.lang), pour que rien ne dépende de l'ordre.
const LOCALES = { fr: "fr-FR", en: "en-GB" };
const langs = process.argv.slice(2).filter(l => Object.hasOwn(LOCALES, l));
const sites = Object.fromEntries((langs.length ? langs : Object.keys(LOCALES)).map(lang => [lang, demoSite(lang)]));
for (const site of Object.values(sites)) parseBackup(createBackup({ updatedAt: 0, tasks: [] }, site)); // une donnée que l'app refuserait arrête tout ici
const server = await serve(), base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const [lang, site] of Object.entries(sites)) for (const [device, opts] of Object.entries(DEVICES)) {
    const dir = path.join(root, "dist", "store", lang, device);
    await mkdir(dir, { recursive: true });
    const ctx = await browser.newContext({ ...opts, isMobile: true, hasTouch: true, colorScheme: "dark", locale: LOCALES[lang], timezoneId: "Europe/Paris", serviceWorkers: "block", reducedMotion: "reduce" });
    // Rien ne sort (les polices sont servies par le site) : pas de météo, pas de radar.
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await ctx.addInitScript(doc => { window.claude = { use: async () => null }; if (!localStorage.getItem("selene-site-v1")) localStorage.setItem("selene-site-v1", doc); }, JSON.stringify(site));
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(NOW));
    for (const [name, hash] of SHOTS) {
      await page.goto(base + hash); await page.waitForFunction(() => document.querySelector("#main")?.children.length, null, { timeout: 10000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
      console.log(`${lang}/${device}/${name}.png`);
    }
    if (errors.length) throw new Error(`Erreurs JavaScript : ${errors.join(" | ")}`);
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
