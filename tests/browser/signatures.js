/* Scénario de navigateur : signatures (évolution de l'interface, vague 3c : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.ecriture.config.scraps = true;
demo.modules.ecriture.scraps = [
  { id: 'a', text: 'La lune décroît sur la lisière', date: '2026-09-20', ep: 'hyp', epLog: [{ from: null, to: 'hyp', date: '2026-09-20' }], origin: { text: 'lune et lisière', from: 'Capture', date: '2026-09-19' } },
  { id: 'b', text: 'Une autre pensée', date: '2026-09-21', links: [{ id: 'l1', to: 'ecriture/a', type: 'derive', date: '2026-09-21' }] }
];
demo.modules.motifs = { type: 'collection', label: 'Motifs', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), concordance: true, display: 'liste', statuses: ['Vivant', 'Épuisé'], doneFrom: 1, fallowDays: 90 },
  entries: [{ id: 'm1', title: 'lune', status: 'Vivant' }] };
demo.config.modules.push({ id: 'motifs', on: true });
demo.modules.inbox.entries = [
  { id: 'n1', text: 'Phidippus : a mué cette nuit', date: '2026-09-27' },
  { id: 'n2', text: 'idée de chapitre', date: '2026-09-27' },
  { id: 'n3', text: 'à jeter', date: '2026-09-28' }
];
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (opts, clock) => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    if (clock) await p.clock.install();
    await p.goto(BASE + '/index.html'); await (clock ? p.clock.runFor(400) : p.waitForTimeout(400)); return p;
  };
  const data = p => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));

  console.log('la fiche Spécimen');
  const d = await open({ viewport: { width: 1280, height: 800 } });
  await d.evaluate(() => location.hash = 'ecriture'); await d.waitForTimeout(250);
  await d.hover('#main [data-id="a"]'); await d.click('#main [data-id="a"] [data-act="specimen"]'); await d.waitForTimeout(350);
  let t = (await d.textContent('#sheet')).replace(/\s+/g, ' ');
  ok(await d.isVisible('#sheet.drawer'), 'la fiche s’ouvre dans un tiroir, sans quitter l’espace');
  ok(t.includes('La lune décroît') && t.includes('Provenance') && t.includes('de Capture'), 'texte et provenance');
  ok(t.includes('a donné') && t.includes('Une autre pensée'), 'liens entrants (ce qui en dérive)');
  ok(t.includes('Motifs') && await d.isVisible('#sheet [data-act="search-for"][data-q="lune"]'), 'les motifs présents dans le texte');
  ok(t.includes('Statut, au fil du temps') && await d.isVisible('#sheet .ep-glyph'), 'l’histoire du statut, codé par la forme');
  await d.selectOption('#sheet [data-act="ep-set"]', 'obs'); await d.waitForTimeout(250);
  ok((await data(d)).modules.ecriture.scraps.find(x => x.id === 'a').ep === 'obs' && (await d.textContent('#sheet')).includes('hypothèse → observé'), 'changer le statut depuis la fiche : gardé et daté, la fiche se redessine');
  await d.click('#sheet a[href="#ecriture/a"]'); await d.waitForTimeout(300);
  ok(!(await d.isVisible('#sheet')) && (await d.evaluate(() => location.hash)) === '#ecriture/a', '« Voir dans… » ferme la fiche et mène à l’entrée');

  console.log('le Halo');
  const h = await open({ viewport: { width: 1280, height: 800 } }, true);
  await h.click('#timerBtn'); await h.clock.runFor(450 * 1000);
  const halo = () => h.$eval('#halo', el => ({ on: el.classList.contains('on'), done: el.classList.contains('done'), p: parseFloat(el.style.getPropertyValue('--p')) }));
  let hs = await halo();
  ok(hs.on && Math.abs(hs.p - .5) < .02, `à mi-course, l’anneau est à moitié refermé (${hs.p})`);
  await h.clock.runFor(460 * 1000); hs = await halo();
  ok(hs.done && !hs.on && hs.p === 1, 'à la fin, l’anneau est fermé et bat une fois');
  await h.click('#timerReset'); await h.clock.runFor(100);
  const box = await h.$eval('#miniMoon', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await h.mouse.move(box.x, box.y); await h.mouse.down(); await h.clock.runFor(700); await h.mouse.up(); await h.clock.runFor(100);
  ok((await h.textContent('#timerBtn')) === 'Pause' && (await h.evaluate(() => location.hash)) === '', 'un appui long sur la mini-lune lance le minuteur, sans suivre le lien de l’accueil');

  console.log('le Vasculum');
  const m = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.evaluate(() => location.hash = 'inbox'); await m.waitForTimeout(250);
  await m.tap('[data-act="vasculum"]'); await m.waitForTimeout(350);
  const count = async () => (await m.textContent('#sheet .vasc-count') || '').replace(/\s+/g, ' ');
  ok((await count()).includes('1 sur 3') && (await m.textContent('#sheet')).includes('Phidippus : a mué'), 'une note à la fois, la plus ancienne d’abord');
  const phid = (await data(m)).modules.phidippus.entries.length;
  await m.tap('#sheet [data-act="note-file"]'); await m.waitForTimeout(300);
  ok((await count()).includes('1 sur 2') && (await data(m)).modules.phidippus.entries.length === phid + 1, 'le rangement reconnu, d’un geste ; la suivante arrive');
  await m.tap('#sheet [data-act="vasc-skip"]'); await m.waitForTimeout(200);
  ok((await count()).includes('2 sur 2') && (await m.textContent('#sheet')).includes('à jeter'), '« Plus tard » passe à la suivante sans rien toucher');
  await m.tap('#sheet [data-act="note-del"]'); await m.waitForTimeout(250);
  ok(await m.isVisible('#sheet #toast.show [data-act="undo"]'), 'supprimer : « Annuler » reste visible, dans la feuille');
  await m.tap('#sheet [data-act="note-to"][data-to="ecriture"]'); await m.waitForTimeout(300);
  ok((await m.textContent('#sheet')).includes('La boîte est vide') && (await data(m)).modules.ecriture.scraps.some(f => f.text === 'idée de chapitre'), 'rangée dans un espace par son sigil ; la boîte est vide');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
