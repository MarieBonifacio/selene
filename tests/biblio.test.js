/* Les sources en BibTeX et en CSL-JSON (src/core/biblio.js) : auteurs, genres, clés, échappement, dates. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const B = require('../src/core/biblio.js');
const en = require('../src/app/i18n/en.js').default;

const article = { id: 'a1', title: 'The default mode network', subtitle: 'Marcus Raichle, Abraham Snyder, Jean de La Fontaine et al.', tag: 'article', text: 'Un résumé.',
  src: { url: 'https://doi.org/10.1038/nrn2575', doi: '10.1038/nrn2575', site: 'Nature Reviews Neuroscience', date: '2009-04' }, kept: '2026-09-28' };
const page = { id: 'p1', title: 'La lisière, 50 % & {plus}', subtitle: '', tag: 'page', text: '', src: { url: 'https://www.sousbois.fr/lisiere?id=4', site: 'Revue des sous-bois', date: '2026-09-01' }, kept: '2026-10-01' };

test('auteurs : virgules, « et », « ; », initiales rendues à leur nom, « et al. »', () => {
  assert.deepEqual(B.splitAuthors('Marcus Raichle, A B, C D et al.'), { names: ['Marcus Raichle', 'A B', 'C D'], others: true });
  assert.deepEqual(B.splitAuthors('Dupont, J., Martin, P.-L.'), { names: ['Dupont, J.', 'Martin, P.-L.'], others: false });
  assert.deepEqual(B.splitAuthors('Dupont, Jean; Martin, Paul'), { names: ['Dupont, Jean', 'Martin, Paul'], others: false });
  assert.deepEqual(B.splitAuthors('Ada Lovelace et Charles Babbage'), { names: ['Ada Lovelace', 'Charles Babbage'], others: false });
  assert.deepEqual(B.splitAuthors(''), { names: [], others: false });
  assert.deepEqual(B.parseName('Jean de La Fontaine'), { family: 'de La Fontaine', given: 'Jean' });
  assert.deepEqual(B.parseName('Marcus E. Raichle'), { family: 'Raichle', given: 'Marcus E.' });
  assert.deepEqual(B.parseName('Dupont, J.'), { family: 'Dupont', given: 'J.' });
  assert.deepEqual(B.parseName('UNESCO'), { literal: 'UNESCO' });
});

test('genre : l’étiquette reconnue en français ou en anglais, sinon aucun', () => {
  assert.equal(B.sourceKind('thèse'), 'thèse');
  assert.equal(B.sourceKind('Thesis', [en]), 'thèse');
  assert.equal(B.sourceKind('book', [en]), 'livre');
  assert.equal(B.sourceKind('Entry', [en]), 'notice');
  assert.equal(B.sourceKind('roman'), null);
  assert.equal(B.sourceKind(''), null);
});

test('BibTeX : type, champs, clé lisible, échappement, DOI sans adresse redondante', () => {
  const bib = B.sourcesBibtex([article, page, { ...article, id: 'a2' }]);
  assert.match(bib, /^@article\{raichle2009default,\n/);
  assert.match(bib, /author = \{Raichle, Marcus and Snyder, Abraham and de La Fontaine, Jean and others\}/);
  assert.match(bib, /title = \{The default mode network\}/);
  assert.match(bib, /journal = \{Nature Reviews Neuroscience\}/);
  assert.match(bib, /year = \{2009\},\n  month = apr,/);
  assert.match(bib, /doi = \{10\.1038\/nrn2575\}/);
  assert.doesNotMatch(bib.split('\n\n')[0], /url =|urldate/, 'l’adresse doi.org ne double pas le DOI');
  // La page : @misc, le site en howpublished, les caractères de LaTeX échappés, la date de consultation.
  assert.match(bib, /@misc\{lisiere2026,\n  title = \{La lisière, 50 \\% \\& \\\{plus\\\}\},\n  howpublished = \{Revue des sous-bois\},\n  year = \{2026\},\n  month = sep,\n  url = \{https:\/\/www\.sousbois\.fr\/lisiere\?id=4\},\n  urldate = \{2026-10-01\}\n\}/);
  assert.match(bib, /@article\{raichle2009defaultb,/, 'une clé déjà prise reçoit une lettre');
  assert.ok(bib.endsWith('}\n'));
  // Accolades équilibrées dans chaque entrée (hors accolades échappées) : sinon BibTeX perd la suite du fichier.
  for (const entry of bib.trim().split('\n\n')) {
    let depth = 0; for (const c of entry.replace(/\\[{}]/g, '')) { if (c === '{') depth++; if (c === '}') depth--; assert.ok(depth >= 0); }
    assert.equal(depth, 0, entry);
  }
  assert.equal(B.sourcesBibtex([]), '');
});

test('BibTeX : chaque genre a son type et le site sa place ; majuscules protégées dans le titre', () => {
  const one = (tag, extra = {}) => B.sourcesBibtex([{ title: 'Histoire de Paris', tag, subtitle: 'Anne Martin', src: { site: 'Lieu', date: '2020' }, ...extra }]);
  assert.match(one('livre'), /@book\{martin2020histoire,[\s\S]*publisher = \{Lieu\}/);
  assert.match(one('chapitre'), /@incollection\{[\s\S]*booktitle = \{Lieu\}/);
  assert.match(one('actes'), /@inproceedings\{[\s\S]*booktitle = \{Lieu\}/);
  assert.match(one('thèse'), /@phdthesis\{[\s\S]*school = \{Lieu\}/);
  assert.match(one('rapport'), /@techreport\{[\s\S]*institution = \{Lieu\}/);
  assert.match(one('vidéo'), /@misc\{[\s\S]*howpublished = \{Lieu\}/);
  assert.match(one('livre'), /title = \{Histoire de \{Paris\}\}/);
  assert.equal(B.sourcesBibtex([{ title: 'Sans auteur', subtitle: 'OMS' }]), '@misc{omssans,\n  author = {{OMS}},\n  title = {Sans auteur}\n}\n', 'une institution reste un seul nom');
  assert.equal(B.sourcesBibtex([{ title: '' }]), '@misc{source,\n}\n', 'une entrée vide reste lisible');
});

test('CSL-JSON : type, noms structurés, date en parties, consultation pour une page', () => {
  const [a, p] = JSON.parse(B.sourcesCslJson([article, page]));
  assert.deepEqual(a, { id: 'raichle2009default', type: 'article-journal', title: 'The default mode network',
    author: [{ family: 'Raichle', given: 'Marcus' }, { family: 'Snyder', given: 'Abraham' }, { family: 'de La Fontaine', given: 'Jean' }],
    'container-title': 'Nature Reviews Neuroscience', issued: { 'date-parts': [[2009, 4]] }, DOI: '10.1038/nrn2575', abstract: 'Un résumé.' });
  assert.deepEqual(p, { id: 'lisiere2026', type: 'webpage', title: 'La lisière, 50 % & {plus}', 'container-title': 'Revue des sous-bois',
    issued: { 'date-parts': [[2026, 9, 1]] }, URL: 'https://www.sousbois.fr/lisiere?id=4', accessed: { 'date-parts': [[2026, 10, 1]] } });
  const kinds = ['livre', 'chapitre', 'prépublication', 'actes', 'thèse', 'rapport', 'notice', 'vidéo', 'podcast', 'inconnu']
    .map(tag => B.sourcesCsl([{ title: 't', tag }])[0].type);
  assert.deepEqual(kinds, ['book', 'chapter', 'article', 'paper-conference', 'thesis', 'report', 'entry-encyclopedia', 'motion_picture', 'broadcast', 'document']);
});
