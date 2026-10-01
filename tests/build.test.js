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
  assert.deepEqual(fs.readdirSync(path.join(dist, 'web')).sort(), ['apple-touch-icon.png', 'confidentialite.html', 'icon-192.png', 'icon-512.png', 'index.html', 'manifest.webmanifest', 'privacy.html', 'sw.js']);
  assert.ok(fs.readFileSync(path.join(dist, 'web/icon-512.png')).equals(fs.readFileSync('icon-512.png')), 'icônes copiées telles quelles');
});

test('politique de confidentialité : publiée avec le site (en français et en anglais), sans script ni ressource extérieure, et liée depuis les Réglages', () => {
  const p = read('web/confidentialite.html'), en = read('web/privacy.html');
  for (const x of [p, en]) { assert.ok(!/<script|<link|@import|src=/i.test(x), 'une page statique'); assert.match(x, /default-src 'none'/); }
  assert.match(p, /Supprimer mon compte/); assert.match(en, /Delete my account/);
  assert.match(p, /href="privacy\.html"/); assert.match(en, /href="confidentialite\.html"/);
  // Les deux versions disent la même chose : mêmes sections, mêmes liens, même date.
  const shape = x => [x.match(/<h2>/g).length, x.match(/<li>/g).length, (x.match(/href="https:[^"]+"/g) || []).join(" ")];
  assert.deepEqual(shape(en), shape(p));
  const day = x => x.match(/(\d{1,2})(?:er)? (?:septembre|September|octobre|October) (\d{4})/).slice(1).join("-");
  assert.equal(day(en), day(p), 'les deux versions ont la même date de mise à jour');
  // Chaque service appelé par la page (sa CSP) est nommé dans la politique : l'une ne change pas sans l'autre.
  const csp = fs.readFileSync('build.py', 'utf8').match(/CONNECT = \(([\s\S]*?)\)\n/)[1];
  const services = { 'open-meteo': 'Open-Meteo', crossref: 'Crossref', microlink: 'Microlink', musicbrainz: 'MusicBrainz', opendatasoft: 'OpenAgenda', openalex: 'OpenAlex', zotero: 'Zotero', supabase: 'Supabase', googleapis: 'Google Fonts', gstatic: 'Google Fonts' };
  for (const host of csp.match(/https:\/\/[^\s"']+/g)) {
    const k = Object.keys(services).find(x => host.includes(x));
    assert.ok(k, `service sans nom dans la politique : ${host}`);
    assert.ok(p.includes(services[k]), `${services[k]} manque dans confidentialite.html`);
    assert.ok(en.includes(services[k]), `${services[k]} manque dans privacy.html`);
  }
  assert.match(fs.readFileSync('src/app/views/reglages.js', 'utf8'), /confidentialite\.html/);
  assert.match(fs.readFileSync('src/app/views/reglages.js', 'utf8'), /privacy\.html/);
});

test('le script produit ne dépend pas de la machine : aucun chemin absolu', () => {
  for (const f of ['selene.html', 'index.html']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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
