const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('selene.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function launch(storage, { claude = null, bare = false, clock = null } = {}) {
  if (!bare && !storage.has('selene-site-v1')) storage.set('selene-site-v1', fs.readFileSync('tests/fixtures/site-demo.json', 'utf8')); // jeu d'essai riche
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      id, dataset: {}, value: '', textContent: '', innerHTML: '',
      classList: { add() {}, remove() {} }, addEventListener() {},
      querySelectorAll() { return []; }, focus() {}, showModal() {} // n'ouvre rien pour de vrai : un formulaire sans confirmation reste testable ici
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
  // clock : une horloge simulée ({ Date, setTimeout }) pour le passage de minuit.
  const context = { document, window, localStorage, location,
    navigator: {}, console, Date: clock ? clock.Date : Date, Math, setTimeout: clock ? clock.setTimeout : setTimeout, clearTimeout, setInterval, clearInterval };
  const instrumented = script.replace(/\}\);\s*\}\)\(\);\s*$/, 'globalThis.__test = { ...__selene, submitModuleForm: values => __selene.formCb(values) };\n});\n})();'); // dans platform.ready
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
  const addOne = { regulation: (inst, id) => { app.setupRegulation(inst, { subject: 'tabac', date: '2026-09-27', mode: 'reduire', limit: 5 }, 'goal', '2026-09-27', 1); app.saveRegulationEvent(inst, { kind: 'use', date: '2026-09-27', value: 2 }, id, '2026-09-27', 2); },
    programme: journal, cumul: journal, rappels: journal, notes: journal,
    collection: (inst, id) => app.saveCollectionItem(inst, { title: 'Premier élément', tag: 'essai' }, id),
    taches: (inst, id) => app.addTask(inst.entries, { title: 'Première tâche', cat: 'Général' }, id, '2026-09-27'),
    budget: (inst, id) => app.addBudgetEntry(inst.entries, { amount: 12, type: 'dépense', cat: 'essai', date: '2026-09-27' }, id, '2026-09-27'),
    arc: (inst, id) => { inst.config.stations.push({ id: 'st1', name: 'Étape 1' }); inst.entries.push({ id, station: 'st1', ref: 'inbox/ghost', at: '2026-09-27' }); } };
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
  assert.throws(() => app.saveCollectionItem(mus, { title: '  ' }, 'x'), /Artiste : à remplir/);
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
  // L'enveloppe devinée d'après son nom, dans la langue de la personne : « Home improvement », « Rénovation »…
  d.modules.budget.config.envelopes.find(v => v.name === 'Travaux').name = 'Home improvement';
  app.addTask(d.modules.chantier.entries, { title: 'Gutter', cost: 80 }, 't2', '2026-09-27');
  app.CHANGE['task-done']({ checked: true, closest: sel => sel === '[data-task]' ? { dataset: { task: 't2', mod: 'chantier' } } : null });
  assert.match(app.nodes.get('#toast').innerHTML, /80,00.*Home improvement/);
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
  for (const plain of ['acheter du pain', 'rdv : 14h chez le dentiste', '25 min de marche', '0 € rien', '€0 rien']) assert.equal(app.captureIntent(plain), null, plain);
  // Écrits à l'anglaise : la monnaie devant la somme, « mins ».
  const i4 = app.captureIntent('€12.50 courses');
  assert.equal(i4.to, 'budget'); assert.equal(i4.amount, 12.5); assert.equal(i4.cat, 'Courses');
  assert.equal(app.captureIntent('25 mins kundalini').value, 25);
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
  // « status: » vaut « statut: » (l'anglais, quelle que soit la langue de l'interface).
  assert.deepEqual([...app.searchAll('Status:Hyp').map(h => h.text)], ['Le DMN fabrique le sentiment de soi']);
  assert.equal(app.searchAll('status:').length, 0);
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

test('texts in several languages: each read in its own (stopwords, plurals); motifs find English plurals too', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  assert.equal(app.textLang(['the', 'stories', 'of', 'the', 'moon']), 'en');
  assert.equal(app.textLang(['la', 'lune', 'et', 'le', 'seuil']), 'fr');
  assert.equal(app.textLang(['lune']), 'fr', 'no marker: the interface language decides');
  assert.equal(app.textLang(['lune'], 'en'), 'en');
  assert.equal(app.textLang(['the', 'la']), 'fr', 'a tie: the interface language decides');
  const en = app.driftWords('The stories of the boxes and the glasses, with parties and cats');
  assert.ok(![...en.keys()].some(k => ['the', 'and', 'with'].includes(k)), 'English stopwords ignored in an English text');
  assert.deepEqual(['story', 'box', 'glass', 'party', 'cat'].map(k => en.get(k)), ['stories', 'boxes', 'glasses', 'parties', 'cats'], 'English plurals folded (Porter, step 1a)');
  const fr = app.driftWords('Les parties de la forêt, avec des lunes');
  assert.equal(fr.get('partie'), 'parties', 'a French text keeps the French rule: « parties » is not « party »');
  assert.ok(!fr.has('avec') && fr.has('lune'));
  // Concordance : les pluriels sont engendrés depuis le motif, dans les deux langues.
  const hit = (title, text) => app.motifHit(app.motifForms({ title, subtitle: '' }), text);
  assert.ok(hit('story', 'Two stories tonight')); assert.ok(hit('box', 'Boxes everywhere')); assert.ok(hit('moon', 'Moons'));
  assert.ok(hit('lune', 'Des lunes')); assert.ok(hit('bijou', 'Des bijoux'));
  assert.ok(!hit('lune', 'Mes lunettes'), 'whole words only');
});

