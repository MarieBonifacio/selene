/* Scénario de navigateur : écrans (évolution de l'interface, vague 3d : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = iso(new Date()), old = '2024-01-15';
const demo = JSON.parse(fixture());
demo.modules.ecriture.config.scraps = true;
demo.modules.ecriture.scraps = [
  { id: 's1', text: 'La lune sur la lisière', date: today, ep: 'hyp' },
  { id: 's2', text: 'Une lune ancienne', date: old, ep: 'obs' }
];
demo.modules.inbox.entries = [{ id: 'n1', text: 'Acheter une lampe, la lune ne suffit plus', date: today }];
demo.modules.moth.entries = [
  { id: 'c1', title: 'Le lichen', status: 'Idée', tag: 'Nigredo' },
  { id: 'c2', title: 'La mue', status: 'Brouillon', tag: 'Albedo' }
];
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async opts => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(400); return p;
  };
  const go = async (p, h) => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(250); };
  const data = p => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const status = async (p, id) => (await data(p)).modules.moth.entries.find(e => e.id === id).status;

  console.log('les journaux à dates suspendues');
  const d = await open({ viewport: { width: 1280, height: 800 } });
  await go(d, 'inbox');
  const j = await d.$eval('#main li.item[data-id="n1"]', li => { const s = li.firstElementChild, t = li.children[1], a = s.getBoundingClientRect(), c = t.getBoundingClientRect();
    return { cls: s.className, text: s.textContent.trim(), meta: (t.querySelector('.meta') || { textContent: '' }).textContent, left: a.right <= c.left + 1 }; });
  ok(j.cls === 'jdate' && j.text.length > 0 && j.left, 'la date pend dans la marge, à gauche du texte');
  ok(!/\d{4}|sept|oct|janv/.test(j.meta), 'et ne se répète plus dans la ligne de méta');

  console.log('le registre');
  await go(d, 'moth');
  const rooms = await d.$$eval('#main .rooms .room', rs => rs.map(r => { const b = r.getBoundingClientRect(), f = r.querySelector('.fill');
    return { h: b.height, y: b.y, w: b.width, fill: f.style.width, fh: f.getBoundingClientRect().height }; }));
  ok(rooms.length >= 2 && rooms.every(r => r.h < 60) && rooms[1].y > rooms[0].y, `une ligne par groupe, pas une tuile (${rooms.map(r => Math.round(r.h)).join(', ')} px)`);
  ok(rooms.every(r => /%$/.test(r.fill) && r.fh <= 3), 'la progression est un trait fin, en largeur');

  console.log('le tableau, sur ordinateur');
  ok(!(await d.isVisible('#main .seg')) && (await d.$$eval('#main .board .col', cs => cs.filter(c => c.offsetParent).length)) === 4, 'toutes les colonnes, pas de sélecteur');
  await d.dragAndDrop('#main .card[data-id="c1"]', '#main .col[data-ci="2"]'); await d.waitForTimeout(250);
  ok(await status(d, 'c1') === 'Prêt', 'glisser une carte dans une colonne change son statut');
  await d.focus('#main .card[data-id="c2"]'); await d.keyboard.press(']'); await d.waitForTimeout(200);
  ok(await status(d, 'c2') === 'Prêt' && (await d.evaluate(() => document.activeElement.dataset.id)) === 'c2', '« ] » avance la carte, qui garde le focus');
  ok(/, Prêt : \[ pour reculer/.test(await d.evaluate(() => document.activeElement.getAttribute('aria-label'))), 'la carte dit sa nouvelle colonne au lecteur d’écran');
  await d.keyboard.press(']'); await d.waitForTimeout(200);
  ok(await status(d, 'c2') === 'Publié' && (await d.textContent('#toast')).includes('Publié'), 'jusqu’à la dernière colonne, phrase de fin comprise');
  await d.keyboard.press('['); await d.keyboard.press('['); await d.waitForTimeout(200);
  ok(await status(d, 'c2') === 'Brouillon', '« [ » la fait reculer');

  console.log('le tableau, sur téléphone');
  const m = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await go(m, 'moth');
  const visibleCols = () => m.$$eval('#main .board .col', cs => cs.filter(c => c.offsetParent).map(c => c.dataset.ci));
  ok(await m.isVisible('#main .seg') && (await visibleCols()).join() === '0', 'un sélecteur, une seule colonne à la fois');
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'rien ne déborde en largeur');
  await m.tap('#main .seg [data-i="1"]'); await m.waitForTimeout(200);
  ok((await visibleCols()).join() === '1' && (await m.textContent('#main .board')).includes('La mue') && (await m.getAttribute('#main .seg [data-i="1"]', 'aria-selected')) === 'true', 'toucher un onglet montre sa colonne');
  await m.tap('#main .card[data-id="c2"] [data-act="col-move"][data-d="1"]'); await m.waitForTimeout(200);
  ok(await status(m, 'c2') === 'Prêt' && (await visibleCols()).join() === '1', 'les flèches restent, l’onglet ne bouge pas');

  console.log('la recherche à facettes');
  await go(d, 'recherche'); await d.fill('#searchIn', 'lune'); await d.waitForTimeout(350);
  const grps = () => d.$$eval('#main .search-grp', gs => gs.map(g => g.textContent.replace(/\s+/g, ' ').trim()));
  const hint = async () => (await d.textContent('#main .row .hint')).replace(/\s+/g, ' ');
  let g = await grps();
  ok(g.length === 2 && (await hint()).includes('3 résultats'), `résultats groupés par espace (${g.join(' | ')})`);
  ok(await d.isVisible('#main .search-grp + ul .jdate'), 'avec leur date dans la marge');
  await d.click('#main .chip-f[data-k="period"][data-v="mois"]'); await d.waitForTimeout(200);
  ok((await hint()).includes('2 résultats sur 3'), 'la période « ce mois-ci » écarte l’ancien, et le dit');
  await d.click('#main .chip-f[data-k="ep"][data-v="hyp"]'); await d.waitForTimeout(200);
  ok((await hint()).includes('1 résultat sur 3') && (await grps()).length === 1, 'le statut se combine à la période');
  ok((await d.textContent('#main .chip-f[data-k="mod"][data-v=""]')).includes('1'), 'chaque facette compte ce qu’elle donnerait, les autres appliquées');
  await d.click('#main .chip-f[data-k="ep"][data-v="hyp"]'); await d.click('#main .chip-f[data-k="period"][data-v="mois"]');
  await d.click('#main .chip-f[data-k="mod"][data-v="inbox"]'); await d.waitForTimeout(200);
  g = await grps();
  ok(g.length === 1 && (await hint()).includes('1 résultat sur 3') && (await d.getAttribute('#main .chip-f[data-k="mod"][data-v="inbox"]', 'aria-pressed')) === 'true', 'recliquer défait ; l’espace isole le sien');
  await d.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'search-for'; b.dataset.q = 'lune'; b.id = 'sf'; document.body.append(b); });
  await d.click('#sf'); await d.waitForTimeout(200);
  ok((await hint()).includes('3 résultats') && !(await hint()).includes('sur'), 'une recherche lancée d’ailleurs repart sans filtre');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
