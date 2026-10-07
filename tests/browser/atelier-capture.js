/* Scénario de navigateur : atelier-capture. Lancé par tests/browser/run.js. */
const fs = require('node:fs');
const { engine, BASE, launchOptions, fixture, donnee, ouvrir, check } = require('./helpers');
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

  console.log('le jeu d’essai : chapitres, filtre, export, suppression (MOD-011)');
  // Un autre contexte : celui de la première partie a déjà son stockage (et plus de « Prologue »).
  const cq = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const q = await cq.newPage(); q.on('pageerror', e => errs.push(e.message));
  const essai = donnee('jeu-essai.json');
  await q.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const donneesQ = () => q.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const versQ = async (h, sel) => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForSelector(sel, { state: 'attached' }); };
  await ouvrir(q, BASE + '/index.html#ecriture', () => !!document.querySelector('#scrapCat'));
  // Le panneau « Par chapitre » : le compte de fragments de chaque chapitre.
  const panneau = () => q.evaluate(() => Object.fromEntries([...document.querySelectorAll('#main .rooms .room')].map(r => { const s = r.querySelectorAll('small'); return [s[0].textContent.trim(), s[1].textContent.trim()]; })));
  const avant = await panneau(), pre = await q.inputValue('#scrapCat');
  ok(pre === 'c2', `le champ de fragment présélectionne « La forêt », le chapitre du dernier fragment rattaché (« ${pre} ») (MOD-011, étape 1)`);
  await q.fill('#scrapIn', 'Le ruisseau coupe la lisière en deux.'); await q.selectOption('#scrapCat', 'c1'); await q.click('[data-act="scrap-add"]');
  await q.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.ecriture.scraps.some(s => s.text === 'Le ruisseau coupe la lisière en deux.'), null, { timeout: 5000 }).catch(() => {});
  await q.waitForFunction(() => /3 fragments/.test([...document.querySelectorAll('#main .rooms .room')].map(r => r.textContent).join()), null, { timeout: 5000 }).catch(() => {});
  const apres = await panneau(), ruisseau = (await donneesQ()).modules.ecriture.scraps.find(s => s.text === 'Le ruisseau coupe la lisière en deux.') || {};
  const ligne = await q.evaluate(() => { const li = [...document.querySelectorAll('#main li.item')].find(l => l.textContent.includes('Le ruisseau coupe')); return li ? li.querySelector('[data-act="scrap-cat"]').value : ''; });
  ok(ruisseau.category === 'c1' && ligne === 'c1' && /· 2 fragments$/.test(avant.Prologue) && /· 3 fragments$/.test(apres.Prologue), `ajouté au Prologue, il y apparaît rattaché ; le panneau : « ${avant.Prologue} », puis « ${apres.Prologue} » (MOD-011, étape 2)`);
  await q.selectOption('[data-act="scrap-f"]', 'c2');
  await q.waitForFunction(() => ![...document.querySelectorAll('#main li.item')].some(l => l.textContent.includes('Le ruisseau coupe')), null, { timeout: 5000 }).catch(() => {});
  const filtres = await q.$$eval('#main li.item [data-act="scrap-cat"]', xs => xs.map(x => x.value));
  ok(filtres.length === 2 && filtres.every(v => v === 'c2'), `« Par chapitre » sur « La forêt » : ses ${filtres.length} fragments seuls (MOD-011, étape 3)`);
  const [dl2] = await Promise.all([q.waitForEvent('download'), q.click('[data-act="scrap-md"]')]);
  const md2 = fs.readFileSync(await dl2.path(), 'utf8'), at = t => md2.indexOf(t);
  const ordre = at('## Prologue') >= 0 && at('## Prologue') < at('La lisière n\'est pas une frontière') && at('Le ruisseau coupe la lisière en deux.') < at('## La forêt')
    && at('## La forêt') < at('Le brouillard efface la route') && at('Le brouillard efface la route') < at('## Hors chapitre') && at('## Hors chapitre') < at('Une phrase sans chapitre, posée là comme une phalène');
  ok(dl2.suggestedFilename().endsWith('.md') && ordre, `« Exporter en Markdown » : ${dl2.suggestedFilename()}, « ## Prologue » et ses fragments, « ## La forêt » et les siens, « ## Hors chapitre » et « Une phrase sans chapitre… » (MOD-011, étape 4)`);
  const nAvant = (await donneesQ()).modules.ecriture.scraps.length;
  await versQ('reglages', '#mreg-ecriture [data-ci="0"] [data-act="cat-del"]'); await q.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await q.click('#mreg-ecriture [data-ci="0"] [data-act="cat-del"]'); await q.waitForSelector('#cdlg[open]');
  const demande = (await q.textContent('#cmsg')).trim(); await q.click('#cdlg button[value=ok]');
  await q.waitForFunction(() => !JSON.parse(localStorage.getItem('selene-site-v1')).modules.ecriture.config.categories.some(c => c.id === 'c1'), null, { timeout: 5000 }).catch(() => {});
  const fin = (await donneesQ()).modules.ecriture;
  ok(demande === 'Supprimer « Prologue » ? Les entrées déjà ajoutées passeront hors catégorie.' && !fin.config.categories.some(c => c.id === 'c1') && fin.scraps.length === nAvant && !fin.scraps.some(s => s.category === 'c1')
    && ['f1', 'f3'].every(id => fin.scraps.some(s => s.id === id && !s.category)), `« Prologue » supprimé après « ${demande} » : ses fragments hors chapitre, aucun supprimé (${fin.scraps.length} sur ${nAvant}) (MOD-011, étape 5)`);

  console.log('le jeu d’essai : la capture et ses trois motifs (MOD-014)');
  // Un contexte neuf, le jeu d'essai, l'horloge figée le 7 octobre 2026 à 10 h à Paris.
  const cc = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris' });
  const c = await cc.newPage(); c.on('pageerror', e => errs.push(e.message)); await c.clock.setFixedTime(new Date('2026-10-07T10:00:00+02:00'));
  await c.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  await ouvrir(c, BASE + '/index.html', () => !!document.querySelector('#capIn'));
  const siteC = () => c.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const versC = async (h, sel) => { await c.evaluate(x => { location.hash = x; }, h); await c.waitForSelector(sel, { state: 'attached' }); };
  const bulleC = () => c.evaluate(() => { const t = document.querySelector('#toast'); return { texte: t.textContent.replace(/\s+/g, ' ').trim(), action: !!t.querySelector('[data-act="undo"]') }; });
  const capturer = async t => { await versC('accueil', '#capIn'); await c.evaluate(() => { document.querySelector('#toast').textContent = ''; }); await c.fill('#capIn', t); await c.click('[data-act="cap-add"]'); await c.waitForFunction(() => !!document.querySelector('#toast').textContent.trim(), null, { timeout: 5000 }).catch(() => {}); return bulleC(); };
  const dansBoite = async t => (await siteC()).modules.inbox.entries.some(e => e.text === t);
  const b1 = await capturer('8,40 € courses légumes');
  ok(await dansBoite('8,40 € courses légumes') && b1.action && b1.texte === '8,40 € en dépense dans Budget (Courses) ? Ranger', `« 8,40 € courses légumes » : dans la boîte ; le bandeau « ${b1.texte} » (MOD-014, étape 1)`);
  await c.click('#toast [data-act="undo"]'); await c.waitForFunction(() => document.querySelector('#toast').textContent.includes('Rangé'), null, { timeout: 5000 }).catch(() => {});
  const b2 = await bulleC(), depense = (await siteC()).modules.budget.entries.find(e => e.amount === 8.4 && e.cat === 'Courses') || {};
  ok(b2.texte === 'Rangé : 8,40 € en dépense dans Budget (Courses).' && !(await dansBoite('8,40 € courses légumes')) && depense.date === '2026-10-07', `accepté : « ${b2.texte} » ; la note quitte la boîte ; la dépense est au Budget, le ${depense.date} (MOD-014, étape 2)`);
  const b3 = await capturer('20 min yoga');
  await versC('inbox', '#main li.item');
  const ranger = await c.evaluate(() => { const li = [...document.querySelectorAll('#main li.item')].find(l => (l.querySelector('.ntext') || {}).textContent === '20 min yoga'); const x = li && li.querySelector('[data-act="note-file"]'); return x ? x.textContent.trim() : ''; });
  ok(b3.action && b3.texte === '20 min dans Yoga ? Ranger' && ranger === 'Ranger : 20 min dans Yoga', `« 20 min yoga », le bandeau ignoré : la note reste dans la boîte, avec « ${ranger} » (MOD-014, étape 3)`);
  const yogaAvant = JSON.stringify((await siteC()).modules.yoga);
  await c.evaluate(() => { const li = [...document.querySelectorAll('#main li.item')].find(l => (l.querySelector('.ntext') || {}).textContent === '20 min yoga'); li.querySelector('[data-act="note-file"]').click(); });
  await c.waitForFunction(() => !JSON.parse(localStorage.getItem('selene-site-v1')).modules.inbox.entries.some(e => e.text === '20 min yoga'), null, { timeout: 5000 }).catch(() => {});
  const yoga = (await siteC()).modules.yoga, seances = JSON.stringify(yoga) !== yogaAvant ? (yoga.entries || yoga.log || []).filter(e => +e.value === 20 && e.date === '2026-10-07') : [];
  ok(seances.length === 1 && !(await dansBoite('20 min yoga')), `rangé depuis la boîte : une séance de 20 min dans Yoga, le 7 octobre, la date de la note ; la note quitte la boîte (MOD-014, étape 4)`);
  const b5 = await capturer('Plantes : feuilles jaunes');
  if (b5.action) await c.click('#toast [data-act="undo"]');
  await c.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.plantes.entries.some(e => e.note === 'feuilles jaunes'), null, { timeout: 5000 }).catch(() => {});
  const obs = (await siteC()).modules.plantes.entries.find(e => e.note === 'feuilles jaunes') || {};
  await versC('plantes', '#main li.item');
  const journal = await c.evaluate(() => [...document.querySelectorAll('#main li.item')].some(l => l.textContent.includes('feuilles jaunes')));
  ok(b5.action && obs.date === '2026-10-07' && journal && !(await dansBoite('Plantes : feuilles jaunes')), `« Plantes : feuilles jaunes », rangé : une observation « feuilles jaunes » au journal de Plantes, le ${obs.date} (MOD-014, étape 5)`);
  const b6a = await capturer('rdv : 14h chez le dentiste'), b6b = await capturer('acheter du pain');
  await versC('inbox', '#main li.item');
  const sans = await c.evaluate(() => ['rdv : 14h chez le dentiste', 'acheter du pain'].map(t => { const li = [...document.querySelectorAll('#main li.item')].find(l => (l.querySelector('.ntext') || {}).textContent === t); return li ? !li.querySelector('[data-act="note-file"]') : false; }));
  ok(!b6a.action && !b6b.action && b6a.texte.startsWith('Gardé') && b6b.texte.startsWith('Gardé') && sans.every(Boolean), `« rdv : 14h chez le dentiste », puis « acheter du pain » : « ${b6a.texte} », sans bandeau ni « Ranger » ; deux notes gardées (MOD-014, étape 6)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
