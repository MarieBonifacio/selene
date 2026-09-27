/* Scénario de navigateur : un identifiant de module et des nombres piégés (données corrompues, venues d'un
   serveur ou d'une vieille sauvegarde) ne doivent jamais exécuter de script. Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await chromium.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const d = JSON.parse(fixture()), bad = 'x"><img src=z onerror="window.__pwned=1">';
  d.modules[bad] = { type: 'rappels', label: 'Piège', config: { subtitle: '', types: [{ id: 'fait', label: 'Fait', every: '<img src=z onerror="window.__pwned=2">' }] }, entries: [] };
  d.modules.kundalini.config.weeks = '<img src=z onerror="window.__pwned=3">';
  d.config.modules.push({ id: bad, on: true }); d.config.assistant.share[bad] = true; d.updatedAt = 1;
  await p.addInitScript(doc => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', doc); }, JSON.stringify(d));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  for (const h of ['accueil', 'reglages', 'kundalini', 'recherche', 'bilan']) { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(250); }
  await p.evaluate(() => document.querySelectorAll('details').forEach(x => x.open = true)); await p.waitForTimeout(200);
  check(await p.evaluate(() => window.__pwned === undefined), 'aucun script injecté exécuté');
  check(await p.evaluate(() => document.querySelectorAll('img[src=z]').length === 0), 'aucune balise injectée dans la page');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
