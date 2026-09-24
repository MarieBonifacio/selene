const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/domain.js', 'utf8');
const { addTask, setTaskDone, setTaskToday, addCapture, addBudgetEntry } =
  vm.runInNewContext(source + '\n({ addTask, setTaskDone, setTaskToday, addCapture, addBudgetEntry })');
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
