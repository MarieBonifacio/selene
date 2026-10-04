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
    // Une adresse inconnue retombe sur l'accueil, sans bruit : on mesurerait l'accueil deux fois en croyant mesurer l'espace.
    const shown = await p.evaluate(() => { const a = document.querySelector('#nav [aria-current="page"]'); return a ? a.getAttribute('href') : ''; });
    if (shown !== '#' + hash) return check(false, `${nom} : #${hash} affiche ${shown || 'autre chose'}`);
    const petits = await mesurer();
    check(!petits.length, `${nom} : chaque contrôle offre 44 × 44 px au doigt${petits.length ? ' ; trop petits : ' + petits.join(', ') : ''}`);
  };

  console.log('compte neuf');
  await ecran('accueil, modèles proposés', 'accueil');
  await ecran('Réglages', 'reglages');

  console.log('un tableau de bord rempli');
  // Le jeu d'essai, plus un espace Sources (absent du jeu) : ses liens « ouvrir ↗ » et ses boutons d'export.
  const rempli = JSON.parse(fixture());
  rempli.modules.sources = { type: 'collection', label: 'Sources', config: { ...JSON.parse(JSON.stringify(rempli.modules.musique.config)), music: false, display: 'liste', sources: true,
    statuses: ['À lire', 'Lue'], doneFrom: 1, fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Résumé' } }, entries: [
    { id: 's1', title: 'Depersonalization and the self', subtitle: 'Anna Ciaunica', tag: 'article', status: 'À lire', text: 'Un résumé.', date: '2026-09-28',
      src: { doi: '10.1016/j.concog.2020.102946', url: 'https://doi.org/10.1016/j.concog.2020.102946', site: 'Consciousness and Cognition', date: '2020-05-12' } },
    { id: 's2', title: 'La lisière', subtitle: '', tag: 'page', status: 'Lue', text: '', date: '2026-10-01', src: { url: 'https://www.sousbois.fr/lisiere', site: 'Revue des sous-bois' } }] };
  rempli.config.modules.push({ id: 'sources', on: true });
  await p.evaluate(d => { localStorage.setItem('selene-site-v1', d); }, JSON.stringify(rempli));
  await p.reload(); await p.waitForTimeout(400);
  for (const [nom, hash] of [['accueil', 'accueil'], ['Réglages', 'reglages'], ['Tâches', 'chantier'], ['Écriture', 'ecriture'], ['Collection', 'moth'], ['Musique', 'musique'], ['Budget', 'budget'], ['Programme', 'kundalini'], ['Rappels', 'phidippus'], ['Boîte', 'inbox'], ['Sources', 'sources'], ['Bilan', 'bilan'], ['Recherche', 'recherche']]) await ecran(nom, hash);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
