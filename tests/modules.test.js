const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('selene.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function launch(storage, { claude = null, bare = false } = {}) {
  if (!bare && !storage.has('selene-site-v1')) storage.set('selene-site-v1', fs.readFileSync('tests/fixtures/site-demo.json', 'utf8')); // jeu d'essai riche
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      id, dataset: {}, value: '', textContent: '', innerHTML: '',
      classList: { add() {}, remove() {} }, addEventListener() {},
      querySelectorAll() { return []; }, focus() {}
    });
    return nodes.get(id);
  };
  const document = {
    title: '', activeElement: null, documentElement: { dataset: {} },
    querySelector: element, getElementById: element,
    addEventListener() {}
  };
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
    key(i) { return [...storage.keys()][i] ?? null; },
    get length() { return storage.size; }
  };
  const window = { addEventListener() {}, claude };
  const location = { hash: '' };
  const context = { document, window, localStorage, location,
    navigator: {}, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval };
  const instrumented = script.replace(/\}\)\(\);\s*$/, 'globalThis.__test = { S, site, board, createModuleInstance, deleteModuleInstance, addJournalEntry, slugId, label, createBackup, parseBackup, render, MODULE_TYPES, TYPE_UI, CLICK, CHANGE, summaryFor, contextText, saveCollectionItem, grouperFor, groupPanel, SCHEMA_VERSION, inboxId, noteTargets, availableTools, addCapture, addBudgetEntry, TOOLS, addTask, board, pickTask, todayTasks, MODULE_TEMPLATES, createFromTemplate, siteSeed, removeWithUndo, projection, saveDraft, loadDraft, VIEWS, searchAll, highlight, fold, captureIntent, fileIntent, scrapsMarkdown, periodOf };\n})();');
  vm.runInNewContext(instrumented, context);
  return { ...context.__test, nodes, location, document };
}

test('legacy site data (pre-generic-modules) migrates in place without data loss', () => {
  const legacy = {
    updatedAt: 1000,
    config: { name: 'Selene', palette: 'nigredo', mode: 'auto', labels: { phidippus: 'Aragog' }, groups: {},
      modules: ['chantier', 'kundalini', 'ecriture', 'moth', 'phidippus', 'musique', 'budget', 'assistant', 'inbox'].map(id => ({ id, on: id !== 'assistant' })),
      assistant: { model: 'claude-sonnet-5', actions: true, share: { chantier: true, kundalini: true, ecriture: true, moth: true, phidippus: true, musique: true, budget: false, inbox: true } } },
    budget: { entries: [], envelopes: [] },
    kundalini: { start: '2025-01-06', weeks: 12, perWeek: 5, sessions: [{ id: 's1', date: '2025-01-06', min: 20, note: 'Premier jour' }] },
    ecriture: { title: 'Mon livre', goal: 40000, chapters: [{ id: 'c1', name: 'Prologue', goal: 2000 }], sessions: [{ id: 'w1', date: '2025-01-06', words: 500, chapter: 'c1' }], fragments: [{ id: 'f1', date: '2025-01-06', text: 'Une phrase qui passe' }] },
    moth: { posts: [] },
    phidippus: { name: 'Aragog', feedEvery: 6, mistEvery: 3, log: [{ id: 'l1', date: '2025-01-06', type: 'repas', note: '' }] },
    musique: { albums: [] },
    inbox: { items: [] }
  };
  const storage = new Map([['selene-site-v1', JSON.stringify(legacy)]]);
  const app = launch(storage);
  const d = app.S();

  assert.equal(d.kundalini, undefined, 'legacy top-level key should be removed after migration');
  assert.equal(d.ecriture, undefined);
  assert.equal(d.phidippus, undefined);

  assert.equal(d.modules.kundalini.type, 'programme');
  assert.equal(d.modules.kundalini.config.start, '2025-01-06');
  assert.equal(d.modules.kundalini.config.perWeek, 5);
  assert.equal(d.modules.kundalini.entries.length, 1);
  assert.equal(d.modules.kundalini.entries[0].value, 20);
  assert.equal(d.modules.kundalini.entries[0].note, 'Premier jour');

  assert.equal(d.modules.ecriture.type, 'cumul');
  assert.equal(d.modules.ecriture.config.goal, 40000);
  assert.equal(d.modules.ecriture.config.title, 'Mon livre');
  assert.equal(d.modules.ecriture.config.categories.length, 1);
  assert.equal(d.modules.ecriture.config.categories[0].name, 'Prologue');
  assert.equal(d.modules.ecriture.entries[0].value, 500);
  assert.equal(d.modules.ecriture.entries[0].category, 'c1');
  assert.equal(d.modules.ecriture.scraps.length, 1);
  assert.equal(d.modules.ecriture.scraps[0].text, 'Une phrase qui passe');

  assert.equal(d.modules.phidippus.type, 'rappels');
  assert.equal(d.modules.phidippus.label, 'Aragog', 'custom label from config.labels should carry over');
  assert.equal(d.modules.phidippus.config.subtitle, 'Aragog');
  assert.equal(d.modules.phidippus.config.types.find(t => t.id === 'repas').every, 6);
  assert.equal(d.modules.phidippus.entries.length, 1);
  assert.equal(d.modules.phidippus.entries[0].type, 'repas');

  // Migration must be idempotent and non-destructive across repeated calls.
  const again = app.S();
  assert.equal(again.modules.kundalini.entries.length, 1);
});

