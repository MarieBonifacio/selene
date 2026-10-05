/* Scénario de navigateur : venir d'Obsidian ou de Zettlr, l'import de notes Markdown (idée 1 de l'audit,
   docs/connexions.md). Des fichiers, puis un dossier : confirmation, dates, statut, liens [[…]] devenus « fait écho
   à », note longue repliée, doublons ignorés, rien sur le réseau. Lancé par tests/browser/run.js. */
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const md = (name, text) => ({ name, mimeType: 'text/markdown', buffer: Buffer.from(text, 'utf8') });
const A = md('Le seuil.md', '---\ndate: 2024-01-05\nstatut: hypothèse\naliases: [Seuil]\n---\n# Le seuil\n\nLe paratexte comme [[La lisière|lisière]] du texte.\n\nDeuxième paragraphe.');
const B = md('2024-02-10 Lecture.md', '# La lisière\n\nRenvoie au [[Seuil]].\n![[schema.png]]\nUn titre piégé : <img src=x onerror=window.__pwn=1>');
const C = md('Long.md', '---\ncreated: 2024-03-01\n---\n' + Array.from({ length: 12 }, (_, i) => `Paragraphe ${i + 1} : ${'des mots qui reviennent '.repeat(6)}`).join('\n\n'));
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const demo = JSON.parse(fixture());
  demo.modules.carnet = { type: 'notes', label: 'Carnet', config: { inbox: false, description: '', placeholder: 'Une note…' }, entries: [] };
  demo.config.modules.push({ id: 'carnet', on: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  p.on('request', r => { if (!r.url().startsWith(BASE)) errs.push('appel réseau : ' + r.url()); });
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html#reglages'); await p.waitForTimeout(400);
  const input = '[data-act="notes-md"][data-mod="carnet"]:not([webkitdirectory])', folder = '[data-act="notes-md"][data-mod="carnet"][webkitdirectory]';
  const notes = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.carnet.entries);

  console.log('des fichiers : confirmer, puis importer');
  ok(!!(await p.$(input)) && !!(await p.$(folder)), 'dans les réglages d’un module de notes : des fichiers, ou tout un dossier');
  await p.setInputFiles(input, [A, B, C]); await p.waitForTimeout(300);
  const q = await p.textContent('#cmsg');
  ok(await p.isVisible('#cdlg') && q.includes('Importer 3 notes (du 5 janvier 2024 au 1er mars 2024) dans Carnet') && q.includes('2 liens [[…]] deviennent « fait écho à »'), `confirmation : combien, de quand à quand, où, les liens (${q})`);
  await p.click('#cdlg button[value=cancel]'); await p.waitForTimeout(200);
  ok(!(await notes()).length, 'annulé : rien n’est versé');
  await p.setInputFiles(input, [A, B, C]); await p.waitForTimeout(300);
  await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(300);
  const es = await notes(), seuil = es.find(e => e.text.startsWith('Le seuil')), lisiere = es.find(e => e.text.startsWith('La lisière'));
  ok(es.length === 3 && seuil && seuil.date === '2024-01-05' && seuil.ep === 'hyp' && seuil.text === 'Le seuil\n\nLe paratexte comme lisière du texte.\n\nDeuxième paragraphe.', 'titre en première ligne, date de l’en-tête, statut « hypothèse », lien remplacé par son alias');
  ok(lisiere && lisiere.date === '2024-02-10' && !lisiere.text.includes('schema.png'), 'la date du nom du fichier ; l’image intégrée retirée');
  ok(seuil.links && seuil.links[0].type === 'echo' && seuil.links[0].to === `carnet/${lisiere.id}` && lisiere.links[0].to === `carnet/${seuil.id}`, '[[…]] entre deux notes du lot : « fait écho à », dans les deux sens');
  ok((await p.textContent('#toast')).includes('3 notes importées dans Carnet. 2 liens.'), 'et le dit');

  console.log('les notes à l’écran');
  await p.evaluate(() => location.hash = 'carnet'); await p.waitForTimeout(300);
  const li = p.locator('#main li.item', { hasText: 'Paragraphe 1 :' });
  ok(await li.locator('details.more summary').count() === 1 && !(await li.locator('details.more').evaluate(d => d.open)) && (await li.innerText()).includes('Paragraphe 1') && !(await li.innerText()).includes('Paragraphe 12'), 'une note longue montre son début ; le reste attend dans « la suite »');
  ok(await p.locator('#main .ntext').first().evaluate(e => getComputedStyle(e).whiteSpace) === 'pre-line', 'les paragraphes restent des paragraphes');
  ok((await p.textContent('#main')).includes('<img src=x') && !(await p.evaluate(() => window.__pwn)), 'un texte piégé s’affiche en texte');
  ok((await p.textContent('#main')).includes('fait écho à'), 'les liens apparaissent sous les notes');

  console.log('réimporter, puis un dossier');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(300);
  await p.setInputFiles(input, [A, B]); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#cdlg')) && (await p.textContent('#toast')).includes('Rien de nouveau'), 'réimporté : rien de nouveau, sans question');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coffre-'));
  fs.mkdirSync(path.join(dir, '.obsidian')); fs.writeFileSync(path.join(dir, '.obsidian', 'workspace.md'), 'réglages');
  fs.writeFileSync(path.join(dir, 'Nouvelle.md'), '---\ndate: 2024-04-01\n---\nUne suite au [[Le seuil]].');
  fs.writeFileSync(path.join(dir, 'image.png'), 'x');
  await p.setInputFiles(folder, dir); await p.waitForTimeout(400);
  const q2 = await p.textContent('#cmsg');
  ok(await p.isVisible('#cdlg') && q2.includes('Importer 1 note') && q2.includes('1 lien'), `un dossier : sa configuration .obsidian et ses images laissées (${q2})`);
  await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(300);
  const after = await notes(), neuve = after.find(e => e.text.startsWith('Nouvelle'));
  ok(after.length === 4 && neuve && neuve.links && neuve.links[0].to === `carnet/${seuil.id}`, 'un lien vers une note déjà importée la retrouve');
  fs.rmSync(dir, { recursive: true, force: true });

  console.log('un fichier illisible n’arrête pas les autres');
  // Le navigateur ne sait pas lire « illisible.md » (déplacé ou supprimé depuis son choix) : text() échoue pour lui seul.
  await p.evaluate(() => { const t = Blob.prototype.text; Blob.prototype.text = function () { return this.name === 'illisible.md' ? Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) : t.call(this); }; });
  const D = md('Troisième.md', 'Une note de plus, lisible.'), X = md('illisible.md', 'ne sera jamais lue');
  await p.setInputFiles(input, [D, X]); await p.waitForTimeout(300);
  const q3 = await p.textContent('#cmsg');
  ok(await p.isVisible('#cdlg') && q3.includes('Importer 1 note') && q3.includes('1 fichier illisible, ignoré.'), `la confirmation dit combien de fichiers n'ont pas pu être lus (${q3})`);
  await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(300);
  const t3 = await p.textContent('#toast');
  ok((await notes()).length === 5 && t3.includes('1 note importée dans Carnet.') && t3.includes('1 fichier illisible, ignoré.'), `le fichier lisible est importé, et le message le dit (${t3})`);
  await p.setInputFiles(input, [X]); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#cdlg')) && (await p.textContent('#toast')).includes('Aucun de ces fichiers n\'a pu être lu') && (await notes()).length === 5, 'aucun lisible : un message, rien n\'est importé, aucune erreur muette');

  check(!errs.length, 'aucune erreur JavaScript ni appel réseau' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
