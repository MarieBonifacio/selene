/* Scénario de navigateur : collections. Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const legacy = { updatedAt: 10, schemaVersion: 2,
  config: { name: 'Selene', palette: 'nigredo', mode: 'auto', labels: {}, groups: { moth: { on: true, by: 'theme', sort: 'name', hideDone: false, title: '' } },
    modules: ['chantier', 'moth', 'musique', 'budget', 'inbox'].map(id => ({ id, on: true })), assistant: { model: 'claude-sonnet-5', actions: true, share: {} } },
  modules: {},
  moth: { posts: [{ id: 'p1', title: 'Le lichen', theme: 'Nigredo', due: '2026-10-01', status: 'Prêt', caption: 'Une légende' }] },
  musique: { albums: [{ id: 'a1', artist: 'Ulver', album: '', status: 'À écouter', note: '' }] },
  budget: { entries: [], envelopes: [] }, inbox: { items: [{ id: 'i1', text: 'Chelsea Wolfe', date: '2026-09-27' }] } };
(async () => {
  const b = await chromium.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(l => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', JSON.stringify(l)); }, legacy);
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;
  const openAll = () => p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  const save = async () => { await p.click('#form button[value=save]'); await p.waitForTimeout(200); };

  console.log('october.moth (colonnes)');
  await go('moth'); let t = await main();
  ok(t.includes('Le lichen') && t.includes('Nigredo') && t.includes('Une légende') && t.includes('Prêt 1'), 'post migré affiché dans sa colonne');
  await p.click('[data-act="col-new"]'); await p.fill('#form [name=title]', 'La mue'); await p.fill('#form [name=tag]', 'Albedo'); await save();
  ok((await main()).includes('La mue'), 'ajout via formulaire généré depuis la config');
  await p.click('.card:has-text("Le lichen") [data-act="col-move"][data-d="1"]'); await p.waitForTimeout(200);
  ok((await data()).modules.moth.entries.find(e => e.id === 'p1').status === 'Publié', 'avancer d’une colonne → Publié');
  ok((await p.textContent('#toast')).includes('Publié'), 'phrase de fin affichée');
  await p.click('.card:has-text("La mue") [data-act="col-edit"]'); await p.fill('#form [name=title]', 'La mue lente'); await save();
  ok((await main()).includes('La mue lente'), 'modification');
  await p.click('.room:has-text("Nigredo")'); await p.waitForTimeout(150);
  ok(!(await main()).includes('La mue lente'), 'clic sur un groupe filtre le tableau');
  await p.click('.room:has-text("Nigredo")'); await p.waitForTimeout(150);

  console.log('Musique (liste)');
  await go('musique'); t = await main();
  ok(t.includes('Ulver') && t.includes('préciser album'), 'album migré, sous-titre vide : « préciser album » (MusicBrainz)');
  await p.selectOption('[data-act="col-st"]', 'Retenu'); await p.waitForTimeout(150);
  ok((await data()).modules.musique.entries[0].status === 'Retenu', 'statut changé depuis la liste');
  await p.selectOption('[data-act="col-f"]', 'À écouter'); await p.waitForTimeout(150);
  ok((await main()).includes('Rien dans ce filtre'), 'filtre par statut');

  console.log('Capture → collection');
  await go('inbox'); await p.click('[data-act="note-to"][data-to="musique"]'); await p.waitForTimeout(150);
  ok((await data()).modules.musique.entries.some(e => e.title === 'Chelsea Wolfe'), 'capture rangée dans Musique');

  console.log('Réglages de la collection');
  await go('reglages'); await openAll();
  const blk = '#mreg-musique ';
  await p.fill(blk + '[data-set-mod="musique.fields.subtitle"]', ''); await p.press(blk + '[data-set-mod="musique.fields.subtitle"]', 'Tab'); await p.waitForTimeout(150); await openAll();
  await p.click(blk + '[data-act="st-add"]'); await p.waitForTimeout(150); await openAll();
  const last = p.locator(blk + '[data-act="st-name"]').last(); await last.fill('Abandonné'); await last.press('Tab'); await p.waitForTimeout(150); await openAll();
  await p.selectOption(blk + '[data-set-mod="musique.display"]', 'colonnes'); await p.waitForTimeout(150);
  let m = (await data()).modules.musique;
  ok(m.config.fields.subtitle === '' && m.config.statuses.at(-1) === 'Abandonné' && m.config.display === 'colonnes', 'champ masqué, statut ajouté + renommé, affichage en colonnes');
  await openAll(); await p.fill(blk + '[data-set-mod="musique.fields.title"]', ''); await p.press(blk + '[data-set-mod="musique.fields.title"]', 'Tab'); await p.waitForTimeout(150);
  ok((await data()).modules.musique.config.fields.title === 'Artiste', 'titre obligatoire : vidé → valeur conservée');
  await go('musique'); t = await main();
  ok(t.includes('Abandonné 0') && !t.includes('à préciser'), 'vue en colonnes avec le nouveau statut, sous-titre masqué');
  await go('reglages'); await openAll();
  await p.click(blk + '[data-si="3"] [data-act="st-del"]'); await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(150);
  ok((await data()).modules.musique.config.statuses.length === 3, 'statut supprimé après confirmation');
  await go('accueil'); ok((await main()).includes('Musique') && (await main()).includes('Retenu : 1'), 'résumé d’accueil fourni par le type');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
