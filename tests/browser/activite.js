/* Scénario de navigateur : la mesure d'usage de la bêta (services/activite.js, E4 de l'audit). Version hébergée, un
   faux Supabase. Ouvrir ne compte pas ; une capture, si : un jour, avec la session, rien d'autre ; une seconde capture
   le même jour, non ; l'interrupteur de Réglages → Compte la coupe. Rien n'est écrit sur l'appareil pour elle. Lancé
   par tests/browser/run.js. */
const { engine, BASE, launchOptions, check, until } = require('./helpers');
const session = JSON.stringify({ access_token: 'jeton-a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'iris@exemple.org' } });
(async () => {
  const b = await engine.launch(launchOptions), errs = [], recus = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
  const lignes = new Map();
  await ctx.route('https://*.supabase.co/**', route => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/rest/v1/activite') { recus.push({ corps: req.postDataJSON(), auth: req.headers().authorization }); return route.fulfill({ status: 201, body: '' }); }
    if (u.pathname.startsWith('/auth/')) return json(200, {});
    if (u.pathname === '/rest/v1/app_state') {
      const sel = u.searchParams.get('select') || '', ligne = lignes.get('u1');
      if (m === 'GET') { const d = sel.match(/^u:(\w+)->>updatedAt$/); return json(200, ligne ? [d ? { u: ligne[d[1]] && ligne[d[1]].updatedAt != null ? String(ligne[d[1]].updatedAt) : null } : { [sel]: ligne[sel] }] : []); }
      if (m === 'POST') { if (!ligne) lignes.set('u1', { board: {}, site: {} }); return route.fulfill({ status: 201, body: '' }); }
      if (m === 'PATCH') {
        if (!ligne) return json(200, []);
        for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = ligne[c] && ligne[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(200, []); }
        Object.assign(ligne, req.postDataJSON()); return json(200, [{ user_id: 'u1' }]);
      }
    }
    return json(200, []);
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto(BASE + '/index.html'); await p.waitForSelector('#capIn'); await until(() => !!lignes.get('u1')?.site?.config); await p.waitForTimeout(500);
    check(!recus.length, 'ouvrir Selene ne compte pas');
    await p.fill('#capIn', 'CONFIDENTIEL_JOUR'); await p.click('[data-act="cap-add"]');
    await until(() => recus.length > 0, 5000);
    check(recus.length === 1 && Object.keys(recus[0].corps).join() === 'jour' && /^\d{4}-\d{2}-\d{2}$/.test(recus[0].corps.jour), 'une capture : un jour, rien d’autre');
    check(recus[0] && recus[0].auth === 'Bearer jeton-a' && !JSON.stringify(recus).includes('CONFIDENTIEL'), 'avec la session, sans ce qui est écrit');
    await p.fill('#capIn', 'une autre'); await p.click('[data-act="cap-add"]'); await p.waitForTimeout(600);
    check(recus.length === 1, 'le même jour : une fois');
    const traces = await p.evaluate(() => Object.keys(localStorage).filter(k => /activ/i.test(k)));
    check(!traces.length, 'rien sur l’appareil pour la mesure' + (traces.length ? ' : ' + traces.join(', ') : ''));

    console.log('coupée depuis les Réglages');
    await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('[data-act="activity"]');
    check(await p.isChecked('[data-act="activity"]') && (await p.textContent('#main')).includes('Compter mes jours d\'usage'), 'Réglages → Compte : l’interrupteur, allumé, et ce qu’il compte');
    await p.uncheck('[data-act="activity"]');
    await p.evaluate(() => { location.hash = 'accueil'; }); await p.reload(); await p.waitForSelector('#capIn'); await p.waitForTimeout(300);
    await p.fill('#capIn', 'coupée'); await p.click('[data-act="cap-add"]'); await p.waitForTimeout(800);
    check(recus.length === 1, 'coupée : plus rien, même après un rechargement');
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
