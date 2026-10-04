/* ================= biblio : les sources en BibTeX et en CSL-JSON (pur, sans DOM ni réseau) =================
   Ne pas enfermer les sources : un espace Sources s'exporte vers LaTeX (BibTeX, biblatex), Zotero, Zettlr ou Pandoc
   (CSL-JSON). Une source garde peu (titre, auteurs en une ligne, genre traduit, `src = { url, doi, site, date }`) :
   ce fichier en tire le plus juste possible, sans rien inventer. L'export est fait dans features/sources.js. Se teste
   seul (tests/biblio.test.js). */
import { SOURCE_KINDS } from "./sources.js";

const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = s => fold(s).toLowerCase().replace(/\s+/g, " ").trim();
/* Le genre d'une source : son étiquette est le genre traduit dans la langue du moment où elle a été gardée, puis à la
   personne. On la reconnaît en français (la clé) ou dans une des langues de l'interface (dicts) ; sinon null. */
export function sourceKind(tag, dicts = []) {
  const t = norm(tag); if (!t) return null;
  return SOURCE_KINDS.find(k => norm(k) === t || dicts.some(d => d && d[k] && norm(d[k]) === t)) || null;
}

/* Les auteurs : une ligne (« A, B, C et al. » chez Crossref et Zotero, du texte libre ailleurs). On sépare par « ; »
   s'il y en a (chaque morceau peut alors être « Nom, Prénom »), sinon par les virgules et « et », « and », « & ». Une
   initiale seule après une virgule (« Dupont, J. ») est rendue à son nom. « et al. » devient « and others ». */
const PARTICLES = new Set(["de", "du", "des", "la", "le", "van", "von", "der", "den", "da", "di", "del", "della", "dos", "das", "ter", "ten", "zu"]);
const INITIALS = /^(\p{Lu}\.\s*-?\s*)+$/u;
export function splitAuthors(line) {
  let s = String(line || "").replace(/\s+/g, " ").trim(), others = false;
  const tail = s.match(/[,;]?\s*(et al\.?|and others|et coll\.?)$/i);
  if (tail) { others = true; s = s.slice(0, tail.index).trim(); }
  if (!s) return { names: [], others };
  if (s.includes(";")) return { names: s.split(/\s*;\s*/).filter(Boolean), others };
  const parts = s.split(/\s*,\s*|\s+(?:et|and|&)\s+/i).filter(Boolean), names = [];
  for (const p of parts) if (INITIALS.test(p) && names.length && !names[names.length - 1].includes(",")) names[names.length - 1] += ", " + p; else names.push(p);
  return { names, others };
}
/* Un nom → { family, given } ; un seul mot (une institution, un pseudonyme) → { literal }. « Nom, Prénom » est lu
   tel quel ; sinon le nom commence à la première particule (« Jean de La Fontaine »), ou c'est le dernier mot. */
export function parseName(raw) {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  if (s.includes(",")) { const [family, ...rest] = s.split(","); const given = rest.join(",").trim(); return given ? { family: family.trim(), given } : { literal: family.trim() }; }
  const w = s.split(" ");
  if (w.length < 2) return { literal: s };
  const p = w.findIndex((x, i) => i > 0 && PARTICLES.has(x));
  const at = p > 0 ? p : w.length - 1;
  return { family: w.slice(at).join(" "), given: w.slice(0, at).join(" ") };
}
const dateParts = d => { const m = String(d || "").match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/); return m ? m.slice(1).filter(Boolean).map(Number) : null; };

/* Ce qu'on lit d'une entrée de collection Sources, une fois pour les deux formats. */
function read(e, dicts) {
  const x = e.src || {}, a = splitAuthors(e.subtitle);
  const doi = x.doi ? String(x.doi).replace(/[{}\s]/g, "") : "";
  const url = x.url && /^https?:\/\//i.test(x.url) && !(doi && /^https?:\/\/(dx\.)?doi\.org\//i.test(x.url)) ? x.url : "";
  return { title: String(e.title || "").replace(/\s+/g, " ").trim(), names: a.names.map(parseName), others: a.others, kind: sourceKind(e.tag, dicts),
    site: String(x.site || "").replace(/\s+/g, " ").trim(), date: dateParts(x.date), doi, url, kept: dateParts(e.kept), abstract: String(e.text || "").trim() };
}
/* Une clé de citation par source, stable et lisible : nom du premier auteur, année, premier mot du titre
   (« raichle2009default ») ; sans auteur, le mot puis l'année (« lisiere2026 »), pour ne pas commencer par un chiffre ;
   en ASCII ; une clé déjà prise reçoit b, c… */
