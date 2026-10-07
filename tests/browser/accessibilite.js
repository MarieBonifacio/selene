/* Scénario de navigateur : le balayage d'accessibilité, rejoué à chaque PR (BL-04 du cahier de recette ; TRV-001 à
   TRV-003, TRV-006, TRV-014). axe-core, une dépendance de développement figée (MPL-2.0, jamais embarquée dans
   l'application), passe sur les vues principales et sur une boîte de dialogue ouverte, en clair puis en sombre : aucune
   violation « serious » ni « critical » des règles WCAG 2.0, 2.1 et 2.2, niveaux A et AA. Ce qu'un lecteur d'écran ou
   un vrai appareil seuls révèlent reste aux cas manuels. Une exception, s'il en faut une, s'écrit dans EXCEPTIONS avec
   sa raison. Puis rien ne déborde, de 320 à 1 280 px (TRV-014). Mode A, jeu d'essai, données synthétiques. Lancé par tests/browser/run.js (Chromium et WebKit en CI). */
const fs = require('node:fs');
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Règle axe → pourquoi elle ne s'applique pas ici. Vide : tout ce qui est grave fait échouer.
const EXCEPTIONS = {};
// Les vues fixes, et chaque type d'espace du jeu d'essai.
const VIEWS = ['accueil', 'inbox', 'chantier', 'ecriture', 'kundalini', 'phidippus', 'moth', 'musique', 'budget', 'recherche', 'bilan', 'reglages'];
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  try {
    for (const colorScheme of ['light', 'dark']) {
      console.log(colorScheme === 'light' ? 'en clair' : 'en sombre');
      // bypassCSP : la politique de la page refuse tout script injecté, axe compris.
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', colorScheme, bypassCSP: true });
      await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + '/index.html'); await p.waitForSelector('#main h2, #main h1');
      await p.evaluate(AXE);
      const scan = async (what, include = 'body') => {
        const r = await p.evaluate(([sel, tags]) => window.axe.run(document.querySelector(sel), { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }), [include, TAGS]);
        const bad = r.violations.filter(v => ['serious', 'critical'].includes(v.impact) && !Object.hasOwn(EXCEPTIONS, v.id));
        check(!bad.length, `${what} : aucune violation grave` + (bad.length ? ' : ' + bad.map(v => `${v.id} (${v.nodes.length} : ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')})`).join(' ; ') : ''));
      };
      for (const view of VIEWS) {
        await p.evaluate(v => { location.hash = v; }, view);
        await p.waitForFunction(v => location.hash === '#' + v && !!document.querySelector('#main').children.length, view);
        await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await scan(view);
      }
      // Une boîte de dialogue ouverte : le formulaire d'une tâche.
      await p.evaluate(() => { location.hash = 'chantier'; }); await p.click('[data-act="task-new"]'); await p.waitForSelector('#dlg[open]');
      await scan('formulaire ouvert (nouvelle tâche)', '#dlg');
      await p.keyboard.press('Escape');
      await ctx.close();
    }

    console.log('rien ne déborde, de 320 à 1 280 px (TRV-014)');
    // Chaque vue, la planche et les Réglages tout dépliés, à 320 px puis à 1 280 px : la page ne défile jamais en largeur
    // (le Tableau défile dans son propre cadre). Sur téléphone, un formulaire prend la largeur, sans champ coupé ; sur
    // ordinateur, la barre latérale est à gauche du contenu.
    const ctxT = await b.newContext({ viewport: { width: 320, height: 640 }, serviceWorkers: 'block', hasTouch: true });
    await ctxT.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
    const q = await ctxT.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html'); await q.waitForSelector('#main h2, #main h1');
    const aller = async v => { await q.evaluate(x => { location.hash = x; }, v); await q.waitForFunction(x => location.hash === '#' + x && !!document.querySelector('#main').children.length, v); };
    const poser = () => q.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const deborde = () => q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    for (const [w, h] of [[320, 640], [1280, 900]]) {
      await q.setViewportSize({ width: w, height: h });
      const trop = [];
      for (const v of VIEWS) {
        await aller(v); if (v === 'reglages') await q.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
        await poser(); const d = await deborde(); if (d > 1) trop.push(`${v} (+${d} px)`);
      }
      await aller('bilan'); await q.click('[data-act="planche-open"]'); await poser();
      { const d = await deborde(); if (d > 1) trop.push(`planche (+${d} px)`); }
      const barre = w > 1000 ? await q.evaluate(() => { const n = document.querySelector('#nav').getBoundingClientRect(), m = document.querySelector('#main').getBoundingClientRect(); return n.width > 0 && n.right <= m.left + 1; }) : true;
      check(!trop.length && barre, `à ${w} px : ${VIEWS.length + 1} vues sans défilement en largeur${trop.length ? ' (débordent : ' + trop.join(', ') + ')' : ''}${w > 1000 ? ', la barre latérale à gauche du contenu' : ''} (TRV-014, étape ${w > 1000 ? 4 : 1})`);
      if (w === 320) {
        await aller('chantier'); await q.click('[data-act="task-new"]'); await q.waitForSelector('#dlg[open]'); await poser();
        const f = await q.evaluate(() => { const d = document.querySelector('#dlg').getBoundingClientRect();
          const coupes = [...document.querySelectorAll('#form input, #form select, #form textarea')].filter(x => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.left < d.left - 1 || r.right > d.right + 1); }).map(x => x.name);
          return { part: d.width / innerWidth, coupes }; });
        await q.keyboard.press('Escape'); await q.waitForFunction(() => !document.querySelector('#dlg').open);
        check(f.part >= 0.9 && !f.coupes.length, `à 320 px, le formulaire d’une tâche occupe ${Math.round(f.part * 100)} % de la largeur, aucun champ coupé${f.coupes.length ? ' (' + f.coupes.join(', ') + ')' : ''} (étape 3)`);
      }
    }
    await ctxT.close();
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await b.close(); }
})();
