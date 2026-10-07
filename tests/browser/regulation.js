/* Scénario de navigateur : « Reprendre la main » (docs/regulation.md). Lancé par tests/browser/run.js.
   Hors de l'offre publique : sans compte, l'espace n'est pas proposé ; le compte personnel (marque selene_personnel,
   sur un faux Supabase) le crée, gardé sur l'appareil (selene-local-v1), le serveur n'en ayant que le nom.
   Vrais formulaires sur téléphone : création privée, configuration (information alcool avant l'objectif), saisies
   décimales, total quotidien sans double compte, journée confirmée puis rouverte, modification arrivée pendant la boîte
   de confirmation (un autre onglet) refusée, envie et pause persistée au rechargement, « je l'ai fait », marques
   dédupliquées, partage avec l'assistant confirmé sur le résumé, aucune fuite vers l'accueil, la recherche, le bilan
   ou la planche. Puis l'ordinateur et l'anglais : pas de débordement, clavier, textes traduits. */
const { engine, BASE, launchOptions, check, storeJSON, storeSet } = require('./helpers');
/* Un faux Supabase réduit à la synchronisation (comme regulation-appareil.js) ; on y lit ce qui arrive au serveur. */
const rows = new Map();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function supabase(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
  if (u.pathname !== '/rest/v1/app_state') return json(route, 404, {}); // fonctions (assistant, passeur) : absentes ici
  const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
  if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
  if (m === 'POST') { for (const r of req.postDataJSON()) if (!rows.has(r.user_id)) rows.set(r.user_id, { board: {}, site: {}, ...r }); return route.fulfill({ status: 201, body: '' }); }
  if (m === 'PATCH') { if (!row) return json(route, 200, []); Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]); }
}
const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c', personnel: true } });
(async () => {
  const b = await engine.launch(launchOptions);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris', hasTouch: true, serviceWorkers: 'block' }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
    console.log('hors de l’offre publique : sans compte (l’artefact claude.ai), l’espace n’est pas proposé');
    const anon = await b.newContext({ viewport: { width: 390, height: 844 } }), a = await anon.newPage();
    await a.addInitScript(() => { window.claude = { use: async () => null }; });
    // Les modèles de l'accueil sont repliés derrière « Choisir moi-même » (U3) : on déplie la liste.
    const deplier = q => q.waitForSelector('#welcome-all', { state: 'attached' }).then(() => q.evaluate(() => { document.getElementById('welcome-all').open = true; }));
    await a.goto(BASE + '/index.html'); await deplier(a); await a.waitForSelector('[data-tpl="carnet"]');
    check(!(await a.$('[data-tpl="regulation"]')), 'accueil : d’autres modèles, pas celui-ci');
    await anon.close();

    await ctx.route('https://*.supabase.co/**', supabase);
    await p.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
    await p.goto(BASE + '/index.html');
    await deplier(p); await p.waitForSelector('[data-tpl="regulation"]');
    const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
    const site = () => storeJSON(p, 'selene-site-v1');
    // Le contenu du suivi vit dans le document local de l'appareil ; le site (synchronisé) n'en a que le talon.
    const localDoc = () => storeJSON(p, 'selene-local-v1');
    const id = 'reprendre-la-main', inst = async () => (await localDoc()).modules[id];
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
    // RLM-004, étapes 2 et 3 : un bloc replié sous les actions ; déplié, les trois paragraphes de l'étape 1 ; le lien, à part.
    const bloc = '#main details.rlm-info';
    check(!(await p.$eval(bloc, d => d.open)) && (await p.textContent(`${bloc} > summary`)).trim() === 'Alcool : sevrage, urgences, aide', 'sous les actions, un bloc replié « Alcool : sevrage, urgences, aide »');
    await p.click(`${bloc} > summary`); await p.waitForFunction(sel => document.querySelector(sel).open, bloc, { timeout: 5000 }).catch(() => {});
    const paras = await p.$$eval(`${bloc} p`, ps => ps.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    check(paras.length === 3 && paras[0].startsWith("En cas de dépendance à l'alcool") && paras[0].includes('convulsions ou un delirium tremens. Prépare ce changement avec un médecin ou un CSAPA')
      && paras[1].includes('appelle le 15 (Samu) ou le 112') && paras[1].includes('le 114') && paras[2] === 'Alcool Info Service : 0 980 980 930, de 8 h à 2 h, 7 jours sur 7, anonyme et non surtaxé. alcool-info-service.fr',
      'déplié : le sevrage, les urgences et Alcool Info Service, comme avant l’objectif (RLM-004, étape 3)');
    await ctx.route('https://www.alcool-info-service.fr/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Alcool Info Service</title>' }));
    const ici = await p.evaluate(() => location.hash);
    const [onglet] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }).catch(() => null), p.click(`${bloc} a`)]);
    if (onglet) await onglet.waitForLoadState().catch(() => {});
    const parti = onglet ? onglet.url() : `aucun onglet ; la page est sur ${p.url()}`;
    check(!!onglet && onglet.url() === 'https://www.alcool-info-service.fr/' && (await p.evaluate(() => location.hash).catch(() => '')) === ici, `« alcool-info-service.fr » s’ouvre dans un nouvel onglet, Selene reste où elle était (${parti})`);
    check(await p.$eval(`${bloc} a`, a => a.target === '_blank' && /noopener/.test(a.rel)), 'sans donner la main à l’onglet ouvert (noopener)');
    if (onglet) await onglet.close();
    check((await main()).includes('pas encore confirmée'), 'aujourd’hui : inconnue, pas zéro');
    for (const name of ['J\'ai une envie', 'Noter une consommation / durée', 'J\'ai réalisé une action', 'Faire mon point du jour'])
      check(await p.getByRole('button', { name, exact: true }).count() === 1, `action principale : ${name}`);
    // U9 : le premier jour, rien de confirmé, une phrase au lieu d'un tableau de tirets ; le geste reste l'action principale.
    check((await main()).includes('Rien à comparer pour l\'instant') && !(await p.$('.rlm-cmp')), 'sept derniers jours, le premier jour : une phrase, pas de tableau vide');

    console.log('saisies, total quotidien, confirmation, réouverture');
    await p.click('[data-act="rlm-use"]'); await p.waitForFunction(() => document.querySelector('#dlg').open);
    const conso = (await p.textContent('#form')).replace(/\s+/g, ' ');
    check(conso.includes('verre standard') && !/CSAPA|sevrage|0 980 980 930/i.test(conso), 'le formulaire de consommation explique le verre standard, sans répéter l’avertissement du sevrage (RLM-004)');
    await fill({ value: '1.5', note: 'CONFIDENTIEL_BROWSER' }); await submit();
    check((await inst()).entries.find(e => e.kind === 'use').value === 1.5, 'décimale gardée dans l’unité du suivi');
    check((await main()).includes('pas encore confirmée'), 'une consommation ne ferme pas la journée');
    await p.click('[data-act="rlm-day"]');
    let msg = await ask(true);
    check(/1,5 verre standard au total/.test(msg) && /toutes les consommations/.test(msg), 'avant de confirmer : la date et le total exacts');
    check((await main()).includes('journée confirmée'), 'journée confirmée par un geste explicite');
    check(await p.$$eval('.rlm-cmp thead th', t => t.length) === 2 && !(await main()).includes('Rien à comparer'), 'une journée confirmée : le tableau, sans colonne pour une semaine d’avant qui n’existe pas');
    await p.click('[data-act="rlm-use"]'); await fill({ value: '1' }); await submit();
    check((await toast()).includes('à reconfirmer'), 'nouvelle consommation après confirmation : demande de reconfirmer');
    check((await main()).includes('à reconfirmer'), 'la journée n’est plus comptée comme complète');
    const yesterday = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); });
    await p.click('[data-act="rlm-use"]'); await fill({ date: yesterday, value: '1' }); await submit();
    await p.click('[data-act="rlm-use"]'); await p.selectOption('#form [name="how"]', 'total'); await fill({ date: yesterday, value: '3' }); await submit();
    // Le total déclaré propose la confirmation ; pendant qu'elle est ouverte, un autre onglet ajoute une quantité.
    await p.waitForSelector('#cdlg[open]');
    check((await p.textContent('#cmsg')).includes('3 verres standard au total'), 'total déclaré : 1 + complément 2, jamais 1 + 3');
    let other = await localDoc(); // l'écriture vers IndexedDB est asynchrone : attendre qu'elle porte le complément
    for (let i = 0; i < 100 && !other.modules[id].entries.some(e => e.declared === 3); i++) { await p.waitForTimeout(50); other = await localDoc(); }
    other.modules[id].entries.push({ id: 'autre-onglet', kind: 'use', date: yesterday, at: Date.now(), zone: '', note: '', value: 0.5 });
    other.updatedAt = Date.now() + 1000;
    // Un autre onglet du même appareil écrit : la page en est prévenue (événement storage ou BroadcastChannel), jamais
    // par sa propre écriture.
    const tab = await ctx.newPage(); await tab.goto(BASE + '/privacy.html');
    await storeSet(tab, 'selene-local-v1', JSON.stringify(other)); await tab.close();
    await p.waitForFunction(() => document.querySelector('#main').textContent.includes('3,5'));
    await ask(true);
    check((await toast()).includes('ont changé pendant la confirmation'), 'modification pendant la boîte : rien n’est validé en silence');
    check(!(await inst()).entries.some(e => e.id === `day-${yesterday}`), 'la veille reste inconnue');
    await p.click(`[data-act="rlm-day-at"][data-date="${yesterday}"]`);
    msg = await ask(true);
    check(msg.includes('3,5 verres standard au total'), 'reconfirmation sur le total réellement à jour');
    check((await inst()).entries.some(e => e.id === `day-${yesterday}`), 'veille confirmée');

    console.log('dates dans les messages : jamais « oct.. », toujours en lettres');
    const dans20 = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 20); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); });
    await p.click('[data-act="rlm-goal"]'); await p.selectOption('#form [name="mode"]', 'arreter'); await fill({ date: dans20 }); await submit();
    const futur = await toast();
    check(/^Objectif enregistré, à partir du \d{1,2}(er)? \p{L}+ \d{4}\. D'ici là, rien ne change\.$/u.test(futur), `objectif à venir : la date en lettres, un seul point (${futur})`);
    await p.locator('li.item:has([data-act="rlm-del"])', { hasText: 'verre standard' }).first().locator('[data-act="rlm-del"]').evaluate(e => e.click()); await settle(); // « suppr. » est caché au repos sur un écran tactile
    await p.waitForFunction(() => ((document.querySelector('#toast') || {}).textContent || '').startsWith('Supprimé'), null, { timeout: 10000 }).catch(() => {}); // la bulle d'avant reste, le temps que la suppression parle (BL-22)
    const supprime = await toast();
    check(/^Supprimé : .* le \d{1,2}(er)? \p{L}+ \d{4}\./u.test(supprime) && !supprime.includes('..'), `suppression : la date en lettres, pas « sept.. » (${supprime})`);
    await p.click('#toast button'); await settle(); // « Annuler » : la saisie revient, la suite du scénario la retrouve
    check((await toast()).includes('Rétabli'), 'annulée : rétablie');

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
    await p.waitForTimeout(1200); // une synchronisation au moins
    const onServer = JSON.stringify((rows.get('u1') || {}).site || {});
    check(onServer.includes('Reprendre la main') && !/CONFIDENTIEL_BROWSER|TRIGGER_SECRET|RECOMPENSE_SECRETE/.test(onServer), 'le serveur a le nom du suivi, aucune saisie');
    check(await p.locator('[data-act="bridge-edit"]').count() === 0, 'pas de pont de reprise dans un espace sensible (son texte serait synchronisé)');
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
    // La case se décoche aussitôt : la confirmation décide. Un clic tombé pendant un rendu se perd (vu une fois sous
    // WebKit, PR #100) : on recoche tant que la boîte ne s'ouvre pas, trois fois au plus ; si l'app ne l'ouvre jamais,
    // ask() échoue comme avant.
    const tick = async () => { for (let i = 0; i < 3; i++) { await box.check({ force: true }).catch(() => {}); if (await p.waitForSelector('#cdlg[open]', { timeout: 5000 }).then(() => true, () => false)) return; } };
    await tick();
    msg = await ask(false);
    check(msg.includes('suivi personnel autodéclaratif (alcool') && !SECRET.test(msg), 'cocher le partage : le résumé exact, sans note ni appui');
    check((await site()).config.assistant.share[id] === false && !(await box.isChecked()), 'annuler : rien n’est partagé');
    await tick(); await ask(true);
    check((await site()).config.assistant.share[id] === true && await box.isChecked(), 'confirmer : le résumé est partagé');
    await box.uncheck(); await settle();
    check((await site()).config.assistant.share[id] === false, 'décocher : partage arrêté tout de suite');

    console.log('autres sujets : unités et bornes');
    await go('accueil');
    // RLM-005 : chaque sujet, ses refus et leur texte exact. Un refus du navigateur laisse le formulaire ouvert ; un refus
    // de l'app le ferme et le dit ; dans les deux cas, le total du jour ne bouge pas.
    const deja = async () => ((await main()).match(/Aujourd'hui, déjà noté : ([^·]+?) ·/) || [])[1] || '';
    const noter = async value => {
      await p.click('[data-act="rlm-use"]'); await p.waitForFunction(() => document.querySelector('#dlg').open); await fill({ value });
      await p.evaluate(() => { document.querySelector('#toast').textContent = ''; });
      await p.click('#form button[value="save"]'); await settle();
      await p.waitForFunction(() => !document.querySelector('#dlg').open || document.querySelector('#form :invalid'), null, { timeout: 5000 }).catch(() => {});
      const ouvert = await p.evaluate(() => document.querySelector('#dlg').open);
      if (ouvert) { await p.click('#form button[value="cancel"]'); await settle(); }
      else await p.waitForFunction(() => document.querySelector('#toast').textContent.trim(), null, { timeout: 3000 }).catch(() => {});
      return { refuseParLeNavigateur: ouvert, dit: (await p.textContent('#toast')).replace(/\s+/g, ' ').trim() };
    };
    for (const [subject, value, unit] of [['cannabis', '0.25', '0,25 g'], ['reseaux', '1000', '1 000 minutes'], ['tabac', '3', '3 cigarettes'], ['alcool', '0.1', '0,1 verre standard']]) {
      await deplier(p); await p.click('[data-tpl="regulation"]');
      const mods = (await site()).modules, mid = Object.keys(mods).filter(k => mods[k].type === 'regulation').pop();
      await go(mid); await p.click('[data-act="rlm-setup"]'); await fill({ name: `Suivi ${subject}` }); await p.selectOption('#form [name="subject"]', subject); await next('Mon intention');
      check((await p.textContent('#nav')).includes(`Suivi ${subject}`), `${subject} : nom choisi, visible dans la navigation`);
      const form = await p.textContent('#form');
      if (subject !== 'alcool') check(!form.includes('CSAPA'), `${subject} : pas d’avertissement alcool`);
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
      if (subject === 'tabac') {
        const entete = (await main()).includes('Le nombre de cigarettes fumées. Les substituts nicotiniques (patch, gomme, pastille, spray) ne se comptent pas ici'), total = await deja();
        const [r201, r0] = [await noter('201'), await noter('0')], msg = 'Indique un nombre entier de cigarettes, 200 au plus.';
        check(entete && total === '3 cigarettes' && [r201, r0].every(r => !r.refuseParLeNavigateur && r.dit === msg) && (await deja()) === '3 cigarettes',
          `tabac : l’en-tête sur les substituts ; « déjà noté : ${total} » ; 201 puis 0 : « ${r201.dit} » ; le total reste ${await deja()} (RLM-005, étapes 1 et 3)`);
      }
      if (subject === 'cannabis') {
        const [r255, r101] = [await noter('0.255'), await noter('101')];
        check(r255.refuseParLeNavigateur && !r101.refuseParLeNavigateur && r101.dit === 'Indique une quantité en grammes, au centième près (0,25 par exemple), 100 au plus.' && (await deja()) === '0,25 g',
          `cannabis : 0,255 refusé par le navigateur ; 101 : « ${r101.dit} » ; le total reste ${await deja()} (RLM-005, étape 4)`);
      }
      if (subject === 'alcool') {
        await noter('0.2'); const somme = await deja();
        const [r15, r101] = [await noter('0.15'), await noter('101')];
        check(somme === '0,3 verre standard' && r15.refuseParLeNavigateur && !r101.refuseParLeNavigateur && r101.dit === 'Indique un nombre de verres standard, au dixième près (1,5 par exemple), 100 au plus.' && (await deja()) === '0,3 verre standard',
          `alcool : 0,1 puis 0,2 : « déjà noté : ${somme} » ; 0,15 refusé par le navigateur ; 101 : « ${r101.dit} » (RLM-005, étapes 5 et 6)`);
      }
      if (subject === 'reseaux') {
        const entete = (await main()).includes('Selene ne mesure pas ton usage des autres applications et ne les bloque pas.');
        const [r500, r1441] = [await noter('500'), await noter('1441')];
        check(entete && r500.dit === 'Une journée compte 1440 minutes : ce total les dépasserait.' && r1441.dit === 'Indique un nombre entier de minutes, 1440 au plus.' && (await deja()) === '1 000 minutes',
          `réseaux sociaux : l’en-tête ; 1 000 puis 500 : « ${r500.dit} » ; 1441 : « ${r1441.dit} » ; le total reste ${await deja()} (RLM-005, étapes 7 et 8)`);
      }
      await go('accueil');
    }
    await go(id);
    check(!(await overflow()), 'téléphone : aucun débordement horizontal');
    // A43 : sous Firefox, ce contrôle a échoué une fois sans dire ce qu'il avait lu. Les quatre actions de l'espace ouvert,
    // attendues posées (5 s au plus), puis mesurées ; leurs hauteurs sont dites.
    const cibles = () => p.$$eval('#main .rlm-acts .btn', bs => bs.map(x => Math.round(x.getBoundingClientRect().height * 100) / 100));
    await p.waitForFunction(() => { const bs = [...document.querySelectorAll('#main .rlm-acts .btn')]; return bs.length === 4 && bs.every(x => x.getBoundingClientRect().height >= 44); }, null, { timeout: 5000 }).catch(() => {});
    const hauteurs = await cibles();
    // A43, revenu le 7 octobre sous Firefox avec 0 px pour les quatre : rien n'était posé. Ce qui les cache, s'il revient :
    // l'adresse, la visibilité de la page, #main, les boîtes ouvertes, et chaque ancêtre caché du premier bouton.
    const pourquoi = await p.evaluate(() => {
      const b = document.querySelector('#main .rlm-acts .btn'), m = document.querySelector('#main').getBoundingClientRect(), caches = [];
      for (let e = b; e && e !== document.documentElement; e = e.parentElement) {
        const s = getComputedStyle(e), cv = s.contentVisibility || 'visible';
        if (s.display === 'none' || s.display === 'contents' || s.visibility !== 'visible' || cv !== 'visible') caches.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} (display ${s.display}, visibility ${s.visibility}, content-visibility ${cv})`);
      }
      return `adresse ${location.hash}, page ${document.visibilityState}, #main ${Math.round(m.width)}×${Math.round(m.height)}, boîtes ouvertes [${[...document.querySelectorAll('dialog[open]')].map(d => d.id || d.className).join(', ')}], ${b ? (b.isConnected ? 'bouton dans la page' : 'bouton détaché') + ', ' + b.getClientRects().length + ' boîte(s)' : 'aucun bouton'}, ancêtres cachés [${caches.join(' ; ')}]`;
    });
    check(hauteurs.length === 4 && hauteurs.every(x => x >= 44), `téléphone : les quatre actions ont une cible de 44 px au moins (${hauteurs.join(', ')} px)` + (hauteurs.length === 4 && hauteurs.every(x => x >= 44) ? '' : ` ; ${pourquoi}`));
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
    check(t.includes("Sent word for word, in French: the assistant's instructions are written in French."), 'anglais : le résumé destiné à l’assistant reste en français, et c’est dit (RLM-028)');
    check(!(await overflow()), 'anglais : aucun débordement');
    check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  } catch (e) { console.log('  ✗', e.stack.split('\n').slice(0, 3).join(' ')); process.exitCode = 1; } finally { await b.close(); }
})();
