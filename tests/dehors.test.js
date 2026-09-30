/* Dehors (src/app/dehors.js) : le nouveau, croisé avec ce que tu gardes (motifs croisés, vague 7c). */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { dehorsNew } = require('../src/app/dehors.js');
const plain = x => JSON.parse(JSON.stringify(x));
const NOW = Date.parse('2026-09-29T12:00:00Z'), H = 3600000;
const item = (id, title, hoursAgo, extra = {}) => ({ id, title, text: '', link: `https://site.example/${id}`, date: new Date(NOW - hoursAgo * H).toISOString(), first: NOW, ...extra });
const A = { id: 'fa', title: 'Revue A', seen: 0 }, B = { id: 'fb', title: 'Blog B', seen: 0 };
const cache = {
  fa: { items: [item('a1', 'Sur les phalènes', 5), item('a2', 'Un article sans rapport', 1), item('a3', 'Le même lien', 3, { link: 'https://doi.org/10.1000/x' })] },
  fb: { items: [item('b1', 'Le même lien, repris', 2, { link: 'https://doi.org/10.1000/x' }), item('b2', 'Encore autre chose', 4)] }
};
const test_ = t => (/phalène/i.test(t) ? ['phalène'] : []);
const key = x => x.link.replace(/^https:\/\/doi\.org\//, 'doi:');

test('sans croisement : du plus récent au plus ancien, comme avant', () => {
  const r = dehorsNew([A, B], cache, new Set(), NOW);
  assert.deepEqual(plain(r.items.map(i => i.x.id)), ['a2', 'b1', 'a3', 'b2', 'a1']);
  assert.ok(r.items.every(i => i.why.length === 0));
});

test('motifs croisés : ce qui a des raisons passe devant, et les dit ; un lien paru dans deux flux, une fois', () => {
  const why = x => (x.id === 'b2' ? ['auteur de tes sources : Anna Ciaunica', 'cite « Le soi », de tes sources'] : []);
  const r = dehorsNew([A, B], cache, new Set(), NOW, { test: test_, key, why });
  assert.deepEqual(plain(r.items.map(i => i.x.id)), ['b2', 'a3', 'a1', 'a2']);
  assert.equal(r.total, 4);
  assert.deepEqual(plain(r.items[0].why), ['auteur de tes sources : Anna Ciaunica', 'cite « Le soi », de tes sources']);
  assert.deepEqual(plain(r.items[1].why), ['aussi dans Blog B']); // le premier lu (flux A) représente le lien
  assert.deepEqual(plain(r.items[2].why), ['motif : phalène']);
});

test('écarté par sa clé : il ne revient pas par un autre flux ; « seulement mes motifs » filtre encore ; max', () => {
  let r = dehorsNew([A, B], cache, new Set(['k|doi:10.1000/x']), NOW, { test: test_, key });
  assert.ok(!r.items.some(i => ['a3', 'b1'].includes(i.x.id)));
  r = dehorsNew([{ ...A, motifs: true }, B], cache, new Set(), NOW, { test: test_, key });
  assert.deepEqual(plain(r.items.map(i => i.x.id)), ['a1', 'b1', 'b2']);
  r = dehorsNew([A, B], cache, new Set(), NOW, { test: test_, key, max: 2 });
  assert.equal(r.items.length, 2); assert.equal(r.total, 4);
});
