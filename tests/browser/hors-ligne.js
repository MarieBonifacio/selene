/* Scénario de navigateur : le service worker (sw.js) et ce qu'il garde pour le hors-ligne. L'app ouverte une fois, puis
   la politique de confidentialité et la page de présentation : la copie d'index.html du cache est toujours l'app. Avant
   sw.js v3, la dernière page visitée prenait sa place, et Selene, hors ligne, s'ouvrait sur elle. (On lit le cache : la
   coupure du réseau simulée par Playwright n'atteint pas les requêtes du service worker.) Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); // service worker permis
  await ctx.route('https://*.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: r.request().method() === 'GET' ? '{"disable_signup":false}' : '{}' }));
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto(BASE + '/index.html#sans-compte'); await p.waitForSelector('[data-act="welcome-path"]');
    const pret = await p.evaluate(() => navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]) : false);
    if (!pret) { console.log('  – pas de service worker dans ce moteur : rien à vérifier ici'); await b.close(); return; }
    await p.reload(); await p.waitForSelector('[data-act="welcome-path"]');
    check(await p.evaluate(() => !!navigator.serviceWorker.controller), 'le service worker tient la page');
    await p.goto(BASE + '/confidentialite.html'); await p.waitForSelector('h1');
    await p.goto(BASE + '/essai.html'); await p.waitForSelector('#attente'); await p.waitForTimeout(500);
    // Ce que le cache garde pour l'app : le titre de chaque copie d'index.html (une par version du cache).
    const copies = await p.evaluate(async () => {
      const out = [];
      for (const n of await caches.keys()) { const r = await (await caches.open(n)).match('./index.html'); if (r) out.push((await r.text()).match(/<title>([^<]*)/)[1]); }
      return out;
    });
    check(copies.length > 0 && copies.every(t => t === 'Selene'), `le cache garde l’app, pas la dernière page visitée (${copies.join(', ') || 'rien'})`);
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
