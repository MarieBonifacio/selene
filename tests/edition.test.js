/* L'édition des stores (docs/regulation.md, « Hors de l'offre publique » ; ADR 32) : SELENE_EDITION=stores construit
   l'AAB de Google Play et l'archive de l'App Store sans le type « Reprendre la main » (modules/regulation.stores.js à la
   place de regulation.js). Ce qui est vérifié ici : rien du suivi n'entre dans l'application ; un compte qui en a créé
   un ailleurs ne le voit pas, ne le partage pas, ne l'abîme pas ; la déconnexion protège encore ce qui n'existe que sur
   l'appareil. Données synthétiques, faux serveur en mémoire (tests/hosted-harness.js). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { fakeSupabase, launchHosted, settle } = require('./hosted-harness.js');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'selene-stores-'));
process.on('exit', () => fs.rmSync(DIR, { recursive: true, force: true }));
execFileSync('python3', ['build.py', '--dist', DIR], { env: { ...process.env, SELENE_EDITION: 'stores' }, stdio: 'pipe' });
const read = rel => fs.readFileSync(path.join(DIR, rel), 'utf8');
const STORES = read('web/index.html');

const tick = () => new Promise(r => setTimeout(r, 0));
const confirmBox = async (app, ok) => { await tick(); const d = app.$('#cdlg'); d.returnValue = ok ? 'ok' : 'cancel'; d.onclose(); await tick(); };
const serverSite = server => server.rows.get('u1').site;
const lastId = app => app.S().config.modules[app.S().config.modules.length - 1].id;
const addUse = (app, id, value, note) => {
  const inst = app.localCopy(id) || app.S().modules[id];
  app.saveRegulationEvent(inst, { kind: 'use', date: app.todayISO(), value, note }, `u${Math.random().toString(36).slice(2, 8)}`, app.todayISO(), Date.now());
  app.site.save(); app.local.save();
};
/* L'appareil A, dans l'édition complète (le web, l'APK), avec le compte personnel : un suivi gardé sur l'appareil, créé
   par les vrais formulaires, et un ancien suivi encore synchronisé, partagé avec l'assistant. */
async function deviceA(server, storage = new Map([['selene-device-id', 'dA']])) {
  const a = launchHosted({ fetch: server.fetch, personnel: true, storage }); await settle();
  a.addModule(a.localTemplate(a.MODULE_TEMPLATES.find(t => t.id === 'regulation')), 'Reprendre la main');
  const here = lastId(a);
  a.CLICK['rlm-setup']({ dataset: { mod: here } });
  await a.form({ name: 'Carnet du soir', subject: 'alcool' });
  a.form({ mode: 'reduire', limit: '2', date: a.todayISO() });
  addUse(a, here, 1.5, 'NOTE_LOCALE');
  a.installModule({ type: 'regulation' }, 'Ancien suivi');
  const old = lastId(a), inst = a.S().modules[old];
  a.setupRegulation(inst, { subject: 'tabac', date: a.todayISO(), mode: 'observer' }, 'g', a.todayISO(), 1);
  inst.config.storage = 'account'; inst.config.consent = { at: Date.now() - 864e5, version: a.REGULATION_CONSENT_VERSION };
  addUse(a, old, 3, 'NOTE_SYNCHRONISEE');
  const shared = a.confirmSensitiveShare(old); await confirmBox(a, true); await shared;
  await a.site.sync();
  assert.ok(a.localCopy(here) && serverSite(server).modules[old].entries.length === 1 && a.S().config.assistant.share[old], 'avant : un suivi ici, un autre sur le compte, partagé');
  return { a, here, old };
}
const stop = (...apps) => { for (const x of apps) { x.site.disconnect(); x.board.disconnect(); } };

