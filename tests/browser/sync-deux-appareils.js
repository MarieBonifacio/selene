/* Scénario de navigateur : deux appareils du même compte, branchés sur un faux Supabase (interception réseau).
   Vérifie la fusion (B n'a jamais vu ce qu'a écrit A) et qu'une saisie faite juste avant de fermer l'onglet
   n'est pas perdue : restée sur l'appareil, elle part à la réouverture. Puis, sur un compte neuf, une saisie vue sur
   l'autre appareil à la relève, une suppression vue dès le retour sur l'onglet (A57), la frappe que la relève
   n'efface pas (SYN-001, A33). Puis, sur un second compte rempli du jeu
   d'essai, deux appareils coupés du réseau qui divergent et se réconcilient (SYN-003, SYN-008), et un appareil qui
   trouve sur le serveur un format plus récent que le sien (SYN-007). Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const path = require('node:path');
const { engine, BASE, launchOptions, check, until, donnee, ouvrir, entree, storeJSON, synchro } = require('./helpers');
const rows = new Map();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname === '/rest/v1/activite') return route.fulfill({ status: 201, body: '' }); // la mesure d'usage (services/activite.js)
  if (u.pathname !== '/rest/v1/app_state') return json(route, 404, {}); // fonctions (passeur…) : absentes ici
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  const stamp = (u.searchParams.get('select') || '').match(/^u:(\w+)->>updatedAt$/); // la date seule (polling)
  if (m === 'GET' && stamp) return json(route, 200, row ? [{ u: row[stamp[1]] && row[stamp[1]].updatedAt != null ? String(row[stamp[1]].updatedAt) : null }] : []);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') {
    if (!row) return json(route, 200, []);
    for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = row[c] && row[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(route, 200, []); }
    Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  }
}
const sessionFor = id => JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: 'a@b.c' } });
const session = sessionFor('u1');
const coupes = new Set(); // les appareils dont le réseau est coupé : leurs requêtes au faux serveur échouent
// Ce que chaque appareil a demandé au faux serveur : affiché si la dernière vérification échoue.
const log = [];
const inbox = () => ((rows.get('u1') || {}).site?.modules?.inbox?.entries || []).map(i => i.text);
/* `uid` : le compte ; `essai` : un jeu (site, board) posé sur l'appareil avant le premier chargement ; `horloge` : l'horloge
   de la page installée, pour avancer jusqu'à la relève de 30 s au lieu de l'attendre. */
