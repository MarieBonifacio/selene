/* Scénario de navigateur : la Fenêtre (évolution de l'interface, vague 3b : docs/evolution-ui.md). Lancé par tests/browser/run.js.
   Horloge simulée (heure de Paris) et Open-Meteo simulé : le test ne dépend ni de l'heure réelle ni du réseau. */
const { engine, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
const demo = fixture();
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', timezoneId: 'Europe/Paris' });
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, demo);
  let weatherCalls = 0;
  await ctx.route('https://api.open-meteo.com/**', r => { weatherCalls++; r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { weather_code: 61, temperature_2m: 9.4, cloud_cover: 95, wind_speed_10m: 14 } }) }); });
  await ctx.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.85341, longitude: 2.3488 }] }) }));
  const pageAt = async (iso, hash = 'accueil') => {
    // L'horloge simulée est celle du contexte : la régler avant d'ouvrir la page. Sous WebKit, la page vierge
    // d'un nouvel onglet ne reçoit pas les scripts d'initialisation, et l'horloge ne peut pas s'y régler.
    await ctx.clock.setFixedTime(new Date(iso));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html#' + hash); await p.waitForTimeout(400); return p;
  };
  const hero = p => p.$eval('.hero', h => ({ sun: +h.dataset.sun, weather: h.dataset.weather, top: h.style.getPropertyValue('--sky-top'), star: +h.style.getPropertyValue('--star'),
    moon: !!h.querySelector('.moon'), placed: !!(h.querySelector('.moon') && h.querySelector('.moon').style.left), rain: !!h.querySelector('.rain'), line: (h.querySelector('.sky-line') || {}).textContent || '' }));

  console.log('sans lieu : l’heure estimée');
  let p = await pageAt('2026-09-28T12:30:00+02:00'); let h = await hero(p);
  ok(h.sun > 20 && h.star === 0 && h.top && h.top !== '#070b10', `midi : un ciel de jour, sans étoiles (${h.top})`);
  ok(h.moon && !h.placed && !h.line, 'sans lieu : la lune garde sa place d’origine, aucune heure affichée');
  await p.close();
  p = await pageAt('2026-09-28T23:30:00+02:00'); h = await hero(p);
  ok(h.sun < -18 && h.star > 0, `minuit : la nuit, des étoiles (${h.star})`);
  ok(weatherCalls === 0, 'sans lieu, aucune requête météo');

  console.log('un lieu : météo, lever et coucher, lune à sa place');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(200);
  await p.fill('#skyCity', 'Paris'); await p.click('[data-act="sky-search"]'); await p.waitForTimeout(300);
  ok((await p.textContent('#ciel')).includes('Paris, Île-de-France, France'), 'la recherche propose des lieux');
  await p.click('[data-act="sky-pick"][data-i="0"]'); await p.waitForTimeout(400);
  const garde = { bulle: (await p.textContent('#toast')).trim(), ciel: (await p.textContent('#ciel')).replace(/\s+/g, ' ') };
  ok(garde.bulle === 'Lieu gardé. Le ciel de l\'accueil est désormais celui d\'ici.' && garde.ciel.includes('arrondis à une dizaine de kilomètres'),
    `« ${garde.bulle} » ; les coordonnées « arrondis à une dizaine de kilomètres » (EXT-007, étape 2)`);
  const sky = await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.sky);
  ok(sky.lat === 48.9 && sky.lon === 2.3, `lieu gardé, arrondi au dixième de degré (${sky.lat} ; ${sky.lon})`);
  ok(weatherCalls === 1, 'la météo est demandée une fois, pour ce lieu');
  await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(300); h = await hero(p);
  ok(h.weather === 'rain' && h.rain, 'la pluie se dessine (hachures)');
  ok(h.line.includes('9 °C · pluie') && /lever \d\d h \d\d/.test(h.line), `une ligne de données : ${h.line}`);
  ok(h.moon && h.placed, 'la nuit, la lune presque pleine est dans le ciel, à sa place');
  ok(await p.$eval('.hero', el => el.classList.contains('txt-right')) === await p.$eval('.hero .moon', el => parseFloat(el.style.left) < 50), 'le texte se pose du côté opposé à la lune');
  await p.close();
  p = await pageAt('2026-09-28T13:00:00+02:00'); h = await hero(p);
  ok(!h.moon && h.line.includes("la lune est sous l'horizon") && /coucher \d\d h \d\d/.test(h.line), `en début d’après-midi, elle est couchée : ${h.line}`);

  console.log('météo périmée, mode « suivre le soleil »');
  await p.evaluate(() => { const w = JSON.parse(localStorage.getItem('selene-weather')); w.at = Date.now() - 4 * 3600000; localStorage.setItem('selene-weather', JSON.stringify(w)); });
  await ctx.unroute('https://api.open-meteo.com/**'); await ctx.route('https://api.open-meteo.com/**', r => r.abort());
  await p.reload(); await p.waitForTimeout(400); h = await hero(p);
  ok(!h.weather && !h.rain && !h.line.includes('°C'), 'une météo de plus de trois heures est ignorée : un ciel sans météo');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(200);
  await p.selectOption('[data-set="config.mode"]', 'sun'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.dataset.mode) === 'light', 'suivre le soleil : clair l’après-midi');
  await p.close();
  p = await pageAt('2026-09-28T22:00:00+02:00');
  ok(await p.evaluate(() => document.documentElement.dataset.mode) === 'dark', 'et sombre le soir');
  // EXT-007, étapes 4 et 5 : « Utiliser ma position », l'autorisation refusée (la réponse du navigateur, simulée à
  // l'identique sur chaque moteur), puis le lieu retiré.
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForSelector('[data-act="sky-locate"]');
  await p.evaluate(() => { navigator.geolocation.getCurrentPosition = (ok, ko) => setTimeout(() => ko({ code: 1, message: 'User denied Geolocation' }), 10); });
  const bulle = t => p.waitForFunction(x => (document.querySelector('#toast').textContent || '').includes(x), t, { timeout: 5000 }).catch(() => {});
  await p.click('[data-act="sky-locate"]'); await bulle('Position refusée');
  const refus = (await p.textContent('#toast')).trim(), toujours = await p.evaluate(() => !!JSON.parse(localStorage.getItem('selene-site-v1')).config.sky);
  ok(refus === 'Position refusée ou indisponible. Une ville fera l\'affaire.' && toujours, `« Utiliser ma position », refusée : « ${refus} » ; le lieu d’avant reste (étape 4)`);
  await p.click('[data-act="sky-clear"]'); await bulle('Lieu retiré');
  const retire = (await p.textContent('#toast')).trim(), plus = await p.evaluate(() => !JSON.parse(localStorage.getItem('selene-site-v1')).config.sky);
  ok(retire === 'Lieu retiré : l\'heure redevient estimée, sans météo.' && plus, `« retirer » : « ${retire} » ; plus de lieu gardé (étape 5)`);

  // NAV-010, étapes 1, 2 et 4, sur le jeu d'essai du cahier, un appareil réglé en clair : la palette, les deux modes
  // fixes et le nom affiché. L'accent se lit dans deux régions (navigation, contenu) par une sonde qui prend sa couleur.
  console.log('apparence : palette, modes, nom affiché (NAV-010)');
  const essai = donnee('jeu-essai.json');
  const cx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  await cx.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const a = await cx.newPage(); a.on('pageerror', e => errs.push(e.message));
  await a.goto(BASE + '/index.html#reglages'); await a.waitForSelector('[data-act="pal"][data-p="rubedo"]');
  const teintes = () => a.evaluate(() => ['#nav', '#main'].map(s => { const i = document.createElement('i'); i.style.color = 'var(--accent)'; document.querySelector(s).append(i); const c = getComputedStyle(i).color; i.remove(); return c; }));
  // Le rapport de contraste comme WCAG le définit (luminance relative) : le texte courant et une aide, sur le fond.
  const lisible = () => a.evaluate(() => {
    const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, bl]) => { const c = [r, g, bl].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const fond = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0)) return c; } return [255, 255, 255]; };
    const ratio = el => { const [l1, l2] = [lum(rgb(getComputedStyle(el).color)), lum(fond(el))].sort((x, y) => y - x); return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100; };
    return { mode: document.documentElement.dataset.mode, fond: getComputedStyle(document.body).backgroundColor, texte: ratio(document.querySelector('#main h2')), aide: ratio(document.querySelector('#main .hint')) };
  });
  const avant = await teintes();
  await a.click('[data-act="pal"][data-p="rubedo"]');
  await a.waitForFunction(() => document.documentElement.dataset.palette === 'rubedo', null, { timeout: 5000 }).catch(() => {});
  const rouge = await teintes();
  ok(rouge.every(c => c === 'rgb(151, 58, 48)') && avant.every(c => c !== rouge[0]) && await a.$eval('[data-act="pal"][data-p="rubedo"]', el => el.classList.contains('on')),
    `« Rubedo, amanite » : l’accent passe au rouge amanite dans la navigation et le contenu, sans recharger (${avant[0]} → ${rouge.join(', ')}) (étape 1)`);
  await a.selectOption('[data-set="config.mode"]', 'light');
  await a.waitForFunction(() => document.documentElement.dataset.mode === 'light', null, { timeout: 5000 }).catch(() => {});
  const clair = await lisible();
  await a.selectOption('[data-set="config.mode"]', 'dark');
  await a.waitForFunction(() => document.documentElement.dataset.mode === 'dark', null, { timeout: 5000 }).catch(() => {});
  const sombre = await lisible(), rougeSombre = await teintes();
  ok(clair.mode === 'light' && sombre.mode === 'dark' && clair.fond !== sombre.fond && [clair.texte, clair.aide, sombre.texte, sombre.aide].every(r => r >= 4.5) && rougeSombre.every(c => c === 'rgb(213, 100, 85)'),
    `« Toujours clair » puis « Toujours sombre » : le fond bascule (${clair.fond} → ${sombre.fond}), titre et aide lisibles (clair ${clair.texte}:1 et ${clair.aide}:1, sombre ${sombre.texte}:1 et ${sombre.aide}:1), l’amanite éclaircie (étape 2)`);
  await a.fill('[data-set="config.name"]', 'Herbier'); await a.press('[data-set="config.name"]', 'Tab');
  await a.waitForFunction(() => document.querySelector('#brandName').textContent === 'Herbier', null, { timeout: 5000 }).catch(() => {});
  const nom = await a.evaluate(() => [document.querySelector('#brandName').textContent, document.title, JSON.parse(localStorage.getItem('selene-site-v1')).config.name]);
  ok(nom[0] === 'Herbier' && / — Herbier$/.test(nom[1]) && nom[2] === 'Herbier', `« Herbier », le champ quitté : l’en-tête et l’onglet le disent (« ${nom[1]} ») (étape 4)`);

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
