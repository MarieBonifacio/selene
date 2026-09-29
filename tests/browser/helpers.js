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
const engine = playwright[ENGINE];

const BASE = process.env.SELENE_BASE || 'http://localhost:8765';
const launchOptions = ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
// Jeu d'essai riche (les modules d'origine), le même que pour les tests unitaires.
const fixture = () => fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'site-demo.json'), 'utf8');

function check(cond, msg) {
  console.log(cond ? '  ✓' : '  ✗', msg);
  if (!cond) process.exitCode = 1;
}
process.on('unhandledRejection', e => { console.log('  ✗ erreur :', (e && e.message ? e.message : String(e)).split('\n')[0]); process.exitCode = 1; });

module.exports = { engine, ENGINE, BASE, launchOptions, fixture, check };
