/* Dehors, la seule porte vers le dehors : flux suivis, veille de recherche (OpenAlex), artistes suivis ; ce qui est
   nouveau, et pourquoi. */
import { hosted, platform } from "../../platform.js";
import { inboxId, saveCollectionItem } from "../../core/domain.js";
import { mbAlbums, mbSince } from "../../core/musique.js";
import { clip, findDoi, normalizeUrl, sourceKey } from "../../core/sources.js";
import { oaUrl, oaWatch, oaWorks } from "../../core/veille.js";
import { CHANGE, CLICK, VIEWS } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { addDaysTo, fmt, todayISO, uid } from "../lib/format.js";
import { citeOwn, citeSources } from "./cites.js";
import { motifsOf } from "./concordance.js";
import { dehorsNew, feedMerge, parseFeed } from "./dehors-feed.js";
import { excerpt, sourceItems } from "./links.js";
import { MB_SEEN, mbFetch } from "./musique.js";
import { findSourceDup, keepSource, pubDate, sourcesModule } from "./sources.js";
import { addNote } from "../modules/notes.js";
import { hm } from "../scene/sky.js";
import { authReady, authSession } from "../services/auth.js";
import { pageToSource, passeurEtat, passeurFetch, passeurPret } from "../services/passeur.js";
import { SYSTEM, routeOf } from "../shell/nav.js";
import { memoInRender, render } from "../shell/render.js";
import { S, enabled, label, site } from "../state/site.js";
import { ask } from "../ui/dialogs.js";
import { fold } from "../views/recherche.js";

/* Dehors : la seule porte vers le dehors (dehors-feed.js pour la lecture des flux).
   Une vue qu'on ouvre, jamais poussée : le nouveau depuis ta dernière visite, douze au plus, par projet. Les flux
   suivis et leur « vu jusqu'à » sont synchronisés (quelques octets, config.dehors) ; ce qu'ils contiennent reste sur
   l'appareil (cache, un mois). Les flux sont relus par le passeur, un par un, en GET conditionnel, au plus toutes
   les trois heures, à l'ouverture ou sur demande. */
const DEHORS_KEY = "selene-dehors";
export const dehorsFeeds = () => (S().config.dehors && Array.isArray(S().config.dehors.feeds) ? S().config.dehors.feeds : []);
const dehorsConf = () => S().config.dehors || {};
/* Écrit la configuration de Dehors en gardant le reste (flux, Artist Watch) ; vide, elle disparaît. */
export function dehorsSet(patch) {
  const d = { ...dehorsConf(), feeds: dehorsFeeds(), ...patch };
  if (!d.artists) { delete d.artists; delete d.artistsSeen; }
  if (!Array.isArray(d.research) || !d.research.length) delete d.research;
  if (!d.feeds.length && !d.artists && !d.research) delete S().config.dehors; else S().config.dehors = d;
  site.save();
}
/* Research Watch (veille.js) : des recherches et des auteurs, relus une fois par semaine ; la clé OpenAlex, facultative,
   reste sur l'appareil (jamais synchronisée, effacée à la déconnexion). */
const OA_KEY = "selene-openalex-key";
export const oaKey = () => platform.secrets.get(OA_KEY) || "";
export const dehorsResearch = () => (Array.isArray(dehorsConf().research) ? dehorsConf().research : []);
/* Artist Watch : un flux de plus, fabriqué ici (MusicBrainz, sans passeur), rangé sous le premier module de musique. */
const MB_WATCH = "mb-artists";
const musicMods = () => Object.keys(S().modules).filter(k => enabled(k) && S().modules[k].type === "collection" && S().modules[k].config.music);
function watchedArtists() {
  const m = new Map();
  for (const k of musicMods()) for (const e of S().modules[k].entries) if (e.mb && e.mb.a) { m.delete(e.mb.a); m.set(e.mb.a, { name: e.title, mod: k }); }
  return [...m].slice(-30); // trente au plus, les plus récemment ajoutés : trente secondes de MusicBrainz, une fois par semaine
}
const dehorsAll = () => [...dehorsFeeds(), ...(dehorsConf().artists ? [{ id: MB_WATCH, title: "Sorties de tes artistes", mod: musicMods()[0] || "", seen: dehorsConf().artistsSeen || 0, watch: true }] : []),
  ...dehorsResearch().map(r => ({ id: "oa-" + r.id, title: `Veille : ${r.name || r.q}`, mod: r.mod || "", seen: r.seen || 0, research: r }))];