test('l’édition des stores ne contient ni l’écran, ni les formulaires, ni l’export du suivi ; l’édition complète, si', () => {
  // assert.ok plutôt que match : un échec ne recopie pas une page de 800 ko dans la sortie.
  const ACTIONS = /"rlm-(setup|goal|use|urge|day|device|share|export)"/, EXPORT = /selene-regulation-v1/, ABSENT = /absent: true/;
  for (const [name, html] of [['web', STORES], ['native', read('native/index.html')], ['artifact', read('artifact/selene.html')]]) {
    assert.ok(!ACTIONS.test(html), `${name} : aucune action du suivi`);
    assert.ok(!EXPORT.test(html), `${name} : pas d'export du suivi`);
    assert.ok(ABSENT.test(html), `${name} : le type est enregistré absent (modules/regulation.stores.js)`);
  }
  const complete = fs.readFileSync('index.html', 'utf8');
  assert.ok(ACTIONS.test(complete) && EXPORT.test(complete) && !ABSENT.test(complete), 'l’édition complète garde le vrai type');
});

test('les fichiers versionnés restent l’édition complète : build.py n’écrit l’édition des stores que dans dist/', () => {
  const r = spawnSync('python3', ['build.py', '--check'], { env: { ...process.env, SELENE_EDITION: 'stores' }, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /seulement avec --dist/);
  const bad = spawnSync('python3', ['build.py', '--dist', DIR], { env: { ...process.env, SELENE_EDITION: 'magasin' }, encoding: 'utf8' });
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /complete ou stores/, 'une édition inconnue est refusée, pas devinée');
});

test('un compte qui a des suivis, ouvert dans l’édition des stores : rien n’est proposé, montré ni partagé', async () => {
  const server = fakeSupabase(), { a, here, old } = await deviceA(server);
  const b = launchHosted({ fetch: server.fetch, personnel: true, html: STORES, storage: new Map([['selene-device-id', 'dB']]) }); await settle();
  assert.ok(b.S().modules[here] && b.S().modules[old], 'les deux arrivent dans le document');
  assert.equal(b.TYPE_UI.regulation.absent, true);
  assert.equal(b.personalAccount(), true);
  assert.equal(b.offered('regulation'), false, 'pas proposé, même au compte personnel');
  const before = b.S().config.modules.length;
  b.CLICK['tpl-add']({ dataset: { tpl: 'regulation' } }); b.addModule({ type: 'regulation' }, 'Contourné');
  assert.equal(b.S().config.modules.length, before, 'la création elle-même refuse');
  assert.ok(!b.enabled(here) && !b.enabled(old), 'jamais actif');
  assert.ok(!b.domains().flatMap(d => d.ids).some(id => id === here || id === old), 'absent de la navigation');
  const leak = /NOTE_LOCALE|NOTE_SYNCHRONISEE|Carnet du soir|Ancien suivi/;
  assert.doesNotMatch(b.VIEWS.accueil(), leak, 'absent de l’accueil');
  b.location.hash = `#${old}`; b.render();
  assert.doesNotMatch(b.$('#main').innerHTML, /NOTE_SYNCHRONISEE/, 'son adresse mène à l’accueil');
  b.S().config.modules.find(m => m.id === 'assistant').on = true;
  assert.equal(b.S().config.assistant.share[old], true, 'le partage choisi ailleurs est arrivé…');
  assert.doesNotMatch(b.contextText(), /ANCIEN SUIVI|autodéclaratif/, '… mais rien ne part à l’assistant d’ici');
  const reg = b.VIEWS.reglages();
  assert.match(reg, /data-act="mod-on"\s+disabled aria-label="Activer Ancien suivi"/, 'aux Réglages : une ligne, ni activable…');
  assert.match(reg, /Ce suivi a été créé avec une autre version de Selene/, '… et une phrase qui dit pourquoi');
  assert.doesNotMatch(reg, /data-act="as-share" data-k="[^"]*"[^>]*>Ancien suivi/, 'ni dans « Ce que Claude peut lire »');
  stop(a, b);
});

