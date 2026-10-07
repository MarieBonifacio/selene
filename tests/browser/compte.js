/* Scénario de navigateur : supprimer son compte depuis l'app (ADR 20, docs/compte.md). Faux Supabase, fausse fonction
   « compte » : rien ne part sans la confirmation tapée puis acceptée ; une panne laisse tout en place ; une réussite
   vide l'appareil (données, session) et ramène à l'écran de connexion. Lancé par tests/browser/run.js. */
const { fauxSupabase, engine, BASE, launchOptions, fixture, check, until, storeGet } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [], appels = [];
  let panne = true;
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await fauxSupabase(ctx, r => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname !== '/functions/v1/compte') return;
    appels.push({ corps: req.postDataJSON(), auth: req.headers().authorization });
    if (panne) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erreur: 'données non effacées ; réessaie' }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ supprime: true }) });
  });
  await ctx.addInitScript(([d, s, uid]) => {
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
  }, [fixture(), session, UID]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#reglages'); await p.waitForSelector('#auth-delete', { timeout: 10000 }).catch(() => {});

  console.log('garde-fous');
  ok(!!(await p.$('#auth-delete')), 'connecté : Réglages → Compte propose la suppression');
  ok(!!(await p.$('a[href$="confidentialite.html"]')), 'la politique de confidentialité est liée depuis les Réglages');
  await p.click('#auth-delete summary');
  await p.click('[data-act="auth-delete"]'); await p.waitForTimeout(200);
  ok(appels.length === 0 && !(await p.isVisible('#cdlg')), 'sans « supprimer » tapé : rien ne part');
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]');
  await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=cancel]'); await p.waitForTimeout(200);
  ok(appels.length === 0, 'annulé à la confirmation : rien ne part');

  console.log('panne du serveur');
  await p.click('[data-act="auth-delete"]'); await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=ok]');
  await until(() => appels.length === 1); await p.waitForTimeout(300);
  ok(appels[0] && appels[0].corps.action === 'supprimer' && appels[0].corps.confirmation === 'supprimer' && appels[0].auth === 'Bearer a', 'la demande part avec la session');
  ok((await p.textContent('#toast').catch(() => '')).includes('non supprimé') || (await p.textContent('body')).includes('non supprimé'), 'l’échec est dit');
  ok(await p.evaluate(() => !!localStorage.getItem('selene-auth-session')) && !!(await p.$('#auth-delete')), 'et rien n’est effacé de l’appareil');

  console.log('suppression');
  panne = false;
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]');
  await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=ok]');
  await until(() => appels.length === 2);
  await p.waitForFunction(() => !localStorage.getItem('selene-auth-session'), null, { timeout: 5000 }).catch(() => {});
  ok(await p.evaluate(() => !localStorage.getItem('selene-auth-session')), 'la session est effacée');
  const site = await storeGet(p, 'selene-site-v1');
  ok(!site || !site.includes('iamamiwhoami'), 'les données du compte ont quitté l’appareil');
  ok(!(await p.$('#auth-delete')), 'plus de compte à supprimer');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
