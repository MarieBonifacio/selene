/* Scénario de navigateur : test lunaire (statistique de Rayleigh, dans le bilan). Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
const demo = JSON.parse(fixture());
// Cinquante notes concentrées autour d'une même phase (donné dans le fichier, recalculé ici pour rester lisible :
// une date par cycle synodique, décalée de la même fraction de cycle — la pleine lune).
const SYNODIC = 29.530588853, NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
const dateAt = (k, phase) => new Date(NEW_MOON_REF + (k + phase) * SYNODIC * 86400000).toISOString().slice(0, 10);
demo.modules.inbox.entries = Array.from({ length: 50 }, (_, k) => ({ id: 'l' + k, text: 'note', date: dateAt(k, 0.5) }));
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');

  console.log('activité concentrée : signal détecté');
  await go('bilan'); const t = await main();
  check(t.includes('Test de Rayleigh sur 50 événements datés'), 'le nombre d’événements est annoncé');
  check(/Concentration autour de pleine lune \(R = [01]\.\d\d, p = 0\.000\)/.test(t), 'concentration forte, p très bas');
  check(t.includes('Un seul test compte ici'), 'l’avertissement sur les tests multiples est présent');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/lune.png`, fullPage: true });

  console.log('pas assez de matière');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('selene-site-v1')); d.modules.inbox.entries = d.modules.inbox.entries.slice(0, 10); localStorage.setItem('selene-site-v1', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(300); await go('bilan');
  check((await main()).includes('Pas assez de matière pour un test honnête'), 'sous le seuil, le bilan le dit plutôt que d’inventer');

  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
