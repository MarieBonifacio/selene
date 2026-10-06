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
  assert.equal(read('web/essai.html'), fs.readFileSync('essai.html', 'utf8'));
  assert.deepEqual(fs.readdirSync(path.join(dist, 'web')).sort(), ['apple-touch-icon.png', 'confidentialite.html', 'essai', 'essai.html', 'fonts', 'icon-192.png', 'icon-512.png', 'index.html', 'manifest.webmanifest', 'privacy.html', 'sw.js']);
  assert.ok(fs.readFileSync(path.join(dist, 'web/icon-512.png')).equals(fs.readFileSync('icon-512.png')), 'icônes copiées telles quelles');
});

test('polices : servies par le site et les apps, avec leurs licences ; Google Fonts dans l’artefact seulement', () => {
  for (const out of ['web', 'native']) {
    const html = read(`${out}/index.html`);
    assert.doesNotMatch(html, /googleapis|gstatic/, `${out} : rien chez Google`);
    assert.match(html, /font-src 'self';/, `${out} : la CSP n'admet que les polices du site`);
    const urls = [...html.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)].map(m => m[1]);
    assert.equal(urls.length, 24, `${out} : douze faces, en latin et latin étendu`);
    for (const u of urls) assert.ok(fs.statSync(path.join(dist, out, u)).size > 1000, `${out} : ${u} présent`);
    for (const f of ['cormorant-garamond', 'spectral', 'spectral-sc', 'ibm-plex-sans']) assert.match(read(`${out}/fonts/OFL-${f}.txt`), /SIL Open Font License/);
  }
  assert.match(read('artifact/selene.html'), /fonts\.googleapis\.com\/css2\?family=Cormorant\+Garamond/, 'l’artefact claude.ai : Google Fonts, seule source de styles admise');
  assert.doesNotMatch(fs.readFileSync('sw.js', 'utf8'), /googleapis|gstatic/, 'le service worker ne met plus Google en cache');
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
  const services = { 'open-meteo': 'Open-Meteo', crossref: 'Crossref', microlink: 'Microlink', musicbrainz: 'MusicBrainz', opendatasoft: 'OpenAgenda', openalex: 'OpenAlex', zotero: 'Zotero', supabase: 'Supabase' };
  for (const host of csp.match(/https:\/\/[^\s"']+/g)) {
    const k = Object.keys(services).find(x => host.includes(x));
    assert.ok(k, `service sans nom dans la politique : ${host}`);
    assert.ok(p.includes(services[k]), `${services[k]} manque dans confidentialite.html`);
    assert.ok(en.includes(services[k]), `${services[k]} manque dans privacy.html`);
  }
  assert.match(fs.readFileSync('src/app/views/reglages.js', 'utf8'), /confidentialite\.html/);
  assert.match(fs.readFileSync('src/app/views/reglages.js', 'utf8'), /privacy\.html/);
});

test('supprimer son compte sans l’app : une adresse à donner à Google Play, dans les deux langues', () => {
  // Google Play demande une page web où demander la suppression d'un compte sans réinstaller l'app : le nom de l'app,
  // les étapes, ce qui est effacé et ce qui reste. publication.md donne cette adresse pour la Play Console.
  for (const [x, id, words] of [[read('web/confidentialite.html'), 'supprimer-compte', ['Selene', 'Supprimer mon compte', 'Ce qui est effacé', 'Ce qui reste', 'Sans pouvoir te connecter']],
    [read('web/privacy.html'), 'delete-account', ['Selene', 'Delete my account', 'What is erased', 'What remains', 'If you cannot sign in']]]) {
    const at = x.indexOf(`<h2 id="${id}">`);
    assert.ok(at > 0, `section #${id}`);
    const sec = x.slice(at, x.indexOf('<h2', at + 4));
    for (const w of words) assert.ok(sec.includes(w), `« ${w} » dans #${id}`);
    assert.match(sec, /href="mailto:mariebonifacio\.pro@gmail\.com\?subject=/);
    assert.match(x, new RegExp(`href="#${id}"`), 'la section des droits y renvoie');
  }
  assert.match(fs.readFileSync('docs/publication.md', 'utf8'), /confidentialite\.html#supprimer-compte/);
});

test('politique de confidentialité : le texte et les liens se lisent (4,5:1 au moins, WCAG AA), dans les deux langues', () => {
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const f of ['confidentialite.html', 'privacy.html']) {
    const root = fs.readFileSync(f, 'utf8').match(/:root \{([^}]*)\}/)[1], v = k => root.match(new RegExp(`--${k}: (#[0-9a-f]{6})`))[1];
    for (const k of ['ink', 'muted', 'acc']) assert.ok(ratio(v(k), v('bg')) >= 4.5, `${f} : --${k} sur --bg, ${ratio(v(k), v('bg')).toFixed(2)}:1`);
  }
});

test('politique de confidentialité : ce que demande l’article 13 du RGPD, dans les deux langues', () => {
  const versions = [
    [read('web/confidentialite.html'), ['Qui en est responsable', 'Pourquoi, et sur quelle base', 'Combien de temps', "Hors de l'Union européenne", 'Tes droits']],
    [read('web/privacy.html'), ['Who is responsible', 'Why, and on what basis', 'How long', 'Outside the European Union', 'Your rights']]
  ];
  for (const [x, sections] of versions) {
    for (const s of sections) assert.ok(x.includes(`<h2>${s}</h2>`), `section « ${s} »`);
    assert.match(x, /Marie Bonifacio/, 'la responsable du traitement, nommée');
    assert.match(x, /href="mailto:mariebonifacio\.pro@gmail\.com"/, 'une adresse de contact privée');
    assert.doesNotMatch(x, /\/issues/, 'jamais une demande sur ses données par ticket public');
    for (const base of [/6[.(]1[.)]?\(?a/, /6[.(]1[.)]?\(?b/, /9[.(]2[.)]?\(?a/, /6[.(]1[.)]?\(?f/]) assert.match(x, base, `base légale ${base}`);
    assert.match(x, /Paris/, 'où sont les données du compte');
    assert.match(x, /href="https:\/\/www\.cnil\.fr\/fr\/plaintes"/, 'le droit de réclamation auprès de la CNIL');
  }
});

test('page publique de test (E3) : statique, son script et ses styles autorisés par leur empreinte, Supabase seul en réseau', () => {
  const p = read('web/essai.html');
  const policy = p.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  const directive = name => (policy.match(new RegExp(`(?:^|; )${name} ([^;]+)`)) || [])[1] || '';
  assert.equal(directive('default-src'), "'none'");
  assert.deepEqual(directive('script-src').split(' '), scripts(p).map(hash), 'un seul script, par son empreinte');
  assert.deepEqual(directive('style-src').split(' '), [...p.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => hash(m[1])), 'ses deux feuilles de style, par leur empreinte');
  assert.ok(!/unsafe-inline|unsafe-eval/.test(policy) && !/ style="/.test(p) && !/ on[a-z]+="/.test(p), 'rien en ligne qui ne soit autorisé');
  assert.match(directive('connect-src'), /^https:\/\/[a-z0-9]+\.supabase\.co$/, 'le réseau : le projet Supabase, rien d’autre');
  assert.equal(directive('form-action'), "'none'");
  assert.doesNotMatch(p, /googleapis|gstatic|__SUPABASE|localStorage|sessionStorage|document\.cookie|indexedDB/, 'ni police de Google, ni stockage, ni cookie');
  // Les images citées existent, l'aperçu des partages aussi ; les liens mènent où ils disent.
  for (const src of [...p.matchAll(/src="(essai\/[^"]+)"/g)].map(m => m[1])) assert.ok(fs.statSync(path.join(dist, 'web', src)).size > 10000, `${src} publié`);
  assert.ok(fs.existsSync(path.join(dist, 'web', p.match(/og:image" content="https:\/\/[^/]+\/selene\/([^"]+)"/)[1])), 'l’aperçu des partages (og:image) est publié');
  assert.match(p, /href="index\.html#sans-compte"/, '« Essayer sans compte » ouvre l’app sans compte');
  assert.match(read('web/confidentialite.html'), /<h2 id="page-de-presentation">/, 'le lien vers la politique trouve sa section');
  assert.match(p, /29,99 €/, 'le prix annoncé (E3 de l’audit)');
});

test('le script produit ne dépend pas de la machine : aucun chemin absolu', () => {
  for (const f of ['selene.html', 'index.html', 'essai.html']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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

test('un projet Supabase de préproduction (la recette) : seulement dans dist/, avec une clé publique, et rien du projet de l’app', () => {
  const { spawnSync } = require('node:child_process');
  const PRE = { SELENE_SUPABASE_URL: 'https://preprodrecette.supabase.co', SELENE_SUPABASE_KEY: 'sb_publishable_RecetteFausseCle000' };
  const own = fs.readFileSync('src/app/services/auth.js', 'utf8').match(/export const SUPABASE_URL = "https:\/\/([a-z0-9]+)\.supabase\.co"/)[1];
  const run = (env, args) => spawnSync('python3', ['build.py', ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });
  const versioned = run(PRE, ['--check']);
  assert.equal(versioned.status, 1); assert.match(versioned.stderr, /seulement avec --dist/, 'jamais dans les fichiers versionnés');
  for (const bad of [{ ...PRE, SELENE_SUPABASE_KEY: 'sb_secret_xyz' }, { SELENE_SUPABASE_URL: PRE.SELENE_SUPABASE_URL }, { ...PRE, SELENE_SUPABASE_URL: 'https://exemple.fr' }]) {
    const r = run(bad, ['--dist', fs.mkdtempSync(path.join(os.tmpdir(), 'selene-pre-'))]);
    assert.notEqual(r.status, 0, JSON.stringify(bad)); assert.match(r.stderr, /les deux, ou aucune/);
  }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'selene-pre-'));
  const ok = run(PRE, ['--dist', out]);
  assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /preprodrecette\.supabase\.co/, 'la sortie dit quel projet');
  for (const rel of ['web/index.html', 'web/essai.html', 'native/index.html']) {
    const html = fs.readFileSync(path.join(out, rel), 'utf8');
    assert.ok(html.includes('preprodrecette.supabase.co') && html.includes(PRE.SELENE_SUPABASE_KEY), `${rel} : le projet de préproduction`);
    assert.ok(!html.includes(own), `${rel} : rien du projet de l’app`);
  }
  fs.rmSync(out, { recursive: true, force: true });
});

test('la fumée Windows : seule sa variante ouvre un port de débogage, la configuration publiée jamais', async () => {
  const { smokeConfig } = await import('../scripts/windows-fumee.mjs');
  const conf = JSON.parse(fs.readFileSync('native/tauri/tauri.conf.json', 'utf8'));
  assert.doesNotMatch(JSON.stringify(conf), /remote-debugging|additionalBrowserArgs/, 'l’app publiée n’ouvre rien');
  const variant = smokeConfig(conf).app.windows;
  assert.equal(variant.length, conf.app.windows.length);
  variant.forEach((w, i) => {
    const { additionalBrowserArgs, ...rest } = w;
    assert.deepEqual(rest, conf.app.windows[i], 'la même fenêtre, recopiée');
    assert.match(additionalBrowserArgs, /^--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port=\d+$/, 'les arguments de wry, plus le port');
  });
});
