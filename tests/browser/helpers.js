/* Outils communs aux scénarios de navigateur (tests/browser/*.js), lancés par run.js.
   Chaque scénario pilote un vrai Chromium via Playwright et affiche ✓ / ✗ ; un seul ✗, ou une erreur
   non rattrapée, fait échouer le scénario (code de sortie 1), donc la CI. */
const fs = require('node:fs');
const path = require('node:path');

// Playwright : installé pour la CI (npm i --no-save), sinon celui de la machine (installation globale).
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(process.execPath, '..', '..', 'lib', 'node_modules', 'playwright'))); }

const BASE = process.env.SELENE_BASE || 'http://localhost:8765';
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
// Jeu d'essai riche (les modules d'origine), le même que pour les tests unitaires.
const fixture = () => fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'site-demo.json'), 'utf8');

function check(cond, msg) {
  console.log(cond ? '  ✓' : '  ✗', msg);
  if (!cond) process.exitCode = 1;
}
process.on('unhandledRejection', e => { console.log('  ✗ erreur :', (e && e.message ? e.message : String(e)).split('\n')[0]); process.exitCode = 1; });

module.exports = { chromium, BASE, launchOptions, fixture, check };
