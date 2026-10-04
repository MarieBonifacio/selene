/* Scénario de navigateur : la page publique de test (essai.html, docs/essai.md ; E3 de l'audit). Un faux Supabase.
   Une ouverture laisse une ligne d'audience (pas un rechargement), avec le lien d'arrivée ; la liste d'attente envoie
   l'adresse, le lien et le projet, avec la clé publique seule ; rien n'est écrit sur l'appareil (ni cookie, ni
   stockage) ; aucune requête ne sort ailleurs ; « Essayer sans compte » ouvre l'app sans compte, directement.
   Lancé par tests/browser/run.js. */
const { storeGet, engine, BASE, launchOptions, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const recus = [], ailleurs = [], csp = [], errs = [];
  let panne = false;
  await ctx.route('**/*', route => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    if (u.hostname.endsWith('.supabase.co')) {
      if (u.pathname === '/rest/v1/attente' || u.pathname === '/rest/v1/audience') {
        recus.push({ table: u.pathname.split('/').pop(), corps: req.postDataJSON(), apikey: req.headers().apikey, auth: req.headers().authorization });
        return route.fulfill({ status: panne ? 500 : 201, body: '' });
      }
      return route.fulfill({ contentType: 'application/json', body: req.method() === 'GET' ? (u.pathname === '/auth/v1/settings' ? '{"disable_signup":false}' : '[]') : '{}' });
    }
    ailleurs.push(u.href); return route.abort();
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused to/.test(m.text())) csp.push(m.text()); });
  const audience = ev => recus.filter(r => r.table === 'audience' && r.corps.evenement === ev);
  const attendre = async (cond, ms = 5000) => { for (const end = Date.now() + ms; !cond() && Date.now() < end;) await p.waitForTimeout(50); return cond(); };
  const statut = () => p.textContent('#statut');
  try {
    console.log('une ouverture, pas un rechargement');
    await p.goto(BASE + '/essai.html?src=forum-a'); await p.waitForSelector('#attente');
    check(await attendre(() => audience('visite').length === 1), 'une ouverture : une ligne d’audience');
    const v = audience('visite')[0];
    check(v && v.corps.page === 'essai' && v.corps.source === 'forum-a' && Object.keys(v.corps).sort().join() === 'evenement,page,source', 'la page, l’événement, le lien d’arrivée : rien d’autre');
    check(v && v.apikey && !v.auth, 'la clé publique seule, aucun jeton');
    await p.reload(); await p.waitForSelector('#attente'); await p.waitForTimeout(400);
    check(audience('visite').length === 1, 'un rechargement ne compte pas');
    await p.evaluate(() => document.fonts.ready);
    check(await p.evaluate(() => document.fonts.check('600 1em "Cormorant Garamond"')), 'les polices de Selene, servies par le site');
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sur téléphone : pas de défilement horizontal');

    console.log('la liste d’attente');
    await p.fill('#email', 'pas-une-adresse'); await p.check('#accord'); await p.click('#attente button[type=submit]');
    check((await statut()).includes('ne semble pas complète') && !recus.some(r => r.table === 'attente'), 'une adresse incomplète : dit, rien n’est envoyé');
    await p.fill('#email', 'iris@exemple.org'); await p.uncheck('#accord'); await p.click('#attente button[type=submit]');
    check((await statut()).includes('Coche la case') && !recus.some(r => r.table === 'attente'), 'sans l’accord : dit, rien n’est envoyé');
    panne = true; await p.check('#accord'); await p.click('#attente button[type=submit]');
    await p.waitForFunction(() => document.querySelector('#statut').textContent.includes("n'est pas partie"));
    check((await statut()).includes('mariebonifacio.pro@gmail.com'), 'le serveur refuse : dit, avec l’adresse de contact');
    check((await p.inputValue('#email')) === 'iris@exemple.org', 'et l’adresse reste dans le champ');
    panne = false; await p.selectOption('#projet', 'these'); await p.click('#attente button[type=submit]');
    await p.waitForFunction(() => document.querySelector('#statut').textContent.includes("C'est noté"));
    const ins = recus.filter(r => r.table === 'attente').pop();
    check(ins && ins.corps.email === 'iris@exemple.org' && ins.corps.source === 'forum-a' && ins.corps.projet === 'these' && Object.keys(ins.corps).length === 3, 'l’adresse, le lien d’arrivée, le projet : rien d’autre');
    check(ins && ins.apikey && !ins.auth, 'la clé publique seule');
    check((await p.inputValue('#email')) === '' && !(await p.isChecked('#accord')), 'inscrite : le formulaire se vide');

    console.log('rien sur l’appareil, rien ailleurs');
    const traces = await p.evaluate(() => [document.cookie, localStorage.length, sessionStorage.length]);
    check(traces[0] === '' && traces[1] === 0 && traces[2] === 0, `ni cookie, ni stockage (${traces.join(', ')})`);
    check(!ailleurs.length, 'aucune requête vers un autre service' + (ailleurs.length ? ' : ' + ailleurs.join(', ') : ''));
    check(!csp.length, 'aucune violation de la CSP' + (csp.length ? ' : ' + csp.join(' | ') : ''));

    console.log('essayer tout de suite, sans compte');
    await p.click('.hero a[data-essai]');
    await p.waitForSelector('[data-act="welcome-path"]', { timeout: 10000 });
    check(await attendre(() => audience('essai').length === 1), 'le clic laisse une ligne d’audience, la page s’ouvre');
    check(await p.evaluate(() => location.hash === '#accueil') && await storeGet(p, 'selene-sans-compte') === '1', 'l’app, sans compte, sans repasser par l’écran d’entrée');
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
