/* Scénario de navigateur : notes. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const v3 = { updatedAt: 10, schemaVersion: 3,
  config: { name: 'Selene', palette: 'nigredo', mode: 'auto', labels: {}, groups: {},
    modules: ['chantier', 'ecriture', 'moth', 'phidippus', 'budget', 'inbox'].map(id => ({ id, on: true })), assistant: { model: 'claude-sonnet-5', actions: true, share: {} } },
  modules: {
    ecriture: { type: 'cumul', label: 'Écriture', config: { unitLabel: 'mots', goal: 40000, title: '', categories: [], categoryLabel: 'Chapitre', scraps: true, scrapsLabel: 'Fragments' }, entries: [], scraps: [] },
    phidippus: { type: 'rappels', label: 'Phidippus', config: { subtitle: '', types: [{ id: 'repas', label: 'Repas', every: 6 }] }, entries: [] },
    moth: { type: 'collection', label: 'october.moth', config: { display: 'colonnes', statuses: ['Idée', 'Publié'], doneFrom: 1, fields: { title: 'Titre', tag: 'Thème' } }, entries: [] } },
  budget: { entries: [], envelopes: [] }, inbox: { items: [{ id: 'i1', text: 'une phrase', date: '2026-09-26' }, { id: 'i2', text: 'poster la mousse', date: '2026-09-26' }] } };
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(l => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', JSON.stringify(l)); }, v3);
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const nav = async () => (await p.textContent('#nav')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;
  const openAll = () => p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));

  console.log('migration + accueil');
  ok((await nav()).includes('Capture') && (await p.textContent('#nav a[href="#inbox"] .badge')).startsWith('2'), 'compteur de la boîte dans la navigation');
  ok((await main()).includes('2 éléments à trier'), 'lien « à trier » sur l’accueil');
  await p.fill('#capIn', 'idée de chapitre'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(200);
  ok((await data()).modules.inbox.entries.length === 3, 'capture rapide (Entrée) → boîte de réception');

  console.log('tri');
  await go('inbox'); const t = await main();
  ok(['→ Chantier', '→ Écriture', '→ october.moth', '→ Phidippus'].every(x => t.includes(x)), 'destinations proposées selon ce que chaque type accepte');
  await p.click('li:has-text("une phrase") [data-act="note-to"][data-to="ecriture"]'); await p.waitForTimeout(150);
  await p.click('li:has-text("poster la mousse") [data-act="note-to"][data-to="moth"]'); await p.waitForTimeout(150);
  let d = await data();
  ok(d.modules.ecriture.scraps.some(x => x.text === 'une phrase') && d.modules.moth.entries.some(x => x.title === 'poster la mousse') && d.modules.inbox.entries.length === 1, 'rangé dans le carnet de l’Écriture et dans october.moth');
  await p.click('li:has-text("idée de chapitre") [data-act="note-to"][data-to="chantier"]'); await p.waitForTimeout(200);
  ok(await p.isVisible('#dlg'), 'vers le Chantier : le formulaire de tâche s’ouvre pour compléter'); await p.click('#form button[value=cancel]'); await p.waitForTimeout(100);

  console.log('une autre boîte');
  await go('reglages'); await openAll(); await p.selectOption('#newModType', 'notes'); await p.fill('#newModName', 'Rêves'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await openAll(); await p.check('#mreg-reves [data-act="notes-inbox"]'); await p.waitForTimeout(200);
  d = await data(); ok(d.modules.reves.config.inbox && !d.modules.inbox.config.inbox, 'désigner « Rêves » retire la désignation de l’ancienne');
  await openAll(); ok(await p.isChecked('#mreg-reves [data-act="notes-inbox"]') && !(await p.isChecked('#mreg-inbox [data-act="notes-inbox"]')), 'et la case de l’ancienne se décoche à l’écran');
  await go('accueil'); await p.fill('#capIn', 'une forêt inversée'); await p.click('[data-act="cap-add"]'); await p.waitForTimeout(200);
  ok((await data()).modules.reves.entries[0].text === 'une forêt inversée', 'la capture rapide suit la nouvelle boîte');
  await go('reves'); await p.fill('#noteIn', 'deuxième rêve'); await p.press('#noteIn', 'Enter'); await p.waitForTimeout(150);
  ok((await main()).includes('deuxième rêve'), 'ajout direct dans une boîte (Entrée)');
  await go('reglages'); await openAll(); await p.uncheck('#mreg-reves [data-act="notes-inbox"]'); await p.waitForTimeout(150);
  await go('accueil'); ok((await main()).includes('Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans Réglages.') && !(await p.$('#capIn')), 'sans boîte : « Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans Réglages. », au lieu d’un champ muet');
  await go('reglages'); await openAll(); await p.check('#mreg-inbox [data-act="notes-inbox"]'); await p.waitForTimeout(150);
  await go('accueil'); ok(await p.isVisible('#capIn') && !(await main()).includes('Aucune boîte de réception'), 'la case recochée : le champ de capture revient');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
