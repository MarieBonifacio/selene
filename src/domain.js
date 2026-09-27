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

/* ---- modules génériques ---- */
/* Version du format des données du site. 1 = sections en dur (kundalini, ecriture, phidippus à la racine),
   2 = modules génériques sous `modules`, 3 = october.moth et Musique deviennent des collections,
   4 = la Capture devient un module Notes, 5 = le Budget devient un module générique.
   Une version de l'app qui lit un numéro plus grand que le sien ne doit ni fusionner ni écrire :
   elle ne connaît pas la forme de ces données. */
const SCHEMA_VERSION = 5;
/* Anciennes sections à la racine du document → instances de module. Chaque conversion reçoit l'ancienne
   section, le nom personnalisé et le réglage de regroupement éventuels. Sert aussi aux données de départ. */
const SECTION_TO_MODULE = {
  kundalini: (old, name) => ({
    type: "programme", label: name || "Kundalini",
    config: { unitLabel: "min", start: old.start ?? null, weeks: old.weeks ?? 12, perWeek: old.perWeek ?? 5 },
    entries: (old.sessions || []).map(x => ({ id: x.id, date: x.date, value: x.min ?? null, note: x.note || "" }))
  }),
  ecriture: (old, name) => ({
    type: "cumul", label: name || "Écriture",
    config: { unitLabel: "mots", goal: old.goal ?? 40000, title: old.title || "", categories: (old.chapters || []).map(x => ({ id: x.id, name: x.name, goal: x.goal })), categoryLabel: "Chapitre", scraps: true, scrapsLabel: "Fragments" },
    entries: (old.sessions || []).map(x => ({ id: x.id, date: x.date, value: x.words ?? null, category: x.chapter || "" })),
    scraps: (old.fragments || []).map(f => ({ id: f.id, date: f.date, text: f.text }))
  }),
  phidippus: (old, name) => ({
    type: "rappels", label: name || "Phidippus",
    config: { subtitle: old.name || "", types: [{ id: "repas", label: "Repas", every: old.feedEvery ?? 6 }, { id: "brumisation", label: "Brumisation", every: old.mistEvery ?? 3 }, { id: "mue", label: "Mue", every: 0 }] },
    entries: (old.log || []).map(x => ({ id: x.id, date: x.date, type: x.type, note: x.note || "" }))
  }),
  moth: (old, name, groups) => ({
    type: "collection", label: name || "october.moth",
    config: { display: "colonnes", description: "", statuses: ["Idée", "Brouillon", "Prêt", "Publié"], doneFrom: 3, statusLabel: "Étape", addLabel: "Nouvelle idée de post",
      fields: { title: "Titre ou accroche", subtitle: "", tag: "Thème, archétype", due: "Publication prévue", text: "Légende" },
      groups: { on: true, sort: "name", hideDone: false, title: "", ...(groups || {}), by: "tag" } },
    entries: (old.posts || []).map(p => ({ id: p.id, title: p.title || "", subtitle: "", tag: p.theme || "", due: p.due || "", text: p.caption || "", status: p.status }))
  }),
  musique: (old, name, groups) => ({
    type: "collection", label: name || "Musique",
    config: { display: "liste", description: "Albums de l'éveil, et artistes dont la mue stylistique fait elle-même le récit d'une transformation.",
      statuses: ["À écouter", "Écouté", "Retenu"], doneFrom: 1, statusLabel: "Statut", addLabel: "Ajouter un album",
      fields: { title: "Artiste", subtitle: "Album", tag: "", due: "", text: "Note" },
      groups: { on: true, sort: "name", hideDone: false, title: "", ...(groups || {}), by: "title" } },
    entries: (old.albums || []).map(a => ({ id: a.id, title: a.artist || "", subtitle: a.album || "", tag: "", due: "", text: a.note || "", status: a.status }))
  }),
  inbox: (old, name) => ({
    type: "notes", label: name || "Capture",
    config: { inbox: true, description: "Tout ce qui traîne dans ta tête, en attendant d'avoir une place.", placeholder: "Une idée, une course, un rêve…" },
    entries: (old.items || []).map(x => ({ id: x.id, text: x.text, date: x.date }))
  }),
  budget: (old, name, groups) => ({
    type: "budget", label: name || "Budget",
    config: { envelopes: old.envelopes || [], groups: { on: true, sort: "name", hideDone: false, title: "", ...(groups || {}), by: "cat" } },
    entries: old.entries || []
  })
};
/* Ne recrée jamais un module manquant : un module absent chez un site existant a été supprimé exprès.
   Si le module existe déjà alors que l'ancienne section réapparaît (une ancienne version de l'app, restée
   ouverte sur un autre appareil, a pu y écrire entre-temps), ses entrées absentes sont absorbées, pas perdues. */
