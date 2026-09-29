/* Scénario de navigateur : navigation (évolution de l'interface, vague 2 : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
// 150 fragments : le plus ancien est au-delà de la première page de cent.
demo.modules.ecriture.scraps = Array.from({ length: 150 }, (_, i) => ({ id: 'f' + i, text: i === 0 ? 'La lisière des aulnes' : 'Fragment ordinaire ' + i, date: '2026-0' + (1 + (i % 8)) + '-1' + (i % 9) }));
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctxD = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctxD.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  const d = await ctxD.newPage(); d.on('pageerror', e => errs.push(e.message));
  await d.goto(BASE + '/index.html'); await d.waitForTimeout(400);
  const go = async (p, h) => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const hash = p => p.evaluate(() => location.hash);

  console.log('barre latérale et domaines');
  ok(await d.isVisible('#nav a[href="#bilan"]') && !(await d.isVisible('#bar')), 'ordinateur : barre latérale (avec le Bilan), pas de barre basse');
  await go(d, 'reglages');
  await d.fill('.set.mod:has([value="Chantier"]) [data-act="mod-group"]', 'Maison'); await d.press('.set.mod:has([value="Chantier"]) [data-act="mod-group"]', 'Tab'); await d.waitForTimeout(200);
  ok((await d.textContent('#nav')).includes('Maison'), 'un domaine réglé devient un titre de la navigation');
  await go(d, 'accueil'); ok((await d.textContent('#main')).includes('Maison'), 'et regroupe le sommaire de l’accueil');

  console.log('palette');
  await d.keyboard.press('Control+k'); await d.waitForTimeout(100);
  ok(await d.isVisible('#palette'), '⌘K / Ctrl+K ouvre la palette');
  await d.keyboard.type('écri'); await d.waitForTimeout(100); await d.keyboard.press('Enter'); await d.waitForTimeout(250);
  ok(await hash(d) === '#ecriture' && !(await d.isVisible('#palette')), 'un espace trouvé par son nom, Entrée y mène');
  await go(d, 'accueil');
  await d.keyboard.press('Control+k'); await d.keyboard.type('aulnes'); await d.waitForTimeout(150);
  const n = await d.$$eval('#palList li', lis => lis.findIndex(li => li.textContent.includes('La lisière des aulnes')));
  for (let i = 0; i < n; i++) await d.keyboard.press('ArrowDown');
  await d.keyboard.press('Enter'); await d.waitForTimeout(300);
  ok(await hash(d) === '#ecriture/f0', 'un texte trouvé dans la palette mène à son entrée');
  ok(await d.$eval('[data-id="f0"]', el => el.classList.contains('flash') && el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= innerHeight), 'l’entrée, au-delà de la première page, est dépliée, montrée et surlignée');

  console.log('liens directs et retour');
  await go(d, 'recherche'); await d.fill('#searchIn', 'aulnes'); await d.waitForTimeout(200);
  await d.click('#main a[href="#ecriture/f0"]'); await d.waitForTimeout(300);
  ok((await d.textContent('.back')).includes('Recherche « aulnes »'), 'une puce ramène à la recherche');
  await d.click('.back'); await d.waitForTimeout(250);
  ok(await hash(d) === '#recherche' && (await d.inputValue('#searchIn')) === 'aulnes', 'le retour rend la recherche telle qu’elle était');

  console.log('reprise');
  await go(d, 'ecriture'); await d.fill('#scrapIn', 'une phrase à finir'); await d.waitForTimeout(100);
  await go(d, 'accueil');
  const box = (await d.textContent('.resume-box')).replace(/\s+/g, ' ');
  ok(box.includes('Écriture') && box.includes('un fragment en cours'), 'l’accueil propose de reprendre le dernier espace et son brouillon');
  await go(d, 'reglages'); await d.selectOption('[data-act="open-on"]', 'last'); await d.waitForTimeout(100);
  await go(d, 'ecriture');
  const d2 = await ctxD.newPage(); d2.on('pageerror', e => errs.push(e.message));
  await d2.goto(BASE + '/index.html#accueil'); await d2.waitForTimeout(400);
  ok(await hash(d2) === '#ecriture', '« Ouvrir sur : là où j’en étais » rouvre le dernier espace');
  await d2.close();

  console.log('iPhone : barre basse et feuilles');
  const ctxM = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctxM.addInitScript(dt => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', dt); }, JSON.stringify(demo));
  const m = await ctxM.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto(BASE + '/index.html'); await m.waitForTimeout(400);
  ok(await m.isVisible('#bar') && !(await m.isVisible('#nav')), 'téléphone : barre basse, pas de barre latérale');
  await m.tap('[data-act="sheet-espaces"]'); await m.waitForTimeout(300);
  ok(await m.isVisible('#sheet .srow[href="#budget"]'), 'Espaces ouvre une feuille avec les espaces');
  await m.tap('#sheet .srow[href="#budget"]'); await m.waitForTimeout(300);
  ok(await hash(m) === '#budget' && !(await m.isVisible('#sheet')), 'un espace touché : on y est, la feuille se ferme');
  ok(await m.$eval('#bar [data-act="sheet-espaces"]', el => el.classList.contains('on')), 'Espaces marqué actif dans la barre');
  const before = await m.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.inbox.entries.length);
  await m.tap('[data-act="sheet-capture"]'); await m.waitForTimeout(300);
  await m.fill('#capSheetIn', 'une idée au vol'); await m.press('#capSheetIn', 'Enter'); await m.waitForTimeout(300);
  const after = await m.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.inbox.entries.length);
  ok(after === before + 1 && !(await m.isVisible('#sheet')), 'Capturer : gardé dans la boîte, la feuille se ferme');
  await m.tap('[data-act="sheet-capture"]'); await m.waitForTimeout(300);
  await m.fill('#capSheetIn', 'à moitié'); await m.mouse.click(195, 60); await m.waitForTimeout(200);
  ok(!(await m.isVisible('#sheet')), 'toucher le voile ferme la feuille');
  await m.tap('[data-act="sheet-capture"]'); await m.waitForTimeout(300);
  ok((await m.inputValue('#capSheetIn')) === 'à moitié', 'le brouillon d’une capture survit à la fermeture');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
