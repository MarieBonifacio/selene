/* ================= utils ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const todayISO = () => iso(new Date());
const addDaysTo = (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((new Date(a + "T12:00") - new Date(b + "T12:00")) / 86400000);
// Formater une date coûte cher (un formateur Intl reconstruit à chaque appel) et une liste de fragments en affiche
// des milliers : fonction pure, donc résultats gardés, dans une limite de taille.
const fmtCache = new Map();
const fmt = (s, o = { day: "numeric", month: "short" }) => {
  if (!s) return "";
  const k = s + JSON.stringify(o);
  let v = fmtCache.get(k);
  if (v === undefined) { v = new Date(s + "T12:00").toLocaleDateString("fr-FR", o); if (fmtCache.size >= 5000) fmtCache.clear(); fmtCache.set(k, v); }
  return v;
};
const clone = o => JSON.parse(JSON.stringify(o));
const ago = s => { if (!s) return "jamais"; const n = diffDays(todayISO(), s); return n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} j`; };
/* Le message loge dans la fenêtre modale ouverte (feuille, formulaire) s'il y en a une : sinon il passerait dessous,
   invisible, avec son « Annuler ». */
function toastHost() {
  const el = $("#toast");
  try { const open = [...document.querySelectorAll("dialog[open]")].pop(), host = open || document.body; if (el.parentNode !== host) host.appendChild(el); } catch {}
  return el;
}
function toast(msg) { undoFn = null; const el = toastHost(); el.textContent = msg; el.classList.remove("act"); el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3400); }
/* Un message avec une action proposée (« Annuler », « Ajouter »…), qui disparaît d'elle-même : jamais imposée. */
let undoFn = null;
function toastAction(msg, button, fn, ms = 6000) {
  const el = toastHost();
  el.innerHTML = `${esc(msg)} <button class="btn sm" data-act="undo">${esc(button)}</button>`;
  el.classList.add("show", "act"); undoFn = fn;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.classList.remove("show", "act"); undoFn = null; }, ms);
}
/* « Annuler » pendant quelques secondes, au lieu d'une confirmation avant d'agir. */
const toastUndo = (msg, undo) => toastAction(msg, "Annuler", undo);
/* Retire un élément d'une liste d'un module (entries, scraps…) ; « Annuler » le remet à sa place. */
function removeWithUndo(id, list, itemId) {
  const inst = S().modules[id], i = inst[list].findIndex(x => x.id === itemId);
  if (i < 0) return;
  const item = inst[list][i], name = String(item.title || item.text || item.note || item.type || "l'élément");
  inst[list] = inst[list].filter(x => x.id !== itemId); site.save(); render();
  toastUndo(`Supprimé : « ${name.length > 40 ? name.slice(0, 40) + "…" : name} ».`, () => {
    const cur = S().modules[id]; // relu : une synchro a pu passer entre-temps
    if (!cur || cur[list].some(x => x.id === itemId)) return;
    cur[list].splice(Math.min(i, cur[list].length), 0, item); site.save(); render(); toast("Rétabli. Rien ne s'est passé.");
  });
}
/* Longues listes : les PAGE premiers éléments, puis « Voir les suivants ». Propre à l'appareil, remis à zéro
   quand on change de vue : une liste de milliers de fragments se calcule vite mais se parcourt mal au pouce. */
const PAGE = 100, pageSize = {};
function paged(key, list) {
  const n = pageSize[key] || PAGE, rest = list.length - n;
  return { items: list.slice(0, n), more: rest > 0 ? `<li class="more-row"><button class="btn ghost sm" data-act="page-more" data-k="${esc(key)}">Voir les ${Math.min(PAGE, rest)} suivants (${rest} de plus)</button></li>` : "" };
}
function setSaving(t) { $("#saving").textContent = t; }

/* ================= stores ================= */

