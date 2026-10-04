/* ================= plateforme =================
   Le seul fichier qui touche aux API de l'hôte : stockage du navigateur, window.claude, persistance.
   Le reste de Selene passe par `platform`, pour qu'une coquille native (Capacitor, Tauri) remplace un
   branchement sans toucher au domaine ni aux vues. Assemblé à part et évalué avant l'application
   (build.py, scripts/bundle.mjs) : l'application ne démarre que par platform.ready.
   - storage : les données ordinaires de l'appareil (documents, caches, préférences, brouillons) ;
   - secrets : ce qui ouvre un compte ou engage une facture (session, clés d'API, adresse privée d'agenda) ;
     sur le web, localStorage (risque accepté, docs/architecture.md), sur mobile le trousseau du système ;
   - session : ce qui ne vit que le temps de l'onglet (défilement, partage reçu avant connexion) ;
   - claude : les espaces de noms de l'artefact claude.ai (db, sample, downloads), null ailleurs.
   Toutes les opérations sont sûres : un stockage refusé (navigation privée, quota) rend null ou false,
   jamais une exception.

   Derrière storage et secrets, une seule façade (get / set / remove / keys, synchrones), et trois sortes de coffres :
   - localStorage, synchrone, lu et écrit en direct : les secrets sur le web, tout dans l'artefact claude.ai, et
     le repli quand IndexedDB manque ;
   - IndexedDB, pour storage dans la version web (ADR 13) : localStorage plafonne vers 5 Mo par site, et un
     historique de plusieurs années, avec la copie de base de la synchronisation, s'en approche ;
   - natif : la coquille pose, avant le script, `window.seleneNative = { runtime, storage, secrets }`, deux
     coffres asynchrones { load() → Promise<[clé, valeur][]>, write(clé, valeur) → Promise, remove(clé) → Promise }.
   Un coffre asynchrone est lu dans une copie en mémoire, hydratée une fois avant le démarrage (platform.ready) ;
   chaque écriture part sans être attendue, dans l'ordre pour une même clé, et platform.flush() attend celles en
   cours (mise en arrière-plan, fermeture). */
