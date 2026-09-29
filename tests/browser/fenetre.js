/* Scénario de navigateur : la Fenêtre (évolution de l'interface, vague 3b : docs/evolution-ui.md). Lancé par tests/browser/run.js.
   Horloge simulée (heure de Paris) et Open-Meteo simulé : le test ne dépend ni de l'heure réelle ni du réseau. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
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

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
