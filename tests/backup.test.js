const { test } = require('node:test');
const assert = require('node:assert/strict');

// backup.js importe les règles de domain.js (forme des identifiants, dates).
const api = require('../src/core/backup.js');
const valid = () => ({ format: 'selene-v1', board: { updatedAt: 1, tasks: [
  { id: 'a', title: 'Velux', steps: [{ t: 'Devis', d: false }] }
] }, site: { updatedAt: 1, config: { modules: [{ id: 'chantier', on: true }] },
  budget: { entries: [], envelopes: [] }, inbox: { items: [] } } });

test('export v1 round trips without changing data', () => {
  const input = valid();
  const parsed = api.parseBackup(api.createBackup(input.board, input.site, '2026-09-24T00:00:00Z'));
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), { board: input.board, site: input.site });
});

test('malformed nested collections are rejected before import', () => {
  for (const mutate of [
    d => { d.board.tasks[0].steps = 'invalid'; },
    d => { d.site.budget.entries = {}; },
    d => { d.site.config.modules = [null]; },
    d => { d.site.inbox.items = ['text']; },
    d => { d.site.updatedAt = 'later'; },
    d => { d.format = 'selene-v2'; }
  ]) {
    const d = valid(); mutate(d);
    assert.throws(() => api.parseBackup(JSON.stringify(d)));
  }
});

test('older v1 backups with missing optional sections can be restored', () => {
  const d = valid();
  delete d.site.budget;
  delete d.site.config.modules;
  assert.equal(api.parseBackup(JSON.stringify(d)).board.tasks[0].title, 'Velux');
});

test('oversized backup is rejected', () => {
  assert.throws(() => api.parseBackup(' '.repeat(5_000_001)));
});

const programme = extra => ({ type: 'programme', label: 'Lecture', config: { unitLabel: 'min', start: null, weeks: 12, perWeek: 5, ...extra }, entries: [] });

test('hostile backups are rejected: markup in ids, absurd numbers, bad dates', () => {
  for (const mutate of [
    d => { d.site.config.modules.push({ id: '"><img src=x onerror=alert(1)>', on: true }); },
    d => { d.site.modules = { '"><svg onload=alert(1)>': programme() }; },
    d => { d.site.modules = { reglages: programme() }; },
    d => { d.site.modules = { lecture: programme({ weeks: 1e9 }) }; },
    d => { d.site.modules = { lecture: programme({ perWeek: '<b>5</b>' }) }; },
    d => { d.site.modules = { lecture: programme({ start: 'hier' }) }; },
    d => { d.site.modules = { lecture: { ...programme(), entries: [{ id: 'e1', date: '2026-13-45', value: 1 }] } }; },
    d => { d.site.modules = { lecture: { ...programme(), entries: [{ id: 'e1', date: '2026-01-02', value: 'NaN' }] } }; },
    d => { d.site.modules = { lecture: { ...programme(), entries: [{ date: '2026-01-02', value: 1 }] } }; },
    d => { d.site.modules = { r: { type: 'rappels', label: 'R', config: { subtitle: '', types: [{ id: 'x', label: 'X', every: -1 }] }, entries: [] } }; },
    d => { d.site.config.assistant = { share: { '<i>': true } }; },
    d => { d.site.budget.entries = [{ id: 'b', amount: 'beaucoup' }]; }
  ]) {
    const d = valid(); mutate(d);
    assert.throws(() => api.parseBackup(JSON.stringify(d)), undefined, JSON.stringify(d.site).slice(0, 120));
  }
});

test('a well-formed custom module still imports', () => {
  const d = valid();
  d.site.modules = { 'lecture-2': { ...programme({ start: '2026-01-05' }), entries: [{ id: 'e1', date: '2026-01-05', value: 30, note: '' }] } };
  assert.equal(api.parseBackup(JSON.stringify(d)).site.modules['lecture-2'].entries[0].value, 30);
});

test('a backup from a newer schema is refused with an explicit message', () => {
  const d = valid(); d.site.schemaVersion = 99;
  assert.throws(() => api.parseBackup(JSON.stringify(d)), /plus récente/);
});

