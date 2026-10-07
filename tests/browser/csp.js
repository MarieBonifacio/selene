/* Scénario de navigateur : la CSP de la version hébergée (build.py). Les deux scripts de la page passent par leur
   empreinte, sans 'unsafe-inline' ; aucune vue ne déclenche de violation ; un script injecté est refusé par le
   navigateur lui-même, en plus de l'échappement. TRV-009 : connect-src exactement la liste annoncée ; chaque espace du
   jeu d'essai, la planche, un DOI et un album sous la CSP ; chaque domaine joint déclaré. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, donnee, check } = require('./helpers');
/* TRV-009 : la liste exacte de connect-src (étape 1), et les domaines où l'on a le droit d'aller, images comprises (étape 3). */
const CONNECT = ["'self'", 'https://*.supabase.co', 'https://api.open-meteo.com', 'https://geocoding-api.open-meteo.com', 'https://api.crossref.org', 'https://api.microlink.io',
  'https://musicbrainz.org', 'https://public.opendatasoft.com', 'https://api.openalex.org', 'https://api.zotero.org'];
const declare = h => h === new URL(BASE).host || /(^|\.)supabase\.co$/.test(h) || /(^|\.)archive\.org$/.test(h)
  || ['api.open-meteo.com', 'geocoding-api.open-meteo.com', 'api.crossref.org', 'api.microlink.io', 'musicbrainz.org', 'public.opendatasoft.com', 'api.openalex.org', 'api.zotero.org', 'coverartarchive.org'].includes(h);
