/* Scénario de navigateur : quotidien. Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.kundalini.config.start = '2026-01-05';
demo.modules.kundalini.entries = [{ id: 'k1', date: '2026-01-05', value: 25, note: '' }];
demo.modules.moth.entries = [{ id: 'p1', title: 'Le lichen', subtitle: '', tag: 'Nigredo', due: '2020-01-01', text: '', status: 'Prêt' }];
(async () => {
  const b = await chromium.launch(launchOptions);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // un iPhone
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;
  const heroH = () => p.evaluate(() => document.querySelector('.hero svg').getBoundingClientRect().height);

  console.log('accueil');
  const h1 = await heroH();
  let t = await main();
  ok(t.includes('Noter 25 min') && t.includes('« Le lichen » : en retard'), 'séance en un geste, élément de collection en retard');
  await p.click('[data-act="entry-log"][data-mod="phidippus"] >> nth=0'); await p.waitForTimeout(200);
  ok((await data()).modules.phidippus.entries.length === 1, '« fait » sur un rappel, depuis l’accueil');
  await p.click('[data-act="prog-quick"]'); await p.waitForTimeout(200);
  ok((await main()).includes('Séance de kundalini faite'), 'séance notée avec la dernière durée');
  ok(await heroH() === h1, 'le paysage ne se replie pas en cours d’utilisation');
  await p.click('.over-wrap:has-text("Kundalini") summary'); await p.waitForTimeout(100);
  ok((await p.textContent('.over-wrap:has-text("Kundalini") .more')).includes('25 min'), 'ligne dépliée : derniers éléments');
  await p.reload(); await p.waitForTimeout(400);
  const h2 = await heroH();
  ok(h2 < h1 * 0.6, `deuxième ouverture du jour : paysage réduit (${Math.round(h1)} → ${Math.round(h2)} px)`);

  console.log('brouillons');
  await go('ecriture'); await p.fill('#scrapIn', 'une phrase qui passe');
  await p.reload(); await p.waitForTimeout(400); await go('ecriture');
  ok((await p.inputValue('#scrapIn')) === 'une phrase qui passe', 'brouillon restauré après fermeture');
  await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(150);
  await p.reload(); await p.waitForTimeout(400); await go('ecriture');
  ok((await p.inputValue('#scrapIn')) === '', 'brouillon effacé une fois gardé');

  console.log('annuler');
  await p.click('li:has-text("une phrase qui passe") [data-act="scrap-del"]'); await p.waitForTimeout(150);
  ok(!(await main()).includes('une phrase qui passe') && await p.isVisible('#toast [data-act="undo"]'), 'supprimé sans confirmation, bouton « Annuler »');
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(150);
  ok((await main()).includes('une phrase qui passe'), '« Annuler » le remet');

  console.log('écriture en mode total');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#mreg-ecriture [data-set-mod="ecriture.entryMode"]', 'total'); await p.waitForTimeout(150);
  await go('ecriture'); await p.fill('#cumIn', '1200'); await p.click('[data-act="entry-add"]'); await p.waitForTimeout(150);
  await p.fill('#cumIn', '1850'); await p.click('[data-act="entry-add"]'); await p.waitForTimeout(150);
  const e = (await data()).modules.ecriture.entries.map(x => x.value);
  ok(e.join() === '1200,650', `total 1 200 puis 1 850 → +1 200 puis +650 (${e.join(', ')})`);
  ok((await main()).includes('objectif atteint vers le'), 'projection affichée');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
