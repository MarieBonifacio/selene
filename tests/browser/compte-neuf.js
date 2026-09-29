/* Scénario de navigateur : compte-neuf. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.claude = { use: async () => null }; });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const nav = async () => (await p.textContent('#nav')).replace(/\s+/g, ' ');
  const ok = check;
  let t = await main();
  ok(t.includes('Composer ton espace') && t.includes('Tableau de production') && t.includes('Rien de prévu'), 'compte neuf : modèles proposés, pas de tâche fictive');
  ok(!t.includes('Ulver') && !(await nav()).includes('Phidippus') && !(await nav()).includes('Kundalini'), 'aucun contenu personnel');
  for (const tpl of ['taches', 'ecriture', 'decouvertes']) { await p.click(`[data-act="tpl-add"][data-tpl="${tpl}"]`); await p.waitForTimeout(150); }
  const n3 = await nav(); ok(['Tâches', 'Écriture', 'À découvrir'].every(x => n3.includes(x)), 'trois modules ajoutés, visibles dans la navigation');
  ok((await main()).includes('Tirer une petite tâche au sort'), 'avec un module de tâches, le tirage au sort apparaît');
  await p.click('[data-act="welcome-done"]'); await p.waitForTimeout(150);
  ok(!(await main()).includes('Composer ton espace'), '« C’est bon » referme le bloc');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:tableau'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  ok((await nav()).includes('Tableau de production'), 'création depuis un modèle dans Réglages (nom du modèle si vide)');
  await p.evaluate(() => location.hash = 'tableau-de-production'); await p.waitForTimeout(200);
  ok((await main()).includes('Idée') && (await main()).includes('Publié') && (await main()).includes('Nouvelle idée'), 'le modèle a réglé colonnes et bouton');
  await p.reload(); await p.waitForTimeout(300);
  ok(!(await main()).includes('Composer ton espace'), 'le bloc ne revient pas au rechargement');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
