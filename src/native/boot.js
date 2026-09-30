/* Amorçage des coquilles natives (ADR 15) : posé par build.py dans dist/native/index.html, avant le script de Selene.
   Sous Capacitor (Android, iOS), il fabrique les deux coffres que platform.js attend (window.seleneNative, ADR 11) :
   - storage : un fichier par clé dans le dossier privé de l'app (plugin Filesystem), sans plafond de taille ; chaque
     écriture passe par un fichier temporaire renommé ensuite, pour qu'une coupure n'en laisse jamais un à moitié écrit ;
   - secrets : le trousseau du système (plugin SecureStorage : clé AES-GCM gardée dans l'Android Keystore ou le
     Trousseau iOS), sous le préfixe « selene: ».
   Il relie aussi le bouton retour d'Android à l'historique de la page, et la mise en arrière-plan à « pagehide »
   (Selene y pousse ce qui attend). Enfin (ADR 19), les notifications locales (le résumé du matin, programmé par le
   système : il sonne app fermée, sans serveur) et un léger retour haptique à la capture.
   Sous Tauri (ordinateur, ADR 16), les mêmes coffres passent par six commandes de l'app (native/tauri/src/main.rs) :
   fichiers du dossier de données, et coffre du système pour les secrets. Hors d'une coquille native, il ne fait rien. */
(() => {
  // Un partage (lien selene://share, ADR 17-18) : rangé dans la file que Selene lit à son démarrage (celle du Web Share
  // Target), et qu'elle prend aussitôt si elle tourne déjà. Premier script de la page : rien n'est perdu pendant
  // l'amorçage.
  const keepShares = () => document.addEventListener("selene:share", e => {
    const d = (e && e.detail) || {}, s = v => String(v || "").slice(0, 4000);
    try { sessionStorage.setItem("selene-share", JSON.stringify({ url: s(d.url), title: s(d.title), text: s(d.text) })); } catch {}
  });
  // Un lien selene:// reçu par l'app (Capacitor : iOS, Android) devient l'événement que Selene attend.
  const openLink = href => {
    let u; try { u = new URL(href); } catch { return; }
    if (u.protocol !== "selene:") return;
    if (u.hostname === "capture") document.dispatchEvent(new CustomEvent("selene:capture"));
    else if (u.hostname === "share") {
      const q = k => u.searchParams.get(k) || "";
      document.dispatchEvent(new CustomEvent("selene:share", { detail: { url: q("url"), title: q("title"), text: q("text") } }));
    }
  };
  const T = window.__TAURI__;
  if (T && T.core && typeof T.core.invoke === "function") {
    const call = T.core.invoke;
    const vault = kind => ({
      load: () => call(`${kind}_load`),
      write: (key, value) => call(`${kind}_write`, { key, value }),
      remove: key => call(`${kind}_remove`, { key })
    });
    window.seleneNative = { runtime: "tauri", storage: vault("store"), secrets: vault("secret") };
    keepShares(); // le cœur Rust envoie lui-même les événements (native/tauri/src/main.rs)
    return;
  }
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return;
  const { Filesystem, SecureStorage, App, LocalNotifications, Haptics } = C.Plugins;
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
  // Notifications : Selene donne la liste complète de ce qui doit sonner ; tout ce qui était programmé est remplacé.
  // Une vraie Date (le pont d'iOS la transmet telle quelle, celui d'Android en ISO, le format que lit le plugin).
  const notifications = LocalNotifications && {
    permission: async () => (await LocalNotifications.requestPermissions()).display,
    async replace(list) {
      const { notifications: old = [] } = await LocalNotifications.getPending();
      if (old.length) await LocalNotifications.cancel({ notifications: old.map(n => ({ id: n.id })) });
      if (list.length) await LocalNotifications.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true } })) });
    }
  };
  const haptic = () => { if (Haptics) Haptics.impact({ style: "LIGHT" }).catch(() => {}); };
  window.seleneNative = { runtime: "capacitor", storage, secrets, notifications, haptic };
  keepShares();
  if (App) {
    App.addListener("appUrlOpen", e => openLink(e && e.url));
    if (App.getLaunchUrl) App.getLaunchUrl().then(r => { if (r && r.url) openLink(r.url); }, () => {});
    App.addListener("backButton", e => { if (e && e.canGoBack) history.back(); else App.exitApp(); });
    App.addListener("pause", () => window.dispatchEvent(new Event("pagehide")));
  }
})();