test('links: derive, contradict, backlinks, tensions resolved by a synthesis of both', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S(), e = d.modules.ecriture;
  e.scraps.push({ id: 'a', text: 'Le DMN fabrique le soi', date: '2026-09-01' }, { id: 'b', text: 'Le soi est symbolique', date: '2026-09-02' });
  assert.throws(() => app.addLink(e.scraps[0], 'ecriture/b', 'aime', 'l0', '2026-09-03'), /Lien invalide/);
  assert.throws(() => app.addLink(e.scraps[0], 'pas une référence', 'echo', 'l0', '2026-09-03'), /Lien invalide/);
  // Dériver : la prochaine entrée écrite dans le module dérive de la source.
  app.location.hash = '#ecriture'; app.render();
  app.CLICK['derive-start'](on({ mod: 'ecriture', id: 'a' }));
  assert.match(app.nodes.get('#main').innerHTML, /class="derive">Dérivé de <a href="#ecriture\/a">« Le DMN fabrique le soi »/);
  app.document.querySelector('#scrapIn').value = 'Le soi comme effet de réseau';
  app.CLICK['scrap-add'](on({ mod: 'ecriture' }));
  const c = e.scraps.at(-1);
  assert.deepEqual([...c.links.map(l => `${l.type}>${l.to}`)], ['derive>ecriture/a']);
  assert.match(app.nodes.get('#main').innerHTML, /a donné <a href="#ecriture\/[a-z0-9]+">« Le soi comme effet de réseau »/, 'backlink on the source');
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /class="derive"/, 'the banner is gone once used');
  // Contredire : une tension ouverte, jusqu'à une synthèse qui dérive des deux.
  assert.ok(app.addLink(e.scraps[1], 'ecriture/a', 'contredit', 'l1', '2026-09-04'));
  assert.equal(app.addLink(e.scraps[1], 'ecriture/a', 'contredit', 'l2', '2026-09-05'), null, 'no duplicate link');
  assert.equal(app.openTensions().length, 1);
  app.location.hash = '#bilan'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /<h3>Tensions ouvertes<\/h3>/);
  app.CLICK['tension-resolve']({ dataset: { a: 'ecriture/b', b: 'ecriture/a' } });
  assert.equal(app.location.hash, 'ecriture');
  app.location.hash = '#ecriture'; app.render(); // un vrai navigateur ajoute le « # » ; ce faux location, non
  assert.match(app.nodes.get('#main').innerHTML, /Synthèse de <a[^>]*>« Le soi est symbolique »<\/a> et <a[^>]*>« Le DMN fabrique le soi »/);
  app.document.querySelector('#scrapIn').value = 'Le soi, symbole que le réseau se donne';
  app.CLICK['scrap-add'](on({ mod: 'ecriture' }));
  assert.equal(app.openTensions().length, 0, 'resolved by a fragment deriving from both');
  // Une cible supprimée : le lien le dit, et une tension orpheline n'est plus une tension.
  assert.ok(app.addLink(e.scraps[1], 'ecriture/zz', 'contredit', 'l3', '2026-09-06'));
  assert.equal(app.openTensions().length, 0);
  app.location.hash = '#ecriture'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /contredit <i>\(supprimé\)<\/i>/);
  // Sauvegarde : liens valides acceptés, lien malformé refusé.
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, d)));
  const bad = JSON.parse(app.createBackup(app.board.data, d)); bad.site.modules.ecriture.scraps[1].links[0].to = '../../x';
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /liaison/);
});

test('links: a filed note carries its links and the links aimed at it follow it', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S(), e = d.modules.ecriture;
  e.scraps.push({ id: 'a', text: 'Le seuil', date: '2026-09-01' });
  app.addCapture(d.modules.inbox.entries, 'une idée sur le seuil', 'n1', '2026-09-02');
  app.addLink(d.modules.inbox.entries[0], 'ecriture/a', 'echo', 'l1', '2026-09-02'); // la note vise un fragment
  app.addLink(e.scraps[0], 'inbox/n1', 'documente', 'l2', '2026-09-02');           // un fragment vise la note
  app.CLICK['note-to'](on({ mod: 'inbox', id: 'n1', to: 'ecriture' }));
  const born = e.scraps.at(-1);
  assert.deepEqual([...born.links.map(l => l.to)], ['ecriture/a'], 'outgoing links follow');
  assert.equal(e.scraps[0].links[0].to, `ecriture/${born.id}`, 'incoming links are retargeted');
});

test('links: added on two devices to the same entry, both survive the merge', () => {
  const app = launch(new Map());
  const frag = links => ({ id: 'a', text: 'x', date: '2026-09-01', ...(links ? { links } : {}) });
  const doc = scraps => ({ updatedAt: 1, modules: { ecriture: { type: 'cumul', scraps } } });
  const base = doc([frag()]), l1 = { id: 'l1', to: 'ecriture/b', type: 'echo', date: '2026-09-02' }, l2 = { id: 'l2', to: 'ecriture/c', type: 'contredit', date: '2026-09-02' };
  const local = { ...doc([frag([l1])]), updatedAt: 2 }, remote = { ...doc([frag([l2])]), updatedAt: 3 };
  const merged = app.mergeDocs(base, local, remote);
  assert.deepEqual([...merged.modules.ecriture.scraps[0].links.map(l => l.id)].sort(), ['l1', 'l2']);
});

