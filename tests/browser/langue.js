/* Scénario de navigateur : la langue de l'interface (src/app/i18n, docs/i18n.md). Lancé par tests/browser/run.js.
   - un appareil en anglais reçoit l'interface en anglais : dates, lune, navigation, écrans principaux, sommes ; les
     valeurs enregistrées ne bougent pas ;
   - le sélecteur des Réglages passe en français tout de suite, sans recharger, et le choix suit le compte ;
   - la pseudo-langue (config.lang = "qps") montre chaque texte passé par la traduction, entre ⟦ ⟧ ;
   - « langue de l'appareil » (valeur vide) rend l'anglais, squelette compris. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
(async () => {
  const b = await engine.launch(launchOptions);
  // Un appareil réglé en anglais américain : Selene le suit (l'anglais est proposé), au format britannique (en-GB).
  const p = await b.newPage({ locale: 'en-US', viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const state = () => p.evaluate(() => ({ lang: document.documentElement.lang, phase: document.querySelector('.phase')?.textContent || '', dateline: document.querySelector('#dateline').textContent }));
  const FR_DAYS = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) /, EN_DAYS = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/;
  const go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(200); };
  const text = sel => p.$eval(sel, el => el.textContent.trim());

  console.log('appareil en anglais : l’interface en anglais');
  let s = await state();
  check(await p.evaluate(() => navigator.language) === 'en-US', 'le navigateur se dit bien en anglais');
  check(s.lang === 'en', '<html lang="en">');
  check(EN_DAYS.test(s.dateline), 'la date du jour en anglais : ' + s.dateline);
  check(/moon|crescent|quarter|gibbous/i.test(s.phase), 'la phase de la lune en anglais : ' + s.phase);
  check((await text('#nav a[href="#bilan"]')).includes('Review') && (await text('#nav a[href="#reglages"]')).includes('Settings'), 'navigation en anglais');
  check(await p.getAttribute('#palIn', 'placeholder') === 'Go, act, search…', 'squelette en anglais (palette)');
  await go('bilan');
  check(await text('#main h2') === 'Review' && (await text('[data-act="bilan-mode"][data-m="lune"]')) === 'Lunar cycle', 'bilan en anglais');
  await go('recherche');
  check(await text('#main > h2') === 'Search' && await p.getAttribute('#searchIn', 'placeholder') === 'A word, a scrap of a sentence…', 'recherche en anglais');
  await go('budget');
  check(JSON.stringify(await p.$$eval('#bType option', os => os.map(o => o.value))) === '["dépense","revenu"]' && !/dépense|revenu/i.test(await text('#bType')), 'budget : libellés en anglais, valeurs enregistrées inchangées');
  check(/€\d/.test(await p.$eval('#main', el => el.textContent)), 'budget : les sommes au format anglais (€12.00), toujours en euros');
  await go('reglages');
  check(JSON.stringify(await p.$$eval('select[data-set="config.lang"] option', os => os.map(o => [o.value, o.textContent]))) === '[["","Device language"],["fr","Français"],["en","English"]]',
    'réglages : le sélecteur de langue, chaque langue sous son propre nom');

  console.log('le sélecteur : en français tout de suite, et pour le compte');
  await p.selectOption('select[data-set="config.lang"]', 'fr'); await p.waitForTimeout(200);
  s = await state();
  check(s.lang === 'fr' && FR_DAYS.test(s.dateline) && (await text('#main > h2')) === 'Réglages', 'français aussitôt, sans recharger : ' + s.dateline);
  check((await text('#nav a[href="#bilan"]')).includes('Bilan') && await p.getAttribute('#palIn', 'placeholder') === 'Aller, agir, chercher…', 'navigation et squelette en français');
  await p.waitForTimeout(1300); // l'enregistrement part au bout d'une seconde
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.lang) === 'fr', 'le choix est enregistré dans le compte (config.lang)');

  console.log('pseudo-langue');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('selene-site-v1')); d.config.lang = 'qps'; localStorage.setItem('selene-site-v1', JSON.stringify(d)); location.hash = 'accueil'; });
  await p.reload(); await p.waitForTimeout(300);
  s = await state();
  check(s.lang === 'qps-ploc', '<html lang="qps-ploc">');
  check(/^⟦.+⟧$/.test(s.phase), 'la phase de la lune est passée par la traduction : ' + s.phase);
  check(FR_DAYS.test(s.dateline) && s.dateline.includes('⟦'), 'les dates gardent les formats de la langue source, le nom de la lune est marqué');
  check(/^⟦/.test(await p.getAttribute('#miniMoon svg', 'aria-label')), 'l’étiquette de la petite lune aussi (lecteurs d’écran)');
  // La charpente : navigation, barre du bas, minuteur, et le squelette statique (shell.html), retraduit au changement.
  // Les textes restés nus (hors ⟦ ⟧) ; raccourcis clavier (kbd) et marques de navigation (.nx) mis de côté.
  // Les textes de l'interface sous `sel` qui ne sont pas passés par la traduction (raccourcis, compteurs, à part : `strip`).
  const marked = (sel, strip = 'kbd, .nx') => p.$$eval(sel, (els, strip) => els.map(el => { const c = el.cloneNode(true); c.querySelectorAll(strip).forEach(k => k.remove()); return c.textContent.trim(); }).filter(t => t && !/^[^\p{L}\p{N}]*⟦[^]*⟧$/u.test(t)), strip); // un symbole devant (✕, ›, +) n'est pas un texte
  const navNaked = await marked('#nav a[href="#accueil"], #nav a[href="#bilan"], #nav a[href="#recherche"], #nav a[href="#reglages"], #nav .pal-hint');
  check(!navNaked.length, 'navigation latérale traduite' + (navNaked.length ? ' : ' + navNaked.join(' | ') : ''));
  check(!(await marked('#bar a span, #bar button span')).length, 'barre du bas traduite');
  check(!(await marked('#timerBtn, #cdlg button')).length, 'minuteur et boîte de confirmation (squelette) traduits');
  check(/^⟦/.test(await p.getAttribute('#palIn', 'placeholder')) && /^⟦/.test(await p.getAttribute('#nav', 'aria-label')), 'attributs du squelette traduits (placeholder, aria-label)');
  await p.click('#timerBtn'); await p.waitForTimeout(100);
  check(/^⟦Pàüsé/.test(await p.textContent('#timerBtn')), 'le bouton du minuteur suit son état dans la langue : ' + await p.textContent('#timerBtn'));
  await p.click('#timerBtn');
  await p.evaluate(() => location.hash = 'kundalini'); await p.waitForTimeout(200);
  check(!(await marked('.plate .pl, .plate [data-act="goto-groups"], .plate [data-act="bridge-edit"]')).length, 'la planche d’un espace (numéro, « régler », pont) traduite');
  // Les types de module : un échantillon de leurs textes propres (le reste, ce sont les données de la personne).
  const types = { kundalini: '[data-act="prog-start"], #main a[data-act="goto-groups"]', // pas encore commencé, dans le jeu d'essai ecriture: '[data-act="scrap-add"], [data-act="scrap-md"]', phidippus: '[data-act="entry-log"], [data-act="entry-note"]',
    chantier: '[data-act="task-new"], [data-act="task-pick"]', budget: '.stats span, [data-act="bud-add"], #bType option', inbox: '[data-act="note-add"]' };
  for (const [mod, sel] of Object.entries(types)) {
    await p.evaluate(m => location.hash = m, mod); await p.waitForTimeout(150);
    const naked = await marked(sel);
    check(!naked.length && (await p.$$(sel)).length, `type ${mod} : ses textes passent par la traduction` + (naked.length ? ' : ' + naked.join(' | ') : ''));
  }
  await p.evaluate(() => location.hash = 'budget'); await p.waitForTimeout(150);
  check(JSON.stringify(await p.$$eval('#bType option', os => os.map(o => o.value))) === '["dépense","revenu"]', 'budget : les valeurs enregistrées restent « dépense » et « revenu », seuls les libellés se traduisent');
  await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(200);
  const homeNaked = await marked('.two h2, #main section > .row > h2, .hero .txt > p:not(.sky-line)'); // les Sortes ont leur lot
  check(!homeNaked.length, 'accueil : titres et phrase de la lune traduits' + (homeNaked.length ? ' : ' + homeNaked.join(' | ') : ''));
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(200);
  const nakedH3 = await marked('#main > h2, #main h3, #main h4, .chap > p.hint, .reg-toc button, .reg-guide p, .reg-guide summary, .lex dt, .lex dd, .reg-keys > span, .fld-h > span[id], .newmod summary, .tpl b, .tpl .hint', '.n, .tip, .tipb');
  check(!nakedH3.length, 'réglages : chapitres, sommaire, guide, vocabulaire, sous-titres et champs traduits' + (nakedH3.length ? ' : ' + nakedH3.join(' | ') : ''));
  const tipsNaked = await marked('.tipb');
  check(!tipsNaked.length && (await p.$$('.tipb')).length > 10, 'réglages : les infobulles aussi' + (tipsNaked.length ? ' : ' + tipsNaked.join(' | ') : ''));
  check(!(await p.$$eval('button.tip', bs => bs.map(x => x.getAttribute('aria-label')).filter(l => !/^⟦/.test(l)))).length, 'réglages : le nom de chaque « ? » (lecteurs d’écran)');
  check(!(await marked('.swatch, select[data-set="config.mode"] option')).length, 'réglages : palettes et modes traduits');
  const tplNaked = await marked('#newModType option');
  check(!tplNaked.length && (await p.$$('#newModType option')).length > 10, 'réglages : modèles et types de module traduits' + (tplNaked.length ? ' : ' + tplNaked.join(' | ') : ''));
  const skyNaked = await marked('#ciel .hint, #ciel button, #ciel label');
  check(!skyNaked.length, 'réglages → Ciel traduit' + (skyNaked.length ? ' : ' + skyNaked.join(' | ') : ''));
  await p.evaluate(() => location.hash = 'bilan'); await p.waitForTimeout(250);
  const bilanNaked = await marked('#main h2, #main h3, #main p.hint, #main .btn.sm, #main .over em');
  check(!bilanNaked.length, 'bilan : titres, explications, boutons et « avant » traduits' + (bilanNaked.length ? ' : ' + bilanNaked.join(' | ') : ''));
  await p.click('[data-act="planche-open"]'); await p.waitForTimeout(250);
  const plNaked = await marked('.planche h2, .planche h3, .pl-no, .pl-sub, .pl-regle figcaption, .pl-tools button:not([data-act="planche-nav"]), .pl-mods small, .pl-cols p');
  check(!plNaked.length && (await p.$('.planche')), 'planche de lunaison traduite' + (plNaked.length ? ' : ' + plNaked.join(' | ') : ''));
  check(/⟦.+⟧$/.test(await p.textContent('.pl-foot')) && /^‹ ⟦/.test(await p.textContent('.pl-tools a')), 'planche : pied et retour au bilan aussi (le nom choisi, lui, reste tel quel)');
  await p.evaluate(() => location.hash = 'recherche'); await p.waitForTimeout(200);
  await p.fill('#searchIn', 'e'); await p.waitForTimeout(250);
  const searchNaked = await marked('#main > h2, #main > p.hint, #main .row p.hint, .chip-f[data-k="period"], .chip-f[data-v=""], #main [data-act="search-dossier"], #main .item a.btn', 'span');
  check(!searchNaked.length && (await p.$$('.chip-f')).length, 'recherche : explication, compte, facettes et boutons traduits' + (searchNaked.length ? ' : ' + searchNaked.join(' | ') : ''));
  check(/^⟦/.test(await p.getAttribute('#searchIn', 'placeholder')), 'recherche : le champ aussi');
  await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(200);

  console.log('retour à la langue de l’appareil, sans recharger');
  await go('reglages');
  await p.selectOption('select[data-set="config.lang"]', ''); await p.waitForTimeout(200);
  s = await state();
  check(s.lang === 'en' && EN_DAYS.test(s.dateline), 'l’interface redevient anglaise aussitôt : ' + s.dateline);
  check(await p.textContent('#timerBtn') === 'Resume' && await p.textContent('#cdlg button[value="ok"]') === 'Confirm' && await p.getAttribute('#palIn', 'placeholder') === 'Go, act, search…',
    'le squelette suit lui aussi (minuteur en pause : « Resume »)');
  await p.waitForTimeout(1300); // l'enregistrement part au bout d'une seconde
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.lang) === '', 'le choix est enregistré dans le compte (config.lang)');

  console.log('en anglais, sur téléphone : rien ne déborde');
  const t = await b.newPage({ locale: 'en-US', viewport: { width: 375, height: 812 } }); t.on('pageerror', e => errs.push(e.message));
  await t.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await t.goto(BASE + '/index.html'); await t.waitForTimeout(300);
  const wide = [];
  for (const h of ['accueil', 'bilan', 'bilan/planche', 'recherche', 'reglages', ...Object.keys(demo.modules)]) {
    await t.evaluate(x => location.hash = x, h); await t.waitForTimeout(150);
    if (await t.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) wide.push(h);
  }
  check(await t.evaluate(() => document.documentElement.lang) === 'en' && !wide.length, 'aucun débordement horizontal en anglais, sur 375 px' + (wide.length ? ' : ' + wide.join(', ') : ''));

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
