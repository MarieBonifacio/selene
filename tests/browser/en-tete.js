/* Scénario de navigateur : l'en-tête sur téléphone (U4 de l'audit). Il tient sur une ligne (la lune, Selene, la date) ;
   le minuteur n'y paraît qu'entamé, et se lance depuis la feuille Capturer. Sur ordinateur, rien ne change : le
   minuteur reste dans la barre latérale. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  const page = async viewport => {
    const ctx = await b.newContext({ viewport, serviceWorkers: 'block' });
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html#ecriture'); await p.waitForSelector('#main h2');
    return p;
  };
  try {
    console.log('téléphone');
    const p = await page({ width: 390, height: 844 });
    const haut = () => p.evaluate(() => Math.round(document.querySelector('.side').getBoundingClientRect().bottom));
    const h = await haut();
    check(h <= 84, `l’en-tête tient sur une ligne : ${h} px, 10 % de l’écran au plus (121 px avant)`);
    check(!(await p.isVisible('#timerBtn')) && !(await p.isVisible('#clock')), 'au repos, pas de minuteur dans l’en-tête');
    await p.click('[data-act="sheet-capture"]'); await p.waitForSelector('[data-act="sheet-timer"]');
    check((await p.textContent('[data-act="sheet-timer"]')).includes('Lancer le minuteur'), 'il se lance depuis Capturer');
    await p.click('[data-act="sheet-timer"]');
    await p.waitForFunction(() => document.querySelector('#clock').textContent !== '15:00');
    check(!(await p.evaluate(() => document.querySelector('#sheet').open)) && await p.isVisible('#clock') && (await p.textContent('#timerBtn')) === 'Pause', 'lancé : la feuille se ferme, le temps qui reste et « Pause » dans l’en-tête');
    check(await haut() === h && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sur la même ligne, sans défilement horizontal');
    await p.click('#timerBtn');
    check(await p.isVisible('#timerBtn') && (await p.textContent('#timerBtn')) === 'Reprendre', 'en pause : il reste là, « Reprendre »');
    await p.click('#timerReset');
    check(!(await p.isVisible('#timerBtn')), 'remis à zéro : il quitte l’en-tête');

    console.log('ordinateur');
    const d = await page({ width: 1280, height: 900 });
    check(await d.isVisible('#timerBtn') && (await d.textContent('#timerBtn')) === 'Lancer 15 min', 'le minuteur reste dans la barre latérale, au repos aussi');
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
