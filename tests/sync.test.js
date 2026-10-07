const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fakeSupabase, launchHosted, settle, clone } = require('./hosted-harness');

// Les valeurs créées dans le bac à sable vm ont leur propre Array.prototype : on compare leur forme JSON.
const same = (actual, expected, msg) => assert.deepEqual(clone(actual), clone(expected), msg);

// Deux appareils du même compte, branchés sur le même serveur. A démarre d'abord (serveur vide).
async function twoDevices(opts = {}) {
  const server = fakeSupabase();
  const a = launchHosted({ fetch: server.fetch });
  await settle();
  const b = launchHosted({ fetch: server.fetch, bare: opts.bareB });
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
const titles = dev => dev.site.data.modules.chantier.entries.map(t => t.title).sort();

test('a fresh device adopts the server as is, without duplicating seeded items', async () => {
  const { server, a, b } = await twoDevices({ bareB: true }); // B : un vrai appareil neuf, données de départ réelles
  const remote = server.rows.get('u1').site;
  const ids = dev => dev.modules.musique.entries.map(x => x.id);
  assert.ok(ids(remote).length > 0, 'first device seeded the server');
  same(ids(b.site.data), ids(remote));
  same(ids(a.site.data), ids(remote));
});

test('concurrent additions on two devices are both kept', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  await edit(b, 'site', d => d.modules.chantier.entries.push(task('t2', 'Plinthes'))); // B n'a jamais vu t1 : l'ancien code l'écrasait
  await a.site.sync();
  same(titles(a), ['Plinthes', 'Velux']);
  same(titles(b), ['Plinthes', 'Velux']);
});

test('a deletion on one device and an edit on another both apply', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux'), task('t2', 'Plinthes')));
  await b.site.sync();
  await edit(a, 'site', d => { d.modules.chantier.entries = d.modules.chantier.entries.filter(t => t.id !== 't1'); });
  await edit(b, 'site', d => { d.modules.chantier.entries.find(t => t.id === 't2').note = 'acheter la colle'; });
  await a.site.sync();
  for (const dev of [a, b]) {
    same(dev.site.data.modules.chantier.entries.map(t => t.id), ['t2']);
    assert.equal(dev.site.data.modules.chantier.entries[0].note, 'acheter la colle');
  }
});

test('delete versus edit of the same entry keeps the edited entry (no silent loss)', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  await b.site.sync();
  await edit(a, 'site', d => { d.modules.chantier.entries = []; });
  await edit(b, 'site', d => { d.modules.chantier.entries[0].note = 'urgent'; });
  await a.site.sync();
  assert.equal(a.site.data.modules.chantier.entries[0].note, 'urgent');
});

test('a deleted module stays deleted on the other device', async () => {
  const { a, b } = await twoDevices();
  await edit(a, 'site', d => { a.S(); a.deleteModuleInstance(d.modules, d.config.modules, 'phidippus'); });
  await b.site.sync();
  const s = b.S();
  assert.equal(s.modules.phidippus, undefined);
  assert.equal(s.config.modules.some(m => m.id === 'phidippus'), false);
});

test('un espace supprimé sur un appareil reste supprimé, même modifié hors ligne sur un autre, qui le dit', async () => {
  const { server, a, b } = await twoDevices();
  const name = b.label('phidippus');
  server.offline = true; // B modifie l'espace hors ligne…
  b.site.data.modules.phidippus.label = 'Aragog modifié'; b.site.save(); clearTimeout(b.site.timer); b.site.timer = null;
  assert.equal(await b.site.sync(), false);
  server.offline = false; // … pendant que A le supprime, par les Réglages
  a.CLICK['mod-del']({ dataset: { mod: 'phidippus' } });
  assert.match(a.$('#form').innerHTML, /suppression définitive de ses données, sur tous tes appareils/, 'la confirmation dit la portée');
  a.form({ confirm: name }); clearTimeout(a.site.timer); a.site.timer = null;
  assert.equal(await a.site.sync(), true);
  b.$('#toast').textContent = '';
  assert.equal(await b.site.sync(), true); await a.site.sync();
  for (const dev of [a, b]) {
    assert.equal(dev.S().modules.phidippus, undefined, 'pas d’espace zombie');
    assert.equal(dev.S().config.modules.some(m => m.id === 'phidippus'), false, 'ni dans la navigation');
  }
  assert.ok(!server.rows.get('u1').site.modules.phidippus);
  assert.match(b.$('#toast').textContent, /« Aragog modifié » a été supprimé depuis un autre appareil ; tes modifications d'ici n'ont pas été gardées\./);
  assert.doesNotMatch(JSON.stringify(server.rows.get('u1').site.config.deleted), /phidippus|aragog/i, 'la pierre tombale ne garde pas le nom');
  // Un nouvel espace du même nom n'est pas enterré par l'ancienne pierre tombale.
  a.installModule({ type: 'notes' }, 'Phidippus'); await a.site.sync(); await b.site.sync();
  const fresh = a.S().config.modules[a.S().config.modules.length - 1].id;
  assert.notEqual(fresh, 'phidippus', 'un autre identifiant');
  assert.ok(a.S().modules[fresh] && b.S().modules[fresh], 'il vit sur les deux appareils');
});

