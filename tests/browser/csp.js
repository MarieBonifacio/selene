/* Scénario de navigateur : la CSP de la version hébergée (build.py). Les deux scripts de la page passent par leur
   empreinte, sans 'unsafe-inline' ; aucune vue ne déclenche de violation ; un script injecté est refusé par le
   navigateur lui-même, en plus de l'échappement. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const watch = () => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ← ' + (e.blockedURI || 'inline') + ' (' + (e.sample || '') + ')'));
  };
  const errs = [];

  // Version hébergée pour de vrai (pas de window.claude) : écran de connexion, et le script du service worker,
  // le second script de la page, doit s'exécuter (espion sur register, posé avant tout script de la page).
  const h = await b.newPage(); h.on('pageerror', e => errs.push(e.message));
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
  check((await h.textContent('body')).includes('Connecte-toi'), 'hébergé : le script principal s’exécute (écran de connexion)');
  await h.evaluate(() => document.fonts.ready);
  check(!outside.length && fontsLoaded.length > 0 && await h.evaluate(() => document.fonts.check('500 16px "IBM Plex Sans"') && [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Spectral' && f.status === 'loaded')),
    'hébergé : les polices viennent du site, rien ne part chez Google' + (outside.length ? ' : ' + outside.join(' ') : ''));
  check(await h.evaluate(() => !navigator.serviceWorker || window.__swRegister === true), 'hébergé : le script du service worker s’exécute aussi');
  const seenH = await h.evaluate(() => window.__csp.slice());
  check(!seenH.length, 'hébergé : aucune violation de CSP' + (seenH.length ? ' : ' + seenH.join(' | ') : ''));

  // Toutes les vues (mode artefact sur la même page, donc sous la même CSP, sans compte à ouvrir).
  const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(watch);
  await p.addInitScript(doc => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', doc); }, fixture());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(500);
  const routes = await p.$$eval('#nav a[href^="#"]', as => [...new Set(as.map(a => a.getAttribute('href').slice(1)))]);
  for (const r of [...routes, 'recherche', 'reglages']) { await p.evaluate(r => location.hash = r, r); await p.waitForTimeout(150); }
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await p.waitForTimeout(150);
  const seen = await p.evaluate(() => window.__csp.slice());
  check(routes.length > 3 && !seen.length, `${routes.length} vues parcourues sans violation de CSP` + (seen.length ? ' : ' + seen.join(' | ') : ''));

  // Contre-épreuve : ce que l'échappement laisserait passer par erreur, la CSP le bloque.
  await p.evaluate(() => {
    const box = document.createElement('div'); document.body.append(box);
    box.innerHTML = '<img src="data:," onerror="window.__pwned = 1">';
    const s = document.createElement('script'); s.textContent = 'window.__pwned = 2'; document.body.append(s);
  });
  await p.waitForTimeout(300);
  check(await p.evaluate(() => window.__pwned === undefined), 'un gestionnaire onerror= ou un <script> injecté ne s’exécute pas');
  check(await p.evaluate(() => window.__csp.some(v => v.startsWith('script-src'))), 'et le navigateur le signale comme violation de script-src');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