export const dehorsOn = () => hosted() && authReady() && !!authSession;
function dehorsCache() {
  try { const c = JSON.parse(platform.storage.get(DEHORS_KEY) || "null"); if (c && typeof c === "object" && c.feeds && typeof c.feeds === "object") return { at: +c.at || 0, feeds: c.feeds, hidden: Array.isArray(c.hidden) ? c.hidden : [] }; } catch {}
  return { at: 0, feeds: {}, hidden: [] };
}
function dehorsStore(c) {
  const ids = new Set(dehorsAll().map(f => f.id));
  for (const k of Object.keys(c.feeds)) if (!ids.has(k)) delete c.feeds[k]; // un flux retiré emporte son cache
  c.hidden = c.hidden.slice(-500);
  try { platform.storage.set(DEHORS_KEY, JSON.stringify(c)); } catch {}
}
const dehorsTest = () => memoInRender("dehorsTest", () => text => motifsOf(text).map(({ e }) => e.title));
/* Motifs croisés : ce qui, dans le nouveau, rejoint ce que tu gardes déjà, dit en toutes lettres (dehorsNew). */
const dehorsKey = x => (x.oa && x.oa.doi ? "doi:" + x.oa.doi : sourceKey({ url: x.link, doi: findDoi(x.link) }));
/* Les auteurs de tes Sources (leur sous-titre), repliés : deux mots au moins, pour qu'un « Collectif » ne croise pas tout. */
const sourceAuthors = () => memoInRender("sourceAuthors", () => {
  const m = new Map();
  for (const { e } of sourceItems()) for (const n of String(e.subtitle || "").split(/[,;]| et (?!al\b)/)) { const t = n.replace(/\bet al\.?/i, "").trim(); if (t.length <= 80 && t.split(/\s+/).length >= 2) m.set(fold(t), t); }
  return m;
});
function dehorsWhy(x, f) {
  const r = [];
  if (x.oa && !(f.research && f.research.kind === "author")) { // un auteur suivi est, par construction, l'auteur de tout ce que sa veille apporte
    const A = sourceAuthors(), hit = String(x.oa.authors || "").replace(/ et al\.$/, "").split(", ").map(n => n.trim()).filter(n => A.has(fold(n)));
    if (hit.length) r.push(`auteur${hit.length > 1 ? "s" : ""} de tes sources : ${hit.join(", ")}`);
  }
  if (x.oa && Array.isArray(x.oa.cites) && x.oa.cites.length) {
    const srcs = citeSources(), names = x.oa.cites.map(d => srcs.get(d)).filter(Boolean).map(s => `« ${excerpt(s.e, 50)} »`);
    if (names.length) r.push(`cite ${names.join(", ")}, de tes sources`);
  }
  return r;
}
function dehorsNow() { const c = dehorsCache(); return dehorsNew(dehorsAll(), c.feeds, new Set(c.hidden), Date.now(), { test: dehorsTest(), key: dehorsKey, why: dehorsWhy }); }
let dehorsBusy = false;
export async function dehorsRefresh(force = false) {
  if (dehorsBusy || !dehorsOn() || document.visibilityState !== "visible") return;
  const feeds = dehorsFeeds(), due = feeds.length && passeurPret() && (force || Date.now() - dehorsCache().at >= 3 * 3600000);
  const watchDue = dehorsConf().artists && (force || Date.now() - ((dehorsCache().feeds[MB_WATCH] || {}).at || 0) >= 7 * 86400000);
  const research = dehorsResearch().filter(r => force || Date.now() - ((dehorsCache().feeds["oa-" + r.id] || {}).at || 0) >= 7 * 86400000);
  if (!due && !watchDue && !research.length) return;
  dehorsBusy = true; if (routeOf().view === "dehors") render();
  try {
    if (due) {
      for (const f of feeds) {
        const c = dehorsCache(), fc = c.feeds[f.id] || { items: [] };
        try {
          const r = await passeurFetch(f.url, "feed", { etag: fc.etag, modifie: fc.modifie });
          if (r.status === 304) fc.err = "";
          else if (r.status >= 200 && r.status < 300 && typeof r.texte === "string") {
            const pf = parseFeed(r.texte, r.url || f.url);
            if (!pf) fc.err = "ce n'est plus un flux lisible";
            else { fc.items = feedMerge(fc.items, pf.items, Date.now()); fc.etag = r.etag || ""; fc.modifie = r.modifie || ""; fc.err = ""; }
          } else fc.err = r.erreur || `le site répond ${r.status}`;
        } catch (e) { fc.err = e.message; }
        fc.at = Date.now(); c.feeds[f.id] = fc; dehorsStore(c);
        if (passeurEtat === "absent") break;
      }
      const c = dehorsCache(); c.at = Date.now(); dehorsStore(c);
    }
    if (watchDue) await artistWatch();
    for (const r of research) await researchWatch(r);
  } finally { dehorsBusy = false; render(); }
}
/* Une veille : ce qui est paru depuis la dernière relecture (la première fois, le mois écoulé). Comme les sorties
   d'artistes, un article compte à partir de sa découverte (OpenAlex indexe avec retard) ; sa date reste affichée. */
