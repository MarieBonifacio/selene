/* Le radar culturel : les sorties près de chez toi (OpenAgenda, par le portail public d'Opendatasoft), triées par tes mots. */
import { platform } from "../../platform.js";
import { inboxId } from "../../core/domain.js";
import { radarEvents, radarFold, radarMatch, radarUrl, radarWords } from "../../core/radar.js";
import { CLICK, SHEETS } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { fmt, todayISO } from "../lib/format.js";
import { addNote } from "../modules/notes.js";
import { skyConf } from "../scene/sky.js";
import { passeurFetch, passeurPret } from "../services/passeur.js";
import { render } from "../shell/render.js";
import { openSheet, sheetKind } from "../shell/sheets.js";
import { S, label, site } from "../state/site.js";

/* ---- Radar culturel (radar.js) : sur demande, ce qui se tient autour du lieu du ciel et parle de tes mots ----
   Le portail reçoit la zone (lieu du ciel, arrondi) et les dates ; les mots restent ici, le tri se fait sur l'appareil. */
export const RADAR_KEY = "selene-radar"; // cache de l'appareil : { at, key, events }, six heures
export const radarConf = () => { const r = S().config.radar; return { words: r && typeof r.words === "string" ? r.words : "" }; };
// Le lieu réglé dans Ciel, où qu'il soit : OpenAgenda couvre la France entière (et un peu au-delà, peu).
export const radarPlace = () => skyConf();
let radarState = null; // { busy, err, items, total, words, kept } : la feuille en cours
/* Une lecture de l'agenda : directe (le portail envoie l'en-tête CORS) ; si le navigateur n'a pas le droit d'en lire la
   réponse (l'ancien portail de la MEL ne l'envoyait pas), par le passeur, qui lit du JSON pour toi. L'échec direct est
   retenu pour la session : on ne refrappe pas à une porte qu'on sait fermée. */
