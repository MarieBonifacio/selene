/* Backup contract v1. Keep the existing format and browser storage keys stable. */
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const collection = (value, name) => {
  if (!Array.isArray(value) || value.some(item => !record(item))) throw new Error(`${name} invalide`);
};
function parseBackup(text) {
  if (typeof text !== "string" || text.length > 5_000_000) throw new Error("Sauvegarde trop volumineuse");
  const data = JSON.parse(text);
  if (!record(data) || data.format !== "selene-v1" || !record(data.board) || !record(data.site)) throw new Error("Format de sauvegarde invalide");
  const { board, site } = data;
  collection(board.tasks, "Tâches");
  if (board.tasks.some(t => typeof t.id !== "string" || typeof t.title !== "string" ||
      (t.steps != null && (!Array.isArray(t.steps) || t.steps.some(s => !record(s) || typeof s.t !== "string"))))) throw new Error("Tâche invalide");
  if (!record(site.config) || (site.config.modules != null &&
      (!Array.isArray(site.config.modules) || site.config.modules.some(m => !record(m) || typeof m.id !== "string" || typeof m.on !== "boolean"))) ||
      (site.config.groups != null && !record(site.config.groups)) ||
      (site.config.labels != null && !record(site.config.labels)) ||
      (site.config.assistant != null && (!record(site.config.assistant) ||
        (site.config.assistant.share != null && !record(site.config.assistant.share))))) throw new Error("Configuration invalide");
  const sections = {
    budget: ["entries", "envelopes"], kundalini: ["sessions"],
    ecriture: ["chapters", "sessions", "fragments"], moth: ["posts"],
    phidippus: ["log"], musique: ["albums"], inbox: ["items"]
  };
  for (const [name, fields] of Object.entries(sections)) {
    if (site[name] == null) continue; // Older v1 exports are filled by S().
    if (!record(site[name])) throw new Error(`${name} invalide`);
    for (const field of fields) if (site[name][field] != null) collection(site[name][field], `${name}.${field}`);
  }
  for (const state of [board, site]) if (state.updatedAt != null &&
      (typeof state.updatedAt !== "number" || !Number.isFinite(state.updatedAt) || state.updatedAt < 0)) throw new Error("Date de modification invalide");
  return { board, site };
}
function createBackup(boardData, siteData, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ format: "selene-v1", exportedAt, board: boardData, site: siteData }, null, 2);
}
