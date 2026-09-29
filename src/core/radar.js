/* ================= radar : événements culturels de la Métropole de Lille (pur, sans DOM ni réseau) =================
   Source : le jeu « evenements-publics-openagenda » du portail open data de la MEL (Opendatasoft, API Explore v2.1,
   sans clé, CORS ouvert). On demande une zone et une période, jamais les mots : le filtre par centres d'intérêt se
   fait ici, sur l'appareil. Tirer, jamais pousser : cinq au plus, pas de « voir plus ». Se teste seul (tests/radar.test.js). */
const RADAR_HOST = "https://opendata.lillemetropole.fr";
const RADAR_FIELDS = "uid,title_fr,description_fr,keywords_fr,firstdate_begin,lastdate_end,location_name,location_city,canonicalurl";
export const radarFold = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const addDaysISO = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
/* L'adresse de la requête : ce qui se tient entre `from` et `from + days`, à `km` du lieu (arrondi au dixième de degré
   par Réglages → Ciel), du plus proche au plus lointain. `select` allège la réponse ; sans lui (lean = false), on
   reçoit tout, au cas où le portail aurait renommé un champ. */
export function radarUrl(place, from, { days = 14, km = 20, lean = true } = {}) {
  const lat = Math.round(+place.lat * 10) / 10, lon = Math.round(+place.lon * 10) / 10;
  const where = `lastdate_end >= date'${from}' and firstdate_begin < date'${addDaysISO(from, days)}' and within_distance(location_coordinates, geom'POINT(${lon} ${lat})', ${km}km)`;
  const q = Object.entries({ where, order_by: "firstdate_begin", limit: "100", ...(lean ? { select: RADAR_FIELDS } : {}) }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${RADAR_HOST}/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records?${q}`;
}
const radarText = (v, n) => { const t = String(Array.isArray(v) ? v.join(", ") : v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const radarDay = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "";
/* La réponse (results) → des événements propres. Tolérant : un champ `_fr` ou sans suffixe, des mots-clés en liste ou
   en texte ; une adresse qui n'est pas en https n'est pas gardée (elle finit dans un href). */
export function radarEvents(json) {
  const seen = new Set(), out = [];
  for (const r of (json && Array.isArray(json.results) ? json.results : [])) {
    if (!r || typeof r !== "object") continue;
    const title = radarText(r.title_fr ?? r.title, 200); if (!title) continue;
    const from = radarDay(r.firstdate_begin), to = radarDay(r.lastdate_end) || from;
    let url = ""; try { const u = new URL(String(r.canonicalurl || "")); if (u.protocol === "https:") url = u.toString(); } catch {}
    const id = String(r.uid ?? url ?? title).slice(0, 80); if (seen.has(id)) continue; seen.add(id);
    const kw = (Array.isArray(r.keywords_fr) ? r.keywords_fr : String(r.keywords_fr ?? r.keywords ?? "").split(/[,;]/)).map(k => radarText(k, 40)).filter(Boolean).slice(0, 8);
    out.push({ id, title, from, to, place: radarText(r.location_name, 120), city: radarText(r.location_city, 80), url, kw, text: radarText(r.description_fr ?? r.description, 300) });
  }
  return out;
}
/* Les mots réglés (séparés par des virgules), sans accents ni casse ; deux lettres au moins. */
export const radarWords = s => [...new Set(String(s || "").split(",").map(w => radarFold(w.trim())).filter(w => w.length > 1))];
/* Ce qui parle d'un des mots (titre, mots-clés, description, lieu), du plus tôt au plus tard ; `n` au plus.
   total dit combien correspondaient : de quoi suggérer de préciser ses mots, sans rien dérouler de plus. */
export function radarMatch(events, words, n = 5) {
  const hits = [];
  for (const e of events || []) {
    const f = radarFold(`${e.title} ${e.kw.join(" ")} ${e.text} ${e.place}`), on = words.filter(w => f.includes(w));
    if (on.length) hits.push({ ...e, on });
  }
  hits.sort((a, b) => (a.from || "9999").localeCompare(b.from || "9999") || a.title.localeCompare(b.title));
  return { items: hits.slice(0, n), total: hits.length };
}
