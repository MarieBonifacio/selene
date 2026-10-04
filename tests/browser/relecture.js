/* Scénario de navigateur : la relecture de la semaine (idée 4 de l'audit). L'accueil la propose quand il y a de quoi
   relire et que la dernière a sept jours ; la page tire trois choses endormies, montre les tensions ouvertes et les
   hypothèses qu'aucune source ne documente ; « Relecture faite » la range pour une semaine. Lancé par
   tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const demo = JSON.parse(fixture());
  demo.modules.carnet = { type: 'notes', label: 'Carnet', config: { inbox: false, description: '', placeholder: 'Une note…' }, entries: [
    { id: 'h1', date: '2026-01-10', ep: 'hyp', text: 'Le seuil fabrique le texte qu’il annonce' },
    { id: 'h2', date: '2026-02-01', ep: 'hyp', text: 'Une hypothèse déjà documentée' },
    { id: 'n3', date: '2026-01-05', text: 'Une note endormie depuis janvier', links: [{ id: 'l1', to: 'carnet/n4', type: 'contredit', date: '2026-03-01' }] },
    { id: 'n4', date: '2026-01-06', text: 'Son contraire, endormi lui aussi' }] };
  demo.modules.sources = { type: 'collection', label: 'Sources', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, display: 'liste', sources: true,
    statuses: ['À lire', 'Lue'], doneFrom: 1, fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: '' } },
    entries: [{ id: 's1', title: 'Genette, Seuils', subtitle: 'Gérard Genette', tag: 'livre', status: 'Lue', date: '2026-02-02', kept: '2026-02-02', links: [{ id: 'l2', to: 'carnet/h2', type: 'documente', date: '2026-02-02' }] }] };
  demo.config.modules.push({ id: 'carnet', on: true }, { id: 'sources', on: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html#accueil'); await p.waitForTimeout(400);

  console.log('l’accueil la propose');
  const line = (await p.textContent('.relecture-go').catch(() => '')) || '';
  ok(line.includes('Relecture de la semaine') && line.includes('3 choses endormies') && line.includes('1 tension ouverte') && line.includes('1 hypothèse sans source'), `une ligne, avec ce qui attend (${line.replace(/\s+/g, ' ').trim()})`);
  await p.click('.relecture-go a'); await p.waitForTimeout(300);

  console.log('la page');
  ok((await p.evaluate(() => location.hash)) === '#bilan/relecture' && (await p.title()).startsWith('Relecture de la semaine'), 'elle s’ouvre depuis l’accueil, et le titre de la page la nomme');
  const cards = () => p.$$eval('#main section:first-of-type .card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  const first = await cards();
  ok(first.length === 3 && new Set(first).size === 3, 'trois choses endormies, toutes différentes');
  await p.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange'))); await p.waitForTimeout(200);
  ok(JSON.stringify(await cards()) === JSON.stringify(first), 'le tirage ne change pas à chaque rendu');
  const main = (await p.textContent('#main')).replace(/\s+/g, ' ');
  ok(main.includes('Tensions ouvertes') && main.includes('Une note endormie depuis janvier') && main.includes('Son contraire'), 'la tension ouverte, avec ses deux entrées');
  const hyps = await p.$$eval('#main section:last-of-type li', ls => ls.map(l => l.textContent));
  ok(hyps.length === 1 && hyps[0].includes('Le seuil fabrique') && !hyps.join().includes('déjà documentée'), 'l’hypothèse sans source, et pas celle qu’une source documente');
  await p.click('[data-act="relecture-draw"]'); await p.waitForTimeout(200);
  ok((await cards()).length === 3, '« Retirer » refait le tirage');

  console.log('relecture faite');
  await p.click('[data-act="relecture-done"]'); await p.waitForTimeout(300);
  const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  ok((await p.evaluate(() => location.hash)) === '#accueil' && (await p.evaluate(() => localStorage.getItem('selene-relecture'))) === today, 'retour à l’accueil ; le jour est retenu sur l’appareil');
  ok(!(await p.$('.relecture-go')) && (await p.textContent('#toast')).includes('dans une semaine'), 'la ligne disparaît pour une semaine, et c’est dit');
  await p.evaluate(() => location.hash = 'bilan'); await p.waitForTimeout(300);
  ok(!!(await p.$('#main .relecture-go a[href="#bilan/relecture"]')), 'elle reste à portée depuis le bilan');
  await p.evaluate(() => localStorage.setItem('selene-relecture', '2026-01-01')); await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(300);
  ok(!!(await p.$('.relecture-go')), 'sept jours plus tard, elle revient');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
