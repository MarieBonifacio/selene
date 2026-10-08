/* Frontière de plateforme (src/platform.js) : aucune autre source ne touche aux API de l'hôte, pour qu'une coquille
   native (Capacitor, Tauri) n'ait qu'un fichier à remplacer. Et la couche web elle-même : sûre quand le stockage refuse. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

const sources = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? sources(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);

test('seul platform.js touche au stockage du navigateur, à window.claude et à navigator.storage', () => {
  // src/native : l'amorçage des coquilles, qui fabrique les coffres de platform avant Selene (même couche).
  const offenders = sources('src').filter(f => path.basename(f) !== 'platform.js' && !f.startsWith(path.join('src', 'native'))).flatMap(f =>
    fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
      /\b(localStorage|sessionStorage|indexedDB|BroadcastChannel)\b|window\.claude|navigator\.storage/.test(line) ? [`${f}:${i + 1}`] : []));
  assert.deepEqual(offenders, [], 'passer par platform.storage / secrets / session / claude');
});

test('les secrets (session, clés d’API, adresse privée d’agenda) ne passent jamais par platform.storage', () => {
  const secret = /platform\.storage\.(get|set|remove)\((AUTH_KEY|OA_KEY|ZOT_KEY|ICS_URL|"selene-(auth-session|api-key|openalex-key|zotero-key|ics-url)")/;
  const offenders = sources('src').flatMap(f => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) => secret.test(line) ? [`${f}:${i + 1}`] : []));
  assert.deepEqual(offenders, [], 'passer par platform.secrets');
});

// src/platform.js est un module ES : traduit en CommonJS, il s'évalue dans un contexte dont on choisit les globales
// (window, localStorage…), une fois par test.
const platformCjs = esbuild.transformSync(fs.readFileSync('src/platform.js', 'utf8'), { format: 'cjs' }).code;
function load(ctx) {
  const module = { exports: {} };
  vm.runInNewContext(platformCjs, Object.assign(ctx, { module, exports: module.exports }));
  return module.exports;
}
const memory = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
};

test('web : stockage, secrets et session, lus et écrits', () => {
  const { platform } = load({ window: { claude: null, addEventListener() {} }, localStorage: memory(), sessionStorage: memory() });
  assert.equal(platform.storage.set('a', '1'), true);
  assert.equal(platform.storage.get('a'), '1');
  platform.secrets.set('selene-api-key', 'k');
  assert.deepEqual([...platform.storage.keys()].sort(), ['a', 'selene-api-key'], 'sur le web, les secrets partagent le localStorage');
  platform.storage.remove('a');
  assert.equal(platform.storage.get('a'), null);
  platform.session.set('s', 'x');
  assert.equal(platform.session.get('s'), 'x');
  assert.equal(platform.storage.get('s'), null, 'la session est à part');
});

test('stockage refusé (navigation privée, quota) : null ou false, jamais une exception', () => {
  const refuse = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('refusé'); }, key() { throw new Error('refusé'); }, get length() { throw new Error('refusé'); } };
  const { platform } = load({ window: { claude: null, addEventListener() {} }, localStorage: refuse });
  assert.equal(platform.storage.get('a'), null);
  assert.equal(platform.storage.set('a', '1'), false);
  assert.doesNotThrow(() => platform.storage.remove('a'));
  assert.deepEqual([...platform.storage.keys()], []);
  assert.equal(platform.session.get('a'), null, 'sessionStorage absent : null');
});

test('runtime : artefact claude.ai ou web, et ses espaces de noms', async () => {
  const web = load({ window: { claude: null } });
  assert.equal(web.platform.runtime(), 'web'); assert.equal(web.hosted(), true);
  assert.equal(web.platform.claude.available(), false);
  assert.equal(await web.platform.claude.use('db'), null);
  const art = load({ window: { claude: { use: async ns => 'ns:' + ns } } });
  assert.equal(art.platform.runtime(), 'artifact'); assert.equal(art.hosted(), false);
  assert.equal(await art.platform.claude.use('sample'), 'ns:sample');
});

// Coffre asynchrone, comme celui d'une coquille native : chaque opération répond après `delay(clé)` ms.
function vault(initial = {}, { delay = () => 1, fail = null } = {}) {
  const data = new Map(Object.entries(initial)), log = [];
  const later = (k, fn) => new Promise((ok, ko) => setTimeout(() => { try { ok(fn()); } catch (e) { ko(e); } }, delay(k)));
  return { data, log,
    load: () => (fail === 'load' ? Promise.reject(new Error('illisible')) : later('', () => [...data])),
    write: (k, v) => later(k, () => { if (fail === 'write') throw new Error('plein'); data.set(k, v); log.push(`${k}=${v}`); }),
    remove: k => later(k, () => { data.delete(k); log.push(`-${k}`); }) };
}
const nativeCtx = (storage, secrets) => ({
  window: { claude: null, addEventListener() { throw new Error('pas d’événement « storage » en natif'); }, seleneNative: { runtime: 'capacitor', storage, secrets } },
  localStorage: { getItem() { throw new Error('localStorage touché'); }, setItem() { throw new Error('localStorage touché'); } },
  document: { body: { textContent: '' } } });

test('web : platform.ready démarre aussitôt, de façon synchrone (comme avant la façade)', () => {
  const { platform } = load({ window: { claude: null } });
  let started = false;
  platform.ready(() => { started = true; });
  assert.equal(started, true);
});

test('natif : rien ne démarre avant l’hydratation des deux coffres ; ensuite, lectures synchrones', async () => {
  const s = vault({ 'selene-site-v1': '{"v":1}' }), k = vault({ 'selene-api-key': 'sk' });
  const { platform, hosted } = load(nativeCtx(s, k));
  assert.equal(platform.runtime(), 'capacitor'); assert.equal(hosted(), true);
  let seen = null;
  platform.ready(() => { seen = [platform.storage.get('selene-site-v1'), platform.secrets.get('selene-api-key'), platform.storage.get('selene-api-key')]; });
  assert.equal(seen, null, 'pas encore hydraté');
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(seen, ['{"v":1}', 'sk', null], 'chaque coffre a ses clés');
  assert.doesNotThrow(() => platform.storage.watch(() => {}), 'une seule fenêtre : pas d’écoute « storage »');
});

test('natif : écriture immédiate en mémoire, dans l’ordre vers le coffre, et flush attend la fin', async () => {
  // La première écriture de « a » est la plus lente : sans file par clé, le coffre finirait sur « 1 ».
  let n = 0; const s = vault({}, { delay: k => (k === 'a' && n++ === 0 ? 30 : 1) });
  const { platform } = load(nativeCtx(s, vault()));
  await new Promise(r => platform.ready(r));
  platform.storage.set('a', '1'); platform.storage.set('a', '2'); platform.storage.set('b', 'x'); platform.storage.remove('b');
  assert.equal(platform.storage.get('a'), '2', 'lu aussitôt, sans attendre le coffre');
  assert.deepEqual([...platform.storage.keys()], ['a']);
  await platform.flush();
  assert.equal(s.data.get('a'), '2', 'dernière écriture gagnante');
  assert.equal(s.data.has('b'), false);
  assert.deepEqual(s.log.filter(x => x.startsWith('a')), ['a=1', 'a=2']);
});

test('natif : un coffre qui refuse une écriture ne casse rien ; un coffre illisible n’ouvre pas une app vide', async () => {
  const { platform } = load(nativeCtx(vault({}, { fail: 'write' }), vault()));
  await new Promise(r => platform.ready(r));
  assert.equal(platform.storage.set('a', '1'), true);
  await assert.doesNotReject(platform.flush());
  assert.equal(platform.storage.get('a'), '1', 'la session garde la valeur');

  const ctx = nativeCtx(vault({}, { fail: 'load' }), vault()), p2 = load(ctx).platform;
  let started = false;
  p2.ready(() => { started = true; });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(started, false, 'sans ses données, Selene ne démarre pas (elle les écraserait)');
  assert.match(ctx.document.body.textContent, /n'a pas pu lire/);
});

// La migration de localStorage vers IndexedDB (ADR 13), avec un coffre simulé : ce qui part, ce qui reste, et quand.
const loadMigrate = () => {
  return load({ window: { claude: null } });
};
const fakeIdb = (initial = {}, { failWrite = false } = {}) => {
  const data = new Map(Object.entries(initial));
  return { data, load: async () => [...data], writeAll: async entries => { if (failWrite) throw new Error('plein'); for (const [k, v] of entries) if (v == null) data.delete(k); else data.set(k, v); } };
};

// La copie de secours (web) : ce qui est encore en route vers IndexedDB quand la page se ferme.
test('secours : à la fermeture, la dernière valeur de chaque clé en route, le document avant sa base ; retirée quand l’écriture aboutit', async () => {
  const { mirror, webStore, RESCUE } = loadMigrate(), ls = memory(), area = webStore(() => ls);
  let release; const gate = new Promise(r => { release = r; });
  const lent = { write: () => gate, remove: () => gate }; // IndexedDB qui n'a pas encore fini
  const m = mirror(lent, () => {}, area);
  m.set('selene-site-v1-base', 'base'); m.set('selene-site-v1', 'v1'); m.set('selene-site-v1', 'v2'); m.remove('selene-draft-x');
  m.rescue();
  const copies = [...area.keys()].filter(k => k.startsWith(RESCUE)); // un tableau de ce contexte (vm), pas de l'autre
  assert.deepEqual(copies, ['selene-site-v1', 'selene-draft-x', 'selene-site-v1-base'].map(k => RESCUE + k), 'chaque clé en route, la base en dernier');
  assert.equal(ls.getItem(RESCUE + 'selene-site-v1'), '{"v":"v2"}', 'la dernière valeur');
  assert.equal(ls.getItem(RESCUE + 'selene-draft-x'), '{"v":null}', 'un effacement aussi');
  release(); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual([...area.keys()].filter(k => k.startsWith(RESCUE)), [], 'tout a abouti : plus de copie');
});

test('secours : une écriture plus récente, dans un autre onglet, retire la copie laissée par le premier', async () => {
  const { mirror, webStore, RESCUE } = loadMigrate(), ls = memory(), area = webStore(() => ls);
  const fige = mirror({ write: () => new Promise(() => {}) }, () => {}, area); // l'onglet qui se ferme : jamais fini
  fige.set('selene-site-v1', 'ancien'); fige.rescue();
  assert.equal(ls.getItem(RESCUE + 'selene-site-v1'), '{"v":"ancien"}');
  const autre = mirror({ write: async () => {} }, () => {}, area);
  autre.set('selene-site-v1', 'récent'); await new Promise(r => setTimeout(r, 0));
  assert.equal(ls.getItem(RESCUE + 'selene-site-v1'), null, 'la copie ne peut pas écraser, au démarrage, ce qui est plus récent');
});

test('secours : une écriture refusée par IndexedDB (quota, transaction annulée) reste à sauver, jusqu’à la suivante qui aboutit', async () => {
  const { mirror, webStore, RESCUE } = loadMigrate(), ls = memory(), area = webStore(() => ls);
  let refuse = true;
  const m = mirror({ write: async () => { if (refuse) throw new Error('quota'); } }, () => {}, area);
  m.set('selene-site-v1', 'capture'); await new Promise(r => setTimeout(r, 0));
  m.rescue();
  assert.equal(ls.getItem(RESCUE + 'selene-site-v1'), '{"v":"capture"}', 'refusée, elle n’existait plus qu’en mémoire : la copie la garde');
  refuse = false; m.set('selene-site-v1', 'suite'); await new Promise(r => setTimeout(r, 0));
  assert.equal(ls.getItem(RESCUE + 'selene-site-v1'), null, 'la suivante a abouti : plus rien à sauver');
  m.rescue();
  assert.deepEqual([...area.keys()].filter(k => k.startsWith(RESCUE)), []);
});

test('secours : un reste refusé ici cède à une écriture qui a abouti dans un autre onglet', async () => {
  const { mirror, webStore, RESCUE } = loadMigrate(), ls = memory(), area = webStore(() => ls);
  const m = mirror({ write: async () => { throw new Error('quota'); }, get: async () => 'récent' }, () => {}, area);
  m.set('selene-site-v1', 'ancien'); await new Promise(r => setTimeout(r, 0));
  await m.refresh('selene-site-v1'); // l'autre onglet a écrit « récent », et le dit
  m.rescue();
  assert.equal(ls.getItem(RESCUE + 'selene-site-v1'), null, 'jamais plus ancien par-dessus plus récent, au démarrage suivant');
  assert.equal(m.get('selene-site-v1'), 'récent');
});

test('secours : si IndexedDB refuse de les reprendre, les copies restent pour le démarrage suivant', async () => {
  const { restoreRescue, webStore, RESCUE } = loadMigrate(), ls = memory(), area = webStore(() => ls);
  ls.setItem(RESCUE + 'selene-site-v1', '{"v":"capture"}');
  await assert.rejects(restoreRescue(fakeIdb({}, { failWrite: true }), area));
  assert.equal(ls.getItem(RESCUE + 'selene-site-v1'), '{"v":"capture"}');
});

test('secours : au démarrage, les copies rejoignent IndexedDB (effacements compris), puis quittent localStorage', async () => {
  const { restoreRescue, migrateToIdb, webStore, RESCUE } = loadMigrate(), ls = memory(), area = webStore(() => ls);
  ls.setItem(RESCUE + 'selene-site-v1', '{"v":"capture de la dernière seconde"}'); ls.setItem(RESCUE + 'selene-draft-x', '{"v":null}');
  ls.setItem(RESCUE + 'illisible', 'pas du JSON'); ls.setItem('selene-auth-session', 'jeton');
  const idb = fakeIdb({ 'selene-site-v1': 'avant', 'selene-draft-x': 'brouillon' });
  await restoreRescue(idb, area); await migrateToIdb(idb, area);
  assert.equal(idb.data.get('selene-site-v1'), 'capture de la dernière seconde');
  assert.equal(idb.data.has('selene-draft-x'), false, 'l’effacement est appliqué');
  assert.ok(![...idb.data.keys()].some(k => k.startsWith(RESCUE)), 'aucune copie ne devient une clé ordinaire');
  assert.deepEqual([...area.keys()], ['selene-auth-session'], 'localStorage ne garde que les secrets');
});

/* La copie différentielle (A65) : Safari plafonne localStorage vers 2,5 millions de caractères par site. Un espace de
   3 Mo n'y entrait pas, et la capture de la dernière seconde, encore en route vers IndexedDB, était perdue. */
