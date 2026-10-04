/* Venir d'Obsidian ou de Zettlr (src/core/markdown.js) : en-tête YAML, titre, date, statut, liens [[…]], tri. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const M = require('../src/core/markdown.js');

test('en-tête YAML : clés, guillemets, listes en ligne et en lignes ; sans en-tête, le texte tel quel', () => {
  const r = M.frontMatter('---\ntitle: "Le seuil"\nDate: 2023-10-04\ntags: [lecture, seuil]\naliases:\n  - Seuil\n  - "le seuil (Genette)"\n---\nCorps.');
  assert.deepEqual(r.data, { title: 'Le seuil', date: '2023-10-04', tags: ['lecture', 'seuil'], aliases: ['Seuil', 'le seuil (Genette)'] });
  assert.equal(r.body, 'Corps.');
  assert.deepEqual(M.frontMatter('Pas d’en-tête\n---\nx').data, {});
  assert.equal(M.frontMatter('﻿---\r\nstatus: hypothesis\r\n---\r\nB').data.status, 'hypothesis');
});

test('une note : titre (en-tête, puis « # », puis nom), corps sans le titre répété, date, statut', () => {
  const n = M.mdNote({ name: 'notes/2021-03-02 Lecture.md', text: '---\nstatut: hypothèse\n---\n# La lisière\n\nUn texte.\n\n\n\nSuite.', modified: Date.UTC(2026, 0, 1) });
  assert.equal(n.title, 'La lisière');
  assert.equal(n.text, 'La lisière\n\nUn texte.\n\nSuite.');
  assert.equal(n.date, '2021-03-02', 'la date du nom passe avant celle du fichier');
  assert.equal(n.ep, 'hyp');
  assert.deepEqual(n.keys, ['la lisiere', '2021-03-02 lecture']);
  assert.equal(M.mdNote({ name: 'Sans titre.md', text: 'Juste une ligne.' }).text, 'Sans titre\n\nJuste une ligne.');
  assert.equal(M.mdNote({ name: '202310041530 Idée.md', text: 'x' }).date, '2023-10-04', 'identifiant de Zettelkasten');
  assert.equal(M.mdNote({ name: 'a.md', text: '---\ncreated: 2022-12-31T10:00\n---\nx', modified: 1 }).date, '2022-12-31');
  assert.equal(M.mdNote({ name: 'a.md', text: 'x', modified: new Date(2024, 4, 6, 12).getTime() }).date, '2024-05-06', 'sinon, la date du fichier');
  assert.equal(M.mdNote({ name: 'a.md', text: 'x' }).date, null);
  assert.equal(M.mdNote({ name: '2023-02-30 faux.md', text: 'x' }).date, null, 'une date impossible n’est pas une date');
  for (const [v, ep] of [['observed', 'obs'], ['Interprétation', 'int'], ['inexpliqué', 'inx'], ['brouillon', null]]) assert.equal(M.mdNote({ name: 'a.md', text: `---\nstatus: ${v}\n---\nx` }).ep, ep, v);
  assert.equal(M.mdNote({ name: 'vide.md', text: '' }).title, 'vide');
});

test('liens [[…]] : l’alias ou la cible dans le texte, une image intégrée retirée, commentaires effacés', () => {
  const n = M.mdNote({ name: 'a.md', text: 'Voir [[Le seuil|ce texte]], [[dossier/Autre note#Partie]] et [[#Plus bas]].\n![[schema.png]]%% privé %%<!-- caché -->\nFin.' });
  assert.equal(n.text, 'a\n\nVoir ce texte, dossier/Autre note et Plus bas.\n\nFin.');
  assert.deepEqual(n.links, ['le seuil', 'autre note']);
  const long = M.mdNote({ name: 'l.md', text: 'x'.repeat(M.MD_NOTE_MAX + 50) });
  assert.ok(long.cut && long.text.length === M.MD_NOTE_MAX && long.text.endsWith('…'));
});

test('un coffre : Markdown seul, hors .obsidian et .trash, doublons écartés, ordre des dates, liens résolus', () => {
  const r = M.mdImport([
    { path: 'Coffre/B.md', text: '---\ndate: 2024-02-01\n---\nRenvoie à [[A]] et à [[inconnue]], deux fois [[A]].' },
    { path: 'Coffre/A.md', text: '---\ndate: 2024-01-01\naliases: [Alpha]\n---\nPremière, qui cite [[B]] et elle-même [[A]].' },
    { path: 'Coffre/C.md', text: 'Par l’alias : [[alpha]].', modified: Date.UTC(2024, 2, 1, 12) },
    { path: 'Coffre/A copie.md', text: '---\ndate: 2024-01-01\naliases: [Alpha]\n---\nPremière, qui cite [[B]] et elle-même [[A]].', name: 'A.md' },
    { path: 'Coffre/.obsidian/workspace.md', text: 'réglages' },
    { path: 'Coffre/.trash/vieux.md', text: 'jeté' },
    { path: 'Coffre/image.png', text: '' }
  ]);
  assert.deepEqual(r.notes.map(n => n.title), ['A', 'B', 'C']);
  assert.deepEqual(r.links, [[0, 1], [1, 0], [2, 0]], 'A↔B, C → A par son alias ; ni soi-même, ni inconnue, ni deux fois');
  assert.equal(r.skipped, 4);
  assert.deepEqual(M.mdImport([]), { notes: [], links: [], knownLinks: [], skipped: 0 });
  // Un lien vers une note déjà là (importée la fois d'avant : sa première ligne est son titre), sans la recréer.
  const k = M.mdImport([{ path: 'D.md', text: 'Suite de [[Le Seuil]] et de [[A]].' }], ['Autre chose', 'Le seuil\n\nTexte.']);
  assert.deepEqual(k.links, []);
  assert.deepEqual(k.knownLinks, [[0, 1]]);
});
