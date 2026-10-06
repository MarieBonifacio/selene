/* Scénario de navigateur : budget. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const v4 = { updatedAt: 10, schemaVersion: 4,
  config: { name: 'Selene', palette: 'nigredo', mode: 'auto', labels: {}, groups: { budget: { on: true, by: 'cat', sort: 'name', hideDone: false, title: '' } },
    modules: ['budget', 'inbox'].map(id => ({ id, on: true })), assistant: { model: 'claude-sonnet-5', actions: true, share: {} } },
  modules: { inbox: { type: 'notes', label: 'Capture', config: { inbox: true, description: '', placeholder: '…' }, entries: [] } },
  budget: { entries: [{ id: 'b1', type: 'dépense', amount: 120, cat: 'Courses', note: 'marché', date: `${ym}-03` }, { id: 'b2', type: 'revenu', amount: 2000, cat: '', note: 'salaire', date: `${ym}-01` }],
    envelopes: [{ id: 'v1', name: 'Courses', limit: 300 }] } };
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(l => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', JSON.stringify(l)); }, v4);
  await p.goto(BASE + '/index.html#budget'); await p.waitForTimeout(300);
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;
  const openAll = () => p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  let t = await main();
  ok(t.includes('2 000,00 €') && t.includes('120,00 €') && t.includes('1 880,00 €'), 'revenus, dépenses et solde du mois migrés');
  ok(t.includes('Courses') && t.includes('40 %'), 'jauge de l’enveloppe (120 / 300)');
  await p.fill('#bAmt', '30'); await p.fill('#bCat', 'Courses'); await p.fill('#bNote', 'pain'); await p.click('[data-act="bud-add"]'); await p.waitForTimeout(200);
  ok((await main()).includes('50 %'), 'ajout d’une opération → jauge à jour');
  await p.click('[data-act="bud-month"][data-d="-1"]'); await p.waitForTimeout(150);
  ok((await main()).includes('Aucune opération ce mois-ci'), 'mois précédent');
  await p.click('[data-act="bud-month"][data-d="1"]'); await p.waitForTimeout(150);
  await p.click('.room:has-text("Courses")'); await p.waitForTimeout(150);
  ok(!(await main()).includes('salaire'), 'clic sur une enveloppe filtre les opérations');
  await p.click('.room:has-text("Courses")'); await p.waitForTimeout(150);
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(200); await openAll();
  const n = p.locator('#mreg-budget [data-act="env-name"]').first(); await n.fill('Marché'); await n.press('Tab'); await p.waitForTimeout(150);
  let d = await data(); ok(d.modules.budget.config.envelopes[0].name === 'Marché' && d.modules.budget.entries.filter(e => e.cat === 'Marché').length === 2, 'renommer l’enveloppe renomme ses opérations');
  await openAll(); await p.click('#mreg-budget [data-act="env-add"]'); await p.waitForTimeout(150);
  ok((await data()).modules.budget.config.envelopes.length === 2, 'ajout d’une enveloppe');
  await openAll(); await p.selectOption('#newModType', 'budget'); await p.fill('#newModName', 'Budget pro'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await p.evaluate(() => location.hash = 'budget-pro'); await p.waitForTimeout(200);
  ok((await main()).includes('Budget pro') && (await main()).includes('Aucune opération'), 'un second budget indépendant');
  await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(200);
  ok((await main()).includes('Ce mois-ci : 150,00 € dépensés'), 'résumé d’accueil fourni par le type');

  console.log('montants hors des clous (MOD-005)');
  await p.evaluate(() => location.hash = 'budget'); await p.waitForSelector('#bAmt');
  const ops = async () => (await data()).modules.budget.entries.length, n0 = await ops();
  await p.evaluate(() => { document.querySelector('#toast').textContent = ''; });
  await p.fill('#bAmt', '0'); await p.click('[data-act="bud-add"]');
  await p.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Un montant'), null, { timeout: 5000 }).catch(() => {});
  ok((await p.textContent('#toast')).includes('Un montant, même symbolique.') && (await ops()) === n0, 'un montant nul : refusé, et dit');
  await p.fill('#bAmt', '-5'); await p.fill('#bCat', 'Courses'); await p.click('[data-act="bud-add"]');
  await p.waitForFunction(n => JSON.parse(localStorage.getItem('selene-site-v1')).modules.budget.entries.length > n, n0, { timeout: 5000 }).catch(() => {});
  const last = (await data()).modules.budget.entries.at(-1);
  ok((await ops()) === n0 + 1 && last.amount === 5 && last.type === 'dépense', 'un montant négatif : compté en valeur absolue, le sens vient du type choisi (dépense)');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
