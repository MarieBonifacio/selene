/* Scénario de navigateur : Dehors (connexions externes, phase 2, vague 6b : docs/connexions.md).
   Version hébergée simulée : faux Supabase, faux passeur qui sert des flux. Lancé par tests/browser/run.js. */
const { storeSet, storeJSON, until, ouvrir, entree, suivre, calme, fauxSupabase, synchro, engine, BASE, launchOptions, fixture, check } = require('./helpers');
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
  'https://vide.example/': { type: 'text/html', texte: '<html><head><title>Rien</title></head></html>' },
  'https://tard.example/rss.xml': { type: 'application/rss+xml', texte: '<?xml version="1.0"?><rss version="2.0"><channel><title>Pas de côté</title><item><title>Un pas de côté</title><link>https://tard.example/un</link><guid>t1</guid><pubDate>' + new Date(Date.now() - 3600000).toUTCString() + '</pubDate></item></channel></rss>' }
};
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const calls = [];
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  /* Le faux passeur répond comme le vrai : une demande sans genre (la sonde d'accès de Dehors) est refusée après les
     vérifications d'accès ; mode « refus » : le compte n'est pas dans PASSEUR_USERS. */
  const probes = { n: 0 }; let mode = 'ok', lent = ''; const retenues = []; // `lent` : une adresse que le faux passeur retient jusqu'à `lacher()` (A44)
  const lacher = () => { lent = ''; retenues.splice(0).forEach(r => r()); };
  const access = (route, q) => { // la réponse d'accès, ou null : la demande est à servir
    if (!q.genre) probes.n++;
    if (mode === 'refus') return json(route, 403, { erreur: "ce compte n'est pas autorisé à utiliser ce passeur", code: 'compte-non-autorise' });
    return q.genre ? null : json(route, 400, { erreur: 'genre inconnu', code: 'genre-inconnu' });
  };
  await fauxSupabase(ctx, (route, req, u) => {
    if (u.pathname === '/functions/v1/passeur') {
      const q = req.postDataJSON(), a = access(route, q); if (a) return a; calls.push(q);
      const servir = () => {
        const pg = PAGES[q.url];
        if (!pg) return json(route, 200, { status: 404, url: q.url, erreur: 'le site répond 404' });
        if (pg.etag && q.etag === pg.etag) return json(route, 200, { status: 304, url: q.url, etag: pg.etag });
        return json(route, 200, { status: 200, url: q.url, type: pg.type, etag: pg.etag || null, modifie: null, texte: pg.texte });
      };
      // Retenue, pas retardée : un délai fixe peut s'écouler avant la fin du geste qu'on veut glisser pendant l'attente.
      return q.url === lent ? new Promise(res => retenues.push(res)).then(servir) : servir();
    }
  });
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
  const p = suivre(await ctx.newPage()); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#dehors'); await p.waitForTimeout(600);
  const data = () => storeJSON(p, 'selene-site-v1');
  // Suivre se termine toujours par une bulle (« Suivi : … » ou le refus) : l'attendre, pas 400 ms (A23 : sous charge, le flux
  // Atom n'était pas encore lu).
  const follow = async (url, mod = '') => {
    await p.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await p.fill('#dehorsIn', url); await p.selectOption('#dehorsMod', mod); await p.click('[data-act="dehors-add"]');
    await p.waitForFunction(() => ((document.querySelector('#toast') || {}).textContent || '').trim(), null, { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  const titles = () => p.$$eval('.dehors .item', ls => ls.map(l => (l.querySelector('.t-title, b') || {}).textContent.replace(' ↗', '')));

  ok(!(await synchro(p)), 'synchronisé pour de vrai, sans « Non synchronisé » (BL-23)');
  console.log('suivre, découvrir');
  // La vue ne dit « Aucun flux suivi » qu'une fois la session prête : l'attendre, pas un délai (sous charge, 600 ms ne
  // suffisaient pas toujours, A10 du cahier de recette). Si elle ne vient pas en 10 s, la vérification échoue comme avant.
  await p.waitForFunction(() => !!document.querySelector('#nav a[href="#dehors"]') && (document.querySelector('#main') || {}).textContent?.includes('Aucun flux suivi'), null, { timeout: 10000 }).catch(() => {});
  ok(await p.isVisible('#nav a[href="#dehors"]') && (await p.textContent('#main')).includes('Aucun flux suivi'), 'une porte dans la navigation ; rien encore');
  // U5 de l'audit : le mot courant d'abord, le nom de Selene en second.
  ok((await p.textContent('#nav a[href="#dehors"]')).replace(/\s+/g, ' ').trim() === 'Nouveautés Dehors' && (await p.textContent('#main h2')).replace(/\s+/g, ' ').trim() === 'Nouveautés · Dehors', 'elle dit « Nouveautés », Dehors en second');
  await until(() => probes.n === 1);
  ok(probes.n === 1 && (await storeJSON(p, 'selene-passeur-acces')).etat === 'ok' && await p.isVisible('#dehorsIn'), 'une sonde : le passeur est ouvert à ce compte, on peut suivre un site');
  ok((await p.getAttribute('#dehorsIn', 'placeholder')) === "L'adresse d'un site ou d'un flux…", 'le champ dit ce qu’il attend : « L’adresse d’un site ou d’un flux… »');
  await follow('revue.example', 'ecriture'); await until(() => calls.length >= 2); // la page, puis le flux qu'elle annonce
  // Les deux premiers appels : le rafraîchissement lancé après le démarrage peut relire le flux tout juste suivi.
  ok(calls.slice(0, 2).map(c => c.url).join(' ') === 'https://revue.example/ https://revue.example/feed.xml' && calls.every(c => c.genre === 'feed'), 'une adresse de site : sa page annonce le flux, qui est suivi');
  let t = await titles();
  ok(t.length === 2 && t[0].startsWith('Les phalènes') && t[1] === 'Lien piégé' && !t.includes('Vieux numéro'), `la semaine écoulée seulement, du plus récent au plus ancien (${t.join(' | ')})`);
  ok((await p.textContent('#main h3')).includes('Écriture') && (await data()).config.dehors.feeds[0].title === 'Revue des lisières', 'rangé sous son projet, titré par le flux');
  ok((await p.textContent('#toast')) === 'Suivi : Revue des lisières.', '« Suivi : Revue des lisières. »');
  ok(!(await p.evaluate(() => window.__pwn)) && (await p.textContent('.dehors')).includes('Un relevé de nuit.'), 'titre piégé inerte ; résumé en texte');
  ok(!(await p.$('.dehors [data-item="r2"] a')), 'un lien javascript: n’est pas un lien');
  await follow('https://vide.example/');
  ok((await p.textContent('#toast')).includes('Aucun flux'), 'une page sans flux : dit');
  await follow('https://revue.example/feed.xml');
  ok((await p.textContent('#toast')).includes('déjà suivi'), 'un flux déjà suivi : dit');

  console.log('garder, noter, écarter');
  await follow('https://blog.example/atom.xml');
  /* L'élément lui-même, pas la seule bulle ; s'il manque, ce que l'écran disait (A39 : sous Firefox, le 7 octobre 2026, run
     37567485400, il n'était pas venu, et rien ne disait pourquoi). */
  const atom = await p.waitForSelector('[data-item="a1"] a', { timeout: 10000 }).then(() => true, () => false);
  const projets = await p.$$eval('#main h3', hs => hs.map(h => h.textContent));
  ok(atom && projets.includes('Sans projet') && (await p.getAttribute('[data-item="a1"] a', 'href')) === 'https://blog.example/un', 'Atom : sans projet ; lien relatif résolu'
    + (atom ? '' : ` (bulle : « ${(await p.textContent('#toast')).trim()} » ; projets : ${projets.join(', ')} ; éléments : ${(await titles()).join(' | ')} ; appels au passeur : ${calls.map(c => c.url).join(', ')})`));
  await p.click('[data-item="r1"] [data-act="dehors-keep"]'); await p.waitForTimeout(250);
  const s = (await data()).modules.sources.entries[0];
  ok(s && s.title.startsWith('Les phalènes') && s.src.url === 'https://revue.example/phalenes' && s.src.site === 'Revue des lisières' && s.origin.from === 'Dehors', 'garder : une source, avec son site et sa provenance');
  ok(!(await p.$('[data-item="r1"]')), 'et elle quitte Dehors');
  if (atom) { await p.click('[data-item="a1"] [data-act="dehors-note"]'); await p.waitForTimeout(250); }
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
  // Le Carnet (Atom). Le rafraîchissement de Dehors, lancé en arrière-plan après le chargement, refait le rendu et
  // referme la liste : s'il tombe entre l'ouverture et le clic (WebKit, plus lent), la case est cachée. Rouvrir et
  // cocher jusqu'à ce que le réglage soit pris ; l'effet est vérifié juste après.
  const motifs = '[data-feed] [data-act="dehors-motifs"] >> nth=1';
  for (let i = 0; i < 5 && !(await p.$eval(motifs, el => el.checked).catch(() => false)); i++) {
    await p.evaluate(() => { const d = document.querySelector('details.dehors-feeds'); if (d) d.open = true; });
    await p.click(motifs, { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
  }
  ok(!(await p.$('[data-item="a1"]')) && (await p.textContent('[data-item="a2"]')).includes('phalène'), 'seulement ce qui touche mes motifs : le motif est nommé');

  console.log('vu jusqu’à, relecture conditionnelle');
  /* Des états, pas des délais (A25 : sous WebKit, 250 ms après le clic, le stockage n'avait pas encore les dates « vu »).
     Une lecture des flux en cours (« Lecture des flux… ») refait le rendu à sa fin, et prend la place de « Rien de
     neuf » : la laisser finir avant le clic. L'écriture part dans IndexedDB sans être attendue : l'attendre. */
  const lit = () => p.evaluate(() => ((document.querySelector('#main') || {}).textContent || '').includes('Lecture des flux'));
  const vus = async () => ((await data()).config.dehors || { feeds: [] }).feeds.every(f => f.seen > Date.now() - 60000);
  const jusqua = async (cond, ms = 10000) => { for (const end = Date.now() + ms; !(await cond()) && Date.now() < end;) await p.waitForTimeout(100); return cond(); };
  await jusqua(async () => !(await lit()));
  await p.click('[data-act="dehors-seen"]');
  const rien = await jusqua(async () => (await p.textContent('#main')).includes('Rien de neuf')), stocke = await jusqua(vus);
  ok(rien && stocke, 'tout marqué comme vu, et c’est synchronisé' + (rien && stocke ? '' : ` (« Rien de neuf » : ${rien} ; dates « vu » enregistrées : ${stocke})`));
  { const bulle = await p.textContent('#toast'), dit = bulle.includes("Tout est vu. Dehors se tait jusqu'à la prochaine parution.");
    ok(dit, '« Tout est vu. Dehors se tait jusqu’à la prochaine parution. »' + (dit ? '' : ` (la bulle : « ${bulle} »)`)); }
  calls.length = 0;
  await p.click('[data-act="dehors-refresh"]');
  await jusqua(async () => calls.length >= 3 && !(await lit()));
  ok(calls.length === 3 && calls.find(c => c.url.endsWith('feed.xml')).etag === '"r-v1"', 'relire : un appel par flux, l’ETag renvoyé (le site répond 304)');
  await calme(p); await ouvrir(p, BASE + '/index.html', entree);
  const go = await p.$('.dehors-go');
  ok(!go, 'plus rien de neuf : l’accueil se tait' + (go ? ` (« ${(await go.textContent()).trim()} »)` : ''));
  calls.length = 0;
  await calme(p); await ouvrir(p, null, entree); await p.waitForTimeout(2200); // une absence ne s'attend pas : le délai court depuis le démarrage (A16)
  ok(calls.length === 0, 'rouvert dans les trois heures : aucune relecture');
  { const c = await storeJSON(p, 'selene-dehors'); c.at = 0; await storeSet(p, 'selene-dehors', JSON.stringify(c)); }
  await calme(p); await ouvrir(p, null, entree); await until(() => calls.length >= 3);
  ok(calls.length === 3, 'rouvert plus tard : les flux sont relus, un par un');

  console.log('passeur fermé à ce compte');
  {
    mode = 'refus'; probes.n = 0;
    const ctx3 = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await fauxSupabase(ctx3, (route, req, u) => {
      if (u.pathname === '/functions/v1/passeur') { const q = req.postDataJSON(); return access(route, q) || json(route, 200, { status: 200, url: q.url, type: 'text/html', texte: '<html></html>' }); }
    });
    await ctx3.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
    const f = suivre(await ctx3.newPage()); f.on('pageerror', e => errs.push(e.message));
    await f.goto(BASE + '/index.html#dehors'); await until(() => probes.n === 1); await f.waitForTimeout(300);
    const m = (await f.textContent('#main')).replace(/\s+/g, ' ');
    ok(m.includes("Il n'est pas ouvert à ce compte") && !(await f.$('#dehorsIn')) && !m.includes('Kill the Newsletter'), 'le passeur refuse ce compte : Dehors le dit, et ne propose plus de suivre un site');
    ok(m.includes("Rien de suivi pour l'instant") && await f.isVisible('#oaIn'), 'la veille de recherche, qui s’en passe, reste là');
    const acc = await storeJSON(f, 'selene-passeur-acces');
    ok(acc.etat === 'refuse' && acc.uid === UID, 'l’accès est retenu pour ce compte');
    await calme(f); await f.reload(); await f.waitForTimeout(800);
    ok(probes.n === 1 && !(await f.$('#dehorsIn')), 'rouvert : aucune nouvelle sonde (retenu un jour)');
    mode = 'ok';
    await f.click('.dehors-ferme [data-act="passeur-check"]'); await f.waitForTimeout(500);
    ok(await f.isVisible('#dehorsIn') && (await storeJSON(f, 'selene-passeur-acces')).etat === 'ok', '« Vérifier à nouveau » : ouvert depuis, le champ revient');
    await ctx3.close();
  }

  console.log('retirer, hors version hébergée');
  await p.goto(BASE + '/index.html#dehors'); await p.waitForTimeout(400);
  const gone = (await data()).config.dehors.feeds[0].id;
  await p.click('details.dehors-feeds summary'); await p.click('[data-feed] [data-act="dehors-del"] >> nth=0'); await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(300);
  const cached = Object.keys(await storeJSON(p, 'selene-dehors').then(d => d.feeds));
  ok((await data()).config.dehors.feeds.length === 2 && !(await data()).config.dehors.feeds.some(f => f.id === gone) && !cached.includes(gone) && cached.length === 2, 'retiré, avec son cache');
  const ctx2 = await b.newContext(); const c = await ctx2.newPage(); c.on('pageerror', e => errs.push(e.message));
  await ctx2.addInitScript(d => { window.claude = { use: async () => null }; localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await c.goto(BASE + '/index.html#dehors'); await c.waitForTimeout(400);
  ok(!(await c.$('#nav a[href="#dehors"]')) && (await c.$('.hero')), 'dans l’artefact claude.ai : pas de Dehors, retour à l’accueil');

  console.log('suivre un flux pendant une relecture (A44)');
  // Une relecture en cours attend un site lent ; pendant ce temps, on suit un autre flux. Avant le correctif, la relecture
  // réécrivait au retour tout le cache lu avant d'attendre : le flux suivi entre-temps perdait ses éléments.
  lent = (await data()).config.dehors.feeds[0].url; calls.length = 0;
  await p.click('[data-act="dehors-refresh"]');
  await jusqua(() => calls.some(c => c.url === lent));
  await follow('https://tard.example/rss.xml');
  const enCours = await lit();
  lacher();
  await jusqua(async () => !(await lit()), 15000);
  const tard = ((await data()).config.dehors.feeds.find(f => f.url === 'https://tard.example/rss.xml') || {}).id;
  const garde = ((((await storeJSON(p, 'selene-dehors')) || {}).feeds || {})[tard] || {}).items || [];
  ok(enCours && garde.length === 1 && (await titles()).includes('Un pas de côté'), `suivi pendant que la relecture attendait un site : ses éléments restent, au cache et à l’écran (${garde.length} élément)` + (enCours ? '' : ' (la relecture était déjà finie)'));

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
