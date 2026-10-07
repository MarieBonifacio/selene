/* Scénario de navigateur : l'en-tête sur téléphone (U4 de l'audit). Il tient sur une ligne (la lune, Selene, la date) ;
   le minuteur n'y paraît qu'entamé, et se lance depuis la feuille Capturer. Sur ordinateur, rien ne change : le
   minuteur reste dans la barre latérale. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
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

    // MOD-024 sur le jeu d'essai, sur téléphone, l'horloge simulée : le temps qui s'arrête en pause et repart, puis la
    // fin dans Yoga, l'anneau refermé, « Noter 15 min » et le pont de reprise ouvert, la séance notée.
    console.log('le jeu d’essai : pause, reprise, la fin dans Yoga (MOD-024)');
    const essai = donnee('jeu-essai.json');
    const cm = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block', timezoneId: 'Europe/Paris' });
    await cm.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
    const m = await cm.newPage(); m.on('pageerror', e => errs.push(e.message));
    await m.clock.install({ time: new Date('2026-10-07T10:00:00+02:00') });
    await m.goto(BASE + '/index.html#accueil'); await m.clock.runFor(500);
    const horloge = () => m.textContent('#clock');
    await m.tap('[data-act="sheet-capture"]'); await m.clock.runFor(300); await m.tap('[data-act="sheet-timer"]');
    await m.clock.runFor(60000); const t1 = await horloge();
    await m.tap('#timerBtn'); const pause = await m.textContent('#timerBtn');
    await m.clock.runFor(60000); const t2 = await horloge();
    await m.tap('#timerBtn'); const repris = await m.textContent('#timerBtn');
    await m.clock.runFor(60000); const t3 = await horloge();
    check(t1 === '14:00' && pause === 'Reprendre' && t2 === '14:00' && repris === 'Pause' && t3 === '13:00',
      `une minute : ${t1} ; « ${pause} », une minute de plus : ${t2}, arrêté ; « ${repris} », une minute : ${t3}, reparti (étape 2)`);
    const seances = () => m.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.yoga.entries.filter(e => e.date === '2026-10-07' && +e.value === 15).length);
    const avant = await seances();
    await m.evaluate(() => { location.hash = 'yoga'; }); await m.clock.runFor(500);
    await m.clock.runFor(13 * 60000 + 1000);
    const fin = await m.evaluate(() => { const h = document.querySelector('#halo'), i = document.querySelector('#bridgeIn'); return { anneau: !!h && h.classList.contains('done') && h.style.getPropertyValue('--p') === '1', toast: document.querySelector('#toast').textContent.replace(/\s+/g, ' ').trim(), pont: !!i && i.getBoundingClientRect().height > 0 && i.getAttribute('aria-label') === 'Prochain geste' && !!document.querySelector('.bridge [data-act="bridge-save"]') && !!document.querySelector('.bridge [data-act="bridge-close"]'), place: i ? i.placeholder : '', vue: location.hash }; });
    check(fin.anneau && fin.toast.includes('Noter 15 min') && fin.pont && fin.place === 'Le prochain geste, pour la prochaine fois…' && fin.vue === '#yoga',
      `la fin dans Yoga : l’anneau refermé, « ${fin.toast} », le champ du prochain geste ouvert (« ${fin.place} »), avec « Garder » et « plus tard » (étape 3, C25)`);
    await m.tap('#toast [data-act="undo"]'); await m.clock.runFor(300);
    check((await seances()) === avant + 1, `« Noter 15 min » : une séance de 15 min, le 7 octobre (${avant} → ${await seances()}) (étape 4)`);
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
