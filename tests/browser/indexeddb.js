/* Scénario de navigateur : le stockage de la version hébergée dans IndexedDB (ADR 13). Migration depuis localStorage
   (les secrets y restent), survie à une relance, deux onglets qui se voient, et un document plus gros que ce que
   localStorage accepte. Faux Supabase, compte connecté. Puis le navigateur vraiment quitté et relancé, sur un profil
   gardé sur le disque (DON-008). Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { storeGet, storeJSON, suivre, calme, fauxSupabase, synchro, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await fauxSupabase(ctx);
  // Un appareil tel que l'a laissé une version à localStorage : le document, une préférence, la session.
  await ctx.addInitScript(([d, s, uid]) => {
    if (sessionStorage.getItem('seme')) return; sessionStorage.setItem('seme', '1');
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-bilan', 'mois');
    localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
  }, [fixture(), session, UID]);
  const open = async (page, hash = 'accueil') => { await page.goto(BASE + '/index.html#' + hash); await page.waitForSelector('#nav a', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(200); };
  const p = suivre(await ctx.newPage()); p.on('pageerror', e => errs.push(e.message));
  await open(p);

  console.log('migration');
  ok((await p.textContent('#nav')).includes('Phidippus'), 'le document venu de localStorage est affiché');
  ok((await storeGet(p, 'selene-bilan')) === 'mois' && (await storeJSON(p, 'selene-site-v1')).modules.phidippus, 'copié dans IndexedDB');
  const left = await p.evaluate(() => Object.keys(localStorage).sort());
  ok(left.join() === 'selene-auth-session', 'localStorage ne garde que les secrets (' + left.join(', ') + ')');

  ok(!(await synchro(p)), 'synchronisé pour de vrai, sans « Non synchronisé » (BL-23)');
  console.log('écrire, relancer');
  await p.fill('#capIn', 'Une idée gardée dans IndexedDB'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(300);
  ok(JSON.stringify(await storeJSON(p, 'selene-site-v1')).includes('Une idée gardée dans IndexedDB'), 'une capture est écrite dans IndexedDB');
  const d0 = await storeJSON(p, 'selene-site-v1'), inbox = Object.keys(d0.modules).find(k => d0.modules[k].type === 'notes' && d0.modules[k].config.inbox);
  // Avant chaque rechargement, plus rien en vol vers le faux Supabase : sous WebKit, une écriture coupée s'écrit à la
  // console comme une erreur de la page (A29, même cause qu'A1 et A19).
  await calme(p); await p.reload(); await open(p, inbox);
  ok((await p.textContent('#main')).includes('Une idée gardée'), 'et relue après relance');

  console.log('deux onglets');
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push(e.message));
  await open(q, inbox); await open(p);
  // DON-008, étape 1 : les deux onglets montrent les mêmes espaces, sans écran d'entrée.
  const espaces = x => x.$$eval('#nav a[href^="#"]', as => as.map(a => a.getAttribute('href')).join(' '));
  const [e1, e2] = [await espaces(p), await espaces(q)];
  ok(e1 && e1 === e2 && e1.includes('#phidippus') && !(await p.$('#authForm')) && !(await q.$('#authForm')), `deux onglets : les mêmes espaces (${e1.split(' ').length} liens), sans écran d’entrée (DON-008, étape 1)`);
  await p.fill('#capIn', 'Vue depuis l’autre onglet'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(700);
  ok((await q.textContent('#main')).includes('Vue depuis l’autre onglet'), 'l’autre onglet se met à jour (BroadcastChannel)');
  // Étape 3 : IndexedDB, base « selene », magasin « kv » : le document et sa base (connecté) ; localStorage, pas le document.
  const cles = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('selene'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').getAllKeys(); q.onsuccess = () => { r.result.close(); res(q.result.map(String)); }; }; }));
  const local3 = await p.evaluate(() => Object.keys(localStorage));
  ok(cles.includes('selene-site-v1') && cles.includes('selene-site-v1-base') && !local3.includes('selene-site-v1'), `IndexedDB selene/kv : selene-site-v1 et selene-site-v1-base ; localStorage : ${local3.join(', ')} (étape 3)`);

  console.log('au-delà du plafond de localStorage');
  // L'app d'abord au repos : synchronisée (BL-23), elle réécrirait son document par-dessus celui qu'on dépose.
  await calme(p);
  const big = 'x'.repeat(1000);
  const d = await storeJSON(p, 'selene-site-v1');
  d.modules[inbox].entries.push(...Array.from({ length: 6000 }, (_, i) => ({ id: 'gros' + i, text: 'note ' + i + ' ' + big, date: '2026-09-01' })));
  const chars = JSON.stringify(d).length;
  await p.evaluate(([k, v]) => new Promise(res => { const r = indexedDB.open('selene'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => { r.result.close(); res(); }; }; }), ['selene-site-v1', JSON.stringify(d)]);
  await calme(p); await p.reload(); await p.waitForSelector('#nav a', { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(300);
  await p.fill('#capIn', 'Après le plafond'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(500);
  const after = await storeGet(p, 'selene-site-v1');
  // localStorage plafonne vers 5 M caractères par site, toutes clés comprises : 6 M ne tiendraient pas.
  ok(chars > 6e6 && after.includes('Après le plafond') && after.length > 6e6, `un document de ${(after.length / 1e6).toFixed(1)} M caractères est enregistré (localStorage : ~5 M au plus)`);

  await b.close();

  console.log('quitter le navigateur, le relancer (DON-008, étape 4)');
  // Un profil gardé sur le disque, comme un vrai navigateur : la capture faite, le navigateur fermé, relancé sur le même
  // profil. Le faux serveur de la relance est neuf (vide) : ce qui revient vient de l'appareil.
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'selene-relance-')), ouverts = [];
  const lancer = async () => {
    const c = await engine.launchPersistentContext(profil, { ...launchOptions, viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await fauxSupabase(c);
    await c.addInitScript(([s, uid]) => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [session, UID]);
    const page = suivre(c.pages()[0] || await c.newPage()); page.on('pageerror', e => errs.push(e.message)); ouverts.push(c); return { c, page };
  };
  try {
    const L1 = await lancer(); await open(L1.page);
    await L1.page.fill('#capIn', 'relance DON-008'); await L1.page.press('#capIn', 'Enter');
    await L1.page.waitForFunction(() => document.querySelector('#toast').textContent.trim().length > 0, null, { timeout: 5000 }).catch(() => {});
    const ecrite = async x => JSON.stringify(await storeJSON(x, 'selene-site-v1')).includes('relance DON-008');
    for (let i = 0; i < 50 && !(await ecrite(L1.page)); i++) await L1.page.waitForTimeout(100);
    await calme(L1.page); await L1.c.close();
    const L2 = await lancer(); await open(L2.page);
    const d2 = await storeJSON(L2.page, 'selene-site-v1'), boite = Object.keys(d2.modules).find(k => d2.modules[k].type === 'notes' && d2.modules[k].config.inbox);
    await open(L2.page, boite);
    ok((await L2.page.textContent('#main')).includes('relance DON-008'), 'le navigateur quitté puis relancé sur le même profil : la capture est là, relue sur l’appareil (étape 4)');
    await calme(L2.page); await L2.c.close();
  } catch (e) { ok(false, 'relance : ' + e.message.split('\n')[0]); }
  finally { for (const c of ouverts) await c.close().catch(() => {}); fs.rmSync(profil, { recursive: true, force: true }); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
})();
