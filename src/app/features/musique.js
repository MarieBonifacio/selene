/* Musique : MusicBrainz et Cover Art Archive (albums d'un artiste, parutions récentes des artistes suivis). */
import { platform } from "../../platform.js";
import { saveCollectionItem } from "../../core/domain.js";
import { coverUrl, mbAlbums, mbArtistQuery, mbArtists, mbSince } from "../../core/musique.js";
import { CLICK, SHEETS } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { addDaysTo, todayISO, uid } from "../lib/format.js";
import { refFind } from "./links.js";
import { modOf } from "../modules/collection.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { openSheet } from "../shell/sheets.js";
import { S, label, site } from "../state/site.js";
import { fold } from "../views/recherche.js";

/* Musique : MusicBrainz et Cover Art Archive.
   Préciser l'album d'un artiste dans sa discographie réelle, avec les pochettes ; en ajouter d'autres ; et, sur
   demande seulement, les nouvelles sorties des artistes reliés. Sans clé ; une requête par seconde au plus (règle de
   MusicBrainz), en file. Les pochettes sont des images (<img>) : elles n'ont pas besoin de CORS, seulement de la CSP.
   Traduction des réponses : musique.js ; validation de `mb` : domain.js. */
const MB = "https://musicbrainz.org/ws/2";
let mbLast = 0;
export async function mbFetch(path) {
  const wait = Math.max(0, mbLast + 1100 - Date.now()); mbLast = Date.now() + wait;
  if (wait) await new Promise(r => setTimeout(r, wait));
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
  try { const r = await fetch(`${MB}${path}${path.includes("?") ? "&" : "?"}fmt=json`, { signal: ac.signal }); return r.ok ? await r.json() : null; } finally { clearTimeout(t); }
}
export const coverImg = rg => `<img class="cover" src="${esc(coverUrl(rg))}" alt="" loading="lazy" width="44" height="44">`;
// Une pochette absente (404) : l'image s'efface au lieu d'afficher une icône cassée.
document.addEventListener("error", e => { if (e.target && e.target.classList && e.target.classList.contains("cover")) e.target.classList.add("none"); }, true);
let mbState = null;
 // { ref, step: "artist"|"albums", artists, albums, busy, err } : la feuille en cours
const mbEntry = ref => { const hit = refFind(ref); return hit && S().modules[hit.mod].config.music ? hit : null; };
async function mbLoadAlbums(aid) {
  mbState.busy = true; mbState.step = "albums"; $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref);
  const j = await mbFetch(`/release-group?artist=${aid}&type=album|ep&limit=100`).catch(() => null);
  if (!mbState) return;
  Object.assign(mbState, { busy: false, aid, albums: j ? mbAlbums(j) : null, err: j ? "" : "MusicBrainz ne répond pas (hors ligne, ou trop de demandes). Réessaie dans un instant." });
  if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref);
}
SHEETS.mb = ref => {
  const hit = mbEntry(ref); if (!hit || !mbState) return `<p class="empty">Cet élément n'existe plus.</p>`;
  const { mod, e } = hit, inst = S().modules[mod], st = mbState;
  const head = `<h2 id="sheetTitle">${esc(e.title)}</h2><p class="hint">Discographie studio (albums et EP) selon MusicBrainz, base libre et collaborative.</p>`;
  if (st.busy) return head + `<p class="hint" role="status">Recherche…</p>`;
  if (st.err) return head + `<p class="hint" role="status">${esc(st.err)}</p><button class="btn sm" data-act="mb-retry">Réessayer</button>`;
  if (st.step === "artist") {
    if (!st.artists.length) return head + `<p class="empty">Aucun artiste de ce nom dans MusicBrainz. Vérifie l'orthographe du titre.</p>`;
    return head + `<p>Plusieurs artistes portent ce nom :</p><ul class="plain">${st.artists.map(a => `<li class="item"><span></span><div><b>${esc(a.name)}</b><div class="meta">${[a.note, a.country, a.begin && `depuis ${a.begin}`].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("")}</div></div><button class="btn sm" data-act="mb-artist" data-a="${esc(a.id)}">choisir</button></li>`).join("")}</ul>`;
  }
  const have = new Set(inst.entries.filter(x => x.mb && x.mb.rg).map(x => x.mb.rg));
  const haveTitle = new Set(inst.entries.filter(x => fold(x.title) === fold(e.title) && x.subtitle).map(x => fold(x.subtitle)));
  if (!st.albums.length) return head + `<p class="empty">Aucun album ni EP studio référencé pour cet artiste.</p>`;
  return head + `<ul class="plain mb-albums">${st.albums.map(a => { const mine = e.mb && e.mb.rg === a.id, inList = have.has(a.id) || haveTitle.has(fold(a.title));
    return `<li class="item" data-rg="${esc(a.id)}"><span>${coverImg(a.id)}</span><div><b>${esc(a.title)}</b><div class="meta"><span>${esc(a.date.slice(0, 4) || "sans date")}</span><span>${esc(a.type)}</span></div></div>
      <div class="row">${mine ? `<span class="hint">choisi</span>` : `<button class="btn sm" data-act="mb-pick">${e.subtitle ? "remplacer" : "choisir"}</button>`}${inList ? "" : `<button class="btn ghost sm" data-act="mb-add">ajouter</button>`}</div></li>`; }).join("")}</ul>`;
};
async function mbOpen(ref) {
  const hit = mbEntry(ref); if (!hit) return;
  mbState = { ref, step: "artist", artists: [], albums: [], busy: true, err: "" };
  openSheet("mb", ref);
  if (hit.e.mb && hit.e.mb.a) return mbLoadAlbums(hit.e.mb.a);
  const j = await mbFetch(`/artist?query=${encodeURIComponent(mbArtistQuery(hit.e.title))}&limit=6`).catch(() => null);
  if (!mbState || mbState.ref !== ref) return;
  Object.assign(mbState, { busy: false, artists: j ? mbArtists(j) : [], err: j ? "" : "MusicBrainz ne répond pas (hors ligne, ou trop de demandes). Réessaie dans un instant." });
  if (mbState.artists.length === 1 && !mbState.err) return mbLoadAlbums(mbState.artists[0].id); // un seul candidat : pas de question
  if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS.mb(ref);
}
CLICK["mb-open"] = el => mbOpen(`${modOf(el)}/${idOf(el)}`);
CLICK["mb-retry"] = () => { if (mbState) mbOpen(mbState.ref); };
CLICK["mb-artist"] = el => mbLoadAlbums(el.dataset.a);
CLICK["mb-pick"] = el => {
  const hit = mbState && mbEntry(mbState.ref), rg = el.closest("[data-rg]").dataset.rg, a = hit && mbState.albums.find(x => x.id === rg); if (!a) return;
  hit.e.subtitle = a.title; hit.e.mb = { a: mbState.aid, rg: a.id, ...(a.date ? { y: a.date.slice(0, 4) } : {}) };
  site.save(); render(); $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref); toast(`« ${a.title} » : c'est noté.`);
};
CLICK["mb-add"] = el => {
  const hit = mbState && mbEntry(mbState.ref), rg = el.closest("[data-rg]").dataset.rg, a = hit && mbState.albums.find(x => x.id === rg); if (!a) return;
  const n = saveCollectionItem(S().modules[hit.mod], { title: hit.e.title, subtitle: a.title }, uid());
  n.mb = { a: mbState.aid, rg: a.id, ...(a.date ? { y: a.date.slice(0, 4) } : {}) };
  site.save(); render(); $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref); toast(`Ajouté : ${hit.e.title}, « ${a.title} ».`);
};
/* Nouvelles sorties : pour chaque artiste relié, ce qu'il a publié depuis la dernière vérification (sur cet appareil ;
   la toute première fois, l'année écoulée). Sur demande seulement : jamais en arrière-plan. */
