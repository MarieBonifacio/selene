/* Zotero (src/zotero.js) : ce que dit une clé, une fiche Zotero traduite en Source, la validation de `zot`. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = { URL };
vm.runInNewContext(fs.readFileSync('src/zotero.js', 'utf8') + fs.readFileSync('src/domain.js', 'utf8') + '\n;globalThis.__z = { zotKeyInfo, zotSource, zotItems, zotValid };', ctx);
const Z = ctx.__z;

test('clé : à qui, et si elle peut écrire', () => {
  assert.deepEqual({ ...Z.zotKeyInfo({ key: 'x', userID: 475425, username: 'marie', access: { user: { library: true, notes: true } } }) }, { userID: 475425, username: 'marie', library: true, write: false });
  assert.equal(Z.zotKeyInfo({ userID: 1, access: { user: { library: true, write: true } } }).write, true);
  assert.equal(Z.zotKeyInfo({ userID: 'x' }), null); assert.equal(Z.zotKeyInfo(null), null);
});

test('fiche : titre, auteurs, revue, date normalisée, DOI, lien vers la fiche ; pièces jointes écartées', () => {
  const item = { key: 'ABCD2345', links: { alternate: { href: 'https://www.zotero.org/marie/items/ABCD2345' } }, meta: { parsedDate: '2020-05-12' },
    data: { itemType: 'journalArticle', title: 'Depersonalization and the self', publicationTitle: 'Consciousness and Cognition', DOI: 'https://doi.org/10.1016/J.CONCOG.2020.102946',
      creators: [{ creatorType: 'author', firstName: 'Anna', lastName: 'Ciaunica' }, { creatorType: 'author', name: 'Collectif X' }, { creatorType: 'translator', lastName: 'Traductrice' }],
      date: 'May 12, 2020', abstractNote: 'Un   résumé.', url: 'javascript:alert(1)' } };
  const s = Z.zotSource(item);
  assert.deepEqual({ ...s, zot: { ...s.zot } }, { title: 'Depersonalization and the self', authors: 'Anna Ciaunica, Collectif X', site: 'Consciousness and Cognition', date: '2020-05-12',
    kind: 'article', doi: '10.1016/j.concog.2020.102946', url: 'https://doi.org/10.1016/j.concog.2020.102946', abstract: 'Un résumé.', zot: { k: 'ABCD2345', l: 'https://www.zotero.org/marie/items/ABCD2345' } });
  const web = Z.zotSource({ key: 'WXYZ6789', meta: { parsedDate: '2019' }, links: { alternate: { href: 'https://ailleurs.example/x' } }, data: { itemType: 'webpage', title: 'Une page', url: 'https://revue.example/a', websiteTitle: 'Revue' } });
  assert.equal(web.url, 'https://revue.example/a'); assert.equal(web.date, '2019'); assert.equal(web.kind, 'page'); assert.deepEqual({ ...web.zot }, { k: 'WXYZ6789' });
  assert.equal(Z.zotItems([item, { key: 'PDF12345', data: { itemType: 'attachment' } }, { key: 'bad', data: { itemType: 'book' } }, null]).length, 1);
  assert.deepEqual([...Z.zotItems({ pas: 'un tableau' })], []);
});

test('validation : une clé Zotero de huit caractères, un lien vers zotero.org seulement', () => {
  assert.ok(Z.zotValid({ k: 'ABCD2345' })); assert.ok(Z.zotValid({ k: 'ABCD2345', l: 'https://www.zotero.org/marie/items/ABCD2345' }));
  for (const bad of [{ k: 'abcd2345' }, { k: 'ABCD2345', l: 'javascript:alert(1)' }, { k: 'ABCD2345', l: 'https://evil.example/items/ABCD2345' }, [], null]) assert.ok(!Z.zotValid(bad));
});
