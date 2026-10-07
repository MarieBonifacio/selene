/* Scénario de navigateur : identité (évolution de l'interface, vague 3a : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.config.modules.find(m => m.id === 'moth').group = 'Création';
demo.config.modules.find(m => m.id === 'ecriture').group = 'Création';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async opts => {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(400); return p;
  };
  const go = async (p, h) => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };

  console.log('sigils et planches');
  const d = await open({ viewport: { width: 1280, height: 800 } });
  ok(await d.$$eval('#nav a svg.sig', s => s.length) >= 7, 'chaque espace a son sigil dans la navigation');
  ok(await d.$eval('#nav a[href="#moth"]', a => a.classList.contains('t1')) && await d.$eval('#nav a[href="#chantier"]', a => a.classList.contains('t0')), 'un domaine nommé a sa teinte, un espace sans domaine prend l’accent');
  await go(d, 'moth');
  const plate = (await d.textContent('#main .plate')).replace(/\s+/g, ' ');
  const n = await d.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.modules.filter(m => m.on && m.id !== 'assistant').findIndex(m => m.id === 'moth') + 1);
  ok(plate.includes('Pl. ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n - 1]), `planche numérotée en chiffres romains (${plate.trim().slice(0, 12)})`);

  console.log('régler sur place');
  await d.click('#main .plate [data-act="goto-groups"]'); await d.waitForTimeout(300);
  ok(await d.isVisible('#sheet.drawer') && (await d.evaluate(() => location.hash)) === '#moth', '« régler » ouvre les réglages du module dans un tiroir, sans quitter l’espace');
  await d.click('#sheet [data-act="sigil-set"][data-s="croissant"]'); await d.waitForTimeout(200);
  ok((await d.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.modules.find(m => m.id === 'moth').sigil)) === 'croissant', 'un sigil choisi est gardé');
  ok(await d.$eval('#sheet [data-s="croissant"]', el => el.getAttribute('aria-checked')) === 'true', 'le tiroir se redessine (sigil coché)');
  { // ESP-005, étape 4 : le sigil choisi, dans la navigation et en tête de l'espace (le même dessin).
    const [nav, tete] = await d.evaluate(() => [document.querySelector('#nav a[href="#moth"] svg.sig').innerHTML, document.querySelector('#main .plate svg.sig').innerHTML]);
    const croissant = await d.$eval('#sheet [data-act="sigil-set"][data-s="croissant"] svg', s => s.innerHTML).catch(() => '');
    ok(nav === tete && (!croissant || nav === croissant), 'le sigil changé dans la navigation et en tête de l’espace (ESP-005, étape 4)');
  }
  await d.fill('#sheet [data-set-mod="moth.addLabel"]', 'Nouveau post'); await d.press('#sheet [data-set-mod="moth.addLabel"]', 'Tab'); await d.waitForTimeout(200);
  ok((await d.textContent('#main')).includes('Nouveau post'), 'un réglage changé dans le tiroir s’applique aussitôt à la vue');
  await d.keyboard.press('Escape'); await d.waitForTimeout(150);

  console.log('renommer, ordonner (ESP-005)');
  await go(d, 'reglages'); await d.waitForSelector('[data-act="mod-label"]');
  const ligne = nom => `#main .set.mod:has(input[data-act="mod-label"][value="${nom}"])`;
  await d.fill(`${ligne('Chantier')} [data-act="mod-label"]`, 'Appartement'); await d.press(`${ligne('Chantier')} [data-act="mod-label"]`, 'Tab');
  await d.waitForFunction(() => document.querySelector('#nav a[href="#chantier"]')?.textContent.includes('Appartement'), null, { timeout: 5000 }).catch(() => {});
  const navT = (await d.textContent('#nav a[href="#chantier"]')).trim();
  await go(d, ''); const accueilT = (await d.textContent('#main')).includes('Appartement');
  await go(d, 'chantier'); const titreT = (await d.textContent('#main h2')).trim();
  ok(navT.includes('Appartement') && accueilT && titreT === 'Appartement', `renommé : la navigation, l’accueil et l’en-tête disent « Appartement » (${titreT}) (étape 1)`);
  // La navigation range les espaces par domaine : Musique y passe devant ceux qu'elle a doublés dans son propre domaine.
  const ordre = () => d.$$eval('#nav a[href^="#"]', as => as.map(a => a.getAttribute('href').slice(1)));
  const config = () => d.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).config.modules.map(m => [m.id, m.group || '']));
  const cfg0 = await config(); await go(d, 'musique'); const plAvant = (await d.textContent('#main .plate .pl')).trim();
  await go(d, 'reglages'); await d.waitForSelector(`${ligne('Musique')} [data-act="mod-up"]`);
  for (let k = 0; k < 2; k++) { await d.click(`${ligne('Musique')} [data-act="mod-up"]`); await d.waitForFunction(n => JSON.parse(localStorage.getItem('selene-site-v1')).config.modules.findIndex(m => m.id === 'musique') === n, cfg0.findIndex(([id]) => id === 'musique') - k - 1, { timeout: 5000 }).catch(() => {}); }
  const cfg1 = await config(), j0 = cfg0.findIndex(([id]) => id === 'musique'), j1 = cfg1.findIndex(([id]) => id === 'musique');
  const groupe = cfg0[j0][1], doubles = cfg0.slice(j1, j0).filter(([, g]) => g === groupe).map(([id]) => id), nav = await ordre();
  await go(d, 'musique'); const plApres = (await d.textContent('#main .plate .pl')).trim();
  ok(j1 === j0 - 2 && doubles.every(id => nav.indexOf('musique') < nav.indexOf(id)) && plApres !== plAvant,
    `Musique monte de deux crans : dans la navigation, devant ${doubles.join(', ') || '(aucun du même domaine)'} ; son numéro de planche change (${plAvant} → ${plApres}) (étape 3)`);
  await go(d, 'reglages'); await d.waitForSelector(`${ligne('Appartement')} [data-act="mod-label"]`);
  await d.fill(`${ligne('Appartement')} [data-act="mod-label"]`, ''); await d.press(`${ligne('Appartement')} [data-act="mod-label"]`, 'Tab'); await d.waitForTimeout(200);
  const garde = await d.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.label);
  ok(garde === 'Appartement' && (await d.textContent('#nav a[href="#chantier"]')).includes('Appartement') && !!(await d.$(ligne('Appartement'))), 'le nom vidé, le champ quitté : l’ancien nom est gardé (étape 5)');

  console.log('typographie');
  const fonts = await d.evaluate(() => [getComputedStyle(document.querySelector('#main h2')).fontFamily, getComputedStyle(document.querySelector('#main .btn')).fontFamily, getComputedStyle(document.body).fontFamily]);
  ok(/Cormorant/.test(fonts[0]) && /Plex/.test(fonts[1]) && /Spectral/.test(fonts[2]), 'trois voix : titres en Cormorant, boutons en Plex, texte en Spectral');

  console.log('iPhone : formulaire en feuille');
  const m = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await go(m, 'moth');
  ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'le kanban défile dans son cadre : la page ne s’élargit pas (sinon iOS dézoome tout)');
  // La feuille monte en 260 ms (--t-3), plus sous une CI chargée : on la mesure une fois son animation finie, pas après
  // un délai fixe (WebKit en CI la trouvait parfois encore en chemin).
  await m.tap('[data-act="col-new"]'); await m.waitForSelector('#dlg[open]');
  await m.$eval('#dlg', el => Promise.all(el.getAnimations().map(a => a.finished)));
  const box = await m.$eval('#dlg', el => { const r = el.getBoundingClientRect(); return { bottom: r.bottom, width: r.width }; });
  ok(Math.abs(box.bottom - 844) < 2 && box.width >= 389, 'sur téléphone, un formulaire monte du bas, pleine largeur');

  // ESP-008, sur téléphone et le jeu d'essai du cahier : « régler » en tête de Tableau, un tiroir du bas, pleine largeur ;
  // le champ « Sous-titre » nommé `Lieu` ; le tiroir fermé par son voile, toujours dans Tableau, et le formulaire
  // d'ajout qui propose « Lieu ».
  console.log('régler sur téléphone, le jeu d’essai (ESP-008)');
  const essai = donnee('jeu-essai.json');
  const ct = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ct.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const t = await ct.newPage(); t.on('pageerror', e => errs.push(e.message));
  await t.goto(BASE + '/index.html#tableau'); await t.waitForSelector('#main .board .col');
  const sansLieu = !(await (async () => { await t.tap('[data-act="col-new"]'); await t.waitForSelector('#dlg[open]'); const x = await t.$('#form [name="subtitle"]'); await t.keyboard.press('Escape'); await t.waitForFunction(() => !document.querySelector('#dlg').open); return x; })());
  await t.tap('#main .plate [data-act="goto-groups"]'); await t.waitForSelector('#sheet[open] [data-set-mod="tableau.fields.subtitle"]', { state: 'attached', timeout: 5000 }).catch(() => {});
  await t.$eval('#sheet', el => Promise.all(el.getAnimations().map(a => a.finished)));
  const tiroir = await t.evaluate(() => { const s = document.querySelector('#sheet'), r = s.getBoundingClientRect(); return { bas: r.bottom, large: r.width, haut: r.top, titre: ((s.querySelector('#sheetTitle') || {}).textContent || '').trim(), hash: location.hash, dessous: !!document.querySelector('#main .board .col') }; });
  ok(Math.abs(tiroir.bas - 844) < 2 && tiroir.large >= 389 && tiroir.titre === 'Tableau' && tiroir.hash === '#tableau' && tiroir.dessous,
    `« régler » sur téléphone : un tiroir du bas (${Math.round(tiroir.haut)} → ${Math.round(tiroir.bas)} px), pleine largeur (${Math.round(tiroir.large)} px), les réglages de « ${tiroir.titre} », l’espace dessous (étape 1)`);
  await t.fill('#sheet [data-set-mod="tableau.fields.subtitle"]', 'Lieu'); await t.press('#sheet [data-set-mod="tableau.fields.subtitle"]', 'Tab');
  await t.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.tableau.config.fields.subtitle === 'Lieu', null, { timeout: 5000 }).catch(() => {});
  await t.touchscreen.tap(195, Math.max(4, tiroir.haut / 2)); // le voile, au-dessus du tiroir
  await t.waitForFunction(() => !document.querySelector('#sheet').open, null, { timeout: 5000 }).catch(() => {});
  const ferme = await t.evaluate(() => ({ ouvert: document.querySelector('#sheet').open, hash: location.hash, tableau: !!document.querySelector('#main .board .col'), titre: document.querySelector('#main h2').textContent.trim() }));
  ok(!ferme.ouvert && ferme.hash === '#tableau' && ferme.tableau && ferme.titre === 'Tableau', `le tiroir fermé par son voile : toujours dans « ${ferme.titre} » (${ferme.hash}) (étape 3)`);
  await t.tap('[data-act="col-new"]'); await t.waitForSelector('#dlg[open]');
  const lieu = await t.evaluate(() => { const i = document.querySelector('#form [name="subtitle"]'); return i ? (i.closest('label') || {}).textContent.trim() : ''; });
  ok(sansLieu && lieu.startsWith('Lieu') && (await t.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.tableau.config.fields.subtitle)) === 'Lieu',
    `« Lieu » donné au champ « Sous-titre », le champ quitté : le formulaire d’ajout, qui ne l’avait pas, propose « ${lieu} » (étape 2)`);
  await t.keyboard.press('Escape');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