test('un fichier refusé dit pourquoi : pas du JSON, pas une sauvegarde, contenu invalide, version trop récente', () => {
  const { errMsg } = require('../src/app/lib/labels.js');
  const refus = text => { try { api.parseBackup(text); } catch (e) { return e; } return assert.fail('un refus était attendu'); };
  const piege = valid(); piege.site.config.modules[0].id = 'x"><img src=x onerror=alert(1)>';
  const recente = valid(); recente.site.schemaVersion = 99;
  const cas = {
    'pas du JSON': [refus('{ceci n’est pas du json'), 'backup-not-json', /ne se lit pas comme une sauvegarde/],
    'du JSON qui n’est pas une sauvegarde': [refus('{"nom":"autre chose"}'), 'backup-format', /n'est pas une sauvegarde Selene/],
    'un contenu piégé (identifiant de module)': [refus(JSON.stringify(piege)), 'backup-invalid', /contenu de cette sauvegarde n'est pas valide/],
    'un contenu abîmé (tâches absentes)': [refus('{"format":"selene-v1","board":{"tasks":null},"site":{"config":{}}}'), 'backup-invalid', /contenu de cette sauvegarde n'est pas valide/],
    'une version plus récente': [refus(JSON.stringify(recente)), 'backup-too-new', /plus récente/]
  };
  for (const [what, [e, code, wording]] of Object.entries(cas)) { assert.equal(e.code, code, what); assert.match(errMsg(e), wording, what); }
  assert.equal(new Set(Object.values(cas).map(([e]) => errMsg(e))).size, 4, 'quatre causes distinctes, quatre phrases (le contenu abîmé et le contenu piégé n’en font qu’une)');
  for (const k of ['pas du JSON', 'du JSON qui n’est pas une sauvegarde', 'un contenu piégé (identifiant de module)', 'un contenu abîmé (tâches absentes)'])
    assert.match(errMsg(cas[k][0]), /Rien n'a été importé\./, `${k} : la personne sait que rien n'a changé`);
  // Le champ fautif ne s'affiche pas, il reste dans le message technique (journal, tests).
  const affiche = errMsg(cas['un contenu piégé (identifiant de module)'][0]);
  assert.doesNotMatch(affiche, /identifiant|module|<img/);
  assert.match(cas['un contenu piégé (identifiant de module)'][0].message, /Module : identifiant invalide/);
  assert.match(cas['un contenu abîmé (tâches absentes)'][0].message, /Tâches invalide/);
});

test('connexions externes : Dehors et le radar, validés comme le reste', () => {
  const ok = d => api.parseBackup(JSON.stringify(d)), feed = extra => ({ id: 'f1', url: 'https://revue.example/feed.xml', title: 'Revue', mod: 'ecriture', seen: 1, ...extra });
  const d = valid(); d.site.config.dehors = { feeds: [feed()], artists: true, artistsSeen: 5, research: [{ id: 'r1', kind: 'q', q: 'depersonalization', mod: 'ecriture', seen: 3 }, { id: 'r2', kind: 'author', q: 'A5023888391', name: 'Anna Ciaunica' }] }; d.site.config.radar = { words: 'poésie, jazz' };
  assert.doesNotThrow(() => ok(d));
  for (const mutate of [
    x => { x.site.config.dehors = { feeds: 'non' }; },
    x => { x.site.config.dehors = { feeds: [feed({ url: 'javascript:alert(1)' })] }; },
    x => { x.site.config.dehors = { feeds: [feed({ id: '<img>' })] }; },
    x => { x.site.config.dehors = { feeds: [feed({ seen: -1 })] }; },
    x => { x.site.config.dehors = { feeds: Array.from({ length: 101 }, (_, i) => feed({ id: 'f' + i })) }; },
    x => { x.site.config.dehors = { feeds: [], artists: 'oui' }; },
    x => { x.site.config.radar = { words: 'x'.repeat(301) }; },
    x => { x.site.config.dehors = { feeds: [], research: [{ id: 'r1', kind: 'rumeur', q: 'x' }] }; },
    x => { x.site.config.dehors = { feeds: [], research: [{ id: 'r1', kind: 'q', q: '' }] }; },
    x => { x.site.config.dehors = { feeds: [], research: [{ id: 'r1', kind: 'author', q: 'A1', name: { toString: 1 } }] }; },
    x => { x.site.config.dehors = { feeds: [], research: Array.from({ length: 31 }, (_, i) => ({ id: 'r' + i, kind: 'q', q: 'x' })) }; }
  ]) { const x = valid(); mutate(x); assert.throws(() => ok(x), /Configuration invalide/); }
});