test('a deleted built-in module is never resurrected by later S() calls', () => {
  const storage = new Map();
  const app = launch(storage);
  const d = app.S();
  app.deleteModuleInstance(d.modules, d.config.modules, 'phidippus');
  app.site.save();
  const reloaded = launch(storage).S(); // la normalisation au chargement ne doit pas le recréer
  assert.equal(reloaded.modules.phidippus, undefined);
  assert.equal(reloaded.config.modules.some(m => m.id === 'phidippus'), false);
});

test('creating and deleting a custom module of each type works end to end', () => {
  const app = launch(new Map());
  const d = app.S();

  const progId = app.slugId('Lecture', d.config.modules.map(m => m.id));
  app.createModuleInstance(d.modules, 'programme', 'Lecture', progId);
  d.config.modules.push({ id: progId, on: true });
  app.addJournalEntry(d.modules[progId], { date: '2025-02-01', value: 30, note: 'Chapitre 1' }, 'e1', '2025-02-01');
  assert.equal(d.modules[progId].entries[0].value, 30);
  assert.equal(app.label(progId), 'Lecture');

  const cumId = app.slugId('Sport', d.config.modules.map(m => m.id));
  app.createModuleInstance(d.modules, 'cumul', 'Sport', cumId);
  app.addJournalEntry(d.modules[cumId], { date: '2025-02-01', value: 5 }, 'e2', '2025-02-01');
  assert.equal(d.modules[cumId].entries[0].value, 5);

  const rapId = app.slugId('Plantes', d.config.modules.map(m => m.id));
  app.createModuleInstance(d.modules, 'rappels', 'Plantes', rapId);
  app.addJournalEntry(d.modules[rapId], { date: '2025-02-01', type: 'fait', note: 'Arrosage' }, 'e3', '2025-02-01');
  assert.equal(d.modules[rapId].entries[0].type, 'fait');

  assert.throws(() => app.createModuleInstance(d.modules, 'programme', 'Lecture', progId), /déjà utilisé/);

  app.deleteModuleInstance(d.modules, d.config.modules, cumId);
  assert.equal(d.modules[cumId], undefined);
  assert.equal(d.config.modules.some(m => m.id === cumId), false);
  assert.throws(() => app.deleteModuleInstance(d.modules, d.config.modules, cumId), /introuvable/);
});

test('backup export/import round trips the new generic module shape', () => {
  const app = launch(new Map());
  const d = app.S();
  const id = app.slugId('Lecture', d.config.modules.map(m => m.id));
  app.createModuleInstance(d.modules, 'programme', 'Lecture', id);
  app.addJournalEntry(d.modules[id], { date: '2025-02-01', value: 12, note: 'ok' }, 'e1', '2025-02-01');

  const backup = app.createBackup(app.board.data, app.site.data);
  const parsed = app.parseBackup(backup);
  assert.equal(parsed.site.modules[id].entries[0].value, 12);
  assert.equal(parsed.site.modules.kundalini.type, 'programme');
});

test('module ids never shadow fixed routes or Object.prototype names', () => {
  const app = launch(new Map());
  assert.notEqual(app.slugId('Réglages', []), 'reglages');
  assert.notEqual(app.slugId('Accueil', []), 'accueil');
  assert.notEqual(app.slugId('Constructor', []), 'constructor');
  const d = app.S();
  assert.throws(() => app.createModuleInstance(d.modules, 'cumul', 'Réglages', 'reglages'), /réservé/);
  assert.throws(() => app.createModuleInstance(d.modules, 'cumul', 'X', 'constructor'), /réservé/);
  assert.throws(() => app.deleteModuleInstance(d.modules, d.config.modules, 'constructor'), /introuvable/);
});

test('fixed views win over a colliding module id already present in stored data', () => {
  // Données importées d'avant le correctif : un module nommé « reglages ».
  const storage = new Map();
  const app = launch(storage, { claude: { use: async () => null } }); // artefact claude.ai : pas d'écran de connexion
  const d = app.S();
  d.modules.reglages = { type: 'cumul', label: 'Piège', config: { unitLabel: 'u', goal: 1, title: '', categories: [], categoryLabel: 'C', scraps: false, scrapsLabel: 'N' }, entries: [], scraps: [] };
  d.config.modules.push({ id: 'reglages', on: true });
  app.location.hash = '#reglages';
  app.render();
  assert.match(app.nodes.get('#main').innerHTML, /Sauvegarde/, 'settings view must render, not the module');

  app.location.hash = '#constructor';
  app.render(); // ne doit pas planter sur Object.prototype.constructor
  assert.match(app.nodes.get('#main').innerHTML, /Accueil|lune/i);
});

test('journal entries reject non-numeric values instead of storing NaN', () => {
  const app = launch(new Map());
  const d = app.S();
  assert.throws(() => app.addJournalEntry(d.modules.kundalini, { date: '2026-09-27', value: 'beaucoup' }, 'e1', '2026-09-27'), /invalide/);
  assert.equal(d.modules.kundalini.entries.length, 0);
  app.addJournalEntry(d.modules.ecriture, { date: '2026-09-27', value: -300 }, 'e2', '2026-09-27'); // retirer des mots coupés
  assert.equal(d.modules.ecriture.entries[0].value, -300);
  assert.equal(d.schemaVersion, app.SCHEMA_VERSION);
});