test('dossier: dated, labelled entries with status, provenance and links as internal cross-references', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const e = app.S().modules.ecriture;
  e.scraps.push(
    { id: 'a', text: 'Le DMN fabrique le soi', date: '2026-09-01', ep: 'hyp', origin: { from: 'Capture', text: 'Écriture : le DMN fabrique le soi', date: '2026-08-30' } },
    { id: 'b', text: 'Le soi est symbolique', date: '2026-09-02', ep: 'int' },
    { id: 'c', text: 'Hors dossier', date: '2026-09-03' });
  app.addLink(e.scraps[1], 'ecriture/a', 'contredit', 'l1', '2026-09-04');
  app.addLink(e.scraps[1], 'ecriture/c', 'echo', 'l2', '2026-09-04');
  app.addLink(e.scraps[1], 'ecriture/zz', 'documente', 'l3', '2026-09-04');
  const md = app.dossierMarkdown('Écriture "brouillon"', 'Fragments', [
    { mod: 'ecriture', text: e.scraps[0].text, date: '2026-09-01', e: e.scraps[0] },
    { mod: 'ecriture', text: e.scraps[1].text, date: '2026-09-02', e: e.scraps[1] },
    { mod: 'budget', text: 'Pas une pensée, juste une ligne', date: null }]);
  assert.match(md, /^---\ntitre: "Écriture \\"brouillon\\""\nsource: "Selene"/, 'YAML front matter, quotes escaped');
  assert.match(md, /entrees: 3\n---/);
  assert.match(md, /Ne pas traiter une hypothèse comme un fait, ni combler un inexpliqué/, 'reading legend for an assistant');
  assert.match(md, /## 1\. 1er septembre 2026 · Écriture · hypothèse\n\nLe DMN fabrique le soi\n\n\*Provenance : Capture, 30 août 2026 : « Écriture : le DMN fabrique le soi »\*/);
  assert.match(md, /\*Liens : contredit \[1\] ; fait écho à « Hors dossier » \(hors dossier\) ; documente \(supprimé\)\*/, 'links: cross-reference inside, excerpt outside, deletion said');
  assert.match(md, /## 3\. Budget\n\nPas une pensée/, 'an entry without date or status still has its module');
  assert.doesNotMatch(md, /\n\n\n/, 'no blank-line pile-ups');
});

test('dossier de passation : les sources qui documentent une entrée, en références avec leur DOI', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const S = app.S(), e = S.modules.ecriture;
  S.modules.sources = { type: 'collection', label: 'Sources', config: { ...JSON.parse(JSON.stringify(S.modules.musique.config)), music: false, sources: true }, entries: [
    { id: 's1', title: 'Depersonalization and the self', subtitle: 'Anna Ciaunica', status: 'À lire', src: { doi: '10.1016/j.concog.2020.102946', url: 'https://doi.org/10.1016/j.concog.2020.102946', site: 'Consciousness and Cognition', date: '2020-05-12' },
      links: [{ id: 'l1', to: 'ecriture/a', type: 'documente', date: '2026-09-01' }] },
    { id: 's2', title: 'Un billet', subtitle: '', status: 'À lire', src: { url: 'https://blog.example/billet' }, links: [{ id: 'l2', to: 'ecriture/a', type: 'documente', date: '2026-09-01' }, { id: 'l3', to: 'ecriture/b', type: 'documente', date: '2026-09-01' }] },
    { id: 's3', title: 'Hors sujet', subtitle: 'X Y', status: 'À lire', src: { url: 'https://x.example/' }, links: [{ id: 'l4', to: 'ecriture/zz', type: 'documente', date: '2026-09-01' }] }] };
  S.config.modules.push({ id: 'sources', on: true });
  e.scraps.push({ id: 'a', text: 'Le soi se regarde vivre', date: '2026-09-01', ep: 'hyp' }, { id: 'b', text: 'Une autre pensée', date: '2026-09-02' });
  const md = app.dossierMarkdown('Dossier', 'Test', [
    { mod: 'ecriture', text: 'Le soi se regarde vivre', date: '2026-09-01', e: e.scraps.find(x => x.id === 'a') },
    { mod: 'ecriture', text: 'Une autre pensée', date: '2026-09-02', e: e.scraps.find(x => x.id === 'b') },
    { mod: 'sources', text: 'Un billet', date: null, e: S.modules.sources.entries[1] }]);
  assert.match(md, /perimetre: "Test"\nreferences: 2\nentrees: 3\n---/, 'the front matter counts the references');
  assert.match(md, /les renvois \[Sn\], les références en fin de dossier .* Qu'une source documente une entrée ne la prouve pas\./);
  assert.match(md, /Le soi se regarde vivre\n\n\*Documenté par : \[S1\], \[S2\]\*/, 'numbered in order of first citation');
  assert.match(md, /Une autre pensée\n\n\*Documenté par : \[S2\]\*/, 'a source cited twice keeps its number');
  assert.match(md, /Un billet\n\n\*Référence : \[S2\]\*/, 'a source in the dossier points to its reference');
  assert.match(md, /## Références\n\n\[S1\] Anna Ciaunica \(2020\)\. \*Depersonalization and the self\*\. Consciousness and Cognition\. https:\/\/doi\.org\/10\.1016\/j\.concog\.2020\.102946\n\n\[S2\] Anonyme \(s\. d\.\)\. \*Un billet\*\. https:\/\/blog\.example\/billet\n$/, 'APA-like references, DOI first, unknown author and date said');
  assert.doesNotMatch(md, /Hors sujet/, 'a source documenting nothing in the dossier stays out');
  const bare = app.dossierMarkdown('Sans', 'Rien', [{ mod: 'budget', text: 'une ligne', date: null }]);
  assert.doesNotMatch(bare, /references:|Références|\[Sn\]/, 'no sources, no reference section');
});

test('long lists show a hundred items, then « voir les suivants »', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const inbox = app.S().modules.inbox.entries;
  for (let i = 0; i < 250; i++) inbox.push({ id: 'n' + i, text: 'note ' + i, date: '2026-09-01' });
  const count = () => (app.nodes.get('#main').innerHTML.match(/<li class="item" data-id=/g) || []).length;
  app.location.hash = '#inbox'; app.render();
  assert.equal(count(), 100);
  assert.match(app.nodes.get('#main').innerHTML, /Voir les 100 suivants \(150 de plus\)/);
  assert.match(app.nodes.get('#main').innerHTML, /note 249/, 'newest first');
  app.CLICK['page-more']({ dataset: { k: 'notes:inbox' } });
  app.CLICK['page-more']({ dataset: { k: 'notes:inbox' } });
  assert.equal(count(), 250);
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /Voir les/, 'nothing more to show');
});

