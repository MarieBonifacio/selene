/* Banc d'essai du build hébergé (index.html) : un faux Supabase en mémoire, partagé entre
   plusieurs « appareils » (chacun avec son propre localStorage), pour tester la synchro. */
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
// Jeu d'essai riche (les modules d'origine) : les vrais comptes neufs partent presque vides.
const DEMO = fs.readFileSync('tests/fixtures/site-demo.json', 'utf8');
const clone = o => JSON.parse(JSON.stringify(o));
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms));
const USER = { id: 'u1', email: 'a@b.c' };
const sessionBody = { access_token: 'new', refresh_token: 'new-r', expires_in: 3600, user: USER };

/* Imite PostgREST pour ce que l'app utilise : GET filtré, POST ignore-duplicates,
   PATCH conditionnel sur `col->>champ` avec Prefer: return=representation. */
function fakeSupabase() {
  const server = { rows: new Map(), calls: [], offline: false, beforePatch: null };
  server.fetch = async (url, opts = {}) => {
    if (server.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url), method = opts.method || 'GET';
    server.calls.push(`${method} ${u.pathname}`);
    if (u.pathname === '/auth/v1/token') return reply(200, sessionBody);
    if (u.pathname === '/auth/v1/logout') return reply(204, {});
    if (u.pathname !== '/rest/v1/app_state') return reply(404, {});
    const uid = (u.searchParams.get('user_id') || '').replace(/^eq\./, ''), row = server.rows.get(uid);
    if (method === 'GET') { const col = u.searchParams.get('select'); return reply(200, row ? [{ [col]: clone(row[col]) }] : []); }
    if (method === 'POST') {
      for (const r of JSON.parse(opts.body)) if (!server.rows.has(r.user_id)) server.rows.set(r.user_id, { board: {}, site: {}, ...r });
      return reply(201, null);
    }
    if (method === 'PATCH') {
      if (server.beforePatch) { const f = server.beforePatch; server.beforePatch = null; await f(); }
      const r = server.rows.get(uid);
      if (!r) return reply(200, []);
      for (const [k, guard] of u.searchParams) if (k.includes('->>')) {
        const [col, field] = k.split('->>'), cur = r[col] && r[col][field];
        if (!(guard === 'is.null' ? cur == null : cur != null && String(cur) === guard.slice(3))) return reply(200, []);
      }
      Object.assign(r, JSON.parse(opts.body));
      return reply(200, [{ user_id: uid }]);
    }
    return reply(405, {});
  };
  return server;
}

function launchHosted({ storage = new Map(), fetch, session = 'valid', bare = false } = {}) {
  if (!bare && !storage.has('selene-site-v1')) storage.set('selene-site-v1', DEMO);
  if (session) {
    const expires_at = Math.floor(Date.now() / 1000) + (session === 'valid' ? 3600 : -60);
    storage.set('selene-auth-session', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at, user: USER }));
    storage.set('selene-auth-last-uid', USER.id);
  }
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
    removeItem(key) { storage.delete(key); },
    key(i) { return [...storage.keys()][i] ?? null; },
    get length() { return storage.size; }
  };
  // Minuteurs « unref » (ne retiennent pas le process) ; les setInterval sont enregistrés
  // pour pouvoir déclencher un tour de polling à la main et vérifier qu'ils sont bien arrêtés.
  const setTimeoutU = (fn, ms) => { const t = setTimeout(fn, ms); t.unref(); return t; };
  const intervals = new Map(); let n = 0;
  const context = { document, window: { addEventListener() {}, claude: null }, localStorage, location: { hash: '' },
    navigator: {}, console, Date, Math, setTimeout: setTimeoutU, clearTimeout, AbortController, fetch,
    setInterval: fn => { intervals.set(++n, fn); return n; }, clearInterval: id => intervals.delete(id) };
  const instrumented = script.replace(/\}\)\(\);\s*$/,
    'globalThis.__test = { board, site, S, deleteModuleInstance, authRefreshIfNeeded, authSignOut, mergeDocs, session: () => authSession };\n})();');
  vm.runInNewContext(instrumented, context);
  const poll = () => Promise.all([...intervals.values()].map(fn => fn()));
  return { ...context.__test, nodes, storage, intervals, poll };
}

module.exports = { fakeSupabase, launchHosted, reply, settle, clone };
