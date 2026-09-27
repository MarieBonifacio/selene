/* Scénario de navigateur : taches. Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const today = new Date().toISOString().slice(0, 10);
const T = (id, title, x = {}) => ({ id, title, room: 'Cuisine', cat: 'Bricolage', due: null, effort: 1, cost: null, note: '', today: false, done: false, doneAt: null, created: today, steps: [], ...x });
const v5site = { updatedAt: 10, schemaVersion: 5,
  config: { name: 'Selene', palette: 'nigredo', mode: 'auto', labels: { chantier: 'Appartement' }, groups: { chantier: { on: true, by: 'room', sort: 'name', hideDone: false, title: '' } },
    modules: ['chantier', 'budget', 'inbox'].map(id => ({ id, on: true })), assistant: { model: 'claude-sonnet-5', actions: true, share: { chantier: true } } },
  modules: { inbox: { type: 'notes', label: 'Capture', config: { inbox: true, description: '', placeholder: '…' }, entries: [{ id: 'n1', text: 'réparer la porte', date: today }] },
    budget: { type: 'budget', label: 'Budget', config: { envelopes: [], groups: { on: true, by: 'cat', sort: 'name', hideDone: false, title: '' } }, entries: [] } } };
const board = { updatedAt: 9, tasks: [T('t1', 'Poser le velux', { due: today, cost: 250, steps: [{ t: 'Devis', d: false }, { t: 'Achat', d: false }] }), T('t2', 'Plinthes', { room: 'Salon', today: true }), T('t3', 'Joints', { room: 'Salle de bain', today: true })] };
(async () => {
  const b = await chromium.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(([s, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', JSON.stringify(s)); localStorage.setItem('selene-board-v1', JSON.stringify(bd)); } }, [v5site, board]);
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;
  const openAll = () => p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  const save = async () => { await p.click('#form button[value=save]'); await p.waitForTimeout(200); };

  console.log('migration');
  let d = await data();
  ok(d.modules.chantier.type === 'taches' && d.modules.chantier.entries.length === 3 && d.modules.chantier.label === 'Appartement', 'tâches du board versées dans le module (nom personnalisé gardé)');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('selene-board-v1')).tasks.length)) === 0, 'board vidé');
  ok((await p.textContent('#nav')).includes('Appartement'), 'navigation');
  ok((await main()).includes('Plinthes') && (await main()).includes('Joints'), 'accueil : tâches du jour');

  console.log('module Chantier');
  await go('chantier'); let t = await main();
  ok(t.includes('Poser le velux') && t.includes('250 €') && t.includes('0/2 étapes') && t.includes('Pièce : tout'), 'vue : échéances, coûts, étapes, filtre par pièce');
  ok(t.includes('Budget estimé : 0 € engagés, 250 € encore à prévoir'), 'budget estimé');
  await p.click('li[data-task="t1"] [data-act="task-open"]'); await p.waitForTimeout(100);
  await p.check('li[data-task="t1"] [data-act="task-step"][data-i="0"]'); await p.waitForTimeout(150);
  ok((await data()).modules.chantier.entries.find(x => x.id === 't1').steps[0].d === true, 'étape cochée');
  await p.click('li[data-task="t1"] [data-act="task-today"]'); await p.waitForTimeout(150);
  ok((await data()).modules.chantier.entries.find(x => x.id === 't1').today === true, 'troisième tâche du jour acceptée');
  await p.click('[data-act="task-new"]'); await p.fill('#form [name=title]', 'Peindre'); await save();
  await p.click('li:has-text("Peindre") [data-act="task-today"] >> nth=0'); await p.waitForTimeout(150);
  ok((await p.textContent('#toast')).includes('plafond'), 'quatrième refusée : plafond de trois');
  await p.click('li[data-task="t2"] [data-act="task-done"] >> nth=0'); await p.waitForTimeout(150);
  ok((await main()).includes('Fait récemment') && (await data()).modules.chantier.entries.find(x => x.id === 't2').done, 'tâche terminée');
  await p.selectOption('[data-act="f-room"]', 'Cuisine'); await p.waitForTimeout(150);
  const ech = (await p.textContent('section:has(> .row h3:text("Échéances"))')).replace(/\s+/g, ' ');
  ok(ech.includes('Poser le velux') && !ech.includes('Joints'), 'filtre par pièce (section Échéances)');

  console.log('un second module de tâches');
  await go('reglages'); await openAll(); await p.selectOption('#newModType', 'taches'); await p.fill('#newModName', 'Jardin'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await openAll(); await p.fill('#mreg-jardin [data-act="task-cats"]', 'Taille\nSemis'); await p.press('#mreg-jardin [data-act="task-cats"]', 'Tab'); await p.waitForTimeout(150);
  await openAll(); await p.uncheck('#mreg-jardin [data-act="task-costs"]'); await p.waitForTimeout(150);
  d = await data(); ok(d.modules.jardin.config.cats.join() === 'Taille,Semis' && d.modules.jardin.config.costs === false && d.modules.jardin.config.groupLabel === 'Lieu', 'réglages : types, coûts désactivés, regroupement « Lieu »');
  await go('jardin'); await p.click('[data-act="task-new"]');
  ok(!(await p.isVisible('#form [name=cost]')) && (await p.textContent('#form')).includes('Lieu'), 'formulaire adapté (pas de coût, « Lieu »)');
  await p.fill('#form [name=title]', 'Tailler la haie'); await save();
  await p.click('li:has-text("Tailler") [data-act="task-today"]'); await p.waitForTimeout(150);
  ok((await data()).modules.jardin.entries[0].today === true, 'troisième tâche du jour, prise dans l’autre module : acceptée');
  await go('chantier'); await p.selectOption('[data-act="f-room"]', ''); await p.waitForTimeout(100);
  await p.click('li:has-text("Peindre") [data-act="task-today"] >> nth=0'); await p.waitForTimeout(150);
  ok((await p.textContent('#toast')).includes('plafond'), 'quatrième, dans le Chantier : refusée (plafond commun)');
  await go('accueil'); const home = await main();
  ok(['Joints', 'Poser le velux', 'Tailler la haie'].every(x => home.includes(x)), 'l’accueil réunit les tâches du jour des deux modules');

  console.log('liens');
  await go('inbox'); await p.click('[data-act="note-to"][data-to="chantier"]'); await p.waitForTimeout(200);
  ok(await p.isVisible('#dlg') && (await p.inputValue('#form [name=title]')) === 'réparer la porte', 'une note rangée dans le Chantier ouvre son formulaire');
  await p.click('#form button[value=cancel]');
  await go('budget'); ok((await main()).includes('Les tâches en cours estiment encore 250,00 €'), 'le budget voit les coûts des tâches');
  await go('accueil'); ok((await main()).includes('Appartement') && (await main()).includes('% fait'), 'résumé d’accueil fourni par le type');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
