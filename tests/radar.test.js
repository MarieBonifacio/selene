/* Radar culturel (src/core/radar.js) : la requête (zone et dates, jamais les mots), la traduction, le tri par tes mots. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/core/radar.js');

test('requête : la zone arrondie et deux semaines, sans aucun mot', () => {
  const u = new URL(R.radarUrl({ lat: 50.6321, lon: 3.0578 }, '2026-09-28'));
  assert.equal(u.origin, 'https://public.opendatasoft.com');
  assert.ok(u.pathname.endsWith('/catalog/datasets/evenements-publics-openagenda/records'));
  const w = u.searchParams.get('where');
  assert.ok(w.includes("lastdate_end >= date'2026-09-27'") && w.includes("firstdate_begin < date'2026-10-12'"));
  assert.ok(w.includes("geom'POINT(3.1 50.6)', 20km"), w);
  assert.equal(u.searchParams.get('order_by'), 'firstdate_begin,uid');
  assert.ok(u.searchParams.get('select').includes('title_fr'));
  assert.equal(new URL(R.radarUrl({ lat: 50.6, lon: 3.1 }, '2026-09-28', { offset: 100 })).searchParams.get('offset'), '100');
});

test('réponse : champs tolérants, adresse https seulement, doublons écartés', () => {
  const ev = R.radarEvents({ results: [
    { uid: 1, title_fr: 'Nuit de la <b>poésie</b>', description_fr: '<p>Lectures  à voix haute.</p>', keywords_fr: ['Poésie', 'lecture'], firstdate_begin: '2026-10-02T18:00:00+00:00', lastdate_end: '2026-10-02T23:00:00+00:00', location_name: 'La Condition publique', location_city: 'Roubaix', canonicalurl: 'https://openagenda.com/e/1' },
    { uid: 1, title_fr: 'Nuit de la poésie' },
    { uid: 2, title: 'Jazz au parc', keywords: 'jazz; concert', firstdate_begin: '2026-09-20', lastdate_end: '2026-10-20', canonicalurl: 'javascript:alert(1)' },
    { uid: 3, title_fr: '' }, null
  ] });
  assert.equal(ev.length, 2);
  assert.equal(ev[0].title, 'Nuit de la poésie');
  assert.equal(ev[0].from, '2026-10-02');
  assert.equal(ev[0].to, '2026-10-03', '23 h UTC est déjà le lendemain à Lille');
  assert.deepEqual(ev[0].kw, ['Poésie', 'lecture']);
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

const rec = extra => ({ uid: '1', title_fr: 'Atelier', firstdate_begin: '2026-10-01', lastdate_end: '2026-10-01', ...extra });
test('contrat : invalide distinct de vide', () => {
  for (const value of [null, {}, { results: [] }, { total_count: 0, results: {} }, { total_count: 1, results: [null] }, { total_count: 1, results: [rec({ lastdate_end: '2026-02-30' })] }]) assert.throws(() => R.radarPage(value));
  assert.deepEqual(R.radarPage({ total_count: 0, results: [] }), { total: 0, rows: [] });
});
test('recherche : description complète, mots-clés après le huitième, mots entiers et expressions', () => {
  const events = R.radarEvents({ results: [rec({ title_fr: 'Un quartier vivant', description_fr: 'x'.repeat(310) + ' jazz', longdescription_fr: 'Poésie sonore', keywords_fr: [...Array(8).fill('divers'), 'gravure'] })] });
  assert.equal(events[0].text.length, 300);
  for (const word of ['jazz', 'gravure', 'poesie sonore']) assert.equal(R.radarMatch(events, [word]).total, 1, word);
  assert.equal(R.radarMatch(events, ['art']).total, 0);
});
test('identifiants de secours : deux événements sans uid/URL restent distincts', () => {
  const events = R.radarEvents({ results: [rec({ uid: null, title_fr: 'A' }), rec({ uid: null, title_fr: 'B' }), rec({ uid: null, title_fr: 'A' })] });
  assert.equal(events.length, 2); assert.notEqual(events[0].id, events[1].id);
});
test('périmètre propre au radar, sans élargir à Paris ou Bruxelles', () => {
  for (const p of [{ lat: 50.63, lon: 3.06 }, { lat: 50.69, lon: 3.17 }]) assert.ok(R.radarCovered(p));
  for (const p of [null, { lat: 48.85, lon: 2.35 }, { lat: 50.85, lon: 4.35 }, { lat: '', lon: 3 }, { lat: 'x', lon: 3 }]) assert.equal(R.radarCovered(p), false);
  assert.throws(() => R.radarUrl({ lat: 50.6, lon: 3.1 }, '2026-02-30'));
});
test('récurrence : seule la prochaine occurrence dans la fenêtre compte, annulations exclues', () => {
  const base = rec({ firstdate_begin: '2026-09-01', lastdate_end: '2027-01-01', timings: JSON.stringify([{ begin: '2026-09-01', end: '2026-09-01' }, { begin: '2026-10-07', end: '2026-10-07' }]) });
  const ev = R.radarEvents({ results: [base] }, '2026-09-30');
  assert.equal(ev[0].from, '2026-10-07'); assert.equal(ev[0].to, '2026-10-07'); assert.equal(ev[0].dated, true);
  assert.equal(R.radarEvents({ results: [base] }, '2026-09-02').length, 0);
  assert.equal(R.radarEvents({ results: [{ ...base, status: '{"id":6}' }] }, '2026-09-30').length, 0);
  assert.throws(() => R.radarEvents({ results: [{ ...base, timings: 'broken' }] }, '2026-09-30'));
  assert.equal(R.radarEvents({ results: [{ ...base, status: '{"id":2}' }] }, '2026-09-30')[0].rescheduled, true);
});
test('fixture réelle du catalogue public : horaires JSON et événements actuels', () => {
  const fixture = require('./fixtures/radar-openagenda.json');
  const { rows } = R.radarPage(fixture);
  assert.equal(rows.length, 2);
  const ev = R.radarEvents(fixture, '2026-09-30');
  assert.equal(ev.length, 2);
  assert.equal(ev.find(e => e.id === '6394490').from, '2026-10-07');
});
