/* L'artefact claude.ai et son espace `db` (PLT-011 du cahier de recette ; services/artifact-db.js, ADR 33). Les
   documents d'un artefact sont partagés par défaut avec tous ceux à qui l'on en donne le lien : Selene range les siens
   dans le sous-arbre privé de la personne qui l'ouvre. Faux claude.ai en mémoire, qui applique la règle de la
   plateforme : ce qui est sous data/users/<id>/ n'existe que pour <id>, propriétaire comprise. Données synthétiques. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('selene.html', 'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];

/* Le magasin d'un artefact (un seul), et ce qu'en voit chaque personne qui l'ouvre. */
function fakeStore(docs = new Map()) {
  const writes = [];
  const viewer = ({ uid, owner = false, canWrite = true, user = true }) => {
    const visible = p => !p.startsWith('data/users/') || p.startsWith(`data/users/${uid}/`);
    const doc = path => ({
      path,
      get: async () => { const v = visible(path) ? docs.get(path) : undefined; return { exists: v !== undefined, data: () => v && JSON.parse(v) }; },
      set: async v => {
        if (!canWrite || !visible(path)) throw Object.assign(new Error('refusé'), { code: 'invalid_argument' });
        writes.push([uid, 'set', path]); docs.set(path, JSON.stringify(v));
      },
      delete: async () => { if (!canWrite) throw Object.assign(new Error('refusé'), { code: 'invalid_argument' }); writes.push([uid, 'delete', path]); docs.delete(path); },
      onSnapshot: () => () => {}
    });
    return { use: async name => name === 'db' ? { doc } : name === 'user' && user ? { id: async () => uid, isOwner: async () => owner } : null };
  };
  return { docs, writes, viewer, read: p => docs.has(p) ? JSON.parse(docs.get(p)) : null };
}

/* Selene, ouverte dans un navigateur (son stockage) par une personne (son claude.ai). */
async function open(storage, claude) {
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, { id, dataset: {}, value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {} }, addEventListener() {}, querySelectorAll() { return []; }, focus() {}, showModal() {} });
    return nodes.get(id);
  };
  const document = { title: '', activeElement: null, documentElement: { dataset: {} }, querySelector: element, getElementById: element, addEventListener() {} };
  const localStorage = {
    getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k),
    key: i => [...storage.keys()][i] ?? null, get length() { return storage.size; }
  };
  const context = { document, window: { addEventListener() {}, claude }, localStorage, location: { hash: '' }, navigator: {}, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval };
  vm.runInNewContext(script.replace(/\}\);\s*\}\)\(\);\s*$/, 'globalThis.__test = { ...__selene };\n});\n})();'), context);
  for (let i = 0; i < 40; i++) await new Promise(r => setImmediate(r));
  return { ...context.__test, el: element };
}
const keep = async (app, text) => { app.el('#capIn').value = text; app.CLICK['cap-add'](); await app.site.sync(); };
const notes = app => JSON.stringify(app.S().modules.inbox.entries);
/* Ce qu'écrivait une version d'avant : le carnet de la propriétaire dans le document partagé, et la base commune avec
   lui dans les navigateurs qui l'ont synchronisé. */
function legacy() {
  const site = JSON.parse(fs.readFileSync('tests/fixtures/site-demo.json', 'utf8'));
  site.updatedAt = 1000; site.config.name = 'Selene de la propriétaire';
  site.modules.inbox.entries = [{ id: 'n1', text: 'NOTE_PARTAGEE', date: '2026-10-01', created: 1000 }];
  return site;
}
const synced = site => new Map([['selene-site-v1', JSON.stringify(site)], ['selene-site-v1-base', JSON.stringify(site)]]);

test('la propriétaire : son carnet passe dans son espace privé, l’ancien document partagé est effacé', async () => {
  const store = fakeStore(new Map([['site/state', JSON.stringify(legacy())], ['board/state', JSON.stringify({ updatedAt: 1000, tasks: [] })]]));
  const app = await open(synced(legacy()), store.viewer({ uid: 'u-proprio', owner: true }));
  assert.match(notes(app), /NOTE_PARTAGEE/, 'rien de perdu');
  assert.match(JSON.stringify(store.read('data/users/u-proprio/site')), /NOTE_PARTAGEE/, 'dans le sous-arbre privé');
  assert.ok(store.read('data/users/u-proprio/board'), 'le board aussi');
  assert.ok(!store.docs.has('site/state') && !store.docs.has('board/state'), 'plus rien de partagé');
  await keep(app, 'NOTE_PRIVEE');
  assert.deepEqual(store.writes.filter(([, op, p]) => op === 'set' && !p.startsWith('data/users/u-proprio/')), [], 'aucune écriture hors de son sous-arbre');
  assert.match(JSON.stringify(store.read('data/users/u-proprio/site')), /NOTE_PRIVEE/);
});

