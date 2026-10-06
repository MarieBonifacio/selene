/* Démarrage : chargé en dernier par build.py, quand toutes les vues et tous les registres existent. */
import { platform } from "../platform.js";
import { agendaRefresh } from "./features/agenda.js";
import { dehorsRefresh } from "./features/dehors.js";
import { $ } from "./lib/dom.js";
import { todayISO } from "./lib/format.js";
import { refreshWeather } from "./scene/sky.js";
import { connectArtifact } from "./services/artifact-db.js";
import { authBoot, authReady } from "./services/auth.js";
import { reportError } from "./services/journal.js";
import { connectHost } from "./services/host.js";
import { focusEntry, liveRecents, openOn, routeOf } from "./shell/nav.js";
import { render, renderedDay } from "./shell/render.js";
import { local } from "./state/local.js";
import { S, board, site, siteNotice } from "./state/site.js";

// Le journal des erreurs (services/journal.js) : une erreur de programmation qui échappe à l'app part, anonyme. Une
// erreur de ressource (image) n'arrive pas ici : elle ne remonte pas jusqu'à la fenêtre.
window.addEventListener("error", e => { if (e && e.error) reportError(e.error); });
window.addEventListener("unhandledrejection", e => reportError(e && e.reason));
const flushAll = () => { board.flush(); site.flush(); platform.flush(); }; // serveur, puis coffre natif (s'il y en a un)
window.addEventListener("pagehide", flushAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
platform.storage.watch(k => { if ((k === board.key && board.reload()) | (k === site.key && site.reload()) | (k === local.key && local.reload())) render(); }); // un autre onglet
platform.persist();

// « Ouvrir sur : là où j'en étais » : au premier chargement de la session seulement (la PWA démarre toujours sur #accueil).
try {
  if (!platform.session.get("selene-session")) {
    platform.session.set("selene-session", "1");
    const r = liveRecents()[0], here = routeOf();
    if (openOn() === "last" && r && here.view === "accueil" && !here.entry) window.history.replaceState(null, "", "#" + r.id);
  }
} catch {}
render();
siteNotice(); // un suivi passé sur l'appareil dès la lecture (A17), dit une fois
{ const e = routeOf().entry; if (e) focusEntry(e); } // un lien direct vers une entrée, ouvert tel quel
// La Fenêtre : l'heure avance, le ciel aussi (toutes les cinq minutes, sur l'accueil, ou partout en mode « suivre le
// soleil ») ; la météo se relit au plus toutes les demi-heures. Minuterie détachée : elle ne retient jamais Node en test.
(function skyTick() {
  const t = setTimeout(() => { if (!document.hidden) { if (routeOf().view === "accueil" || S().config.mode === "sun") render(); refreshWeather(); } skyTick(); }, 300000);
  if (t && t.unref) t.unref();
})();
/* Minuit (TRV-004, BL-10) : chaque vue suit la date d'elle-même, une minute après au plus, et dès le retour au premier
   plan. Seulement quand le jour a changé depuis le dernier rendu ; jamais pendant une saisie ni sous une boîte ouverte
   (formulaire, confirmation, feuille, palette) : ce qui est ouvert garde ses valeurs, date comprise, et la page suit à
   la minute qui suit. */
function followDay() {
  if (document.hidden || renderedDay() === todayISO()) return;
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable || (ae.tagName === "INPUT" && !["checkbox", "radio", "button", "file"].includes(ae.type)));
  if (typing || ["#dlg", "#cdlg", "#sheet", "#palette"].some(sel => $(sel).open)) return;
  render();
}
(function dayTick() {
  const t = setTimeout(() => { followDay(); dayTick(); }, 60000);
  if (t && t.unref) t.unref();
})();
document.addEventListener("visibilitychange", () => { if (!document.hidden) { followDay(); refreshWeather(); dehorsRefresh(); agendaRefresh(); } });
refreshWeather();
setTimeout(() => { agendaRefresh(); dehorsRefresh(); }, 1500); // les flux de Dehors, au plus toutes les trois heures, après le premier affichage
(async () => {
  try {
    if (!platform.claude.available()) {
      if (authReady()) { await authBoot(); render(); }
      return;
    }
    await connectArtifact(); // l'espace privé de la personne qui ouvre l'artefact (services/artifact-db.js)
  } catch {}
  try { if (await connectHost()) render(); } catch {}
})();
