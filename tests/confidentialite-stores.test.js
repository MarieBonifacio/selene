/* Les déclarations de confidentialité des stores (docs/ios.md, « Confidentialité pour l'App Store » ; docs/publication.md,
   étapes 5 et 6). Le manifeste iOS est une ressource de l'app, sans pistage, avec la raison des dates de fichiers ; chaque
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
