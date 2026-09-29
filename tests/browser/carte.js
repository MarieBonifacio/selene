/* Scénario de navigateur : carte céleste des liaisons (évolution de l'interface, vague 4d : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.ecriture.config.scraps = true;
const L = (to, type, id) => ({ id, to, type, date: '2026-09-20' });
demo.modules.ecriture.scraps = [
  { id: 'a', text: 'La lune décroît sur la lisière', date: '2026-08-02' },
  { id: 'b', text: 'La phalène et la lampe <img src=x onerror=window.__pwn=1>', date: '2026-08-15', links: [L('ecriture/a', 'derive', 'l1')] },
  { id: 'c', text: 'Rien ne tourne autour de rien', date: '2026-08-20', links: [L('ecriture/b', 'contredit', 'l2')] },
  { id: 'd', text: 'Synthèse : la lune comme lampe', date: '2026-09-05', links: [L('ecriture/a', 'derive', 'l3'), L('inbox/n1', 'echo', 'l4')] },
  { id: 'e', text: 'Une note de lecture sur la mue', date: '2026-09-12', links: [L('ecriture/d', 'documente', 'l5')] },
  { id: 'f', text: 'La lune encore, sans lien', date: '2026-09-25' },
  { id: 'far', text: 'À deux degrés, par la note de lecture', date: '2026-09-26', links: [L('ecriture/e', 'echo', 'l7')] },
  { id: 'g', text: 'Trop loin : trois degrés', date: '2026-09-27', links: [L('ecriture/far', 'echo', 'l8')] }
];
// Un motif très fréquent : 120 fragments, pour la limite de 80 étoiles.
// Placés avant : la liste montre les plus récents d'abord, 100 par page, et les fragments nommés doivent y être.
demo.modules.ecriture.scraps.unshift(...Array.from({ length: 120 }, (_, i) => ({ id: `m${i}`, text: `la brume numéro ${i}`, date: '2026-07-01' })));
demo.modules.inbox.entries = [{ id: 'n1', text: 'la lune revient chaque soir', date: '2026-09-01', links: [L('ecriture/c', 'contredit', 'l6')] }];
demo.modules.motifs = { type: 'collection', label: 'Motifs', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), concordance: true, display: 'liste', statuses: ['Vivant', 'Épuisé'], doneFrom: 1, fallowDays: 90 },
  entries: [{ id: 'm1', title: 'lune', status: 'Vivant' }, { id: 'm2', title: 'brume', status: 'Vivant' }] };
demo.config.modules.push({ id: 'motifs', on: true });
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (opts, hash) => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html#' + hash); await p.waitForTimeout(450); return p;
  };
  const stars = p => p.$$eval('#sheet .carte-svg .stars a', as => as.map(a => ({ href: a.getAttribute('href'), x: +a.querySelector('circle:not(.hit)').getAttribute('cx'), y: +a.querySelector('circle:not(.hit)').getAttribute('cy'), center: a.classList.contains('center') })));

  console.log('le voisinage d’une entrée');
  const d = await open({ viewport: { width: 1280, height: 900 } }, 'ecriture');
  await d.hover('#main [data-id="d"]'); await d.click('#main [data-id="d"] [data-act="specimen"]'); await d.waitForTimeout(300);
  await d.click('#sheet [data-act="carte"][data-k="ref"]'); await d.waitForTimeout(350);
  let s = await stars(d);
  const hrefs = s.map(x => x.href).sort();
  ok(await d.isVisible('#sheet.wide .carte-svg') && (await d.textContent('#sheet h2')).includes('Voisinage'), 'la fiche mène à la carte du voisinage, dans une feuille large');
  ok(hrefs.includes('#ecriture/d') && hrefs.includes('#ecriture/c') && hrefs.includes('#inbox/n1') && hrefs.includes('#ecriture/far') && !hrefs.includes('#ecriture/g') && !hrefs.includes('#ecriture/f'), `deux degrés, pas plus (${hrefs.join(' ')})`);
  ok(s.find(x => x.href === '#ecriture/d').center, 'l’entrée de départ est cerclée');
  const x = h => s.find(v => v.href === h).x, y = h => s.find(v => v.href === h).y;
  ok(x('#ecriture/a') < x('#ecriture/b') && x('#ecriture/b') < x('#ecriture/d'), 'le temps de gauche à droite');
  ok(y('#inbox/n1') !== y('#ecriture/a') && Math.abs(y('#ecriture/a') - y('#ecriture/b')) < 30, 'une bande par espace');
  const lines = await d.$$eval('#sheet .carte-svg path.ln', ps => ps.map(p => ({ cls: p.getAttribute('class'), dash: p.getAttribute('stroke-dasharray') || '' })));
  ok(lines.some(l => l.cls.includes('ln-derive') && !l.dash) && lines.some(l => l.cls.includes('ln-contredit') && l.dash) && lines.some(l => l.cls.includes('ln-documente') && l.dash.split(' ').length === 4), 'le type de lien se lit à la forme du trait');
  ok(lines.filter(l => l.cls.includes('open')).length === 2, 'les deux tensions ouvertes, marquées');
  const table = (await d.textContent('#sheet .carte-table')).replace(/\s+/g, ' ');
  ok(table.includes('dérive de') && table.includes('documente') && table.includes('tension ouverte'), 'la table des liaisons dit la même chose en texte');
  const again = await stars(d);
  await d.click('#sheet [data-act="sheet-close"], #sheet .close', { timeout: 1000 }).catch(() => d.keyboard.press('Escape'));
  await d.waitForTimeout(200);
  await d.hover('#main [data-id="d"]'); await d.click('#main [data-id="d"] [data-act="specimen"]'); await d.waitForTimeout(250);
  await d.click('#sheet [data-act="carte"][data-k="ref"]'); await d.waitForTimeout(300);
  ok(JSON.stringify(await stars(d)) === JSON.stringify(again), 'rouverte, la carte est la même : chaque étoile à sa place');

  console.log('au clavier');
  await d.focus('#sheet .carte-svg a[href="#ecriture/a"]'); await d.keyboard.press('Enter'); await d.waitForTimeout(350);
  ok(!(await d.isVisible('#sheet')) && (await d.evaluate(() => location.hash)) === '#ecriture/a', 'une étoile se suit au clavier, la feuille se ferme');

  console.log('la carte d’un motif');
  await d.evaluate(() => location.hash = 'motifs'); await d.waitForTimeout(300);
  await d.hover('#main [data-id="m1"]'); await d.click('#main [data-id="m1"] [data-act="carte"]'); await d.waitForTimeout(350);
  s = await stars(d);
  ok((await d.textContent('#sheet h2')).includes('Motif « lune »') && s.some(v => v.href === '#ecriture/f') && s.some(v => v.href === '#ecriture/b'), 'les entrées du motif, et leurs voisines directes');
  ok((await d.textContent('#sheet')).includes('Sans lien ici'), 'une étoile isolée est nommée sous la table');
  await d.keyboard.press('Escape'); await d.waitForTimeout(200);
  await d.hover('#main [data-id="m2"]'); await d.click('#main [data-id="m2"] [data-act="carte"]'); await d.waitForTimeout(350);
  ok((await stars(d)).length === 80 && (await d.textContent('#sheet .hint')).includes('nébuleuse'), '120 occurrences : 80 étoiles au plus, et l’app le dit');

  console.log('téléphone');
  const m = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'ecriture');
  await m.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'carte'; b.dataset.k = 'ref'; b.dataset.v = 'ecriture/d'; b.id = 'go'; document.body.append(b); b.click(); });
  await m.waitForTimeout(350);
  ok(await m.isVisible('#sheet .carte-table') && !(await m.isVisible('#sheet .carte-svg')), 'sur téléphone, la table d’abord');
  await m.tap('#sheet [data-act="carte-toggle"]'); await m.waitForTimeout(200);
  ok(await m.isVisible('#sheet .carte-svg') && (await m.getAttribute('#sheet [data-act="carte-toggle"]', 'aria-expanded')) === 'true', 'la carte sur demande');
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'la page ne déborde pas (la carte défile dans son cadre)');

  check(!(await d.evaluate(() => window.__pwn)) && !(await m.evaluate(() => window.__pwn)), 'un fragment piégé ne s’exécute ni dans la carte ni dans la table');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
