/* Scénario de navigateur : « Reprendre la main », l'appareil détenteur a perdu son stockage (BL-01 du cahier de recette,
   cas RLM-029, étapes 1 à 3 ; l'étape 4, identité d'appareil perdue elle aussi, attend une décision). Compte personnel sur
   un faux Supabase, comme regulation-appareil.js :
   - une saisie, puis la sauvegarde complète téléchargée ;
   - seul selene-local-v1 effacé (l'identité de l'appareil gardée), rechargement : l'espace l'avoue et dit quoi faire ;
   - la sauvegarde réimportée : le suivi est entier, de nouveau gardé ici ;
   - effacé encore, puis retiré par les Réglages : sans l'avertissement « il n'y a que le nom », et le nom quitte le compte.
   Puis RLM-027 : un autre compte connecté sur l'appareil, la session du premier perdue ; ses suivis mis de côté, jamais
   montrés, retrouvés à son retour, même après la déconnexion de l'autre (A48).
   Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const { engine, BASE, launchOptions, check, storeGet, storeJSON, storeSet, ouvrir, entree } = require('./helpers');
const rows = new Map();
const COMPTES = { 'p@exemple.org': { id: 'u5', personnel: true }, 'a@exemple.org': { id: 'u6' } }; // RLM-027 : P, puis A
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname === '/auth/v1/token' || u.pathname === '/auth/v1/signup') { // la connexion par le formulaire (RLM-027)
    const b = (() => { try { return req.postDataJSON() || {}; } catch { return {}; } })(), c = COMPTES[b.email];
    if (c) return json(route, 200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: c.id, email: b.email, app_metadata: c.personnel ? { selene_personnel: true } : {} } });
  }
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname === '/rest/v1/activite') return route.fulfill({ status: 201, body: '' });
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') {
    if (!row) return json(route, 200, []);
    for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = row[c] && row[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(route, 200, []); }
    Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  }
}
const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c', personnel: true } });
const server = () => JSON.stringify((rows.get('u1') || {}).site || {});
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  try {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await ctx.route('https://*.supabase.co/**', supabase);
    await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ouvrir(p, BASE + '/index.html', entree); // connecté : l'app, pas l'écran d'entrée (A16)
    const settle = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForFunction(x => location.hash === '#' + x, h); await settle(); };
    const submit = async () => { await p.click('#form button[value="save"]'); await settle(); };
    const ask = async ok => { await p.waitForSelector('#cdlg[open]'); const msg = await p.textContent('#cmsg'); await p.click(`#cdlg button[value="${ok ? 'ok' : 'cancel'}"]`); await settle(); return msg; };
    const waitServer = async test => { for (let i = 0; i < 60 && !test(server()); i++) await p.waitForTimeout(100); return test(server()); };
    const reload = () => ouvrir(p, null, entree);
    const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');

    console.log('un suivi gardé ici, une saisie, la sauvegarde complète');
    await p.waitForSelector('#welcome-all', { state: 'attached' }); await p.evaluate(() => { document.getElementById('welcome-all').open = true; });
    await p.click('[data-tpl="regulation"]'); await go('reprendre-la-main');
    await p.click('[data-act="rlm-setup"]');
    await p.fill('#form [name="name"]', 'Carnet du soir'); await p.selectOption('#form [name="subject"]', 'tabac');
    await p.click('#form button[value="save"]');
    await p.waitForFunction(() => document.querySelector('#form h2').textContent === 'Mon intention');
    await p.selectOption('#form [name="mode"]', 'observer'); await submit();
    await p.click('[data-act="rlm-use"]'); await p.fill('#form [name="value"]', '3'); await p.fill('#form [name="note"]', 'NOTE_RLM029'); await submit();
    check(await waitServer(s => s.includes('Carnet du soir')), 'le compte connaît le nom (talon)');
    await go('reglages');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="exp"]')]);
    const backup = fs.readFileSync(await dl.path(), 'utf8');
    check(backup.includes('NOTE_RLM029') && backup.includes('"tabac"'), 'la sauvegarde complète contient le suivi gardé ici');

    console.log('le stockage du suivi effacé, l’appareil gardé');
    const device = await storeGet(p, 'selene-device-id');
    await storeSet(p, 'selene-local-v1', null); await reload(); await go('reprendre-la-main');
    const lost = await main();
    check(lost.includes('Ce suivi devait être gardé sur cet appareil, mais ses données n\'y sont plus') && lost.includes('Une sauvegarde complète faite ici peut les restaurer'), 'l’espace avoue la perte, et dit quoi faire');
    check(!lost.includes('NOTE_RLM029') && !lost.includes('gardé sur un autre de tes appareils'), 'ni contenu, ni l’explication d’un autre appareil : c’est bien celui-ci');
    check(!!device && await storeGet(p, 'selene-device-id') === device, `l’identité de l’appareil est restée (${device})`);

    console.log('la sauvegarde réimportée');
    await go('reglages');
    await p.setInputFiles('input[data-act="imp"]', { name: 'selene-sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    check((await ask(true)).includes('Remplacer tout l\'état actuel'), 'importer demande confirmation');
    await p.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Sauvegarde importée'));
    await go('reprendre-la-main');
    const back = await main();
    check(back.includes('NOTE_RLM029') && back.includes('Tabac'), 'le suivi est entier, sa saisie comprise');
    check((await storeJSON(p, 'selene-local-v1')).modules['reprendre-la-main'].entries.length === 1, 'de nouveau gardé sur cet appareil');
    await p.waitForTimeout(1200);
    check(!server().includes('NOTE_RLM029'), 'la restauration n’envoie pas le contenu au compte');

    console.log('perdu encore, puis retiré');
    await storeSet(p, 'selene-local-v1', null); await reload(); await go('reglages');
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await p.locator('.set.mod:has(input[data-act="mod-label"][value="Carnet du soir"]) [data-act="mod-del"]').click();
    await p.waitForFunction(() => document.querySelector('#dlg').open);
    check(!(await p.textContent('#form')).includes('il n\'y a que le nom'), 'l’appareil détenteur ne prévient pas comme un autre appareil');
    await p.fill('#form [name="confirm"]', 'Carnet du soir'); await submit();
    check((await p.textContent('#toast')).includes('« Carnet du soir » supprimé.'), 'supprimé, et dit');
    check(await waitServer(s => !s.includes('Carnet du soir')), 'le nom quitte le compte : plus de talon impossible à effacer');
    // Le premier appareil reste ouvert : fermé avec une requête en vol, WebKit lève une erreur que le contrôle final
    // prendrait pour celle de l'app (A50). Le navigateur entier se ferme à la fin.

    console.log('un autre compte sur le même appareil, sans déconnexion (RLM-027)');
    // La session posée une fois (sessionStorage survit au rechargement de l'onglet) : retirée à la main, elle ne revient pas.
    const cx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    await cx.route('https://*.supabase.co/**', supabase);
    const sessionP = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u5', email: 'p@exemple.org', personnel: true } });
    await cx.addInitScript(s => { if (!sessionStorage.getItem('rlm027')) { sessionStorage.setItem('rlm027', '1'); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u5'); } }, sessionP);
    const z = await cx.newPage(); z.on('pageerror', e => errs.push(e.message));
    const vers = async (h, sel) => { await z.evaluate(x => { location.hash = x; }, h); await z.waitForSelector(sel, { state: 'attached' }); };
    await ouvrir(z, BASE + '/index.html', entree);
    await z.waitForSelector('#welcome-all', { state: 'attached' }); await z.evaluate(() => { document.getElementById('welcome-all').open = true; });
    await z.click('[data-tpl="regulation"]'); await vers('reprendre-la-main', '[data-act="rlm-setup"]'); await z.click('[data-act="rlm-setup"]');
    await z.fill('#form [name="name"]', 'Carnet du soir'); await z.selectOption('#form [name="subject"]', 'alcool'); await z.click('#form button[value="save"]');
    await z.waitForFunction(() => document.querySelector('#form h2').textContent === 'Mon intention');
    await z.selectOption('#form [name="mode"]', 'observer'); await z.click('#form button[value="save"]'); await z.waitForFunction(() => !document.querySelector('#dlg').open);
    await z.click('[data-act="rlm-use"]'); await z.fill('#form [name="value"]', '1'); await z.fill('#form [name="note"]', 'NOTE-RLM027'); await z.click('#form button[value="save"]');
    await z.waitForFunction(() => !document.querySelector('#dlg').open);
    const serveur5 = () => JSON.stringify((rows.get('u5') || {}).site || {});
    for (let i = 0; i < 60 && !serveur5().includes('Carnet du soir'); i++) await z.waitForTimeout(100);
    const kv = k => storeGet(z, k).catch(() => null);
    const connexion = async email => {
      if (!(await z.$('#authForm'))) { await z.click('[data-act="auth-open"] >> nth=0'); await z.waitForSelector('#authForm'); }
      await z.fill('#authEmail', email); await z.fill('#authPw', 'une phrase assez longue'); await z.click('#authForm button[type="submit"]');
      await z.waitForFunction(() => !!document.querySelector('#nav > *') && !document.querySelector('#authForm'), null, { timeout: 10000 }).catch(() => {});
    };
    await z.evaluate(() => localStorage.removeItem('selene-auth-session'));
    await z.reload(); await z.waitForSelector('#authForm, [data-act="auth-open"], [data-act="auth-local"]', { timeout: 10000 }).catch(() => {});
    const dehors27 = await z.evaluate(() => ({ entree: !!document.querySelector('#authForm, [data-act="auth-local"]'), nav: (document.querySelector('#nav') || {}).textContent || '' }));
    check(dehors27.entree && !dehors27.nav.includes('Carnet du soir'), 'session retirée, rechargée : l’app n’est plus connectée, l’écran d’entrée (RLM-027, étape 1)');
    await connexion('a@exemple.org');
    await vers('recherche', '#searchIn'); await z.fill('#searchIn', 'NOTE-RLM027'); await z.waitForTimeout(300);
    const trouve27 = await z.evaluate(() => [...document.querySelectorAll('#main li, #main .item')].some(x => x.textContent.includes('NOTE-RLM027')));
    const stash = await kv('selene-local-v1:u5'), ici27 = await kv('selene-local-v1');
    check(!(await z.textContent('#nav')).includes('Carnet du soir') && !trouve27 && !(ici27 || '').includes('NOTE-RLM027') && (stash || '').includes('NOTE-RLM027'),
      'A connecté : aucun suivi de P dans la navigation, NOTE-RLM027 introuvable ; l’entrée selene-local-v1:<P> existe et le garde (RLM-027, étape 2)');
    await vers('reglages', '[data-act="auth-out"]'); await z.click('[data-act="auth-out"]');
    await z.waitForTimeout(300);
    const garde27 = await z.evaluate(() => document.querySelector('#dlg').open && (document.querySelector('#form h2') || {}).textContent === 'Avant de te déconnecter');
    if (await z.$('#cdlg[open]')) await z.click('#cdlg button[value="ok"]');
    await z.waitForSelector('#authForm, [data-act="auth-local"]', { timeout: 10000 }).catch(() => {});
    check(!garde27 && !!(await z.$('#authForm, [data-act="auth-local"]')), 'A déconnecté : aucune garde, l’écran d’entrée (RLM-027, étape 3)');
    await connexion('p@exemple.org');
    await vers('reprendre-la-main', '#main'); await z.waitForFunction(() => document.querySelector('#main').textContent.includes('NOTE-RLM027'), null, { timeout: 5000 }).catch(() => {});
    const retour27 = (await z.textContent('#main')).includes('NOTE-RLM027'), reste27 = await kv('selene-local-v1:u5');
    check(retour27 && (await z.textContent('#nav')).includes('Carnet du soir') && !reste27, 'P reconnecté : le suivi entier, la saisie NOTE-RLM027 ; l’entrée selene-local-v1:<P> a disparu (RLM-027, étape 4)' + (retour27 ? '' : ` (mise de côté : ${reste27 ? 'toujours là' : 'absente'})`));
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await browser.close(); }
})();
