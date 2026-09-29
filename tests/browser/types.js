/* Scénario de navigateur : types. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(demo => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', demo); }, fixture());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;
  const openAll = () => p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  const create = async (type, name) => { await go('reglages'); await openAll(); await p.selectOption('#newModType', type); await p.fill('#newModName', name); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(150); };

  console.log('programme');
  await create('programme', 'Lecture');
  await go('lecture'); await p.click('[data-act="prog-start"]'); await p.waitForTimeout(150);
  await p.click('[data-act="entry-add"]'); await p.fill('#form [name=value]', '25'); await p.fill('#form [name=note]', 'chapitre 1'); await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  ok((await main()).includes('chapitre 1'), 'séance notée via le formulaire du type');
  await go('accueil'); ok((await main()).includes('Séance de lecture faite'), 'alerte d’accueil fournie par le type');
  ok((await main()).includes('Semaine 1 sur 12'), 'résumé fourni par le type');

  console.log('cumul');
  await create('cumul', 'Sport');
  await go('reglages'); await openAll();
  await p.click('#mreg-sport [data-act="cat-add"]'); await p.waitForTimeout(150); await openAll();
  await p.fill('#mreg-sport [data-act="cat-name"]', 'Course'); await p.press('#mreg-sport [data-act="cat-name"]', 'Tab'); await p.waitForTimeout(150); await openAll();
  await p.fill('#mreg-sport [data-act="cat-goal"]', '50'); await p.press('#mreg-sport [data-act="cat-goal"]', 'Tab'); await p.waitForTimeout(150);
  let s = await data(); ok(s.modules.sport.config.categories[0].name === 'Course' && s.modules.sport.config.categories[0].goal === 50, 'catégorie ajoutée, renommée, objectif (click + change du type)');
  await go('sport'); await p.fill('#cumIn', '10'); await p.selectOption('#cumCat', s.modules.sport.config.categories[0].id); await p.click('[data-act="entry-add"]'); await p.waitForTimeout(150);
  ok((await main()).includes('Course') && (await main()).includes('20 %'), 'ajout cumulatif + panneau par catégorie');

  console.log('rappels');
  await create('rappels', 'Plantes');
  await go('reglages'); await openAll();
  await p.click('#mreg-plantes [data-act="typ-add"]'); await p.waitForTimeout(150); await openAll();
  const every = p.locator('#mreg-plantes [data-act="typ-every"]').last(); await every.fill('3'); await every.press('Tab'); await p.waitForTimeout(150);
  s = await data(); ok(s.modules.plantes.config.types.at(-1).every === 3, 'type ajouté + fréquence (click + change du type)');
  await go('accueil'); ok((await main()).includes('Plantes : Nouveau type (jamais)'), 'alerte de rappel en retard sur l’accueil');
  await go('plantes'); await p.click('[data-act="entry-log"] >> nth=0'); await p.fill('#rapNote', 'feuilles jaunes'); await p.click('[data-act="entry-note"]'); await p.waitForTimeout(150);
  ok((await main()).includes('feuilles jaunes'), 'journal : fait aujourd’hui + note');

  console.log('écriture (instance d’origine, fragments)');
  await go('ecriture'); await p.fill('#scrapIn', 'une phrase'); await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(150);
  ok((await main()).includes('une phrase'), 'fragment ajouté');
  await p.click('[data-act="scrap-del"]'); await p.waitForTimeout(100); await p.click('#cdlg button[value=ok]', { timeout: 300 }).catch(() => {}); await p.waitForTimeout(150);
  ok(!(await main()).includes('une phrase'), 'fragment supprimé après confirmation');

  console.log('vues fixes');
  for (const h of ['chantier', 'moth', 'musique', 'budget', 'inbox', 'reglages']) { await go(h); ok((await main()).length > 50, `#${h} s’affiche`); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
