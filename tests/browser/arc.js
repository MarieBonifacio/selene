/* Scénario de navigateur : arcs (étapes, placement d'éléments d'autres modules). Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
const demo = JSON.parse(fixture());
demo.modules.ecriture.scraps = [{ id: 'f1', text: 'Le seuil comme allégorie de la mue', date: '2026-09-01' }];
(async () => {
  const b = await chromium.launch(launchOptions);
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
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
