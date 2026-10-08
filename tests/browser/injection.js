/* Scénario de navigateur : un identifiant de module et des nombres piégés (données corrompues, venues d'un
   serveur ou d'une vieille sauvegarde) ne doivent jamais exécuter de script. Puis TRV-008 sur le jeu d'essai : le piège
   saisi par les quatre gestes du cas, chaque vue parcourue, la palette, la recherche, la planche et son fichier ouvert
   dans le navigateur. Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const { engine, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const d = JSON.parse(fixture()), bad = 'x"><img src=z onerror="window.__pwned=1">';
  d.modules[bad] = { type: 'rappels', label: 'Piège', config: { subtitle: '', types: [{ id: 'fait', label: 'Fait', every: '<img src=z onerror="window.__pwned=2">' }] }, entries: [] };
  d.modules.kundalini.config.weeks = '<img src=z onerror="window.__pwned=3">';
  d.config.modules.push({ id: bad, on: true }); d.config.assistant.share[bad] = true; d.updatedAt = 1;
  await p.addInitScript(doc => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', doc); }, JSON.stringify(d));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  for (const h of ['accueil', 'reglages', 'kundalini', 'recherche', 'bilan']) { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(250); }
  await p.evaluate(() => document.querySelectorAll('details').forEach(x => x.open = true)); await p.waitForTimeout(200);
  check(await p.evaluate(() => window.__pwned === undefined), 'aucun script injecté exécuté');
  check(await p.evaluate(() => document.querySelectorAll('img[src=z]').length === 0), 'aucune balise injectée dans la page');

  // TRV-008 : une alerte, un message « TRV008 » à la console, une image ou un script injectés : autant d'échecs.
  console.log('le piège saisi à la main (TRV-008)');
  const PIEGE = "<img src=x onerror=alert('TRV008')>", SCRIPT = `"><script>alert('TRV008')</script>`, essai = donnee('jeu-essai.json');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const q = await ctx.newPage(), alertes = [], journal = [];
  q.on('pageerror', e => errs.push(e.message)); q.on('dialog', x => { alertes.push(x.message()); x.dismiss().catch(() => {}); });
  q.on('console', m => { if (m.text().includes('TRV008')) journal.push(m.text()); });
  const settle = () => q.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const vers = async (h, sel) => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForFunction(x => location.hash === '#' + x, h); await q.waitForSelector(sel, { state: 'attached' }); await settle(); };
  const injecte = () => q.evaluate(() => document.querySelectorAll('img[src="x"]').length + [...document.scripts].filter(s => s.textContent.includes('TRV008')).length);
  // Une vue lue : son texte, et ce qui y a été injecté, compté là, avant d'en partir.
  let inj1 = 0;
  const lu = async h => { await vers(h, '#main'); inj1 += await injecte(); return (await q.textContent('#main')).replace(/\s+/g, ' '); };
  await q.goto(BASE + '/index.html#accueil'); await q.waitForSelector('#capIn');
  // Étape 1 : le piège capturé ; une tâche intitulée par la seconde donnée ; un motif nommé par le piège ; « Carnet » renommé.
  await q.fill('#capIn', PIEGE); await q.click('[data-act="cap-add"]');
  await vers('chantier', '[data-act="task-new"]'); await q.click('[data-act="task-new"]'); await q.waitForFunction(() => document.querySelector('#dlg').open);
  await q.fill('#form [name="title"]', SCRIPT); await q.click('#form button[value="save"]'); await q.waitForFunction(() => !document.querySelector('#dlg').open);
  await vers('motifs', '[data-act="col-new"]'); await q.click('[data-act="col-new"]'); await q.waitForFunction(() => document.querySelector('#dlg').open);
  await q.fill('#form [name="title"]', PIEGE); await q.click('#form button[value="save"]'); await q.waitForFunction(() => !document.querySelector('#dlg').open);
  await vers('reglages', 'input[data-act="mod-label"][value="Carnet"]'); await q.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  const carnet = q.locator('input[data-act="mod-label"][value="Carnet"]'); await carnet.fill(PIEGE); await carnet.press('Tab'); await settle();
  const boite1 = await lu('inbox'), chantier1 = await lu('chantier'), motifs1 = await lu('motifs'), nav1 = await q.textContent('#nav');
  check(boite1.includes(PIEGE) && chantier1.includes(SCRIPT) && motifs1.includes(PIEGE) && nav1.includes(PIEGE) && !inj1 && !alertes.length,
    'la capture, la tâche, le motif et « Carnet » renommé : chacun affiché tel quel, chevrons visibles ; aucune image, aucun script, aucune alerte (TRV-008, étape 1)');
  // Étape 2 : chaque vue, la navigation, la palette, la recherche, le Bilan, la planche.
  const vues = [];
  for (const h of ['accueil', 'inbox', 'chantier', 'motifs', 'bilan', 'bilan/planche']) { await vers(h, '#main'); vues.push(`${h} ${await injecte()}`); }
  await vers('accueil', '#capIn'); await q.keyboard.press('Control+k'); await q.waitForSelector('#palIn', { state: 'visible' }); await q.keyboard.type('TRV008');
  await q.waitForFunction(() => document.querySelector('#palList').textContent.includes('TRV008'), null, { timeout: 5000 }).catch(() => {});
  const palette2 = await q.textContent('#palList'), palInj = await injecte(); await q.keyboard.press('Escape');
  await vers('recherche', '#searchIn'); await q.fill('#searchIn', 'TRV008');
  await q.waitForFunction(() => document.querySelector('#main').textContent.includes('TRV008'), null, { timeout: 5000 }).catch(() => {});
  const recherche2 = (await q.textContent('#main')).replace(/\s+/g, ' '), rechInj = await injecte();
  check(vues.every(v => v.endsWith(' 0')) && palette2.includes(PIEGE) && !palInj && recherche2.includes(PIEGE) && recherche2.includes(SCRIPT) && !rechInj && !alertes.length && !journal.length,
    `parcourues : ${vues.map(v => v.split(' ')[0]).join(', ')}, la palette (« TRV008 » : le piège en texte), la recherche (le piège et la tâche en texte) ; aucune image, aucun script, aucune alerte, rien à la console (étape 2)`);
  // Étape 3 : le fichier de la planche, ouvert dans le navigateur.
  await vers('bilan/planche', '[data-act="planche-dl"]');
  const [dl] = await Promise.all([q.waitForEvent('download'), q.click('[data-act="planche-dl"]')]);
  const fichier = fs.readFileSync(await dl.path(), 'utf8'), f = await ctx.newPage(), alertesF = [];
  f.on('dialog', x => { alertesF.push(x.message()); x.dismiss().catch(() => {}); });
  await f.setContent(fichier, { waitUntil: 'load' });
  const vu3 = (await f.textContent('body')).replace(/\s+/g, ' '), inj3 = await f.evaluate(() => document.querySelectorAll('img[src="x"], script').length);
  check(vu3.includes(PIEGE) && !inj3 && !alertesF.length, `le fichier de la planche (${dl.suggestedFilename()}) ouvert : le piège y est du texte ; ni image, ni script, aucune alerte (étape 3)`);
  await f.close(); await ctx.close();
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