function migrateModules(d) {
  d.modules = d.modules || {};
  const cfg = d.config || {}, labels = cfg.labels || {}, groups = cfg.groups || {};
  for (const [key, convert] of Object.entries(SECTION_TO_MODULE)) {
    if (!d[key]) continue;
    const inst = convert(d[key], labels[key], groups[key]), cur = d.modules[key];
    if (!cur) d.modules[key] = inst;
    else if (cur.type === inst.type) for (const list of ["entries", "scraps"]) if (inst[list]) {
      cur[list] = cur[list] || [];
      for (const x of inst[list]) if (!cur[list].some(y => y.id === x.id)) cur[list].push(x);
    }
    delete d[key];
    if (inst.config.groups) delete groups[key]; // le regroupement vit désormais dans l'instance
  }
  // Le nom d'une instance vit dans l'instance : un ancien nom personnalisé resté dans config.labels
  // masquerait tout renommage ultérieur.
  for (const [id, inst] of Object.entries(d.modules)) if (Object.hasOwn(labels, id)) { if (labels[id]) inst.label = labels[id]; delete labels[id]; }
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
  },
  budget: {
    label: "Budget (opérations, enveloppes à plafond mensuel)",
    defaults: () => ({ config: { envelopes: [], groups: { on: true, by: "cat", sort: "name", hideDone: false, title: "" } }, entries: [] }),
    normalize(inst) {
      const def = MODULE_TYPES.budget.defaults().config;
      if (!Array.isArray(inst.config.envelopes)) inst.config.envelopes = [];
      inst.config.groups = { ...def.groups, ...inst.config.groups, by: "cat" };
    },
    validate(inst, v) {
      v.list(inst.config.envelopes || [], "enveloppes").forEach(x => { if (typeof x.name !== "string") v.fail("enveloppe"); v.num(x.limit, "plafond", 0); });
      for (const e of inst.entries) { v.num(e.amount, "montant", 0); if (e.type !== "dépense" && e.type !== "revenu") v.fail("type d'opération"); }
    }
  },
  notes: {
    label: "Notes (textes datés, à garder ou à trier)",
    defaults: () => ({ config: { inbox: false, description: "", placeholder: "Une note…" }, entries: [] }),
    entry: (e, input) => { e.text = requireText(input.text ?? input.note, "Note", 2000); delete e.note; },
    normalize(inst) {
      const def = MODULE_TYPES.notes.defaults().config;
      for (const k of Object.keys(def)) if (inst.config[k] == null) inst.config[k] = def[k];
    },
    validate(inst, v) {
      if (inst.config.inbox != null && typeof inst.config.inbox !== "boolean") v.fail("boîte de réception");
      for (const e of inst.entries) if (typeof e.text !== "string") v.fail("texte");
    }
  },
  collection: {
    label: "Collection (éléments à statuts, en colonnes ou en liste)",
    datedEntries: false, // un élément n'a pas de date de journal ; `due` est facultative
    defaults: () => ({ config: { display: "liste", description: "", statuses: ["À faire", "En cours", "Fait"], doneFrom: 2, statusLabel: "Statut", addLabel: "Ajouter",
      fields: { title: "Titre", subtitle: "", tag: "Étiquette", due: "", text: "Note" },
      groups: { on: true, by: "tag", sort: "name", hideDone: false, title: "" } }, entries: [] }),
    normalize(inst) {
      const c = inst.config, def = MODULE_TYPES.collection.defaults().config;
      for (const k of Object.keys(def)) if (c[k] == null) c[k] = def[k];
      c.fields = { ...def.fields, ...c.fields };
      if (!c.fields.title) c.fields.title = def.fields.title;
      c.groups = { ...def.groups, ...c.groups };
      if (!Array.isArray(c.statuses) || c.statuses.length < 2) c.statuses = def.statuses;
      c.doneFrom = Math.min(c.statuses.length - 1, Math.max(1, Math.round(+c.doneFrom) || 1));
      for (const e of inst.entries) if (!c.statuses.includes(e.status)) e.status = c.statuses[0];
    },
    validate(inst, v) {
      const c = inst.config;
      if (c.statuses != null && (!Array.isArray(c.statuses) || c.statuses.length < 2 || c.statuses.length > 12 ||
          c.statuses.some(x => typeof x !== "string" || !x.trim() || x.length > 40))) v.fail("statuts");
      v.num(c.doneFrom, "statut « fait »", 0, 12);
      if (c.display != null && !["liste", "colonnes"].includes(c.display)) v.fail("affichage");
      if (c.fields != null && (typeof c.fields !== "object" || Object.values(c.fields).some(x => typeof x !== "string"))) v.fail("champs");
      for (const e of inst.entries) {
        if (typeof e.title !== "string") v.fail("titre");
        if (e.due && !(typeof e.due === "string" && validDate(e.due))) v.fail("date");
      }
    }
  }
};
/* Une seule boîte de réception à la fois : c'est elle que remplit la capture rapide de l'accueil. */
const inboxId = modules => Object.keys(modules).find(k => modules[k].type === "notes" && modules[k].config.inbox) || null;
/* Crée ou met à jour un élément de collection. Un champ désactivé (absent du formulaire) garde sa valeur. */
function saveCollectionItem(inst, input, id) {
  const c = inst.config, item = inst.entries.find(x => x.id === id) || null, keep = f => input[f] ?? (item ? item[f] : "");
  const v = {
    title: requireText(input.title, c.fields.title, 300),
    subtitle: String(keep("subtitle")).trim(), tag: String(keep("tag")).trim(), text: String(keep("text")),
    due: input.due !== undefined ? (input.due && validDate(input.due) ? input.due : "") : (item ? item.due : ""),
    status: c.statuses.includes(input.status) ? input.status : item ? item.status : c.statuses[0]
  };
  if (item) return Object.assign(item, v);
  const e = { id, ...v };
  inst.entries.push(e);
  return e;
}
function numericValue(raw) {
  const value = raw != null && raw !== "" ? Number(raw) : null;
  if (value !== null && !Number.isFinite(value)) throw new Error("Valeur invalide"); // un NaN contaminerait tous les totaux
  return value;
}
function addJournalEntry(instance, input, id, defaultDate) {
  const date = input.date && validDate(input.date) ? input.date : defaultDate;
  const type = MODULE_TYPES[instance.type];
  if (!type.entry) throw new Error("Ce module ne tient pas de journal");
  const entry = { id, date, note: input.note || "" };
  type.entry(entry, input);
  instance.entries.push(entry);
  return entry;
}
function deleteJournalEntry(instance, id) { instance.entries = instance.entries.filter(x => x.id !== id); }
/* L'identifiant d'un module sert aussi de route (#id) : il ne doit jamais masquer une vue fixe
   ni un nom hérité d'Object.prototype (« constructor », « toString »…), que `obj[id]` trouverait.
   Les noms de types ne sont pas réservés : un type n'est pas une route (le module « budget » est
   une instance du type « budget »). */
const RESERVED_IDS = ["accueil", "reglages"];
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
