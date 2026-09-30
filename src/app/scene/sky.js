/* La Fenêtre : le lieu choisi, la météo (Open-Meteo), la scène du moment (soleil, lune, temps) et ses réglages. */
import { platform } from "../../platform.js";
import { WEATHER, approxPlace, moonPlacement, moonPosition, nextCrossing, seasonAt, skyEvents, skyMotion, skyScene, sunPosition, weatherState, windName } from "../../core/sky.js";
import { CLICK } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { fmt, todayISO } from "../lib/format.js";
import { render } from "../shell/render.js";
import { S, site } from "../state/site.js";

/* La Fenêtre : lieu, météo, scène du moment.
   Le lieu (config.sky, synchronisé) est arrondi au dixième de degré (~10 km) avant tout envoi. La météo vient
   d'Open-Meteo, gardée sur l'appareil (selene-weather) ; plus vieille que trois heures, elle est ignorée : un ciel sans
   météo vaut mieux qu'une pluie périmée. Sans lieu : l'heure estimée d'après le fuseau, la lune à sa place d'origine. */
export const skyConf = () => { const c = S().config.sky; return c && Number.isFinite(+c.lat) && Number.isFinite(+c.lon) ? c : null; };
/* Le mode de l'interface, tel qu'il s'affiche : la scène se tonalise d'après lui. */
function uiDark() {
  const r = document.documentElement.dataset;
  if (r.mode) return r.mode === "dark";
  if (r.theme) return r.theme === "dark";
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return true; }
}
const WEATHER_KEY = "selene-weather";
export function freshWeather(c) {
  // Fraîche : moins de trois heures, et pas « du futur » (une horloge d'appareil changée ne ressuscite pas une vieille pluie).
  try { const w = JSON.parse(platform.storage.get(WEATHER_KEY)), age = w ? Date.now() - w.at : NaN; return w && w.lat === +c.lat && w.lon === +c.lon && age > -300000 && age < 3 * 3600000 ? w : null; } catch { return null; }
}
let weatherBusy = false;
export async function refreshWeather(force = false) {
  const c = skyConf(); if (!c || c.weather === false || weatherBusy) return;
  const w = freshWeather(c); if (!force && w && Date.now() - w.at < 30 * 60000) return;
  weatherBusy = true;
  try {
    // Le temps présent, et les cinq jours qui viennent (pluie) pour les tâches à ciel ouvert : un seul appel.
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${+c.lat}&longitude=${+c.lon}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation&daily=precipitation_sum,precipitation_probability_max&forecast_days=7&timezone=auto`);
    const j = r.ok ? await r.json() : null, cur = j && j.current, dl = j && j.daily;
    if (!cur || !Number.isFinite(+cur.weather_code)) return;
    const days = dl && Array.isArray(dl.time) ? dl.time.slice(0, 7).map((d, i) => ({ d: String(d).slice(0, 10), mm: +((dl.precipitation_sum || [])[i]) || 0, pp: +((dl.precipitation_probability_max || [])[i]) || 0 })) : [];
    platform.storage.set(WEATHER_KEY, JSON.stringify({ at: Date.now(), lat: +c.lat, lon: +c.lon, code: +cur.weather_code, temp: +cur.temperature_2m, cloud: +cur.cloud_cover, wind: +cur.wind_speed_10m, dir: +cur.wind_direction_10m, precip: +cur.precipitation, days }));
    render();
  } catch {} finally { weatherBusy = false; } // hors ligne, ou l'artefact claude.ai qui ne sort pas : le ciel reste sans météo
}
/* Le ciel vivant se règle par appareil : c'est l'appareil qui paie l'animation, pas le compte. */
export const skyLive = () => { try { return platform.storage.get("selene-sky-live") !== "off"; } catch { return true; } };
/* Hors de vue (la page défilée plus bas), la scène s'immobilise : aucune image calculée pour personne. */
let heroObs = null;
export function skyWatch() {
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
export const hm = t => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
/* La scène du moment : couleurs (skyScene), place de la lune, et ce qu'on peut en dire en une ligne. */
export function sceneNow(m) {
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
let skyResults = [];
 // résultats de la dernière recherche de ville (propres à l'appareil, oubliés au rechargement)
export function skySettingsHTML() {
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
export async function skySearch() {
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
export function heroStyle(sc, dark) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");
  return [["--sky-top", sc.top], ["--sky-bot", sc.bot], ["--tree-far", sc.far], ["--tree-near", sc.near], ["--mist", sc.mist], ["--star", sc.star.toFixed(3)],
    ["--glow", `rgba(${dark ? "236,232,214" : "255,252,235"},${sc.glow.toFixed(3)})`], ["--moon-o", sc.moonOpacity.toFixed(2)], ["--cloud", sc.cloud],
    ["--rain-c", sc.ink === "#1a211b" ? "#4a5550" : "#c9d0cc"], ["--leaf", sc.leaf], ["--leaf-o", sc.leafO], ["--wood", sc.wood], ["--birch", sc.birch], ...(sc.frost ? [["--frost", sc.frost]] : []), ["--scene-ink", sc.ink], ["--scene-scrim", `rgba(${rgb(sc.scrimColor)},${sc.scrim})`]]
    .map(([k, v]) => `${k}:${v}`).join(";");
}
CLICK["sky-search"] = () => skySearch();
CLICK["sky-pick"] = el => { const r = skyResults[+el.dataset.i]; if (r) setSky(r.name, r.lat, r.lon); };
CLICK["sky-locate"] = () => {
  if (!navigator.geolocation) return toast("Ce navigateur ne donne pas sa position. Une ville fera l'affaire.");
  navigator.geolocation.getCurrentPosition(p => setSky("Ma position", p.coords.latitude, p.coords.longitude),
    () => toast("Position refusée ou indisponible. Une ville fera l'affaire."), { maximumAge: 3600000, timeout: 15000 });
};
CLICK["sky-clear"] = () => { delete S().config.sky; platform.storage.remove(WEATHER_KEY); site.save(); render(); toast("Lieu retiré : l'heure redevient estimée, sans météo."); };
