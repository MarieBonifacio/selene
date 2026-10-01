/* La forêt de l'accueil : arbres dessinés une fois (graine fixe), nuages, brume, neige ou pluie en couches animées. */
import { skyMotion, skyScene } from "../../core/sky.js";
import { tr } from "../i18n/index.js";

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
export function forestSVG(p, sc = skyScene({ sunAlt: -30, illum: .5 }), at, mo = skyMotion(), now = Date.now()) {
  if (!TREES) buildTrees();
  const r = 46, c = 50, rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  const lit = p < .5 ? `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${p < .25 ? 0 : 1} ${c},${c - r}Z`
                     : `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${p < .75 ? 0 : 1} ${c},${c - r}Z`;
  const place = at ? `left:${at.x.toFixed(1)}%;top:${at.y.toFixed(1)}%;` : "";
  return `<svg class="scene" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${tr`Lune au-dessus d'une lisière de sapins`}">
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
