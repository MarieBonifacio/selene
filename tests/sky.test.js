/* Ciel (src/sky.js) : positions du soleil et de la lune, météo, et contraste du texte posé sur la scène. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = {};
vm.runInNewContext(fs.readFileSync('src/sky.js', 'utf8') + '\n;globalThis.__sky = { sunPosition, moonPosition, nextCrossing, approxPlace, moonPlacement, weatherState, skyScene, contrast, mixHex, WEATHER };', ctx);
const S = ctx.__sky;
const PARIS = [48.85, 2.35];
const at = s => Date.parse(s);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b} ± ${tol}`);

test('soleil : hauteur à Paris (solstices, minuit)', () => {
  near(S.sunPosition(at('2026-06-21T11:50:00Z'), ...PARIS).alt, 64.6, 1.5, 'midi solaire d’été');
  near(S.sunPosition(at('2026-12-21T11:50:00Z'), ...PARIS).alt, 17.7, 1.5, 'midi solaire d’hiver');
  assert.ok(S.sunPosition(at('2026-09-28T23:00:00Z'), ...PARIS).alt < -25, 'minuit : sous l’horizon');
  near(S.sunPosition(at('2026-06-21T11:50:00Z'), ...PARIS).az, 180, 6, 'à midi solaire, plein sud');
});

test('soleil : lever et coucher à Paris, le 28 septembre 2026', () => {
  const rise = S.nextCrossing(S.sunPosition, at('2026-09-28T00:00:00Z'), ...PARIS, -0.833);
  const set = S.nextCrossing(S.sunPosition, rise.at + 3600000, ...PARIS, -0.833);
  assert.ok(rise.rising && !set.rising);
  // Références : lever 5 h 44, coucher 17 h 34 (TU).
  near((rise.at - at('2026-09-28T05:44:00Z')) / 60000, 0, 8, 'lever (minutes d’écart)');
  near((set.at - at('2026-09-28T17:34:00Z')) / 60000, 0, 8, 'coucher (minutes d’écart)');
});

test('lune : la pleine lune est haute à minuit et couchée à midi', () => {
  // Pleine lune du 26 septembre 2026.
  assert.ok(S.moonPosition(at('2026-09-26T23:30:00Z'), ...PARIS).alt > 20, 'haute vers minuit');
  assert.ok(S.moonPosition(at('2026-09-26T11:30:00Z'), ...PARIS).alt < 0, 'sous l’horizon vers midi');
});

test('lune : placée dans la fenêtre, face au sud, l’est à gauche', () => {
  const east = S.moonPlacement({ alt: 10, az: 100 }, 48), west = S.moonPlacement({ alt: 10, az: 260 }, 48), high = S.moonPlacement({ alt: 55, az: 180 }, 48);
  assert.ok(east.x < 30 && west.x > 70 && Math.abs(high.x - 50) < 1 && high.y < east.y);
  assert.equal(S.moonPlacement({ alt: -5, az: 180 }, 48), null, 'sous l’horizon : nulle part');
  assert.ok(S.moonPlacement({ alt: 10, az: 80 }, -33).x > 70, 'hémisphère austral : face au nord, l’est à droite');
});

test('sans lieu : longitude déduite du fuseau d’hiver', () => {
  const p = S.approxPlace();
  assert.ok(p.approx && p.lat === 45 && p.lon >= -180 && p.lon <= 180);
});

test('météo : codes WMO → sept états', () => {
  const m = c => S.weatherState(c);
  assert.equal(m(0), 'clear'); assert.equal(m(2), 'veiled'); assert.equal(m(3), 'overcast'); assert.equal(m(45), 'fog');
  assert.equal(m(61), 'rain'); assert.equal(m(81), 'rain'); assert.equal(m(73), 'snow'); assert.equal(m(96), 'storm');
  assert.equal(m(null), null); assert.equal(m('x'), null);
  assert.ok(Object.keys(S.WEATHER).length === 7);
});

test('scène : le texte posé sur le ciel garde 4,5:1, à toute heure, par tout temps, dans les deux modes', () => {
  const weathers = [null, 'clear', 'veiled', 'overcast', 'fog', 'rain', 'snow', 'storm'];
  let n = 0;
  for (let alt = -40; alt <= 70; alt += 1) for (const w of weathers) for (const dark of [true, false]) for (const illum of [0, 0.5, 1]) {
    const sc = S.skyScene({ sunAlt: alt, illum, weather: w, dark });
    const effective = S.mixHex(sc.sample, sc.scrimColor, sc.scrim);
    assert.ok(S.contrast(sc.ink, effective) >= 4.5, `hauteur ${alt}, ${w}, ${dark ? 'sombre' : 'clair'} : ${S.contrast(sc.ink, effective).toFixed(2)}`);
    n++;
  }
  assert.ok(n > 5000);
});

test('la version hébergée autorise Open-Meteo, et rien de plus', () => {
  const csp = fs.readFileSync('index.html', 'utf8').match(/connect-src ([^;]+);/)[1];
  assert.ok(csp.includes('https://api.open-meteo.com') && csp.includes('https://geocoding-api.open-meteo.com'));
  assert.ok(!/\*\s|\s\*$|https:\/\/\*\.open-meteo/.test(csp), 'pas de joker pour Open-Meteo');
});

test('scène : étoiles, halo et lune suivent la lumière réelle', () => {
  const night = S.skyScene({ sunAlt: -30, illum: 0 }), fullMoon = S.skyScene({ sunAlt: -30, illum: 1 }), day = S.skyScene({ sunAlt: 40, illum: 0 });
  assert.ok(night.star > fullMoon.star && fullMoon.star > 0, 'la pleine lune efface une partie des étoiles');
  assert.equal(day.star, 0, 'pas d’étoiles le jour');
  assert.ok(S.skyScene({ sunAlt: -30, weather: 'overcast' }).star === 0, 'pas d’étoiles sous un ciel couvert');
  assert.ok(day.moonOpacity < night.moonOpacity, 'la lune de jour est pâle');
  assert.ok(night.earthshine > 0 && fullMoon.earthshine === 0, 'lumière cendrée des croissants seulement');
  assert.ok(S.skyScene({ sunAlt: -30, weather: 'rain' }).rain > 0 && S.skyScene({ sunAlt: -30, weather: 'snow' }).snow > 0);
  assert.notEqual(S.skyScene({ sunAlt: 40, dark: true }).top, S.skyScene({ sunAlt: -30, dark: true }).top, 'le jour ne ressemble pas à la nuit');
});