const MODULE_DEFS = {
  assistant: "Assistant"
};
const OFF_BY_DEFAULT = ["assistant"];
const money = n => (+n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
/* Données de départ d'un compte neuf : presque rien, et rien de personnel. L'accueil propose ensuite des
   modèles (MODULE_TEMPLATES). Doivent rester « vierges » (updatedAt 0, pas d'identifiant aléatoire) :
   un appareil vierge adopte le serveur tel quel au lieu de fusionner. */
function siteSeed() {
  return {
    updatedAt: 0, schemaVersion: SCHEMA_VERSION, boardMerged: true,
    config: { name: "Selene", palette: "nigredo", mode: "auto", labels: {}, groups: {}, welcome: true,
      modules: [{ id: "inbox", on: true }, { id: "assistant", on: !OFF_BY_DEFAULT.includes("assistant") }],
      assistant: { model: "claude-sonnet-5", actions: true, share: { inbox: true } } },
    modules: { inbox: SECTION_TO_MODULE.inbox({ items: [] }) }
  };
}
/* ================= moon ================= */
/* Mois synodique moyen (d'une nouvelle lune à la suivante) et une nouvelle lune de référence. */
const SYNODIC = 29.530588853, NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
const MOON_NAMES = ["Nouvelle lune", "Premier croissant", "Premier quartier", "Gibbeuse croissante", "Pleine lune", "Gibbeuse décroissante", "Dernier quartier", "Dernier croissant"];
const moonName = p => MOON_NAMES[Math.floor(((p + 1 / 16) % 1) * 8)];
function moon() {
  const syn = SYNODIC, ref = NEW_MOON_REF;
  const age = (((Date.now() - ref) / 86400000) % syn + syn) % syn;
  const p = age / syn;
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const nextFull = p < .5 ? (0.5 - p) * syn : (1.5 - p) * syn;
  const nextNew = (1 - p) * syn;
  return { p, age, illum, name: moonName(p), nextFull: Math.round(nextFull), nextNew: Math.round(nextNew) };
}
function moonSVG(p, size = 100) {
  const r = 46, c = 50, rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  let d;
  if (p < .5) d = `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${p < .25 ? 0 : 1} ${c},${c - r}Z`;
  else d = `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${p < .75 ? 0 : 1} ${c},${c - r}Z`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Phase de la lune"><circle cx="50" cy="50" r="${r}" fill="var(--moon-shadow)" stroke="var(--rule)" stroke-width=".8"/><path d="${d}" fill="var(--moon)"/></svg>`;
}


/* ================= forêt ================= */
let TREES = null;
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function fir(x, base, hgt, w) {
  let d = "";
  for (let i = 0; i < 4; i++) {
    const top = base - hgt + i * hgt * .2, bot = Math.min(base - hgt * .05, top + hgt * .42), hw = w * (.28 + .2 * i);
    d += `M${x.toFixed(1)},${top.toFixed(1)}L${(x + hw).toFixed(1)},${bot.toFixed(1)}L${(x - hw).toFixed(1)},${bot.toFixed(1)}Z`;
  }
  return d + `M${(x - w * .05).toFixed(1)},${(base - hgt * .06).toFixed(1)}h${(w * .1).toFixed(1)}v${(hgt * .08).toFixed(1)}h${(-w * .1).toFixed(1)}Z`;
}
/* Le givre : une calotte claire au sommet des deux étages supérieurs d'un sapin (mêmes proportions que fir). */
function firFrost(x, base, hgt, w) {
  let d = "";
  for (let i = 0; i < 2; i++) {
    const top = base - hgt + i * hgt * .2, bot = Math.min(base - hgt * .05, top + hgt * .42), hw = w * (.28 + .2 * i), k = .34;
    d += `M${x.toFixed(1)},${top.toFixed(1)}L${(x + hw * k).toFixed(1)},${(top + (bot - top) * k).toFixed(1)}L${(x - hw * k).toFixed(1)},${(top + (bot - top) * k).toFixed(1)}Z`;
  }
  return d;
}
/* Un feuillu : le tronc (clair pour un bouleau), des branches, et un houppier en lobes. Le bois se voit l'hiver ; le
   houppier, dessiné par-dessus, n'a que l'opacité de la saison (--leaf-o). */
function broadleaf(x, base, hgt, w, r, birch) {
  const tt = base - hgt * .62, f = v => v.toFixed(1);
  const trunk = `M${f(x - w * (birch ? .025 : .04))},${f(base)}L${f(x - w * .015)},${f(tt)}L${f(x + w * .015)},${f(tt)}L${f(x + w * (birch ? .025 : .04))},${f(base)}Z`;
  let wood = `M${f(x)},${f(tt)}L${f(x + (r() - .5) * w * .1)},${f(base - hgt * .95)}`;
  for (let k = 0; k < 5; k++) {
    const side = k % 2 ? 1 : -1, y0 = base - hgt * (.3 + .08 * k), x1 = x + side * w * (.22 + .12 * r()), y1 = y0 - hgt * (.2 + .1 * r());
    wood += `M${f(x)},${f(y0)}Q${f(x + side * w * .08)},${f(y0 - hgt * .1)} ${f(x1)},${f(y1)}L${f(x1 + side * w * .06)},${f(y1 - hgt * .08)}`;
  }
  const cy = base - hgt * .66, R = w * .42, sx = birch ? .72 : 1, lobes = [`<ellipse cx="${f(x)}" cy="${f(cy)}" rx="${f(R * .75 * sx)}" ry="${f(R * .8)}"/>`];
  for (let k = 0; k < 6; k++) { const a = k / 6 * 2 * Math.PI + r() * .5, rr = R * (.45 + .2 * r()); lobes.push(`<ellipse cx="${f(x + Math.cos(a) * R * .55 * sx)}" cy="${f(cy + Math.sin(a) * R * .5)}" rx="${f(rr * sx)}" ry="${f(rr * .85)}"/>`); }
  return { trunk, wood, crown: lobes.join("") };
}
function buildTrees() {
  const r = rng(1729), far = [], near = [], stars = [], farFrost = [], nearFrost = [];
  for (let x = -20; x < 1030; x += 14 + r() * 18) { const b = 262 + r() * 10, h = x < 540 ? 55 + r() * 50 : 70 + r() * 70, w = 26 + r() * 14; far.push(fir(x, b, h, w)); farFrost.push(firFrost(x, b, h, w)); }
  for (let x = -30; x < 1040; x += 26 + r() * 40) { if (x > 380 && x < 470 && r() < .7) continue; const low = x < 540, b = 300 + r() * 6, h = low ? 70 + r() * 80 : 100 + r() * 120, w = 40 + r() * 26; near.push(fir(x, b, h, w)); nearFrost.push(firFrost(x, b, h, w)); }
  for (let i = 0; i < 70; i++) stars.push(`<circle cx="${(r() * 1000).toFixed(0)}" cy="${(r() * 170).toFixed(0)}" r="${(r() * .9 + .3).toFixed(2)}"/>`);
  // Les feuillus ont leur propre suite de hasard : les sapins restent exactement ceux d'avant.
  const q = rng(4096), trunks = [], birches = [], wood = [], crowns = [];
  for (let x = 30 + q() * 60; x < 990; x += 95 + q() * 70) {
    const birch = q() < .35, h = 62 + q() * 42, t = broadleaf(x, 268 + q() * 8, h, h * (birch ? .55 : .75), q, birch);
    (birch ? birches : trunks).push(t.trunk); wood.push(t.wood); crowns.push(t.crown);
  }
  TREES = { far: far.join(""), near: near.join(""), stars: stars.join(""), farFrost: farFrost.join(""), nearFrost: nearFrost.join(""),
    trunks: trunks.join(""), birches: birches.join(""), wood: wood.join(""), crowns: crowns.join("") };
}
/* Des nuages en strates horizontales, comme dans les ciels gravés : trois bandes, plus ou moins présentes. */
const cloudsSVG = o => `<g fill="var(--cloud)"><ellipse cx="260" cy="58" rx="330" ry="15" opacity="${(o * .8).toFixed(2)}"/><ellipse cx="720" cy="96" rx="360" ry="19" opacity="${o.toFixed(2)}"/><ellipse cx="470" cy="140" rx="420" ry="13" opacity="${(o * .6).toFixed(2)}"/></g>`;
/* Le ciel vivant : chaque couche qui bouge est un calque HTML à part, déplacé par une animation CSS de `transform`
   seulement. Le navigateur la confie à la carte graphique (le « compositeur ») : rien n'est redessiné ni recalculé
   image par image, le processeur ne fait presque rien. Les nuages et la brume sont un motif périodique deux fois plus
   large que la fenêtre, qui glisse d'une largeur puis recommence ; la pluie et la neige, un motif qui descend d'une
   période. Le retard négatif, pris sur l'horloge, fait qu'un nouveau rendu de l'accueil reprend le mouvement où il en
   était au lieu de le remettre à zéro. Sans `.live` sur la scène (réglage coupé), rien ne bouge. */
const periodic = g => [-1000, 0, 1000, 2000].map(x => `<g transform="translate(${x} 0)">${g}</g>`).join("");
const phase = (dur, now) => `animation-duration:${dur}s;animation-delay:-${((now / 1000) % dur).toFixed(2)}s`;
const driftLayer = (cls, dur, toRight, now, inner) => `<div class="drift ${cls}" aria-hidden="true"><div class="band${toRight ? " rev" : ""}" style="${phase(dur, now)}"><svg viewBox="0 0 2000 300" preserveAspectRatio="none">${inner}</svg></div></div>`;
const fallLayer = (cls, dur, tilt, now, o) => `<div class="fall ${cls}" aria-hidden="true" style="opacity:${o}"><div class="tilt" style="transform:rotate(${tilt}deg)"><div class="drops" style="${phase(dur, now)}"></div></div></div>`;
/* Des lambeaux de brume, bas sur la lisière, entre les sapins lointains et les proches. */
const WISPS = `<ellipse cx="130" cy="226" rx="250" ry="22" fill="url(#wisp)"/><ellipse cx="540" cy="212" rx="210" ry="15" fill="url(#wisp)"/><ellipse cx="840" cy="238" rx="270" ry="20" fill="url(#wisp)"/>`;
/* Plans superposés : le ciel et ses étoiles, la lune et son halo, les nuages, les sapins lointains, la brume, les sapins
   proches, puis ce qui tombe (pluie en fines hachures, neige en points). Le ciel et les sapins sont recadrés (« slice »)
   pour remplir toute largeur ; la lune ne l'est pas, sinon un écran étroit la coupe. Son repère (-150…150) est à
   l'échelle du ciel (300 de haut). Sans lieu, elle garde sa place d'origine (82 %) ; avec un lieu, `at` la place où elle
   est (moonPlacement), et `at === false` dit qu'elle est sous l'horizon. Les couleurs viennent de skyScene, le
   mouvement de skyMotion (sky.js). */
function forestSVG(p, sc = skyScene({ sunAlt: -30, illum: .5 }), at, mo = skyMotion(), now = Date.now()) {
  if (!TREES) buildTrees();
  const r = 46, c = 50, rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  const lit = p < .5 ? `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${p < .25 ? 0 : 1} ${c},${c - r}Z`
                     : `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${p < .75 ? 0 : 1} ${c},${c - r}Z`;
  const place = at ? `left:${at.x.toFixed(1)}%;top:${at.y.toFixed(1)}%;` : "";
  return `<svg class="scene" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Lune au-dessus d'une lisière de sapins">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bot)"/></linearGradient></defs>
    <rect width="1000" height="300" fill="url(#sky)"/>
    <g fill="var(--moon)" opacity="var(--star)" style="opacity:var(--star)">${TREES.stars}</g>
  </svg>
  ${at === false ? "" : `<div class="moon" aria-hidden="true" style="${place}opacity:var(--moon-o,1)"><svg viewBox="-150 -150 300 300">
    <defs><radialGradient id="glow"><stop offset="0" stop-color="var(--glow)"/><stop offset="1" stop-color="var(--glow)" stop-opacity="0"/></radialGradient></defs>
    <circle r="${40 + 120 * (1 - Math.abs(1 - 2 * p)) * .9}" fill="url(#glow)"/>
    <g transform="scale(.84) translate(-50 -50)"><circle cx="50" cy="50" r="${r}" fill="var(--moon-shadow)" opacity=".85"/>${sc.earthshine ? `<circle class="earthshine" cx="50" cy="50" r="${r}" fill="var(--moon)" opacity="${sc.earthshine.toFixed(3)}"/>` : ""}<path d="${lit}" fill="var(--moon)"/></g>
  </svg></div>`}
  ${sc.clouds ? driftLayer("clouds", mo.clouds, mo.toRight, now, periodic(cloudsSVG(sc.clouds))) : ""}
  <svg class="scene trees" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--mist)" stop-opacity="0"/><stop offset=".6" stop-color="var(--mist)"/><stop offset="1" stop-color="var(--mist)" stop-opacity="0"/></linearGradient></defs>
    <path d="${TREES.far}" fill="var(--tree-far)"/>${sc.frost ? `<path class="frost" d="${TREES.farFrost}" fill="var(--frost)"/>` : ""}
    <g class="broadleaves"><path d="${TREES.wood}" fill="none" stroke="var(--wood)" stroke-width="1.3" stroke-linecap="round"/><path d="${TREES.trunks}" fill="var(--wood)"/><path d="${TREES.birches}" fill="var(--birch)"/>
      <g fill="var(--leaf)" style="opacity:var(--leaf-o)">${TREES.crowns}</g></g>
    <rect y="${sc.fog ? 140 : 205}" width="1000" height="${sc.fog ? 150 : 75}" fill="url(#mist)"/>
  </svg>
  ${driftLayer(`wisps${sc.fog ? " fog" : ""}`, mo.mist, mo.toRight, now, `<defs><radialGradient id="wisp"><stop offset="0" stop-color="var(--mist)"/><stop offset="1" stop-color="var(--mist)" stop-opacity="0"/></radialGradient></defs>${periodic(WISPS)}`)}
  <svg class="scene trees" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path d="${TREES.near}" fill="var(--tree-near)"/>${sc.frost ? `<path class="frost" d="${TREES.nearFrost}" fill="var(--frost)"/>` : ""}</svg>
  ${sc.rain ? fallLayer("rain", mo.rain, -mo.slant, now, sc.rain) : ""}
  ${sc.snow ? fallLayer("snow", mo.snow, -Math.round(mo.slant / 2), now, sc.snow) : ""}`;
}
/* ================= la Fenêtre : lieu, météo, scène du moment =================
   Le lieu (config.sky, synchronisé) est arrondi au dixième de degré (~10 km) avant tout envoi. La météo vient
   d'Open-Meteo, gardée sur l'appareil (selene-weather) ; plus vieille que trois heures, elle est ignorée : un ciel sans
   météo vaut mieux qu'une pluie périmée. Sans lieu : l'heure estimée d'après le fuseau, la lune à sa place d'origine. */
const skyConf = () => { const c = S().config.sky; return c && Number.isFinite(+c.lat) && Number.isFinite(+c.lon) ? c : null; };
/* Le mode de l'interface, tel qu'il s'affiche : la scène se tonalise d'après lui. */
function uiDark() {
  const r = document.documentElement.dataset;
  if (r.mode) return r.mode === "dark";
  if (r.theme) return r.theme === "dark";
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return true; }
}
const WEATHER_KEY = "selene-weather";
function freshWeather(c) {
  // Fraîche : moins de trois heures, et pas « du futur » (une horloge d'appareil changée ne ressuscite pas une vieille pluie).
  try { const w = JSON.parse(localStorage.getItem(WEATHER_KEY)), age = w ? Date.now() - w.at : NaN; return w && w.lat === +c.lat && w.lon === +c.lon && age > -300000 && age < 3 * 3600000 ? w : null; } catch { return null; }
}
let weatherBusy = false;
async function refreshWeather(force = false) {
  const c = skyConf(); if (!c || c.weather === false || weatherBusy) return;
  const w = freshWeather(c); if (!force && w && Date.now() - w.at < 30 * 60000) return;
  weatherBusy = true;
  try {
    // Le temps présent, et les cinq jours qui viennent (pluie) pour les tâches à ciel ouvert : un seul appel.
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${+c.lat}&longitude=${+c.lon}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation&daily=precipitation_sum,precipitation_probability_max&forecast_days=7&timezone=auto`);
    const j = r.ok ? await r.json() : null, cur = j && j.current, dl = j && j.daily;
    if (!cur || !Number.isFinite(+cur.weather_code)) return;
    const days = dl && Array.isArray(dl.time) ? dl.time.slice(0, 7).map((d, i) => ({ d: String(d).slice(0, 10), mm: +((dl.precipitation_sum || [])[i]) || 0, pp: +((dl.precipitation_probability_max || [])[i]) || 0 })) : [];
    localStorage.setItem(WEATHER_KEY, JSON.stringify({ at: Date.now(), lat: +c.lat, lon: +c.lon, code: +cur.weather_code, temp: +cur.temperature_2m, cloud: +cur.cloud_cover, wind: +cur.wind_speed_10m, dir: +cur.wind_direction_10m, precip: +cur.precipitation, days }));
    render();
  } catch {} finally { weatherBusy = false; } // hors ligne, ou l'artefact claude.ai qui ne sort pas : le ciel reste sans météo
}
/* Le ciel vivant se règle par appareil : c'est l'appareil qui paie l'animation, pas le compte. */
const skyLive = () => { try { return localStorage.getItem("selene-sky-live") !== "off"; } catch { return true; } };
/* Hors de vue (la page défilée plus bas), la scène s'immobilise : aucune image calculée pour personne. */
let heroObs = null;
function skyWatch() {
  try {
    const h = document.querySelector("#main .hero.live"); if (!h || !("IntersectionObserver" in window)) return;
    heroObs = heroObs || new window.IntersectionObserver(es => es.forEach(e => e.target.classList.toggle("still", !e.isIntersecting)));
    heroObs.disconnect(); heroObs.observe(h);
  } catch {}
}
/* Une pluie d'étoiles filantes ou une éclipse, en une phrase : ce qu'on verra vraiment, sans promettre le ciel. */
function skyEventText(ev, illum) {
  if (ev.kind === "shower") return `${ev.name} ${ev.inDays ? "demain soir" : "cette nuit"} : jusqu'à ${ev.zhr} météores par heure sous un ciel parfaitement noir, bien moins en ville${illum > .6 ? " ; la lune en effacera la plupart" : ""}.`;
  const when = ev.inDays === 0 ? "aujourd'hui" : ev.inDays === 1 ? "demain" : `dans ${ev.inDays} jours (${fmt(ev.date, { day: "numeric", month: "long" })})`;
  const what = ev.type === "pénombre" ? `Éclipse de Lune par la pénombre ${when} : un voile léger, à peine perceptible` : `Éclipse ${ev.type} de ${ev.body === "soleil" ? "Soleil" : "Lune"} ${when}${ev.note ? ` : ${ev.note}` : ""}`;
  return `${what}${ev.body === "soleil" ? ". Jamais sans lunettes d'éclipse." : "."}`;
}
const hm = t => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
/* La scène du moment : couleurs (skyScene), place de la lune, et ce qu'on peut en dire en une ligne. */
function sceneNow(m) {
  const c = skyConf(), place = c ? { lat: +c.lat, lon: +c.lon } : approxPlace(), t = Date.now(), dark = uiDark();
  const sun = sunPosition(t, place.lat, place.lon), w = c && c.weather !== false ? freshWeather(c) : null, weather = w ? weatherState(w.code) : null;
  // La saison d'après la date et l'hémisphère ; le givre seulement si la température mesurée est sous zéro.
  const season = seasonAt(t, place.lat), frost = !!(w && Number.isFinite(w.temp) && w.temp <= 0);
  const sc = skyScene({ sunAlt: sun.alt, illum: m.illum, weather, dark, season, frost }), facts = [];
  let moonAt;
  // Le mouvement suit le vent mesuré ; sans météo, une brise d'ouest légère, celle qui domine sous nos latitudes.
  const mo = skyMotion(w ? { wind: w.wind, dir: w.dir, precip: w.precip, lat: place.lat } : { lat: place.lat });
  if (weather) facts.push(`${Math.round(w.temp)} °C · ${WEATHER[weather]}`);
  // Le vent, en clair ; sur un écran étroit, la ligne s'en passe (le ciel le montre déjà en bougeant).
  const wind = w && weather && Number.isFinite(w.dir) && w.wind >= 1 ? `vent ${windName(w.dir)} ${Math.round(w.wind)} km/h` : "";
  if (c) {
    const ev = nextCrossing(sunPosition, t, place.lat, place.lon, -0.833);
    if (ev) facts.push(`${ev.rising ? "lever" : "coucher"} ${hm(ev.at)}`);
    if (c.realMoon !== false) {
      moonAt = moonPlacement(moonPosition(t, place.lat, place.lon), place.lat) || false;
      if (moonAt === false) { const r = nextCrossing(moonPosition, t, place.lat, place.lon, 0); facts.push(`la lune est sous l'horizon${r ? `, lever vers ${hm(r.at)}` : ""}`); }
    }
  }
  const line = facts.join(" · ");
  // Le texte se pose du côté opposé à la lune (qui se lève à gauche, à l'est) ; si elle le chevauche encore (écran étroit,
  // lune haute), le voile de lecture se renforce : un disque clair sous des lettres claires ne se lit pas.
  const right = !!(moonAt && moonAt.x < 50), clash = !!(moonAt && (right ? moonAt.x > 36 : moonAt.x < 64) && moonAt.y < 52);
  // Une ligne d'événement allonge le texte jusqu'à la cime des arbres : même renfort.
  const events = skyEvents(todayISO(), c ? place : null).map(ev => skyEventText(ev, m.illum));
  if (clash || events.length) sc.scrim = Math.max(sc.scrim, .6);
  const cap = t => t && t[0].toUpperCase() + t.slice(1);
  const lineHTML = !line ? "" : wind ? `${esc(cap(facts[0]))}<span class="sky-wind"> · ${esc(wind)}</span>${esc(line.slice(facts[0].length))}` : esc(cap(line));
  return { sc, sun, dark, moonAt, right, mo, line: cap(line), lineHTML, events };
}
/* Réglages → Ciel : le lieu (une ville, ou la position de l'appareil, jamais demandée d'office), la météo, la lune. */
let skyResults = []; // résultats de la dernière recherche de ville (propres à l'appareil, oubliés au rechargement)
function skySettingsHTML() {
  const c = skyConf(), f = v => (+v).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `<section id="ciel"><h3>Ciel</h3><p class="hint">La scène de l'accueil montre le dehors réel : l'heure par le soleil, la lune à sa place, le temps qu'il fait. Sans lieu, l'heure est estimée d'après le fuseau horaire (à trois quarts d'heure près), et il n'y a pas de météo.</p>
    ${c ? `<p class="row" style="margin:0 0 10px">Lieu : <b>${esc(c.name)}</b> <span class="hint" style="margin:0">(${f(c.lat)} ; ${f(c.lon)}, arrondis à une dizaine de kilomètres)</span><button class="btn ghost sm" data-act="sky-clear">retirer</button></p>` : ""}
    <div class="row"><input id="skyCity" placeholder="${c ? "Changer de ville…" : "Une ville…"}" aria-label="Ville" autocomplete="off" style="max-width:260px"><button class="btn sm" data-act="sky-search">Chercher</button><button class="btn ghost sm" data-act="sky-locate">Utiliser ma position</button></div>
    ${skyResults.length ? `<ul class="plain" style="margin-top:8px">${skyResults.map((r, i) => `<li class="item"><span></span><div>${esc(r.name)}</div><button class="btn sm" data-act="sky-pick" data-i="${i}">Choisir</button></li>`).join("")}</ul>` : ""}
    ${c ? `<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-weight:400"><input type="checkbox" data-act="sky-weather" ${c.weather !== false ? "checked" : ""}>Météo en direct</label>
    <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-weight:400"><input type="checkbox" data-act="sky-moon" ${c.realMoon !== false ? "checked" : ""}>La lune à sa vraie place (sinon, toujours dans le ciel)</label>` : ""}
    <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-weight:400"><input type="checkbox" data-act="sky-live" ${skyLive() ? "checked" : ""}>Ciel vivant : nuages, brume, pluie ou neige bougent au rythme du vent mesuré (sur cet appareil ; immobile si le système demande moins d'animations)</label>
    <p class="hint" style="margin-top:10px">La météo et la recherche de ville passent par Open-Meteo : le service voit ce lieu arrondi et l'adresse de l'appareil, rien d'autre.</p></section>`;
}
function setSky(name, lat, lon) {
  const old = skyConf() || {}, r1 = v => Math.round(v * 10) / 10;
  S().config.sky = { name: String(name).slice(0, 80), lat: r1(lat), lon: r1(lon), weather: old.weather !== false, realMoon: old.realMoon !== false };
  skyResults = []; site.save(); render(); refreshWeather(true);
  toast("Lieu gardé. Le ciel de l'accueil est désormais celui d'ici.");
}
async function skySearch() {
  const q = ($("#skyCity") || {}).value;
  if (!q || !q.trim()) return;
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=5&language=fr&format=json`);
    const j = r.ok ? await r.json() : {};
    skyResults = (j.results || []).filter(x => Number.isFinite(+x.latitude) && Number.isFinite(+x.longitude)).slice(0, 5)
      .map(x => ({ name: [x.name, x.admin1, x.country].filter(Boolean).join(", ").slice(0, 80), lat: +x.latitude, lon: +x.longitude }));
    if (!skyResults.length) toast("Aucun lieu de ce nom. Une ville plus grande, à côté, fera l'affaire.");
    render();
  } catch { toast("Recherche impossible : hors ligne, ou le service ne répond pas."); }
}
/* Les jetons de scène, posés sur la scène seule : l'interface autour ne bouge pas avec l'heure. */
function heroStyle(sc, dark) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");
  return [["--sky-top", sc.top], ["--sky-bot", sc.bot], ["--tree-far", sc.far], ["--tree-near", sc.near], ["--mist", sc.mist], ["--star", sc.star.toFixed(3)],
    ["--glow", `rgba(${dark ? "236,232,214" : "255,252,235"},${sc.glow.toFixed(3)})`], ["--moon-o", sc.moonOpacity.toFixed(2)], ["--cloud", sc.cloud],
    ["--rain-c", sc.ink === "#1a211b" ? "#4a5550" : "#c9d0cc"], ["--leaf", sc.leaf], ["--leaf-o", sc.leafO], ["--wood", sc.wood], ["--birch", sc.birch], ...(sc.frost ? [["--frost", sc.frost]] : []), ["--scene-ink", sc.ink], ["--scene-scrim", `rgba(${rgb(sc.scrimColor)},${sc.scrim})`]]
    .map(([k, v]) => `${k}:${v}`).join(";");
}


/* ================= groupes à pourcentage (génériques) ================= */
const gFilter = {};
const itemGroups = (items, keyFn, doneFn) => {
  const m = new Map();
  for (const it of items) { const k = keyFn(it) || "Sans groupe"; const g = m.get(k) || { name: k, num: 0, den: 0 }; g.den++; if (doneFn(it)) g.num++; m.set(k, g); }
  return [...m.values()].map(g => ({ ...g, pct: Math.round(100 * g.num / g.den), sub: `${g.num} sur ${g.den}` }));
};
/* Remet un document du site dans la forme attendue (migration des anciens formats, champs ajoutés
   depuis, entrées de navigation manquantes). Appelée par le store à chaque fois que des données y entrent
   (lecture locale, synchro, import) : S() n'a donc plus rien à corriger et se contente de lire. */
function normalizeSite(d) {
  const seed = siteSeed();
  migrateModules(d);
  if ((d.schemaVersion || 1) < SCHEMA_VERSION) d.schemaVersion = SCHEMA_VERSION;
  for (const k of Object.keys(seed)) if (d[k] == null) d[k] = seed[k];
  // « welcome » n'est pas un réglage manquant : il n'existe que pour les comptes créés avec ce bloc d'accueil.
  for (const k of Object.keys(seed.config)) if (k !== "welcome" && d.config[k] == null) d.config[k] = seed.config[k];
  for (const id of Object.keys(MODULE_DEFS)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: !OFF_BY_DEFAULT.includes(id) });
  for (const id of Object.keys(d.modules)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: true });
  for (const k of Object.keys(seed)) if (k !== "modules" && k !== "config" && typeof seed[k] === "object" && !Array.isArray(seed[k])) for (const f of Object.keys(seed[k])) if (d[k][f] == null) d[k][f] = seed[k][f];
  for (const inst of Object.values(d.modules)) if (Object.hasOwn(MODULE_TYPES, inst.type) && MODULE_TYPES[inst.type].normalize) MODULE_TYPES[inst.type].normalize(inst);
  const inbox = inboxId(d.modules); // une seule boîte de réception, même après une fusion entre appareils
  for (const [id, inst] of Object.entries(d.modules)) if (inst.type === "notes" && inst.config.inbox && id !== inbox) inst.config.inbox = false;
  return d;
}
const site = makeStore("selene-site-v1", "site/state", siteSeed, normalizeSite);
/* L'ancien document « board » (tâches du Chantier jusqu'au format 5) n'est plus qu'un point d'entrée :
   ce qu'il contient est versé dans le module Chantier du site, puis il est vidé, et le vidage part au
   serveur à la synchro suivante (sinon chaque nouvel appareil ressusciterait les tâches supprimées).
   Une ancienne version de l'app restée ouverte ailleurs peut encore y écrire : rien n'est perdu.
   Doit être connecté APRÈS le site : versé dans un site pas encore synchronisé (données de départ),
   le contenu rendrait ces données « non vierges » et la synchro les fusionnerait au lieu de les remplacer. */
function absorbBoard(d) {
  if (!Array.isArray(d.tasks)) d.tasks = [];
  if (!d.tasks.length) return d;
  const inst = site.data.modules.chantier;
  if (inst && inst.type === "taches") for (const t of d.tasks) if (!inst.entries.some(x => x.id === t.id)) inst.entries.push(t);
  d.tasks = []; d.schemaVersion = SCHEMA_VERSION;
  site.save();
  return d;
}
const board = makeStore("selene-board-v1", "board/state", () => ({ updatedAt: 0, tasks: [] }), absorbBoard);
const S = () => site.data; // lecture seule : la normalisation a lieu à l'entrée des données, pas ici
const label = id => { const s = S(); return s.config.labels[id] || (s.modules[id] && s.modules[id].label) || MODULE_DEFS[id]; };
const enabled = id => { const m = S().config.modules.find(m => m.id === id); return m ? m.on : false; };

/* Regroupement en pourcentage d'un module : fourni par son type (TYPE_UI[type].grouper), réglé dans inst.config.groups. */
function grouperFor(mod) {
  const inst = Object.hasOwn(S().modules, mod) ? S().modules[mod] : null;
  return inst && TYPE_UI[inst.type].grouper ? TYPE_UI[inst.type].grouper(inst, mod) : null;
}
const gcfg = mod => S().modules[mod].config.groups;
const groupBy = mod => { const G = grouperFor(mod), by = gcfg(mod).by; return G.fields[by] ? by : Object.keys(G.fields)[0]; }; // un champ désactivé depuis ne casse rien
function groupPanel(mod, hint) {
  const G = grouperFor(mod), c = gcfg(mod);
  if (!G || !c || !c.on) return "";
  const by = groupBy(mod);
  let gs = G.groups(by);
  if (c.hideDone) gs = gs.filter(g => g.pct !== 100);
  const sorters = { name: (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "fr"), pct: (a, b) => (b.pct ?? -1) - (a.pct ?? -1), left: (a, b) => ((a.pct ?? 101)) - ((b.pct ?? 101)) };
  gs.sort(sorters[c.sort] || sorters.name);
  const active = gFilter[mod];
  const title = c.title || `Par ${G.fields[by].toLowerCase()}`;
  return `<section><div class="row" style="margin-bottom:4px"><h3 style="margin:0">${esc(title)}</h3><span class="spacer"></span><a class="btn ghost sm" href="#reglages" data-act="goto-groups" data-mod="${esc(mod)}">régler</a></div>
    <p class="hint">${hint}</p>
    <div class="rooms">${gs.map(g => `<button class="room ${active === g.name ? "active" : ""} ${g.pct > 100 ? "over" : ""}" ${G.filterable ? `data-act="grp-filter" data-mod="${esc(mod)}" data-g="${esc(g.name)}"` : "disabled"}><div class="fill" style="width:${Math.min(100, g.pct ?? 0)}%"></div><small>${esc(g.name)}</small><b>${g.pct == null ? "—" : g.pct + " %"}</b><small>${esc(g.sub)}</small></button>`).join("") || `<p class="empty">Rien à regrouper pour l'instant.</p>`}</div></section>`;
}
const gMatch = (mod, it) => { const v = gFilter[mod]; if (!v) return true; return (grouperFor(mod).key(it, groupBy(mod)) || "Sans groupe") === v; };

function streakOf(dates) {
  const set = new Set(dates); let n = 0; const d = new Date();
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ================= confirmation ================= */
function ask(msg) { return new Promise(res => { const d = $("#cdlg"); $("#cmsg").textContent = msg; d.returnValue = ""; d.onclose = () => res(d.returnValue === "ok"); d.showModal(); }); }

/* ================= generic form ================= */
let formCb = null;
function fieldHTML(f, v) {
  const val = v[f.n] ?? "";
  const common = `name="${f.n}" ${f.req ? "required" : ""}`;
  let input;
  if (f.t === "textarea") input = `<textarea ${common} rows="${f.rows || 3}">${esc(val)}</textarea>`;
  else if (f.t === "select") input = `<select ${common}>${f.o.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${String(val) === String(k) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
  else input = `<input type="${f.t || "text"}" ${common} value="${esc(val)}" ${f.list ? `list="${f.list}"` : ""} ${f.t === "number" ? 'min="0" step="1" inputmode="numeric"' : ""}>`;
  return `<label>${esc(f.l)}${input}</label>`;
}
function openForm(title, fields, values, cb) {
  formCb = cb;
  $("#form").innerHTML = `<h2>${esc(title)}</h2>` + fields.map(f => f.row ? `<div class="field-row">${f.row.map(x => fieldHTML(x, values)).join("")}</div>` : fieldHTML(f, values)).join("") +
    `<div class="row"><button class="btn solid" value="save">Enregistrer</button><button class="btn" value="cancel" formnovalidate>Annuler</button></div>`;
  $("#dlg").showModal();
}
$("#dlg").addEventListener("close", () => {
  if ($("#dlg").returnValue !== "save" || !formCb) return;
  const v = {}; new FormData($("#form")).forEach((x, k) => v[k] = typeof x === "string" ? x.trim() : x);
  const cb = formCb; formCb = null;
  try { cb(v); } catch (e) { toast(e.message || "Saisie invalide."); } // sinon l'erreur disparaît en silence
});

/* ================= views ================= */
const VIEWS = {};

/* Sur téléphone, le paysage se réduit à un bandeau à partir de la deuxième ouverture du jour ; décidé une fois
   par chargement, pour qu'il ne se replie pas sous les yeux en cours d'utilisation. */
const HERO_COMPACT = (() => { try { const seen = localStorage.getItem("selene-hero-day") === todayISO(); localStorage.setItem("selene-hero-day", todayISO()); return seen; } catch { return false; } })();
VIEWS.accueil = () => {
  const m = moon(), s = S(), now = todayISO(), win = sceneNow(m);
  const tod = todayTasks().slice(0, 3);
  const alerts = [];
  for (const [id, inst] of Object.entries(s.modules)) if (enabled(id) && TYPE_UI[inst.type].alerts) alerts.push(...TYPE_UI[inst.type].alerts(id, inst, now));
  const inbox = inboxId(s.modules), pending = inbox ? s.modules[inbox].entries.length : 0;
  // Toute la ligne mène au module ; un chevron la déplie sur ses derniers éléments, sans avoir à l'ouvrir.
  const row = id => {
    const inst = Object.hasOwn(s.modules, id) ? s.modules[id] : null, more = inst && TYPE_UI[inst.type].recent ? TYPE_UI[inst.type].recent(inst) : [];
    const r = inst && inst.resume, bridge = r ? `<small class="resume ${bridgeStale(r) ? "stale" : ""}">↳ ${esc(r.text)} · ${ago(r.at)}</small>` : "";
    return `<div class="over-wrap${more.length ? " has-more" : ""} ${tintOf(id)}"><a class="over" href="#${esc(id)}"><b>${sigil(id)}${esc(label(id))}</b><span>${summaryFor(id)}${bridge}</span></a>${more.length ? `<details class="more"><summary><span class="sr">Derniers éléments de ${esc(label(id))}</span></summary><ul>${more.map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : ""}</div>`;
  };
  // Regroupées par domaine quand il y en a (un titre en petites capitales par domaine), sinon une seule liste.
  const ds = domains().map(d => ({ ...d, ids: d.ids.filter(id => id !== inbox) })).filter(d => d.ids.length), named = ds.some(d => d.name);
  const rows = ds.map(d => `${named ? `<p class="grp over-grp">${esc(d.name || "Espaces")}</p>` : ""}${d.ids.map(row).join("")}`).join("") + (enabled("assistant") ? row("assistant") : "");
  return `
  ${s.config.welcome ? `<section><h2>Composer ton espace</h2><p class="hint">Ajoute ce que tu veux suivre, autant de fois que tu veux. Tout se renomme, se règle ou se supprime ensuite dans Réglages.</p>
    ${MODULE_TEMPLATES.map(t => `<div class="set" style="grid-template-columns:1fr auto"><div><b>${esc(t.name)}</b><div class="hint" style="margin:2px 0 0">${esc(t.hint)}</div></div><button class="btn sm" data-act="tpl-add" data-tpl="${esc(t.id)}">Ajouter</button></div>`).join("")}
    <div class="row" style="margin-top:12px"><button class="btn acc" data-act="welcome-done">C'est bon</button></div></section>` : ""}
  <section class="hero${HERO_COMPACT ? " compact" : ""}${win.right ? " txt-right" : ""}${skyLive() ? " live" : ""}" style="${heroStyle(win.sc, win.dark)}" data-weather="${win.sc.weather || ""}" data-leaves="${win.sc.leaves}" data-sun="${win.sun.alt.toFixed(1)}">${forestSVG(m.p, win.sc, win.moonAt, win.mo)}<div class="txt">
    <div class="phase">${m.name}</div>
    <p>Éclairée à ${Math.round(m.illum * 100)} %, jour ${Math.floor(m.age) + 1} du cycle. ${m.p < .5 ? `Pleine lune dans ${m.nextFull} j.` : `Nouvelle lune dans ${m.nextNew} j.`}</p>
    ${win.lineHTML ? `<p class="sky-line">${win.lineHTML}</p>` : ""}${win.events.map(t => `<p class="sky-line sky-event">${esc(t)}</p>`).join("")}
  </div></section>
  ${resumeSection()}
  <div class="two">
    <section><h2>Aujourd'hui</h2><p class="hint">Trois choses. La forêt pousse très bien sans que tu la surveilles.</p>
      <ul class="plain">
        ${tod.map(([id, t]) => taskHTML(id, t)).join("")}
        ${alerts.map(a => `<li class="item alert"><span></span><div>${a.text}</div>${a.actions ? `<div class="row">${a.actions}</div>` : a.href ? `<a class="btn ghost sm" href="${esc(a.href)}">voir</a>` : ""}</li>`).join("")}
      </ul>
      ${!tod.length ? (taskModules().length ? `<p class="empty">Aucune tâche choisie. <button class="btn ghost sm" data-act="task-pick">Tirer une petite tâche au sort</button></p>` : `<p class="empty">Rien de prévu. Un module de tâches remplirait cet espace, si tu y tiens.</p>`) : ""}
      ${agendaHTML()}
      ${dehorsLine()}
      ${radarPlace() && radarWords(radarConf().words).length ? `<p class="hint radar-go"><button class="btn ghost sm" data-act="radar-open">Radar culturel</button> ce qui, près d'ici, parle de tes mots</p>` : ""}
    </section>
    <section class="capsec"><h2>Capturer</h2><p class="hint">Dépose-le ici comme une feuille morte, tu trieras l'humus plus tard.</p>
      ${inbox ? `<div class="capture"><input id="capIn" data-draft placeholder="${esc(s.modules[inbox].config.placeholder)}" aria-label="Capture rapide"><button class="btn acc" data-act="cap-add">Garder</button></div>
      ${pending ? `<p class="hint" style="margin-top:8px"><a href="#${esc(inbox)}">${pending} élément${pending > 1 ? "s" : ""} à trier</a></p>` : ""}`
      : `<p class="hint">Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans <a href="#reglages">Réglages</a>.</p>`}
    </section>
  </div>
  <section><div class="row" style="align-items:baseline"><h2>Où en sont les choses</h2><span class="spacer"></span><a class="btn ghost sm" href="#bilan">Bilan du ${bilanMode() === "mois" ? "mois" : "cycle"}</a></div>${rows}</section>
  ${sortesSection()}`;
};

/* ================= pont de reprise =================
   En haut de chaque module : le prochain geste noté la dernière fois, ou de quoi le noter en partant.
   Le champ s'ouvre de lui-même à la fin du minuteur ; l'ignorer suffit à le refuser. */
let bridgeOpen = null; // module dont le champ « prochain geste » est ouvert
const bridgeStale = r => diffDays(todayISO(), r.at) > 14; // un pont vieux de deux semaines ment peut-être
function bridgeBar(id, inst) {
  const r = inst.resume, m = esc(id);
  if (bridgeOpen === id) return `<div class="bridge"><input id="bridgeIn" data-mod="${m}" maxlength="200" value="${esc(r ? r.text : "")}" placeholder="Le prochain geste, pour la prochaine fois…" aria-label="Prochain geste"><button class="btn sm acc" data-act="bridge-save" data-mod="${m}">Garder</button><button class="btn ghost sm" data-act="bridge-close">plus tard</button></div>`;
  if (r) return `<div class="bridge on ${bridgeStale(r) ? "stale" : ""}"><span>↳ <b>Reprendre :</b> ${esc(r.text)} <span class="hint">· noté ${ago(r.at)}</span></span><span class="acts"><button class="btn ghost sm" data-act="bridge-done" data-mod="${m}">fait</button><button class="btn ghost sm" data-act="bridge-edit" data-mod="${m}">modifier</button></span></div>`;
  return `<div class="bridge off"><button class="btn ghost sm" data-act="bridge-edit" data-mod="${m}">Je m'arrête ici…</button></div>`;
}
function bridgeSave(id) {
  const inst = S().modules[id], inp = $("#bridgeIn"); if (!inst || !inp) return;
  setResume(inst, inp.value, todayISO()); bridgeOpen = null; site.save(); render();
  toast(inst.resume ? "Noté. La prochaine fois commencera ici." : "Pont levé.");
}

const SUMMARY = {
  assistant: () => { const b = backend(); return b === "sample" ? "Branché via claude.ai" : b === "api" ? "Branché via ta clé API" : "Pas encore branché"; }
};
function summaryFor(id) {
  const inst = Object.hasOwn(S().modules, id) ? S().modules[id] : null;
  return inst ? TYPE_UI[inst.type].summary(id, inst) : SUMMARY[id] ? SUMMARY[id]() : "";
}




/* ================= bilan =================
   Une période (cycle lunaire, d'une nouvelle lune à la suivante, ou mois civil), et pour chaque module la
   ligne de bilan que fournit son type (TYPE_UI[type].review), à côté de celle de la période précédente.
   Une information pour prendre du recul, pas un score. */
let bilanOffset = 0;
const bilanMode = () => { try { return localStorage.getItem("selene-bilan") === "mois" ? "mois" : "lune"; } catch { return "lune"; } };
/* [from, to[ en dates ISO ; offset 0 = la période en cours, 1 = la précédente… */
function periodOf(mode, offset, now = Date.now()) {
  if (mode === "mois") {
    const d = new Date(now), start = new Date(d.getFullYear(), d.getMonth() - offset, 1), end = new Date(d.getFullYear(), d.getMonth() - offset + 1, 1);
    return { from: iso(start), to: iso(end), name: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
  }
  const len = SYNODIC * 86400000, k = Math.floor((now - NEW_MOON_REF) / len) - offset, start = NEW_MOON_REF + k * len, end = start + len;
  return { k, start, from: iso(new Date(start)), to: iso(new Date(end)), name: `Cycle du ${fmt(iso(new Date(start)), { day: "numeric", month: "long" })} au ${fmt(iso(new Date(end - 86400000)), { day: "numeric", month: "long" })}` };
}

/* ================= test lunaire =================
   Test de Rayleigh (statistique circulaire) : l'activité (tout ce qui est daté, le même corpus que la
   recherche) se concentre-t-elle autour d'une phase de la lune, plutôt que d'être uniformément répartie sur
   le cycle ? Un résultat nul a de la valeur : il dit que la lune n'y est pour rien. Un seul test, ici — le
   répéter ailleurs avec d'autres découpages ferait courir le risque classique des tests multiples : à force
   d'essayer, on finit par trouver un faux signal. */
const LUNAR_MIN_N = 40;
const lunarPhase = date => { const t = ((Date.parse(date + "T12:00:00Z") - NEW_MOON_REF) / 86400000 % SYNODIC + SYNODIC) % SYNODIC; return t / SYNODIC; };
function lunarTest() {
  const angles = [];
  for (const inst of Object.values(S().modules)) {
    const ui = TYPE_UI[inst.type];
    if (!ui || !ui.texts || isConcordance(inst)) continue;
    for (const t of ui.texts(inst)) if (t.date) angles.push(lunarPhase(t.date) * 2 * Math.PI);
  }
  const n = angles.length;
  if (n < LUNAR_MIN_N) return { n, enough: false };
  let c = 0, s = 0;
  for (const a of angles) { c += Math.cos(a); s += Math.sin(a); }
  const R = Math.sqrt(c * c + s * s) / n, Z = n * R * R;
  // Approximation asymptotique classique du p (Zar, Biostatistical Analysis) ; suffisante au-delà de 40 événements.
  const p = Math.exp(-Z) * (1 + (2 * Z - Z * Z) / (4 * n) - (24 * Z - 132 * Z * Z + 76 * Z ** 3 - 9 * Z ** 4) / (288 * n * n));
  const meanPhase = (Math.atan2(s, c) / (2 * Math.PI) + 1) % 1;
  return { n, enough: true, R, p: Math.max(0, Math.min(1, p)), meanPhase };
}
function lunarSection() {
  const r = lunarTest();
  if (!r.enough) return `<section><h3>Lune</h3><p class="hint">Pas assez de matière pour un test honnête : ${r.n} événement${r.n > 1 ? "s" : ""} daté${r.n > 1 ? "s" : ""} au lieu de ${LUNAR_MIN_N} au moins. Reviens quand le corpus aura grandi.</p></section>`;
  const sig = r.p < .05;
  return `<section><h3>Lune</h3><p class="hint">Test de Rayleigh sur ${r.n} événement${r.n > 1 ? "s" : ""} daté${r.n > 1 ? "s" : ""} : ta lune éclaire-t-elle vraiment ton activité, ou est-ce une histoire qu'on se raconte ? Un seul test compte ici ; le refaire ailleurs sous d'autres formes userait sa valeur (tests multiples).</p>
    <p>${sig
      ? `Concentration autour de ${esc(moonName(r.meanPhase).toLowerCase())} (R = ${r.R.toFixed(2)}, p = ${r.p.toFixed(3)}). Ce n'est pas rien, mais ce n'est pas une preuve : une seule corrélation, jamais répétée ni contrôlée.`
      : `Rien de concentré (R = ${r.R.toFixed(2)}, p = ${r.p.toFixed(3)}) : la répartition ne se distingue pas de l'uniforme. La lune plaide non coupable, ce qui est aussi une réponse.`}</p></section>`;
}
VIEWS.bilan = () => {
  if (routeOf().entry === "planche") return plancheView();
  const mode = bilanMode(), cur = periodOf(mode, bilanOffset), prev = periodOf(mode, bilanOffset + 1), s = S();
  const rows = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id) && TYPE_UI[s.modules[m.id].type].review).map(m => {
    const inst = s.modules[m.id], review = TYPE_UI[inst.type].review, r = review(inst, cur.from, cur.to), p = review(inst, prev.from, prev.to);
    return `<div class="over-wrap"><div class="over"><b>${esc(label(m.id))}</b><span>${esc(r || "—")}</span><em class="hint" style="margin:0">avant : ${esc(p || "—")}</em></div></div>`;
  }).join("");
  const tab = (m, l) => `<button class="btn sm ${mode === m ? "acc" : "ghost"}" data-act="bilan-mode" data-m="${m}">${l}</button>`;
  // Ce que les idées notées pendant la période revendiquent de savoir ; chaque statut mène à la recherche.
  const eps = epCounts(cur.from, cur.to), epLine = Object.keys(EP_STATUS).filter(k => eps[k]).map(k => `<button class="btn ghost sm" data-act="search-for" data-q="statut:${esc(EP_STATUS[k])}">${plural(eps[k], EP_STATUS[k])}</button>`).join("");
  return `<div class="row" style="margin-bottom:6px"><h2 style="margin:0">Bilan</h2><span class="spacer"></span>${tab("lune", "Cycle lunaire")}${tab("mois", "Mois")}<button class="btn ghost sm" data-act="planche-open" title="Le cycle en planche A4, à imprimer ou enregistrer en PDF">Planche</button></div>
  <div class="row" style="margin-bottom:18px"><button class="btn ghost" data-act="bilan-nav" data-d="1" aria-label="Période précédente">‹</button><b style="text-transform:none">${esc(cur.name)}</b>${bilanOffset ? `<button class="btn ghost" data-act="bilan-nav" data-d="-1" aria-label="Période suivante">›</button>` : ""}</div>
  <p class="hint">Ce qui s'est passé dans chaque module pendant la période, et, en face, la période d'avant. Aucune note, aucun trophée : les chiffres suffisent à culpabiliser.</p>
  <section>${rows || `<p class="empty">Aucun module à résumer.</p>`}</section>
  ${epLine ? `<section><h3>Statut des idées notées</h3><p class="hint">Ce qu'elles revendiquent de savoir. Une hypothèse n'est pas une faiblesse, c'est une dette à rembourser.</p><div class="row">${epLine}</div></section>` : ""}
  ${driftSection(mode, cur)}
  ${tensionSection()}
  ${lunarSection()}`;
};
/* ================= planche de lunaison =================
   Le bilan d'un cycle mis en page comme une planche d'atlas (A4 portrait), à imprimer ou à enregistrer en PDF par le
   navigateur : vectoriel, net, sans bibliothèque. Numérotée par la lunaison de Meeus : la nouvelle lune de référence
   du code (NEW_MOON_REF, 6 janvier 2000) est sa lunaison 0, donc le k de periodOf est ce numéro. Rien n'y est calculé
   de neuf : chaque chiffre vient du bilan (review, lexicalDrift, concordance, epCounts, openTensions). Son style vit
   ici, en chaîne, pour servir aussi la planche téléchargée, qui doit se suffire à elle-même. */
let plancheOffset = 0;
const datedItems = inst => [...(inst.entries || []), ...(inst.scraps || [])].filter(x => x && typeof x.date === "string");
function plancheData(offset, now = Date.now()) {
  const cur = periodOf("lune", offset, now), prev = periodOf("lune", offset + 1, now), s = S(), len = SYNODIC * 86400000;
  const days = []; for (let d = cur.from; d < cur.to; d = addDaysTo(d, 1)) days.push(d);
  const at = new Map(days.map((d, i) => [d, i])), total = days.map(() => 0);
  const rows = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id)).map(m => {
    const inst = s.modules[m.id], ui = TYPE_UI[inst.type];
    if (!ui || isConcordance(inst)) return null;
    const spark = days.map(() => 0);
    for (const x of datedItems(inst)) { const i = at.get(x.date); if (i != null) { spark[i]++; total[i]++; } }
    const review = ui.review ? ui.review(inst, cur.from, cur.to) : "", before = ui.review ? ui.review(inst, prev.from, prev.to) : "";
    return review || spark.some(Boolean) ? { id: m.id, review, before, spark } : null;
  }).filter(Boolean);
  // Les quartiers : nouvelle lune, premier quartier, pleine lune, dernier quartier, au jour près.
  const quarters = [0, .25, .5, .75].map(f => { const d = iso(new Date(cur.start + f * len)); return { f, date: d, i: at.get(d) ?? Math.round(f * days.length) }; });
  const appeared = [];
  for (const [id, inst] of Object.entries(s.modules)) {
    if (!enabled(id) || !isConcordance(inst)) continue;
    for (const r of concordance(inst)) { const ds = r.hits.map(h => h.date).filter(Boolean).sort(); if (ds.length && ds[0] >= cur.from && ds[0] < cur.to) appeared.push({ name: r.e.title, n: ds.filter(d => d < cur.to).length }); }
  }
  const drift = lexicalDrift("lune", offset);
  return { k: cur.k, from: cur.from, to: cur.to, days, total, rows, quarters, appeared, n: total.reduce((a, b) => a + b, 0),
    rising: drift.enough ? drift.rising.slice(0, 12).map(x => ({ w: drift.word(x.k), n: x.n })) : null,
    ep: epCounts(cur.from, cur.to), tensions: openTensions().filter(t => !t.date || t.date < cur.to).length };
}
/* La règle de lunaison : un trait par jour, haut comme le nombre d'entrées datées ; les quartiers en glyphes, au-dessus. */
function rulerSVG(p) {
  const n = p.days.length, W = n * 10, max = Math.max(1, ...p.total), sh = (f, x) => {
    const r = 4.5, c = `cx="${x}" cy="9" r="${r}"`;
    if (f === 0) return `<circle ${c} fill="none" stroke="currentColor" stroke-width=".8"/>`;
    if (f === .5) return `<circle ${c} fill="currentColor"/>`;
    const side = f === .25 ? 1 : 0; // premier quartier éclairé à droite (au nord de l'équateur), dernier à gauche
    return `<circle ${c} fill="none" stroke="currentColor" stroke-width=".8"/><path d="M${x},${9 - r}A${r},${r} 0 0 ${side} ${x},${9 + r}Z" fill="currentColor"/>`;
  };
  const bars = p.total.map((v, i) => v ? `<rect x="${i * 10 + 2.5}" y="${(52 - 32 * v / max).toFixed(1)}" width="5" height="${(32 * v / max).toFixed(1)}"/>` : `<rect x="${i * 10 + 4.5}" y="51" width="1" height="1"/>`).join("");
  // L'étiquette d'un quartier au bord de la règle s'y aligne au lieu d'en déborder.
  const q = p.quarters.map(x => { const cx = x.i * 10 + 5, anchor = cx < 20 ? "start" : cx > W - 20 ? "end" : "middle";
    return `${sh(x.f, cx)}<text x="${anchor === "start" ? 0 : anchor === "end" ? W : cx}" y="66" text-anchor="${anchor}">${esc(fmt(x.date, { day: "numeric", month: "short" }))}</text>`; }).join("");
  return `<svg viewBox="0 0 ${W} 70" role="img" aria-label="Règle de lunaison : entrées datées par jour, ${p.n} en tout"><g fill="currentColor" opacity=".85">${bars}</g><path d="M0,52.5H${W}" stroke="currentColor" stroke-width=".5"/>${p.days.map((d, i) => `<path d="M${i * 10 + 5},53v${i % 7 ? 2 : 4}" stroke="currentColor" stroke-width=".4"/>`).join("")}<g font-size="6" fill="currentColor">${q}</g></svg>`;
}
const sparkSVG = (vals, max) => `<svg viewBox="0 0 ${vals.length * 4} 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0,19.5H${vals.length * 4}" stroke="currentColor" stroke-width=".4"/><g fill="currentColor">${vals.map((v, i) => v ? `<rect x="${i * 4 + .6}" y="${(19.5 - 18 * v / max).toFixed(1)}" width="2.8" height="${(18 * v / max).toFixed(1)}"/>` : "").join("")}</g></svg>`;
function plancheHTML(p) {
  const long = d => fmt(d, { day: "numeric", month: "long", year: "numeric" }), max = Math.max(1, ...p.rows.flatMap(r => r.spark));
  const eps = Object.keys(EP_STATUS).filter(k => p.ep[k]);
  return `<article class="planche" aria-labelledby="plTitle">
  <header class="pl-head"><p class="pl-no">Planche ${p.k}</p><h2 id="plTitle">Lunaison du ${esc(long(p.from))} au ${esc(long(addDaysTo(p.to, -1)))}</h2>
    <p class="pl-sub">${p.n} entrée${p.n > 1 ? "s" : ""} datée${p.n > 1 ? "s" : ""} · lunaison n° ${p.k} de Meeus</p></header>
  <figure class="pl-regle">${rulerSVG(p)}<figcaption>Règle de lunaison : un trait par jour, haut comme le nombre d'entrées datées ; les phases aux quartiers.</figcaption></figure>
  <table class="pl-mods"><caption class="sr">Par espace : la ligne du cycle, celle du précédent, l'activité jour par jour</caption><tbody>
    ${p.rows.map(r => `<tr><th scope="row">${sigil(r.id)}${esc(label(r.id))}</th><td>${esc(r.review || "—")}<small>avant : ${esc(r.before || "—")}</small></td><td class="pl-spark">${sparkSVG(r.spark, max)}</td></tr>`).join("") || `<tr><td>Aucun espace à résumer.</td></tr>`}
  </tbody></table>
  <div class="pl-cols">
    <section><h3>Mots émergents</h3>${p.rising == null ? `<p class="pl-muted">Pas assez de textes pour en parler.</p>` : p.rising.length ? `<ul>${p.rising.map(x => `<li>${esc(x.w)} <span>${x.n}</span></li>`).join("")}</ul>` : `<p class="pl-muted">Aucun ne se détache.</p>`}</section>
    <section><h3>Motifs apparus</h3>${p.appeared.length ? `<ul>${p.appeared.map(x => `<li>${esc(x.name)} <span>${x.n}</span></li>`).join("")}</ul>` : `<p class="pl-muted">Aucun motif neuf.</p>`}</section>
    <section><h3>Statut des idées</h3>${eps.length ? `<ul>${eps.map(k => `<li>${esc(EP_STATUS[k])} <span>${p.ep[k]}</span></li>`).join("")}</ul>` : `<p class="pl-muted">Aucune idée qualifiée.</p>`}</section>
    <section><h3>Tensions ouvertes</h3><p>${p.tensions ? `${p.tensions} à ce jour, nées avant la fin du cycle.` : `Aucune.`}</p></section>
  </div>
  <footer class="pl-foot">${esc(S().config.name || "Selene")} · planche tirée le ${esc(long(todayISO()))}</footer></article>`;
}
const PLANCHE_CSS = `.planche{max-width:820px;margin:0 auto;padding:26px 30px;border:1px solid var(--rule);color:var(--ink)}
.pl-head{text-align:center;border-bottom:1px solid var(--rule);padding-bottom:10px;margin-bottom:12px}
.pl-no{margin:0;font-family:var(--f-label,"Spectral SC",Georgia,serif);text-transform:lowercase;letter-spacing:.14em;color:var(--muted)}
.planche h2{margin:4px 0 2px;font-size:1.6rem;font-weight:500}
.pl-sub,.pl-muted{margin:0;color:var(--muted);font-size:.88rem}
.pl-regle{margin:6px 0 14px}.pl-regle svg{display:block;width:100%;height:auto}
.pl-regle figcaption,.pl-foot{font-size:.76rem;color:var(--muted);text-align:center}
.pl-mods{width:100%;border-collapse:collapse;font-size:.86rem}
.pl-mods th,.pl-mods td{border-top:1px solid var(--rule);padding:6px;text-align:left;vertical-align:top}
.pl-mods th{font-weight:500;white-space:nowrap}
.pl-mods small{display:block;color:var(--muted);font-size:.78rem}
.pl-spark{width:32%}.pl-spark svg{display:block;width:100%;height:22px}
.pl-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 28px;margin-top:14px}
.pl-cols h3{margin:0 0 4px;font-family:var(--f-label,"Spectral SC",Georgia,serif);text-transform:lowercase;letter-spacing:.06em;font-size:.95rem;font-weight:400;border-bottom:1px solid var(--rule)}
.pl-cols ul{list-style:none;margin:0;padding:0;columns:2;column-gap:14px;font-size:.86rem}
.pl-cols li span{color:var(--muted);font-variant-numeric:tabular-nums lining-nums}
.pl-cols p{font-size:.86rem;margin:0}
.pl-foot{margin-top:16px;border-top:1px solid var(--rule);padding-top:6px}
@media (max-width:640px){.planche{padding:16px 12px}.pl-cols{grid-template-columns:minmax(0,1fr)}.pl-spark{width:38%}}
@media print{
  @page{size:A4 portrait;margin:12mm}
  html,body{background:#fff!important}
  .app>.side,nav.tabbar,.pl-tools,#toast,dialog{display:none!important}
  .wrap{max-width:none!important;padding:0!important;margin:0!important}
  .planche{--ink:#141a16;--muted:#4a524d;--rule:#a9b0aa;max-width:none;border:0;padding:0;color:#141a16;background:#fff}
  .pl-mods tr,.pl-cols section,.pl-regle{break-inside:avoid}
}`;
function ensurePlancheCss() {
  try { if (!document.getElementById("plancheCss")) { const st = document.createElement("style"); st.id = "plancheCss"; st.textContent = PLANCHE_CSS; document.head.appendChild(st); } } catch {}
}
function plancheView() {
  ensurePlancheCss();
  return `<div class="pl-tools row" style="margin-bottom:14px"><a class="btn ghost sm" href="#bilan">‹ Bilan</a><span class="spacer"></span><button class="btn ghost" data-act="planche-nav" data-d="1" aria-label="Lunaison précédente">‹</button>${plancheOffset ? `<button class="btn ghost" data-act="planche-nav" data-d="-1" aria-label="Lunaison suivante">›</button>` : ""}<button class="btn sm" data-act="planche-print">Imprimer ou enregistrer en PDF</button><button class="btn ghost sm" data-act="planche-dl" title="Un fichier .html autonome, si l'impression est bloquée">Télécharger</button></div>
  ${plancheHTML(plancheData(plancheOffset))}`;
}
/* La planche téléchargée : un .html autonome, en clair, qui s'imprime tel quel (utile là où window.print est bloqué). */
function plancheFile() {
  const p = plancheData(plancheOffset);
  const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planche ${p.k}</title>
<style>:root{--ink:#141a16;--muted:#4a524d;--rule:#a9b0aa}body{margin:0;padding:24px 12px;background:#fbfaf6;color:var(--ink);font-family:Georgia,"Times New Roman",serif}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sig{width:1.05em;height:1.05em;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.14em;margin-right:.5em}
${PLANCHE_CSS}</style></head><body>${plancheHTML(p)}</body></html>`;
  return downloadFile(`planche-${p.k}.html`, doc, "text/html", `Planche ${p.k}`);
}
/* ================= tensions =================
   Une tension (« contredit ») reste ouverte tant qu'aucune entrée ne dérive des deux à la fois. Ce n'est pas
   une période : une contradiction ne s'éteint pas avec le cycle lunaire. Les plus anciennes d'abord. */
function openTensions() {
  const items = thoughtItems(), parents = [];
  for (const it of items) { const ps = new Set((it.e.links || []).filter(l => l.type === "derive").map(l => l.to)); if (ps.size > 1) parents.push(ps); }
  const resolved = (a, b) => parents.some(ps => ps.has(a) && ps.has(b));
  const out = [];
  for (const it of items) for (const l of it.e.links || []) if (l.type === "contredit" && refFind(l.to) && !resolved(it.ref, l.to)) out.push({ a: it.ref, b: l.to, date: l.date || "" });
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
/* ================= sortes =================
   Un tirage dans son propre matériau : un fragment ou une note qu'on n'a pas retouché depuis longtemps, une
   tension ouverte, un motif en jachère. Pondéré par l'oubli : plus c'est ancien, plus ça a de chances de
   sortir. Rien n'est enregistré ; le dernier tirage vit dans une variable, oublié à la prochaine ouverture. */
const SORTES_MIN_DAYS = 14; // en dessous, ce n'est pas de l'oubli, c'est hier
let sortesLast = null;
function sortesPool() {
  const now = todayISO(), out = [];
  for (const [mod, m] of Object.entries(S().modules)) {
    if (!enabled(mod)) continue;
    // Accolades obligatoires sur chaque branche : un « if » nu dans un for (comme celui des notes) capturerait
    // sinon le « else if » suivant (dangling else), et la branche motifs ne s'exécuterait jamais.
    if (m.type === "cumul") { for (const f of m.scraps || []) { const last = f.editedAt || f.date; if (last) out.push({ kind: "fragment", mod, e: f, days: diffDays(now, last) }); } }
    else if (m.type === "notes") { for (const e of m.entries) if (e.date) out.push({ kind: "note", mod, e, days: diffDays(now, e.date) }); }
    else if (isConcordance(m)) { for (const r of concordance(m)) if (fallow(m, r)) out.push({ kind: "motif", mod, e: r.e, days: r.last ? diffDays(now, r.last.date) : 3650 }); }
  }
  for (const t of openTensions()) out.push({ kind: "tension", a: t.a, b: t.b, days: t.date ? diffDays(now, t.date) : SORTES_MIN_DAYS });
  return out.filter(x => x.days >= SORTES_MIN_DAYS);
}
/* Tirage pondéré : chaque candidat pèse son nombre de jours de silence, donc davantage de chances pour ce qui
   dort depuis longtemps, sans jamais exclure ce qui vient tout juste de passer le seuil. */
function sortesDraw() {
  const pool = sortesPool(); if (!pool.length) return null;
  let r = Math.random() * pool.reduce((a, x) => a + x.days, 0);
  for (const x of pool) { r -= x.days; if (r <= 0) return x; }
  return pool.at(-1);
}
function sortesCard(x) {
  if (x.kind === "tension") return `<div class="card"><span class="tag">Tension ouverte</span><p>${refHTML(x.a)} <span class="hint">contredit</span> ${refHTML(x.b)}</p><div class="row"><button class="btn ghost sm" data-act="tension-resolve" data-a="${esc(x.a)}" data-b="${esc(x.b)}">résoudre</button><button class="btn ghost sm" data-act="tension-dossier" data-a="${esc(x.a)}" data-b="${esc(x.b)}">dossier</button></div></div>`;
  if (x.kind === "motif") return `<div class="card"><span class="tag">Motif en jachère, ${esc(label(x.mod))}</span><p><b>${esc(x.e.title)}</b></p><div class="row"><a class="btn ghost sm" href="#${esc(x.mod)}">voir</a><button class="btn ghost sm" data-act="search-for" data-q="${esc(x.e.title)}">chercher</button></div></div>`;
  return `<div class="card"><span class="tag">${esc(label(x.mod))}, ${x.kind === "fragment" ? "fragment" : "note"} endormi</span><p style="white-space:pre-wrap">${esc(excerpt(x.e, 200))}</p><div class="meta"><span>${plural(x.days, "jour")} sans y toucher</span></div><div class="row"><a class="btn ghost sm" href="#${esc(x.mod)}">voir</a></div></div>`;
}
function sortesSection() {
  return `<section><h2>Tirer un sort</h2><p class="hint">Un fragment endormi, une note oubliée, une tension ouverte ou un motif en jachère — le hasard pondéré par l'oubli, dans ton seul matériau.</p>
    ${sortesLast ? sortesCard(sortesLast) : ""}
    <button class="btn ${sortesLast ? "ghost" : ""} sm" data-act="sortes-draw">${sortesLast ? "Retirer" : "Tirer"}</button></section>`;
}
function tensionSection() {
  const ts = openTensions();
  if (!ts.length) return "";
  return `<section><h3>Tensions ouvertes</h3><p class="hint">Deux entrées qui se contredisent, en attente d'une synthèse qui dérive des deux. Aucune urgence : certaines contradictions sont plus fécondes que leurs solutions.</p>
    <ul class="plain">${ts.map(t => `<li class="item"><span></span><div>${refHTML(t.a)} <span class="hint">contredit</span> ${refHTML(t.b)}${t.date ? `<div class="meta"><span>ouverte ${ago(t.date)}</span></div>` : ""}</div><div class="row"><button class="btn ghost sm" data-act="tension-resolve" data-a="${esc(t.a)}" data-b="${esc(t.b)}">résoudre</button><button class="btn ghost sm" data-act="tension-dossier" data-a="${esc(t.a)}" data-b="${esc(t.b)}">dossier</button></div></li>`).join("")}</ul></section>`;
}
/* ================= dérive lexicale =================
   Les mots propres à la période, comparés aux six précédentes (même découpage : cycles ou mois), dans tous
   les textes datés de tous les modules. Un mot compte une fois par texte (fréquence documentaire) : un texte
   qui répète « lune » dix fois ne fait pas une obsession. Rien n'est enregistré ; tout est recalculé. */
const DRIFT_REF = 6, DRIFT_MIN_TEXTS = 5;
// Mots vides (repliés, sans accents) : ceux qui ne disent rien du sujet. Les mots de moins de 3 lettres sont écartés d'office.
const STOPWORDS = new Set(("les des une est pas que qui quoi dont par pour sur sous dans avec sans entre vers chez mais donc car comme aussi alors ainsi " +
  "encore deja bien tres trop plus moins tout toute tous toutes rien cette ces cet son ses mon mes ton tes notre nos votre vos leur leurs " +
  "elle elles ils nous vous lui eux meme autre autres cela ceci celui celle ceux celles quand puis apres avant depuis pendant jusqu ici " +
  "etre avoir fait faire faut peut peux sont etait etaient ete suis sommes etes avons avez ont avait avaient sera seront serait aurait " +
  "chaque aucun aucune quelque quelques parce lorsque oui non fois jour jours aujourd hui demain hier chose choses the and for with this " +
  "that from are was have not but").split(" "));
/* Les mots d'un texte, sous leur forme repliée (clé) et telle qu'écrite (pour l'afficher), pluriel en s/x ramené au singulier. */
const driftCache = new Map();
function driftWords(text) {
  let out = driftCache.get(text);
  if (!out) {
    out = new Map();
    // Replié une seule fois (un fold par mot remplirait son cache de mots isolés et en chasserait les textes) ;
    // fold garde lettres et séparateurs à leur place, donc les deux découpages se correspondent mot pour mot.
    const sep = /[^\p{L}\p{N}]+/u, raws = String(text).toLowerCase().split(sep), keys = fold(text).split(sep);
    for (let i = 0; i < raws.length; i++) {
      const raw = raws[i];
      let k = keys.length === raws.length ? keys[i] : fold(raw);
      if (k.length < 3 || /\d/.test(k) || STOPWORDS.has(k)) continue;
      if (k.length > 4 && /[sx]$/.test(k)) k = k.slice(0, -1);
      if (!out.has(k)) out.set(k, raw);
    }
    if (driftCache.size >= 20000) driftCache.clear();
    driftCache.set(text, out);
  }
  return out;
}
function lexicalDrift(mode, offset) {
  const cur = periodOf(mode, offset), oldest = periodOf(mode, offset + DRIFT_REF);
  const now = new Map(), before = new Map(), shown = new Map(); let nNow = 0, nBefore = 0;
  for (const inst of Object.values(S().modules)) {
    const ui = TYPE_UI[inst.type];
    if (!ui || !ui.texts || isConcordance(inst)) continue;
    for (const t of ui.texts(inst)) {
      if (!t.date || t.date < oldest.from || t.date >= cur.to) continue;
      const inCur = t.date >= cur.from, bag = inCur ? now : before;
      if (inCur) nNow++; else nBefore++;
      for (const [k, raw] of driftWords(t.text)) { bag.set(k, (bag.get(k) || 0) + 1); if (!shown.has(k)) shown.set(k, raw); }
    }
  }
  // Émergent : présent dans au moins deux textes de la période, et bien plus fréquent qu'avant (rapport lissé,
  // pondéré par le nombre de textes : un mot vu deux fois ne pèse pas autant qu'un mot vu dix fois).
  const rate = (n, total) => (n + 0.5) / (total + 1);
  const rising = [...now].filter(([, n]) => n >= 2).map(([k, n]) => ({ k, n, before: before.get(k) || 0, score: n * Math.log(rate(n, nNow) / rate(before.get(k) || 0, nBefore)) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.k.localeCompare(b.k)).slice(0, 8);
  // En extinction : fréquent avant (au moins trois textes), absent de la période.
  const fading = [...before].filter(([k, n]) => n >= 3 && !now.has(k)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([k, n]) => ({ k, n }));
  return { enough: nNow >= DRIFT_MIN_TEXTS && nBefore >= DRIFT_MIN_TEXTS, nNow, nBefore, rising, fading, word: k => shown.get(k) };
}
function driftSection(mode, cur) {
  const d = memoInRender("drift", () => lexicalDrift(mode, bilanOffset)), motifs = Object.keys(S().modules).find(k => enabled(k) && isConcordance(S().modules[k]));
  const unit = mode === "mois" ? "mois" : "cycles";
  if (!d.enough) return `<section><h3>Vocabulaire</h3><p class="hint">Pas encore assez de textes datés pour parler de dérive : ${plural(d.nNow, "texte")} dans la période, ${plural(d.nBefore, "texte")} dans les six ${unit} d'avant (${DRIFT_MIN_TEXTS} de chaque côté au moins).</p></section>`;
  const known = motifs ? new Set(S().modules[motifs].entries.map(e => fold(e.title))) : new Set();
  const chip = (k, extra) => `<span class="chip"><button class="btn ghost sm" data-act="search-for" data-q="${esc(d.word(k))}">${esc(d.word(k))}${extra}</button>${motifs && !known.has(fold(d.word(k))) ? `<button class="btn ghost sm" data-act="motif-add" data-mod="${esc(motifs)}" data-q="${esc(d.word(k))}" title="En faire un motif" aria-label="En faire un motif">+</button>` : ""}</span>`;
  return `<section><h3>Vocabulaire</h3><p class="hint">Les mots propres à la période, comparés aux six ${unit} d'avant (${plural(d.nNow, "texte")} contre ${d.nBefore}). Une piste, pas un diagnostic : deux occurrences ne font pas une obsession.${motifs ? " « + » en fait un motif." : ""}</p>
    ${d.rising.length ? `<p class="hint" style="margin:0 0 4px">Émergent</p><div class="row">${d.rising.map(x => chip(x.k, ` · ${x.n}${x.before ? ` (avant ${x.before})` : ""}`)).join("")}</div>` : `<p class="empty">Aucun mot ne se détache. Constance, ou routine.</p>`}
    ${d.fading.length ? `<p class="hint" style="margin:12px 0 4px">Absent cette fois, fréquent avant</p><div class="row">${d.fading.map(x => chip(x.k, ` · ${x.n} avant`)).join("")}</div>` : ""}</section>`;
}
function epCounts(from, to) {
  const out = {};
  for (const inst of Object.values(S().modules)) { const ui = TYPE_UI[inst.type]; if (ui && ui.texts) for (const t of ui.texts(inst)) if (t.ep && t.date && t.date >= from && t.date < to) out[t.ep] = (out[t.ep] || 0) + 1; }
  return out;
}

/* ================= recherche =================
   Dans tous les textes de tous les modules (chaque type dit lesquels : TYPE_UI[type].texts), sans tenir
   compte des accents ni de la casse ; tous les mots doivent apparaître. */
let searchQuery = "";
// Chaque caractère devient sa forme sans accent et en minuscule, de même longueur exactement (sinon il reste tel
// quel : emoji sur deux unités, « İ » qui devient deux lettres) : les positions restent alignées pour surligner.
// Fonction pure et appelée sur tout l'historique à chaque recherche ou concordance : ses résultats sont gardés
// (jamais périmés, puisque la même entrée donne toujours la même sortie), dans une limite de taille.
const foldCache = new Map();
const fold = s => {
  s = String(s);
  let f = foldCache.get(s);
  if (f === undefined) {
    f = [...s].map(ch => { const b = ch.normalize("NFD")[0].toLowerCase(); return b.length === ch.length ? b : ch; }).join("");
    if (foldCache.size >= 20000) foldCache.clear();
    foldCache.set(s, f);
  }
  return f;
};
/* « statut:hypothèse » (ou « statut:hyp ») ne garde que ce qui porte ce statut ; seul, il les liste tous.
   Un statut inconnu ou vide ne trouve rien, plutôt que d'être ignoré en silence. */
const epQuery = w => { const q = w.slice("statut:".length); return (q && Object.keys(EP_STATUS).find(k => fold(EP_STATUS[k]).startsWith(q))) || null; };
function searchAll(q) {
  const words = fold(q).split(/\s+/).filter(Boolean), st = words.find(w => w.startsWith("statut:")), want = st ? epQuery(st) : null;
  const terms = words.filter(w => !w.startsWith("statut:")), out = [];
  if ((st && !want) || (!terms.length && !want)) return out;
  for (const m of S().config.modules) {
    const inst = Object.hasOwn(S().modules, m.id) ? S().modules[m.id] : null, ui = inst && TYPE_UI[inst.type];
    if (!ui || !ui.texts) continue;
    for (const t of ui.texts(inst)) { const f = fold(t.text); if ((!want || t.ep === want) && terms.every(w => f.includes(w))) out.push({ id: m.id, ...t }); }
  }
  return out;
}
function highlight(text, q) {
  const f = fold(text), marks = [];
  for (const w of fold(q).split(/\s+/).filter(w => w && !w.startsWith("statut:"))) { let i = f.indexOf(w); while (i >= 0) { marks.push([i, i + w.length]); i = f.indexOf(w, i + w.length); } }
  marks.sort((a, b) => a[0] - b[0]);
  let html = "", pos = 0;
  for (const [a, b] of marks) { if (a < pos) continue; html += esc(text.slice(pos, a)) + `<mark>${esc(text.slice(a, b))}</mark>`; pos = b; }
  return html + esc(text.slice(pos));
}
/* Facettes de la recherche : un espace, une période (la lunaison ou le mois en cours), un statut. Propres à
   l'appareil ; une recherche lancée d'ailleurs (un mot du bilan, un motif) repart sans filtre. */
const searchFacets = { mod: "", period: "", ep: "" };
const facetPeriod = k => k ? periodOf(k, 0) : null;
function facetFilter(hits, skip = "") {
  const f = searchFacets, per = skip !== "period" && facetPeriod(f.period);
  return hits.filter(h => (skip === "mod" || !f.mod || h.id === f.mod) && (!per || (h.date && h.date >= per.from && h.date < per.to)) && (skip === "ep" || !f.ep || h.ep === f.ep));
}
VIEWS.recherche = () => {
  const all = searchAll(searchQuery), hits = facetFilter(all), f = searchFacets, s = S();
  // Chaque facette compte ce que donneraient ses valeurs, les autres facettes restant appliquées.
  const chip = (k, v, text, n) => `<button type="button" class="chip-f ${f[k] === v ? "on" : ""}" data-act="facet" data-k="${k}" data-v="${esc(v)}" aria-pressed="${f[k] === v}">${text}${n != null ? ` <span>${n}</span>` : ""}</button>`;
  const byMod = facetFilter(all, "mod"), byPer = facetFilter(all, "period"), byEp = facetFilter(all, "ep");
  const mods = s.config.modules.map(m => m.id).filter(id => byMod.some(h => h.id === id));
  const facets = all.length ? `<div class="facets">
    <div class="row">${chip("mod", "", "Tous les espaces", byMod.length)}${mods.map(id => chip("mod", id, `${sigil(id)}${esc(label(id))}`, byMod.filter(h => h.id === id).length)).join("")}</div>
    <div class="row">${[["", "Toute date"], ["lune", "Cette lunaison"], ["mois", "Ce mois-ci"]].map(([v, t]) => chip("period", v, t, v ? byPer.filter(h => { const p = facetPeriod(v); return h.date && h.date >= p.from && h.date < p.to; }).length : byPer.length)).join("")}
      ${Object.keys(EP_STATUS).some(k => byEp.some(h => h.ep === k)) ? `<span class="spacer"></span>${chip("ep", "", "Tout statut", null)}${Object.keys(EP_STATUS).filter(k => byEp.some(h => h.ep === k)).map(k => chip("ep", k, `${epGlyph(k)}${esc(EP_STATUS[k])}`, byEp.filter(h => h.ep === k).length)).join("")}` : ""}</div></div>` : "";
  // Groupés par espace, dans l'ordre de la navigation ; 80 résultats au plus, les plus récents d'abord dans chaque espace.
  let budget = 80;
  const groups = s.config.modules.map(m => m.id).map(id => [id, hits.filter(h => h.id === id).sort((a, b) => (b.date || "").localeCompare(a.date || ""))]).filter(([, l]) => l.length).map(([id, l]) => {
    const shown = l.slice(0, Math.max(0, budget)); budget -= shown.length;
    return shown.length ? `<p class="grp search-grp ${tintOf(id)}">${sigil(id)}${esc(label(id))} <span>${l.length}</span></p><ul class="plain">${shown.map(h => `<li class="item"><span class="jdate">${h.date ? fmt(h.date) : ""}</span><div>${highlight(h.text.length > 240 ? h.text.slice(0, 240) + "…" : h.text, searchQuery)}${h.ep ? `<div class="meta"><span>${epGlyph(h.ep)}${esc(EP_STATUS[h.ep])}</span></div>` : ""}</div><a class="btn ghost sm" href="#${esc(h.id)}${h.eid ? "/" + esc(h.eid) : ""}">ouvrir</a></li>`).join("")}</ul>` : "";
  }).join("");
  const filtered = hits.length !== all.length;
  return `<h2>Chercher</h2><p class="hint">Dans tous tes modules : notes, fragments, tâches, légendes, journaux. Les accents ne comptent pas. « statut:hypothèse » ne garde que les hypothèses (de même pour observé, interprétation, inexpliqué). Touche « / » pour venir ici.</p>
  <input id="searchIn" type="search" value="${esc(searchQuery)}" placeholder="Un mot, un bout de phrase…" aria-label="Chercher" autocomplete="off" style="max-width:520px">
  ${searchQuery.trim() ? `<div class="row" style="margin-top:12px"><p class="hint" style="margin:0">${hits.length ? `${plural(hits.length, "résultat")}${filtered ? ` sur ${all.length}` : ""}` : all.length ? "Rien avec ces filtres." : "Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire."}</p>${hits.length ? `<span class="spacer"></span><button class="btn ghost sm" data-act="search-dossier" title="Les résultats affichés, avec dates, statuts, provenance et liens, pour une lecture assistée">Exporter en dossier</button>` : ""}</div>
  ${facets}${groups}` : ""}`;
};
const PALETTES = [["nigredo", "Nigredo, mousse", "#6f9a68"], ["albedo", "Albedo, lichen", "#aab7a6"], ["citrinitas", "Citrinitas, résine", "#c99a3c"], ["rubedo", "Rubedo, amanite", "#c0554a"]];
VIEWS.reglages = () => {
  const s = S(), c = s.config;
  return `<h2>Réglages</h2><p class="hint">Tout ici s'applique immédiatement.</p>
  <section><h3>Apparence</h3><p class="hint">Quatre étapes de l'Œuvre, prises dans le sous-bois.</p>
    <div class="swatches">${PALETTES.map(([id, n, col]) => `<button class="swatch ${c.palette === id ? "on" : ""}" data-act="pal" data-p="${id}"><i style="background:${col}"></i>${n}</button>`).join("")}</div>
    <div class="field-row" style="margin-top:14px"><label>Mode<select data-set="config.mode"><option value="auto" ${c.mode === "auto" ? "selected" : ""}>Suivre l'appareil</option><option value="dark" ${c.mode === "dark" ? "selected" : ""}>Toujours sombre</option><option value="light" ${c.mode === "light" ? "selected" : ""}>Toujours clair</option><option value="sun" ${c.mode === "sun" ? "selected" : ""}>Suivre le soleil</option></select></label>
    <label>Nom affiché<input data-set="config.name" value="${esc(c.name)}"></label></div>
    <div class="field-row" style="margin-top:12px"><label>Ouvrir sur (cet appareil)<select data-act="open-on"><option value="accueil" ${openOn() === "accueil" ? "selected" : ""}>L'accueil</option><option value="last" ${openOn() === "last" ? "selected" : ""}>Là où j'en étais</option></select></label><span></span></div></section>
  ${skySettingsHTML()}
  ${radarSettingsHTML()}
  <section><h3>Modules</h3><p class="hint">Active, renomme, réordonne, range par domaine (Maison, Création… : la navigation les regroupe). Les modules personnalisés (marqués ✕) peuvent être supprimés définitivement.</p>
    <datalist id="domainList">${[...new Set(c.modules.map(m => String(m.group || "").trim()).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join("")}</datalist>
    ${c.modules.map((m, i) => `<div class="set mod" data-i="${i}"><input type="checkbox" data-act="mod-on" ${m.on ? "checked" : ""} aria-label="Activer ${esc(label(m.id))}"><input data-act="mod-label" value="${esc(label(m.id))}" aria-label="Nom du module">${SYSTEM.includes(m.id) ? "<span></span>" : `<input class="grp-in" data-act="mod-group" value="${esc(m.group || "")}" list="domainList" maxlength="40" placeholder="Domaine" aria-label="Domaine de ${esc(label(m.id))}">`}<div class="row">${s.modules[m.id] ? `<button class="btn ghost sm" data-act="mod-del" data-mod="${esc(m.id)}" aria-label="Supprimer définitivement" title="Supprimer définitivement">✕</button>` : ""}<button class="btn ghost sm" data-act="mod-up" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="mod-down" aria-label="Descendre">↓</button></div></div>`).join("")}
    <details style="margin-top:14px"><summary class="hint" style="cursor:pointer;margin:0">+ Créer un module</summary>
      <div class="field-row" style="margin-top:10px"><label>Modèle ou type<select id="newModType"><optgroup label="Modèles">${MODULE_TEMPLATES.map(t => `<option value="tpl:${esc(t.id)}">${esc(t.name)} — ${esc(t.hint)}</option>`).join("")}</optgroup><optgroup label="Types vides">${Object.entries(MODULE_TYPES).map(([k, t]) => `<option value="${esc(k)}">${esc(t.label)}</option>`).join("")}</optgroup></select></label>
      <label>Nom<input id="newModName" placeholder="Nom du modèle si vide"></label></div>
      <button class="btn sm" data-act="mod-add" style="margin-top:8px">Créer</button></details>
  </section>
  <section id="modreg"><h3>Réglages par module</h3><p class="hint">Un bloc par module actif, dans l'ordre de la navigation : ses réglages propres, et le regroupement en pourcentage quand il existe.</p>
    ${c.modules.filter(m => enabled(m.id) && (s.modules[m.id] || grouperFor(m.id))).map(m => `<details id="mreg-${esc(m.id)}" data-mod="${esc(m.id)}" style="border-top:1px solid var(--rule);padding:12px 0">
        <summary style="cursor:pointer;font-size:1.05rem;font-weight:600">${esc(label(m.id))}</summary>
        <div style="margin-top:10px">${moduleSettingsHTML(m.id)}</div>
      </details>`).join("")}
  </section>
  ${enabled("assistant") ? `<section id="assistant-cfg"><h3>Assistant</h3><p class="hint">Claude dans le tableau de bord. Sur claude.ai, il passe par ton compte. Hébergé ailleurs (GitHub Pages), il faut ta propre clé API, gardée uniquement dans ce navigateur.</p>
    <div class="field-row"><label>Clé API Anthropic (hébergé uniquement)<input type="password" data-act="as-key" value="${getKey() ? "••••••••" : ""}" placeholder="sk-ant-…" autocomplete="off"></label>
    <label>Modèle<select data-act="as-model">${[["claude-haiku-4-5-20251001", "Haiku 4.5, rapide et peu cher"], ["claude-sonnet-5", "Sonnet 5, équilibré"], ["claude-opus-5-5", "Opus 5.5, le plus capable"]].map(([k, l]) => `<option value="${k}" ${s.config.assistant.model === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-act="as-actions" ${s.config.assistant.actions ? "checked" : ""}>Autoriser Claude à modifier le tableau de bord (tâches, capture, budget)</label>
    <p class="hint" style="margin:12px 0 4px">Ce que Claude peut lire :</p><div class="row">${Object.keys(s.config.assistant.share).filter(enabled).map(k => `<label style="display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" data-act="as-share" data-k="${esc(k)}" ${s.config.assistant.share[k] ? "checked" : ""}>${esc(label(k))}</label>`).join("")}</div>
    ${getKey() ? `<button class="btn ghost sm" data-act="as-forget" style="margin-top:10px">Oublier la clé sur cet appareil</button>` : ""}</section>` : ""}
  ${hosted() && authReady() && authSession ? `<section><h3>Compte</h3><p class="hint">Connecté en tant que ${esc(authSession.user.email)}. Tes données sont propres à ce compte et suivent sur tous tes appareils. Se déconnecter efface de cet appareil tes données, la conversation avec l'assistant et la clé API.</p>
    <button class="btn ghost" data-act="auth-out">Se déconnecter</button></section>` : ""}
  ${hosted() ? shareSettingsHTML() : ""}
  ${hosted() && authReady() && authSession ? passeurSettingsHTML() : ""}
  ${hosted() && authReady() && authSession ? agendaSettingsHTML() : ""}
  ${hosted() ? zotSettingsHTML() : ""}
  <section><h3>Sauvegarde</h3><p class="hint">Tout ton état dans un fichier JSON, pour passer de claude.ai à GitHub Pages ou d'un navigateur à l'autre. La clé API n'y figure jamais.</p>
    <div class="row"><button class="btn" data-act="exp">Exporter</button><label class="btn" style="display:inline-block;font-weight:500">Importer<input type="file" accept="application/json,.json" data-act="imp" style="display:none"></label></div></section>`;
};

/* ================= navigation =================
   Trois strates : lentilles (Aujourd'hui, Bilan, Chercher), espaces regroupés par domaine (config.modules[].group,
   facultatif), système (Assistant, Réglages). Une route peut viser une entrée : « #module/identifiant ». */
const routeOf = () => { const [view, entry] = location.hash.slice(1).split("/"); return { view: view || "accueil", entry: /^[\w-]{1,64}$/.test(entry || "") ? entry : "" }; };
const SYSTEM = ["assistant"];
/* Les espaces actifs, par domaine, dans l'ordre de la navigation ; un domaine apparaît là où apparaît son premier espace. */
function domains() {
  const s = S(), out = new Map();
  for (const m of s.config.modules) if (m.on && !SYSTEM.includes(m.id) && Object.hasOwn(s.modules, m.id)) {
    const g = String(m.group || "").trim(); if (!out.has(g)) out.set(g, []); out.get(g).push(m.id);
  }
  return [...out].map(([name, ids]) => ({ name, ids }));
}
const badgeOf = id => { const m = Object.hasOwn(S().modules, id) && S().modules[id]; return m && TYPE_UI[m.type].badge ? TYPE_UI[m.type].badge(m) : 0; };
/* À droite d'un espace : un point s'il attend une reprise (pont), le nombre d'éléments en attente. */
function navMarks(id) {
  const n = badgeOf(id), r = Object.hasOwn(S().modules, id) && S().modules[id].resume;
  return n || r ? `<span class="nx">${r ? `<i class="dot" title="Pont de reprise en attente"><span class="sr">reprise en attente</span></i>` : ""}${n ? `<span class="badge">${n}<span class="sr"> en attente</span></span>` : ""}</span>` : "";
}
function navHTML(view) {
  const link = (id, text, extra = "", cls = "") => `<a href="#${esc(id)}" class="${id === view ? "on" : ""} ${cls}"${id === view ? ' aria-current="page"' : ""}>${text}${extra}</a>`;
  return `<button type="button" class="pal-hint" data-act="palette-open">Aller à… <kbd>⌘K</kbd></button>
    ${link("accueil", "Aujourd'hui")}${link("bilan", "Bilan")}${link("recherche", "Chercher")}${dehorsOn() ? link("dehors", "Dehors") : ""}
    ${domains().map(d => `<p class="grp">${esc(d.name || "Espaces")}</p>${d.ids.map(id => link(id, `${sigil(id)}${esc(label(id))}`, navMarks(id), tintOf(id))).join("")}`).join("")}
    <div class="sys">${enabled("assistant") ? link("assistant", `${sigil("assistant")}${esc(label("assistant"))}`) : ""}${link("reglages", "Réglages")}</div>`;
}
/* Icônes de la barre basse : un trait fin, sans remplissage (une seule exception : la lunaison du bilan). */
const ICONS = {
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.2a8.2 8.2 0 1 0 4.3 12.6A6.6 6.6 0 0 1 15.5 4.2z"/></svg>`,
  cabinet: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16M7.5 8h1.5M15 8h1.5M7.5 16h1.5M15 16h1.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20"/></svg>`,
  lunation: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>`
};
/* ---- sigils : un glyphe gravé par espace (trait fin, grille de 24), choisi dans cette famille ----
   Botanique, instruments, bêtes discrètes : de quoi reconnaître un espace avant d'en lire le nom. */
const SIGILS = {
  phalene: ["Phalène", `<path d="M12 6.5v12.5M12 8.5C8.5 4.5 3.5 5 4 9s4.5 5 8 3M12 8.5c3.5-4 8.5-3.5 8 .5s-4.5 5-8 3M12 12.5c-3 1-5.5 3.2-4.4 5.5S11 17.6 12 15M12 12.5c3 1 5.5 3.2 4.4 5.5S13 17.6 12 15M11.4 6.6 9.4 3.4M12.6 6.6l2-3.2"/>`],
  salticide: ["Araignée sauteuse", `<circle cx="12" cy="9.6" r="3"/><circle cx="12" cy="16.2" r="3.4"/><path d="M9.4 8.6 5 5.6M9.2 10.6l-5.2-.2M9.3 14.4 4.6 16M10 18.3l-3.6 3M14.6 8.6 19 5.6M14.8 10.6l5.2-.2M14.7 14.4l4.7 1.6M14 18.3l3.6 3"/><circle cx="10.9" cy="8.9" r=".45"/><circle cx="13.1" cy="8.9" r=".45"/>`],
  plume: ["Plume", `<path d="M19.5 4C11.5 5 7 11 6 19.5M19.5 4c-1 6.5-5.5 10.5-12 12.5M10.2 12.2l3.2 1M12.4 9.2l3.2.8M6 19.5l-1.8 1.5"/>`],
  diapason: ["Diapason", `<path d="M9 3v8a3 3 0 0 0 6 0V3M12 14v7M10.2 21h3.6"/>`],
  equerre: ["Équerre", `<path d="M4 3.5v17h17zM7.5 11.5v5.5H13z"/>`],
  trebuchet: ["Trébuchet", `<path d="M12 4v16M8.5 20h7M5 7.5h14M5 7.5l-2.6 5h5.2zM19 7.5l-2.6 5h5.2zM11 4h2"/>`],
  vasculum: ["Boîte d'herborisation", `<rect x="3.5" y="9" width="17" height="9" rx="4.5"/><path d="M6.2 9.4c0-4.2 11.6-4.2 11.6 0M9 9.2v8.6"/>`],
  spirale: ["Souffle", `<path d="M12 12.4c0-1.2 1.6-1.6 2.1-.4.6 1.4-.8 2.8-2.3 2.8-1.9 0-3.1-1.6-3-3.3.1-2.4 2.3-4.2 4.8-4 3 .2 5 2.8 4.8 5.7-.3 3.6-3.4 6.1-7 5.8-4.2-.4-7.2-4-6.8-8.2"/>`],
  loupe: ["Loupe", `<circle cx="10" cy="10" r="5.5"/><path d="M14.1 14.1 20 20"/>`],
  sceau: ["Sceau", `<circle cx="12" cy="10.5" r="5"/><circle cx="12" cy="10.5" r="2.2"/><path d="M9.2 14.6 7.6 21l4.4-2 4.4 2-1.6-6.4"/>`],
  lanterne: ["Lanterne", `<path d="M9 5.5h6M10 5.5V3.6h4v1.9M8 7.5h8l-1.2 10.5H9.2zM7.4 18h9.2M12 10.5v4"/>`],
  fougere: ["Fougère", `<path d="M12 21C12 13.5 10.4 7.5 6.5 3.5M11.8 16.8 7.6 15.6M11.4 13.6 7.2 11.4M10.3 10.4 7.4 7.4M11.8 16.2l3.1-2.8M11.4 12.9l3-3.3M10.3 9.6l2-3"/>`],
  sablier: ["Sablier", `<path d="M6.5 3h11M6.5 21h11M8 3c0 5.2 8 6 8 9s-8 3.8-8 9M16 3c0 5.2-8 6-8 9s8 3.8 8 9"/>`],
  compas: ["Compas", `<circle cx="12" cy="4.6" r="1.6"/><path d="M11.2 6.1 6 20.5M12.8 6.1l5.2 14.4M8 15h8"/>`],
  clef: ["Clef", `<circle cx="7.5" cy="12" r="3.6"/><path d="M11.1 12H21M17.2 12v3.2M20 12v2.6"/>`],
  feuille: ["Feuille", `<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l8-8"/>`],
  champignon: ["Champignon", `<path d="M4 12.2a8 7 0 0 1 16 0zM9.5 12.2v6.3a2.5 2 0 0 0 5 0v-6.3"/>`],
  croissant: ["Croissant", `<path d="M15.2 4.2a8.2 8.2 0 1 0 4.6 12.7 6.6 6.6 0 0 1-4.6-12.7z"/>`]
};
/* Le sigil d'un espace : celui choisi, sinon un défaut selon son nom (les espaces d'origine), puis selon son type. */
function sigilOf(id) {
  const s = S(), m = s.config.modules.find(x => x.id === id), inst = Object.hasOwn(s.modules, id) ? s.modules[id] : null;
  if (m && Object.hasOwn(SIGILS, m.sigil || "")) return m.sigil;
  if (id === "assistant") return "lanterne";
  const name = fold(`${id} ${label(id) || ""}`);
  for (const [re, k] of [[/moth|phalene|papillon/, "phalene"], [/phidippus|araignee|spider/, "salticide"], [/musique|album|disque/, "diapason"], [/champignon|mycel/, "champignon"]]) if (re.test(name)) return k;
  if (!inst) return "feuille";
  if (inst.type === "collection") return inst.config.concordance ? "loupe" : inst.config.review ? "sceau" : "fougere";
  if (inst.type === "notes") return inst.config.inbox ? "vasculum" : "feuille";
  return { taches: "equerre", programme: "spirale", cumul: "plume", rappels: "sablier", budget: "trebuchet", arc: "compas" }[inst.type] || "feuille";
}
const sigilSVG = k => `<svg class="sig" viewBox="0 0 24 24" aria-hidden="true">${SIGILS[k][1]}</svg>`;
const sigil = id => sigilSVG(sigilOf(id));
/* Teinte d'un domaine : l'ordre d'apparition des domaines nommés donne t1…t7 ; un espace sans domaine prend l'accent (t0). */
function tintOf(id) {
  const m = S().config.modules.find(x => x.id === id), g = m && String(m.group || "").trim();
  if (!g) return "t0";
  const named = domains().map(d => d.name).filter(Boolean);
  return `t${(named.indexOf(g) % 7) + 1}`;
}
const ROMAN = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const roman = n => { let out = ""; for (const [v, r] of [[50, "L"], [40, "XL"], ...ROMAN]) while (n >= v) { out += r; n -= v; } return out; };
/* La planche d'un espace : son sigil et son numéro (l'ordre de la navigation), en tête de sa page. */
function plateHTML(id, extra = "") {
  const n = S().config.modules.filter(m => m.on && Object.hasOwn(S().modules, m.id)).findIndex(m => m.id === id) + 1;
  return `<div class="plate ${tintOf(id)}">${sigil(id)}<span class="pl">Pl. ${roman(n)}</span><span class="spacer"></span>${extra}<button class="btn ghost sm" data-act="goto-groups" data-mod="${esc(id)}">régler</button></div>`;
}
function sigilPicker(mod) {
  const cur = sigilOf(mod);
  return `<div class="sigils" role="radiogroup" aria-label="Sigil de l'espace">${Object.entries(SIGILS).map(([k, [name]]) => `<button type="button" role="radio" aria-checked="${k === cur}" class="${k === cur ? "on" : ""}" data-act="sigil-set" data-mod="${esc(mod)}" data-s="${k}" title="${esc(name)}" aria-label="${esc(name)}">${sigilSVG(k)}</button>`).join("")}</div>`;
}
function barHTML(view) {
  const inbox = inboxId(S().modules), pending = inbox ? S().modules[inbox].entries.length : 0;
  const inSpace = Object.hasOwn(S().modules, view) || view === "reglages" || view === "assistant";
  const link = (id, text, icon) => `<a href="#${id}" class="${view === id ? "on" : ""}"${view === id ? ' aria-current="page"' : ""}>${ICONS[icon]}<span>${text}</span></a>`;
  return `${link("accueil", "Aujourd'hui", "moon")}
    <button type="button" data-act="sheet-espaces" class="${inSpace ? "on" : ""}" aria-haspopup="dialog">${ICONS.cabinet}<span>Espaces</span>${pending ? `<i class="pip">${pending}<span class="sr"> à trier</span></i>` : ""}</button>
    <button type="button" data-act="sheet-capture" class="cap" aria-haspopup="dialog">${ICONS.plus}<span>Capturer</span></button>
    ${link("recherche", "Chercher", "search")}${link("bilan", "Bilan", "lunation")}`;
}
/* Les derniers espaces ouverts sur cet appareil (jamais synchronisés), le plus récent d'abord. */
const RECENT_KEY = "selene-recent";
function recents() { try { const r = JSON.parse(localStorage.getItem(RECENT_KEY)); return Array.isArray(r) ? r.filter(x => x && typeof x.id === "string") : []; } catch { return []; } }
function noteVisit(id) { try { localStorage.setItem(RECENT_KEY, JSON.stringify([{ id, at: new Date().toISOString() }, ...recents().filter(x => x.id !== id)].slice(0, 5))); } catch {} }
const liveRecents = () => recents().filter(r => Object.hasOwn(S().modules, r.id) && enabled(r.id));
const agoTime = t => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return !(m >= 0) ? "" : m < 2 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : ago(iso(new Date(t))); };

/* ---- feuilles (sheets) : Espaces et Capturer, depuis la barre basse ---- */
const SHEETS = {
  espaces() {
    const rec = liveRecents().filter(r => r.id !== lastView).slice(0, 3);
    const row = id => `<a class="srow ${tintOf(id)}" href="#${esc(id)}">${sigil(id)}<b>${esc(label(id))}</b><span class="sub">${summaryFor(id)}</span>${navMarks(id)}</a>`;
    return `<h2 id="sheetTitle">Espaces</h2>
      ${rec.length ? `<p class="grp">Récents</p><div class="recents">${rec.map(r => `<a class="btn" href="#${esc(r.id)}">${esc(label(r.id))}</a>`).join("")}</div>` : ""}
      ${domains().map(d => `<p class="grp">${esc(d.name || "Espaces")}</p>${d.ids.map(row).join("")}`).join("")}
      <p class="grp">Système</p>${enabled("assistant") ? `<a class="srow" href="#assistant"><b>${esc(label("assistant"))}</b></a>` : ""}<a class="srow" href="#reglages"><b>Réglages</b></a>`;
  },
  module(mod) {
    if (!Object.hasOwn(S().modules, mod)) return `<p class="empty">Ce module n'existe plus.</p>`;
    return `<div data-mod="${esc(mod)}" class="${tintOf(mod)}"><h2 id="sheetTitle" class="sheet-title">${sigil(mod)}${esc(label(mod))}</h2>
      <p class="hint">Réglages de cet espace, appliqués tout de suite. Nom, domaine et ordre : <a href="#reglages">Réglages</a>.</p>${moduleSettingsHTML(mod)}</div>`;
  },
  capture() {
    const s = S(), inbox = inboxId(s.modules), n = inbox ? s.modules[inbox].entries.length : 0;
    return `<h2 id="sheetTitle">Capturer</h2>${inbox ? `<div class="capture"><input id="capSheetIn" data-draft placeholder="${esc(s.modules[inbox].config.placeholder)}" aria-label="Capture rapide" enterkeyhint="done"><button class="btn acc" data-act="cap-sheet-add">Garder</button></div>
      <p class="hint" style="margin:10px 0 0">« 12 € courses », « 25 min kundalini », « Module : une note » se rangent d'un geste.${n ? ` <a href="#${esc(inbox)}">${plural(n, "élément")} à trier</a>` : ""}</p>${n > 1 ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="vasculum">Trier une à une</button></div>` : ""}`
      : `<p class="hint">Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans <a href="#reglages">Réglages</a>.</p>`}`;
  }
};
let sheetKind = null, sheetArg = null; // la feuille ouverte, pour la redessiner après un réglage
function openSheet(kind, arg) {
  const d = $("#sheet"); closePalette();
  sheetKind = kind; sheetArg = arg;
  $("#sheetBody").innerHTML = SHEETS[kind](arg);
  d.classList.toggle("drawer", kind === "module" || kind === "specimen" || kind === "mb" || kind === "mb-new" || kind === "radar"); // réglages d'un module, fiche : un tiroir à droite sur ordinateur
  d.classList.toggle("wide", kind === "carte"); // la carte céleste veut de la largeur
  if (!d.open) d.showModal();
  const i = $("#capSheetIn"); if (kind === "capture" && i) { i.value = loadDraft("sheet", i); i.focus(); }
}
function closeSheet() { const d = $("#sheet"); if (d.open) d.close(); }
function closePalette() { const d = $("#palette"); if (d.open) d.close(); }
function closeOverlays() { closeSheet(); closePalette(); }
/* Un clic sur le voile (hors du cadre) ferme ; un lien suivi depuis une feuille ou la palette la ferme aussi. */
for (const d of ["#sheet", "#palette"]) $(d).addEventListener("click", e => {
  const r = e.currentTarget.getBoundingClientRect();
  if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) e.currentTarget.close();
  else if (e.target.closest && e.target.closest('a[href^="#"]')) e.currentTarget.close();
});

/* ---- palette de commandes (⌘K) : aller à un espace ou une vue, agir, garder une phrase, chercher ---- */
let palIdx = 0, palItems = [];
const goTo = hash => () => { closeOverlays(); if (location.hash === "#" + hash) render(); else location.hash = hash; };
function paletteItems(q) {
  const s = S(), f = fold(q.trim()), out = [], match = t => !f || fold(t).includes(f);
  const spaces = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id)).map(m => [m.id, label(m.id)]);
  if (!f) for (const r of liveRecents().slice(0, 3)) out.push({ k: "Récent", t: label(r.id), run: goTo(r.id) });
  for (const [id, t] of spaces) if (match(t) && !out.some(o => o.t === t)) out.push({ k: "Espace", t, run: goTo(id) });
  for (const [id, t] of [["accueil", "Aujourd'hui"], ["bilan", "Bilan"], ["recherche", "Chercher"], ...(dehorsOn() ? [["dehors", "Dehors"]] : []), ["reglages", "Réglages"], ...(enabled("assistant") ? [["assistant", label("assistant")]] : [])])
    if (match(t)) out.push({ k: "Vue", t, run: goTo(id) });
  const other = bilanMode() === "mois" ? "lune" : "mois";
  for (const [t, run] of [[tick ? "Mettre le minuteur en pause" : "Lancer le minuteur (15 min)", () => { closeOverlays(); $("#timerBtn").click(); }],
    ["Capturer…", () => openSheet("capture")],
    ["Trier la boîte, une note à la fois", () => { vascSkip = 0; openSheet("vasculum"); }],
    [`Bilan par ${other === "lune" ? "cycle lunaire" : "mois"}`, () => { try { localStorage.setItem("selene-bilan", other); } catch {} bilanOffset = 0; goTo("bilan")(); }]])
    if (match(t)) out.push({ k: "Action", t, run });
  if (f) {
    const inbox = inboxId(s.modules), text = q.trim();
    if (inbox) out.push({ k: "Garder", t: `« ${text} » dans ${label(inbox)}`, run: () => { const item = addNote(S().modules[inbox], text); site.save(); closeOverlays(); render(); afterCapture(inbox, item, "Gardé. Tu peux oublier, c'est écrit."); } });
    for (const h of searchAll(text).slice(0, 6)) out.push({ k: label(h.id), t: h.text.replace(/\s+/g, " ").slice(0, 110), sub: h.date ? fmt(h.date) : "", run: goTo(h.id + (h.eid ? "/" + h.eid : "")) });
    out.push({ k: "Chercher", t: `« ${text} » partout`, run: () => { searchQuery = text; goTo("recherche")(); } });
  }
  return out;
}
function renderPalette() {
  palItems = paletteItems($("#palIn").value); palIdx = Math.max(0, Math.min(palIdx, palItems.length - 1));
  $("#palList").innerHTML = palItems.map((it, i) => `<li id="pal-${i}" role="option" aria-selected="${i === palIdx}" data-i="${i}"><span class="k">${esc(it.k)}</span><span class="t">${esc(it.t)}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ""}</li>`).join("")
    || `<li class="empty" aria-disabled="true">Rien. Ni espace, ni action, ni trace écrite.</li>`;
  if (palItems.length) $("#palIn").setAttribute("aria-activedescendant", `pal-${palIdx}`); else $("#palIn").removeAttribute("aria-activedescendant");
  const a = document.getElementById(`pal-${palIdx}`); if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
}
function openPalette() {
  const d = $("#palette"); if (d.open) return d.close();
  closeSheet(); $("#palIn").value = ""; palIdx = 0; renderPalette(); d.showModal(); $("#palIn").focus();
}
$("#palIn").addEventListener("input", () => { palIdx = 0; renderPalette(); });
$("#palIn").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); palIdx = (palIdx + (e.key === "ArrowDown" ? 1 : -1) + palItems.length) % Math.max(1, palItems.length); renderPalette(); }
  else if (e.key === "Enter" && palItems[palIdx]) { e.preventDefault(); palItems[palIdx].run(); }
});
$("#palList").addEventListener("click", e => { const li = e.target.closest && e.target.closest("li[data-i]"); if (li && palItems[+li.dataset.i]) palItems[+li.dataset.i].run(); });

/* ---- entrée visée par une route « #module/identifiant » : trouvée, montrée, surlignée ---- */
let backTo = null; // { from, to, label } : la puce « ‹ … » qui ramène d'où l'on vient
const backLabel = v => v === "dehors" ? "Dehors" : v === "recherche" ? (searchQuery.trim() ? `Recherche « ${searchQuery.trim()} »` : "Recherche") : v === "accueil" ? "Aujourd'hui" : v === "bilan" ? "Bilan" : v === "reglages" ? "Réglages" : label(v) || v;
function entryEl(id) { let hit = null; $("#main").querySelectorAll("[data-id], [data-task]").forEach(el => { if (!hit && (el.dataset.id === id || el.dataset.task === id)) hit = el; }); return hit; }
function focusEntry(id) {
  const view = routeOf().view;
  // Plus loin dans une liste paginée : on déplie ; masquée par un filtre de l'appareil : on le lève, puis on déplie encore.
  const unfold = () => { let el = entryEl(id); for (let i = 0; !el && i < 50; i++) { const more = [...$("#main").querySelectorAll('[data-act="page-more"]')]; if (!more.length) break; for (const b of more) pageSize[b.dataset.k] = (pageSize[b.dataset.k] || PAGE) + 10 * PAGE; render(); el = entryEl(id); } return el; };
  let el = unfold();
  if (!el && Object.hasOwn(S().modules, view)) {
    const inst = S().modules[view], e = inst.type === "budget" && inst.entries.find(x => x.id === id);
    if (e) budMonths[view] = e.date.slice(0, 7); // une opération d'un autre mois : afficher son mois
    fragFilter[view] = "*"; colFilter[view] = ""; gFilter[view] = ""; if (taskFilters[view]) taskFilters[view] = { room: "", cat: "" };
    render(); el = unfold();
  }
  if (!el) return false;
  el.scrollIntoView({ block: "center" }); el.classList.add("flash");
  return true;
}

/* ---- reprise : ce qui attend, sur l'accueil (dernier espace ouvert, son pont, les brouillons en cours) ---- */
const DRAFT_WHAT = { scrapIn: "un fragment", noteIn: "une note", rapNote: "une observation", chatIn: "un message", capSheetIn: "une capture" };
function pendingDrafts() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
    const [view, field] = k.slice(DRAFT_PREFIX.length).split(":"); if (view !== "accueil") out.push({ view, what: DRAFT_WHAT[field] || "un texte" }); } } catch {}
  return out;
}
function resumeSection() {
  const s = S(), drafts = pendingDrafts(), last = liveRecents()[0], lines = [];
  if (last) {
    const r = s.modules[last.id].resume, mine = drafts.filter(d => d.view === last.id).map(d => d.what);
    if (r || mine.length) lines.push(`<li><a href="#${esc(last.id)}"><b>${esc(label(last.id))}</b></a>${r ? ` — ↳ ${esc(r.text)}` : ""}${mine.length ? ` · ${esc(mine.join(", "))} en cours` : ""} <span class="hint">· ${agoTime(last.at)}</span></li>`);
  }
  for (const d of drafts) {
    if (last && d.view === last.id) continue;
    if (d.view === "sheet") lines.push(`<li>${d.what} en cours <button class="btn ghost sm" data-act="sheet-capture">reprendre</button></li>`);
    else if (Object.hasOwn(s.modules, d.view) ? enabled(d.view) : d.view === "assistant" && enabled("assistant")) lines.push(`<li><a href="#${esc(d.view)}"><b>${esc(label(d.view))}</b></a> · ${d.what} en cours</li>`);
  }
  return lines.length ? `<section class="resume-box" aria-label="Reprendre"><h3>Reprendre</h3><ul>${lines.join("")}</ul></section>` : "";
}
/* Ouvrir sur l'accueil ou là où l'on en était : propre à l'appareil. */
const openOn = () => { try { return localStorage.getItem("selene-open") === "last" ? "last" : "accueil"; } catch { return "accueil"; } };

/* Les réglages propres d'un module (son sigil, ceux de son type, son regroupement en pourcentage) : dans la page
   Réglages, et dans la feuille qu'ouvre « régler » depuis le module lui-même. */
function moduleSettingsHTML(mod) {
  const s = S(), inst = s.modules[mod], G = grouperFor(mod), g = G ? gcfg(mod) : null, by = G ? groupBy(mod) : null;
  const names = G && G.renamable.includes(by) ? [...new Set(G.items().map(it => it[by]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")) : [];
  return `${sigilPicker(mod)}
        ${inst ? TYPE_UI[inst.type].settings(mod, inst) : ""}
        ${G ? `<div class="row" style="margin-top:0"><label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="grp-on" ${g.on ? "checked" : ""}>Regrouper en pourcentage</label></div>
          ${g.on ? `<div class="field-row" style="margin-top:8px">
            <label>Regrouper par<select data-act="grp-by">${Object.entries(G.fields).map(([k, l]) => `<option value="${esc(k)}" ${by === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
            <label>Trier par<select data-act="grp-sort"><option value="name" ${g.sort === "name" ? "selected" : ""}>Ordre naturel</option><option value="pct" ${g.sort === "pct" ? "selected" : ""}>Le plus avancé d'abord</option><option value="left" ${g.sort === "left" ? "selected" : ""}>Le plus en retard d'abord</option></select></label></div>
            <div class="field-row" style="margin-top:8px"><label>Titre du bloc<input data-act="grp-title" value="${esc(g.title)}" placeholder="Par ${esc(G.fields[by].toLowerCase())}"></label>
            <label style="display:flex;gap:8px;align-items:center;align-self:end;padding-bottom:10px"><input type="checkbox" data-act="grp-hide" ${g.hideDone ? "checked" : ""}>Masquer les groupes à 100 %</label></div>
            ${names.length ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer;margin:0">Renommer ou fusionner des ${esc(G.fields[by].toLowerCase())}s</summary><p class="hint" style="margin:6px 0">Donne le même nom à deux groupes pour les fusionner.</p>${names.map(n => `<div class="set" style="grid-template-columns:1fr"><input data-act="grp-rename" data-old="${esc(n)}" value="${esc(n)}" aria-label="Renommer ${esc(n)}"></div>`).join("")}</details>` : ""}
           ` : ""}` : ""}`;
}

/* ================= render ================= */
function applyTheme() {
  const c = S().config, r = document.documentElement;
  r.dataset.palette = c.palette;
  // « Suivre le soleil » : sombre du crépuscule (le soleil à 3° sous l'horizon) à l'aube, au lieu réglé ou estimé.
  // Deux bascules par jour, comme le mode automatique d'iOS : jamais un fondu continu de l'interface.
  if (c.mode === "sun") { const pl = skyConf() || approxPlace(); r.dataset.mode = sunPosition(Date.now(), +pl.lat, +pl.lon).alt < -3 ? "dark" : "light"; }
  else if (c.mode === "auto") delete r.dataset.mode; else r.dataset.mode = c.mode;
}
let lastView = null;
/* Brouillons : le texte en cours d'un champ libre survit à la fermeture de l'app (iOS tue volontiers une PWA
   en arrière-plan). Propres à l'appareil ; effacés quand le champ est envoyé, et à la déconnexion. */
const DRAFT_PREFIX = "selene-draft:";
const draftKey = (view, el) => `${DRAFT_PREFIX}${view}:${el.id}`;
function saveDraft(view, el) { if (!view || !el.id) return; try { if (el.value.trim()) localStorage.setItem(draftKey(view, el), el.value); else localStorage.removeItem(draftKey(view, el)); } catch {} }
function loadDraft(view, el) { try { return localStorage.getItem(draftKey(view, el)) || ""; } catch { return ""; } }
// Le brouillon d'une feuille (la capture de la barre basse) ne dépend pas de la vue ouverte derrière elle.
document.addEventListener("input", e => { if (e.target.dataset && e.target.dataset.draft !== undefined) saveDraft(e.target.closest && e.target.closest("dialog") ? "sheet" : lastView, e.target); });
/* Calculs coûteux partagés par plusieurs parties d'un même rendu (la concordance sert la vue, l'accueil et
   le bilan) : gardés le temps d'un rendu seulement, pendant lequel les données ne bougent pas. */
let renderMemo = null;
function memoInRender(key, compute) {
  if (!renderMemo) return compute();
  if (!renderMemo.has(key)) renderMemo.set(key, compute());
  return renderMemo.get(key);
}
function render() {
  renderMemo = new Map();
  try { renderNow(); } finally { renderMemo = null; }
  skyWatch();
  if (sharePending) applyShare();
}
/* ================= recevoir un lien depuis ailleurs =================
   `?url=&title=&text=` à l'ouverture : c'est ce qu'envoient le partage Android (Web Share Target, déclaré dans le
   manifeste), le favori « Envoyer à Selene » et un Raccourci iOS. Le lien attend que les données soient prêtes (la
   connexion au compte, s'il y en a une), puis devient une note de la boîte ; l'adresse de la page est nettoyée pour
   qu'un rechargement ne le dépose pas deux fois. */
let sharePending = false;
function takeShare() {
  try {
    if (sessionStorage.getItem("selene-share")) sharePending = true; // reçu avant une connexion ou un rechargement
    const q = new window.URLSearchParams(location.search), p = { url: q.get("url") || "", title: q.get("title") || "", text: q.get("text") || "" };
    if (!p.url && !p.text && !p.title) return;
    sessionStorage.setItem("selene-share", JSON.stringify(p)); sharePending = true;
    window.history.replaceState(null, "", location.pathname + (location.hash || "#accueil"));
  } catch {}
}
function applyShare() {
  if (hosted() && authReady() && !authSession) return; // pas encore connectée : on attend
  let p = null; try { p = JSON.parse(sessionStorage.getItem("selene-share") || "null"); sessionStorage.removeItem("selene-share"); } catch {}
  sharePending = false;
  if (!p) return;
  const box = inboxId(S().modules);
  if (!box) return toast("Lien reçu, mais aucune boîte de réception où le garder. Crée un Carnet et fais-en ta boîte (Réglages).");
  const url = String(p.url || "").trim(), text = String(p.text || "").trim(), title = String(p.title || "").trim();
  const parts = [title, text && text !== title ? text : "", url && !text.includes(url) ? url : ""].filter(Boolean);
  addNote(S().modules[box], parts.join(" — ").slice(0, 2000)); site.save(); render();
  toast(`Reçu dans ${label(box)}${findUrl(parts.join(" ")) || findDoi(parts.join(" ")) ? " : « Garder comme source » le complétera" : ""}.`);
}
takeShare();
/* Réglages → Envoyer à Selene : un favori à glisser dans la barre (ordinateur), et la recette d'un Raccourci (iPhone). */
function shareSettingsHTML() {
  const base = location.origin + location.pathname;
  const bm = `javascript:(()=>{window.open('${base}?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank')})()`;
  return `<section><h3>Envoyer à Selene</h3><p class="hint">Un lien lu ailleurs arrive dans ta boîte de réception, prêt à devenir une source. Rien ne part ailleurs que chez toi.</p>
    <p class="row" style="margin:0 0 8px"><a class="btn sm" href="${esc(bm)}" data-act="bookmarklet">Envoyer à Selene</a><span class="hint" style="margin:0">Sur ordinateur : glisse ce bouton dans ta barre de favoris.</span></p>
    <p class="hint">Sur Android, une fois l'app installée : « Partager », puis Selene. Sur iPhone : app Raccourcis, un raccourci qui s'affiche dans la feuille de partage (URL), avec l'action « Ouvrir les URL » : <code>${esc(base)}?url=</code> suivi de l'entrée du raccourci.</p></section>`;
}
function renderNow() {
  applyTheme();
  if (hosted() && authReady() && !authSession) { $("#nav").innerHTML = ""; $("#bar").innerHTML = ""; $("#main").innerHTML = authView(); return; }
  const s = S(), m = moon();
  let view = routeOf().view;
  // Les vues fixes priment toujours ; hasOwn évite qu'un « #constructor » trouve Object.prototype.
  const fixed = v => v === "accueil" || v === "reglages" || v === "recherche" || v === "bilan" || (v === "dehors" && dehorsOn());
  if (!fixed(view) && (!(Object.hasOwn(s.modules, view) || Object.hasOwn(VIEWS, view)) || !enabled(view))) view = "accueil";
  const inst = !fixed(view) && Object.hasOwn(s.modules, view) ? s.modules[view] : null;
  $("#brandName").textContent = s.config.name || "Selene";
  document.title = s.config.name || "Selene";
  $("#miniMoon").innerHTML = moonSVG(m.p, 40);
  $("#dateline").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + ", " + m.name.toLowerCase();
  $("#nav").innerHTML = navHTML(view);
  $("#bar").innerHTML = barHTML(view);
  if (inst && view !== lastView) noteVisit(view);
  // Les champs des Réglages n'ont pas d'id (donc pas de restauration ci-dessous) : tant que l'un d'eux
  // a le focus, ne pas redessiner, sinon une synchro arrivant pendant la frappe effacerait la saisie.
  const ae = document.activeElement, typing = ae && ae.closest && ae.closest("#main") &&
    (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !["checkbox", "radio", "file", "button"].includes(ae.type)));
  if (typing && view === "reglages" && lastView === "reglages") return;
  const keep = {}; let focusId = null, caret = null;
  $("#main").querySelectorAll("[data-draft]").forEach(el => saveDraft(lastView, el)); // un champ vidé par l'envoi efface son brouillon
  if (view === lastView) $("#main").querySelectorAll("input[id],textarea[id],select[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
  if (document.activeElement && document.activeElement.id && keep[document.activeElement.id] != null) { focusId = document.activeElement.id; try { caret = document.activeElement.selectionStart; } catch {} }
  const back = backTo && backTo.to === view ? `<a class="back" href="#${esc(backTo.from)}">‹ ${esc(backTo.label)}</a>` : "";
  // Un espace : sa planche (sigil, numéro, « Je m'arrête ici… » tant qu'aucun pont n'est posé, « régler »), son pont, sa vue ;
  // le tout dans la teinte de son domaine.
  const bridging = inst && (inst.resume || bridgeOpen === view);
  $("#main").innerHTML = back + (inst ? `<div class="view ${tintOf(view)}">${plateHTML(view, bridging ? "" : `<button class="btn ghost sm" data-act="bridge-edit" data-mod="${esc(view)}">Je m'arrête ici…</button>`)}${bridging ? bridgeBar(view, inst) : ""}${TYPE_UI[inst.type].view(view)}</div>` : VIEWS[view]());
  // La feuille « régler » ouverte se redessine aussi, sauf pendant une frappe dans l'un de ses champs.
  const fa = document.activeElement, typingSheet = fa && fa.closest && fa.closest("#sheet") && (fa.tagName === "TEXTAREA" || (fa.tagName === "INPUT" && !["checkbox", "radio"].includes(fa.type)));
  if (["module", "specimen", "vasculum"].includes(sheetKind) && $("#sheet").open && !typingSheet) $("#sheetBody").innerHTML = SHEETS[sheetKind](sheetArg);
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && v !== "" && el.value !== v) el.value = v; }
  if (view !== lastView) $("#main").querySelectorAll("[data-draft]").forEach(el => { const v = loadDraft(view, el); if (v) el.value = v; });
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch {} } }
  if (view !== lastView) revealed = null;
  if (revealed) $("#main").querySelectorAll(".item[data-id], .card[data-id]").forEach(el => { if (el.dataset.id === revealed) el.classList.add("reveal"); });
  lastView = view;
}
/* Position de défilement de chaque vue, pour la session : revenir quelque part, c'est retrouver où l'on en était. */
const scrollMemo = (() => { try { return JSON.parse(sessionStorage.getItem("selene-scrolls")) || {}; } catch { return {}; } })();
function rememberScroll() {
  if (!lastView) return;
  scrollMemo[lastView] = Math.round(window.scrollY || 0);
  try { sessionStorage.setItem("selene-scrolls", JSON.stringify(scrollMemo)); } catch {}
}
window.addEventListener("hashchange", () => {
  const { view, entry } = routeOf();
  if (lastView !== view) rememberScroll(); // « / » a déjà dessiné la recherche, et gardé la position d'avant
  // Arriver sur une entrée depuis une autre vue : une puce ramène d'où l'on vient (liste et position comprises).
  if (entry && lastView && lastView !== view) backTo = { from: lastView, to: view, label: backLabel(lastView) };
  else if (!backTo || view !== backTo.to) backTo = null;
  closeOverlays();
  openId = null; bridgeOpen = null; for (const k of Object.keys(pageSize)) delete pageSize[k];
  if (entry && Object.hasOwn(S().modules, view) && S().modules[view].type === "taches") openId = entry; // une tâche visée s'ouvre
  render();
  const t = sessionStorage.getItem("selene-scroll"); sessionStorage.removeItem("selene-scroll"); const el = t && document.getElementById(t);
  if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView(); }
  else if (!(entry && focusEntry(entry))) window.scrollTo(0, scrollMemo[lastView] || 0);
});
/* Sur un écran tactile, les actions d'une ligne (.ra) apparaissent quand on touche la ligne ailleurs que sur un contrôle.
   Une seule ligne à la fois ; retenue par son identifiant pour survivre aux rendus. */
let revealed = null;
const touchUI = () => { try { return window.matchMedia("(hover: none), (pointer: coarse)").matches; } catch { return false; } };
document.addEventListener("click", e => {
  const row = e.target.closest && e.target.closest(".item[data-id], .card[data-id]");
  if (!row || !row.querySelector(".ra") || e.target.closest("a,button,input,select,textarea,label,summary") || !touchUI()) return;
  revealed = revealed === row.dataset.id ? null : row.dataset.id;
  $("#main").querySelectorAll(".reveal").forEach(el => el.classList.remove("reveal"));
  if (revealed) row.classList.add("reveal");
});

/* ================= actions ================= */
const idOf = el => el.closest("[data-id]")?.dataset.id;
/* Capture rapide, depuis l'accueil ou depuis la feuille « Capturer » (barre basse du téléphone). */
function capture(inp = $("#capIn")) {
  if (!inp || !inp.value.trim()) return;
  const id = inboxId(S().modules); if (!id) return toast("Aucune boîte de réception : voir Réglages.");
  const item = addNote(S().modules[id], inp.value); site.save(); inp.value = "";
  if (inp.id === "capSheetIn") { saveDraft("sheet", inp); closeSheet(); } // fermée avant le message, qui passerait dessous
  render();
  afterCapture(id, item, "Gardé. Tu peux oublier, c'est écrit.");
}
function entryAdd(id) {
  const inst = S().modules[id], ui = TYPE_UI[inst.type];
  if (ui.add) ui.add(id, inst);
}
const CLICK = {
  "grp-filter": el => { const m = el.dataset.mod, g = el.dataset.g; gFilter[m] = gFilter[m] === g ? "" : g; render(); },
  // « régler » : les réglages du module s'ouvrent sur place (une feuille), sans quitter ce qu'on regardait ;
  // depuis la page Réglages, le bloc du module se déplie.
  "goto-groups": (el, e) => {
    const mod = el.dataset.mod, id = "mreg-" + mod;
    if (location.hash === "#reglages") { const d = document.getElementById(id); if (d) { d.open = true; d.scrollIntoView(); } return; }
    if (e) e.preventDefault();
    openSheet("module", mod);
  },
  "sigil-set": el => { const m = S().config.modules.find(x => x.id === el.dataset.mod); if (!m) return; m.sigil = el.dataset.s; site.save(); render(); },
  "cap-add": () => capture(),
  "cap-sheet-add": () => capture($("#capSheetIn")),
  "sheet-espaces": () => openSheet("espaces"),
  "sheet-capture": () => openSheet("capture"),
  "palette-open": () => openPalette(),
  "sky-search": () => skySearch(),
  "sky-pick": el => { const r = skyResults[+el.dataset.i]; if (r) setSky(r.name, r.lat, r.lon); },
  "sky-locate": () => {
    if (!navigator.geolocation) return toast("Ce navigateur ne donne pas sa position. Une ville fera l'affaire.");
    navigator.geolocation.getCurrentPosition(p => setSky("Ma position", p.coords.latitude, p.coords.longitude),
      () => toast("Position refusée ou indisponible. Une ville fera l'affaire."), { maximumAge: 3600000, timeout: 15000 });
  },
  "sky-clear": () => { delete S().config.sky; try { localStorage.removeItem(WEATHER_KEY); } catch {} site.save(); render(); toast("Lieu retiré : l'heure redevient estimée, sans météo."); },
  "bridge-edit": el => { bridgeOpen = el.dataset.mod; render(); const i = $("#bridgeIn"); if (i) i.focus(); },
  "bridge-save": el => bridgeSave(el.dataset.mod),
  "bridge-close": () => { bridgeOpen = null; render(); },
  "bridge-done": el => {
    const id = el.dataset.mod, inst = S().modules[id], old = inst.resume; if (!old) return;
    setResume(inst, "", todayISO()); site.save(); render();
    toastUndo("Repris. Le pont est levé.", () => {
      const cur = S().modules[id]; if (!cur || cur.resume) return;
      cur.resume = old; cur.resumeLog = (cur.resumeLog || []).slice(0, -1); site.save(); render();
    });
  },
  "motif-add": el => {
    const inst = S().modules[el.dataset.mod], word = el.dataset.q; if (!inst || !word) return;
    if (inst.entries.some(e => fold(e.title) === fold(word))) return toast(`« ${word} » est déjà un motif.`);
    saveCollectionItem(inst, { title: word }, uid()); site.save(); render();
    toast(`« ${word} » devient un motif de ${label(el.dataset.mod)}. On verra s'il revient.`);
  },
  // Tous les résultats (pas seulement les 80 affichés), dans l'ordre du temps ; un fragment ou une note garde ses
  // statut, provenance et liens (retrouvés par module et texte : la recherche ne renvoie que des textes).
  "search-dossier": () => {
    const q = searchQuery.trim(), thoughts = thoughtItems();
    const items = facetFilter(searchAll(q)).map(h => ({ mod: h.id, text: h.text, date: h.date, e: (thoughts.find(x => x.mod === h.id && x.e.text === h.text) || {}).e }))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (items.length) dossierFile(`Recherche — ${q}`, `Résultats de la recherche « ${q} »`, items);
  },
  "bookmarklet": (el, e) => { e.preventDefault(); toast("Glisse ce bouton dans la barre de favoris : c'est là qu'il sert, sur la page à garder."); },
  "page-more": el => { const k = el.dataset.k; pageSize[k] = (pageSize[k] || PAGE) + PAGE; render(); },
  "sortes-draw": () => { sortesLast = sortesDraw(); render(); if (!sortesLast) toast("Rien d'assez ancien à tirer. Reviens dans deux semaines."); },
  "facet": el => { const k = el.dataset.k; if (Object.hasOwn(searchFacets, k)) { searchFacets[k] = searchFacets[k] === el.dataset.v ? "" : el.dataset.v; render(); } },
  "search-for": el => { searchQuery = el.dataset.q; Object.assign(searchFacets, { mod: "", period: "", ep: "" }); if (location.hash === "#recherche") render(); else location.hash = "recherche"; },
  "entry-add": el => entryAdd(el.dataset.mod),
  "entry-del": el => removeWithUndo(el.dataset.mod, "entries", idOf(el)),
  "planche-open": () => { plancheOffset = bilanMode() === "lune" ? bilanOffset : 0; location.hash = "bilan/planche"; },
  "planche-nav": el => { plancheOffset = Math.max(0, plancheOffset + +el.dataset.d); render(); },
  "planche-print": () => { try { window.print(); } catch { plancheFile(); } },
  "planche-dl": () => plancheFile(),
  "bilan-mode": el => { try { localStorage.setItem("selene-bilan", el.dataset.m); } catch {} bilanOffset = 0; render(); },
  "bilan-nav": el => { bilanOffset = Math.max(0, bilanOffset + +el.dataset.d); render(); },
  "undo": () => { const f = undoFn; undoFn = null; $("#toast").classList.remove("show", "act"); if (f) f(); },
  "mod-add": () => {
    const choice = $("#newModType").value, tpl = MODULE_TEMPLATES.find(t => "tpl:" + t.id === choice);
    const name = $("#newModName").value.trim() || (tpl ? tpl.name : "");
    if (!name) return toast("Donne un nom au module.");
    addModule(tpl || { type: choice }, name);
  },
  "tpl-add": el => { const tpl = MODULE_TEMPLATES.find(t => t.id === el.dataset.tpl); if (tpl) addModule(tpl, tpl.name); },
  "welcome-done": () => { S().config.welcome = false; site.save(); render(); },
  "mod-del": el => {
    const id = el.dataset.mod, name = label(id);
    openForm(`Supprimer « ${name} »`, [{ n: "confirm", l: `Retape « ${name} » pour confirmer la suppression définitive de ses données.`, req: true }], {}, v => {
      if (v.confirm !== name) return toast("Nom incorrect, rien n'a été supprimé.");
      const s = S();
      deleteModuleInstance(s.modules, s.config.modules, id);
      delete s.config.labels[id]; delete s.config.groups[id]; delete s.config.assistant.share[id];
      site.save(); render(); toast(`« ${name} » supprimé.`);
    });
  },
  "chat-send": () => { const t = $("#chatIn").value; sendChat(t); },
  "chat-chip": el => sendChat(el.textContent),
  "chat-clear": async () => { if (await ask("Effacer la conversation ?")) { chatLog.set([]); render(); } },
  "as-forget": () => { try { localStorage.removeItem("selene-api-key"); } catch {} render(); toast("Clé oubliée sur cet appareil."); },
  "exp": () => downloadFile(`selene-${todayISO()}.json`, createBackup(board.data, site.data), "application/json", "Sauvegarde Selene"),
  "pal": el => { S().config.palette = el.dataset.p; site.save(); render(); },
  "mod-up": el => moveMod(el, -1), "mod-down": el => moveMod(el, 1),
  "auth-switch": () => { authMode = authMode === "signup" ? "signin" : "signup"; render(); },
  "auth-out": () => authSignOut()
};
/* Donne un fichier à l'utilisatrice : via claude.ai, le partage natif (téléphone) ou un téléchargement. */
async function downloadFile(filename, data, type, title) {
  if (downloadsNS) { try { await downloadsNS.save({ filename, data }); } catch (e) { toast("Export annulé."); } return; }
  try { const file = new File([data], filename, { type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
/* Ajoute un module (depuis un modèle ou un type vide), actif et partagé avec l'assistant. */
function addModule(tpl, name) {
  try {
    const s = S(), id = slugId(name, [...s.config.modules.map(x => x.id), ...Object.keys(s.modules), ...Object.keys(VIEWS)]);
    createFromTemplate(s.modules, tpl, name, id);
    s.config.modules.push({ id, on: true });
    s.config.assistant.share[id] = true;
    site.save(); render(); toast(`Module « ${name} » créé.`);
  } catch (e) { toast(e.message); }
}
function moveMod(el, d) { const ms = S().config.modules, i = +el.closest("[data-i]").dataset.i, j = i + d; if (j < 0 || j >= ms.length) return; [ms[i], ms[j]] = [ms[j], ms[i]]; site.save(); render(); }
document.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (a && CLICK[a.dataset.act] && a.tagName !== "SELECT" && !(a.tagName === "INPUT" && a.type !== "button")) CLICK[a.dataset.act](a, e); });
document.addEventListener("input", e => { if (e.target.id === "searchIn") { searchQuery = e.target.value; render(); } });
// « / » ouvre la recherche (sur ordinateur), sauf pendant une saisie.
document.addEventListener("keydown", e => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "")) return;
  // Dessiner tout de suite : attendre l'événement hashchange ferait courir le curseur contre le rendu.
  e.preventDefault(); rememberScroll(); location.hash = "recherche"; render(); const el = document.getElementById("searchIn"); if (el) el.focus();
});
// ⌘K (Ctrl+K) ouvre ou ferme la palette, même pendant une saisie.
document.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); openPalette(); } });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "skyCity") skySearch(); });
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "srcIn") { e.preventDefault(); CLICK["src-fetch"](e.target); }
  if (e.key === "Enter" && e.target.id === "zotIn") { e.preventDefault(); CLICK["zot-search"](e.target); }
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "capIn") capture(); if (e.key === "Enter" && e.target.id === "capSheetIn") capture(e.target); if (e.key === "Enter" && e.target.id === "noteIn") CLICK["note-add"](e.target); if (e.key === "Enter" && e.target.id === "bridgeIn") bridgeSave(e.target.dataset.mod); if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatIn") { e.preventDefault(); sendChat(e.target.value); } });
const CHANGE = {}; // actions « change » des types de module (remplie par types.js)
document.addEventListener("change", e => {
  const el = e.target, act = el.dataset.act;
  if (act && Object.hasOwn(CHANGE, act)) CHANGE[act](el);
  else if (act && act.startsWith("grp-") && act !== "grp-filter") {
    const mod = el.closest("[data-mod]").dataset.mod, g = gcfg(mod), G = grouperFor(mod);
    if (act === "grp-on") g.on = el.checked;
    else if (act === "grp-by") { g.by = el.value; gFilter[mod] = ""; }
    else if (act === "grp-sort") g.sort = el.value;
    else if (act === "grp-hide") g.hideDone = el.checked;
    else if (act === "grp-title") g.title = el.value.trim();
    else if (act === "grp-rename") {
      const from = el.dataset.old, to = el.value.trim(); if (!to || to === from) return;
      const by = groupBy(mod); G.items().forEach(it => { if (it[by] === from) it[by] = to; });
      if (G.rename) G.rename(from, to); // ex. une enveloppe du budget porte le nom du groupe
      if (gFilter[mod] === from) gFilter[mod] = to;
      if (taskFilters[mod] && taskFilters[mod].room === from) taskFilters[mod].room = to;
      G.store().save(); toast(`« ${from} » s'appelle désormais « ${to} ».`);
    }
    site.save(); el.blur(); render();
  }
  else if (act === "as-key") { const v = el.value.trim(); if (v && !v.startsWith("•")) { try { localStorage.setItem("selene-api-key", v); } catch {} toast(hosted() ? "Clé enregistrée dans ce navigateur." : "Clé enregistrée. Elle servira une fois le site hébergé."); } el.blur(); render(); }
  else if (act === "as-model") { S().config.assistant.model = el.value; site.save(); render(); }
  else if (act === "as-actions") { S().config.assistant.actions = el.checked; site.save(); render(); }
  else if (act === "as-share") { S().config.assistant.share[el.dataset.k] = el.checked; site.save(); render(); }
  else if (act === "imp") {
    const f = el.files && el.files[0]; if (!f) return;
    f.text().then(async t => { const d = parseBackup(t); if (!await ask("Remplacer tout l'état actuel par celui du fichier ?")) return; site.replaceAll(d.site); board.replaceAll(d.board); /* le site d'abord : les tâches d'une ancienne sauvegarde y sont versées */ render(); toast("Sauvegarde importée."); }).catch(() => toast("Fichier illisible ou pas une sauvegarde Selene.")).finally(() => { el.value = ""; });
  }
  else if (act === "mod-group") {
    const m = S().config.modules[+el.closest("[data-i]").dataset.i], v = el.value.trim().slice(0, 40);
    if (v) m.group = v; else delete m.group;
    site.save(); el.blur(); render();
  }
  else if (act === "sky-weather" || act === "sky-moon") {
    const c = skyConf(); if (!c) return;
    c[act === "sky-weather" ? "weather" : "realMoon"] = el.checked; site.save(); render();
    if (act === "sky-weather" && el.checked) refreshWeather(true);
  }
  else if (act === "radar-words") {
    const v = el.value.replace(/\s+/g, " ").trim().slice(0, 300);
    if (v) S().config.radar = { words: v }; else delete S().config.radar;
    try { localStorage.removeItem(RADAR_KEY); } catch {} site.save(); el.blur(); render();
  }
  else if (act === "sky-live") { try { localStorage.setItem("selene-sky-live", el.checked ? "on" : "off"); } catch {} render(); }
  else if (act === "open-on") { try { localStorage.setItem("selene-open", el.value); } catch {} toast(el.value === "last" ? "L'app rouvrira le dernier espace où tu étais." : "L'app s'ouvrira sur l'accueil."); }
  else if (act === "mod-on") { S().config.modules[+el.closest("[data-i]").dataset.i].on = el.checked; site.save(); render(); }
  else if (act === "mod-label") {
    const s = S(), m = s.config.modules[+el.closest("[data-i]").dataset.i], v = el.value.trim();
    if (s.modules[m.id]) { s.modules[m.id].label = v || s.modules[m.id].label; }
    else if (v && v !== MODULE_DEFS[m.id]) s.config.labels[m.id] = v; else delete s.config.labels[m.id];
    site.save(); render();
  }
  else if (el.dataset.setMod) {
    // « id.champ » ou « id.groupe.champ » ; jamais un chemin vers le prototype des objets.
    const [id, ...path] = el.dataset.setMod.split("."), f = path.pop();
    if ([...path, f].some(k => k === "__proto__" || k === "constructor" || k === "prototype")) return;
    const cfg = path.reduce((o, k) => o[k], S().modules[id].config);
    // Un nombre reste dans les bornes du champ, qui sont celles de la validation des sauvegardes :
    // sinon l'app accepterait une valeur que sa propre sauvegarde refuserait ensuite à l'import.
    let v = el.value; if (el.type === "number") v = Math.min(el.max ? +el.max : Infinity, Math.max(1, +v || 1)); if (el.type === "date") v = v || null;
    if (el.required && !String(v).trim()) { el.blur(); return render(); } // champ obligatoire vidé : on garde l'ancienne valeur
    cfg[f] = v; site.save(); el.blur(); render();
  }
  else if (el.dataset.set) {
    const [k, f] = el.dataset.set.split("."), s = S();
    let v = el.value; if (el.type === "number") v = Math.max(1, +v || 1); if (el.type === "date") v = v || null;
    s[k][f] = v; site.save(); el.blur(); render();
  }
});

