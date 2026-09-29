/* ================= sources : liens et DOI (pur, sans DOM ni réseau) =================
   Une Source est un élément de collection qui porte `src = { url, doi, site, date }`. Ce fichier ne fait que
   reconnaître, normaliser et traduire : l'appel réseau est dans types.js, la validation dans domain.js (srcValid).
   Il se teste seul (tests/sources.test.js). */
/* Paramètres qui ne servent qu'à suivre le lecteur : les retirer rend deux liens vers la même page identiques. */
const TRACKERS = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|yclid|mc_cid|mc_eid|igshid|igsh|ref_src|ref_url|_hsenc|_hsmi|mkt_tok|spm)$/i;
export const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
/* Une adresse http(s) débarrassée des traceurs et du fragment ; null si ce n'en est pas une. */
export function normalizeUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = ""; u.hostname = u.hostname.toLowerCase();
  for (const k of [...u.searchParams.keys()]) if (TRACKERS.test(k)) u.searchParams.delete(k);
  let s = u.toString();
  if (u.pathname !== "/" && !u.search && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}
/* Le premier DOI d'un texte ou d'une adresse (doi.org/…, …/doi/10.…), sans la ponctuation qui le suit. */
export function findDoi(text) {
  let t = String(text || "");
  try { t = decodeURIComponent(t); } catch {}
  const m = t.match(/\b(10\.\d{4,9}\/[^\s"'<>]+)/i);
  return m ? m[1].replace(/[.,;:)\]}>»]+$/, "").toLowerCase() : null;
}
/* La première adresse http(s) d'un texte. */
export function findUrl(text) {
  const m = String(text || "").match(/https?:\/\/[^\s"'<>]+/i);
  return m ? normalizeUrl(m[0].replace(/[.,;:)\]}>»]+$/, "")) : null;
}
/* Ce qui identifie une source : son DOI, sinon son adresse sans protocole ni « www. ». */
export function sourceKey(src) {
  if (!src) return null;
  if (src.doi) return "doi:" + String(src.doi).toLowerCase();
  const u = src.url && normalizeUrl(src.url);
  return u ? "url:" + u.replace(/^https?:\/\/(www\.)?/, "") : null;
}
const CROSSREF_KIND = { "journal-article": "article", "book": "livre", "monograph": "livre", "edited-book": "livre", "book-chapter": "chapitre",
  "posted-content": "prépublication", "proceedings-article": "actes", "dissertation": "thèse", "report": "rapport", "reference-entry": "notice" };
const partsDate = p => { const d = p && p["date-parts"] && p["date-parts"][0]; if (!d || !d[0]) return ""; return [String(d[0]).padStart(4, "0"), ...d.slice(1, 3).map(x => String(x).padStart(2, "0"))].join("-"); };
const people = list => { const n = (list || []).map(a => clip(a.name || [a.given, a.family].filter(Boolean).join(" "), 80)).filter(Boolean); return n.length > 3 ? n.slice(0, 3).join(", ") + " et al." : n.join(", "); };
/* La réponse de Crossref (message d'un /works/{doi}) → les champs d'une source. Le résumé arrive en JATS (XML) :
   on n'en garde que le texte. L'adresse est celle du résolveur officiel, en https (pas l'ancien dx.doi.org). */
export function crossrefToSource(msg, doi) {
  const m = msg || {}, d = String(m.DOI || doi || "").toLowerCase();
  return {
    title: clip((m.title || [])[0] || d, 300), authors: people(m.author), site: clip((m["container-title"] || [])[0] || m.publisher || "", 200),
    date: partsDate(m.issued) || partsDate(m.published) || partsDate(m["published-print"]) || partsDate(m["published-online"]),
    kind: CROSSREF_KIND[m.type] || clip(m.type || "", 40), doi: d || null,
    url: d ? "https://doi.org/" + d : normalizeUrl(m.URL || ""), abstract: clip(String(m.abstract || "").replace(/<\/?(?:jats:)?(?:p|sec|title)\b[^>]*>/g, " ").replace(/<[^>]*>/g, ""), 1200)
  };
}
/* La réponse de Microlink (data d'un aperçu de page) → les champs d'une source. */
export function microlinkToSource(data, url) {
  const d = data || {}, u = normalizeUrl(d.url || url) || normalizeUrl(url);
  let host = ""; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch {}
  return { title: clip(d.title || u || "", 300), authors: clip(d.author || "", 200), site: clip(d.publisher || host, 200),
    date: /^\d{4}-\d{2}-\d{2}/.test(d.date || "") ? d.date.slice(0, 10) : "", kind: "page", doi: findDoi(u) || null, url: u, abstract: clip(d.description || "", 600) };
}
/* Sans réseau (ou quota épuisé) : l'adresse seule, et son site. */
export function bareSource(url, doi) {
  const u = normalizeUrl(url || (doi ? "https://doi.org/" + doi : ""));
  let host = ""; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch {}
  return { title: doi || clip(u || "", 300), authors: "", site: host, date: "", kind: doi ? "article" : "page", doi: doi || null, url: u, abstract: "" };
}