test('type registries: the pure and the UI halves declare exactly the same types', () => {
  const app = launch(new Map());
  assert.deepEqual(Object.keys(app.TYPE_UI).sort(), Object.keys(app.MODULE_TYPES).sort());
  for (const [type, ui] of Object.entries(app.TYPE_UI)) {
    for (const hook of ['view', 'settings', 'summary', 'context']) assert.equal(typeof ui[hook], 'function', `${type}.${hook}`);
    for (const act of Object.keys(ui.click || {})) assert.equal(app.CLICK[act], ui.click[act], `${type} click ${act} wired`);
    for (const act of Object.keys(ui.change || {})) assert.equal(app.CHANGE[act], ui.change[act], `${type} change ${act} wired`);
  }
});

test('every registered type works end to end through the registry alone', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  // Comment ajouter un élément à chaque type. Un nouveau type doit être ajouté ici, sinon le test échoue.
  const journal = (inst, id) => app.addJournalEntry(inst, { date: '2026-09-27', value: 3, type: 'fait', note: 'ok' }, id, '2026-09-27');
  const addOne = { programme: journal, cumul: journal, rappels: journal, notes: journal,
    collection: (inst, id) => app.saveCollectionItem(inst, { title: 'Premier élément', tag: 'essai' }, id),
    taches: (inst, id) => app.addTask(inst.entries, { title: 'Première tâche', cat: 'Général' }, id, '2026-09-27'),
    budget: (inst, id) => app.addBudgetEntry(inst.entries, { amount: 12, type: 'dépense', cat: 'essai', date: '2026-09-27' }, id, '2026-09-27') };
  assert.deepEqual(Object.keys(addOne).sort(), Object.keys(app.MODULE_TYPES).sort(), 'every type must be exercised here');
  for (const type of Object.keys(app.MODULE_TYPES)) {
    const id = app.slugId(`Essai ${type}`, Object.keys(d.modules));
    const inst = app.createModuleInstance(d.modules, type, `Essai ${type}`, id);
    d.config.modules.push({ id, on: true });
    addOne[type](inst, `e-${type}`);
    const ui = app.TYPE_UI[type];
    assert.match(ui.view(id), /<h2/, `${type} view`);
    assert.equal(typeof ui.settings(id, inst), 'string');
    assert.equal(typeof app.summaryFor(id), 'string');
    assert.match(ui.context(inst, 'NOM'), /NOM/);
    assert.equal(typeof ui.recent, 'function', `${type}.recent`);
    assert.equal(typeof ui.review, 'function', `${type}.review`);
    const rv = ui.review(inst, '2000-01-01', '2100-01-01'); assert.ok(rv === null || typeof rv === 'string', `${type}.review returns text or null`);
    assert.ok(ui.recent(inst).every(x => typeof x === 'string'), `${type}.recent returns text`);
  }
  assert.doesNotMatch(app.contextText(), /ESSAI/, 'modules not shared with the assistant stay private');
  for (const k of Object.keys(d.modules)) if (k.startsWith('essai-')) d.config.assistant.share[k] = true;
  for (const t of Object.keys(app.MODULE_TYPES)) assert.match(app.contextText(), new RegExp(`ESSAI ${t.toUpperCase()}`));
  // Tout ce que le registre crée doit passer sa propre validation d'import.
  const parsed = app.parseBackup(app.createBackup(app.board.data, app.site.data));
  assert.equal(Object.keys(parsed.site.modules).filter(k => k.startsWith('essai-')).length, Object.keys(app.MODULE_TYPES).length);
});

test('S() is a pure read: calling it never changes the stored document', () => {
  const legacy = { updatedAt: 5, config: { modules: [], labels: {}, groups: {}, assistant: { share: {} } }, kundalini: { weeks: 8, perWeek: 3, sessions: [] } };
  const storage = new Map([['selene-site-v1', JSON.stringify(legacy)]]);
  const app = launch(storage);
  const before = JSON.stringify(app.site.data);
  app.S(); app.S(); app.label('kundalini'); app.summaryFor('kundalini');
  assert.equal(JSON.stringify(app.site.data), before);
  assert.equal(app.site.data.modules.kundalini.config.weeks, 8, 'migration happened once, at load');
  assert.equal(app.site.data.kundalini, undefined);
});

test('a re-render in Settings never wipes a field being typed in (any settings block)', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  app.location.hash = '#reglages';
  app.render();
  const main = app.nodes.get('#main');
  main.innerHTML = 'saisie en cours';
  // Un champ de réglage de module (data-set-mod), dans le bloc #modreg qui a remplacé #groupes.
  app.document.activeElement = { tagName: 'INPUT', type: 'number', dataset: { setMod: 'kundalini.weeks' }, closest: sel => sel === '#main' ? main : null };
  app.render(); // p. ex. une synchro qui arrive pendant la frappe
  assert.equal(main.innerHTML, 'saisie en cours');
  app.document.activeElement = { tagName: 'INPUT', type: 'checkbox', dataset: {}, closest: sel => sel === '#main' ? main : null };
  app.render(); // une case à cocher n'est pas une saisie : on redessine
  assert.notEqual(main.innerHTML, 'saisie en cours');
});

