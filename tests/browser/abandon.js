/* Scénario de navigateur : abandonner une tâche (MOD-028). Sur le jeu d'essai, téléphone, l'horloge figée : la tâche
   quitte « En retard » pour « Abandonnées », avec son motif ; son coût ne pèse plus sur le budget à venir ; l'accueil ne
   la compte plus en retard ; le Bilan compte le renoncement ; « Annuler » puis « reprendre » la rendent.
   Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, donnee, check } = require('./helpers');
const essai = donnee('jeu-essai.json');
const TITRE = 'Repeindre la rambarde du balcon', MOTIF = 'Le syndic repeint tout le balcon au printemps.';
(async () => {
  const b = await engine.launch(launchOptions);
  const cx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'fr-FR', serviceWorkers: 'block' });
  await cx.clock.setFixedTime(new Date('2026-10-17T10:00:00'));
  await cx.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const p = await cx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(300); };
  const txt = async sel => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
  const section = nom => p.evaluate(n => { const s = [...document.querySelectorAll('#main section')].find(x => x.querySelector('h3') && x.querySelector('h3').textContent.startsWith(n)); return s ? s.textContent.replace(/\s+/g, ' ') : null; }, nom);
  const tache = () => p.evaluate(t => JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.entries.find(x => x.title === t), TITRE);
  // Ce que le budget prévoit encore pour les tâches en cours, et la ligne de Chantier sur l'accueil, avant tout geste.
  await p.goto(BASE + '/index.html#budget'); await p.waitForSelector('#main > *');
  const aVenir = async () => { const m = (await txt('#main')).match(/estiment encore ([\d\s ,]+) €/); return m ? +m[1].replace(/[\s  ]/g, '').replace(',', '.') : 0; };
  const avant = await aVenir();
  await go('accueil'); const retardAvant = +((await txt('#main')).match(/(\d+) en retard/) || [0, 0])[1];

  console.log('abandonner une tâche');
  await go('chantier');
  const li = p.locator('#main li[data-task]', { hasText: TITRE }).first();
  await li.locator('[data-act="task-open"]').tap(); await p.waitForTimeout(150);
  await li.locator('[data-act="task-drop"]').tap(); await p.waitForSelector('#dlg[open]');
  check((await txt('#dlg h2')) === 'Abandonner la tâche' && (await txt('#dlg')).includes('Elle quitte les listes sans compter comme faite'), 'le formulaire dit ce qui va se passer (étape 1)');
  await p.fill('#dlg [name="why"]', MOTIF); await p.locator('#dlg button[value="save"]').tap();
  // L'abandon s'écrit dans l'événement « close » de la boîte, envoyé par la file d'attente : on attend l'état (A52, A74).
  await p.waitForFunction(t => (JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.entries.find(x => x.title === t) || {}).dropped, TITRE, { timeout: 10000 }).catch(() => {});
  check((await txt('#toast')).startsWith(`« ${TITRE} » abandonnée. Elle reste sous « Abandonnées ».`), 'la bulle le dit, avec « Annuler » (étape 2)');
  const ab = await section('Abandonnées');
  check(!!ab && ab.includes(TITRE) && ab.includes(`le 17 oct. · ${MOTIF}`), `une section « Abandonnées », datée, avec le motif (étape 2) : ${ab}`);
  check(!((await section('Échéances')) || '').includes(TITRE), 'la tâche a quitté les échéances (étape 2)');
  await go('budget');
  const apres = await aVenir();
  check(Math.abs(avant - apres - 120) < 0.01, `son coût ne pèse plus sur le budget à venir : ${avant} € → ${apres} € (étape 3)`);
  await go('accueil');
  const retardApres = +((await txt('#main')).match(/(\d+) en retard/) || [0, 0])[1];
  check(retardApres === retardAvant - 1, `l’accueil ne la compte plus en retard : ${retardAvant} → ${retardApres} (étape 3)`);
  await go('bilan');
  check((await txt('#main')).includes('1 abandonnée'), 'le Bilan compte le renoncement (étape 4)');

  console.log('« Annuler », puis « reprendre »');
  await go('chantier'); await p.waitForTimeout(100);
  await p.locator('#main li[data-task]', { hasText: TITRE }).first().locator('[data-act="task-resume"]').tap(); await p.waitForTimeout(200);
  check((await txt('#toast')).startsWith(`« ${TITRE} » reprend du service.`) && !(await tache()).dropped && ((await section('Échéances')) || '').includes(TITRE), '« reprendre » la rend aux échéances (étape 5)');
  // « Annuler » de la bulle : celle du premier abandon est partie pendant les visites ; on abandonne de nouveau pour la tenir.
  const li2 = p.locator('#main li[data-task]', { hasText: TITRE }).first();
  if (!(await li2.locator('[data-act="task-drop"]').isVisible())) await li2.locator('[data-act="task-open"]').tap();
  await li2.locator('[data-act="task-drop"]').tap(); await p.waitForSelector('#dlg[open]');
  await p.locator('#dlg button[value="save"]').tap();
  await p.waitForFunction(() => document.querySelector('#toast [data-act="undo"]'), null, { timeout: 10000 }).catch(() => {});
  await p.locator('#toast [data-act="undo"]').tap(); await p.waitForTimeout(200);
  const t = await tache();
  check(!t.dropped && ((await section('Échéances')) || '').includes(TITRE) && (await section('Abandonnées')) === null, '« Annuler » la remet telle qu’elle était, la section disparaît (étape 6)');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
