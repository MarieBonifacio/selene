/* Recevoir un lien depuis ailleurs : partage Android, favori, Raccourci iOS, liens selene:// ; déposé dans la boîte
   une fois les données prêtes. */
import { hosted, platform } from "../../platform.js";
import { inboxId } from "../../core/domain.js";
import { findDoi, findUrl } from "../../core/sources.js";
import { CLICK } from "../registry.js";
import { esc, toast } from "../lib/dom.js";
import { addNote } from "../modules/notes.js";
import { authReady, authSession } from "../services/auth.js";
import { render } from "../shell/render.js";
import { openSheet } from "../shell/sheets.js";
import { S, label, site } from "../state/site.js";

/* Recevoir un lien depuis ailleurs.
   `?url=&title=&text=` à l'ouverture : c'est ce qu'envoient le partage Android (Web Share Target, déclaré dans le
   manifeste), le favori « Envoyer à Selene » et un Raccourci iOS. Le lien attend que les données soient prêtes (la
   connexion au compte, s'il y en a une), puis devient une note de la boîte ; l'adresse de la page est nettoyée pour
   qu'un rechargement ne le dépose pas deux fois. */
export let sharePending = false;
function takeShare() {
  try {
    if (platform.session.get("selene-share")) sharePending = true; // reçu avant une connexion ou un rechargement
    const q = new window.URLSearchParams(location.search), p = { url: q.get("url") || "", title: q.get("title") || "", text: q.get("text") || "" };
    if (!p.url && !p.text && !p.title) return;
    platform.session.set("selene-share", JSON.stringify(p)); sharePending = true;
    window.history.replaceState(null, "", location.pathname + (location.hash || "#accueil"));
  } catch {}
}
/* L'app de bureau (ADR 17) : un lien selene://share, rangé dans la file par l'amorçage natif, est pris aussitôt ; le
   raccourci Ctrl+Alt+S (ou le menu de la zone de notification) ouvre la capture. */
document.addEventListener("selene:share", () => { sharePending = true; render(); });
document.addEventListener("selene:capture", () => openSheet("capture"));
export function applyShare() {
  if (hosted() && authReady() && !authSession) return; // pas encore connectée : on attend
  let p = null; try { p = JSON.parse(platform.session.get("selene-share") || "null"); platform.session.remove("selene-share"); } catch {}
  sharePending = false;
  if (!p) return;
  const box = inboxId(S().modules);
  if (!box) return toast("Lien reçu, mais aucune boîte de réception où le garder. Crée un Carnet et fais-en ta boîte (Réglages).");
  const url = String(p.url || "").trim(), text = String(p.text || "").trim(), title = String(p.title || "").trim();
  const parts = [title, text && text !== title ? text : "", url && !text.includes(url) ? url : ""].filter(Boolean);
  addNote(S().modules[box], parts.join(" — ").slice(0, 2000)); site.save(); render();
  toast(`Reçu dans ${label(box)}${findUrl(parts.join(" ")) || findDoi(parts.join(" ")) ? " : « Garder comme source » le complétera" : ""}.`);
}
takeShare();
/* Réglages → Envoyer à Selene : un favori à glisser dans la barre (ordinateur), et la recette d'un Raccourci (iPhone). */
export function shareSettingsHTML() {
  const base = location.origin + location.pathname;
  const bm = `javascript:(()=>{window.open('${base}?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank')})()`;
  return `<section><h3>Envoyer à Selene</h3><p class="hint">Un lien lu ailleurs arrive dans ta boîte de réception, prêt à devenir une source. Rien ne part ailleurs que chez toi.</p>
    <p class="row" style="margin:0 0 8px"><a class="btn sm" href="${esc(bm)}" data-act="bookmarklet">Envoyer à Selene</a><span class="hint" style="margin:0">Sur ordinateur : glisse ce bouton dans ta barre de favoris.</span></p>
    <p class="hint">Sur Android, une fois l'app installée : « Partager », puis Selene. Sur iPhone : app Raccourcis, un raccourci qui s'affiche dans la feuille de partage (URL), avec l'action « Ouvrir les URL » : <code>${esc(base)}?url=</code> suivi de l'entrée du raccourci.</p></section>`;
}
CLICK["bookmarklet"] = (el, e) => { e.preventDefault(); toast("Glisse ce bouton dans la barre de favoris : c'est là qu'il sert, sur la page à garder."); };
