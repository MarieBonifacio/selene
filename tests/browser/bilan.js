/* Scénario de navigateur : bilan. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
const iso = d => new Date(d - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = iso(Date.now()), lastMonth = iso(Date.now() - 33 * 864e5);
demo.modules.kundalini.entries = [{ id: 'k1', date: today, value: 20, note: '' }, { id: 'k2', date: lastMonth, value: 30, note: '' }];
demo.modules.ecriture.entries = [{ id: 'e1', date: today, value: 1200, category: '' }];
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await (await b.newContext({ viewport: { width: 900, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const ok = check;
  await p.click('a[href="#bilan"]'); await p.waitForTimeout(200);
  let t = await main();
  ok(t.includes('Cycle du') && t.includes('1 séance, 20 min') && t.includes('+1 200 mots'), 'bilan du cycle en cours : séances, mots');
  await p.click('[data-act="bilan-mode"][data-m="mois"]'); await p.waitForTimeout(150);
  t = await main(); const name = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  ok(t.includes(name) && t.includes('avant : 1 séance, 30 min'), `mode mois (${name}), période précédente en regard`);
  await p.click('[data-act="bilan-nav"][data-d="1"]'); await p.waitForTimeout(150);
  ok((await main()).includes('1 séance, 30 min') && await p.isVisible('[data-act="bilan-nav"][data-d="-1"]'), 'remonter d’un mois, puis pouvoir revenir');
  await p.reload(); await p.waitForTimeout(300); await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(200);
  ok((await p.textContent('#main a[href="#bilan"]')).includes('Bilan du mois'), 'le mode choisi est retenu sur l’appareil');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
