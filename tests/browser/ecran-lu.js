/* Scénario de navigateur : ce qu'un lecteur d'écran sait de l'écran affiché. Le titre de la page le nomme
   (« Écriture — Selene », WCAG 2.4.2) ; suivre un lien du menu au clavier porte le focus au titre du nouvel écran,
   au lieu de le laisser retomber sur la page entière, sans rien annoncer ; un champ qui a le focus le garde (« / »
   ouvre la recherche, curseur dans le champ). Les messages d'état qui naissent avec un contenu redessiné
   (« Recherche… », l'aperçu d'une source) sont répétés par une région permanente, hors de l'écran (#sr-say), que les
   lecteurs d'écran écoutent à coup sûr. Enfin le clavier seul (TRV-002) : le contour à chaque arrêt de Tab, une tâche
   créée sans souris, Échap qui ferme sans rien garder et rend le focus. Données synthétiques, réseau simulé. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.sources = { type: 'collection', label: 'Sources',
  config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), display: 'liste', sources: true, statuses: ['À lire', 'Lue'], doneFrom: 1, addLabel: 'Ajouter',
    fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Notes' } }, entries: [] };
demo.config.modules.push({ id: 'sources', on: true });
const tache = (id, title) => ({ id, title, room: 'Cuisine', cat: 'Bricolage', due: null, effort: 1, cost: null, note: '', today: false, done: false, doneAt: null, created: '2026-09-01', steps: [] });
demo.modules.chantier.entries = [tache('t1', 'Poser le velux'), tache('t2', 'Changer le robinet'), tache('t3', 'Joints de la douche')];
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

  console.log('un rendu de fond garde le focus clavier (A37)');
  // Un autre onglet du même site (sans l'app) enregistre : Selene relit et redessine l'écran, sous le focus.
  const onglet = await ctx.newPage(); await onglet.goto(BASE + '/package.json');
  const ailleurs = q => onglet.evaluate(q => {
    const d = JSON.parse(localStorage.getItem('selene-site-v1')), t = d.modules.chantier.entries;
    if (q.fait) t.find(x => x.id === q.fait).done = true;
    if (q.retire) d.modules.chantier.entries = t.filter(x => x.id !== q.retire);
    d.updatedAt = (d.updatedAt || 0) + 1; localStorage.setItem('selene-site-v1', JSON.stringify(d));
  }, q);
  const redessine = async () => { const n = await p.evaluate(() => document.querySelector('#main').innerHTML.length); return p.waitForFunction(m => document.querySelector('#main').innerHTML.length !== m, n, { timeout: 5000 }).then(() => true, () => false); };
  const surQuoi = () => p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : `${a.dataset.act || a.tagName}${a.closest('[data-task]') ? '@' + a.closest('[data-task]').dataset.task : ''}`; });
  await p.evaluate(() => { location.hash = 'chantier'; }); await p.waitForSelector('[data-act="task-new"]');
  await p.focus('[data-act="task-new"]');
  { const r = redessine(); await ailleurs({ fait: 't3' }); await r; }
  check(await surQuoi() === 'task-new', `un bouton : l’écran redessiné par une synchro, le focus y reste (${await surQuoi()})`);
  await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {});
  check(await p.evaluate(() => document.querySelector('#dlg').open), 'et Entrée ouvre le formulaire, comme sans la synchro');
  if (await p.evaluate(() => document.querySelector('#dlg').open)) { await p.click('#form button[value=cancel]'); await p.waitForFunction(() => !document.querySelector('#dlg').open); }
  await p.focus('li[data-task="t2"] [data-act="task-done"]');
  { const r = redessine(); await ailleurs({ retire: 't1' }); await r; }
  check(await surQuoi() === 'task-done@t2', `une case : la tâche d’avant a disparu, le focus reste sur la case de la même tâche (${await surQuoi()})`);
  await p.focus('li[data-task="t2"] [data-act="task-done"]');
  { const r = redessine(); await ailleurs({ retire: 't2' }); await r; }
  check(!/^task-done/.test(await surQuoi()), `la tâche elle-même disparue : le focus ne passe pas à la case d’une autre (${await surQuoi()})`);
  { // A40 : un rendu de fond entre l'appui et le relâchement remplaçait le bouton pressé ; le relâchement tombait sur son
    // remplaçant, et le navigateur, qui ne donne « click » qu'à l'élément qui a reçu les deux, n'en donnait aucun.
    const [x, y] = await p.$eval('[data-act="task-new"]', el => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await p.mouse.move(x, y); await p.mouse.down();
    await ailleurs({ retire: 't3' }); await p.waitForTimeout(400); // l'autre onglet enregistre, le doigt encore posé
    await p.mouse.up();
    await p.waitForFunction(() => document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {});
    const ouvert = await p.evaluate(() => document.querySelector('#dlg').open);
    await p.waitForFunction(() => !document.querySelector('#main [data-task="t3"]'), null, { timeout: 5000 }).catch(() => {});
    check(ouvert && !(await p.$('#main [data-task="t3"]')), 'un appui pendant lequel un autre onglet enregistre : le clic ouvre le formulaire, l’écran se redessine ensuite (A40)');
    if (ouvert) { await p.click('#form button[value=cancel]'); await p.waitForFunction(() => !document.querySelector('#dlg').open); }
  }
  await onglet.close();

  console.log('au clavier seul (TRV-002)');
  // Étape 1 : depuis le haut de la page, Tab jusqu'à « Chantier » ; à chaque arrêt, un contour visible (:focus-visible,
  // au moins 1 px, à l'écran). Puis Entrée : l'écran s'ouvre, le focus à son titre.
  // Le point de départ en haut du document : l'app met le focus au titre de l'écran (A28), et Tab en repartirait, ferait
  // le tour du contenu, puis passerait par l'interface du navigateur avant de revenir en haut.
  await p.evaluate(() => { location.hash = 'accueil'; }); await p.waitForSelector('#capIn');
  await p.evaluate(() => { window.scrollTo(0, 0); const d = document.body; d.setAttribute('tabindex', '-1'); d.focus(); d.removeAttribute('tabindex'); });
  const arrets = [];
  for (let i = 0; i < 80; i++) {
    await p.keyboard.press('Tab');
    const a = await p.evaluate(() => { const el = document.activeElement, s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { nom: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('href') || ''}`, chantier: el.matches('#nav a[href="#chantier"]'),
        vu: el.matches(':focus-visible') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }; });
    arrets.push(a); if (a.chantier) break;
  }
  const sansContour = arrets.filter(a => !a.vu).map(a => a.nom);
  await p.keyboard.press('Enter'); await p.waitForFunction(() => location.hash === '#chantier', null, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300);
  check(arrets.at(-1)?.chantier && !sansContour.length && /^h2:Chantier/.test(await focused()),
    `Tab depuis le haut : ${arrets.length} arrêts jusqu’à « Chantier », chacun avec son contour${sansContour.length ? ' (sans : ' + sansContour.join(', ') + ')' : ''} ; Entrée : Chantier, le focus à son titre (${await focused()}) (TRV-002, étape 1)`);
  // Étape 2 : la tâche créée au clavier seul ; le focus revient dans l'espace, pas en haut de la page.
  const versBouton = async act => { for (let i = 0; i < 40 && (await p.evaluate(() => document.activeElement.dataset.act)) !== act; i++) await p.keyboard.press('Tab'); return (await p.evaluate(() => document.activeElement.dataset.act)) === act; };
  const atteint = await versBouton('task-new');
  await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {});
  const dansForm = await p.evaluate(() => !!document.activeElement.closest('#form'));
  await p.keyboard.type('Clavier TRV-002'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {});
  await p.waitForFunction(() => document.querySelector('#main').textContent.includes('Clavier TRV-002'), null, { timeout: 5000 }).catch(() => {});
  const apres2 = await p.evaluate(() => ({ dans: !!document.activeElement.closest('#main'), act: document.activeElement.dataset.act || document.activeElement.tagName, cree: JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.entries.some(t => t.title === 'Clavier TRV-002') }));
  check(atteint && dansForm && apres2.cree && apres2.dans, `Tab jusqu’à « Ajouter une tâche », Entrée, le titre tapé, Entrée : la tâche créée ; le focus dans l’espace (${apres2.act}) (étape 2)`);
  // Étape 5 : un formulaire ouvert puis fermé par Échap : rien d'enregistré, le focus sur le bouton qui l'a ouvert.
  const n5 = await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.entries.length);
  await p.focus('[data-act="task-new"]'); await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {});
  await p.keyboard.type('Jamais enregistrée'); await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('#dlg').open, null, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300);
  const apres5 = await p.evaluate(() => ({ ouvert: document.querySelector('#dlg').open, act: document.activeElement.dataset.act || document.activeElement.tagName, n: JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.entries.length, texte: document.querySelector('#main').textContent.includes('Jamais enregistrée') }));
  check(!apres5.ouvert && apres5.n === n5 && !apres5.texte && apres5.act === 'task-new', `Échap : le formulaire fermé, rien d’enregistré (${apres5.n} tâches), le focus sur « Ajouter une tâche » (${apres5.act}) (étape 5)`);

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