// Un document tel qu'il est aujourd'hui en production (format 2) : october.moth et Musique encore en dur.
const schema2 = () => ({
  updatedAt: 10, schemaVersion: 2,
  config: { name: 'Selene', palette: 'nigredo', mode: 'auto', labels: { moth: 'Atelier', kundalini: 'Yoga' },
    groups: { moth: { on: true, by: 'theme', sort: 'pct', hideDone: true, title: 'Par archétype' }, musique: { on: false, by: 'artist', sort: 'name', hideDone: false, title: '' } },
    modules: ['chantier', 'kundalini', 'moth', 'musique', 'budget', 'assistant', 'inbox'].map(id => ({ id, on: true })),
    assistant: { model: 'claude-sonnet-5', actions: true, share: { moth: true, musique: false } } },
  modules: { kundalini: { type: 'programme', label: 'Kundalini', config: { unitLabel: 'min', start: null, weeks: 12, perWeek: 5 }, entries: [] } },
  moth: { posts: [{ id: 'p1', title: 'Le lichen', theme: 'Nigredo', due: '2026-10-01', status: 'Prêt', caption: 'Légende' }, { id: 'p2', title: 'Vieux', theme: '', due: '', status: 'Inconnu', caption: '' }] },
  musique: { albums: [{ id: 'a1', artist: 'Ulver', album: 'Perdition City', status: 'Retenu', note: 'nocturne' }] },
  budget: { entries: [], envelopes: [] }, inbox: { items: [] }
});

test('format 2 → 3: october.moth and Musique become collections without losing anything', () => {
  const app = launch(new Map([['selene-site-v1', JSON.stringify(schema2())]]));
  const d = app.S();
  assert.equal(d.schemaVersion, app.SCHEMA_VERSION);
  assert.equal(d.moth, undefined); assert.equal(d.musique, undefined);
  const moth = d.modules.moth, mus = d.modules.musique;
  assert.equal(moth.type, 'collection'); assert.equal(moth.config.display, 'colonnes');
  assert.equal(moth.label, 'Atelier', 'custom name carried over');
  assert.equal(d.config.labels.moth, undefined, 'and removed from labels, so renaming works afterwards');
  assert.equal(app.label('kundalini'), 'Yoga', 'same fix for an already migrated module');
  assert.equal(d.config.labels.kundalini, undefined);
  const p1 = moth.entries.find(e => e.id === 'p1');
  assert.equal(p1.tag, 'Nigredo'); assert.equal(p1.due, '2026-10-01'); assert.equal(p1.text, 'Légende'); assert.equal(p1.status, 'Prêt');
  assert.equal(moth.entries.find(e => e.id === 'p2').status, 'Idée', 'unknown status falls back to the first one');
  assert.equal(moth.config.groups.sort, 'pct'); assert.equal(moth.config.groups.hideDone, true); assert.equal(moth.config.groups.title, 'Par archétype');
  assert.equal(moth.config.groups.by, 'tag');
  assert.equal(d.config.groups.moth, undefined);
  assert.equal(mus.config.display, 'liste'); assert.equal(mus.config.groups.on, false);
  assert.equal(mus.entries[0].title, 'Ulver'); assert.equal(mus.entries[0].subtitle, 'Perdition City'); assert.equal(mus.entries[0].text, 'nocturne');
  assert.equal(d.config.assistant.share.musique, false, 'privacy choices kept');
  assert.ok(d.config.modules.some(m => m.id === 'moth'));
  // Et le résultat passe sa propre validation d'import.
  assert.equal(app.parseBackup(app.createBackup(app.board.data, app.site.data)).site.modules.moth.entries.length, 2);
});

test('a legacy section written late by an old app version is absorbed, not lost', () => {
  const app = launch(new Map([['selene-site-v1', JSON.stringify(schema2())]]));
  const d = app.site.data;
  // Une ancienne version, sur un autre appareil, a ajouté un post dans l'ancienne section après la migration.
  d.moth = { posts: [{ id: 'p1', title: 'Le lichen', theme: 'Nigredo', status: 'Prêt' }, { id: 'p9', title: 'Écrit ailleurs', theme: 'Albedo', status: 'Idée' }] };
  app.site.replaceAll(JSON.parse(JSON.stringify(d)));
  const moth = app.S().modules.moth;
  assert.deepEqual(moth.entries.map(e => e.id).sort(), ['p1', 'p2', 'p9']);
  assert.equal(app.S().moth, undefined);
});

test('collection items: required title, disabled fields keep their value, unknown status falls back', () => {
  const app = launch(new Map());
  const mus = app.S().modules.musique;
  assert.throws(() => app.saveCollectionItem(mus, { title: '  ' }, 'x'), /Artiste manquant/);
  const e = app.saveCollectionItem(mus, { title: 'Kate Bush', subtitle: 'Hounds of Love', status: 'Nimporte' }, 'k1');
  assert.equal(e.status, 'À écouter');
  app.saveCollectionItem(mus, { title: 'Kate Bush', status: 'Retenu' }, 'k1'); // formulaire sans le champ sous-titre
  assert.equal(e.subtitle, 'Hounds of Love'); assert.equal(e.status, 'Retenu');
  assert.equal(app.saveCollectionItem(mus, { title: 'X', due: 'demain' }, 'k2').due, '');
});

