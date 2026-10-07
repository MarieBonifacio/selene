/* Scénario de navigateur : liaisons entre fragments (dériver, contredire, résoudre une tension). Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { engine, ouvrir, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
const demo = JSON.parse(fixture());
demo.modules.ecriture.scraps = [
  { id: 'a', text: 'Le DMN fabrique le sentiment de soi', date: '2026-09-01' },
  { id: 'b', text: 'Le soi est d’abord symbolique', date: '2026-09-02' }];
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  // Par identifiant : un texte se retrouve aussi dans les liens des autres fragments (« dérive de « … » »).
  const frag = id => `li[data-id="${id}"]`;

  console.log('dériver');
  await go('ecriture');
  await p.click(`${frag('a')} [data-act="derive-start"]`); await p.waitForTimeout(150);
  check((await main()).includes('Dérivé de « Le DMN fabrique le sentiment de soi »'), 'bandeau : la source de la dérivation');
  check(await p.evaluate(() => document.activeElement.id === 'scrapIn'), 'curseur dans le champ du fragment');
  await p.fill('#scrapIn', 'Le soi comme effet de réseau'); await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(200);
  let s = (await data()).modules.ecriture.scraps, c = s.find(x => x.text === 'Le soi comme effet de réseau');
  check(c && c.links.length === 1 && c.links[0].type === 'derive' && c.links[0].to === 'ecriture/a', 'le nouveau fragment dérive de sa source');
  check((await p.textContent('#toast')) === 'Dérivé, et relié à sa source.' && !(await p.$('#main .derive')), '« Dérivé, et relié à sa source. » ; le bandeau disparaît');
  check((await p.textContent(frag(c.id))).includes('dérive de « Le DMN fabrique le sentiment de soi »'), 'le nouveau fragment dit de quoi il dérive');
  check((await p.textContent(frag('a'))).includes('a donné « Le soi comme effet de réseau »'), 'la source montre ce qu’elle a donné');

  console.log('contredire');
  await p.click(`${frag('b')} [data-act="link-form"]`); await p.waitForTimeout(150);
  await p.selectOption('#form [name=type]', 'contredit');
  await p.selectOption('#form [name=to]', 'ecriture/a');
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  check((await p.textContent('#toast')) === 'Tension ouverte. Elle attendra sa synthèse.', 'lier par « contredit » ouvre une tension : « Tension ouverte. Elle attendra sa synthèse. »');
  check((await p.textContent(frag('a'))).includes('contredit par « Le soi est d’abord symbolique »'), 'lien entrant affiché sur la cible');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/liaisons.png`, fullPage: true });

  console.log('résoudre');
  await go('bilan');
  check((await main()).includes('Tensions ouvertes') && (await main()).includes('« Le soi est d’abord symbolique » contredit « Le DMN fabrique'), 'le bilan liste la tension');
  check((await main()).includes("ouverte aujourd'hui") && await p.isVisible('[data-act="tension-resolve"]') && await p.isVisible('[data-act="tension-dossier"]'), 'depuis quand elle est ouverte, avec « résoudre » et « dossier »');
  await p.click('[data-act="tension-resolve"]'); await p.waitForTimeout(250);
  check((await p.evaluate(() => location.hash)) === '#ecriture' && (await main()).includes('Synthèse de « Le soi est d’abord symbolique » et « Le DMN fabrique'), '« résoudre » ouvre une synthèse des deux');
  await p.fill('#scrapIn', 'Le soi : un symbole que le réseau se donne'); await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(200);
  s = (await data()).modules.ecriture.scraps; c = s.at(-1);
  check(c.links.map(l => l.to).sort().join() === 'ecriture/a,ecriture/b', 'la synthèse dérive des deux');
  check((await p.textContent('#toast')) === 'Synthèse gardée. La tension est levée.', '« Synthèse gardée. La tension est levée. »');
  await go('bilan');
  check(!(await main()).includes('Tensions ouvertes'), 'et la tension est levée');
  console.log('dossiers');
  const read = async dl => require('node:fs').readFileSync(await dl.path(), 'utf8');
  await go('ecriture');
  let [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="scrap-dossier"]')]);
  let md = await read(dl);
  check(/^dossier-ecriture-\d{4}-\d\d-\d\d\.md$/.test(dl.suggestedFilename()), 'dossier des fragments téléchargé (' + dl.suggestedFilename() + ')');
  check(md.includes('entrees: 4') && md.includes('Ne pas traiter une hypothèse comme un fait') && /\*Liens : dérive de \[2\] ; dérive de \[1\]\*/.test(md) && md.includes('perimetre: "Écriture : fragments"'), 'entrées numérotées, légende, liens en renvois internes');
  await go('recherche'); await p.fill('#searchIn', 'soi'); await p.waitForTimeout(200);
  [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="search-dossier"]')]);
  md = await read(dl);
  check(md.includes('perimetre: "Résultats de la recherche « soi »"') && md.includes('entrees: 4'), 'dossier d’une recherche : tous les résultats');
  await go('ecriture');
  await p.click(`${frag('b')} [data-act="link-form"]`); await p.waitForTimeout(150);
  await p.selectOption('#form [name=type]', 'contredit'); await p.selectOption('#form [name=to]', `ecriture/${s.find(x => x.text === 'Le soi comme effet de réseau').id}`);
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  await go('bilan');
  [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="tension-dossier"]')]);
  md = await read(dl);
  check(md.includes('contredit') && md.includes('Le soi est d’abord symbolique') && md.includes('Le soi comme effet de réseau'), 'dossier d’une tension : les deux entrées et leur voisinage');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');

  console.log('le jeu d’essai : ses liens et sa tension (PEN-003, PEN-004)');
  const essai = donnee('jeu-essai.json');
  const q = await b.newPage({ viewport: { width: 1280, height: 900 } }); q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(([s, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', s); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  await ouvrir(q, BASE + '/index.html#ecriture', () => !!document.querySelector('li[data-id="f1"]'));
  const f1 = (await q.textContent('li[data-id="f1"]')).replace(/\s+/g, ' ');
  check(f1.includes("a donné « Toute lisière est un seuil que l'on traverse sans le voir. »") && f1.includes('contredit par « La lisière est au contraire une frontière nette, tracée par … »'),
    '« La lisière n’est pas une frontière… » montre ce qui en dérive et qui la contredit (PEN-003, étape 4)');
  await q.evaluate(() => { location.hash = 'bilan'; }); await q.waitForSelector('[data-act="tension-resolve"]');
  // La tension du jeu date du 15 août 2026 : son âge, en jours, se compte d'ici (heure de midi, comme l'app).
  const age = await q.evaluate(() => { const d = new Date(), j = new Date(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00`); return Math.round((j - new Date('2026-08-15T12:00')) / 86400000); });
  const bilan = (await q.textContent('#main')).replace(/\s+/g, ' ');
  check(bilan.includes("« La lisière est au contraire une frontière nette, tracée par … » contredit « La lisière n'est pas une frontière, c'est un lieu où l'on hé… »") && bilan.includes(`ouverte il y a ${age} j`),
    `le Bilan : la tension du jeu, « ouverte il y a ${age} j » (PEN-004, étape 1)`);
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
