/* Scénario de navigateur : identité (évolution de l'interface, vague 3a : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.config.modules.find(m => m.id === 'moth').group = 'Création';
demo.config.modules.find(m => m.id === 'ecriture').group = 'Création';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async opts => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(400); return p;
  };
  const go = async (p, h) => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };

  console.log('sigils et planches');
  const d = await open({ viewport: { width: 1280, height: 800 } });
  ok(await d.$$eval('#nav a svg.sig', s => s.length) >= 7, 'chaque espace a son sigil dans la navigation');
  ok(await d.$eval('#nav a[href="#moth"]', a => a.classList.contains('t1')) && await d.$eval('#nav a[href="#chantier"]', a => a.classList.contains('t0')), 'un domaine nommé a sa teinte, un espace sans domaine prend l’accent');
  await go(d, 'moth');
  const plate = (await d.textContent('#main .plate')).replace(/\s+/g, ' ');
  const n = await d.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.modules.filter(m => m.on && m.id !== 'assistant').findIndex(m => m.id === 'moth') + 1);
  ok(plate.includes('Pl. ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n - 1]), `planche numérotée en chiffres romains (${plate.trim().slice(0, 12)})`);

  console.log('régler sur place');
  await d.click('#main .plate [data-act="goto-groups"]'); await d.waitForTimeout(300);
  ok(await d.isVisible('#sheet.drawer') && (await d.evaluate(() => location.hash)) === '#moth', '« régler » ouvre les réglages du module dans un tiroir, sans quitter l’espace');
  await d.click('#sheet [data-act="sigil-set"][data-s="croissant"]'); await d.waitForTimeout(200);
  ok((await d.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.modules.find(m => m.id === 'moth').sigil)) === 'croissant', 'un sigil choisi est gardé');
  ok(await d.$eval('#sheet [data-s="croissant"]', el => el.getAttribute('aria-checked')) === 'true', 'le tiroir se redessine (sigil coché)');
  await d.fill('#sheet [data-set-mod="moth.addLabel"]', 'Nouveau post'); await d.press('#sheet [data-set-mod="moth.addLabel"]', 'Tab'); await d.waitForTimeout(200);
  ok((await d.textContent('#main')).includes('Nouveau post'), 'un réglage changé dans le tiroir s’applique aussitôt à la vue');
  await d.keyboard.press('Escape'); await d.waitForTimeout(150);

  console.log('typographie');
  const fonts = await d.evaluate(() => [getComputedStyle(document.querySelector('#main h2')).fontFamily, getComputedStyle(document.querySelector('#main .btn')).fontFamily, getComputedStyle(document.body).fontFamily]);
  ok(/Cormorant/.test(fonts[0]) && /Plex/.test(fonts[1]) && /Spectral/.test(fonts[2]), 'trois voix : titres en Cormorant, boutons en Plex, texte en Spectral');

  console.log('iPhone : formulaire en feuille');
  const m = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await go(m, 'moth');
  ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'le kanban défile dans son cadre : la page ne s’élargit pas (sinon iOS dézoome tout)');
  await m.tap('[data-act="col-new"]'); await m.waitForTimeout(350);
  const box = await m.$eval('#dlg', el => { const r = el.getBoundingClientRect(); return { bottom: r.bottom, width: r.width }; });
  ok(Math.abs(box.bottom - 844) < 2 && box.width >= 389, 'sur téléphone, un formulaire monte du bas, pleine largeur');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
