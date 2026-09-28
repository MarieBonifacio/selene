/* Research Watch (src/veille.js) : ce que l'on suit, la requête OpenAlex, la traduction des résultats. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = { URL };
vm.runInNewContext(fs.readFileSync('src/veille.js', 'utf8') + '\n;globalThis.__v = { oaWatch, oaUrl, oaAbstract, oaWorks };', ctx);
const V = ctx.__v;

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
