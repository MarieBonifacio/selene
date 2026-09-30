const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launchHosted, fakeSupabase, settle } = require('./hosted-harness');
const core = Promise.all([import('../src/core/regulation.js'), import('../src/core/sync.js'), import('../src/core/backup.js'), import('../src/core/domain.js')]).then(parts => Object.assign({}, ...parts));
const TODAY = '2026-09-30';
const base = c => {
  const inst = { type: 'regulation', label: 'Mon suivi', ...c.regulationDefaults() };
  c.addRegulationGoal(inst, { date: '2026-09-24', mode: 'reduire', limit: 5 }, 'g1', TODAY, 1);
  return inst;
};
const event = (c, inst, kind, id, extra = {}) => c.saveRegulationEvent(inst, { kind, date: TODAY, value: 2, strategy: 'Marcher', ...extra }, id, TODAY, 10, 'Europe/Paris');
const check = (c, inst, date = TODAY) => c.closeRegulationDay(inst, date, TODAY, 20, 'Europe/Paris');

test('aucune saisie ou une saisie partielle ne valent jamais zéro ni une réussite', async () => {
  const c = await core, inst = base(c);
  assert.equal(c.regulationDay(inst, TODAY).met, null);
  event(c, inst, 'use', 'u1');
  assert.equal(c.regulationDay(inst, TODAY).complete, false);
  check(c, inst);
  assert.equal(c.regulationDay(inst, TODAY).met, true);
  const p = c.regulationPeriod(inst, '2026-09-24', '2026-10-01');
  assert.equal(p.known, 1); assert.equal(p.unknown, 6); assert.equal(p.mean, 2);
  check(c, inst, '2026-09-29');
  assert.equal(c.regulationDay(inst, '2026-09-29').total, 0);
  assert.equal(c.regulationPeriod(inst, '2026-09-24', '2026-10-01').mean, 1);
});

test('ajout, modification ou suppression des quantités rouvrent une journée', async () => {
  const c = await core, inst = base(c);
  event(c, inst, 'use', 'u1'); check(c, inst);
  event(c, inst, 'use', 'u2'); assert.equal(c.regulationDay(inst, TODAY).reopened, true);
  check(c, inst); event(c, inst, 'use', 'u1', { value: 9 });
  assert.equal(c.regulationDay(inst, TODAY).met, null);
  check(c, inst); assert.equal(c.regulationDay(inst, TODAY).met, false);
  inst.entries = inst.entries.filter(e => e.id !== 'u2');
  assert.equal(c.regulationDay(inst, TODAY).complete, false);
});

test('une nouvelle cible ne réécrit pas les journées confirmées', async () => {
  const c = await core, inst = base(c);
  event(c, inst, 'use', 'u1'); check(c, inst);
  c.addRegulationGoal(inst, { date: TODAY, mode: 'arreter' }, 'g2', TODAY, 30);
  assert.equal(c.regulationGoal(inst, TODAY).limit, 0);
  assert.equal(c.regulationDay(inst, TODAY).goal.id, 'g1');
  assert.equal(c.regulationDay(inst, TODAY).met, true);
  check(c, inst); assert.equal(c.regulationDay(inst, TODAY).goal.id, 'g1');
});

test('observation, réduction et arrêt ; pas de seuil clinique ou de plan automatique', async () => {
  const c = await core;
  for (const subject of Object.keys(c.REGULATION_SUBJECTS)) {
    for (const mode of ['observer', 'reduire', 'arreter']) {
      const inst = { type: 'regulation', label: 'Suivi', ...c.regulationDefaults() }; inst.config.subject = subject;
      c.addRegulationGoal(inst, { date: TODAY, mode, limit: 5 }, 'g', TODAY, 1);
      event(c, inst, 'use', 'u', { value: subject === 'cannabis' ? 0.25 : 1 }); check(c, inst);
      assert.equal(c.regulationDay(inst, TODAY).met, mode === 'observer' ? null : mode === 'reduire');
    }
  }
});

test('dates locales et changement d’heure : sept dates, sans décalage UTC ni futur', async () => {
  const c = await core, inst = base(c);
  assert.equal(c.regulationPeriod(inst, '2026-10-23', '2026-10-30').days.length, 7);
  assert.throws(() => event(c, inst, 'use', 'u', { date: '2026-10-01' }), /date/);
  assert.throws(() => event(c, inst, 'use', 'u', { date: '2026-02-30' }), /date/);
  event(c, inst, 'action', 'a', { date: '2026-09-29' }); event(c, inst, 'action', 'b');
  assert.equal(c.regulationMarks(inst), 2);
  assert.equal(inst.entries[0].zone, 'Europe/Paris');
});

test('récompenses : une par date d’action, aucune pour une envie ou un écart, corrections honnêtes', async () => {
  const c = await core, inst = base(c);
  event(c, inst, 'urge', 'e1'); event(c, inst, 'use', 'u1');
  assert.equal(c.regulationMarks(inst), 0);
  event(c, inst, 'action', 'a1'); event(c, inst, 'action', 'a2');
  assert.equal(c.regulationMarks(inst), 1);
  event(c, inst, 'use', 'u2', { value: 20 }); check(c, inst);
  assert.equal(c.regulationDay(inst, TODAY).met, false); assert.equal(c.regulationMarks(inst), 1);
  inst.entries = inst.entries.filter(e => e.kind !== 'action'); assert.equal(c.regulationMarks(inst), 0);
});

