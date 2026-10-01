/* Zotero : ta bibliothèque en lecture seule, une fiche devient une source. */
import { hosted, platform } from "../../platform.js";
import { ZOT_API, zotItems, zotKeyInfo } from "../../core/zotero.js";
import { CHANGE, CLICK } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { todayISO } from "../lib/format.js";
import { tr } from "../i18n/index.js";
import { serverMsg } from "../services/erreurs.js";
import { excerpt } from "./links.js";
import { findSourceDup, keepSource, pubDate } from "./sources.js";
import { modOf } from "../modules/collection.js";
import { passeurFetch, passeurPret } from "../services/passeur.js";
import { render } from "../shell/render.js";
import { site } from "../state/site.js";

/* Zotero : ta bibliothèque, en lecture seule (zotero.js pour la traduction des fiches).
   La clé reste dans ce navigateur (jamais synchronisée, effacée à la déconnexion). Un appel part directement vers
   api.zotero.org ; si le navigateur n'a pas le droit d'en lire la réponse (CORS), il passe par ton passeur. Tirer,
   jamais pousser : rien n'est importé en masse, on garde une fiche à la fois. */
const ZOT_KEY = "selene-zotero-key", ZOT_INFO = "selene-zotero";
const zotKey = () => platform.secrets.get(ZOT_KEY) || "";
const zotInfo = () => { try { const x = JSON.parse(platform.storage.get(ZOT_INFO) || "null"); return x && Number.isInteger(x.userID) ? x : null; } catch { return null; } };
async function zotGet(path, viaPasseur = path) {
  const key = zotKey(); if (!key) throw new Error(tr`Pas de clé Zotero (Réglages → Zotero).`);
  const refuse = s => new Error(s === 403 ? tr`Zotero refuse cette clé (révoquée, ou sans accès à ta bibliothèque).` : tr`Zotero répond ${s}.`);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
  let r = null;
  try { r = await fetch(ZOT_API + path, { headers: { "Zotero-API-Key": key, "Zotero-API-Version": "3" }, signal: ac.signal }); } catch {} finally { clearTimeout(t); }
  if (r) { if (!r.ok) throw refuse(r.status); return r.json(); }
  // Pas de réponse lisible : CORS refusé, hors ligne, ou trop lent. Le passeur, s'il existe, essaie à son tour.
  if (!passeurPret()) throw new Error(tr`Zotero injoignable depuis le navigateur, et pas de passeur pour le relayer.`);
  const q = await passeurFetch(`${ZOT_API}${viaPasseur}${viaPasseur.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`, "json");
  if (q.status !== 200 || typeof q.texte !== "string") throw q.status ? refuse(q.status) : new Error(serverMsg(q, tr`Zotero injoignable.`));
  return JSON.parse(q.texte);
}
async function zotCheck() {
  const key = zotKey(); if (!key) return null;
  const info = zotKeyInfo(await zotGet("/keys/current", `/keys/${encodeURIComponent(key)}`));
  if (!info) throw new Error(tr`Réponse inattendue de Zotero.`);
  if (!info.library) throw new Error(tr`Cette clé n'a pas accès à ta bibliothèque personnelle (coche « Allow library access »).`);
  try { platform.storage.set(ZOT_INFO, JSON.stringify(info)); } catch {}
  return info;
}
const zotState = {};
 // par module de sources : { busy, err, items, label } (propre à l'appareil, oublié au rechargement)
