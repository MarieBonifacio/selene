/* Scénario de navigateur : « Reprendre la main » (docs/regulation.md). Lancé par tests/browser/run.js.
   Vrais formulaires sur téléphone : création privée, configuration (information alcool avant l'objectif), saisies
   décimales, total quotidien sans double compte, journée confirmée puis rouverte, modification arrivée pendant la boîte
   de confirmation (un autre onglet) refusée, envie et pause persistée au rechargement, « je l'ai fait », marques
   dédupliquées, partage avec l'assistant confirmé sur le résumé, aucune fuite vers l'accueil, la recherche, le bilan
   ou la planche. Puis l'ordinateur et l'anglais : pas de débordement, clavier, textes traduits. */
const { engine, BASE, launchOptions, check, storeJSON, storeSet } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris', hasTouch: true }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
    await p.addInitScript(() => { window.claude = { use: async () => null }; });
    await p.goto(BASE + '/index.html');
    await p.waitForSelector('[data-tpl="regulation"]');
    const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
    const site = () => storeJSON(p, 'selene-site-v1');
    const id = 'reprendre-la-main', inst = async () => (await site()).modules[id];
    const settle = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForFunction(x => location.hash === '#' + x, h); await settle(); };
    const submit = async () => { await p.click('#form button[value="save"]'); await p.waitForFunction(() => !document.querySelector('#dlg').open); await settle(); };
    // Le sujet validé ouvre aussitôt le formulaire d'objectif, dans la même boîte : on attend le nouveau titre.
    const next = async title => { await p.click('#form button[value="save"]'); await p.waitForFunction(t => document.querySelector('#dlg').open && document.querySelector('#form h2').textContent === t, title); };
    const fill = async values => { for (const [k, v] of Object.entries(values)) await p.fill(`#form [name="${k}"]`, v); };
    const ask = async ok => { await p.waitForSelector('#cdlg[open]'); const msg = await p.textContent('#cmsg'); await p.click(`#cdlg button[value="${ok ? 'ok' : 'cancel'}"]`); await settle(); return msg; };
    const toast = () => p.textContent('#toast');
    const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

    console.log('création : privée, proposée en dernier, configurée en deux temps');
    const tpls = await p.$$eval('[data-tpl]', bs => bs.map(x => x.dataset.tpl));
    check(tpls[tpls.length - 1] === 'regulation', 'le modèle est proposé en dernier, sans mise en avant');
    await p.click('[data-tpl="regulation"]'); await go(id);
    check((await site()).config.assistant.share[id] === false, 'non partagé avec l’assistant dès la création');
    check((await main()).includes('ni un diagnostic'), 'écran d’accueil du suivi : ce qu’il est et n’est pas');
    await p.click('[data-act="rlm-setup"]');
    check((await p.textContent('#form')).includes('Un suivi, un sujet, une unité'), 'un sujet par suivi, unités expliquées');
    check(await p.inputValue('#form [name="name"]') === 'Reprendre la main', 'nom libre, prérempli');
    await p.selectOption('#form [name="subject"]', 'alcool'); await next('Mon intention');
    const goalForm = await p.textContent('#form');
    check(goalForm.includes('arrêt brutal') && goalForm.includes('CSAPA') && goalForm.includes('15') && goalForm.includes('0 980 980 930'), 'alcool : risque du sevrage, médecin ou CSAPA, urgences, avant de choisir l’objectif');
    check(goalForm.includes('10 g d\'alcool pur') && goalForm.includes('plusieurs verres standard'), 'verre standard expliqué, distinct du verre servi');
    await p.selectOption('#form [name="mode"]', 'reduire'); await fill({ limit: '2' }); await submit();
    check((await main()).includes('Alcool · au plus 2 verres standard par jour'), 'objectif choisi, affiché tel quel');
    check((await main()).includes('pas encore confirmée'), 'aujourd’hui : inconnue, pas zéro');
    for (const name of ['J\'ai une envie', 'Noter une consommation / durée', 'J\'ai réalisé une action', 'Faire mon point du jour'])
      check(await p.getByRole('button', { name, exact: true }).count() === 1, `action principale : ${name}`);

    console.log('saisies, total quotidien, confirmation, réouverture');
    await p.click('[data-act="rlm-use"]'); await fill({ value: '1.5', note: 'CONFIDENTIEL_BROWSER' }); await submit();
    check((await inst()).entries.find(e => e.kind === 'use').value === 1.5, 'décimale gardée dans l’unité du suivi');
    check((await main()).includes('pas encore confirmée'), 'une consommation ne ferme pas la journée');
    await p.click('[data-act="rlm-day"]');
    let msg = await ask(true);
    check(/1,5 verre standard au total/.test(msg) && /toutes les consommations/.test(msg), 'avant de confirmer : la date et le total exacts');
    check((await main()).includes('journée confirmée'), 'journée confirmée par un geste explicite');
    await p.click('[data-act="rlm-use"]'); await fill({ value: '1' }); await submit();
    check((await toast()).includes('à reconfirmer'), 'nouvelle consommation après confirmation : demande de reconfirmer');
    check((await main()).includes('à reconfirmer'), 'la journée n’est plus comptée comme complète');
    const yesterday = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); });
    await p.click('[data-act="rlm-use"]'); await fill({ date: yesterday, value: '1' }); await submit();
    await p.click('[data-act="rlm-use"]'); await p.selectOption('#form [name="how"]', 'total'); await fill({ date: yesterday, value: '3' }); await submit();
    // Le total déclaré propose la confirmation ; pendant qu'elle est ouverte, un autre onglet ajoute une quantité.
    await p.waitForSelector('#cdlg[open]');
    check((await p.textContent('#cmsg')).includes('3 verres standard au total'), 'total déclaré : 1 + complément 2, jamais 1 + 3');
    let other = await site(); // l'écriture vers IndexedDB est asynchrone : attendre qu'elle porte le complément
    for (let i = 0; i < 100 && !other.modules[id].entries.some(e => e.declared === 3); i++) { await p.waitForTimeout(50); other = await site(); }
    other.modules[id].entries.push({ id: 'autre-onglet', kind: 'use', date: yesterday, at: Date.now(), zone: '', note: '', value: 0.5 });
    other.updatedAt = Date.now() + 1000;
    // Un autre onglet du même appareil écrit : la page en est prévenue (événement storage ou BroadcastChannel), jamais
    // par sa propre écriture.
    const tab = await ctx.newPage(); await tab.goto(BASE + '/privacy.html');
    await storeSet(tab, 'selene-site-v1', JSON.stringify(other)); await tab.close();
    await p.waitForFunction(() => document.querySelector('#main').textContent.includes('3,5'));
    await ask(true);
    check((await toast()).includes('ont changé pendant la confirmation'), 'modification pendant la boîte : rien n’est validé en silence');
    check(!(await inst()).entries.some(e => e.id === `day-${yesterday}`), 'la veille reste inconnue');
    await p.click(`[data-act="rlm-day-at"][data-date="${yesterday}"]`);
    msg = await ask(true);
    check(msg.includes('3,5 verres standard au total'), 'reconfirmation sur le total réellement à jour');
    check((await inst()).entries.some(e => e.id === `day-${yesterday}`), 'veille confirmée');

    console.log('envie, pause persistée, « je l’ai fait », marques');
    await p.click('[data-act="rlm-urge"]');
    check((await p.textContent('#form')).includes('ni un écart ni un échec'), 'une envie n’est pas un échec');
    await fill({ intensity: '7', note: 'TRIGGER_SECRET' }); await p.selectOption('#form [name="strategy"]', 'Marcher quelques minutes'); await p.selectOption('#form [name="pause"]', 'oui'); await submit();
    await p.waitForSelector('#rlmPause[role="timer"]');
    const end = (await inst()).entries.find(e => e.kind === 'urge').pauseEnd;
    check(end > Date.now() + 280000 && end <= Date.now() + 300000, 'pause : échéance absolue de cinq minutes');
    check((await inst()).entries.filter(e => e.kind === 'action').length === 0, 'choisir un appui n’est pas l’avoir fait');
    await p.reload(); await go(id); await p.waitForSelector('#rlmPause[role="timer"]');
    const shown = await p.textContent('#rlmPause');
    check((await inst()).entries.find(e => e.kind === 'urge').pauseEnd === end && /^[45]:\d\d$/.test(shown), `rechargement : même échéance, temps restant recalculé (${shown})`);
    await p.click('.rlm-pause [data-act="rlm-done"]'); await settle();
    await p.click('.rlm-pause [data-act="rlm-done"]').catch(() => {}); // second appui (si le bouton est encore là) : sans effet
    check((await inst()).entries.filter(e => e.kind === 'action').length === 1, '« je l’ai fait » : une action, même appuyé deux fois');
    await p.click('[data-act="rlm-pause-stop"]'); await p.waitForFunction(() => !document.querySelector('#rlmPause'));
    check(!(await main()).includes('Cinq minutes de pause'), 'pause arrêtée, sans commentaire');
    check(!(await main()).includes('Les gestes restent'), 'marques masquées par défaut');
    await p.click('.rlm [data-act="rlm-plan"]'); await p.selectOption('#form [name="rewards"]', 'on'); await fill({ reward: 'RECOMPENSE_SECRETE', rewardAt: '1' }); await submit();
    await p.click('[data-act="rlm-action"]'); await fill({ strategy: 'Dessiner' }); await submit();
    const prog = await p.textContent('.rlm-progress');
    check(prog.includes('1 marque') && prog.includes('RECOMPENSE_SECRETE') && prog.includes('atteinte'), 'deux actions le même jour : une marque ; récompense personnelle atteinte');

    console.log('confidentialité : rien hors de l’espace, partage confirmé');
    await p.click('[data-act="bridge-edit"]'); await p.fill('#bridgeIn', 'PONT_SECRET'); await p.click('[data-act="bridge-save"]'); await settle();
    const SECRET = /CONFIDENTIEL_BROWSER|TRIGGER_SECRET|PONT_SECRET|RECOMPENSE_SECRETE|Marcher quelques/;
    await go('accueil');
    check(!SECRET.test(await main()) && (await main()).includes('Reprendre la main'), 'accueil : le nom reste, aucun détail, aucun pont');
    await go('recherche'); await p.fill('#searchIn', 'CONFIDENTIEL_BROWSER'); await settle(); await p.waitForTimeout(150);
    check(!(await p.locator('#main .item').allTextContents()).join(' ').includes('CONFIDENTIEL_BROWSER'), 'recherche : aucun résultat');
    await go('bilan');
    check(!SECRET.test(await main()) && !(await main()).includes('Reprendre la main'), 'bilan général : ni détail, ni ligne');
    await p.click('[data-act="planche-open"]'); await settle();
    check(!SECRET.test(await main()) && !(await main()).includes('Reprendre la main'), 'planche de lunaison : rien');
    await go('reglages');
    await p.locator('.set.mod:has(input[data-act="mod-label"][value="Assistant"]) input[data-act="mod-on"]').check(); await settle();
    const box = p.locator(`input[data-act="as-share"][data-k="${id}"]`);
    check(await box.count() === 1 && !(await box.isChecked()), 'Réglages, assistant : le suivi apparaît, non coché');
    await box.check({ force: true }).catch(() => {}); // la case se décoche aussitôt : la confirmation décide
    msg = await ask(false);
    check(msg.includes('suivi personnel autodéclaratif (alcool') && !SECRET.test(msg), 'cocher le partage : le résumé exact, sans note ni appui');
    check((await site()).config.assistant.share[id] === false && !(await box.isChecked()), 'annuler : rien n’est partagé');
    await box.check({ force: true }).catch(() => {}); await ask(true);
    check((await site()).config.assistant.share[id] === true && await box.isChecked(), 'confirmer : le résumé est partagé');
    await box.uncheck(); await settle();
    check((await site()).config.assistant.share[id] === false, 'décocher : partage arrêté tout de suite');

    console.log('autres sujets : unités et bornes');
    await go('accueil');
    for (const [subject, value, unit] of [['cannabis', '0.25', '0,25 g'], ['reseaux', '45', '45 minutes'], ['tabac', '3', '3 cigarettes']]) {
      await p.click('[data-tpl="regulation"]');
      const mods = (await site()).modules, mid = Object.keys(mods).filter(k => mods[k].type === 'regulation').pop();
      await go(mid); await p.click('[data-act="rlm-setup"]'); await fill({ name: `Suivi ${subject}` }); await p.selectOption('#form [name="subject"]', subject); await next('Mon intention');
      check((await p.textContent('#nav')).includes(`Suivi ${subject}`), `${subject} : nom choisi, visible dans la navigation`);
      const form = await p.textContent('#form');
      check(!form.includes('CSAPA'), `${subject} : pas d’avertissement alcool`);
      await submit(); // observer, aujourd'hui
      await p.click('[data-act="rlm-use"]'); await fill({ value }); await submit();
      check((await main()).includes(unit), `${subject} : ${unit}`);
      if (subject === 'tabac') {
        await p.click('[data-act="rlm-use"]'); await fill({ value: '1.5' });
        await p.click('#form button[value="save"]'); await settle();
        check(await p.evaluate(() => document.querySelector('#dlg').open), 'tabac : 1,5 cigarette refusée par le formulaire (pas de 1)');
        await p.click('#form button[value="cancel"]'); await settle();
      }
      if (subject === 'reseaux') check((await main()).includes('ne les bloque pas'), 'réseaux sociaux : ni mesure ni blocage automatiques');
      if (subject === 'cannabis') check((await main()).includes('pas une dose de THC'), 'cannabis : des grammes, pas une dose de THC');
      await go('accueil');
    }
    await go(id);
    check(!(await overflow()), 'téléphone : aucun débordement horizontal');
    const small = await p.$$eval('.rlm-acts .btn', bs => bs.filter(x => x.getBoundingClientRect().height < 44).length);
    check(small === 0, 'téléphone : les quatre actions ont une cible de 44 px au moins');
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/regulation-phone.png`, fullPage: true });

    console.log('ordinateur, clavier, anglais');
    await p.setViewportSize({ width: 1280, height: 900 }); await settle();
    check(!(await overflow()), 'ordinateur : aucun débordement horizontal');
    await p.focus('[data-act="rlm-urge"]'); await p.keyboard.press('Enter'); await p.waitForSelector('#dlg[open]');
    check(await p.evaluate(() => document.querySelector('#dlg').contains(document.activeElement)), 'clavier : le formulaire s’ouvre et prend le focus');
    const unlabeled = await p.$$eval('#form input, #form select, #form textarea', els => els.filter(el => !el.closest('label')).length);
    check(unlabeled === 0, 'chaque champ a son libellé');
    await p.keyboard.press('Escape'); await settle();
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/regulation-desktop.png`, fullPage: true });
    await go('reglages'); await p.selectOption('select[data-set="config.lang"]', 'en');
    await p.waitForFunction(() => document.documentElement.lang === 'en'); await go(id);
    const t = await main();
    check(t.includes('My last seven days') && t.includes('I have a craving') && t.includes('Privacy and data') && t.includes('standard drink'), 'anglais : écran traduit');
    check(!/Mes sept derniers jours|J'ai une envie|Confidentialité et données/.test(t), 'anglais : aucun texte resté en français');
    check(!(await overflow()), 'anglais : aucun débordement');
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await b.close(); }
})();
