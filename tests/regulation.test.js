/* « Reprendre la main » (docs/regulation.md) : le noyau pur d'abord (horloge et date locale injectées), puis
   l'application assemblée (selene.html) pour ce que voient les autres surfaces : recherche, analyses, accueil, bilan,
   planche, assistant, widget, notifications. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = Promise.all([import('../src/core/regulation.js'), import('../src/core/sync.js'), import('../src/core/backup.js'), import('../src/core/domain.js')])
  .then(parts => Object.assign({}, ...parts));

const TODAY = '2026-09-30';
const fresh = c => ({ type: 'regulation', label: 'Mon suivi', ...c.regulationDefaults() });
/* Un suivi configuré : sujet, première version d'objectif (réduire à 5 par jour depuis le 24 septembre). */
const tracker = (c, subject = 'tabac', goal = { mode: 'reduire', limit: 5 }) => {
  const inst = fresh(c);
  c.setupRegulation(inst, { subject, date: '2026-09-24', ...goal }, 'g1', TODAY, 1);
  return inst;
};
const use = (c, inst, id, value = 2, date = TODAY, at = 10) => c.saveRegulationEvent(inst, { kind: 'use', date, value }, id, TODAY, at, 'Europe/Paris');
const confirm = (c, inst, date = TODAY, at = 20) => c.closeRegulationDay(inst, date, c.regulationSnapshot(inst, date), TODAY, at, 'Europe/Paris');
const backup = (c, inst) => JSON.stringify({ format: 'selene-v1', board: { tasks: [] }, site: { schemaVersion: c.SCHEMA_VERSION, config: { modules: [{ id: 'suivi', on: true }] }, modules: { suivi: inst } } });

/* ---------------- configuration, unités, intentions ---------------- */

test('un suivi naît sans sujet ; le sujet et la première version d’objectif se choisissent ensemble, puis le sujet est figé', async () => {
  const c = await core, inst = fresh(c);
  assert.equal(inst.config.subject, null);
  assert.deepEqual(inst.goals, []);
  assert.throws(() => use(c, inst, 'u'), { code: 'reg-setup' }, 'pas de saisie avant de savoir dans quelle unité');
  assert.throws(() => c.setupRegulation(inst, { subject: 'café', date: TODAY, mode: 'observer' }, 'g', TODAY, 1), { code: 'reg-subject' });
  c.setupRegulation(inst, { subject: 'cannabis', date: TODAY, mode: 'observer' }, 'g', TODAY, 1);
  assert.equal(inst.config.subject, 'cannabis');
  assert.deepEqual(inst.goals[0], { id: 'g', date: TODAY, at: 1, mode: 'observer', limit: null, subject: 'cannabis' });
  assert.throws(() => c.setupRegulation(inst, { subject: 'alcool', date: TODAY, mode: 'observer' }, 'g2', TODAY, 2), { code: 'reg-subject-locked' });
  assert.throws(() => c.addRegulationGoal(inst, { subject: 'alcool', date: TODAY, mode: 'observer' }, 'g3', TODAY, 3), { code: 'reg-subject-locked' }, 'aucun changement silencieux d’unité');
  assert.equal(inst.config.subject, 'cannabis');
});

test('les quatre sujets et les trois intentions : observer ne juge pas, réduire compare à la limite choisie, l’arrêt vise zéro', async () => {
  const c = await core;
  const amounts = { tabac: [1, 6], cannabis: [0.25, 3.5], alcool: [1.5, 6], reseaux: [30, 200] };
  for (const [subject, [small, big]] of Object.entries(amounts)) {
    const limit = { tabac: 5, cannabis: 1, alcool: 2, reseaux: 60 }[subject];
    for (const mode of ['observer', 'reduire', 'arreter']) {
      for (const [value, label] of [[small, 'petit'], [big, 'grand']]) {
        const inst = fresh(c);
        c.setupRegulation(inst, { subject, date: TODAY, mode, limit }, 'g', TODAY, 1);
        use(c, inst, 'u', value); confirm(c, inst);
        const d = c.regulationDay(inst, TODAY), expect = mode === 'observer' ? null : mode === 'reduire' ? value <= limit : false;
        assert.equal(d.met, expect, `${subject} ${mode} ${label}`);
        assert.equal(d.goal.mode, mode);
      }
    }
    const zero = fresh(c);
    c.setupRegulation(zero, { subject, date: TODAY, mode: 'arreter' }, 'g', TODAY, 1);
    confirm(c, zero);
    assert.equal(c.regulationDay(zero, TODAY).met, true, `${subject} : une journée confirmée à zéro atteint l’arrêt`);
  }
});

test('unités entières et décimales, valeurs invalides, non finies, négatives ou démesurées', async () => {
  const c = await core;
  const t = tracker(c, 'tabac'), ca = tracker(c, 'cannabis'), al = tracker(c, 'alcool'), rs = tracker(c, 'reseaux');
  assert.equal(use(c, ca, 'a', '0,25').value, 0.25, 'virgule décimale acceptée');
  assert.equal(use(c, ca, 'b', 0.1 + 0.2).value, 0.3, 'pas de flottant résiduel');
  assert.equal(use(c, al, 'c', '1.5').value, 1.5);
  assert.equal(c.regulationDay(ca, TODAY).total, 0.55);
  for (const [inst, bad] of [[t, 1.5], [t, 201], [ca, 0.001], [ca, 101], [al, 0.05], [rs, 1441], [rs, 2.5]])
    assert.throws(() => use(c, inst, 'x', bad), { code: 'reg-quantity' }, `${inst.config.subject} ${bad}`);
  for (const bad of ['', ' ', 'abc', '-1', '-0.5', '1e3', 'Infinity', 'NaN', NaN, Infinity, -1, 0, '0', null, '2,5,1', '+3'])
    assert.throws(() => use(c, t, 'x', bad), { code: 'reg-quantity' }, String(bad));
  assert.throws(() => c.saveRegulationEvent(t, { kind: 'use', date: TODAY }, 'x', TODAY, 1), { code: 'reg-quantity' }, 'quantité absente');
  use(c, rs, 'm1', 1000);
  assert.throws(() => use(c, rs, 'm2', 500), { code: 'reg-day-max' }, 'une journée n’a que 1440 minutes');
  use(c, rs, 'm1', 1200); // corriger la même saisie ne compte pas deux fois
  assert.equal(c.regulationDay(rs, TODAY).total, 1200);
  assert.ok(!t.entries.some(e => e.id === 'x'), 'rien d’enregistré après un refus');
});

test('dates impossibles et à venir refusées pour les événements ; une date d’effet d’objectif peut être à venir', async () => {
  const c = await core, inst = tracker(c);
  for (const date of ['2026-02-30', '2026-13-01', '30/09/2026', '', '2026-9-3', '2026-10-01'])
    assert.throws(() => use(c, inst, 'u', 1, date), { code: 'reg-date' }, date);
  assert.throws(() => c.saveRegulationEvent(inst, { kind: 'urge', date: '2026-10-01' }, 'e', TODAY, 1), { code: 'reg-date' });
  assert.throws(() => c.saveRegulationEvent(inst, { kind: 'action', date: '2027-01-01', strategy: 'Marcher' }, 'a', TODAY, 1), { code: 'reg-date' });
  assert.throws(() => c.closeRegulationDay(inst, '2026-10-01', '[]', TODAY, 1), { code: 'reg-date' }, 'on ne confirme pas demain');
  const g = c.addRegulationGoal(inst, { date: '2026-10-05', mode: 'arreter' }, 'g2', TODAY, 2);
  assert.equal(c.regulationGoal(inst, TODAY).id, 'g1', 'une version programmée ne s’applique pas avant sa date');
  assert.equal(c.regulationNextGoal(inst, TODAY).id, g.id);
  assert.equal(c.regulationGoal(inst, '2026-10-05').id, 'g2');
  assert.throws(() => c.addRegulationGoal(inst, { date: '2028-01-01', mode: 'arreter' }, 'g3', TODAY, 3), { code: 'reg-date' }, 'au plus un an d’avance');
  assert.throws(() => c.addRegulationGoal(inst, { date: TODAY, mode: 'reduire', limit: '' }, 'g4', TODAY, 4), { code: 'reg-limit' });
  assert.throws(() => c.addRegulationGoal(inst, { date: TODAY, mode: 'reduire', limit: 0 }, 'g5', TODAY, 5), { code: 'reg-limit' }, 'zéro : viser l’arrêt');
  assert.throws(() => c.addRegulationGoal(inst, { date: TODAY, mode: 'reduire', limit: 2.5 }, 'g6', TODAY, 6), { code: 'reg-limit' }, 'des cigarettes entières');
  assert.throws(() => c.addRegulationGoal(inst, { date: TODAY, mode: 'tout' }, 'g7', TODAY, 7), { code: 'reg-mode' });
});