test('arc: placing, empty stations stay visible, removal, station lifecycle', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  const inst = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'arc'), 'Album', 'album');
  d.config.modules.push({ id: 'album', on: true });
  assert.deepEqual([...inst.config.stations.map(s => s.name)], ['Étape 1', 'Étape 2', 'Étape 3']);
  d.modules.ecriture.scraps.push({ id: 'f1', text: 'Le seuil comme allégorie', date: '2026-09-01' });
  app.saveCollectionItem(d.modules.musique, { title: 'Dead Can Dance', subtitle: 'Within the Realm' }, 'm1');
  const cands = app.arcCandidates();
  assert.ok(cands.some(c => c.ref === 'ecriture/f1') && cands.some(c => c.ref === 'musique/m1'), 'fragments and collection items are candidates');
  assert.ok(!cands.some(c => c.mod === 'motifs'), 'a concordance is structure, not content, and stays out');
  inst.entries.push({ id: 'p1', station: inst.config.stations[0].id, ref: 'ecriture/f1', at: '2026-09-02' });
  assert.equal(app.summaryFor('album'), '1 élément sur 3 étapes, 2 vides');
  app.location.hash = '#album'; app.render();
  let html = app.nodes.get('#main').innerHTML;
  assert.match(html, /Étape 1 <span[^>]*>1<\/span>.*Le seuil comme allégorie/s);
  assert.match(html, /Étape 2 <span[^>]*>0<\/span>.*Vide\./s, 'an empty station is shown empty, not hidden');
  assert.match(app.TYPE_UI.arc.context(inst, 'ALBUM'), /vide à : Étape 2, Étape 3/);
  // Retirer un placement (« annuler » le remet).
  app.CLICK['arc-remove']({ dataset: { mod: 'album', id: 'p1' }, closest: sel => sel === '[data-id]' ? { dataset: { id: 'p1' } } : null });
  assert.equal(inst.entries.length, 0);
  app.CLICK.undo();
  assert.equal(inst.entries.length, 1);
  // Renommer une étape.
  app.CHANGE['stat-name']({ dataset: { mod: 'album' }, closest: () => ({ dataset: { sti: '0' } }), value: 'Esquisse', blur() {} });
  assert.equal(inst.config.stations[0].name, 'Esquisse');
  // Une cible supprimée : la carte le dit, sans planter (la suppression d'une étape, confirmée par boîte de
  // dialogue, est couverte par le scénario navigateur : le faux « #cdlg » de ce banc ne se ferme jamais).
  inst.entries.push({ id: 'p3', station: inst.config.stations[0].id, ref: 'ecriture/zz', at: '2026-09-04' });
  app.render();
  assert.match(app.nodes.get('#main').innerHTML, /\(supprimé\)/);
  // Sauvegarde : formats valides acceptés, malformés refusés.
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, d)));
  const bad = JSON.parse(app.createBackup(app.board.data, d)); bad.site.modules.album.entries[0].ref = 'pas une ref';
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /placement/);
  const bad2 = JSON.parse(app.createBackup(app.board.data, d)); bad2.site.modules.album.config.stations[0].name = '';
  assert.throws(() => app.parseBackup(JSON.stringify(bad2)), /étape/);
});


