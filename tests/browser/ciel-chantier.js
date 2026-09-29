/* Scénario de navigateur : Ciel et chantier (connexions externes, phase 1, vague 5c : docs/connexions.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const LILLE = { name: 'Lille, Hauts-de-France, France', lat: 50.6, lon: 3.1, weather: true, realMoon: true };
const MARSEILLE = { name: 'Marseille, Provence-Alpes-Côte d’Azur, France', lat: 43.3, lon: 5.4, weather: true, realMoon: true };
const task = (id, title, room, extra = {}) => ({ id, title, room, cat: 'Bricolage', due: '', done: false, effort: 1, steps: [], cost: '', ...extra });
const site = sky => {
  const d = JSON.parse(fixture()); d.config.sky = sky;
  d.modules.chantier.entries = [task('t1', 'Peindre le balcon', 'Salon', { due: '2026-09-30' }), task('t2', 'Appeler le notaire', 'Bureau'),
    task('t3', 'Nettoyer la terrasse', 'Dehors', { done: true }), task('t4', 'Tailler la haie', 'Jardin')];
  return JSON.stringify(d);
};
const week = (wet = {}) => { const time = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
  return { time, precipitation_sum: time.map(t => (wet[t] || [0, 10])[0]), precipitation_probability_max: time.map(t => (wet[t] || [0, 10])[1]) }; };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (iso, sky, daily = week(), hash = '') => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.asked = [];
    await ctx.route('https://api.open-meteo.com/**', r => { p.asked.push(r.request().url()); r.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ current: { weather_code: 3, temperature_2m: 12, cloud_cover: 80, wind_speed_10m: 10, wind_direction_10m: 250, precipitation: 0 }, daily }) }); });
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, site(sky));
    await p.clock.setFixedTime(new Date(iso)); await p.goto(BASE + '/index.html'); await p.waitForTimeout(600);
    if (hash) { await p.evaluate(h => location.hash = h, hash); await p.waitForTimeout(300); }
    return p;
  };
  const events = p => p.$$eval('.hero .sky-event', ps => ps.map(x => x.textContent));

  console.log('étoiles filantes et éclipses, depuis Lille');
  let p = await open('2026-12-13T19:00:00+01:00', LILLE);
  let ev = await events(p);
  ok(ev.length === 1 && ev[0].startsWith('Géminides demain soir') && ev[0].includes('150 météores par heure') && ev[0].includes('bien moins en ville'), `la veille du maximum, les Géminides (${ev[0]})`);
  p = await open('2026-08-11T12:00:00+02:00', LILLE);
  ev = await events(p);
  ok(ev.some(t => t.startsWith('Perséides demain soir')) && ev.some(t => t.startsWith('Éclipse partielle de Soleil demain') && t.includes('90 %') && t.endsWith('Jamais sans lunettes d\'éclipse.')), 'la veille du 12 août 2026 : Perséides et éclipse de Soleil, avec la mise en garde');
  p = await open('2028-12-28T18:00:00+01:00', LILLE);
  ev = await events(p);
  ok(ev.length === 1 && ev[0].includes('Éclipse totale de Lune dans 3 jours (31 décembre)') && !ev[0].includes('lunettes'), 'une éclipse de Lune annoncée trois jours avant, sans lunettes (on la regarde à l’œil nu)');
  p = await open('2028-12-28T18:00:00+01:00', MARSEILLE);
  ok(!(await events(p)).length, 'depuis Marseille : rien (la table ne vaut que pour Lille et ses environs)');
  p = await open('2026-10-10T18:00:00+02:00', LILLE);
  ok(!(await events(p)).length, 'un soir ordinaire : aucune ligne de plus');

  console.log('la pluie sur les tâches à ciel ouvert');
  p = await open('2026-09-28T09:00:00+02:00', LILLE, week({ '2026-09-30': [3.2, 80], '2026-10-02': [0.4, 70], '2026-10-04': [9, 90] }), 'chantier');
  ok(p.asked.length === 1 && p.asked[0].includes('daily=precipitation_sum,precipitation_probability_max'), 'un seul appel à Open-Meteo : le temps présent et les jours qui viennent');
  const wx = id => p.$eval(`li[data-task="${id}"] .meta`, m => { const s = m.querySelector('.wx'); return s ? { t: s.textContent, rain: s.classList.contains('rain'), tip: s.title } : null; });
  const t1 = await wx('t1');
  ok(t1 && t1.rain && /pluie prévue mer\. 30, ven\. 2, le jour prévu$/.test(t1.t) && t1.tip.includes('Lille'), `« balcon » dans le titre : la pluie des cinq jours, et le jour prévu mouillé (${t1 && t1.t})`);
  ok(t1 && !t1.t.includes('dim. 4'), 'au-delà de cinq jours, la prévision ne compte pas');
  const t4 = await wx('t4');
  ok(t4 && t4.rain, '« Jardin » comme lieu suffit');
  ok(!(await wx('t2')) && !(await wx('t3')), 'rien sur une tâche d’intérieur ni sur une tâche faite');
  p = await open('2026-09-28T09:00:00+02:00', LILLE, week(), 'chantier');
  const dry = await wx('t1');
  ok(dry && !dry.rain && dry.t === 'sec jusqu\'à ven. 2', `sans pluie : « sec jusqu'à » la fin des cinq jours (${dry && dry.t})`);
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(300);
  ok((await p.$eval('[data-set-mod="chantier.outdoor"]', i => i.value)).includes('balcon'), 'les mots « à ciel ouvert » sont réglables, avec des mots par défaut');

  console.log('sans lieu');
  p = await open('2026-12-13T19:00:00+01:00', null, week({ '2026-09-30': [5, 90] }));
  ok(!p.asked.length && (await events(p)).some(t => t.startsWith('Géminides')), 'sans lieu : aucune météo demandée ; les étoiles filantes, elles, se voient partout');
  await p.evaluate(() => location.hash = 'chantier'); await p.waitForTimeout(300);
  ok(!(await p.$('li[data-task] .wx')), 'et les tâches se taisent');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
