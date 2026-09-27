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