test('tiers: criteria are self-written and self-checked, the app never advances a tier on its own', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S(), k = d.modules.kundalini;
  k.config.start = '2026-01-05'; // un protocole commencé : la vue principale s'affiche, pas l'écran « commencer »
  assert.equal(k.config.tiers.length, 0, 'invisible until added, an existing protocol is untouched');
  assert.equal(app.tierCurrent(k.config), null);
  // Réglages : ajouter un palier et un critère, comme on le ferait à l'écran.
  const ti = { dataset: { mod: 'kundalini' }, closest: () => ({ dataset: { tri: '0' } }) };
  app.CLICK['tier-add'](ti);
  app.CLICK['tier-add'](ti);
  app.CHANGE['tier-name']({ ...ti, value: 'Souffle', blur() {} });
  app.CLICK['crit-add']({ dataset: { mod: 'kundalini', tri: '0' } });
  const cri = { dataset: { mod: 'kundalini' }, closest: sel => sel === '[data-cri]' ? { dataset: { tri: '0', cri: '0' } } : null };
  app.CHANGE['crit-text']({ ...cri, value: '12 séances à 20 min', blur() {} });
  assert.equal(k.config.tiers[0].name, 'Souffle');
  assert.equal(k.config.tiers[0].criteria[0].text, '12 séances à 20 min');
  // Vider le texte d'un critère le retire, plutôt que de garder une ligne vide.
  app.CLICK['crit-add']({ dataset: { mod: 'kundalini', tri: '0' } });
  app.CHANGE['crit-text']({ dataset: { mod: 'kundalini' }, closest: sel => sel === '[data-cri]' ? { dataset: { tri: '0', cri: '1' } } : null, value: '  ', blur() {} });
  assert.equal(k.config.tiers[0].criteria.length, 1, 'an emptied criterion disappears instead of lingering blank');

  const cId = k.config.tiers[0].criteria[0].id;
  assert.equal(app.tierCurrent(k.config).name, 'Souffle');
  // Cocher un critère ne fait rien avancer : c'est une note, pas un déclencheur.
  app.CHANGE['tier-check']({ dataset: { mod: 'kundalini' }, closest: sel => sel === '[data-id]' ? { dataset: { id: cId } } : null, checked: true });
  assert.equal(k.config.tiers[0].criteria[0].done, true);
  assert.equal(k.config.tiers[0].advancedAt, undefined, 'checking a box never advances anything');
  assert.equal(app.tierCurrent(k.config).name, 'Souffle');
  app.location.hash = '#kundalini'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /1 sur 1 critère coché\. Tous cochés\. Le passage reste ton choix/);

  // Sans module Décisions actif : le passage a lieu, un simple message le confirme.
  assert.equal(app.firstDecisions(), null, 'the demo fixture ships no decisions-mode collection');
  app.CLICK['tier-advance'](ti);
  assert.equal(k.config.tiers[0].advancedAt, today());
  assert.equal(app.tierCurrent(k.config).name, 'Palier 2', 'moved on to the next tier');
  assert.match(app.nodes.get('#toast').textContent, /Palier « Souffle » atteint\./);
  app.render();
  assert.match(app.nodes.get('#main').innerHTML, /« Souffle » atteint le/);

  // Avec un module Décisions actif : le passage propose une décision prête à compléter, jamais enregistrée seule.
  const dec = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'decisions'), 'Décisions', 'decisions');
  d.config.modules.push({ id: 'decisions', on: true });
  assert.equal(app.firstDecisions(), 'decisions');
  app.CLICK['tier-advance'](ti);
  assert.equal(app.tierCurrent(k.config), null, 'both tiers now passed');
  assert.equal(dec.entries.length, 0, 'nothing is saved before the form is actually submitted');
  assert.match(app.nodes.get('#form').innerHTML, /Noter la décision.*Palier 2/s);
  assert.match(app.nodes.get('#form').innerHTML, /value="Palier « Palier 2 » atteint \(Kundalini\)"/);
  app.location.hash = '#kundalini'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /Tous les paliers sont franchis\./);

  // Sauvegarde : formes valides acceptées, malformées refusées.
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, d)));
  const bad = JSON.parse(app.createBackup(app.board.data, d)); bad.site.modules.kundalini.config.tiers[0].name = '';
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /palier/);
  const bad2 = JSON.parse(app.createBackup(app.board.data, d)); bad2.site.modules.kundalini.config.tiers[0].criteria = [{ id: 'c1', text: '', done: false }];
  assert.throws(() => app.parseBackup(JSON.stringify(bad2)), /critère/);
});

