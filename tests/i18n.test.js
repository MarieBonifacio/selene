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

test('plural : le « s » d’un mot choisi par la personne, au moment que dictent les règles de la langue', () => {
  const { plural } = require('../src/app/lib/format.js');
  applyLang('fr', BOTH);
  assert.deepEqual([0, 1, 2].map(n => plural(n, 'fragment')), ['0 fragment', '1 fragment', '2 fragments']);
  applyLang('en', BOTH);
  try { assert.deepEqual([0, 1, 2].map(n => plural(n, 'fragment')), ['0 fragments', '1 fragment', '2 fragments']); } finally { applyLang('fr', BOTH); }
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

test('chaque erreur du noyau a sa traduction : codes levés par coreError, champs nommés par requireText', () => {
  const { CORE_ERRORS, CORE_FIELDS, errMsg } = require('../src/app/lib/labels.js');
  const src = fs.readdirSync('src/core').filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join('src/core', f), 'utf8')).join('\n');
  const codes = new Set([...src.matchAll(/coreError\("([\w-]+)"/g)].map(m => m[1]));
  assert.deepEqual([...codes].sort(), Object.keys(CORE_ERRORS).sort());
  const fields = new Set([...src.matchAll(/requireText\([^,]+, "([^"]+)"/g)].map(m => m[1]));
  assert.deepEqual([...fields].sort(), [...CORE_FIELDS].sort());
  const { coreError } = require('../src/core/domain.js');
  withKeys({ 'Tâche introuvable': 'Task not found' }, () => {
    applyLang('en', BOTH);
    assert.equal(errMsg(coreError('task-missing', 'Tâche introuvable')), 'Task not found');
    assert.equal(errMsg(new Error('Passeur injoignable')), 'Passeur injoignable');
    assert.equal(errMsg(null, 'repli'), 'repli');
  });
});

test('chaque erreur des fonctions serveur a son code, et chaque code sa traduction', async () => {
  const { SERVER_ERRORS, serverMsg } = await import('../src/app/services/erreurs.js');
  const dir = 'supabase/functions', src = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory())
    .flatMap(d => fs.readdirSync(path.join(dir, d.name)).filter(f => f.endsWith('.ts') && !f.endsWith('_test.ts')).map(f => fs.readFileSync(path.join(dir, d.name, f), 'utf8'))).join('\n');
  const bare = src.split('\n').filter(l => /erreur: /.test(l) && !/code: /.test(l) && !/^\s*(\/\/|\*)/.test(l));
  assert.deepEqual(bare, [], 'une réponse d’erreur sans code');
  const codes = new Set([...src.matchAll(/code: "([\w-]+)"/g)].map(m => m[1]));
  assert.deepEqual([...codes].sort(), Object.keys(SERVER_ERRORS).sort());
  withKeys({ 'redirection refusée : {0}': 'redirect refused: {0}', 'nom de réseau local': 'local network name' }, () => {
    applyLang('en', BOTH);
    assert.equal(serverMsg({ erreur: 'redirection refusée : nom de réseau local', code: 'redirection', detail: 'nom-local' }), 'redirect refused: local network name');
    assert.equal(serverMsg({ erreur: 'ancien message' }), 'ancien message', 'une fonction d’avant les codes : son message');
    assert.equal(serverMsg({ code: 'inconnu-ici' }, 'repli'), 'repli');
  });
});

test('les genres de source du noyau sont tous dans la liste à traduire', () => {
  const { SOURCE_KINDS, CROSSREF_KIND } = require('../src/core/sources.js');
  const { ZOT_KIND } = require('../src/core/zotero.js');
  for (const k of [...Object.values(CROSSREF_KIND), ...Object.values(ZOT_KIND), 'page', 'article', 'vidéo']) assert.ok(SOURCE_KINDS.includes(k), k);
  const src = fs.readFileSync('src/app/services/passeur.js', 'utf8') + fs.readFileSync('src/core/sources.js', 'utf8');
  for (const m of src.matchAll(/kind: (?:[^,]*\? )?"([^"]+)"/g)) assert.ok(SOURCE_KINDS.includes(m[1]), m[1]);
});

test('un modèle de module se crée dans la langue de l’interface ; les valeurs du code ne bougent pas', () => {
  const { MODULE_TEMPLATES, createFromTemplate } = require('../src/core/domain.js');
  const { localTemplate } = require('../src/app/lib/labels.js');
  const tpl = MODULE_TEMPLATES.find(t => t.id === 'sources');
  applyLang('en', BOTH);
  try {
    const lt = localTemplate(tpl), modules = {};
    assert.equal(lt.name, 'Sources'); assert.equal(lt.hint, 'Articles, books, pages: a link or a DOI is enough, the rest fills itself in');
    const inst = createFromTemplate(modules, lt, lt.name, 'src1', tr);
    assert.deepEqual(inst.config.statuses, ['To read', 'Read', 'Used']);
    assert.equal(inst.config.fields.title, 'Title'); assert.equal(inst.config.statusLabel, 'Reading');
    assert.equal(inst.config.display, 'liste', 'une valeur du code reste telle quelle');
    assert.equal(inst.config.sources, true);
    assert.deepEqual(tpl.config.statuses, ['À lire', 'Lue', 'Utilisée'], 'le modèle du noyau reste intact');
  } finally { applyLang('fr', BOTH); }
  const fr = createFromTemplate({}, localTemplate(tpl), 'Sources', 'src2', tr);
  assert.deepEqual(fr.config.statuses, ['À lire', 'Lue', 'Utilisée']);
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