test('collection grouping: done threshold and a disabled grouping field never break the panel', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const moth = app.S().modules.moth;
  app.saveCollectionItem(moth, { title: 'A', tag: 'Nigredo', status: 'Publié' }, 'a');
  app.saveCollectionItem(moth, { title: 'B', tag: 'Nigredo', status: 'Prêt' }, 'b');
  const G = app.grouperFor('moth');
  assert.equal(G.groups('tag').find(g => g.name === 'Nigredo').pct, 50);
  moth.config.fields.tag = ''; // champ désactivé alors que le regroupement pointe dessus
  assert.match(app.groupPanel('moth', ''), /Par titre ou accroche/);
});

test('backup: collections are validated (statuses, dates) but need no journal date', () => {
  const app = launch(new Map());
  const d = JSON.parse(app.createBackup(app.board.data, app.site.data));
  assert.equal(app.parseBackup(JSON.stringify(d)).site.modules.moth.type, 'collection');
  for (const mutate of [x => { x.site.modules.moth.config.statuses = ['seul']; }, x => { x.site.modules.moth.entries.push({ id: 'z', title: 'Z', status: 'Idée', due: '2026-99-99' }); },
    x => { x.site.modules.moth.config.fields = { title: 3 }; }, x => { x.site.modules.moth.config.display = 'mosaïque'; }]) {
    const y = JSON.parse(JSON.stringify(d)); mutate(y);
    assert.throws(() => app.parseBackup(JSON.stringify(y)));
  }
});

test('format 3 → 4: the Capture becomes the designated Notes inbox, items and privacy kept', () => {
  const doc = schema2(); doc.inbox = { items: [{ id: 'i1', text: 'acheter des clous', date: '2026-09-20' }] };
  doc.config.labels.inbox = 'Vrac'; doc.config.assistant.share.inbox = false;
  const app = launch(new Map([['selene-site-v1', JSON.stringify(doc)]]));
  const d = app.S(), inbox = d.modules.inbox;
  assert.equal(d.inbox, undefined);
  assert.equal(inbox.type, 'notes'); assert.equal(inbox.config.inbox, true); assert.equal(inbox.label, 'Vrac');
  assert.equal(inbox.entries[0].text, 'acheter des clous');
  assert.equal(app.inboxId(d.modules), 'inbox');
  assert.equal(d.config.assistant.share.inbox, false);
});

test('only one inbox survives, even when two devices each designated one', () => {
  const app = launch(new Map());
  const d = JSON.parse(JSON.stringify(app.site.data));
  d.modules.vrac = { type: 'notes', label: 'Vrac', config: { inbox: true, description: '', placeholder: '…' }, entries: [] };
  app.site.replaceAll(d);
  const inboxes = Object.values(app.S().modules).filter(m => m.type === 'notes' && m.config.inbox);
  assert.equal(inboxes.length, 1);
});

test('a note can be filed into any module that accepts it, and nowhere else', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  const targets = app.noteTargets('inbox');
  for (const id of ['chantier', 'ecriture', 'moth', 'musique', 'phidippus']) assert.ok(targets.includes(id), id);
  assert.ok(!targets.includes('kundalini'), 'a programme does not take free notes');
  assert.ok(!targets.includes('inbox'), 'not into itself');
  d.modules.ecriture.config.scraps = false;
  assert.ok(!app.noteTargets('inbox').includes('ecriture'), 'a counter without a notebook does not either');
  // Ranger une note dans Phidippus : elle devient une observation de son journal et quitte la boîte.
  app.addCapture(d.modules.inbox.entries, 'toile neuve', 'n1', '2026-09-27');
  const el = { dataset: { to: 'phidippus' }, closest: sel => sel === '[data-mod]' ? { dataset: { mod: 'inbox' } } : sel === '[data-id]' ? { dataset: { id: 'n1' } } : null };
  app.CLICK['note-to'](el);
  assert.equal(d.modules.inbox.entries.length, 0);
  assert.equal(d.modules.phidippus.entries.at(-1).note, 'toile neuve');
  assert.equal(d.modules.phidippus.entries.at(-1).type, 'note');
});

test('without an inbox, the assistant loses its capture tool instead of failing', () => {
  const app = launch(new Map());
  assert.ok(app.availableTools().some(t => t.name === 'capturer'));
  app.S().modules.inbox.config.inbox = false;
  assert.ok(!app.availableTools().some(t => t.name === 'capturer'));
});

test('format 4 → 5: the Budget becomes a generic module, operations, envelopes and settings kept', () => {
  const doc = schema2();
  doc.budget = { entries: [{ id: 'b1', type: 'dépense', amount: 42.5, cat: 'Courses', note: 'marché', date: '2026-09-12' }],
    envelopes: [{ id: 'v1', name: 'Courses', limit: 300 }] };
  doc.config.groups.budget = { on: true, by: 'cat', sort: 'left', hideDone: false, title: 'Où part l’argent' };
  doc.config.labels.budget = 'Argent';
  const app = launch(new Map([['selene-site-v1', JSON.stringify(doc)]]));
  const d = app.S(), b = d.modules.budget;
  assert.equal(d.budget, undefined);
  assert.equal(b.type, 'budget'); assert.equal(b.label, 'Argent');
  assert.equal(b.entries[0].amount, 42.5); assert.equal(b.config.envelopes[0].limit, 300);
  assert.equal(b.config.groups.sort, 'left'); assert.equal(b.config.groups.title, 'Où part l’argent');
  assert.equal(d.config.groups.budget, undefined);
  const g = app.grouperFor('budget').groups().find(x => x.name === 'Courses');
  assert.equal(g.den, 300);
  // Import d'une sauvegarde de ce document : le module « budget » n'est pas un identifiant réservé.
  assert.equal(app.parseBackup(app.createBackup(app.board.data, app.site.data)).site.modules.budget.entries.length, 1);
});

