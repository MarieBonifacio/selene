/* Scénario de navigateur : liaisons entre fragments (dériver, contredire, résoudre une tension). Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
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
  check((await p.textContent(frag('a'))).includes('a donné « Le soi comme effet de réseau »'), 'la source montre ce qu’elle a donné');

  console.log('contredire');
  await p.click(`${frag('b')} [data-act="link-form"]`); await p.waitForTimeout(150);
  await p.selectOption('#form [name=type]', 'contredit');
  await p.selectOption('#form [name=to]', 'ecriture/a');
  await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  check((await p.textContent('#toast')).includes('Tension ouverte'), 'lier par « contredit » ouvre une tension');
  check((await p.textContent(frag('a'))).includes('contredit par « Le soi est d’abord symbolique »'), 'lien entrant affiché sur la cible');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/liaisons.png`, fullPage: true });

  console.log('résoudre');
  await go('bilan');
  check((await main()).includes('Tensions ouvertes') && (await main()).includes('« Le soi est d’abord symbolique » contredit « Le DMN fabrique'), 'le bilan liste la tension');
  await p.click('[data-act="tension-resolve"]'); await p.waitForTimeout(250);
  check((await p.evaluate(() => location.hash)) === '#ecriture' && (await main()).includes('Synthèse de « Le soi est d’abord symbolique » et « Le DMN fabrique'), '« résoudre » ouvre une synthèse des deux');
  await p.fill('#scrapIn', 'Le soi : un symbole que le réseau se donne'); await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(200);
  s = (await data()).modules.ecriture.scraps; c = s.at(-1);
  check(c.links.map(l => l.to).sort().join() === 'ecriture/a,ecriture/b', 'la synthèse dérive des deux');
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
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
