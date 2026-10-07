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
  // A53 : tout le texte d'un champ sélectionné pour être remplacé, un rendu de fond, puis la frappe. La sélection se
  // repliait au début : la frappe s'insérait devant l'ancien texte (dehors.js, le 7 octobre : deux adresses collées).
  await p.evaluate(() => { location.hash = 'ecriture'; }); await p.waitForSelector('#scrapIn');
  await p.fill('#scrapIn', 'ancien texte');
  await p.evaluate(() => { const i = document.querySelector('#scrapIn'); i.focus(); i.select(); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  const sel = await p.evaluate(() => { const i = document.querySelector('#scrapIn'); return [i.selectionStart, i.selectionEnd]; });
  await p.keyboard.insertText('nouveau');
  const remplace = await p.inputValue('#scrapIn');
  check(remplace === 'nouveau' && sel.join('–') === '0–12', `tout sélectionné, un rendu de fond : la sélection reste (${sel.join('–')}), la frappe la remplace (« ${remplace} ») (A53)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
