/* Scénario de navigateur : Radar culturel (connexions externes, phase 1, vague 5d : docs/connexions.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check, until } = require('./helpers');
const LILLE = { name: 'Lille, Hauts-de-France, France', lat: 50.6, lon: 3.1, weather: false, realMoon: true };
const site = (sky, words) => { const d = JSON.parse(fixture()); d.config.sky = sky; if (words) d.config.radar = { words }; return JSON.stringify(d); };
const rec = (uid, title, from, to, extra = {}) => ({ uid, title_fr: title, firstdate_begin: from + 'T18:00:00+02:00', lastdate_end: (to || from) + 'T22:00:00+02:00',
  timings: JSON.stringify([{ begin: from + 'T18:00:00+02:00', end: (to || from) + 'T22:00:00+02:00' }]),
  location_name: 'La Condition publique', location_city: 'Roubaix', canonicalurl: `https://openagenda.com/lille/events/${uid}`, keywords_fr: [], description_fr: '', ...extra });
const RESULTS = [
  rec(1, 'Marché aux puces', '2026-09-29'),
  rec(2, 'Nuit de la poésie <img src=x onerror=window.__pwn=1>', '2026-10-02', null, { description_fr: '<p>Lectures à voix haute, micro ouvert.</p>' }),
  rec(3, 'Exposition « Lumières du Nord »', '2026-09-01', '2026-11-15', { keywords_fr: ['Photographie'] }),
  rec(4, 'Soirée jazz manouche', '2026-10-06', null, { location_name: 'Le Biplan', location_city: 'Lille' }),
  ...[5, 6, 7, 8].map(n => rec(n, `Jazz au bar ${n}`, `2026-10-${String(n + 3).padStart(2, '0')}`))
];
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (sky, words, mode = 'ok', hash = '', hosted = false) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.asked = []; p.passeur = [];
    await ctx.route('https://public.opendatasoft.com/**', async r => {
      const u = new URL(r.request().url()); p.asked.push(u);
      if (mode === 'slow' && p.asked.length === 1) {
        await new Promise(resolve => { p.release = resolve; });
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ total_count: 1, results: [rec(900, 'Jazz ancien', '2026-10-02')] }) }).catch(() => {});
      }
      if (mode === 'cors') return r.abort('failed'); // ce que voit le navigateur quand le portail n'envoie pas d'en-tête CORS
      if (mode === 'down') return r.fulfill({ status: 503, body: '' });
      if (mode === 'renamed') return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error_code":"ODSQLError"}' });
      if (mode === 'html') return r.fulfill({ contentType: 'text/html', body: '<html>Portail déplacé</html>' });
      if (mode === 'schema') return r.fulfill({ contentType: 'application/json', body: '{}' });
      if (mode === 'empty') return r.fulfill({ contentType: 'application/json', body: '{"total_count":0,"results":[]}' });
      if (mode === 'pages' || mode === 'partial') {
        const offset = +u.searchParams.get('offset');
        if (offset && mode === 'partial') return r.fulfill({ status: 503, body: '' });
        const rows = offset ? [rec(101, 'Jazz après la première page', '2026-10-08')] : Array.from({ length: 100 }, (_, i) => rec(i, 'Autre événement', '2026-10-02'));
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ total_count: 101, results: rows }) });
      }
      r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ total_count: RESULTS.length, results: RESULTS }) });
    });
    await ctx.route('https://*.supabase.co/**', r => {
      const req = r.request();
      if (new URL(req.url()).pathname === '/functions/v1/passeur') { const q = req.postDataJSON(); p.passeur.push(q); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 200, url: q.url, type: 'application/json; charset=utf-8', texte: JSON.stringify({ total_count: RESULTS.length, results: RESULTS }) }) }); }
      r.fulfill({ contentType: 'application/json', body: req.method() === 'GET' ? '[]' : '{}' });
    });
    const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.parse('2026-09-28T08:00:00Z') / 1000) + 3600, user: { id: '0b8f0c2e-1111-2222-3333-444455556666', email: 'a@b.c' } });
    await ctx.addInitScript(([d, h, s]) => { if (!h) window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); if (h) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', '0b8f0c2e-1111-2222-3333-444455556666'); } } }, [site(sky, words), hosted, session]);
    await p.clock.setFixedTime(new Date('2026-09-28T10:00:00+02:00')); await p.goto(BASE + '/index.html' + hash); await p.waitForTimeout(500);
    return p;
  };
  const sheet = async p => (await p.textContent('#sheetBody')).replace(/\s+/g, ' ');

  console.log('à la demande, depuis l’accueil');
  const p = await open(LILLE, 'Poésie, jazz, photographie');
  ok(!p.asked.length, 'rien n’est demandé à l’ouverture : on tire, rien n’est poussé');
  await p.click('[data-act="radar-open"]'); await p.waitForTimeout(400);
  ok(p.asked.length === 1, 'un appel, au clic');
  const u = p.asked[0], all = decodeURIComponent(u.toString()).toLowerCase();
  ok(!/poesie|poésie|jazz|photo/.test(all) && u.searchParams.get('where').includes("POINT(3.1 50.6)"), 'le portail reçoit la zone et les dates, jamais les mots');
  const titles = await p.$$eval('#sheet .radar b', bs => bs.map(x => x.textContent));
  ok(titles.length === 5 && titles[0].startsWith('Exposition') && titles[1].startsWith('Nuit de la poésie') && titles[2] === 'Soirée jazz manouche' && !titles.includes('Marché aux puces'), `cinq au plus, du plus tôt au plus tard, filtrés par tes mots (${titles.join(' | ')})`);
  let t = await sheet(p);
  ok(t.includes('parle de : Poésie, jazz, photographie') && t.includes('en cours, jusqu\'au 15 novembre') && t.includes('vendredi 2 octobre') && t.includes('La Condition publique, Roubaix'), 'quand et où, en clair');
  ok(t.includes('2 autres correspondent aussi') && !(await p.$('#sheet [data-act="radar-more"]')), 'le reste est compté, pas déroulé');
  ok(titles[1] === 'Nuit de la poésie' && !(await p.evaluate(() => window.__pwn)), 'un titre piégé perd ses balises, rien ne s’exécute');
  const link = await p.$eval('#sheet .radar a', a => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel }));
  ok(link.href.startsWith('https://openagenda.com/') && link.target === '_blank' && link.rel.includes('noopener'), 'le lien vers l’événement s’ouvre à part');
  await p.click('#sheet .radar li:nth-child(2) [data-act="radar-keep"]'); await p.waitForTimeout(250);
  const box = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('selene-site-v1')); const k = Object.keys(d.modules).find(x => d.modules[x].type === 'notes' && d.modules[x].config.inbox); return d.modules[k].entries.map(e => e.text); });
  ok(box.some(x => x.startsWith('Nuit de la poésie') && x.includes('vendredi 2 octobre') && x.includes('https://openagenda.com/lille/events/2')), '« garder » le dépose dans la boîte, avec la date et le lien');
  ok((await p.textContent('#sheet .radar li:nth-child(2)')).includes('gardé'), 'et le dit');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('[data-act="radar-open"]'); await p.waitForTimeout(300);
  ok(p.asked.length === 1 && (await p.$$('#sheet .radar li')).length === 5, 'rouvert dans l’heure : servi par le cache de l’appareil, sans nouvel appel');

  console.log('portail changé, portail muet');
  const r = await open(LILLE, 'jazz', 'renamed');
  await r.click('[data-act="radar-open"]'); await r.waitForTimeout(400);
  ok(r.asked.length === 1 && (await sheet(r)).includes('répond 400'), 'un contrat changé (400) est une erreur, sans seconde requête élargie');
  const d = await open(LILLE, 'jazz', 'down');
  await d.click('[data-act="radar-open"]'); await d.waitForTimeout(400);
  ok((await sheet(d)).includes('répond 503') && await d.isVisible('#sheet [data-act="radar-open"]'), 'portail en panne : dit, et « Réessayer »');

  console.log('échec réseau direct simulé : le passeur peut prendre le relais');
  const c = await open(LILLE, 'jazz', 'cors', '', true);
  await c.click('[data-act="radar-open"]'); await c.waitForTimeout(500);
  ok(c.asked.length === 1 && c.passeur.length === 1 && c.passeur[0].genre === 'json' && c.passeur[0].url.startsWith('https://public.opendatasoft.com/') && (await c.$$('#sheet .radar li')).length === 5, 'lecture directe refusée : le passeur lit l’agenda (genre json), les événements s’affichent');
  await c.keyboard.press('Escape'); await c.evaluate(() => localStorage.removeItem('selene-radar')); await c.click('[data-act="radar-open"]'); await c.waitForTimeout(500);
  ok(c.asked.length === 2 && c.passeur.length === 2, 'le direct est réessayé : une panne temporaire ne condamne pas toute la session');
  const a = await open(LILLE, 'jazz', 'cors');
  await a.click('[data-act="radar-open"]'); await a.waitForTimeout(400);
  ok((await sheet(a)).includes('Agenda injoignable'), 'sans passeur (artefact claude.ai) : dit ce qui manque');

  console.log('contrat, pagination et cache');
  for (const mode of ['html', 'schema']) {
    const q = await open(LILLE, 'jazz', mode);
    await q.click('[data-act="radar-open"]');
    await q.waitForFunction(() => document.querySelector('#sheetBody').textContent.includes('incompatible'));
    ok(!(await q.evaluate(() => localStorage.getItem('selene-radar'))), mode + ' : erreur explicite, pas de cache vide');
  }
  const paged = await open(LILLE, 'jazz', 'pages');
  await paged.click('[data-act="radar-open"]');
  await paged.waitForSelector('#sheet .radar li');
  ok(paged.asked.length === 2 && (await sheet(paged)).includes('Jazz après la première page'), 'correspondance trouvée sur la deuxième page');
  await paged.click('[data-act="radar-refresh"]');
  await paged.waitForSelector('#sheet .radar li');
  ok(paged.asked.length === 4, 'actualiser ignore réellement le cache');
  const partial = await open(LILLE, 'jazz', 'partial');
  await partial.click('[data-act="radar-open"]');
  await partial.waitForFunction(() => document.querySelector('#sheetBody').textContent.includes('Résultats partiels'));
  ok((await sheet(partial)).includes("le reste n'a pas pu être vérifié") && !(await partial.evaluate(() => localStorage.getItem('selene-radar'))), 'lecture incomplète annoncée, pas de faux résultat vide en cache');
  const empty = await open(LILLE, 'jazz', 'empty');
  await empty.click('[data-act="radar-open"]');
  await empty.waitForFunction(() => document.querySelector('#sheetBody').textContent.includes('La source ne renvoie aucun'));
  ok(!!(await empty.evaluate(() => localStorage.getItem('selene-radar'))), 'vrai résultat vide valide conservé');

  console.log('chargement abandonné');
  const race = await open(LILLE, 'jazz', 'slow');
  await race.click('[data-act="radar-open"]'); await until(() => !!race.release);
  await race.keyboard.press('Escape');
  await race.waitForFunction(() => !document.querySelector('#sheet').open);
  await race.click('[data-act="radar-open"]'); await race.waitForSelector('#sheet .radar li');
  race.release(); await race.waitForTimeout(150);
  ok(!(await sheet(race)).includes('Jazz ancien') && !(await race.evaluate(() => localStorage.getItem('selene-radar'))).includes('Jazz ancien'), 'une ancienne réponse ne remplace ni la vue ni le cache de la nouvelle recherche');

  console.log('réglages');
  const n = await open(LILLE, '', 'ok', '#reglages');
  ok(!(await n.$('[data-act="radar-open"]')), 'sans mots : pas de bouton');
  await n.fill('[data-act="radar-words"]', '  cinéma,   danse '); await n.press('[data-act="radar-words"]', 'Tab'); await n.waitForTimeout(200);
  ok((await n.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.radar.words)) === 'cinéma, danse', 'les mots sont gardés dans le compte (synchronisés)');
  await n.evaluate(() => location.hash = ''); await n.waitForTimeout(300);
  ok(await n.isVisible('[data-act="radar-open"]'), 'et le bouton paraît sur l’accueil');
  const m = await open({ ...LILLE, name: 'Marseille', lat: 43.3, lon: 5.4 }, 'jazz', 'ok', '#reglages');
  ok((await m.textContent('#radar')).includes('trop loin') && !(await m.evaluate(() => { location.hash = ''; return new Promise(r => setTimeout(() => r(!!document.querySelector('[data-act="radar-open"]')), 300)); })), 'loin de Lille : dit, et pas de bouton');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
