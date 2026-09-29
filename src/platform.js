/* ================= plateforme =================
   Le seul fichier qui touche aux API de l'hôte : stockage du navigateur, window.claude, persistance.
   Le reste de Selene passe par `platform`, pour qu'une coquille native (Capacitor, Tauri) remplace un
   branchement sans toucher au domaine ni aux vues. Premier fichier historique (build.py) : tout ce qui suit
   démarre par platform.ready.
   - storage : les données ordinaires de l'appareil (documents, caches, préférences, brouillons) ;
   - secrets : ce qui ouvre un compte ou engage une facture (session, clés d'API, adresse privée d'agenda) ;
     sur le web, le même localStorage (risque accepté, docs/architecture.md), sur mobile le trousseau du système ;
   - session : ce qui ne vit que le temps de l'onglet (défilement, partage reçu avant connexion) ;
   - claude : les espaces de noms de l'artefact claude.ai (db, sample, downloads), null ailleurs.
   Toutes les opérations sont sûres : un stockage refusé (navigation privée, quota) rend null ou false,
   jamais une exception.

   Deux sortes de coffres derrière storage et secrets, une seule façade (get / set / remove / keys, synchrones) :
   - web : localStorage, synchrone, lu et écrit en direct (une copie en mémoire n'y gagnerait rien, et un
     autre onglet ou les outils du navigateur la rendraient périmée) ;
   - natif : la coquille pose, avant le script, `window.seleneNative = { runtime, storage, secrets }`, deux
     coffres asynchrones { load() → Promise<[clé, valeur][]>, write(clé, valeur) → Promise, remove(clé) → Promise }.
     Selene lit alors une copie en mémoire, hydratée une fois avant le démarrage (platform.ready) ; chaque
     écriture part vers le coffre sans être attendue, dans l'ordre pour une même clé, et platform.flush()
     attend celles en cours (mise en arrière-plan, fermeture). */
const native = window.seleneNative || null;
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
const pendingWrites = new Set();
function mirror(vault) {
  const m = new Map(), last = new Map();
  // Une écriture attend la précédente sur la même clé : un coffre asynchrone ne doit pas les inverser.
  const send = (k, fn) => {
    const q = (last.get(k) || Promise.resolve()).then(fn).then(() => {}, () => {});
    last.set(k, q); pendingWrites.add(q);
    q.then(() => { pendingWrites.delete(q); if (last.get(k) === q) last.delete(k); });
  };
  return {
    async hydrate() {
      m.clear();
      for (const [k, v] of await vault.load()) if (typeof k === "string" && typeof v === "string") m.set(k, v);
    },
    get: k => (m.has(k) ? m.get(k) : null),
    set(k, v) { v = String(v); m.set(k, v); send(k, () => vault.write(k, v)); return true; },
    remove(k) { m.delete(k); send(k, () => vault.remove(k)); },
    keys: () => [...m.keys()]
  };
}
const vaultFor = (name, area) => (native && native[name] ? mirror(native[name]) : webStore(area));
const platform = {
  // "artifact" (claude.ai), "web" (PWA, navigateur), ou ce que dit la coquille native ("capacitor", "tauri").
  runtime: () => window.claude ? "artifact" : native ? String(native.runtime || "native") : "web",
  storage: {
    ...vaultFor("storage", () => localStorage),
    // Une autre fenêtre du même appareil a changé une clé (événement « storage » du web ; une coquille native
    // n'a qu'une fenêtre).
    watch(cb) { if (!native) window.addEventListener("storage", e => { if (e.key) cb(e.key); }); }
  },
  secrets: vaultFor("secrets", () => localStorage),
  session: webStore(() => sessionStorage),
  claude: {
    available: () => !!(window.claude && window.claude.use),
    use: async ns => (window.claude && window.claude.use ? window.claude.use(ns) : null)
  },
  /* Démarre Selene quand le stockage est lisible : aussitôt sur le web et dans l'artefact (synchrone, comme
     avant), après l'hydratation des coffres en natif. Si elle échoue, rien ne démarre : une app vide
     écraserait, au premier enregistrement, les données restées dans le coffre. */
  ready(start) {
    if (!native) return start();
    Promise.all([platform.storage.hydrate, platform.secrets.hydrate].map(h => (h ? h() : null))).then(() => start(), () => {
      document.body.textContent = "Selene n'a pas pu lire les données de cet appareil. Ferme l'application et rouvre-la.";
    });
  },
  // Les écritures en cours vers un coffre natif (rien à attendre sur le web).
  async flush() { while (pendingWrites.size) await Promise.all([...pendingWrites]); },
  // Demande au navigateur de ne pas évincer les données locales sous la pression d'espace (PWA seulement).
  persist() { if (platform.runtime() !== "web") return; try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {} }
};
const hosted = () => platform.runtime() !== "artifact";
