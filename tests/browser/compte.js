/* Scénario de navigateur : supprimer son compte depuis l'app (ADR 20, docs/compte.md). Faux Supabase, fausse fonction
   « compte » : rien ne part sans la confirmation tapée puis acceptée ; le réseau coupé, puis une panne, laissent tout en place ; une réussite
   vide l'appareil (données, session) et ramène à l'écran de connexion. Avant cela, la politique de confidentialité
   suivie depuis les Réglages, en français puis en anglais (TRV-012). Enfin, dans un autre navigateur du même compte, se
   déconnecter : ce qui attend part d'abord, hors ligne la garde le dit, puis l'appareil est vidé (CPT-013).
   Lancé par tests/browser/run.js. */
const path = require('node:path');
const { fauxSupabase, engine, BASE, launchOptions, fixture, check, until, storeGet, storeJSON } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [], appels = [];
  let panne = true, coupe = false;
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await fauxSupabase(ctx, r => {
    if (coupe) return r.abort('internetdisconnected'); // CPT-015, étape 4 : plus de réseau, vers aucune adresse du serveur
    const req = r.request(), u = new URL(req.url());
    if (u.pathname !== '/functions/v1/compte') return;
    appels.push({ corps: req.postDataJSON(), auth: req.headers().authorization });
    if (panne) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erreur: 'données non effacées ; réessaie' }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ supprime: true }) });
  });
  await ctx.addInitScript(([d, s, uid]) => {
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
  }, [fixture(), session, UID]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#reglages'); await p.waitForSelector('#auth-delete', { timeout: 10000 }).catch(() => {});

  console.log('garde-fous');
  ok(!!(await p.$('#auth-delete')), 'connecté : Réglages → Compte propose la suppression');
  ok(!!(await p.$('a[href$="confidentialite.html"]')), 'la politique de confidentialité est liée depuis les Réglages');

  // TRV-012 : le lien suivi, dans la langue de l'interface. Le site publié est servi depuis les fichiers du dépôt
  // (le réseau des scénarios est fermé) ; la page s'ouvre dans un nouvel onglet, dont on note les scripts demandés.
  await ctx.route('https://mariebonifacio.github.io/selene/*.html', r => r.fulfill({ path: path.join(__dirname, '..', '..', new URL(r.request().url()).pathname.split('/').pop()), contentType: 'text/html; charset=utf-8' }));
  const MOIS = [['janvier', 'January'], ['février', 'February'], ['mars', 'March'], ['avril', 'April'], ['mai', 'May'], ['juin', 'June'], ['juillet', 'July'], ['août', 'August'], ['septembre', 'September'], ['octobre', 'October'], ['novembre', 'November'], ['décembre', 'December']];
  const politique = async () => {
    // Le lien est dans « Supprimer mon compte », replié : le suivre sans le déplier, pour laisser la page comme elle était.
    const lien = await p.$eval('a[href*="mariebonifacio.github.io/selene/"]', a => ({ href: a.href, cible: a.target, rel: a.rel }));
    const [onglet] = await Promise.all([ctx.waitForEvent('page'), p.$eval('a[href*="mariebonifacio.github.io/selene/"]', a => a.click())]);
    const scripts = []; onglet.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
    await onglet.waitForLoadState('load');
    const lu = await onglet.evaluate(() => {
      const t = document.body.textContent.replace(/\s+/g, ' '), m = t.match(/(?:Dernière mise à jour :|Last updated:) (\d{1,2})(?:er)? (\p{L}+) (\d{4})/u);
      const h = [...document.querySelectorAll('h2')], duree = h.find(x => /^(Combien de temps|How long)$/.test(x.textContent.trim()));
      return { date: m ? [m[1], m[2], m[3]] : null, sections: h.length, durees: duree ? duree.nextElementSibling.textContent.replace(/\s+/g, ' ') : '', scripts: document.scripts.length };
    });
    const url = onglet.url(); await onglet.close(); return { lien, url, ...lu, demandes: scripts };
  };
  const fr = await politique();
  ok(fr.url.endsWith('/confidentialite.html') && fr.lien.cible === '_blank' && /noopener/.test(fr.lien.rel) && !!fr.date && fr.sections >= 12 && !fr.scripts && !fr.demandes.length
    && fr.durees.includes('une donnée effacée peut y subsister 30 jours au plus') && fr.durees.includes('Le journal des erreurs : 30 jours') && fr.durees.includes('La mesure d\'usage : 90 jours'),
    `interface en français : confidentialite.html dans un nouvel onglet, mise à jour le ${fr.date && fr.date.join(' ')}, ${fr.sections} sections, aucun script ; les sauvegardes « 30 jours au plus », le journal des erreurs 30 jours, la mesure d'usage 90 jours (TRV-012, étapes 1, 2 et 5)`);
  await p.selectOption('select[data-set="config.lang"]', 'en'); await p.waitForFunction(() => document.documentElement.lang === 'en');
  const en = await politique();
  const memeDate = !!(fr.date && en.date) && fr.date[0] === en.date[0] && fr.date[2] === en.date[2] && MOIS.findIndex(x => x[0] === fr.date[1]) === MOIS.findIndex(x => x[1] === en.date[1]) && MOIS.some(x => x[1] === en.date[1]);
  ok(en.url.endsWith('/privacy.html') && memeDate && en.sections === fr.sections && !en.scripts && !en.demandes.length && en.durees.includes('erased data may remain in them for 30 days at most'),
    `interface en anglais : ${en.url.split('/').pop()}, mise à jour le ${en.date && en.date.join(' ')}, la même date, ${en.sections} sections comme en français, aucun script (TRV-012, étape 4)`);
  await p.selectOption('select[data-set="config.lang"]', 'fr'); await p.waitForFunction(() => document.documentElement.lang === 'fr');
  await p.click('#auth-delete summary');
  await p.click('[data-act="auth-delete"]'); await p.waitForTimeout(200);
  ok(appels.length === 0 && !(await p.isVisible('#cdlg')), 'sans « supprimer » tapé : rien ne part');
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]');
  await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=cancel]'); await p.waitForTimeout(200);
  ok(appels.length === 0, 'annulé à la confirmation : rien ne part');

  console.log('réseau coupé (CPT-015, étape 4)');
  // Les données du cas : une capture, « à effacer CPT-015 ».
  await p.evaluate(() => { location.hash = 'accueil'; }); await p.waitForSelector('#capIn');
  await p.fill('#capIn', 'à effacer CPT-015'); await p.click('[data-act="cap-add"]');
  await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('#auth-delete');
  await p.evaluate(() => { document.querySelector('#auth-delete').open = true; });
  const capte = async () => ((await storeJSON(p, 'selene-site-v1')).modules.inbox.entries || []).some(e => e.text === 'à effacer CPT-015');
  for (let i = 0; i < 50 && !(await capte()); i++) await p.waitForTimeout(100); // until n'attend pas une condition asynchrone
  coupe = true; await ctx.setOffline(true);
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]'); await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=ok]');
  await p.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Compte non supprimé'), null, { timeout: 10000 }).catch(() => {});
  const dit4 = (await p.textContent('#toast')).trim(), garde4 = await capte();
  ok(dit4 === 'Compte non supprimé : Impossible de joindre le serveur. Vérifie ta connexion.' && garde4 && appels.length === 0
    && await p.evaluate(() => !!localStorage.getItem('selene-auth-session')) && !!(await p.$('#auth-delete')),
    `réseau coupé : « ${dit4} » ; la capture « à effacer CPT-015 » toujours là ; toujours connectée (CPT-015, étape 4)`);
  coupe = false; await ctx.setOffline(false);

  console.log('panne du serveur');
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]'); await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=ok]');
  await until(() => appels.length === 1); await p.waitForTimeout(300);
  ok(appels[0] && appels[0].corps.action === 'supprimer' && appels[0].corps.confirmation === 'supprimer' && appels[0].auth === 'Bearer a', 'la demande part avec la session');
  ok((await p.textContent('#toast').catch(() => '')).includes('non supprimé') || (await p.textContent('body')).includes('non supprimé'), 'l’échec est dit');
  ok(await p.evaluate(() => !!localStorage.getItem('selene-auth-session')) && !!(await p.$('#auth-delete')), 'et rien n’est effacé de l’appareil');

  console.log('suppression');
  panne = false;
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]');
  await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=ok]');
  await until(() => appels.length === 2);
  await p.waitForFunction(() => !localStorage.getItem('selene-auth-session'), null, { timeout: 5000 }).catch(() => {});
  ok(await p.evaluate(() => !localStorage.getItem('selene-auth-session')), 'la session est effacée');
  const site = await storeGet(p, 'selene-site-v1');
  ok(!site || !site.includes('iamamiwhoami'), 'les données du compte ont quitté l’appareil');
  ok(!(await p.$('#auth-delete')), 'plus de compte à supprimer');

  console.log('se déconnecter : ce qui attend part d’abord, l’appareil est vidé (CPT-013)');
  // Un autre navigateur, connecté au même compte ; le faux Supabase répond aussi à la connexion par le formulaire.
  // Hors ligne : ses requêtes échouent comme sans réseau (setOffline ne coupe pas une requête interceptée par route).
  const c13 = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  let horsLigne = false;
  const lignes13 = await fauxSupabase(c13, r => {
    if (horsLigne) return r.abort('internetdisconnected');
    const u = new URL(r.request().url());
    if (u.pathname === '/auth/v1/token') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: UID, email: 'a@b.c' } }) });
  });
  await c13.addInitScript(([d, s, uid]) => {
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
  }, [fixture(), session, UID]);
  const q = await c13.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(BASE + '/index.html'); await q.waitForSelector('#capIn', { timeout: 10000 });
  const versQ = async (h, sel) => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForSelector(sel, { state: 'attached' }); };
  const auServeur = t => JSON.stringify((lignes13.get(UID) || {}).site || {}).includes(t);
  const capturerQ = async t => { await versQ('accueil', '#capIn'); await q.fill('#capIn', t); await q.click('[data-act="cap-add"]'); await q.waitForFunction(() => !!document.querySelector('#toast').textContent.trim(), null, { timeout: 5000 }).catch(() => {}); };
  await until(() => lignes13.has(UID));
  horsLigne = true; await c13.setOffline(true);
  await capturerQ('Recette CPT-013 avant départ');
  await q.waitForFunction(() => document.querySelector('#saving').textContent.includes('Non synchronisé'), null, { timeout: 10000 }).catch(() => {});
  const indic = (await q.textContent('#saving')).trim();
  ok(indic.startsWith('Non synchronisé') && !auServeur('Recette CPT-013 avant départ'), `hors ligne, la capture gardée : « ${indic} », rien au serveur (CPT-013, étape 1)`);
  await versQ('reglages', '[data-act="auth-out"]'); await q.click('[data-act="auth-out"]');
  // « Se déconnecter » ouvre d'abord le choix (garder ou effacer les données de l'appareil) quand il y en a un.
  await q.waitForSelector('#cdlg[open], #dlg[open]', { timeout: 10000 }).catch(() => {});
  if (await q.$('#dlg[open]')) { await q.click('#form button[value="save"]'); await q.waitForSelector('#cdlg[open]', { timeout: 10000 }).catch(() => {}); }
  // Sans la garde, la déconnexion part aussitôt : aucune boîte à annuler, et le contrôle le dit.
  const garde = (await q.$('#cdlg[open]')) ? (await q.textContent('#cmsg')).replace(/\s+/g, ' ').trim() : '';
  if (garde) { await q.click('#cdlg button[value="cancel"]'); await q.waitForFunction(() => !document.querySelector('#cdlg').open); }
  const encore = await q.evaluate(() => !!localStorage.getItem('selene-auth-session'));
  const laCapture = encore && (await versQ('inbox', '#main').then(async () => (await q.textContent('#main')).includes('Recette CPT-013 avant départ'), () => false));
  ok(garde === 'Des modifications n\'ont pas pu être envoyées (hors ligne ?). Elles seront perdues si tu te déconnectes maintenant. Te déconnecter quand même ?' && encore && laCapture,
    `« Se déconnecter » hors ligne : « ${garde.slice(0, 60)}… » ; « Annuler » : toujours connectée, la capture est là (étapes 2 et 3)`);
  horsLigne = false; await c13.setOffline(false);
  // Le serveur reçoit l'envoi avant que la page n'ait lu sa réponse : attendre l'envoi, puis l'indicateur effacé.
  await until(() => auServeur('Recette CPT-013 avant départ'));
  await q.waitForFunction(() => !document.querySelector('#saving').textContent.trim(), null, { timeout: 30000 }).catch(() => {});
  const parti = auServeur('Recette CPT-013 avant départ'), apaise = !(await q.textContent('#saving')).trim();
  await versQ('accueil', '#capIn'); await q.fill('#capIn', 'brouillon CPT-013');
  // Le brouillon passe par le stockage de l'app (IndexedDB, ou localStorage à défaut) : relu jusqu'à ce qu'il y soit.
  let brouillonGarde = false;
  for (let i = 0; i < 50 && !brouillonGarde; i++) { brouillonGarde = (await storeGet(q, 'selene-draft:accueil:capIn')) === 'brouillon CPT-013'; if (!brouillonGarde) await q.waitForTimeout(100); }
  await q.evaluate(() => { window.__modales = []; const m = HTMLDialogElement.prototype.showModal; HTMLDialogElement.prototype.showModal = function () { window.__modales.push(this.id); return m.call(this); }; });
  await versQ('reglages', '[data-act="auth-out"]'); await q.click('[data-act="auth-out"]');
  if (await q.waitForSelector('#dlg[open]', { timeout: 2000 }).then(() => true, () => false)) await q.click('#form button[value="save"]');
  await q.waitForSelector('#authForm, [data-act="auth-local"]', { timeout: 10000 }).catch(() => {});
  const sansGarde = !(await q.evaluate(() => window.__modales.includes('cdlg'))), aLEntree = !!(await q.$('#authForm, [data-act="auth-local"]'));
  ok(parti && apaise && brouillonGarde && sansGarde && aLEntree, `réseau rétabli : l’indicateur s’efface, la capture part au serveur ; « Se déconnecter » avec le brouillon tapé : pas de confirmation, l’écran d’entrée (étape 4)${parti && apaise && brouillonGarde && sansGarde && aLEntree ? '' : ' — ' + JSON.stringify({ parti, apaise, brouillonGarde, sansGarde, aLEntree })}`);
  const reste = await q.evaluate(async () => {
    const ls = Object.keys(localStorage);
    const idb = await new Promise(res => { const r = indexedDB.open('selene'); r.onerror = () => res([]); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) { db.close(); return res([]); } const t = db.transaction('kv').objectStore('kv').getAllKeys(); t.onsuccess = () => { db.close(); res(t.result.map(String)); }; t.onerror = () => { db.close(); res([]); }; }; });
    return { ls, idb };
  });
  const interdit = k => k === 'selene-site-v1' || k.startsWith('selene-site-v1:') || k.startsWith('selene-draft:') || k === 'selene-chat' || k === 'selene-auth-session';
  ok(![...reste.ls, ...reste.idb].some(interdit), `l’appareil vidé : ni données, ni brouillon, ni conversation, ni session (reste : ${[...new Set([...reste.ls, ...reste.idb])].join(', ') || 'rien'}) (étape 5)`);
  if (!(await q.$('#authForm'))) { await q.click('[data-act="auth-open"] >> nth=0'); await q.waitForSelector('#authForm'); }
  await q.fill('#authEmail', 'a@b.c'); await q.fill('#authPw', 'une phrase assez longue'); await q.click('#authForm button[type="submit"]');
  await q.waitForFunction(() => !!document.querySelector('#nav > *') && !document.querySelector('#authForm'), null, { timeout: 10000 }).catch(() => {});
  await versQ('inbox', '#main'); await q.waitForFunction(() => document.querySelector('#main').textContent.includes('Recette CPT-013 avant départ'), null, { timeout: 10000 }).catch(() => {});
  const revenue = (await q.textContent('#main')).includes('Recette CPT-013 avant départ');
  await versQ('accueil', '#capIn'); const brouillon = await q.inputValue('#capIn');
  ok(revenue && brouillon === '', `reconnectée : la capture « Recette CPT-013 avant départ » est là ; le brouillon n’est pas revenu (« ${brouillon} ») (étape 6)`);
  await c13.close();

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