test('minuit, fuseaux et changements d’heure : des dates locales, jamais reclassées', async () => {
  const c = await core, inst = fresh(c);
  c.setupRegulation(inst, { subject: 'tabac', date: '2026-01-05', mode: 'reduire', limit: 5 }, 'g1', TODAY, 1);
  // Passage à l'heure d'hiver (25 octobre 2026) et d'été (29 mars 2026) : sept dates distinctes et consécutives.
  for (const from of ['2026-10-22', '2026-03-26']) {
    const ds = c.regulationPeriod(inst, from, c.addDays(from, 7)).days.map(d => d.date);
    assert.equal(ds.length, 7); assert.equal(new Set(ds).size, 7);
    for (let i = 1; i < 7; i++) assert.equal(ds[i], c.nextDay(ds[i - 1]));
  }
  assert.equal(c.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(c.addDays('2028-03-01', -1), '2028-02-29');
  // Une saisie garde la date déclarée, quel que soit le fuseau (informatif) de l'appareil qui la relit.
  const e = c.saveRegulationEvent(inst, { kind: 'use', date: '2026-09-29', value: 1 }, 'late', TODAY, Date.UTC(2026, 8, 29, 22, 30), 'Europe/Paris');
  assert.equal(e.date, '2026-09-29'); assert.equal(e.zone, 'Europe/Paris');
  const moved = JSON.parse(JSON.stringify(inst)); // relu ailleurs, à New York ou à Tokyo : rien ne bouge
  assert.equal(c.regulationDay(moved, '2026-09-29').total, 1);
  assert.equal(c.regulationDay(moved, TODAY).total, 0);
  // La date locale du jour, dans l'interface (format.js) : minuit et changement d'heure, selon le fuseau du processus.
  const prev = process.env.TZ;
  try {
    const { iso, addDaysTo } = await import('../src/app/lib/format.js');
    process.env.TZ = 'Europe/Paris';
    assert.equal(iso(new Date('2026-03-28T23:30:00Z')), '2026-03-29', '00 h 30 à Paris, déjà le 29');
    assert.equal(iso(new Date('2026-10-24T22:30:00Z')), '2026-10-25');
    assert.equal(addDaysTo('2026-03-29', 1), '2026-03-30'); assert.equal(addDaysTo('2026-10-25', 1), '2026-10-26');
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(iso(new Date('2026-03-29T06:30:00Z')), '2026-03-28', 'encore la veille à Los Angeles');
    assert.equal(addDaysTo('2026-11-01', 1), '2026-11-02');
  } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; }
});

/* ---------------- journées inconnues, complètes, rouvertes ---------------- */

test('absence de données ≠ zéro : une journée n’est complète qu’après confirmation de ce qui a été vu', async () => {
  const c = await core, inst = tracker(c);
  let d = c.regulationDay(inst, TODAY);
  assert.deepEqual([d.complete, d.met, d.total], [false, null, 0], 'rien de noté : inconnue, pas zéro');
  use(c, inst, 'u1', 2);
  d = c.regulationDay(inst, TODAY);
  assert.deepEqual([d.complete, d.met], [false, null], 'partielle : ni abstinence ni réussite');
  confirm(c, inst);
  assert.deepEqual([c.regulationDay(inst, TODAY).complete, c.regulationDay(inst, TODAY).met], [true, true]);
  confirm(c, inst, '2026-09-29');
  assert.equal(c.regulationDay(inst, '2026-09-29').total, 0, 'zéro, mais confirmé');
  assert.equal(c.regulationDay(inst, '2026-09-29').met, true);
  const p = c.regulationPeriod(inst, '2026-09-24', '2026-10-01');
  assert.deepEqual([p.span, p.complete, p.incomplete, p.declared, p.mean, p.assessed, p.met], [7, 2, 5, 2, 1, 2, 2]);
  // Laisser inconnue : retirer la confirmation, sans autre effet.
  inst.entries = inst.entries.filter(e => e.id !== 'day-2026-09-29');
  assert.equal(c.regulationDay(inst, '2026-09-29').complete, false);
});

test('ajout, correction, suppression ou changement de date d’une quantité rouvrent la journée ; une note, non', async () => {
  const c = await core, inst = tracker(c);
  use(c, inst, 'u1', 2); confirm(c, inst);
  c.saveRegulationEvent(inst, { kind: 'use', date: TODAY, value: 2, note: 'après le café' }, 'u1', TODAY, 30);
  assert.equal(c.regulationDay(inst, TODAY).complete, true, 'retoucher une note ne rouvre rien');
  use(c, inst, 'u2', 1, TODAY, 40);
  assert.equal(c.regulationDay(inst, TODAY).reopened, true);
  confirm(c, inst, TODAY, 50);
  use(c, inst, 'u1', 9, TODAY, 60);
  assert.deepEqual([c.regulationDay(inst, TODAY).reopened, c.regulationDay(inst, TODAY).met], [true, null]);
  confirm(c, inst, TODAY, 70);
  assert.equal(c.regulationDay(inst, TODAY).met, false);
  inst.entries = inst.entries.filter(e => e.id !== 'u2');
  assert.equal(c.regulationDay(inst, TODAY).reopened, true, 'suppression');
  confirm(c, inst, TODAY, 80);
  use(c, inst, 'u1', 9, '2026-09-29', 90);
  assert.equal(c.regulationDay(inst, TODAY).reopened, true, 'déplacée vers la veille : le jour d’origine change');
});

test('la confirmation refuse un instantané qui n’est plus celui que la personne a vu', async () => {
  const c = await core, inst = tracker(c);
  use(c, inst, 'u1', 2);
  const seen = c.regulationSnapshot(inst, TODAY);
  use(c, inst, 'u2', 3); // arrivé par synchronisation pendant la boîte de confirmation
  assert.throws(() => c.closeRegulationDay(inst, TODAY, seen, TODAY, 5), { code: 'reg-day-changed' });
  assert.equal(c.regulationDay(inst, TODAY).complete, false, 'rien de validé en silence');
  assert.ok(!inst.entries.some(e => e.kind === 'day'));
  c.closeRegulationDay(inst, TODAY, c.regulationSnapshot(inst, TODAY), TODAY, 6);
  assert.equal(c.regulationDay(inst, TODAY).total, 5);
});

