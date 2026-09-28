/* Scénario de navigateur : interface (évolution de l'interface, vague 1 : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.phidippus.config.types.forEach(t => { t.every = t.every || 3; }); // plusieurs rappels dus : une seule ligne d'accueil
demo.modules.ecriture.scraps = Array.from({ length: 30 }, (_, i) => ({ id: 's' + i, text: 'Fragment numéro ' + i, date: '2026-01-0' + (1 + i % 9) }));
(async () => {
  const b = await chromium.launch(launchOptions);
  const ok = check;
  const errs = [];
  const open = async (opts) => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
    return p;
  };
  const go = async (p, h) => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };

  console.log('iPhone (écran tactile, 390 pt)');
  const m = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const moon = await m.evaluate(() => { const r = document.querySelector('.hero .moon g circle').getBoundingClientRect(), h = document.querySelector('.hero').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, hl: h.left, hr: h.right, ht: h.top, hb: h.bottom }; });
  ok(moon.l >= moon.hl && moon.r <= moon.hr && moon.t >= moon.ht && moon.b <= moon.hb, 'la lune est entière dans le ciel, même sur un écran étroit');
  const home = (await m.textContent('#main')).replace(/\s+/g, ' ');
  const lines = await m.$$eval('#main .item', els => els.filter(e => e.textContent.includes('Phidippus')).length);
  ok(lines === 1 && /Phidippus : .+ · /.test(home), 'rappels dus regroupés en une ligne par module');
  ok(await m.$eval('#nav a.on', a => a.getAttribute('aria-current')) === 'page', 'onglet actif annoncé (aria-current)');
  await go(m, 'ecriture');
  ok(!(await m.isVisible('#main .item[data-id="s29"] [data-act="scrap-del"]')), 'au repos, « suppr. » est caché sur écran tactile');
  await m.tap('#main .item[data-id="s29"] > div'); await m.waitForTimeout(100);
  ok(await m.isVisible('#main .item[data-id="s29"] [data-act="scrap-del"]'), 'un toucher sur la ligne montre ses actions');
  ok(!(await m.isVisible('#main .item[data-id="s28"] [data-act="scrap-del"]')), 'une seule ligne à la fois');
  await go(m, 'chantier'); await m.tap('[data-act="task-new"]'); await m.waitForTimeout(150);
  const fs = await m.$eval('#form [name=title]', el => parseFloat(getComputedStyle(el).fontSize)); // dans un <label> à .88rem
  ok(fs >= 16, `champs de formulaire à 16 px au moins (iOS ne zoome pas) : ${fs}`);
  await m.tap('#form button[value=cancel]');

  console.log('ordinateur');
  const d = await open({ viewport: { width: 1280, height: 800 } });
  await go(d, 'ecriture');
  ok(await d.$eval('#main .item[data-id="s29"] [data-act="scrap-del"]', el => getComputedStyle(el).opacity) === '0', 'au repos, les actions de ligne sont effacées');
  await d.hover('#main .item[data-id="s29"]'); await d.waitForTimeout(250);
  ok(await d.$eval('#main .item[data-id="s29"] [data-act="scrap-del"]', el => getComputedStyle(el).opacity) === '1', 'au survol, elles apparaissent');
  await d.evaluate(() => window.scrollTo(0, 900)); await d.waitForTimeout(100);
  const y = await d.evaluate(() => window.scrollY);
  await go(d, 'accueil'); ok(await d.evaluate(() => window.scrollY) === 0, 'l’accueil retrouve sa propre position, pas celle de la vue quittée');
  await go(d, 'ecriture'); ok(Math.abs(await d.evaluate(() => window.scrollY) - y) < 2, 'revenir dans une vue retrouve sa position');
  ok(await d.$eval('.side', n => getComputedStyle(n).position) === 'sticky' && await d.isVisible('#nav a[href="#ecriture"]'), 'barre latérale collante sur ordinateur');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
