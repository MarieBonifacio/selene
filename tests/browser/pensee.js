/* Scénario de navigateur : statut épistémique, provenance, pont de reprise, décisions. Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose des captures d'écran (téléphone), pour relire l'affichage à l'œil. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
(async () => {
  const b = await chromium.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(l => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', l); }, fixture());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); };

  console.log('statut épistémique');
  await p.fill('#capIn', '? le seuil précède le récit'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(200);
  let n = (await data()).modules.inbox.entries.at(-1);
  check(n.text === 'le seuil précède le récit' && n.ep === 'hyp', '« ? » devant une capture : une hypothèse, le « ? » retiré');
  check((await p.textContent('#toast')).includes('hypothèse'), 'le message le dit');

  console.log('provenance');
  await p.fill('#capIn', 'Écriture : une phrase née ailleurs'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(200);
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(200); // « Ranger »
  let f = (await data()).modules.ecriture.scraps.at(-1);
  check(f.text === 'une phrase née ailleurs' && f.origin && f.origin.text === 'Écriture : une phrase née ailleurs' && f.origin.from === 'Capture', 'le fragment rangé garde une copie de la note d’origine');
  await go('ecriture');
  check((await main()).includes('↳ de Capture'), 'provenance affichée sous le fragment');
  await p.selectOption('li:has-text("une phrase née ailleurs") select.ep', 'inx'); await p.waitForTimeout(200);
  f = (await data()).modules.ecriture.scraps.at(-1);
  check(f.ep === 'inx' && f.epLog.length === 1, 'statut changé sur place, et daté');

  console.log('pont de reprise');
  await p.click('[data-act="bridge-edit"]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.activeElement && document.activeElement.id === 'bridgeIn'), 'le champ s’ouvre et prend le focus');
  await p.fill('#bridgeIn', 'réécrire l’ouverture du ch. 3'); await p.press('#bridgeIn', 'Enter'); await p.waitForTimeout(200);
  check((await main()).includes('Reprendre : réécrire l’ouverture du ch. 3'), 'le pont s’affiche en haut du module');
  await shot('ecriture');
  await go('accueil');
  check((await main()).includes('↳ réécrire l’ouverture du ch. 3'), 'et sur l’accueil, sous la ligne du module');
  await go('ecriture'); await p.click('[data-act="bridge-done"]'); await p.waitForTimeout(150);
  check(!(await data()).modules.ecriture.resume, '« fait » lève le pont');
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(150);
  check((await data()).modules.ecriture.resume.text === 'réécrire l’ouverture du ch. 3', '« Annuler » le remet');

  console.log('décisions');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:decisions'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await go('decisions'); await p.click('[data-act="col-new"]'); await p.waitForTimeout(150);
  await p.fill('#form [name=title]', 'Enduit à la chaux'); await p.fill('#form [name=tag]', 'Rénovation');
  await p.fill('#form [name=due]', '2026-01-15'); await p.selectOption('#form [name=status]', 'Prise');
  await p.fill('#form [name=text]', 'Humidité du mur nord. Réviser si devis > 1 200 €.');
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  check((await main()).includes('à réexaminer le'), 'la date se lit comme un rendez-vous de révision');
  await go('accueil');
  check((await main()).includes('« Enduit à la chaux » : à réexaminer'), 'une décision prise revient sur l’accueil à sa date');
  await shot('accueil');
  await p.click('[data-act="col-reread"]'); await p.waitForTimeout(150);
  check((await p.inputValue('#form [name=text]')).includes('Humidité du mur nord'), '« relire » montre la raison d’alors');
  await p.click('#form button[value=cancel]'); await p.waitForTimeout(100);
  await p.click('[data-act="col-keep"]'); await p.waitForTimeout(150);
  const x = (await data()).modules.decisions.entries[0];
  check(x.due === '' && x.reviews.length === 1 && x.reviews[0].verdict === 'maintenue', '« maintenue » : réexamen daté, rendez-vous levé');
  check(!(await main()).includes('à réexaminer'), 'et l’accueil s’en libère');

  console.log('concordance des motifs');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:motifs'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await go('motifs');
  for (const [title, variants] of [['Seuil', 'porte'], ['Récit', ''], ['Sorcière', '']]) {
    await p.click('[data-act="col-new"]'); await p.waitForTimeout(120);
    await p.fill('#form [name=title]', title); await p.fill('#form [name=subtitle]', variants);
    await p.click('#form button[value=save]'); await p.waitForTimeout(150);
  }
  let t = await main();
  check(/Seuil.*1 occurrence · dernière aujourd'hui \(Capture\)/.test(t), 'un motif est compté dans les autres modules, avec sa dernière apparition');
  check(/Sorcière.*jamais rencontré/.test(t), 'un motif absent le dit');
  await go('accueil'); await p.fill('#capIn', 'Une porte, un seuil, un récit'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(200);
  await go('motifs'); t = await main();
  check(/Seuil.*2 occurrences/.test(t) && t.includes('voisins : Récit (2)'), 'variantes comptées, voisins dès deux rencontres communes');
  await shot('motifs');
  await p.click('li:has(b:text-is("Seuil")) [data-act="search-for"]'); await p.waitForTimeout(250);
  check((await p.inputValue('#searchIn')) === 'Seuil', '« voir » mène à la recherche du motif');

  console.log('recherche et bilan');
  await go('bilan');
  check((await main()).includes('Statut des idées notées'), 'le bilan compte les idées par statut');
  check((await main()).includes('Seuil ×2'), 'le bilan dit quels motifs sont apparus dans la période');
  await p.click('[data-act="search-for"]:has-text("hypothèse")'); await p.waitForTimeout(250);
  check((await p.inputValue('#searchIn')) === 'statut:hypothèse' && (await main()).includes('le seuil précède le récit'), 'un statut du bilan mène à la recherche filtrée');
  check(!(await main()).includes('une phrase née ailleurs'), 'et ne garde que ce statut');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
