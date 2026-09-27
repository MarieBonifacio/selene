/* Business operations shared by the UI and assistant. No DOM or storage access. */
const requireText = (value, label, max) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} manquant`);
  return value.trim().slice(0, max);
};
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};
function addTask(tasks, input, id, date) {
  const t = {
    id, title: requireText(input.title, "Tâche", 140), room: input.room || "",
    cat: input.cat || "Bricolage", due: input.due && validDate(input.due) ? input.due : null,
    effort: input.effort || 1, cost: input.cost ?? null, note: input.note || "",
    today: false, done: false, doneAt: null, created: date,
    steps: (input.steps || []).map(s => ({ t: s.t, d: !!s.d }))
  };
  tasks.push(t);
  return t;
}
function setTaskDone(tasks, id, done, date) {
  const t = tasks.find(x => x.id === id);
  if (!t) throw new Error("Tâche introuvable");
  t.done = !!done;
  t.doneAt = done ? date : null;
  if (done) t.today = false;
  return t;
}
function setTaskToday(tasks, id, value) {
  const t = tasks.find(x => x.id === id);
  if (!t) throw new Error("Tâche introuvable");
  if (value && !t.today && tasks.filter(x => !x.done && x.today).length >= 3) throw new Error("Trois tâches du jour maximum");
  t.today = !!value;
  return t;
}
function addCapture(items, text, id, date) {
  const item = { id, text: requireText(text, "Note", 500), date };
  items.push(item);
  return item;
}
function addBudgetEntry(entries, input, id, defaultDate) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");
  const date = input.date || defaultDate;
  if (!validDate(date)) throw new Error("Date invalide");
  const entry = {
    id, type: input.type === "revenu" ? "revenu" : "dépense",
    amount, cat: input.cat || "", note: input.note || "", date
  };
  entries.push(entry);
  return entry;
}

/* ---- modules génériques : programme (calendrier + objectif/semaine), cumul (compteur + catégories), rappels (types récurrents) ----
   Ne recrée jamais un module par défaut manquant : un module neuf en a déjà un exemplaire via siteSeed(),
   et un module absent chez un site existant a été supprimé exprès (ne pas ressusciter). */
/* Version du format des données du site. 1 = sections en dur (kundalini, ecriture, phidippus à la racine),
   2 = modules génériques sous `modules`. Une version de l'app qui lit un numéro plus grand que le sien
   ne doit ni fusionner ni écrire : elle ne connaît pas la forme de ces données. */
const SCHEMA_VERSION = 2;
function migrateModules(d) {
  d.modules = d.modules || {};
  if (d.kundalini) {
    if (!d.modules.kundalini) d.modules.kundalini = {
      type: "programme", label: (d.config && d.config.labels && d.config.labels.kundalini) || "Kundalini",
      config: { unitLabel: "min", start: d.kundalini.start ?? null, weeks: d.kundalini.weeks ?? 12, perWeek: d.kundalini.perWeek ?? 5 },
      entries: (d.kundalini.sessions || []).map(x => ({ id: x.id, date: x.date, value: x.min ?? null, note: x.note || "" }))
    };
    delete d.kundalini;
  }
  if (d.ecriture) {
    if (!d.modules.ecriture) d.modules.ecriture = {
      type: "cumul", label: (d.config && d.config.labels && d.config.labels.ecriture) || "Écriture",
      config: { unitLabel: "mots", goal: d.ecriture.goal ?? 40000, title: d.ecriture.title || "", categories: (d.ecriture.chapters || []).map(x => ({ id: x.id, name: x.name, goal: x.goal })), categoryLabel: "Chapitre", scraps: true, scrapsLabel: "Fragments" },
      entries: (d.ecriture.sessions || []).map(x => ({ id: x.id, date: x.date, value: x.words ?? null, category: x.chapter || "" })),
      scraps: (d.ecriture.fragments || []).map(f => ({ id: f.id, date: f.date, text: f.text }))
    };
    delete d.ecriture;
  }
  if (d.phidippus) {
    if (!d.modules.phidippus) d.modules.phidippus = {
      type: "rappels", label: (d.config && d.config.labels && d.config.labels.phidippus) || "Phidippus",
      config: { subtitle: d.phidippus.name || "", types: [{ id: "repas", label: "Repas", every: d.phidippus.feedEvery ?? 6 }, { id: "brumisation", label: "Brumisation", every: d.phidippus.mistEvery ?? 3 }, { id: "mue", label: "Mue", every: 0 }] },
      entries: (d.phidippus.log || []).map(x => ({ id: x.id, date: x.date, type: x.type, note: x.note || "" }))
    };
    delete d.phidippus;
  }
}
/* ---- registre des types de module : la partie pure (sans DOM) ----
   Chaque type déclare ses valeurs par défaut, la forme de ses entrées et ses règles de validation.
   Sa partie affichage est dans TYPE_UI (types.js) : un test vérifie que les deux registres ont les mêmes clés. */
const MODULE_TYPES = {
  programme: {
    label: "Programme (calendrier + objectif hebdomadaire)",
    defaults: () => ({ config: { unitLabel: "min", start: null, weeks: 12, perWeek: 5 }, entries: [] }),
    entry: (e, input) => { e.value = numericValue(input.value); },
    validate(inst, v) {
      v.num(inst.config.weeks, "durée", 1, 520); v.num(inst.config.perWeek, "séances par semaine", 1, 7);
      if (inst.config.start != null && !(typeof inst.config.start === "string" && validDate(inst.config.start))) v.fail("date de début");
      for (const e of inst.entries) v.num(e.value, "valeur");
    }
  },
  cumul: {
    label: "Objectif cumulatif (compteur + catégories)",
    defaults: () => ({ config: { unitLabel: "unités", goal: 100, title: "", categories: [], categoryLabel: "Catégorie", scraps: false, scrapsLabel: "Notes" }, entries: [], scraps: [] }),
    entry: (e, input) => { e.value = numericValue(input.value); if (input.category != null) e.category = input.category; },
    validate(inst, v) {
      v.num(inst.config.goal, "objectif", 0);
      if (inst.config.categories != null) v.list(inst.config.categories, "catégories").forEach(x => v.num(x.goal, "objectif de catégorie", 0));
      for (const e of inst.entries) v.num(e.value, "valeur");
    }
  },
  rappels: {
    label: "Rappels (types récurrents + journal)",
    defaults: () => ({ config: { subtitle: "", types: [{ id: "fait", label: "Fait", every: 0 }] }, entries: [] }),
    entry: (e, input) => { e.type = input.type || "note"; },
    validate(inst, v) { if (inst.config.types != null) v.list(inst.config.types, "types").forEach(x => v.num(x.every, "fréquence", 0, 3650)); }
  }
};
function numericValue(raw) {
  const value = raw != null && raw !== "" ? Number(raw) : null;
  if (value !== null && !Number.isFinite(value)) throw new Error("Valeur invalide"); // un NaN contaminerait tous les totaux
  return value;
}
function addJournalEntry(instance, input, id, defaultDate) {
  const date = input.date && validDate(input.date) ? input.date : defaultDate;
  const entry = { id, date, note: input.note || "" };
  MODULE_TYPES[instance.type].entry(entry, input);
  instance.entries.push(entry);
  return entry;
}
function deleteJournalEntry(instance, id) { instance.entries = instance.entries.filter(x => x.id !== id); }
/* L'identifiant d'un module sert aussi de route (#id) : il ne doit jamais masquer une vue fixe
   ni un nom hérité d'Object.prototype (« constructor », « toString »…), que `obj[id]` trouverait. */
const RESERVED_IDS = ["accueil", "reglages", ...Object.keys(MODULE_TYPES)];
const reservedId = id => RESERVED_IDS.includes(id) || id in Object.prototype;
/* Forme qu'un identifiant de module peut avoir, quelle que soit sa provenance (slugId, sauvegarde, serveur). */
const MODULE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
function slugId(name, existing) {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "module";
  let id = base, n = 2;
  while (existing.includes(id) || reservedId(id)) { id = `${base}-${n}`; n++; }
  return id;
}
function createModuleInstance(modules, type, name, id) {
  const label = requireText(name, "Nom du module", 60);
  if (reservedId(id)) throw new Error("Identifiant réservé");
  if (Object.hasOwn(modules, id)) throw new Error("Identifiant déjà utilisé");
  if (!Object.hasOwn(MODULE_TYPES, type)) throw new Error("Type de module inconnu");
  return (modules[id] = { type, label, ...MODULE_TYPES[type].defaults() });
}
function deleteModuleInstance(modules, moduleList, id) {
  if (!Object.hasOwn(modules, id)) throw new Error("Module introuvable");
  delete modules[id];
  const i = moduleList.findIndex(m => m.id === id);
  if (i >= 0) moduleList.splice(i, 1);
}
