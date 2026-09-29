/* ================= musique : MusicBrainz (pur, sans DOM ni réseau) =================
   La base libre MusicBrainz (fondation MetaBrainz) relie un artiste à ses parutions ; Cover Art Archive en donne
   les pochettes. Ce fichier ne fait que traduire leurs réponses ; les appels (une requête par seconde au plus, sans
   clé) sont dans types.js, la validation de `mb = { a, rg, y }` dans domain.js (mbValid). Se teste seul
   (tests/musique.test.js). */
const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/* Une requête de recherche d'artiste : le nom entre guillemets, ses caractères spéciaux neutralisés (syntaxe Lucene). */
export const mbArtistQuery = name => `artist:"${String(name).trim().replace(/[\\"]/g, "\\$&")}"`;
/* Les candidats d'une recherche d'artiste : nom, précision (« groupe norvégien »), pays, année de début. */
export function mbArtists(json) {
  return ((json && json.artists) || []).filter(a => MBID.test(a.id || "")).slice(0, 6).map(a => ({
    id: a.id, name: String(a.name || ""), note: String(a.disambiguation || ""), country: String(a.country || ""),
    begin: String((a["life-span"] && a["life-span"].begin) || "").slice(0, 4)
  }));
}
/* Les albums et EP studio d'un artiste (sans compilations, enregistrements publics ni remixes), du plus ancien au plus
   récent ; ceux sans date à la fin. */
export function mbAlbums(json) {
  const seen = new Set(), out = [];
  for (const g of (json && json["release-groups"]) || []) {
    if (!MBID.test(g.id || "") || seen.has(g.id)) continue;
    if (!["Album", "EP"].includes(g["primary-type"]) || (g["secondary-types"] || []).length) continue;
    seen.add(g.id);
    out.push({ id: g.id, title: String(g.title || ""), date: String(g["first-release-date"] || ""), type: g["primary-type"] === "EP" ? "EP" : "album" });
  }
  return out.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
}
/* Parus après une date (AAAA-MM-JJ) : une date partielle (« 2024 », « 2024-05 ») compte comme le premier jour possible. */
export const mbSince = (albums, since) => albums.filter(x => x.date && (x.date + "-01-01").slice(0, 10) > since);
export const coverUrl = rg => MBID.test(rg || "") ? `https://coverartarchive.org/release-group/${rg}/front-250` : "";
