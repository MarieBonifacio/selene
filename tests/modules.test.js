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
  const handlers = {};
  const document = {
    title: '', activeElement: null, documentElement: { dataset: {} },
    querySelector: element, getElementById: element,
    addEventListener(name, fn) { (handlers[name] = handlers[name] || []).push(fn); }
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
  const instrumented = script.replace(/\}\)\(\);\s*$/, 'globalThis.__test = { S, site, board, createModuleInstance, deleteModuleInstance, addJournalEntry, slugId, label, createBackup, parseBackup, render, MODULE_TYPES, TYPE_UI, CLICK, CHANGE, summaryFor, contextText, saveCollectionItem, grouperFor, groupPanel, SCHEMA_VERSION, inboxId, noteTargets, availableTools, addCapture, addBudgetEntry, TOOLS, addTask, board, pickTask, todayTasks, MODULE_TEMPLATES, createFromTemplate, siteSeed, removeWithUndo, projection, saveDraft, loadDraft, VIEWS, searchAll, highlight, fold, captureIntent, fileIntent, scrapsMarkdown, periodOf, epPrefix, setEpStatus, setResume, EP_STATUS, timerDone, epCounts, concordance, motifsIn, lexicalDrift, driftWords };\n})();');
  vm.runInNewContext(instrumented, context);
  const fire = (name, target) => (handlers[name] || []).forEach(fn => fn({ target, preventDefault() {} }));
  return { ...context.__test, nodes, location, document, fire };
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

/* ---- pensée : statut épistémique, provenance, pont de reprise, décisions ---- */
const on = (dataset, extra = {}) => ({ dataset, ...extra, closest(sel) { return sel === '[data-mod]' || sel === '[data-id]' ? this : null; } });

test('epistemic status: « ? » marks a hypothesis, changes are dated, search filters by status', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  assert.deepEqual({ ...app.epPrefix('? le seuil précède le récit') }, { text: 'le seuil précède le récit', ep: 'hyp' });
  assert.deepEqual({ ...app.epPrefix('pourquoi ? parce que') }, { text: 'pourquoi ? parce que', ep: null }, 'only in front');
  assert.equal(app.epPrefix('?').ep, null, 'a lone « ? » is not a note');
  // Capture rapide de l'accueil : la note arrive marquée, le « ? » retiré.
  app.document.querySelector('#capIn').value = '? la dépersonnalisation précède le récit de soi';
  app.CLICK['cap-add']();
  const n = d.modules.inbox.entries.at(-1);
  assert.equal(n.text, 'la dépersonnalisation précède le récit de soi'); assert.equal(n.ep, 'hyp');
  assert.match(app.nodes.get('#toast').textContent, /hypothèse/);
  // Changer de statut sur place : daté, et « vide » retire le statut.
  app.CHANGE['ep-set'](on({ mod: 'inbox', id: n.id }, { value: 'inx' }));
  assert.equal(n.ep, 'inx');
  assert.deepEqual([...n.epLog.map(x => [x.from, x.to])], [['hyp', 'inx']]);
  app.setEpStatus(n, '', '2026-09-27');
  assert.equal(n.ep, undefined); assert.equal(n.epLog.length, 2);
  app.setEpStatus(n, 'pas-un-statut', '2026-09-27');
  assert.equal(n.ep, undefined, 'unknown values are ignored');
  // Recherche : « statut:… » seul liste, combiné filtre ; accents et abréviation tolérés.
  d.modules.ecriture.scraps.push({ id: 'f1', text: 'Le DMN fabrique le sentiment de soi', date: '2026-09-01', ep: 'hyp' }, { id: 'f2', text: 'Le soi est symbolique', date: '2026-09-02', ep: 'int' });
  assert.deepEqual([...app.searchAll('statut:hypothèse').map(h => h.text)], ['Le DMN fabrique le sentiment de soi']);
  assert.deepEqual([...app.searchAll('soi statut:interp').map(h => h.text)], ['Le soi est symbolique']);
  assert.equal(app.searchAll('statut:nimportequoi').length, 0);
  assert.equal(app.searchAll('statut:').length, 0);
  // Bilan : le décompte par statut de la période.
  assert.deepEqual({ ...app.epCounts('2026-09-01', '2026-10-01') }, { hyp: 1, int: 1 });
  // Sauvegarde : un statut inconnu est refusé.
  const bad = JSON.parse(app.createBackup(app.board.data, d)); bad.site.modules.ecriture.scraps[0].ep = '<script>';
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /statut/);
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, d)));
});

