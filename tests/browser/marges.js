/* Scénario de navigateur : marginalia (évolution de l'interface, vague 4b : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.ecriture.config.scraps = true;
demo.modules.ecriture.scraps = [
  { id: 'a', text: 'La lune décroît sur la lisière, et la phalène tourne autour de la lampe comme une pensée qui ne sait pas se poser.', date: '2026-09-20', ep: 'hyp',
    origin: { text: 'lune et lisière', from: 'Capture', date: '2026-09-19' }, editedAt: '2026-09-25', versions: [{ at: '2026-09-21', text: 'La lune décroît.' }] },
  { id: 'b', text: 'Une autre pensée, plus courte.', date: '2026-09-21', links: [{ id: 'l1', to: 'ecriture/a', type: 'derive', date: '2026-09-21' }] },
  { id: 'c', text: 'Rien ne tourne autour de rien.', date: '2026-09-22' }
];
demo.modules.motifs = { type: 'collection', label: 'Motifs', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), concordance: true, display: 'liste', statuses: ['Vivant', 'Épuisé'], doneFrom: 1, fallowDays: 90 },
  entries: [{ id: 'm1', title: 'lune', status: 'Vivant' }, { id: 'm2', title: '<img src=x onerror=window.__pwn=1>', status: 'Vivant' }] };
demo.config.modules.push({ id: 'motifs', on: true });
demo.modules.inbox.entries = [{ id: 'n1', text: 'la lune revient chaque soir <img src=x onerror=window.__pwn=1>', date: '2026-09-27', origin: { text: 'x', from: 'Écriture', date: '2026-09-26' } }];
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (opts, hash) => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html#' + hash); await p.waitForTimeout(450); return p;
  };
  // Position de la marge par rapport au texte de sa ligne.
  const place = (p, id) => p.$eval(`ul.margins > li[data-id="${id}"]`, li => {
    const t = li.children[1].getBoundingClientRect(), m = li.querySelector(':scope > .marg').getBoundingClientRect();
    return { beside: m.left >= t.right - 1, below: m.top >= t.bottom - 1, dTop: Math.abs(m.top - t.top), text: li.querySelector(':scope > .marg').textContent.replace(/\s+/g, ' ') };
  });

  console.log('sur un grand écran, en marge');
  const d = await open({ viewport: { width: 1440, height: 900 } }, 'ecriture');
  let a = await place(d, 'a');
  ok(a.beside && a.dTop < 6, `la marge est à droite du fragment, alignée sur sa première ligne (écart ${Math.round(a.dTop)} px)`);
  ok(a.text.includes('modifié') && a.text.includes('de Capture') && a.text.includes('a donné') && a.text.includes('Une autre pensée'), 'retouche, provenance, liens entrants');
  ok(a.text.includes('motifs') && await d.isVisible('li[data-id="a"] .marg [data-act="search-for"][data-q="lune"]'), 'les motifs présents, qui mènent à la recherche');
  ok((await place(d, 'b')).text.includes('dérive de'), 'les liens sortants');
  const widths = await d.$$eval('ul.margins > li.item > div:nth-child(2)', ds => ds.map(x => Math.round(x.getBoundingClientRect().width)));
  ok(new Set(widths).size === 1, `la colonne de texte garde la même largeur, marge vide ou non (${widths.join(', ')})`);
  ok(!(await d.textContent('li[data-id="a"] > div')).includes('de Capture'), 'le texte ne porte plus sa provenance : elle est en marge');
  await d.hover('li[data-id="a"]');
  ok(await d.isVisible('li[data-id="a"] > div [data-act="link-form"]'), 'les actions restent sur la ligne, pas dans la marge');
  await d.click('li[data-id="a"] .marg [data-act="search-for"][data-q="lune"]'); await d.waitForTimeout(300);
  ok((await d.evaluate(() => location.hash)) === '#recherche' && (await d.inputValue('#searchIn')) === 'lune', 'un motif en marge lance sa recherche');
  const n = await open({ viewport: { width: 1280, height: 800 } }, 'inbox');
  ok((await place(n, 'n1')).beside, 'la boîte de réception aussi : la note, et sa marge');

  console.log('écran moyen, téléphone');
  const m = await open({ viewport: { width: 1100, height: 900 } }, 'ecriture');
  ok((await place(m, 'a')).below, 'liste étroite (colonne d’Écriture à 1100 px) : la marge passe sous le texte');
  const t = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'ecriture');
  a = await place(t, 'a');
  ok(a.below && a.text.includes('de Capture'), 'sur téléphone : sous le texte, rien de perdu');
  ok(await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'aucun débordement en largeur');

  check(!(await d.evaluate(() => window.__pwn)) && !(await n.evaluate(() => window.__pwn)), 'un motif ou une note piégés ne s’exécutent pas dans la marge');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
