/* Le test d'isolation entre comptes (scripts/isolation.mjs) : sans réseau, contre une base factice qui applique les
   règles de supabase/schema.sql (RLS : chacun sa ligne ; assistant_keys fermée ; pas de suppression), puis contre la
   même base percée d'un trou à la fois. Le script doit dire 0 sur la première, 1 sur chacune des autres, et 2 quand
   son montage ne lui permet pas de conclure. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const isolation = import('../scripts/isolation.mjs');

const URL_TEST = 'https://preprod-test.supabase.co';
const A = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'a@exemple.invalid', motDePasse: 'mdp-de-a-secret', jeton: 'jeton-de-a' };
const B = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'b@exemple.invalid', motDePasse: 'mdp-de-b-secret', jeton: 'jeton-de-b' };

/* Une base Supabase réduite à ce que le test touche. `trou` perce une règle :
   lecture (select pour tous), ecriture (update et insert sans contrôle), suppression (une règle delete pour tous),
   cles (assistant_keys ouverte), admin (l'administration ouverte), muette (A modifie la ligne de B, la base ne renvoie
   rien), proprio (A ne peut pas modifier sa propre ligne), absente (aucune table). */
function fausseBase(trou = '') {
  const tables = {
    app_state: new Map([[B.id, { user_id: B.id, board: {}, site: { notes: ['de B'] }, updated_at: '2026-10-01T10:00:00Z' }]]),
    assistant_keys: new Map([[A.id, { user_id: A.id, chiffre: 'x', iv: 'y', indice: 'z' }]])
  };
  const comptes = [A, B];
  const appels = [];
  const rep = (status, json) => new Response(json === undefined ? '' : JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  const rls = qui => rep(qui ? 403 : 401, { code: '42501', message: 'new row violates row-level security policy' });

  async function fetch(url, opts = {}) {
    const u = new URL(url), methode = opts.method || 'GET', h = opts.headers || {};
    appels.push({ methode, chemin: u.pathname + u.search, h });
    const corps = opts.body ? JSON.parse(opts.body) : undefined;
    if (u.pathname === '/auth/v1/token') {
      const c = comptes.find(x => x.email === corps.email && x.motDePasse === corps.password);
      return c ? rep(200, { access_token: c.jeton, user: { id: c.id.toUpperCase() } }) : rep(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    const qui = comptes.find(c => h.Authorization === `Bearer ${c.jeton}`)?.id || null;
    if (u.pathname === '/auth/v1/admin/users') return trou === 'admin' ? rep(200, { users: comptes.map(c => ({ id: c.id })) }) : rep(qui ? 403 : 401, { error_code: 'not_admin', msg: 'User not allowed' });
    const nom = u.pathname.replace('/rest/v1/', ''), t = tables[nom];
    if (!t || trou === 'absente') return rep(404, { code: 'PGRST205', message: `Could not find the table 'public.${nom}'` });
    const cles = nom === 'assistant_keys';
    const voit = l => trou === 'lecture' || (cles ? trou === 'cles' : l.user_id === qui);
    const modifie = l => trou === 'ecriture' || trou === 'muette' || (cles ? trou === 'cles' : l.user_id === qui && trou !== 'proprio');
    const accepte = l => trou === 'ecriture' || (cles ? trou === 'cles' : l.user_id === qui);
    const efface = () => trou === 'suppression' || (cles && trou === 'cles');
    const eq = u.searchParams.get('user_id')?.replace(/^eq\./, '');
    const vise = [...t.values()].filter(l => !eq || l.user_id === eq);
    const rendu = (lignes, status = 200) => rep(status, (h.Prefer || '').includes('return=minimal') ? undefined : lignes);

    if (methode === 'GET') return rep(200, vise.filter(voit));
    if (methode === 'PATCH') {
      const faits = [];
      for (const l of vise.filter(modifie)) {
        const n = { ...l, ...corps };
        if (!accepte(n) && trou !== 'muette') return rls(qui);
        if (n.user_id !== l.user_id && t.has(n.user_id)) return rep(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
        t.delete(l.user_id); t.set(n.user_id, n); faits.push(n);
      }
      return trou === 'muette' ? rep(200, faits.filter(voit)) : rendu(faits);
    }
    if (methode === 'DELETE') {
      const faits = efface() ? vise : [];
      for (const l of faits) t.delete(l.user_id);
      return rendu(faits);
    }
    if (methode === 'POST') {
      if (!accepte(corps)) return rls(qui);
      const avant = t.get(corps.user_id), prefer = h.Prefer || '';
      if (avant && prefer.includes('ignore-duplicates')) return rendu([], 201);
      if (avant && prefer.includes('merge-duplicates')) {
        if (!modifie(avant)) return rls(qui);
        const n = { ...avant, ...corps }; t.set(n.user_id, n); return rendu([n], 201);
      }
      if (avant) return rep(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
      const n = { board: {}, site: {}, updated_at: '2026-10-02T00:00:00Z', ...corps }; t.set(n.user_id, n); return rendu([n], 201);
    }
    return rep(405, {});
  }
  return { fetch, tables, appels };
}

async function lancer(trou, extra = {}) {
  const { isoler } = await isolation;
  const base = fausseBase(trou), lignes = [];
  const sortie = await isoler({ url: URL_TEST, cle: 'sb_publishable_test', a: A, b: B, fetch: base.fetch, log: l => lignes.push(l), ...extra });
  return { ...sortie, base, texte: lignes.join('\n') };
}
const accepte = (s, n) => s.resultats.find(r => r.n === n)?.verdict === 'ACCEPTÉE';

test('isolation : une base conforme à supabase/schema.sql refuse les douze requêtes (code 0)', async () => {
  const s = await lancer('');
  assert.equal(s.code, 0, s.texte);
  assert.equal(s.resultats.length, 12);
  assert.deepEqual(s.resultats.filter(r => r.verdict !== 'refusée'), [], s.texte);
  assert.match(s.texte, /Contrôle final : la ligne de B n'a pas changé/);
  assert.deepEqual(s.base.tables.app_state.get(B.id).site, { notes: ['de B'] }, 'B garde ses données');
  assert.ok(s.base.tables.app_state.has(A.id), 'le montage a créé la ligne de A, comme le fait l’app');
  // Rien de secret dans ce qui s'affiche (la sortie d'un workflow se lit par d'autres).
  for (const secret of [A.motDePasse, B.motDePasse, A.jeton, B.jeton, A.email, B.email, 'sb_publishable_test'])
    assert.ok(!s.texte.includes(secret), `${secret} n’est pas affiché`);
  // Les requêtes sans session n'emportent aucun jeton, seulement la clé publique.
  const anonymes = s.base.appels.filter(x => !x.h.Authorization);
  assert.ok(anonymes.some(x => x.methode === 'PATCH'), 'une écriture est tentée sans session');
  assert.ok(anonymes.every(x => x.h.apikey === 'sb_publishable_test'));
});

test('isolation : chaque trou dans les règles fait échouer le test (code 1) et se voit à sa ligne', async () => {
  const attendus = { lecture: [1, 2, 10], ecriture: [3, 6, 11], suppression: [4], cles: [8, 9], admin: [12] };
  for (const [trou, numeros] of Object.entries(attendus)) {
    const s = await lancer(trou);
    assert.equal(s.code, 1, `${trou} :\n${s.texte}`);
    for (const n of numeros) assert.ok(accepte(s, n), `${trou} : la requête ${n} est acceptée\n${s.texte}`);
    assert.match(s.texte, /Échec : un compte atteint les données d'un autre/);
  }
});

test('isolation : une écriture passée sans rien renvoyer se voit au contrôle final', async () => {
  const s = await lancer('muette');
  assert.equal(s.code, 1, s.texte);
  assert.ok(s.resultats.filter(r => r.verdict === 'ACCEPTÉE').length === 0, 'aucune réponse ne trahit la fuite');
  assert.match(s.texte, /✗ Contrôle final : la ligne de B a changé/);
});

test('isolation : un montage qui ne prouverait rien arrête tout (code 2), sans lancer les douze', async () => {
  const cas = [
    ['mot de passe faux', '', { a: { ...A, motDePasse: 'faux' } }, /le compte A ne se connecte pas \(400 invalid_credentials\)/],
    ['deux fois le même compte', '', { b: A }, /A et B sont le même compte/],
    ['table absente', 'absente', {}, /le compte A n'a pas de ligne \(création 404 PGRST205\)/],
    ['A ne peut pas modifier sa ligne', 'proprio', {}, /le compte A ne peut pas modifier sa propre ligne \(200, liste vide\)/]
  ];
  for (const [nom, trou, extra, message] of cas) {
    const s = await lancer(trou, extra);
    assert.equal(s.code, 2, nom);
    assert.deepEqual(s.resultats, [], `${nom} : aucune requête croisée`);
    assert.match(s.texte, message, nom);
  }
});

test('isolation : le projet de l’app est refusé avant toute requête', async () => {
  const { projetDeLApp, estProduction } = await isolation;
  const appli = projetDeLApp();
  assert.match(appli, /^https:\/\/[a-z0-9]+\.supabase\.co$/, 'lu dans src/app/services/auth.js');
  assert.ok(estProduction(`${appli}/`, appli) && estProduction(`${appli}/rest/v1`, appli));
  assert.ok(!estProduction(URL_TEST, appli) && !estProduction('http://127.0.0.1:54321', appli) && !estProduction('pas une adresse', appli));
  const s = await lancer('', { url: appli });
  assert.equal(s.code, 2);
  assert.equal(s.base.appels.length, 0, 'aucune requête');
  assert.match(s.texte, /est le projet de l'app/);
});

test('isolation : la clé secrète du projet est refusée avant toute requête', async () => {
  const { estSecrete } = await isolation;
  const jwt = role => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.ok(estSecrete('sb_secret_abc') && estSecrete(jwt('service_role')));
  assert.ok(!estSecrete('sb_publishable_abc') && !estSecrete(jwt('anon')) && !estSecrete('') && !estSecrete('pas.une.clé'));
  for (const cle of ['sb_secret_abc', jwt('service_role')]) {
    const s = await lancer('', { cle });
    assert.equal(s.code, 2);
    assert.equal(s.base.appels.length, 0, 'aucune requête');
    assert.match(s.texte, /clé secrète du projet/);
    assert.ok(!s.texte.includes(cle), 'la clé n’est pas affichée');
  }
});

test('isolation : un refus pour une autre raison que la règle reste douteux', async () => {
  const { verdict, detail } = await isolation;
  assert.equal(verdict('refus', { status: 403, json: { code: '42501' } }), 'refusée');
  assert.equal(verdict('refus', { status: 409, json: { code: '23505' } }), 'douteuse', 'une contrainte, pas la RLS');
  assert.equal(verdict('refus', { status: 201, json: [] }), 'ACCEPTÉE');
  assert.equal(verdict('vide', { status: 200, json: [] }), 'refusée');
  assert.equal(verdict('vide', { status: 200, json: [{ user_id: A.id }] }), 'ACCEPTÉE');
  assert.equal(verdict('vide', { status: 404, json: { code: 'PGRST205' } }), 'douteuse');
  assert.equal(verdict('siennes', { status: 200, json: [{ user_id: A.id }] }, A.id), 'refusée');
  assert.equal(verdict('siennes', { status: 200, json: [{ user_id: A.id }, { user_id: B.id }] }, A.id), 'ACCEPTÉE');
  assert.equal(verdict('vide', { status: 0, erreur: 'ECONNREFUSED' }), 'douteuse');
  assert.equal(detail({ status: 200, json: [] }), '200, liste vide');
  assert.equal(detail({ status: 403, json: { code: '42501' } }), '403 42501');
  assert.equal(detail({ status: 0, erreur: 'TimeoutError' }), 'TimeoutError');
});

test('isolation : les écritures à refuser ne demandent rien en retour, comme un compte malveillant', async () => {
  // Avec return=representation, Postgres applique aussi la règle de lecture à la ligne renvoyée : ce second refus
  // masque une règle d'insertion trop large (« with check (true) »), essayé contre PostgreSQL 16 et PostgREST 12.
  const { CONTROLES } = await isolation;
  const c = { a: A, b: B };
  const ecritures = CONTROLES.filter(x => x.attendu === 'refus' && x.req(c).methode);
  assert.equal(ecritures.length, 4);
  for (const x of ecritures) assert.match(x.req(c).prefer, /return=minimal/, x.quoi);
});

test('isolation : le script est déclaré et documenté, chaque variable nommée', async () => {
  const { VARIABLES } = await isolation;
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.isolation, 'node --env-file-if-exists=.env.isolation scripts/isolation.mjs');
  assert.match(fs.readFileSync('.gitignore', 'utf8'), /^\.env\.isolation$/m, 'les mots de passe de test ne partent pas dans le dépôt');
  const doc = fs.readFileSync('docs/compte.md', 'utf8');
  assert.match(doc, /## Vérifier l'isolation entre comptes/);
  for (const v of VARIABLES) assert.ok(doc.includes(v), `${v} expliquée dans docs/compte.md`);
});
