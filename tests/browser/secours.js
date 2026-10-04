/* Scénario de navigateur : la copie de secours (platform.js, ADR 13 révisée) quand IndexedDB refuse une écriture
   (quota plein, transaction annulée). La valeur n'existe plus qu'en mémoire ; à la fermeture, la copie de secours la
   dépose dans localStorage, et le démarrage suivant la reverse dans IndexedDB. La perte est provoquée pour de bon :
   l'écriture IndexedDB de la saisie est annulée, et le serveur est injoignable (rien ne la sauve par là). On vérifie
   qu'elle manque bien dans IndexedDB, qu'elle est dans la copie, puis qu'elle revient à la réouverture et part au
   serveur. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, check, until, storeGet } = require('./helpers');
const rows = new Map();
let online = true;
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  if (!online) return route.abort();
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  const stamp = (u.searchParams.get('select') || '').match(/^u:(\w+)->>updatedAt$/); // la date seule (relecture)
  if (m === 'GET' && stamp) return json(route, 200, row ? [{ u: row[stamp[1]] && row[stamp[1]].updatedAt != null ? String(row[stamp[1]].updatedAt) : null }] : []);
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
// Une page du même site qui ne lance pas Selene (une adresse absente) : pour lire IndexedDB et localStorage tels quels.
const peek = async ctx => {
  const p = await ctx.newPage(); await p.goto(BASE + '/rien-ici');
  const site = await storeGet(p, 'selene-site-v1');
  const journals = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('selene-secours:')).map(k => localStorage.getItem(k)));
  await p.close();
  return { site: site || '', journals };
};
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  try {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.route('https://*.supabase.co/**', supabase);
    await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await until(() => !!rows.get('u1')?.site?.config);
    await p.fill('#capIn', 'alpha'); await p.click('[data-act="cap-add"]'); await until(() => inbox().includes('alpha'));

    console.log('une saisie dont IndexedDB refuse l’écriture, serveur injoignable, puis la fermeture');
    online = false;
    await p.evaluate(() => { // l'écriture qui contient « delta » est annulée, comme une transaction refusée (quota)
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (v, k) { const r = put.call(this, v, k); if (k === 'selene-site-v1' && String(v).includes('delta')) this.transaction.abort(); return r; };
    });
    await p.fill('#capIn', 'delta'); await p.click('[data-act="cap-add"]'); await p.waitForTimeout(300);
    // La fermeture, comme le navigateur la fait : « pagehide » (Selene y dépose la copie de secours), puis la page
    // disparaît. Déclenché ici plutôt que par close({ runBeforeUnload: true }), que WebKit ne mène pas à son terme.
    await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await p.close();
    const after = await peek(ctx);
    check(after.site.includes('alpha') && !after.site.includes('delta'), 'la perte est réelle : « delta » manque dans IndexedDB');
    check(after.journals.some(j => j.includes('delta')), 'la copie de secours l’a gardée à la fermeture');
    check(!inbox().includes('delta'), 'le serveur ne l’a pas non plus');

    console.log('la réouverture : la copie reversée, puis l’envoi');
    online = true;
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
    await p2.goto(BASE + '/index.html#inbox'); await until(() => inbox().includes('delta'), 20000);
    // L'écran, lui, s'attend : sous la charge de la CI, l'envoi au serveur peut précéder l'affichage lu ici.
    const vue = await p2.waitForFunction(() => (document.querySelector('#main') || {}).textContent?.includes('delta'), null, { timeout: 20000 }).then(() => '', async () => `${await p2.evaluate(() => location.hash)} : ${(await p2.textContent('#main')).replace(/\s+/g, ' ').slice(0, 160)}`);
    check(!vue, 'la saisie est revenue sur l’appareil' + (vue ? ` (à l’écran ${vue})` : ''));
    check(inbox().includes('delta') && inbox().includes('alpha'), 'et elle est partie au serveur');
    const later = await peek(ctx);
    check(later.journals.length === 0, 'les copies reversées sont effacées');
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await browser.close(); }
})();
