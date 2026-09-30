/* Amorçage des coquilles natives (ADR 15) : posé par build.py dans dist/native/index.html, avant le script de Selene.
   Sous Capacitor (Android, iOS), il fabrique les deux coffres que platform.js attend (window.seleneNative, ADR 11) :
   - storage : un fichier par clé dans le dossier privé de l'app (plugin Filesystem), sans plafond de taille ; chaque
     écriture passe par un fichier temporaire renommé ensuite, pour qu'une coupure n'en laisse jamais un à moitié écrit ;
   - secrets : le trousseau du système (plugin SecureStorage : clé AES-GCM gardée dans l'Android Keystore ou le
     Trousseau iOS), sous le préfixe « selene: ».
   Il relie aussi le bouton retour d'Android à l'historique de la page, et la mise en arrière-plan à « pagehide »
   (Selene y pousse ce qui attend).
   Sous Tauri (ordinateur, ADR 16), les mêmes coffres passent par six commandes de l'app (native/tauri/src/main.rs) :
   fichiers du dossier de données, et coffre du système pour les secrets. Hors d'une coquille native, il ne fait rien. */
(() => {
  const T = window.__TAURI__;
  if (T && T.core && typeof T.core.invoke === "function") {
    const call = T.core.invoke;
    const vault = kind => ({
      load: () => call(`${kind}_load`),
      write: (key, value) => call(`${kind}_write`, { key, value }),
      remove: key => call(`${kind}_remove`, { key })
    });
    window.seleneNative = { runtime: "tauri", storage: vault("store"), secrets: vault("secret") };
    // Un partage venu du cœur (lien selene://share, ADR 17) : rangé dans la file que Selene lit à son démarrage, et
    // qu'elle prend aussitôt si elle tourne déjà. Premier script de la page : rien n'est perdu pendant l'amorçage.
    document.addEventListener("selene:share", e => {
      const d = (e && e.detail) || {}, s = v => String(v || "").slice(0, 4000);
      try { sessionStorage.setItem("selene-share", JSON.stringify({ url: s(d.url), title: s(d.title), text: s(d.text) })); } catch {}
    });
    return;
  }
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return;
  const { Filesystem, SecureStorage, App } = C.Plugins;
  const DIR = "DATA", ROOT = "selene", TMP = ".tmp";
  const file = k => `${ROOT}/${encodeURIComponent(k)}`;
  const storage = {
    async load() {
      let names;
      try { names = (await Filesystem.readdir({ path: ROOT, directory: DIR })).files.map(f => (typeof f === "string" ? f : f.name)); }
      catch { await Filesystem.mkdir({ path: ROOT, directory: DIR, recursive: true }).catch(() => {}); return []; }
      // Un fichier temporaire resté seul (coupure avant le renommage) est la dernière écriture complète : on le garde.
      const final = new Set(names.filter(n => !n.endsWith(TMP)));
      const read = names.filter(n => !n.endsWith(TMP) || !final.has(n.slice(0, -TMP.length)));
      return Promise.all(read.map(async n => {
        const { data } = await Filesystem.readFile({ path: `${ROOT}/${n}`, directory: DIR, encoding: "utf8" });
        return [decodeURIComponent(n.endsWith(TMP) ? n.slice(0, -TMP.length) : n), data];
      }));
    },
    async write(k, v) {
      await Filesystem.writeFile({ path: file(k) + TMP, directory: DIR, data: v, encoding: "utf8", recursive: true });
      await Filesystem.deleteFile({ path: file(k), directory: DIR }).catch(() => {});
      await Filesystem.rename({ from: file(k) + TMP, to: file(k), directory: DIR, toDirectory: DIR });
    },
    remove: k => Filesystem.deleteFile({ path: file(k), directory: DIR }).catch(() => {})
  };
  const PREFIX = "selene:";
  const secrets = {
    async load() {
      const { keys } = await SecureStorage.internalGetPrefixedKeys({ prefix: PREFIX });
      const names = (keys || []).map(k => (k.startsWith(PREFIX) ? k.slice(PREFIX.length) : k));
      return Promise.all(names.map(async k => [k, (await SecureStorage.internalGetItem({ prefixedKey: PREFIX + k })).data]));
    },
    write: (k, v) => SecureStorage.internalSetItem({ prefixedKey: PREFIX + k, data: v }),
    remove: k => SecureStorage.internalRemoveItem({ prefixedKey: PREFIX + k })
  };
  window.seleneNative = { runtime: "capacitor", storage, secrets };
  if (App) {
    App.addListener("backButton", e => { if (e && e.canGoBack) history.back(); else App.exitApp(); });
    App.addListener("pause", () => window.dispatchEvent(new Event("pagehide")));
  }
})();
