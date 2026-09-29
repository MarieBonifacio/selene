/* Scénario de navigateur : Dehors (connexions externes, phase 2, vague 6b : docs/connexions.md).
   Version hébergée simulée : faux Supabase, faux passeur qui sert des flux. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
const col = (label, extra) => ({ type: 'collection', label, config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, display: 'liste', statuses: ['À lire', 'Lue'], doneFrom: 1, addLabel: 'Ajouter',
  fields: { title: 'Titre', subtitle: 'Variantes', tag: '', due: '', text: 'Notes' }, ...extra }, entries: [] });
demo.modules.sources = col('Sources', { sources: true });
demo.modules.motifs = col('Motifs', { concordance: true });
demo.modules.motifs.entries = [{ id: 'm1', title: 'phalène', subtitle: '', tag: '', due: '', text: '', status: 'À lire' }];
demo.config.modules.push({ id: 'sources', on: true }, { id: 'motifs', on: true });
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const ago = h => new Date(Date.now() - h * 3600000).toUTCString();
const RSS = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Revue des lisières</title>
  <item><title>Les phalènes &lt;img src=x onerror=window.__pwn=1&gt;</title><link>https://revue.example/phalenes</link><guid>r1</guid><pubDate>${ago(5)}</pubDate><description>&lt;p&gt;Un relevé &lt;b&gt;de nuit&lt;/b&gt;.&lt;/p&gt;</description></item>
  <item><title>Lien piégé</title><link>javascript:alert(1)</link><guid>r2</guid><pubDate>${ago(30)}</pubDate></item>
  <item><title>Vieux numéro</title><link>https://revue.example/vieux</link><guid>r3</guid><pubDate>${ago(24 * 20)}</pubDate></item></channel></rss>`;
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Carnet</title>
  <entry><id>a1</id><title>Atom un</title><link rel="alternate" href="/un"/><updated>${new Date(Date.now() - 2 * 3600000).toISOString()}</updated><summary>Premier.</summary></entry>
  <entry><id>a2</id><title>Une phalène au balcon</title><link href="https://blog.example/deux"/><published>${new Date(Date.now() - 3 * 3600000).toISOString()}</published></entry></feed>`;
const JSONFEED = JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: 'Kiosque', items: Array.from({ length: 14 }, (_, i) => ({ id: 'j' + i, title: `Brève ${i}`, url: `https://news.example/${i}`, date_published: new Date(Date.now() - (i + 10) * 3600000).toISOString() })) });
const PAGES = {
  'https://revue.example/': { type: 'text/html', texte: '<html><head><link rel="alternate" type="application/rss+xml" title="Revue (RSS)" href="/feed.xml"></head></html>' },
  'https://revue.example/feed.xml': { type: 'application/rss+xml', texte: RSS, etag: '"r-v1"' },
  'https://blog.example/atom.xml': { type: 'application/atom+xml', texte: ATOM },
  'https://news.example/feed.json': { type: 'application/feed+json', texte: JSONFEED },
  'https://vide.example/': { type: 'text/html', texte: '<html><head><title>Rien</title></head></html>' }
};
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const calls = [];
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await ctx.route('https://*.supabase.co/**', route => {
    const req = route.request(), u = new URL(req.url());
    if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
    if (u.pathname === '/functions/v1/passeur') {
      const q = req.postDataJSON(); calls.push(q);
      const pg = PAGES[q.url];
      if (!pg) return json(route, 200, { status: 404, url: q.url, erreur: 'le site répond 404' });
      if (pg.etag && q.etag === pg.etag) return json(route, 200, { status: 304, url: q.url, etag: pg.etag });
      return json(route, 200, { status: 200, url: q.url, type: pg.type, etag: pg.etag || null, modifie: null, texte: pg.texte });
    }
    if (req.method() === 'GET') return json(route, 200, []);
    return route.fulfill({ status: 201, body: '' });
  });
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#dehors'); await p.waitForTimeout(600);
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const follow = async (url, mod = '') => { await p.fill('#dehorsIn', url); await p.selectOption('#dehorsMod', mod); await p.click('[data-act="dehors-add"]'); await p.waitForTimeout(400); };
  const titles = () => p.$$eval('.dehors .item', ls => ls.map(l => (l.querySelector('.t-title, b') || {}).textContent.replace(' ↗', '')));

  console.log('suivre, découvrir');
  ok(await p.isVisible('#nav a[href="#dehors"]') && (await p.textContent('#main')).includes('Aucun flux suivi'), 'une porte dans la navigation ; rien encore');
  await follow('revue.example', 'ecriture');
  ok(calls.map(c => c.url).join(' ') === 'https://revue.example/ https://revue.example/feed.xml' && calls.every(c => c.genre === 'feed'), 'une adresse de site : sa page annonce le flux, qui est suivi');
  let t = await titles();
  ok(t.length === 2 && t[0].startsWith('Les phalènes') && t[1] === 'Lien piégé' && !t.includes('Vieux numéro'), `la semaine écoulée seulement, du plus récent au plus ancien (${t.join(' | ')})`);
  ok((await p.textContent('#main h3')).includes('Écriture') && (await data()).config.dehors.feeds[0].title === 'Revue des lisières', 'rangé sous son projet, titré par le flux');
  ok(!(await p.evaluate(() => window.__pwn)) && (await p.textContent('.dehors')).includes('Un relevé de nuit.'), 'titre piégé inerte ; résumé en texte');
  ok(!(await p.$('.dehors [data-item="r2"] a')), 'un lien javascript: n’est pas un lien');
  await follow('https://vide.example/');
  ok((await p.textContent('#toast')).includes('Aucun flux'), 'une page sans flux : dit');
  await follow('https://revue.example/feed.xml');
  ok((await p.textContent('#toast')).includes('déjà suivi'), 'un flux déjà suivi : dit');

  console.log('garder, noter, écarter');
  await follow('https://blog.example/atom.xml');
  ok((await p.$$eval('#main h3', hs => hs.map(h => h.textContent))).includes('Sans projet') && (await p.getAttribute('[data-item="a1"] a', 'href')) === 'https://blog.example/un', 'Atom : sans projet ; lien relatif résolu');
  await p.click('[data-item="r1"] [data-act="dehors-keep"]'); await p.waitForTimeout(250);
  const s = (await data()).modules.sources.entries[0];
  ok(s && s.title.startsWith('Les phalènes') && s.src.url === 'https://revue.example/phalenes' && s.src.site === 'Revue des lisières' && s.origin.from === 'Dehors', 'garder : une source, avec son site et sa provenance');
  ok(!(await p.$('[data-item="r1"]')), 'et elle quitte Dehors');
  await p.click('[data-item="a1"] [data-act="dehors-note"]'); await p.waitForTimeout(250);
  ok((await data()).modules.inbox.entries.some(e => e.text === 'Atom un — https://blog.example/un'), 'vers une note : dans la boîte');
  await p.click('[data-item="r2"] [data-act="dehors-hide"]'); await p.waitForTimeout(200);
  ok(!(await p.$('[data-item="r2"]')), '« vu » écarte un élément');

  console.log('douze au plus, motifs');
  await follow('https://news.example/feed.json', 'musique');
  t = await titles();
  ok(t.length === 12 && (await p.textContent('#main')).includes('Et 3 autres, qui attendront'), `douze au plus ; le reste compté (${t.length})`);
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500);
  ok((await p.textContent('.dehors-go')).includes('Dehors : 15 nouveautés'), 'sur l’accueil : une ligne de texte, pas de pastille');
  await p.goto(BASE + '/index.html#dehors'); await p.waitForTimeout(400);
  await p.click('details.dehors-feeds summary'); await p.check('[data-feed] [data-act="dehors-motifs"] >> nth=1'); await p.waitForTimeout(300); // le Carnet (Atom)
  ok(!(await p.$('[data-item="a1"]')) && (await p.textContent('[data-item="a2"]')).includes('phalène'), 'seulement ce qui touche mes motifs : le motif est nommé');

  console.log('vu jusqu’à, relecture conditionnelle');
  await p.click('[data-act="dehors-seen"]'); await p.waitForTimeout(250);
  ok((await p.textContent('#main')).includes('Rien de neuf') && (await data()).config.dehors.feeds.every(f => f.seen > Date.now() - 60000), 'tout marqué comme vu, et c’est synchronisé');
  calls.length = 0;
  await p.click('[data-act="dehors-refresh"]'); await p.waitForTimeout(700);
  ok(calls.length === 3 && calls.find(c => c.url.endsWith('feed.xml')).etag === '"r-v1"', 'relire : un appel par flux, l’ETag renvoyé (le site répond 304)');
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  ok(!(await p.$('.dehors-go')), 'plus rien de neuf : l’accueil se tait');
  calls.length = 0;
  await p.reload(); await p.waitForTimeout(2200);
  ok(calls.length === 0, 'rouvert dans les trois heures : aucune relecture');
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('selene-dehors')); c.at = 0; localStorage.setItem('selene-dehors', JSON.stringify(c)); });
  await p.reload(); await p.waitForTimeout(2500);
  ok(calls.length === 3, 'rouvert plus tard : les flux sont relus, un par un');

  console.log('retirer, hors version hébergée');
  await p.goto(BASE + '/index.html#dehors'); await p.waitForTimeout(400);
  const gone = (await data()).config.dehors.feeds[0].id;
  await p.click('details.dehors-feeds summary'); await p.click('[data-feed] [data-act="dehors-del"] >> nth=0'); await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(300);
  const cached = Object.keys(await p.evaluate(() => JSON.parse(localStorage.getItem('selene-dehors')).feeds));
  ok((await data()).config.dehors.feeds.length === 2 && !(await data()).config.dehors.feeds.some(f => f.id === gone) && !cached.includes(gone) && cached.length === 2, 'retiré, avec son cache');
  const ctx2 = await b.newContext(); const c = await ctx2.newPage(); c.on('pageerror', e => errs.push(e.message));
  await ctx2.addInitScript(d => { window.claude = { use: async () => null }; localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await c.goto(BASE + '/index.html#dehors'); await c.waitForTimeout(400);
  ok(!(await c.$('#nav a[href="#dehors"]')) && (await c.$('.hero')), 'dans l’artefact claude.ai : pas de Dehors, retour à l’accueil');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
