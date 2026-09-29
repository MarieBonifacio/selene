/* ================= veille : Research Watch, par OpenAlex (pur, sans DOM ni réseau) =================
   Des recherches enregistrées (« depersonalization ») et des auteurs suivis (identifiant OpenAlex ou ORCID), relus une
   fois par semaine : les nouveaux articles depuis la dernière fois. OpenAlex accepte CORS ; la clé (gratuite,
   facultative : elle décuple le quota du jour) reste sur l'appareil. Ce que la veille ne fait pas : classer les
   articles selon qu'ils « confirment » quoi que ce soit. Le lien « documente », c'est toi qui le poses.
   Se teste seul (tests/veille.test.js). */
const OA_API = "https://api.openalex.org/works";
const OA_SELECT = "id,doi,title,publication_date,type,primary_location,authorships,abstract_inverted_index,referenced_works";
/* Ce que l'on suit : un auteur (identifiant OpenAlex A…, son adresse, ou un ORCID), sinon une recherche. */
export function oaWatch(raw) {
  const t = String(raw || "").trim().replace(/\s+/g, " ");
  if (!t || t.length > 200) return null;
  const orcid = t.match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  if (orcid) return { kind: "author", q: orcid[1].toUpperCase(), filter: `author.orcid:${orcid[1].toUpperCase()}` };
  const a = t.match(/^(?:https?:\/\/(?:api\.)?openalex\.org\/(?:authors\/)?)?(A\d{4,12})$/i);
  if (a) return { kind: "author", q: a[1].toUpperCase(), filter: `author.id:${a[1].toUpperCase()}` };
  return { kind: "q", q: t };
}
/* L'adresse d'une relecture : ce qui est paru depuis `since` (AAAA-MM-JJ), le plus récent d'abord, dix au plus. */
export function oaUrl(w, since, key) {
  const x = w.kind === "author" ? oaWatch(w.q) : w;
  const filter = [x.filter, `from_publication_date:${since}`].filter(Boolean).join(",");
  const p = { ...(x.kind === "q" ? { search: x.q } : {}), filter, sort: "publication_date:desc", per_page: "10", select: OA_SELECT, ...(key ? { api_key: key } : {}) };
  return `${OA_API}?${Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
/* Le résumé, qu'OpenAlex donne en index inversé (mot → positions), remis dans l'ordre. */
export function oaAbstract(idx) {
  if (!idx || typeof idx !== "object") return "";
  const words = [];
  for (const [w, pos] of Object.entries(idx)) if (Array.isArray(pos)) for (const i of pos) if (Number.isInteger(i) && i >= 0 && i < 5000) words[i] = w;
  return words.filter(Boolean).join(" ");
}
const oaText = (v, n) => { const t = String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
/* La réponse → des éléments pour Dehors : titre, lien (le DOI, sinon la notice OpenAlex), revue et auteurs, résumé. */
export function oaWorks(json) {
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
      oa: { doi: /^10\.\d{4,9}\//.test(doi) ? doi : "", day: /^\d{4}-\d{2}-\d{2}$/.test(r.publication_date || "") ? r.publication_date : "", site: oaText(src, 200), authors: oaText(who, 200), kind: oaText(r.type, 40) },
      // ses références (W…), le temps de les croiser avec tes sources : l'appelant n'en garde que l'intersection
      ...(Array.isArray(r.referenced_works) ? { refs: r.referenced_works.map(x => String(x || "").replace(/^https:\/\/openalex\.org\//, "")).filter(x => /^W\d+$/.test(x)).slice(0, 2000) } : {}) });
  }
  return out;
}
/* ---- « cité par tes sources » : ce que tes Sources ont en commun, d'après leurs bibliographies (OpenAlex) ----
   OpenAlex ne reçoit que des DOI (ceux de tes sources), jamais tes notes. Deux mesures classiques de bibliométrie :
   la référence commune (un texte cité par plusieurs de tes sources, que tu n'as peut-être pas) et le couplage
   bibliographique (Kessler, 1963 : deux de tes sources qui citent les mêmes textes parlent de la même chose). */
export const OA_DOI = /^10\.\d{4,9}\/[^\s|,]+$/;
const oaId = v => { const m = String(v || "").match(/(?:^|\/)([WA]\d{1,14})$/); return m ? m[1] : ""; };
/* Des lots de cinquante (le plafond d'un filtre « ou » d'OpenAlex) : les DOI, ou les identifiants W…. */
function oaBatchUrls(field, values, select, key) {
  const out = [];
  for (let i = 0; i < values.length; i += 50) {
    const p = { filter: `${field}:${values.slice(i, i + 50).join("|")}`, per_page: "50", select, ...(key ? { api_key: key } : {}) };
    out.push(`${OA_API}?${Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`);
  }
  return out;
}
export const oaRefsUrls = (dois, key) => oaBatchUrls("doi", dois.filter(d => OA_DOI.test(d)), "id,doi,referenced_works,authorships", key);
export const oaTitlesUrls = (ids, key) => oaBatchUrls("openalex", ids.filter(x => /^W\d+$/.test(x)), "id,doi,title,publication_date,type,primary_location,authorships", key);
/* Une notice → ce qui sert au calcul : son identifiant, ses références (W…), ses auteurs (A…, nom). */
export function oaRefs(json) {
  const out = {};
  for (const r of (json && Array.isArray(json.results) ? json.results : [])) {
    if (!r || typeof r !== "object") continue;
    const id = oaId(r.id), doi = String(r.doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
    if (!/^W\d+$/.test(id) || !OA_DOI.test(doi)) continue;
    const refs = [...new Set((Array.isArray(r.referenced_works) ? r.referenced_works : []).map(oaId).filter(x => /^W\d+$/.test(x)))].slice(0, 2000);
    const authors = (Array.isArray(r.authorships) ? r.authorships : []).map(a => a && a.author && { id: oaId(a.author.id), name: oaText(a.author.display_name, 120) })
      .filter(a => a && /^A\d+$/.test(a.id) && a.name).slice(0, 100);
    out[doi] = { id, refs, authors };
  }
  return out;
}
/* Le calcul, pur. `works` : DOI → { id, refs, authors } (ce qu'OpenAlex connaît de tes sources).
   - common : les références citées par au moins deux de tes sources, hors tes sources elles-mêmes, les plus citées d'abord ;
   - pairs : les couples de sources qui partagent au moins deux références, les plus liés d'abord ;
   - authors : les auteurs présents dans au moins deux de tes sources. */
export function oaCoupling(works, max = 12) {
  const entries = Object.entries(works || {}).filter(([, w]) => w && /^W\d+$/.test(w.id));
  const own = new Set(entries.map(([, w]) => w.id)), cite = new Map(), who = new Map();
  for (const [doi, w] of entries) {
    for (const r of new Set(w.refs || [])) if (!own.has(r)) { if (!cite.has(r)) cite.set(r, []); cite.get(r).push(doi); }
    for (const a of new Map((w.authors || []).map(a => [a.id, a])).values()) { if (!who.has(a.id)) who.set(a.id, { id: a.id, name: a.name, by: [] }); who.get(a.id).by.push(doi); }
  }
  const common = [...cite].filter(([, by]) => by.length >= 2).map(([id, by]) => ({ id, by })).sort((a, b) => b.by.length - a.by.length || a.id.localeCompare(b.id)).slice(0, max);
  const pairs = [];
  for (let i = 0; i < entries.length; i++) {
    const a = new Set(entries[i][1].refs || []);
    for (let j = i + 1; j < entries.length; j++) {
      let n = 0; for (const r of new Set(entries[j][1].refs || [])) if (a.has(r)) n++;
      if (n >= 2) pairs.push({ a: entries[i][0], b: entries[j][0], n });
    }
  }
  pairs.sort((x, y) => y.n - x.n || x.a.localeCompare(y.a));
  const authors = [...who.values()].filter(a => a.by.length >= 2).sort((a, b) => b.by.length - a.by.length || a.name.localeCompare(b.name)).slice(0, max);
  return { common, pairs: pairs.slice(0, 6), authors, known: entries.length };
}