const domaines = new Map(); // domaine → nombre de requêtes, sur les deux pages
const noter = r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol)) domaines.set(u.host, (domaines.get(u.host) || 0) + 1); };
(async () => {
  const b = await engine.launch(launchOptions);
  const watch = () => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ← ' + (e.blockedURI || 'inline') + ' (' + (e.sample || '') + ')'));
  };
  const errs = [];

  // Version hébergée pour de vrai (pas de window.claude) : écran de connexion, et le script du service worker,
  // le second script de la page, doit s'exécuter (espion sur register, posé avant tout script de la page).
  const h = await b.newPage(); h.on('pageerror', e => errs.push(e.message)); h.on('request', noter);
  // Un faux Supabase : sans lui, la page lisait les réglages d'inscription du vrai projet (BL-21, A20).
  await h.route('https://*.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: r.request().method() === 'GET' ? '{"disable_signup":false}' : '{}' }));
  const outside = [], fontsLoaded = [];
  h.on('request', r => { if (/googleapis|gstatic/.test(r.url())) outside.push(r.url()); });
  h.on('response', r => { if (/\/fonts\/[^/]+\.woff2$/.test(r.url()) && r.ok()) fontsLoaded.push(r.url()); });
  await h.addInitScript(watch);
  await h.addInitScript(() => { if (navigator.serviceWorker) { const r = navigator.serviceWorker.register.bind(navigator.serviceWorker); navigator.serviceWorker.register = (...a) => { window.__swRegister = true; return r(...a); }; } });
  await h.goto(BASE + '/index.html'); await h.waitForTimeout(500);
  const csp = await h.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  const scriptSrc = csp.split(';').map(d => d.trim()).find(d => d.startsWith('script-src '));
  check(!scriptSrc.includes("'unsafe-inline'") && (scriptSrc.match(/'sha256-/g) || []).length === 2, 'script-src : deux empreintes, pas de \'unsafe-inline\'');
  const connect = csp.split(';').map(d => d.trim()).find(d => d.startsWith('connect-src ')).split(/\s+/).slice(1);
  check(JSON.stringify(connect) === JSON.stringify(CONNECT), `connect-src est exactement la liste annoncée : ${connect.join(' ')} (TRV-009, étape 1)`);
  check((await h.textContent('body')).includes('Connecte-toi'), 'hébergé : le script principal s’exécute (écran de connexion)');
  await h.evaluate(() => document.fonts.ready);
  check(!outside.length && fontsLoaded.length > 0 && await h.evaluate(() => document.fonts.check('500 16px "IBM Plex Sans"') && [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Spectral' && f.status === 'loaded')),
    'hébergé : les polices viennent du site, rien ne part chez Google' + (outside.length ? ' : ' + outside.join(' ') : ''));
  check(await h.evaluate(() => !navigator.serviceWorker || window.__swRegister === true), 'hébergé : le script du service worker s’exécute aussi');
  const seenH = await h.evaluate(() => window.__csp.slice());
  check(!seenH.length, 'hébergé : aucune violation de CSP' + (seenH.length ? ' : ' + seenH.join(' | ') : ''));

  // Toutes les vues (mode artefact sur la même page, donc sous la même CSP, sans compte à ouvrir).
  const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('request', noter);
  await p.addInitScript(watch);
  // Le jeu d'essai du cahier : chacun de ses espaces est parcouru (TRV-009, étape 2).
  const essai = donnee('jeu-essai.json');
  await p.addInitScript(([si, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', si); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  // Crossref et MusicBrainz répondent par le réseau simulé : la CSP, elle, s'applique avant que la requête parte.
  await p.route('https://api.crossref.org/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: { DOI: '10.5555/csp-trv009', type: 'journal-article', title: ['Une lisière sous contrôle'], issued: { 'date-parts': [[2025]] } } }) }));
  await p.route('https://musicbrainz.org/**', r => { const u = new URL(r.request().url());
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(u.pathname.endsWith('/artist') ? { artists: [{ id: '00000001-aaaa-bbbb-cccc-dddddddddddd', name: 'Kate Bush', country: 'GB' }] } : { 'release-groups': [{ id: '00000002-aaaa-bbbb-cccc-dddddddddddd', title: 'Hounds of Love', 'first-release-date': '1985', 'primary-type': 'Album', 'secondary-types': [] }] }) }); });
  await p.route('https://coverartarchive.org/**', r => r.fulfill({ status: 404, body: '' }));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500);
  const routes = await p.$$eval('#nav a[href^="#"]', as => [...new Set(as.map(a => a.getAttribute('href').slice(1)))]);
  for (const r of [...routes, 'recherche', 'bilan', 'assistant', 'reglages']) { await p.evaluate(r => location.hash = r, r); await p.waitForTimeout(150); }
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await p.waitForTimeout(150);
  await p.evaluate(() => { location.hash = 'bilan'; }); await p.waitForSelector('[data-act="planche-open"]'); await p.click('[data-act="planche-open"]'); await p.waitForTimeout(300);
  const planche = (await p.textContent('#main')).length > 0;
  const seen = await p.evaluate(() => window.__csp.slice());
  const espaces = Object.keys(essai.site.modules).filter(id => routes.includes(id));
  check(routes.length > 3 && espaces.length === Object.keys(essai.site.modules).length && planche && !seen.length,
    `${routes.length} vues parcourues, dont les ${espaces.length} espaces du jeu d’essai, la Recherche, le Bilan, la planche, l’Assistant et les Réglages, sans violation de CSP` + (seen.length ? ' : ' + seen.join(' | ') : ''));
  // Dans Sources, un DOI ; dans Musique, un album précisé : ce qui part au réseau passe la CSP (étape 2).
  await p.evaluate(() => { location.hash = 'sources'; }); await p.waitForSelector('#srcIn'); await p.fill('#srcIn', 'doi:10.5555/csp-trv009'); await p.click('[data-act="src-fetch"]');
  const doi = await p.waitForSelector('.src-prev', { timeout: 5000 }).then(async () => (await p.textContent('.src-prev')).includes('Une lisière sous contrôle'), () => false);
  await p.evaluate(() => { location.hash = 'musique'; }); await p.waitForSelector('[data-act="mb-open"]');
  await p.click('[data-act="mb-open"]:has-text("préciser")');
  const album = await p.waitForFunction(() => (document.querySelector('#sheet') || {}).textContent?.includes('Hounds of Love'), null, { timeout: 8000 }).then(() => true, () => false);
  const seen2 = await p.evaluate(() => window.__csp.slice());
  check(doi && album && !seen2.length, `un DOI cherché (Crossref) et un album précisé (MusicBrainz) : réponses affichées, aucune violation de CSP (étape 2)` + (seen2.length ? ' : ' + seen2.join(' | ') : ''));
  await p.keyboard.press('Escape');

  // Contre-épreuve : ce que l'échappement laisserait passer par erreur, la CSP le bloque.
  await p.evaluate(() => {
    const box = document.createElement('div'); document.body.append(box);
    box.innerHTML = '<img src="data:," onerror="window.__pwned = 1">';
    const s = document.createElement('script'); s.textContent = 'window.__pwned = 2'; document.body.append(s);
  });
  await p.waitForTimeout(300);
  check(await p.evaluate(() => window.__pwned === undefined), 'un gestionnaire onerror= ou un <script> injecté ne s’exécute pas');
  check(await p.evaluate(() => window.__csp.some(v => v.startsWith('script-src'))), 'et le navigateur le signale comme violation de script-src');
  // Étape 3 : les domaines joints, triés, chacun déclaré ; rien chez Google.
  // Le site et le projet Supabase nommés par leur rôle dans le message, pas par leur adresse.
  const vus = [...domaines.keys()].sort(), hors = vus.filter(h => !declare(h)), dits = vus.map(h => h === new URL(BASE).host ? 'le site' : /\.supabase\.co$/.test(h) ? '*.supabase.co' : h);
  check(!hors.length && !vus.some(h => /googleapis|gstatic/.test(h)) && vus.includes('api.crossref.org') && vus.includes('musicbrainz.org'),
    `domaines joints, triés : ${dits.join(', ')} ; aucun hors de la liste${hors.length ? ' (hors : ' + hors.join(', ') + ')' : ''}, aucun chez Google (étape 3)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