const native = window.seleneNative || null;
// Les clés de platform.secrets : sur le web, elles restent dans localStorage, jamais copiées dans IndexedDB.
export const SECRET_KEYS = ["selene-auth-session", "selene-api-key", "selene-openalex-key", "selene-zotero-key", "selene-ics-url"];
export const webStore = area => ({
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
/* La copie de secours (web) : une écriture d'IndexedDB lancée juste avant la fermeture de la page peut ne jamais
   aboutir, la page disparaissant avant sa transaction (une capture faite dans la dernière demi-seconde était perdue).
   localStorage, lui, écrit tout de suite et survit à la fermeture : platform.flush(), appelé à la fermeture et à la
   mise en arrière-plan, y dépose la dernière valeur de chaque clé encore en route, sous ce préfixe ; le démarrage
   suivant la reverse dans IndexedDB (restoreRescue). Une écriture qui aboutit retire la copie de sa clé, dans cet
   onglet comme dans un autre : une copie ne peut donc pas être plus ancienne que ce qu'IndexedDB tient déjà. Une
   écriture qu'IndexedDB refuse (quota plein, transaction annulée) reste en route, et sa copie la sauvera ; une écriture
   de la même clé qui aboutit, ici ou dans un autre onglet, la remplace. */
export const RESCUE = "selene-secours:";
export function mirror(vault, written = () => {}, rescueArea = null) { // exportée pour les tests
  const m = new Map(), last = new Map(), inflight = new Map(); // inflight : clé → valeur pas encore écrite (null : effacée)
  // Une écriture attend la précédente sur la même clé : un coffre asynchrone ne doit pas les inverser.
  const send = (k, v, fn) => {
    inflight.set(k, v);
    let ok = false;
    const q = (last.get(k) || Promise.resolve()).then(fn).then(() => { ok = true; try { written(k); } catch {} }, () => {});
    last.set(k, q); pendingWrites.add(q);
    q.then(() => {
      pendingWrites.delete(q);
      if (last.get(k) !== q) return; // une écriture plus récente de la même clé est en route
      last.delete(k);
      if (!ok) return; // refusée : la valeur reste à sauver, seulement en mémoire ; la copie de secours la gardera
      inflight.delete(k);
      if (rescueArea) rescueArea.remove(RESCUE + k);
    });
  };
  return {
    async hydrate() {
      m.clear();
      for (const [k, v] of await vault.load()) if (typeof k === "string" && typeof v === "string") m.set(k, v);
    },
    // Une autre fenêtre a écrit cette clé : la relire dans le coffre. Une valeur refusée ici, qui attendait encore,
    // n'est plus à sauver : celle de l'autre fenêtre a abouti, et elle est plus récente.
    async refresh(k) { const v = await vault.get(k); if (typeof v === "string") m.set(k, v); else m.delete(k); if (!last.has(k)) inflight.delete(k); },
    get: k => (m.has(k) ? m.get(k) : null),
    set(k, v) { v = String(v); m.set(k, v); send(k, v, () => vault.write(k, v)); return true; },
    remove(k) { m.delete(k); send(k, null, () => vault.remove(k)); },
    keys: () => [...m.keys()],
    /* Synchrone : à la fermeture, rien d'asynchrone n'est sûr d'aboutir. Les copies de base de la synchronisation en
       dernier : si la place manque (localStorage plafonne vers 5 Mo), mieux vaut garder le document que sa base. */
    rescue() {
      if (!rescueArea) return;
      const order = [...inflight].sort(([a], [b]) => a.endsWith("-base") - b.endsWith("-base"));
      for (const [k, v] of order) rescueArea.set(RESCUE + k, JSON.stringify({ v }));
    }
  };
}

/* IndexedDB : la base « selene », un magasin « kv » (clé → texte), comme localStorage mais sans son plafond. */
function idbVault() {
  let base = null;
  const open = () => base || (base = new Promise((ok, ko) => {
    const r = indexedDB.open("selene", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error("IndexedDB bloquée"));
  }));
  const tx = (mode, fn) => open().then(db => new Promise((ok, ko) => {
    const t = db.transaction("kv", mode), req = fn(t.objectStore("kv"));
    t.oncomplete = () => ok(req && req.result); t.onerror = t.onabort = () => ko(t.error);
  }));
  return {
    open,
    load: async () => {
      const [keys, values] = await Promise.all([tx("readonly", s => s.getAllKeys()), tx("readonly", s => s.getAll())]);
      return keys.map((k, i) => [k, values[i]]);
    },
    get: k => tx("readonly", s => s.get(k)),
    write: (k, v) => tx("readwrite", s => s.put(v, k)),
    remove: k => tx("readwrite", s => s.delete(k)),
    // Plusieurs clés d'un coup, dans une seule transaction : toutes ou aucune (une valeur nulle efface la clé).
    writeAll: entries => tx("readwrite", s => { for (const [k, v] of entries) if (v == null) s.delete(k); else s.put(v, k); })
  };
}
/* Au démarrage, avant tout : les copies de secours laissées par une fermeture (voir RESCUE) rejoignent IndexedDB, en
   une transaction, puis quittent localStorage. Une copie illisible est simplement retirée. */
export async function restoreRescue(vault, area) {
  const found = area.keys().filter(k => k.startsWith(RESCUE)), entries = [];
  for (const rk of found) {
    let v;
    try { v = JSON.parse(area.get(rk)).v; } catch { continue; }
    if (typeof v === "string" || v === null) entries.push([rk.slice(RESCUE.length), v]);
  }
  if (entries.length) await vault.writeAll(entries);
  for (const rk of found) area.remove(rk);
}
/* Première ouverture après localStorage (et toute clé qu'une ancienne version y écrirait encore) : chaque clé
   ordinaire absente d'IndexedDB y est copiée, en une transaction ; ce n'est qu'après qu'elle quitte localStorage.
   IndexedDB l'emporte quand elle a déjà la clé : la copie de localStorage est alors une trace périmée. */
export async function migrateToIdb(vault, area) {
  const present = new Set((await vault.load()).map(([k]) => k));
  const legacy = [];
  for (const k of area.keys()) if (!SECRET_KEYS.includes(k) && !k.startsWith(RESCUE)) legacy.push([k, area.get(k)]);
  const missing = legacy.filter(([k, v]) => !present.has(k) && typeof v === "string");
  if (missing.length) await vault.writeAll(missing);
  for (const [k] of legacy) area.remove(k);
}

// storage délègue à son coffre, choisi au démarrage (localStorage tant qu'IndexedDB n'est pas prête).
let storageImpl = native && native.storage ? mirror(native.storage) : webStore(() => localStorage);
let channel = null;
const watchers = [];
/* Le message d'un démarrage impossible (données illisibles). Il s'affiche avant l'interface et sans les données, donc
   sans le réglage de langue du compte : la langue de l'appareil, en anglais ou en français (le français sinon), comme
   l'interface en l'absence de choix. Pas de module de traduction ici : platform.js reste la seule couche de l'hôte. */
const UNREADABLE = {
  fr: "Selene n'a pas pu lire les données de cet appareil. Ferme l'application et rouvre-la.",
  en: "Selene couldn't read this device's data. Close the app and open it again."
};
export function unreadable(languages = typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : []) {
  for (const tag of languages) { const base = String(tag || "").toLowerCase().split("-")[0]; if (Object.hasOwn(UNREADABLE, base)) return UNREADABLE[base]; }
  return UNREADABLE.fr;
}
export const platform = {
  // "artifact" (claude.ai), "web" (PWA, navigateur), ou ce que dit la coquille native ("capacitor", "tauri").
  runtime: () => window.claude ? "artifact" : native ? String(native.runtime || "native") : "web",
  secretKeys: SECRET_KEYS,
  storage: {
    get: k => storageImpl.get(k),
    set: (k, v) => storageImpl.set(k, v),
    remove: k => storageImpl.remove(k),
    keys: () => storageImpl.keys(),
    // Une autre fenêtre du même appareil a changé une clé : événement « storage » avec localStorage, message
    // d'un autre onglet avec IndexedDB (une coquille native n'a qu'une fenêtre).
    watch(cb) {
      watchers.push(cb);
      if (!native && watchers.length === 1) window.addEventListener("storage", e => { if (e.key && storageImpl.refresh === undefined) watchers.forEach(w => w(e.key)); });
    }
  },
  secrets: native && native.secrets ? mirror(native.secrets) : webStore(() => localStorage),
  session: webStore(() => sessionStorage),
  claude: {
    available: () => !!(window.claude && window.claude.use),
    use: async ns => (window.claude && window.claude.use ? window.claude.use(ns) : null)
  },
  /* Démarre Selene quand le stockage est lisible.
     - artifact, ou web sans IndexedDB : aussitôt, de façon synchrone, sur localStorage ;
     - web : après l'ouverture d'IndexedDB et la migration ; si IndexedDB ne s'ouvre pas, ou si la migration
       échoue avant d'avoir vidé localStorage, sur localStorage (rien n'a quitté l'appareil) ;
     - natif : après l'hydratation des coffres.
     Si un coffre qui détient les données devient illisible, rien ne démarre : une app vide écraserait, au
     premier enregistrement, les données restées dans le coffre. */
  ready(start) {
    const fail = () => { document.body.textContent = unreadable(); };
    if (native) {
      Promise.all([storageImpl, platform.secrets].map(s => (s.hydrate ? s.hydrate() : null))).then(() => start(), fail);
      return;
    }
    let idb = null;
    try { idb = platform.runtime() === "web" && window.indexedDB ? idbVault() : null; } catch { idb = null; }
    if (!idb) return start();
    const local = webStore(() => localStorage);
    // Une copie de secours qui ne passe pas (IndexedDB refuse l'écriture) reste dans localStorage pour le démarrage
    // suivant : elle n'empêche pas celui-ci.
    idb.open().then(() => restoreRescue(idb, local).catch(() => {})).then(() => migrateToIdb(idb, local)).then(() => {
      try { channel = new BroadcastChannel("selene-storage"); } catch { channel = null; }
      const m = mirror(idb, k => { if (channel) channel.postMessage(k); }, local);
      return m.hydrate().then(() => {
        storageImpl = m;
        if (channel) channel.onmessage = e => { const k = e.data; if (typeof k === "string") m.refresh(k).then(() => watchers.forEach(w => w(k)), () => {}); };
        start();
      }, fail);
    }, () => start());
  },
  /* Les écritures en cours vers un coffre asynchrone (rien à attendre avec localStorage). D'abord, tout de suite, la
     copie de secours de ce qui est encore en route (web) : la page peut disparaître avant la suite. */
  async flush() {
    if (storageImpl.rescue) storageImpl.rescue();
    while (pendingWrites.size) await Promise.all([...pendingWrites]);
  },
  /* Notifications locales (ADR 19), dans une coquille native seulement : programmées par le système, elles sonnent
     app fermée. Sur le web, rien (une notification de page exige qu'elle tourne, ou un serveur de push). */
  notifications: {
    supported: () => !!(native && native.notifications),
    permission: async () => (native && native.notifications ? native.notifications.permission() : "denied"),
    replace: async list => { if (native && native.notifications) await native.notifications.replace(list); }
  },
  // Le widget d'écran d'accueil (ADR 24) : ce qu'il affiche, envoyé par la page ; seulement là où la coquille en a un.
  widget: {
    supported: () => !!(native && native.widget),
    update: async data => { if (native && native.widget) await native.widget.update(data); }
  },
  /* Donner un fichier (sauvegarde, export) dans une coquille native qui sait le faire : écrit sur l'appareil, puis
     confié à la feuille de partage du système. Ailleurs, le navigateur s'en charge (lib/download.js). Rejette si la
     personne referme la feuille (« Share canceled ») ou si l'écriture échoue. */
  files: {
    supported: () => !!(native && native.files),
    share: (filename, data, title) => native.files.share(filename, data, title)
  },
  // Un léger retour haptique (une capture enregistrée) ; rien là où l'hôte n'en a pas.
  haptic() { try { if (native && native.haptic) native.haptic(); } catch {} },
  // Demande au navigateur de ne pas évincer les données locales sous la pression d'espace (PWA seulement).
  persist() { if (platform.runtime() !== "web") return; try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {} }
};
export const hosted = () => platform.runtime() !== "artifact";
