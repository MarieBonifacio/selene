/* Les langues de l'interface (src/app/i18n) : clés tirées du texte français, repli, contexte, pluriels du CLDR, choix
   de la langue, pseudo-langue, tri ; et la réserve des noms tr, trp, trn, N_ dans tout src/app. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { LANGS, applyLang, collate, resolveLang, tr, trn, trp, uiLang, uiLocale } = require('../src/app/i18n/index.js');

const BOTH = ['fr', 'en'];
// Une clé d'essai le temps d'un test, dans le vrai dictionnaire anglais (retirée ensuite).
function withKeys(keys, fn) {
  Object.assign(LANGS.en.dict, keys);
  try { fn(); } finally { for (const k of Object.keys(keys)) delete LANGS.en.dict[k]; applyLang('fr', BOTH); }
}

test('le français est la source : le texte tel qu’écrit, valeurs comprises', () => {
  applyLang('fr', BOTH);
  assert.equal(tr`Pleine lune`, 'Pleine lune');
  assert.equal(tr`Voir les ${100} suivants (${250} de plus)`, 'Voir les 100 suivants (250 de plus)');
  assert.equal(tr('Pleine lune'), 'Pleine lune');
  // Une valeur qui contient « {1} » n'est pas remplacée à son tour.
  assert.equal(tr`a ${'{1}'} b ${'x'}`, 'a {1} b x');
});

test('une traduction : clé « … {0} … », valeurs déplaçables, repli sur le français', () => {
  withKeys({ 'De {0} à {1}': 'To {1}, from {0}' }, () => {
    applyLang('en', BOTH);
    assert.equal(uiLang(), 'en');
    assert.equal(tr`Pleine lune`, 'Full moon');
    assert.equal(tr`Voir les ${100} suivants (${250} de plus)`, 'Show the next 100 (250 more)');
    assert.equal(tr`De ${'Lille'} à ${'Arras'}`, 'To Arras, from Lille');
    assert.equal(tr`Un texte encore sans traduction`, 'Un texte encore sans traduction');
  });
});

test('le contexte distingue deux sens d’un même mot (gettext : msgctxt)', () => {
  applyLang('fr', BOTH);
  assert.equal(trp('toast', 'Annuler'), 'Annuler');
  assert.equal(trp('formulaire', 'Annuler'), 'Annuler');
  applyLang('en', BOTH);
  assert.equal(trp('toast', 'Annuler'), 'Undo');
  assert.equal(trp('formulaire', 'Annuler'), 'Cancel');
  applyLang('fr', BOTH);
});

test('pluriels : les catégories du CLDR de chaque langue (0 est singulier en français, pluriel en anglais)', () => {
  applyLang('fr', BOTH);
  assert.equal(trn(0, '{0} fragment', '{0} fragments'), '0 fragment');
  assert.equal(trn(1, '{0} fragment', '{0} fragments'), '1 fragment');
  assert.equal(trn(2, '{0} fragment', '{0} fragments'), '2 fragments');
  assert.equal(trn(3, '{0} fragment dans {1}', '{0} fragments dans {1}', 'Écriture'), '3 fragments dans Écriture');
  withKeys({ '{0} fragment': { one: '{0} fragment', other: '{0} fragments' } }, () => {
    applyLang('en', BOTH);
    assert.equal(trn(0, '{0} fragment', '{0} fragments'), '0 fragments');
    assert.equal(trn(1, '{0} fragment', '{0} fragments'), '1 fragment');
    // Sans traduction, les règles françaises choisissent entre les formes françaises (clé d'essai, absente de tout dictionnaire).
    assert.equal(trn(0, '{0} chose d’essai', '{0} choses d’essai'), '0 chose d’essai');
  });
});

test('la langue en vigueur : le choix du compte s’il est proposé, sinon l’appareil, sinon le français', () => {
  assert.equal(resolveLang('en', [], BOTH), 'en');
  assert.equal(resolveLang('', ['en-US', 'fr-FR'], BOTH), 'en');
  assert.equal(resolveLang('', ['de-DE', 'fr-CA'], BOTH), 'fr');
  assert.equal(resolveLang('de', ['en-GB'], BOTH), 'en', 'une langue inconnue compte pour vide');
  assert.equal(resolveLang('en', ['en-US'], ['fr']), 'fr', 'une langue pas encore proposée n’est jamais retenue');
  assert.equal(resolveLang('', [], BOTH), 'fr');
  assert.equal(resolveLang('qps', [], ['fr']), 'qps', 'la pseudo-langue, toujours, pour les contrôles');
  applyLang('fr', BOTH);
  assert.equal(applyLang('fr', BOTH), false, 'rien ne change : rien à refaire');
  assert.equal(applyLang('en', BOTH), true);
  assert.equal(uiLocale(), 'en-GB');
  applyLang('fr', BOTH);
  assert.equal(uiLocale(), 'fr-FR');
});

test('pseudo-langue : chaque texte traduit se voit (⟦ ⟧, accents, un tiers plus long), les valeurs restent intactes', () => {
  applyLang('qps', BOTH);
  const s = tr`Voir les ${42} suivants (${7} de plus)`;
  assert.ok(s.startsWith('⟦Vôïr lés 42 süïvàñts (7 dé plüs)'), s);
  assert.ok(s.endsWith('⟧'));
  assert.ok(s.length > 'Voir les 42 suivants (7 de plus)'.length * 1.2);
  assert.match(trn(2, '{0} fragment', '{0} fragments'), /^⟦2 .*⟧$/);
  applyLang('fr', BOTH);
});

test('tri dans la langue : « é » se range avec « e », pas après « z »', () => {
  applyLang('fr', BOTH);
  assert.deepEqual(['zèbre', 'été', 'Eau', 'fin'].sort(collate), ['Eau', 'été', 'fin', 'zèbre']);
});

test('les libellés du noyau (statuts, liens) sont tous marqués pour la traduction', () => {
  const { EP_STATUS, LINK_TYPES } = require('../src/core/domain.js');
  const { CORE_LABELS } = require('../src/app/lib/labels.js');
  assert.deepEqual([...CORE_LABELS].sort(), [...Object.values(EP_STATUS), ...Object.values(LINK_TYPES)].sort());
});

test('le ciel du noyau est couvert : temps, pluies d’étoiles, éclipses (2026-2030, depuis Lille), vents', () => {
  const { WEATHER, skyEvents, windName } = require('../src/core/sky.js');
  const { ECLIPSE_TEXT, SKY_LABELS, WIND_TEXT } = require('../src/app/lib/labels.js');
  const words = new Set(Object.values(WEATHER)), eclipses = new Set();
  for (let t = Date.parse('2026-01-01T12:00:00Z'); t < Date.parse('2031-01-01T12:00:00Z'); t += 86400000) {
    for (const ev of skyEvents(new Date(t).toISOString().slice(0, 10), { lat: 50.6, lon: 3.1 })) {
      if (ev.kind === 'shower') words.add(ev.name); else { eclipses.add(`${ev.body}/${ev.type}`); if (ev.note) words.add(ev.note); }
    }
  }
  assert.deepEqual([...words].sort(), [...SKY_LABELS].sort());
  for (const k of eclipses) assert.ok(Object.hasOwn(ECLIPSE_TEXT, k), k);
  for (let d = 0; d < 360; d += 45) assert.ok(Object.hasOwn(WIND_TEXT, windName(d)), windName(d));
});

test('un texte enregistré dans une langue se reconnaît dans toutes (provenances)', () => {
  const { sameText } = require('../src/app/i18n/index.js');
  withKeys({ 'Dehors d’essai': 'Outside test' }, () => {
    assert.ok(sameText('Dehors d’essai', 'Dehors d’essai'));
    assert.ok(sameText('Dehors d’essai', 'Outside test'));
    applyLang('qps', BOTH);
    assert.ok(sameText('Dehors d’essai', tr('Dehors d’essai')));
    assert.ok(!sameText('Dehors d’essai', 'Veille'));
  });
});

test('les noms tr, trp, trn et N_ sont réservés dans src/app : aucune variable ne les masque', async () => {
  const { parse } = await import('espree');
  const { analyze } = await import('eslint-scope');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
  const bad = [];
  for (const f of walk('src/app')) {
    if (f.split(path.sep).join('/') === 'src/app/i18n/index.js') continue; // leur définition
    const ast = parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', loc: true, range: true });
    for (const s of analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }).scopes)
      for (const v of s.variables) if (['tr', 'trp', 'trn', 'N_'].includes(v.name))
        for (const d of v.defs) if (d.type !== 'ImportBinding') bad.push(`${f}:${d.name.loc.start.line} déclare ${v.name}`);
  }
  assert.deepEqual(bad, []);
});
