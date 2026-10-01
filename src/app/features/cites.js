/* « Cité par tes sources » (OpenAlex) : à la demande, les travaux qui citent plusieurs de tes sources. */
import { platform } from "../../platform.js";
import { OA_DOI, oaCoupling, oaRefs, oaRefsUrls, oaTitlesUrls, oaWorks } from "../../core/veille.js";
import { CLICK } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { todayISO, uid } from "../lib/format.js";
import { tr } from "../i18n/index.js";
import { dehorsOn, dehorsRefresh, dehorsResearch, dehorsSet, oaKey } from "./dehors.js";
import { excerpt, sourceItems } from "./links.js";
import { findSourceDup, keepSource } from "./sources.js";
import { modOf } from "../modules/collection.js";
import { render } from "../shell/render.js";
import { site } from "../state/site.js";

/* ---- « cité par tes sources » (veille.js : oaCoupling) : à la demande, depuis un module de Sources ----
   OpenAlex reçoit les DOI de tes sources, rien d'autre. Ce qu'il en dit reste sur l'appareil (selene-cites), trente
   jours : une bibliographie publiée ne change guère. Rien ne s'affiche tant que tu ne l'as pas demandé. */
const CITE_KEY = "selene-cites", CITE_TTL = 30 * 86400000;
let citeState = null;
 // { busy, err, res } (propre à l'appareil, oublié au rechargement)
