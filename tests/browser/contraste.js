/* Scénario de navigateur : le contraste du nom d'un espace éteint, dans Réglages (relevé par axe-core, WCAG 1.4.3).
   Le nom se renomme même éteint : c'est un champ actif, qui doit garder 4,5:1 contre son fond, en thème clair comme
   en thème sombre. Avant le correctif, tout le bloc passait à 55 % d'opacité. Le rapport se calcule ici comme WCAG le
   définit (luminance relative), sans outil externe. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  for (const colorScheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', colorScheme });
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    try {
      await p.goto(BASE + '/index.html#reglages'); await p.waitForSelector('.modblock.off .mod-name>input');
      const r = await p.evaluate(() => {
        const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
        const lum = ([r, g, bl]) => { const c = [r, g, bl].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
        const el = document.querySelector('.modblock.off .mod-name>input');
        let bg = null, opacity = 1;
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e); opacity *= +cs.opacity;
          const c = rgb(cs.backgroundColor); if (!bg && c.length >= 3 && (c.length < 4 || c[3] > 0)) bg = c;
        }
        bg = bg || rgb(getComputedStyle(document.body).backgroundColor);
        const fg = rgb(getComputedStyle(el).color), a = (fg.length > 3 ? fg[3] : 1) * opacity;
        const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a)); // le texte, posé sur son fond
        const [l1, l2] = [lum(mix), lum(bg)].sort((x, y) => y - x);
        return { ratio: Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100, name: el.value };
      });
      check(r.ratio >= 4.5, `thème ${colorScheme === 'light' ? 'clair' : 'sombre'} : « ${r.name} », éteint, se lit à ${r.ratio}:1 (4,5:1 au moins)`);
    } catch (e) { check(false, e.message.split('\n')[0]); }
    await ctx.close();
  }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
