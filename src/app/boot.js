/* Démarrage : chargé en dernier par build.py, quand toutes les vues et tous les registres existent. */
import { platform } from "../platform.js";
import { agendaRefresh } from "./features/agenda.js";
import { dehorsRefresh } from "./features/dehors.js";
import { refreshWeather } from "./scene/sky.js";
import { authBoot, authReady } from "./services/auth.js";
import { reportError } from "./services/journal.js";
import { connectHost } from "./services/host.js";
import { focusEntry, liveRecents, openOn, routeOf } from "./shell/nav.js";
import { render } from "./shell/render.js";
import { local } from "./state/local.js";
import { S, board, site } from "./state/site.js";

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
{ const e = routeOf().entry; if (e) focusEntry(e); } // un lien direct vers une entrée, ouvert tel quel
// La Fenêtre : l'heure avance, le ciel aussi (toutes les cinq minutes, sur l'accueil, ou partout en mode « suivre le
// soleil ») ; la météo se relit au plus toutes les demi-heures. Minuterie détachée : elle ne retient jamais Node en test.
(function skyTick() {
  const t = setTimeout(() => { if (!document.hidden) { if (routeOf().view === "accueil" || S().config.mode === "sun") render(); refreshWeather(); } skyTick(); }, 300000);
  if (t && t.unref) t.unref();
})();
document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshWeather(); dehorsRefresh(); agendaRefresh(); } });
refreshWeather();
setTimeout(() => { agendaRefresh(); dehorsRefresh(); }, 1500); // les flux de Dehors, au plus toutes les trois heures, après le premier affichage
(async () => {
  try {
    if (!platform.claude.available()) {
      if (authReady()) { await authBoot(); render(); }
      return;
    }
    const db = await platform.claude.use("db");
    if (db) { await site.connect(db); await board.connect(db); } // le site d'abord (voir absorbBoard)
  } catch {}
  try { if (await connectHost()) render(); } catch {}
})();
