/* Scénario de navigateur : « Reprendre la main », gardé sur cet appareil seulement (ADR 27). Deux appareils du même
   compte sur un faux Supabase (interception réseau), comme sync-deux-appareils.js. On lit le serveur lui-même :
   - choix par défaut à la configuration : sur l'appareil ; le serveur ne reçoit que le talon (nom, présence) ;
   - l'autre appareil voit le nom, pas le contenu ; le supprimer de là prévient qu'il ne retire que le nom ;
   - synchroniser exige l'accord (texte lu, confirmé) ; le retirer rend le talon au serveur ;
   - se déconnecter avec un suivi gardé ici : la garde demande quoi en faire ; effacer vide l'appareil.
   Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, check, storeJSON } = require('./helpers');
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
const server = () => JSON.stringify((rows.get('u1') || {}).site || {});
async function device(browser, errs) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await ctx.route('https://*.supabase.co/**', supabase);
  await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/index.html'); await page.waitForTimeout(600);
  return { ctx, page };
}
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  try {
    const A = await device(browser, errs), p = A.page;
    const settle = (q = p) => q.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const go = async (h, q = p) => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForFunction(x => location.hash === '#' + x, h); await settle(q); };
    const submit = async () => { await p.click('#form button[value="save"]'); await settle(); };
    const ask = async (ok, q = p) => { await q.waitForSelector('#cdlg[open]'); const msg = await q.textContent('#cmsg'); await q.click(`#cdlg button[value="${ok ? 'ok' : 'cancel'}"]`); await settle(q); return msg; };
    const waitServer = async test => { for (let i = 0; i < 60 && !test(server()); i++) await p.waitForTimeout(100); return test(server()); };

    console.log('configuration : sur cet appareil, par défaut');
    await p.waitForSelector('[data-tpl="regulation"]');
    await p.click('[data-tpl="regulation"]'); await go('reprendre-la-main');
    await p.click('[data-act="rlm-setup"]');
    check(await p.inputValue('#form [name="storage"]') === 'device', 'le stockage proposé par défaut : sur cet appareil seulement');
    await p.fill('#form [name="name"]', 'Carnet du soir'); await p.selectOption('#form [name="subject"]', 'alcool');
    await p.click('#form button[value="save"]');
    await p.waitForFunction(() => document.querySelector('#form h2').textContent === 'Mon intention');
    await p.selectOption('#form [name="mode"]', 'reduire'); await p.fill('#form [name="limit"]', '2'); await submit();
    await p.click('[data-act="rlm-use"]'); await p.fill('#form [name="value"]', '1.5'); await p.fill('#form [name="note"]', 'NOTE_PRIVEE'); await submit();
    check(await waitServer(s => s.includes('Carnet du soir')), 'le serveur connaît le nom (talon)');
    await p.waitForTimeout(1500);
    check(!/NOTE_PRIVEE|"subject":"alcool"|"mode":"reduire"/.test(server()), 'le serveur ne reçoit ni la note, ni le sujet, ni l’objectif');
    check((await storeJSON(p, 'selene-local-v1')).modules['reprendre-la-main'].entries.length === 1, 'le contenu est dans le stockage local de l’appareil');

    console.log('l’autre appareil : le nom seulement');
    const B = await device(browser, errs), q = B.page;
    await go('reprendre-la-main', q);
    const tb = await q.textContent('#main');
    check(tb.includes('gardé sur un autre de tes appareils') && !/NOTE_PRIVEE|verre/.test(tb), 'B voit le nom, pas le contenu');
    await go('reglages', q); await q.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await q.locator('.set.mod:has(input[data-act="mod-label"][value="Carnet du soir"]) [data-act="mod-del"]').click();
    await q.waitForFunction(() => document.querySelector('#dlg').open);
    check((await q.textContent('#form')).includes('son nom reviendra'), 'B : supprimer prévient qu’il ne retire que le nom');
    await q.click('#form button[value="cancel"]'); await settle(q);

    console.log('accord, puis retrait');
    await go('reprendre-la-main');
    await p.evaluate(() => { document.querySelector('.rlm-privacy').open = true; });
    await p.click('[data-act="rlm-account"]');
    const consent = await ask(false);
    check(/données de santé/.test(consent) && /sans chiffrement de bout en bout/.test(consent) && /Confirmer vaut accord/.test(consent), 'l’accord dit ce qu’il engage');
    await p.waitForTimeout(1200);
    check(!server().includes('NOTE_PRIVEE'), 'refuser : rien n’est envoyé');
    await p.evaluate(() => { document.querySelector('.rlm-privacy').open = true; });
    await p.click('[data-act="rlm-account"]'); await ask(true);
    check(await waitServer(s => s.includes('NOTE_PRIVEE') && s.includes('"consent"')), 'accepter : le contenu et l’accord daté partent au serveur');
    await p.evaluate(() => { document.querySelector('.rlm-privacy').open = true; });
    await p.click('[data-act="rlm-device"]');
    check((await ask(true)).includes("sauvegardes techniques de l'hébergeur"), 'le retrait dit ce qu’il ne peut pas effacer');
    check(await waitServer(s => !s.includes('NOTE_PRIVEE') && !s.includes('"consent"')), 'retirer l’accord : le serveur n’a plus que le talon');
    check((await p.textContent('#main')).includes('1,5 verre standard'), 'rien de perdu sur l’appareil');

    console.log('téléphone : nouveaux écrans sans débordement');
    const overflow = x => x.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    for (const x of [p, q]) await x.setViewportSize({ width: 390, height: 844 });
    await go('reprendre-la-main'); await p.evaluate(() => { document.querySelector('.rlm-privacy').open = true; });
    check(!(await overflow(p)), 'détenteur : section confidentialité et boutons de stockage');
    await go('reprendre-la-main', q);
    check(!(await overflow(q)), 'autre appareil : la vue du talon');
    if (process.env.SHOTS) { await p.screenshot({ path: `${process.env.SHOTS}/appareil-detenteur.png`, fullPage: true }); await q.screenshot({ path: `${process.env.SHOTS}/appareil-autre.png`, fullPage: true }); }
    for (const x of [p, q]) await x.setViewportSize({ width: 1280, height: 900 });

    console.log('déconnexion : la garde');
    await go('reglages'); await p.click('[data-act="auth-out"]');
    await p.waitForFunction(() => document.querySelector('#dlg').open && document.querySelector('#form h2').textContent === 'Avant de te déconnecter');
    check((await p.textContent('#form')).includes('Carnet du soir'), 'la garde nomme ce qui n’existe qu’ici');
    await p.click('#form button[value="cancel"]'); await settle(); await p.waitForTimeout(300);
    check(!!(await p.$('[data-act="auth-out"]')), 'annuler : toujours connectée, rien d’effacé');
    await p.click('[data-act="auth-out"]'); await p.waitForFunction(() => document.querySelector('#dlg').open);
    await p.selectOption('#form [name="what"]', 'erase'); await submit();
    check((await ask(true)).includes('aucune autre copie'), 'effacer : une dernière confirmation');
    await p.waitForSelector('#authForm');
    check((await storeJSON(p, 'selene-local-v1').catch(() => null))?.modules?.['reprendre-la-main'] == null, 'déconnectée : plus rien du suivi sur l’appareil');
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await browser.close(); }
})();
