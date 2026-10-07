/* Les jeux de données de recette (docs/recette/donnees/*.json), produits par les fonctions du noyau : un format qui
   évolue casse ce générateur (ou l'import qu'il vérifie), jamais silencieusement les cas qui les emploient. Déterministe :
   relancé sans changement du noyau, il réécrit les mêmes fichiers (git ne voit rien). Lancé par `npm run recette -- jeux` ;
   chaque fichier est relu par parseBackup avant d'être écrit (un « refus-* » doit, lui, être refusé).
   Contenu entièrement fictif : aucune donnée personnelle, aucun secret. Description des fichiers : donnees/README.md. */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { MODULE_TEMPLATES, SCHEMA_VERSION, createFromTemplate, createModuleInstance, SECTION_TO_MODULE, addLink } from "../src/core/domain.js";
import { createBackup, parseBackup } from "../src/core/backup.js";
import { setupRegulation, saveRegulationEvent, closeRegulationDay, regulationSnapshot, addRegulationGoal } from "../src/core/regulation.js";

const OUT = path.join(path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."), "docs/recette/donnees");
const EXPORTED = "2026-10-04T08:00:00.000Z";
const tpl = id => MODULE_TEMPLATES.find(t => t.id === id);
const save = (name, board, site) => {
  const text = createBackup(board, site, EXPORTED);
  parseBackup(text); // refuse un jeu qui ne passerait pas l'import
  fs.writeFileSync(`${OUT}/${name}`, text + "\n");
  console.log("ok", name, (text.length / 1024).toFixed(1), "Kio");
};
const baseConfig = mods => ({ name: "Selene", palette: "nigredo", mode: "auto", lang: "", labels: {}, groups: {},
  modules: mods, assistant: { model: "claude-sonnet-5", actions: true, share: {} } });

/* ---------- 1. jeu-essai.json : un compte garni, contenu neutre, dates passées fixes ---------- */
{
  const modules = {};
  modules.inbox = SECTION_TO_MODULE.inbox({ items: [] }, "Boîte");
  modules.inbox.entries = [
    { id: "n1", text: "12,50 € courses du marché", date: "2026-09-21" },
    { id: "n2", text: "25 min yoga, salutation au soleil", date: "2026-09-22" },
    { id: "n3", text: "Écriture : la lisière comme seuil", date: "2026-09-23" },
    { id: "n4", text: "À lire : https://doi.org/10.1016/j.concog.2020.102946", date: "2026-09-24" },
    { id: "n5", text: "la brume précède la pluie", date: "2026-09-25", ep: "hyp", epLog: [{ from: null, to: "hyp", date: "2026-09-25" }] },
    { id: "n6", text: "Penser à rappeler la quincaillerie", date: "2026-08-02" }
  ];
  const ch = createFromTemplate(modules, tpl("taches"), "Chantier", "chantier");
  ch.config.groupLabel = "Pièce";
  ch.config.cats = ["Bricolage", "Artisan", "Achat"];
  ch.entries = [
    { id: "t1", title: "Repeindre la rambarde du balcon", room: "Balcon", cat: "Bricolage", due: "2026-09-15", effort: 2, cost: 120, note: "Peinture antirouille", today: false, done: false, doneAt: null, created: "2026-09-01", steps: [{ t: "Poncer", d: true }, { t: "Sous-couche", d: false }, { t: "Deux couches", d: false }] },
    { id: "t2", title: "Poser une étagère", room: "Salon", cat: "Bricolage", due: null, effort: 1, cost: 35, note: "", today: false, done: false, doneAt: null, created: "2026-09-02", steps: [] },
    { id: "t3", title: "Appeler le plombier", room: "Salle de bain", cat: "Artisan", due: null, effort: 1, cost: null, note: "Fuite sous l'évier", today: false, done: false, doneAt: null, created: "2026-09-03", steps: [] },
    { id: "t4", title: "Changer l'ampoule du couloir", room: "Couloir", cat: "Achat", due: "2026-09-05", effort: 1, cost: 8, note: "", today: false, done: true, doneAt: "2026-09-06", created: "2026-09-01", steps: [] },
    { id: "t5", title: "Nettoyer les gouttières du jardin", room: "Jardin", cat: "Bricolage", due: null, effort: 3, cost: null, note: "", today: false, done: false, doneAt: null, created: "2026-09-04", steps: [] }
  ];
  const yoga = createModuleInstance(modules, "programme", "Yoga", "yoga");
  Object.assign(yoga.config, { unitLabel: "min", start: "2026-08-03", weeks: 12, perWeek: 3,
    tiers: [{ id: "p1", name: "Souffle", criteria: [{ id: "c1", text: "12 séances à 20 min", done: false }, { id: "c2", text: "Tenir la posture de l'arbre une minute", done: false }] }] });
  yoga.entries = [
    { id: "y1", date: "2026-08-03", value: 20, note: "Première séance" },
    { id: "y2", date: "2026-08-05", value: 25, note: "" },
    { id: "y3", date: "2026-09-01", value: 30, note: "Dos raide" },
    { id: "y4", date: "2026-09-08", value: 25, note: "" }
  ];
  const ecr = createFromTemplate(modules, tpl("ecriture"), "Écriture", "ecriture");
  Object.assign(ecr.config, { goal: 50000, title: "La lisière", categories: [{ id: "c1", name: "Prologue", goal: 3000 }, { id: "c2", name: "La forêt", goal: 20000 }] });
  ecr.entries = [
    { id: "w1", date: "2026-08-10", value: 1200, note: "", category: "c1" },
    { id: "w2", date: "2026-08-20", value: 2300, note: "", category: "c2" },
    { id: "w3", date: "2026-09-02", value: 1800, note: "", category: "c2" }
  ];
  ecr.scraps = [
    { id: "f1", text: "La lisière n'est pas une frontière, c'est un lieu où l'on hésite.", date: "2026-08-11", category: "c1" },
    { id: "f2", text: "Le brouillard efface la route avant d'effacer la forêt.", date: "2026-08-12", category: "c2", ep: "obs", epLog: [{ from: null, to: "obs", date: "2026-08-12" }] },
    { id: "f3", text: "Toute lisière est un seuil que l'on traverse sans le voir.", date: "2026-08-14", category: "c1" },
    { id: "f4", text: "La lisière est au contraire une frontière nette, tracée par la coupe.", date: "2026-08-15", category: "c2" },
    { id: "f5", text: "Les sapins gardent la nuit plus longtemps que les hêtres.", date: "2026-08-16", ep: "hyp", epLog: [{ from: null, to: "hyp", date: "2026-08-16" }] },
    { id: "f6", text: "Une phrase sans chapitre, posée là comme une phalène, en attendant.", date: "2026-08-18" }
  ];
  addLink(ecr.scraps[2], "ecriture/f1", "derive", "l1", "2026-08-14");
  addLink(ecr.scraps[3], "ecriture/f1", "contredit", "l2", "2026-08-15");
  const pl = createFromTemplate(modules, tpl("rappels"), "Plantes", "plantes");
  pl.config.types = [{ id: "arrosage", label: "Arrosage", every: 3 }, { id: "rempotage", label: "Rempotage", every: 0 }];
  pl.entries = [
    { id: "r1", date: "2026-09-01", type: "arrosage", note: "" },
    { id: "r2", date: "2026-08-15", type: "rempotage", note: "Ficus, pot de 24 cm" },
    { id: "r3", date: "2026-08-20", type: "note", note: "Une feuille jaunit sur le ficus" }
  ];
  const bud = createFromTemplate(modules, tpl("budget"), "Budget", "budget");
  bud.config.envelopes = [{ id: "v1", name: "Courses", limit: 300 }, { id: "v2", name: "Travaux", limit: 500 }];
  bud.entries = [
    { id: "b1", type: "revenu", amount: 2000, cat: "", note: "Salaire", date: "2026-09-01" },
    { id: "b2", type: "dépense", amount: 120, cat: "Courses", note: "Marché", date: "2026-09-03" },
    { id: "b3", type: "dépense", amount: 45, cat: "Travaux", note: "Vis et chevilles", date: "2026-09-10" },
    { id: "b4", type: "dépense", amount: 210, cat: "Courses", note: "Grande surface", date: "2026-08-12" }
  ];
  const tab = createFromTemplate(modules, tpl("tableau"), "Tableau", "tableau");
  tab.entries = [
    { id: "k1", title: "Lichens d'automne", subtitle: "", tag: "Forêt", due: "2026-09-20", text: "Série de trois photos", status: "Idée" },
    { id: "k2", title: "Le hêtre fendu", subtitle: "", tag: "Forêt", due: "", text: "", status: "En cours" },
    { id: "k3", title: "Brume sur l'étang", subtitle: "", tag: "Eau", due: "", text: "", status: "Prêt" },
    { id: "k4", title: "Héron cendré", subtitle: "", tag: "Eau", due: "2026-08-30", text: "", status: "Publié" }
  ];
  const src = createFromTemplate(modules, tpl("sources"), "Sources", "sources");
  src.entries = [
    { id: "s1", title: "Depersonalization and the self", subtitle: "Ciaunica, Charlton, Farmer", tag: "Article", due: "", text: "", status: "À lire",
      src: { url: "https://doi.org/10.1016/j.concog.2020.102946", doi: "10.1016/j.concog.2020.102946", site: "Consciousness and Cognition", date: "2020" }, kept: "2026-08-01" },
    { id: "s2", title: "La forêt, lieu commun", subtitle: "", tag: "Page", due: "", text: "Note de lecture", status: "Lue",
      src: { url: "https://exemple.org/foret", site: "exemple.org", date: "2025-11" }, kept: "2026-08-05" }
  ];
  addLink(src.entries[0], "ecriture/f2", "documente", "l3", "2026-08-06");
  const mot = createFromTemplate(modules, tpl("motifs"), "Motifs", "motifs");
  mot.entries = [
    { id: "m1", title: "lisière", subtitle: "", tag: "", due: "", text: "", status: "Vivant" },
    { id: "m2", title: "brume", subtitle: "brouillard", tag: "", due: "", text: "", status: "Vivant" },
    { id: "m3", title: "phalène", subtitle: "", tag: "", due: "", text: "", status: "Épuisé" }
  ];
  const dec = createFromTemplate(modules, tpl("decisions"), "Décisions", "decisions");
  dec.entries = [
    { id: "d1", title: "Enduit à la chaux pour le mur nord", subtitle: "", tag: "Maison", due: "2020-01-01", text: "Humidité du mur nord. Réviser si le devis dépasse 1 200 €.", status: "Prise" },
    { id: "d2", title: "Placo dans la chambre", subtitle: "", tag: "Maison", due: "2020-01-01", text: "Trop de poussière.", status: "Abandonnée" }
  ];
  const mus = createFromTemplate(modules, tpl("musique"), "Musique", "musique");
  mus.entries = [
    { id: "a1", title: "Kate Bush", subtitle: "", tag: "", due: "", text: "", status: "À écouter" },
    { id: "a2", title: "Dead Can Dance", subtitle: "Within the Realm of a Dying Sun", tag: "", due: "", text: "", status: "Écouté" }
  ];
  const arc = createFromTemplate(modules, tpl("arc"), "Arc", "arc");
  arc.entries = [{ id: "pl1", station: "1", ref: "ecriture/f1", at: "2026-08-20" }];
  const car = createFromTemplate(modules, tpl("carnet"), "Carnet", "carnet");
  car.entries = [{ id: "c1", text: "Le héron revient chaque matin à la même pierre.", date: "2026-08-21" }];
  const order = ["inbox", "chantier", "budget", "plantes", "yoga", "ecriture", "sources", "motifs", "tableau", "arc", "decisions", "musique", "carnet"];
  const groups = { chantier: "Maison", budget: "Maison", plantes: "Maison", decisions: "Maison", ecriture: "Création", sources: "Création", motifs: "Création", tableau: "Création", arc: "Création" };
  const mods = [...order.map(id => ({ id, on: true, ...(groups[id] ? { group: groups[id] } : {}) })), { id: "assistant", on: false }];
  const site = { updatedAt: 1, schemaVersion: SCHEMA_VERSION, boardMerged: true, config: baseConfig(mods), modules };
  site.config.assistant.share = Object.fromEntries(order.map(id => [id, true]));
  save("jeu-essai.json", { tasks: [] }, site);
}

/* ---------- 2. ancien-format-1.json : sections du format 1, et le document « board » d'avant le format 6 ---------- */
{
  const site = { updatedAt: 1000,
    config: { name: "Selene", palette: "nigredo", mode: "auto", labels: { phidippus: "Aragne" }, groups: {},
      modules: ["chantier", "kundalini", "ecriture", "moth", "phidippus", "musique", "budget", "assistant", "inbox"].map(id => ({ id, on: id !== "assistant" })),
      assistant: { model: "claude-sonnet-5", actions: true, share: { chantier: true, kundalini: true, ecriture: true, moth: true, phidippus: true, musique: true, budget: false, inbox: true } } },
    budget: { entries: [{ id: "b1", type: "dépense", amount: 42.5, cat: "Courses", note: "Marché", date: "2025-01-12" }], envelopes: [{ id: "v1", name: "Courses", limit: 300 }] },
    kundalini: { start: "2025-01-06", weeks: 12, perWeek: 5, sessions: [{ id: "s1", date: "2025-01-06", min: 20, note: "Premier jour" }] },
    ecriture: { title: "Mon livre", goal: 40000, chapters: [{ id: "c1", name: "Prologue", goal: 2000 }], sessions: [{ id: "w1", date: "2025-01-06", words: 500, chapter: "c1" }], fragments: [{ id: "f1", date: "2025-01-06", text: "Une phrase qui passe" }] },
    moth: { posts: [{ id: "p1", title: "Le lichen", theme: "Forêt", due: "2025-02-01", status: "Prêt", caption: "Légende du lichen" }, { id: "p2", title: "Ancien statut", theme: "", due: "", status: "Inconnu", caption: "" }] },
    phidippus: { name: "Aragne", feedEvery: 6, mistEvery: 3, log: [{ id: "l1", date: "2025-01-06", type: "repas", note: "Un grillon" }] },
    musique: { albums: [{ id: "a1", artist: "Dead Can Dance", album: "Aion", status: "Retenu", note: "nocturne" }] },
    inbox: { items: [{ id: "i1", text: "acheter des clous", date: "2025-01-07" }] } };
  const board = { updatedAt: 900, tasks: [{ id: "t1", title: "Poser le velux", room: "Chambre", cat: "Bricolage", due: null, effort: 2, cost: 250, note: "", today: false, done: false, doneAt: null, created: "2025-01-05", steps: [{ t: "Devis", d: true }] }] };
  save("ancien-format-1.json", board, site);
}

/* ---------- 3. refus-version-future.json : un format plus récent que l'app ---------- */
{
  const site = { updatedAt: 1, schemaVersion: 99, boardMerged: true, config: baseConfig([{ id: "inbox", on: true }]), modules: { inbox: SECTION_TO_MODULE.inbox({ items: [{ id: "i1", text: "venue du futur", date: "2026-09-01" }] }) } };
  const text = createBackup({ tasks: [] }, site, EXPORTED);
  try { parseBackup(text); throw new Error("devait être refusé"); } catch (e) { if (e.code !== "backup-too-new") throw e; }
  fs.writeFileSync(`${OUT}/refus-version-future.json`, text + "\n"); console.log("ok (refusé comme attendu) refus-version-future.json");
}

/* ---------- 4. refus-hostile.json : un identifiant de module piégé ---------- */
{
  const site = { updatedAt: 1, schemaVersion: SCHEMA_VERSION, boardMerged: true,
    config: baseConfig([{ id: "inbox", on: true }, { id: "\"><img src=x onerror=alert(1)>", on: true }]),
    modules: { inbox: SECTION_TO_MODULE.inbox({ items: [{ id: "i1", text: "<script>alert('recette')</script>", date: "2026-09-01" }] }) } };
  const text = createBackup({ tasks: [] }, site, EXPORTED);
  try { parseBackup(text); throw new Error("devait être refusé"); } catch (e) { if (!/identifiant invalide/.test(e.message)) throw e; }
  fs.writeFileSync(`${OUT}/refus-hostile.json`, text + "\n"); console.log("ok (refusé comme attendu) refus-hostile.json");
}

/* ---------- 5. et 6. Reprendre la main : un suivi à configurer, un suivi en cours (sur l'appareil) ---------- */
{
  const mk = () => ({ inbox: SECTION_TO_MODULE.inbox({ items: [] }, "Boîte") });
  const vierge = mk();
  createModuleInstance(vierge, "regulation", "Carnet du soir", "carnet-du-soir");
  const mods = [{ id: "inbox", on: true }, { id: "carnet-du-soir", on: true }, { id: "assistant", on: false }];
  const siteV = { updatedAt: 1, schemaVersion: SCHEMA_VERSION, boardMerged: true, config: baseConfig(mods), modules: vierge };
  siteV.config.assistant.share = { inbox: true, "carnet-du-soir": false };
  save("rlm-a-configurer.json", { tasks: [] }, siteV);

  const enCours = mk();
  const r = createModuleInstance(enCours, "regulation", "Carnet du soir", "carnet-du-soir");
  const T = "2026-09-30", at = d => Date.parse(d + "T20:00:00Z");
  setupRegulation(r, { subject: "alcool", date: "2026-09-01", mode: "reduire", limit: "2" }, "g1", T, at("2026-09-01"));
  addRegulationGoal(r, { date: "2026-09-20", mode: "reduire", limit: "1,5" }, "g2", T, at("2026-09-20"));
  const ev = (kind, date, extra, id) => saveRegulationEvent(r, { kind, date, ...extra }, id, T, at(date), "Europe/Paris");
  ev("use", "2026-09-10", { value: "1,5", note: "Repas de famille" }, "u1");
  ev("use", "2026-09-10", { value: "1" }, "u2");
  ev("urge", "2026-09-11", { intensity: "6", note: "Après le travail", strategy: "Marcher quelques minutes", outcome: "utile" }, "e1");
  ev("action", "2026-09-11", { strategy: "Marcher quelques minutes" }, "a1");
  ev("use", "2026-09-12", { value: "1" }, "u3");
  closeRegulationDay(r, "2026-09-10", regulationSnapshot(r, "2026-09-10"), T, at("2026-09-10"), "Europe/Paris");
  closeRegulationDay(r, "2026-09-11", regulationSnapshot(r, "2026-09-11"), T, at("2026-09-11"), "Europe/Paris");
  Object.assign(r.config, { storage: "device", holder: "drecette" });
  const siteE = { updatedAt: 1, schemaVersion: SCHEMA_VERSION, boardMerged: true, config: baseConfig(mods), modules: enCours };
  siteE.config.assistant.share = { inbox: true, "carnet-du-soir": false };
  save("rlm-en-cours.json", { tasks: [] }, siteE);
}

/* ---------- 7. rlm-synchronise-ancien.json : un suivi encore synchronisé, avec un accord daté (d'avant le 3 octobre) ---------- */
{
  const mods = [{ id: "inbox", on: true }, { id: "carnet-du-soir", on: true }, { id: "assistant", on: false }];
  const m = { inbox: SECTION_TO_MODULE.inbox({ items: [] }, "Boîte") };
  const r = createModuleInstance(m, "regulation", "Carnet du soir", "carnet-du-soir");
  const T = "2026-09-30", at = d => Date.parse(d + "T20:00:00Z");
  setupRegulation(r, { subject: "tabac", date: "2026-09-01", mode: "observer" }, "g1", T, at("2026-09-01"));
  saveRegulationEvent(r, { kind: "use", date: "2026-09-15", value: "3", note: "Pause café" }, "u1", T, at("2026-09-15"), "Europe/Paris");
  Object.assign(r.config, { storage: "account", consent: { at: at("2026-09-01"), version: 1 } });
  const site = { updatedAt: 1, schemaVersion: SCHEMA_VERSION, boardMerged: true, config: baseConfig(mods), modules: m };
  site.config.assistant.share = { inbox: true, "carnet-du-soir": false };
  save("rlm-synchronise-ancien.json", { tasks: [] }, site);
}

/* ---------- 8. Export Instagram synthétique (pas une sauvegarde Selene) ---------- */
{
  const moji = s => [...Buffer.from(s, "utf8")].map(b => String.fromCharCode(b)).join(""); // l'encodage abîmé de Meta
  const ts = iso => Math.floor(Date.parse(iso) / 1000);
  const posts = [
    { media: [{ uri: "media/posts/202509/a.jpg", creation_timestamp: ts("2025-09-14T19:00:00Z"), title: moji("Phalène du bouleau 🌙\nVue sur le balcon, à minuit. #recette") }] },
    { title: moji("Trois ailes <img src=x onerror=alert('recette')>"), creation_timestamp: ts("2026-03-02T12:00:00Z"), media: [{ uri: "a.jpg" }, { uri: "b.jpg" }, { uri: "c.jpg" }] }
  ];
  const reels = { ig_reels_media: [{ media: [{ uri: "r.mp4", creation_timestamp: ts("2026-06-21T21:00:00Z"), title: "" }] }] };
  fs.writeFileSync(`${OUT}/instagram-posts_1.json`, JSON.stringify(posts, null, 2) + "\n");
  fs.writeFileSync(`${OUT}/instagram-reels.json`, JSON.stringify(reels, null, 2) + "\n");
  console.log("ok instagram-posts_1.json, instagram-reels.json");
}

/* ---------- 9. coffre-markdown/ : un petit coffre Obsidian synthétique, pour l'import de notes Markdown ---------- */
{
  const dir = `${OUT}/coffre-markdown`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(`${dir}/.obsidian`, { recursive: true });
  const files = {
    "Le seuil.md": "---\ndate: 2024-01-05\nstatut: hypothèse\naliases: [Seuil]\n---\n# Le seuil\n\nLe paratexte comme [[La lisière|lisière]] du texte.\n\nDeuxième paragraphe.\n",
    "2024-02-10 Lecture.md": "# La lisière\n\nRenvoie au [[Seuil]].\n![[schema.png]]\nUn titre piégé : <img src=x onerror=alert('recette')>\n",
    "202403011530 Idée.md": "Une idée datée par son identifiant Zettlr. %% commentaire privé %%\n",
    ".obsidian/workspace.md": "réglages de l'éditeur : à ne pas importer\n"
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(`${dir}/${name}`, text);
  console.log("ok coffre-markdown/ (" + Object.keys(files).length + " fichiers)");
}