test('les pierres tombales : sans compte, la confirmation ne parle pas d’autres appareils ; au-delà de 400 jours, elles s’effacent', () => {
  const { buryDeleted, deleteModuleInstance, tombKey, TOMBSTONE_TTL } = require('../src/core/domain.js');
  const doc = { modules: { a: { label: 'A' }, b: { label: 'B' } }, config: { modules: [{ id: 'a', on: true }, { id: 'b', on: true }], labels: { a: 'Mon A' }, groups: {}, assistant: { share: { a: true } }, deleted: {} } };
  deleteModuleInstance(doc.modules, doc.config.modules, 'a', doc.config.deleted, 1000);
  assert.deepEqual(Object.keys(doc.config.deleted), [tombKey('a')]); assert.match(tombKey('a'), /^t[0-9a-f]{16}$/);
  doc.modules.a = { label: 'A revenu' }; doc.config.modules.push({ id: 'a', on: true }); // une fusion qui l'aurait gardé
  same(buryDeleted(doc, 2000), [['a', 'Mon A']]);
  assert.ok(!doc.modules.a && !doc.config.labels.a && !doc.config.assistant.share.a && doc.modules.b);
  doc.modules.a = { label: 'A' };
  same(buryDeleted(doc, 1000 + TOMBSTONE_TTL), [], 'expirée : un appareil absent plus d’un an peut le ramener');
  same(doc.config.deleted, {});
  const local = launchHosted({ session: null, storage: new Map([['selene-sans-compte', '1']]), fetch: async () => { throw new Error('hors ligne'); } });
  local.CLICK['mod-del']({ dataset: { mod: 'phidippus' } });
  assert.doesNotMatch(local.$('#form').innerHTML, /tous tes appareils/, 'sans compte, un seul appareil');
});

test('a write that races another device is refused, re-read and merged (compare-and-swap)', async () => {
  const { server, a, b } = await twoDevices();
  a.site.data.modules.chantier.entries.push(task('t1', 'Velux')); a.site.save(); clearTimeout(a.site.timer); a.site.timer = null;
  // Juste entre la lecture et l'écriture de A, B écrit.
  server.beforePatch = () => edit(b, 'site', d => d.modules.chantier.entries.push(task('t2', 'Plinthes')));
  const before = server.calls.filter(c => c.startsWith('PATCH')).length;
  assert.equal(await a.site.sync(), true);
  assert.ok(server.calls.filter(c => c.startsWith('PATCH')).length - before >= 3, 'A: refused PATCH, then retried after re-reading');
  same(server.rows.get('u1').site.modules.chantier.entries.map(t => t.title).sort(), ['Plinthes', 'Velux']);
});

test('edits made offline are kept locally and pushed once back online', async () => {
  const { server, a, b } = await twoDevices();
  server.offline = true;
  a.site.data.modules.chantier.entries.push(task('t1', 'Velux')); a.site.save(); clearTimeout(a.site.timer); a.site.timer = null;
  assert.equal(await a.site.sync(), false);
  assert.match(a.nodes.get('#saving').textContent, /Non synchronisé/);
  assert.equal(JSON.parse(a.storage.get('selene-site-v1')).modules.chantier.entries[0].title, 'Velux', 'safe in localStorage');
  assert.equal(a.site.unsynced(), true, 'sign-out would warn before discarding it');
  server.offline = false;
  await a.poll(); // tour de polling de 30 s
  await b.poll();
  same(titles(b), ['Velux']);
  assert.equal(a.site.unsynced(), false);
});

