/* Dehors, la lecture : un flux (RSS, Atom, JSON Feed) lu sans rien exécuter, le cache fusionné, « nouveau depuis »,
   croisé avec ce que tu gardes. */
import { clip } from "../../core/sources.js";
import { tr } from "../i18n/index.js";

/* Dehors : lire un flux, dire ce qui est nouveau (sans réseau).
   RSS 2.0, RSS 1.0 (RDF), Atom et JSON Feed, lus par DOMParser en XML (rien ne s'exécute) ou JSON.parse.
   Le réseau (le passeur), le cache de l'appareil et l'interface sont dans features/dehors.js ; la validation, dans backup.js. */
const DEHORS_MAX = 12; // éléments montrés au plus : au-delà, ils attendent
const DEHORS_DAYS = 30; // un élément non gardé s'efface du cache de l'appareil au bout d'un mois
/* Du HTML (résumé d'un flux) → du texte : parsé comme document inerte, jamais inséré. */
const feedText = (s, n) => { const d = new window.DOMParser().parseFromString(`<body>${String(s || "")}</body>`, "text/html"); return clip(d.body.textContent || "", n); };
const feedDate = v => { const t = Date.parse(String(v || "").trim()); return Number.isFinite(t) ? new Date(t).toISOString() : ""; };
const feedLink = (h, base) => { try { const u = new URL(String(h || "").trim(), base); return /^https?:$/.test(u.protocol) ? u.toString() : ""; } catch { return ""; } };
/* Un flux (texte) → { title, items: [{ id, title, link, date, text }] } ; null si ce n'en est pas un. */
export function parseFeed(text, base) {
  const t = String(text || "").replace(/^﻿/, "").trim();
  const item = (id, title, link, date, body) => { const l = feedLink(link, base), ti = clip(feedText(title, 300) || l, 300); return ti ? { id: clip(String(id || l || ti), 300), title: ti, link: l, date: feedDate(date), text: feedText(body, 400) } : null; };
  if (t.startsWith("{")) {
    let j; try { j = JSON.parse(t); } catch { return null; }
    if (!j || !Array.isArray(j.items) || !/jsonfeed/.test(String(j.version || ""))) return null;
    return { title: clip(j.title || "", 200), items: j.items.slice(0, 100).map(x => x && item(x.id, x.title || x.summary, x.url || x.external_url, x.date_published || x.date_modified, x.summary || x.content_text || x.content_html)).filter(Boolean) };
  }
  const d = new window.DOMParser().parseFromString(t, "application/xml");
  if (d.querySelector("parsererror")) return null;
  const root = d.documentElement, name = root.localName.toLowerCase();
  const kid = (el, ...ns) => { for (const n of ns) { const c = [...el.children].find(x => x.localName === n || x.nodeName === n); if (c) return c; } return null; };
  const txt = (el, ...ns) => { const c = kid(el, ...ns); return c ? c.textContent.trim() : ""; };
  if (name === "feed") { // Atom
    const alt = e => { const ls = [...e.children].filter(x => x.localName === "link"); const l = ls.find(x => (x.getAttribute("rel") || "alternate") === "alternate") || ls[0]; return l ? l.getAttribute("href") : ""; };
    return { title: clip(txt(root, "title"), 200), items: [...root.children].filter(x => x.localName === "entry").slice(0, 100)
      .map(e => item(txt(e, "id"), txt(e, "title"), alt(e), txt(e, "published", "updated"), txt(e, "summary", "content"))).filter(Boolean) };
  }
  if (name === "rss" || name === "rdf") { // RSS 2.0 (items dans channel) ou 1.0 (items à côté)
    const ch = kid(root, "channel") || root, items = [...(name === "rss" ? ch.children : root.children)].filter(x => x.localName === "item");
    return { title: clip(txt(ch, "title"), 200), items: items.slice(0, 100)
      .map(e => item(txt(e, "guid") || e.getAttribute("rdf:about"), txt(e, "title"), txt(e, "link"), txt(e, "pubDate", "date", "dc:date", "published", "updated"), txt(e, "description", "encoded", "content:encoded", "summary"))).filter(Boolean) };
  }
  return null;
}
/* Fusionne une lecture dans le cache d'un flux : un élément déjà vu garde sa date de première vue (first). */
export function feedMerge(old, items, now) {
  const seen = new Map((old || []).map(x => [x.id, x])), out = [];
  for (const x of items) out.push({ ...x, first: (seen.get(x.id) || {}).first || now });
  for (const x of old || []) if (!out.some(y => y.id === x.id)) out.push(x);
  const limit = now - DEHORS_DAYS * 86400000;
  return out.filter(x => x.first >= limit).slice(0, 50);
}
/* L'instant d'un élément : sa date publiée (jamais dans le futur), sinon quand on l'a vu pour la première fois. */
const feedTime = (x, now) => { const t = x.date ? Date.parse(x.date) : NaN; return Number.isFinite(t) ? Math.min(t, now) : x.first; };
/* Le nouveau, tous flux confondus : postérieur au « vu jusqu'à » de son flux, pas écarté sur cet appareil, et, si le
   flux le demande, touchant un motif. Puis croisé avec ce que tu gardes, et dit en clair (pertinence explicable) :
   - `test` : texte → noms des motifs qu'il touche ;
   - `key` : élément → clé (DOI, adresse) ; le même lien paru dans deux flux n'apparaît qu'une fois, « aussi dans » l'autre ;
   - `why` : (élément, flux) → d'autres raisons, en toutes lettres (un auteur de tes sources, une de tes sources citée).
   Ce qui a au moins une raison passe devant, le plus de raisons d'abord ; à égalité, le plus récent. `max` au plus. */
export function dehorsNew(feeds, cache, hidden, now, { test = null, key = null, why = null, max = DEHORS_MAX } = {}) {
  const all = [], byKey = new Map();
  for (const f of feeds) {
    const c = cache[f.id]; if (!c || !Array.isArray(c.items)) continue;
    for (const x of c.items) {
      const t = feedTime(x, now), k = key ? key(x) : null;
      if (t <= (f.seen || 0) || hidden.has(`${f.id}|${x.id}`) || (k && hidden.has(`k|${k}`))) continue;
      const motifs = test ? test(`${x.title} ${x.text}`) : [];
      if (f.motifs && test && !motifs.length) continue;
      if (k && byKey.has(k)) { const o = byKey.get(k); if (o.f.title !== f.title && !o.also.includes(f.title)) o.also.push(f.title); continue; }
      const it = { f, x, t, k, motifs, also: [], extra: why ? why(x, f) : [] };
      if (k) byKey.set(k, it);
      all.push(it);
    }
  }
  for (const it of all) it.why = [...(it.motifs.length ? [tr`motif : ${it.motifs.join(", ")}`] : []), ...(it.also.length ? [tr`aussi dans ${it.also.join(", ")}`] : []), ...it.extra];
  all.sort((a, b) => b.why.length - a.why.length || b.t - a.t);
  return { items: all.slice(0, max), total: all.length };
}
