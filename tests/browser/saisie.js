/* Scénario de navigateur : un rendu (une synchro qui arrive) ne doit pas effacer un réglage en cours de
   frappe ; la valeur est enregistrée en quittant le champ. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  await p.goto(BASE + '/index.html#reglages'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  const f = p.locator('#mreg-ecriture [data-set-mod="ecriture.title"]');
  await f.click(); await f.press('End'); await p.keyboard.type(' — brouillon');
  await p.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange'))); await p.waitForTimeout(150); // rendu forcé en pleine frappe
  check((await f.inputValue()).endsWith('— brouillon'), 'la saisie survit à un rendu');
  await f.press('Tab'); await p.waitForTimeout(150);
  check((await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.ecriture.config.title)).endsWith('— brouillon'), 'enregistrée en quittant le champ');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
