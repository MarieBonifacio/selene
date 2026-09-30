/* Radar culturel : noyau pur, sans DOM ni réseau. Source OpenAgenda, catalogue public Opendatasoft.
   La fenêtre géographique et les dates partent au fournisseur ; les mots restent sur l'appareil.
   Contrat et vérification réelle : docs/radar.md. */
export const RADAR_SOURCE = "https://public.opendatasoft.com";
export const RADAR_PAGE_SIZE = 100;
const RADAR_FIELDS = "uid,title_fr,description_fr,longdescription_fr,keywords_fr,firstdate_begin,lastdate_end,timings,location_name,location_city,canonicalurl,status";
export const radarFold = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const addDaysISO = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const validDay = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
/* Périmètre produit explicite : 35 km autour de Lille, pas la zone d'observation des éclipses.
   Ce rayon n'est pas une frontière administrative de la MEL. */
export function radarCovered(place) {
  if (!place || place.lat == null || place.lon == null || place.lat === "" || place.lon === "") return false;
  const lat = +place.lat, lon = +place.lon, rad = x => x * Math.PI / 180;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  const a = Math.sin(rad(lat - 50.63) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(50.63)) * Math.sin(rad(lon - 3.06) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) <= 35;
}
export function radarUrl(place, from, { days = 14, km = 20, offset = 0 } = {}) {
  if (!radarCovered(place) || !validDay(from) || !Number.isInteger(days) || days < 1 || days > 31 || !Number.isInteger(offset) || offset < 0 || offset > 9900 || !Number.isFinite(km) || km < 1 || km > 50) throw new Error("Zone ou période du radar invalide.");
  const lat = Math.round(+place.lat * 10) / 10, lon = Math.round(+place.lon * 10) / 10;
  // Marge d'un jour : l'API stocke en UTC, les occurrences sont vérifiées en Europe/Paris ensuite.
  const where = `lastdate_end >= date'${addDaysISO(from, -1)}' and firstdate_begin < date'${addDaysISO(from, days)}' and within_distance(location_coordinates, geom'POINT(${lon} ${lat})', ${km}km)`;
  const q = new URLSearchParams({ where, order_by: "firstdate_begin,uid", limit: String(RADAR_PAGE_SIZE), offset: String(offset), select: RADAR_FIELDS });
  return `${RADAR_SOURCE}/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records?${q}`;
}
const radarText = v => String(Array.isArray(v) ? v.join(", ") : v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const excerpt = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
const radarDay = value => {
  if (validDay(value)) return value;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !validDay(value.slice(0, 10))) return "";
  const t = Date.parse(value); return Number.isFinite(t) ? parisDay.format(new Date(t)) : "";
};
const decoded = value => { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return null; } };
/* Une forme inattendue est une panne de contrat, jamais un résultat vide à mettre en cache. */
export function radarPage(json) {
  if (!json || !Array.isArray(json.results) || !Number.isSafeInteger(json.total_count) || json.total_count < json.results.length || json.results.length > RADAR_PAGE_SIZE) throw new Error("Format de l'agenda incompatible. Réessaie plus tard.");
  if (json.results.some(r => !r || typeof r !== "object" || typeof (r.title_fr ?? r.title) !== "string" || !radarDay(r.firstdate_begin) || !radarDay(r.lastdate_end))) throw new Error("Événements illisibles dans la réponse de l'agenda.");
  return { rows: json.results, total: json.total_count };
}
/* Dates détaillées : retenir la prochaine séance dans la fenêtre, pas la première date historique.
   Sans horaires détaillés, garder la plage mais la présenter comme indicative. */
export function radarEvents(json, from = "", days = 14) {
  const seen = new Set(), out = [], until = from ? addDaysISO(from, days) : "";
  for (const r of (json && Array.isArray(json.results) ? json.results : [])) {
    if (!r || typeof r !== "object") continue;
    const fullTitle = radarText(r.title_fr ?? r.title); if (!fullTitle) continue;
    const status = decoded(r.status);
    // OpenAgenda : 1 programmé, 2 reprogrammé, 3 en ligne, 4 reporté, 5 complet, 6 annulé.
    const statusId = status?.id ?? status;
    if (statusId != null && ![1, 2, "1", "2"].includes(statusId)) continue;
    let begin = radarDay(r.firstdate_begin), end = radarDay(r.lastdate_end) || begin;
    if (!begin || !end || end < begin) continue;
    let dated = false;
    if (r.timings != null && r.timings !== "") {
      const timings = decoded(r.timings);
      if (!Array.isArray(timings)) throw new Error("Horaires de l'agenda illisibles.");
      const dates = timings.map(t => ({ from: radarDay(t?.begin ?? t?.start), to: radarDay(t?.end) }));
      if (dates.some(t => !t.from || !t.to || t.to < t.from)) throw new Error("Horaires de l'agenda invalides.");
      const next = dates.filter(t => !from || (t.to >= from && t.from < until)).sort((a, b) => a.from.localeCompare(b.from))[0];
      if (!next) continue;
      begin = next.from; end = next.to; dated = true;
    }
    if (from && (end < from || begin >= until)) continue;
    let url = ""; try { const u = new URL(String(r.canonicalurl || "")); if (u.protocol === "https:" && !u.username && !u.password) url = u.toString(); } catch {}
    const place = radarText(r.location_name), city = radarText(r.location_city);
    const id = String(r.uid || url || JSON.stringify([fullTitle, begin, end, place, city]));
    if (seen.has(id)) continue; seen.add(id);
    const rawKeywords = r.keywords_fr ?? r.keywords ?? [];
    const kw = (Array.isArray(rawKeywords) ? rawKeywords : String(rawKeywords).split(/[,;]/)).map(radarText).filter(Boolean);
    const description = radarText(r.description_fr ?? r.description), long = radarText(r.longdescription_fr ?? r.longdescription);
    out.push({ id, title: excerpt(fullTitle, 200), from: begin, to: end, dated, rescheduled: +statusId === 2, place: excerpt(place, 120), city: excerpt(city, 80), url, kw,
      text: excerpt(description || long, 300), search: radarFold(`${fullTitle} ${kw.join(" ")} ${description} ${long} ${place} ${city}`) });
  }
  return out;
}
const wordsText = s => radarFold(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
export const radarWords = s => [...new Set(String(s || "").split(",").map(w => wordsText(w)).filter(w => w.length > 1))];
export function radarMatch(events, words, n = 5) {
  const hits = [];
  for (const e of events || []) {
    const f = ` ${wordsText(e.search ?? `${e.title} ${(e.kw || []).join(" ")} ${e.text} ${e.place}`)} `;
    const on = words.filter(w => f.includes(` ${wordsText(w)} `));
    if (on.length) hits.push({ ...e, on });
  }
  hits.sort((a, b) => a.from.localeCompare(b.from) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return { items: hits.slice(0, n), total: hits.length };
}