test('provenance: what is filed from a box keeps a frozen copy of the note it came from', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  // Rangement reconnu (« module : texte ») : le fragment garde le texte complet d'origine, sa date, sa boîte et son statut.
  app.addCapture(d.modules.inbox.entries, 'Écriture : le seuil n’est pas un lieu', 'n1', '2026-09-03');
  d.modules.inbox.entries[0].ep = 'hyp';
  app.fileIntent(app.captureIntent('Écriture : le seuil n’est pas un lieu'), 'inbox', 'n1');
  const f = d.modules.ecriture.scraps.at(-1);
  assert.equal(f.text, 'le seuil n’est pas un lieu');
  assert.deepEqual({ ...f.origin }, { from: 'Capture', text: 'Écriture : le seuil n’est pas un lieu', date: '2026-09-03' });
  assert.equal(f.ep, 'hyp', 'the status follows where it can be read');
  // Rangement à la main vers une collection : provenance, mais pas de statut (il ne s'y lit pas).
  app.addCapture(d.modules.inbox.entries, 'la phalène et la lampe', 'n2', '2026-09-04');
  d.modules.inbox.entries[0].ep = 'obs';
  app.CLICK['note-to'](on({ mod: 'inbox', id: 'n2', to: 'moth' }));
  const t = d.modules.moth.entries.at(-1);
  assert.equal(t.origin.text, 'la phalène et la lampe'); assert.equal(t.ep, undefined);
  // Deux rangements successifs : la naissance la plus ancienne l'emporte.
  app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'carnet'), 'Carnet', 'carnet');
  d.config.modules.push({ id: 'carnet', on: true });
  app.addCapture(d.modules.inbox.entries, 'une phrase', 'n3', '2026-08-01');
  app.CLICK['note-to'](on({ mod: 'inbox', id: 'n3', to: 'carnet' }));
  const mid = d.modules.carnet.entries.at(-1);
  app.CLICK['note-to'](on({ mod: 'carnet', id: mid.id, to: 'ecriture' }));
  assert.deepEqual({ ...d.modules.ecriture.scraps.at(-1).origin }, { from: 'Capture', text: 'une phrase', date: '2026-08-01' });
  app.location.hash = '#ecriture'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /class="origin"[^>]*>↳ de Capture, 3 sept\. : « Écriture : le seuil/);
  // Sauvegarde : provenance valide acceptée, provenance malformée refusée.
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, d)));
  const bad = JSON.parse(app.createBackup(app.board.data, d)); bad.site.modules.moth.entries.at(-1).origin = { text: 3 };
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /provenance/);
});

test('resumption bridge: the next step noted on leaving shows on the module and at home, and its fate is kept', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const e = app.S().modules.ecriture;
  // Fin du minuteur dans un module : le champ s'ouvre de lui-même, sans rien imposer.
  app.location.hash = '#ecriture'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /data-act="bridge-edit"[^>]*>Je m'arrête ici/);
  app.timerDone();
  assert.match(app.nodes.get('#main').innerHTML, /id="bridgeIn"/);
  app.document.querySelector('#bridgeIn').value = 'réécrire l’ouverture du ch. 3';
  app.CLICK['bridge-save'](on({ mod: 'ecriture' }));
  assert.equal(e.resume.text, 'réécrire l’ouverture du ch. 3'); assert.equal(e.resume.at, today());
  assert.match(app.nodes.get('#main').innerHTML, /Reprendre :<\/b> réécrire l’ouverture du ch\. 3/);
  app.location.hash = '#accueil'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /class="resume ">↳ réécrire l’ouverture du ch\. 3 · aujourd'hui/);
  // Remplacé puis repris : l'historique garde ce qui était prévu et ce qu'il en est advenu.
  app.setResume(e, 'couper la citation', '2026-09-28');
  app.CLICK['bridge-done'](on({ mod: 'ecriture' }));
  assert.equal(e.resume, undefined);
  assert.deepEqual([...e.resumeLog.map(x => x.how)], ['remplacé', 'repris']);
  app.CLICK.undo(); // « Annuler »
  assert.equal(e.resume.text, 'couper la citation'); assert.equal(e.resumeLog.length, 1);
  app.setResume(e, 'couper la citation', '2026-09-29');
  assert.equal(e.resumeLog.length, 1, 'same text: nothing to log');
  // Sauvegarde : un pont malformé est refusé.
  const bad = JSON.parse(app.createBackup(app.board.data, app.S())); bad.site.modules.ecriture.resume = { text: 'x', at: 'hier' };
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /pont/);
});

