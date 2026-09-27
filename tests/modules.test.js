const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('selene.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function launch(storage, { claude = null } = {}) {
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
    setItem(key, value) { storage.set(key, value); }
  };
  const window = { addEventListener() {}, claude };
  const location = { hash: '' };
  const context = { document, window, localStorage, location,
    navigator: {}, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval };
  const instrumented = script.replace(/\}\)\(\);\s*$/, 'globalThis.__test = { S, site, board, createModuleInstance, deleteModuleInstance, addJournalEntry, slugId, label, createBackup, parseBackup, render, MODULE_TYPES, TYPE_UI, CLICK, CHANGE, summaryFor, contextText };\n})();');
  vm.runInNewContext(instrumented, context);
  return { ...context.__test, nodes, location };
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
  assert.equal(d.schemaVersion, 2);
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
  for (const type of Object.keys(app.MODULE_TYPES)) {
    const id = app.slugId(`Essai ${type}`, Object.keys(d.modules));
    const inst = app.createModuleInstance(d.modules, type, `Essai ${type}`, id);
    d.config.modules.push({ id, on: true });
    app.addJournalEntry(inst, { date: '2026-09-27', value: 3, type: 'fait', note: 'ok' }, `e-${type}`, '2026-09-27');
    const ui = app.TYPE_UI[type];
    assert.match(ui.view(id), /<h2/, `${type} view`);
    assert.equal(typeof ui.settings(id, inst), 'string');
    assert.equal(typeof app.summaryFor(id), 'string');
    assert.match(ui.context(inst, 'NOM'), /NOM/);
  }
  assert.doesNotMatch(app.contextText(), /ESSAI/, 'modules not shared with the assistant stay private');
  for (const k of Object.keys(d.modules)) if (k.startsWith('essai-')) d.config.assistant.share[k] = true;
  for (const t of ['PROGRAMME', 'CUMUL', 'RAPPELS']) assert.match(app.contextText(), new RegExp(`ESSAI ${t}`));
  // Tout ce que le registre crée doit passer sa propre validation d'import.
  const parsed = app.parseBackup(app.createBackup(app.board.data, app.site.data));
  assert.equal(Object.keys(parsed.site.modules).filter(k => k.startsWith('essai-')).length, 3);
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
