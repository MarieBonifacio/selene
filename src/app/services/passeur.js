/* Passeur : ce que le navigateur ne peut pas lire seul (version hébergée, connectée).
   Les flux RSS, la plupart des pages et les calendriers n'envoient pas d'en-tête CORS : la page ne peut pas lire leur
   réponse. Le passeur (supabase/functions/passeur, docs/passeur.md) va les chercher pour toi seule, avec ta session.
   Ici : l'appel, et la lecture d'une page (métadonnées, flux annoncés), faite par DOMParser, qui n'exécute rien. */
import { hosted } from "../../platform.js";
import { clip, findDoi, normalizeUrl } from "../../core/sources.js";
import { CLICK } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { tr } from "../i18n/index.js";
import { serverError, serverMsg } from "./erreurs.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authReady, authRefreshIfNeeded, authSession } from "./auth.js";
import { render } from "../shell/render.js";

export let passeurEtat = "";
export const passeurReset = () => { passeurEtat = ""; }; // redemander, après un refus ou une absence // "" inconnu, "ok", "absent" (non déployé ou non configuré : on n'insiste pas), ou un message
export const passeurPret = () => hosted() && authReady() && !!authSession && passeurEtat !== "absent";
export async function passeurFetch(url, genre, cond = {}) {
  if (!hosted() || !authReady() || !authSession) throw new Error(tr`Le passeur n'existe que dans la version hébergée, connectée à ton compte.`);
  const s = await authRefreshIfNeeded(); if (!s) throw new Error(tr`Session expirée : reconnecte-toi.`);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/passeur`, { method: "POST", signal: ac.signal,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}` },
      body: JSON.stringify({ url, genre, ...(cond.etag ? { etag: cond.etag } : {}), ...(cond.modifie ? { modifie: cond.modifie } : {}) }) });
  } catch { throw new Error(tr`Passeur injoignable (hors ligne, ou pas encore déployé).`); } finally { clearTimeout(t); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 404 || r.status === 503) { passeurEtat = "absent"; throw r.status === 404 ? new Error(tr`Passeur non déployé (voir docs/passeur.md).`) : serverError(j, tr`Passeur non configuré.`); }
  if (r.status === 401 || r.status === 403) { passeurEtat = serverMsg(j, tr`refusé`); throw Object.assign(new Error(tr`Passeur : ${serverMsg(j, tr`accès refusé`)}.`), { code: j.code || "" }); }
  if (!r.ok) throw Object.assign(new Error(tr`Passeur : ${serverMsg(j, tr`erreur ${r.status}`)}.`), { code: j.code || "" });
  passeurEtat = "ok";
  return j;
}
/* L'adresse canonique annoncée par une page, seulement si elle reste sur le même site (une page ne décide pas
   qu'elle est un article d'ailleurs). */
function sameSite(u, base) {
  const h = x => { try { return new URL(x).hostname.replace(/^www\./, ""); } catch { return null; } };
  return u && h(u) && h(u) === h(base) ? normalizeUrl(u) : "";
}
/* Une page HTML → les champs d'une source, et les flux qu'elle annonce. Ordre de confiance : les balises des revues
   savantes (citation_*), OpenGraph, JSON-LD, puis le reste. Tout est du texte : rien n'est inséré tel quel. */
