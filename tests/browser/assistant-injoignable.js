/* Scénario de navigateur : la fonction « assistant » injoignable (pas déployée, refus CORS au pré-vol, hors ligne),
   dans la version hébergée, connectée, assistant activé. Constaté le 30 septembre 2026 : la page redemandait l'état
   de la clé à chaque rendu, se redessinait à chaque échec, et ainsi de suite ; chaque bouton était remplacé entre
   l'appui et le relâchement, et plus aucun ne répondait. Lancé par tests/browser/run.js. */
const { suivre, calme, fauxSupabase, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const demo = JSON.parse(fixture());
demo.config.modules = demo.config.modules.filter(m => m.id !== 'assistant').concat({ id: 'assistant', on: true });
demo.config.sky = { name: 'Lille, Hauts-de-France, France', lat: 50.6, lon: 3.1, weather: false, realMoon: true };
demo.config.radar = { words: 'jazz' };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const p = suivre(await ctx.newPage()); p.on('pageerror', e => errs.push(e.message));
  let calls = 0;
  await fauxSupabase(ctx, r => {
    if (new URL(r.request().url()).pathname === '/functions/v1/assistant') { calls++; return r.abort('failed'); } // ce que voit la page quand le pré-vol échoue
  });
  await ctx.route('https://public.opendatasoft.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => {
    if (localStorage.getItem('selene-auth-session')) return;
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
  }, [JSON.stringify(demo), session, UID]);
  await p.goto(BASE + '/index.html#accueil'); await p.waitForSelector('[data-act="radar-open"]', { timeout: 10000 }).catch(() => {});

  console.log('assistant injoignable');
  // Compter une fois l'app au repos : son branchement, qui réussit (BL-23), redessine la page deux ou trois fois au
  // démarrage. Une boucle (l'état de la clé redemandé sans fin) empêcherait ce calme, puis redessinerait encore.
  await calme(p);
  await p.evaluate(() => { window.__rendus = 0; new MutationObserver(() => { window.__rendus++; }).observe(document.querySelector('#main'), { childList: true }); });
  await p.waitForTimeout(3000);
  ok(calls <= 1, `l'état de la clé est demandé une fois, pas en boucle (${calls} demande(s))`);
  ok(await p.evaluate(() => window.__rendus) <= 1, 'la page ne se redessine pas sans cesse');
  await p.click('[data-act="radar-open"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector('#sheet').open), 'les boutons répondent (le radar s’ouvre)');

  console.log('l’assistant dit ce qui manque, au lieu de « Colle ta clé »');
  await p.evaluate(() => { location.hash = 'assistant'; }); await p.waitForTimeout(500);
  const statut = await p.textContent('.status');
  ok(statut.includes('Assistant injoignable (hors ligne, ou pas encore déployé).') && !statut.includes('Pas encore branché'), `la vue le dit (${statut.trim().slice(0, 90)})`);
  await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('[data-act="as-key"]', { timeout: 5000 });
  ok((await p.textContent('#assistant-cfg')).includes('Assistant injoignable (hors ligne, ou pas encore déployé).'), 'les Réglages aussi');
  await p.fill('[data-act="as-key"]', 'sk-ant-api03-' + 'a'.repeat(40)); await p.press('[data-act="as-key"]', 'Tab'); await p.waitForTimeout(400);
  ok((await p.textContent('#toast')).includes('Clé non enregistrée : Assistant injoignable'), 'coller une clé : la cause, pas « connecte-toi »');

  // La fonction répond 404 (pas déployée) ou 503 (pas configurée) : on le dit, on n'insiste pas, on ne boucle pas.
  for (const [status, phrase] of [[404, 'Assistant non déployé (voir docs/assistant.md).'], [503, 'Assistant non configuré.']]) {
    const c2 = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }), q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
    let appels = 0;
    await fauxSupabase(c2, r => {
      if (new URL(r.request().url()).pathname === '/functions/v1/assistant') { appels++; return r.fulfill({ status, contentType: 'application/json', body: '{}' }); }
    });
    await c2.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } },
      [JSON.stringify(demo), JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } }), UID]);
    await q.goto(BASE + '/index.html#assistant'); await q.waitForSelector('.status', { timeout: 10000 }); await q.waitForTimeout(800);
    const s404 = await q.textContent('.status');
    ok(s404.includes(phrase) && !s404.includes('Pas encore branché'), `${status} : la vue dit « ${phrase} » (${s404.trim().slice(0, 80)})`);
    await q.evaluate(() => { location.hash = 'reglages'; }); await q.waitForSelector('[data-act="as-key"]', { timeout: 5000 });
    await q.fill('[data-act="as-key"]', 'sk-ant-api03-' + 'a'.repeat(40)); await q.press('[data-act="as-key"]', 'Tab'); await q.waitForTimeout(400);
    const toast = await q.textContent('#toast');
    ok(toast.includes('Clé non enregistrée : ' + phrase) && !toast.includes('connectée'), `${status} : coller une clé dit la cause, pas « demande d'être connectée » (${toast.trim().slice(0, 90)})`);
    await q.waitForTimeout(2000);
    ok(appels === 1, `${status} : une seule demande à la fonction, pas de boucle (${appels})`);
    await c2.close();
  }

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