test('total quotidien : jamais additionné à ses propres saisies, refusé s’il est plus bas', async () => {
  const c = await core, inst = tracker(c, 'alcool', { mode: 'reduire', limit: 3 });
  use(c, inst, 'u1', 1.5);
  const top = c.saveRegulationTotal(inst, { date: TODAY, total: '4' }, 't1', TODAY, 20);
  assert.deepEqual([top.value, top.declared], [2.5, 4]);
  assert.equal(c.regulationDay(inst, TODAY).total, 4, 'le total déclaré, pas 1,5 + 4');
  assert.equal(c.saveRegulationTotal(inst, { date: TODAY, total: 4 }, 't2', TODAY, 21), null, 'même total : rien à ajouter');
  assert.throws(() => c.saveRegulationTotal(inst, { date: TODAY, total: 3 }, 't3', TODAY, 22), e => e.code === 'reg-total-below' && e.args.total === 3 && e.args.existing === 4);
  assert.equal(c.regulationDay(inst, TODAY).total, 4);
  assert.equal(c.saveRegulationTotal(inst, { date: '2026-09-29', total: 0 }, 't4', TODAY, 23), null, 'un total à zéro n’ajoute rien…');
  assert.equal(c.regulationDay(inst, '2026-09-29').complete, false, '… et ne confirme rien tout seul');
  const rs = tracker(c, 'reseaux');
  assert.throws(() => c.saveRegulationTotal(rs, { date: TODAY, total: 1500 }, 'x', TODAY, 1), { code: 'reg-quantity' });
});

/* ---------------- objectifs versionnés ---------------- */

test('objectifs versionnés : la journée confirmée garde le sien, la nouvelle cible ne réécrit rien', async () => {
  const c = await core, inst = tracker(c);
  use(c, inst, 'u1', 4); confirm(c, inst);
  c.addRegulationGoal(inst, { date: '2026-09-24', mode: 'reduire', limit: 3 }, 'g2', TODAY, 30);
  assert.equal(c.regulationGoal(inst, TODAY).id, 'g2', 'à date d’effet égale, la dernière version créée');
  assert.equal(c.regulationDay(inst, TODAY).goal.id, 'g1', 'la journée confirmée garde g1');
  assert.equal(c.regulationDay(inst, TODAY).met, true);
  use(c, inst, 'u2', 1, '2026-09-29'); confirm(c, inst, '2026-09-29');
  assert.equal(c.regulationDay(inst, '2026-09-29').goal.id, 'g2', 'une journée confirmée ensuite prend la version en vigueur');
  use(c, inst, 'u1', 5); confirm(c, inst, TODAY, 40);
  assert.equal(c.regulationDay(inst, TODAY).goal.id, 'g1', 'corriger puis reconfirmer ne change pas la cible du jour');
  assert.deepEqual(c.regulationGoalHistory(inst).map(g => g.id), ['g2', 'g1']);
  const before = JSON.stringify(inst.goals);
  c.addRegulationGoal(inst, { date: TODAY, mode: 'arreter' }, 'g3', TODAY, 50);
  assert.equal(JSON.stringify(inst.goals.slice(0, 2)), before, 'une version ajoutée n’en modifie aucune');
  assert.equal(c.regulationDay(inst, '2026-09-28').met, null, 'jour inconnu : pas de verdict, quelle que soit la cible');
  const p = c.regulationPeriod(inst, '2026-09-24', '2026-10-01');
  assert.deepEqual(p.goalChanges.map(g => g.id), ['g1', 'g2', 'g3']);
});

test('le début du suivi borne les périodes : rien d’antérieur ne compte comme inconnu ou échec', async () => {
  const c = await core, inst = fresh(c);
  c.setupRegulation(inst, { subject: 'tabac', date: '2026-09-28', mode: 'arreter' }, 'g', TODAY, 1);
  assert.equal(c.regulationStart(inst), '2026-09-28');
  const cur = c.regulationPeriod(inst, '2026-09-24', '2026-10-01'), prev = c.regulationPeriod(inst, '2026-09-17', '2026-09-24');
  assert.equal(cur.span, 3); assert.equal(cur.incomplete, 3);
  assert.equal(prev.span, 0, 'la semaine précédente n’existe pas encore');
  use(c, inst, 'old', 3, '2026-09-25'); // une saisie antérieure au premier objectif étend le suivi…
  assert.equal(c.regulationStart(inst), '2026-09-25');
  confirm(c, inst, '2026-09-25');
  assert.equal(c.regulationDay(inst, '2026-09-25').met, null, '… sans objectif à juger ce jour-là');
});

test('comparaison de deux périodes : seulement si les couvertures sont suffisantes et voisines', async () => {
  const c = await core;
  const p = n => ({ complete: n });
  assert.deepEqual(c.regulationComparable(p(5), p(6)), { ok: true, reason: '' });
  assert.equal(c.regulationComparable(p(3), p(7)).reason, 'few');
  assert.equal(c.regulationComparable(p(4), p(7)).reason, 'uneven');
  assert.equal(c.regulationComparable(p(7), p(4)).reason, 'uneven');
});

/* ---------------- envies, appuis, actions, marques ---------------- */

test('envie : jamais un échec ni une marque ; choisir un appui n’est pas l’avoir fait ; « je l’ai fait » ne compte qu’une fois', async () => {
  const c = await core, inst = tracker(c);
  const u = c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY, intensity: '7', note: 'après le repas', strategy: 'Marcher quelques minutes', outcome: '' }, 'e1', TODAY, 5);
  assert.equal(u.intensity, 7);
  assert.equal(c.regulationMarks(inst), 0, 'une envie, même avec un appui choisi, ne donne rien');
  assert.equal(c.regulationDay(inst, TODAY).met, null);
  for (const bad of ['11', '-1', '3.5', 'fort']) assert.throws(() => c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY, intensity: bad }, 'e2', TODAY, 6), { code: 'reg-intensity' }, bad);
  assert.equal(c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY, intensity: '' }, 'e3', TODAY, 6).intensity, null);
  assert.throws(() => c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY, outcome: 'magique' }, 'e4', TODAY, 6), { code: 'reg-entry' });
  const a = c.markUrgeDone(inst, 'e1', TODAY, 7);
  assert.equal(a.id, c.urgeActionId('e1')); assert.equal(a.urge, 'e1'); assert.equal(a.strategy, 'Marcher quelques minutes');
  assert.equal(c.markUrgeDone(inst, 'e1', TODAY, 8), a, 'double appui : une seule action');
  assert.equal(inst.entries.filter(e => e.kind === 'action').length, 1);
  assert.equal(c.regulationMarks(inst), 1);
  assert.throws(() => c.markUrgeDone(inst, 'e3', TODAY, 9), { code: 'required' }, 'sans appui choisi, rien à déclarer réalisé');
  assert.throws(() => c.markUrgeDone(inst, 'absente', TODAY, 9), { code: 'reg-missing' });
  const sup = c.regulationSupports(inst, '2026-09-01', '2026-10-01');
  assert.deepEqual(sup[0], { strategy: 'Marcher quelques minutes', chosen: 1, done: 1, utile: 0, neutre: 0, difficile: 0 });
});

