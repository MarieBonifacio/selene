/* Frontière de plateforme (src/platform.js) : aucune autre source ne touche aux API de l'hôte, pour qu'une coquille
   native (Capacitor, Tauri) n'ait qu'un fichier à remplacer. Et la couche web elle-même : sûre quand le stockage refuse. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sources = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? sources(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);

test('seul platform.js touche au stockage du navigateur, à window.claude et à navigator.storage', () => {
  const offenders = sources('src').filter(f => path.basename(f) !== 'platform.js').flatMap(f =>
    fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
      /\b(localStorage|sessionStorage)\b|window\.claude|navigator\.storage/.test(line) ? [`${f}:${i + 1}`] : []));
  assert.deepEqual(offenders, [], 'passer par platform.storage / secrets / session / claude');
});

test('les secrets (session, clés d’API, adresse privée d’agenda) ne passent jamais par platform.storage', () => {
  const secret = /platform\.storage\.(get|set|remove)\((AUTH_KEY|OA_KEY|ZOT_KEY|ICS_URL|"selene-(auth-session|api-key|openalex-key|zotero-key|ics-url)")/;
  const offenders = sources('src').flatMap(f => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) => secret.test(line) ? [`${f}:${i + 1}`] : []));
  assert.deepEqual(offenders, [], 'passer par platform.secrets');
});

function load(ctx) {
  vm.runInNewContext(fs.readFileSync('src/platform.js', 'utf8') + '\n;globalThis.__p = { platform, hosted };', ctx);
  return ctx.__p;
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
