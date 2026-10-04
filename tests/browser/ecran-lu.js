/* Scénario de navigateur : ce qu'un lecteur d'écran sait de l'écran affiché. Le titre de la page le nomme
   (« Écriture — Selene », WCAG 2.4.2) ; suivre un lien du menu au clavier porte le focus au titre du nouvel écran,
   au lieu de le laisser retomber sur la page entière, sans rien annoncer ; un champ qui a le focus le garde (« / »
   ouvre la recherche, curseur dans le champ). Les messages d'état qui naissent avec un contenu redessiné
   (« Recherche… », l'aperçu d'une source) sont répétés par une région permanente, hors de l'écran (#sr-say), que les
   lecteurs d'écran écoutent à coup sûr. Données synthétiques, réseau simulé. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.sources = { type: 'collection', label: 'Sources',
  config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), display: 'liste', sources: true, statuses: ['À lire', 'Lue'], doneFrom: 1, addLabel: 'Ajouter',
    fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Notes' } }, entries: [] };
demo.config.modules.push({ id: 'sources', on: true });
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  let release; const held = new Promise(r => { release = r; });
  await ctx.route('https://api.crossref.org/**', async r => { await held; r.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: { DOI: '10.5555/lisiere', type: 'journal-article', title: ['La lisière des bois'], issued: { 'date-parts': [[2024]] } } }) }); });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#accueil'); await p.waitForSelector('#main h2');
  const focused = () => p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}:${(a.textContent || '').trim().slice(0, 20)}` : ''; });

  console.log('le titre de la page');
  check(await p.title() === "Aujourd'hui — Selene", `accueil : « ${await p.title()} »`);
  for (const [h, t] of [['ecriture', 'Écriture — Selene'], ['reglages', 'Réglages — Selene'], ['bilan', 'Bilan — Selene']]) {
    await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(300);
    check(await p.title() === t, `#${h} : « ${await p.title()} »`);
  }

  console.log('le focus suit la navigation');
  await p.focus('#nav a[href="#chantier"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check(/^h2:Chantier/.test(await focused()), `Entrée sur « Chantier » : le focus est au titre de l'écran (${await focused()})`);
  check(await p.evaluate(() => scrollY) < 5, 'sans défiler');
  await p.keyboard.press('Tab');
  check(await p.evaluate(() => !!document.activeElement.closest('#main')), 'Tab repart du contenu de l’écran, pas du haut de la page');
  await p.focus('#nav a[href="#ecriture"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check(/^h2:Écriture/.test(await focused()), `puis « Écriture » (${await focused()})`);

  console.log('un champ garde le focus');
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('/'); await p.waitForTimeout(400);
  check(/^input#searchIn/.test(await focused()), `« / » : le curseur est dans la recherche (${await focused()})`);
  check(await p.title() === 'Chercher — Selene', `et la page s'appelle « ${await p.title()} »`);

  console.log('les messages d’état sont dits');
  await p.evaluate(() => { location.hash = 'sources'; }); await p.waitForSelector('#srcIn');
  await p.fill('#srcIn', 'doi:10.5555/lisiere'); await p.click('[data-act="src-fetch"]');
  const say = () => p.evaluate(() => document.querySelector('#sr-say').textContent);
  await p.waitForFunction(() => document.querySelector('#sr-say').textContent.includes('Recherche'), null, { timeout: 5000 }).catch(() => {});
  check((await say()).includes('Recherche…'), `pendant la recherche : « ${await say()} »`);
  release(); await p.waitForSelector('.src-prev');
  await p.waitForFunction(() => document.querySelector('#sr-say').textContent.includes('Trouvée'), null, { timeout: 5000 }).catch(() => {});
  check(await say() === 'Trouvée : « La lisière des bois ».', `l'aperçu arrivé, une phrase courte et non toute la fiche : « ${await say()} »`);
  check(await p.evaluate(() => { const r = document.querySelector('#sr-say'); const b = r.getBoundingClientRect(); return r.getAttribute('role') === 'status' && b.width <= 1 && b.height <= 1; }), 'la région est permanente, annoncée poliment, hors de l’écran');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
