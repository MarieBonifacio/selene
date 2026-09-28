/* ================= ciel : soleil, lune, météo (pur, sans DOM) =================
   La Fenêtre : la scène de l'accueil montre le dehors réel. Les positions sont calculées ici, localement, par les
   formules abrégées de l'Astronomical Almanac (à un degré près environ : un décor n'en demande pas plus) ; la météo
   est lue ailleurs (app.js), ce fichier ne fait que la traduire. Aucune dépendance : il se teste seul
   (tests/sky.test.js). Règle : seuls les jetons de scène varient avec le temps, jamais ceux de l'interface. */
const RAD = Math.PI / 180;
const daysJ2000 = t => t / 86400000 - 10957.5; // jours depuis J2000.0 (1er janvier 2000, 12 h TU)
const clamp01 = x => Math.max(0, Math.min(1, x));
/* Coordonnées équatoriales → hauteur et azimut (depuis le nord, vers l'est), en degrés. */
function toHorizon(ra, dec, d, lat, lon) {
  const H = (280.46061837 + 360.98564736629 * d + lon) * RAD - ra, phi = lat * RAD; // angle horaire, via le temps sidéral local
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)); // depuis le sud, vers l'ouest
  return { alt: alt / RAD, az: ((azS / RAD + 180) % 360 + 360) % 360 };
}
function sunPosition(t, lat, lon) {
  const d = daysJ2000(t), g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
  return toHorizon(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), Math.asin(Math.sin(e) * Math.sin(L)), d, lat, lon);
}
function moonPosition(t, lat, lon) {
  const d = daysJ2000(t), L = (218.316 + 13.176396 * d) * RAD, M = (134.963 + 13.064993 * d) * RAD, F = (93.272 + 13.229350 * d) * RAD;
  const l = L + 6.289 * RAD * Math.sin(M), b = 5.128 * RAD * Math.sin(F), e = 23.4397 * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const p = toHorizon(ra, dec, d, lat, lon);
  p.alt -= 0.95 * Math.cos(p.alt * RAD); // parallaxe : la lune est proche, on la voit un peu plus bas qu'on ne la calcule
  return p;
}
/* Prochain passage d'un astre à une hauteur donnée (lever si montant, coucher sinon), dans les heures qui viennent. */
function nextCrossing(pos, t, lat, lon, h, hours = 26, step = 5) {
  let prev = pos(t, lat, lon).alt - h;
  for (let m = step; m <= hours * 60; m += step) {
    const tt = t + m * 60000, cur = pos(tt, lat, lon).alt - h;
    if ((prev < 0) !== (cur < 0)) return { at: tt - step * 60000 * (cur / (cur - prev)), rising: cur > prev };
    prev = cur;
  }
  return null;
}
/* Sans lieu réglé : une longitude déduite du fuseau horaire d'hiver (l'heure d'été fausserait de 15°), une latitude
   moyenne. L'heure solaire est alors juste à trois quarts d'heure près : assez pour la couleur du ciel, pas pour
   afficher une heure de coucher. */
function approxPlace(now = new Date()) { return { lat: 45, lon: -new Date(now.getFullYear(), 0, 1).getTimezoneOffset() / 4, approx: true }; }
/* Où dessiner la lune dans la fenêtre, face au sud (au nord dans l'hémisphère austral) : l'est à gauche, l'ouest à
   droite (l'inverse au sud de l'équateur), plus haut qu'elle est haute. Sous l'horizon : nulle part. */
function moonPlacement(p, lat) {
  if (p.alt < -1) return null;
  const rel = lat >= 0 ? p.az - 180 : ((p.az + 180) % 360) - 180;
  return { x: 50 + Math.max(-1, Math.min(1, rel / 90)) * 38, y: 62 - clamp01(p.alt / 60) * 52 };
}

/* ---- météo : les codes WMO (Open-Meteo) ramenés à sept états, chacun dessiné en gravure ---- */
const WEATHER = { clear: "dégagé", veiled: "voilé", overcast: "couvert", fog: "brume", rain: "pluie", snow: "neige", storm: "orage" };
function weatherState(code) {
  if (code == null || code === "" || !Number.isFinite(+code)) return null;
  const c = +code;
  if (c === 0) return "clear";
  if (c <= 2) return "veiled";
  if (c === 45 || c === 48) return "fog";
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if (c >= 95) return "storm";
  return "overcast";
}

