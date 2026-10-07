/* Scénario de navigateur : navigation (évolution de l'interface, vague 2 : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
const demo = JSON.parse(fixture());
// 150 fragments : le plus ancien est au-delà de la première page de cent.
demo.modules.ecriture.scraps = Array.from({ length: 150 }, (_, i) => ({ id: 'f' + i, text: i === 0 ? 'La lisière des aulnes' : 'Fragment ordinaire ' + i, date: '2026-0' + (1 + (i % 8)) + '-1' + (i % 9) }));
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctxD = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctxD.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  const d = await ctxD.newPage(); d.on('pageerror', e => errs.push(e.message));
  await d.goto(BASE + '/index.html'); await d.waitForTimeout(400);
  const go = async (p, h) => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const hash = p => p.evaluate(() => location.hash);

  console.log('barre latérale et domaines');
  ok(await d.isVisible('#nav a[href="#bilan"]') && !(await d.isVisible('#bar')), 'ordinateur : barre latérale (avec le Bilan), pas de barre basse');
  await go(d, 'reglages');
  await d.fill('.set.mod:has([value="Chantier"]) [data-act="mod-group"]', 'Maison'); await d.press('.set.mod:has([value="Chantier"]) [data-act="mod-group"]', 'Tab'); await d.waitForTimeout(200);
  ok((await d.textContent('#nav')).includes('Maison'), 'un domaine réglé devient un titre de la navigation');
  { // NAV-002, étapes 1 et 3 : les lentilles en tête, les domaines en petites capitales (Spectral SC, en minuscules), un seul lien marqué.
    await go(d, 'ecriture');
    const nav = await d.evaluate(() => {
      const t = [...document.querySelectorAll('#nav a')].map(a => a.textContent.replace(/\s+/g, ' ').trim()), g = document.querySelector('#nav .grp'), cs = g && getComputedStyle(g);
      return { t, police: cs && cs.fontFamily, casse: cs && cs.textTransform, chargee: document.fonts.check('1em "Spectral SC"'), marques: [...document.querySelectorAll('#nav [aria-current]')].map(a => a.getAttribute('href') + '=' + a.getAttribute('aria-current')) };
    });
    ok(nav.t[0] === "Aujourd'hui" && nav.t.slice(0, 3).includes('Chercher') && nav.t.slice(0, 3).includes('Bilan') && /^"?Spectral SC/.test(nav.police) && nav.casse === 'lowercase' && nav.chargee,
      `la barre latérale : « Aujourd’hui », « Bilan », « Chercher » en tête ; les domaines en petites capitales (${nav.police.split(',')[0]}, ${nav.casse}) (NAV-002, étape 1)`);
    ok(nav.marques.join() === '#ecriture=page', `seul le lien de l’espace ouvert porte aria-current (${nav.marques.join(', ')}) (NAV-002, étape 3)`);
  }
  await go(d, 'accueil'); ok((await d.textContent('#main')).includes('Maison'), 'et regroupe le sommaire de l’accueil');

  console.log('palette');
  await d.keyboard.press('Control+k'); await d.waitForTimeout(100);
  ok(await d.isVisible('#palette') && (await d.getAttribute('#palIn', 'placeholder')) === 'Aller, agir, chercher…', '⌘K / Ctrl+K ouvre la palette, son champ dit « Aller, agir, chercher… »');
  await d.keyboard.type('écri');
  await d.waitForFunction(() => ((document.querySelector('#palList li') || {}).textContent || '').includes('Écriture'), null, { timeout: 10000 }).catch(() => {});
  await d.keyboard.press('Enter'); await d.waitForFunction(() => location.hash === '#ecriture', null, { timeout: 10000 }).catch(() => {});
  ok(await hash(d) === '#ecriture' && !(await d.isVisible('#palette')), 'un espace trouvé par son nom, Entrée y mène');
  await go(d, 'accueil');
  await d.keyboard.press('Control+k'); await d.keyboard.type('aulnes');
  // La ligne cherchée, pas 150 ms : à ×4, la recherche dans 150 fragments n'avait pas encore répondu (BL-22).
  await d.waitForFunction(t => [...document.querySelectorAll('#palList li')].some(li => li.textContent.includes(t)), 'La lisière des aulnes', { timeout: 10000 }).catch(() => {});
  const n = await d.$$eval('#palList li', lis => lis.findIndex(li => li.textContent.includes('La lisière des aulnes')));
  for (let i = 0; i < n; i++) await d.keyboard.press('ArrowDown');
  await d.keyboard.press('Enter'); await d.waitForTimeout(300);
  ok(await hash(d) === '#ecriture/f0', 'un texte trouvé dans la palette mène à son entrée');
  ok(await d.$eval('[data-id="f0"]', el => el.classList.contains('flash') && el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= innerHeight), 'l’entrée, au-delà de la première page, est dépliée, montrée et surlignée');
  // Choisir une ligne de la palette : la chercher, puis y descendre au clavier, comme une personne.
  const choisir = async (q, ligne) => {
    await d.keyboard.press('Control+k'); await d.keyboard.type(q);
    await d.waitForFunction(t => [...document.querySelectorAll('#palList li')].some(li => li.textContent.includes(t)), ligne, { timeout: 10000 }).catch(() => {});
    const i = await d.$$eval('#palList li', (lis, t) => lis.findIndex(li => li.textContent.includes(t)), ligne);
    for (let k = 0; k < i; k++) await d.keyboard.press('ArrowDown');
    await d.keyboard.press('Enter'); await d.waitForTimeout(250);
    return i;
  };
  await go(d, 'accueil');
  const boite = () => d.evaluate(() => { const s = JSON.parse(localStorage.getItem('selene-site-v1')); return Object.values(s.modules).find(m => m.type === 'notes' && m.config.inbox).entries.map(e => e.text); });
  const garde = await choisir('phrase NAV-003 gardée', '« phrase NAV-003 gardée » dans');
  ok(garde >= 0 && (await d.textContent('#toast')).startsWith("Gardé. Tu peux oublier, c'est écrit.") && (await boite()).includes('phrase NAV-003 gardée'), 'garder depuis la palette : « Gardé. Tu peux oublier, c’est écrit. », la phrase est dans la boîte');
  const minuteur = await choisir('minuteur', 'Lancer le minuteur (15 min)');
  ok(minuteur >= 0 && (await d.textContent('#timerBtn')) === 'Pause' && !(await d.isVisible('#palette')), '« Lancer le minuteur (15 min) » le démarre');
  await d.click('#timerBtn'); await d.click('#timerReset');
  await d.keyboard.press('Control+k'); await d.keyboard.type('zzzz');
  await d.waitForFunction(() => [...document.querySelectorAll('#palList li')].some(li => li.textContent.includes('« zzzz » partout')), null, { timeout: 10000 }).catch(() => {});
  const rien = (await d.$$eval('#palList li', lis => lis.map(li => li.textContent))).join(' | ');
  ok(/^Garder« zzzz » dans .+ \| Chercher« zzzz » partout$/.test(rien), `rien de trouvé : garder ou chercher partout, rien d’autre (${rien}) (C12)`);
  await d.keyboard.press('Escape'); await d.waitForTimeout(100);
  ok(!(await d.isVisible('#palette')), 'Échap ferme la palette');

  console.log('liens directs et retour');
  await go(d, 'recherche'); await d.fill('#searchIn', 'aulnes'); await d.waitForTimeout(200);
  const resultats = () => d.$$eval('#main .search-grp + ul li.item', ls => ls.map(l => l.querySelector('a[href^="#"]')?.getAttribute('href')).join());
  ok((await d.textContent('#main .row .hint')).trim().startsWith('1 résultat') && (await resultats()) === '#ecriture/f0', 'le mot unique : un résultat, et un seul (NAV-006, étape 1)');
  await d.click('#main a[href="#ecriture/f0"]'); await d.waitForTimeout(300);
  ok((await d.textContent('.back')).includes('Recherche « aulnes »'), 'une puce ramène à la recherche');
  await d.waitForFunction(() => !!document.querySelector('#main [data-id="f0"].flash'), null, { timeout: 5000 }).catch(() => {});
  ok(await d.$eval('[data-id="f0"]', el => el.classList.contains('flash') && el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= innerHeight), 'ouverte depuis la recherche, l’entrée lointaine est dépliée, à l’écran, surlignée (NAV-006, étape 2)');
  await d.click('.back'); await d.waitForTimeout(250);
  ok(await hash(d) === '#recherche' && (await d.inputValue('#searchIn')) === 'aulnes' && (await resultats()) === '#ecriture/f0', 'le retour rend la recherche telle qu’elle était, le même résultat (NAV-006, étape 3)');

  console.log('reprise');
  await go(d, 'ecriture'); await d.fill('#scrapIn', 'une phrase à finir'); await d.waitForTimeout(100);
  await go(d, 'accueil');
  const box = (await d.textContent('.resume-box')).replace(/\s+/g, ' ');
  ok(box.includes('Écriture') && box.includes('un fragment en cours'), 'l’accueil propose de reprendre le dernier espace et son brouillon');
  // NAV-011, étapes 2 à 4 : le réglage le dit, se marque « cet appareil », et se défait.
  const ouvrirSur = async v => {
    await go(d, 'reglages'); await d.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await d.selectOption('[data-act="open-on"]', v);
    await d.waitForFunction(() => !!document.querySelector('#toast').textContent.trim(), null, { timeout: 5000 }).catch(() => {});
    return (await d.textContent('#toast')).trim();
  };
  let dit = await ouvrirSur('last');
  const marque = await d.evaluate(() => { const f = document.querySelector('[data-act="open-on"]').closest('.fld'), m = f && f.querySelector('.dev'); return m ? m.textContent.trim() : ''; });
  ok(dit === "L'app rouvrira le dernier espace où tu étais." && marque === 'cet appareil', `« Là où j’en étais » : « ${dit} », le réglage marqué « ${marque} » (NAV-011, étape 2)`);
  await go(d, 'ecriture');
  const d2 = await ctxD.newPage(); d2.on('pageerror', e => errs.push(e.message));
  await d2.goto(BASE + '/index.html#accueil'); await d2.waitForTimeout(400);
  ok(await hash(d2) === '#ecriture', '« Ouvrir sur : là où j’en étais » rouvre le dernier espace');
  await d2.close();
  dit = await ouvrirSur('accueil');
  await go(d, 'ecriture');
  const d3 = await ctxD.newPage(); d3.on('pageerror', e => errs.push(e.message));
  await d3.goto(BASE + '/index.html#accueil'); await d3.waitForTimeout(400);
  ok(dit === "L'app s'ouvrira sur l'accueil." && await hash(d3) === '#accueil' && !!(await d3.$('#main .resume-box')), `« L’accueil » remis : « ${dit} », et l’app rouvre sur l’accueil (${await hash(d3)}) (NAV-011, étape 4)`);
  await d3.close();

  console.log('iPhone : barre basse et feuilles');
  const ctxM = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctxM.addInitScript(dt => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', dt); }, JSON.stringify(demo));
  const m = await ctxM.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto(BASE + '/index.html'); await m.waitForTimeout(400);
  ok(await m.isVisible('#bar') && !(await m.isVisible('#nav')), 'téléphone : barre basse, pas de barre latérale');
  const barre = await m.$$eval('#bar > a, #bar > button', xs => xs.map(x => x.querySelector('span').textContent.trim()));
  ok(barre.join(' | ') === "Aujourd'hui | Espaces | Capturer | Chercher | Bilan", `cinq entrées, dans l’ordre (${barre.join(' | ')})`);
  ok(await m.$eval('#bar a[href="#accueil"]', el => el.classList.contains('on') && el.getAttribute('aria-current') === 'page'), '« Aujourd’hui » marqué actif sur l’accueil');
  await m.tap('[data-act="sheet-espaces"]'); await m.waitForTimeout(300);
  ok(await m.isVisible('#sheet .srow[href="#budget"]'), 'Espaces ouvre une feuille avec les espaces');
  await m.tap('#sheet .srow[href="#budget"]'); await m.waitForTimeout(300);
  ok(await hash(m) === '#budget' && !(await m.isVisible('#sheet')), 'un espace touché : on y est, la feuille se ferme');
  ok(await m.$eval('#bar [data-act="sheet-espaces"]', el => el.classList.contains('on')), 'Espaces marqué actif dans la barre');
  const before = await m.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.inbox.entries.length);
  await m.tap('[data-act="sheet-capture"]'); await m.waitForTimeout(300);
  await m.fill('#capSheetIn', 'une idée au vol'); await m.press('#capSheetIn', 'Enter'); await m.waitForTimeout(300);
  const after = await m.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.inbox.entries.length);
  ok(after === before + 1 && !(await m.isVisible('#sheet')), 'Capturer : gardé dans la boîte, la feuille se ferme');
  ok((await m.textContent('#toast')).includes("Gardé. Tu peux oublier, c'est écrit."), 'et c’est dit : « Gardé. Tu peux oublier, c’est écrit. »');
  await m.tap('[data-act="sheet-capture"]'); await m.waitForTimeout(300);
  await m.fill('#capSheetIn', 'à moitié'); await m.mouse.click(195, 60); await m.waitForTimeout(200);
  ok(!(await m.isVisible('#sheet')), 'toucher le voile ferme la feuille');
  await m.tap('[data-act="sheet-capture"]'); await m.waitForTimeout(300);
  ok((await m.inputValue('#capSheetIn')) === 'à moitié', 'le brouillon d’une capture survit à la fermeture');

  // NAV-001, étapes 2 et 3, sur le jeu d'essai du cas : ses domaines « Maison » et « Création » dans la feuille.
  console.log('iPhone, le jeu d’essai : la feuille des espaces (NAV-001)');
  const essai = donnee('jeu-essai.json');
  const ctxE = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctxE.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const e = await ctxE.newPage(); e.on('pageerror', x => errs.push(x.message));
  await e.goto(BASE + '/index.html#budget'); await e.waitForSelector('#bAmt');
  await e.evaluate(() => { location.hash = 'accueil'; }); await e.waitForSelector('#capIn', { state: 'attached' }); // caché sur téléphone : ⊕ capture
  await e.tap('[data-act="sheet-espaces"]'); await e.waitForSelector('#sheet .srow[href="#reglages"]');
  // La feuille, dans l'ordre : chaque intitulé et ce qu'il contient (les espaces, ou les boutons des récents).
  const feuille = await e.evaluate(() => {
    const out = []; let cur = null;
    for (const x of document.querySelectorAll('#sheet .grp, #sheet .srow, #sheet .recents a')) {
      if (x.classList.contains('grp')) out.push(cur = { titre: x.textContent.trim(), lignes: [] });
      else if (cur) cur.lignes.push((x.querySelector('b') || x).textContent.trim());
    }
    return out;
  });
  const groupe = t => (feuille.find(g => g.titre === t) || { lignes: [] }).lignes.join(', '), titres = feuille.map(g => g.titre);
  // La barre dit où l'on est : depuis l'accueil, la feuille ouverte, « Aujourd'hui » reste marqué (C28).
  const actif2 = await e.evaluate(() => document.querySelector('#bar a[href="#accueil"]').classList.contains('on') && !document.querySelector('#bar [data-act="sheet-espaces"]').classList.contains('on'));
  ok(titres[0] === 'Récents' && groupe('Récents').includes('Budget') && groupe('Maison') === 'Chantier, Budget, Plantes, Décisions' && groupe('Création') === 'Écriture, Sources, Motifs, Tableau, Arc'
    && titres.at(-1) === 'Système' && feuille.at(-1).lignes.at(-1) === 'Réglages' && actif2,
    `la feuille : ${titres.join(' · ')} ; Maison : ${groupe('Maison')} ; Création : ${groupe('Création')} ; Réglages en pied ; « Aujourd’hui » toujours marqué (NAV-001, étape 2, C28)`);
  await e.tap('#sheet .srow[href="#ecriture"]'); await e.waitForFunction(() => location.hash === '#ecriture');
  await e.waitForTimeout(300);
  const actif3 = await e.evaluate(() => document.querySelector('#bar [data-act="sheet-espaces"]').classList.contains('on') && !document.querySelector('#bar a[href="#accueil"]').classList.contains('on'));
  ok(!(await e.isVisible('#sheet')) && (await e.textContent('#main')).includes('Écriture') && actif3, '« Écriture » touchée dans la feuille : l’espace s’affiche, la feuille est fermée, « Espaces » marqué actif (étape 3)');
  await ctxE.close();

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
