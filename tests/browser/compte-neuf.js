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
  ok(t.includes('Composer ton espace') && t.includes('Sur quoi travailles-tu') && t.includes('Rien de prévu'), 'compte neuf : une question, pas de tâche fictive');
  ok(!t.includes('Ulver') && !(await nav()).includes('Phidippus') && !(await nav()).includes('Kundalini'), 'aucun contenu personnel');
  // U3 : trois réponses visibles, la liste entière repliée (elle n'ajoute pas treize décisions au premier écran).
  ok(await p.locator('[data-act="welcome-path"]').count() === 3, 'trois réponses proposées');
  ok(!await p.locator('[data-act="tpl-add"][data-tpl="tableau"]').isVisible(), 'les treize modèles, repliés derrière « Choisir moi-même »');
  await p.click('.welcome-all > summary');
  ok(await p.locator('[data-act="tpl-add"][data-tpl="tableau"]').isVisible(), '« Choisir moi-même » les montre tous');
  for (const tpl of ['taches', 'ecriture', 'decouvertes']) { await p.click(`[data-act="tpl-add"][data-tpl="${tpl}"]`); await p.waitForTimeout(150); }
  ok(await p.locator('.welcome-all[open]').count() === 1, 'la liste reste dépliée d’un ajout à l’autre');
  const n3 = await nav(); ok(['Tâches', 'Écriture', 'À découvrir'].every(x => n3.includes(x)), 'trois modules ajoutés, visibles dans la navigation');
  ok((await main()).includes('Tirer une petite tâche au sort'), 'avec un module de tâches, le tirage au sort apparaît');
  await p.click('[data-act="tpl-add"][data-tpl="protocole"]');
  await p.fill('#form [name="name"]', 'Natation');
  await p.fill('#form [name="weeks"]', '8');
  await p.fill('#form [name="perWeek"]', '2');
  await p.fill('#form [name="unitLabel"]', 'longueurs');
  await p.click('#form button[value="save"]');
  await p.waitForFunction(() => !!JSON.parse(localStorage.getItem('selene-site-v1')).modules.natation);
  ok((await nav()).includes('Natation'), 'le programme porte la pratique choisie');
  for (const tpl of ['budget', 'rappels']) await p.click(`[data-act="tpl-add"][data-tpl="${tpl}"]`);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  ok(saved.modules.natation.config.weeks === 8 && saved.modules.natation.config.perWeek === 2 && saved.modules.natation.config.unitLabel === 'longueurs', 'les réglages choisis sont enregistrés');
  ok(saved.modules.budget.config.envelopes.length === 0 && saved.modules.soins.config.types.length === 0, 'aucun budget ni soin imposé');
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

  console.log('une réponse à la question');
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-act="welcome-path"][data-path="ecrire"]'); await p.waitForTimeout(200);
  const n = await nav(), apres = await main();
  ok(['Écriture', 'Sources', 'Tâches'].every(x => n.includes(x)), '« Un long texte » installe Écriture, Sources et Tâches');
  ok(!apres.includes('Composer ton espace'), 'et referme l’accueil');
  ok((await p.textContent('#toast')).includes('Pour commencer : Écriture, Sources, Tâches'), 'en disant ce qu’il a fait');
  const site = await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  ok(site.config.welcome === false && Object.keys(site.modules).length === 4, 'trois espaces de plus que la Capture, enregistrés, accueil fermé');
  await p.reload(); await p.waitForTimeout(300);
  ok(!(await main()).includes('Composer ton espace'), 'la question ne revient pas');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
