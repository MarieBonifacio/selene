/* Scénario de navigateur : minuit, l'app restée ouverte (TRV-004 du cahier de recette, BL-10). Horloge simulée
   (page.clock) à 23 h 58, fuseau de Paris, sur une autre vue que l'accueil : passé minuit, l'en-tête suit le nouveau
   jour d'elle-même, une minute après au plus, sans geste ; un formulaire ouvert avant minuit garde ses valeurs, date
   comprise, et la page attend qu'il se ferme ; une capture faite après minuit porte la nouvelle date. Données
   synthétiques. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check, storeJSON } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Europe/Paris' });
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-10-06T23:58:30+02:00') });
    await p.goto(BASE + '/index.html#kundalini'); await p.click('[data-act="prog-start"]'); await p.waitForSelector('[data-act="entry-add"]');
    const line = () => p.textContent('#dateline');
    check(/6 octobre/.test(await line()), 'avant minuit, sur une autre vue que l’accueil : le 6 octobre');

    console.log('un formulaire ouvert avant minuit');
    await p.click('[data-act="entry-add"] >> nth=0'); await p.waitForSelector('#dlg[open]');
    check(await p.inputValue('#form [name="date"]') === '2026-10-06', 'sa date par défaut : le jour où il a été ouvert');
    await p.clock.runFor(150000); // 00 h 01 : deux minutes et demie plus tard
    check(await p.isVisible('#dlg[open]'), 'il reste ouvert');
    check(await p.inputValue('#form [name="date"]') === '2026-10-06', 'ses valeurs ne bougent pas sous les doigts');
    check(/6 octobre/.test(await line()), 'la page attend qu’il se ferme');

    console.log('fermé, la page suit d’elle-même');
    await p.click('#form button[value="cancel"]'); await p.waitForSelector('#dlg:not([open])', { state: 'attached' });
    await p.clock.runFor(61000);
    check(/mercredi 7 octobre/.test(await line()), 'une minute après au plus, sans geste : le 7 octobre');
    check(await p.isVisible('[data-act="entry-add"] >> nth=0'), 'sur la même vue');

    console.log('une capture après minuit');
    await p.evaluate(() => { location.hash = 'accueil'; }); await p.waitForSelector('#capIn');
    await p.fill('#capIn', 'Note de minuit passé'); await p.click('[data-act="cap-add"]');
    const note = (await storeJSON(p, 'selene-site-v1')).modules.inbox.entries.find(e => /Note de minuit passé/.test(JSON.stringify(e)));
    check(!!note && JSON.stringify(note).includes('2026-10-07') && !JSON.stringify(note).includes('2026-10-06'), 'elle porte la nouvelle date');

    console.log('le même instant, d’autres fuseaux (TRV-005, étapes 1 à 3)');
    // « Fuseau TRV-005 » gardée à Paris, le 7 octobre peu après minuit ; puis la même mémoire relue au même instant à
    // Los Angeles, où l'on est encore le 6 dans l'après-midi, et à Auckland, où il est déjà midi le 7.
    await p.fill('#capIn', 'Fuseau TRV-005'); await p.click('[data-act="cap-add"]');
    const fuseau = async q => (await storeJSON(q, 'selene-site-v1')).modules.inbox.entries.find(e => e.text === 'Fuseau TRV-005');
    for (let i = 0; i < 50 && !(await fuseau(p)); i++) await p.waitForTimeout(50);
    const jour = async q => { await q.evaluate(() => { location.hash = 'inbox'; }); const sel = 'li.item:has-text("Fuseau TRV-005") .jdate'; await q.waitForSelector(sel); return [(await fuseau(q) || {}).date, (await q.textContent(sel)).trim()]; };
    let [stocke, affiche] = await jour(p);
    check(stocke === '2026-10-07' && affiche === '7 oct.', `à Paris : la note datée du 7 octobre (${stocke}, « ${affiche} ») (étape 1)`);
    const memoire = await ctx.storageState(), instant = await p.evaluate(() => Date.now());
    for (const [tz, ville, etape, ici] of [['America/Los_Angeles', 'Los Angeles', 2, '6 octobre'], ['Pacific/Auckland', 'Auckland', 3, '7 octobre']]) {
      const c = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: tz, storageState: memoire });
      await c.addInitScript(() => { window.claude = { use: async () => null }; });
      const q = await c.newPage(); q.on('pageerror', e => errs.push(e.message));
      await q.clock.install({ time: instant }); await q.goto(BASE + '/index.html#inbox');
      [stocke, affiche] = await jour(q);
      const entete = await q.textContent('#dateline');
      check(stocke === '2026-10-07' && affiche === '7 oct.' && entete.includes(ici), `rechargée à ${ville}, où l’on est le ${ici} : la note reste du 7 octobre (« ${affiche} ») (étape ${etape})`);
      await c.close();
    }
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await b.close(); }
})();
