/* Scénario de navigateur : recherche-minuteur. Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.kundalini.config.start = '2026-01-05';
demo.modules.ecriture.scraps = [{ id: 'f1', text: 'Une phrase sur l’été dissocié', date: '2026-09-01' }];
demo.modules.chantier.entries = [{ id: 't1', title: 'Poser le velux', room: 'Chambre', cat: 'Bricolage', due: null, effort: 1, cost: 250, note: '', today: false, done: false, doneAt: null, created: '2026-09-01', steps: [] }];
(async () => {
  const b = await chromium.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install();
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.clock.runFor(400);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.clock.runFor(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;

  console.log('recherche');
  await p.keyboard.press('/'); await p.clock.runFor(100);
  ok((await p.evaluate(() => location.hash)) === '#recherche' && (await p.evaluate(() => document.activeElement.id)) === 'searchIn', '« / » ouvre la recherche, curseur dans le champ');
  await p.keyboard.type('ete disso'); await p.clock.runFor(200);
  ok((await main()).includes('1 résultat') && (await p.innerHTML('#main')).includes('<mark>été</mark>'), 'sans accents, tous les mots, passage surligné');
  ok((await p.inputValue('#searchIn')) === 'ete disso' && (await p.evaluate(() => document.activeElement.id)) === 'searchIn', 'la frappe continue sans perdre le champ');
  ok((await p.textContent('#nav')).includes('Chercher'), 'lien « Chercher » dans la navigation');

  console.log('minuteur');
  await go('kundalini'); await p.click('#timerBtn'); await p.clock.runFor(15 * 60 * 1000 + 1000);
  ok((await p.textContent('#toast')).includes('Noter 15 min'), 'fin des 15 min sur un protocole : « Noter 15 min » proposé');
  await p.click('#toast [data-act="undo"]'); await p.clock.runFor(200);
  ok((await data()).modules.kundalini.entries.some(e => e.value === 15), 'séance notée');
  await p.click('#timerReset'); await go('ecriture'); await p.click('#timerBtn'); await p.clock.runFor(15 * 60 * 1000 + 1000);
  ok((await p.evaluate(() => document.activeElement.id)) === 'cumIn' && (await p.textContent('#toast')).includes('Combien de mots'), 'sur l’Écriture : curseur dans le compteur');

  console.log('tâche → budget');
  await go('chantier'); await p.click('li[data-task="t1"] [data-act="task-done"]'); await p.clock.runFor(200);
  ok((await p.textContent('#toast')).includes('250,00') && (await p.textContent('#toast')).includes('Travaux'), 'coût proposé au budget, enveloppe Travaux');
  await p.click('#toast [data-act="undo"]'); await p.clock.runFor(200);
  ok((await data()).modules.budget.entries.some(e => e.amount === 250 && e.cat === 'Travaux' && e.note === 'Poser le velux'), 'dépense ajoutée');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
