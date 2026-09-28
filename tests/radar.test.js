/* Radar culturel (src/radar.js) : la requête (zone et dates, jamais les mots), la traduction, le tri par tes mots. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = { URL };
vm.runInNewContext(fs.readFileSync('src/radar.js', 'utf8') + '\n;globalThis.__r = { radarUrl, radarEvents, radarWords, radarMatch };', ctx);
const R = ctx.__r;

test('requête : la zone arrondie et deux semaines, sans aucun mot', () => {
  const u = new URL(R.radarUrl({ lat: 50.6321, lon: 3.0578 }, '2026-09-28'));
  assert.equal(u.origin, 'https://opendata.lillemetropole.fr');
  assert.ok(u.pathname.endsWith('/catalog/datasets/evenements-publics-openagenda/records'));
  const w = u.searchParams.get('where');
  assert.ok(w.includes("lastdate_end >= date'2026-09-28'") && w.includes("firstdate_begin < date'2026-10-12'"));
  assert.ok(w.includes("geom'POINT(3.1 50.6)', 20km"), w);
  assert.equal(u.searchParams.get('order_by'), 'firstdate_begin');
  assert.ok(u.searchParams.get('select').includes('title_fr'));
  assert.equal(new URL(R.radarUrl({ lat: 50.6, lon: 3.1 }, '2026-09-28', { lean: false })).searchParams.get('select'), null);
});

test('réponse : champs tolérants, adresse https seulement, doublons écartés', () => {
  const ev = R.radarEvents({ results: [
    { uid: 1, title_fr: 'Nuit de la <b>poésie</b>', description_fr: '<p>Lectures  à voix haute.</p>', keywords_fr: ['Poésie', 'lecture'], firstdate_begin: '2026-10-02T18:00:00+00:00', lastdate_end: '2026-10-02T23:00:00+00:00', location_name: 'La Condition publique', location_city: 'Roubaix', canonicalurl: 'https://openagenda.com/e/1' },
    { uid: 1, title_fr: 'Nuit de la poésie' },
    { uid: 2, title: 'Jazz au parc', keywords: 'jazz; concert', firstdate_begin: '2026-09-20', lastdate_end: '2026-10-20', canonicalurl: 'javascript:alert(1)' },
    { uid: 3, title_fr: '' }, null
  ] });
  assert.equal(ev.length, 2);
  assert.deepEqual({ ...ev[0], kw: [...ev[0].kw] }, { id: '1', title: 'Nuit de la poésie', from: '2026-10-02', to: '2026-10-02', place: 'La Condition publique', city: 'Roubaix', url: 'https://openagenda.com/e/1', kw: ['Poésie', 'lecture'], text: 'Lectures à voix haute.' });
  assert.equal(ev[1].url, ''); assert.deepEqual([...ev[1].kw], ['jazz', 'concert']);
  assert.deepEqual([...R.radarEvents(null)], []); assert.deepEqual([...R.radarEvents({ results: 'x' })], []);
});

test('tri : tes mots sans accents ni casse, du plus tôt au plus tard, cinq au plus', () => {
  assert.deepEqual([...R.radarWords(' Poésie, JAZZ ,, x, poesie ')], ['poesie', 'jazz']);
  const e = (id, title, from, extra = {}) => ({ id, title, from, to: from, place: '', city: '', url: '', kw: [], text: '', ...extra });
  const events = [e('a', 'Concert de jazz', '2026-10-05'), e('b', 'Atelier', '2026-10-01', { kw: ['Poésie'] }), e('c', 'Marché', '2026-09-30'),
    e('d', 'Lecture', '2026-10-03', { text: 'Une soirée de poésie sonore.' }), ...Array.from({ length: 6 }, (_, i) => e('j' + i, 'Jazz ' + i, '2026-10-1' + i))];
  const m = R.radarMatch(events, ['poesie', 'jazz'], 5);
  assert.equal(m.total, 9);
  assert.deepEqual([...m.items.map(x => x.id)], ['b', 'd', 'a', 'j0', 'j1']);
  assert.deepEqual([...m.items[0].on], ['poesie']);
  assert.equal(R.radarMatch(events, ['opera']).total, 0);
});
