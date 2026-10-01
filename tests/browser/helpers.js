/* Outils communs aux scénarios de navigateur (tests/browser/*.js), lancés par run.js.
   Chaque scénario pilote un vrai navigateur (Chromium, ou WebKit) via Playwright et affiche ✓ / ✗ ; un seul ✗, ou une erreur
   non rattrapée, fait échouer le scénario (code de sortie 1), donc la CI. */
const fs = require('node:fs');
const path = require('node:path');

// Playwright : celui de package.json (npm ci), sinon celui de la machine (installation globale).
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(process.execPath, '..', '..', 'lib', 'node_modules', 'playwright')); }
// Moteur : Chromium par défaut, SELENE_BROWSER=webkit pour celui de Safari, des WebView iOS et de Tauri (macOS, Linux).
const ENGINE = process.env.SELENE_BROWSER || 'chromium';
if (!['chromium', 'webkit'].includes(ENGINE)) throw new Error('SELENE_BROWSER : chromium ou webkit, pas « ' + ENGINE + ' »');
/* Les scénarios lisent l'interface en français : la langue du navigateur est fixée (fr-FR), quelle que soit celle de
   la machine, sinon Selene, qui suit la langue de l'appareil, pourrait parler anglais sur un runner américain. Un
   scénario peut en demander une autre (option locale de newContext ou newPage). */
const LOCALE = { locale: 'fr-FR' };
const engine = {
  async launch(options) {
    const b = await playwright[ENGINE].launch(options), newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
    b.newContext = (o = {}) => newContext({ ...LOCALE, ...o });
    b.newPage = (o = {}) => newPage({ ...LOCALE, ...o });
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

module.exports = { storeGet, storeSet, storeJSON, until, engine, ENGINE, BASE, launchOptions, fixture, check };
