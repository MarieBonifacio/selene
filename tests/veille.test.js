/* Research Watch (src/core/veille.js) : ce que l'on suit, la requête OpenAlex, la traduction des résultats. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const V = require('../src/core/veille.js');
const plain = x => JSON.parse(JSON.stringify(x)); // compare la forme JSON des valeurs

test('ce que l’on suit : un ORCID, un identifiant OpenAlex, sinon une recherche', () => {
  assert.deepEqual({ ...V.oaWatch('https://orcid.org/0000-0002-1825-009x') }, { kind: 'author', q: '0000-0002-1825-009X', filter: 'author.orcid:0000-0002-1825-009X' });
  assert.deepEqual({ ...V.oaWatch('https://openalex.org/A5023888391') }, { kind: 'author', q: 'A5023888391', filter: 'author.id:A5023888391' });
  assert.deepEqual({ ...V.oaWatch('  default   mode network ') }, { kind: 'q', q: 'default mode network' });
  assert.equal(V.oaWatch(''), null); assert.equal(V.oaWatch('x'.repeat(201)), null);
});

test('requête : depuis une date, la plus récente d’abord, la clé seulement si elle existe', () => {
  const u = new URL(V.oaUrl({ kind: 'q', q: 'depersonalization & self' }, '2026-09-01', 'cle-perso'));
  assert.equal(u.origin + u.pathname, 'https://api.openalex.org/works');
  assert.equal(u.searchParams.get('search'), 'depersonalization & self');
  assert.equal(u.searchParams.get('filter'), 'from_publication_date:2026-09-01');
  assert.equal(u.searchParams.get('sort'), 'publication_date:desc');
  assert.equal(u.searchParams.get('api_key'), 'cle-perso');
  const a = new URL(V.oaUrl({ kind: 'author', q: 'A5023888391' }, '2026-09-01', ''));
  assert.equal(a.searchParams.get('filter'), 'author.id:A5023888391,from_publication_date:2026-09-01');
  assert.equal(a.searchParams.get('search'), null); assert.equal(a.searchParams.get('api_key'), null);
});

test('résultats : résumé remis en ordre, DOI, revue et auteurs ; le reste écarté', () => {
  assert.equal(V.oaAbstract({ self: [2], The: [0], bodily: [1], 'self.': [5], and: [3], the: [4] }), 'The bodily self and the self.');
  assert.equal(V.oaAbstract(null), '');
  const w = V.oaWorks({ results: [
    { id: 'https://openalex.org/W123', doi: 'https://doi.org/10.1016/J.CONCOG.2020.102946', title: 'Depersonalization <i>and</i> the self', publication_date: '2026-09-20', type: 'article',
      primary_location: { source: { display_name: 'Consciousness and Cognition' } }, authorships: [1, 2, 3, 4].map(i => ({ author: { display_name: 'A' + i } })), abstract_inverted_index: { Un: [0], résumé: [1] } },
    { id: 'https://openalex.org/W9', doi: null, title: 'Sans DOI', publication_date: 'bientôt' },
    { id: 'javascript:1', title: 'piège' }, null
  ] });
  assert.equal(w.length, 2);
  assert.equal(w[0].title, 'Depersonalization and the self'); assert.equal(w[0].link, 'https://doi.org/10.1016/j.concog.2020.102946');
  assert.equal(w[0].text, 'Consciousness and Cognition · A1, A2, A3 et al. — Un résumé');
  assert.deepEqual({ ...w[0].oa }, { doi: '10.1016/j.concog.2020.102946', day: '2026-09-20', site: 'Consciousness and Cognition', authors: 'A1, A2, A3 et al.', kind: 'article' });
  assert.equal(w[1].link, 'https://openalex.org/W9'); assert.equal(w[1].oa.day, '');
  assert.deepEqual([...V.oaWorks({ results: 'x' })], []);
});

test('cité par tes sources : les requêtes, par lots de cinquante, sans DOI douteux', () => {
  const dois = Array.from({ length: 60 }, (_, i) => `10.1000/x${i}`).concat(['10.1000/a|b', 'pas un doi']);
  const urls = V.oaRefsUrls(dois, 'k');
  assert.equal(urls.length, 2);
  const u = new URL(urls[0]);
  assert.equal(u.searchParams.get('filter').split('|').length, 50);
  assert.ok(u.searchParams.get('filter').startsWith('doi:10.1000/x0|'));
  assert.equal(u.searchParams.get('select'), 'id,doi,referenced_works,authorships');
  assert.equal(u.searchParams.get('api_key'), 'k');
  assert.ok(!urls.join().includes('a%7Cb'));
  assert.deepEqual(plain(V.oaTitlesUrls(['W1', 'javascript:x', 'W22']).map(x => new URL(x).searchParams.get('filter'))), ['openalex:W1|W22']);
});

test('cité par tes sources : une notice → identifiant, références, auteurs', () => {
  const r = V.oaRefs({ results: [
    { id: 'https://openalex.org/W10', doi: 'https://doi.org/10.1000/A', referenced_works: ['https://openalex.org/W1', 'https://openalex.org/W1', 'https://openalex.org/W2', 'bad'],
      authorships: [{ author: { id: 'https://openalex.org/A7', display_name: 'Anna <b>Ciaunica</b>' } }, { author: { id: 'x', display_name: 'Sans id' } }] },
    { id: 'https://openalex.org/W11', doi: null }, null, 'x'] });
  assert.deepEqual(plain(Object.keys(r)), ['10.1000/a']);
  assert.deepEqual(plain(r['10.1000/a']), { id: 'W10', refs: ['W1', 'W2'], authors: [{ id: 'A7', name: 'Anna Ciaunica' }] });
  assert.deepEqual(plain(V.oaRefs(null)), {});
});

test('cité par tes sources : références communes, couplage bibliographique, auteurs qui reviennent', () => {
  const works = {
    a: { id: 'W1', refs: ['W100', 'W101', 'W102', 'W2'], authors: [{ id: 'A1', name: 'Anna' }, { id: 'A1', name: 'Anna' }] },
    b: { id: 'W2', refs: ['W100', 'W101', 'W103'], authors: [{ id: 'A1', name: 'Anna' }, { id: 'A2', name: 'Bruno' }] },
    c: { id: 'W3', refs: ['W100', 'W1'], authors: [{ id: 'A2', name: 'Bruno' }, { id: 'A1', name: 'Anna' }] },
    d: { id: 'W4', refs: ['W1'], authors: [] }
  };
  const r = V.oaCoupling(works);
  assert.equal(r.known, 4);
  // W100 : cité par trois ; W101 : par deux ; W1 et W2 sont tes propres sources, pas des suggestions.
  assert.deepEqual(plain(r.common.map(x => [x.id, x.by.length])), [['W100', 3], ['W101', 2]]);
  assert.deepEqual(plain(r.pairs), [{ a: 'a', b: 'b', n: 2 }]);
  assert.deepEqual(plain(r.authors.map(a => [a.name, a.by.length])), [['Anna', 3], ['Bruno', 2]]);
  const none = V.oaCoupling({ a: { id: 'W1', refs: ['W9'], authors: [] }, b: { id: 'W2', refs: ['W8'], authors: [] } });
  assert.equal(none.common.length + none.pairs.length + none.authors.length, 0);
  assert.equal(V.oaCoupling(null).known, 0);
});
