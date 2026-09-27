/* Démarrage : chargé en dernier par build.py, quand toutes les vues et tous les registres existent. */
/* ================= cycle de vie ================= */
const flushAll = () => { board.flush(); site.flush(); };
window.addEventListener("pagehide", flushAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
window.addEventListener("storage", e => { if ((e.key === board.key && board.reload()) | (e.key === site.key && site.reload())) render(); });
if (!window.claude) { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {} }

/* ================= boot ================= */
render();
(async () => {
  try {
    if (!window.claude || !window.claude.use) {
      if (authReady()) { await authBoot(); render(); }
      return;
    }
    const db = await window.claude.use("db");
    if (db) await Promise.all([board.connect(db), site.connect(db)]);
  } catch {}
  try { if (window.claude && window.claude.use) { sampleNS = await window.claude.use("sample"); downloadsNS = await window.claude.use("downloads"); render(); } } catch {}
})();
