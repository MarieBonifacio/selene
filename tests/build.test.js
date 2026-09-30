/* Les trois sorties de build.py --dist (ADR 14) : web (GitHub Pages), artefact (claude.ai), natif (Capacitor, Tauri). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'selene-dist-'));
execFileSync('python3', ['build.py', '--dist', dist], { stdio: 'pipe' });
const read = rel => fs.readFileSync(path.join(dist, rel), 'utf8');
const scripts = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const allowed = html => (html.match(/script-src ([^;]*);/) || [])[1].match(/'sha256-[^']+'/g) || [];
const hash = text => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;

test('web et artefact : exactement les fichiers versionnés (vérifiés par build.py --check)', () => {
  assert.equal(read('web/index.html'), fs.readFileSync('index.html', 'utf8'));
  assert.equal(read('artifact/selene.html'), fs.readFileSync('selene.html', 'utf8'));
  assert.deepEqual(fs.readdirSync(path.join(dist, 'web')).sort(), ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'index.html', 'manifest.webmanifest', 'sw.js']);
  assert.ok(fs.readFileSync(path.join(dist, 'web/icon-512.png')).equals(fs.readFileSync('icon-512.png')), 'icônes copiées telles quelles');
});

test('natif : l’amorçage puis le même script, sans service worker ni manifeste', () => {
  const n = read('native/index.html'), w = read('web/index.html');
  assert.equal(scripts(n).length, 2, 'l’amorçage natif, puis Selene');
  assert.equal(scripts(n)[1], scripts(w)[0], 'le script de Selene, identique à la version web');
  assert.ok(scripts(n)[0].includes('window.seleneNative') && scripts(n)[0].includes('Capacitor'));
  assert.ok(!/serviceWorker|rel="manifest"|manifest-src|worker-src/.test(n));
  assert.deepEqual(allowed(n), scripts(n).map(hash), 'la CSP n’autorise que ces deux scripts');
  assert.deepEqual(allowed(w), scripts(w).map(hash), 'et celle du web, ses deux scripts');
  assert.ok(!/script-src[^;]*unsafe-inline/.test(n), 'pas de script inline autorisé en bloc');
});
