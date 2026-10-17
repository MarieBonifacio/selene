const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addTask, setTaskDone, setTaskToday, addCapture, addBudgetEntry } = require('../src/core/domain.js');
const date = '2026-09-24';

test('task rules are shared by the UI and assistant', () => {
  const tasks = [];
  assert.throws(() => addTask(tasks, { title: '   ' }, 'bad', date));
  for (let n = 0; n < 4; n++) addTask(tasks, { title: `  Tâche ${n} ` }, String(n), date);
  assert.equal(tasks[0].title, 'Tâche 0');
  for (let n = 0; n < 3; n++) setTaskToday(tasks, String(n), true);
  assert.throws(() => setTaskToday(tasks, '3', true), /Trois/);
  const done = setTaskDone(tasks, '0', true, date);
  assert.equal(done.doneAt, date);
  assert.equal(done.today, false);
  setTaskToday(tasks, '3', true);
  setTaskDone(tasks, '0', false, date);
  assert.equal(done.doneAt, null);
  assert.throws(() => setTaskDone(tasks, 'unknown', true, date), /introuvable/);
});

test('budget and capture reject invalid input without changing collections', () => {
  const entries = [], items = [];
  for (const amount of [0, -1, Infinity, 'hello']) {
    assert.throws(() => addBudgetEntry(entries, { amount }, 'x', date));
  }
  assert.throws(() => addBudgetEntry(entries, { amount: 20, date: '2026-02-30' }, 'x', date), /Date/);
  assert.equal(entries.length, 0);
  assert.throws(() => addCapture(items, ' ', 'x', date));
  assert.equal(items.length, 0);
  assert.equal(addBudgetEntry(entries, { amount: 12.5, type: 'dépense' }, 'e', date).amount, 12.5);
  assert.equal(addCapture(items, '  Devis  ', 'c', date).text, 'Devis');
});

test('attendre une réponse : depuis quand, de qui, quand relancer ; relancer reporte et se consigne ; la réponse lève l’attente (TU-DOM-03)', () => {
  const { setTaskWaiting, relaunchTask, clearTaskWaiting } = require('../src/core/domain.js');
  const tasks = [];
  addTask(tasks, { title: 'Dossier CAF', steps: [{ t: 'RIB', d: true }] }, 't1', '2026-10-01');
  setTaskToday(tasks, 't1', true);
  const t = setTaskWaiting(tasks, 't1', { who: '  Caisse d’allocations familiales  ', next: '2026-10-15' }, '2026-10-01');
  assert.deepEqual({ ...t.wait, log: [...t.wait.log] }, { since: '2026-10-01', who: 'Caisse d’allocations familiales', next: '2026-10-15', log: [] });
  assert.equal(t.today, false, 'une attente n’est pas une tâche du jour');
  assert.equal(setTaskWaiting(tasks, 't1', { who: 'x'.repeat(200), next: 'demain' }, '2026-10-02').wait.who.length, 80, 'qui : 80 caractères au plus');
  assert.equal(t.wait.next, null, 'une date de relance invalide est laissée vide');
  assert.equal(t.wait.since, '2026-10-01', 'redire l’attente ne change pas depuis quand');
  relaunchTask(tasks, 't1', '2026-10-15');
  assert.equal(t.wait.next, '2026-10-29', 'relancé : la prochaine relance dans quatorze jours');
  assert.deepEqual([...t.wait.log.map(x => `${x.date} ${x.kind}`)], ['2026-10-15 relance']);
  clearTaskWaiting(tasks, 't1');
  assert.equal(t.wait, undefined, 'réponse reçue : plus d’attente, la tâche reprend son cours');
  assert.equal(t.done, false);
  setTaskWaiting(tasks, 't1', { who: 'CAF' }, '2026-10-16');
  setTaskDone(tasks, 't1', true, '2026-10-20');
  assert.equal(t.wait, undefined, 'faite : l’attente tombe avec elle');
  assert.throws(() => setTaskWaiting(tasks, 't1', {}, '2026-10-21'), /faite/, 'une tâche faite n’attend plus rien');
  assert.throws(() => relaunchTask(tasks, 't1', '2026-10-21'), /attente/);
  // Une attente mal formée (sauvegarde trafiquée, synchro abîmée) est refusée à l'import, comme le reste d'une tâche.
  const { MODULE_TYPES } = require('../src/core/domain.js');
  const refused = w => { const out = []; MODULE_TYPES.taches.validate({ config: {}, entries: [{ title: 'x', wait: w }] }, { fail: m => out.push(m), num: () => {} }); return out.includes('attente'); };
  assert.equal(refused({ since: '2026-10-01', who: 'CAF', next: null, log: [{ date: '2026-10-02', kind: 'relance' }] }), false, 'une attente bien formée passe');
  for (const w of [[], 'oui', { since: 'hier' }, { since: '2026-10-01', next: '2026-13-01' }, { since: '2026-10-01', who: 'x'.repeat(81) }, { since: '2026-10-01', log: [{ date: 'x', kind: 'relance' }] }]) assert.ok(refused(w), `refusée : ${JSON.stringify(w)}`);
});
