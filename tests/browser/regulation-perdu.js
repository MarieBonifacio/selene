/* Scénario de navigateur : « Reprendre la main », l'appareil détenteur a perdu son stockage (BL-01 du cahier de recette,
   cas RLM-029, étapes 1 à 3 ; l'étape 4, identité d'appareil perdue elle aussi, attend une décision). Compte personnel sur
   un faux Supabase, comme regulation-appareil.js :
   - une saisie, puis la sauvegarde complète téléchargée ;
   - seul selene-local-v1 effacé (l'identité de l'appareil gardée), rechargement : l'espace l'avoue et dit quoi faire ;
   - la sauvegarde réimportée : le suivi est entier, de nouveau gardé ici ;
   - effacé encore, puis retiré par les Réglages : sans l'avertissement « il n'y a que le nom », et le nom quitte le compte.
   Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const { engine, BASE, launchOptions, check, storeGet, storeJSON, storeSet } = require('./helpers');
const rows = new Map();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
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
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(600);
    const settle = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForFunction(x => location.hash === '#' + x, h); await settle(); };
    const submit = async () => { await p.click('#form button[value="save"]'); await settle(); };
    const ask = async ok => { await p.waitForSelector('#cdlg[open]'); const msg = await p.textContent('#cmsg'); await p.click(`#cdlg button[value="${ok ? 'ok' : 'cancel'}"]`); await settle(); return msg; };
    const waitServer = async test => { for (let i = 0; i < 60 && !test(server()); i++) await p.waitForTimeout(100); return test(server()); };
    const reload = async () => { await p.reload(); await p.waitForTimeout(600); };
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
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await browser.close(); }
})();
