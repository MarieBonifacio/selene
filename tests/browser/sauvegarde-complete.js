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
    // « Importer » comme le fait une personne : le sélecteur ouvert, la vue redessinée pendant le choix (une relève, un
    // retour sur la vue) ; le fichier choisi arrivait sur l'ancien champ, détaché, et l'import ne faisait rien (A61).
    const [choix] = await Promise.all([A.waitForEvent('filechooser'), A.click('label:has(input[data-act="imp"])')]);
    await A.evaluate(() => { location.hash = 'accueil'; }); await A.waitForSelector('#capIn');
    await A.evaluate(() => { location.hash = 'reglages'; }); await A.waitForSelector('input[data-act="imp"]', { state: 'attached' });
    const detache = await choix.element().evaluate(x => !x.isConnected);
    await choix.setFiles(jeu('ancien-format-1.json'));
    check(detache && await confirmation(A), 'la confirmation s’affiche, même la vue redessinée pendant le choix du fichier (A61)');
    await A.click('#cdlg button[value="cancel"]');
    await A.waitForTimeout(1500); // une absence ne s'attend pas : le temps qu'un enregistrement parte, s'il devait partir
    check(!(await A.textContent('#toast')).includes('Sauvegarde importée.'), 'aucun « Sauvegarde importée. »');
    check(JSON.stringify((await storeJSON(A, 'selene-site-v1')).modules) === avant && ecritures === n, 'rien ne change, rien ne part');

    console.log('refusés, sans confirmation (DON-004, DON-005)');
    await A.setInputFiles('input[data-act="imp"]', jeu('refus-version-future.json'));
    check(await bulle(A, "Sauvegarde créée par une version plus récente de Selene : mets l'application à jour d'abord.") && !(await A.$('#cdlg[open]')), 'un fichier plus récent : refusé, dit, sans confirmation');
    // DON-004, étape 2 : le jeu d'essai intact, et la note du fichier, « venue du futur », nulle part : ni dans les données, ni dans la boîte.
    const apresFutur = await storeJSON(A, 'selene-site-v1');
    await A.evaluate(() => { location.hash = 'inbox'; }); await A.waitForFunction(() => location.hash === '#inbox');
    const boiteFutur = await A.textContent('#main');
    check(JSON.stringify(apresFutur.modules) === avant && !JSON.stringify(apresFutur).includes('venue du futur') && boiteFutur.includes('Boîte') && !boiteFutur.includes('venue du futur'),
      'le jeu d’essai intact : aucune note « venue du futur », ni dans les données ni dans la boîte (DON-004, étape 2)');
    await A.evaluate(() => { location.hash = 'reglages'; }); await A.waitForSelector('input[data-act="imp"]', { state: 'attached' });
    await A.setInputFiles('input[data-act="imp"]', jeu('refus-hostile.json'));
    check(await bulle(A, "Le contenu de cette sauvegarde n'est pas valide : le fichier est peut-être abîmé ou a été modifié. Rien n'a été importé.") && !(await A.$('#cdlg[open]')), 'un fichier piégé : refusé, dit, sans confirmation');
    // DON-005, étape 2 : un fichier texte quelconque nommé photo.json, puis un JSON valide qui n'est pas une sauvegarde.
    await A.setInputFiles('input[data-act="imp"]', { name: 'photo.json', mimeType: 'application/json', buffer: Buffer.from('Ceci est une photo de vacances, pas une sauvegarde.') });
    const photo = await bulle(A, "Ce fichier ne se lit pas comme une sauvegarde : il est peut-être abîmé ou incomplet. Rien n'a été importé.") && !(await A.$('#cdlg[open]'));
    await A.setInputFiles('input[data-act="imp"]', { name: 'liste.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ courses: ['pain', 'lait'], date: '2026-10-07' })) });
    const sansFormat = await bulle(A, "Ce fichier n'est pas une sauvegarde Selene. Rien n'a été importé.") && !(await A.$('#cdlg[open]'));
    check(photo && sansFormat, '« photo.json » : « Ce fichier ne se lit pas comme une sauvegarde… » ; un JSON sans format : « Ce fichier n’est pas une sauvegarde Selene. » ; aucune confirmation (DON-005, étape 2)');
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
    // DON-006, étapes 2 à 8 : ce que montre chaque espace migré, puis l'assistant, puis l'aller-retour.
    const ecran = async (h, sel = '#main h2') => { await S.evaluate(x => { location.hash = x; }, h); await S.waitForSelector(sel, { state: 'attached' }); return (await S.textContent('#main')).replace(/\s+/g, ' '); };
    const velux = (vieux.modules.chantier.entries || []).find(e => e.title === 'Poser le velux') || {};
    const c2 = await ecran('chantier', '#main li.item');
    check(['Poser le velux', 'Chambre', '250 €', '1/1 étapes', 'Devis'].every(x => c2.includes(x)) && (velux.steps || []).some(st => st.t === 'Devis' && st.d),
      'Chantier : « Poser le velux », Chambre, 250 €, l’étape « Devis » cochée (1/1 étapes) (DON-006, étape 2)');
    const k3 = await ecran('kundalini'), e3 = await ecran('ecriture');
    check(vieux.modules.kundalini.config.start === '2025-01-06' && ['6 janv.', '20 min', 'Premier jour'].every(x => k3.includes(x))
      && ['Mon livre', '500 mots sur 40 000', 'Prologue', 'Une phrase qui passe'].every(x => e3.includes(x)),
      'Kundalini : commencé le 6 janvier 2025, une séance de 20 min « Premier jour » ; Écriture : « Mon livre », 500 mots sur 40 000, « Prologue », « Une phrase qui passe » (étape 3)');
    const a4 = await ecran('phidippus'), repas = (vieux.modules.phidippus.entries || []).find(e => (e.note || e.text || '').includes('Un grillon')) || {};
    check(a4.includes('Aragne') && a4.includes('Un grillon') && a4.includes('6 janv.') && repas.date === '2025-01-06', `les rappels s’appellent « Aragne » ; « Un grillon », un repas du 6 janvier 2025 (étape 4)`);
    const m5 = await ecran('moth'), u5 = await ecran('musique');
    const statut6 = t => ((vieux.modules.moth.entries || []).find(e => e.title === t) || {}).status;
    check(/Idée 1\s*Ancien statut/.test(m5) && /Prêt 1\s*Le lichen/.test(m5) && statut6('Ancien statut') === 'Idée' && statut6('Le lichen') === 'Prêt'
      && vieux.modules.musique.config.display === 'liste' && u5.includes('Dead Can Dance') && u5.includes('Aion') && ((vieux.modules.musique.entries || [])[0] || {}).status === 'Retenu',
      'october.moth en colonnes : « Le lichen » en « Prêt », « Ancien statut » en « Idée » ; Musique en liste : « Dead Can Dance », « Aion », « Retenu » (étape 5)');
    const i6 = await ecran('inbox');
    await ecran('budget', '[data-act="bud-month"][data-d="-1"]');
    for (let i = 0; i < 40 && !(await S.textContent('#main')).includes('janvier 2025'); i++) await S.click('[data-act="bud-month"][data-d="-1"]');
    const b6 = (await S.textContent('#main')).replace(/\s+/g, ' ');
    check(i6.includes('acheter des clous') && b6.includes('janvier 2025') && b6.includes('42,50 €') && /Courses.*300,00 €/.test(b6),
      'la Capture : « acheter des clous » ; le Budget de janvier 2025 : une dépense de 42,50 € dans Courses (300 €) (étape 6)');
    await reglages(S); await S.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    const allumer = S.locator('.set.mod:has(input[data-act="mod-label"][value="Assistant"]) [data-act="mod-on"]'); if (!(await allumer.isChecked())) await allumer.check();
    await S.waitForSelector('input[data-act="as-share"]', { state: 'attached' });
    const cases = await S.$$eval('input[data-act="as-share"]', xs => Object.fromEntries(xs.map(x => [x.dataset.k, x.checked])));
    check(cases.budget === false && ['chantier', 'kundalini', 'ecriture', 'phidippus', 'moth', 'musique', 'inbox'].every(k => cases[k] === true),
      `Réglages → Assistant → « Ce que Claude peut lire » : Budget décoché, les sept autres cochés (étape 7)`);
    const avant8 = await storeJSON(S, 'selene-site-v1');
    const [dl8] = await Promise.all([S.waitForEvent('download'), (async () => { await reglages(S); await S.click('[data-act="exp"]'); })()]);
    const f8 = await dl8.path();
    await S.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await reglages(S); await S.setInputFiles('input[data-act="imp"]', f8);
    if (await confirmation(S)) await S.click('#cdlg button[value="ok"]');
    const acceptee = await bulle(S, 'Sauvegarde importée.');
    const apres8 = await relu(S, d => (d.updatedAt || 0) !== (avant8.updatedAt || 0));
    const forme8 = d => JSON.stringify({ modules: d.modules, labels: d.config.labels, share: d.config.assistant.share, on: d.config.modules });
    check(acceptee && forme8(apres8) === forme8(avant8), 'exporté puis réimporté : « Sauvegarde importée. », et rien ne change, espace par espace (étape 8)');

    console.log('aller-retour vers un autre navigateur (DON-007)');
    // Deux navigateurs sans compte, sans rien en commun que le fichier. Le premier : le jeu d'essai, modifié à la main.
    const N1 = await appareil(b, errs, alertes, false), N2 = await appareil(b, errs, alertes, false);
    await reglages(N1); await N1.setInputFiles('input[data-act="imp"]', jeu('jeu-essai.json'));
    if (await confirmation(N1)) await N1.click('#cdlg button[value="ok"]');
    await bulle(N1, 'Sauvegarde importée.');
    await relu(N1, d => !!(d.modules && d.modules.yoga));
    const va = async (p, h, sel) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForSelector(sel); };
    // Un fragment de plus : la note n3 liée (« fait écho à » f1), rangée dans Écriture (sa provenance), puis son statut.
    await va(N1, 'inbox', 'li[data-id="n3"] [data-act="link-form"]');
    await N1.click('li[data-id="n3"] [data-act="link-form"]'); await N1.waitForFunction(() => document.querySelector('#dlg').open);
    await N1.selectOption('#form [name="type"]', 'echo'); await N1.selectOption('#form [name="to"]', 'ecriture/f1'); await N1.click('#form button[value="save"]');
    await bulle(N1, 'Lié');
    const avantN1 = (await storeJSON(N1, 'selene-site-v1')).modules.ecriture.scraps.map(x => x.id);
    await N1.click('li[data-id="n3"] [data-act="note-to"][data-to="ecriture"]');
    const d1a = await relu(N1, d => d.modules.ecriture.scraps.length > avantN1.length), ne = d1a.modules.ecriture.scraps.find(x => !avantN1.includes(x.id));
    await va(N1, 'ecriture', `li[data-id="${ne.id}"] select.ep`);
    await N1.selectOption(`li[data-id="${ne.id}"] select.ep`, 'int');
    await relu(N1, d => (d.modules.ecriture.scraps.find(x => x.id === ne.id) || {}).ep === 'int');
    // Un palier coché : le premier critère de « Souffle », dans Yoga.
    await va(N1, 'yoga', '#main .cal');
    await N1.check('#main li:has-text("12 séances à 20 min") input[type=checkbox]');
    const d1 = await relu(N1, d => d.modules.yoga.config.tiers[0].criteria[0].done === true);
    const [dl] = await Promise.all([N1.waitForEvent('download'), (async () => { await reglages(N1); await N1.click('[data-act="exp"]'); })()]);
    const fichier = await dl.path(), taille = fichier ? fs.statSync(fichier).size : 0;
    check(/\.json$/.test(dl.suggestedFilename()) && taille > 1000, `navigateur 1 : « exporter » donne un fichier (${dl.suggestedFilename()}, ${taille} octets) (étape 1)`);
    await reglages(N2); await N2.setInputFiles('input[data-act="imp"]', fichier);
    if (await confirmation(N2)) await N2.click('#cdlg button[value="ok"]');
    check(await bulle(N2, 'Sauvegarde importée.'), 'navigateur 2 : « Sauvegarde importée. » (étape 2)');
    const d2 = await relu(N2, d => !!(d.modules && d.modules.ecriture && d.modules.ecriture.scraps.some(x => x.id === ne.id)));
    // Espace par espace, ce qu'il contient : identique, à l'horodatage près.
    const sans = o => JSON.stringify(o, (k, v) => (k === 'updatedAt' ? undefined : v));
    const ecarts = Object.keys(d1.modules).filter(k => sans(d1.modules[k]) !== sans((d2.modules || {})[k]));
    const f2 = d2.modules.ecriture.scraps.find(x => x.id === ne.id) || {};
    await va(N2, 'ecriture', `li[data-id="${ne.id}"]`);
    const ligne = (await N2.textContent(`li[data-id="${ne.id}"]`)).replace(/\s+/g, ' ');
    const statut = await N2.$eval(`li[data-id="${ne.id}"] select.ep`, s => s.value);
    await va(N2, 'yoga', '#main .cal');
    const coche = await N2.$eval('#main li:has-text("12 séances à 20 min") input[type=checkbox]', c => c.checked);
    check(!ecarts.length && Object.keys(d2.modules).length === Object.keys(d1.modules).length && f2.ep === 'int' && f2.origin && statut === 'int'
      && ligne.includes("fait écho à « La lisière n'est pas une frontière") && ligne.includes('↳ de Boîte') && coche,
      `espace par espace, identiques${ecarts.length ? ' sauf ' + ecarts.join(', ') : ''} ; le fragment ajouté garde son statut, son lien et sa provenance ; le palier coché l’est encore (étape 3)`);
    const reglage = d => sans({ palette: d.config.palette, mode: d.config.mode, ordre: d.config.modules.map(m => [m.id, m.on, m.group || '', m.sigil || '']), partage: d.config.assistant && d.config.assistant.share });
    await reglages(N2);
    const palette = await N2.$eval('.swatches [data-act="pal"].on', x => x.dataset.p).catch(() => '');
    check(reglage(d2) === reglage(d1) && palette === d1.config.palette, `les Réglages : palette, domaines, ordre et partage avec l’assistant identiques (${d1.config.palette}) (étape 4)`);
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