async function researchWatch(r) {
  const c0 = dehorsCache(), fc = c0.feeds["oa-" + r.id] || { items: [] };
  const since = fc.at ? new Date(fc.at - 14 * 86400000).toISOString().slice(0, 10) : addDaysTo(todayISO(), -30);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(oaUrl(r, since, oaKey()), { signal: ac.signal });
    if (res.status === 429) fc.err = "quota du jour atteint (une clé OpenAlex gratuite le décuple)";
    else if (!res.ok) fc.err = `OpenAlex répond ${res.status}`;
    else {
      const own = citeOwn(); // tes sources connues d'OpenAlex (W… → DOI), si « ce que tes sources ont en commun » a déjà tourné
      const got = oaWorks(await res.json()).map(({ refs, ...x }) => { const cites = [...new Set((refs || []).filter(w => own.has(w)).map(w => own.get(w)))].slice(0, 5);
        return { ...x, oa: { ...x.oa, ...(cites.length ? { cites } : {}) }, text: [x.oa.day && pubDate(x.oa.day), x.text].filter(Boolean).join(" · ") }; });
      fc.items = feedMerge(fc.items, got, Date.now()); fc.err = "";
    }
  } catch { fc.err = "OpenAlex injoignable"; } finally { clearTimeout(t); }
  fc.at = Date.now(); const c = dehorsCache(); c.feeds["oa-" + r.id] = fc; dehorsStore(c);
}
/* Artist Watch : pour chaque artiste relié, ce qu'il a publié depuis la dernière vérification (la même mémoire que
   « Nouvelles sorties », selene-mb-seen ; la première fois, le mois écoulé). Ces éléments comptent à partir du jour où
   on les découvre, pas de leur date de parution : MusicBrainz enregistre souvent une sortie après coup. */
