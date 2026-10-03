/* Scénario de navigateur : les cibles tactiles (U10 de l'audit, docs/evolution-ui.md, règle 7). Sur un écran tactile
   simulé (390 × 844, pointeur grossier), chaque contrôle visible doit offrir 44 × 44 px à un doigt. On mesure ce que le
   doigt touche, pas la boîte dessinée : depuis le centre, on avance par demi-pixel tant que le point touche encore le
   contrôle (sa zone invisible ::after comprise, ou l'étiquette d'une case), et on s'arrête là où un voisin prend le
   relais. Exception : un lien dans le fil d'une phrase (« … dans Réglages »), que WCAG 2.5.8 exclut aussi.
   Chromium seulement : WebKit n'émule pas ici un pointeur grossier. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.claude = { use: async () => null }; });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  if (!await p.evaluate(() => matchMedia('(pointer:coarse)').matches)) {
    console.log('  – ce moteur ne simule pas d’écran tactile : mesure faite sous Chromium');
    await b.close(); return;
  }
  const mesurer = () => p.evaluate(async () => {
    const visible = e => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      // Le contenu d'un volet fermé ne se touche pas ; son titre, si, tant que ce volet n'est pas dans un autre, fermé.
      const titreDe = e.tagName === 'SUMMARY' ? e.parentElement : null;
      const replie = (titreDe ? titreDe.parentElement : e).closest('details:not([open])');
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('dialog:not([open])') && !replie; };
    const dansLaPhrase = e => e.tagName === 'A' && !e.classList.contains('btn') && getComputedStyle(e).display === 'inline';
    const touche = (e, x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h) || [...(e.labels || [])].some(l => l === h || l.contains(h))); };
    const petits = [];
    for (const e of document.querySelectorAll('a[href],button,input,select,textarea,summary')) {
      if (!visible(e) || dansLaPhrase(e)) continue;
      e.scrollIntoView({ block: 'center', inline: 'center' }); await new Promise(r => requestAnimationFrame(r));
      const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const portee = (dx, dy) => { let d = 0; while (d < 60 && touche(e, cx + dx * (d + .5), cy + dy * (d + .5))) d += .5; return d; };
      const w = touche(e, cx, cy) ? Math.round(portee(-1, 0) + portee(1, 0) + .5) : 0, h = w ? Math.round(portee(0, -1) + portee(0, 1) + .5) : 0;
      if (w < 44 || h < 44) petits.push(`${(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 30)} (${w}×${h})`);
    }
    return petits;
  });
  const ecran = async (nom, hash) => {
    await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(400);
    const petits = await mesurer();
    check(!petits.length, `${nom} : chaque contrôle offre 44 × 44 px au doigt${petits.length ? ' ; trop petits : ' + petits.join(', ') : ''}`);
  };

  console.log('compte neuf');
  await ecran('accueil, modèles proposés', 'accueil');
  await ecran('Réglages', 'reglages');

  console.log('un tableau de bord rempli');
  await p.evaluate(d => { localStorage.setItem('selene-site-v1', d); }, fixture());
  await p.reload(); await p.waitForTimeout(400);
  for (const [nom, hash] of [['accueil', 'accueil'], ['Réglages', 'reglages'], ['Tâches', 'chantier'], ['Écriture', 'ecriture'], ['Collection', 'october-moth'], ['Musique', 'musique'], ['Budget', 'budget'], ['Programme', 'kundalini'], ['Bilan', 'bilan'], ['Recherche', 'recherche']]) await ecran(nom, hash);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
