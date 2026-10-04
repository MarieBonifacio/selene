/* ================= markdown : venir d'Obsidian ou de Zettlr (pur, sans DOM ni réseau) =================
   Entrer avec son passé (idée 1 de l'audit) : des fichiers Markdown, un par note, deviennent des notes datées. On lit
   ce que ces outils écrivent eux-mêmes : l'en-tête YAML (« front-matter » : title, date, created, statut ou status,
   aliases, id), le premier titre « # », le nom du fichier, et les liens [[…]] d'une note à l'autre. Rien n'est
   inventé : sans date lisible, la date du fichier ; sans statut, aucun. La lecture des fichiers et l'écriture des
   notes sont dans modules/notes.js. Se teste seul (tests/markdown.test.js). */

export const MD_NOTE_MAX = 20000; // au-delà, la note est coupée (et comptée comme telle)
const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const EP = { obs: ["obs", "observe", "observed", "observation"], hyp: ["hyp", "hypothese", "hypothesis"], int: ["int", "interpretation"], inx: ["inx", "inexplique", "unexplained"] };
const epOf = v => { const t = fold(v); return Object.keys(EP).find(k => EP[k].includes(t)) || null; };
const validDay = (y, m, d) => { const dt = new Date(Date.UTC(+y, +m - 1, +d)); return +y >= 1900 && +y <= 2100 && dt.getUTCMonth() === +m - 1 && dt.getUTCDate() === +d; };
const dayOf = v => { const m = String(v || "").match(/^\s*["']?(\d{4})-(\d{2})-(\d{2})/); return m && validDay(m[1], m[2], m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null; };
/* Une date dans un nom de fichier : « 2023-10-04 Lecture », ou l'identifiant d'un Zettelkasten (« 202310041530 »). */
const dayInName = n => { const m = String(n || "").match(/(?:^|[^\d])(\d{4})-?(\d{2})-?(\d{2})(?:\d{2,6})?(?![\d])/); return m && validDay(m[1], m[2], m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null; };
const localDay = ms => { if (!Number.isFinite(ms) || ms <= 0) return null; const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/* L'en-tête YAML, juste assez : « clé: valeur », valeurs entre guillemets, listes [a, b] ou en lignes « - a ». */
export function frontMatter(src) {
  const s = String(src || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = s.match(/^---\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/);
  if (!m) return { data: {}, body: s };
  const data = {}, unq = v => v.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  let list = null;
  for (const line of m[1].split("\n")) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && list) { data[list].push(unq(item[1])); continue; }
    const kv = line.match(/^([^:#\s][^:]*):\s*(.*)$/);
    if (!kv) { list = null; continue; }
    const k = fold(kv[1]), v = kv[2].trim();
    if (!v) { data[k] = []; list = k; continue; }
    list = null;
    data[k] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(",").map(unq).filter(Boolean) : unq(v);
  }
  return { data, body: s.slice(m[0].length) };
}
const first = v => Array.isArray(v) ? v[0] : v;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|pdf|mp3|mp4|webm|mov)$/i;
/* Un fichier → une note : { title, text, date, ep, keys, links } ; null s'il est vide. `keys` : ce qui la désigne dans
   un lien [[…]] (titre, nom de fichier, alias, identifiant Zettlr) ; `links` : ce qu'elle désigne. */
export function mdNote(file) {
  const { data, body: raw } = frontMatter(file && file.text);
  const base = String((file && (file.name || file.path)) || "").replace(/^.*[\\/]/, "").replace(/\.(md|markdown|txt)$/i, "");
  let body = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/%%[\s\S]*?%%/g, ""); // commentaires HTML et Obsidian
  const h1 = body.match(/^\s*#\s+(.+?)\s*#*\s*$/m), title = String(first(data.title) || (h1 && h1[1]) || base).replace(/\s+/g, " ").trim();
  if (h1 && h1[1].trim() === title && !body.slice(0, h1.index).trim()) body = body.slice(h1.index + h1[0].length);
  const links = [];
  // [[cible#titre|alias]] → l'alias, sinon la cible ; une image ou un fichier intégré (![[…]]) disparaît.
  body = body.replace(/(!?)\[\[([^\]|#\n]*)(#[^\]|\n]*)?(?:\|([^\]\n]*))?\]\]/g, (_, bang, target, head, alias) => {
    const t = target.trim();
    if (bang && IMAGE.test(t)) return "";
    if (t) links.push(fold(t.replace(/^.*[\\/]/, "").replace(/\.(md|markdown)$/i, "")));
    return (alias || t || (head || "").slice(1)).trim();
  });
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  if (!title && !body) return null;
  let text = body ? `${title}\n\n${body}` : title, cut = false;
  if (text.length > MD_NOTE_MAX) { text = text.slice(0, MD_NOTE_MAX - 1).trimEnd() + "…"; cut = true; }
  const aliases = [].concat(data.aliases || data.alias || []).map(String);
  const keys = [...new Set([title, base, ...aliases, first(data.id) || ""].map(fold).filter(Boolean))];
  return { title, text, cut, ep: epOf(first(data.statut ?? data.status ?? data.ep ?? data["statut epistemique"])),
    date: dayOf(first(data.date ?? data.created ?? data.creation ?? data["date created"])) || dayInName(base) || localDay(file && file.modified),
    keys, links: [...new Set(links)] };
}
/* Des fichiers → les notes à créer, dans l'ordre des dates, et les liens entre elles (indices). Les dossiers de
   configuration (.obsidian, .trash, .git) et ce qui n'est pas du Markdown sont laissés ; deux fichiers au même texte
   n'en font qu'un. `known` : les textes des notes déjà là ; un lien vers l'une d'elles (par sa première ligne, le
   titre d'un import précédent) va dans `knownLinks` ([note, indice dans known]). */
export function mdImport(files, known = []) {
  const notes = [], seen = new Set();
  let skipped = 0;
  for (const f of files || []) {
    const path = String((f && (f.path || f.name)) || "");
    if (!/\.(md|markdown)$/i.test(path) || /(^|[\\/])\.(obsidian|trash|git)([\\/]|$)/.test(path)) { skipped++; continue; }
    const n = mdNote(f);
    if (!n || seen.has(n.text)) { skipped++; continue; }
    seen.add(n.text); notes.push(n);
  }
  notes.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const byKey = new Map();
  notes.forEach((n, i) => { for (const k of n.keys) if (!byKey.has(k)) byKey.set(k, i); });
  const byKnown = new Map();
  known.forEach((t, k) => { const key = fold(String(t || "").split("\n")[0]); if (key && !byKnown.has(key)) byKnown.set(key, k); });
  const links = [], knownLinks = [];
  notes.forEach((n, i) => {
    for (const k of n.links) {
      const j = byKey.get(k);
      if (j != null) { if (j !== i && !links.some(l => l[0] === i && l[1] === j)) links.push([i, j]); continue; }
      const x = byKnown.get(k);
      if (x != null && !knownLinks.some(l => l[0] === i && l[1] === x)) knownLinks.push([i, x]);
    }
  });
  return { notes, links, knownLinks, skipped };
}