test('decisions: a revision date comes back whatever the state, the reason is reread, « maintenue » is logged', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  const inst = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'decisions'), 'Décisions', 'decisions');
  d.config.modules.push({ id: 'decisions', on: true });
  assert.equal(inst.config.review, true);
  app.saveCollectionItem(inst, { title: 'Enduit à la chaux', text: 'Humidité du mur nord. Réviser si devis > 1 200 €.', status: 'Prise', due: '2020-01-01' }, 'x1');
  app.saveCollectionItem(inst, { title: 'Placo', status: 'Abandonnée', due: '2020-01-01' }, 'x2');
  app.saveCollectionItem(inst, { title: 'Plus tard', status: 'Prise', due: '2999-01-01' }, 'x3');
  const alerts = app.TYPE_UI.collection.alerts('decisions', inst, today());
  assert.equal(alerts.length, 1, 'taken counts, abandoned and future do not');
  assert.match(alerts[0].text, /« Enduit à la chaux » : à réexaminer/);
  assert.match(alerts[0].actions, /data-act="col-reread"/);
  // « maintenue » : réexamen daté, rendez-vous levé ; « Annuler » remet tout.
  app.CLICK['col-keep'](on({ mod: 'decisions', id: 'x1' }));
  const x1 = inst.entries.find(x => x.id === 'x1');
  assert.equal(x1.due, ''); assert.deepEqual([...x1.reviews.map(r => r.verdict)], ['maintenue']);
  assert.equal(app.TYPE_UI.collection.review(inst, today(), '2998-01-01'), '0 à réexaminer, 1 réexamen fait');
  app.CLICK.undo();
  assert.equal(x1.due, '2020-01-01'); assert.equal(x1.reviews.length, 0);
  // Une collection ordinaire garde son comportement : ce qui est « fait » ne revient pas.
  app.saveCollectionItem(d.modules.moth, { title: 'Publié', due: '2020-01-01', status: 'Publié' }, 'p1');
  assert.equal(app.TYPE_UI.collection.alerts('moth', d.modules.moth, today()).length, 0);
  app.location.hash = '#decisions'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /à réexaminer le/);
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, d)));
  const bad = JSON.parse(app.createBackup(app.board.data, d)); bad.site.modules.decisions.entries[0].reviews = [{ date: 'jamais' }];
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /réexamens/);
});

