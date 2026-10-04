/* Les sources : un lien ou un DOI, complété (Crossref, Microlink, passeur) puis gardé ; une source documente une
   note. */
import { addLink, retargetLinks, saveCollectionItem } from "../../core/domain.js";
import { bareSource, crossrefToSource, findDoi, findUrl, microlinkToSource, sourceKey } from "../../core/sources.js";
import { CLICK } from "../registry.js";
import { $, esc, toast, toastAction } from "../lib/dom.js";
import { fmt, todayISO, uid } from "../lib/format.js";
import { tr, trp, uiLocale } from "../i18n/index.js";
import { citeBar } from "./cites.js";
import { dehorsFeeds } from "./dehors.js";
import { excerpt, refFind, thoughtItems } from "./links.js";
import { sortesForget } from "./sortes.js";
import { zotBar } from "./zotero.js";
import { modOf } from "../modules/collection.js";
import { pageToSource, passeurFetch, passeurPret } from "../services/passeur.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { S, enabled, label, site } from "../state/site.js";
import { openForm } from "../ui/dialogs.js";

/* Sources : un lien ou un DOI, complété puis gardé.
   Tirer, jamais pousser : rien ne part vers un service sans un geste (« Chercher », « Garder comme source »). Un DOI
   va à Crossref (sans clé), une page à Microlink (sans clé, 25 par jour, qui voit l'adresse demandée). Hors ligne,
   service muet ou quota épuisé : la source est gardée avec son adresse seule, et le dit. La traduction des réponses
   est dans sources.js ; la validation de `src`, dans domain.js. */
const srcPreview = {};
 // aperçu en cours, par module (propre à l'appareil, oublié au rechargement)
