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
/* Une copie entière ne tient pas toujours : Safari plafonne localStorage vers 2,5 millions de caractères par site, et un
   espace de 3 Mo n'y entre pas (A65 du cahier de recette : la capture de la dernière seconde était perdue). La copie dit
   alors seulement ce qui sépare la valeur en route de celle qu'IndexedDB tient déjà : des plages à recopier de
   celle-ci ([début, fin]) et des morceaux nouveaux (du texte). Une écriture change d'ordinaire peu de choses (un
   horodatage réécrit, une capture insérée) : les plages égales se cherchent en avançant depuis le début, au même
   décalage, puis en reculant depuis la fin, au décalage des longueurs ; un écart court entre deux plages égales
   (moins de SAUT caractères, puis ACCROCHE égaux) devient un morceau nouveau. Exactes par construction, quoi qu'il
   arrive : au pire, la copie grossit. */
const SAUT = 256, ACCROCHE = 32;
export function delta(a, b) { // exportée pour les tests
  const n = Math.min(a.length, b.length), head = [], tail = [];
  // Depuis le début : a[i] et b[i] côte à côte.
  let i = 0, from = 0;
  for (;;) {
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    if (i >= n) break;
    let k = i, run = 0;
    while (k < n && k - i < SAUT + ACCROCHE && run < ACCROCHE) { run = a.charCodeAt(k) === b.charCodeAt(k) ? run + 1 : 0; k++; }
    if (run < ACCROCHE) break;
    const back = k - ACCROCHE;
    head.push([from, i], b.slice(i, back)); from = i = back;
  }
  head.push([from, i]);
  // Depuis la fin : a[a.length - 1 - t] et b[b.length - 1 - t], sans revenir sur ce que le début a déjà pris.
  const room = n - i, A = a.length, B = b.length;
  let t = 0, upto = 0;
  for (;;) {
    while (t < room && a.charCodeAt(A - 1 - t) === b.charCodeAt(B - 1 - t)) t++;
    if (t >= room) break;
    let k = t, run = 0;
    while (k < room && k - t < SAUT + ACCROCHE && run < ACCROCHE) { run = a.charCodeAt(A - 1 - k) === b.charCodeAt(B - 1 - k) ? run + 1 : 0; k++; }
    if (run < ACCROCHE) break;
    const back = k - ACCROCHE;
    tail.push([A - t, A - upto], b.slice(B - back, B - t)); upto = t = back;
  }
  tail.push([A - t, A - upto]);
  const ops = [...head, b.slice(i, B - t), ...tail.reverse()];
  return ops.filter(o => (typeof o === "string" ? o.length : o[1] > o[0]));
}
// Rend la valeur, ou null si la copie ne s'applique pas à cette base.
export function undelta(a, ops) {
  const out = [];
  for (const o of ops) {
    if (typeof o === "string") out.push(o);
    else if (Array.isArray(o) && Number.isInteger(o[0]) && Number.isInteger(o[1]) && o[0] >= 0 && o[0] <= o[1] && o[1] <= a.length) out.push(a.slice(o[0], o[1]));
    else return null;
  }
  return out.join("");
}
// L'empreinte de la base d'une copie différentielle (53 bits, cyrb53) : la reconnaître au démarrage suivant.
export function digest(s) {
  const imul = Math.imul; // une fois : la boucle passe des millions de fois
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = imul(h1 ^ c, 2654435761); h2 = imul(h2 ^ c, 1597334677); }
  h1 = imul(h1 ^ (h1 >>> 16), 2246822507) ^ imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = imul(h2 ^ (h2 >>> 16), 2246822507) ^ imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export function mirror(vault, written = () => {}, rescueArea = null) { // exportée pour les tests
  const m = new Map(), last = new Map(), inflight = new Map(); // inflight : clé → valeur pas encore écrite (null : effacée)
  const held = new Map(); // clé → la valeur que le coffre tient, sûrement : lue, ou écrite et confirmée
  // Une écriture attend la précédente sur la même clé : un coffre asynchrone ne doit pas les inverser.
  const send = (k, v, fn) => {
    inflight.set(k, v);
    let ok = false;
    const q = (last.get(k) || Promise.resolve()).then(fn).then(() => { ok = true; if (v === null) held.delete(k); else held.set(k, v); try { written(k); } catch {} }, () => {});
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
      m.clear(); held.clear();
      for (const [k, v] of await vault.load()) if (typeof k === "string" && typeof v === "string") { m.set(k, v); held.set(k, v); }
    },
    // Une autre fenêtre a écrit cette clé : la relire dans le coffre. Une valeur refusée ici, qui attendait encore,
    // n'est plus à sauver : celle de l'autre fenêtre a abouti, et elle est plus récente.
    async refresh(k) {
      const v = await vault.get(k);
      if (typeof v === "string") { m.set(k, v); held.set(k, v); } else { m.delete(k); held.delete(k); }
      if (!last.has(k)) inflight.delete(k);
    },
    get: k => (m.has(k) ? m.get(k) : null),
    set(k, v) { v = String(v); m.set(k, v); send(k, v, () => vault.write(k, v)); return true; },
    remove(k) { m.delete(k); send(k, null, () => vault.remove(k)); },
    keys: () => [...m.keys()],
    /* Synchrone : à la fermeture, rien d'asynchrone n'est sûr d'aboutir. Les copies de base de la synchronisation en
       dernier : si la place manque (localStorage plafonne vers 5 Mo), mieux vaut garder le document que sa base. */
    rescue() {
      if (!rescueArea) return;
      const order = [...inflight].sort(([a], [b]) => a.endsWith("-base") - b.endsWith("-base"));
      for (const [k, v] of order) {
        if (rescueArea.set(RESCUE + k, JSON.stringify({ v }))) continue;
        // Trop lourde : la différence avec ce que le coffre tient, et l'empreinte de cette base (voir delta).
        const base = held.get(k);
        if (typeof v === "string" && typeof base === "string") rescueArea.set(RESCUE + k, JSON.stringify({ d: delta(base, v), n: base.length, h: digest(base) }));
      }
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
   une transaction, puis quittent localStorage. Une copie illisible est simplement retirée ; une copie différentielle ne
   s'applique qu'à la valeur exacte d'où elle part (sa longueur, son empreinte), sinon elle est retirée aussi : le coffre
   tient alors autre chose, d'ordinaire l'écriture elle-même, qui avait abouti. */
export async function restoreRescue(vault, area) {
  const found = area.keys().filter(k => k.startsWith(RESCUE)), entries = [];
  for (const rk of found) {
    let c;
    try { c = JSON.parse(area.get(rk)); } catch { continue; }
    const k = rk.slice(RESCUE.length);
    if (!c || typeof c !== "object") continue;
    if (typeof c.v === "string" || c.v === null) entries.push([k, c.v]);
    else if (Array.isArray(c.d) && vault.get) {
      const base = await vault.get(k), v = typeof base === "string" && base.length === c.n && digest(base) === c.h ? undelta(base, c.d) : null;
      if (v !== null) entries.push([k, v]);
    }
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
