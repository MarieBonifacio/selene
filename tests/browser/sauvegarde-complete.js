/* Scénario de navigateur : la sauvegarde complète, geste entier (BL-14 du cahier de recette ; DON-002 à DON-006). Deux
   appareils du même compte sur un faux Supabase partagé : importer remplace tout, partout, sans doublon ; renoncer au
   dernier moment ne change rien ; un fichier plus récent ou piégé est refusé, sans confirmation et en le disant. Puis,
   sans compte, une sauvegarde du format 1 migrée. Jeux de données synthétiques du cahier (docs/recette/donnees/).
   Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const path = require('node:path');
const { engine, BASE, launchOptions, check, until, ouvrir, entree, suivre, calme, storeJSON } = require('./helpers');
const jeu = nom => ({ name: nom, mimeType: 'application/json', buffer: fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'recette', 'donnees', nom)) });
const rows = new Map();
let ecritures = 0;
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname === '/rest/v1/activite') return route.fulfill({ status: 201, body: '' });
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  const stamp = (u.searchParams.get('select') || '').match(/^u:(\w+)->>updatedAt$/);
  if (m === 'GET' && stamp) return json(route, 200, row ? [{ u: row[stamp[1]] && row[stamp[1]].updatedAt != null ? String(row[stamp[1]].updatedAt) : null }] : []);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { ecritures++; for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') {
    ecritures++;
    if (!row) return json(route, 200, []);
    for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = row[c] && row[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(route, 200, []); }
    Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  }
  return json(route, 200, []);
}
const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } });
const serveur = () => (rows.get('u1') || {}).site || {};
const textes = site => JSON.stringify(site.modules || {});
async function appareil(b, errs, alertes, connecte = true) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('https://*.supabase.co/**', supabase);
  if (connecte) await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
  const p = suivre(await ctx.newPage()); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { alertes.push(d.message()); d.dismiss(); });
  await ouvrir(p, BASE + '/index.html' + (connecte ? '' : '#sans-compte'), entree);
  return p;
}
const reglages = async p => { await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('input[data-act="imp"]', { state: 'attached' }); };
const bulle = (p, texte) => p.waitForFunction(t => ((document.querySelector('#toast') || {}).textContent || '').includes(t), texte, { timeout: 10000 }).then(() => true, () => false);
const confirmation = p => p.waitForSelector('#cdlg[open]', { timeout: 5000 }).then(() => true, () => false);
// Le stockage relu jusqu'à ce qu'il dise ce qu'on attend (10 s au plus) : l'app y écrit en asynchrone, juste après la bulle.
async function relu(p, ok) {
  let d = null;
  for (const end = Date.now() + 10000; Date.now() < end; await p.waitForTimeout(100)) { d = await storeJSON(p, 'selene-site-v1'); if (ok(d)) break; }
  return d;
}
(async () => {
  const b = await engine.launch(launchOptions), errs = [], alertes = [];
  try {
    const A = await appareil(b, errs, alertes), B = await appareil(b, errs, alertes);
    await A.fill('#capIn', 'avant import DON-002'); await A.click('[data-act="cap-add"]');
    await until(() => textes(serveur()).includes('avant import DON-002'));

    console.log('importer : tout est remplacé, partout (DON-002)');
    await reglages(A);
    await A.setInputFiles('input[data-act="imp"]', jeu('jeu-essai.json'));
    check(await confirmation(A) && (await A.textContent('#cmsg')).includes("Remplacer tout l'état actuel par celui du fichier ?"), 'la confirmation demande de tout remplacer');
    await A.click('#cdlg button[value="ok"]');
    check(await bulle(A, 'Sauvegarde importée.'), '« Sauvegarde importée. »');
    const attendus = Object.keys(JSON.parse(jeu('jeu-essai.json').buffer.toString()).site.modules);
    const ici = await relu(A, d => attendus.every(id => Object.hasOwn(d.modules, id)));
    check(attendus.every(id => Object.hasOwn(ici.modules, id)) && !textes(ici).includes('avant import DON-002'), `l’appareil 1 : les ${attendus.length} espaces du jeu, la capture d’avant disparue`);
    await until(() => attendus.every(id => Object.hasOwn(serveur().modules || {}, id)) && !textes(serveur()).includes('avant import DON-002'));
    check(!textes(serveur()).includes('avant import DON-002') && attendus.every(id => Object.hasOwn(serveur().modules || {}, id)), 'le compte : le jeu, et lui seul');
    // L'autre appareil relit le serveur toutes les 30 s.
    let la = null;
    for (const end = Date.now() + 45000; Date.now() < end; await B.waitForTimeout(250)) { la = await storeJSON(B, 'selene-site-v1'); if (attendus.every(id => Object.hasOwn(la.modules, id)) && !textes(la).includes('avant import DON-002')) break; }
    const boites = Object.values(la.modules).filter(m => m.type === 'notes' && m.config && m.config.inbox).length;
    check(attendus.every(id => Object.hasOwn(la.modules, id)) && !textes(la).includes('avant import DON-002') && boites === 1
      && JSON.stringify(Object.keys(la.modules).sort()) === JSON.stringify(Object.keys(ici.modules).sort()), `l’appareil 2 : le même état, sans doublon (${boites} boîte)`);

    console.log('renoncer au dernier moment (DON-003)');
    const n = ecritures, avant = JSON.stringify((await storeJSON(A, 'selene-site-v1')).modules);
    await A.evaluate(() => { document.querySelector('#toast').textContent = ''; }); // la bulle garde son dernier texte, même cachée
    await A.setInputFiles('input[data-act="imp"]', jeu('ancien-format-1.json'));
    check(await confirmation(A), 'la confirmation s’affiche');
    await A.click('#cdlg button[value="cancel"]');
    await A.waitForTimeout(1500); // une absence ne s'attend pas : le temps qu'un enregistrement parte, s'il devait partir
    check(!(await A.textContent('#toast')).includes('Sauvegarde importée.'), 'aucun « Sauvegarde importée. »');
    check(JSON.stringify((await storeJSON(A, 'selene-site-v1')).modules) === avant && ecritures === n, 'rien ne change, rien ne part');

    console.log('refusés, sans confirmation (DON-004, DON-005)');
    await A.setInputFiles('input[data-act="imp"]', jeu('refus-version-future.json'));
    check(await bulle(A, "Sauvegarde créée par une version plus récente de Selene : mets l'application à jour d'abord.") && !(await A.$('#cdlg[open]')), 'un fichier plus récent : refusé, dit, sans confirmation');
    await A.setInputFiles('input[data-act="imp"]', jeu('refus-hostile.json'));
    check(await bulle(A, "Le contenu de cette sauvegarde n'est pas valide : le fichier est peut-être abîmé ou a été modifié. Rien n'a été importé.") && !(await A.$('#cdlg[open]')), 'un fichier piégé : refusé, dit, sans confirmation');
    check(JSON.stringify((await storeJSON(A, 'selene-site-v1')).modules) === avant && ecritures === n, 'le jeu d’essai est intact, rien n’est parti');
    check(!alertes.length, 'aucune boîte d’alerte ouverte par un texte piégé' + (alertes.length ? ` (${alertes.join(' | ')})` : ''));
    await calme(A); await ouvrir(A, null, entree); // DON-003, étape 3 : rechargé
    const relue = await storeJSON(A, 'selene-site-v1');
    check(JSON.stringify(relue.modules) === avant && attendus.every(id => Object.hasOwn(relue.modules, id)) && !(await A.textContent('#toast')).includes('Sauvegarde importée.'),
      `rechargé : toujours les ${attendus.length} espaces du jeu, rien d’importé`);

    console.log('sans compte, une sauvegarde du format 1 (DON-006)');
    const S = await appareil(b, errs, alertes, false);
    await reglages(S);
    await S.setInputFiles('input[data-act="imp"]', jeu('ancien-format-1.json'));
    check(await confirmation(S), 'la confirmation s’affiche');
    await S.click('#cdlg button[value="ok"]');
    check(await bulle(S, 'Sauvegarde importée.'), '« Sauvegarde importée. »');
    const vieux = await relu(S, d => textes(d).includes('Poser le velux')), t = textes(vieux);
    check(vieux.schemaVersion >= 8 && t.includes('Poser le velux') && t.includes('Mon livre') && t.includes('Une phrase qui passe') && t.includes('acheter des clous'),
      `migré au format ${vieux.schemaVersion} : la tâche, le livre, le fragment, la note sont là`);
    check(Object.values(vieux.modules).some(m => m.label === 'Aragne') || JSON.stringify(vieux.config.labels || {}).includes('Aragne'), 'un nom d’espace personnalisé gardé (« Aragne »)');
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