test('marques : une par date d’action ; ni envie, ni consommation, ni pause ; un écart ne retire rien ; une correction, si', async () => {
  const c = await core, inst = tracker(c);
  c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY }, 'e', TODAY, 1);
  c.startRegulationPause(inst, 'e', 1000);
  use(c, inst, 'u1', 1);
  assert.equal(c.regulationMarks(inst), 0);
  for (const [id, date] of [['a1', TODAY], ['a2', TODAY], ['a3', '2026-09-28']]) c.saveRegulationEvent(inst, { kind: 'action', date, strategy: 'Dessiner' }, id, TODAY, 2);
  assert.equal(c.regulationMarks(inst), 2, 'deux actions le même jour : une marque');
  use(c, inst, 'u2', 20); confirm(c, inst);
  assert.equal(c.regulationDay(inst, TODAY).met, false);
  assert.equal(c.regulationMarks(inst), 2, 'un écart ne retire aucune marque');
  inst.config.reward = 'Une soirée cinéma'; inst.config.rewardAt = 3;
  let p = c.regulationProgress(inst);
  assert.deepEqual([p.marks, p.next, p.reward.reached, p.reward.left], [2, 3, false, 1]);
  assert.deepEqual(p.milestones.map(m => m.reached), [true, false, false, false, false]);
  inst.entries = inst.entries.filter(e => e.id !== 'a3'); // une action notée par erreur
  assert.equal(c.regulationMarks(inst), 1);
  assert.throws(() => c.saveRegulationEvent(inst, { kind: 'action', date: TODAY, strategy: '  ' }, 'blank', TODAY, 3), { code: 'required' });
  assert.deepEqual(c.REGULATION_MILESTONES, [1, 3, 7, 14, 30]);
  for (let i = 0; i < 40; i++) c.saveRegulationEvent(inst, { kind: 'action', date: c.addDays('2026-08-01', i), strategy: 'Dessiner' }, `b${i}`, TODAY, 4);
  p = c.regulationProgress(inst);
  assert.equal(p.next, null); assert.ok(p.milestones.every(m => m.reached));
});

test('appuis et récompense : une action par ligne, sans doublon ; seuil borné ; récompenses masquées par défaut', async () => {
  const c = await core, inst = tracker(c);
  assert.equal(inst.config.rewards, false);
  c.setRegulationPlan(inst, { supports: 'Marcher\n  Dessiner \nMarcher\n\n' + 'x'.repeat(300), rewards: true, reward: ' Un livre ', rewardAt: '14' });
  assert.deepEqual(inst.config.supports, ['Marcher', 'Dessiner', 'x'.repeat(120)]);
  assert.deepEqual([inst.config.rewards, inst.config.reward, inst.config.rewardAt], [true, 'Un livre', 14]);
  for (const bad of ['0', '366', '2.5', 'beaucoup']) assert.throws(() => c.setRegulationPlan(inst, { supports: '', rewardAt: bad }), { code: 'reg-reward' });
});

test('pause de cinq minutes : échéance persistée, recalculée au retour, interrompue sans trace ni récompense', async () => {
  const c = await core, inst = tracker(c);
  c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY, strategy: 'Marcher' }, 'e', TODAY, 1);
  c.startRegulationPause(inst, 'e', 1_000_000);
  const reloaded = JSON.parse(JSON.stringify(inst)); // rechargement, veille, autre appareil
  assert.equal(c.regulationPause(reloaded, 1_000_000).left, 300);
  assert.equal(c.regulationPause(reloaded, 1_000_000 + 299_500).left, 1);
  assert.equal(c.regulationPause(reloaded, 1_000_000 + 300_000).left, 0, 'échue : affichée « terminée »…');
  assert.equal(c.regulationPause(reloaded, 1_000_000 + 300_000 + c.REGULATION_PAUSE_LINGER_MS), null, '… puis disparaît d’elle-même');
  assert.equal(c.regulationMarks(reloaded), 0, 'une pause achevée ne donne rien');
  c.stopRegulationPause(inst, 'e');
  assert.equal(inst.entries.find(e => e.id === 'e').pauseEnd, null);
  assert.equal(c.regulationPause(inst, 1_000_100), null);
  assert.throws(() => c.startRegulationPause(inst, 'absente', 1), { code: 'reg-missing' });
  const u = c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY, strategy: 'Marcher', outcome: 'utile' }, 'e', TODAY, 2);
  assert.equal(u.pauseEnd, null, 'modifier une envie garde son état de pause');
});

test('corrections : identifiant, instant de saisie et type conservés ; correction datée à part', async () => {
  const c = await core, inst = tracker(c);
  use(c, inst, 'u1', 2, TODAY, 100);
  const e = use(c, inst, 'u1', 3, '2026-09-29', 200);
  assert.deepEqual([e.id, e.at, e.editedAt, e.zone, e.value, e.date], ['u1', 100, 200, 'Europe/Paris', 3, '2026-09-29']);
  assert.equal(inst.entries.length, 1, 'une correction, pas une copie');
  assert.throws(() => c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY }, 'u1', TODAY, 300), { code: 'reg-entry' }, 'le type d’une entrée ne change pas');
});

/* ---------------- synchronisation et sauvegardes ---------------- */

test('deux appareils hors ligne : marques dédupliquées, confirmation unique, quantité tardive qui rouvre la journée', async () => {
  const c = await core, inst = tracker(c), base = { updatedAt: 1, modules: { x: inst } };
  const a = structuredClone(base), b = structuredClone(base); a.updatedAt = 30; b.updatedAt = 40;
  c.saveRegulationEvent(a.modules.x, { kind: 'action', date: TODAY, strategy: 'Marcher' }, 'a1', TODAY, 5);
  confirm(c, a.modules.x);
  c.saveRegulationEvent(b.modules.x, { kind: 'action', date: TODAY, strategy: 'Dessiner' }, 'a2', TODAY, 6);
  use(c, b.modules.x, 'u1', 2); confirm(c, b.modules.x);
  let m = c.mergeDocs(base, a, b).modules.x;
  assert.equal(c.regulationMarks(m), 1, 'deux actions le même jour, sur deux appareils : une marque');
  assert.equal(m.entries.filter(e => e.kind === 'day').length, 1, 'une seule confirmation par date');
  assert.equal(c.regulationDay(m, TODAY).total, 2);
  // L'appareil A avait confirmé « 0 » sans voir la consommation de B : la fusion ne doit pas en faire un faux zéro.
  const zeroA = structuredClone(base); zeroA.updatedAt = 50; confirm(c, zeroA.modules.x);
  const useB = structuredClone(base); useB.updatedAt = 45; use(c, useB.modules.x, 'u9', 3);
  m = c.mergeDocs(base, zeroA, useB).modules.x;
  assert.equal(c.regulationDay(m, TODAY).total, 3);
  assert.equal(c.regulationDay(m, TODAY).complete, false, 'la confirmation de A ne couvre pas ce que B a noté');
  assert.equal(c.regulationDay(m, TODAY).reopened, true);
  // Suppression d'un côté, confirmation de l'autre (qui comptait la saisie) : la journée se rouvre aussi.
  const withUse = structuredClone(base); use(c, withUse.modules.x, 'u5', 1); withUse.updatedAt = 60;
  const del = structuredClone(withUse); del.modules.x.entries = del.modules.x.entries.filter(e => e.id !== 'u5'); del.updatedAt = 70;
  const conf = structuredClone(withUse); confirm(c, conf.modules.x); conf.updatedAt = 65;
  m = c.mergeDocs(withUse, del, conf).modules.x;
  assert.equal(c.regulationDay(m, TODAY).total, 0); assert.equal(c.regulationDay(m, TODAY).complete, false);
  // Une même envie marquée « faite » sur deux appareils : un seul identifiant, une seule action.
  c.saveRegulationEvent(base.modules.x, { kind: 'urge', date: TODAY, strategy: 'Marcher' }, 'e1', TODAY, 1);
  const d1 = structuredClone(base), d2 = structuredClone(base); d1.updatedAt = 80; d2.updatedAt = 81;
  c.markUrgeDone(d1.modules.x, 'e1', TODAY, 2); c.markUrgeDone(d2.modules.x, 'e1', TODAY, 3);
  m = c.mergeDocs(base, d1, d2).modules.x;
  assert.equal(m.entries.filter(e => e.kind === 'action').length, 1);
});

