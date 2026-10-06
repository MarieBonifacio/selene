/* Banc de mesure, et seuil de la CI (BL-09 du cahier de recette, TRV-007) : un historique réaliste de plusieurs années —
   5 500 textes, ~2 millions de caractères, 60 motifs clairsemés —, puis le temps de rendu des vues qui parcourent tout
   (accueil, motifs, bilan) et d'une recherche. Usage : python3 build.py && node tests/bench.js
   Chaque mesure est la médiane de cinq passages (après un passage de chauffe) : un passage dérangé par la machine ne
   fait pas échouer. Au-delà de LIMIT (150 ms, SELENE_BENCH_LIMIT pour essayer autre chose), le banc échoue : décision
   du 6 octobre 2026, qui laisse une marge d'environ ×2,7 sur la plus lente (56 ms) et attrape une régression de
   complexité (une boucle quadratique sur 5 500 textes). La VM n'a ni mise en page ni peinture : le seuil est relatif,
   pas une promesse sur téléphone (compter 3 à 5 fois plus ; la cible sur un vrai téléphone est dans TRV-007). */
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const html = fs.readFileSync('selene.html', 'utf8'), script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const storage = new Map([['selene-site-v1', fs.readFileSync('tests/fixtures/site-demo.json', 'utf8')]]);
const nodes = new Map(), element = id => { if (!nodes.has(id)) nodes.set(id, { id, dataset: {}, value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {} }, addEventListener() {}, querySelectorAll() { return []; }, focus() {} }); return nodes.get(id); };
const context = { document: { title: '', activeElement: null, documentElement: { dataset: {} }, querySelector: element, getElementById: element, addEventListener() {} },
  window: { addEventListener() {}, claude: { use: async () => null } }, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k), key: i => [...storage.keys()][i] ?? null, get length() { return storage.size; } },
  location: { hash: '' }, navigator: {}, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval };
vm.runInNewContext(script.replace(/\}\);\s*\}\)\(\);\s*$/, 'globalThis.__t = { ...__selene };\n});\n})();'), context); // dans platform.ready
const t = context.__t, d = t.S();
const words = 'la lune le seuil une porte basse sorcière forêt nuit récit phalène dissociation soi symbole alchimie mercure spectre liminal transformation brouillard lichen mousse cendre miroir'.split(' ');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const vocab = Array.from({ length: 3000 }, (_, i) => 'mot' + i.toString(36) + 'é');
const phrase = n => Array.from({ length: n }, () => rnd() < 0.02 ? words[Math.floor(rnd() * words.length)] : vocab[Math.floor(rnd() * vocab.length)]).join(' ');
for (let i = 0; i < 4000; i++) d.modules.ecriture.scraps.push({ id: 'f' + i, text: phrase(40 + i % 30), date: `202${4 + i % 3}-0${1 + i % 9}-1${i % 9}` });
for (let i = 0; i < 1500; i++) d.modules.inbox.entries.push({ id: 'n' + i, text: phrase(15 + i % 20), date: '2026-09-01' });
// Un fragment sur trois dérive d'un fragment plus ancien ; un sur cinquante en contredit un autre.
d.modules.ecriture.scraps.forEach((f, i) => { if (i && i % 3 === 0) f.links = [{ id: 'l' + i, to: 'ecriture/f' + Math.floor(rnd() * i), type: i % 50 === 0 ? 'contredit' : 'derive', date: f.date }]; });
const arcInst = t.createFromTemplate(d.modules, t.MODULE_TEMPLATES.find(x => x.id === 'arc'), 'Arc', 'arc'); d.config.modules.push({ id: 'arc', on: true });
arcInst.config.stations.push(...Array.from({ length: 5 }, (_, i) => ({ id: 'st' + i, name: 'Étape ' + (i + 1) })));
d.modules.ecriture.scraps.slice(0, 800).forEach((f, i) => arcInst.entries.push({ id: 'pl' + i, station: 'st' + (i % 5), ref: 'ecriture/' + f.id, at: f.date }));
const m = t.createFromTemplate(d.modules, t.MODULE_TEMPLATES.find(x => x.id === 'motifs'), 'Motifs', 'motifs'); d.config.modules.push({ id: 'motifs', on: true });
for (let i = 0; i < 60; i++) t.saveCollectionItem(m, { title: words[i % words.length] + (i >= words.length ? i : ''), subtitle: i % 3 ? '' : 'miroir, mercure' }, 'm' + i);
const chars = [...d.modules.ecriture.scraps, ...d.modules.inbox.entries].reduce((a, x) => a + x.text.length, 0);
console.log('corpus', (chars / 1e6).toFixed(2), 'M caractères,', d.modules.ecriture.scraps.length + d.modules.inbox.entries.length, 'textes, 60 motifs');
// Taille du document site tel qu'il est écrit dans le stockage (UTF-16 dans localStorage : deux octets par unité).
// Repère : localStorage plafonne vers 5 Mo par origine ; au-delà de la moitié, passer à IndexedDB ou SQLite (phase 13).
const doc = JSON.stringify(d);
console.log('document site'.padEnd(28), (Buffer.byteLength(doc) / 1e6).toFixed(2), 'Mo en UTF-8,', (doc.length * 2 / 1e6).toFixed(2), 'Mo en UTF-16');
const LIMIT = Number(process.env.SELENE_BENCH_LIMIT || 150), results = [];
const time = (name, fn, n = 5) => {
  fn(); // chauffe
  const runs = Array.from({ length: n }, () => { const s = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - s) / 1e6; }).sort((a, b) => a - b);
  const ms = runs[Math.floor(n / 2)];
  results.push({ name, ms });
  console.log(name.padEnd(28), ms.toFixed(1).padStart(6), 'ms', ms > LIMIT ? `  ✗ au-delà de ${LIMIT} ms` : '');
};
time('accueil (render)', () => { context.location.hash = '#accueil'; t.render(); });
time('motifs (render)', () => { context.location.hash = '#motifs'; t.render(); });
time('arc (render)', () => { context.location.hash = '#arc'; t.render(); });
time('écriture (render)', () => { context.location.hash = '#ecriture'; t.render(); });
time('bilan (render)', () => { context.location.hash = '#bilan'; t.render(); });
time('planche (render)', () => { context.location.hash = '#bilan/planche'; t.render(); });
time('carte d’un motif (feuille)', () => t.SHEETS.carte(`motif:motifs/${d.modules.motifs.entries[0].id}`));
time('recherche « lune porte »', () => t.searchAll('lune porte'));

time('accueil, avec sortes (render)', () => { context.location.hash = '#accueil'; t.render(); });
time('sortesDraw() un tirage', () => t.sortesDraw());
const slow = results.filter(r => r.ms > LIMIT);
if (slow.length) { console.log(`\n✗ ${slow.length} mesure(s) au-delà de ${LIMIT} ms (médiane de cinq) : ${slow.map(r => r.name).join(', ')}`); process.exitCode = 1; }
else console.log(`\nToutes les mesures sous ${LIMIT} ms (médiane de cinq passages ; la plus lente : ${Math.max(...results.map(r => r.ms)).toFixed(1)} ms).`);