test('polling brings remote changes without writing anything back', async () => {
  const { server, a, b } = await twoDevices();
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  const patches = server.calls.filter(c => c.startsWith('PATCH')).length;
  await b.poll();
  same(titles(b), ['Velux']);
  assert.equal(server.calls.filter(c => c.startsWith('PATCH')).length, patches, 'a read-only poll must not write');
});

test('an idle poll reads only the date of the last write, not the document', async () => {
  const { server, a, b } = await twoDevices();
  server.selects.length = 0;
  await b.poll(); await a.poll();
  assert.ok(server.selects.length === 4 && server.selects.every(s => /^u:(site|board)->>updatedAt$/.test(s)), `nothing changed: dates only (${server.selects.join(', ')})`);
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  server.selects.length = 0;
  await b.poll();
  same(titles(b), ['Velux']);
  assert.deepEqual([...server.selects].sort(), ['site', 'u:board->>updatedAt', 'u:site->>updatedAt'], 'the changed document only is read again');
});

/* A57 du cahier de recette : l'ADR 4 promet une relève au retour au premier plan. Onglet caché, la relève de 30 s ne fait
   rien ; revenu, une relève part aussitôt, la date d'abord, et sans changement rien d'autre n'est lu (l'économie de T8). */
test('A57 : back to the foreground, a poll runs at once (dates first), without waiting for the 30-second tick', async () => {
  const { server, a, b } = await twoDevices();
  b.document.hidden = true; b.document.visibilityState = 'hidden';
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  await b.poll();
  same(titles(b), [], 'hidden: the 30-second poll does nothing');
  server.selects.length = 0;
  b.document.hidden = false; b.document.visibilityState = 'visible'; b.fire('document:visibilitychange'); await settle();
  same(titles(b), ['Velux'], 'visible again: the change arrives at once');
  assert.ok(server.selects.includes('u:site->>updatedAt'), `the date first (${server.selects.join(', ')})`);
  server.selects.length = 0;
  b.fire('document:visibilitychange'); await settle();
  assert.ok(server.selects.length > 0 && server.selects.every(s => /->>updatedAt$/.test(s)), `nothing new: dates only (${server.selects.join(', ')})`);
});

/* A60 du cahier de recette : une relève partie pendant une synchronisation peut rendre, après elle, la version d'avant
   son écriture. Fusionnée telle quelle, elle effaçait ici ce que le serveur venait de recevoir (plus rien à envoyer, donc
   aucune écriture conditionnelle pour s'en apercevoir), jusqu'à la relève suivante. */
test('A60 : a poll answer older than the last sync is read again, not merged : what was just sent stays', async () => {
  const { server, a } = await twoDevices();
  const r0 = clone(server.rows.get('u1').site), avant = { exists: true, data: () => clone(r0) }; // la relève, partie avant l'écriture
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  assert.ok(JSON.stringify(server.rows.get('u1').site).includes('Velux'), 'sent');
  assert.equal(await a.site.sync(avant), true); // sa réponse arrive après
  same(titles(a), ['Velux'], 'still on the device');
  assert.equal(a.site.unsynced(), false, 'and its base is the server’s, not the older answer');
  assert.ok(JSON.stringify(server.rows.get('u1').site).includes('Velux'), 'the server keeps it');
});

test('a poll still pushes edits that could not be sent, even when the server has nothing new', async () => {
  const { server, a } = await twoDevices();
  server.offline = true;
  a.site.data.modules.chantier.entries.push(task('t2', 'Gouttière')); a.site.save();
  clearTimeout(a.site.timer); a.site.timer = null;
  assert.equal(await a.site.sync(), false);
  server.offline = false;
  await a.poll(); await settle(); // le polling lance la synchro sans l'attendre
  assert.equal(a.site.unsynced(), false);
  assert.ok(JSON.stringify(server.rows.get('u1').site).includes('Gouttière'), 'the pending edit reached the server');
});