test('deux appareils qui commencent le même suivi avec deux sujets : la fusion le signale, et la sauvegarde reste restaurable', async () => {
  const c = await core, base = { updatedAt: 1, modules: { x: fresh(c) } };
  const a = structuredClone(base), b = structuredClone(base); a.updatedAt = 10; b.updatedAt = 20;
  c.setupRegulation(a.modules.x, { subject: 'cannabis', date: TODAY, mode: 'observer' }, 'ga', TODAY, 1); use(c, a.modules.x, 'ua', 0.25);
  c.setupRegulation(b.modules.x, { subject: 'tabac', date: TODAY, mode: 'observer' }, 'gb', TODAY, 2); use(c, b.modules.x, 'ub', 3);
  const m = c.mergeDocs(base, a, b).modules.x;
  assert.equal(c.regulationSubjectConflict(m), true, 'pas de réinterprétation silencieuse');
  assert.doesNotThrow(() => c.parseBackup(backup(c, m)), 'un état atteint par fusion se restaure');
});

test('sauvegardes : un suivi complet se restaure ; un import invalide est refusé champ par champ', async () => {
  const c = await core, inst = tracker(c);
  use(c, inst, 'u1', 2); confirm(c, inst);
  c.saveRegulationEvent(inst, { kind: 'urge', date: TODAY, strategy: 'Marcher', intensity: 4 }, 'e1', TODAY, 3);
  c.markUrgeDone(inst, 'e1', TODAY, 4); c.startRegulationPause(inst, 'e1', 5);
  c.saveRegulationTotal(inst, { date: '2026-09-29', total: 3 }, 't1', TODAY, 6);
  const restored = c.parseBackup(backup(c, inst)).site.modules.suivi;
  assert.deepEqual(restored, inst);
  assert.doesNotThrow(() => c.parseBackup(backup(c, fresh(c))), 'un suivi pas encore configuré se sauvegarde aussi');
  const mutations = {
    'quantité négative': d => { d.entries[0].value = -1; }, 'quantité nulle': d => { d.entries[0].value = 0; },
    'quantité non finie': d => { d.entries[0].value = '1e999'; }, 'date impossible': d => { d.entries[0].date = '2026-02-31'; },
    'identifiant dupliqué': d => { d.entries.push({ ...d.entries[0] }); }, 'identifiant objectif/entrée': d => { d.entries[0].id = d.goals[0].id; },
    'intention inconnue': d => { d.goals[0].mode = 'miracle'; }, 'limite d’arrêt non nulle': d => { d.goals[0].mode = 'arreter'; },
    'limite d’observation': d => { d.goals[0].mode = 'observer'; }, 'seuil de récompense': d => { d.config.rewardAt = 0; },
    'sujet inconnu': d => { d.config.subject = 'café'; }, 'appuis': d => { d.config.supports = 'Marcher'; },
    'confirmation sans objectif connu': d => { d.entries.find(e => e.kind === 'day').goalId = 'absent'; },
    'confirmation mal nommée': d => { d.entries.find(e => e.kind === 'day').id = 'day-2026-09-01'; },
    'type d’entrée': d => { d.entries[0].kind = 'autre'; }, 'intensité': d => { d.entries.find(e => e.kind === 'urge').intensity = 11; },
    'retour': d => { d.entries.find(e => e.kind === 'urge').outcome = 'génial'; }, 'action vide': d => { d.entries.find(e => e.kind === 'action').strategy = ' '; },
    'pause': d => { d.entries.find(e => e.kind === 'urge').pauseEnd = 'bientôt'; }, 'objectifs absents': d => { d.goals = null; },
    'note trop longue': d => { d.entries[0].note = 'x'.repeat(2001); }
  };
  for (const [what, mutate] of Object.entries(mutations)) {
    const bad = JSON.parse(backup(c, inst)); mutate(bad.site.modules.suivi);
    assert.throws(() => c.parseBackup(JSON.stringify(bad)), undefined, what);
  }
  const future = JSON.parse(backup(c, inst)); future.site.schemaVersion = c.SCHEMA_VERSION + 1;
  assert.throws(() => c.parseBackup(JSON.stringify(future)), { code: 'backup-too-new' });
  assert.equal(c.SCHEMA_VERSION, 8);
});

/* ---------------- l'application assemblée : confidentialité de chaque surface ---------------- */

function launch(storage = new Map()) {
  const script = fs.readFileSync('selene.html', 'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  if (!storage.has('selene-site-v1')) storage.set('selene-site-v1', fs.readFileSync('tests/fixtures/site-demo.json', 'utf8'));
  const nodes = new Map(), handlers = {};
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, { id, dataset: {}, value: '', textContent: '', innerHTML: '', style: {}, returnValue: '',
      classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, querySelectorAll() { return []; }, focus() {}, showModal() {} });
    return nodes.get(id);
  };
  const document = { title: '', activeElement: null, documentElement: { dataset: {} }, hidden: false, querySelector: element, getElementById: element,
    addEventListener(name, fn) { (handlers[name] = handlers[name] || []).push(fn); } };
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k),
    key: i => [...storage.keys()][i] ?? null, get length() { return storage.size; } };
  const location = { hash: '' };
  const context = { document, window: { addEventListener() {}, claude: null }, localStorage, location, navigator: {}, console, Date, Math, Intl,
    setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; }, clearTimeout, setInterval, clearInterval };
  vm.runInNewContext(script.replace(/\}\);\s*\}\)\(\);\s*$/, 'globalThis.__test = { ...__selene };\n});\n})();'), context);
  const fire = (name, target) => (handlers[name] || []).forEach(fn => fn({ target, preventDefault() {} }));
  return { ...context.__test, nodes, location, storage, fire };
}
/* Le dialogue de confirmation simulé : ok ou annuler. */
const answer = (app, ok) => { const d = app.nodes.get('#cdlg') || app.$('#cdlg'); d.returnValue = ok ? 'ok' : 'cancel'; d.onclose(); };
const SECRET = ['CONFIDENTIEL_XYZ', 'SECRET_ABC', 'PONT_SECRET', 'RECOMPENSE_SECRETE'];
const leaks = text => SECRET.filter(s => String(text).includes(s));

function privateTracker(app, name = 'Suivi privé') {
  const tpl = app.localTemplate(app.MODULE_TEMPLATES.find(t => t.id === 'regulation'));
  app.addModule(tpl, name);
  const id = app.S().config.modules[app.S().config.modules.length - 1].id, inst = app.S().modules[id], today = app.todayISO();
  app.setupRegulation(inst, { subject: 'alcool', date: app.addDaysTo(today, -20), mode: 'reduire', limit: 2 }, 'g', today, 1);
  for (let i = 0; i < 20; i++) {
    const date = app.addDaysTo(today, -i);
    app.saveRegulationEvent(inst, { kind: 'use', date, value: 1.5, note: `CONFIDENTIEL_XYZ jour ${i}` }, `u${i}`, today, 2);
    app.saveRegulationEvent(inst, { kind: 'urge', date, note: 'CONFIDENTIEL_XYZ déclencheur', strategy: 'SECRET_ABC', outcome: 'utile' }, `e${i}`, today, 3);
    app.saveRegulationEvent(inst, { kind: 'action', date, strategy: 'SECRET_ABC', note: 'CONFIDENTIEL_XYZ' }, `a${i}`, today, 4);
  }
  inst.config.supports = ['SECRET_ABC']; inst.config.reward = 'RECOMPENSE_SECRETE'; inst.config.rewards = true;
  inst.resume = { text: 'PONT_SECRET', at: today };
  app.site.save();
  return { id, inst };
}

