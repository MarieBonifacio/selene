/* L'amorçage des coquilles natives (src/native/boot.js, ADR 15), avec de faux plugins Capacitor : les coffres qu'il
   pose pour platform.js, l'écriture par fichier temporaire, les secrets préfixés, le bouton retour et la mise en pause. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fakeCapacitor({ native = true, launchUrl = null } = {}) {
  const files = new Map(), secure = new Map(), listeners = {}, log = [];
  const Filesystem = {
    async readdir({ path }) { const pre = path + '/'; const l = [...files.keys()].filter(k => k.startsWith(pre)).map(k => ({ name: k.slice(pre.length) })); if (!l.length && !files.has(path + '/.dir')) throw new Error('absent'); return { files: l.filter(f => f.name !== '.dir') }; },
    async mkdir({ path }) { files.set(path + '/.dir', ''); },
    async readFile({ path }) { if (!files.has(path)) throw new Error('absent'); return { data: files.get(path) }; },
    async writeFile({ path, data }) { log.push('write ' + path); files.set(path, data); },
    async deleteFile({ path }) { if (!files.has(path)) throw new Error('absent'); log.push('delete ' + path); files.delete(path); },
    async rename({ from, to }) { log.push(`rename ${from} → ${to}`); files.set(to, files.get(from)); files.delete(from); }
  };
  const SecureStorage = {
    async internalGetPrefixedKeys({ prefix }) { return { keys: [...secure.keys()].filter(k => k.startsWith(prefix)) }; },
    async internalGetItem({ prefixedKey }) { return { data: secure.has(prefixedKey) ? secure.get(prefixedKey) : null }; },
    async internalSetItem({ prefixedKey, data }) { secure.set(prefixedKey, data); },
    async internalRemoveItem({ prefixedKey }) { secure.delete(prefixedKey); return { success: true }; }
  };
  const App = { addListener(n, f) { listeners[n] = f; }, exitApp() { log.push('exit'); }, getLaunchUrl: async () => (launchUrl ? { url: launchUrl } : undefined) };
  const events = [], history = { back() { log.push('back'); } };
  const window = { Capacitor: { isNativePlatform: () => native, Plugins: { Filesystem, SecureStorage, App } }, dispatchEvent(e) { events.push(e.type); } };
  const docEvents = [], docHandlers = {}, session = new Map();
  const document = { addEventListener(n, f) { docHandlers[n] = f; }, dispatchEvent(e) { docEvents.push(e); if (docHandlers[e.type]) docHandlers[e.type](e); } };
  const CustomEvent = class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  vm.runInNewContext(fs.readFileSync('src/native/boot.js', 'utf8'), { window, history, document, CustomEvent, URL, sessionStorage: { setItem: (k, v) => session.set(k, v) }, Event: class { constructor(t) { this.type = t; } } });
  return { window, files, secure, listeners, log, events, docEvents, session };
}

test('hors d’une coquille native : rien', () => {
  assert.equal(fakeCapacitor({ native: false }).window.seleneNative, undefined);
});

test('storage : un fichier par clé, écrit par un temporaire renommé, relu tel quel', async () => {
  const c = fakeCapacitor(), s = c.window.seleneNative.storage;
  assert.equal(c.window.seleneNative.runtime, 'capacitor');
  assert.deepEqual([...await s.load()], [], 'premier lancement : dossier créé, rien à lire');
  await s.write('selene-draft:ecriture:scrapIn', 'un brouillon');
  assert.deepEqual(c.log, ['write selene/selene-draft%3Aecriture%3AscrapIn.tmp', 'rename selene/selene-draft%3Aecriture%3AscrapIn.tmp → selene/selene-draft%3Aecriture%3AscrapIn']);
  await s.write('selene-site-v1', '{"v":1}'); await s.write('selene-site-v1', '{"v":2}');
  const loaded = Object.fromEntries(await s.load());
  assert.deepEqual(loaded, { 'selene-draft:ecriture:scrapIn': 'un brouillon', 'selene-site-v1': '{"v":2}' });
  await s.remove('selene-draft:ecriture:scrapIn');
  assert.deepEqual(Object.keys(Object.fromEntries(await s.load())), ['selene-site-v1']);
});

test('storage : une coupure avant le renommage laisse la dernière écriture complète, jamais un fichier à moitié', async () => {
  const c = fakeCapacitor(), s = c.window.seleneNative.storage;
  await s.load();
  c.files.set('selene/selene-bilan.tmp', 'mois'); // écrit, pas encore renommé
  c.files.set('selene/selene-open', 'last'); c.files.set('selene/selene-open.tmp', 'acc'); // les deux : le final fait foi
  assert.deepEqual(Object.fromEntries(await s.load()), { 'selene-bilan': 'mois', 'selene-open': 'last' });
});

test('secrets : dans le trousseau, sous le préfixe selene:', async () => {
  const c = fakeCapacitor(), k = c.window.seleneNative.secrets;
  c.secure.set('autre-app:jeton', 'x');
  await k.write('selene-auth-session', '{"t":1}');
  assert.ok(c.secure.has('selene:selene-auth-session'));
  assert.deepEqual([...await k.load()].map(([a, b]) => [a, b]), [['selene-auth-session', '{"t":1}']], 'seulement les siens');
  await k.remove('selene-auth-session');
  assert.deepEqual([...await k.load()], []);
});

test('bouton retour : l’historique, sinon quitter ; mise en pause : pagehide', () => {
  const c = fakeCapacitor();
  c.listeners.backButton({ canGoBack: true }); c.listeners.backButton({ canGoBack: false });
  assert.deepEqual(c.log, ['back', 'exit']);
  c.listeners.pause();
  assert.deepEqual(c.events, ['pagehide']);
});

test('Tauri : les coffres passent par les six commandes de l’app, avec leurs arguments', async () => {
  const calls = [], window = { __TAURI__: { core: { invoke: async (cmd, args) => { calls.push([cmd, args]); return cmd.endsWith('_load') ? [['k', 'v']] : null; } } } };
  const handlers = {}, session = new Map();
  const document = { addEventListener(n, f) { handlers[n] = f; } }, sessionStorage = { setItem: (k, v) => session.set(k, v) };
  vm.runInNewContext(fs.readFileSync('src/native/boot.js', 'utf8'), { window, document, sessionStorage, history: {}, Event: class {} });
  const n = window.seleneNative;
  assert.equal(n.runtime, 'tauri');
  // Un lien selene://share arrive avant que Selene ait démarré : il attend dans la file qu'elle lit au démarrage.
  handlers['selene:share']({ detail: { url: 'https://a.org', title: 'T', text: 'x'.repeat(5000), extra: 'ignoré' } });
  const q = JSON.parse(session.get('selene-share'));
  assert.deepEqual(Object.keys(q), ['url', 'title', 'text']); assert.equal(q.text.length, 4000);
  assert.deepEqual([...await n.storage.load()].map(x => [...x]), [['k', 'v']]);
  await n.storage.write('selene-site-v1', '{}'); await n.storage.remove('selene-bilan');
  await n.secrets.load(); await n.secrets.write('selene-auth-session', 's'); await n.secrets.remove('selene-auth-session');
  assert.deepEqual(calls.map(([c, a]) => [c, a && { ...a }]), [
    ['store_load', undefined], ['store_write', { key: 'selene-site-v1', value: '{}' }], ['store_remove', { key: 'selene-bilan' }],
    ['secret_load', undefined], ['secret_write', { key: 'selene-auth-session', value: 's' }], ['secret_remove', { key: 'selene-auth-session' }]]);
});

test('liens selene:// (iOS, Android) : partage rangé dans la file, capture relayée, autres ignorés', async () => {
  const c = fakeCapacitor({ launchUrl: 'selene://share?url=https%3A%2F%2Fexemple.org&title=Un%20titre' });
  await new Promise(r => setImmediate(r));
  assert.deepEqual(JSON.parse(c.session.get('selene-share')), { url: 'https://exemple.org', title: 'Un titre', text: '' }, 'lien qui a lancé l’app');
  c.listeners.appUrlOpen({ url: 'selene://capture' });
  c.listeners.appUrlOpen({ url: 'https://ailleurs.example/share?text=x' });
  c.listeners.appUrlOpen({ url: 'pas une adresse' });
  assert.deepEqual(c.docEvents.map(e => e.type), ['selene:share', 'selene:capture'], 'seul le schéma selene: compte');
});