test('a document the server refuses as too large stays local, and the status says why', async () => {
  const { server, a } = await twoDevices();
  server.maxBytes = 2000; // la contrainte de taille, à l'échelle du test
  a.site.data.modules.chantier.entries.push(task('t3', 'x'.repeat(5000))); a.site.save();
  clearTimeout(a.site.timer); a.site.timer = null;
  assert.equal(await a.site.sync(), false);
  assert.match(a.nodes.get('#saving').textContent, /Trop volumineux pour le serveur/);
  assert.equal(a.site.unsynced(), true, 'kept on the device, not lost');
});

test('closing the page: a small document leaves in one keepalive write; past 64 KiB none is tried, and the sync stays planned', async () => {
  const server = fakeSupabase(), keepalive = [];
  // Les écritures du document (app_state) ; la mesure d'usage, minuscule, part aussi en keepalive (services/activite.js).
  const fetch = (url, opts = {}) => { if (opts.keepalive && String(url).includes('/rest/v1/app_state')) keepalive.push(Buffer.byteLength(opts.body)); return server.fetch(url, opts); };
  const a = launchHosted({ fetch }); await settle();
  a.site.data.modules.chantier.entries.push(task('t1', 'Velux')); a.site.save();
  a.site.flush(); await settle();
  assert.equal(keepalive.length, 1, 'one keepalive write');
  assert.ok(server.rows.get('u1').site.modules.chantier.entries.some(t => t.title === 'Velux'), 'and it reached the server');
  // Un document plus lourd que ce que les navigateurs acceptent en keepalive (T13 de l'audit).
  a.site.data.modules.chantier.entries.push(task('t2', 'x'.repeat(70000))); a.site.save();
  a.site.flush();
  assert.equal(keepalive.length, 1, 'past 64 KiB: no keepalive write, which the browser would refuse anyway');
  assert.ok(a.site.timer, 'the regular sync is still planned, in case the page lives on');
  clearTimeout(a.site.timer); a.site.timer = null;
  assert.equal(await a.site.sync(), true);
  assert.ok(server.rows.get('u1').site.modules.chantier.entries.some(t => t.id === 't2'), 'and it is sent by the regular sync');
});

test('signing out pushes pending edits first, then stops every poller', async () => {
  const { server, a } = await twoDevices();
  a.site.data.modules.chantier.entries.push(task('t1', 'Velux')); a.site.save(); // reste dans le délai de 900 ms
  await a.authSignOut();
  same(server.rows.get('u1').site.modules.chantier.entries.map(t => t.title), ['Velux']);
  assert.equal(a.intervals.size, 0, 'no poller or refresh timer left running');
  assert.equal(a.storage.get('selene-site-v1-base'), undefined, 'the base belongs to the old account');
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
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  await edit(b, 'site', d => d.modules.chantier.entries.push(task('t2', 'Plinthes'))); // A ne l'a pas encore vu
  const saved = clone(a.site.data); saved.modules.chantier.entries = [task('t3', 'Restauré')];
  a.site.replaceAll(saved);
  clearTimeout(a.site.timer); a.site.timer = null;
  assert.equal(await a.site.sync(), true);
  same(server.rows.get('u1').site.modules.chantier.entries.map(t => t.title), ['Restauré']);
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t4', 'Après')));
  same(server.rows.get('u1').site.modules.chantier.entries.map(t => t.title), ['Restauré', 'Après'], 'back to normal merging afterwards');
});

test('an outdated app never merges into data written by a newer schema', async () => {
  const { server, a } = await twoDevices();
  server.rows.get('u1').site.schemaVersion = 99; // un appareil déjà mis à jour vers un futur format
  const patches = server.calls.filter(c => c.startsWith('PATCH')).length;
  a.site.data.modules.inbox.entries.push({ id: 'i1', text: 'x', date: '2026-09-27' }); a.site.save(); clearTimeout(a.site.timer); a.site.timer = null;
  assert.equal(await a.site.sync(), false);
  assert.equal(server.calls.filter(c => c.startsWith('PATCH')).length, patches, 'nothing written');
  assert.match(a.nodes.get('#saving').textContent, /recharge la page/);
  assert.equal(JSON.parse(a.storage.get('selene-site-v1')).modules.inbox.entries.length, 1, 'local edit kept for later');
});

