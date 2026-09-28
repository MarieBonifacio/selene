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
      (!Array.isArray(site.config.modules) || site.config.modules.some(m => !record(m) || typeof m.id !== "string" || typeof m.on !== "boolean" ||
        (m.group != null && (typeof m.group !== "string" || m.group.length > 40)) || // group : domaine de navigation, facultatif
        (m.sigil != null && (typeof m.sigil !== "string" || !/^[a-z]{1,20}$/.test(m.sigil)))))) || // sigil : glyphe de l'espace, facultatif
      (site.config.groups != null && !record(site.config.groups)) ||
      (site.config.labels != null && !record(site.config.labels)) ||
      (site.config.assistant != null && (!record(site.config.assistant) ||
        (site.config.assistant.share != null && !record(site.config.assistant.share)))) ||
      // sky : le lieu du ciel de l'accueil, facultatif ; ses coordonnées finissent dans une URL, son nom dans le HTML.
      (site.config.sky != null && (!record(site.config.sky) || typeof site.config.sky.name !== "string" || site.config.sky.name.length > 80 ||
        typeof site.config.sky.lat !== "number" || !(Math.abs(site.config.sky.lat) <= 90) || typeof site.config.sky.lon !== "number" || !(Math.abs(site.config.sky.lon) <= 180))) ||
      // radar : les mots du radar culturel, facultatifs.
      (site.config.radar != null && (!record(site.config.radar) || typeof site.config.radar.words !== "string" || site.config.radar.words.length > 300))) throw new Error("Configuration invalide");
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
      if (!record(inst) || !Object.hasOwn(MODULE_TYPES, inst.type) || typeof inst.label !== "string" || !record(inst.config)) throw new Error(`module ${id} invalide`);
      const where = `module ${id}`;
      collection(inst.entries, `${where} entries`);
      ids(inst.entries, where);
      if (MODULE_TYPES[inst.type].datedEntries !== false) dated(inst.entries, where);
      if (inst.scraps != null) { collection(inst.scraps, `${where} scraps`); ids(inst.scraps, where); }
      const fail = name => { throw new Error(`${where} : ${name} invalide`); };
      // Champs communs à tous les types : provenance d'une entrée rangée, pont de reprise du module.
      for (const x of [...inst.entries, ...(inst.scraps || [])]) if (x.origin != null &&
          (!record(x.origin) || typeof x.origin.text !== "string" || typeof x.origin.from !== "string" || (x.origin.date != null && !(typeof x.origin.date === "string" && validDate(x.origin.date))))) fail("provenance");
      for (const x of [...inst.entries, ...(inst.scraps || [])]) if (x.links != null && (!Array.isArray(x.links) || x.links.some(l => !record(l) ||
          typeof l.id !== "string" || !l.id || l.id.length > 64 || !Object.hasOwn(LINK_TYPES, l.type) || typeof l.to !== "string" || !LINK_REF.test(l.to) ||
          (l.date != null && !(typeof l.date === "string" && validDate(l.date)))))) fail("liaison");
      if (inst.resume != null && (!record(inst.resume) || typeof inst.resume.text !== "string" || typeof inst.resume.at !== "string" || !validDate(inst.resume.at))) fail("pont de reprise");
      if (inst.resumeLog != null) collection(inst.resumeLog, `${where} ponts`);
      // Palimpseste : les versions antérieures d'un fragment (cumul.scraps uniquement).
      for (const f of inst.scraps || []) {
        if (f.versions != null && (!Array.isArray(f.versions) || f.versions.some(x => !record(x) || typeof x.text !== "string" ||
            (x.at != null && !(typeof x.at === "string" && validDate(x.at)))))) fail("version");
        if (f.editedAt != null && !(typeof f.editedAt === "string" && validDate(f.editedAt))) fail("fragment");
      }
      // Règles propres au type : déclarées dans le registre (domain.js), appliquées ici.
      MODULE_TYPES[inst.type].validate(inst, {
        num: (v, name, min, max) => num(v, `${where} : ${name}`, min, max),
        list: (l, name) => { collection(l, `${where} ${name}`); ids(l, where); return l; },
        ep: x => { if ((x.ep != null && !Object.hasOwn(EP_STATUS, x.ep)) || (x.epLog != null && !Array.isArray(x.epLog))) fail("statut"); },
        fail
      });
    }
  }
  for (const state of [board, site]) if (state.updatedAt != null &&
      (typeof state.updatedAt !== "number" || !Number.isFinite(state.updatedAt) || state.updatedAt < 0)) throw new Error("Date de modification invalide");
  return { board, site };
}
function createBackup(boardData, siteData, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ format: "selene-v1", exportedAt, board: boardData, site: siteData }, null, 2);
}
