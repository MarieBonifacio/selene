/* Scénario de navigateur : paliers d'un programme (critères rédigés et cochés à la main). Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
const demo = JSON.parse(fixture());
demo.modules.kundalini.config.start = '2026-01-05';
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const openAll = () => p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));

  console.log('écrire un palier et ses critères');
  // Chaque action de réglage redessine tout le panneau (ses <details> se referment tous) : on les rouvre après
  // chaque geste, comme sur un vrai appareil où l'on retoucherait l'écran entre deux frappes.
  await go('reglages'); await openAll();
  await p.click('#mreg-kundalini [data-act="tier-add"]'); await p.waitForTimeout(150); await openAll();
  await p.fill('#mreg-kundalini [data-act="tier-name"]', 'Souffle'); await p.press('#mreg-kundalini [data-act="tier-name"]', 'Tab'); await p.waitForTimeout(150); await openAll();
  await p.click('#mreg-kundalini [data-act="crit-add"]'); await p.waitForTimeout(150); await openAll();
  await p.fill('#mreg-kundalini [data-act="crit-text"]', '12 séances à 20 min'); await p.press('#mreg-kundalini [data-act="crit-text"]', 'Tab'); await p.waitForTimeout(150);
  await go('kundalini'); let t = await main();
  check(t.includes('Souffle') && t.includes('12 séances à 20 min'), 'le palier et son critère apparaissent dans le module');
  check(t.includes('0 sur 1 critère coché'), 'rien de coché au départ');

  console.log('cocher ne fait rien avancer');
  await p.check('li:has-text("12 séances à 20 min") input[type=checkbox]'); await p.waitForTimeout(200);
  t = await main();
  check(t.includes('1 sur 1 critère coché. Tous cochés.'), 'le compte se met à jour');
  check(!(await data()).modules.kundalini.config.tiers[0].advancedAt, 'cocher un critère ne fait toujours pas avancer le palier');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/paliers.png`, fullPage: true });

  console.log('passer au palier suivant, sans module Décisions');
  await p.click('[data-act="tier-advance"]'); await p.waitForTimeout(200);
  check((await p.textContent('#toast')).includes('Palier « Souffle » atteint.'), 'un simple message, sans formulaire à remplir');
  check((await data()).modules.kundalini.config.tiers[0].advancedAt === new Date().toISOString().slice(0, 10), 'daté aujourd’hui');
  t = await main();
  check(t.includes('« Souffle » atteint le'), 'l’historique du palier franchi reste visible');

  console.log('avec un module Décisions : le passage propose une décision à compléter');
  await go('reglages'); await openAll();
  await p.click('#mreg-kundalini [data-act="tier-add"]'); await p.waitForTimeout(150); await openAll();
  await p.selectOption('#newModType', 'tpl:decisions'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await go('kundalini');
  await p.click('[data-act="tier-advance"]'); await p.waitForTimeout(200);
  check(await p.isVisible('#dlg'), 'un formulaire de décision s’ouvre, prérempli');
  check((await p.inputValue('#form [name=title]')).includes('Palier'), 'le titre suggère la décision, sans l’imposer');
  check((await data()).modules.decisions.entries.length === 0, 'rien n’est enregistré tant que le formulaire n’est pas validé');
  await p.fill('#form [name=text]', 'Rythme cardiaque stable, respiration posée sur 20 min.');
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  check((await data()).modules.decisions.entries[0].text.includes('Rythme cardiaque stable'), 'la décision complétée est bien enregistrée');

  console.log('supprimer un palier (confirmation)');
  await go('reglages'); await openAll();
  check(await p.locator('#mreg-kundalini [data-act="tier-del"]').count() >= 1, 'un palier peut être supprimé');
  await p.click('#mreg-kundalini [data-act="tier-del"]'); await p.waitForTimeout(150);
  check(await p.isVisible('#cdlg'), 'confirmation avant suppression');
  await p.click('#cdlg button[value=cancel]'); await p.waitForTimeout(150);
  const before = (await data()).modules.kundalini.config.tiers.length;
  await p.click('#mreg-kundalini [data-act="tier-del"]'); await p.waitForTimeout(150);
  await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(150);
  check((await data()).modules.kundalini.config.tiers.length === before - 1, 'confirmée, la suppression a lieu');

  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