test('partage avec l’assistant désactivé à la création, depuis le modèle comme depuis un type vide', () => {
  const app = launch();
  const { id } = privateTracker(app);
  assert.equal(app.S().config.assistant.share[id], false);
  app.addModule({ type: 'regulation' }, 'Type vide');
  const empty = app.S().config.modules.find(m => app.label(m.id) === 'Type vide').id;
  assert.equal(app.S().config.assistant.share[empty], false);
  app.addModule({ type: 'notes' }, 'Carnet ordinaire');
  const notes = app.S().config.modules.find(m => app.label(m.id) === 'Carnet ordinaire').id;
  assert.equal(app.S().config.assistant.share[notes], true, 'les autres types gardent leur comportement');
  assert.equal(app.MODULE_TEMPLATES[app.MODULE_TEMPLATES.length - 1].id, 'regulation', 'proposé en dernier, jamais mis en avant');
});

test('confidentialité : aucune surface transversale ne lit les détails du suivi', () => {
  const app = launch();
  const { id, inst } = privateTracker(app);
  app.noteVisit(id);
  const today = app.todayISO();
  assert.deepEqual(leaks(app.contextText()), [], 'assistant (non partagé)');
  assert.doesNotMatch(app.contextText(), /SUIVI PRIVÉ/);
  assert.equal(app.searchAll('CONFIDENTIEL_XYZ').length, 0, 'recherche'); assert.equal(app.searchAll('SECRET_ABC').length, 0);
  assert.deepEqual(leaks(app.VIEWS.accueil()), [], 'accueil : résumé, pont, reprise, derniers éléments');
  assert.match(app.VIEWS.accueil(), /Suivi privé/, 'le nom et la présence de l’espace restent visibles');
  assert.deepEqual(leaks(app.VIEWS.bilan()), [], 'bilan général');
  assert.doesNotMatch(app.VIEWS.bilan(), /Suivi privé/, 'pas même une ligne vide dans le bilan');
  app.location.hash = '#bilan/planche';
  assert.deepEqual(leaks(app.plancheView()), [], 'planche de lunaison'); assert.doesNotMatch(app.plancheView(), /Suivi privé/);
  app.location.hash = '';
  assert.deepEqual(leaks(JSON.stringify(app.widgetData())), [], 'widget'); assert.doesNotMatch(JSON.stringify(app.widgetData()), /Suivi privé/);
  assert.deepEqual(leaks(JSON.stringify(app.dayDigest(today))), [], 'notification du matin'); assert.doesNotMatch(JSON.stringify(app.dayDigest(today)), /Suivi privé/);
  assert.equal(app.lunarTest().n, launch().lunarTest().n, 'test lunaire : aucun événement compté');
  const drift = app.lexicalDrift('mois', 0);
  assert.ok(![...(drift.rising || []), ...(drift.fading || [])].some(x => /confidentiel|secret/i.test(drift.word ? drift.word(x.k) : x.k)), 'dérive lexicale');
  assert.equal(JSON.stringify(app.epCounts('2000-01-01', '2100-01-01')), JSON.stringify(launch().epCounts('2000-01-01', '2100-01-01')), 'statuts épistémiques'); // deux realms vm : on compare le contenu
  assert.ok(!app.thoughtItems().some(t => t.mod === id), 'liaisons, carte, tensions'); assert.equal(app.refFind(`${id}/u1`), null, 'lien forgé vers une entrée du suivi');
  assert.ok(!app.sortesPool().some(t => t.mod === id), 'sortes'); assert.ok(!app.arcCandidates().some(t => t.mod === id), 'arc');
  assert.ok(!app.noteTargets('inbox').includes(id), 'une note ne se range pas dans le suivi');
  for (const [mid, m] of Object.entries(app.S().modules)) if (m.type === 'collection' && m.config.concordance) assert.ok(app.concordance(m).every(r => r.hits.every(h => h.mod !== id)), 'motifs');
  assert.equal(app.TYPE_UI.regulation.texts, undefined); assert.equal(app.TYPE_UI.regulation.alerts, undefined); assert.equal(app.TYPE_UI.regulation.badge, undefined);
  assert.equal(app.TYPE_UI.regulation.recent(inst).length, 0); assert.equal(app.TYPE_UI.regulation.review(inst, '2000-01-01', '2100-01-01'), null);
  assert.deepEqual(leaks(app.summaryFor(id)), []);
});