test('concordance: motifs counted as whole words across modules, with neighbours and fallow ones', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  const inst = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'motifs'), 'Motifs', 'motifs');
  d.config.modules.push({ id: 'motifs', on: true });
  app.saveCollectionItem(inst, { title: 'Lune', text: 'la lune, la lune, la lune' }, 'm1'); // ses propres textes ne comptent pas
  app.saveCollectionItem(inst, { title: 'seuil', subtitle: 'porte, pas de la porte' }, 'm2');
  app.saveCollectionItem(inst, { title: 'Sorcière' }, 'm3');
  app.saveCollectionItem(inst, { title: 'Phalène', status: 'Épuisé' }, 'm4');
  const t = today(), old = '2020-03-01';
  d.modules.ecriture.scraps.push(
    { id: 'a', text: 'La LUNE sur le seuil', date: t },
    { id: 'b', text: 'Sous les lunes, une porte basse', date: t },
    { id: 'c', text: 'Des lunettes de soleil, une lunaison', date: t },
    { id: 'd', text: 'Les sorcières du XIXe siècle', date: old },
    { id: 'e', text: 'phalène', date: old });
  app.addCapture(d.modules.inbox.entries, 'seuil sans date ?', 'n1', t);
  const rows = app.concordance(inst), by = Object.fromEntries(rows.map(r => [r.e.title, r]));
  assert.equal(by.Lune.hits.length, 2, 'whole word, plural tolerated, « lunettes » and « lunaison » excluded, own module excluded');
  assert.equal(by.seuil.hits.length, 3, 'variants count as the motif');
  assert.deepEqual([...by.Lune.neighbours.map(x => `${x.name}:${x.n}`)], ['seuil:2']);
  assert.equal(by.Sorcière.neighbours.length, 0);
  assert.equal(by.Sorcière.last.date, old); assert.equal(by.Sorcière.last.mod, 'ecriture');
  assert.deepEqual([...app.motifsIn(inst, t, '9999-01-01').map(x => `${x.name}:${x.n}`)], ['seuil:3', 'Lune:2']);
  assert.equal(app.TYPE_UI.collection.review(inst, t, '9999-01-01'), 'seuil ×3, Lune ×2');
  assert.equal(app.summaryFor('motifs'), '4 motifs, 1 en jachère', 'the retired one is not fallow, only the living absent one');
  app.location.hash = '#motifs'; app.render();
  const html = app.nodes.get('#main').innerHTML;
  assert.match(html, /<h3>En jachère<\/h3>/);
  assert.match(html, /Sorcière · \d+ lunaisons/);
  assert.match(html, /voisins : seuil \(2\)/);
  assert.match(html, /data-act="search-for" data-q="Lune"/);
  // Une collection ordinaire n'est pas une concordance, et une sauvegarde reste valide.
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, d)));
  const bad = JSON.parse(app.createBackup(app.board.data, d)); bad.site.modules.motifs.config.fallowDays = -3;
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /jachère/);
});

test('settings numbers stay within what backup validation accepts, so an export can always be restored', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const input = (setMod, value, max = '') => ({ dataset: { setMod }, type: 'number', value, max, required: false, blur() {}, closest: () => null });
  app.fire('change', input('kundalini.weeks', '600', '520'));
  assert.equal(app.S().modules.kundalini.config.weeks, 520, 'clamped to the field maximum');
  app.fire('change', input('kundalini.weeks', '-4', '520'));
  assert.equal(app.S().modules.kundalini.config.weeks, 1, 'and to its minimum');
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, app.S())));
  // Chaque champ numérique des réglages porte le plafond de sa validation.
  app.location.hash = '#reglages'; app.render();
  const html = app.nodes.get('#main').innerHTML;
  assert.match(html, /max="520" data-set-mod="kundalini\.weeks"/);
  assert.match(html, /max="7" data-set-mod="kundalini\.perWeek"/);
});

test('decisions: editing an overdue revision date counts as a review; an ordinary edit does not', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  const inst = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'decisions'), 'Décisions', 'decisions');
  app.saveCollectionItem(inst, { title: 'Chaux', status: 'Prise', due: '2020-01-01' }, 'x1');
  app.saveCollectionItem(inst, { title: 'Chaux, mur nord' }, 'x1', '2026-09-28');
  assert.equal(inst.entries[0].reviews, undefined, 'date unchanged: not a review');
  app.saveCollectionItem(inst, { title: 'Chaux, mur nord', due: '2027-03-01' }, 'x1', '2026-09-28');
  assert.deepEqual([...inst.entries[0].reviews.map(r => `${r.date} ${r.verdict}`)], ['2026-09-28 revue']);
  app.saveCollectionItem(inst, { title: 'Chaux', due: '2027-06-01' }, 'x1', '2026-09-28');
  assert.equal(inst.entries[0].reviews.length, 1, 'moving a future date is planning, not reviewing');
  app.saveCollectionItem(d.modules.moth, { title: 'Post', due: '2020-01-01' }, 'p1');
  app.saveCollectionItem(d.modules.moth, { title: 'Post', due: '2027-01-01' }, 'p1', '2026-09-28');
  assert.equal(d.modules.moth.entries.at(-1).reviews, undefined, 'only in revision mode');
});