/* ================= timer ================= */
/* Au bout des quinze minutes, le module ouvert peut proposer une suite (noter la séance, le nouveau total). */
function timerDone() {
  const view = routeOf().view, inst = Object.hasOwn(S().modules, view) ? S().modules[view] : null, hook = inst && TYPE_UI[inst.type].timerDone;
  if (inst) { bridgeOpen = view; render(); } // et le prochain geste, pendant qu'on s'en souvient
  if (!(hook && hook(view, inst, 15))) toast("Quinze minutes. Tu as le droit d'arrêter. Et celui de continuer.");
}
let left = 900, tick = null, endAt = 0;
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
/* Le Halo : l'anneau de la mini-lune se referme à mesure que le temps passe (visible tant qu'un minuteur est entamé) ;
   à la fin, un seul battement. La lune, elle, reste la vraie phase. */
function haloUpdate(done = false) {
  const h = $("#halo"); if (!h || !h.style || !h.classList) return;
  h.style.setProperty("--p", done ? "1" : String(1 - left / 900));
  h.classList.toggle("on", !done && left > 0 && left < 900);
  h.classList.toggle("done", done);
}
function tickTimer() {
  left = Math.max(0, Math.round((endAt - Date.now()) / 1000)); $("#clock").textContent = mmss(left); haloUpdate();
  if (left <= 0) { clearInterval(tick); tick = null; $("#clock").classList.add("done"); $("#timerBtn").textContent = "Relancer"; haloUpdate(true); timerDone(); try { navigator.vibrate && navigator.vibrate(200); } catch {} }
}
$("#timerBtn").addEventListener("click", () => {
  const b = $("#timerBtn");
  if (tick) { clearInterval(tick); tick = null; b.textContent = "Reprendre"; return; }
  if (left === 0) left = 900; endAt = Date.now() + left * 1000; $("#clock").classList.remove("done"); b.textContent = "Pause";
  tick = setInterval(tickTimer, 500); haloUpdate();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && tick) tickTimer(); });
$("#timerReset").addEventListener("click", () => { clearInterval(tick); tick = null; left = 900; $("#clock").textContent = mmss(left); $("#clock").classList.remove("done"); $("#timerBtn").textContent = "Lancer 15 min"; haloUpdate(); });
/* Un appui long sur la mini-lune lance (ou met en pause) le minuteur ; un clic simple reste un retour à l'accueil.
   Le bouton du minuteur demeure : un geste caché ne doit jamais être le seul chemin. */
let haloPress = null, haloFired = false;
$(".brand").addEventListener("pointerdown", () => { haloFired = false; clearTimeout(haloPress); haloPress = setTimeout(() => { haloFired = true; $("#timerBtn").click(); toast(tick ? "Quinze minutes, dans le halo de la lune." : "Minuteur en pause."); }, 550); });
for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $(".brand").addEventListener(ev, () => clearTimeout(haloPress));
$(".brand").addEventListener("click", e => { if (haloFired) { e.preventDefault(); haloFired = false; } });
$(".brand").addEventListener("contextmenu", e => e.preventDefault());

