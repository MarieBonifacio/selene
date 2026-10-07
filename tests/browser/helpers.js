/* Outils communs aux scénarios de navigateur (tests/browser/*.js), lancés par run.js.
   Chaque scénario pilote un vrai navigateur (Chromium, WebKit ou Firefox) via Playwright et affiche ✓ / ✗ ; un seul ✗, ou une erreur
   non rattrapée, fait échouer le scénario (code de sortie 1), donc la CI. */
const fs = require('node:fs');
const path = require('node:path');

// Playwright : celui de package.json (npm ci), sinon celui de la machine (installation globale).
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(process.execPath, '..', '..', 'lib', 'node_modules', 'playwright')); }
// Moteur : Chromium par défaut, SELENE_BROWSER=webkit pour celui de Safari, des WebView iOS et de Tauri (macOS, Linux),
// SELENE_BROWSER=firefox pour Gecko (Firefox sur ordinateur, BL-13).
const ENGINE = process.env.SELENE_BROWSER || 'chromium';
if (!['chromium', 'webkit', 'firefox'].includes(ENGINE)) throw new Error('SELENE_BROWSER : chromium, webkit ou firefox, pas « ' + ENGINE + ' »');
/* Les scénarios lisent l'interface en français : la langue du navigateur est fixée (fr-FR), quelle que soit celle de
   la machine, sinon Selene, qui suit la langue de l'appareil, pourrait parler anglais sur un runner américain. Un
   scénario peut en demander une autre (option locale de newContext ou newPage). */
const LOCALE = { locale: 'fr-FR' };
/* SELENE_LENT=<ms> : un démarrage lent, à la demande, pour débusquer les scénarios qui attendent un délai au lieu d'un
   état. Sur le web, l'app ne démarre qu'une fois IndexedDB ouverte (platform.ready), donc après l'événement load qui
   rend la main à page.goto ; sous un Firefox chargé, cela prend parfois plus de 500 ms (A16 du cahier de recette).
   Ici, la base de Selene répond avec ce retard ; un scénario robuste passe quand même. Jamais en CI par défaut. */
const LENT = Math.max(0, Number(process.env.SELENE_LENT) || 0);
function slowIdb(ms) {
  const real = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...a) {
    if (a[0] !== 'selene' || a[1] !== 1) return real.apply(this, a); // celle de l'app seulement, pas la lecture des scénarios
    const r = real.apply(this, a), f = {};
    for (const ev of ['upgradeneeded', 'error', 'blocked']) r['on' + ev] = e => f['on' + ev] && f['on' + ev](e);
    r.onsuccess = e => setTimeout(() => f.onsuccess && f.onsuccess(e), ms);
    Object.defineProperty(f, 'result', { get: () => r.result });
    Object.defineProperty(f, 'error', { get: () => r.error });
    return f;
  };
}
const slow = async x => { if (LENT) await x.addInitScript(slowIdb, LENT); return x; }; // un contexte, ou une page
/* SELENE_CPU=<facteur> : le processeur de Chromium ralenti (protocole DevTools), pour débusquer les scénarios qui attendent un
   délai au lieu d'un état sous une machine chargée (A10, A11, A16, A21 à A23 ; BL-22). Chromium seul ; jamais par défaut. */
const CPU = ENGINE === 'chromium' ? Math.max(0, Number(process.env.SELENE_CPU) || 0) : 0;
const brake = async page => { try { const s = await page.context().newCDPSession(page); await s.send('Emulation.setCPUThrottlingRate', { rate: CPU }); } catch {} };
const cpu = x => { if (CPU > 1) { if (typeof x.on === 'function' && typeof x.pages === 'function') x.on('page', brake); else brake(x); } return x; };
/* Le réseau fermé (BL-21 du cahier de recette) : tout ce qui ne va pas au serveur des scénarios (127.0.0.1, localhost)
   passe par un mandataire qui n'existe pas (le port 9, jamais ouvert ici), donc échoue. Une requête que les routes de
   Playwright servent ne part jamais ; une requête qu'elles ne voient pas (sous WebKit, celles d'une page tenue par le
   service worker : A20) ou qu'un scénario a oublié de router n'atteint aucun vrai serveur, dans aucun moteur. */
