/* Musique (src/core/musique.js) : traduire MusicBrainz, choisir les albums studio, les parutions récentes, les pochettes. */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { mbValid, MODULE_TEMPLATES } = require('../src/core/domain.js');
const M = { ...require('../src/core/musique.js'), mbValid, MODULE_TEMPLATES };
const U = n => `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`.slice(-36);

test('recherche d’artiste : le nom entre guillemets, sans casser la syntaxe', () => {
  assert.equal(M.mbArtistQuery('Ulver'), 'artist:"Ulver"');
  assert.equal(M.mbArtistQuery('The "Cure"'), 'artist:"The \\"Cure\\""');
  const a = M.mbArtists({ artists: [{ id: U(1), name: 'Ulver', disambiguation: 'Norwegian band', country: 'NO', 'life-span': { begin: '1993-01' } }, { id: 'pas-un-id', name: 'X' }] });
  assert.equal(a.length, 1); assert.deepEqual({ ...a[0] }, { id: U(1), name: 'Ulver', note: 'Norwegian band', country: 'NO', begin: '1993' });
});

test('discographie : albums et EP studio seulement, du plus ancien au plus récent, sans doublon', () => {
  const al = M.mbAlbums({ 'release-groups': [
    { id: U(3), title: 'Liminal Animals', 'first-release-date': '2024-11-01', 'primary-type': 'Album', 'secondary-types': [] },
    { id: U(2), title: 'Bergtatt', 'first-release-date': '1995-02', 'primary-type': 'Album', 'secondary-types': [] },
    { id: U(4), title: 'Live at Roadburn', 'first-release-date': '2013', 'primary-type': 'Album', 'secondary-types': ['Live'] },
    { id: U(5), title: 'Un single', 'first-release-date': '2020', 'primary-type': 'Single', 'secondary-types': [] },
    { id: U(6), title: 'Sans date', 'primary-type': 'EP' },
    { id: U(2), title: 'Bergtatt', 'first-release-date': '1995-02', 'primary-type': 'Album', 'secondary-types': [] }
  ] });
  assert.deepEqual([...al.map(x => x.title)], ['Bergtatt', 'Liminal Animals', 'Sans date']);
  assert.equal(al[2].type, 'EP');
  assert.deepEqual([...M.mbSince(al, '2024-01-01').map(x => x.title)], ['Liminal Animals'], 'seules les parutions postérieures');
  assert.deepEqual([...M.mbSince(al, '1994-12-31').map(x => x.title)], ['Bergtatt', 'Liminal Animals'], 'une date partielle compte comme le premier jour');
});

test('pochettes et validation : un identifiant MusicBrainz ou rien', () => {
  assert.equal(M.coverUrl(U(2)), `https://coverartarchive.org/release-group/${U(2)}/front-250`);
  assert.equal(M.coverUrl('"><script>'), '');
  assert.equal(M.mbValid({ a: U(1), rg: U(2), y: '1995' }), true);
  assert.equal(M.mbValid({ a: U(1) }), true);
  assert.equal(M.mbValid({ a: 'x' }), false);
  assert.equal(M.mbValid({ a: U(1), y: '95' }), false);
  assert.ok(M.MODULE_TEMPLATES.find(t => t.id === 'musique').config.music, 'le modèle Musique existe');
});
