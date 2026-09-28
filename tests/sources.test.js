/* Sources (src/sources.js) : normaliser une adresse, reconnaître un DOI, traduire Crossref et Microlink. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = { URL };
vm.runInNewContext(fs.readFileSync('src/sources.js', 'utf8') + fs.readFileSync('src/domain.js', 'utf8') +
  '\n;globalThis.__s = { normalizeUrl, findDoi, findUrl, sourceKey, crossrefToSource, microlinkToSource, bareSource, srcValid, MODULE_TEMPLATES };', ctx);
const S = ctx.__s;

test('adresses : traceurs retirés, fragment oublié, deux liens vers la même page reconnus', () => {
  assert.equal(S.normalizeUrl('https://WWW.Exemple.org/article/?utm_source=x&id=4&fbclid=abc#section'), 'https://www.exemple.org/article/?id=4');
  assert.equal(S.normalizeUrl('https://exemple.org/a/'), 'https://exemple.org/a');
  assert.equal(S.normalizeUrl('https://exemple.org/'), 'https://exemple.org/');
  assert.equal(S.normalizeUrl('javascript:alert(1)'), null);
  assert.equal(S.normalizeUrl('pas une adresse'), null);
  assert.equal(S.sourceKey({ url: 'https://www.exemple.org/a?utm_medium=b' }), S.sourceKey({ url: 'http://exemple.org/a/' }));
  assert.equal(S.findUrl('lu ce matin : https://exemple.org/texte?utm_campaign=z. À relire'), 'https://exemple.org/texte');
});

test('DOI : dans un texte, dans une adresse, sans la ponctuation qui suit ; il prime sur l’adresse', () => {
  assert.equal(S.findDoi('voir 10.1038/NRN2575.'), '10.1038/nrn2575');
  assert.equal(S.findDoi('https://doi.org/10.1016%2Fj.concog.2020.102946'), '10.1016/j.concog.2020.102946');
  assert.equal(S.findDoi('(doi:10.1111/1468-5922.12345)'), '10.1111/1468-5922.12345');
  assert.equal(S.findDoi('rien ici'), null);
  assert.equal(S.sourceKey({ doi: '10.1038/NRN2575', url: 'https://a.b/c' }), 'doi:10.1038/nrn2575');
});

test('Crossref → source : titre, trois auteurs puis « et al. », revue, date partielle, résumé sans balises', () => {
  const s = S.crossrefToSource({
    DOI: '10.1038/NRN2575', type: 'journal-article', title: ['The default mode network'], 'container-title': ['Nature Reviews Neuroscience'],
    author: [{ given: 'Marcus', family: 'Raichle' }, { given: 'A', family: 'B' }, { given: 'C', family: 'D' }, { given: 'E', family: 'F' }],
    issued: { 'date-parts': [[2009, 4]] }, URL: 'http://dx.doi.org/10.1038/nrn2575', abstract: '<jats:p>Un  résumé <jats:italic>court</jats:italic>.</jats:p>'
  });
  assert.equal(s.title, 'The default mode network');
  assert.equal(s.authors, 'Marcus Raichle, A B, C D et al.');
  assert.equal(s.site, 'Nature Reviews Neuroscience'); assert.equal(s.date, '2009-04'); assert.equal(s.kind, 'article');
  assert.equal(s.doi, '10.1038/nrn2575'); assert.equal(s.url, 'https://doi.org/10.1038/nrn2575'); assert.equal(s.abstract, 'Un résumé court.');
  assert.ok(S.srcValid({ url: s.url, doi: s.doi, site: s.site, date: s.date }), 'ce qui est gardé passe la validation');
  const empty = S.crossrefToSource({}, '10.1/x');
  assert.equal(empty.title, '10.1/x'); assert.equal(empty.date, '');
});

test('Microlink → source, et sans réseau : l’adresse seule', () => {
  const m = S.microlinkToSource({ title: 'Une revue', author: 'X', publisher: 'La Revue', date: '2026-09-01T10:00:00Z', description: 'Desc', url: 'https://www.larevue.fr/a?utm_source=z' }, 'https://larevue.fr/a');
  assert.equal(m.url, 'https://www.larevue.fr/a'); assert.equal(m.date, '2026-09-01'); assert.equal(m.site, 'La Revue'); assert.equal(m.kind, 'page');
  const b = S.bareSource('https://www.larevue.fr/a', null);
  assert.equal(b.site, 'larevue.fr'); assert.equal(b.title, 'https://www.larevue.fr/a');
  assert.equal(S.bareSource(null, '10.1/x').url, 'https://doi.org/10.1/x');
});

test('validation : jamais un lien exécutable, un DOI et une date bien formés', () => {
  assert.equal(S.srcValid({ url: 'javascript:alert(1)' }), false);
  assert.equal(S.srcValid({ url: 'data:text/html,x' }), false);
  assert.equal(S.srcValid({ doi: 'pas-un-doi' }), false);
  assert.equal(S.srcValid({ date: '2009-4' }), false);
  assert.equal(S.srcValid([]), false);
  assert.equal(S.srcValid({}), true);
  assert.ok(S.MODULE_TEMPLATES.find(t => t.id === 'sources').config.sources, 'le modèle Sources existe');
});
