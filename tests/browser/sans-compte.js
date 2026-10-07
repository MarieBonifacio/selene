/* Scénario de navigateur : l'écran d'entrée et Selene sans compte (U1 de l'audit, services/auth.js). Version hébergée
   simulée, un faux Supabase en mémoire. L'écran d'entrée dit d'abord ce que fait Selene ; « Commencer sans compte » ouvre
   l'app entière, sur l'appareil, sans rien envoyer de ce qu'on y écrit ; se connecter plus tard y verse ce qui a été
   noté : dans un compte neuf, tel quel ; dans un compte qui a déjà ses données, en gardant ses réglages. Lancé par
   tests/browser/run.js. */
const { storeGet, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const NEUF = '5a5a5a5a-1111-2222-3333-444455556666', ANCIEN = '6b6b6b6b-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const errs = [];
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  /* Un appareil, et le faux serveur du compte `uid` : `lignes` tient la ligne app_state de chaque compte. */
  const appareil = async (uid, lignes, init = null) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }), appels = [];
    if (init) await ctx.addInitScript(init);
    await ctx.route('https://*.supabase.co/**', route => {
      const req = route.request(), u = new URL(req.url()), m = req.method();
      appels.push(`${m} ${u.pathname}`);
      if (u.pathname === '/auth/v1/settings') return json(route, 200, { disable_signup: false });
      if (u.pathname === '/auth/v1/signup' || u.pathname === '/auth/v1/token') return json(route, 200, { access_token: 'jeton', refresh_token: 'r', expires_in: 3600, user: { id: uid, email: 'iris@exemple.org' } });
      if (u.pathname === '/rest/v1/app_state') {
        // PostgREST, pour ce que l'app en utilise : lecture d'une colonne (ou de sa date), création, écriture conditionnelle.
        const ligne = lignes.get(uid), sel = u.searchParams.get('select') || '';
        if (m === 'GET') {
          const date = sel.match(/^u:(\w+)->>updatedAt$/);
          if (date) return json(route, 200, ligne ? [{ u: ligne[date[1]] && ligne[date[1]].updatedAt != null ? String(ligne[date[1]].updatedAt) : null }] : []);
          return json(route, 200, ligne ? [{ [sel]: ligne[sel] }] : []);
        }
        if (m === 'POST') { if (!ligne) lignes.set(uid, { board: {}, site: {} }); return route.fulfill({ status: 201, body: '' }); }
        if (m === 'PATCH') {
          if (!ligne) return json(route, 200, []);
          for (const [k, garde] of u.searchParams) if (k.includes('->>')) {
            const [col, champ] = k.split('->>'), cur = ligne[col] && ligne[col][champ];
            if (!(garde === 'is.null' ? cur == null : cur != null && String(cur) === garde.slice(3))) return json(route, 200, []);
          }
          Object.assign(ligne, JSON.parse(req.postData()));
          return json(route, 200, [{ user_id: uid }]);
        }
      }
      if (m === 'GET') return json(route, 200, []);
      return route.fulfill({ status: 201, body: '' });
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.appels = appels;
    return p;
  };
  const outils = p => ({
    main: async () => (await p.textContent('#main')).replace(/\s+/g, ' '),
    settle: () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))),
    until: async (cond, ms = 6000) => { for (const end = Date.now() + ms; !(await cond()) && Date.now() < end;) await p.waitForTimeout(50); return cond(); },
    capturer: async texte => { await p.fill('#capIn', texte); await p.click('[data-act="cap-add"]'); },
    versCompte: async () => { await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('[data-act="auth-open"]'); await p.click('[data-act="auth-open"]'); await p.waitForSelector('#authForm'); }
  });
  const noteSur = (ligne, texte) => !!(ligne && ligne.site && ligne.site.modules && Object.values(ligne.site.modules).some(x => x.type === 'notes' && JSON.stringify(x).includes(texte)));
  try {
    const lignes = new Map();
    let p = await appareil(NEUF, lignes), { main, settle, until, capturer, versCompte } = outils(p);
    console.log('l’écran d’entrée : la promesse d’abord');
    await p.goto(BASE + '/index.html'); await p.waitForSelector('[data-act="auth-local"]');
    const t = await main();
    check(t.includes('Garde tes fragments, tes sources et tes hypothèses reliés'), 'la promesse, en titre');
    check(!(await p.$$eval('#main h2', hs => hs.some(h => h.textContent.trim() === 'Selene'))), '« Selene » n’est plus écrit deux fois');
    check(!(await p.isVisible('#timerBtn')) && !!(await p.$eval('#miniMoon', e => e.innerHTML)), 'la lune du jour, pas de minuteur avant d’être entrée');
    check(await p.isVisible('#authForm') && t.includes('J\'ai déjà un compte'), 'le compte, ensuite, pour qui en a un');
    // CPT-001 : chaque texte de l'écran d'entrée, puis sa mise en page (la promesse à gauche, en haut sur téléphone).
    const entree = q => q.evaluate(() => {
      const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '', all = s => [...document.querySelectorAll(s)].map(txt);
      const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      return { h2: all('#main h2'), ps: all('#main p'), lis: all('#main li'), h3: all('#main h3'), labels: all('#main label'), boutons: all('#main button'), h2r: r('#main h2'), h3r: r('#main h3'),
        large: document.documentElement.scrollWidth <= innerWidth, dehors: [...document.querySelectorAll('#main button')].filter(x => { const b = x.getBoundingClientRect(); return !b.width || b.left < 0 || b.right > innerWidth; }).length };
    });
    const textes = e => e.h2[0] === 'Garde tes fragments, tes sources et tes hypothèses reliés.' && e.ps.includes("Et retrouve ce que tu avais oublié, jusqu'au dernier chapitre.")
      && JSON.stringify(e.lis) === JSON.stringify(['Un compteur de mots, des chapitres, des fragments datés', "Des sources complétées depuis un lien ou un DOI, reliées à ce qu'elles documentent", "Ni publicité ni traceur : tout vit d'abord sur ton appareil"])
      && e.ps.includes('Rien à créer : tout reste sur cet appareil. Un compte, plus tard, le retrouve sur tes autres appareils, avec ce que tu auras noté.')
      && e.h3[0] === "J'ai déjà un compte" && e.labels.join() === 'E-mail,Mot de passe' && ['Commencer sans compte', 'Se connecter', 'Créer un compte', 'Mot de passe oublié ?'].every(x => e.boutons.includes(x));
    const e1 = await entree(p);
    check(textes(e1), 'la phrase et les trois puces ; « Commencer sans compte » et sa phrase ; « J’ai déjà un compte », ses deux champs et ses trois boutons (CPT-001)');
    check(e1.h2r && e1.h3r && e1.h2r.r <= e1.h3r.l, 'sur ordinateur, la promesse à gauche du compte');
    { const tel = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage(); tel.on('pageerror', e => errs.push(e.message));
      await tel.route('https://*.supabase.co/**', r => json(r, 200, new URL(r.request().url()).pathname === '/auth/v1/settings' ? { disable_signup: false } : []));
      await tel.goto(BASE + '/index.html'); await tel.waitForSelector('[data-act="auth-local"]');
      const e2 = await entree(tel);
      check(textes(e2) && e2.h2r.b <= e2.h3r.t && e2.large && !e2.dehors, 'sur téléphone, à 390 px : les mêmes textes, la promesse en haut, aucun défilement horizontal, chaque bouton dans l’écran');
      await tel.context().close(); }

    console.log('commencer sans compte');
    await p.click('[data-act="auth-local"]'); await settle();
    check((await main()).includes('Sur quoi travailles-tu'), 'l’app elle-même, et sa première question');
    check(await p.isVisible('#timerBtn') && (await p.textContent('#nav')).includes('Capture'), 'navigation et minuteur');
    await p.click('[data-act="welcome-path"][data-path="ecrire"]'); await settle();
    await capturer('Une hypothèse sur le chapitre 3'); await settle();
    check(await p.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes("Gardé. Tu peux oublier, c'est écrit."), null, { timeout: 5000 }).then(() => true, () => false),
      'la capture : « Gardé. Tu peux oublier, c’est écrit. »');
    await p.reload(); await p.waitForSelector('#capIn');
    check((await p.textContent('#nav')).includes('Écriture'), 'au rechargement : toujours sans compte, rien de perdu');
    await p.evaluate(() => { location.hash = 'inbox'; }); await p.waitForFunction(() => location.hash === '#inbox'); await settle();
    check((await main()).includes('Une hypothèse sur le chapitre 3'), 'et la capture est dans la boîte');
    await p.evaluate(() => { location.hash = 'accueil'; }); await p.waitForSelector('#capIn');
    check(!p.appels.some(a => /\/rest\/v1\/(app_state|activite)/.test(a)) && p.appels.every(a => a === 'GET /auth/v1/settings'),
      `rien de ce qui est écrit ne part au serveur : ni app_state, ni activite, seulement la lecture des inscriptions (${[...new Set(p.appels)].join(', ') || 'aucune requête'})`);
    // CPT-002, étape 5 : l'onglet fermé, le site rouvert dans un autre (un sessionStorage neuf, le reste de l'appareil gardé).
    const ctx = p.context(), appels = p.appels; await p.close();
    p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.appels = appels; ({ main, settle, until, capturer, versCompte } = outils(p));
    await p.goto(BASE + '/index.html'); await p.waitForFunction(() => document.querySelector('#capIn') || document.querySelector('#authForm'));
    check(!(await p.$('#authForm')) && (await p.textContent('#nav')).includes('Écriture'), 'l’onglet fermé puis rouvert : l’app, sans écran d’entrée');
    await p.evaluate(() => { location.hash = 'inbox'; }); await p.waitForFunction(() => location.hash === '#inbox'); await settle();
    check((await main()).includes('Une hypothèse sur le chapitre 3'), 'et la capture, toujours dans la boîte');
    await p.evaluate(() => { location.hash = 'accueil'; }); await p.waitForSelector('#capIn');

    check(await storeGet(p, 'selene-sans-compte') === '1', 'le choix « sans compte » est gardé sur l’appareil');
    console.log('Réglages → Compte, sans compte');
    await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('[data-act="auth-open"]');
    check((await main()).includes('Sans compte : tout reste sur cet appareil') && !!(await p.$('[data-act="err-reports"]')), 'ce que veut dire « sans compte », et le journal des erreurs, qu’on peut couper');
    check((await main()).includes("Effacer les données du navigateur, ou désinstaller l'app, efface tout : exporte une sauvegarde de temps en temps.") && (await p.textContent('[data-act="auth-open"] >> nth=0')).includes('Créer un compte ou me connecter'), 'la mise en garde : effacer le navigateur efface tout, exporter de temps en temps ; « Créer un compte ou me connecter »');
    await p.check('[data-act="mod-on"][aria-label="Activer Assistant"]'); await settle();
    check((await main()).includes('Sans compte, pas d\'assistant') && !(await p.$('[data-act="as-key"]')), 'l’assistant, qui garde la clé sur le serveur, demande un compte : pas de champ qui échouerait');
    const modules = async () => JSON.stringify(JSON.parse(await storeGet(p, 'selene-site-v1')).modules), avant = await modules();
    await p.click('[data-act="auth-open"] >> nth=0'); await p.waitForSelector('#authForm');
    check((await main()).includes('Créer un compte') && (await main()).includes('Revenir à Selene sans compte'), 'créer un compte, ou revenir');
    await p.click('[data-act="auth-local"]'); await p.waitForSelector('#capIn');
    check((await p.textContent('#nav')).includes('Écriture') && (await modules()) === avant, 'revenir : l’espace est intact, ses données à l’identique');

    console.log('un compte neuf, plus tard : ce qui a été noté le rejoint');
    await versCompte();
    await p.fill('#authEmail', 'iris@exemple.org'); await p.fill('#authPw', 'une phrase assez longue');
    await p.click('#authForm button[type="submit"]');
    check(await until(() => noteSur(lignes.get(NEUF), 'chapitre 3')), 'à la création du compte, la capture part sur le serveur');
    check(!!lignes.get(NEUF).site.modules.ecriture, 'avec l’espace Écriture');
    check(await storeGet(p, 'selene-sans-compte') === null, 'le choix « sans compte » s’efface : le compte prend le relais');
    await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForTimeout(300);
    check((await main()).includes('Connecté en tant que iris@exemple.org'), 'connectée');
  } catch (e) { check(false, e.message.split('\n')[0]); }

  try {
    console.log('un compte qui a déjà ses données, sur un appareil où un autre compte s’était déconnecté');
    const compte = JSON.parse(fixture()), lignes = new Map();
    Object.assign(compte, { updatedAt: 1000000 }); Object.assign(compte.config, { palette: 'albedo', name: 'Atelier' });
    lignes.set(ANCIEN, { board: {}, site: compte });
    const p = await appareil(ANCIEN, lignes, () => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem('selene-auth-last-uid', 'un-autre-compte'); } });
    const { main, settle, until, capturer, versCompte } = outils(p);
    await p.goto(BASE + '/index.html'); await p.waitForSelector('[data-act="auth-local"]');
    await p.click('[data-act="auth-local"]'); await settle();
    await p.click('[data-act="welcome-path"][data-path="jours"]'); await settle();
    await capturer('Une idée notée sans compte'); await settle();
    await versCompte();
    await p.click('[data-act="auth-switch"]'); await p.waitForSelector('#authForm');
    check((await main()).includes('Se connecter'), 'se connecter à un compte existant');
    await p.fill('#authEmail', 'iris@exemple.org'); await p.fill('#authPw', 'une phrase assez longue');
    await p.click('#authForm button[type="submit"]');
    check(await until(() => noteSur(lignes.get(ANCIEN), 'notée sans compte')), 'la capture faite sans compte rejoint le compte (l’autre compte d’avant ne l’efface pas)');
    const site = lignes.get(ANCIEN).site;
    check(!!site.modules.kundalini && !!site.modules.carnet && !!site.modules.soins, 'les espaces du compte et ceux de l’appareil, tous gardés');
    check(site.config.palette === 'albedo' && site.config.name === 'Atelier', 'les réglages du compte l’emportent sur ceux, par défaut, de l’appareil');
    check(await until(async () => (await p.evaluate(() => document.documentElement.dataset.palette)) === 'albedo'), 'et la page les applique');
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
