/* Scénario de navigateur : le hors-ligne réel (BL-15 du cahier de recette ; SYN-004, SYN-010, PLT-001). Un compte
   connecté sur un faux Supabase, le service worker permis : une première visite, puis le réseau coupé et la page
   rechargée. L'app doit s'ouvrir depuis le cache, avec ses données ; une capture, un fragment et une dépense faits hors
   ligne restent sur l'appareil, dits « Non synchronisé », et partent au serveur au retour du réseau, puis à un second
   appareil (SYN-004). La coupure de Playwright (setOffline) n'atteint pas
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
/* SYN-004 : un fragment d'Écriture et une dépense de 9 € au Budget, en plus de la capture. Ce que le serveur en a, et
   l'espace qu'un nom de la navigation ouvre. */
const FRAG = 'fragment hors ligne SYN-004', NOTE9 = 'dépense hors ligne SYN-004';
const espaces = () => Object.values((rows.get('u1') || {}).site?.modules || {});
const fragmentAuServeur = () => espaces().some(m => m.type === 'cumul' && (m.scraps || []).some(s => s.text === FRAG));
const depenseAuServeur = () => espaces().some(m => m.type === 'budget' && (m.entries || []).some(e => e.amount === 9 && e.type === 'dépense' && e.note === NOTE9));
const espace = async (p, nom, sel) => {
  const h = await p.evaluate(n => { const a = [...document.querySelectorAll('#nav a')].find(x => x.textContent.trim() === n); return a ? a.getAttribute('href') : ''; }, nom);
  await p.evaluate(x => { location.hash = x; }, h); await p.waitForSelector(sel, { state: 'attached' });
};
// Ce que montre un appareil : la capture dans la boîte, le fragment dans Écriture, la dépense au Budget.
const troisSaisies = async p => {
  await p.evaluate(() => { location.hash = 'inbox'; }); await p.waitForFunction(() => location.hash === '#inbox');
  const boite = await p.textContent('#main');
  await espace(p, 'Écriture', '#scrapIn'); const ecriture = await p.textContent('#main');
  await espace(p, 'Budget', '#bAmt'); const budget = (await p.textContent('#main')).replace(/\s+/g, ' ');
  return { capture: boite.includes('hors ligne BL-15'), fragment: ecriture.includes(FRAG), depense: budget.includes(NOTE9) && budget.includes('9,00 €') };
};
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
    // SYN-004 : Écriture et Budget, ajoutés en ligne depuis les Réglages, pour y saisir hors ligne.
    for (const t of ['ecriture', 'budget']) {
      await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector(`.tpl-grid [data-act="tpl-add"][data-tpl="${t}"]`, { state: 'attached' });
      await p.evaluate(x => document.querySelector(`.tpl-grid [data-act="tpl-add"][data-tpl="${x}"]`).click(), t); // dans un volet replié
    }
    await until(() => espaces().some(m => m.type === 'cumul') && espaces().some(m => m.type === 'budget'));
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
    // SYN-004, étape 1 : un fragment et une dépense de 9 €, eux aussi acceptés hors ligne.
    await espace(p, 'Écriture', '#scrapIn'); await p.fill('#scrapIn', FRAG); await p.click('[data-act="scrap-add"]');
    await espace(p, 'Budget', '#bAmt'); await p.fill('#bAmt', '9'); await p.fill('#bNote', NOTE9); await p.click('[data-act="bud-add"]');
    await p.waitForTimeout(1500); // plus que les 900 ms d'attente avant l'envoi
    const ici1 = await troisSaisies(p), dit1 = await p.textContent('#saving');
    check(ici1.capture && ici1.fragment && ici1.depense && /Non synchronisé — enregistré sur cet appareil seulement/.test(dit1),
      `hors ligne, le fragment « ${FRAG} » et la dépense de 9 € acceptés à côté de la capture ; toujours « ${dit1.trim()} » (SYN-004, étape 1)`);
    check(appels === avant && !serveur().includes('hors ligne BL-15') && !fragmentAuServeur() && !depenseAuServeur(), 'rien n’est parti au serveur');
    if (ENGINE === 'chromium') {
      // Étape 2 : rechargée hors ligne, l'app rend les trois saisies et reste connectée.
      await ouvrir(p, null, entree);
      const ici2 = await troisSaisies(p);
      check(ici2.capture && ici2.fragment && ici2.depense && !(await p.$('#authForm')) && /Non synchronisé/.test(await p.textContent('#saving')),
        'rechargée hors ligne : la capture, le fragment et la dépense sont là, la session aussi (étape 2)');
    }

    console.log('retour du réseau');
    await ctx.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.route('https://*.supabase.co/**', supabase); // la route des fichiers levée
    coupe = false; await ctx.setOffline(false); note('réseau rendu');
    // Rechargée hors ligne (Chromium), l'app se rebranche au retour du réseau (« online ») ; restée ouverte, ce qui attend
    // part à la relève suivante du serveur, toutes les 30 s.
    await until(() => serveur().includes('hors ligne BL-15'), 40000);
    check(serveur().includes('hors ligne BL-15') && serveur().includes('en ligne BL-15'), `la capture faite hors ligne arrive au serveur, sans rien perdre (${serveur().join(', ')})`);
    await until(() => fragmentAuServeur() && depenseAuServeur(), 10000);
    check(fragmentAuServeur() && depenseAuServeur(), 'le fragment et la dépense de 9 € aussi (SYN-004, étape 3)');
    await p.waitForFunction(() => !/Non synchronisé/.test((document.querySelector('#saving') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
    const reste = await p.textContent('#saving');
    check(!/Non synchronisé/.test(reste), 'l’indicateur s’efface' + (reste ? ` (« ${reste} »)` : ''));
    // Étape 4 : un second appareil connecté au même compte reçoit les trois saisies.
    const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx2.route('https://*.supabase.co/**', supabase);
    await ctx2.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
    const a2 = await ctx2.newPage(); a2.on('pageerror', e => errs.push('A2 : ' + e.message));
    await ouvrir(a2, BASE + '/index.html', entree);
    await a2.waitForFunction(() => [...document.querySelectorAll('#nav a')].some(a => a.textContent.trim() === 'Budget'), null, { timeout: 10000 }).catch(() => {});
    const la = await troisSaisies(a2);
    check(la.capture && la.fragment && la.depense, 'un second appareil connecté au même compte : la capture, le fragment et la dépense de 9 € sont arrivés (étape 4)');
    await ctx2.close();
    if (process.exitCode) console.log('  journal du réseau :\n' + journal.map(l => '    ' + l).join('\n'));
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
