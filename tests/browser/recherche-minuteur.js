/* Scénario de navigateur : recherche-minuteur. Lancé par tests/browser/run.js. */
const { engine, ouvrir, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
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
  console.log('le jeu d’essai : chercher (NAV-004)');
  const essai = donnee('jeu-essai.json');
  // Les résultats, groupés par espace : « Espace n » et le texte de chaque entrée.
  const groupes = q => q.evaluate(() => JSON.stringify([...document.querySelectorAll('#main p.search-grp')].map(g => [g.textContent.replace(/\s+/g, ' ').trim(),
    [...g.nextElementSibling.querySelectorAll('li.item')].map(li => (li.querySelector('div') || li).textContent.replace(/\s+/g, ' ').trim())])));
  const LISIERE = JSON.stringify([['Boîte 1', ['Écriture : la lisière comme seuil']], ['Écriture 3', ['La lisière est au contraire une frontière nette, tracée par la coupe.',
    "Toute lisière est un seuil que l'on traverse sans le voir.", "La lisière n'est pas une frontière, c'est un lieu où l'on hésite."]], ['Motifs 1', ['lisière']]]);
  const essaiPage = async opts => {
    const q = await (await b.newContext(opts)).newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
    await ouvrir(q, BASE + '/index.html', () => !!document.querySelector('#nav a[href="#recherche"]'));
    return q;
  };
  // La recherche se redessine à chaque frappe, sans délai (événement input, render() synchrone) : la saisie rendue, l'écran est à jour.
  const chercher = async (q, t, tape = false) => {
    if (tape) await q.keyboard.type(t); else await q.fill('#searchIn', t);
    await q.waitForFunction(v => document.querySelector('#searchIn').value === v, t, { timeout: 5000 }).catch(() => {});
  };
  const q = await essaiPage({ viewport: { width: 1280, height: 900 } });
  await q.keyboard.press('/'); await q.waitForFunction(() => document.activeElement && document.activeElement.id === 'searchIn', null, { timeout: 5000 }).catch(() => {});
  ok((await q.evaluate(() => location.hash)) === '#recherche' && (await q.evaluate(() => document.activeElement.id)) === 'searchIn' && (await q.title()) === 'Chercher — Selene', '« / » : la recherche, le curseur dans le champ, l’onglet « Chercher — Selene »');
  await chercher(q, 'LISIERE', true);
  let g = await groupes(q), marks = await q.$$eval('#main mark', ms => ms.map(m => m.textContent));
  ok(g === LISIERE, `« LISIERE » : Écriture, la Boîte et Motifs (${g})`);
  ok(marks.length === 5 && marks.every(m => m === 'lisière') && (await q.evaluate(() => document.activeElement.id)) === 'searchIn' && (await q.inputValue('#searchIn')) === 'LISIERE', '« lisière » surligné dans chaque extrait, la frappe n’a jamais perdu le champ');
  await chercher(q, 'lisière seuil'); g = await groupes(q);
  ok(g === JSON.stringify([['Boîte 1', ['Écriture : la lisière comme seuil']], ['Écriture 1', ["Toute lisière est un seuil que l'on traverse sans le voir."]]]), `« lisière seuil » : les deux entrées qui ont les deux mots (${g})`);
  await chercher(q, 'lisiere zzz');
  ok((await q.textContent('#main')).includes("Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire.") && (await groupes(q)) === '[]', '« lisiere zzz » : « Rien. Soit ça n’existe pas, soit tu l’as pensé sans l’écrire. »');
  await chercher(q, 'brouillard'); g = JSON.parse(await groupes(q));
  ok(g.length === 2 && g[0][0] === 'Écriture 1' && g[0][1][0].startsWith("Le brouillard efface la route avant d'effacer la forêt.") && g[1][0] === 'Motifs 1' && g[1][1][0] === 'brume · brouillard',
    `« brouillard » : le fragment, et le motif « brume » dont c’est une variante (${JSON.stringify(g)})`);
  const t = await essaiPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await t.tap('#bar a[href="#recherche"]'); await t.waitForSelector('#searchIn');
  await t.tap('#searchIn'); await chercher(t, 'LISIERE', true); g = await groupes(t);
  ok(g === LISIERE, 'sur téléphone, « Chercher » dans la barre basse : les mêmes résultats');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
