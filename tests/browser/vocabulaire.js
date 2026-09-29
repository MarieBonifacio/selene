/* Scénario de navigateur : dérive lexicale du bilan. Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
const demo = JSON.parse(fixture());
// Des notes réparties sur sept mois : « lune » et « brouillard » montent ce mois-ci, « cendre » s'éteint.
const month = k => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - k, 10, 12).toISOString().slice(0, 10); };
let n = 0; const note = (text, k) => demo.modules.inbox.entries.push({ id: 'v' + n++, text, date: month(k) });
['La lune sur le seuil', 'Des lunes et du brouillard', 'Encore la lune', 'Le brouillard monte', 'Une phrase quelconque', 'La forêt'].forEach(t => note(t, 0));
[['La forêt, la cendre', 1], ['Forêt noire', 2], ['Cendre et forêt', 3], ['Cendres froides', 4], ['Une forêt', 5], ['Rien de neuf', 6]].forEach(([t, k]) => note(t, k));
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-bilan', 'mois'); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));

  console.log('vocabulaire du mois');
  await go('bilan'); let t = await main();
  check(t.includes('Vocabulaire') && t.includes('6 textes contre 6'), 'la section compare la période aux six d’avant');
  check(/Émergent.*lune · 3.*brouillard · 2/.test(t), 'mots émergents (« lunes » compté avec « lune »), les plus marqués d’abord');
  check(/Absent cette fois, fréquent avant.*cendre · 3 avant/.test(t), 'mot fréquent avant et absent cette fois');
  check(!/Émergent.*\b(encore|sur|des)\b · /.test(t), 'aucun mot vide');
  check(!t.includes('« + » en fait un motif'), 'sans module Motifs, pas de bouton « + »');
  await p.click('.chip:has-text("brouillard") [data-act="search-for"]'); await p.waitForTimeout(250);
  check((await p.inputValue('#searchIn')) === 'brouillard' && (await main()).includes('2 résultats'), 'un mot mène à la recherche');

  console.log('d’un mot à un motif');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:motifs'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await go('bilan');
  await p.click('.chip:has-text("brouillard") [data-act="motif-add"]'); await p.waitForTimeout(200);
  check((await data()).modules.motifs.entries.some(e => e.title === 'brouillard'), '« + » en fait un motif');
  check(!(await p.isVisible('.chip:has-text("brouillard") [data-act="motif-add"]')), 'et le bouton disparaît pour ce mot');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/vocabulaire.png`, fullPage: true });
  await go('motifs');
  check(/brouillard.*2 occurrences/.test(await main()), 'le nouveau motif est aussitôt compté');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