test('budget: renaming a group renames its envelope, the assistant writes into the first budget module', () => {
  const app = launch(new Map());
  const b = app.S().modules.budget;
  app.addBudgetEntry(b.entries, { amount: 10, cat: 'Courses', date: '2026-09-27' }, 'o1', '2026-09-27');
  const G = app.grouperFor('budget');
  b.entries.forEach(e => { if (e.cat === 'Courses') e.cat = 'Marché'; }); G.rename('Courses', 'Marché');
  assert.ok(b.config.envelopes.some(v => v.name === 'Marché'));
  assert.ok(app.availableTools().some(t => t.name === 'ajouter_operation'));
  app.TOOLS.find(t => t.name === 'ajouter_operation').execute({ montant: 7 });
  assert.equal(b.entries.length, 2);
});

test('a new account starts nearly empty, with nothing personal, and is offered templates', () => {
  const app = launch(new Map(), { bare: true, claude: { use: async () => null } });
  const d = app.S(), text = JSON.stringify(d);
  assert.deepEqual(Object.keys(d.modules), ['inbox']);
  for (const personal of ['spectre dissociatif', 'Ulver', 'Phidippus', 'Kundalini', 'october.moth']) assert.ok(!text.includes(personal), personal);
  assert.equal(d.config.welcome, true);
  app.render();
  assert.match(app.nodes.get('#main').innerHTML, /Composer ton espace/);
  app.CLICK['tpl-add']({ dataset: { tpl: 'ecriture' } });
  app.CLICK['tpl-add']({ dataset: { tpl: 'ecriture' } });
  assert.ok(d.modules.ecriture && d.modules['ecriture-2'], 'a template can be added twice');
  assert.equal(d.modules.ecriture.config.scraps, true); assert.equal(d.modules.ecriture.config.unitLabel, 'mots');
  assert.equal(d.config.assistant.share.ecriture, true);
  app.CLICK['welcome-done']();
  app.render();
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /Composer ton espace/);
});

test('existing accounts never see the welcome block (it is not a missing default)', () => {
  const app = launch(new Map(), { claude: { use: async () => null } }); // compte existant (jeu d'essai)
  assert.equal(app.S().config.welcome, undefined);
  app.render();
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /Composer ton espace/);
});

test('every template builds a module that passes its own backup validation', () => {
  const app = launch(new Map(), { bare: true });
  const d = app.S();
  for (const tpl of app.MODULE_TEMPLATES) {
    assert.ok(app.MODULE_TYPES[tpl.type], tpl.id);
    const id = app.slugId(tpl.name, Object.keys(d.modules));
    app.createFromTemplate(d.modules, tpl, tpl.name, id);
    d.config.modules.push({ id, on: true });
  }
  app.site.replaceAll(JSON.parse(JSON.stringify(d))); // passe par la normalisation
  const parsed = app.parseBackup(app.createBackup(app.board.data, app.site.data));
  assert.equal(Object.keys(parsed.site.modules).length, app.MODULE_TEMPLATES.length + 1);
  // Le modèle complète les réglages du type sans les écraser.
  const tab = Object.values(parsed.site.modules).find(m => m.label === 'Tableau de production');
  assert.equal(tab.config.fields.title, 'Titre'); assert.equal(tab.config.display, 'colonnes'); assert.equal(tab.config.groups.by, 'tag');
});

test('the seed stays pristine: a fresh device adopts the server instead of merging', () => {
  const app = launch(new Map(), { bare: true });
  const a = app.siteSeed(), b = app.siteSeed();
  assert.equal(a.updatedAt, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), 'no random ids in the seed');
});

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

test('deleting an item offers « Annuler », which puts it back where it was', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const inbox = app.S().modules.inbox;
  for (const t of ['un', 'deux', 'trois']) app.addCapture(inbox.entries, t, t, '2026-09-27');
  app.removeWithUndo('inbox', 'entries', 'deux');
  assert.deepEqual([...inbox.entries.map(x => x.id)], ['un', 'trois']);
  assert.match(app.nodes.get('#toast').innerHTML, /Supprimé : « deux »/);
  app.CLICK.undo();
  assert.deepEqual([...app.S().modules.inbox.entries.map(x => x.id)], ['un', 'deux', 'trois']);
  app.CLICK.undo(); // un second « Annuler » ne fait rien
  assert.equal(app.S().modules.inbox.entries.length, 3);
});

test('writing: in « total » mode the app records the difference, cuts included', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const ecr = app.S().modules.ecriture;
  ecr.config.entryMode = 'total';
  const $ = sel => app.document.querySelector(sel); // le faux DOM crée l'élément au premier accès
  $('#cumCat').value = '';
  app.addJournalEntry(ecr, { date: today(), value: 1000 }, 'e0', today());
  $('#cumIn').value = '1600'; app.TYPE_UI.cumul.add('ecriture', ecr);
  assert.equal(ecr.entries.at(-1).value, 600);
  $('#cumIn').value = '1450'; app.TYPE_UI.cumul.add('ecriture', ecr);
  assert.equal(ecr.entries.at(-1).value, -150, 'a lower total is a cut, not an error');
  const n = ecr.entries.length;
  $('#cumIn').value = '1450'; app.TYPE_UI.cumul.add('ecriture', ecr);
  assert.equal(ecr.entries.length, n, 'same total: nothing recorded');
});

