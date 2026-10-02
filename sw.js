// Selene : service worker. Réseau d'abord pour la page (les mises à jour arrivent),
// cache d'abord pour les polices (servies par le site, fonts/) et les icônes, jamais de cache pour l'API Anthropic.
const CACHE = "selene-v2"; // v2 : les polices ne viennent plus de Google ; l'activation efface l'ancien cache
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.hostname === "api.anthropic.com" || /(^|\.)supabase\.co$/.test(url.hostname)) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put("./index.html", c)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && url.origin === location.origin) { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
    return r;
  })));
});