let radarDirect = true;
async function radarGet(url) {
  if (radarDirect) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
    try { const r = await fetch(url, { signal: ac.signal }); return { status: r.status, json: r.ok ? await r.json() : null }; }
    catch { radarDirect = false; } finally { clearTimeout(t); }
  }
  if (!passeurPret()) throw new Error("L'agenda ne se laisse pas lire directement par le navigateur : il faut ton passeur (version hébergée, connectée).");
  const q = await passeurFetch(url, "json");
  return { status: q.status || 0, json: q.status === 200 && typeof q.texte === "string" ? JSON.parse(q.texte) : null };
}
async function radarFetch(c, from) {
  const key = `${+c.lat},${+c.lon},${from}`;
  try { const x = JSON.parse(platform.storage.get(RADAR_KEY) || "null"), age = x ? Date.now() - x.at : NaN; if (x && x.key === key && age > -300000 && age < 6 * 3600000 && Array.isArray(x.events)) return x.events; } catch {}
  let r = await radarGet(radarUrl(c, from, { lean: true }));
  if (r.status === 400) r = await radarGet(radarUrl(c, from, { lean: false })); // un champ renommé par le portail : tout recevoir plutôt que rien
  if (!r.json) throw new Error(`L'agenda répond ${r.status || "par une erreur"} (le portail a peut-être changé). Réessaie plus tard.`);
  const events = radarEvents(r.json);
  try { platform.storage.set(RADAR_KEY, JSON.stringify({ at: Date.now(), key, events })); } catch {}
  return events;
}
function radarWhen(x, today) {
  const dm = d => fmt(d, { day: "numeric", month: "long" });
  if (!x.from) return "";
  if (x.from <= today) return x.to > today ? `en cours, jusqu'au ${dm(x.to)}` : "aujourd'hui";
  if (x.to === x.from) return fmt(x.from, { weekday: "long", day: "numeric", month: "long" });
  return `du ${dm(x.from)} au ${dm(x.to)}`;
}
SHEETS.radar = () => {
  const st = radarState, c = radarPlace(); if (!st) return "";
  const head = `<h2 id="sheetTitle">Radar culturel</h2><p class="hint">Autour de ${esc(c ? c.name.split(",")[0] : "chez toi")}, à 20 km, les deux semaines à venir, ce qui parle de : ${esc(st.words.map(w => st.said[w] || w).join(", "))}. Cinq au plus ; le reste attendra que tu reviennes.</p>`;
  const foot = `<p class="hint" style="margin-top:12px">Source : OpenAgenda, par le portail public d'Opendatasoft. Le portail voit la zone (arrondie) et les dates, jamais tes mots : le tri se fait ici.</p>`;
  if (st.busy) return head + `<p class="hint" role="status">Recherche…</p>`;
  if (st.err) return head + `<p class="hint" role="status">${esc(st.err)}</p><button class="btn sm" data-act="radar-open">Réessayer</button>` + foot;
  if (!st.items.length) return head + `<p class="empty">Rien qui te ressemble, cette fois. La ville continuera sans toi, elle a l'habitude.</p>` + foot;
  const today = todayISO();
  return head + `<ul class="plain radar">${st.items.map(x => `<li class="item" data-rid="${esc(x.id)}"><span></span><div><b>${esc(x.title)}</b>
      <div class="meta"><span>${esc(radarWhen(x, today))}</span>${x.place || x.city ? `<span>${esc([x.place, x.city].filter(Boolean).join(", "))}</span>` : ""}${x.on.map(w => `<span class="tag">${esc(st.said[w] || w)}</span>`).join("")}</div>
      ${x.text ? `<p class="hint" style="margin:4px 0 0">${esc(x.text)}</p>` : ""}</div>
      <div class="row">${/^https:\/\//.test(x.url) ? `<a class="btn ghost sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">voir</a>` : ""}${st.kept.has(x.id) ? `<span class="hint">gardé</span>` : `<button class="btn sm" data-act="radar-keep">garder</button>`}</div></li>`).join("")}</ul>`
    + (st.total > st.items.length ? `<p class="hint">${st.total - st.items.length} autre${st.total - st.items.length > 1 ? "s" : ""} correspond${st.total - st.items.length > 1 ? "ent" : ""} aussi : des mots plus précis choisiraient mieux.</p>` : "") + foot;
};
CLICK["radar-open"] = async () => {
  const c = radarPlace(), words = radarWords(radarConf().words); if (!c || !words.length) return;
  const said = Object.create(null); for (const w of radarConf().words.split(",")) { const t = w.trim(); if (t.length > 1 && !said[radarFold(t)]) said[radarFold(t)] = t; } // pour l'affichage : tes mots tels que tu les écris
  radarState = { busy: true, err: "", items: [], total: 0, words, said, kept: new Set() };
  if ($("#sheet").open && sheetKind === "radar") $("#sheetBody").innerHTML = SHEETS.radar(); else openSheet("radar");
  let events = null, err = "";
  try { events = await radarFetch(c, todayISO()); } catch (e) { err = e.message || "L'agenda ne répond pas. Réessaie plus tard."; }
  const st = radarState; if (!st) return;
  Object.assign(st, { busy: false, err }, events ? radarMatch(events, words, 5) : {});
  if ($("#sheet").open && sheetKind === "radar") $("#sheetBody").innerHTML = SHEETS.radar();
};
CLICK["radar-keep"] = el => {
  const st = radarState, x = st && st.items.find(i => i.id === el.closest("[data-rid]").dataset.rid), box = inboxId(S().modules); if (!x) return;
  if (!box) return toast("Aucune boîte de réception où le garder. Crée un Carnet et fais-en ta boîte (Réglages).");
  addNote(S().modules[box], [x.title, radarWhen(x, todayISO()), [x.place, x.city].filter(Boolean).join(", "), x.url].filter(Boolean).join(" — ").slice(0, 2000));
  st.kept.add(x.id); site.save(); render(); $("#sheetBody").innerHTML = SHEETS.radar(); toast(`Gardé dans ${label(box)}.`);
};
export function radarSettingsHTML() {
  const c = radarPlace();
  return `<section id="radar"><h4>Radar culturel</h4><p class="hint">Sur demande, depuis l'accueil : les événements à 20 km du lieu réglé dans Ciel (OpenAgenda, partout en France) des deux semaines à venir qui parlent de tes mots. Cinq au plus, jamais de notification. Changer de lieu, c'est changer de radar.</p>
    <label>Tes mots, séparés par des virgules (cherchés dans le titre, les mots-clés, la description et le lieu)<input data-act="radar-words" value="${esc(radarConf().words)}" placeholder="poésie, jazz, photographie, lecture…" maxlength="300" autocomplete="off"></label>
    ${c ? `<p class="hint" style="margin-top:6px">Autour de ${esc(c.name)}.</p>` : `<p class="hint" style="margin-top:6px">Il lui faut un lieu : règle-le dans Ciel, ci-dessus.</p>`}</section>`;
}
