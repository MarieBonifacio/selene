/* ================= instagram : l'export « Télécharger tes informations » (pur, sans DOM ni réseau) =================
   Meta ne donne plus d'API aux comptes personnels : l'archive JSON est le seul chemin, et il reste chez toi (aucun
   appel). Fichiers lus : posts_1.json (posts_2… au-delà) et reels.json, dans your_instagram_activity/media/ (ou
   content/ dans les exports plus anciens). L'export ne contient pas l'adresse des publications : la légende et la
   date seulement. Se teste seul (tests/instagram.test.js). */
/* Meta écrit ses JSON en UTF-8 relu comme du Latin-1 : « Ã© » pour « é », « ð\u009f\u008c\u0099 » pour 🌙.
   On rend les octets à leur sens ; un texte déjà juste (un caractère au-delà de U+00FF) ou indécodable est laissé tel quel. */
function igFix(s) {
  s = String(s ?? "");
  if (!/[Â-ô][\u0080-¿]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  try { return decodeURIComponent(s.replace(/%/g, "%25").replace(/[\u0080-ÿ]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())); } catch { return s; }
}
const igTime = v => Number.isInteger(+v) && +v > 946684800 && +v < 1e10 ? +v : 0; // après l'an 2000, en secondes
/* Un fichier lu → [{ t, k, caption, n }] : l'instant (secondes Unix), la sorte (post ou reel), la légende réparée,
   le nombre de médias. Une publication à un seul média porte sa légende et sa date sur le média ; un carrousel, en tête. */
function igPosts(json) {
  const lists = Array.isArray(json) ? [["post", json]]
    : json && typeof json === "object" ? Object.entries(json).filter(([k, v]) => Array.isArray(v) && /reel|post|media/i.test(k) && !/stor/i.test(k)).map(([k, v]) => [/reel/i.test(k) ? "reel" : "post", v]) : [];
  const out = [];
  for (const [k, list] of lists) for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const media = Array.isArray(p.media) ? p.media.filter(m => m && typeof m === "object") : [];
    const t = igTime(p.creation_timestamp) || igTime(media[0] && media[0].creation_timestamp); if (!t) continue;
    out.push({ t, k, caption: igFix(p.title || (media[0] && media[0].title) || "").trim(), n: media.length || 1 });
  }
  return out;
}
/* Le jour local d'un instant (AAAA-MM-JJ). */
const igDay = t => { const d = new Date(t * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/* Une publication → les champs d'un élément de collection : la première ligne de la légende en titre (sinon la date),
   la légende entière en texte (telle que publiée : c'est elle, l'archive), le jour de publication en date. */
function igEntry(p) {
  const first = p.caption.split("\n").map(x => x.trim()).find(Boolean) || "", day = igDay(p.t);
  const title = first ? (first.length > 120 ? first.slice(0, 119).trimEnd() + "…" : first) : `${p.k === "reel" ? "Reel" : "Publication"} du ${day}`;
  return { title, text: p.caption === title ? "" : p.caption, due: day, ig: { t: p.t, k: p.k } }; // une ligne qui tient dans le titre : pas de doublon
}
