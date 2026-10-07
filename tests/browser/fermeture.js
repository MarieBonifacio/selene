/* Scénario de navigateur : l'onglet fermé juste après une saisie (SYN-005). Deux appareils du même compte sur un faux
   Supabase partagé ; A1 saisit, puis quitte Selene aussitôt. Un espace léger : à la fermeture, l'app confie au
   navigateur une écriture keepalive qui porte la saisie. Un espace de plus de 60 Ko : elle n'en confie aucune (les
   navigateurs refusent une requête keepalive de plus de 64 Kio, T13 de l'audit) ; la saisie reste sur A1, et part à sa
   réouverture vers A2.
   Ce que l'app émet est relevé dans la page même (un fetch enveloppé, son journal dans localStorage), pas au faux
   serveur : une requête keepalive est confiée au processus du navigateur, et Playwright ne la reçoit qu'au hasard
   (trois essais, le 7 octobre 2026 : émise chaque fois, reçue une fois). Sa livraison, l'onglet fermé, reste donc à
   jouer à la main (étape 3). A1 quitte Selene pour about:blank, ce qui décharge le document comme une fermeture
   (pagehide), l'onglet gardé ; le journal se lit depuis une page neutre de la même origine, l'app vidant au démarrage les
   clés qui ne sont pas les siennes. L'horloge d'A1 est arrêtée pendant la saisie : l'envoi différé (900 ms) ne peut pas
   partir avant la fermeture, quelle que soit la vitesse de la machine. Lancé par tests/browser/run.js. */
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { engine, BASE, launchOptions, check, ouvrir, entree } = require('./helpers');
const rows = new Map();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function serveur(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname !== '/rest/v1/app_state') return m === 'GET' ? json(route, 200, []) : route.fulfill({ status: 201, body: '' });
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  const date = (u.searchParams.get('select') || '').match(/^u:(\w+)->>updatedAt$/);
  if (m === 'GET' && date) return json(route, 200, row ? [{ u: row[date[1]] && row[date[1]].updatedAt != null ? String(row[date[1]].updatedAt) : null }] : []);
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
const auServeur = () => ((rows.get('u1') || {}).site?.modules?.inbox?.entries || []).map(e => e.text);
async function appareil(browser, errs, tag) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await ctx.route('https://*.supabase.co/**', serveur);
  await ctx.addInitScript(s => { if (location.protocol === 'about:') return; if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
  // Ce que la page confie au navigateur pour après elle : chaque fetch keepalive vers app_state, son poids, s'il porte une
  // saisie de ce cas ; et chaque pagehide.
  await ctx.addInitScript(() => {
    if (location.protocol === 'about:') return;
    const note = x => { try { const l = JSON.parse(localStorage.getItem('fermeture-journal') || '[]'); l.push(x); localStorage.setItem('fermeture-journal', JSON.stringify(l)); } catch { /* journal impossible : les contrôles le diront */ } };
    const f = window.fetch;
    window.fetch = function (u, o = {}) { if (o.keepalive && /\/rest\/v1\/app_state/.test(String(u))) note({ quoi: o.method, poids: (o.body || '').length, saisie: /dernière seconde[^"]*SYN-005/.exec(o.body || '')?.[0] || '' }); return f.apply(this, arguments); };
    addEventListener('pagehide', () => note({ quoi: 'pagehide' }));
  });
  const page = await ctx.newPage(), dialogues = [];
  page.on('pageerror', e => errs.push(`${tag} : ${e.message}`)); page.on('dialog', d => { dialogues.push(d.type()); d.dismiss().catch(() => {}); });
  await page.clock.install();
  await ouvrir(page, BASE + '/index.html', entree);
  return { ctx, page, dialogues };
}
const attendre = async (cond, ms = 15000) => { for (const fin = Date.now() + ms; Date.now() < fin && !(await cond());) await new Promise(r => setTimeout(r, 100)); return !!(await cond()); };
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  try {
    const A1 = await appareil(browser, errs, 'A1'), a1 = A1.page;
    await attendre(() => !!rows.get('u1')?.site?.config);
    const A2 = await appareil(browser, errs, 'A2'), a2 = A2.page;
    const settle = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const vers = async (p, h, sel) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForFunction(x => location.hash === '#' + x, h); await p.waitForSelector(sel, { state: 'attached' }); await settle(p); };
    const taille = async () => { await vers(a1, 'reglages', '#reg-size'); return (await a1.textContent('#reg-size')).replace(/\s+/g, ' ').trim(); };
    // Le journal d'A1, lu (puis vidé) depuis une page neutre de la même origine.
    const journal = async () => {
      const r = await A1.ctx.newPage(); await r.goto(BASE + '/manifest.webmanifest');
      const j = await r.evaluate(() => { const v = localStorage.getItem('fermeture-journal'); localStorage.removeItem('fermeture-journal'); return JSON.parse(v || '[]'); });
      await r.close(); return j;
    };
    // A2 laissé visible sur sa boîte ; sa relève (toutes les 30 s), avancée à la main.
    await vers(a2, 'inbox', '#main');
    const releve = async (texte, present) => {
      await a2.clock.fastForward(31000);
      return a2.waitForFunction(([t, p]) => document.querySelector('#main').textContent.includes(t) === p, [texte, present], { timeout: 10000 }).then(() => true, () => false);
    };
    // Saisir par Entrée, puis quitter Selene aussitôt, l'horloge d'A1 arrêtée ; rend ce que la page a confié au navigateur.
    const fermer = async texte => {
      await vers(a1, 'accueil', '#capIn'); await journal();
      await a1.clock.pauseAt(await a1.evaluate(() => Date.now() + 1000));
      await a1.fill('#capIn', texte); await a1.press('#capIn', 'Enter');
      await a1.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Gardé.'), null, { timeout: 5000 }).catch(() => {});
      await a1.goto('about:blank');
      return journal();
    };
    const rouvrir = async () => { await a1.clock.resume(); await ouvrir(a1, BASE + '/index.html', entree); };
    const dire = j => j.filter(x => x.quoi !== 'pagehide').map(x => `${x.quoi} de ${x.poids} octets${x.saisie ? `, « ${x.saisie} » dedans` : ''}`).join(' ; ') || 'rien';

    console.log('un espace léger : une écriture confiée au navigateur à la fermeture (SYN-005)');
    const t1 = await taille(), ko = +((t1.match(/pèse (\d+) Ko/) || [])[1] || 1e9);
    check(/^Ton espace pèse \d+ Ko ; le serveur en garde 5,0 Mo au plus\.$/.test(t1) && ko <= 55, `A1 : « ${t1} » (SYN-005, étape 1)`);
    const LEGERE = 'dernière seconde SYN-005', j2 = await fermer(LEGERE), ecrit2 = j2.filter(x => x.quoi === 'PATCH');
    check(!A1.dialogues.length && j2.some(x => x.quoi === 'pagehide') && ecrit2.length === 1 && ecrit2[0].saisie === LEGERE && ecrit2[0].poids < 60000,
      `capturée par Entrée, Selene quittée aussitôt, sans confirmation : à la fermeture, la page confie au navigateur ${dire(j2)} (étape 2)`);

    console.log('un espace lourd : rien à la fermeture, tout à la réouverture');
    execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'recette.mjs'), 'donnees'], { cwd: path.join(__dirname, '..', '..'), stdio: 'ignore' });
    const volume = path.join(__dirname, '..', '..', 'dist', 'recette', 'volume.json');
    await rouvrir(); await attendre(() => auServeur().includes(LEGERE)); // la capture légère, partie au plus tard ici
    await vers(a1, 'reglages', 'input[data-act="imp"]');
    await a1.setInputFiles('input[data-act="imp"]', volume);
    await a1.waitForSelector('#cdlg[open]', { timeout: 10000 }).catch(() => {}); if (await a1.$('#cdlg[open]')) await a1.click('#cdlg button[value="ok"]');
    await a1.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Sauvegarde importée.'), null, { timeout: 15000 }).catch(() => {});
    await attendre(() => auServeur().length > 1000, 20000);
    await a2.clock.fastForward(31000);
    const vuA2 = await a2.waitForFunction(() => document.querySelectorAll('#main li.item').length >= 100, null, { timeout: 15000 }).then(() => true, () => false);
    const t4 = await taille(), mo = parseFloat(((t4.match(/pèse (\d+,\d) Mo/) || [])[1] || '0').replace(',', '.'));
    check(vuA2 && mo > 3 && mo < 5 && /^Ton espace pèse \d,\d Mo ; le serveur en garde 5,0 Mo au plus\. Il approche de la limite/.test(t4),
      `le jeu de volume importé sur A1, affiché par A2 ; A1 : « ${t4.slice(0, 110)}… » (étape 4)`);
    const LOURDE = 'dernière seconde lourde SYN-005', j5 = await fermer(LOURDE);
    check(j5.some(x => x.quoi === 'pagehide') && !j5.some(x => x.quoi === 'PATCH') && !auServeur().includes(LOURDE) && await releve(LOURDE, false),
      `capturée, Selene quittée aussitôt : un espace de ${mo.toLocaleString('fr-FR')} Mo, la page ne confie ${dire(j5)} au navigateur, et A2 ne voit pas la capture à sa relève (étape 5)`);
    await rouvrir(); await vers(a1, 'inbox', '#main');
    const ici6 = (await a1.textContent('#main')).includes(LOURDE), serveur6 = await attendre(() => auServeur().includes(LOURDE));
    check(ici6 && serveur6 && await releve(LOURDE, true), 'A1 rouvert : la capture est dans sa boîte, part au serveur, et A2 la reçoit à sa relève (étape 6)');
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { check(false, e.message.split('\n')[0]); }
  await browser.close();
})();
