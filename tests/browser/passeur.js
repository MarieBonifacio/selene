/* Scénario de navigateur : le passeur côté Selene (connexions externes, phase 2, vague 6a : docs/connexions.md).
   Version hébergée simulée : un faux Supabase (compte, table) et un faux passeur. Lancé par tests/browser/run.js. */
const { storeJSON, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.sources = { type: 'collection', label: 'Sources',
  config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, display: 'liste', sources: true, statuses: ['À lire', 'Lue', 'Utilisée'], doneFrom: 1, addLabel: 'Ajouter à la main',
    fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Résumé et notes' } }, entries: [] };
demo.config.modules.push({ id: 'sources', on: true });
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const BLOG = `<!doctype html><html><head><title>Titre de repli</title>
  <meta property="og:title" content="Les phalènes de septembre <img src=x onerror=window.__pwn=1>">
  <meta property="og:site_name" content="Carnet des lisières"><meta property="og:description" content="Un relevé de nuit.">
  <meta property="og:url" content="https://ailleurs.example/usurpe"><link rel="canonical" href="https://lisieres.fr/phalenes/">
  <meta property="article:published_time" content="2026-09-20T21:00:00+02:00">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"x"},{"@type":"BlogPosting","headline":"h","author":[{"@type":"Person","name":"Iris Nuit"}]}]}</script>
  <link rel="alternate" type="application/rss+xml" title="Carnet des lisières (RSS)" href="/feed.xml">
  <script>window.__ran = 1</script></head><body>…</body></html>`;
const ARTICLE = `<html><head><meta name="citation_title" content="Depersonalization and the self"><meta name="citation_doi" content="10.1016/j.concog.2020.102946"></head></html>`;
const CROSSREF = { message: { DOI: '10.1016/j.concog.2020.102946', type: 'journal-article', title: ['Depersonalization and the self (Crossref)'], 'container-title': ['Consciousness and Cognition'], issued: { 'date-parts': [[2020, 5]] } } };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (mode = 'ok', path = '/index.html#sources') => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.passeur = []; p.microlink = 0; p.crossref = 0;
    const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    await ctx.route('https://*.supabase.co/**', route => {
      const req = route.request(), u = new URL(req.url());
      if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
      if (u.pathname === '/functions/v1/passeur') {
        const q = req.postDataJSON(), h = req.headers(); p.passeur.push({ ...q, auth: h.authorization, apikey: h.apikey });
        if (mode === 'absent') return route.fulfill({ status: 404, body: 'Function not found' });
        if (mode === 'refus') return json(route, 403, { erreur: "ce compte n'est pas autorisé à utiliser ce passeur" });
        if (q.url.endsWith('/feed.xml')) return json(route, 200, { status: 200, url: q.url, type: 'application/rss+xml', texte: '<rss><channel><title>Carnet des lisières</title><item><title>Un</title><link>https://www.lisieres.fr/un</link></item></channel></rss>' });
        const texte = q.url.includes('article') ? ARTICLE : q.url.includes('lisieres') ? BLOG : '<html><head><title>Selene</title></head></html>';
        return json(route, 200, { status: 200, url: q.url.replace('?utm_source=x', ''), type: 'text/html; charset=utf-8', etag: null, modifie: null, texte });
      }
      if (req.method() === 'GET') return json(route, 200, []);
      return route.fulfill({ status: 201, body: '' });
    });
    await ctx.route('https://api.microlink.io/**', r => { p.microlink++; json(r, 200, { status: 'success', data: { title: 'Par Microlink', url: 'https://www.lisieres.fr/phalenes' } }); });
    await ctx.route('https://api.crossref.org/**', r => { p.crossref++; json(r, 200, CROSSREF); });
    const session = JSON.stringify({ access_token: 'jeton-a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
    await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
    await p.goto(BASE + path); await p.waitForTimeout(700); return p;
  };
  const search = async (p, v) => { await p.fill('#srcIn', v); await p.click('[data-act="src-fetch"]'); await p.waitForTimeout(400); };

  console.log('une page lue par le passeur');
  const p = await open();
  ok((await p.textContent('.src-bar + .hint')).includes('par ton passeur'), 'connectée : les pages passent par ton passeur');
  await search(p, 'https://www.lisieres.fr/phalenes?utm_source=x');
  const q = p.passeur[0];
  ok(p.passeur.filter(x => x.genre === 'page').length === 1 && q.genre === 'page' && q.url.startsWith('https://www.lisieres.fr/phalenes') && q.auth === 'Bearer jeton-a' && q.apikey.startsWith('sb_'), 'un appel, avec ta session, pour une page');
  ok(p.microlink === 0, 'Microlink n’est pas sollicité');
  const prev = (await p.textContent('.src-prev')).replace(/\s+/g, ' ');
  ok(prev.includes('Les phalènes de septembre <img') && prev.includes('Iris Nuit') && prev.includes('Carnet des lisières') && prev.includes('Un relevé de nuit'), 'titre, autrice (JSON-LD), site, description');
  ok(prev.includes('Ce site publie un flux') && prev.includes('Carnet des lisières (RSS)'), 'le flux annoncé est repéré');
  ok(!(await p.evaluate(() => window.__pwn || window.__ran)), 'rien de la page ne s’exécute');
  await p.click('.src-prev [data-act="dehors-follow"]'); await p.waitForTimeout(400);
  const fl = await storeJSON(p, 'selene-site-v1').then(d => d.config.dehors.feeds);
  ok(fl.length === 1 && fl[0].url === 'https://www.lisieres.fr/feed.xml' && fl[0].title === 'Carnet des lisières' && (await p.textContent('#toast')).includes('Suivi dans Dehors'), '« le suivre dans Dehors » : le flux annoncé est suivi');
  await p.click('[data-act="src-keep"]'); await p.waitForTimeout(250);
  let e = (await storeJSON(p, 'selene-site-v1').then(d => d.modules.sources.entries))[0];
  ok(e && e.src.url === 'https://lisieres.fr/phalenes' && e.src.date === '2026-09-20' && e.subtitle === 'Iris Nuit', 'gardée : l’og:url d’un autre site est ignorée, l’adresse canonique du même site retenue ; date, autrice');
  await search(p, 'https://revue.example/article/42');
  ok(p.crossref === 1 && (await p.textContent('.src-prev')).includes('(Crossref)') && (await p.textContent('.src-prev')).includes('doi:10.1016/j.concog.2020.102946'), 'une page d’article qui porte son DOI : complétée par Crossref');

  console.log('passeur absent ou refusé');
  const a = await open('absent');
  await search(a, 'https://www.lisieres.fr/phalenes');
  ok(a.passeur.length === 1 && a.microlink === 1 && (await a.textContent('.src-prev')).includes('Par Microlink'), 'non déployé (404) : Microlink prend le relais');
  await a.click('[data-act="src-cancel"]'); await search(a, 'https://www.lisieres.fr/autre');
  ok(a.passeur.length === 1 && a.microlink === 2, 'et on n’insiste pas auprès d’un passeur absent');
  ok((await a.textContent('.src-bar + .hint')).includes('par Microlink'), 'le texte d’aide le dit');
  const rf = await open('refus');
  await search(rf, 'https://www.lisieres.fr/phalenes');
  ok(rf.passeur.length === 1 && rf.microlink === 1, 'compte non autorisé (403) : Microlink prend le relais');
  await rf.click('[data-act="src-cancel"]'); await search(rf, 'https://www.lisieres.fr/autre');
  ok(rf.passeur.length === 1 && rf.microlink === 2 && (await rf.textContent('.src-bar + .hint')).includes('par Microlink'), 'le refus est retenu : plus d’appel au passeur, et l’aide le dit');

  console.log('réglages');
  const r = await open('ok', '/index.html#reglages');
  ok((await r.textContent('#passeur')).includes(UID), 'ton identifiant, pour le secret PASSEUR_USERS');
  await r.click('[data-act="passeur-check"]'); await r.waitForTimeout(400);
  ok(r.passeur.length === 1 && r.passeur[0].url.endsWith('/index.html') && (await r.textContent('#passeur')).includes('Déployé'), 'Vérifier : le passeur lit la page de Selene elle-même, et répond');
  const f = await open('refus', '/index.html#reglages');
  await f.click('[data-act="passeur-check"]'); await f.waitForTimeout(400);
  ok((await f.textContent('#passeur')).includes("n'est pas autorisé") && (await f.textContent('#toast')).includes("n'est pas autorisé"), 'compte non listé : dit pourquoi');

  console.log('hors version hébergée');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const c = await ctx.newPage(); c.on('pageerror', e => errs.push(e.message));
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await c.goto(BASE + '/index.html#reglages'); await c.waitForTimeout(400);
  ok(!(await c.$('#passeur')), 'dans l’artefact claude.ai : pas de passeur');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