const FERME = { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' };
// Le journal du scénario nomme chaque requête arrêtée par le mandataire : une route oubliée se voit, même là où le moteur
// ne compte pas l'échec comme une erreur de la page (Chromium, Firefox). Une route qui abandonne exprès, ou la coupure
// simulée (setOffline), ne s'écrit pas.
const temoin = x => {
  x.on('requestfailed', r => {
    const t = (r.failure() || {}).errorText || '', u = new URL(r.url());
    if (!/^(127\.0\.0\.1|localhost)$/.test(u.hostname) && /proxy|could ?n[o']t connect/i.test(t)) console.log(`  · réseau fermé : ${u.host}${u.pathname} (${t})`);
  });
  return x;
};
const engine = {
  async launch(options = {}) {
    const b = await playwright[ENGINE].launch({ proxy: FERME, ...options }), newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
    b.newContext = async (o = {}) => cpu(temoin(await slow(await newContext({ ...LOCALE, ...o }))));
    b.newPage = async (o = {}) => { const pg = temoin(await slow(await newPage({ ...LOCALE, ...o }))); if (CPU > 1) await brake(pg); return pg; };
    return b;
  }
};

const BASE = process.env.SELENE_BASE || 'http://localhost:8765';
const launchOptions = ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
// Jeu d'essai riche (les modules d'origine), le même que pour les tests unitaires.
const fixture = () => fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'site-demo.json'), 'utf8');

function check(cond, msg) {
  console.log(cond ? '  ✓' : '  ✗', msg);
  if (!cond) process.exitCode = 1;
}
process.on('unhandledRejection', e => { console.log('  ✗ erreur :', (e && e.message ? e.message : String(e)).split('\n')[0]); process.exitCode = 1; });

// Attendre une condition côté test (appels réseau simulés, compteurs) plutôt qu'un délai fixe, trop court sous charge.
async function until(cond, ms = 10000) {
  for (const end = Date.now() + ms; !cond() && Date.now() < end;) await new Promise(r => setTimeout(r, 50));
}

/* Ouvrir l'app (une adresse), ou la recharger (sans adresse), et attendre qu'elle ait démarré plutôt qu'un délai : sur
   le web, elle ne démarre qu'une fois IndexedDB ouverte, après l'événement load où goto et reload rendent la main
   (A16 du cahier de recette). `etat` dit ce qu'il faut voir : par défaut, un premier rendu (`demarree`) ; `entree` pour
   un appareil connecté : l'app elle-même, pas l'écran d'entrée (que la session y passe aussitôt depuis A18, ou qu'elle
   attende un changement de compte). */
const demarree = () => !!document.querySelector('#main > *');
const entree = () => !!document.querySelector('#nav > *') && !document.querySelector('#authForm');
async function ouvrir(p, url, etat = demarree) {
  if (url) await p.goto(url); else await p.reload();
  await p.waitForFunction(etat, null, { timeout: 15000 });
  // Les polices aussi (font-display: swap) : tant qu'elles arrivent, la mise en page bouge sous le pointeur.
  await p.evaluate(() => document.fonts && document.fonts.ready.then(() => true)).catch(() => {});
  return p;
}

/* Les requêtes vers le faux Supabase encore en vol. Sous WebKit, un rechargement qui en coupe une écrit à la console
   « Fetch API cannot load … due to access control checks. », que Playwright compte comme une erreur de la page, alors que
   l'app rattrape l'échec (A1 pour activite.js, le 4 octobre 2026 ; agenda.js le 6). `suivre(p)` dès la page ouverte, puis
   `calme(p)` avant un rechargement : 2,5 s sans aucune requête (10 s au plus). C'est plus que les 900 ms après lesquelles
   un enregistrement part au serveur, et plus que les 2 s de la première reprise d'un branchement raté (A24). Les faux
   Supabase les plus simples ne répondent pas comme PostgREST : le branchement y échoue, et l'app le retente à 2, 5,
   15, 30 et 60 s. Après 2,5 s de calme, la première reprise est passée, et la suivante est à 2,5 s au moins (A31).
   waitForLoadState('networkidle') n'y suffit pas : une page chargée l'a déjà atteint. */
const enVol = new WeakMap();
function suivre(p) {
  const n = { v: 0 }, api = r => /\.supabase\.co\//.test(r.url());
  p.on('request', r => { if (api(r)) n.v++; });
  for (const ev of ['requestfinished', 'requestfailed']) p.on(ev, r => { if (api(r)) n.v = Math.max(0, n.v - 1); });
  enVol.set(p, n);
  return p;
}
async function calme(p, ms = 10000) {
  const n = enVol.get(p);
  if (!n) throw new Error('calme() sans suivre() : les requêtes de cette page ne sont pas comptées');
  for (let quiet = 0, end = Date.now() + ms; quiet < 50 && Date.now() < end; await new Promise(r => setTimeout(r, 50))) quiet = n.v ? 0 : quiet + 1;
}

/* Le stockage de Selene vu depuis la page : IndexedDB (base « selene », magasin « kv ») en version hébergée, localStorage
   sinon (artefact, secrets). Lire n'ouvre jamais la base si elle n'existe pas encore (sinon elle naîtrait vide, sans
   magasin). Écrire prévient Selene comme le ferait un autre onglet (BroadcastChannel « selene-storage »). */
const inPage = ({ k, v, write }) => new Promise(res => {
  const local = () => { if (write) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } res(write ? null : localStorage.getItem(k)); };
  const r = indexedDB.open('selene');
  r.onupgradeneeded = () => r.transaction.abort();
  r.onerror = local;
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('kv')) { db.close(); return local(); }
    const t = db.transaction('kv', write ? 'readwrite' : 'readonly'), s = t.objectStore('kv');
    if (!write) { const q = s.get(k); t.oncomplete = () => { db.close(); q.result === undefined ? local() : res(q.result); }; return; }
    if (v === null) s.delete(k); else s.put(v, k);
    t.oncomplete = () => { db.close(); new BroadcastChannel('selene-storage').postMessage(k); res(null); };
  };
});
const storeGet = (p, k) => p.evaluate(inPage, { k, v: null, write: false });
const storeSet = (p, k, v) => p.evaluate(inPage, { k, v, write: true });
const storeJSON = async (p, k) => JSON.parse(await storeGet(p, k));

module.exports = { storeGet, storeSet, storeJSON, until, ouvrir, demarree, entree, suivre, calme, engine, ENGINE, BASE, launchOptions, fixture, check };
