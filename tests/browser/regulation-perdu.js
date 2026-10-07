/* Scénario de navigateur : « Reprendre la main », l'appareil détenteur a perdu son stockage (BL-01 du cahier de recette,
   cas RLM-029). Compte personnel sur
   un faux Supabase, comme regulation-appareil.js :
   - une saisie, puis la sauvegarde complète téléchargée ;
   - seul selene-local-v1 effacé (l'identité de l'appareil gardée), rechargement : l'espace l'avoue et dit quoi faire ;
   - la sauvegarde réimportée : le suivi est entier, de nouveau gardé ici ;
   - effacé encore, puis retiré par les Réglages : sans l'avertissement « il n'y a que le nom », et le nom quitte le compte ;
   - sous Chromium, un suivi recréé, puis un vrai « Clear site data » (Storage.clearDataForOrigin, l'appel du bouton des
     outils de développement) : l'identité de l'appareil perdue elle aussi, le suivi se dit gardé ailleurs, et nomme le
     poste (étape 4, décision du 6 octobre 2026).
   Puis RLM-027 : un autre compte connecté sur l'appareil, la session du premier perdue ; ses suivis mis de côté, jamais
   montrés, retrouvés à son retour, même après la déconnexion de l'autre (A48).
   Enfin le journal d'un suivi sans compte, l'horloge figée : corriger une saisie (RLM-011), observer, réduire, viser
   l'arrêt (RLM-007), deux semaines en regard (RLM-019) ; venu de regulation-appareil.js, trop long sous un processeur
   ralenti (A51). Puis une journée sans saisie, inconnue jusqu'à sa confirmation, jamais zéro (RLM-008) ; et aucun
   détail hors de l'espace : recherche, palette, motifs, rangement d'une note (RLM-020) ; la pause de cinq minutes,
   l'horloge avancée à la main, rechargée, l'onglet fermé, arrêtée puis échue (RLM-017).
   Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const path = require('node:path');
const { engine, ENGINE, BASE, launchOptions, check, storeGet, storeJSON, storeSet, ouvrir, entree } = require('./helpers');
const rows = new Map();
const COMPTES = { 'p@exemple.org': { id: 'u5', personnel: true }, 'a@exemple.org': { id: 'u6' } }; // RLM-027 : P, puis A
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname === '/auth/v1/token' || u.pathname === '/auth/v1/signup') { // la connexion par le formulaire (RLM-027)
    const b = (() => { try { return req.postDataJSON() || {}; } catch { return {}; } })(), c = COMPTES[b.email];
    if (c) return json(route, 200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: c.id, email: b.email, app_metadata: c.personnel ? { selene_personnel: true } : {} } });
  }
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname === '/rest/v1/activite') return route.fulfill({ status: 201, body: '' });
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') {
    if (!row) return json(route, 200, []);
    for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = row[c] && row[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(route, 200, []); }
    Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  }
}
const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c', personnel: true } });
const server = () => JSON.stringify((rows.get('u1') || {}).site || {});
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  try {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await ctx.route('https://*.supabase.co/**', supabase);
    await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ouvrir(p, BASE + '/index.html', entree); // connecté : l'app, pas l'écran d'entrée (A16)
    const settle = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForFunction(x => location.hash === '#' + x, h); await settle(); };
    const submit = async () => { await p.click('#form button[value="save"]'); await settle(); };
    const ask = async ok => { await p.waitForSelector('#cdlg[open]'); const msg = await p.textContent('#cmsg'); await p.click(`#cdlg button[value="${ok ? 'ok' : 'cancel'}"]`); await settle(); return msg; };
    const waitServer = async test => { for (let i = 0; i < 60 && !test(server()); i++) await p.waitForTimeout(100); return test(server()); };
    const reload = () => ouvrir(p, null, entree);
    const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');

    console.log('un suivi gardé ici, une saisie, la sauvegarde complète');
    await p.waitForSelector('#welcome-all', { state: 'attached' }); await p.evaluate(() => { document.getElementById('welcome-all').open = true; });
    await p.click('[data-tpl="regulation"]'); await go('reprendre-la-main');
    await p.click('[data-act="rlm-setup"]');
    await p.fill('#form [name="name"]', 'Carnet du soir'); await p.selectOption('#form [name="subject"]', 'tabac');
    await p.click('#form button[value="save"]');
    await p.waitForFunction(() => document.querySelector('#form h2').textContent === 'Mon intention');
    await p.selectOption('#form [name="mode"]', 'observer'); await submit();
    await p.click('[data-act="rlm-use"]'); await p.fill('#form [name="value"]', '3'); await p.fill('#form [name="note"]', 'NOTE_RLM029'); await submit();
    check(await waitServer(s => s.includes('Carnet du soir')), 'le compte connaît le nom (talon)');
    await go('reglages');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="exp"]')]);
    const backup = fs.readFileSync(await dl.path(), 'utf8');
    check(backup.includes('NOTE_RLM029') && backup.includes('"tabac"'), 'la sauvegarde complète contient le suivi gardé ici');

    console.log('le stockage du suivi effacé, l’appareil gardé');
    const device = await storeGet(p, 'selene-device-id');
    await storeSet(p, 'selene-local-v1', null); await reload(); await go('reprendre-la-main');
    const lost = await main();
    check(lost.includes('Ce suivi devait être gardé sur cet appareil, mais ses données n\'y sont plus') && lost.includes('Une sauvegarde complète faite ici peut les restaurer'), 'l’espace avoue la perte, et dit quoi faire');
    check(!lost.includes('NOTE_RLM029') && !lost.includes('gardé sur un autre de tes appareils'), 'ni contenu, ni l’explication d’un autre appareil : c’est bien celui-ci');
    check(!!device && await storeGet(p, 'selene-device-id') === device, `l’identité de l’appareil est restée (${device})`);

    console.log('la sauvegarde réimportée');
    await go('reglages');
    await p.setInputFiles('input[data-act="imp"]', { name: 'selene-sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    check((await ask(true)).includes('Remplacer tout l\'état actuel'), 'importer demande confirmation');
    await p.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Sauvegarde importée'));
    await go('reprendre-la-main');
    const back = await main();
    check(back.includes('NOTE_RLM029') && back.includes('Tabac'), 'le suivi est entier, sa saisie comprise');
    check((await storeJSON(p, 'selene-local-v1')).modules['reprendre-la-main'].entries.length === 1, 'de nouveau gardé sur cet appareil');
    await p.waitForTimeout(1200);
    check(!server().includes('NOTE_RLM029'), 'la restauration n’envoie pas le contenu au compte');

    console.log('perdu encore, puis retiré');
    await storeSet(p, 'selene-local-v1', null); await reload(); await go('reglages');
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await p.locator('.set.mod:has(input[data-act="mod-label"][value="Carnet du soir"]) [data-act="mod-del"]').click();
    await p.waitForFunction(() => document.querySelector('#dlg').open);
    check(!(await p.textContent('#form')).includes('il n\'y a que le nom'), 'l’appareil détenteur ne prévient pas comme un autre appareil');
    await p.fill('#form [name="confirm"]', 'Carnet du soir'); await submit();
    check((await p.textContent('#toast')).includes('« Carnet du soir » supprimé.'), 'supprimé, et dit');
    check(await waitServer(s => !s.includes('Carnet du soir')), 'le nom quitte le compte : plus de talon impossible à effacer');

    console.log('un suivi recréé, puis « Clear site data » pour de bon (RLM-029, étape 4)');
    if (ENGINE !== 'chromium') console.log(`  – ${ENGINE} : « Clear site data » passe par le protocole des outils de développement de Chromium ; étape jouée sous Chromium`);
    else {
      // Recréé depuis les Réglages (l'accueil ne propose plus les modèles) : un autre identifiant que l'espace supprimé.
      await go('reglages'); await p.waitForSelector('.tpl-grid [data-act="tpl-add"][data-tpl="regulation"]', { state: 'attached' });
      await p.evaluate(() => document.querySelector('.tpl-grid [data-act="tpl-add"][data-tpl="regulation"]').click());
      const id4 = await p.evaluate(() => { const a = [...document.querySelectorAll('#nav a')].find(x => x.textContent.includes('Reprendre la main')); return a ? a.getAttribute('href').slice(1) : ''; });
      await go(id4); await p.click('[data-act="rlm-setup"]');
      await p.fill('#form [name="name"]', 'Carnet du matin'); await p.selectOption('#form [name="subject"]', 'tabac'); await p.click('#form button[value="save"]');
      await p.waitForFunction(() => document.querySelector('#form h2').textContent === 'Mon intention');
      await p.selectOption('#form [name="mode"]', 'observer'); await submit();
      check(await waitServer(s => s.includes('Carnet du matin') && s.includes('"holder"')), 'recréé, configuré : le compte en a le talon, et son détenteur');
      const avant4 = await storeGet(p, 'selene-device-id');
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'all' });
      await reload(); // la session reposée au chargement : de nouveau connectée au même compte
      await go(id4); await p.waitForFunction(() => document.querySelector('#main').textContent.includes('gardé sur un autre de tes appareils'), null, { timeout: 10000 }).catch(() => {});
      const ailleurs4 = await main(), apres4 = await storeGet(p, 'selene-device-id');
      const jour4 = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
      check(ailleurs4.includes('Ce suivi est gardé sur un autre de tes appareils') && ailleurs4.includes(`Il le garde sur : Chrome · Linux, depuis le ${jour4}.`)
        && ailleurs4.includes("Si c'est celui-ci et que son stockage a été effacé (données du navigateur ou de l'app), une sauvegarde complète faite ici le restaure. Sinon (appareil perdu, Selene réinstallée), tu peux retirer ce nom dans les réglages.")
        && !!avant4 && apres4 !== avant4 && !ailleurs4.includes("n'y sont plus"),
        `« Clear site data », puis connectée : « Ce suivi est gardé sur un autre de tes appareils… Il le garde sur : Chrome · Linux, depuis le ${jour4}. » et ce qu’il reste à faire ; l’appareil a changé d’identité (étape 4)`);
    }
    // Le premier appareil reste ouvert : fermé avec une requête en vol, WebKit lève une erreur que le contrôle final
    // prendrait pour celle de l'app (A50). Le navigateur entier se ferme à la fin.

    console.log('un autre compte sur le même appareil, sans déconnexion (RLM-027)');
    // La session posée une fois (sessionStorage survit au rechargement de l'onglet) : retirée à la main, elle ne revient pas.
    const cx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    await cx.route('https://*.supabase.co/**', supabase);
    const sessionP = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u5', email: 'p@exemple.org', personnel: true } });
    await cx.addInitScript(s => { if (!sessionStorage.getItem('rlm027')) { sessionStorage.setItem('rlm027', '1'); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u5'); } }, sessionP);
    const z = await cx.newPage(); z.on('pageerror', e => errs.push(e.message));
    const vers = async (h, sel) => { await z.evaluate(x => { location.hash = x; }, h); await z.waitForSelector(sel, { state: 'attached' }); };
    await ouvrir(z, BASE + '/index.html', entree);
    await z.waitForSelector('#welcome-all', { state: 'attached' }); await z.evaluate(() => { document.getElementById('welcome-all').open = true; });
    await z.click('[data-tpl="regulation"]'); await vers('reprendre-la-main', '[data-act="rlm-setup"]'); await z.click('[data-act="rlm-setup"]');
    await z.fill('#form [name="name"]', 'Carnet du soir'); await z.selectOption('#form [name="subject"]', 'alcool'); await z.click('#form button[value="save"]');
    await z.waitForFunction(() => document.querySelector('#form h2').textContent === 'Mon intention');
    await z.selectOption('#form [name="mode"]', 'observer'); await z.click('#form button[value="save"]'); await z.waitForFunction(() => !document.querySelector('#dlg').open);
    await z.click('[data-act="rlm-use"]'); await z.fill('#form [name="value"]', '1'); await z.fill('#form [name="note"]', 'NOTE-RLM027'); await z.click('#form button[value="save"]');
    await z.waitForFunction(() => !document.querySelector('#dlg').open);
    const serveur5 = () => JSON.stringify((rows.get('u5') || {}).site || {});
    for (let i = 0; i < 60 && !serveur5().includes('Carnet du soir'); i++) await z.waitForTimeout(100);
    const kv = k => storeGet(z, k).catch(() => null);
    /* Le stockage se lit dans IndexedDB : une écriture encore en route y est invisible. Sous un processeur ralenti et
       quatre scénarios à la fois (CI), elle peut tarder : attendre l'état lui-même, largement, plutôt qu'un délai fixe. */
    const jusqua27 = async (cond, ms = 30000) => { for (const end = Date.now() + ms; Date.now() < end; await z.waitForTimeout(100)) if (await cond()) return true; return !!(await cond()); };
    const connexion = async email => {
      if (!(await z.$('#authForm'))) { await z.click('[data-act="auth-open"] >> nth=0'); await z.waitForSelector('#authForm'); }
      await z.fill('#authEmail', email); await z.fill('#authPw', 'une phrase assez longue'); await z.click('#authForm button[type="submit"]');
      await z.waitForFunction(() => !!document.querySelector('#nav > *') && !document.querySelector('#authForm'), null, { timeout: 30000 }).catch(() => {});
    };
    await jusqua27(async () => (await kv('selene-local-v1') || '').includes('NOTE-RLM027')); // la saisie écrite sur l'appareil
    await z.evaluate(() => localStorage.removeItem('selene-auth-session'));
    await z.reload(); await z.waitForSelector('#authForm, [data-act="auth-open"], [data-act="auth-local"]', { timeout: 10000 }).catch(() => {});
    const dehors27 = await z.evaluate(() => ({ entree: !!document.querySelector('#authForm, [data-act="auth-local"]'), nav: (document.querySelector('#nav') || {}).textContent || '' }));
    check(dehors27.entree && !dehors27.nav.includes('Carnet du soir'), 'session retirée, rechargée : l’app n’est plus connectée, l’écran d’entrée (RLM-027, étape 1)');
    await connexion('a@exemple.org');
    await jusqua27(async () => (await kv('selene-local-v1:u5') || '').includes('NOTE-RLM027')); // la mise de côté, écrite
    await vers('recherche', '#searchIn'); await z.fill('#searchIn', 'NOTE-RLM027'); await z.waitForTimeout(300);
    const trouve27 = await z.evaluate(() => [...document.querySelectorAll('#main li, #main .item')].some(x => x.textContent.includes('NOTE-RLM027')));
    const stash = await kv('selene-local-v1:u5'), ici27 = await kv('selene-local-v1');
    check(!(await z.textContent('#nav')).includes('Carnet du soir') && !trouve27 && !(ici27 || '').includes('NOTE-RLM027') && (stash || '').includes('NOTE-RLM027'),
      'A connecté : aucun suivi de P dans la navigation, NOTE-RLM027 introuvable ; l’entrée selene-local-v1:<P> existe et le garde (RLM-027, étape 2)');
    await vers('reglages', '[data-act="auth-out"]'); await z.click('[data-act="auth-out"]');
    await z.waitForTimeout(300);
    const garde27 = await z.evaluate(() => document.querySelector('#dlg').open && (document.querySelector('#form h2') || {}).textContent === 'Avant de te déconnecter');
    if (await z.$('#cdlg[open]')) await z.click('#cdlg button[value="ok"]');
    await z.waitForSelector('#authForm, [data-act="auth-local"]', { timeout: 10000 }).catch(() => {});
    check(!garde27 && !!(await z.$('#authForm, [data-act="auth-local"]')), 'A déconnecté : aucune garde, l’écran d’entrée (RLM-027, étape 3)');
    await connexion('p@exemple.org');
    await vers('reprendre-la-main', '#main'); await z.waitForFunction(() => document.querySelector('#main').textContent.includes('NOTE-RLM027'), null, { timeout: 30000 }).catch(() => {});
    await jusqua27(async () => !(await kv('selene-local-v1:u5'))); // la mise de côté retirée, l'effacement écrit
    const retour27 = (await z.textContent('#main')).includes('NOTE-RLM027'), reste27 = await kv('selene-local-v1:u5');
    check(retour27 && (await z.textContent('#nav')).includes('Carnet du soir') && !reste27, 'P reconnecté : le suivi entier, la saisie NOTE-RLM027 ; l’entrée selene-local-v1:<P> a disparu (RLM-027, étape 4)' + (retour27 ? '' : ` (mise de côté : ${reste27 ? 'toujours là' : 'absente'})`));

    // Le journal d'un suivi sans compte (RLM-011, RLM-007, RLM-019), venu de regulation-appareil.js : celui-ci dépassait
    // ses 3 minutes sous un processeur ralenti (A51). Chaque chemin S a son navigateur, l'horloge figée à 20 h à Paris.
    const INSTANT = new Date('2026-10-07T20:00:00+02:00');
    // Un chemin S neuf, rlm-a-configurer.json configuré : J le 7 octobre 2026.
    const jj = n => { const d = new Date(Date.UTC(2026, 9, 7 + n, 12)); return d.toISOString().slice(0, 10); };
    // `sujet` : celui que choisit le formulaire ; `horloge` : « installee » pour une horloge qu'on avance (la pause de RLM-017).
    async function cheminS({ mode, limit, depuis, sujet = 'alcool', horloge = 'figee' }) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Europe/Paris' });
      const q = await c.newPage(); q.on('pageerror', e => errs.push(e.message)); if (horloge === 'installee') await q.clock.install({ time: INSTANT }); else await q.clock.setFixedTime(INSTANT);
      await ouvrir(q, BASE + '/index.html#sans-compte', entree);
      const vers = async (h, sel) => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForSelector(sel, { state: 'attached' }); };
      const bulle = t => q.waitForFunction(x => ((document.querySelector('#toast') || {}).textContent || '').includes(x), t, { timeout: 5000 }).then(() => true, () => false);
      const dit = async () => (await q.textContent('#toast')).replace(/\s+/g, ' ').trim();
      const vider = () => q.evaluate(() => { document.querySelector('#toast').textContent = ''; });
      await vers('reglages', 'input[data-act="imp"]');
      await q.setInputFiles('input[data-act="imp"]', path.join(__dirname, '..', '..', 'docs', 'recette', 'donnees', 'rlm-a-configurer.json'));
      await q.waitForSelector('#cdlg[open]', { timeout: 5000 }).catch(() => {}); if (await q.$('#cdlg[open]')) await q.click('#cdlg button[value="ok"]');
      await bulle('Sauvegarde importée.');
      const id = await q.evaluate(() => { const a = [...document.querySelectorAll('#nav a')].find(x => x.textContent.includes('Carnet du soir')); return a ? a.getAttribute('href').slice(1) : ''; });
      await vers(id, '[data-act="rlm-setup"]'); await q.click('[data-act="rlm-setup"]'); await q.waitForFunction(() => document.querySelector('#dlg').open);
      await q.selectOption('#form [name="subject"]', sujet); await q.click('#form button[value="save"]');
      await q.waitForFunction(() => document.querySelector('#dlg').open && document.querySelector('#form h2').textContent === 'Mon intention');
      await q.selectOption('#form [name="mode"]', mode); if (limit != null) await q.fill('#form [name="limit"]', String(limit));
      await q.fill('#form [name="date"]', depuis); await q.click('#form button[value="save"]');
      await q.waitForFunction(() => !document.querySelector('#dlg').open); await q.waitForSelector('[data-act="rlm-use"]');
      // Le contenu de ce suivi vit dans le site (sans « storage: device ») ; relu jusqu'à ce qu'il dise ce qu'on attend.
      const contenu = async () => ((await storeJSON(q, 'selene-site-v1')) || { modules: {} }).modules[id] || { entries: [], goals: [] };
      const jusqua = async ok => { let d = await contenu(); for (let i = 0; i < 100 && !ok(d); i++) { await q.waitForTimeout(50); d = await contenu(); } return d; };
      const noter = async (date, value) => {
        const n = (await contenu()).entries.length;
        await vers(id, '[data-act="rlm-use"]'); await q.click('[data-act="rlm-use"]'); await q.waitForFunction(() => document.querySelector('#dlg').open);
        await q.fill('#form [name="date"]', date); await q.fill('#form [name="value"]', String(value)); await q.click('#form button[value="save"]');
        await q.waitForFunction(() => !document.querySelector('#dlg').open); await jusqua(d => d.entries.length > n);
      };
      const confirmer = async date => {
        await vider(); await vers(id, `ul.rlm-days [data-act="rlm-day-at"][data-date="${date}"]`); await q.click(`ul.rlm-days [data-act="rlm-day-at"][data-date="${date}"]`); await q.waitForSelector('#cdlg[open]');
        const question = (await q.textContent('#cmsg')).replace(/\s+/g, ' ').trim(); await q.click('#cdlg button[value="ok"]');
        await bulle('confirmée'); await jusqua(d => d.entries.some(e => e.id === `day-${date}`)); return [question, await dit()];
      };
      // Le statut du jour seul, sans la ligne « objectif du jour » qui le suit dans le même bloc.
      const jour = async date => (await q.$eval(`ul.rlm-days li.item[data-date="${date}"]`, l => { const d = l.querySelector('div').cloneNode(true); d.querySelectorAll('.meta').forEach(m => m.remove()); return d.textContent.replace(/\s+/g, ' ').trim(); }).catch(() => ''));
      const objectif = async (m, lim, date) => {
        await vider(); await vers(id, '[data-act="rlm-goal"]'); await q.click('[data-act="rlm-goal"]'); await q.waitForFunction(() => document.querySelector('#dlg').open);
        await q.selectOption('#form [name="mode"]', m); if (lim != null) await q.fill('#form [name="limit"]', String(lim)); await q.fill('#form [name="date"]', date);
        await q.click('#form button[value="save"]'); await q.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {});
        await q.waitForFunction(() => !!document.querySelector('#toast').textContent.trim(), null, { timeout: 5000 }).catch(() => {}); return dit();
      };
      return { c, q, id, vers, bulle, dit, vider, contenu, jusqua, noter, confirmer, jour, objectif };
    }

    console.log('chemin S : corriger une consommation après confirmation (RLM-011)');
    const k = await cheminS({ mode: 'observer', depuis: jj(-2) });
    await k.noter(jj(-2), 1); await k.noter(jj(-1), 1); await k.confirmer(jj(-2)); await k.confirmer(jj(-1));
    const hier = (await k.contenu()).entries.find(e => e.kind === 'use' && e.date === jj(-1));
    await k.q.$eval(`#main li.item[data-id="${hier.id}"] [data-act="rlm-edit"]`, x => x.click()); await k.q.waitForFunction(() => document.querySelector('#dlg').open);
    const corriger = await k.q.evaluate(() => [document.querySelector('#form h2').textContent.trim(), [...document.querySelectorAll('#form label')].map(l => (l.firstChild && l.firstChild.textContent || '').trim()), !!document.querySelector('#form [name="how"]')]);
    check(corriger[0] === 'Corriger une saisie' && corriger[1].includes('Date') && corriger[1].some(x => x.startsWith('Quantité')) && corriger[1].some(x => x.startsWith('Contexte')) && !corriger[2],
      `« modifier » sur la saisie de J-1 : « ${corriger[0]} », ${corriger[1].join(', ')} ; pas de « Je note » (étape 1)`);
    await k.vider(); await k.q.fill('#form [name="value"]', '0.5'); await k.q.click('#form button[value="save"]'); await k.bulle('à reconfirmer');
    const d2 = await k.jusqua(d => (d.entries.find(e => e.id === hier.id) || {}).value === 0.5);
    const ligneHier = (await k.q.textContent(`#main li.item[data-id="${hier.id}"]`)).replace(/\s+/g, ' ');
    check((await k.dit()).startsWith('Noté. La journée du 6 oct. était confirmée : elle est à reconfirmer.') && ligneHier.includes('0,5 verre standard') && ligneHier.includes('corrigé') && d2.entries.filter(e => e.kind === 'use' && e.date === jj(-1)).length === 1,
      `0,5 : « Noté. La journée du 6 oct. était confirmée : elle est à reconfirmer. » ; la ligne dit « 0,5 verre standard », « corrigé » ; une seule saisie pour J-1 (étape 2)`);
    await k.q.$eval(`#main li.item[data-id="${hier.id}"] [data-act="rlm-edit"]`, x => x.click()); await k.q.waitForFunction(() => document.querySelector('#dlg').open);
    await k.q.fill('#form [name="date"]', jj(-2)); await k.q.click('#form button[value="save"]'); await k.q.waitForFunction(() => !document.querySelector('#dlg').open);
    await k.jusqua(d => (d.entries.find(e => e.id === hier.id) || {}).date === jj(-2)); await k.q.waitForTimeout(300);
    const [l1, l2] = [await k.jour(jj(-1)), await k.jour(jj(-2))];
    check(l1.startsWith('à reconfirmer : 0 verre standard') && l2.startsWith('à reconfirmer : 1,5 verre standard'), `déplacée au J-2 : J-1 « ${l1} », J-2 « ${l2} » (étape 3)`);
    await k.confirmer(jj(-2)); await k.confirmer(jj(-1));
    const [m1, m2] = [await k.jour(jj(-1)), await k.jour(jj(-2))];
    check(m2.startsWith('complète : 1,5 verre standard') && m1.startsWith('complète : 0 verre standard'), `confirmées : J-2 « ${m2} », J-1 « ${m1} » (étape 4)`);
    await k.c.close();

    console.log('chemin S : observer, réduire, viser l’arrêt (RLM-007)');
    const r = await cheminS({ mode: 'reduire', limit: 2, depuis: jj(-3) });
    const dits7 = [];
    await r.noter(jj(-3), 1);
    // « Confirmer une autre journée… » : la journée choisie, puis la même boîte de confirmation.
    await r.vider(); await r.q.click('[data-act="rlm-day-other"]'); await r.q.waitForFunction(() => document.querySelector('#dlg').open);
    await r.q.fill('#form [name="date"]', jj(-3)); await r.q.click('#form button[value="save"]'); await r.q.waitForSelector('#cdlg[open]'); await r.q.click('#cdlg button[value="ok"]');
    await r.bulle('confirmée'); dits7.push(await r.dit());
    await r.noter(jj(-2), 3); dits7.push((await r.confirmer(jj(-2)))[1]);
    check(dits7.length === 2 && dits7.every(x => /^Journée du \d+ oct\. confirmée\.$/.test(x)), `« Journée du … confirmée. » chaque fois (${dits7.join(' | ')}) (étape 1)`);
    const obs = await r.objectif('observer', null, jj(-1));
    await r.noter(jj(-1), 2); await r.confirmer(jj(-1));
    check(obs === 'Objectif enregistré. Les journées déjà confirmées gardent le leur.', `« Observer, sans cible » à partir de J-1 : « ${obs} » (étape 2)`);
    await r.objectif('arreter', null, jj(0));
    await r.vider(); await r.q.click('[data-act="rlm-day"]'); await r.q.waitForSelector('#cdlg[open]');
    const point = (await r.q.textContent('#cmsg')).replace(/\s+/g, ' ').trim(); await r.q.click('#cdlg button[value="ok"]'); await r.bulle('confirmée');
    const tete = (await r.q.textContent('#main')).replace(/\s+/g, ' ');
    check(point.includes(': 0 verre standard au total.') && point.includes('Aucune consommation notée ce jour-là : confirmer en fait une journée à zéro.') && tete.includes('Alcool · viser l\'arrêt'),
      `« Faire mon point du jour » : « …0 verre standard au total. Aucune consommation notée ce jour-là… » ; l’en-tête « Alcool · viser l'arrêt » (étape 3)`);
    const objectifDu = async date => (await r.q.$eval(`ul.rlm-days li.item[data-date="${date}"]`, l => (l.querySelector('.meta') || {}).textContent || '').catch(() => '')).trim();
    const jours = [];
    for (const n of [0, -1, -2, -3]) jours.push([await r.jour(jj(n)), await objectifDu(jj(n))]);
    const avantDebut = await r.q.$$eval('ul.rlm-days li.item[data-date]', ls => ls.map(l => l.dataset.date));
    check(jours[0][0] === 'complète : 0 verre standard · objectif atteint' && jours[0][1] === 'objectif du jour : viser l\'arrêt'
      && jours[1][0] === 'complète : 2 verres standard · observée' && !jours[1][1]
      && jours[2][0] === 'complète : 3 verres standard · au-delà de l\'objectif' && jours[2][1] === 'objectif du jour : au plus 2 verres standard par jour'
      && jours[3][0] === 'complète : 1 verre standard · objectif atteint' && jours[3][1] === 'objectif du jour : au plus 2 verres standard par jour'
      && avantDebut.every(d => d >= jj(-3)), `les sept derniers jours : ${jours.map(([a, o]) => a + (o ? ' / ' + o : '')).join(' | ')} ; aucun jour avant J-3 (étape 4)`);
    const tableau = await r.q.evaluate(() => ({ entetes: [...document.querySelectorAll('.rlm-cmp thead th')].map(t => t.textContent.trim()), lignes: [...document.querySelectorAll('.rlm-cmp tbody tr')].map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())) }));
    const valeur = l => (tableau.lignes.find(x => x[0].startsWith(l)) || [])[1];
    const apres = (await r.q.textContent('#main')).replace(/\s+/g, ' ');
    check(valeur('Journées suivies') === '4' && valeur('Complètes') === '4' && valeur('Inconnues ou à reconfirmer') === '0' && valeur('Quantités déclarées') === '6 verres standard'
      && valeur('Moyenne') === '1,5 verre standard' && valeur('Objectif atteint') === '2 sur 3 journées évaluables' && !tableau.entetes.includes('Les 7 d\'avant')
      && apres.includes('Pas encore de semaine précédente à mettre en regard.') && apres.includes('Objectif changé pendant ces deux semaines : à partir du 6 oct., observer, sans cible ; à partir du 7 oct., viser l\'arrêt.'),
      `le tableau : ${tableau.lignes.map(x => x.join(' = ')).join(' ; ')} ; sans colonne « Les 7 d'avant » (C19) ; « Pas encore de semaine précédente… » ; les deux changements d'objectif (étape 5)`);
    const zero = await r.objectif('reduire', 0, jj(0));
    check(zero === 'Pour réduire, indique une limite quotidienne positive dans l\'unité du suivi. Pour zéro, choisis plutôt de viser l\'arrêt.' && !(await r.q.evaluate(() => document.querySelector('#dlg').open))
      && (await r.q.textContent('#main')).includes('Alcool · viser l\'arrêt'), `réduire à 0 : le formulaire se ferme, « ${zero} » ; l’en-tête reste « Alcool · viser l'arrêt » (étape 6)`);
    await r.c.close();

    console.log('chemin S : mes sept derniers jours, deux semaines en regard (RLM-019)');
    const w = await cheminS({ mode: 'observer', depuis: jj(-13) });
    const vide = await w.q.evaluate(() => {
      const sec = document.querySelector('[id^="rlmWeekH-"]').closest('section'), regle = sec.querySelector('p.hint'), phrase = sec.querySelector('p.empty'), jours = sec.querySelector('ul.rlm-days');
      const avant = (a, b) => !!(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { tableau: !!sec.querySelector('.rlm-cmp'), phrase: phrase ? phrase.textContent.replace(/\s+/g, ' ').trim() : '', regle: regle ? regle.textContent.trim() : '', ordre: avant(regle, phrase) && avant(phrase, jours), boutons: jours.querySelectorAll('[data-act="rlm-day-at"]').length };
    });
    check(!vide.tableau && vide.phrase === 'Rien à comparer pour l\'instant : ce tableau ne compte que les journées confirmées, et aucune ne l\'est encore. « Faire mon point du jour », le soir venu, confirme la première.'
      && vide.regle.startsWith('Une journée inconnue ne vaut jamais zéro, ni un échec') && vide.ordre && vide.boutons === 7,
      `avant toute confirmation : pas de tableau, « ${vide.phrase.slice(0, 60)}… » ; la règle au-dessus, les ${vide.boutons} jours et leurs « confirmer » en dessous (étape 1)`);
    // « Confirmer une autre journée… » : une journée hors de la liste des sept derniers jours.
    const autre = async date => {
      await w.vider(); await w.q.click('[data-act="rlm-day-other"]'); await w.q.waitForFunction(() => document.querySelector('#dlg').open);
      await w.q.fill('#form [name="date"]', date); await w.q.click('#form button[value="save"]'); await w.q.waitForSelector('#cdlg[open]'); await w.q.click('#cdlg button[value="ok"]');
      await w.bulle('confirmée'); await w.jusqua(d => d.entries.some(e => e.id === `day-${date}`)); return w.dit();
    };
    const dits19 = [];
    for (const n of [-13, -12, -11, -10]) dits19.push(await autre(jj(n)));
    await w.noter(jj(0), 2);
    for (const n of [-3, -2, -1, 0]) dits19.push((await w.confirmer(jj(n)))[1]);
    check(dits19.length === 8 && dits19.every(x => /^Journée du \d+ (sept|oct)\. confirmée\.$/.test(x)), `chaque confirmation : « Journée du … confirmée. » (${dits19.slice(0, 2).join(' | ')} …) (étape 2)`);
    const lire19 = () => w.q.evaluate(() => {
      const t = document.querySelector('.rlm-cmp'), apres = t && t.closest('.rlm-tablewrap').nextElementSibling;
      return { entetes: t ? [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()) : [], lignes: t ? [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())) : [], note: apres ? apres.textContent.replace(/\s+/g, ' ').trim() : '' };
    });
    // La ligne dont l'intitulé commence par `l`, ses deux valeurs : « Ces 7 jours », « Les 7 d'avant ».
    const paire = (t, l) => ((t.lignes.find(x => x[0].startsWith(l)) || []).slice(1)).join(' / ');
    const dire = t => t.lignes.map(x => x.join(' = ')).join(' ; ');
    const t3 = await lire19();
    check(t3.entetes.includes('Ces 7 jours') && t3.entetes.includes('Les 7 d\'avant') && paire(t3, 'Journées suivies') === '7 / 7' && paire(t3, 'Complètes') === '4 / 4' && paire(t3, 'Inconnues') === '3 / 3'
      && paire(t3, 'Quantités déclarées') === '2 verres standard / 0 verre standard' && paire(t3, 'Moyenne') === '0,5 verre standard / 0 verre standard' && paire(t3, 'Objectif atteint') === '— / —'
      && t3.note === 'Les deux périodes sont renseignées de façon voisine : leurs moyennes peuvent se comparer.', `le tableau : ${dire(t3)} ; « ${t3.note} » (étape 3)`);
    for (const n of [-6, -5, -4]) await w.confirmer(jj(n));
    const t4 = await lire19();
    check(paire(t4, 'Complètes') === '7 / 4' && paire(t4, 'Moyenne') === '0,29 verre standard / 0 verre standard'
      && t4.note === 'Les deux périodes ne sont pas renseignées de la même façon (7 et 4 journées complètes) : leurs moyennes ne se comparent pas telles quelles.', `J-6, J-5, J-4 confirmées : ${dire(t4)} ; « ${t4.note} » (étape 4)`);
    // « laisser inconnue » : la confirmation retirée de la journée, caché au repos sur un écran tactile.
    for (const n of [0, -1, -2, -3]) {
      await w.vider(); await w.q.$eval(`#main li.item[data-id="day-${jj(n)}"] [data-act="rlm-del"]`, x => x.click());
      await w.bulle('redevient inconnue'); await w.jusqua(d => !d.entries.some(e => e.id === `day-${jj(n)}`));
    }
    const t5 = await lire19();
    check(paire(t5, 'Complètes') === '3 / 4' && t5.note === 'Moins de 4 journées complètes dans l\'une des périodes : leurs moyennes ne se comparent pas, l\'écart dirait surtout ce qui manque.',
      `J, J-1, J-2, J-3 laissées inconnues : ${dire(t5)} ; « ${t5.note} » (étape 5)`);
    await w.c.close();

    console.log('chemin S : une journée sans saisie reste inconnue, jamais zéro (RLM-008)');
    const u = await cheminS({ mode: 'reduire', limit: 2, depuis: jj(-2) });
    const lire8 = () => u.q.evaluate(() => {
      const sec = document.querySelector('[id^="rlmWeekH-"]').closest('section'), t = sec.querySelector('.rlm-cmp');
      return { dates: [...sec.querySelectorAll('ul.rlm-days li.item[data-date]')].map(l => [l.dataset.date, !!l.querySelector('[data-act="rlm-day-at"]')]),
        regle: (sec.querySelector('p.hint') || {}).textContent || '', phrase: ((sec.querySelector('p.empty') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
        lignes: t ? [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())) : null };
    });
    const ligne8 = (t, l) => ((t.lignes || []).find(x => x[0].startsWith(l)) || [])[1];
    const s1 = await lire8(), statuts1 = [await u.jour(jj(0)), await u.jour(jj(-1)), await u.jour(jj(-2))];
    check((await u.q.textContent('#main')).replace(/\s+/g, ' ').includes('Aujourd\'hui, déjà noté : 0 verre standard · pas encore confirmée')
      && JSON.stringify(s1.dates) === JSON.stringify([[jj(0), true], [jj(-1), true], [jj(-2), true]]) && statuts1.every(x => x === 'inconnue')
      && s1.regle.trim() === 'Une journée inconnue ne vaut jamais zéro, ni un échec. Les jours d\'avant le début du suivi ne comptent pas.',
      `rien de noté : « déjà noté : 0 verre standard · pas encore confirmée » ; J, J-1, J-2 « ${statuts1.join(' / ')} », chacun avec « confirmer », rien avant J-2 ; la règle (étape 1)`);
    check(s1.lignes === null && s1.phrase.startsWith('Rien à comparer pour l\'instant : ce tableau ne compte que les journées confirmées'),
      `aucune journée confirmée : pas de tableau, « ${s1.phrase.slice(0, 50)}… » (étape 2, C27)`);
    await u.noter(jj(-1), 1);
    const s3 = await lire8(), hier8 = await u.jour(jj(-1));
    check(hier8 === 'inconnue · déjà noté : 1 verre standard, pas encore confirmée' && s3.lignes === null && s3.phrase.startsWith('Rien à comparer'),
      `1 à J-1 : « ${hier8} » ; toujours pas de tableau (étape 3, C27)`);
    await u.vider(); await u.q.click(`ul.rlm-days [data-act="rlm-day-at"][data-date="${jj(-2)}"]`); await u.q.waitForSelector('#cdlg[open]');
    const boite8 = (await u.q.textContent('#cmsg')).replace(/\s+/g, ' ').trim();
    await u.q.evaluate(() => { window.__ferme = new Promise(r => document.querySelector('#cdlg').addEventListener('close', () => setTimeout(r), { once: true })); });
    await u.q.click('#cdlg button[value="cancel"]'); await u.q.evaluate(() => window.__ferme); await u.q.waitForTimeout(300);
    const annule8 = [await u.jour(jj(-2)), (await u.q.textContent('#toast')).trim(), (await u.contenu()).entries.some(e => e.kind === 'day')];
    check(/^\S+ \d+ \S+ 2026 : 0 verre standard au total\. Aucune consommation notée ce jour-là : confirmer en fait une journée à zéro\. Confirmer, c'est dire que toutes les consommations de cette journée sont notées\. Annuler la laisse inconnue, sans pénalité\.$/.test(boite8)
      && annule8[0] === 'inconnue' && !annule8[1] && !annule8[2], `« confirmer » sur J-2 : « ${boite8.slice(0, 70)}… » ; « Annuler » : J-2 « ${annule8[0]} », aucun message, rien d'enregistré (étape 4)`);
    const [, dit8] = await u.confirmer(jj(-2)), s5 = await lire8(), avant8 = await u.jour(jj(-2));
    check(avant8 === 'complète : 0 verre standard · objectif atteint' && /^Journée du \d+ oct\. confirmée\.$/.test(dit8) && ligne8(s5, 'Complètes') === '1' && ligne8(s5, 'Moyenne') === '0 verre standard'
      && ligne8(s5, 'Journées suivies') === '3' && ligne8(s5, 'Inconnues') === '2' && ligne8(s5, 'Quantités déclarées') === '1 verre standard' && ligne8(s5, 'Objectif atteint') === '1 sur 1 journée évaluable',
      `« Confirmer » : « ${dit8} » ; J-2 « ${avant8} » ; le tableau : ${(s5.lignes || []).map(x => x.slice(0, 2).join(' = ')).join(' ; ')} (étape 5)`);
    await u.c.close();

    console.log('chemin S : la pause de cinq minutes, rechargée, fermée, arrêtée, échue (RLM-017)');
    // Tabac, observer depuis J ; l'horloge installée à 20 h, avancée à la main : la pause se lit à la seconde près.
    const pz = await cheminS({ mode: 'observer', depuis: jj(0), sujet: 'tabac', horloge: 'installee' });
    const pause = () => pz.q.evaluate(() => { const s = document.querySelector('section.rlm-pause'); return s ? { titre: s.querySelector('h3').textContent.trim(), reste: (document.querySelector('#rlmPause') || {}).textContent || '', aide: [...s.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()).join(' | '), boutons: [...s.querySelectorAll('button')].map(b => b.textContent.trim()) } : null; });
    // Les aides de cheminS gardent la première page ; celles-ci lisent la page en cours (l'onglet est rouvert à l'étape 3).
    const contenuZ = async () => ((await storeJSON(pz.q, 'selene-site-v1')) || { modules: {} }).modules[pz.id] || { entries: [] };
    const versZ = async (h, sel) => { await pz.q.evaluate(x => { location.hash = x; }, h); await pz.q.waitForSelector(sel, { state: 'attached' }); };
    const journal17 = async () => (await contenuZ()).entries.length;
    await pz.vider(); await pz.q.click('[data-act="rlm-urge"]'); await pz.q.waitForFunction(() => document.querySelector('#dlg').open);
    await pz.q.selectOption('#form [name="strategy"]', 'Marcher quelques minutes'); await pz.q.selectOption('#form [name="pause"]', 'oui');
    await pz.q.click('#form button[value="save"]'); await pz.q.waitForFunction(() => !document.querySelector('#dlg').open);
    await pz.bulle('Envie notée'); await pz.q.waitForSelector('#rlmPause[role="timer"]'); await pz.q.clock.runFor(10);
    const p1 = await pause(), dit17 = await pz.dit();
    check(dit17 === 'Envie notée. Cinq minutes, à ton rythme.' && p1 && p1.titre === 'Cinq minutes de pause' && p1.reste === '5:00'
      && p1.aide.includes('Jusqu\'à 20:05. Elle continue si tu fermes l\'app ou si l\'écran se met en veille. Tu peux l\'arrêter quand tu veux.')
      && JSON.stringify(p1.boutons) === JSON.stringify(['J\'ai fait : Marcher quelques minutes', 'Arrêter la pause']),
      `« ${dit17} » ; « ${p1 && p1.titre} », ${p1 && p1.reste}, « Jusqu'à 20:05… », ${p1 && p1.boutons.map(x => `« ${x} »`).join(' et ')} (RLM-017, étape 1)`);
    await pz.q.clock.runFor(60000); await pz.q.reload(); await pz.vers(pz.id, '#rlmPause[role="timer"]'); await pz.q.clock.runFor(10);
    const p2 = await pause();
    // L'horloge installée avance aussi en temps réel pendant un chargement (démarrage lent, processeur ralenti) : à
    // quelques secondes près. Ce qui compte : ni 5:00 (la pause remise à zéro), ni plus rien (perdue).
    const secondes = t => { const m = /^(\d+):(\d\d)$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
    check(p2 && secondes(p2.reste) <= 240 && secondes(p2.reste) >= 225 && p2.aide.includes('Jusqu\'à 20:05.'), `une minute plus tard, rechargée : ${p2 && p2.reste} (4:00 à quelques secondes près), toujours « Jusqu'à 20:05 » (étape 2)`);
    // L'onglet fermé, une minute passe, un autre onglet s'ouvre sur l'espace.
    await pz.q.close(); await pz.c.clock.runFor(60000);
    pz.q = await pz.c.newPage(); pz.q.on('pageerror', e => errs.push(e.message));
    await pz.q.goto(BASE + '/index.html#' + pz.id); await pz.q.waitForSelector('#rlmPause[role="timer"]'); await pz.q.clock.runFor(10);
    const p3 = await pause();
    check(p3 && secondes(p3.reste) <= 180 && secondes(p3.reste) >= 165 && secondes(p3.reste) < secondes(p2.reste) - 50, `l’onglet fermé une minute, puis rouvert : ${p3 && p3.reste} (3:00 à quelques secondes près) (étape 3)`);
    await pz.q.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await pz.q.click('[data-act="rlm-pause-stop"]'); await pz.q.waitForFunction(() => !document.querySelector('section.rlm-pause'));
    check(!(await pause()) && !(await pz.q.textContent('#toast')).trim(), '« Arrêter la pause » : l’encadré disparaît, sans message (étape 4)');
    const avant17 = await journal17(), marques17 = (await contenuZ()).entries.filter(e => e.kind === 'action').length;
    await pz.q.click('[data-act="rlm-pause"]'); await pz.q.waitForSelector('#rlmPause[role="timer"]');
    await pz.q.clock.runFor(5 * 60000 + 1000);
    await pz.q.waitForFunction(() => (document.querySelector('section.rlm-pause h3') || {}).textContent === 'Pause terminée', null, { timeout: 5000 }).catch(() => {});
    const p5 = await pause(), apres17 = await journal17(), marques17b = (await contenuZ()).entries.filter(e => e.kind === 'action').length;
    check(p5 && p5.titre === 'Pause terminée' && p5.aide === 'Tu peux noter ce qui t\'a aidé, ou simplement fermer cet encadré.' && p5.boutons.includes('Fermer') && apres17 === avant17 && marques17b === marques17,
      `« Pause de 5 min » sur l’envie, cinq minutes plus tard : « ${p5 && p5.titre} », « ${p5 && p5.aide} », ${p5 && p5.boutons.map(x => `« ${x} »`).join(', ')} ; le journal (${avant17} → ${apres17}) et les gestes faits inchangés (étape 5)`);
    await versZ('accueil', '#capIn'); await pz.q.clock.runFor(11 * 60000); await versZ(pz.id, '[data-act="rlm-urge"]'); await pz.q.clock.runFor(10);
    check(!(await pause()), 'revenue plus de dix minutes après l’échéance : l’encadré n’est plus là (étape 6)');
    await pz.c.close();

    console.log('chemin S : aucun détail hors de l’espace (RLM-020)');
    // rlm-en-cours.json importé : « Carnet du soir », ses notes « Repas de famille », « Après le travail », son appui
    // « Marcher quelques minutes » ; puis un espace Motifs et la note « famille recomposée » dans la Boîte.
    const cv = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Europe/Paris' });
    const v = await cv.newPage(); v.on('pageerror', e => errs.push(e.message)); await v.clock.setFixedTime(INSTANT);
    await ouvrir(v, BASE + '/index.html#sans-compte', entree);
    const versV = async (h, sel) => { await v.evaluate(x => { location.hash = x; }, h); await v.waitForSelector(sel, { state: 'attached' }); };
    const bulleV = t => v.waitForFunction(x => ((document.querySelector('#toast') || {}).textContent || '').includes(x), t, { timeout: 5000 }).then(() => true, () => false);
    await versV('reglages', 'input[data-act="imp"]');
    await v.setInputFiles('input[data-act="imp"]', path.join(__dirname, '..', '..', 'docs', 'recette', 'donnees', 'rlm-en-cours.json'));
    await v.waitForSelector('#cdlg[open]', { timeout: 5000 }).catch(() => {}); if (await v.$('#cdlg[open]')) await v.click('#cdlg button[value="ok"]');
    await bulleV('Sauvegarde importée.');
    await versV('reglages', '[data-act="tpl-add"][data-tpl="motifs"]'); await v.$eval('[data-act="tpl-add"][data-tpl="motifs"]', x => x.click());
    await v.waitForFunction(() => [...document.querySelectorAll('#nav a')].some(a => a.textContent.trim().endsWith('Motifs')));
    const motifs = await v.evaluate(() => [...document.querySelectorAll('#nav a')].find(a => a.textContent.trim().endsWith('Motifs')).getAttribute('href').slice(1));
    const capturerV = async t => {
      await versV('accueil', '#capIn'); await v.evaluate(() => { document.querySelector('#toast').textContent = ''; }); await v.fill('#capIn', t); await v.click('[data-act="cap-add"]');
      await v.waitForFunction(() => !!document.querySelector('#toast').textContent.trim(), null, { timeout: 5000 }).catch(() => {});
      return v.evaluate(() => { const x = document.querySelector('#toast'); return { texte: x.textContent.replace(/\s+/g, ' ').trim(), action: !!x.querySelector('[data-act="undo"]') }; });
    };
    await capturerV('famille recomposée');
    // La recherche se refait à chaque frappe : la ligne qui compte les résultats dit qu'elle a répondu à cette requête.
    const chercher = async q => {
      await versV('recherche', '#searchIn'); await v.fill('#searchIn', q);
      await v.waitForFunction(x => document.querySelector('#searchIn').value === x && !!document.querySelector('#main .row .hint'), q);
      return v.evaluate(() => ({ groupes: [...document.querySelectorAll('#main .search-grp')].map(g => g.textContent.replace(/\s+/g, ' ').trim()), texte: document.querySelector('#main').textContent.replace(/\s+/g, ' ') }));
    };
    const r20 = { famille: await chercher('famille'), repas: await chercher('Repas de famille'), apres: await chercher('Après le travail'), marcher: await chercher('Marcher') };
    check(r20.famille.groupes.length === 1 && r20.famille.groupes[0].startsWith('Boîte') && !r20.famille.texte.includes('Repas de famille')
      && [r20.repas, r20.apres, r20.marcher].every(r => !r.texte.includes('Carnet du soir') && !r.texte.includes('Repas de famille') && !r.texte.includes('Après le travail') && !r.texte.includes('Marcher quelques minutes')),
      `la recherche : « famille » ne trouve que la Boîte (${r20.famille.groupes.join(', ')}) ; « Repas de famille », « Après le travail », « Marcher » : rien du suivi (${[r20.repas, r20.apres, r20.marcher].map(r => r.groupes.join('+') || 'aucun groupe').join(' / ')}) (étape 2)`);
    const palette = async q => {
      await versV('accueil', '#capIn'); await v.keyboard.press('Control+k'); await v.waitForSelector('#palIn'); await v.keyboard.type(q);
      await v.waitForFunction(x => document.querySelector('#palIn').value === x && document.querySelectorAll('#palList li').length > 0, q, { timeout: 5000 }).catch(() => {});
      const items = await v.$$eval('#palList li', ls => ls.map(l => [...l.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')));
      await v.keyboard.press('Escape'); await v.waitForFunction(() => !document.querySelector('#palette').open, null, { timeout: 5000 }).catch(() => {}); return items;
    };
    const [pCarnet, pFamille] = [await palette('Carnet'), await palette('famille')];
    check(pCarnet.some(x => x.startsWith('Espace Carnet du soir')) && pFamille.length >= 1 && pFamille.every(x => !x.includes('Repas de famille') && !x.includes('Carnet du soir')) && pFamille.some(x => x.includes('famille recomposée')),
      `la palette : « Carnet » propose « ${pCarnet.find(x => x.includes('Carnet du soir')) || '—'} » ; « famille » : ${pFamille.join(' | ')} (étape 3)`);
    await versV(motifs, '[data-act="col-new"]'); await v.click('[data-act="col-new"]'); await v.waitForFunction(() => document.querySelector('#dlg').open);
    await v.fill('#form [name="title"]', 'famille'); await v.click('#form button[value="save"]'); await v.waitForFunction(() => !document.querySelector('#dlg').open);
    await v.waitForSelector('#main li.item.motif'); const motif = (await v.textContent('#main li.item.motif .meta')).replace(/\s+/g, ' ').trim();
    check(/^1 occurrence · dernière .*\(Boîte\)$/.test(motif), `le motif « famille » : « ${motif} », rien de « Carnet du soir » (étape 4)`);
    const c6 = await capturerV('Carnet du soir : deux verres hier');
    await versV('inbox', '#main li.item');
    const sous6 = await v.evaluate(() => { const li = [...document.querySelectorAll('#main li.item')].find(l => (l.querySelector('.ntext') || {}).textContent === 'Carnet du soir : deux verres hier');
      return li ? { ranger: [...li.querySelectorAll('[data-act="note-file"]')].map(x => x.textContent.trim()), vers: [...li.querySelectorAll('[data-act="note-to"]')].map(x => x.textContent.trim()) } : null; });
    const vers6 = await v.evaluate(() => [...document.querySelectorAll('#main [data-act="note-to"]')].map(x => x.textContent.trim()));
    check(!c6.action && c6.texte.startsWith('Gardé') && !c6.texte.includes('Ranger') && !!sous6 && !sous6.ranger.length && !sous6.vers.some(x => x.includes('Carnet du soir')) && !vers6.some(x => x.includes('Carnet du soir')),
      `« Carnet du soir : deux verres hier » gardé : « ${c6.texte} », sans « Ranger » ; sous les notes de la Boîte : ${vers6.join(', ') || 'aucun bouton « → … »'}, aucun « → Carnet du soir » (étape 6)`);
    await cv.close();
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await browser.close(); }
})();
