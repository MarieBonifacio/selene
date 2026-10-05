/* Les déclarations de confidentialité des stores (docs/ios.md, « Confidentialité pour l'App Store » ; docs/publication.md,
   étapes 5 et 7). Le manifeste iOS est une ressource de l'app, sans pistage, avec la raison des dates de fichiers ; chaque
   donnée qu'il déclare a sa ligne dans la fiche Google Play, pour que les deux stores disent la même chose. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const MANIFEST = 'native/ios/App/App/PrivacyInfo.xcprivacy';
const manifest = fs.readFileSync(MANIFEST, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const value = key => { const m = manifest.match(new RegExp(`<key>${key}</key>\\s*<(true|false)/>`)); return m && m[1] === 'true'; };

test('le manifeste est une ressource de l’app iOS', () => {
  const pbx = fs.readFileSync('native/ios/App/App.xcodeproj/project.pbxproj', 'utf8');
  const phase = pbx.match(/\/\* Begin PBXResourcesBuildPhase section \*\/([\s\S]*?)\/\* End PBXResourcesBuildPhase section \*\//)[1];
  assert.match(phase, /PrivacyInfo\.xcprivacy in Resources/, 'absent de la phase « Copy Bundle Resources »');
  assert.match(pbx, /path = PrivacyInfo\.xcprivacy;/);
});

test('aucun pistage, et la raison des dates de fichiers', () => {
  assert.equal(value('NSPrivacyTracking'), false);
  assert.match(manifest, /<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/);
  assert.match(manifest, /NSPrivacyAccessedAPICategoryFileTimestamp<\/string>\s*<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>\s*<string>C617\.1<\/string>/);
  // La raison tient tant que l'amorçage natif lit ses fichiers par @capacitor/filesystem.
  assert.match(fs.readFileSync('src/native/boot.js', 'utf8'), /Filesystem\.readdir/);
});

test('les données déclarées, et leur ligne dans la fiche Google Play', () => {
  const declared = [...manifest.matchAll(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>NSPrivacyCollectedDataType(\w+)<\/string>\s*<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<(true|false)\/>\s*<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<(true|false)\/>/g)]
    .map(m => ({ type: m[1], linked: m[2] === 'true', tracking: m[3] === 'true' }));
  const play = { EmailAddress: 'Adresse e-mail', OtherUserContent: 'Autres contenus générés', CoarseLocation: 'Position approximative',
    ProductInteraction: 'Interactions avec l\'app', OtherDiagnosticData: 'Diagnostics', OtherDataTypes: 'Autres informations' };
  assert.deepEqual(declared.map(d => d.type).sort(), Object.keys(play).sort());
  assert.ok(declared.every(d => !d.tracking), 'aucune donnée ne sert au pistage');
  assert.deepEqual(declared.filter(d => !d.linked).map(d => d.type), ['OtherDiagnosticData'], 'seul le journal des erreurs est sans compte');
  const doc = fs.readFileSync('docs/publication.md', 'utf8');
  for (const [type, line] of Object.entries(play)) assert.ok(doc.includes(line), `${type} : « ${line} » manque dans la fiche Play de publication.md`);
});

test('« Ma position » dans les apps : la position approximative seule, et la phrase d’iOS en deux langues', () => {
  const android = fs.readFileSync('native/android/app/src/main/AndroidManifest.xml', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  assert.match(android, /android\.permission\.ACCESS_COARSE_LOCATION/);
  assert.doesNotMatch(android, /ACCESS_FINE_LOCATION|ACCESS_BACKGROUND_LOCATION/, 'la position précise ou en arrière-plan n’est jamais demandée');
  assert.match(fs.readFileSync('native/ios/App/App/Info.plist', 'utf8'), /<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/);
  for (const lang of ['en', 'fr']) assert.match(fs.readFileSync(`native/ios/App/App/${lang}.lproj/InfoPlist.strings`, 'utf8'), /^"NSLocationWhenInUseUsageDescription" = "[^"]{20,}";$/m, lang);
  assert.match(fs.readFileSync('native/ios/App/App.xcodeproj/project.pbxproj', 'utf8'), /InfoPlist\.strings in Resources/);
  // Ce qui est gardé reste approximatif : la position est arrondie avant d'être rangée, et déclarée comme telle.
  assert.match(fs.readFileSync('src/app/scene/sky.js', 'utf8'), /lat: r1\(lat\), lon: r1\(lon\)/);
  assert.match(manifest, /NSPrivacyCollectedDataTypeCoarseLocation/);
});

test('les fiches des stores : limites de chaque champ, deux langues, rien de « Reprendre la main », l’adresse de la politique', () => {
  // docs/fiches/ : un fichier par champ, tel qu'il se colle dans la Play Console et dans App Store Connect
  // (docs/publication.md, « La fiche »). Les limites sont celles des stores ; les mots-clés d'Apple, comptés en octets
  // par prudence, ne nomment pas d'autres apps (règle 2.3.7).
  const LIMITS = { 'google-play': { title: 30, short_description: 80, full_description: 4000 },
    'app-store': { name: 30, subtitle: 30, promotional_text: 170, description: 4000, keywords: 100 } };
  const POLICY = { 'fr-FR': 'https://mariebonifacio.github.io/selene/confidentialite.html', 'en-GB': 'https://mariebonifacio.github.io/selene/privacy.html' };
  for (const [store, fields] of Object.entries(LIMITS)) for (const lang of Object.keys(POLICY)) {
    const dir = `docs/fiches/${store}/${lang}`;
    assert.deepEqual(fs.readdirSync(dir).sort(), Object.keys(fields).map(f => f + '.txt').sort(), dir);
    for (const [field, max] of Object.entries(fields)) {
      const text = fs.readFileSync(`${dir}/${field}.txt`, 'utf8').replace(/\n$/, ''), n = field === 'keywords' ? Buffer.byteLength(text) : [...text].length;
      assert.ok(text.trim() && n <= max, `${dir}/${field} : ${n} pour ${max} au plus`);
      // Ni le suivi de santé (hors de l'offre publique, exclu des builds des stores), ni promesse de soin.
      assert.doesNotMatch(text, /reprendre la main|taking back control|tabac|tobacco|alcool|alcohol|cannabis|addiction|sevrage|santé|health|médical|medical/i, `${dir}/${field}`);
    }
    const desc = fs.readFileSync(`${dir}/${store === 'app-store' ? 'description' : 'full_description'}.txt`, 'utf8');
    assert.ok(desc.includes(POLICY[lang]), `${dir} : la politique de confidentialité, dans sa langue`);
    if (store === 'app-store') {
      const kw = fs.readFileSync(`${dir}/keywords.txt`, 'utf8').split(',');
      assert.ok(kw.every(k => k && k === k.trim()) && new Set(kw).size === kw.length, `${dir}/keywords : séparés par des virgules, sans doublon`);
      assert.ok(!kw.some(k => /zotero|obsidian|zettlr|notion|scrivener|pandoc/i.test(k)), `${dir}/keywords : pas le nom d'une autre app`);
    }
  }
  assert.match(fs.readFileSync('docs/publication.md', 'utf8'), /docs\/fiches\//);
});
