/* Scénario de navigateur : « Reprendre la main », gardé sur cet appareil seulement (ADR 27). Deux appareils du même
   compte sur un faux Supabase (interception réseau), comme sync-deux-appareils.js. On lit le serveur lui-même :
   - le compte personnel (marque selene_personnel) se voit proposer l'espace ; un compte ordinaire, non ;
   - à la configuration, aucun choix : sur l'appareil ; le serveur ne reçoit que le talon (nom, présence) ;
   - l'autre appareil voit le nom, pas le contenu ; le supprimer de là prévient qu'il ne retire que le nom ;
   - aucun bouton ne synchronise le suivi (un suivi encore synchronisé : tests/regulation.test.js) ;
   - se déconnecter avec un suivi gardé ici : la garde propose l'export ou l'effacement ; effacer vide l'appareil et retire
     aussi le talon du compte.
   Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const path = require('node:path');
const { engine, BASE, launchOptions, check, storeJSON, ouvrir, entree } = require('./helpers');
const rows = new Map();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname === '/rest/v1/activite') return route.fulfill({ status: 201, body: '' }); // la mesure d'usage (services/activite.js)
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') {
    if (!row) return json(route, 200, []);
    for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = row[c] && row[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(route, 200, []); }
    Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  }
}
const sessionFor = (personnel, id) => JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: 'a@b.c', ...(personnel ? { personnel: true } : {}) } });
const server = () => JSON.stringify((rows.get('u1') || {}).site || {});
async function device(browser, errs, personnel = true, id = 'u1') {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await ctx.route('https://*.supabase.co/**', supabase);
  await ctx.addInitScript(([s, id]) => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', id); } }, [sessionFor(personnel, id), id]);
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await ouvrir(page, BASE + '/index.html', entree); // connecté : l'app, pas l'écran d'entrée (A16)
  return { ctx, page };
}
(async () => {
  const browser = await engine.launch(launchOptions), errs = [];
  try {
    const A = await device(browser, errs), p = A.page;
    const settle = (q = p) => q.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const go = async (h, q = p) => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForFunction(x => location.hash === '#' + x, h); await settle(q); };
    const submit = async () => { await p.click('#form button[value="save"]'); await settle(); };
    const ask = async (ok, q = p) => { await q.waitForSelector('#cdlg[open]'); const msg = await q.textContent('#cmsg'); await q.click(`#cdlg button[value="${ok ? 'ok' : 'cancel'}"]`); await settle(q); return msg; };
    const waitServer = async test => { for (let i = 0; i < 60 && !test(server()); i++) await p.waitForTimeout(100); return test(server()); };

    console.log('hors de l’offre publique : proposé au seul compte personnel');
    const O = await device(browser, errs, false, 'u2'); // un autre compte : sa propre ligne sur le faux serveur
    check(!(await O.page.$('[data-tpl="regulation"]')), 'un compte ordinaire : l’espace n’est pas proposé à l’accueil');
    await go('reglages', O.page);
    check(!(await O.page.$('[data-tpl="regulation"]')) && !(await O.page.$('#newModType option[value="regulation"], #newModType option[value="tpl:regulation"]')), 'ni dans les Réglages');
    await O.ctx.close();

    console.log('configuration : sur cet appareil, sans question');
    // Les modèles de l'accueil sont repliés derrière « Choisir moi-même » (U3) : on déplie la liste.
    await p.waitForSelector('#welcome-all', { state: 'attached' }); await p.evaluate(() => { document.getElementById('welcome-all').open = true; });
    await p.waitForSelector('[data-tpl="regulation"]');
    await p.click('[data-tpl="regulation"]'); await go('reprendre-la-main');
    await p.click('[data-act="rlm-setup"]');
    check(!(await p.$('#form [name="storage"]')) && (await p.textContent('#form')).includes('Selene ne synchronise pas les suivis de santé'), 'aucun choix de stockage : sur cet appareil, dit d’emblée');
    await p.fill('#form [name="name"]', 'Carnet du soir'); await p.selectOption('#form [name="subject"]', 'alcool');
    await p.click('#form button[value="save"]');
    await p.waitForFunction(() => document.querySelector('#form h2').textContent === 'Mon intention');
    await p.selectOption('#form [name="mode"]', 'reduire'); await p.fill('#form [name="limit"]', '2'); await submit();
    await p.click('[data-act="rlm-use"]'); await p.fill('#form [name="value"]', '1.5'); await p.fill('#form [name="note"]', 'NOTE_PRIVEE'); await submit();
    check(await waitServer(s => s.includes('Carnet du soir')), 'le serveur connaît le nom (talon)');
    await p.waitForTimeout(1500);
    check(!/NOTE_PRIVEE|"subject":"alcool"|"mode":"reduire"/.test(server()), 'le serveur ne reçoit ni la note, ni le sujet, ni l’objectif');
    check((await storeJSON(p, 'selene-local-v1')).modules['reprendre-la-main'].entries.length === 1, 'le contenu est dans le stockage local de l’appareil');

    console.log('l’autre appareil : le nom seulement');
    const B = await device(browser, errs), q = B.page;
    await go('reprendre-la-main', q);
    await q.waitForFunction(() => document.querySelector('#main').textContent.includes('gardé sur un autre de tes appareils'), null, { timeout: 10000 }).catch(() => {});
    const tb = await q.textContent('#main');
    check(tb.includes('gardé sur un autre de tes appareils') && !/NOTE_PRIVEE|verre/.test(tb), 'B voit le nom, pas le contenu');
    await go('reglages', q); await q.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await q.locator('.set.mod:has(input[data-act="mod-label"][value="Carnet du soir"]) [data-act="mod-del"]').click();
    await q.waitForFunction(() => document.querySelector('#dlg').open);
    check((await q.textContent('#form')).includes('son nom reviendra'), 'B : supprimer prévient qu’il ne retire que le nom');
    await q.click('#form button[value="cancel"]'); await settle(q);

    console.log('aucun chemin vers le compte');
    await go('reprendre-la-main');
    await p.evaluate(() => { document.querySelector('.rlm-privacy').open = true; });
    check(!(await p.$('[data-act="rlm-account"]')) && !(await p.$('[data-act="rlm-device"]')), 'gardé ici : ni « synchroniser », ni bouton de stockage');
    await p.waitForTimeout(1200);
    check(!server().includes('NOTE_PRIVEE'), 'le contenu n’est jamais parti au serveur');
    check((await p.textContent('#main')).includes('1,5 verre standard'), 'tout est sur l’appareil');

    console.log('téléphone : nouveaux écrans sans débordement');
    const overflow = x => x.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    for (const x of [p, q]) await x.setViewportSize({ width: 390, height: 844 });
    await go('reprendre-la-main'); await p.evaluate(() => { document.querySelector('.rlm-privacy').open = true; });
    check(!(await overflow(p)), 'détenteur : section confidentialité');
    await go('reprendre-la-main', q);
    check(!(await overflow(q)), 'autre appareil : la vue du talon');
    if (process.env.SHOTS) { await p.screenshot({ path: `${process.env.SHOTS}/appareil-detenteur.png`, fullPage: true }); await q.screenshot({ path: `${process.env.SHOTS}/appareil-autre.png`, fullPage: true }); }
    for (const x of [p, q]) await x.setViewportSize({ width: 1280, height: 900 });

    console.log('déconnexion : la garde');
    await go('reglages'); await p.click('[data-act="auth-out"]');
    await p.waitForFunction(() => document.querySelector('#dlg').open && document.querySelector('#form h2').textContent === 'Avant de te déconnecter');
    check((await p.textContent('#form')).includes('Carnet du soir'), 'la garde nomme ce qui n’existe qu’ici');
    check(!(await p.$('#form [name="what"] option[value="sync"]')) && !!(await p.$('#form [name="what"] option[value="export"]')), 'partir : l’export ou l’effacement, plus de synchronisation');
    await p.click('#form button[value="cancel"]'); await settle(); await p.waitForTimeout(300);
    check(!!(await p.$('[data-act="auth-out"]')), 'annuler : toujours connectée, rien d’effacé');
    await p.click('[data-act="auth-out"]'); await p.waitForFunction(() => document.querySelector('#dlg').open);
    await p.selectOption('#form [name="what"]', 'erase'); await submit();
    check((await ask(true)).includes('aucune autre copie'), 'effacer : une dernière confirmation');
    await p.waitForSelector('#authForm');
    check((await storeJSON(p, 'selene-local-v1').catch(() => null))?.modules?.['reprendre-la-main'] == null, 'déconnectée : plus rien du suivi sur l’appareil');
    check(!!JSON.parse(server()).modules && JSON.parse(server()).modules['reprendre-la-main'] === undefined && !server().includes('Carnet du soir'), 'effacé : le nom du suivi a aussi quitté le compte (plus de talon)');

    console.log('chemin S : « Carnet du soir » importé (RLM-006, RLM-013)');
    // Un navigateur sans compte, le jeu rlm-en-cours.json importé : un suivi d'alcool commencé le 1er septembre 2026.
    const cs = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const S = await cs.newPage(); S.on('pageerror', e => errs.push(e.message));
    await ouvrir(S, BASE + '/index.html#sans-compte', entree);
    const vers = async (h, sel) => { await S.evaluate(x => { location.hash = x; }, h); await S.waitForSelector(sel, { state: 'attached' }); };
    const bulleS = t => S.waitForFunction(x => ((document.querySelector('#toast') || {}).textContent || '').includes(x), t, { timeout: 5000 }).then(() => true, () => false);
    await vers('reglages', 'input[data-act="imp"]');
    await S.setInputFiles('input[data-act="imp"]', path.join(__dirname, '..', '..', 'docs', 'recette', 'donnees', 'rlm-en-cours.json'));
    await S.waitForSelector('#cdlg[open]', { timeout: 5000 }).catch(() => {}); if (await S.$('#cdlg[open]')) await S.click('#cdlg button[value="ok"]');
    await bulleS('Sauvegarde importée.');
    const cid = await S.evaluate(() => { const a = [...document.querySelectorAll('#nav a')].find(x => x.textContent.includes('Carnet du soir')); return a ? a.getAttribute('href').slice(1) : ''; });
    await vers(cid, '[data-act="rlm-goal"]');
    check(!(await S.$('[data-act="rlm-setup"]')) && !(await S.textContent('#main')).includes('Commencer : choisir ce que je veux suivre'), 'le suivi commencé n’offre plus « Commencer : choisir ce que je veux suivre » (RLM-006, étape 3)');
    await S.click('[data-act="rlm-goal"]'); await S.waitForFunction(() => document.querySelector('#dlg').open);
    const champs = await S.$$eval('#form label', ls => ls.map(l => (l.firstChild && l.firstChild.textContent || l.textContent).replace(/\s+/g, ' ').trim()));
    const sujet = !!(await S.$('#form [name="subject"]'));
    check(champs.some(x => x.startsWith('Intention')) && champs.some(x => x.startsWith('Limite quotidienne pour réduire (verres standard)')) && champs.some(x => x.startsWith('À partir du')) && !sujet,
      `« Faire évoluer mon objectif » : Intention, Limite quotidienne pour réduire (verres standard), À partir du ; aucun champ de sujet (${champs.join(' | ').slice(0, 160)}) (RLM-006, étape 1)`);
    await S.click('#form button[value="cancel"]'); await S.waitForFunction(() => !document.querySelector('#dlg').open);
    await vers('reglages', `#mreg-${cid}`); await S.evaluate(x => { document.querySelector(`#mreg-${x}`).open = true; }, cid);
    const reglage = (await S.textContent(`#mreg-${cid}`)).replace(/\s+/g, ' ');
    check(reglage.includes('Appuis et récompenses') && reglage.includes('Ouvrir le suivi') && !(await S.$(`#mreg-${cid} [name="subject"], #mreg-${cid} [data-set-mod="${cid}.subject"], #mreg-${cid} [data-set-mod="${cid}.unit"]`)),
      'ses réglages : « Appuis et récompenses », « Ouvrir le suivi » ; aucun réglage de sujet ni d’unité (RLM-006, étape 2)');

    const ligne = async id => (await S.$eval(`#main li.item[data-id="${id}"]`, l => l.textContent.replace(/\s+/g, ' ').trim()).catch(() => ''));
    const bulle2 = async () => (await S.textContent('#toast')).replace(/\s+/g, ' ').trim();
    const viderBulle = () => S.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await vers(cid, '#main li.item[data-id="u2"]');
    await viderBulle(); await S.$eval('#main li.item[data-id="u2"] [data-act="rlm-del"]', x => x.click()); // « suppr. » : caché au repos sur un écran tactile
    await bulleS('Supprimé');
    const dit1 = await bulle2(), annulable = !!(await S.$('#toast [data-act="undo"]')), jour10 = await ligne('day-2026-09-10');
    check(dit1.startsWith('Supprimé : 1 verre standard le 10 septembre 2026. Cette journée est à reconfirmer.') && annulable && jour10.includes('Confirmation à refaire : la journée a changé depuis'),
      `« suppr. » sur 1 verre standard du 10 : « ${dit1.slice(0, 90)} », avec « Annuler » ; le 10 : « Confirmation à refaire… » (RLM-013, étape 1)`);
    await S.click('#toast [data-act="undo"]'); await bulleS('Rétabli');
    await S.waitForSelector('#main li.item[data-id="u2"]', { timeout: 5000 }).catch(() => {});
    check((await bulle2()).startsWith('Rétabli. Rien ne s\'est passé.') && !!(await ligne('u2')) && (await ligne('day-2026-09-10')).includes('Journée confirmée'), '« Annuler » : « Rétabli. Rien ne s’est passé. », la saisie revient, le 10 redevient « Journée confirmée » (RLM-013, étape 2)');
    await viderBulle(); await S.$eval('#main li.item[data-id="day-2026-09-11"] [data-act="rlm-del"]', x => x.click());
    await bulleS('redevient inconnue');
    await S.waitForFunction(() => !document.querySelector('#main li.item[data-id="day-2026-09-11"]'), null, { timeout: 5000 }).catch(() => {});
    check((await bulle2()).startsWith('La journée du 11 sept. redevient inconnue.') && !!(await S.$('#toast [data-act="undo"]')) && !(await ligne('day-2026-09-11')), '« laisser inconnue » sur le 11 : « La journée du 11 sept. redevient inconnue. », avec « Annuler » ; la ligne disparaît (RLM-013, étape 3)');
    const dits = [];
    for (const [id, attendu] of [['e1', 'Envie du 11 sept. supprimée.'], ['a1', 'Action du 11 sept. supprimée.']]) {
      await viderBulle(); await S.$eval(`#main li.item[data-id="${id}"] [data-act="rlm-del"]`, x => x.click()); await bulleS(attendu.slice(0, 12));
      dits.push((await bulle2()).startsWith(attendu) && !(await ligne(id)));
    }
    check(dits.length === 2 && dits.every(Boolean), '« suppr. » sur l’envie puis l’action du 11 : « Envie du 11 sept. supprimée. », puis « Action du 11 sept. supprimée. » (RLM-013, étape 4)');

    console.log('chemin S : exporter ce suivi, la sauvegarde complète le contient (RLM-025)');
    const jeuRlm = path.join(__dirname, '..', '..', 'docs', 'recette', 'donnees', 'rlm-en-cours.json');
    const importer = async fichier => { await vers('reglages', 'input[data-act="imp"]'); await viderBulle(); await S.setInputFiles('input[data-act="imp"]', fichier); };
    await importer(jeuRlm); // le jeu de nouveau tel quel : les suppressions de RLM-013 sont défaites
    await S.waitForSelector('#cdlg[open]', { timeout: 5000 }).catch(() => {}); if (await S.$('#cdlg[open]')) await S.click('#cdlg button[value="ok"]');
    await bulleS('Sauvegarde importée.');
    const suivi = async () => ((await storeJSON(S, 'selene-local-v1')) || { modules: {} }).modules[cid];
    await vers(cid, `#rlmPriv-${cid}`); await S.evaluate(x => { document.querySelector(`#rlmPriv-${x}`).open = true; }, cid);
    await S.click(`#rlmPriv-${cid} [data-act="rlm-export"]`); await S.waitForSelector('#cdlg[open]');
    const demandeExport = (await S.textContent('#cmsg')).trim();
    check(demandeExport === 'Exporter ce suivi dans un fichier lisible, non chiffré ? Il contient tout le journal, notes comprises.', `« Exporter ce suivi » : « ${demandeExport} » (étape 1)`);
    const [dlSuivi] = await Promise.all([S.waitForEvent('download'), S.click('#cdlg button[value="ok"]')]);
    const fSuivi = await dlSuivi.path(), jSuivi = JSON.parse(fs.readFileSync(fSuivi, 'utf8')), jour = await S.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    check(dlSuivi.suggestedFilename() === `selene-suivi-${jour}.json` && jSuivi.format === 'selene-regulation-v1' && jSuivi.about.includes('Restauration : par la sauvegarde complète de Selene.') && jSuivi.module.label === 'Carnet du soir'
      && jSuivi.module.config.subject === 'alcool' && jSuivi.module.goals.length === 2 && jSuivi.module.entries.length === 7 && JSON.stringify(jSuivi).includes('Repas de famille'),
      `${dlSuivi.suggestedFilename()} : selene-regulation-v1, « Restauration : par la sauvegarde complète… », Carnet du soir, alcool, 2 objectifs, 7 entrées, « Repas de famille » (étape 2)`);
    await vers('reglages', '[data-act="exp"]');
    const [dlTout] = await Promise.all([S.waitForEvent('download'), S.click('[data-act="exp"]')]);
    const fTout = await dlTout.path(), jTout = JSON.parse(fs.readFileSync(fTout, 'utf8')), dans = ((jTout.site || {}).modules || {})[cid] || {};
    check(dlTout.suggestedFilename() === `selene-${jour}.json` && (dans.entries || []).length === 7 && JSON.stringify(dans).includes('Repas de famille'),
      `la sauvegarde complète ${dlTout.suggestedFilename()} : le suivi, ses 7 entrées et « Repas de famille » (étape 3)`);
    const avantImport = JSON.stringify(await suivi());
    await importer(fSuivi); await bulleS('Rien n\'a été importé'); await S.waitForTimeout(600); // une absence : la boîte de remplacement ne doit pas venir
    check((await bulle2()).startsWith('Ce fichier n\'est pas une sauvegarde Selene. Rien n\'a été importé.') && !(await S.$('#cdlg[open]')) && JSON.stringify(await suivi()) === avantImport,
      'l’export du suivi importé : « Ce fichier n’est pas une sauvegarde Selene. Rien n’a été importé. », sans boîte « Remplacer tout l’état… », rien ne change (étape 4)');
    await importer(fTout);
    await S.waitForSelector('#cdlg[open]', { timeout: 5000 }).catch(() => {}); if (await S.$('#cdlg[open]')) await S.click('#cdlg button[value="ok"]');
    const importee = await bulleS('Sauvegarde importée.');
    const sans = o => JSON.stringify(o, (k, v) => (k === 'updatedAt' ? undefined : v));
    check(importee && sans((await suivi()) || {}).length > 100 && sans(await suivi()) === sans(JSON.parse(avantImport)), 'la sauvegarde complète importée : « Sauvegarde importée. », le suivi identique (étape 5)');

    console.log('chemin S : dates à venir refusées, le fuseau ne reclasse rien (RLM-015)');
    // L'horloge figée le 7 octobre 2026 à 20 h à Paris : à Auckland, c'est déjà le 8 à 7 h, quel que soit l'horaire de la CI.
    const INSTANT = new Date('2026-10-07T20:00:00+02:00'), J = '2026-10-07', J1 = '2026-10-08', Jm1 = '2026-10-06';
    const cz = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Europe/Paris' });
    const Z = await cz.newPage(); Z.on('pageerror', e => errs.push(e.message)); await Z.clock.setFixedTime(INSTANT);
    await ouvrir(Z, BASE + '/index.html#sans-compte', entree);
    const versZ = async (h, sel) => { await Z.evaluate(x => { location.hash = x; }, h); await Z.waitForSelector(sel, { state: 'attached' }); };
    const bulleZ = t => Z.waitForFunction(x => ((document.querySelector('#toast') || {}).textContent || '').includes(x), t, { timeout: 5000 }).then(() => true, () => false);
    await versZ('reglages', 'input[data-act="imp"]');
    await Z.setInputFiles('input[data-act="imp"]', path.join(__dirname, '..', '..', 'docs', 'recette', 'donnees', 'rlm-a-configurer.json'));
    await Z.waitForSelector('#cdlg[open]', { timeout: 5000 }).catch(() => {}); if (await Z.$('#cdlg[open]')) await Z.click('#cdlg button[value="ok"]');
    await bulleZ('Sauvegarde importée.');
    const zid = await Z.evaluate(() => { const a = [...document.querySelectorAll('#nav a')].find(x => x.textContent.includes('Carnet du soir')); return a ? a.getAttribute('href').slice(1) : ''; });
    // Le contenu du suivi, là où il vit : dans le document local s'il est « gardé sur cet appareil », sinon dans le site
    // (sans compte, ce jeu-ci ne porte pas de stockage : son contenu reste dans le site, qui ne part nulle part).
    const local = async q => {
      const st = ((await storeJSON(q, 'selene-site-v1')) || { modules: {} }).modules[zid] || { config: {}, entries: [] };
      return st.config && st.config.storage === 'device' ? (((await storeJSON(q, 'selene-local-v1')) || { modules: {} }).modules[zid] || { entries: [] }) : st;
    };
    // Configurer : « Alcool », « Observer, sans cible », à partir de J-1.
    await versZ(zid, '[data-act="rlm-setup"]'); await Z.click('[data-act="rlm-setup"]'); await Z.waitForFunction(() => document.querySelector('#dlg').open);
    await Z.selectOption('#form [name="subject"]', 'alcool'); await Z.click('#form button[value="save"]');
    await Z.waitForFunction(() => document.querySelector('#dlg').open && document.querySelector('#form h2').textContent === 'Mon intention');
    await Z.selectOption('#form [name="mode"]', 'observer'); await Z.fill('#form [name="date"]', Jm1); await Z.click('#form button[value="save"]');
    await Z.waitForFunction(() => !document.querySelector('#dlg').open); await Z.waitForSelector('[data-act="rlm-use"]');
    // Fermer un formulaire refusé : sous Firefox, la bulle de validation avale le premier geste (Échap, plusieurs fois).
    // Chaque Échap attend la fermeture avant le suivant : sous WebKit, la boîte paraît ouverte un instant de plus.
    const fermer = async () => {
      for (let i = 0; i < 4 && await Z.evaluate(() => document.querySelector('#dlg').open); i++) {
        await Z.keyboard.press('Escape'); await Z.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 1000 }).catch(() => {});
      }
    };
    const refuses = [];
    for (const act of ['rlm-use', 'rlm-urge', 'rlm-action', 'rlm-day-other']) {
      const n0 = (await local(Z)).entries.length;
      await Z.click(`[data-act="${act}"]`); await Z.waitForFunction(() => document.querySelector('#dlg').open);
      if (act === 'rlm-use') await Z.fill('#form [name="value"]', '1');
      await Z.fill('#form [name="date"]', J1); await Z.click('#form button[value="save"]'); await Z.waitForTimeout(400);
      const ouvert = await Z.evaluate(() => document.querySelector('#dlg').open), max = await Z.getAttribute('#form [name="date"]', 'max');
      await fermer();
      refuses.push(`${act}:${ouvert && max === J && (await local(Z)).entries.length === n0}`);
    }
    check(refuses.every(x => x.endsWith(':true')), `J+1 dans « Noter », « J'ai une envie », « J'ai réalisé une action », « Confirmer une autre journée… » : refusé, rien d’enregistré (${refuses.join(', ')}) (étape 1)`);
    // Revenir à l'espace, toute boîte fermée, et dire où l'on était : sous WebKit, le bouton « Faire évoluer mon objectif »
    // n'était plus là après ces refus (run 37587724950), sans que rien ne dise pourquoi.
    if (await Z.$('#cdlg[open]')) await Z.click('#cdlg button[value="cancel"]');
    await fermer();
    const ou = await Z.evaluate(() => `${location.hash} ; boîte ${document.querySelector('#dlg').open ? 'ouverte' : 'fermée'} ; confirmation ${document.querySelector('#cdlg').open ? 'ouverte' : 'fermée'} ; bouton ${document.querySelector('[data-act="rlm-goal"]') ? 'présent' : 'absent'}`);
    await versZ(zid, '[data-act="rlm-goal"]');
    const longue = d => Z.evaluate(x => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(new Date(x + 'T12:00')).map(p => p.type === 'day' && p.value === '1' ? '1er' : p.value).join(''), d);
    await Z.click('[data-act="rlm-goal"]'); await Z.waitForFunction(() => document.querySelector('#dlg').open);
    // La configuration a déjà dit « Objectif enregistré. … » : vider la bulle, sans quoi l'attente pourrait relire l'ancienne.
    await Z.selectOption('#form [name="mode"]', 'arreter'); await Z.fill('#form [name="date"]', J1);
    await Z.evaluate(() => { document.querySelector('#toast').textContent = ''; }); await Z.click('#form button[value="save"]');
    await bulleZ('Objectif enregistré');
    const ditObjectif = (await Z.textContent('#toast')).replace(/\s+/g, ' ').trim();
    check(ditObjectif === `Objectif enregistré, à partir du ${await longue(J1)}. D'ici là, rien ne change.`, `un objectif « Viser l'arrêt » à partir de J+1 : « ${ditObjectif} » (étape 2 ; après les refus : ${ou})`);
    await Z.click('[data-act="rlm-use"]'); await Z.waitForFunction(() => document.querySelector('#dlg').open);
    await Z.fill('#form [name="value"]', '1'); await Z.click('#form button[value="save"]'); await Z.waitForFunction(() => !document.querySelector('#dlg').open);
    let note = null; // l'écriture vers IndexedDB suit la fermeture du formulaire : l'attendre
    for (let i = 0; i < 100 && !note; i++) { note = (await local(Z)).entries.find(e => e.kind === 'use'); if (!note) await Z.waitForTimeout(50); }
    const jdate = async q => q.$eval(`#main li.item[data-id="${note.id}"] .jdate`, x => x.textContent.trim()).catch(() => '');
    check(!!note && note.date === J && (await jdate(Z)) === '7 oct.', `à Paris : 1 verre standard noté à J, au journal le « ${note ? await jdate(Z) : '?'} » (étape 3)`);
    const etat = await cz.storageState({ indexedDB: true });
    const ca = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Pacific/Auckland', storageState: etat });
    const NZ = await ca.newPage(); NZ.on('pageerror', e => errs.push(e.message)); await NZ.clock.setFixedTime(INSTANT);
    await ouvrir(NZ, BASE + '/index.html#' + zid, entree); await NZ.waitForSelector(`#main li.item[data-id="${note.id}"]`, { timeout: 10000 }).catch(() => {});
    const auckland = ((await local(NZ)).entries.find(e => e.id === note.id) || {}).date, dateline = await NZ.textContent('#dateline');
    check(auckland === J && (await jdate(NZ)) === '7 oct.' && dateline.includes('8 octobre'), `rouvert à Auckland, où l’on est le 8 : la saisie reste du 7 (« ${await jdate(NZ)} ») (étape 4)`);
    await ca.close();
    await versZ(zid, `#rlmPriv-${zid}`); await Z.evaluate(x => { document.querySelector(`#rlmPriv-${x}`).open = true; }, zid);
    await Z.click(`#rlmPriv-${zid} [data-act="rlm-export"]`); await Z.waitForSelector('#cdlg[open]');
    const [dlZ] = await Promise.all([Z.waitForEvent('download'), Z.click('#cdlg button[value="ok"]')]);
    const exportee = JSON.parse(fs.readFileSync(await dlZ.path(), 'utf8')).module.entries.find(e => e.id === note.id) || {};
    check(exportee.date === J && exportee.zone === 'Europe/Paris', `exportée : "date": "${exportee.date}", "zone": "${exportee.zone}" (étape 5)`);
    await cz.close();

    // Un chemin S neuf, rlm-a-configurer.json configuré : l'horloge figée à 20 h à Paris, J le 7 octobre 2026.
    const jj = n => { const d = new Date(Date.UTC(2026, 9, 7 + n, 12)); return d.toISOString().slice(0, 10); };
    async function cheminS({ mode, limit, depuis }) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Europe/Paris' });
      const q = await c.newPage(); q.on('pageerror', e => errs.push(e.message)); await q.clock.setFixedTime(INSTANT);
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
      await q.selectOption('#form [name="subject"]', 'alcool'); await q.click('#form button[value="save"]');
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
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await browser.close(); }
})();
