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
function fakeSupabase({ appMetadata } = {}) {
  const server = { rows: new Map(), calls: [], selects: [], erreurs: [], activite: [], offline: false, beforePatch: null, maxBytes: Infinity };
  const token = appMetadata ? { ...sessionBody, user: { ...USER, app_metadata: appMetadata } } : sessionBody;
  server.fetch = async (url, opts = {}) => {
    if (server.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url), method = opts.method || 'GET';
    server.calls.push(`${method} ${u.pathname}`);
    if (u.pathname === '/auth/v1/token') return reply(200, token);
    if (u.pathname === '/auth/v1/logout') return reply(204, {});
    // Le journal des erreurs (services/journal.js) : ce qui part, en-têtes compris.
    if (u.pathname === '/rest/v1/erreurs') { server.erreurs.push({ body: JSON.parse(opts.body), headers: { ...opts.headers } }); return reply(201, null); }
    // La mesure d'usage (services/activite.js) : ce qui part, en-têtes compris.
    if (u.pathname === '/rest/v1/activite') { server.activite.push({ body: JSON.parse(opts.body), headers: { ...opts.headers } }); return reply(201, null); }
    if (u.pathname !== '/rest/v1/app_state') return reply(404, {});
    const uid = (u.searchParams.get('user_id') || '').replace(/^eq\./, ''), row = server.rows.get(uid);
    if (method === 'GET') {
      server.selects.push(u.searchParams.get('select'));
      const col = u.searchParams.get('select'), stamp = col.match(/^u:(\w+)->>updatedAt$/); // la date seule (polling)
      if (stamp) return reply(200, row ? [{ u: row[stamp[1]] && row[stamp[1]].updatedAt != null ? String(row[stamp[1]].updatedAt) : null }] : []);
      return reply(200, row ? [{ [col]: clone(row[col]) }] : []);
    }
    if (method === 'POST') {
      for (const r of JSON.parse(opts.body)) if (!server.rows.has(r.user_id)) server.rows.set(r.user_id, { board: {}, site: {}, ...r });
      return reply(201, null);
    }
    if (method === 'PATCH') {
      // La contrainte app_state_taille (supabase/schema.sql), à l'échelle choisie par le test.
      if (Buffer.byteLength(opts.body) > server.maxBytes) return reply(400, { code: '23514', message: 'new row for relation "app_state" violates check constraint "app_state_taille"' });
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

/* `personnel` : le compte marqué selene_personnel par le serveur (docs/regulation.md, « Hors de l'offre publique »).
   `html` : une autre page assemblée que index.html (l'édition des stores, tests/edition.test.js). */
function launchHosted({ storage = new Map(), fetch, session = 'valid', bare = false, personnel = false, html = null, navigator = {} } = {}) {
  if (!bare && !storage.has('selene-site-v1')) storage.set('selene-site-v1', DEMO);
  if (session) {
    const expires_at = Math.floor(Date.now() / 1000) + (session === 'valid' ? 3600 : -60);
    storage.set('selene-auth-session', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at, user: personnel ? { ...USER, personnel: true } : USER }));
    storage.set('selene-auth-last-uid', USER.id);
  }
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      id, dataset: {}, value: '', textContent: '', innerHTML: '', style: {},
      classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, removeEventListener() {},
      querySelectorAll() { return []; }, focus() {}, showModal() {} // n'ouvre rien pour de vrai : le formulaire reste testable
    });
    return nodes.get(id);
  };
  // Les écouteurs de window (online…) et de document (visibilitychange…) aussi, pour qu'un test puisse jouer l'événement
  // (`fire('online')`, `fire('document:visibilitychange')`, `document` rendu pour changer `hidden` et `visibilityState`).
  const listeners = new Map(), on = (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]);
  const document = {
    title: '', activeElement: null, documentElement: { dataset: {} }, hidden: false, visibilityState: 'visible',
    querySelector: element, getElementById: element, addEventListener: (type, fn) => on('document:' + type, fn),
    removeEventListener: (type, fn) => listeners.set('document:' + type, (listeners.get('document:' + type) || []).filter(f => f !== fn))
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
  const context = { document, window: { addEventListener: on, claude: null }, localStorage, location: { hash: '' },
    navigator, console, Date, Math, setTimeout: setTimeoutU, clearTimeout, AbortController, fetch,
    setInterval: fn => { intervals.set(++n, fn); return n; }, clearInterval: id => intervals.delete(id) };
  const instrumented = (html ? html.match(/<script>\s*([\s\S]*?)<\/script>/)[1] : script).replace(/\}\);\s*\}\)\(\);\s*$/, // dans platform.ready
    'globalThis.__test = { ...__selene, session: () => __selene.authSession, form: v => __selene.formCb(v), formOpen: () => !!__selene.formCb };\n});\n})();'); // form : le formulaire ouvert à cet instant (formCb change)
  vm.runInNewContext(instrumented, context);
  const poll = () => Promise.all([...intervals.values()].map(fn => fn()));
  const fire = (type, ev = {}) => (listeners.get(type) || []).forEach(fn => fn({ type, ...ev }));
  return { ...context.__test, nodes, storage, intervals, poll, fire, document, location: context.location };
}

module.exports = { fakeSupabase, launchHosted, reply, settle, clone };
