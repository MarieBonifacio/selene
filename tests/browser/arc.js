/* Scénario de navigateur : arcs (étapes, placement d'éléments d'autres modules). Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { engine, BASE, launchOptions, fixture, donnee, ouvrir, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
const demo = JSON.parse(fixture());
demo.modules.ecriture.scraps = [{ id: 'f1', text: 'Le seuil comme allégorie de la mue', date: '2026-09-01' }];
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));

  console.log('créer, placer');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:arc'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  check((await data()).modules.arc.config.stations.length === 3, 'trois étapes de départ');
  await go('arc'); let t = await main();
  check(/Étape 1 0.*Vide\..*Étape 2 0.*Vide\..*Étape 3 0.*Vide\./s.test(t), 'trois étapes vides, visibles (pas cachées)');
  await p.click('[data-act="arc-place"]'); await p.waitForTimeout(150);
  await p.selectOption('#form [name=station]', (await data()).modules.arc.config.stations[0].id);
  await p.selectOption('#form [name=ref]', 'ecriture/f1');
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  t = await main();
  check(/Étape 1 1.*Le seuil comme allégorie/s.test(t), 'l’élément placé apparaît sous sa station');
  check(/Étape 2 0.*Vide\./s.test(t), 'les autres étapes restent vides, visiblement');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/arc.png`, fullPage: true });

  console.log('renommer, retirer');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.fill('#mreg-arc [data-act="stat-name"]', 'Maquette'); await p.press('#mreg-arc [data-act="stat-name"]', 'Tab'); await p.waitForTimeout(150);
  await go('arc');
  check((await main()).includes('Maquette'), 'étape renommée, reflétée dans la vue');
  await p.click('.card [data-act="arc-remove"]'); await p.waitForTimeout(150);
  check((await data()).modules.arc.entries.length === 0, 'placement retiré');
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(150);
  check((await data()).modules.arc.entries.length === 1, '« Annuler » le remet');

  console.log('supprimer une étape (confirmation)');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.click('#mreg-arc [data-act="stat-del"]'); await p.waitForTimeout(150);
  check(await p.isVisible('#cdlg'), 'confirmation avant suppression, vu que ça retire aussi ses placements');
  await p.click('#cdlg button[value=cancel]'); await p.waitForTimeout(150);
  check((await data()).modules.arc.config.stations.length === 3, 'annulée : rien ne change');
  await p.click('#mreg-arc [data-act="stat-del"]'); await p.waitForTimeout(150);
  await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(150);
  const arc = (await data()).modules.arc;
  check(arc.config.stations.length === 2 && arc.entries.length === 0, 'étape et son placement supprimés ensemble');

  console.log('cible supprimée, accueil');
  // L'étape supprimée a emporté son placement ; on en repose un sur ce qui reste, pour ensuite faire
  // disparaître sa cible.
  await go('arc'); await p.click('[data-act="arc-place"]'); await p.waitForTimeout(150);
  await p.selectOption('#form [name=station]', (await data()).modules.arc.config.stations[0].id);
  await p.selectOption('#form [name=ref]', 'ecriture/f1');
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('selene-site-v1')); d.modules.ecriture.scraps = []; localStorage.setItem('selene-site-v1', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(300); await go('arc'); // relire depuis le stockage, pas la mémoire de l'app déjà chargée
  check((await main()).includes('(supprimé)'), 'une cible supprimée ailleurs se dit, sans planter la vue');
  await go('accueil');
  check((await main()).includes('1 élément sur 2 étapes, 1 vide'), 'résumé sur l’accueil (même une cible disparue reste « placée »)');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');

  console.log('le jeu d’essai : placer, retirer, supprimer une étape (MOD-021)');
  const q = await b.newPage({ viewport: { width: 1280, height: 900 } }); q.on('pageerror', e => errs.push(e.message));
  const essai = donnee('jeu-essai.json');
  await q.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const donneesQ = () => q.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const versQ = async (h, sel) => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForSelector(sel, { state: 'attached' }); };
  await ouvrir(q, BASE + '/index.html#arc', () => !!document.querySelector('[data-act="arc-place"]'));
  // Chaque étape : son nom, son compte, ce qu'elle porte (ou « Vide. »).
  const etapes = () => q.evaluate(() => [...document.querySelectorAll('#main .board .col')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  const e1 = await etapes();
  check(e1.length === 3 && /^Étape 1 1(?!\d).*La lisière n'est pas une frontière/.test(e1[0]) && /^Étape 2 0 ?Vide\.$/.test(e1[1]) && /^Étape 3 0 ?Vide\.$/.test(e1[2]), `trois colonnes : ${e1.map(t => '« ' + t.slice(0, 40) + ' »').join(', ')} (MOD-021, étape 1)`);
  await q.click('[data-act="arc-place"]'); await q.waitForFunction(() => document.querySelector('#dlg').open);
  await q.selectOption('#form [name=station]', '2'); await q.selectOption('#form [name=ref]', 'tableau/k3'); await q.click('#form button[value=save]');
  await q.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.arc.entries.some(e => e.ref === 'tableau/k3'), null, { timeout: 5000 }).catch(() => {});
  const e2 = await etapes();
  check(/^Étape 2 1(?!\d).*Brume sur l'étang/.test(e2[1] || ''), `« Brume sur l'étang » placé à l'Étape 2 : « ${(e2[1] || '').slice(0, 60)} » (MOD-021, étape 2)`);
  await q.evaluate(() => { document.querySelector('#toast').textContent = ''; });
  await q.evaluate(() => { const c = [...document.querySelectorAll('#main .board .card')].find(x => x.textContent.includes('Brume sur l')); c.querySelector('[data-act="arc-remove"]').click(); });
  await q.waitForFunction(() => !JSON.parse(localStorage.getItem('selene-site-v1')).modules.arc.entries.some(e => e.ref === 'tableau/k3'), null, { timeout: 5000 }).catch(() => {});
  const retire = !(await etapes())[1].includes('Brume'); await q.click('#toast [data-act="undo"]');
  await q.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.arc.entries.some(e => e.ref === 'tableau/k3'), null, { timeout: 5000 }).catch(() => {});
  check(retire && (await etapes())[1].includes('Brume sur l\'étang'), '« retirer » sur ce placement : retiré ; « Annuler » : remis (MOD-021, étape 3)');
  const supprimer = async ok => {
    await versQ('reglages', '#mreg-arc [data-act="stat-del"]'); await q.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await q.evaluate(() => { const i = [...document.querySelectorAll('#mreg-arc [data-act="stat-name"]')].find(x => x.value === 'Étape 2'); i.closest('.set').querySelector('[data-act="stat-del"]').click(); });
    await q.waitForSelector('#cdlg[open]'); const m = (await q.textContent('#cmsg')).trim(); await q.click(`#cdlg button[value=${ok ? 'ok' : 'cancel'}]`); await q.waitForFunction(() => !document.querySelector('#cdlg').open); return m;
  };
  const dit4 = await supprimer(false), arc4 = (await donneesQ()).modules.arc;
  check(dit4 === 'Supprimer l\'étape « Étape 2 » ? 1 placement sera retiré.' && arc4.config.stations.length === 3 && arc4.entries.length === 2, `supprimer l'Étape 2 : « ${dit4} » ; « Annuler » : rien ne change (MOD-021, étape 4)`);
  await supprimer(true);
  await q.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.arc.config.stations.length === 2, null, { timeout: 5000 }).catch(() => {});
  const fin = await donneesQ();
  await versQ('arc', '#main .board .col'); const e5 = await etapes();
  await versQ('tableau', '#main'); const tableau = (await q.textContent('#main')).includes('Brume sur l\'étang');
  check(fin.modules.arc.config.stations.length === 2 && !fin.modules.arc.entries.some(e => e.ref === 'tableau/k3') && e5.length === 2 && !e5.some(t => t.startsWith('Étape 2'))
    && fin.modules.tableau.entries.some(e => e.id === 'k3') && tableau, `confirmé : l'étape et son placement disparaissent (${e5.map(t => t.split(' ').slice(0, 2).join(' ')).join(', ')}) ; « Brume sur l'étang » reste dans Tableau (MOD-021, étape 5)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
