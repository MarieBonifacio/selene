const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fakeSupabase, launchHosted, reply, settle } = require('./hosted-harness');

const SESSION_KEY = 'selene-auth-session';

test('offline at boot: an expired session is kept and the app runs locally, with a visible warning', async () => {
  const app = launchHosted({ session: 'expired', fetch: async () => { throw new TypeError('Failed to fetch'); } });
  await settle();
  assert.ok(app.session(), 'network failure must not log the user out');
  assert.ok(app.storage.get(SESSION_KEY), 'persisted session must survive');
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /authForm/, 'app, not the login screen');
  assert.match(app.nodes.get('#saving').textContent, /Non synchronisé/);
  assert.equal(app.board.db, null);
});

test('server error (5xx) during refresh keeps the session too', async () => {
  const app = launchHosted({ session: 'expired', fetch: async () => reply(503, { msg: 'unavailable' }) });
  await settle();
  assert.ok(app.session());
});

test('an explicit refusal (400 invalid refresh token) ends the session and shows the login screen', async () => {
  const app = launchHosted({ session: 'expired',
    fetch: async url => url.includes('/auth/v1/token') ? reply(400, { error_description: 'Invalid Refresh Token' }) : reply(200, []) });
  await settle();
  assert.equal(app.session(), null);
  assert.equal(app.storage.get(SESSION_KEY), undefined);
  assert.match(app.nodes.get('#main').innerHTML, /authForm/);
});

test('successful refresh connects both stores to Supabase', async () => {
  const server = fakeSupabase();
  const app = launchHosted({ session: 'expired', fetch: server.fetch });
  await settle();
  assert.equal(app.session().access_token, 'new');
  assert.ok(app.board.db && app.site.db, 'both stores connected');
  assert.equal(server.calls.filter(c => c.includes('/token')).length, 1);
});

test('concurrent refreshes share one request (refresh tokens are single-use)', async () => {
  const server = fakeSupabase();
  let release;
  const gate = new Promise(r => { release = r; });
  let tokenCalls = 0;
  const app = launchHosted({ session: 'expired', fetch: async (url, opts) => {
    if (url.includes('/auth/v1/token')) { tokenCalls++; await gate; }
    return server.fetch(url, opts);
  } });
  const extra = [app.authRefreshIfNeeded(), app.authRefreshIfNeeded()]; // le démarrage en a déjà lancé un
  release();
  const results = await Promise.all(extra);
  await settle();
  assert.equal(tokenCalls, 1);
  assert.ok(results.every(s => s && s.access_token === 'new'));
});

test('offline boot recovers: sync resumes on the next keep-alive once the network is back', async () => {
  const server = fakeSupabase();
  server.offline = true;
  const app = launchHosted({ session: 'expired', fetch: server.fetch });
  await settle();
  assert.equal(app.board.db, null);
  server.offline = false;
  await app.poll(); // minuteur de 5 min : rafraîchit le jeton puis reconnecte les stores
  await settle();
  assert.ok(app.board.db && app.site.db);
  assert.equal(app.nodes.get('#saving').textContent, '');
});

// A18 du cahier de recette : la session gardée se lit avant le premier rendu. Le serveur est retenu jusqu'à `release`.
const held = server => { let release; const gate = new Promise(r => { release = r; }); return { release, fetch: async (url, opts) => { await gate; return server.fetch(url, opts); } }; };

test('A18 : a signed-in device opens on the app, not on the entry screen, even while the server is slow', async () => {
  const server = fakeSupabase(), slow = held(server);
  const app = launchHosted({ fetch: slow.fetch });
  await settle();
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /authForm/, 'the app at once, with what the device keeps');
  assert.equal(server.calls.filter(c => c.includes('app_state')).length, 0, 'the server has answered nothing yet');
  slow.release(); await settle(100);
  assert.ok(app.site.db && app.board.db, 'then the sync');
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /authForm/);
  app.site.disconnect(); app.board.disconnect();
});

