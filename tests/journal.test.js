/* Le journal des erreurs (services/journal.js, T9) : sur un faux Supabase, ce qui part et ce qui ne part pas. Ni
   compte, ni jeton, ni texte saisi ; seulement les erreurs de programmation ; une fois chacune, cinq au plus ; coupé
   depuis les Réglages. La table elle-même (bornes, purge, lecture refusée) : supabase/schema.sql, docs/compte.md. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fakeSupabase, launchHosted, settle } = require('./hosted-harness');

const start = async () => { const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch }); await settle(); return { server, app }; };
const stop = app => { app.site.disconnect(); app.board.disconnect(); };
const bug = (msg = 'boom') => { try { null[msg]; } catch (e) { return e; } };

test('journal : une erreur de programmation part sans compte, sans jeton, sans son message', async () => {
  const { server, app } = await start();
  app.location.hash = '#reglages';
  app.reportError(bug('CONFIDENTIEL_JOURNAL'));
  assert.equal(server.erreurs.length, 1);
  const { body, headers } = server.erreurs[0];
  assert.deepEqual(Object.keys(body).sort(), ['genre', 'lieu', 'plateforme', 'version', 'vue']);
  assert.equal(body.genre, 'TypeError'); assert.equal(body.vue, 'reglages'); assert.equal(body.plateforme, 'web');
  assert.match(body.version, /^[0-9a-f]{10}$/, 'l’empreinte du code posée par build.py');
  assert.match(body.lieu, /^[A-Za-z0-9._-]+:\d+:\d+$/, 'fichier:ligne:colonne, sans chemin');
  assert.doesNotMatch(JSON.stringify(body), /CONFIDENTIEL_JOURNAL|a@b\.c|u1/, 'ni le message, ni le compte');
  assert.equal(headers.Authorization, undefined, 'aucun jeton : la clé publique seule');
  assert.equal(headers.apikey, app.SUPABASE_ANON_KEY);
  stop(app);
});

test('journal : les erreurs attendues ne partent pas (validation, noyau, réseau, abandon)', async () => {
  const { server, app } = await start();
  const core = Object.assign(new Error('Le sujet ne change pas'), { code: 'reg-subject-locked' });
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  for (const e of [new Error('Indique un nom'), core, new TypeError('Failed to fetch'), new TypeError('Load failed'), abort, 'texte', null, { name: 'Faux nom!' }])
    app.reportError(e);
  assert.equal(server.erreurs.length, 0);
  const quota = Object.assign(new Error('plein'), { name: 'QuotaExceededError', code: 22 }); // une DOMException : code numérique
  app.reportError(quota);
  assert.equal(server.erreurs.length, 1, 'un stockage plein part'); assert.equal(server.erreurs[0].body.genre, 'QuotaExceededError');
  stop(app);
});

test('journal : une fois chaque erreur, cinq au plus par chargement', async () => {
  const { server, app } = await start();
  const e = bug(); app.reportError(e); app.reportError(e);
  assert.equal(server.erreurs.length, 1, 'la même erreur, une seule fois');
  for (let i = 0; i < 10; i++) app.reportError(e, `ailleurs.js:${i}:1`);
  assert.equal(server.erreurs.length, 5, 'cinq envois au plus');
  stop(app);
});

test('journal : l’écran dit la vue ou le type, jamais l’identifiant d’un module (tiré de son nom)', async () => {
  const { server, app } = await start();
  app.installModule({ type: 'notes' }, 'Journal intime de Marie');
  const notes = app.S().config.modules[app.S().config.modules.length - 1].id;
  app.installModule({ type: 'regulation' }, 'Suivi alcool');
  const reg = app.S().config.modules[app.S().config.modules.length - 1].id;
  const vueOf = hash => { app.location.hash = hash; return app.currentView(); };
  assert.equal(vueOf(`#${notes}`), 'module:notes');
  assert.equal(vueOf(`#${reg}`), 'module', 'un type sensible : « module » seul');
  assert.equal(vueOf('#bilan/planche'), 'bilan'); assert.equal(vueOf(''), 'accueil'); assert.equal(vueOf('#inconnu-xyz'), '');
  app.location.hash = `#${notes}`; app.reportError(bug());
  assert.doesNotMatch(JSON.stringify(server.erreurs), /intime|Marie|alcool/);
  stop(app);
});

test('journal : une action qui échoue sur un défaut part avec son nom ; coupé dans les Réglages, plus rien', async () => {
  const { server, app } = await start();
  app.runAction({ casse: () => null.x }, 'casse');
  assert.equal(server.erreurs.length, 1); assert.match(server.erreurs[0].body.lieu, /\(casse\)$/);
  app.runAction({ refus: () => { throw new Error('Donne un nom au module.'); } }, 'refus');
  assert.equal(server.erreurs.length, 1, 'une validation ne part pas');
  assert.match(app.VIEWS.reglages(), /data-act="err-reports" checked/, 'Réglages, Compte : activé par défaut');
  app.CHANGE['err-reports']({ checked: false });
  assert.equal(app.storage.get('selene-erreurs'), 'off', 'réglage de cet appareil');
  assert.match(app.VIEWS.reglages(), /data-act="err-reports" >/);
  app.reportError(bug('autre'), 'x.js:1:1');
  assert.equal(server.erreurs.length, 1, 'coupé : rien ne part');
  app.CHANGE['err-reports']({ checked: true }); assert.equal(app.storage.get('selene-erreurs'), undefined);
  stop(app);
});

test('journal : le premier cadre de la pile, réduit au fichier, pour Chrome, Firefox et Safari', async () => {
  const { app } = await start();
  assert.equal(app.topFrame('TypeError: x\n    at f (https://mariebonifacio.github.io/selene/index.html:12:34)\n    at g (x.js:1:1)'), 'index.html:12:34');
  assert.equal(app.topFrame('f@https://mariebonifacio.github.io/selene/:5:6'), 'page:5:6');
  assert.equal(app.topFrame('f@capacitor://localhost/index.html?x=1:7:8'), 'index.html:7:8');
  assert.equal(app.topFrame('rien de lisible'), '');
  stop(app);
});

test('journal : l’empreinte du code est la même dans le site, l’artefact et les apps, et la table est dans le schéma', () => {
  const id = f => (fs.readFileSync(f, 'utf8').match(/const SELENE_BUILD = "([0-9a-f]{10})"/) || [])[1];
  assert.ok(id('index.html')); assert.equal(id('selene.html'), id('index.html'));
  const schema = fs.readFileSync('supabase/schema.sql', 'utf8');
  for (const piece of ['create table public.erreurs', "genre ~ '^[A-Za-z]{1,40}$'", 'for insert to anon, authenticated', "interval '30 days'", '>= 500 then return null'])
    assert.ok(schema.includes(piece), piece);
  assert.doesNotMatch(schema, /on public\.erreurs for (select|update|delete|all)/, 'personne ne lit ni ne modifie par l’API');
});
