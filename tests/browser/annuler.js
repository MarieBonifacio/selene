/* Scénario de navigateur : « Annuler » à la portée de tous (WCAG 2.2.1, délai réglable). Le message qui propose
   d'annuler part seul au bout de six secondes, sauf s'il est survolé ou si le focus y est : il attend qu'on le quitte.
   ⌘Z (Ctrl+Z) annule aussi, hors d'un champ ; dans un champ, le raccourci reste au champ. Données synthétiques.
   Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#ecriture'); await p.waitForSelector('#scrapIn');
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const shown = () => p.evaluate(() => document.querySelector('#toast').classList.contains('show'));
  const add = async t => { await p.fill('#scrapIn', t); await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(150); };
  const del = async t => { await p.click(`li:has-text("${t}") [data-act="scrap-del"]`); await p.waitForSelector('#toast.show [data-act="undo"]'); };
  const away = () => p.mouse.move(640, 120);
  for (const t of ['brume un', 'brume deux', 'brume trois', 'brume quatre']) await add(t);

  console.log('survolé, il attend');
  await del('brume un');
  check(/Control\+Z/.test(await p.getAttribute('#toast [data-act="undo"]', 'aria-keyshortcuts') || ''), 'le bouton annonce son raccourci (aria-keyshortcuts)');
  await p.hover('#toast [data-act="undo"]'); await p.waitForTimeout(7000);
  check(await shown(), 'survolé, le message reste au-delà des six secondes');
  await away(); await p.waitForTimeout(2600);
  check(!(await shown()) && !(await main()).includes('brume un'), 'quitté, il part ; la suppression tient');

  console.log('atteint au clavier, il attend');
  await del('brume deux'); await away();
  await p.focus('#toast [data-act="undo"]'); await p.waitForTimeout(7000);
  check(await shown(), 'le focus dessus, le message reste');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  check((await main()).includes('brume deux'), 'Entrée annule');

  console.log('⌘Z (Ctrl+Z)');
  await del('brume trois'); await away();
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  check((await main()).includes('brume trois') && /Rétabli/.test(await p.textContent('#toast')), 'hors d’un champ, Ctrl+Z annule la suppression');
  await del('brume quatre'); await away();
  await p.focus('#scrapIn'); await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  check(!(await main()).includes('brume quatre'), 'dans un champ, Ctrl+Z reste au champ : rien n’est remis');
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('Meta+z'); await p.waitForTimeout(200);
  check((await main()).includes('brume quatre'), '⌘Z aussi, sur Mac');

  console.log('sans action, rien ne change');
  await p.waitForTimeout(6500);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.ecriture.scraps.filter(e => /^brume/.test(e.text || '')).length);
  check(d === 3, `message parti, Ctrl+Z ne fait plus rien (${d} fragments sur 3 attendus)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
