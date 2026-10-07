/* Scénario de navigateur : le stockage de la version hébergée dans IndexedDB (ADR 13). Migration depuis localStorage
   (les secrets y restent), survie à une relance, deux onglets qui se voient, et un document plus gros que ce que
   localStorage accepte. Faux Supabase, compte connecté. Lancé par tests/browser/run.js. */
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
  await p.fill('#capIn', 'Vue depuis l’autre onglet'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(700);
  ok((await q.textContent('#main')).includes('Vue depuis l’autre onglet'), 'l’autre onglet se met à jour (BroadcastChannel)');

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

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
