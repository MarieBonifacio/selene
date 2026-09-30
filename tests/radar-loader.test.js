/* Orchestration historique, extraite comme dehors.test.js : transport injecté, aucun réseau réel. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const R = require('../src/core/radar.js');
const place = { lat: 50.6, lon: 3.1 }, from = '2026-09-30';
const row = (uid, title = 'Atelier') => ({ uid, title_fr: title, firstdate_begin: '2026-10-02', lastdate_end: '2026-10-02' });
function setup(fetch) {
  const storage = new Map(), context = { ...R, fetch, Date, Map, Set, JSON, URL, TextDecoder, TextEncoder, Uint8Array, AbortController,
    platform: { storage: { get: k => storage.get(k), set: (k, v) => storage.set(k, v) } }, authSession: { user: { id: 'a' } },
    $: () => ({ addEventListener() {} }), passeurPret: () => false };
  const source = fs.readFileSync('src/types.js', 'utf8');
  vm.runInNewContext(source.slice(source.indexOf('const RADAR_KEY ='), source.indexOf('function radarWhen')) + '\nglobalThis.load = radarFetch;', context);
  return { context, storage, load: (force = false, signal = new AbortController().signal) => context.load(place, from, signal, force) };
}
const response = (results, total_count = results.length) => new Response(JSON.stringify({ results, total_count }), { headers: { 'content-type': 'application/json' } });
test('pages suivantes filtrées localement ; cache complet réutilisé et actualisation forcée', async () => {
  let calls = 0;
  const s = setup(async url => {
    calls++; const offset = +new URL(url).searchParams.get('offset');
    return offset === 0 ? response(Array.from({ length: 100 }, (_, i) => row(String(i))), 101) : response([row('100', 'Jazz')], 101);
  });
  const result = await s.load();
  assert.equal(result.complete, true); assert.equal(result.scanned, 101);
  assert.equal(R.radarMatch(result.events, ['jazz']).total, 1);
  await s.load(); assert.equal(calls, 2);
  await s.load(true); assert.equal(calls, 4);
});
test('HTML, mauvais JSON, schéma et quota : erreurs explicites, aucun cache', async () => {
  for (const make of [() => new Response('<html>Accueil</html>', { headers: { 'content-type': 'text/html' } }), () => new Response('nope', { headers: { 'content-type': 'application/json' } }), () => new Response('{}', { headers: { 'content-type': 'application/json' } }), () => new Response('', { status: 429 })]) {
    const s = setup(async () => make()); await assert.rejects(s.load()); assert.equal(s.storage.size, 0);
  }
});
test('échec après la première page : résultats partiels, jamais cachés comme complets', async () => {
  let calls = 0;
  const s = setup(async () => ++calls === 1 ? response(Array.from({ length: 100 }, (_, i) => row(String(i), 'Jazz')), 101) : new Response('', { status: 503 }));
  const result = await s.load(); assert.equal(result.complete, false); assert.equal(result.scanned, 100); assert.match(result.warning, /503/); assert.equal(s.storage.size, 0);
});
test('plafond de pages : compte rendu partiel et pas de cache', async () => {
  let calls = 0;
  const s = setup(async () => { const page = calls++; return response(Array.from({ length: 100 }, (_, i) => row(String(page * 100 + i))), 10000); });
  const result = await s.load(); assert.equal(calls, 20); assert.equal(result.complete, false); assert.equal(s.storage.size, 0);
});
test('cache v1 ignoré ; changer de compte pendant la lecture interdit une écriture tardive', async () => {
  let calls = 0; const s = setup(async () => { calls++; s.context.authSession = { user: { id: 'b' } }; return response([row('1')]); });
  s.storage.set('selene-radar', JSON.stringify({ at: Date.now(), key: R.radarUrl(place, from), events: [] }));
  const old = s.storage.get('selene-radar'); await s.load(); assert.equal(calls, 1); assert.equal(s.storage.get('selene-radar'), old);
});
test('une panne temporaire du direct n’est pas mémorisée pour toute la session', async () => {
  let calls = 0; const s = setup(async () => { if (++calls === 1) throw new Error('offline'); return response([]); });
  await assert.rejects(s.load(), /connexion/); const result = await s.load(); assert.equal(result.complete, true); assert.equal(calls, 2);
});
test('limite de réponse et annulation : aucun cache écrit', async () => {
  const huge = setup(async () => new Response(' '.repeat(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(huge.load(), /volumineuse/); assert.equal(huge.storage.size, 0);
  const controller = new AbortController(); controller.abort();
  const stopped = setup(async () => { throw new Error('ne doit pas être appelé'); });
  await assert.rejects(stopped.load(false, controller.signal), /Délai/); assert.equal(stopped.storage.size, 0);
});
test('pagination : trois requêtes simultanées au plus, ordre déterministe malgré des réponses inversées', async () => {
  let active = 0, max = 0;
  const s = setup(async url => {
    const offset = +new URL(url).searchParams.get('offset');
    active++; max = Math.max(max, active);
    await new Promise(r => setTimeout(r, offset === 100 ? 20 : 1)); active--;
    return response(Array.from({ length: offset === 400 ? 1 : 100 }, (_, i) => row(String(offset + i))), 401);
  });
  const result = await s.load(); assert.equal(max, 3); assert.equal(result.complete, true); assert.equal(result.events.length, 401);
  assert.equal(result.events[100].id, '100'); assert.equal(result.events[400].id, '400');
});
