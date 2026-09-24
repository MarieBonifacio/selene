const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('selene.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function launch(storage) {
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
    addEventListener(name, fn) { handlers[name] = fn; }
  };
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); }
  };
  const window = { addEventListener() {}, claude: null };
  const context = { document, window, localStorage, location: { hash: '' },
    navigator: {}, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval };
  // Inspect the closure without changing production code.
  const instrumented = script.replace(/\}\)\(\);\s*$/, 'globalThis.__test = { board, site, TOOLS, availableTools, executeTool, parseBackup, createBackup };\n})();');
  vm.runInNewContext(instrumented, context);
  return { ...context.__test, nodes };
}

test('built artifact boots, persists an assistant-created task, and survives reload', () => {
  const storage = new Map();
  const first = launch(storage);
  assert.match(first.nodes.get('#main').innerHTML, /Selene|lune|Chantier/i);
  first.TOOLS.find(x => x.name === 'ajouter_tache').execute({ titre: 'Tester le Velux' });
  assert.equal(JSON.parse(storage.get('selene-board-v1')).tasks[0].title, 'Tester le Velux');

  const second = launch(storage);
  assert.equal(second.board.data.tasks.length, 1);
  const backup = second.createBackup(second.board.data, second.site.data);
  assert.equal(second.parseBackup(backup).board.tasks[0].title, 'Tester le Velux');
  assert.throws(() => second.parseBackup('{"format":"selene-v1","board":{"tasks":null},"site":{"config":{}}}'));
  assert.equal(second.board.data.tasks.length, 1);
});

test('assistant actions respect module and global permissions at execution time', () => {
  const app = launch(new Map());
  const budget = app.site.data.budget.entries;
  const module = app.site.data.config.modules.find(x => x.id === 'budget');
  module.on = false;
  assert.equal(app.availableTools().some(x => x.name === 'ajouter_operation'), false);
  assert.throws(() => app.executeTool('ajouter_operation', { montant: 20 }), /non autorisée/);
  assert.equal(budget.length, 0);
  module.on = true;
  app.site.data.config.assistant.actions = false;
  assert.throws(() => app.executeTool('ajouter_operation', { montant: 20 }), /non autorisée/);
  assert.equal(budget.length, 0);
  app.site.data.config.assistant.actions = true;
  app.executeTool('ajouter_operation', { montant: 20 });
  assert.equal(budget.length, 1);
});
