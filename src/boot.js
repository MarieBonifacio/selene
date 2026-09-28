/* Démarrage : chargé en dernier par build.py, quand toutes les vues et tous les registres existent. */
/* ================= cycle de vie ================= */
const flushAll = () => { board.flush(); site.flush(); };
window.addEventListener("pagehide", flushAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
window.addEventListener("storage", e => { if ((e.key === board.key && board.reload()) | (e.key === site.key && site.reload())) render(); });
if (!window.claude) { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {} }

/* ================= boot ================= */
// « Ouvrir sur : là où j'en étais » : au premier chargement de la session seulement (la PWA démarre toujours sur #accueil).
try {
  if (!sessionStorage.getItem("selene-session")) {
    sessionStorage.setItem("selene-session", "1");
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshWeather(); });
refreshWeather();
(async () => {
  try {
    if (!window.claude || !window.claude.use) {
      if (authReady()) { await authBoot(); render(); }
      return;
    }
    const db = await window.claude.use("db");
    if (db) { await site.connect(db); await board.connect(db); } // le site d'abord (voir absorbBoard)
  } catch {}
  try { if (window.claude && window.claude.use) { sampleNS = await window.claude.use("sample"); downloadsNS = await window.claude.use("downloads"); render(); } } catch {}
})();
