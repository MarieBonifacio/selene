const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('selene.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function launch(storage, { bare = false } = {}) {
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
  const instrumented = script.replace(/\}\);\s*\}\)\(\);\s*$/, 'globalThis.__test = { ...__selene };\n});\n})();'); // dans platform.ready
  vm.runInNewContext(instrumented, context);
  return { ...context.__test, nodes };
}

test('built artifact boots, persists an assistant-created task, and survives reload', () => {
  // Sans session, la page hébergée montre l'écran d'entrée ; « Commencer sans compte » (U1) ouvre l'app elle-même.
  const storage = new Map([['selene-sans-compte', '1']]);
  const first = launch(storage);
  assert.match(first.nodes.get('#main').innerHTML, /Chantier/);
  first.TOOLS.find(x => x.name === 'ajouter_tache').execute({ titre: 'Tester le Velux' });
  assert.equal(JSON.parse(storage.get('selene-site-v1')).modules.chantier.entries[0].title, 'Tester le Velux');

  const second = launch(storage);
  assert.equal(second.site.data.modules.chantier.entries.length, 1);
  const backup = second.createBackup(second.board.data, second.site.data);
  assert.equal(second.parseBackup(backup).site.modules.chantier.entries[0].title, 'Tester le Velux');
  assert.throws(() => second.parseBackup('{"format":"selene-v1","board":{"tasks":null},"site":{"config":{}}}'));
  assert.equal(second.site.data.modules.chantier.entries.length, 1);
});

test('assistant actions respect module and global permissions at execution time', () => {
  const app = launch(new Map());
  const budget = app.site.data.modules.budget.entries;
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

test('résumé du matin : un par jour qui a quelque chose, à l’heure choisie, en texte brut, jamais dans le passé', () => {
  const storage = new Map();
  assert.equal(launch(storage).digestPlan().length, 0, 'désactivé par défaut');
  storage.set('selene-notify', JSON.stringify({ on: true, at: '07:45' }));
  const app = launch(storage);
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const plan = app.digestPlan(t.getTime());
  assert.ok(plan.length > 0, 'le jeu d’essai a des rappels dus');
  assert.ok(!plan.some(n => n.id === 100), 'aujourd’hui, 7 h 45 est passé');
  for (const n of plan) {
    const d = new Date(n.at);
    assert.ok(d.getTime() > t.getTime() && d.getHours() === 7 && d.getMinutes() === 45);
    assert.ok(n.id > 100 && n.id < 107);
    assert.doesNotMatch(n.title + n.body, /<|&amp;|&#39;/);
    assert.ok(n.body.length > 0);
  }
  const tomorrow = new Date(t); tomorrow.setDate(t.getDate() + 1);
  const iso = tomorrow.toISOString().slice(0, 10);
  app.site.data.modules.chantier.entries.push({ id: 'x', title: 'Poser le Velux', due: iso, done: false });
  const again = app.digestPlan(t.getTime()).find(n => n.id === 101);
  assert.match(again.body + again.title, /Poser le Velux|de plus/, 'une échéance du lendemain compte');
  assert.ok(app.dayDigest(iso).includes('Échéance : Poser le Velux'));
});

test('widget : la lune du jour, puis les tâches choisies et les rappels du jour, trois au plus, sans doublon', () => {
  const app = launch(new Map());
  const today = app.todayISO(), inst = app.site.data.modules.chantier;
  for (const [n, title] of ['Poser le Velux', 'Appeler le couvreur', 'Changer le joint', 'Vider la cave'].entries())
    inst.entries.push({ id: 'w' + n, title, today: n < 2, done: false, due: n === 0 ? today : null, room: '', cat: 'Bricolage', steps: [] });
  const w = app.widgetData();
  assert.match(w.moon, /^.+ · \d{1,3} %$/);
  assert.ok(w.lines.length <= 3);
  assert.deepEqual([...w.lines].slice(0, 2), ['Poser le Velux', 'Appeler le couvreur'], 'les tâches du jour d’abord');
  assert.ok(!w.lines.includes('Échéance : Poser le Velux'), 'une tâche du jour à échéance aujourd’hui ne compte qu’une fois');
});

test('une action qui échoue le dit : jamais un clic sans effet visible', async () => {
  const app = launch(new Map());
  const toast = () => app.nodes.get('#toast').textContent;
  const quiet = console.error; console.error = () => {};
  try {
    app.runAction({ boum() { throw new Error('portail muet'); } }, 'boum');
    assert.match(toast(), /n'a pas abouti : portail muet/);
    app.runAction({ plusTard: async () => { throw new Error('refusé plus tard'); } }, 'plusTard');
    await new Promise(r => setTimeout(r, 0));
    assert.match(toast(), /n'a pas abouti : refusé plus tard/);
  } finally { console.error = quiet; }
});