test('A18 : data of another account on the device is never shown under this session: entry screen until the switch', async () => {
  const server = fakeSupabase(), slow = held(server);
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } });
  const app = launchHosted({ session: null, storage: new Map([[SESSION_KEY, session], ['selene-auth-last-uid', 'u0']]), fetch: slow.fetch });
  await settle();
  assert.match(app.nodes.get('#main').innerHTML, /authForm/, 'the device data belongs to u0: not shown to u1');
  slow.release(); await settle(100);
  assert.ok(app.session() && app.site.db, 'after the switch, signed in and synced');
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /authForm/);
  app.site.disconnect(); app.board.disconnect();
});

/* A24 du cahier de recette : le réseau revient (online) pendant le branchement du démarrage, parti hors ligne. Le
   branchement en cours échoue ; celui que demandait le retour du réseau ne doit pas se perdre avec lui (jusqu'à
   5 min d'attente, le minuteur). Chaque requête garde l'état du réseau à son départ : celles d'avant le retour
   échouent même relâchées après. */
test('A24 : the network back during a failing connect: the sync resumes at once, not at the 5-minute timer', async () => {
  const server = fakeSupabase();
  let failing = true, release;
  const gate = new Promise(r => { release = r; });
  const fetch = (url, opts) => { const doomed = failing; return gate.then(() => { if (doomed) throw new TypeError('Failed to fetch'); return server.fetch(url, opts); }); };
  const app = launchHosted({ fetch });
  await settle();
  assert.equal(server.calls.length, 0, 'the boot connect is still in flight');
  failing = false; app.fire('online'); await settle();
  release(); await settle(100);
  assert.ok(app.site.db && app.board.db, 'synced, without waiting for the timer');
  assert.equal(app.nodes.get('#saving').textContent, '');
  app.site.disconnect(); app.board.disconnect();
});

/* Le réseau revenu ne l'est pas toujours tout à fait : « online » arrive, mais la première tentative échoue encore
   (réseau qui s'établit, nom pas encore résolu). Elle est retentée dans les secondes qui suivent, pas au minuteur. */
test('A24 : a reconnect that fails right after « online » is retried within seconds, not at the 5-minute timer', async () => {
  const server = fakeSupabase();
  let downUntil = Infinity;
  const fetch = (url, opts) => Date.now() < downUntil ? Promise.reject(new TypeError('Failed to fetch')) : server.fetch(url, opts);
  const app = launchHosted({ fetch });
  await settle();
  assert.equal(app.site.db, null, 'offline at boot: not connected');
  downUntil = Date.now() + 1000; app.fire('online'); await settle();
  assert.equal(app.site.db, null, 'the first attempt after « online » failed');
  await settle(2600);
  assert.ok(app.site.db && app.board.db, 'retried within seconds: connected');
  assert.equal(app.nodes.get('#saving').textContent, '');
  app.site.disconnect(); app.board.disconnect();
});

/* Le retour de la connexion ne s'annonce pas toujours : navigator.onLine reste vrai derrière un portail captif, sur un
   réseau sans Internet, ou quand seul le serveur est injoignable, et « online » ne vient jamais (CI du processeur
   ralenti : la page rechargée hors ligne se croyait en ligne). Un branchement raté est retenté de lui-même. */
test('A24 : with no « online » event at all, a failed boot connect is retried on its own within seconds', async () => {
  const server = fakeSupabase();
  const downUntil = Date.now() + 1000;
  const fetch = (url, opts) => Date.now() < downUntil ? Promise.reject(new TypeError('Failed to fetch')) : server.fetch(url, opts);
  const app = launchHosted({ fetch });
  await settle();
  assert.equal(app.site.db, null, 'offline at boot: not connected');
  await settle(2600);
  assert.ok(app.site.db && app.board.db, 'retried on its own: connected, without any « online » event');
  assert.equal(app.nodes.get('#saving').textContent, '');
  app.site.disconnect(); app.board.disconnect();
});