export function pageToSource(html, base) {
  const d = new window.DOMParser().parseFromString(String(html || ""), "text/html");
  const metas = n => [...d.querySelectorAll("meta")].filter(m => (m.getAttribute("property") || m.getAttribute("name") || "").toLowerCase() === n).map(m => (m.getAttribute("content") || "").trim()).filter(Boolean);
  const meta = (...ns) => { for (const n of ns) { const v = metas(n)[0]; if (v) return v; } return ""; };
  const abs = h => { try { const u = new URL(h, base); return /^https?:$/.test(u.protocol) ? u.toString() : ""; } catch { return ""; } };
  let ld = {};
  for (const s of d.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent), all = [].concat(j, ...(Array.isArray(j) ? j : [j]).map(x => (x && x["@graph"]) || []));
      const hit = all.find(x => x && /Article|BlogPosting|Report|Thesis|Book|Chapter|VideoObject/.test([].concat(x["@type"] || []).join(" ")));
      if (hit) { ld = hit; break; }
    } catch {}
  }
  const ldName = v => [].concat(v || []).map(a => typeof a === "string" ? a : a && a.name).filter(x => typeof x === "string");
  const day = v => { const m = String(v || "").replace(/\//g, "-").match(/^(\d{4})(-\d{2})?(-\d{2})?/); return m ? m[0] : ""; };
  const authors = metas("citation_author").length ? metas("citation_author") : ldName(ld.author).length ? ldName(ld.author) : [meta("author")].filter(Boolean);
  const doi = findDoi(meta("citation_doi", "dc.identifier", "prism.doi")) || findDoi(base) || null;
  let host = ""; try { host = new URL(base).hostname.replace(/^www\./, ""); } catch {}
  const feeds = [...d.querySelectorAll('link[rel~="alternate"]')].filter(l => /(rss|atom)\+xml|feed\+json/i.test(l.getAttribute("type") || ""))
    .map(l => ({ url: abs(l.getAttribute("href") || ""), title: clip(l.getAttribute("title") || "", 120) })).filter(f => f.url).slice(0, 5);
  const og = meta("og:type");
  return {
    title: clip(meta("citation_title", "og:title", "twitter:title") || ld.headline || ld.name || (d.querySelector("title") || {}).textContent || base, 300),
    authors: clip(authors.length > 3 ? authors.slice(0, 3).join(", ") + " et al." : authors.join(", "), 200),
    site: clip(meta("citation_journal_title", "og:site_name") || ldName(ld.publisher)[0] || host, 200),
    date: day(meta("citation_publication_date", "citation_date", "article:published_time", "dc.date", "date") || ld.datePublished),
    kind: doi ? "article" : /video/.test(og) || ld["@type"] === "VideoObject" ? "vidéo" : "page",
    doi, url: sameSite(abs(meta("og:url")), base) || sameSite(abs((d.querySelector('link[rel="canonical"]') || { getAttribute: () => "" }).getAttribute("href") || ""), base) || normalizeUrl(base),
    abstract: clip(meta("citation_abstract", "og:description", "description", "twitter:description") || ld.description || "", 1200), feeds
  };
}
/* Réglages → Passeur : son état, ton identifiant (pour le secret PASSEUR_USERS), une vérification à la demande. */
export function passeurSettingsHTML() {
  const st = passeurEtat === "ok" ? tr`Déployé et ouvert à ton compte.` : passeurEtat === "absent" ? tr`Pas encore déployé, ou pas encore configuré.` : passeurEtat ? tr`Refusé : ${passeurEtat}.` : tr`Pas encore vérifié sur cet appareil.`;
  return `<section id="passeur"><h4>${tr`Passeur`}</h4><p class="hint">${tr`Une petite fonction dans ton projet Supabase qui lit pour toi les pages, flux et calendriers que le navigateur ne peut pas lire seul. Elle ne sert que ton compte, refuse toute adresse privée et ne garde rien. Sans elle, les pages passent par Microlink.`}</p>
    <p class="row" style="margin:0 0 8px"><span data-passeur-etat>${esc(st)}</span><button class="btn sm" data-act="passeur-check">${tr`Vérifier`}</button></p>
    <p class="hint">${tr`Ton identifiant, à mettre dans le secret ${"<code>PASSEUR_USERS</code>"} : ${`<code style="word-break:break-all">${esc(authSession.user.id)}</code> <button class="btn ghost sm" data-act="passeur-copy">${tr`copier`}</button>`}. Mode d'emploi : ${`<a href="https://github.com/MarieBonifacio/selene/blob/main/docs/passeur.md" target="_blank" rel="noopener noreferrer">docs/passeur.md</a>`}.`}</p></section>`;
}
/* Réglages → Passeur (passeur.js) : vérifier en lisant la page de Selene elle-même, copier l'identifiant. */
CLICK["passeur-check"] = async el => {
  el.disabled = true; passeurReset();
  try { await passeurFetch(location.origin + location.pathname, "page"); toast(tr`Passeur : il répond, et il te reconnaît.`); }
  catch (e) { toast(e.message); }
  render();
};
CLICK["passeur-copy"] = async () => {
  try { await navigator.clipboard.writeText(authSession.user.id); toast(tr`Identifiant copié.`); } catch { toast(tr`Copie impossible ici : sélectionne-le à la main.`); }
};
