/* Carte céleste (src/core/carte.js) : placement déterministe, bandes, temps, collisions, voisinage. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const C = require('../src/core/carte.js');
const nodes = [
  { ref: 'ecriture/a', mod: 'ecriture', date: '2026-09-01', links: 3 },
  { ref: 'ecriture/b', mod: 'ecriture', date: '2026-09-20', links: 1 },
  { ref: 'inbox/n', mod: 'inbox', date: '2026-09-10', links: 0 },
  { ref: 'inbox/x', mod: 'inbox', links: 1 }
];
const edges = [{ from: 'ecriture/b', to: 'ecriture/a', type: 'derive' }, { from: 'inbox/x', to: 'ecriture/a', type: 'contredit', open: true }, { from: 'ecriture/a', to: 'ailleurs/z', type: 'echo' }];

test('carte : la même entrée toujours au même endroit, quel que soit l’ordre reçu', () => {
  const a = C.carteLayout(nodes, edges, ['inbox', 'ecriture']), b = C.carteLayout([...nodes].reverse(), [...edges].reverse(), ['inbox', 'ecriture']);
  const pos = l => Object.fromEntries(l.stars.map(s => [s.ref, [s.x, s.y, s.r]]));
  assert.deepEqual(pos(a), pos(b));
  assert.equal(JSON.stringify(C.carteLayout(nodes, edges, ['inbox', 'ecriture'])), JSON.stringify(a), 'deux calculs, un seul ciel');
});

test('carte : le temps de gauche à droite, une bande par espace dans l’ordre de la navigation', () => {
  const l = C.carteLayout(nodes, edges, ['inbox', 'ecriture', 'vide']), s = Object.fromEntries(l.stars.map(x => [x.ref, x]));
  assert.ok(s['ecriture/a'].x < s['inbox/n'].x && s['inbox/n'].x < s['ecriture/b'].x, 'plus tard, plus à droite');
  assert.ok(s['inbox/x'].x < s['ecriture/a'].x, 'sans date : la colonne du bord');
  assert.deepEqual([...l.bands.map(b => b.mod)], ['inbox', 'ecriture'], 'une bande vide n’est pas dessinée');
  assert.ok(s['inbox/n'].y < s['ecriture/a'].y, 'bande de la boîte au-dessus de celle d’Écriture');
  assert.ok(s['ecriture/a'].r > s['inbox/n'].r, 'plus de liens, plus grosse étoile');
  assert.deepEqual([l.span.from, l.span.to], ['2026-09-01', '2026-09-20']);
});

test('carte : les liens ne relient que des étoiles présentes, la tension ouverte est marquée', () => {
  const l = C.carteLayout(nodes, edges, ['inbox', 'ecriture']);
  assert.equal(l.lines.length, 2, 'le lien vers une entrée hors carte est omis');
  assert.ok(l.lines.find(x => x.type === 'contredit').open);
  for (const x of l.lines) assert.match(x.d, /^M[\d.]+,[\d.]+Q[\d.-]+,[\d.-]+ [\d.]+,[\d.]+$/);
});

test('carte : vingt étoiles le même jour dans la même bande ne s’empilent pas au même point', () => {
  const same = Array.from({ length: 20 }, (_, i) => ({ ref: `ecriture/${i}`, mod: 'ecriture', date: '2026-09-01', links: 0 }));
  const l = C.carteLayout(same, [], ['ecriture']), ys = new Set(l.stars.map(s => s.y));
  assert.ok(ys.size >= 5, `étagées (${ys.size} hauteurs)`);
  for (const s of l.stars) assert.ok(s.y >= l.bands[0].y && s.y <= l.bands[0].y + 64, 'restent dans leur bande');
});

test('carte : le voisinage, en largeur d’abord, coupé à 80 en gardant les plus proches', () => {
  const adj = new Map([['a', ['b', 'c']], ['b', ['a', 'd']], ['c', ['a']], ['d', ['b', 'e']], ['e', ['d']]]);
  assert.deepEqual([...C.carteNeighbourhood('a', adj, 2).refs], ['a', 'b', 'c', 'd'], 'deux degrés : e est trop loin');
  const big = new Map([['s', Array.from({ length: 150 }, (_, i) => `n${String(i).padStart(3, '0')}`)]]);
  const r = C.carteNeighbourhood('s', big, 2);
  assert.equal(r.refs.length, C.CARTE_MAX); assert.equal(r.capped, true); assert.equal(r.refs[0], 's', 'l’entrée elle-même d’abord');
  assert.ok(C.hash01('x') >= 0 && C.hash01('x') < 1 && C.hash01('x') === C.hash01('x'));
});
