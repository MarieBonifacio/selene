/* Scénario de navigateur : la fonction « assistant » injoignable (pas déployée, refus CORS au pré-vol, hors ligne),
   dans la version hébergée, connectée, assistant activé. Constaté le 30 septembre 2026 : la page redemandait l'état
   de la clé à chaque rendu, se redessinait à chaque échec, et ainsi de suite ; chaque bouton était remplacé entre
   l'appui et le relâchement, et plus aucun ne répondait. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const demo = JSON.parse(fixture());
demo.config.modules = demo.config.modules.filter(m => m.id !== 'assistant').concat({ id: 'assistant', on: true });
demo.config.sky = { name: 'Lille, Hauts-de-France, France', lat: 50.6, lon: 3.1, weather: false, realMoon: true };
demo.config.radar = { words: 'jazz' };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  let calls = 0;
  await ctx.route('https://*.supabase.co/**', r => {
    if (new URL(r.request().url()).pathname === '/functions/v1/assistant') { calls++; return r.abort('failed'); } // ce que voit la page quand le pré-vol échoue
    r.fulfill({ contentType: 'application/json', body: r.request().method() === 'GET' ? '[]' : '{}' });
  });
  await ctx.route('https://public.opendatasoft.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => {
    if (localStorage.getItem('selene-auth-session')) return;
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
  }, [JSON.stringify(demo), session, UID]);
  await p.goto(BASE + '/index.html#accueil'); await p.waitForSelector('[data-act="radar-open"]', { timeout: 10000 }).catch(() => {});

  console.log('assistant injoignable');
  await p.evaluate(() => { window.__rendus = 0; new MutationObserver(() => { window.__rendus++; }).observe(document.querySelector('#main'), { childList: true }); });
  await p.waitForTimeout(3000);
  ok(calls <= 1, `l'état de la clé est demandé une fois, pas en boucle (${calls} demande(s))`);
  ok(await p.evaluate(() => window.__rendus) <= 1, 'la page ne se redessine pas sans cesse');
  await p.click('[data-act="radar-open"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector('#sheet').open), 'les boutons répondent (le radar s’ouvre)');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
