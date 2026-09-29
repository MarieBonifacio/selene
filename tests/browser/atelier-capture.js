/* Scénario de navigateur : atelier-capture. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.ecriture.config.categories = [{ id: 'c1', name: 'Prologue', goal: 0 }, { id: 'c2', name: 'La forêt', goal: 0 }];
(async () => {
  const b = await engine.launch(launchOptions);
  const ctx = await b.newContext({ acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;

  console.log('atelier d’écriture');
  await go('ecriture'); await p.fill('#scrapIn', 'Le brouillard monte.'); await p.selectOption('#scrapCat', 'c2'); await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(150);
  await p.fill('#scrapIn', 'Une autre phrase.'); await p.waitForTimeout(50);
  ok((await p.inputValue('#scrapCat')) === 'c2', 'le chapitre du dernier fragment est présélectionné');
  await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(150);
  ok((await data()).modules.ecriture.scraps.filter(f => f.category === 'c2').length === 2, 'fragments rattachés au chapitre');
  await p.selectOption('li:has-text("Une autre phrase") [data-act="scrap-cat"]', 'c1'); await p.waitForTimeout(150);
  ok((await data()).modules.ecriture.scraps.find(f => f.text === 'Une autre phrase.').category === 'c1', 'déplacer un fragment vers un autre chapitre');
  await p.selectOption('[data-act="scrap-f"]', 'c1'); await p.waitForTimeout(150);
  ok((await main()).includes('Une autre phrase') && !(await main()).includes('Le brouillard monte'), 'filtre par chapitre');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="scrap-md"]')]);
  const md = require('fs').readFileSync(await dl.path(), 'utf8');
  ok(dl.suggestedFilename().endsWith('.md') && md.includes('## La forêt\n\nLe brouillard monte.') && md.includes('## Prologue\n\nUne autre phrase.'), `export Markdown (${dl.suggestedFilename()})`);
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.click('#mreg-ecriture [data-ci="0"] [data-act="cat-del"]'); await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(150);
  ok(!(await data()).modules.ecriture.scraps.some(f => f.category === 'c1'), 'chapitre supprimé : ses fragments redeviennent « hors chapitre »');

  console.log('capture reconnue');
  await go('accueil'); await p.fill('#capIn', '12,50 € courses du marché'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(150);
  ok((await p.textContent('#toast')).includes('12,50') && (await p.textContent('#toast')).includes('Courses'), 'bandeau : « 12,50 € en dépense dans Budget (Courses) ? »');
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(150);
  let d = await data();
  ok(d.modules.budget.entries.some(e => e.amount === 12.5 && e.cat === 'Courses') && d.modules.inbox.entries.length === 0, 'rangé, et retiré de la boîte');
  await p.fill('#capIn', 'Phidippus : toile neuve'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(7000); // le bandeau a disparu
  await go('inbox');
  ok((await main()).includes('Ranger : « toile neuve » dans Phidippus'), 'la proposition reste dans la boîte après le bandeau');
  await p.click('[data-act="note-file"]'); await p.waitForTimeout(150);
  d = await data(); ok(d.modules.phidippus.entries.some(e => e.note === 'toile neuve') && !d.modules.inbox.entries.length, 'rangé depuis la boîte');
  await go('accueil'); await p.fill('#capIn', 'acheter du pain'); await p.press('#capIn', 'Enter'); await p.waitForTimeout(150);
  ok((await p.textContent('#toast')).includes('Gardé'), 'une note ordinaire : juste gardée');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
