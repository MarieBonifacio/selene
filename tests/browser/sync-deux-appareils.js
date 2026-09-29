/* Scénario de navigateur : deux appareils du même compte, branchés sur un faux Supabase (interception réseau).
   Vérifie la fusion (B n'a jamais vu ce qu'a écrit A) et qu'une saisie faite juste avant de fermer l'onglet
   n'est pas perdue : restée sur l'appareil, elle part à la réouverture. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, check } = require('./helpers');
const rows = new Map();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') {
    if (!row) return json(route, 200, []);
    for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = row[c] && row[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(route, 200, []); }
    Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  }
}
const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } });
const inbox = () => ((rows.get('u1') || {}).site?.modules?.inbox?.entries || []).map(i => i.text);
async function device(browser, errs) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.route('https://*.supabase.co/**', supabase);
  await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/index.html'); await page.waitForTimeout(600);
  return { ctx, page };
}
const capture = async (p, text) => { await p.fill('#capIn', text); await p.click('[data-act="cap-add"]'); };
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  const A = await device(browser, errs);
  check(!!rows.get('u1')?.site?.config, 'le premier appareil crée le compte sur le serveur');
  const B = await device(browser, errs);
  await capture(A.page, 'alpha'); await A.page.waitForTimeout(1500);
  await capture(B.page, 'beta'); await B.page.waitForTimeout(1500); // B n'a jamais vu alpha
  check(inbox().join() === 'alpha,beta', `fusion : les deux captures sur le serveur (${inbox().join(', ')})`);
  await B.page.evaluate(() => location.hash = 'inbox'); await B.page.waitForTimeout(300);
  const t = await B.page.textContent('#main');
  check(t.includes('alpha') && t.includes('beta'), 'B affiche aussi ce qu’a écrit A');
  await capture(A.page, 'gamma'); await A.page.close({ runBeforeUnload: true }); // fermé dans le délai de 900 ms
  await new Promise(r => setTimeout(r, 800));
  const A2 = await A.ctx.newPage(); A2.on('pageerror', e => errs.push(e.message));
  await A2.goto(BASE + '/index.html'); await A2.waitForTimeout(1500);
  check(inbox().includes('gamma'), 'la saisie faite juste avant la fermeture part à la réouverture');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await browser.close();
})();