test('concordance: multi-word variants, accents, and the same answer as before the inverted index', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  const inst = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'motifs'), 'Motifs', 'motifs');
  app.saveCollectionItem(inst, { title: 'Phalène', subtitle: 'papillon de nuit, moth' }, 'm1');
  app.saveCollectionItem(inst, { title: 'Œuvre au noir' }, 'm2');
  d.modules.ecriture.scraps.push(
    { id: 'a', text: 'Un PAPILLON  DE NUIT contre la vitre', date: '2026-09-01' },
    { id: 'b', text: 'october.moth, encore', date: '2026-09-02' },
    { id: 'c', text: 'les phalenes', date: '2026-09-03' },
    { id: 'd', text: 'papillon de jour', date: '2026-09-04' },
    { id: 'e', text: 'mothra', date: '2026-09-05' },
    { id: 'f', text: 'L’œuvre au noir, chez Yourcenar', date: '2026-09-06' });
  const by = Object.fromEntries(app.concordance(inst).map(r => [r.e.title, [...r.hits.map(h => h.date.slice(-2))]]));
  assert.deepEqual(by['Phalène'], ['01', '02', '03'], 'several words with any spacing, a variant after punctuation, accents ignored; not « papillon de jour » nor « mothra »');
  assert.deepEqual(by['Œuvre au noir'], ['06']);
});

test('lexical drift: words proper to the period against the six before, stopwords and plurals handled', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S(), inbox = d.modules.inbox.entries, month = k => app.periodOf('mois', k).from;
  let n = 0; const note = (text, date) => inbox.push({ id: 'n' + n++, text, date });
  assert.equal(app.lexicalDrift('mois', 0).enough, false, 'too few texts: says so instead of inventing a trend');
  for (const t of ['La lune sur le seuil', 'Des lunes et du brouillard', 'Encore la lune, encore', 'Le brouillard monte', 'Une phrase quelconque', 'La forêt']) note(t, month(0));
  for (const [t, k] of [['La forêt, la cendre', 1], ['Forêt noire', 2], ['Cendre et forêt', 3], ['Cendres froides', 4], ['Une forêt', 5], ['La lune, une fois', 6], ['Rien de neuf', 6]]) note(t, month(k));
  note('Lune lune lune, trop ancienne', month(7)); // hors des six périodes de référence
  const r = app.lexicalDrift('mois', 0);
  assert.equal(r.enough, true);
  assert.deepEqual([...r.rising.map(x => `${r.word(x.k)}:${x.n}/${x.before}`)], ['brouillard:2/0', 'lune:3/1'], 'plural folded into the singular, one count per text, displayed as written; what is new outranks what merely grew');
  assert.deepEqual([...r.fading.map(x => `${r.word(x.k)}:${x.n}`)], ['cendre:3'], 'frequent before, absent now; « forêt » is still here');
  assert.ok(![...app.driftWords('Encore sur le seuil, avec 12 € et des lunes').keys()].some(k => ['encore', 'sur', 'avec', 'des', '12'].includes(k)), 'stopwords, short words and numbers ignored');
  assert.equal(app.driftWords('Forêts').get('foret'), 'forêts', 'key folded, surface kept');
  // Un motif ajouté depuis le bilan ; la concordance elle-même n'entre pas dans le vocabulaire.
  const m = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'motifs'), 'Motifs', 'motifs');
  d.config.modules.push({ id: 'motifs', on: true });
  app.CLICK['motif-add']({ dataset: { mod: 'motifs', q: 'brouillard' } });
  app.CLICK['motif-add']({ dataset: { mod: 'motifs', q: 'Brouillard' } });
  assert.deepEqual([...m.entries.map(e => e.title)], ['brouillard'], 'added once');
  m.entries[0].text = 'brouillard brouillard';
  assert.equal(app.lexicalDrift('mois', 0).rising.find(x => x.k === 'brouillard').n, 2, 'the motifs module is not part of the corpus');
  app.location.hash = '#bilan'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /<h3>Vocabulaire<\/h3>/);
});
