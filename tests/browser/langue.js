/* Scénario de navigateur : la langue de l'interface (src/app/i18n, docs/i18n.md). Lancé par tests/browser/run.js.
   - un appareil en anglais garde l'interface en français tant que l'anglais n'est pas proposé (READY_LANGS) ;
   - la pseudo-langue (config.lang = "qps") montre chaque texte passé par la traduction, entre ⟦ ⟧ ;
   - changer config.lang par le réglage générique (data-set) redessine tout de suite, sans recharger, et s'enregistre. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
(async () => {
  const b = await engine.launch(launchOptions);
  // Un appareil réglé en anglais américain : la langue que Selene suivrait si l'anglais était déjà proposé.
  const p = await b.newPage({ locale: 'en-US', viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const state = () => p.evaluate(() => ({ lang: document.documentElement.lang, phase: document.querySelector('.phase')?.textContent || '', dateline: document.querySelector('#dateline').textContent }));
  const FR_DAYS = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) /;

  console.log('appareil en anglais, anglais pas encore proposé');
  let s = await state();
  check(await p.evaluate(() => navigator.language) === 'en-US', 'le navigateur se dit bien en anglais');
  check(s.lang === 'fr', '<html lang="fr">');
  check(FR_DAYS.test(s.dateline), 'la date du jour reste en français : ' + s.dateline);
  check(/lune|croissant|quartier|gibbeuse/i.test(s.phase), 'la phase de la lune reste en français : ' + s.phase);
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(200);
  check(!(await p.$('select[data-set="config.lang"]')), 'pas de sélecteur de langue tant qu’une seule est proposée');

  console.log('pseudo-langue');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('selene-site-v1')); d.config.lang = 'qps'; localStorage.setItem('selene-site-v1', JSON.stringify(d)); location.hash = 'accueil'; });
  await p.reload(); await p.waitForTimeout(300);
  s = await state();
  check(s.lang === 'qps-ploc', '<html lang="qps-ploc">');
  check(/^⟦.+⟧$/.test(s.phase), 'la phase de la lune est passée par la traduction : ' + s.phase);
  check(FR_DAYS.test(s.dateline) && s.dateline.includes('⟦'), 'les dates gardent les formats de la langue source, le nom de la lune est marqué');
  check(/^⟦/.test(await p.getAttribute('#miniMoon svg', 'aria-label')), 'l’étiquette de la petite lune aussi (lecteurs d’écran)');

  console.log('retour à la langue de l’appareil, par le réglage générique, sans recharger');
  await p.evaluate(() => {
    const sel = document.createElement('select'); sel.dataset.set = 'config.lang'; sel.innerHTML = '<option value="">appareil</option><option value="qps">pseudo</option>';
    document.querySelector('#main').appendChild(sel); sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(200);
  s = await state();
  check(s.lang === 'fr' && !s.phase.includes('⟦'), 'l’interface redevient française aussitôt : ' + s.phase);
  await p.waitForTimeout(1300); // l'enregistrement part au bout d'une seconde
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.lang) === '', 'le choix est enregistré dans le compte (config.lang)');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