test('deux appareils hors ligne : mêmes journées dédupliquées, nouvelles consommations non masquées', async () => {
  const c = await core, inst = base(c), b = { updatedAt: 1, modules: { x: inst } };
  const l = structuredClone(b), r = structuredClone(b); l.updatedAt = 30; r.updatedAt = 40;
  event(c, l.modules.x, 'action', 'a1'); check(c, l.modules.x);
  event(c, r.modules.x, 'action', 'a2'); event(c, r.modules.x, 'use', 'u1'); check(c, r.modules.x);
  let merged = c.mergeDocs(b, l, r).modules.x;
  assert.equal(c.regulationMarks(merged), 1);
  assert.equal(merged.entries.filter(e => e.kind === 'day').length, 1);
  assert.equal(c.regulationDay(merged, TODAY).total, 2);
  const next = structuredClone(r); event(c, next.modules.x, 'use', 'late', { value: 3 }); next.updatedAt = 50;
  merged = c.mergeDocs(r, { updatedAt: 45, modules: { x: merged } }, next).modules.x;
  assert.equal(c.regulationDay(merged, TODAY).complete, false);
  assert.equal(c.regulationDay(merged, TODAY).total, 5);
});

test('import : format valide, bornes, identifiants, unités et dates contrôlés', async () => {
  const c = await core, inst = base(c); event(c, inst, 'use', 'u1'); check(c, inst);
  const data = { format: 'selene-v1', board: { tasks: [] }, site: { schemaVersion: c.SCHEMA_VERSION, config: { modules: [{ id: 'suivi', on: true }] }, modules: { suivi: inst } } };
  assert.equal(c.parseBackup(JSON.stringify(data)).site.modules.suivi.entries.length, 2);
  for (const mutate of [
    d => { d.entries[0].value = -1; }, d => { d.entries[0].value = 1.5; },
    d => { d.entries[0].date = '2026-02-31'; }, d => { d.entries.push(d.entries[0]); },
    d => { d.goals[0].mode = 'miracle'; }, d => { d.config.rewardAt = 0; },
    d => { d.entries[1].goalId = 'missing'; }, d => { d.entries[0].kind = 'unknown'; }
  ]) {
    const bad = structuredClone(data); mutate(bad.site.modules.suivi);
    assert.throws(() => c.parseBackup(JSON.stringify(bad)));
  }
  assert.throws(() => event(c, inst, 'action', 'blank', { strategy: ' ' }));
});

test('la pause dépend de son échéance persistée et ne donne pas de récompense', async () => {
  const c = await core, inst = base(c); const e = event(c, inst, 'urge', 'e');
  e.pauseEnd = 301000;
  const reloaded = JSON.parse(JSON.stringify(inst));
  assert.equal(c.regulationRemaining(reloaded.entries[0].pauseEnd, 1000), 300);
  assert.equal(c.regulationRemaining(reloaded.entries[0].pauseEnd, 310000), 0);
  assert.equal(c.regulationMarks(reloaded), 0);
});

test('confidentialité : contenu, pont, analyses et notifications ; résumé IA seulement après opt-in', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  app.addModule({ type: 'regulation' }, 'Suivi privé');
  const id = 'suivi-prive', inst = app.S().modules[id];
  app.addRegulationGoal(inst, { date: app.todayISO(), mode: 'reduire', limit: 5 }, 'g', app.todayISO(), 1);
  app.saveRegulationEvent(inst, { kind: 'urge', date: app.todayISO(), note: 'CONFIDENTIEL_XYZ', strategy: 'SECRET_ABC' }, 'e', app.todayISO(), 2);
  inst.resume = { text: 'PONT_SECRET', at: app.todayISO() }; app.noteVisit(id);
  assert.equal(app.S().config.assistant.share[id], false);
  assert.doesNotMatch(app.contextText(), /Suivi privé|CONFIDENTIEL_XYZ|SECRET_ABC/);
  assert.equal(app.searchAll('CONFIDENTIEL_XYZ').length, 0);
  assert.doesNotMatch(app.VIEWS.accueil(), /CONFIDENTIEL_XYZ|SECRET_ABC|PONT_SECRET/);
  assert.doesNotMatch(app.VIEWS.bilan(), /CONFIDENTIEL_XYZ|SECRET_ABC/);
  assert.doesNotMatch(JSON.stringify(app.widgetData()), /Suivi privé|CONFIDENTIEL_XYZ/);
  assert.doesNotMatch(JSON.stringify(app.dayDigest(app.todayISO())), /Suivi privé|CONFIDENTIEL_XYZ/);
  const n = app.lunarTest().n; inst.entries.push({ ...inst.entries[0], id: 'e2' }); assert.equal(app.lunarTest().n, n);
  app.S().config.assistant.share[id] = true;
  assert.match(app.contextText(), /SUIVI PRIVÉ/);
  assert.doesNotMatch(app.contextText(), /CONFIDENTIEL_XYZ|SECRET_ABC/);
  app.site.disconnect(); app.board.disconnect();
});
