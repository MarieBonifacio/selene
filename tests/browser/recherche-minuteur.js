/* Scénario de navigateur : recherche-minuteur. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.kundalini.config.start = '2026-01-05';
demo.modules.ecriture.scraps = [{ id: 'f1', text: 'Une phrase sur l’été dissocié', date: '2026-09-01' }];
demo.modules.chantier.entries = [{ id: 't1', title: 'Poser le velux', room: 'Chambre', cat: 'Bricolage', due: null, effort: 1, cost: 250, note: '', today: false, done: false, doneAt: null, created: '2026-09-01', steps: [] }];
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install();
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.clock.runFor(400);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.clock.runFor(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;

  console.log('recherche');
  // Attendre le premier rendu : une touche pressée avant que l'app ait dessiné l'accueil peut se perdre.
  await p.waitForSelector('#nav a[href="#recherche"]');
  await p.keyboard.press('/'); await p.clock.runFor(100);
  ok((await p.evaluate(() => location.hash)) === '#recherche' && (await p.evaluate(() => document.activeElement.id)) === 'searchIn', '« / » ouvre la recherche, curseur dans le champ');
  await p.keyboard.type('ete disso'); await p.clock.runFor(200);
  ok((await main()).includes('1 résultat') && (await p.innerHTML('#main')).includes('<mark>été</mark>'), 'sans accents, tous les mots, passage surligné');
  ok((await p.inputValue('#searchIn')) === 'ete disso' && (await p.evaluate(() => document.activeElement.id)) === 'searchIn', 'la frappe continue sans perdre le champ');
  ok(/^Chercher — /.test(await p.title()), `l’onglet dit l’écran (« ${await p.title()} »)`);
  await p.keyboard.type(' zzz'); await p.clock.runFor(200);
  ok((await main()).includes("Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire."), 'un mot qu’aucun texte ne contient : rien, et c’est dit');
  ok((await p.textContent('#nav')).includes('Chercher'), 'lien « Chercher » dans la navigation');

  console.log('minuteur');
  await go('kundalini'); await p.click('#timerBtn'); await p.clock.runFor(15 * 60 * 1000 + 1000);
  ok((await p.textContent('#toast')).includes('Noter 15 min'), 'fin des 15 min sur un protocole : « Noter 15 min » proposé');
  await p.click('#toast [data-act="undo"]'); await p.clock.runFor(200);
  ok((await data()).modules.kundalini.entries.some(e => e.value === 15), 'séance notée');
  await p.click('#timerReset'); await go('ecriture'); await p.click('#timerBtn'); await p.clock.runFor(15 * 60 * 1000 + 1000);
  ok((await p.evaluate(() => document.activeElement.id)) === 'cumIn' && (await p.textContent('#toast')).includes('Combien de mots'), 'sur l’Écriture : curseur dans le compteur');

  console.log('le tirage au sort, depuis l’accueil');
  await go('');
  ok((await main()).includes('Aucune tâche choisie. Tirer une petite tâche au sort'), '« Aucune tâche choisie. » et le bouton du tirage');
  await p.click('#main [data-act="task-pick"]'); await p.clock.runFor(200);
  ok((await p.textContent('#toast')) === 'Le sort a désigné : « Poser le velux ». Pas de recours possible.', '« Le sort a désigné : « Poser le velux ». Pas de recours possible. »');
  ok((await data()).modules.chantier.entries.find(x => x.id === 't1').today === true && (await main()).includes('Poser le velux') && !(await main()).includes('Aucune tâche choisie'), 'la tâche tirée est du jour, et l’accueil la montre');
  await go('chantier');
  ok(await p.getAttribute('li[data-task="t1"] [data-act="task-today"]', 'aria-pressed') === 'true' && !!(await p.$('li[data-task="t1"] .star.on')), 'son étoile est allumée, et le dit au lecteur d’écran (aria-pressed, A30)');

  console.log('tâche → budget');
  const velux = async () => (await data()).modules.budget.entries.filter(e => e.note === 'Poser le velux');
  await p.click('li[data-task="t1"] [data-act="task-done"]'); await p.clock.runFor(200);
  ok(/^Fait\. 250,00\s€ estimés : les passer au budget \(Travaux\) \? Ajouter$/.test((await p.textContent('#toast')).trim()), 'coût proposé au budget, enveloppe Travaux : « Fait. 250,00 € estimés : les passer au budget (Travaux) ? »');
  await p.clock.runFor(11000);
  ok(!(await p.isVisible('#toast.show')) && !(await velux()).length, 'le message passé sans le bouton : rien n’est ajouté');
  await p.click('li[data-task="t1"] [data-act="task-undo"]'); await p.clock.runFor(200); // « annuler » : la tâche n'est plus faite
  await p.click('li[data-task="t1"] [data-act="task-done"]'); await p.clock.runFor(200); // refaite : la proposition revient
  await p.click('#toast [data-act="undo"]'); await p.clock.runFor(200);
  ok((await velux()).some(e => e.amount === 250 && e.cat === 'Travaux'), 'dépense ajoutée');
  ok((await p.textContent('#toast')) === `Ajouté à ${(await data()).modules.budget.label}. L'argent, lui, était déjà parti.`, '« Ajouté à Budget. L’argent, lui, était déjà parti. »');
  await go('budget');
  ok(/Poser le velux/.test(await main()) && /250,00\s€/.test(await main()), 'le Budget du mois montre la dépense');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
