const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/backup.js', 'utf8');
const api = vm.runInNewContext(source + '\n({ parseBackup, createBackup })');
const valid = () => ({ format: 'selene-v1', board: { updatedAt: 1, tasks: [
  { id: 'a', title: 'Velux', steps: [{ t: 'Devis', d: false }] }
] }, site: { updatedAt: 1, config: { modules: [{ id: 'chantier', on: true }] },
  budget: { entries: [], envelopes: [] }, inbox: { items: [] } } });

test('export v1 round trips without changing data', () => {
  const input = valid();
  const parsed = api.parseBackup(api.createBackup(input.board, input.site, '2026-09-24T00:00:00Z'));
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), { board: input.board, site: input.site });
});

test('malformed nested collections are rejected before import', () => {
  for (const mutate of [
    d => { d.board.tasks[0].steps = 'invalid'; },
    d => { d.site.budget.entries = {}; },
    d => { d.site.config.modules = [null]; },
    d => { d.site.inbox.items = ['text']; },
    d => { d.site.updatedAt = 'later'; },
    d => { d.format = 'selene-v2'; }
  ]) {
    const d = valid(); mutate(d);
    assert.throws(() => api.parseBackup(JSON.stringify(d)));
  }
});

test('older v1 backups with missing optional sections can be restored', () => {
  const d = valid();
  delete d.site.budget;
  delete d.site.config.modules;
  assert.equal(api.parseBackup(JSON.stringify(d)).board.tasks[0].title, 'Velux');
});

test('oversized backup is rejected', () => {
  assert.throws(() => api.parseBackup(' '.repeat(5_000_001)));
});