export function zotBar(id) {
  if (!hosted() || !zotKey()) return "";
  const st = zotState[id];
  const list = !st ? "" : st.busy ? `<p class="hint" role="status">${tr`Recherche dans Zotero…`}</p>` : st.err ? `<p class="hint" role="status">${esc(st.err)}</p>`
    : !st.items.length ? `<p class="empty">${tr`Rien de tel dans ta bibliothèque.`}</p>`
    : `<p class="hint" style="margin:6px 0 0">${esc(st.label)}</p><ul class="plain zot-list">${st.items.map((x, i) => { const dup = findSourceDup(x);
      return `<li class="item" data-zi="${i}"><span></span><div><b>${esc(x.title)}</b><div class="meta">${[x.authors, x.site, pubDate(x.date), x.kind && tr(x.kind)].filter(Boolean).map(v => `<span>${esc(v)}</span>`).join("")}</div></div>
        <div class="row">${dup ? `<a class="hint" href="#${esc(dup.mod)}/${esc(dup.e.id)}">${tr`déjà gardée`}</a>` : `<button class="btn sm" data-act="zot-keep">${tr`garder`}</button>`}</div></li>`; }).join("")}</ul>`;
  return `<div class="zot-bar" style="margin:4px 0 14px"><div class="capture capture-wrap"><input id="zotIn" autocomplete="off" placeholder="${tr`Dans ta bibliothèque Zotero : titre, auteur, année…`}" aria-label="${tr`Chercher dans Zotero`}"><button class="btn" data-act="zot-search">${tr`Chercher`}</button><button class="btn ghost sm" data-act="zot-recent">${tr`récents`}</button></div>${list}</div>`;
}
async function zotList(id, path, label) {
  zotState[id] = { busy: true, items: [], err: "", label }; render();
  try {
    const info = zotInfo() || await zotCheck();
    const items = zotItems(await zotGet(`/users/${info.userID}${path}`));
    zotState[id] = { busy: false, items, err: "", label };
  } catch (e) { zotState[id] = { busy: false, items: [], err: e.message, label }; }
  render();
}
CLICK["zot-search"] = el => {
  const id = modOf(el), q = (($("#zotIn") || {}).value || "").trim().slice(0, 200); if (!q) return;
  zotList(id, `/items/top?q=${encodeURIComponent(q)}&qmode=titleCreatorYear&limit=10&sort=dateModified&direction=desc&format=json`, tr`Dans ta bibliothèque : « ${q} »`);
};
CLICK["zot-recent"] = el => zotList(modOf(el), `/items/top?limit=10&sort=dateAdded&direction=desc&format=json`, tr`Les dix dernières fiches ajoutées à ta bibliothèque`);
CLICK["zot-keep"] = el => {
  const id = modOf(el), st = zotState[id], x = st && st.items[+el.closest("[data-zi]").dataset.zi]; if (!x || findSourceDup(x)) return;
  const e = keepSource(id, x, { from: "Zotero", text: (zotInfo() || {}).username || tr`ta bibliothèque`, date: todayISO() });
  site.save(); render(); toast(tr`Gardée, reliée à Zotero : « ${excerpt(e, 50)} ».`);
};
export function zotSettingsHTML() {
  const info = zotInfo(), has = !!zotKey();
  return `<section id="zotero"><h3>Zotero</h3><p class="hint">${tr`Ta bibliothèque Zotero, en lecture seule : dans un module de Sources, cherche une fiche (ou les dernières ajoutées) et garde-la comme Source, reliée à sa fiche Zotero. Zotero reste l'archive ; Selene, l'endroit où tu t'en sers.`}</p>
    <p class="hint">${tr`Crée une clé sur ${`<a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noopener noreferrer">zotero.org/settings/keys/new</a>`} : sous « Personal Library », coche ${"<b>Allow library access</b>"} seulement (ni « Allow write access », ni les groupes). Elle reste dans ce navigateur, n'est jamais synchronisée et s'efface à la déconnexion.`}</p>
    <label>${tr`Clé API Zotero`}<input type="password" data-act="zot-key" value="${has ? "••••••••" : ""}" autocomplete="off" placeholder="${tr`colle ta clé`}"></label>
    ${has ? `<p class="row" style="margin:6px 0 0"><span>${esc(info ? (info.write ? tr`Bibliothèque de ${info.username || "#" + info.userID} : attention, cette clé peut écrire ; une clé en lecture seule suffit.` : tr`Bibliothèque de ${info.username || "#" + info.userID}, en lecture seule.`) : tr`Pas encore vérifiée.`)}</span><button class="btn sm" data-act="zot-check">${tr`Vérifier`}</button><button class="btn ghost sm" data-act="zot-forget">${tr`oublier`}</button></p>` : ""}</section>`;
}
CHANGE["zot-key"] = async el => {
  const v = el.value.trim(); if (v.startsWith("•")) return;
  try { if (v) platform.secrets.set(ZOT_KEY, v); else platform.secrets.remove(ZOT_KEY); platform.storage.remove(ZOT_INFO); } catch {}
  el.blur(); render();
  if (v) CLICK["zot-check"]();
};
CLICK["zot-check"] = async () => {
  platform.storage.remove(ZOT_INFO);
  try { const i = await zotCheck(); toast(i.write ? tr`Zotero : bibliothèque de ${i.username || "#" + i.userID} (clé en écriture : préfère une clé en lecture seule).` : tr`Zotero : bibliothèque de ${i.username || "#" + i.userID}, lecture seule.`); }
  catch (e) { toast(e.message); }
  render();
};
CLICK["zot-forget"] = () => { platform.secrets.remove(ZOT_KEY); platform.storage.remove(ZOT_INFO); for (const k of Object.keys(zotState)) delete zotState[k]; render(); toast(tr`Clé Zotero oubliée sur cet appareil.`); };
