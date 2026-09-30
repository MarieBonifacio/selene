/* Scénario de navigateur : le ciel vivant (évolution de l'interface, vague 3b : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.config.sky = { name: 'Lille, Hauts-de-France, France', lat: 50.6, lon: 3.1, weather: true, realMoon: true };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (current, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, ...opts }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const asked = [];
    await ctx.route('https://api.open-meteo.com/**', r => { asked.push(r.request().url()); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current }) }); });
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(700); p.asked = asked; return p;
  };
  // L'état des calques qui bougent : nom et sens de l'animation, propriétés animées, en marche ou non.
  const layers = p => p.evaluate(() => [...document.querySelectorAll('.hero .band, .hero .drops')].map(el => {
    const cs = getComputedStyle(el), a = el.getAnimations()[0];
    return { cls: el.closest('.drift, .fall').className, name: cs.animationName, dir: cs.animationDirection, dur: parseFloat(cs.animationDuration), delay: parseFloat(cs.animationDelay),
      props: a ? [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))))] : [], state: a ? a.playState : 'none',
      tilt: (el.parentElement.style.transform || '') };
  }));

  console.log('Lille, pluie, vent d’ouest');
  const rain = { weather_code: 61, temperature_2m: 11.2, cloud_cover: 96, wind_speed_10m: 22, wind_direction_10m: 265, precipitation: 1.4 };
  const p = await open(rain);
  ok(p.asked.length === 1 && p.asked[0].includes('wind_direction_10m') && p.asked[0].includes('precipitation') && p.asked[0].includes('latitude=50.6'), 'la météo de Lille est demandée avec la direction du vent et les précipitations');
  ok((await p.textContent('.hero .sky-line')).includes('vent d\'ouest 22 km/h'), 'la ligne de données dit le vent');
  let l = await layers(p);
  const clouds = l.find(x => x.cls.includes('clouds')), wisps = l.find(x => x.cls.includes('wisps')), drops = l.find(x => x.cls.includes('rain'));
  ok(clouds && clouds.name === 'sky-drift' && clouds.dir === 'normal' && clouds.state === 'running', 'les nuages dérivent vers la gauche, vers l’est, poussés par le vent d’ouest');
  ok(wisps && wisps.name === 'sky-drift' && wisps.dur > clouds.dur, 'la brume dérive aussi, plus lentement qu’eux');
  ok(drops && drops.name === 'sky-rain' && /rotate\((\d+)deg\)/.test(drops.tilt) && +drops.tilt.match(/rotate\((\d+)deg\)/)[1] > 0, `la pluie tombe, penchée par le vent (${drops && drops.tilt})`);
  ok(l.every(x => x.props.length === 1 && x.props[0] === 'transform'), 'seul transform est animé : rien n’est redessiné image par image');
  ok(l.every(x => x.delay <= 0), 'la phase vient de l’horloge (retard négatif) : un nouveau rendu ne remet pas le ciel à zéro');

  console.log('hors de vue, réglage, système');
  await p.evaluate(() => { document.body.style.minHeight = '4000px'; scrollTo(0, 3000); });
  // L'IntersectionObserver répond quand le navigateur en a le temps : attendre l'état (5 s au plus), pas un délai fixe.
  for (const end = Date.now() + 5000; Date.now() < end && !(await layers(p)).every(x => x.state === 'paused');) await p.waitForTimeout(100);
  ok((await layers(p)).every(x => x.state === 'paused'), 'défilée hors de vue, la scène s’immobilise');
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
  ok((await layers(p)).every(x => x.state === 'running'), 'et repart quand elle revient');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(300);
  await p.uncheck('[data-act="sky-live"]'); await p.waitForTimeout(150);
  await p.evaluate(() => location.hash = ''); await p.waitForTimeout(300);
  l = await layers(p);
  ok(!(await p.$('.hero.live')) && l.length && l.every(x => x.name === 'none'), 'décoché : le ciel est immobile, la pluie toujours dessinée');
  ok((await p.evaluate(() => localStorage.getItem('selene-sky-live'))) === 'off' && !JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.sky)).includes('live'), 'réglé sur cet appareil, pas dans le compte');

  const r = await open(rain, { reducedMotion: 'reduce' });
  ok((await layers(r)).every(x => x.name === 'none'), 'le système demande moins d’animations : rien ne bouge');

  console.log('vent d’est, neige, brume');
  const e = await open({ weather_code: 73, temperature_2m: -2, cloud_cover: 90, wind_speed_10m: 12, wind_direction_10m: 80, precipitation: 0.3 });
  l = await layers(e);
  ok(l.find(x => x.cls.includes('clouds')).dir === 'reverse' && l.some(x => x.cls.includes('snow') && x.name === 'sky-snow'), 'vent d’est : les nuages vont à droite ; la neige descend');
  const m = await open(rain, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  ok(!(await m.isVisible('.hero .sky-wind')) && (await m.textContent('.hero .sky-line')).startsWith('11 °C · pluie'), 'sur téléphone, la ligne se passe du vent : le ciel le montre');
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'les calques deux fois plus larges ne débordent pas');
  const f = await open({ weather_code: 45, temperature_2m: 6, cloud_cover: 100, wind_speed_10m: 4, wind_direction_10m: 200, precipitation: 0 });
  ok(await f.$('.hero .wisps.fog') && !(await f.$('.hero .rain')), 'brume : les lambeaux s’épaississent, rien ne tombe');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