const STOP = new Set(["the", "a", "an", "of", "on", "in", "and", "le", "la", "les", "l", "un", "une", "des", "de", "du", "d", "et", "en", "au", "aux", "der", "die", "das", "el", "los", "il", "lo"]);
const ascii = s => fold(s).toLowerCase().replace(/[^a-z0-9]/g, "");
function citeKey(r, taken) {
  const n = r.names[0], who = n ? ascii(n.family || n.literal).slice(0, 20) : "";
  const word = fold(r.title).toLowerCase().split(/[^a-z0-9]+/).find(w => w.length > 1 && !STOP.has(w)) || "";
  const year = r.date ? String(r.date[0]) : "", base = (who ? who + year + word.slice(0, 20) : word.slice(0, 20) + year) || "source";
  let k = base;
  for (let i = 1; taken.has(k); i++) k = base + (i < 26 ? String.fromCharCode(97 + i) : i);
  taken.add(k);
  return k;
}

/* ---- BibTeX : un type par genre ; le site devient la revue, l'ouvrage, l'éditeur, l'école ou l'institution ---- */
const BIB = { article: ["article", "journal"], livre: ["book", "publisher"], chapitre: ["incollection", "booktitle"], actes: ["inproceedings", "booktitle"],
  thèse: ["phdthesis", "school"], rapport: ["techreport", "institution"], notice: ["incollection", "booktitle"] };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const TEX = { "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_", "^": "\\^{}", "~": "\\textasciitilde{}" };
export const texEscape = s => String(s || "").replace(/[\\{}&%$#_^~]/g, c => TEX[c]);
/* Un titre : les mots porteurs de majuscules, après le premier, entre accolades, pour qu'un style ne les abaisse pas
   (« Paris », « DNA »). */
const bibTitle = t => t.split(" ").map((w, i) => i && /\p{Lu}/u.test(w) ? `{${texEscape(w)}}` : texEscape(w)).join(" ");
const bibName = n => n.literal ? `{${texEscape(n.literal)}}` : `${texEscape(n.family)}, ${texEscape(n.given)}`;
const iso = p => p.map((v, i) => i ? String(v).padStart(2, "0") : String(v).padStart(4, "0")).join("-");
export function sourcesBibtex(entries, dicts = []) {
  const taken = new Set();
  return entries.map(e => {
    const r = read(e, dicts), [type, place] = BIB[r.kind] || ["misc", "howpublished"], f = [];
    if (r.names.length) f.push(["author", [...r.names.map(bibName), ...(r.others ? ["others"] : [])].join(" and ")]);
    if (r.title) f.push(["title", bibTitle(r.title)]);
    if (r.site) f.push([place, texEscape(r.site)]);
    if (r.date) { f.push(["year", String(r.date[0])]); if (r.date[1] >= 1 && r.date[1] <= 12) f.push(["month", MONTHS[r.date[1] - 1], true]); }
    if (r.doi) f.push(["doi", r.doi]);
    if (r.url) f.push(["url", r.url]);
    if (r.kept && r.url) f.push(["urldate", iso(r.kept)]); // consultée le : seulement pour ce qui se lit à une adresse
    if (r.abstract) f.push(["abstract", texEscape(r.abstract)]);
    // Une adresse ou un DOI n'est pas échappé (le paquet url les lit tels quels) ; une accolade y casserait l'entrée.
    const lines = f.map(([k, v, bare]) => `  ${k} = ${bare ? v : `{${/^(doi|url)$/.test(k) ? v.replace(/[{}]/g, encodeURIComponent) : v}}`}`);
    return [`@${type}{${citeKey(r, taken)},`, ...(lines.length ? [lines.join(",\n")] : []), "}"].join("\n");
  }).join("\n\n") + (entries.length ? "\n" : "");
}

/* ---- CSL-JSON : le format des styles CSL (Zotero, Zettlr, Pandoc, Mendeley) ---- */
const CSL = { article: ["article-journal", "container-title"], livre: ["book", "publisher"], chapitre: ["chapter", "container-title"],
  prépublication: ["article", "publisher"], actes: ["paper-conference", "container-title"], thèse: ["thesis", "publisher"], rapport: ["report", "publisher"],
  notice: ["entry-encyclopedia", "container-title"], page: ["webpage", "container-title"], vidéo: ["motion_picture", "publisher"], podcast: ["broadcast", "container-title"] };
export function sourcesCsl(entries, dicts = []) {
  const taken = new Set();
  return entries.map(e => {
    const r = read(e, dicts), [type, place] = CSL[r.kind] || ["document", "publisher"];
    const it = { id: citeKey(r, taken), type };
    if (r.title) it.title = r.title;
    if (r.names.length) it.author = r.names; // « et al. » n'a pas d'équivalent : les auteurs connus seulement
    if (r.site) it[place] = r.site;
    if (r.date) it.issued = { "date-parts": [r.date] };
    if (r.doi) it.DOI = r.doi;
    if (r.url) it.URL = r.url;
    if (r.kept && r.url) it.accessed = { "date-parts": [r.kept] };
    if (r.abstract) it.abstract = r.abstract;
    return it;
  });
}
export const sourcesCslJson = (entries, dicts) => JSON.stringify(sourcesCsl(entries, dicts), null, 2) + "\n";
