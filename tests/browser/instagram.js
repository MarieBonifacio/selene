/* Scénario de navigateur : Mémoire éditoriale, l'export Instagram (connexions externes, phase 1, vague 5e : docs/connexions.md). Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const moji = s => [...Buffer.from(s, 'utf8')].map(b => String.fromCharCode(b)).join('');
const at = iso => Math.floor(Date.parse(iso) / 1000);
const POSTS = [
  { media: [{ uri: 'media/posts/202509/a.jpg', creation_timestamp: at('2025-09-14T19:00:00Z'), title: moji('Phalène du bouleau 🌙\nVue sur le balcon, à minuit. #moth') }] },
  { title: moji('Trois ailes, <img src=x onerror=window.__pwn=1>'), creation_timestamp: at('2026-03-02T12:00:00Z'), media: [{ uri: 'a' }, { uri: 'b' }, { uri: 'c' }] }
];
const REELS = { ig_reels_media: [{ media: [{ uri: 'r.mp4', creation_timestamp: at('2026-06-21T21:00:00Z'), title: '' }] }] };
const file = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
(async () => {
  const b = await chromium.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  p.on('request', r => { if (!r.url().startsWith(BASE) && !/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errs.push('appel réseau : ' + r.url()); });
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  await p.goto(BASE + '/index.html#reglages'); await p.waitForTimeout(400);
  const input = '[data-act="col-ig"][data-mod="moth"]';
  const moth = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.moth.entries);

  console.log('importer, confirmer');
  ok(!!(await p.$(input)), 'un import par collection, dans ses réglages');
  await p.setInputFiles(input, [file('posts_1.json', POSTS), file('reels.json', REELS)]); await p.waitForTimeout(300);
  const q = await p.textContent('#cmsg');
  ok(await p.isVisible('#cdlg') && q.includes('Importer 3 publications (du 14 septembre 2025 au 21 juin 2026) dans october.moth, au statut « Publié »'), `confirmation : combien, de quand à quand, où (${q})`);
  await p.click('#cdlg button[value=cancel]'); await p.waitForTimeout(200);
  ok(!(await moth()).some(e => e.ig), 'annulé : rien n’est versé');
  await p.setInputFiles(input, [file('posts_1.json', POSTS), file('reels.json', REELS)]); await p.waitForTimeout(300);
  await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(300);
  const es = (await moth()).filter(e => e.ig);
  const first = es.find(e => e.ig.t === at('2025-09-14T19:00:00Z'));
  ok(es.length === 3 && es.every(e => e.status === 'Publié'), 'trois publications, au dernier statut');
  ok(first && first.title === 'Phalène du bouleau 🌙' && first.text.includes('à minuit') && first.due === '2025-09-14', 'encodage de Meta réparé ; première ligne en titre, légende en texte, date');
  ok(es.some(e => e.ig.k === 'reel' && e.title === 'Reel du 2026-06-21'), 'un reel sans légende garde sa date pour titre');
  ok((await p.textContent('#toast')).includes('3 publications importées'), 'et le dit');

  console.log('second import, fichiers étrangers');
  await p.setInputFiles(input, [file('posts_1.json', POSTS)]); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#cdlg')) && (await p.textContent('#toast')).includes('Rien de nouveau'), 'réimporté : rien de nouveau, sans question');
  await p.setInputFiles(input, [{ name: 'photo.json', mimeType: 'application/json', buffer: Buffer.from('pas du json') }]); await p.waitForTimeout(300);
  ok((await p.textContent('#toast')).includes('pas un export Instagram'), 'un fichier illisible : dit');
  await p.setInputFiles(input, [file('following.json', { relationships_following: [] })]); await p.waitForTimeout(300);
  ok((await p.textContent('#toast')).includes('posts_1.json ou reels.json'), 'un autre fichier de l’export : dit lequel il faut');

  console.log('dans la collection');
  await p.evaluate(() => location.hash = 'moth'); await p.waitForTimeout(400);
  const body = await p.textContent('#main');
  ok(body.includes('Phalène du bouleau 🌙') && body.includes('Trois ailes, <img') && !(await p.evaluate(() => window.__pwn)), 'visibles dans october.moth ; une légende piégée reste du texte');
  await p.evaluate(() => location.hash = ''); await p.waitForTimeout(300);
  const today = await p.evaluate(() => [...document.querySelectorAll('#main h2')].find(h => h.textContent === 'Aujourd\'hui').closest('section').textContent);
  ok(!today.includes('Phalène') && !today.includes('Trois ailes'), 'des publications passées ne deviennent pas des rappels dans « Aujourd’hui »');

  check(!errs.length, 'aucune erreur JavaScript ni appel réseau' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
