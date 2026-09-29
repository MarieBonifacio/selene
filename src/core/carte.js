/* ================= carte céleste des liaisons (pur, sans DOM) =================
   Une lentille secondaire, jamais une vue d'ensemble : le voisinage d'une entrée, ou les entrées d'un motif. Le
   placement est déterministe, comme une carte du ciel et contrairement aux graphes « à ressorts » (force-directed) qui
   se réarrangent à chaque ouverture et ruinent la mémoire spatiale : le temps en abscisse (comme l'écliptique), une
   bande horizontale par espace, et la même entrée toujours au même endroit. La taille d'une étoile dit son nombre de
   liens (sa magnitude, à l'envers de l'astronomie où la plus brillante a le plus petit chiffre). Ce fichier ne fait
   que la géométrie ; le choix des étoiles et le dessin sont dans types.js. Il se teste seul (tests/carte.test.js). */
export const CARTE_MAX = 80; // au-delà, c'est une nébuleuse, pas une carte
/* Un nombre stable dans [0, 1[ tiré d'une chaîne (FNV-1a) : le « hasard » d'une étoile ne change jamais. */
export function hash01(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
/* nodes : [{ ref, mod, date?, links }] ; edges : [{ from, to, type, open? }] ; bands : ordre des espaces (navigation).
   → { width, height, bands: [{ mod, y }], stars: [{ ref, mod, x, y, r }], lines: [{ from, to, type, open, d }], span } */
export function carteLayout(nodes, edges, bands, { W = 720, bandH = 64, top = 18, left = 96, right = 18 } = {}) {
  const used = bands.filter(m => nodes.some(n => n.mod === m));
  const extra = [...new Set(nodes.map(n => n.mod).filter(m => !used.includes(m)))].sort();
  const order = [...used, ...extra], bandOf = new Map(order.map((m, i) => [m, i]));
  const dated = nodes.filter(n => n.date).map(n => Date.parse(n.date + "T12:00:00Z")).filter(Number.isFinite);
  const t0 = dated.length ? Math.min(...dated) : 0, t1 = dated.length ? Math.max(...dated) : 0;
  const undated = nodes.some(n => !n.date), x0 = left + (undated ? 34 : 0), x1 = W - right;
  const xOf = n => {
    if (!n.date) return left + 10; // sans date : une colonne à part, au bord
    const t = Date.parse(n.date + "T12:00:00Z");
    return t1 > t0 ? x0 + (x1 - x0) * (t - t0) / (t1 - t0) : (x0 + x1) / 2;
  };
  // Les étoiles d'une même bande trop proches en abscisse s'étagent verticalement, dans l'ordre de leur référence.
  const stars = [], buckets = new Map();
  for (const n of [...nodes].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))) {
    const b = bandOf.get(n.mod), x = Math.round(xOf(n) * 10) / 10, key = `${b}:${Math.round(x / 10)}`;
    const i = (buckets.get(key) || 0); buckets.set(key, i + 1);
    const cy = top + b * bandH + bandH / 2, jitter = (hash01(n.ref) - .5) * bandH * .3;
    const step = i ? Math.ceil(i / 2) * (i % 2 ? 1 : -1) * 11 : 0; // 0, +11, −11, +22…
    const y = Math.max(top + b * bandH + 7, Math.min(top + (b + 1) * bandH - 7, cy + (i ? step : jitter)));
    stars.push({ ref: n.ref, mod: n.mod, x, y: Math.round(y * 10) / 10, r: Math.round(Math.min(8, 3.2 + 1.3 * Math.sqrt(n.links || 0)) * 10) / 10 });
  }
  const at = new Map(stars.map(s => [s.ref, s]));
  // Les liens en arcs légers : deux liens entre des étoiles alignées ne se confondent pas avec la bande.
  const lines = edges.filter(e => at.has(e.from) && at.has(e.to) && e.from !== e.to).map(e => {
    const a = at.get(e.from), b = at.get(e.to), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, k = .18;
    const d = `M${a.x},${a.y}Q${Math.round((mx - dy * k) * 10) / 10},${Math.round((my + dx * k) * 10) / 10} ${b.x},${b.y}`;
    return { from: e.from, to: e.to, type: e.type, open: !!e.open, d };
  });
  return { width: W, height: top * 2 + order.length * bandH, bands: order.map((mod, i) => ({ mod, y: top + i * bandH })), stars, lines,
    span: dated.length ? { from: new Date(t0).toISOString().slice(0, 10), to: new Date(t1).toISOString().slice(0, 10), x0, x1 } : null };
}
/* Le voisinage d'une entrée, en largeur d'abord (les plus proches gardées quand il faut couper) : adjacency est une
   Map ref → [refs voisines], dans les deux sens. → { refs, capped } */
export function carteNeighbourhood(start, adjacency, depth = 2, max = CARTE_MAX) {
  const seen = new Set([start]); let frontier = [start];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = [];
    for (const r of frontier) for (const n of [...(adjacency.get(r) || [])].sort()) if (!seen.has(n)) { seen.add(n); next.push(n); }
    frontier = next;
  }
  const refs = [...seen];
  return { refs: refs.slice(0, max), capped: refs.length > max };
}
