/* Scénario de navigateur : motifs croisés dans Dehors (phase 3, vague 7c : docs/connexions.md).
   Version hébergée simulée : faux Supabase, faux passeur qui sert deux flux, OpenAlex simulé pour une veille.
   Lancé par tests/browser/run.js. */
const { storeJSON, storeSet, storeGet, ouvrir, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
const col = (label, extra) => ({ type: 'collection', label, config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, display: 'liste', statuses: ['À lire', 'Lue'], doneFrom: 1, addLabel: 'Ajouter',
  fields: { title: 'Titre', subtitle: 'Auteurs', tag: '', due: '', text: 'Notes' }, ...extra }, entries: [] });
demo.modules.sources = col('Sources', { sources: true });
demo.modules.sources.entries = [
  { id: 's1', title: 'Depersonalization and the self', subtitle: 'Anna Ciaunica, Collectif', tag: '', due: '', text: '', status: 'À lire', src: { url: 'https://doi.org/10.1000/a', doi: '10.1000/a' } },
  { id: 's2', title: 'Un billet déjà gardé', subtitle: '', tag: '', due: '', text: '', status: 'À lire', src: { url: 'https://revue.example/deja' } }];
demo.modules.motifs = col('Motifs', { concordance: true });
demo.modules.motifs.entries = [{ id: 'm1', title: 'phalène', subtitle: '', tag: '', due: '', text: '', status: 'À lire' }];
demo.config.modules.push({ id: 'sources', on: true }, { id: 'motifs', on: true });
const week = Date.now() - 7 * 86400000;
demo.config.dehors = { feeds: [{ id: 'fa', url: 'https://revue.example/feed.xml', title: 'Revue des lisières', mod: '', seen: week }, { id: 'fb', url: 'https://blog.example/feed.xml', title: 'Blog B', mod: '', seen: week }],
  research: [{ id: 'r1', kind: 'q', q: 'bodily self', seen: week }] };
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const ago = h => new Date(Date.now() - h * 3600000).toUTCString();
const rss = (title, items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>${items.map(([g, t, l, h]) => `<item><title>${t}</title><link>${l}</link><guid>${g}</guid><pubDate>${ago(h)}</pubDate></item>`).join('')}</channel></rss>`;
const FEEDS = {
  'https://revue.example/feed.xml': rss('Revue des lisières', [['a1', 'Sans rapport', 'https://revue.example/1', 1], ['a2', 'Relevé des phalènes', 'https://revue.example/2', 6],
    ['a3', 'Le même article', 'https://doi.org/10.1000/x', 4], ['a4', 'Un billet déjà gardé', 'https://revue.example/deja', 2]]),
  'https://blog.example/feed.xml': rss('Blog B', [['b1', 'Le même article, repris', 'https://doi.org/10.1000/X', 3], ['b2', 'Autre chose', 'https://blog.example/2', 8]])
};
// La veille : un article d'Anna Ciaunica (auteure de tes sources), qui cite W1 (ta source 10.1000/a, connue du cache « cité par tes sources »).
const WORK = { id: 'https://openalex.org/W50', doi: 'https://doi.org/10.1000/z', title: 'The bodily self revisited', publication_date: '2026-09-20', type: 'article',
  primary_location: { source: { display_name: 'Mind' } }, authorships: [{ author: { display_name: 'Anna Ciaunica' } }], referenced_works: ['https://openalex.org/W1', 'https://openalex.org/W999'] };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await ctx.route('https://*.supabase.co/**', route => {
    const req = route.request(), u = new URL(req.url());
    if (u.pathname === '/functions/v1/passeur') { const q = req.postDataJSON(), t = FEEDS[q.url]; return json(route, 200, t ? { status: 200, url: q.url, type: 'application/rss+xml', texte: t } : { status: 404, url: q.url, erreur: 'le site répond 404' }); }
    if (req.method() === 'GET') return json(route, 200, u.pathname.startsWith('/auth/') ? {} : []);
    return route.fulfill({ status: 201, body: '' });
  });
  await ctx.route('https://api.openalex.org/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results: [WORK] }) }));
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const cites = JSON.stringify({ works: { '10.1000/a': { id: 'W1', refs: [], authors: [], at: Date.now() } }, titles: {} });
  await ctx.addInitScript(([d, s, uid, c]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); localStorage.setItem('selene-cites', c); } }, [JSON.stringify(demo), session, UID, cites]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  // La relecture part 1,5 s après l'ouverture, une fois l'app démarrée et connectée : attendre ses six éléments, veille
  // comprise, plutôt qu'un délai (A16 du cahier de recette).
  const relu = () => document.querySelectorAll('.dehors .item').length >= 6 && document.querySelector('.dehors').textContent.includes('The bodily self revisited');
  await ouvrir(p, BASE + '/index.html#dehors', relu).catch(() => {});
  const rows = () => p.$$eval('.dehors .item', ls => ls.map(l => ({ t: (l.querySelector('.t-title, b') || {}).textContent.replace(' ↗', ''), why: (l.querySelector('.why') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(), row: l.querySelector('.row').textContent })));

  console.log('ce qui croise ce que tu gardes passe devant, et dit pourquoi');
  let r = await rows();
  ok(r.length === 6, `six éléments : le même article, paru dans deux flux, n'est compté qu'une fois (${r.map(x => x.t).join(' | ')})`);
  ok(r[0].t === 'The bodily self revisited' && r[0].why === 'parce que : auteur de tes sources : Anna Ciaunica · cite « Depersonalization and the self », de tes sources', `d'abord le plus de raisons : un auteur de tes sources, une de tes sources citée (${r[0].why})`);
  ok(r[1].t === 'Le même article' && r[1].why === 'parce que : aussi dans Blog B' && r[2].t === 'Relevé des phalènes' && r[2].why === 'parce que : motif : phalène', 'puis une raison chacun, du plus récent au plus ancien : un lien paru dans deux flux, un motif');
  ok(r.slice(3).map(x => x.t).join() === 'Sans rapport,Un billet déjà gardé,Autre chose' && r.slice(3).every(x => !x.why), 'puis le reste, sans raison inventée, du plus récent au plus ancien');
  ok(r.find(x => x.t === 'Un billet déjà gardé').row.includes('déjà gardée') && !r.find(x => x.t === 'Un billet déjà gardé').row.includes('garder'), 'ce qui est déjà dans tes sources le dit, au lieu d’un « garder »');
  ok(!(await storeGet(p, 'selene-dehors')).includes('W999'), 'des références de la veille, le cache ne garde que ce qui croise tes sources');

  console.log('écarté une fois');
  await p.click('.dehors .item:nth-child(2) [data-act="dehors-hide"]'); await p.waitForTimeout(200);
  r = await rows();
  ok(!r.some(x => x.t.startsWith('Le même article')), '« vu » sur un lien paru dans deux flux : il ne revient pas par l’autre');

  console.log('un auteur suivi n’est pas une raison de plus');
  { const d = await storeJSON(p, 'selene-site-v1'); d.config.dehors.research[0].kind = 'author'; d.config.dehors.research[0].q = 'A5023888391'; await storeSet(p, 'selene-site-v1', JSON.stringify(d)); }
  await ouvrir(p, null, relu).catch(() => {});
  r = await rows();
  ok(r[0].t === 'The bodily self revisited' && r[0].why === 'parce que : cite « Depersonalization and the self », de tes sources', `la veille d'un auteur : son nom ne compte pas comme raison (${r[0].why})`);

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