test('partage choisi : un résumé explicite seulement, confirmé sur son texte exact ; l’arrêt ne promet pas l’oubli', async () => {
  const app = launch();
  const { id, inst } = privateTracker(app);
  app.S().config.modules.find(m => m.id === 'assistant').on = true;
  // Cocher dans les Réglages (événement change réel) : la case se décoche, une confirmation montre le résumé exact.
  const box = { checked: true, value: 'on', type: 'checkbox', dataset: { act: 'as-share', k: id }, blur() {} };
  app.fire('change', box);
  assert.equal(box.checked, false, 'rien n’est coché avant la confirmation');
  assert.equal(app.S().config.assistant.share[id], false);
  assert.match(app.$('#cmsg').textContent, /SUIVI PRIVÉ : suivi personnel autodéclaratif \(alcool/);
  assert.deepEqual(leaks(app.$('#cmsg').textContent), []);
  answer(app, false); await new Promise(r => setTimeout(r, 0));
  assert.equal(app.S().config.assistant.share[id], false, 'annuler ne partage rien');
  // Un module ordinaire se coche toujours directement.
  const plain = { checked: false, dataset: { act: 'as-share', k: 'inbox' }, blur() {} };
  app.fire('change', plain); assert.equal(app.S().config.assistant.share.inbox, false);
  const p2 = app.confirmSensitiveShare(id); answer(app, true); await p2;
  assert.equal(app.S().config.assistant.share[id], true);
  const ctx = app.contextText();
  assert.match(ctx, /SUIVI PRIVÉ : suivi personnel autodéclaratif \(alcool, en verres standard/);
  assert.match(ctx, /objectif atteint \d+ fois sur \d+ journées évaluables/);
  assert.match(ctx, /Ne propose ni diagnostic, ni calendrier de sevrage, ni dose/);
  assert.deepEqual(leaks(ctx), [], 'ni notes, ni déclencheurs, ni appuis, ni récompense');
  app.CLICK['rlm-share']({ dataset: { mod: id }, closest: () => null });
  assert.equal(app.S().config.assistant.share[id], false);
  assert.match(app.$('#toast').textContent, /n'en est pas retiré/);
  assert.doesNotMatch(app.contextText(), /SUIVI PRIVÉ/);
  assert.equal(inst.type, 'regulation');
});

test('l’écran du module : textes échappés, quatre actions, alcool informé sans répétition, export et suppression présents', () => {
  const app = launch();
  const { id, inst } = privateTracker(app, '<img src=x onerror=alert(1)>');
  inst.entries.push({ ...inst.entries.find(e => e.kind === 'use'), id: 'xss', note: '<script>alert(1)</script>' });
  const html = app.TYPE_UI.regulation.view(id);
  assert.doesNotMatch(html, /<script>alert|<img src=x/);
  assert.match(html, /&lt;img src=x/);
  for (const act of ['rlm-urge', 'rlm-use', 'rlm-action', 'rlm-day', 'rlm-export', 'mod-del', 'rlm-share', 'rlm-goal']) assert.match(html, new RegExp(`data-act="${act}"`), act);
  assert.equal((html.match(/delirium tremens/g) || []).length, 1, 'une seule mention dans l’écran, repliée, pas à chaque saisie');
  assert.match(html, /0 980 980 930/);
  assert.match(html, /verres standard/);
  // Un suivi qui n'est pas l'alcool ne reçoit pas l'avertissement.
  app.addModule({ type: 'regulation' }, 'Écrans');
  const sid = app.S().config.modules.find(m => app.label(m.id) === 'Écrans').id, s2 = app.S().modules[sid];
  app.setupRegulation(s2, { subject: 'reseaux', date: app.todayISO(), mode: 'observer' }, 'g', app.todayISO(), 1);
  const h2 = app.TYPE_UI.regulation.view(sid);
  assert.doesNotMatch(h2, /delirium|CSAPA/); assert.match(h2, /ne les bloque pas/);
  assert.match(app.TYPE_UI.regulation.view(sid), /Le suivi commence|Mes sept derniers jours/);
});

test('formulaire commun : un champ nombre garde ses bornes par défaut ; un champ date peut refuser l’avenir', () => {
  const app = launch();
  app.openForm('Essai', [{ n: 'a', l: 'A', t: 'number' }, { n: 'b', l: 'B', t: 'number', step: 0.01, min: 0.01, max: 100 }, { n: 'c', l: 'C', t: 'date', max: '2026-09-30' }, { n: 'd', l: 'D', t: 'date' }], {}, () => {});
  const f = app.$('#form').innerHTML;
  assert.match(f, /name="a"\s+value=""\s+min="0" step="1" inputmode="numeric">/);
  assert.match(f, /name="b"\s+value=""\s+min="0.01" step="0.01" inputmode="decimal" max="100">/);
  assert.match(f, /name="c"\s+value=""\s+ max="2026-09-30">/);
  assert.match(f, /name="d"\s+value=""\s+>/);
});

/* ---------------- « sur cet appareil seulement » (ADR 27) : la version hébergée, connectée à un faux serveur ---------------- */

const { fakeSupabase, launchHosted, settle } = require('./hosted-harness');
const tick = () => new Promise(r => setTimeout(r, 0));
const confirmBox = async (app, ok) => { await tick(); const d = app.$('#cdlg'); d.returnValue = ok ? 'ok' : 'cancel'; d.onclose(); await tick(); };
const serverSite = server => server.rows.get('u1').site;
/* Créer et configurer un suivi par les vrais formulaires : nom et sujet (et stockage), puis l'intention. */
async function setupTracker(app, { storage = 'device', consent = true, name = 'Carnet du soir' } = {}) {
  app.addModule(app.localTemplate(app.MODULE_TEMPLATES.find(t => t.id === 'regulation')), 'Reprendre la main');
  const id = app.S().config.modules[app.S().config.modules.length - 1].id;
  app.CLICK['rlm-setup']({ dataset: { mod: id } });
  const first = app.form({ name, subject: 'alcool', storage });
  if (storage === 'account') await confirmBox(app, consent);
  await first;
  if (storage === 'account' && !consent) return id;
  app.form({ mode: 'reduire', limit: '2', date: app.todayISO() });
  return id;
}
const addUse = (app, id, value = 1.5, note = 'NOTE_PRIVEE') => {
  const inst = app.localCopy(id) || app.S().modules[id];
  app.saveRegulationEvent(inst, { kind: 'use', date: app.todayISO(), value, note }, `u${Math.random().toString(36).slice(2, 8)}`, app.todayISO(), Date.now());
  app.site.save(); app.local.save();
};

test('sur cet appareil seulement (choix par défaut) : le serveur ne reçoit que le talon, jamais le contenu', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  const id = await setupTracker(app);
  addUse(app, id); await app.site.sync();
  const stub = serverSite(server).modules[id];
  assert.equal(stub.config.storage, 'device'); assert.equal(stub.config.holder, app.deviceId());
  assert.equal(stub.config.subject, null, 'pas même le sujet'); assert.equal(stub.entries.length, 0); assert.equal(stub.goals.length, 0);
  assert.doesNotMatch(JSON.stringify(serverSite(server)), /NOTE_PRIVEE|reduire|alcool/);
  assert.equal(stub.label, 'Carnet du soir', 'le nom et la présence restent');
  const copy = app.localCopy(id);
  assert.equal(copy.config.subject, 'alcool'); assert.equal(copy.entries.length, 1); assert.equal(copy.goals.length, 1);
  assert.match(app.TYPE_UI.regulation.view(id), /Alcool · au plus 2 verres standard/);
  assert.match(app.TYPE_UI.regulation.view(id), /Sur cet appareil seulement/);
  // « Sur cet appareil » : Selene n'envoie rien, mais la sauvegarde du système peut l'inclure, et le texte le dit.
  assert.match(app.TYPE_UI.regulation.view(id), /La sauvegarde de cet appareil \(Google, iCloud…\), si tu l'as activée, peut l'inclure/);
  app.S().config.assistant.share[id] = true; app.S().config.modules.find(m => m.id === 'assistant').on = true;
  assert.match(app.contextText(), /suivi personnel autodéclaratif \(alcool/, 'le résumé, partagé, se lit sur la copie locale');
  assert.doesNotMatch(app.contextText(), /NOTE_PRIVEE/);
  app.site.disconnect(); app.board.disconnect();
});

test('sur mon compte : seulement avec un accord daté et versionné ; refuser ne configure rien', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  const refused = await setupTracker(app, { storage: 'account', consent: false });
  assert.equal(app.S().modules[refused].config.subject, null, 'pas d’accord : pas de configuration');
  assert.equal(app.S().modules[refused].config.storage, undefined);
  const id = await setupTracker(app, { storage: 'account', name: 'Synchronisé' });
  assert.match(app.$('#cmsg').textContent, /données de santé.*sans chiffrement de bout en bout.*Confirmer vaut accord/s);
  const c = app.S().modules[id].config;
  assert.equal(c.storage, 'account'); assert.equal(c.consent.version, app.REGULATION_CONSENT_VERSION); assert.ok(c.consent.at > 0);
  addUse(app, id); await app.site.sync();
  assert.equal(serverSite(server).modules[id].entries.length, 1, 'avec l’accord, le contenu est synchronisé');
  assert.equal(app.localCopy(id), null);
  app.site.disconnect(); app.board.disconnect();
});

test('retirer l’accord : le contenu revient sur l’appareil, le serveur n’a plus que le talon ; et retour au compte', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  const id = await setupTracker(app, { storage: 'account' });
  addUse(app, id); await app.site.sync();
  const back = app.CLICK['rlm-device']({ dataset: { mod: id } });
  assert.match(app.$('#cmsg').textContent, /sauvegardes techniques de l'hébergeur/);
  await confirmBox(app, true); await back; await app.site.sync();
  assert.equal(serverSite(server).modules[id].entries.length, 0); assert.equal(serverSite(server).modules[id].config.consent, undefined);
  assert.equal(app.localCopy(id).entries.length, 1, 'rien de perdu');
  const again = app.CLICK['rlm-account']({ dataset: { mod: id } }); await confirmBox(app, true); await again; await app.site.sync();
  assert.equal(serverSite(server).modules[id].entries.length, 1); assert.equal(app.localCopy(id), null);
  app.site.disconnect(); app.board.disconnect();
});

test('un suivi synchronisé d’avant la question : un bandeau demande le choix, rien ne change en silence', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  app.addModule({ type: 'regulation' }, 'Ancien');
  const id = app.S().config.modules[app.S().config.modules.length - 1].id, inst = app.S().modules[id];
  app.setupRegulation(inst, { subject: 'tabac', date: app.todayISO(), mode: 'observer' }, 'g', app.todayISO(), 1); // comme avant ce choix
  assert.match(app.TYPE_UI.regulation.view(id), /data-act="rlm-device"[\s\S]*data-act="rlm-account"/);
  assert.match(app.TYPE_UI.regulation.view(id), /Rien ne change tant que tu n'as pas choisi/);
  assert.equal(app.S().modules[id].config.subject, 'tabac', 'les données restent où elles sont');
  const artefact = launch(); // sans compte (artefact) : pas de question, rien à synchroniser
  artefact.addModule({ type: 'regulation' }, 'Local');
  const lid = artefact.S().config.modules[artefact.S().config.modules.length - 1].id;
  artefact.setupRegulation(artefact.S().modules[lid], { subject: 'tabac', date: artefact.todayISO(), mode: 'observer' }, 'g', artefact.todayISO(), 1);
  assert.doesNotMatch(artefact.TYPE_UI.regulation.view(lid), /rlm-choice|rlm-device/);
  app.site.disconnect(); app.board.disconnect();
});

test('un autre appareil du compte : le nom seulement ; les données renvoyées reviennent au détenteur ; retirer le nom ailleurs', async () => {
  const server = fakeSupabase(), a = launchHosted({ fetch: server.fetch }); await settle();
  const id = await setupTracker(a); addUse(a, id); await a.site.sync();
  const b = launchHosted({ fetch: server.fetch, storage: new Map([['selene-device-id', 'dB']]) }); await settle();
  assert.ok(b.S().modules[id], 'le talon arrive'); assert.equal(b.localCopy(id), null);
  assert.match(b.TYPE_UI.regulation.view(id), /gardé sur un autre de tes appareils/);
  assert.doesNotMatch(b.TYPE_UI.regulation.view(id), /NOTE_PRIVEE|verre/);
  // Un appareil resté hors ligne renvoie l'ancienne copie (des saisies dans le talon) : le détenteur les reprend.
  const row = serverSite(server);
  row.modules[id].entries.push({ id: 'tard', kind: 'use', date: a.todayISO(), at: Date.now(), zone: '', note: '', value: 1 }); row.updatedAt = Date.now() + 1000;
  await a.site.sync(); await a.site.sync();
  assert.ok(a.localCopy(id).entries.some(e => e.id === 'tard'), 'reprise par le détenteur');
  assert.equal(serverSite(server).modules[id].entries.length, 0, 'le talon redevient vide sur le serveur');
  // Retirer le nom depuis l'autre appareil (appareil perdu ? réinstallé ?) : possible, et la confirmation dit ce que
  // cela fait. Le détenteur existe encore : il recrée le talon et ne perd rien.
  const remove = async () => {
    await b.site.sync();
    b.CLICK['mod-del']({ dataset: { mod: id } });
    assert.match(b.$('#form').innerHTML, /son contenu est gardé sur un autre appareil.*son nom reviendra/);
    b.form({ confirm: b.label(id) }); assert.ok(!b.S().modules[id]); await b.site.sync();
    assert.ok(!serverSite(server).modules[id], 'le nom est retiré du serveur');
  };
  await remove();
  await a.site.sync(); await a.site.sync();
  assert.ok(serverSite(server).modules[id], 'le détenteur recrée le talon'); assert.equal(a.localCopy(id).entries.length, 2, 'sans rien perdre');
  // Le détenteur a perdu ses données (stockage effacé) : le retrait est alors définitif.
  a.localErase(); await remove();
  await a.site.sync(); await a.site.sync();
  assert.ok(!serverSite(server).modules[id] && !a.S().modules[id], 'plus de nom impossible à effacer');
  for (const x of [a, b]) { x.site.disconnect(); x.board.disconnect(); }
});

test('se déconnecter avec un suivi gardé ici : exporter, synchroniser ou effacer, jamais une perte silencieuse', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  const id = await setupTracker(app); addUse(app, id);
  // Synchroniser avant de partir : l'accord, puis le contenu sur le serveur, puis la déconnexion.
  let out = app.authSignOut(); await tick();
  assert.ok(app.formOpen(), 'la garde s’ouvre avant tout effacement');
  const done = app.form({ what: 'sync' }); await confirmBox(app, true); await done; await out;
  assert.equal(serverSite(server).modules[id].entries.length, 1, 'synchronisé avant la déconnexion');
  assert.equal(app.session(), null);
  // Effacer : une confirmation de plus, puis plus rien sur l'appareil.
  const app2 = launchHosted({ fetch: server.fetch }); await settle();
  const id2 = await setupTracker(app2, { name: 'Éphémère' }); addUse(app2, id2);
  out = app2.authSignOut(); await tick();
  const erase = app2.form({ what: 'erase' }); await confirmBox(app2, true); await erase; await out;
  assert.deepEqual(app2.localIds().length, 0); assert.equal(app2.session(), null);
  assert.ok(![...app2.storage.keys()].some(k => k.startsWith('selene-local-v1:')), 'aucune copie mise de côté');
  for (const x of [app, app2]) { x.site.disconnect(); x.board.disconnect(); }
});

test('changement de compte sur le même appareil : les suivis locaux suivent leur compte, jamais montrés à l’autre', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  const id = await setupTracker(app); addUse(app, id);
  assert.equal(app.local.data.owner, 'u1');
  app.localSwitch('u2');
  assert.equal(app.localIds().length, 0, 'le compte suivant ne voit rien'); assert.ok(app.storage.has('selene-local-v1:u1'), 'mis de côté, pas effacé');
  app.localSwitch('u1');
  assert.equal(app.localCopy(id).entries.length, 1, 'retrouvé au retour du compte');
  assert.ok(!app.storage.has('selene-local-v1:u1'));
  app.site.disconnect(); app.board.disconnect();
});

