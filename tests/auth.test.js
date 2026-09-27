const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Build hébergé (index.html) : window.claude absent, donc le chemin Supabase est actif.
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

const SESSION_KEY = 'selene-auth-session';
const expiredSession = () => ({
  access_token: 'old-access', refresh_token: 'old-refresh',
  expires_at: Math.floor(Date.now() / 1000) - 60, user: { id: 'u1', email: 'a@b.c' }
});
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const settle = () => new Promise(r => setTimeout(r, 30));

function launch(storage, fetch) {
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      id, dataset: {}, value: '', textContent: '', innerHTML: '', style: {},
      classList: { add() {}, remove() {} }, addEventListener() {},
      querySelectorAll() { return []; }, focus() {}
    });
    return nodes.get(id);
  };
  const document = {
    title: '', activeElement: null, documentElement: { dataset: {} }, hidden: false, visibilityState: 'visible',
    querySelector: element, getElementById: element, addEventListener() {}
  };
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  };
  const window = { addEventListener() {}, claude: null };
  // Minuteurs « unref » : les 10 s de délai réseau ne doivent pas retenir le process de test.
  const setTimeoutU = (fn, ms) => { const t = setTimeout(fn, ms); t.unref(); return t; };
  const context = { document, window, localStorage, location: { hash: '' }, navigator: {}, console, Date, Math,
    setTimeout: setTimeoutU, clearTimeout, setInterval: () => 0, clearInterval() {}, AbortController, fetch };
  const instrumented = script.replace(/\}\)\(\);\s*$/,
    'globalThis.__test = { board, site, authRefreshIfNeeded, session: () => authSession };\n})();');
  vm.runInNewContext(instrumented, context);
  return { ...context.__test, nodes };
}

test('offline at boot: an expired session is kept and the app runs locally, with a visible warning', async () => {
  const storage = new Map([[SESSION_KEY, JSON.stringify(expiredSession())]]);
  const app = launch(storage, async () => { throw new TypeError('Failed to fetch'); });
  await settle();
  assert.ok(app.session(), 'network failure must not log the user out');
  assert.ok(storage.get(SESSION_KEY), 'persisted session must survive');
  assert.doesNotMatch(app.nodes.get('#main').innerHTML, /authForm/, 'app, not the login screen');
  assert.match(app.nodes.get('#saving').textContent, /Non synchronisé/);
  assert.equal(app.board.db, null);
});

test('server error (5xx) during refresh keeps the session too', async () => {
  const storage = new Map([[SESSION_KEY, JSON.stringify(expiredSession())]]);
  const app = launch(storage, async () => reply(503, { msg: 'unavailable' }));
  await settle();
  assert.ok(app.session());
});

test('an explicit refusal (400 invalid refresh token) ends the session and shows the login screen', async () => {
  const storage = new Map([[SESSION_KEY, JSON.stringify(expiredSession())]]);
  const app = launch(storage, async url => url.includes('/auth/v1/token') ? reply(400, { error_description: 'Invalid Refresh Token' }) : reply(200, []));
  await settle();
  assert.equal(app.session(), null);
  assert.equal(storage.get(SESSION_KEY), undefined);
  assert.match(app.nodes.get('#main').innerHTML, /authForm/);
});

test('successful refresh connects both stores to Supabase', async () => {
  const storage = new Map([[SESSION_KEY, JSON.stringify(expiredSession())]]);
  const calls = [];
  const app = launch(storage, async (url, opts = {}) => {
    calls.push(`${opts.method || 'GET'} ${url.replace(/^https:\/\/[^/]+/, '')}`);
    if (url.includes('/auth/v1/token')) return reply(200, { access_token: 'new', refresh_token: 'new-r', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } });
    return reply(opts.method === 'POST' ? 201 : 200, []);
  });
  await settle();
  assert.equal(app.session().access_token, 'new');
  assert.ok(app.board.db && app.site.db, 'both stores connected');
  assert.equal(calls.filter(c => c.includes('/token')).length, 1);
});

test('concurrent refreshes share one request (refresh tokens are single-use)', async () => {
  const storage = new Map([[SESSION_KEY, JSON.stringify(expiredSession())]]);
  let tokenCalls = 0, release;
  const gate = new Promise(r => { release = r; });
  const app = launch(storage, async url => {
    if (url.includes('/auth/v1/token')) {
      tokenCalls++;
      await gate;
      return reply(200, { access_token: 'new', refresh_token: 'new-r', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } });
    }
    return reply(200, []);
  });
  const extra = [app.authRefreshIfNeeded(), app.authRefreshIfNeeded()]; // boot en a déjà lancé un
  release();
  const results = await Promise.all(extra);
  await settle();
  assert.equal(tokenCalls, 1);
  assert.ok(results.every(s => s && s.access_token === 'new'));
});
