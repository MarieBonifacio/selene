/* ================= plateforme =================
   Le seul fichier qui touche aux API de l'hôte : stockage du navigateur, window.claude, persistance.
   Le reste de Selene passe par `platform`, pour qu'une coquille native (Capacitor, Tauri) remplace un
   branchement sans toucher au domaine ni aux vues. Chargé en premier par build.py.
   - storage : les données ordinaires de l'appareil (documents, caches, préférences, brouillons) ;
   - secrets : ce qui ouvre un compte ou engage une facture (session, clés d'API, adresse privée d'agenda) ;
     sur le web, le même localStorage (risque accepté, docs/architecture.md), sur mobile le trousseau du système ;
   - session : ce qui ne vit que le temps de l'onglet (défilement, partage reçu avant connexion) ;
   - claude : les espaces de noms de l'artefact claude.ai (db, sample, downloads), null ailleurs.
   Toutes les opérations sont sûres : un stockage refusé (navigation privée, quota) rend null ou false,
   jamais une exception. */
const webStore = area => ({
  get(k) { try { return area().getItem(k); } catch { return null; } },
  set(k, v) { try { area().setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { area().removeItem(k); } catch {} },
  keys() {
    const out = [];
    try { const a = area(); for (let i = 0; i < a.length; i++) { const k = a.key(i); if (k) out.push(k); } } catch {}
    return out;
  }
});
const platform = {
  // "artifact" (claude.ai) ou "web" (PWA, navigateur) ; plus tard "capacitor" et "tauri".
  runtime: () => window.claude ? "artifact" : "web",
  storage: {
    ...webStore(() => localStorage),
    // Une autre fenêtre du même appareil a changé une clé (événement « storage » du web).
    watch(cb) { window.addEventListener("storage", e => { if (e.key) cb(e.key); }); }
  },
  secrets: webStore(() => localStorage),
  session: webStore(() => sessionStorage),
  claude: {
    available: () => !!(window.claude && window.claude.use),
    use: async ns => (window.claude && window.claude.use ? window.claude.use(ns) : null)
  },
  // Demande au navigateur de ne pas évincer les données locales sous la pression d'espace (PWA seulement).
  persist() { if (platform.runtime() !== "web") return; try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {} }
};
const hosted = () => platform.runtime() !== "artifact";
