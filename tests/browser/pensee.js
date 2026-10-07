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

  console.log('le jeu d’essai : décisions, statut, provenance (MOD-019, PEN-001, PEN-002)');
  // Un ordinateur, le jeu d'essai, l'horloge figée le 7 octobre 2026 à 10 h à Paris.
  const r = await b.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris' }); r.on('pageerror', e => errs.push(e.message));
  await r.clock.setFixedTime(new Date('2026-10-07T10:00:00+02:00'));
  await r.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  await ouvrir(r, BASE + '/index.html', () => !!document.querySelector('#main > *'));
  const vers = async (h, sel) => { await r.evaluate(x => { location.hash = x; }, h); await r.waitForSelector(sel, { state: 'attached' }); };
  const bulle = () => r.evaluate(() => document.querySelector('#toast').textContent.replace(/\s+/g, ' ').trim());
  const vider = () => r.evaluate(() => { document.querySelector('#toast').textContent = ''; });
  const site = () => r.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const deux = () => r.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const fiche = async sel => { await r.click(sel); await r.waitForFunction(() => /Fiche de l|Réexamens|Voir dans/.test((document.querySelector('#sheet') || {}).textContent || '')); const t = (await r.textContent('#sheet')).replace(/\s+/g, ' '); await r.keyboard.press('Escape'); return t; };
  const decision = async () => (await site()).modules.decisions.entries.find(e => e.id === 'd1');
  const ligneD1 = () => r.evaluate(() => { const x = document.querySelector('#main [data-act="col-keep"][data-id="d1"]'), li = x && x.closest('li'); return li ? li.textContent.replace(/\s+/g, ' ').trim() : ''; });

  await vers('accueil', '#main [data-act="col-keep"][data-id="d1"]');
  const l1 = await ligneD1(), placo = await r.evaluate(() => !!document.querySelector('#main [data-act="col-keep"][data-id="d2"]') || [...document.querySelectorAll('#main li.item.alert')].some(l => l.textContent.includes('Placo')));
  check(l1.startsWith('« Enduit à la chaux pour le mur nord » : à réexaminer (Décisions)') && l1.includes('relire') && l1.includes('maintenue') && !placo,
    `l’accueil : « ${l1.replace(/relire ?maintenue$/, '').trim()} », avec « relire » et « maintenue » ; aucun rendez-vous pour « Placo », abandonnée (MOD-019, étape 1)`);
  await r.click('[data-act="col-reread"][data-id="d1"]'); await r.waitForFunction(() => document.querySelector('#dlg').open);
  const raison = await r.inputValue('#form [name=text]');
  check(raison === 'Humidité du mur nord. Réviser si le devis dépasse 1 200 €.', `« relire » : « ${raison} » (MOD-019, étape 2)`);
  await r.click('#form button[value=cancel]'); await r.waitForFunction(() => !document.querySelector('#dlg').open);
  await vider(); await r.click('[data-act="col-keep"][data-id="d1"]'); await r.waitForFunction(() => document.querySelector('#toast').textContent.includes('Maintenue'));
  const dit3 = await bulle(), parti = !(await r.$('#main [data-act="col-keep"][data-id="d1"]'));
  // La fiche lue pendant que la bulle offre encore « Annuler » (6 s).
  await vers('decisions', 'li[data-id="d1"] [data-act="specimen"]');
  const fiche3 = await fiche('li[data-id="d1"] [data-act="specimen"]');
  check(dit3.startsWith('Maintenue. La raison d\'alors tient encore.') && parti && fiche3.includes('Réexamens') && fiche3.includes('maintenue, le 7 octobre 2026'),
    `« maintenue » : « ${dit3.replace(/ ?Annuler$/, '')} » ; la ligne quitte l’accueil ; la fiche : « Réexamens · maintenue, le 7 octobre 2026 » (MOD-019, étape 3)`);
  const annulable = !!(await r.$('#toast [data-act="undo"]'));
  if (annulable) await r.click('#toast [data-act="undo"]');
  await vers('accueil', '#main'); await r.waitForSelector('#main [data-act="col-keep"][data-id="d1"]', { timeout: 5000 }).catch(() => {});
  const d4 = await decision();
  check(annulable && !!(await r.$('#main [data-act="col-keep"][data-id="d1"]')) && d4.due === '2020-01-01' && !(d4.reviews || []).length,
    `« Annuler » : la décision revient sur l’accueil, son rendez-vous rétabli (${d4.due})${annulable ? '' : ' (la bulle n’offrait plus « Annuler »)'} (MOD-019, étape 4)`);
  await vers('decisions', 'li[data-id="d1"] [data-act="col-edit"]'); await r.click('li[data-id="d1"] [data-act="col-edit"]'); await r.waitForFunction(() => document.querySelector('#dlg').open);
  await r.fill('#form [name=due]', '2027-04-07'); await r.click('#form button[value=save]'); await r.waitForFunction(() => !document.querySelector('#dlg').open);
  await r.waitForFunction(() => (JSON.parse(localStorage.getItem('selene-site-v1')).modules.decisions.entries.find(e => e.id === 'd1') || {}).due === '2027-04-07', null, { timeout: 5000 }).catch(() => {});
  await vers('accueil', '#main'); await deux();
  const d5 = await decision(), revue = (d5.reviews || []).at(-1) || {};
  check(!(await r.$('#main [data-act="col-keep"][data-id="d1"]')) && d5.due === '2027-04-07' && revue.verdict === 'revue' && revue.date === '2026-10-07',
    `la date mise dans six mois (${d5.due}) : la décision quitte l’accueil ; un réexamen « ${revue.verdict} » du ${revue.date} est noté (MOD-019, étape 5)`);

  await vers('accueil', '#capIn'); await vider();
  await r.fill('#capIn', '? les hêtres gèlent avant les sapins'); await r.click('[data-act="cap-add"]');
  await r.waitForFunction(() => document.querySelector('#toast').textContent.includes('hypothèse'), null, { timeout: 5000 }).catch(() => {});
  const dit1 = await bulle();
  await r.fill('#capIn', 'pourquoi ? parce que'); await r.click('[data-act="cap-add"]');
  await r.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.inbox.entries.some(e => e.text === 'pourquoi ? parce que'), null, { timeout: 5000 }).catch(() => {});
  await vers('inbox', '#main li.item[data-id]');
  const notes = await r.$$eval('#main li.item[data-id]', xs => xs.map(x => [x.dataset.id, ((x.querySelector('.ntext') || {}).textContent || '').trim(), (x.querySelector('select.ep') || {}).value]));
  const hetres = notes.find(x => x[1] === 'les hêtres gèlent avant les sapins'), pourquoi = notes.find(x => x[1] === 'pourquoi ? parce que');
  check(dit1 === 'Gardé comme hypothèse. Elle attendra ses preuves.' && !!hetres && hetres[2] === 'hyp', `« ? les hêtres… » : « ${dit1} » ; dans la boîte, « ${hetres && hetres[1]} », statut « hypothèse » (PEN-001, étape 1)`);
  check(!!pourquoi && pourquoi[2] === '', `« pourquoi ? parce que » : gardé tel quel, sans statut (PEN-001, étape 2)`);
  await r.selectOption(`li[data-id="${hetres[0]}"] select.ep`, 'inx');
  await r.waitForFunction(id => (JSON.parse(localStorage.getItem('selene-site-v1')).modules.inbox.entries.find(e => e.id === id) || {}).ep === 'inx', hetres[0], { timeout: 5000 }).catch(() => {});
  const surPlace = await r.$eval(`li[data-id="${hetres[0]}"] select.ep`, x => x.value);
  const ficheN = await fiche(`li[data-id="${hetres[0]}"] [data-act="specimen"]`);
  check(surPlace === 'inx' && ficheN.includes('Statut, au fil du temps') && ficheN.includes('7 octobre 2026 : hypothèse → inexpliqué'), `« inexpliqué » sur place ; la fiche : « 7 octobre 2026 : hypothèse → inexpliqué » (PEN-001, étape 3)`);
  // Les résultats sont rendus à la frappe : deux images plus tard, ils disent la requête du champ.
  const chercher = async q => {
    await vers('recherche', '#searchIn'); await r.fill('#searchIn', q); await r.waitForFunction(v => document.querySelector('#searchIn').value === v, q); await deux();
    return r.$$eval('#main li.item', xs => xs.map(x => { const d = x.querySelector('div').cloneNode(true); d.querySelectorAll('.meta').forEach(m => m.remove()); return d.textContent.trim(); }));
  };
  const attendus = ['la brume précède la pluie', 'Les sapins gardent la nuit plus longtemps que les hêtres.'];
  const h4 = await chercher('statut:hypothèse'), h5 = await chercher('status:hyp');
  check(h4.join('|') === attendus.join('|'), `« statut:hypothèse » : ${h4.join(' ; ')} ; pas la note passée à inexpliqué (PEN-001, étape 4)`);
  check(h5.join('|') === h4.join('|'), `« status:hyp » : les mêmes résultats (PEN-001, étape 5)`);
  await vers('bilan', '[data-act="bilan-mode"][data-m="mois"]'); await r.click('[data-act="bilan-mode"][data-m="mois"]');
  await r.waitForFunction(() => /octobre 2026/i.test(document.querySelector('#main').textContent)); await r.click('[data-act="bilan-nav"][data-d="1"]');
  await r.waitForFunction(() => /septembre 2026/i.test(document.querySelector('#main').textContent));
  const statuts = await r.evaluate(() => { const h = [...document.querySelectorAll('#main h3')].find(x => x.textContent.trim() === 'Statut des idées notées'), sec = h && h.closest('section'); return sec ? [...sec.querySelectorAll('[data-act="search-for"]')].map(x => [x.textContent.trim(), x.dataset.q]) : []; });
  const hyp = statuts.find(x => x[1] === 'statut:hypothèse');
  if (hyp) await r.click('#main [data-act="search-for"][data-q="statut:hypothèse"]');
  await r.waitForFunction(() => location.hash === '#recherche', null, { timeout: 5000 }).catch(() => {});
  check(!!hyp && hyp[0] === '1 hypothèse' && (await r.inputValue('#searchIn').catch(() => '')) === 'statut:hypothèse',
    `septembre 2026, en mois : « Statut des idées notées » compte ${hyp ? hyp[0] : 'rien'} (${statuts.map(x => x[0]).join(', ')}) ; le statut mène à la recherche filtrée (PEN-001, étape 6)`);

  await vers('inbox', 'li[data-id="n3"] [data-act="note-file"]'); await vider(); await r.click('li[data-id="n3"] [data-act="note-file"]');
  await r.waitForFunction(() => document.querySelector('#toast').textContent.includes('Rangé'), null, { timeout: 5000 }).catch(() => {});
  const ecrit = (await site()).modules.ecriture.scraps.find(s => s.text === 'la lisière comme seuil');
  check(!(await r.$('#main li[data-id="n3"]')) && !!ecrit && (await bulle()).startsWith('Rangé : « la lisière comme seuil » dans Écriture.'), '« Ranger » : la note quitte la boîte ; un fragment « la lisière comme seuil » dans Écriture (PEN-002, étape 1)');
  const marge = async t => { await vers('ecriture', '#main li.item'); return r.evaluate(x => { const li = [...document.querySelectorAll('#main li.item')].find(l => l.textContent.includes(x)), o = li && li.querySelector('aside.marg .origin'); return o ? o.textContent.trim() : ''; }, t); };
  const m2 = await marge('la lisière comme seuil');
  check(m2 === '↳ de Boîte, 23 sept. : « Écriture : la lisière comme seuil »', `en marge du fragment : « ${m2} » (PEN-002, étape 2)`);
  await vers('inbox', 'li[data-id="n6"] [data-act="note-to"][data-to="carnet"]'); await r.click('li[data-id="n6"] [data-act="note-to"][data-to="carnet"]');
  await r.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.carnet.entries.some(e => e.text === 'Penser à rappeler la quincaillerie'), null, { timeout: 5000 }).catch(() => {});
  await vers('carnet', '#main li.item');
  await r.evaluate(() => { const li = [...document.querySelectorAll('#main li.item')].find(l => l.textContent.includes('quincaillerie')); li.querySelector('[data-act="note-to"][data-to="ecriture"]').click(); });
  // Selon l'espace d'arrivée, le rangement passe ou non par un formulaire : l'un ou l'autre, puis l'enregistrer s'il s'ouvre.
  const versEcriture = () => document.querySelector('#dlg').open || JSON.parse(localStorage.getItem('selene-site-v1')).modules.ecriture.scraps.some(s => s.text === 'Penser à rappeler la quincaillerie');
  await r.waitForFunction(versEcriture, null, { timeout: 5000 }).catch(() => {});
  if (await r.evaluate(() => document.querySelector('#dlg').open)) await r.click('#form button[value=save]');
  await r.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.ecriture.scraps.some(s => s.text === 'Penser à rappeler la quincaillerie'), null, { timeout: 5000 }).catch(() => {});
  const m3 = await marge('Penser à rappeler la quincaillerie');
  check(m3.startsWith('↳ de Boîte, 2 août') && !m3.includes('Carnet'), `rangée dans Carnet, puis de Carnet dans Écriture : « ${m3} », sa première naissance (PEN-002, étape 3)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
