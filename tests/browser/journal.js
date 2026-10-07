/* Scénario de navigateur : le journal des erreurs (services/journal.js, docs/compte.md). Une vraie page, connectée à un
   faux Supabase : une exception non rattrapée et une promesse rejetée partent vers /rest/v1/erreurs, sans leur
   message, sans jeton, une fois chacune ; une erreur réseau ne part pas ; couper l'envoi dans Réglages → Compte arrête
   tout. Lancé par tests/browser/run.js. */
const { suivre, calme, engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const recus = [];
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('https://*.supabase.co/**', r => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/rest/v1/erreurs') { recus.push({ corps: req.postDataJSON(), auth: req.headers().authorization, apikey: req.headers().apikey }); return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ contentType: 'application/json', body: req.method() === 'GET' ? '[]' : '{}' });
  });
  await ctx.addInitScript(([d, s]) => {
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1');
  }, [fixture(), session]);
  const p = suivre(await ctx.newPage()), attendues = [];
  p.on('pageerror', e => attendues.push(e.message)); // les erreurs provoquées ici : attendues
  try {
    await p.goto(BASE + '/index.html#reglages'); await p.waitForSelector('[data-act="err-reports"]', { timeout: 10000 });
    const attendre = async n => { for (let i = 0; i < 40 && recus.length < n; i++) await p.waitForTimeout(50); };

    console.log('une exception, une promesse rejetée');
    await p.evaluate(() => { setTimeout(() => { null.CONFIDENTIEL_PAGE; }, 0); });
    await p.evaluate(() => { Promise.reject(new RangeError('SECRET_PROMESSE')); });
    await attendre(2);
    check(recus.length === 2, `deux envois (${recus.length})`);
    check(recus.map(x => x.corps.genre).sort().join() === 'RangeError,TypeError', 'leur nom seulement : TypeError, RangeError');
    check(!/CONFIDENTIEL_PAGE|SECRET_PROMESSE|a@b\.c/.test(JSON.stringify(recus)), 'ni leur message, ni le compte');
    check(recus.every(x => !x.auth && x.apikey), 'la clé publique seule, aucun jeton');
    check(recus.every(x => x.corps.vue === 'reglages' && x.corps.plateforme === 'web' && /^[0-9a-f]{10}$/.test(x.corps.version)), 'écran, plateforme et version');

    console.log('ce qui ne part pas');
    await p.evaluate(() => { Promise.reject(new TypeError('Failed to fetch')); });
    await p.evaluate(() => { setTimeout(() => { null.CONFIDENTIEL_PAGE; }, 0); }); // la même : déjà envoyée
    await p.waitForTimeout(400);
    check(recus.length === 2, 'un réseau coupé, ou la même erreur une seconde fois : rien');

    console.log('coupé dans les Réglages');
    await p.uncheck('[data-act="err-reports"]'); await p.waitForTimeout(100);
    await p.evaluate(() => { setTimeout(() => { undefined.autre(); }, 0); });
    await p.waitForTimeout(400);
    check(recus.length === 2, 'coupé : plus rien ne part');
    await calme(p); await p.reload(); await p.waitForSelector('[data-act="err-reports"]');
    check(!(await p.isChecked('[data-act="err-reports"]')), 'le réglage tient au rechargement, sur cet appareil');
    check(attendues.length >= 3, 'les erreurs provoquées ont bien eu lieu');
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await b.close(); }
})();