/* ---- couleurs ---- */
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = c => "#" + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mixHex = (a, b, f) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * f)); };
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = h => { const [r, g, b] = hexRgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const desaturate = (h, f) => { const l = luminance(h) ** (1 / 2.2) * 255; return mixHex(h, rgbHex([l, l, l]), f); };

/* Le ciel selon la hauteur du soleil, pour une interface sombre (un jour vu depuis une pièce sombre : désaturé,
   plafonné) ou claire (une nuit un peu relevée). Entre deux repères, on interpole : jamais de saut à 18 h 00. */
const SKY_KEYS = {
  dark: [
    [-18, "#070b10", "#132019", "#1d2b23", "#0a0f0c"], // nuit
    [-12, "#0a1220", "#1a2a2e", "#1f2e2a", "#0a100d"], // crépuscule nautique
    [-6, "#142033", "#3a4a55", "#26363a", "#0c1210"],  // heure bleue
    [-1, "#1d2a3d", "#6a5a4e", "#2d3a36", "#0d1411"],  // horizon cuivré
    [4, "#2a3a4a", "#86684a", "#3a4a40", "#111a14"],   // heure dorée
    [12, "#3a4c58", "#6f7d78", "#45584e", "#16201a"],  // jour bas
    [35, "#445866", "#7c8a86", "#4c5f55", "#18231c"]   // jour
  ],
  light: [
    [-18, "#3a4656", "#7d8a8c", "#5d6d66", "#2f3d35"],
    [-12, "#4d5b6c", "#98a3a2", "#66766e", "#314038"],
    [-6, "#6d7c8e", "#b4b8b0", "#72827a", "#34443a"],
    [-1, "#8a97a4", "#d9c7aa", "#7d8d84", "#37473d"],
    [4, "#9fb0b8", "#e3d2b4", "#869a8d", "#394a3f"],
    [12, "#b0c2c4", "#dfe5dc", "#8b9e91", "#3a4c40"],
    [35, "#b9c7c0", "#dfe5dc", "#8fa294", "#3b4d40"]
  ]
};
function skyAt(alt, dark) {
  const keys = SKY_KEYS[dark ? "dark" : "light"];
  if (alt <= keys[0][0]) return keys[0].slice(1);
  if (alt >= keys.at(-1)[0]) return keys.at(-1).slice(1);
  const i = keys.findIndex(k => k[0] > alt), a = keys[i - 1], b = keys[i], f = (alt - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((c, j) => mixHex(c, b[j + 1], f));
}
/* Ce que chaque temps fait au ciel : désaturer, assombrir, voiler la lune, éteindre les étoiles, ajouter des couches. */
const WEATHER_FX = {
  clear: { desat: 0, dark: 1, veil: 0, stars: 1, clouds: 0 },
  veiled: { desat: 0.25, dark: 0.97, veil: 0.25, stars: 0.5, clouds: 0.35 },
  overcast: { desat: 0.7, dark: 0.9, veil: 0.75, stars: 0, clouds: 0.7 },
  fog: { desat: 0.5, dark: 0.95, veil: 0.6, stars: 0, clouds: 0.3, fog: 1 },
  rain: { desat: 0.6, dark: 0.82, veil: 0.8, stars: 0, clouds: 0.75, rain: 0.35 },
  snow: { desat: 0.6, dark: 1, veil: 0.7, stars: 0, clouds: 0.6, snow: 0.8 },
  storm: { desat: 0.5, dark: 0.65, veil: 0.9, stars: 0, clouds: 0.85, rain: 0.45, warm: 0.25 }
};
const INK_LIGHT = "#eceee6", INK_DARK = "#1a211b";
/* La scène complète : couleurs, étoiles, halo, voile de la lune, couches météo, et l'encre du texte posé sur le ciel
   avec son voile de lecture (le moins opaque qui garantit 4,5:1, calculé ici plutôt qu'espéré). */
function skyScene({ sunAlt, illum = 0.5, weather = null, dark = true }) {
  const fx = WEATHER_FX[weather] || WEATHER_FX.clear;
  let [top, bot, far, near] = skyAt(sunAlt, dark);
  const shade = c => { const d = desaturate(c, fx.desat); return fx.dark < 1 ? mixHex(d, "#000000", 1 - fx.dark) : d; };
  top = shade(top); bot = shade(bot);
  if (fx.warm) bot = mixHex(bot, "#6b4a2e", fx.warm); // l'orage : une lueur chaude au loin
  if (fx.fog) far = mixHex(far, bot, 0.6);           // la brume efface le lointain
  if (weather === "snow") { top = mixHex(top, "#dde3e0", dark ? 0.08 : 0.15); bot = mixHex(bot, "#e6ebe8", dark ? 0.12 : 0.2); }
  const night = clamp01((-4 - sunAlt) / 11);           // 1 à la nuit noire, 0 dès le jour
  const star = night * (1 - 0.7 * illum) * fx.stars * (dark ? 0.85 : 0.45); // la lune pleine efface les étoiles faibles
  const glow = (dark ? 0.16 : 0.1) * clamp01((2 - sunAlt) / 10) * (1 - fx.veil * 0.5);
  const moonOpacity = (1 - 0.85 * fx.veil) * (sunAlt > 0 ? 0.55 : 1); // la lune de jour est pâle
  const earthshine = illum < 0.4 ? 0.1 * (1 - illum / 0.4) * (sunAlt < -4 ? 1 : 0.3) : 0; // lumière cendrée des croissants
  const mistA = fx.fog ? 0.9 : dark ? 0.55 : 0.75, mistRgb = hexRgb(mixHex(bot, dark ? "#28392f" : "#e2e6de", 0.5));
  const sample = mixHex(top, bot, 0.3);                 // là où le texte se pose, en haut à gauche
  const ink = contrast(INK_LIGHT, sample) >= contrast(INK_DARK, sample) ? INK_LIGHT : INK_DARK;
  const scrimColor = ink === INK_LIGHT ? "#060907" : "#f2f3ee";
  let scrim = 0;
  while (scrim < 0.9 && contrast(ink, mixHex(sample, scrimColor, scrim)) < 4.8) scrim += 0.05;
  return {
    top, bot, far, near, star, glow, moonOpacity, earthshine, weather,
    mist: `rgba(${mistRgb.join(",")},${mistA})`, fog: !!fx.fog,
    clouds: fx.clouds, cloud: mixHex(bot, dark ? "#9aa3a3" : "#ffffff", 0.18),
    rain: fx.rain || 0, snow: fx.snow || 0,
    ink, scrim: Math.round(scrim * 100) / 100, scrimColor, sample
  };
}

/* ---- ciel vivant : le mouvement d'après le vent réel ----
   Open-Meteo donne la direction d'où le vent vient (270 : d'ouest). La fenêtre regarde le sud au nord de l'équateur :
   l'est y est à gauche, donc un vent d'ouest pousse les nuages vers la gauche (l'inverse au sud de l'équateur).
   Le vent qui souffle vers nous ou de nous ne se voit presque pas en travers : la dérive ralentit, sans s'arrêter.
   Durées en secondes : une traversée complète pour les nuages, une période de motif pour la pluie et la neige. */
const WIND_NAMES = ["du nord", "du nord-est", "d'est", "du sud-est", "du sud", "du sud-ouest", "d'ouest", "du nord-ouest"];
const windName = dir => WIND_NAMES[Math.round((((+dir % 360) + 360) % 360) / 45) % 8];
function skyMotion({ wind = 8, dir = 270, precip = 0, lat = 45 } = {}) {
  const w = Number.isFinite(+wind) ? Math.max(0, +wind) : 8, from = Number.isFinite(+dir) ? +dir : 270;
  const east = Math.sin((from + 180) * RAD), dx = (lat >= 0 ? -1 : 1) * east; // > 0 : vers la droite de l'écran
  const eff = Math.max(3, w * Math.max(0.35, Math.abs(dx)));
  const clouds = Math.round(Math.max(45, Math.min(600, 2400 / eff)));
  const p = Number.isFinite(+precip) ? Math.max(0, +precip) : 0;
  const fall = Math.max(70, Math.min(220, 70 + 25 * p)); // px/s : la bruine descend lentement, l'averse moins
  return {
    toRight: dx > 0, clouds, mist: Math.round(clouds * 1.8),
    slant: Math.round(Math.max(-30, Math.min(30, dx * w * 0.9))), // degrés : la pluie penche avec le vent
    rain: +(24 / fall).toFixed(3), snow: +(60 / Math.max(10, Math.min(30, 10 + w * 0.4))).toFixed(2)
  };
}
