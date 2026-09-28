/* Instagram (src/instagram.js) : réparer l'encodage de Meta, lire posts et reels, en faire des éléments de collection. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = {};
vm.runInNewContext(fs.readFileSync('src/instagram.js', 'utf8') + fs.readFileSync('src/domain.js', 'utf8') +
  '\n;globalThis.__i = { igFix, igPosts, igEntry, igDay, igValid };', ctx);
const I = ctx.__i;
// Ce que Meta écrit : les octets UTF-8 d'un texte, chacun pris pour un caractère Latin-1.
const moji = s => [...Buffer.from(s, 'utf8')].map(b => String.fromCharCode(b)).join('');

test('encodage : les octets de Meta retrouvent leur sens, un texte juste reste intact', () => {
  assert.equal(moji('é'), 'Ã©');
  assert.equal(I.igFix(moji('Déjà l’été 🌙 100 % lune')), 'Déjà l’été 🌙 100 % lune');
  assert.equal(I.igFix('Déjà l’été 🌙'), 'Déjà l’été 🌙'); // un caractère au-delà de U+00FF : déjà juste
  assert.equal(I.igFix('café'), 'café'); // Latin-1 authentique, sans suite d'octets UTF-8
  assert.equal(I.igFix('é»'), 'é»'); // ressemble à de l'UTF-8, n'en est pas : laissé tel quel
  assert.equal(I.igFix(null), '');
});

test('lecture : un seul média ou un carrousel, posts et reels, stories ignorées', () => {
  const posts = [
    { media: [{ uri: 'media/posts/202301/a.jpg', creation_timestamp: 1673000000, title: moji('Première lune\nd’hiver #moth') }] },
    { title: moji('Carrousel — trois papillons'), creation_timestamp: 1680000000, media: [{ uri: 'a', creation_timestamp: 1680000000, title: '' }, { uri: 'b' }, { uri: 'c' }] },
    { media: [{ uri: 'x' }] }, null
  ];
  const p = I.igPosts(posts);
  assert.equal(p.length, 2);
  assert.deepEqual({ ...p[0] }, { t: 1673000000, k: 'post', caption: 'Première lune\nd’hiver #moth', n: 1 });
  assert.deepEqual({ ...p[1] }, { t: 1680000000, k: 'post', caption: 'Carrousel — trois papillons', n: 3 });
  const r = I.igPosts({ ig_reels_media: [{ media: [{ uri: 'r.mp4', creation_timestamp: 1700000000, title: 'Un reel' }] }], ig_stories: [{ uri: 's', creation_timestamp: 1700000001, title: 'story' }] });
  assert.deepEqual([...r.map(x => x.k + ':' + x.caption)], ['reel:Un reel']);
  assert.deepEqual([...I.igPosts('rien')], []); assert.deepEqual([...I.igPosts({ autre: 3 })], []);
});

test('élément : la première ligne en titre, la légende en texte, le jour en date, l’origine validée', () => {
  const e = I.igEntry({ t: 1673000000, k: 'post', caption: '\n  Première lune\nd’hiver #moth', n: 1 });
  assert.equal(e.title, 'Première lune'); assert.equal(e.text, '\n  Première lune\nd’hiver #moth');
  assert.equal(e.due, I.igDay(1673000000)); assert.match(e.due, /^2023-01-0[67]$/);
  assert.equal(I.igEntry({ t: 1700000000, k: 'reel', caption: '', n: 1 }).title, `Reel du ${I.igDay(1700000000)}`);
  assert.equal(I.igEntry({ t: 1700000000, k: 'post', caption: 'x'.repeat(200), n: 1 }).title.length, 120);
  assert.equal(I.igEntry({ t: 1700000000, k: 'post', caption: 'Une seule ligne', n: 1 }).text, '', 'une ligne qui tient dans le titre : pas de doublon');
  assert.ok(I.igValid(e.ig));
  for (const bad of [{ t: 1.5, k: 'post' }, { t: 1, k: 'story' }, { t: -1, k: 'post' }, [], null]) assert.ok(!I.igValid(bad));
});