test('la propriétaire dans un autre navigateur, vierge : elle retrouve son carnet, déjà rapatrié', async () => {
  const store = fakeStore(new Map([['site/state', JSON.stringify(legacy())]]));
  await open(synced(legacy()), store.viewer({ uid: 'u-proprio', owner: true }));
  const second = await open(new Map(), store.viewer({ uid: 'u-proprio', owner: true }));
  assert.match(notes(second), /NOTE_PARTAGEE/);
  assert.equal(second.S().config.name, 'Selene de la propriétaire');
});

test('quelqu’un à qui l’on a donné le lien : un Selene à soi, vide ; il ne lit ni ne garde le carnet de la propriétaire', async () => {
  const store = fakeStore(new Map([['site/state', JSON.stringify(legacy())]]));
  const owner = await open(new Map(), store.viewer({ uid: 'u-proprio', owner: true }));
  await keep(owner, 'NOTE_PROPRIO');
  // Un navigateur qui avait synchronisé l'ancien document partagé : il en gardait une copie.
  const guest = await open(synced(legacy()), store.viewer({ uid: 'u-invite' }));
  assert.doesNotMatch(notes(guest), /NOTE_PARTAGEE|NOTE_PROPRIO/, 'la copie du carnet partagé est oubliée');
  assert.notEqual(guest.S().config.name, 'Selene de la propriétaire');
  await keep(guest, 'NOTE_INVITE');
  assert.match(JSON.stringify(store.read('data/users/u-invite/site')), /NOTE_INVITE/, 'son propre carnet, dans son sous-arbre');
  assert.doesNotMatch(JSON.stringify(store.read('data/users/u-invite/site')), /NOTE_PARTAGEE|NOTE_PROPRIO/);
  assert.doesNotMatch(JSON.stringify(store.read('data/users/u-proprio/site')), /NOTE_INVITE/, 'et rien chez la propriétaire');
  assert.ok(!store.writes.some(([uid, op]) => uid === 'u-invite' && op === 'delete'), 'il n’efface rien de partagé');
  const later = await open(new Map([...synced(guest.S()), ['selene-artifact-uid', 'u-invite']]), store.viewer({ uid: 'u-invite' }));
  assert.match(notes(later), /NOTE_INVITE/, 'rouvert : son carnet, pas oublié cette fois');
});

test('un usage seulement local, sans synchronisation passée : gardé, et rangé dans l’espace privé', async () => {
  const store = fakeStore();
  const before = await open(new Map(), { use: async () => null }); // l'artefact d'avant, sans db
  await keep(before, 'NOTE_LOCALE');
  const storage = new Map([['selene-site-v1', JSON.stringify(before.S())]]);
  const app = await open(storage, store.viewer({ uid: 'u-invite' }));
  assert.match(notes(app), /NOTE_LOCALE/);
  assert.match(JSON.stringify(store.read('data/users/u-invite/site')), /NOTE_LOCALE/);
});

test('sans identité, en lecture seule, ou dans le navigateur d’un autre compte : rien ne part, rien ne se perd', async () => {
  const store = fakeStore();
  const anonymous = await open(new Map(), store.viewer({ uid: 'u-x', user: false })); // publié sans « user »
  await keep(anonymous, 'NOTE_SANS_ID');
  assert.equal(store.writes.length, 0, 'aucune écriture, nulle part (jamais sur un chemin partagé)');
  assert.match(notes(anonymous), /NOTE_SANS_ID/, 'gardé dans ce navigateur');
  assert.match(anonymous.el('#saving').textContent, /Non synchronisé/, 'et dit');

  const reader = await open(new Map(), store.viewer({ uid: 'u-lecteur', canWrite: false })); // Viewer : ne peut rien écrire
  await keep(reader, 'NOTE_LECTEUR');
  assert.equal(store.writes.length, 0);
  assert.match(notes(reader), /NOTE_LECTEUR/);

  const mine = await open(new Map(), store.viewer({ uid: 'u-a' }));
  await keep(mine, 'NOTE_DE_A');
  const n = store.writes.length;
  const other = await open(new Map([...synced(mine.S()), ['selene-artifact-uid', 'u-a']]), store.viewer({ uid: 'u-b' }));
  assert.equal(store.writes.length, n, 'le carnet de A ne part pas chez B');
  assert.match(notes(other), /NOTE_DE_A/, 'ni n’est effacé de ce navigateur');
  assert.match(other.el('#saving').textContent, /autre compte claude\.ai/);
});