const plafonne = limite => { // un localStorage qui refuse au-delà de `limite` caractères en tout, comme Safari
  const ls = memory(), set = ls.setItem, taille = () => { let t = 0; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); t += k.length + ls.getItem(k).length; } return t; };
  ls.setItem = (k, v) => { const avant = ls.getItem(k); if (taille() - (avant === null ? 0 : k.length + avant.length) + k.length + String(v).length > limite) throw new Error('QuotaExceededError'); set(k, v); };
  return ls;
};
const lourd = () => { // un document de 3 millions de caractères, son horodatage en tête, sa boîte de réception au milieu
  const notes = Array.from({ length: 30000 }, (_, i) => ({ id: `n${i}`, text: `Fragment ${i} : une phrase ordinaire, pour peser.` }));
  return JSON.stringify({ updatedAt: 1791417245870, schemaVersion: 8, modules: { boite: { entries: notes.slice(0, 5000) }, archives: { entries: notes } } });
};
test('secours : la différence entre deux valeurs se recompose exactement, quelle qu’elle soit', () => {
  const { delta, undelta } = loadMigrate();
  const cas = [['', ''], ['', 'abc'], ['abc', ''], ['même', 'même'], ['début', 'début et suite'], ['la fin', 'au début, la fin'],
    ['{"updatedAt":1,"x":"' + 'y'.repeat(5000) + '"}', '{"updatedAt":2,"x":"' + 'y'.repeat(2500) + 'NOUVEAU' + 'y'.repeat(2500) + '"}'],
    ['abcdefgh'.repeat(400), 'abcdefgh'.repeat(200) + 'X' + 'abcdefgh'.repeat(200)], ['tout autre chose', 'rien à voir']];
  let graine = 7; const hasard = n => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
  const lettres = 'ab{}":,0123456789 éàœ😀';
  for (let c = 0; c < 400; c++) { // des chaînes au hasard, et des modifications au hasard : insertions, retraits, remplacements
    let a = ''; for (let i = hasard(3000); i > 0; i--) a += lettres[hasard(lettres.length)];
    let b = a; for (let e = hasard(5); e > 0; e--) { const p = hasard(b.length + 1), q = Math.min(b.length, p + hasard(60)); let ins = ''; for (let i = hasard(80); i > 0; i--) ins += lettres[hasard(lettres.length)]; b = b.slice(0, p) + ins + b.slice(hasard(2) ? q : p); }
    cas.push([a, b]);
  }
  for (const [a, b] of cas) { const d = JSON.parse(JSON.stringify(delta(a, b))); assert.equal(undelta(a, d), b, `${a.length} → ${b.length}`); }
  assert.equal(undelta('court', [[0, 99]]), null, 'une plage hors de la base : refusée');
  assert.equal(undelta('court', [{}]), null);
});

