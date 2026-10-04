/* Scénario de navigateur : ce qu'un lecteur d'écran sait de l'écran affiché. Le titre de la page le nomme
   (« Écriture — Selene », WCAG 2.4.2) ; suivre un lien du menu au clavier porte le focus au titre du nouvel écran,
   au lieu de le laisser retomber sur la page entière, sans rien annoncer ; un champ qui a le focus le garde (« / »
   ouvre la recherche, curseur dans le champ). Données synthétiques. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#accueil'); await p.waitForSelector('#main h2');
  const focused = () => p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}:${(a.textContent || '').trim().slice(0, 20)}` : ''; });

  console.log('le titre de la page');
  check(await p.title() === "Aujourd'hui — Selene", `accueil : « ${await p.title()} »`);
  for (const [h, t] of [['ecriture', 'Écriture — Selene'], ['reglages', 'Réglages — Selene'], ['bilan', 'Bilan — Selene']]) {
    await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(300);
    check(await p.title() === t, `#${h} : « ${await p.title()} »`);
  }

  console.log('le focus suit la navigation');
  await p.focus('#nav a[href="#chantier"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check(/^h2:Chantier/.test(await focused()), `Entrée sur « Chantier » : le focus est au titre de l'écran (${await focused()})`);
  check(await p.evaluate(() => scrollY) < 5, 'sans défiler');
  await p.keyboard.press('Tab');
  check(await p.evaluate(() => !!document.activeElement.closest('#main')), 'Tab repart du contenu de l’écran, pas du haut de la page');
  await p.focus('#nav a[href="#ecriture"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check(/^h2:Écriture/.test(await focused()), `puis « Écriture » (${await focused()})`);

  console.log('un champ garde le focus');
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('/'); await p.waitForTimeout(400);
  check(/^input#searchIn/.test(await focused()), `« / » : le curseur est dans la recherche (${await focused()})`);
  check(await p.title() === 'Chercher — Selene', `et la page s'appelle « ${await p.title()} »`);

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
