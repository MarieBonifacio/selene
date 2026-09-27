const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fakeSupabase, launchHosted, settle, clone } = require('./hosted-harness');

// Les valeurs créées dans le bac à sable vm ont leur propre Array.prototype : on compare leur forme JSON.
const same = (actual, expected, msg) => assert.deepEqual(clone(actual), clone(expected), msg);

// Deux appareils du même compte, branchés sur le même serveur. A démarre d'abord (serveur vide).
async function twoDevices() {
  const server = fakeSupabase();
  const a = launchHosted({ fetch: server.fetch });
  await settle();
  const b = launchHosted({ fetch: server.fetch });
  await settle();
  return { server, a, b };
}
// Modifie puis synchronise tout de suite, sans attendre le délai de 900 ms.
async function edit(dev, store, fn) {
  fn(dev[store].data);
  dev[store].save();
  clearTimeout(dev[store].timer); dev[store].timer = null;
  assert.equal(await dev[store].sync(), true);
}
const task = (id, title) => ({ id, title, room: '', cat: 'Bricolage', due: null, effort: 1, cost: null, note: '', today: false, done: false, doneAt: null, created: '2026-09-27', steps: [] });
const titles = dev => dev.board.data.tasks.map(t => t.title).sort();

test('a fresh device adopts the server as is, without duplicating seeded items', async () => {
  const { server, a, b } = await twoDevices();
  const remote = server.rows.get('u1').site;
  assert.ok(remote.musique.albums.length > 0, 'first device seeded the server');
  same(b.site.data.musique.albums.map(x => x.id), remote.musique.albums.map(x => x.id));
  same(a.site.data.musique.albums.map(x => x.id), remote.musique.albums.map(x => x.id));
});

test('concurrent additions on two devices are both kept', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'board', d => d.tasks.push(task('t1', 'Velux')));
  await edit(b, 'board', d => d.tasks.push(task('t2', 'Plinthes'))); // B n'a jamais vu t1 : l'ancien code l'écrasait
  await a.board.sync();
  same(titles(a), ['Plinthes', 'Velux']);
  same(titles(b), ['Plinthes', 'Velux']);
});

test('a deletion on one device and an edit on another both apply', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'board', d => d.tasks.push(task('t1', 'Velux'), task('t2', 'Plinthes')));
  await b.board.sync();
  await edit(a, 'board', d => { d.tasks = d.tasks.filter(t => t.id !== 't1'); });
  await edit(b, 'board', d => { d.tasks.find(t => t.id === 't2').note = 'acheter la colle'; });
  await a.board.sync();
  for (const dev of [a, b]) {
    same(dev.board.data.tasks.map(t => t.id), ['t2']);
    assert.equal(dev.board.data.tasks[0].note, 'acheter la colle');
  }
});

test('delete versus edit of the same entry keeps the edited entry (no silent loss)', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'board', d => d.tasks.push(task('t1', 'Velux')));
  await b.board.sync();
  await edit(a, 'board', d => { d.tasks = []; });
  await edit(b, 'board', d => { d.tasks[0].note = 'urgent'; });
  await a.board.sync();
  assert.equal(a.board.data.tasks[0].note, 'urgent');
});

test('a deleted module stays deleted on the other device', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'site', d => { a.S(); a.deleteModuleInstance(d.modules, d.config.modules, 'phidippus'); });
  await b.site.sync();
  const s = b.S();
  assert.equal(s.modules.phidippus, undefined);
  assert.equal(s.config.modules.some(m => m.id === 'phidippus'), false);
});

test('a write that races another device is refused, re-read and merged (compare-and-swap)', async () => {
  const { server, a, b } = await twoDevices();
  a.board.data.tasks.push(task('t1', 'Velux')); a.board.save(); clearTimeout(a.board.timer); a.board.timer = null;
  // Juste entre la lecture et l'écriture de A, B écrit.
  server.beforePatch = () => edit(b, 'board', d => d.tasks.push(task('t2', 'Plinthes')));
  const before = server.calls.filter(c => c.startsWith('PATCH')).length;
  assert.equal(await a.board.sync(), true);
  assert.ok(server.calls.filter(c => c.startsWith('PATCH')).length - before >= 3, 'A: refused PATCH, then retried after re-reading');
  same(server.rows.get('u1').board.tasks.map(t => t.title).sort(), ['Plinthes', 'Velux']);
});

test('edits made offline are kept locally and pushed once back online', async () => {
  const { server, a, b } = await twoDevices();
  server.offline = true;
  a.board.data.tasks.push(task('t1', 'Velux')); a.board.save(); clearTimeout(a.board.timer); a.board.timer = null;
  assert.equal(await a.board.sync(), false);
  assert.match(a.nodes.get('#saving').textContent, /Non synchronisé/);
  assert.equal(JSON.parse(a.storage.get('selene-board-v1')).tasks[0].title, 'Velux', 'safe in localStorage');
  assert.equal(a.board.unsynced(), true, 'sign-out would warn before discarding it');
  server.offline = false;
  await a.poll(); // tour de polling de 30 s
  await b.poll();
  same(titles(b), ['Velux']);
  assert.equal(a.board.unsynced(), false);
});

test('polling brings remote changes without writing anything back', async () => {
  const { server, a, b } = await twoDevices();
  await edit(a, 'board', d => d.tasks.push(task('t1', 'Velux')));
  const patches = server.calls.filter(c => c.startsWith('PATCH')).length;
  await b.poll();
  same(titles(b), ['Velux']);
  assert.equal(server.calls.filter(c => c.startsWith('PATCH')).length, patches, 'a read-only poll must not write');
});

test('signing out pushes pending edits first, then stops every poller', async () => {
  const { server, a } = await twoDevices();
  a.board.data.tasks.push(task('t1', 'Velux')); a.board.save(); // reste dans le délai de 900 ms
  await a.authSignOut();
  same(server.rows.get('u1').board.tasks.map(t => t.title), ['Velux']);
  assert.equal(a.intervals.size, 0, 'no poller or refresh timer left running');
  assert.equal(a.storage.get('selene-board-v1-base'), undefined, 'the base belongs to the old account');
});

test('without a base, a device with real local data merges instead of being overwritten', async () => {
  const { a } = await twoDevices();
  const remote = { updatedAt: 5, tasks: [task('t1', 'Velux')] };
  const local = { updatedAt: 9, tasks: [task('t2', 'Plinthes')] };
  same(a.mergeDocs(null, local, remote).tasks.map(t => t.id).sort(), ['t1', 't2']);
  same(a.mergeDocs(null, { updatedAt: 0, tasks: [] }, remote), remote, 'pristine device adopts the server');
});

test('importing a backup replaces the account state instead of merging into it', async () => {
  const { server, a, b } = await twoDevices();
  await edit(a, 'board', d => d.tasks.push(task('t1', 'Velux')));
  await edit(b, 'board', d => d.tasks.push(task('t2', 'Plinthes'))); // A ne l'a pas encore vu
  a.board.replaceAll({ updatedAt: 1, tasks: [task('t3', 'Restauré')] });
  clearTimeout(a.board.timer); a.board.timer = null;
  assert.equal(await a.board.sync(), true);
  same(server.rows.get('u1').board.tasks.map(t => t.title), ['Restauré']);
  await edit(a, 'board', d => d.tasks.push(task('t4', 'Après')));
  same(server.rows.get('u1').board.tasks.map(t => t.title), ['Restauré', 'Après'], 'back to normal merging afterwards');
});
