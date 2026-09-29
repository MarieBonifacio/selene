/* Ciel (src/core/sky.js) : positions du soleil et de la lune, météo, et contraste du texte posé sur la scène. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const S = require('../src/core/sky.js');
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

test('ciel vivant : le vent réel donne le sens, la vitesse et la pente', () => {
  const west = S.skyMotion({ wind: 20, dir: 270, lat: 50.6 }), east = S.skyMotion({ wind: 20, dir: 90, lat: 50.6 });
  assert.equal(west.toRight, false, 'un vent d’ouest pousse vers l’est, à gauche quand on regarde le sud');
  assert.equal(east.toRight, true);
  assert.equal(S.skyMotion({ wind: 20, dir: 270, lat: -33 }).toRight, true, 'au sud de l’équateur, la fenêtre regarde le nord');
  assert.ok(S.skyMotion({ wind: 50, dir: 270 }).clouds < west.clouds && west.clouds < S.skyMotion({ wind: 3, dir: 270 }).clouds, 'plus de vent, dérive plus rapide');
  assert.ok(S.skyMotion({ wind: 20, dir: 0 }).clouds > west.clouds, 'un vent du nord se voit à peine en travers');
  assert.ok(west.slant < 0 && east.slant > 0 && Math.abs(S.skyMotion({ wind: 200, dir: 270 }).slant) <= 30, 'la pluie penche avec le vent, jamais plus de 30°');
  assert.ok(S.skyMotion({ precip: 8 }).rain < S.skyMotion({ precip: 0 }).rain, 'l’averse tombe plus vite que la bruine');
  const d = S.skyMotion({});
  for (const k of ['clouds', 'mist', 'rain', 'snow']) assert.ok(Number.isFinite(d[k]) && d[k] > 0, `sans météo, ${k} a une durée`);
  const junk = S.skyMotion({ wind: 'x', dir: null, precip: NaN });
  assert.ok(Number.isFinite(junk.clouds) && Number.isFinite(junk.rain));
  assert.equal(S.windName(270), 'd\'ouest'); assert.equal(S.windName(-10), 'du nord'); assert.equal(S.windName(225), 'du sud-ouest');
});

test('saisons : la phénologie des feuillus à Lille, et à l’envers au sud', () => {
  const LILLE = 50.6, d = s => S.seasonAt(at(s + 'T12:00:00Z'), LILLE);
  assert.equal(d('2026-01-15').phase, 'nu'); assert.equal(d('2026-01-15').leaf, 0);
  assert.equal(d('2026-03-20').leaf, 0, 'pas de feuille avant le débourrement');
  assert.equal(d('2026-04-28').phase, 'debourrement'); assert.ok(d('2026-04-28').leaf > 0.3 && d('2026-04-28').leaf < 0.8);
  assert.equal(d('2026-07-14').phase, 'feuille'); assert.equal(d('2026-07-14').leaf, 1);
  assert.equal(d('2026-10-15').phase, 'rouille'); assert.ok(d('2026-10-15').leaf > 0.8, 'l’or tient encore aux branches');
  assert.equal(d('2026-11-08').phase, 'chute'); assert.ok(d('2026-11-08').leaf < d('2026-10-15').leaf);
  assert.equal(d('2026-12-10').phase, 'nu');
  assert.equal(S.seasonAt(at('2026-07-14T12:00:00Z'), -33.4).phase, 'nu', 'juillet, c’est l’hiver à Santiago');
  assert.equal(S.seasonAt(at('2026-01-15T12:00:00Z'), -33.4).phase, 'feuille');
  // Continue : pas de saut d'un jour à l'autre.
  for (let t = at('2026-01-01T12:00:00Z'); t < at('2027-01-01T00:00:00Z'); t += 86400000) {
    const a = S.seasonAt(t, LILLE), b = S.seasonAt(t + 86400000, LILLE);
    assert.ok(Math.abs(a.leaf - b.leaf) < 0.06, `saut de feuillage le ${new Date(t).toISOString().slice(0, 10)}`);
  }
});

test('saisons : couleurs éteintes la nuit, givre seulement s’il est mesuré', () => {
  const autumn = S.seasonAt(at('2026-10-15T12:00:00Z'), 50.6);
  const day = S.skyScene({ sunAlt: 30, season: autumn }), night = S.skyScene({ sunAlt: -30, season: autumn });
  assert.equal(day.leafO, autumn.leaf); assert.equal(day.leaves, 'rouille');
  const dist = (a, b) => { const x = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), y = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return Math.hypot(...x.map((v, i) => v - y[i])); };
  assert.ok(dist(day.leaf, day.far) > dist(night.leaf, night.far), 'la rouille se voit le jour, s’éteint la nuit');
  assert.equal(S.skyScene({ sunAlt: -30 }).frost, null, 'pas de givre sans mesure');
  assert.match(S.skyScene({ sunAlt: -30, frost: true }).frost, /^#[0-9a-f]{6}$/);
  assert.equal(S.skyScene({ sunAlt: -30 }).leaves, 'feuille', 'sans saison, un été neutre');
});

test('ciel des jours qui viennent : étoiles filantes la veille et le jour du maximum, pas après', () => {
  const lille = { lat: 50.6, lon: 3.1 };
  assert.deepEqual([...S.skyEvents('2026-12-13', lille).map(e => `${e.name}:${e.inDays}`)], ['Géminides:1']);
  assert.deepEqual([...S.skyEvents('2026-12-14', lille).map(e => `${e.name}:${e.inDays}`)], ['Géminides:0']);
  assert.equal(S.skyEvents('2026-12-15', lille).length, 0);
  assert.deepEqual([...S.skyEvents('2026-01-03', null).map(e => e.name)], ['Quadrantides'], 'sans lieu : les étoiles filantes, pas les éclipses');
  assert.deepEqual([...S.skyEvents('2025-12-31', null).map(e => e.date)], [], 'le passage d’année ne décale rien');
});

test('éclipses : visibles depuis Lille, annoncées sept jours avant, jamais ailleurs', () => {
  const lille = { lat: 50.6, lon: 3.1 }, marseille = { lat: 43.3, lon: 5.4 };
  const e = S.skyEvents('2028-12-24', lille);
  assert.equal(e.length, 1); assert.equal(e[0].body, 'lune'); assert.equal(e[0].type, 'totale'); assert.equal(e[0].inDays, 7);
  assert.equal(S.skyEvents('2028-12-23', lille).length, 0, 'huit jours avant : pas encore');
  assert.equal(S.skyEvents('2028-12-31', marseille).length, 0, 'la table ne vaut que pour le Nord');
  assert.ok(S.skyEvents('2026-08-12', lille).some(x => x.body === 'soleil' && x.note.includes('90 %')));
});

test('pluie : 1 mm ou 60 % de probabilité, dans les cinq jours', () => {
  const days = [{ d: '2026-09-29', mm: 0.4, pp: 30 }, { d: '2026-09-30', mm: 0, pp: 70 }, { d: '2026-10-01', mm: 2, pp: 10 }, { d: '2026-10-04', mm: 9, pp: 90 }];
  assert.deepEqual([...S.rainDays(days, '2026-09-29')], ['2026-09-30', '2026-10-01']);
  assert.deepEqual([...S.rainDays(days, '2026-09-29', 7)], ['2026-09-30', '2026-10-01', '2026-10-04']);
  assert.deepEqual([...S.rainDays(null, '2026-09-29')], []);
});