test('secours : un document trop lourd pour localStorage laisse sa différence avec ce qu’IndexedDB tient, et elle revient au démarrage', async () => {
  const { mirror, restoreRescue, webStore, RESCUE } = loadMigrate(), ls = plafonne(2500000), area = webStore(() => ls);
  const avant = lourd(), apres = avant.replace('"updatedAt":1791417245870', '"updatedAt":1791417250000').replace('{"id":"n2500"', '{"id":"capture","text":"à effacer SYN-005 dernière"},{"id":"n2500"');
  assert.ok(avant.length > 2500000, `${avant.length} caractères : plus que ce que Safari garde`);
  const idb = { ...fakeIdb({ 'selene-site-v1': avant }), get: async k => idb.data.get(k), write: () => new Promise(() => {}) }; // la fermeture : jamais finie
  const m = mirror(idb, () => {}, area); await m.hydrate();
  m.set('selene-site-v1', apres); m.set('selene-draft-x', 'brouillon');
  m.rescue();
  const copie = ls.getItem(RESCUE + 'selene-site-v1');
  assert.ok(copie && copie.length < 2000, `la copie : ${copie && copie.length} caractères`);
  assert.equal(ls.getItem(RESCUE + 'selene-draft-x'), '{"v":"brouillon"}', 'ce qui tient reste une copie entière');
  await restoreRescue(idb, area);
  assert.equal(idb.data.get('selene-site-v1'), apres, 'au démarrage suivant : la capture est là, le reste intact');
  assert.equal(idb.data.get('selene-draft-x'), 'brouillon');
  assert.deepEqual([...area.keys()], [], 'les copies quittent localStorage');
});

