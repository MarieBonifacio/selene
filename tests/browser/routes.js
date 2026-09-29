/* Scénario de navigateur : chaque route s'affiche ; une route inconnue ou piégée ramène à l'accueil ;
   un module nommé comme une route fixe ne la masque pas. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  const text = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); return (await p.textContent('#main')).replace(/\s+/g, ' ').trim(); };
  for (const [h, expect] of [['chantier', 'Ajouter une tâche'], ['kundalini', 'Kundalini'], ['ecriture', 'Écriture'], ['phidippus', 'Phidippus'], ['moth', 'october.moth'], ['musique', 'Musique'], ['budget', 'Revenus'], ['inbox', 'Capture'], ['reglages', 'Réglages'], ['recherche', 'Chercher'], ['bilan', 'Bilan']])
    check((await text(h)).includes(expect), `#${h} s'affiche`);
  for (const h of ['constructor', 'nimportequoi', '__proto__']) check((await text(h)).includes('lune'), `#${h} ramène à l'accueil`);
  await text('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(x => x.open = true));
  await p.fill('#newModName', 'Réglages'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  const ids = await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.modules.map(m => m.id));
  check(ids.includes('reglages-2') && (await text('reglages')).includes('Réglages par module'), 'un module « Réglages » ne masque pas les Réglages');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
