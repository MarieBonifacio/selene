/* Scénario de navigateur : saisons de la lisière (évolution de l'interface, vague 4a : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const lille = JSON.parse(fixture());
lille.config.sky = { name: 'Lille, Hauts-de-France, France', lat: 50.6, lon: 3.1, weather: true, realMoon: true };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (when, temp, data = lille) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(when) });
    await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { weather_code: 1, temperature_2m: temp, cloud_cover: 30, wind_speed_10m: 8, wind_direction_10m: 250, precipitation: 0 } }) }));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(data));
    await p.goto(BASE + '/index.html'); await p.clock.runFor(1200); return p;
  };
  const scene = p => p.$eval('.hero', h => ({ leaves: h.dataset.leaves, leafO: parseFloat(h.style.getPropertyValue('--leaf-o')), frost: h.querySelectorAll('.frost').length,
    crowns: h.querySelectorAll('.broadleaves ellipse').length, wood: !!h.querySelector('.broadleaves path[stroke]') }));

  console.log('le feuillage suit la date');
  let s = await scene(await open('2026-10-15T13:00:00+02:00', 12));
  ok(s.leaves === 'rouille' && s.leafO > .8 && s.crowns > 20, `mi-octobre à Lille : la rouille, encore aux branches (${s.leafO})`);
  ok(s.frost === 0, '12 °C : pas de givre');
  s = await scene(await open('2026-04-28T15:00:00+02:00', 14));
  ok(s.leaves === 'debourrement' && s.leafO > .3 && s.leafO < .8, `fin avril : le débourrement, feuillage partiel (${s.leafO})`);
  s = await scene(await open('2026-07-14T15:00:00+02:00', 24));
  ok(s.leaves === 'feuille' && s.leafO === 1, 'en juillet : le feuillage plein');

  console.log('l’hiver, le givre mesuré');
  s = await scene(await open('2027-01-15T11:00:00+01:00', -3));
  ok(s.leaves === 'nu' && s.leafO === 0 && s.wood, 'mi-janvier : les branches nues, le bois reste dessiné');
  ok(s.frost === 2, 'il fait −3 °C : le givre sur les cimes, lointaines et proches');
  s = await scene(await open('2027-01-15T11:00:00+01:00', 4));
  ok(s.frost === 0, 'même jour à 4 °C : pas de givre, le calendrier ne suffit pas');
  const noPlace = JSON.parse(fixture());
  s = await scene(await open('2027-01-15T11:00:00+01:00', -3, noPlace));
  ok(s.leaves === 'nu' && s.frost === 0, 'sans lieu : la saison d’après la date, mais jamais de givre supposé');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