test('writing: a projected end date from the last 30 days, and honest when there is no pace', () => {
  const app = launch(new Map());
  const ecr = app.S().modules.ecriture; // objectif 40 000
  assert.match(app.projection(ecr), /Pas assez d'élan/);
  app.addJournalEntry(ecr, { date: today(), value: 30000 }, 'a', today()); // 1 000 par jour sur 30 jours
  assert.match(app.projection(ecr), /1\s000 mots par jour/); // espace fine insécable, comme le veut la typographie française
  app.addJournalEntry(ecr, { date: today(), value: 10000 }, 'b', today());
  assert.match(app.projection(ecr), /Objectif atteint/);
});

test('home: a due reminder can be done, a session logged with the last duration, due items surface', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  d.modules.kundalini.config.start = '2026-01-05';
  app.addJournalEntry(d.modules.kundalini, { date: '2026-01-05', value: 25 }, 'k1', '2026-01-05');
  app.saveCollectionItem(d.modules.moth, { title: 'Le lichen', due: '2020-01-01', status: 'Prêt' }, 'p1');
  app.location.hash = '#accueil'; app.render();
  const html = app.nodes.get('#main').innerHTML;
  assert.match(html, /data-act="entry-log" data-mod="phidippus"/, 'reminder: « fait » right on the home page');
  assert.match(html, /data-act="prog-quick" data-mod="kundalini">Noter 25 min/);
  assert.match(html, /« Le lichen » : en retard \(october.moth\)/);
  app.CLICK['prog-quick']({ dataset: { mod: 'kundalini' } });
  assert.equal(d.modules.kundalini.entries.at(-1).value, 25);
  assert.equal(d.modules.kundalini.entries.at(-1).date, today());
  app.render();
  assert.match(app.nodes.get('#main').innerHTML, /Séance de kundalini faite/);
});

test('drafts are kept per view and field, and emptied when the field is sent', () => {
  const storage = new Map(), app = launch(storage);
  const el = { id: 'scrapIn', value: 'une phrase à moitié' };
  app.saveDraft('ecriture', el);
  assert.equal(app.loadDraft('ecriture', el), 'une phrase à moitié');
  assert.equal(app.loadDraft('inbox', el), '', 'per view');
  el.value = '';
  app.saveDraft('ecriture', el);
  assert.equal(storage.get('selene-draft:ecriture:scrapIn'), undefined);
});

test('search: every module, accents and case ignored, all words required, highlight stays aligned', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  d.modules.ecriture.scraps.push({ id: 'f1', text: 'Une phrase sur l’été dissocié', date: '2026-09-01' });
  app.addCapture(d.modules.inbox.entries, 'Acheter du ÉTÉ-lait 🥛 bio', 'n1', '2026-09-02');
  app.saveCollectionItem(d.modules.musique, { title: 'Dead Can Dance', subtitle: 'Within the Realm', text: 'été 1987' }, 'm1');
  const hits = app.searchAll('ete');
  assert.deepEqual([...hits.map(h => h.id)].sort(), ['ecriture', 'inbox', 'musique']);
  assert.deepEqual([...app.searchAll('ete dissocie').map(h => h.id)], ['ecriture'], 'all words must match');
  assert.equal(app.searchAll('   ').length, 0);
  assert.equal(app.fold('🥛É').length, '🥛É'.length, 'same length, even with an emoji');
  assert.equal(app.highlight('Acheter du ÉTÉ-lait 🥛 bio', 'ete'), 'Ach<mark>ete</mark>r du <mark>ÉTÉ</mark>-lait 🥛 bio', 'substrings too');
  assert.equal(app.highlight('🥛 🥛 Été', 'ete'), '🥛 🥛 <mark>Été</mark>', 'aligned after emoji');
  assert.equal(app.highlight('<b>été</b>', 'ete'), '&lt;b&gt;<mark>été</mark>&lt;/b&gt;', 'escaped around the marks');
  app.location.hash = '#recherche'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /id="searchIn"/);
  assert.ok(app.slugId('Recherche', []) !== 'recherche', 'reserved route');
});

test('timer end: the open module proposes the obvious next step', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const k = app.S().modules.kundalini;
  assert.equal(app.TYPE_UI.programme.timerDone('kundalini', k, 15), true);
  app.CLICK.undo(); // le bouton du bandeau : « Noter 15 min »
  assert.equal(k.entries.at(-1).value, 15);
  k.config.unitLabel = 'pages';
  assert.equal(app.TYPE_UI.programme.timerDone('kundalini', k, 15), false, 'not minutes: nothing to infer');
});

test('a finished task with a cost offers to move it into the budget envelope', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  app.addTask(d.modules.chantier.entries, { title: 'Velux', cost: 250 }, 't1', '2026-09-27');
  const el = { checked: true, closest: sel => sel === '[data-task]' ? { dataset: { task: 't1', mod: 'chantier' } } : null };
  app.CHANGE['task-done'](el);
  assert.match(app.nodes.get('#toast').innerHTML, /250,00.*Travaux/);
  app.CLICK.undo(); // « Ajouter »
  const op = d.modules.budget.entries.at(-1);
  assert.equal(op.amount, 250); assert.equal(op.cat, 'Travaux'); assert.equal(op.note, 'Velux'); assert.equal(op.type, 'dépense');
});