export const MB_SEEN = "selene-mb-seen";
let mbNews = null;
 // { mod, done, total, items: [{ artist, aid, album }] }
SHEETS["mb-new"] = mod => {
  const n = mbNews, lab = esc(label(mod));
  if (!n) return "";
  const head = `<h2 id="sheetTitle">Nouvelles sorties</h2><p class="hint">Ce que tes artistes reliés dans ${lab} ont publié depuis ta dernière vérification, selon MusicBrainz. Rien n'est vérifié sans toi.</p>`;
  if (n.done < n.total) return head + `<p class="hint" role="status">${n.done} sur ${n.total} artistes…</p>`;
  const inst = S().modules[mod], have = new Set(inst.entries.filter(x => x.mb && x.mb.rg).map(x => x.mb.rg));
  return head + (n.items.length ? `<ul class="plain mb-albums">${n.items.map(x => `<li class="item" data-rg="${esc(x.album.id)}" data-a="${esc(x.aid)}"><span>${coverImg(x.album.id)}</span><div><b>${esc(x.album.title)}</b><div class="meta"><span>${esc(x.artist)}</span><span>${esc(x.album.date)}</span><span>${esc(x.album.type)}</span></div></div>${have.has(x.album.id) ? `<span class="hint">déjà là</span>` : `<button class="btn sm" data-act="mb-new-add">ajouter</button>`}</li>`).join("")}</ul>` : `<p class="empty">Rien de neuf. Le silence est aussi une nouvelle.</p>`)
    + (n.failed ? `<p class="hint">${n.failed} artiste${n.failed > 1 ? "s" : ""} sans réponse : réessaie plus tard.</p>` : "");
};
CLICK["mb-new"] = async el => {
  const mod = modOf(el), inst = S().modules[mod], artists = new Map();
  for (const e of inst.entries) if (e.mb && e.mb.a && !artists.has(e.mb.a)) artists.set(e.mb.a, e.title);
  let seen = {}; try { seen = JSON.parse(platform.storage.get(MB_SEEN) || "{}") || {}; } catch {}
  const today = todayISO(), yearAgo = addDaysTo(today, -365);
  mbNews = { mod, done: 0, total: artists.size, items: [], failed: 0 };
  openSheet("mb-new", mod);
  for (const [aid, name] of artists) {
    const j = await mbFetch(`/release-group?artist=${aid}&type=album|ep&limit=100`).catch(() => null);
    if (!mbNews || mbNews.mod !== mod) return;
    if (j) { for (const album of mbSince(mbAlbums(j), seen[aid] || yearAgo)) mbNews.items.push({ artist: name, aid, album }); seen[aid] = today; }
    else mbNews.failed++;
    mbNews.done++;
    if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS["mb-new"](mod);
  }
  mbNews.items.sort((a, b) => b.album.date.localeCompare(a.album.date));
  try { platform.storage.set(MB_SEEN, JSON.stringify(seen)); } catch {}
  if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS["mb-new"](mod);
};
CLICK["mb-new-add"] = el => {
  const li = el.closest("[data-rg]"), x = mbNews && mbNews.items.find(i => i.album.id === li.dataset.rg); if (!x) return;
  const n = saveCollectionItem(S().modules[mbNews.mod], { title: x.artist, subtitle: x.album.title }, uid());
  n.mb = { a: x.aid, rg: x.album.id, ...(x.album.date ? { y: x.album.date.slice(0, 4) } : {}) };
  site.save(); render(); $("#sheetBody").innerHTML = SHEETS["mb-new"](mbNews.mod); toast(`Ajouté : ${x.artist}, « ${x.album.title} ».`);
};
