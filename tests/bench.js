/* Banc de mesure (lancé à la main, pas en CI) : un historique réaliste de plusieurs années — 5 500 textes,
   ~2 millions de caractères, 60 motifs clairsemés —, puis le temps de rendu des vues qui parcourent tout
   (accueil, motifs, bilan) et d'une recherche. Usage : python3 build.py && node tests/bench.js
   Repère (ordinateur portable, 2026) : quelques dizaines de ms ; compter 3 à 5 fois plus sur téléphone. */
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const html = fs.readFileSync('selene.html', 'utf8'), script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const storage = new Map([['selene-site-v1', fs.readFileSync('tests/fixtures/site-demo.json', 'utf8')]]);
const nodes = new Map(), element = id => { if (!nodes.has(id)) nodes.set(id, { id, dataset: {}, value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {} }, addEventListener() {}, querySelectorAll() { return []; }, focus() {} }); return nodes.get(id); };
const context = { document: { title: '', activeElement: null, documentElement: { dataset: {} }, querySelector: element, getElementById: element, addEventListener() {} },
  window: { addEventListener() {}, claude: { use: async () => null } }, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k), key: i => [...storage.keys()][i] ?? null, get length() { return storage.size; } },
  location: { hash: '' }, navigator: {}, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval };
vm.runInNewContext(script.replace(/\}\)\(\);\s*$/, 'globalThis.__t = { S, render, createFromTemplate, MODULE_TEMPLATES, saveCollectionItem, searchAll, VIEWS };\n})();'), context);
const t = context.__t, d = t.S();
const words = 'la lune le seuil une porte basse sorcière forêt nuit récit phalène dissociation soi symbole alchimie mercure spectre liminal transformation brouillard lichen mousse cendre miroir'.split(' ');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const vocab = Array.from({ length: 3000 }, (_, i) => 'mot' + i.toString(36) + 'é');
const phrase = n => Array.from({ length: n }, () => rnd() < 0.02 ? words[Math.floor(rnd() * words.length)] : vocab[Math.floor(rnd() * vocab.length)]).join(' ');
for (let i = 0; i < 4000; i++) d.modules.ecriture.scraps.push({ id: 'f' + i, text: phrase(40 + i % 30), date: `202${4 + i % 3}-0${1 + i % 9}-1${i % 9}` });
for (let i = 0; i < 1500; i++) d.modules.inbox.entries.push({ id: 'n' + i, text: phrase(15 + i % 20), date: '2026-09-01' });
const m = t.createFromTemplate(d.modules, t.MODULE_TEMPLATES.find(x => x.id === 'motifs'), 'Motifs', 'motifs'); d.config.modules.push({ id: 'motifs', on: true });
for (let i = 0; i < 60; i++) t.saveCollectionItem(m, { title: words[i % words.length] + (i >= words.length ? i : ''), subtitle: i % 3 ? '' : 'miroir, mercure' }, 'm' + i);
const chars = [...d.modules.ecriture.scraps, ...d.modules.inbox.entries].reduce((a, x) => a + x.text.length, 0);
console.log('corpus', (chars / 1e6).toFixed(2), 'M caractères,', d.modules.ecriture.scraps.length + d.modules.inbox.entries.length, 'textes, 60 motifs');
const time = (name, fn, n = 3) => { fn(); const s = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(); console.log(name.padEnd(28), (Number(process.hrtime.bigint() - s) / 1e6 / n).toFixed(1), 'ms'); };
time('accueil (render)', () => { context.location.hash = '#accueil'; t.render(); });
time('motifs (render)', () => { context.location.hash = '#motifs'; t.render(); });
time('bilan (render)', () => { context.location.hash = '#bilan'; t.render(); });
time('recherche « lune porte »', () => t.searchAll('lune porte'));
