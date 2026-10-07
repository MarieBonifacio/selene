/* Scénario de navigateur : le hors-ligne réel (BL-15 du cahier de recette ; SYN-004, SYN-010, PLT-001). Un compte
   connecté sur un faux Supabase, le service worker permis : une première visite, puis le réseau coupé et la page
   rechargée. L'app doit s'ouvrir depuis le cache, avec ses données ; une capture faite hors ligne reste sur l'appareil,
   dite « Non synchronisé », et part au serveur au retour du réseau. La coupure de Playwright (setOffline) n'atteint pas
   les requêtes du service worker : le serveur de fichiers est aussi rendu injoignable par une route, que Chromium
   applique au service worker ; sous Firefox, le rechargement hors ligne n'est pas éprouvé, et le scénario le dit.
   Sous WebKit, rien n'est joué : une page tenue par le service worker y échappe aux routes de Playwright, ses requêtes
   partiraient vers le vrai serveur (CI du 6 octobre 2026). Lancé par tests/browser/run.js. */
const { engine, ENGINE, BASE, launchOptions, check, until, ouvrir, entree } = require('./helpers');
const rows = new Map();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
let coupe = false, appels = 0;
/* Le journal du retour du réseau, écrit en cas d'échec seulement : chaque requête vue par le faux serveur et ce qu'il
   en a fait, celles qui ont échoué, et ce que la page a vu du réseau (A24 : un échec de la CI, au processeur ralenti,
   que la machine locale ne reproduisait pas). */
const T0 = Date.now(), journal = [], note = m => journal.push(`[${((Date.now() - T0) / 1000).toFixed(2)} s] ${m}`);
async function supabase(route) {
  const q = route.request(), qu = new URL(q.url());
  note(`${coupe ? 'coupée' : 'servie'} : ${q.method()} ${qu.pathname} ${qu.searchParams.get('select') || ''}`);
  if (coupe) return route.abort('internetdisconnected'); // la coupure vaut aussi pour le faux serveur
  appels++;
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname === '/rest/v1/activite') return route.fulfill({ status: 201, body: '' });
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  const stamp = (u.searchParams.get('select') || '').match(/^u:(\w+)->>updatedAt$/);
  if (m === 'GET' && stamp) return json(route, 200, row ? [{ u: row[stamp[1]] && row[stamp[1]].updatedAt != null ? String(row[stamp[1]].updatedAt) : null }] : []);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') {
    if (!row) return json(route, 200, []);
    for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = row[c] && row[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(route, 200, []); }
    Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  }
  return json(route, 200, []);
}
const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } });
const serveur = () => ((rows.get('u1') || {}).site?.modules?.inbox?.entries || []).map(i => i.text);
const capture = async (p, text) => { await p.fill('#capIn', text); await p.click('[data-act="cap-add"]'); };
(async () => {
  if (ENGINE === 'webkit') { console.log('  – webkit : une page tenue par le service worker échappe aux routes de Playwright, ses requêtes iraient au vrai serveur : scénario non joué (Chromium, Firefox)'); return; }
  const b = await engine.launch(launchOptions), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); // service worker permis
  await ctx.route('https://*.supabase.co/**', supabase);
  await ctx.addInitScript(() => {
    console.log('§ page chargée, navigator.onLine : ' + navigator.onLine);
    for (const ev of ['online', 'offline']) addEventListener(ev, () => console.log('§ ' + ev));
  });
  await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.text().startsWith('§ ')) note(m.text().slice(2)); });
  p.on('requestfailed', r => { if (/\.supabase\.co\//.test(r.url())) note(`échec : ${r.method()} ${new URL(r.url()).pathname} (${(r.failure() || {}).errorText})`); });
  try {
    console.log('première visite : le service worker s’installe');
    await ouvrir(p, BASE + '/index.html', entree);
    await capture(p, 'en ligne BL-15'); await until(() => serveur().includes('en ligne BL-15'));
    check(serveur().includes('en ligne BL-15'), 'en ligne : la capture part au serveur');
    const pret = await p.evaluate(() => navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]) : false);
    if (!pret) { console.log('  – pas de service worker dans ce moteur : rien à vérifier ici'); check(!errs.length, 'aucune erreur JavaScript'); await b.close(); return; }
    await ouvrir(p, null, entree); // rechargée : la page est désormais tenue par le service worker
    check(await p.evaluate(() => !!navigator.serviceWorker.controller), 'le service worker tient la page');

    console.log('réseau coupé, page rechargée');
    coupe = true; await ctx.setOffline(true); note('réseau coupé');
    // Le serveur de fichiers aussi : Chromium applique la route aux requêtes du service worker, qui doit alors servir
    // l'app depuis son cache. Ailleurs, le service worker atteint encore le serveur : on ne prétend rien éprouver.
    const fichiers = r => r.abort('internetdisconnected');
    await ctx.route(u => u.href.startsWith(BASE), fichiers);
    if (ENGINE === 'chromium') {
      await ouvrir(p, null, entree);
      const ici = await p.evaluate(() => document.querySelector('#main').textContent);
      check(ici.length > 0 && !(await p.$('#authForm')), 'hors ligne, rechargée : l’app s’ouvre depuis le cache, pas l’écran d’entrée');
      await p.evaluate(() => { location.hash = 'inbox'; }); await p.waitForFunction(() => location.hash === '#inbox');
      check((await p.textContent('#main')).includes('en ligne BL-15'), 'avec ses données, relues sur l’appareil');
    } else console.log(`  – ${ENGINE} : le service worker échappe à la coupure simulée ; le rechargement hors ligne n'est éprouvé que sous Chromium`);
    await p.evaluate(() => { location.hash = 'accueil'; }); await p.waitForSelector('#capIn');
    const avant = appels;
    await capture(p, 'hors ligne BL-15');
    await p.waitForFunction(() => /Non synchronisé/.test((document.querySelector('#saving') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
    check(/Non synchronisé — enregistré sur cet appareil seulement/.test(await p.textContent('#saving')), 'une capture hors ligne : « Non synchronisé — enregistré sur cet appareil seulement »');
    check(appels === avant && !serveur().includes('hors ligne BL-15'), 'rien n’est parti au serveur');

    console.log('retour du réseau');
    await ctx.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.route('https://*.supabase.co/**', supabase); // la route des fichiers levée
    coupe = false; await ctx.setOffline(false); note('réseau rendu');
    // Rechargée hors ligne (Chromium), l'app se rebranche au retour du réseau (« online ») ; restée ouverte, ce qui attend
    // part à la relève suivante du serveur, toutes les 30 s.
    await until(() => serveur().includes('hors ligne BL-15'), 40000);
    check(serveur().includes('hors ligne BL-15') && serveur().includes('en ligne BL-15'), `la capture faite hors ligne arrive au serveur, sans rien perdre (${serveur().join(', ')})`);
    await p.waitForFunction(() => !/Non synchronisé/.test((document.querySelector('#saving') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
    const reste = await p.textContent('#saving');
    check(!/Non synchronisé/.test(reste), 'l’indicateur s’efface' + (reste ? ` (« ${reste} »)` : ''));
    if (process.exitCode) console.log('  journal du réseau :\n' + journal.map(l => '    ' + l).join('\n'));
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