test('signing out removes the chat history and the API key from the device', async () => {
  const { a } = await twoDevices();
  a.storage.set('selene-chat', '[{"role":"user","content":"secret"}]');
  a.storage.set('selene-api-key', 'sk-ant-xxx');
  a.storage.set('selene-draft:inbox:noteIn', 'un brouillon');
  await a.authSignOut();
  assert.equal(a.storage.get('selene-draft:inbox:noteIn'), undefined, 'drafts are personal too');
  assert.equal(a.storage.get('selene-chat'), undefined);
  assert.equal(a.storage.get('selene-api-key'), undefined);
});

// Format 6 : l'ancien document « board » n'est plus qu'un point d'entrée vers le module Chantier.
test('tasks still written to the old board document (outdated app) land in the Chantier module', async () => {
  const { server, a, b } = await twoDevices();
  await edit(a, 'site', d => d.modules.chantier.entries.push(task('t1', 'Velux')));
  // Une ancienne version, restée ouverte ailleurs, écrit une tâche dans « board ».
  server.rows.get('u1').board = { updatedAt: Date.now() + 5, tasks: [task('t9', 'Écrite par une vieille version')] };
  await b.poll(); // B relit « board » et le verse dans son site
  same(titles(b), ['Velux', 'Écrite par une vieille version']);
  await b.poll(); await a.poll();
  same(titles(a), ['Velux', 'Écrite par une vieille version'], 'and it reaches the other device through the site');
  same(server.rows.get('u1').board.tasks, [], 'the board copy is emptied on the server, so it cannot resurrect anything later');
});

test('a task deleted after the migration is not resurrected by a new device', async () => {
  const { server, a } = await twoDevices();
  server.rows.get('u1').board = { updatedAt: Date.now() + 5, tasks: [task('t1', 'Velux')] };
  await a.poll(); await a.poll();
  same(titles(a), ['Velux']);
  await edit(a, 'site', d => { d.modules.chantier.entries = []; });
  const c = launchHosted({ fetch: server.fetch }); // un appareil neuf
  await settle();
  same(titles(c), [], 'the emptied board has nothing left to pour in');
});

test('pre-format-6 device: its local board tasks move into the Chantier module at load', () => {
  const storage = new Map([['selene-board-v1', JSON.stringify({ updatedAt: 5, tasks: [task('t1', 'Velux')] })]]);
  const d = launchHosted({ storage, session: null, fetch: async () => { throw new Error('offline'); } });
  same(d.site.data.modules.chantier.entries.map(t => t.id), ['t1']);
  same(d.board.data.tasks, []);
  // Écrit aussitôt : sans synchro, le chargement suivant ne doit pas reverser (ni ressusciter) la tâche.
  same(JSON.parse(storage.get('selene-board-v1')).tasks, []);
  same(JSON.parse(storage.get('selene-site-v1')).modules.chantier.entries.map(t => t.id), ['t1']);
});

test('a new device meeting pre-format-6 data on the server: tasks absorbed, nothing duplicated', async () => {
  const { server, a } = await twoDevices();
  // Le serveur tel qu'il est avant la mise à jour : site au format 5 sans module Chantier, tâches dans « board ».
  const row = server.rows.get('u1');
  delete row.site.modules.chantier; delete row.site.boardMerged; row.site.schemaVersion = 5;
  row.site.config.modules = row.site.config.modules.filter(m => m.id !== 'chantier').concat({ id: 'chantier', on: true });
  row.board = { updatedAt: Date.now(), tasks: [task('t1', 'Velux'), task('t2', 'Plinthes')] };
  const albums = row.site.modules.musique.entries.map(x => x.id);
  const c = launchHosted({ fetch: server.fetch }); // appareil neuf, données de départ vierges
  await settle(60);
  same(titles(c), ['Plinthes', 'Velux']);
  same(c.site.data.modules.musique.entries.map(x => x.id), albums, 'seed albums not duplicated');
  await c.poll(); await a.poll();
  same(titles(a), ['Plinthes', 'Velux'], 'the first device gets them through the site');
  same(server.rows.get('u1').board.tasks, []);
});