async function device(browser, errs, tag, { uid = 'u1', essai = null, horloge = false } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await ctx.route('https://*.supabase.co/**', r => { const u = new URL(r.request().url()); if (coupes.has(tag)) return r.abort('internetdisconnected'); if (!u.pathname.startsWith('/auth/')) log.push(`${tag} ${r.request().method()} ${(u.searchParams.get('select') || '').slice(0, 20)}`); return supabase(r); });
  await ctx.addInitScript(([s, id]) => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', id); } }, [sessionFor(uid), uid]);
  if (essai) await ctx.addInitScript(([si, bd]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', si); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  if (horloge) await page.clock.install();
  if (uid === 'u1') { await page.goto(BASE + '/index.html'); await page.waitForTimeout(600); } else await ouvrir(page, BASE + '/index.html', entree);
  const couper = async on => { if (on) coupes.add(tag); else coupes.delete(tag); await ctx.setOffline(on); };
  return { ctx, page, couper };
}
const capture = async (p, text) => { await p.fill('#capIn', text); await p.click('[data-act="cap-add"]'); };
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  const A = await device(browser, errs, 'A');
  // Le serveur est attendu jusqu'à ce qu'il réponde (until), pas un délai fixe : une machine de CI chargée met plus
  // de temps à envoyer, sans rien perdre.
  await until(() => !!rows.get('u1')?.site?.config);
  check(!!rows.get('u1')?.site?.config, 'le premier appareil crée le compte sur le serveur');
  const B = await device(browser, errs, 'B');
  await capture(A.page, 'alpha'); await until(() => inbox().includes('alpha'));
  await capture(B.page, 'beta'); await until(() => inbox().includes('beta')); // B n'a jamais vu alpha
  check(inbox().join() === 'alpha,beta', `fusion : les deux captures sur le serveur (${inbox().join(', ')})`);
  await B.page.evaluate(() => location.hash = 'inbox'); await B.page.waitForTimeout(300);
  const t = await B.page.textContent('#main');
  check(t.includes('alpha') && t.includes('beta'), 'B affiche aussi ce qu’a écrit A');
  await capture(A.page, 'gamma'); await A.page.close({ runBeforeUnload: true }); // fermé dans le délai de 900 ms
  await new Promise(r => setTimeout(r, 800));
  const A2 = await A.ctx.newPage(); A2.on('pageerror', e => errs.push(e.message));
  log.push('— réouverture');
  await A2.goto(BASE + '/index.html'); await until(() => inbox().includes('gamma'));
  check(inbox().includes('gamma'), 'la saisie faite juste avant la fermeture part à la réouverture');
  if (!inbox().includes('gamma')) { // de quoi trancher : perdue sur l'appareil, ou restée sans être envoyée ?
    const local = await A2.evaluate(() => new Promise(r => { const q = indexedDB.open('selene'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('selene-site-v1'); g.onsuccess = () => r(String(g.result || '').includes('gamma')); g.onerror = () => r('?'); }; q.onerror = () => r('?'); })).catch(e => 'erreur : ' + e.message);
    console.log(`    A fermée : ${A.page.isClosed()} ; gamma dans l'IndexedDB de A2 : ${local} ; serveur : ${inbox().join(', ')}`);
    console.log(`    requêtes : ${log.slice(-14).join(' | ')}`);
  }

  console.log('une saisie faite sur un appareil apparaît sur l’autre (SYN-001)');
  // Un compte neuf : D1 le crée ; D2, l'horloge installée, ne relève que quand on l'avance, ou à son retour au premier
  // plan. L'onglet quitté puis retrouvé : visibilityState rendu « hidden », puis « visible », et l'événement joué.
  const inbox4 = () => ((rows.get('u4') || {}).site?.modules?.inbox?.entries || []).map(i => i.text);
  const D1 = await device(browser, errs, 'D1', { uid: 'u4' });
  await until(() => !!rows.get('u4')?.site?.config);
  const D2 = await device(browser, errs, 'D2', { uid: 'u4', horloge: true });
  const versD = async (x, h, sel) => { await x.page.evaluate(v => { location.hash = v; }, h); await x.page.waitForSelector(sel, { state: 'attached' }); };
  await versD(D2, 'inbox', '#main');
  await versD(D1, 'accueil', '#capIn');
  await D1.page.evaluate(() => { window.__vu = []; const s = document.querySelector('#saving'); new MutationObserver(() => window.__vu.push(s.textContent.trim())).observe(s, { childList: true, characterData: true, subtree: true }); });
  await capture(D1.page, 'de A1 SYN-001'); await until(() => inbox4().includes('de A1 SYN-001'));
  await D1.page.waitForFunction(() => !document.querySelector('#saving').textContent.trim(), null, { timeout: 10000 }).catch(() => {});
  const vu1 = await D1.page.evaluate(() => window.__vu);
  check(inbox4().includes('de A1 SYN-001') && vu1.includes('Enregistrement…') && vu1[vu1.length - 1] === '' && !(await synchro(D1.page)),
    `A1 : la capture, l’indicateur « ${vu1.filter(Boolean).join(' » puis « ')} » puis effacé (SYN-001, étape 1)`);
  const dansD2 = t => D2.page.evaluate(x => document.querySelector('#main').textContent.includes(x), t);
  const avant2 = await dansD2('de A1 SYN-001');
  await D2.page.clock.fastForward(31000);
  await D2.page.waitForFunction(() => document.querySelector('#main').textContent.includes('de A1 SYN-001'), null, { timeout: 5000 }).catch(() => {});
  check(!avant2 && await dansD2('de A1 SYN-001') && (await D2.page.evaluate(() => location.hash)) === '#inbox', 'A2, l’onglet visible, sans geste : la capture apparaît dans sa boîte à la relève de 30 s (étape 2)');
  const onglet = (x, cache) => x.page.evaluate(h => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, cache);
  await onglet(D2, true);
  await versD(D1, 'inbox', '#main li.item');
  await D1.page.evaluate(() => { const li = [...document.querySelectorAll('#main li.item')].find(l => (l.querySelector('.ntext') || {}).textContent === 'de A1 SYN-001'); li.querySelector('[data-act="note-del"]').click(); });
  await until(() => !inbox4().includes('de A1 SYN-001')); // « Annuler » laissé passer : la suppression est partie
  const encore3 = await dansD2('de A1 SYN-001');
  await onglet(D2, false);
  // Rien n'avance l'horloge de D2 ici : seul le retour au premier plan peut relever (la relève de 30 s est loin).
  await D2.page.waitForFunction(() => !document.querySelector('#main').textContent.includes('de A1 SYN-001'), null, { timeout: 5000 }).catch(() => {});
  check(!inbox4().includes('de A1 SYN-001') && encore3 && !(await dansD2('de A1 SYN-001')), 'A2 sur un autre onglet, A1 supprime la capture : de retour sur l’onglet, A2 ne la montre plus, sans attendre la relève (étape 3, A57)');
  // Étape 4 (A33) : A2 tape la clé OpenAlex sans quitter le champ ; la capture de A1 arrive à la relève, pendant la frappe.
  await versD(D2, 'dehors', 'text=Clé OpenAlex (facultative)'); await D2.page.click('text=Clé OpenAlex (facultative)');
  await D2.page.fill('[data-act="oa-key"]', 'cle-de-recette');
  await versD(D1, 'accueil', '#capIn'); await capture(D1.page, 'pendant la frappe'); await until(() => inbox4().includes('pendant la frappe'));
  await D2.page.clock.fastForward(31000);
  const arrivee = async () => JSON.stringify(await storeJSON(D2.page, 'selene-site-v1')).includes('pendant la frappe');
  for (let i = 0; i < 50 && !(await arrivee()); i++) await D2.page.waitForTimeout(100);
  const frappe = await D2.page.evaluate(() => { const a = document.activeElement; return { valeur: (document.querySelector('[data-act="oa-key"]') || {}).value, focus: !!a && a.dataset.act === 'oa-key', ouvert: !!a && !!a.closest('details[open]') }; });
  await D2.page.locator('[data-act="oa-key"]').blur();
  await D2.page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Clé OpenAlex gardée'), null, { timeout: 5000 }).catch(() => {});
  await versD(D2, 'inbox', '#main');
  check(await arrivee() && frappe.valeur === 'cle-de-recette' && frappe.focus && frappe.ouvert && await dansD2('pendant la frappe'),
    `A2 tape la clé quand la capture de A1 arrive : la clé reste (« ${frappe.valeur} »), le curseur dans le champ, le bloc ouvert ; le champ quitté, la capture est dans sa boîte (étape 4, A33)`);
  await D1.ctx.close(); await D2.ctx.close();

  console.log('deux appareils hors ligne, puis réconciliés (SYN-003, SYN-008)');
  // Un second compte : P pose le jeu d'essai sur le serveur, Q s'y branche ensuite et le reçoit.
  const essai = donnee('jeu-essai.json');
  const serveur2 = () => (rows.get('u2') || {}).site || {};
  const P = await device(browser, errs, 'P', { uid: 'u2', essai, horloge: true });
  await until(() => !!serveur2().modules?.chantier);
  const Q = await device(browser, errs, 'Q', { uid: 'u2', horloge: true });
  const site = x => storeJSON(x.page, 'selene-site-v1');
  const vers = async (x, h, sel) => { await x.page.evaluate(v => { location.hash = v; }, h); await x.page.waitForSelector(sel, { state: 'attached' }); };
  const nonSynchro = x => x.page.waitForFunction(() => /Non synchronisé/.test((document.querySelector('#saving') || {}).textContent || ''), null, { timeout: 10000 }).then(() => true, () => false);
  // La relève du serveur, toutes les 30 s : l'horloge de la page avancée d'autant.
  const releve = x => x.page.clock.fastForward(31000);
  const taches = async x => ((await site(x)).modules.chantier.entries || []);
  // `until` des aides n'attend pas une condition asynchrone : celle-ci l'attend, et rend ce qu'elle a vu en dernier.
  const jusqua = async (cond, ms = 10000) => { for (const end = Date.now() + ms; Date.now() < end; await new Promise(r => setTimeout(r, 100))) if (await cond()) return true; return !!(await cond()); };
  await vers(Q, 'chantier', 'li.item[data-task="t3"]');
  for (const x of [P, Q]) await x.couper(true);
  for (const x of [P, Q]) await releve(x);
  await P.page.waitForTimeout(300);
  const dits1 = [await synchro(P.page), await synchro(Q.page)];
  check(dits1.every(d => !d), `réseau coupé des deux côtés : rien ne s'affiche tant que rien n'est écrit, même après une relève (« ${dits1.join(' » / « ')} ») (SYN-003, étape 1 ; C21)`);
  await vers(P, 'chantier', 'li.item[data-task="t3"]');
  for (const t of ['t3', 't2']) {
    await P.page.$eval(`li.item[data-task="${t}"] [data-act="task-del"]`, x => x.click()); // « Annuler » laissé passer
    await P.page.waitForFunction(x => !document.querySelector(`li.item[data-task="${x}"]`), t, { timeout: 5000 }).catch(() => {});
  }
  const p2 = (await taches(P)).map(e => e.id);
  check(!p2.includes('t3') && !p2.includes('t2') && !(await P.page.$('li.item[data-task="t3"], li.item[data-task="t2"]')) && await nonSynchro(P),
    `P : « Appeler le plombier » et « Poser une étagère » quittent la liste ; « ${await synchro(P.page)} » (SYN-003, étape 2)`);
  await Q.page.$eval('li.item[data-task="t3"] [data-act="task-edit"]', x => x.click()); await Q.page.waitForFunction(() => document.querySelector('#dlg').open);
  await Q.page.fill('#form [name="note"]', 'urgent, mardi'); await Q.page.click('#form button[value="save"]'); await Q.page.waitForFunction(() => !document.querySelector('#dlg').open);
  await Q.page.click('li.item[data-task="t3"] [data-act="task-open"]');
  const noteQ = await Q.page.$eval('li.item[data-task="t3"] .note', x => x.textContent.trim()).catch(() => '');
  check(noteQ === 'urgent, mardi' && await nonSynchro(Q), `Q : « Appeler le plombier » porte la note « ${noteQ} » ; « ${await synchro(Q.page)} » (SYN-003, étape 3)`);
  // SYN-008, dans la même coupure : P désigne « Carnet », Q crée « Vrac SYN-008 » et le désigne.
  const boite = async (x, id) => {
    await vers(x, 'reglages', `[data-act="notes-inbox"][data-mod="${id}"]`); await x.page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await x.page.locator(`[data-act="notes-inbox"][data-mod="${id}"]`).check();
    await x.page.waitForFunction(i => !!(document.querySelector(`[data-act="notes-inbox"][data-mod="${i}"]`) || {}).checked, id);
  };
  await boite(P, 'carnet');
  await vers(Q, 'reglages', '#newModType'); await Q.page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await Q.page.selectOption('#newModType', 'notes'); await Q.page.fill('#newModName', 'Vrac SYN-008'); await Q.page.click('[data-act="mod-add"]');
  let vrac = null;
  for (let i = 0; i < 50 && !vrac; i++) { vrac = (Object.entries((await site(Q)).modules).find(([, m]) => m.label === 'Vrac SYN-008') || [])[0]; if (!vrac) await Q.page.waitForTimeout(100); }
  await boite(Q, vrac);
  const boites = async x => Object.entries((await site(x)).modules).filter(([, m]) => m.type === 'notes' && m.config.inbox).map(([k]) => k);
  const [b1P, b1Q] = [await boites(P), await boites(Q)];
  check(b1P.join() === 'carnet' && b1Q.join() === vrac && await nonSynchro(P) && await nonSynchro(Q), `hors ligne, chacun sa boîte : P « ${b1P} », Q « ${b1Q} » ; « Non synchronisé » des deux côtés (SYN-008, étape 1)`);
  // Le réseau rendu à P, relève ; puis à Q, relève ; puis une relève de P, qui reçoit ce que Q a fusionné.
  await P.couper(false); await releve(P);
  await until(() => !(serveur2().modules?.chantier?.entries || []).some(e => e.id === 't2'));
  await Q.couper(false); await releve(Q);
  await until(() => ((serveur2().modules?.chantier?.entries || []).find(e => e.id === 't3') || {}).note === 'urgent, mardi');
  await releve(P);
  await jusqua(async () => ((await taches(P)).find(e => e.id === 't3') || {}).note === 'urgent, mardi');
  const fin = [];
  for (const x of [P, Q]) {
    await vers(x, 'chantier', 'li.item[data-task="t1"]');
    const t = await taches(x), plombier = t.find(e => e.id === 't3') || {};
    fin.push(plombier.note === 'urgent, mardi' && !t.some(e => e.id === 't2') && !!(await x.page.$('li.item[data-task="t3"]')) && !(await x.page.$('li.item[data-task="t2"]')));
  }
  check(fin.length === 2 && fin.every(Boolean), `réseau rendu, puis relevé : sur les deux, « Appeler le plombier » existe avec « urgent, mardi », « Poser une étagère » est supprimée (SYN-003, étape 4)`);
  const [b2P, b2Q] = [await boites(P), await boites(Q)];
  await vers(Q, 'accueil', '#capIn'); await Q.page.fill('#capIn', 'capture SYN-008'); await Q.page.click('[data-act="cap-add"]');
  const recue = await jusqua(async () => (((await site(Q)).modules[b2Q[0]] || {}).entries || []).some(e => e.text === 'capture SYN-008'));
  check(b2P.length === 1 && b2P.join() === b2Q.join() && recue, `une seule boîte, la même sur les deux (« ${b2P} » / « ${b2Q} ») ; la capture rapide y va (SYN-008, étape 2)`);
  await P.ctx.close(); await Q.ctx.close();

  console.log('un format plus récent sur le serveur (SYN-007)');
  // Une version plus récente a déjà écrit sur ce compte : son document porte un format que celle-ci ne connaît pas.
  const FORMAT = Number(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'core', 'domain.js'), 'utf8').match(/export const SCHEMA_VERSION = (\d+);/)[1]);
  const futur = JSON.parse(JSON.stringify(essai.site));
  Object.assign(futur, { schemaVersion: FORMAT + 1, updatedAt: Date.now() });
  futur.modules.inbox.entries.push({ id: 'n-futur', text: 'écrite par une version plus récente', date: '2026-10-07' });
  rows.set('u3', { user_id: 'u3', site: futur, board: JSON.parse(JSON.stringify(essai.board)) });
  const avant7 = JSON.stringify(rows.get('u3').site);
  const V = await device(browser, errs, 'V', { uid: 'u3' });
  await V.page.waitForFunction(() => /mise à jour sur un autre appareil/.test((document.querySelector('#saving') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
  const dit7 = await synchro(V.page);
  check(dit7 === 'Selene a été mise à jour sur un autre appareil : recharge la page pour synchroniser', `l'ancienne version branchée : « ${dit7} » (SYN-007, étape 2)`);
  await vers(V, 'accueil', '#capIn'); await V.page.fill('#capIn', 'vieille version SYN-007'); await V.page.click('[data-act="cap-add"]');
  await V.page.waitForTimeout(1500); // le délai d'envoi (900 ms) passé : rien ne doit partir
  const ici7 = JSON.stringify(await site(V)).includes('vieille version SYN-007');
  check(ici7 && JSON.stringify(rows.get('u3').site) === avant7 && /mise à jour sur un autre appareil/.test(await synchro(V.page)), 'sa capture reste sur l’appareil ; rien n’est écrit au serveur ; l’indicateur le dit toujours (SYN-007, étape 3)');
  const apres7 = rows.get('u3').site;
  check(apres7.schemaVersion === FORMAT + 1 && apres7.modules.inbox.entries.some(e => e.text === 'écrite par une version plus récente') && !JSON.stringify(apres7).includes('vieille version SYN-007'),
    'le serveur intact : son format, sa note, et pas la capture de l’ancienne version (SYN-007, étape 4)');
  await V.ctx.close();
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await browser.close();
})();
