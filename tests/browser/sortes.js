/* Scénario de navigateur : sortes (tirage pondéré par l'oubli). Lancé par tests/browser/run.js.
   SELENE_SHOTS=dossier y dépose une capture d'écran (téléphone). */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const SHOTS = process.env.SELENE_SHOTS;
const demo = JSON.parse(fixture());
const old = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
const recent = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
demo.modules.ecriture.scraps = [{ id: 'f1', text: 'Un fragment qui dort depuis longtemps, oublié dans un coin', date: old }];
demo.modules.inbox.entries = [{ id: 'n1', text: 'Une note ancienne, jamais rangée', date: old }, { id: 'n2', text: 'Une note toute fraîche', date: recent }];
(async () => {
  const b = await chromium.launch(launchOptions);
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(300);
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');

  console.log('accueil, avant tirage');
  let t = await main();
  check(t.includes('Tirer un sort'), 'la section est là, même sans tirage encore fait');
  check(!t.includes('Retirer'), 'rien de tiré : le bouton dit « Tirer »');

  console.log('tirer');
  await p.click('[data-act="sortes-draw"]'); await p.waitForTimeout(200);
  t = await main();
  check(t.includes('Retirer'), 'un tirage a eu lieu : le bouton propose d’en retirer un autre');
  check(/endormi|Tension ouverte|jachère/.test(t), 'le résultat est un des trois genres attendus');
  check(!t.includes('Une note toute fraîche') && !t.includes('fresh'), 'ce qui date de deux jours n’est pas assez oublié pour sortir');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/sortes.png`, fullPage: true });

  console.log('retirer');
  await p.click('[data-act="sortes-draw"]'); await p.waitForTimeout(200);
  t = await main();
  check(t.includes('Retirer'), 'toujours un tirage après « Retirer »');

  console.log('un compte neuf n’a rien à tirer');
  const p2 = await b.newPage(); // page à part : un compte neuf, sans le jeu d'essai de celle-ci
  await p2.addInitScript(() => { window.claude = { use: async () => null }; });
  await p2.goto(BASE + '/index.html'); await p2.waitForTimeout(300);
  await p2.click('[data-act="sortes-draw"]'); await p2.waitForTimeout(200);
  check((await p2.textContent('#toast')).includes("Rien d'assez ancien"), 'un compte tout neuf n’a rien à tirer, et le dit');
  await p2.close();

  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, 'aucun débordement horizontal sur téléphone');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
