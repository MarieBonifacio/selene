/* Scénario de navigateur : les cibles à la souris (WCAG 2.2, critère 2.5.8, niveau AA). Sur ordinateur, un contrôle de
   moins de 24 × 24 px est admis s'il a de l'air : un cercle de 24 px de diamètre centré sur lui ne touche aucune autre
   cible, ni le cercle d'une autre petite cible. Deux cases de 13 px l'une sous l'autre, à 24 px d'écart, échouaient
   (relevé par axe-core sur les réglages d'une collection). Exceptions de WCAG : un lien dans le fil d'une phrase, un
   contrôle natif que la page ne dessine pas autrement. Tous les volets ouverts, en thème clair. Lancé par
   tests/browser/run.js ; cibles.js mesure le téléphone, à 44 px. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#accueil'); await p.waitForTimeout(400);
  const serres = () => p.evaluate(() => {
    const visible = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('dialog:not([open]),[popover]:not(:popover-open)'); };
    const dansLaPhrase = e => e.tagName === 'A' && !e.classList.contains('btn') && getComputedStyle(e).display === 'inline';
    const all = [...document.querySelectorAll('#main a[href],#main button,#main input:not([type=hidden]),#main select,#main textarea,#main summary')]
      .filter(e => visible(e) && !(e.tagName === 'INPUT' && e.type === 'file' && getComputedStyle(e).display === 'none'));
    const boxes = all.map(e => { const r = e.getBoundingClientRect(); return { e, l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY, cx: r.left + r.width / 2, cy: r.top + scrollY + r.height / 2, small: r.width < 24 || r.height < 24 }; });
    const R = 12, near = (a, o) => { // le cercle de a touche-t-il la boîte de o ?
      const dx = Math.max(o.l - a.cx, 0, a.cx - o.r), dy = Math.max(o.t - a.cy, 0, a.cy - o.b);
      return dx * dx + dy * dy < R * R - 0.5;
    };
    const name = e => (e.getAttribute('aria-label') || e.textContent || e.dataset.act || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 30) || e.tagName.toLowerCase();
    const out = [];
    for (const a of boxes) {
      if (!a.small || dansLaPhrase(a.e)) continue;
      // L'étiquette qui contient la case en fait partie : elle ne compte pas comme voisine.
      const other = boxes.find(o => o !== a && !o.e.contains(a.e) && !a.e.contains(o.e) && !dansLaPhrase(o.e) &&
        (near(a, o) || (o.small && Math.hypot(a.cx - o.cx, a.cy - o.cy) < 2 * R - 0.5)));
      if (other) out.push(`${name(a.e)} (${Math.round(a.r - a.l)}×${Math.round(a.b - a.t)}) trop près de ${name(other.e)}`);
    }
    return out;
  });
  const ecran = async (nom, hash) => {
    await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(400);
    const shown = await p.evaluate(() => { const a = document.querySelector('#nav [aria-current="page"]'); return a ? a.getAttribute('href') : ''; });
    if (shown !== '#' + hash) return check(false, `${nom} : #${hash} affiche ${shown || 'autre chose'}`);
    await p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; })); await p.waitForTimeout(150);
    const bad = await serres();
    check(!bad.length, `${nom} : chaque petite cible garde 24 px d'air${bad.length ? ' ; ' + bad.slice(0, 6).join(', ') : ''}`);
  };
  for (const [nom, hash] of [['accueil', 'accueil'], ['Réglages, tout déplié', 'reglages'], ['Tâches', 'chantier'], ['Écriture', 'ecriture'], ['Collection', 'moth'], ['Musique', 'musique'], ['Budget', 'budget'], ['Programme', 'kundalini'], ['Rappels', 'phidippus'], ['Boîte', 'inbox'], ['Bilan', 'bilan'], ['Recherche', 'recherche']]) await ecran(nom, hash);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
