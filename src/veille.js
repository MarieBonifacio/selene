/* ================= veille : Research Watch, par OpenAlex (pur, sans DOM ni réseau) =================
   Des recherches enregistrées (« depersonalization ») et des auteurs suivis (identifiant OpenAlex ou ORCID), relus une
   fois par semaine : les nouveaux articles depuis la dernière fois. OpenAlex accepte CORS ; la clé (gratuite,
   facultative : elle décuple le quota du jour) reste sur l'appareil. Ce que la veille ne fait pas : classer les
   articles selon qu'ils « confirment » quoi que ce soit. Le lien « documente », c'est toi qui le poses.
   Se teste seul (tests/veille.test.js). */
const OA_API = "https://api.openalex.org/works";
const OA_SELECT = "id,doi,title,publication_date,type,primary_location,authorships,abstract_inverted_index";
/* Ce que l'on suit : un auteur (identifiant OpenAlex A…, son adresse, ou un ORCID), sinon une recherche. */
function oaWatch(raw) {
  const t = String(raw || "").trim().replace(/\s+/g, " ");
  if (!t || t.length > 200) return null;
  const orcid = t.match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  if (orcid) return { kind: "author", q: orcid[1].toUpperCase(), filter: `author.orcid:${orcid[1].toUpperCase()}` };
  const a = t.match(/^(?:https?:\/\/(?:api\.)?openalex\.org\/(?:authors\/)?)?(A\d{4,12})$/i);
  if (a) return { kind: "author", q: a[1].toUpperCase(), filter: `author.id:${a[1].toUpperCase()}` };
  return { kind: "q", q: t };
}
/* L'adresse d'une relecture : ce qui est paru depuis `since` (AAAA-MM-JJ), le plus récent d'abord, dix au plus. */
function oaUrl(w, since, key) {
  const x = w.kind === "author" ? oaWatch(w.q) : w;
  const filter = [x.filter, `from_publication_date:${since}`].filter(Boolean).join(",");
  const p = { ...(x.kind === "q" ? { search: x.q } : {}), filter, sort: "publication_date:desc", per_page: "10", select: OA_SELECT, ...(key ? { api_key: key } : {}) };
  return `${OA_API}?${Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
/* Le résumé, qu'OpenAlex donne en index inversé (mot → positions), remis dans l'ordre. */
function oaAbstract(idx) {
  if (!idx || typeof idx !== "object") return "";
  const words = [];
  for (const [w, pos] of Object.entries(idx)) if (Array.isArray(pos)) for (const i of pos) if (Number.isInteger(i) && i >= 0 && i < 5000) words[i] = w;
  return words.filter(Boolean).join(" ");
}
const oaText = (v, n) => { const t = String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
/* La réponse → des éléments pour Dehors : titre, lien (le DOI, sinon la notice OpenAlex), revue et auteurs, résumé. */
function oaWorks(json) {
  const out = [];
  for (const r of (json && Array.isArray(json.results) ? json.results : [])) {
    if (!r || typeof r !== "object") continue;
    const id = String(r.id || "").replace(/^https:\/\/openalex\.org\//, "");
    if (!/^W\d+$/.test(id)) continue;
    const doi = String(r.doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
    const src = r.primary_location && r.primary_location.source && r.primary_location.source.display_name;
    const names = (Array.isArray(r.authorships) ? r.authorships : []).map(a => a && a.author && a.author.display_name).filter(x => typeof x === "string");
    const who = names.length > 3 ? names.slice(0, 3).join(", ") + " et al." : names.join(", ");
    out.push({ id, title: oaText(r.title, 300) || id, link: /^10\.\d{4,9}\//.test(doi) ? `https://doi.org/${doi}` : `https://openalex.org/${id}`, date: "",
      text: oaText([src, who].filter(Boolean).join(" · ") + (r.abstract_inverted_index ? " — " + oaAbstract(r.abstract_inverted_index) : ""), 420),
      oa: { doi: /^10\.\d{4,9}\//.test(doi) ? doi : "", day: /^\d{4}-\d{2}-\d{2}$/.test(r.publication_date || "") ? r.publication_date : "", site: oaText(src, 200), authors: oaText(who, 200), kind: oaText(r.type, 40) } });
  }
  return out;
}