export const sourcesModule = () => S().config.modules.map(m => m.id).find(k => enabled(k) && Object.hasOwn(S().modules, k) && S().modules[k].type === "collection" && S().modules[k].config.sources) || null;
export function pubDate(d) {
  if (!d) return "";
  if (d.length === 10) return fmt(d, { day: "numeric", month: "short", year: "numeric" });
  if (d.length === 7) return new Date(d + "-15T12:00").toLocaleDateString(uiLocale(), { month: "long", year: "numeric" });
  return d;
}
/* Sous une source : son site, sa date, son DOI, et le lien vers elle (seul lien externe de l'app, jamais « javascript: »). */
export function srcMeta(e) {
  const x = e.src; if (!x) return "";
  const url = x.url && /^https?:\/\//i.test(x.url) ? x.url : "";
  return [x.site && `<span>${esc(x.site)}</span>`, x.date && `<span>${esc(pubDate(x.date))}</span>`, x.doi && `<span>doi:${esc(x.doi)}</span>`,
    url && `<a class="src-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${tr`ouvrir ↗`}</a>`,
    e.zot && e.zot.l && /^https:\/\/www\.zotero\.org\//.test(e.zot.l) && `<a class="src-link" href="${esc(e.zot.l)}" target="_blank" rel="noopener noreferrer">Zotero ↗</a>`].filter(Boolean).join("");
}
async function fetchSource(raw) {
  const doi = findDoi(raw), url = findUrl(raw);
  if (!doi && !url) return null;
  const get = async u => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
    try { const r = await fetch(u, { signal: ac.signal }); return r.ok ? await r.json() : null; } finally { clearTimeout(t); }
  };
  try {
    if (doi) { const j = await get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`); if (j && j.message) return crossrefToSource(j.message, doi); }
    else {
      // Le passeur d'abord (la page elle-même, et les flux qu'elle annonce) ; Microlink s'il manque ou échoue.
      if (passeurPret()) {
        try {
          const r = await passeurFetch(url, "page");
          if (r.texte) {
            const pg = pageToSource(r.texte, r.url || url);
            if (pg.doi) { const j = await get(`https://api.crossref.org/works/${encodeURIComponent(pg.doi)}`).catch(() => null); if (j && j.message) return { ...crossrefToSource(j.message, pg.doi), feeds: pg.feeds }; }
            return pg;
          }
        } catch {}
      }
      const j = await get(`https://api.microlink.io/?url=${encodeURIComponent(url)}`); if (j && j.status === "success" && j.data) return microlinkToSource(j.data, url);
    }
  } catch {} // hors ligne, délai dépassé, réponse illisible : voir plus bas
  return { ...bareSource(url, doi), partial: true };
}
/* Une source déjà gardée, dans n'importe quel module de sources : même DOI, ou même adresse. */
export function findSourceDup(src) {
  const key = sourceKey(src), zk = src && src.zot && src.zot.k; if (!key && !zk) return null;
  for (const [mod, m] of Object.entries(S().modules)) {
    if (m.type !== "collection" || !m.config.sources) continue;
    const e = m.entries.find(x => (key && x.src && sourceKey(x.src) === key) || (zk && x.zot && x.zot.k === zk));
    if (e) return { mod, e };
  }
  return null;
}
export function keepSource(mod, x, origin) {
  const e = saveCollectionItem(S().modules[mod], { title: x.title || x.url || x.doi, subtitle: x.authors || "", tag: x.kind ? tr(x.kind) : "", text: x.abstract || "" }, uid());
  e.src = Object.fromEntries(Object.entries({ url: x.url, doi: x.doi, site: x.site, date: x.date }).filter(([, v]) => v));
  if (x.zot) e.zot = { ...x.zot }; // reliée à sa fiche Zotero
  e.kept = todayISO(); // le jour où elle a été gardée : les Sortes savent ainsi depuis quand elle attend
  if (origin) e.origin = origin;
  return e;
}
export function sourceBar(id) {
  const p = srcPreview[id], d = p && p.data;
  const prev = !p ? "" : p.busy ? `<p class="hint" role="status">${tr`Recherche…`}</p>` : `<div class="src-prev" role="status">
    <b>${esc(d.title)}</b>${d.authors ? `<div>${esc(d.authors)}</div>` : ""}
    <div class="meta">${[d.site, pubDate(d.date), d.kind && tr(d.kind)].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("")}${d.doi ? `<span>doi:${esc(d.doi)}</span>` : ""}</div>
    ${d.abstract ? `<p class="note">${esc(d.abstract)}</p>` : ""}
    ${d.feeds && d.feeds.length ? `<p class="hint">${tr`Ce site publie un flux : ${d.feeds.map(f => `<span class="tag">${esc(f.title || f.url)}</span>`).join(" ")}`}${passeurPret() && !dehorsFeeds().some(x => sourceKey({ url: x.url }) === sourceKey({ url: d.feeds[0].url })) ? ` <button class="btn ghost sm" data-act="dehors-follow" data-url="${esc(d.feeds[0].url)}">${tr`le suivre dans Dehors`}</button>` : ""}</p>` : ""}
    ${d.partial ? `<p class="hint">${tr`Métadonnées indisponibles (hors ligne, service muet ou quota du jour atteint) : elle sera gardée avec son adresse seule.`}</p>` : ""}
    ${p.dup ? `<p class="hint">${p.dup.mod !== id ? tr`Déjà gardée dans ${esc(label(p.dup.mod))} : ${`<a href="#${esc(p.dup.mod)}/${esc(p.dup.e.id)}">${tr`« ${esc(excerpt(p.dup.e, 60))} »`}</a>`}.` : tr`Déjà gardée : ${`<a href="#${esc(p.dup.mod)}/${esc(p.dup.e.id)}">${tr`« ${esc(excerpt(p.dup.e, 60))} »`}</a>`}.`}</p>` : ""}
    <div class="row"><button class="btn acc sm" data-act="src-keep" ${p.dup ? "disabled" : ""}>${tr`Garder`}</button><button class="btn ghost sm" data-act="src-cancel">${trp("formulaire", "Annuler")}</button></div></div>`;
  return `<div class="capture src-bar"><input id="srcIn" inputmode="url" autocomplete="off" placeholder="${tr`Un lien ou un DOI…`}" aria-label="${tr`Lien ou DOI`}"><button class="btn" data-act="src-fetch">${tr`Chercher`}</button></div>
  <p class="hint" style="margin:4px 0 12px">${passeurPret() ? tr`Un DOI est complété par Crossref ; une page, par ton passeur (sinon Microlink, qui voit l'adresse demandée, 25 par jour).` : tr`Un DOI est complété par Crossref ; une page, par Microlink, qui voit l'adresse demandée (25 par jour).`}</p>${prev}${zotBar(id)}${citeBar()}`;
}
CLICK["src-fetch"] = async el => {
  const id = modOf(el), inp = $("#srcIn"), raw = inp ? inp.value.trim() : "";
  if (!raw) return;
  if (!findDoi(raw) && !findUrl(raw)) return toast(tr`Ni lien ni DOI reconnu. Un lien commence par https://, un DOI par 10.`);
  srcPreview[id] = { busy: true }; render();
  const data = await fetchSource(raw);
  if (!srcPreview[id] || !srcPreview[id].busy) return; // annulé entre-temps
  srcPreview[id] = { data, dup: findSourceDup(data) }; render();
};
CLICK["src-keep"] = el => {
  const id = modOf(el), p = srcPreview[id]; if (!p || !p.data || p.dup) return;
  const e = keepSource(id, p.data); delete srcPreview[id];
  const inp = $("#srcIn"); if (inp) inp.value = "";
  site.save(); render();
  // Le geste suivant, proposé tout de suite : sur téléphone, « documente… » est rangé dans le menu « … » de la ligne
  // (repéré en jouant les tâches d'E2, docs/validation.md).
  if (thoughtItems().length) toastAction(tr`Gardée : « ${excerpt(e, 50)} ».`, tr`La relier à une idée`, () => sourceLinkForm(id, e.id), 8000);
  else toast(tr`Gardée : « ${excerpt(e, 50)} ».`);
};
CLICK["src-cancel"] = el => { delete srcPreview[modOf(el)]; render(); };
/* Une note de la boîte qui contient un lien ou un DOI devient une source, avec sa provenance ; ses liens la suivent. */
CLICK["note-source"] = async el => {
  const from = modOf(el), to = sourcesModule(), nid = idOf(el), note = S().modules[from].entries.find(x => x.id === nid);
  if (!note || !to) return;
  el.disabled = true; el.textContent = tr`Recherche…`;
  const data = await fetchSource(note.text);
  const box = S().modules[from], n = box && box.entries.find(x => x.id === nid); // relu : une synchro a pu passer
  if (!n || !data) return render();
  const dup = findSourceDup(data);
  if (dup) { render(); return toast(tr`Déjà gardée dans ${label(dup.mod)}. La note reste où elle est.`); }
  const e = keepSource(to, data, n.origin || { from: label(from), text: n.text, date: n.date });
  retargetLinks(S().modules, `${from}/${n.id}`, `${to}/${e.id}`);
  box.entries = box.entries.filter(x => x !== n); site.save(); render();
  toast(data.partial ? tr`Rangée dans ${label(to)}, avec son adresse seule : métadonnées indisponibles pour l'instant.` : tr`Rangée dans ${label(to)} : « ${excerpt(e, 50)} ».`);
};
/* ---- une Source documente une note ou un fragment ---- */
function sourceLinkForm(mod, id) {
  const choices = thoughtItems().sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).slice(0, 300);
  if (!choices.length) return toast(tr`Aucune note ni aucun fragment à documenter pour l'instant.`);
  openForm(tr`Cette source documente…`, [
    { n: "to", l: tr`…quelle note ou quel fragment`, t: "select", o: choices.map(x => [x.ref, `${label(x.mod)} · ${x.e.date ? fmt(x.e.date) + " · " : ""}${excerpt(x.e, 70)}`]) }
  ], {}, v => {
    const hit = refFind(`${mod}/${id}`); if (!hit) return toast(tr`Cette source a disparu entre-temps.`);
    if (!addLink(hit.e, v.to, "documente", uid(), todayISO())) return toast(tr`Déjà reliée ainsi.`);
    sortesForget(hit.e); // elle n'est plus oubliée
    site.save(); render(); toast(tr`Reliée. Elle apparaît en marge de ce qu'elle documente.`);
  });
}
CLICK["src-link"] = el => { const ref = el.dataset.ref; if (ref) { const [m, i] = ref.split("/"); return sourceLinkForm(m, i); } sourceLinkForm(modOf(el), idOf(el)); };
