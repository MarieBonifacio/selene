/* Scénario de navigateur : statut épistémique, provenance, pont de reprise, décisions. Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose des captures d'écran (téléphone), pour relire l'affichage à l'œil. */
const { engine, ouvrir, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  // Sur téléphone, la capture passe par le ⊕ de la barre basse (une feuille), plus par l'accueil.
  const capture = async t => { await p.click('[data-act="sheet-capture"]'); await p.fill('#capSheetIn', t); await p.press('#capSheetIn', 'Enter'); };
  await p.addInitScript(l => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', l); }, fixture());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); };

  console.log('statut épistémique');
  await capture('? le seuil précède le récit'); await p.waitForTimeout(200);
  let n = (await data()).modules.inbox.entries.at(-1);
  check(n.text === 'le seuil précède le récit' && n.ep === 'hyp', '« ? » devant une capture : une hypothèse, le « ? » retiré');
  check((await p.textContent('#toast')).includes('hypothèse'), 'le message le dit');

  console.log('provenance');
  await capture('Écriture : une phrase née ailleurs'); await p.waitForTimeout(200);
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(200); // « Ranger »
  let f = (await data()).modules.ecriture.scraps.at(-1);
  check(f.text === 'une phrase née ailleurs' && f.origin && f.origin.text === 'Écriture : une phrase née ailleurs' && f.origin.from === 'Capture', 'le fragment rangé garde une copie de la note d’origine');
  await go('ecriture');
  check((await main()).includes('↳ de Capture'), 'provenance affichée sous le fragment');
  await p.selectOption('li:has-text("une phrase née ailleurs") select.ep', 'inx'); await p.waitForTimeout(200);
  f = (await data()).modules.ecriture.scraps.at(-1);
  check(f.ep === 'inx' && f.epLog.length === 1, 'statut changé sur place, et daté');

  console.log('pont de reprise');
  // Le pont, ou à sa place, dans la planche, « Je m'arrête ici… » : lus sans attendre (un pont absent ne vient pas).
  const pont = () => p.evaluate(() => { const b = document.querySelector('#main .bridge'), e = document.querySelector('#main .plate [data-act="bridge-edit"]'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : e ? '+' + e.textContent.trim() : ''; });
  check((await pont()) === '+Je m\'arrête ici…', 'sans pont, l’espace propose « Je m’arrête ici… »' + ` (${await pont()})`);
  await p.click('[data-act="bridge-edit"]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.activeElement && document.activeElement.id === 'bridgeIn' && document.activeElement.placeholder === 'Le prochain geste, pour la prochaine fois…'), 'le champ « Le prochain geste, pour la prochaine fois… » s’ouvre et prend le focus');
  await p.fill('#bridgeIn', 'réécrire l’ouverture du ch. 3'); await p.click('[data-act="bridge-save"]'); await p.waitForTimeout(200); // PEN-006, étape 2 : « Garder »
  check((await main()).includes('Reprendre : réécrire l’ouverture du ch. 3') && (await p.textContent('#toast')) === 'Noté. La prochaine fois commencera ici.', 'gardé : « Noté. La prochaine fois commencera ici. », et le pont en haut du module');
  await shot('ecriture');
  await go('accueil');
  check((await p.textContent('#main small.resume').catch(() => '')).trim() === '↳ réécrire l’ouverture du ch. 3 · aujourd\'hui', 'et sur l’accueil, sous la ligne du module : « ↳ … · aujourd’hui »');
  await go('ecriture'); await p.click('[data-act="bridge-done"]'); await p.waitForTimeout(150);
  check(!(await data()).modules.ecriture.resume && (await p.textContent('#toast')).startsWith('Repris. Le pont est levé.') && (await pont()) === '+Je m\'arrête ici…', '« fait » : « Repris. Le pont est levé. », le pont disparaît de l’écran et des données');
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(150);
  check((await data()).modules.ecriture.resume.text === 'réécrire l’ouverture du ch. 3' && (await pont()).includes('Reprendre : réécrire l’ouverture du ch. 3'), '« Annuler » le remet, à l’écran comme dans les données');

  console.log('décisions');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:decisions'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await go('decisions'); await p.click('[data-act="col-new"]'); await p.waitForTimeout(150);
  await p.fill('#form [name=title]', 'Enduit à la chaux'); await p.fill('#form [name=tag]', 'Rénovation');
  await p.fill('#form [name=due]', '2026-01-15'); await p.selectOption('#form [name=status]', 'Prise');
  await p.fill('#form [name=text]', 'Humidité du mur nord. Réviser si devis > 1 200 €.');
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  check((await main()).includes('à réexaminer le'), 'la date se lit comme un rendez-vous de révision');
  await go('accueil');
  check((await main()).includes('« Enduit à la chaux » : à réexaminer'), 'une décision prise revient sur l’accueil à sa date');
  await shot('accueil');
  await p.click('[data-act="col-reread"]'); await p.waitForTimeout(150);
  check((await p.inputValue('#form [name=text]')).includes('Humidité du mur nord'), '« relire » montre la raison d’alors');
  await p.click('#form button[value=cancel]'); await p.waitForTimeout(100);
  await p.click('[data-act="col-keep"]'); await p.waitForTimeout(150);
  const x = (await data()).modules.decisions.entries[0];
  check(x.due === '' && x.reviews.length === 1 && x.reviews[0].verdict === 'maintenue', '« maintenue » : réexamen daté, rendez-vous levé');
  check(!(await main()).includes('à réexaminer'), 'et l’accueil s’en libère');

  console.log('concordance des motifs');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#newModType', 'tpl:motifs'); await p.click('[data-act="mod-add"]'); await p.waitForTimeout(200);
  await go('motifs');
  for (const [title, variants] of [['Seuil', 'porte'], ['Récit', ''], ['Sorcière', '']]) {
    await p.click('[data-act="col-new"]'); await p.waitForTimeout(120);
    await p.fill('#form [name=title]', title); await p.fill('#form [name=subtitle]', variants);
    await p.click('#form button[value=save]'); await p.waitForTimeout(150);
  }
  let t = await main();
  check(/Seuil.*1 occurrence · dernière aujourd'hui \(Capture\)/.test(t), 'un motif est compté dans les autres modules, avec sa dernière apparition');
  check(/Sorcière.*jamais rencontré/.test(t), 'un motif absent le dit');
  await go('accueil'); await capture('Une porte, un seuil, un récit'); await p.waitForTimeout(200);
  await go('motifs'); t = await main();
  check(/Seuil.*2 occurrences/.test(t) && t.includes('voisins : Récit (2)'), 'variantes comptées, voisins dès deux rencontres communes');
  await shot('motifs');
  await p.click('li:has(b:text-is("Seuil")) [data-act="search-for"]'); await p.waitForTimeout(250);
  check((await p.inputValue('#searchIn')) === 'Seuil', '« voir » mène à la recherche du motif');

  console.log('recherche et bilan');
  await go('bilan');
  check((await main()).includes('Statut des idées notées'), 'le bilan compte les idées par statut');
  check((await main()).includes('Seuil ×2'), 'le bilan dit quels motifs sont apparus dans la période');
  await p.click('[data-act="search-for"]:has-text("hypothèse")'); await p.waitForTimeout(250);
  check((await p.inputValue('#searchIn')) === 'statut:hypothèse' && (await main()).includes('le seuil précède le récit'), 'un statut du bilan mène à la recherche filtrée');
  check(!(await main()).includes('une phrase née ailleurs'), 'et ne garde que ce statut');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');

  console.log('le jeu d’essai : la jachère des motifs (MOD-020)');
  const essai = donnee('jeu-essai.json');
  const q = await b.newPage({ viewport: { width: 1280, height: 900 } }); q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  await ouvrir(q, BASE + '/index.html#carnet', () => !!document.querySelector('#noteIn'));
  await q.fill('#noteIn', 'Des lisières et des lisérés.'); await q.click('[data-act="note-add"]');
  await q.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.carnet.entries.some(e => e.text === 'Des lisières et des lisérés.'), null, { timeout: 5000 }).catch(() => {});
  await q.evaluate(() => { location.hash = 'motifs'; }); await q.waitForSelector('#main li.motif');
  await q.click('[data-act="goto-groups"][data-mod="motifs"]'); await q.waitForSelector('#sheet [data-set-mod="motifs.fallowDays"]');
  await q.fill('#sheet [data-set-mod="motifs.fallowDays"]', '1'); await q.press('#sheet [data-set-mod="motifs.fallowDays"]', 'Tab');
  await q.waitForFunction(() => +JSON.parse(localStorage.getItem('selene-site-v1')).modules.motifs.config.fallowDays === 1, null, { timeout: 5000 }).catch(() => {});
  await q.keyboard.press('Escape');
  await q.waitForFunction(() => [...document.querySelectorAll('#main h3')].some(h => h.textContent.trim() === 'En jachère'), null, { timeout: 5000 }).catch(() => {});
  const jachere = await q.evaluate(() => {
    const h = [...document.querySelectorAll('#main h3')].find(x => x.textContent.trim() === 'En jachère'), sec = h && h.closest('section');
    const marque = t => { const li = [...document.querySelectorAll('#main li.motif')].find(l => l.querySelector('b').textContent === t); return li ? !!li.querySelector('.late') : null; };
    return { liste: sec ? [...sec.querySelectorAll('[data-act="search-for"]')].map(x => x.textContent.trim()).join() : '', dit: sec ? sec.querySelector('.hint').textContent.trim() : '', lisiere: marque('lisière'), brume: marque('brume'), phalene: marque('phalène') };
  });
  // Le nombre de lunaisons d'absence dépend du jour où la CI passe ; la phrase s'accorde au nombre de jours (A42).
  check(/^brume · \d+ lunaisons?$/.test(jachere.liste) && jachere.dit === 'Vivants, mais absents depuis plus de 1 jour. Reposés, pas perdus.' && jachere.brume === true && jachere.lisiere === false && jachere.phalene === false,
    `jachère après un jour : « brume » y passe ; « lisière », vue aujourd’hui dans le Carnet, reste vivante ; « phalène », épuisé, absent depuis le 18 août, n’y est pas (C18) (${JSON.stringify(jachere)}) (étape 3)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