test('secours : une copie différentielle ne s’applique qu’à sa base ; le coffre qui tient autre chose est laissé tel quel', async () => {
  const { mirror, restoreRescue, webStore, RESCUE } = loadMigrate(), ls = plafonne(2500000), area = webStore(() => ls);
  const avant = lourd(), apres = avant.replace('{"id":"n10"', '{"id":"capture"},{"id":"n10"');
  const idb = { ...fakeIdb({ 'selene-site-v1': avant }), get: async k => idb.data.get(k), write: () => new Promise(() => {}) };
  const m = mirror(idb, () => {}, area); await m.hydrate();
  m.set('selene-site-v1', apres); m.rescue();
  assert.match(ls.getItem(RESCUE + 'selene-site-v1'), /^\{"d":/);
  const autre = avant.replace('"schemaVersion":8', '"schemaVersion":9'); // même longueur, autre contenu : l'empreinte le voit
  idb.data.set('selene-site-v1', autre);
  await restoreRescue(idb, area);
  assert.equal(idb.data.get('selene-site-v1'), autre, 'pas appliquée sur une autre base');
  assert.deepEqual([...area.keys()], [], 'et retirée');
  // Sans valeur confirmée dans le coffre (rien lu, rien écrit), pas de base : rien de plus qu'avant.
  const ls2 = plafonne(2500000), vide = mirror({ write: () => new Promise(() => {}) }, () => {}, webStore(() => ls2));
  vide.set('selene-site-v1', apres); vide.rescue();
  assert.equal(ls2.getItem(RESCUE + 'selene-site-v1'), null);
});

test('secours : la base suit chaque écriture confirmée, et ce qu’un autre onglet a écrit', async () => {
  const { mirror, restoreRescue, webStore, RESCUE } = loadMigrate(), ls = plafonne(2500000), area = webStore(() => ls);
  const v0 = lourd(), v1 = v0.replace('{"id":"n7"', '{"id":"un"},{"id":"n7"'), v2 = v1.replace('{"id":"n9"', '{"id":"deux"},{"id":"n9"');
  let fige = false;
  const idb = { ...fakeIdb({ 'selene-site-v1': v0 }), get: async k => idb.data.get(k) };
  idb.write = (k, v) => (fige ? new Promise(() => {}) : Promise.resolve(idb.data.set(k, v)));
  const m = mirror(idb, () => {}, area); await m.hydrate();
  m.set('selene-site-v1', v1); await new Promise(r => setTimeout(r, 0)); // confirmée : la base devient v1
  fige = true; m.set('selene-site-v1', v2); m.rescue();
  await restoreRescue(idb, area);
  assert.equal(idb.data.get('selene-site-v1'), v2);
  // Un autre onglet écrit, celui-ci relit : la base devient la sienne.
  const v3 = v2.replace('{"id":"n11"', '{"id":"trois"},{"id":"n11"'), v4 = v3.replace('{"id":"n13"', '{"id":"quatre"},{"id":"n13"');
  idb.data.set('selene-site-v1', v3); await m.refresh('selene-site-v1');
  m.set('selene-site-v1', v4); m.rescue();
  await restoreRescue(idb, area);
  assert.equal(idb.data.get('selene-site-v1'), v4);
});

test('migration : les clés ordinaires passent dans IndexedDB, les secrets restent, IndexedDB l’emporte', async () => {
  const { migrateToIdb, webStore } = loadMigrate(), ls = memory();
  ls.setItem('selene-site-v1', 'ancien'); ls.setItem('selene-bilan', 'mois'); ls.setItem('selene-auth-session', 'jeton'); ls.setItem('selene-api-key', 'sk');
  const idb = fakeIdb({ 'selene-site-v1': 'récent' });
  await migrateToIdb(idb, webStore(() => ls));
  assert.equal(idb.data.get('selene-site-v1'), 'récent', 'IndexedDB a déjà le document : la copie de localStorage est périmée');
  assert.equal(idb.data.get('selene-bilan'), 'mois');
  assert.ok(!idb.data.has('selene-auth-session') && !idb.data.has('selene-api-key'), 'aucun secret dans IndexedDB');
  assert.deepEqual([...Array(ls.length).keys()].map(i => ls.key(i)).sort(), ['selene-api-key', 'selene-auth-session'], 'localStorage ne garde que les secrets');
});

test('migration : si IndexedDB refuse l’écriture, rien ne quitte localStorage', async () => {
  const { migrateToIdb, webStore } = loadMigrate(), ls = memory();
  ls.setItem('selene-site-v1', 'doc');
  await assert.rejects(migrateToIdb(fakeIdb({}, { failWrite: true }), webStore(() => ls)));
  assert.equal(ls.getItem('selene-site-v1'), 'doc');
});

test('les secrets déclarés par platform sont ceux que la déconnexion efface', () => {
  const { SECRET_KEYS } = loadMigrate();
  assert.ok(SECRET_KEYS.includes('selene-auth-session') && SECRET_KEYS.includes('selene-api-key'));
  assert.match(fs.readFileSync('src/app/services/auth.js', 'utf8'), /PERSONAL_SECRETS = platform\.secretKeys\.filter/);
});

test('notifications et haptique : absentes sur le web, relayées vers la coquille native', async () => {
  const web = load({ window: { claude: null } }).platform;
  assert.equal(web.notifications.supported(), false);
  assert.equal(await web.notifications.permission(), 'denied');
  await assert.doesNotReject(web.notifications.replace([{ id: 1 }]));
  assert.doesNotThrow(() => web.haptic());
  const got = [], ctx = nativeCtx(vault(), vault());
  Object.assign(ctx.window.seleneNative, { notifications: { permission: async () => 'granted', replace: async l => got.push(l) }, haptic() { throw new Error('moteur absent'); } });
  const nat = load(ctx).platform;
  assert.equal(nat.notifications.supported(), true);
  assert.equal(await nat.notifications.permission(), 'granted');
  await nat.notifications.replace(['x']);
  assert.equal(got.length, 1);
  assert.doesNotThrow(() => nat.haptic(), 'un retour haptique qui échoue ne casse pas une capture');
});

test('widget : absent sur le web, relayé vers la coquille native qui en a un', async () => {
  const web = load({ window: { claude: null } }).platform;
  assert.equal(web.widget.supported(), false);
  await assert.doesNotReject(web.widget.update({ moon: 'x', lines: [] }));
  const got = [], ctx = nativeCtx(vault(), vault());
  ctx.window.seleneNative.widget = { update: async d => got.push(d) };
  const nat = load(ctx).platform;
  assert.equal(nat.widget.supported(), true);
  await nat.widget.update({ moon: 'Pleine lune', lines: ['a'] });
  assert.equal(got.length, 1);
});

test('un démarrage impossible se dit dans la langue de l’appareil (l’anglais ou, sinon, le français)', () => {
  const { unreadable } = load({ window: { claude: null, addEventListener() {} }, localStorage: memory(), sessionStorage: memory() });
  assert.match(unreadable(['en-US']), /^Selene couldn't read/);
  assert.match(unreadable(['de-DE', 'en-GB']), /^Selene couldn't read/, 'la première langue que Selene parle');
  assert.match(unreadable(['fr-CA', 'en']), /^Selene n'a pas pu lire/);
  assert.match(unreadable(['ja']), /^Selene n'a pas pu lire/, 'aucune : le français');
  assert.match(unreadable([]), /^Selene n'a pas pu lire/);
});