test('palimpsest: editing a fragment keeps its earlier text, capped, visible in place', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const e = app.S().modules.ecriture;
  e.scraps.push({ id: 'f1', text: 'Le brouillard.', date: '2026-09-01' });
  const f = e.scraps[0];
  assert.equal(app.editFragmentText(f, 'Le brouillard.', '2000-01-01'), false, 'identical text is not an edit');
  assert.equal(f.versions, undefined);
  assert.equal(app.editFragmentText(f, '   ', '2000-01-01'), false, 'blank text is not an edit either');
  assert.equal(app.editFragmentText(f, 'Le brouillard monte.', '2000-01-01'), true);
  assert.deepEqual([...f.versions.map(v => v.text)], ['Le brouillard.']);
  assert.equal(f.text, 'Le brouillard monte.'); assert.equal(f.editedAt, '2000-01-01');
  // Plafonné à dix versions : la plus ancienne s'efface, jamais la plus récente.
  for (let i = 0; i < 11; i++) app.editFragmentText(f, 'v' + i, '2000-01-0' + (2 + (i % 8)));
  app.editFragmentText(f, 'v11', today());
  assert.equal(f.versions.length, 10);
  assert.equal(f.versions[0].text, 'v1', 'oldest dropped first');
  assert.equal(f.versions.at(-1).text, 'v10');
  assert.equal(f.text, 'v11'); assert.equal(f.editedAt, today());

  app.location.hash = '#ecriture'; app.render();
  const el = { dataset: { mod: 'ecriture' }, closest: sel => sel === '[data-id]' ? { dataset: { id: 'f1' } } : null };
  app.CLICK['scrap-edit'](el);
  assert.match(app.nodes.get('#form').innerHTML, /v11/, 'the edit form starts from the current text');
  app.document.querySelector('[name=text]'); // (le champ existe dans #form ; pas de sélecteur dédié dans ce banc)
  app.render();
  const html = app.nodes.get('#main').innerHTML;
  assert.match(html, /modifié aujourd'hui/);
  assert.match(html, /10 versions antérieures/);
  assert.match(html, / : v10/);
  assert.doesNotMatch(html, />v1</, 'the oldest, dropped version is gone');

  // Sauvegarde : forme valide acceptée, malformée refusée.
  assert.doesNotThrow(() => app.parseBackup(app.createBackup(app.board.data, app.S())));
  const bad = JSON.parse(app.createBackup(app.board.data, app.S())); bad.site.modules.ecriture.scraps[0].versions[0].text = 3;
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /version/);
  const bad2 = JSON.parse(app.createBackup(app.board.data, app.S())); bad2.site.modules.ecriture.scraps[0].editedAt = 'hier';
  assert.throws(() => app.parseBackup(JSON.stringify(bad2)), /fragment/);
});

test('sortes: only what has been silent long enough is drawn, weighted by how long', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S(), e = d.modules.ecriture;
  const old = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), ancient = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const recent = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  e.scraps.push({ id: 'old', text: 'Un fragment oublié depuis longtemps', date: old });
  e.scraps.push({ id: 'new', text: 'Écrit avant-hier', date: recent });
  app.addCapture(d.modules.inbox.entries, 'une note ancienne', 'n1', old);
  const pool = app.sortesPool();
  assert.ok(pool.some(x => x.kind === 'fragment' && x.e.id === 'old'), 'old enough to be forgotten');
  assert.ok(!pool.some(x => x.e && x.e.id === 'new'), 'three days is not neglect');
  assert.ok(pool.some(x => x.kind === 'note' && x.e.id === 'n1'));
  // Une édition récente sort un fragment ancien du bassin : ce qui compte, c'est le dernier contact.
  app.editFragmentText(e.scraps[0], 'Un fragment repris', today());
  assert.ok(!app.sortesPool().some(x => x.e && x.e.id === 'old'), 'freshly edited, no longer neglected');
  // Un module désactivé n'alimente pas le tirage.
  d.config.modules.find(m => m.id === 'inbox').on = false;
  assert.ok(!app.sortesPool().some(x => x.kind === 'note'), 'a disabled module contributes nothing');
  d.config.modules.find(m => m.id === 'inbox').on = true;
  // Une tension ouverte, ancienne, entre dans le bassin ; résolue, elle en sort.
  d.modules.ecriture.scraps.push({ id: 'a', text: 'Le soi comme réseau', date: old }, { id: 'b', text: 'Le soi comme symbole', date: old });
  app.addLink(d.modules.ecriture.scraps.find(x => x.id === 'b'), 'ecriture/a', 'contredit', 'l1', old);
  assert.ok(app.sortesPool().some(x => x.kind === 'tension'));
  // Un motif en jachère, mais pas un motif « Épuisé » ni un motif vivant récemment rencontré.
  const m = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'motifs'), 'Motifs', 'motifs');
  d.config.modules.push({ id: 'motifs', on: true });
  app.saveCollectionItem(m, { title: 'Sorcière' }, 'm1');
  app.saveCollectionItem(m, { title: 'Jamais' }, 'm0'); // jamais rencontré : aspirationnel, pas oublié
  app.saveCollectionItem(m, { title: 'Forêt' }, 'm2');
  d.modules.ecriture.scraps.push({ id: 'sorc', text: 'La sorcière du seuil', date: ancient }, { id: 'c', text: 'La forêt, hier encore', date: recent });
  app.saveCollectionItem(m, { title: 'Épuisé', status: 'Épuisé' }, 'm3');
  const pool2 = app.sortesPool();
  assert.ok(pool2.some(x => x.kind === 'motif' && x.e.title === 'Sorcière'), 'met long ago, silent since : fallow');
  assert.ok(!pool2.some(x => x.kind === 'motif' && x.e.title === 'Jamais'), 'never met is not the same as forgotten');
  assert.ok(!pool2.some(x => x.kind === 'motif' && x.e.title === 'Forêt'), 'recently met, not fallow');
  assert.ok(!pool2.some(x => x.kind === 'motif' && x.e.title === 'Épuisé'), 'retired motifs are never fallow');
  assert.ok(!pool2.some(x => x.mod === 'motifs' && x.kind !== 'motif'), 'the concordance module itself is not drawable content');

  // Le tirage : toujours un élément du bassin, jamais rien s'il est vide.
  const solo = launch(new Map(), { claude: { use: async () => null } });
  assert.equal(solo.sortesDraw(), null, 'freshly seeded account: nothing old enough yet');
  const draw = app.sortesDraw();
  assert.ok(draw && pool2.concat([{ kind: 'tension' }]).some(x => x.kind === draw.kind), 'drew something from a real pool');
});