function citeCache() {
  try { const c = JSON.parse(platform.storage.get(CITE_KEY) || "null"); if (c && typeof c === "object" && c.works && c.titles) return c; } catch {}
  return { works: {}, titles: {} };
}
/* Tes sources telles qu'OpenAlex les connaît : W… → DOI (pour reconnaître, dans la veille, un article qui les cite). */
export const citeOwn = () => new Map(Object.entries(citeCache().works).filter(([, w]) => w && /^W\d+$/.test(w.id || "")).map(([d, w]) => [w.id, d]));
function citeStore(c) { try { platform.storage.set(CITE_KEY, JSON.stringify(c)); } catch {} }
/* Les sources à DOI de tous les modules de Sources, par DOI (la plus ancienne l'emporte), deux cents au plus. */
export function citeSources() {
  const m = new Map();
  for (const x of sourceItems()) { const d = x.e.src && x.e.src.doi; if (d && OA_DOI.test(d) && !m.has(d)) m.set(d, x); }
  return new Map([...m].slice(0, 200));
}
async function citeGet(url) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
  let r;
  try { r = await fetch(url, { signal: ac.signal }); } catch { throw new Error(tr`OpenAlex injoignable (hors ligne ?).`); } finally { clearTimeout(t); }
  if (r.status === 429) throw new Error(tr`OpenAlex : quota du jour atteint (une clé gratuite, dans Dehors, le décuple).`);
  if (!r.ok) throw Object.assign(new Error(tr`OpenAlex répond ${r.status}.`), { status: r.status });
  return r.json();
}
async function citeRun() {
  const srcs = citeSources(), c = citeCache(), now = Date.now(), key = oaKey();
  const stale = [...srcs.keys()].filter(d => !c.works[d] || now - (c.works[d].at || 0) > CITE_TTL);
  for (const url of oaRefsUrls(stale, key)) {
    let j; try { j = await citeGet(url); } catch (e) { if (e.status === 400) continue; throw e; } // un DOI qu'OpenAlex refuse : ce lot passe pour inconnu
    const got = oaRefs(j);
    for (const [d, w] of Object.entries(got)) c.works[d] = { ...w, at: now };
  }
  for (const d of stale) if (!c.works[d] || c.works[d].at !== now) c.works[d] = { none: true, at: now }; // inconnue d'OpenAlex : on ne redemande pas avant un mois
  for (const d of Object.keys(c.works)) if (!srcs.has(d)) delete c.works[d]; // une source retirée emporte son cache
  const res = oaCoupling(Object.fromEntries([...srcs.keys()].map(d => [d, c.works[d]]).filter(([, w]) => w && !w.none)));
  const need = res.common.map(x => x.id).filter(id => !c.titles[id] || now - (c.titles[id].at || 0) > CITE_TTL);
  for (const url of oaTitlesUrls(need, key)) for (const x of oaWorks(await citeGet(url))) c.titles[x.id] = { ...x, at: now };
  const keep = new Set(res.common.map(x => x.id)); for (const id of Object.keys(c.titles)) if (!keep.has(id)) delete c.titles[id];
  citeStore(c);
  return { ...res, titles: c.titles, total: srcs.size };
}
export function citeBar() {
  const srcs = citeSources(); if (srcs.size < 2) return "";
  const st = citeState, name = d => { const x = srcs.get(d); return x ? `<a href="#${esc(x.mod)}/${esc(x.e.id)}">${tr`« ${esc(excerpt(x.e, 50))} »`}</a>` : ""; };
  let body = "";
  if (st && st.busy) body = `<p class="hint" role="status">${tr`Lecture des bibliographies de tes sources…`}</p>`;
  else if (st && st.err) body = `<p class="hint" role="status">${esc(st.err)}</p>`;
  else if (st && st.res) {
    const r = st.res, followed = new Set(dehorsResearch().filter(x => x.kind === "author").map(x => x.q));
    const common = r.common.filter(x => r.titles[x.id]);
    body = `<p class="hint" style="margin:6px 0 0">${tr`OpenAlex connaît ${r.known} de tes ${r.total} sources à DOI.`}</p>`;
    if (!common.length && !r.pairs.length && !r.authors.length) body += `<p class="empty">${tr`Rien en commun pour l'instant : tes sources ne citent pas les mêmes textes (ou OpenAlex ignore leurs bibliographies).`}</p>`;
    if (common.length) body += `<h4>${tr`Cité par plusieurs de tes sources`}</h4><ul class="plain cite-list">${common.map(x => { const w = r.titles[x.id], dup = findSourceDup({ doi: w.oa.doi, url: w.link });
      return `<li class="item" data-w="${esc(x.id)}"><span></span><div><b>${esc(w.title)}</b><div class="meta">${[w.oa.authors, w.oa.site, w.oa.day.slice(0, 4)].filter(Boolean).map(v => `<span>${esc(v)}</span>`).join("")}</div>
        <div class="hint">${tr`cité par ${x.by.length} de tes sources : ${x.by.map(name).filter(Boolean).join(", ")}`}</div></div>
        <div class="row"><a class="src-link" href="${esc(w.link)}" target="_blank" rel="noopener noreferrer">${tr`ouvrir ↗`}</a>${dup ? `<a class="hint" href="#${esc(dup.mod)}/${esc(dup.e.id)}">${tr`déjà gardée`}</a>` : `<button class="btn sm" data-act="cite-keep">${tr`garder`}</button>`}</div></li>`; }).join("")}</ul>`;
    if (r.pairs.length) body += `<h4>${tr`Tes sources qui se parlent`}</h4><ul class="plain cite-pairs">${r.pairs.map(p => `<li>${tr`${name(p.a)} et ${name(p.b)} : ${p.n} références en commun`}</li>`).join("")}</ul>`;
    if (r.authors.length) body += `<h4>${tr`Ces auteurs reviennent`}</h4><ul class="plain cite-authors">${r.authors.map(a => `<li data-a="${esc(a.id)}">${tr`${`<b>${esc(a.name)}</b>`}, dans ${a.by.length} de tes sources`}
      ${dehorsOn() ? followed.has(a.id) ? `<span class="hint">${tr`en veille`}</span>` : `<button class="btn ghost sm" data-act="cite-follow">${tr`suivre dans la veille`}</button>` : ""}</li>`).join("")}</ul>`;
  }
  return `<div class="cite-bar" style="margin:0 0 14px"><div class="row"><button class="btn ghost sm" data-act="cite-run" ${st && st.busy ? "disabled" : ""}>${tr`Ce que tes sources ont en commun`}</button>
    <span class="hint">${tr`OpenAlex reçoit les DOI de tes sources, rien d'autre.`}</span></div>${body}</div>`;
}
CLICK["cite-run"] = async () => {
  citeState = { busy: true }; render();
  try { citeState = { res: await citeRun() }; } catch (e) { citeState = { err: e.message }; }
  render();
};
CLICK["cite-keep"] = el => {
  const r = citeState && citeState.res, id = el.closest("[data-w]").dataset.w, w = r && r.titles[id], hit = r && r.common.find(x => x.id === id); if (!w || !hit) return;
  const src = { title: w.title, url: w.link, doi: w.oa.doi || null, site: w.oa.site, date: w.oa.day, kind: w.oa.kind === "article" ? "article" : w.oa.kind || "article", authors: w.oa.authors, abstract: "" };
  if (findSourceDup(src)) return render();
  const e = keepSource(modOf(el), src, { from: tr`Cité par tes sources`, text: tr`cité par ${hit.by.length} de tes sources`, date: todayISO() }); // la provenance s'enregistre dans la langue du moment
  site.save(); render(); toast(tr`Gardée : « ${excerpt(e, 50)} ».`);
};
CLICK["cite-follow"] = el => {
  const r = citeState && citeState.res, a = r && r.authors.find(x => x.id === el.closest("[data-a]").dataset.a), list = dehorsResearch(); if (!a) return;
  if (list.some(x => x.kind === "author" && x.q === a.id)) return render();
  if (list.length >= 30) return toast(tr`Trente veilles, c'est une thèse. Retires-en avant d'en ajouter.`);
  dehorsSet({ research: [...list, { id: uid(), kind: "author", q: a.id, name: a.name, seen: Date.now() - 7 * 86400000 }] });
  render(); toast(tr`En veille dans Dehors : ${a.name}. Première lecture…`); dehorsRefresh();
};