test('sauvegarde complète : le contenu gardé sur l’appareil y est ; restauré ailleurs, cet appareil en devient le détenteur', async () => {
  const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle();
  const id = await setupTracker(app); addUse(app, id);
  const file = app.createBackup(app.board.data, app.withLocal(app.site.data));
  const parsed = app.parseBackup(file);
  assert.equal(parsed.site.modules[id].entries.length, 1, 'la sauvegarde contient le suivi entier');
  assert.equal(JSON.parse(app.createBackup(app.board.data, app.site.data)).site.modules[id].entries.length, 0, 'le site seul n’a que le talon');
  const other = launchHosted({ fetch: fakeSupabase().fetch, storage: new Map([['selene-device-id', 'dNEW']]) }); await settle();
  const loc = other.splitLocal(parsed.site);
  assert.equal(loc.modules[id].config.holder, 'dNEW'); assert.equal(parsed.site.modules[id].entries.length, 0);
  other.local.replaceAll(loc); other.site.replaceAll(parsed.site);
  assert.equal(other.localCopy(id).entries.length, 1); assert.match(other.TYPE_UI.regulation.view(id), /Alcool/);
  for (const x of [app, other]) { x.site.disconnect(); x.board.disconnect(); }
});

test('validation : stockage, appareil détenteur et accord ont une forme contrôlée', async () => {
  const c = await core, inst = tracker(c);
  inst.config.storage = 'account'; inst.config.consent = { at: 5, version: 1 };
  assert.doesNotThrow(() => c.parseBackup(backup(c, inst)));
  const stub = c.regulationStub(inst, 'dA');
  assert.deepEqual([stub.config.subject, stub.config.storage, stub.config.holder, stub.entries.length, stub.config.supports.length > 0], [null, 'device', 'dA', 0, true]);
  assert.doesNotThrow(() => c.parseBackup(backup(c, stub)));
  for (const [what, mutate] of Object.entries({
    'stockage inconnu': d => { d.config.storage = 'cloud'; }, 'détenteur': d => { d.config.holder = 'a b'; },
    'accord sans date': d => { d.config.consent = { version: 1 }; }, 'accord sans version': d => { d.config.consent = { at: 1, version: 0 }; }
  })) { const bad = JSON.parse(backup(c, inst)); mutate(bad.site.modules.suivi); assert.throws(() => c.parseBackup(JSON.stringify(bad)), undefined, what); }
});
