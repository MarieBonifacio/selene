/* Backup contract v1. Keep the existing format and browser storage keys stable. */
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const collection = (value, name) => {
  if (!Array.isArray(value) || value.some(item => !record(item))) throw new Error(`${name} invalide`);
};
/* Un fichier de sauvegarde peut venir de n'importe où : chaque identifiant finit dans un attribut HTML
   et chaque nombre dans un calcul ou une boucle. On décrit ce qui est permis, tout le reste est refusé. */
const moduleId = (id, name) => { if (typeof id !== "string" || !MODULE_ID.test(id)) throw new Error(`${name} : identifiant invalide`); };
const num = (v, name, min = -Infinity, max = Infinity) => {
  if (v != null && (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)) throw new Error(`${name} invalide`);
};
const ids = (list, name) => { if (list.some(x => typeof x.id !== "string" || !x.id || x.id.length > 64)) throw new Error(`${name} : identifiant invalide`); };
const dated = (list, name) => { if (list.some(x => typeof x.date !== "string" || !validDate(x.date))) throw new Error(`${name} : date invalide`); };
function parseBackup(text) {
  if (typeof text !== "string" || text.length > 5_000_000) throw new Error("Sauvegarde trop volumineuse");
  const data = JSON.parse(text);
  if (!record(data) || data.format !== "selene-v1" || !record(data.board) || !record(data.site)) throw new Error("Format de sauvegarde invalide");
  const { board, site } = data;
  if (site.schemaVersion != null && !(Number.isInteger(site.schemaVersion) && site.schemaVersion >= 1)) throw new Error("Version de format invalide");
  if ((site.schemaVersion || 1) > SCHEMA_VERSION) throw new Error("Sauvegarde créée par une version plus récente de Selene : mets l'application à jour d'abord.");
  collection(board.tasks, "Tâches");
  if (board.tasks.some(t => typeof t.id !== "string" || typeof t.title !== "string" ||
      (t.steps != null && (!Array.isArray(t.steps) || t.steps.some(s => !record(s) || typeof s.t !== "string"))))) throw new Error("Tâche invalide");
  if (!record(site.config) || (site.config.modules != null &&
      (!Array.isArray(site.config.modules) || site.config.modules.some(m => !record(m) || typeof m.id !== "string" || typeof m.on !== "boolean"))) ||
      (site.config.groups != null && !record(site.config.groups)) ||
      (site.config.labels != null && !record(site.config.labels)) ||
      (site.config.assistant != null && (!record(site.config.assistant) ||
        (site.config.assistant.share != null && !record(site.config.assistant.share))))) throw new Error("Configuration invalide");
  for (const m of site.config.modules || []) moduleId(m.id, "Module");
  for (const map of [site.config.groups, site.config.labels, site.config.assistant && site.config.assistant.share])
    if (map) for (const k of Object.keys(map)) moduleId(k, "Configuration");
  const sections = {
    budget: ["entries", "envelopes"], kundalini: ["sessions"],
    ecriture: ["chapters", "sessions", "fragments"], moth: ["posts"],
    phidippus: ["log"], musique: ["albums"], inbox: ["items"]
  };
  for (const [name, fields] of Object.entries(sections)) {
    if (site[name] == null) continue; // Older v1 exports, or fields already moved under site.modules, are filled by S().
    if (!record(site[name])) throw new Error(`${name} invalide`);
    for (const field of fields) if (site[name][field] != null) collection(site[name][field], `${name}.${field}`);
  }
  // Anciennes sections, converties ensuite en modules : mêmes bornes que ci-dessous.
  if (site.kundalini) { num(site.kundalini.weeks, "kundalini.weeks", 1, 520); num(site.kundalini.perWeek, "kundalini.perWeek", 1, 7); }
  if (site.ecriture) num(site.ecriture.goal, "ecriture.goal", 0);
  if (site.phidippus) { num(site.phidippus.feedEvery, "phidippus.feedEvery", 0, 3650); num(site.phidippus.mistEvery, "phidippus.mistEvery", 0, 3650); }
  if (site.budget && site.budget.entries) for (const e of site.budget.entries) num(e.amount, "budget : montant");
  if (site.modules != null) {
    if (!record(site.modules)) throw new Error("modules invalide");
    for (const [id, inst] of Object.entries(site.modules)) {
      moduleId(id, "Module");
      if (reservedId(id)) throw new Error(`module ${id} : identifiant réservé`);
      if (!record(inst) || !["programme", "cumul", "rappels"].includes(inst.type) || typeof inst.label !== "string" || !record(inst.config)) throw new Error(`module ${id} invalide`);
      const c = inst.config, where = `module ${id}`;
      collection(inst.entries, `${where} entries`);
      ids(inst.entries, where); dated(inst.entries, where);
      for (const e of inst.entries) num(e.value, `${where} : valeur`);
      if (inst.scraps != null) { collection(inst.scraps, `${where} scraps`); ids(inst.scraps, where); }
      if (inst.type === "programme") {
        num(c.weeks, `${where} : durée`, 1, 520); num(c.perWeek, `${where} : séances par semaine`, 1, 7);
        if (c.start != null && !(typeof c.start === "string" && validDate(c.start))) throw new Error(`${where} : date de début invalide`);
      }
      if (inst.type === "cumul") {
        num(c.goal, `${where} : objectif`, 0);
        if (c.categories != null) { collection(c.categories, `${where} catégories`); ids(c.categories, where); c.categories.forEach(x => num(x.goal, `${where} : objectif de catégorie`, 0)); }
      }
      if (inst.type === "rappels" && c.types != null) {
        collection(c.types, `${where} types`); ids(c.types, where); c.types.forEach(x => num(x.every, `${where} : fréquence`, 0, 3650));
      }
    }
  }
  for (const state of [board, site]) if (state.updatedAt != null &&
      (typeof state.updatedAt !== "number" || !Number.isFinite(state.updatedAt) || state.updatedAt < 0)) throw new Error("Date de modification invalide");
  return { board, site };
}
function createBackup(boardData, siteData, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ format: "selene-v1", exportedAt, board: boardData, site: siteData }, null, 2);
}
