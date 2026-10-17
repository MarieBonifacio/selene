/* Scénario de navigateur : « J'attends une réponse » sur une tâche (MOD-027, E1 de l'audit du 12 octobre 2026). Sur le
   jeu d'essai, téléphone, l'horloge figée : la tâche quitte les échéances pour « En attente », revient sur l'accueil le
   jour de la relance, se relance, puis « réponse reçue » la rend aux échéances, et « Annuler » la remet en attente.
   Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, donnee, check } = require('./helpers');
const essai = donnee('jeu-essai.json');
const TITRE = 'Repeindre la rambarde du balcon';
(async () => {
  const b = await engine.launch(launchOptions);
  const cx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'fr-FR', serviceWorkers: 'block' });
  await cx.clock.setFixedTime(new Date('2026-10-17T10:00:00'));
  await cx.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const p = await cx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#chantier'); await p.waitForSelector('#main [data-task]');
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(300); };
  const txt = async sel => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
  const tache = () => p.evaluate(t => JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.entries.find(x => x.title === t), TITRE);
  const section = nom => p.evaluate(n => { const s = [...document.querySelectorAll('#main section')].find(x => x.querySelector('h3') && x.querySelector('h3').textContent.startsWith(n)); return s ? s.textContent.replace(/\s+/g, ' ') : null; }, nom);

  console.log('mettre une tâche en attente');
  const li = p.locator('#main li[data-task]', { hasText: TITRE }).first();
  await li.locator('[data-act="task-open"]').tap(); await p.waitForTimeout(150);
  await li.locator('[data-act="task-wait"]').tap(); await p.waitForSelector('#dlg[open]');
  check((await txt('#dlg h2')) === 'J\'attends une réponse' && (await txt('#dlg')).includes('La tâche sort des échéances et revient sur l\'accueil le jour de la relance.'), 'le formulaire dit ce qui va se passer (étape 1)');
  check(await p.inputValue('#dlg [name="next"]') === '2026-10-31', 'relance proposée dans quatorze jours, le 31 octobre (étape 1)');
  await p.fill('#dlg [name="who"]', 'le syndic'); await p.fill('#dlg [name="next"]', '2026-10-20');
  await p.locator('#dlg button[value="save"]').tap(); await p.waitForTimeout(300);
  check((await txt('#toast')).startsWith(`« ${TITRE} » attend une réponse. Elle revient le jour de la relance.`), 'la bulle le dit, avec « Annuler » (étape 2)');
  const attente = await section('En attente');
  check(!!attente && attente.includes(TITRE) && attente.includes('depuis le 17 oct. · chez le syndic · relancer le 20 oct.'), `une section « En attente » : qui, depuis quand, quand relancer (étape 2) : ${attente}`);
  check(!(await section('Échéances')).includes(TITRE), 'la tâche a quitté les échéances (étape 2)');
  await go('accueil');
  check((await txt('#main')).includes('1 en attente'), 'l’accueil compte la tâche en attente (étape 3)');
  check(!(await txt('#main')).includes('à relancer'), 'avant le 20, aucune relance (étape 3)');

  console.log('le jour de la relance');
  await cx.clock.setFixedTime(new Date('2026-10-20T10:00:00')); await p.reload(); await p.waitForSelector('#main > *'); await p.waitForTimeout(300);
  const alerte = p.locator('#main li.alert', { hasText: TITRE });
  check(await alerte.count() === 1 && (await alerte.textContent()).includes(`« ${TITRE} » : à relancer (Chantier)`), 'l’accueil la ramène : « à relancer » (étape 4)');
  await alerte.locator('[data-act="task-relaunch"]').tap(); await p.waitForTimeout(300);
  check((await txt('#toast')).startsWith('Relancé. Prochaine relance le 3 nov.'), 'relancé : la prochaine relance dans quatorze jours (étape 4)');
  check(await p.locator('#main li.alert', { hasText: TITRE }).count() === 0, 'l’alerte disparaît (étape 4)');
  const w = (await tache()).wait;
  check(w && w.next === '2026-11-03' && w.log.length === 1 && w.log[0].date === '2026-10-20', 'la relance est consignée et datée (étape 4)');

  console.log('réponse reçue, puis « Annuler »');
  await go('chantier');
  check((await section('En attente')).includes('relancé 1 fois'), 'la section compte la relance (étape 5)');
  await p.locator('#main section', { hasText: 'En attente' }).locator('[data-act="task-answer"]').tap(); await p.waitForTimeout(300);
  check((await txt('#toast')).startsWith(`Réponse reçue : « ${TITRE} » revient dans les échéances.`), 'la bulle le dit (étape 5)');
  check(await section('En attente') === null && (await section('Échéances')).includes(TITRE), 'la tâche est revenue dans les échéances, la section a disparu (étape 5)');
  await p.locator('#toast [data-act="undo"]').tap(); await p.waitForTimeout(300);
  check(((await section('En attente')) || '').includes(TITRE) && (await tache()).wait.who === 'le syndic', '« Annuler » la remet en attente, telle quelle (étape 6)');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