test('lunar test: the Rayleigh statistic tells concentrated activity from spread activity, honestly', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S();
  assert.equal(app.lunarTest().enough, false, 'a fresh fixture has nowhere near 40 dated events yet');
  // Une date qui tombe (à un jour près, seule granularité disponible) à la phase visée, k cycles après la référence.
  const dateAt = (k, phase) => new Date(app.NEW_MOON_REF + (k + phase) * app.SYNODIC * 86400000).toISOString().slice(0, 10);
  let n = 0; const note = date => d.modules.inbox.entries.push({ id: 'l' + n++, text: 'x', date });
  // Concentrée autour de la pleine lune (phase 0.5).
  for (let k = 0; k < app.LUNAR_MIN_N + 10; k++) note(dateAt(k, 0.5));
  const conc = app.lunarTest();
  assert.equal(conc.enough, true);
  assert.equal(conc.n, app.LUNAR_MIN_N + 10);
  assert.ok(conc.R > 0.9, `strongly concentrated: R = ${conc.R}`);
  assert.ok(conc.p < 0.001, `far below the usual 0.05 threshold: p = ${conc.p}`);
  assert.ok(Math.abs(conc.meanPhase - 0.5) < 0.05, `mean phase near full moon: ${conc.meanPhase}`);
  app.location.hash = '#bilan'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /Concentration autour de pleine lune/);

  // Étalée sur les huit octants du cycle : rien à en tirer.
  d.modules.inbox.entries = [];
  n = 0;
  for (let k = 0; k < app.LUNAR_MIN_N + 20; k++) note(dateAt(k, (k % 8) / 8));
  const flat = app.lunarTest();
  assert.ok(flat.R < 0.2, `spread out: R = ${flat.R}`);
  assert.ok(flat.p > 0.05, `not significant: p = ${flat.p}`);
  app.render();
  assert.match(app.nodes.get('#main').innerHTML, /La lune plaide non coupable/);

  // Sous le seuil : le bilan le dit plutôt que d'inventer une tendance.
  d.modules.inbox.entries = d.modules.inbox.entries.slice(0, app.LUNAR_MIN_N - 1);
  app.render();
  assert.match(app.nodes.get('#main').innerHTML, /Pas assez de matière pour un test honnête/);

  // Un module concordance (motifs) ne participe pas au corpus, comme pour la dérive lexicale.
  const m = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'motifs'), 'Motifs', 'motifs');
  d.config.modules.push({ id: 'motifs', on: true });
  for (let k = 0; k < app.LUNAR_MIN_N + 10; k++) app.saveCollectionItem(m, { title: 'm' + k }, 'mm' + k);
  assert.equal(app.lunarTest().enough, false, 'collection items without dates, and a concordance module anyway, add nothing');
});

test('sortes : une source gardée et reliée à rien entre au bassin ; reliée, elle en sort', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const d = app.S(), days = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const src = 'sources', inst = app.createFromTemplate(d.modules, app.MODULE_TEMPLATES.find(x => x.id === 'sources'), 'Sources', src);
  if (!d.config.modules.some(m => m.id === src)) d.config.modules.push({ id: src, on: true });
  const s = inst.entries;
  s.push({ id: 's1', title: 'Depersonalization and the self', subtitle: '', tag: 'article', due: '', text: '', status: 'À lire', kept: days(60) },
    { id: 's2', title: 'Gardée avant-hier', subtitle: '', tag: '', due: '', text: '', status: 'À lire', kept: days(2) },
    { id: 's3', title: 'Venue de Dehors', subtitle: '', tag: '', due: '', text: '', status: 'Lue', origin: { from: 'Dehors', text: 'Revue', date: days(40) } },
    { id: 's4', title: 'Sans date connue', subtitle: '', tag: '', due: '', text: '', status: 'À lire' });
  const pool = app.sortesPool().filter(x => x.kind === 'source');
  assert.deepEqual([...pool.map(x => `${x.e.id}:${x.days}`)].sort(), ['s1:60', 's3:40', 's4:14'], 'deux jours ne sont pas un oubli ; sans date, au seuil');
  d.modules.ecriture.scraps.push({ id: 'f1', text: 'Le soi qui se regarde', date: days(30) });
  app.addLink(s[0], 'ecriture/f1', 'documente', 'l1', days(1));
  assert.ok(!app.sortesPool().some(x => x.kind === 'source' && x.e.id === 's1'), 'reliée : elle documente, elle n’est plus oubliée');
  const bad = JSON.parse(app.createBackup(app.board.data, app.S())); bad.site.modules[src].entries[0].kept = 'hier';
  assert.throws(() => app.parseBackup(JSON.stringify(bad)), /date/);
});