async function artistWatch() {
  const artists = watchedArtists(); if (!artists.length) return;
  let seen = {}; try { seen = JSON.parse(platform.storage.get(MB_SEEN) || "{}") || {}; } catch {}
  const today = todayISO(), got = []; let failed = 0;
  for (const [aid, a] of artists) {
    const j = await mbFetch(`/release-group?artist=${aid}&type=album|ep&limit=100`).catch(() => null);
    if (!j) { failed++; continue; }
    for (const al of mbSince(mbAlbums(j), seen[aid] || addDaysTo(today, -30)))
      got.push({ id: al.id, title: `${a.name} — ${al.title}`, link: `https://musicbrainz.org/release-group/${al.id}`, date: "", text: [al.type, pubDate(al.date)].filter(Boolean).join(" · "),
        mb: { a: aid, rg: al.id, ...(al.date ? { y: al.date.slice(0, 4) } : {}), artist: a.name, album: al.title, mod: a.mod } });
    seen[aid] = today;
  }
  try { platform.storage.set(MB_SEEN, JSON.stringify(seen)); } catch {}
  const c = dehorsCache(), fc = c.feeds[MB_WATCH] || { items: [] };
  fc.items = feedMerge(fc.items, got, Date.now()); fc.at = Date.now(); fc.err = failed ? `${failed} artiste${failed > 1 ? "s" : ""} sans réponse de MusicBrainz` : "";
  c.feeds[MB_WATCH] = fc; dehorsStore(c);
}
/* Suivre un flux : l'adresse d'un flux, ou d'un site dont la page annonce son flux (découverte). */
async function dehorsFind(raw) {
  const url = normalizeUrl(raw) || normalizeUrl("https://" + String(raw).replace(/^\/+/, ""));
  if (!url) throw new Error("Ce n'est pas une adresse.");
  const r = await passeurFetch(url, "feed");
  if (r.status >= 300 || typeof r.texte !== "string") throw new Error(r.erreur || `Le site répond ${r.status}.`);
  const pf = parseFeed(r.texte, r.url || url);
  if (pf) return { url: r.url || url, title: pf.title, items: pf.items, etag: r.etag, modifie: r.modifie };
  const found = pageToSource(r.texte, r.url || url).feeds[0];
  if (!found) throw new Error("Aucun flux à cette adresse, ni annoncé par la page.");
  const r2 = await passeurFetch(found.url, "feed"), pf2 = r2.status < 300 && typeof r2.texte === "string" ? parseFeed(r2.texte, r2.url || found.url) : null;
  if (!pf2) throw new Error("La page annonce un flux, mais il est illisible.");
  return { url: r2.url || found.url, title: pf2.title || found.title, items: pf2.items, etag: r2.etag, modifie: r2.modifie };
}
async function dehorsFollow(raw, mod) {
  const got = await dehorsFind(raw);
  const feeds = dehorsFeeds();
  if (feeds.some(f => sourceKey({ url: f.url }) === sourceKey({ url: got.url }))) throw new Error("Ce flux est déjà suivi.");
  if (feeds.length >= 100) throw new Error("Cent flux, c'est déjà un kiosque. Retire-en avant d'en ajouter.");
  const f = { id: uid(), url: got.url, title: clip(got.title || new URL(got.url).hostname, 200), mod: mod && Object.hasOwn(S().modules, mod) ? mod : "", seen: Date.now() - 7 * 86400000 };
  dehorsSet({ feeds: [...feeds, f] });
  const c = dehorsCache(); c.feeds[f.id] = { items: feedMerge([], got.items, Date.now()), etag: got.etag || "", modifie: got.modifie || "", err: "", at: Date.now() }; dehorsStore(c);
  return f;
}
/* Sur l'accueil, une ligne de texte, et seulement s'il y a du nouveau : pas de pastille. */
export function dehorsLine() {
  if (!dehorsOn() || !dehorsAll().length) return "";
  const n = dehorsNow().total;
  return n ? `<p class="hint dehors-go"><a href="#dehors">Dehors : ${n} nouveauté${n > 1 ? "s" : ""}</a></p>` : "";
}
export const dehorsWhen = t => { const d = new Date(t), days = Math.round((Date.now() - t) / 86400000); return days < 1 ? `aujourd'hui, ${hm(t)}` : days < 7 ? d.toLocaleDateString("fr-FR", { weekday: "long" }) : fmt(d.toISOString().slice(0, 10)); };
VIEWS.dehors = () => {
  const feeds = dehorsFeeds(), mods = S().config.modules.filter(m => m.on && Object.hasOwn(S().modules, m.id) && !SYSTEM.includes(m.id)).map(m => m.id);
  const head = `<h2>Dehors</h2><p class="hint">Ce qui est paru depuis ta dernière visite, dans les flux que tu suis. Douze au plus : le reste attend, rien ne défile. Ce qui croise ce que tu gardes (un motif, un auteur de tes sources, une de tes sources citée, un lien paru dans deux flux) passe devant, et dit pourquoi. Garde ce qui compte, le reste s'efface en un mois.</p>`;
  if (!dehorsOn()) return head + `<p class="empty">Dehors passe par le passeur : il n'existe que dans la version hébergée, connectée à ton compte.</p>`;
  const cache = dehorsCache(), { items, total } = dehorsNow(), byMod = new Map();
  for (const it of items) { const k = it.f.mod && Object.hasOwn(S().modules, it.f.mod) ? it.f.mod : ""; if (!byMod.has(k)) byMod.set(k, []); byMod.get(k).push(it); }
  const itemHTML = ({ f, x, t, why }) => `<li class="item" data-feed="${esc(f.id)}" data-item="${esc(x.id)}"><span></span><div>
      ${x.link ? `<a class="t-title" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${esc(x.title)} ↗</a>` : `<b>${esc(x.title)}</b>`}
      <div class="meta"><span>${esc(f.title)}</span><span>${esc(dehorsWhen(t))}</span></div>
      ${why.length ? `<p class="why">parce que : ${why.map(esc).join(" · ")}</p>` : ""}
      ${x.text ? `<p class="hint" style="margin:4px 0 0">${esc(x.text)}</p>` : ""}</div>
    <div class="row">${x.mb ? (Object.hasOwn(S().modules, x.mb.mod) && S().modules[x.mb.mod].entries.some(e => e.mb && e.mb.rg === x.mb.rg) ? `<span class="hint">déjà dans ${esc(label(x.mb.mod))}</span>` : Object.hasOwn(S().modules, x.mb.mod) ? `<button class="btn sm" data-act="dehors-mb-add">ajouter à ${esc(label(x.mb.mod))}</button>` : "")
      : sourcesModule() && x.link ? (findSourceDup({ url: x.link, doi: (x.oa && x.oa.doi) || findDoi(x.link) }) ? `<span class="hint">déjà gardée</span>` : `<button class="btn sm" data-act="dehors-keep">garder</button>`) : ""}${inboxId(S().modules) ? `<button class="btn ghost sm" data-act="dehors-note">vers une note</button>` : ""}<button class="btn ghost sm" data-act="dehors-hide" aria-label="Écarter">vu</button></div></li>`;
  const list = !dehorsAll().length ? `<p class="empty">Aucun flux suivi. Colle ci-dessous l'adresse d'un site, d'une revue, d'une chaîne : Selene trouve son flux.</p>`
    : !items.length ? `<p class="empty">${dehorsBusy ? "Lecture des flux…" : "Rien de neuf. Le monde a pu se passer de toi, et toi de lui."}</p>`
    : [...byMod].map(([k, its]) => `<h3>${esc(k ? label(k) : "Sans projet")}</h3><ul class="plain dehors">${its.map(itemHTML).join("")}</ul>`).join("")
      + `<div class="row" style="margin-top:12px">${total > items.length ? `<span class="hint" style="margin:0">Et ${total - items.length} autre${total - items.length > 1 ? "s" : ""}, qui attendront.</span>` : ""}<span class="spacer"></span><button class="btn sm" data-act="dehors-seen">Tout marquer comme vu</button></div>`;
  const opts = sel => `<option value="">Sans projet</option>${mods.map(m => `<option value="${esc(m)}" ${sel === m ? "selected" : ""}>${esc(label(m))}</option>`).join("")}`;
  const state = f => { const fc = cache.feeds[f.id]; return !fc ? "pas encore lu" : fc.err ? `ne répond pas : ${fc.err}` : `lu ${dehorsWhen(fc.at)}`; };
  return `<div class="dehors-view">` + head + `<div class="row" style="margin:-4px 0 12px"><span class="hint" style="margin:0">${dehorsBusy ? "Lecture des flux…" : cache.at ? `Flux relus ${esc(dehorsWhen(cache.at))}.` : ""}</span><span class="spacer"></span>${dehorsAll().length ? `<button class="btn ghost sm" data-act="dehors-refresh" ${dehorsBusy ? "disabled" : ""}>Relire maintenant</button>` : ""}</div>
    ${list}
    <h3 style="margin-top:28px">Suivre</h3>
    <div class="capture capture-wrap"><input id="dehorsIn" inputmode="url" autocomplete="off" placeholder="L'adresse d'un site ou d'un flux…" aria-label="Adresse à suivre"><select id="dehorsMod" aria-label="Projet">${opts("")}</select><button class="btn" data-act="dehors-add">Suivre</button></div>
    ${watchedArtists().length || dehorsConf().artists ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin:8px 0 4px"><input type="checkbox" data-act="dehors-artists" ${dehorsConf().artists ? "checked" : ""}>Les sorties de mes artistes : MusicBrainz, une fois par semaine, pour ${watchedArtists().length} artiste${watchedArtists().length > 1 ? "s" : ""} relié${watchedArtists().length > 1 ? "s" : ""} (trente au plus)</label>` : ""}
    <p class="hint" style="margin:4px 0 10px">Une newsletter : abonne-toi avec une adresse de <a href="https://kill-the-newsletter.com/" target="_blank" rel="noopener noreferrer">Kill the Newsletter</a>, puis suis le flux Atom qu'il te donne (il garde les lettres chez lui : pas pour une correspondance privée).</p>
    <h3 style="margin-top:28px">Veille de recherche</h3>
    <p class="hint" style="margin:0 0 8px">Une recherche (« biodiversity », « renewable energy ») ou un auteur (identifiant OpenAlex ou ORCID) : chaque semaine, ce qui vient de paraître, selon OpenAlex. Elle ne trie pas selon ce qui te donnerait raison ; les liens, c'est toi qui les poses.</p>
    <div class="capture capture-wrap"><input id="oaIn" autocomplete="off" placeholder="Une recherche, un ORCID, un identifiant OpenAlex…" aria-label="Recherche ou auteur à suivre"><select id="oaMod" aria-label="Projet">${opts("")}</select><button class="btn" data-act="oa-add">Veiller</button></div>
    ${dehorsResearch().length ? `<ul class="plain dehors-cfg">${dehorsResearch().map(r => { const fc = cache.feeds["oa-" + r.id]; return `<li class="item" data-oa="${esc(r.id)}"><span></span><div><b>${esc(r.name || r.q)}</b><div class="meta"><span>${r.kind === "author" ? "auteur" : "recherche"}</span><span>${esc(!fc ? "pas encore lue" : fc.err ? `ne répond pas : ${fc.err}` : `lue ${dehorsWhen(fc.at)}`)}</span></div></div>
      <div class="row"><select data-act="oa-mod" aria-label="Projet de cette veille">${opts(r.mod || "")}</select><button class="btn ghost sm" data-act="oa-del">retirer</button></div></li>`; }).join("")}</ul>` : ""}
    <details style="margin-top:8px"><summary class="hint">Clé OpenAlex (facultative)</summary>
      <p class="hint" style="margin:6px 0">Sans clé, OpenAlex répond dans une petite limite quotidienne ; une clé gratuite (<a href="https://openalex.org/settings/api" target="_blank" rel="noopener noreferrer">openalex.org</a>) la décuple. Elle reste dans ce navigateur, n'est jamais synchronisée, et s'efface à la déconnexion.</p>
      <label>Clé API OpenAlex<input type="password" data-act="oa-key" value="${oaKey() ? "••••••••" : ""}" autocomplete="off" placeholder="colle ta clé"></label></details>
    ${feeds.length ? `<details class="dehors-feeds"><summary>Flux suivis (${feeds.length})</summary>
      <ul class="plain dehors-cfg">${feeds.map(f => `<li class="item" data-feed="${esc(f.id)}"><span></span><div><b>${esc(f.title)}</b><div class="meta"><span>${esc((() => { try { return new URL(f.url).hostname.replace(/^www\./, ""); } catch { return ""; } })())}</span><span>${esc(state(f))}</span></div>
        <label style="display:flex;gap:6px;align-items:center;font-weight:400;margin-top:4px"><input type="checkbox" data-act="dehors-motifs" ${f.motifs ? "checked" : ""}>Seulement ce qui touche mes motifs</label></div>
        <div class="row"><select data-act="dehors-mod" aria-label="Projet de ce flux">${opts(f.mod)}</select><button class="btn ghost sm" data-act="dehors-del">retirer</button></div></li>`).join("")}</ul>
    </details>` : ""}</div>`;
};
const dehorsHit = el => { const li = el.closest("[data-feed]"), f = dehorsAll().find(x => x.id === li.dataset.feed); const fc = f && dehorsCache().feeds[f.id]; return { li, f, x: fc && li.dataset.item ? fc.items.find(i => i.id === li.dataset.item) : null }; };
const dehorsHideItem = (f, x) => { const c = dehorsCache(), k = dehorsKey(x); c.hidden.push(`${f.id}|${x.id}`); if (k) c.hidden.push(`k|${k}`); dehorsStore(c); };
 // avec sa clé : écarté ici, il ne revient pas par un autre flux
CLICK["dehors-add"] = async el => {
  const inp = $("#dehorsIn"), raw = inp ? inp.value.trim() : ""; if (!raw) return;
  el.disabled = true; el.textContent = "Recherche…";
  try { const f = await dehorsFollow(raw, ($("#dehorsMod") || {}).value || ""); if (inp) inp.value = ""; toast(`Suivi : ${f.title}.`); }
  catch (e) { toast(e.message); }
  render();
};
CLICK["dehors-refresh"] = () => dehorsRefresh(true);
CLICK["dehors-seen"] = () => {
  const now = Date.now(); dehorsSet({ feeds: dehorsFeeds().map(f => ({ ...f, seen: now })), ...(dehorsConf().artists ? { artistsSeen: now } : {}), ...(dehorsResearch().length ? { research: dehorsResearch().map(r => ({ ...r, seen: now })) } : {}) });
  const c = dehorsCache(); c.hidden = []; dehorsStore(c); render(); toast("Tout est vu. Dehors se tait jusqu'à la prochaine parution.");
};
CLICK["dehors-hide"] = el => { const { f, x } = dehorsHit(el); if (!x) return; dehorsHideItem(f, x); render(); };
CLICK["dehors-note"] = el => {
  const { f, x } = dehorsHit(el), box = inboxId(S().modules); if (!x || !box) return;
  addNote(S().modules[box], [x.title, x.link].filter(Boolean).join(" — ").slice(0, 2000)); dehorsHideItem(f, x); site.save(); render(); toast(`Dans ${label(box)}.`);
};
CLICK["dehors-keep"] = el => {
  const { f, x } = dehorsHit(el), to = sourcesModule(); if (!x || !to) return;
  const src = x.oa ? { title: x.title, url: x.link, doi: x.oa.doi || null, site: x.oa.site, date: x.oa.day, kind: x.oa.kind === "article" ? "article" : x.oa.kind || "article", authors: x.oa.authors, abstract: x.text }
    : { title: x.title, url: normalizeUrl(x.link), doi: findDoi(x.link), site: f.title, date: x.date.slice(0, 10), kind: "page", abstract: x.text };
  const dup = findSourceDup(src);
  if (dup) { dehorsHideItem(f, x); render(); return toast(`Déjà gardée dans ${label(dup.mod)}.`); }
  const e = keepSource(to, src, { from: f.research ? "Veille" : "Dehors", text: f.research ? f.research.name || f.research.q : f.title, date: todayISO() }); dehorsHideItem(f, x); site.save(); render(); toast(`Gardée dans ${label(to)} : « ${excerpt(e, 50)} ».`);
};
CLICK["dehors-del"] = async el => {
  const { f } = dehorsHit(el); if (!f || !await ask(`Ne plus suivre « ${f.title} » ?`)) return;
  dehorsSet({ feeds: dehorsFeeds().filter(x => x.id !== f.id) }); dehorsStore(dehorsCache()); render();
};
/* Depuis l'aperçu d'une source : suivre le flux que la page annonce. */
CLICK["dehors-follow"] = async el => {
  el.disabled = true;
  try { const f = await dehorsFollow(el.dataset.url, ""); toast(`Suivi dans Dehors : ${f.title}.`); } catch (e) { toast(e.message); el.disabled = false; }
};
CHANGE["dehors-mod"] = el => { const { f } = dehorsHit(el); if (!f) return; dehorsSet({ feeds: dehorsFeeds().map(x => x.id === f.id ? { ...x, mod: el.value } : x) }); render(); };
CHANGE["dehors-motifs"] = el => { const { f } = dehorsHit(el); if (!f) return; dehorsSet({ feeds: dehorsFeeds().map(x => x.id === f.id ? { ...x, motifs: el.checked } : x) }); render(); };
CHANGE["dehors-artists"] = el => {
  dehorsSet(el.checked ? { artists: true, artistsSeen: Date.now() - 7 * 86400000 } : { artists: false });
  dehorsStore(dehorsCache()); render();
  if (el.checked) { toast("Artist Watch : première vérification, une seconde par artiste."); dehorsRefresh(); }
};
CLICK["oa-add"] = () => {
  const inp = $("#oaIn"), w = oaWatch(inp ? inp.value : ""); if (!w) return toast("Une recherche de deux cents caractères au plus, ou un auteur.");
  const list = dehorsResearch();
  if (list.some(r => r.kind === w.kind && fold(r.q) === fold(w.q))) return toast("Déjà en veille.");
  if (list.length >= 30) return toast("Trente veilles, c'est une thèse. Retires-en avant d'en ajouter.");
  const mod = ($("#oaMod") || {}).value || "";
  dehorsSet({ research: [...list, { id: uid(), kind: w.kind, q: w.q, ...(mod && Object.hasOwn(S().modules, mod) ? { mod } : {}), seen: Date.now() - 7 * 86400000 }] });
  if (inp) inp.value = ""; render(); toast(`En veille : ${w.q}. Première lecture…`); dehorsRefresh();
};
CLICK["oa-del"] = async el => {
  const id = el.closest("[data-oa]").dataset.oa, r = dehorsResearch().find(x => x.id === id); if (!r || !await ask(`Arrêter la veille « ${r.name || r.q} » ?`)) return;
  dehorsSet({ research: dehorsResearch().filter(x => x.id !== id) }); dehorsStore(dehorsCache()); render();
};
CHANGE["oa-mod"] = el => { const id = el.closest("[data-oa]").dataset.oa; dehorsSet({ research: dehorsResearch().map(r => r.id === id ? { ...r, mod: el.value } : r) }); render(); };
CHANGE["oa-key"] = el => {
  const v = el.value.trim(); if (v.startsWith("•")) return;
  try { if (v) platform.secrets.set(OA_KEY, v); else platform.secrets.remove(OA_KEY); } catch {}
  el.blur(); render(); toast(v ? "Clé OpenAlex gardée dans ce navigateur." : "Clé OpenAlex oubliée.");
};
CLICK["dehors-mb-add"] = el => {
  const { f, x } = dehorsHit(el); if (!x || !x.mb || !Object.hasOwn(S().modules, x.mb.mod)) return;
  const n = saveCollectionItem(S().modules[x.mb.mod], { title: x.mb.artist, subtitle: x.mb.album }, uid());
  n.mb = { a: x.mb.a, rg: x.mb.rg, ...(x.mb.y ? { y: x.mb.y } : {}) };
  dehorsHideItem(f, x); site.save(); render(); toast(`Ajouté à ${label(x.mb.mod)} : ${x.mb.artist}, « ${x.mb.album} ».`);
};
