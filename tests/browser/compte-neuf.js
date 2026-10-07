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
  const reponses = await p.$$eval('[data-act="welcome-path"]', bs => bs.map(x => `${x.querySelector('b').textContent} : ${x.querySelector('small').textContent}`));
  ok(reponses.join(' | ') === "Un long texte : Écriture · Sources · Tâches | Mes journées : Tâches · Carnet · Soins | Ce que je lis, écoute, regarde : À découvrir · Musique · Carnet",
    `chacune dit les trois espaces qu’elle installe (${reponses.join(' | ')})`);
  ok(!await p.locator('[data-act="tpl-add"][data-tpl="tableau"]').isVisible(), 'les treize modèles, repliés derrière « Choisir moi-même »');
  await p.click('.welcome-all > summary');
  ok(await p.locator('[data-act="tpl-add"][data-tpl="tableau"]').isVisible(), '« Choisir moi-même » les montre tous');
  for (const tpl of ['taches', 'ecriture', 'decouvertes']) { await p.click(`[data-act="tpl-add"][data-tpl="${tpl}"]`); await p.waitForTimeout(150); }
  ok(await p.locator('.welcome-all[open]').count() === 1, 'la liste reste dépliée d’un ajout à l’autre');
  const n3 = await nav(); ok(['Tâches', 'Écriture', 'À découvrir'].every(x => n3.includes(x)), 'trois modules ajoutés, visibles dans la navigation');
  ok((await main()).includes('Tirer une petite tâche au sort'), 'avec un module de tâches, le tirage au sort apparaît');
  // ESP-004 : le formulaire et ses quatre libellés ; « Annuler » ne crée rien ; neuf séances refusées, et dit ; deux, créé.
  const espaces = () => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('selene-site-v1')).modules).sort().join());
  const ouvert = () => p.waitForFunction(() => document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {});
  const avantNatation = await espaces();
  await p.click('[data-act="tpl-add"][data-tpl="protocole"]'); await ouvert();
  const champs = await p.evaluate(() => [document.querySelector('#form h2').textContent.trim(), [...document.querySelectorAll('#form label')].map(l => l.firstChild.textContent.trim())]);
  ok(champs[0] === 'Choisir ton sport ou ta pratique' && JSON.stringify(champs[1]) === JSON.stringify(['Nom du sport ou de la pratique', 'Durée en semaines (1 à 520, proposition modifiable)', 'Séances par semaine (1 à 7, proposition modifiable)', 'Unité suivie (min, km, longueurs…)']),
    `« Choisir ton sport ou ta pratique », et ses quatre libellés (${champs[1].join(' | ')})`);
  await p.click('#form button[value="cancel"]'); await p.waitForFunction(() => !document.querySelector('#dlg').open);
  ok((await espaces()) === avantNatation, '« Annuler » : aucun espace créé');
  const remplir = async seances => { await p.fill('#form [name="name"]', 'Natation'); await p.fill('#form [name="weeks"]', '8'); await p.fill('#form [name="perWeek"]', seances); await p.fill('#form [name="unitLabel"]', 'longueurs'); };
  await p.click('[data-act="tpl-add"][data-tpl="protocole"]'); await ouvert();
  await p.evaluate(() => { document.querySelector('#toast').textContent = ''; });
  await remplir('9'); await p.click('#form button[value="save"]');
  await p.waitForFunction(() => (document.querySelector('#toast').textContent || '').includes('Indique'), null, { timeout: 5000 }).catch(() => {});
  ok((await p.textContent('#toast')).trim() === 'Indique un nom, une unité, 1 à 520 semaines et 1 à 7 séances par semaine.' && (await espaces()) === avantNatation, 'neuf séances par semaine : « Indique un nom, une unité, 1 à 520 semaines et 1 à 7 séances par semaine. », rien de créé');
  await p.click('[data-act="tpl-add"][data-tpl="protocole"]'); await ouvert();
  await remplir('2'); await p.click('#form button[value="save"]');
  await p.waitForFunction(() => !!JSON.parse(localStorage.getItem('selene-site-v1')).modules.natation);
  ok((await nav()).includes('Natation'), 'le programme porte la pratique choisie');
  for (const tpl of ['budget', 'rappels']) await p.click(`[data-act="tpl-add"][data-tpl="${tpl}"]`);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  ok(saved.modules.natation.config.weeks === 8 && saved.modules.natation.config.perWeek === 2 && saved.modules.natation.config.unitLabel === 'longueurs' && !saved.modules.natation.config.start, 'les réglages choisis sont enregistrés, le protocole pas encore commencé');
  ok(saved.modules.budget.config.envelopes.length === 0 && saved.modules.soins.config.types.length === 0, 'aucun budget ni soin imposé');
  await p.click('[data-act="welcome-done"]'); await p.waitForTimeout(150);
  ok(!(await main()).includes('Composer ton espace'), '« C’est bon » referme le bloc');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:tableau'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  ok((await nav()).includes('Tableau de production'), 'création depuis un modèle dans Réglages (nom du modèle si vide)');
  await p.evaluate(() => location.hash = 'tableau-de-production'); await p.waitForTimeout(200);
  ok((await main()).includes('Idée') && (await main()).includes('Publié') && (await main()).includes('Nouvelle idée'), 'le modèle a réglé colonnes et bouton');

  console.log('les états vides d’un compte neuf');
  const vue = async id => { await p.evaluate(h => location.hash = h, id); await p.waitForTimeout(200); return main(); };
  const ids = await p.evaluate(() => { const m = JSON.parse(localStorage.getItem('selene-site-v1')).modules, k = t => Object.keys(m).find(x => t(m[x])); return { boite: k(x => x.type === 'notes' && x.config.inbox), taches: k(x => x.type === 'taches') }; });
  const vide = await vue(ids.taches);
  ok(vide.includes("Coche l'étoile d'une tâche.") && vide.includes("Plus rien ici. Soit c'est fini, soit tu as filtré trop fort."), 'un espace de tâches vide : « Coche l’étoile d’une tâche. » et « Plus rien ici. Soit c’est fini, soit tu as filtré trop fort. »');
  ok((await vue(ids.boite)).includes("Vide. Le silence d'une clairière, ou celui d'un cerveau."), 'la boîte vide : « Vide. Le silence d’une clairière, ou celui d’un cerveau. »');
  await vue('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:carnet'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  const carnet = await p.evaluate(() => { const m = JSON.parse(localStorage.getItem('selene-site-v1')).modules; return Object.keys(m).find(x => m[x].type === 'notes' && !m[x].config.inbox); });
  ok(!!carnet && (await vue(carnet)).includes("Rien pour l'instant."), 'un Carnet neuf : « Rien pour l’instant. »');
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

  // ESP-002, étapes 1 et 2, dans un navigateur neuf : les treize modèles, leur description, sans « Reprendre la main » ;
  // « Carnet » ajouté deux fois, deux Carnet dans la navigation, la liste toujours dépliée.
  console.log('choisir moi-même : les treize modèles (ESP-002)');
  const q = await (await b.newContext()).newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(() => { window.claude = { use: async () => null }; });
  await q.goto(BASE + '/index.html'); await q.waitForSelector('.welcome-all > summary');
  await q.click('.welcome-all > summary'); await q.waitForSelector('[data-act="tpl-add"][data-tpl="carnet"]');
  const modeles = await q.$$eval('.welcome-all [data-act="tpl-add"]', bs => bs.map(x => { const s = x.closest('.set'); return [s.querySelector('b').textContent.trim(), (s.querySelector('.hint') || {}).textContent || '', x.dataset.tpl]; }));
  const NOMS = ['Tâches', 'Protocole', 'Écriture', 'Budget', 'Tableau de production', 'À découvrir', 'Décisions', 'Motifs', 'Musique', 'Sources', 'Arc', 'Soins', 'Carnet'];
  ok(modeles.length === 13 && NOMS.every(n => modeles.some(([m]) => m === n)) && modeles.every(([, h]) => h.trim().length > 10) && !modeles.some(([m, , t]) => t === 'regulation' || m === 'Reprendre la main') && !(await q.textContent('.welcome-all')).includes('Reprendre la main'),
    `« Choisir moi-même » : ${modeles.length} modèles, chacun décrit (${modeles.map(([m]) => m).join(', ')}) ; pas « Reprendre la main » (ESP-002, étape 1)`);
  const carnets = () => q.$$eval('#nav a', as => as.filter(a => a.textContent.replace(/\s+/g, ' ').trim() === 'Carnet').length);
  for (let i = 0; i < 2; i++) { const n = await carnets(); await q.click('[data-act="tpl-add"][data-tpl="carnet"]'); await q.waitForFunction(n => [...document.querySelectorAll('#nav a')].filter(a => a.textContent.replace(/\s+/g, ' ').trim() === 'Carnet').length > n, n, { timeout: 5000 }).catch(() => {}); }
  ok((await carnets()) === 2 && (await q.locator('.welcome-all[open]').count()) === 1, `« Ajouter » deux fois sur Carnet : ${await carnets()} « Carnet » dans la navigation, la liste toujours dépliée (ESP-002, étape 2)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