test('new templates contain no personal data or imposed budget and care presets', () => {
  const app = launch(new Map(), { bare: true });
  const modules = {};
  for (const tpl of app.MODULE_TEMPLATES) {
    const inst = app.createFromTemplate(modules, tpl, tpl.name, tpl.id);
    assert.equal(inst.entries.length, 0, tpl.id);
    assert.doesNotMatch(JSON.stringify(inst), /october\.moth|kundalini|phidippus|ulver/i);
  }
  assert.equal(modules.budget.config.envelopes.length, 0);
  assert.equal(modules.rappels.config.types.length, 0);
  app.render();
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /kundalini/i);
});

test('programme installation waits for a chosen practice and validates its settings', () => {
  const app = launch(new Map(), { bare: true });
  app.CLICK['tpl-add']({ dataset: { tpl: 'protocole' } });
  assert.deepEqual(Object.keys(app.S().modules), ['inbox'], 'opening or cancelling creates nothing');
  assert.match(app.nodes.get('#form').innerHTML, /Nom du sport ou de la pratique/);
  assert.throws(() => app.submitModuleForm({ name: 'Natation', weeks: '8', perWeek: '9', unitLabel: 'longueurs' }));
  assert.deepEqual(Object.keys(app.S().modules), ['inbox'], 'invalid input creates nothing');
  app.submitModuleForm({ name: 'Natation', weeks: '8', perWeek: '2', unitLabel: 'longueurs' });
  const inst = app.S().modules.natation;
  assert.equal(inst.label, 'Natation');
  assert.equal(inst.config.weeks, 8);
  assert.equal(inst.config.perWeek, 2);
  assert.equal(inst.config.unitLabel, 'longueurs');
  assert.equal(inst.config.start, null);
  assert.equal(inst.entries.length, 0);
  app.parseBackup(app.createBackup(app.board.data, app.site.data));
});

test('l’adresse d’un espace désactivé mène à l’accueil, et le dit une fois par visite ; une adresse inconnue, sans un mot', () => {
  const app = launch(new Map(), { claude: { use: async () => null } });
  const toast = app.nodes.get('#toast') || app.document.querySelector('#toast');
  app.location.hash = '#chantier'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /data-act="task-new"/, 'ouvert, l’espace s’affiche');
  app.S().config.modules.find(m => m.id === 'chantier').on = false;
  toast.textContent = ''; app.location.hash = '#accueil'; app.render(); app.location.hash = '#chantier'; app.render();
  assert.match(app.nodes.get('#main').innerHTML, /id="capIn"/, 'l’accueil (sa capture)…');
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /data-act="task-new"/, '… pas l’espace');
  assert.match(toast.textContent, /« Chantier » est désactivé : Réglages → Espaces pour le rouvrir\./);
  toast.textContent = ''; app.render();
  assert.equal(toast.textContent, '', 'un autre rendu (une synchronisation) ne le répète pas');
  app.location.hash = '#accueil'; app.render(); app.location.hash = '#chantier'; app.render();
  assert.match(toast.textContent, /est désactivé/, 'revenir à l’adresse le redit');
  toast.textContent = ''; app.location.hash = '#nulle-part'; app.render();
  assert.equal(toast.textContent, '', 'une adresse qui ne désigne aucun espace : rien à dire');
});

test('minuit : chaque vue suit la date d’elle-même, une minute après au plus ; jamais sous un formulaire ouvert ni pendant une saisie', () => {
  let now = new Date(2026, 9, 6, 23, 59, 30).getTime();
  const timers = [];
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
  const clock = { Date: FakeDate, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return { unref() {} }; } };
  const app = launch(new Map(), { claude: { use: async () => null }, clock });
  const tick = () => { for (const t of timers.splice(0).filter(t => t.ms === 60000)) t.fn(); };
  const day = () => app.nodes.get('#dateline').textContent;
  app.location.hash = '#chantier'; app.render(); // une autre vue que l'accueil
  assert.match(day(), /6 octobre/);
  tick(); assert.match(day(), /6 octobre/, 'avant minuit, rien ne change');
  now = new Date(2026, 9, 7, 0, 0, 30).getTime();
  // Un formulaire ouvert : la page attend, ses valeurs restent.
  app.nodes.get('#dlg').open = true; app.nodes.get('#main').innerHTML = 'FORMULAIRE_EN_COURS';
  tick(); assert.match(day(), /6 octobre/, 'sous un formulaire ouvert, pas de rendu'); assert.equal(app.nodes.get('#main').innerHTML, 'FORMULAIRE_EN_COURS');
  app.nodes.get('#dlg').open = false;
  // Une saisie en cours : de même.
  app.document.activeElement = { tagName: 'INPUT', type: 'text' };
  tick(); assert.match(day(), /6 octobre/, 'pendant une saisie, pas de rendu');
  app.document.activeElement = null;
  tick(); assert.match(day(), /mercredi 7 octobre/, 'la minute suivante, la vue suit le nouveau jour');
  assert.notEqual(app.nodes.get('#main').innerHTML, 'FORMULAIRE_EN_COURS');
  app.nodes.get('#main').innerHTML = 'RIEN_A_REDESSINER'; tick();
  assert.equal(app.nodes.get('#main').innerHTML, 'RIEN_A_REDESSINER', 'le jour une fois suivi, plus de rendu à chaque minute');
});
