/* Parcours du nouveau suivi : vrais formulaires, persistance, confidentialité, téléphone. */
const { engine, BASE, launchOptions, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions), p = await b.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
  await p.addInitScript(() => { window.claude = { use: async () => null }; });
  await p.goto(BASE + '/index.html');
  await p.waitForSelector('[data-tpl="regulation"]');
  const main = () => p.textContent('#main');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const id = 'reprendre-la-main';
  const inst = async () => (await data()).modules[id];
  const go = async name => { await p.evaluate(n => location.hash = n, name); await p.waitForFunction(n => location.hash === '#' + n, name); await p.waitForTimeout(100); };
  const submit = async () => { await p.click('#form button[value="save"]'); await p.waitForFunction(() => !document.querySelector('#dlg').open); await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); };
  const fill = async values => { for (const [key, value] of Object.entries(values)) await p.fill(`#form [name="${key}"]`, value); };
  await p.click('[data-tpl="regulation"]'); await go(id);
  check((await data()).config.assistant.share[id] === false, 'privé vis-à-vis de l’assistant dès la création');
  await p.click('[data-act="reg-goal"]');
  check((await p.textContent('#form')).includes('arrêt brutal'), 'information alcool présentée avant le choix du premier objectif');
  await p.selectOption('[name="subject"]', 'tabac'); await p.selectOption('[name="mode"]', 'reduire'); await fill({ limit: '5' }); await submit();
  check((await main()).includes('Au plus 5 cigarettes'), 'objectif personnalisé affiché sans seuil imposé');
  check((await main()).includes('inconnue'), 'jour non renseigné : inconnu');

  await p.click('[data-act="reg-use"]'); await fill({ value: '2', note: 'CONFIDENTIEL_BROWSER' }); await submit();
  check((await main()).includes('total provisoire'), 'une consommation ne ferme pas la journée');
  await p.click('[data-act="reg-day"]'); await p.selectOption('[name="complete"]', 'yes'); await submit();
  await p.waitForSelector('#cdlg[open]'); await p.click('#cdlg button[value="ok"]');
  await p.waitForFunction(() => document.querySelector('#main').textContent.includes('journée confirmée'));
  check((await inst()).entries.filter(e => e.kind === 'day').length === 1, 'journée explicitement confirmée');
  await p.click('[data-act="reg-goal"]'); await p.selectOption('[name="mode"]', 'arreter'); await submit();
  check((await main()).includes('objectif atteint'), 'le jour confirmé conserve son ancien objectif');
  await p.click('[data-act="reg-use"]'); await fill({ value: '8' }); await submit();
  check((await main()).includes('à reconfirmer après modification'), 'nouvelle consommation : couverture invalidée');

  await p.click('[data-act="reg-settings"]'); await p.selectOption('[name="rewards"]', 'on');
  await fill({ reward: 'Une promenade choisie', rewardAt: '1' }); await submit();
  for (const strategy of ['Marcher', 'Appeler une amie']) { await p.click('[data-act="reg-action"]'); await fill({ strategy }); await submit(); }
  check((await p.textContent('[aria-label="Planche de progression"]')).includes('1 marque'), 'deux actions le même jour : une seule marque');
  check((await p.textContent('[aria-label="Planche de progression"]')).includes('Une promenade choisie'), 'récompense personnelle visible');
  await p.click('[data-act="reg-use"]'); await fill({ value: '1' }); await submit();
  check((await p.textContent('[aria-label="Planche de progression"]')).includes('1 marque'), 'un écart n’efface pas une action');

  await p.click('[data-act="reg-urge"]'); await fill({ intensity: '8', note: 'TRIGGER_SECRET' }); await submit();
  await p.click('[data-act="reg-pause"]'); await p.waitForSelector('#regPauseClock');
  const end = (await inst()).entries.find(e => e.kind === 'urge').pauseEnd;
  await p.reload(); await p.waitForSelector('#regPauseClock');
  check((await inst()).entries.find(e => e.kind === 'urge').pauseEnd === end, 'rechargement : échéance de pause conservée, sans nouvelle récompense');
  await p.click('[data-act="reg-pause-stop"]');
  await p.waitForFunction(() => !document.querySelector('#regPauseClock'));

  await p.click('[data-act="bridge-edit"]'); await p.fill('#bridgeIn', 'PONT_SECRET_BROWSER'); await p.click('[data-act="bridge-save"]');
  await go('accueil');
  check(!/CONFIDENTIEL_BROWSER|TRIGGER_SECRET|PONT_SECRET_BROWSER/.test(await main()), 'accueil : ni note, ni déclencheur, ni pont privé');
  await go('recherche'); await p.fill('#searchIn', 'CONFIDENTIEL_BROWSER'); await p.waitForTimeout(200);
  check(!/CONFIDENTIEL_BROWSER/.test(await p.locator('#main .item').allTextContents().then(x => x.join(' '))), 'note absente des résultats transversaux');
  await go('bilan');
  check(!/CONFIDENTIEL_BROWSER|TRIGGER_SECRET/.test(await main()), 'bilan général sans détails sensibles');
  await p.click('[data-act="planche-open"]'); await p.waitForTimeout(150);
  check(!(await main()).includes('Reprendre la main'), 'planche de lunaison sans ligne de suivi ni compte des événements sensibles');

  await go('accueil');
  for (const [subject, limit, value] of [['cannabis', '0.5', '0.25'], ['alcool', '2', '1.5'], ['reseaux', '30', '15']]) {
    await p.click('[data-tpl="regulation"]');
    const modules = (await data()).modules, mid = Object.keys(modules).filter(k => modules[k].type === 'regulation').pop();
    await go(mid); await p.click('[data-act="reg-goal"]'); await p.selectOption('[name="subject"]', subject); await p.selectOption('[name="mode"]', 'reduire'); await fill({ limit }); await submit();
    await p.click('[data-act="reg-use"]'); await fill({ value }); await submit();
    check((await data()).modules[mid].entries[0]?.value === Number(value), `${subject} : quantité et décimales conservées dans la bonne unité`);
    if (subject === 'alcool') check((await main()).includes('10 g') && (await main()).includes('CSAPA'), 'alcool : unité standard et information sevrage');
    await go('accueil');
  }
  await go(id);
  check(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'aucun débordement sur téléphone');
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/regulation.png`, fullPage: true });
  check(!errs.length, 'aucune erreur JavaScript : ' + errs.join(' | '));
  } catch (e) { console.log(e.stack); throw e; } finally { await b.close(); }
})();
