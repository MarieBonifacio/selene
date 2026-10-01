/* ================= zotero : ta bibliothèque Zotero, en lecture seule (pur, sans DOM ni réseau) =================
   Zotero garde l'archive (fiches, PDF, annotations) ; Selene s'en sert pour penser. Une Source peut pointer vers une
   fiche Zotero au lieu de la recopier à la main. La clé API (lecture seule conseillée) reste sur l'appareil.
   Ici : lire ce que dit une clé, traduire une fiche en Source. L'appel réseau est dans types.js ; la validation de
   `zot`, dans domain.js (zotValid). Se teste seul (tests/zotero.test.js). */
export const ZOT_API = "https://api.zotero.org";
/* Ce que permet une clé (réponse de /keys/…) : à qui elle est, et si elle peut écrire (on préfère que non). */
export function zotKeyInfo(j) {
  if (!j || typeof j !== "object" || !Number.isInteger(j.userID) || j.userID <= 0) return null;
  const u = (j.access && j.access.user) || {};
  return { userID: j.userID, username: String(j.username || "").slice(0, 100), library: !!u.library, write: !!u.write };
}
export const ZOT_KIND = { journalArticle: "article", magazineArticle: "article", newspaperArticle: "article", book: "livre", bookSection: "chapitre",
  thesis: "thèse", report: "rapport", preprint: "prépublication", conferencePaper: "actes", webpage: "page", blogPost: "page",
  videoRecording: "vidéo", podcast: "podcast", encyclopediaArticle: "notice", dictionaryEntry: "notice" };
const zotText = (v, n) => { const t = String(v ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
/* Une fiche (élément de /items) → les champs d'une Source, ou null pour une pièce jointe, une note, une annotation. */
export function zotSource(item) {
  const d = item && item.data;
  if (!d || typeof d !== "object" || ["attachment", "note", "annotation"].includes(d.itemType)) return null;
  const k = String(item.key || d.key || "");
  if (!/^[A-Z0-9]{8}$/.test(k)) return null;
  const names = (Array.isArray(d.creators) ? d.creators : []).filter(c => c && (!c.creatorType || /author|editor|director|podcaster|presenter/.test(c.creatorType)))
    .map(c => zotText(c.name || [c.firstName, c.lastName].filter(Boolean).join(" "), 80)).filter(Boolean);
  const doi = (String(d.DOI || "").match(/10\.\d{4,9}\/\S+/) || [""])[0].toLowerCase().replace(/[.,;]+$/, "");
  let url = ""; try { const u = new URL(String(d.url || "")); if (/^https?:$/.test(u.protocol)) url = u.toString(); } catch {}
  const pd = String((item.meta && item.meta.parsedDate) || "").match(/^\d{4}(-\d{2}(-\d{2})?)?/);
  const alt = item.links && item.links.alternate && String(item.links.alternate.href || "");
  return {
    title: zotText(d.title, 300) || "(sans titre)",
    authors: zotText(names.length > 3 ? names.slice(0, 3).join(", ") + " et al." : names.join(", "), 200),
    site: zotText(d.publicationTitle || d.bookTitle || d.websiteTitle || d.blogTitle || d.proceedingsTitle || d.university || d.publisher || "", 200),
    date: pd ? pd[0] : "", kind: ZOT_KIND[d.itemType] || zotText(d.itemType, 40), doi: doi || null,
    url: doi ? "https://doi.org/" + doi : url, abstract: zotText(d.abstractNote, 1200),
    zot: { k, ...(/^https:\/\/www\.zotero\.org\/[\w.-]+\/items\/[A-Z0-9]{8}$/.test(alt) ? { l: alt } : {}) }
  };
}
export const zotItems = json => (Array.isArray(json) ? json : []).map(zotSource).filter(Boolean);
