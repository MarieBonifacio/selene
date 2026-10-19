/* Scénario de navigateur : venir d'Obsidian ou de Zettlr, l'import de notes Markdown (idée 1 de l'audit,
   docs/connexions.md). Des fichiers, puis un dossier : confirmation, dates, statut, liens [[…]] devenus « fait écho
   à », note longue repliée, doublons ignorés, rien sur le réseau ; le dernier lot se retire, et revient. Lancé par
   tests/browser/run.js. */
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
  // Pour un dossier, Playwright attend ensuite l'événement « input » de la page, sans autre borne que les 30 s de l'action ;
  // sous WebKit, il ne l'a pas reçu une fois (A66, le 8 octobre 2026). Ce que le cas vérifie est la boîte de l'app : on
  // l'attend elle, et l'erreur de Playwright, s'il y en a une, est dite avec le résultat.
  const envoi = await p.setInputFiles(folder, dir, { timeout: 10000 }).then(() => '', e => e.message.split('\n')[0]);
  await p.waitForSelector('#cdlg[open]', { timeout: 5000 }).catch(() => {});
  const q2 = await p.textContent('#cmsg');
  ok(await p.isVisible('#cdlg') && q2.includes('Importer 1 note') && q2.includes('1 lien'), `un dossier : sa configuration .obsidian et ses images laissées (${q2})${envoi ? ` [Playwright : ${envoi}]` : ''}`);
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

  console.log('annuler le dernier import');
  // Le dernier lot est « Troisième » (une note) ; le retirer laisse le dossier d'avant, puis « Annuler » le rend.
  if (!(await p.$eval('#mreg-carnet', d => d.open))) await p.click('#mreg-carnet summary');
  const annuler = p.locator('#mreg-carnet [data-act="notes-md-undo"]');
  ok(/^Annuler le dernier import \(1 note, le .+\)$/.test((await annuler.textContent()).trim()), `« régler » propose d’annuler le dernier import, et dit lequel (${(await annuler.textContent()).trim()})`);
  await annuler.click(); await p.waitForSelector('#cdlg[open]');
  const q4 = await p.textContent('#cmsg');
  ok(q4.includes('Retirer la note importée le') && q4.includes('dans Carnet ? Les notes écrites à la main restent.'), `la question dit quoi, de quand, d’où (${q4})`);
  await p.click('#cdlg button[value=ok]');
  // Le retrait s'écrit dans l'événement « close » de la boîte : on attend l'état, pas un délai (A52, A74).
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.carnet.entries.length === 4, null, { timeout: 10000 }).catch(() => {});
  const t4 = await p.textContent('#toast');
  ok(!(await notes()).some(e => e.text.startsWith('Troisième')) && (await notes()).length === 4 && t4.includes('1 note retirée de Carnet.') && !!(await p.$('#toast [data-act="undo"]')), `le lot part, les autres restent, et cela se défait (${t4})`);
  await p.click('#toast [data-act="undo"]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.carnet.entries.length === 5, null, { timeout: 10000 }).catch(() => {});
  ok((await notes()).length === 5 && (await notes())[4].text === 'Troisième\n\nUne note de plus, lisible.', '« Annuler » le rend, à sa place');

  check(!errs.length, 'aucune erreur JavaScript ni appel réseau' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