test('l’édition des stores rend le document comme il est venu : l’édition complète retrouve ses suivis entiers', async () => {
  const server = fakeSupabase(), { a, here, old } = await deviceA(server);
  const snapshot = () => { const s = serverSite(server); return JSON.stringify([s.modules[here], s.modules[old], s.config.modules.filter(m => m.id === here || m.id === old), s.config.assistant.share[old], s.config.labels[here]]); };
  const before = snapshot();
  const b = launchHosted({ fetch: server.fetch, personnel: true, html: STORES, storage: new Map([['selene-device-id', 'dB']]) }); await settle();
  b.S().config.name = 'Selene des stores'; b.site.save(); await b.site.sync();
  assert.equal(serverSite(server).config.name, 'Selene des stores', 'la modification d’ici est partie');
  assert.equal(snapshot(), before, 'les deux suivis, leur place, leur nom, leur partage : intacts sur le serveur');
  await a.site.sync(); await a.site.sync();
  assert.equal(a.S().config.name, 'Selene des stores');
  assert.ok(a.enabled(here) && a.enabled(old), 'ouverts dans l’édition complète');
  assert.equal(a.localCopy(here).entries.length, 1, 'le suivi gardé sur A, entier');
  assert.equal(a.S().modules[old].entries.length, 1, 'l’ancien suivi, entier');
  stop(a, b);
});

test('supprimer depuis l’édition des stores : la confirmation dit ce qui part ; le détenteur ne perd rien', async () => {
  const server = fakeSupabase(), { a, here, old } = await deviceA(server);
  const b = launchHosted({ fetch: server.fetch, personnel: true, html: STORES, storage: new Map([['selene-device-id', 'dB']]) }); await settle();
  b.CLICK['mod-del']({ dataset: { mod: here } });
  assert.match(b.$('#form').innerHTML, /son contenu est gardé sur un autre appareil.*son nom reviendra/, 'gardé sur A : le nom seul part, et revient');
  b.form({ confirm: b.label(here) }); await b.site.sync();
  b.CLICK['mod-del']({ dataset: { mod: old } });
  assert.match(b.$('#form').innerHTML, /Cette version ne sait pas ouvrir ce suivi : le supprimer efface son contenu de ton compte, partout, sans retour\./);
  b.form({ confirm: b.label(old) }); await b.site.sync();
  assert.ok(!serverSite(server).modules[old], 'l’ancien suivi est effacé, comme annoncé');
  await a.site.sync(); await a.site.sync();
  assert.ok(serverSite(server).modules[here], 'A, détenteur, rend son nom au compte');
  assert.equal(a.localCopy(here).entries.length, 1, 'sans rien perdre');
  stop(a, b);
});

test('le même appareil, passé de l’édition complète à celle des stores : la copie locale reste, la déconnexion la protège', async () => {
  const server = fakeSupabase(), storage = new Map([['selene-device-id', 'dA']]), { a, here, old } = await deviceA(server, storage);
  stop(a);
  const c = launchHosted({ fetch: server.fetch, personnel: true, html: STORES, storage }); await settle();
  assert.deepEqual([...c.localIds()], [here]); assert.equal(c.localCopy(here).entries.length, 1, 'la copie locale est là, entière');
  assert.ok(!c.enabled(here), 'sans être ouverte');
  const out = c.authSignOut(); await tick();
  assert.ok(c.formOpen(), 'la garde s’ouvre avant tout effacement');
  const f = c.$('#form').innerHTML;
  assert.match(f, /value="export"/); assert.match(f, /value="erase"/); assert.match(f, /Carnet du soir/);
  const erase = c.form({ what: 'erase' }); await confirmBox(c, true); await erase; await out;
  assert.equal(c.session(), null); assert.equal(c.localIds().length, 0);
  assert.ok(!serverSite(server).modules[here], 'effacé, son nom part du compte aussi');
  assert.ok(serverSite(server).modules[old], 'l’autre suivi, sur le compte, n’est pas touché');
  stop(c);
});