test('capture patterns: money, minutes and « module : text » are recognised, nothing else', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  const i1 = app.captureIntent('12,50 € courses du marché');
  assert.equal(i1.to, 'budget'); assert.equal(i1.amount, 12.5); assert.equal(i1.cat, 'Courses');
  const i2 = app.captureIntent('25 min kundalini, souffle de feu');
  assert.equal(i2.to, 'kundalini'); assert.equal(i2.value, 25);
  const i3 = app.captureIntent('Phidippus : refus de proie');
  assert.equal(i3.to, 'phidippus'); assert.equal(i3.text, 'refus de proie');
  assert.equal(app.captureIntent('Écriture: une phrase').to, 'ecriture', 'accents and spacing ignored');
  for (const plain of ['acheter du pain', 'rdv : 14h chez le dentiste', '25 min de marche', '0 € rien']) assert.equal(app.captureIntent(plain), null, plain);
  // Rangement : la note quitte la boîte et arrive au bon endroit.
  app.addCapture(d.modules.inbox.entries, 'Phidippus : refus de proie', 'n1', '2026-09-20');
  app.fileIntent(app.captureIntent('Phidippus : refus de proie'), 'inbox', 'n1');
  assert.equal(d.modules.inbox.entries.length, 0);
  const obs = d.modules.phidippus.entries.at(-1);
  assert.equal(obs.note, 'refus de proie'); assert.equal(obs.date, '2026-09-20');
  app.addCapture(d.modules.inbox.entries, '12 € courses', 'n2', '2026-09-21');
  app.fileIntent(app.captureIntent('12 € courses'), 'inbox', 'n2');
  assert.equal(d.modules.budget.entries.at(-1).amount, 12);
});

test('writing workshop: fragments follow chapters and export as Markdown', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const e = app.S().modules.ecriture;
  e.config.categories = [{ id: 'c1', name: 'Prologue', goal: 0 }, { id: 'c2', name: 'La forêt', goal: 0 }];
  e.scraps.push({ id: 'a', text: 'Le brouillard.', date: '2026-09-01', category: 'c2' }, { id: 'b', text: 'Il était une fois.', date: '2026-09-02', category: 'c1' }, { id: 'c', text: 'Sans place.', date: '2026-09-03' });
  const md = app.scrapsMarkdown('ecriture', e);
  assert.ok(md.indexOf('## Prologue') < md.indexOf('Il était une fois.') && md.indexOf('Il était une fois.') < md.indexOf('## La forêt'), 'chapter order, fragments under their chapter');
  assert.match(md, /## Hors chapitre\n\nSans place\./);
  app.location.hash = '#ecriture'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /1 fragment/, 'chapter panel counts fragments');
});

test('review periods: lunar cycles tile time exactly, months too, and the current one contains today', () => {
  const app = launch(new Map());
  const now = Date.UTC(2026, 8, 27, 12);
  const cur = app.periodOf('lune', 0, now), prev = app.periodOf('lune', 1, now);
  assert.equal(prev.to, cur.from, 'consecutive cycles share their boundary');
  const days = (Date.parse(cur.to) - Date.parse(cur.from)) / 864e5;
  assert.ok(days >= 29 && days <= 30, `a cycle lasts ~29.5 days (${days})`);
  assert.ok(cur.from <= '2026-09-27' && '2026-09-27' < cur.to);
  const m = app.periodOf('mois', 0, now), m1 = app.periodOf('mois', 1, now);
  assert.equal(m.from, '2026-09-01'); assert.equal(m.to, '2026-10-01'); assert.equal(m1.from, '2026-08-01');
  assert.equal(app.periodOf('mois', 9, now).from, '2025-12-01', 'across a year boundary');
});

test('review: each module sums what happened in the period, next to the previous one', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  app.addJournalEntry(d.modules.kundalini, { date: '2026-09-10', value: 20 }, 'k1', '2026-09-10');
  app.addJournalEntry(d.modules.kundalini, { date: '2026-09-12', value: 25 }, 'k2', '2026-09-12');
  app.addJournalEntry(d.modules.kundalini, { date: '2026-08-12', value: 30 }, 'k0', '2026-08-12');
  app.addBudgetEntry(d.modules.budget.entries, { amount: 40, date: '2026-09-05' }, 'b1', '2026-09-05');
  app.addTask(d.modules.chantier.entries, { title: 'Velux', cost: 250 }, 't1', '2026-09-01');
  Object.assign(d.modules.chantier.entries[0], { done: true, doneAt: '2026-09-20' });
  const T = app.TYPE_UI;
  assert.equal(T.programme.review(d.modules.kundalini, '2026-09-01', '2026-10-01'), '2 séances, 45 min');
  assert.equal(T.programme.review(d.modules.kundalini, '2026-08-01', '2026-09-01'), '1 séance, 30 min');
  assert.match(T.budget.review(d.modules.budget, '2026-09-01', '2026-10-01'), /^40,00\s€ dépensés/);
  assert.match(T.taches.review(d.modules.chantier, '2026-09-01', '2026-10-01'), /^1 tâche terminée, 250,00/);
  assert.equal(T.rappels.review(d.modules.phidippus, '2026-09-01', '2026-10-01'), 'Rien de noté');
  app.location.hash = '#bilan'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /avant :/);
  assert.ok(app.slugId('Bilan', []) !== 'bilan', 'reserved route');
});
