/* Scénario de navigateur : mot de passe oublié, lien de récupération, invitation, et les messages de l'écran de
   connexion. Version hébergée simulée : un faux Supabase Auth. Lancé par tests/browser/run.js. */
const { storeGet, storeSet, until, ouvrir, fauxSupabase, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666', AUTRE = '9d1e5b7a-aaaa-bbbb-cccc-ddddeeeeffff';
const lien = (type, jeton = 'jeton-lien') => `#access_token=${jeton}&expires_at=${Math.floor(Date.now() / 1000) + 3600}&expires_in=3600&refresh_token=rafraichi&token_type=bearer&type=${type}`;
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (hash = '', { session = null, trop = false, fermees = false, nonAutorise = false } = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.calls = [];
    const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    await fauxSupabase(ctx, (route, req, u) => {
      p.calls.push({ method: req.method(), path: u.pathname, search: u.search, body: req.postData(), auth: req.headers().authorization });
      if (u.pathname === '/auth/v1/settings') return json(route, 200, { disable_signup: fermees, external: { email: true } });
      if (u.pathname === '/auth/v1/signup') return json(route, 422, { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' });
      if (u.pathname === '/auth/v1/recover') return trop ? json(route, 429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' })
        : nonAutorise ? json(route, 400, { code: 400, error_code: 'email_address_not_authorized', msg: 'Email address "iris@exemple.org" cannot be used as it is not authorized' }) : json(route, 200, {});
      if (u.pathname === '/auth/v1/user' && req.method() === 'PUT') {
        if (!['Bearer jeton-lien', 'Bearer jeton-frais'].includes(req.headers().authorization)) return json(route, 403, { code: 403, error_code: 'bad_jwt', msg: 'invalid JWT: token is expired' });
        const corps = JSON.parse(req.postData()), pw = corps.password;
        // Comme le vrai serveur : le même mot de passe que l'actuel est refusé (CPT-011, étape 3), l'ancien du lien aussi.
        if (pw === 'ancien-mdp' || (corps.current_password && pw === corps.current_password)) return json(route, 422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' });
        if (pw === 'mot-de-passe-fuite') return json(route, 422, { code: 422, error_code: 'weak_password', msg: 'Password is known to be weak and easy to guess, please choose a different one.', weak_password: { reasons: ['pwned'] } });
        return json(route, 200, { id: UID, email: 'iris@exemple.org' });
      }
      if (u.pathname === '/auth/v1/token') {
        // Le vrai serveur : un mot de passe juste entre, même plus court que ses règles actuelles (il le signale).
        const pw = (JSON.parse(req.postData() || '{}')).password, ses = (jeton, extra = {}) => json(route, 200, { access_token: jeton, refresh_token: 'r2', expires_in: 3600, user: { id: UID, email: 'iris@exemple.org' }, ...extra });
        if (pw === 'court1') return ses('jeton-court', { weak_password: { message: 'Password should be at least 10 characters.', reasons: ['length'] } });
        if (pw === 'mot-de-passe-actuel') return ses('jeton-frais');
        return json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      if (u.pathname.startsWith('/functions/')) return route.fulfill({ status: 404, body: '' });
    });
    if (session) await ctx.addInitScript(([s, uid]) => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } },
      [JSON.stringify({ access_token: 'jeton-garde', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: session, email: 'autre@exemple.org' } }), session]);
    // Le premier rendu, pas un délai (A16 du cahier de recette : sous un Firefox chargé, 500 ms ne suffisaient pas toujours).
    return ouvrir(p, BASE + '/index.html' + hash);
  };
  const note = async p => (await p.textContent('#authErr')).replace(/\s+/g, ' ');
  /* Attendre un état de la page plutôt qu'un délai (A11 et A16 du cahier de recette : sous charge, 300 à 500 ms ne
     suffisaient pas toujours). Rien n'est affaibli : si l'état ne vient pas en 10 s, la vérification qui suit échoue comme
     avant, et le journal dit quel état n'est pas venu. Les délais qui restent servent à vérifier qu'aucune requête ne
     part : une absence ne s'attend pas. */
  const attendre = (p, etat, arg = null) => p.waitForFunction(etat, arg, { timeout: 10000 }).then(() => true,
    () => { console.log(`  … pas venu en 10 s : ${String(etat).replace(/\s+/g, ' ').slice(0, 110)}${arg === null ? '' : ` (« ${arg} »)`}`); return false; });
  // Envoyer le formulaire ; quand une réponse du serveur est attendue, attendre son message plutôt qu'un délai.
  const submit = async (p, attendu = null) => {
    const avant = p.calls.length, vient = a => document.querySelector('#authErr').textContent.includes(a);
    await p.click('#authForm button[type="submit"]');
    if (!attendu) return p.waitForTimeout(400);
    if (await attendre(p, vient, attendu)) return;
    /* Un clic resté sans aucun effet (aucune requête partie, aucun message) : vu une fois en 21 passages sous Firefox
       (A16), le formulaire prêt et l'adresse remplie. Renvoyé une fois, et dit dans le journal ; si l'app ne répond
       jamais, la vérification qui suit échoue comme avant. */
    if (p.calls.length === avant && !(await note(p)).trim()) {
      console.log('  … clic d’envoi sans effet (aucune requête, aucun message) : renvoyé une fois');
      await p.click('#authForm button[type="submit"]'); await attendre(p, vient, attendu);
    }
  };
  const entree = () => !document.querySelector('#authForm'); // l'écran de connexion a cédé la place à l'app

  console.log('les messages de l’écran de connexion');
  const p = await open();
  // Un autre onglet enregistre pendant la frappe : l'écran se redessine (platform.storage.watch), la saisie reste. Avant
  // le correctif, l'adresse et le mot de passe s'effaçaient (échec de Firefox du 6 octobre 2026 : champ requis vide,
  // envoi bloqué sans un mot).
  await p.fill('#authEmail', 'iris@exemple.org'); await p.fill('#authPw', 'mauvais-mdp'); await p.focus('#authPw');
  await p.evaluate(() => { window.__rendus = 0; new MutationObserver(() => window.__rendus++).observe(document.querySelector('#main'), { childList: true }); });
  const onglet = await p.context().newPage(); await onglet.goto(BASE + '/privacy.html');
  await storeSet(onglet, 'selene-site-v1', JSON.stringify({ ...JSON.parse(fixture()), updatedAt: Date.now() + 1e6 })); await onglet.close();
  await attendre(p, () => window.__rendus > 0);
  const garde = [await p.evaluate(() => window.__rendus), await p.inputValue('#authEmail'), await p.inputValue('#authPw'), await p.evaluate(() => document.activeElement.id)];
  ok(garde[0] > 0 && garde[1] === 'iris@exemple.org' && garde[2] === 'mauvais-mdp' && garde[3] === 'authPw', 'un autre onglet enregistre pendant la frappe : l’écran se redessine, l’adresse, le mot de passe et le curseur restent' + (garde[0] > 0 ? '' : ' (aucun rendu)'));
  await p.fill('#authEmail', 'iris@exemple.org'); await p.fill('#authPw', 'mauvais-mdp'); await submit(p, 'Invalid login credentials');
  ok((await note(p)).includes('Invalid login credentials'), 'une connexion refusée : le message reste affiché (il disparaissait au rendu suivant)');
  ok((await p.inputValue('#authEmail')) === 'iris@exemple.org', 'l’adresse tapée reste dans le champ');
  // CPT-006 : la couleur d'alerte, telle que la page la calcule (la variable --alarm du thème), distincte d'une aide.
  const teintes = await p.evaluate(() => { const t = document.createElement('span'); t.style.color = 'var(--alarm)'; document.body.append(t); const alarme = getComputedStyle(t).color; t.remove();
    const aide = [...document.querySelectorAll('#main p.hint')].find(x => x.id !== 'authErr'); return [getComputedStyle(document.querySelector('#authErr')).color, alarme, aide ? getComputedStyle(aide).color : ''] });
  ok(teintes[0] === teintes[1] && teintes[0] !== teintes[2], `le message, en couleur d’alerte (${teintes[0]} ; une aide : ${teintes[2]}) (CPT-006, étape 1)`);
  await p.waitForTimeout(10000); // une absence : dix secondes réelles, sans rien toucher, comme le cas le demande
  ok((await note(p)).includes('Invalid login credentials') && (await p.inputValue('#authEmail')) === 'iris@exemple.org', 'dix secondes plus tard, sans un geste : le message et l’adresse sont toujours là (CPT-006, étape 2)');
  const coupe = u => u.pathname === '/auth/v1/token';
  await p.route(coupe, r => r.abort('internetdisconnected')); // le réseau coupé, pour la connexion seulement
  await p.fill('#authPw', 'mauvais-mdp'); await submit(p, 'Impossible de joindre le serveur'); // recommencer : le mot de passe, vidé par le refus, ressaisi
  ok((await note(p)).trim() === 'Impossible de joindre le serveur. Vérifie ta connexion.', `hors ligne : « ${(await note(p)).trim()} » (CPT-006, étape 4)`);
  await p.unroute(coupe);

  console.log('mot de passe oublié');
  await p.click('[data-act="auth-forgot"]'); await p.waitForTimeout(200);
  ok(!(await p.$('#authPw')) && (await p.inputValue('#authEmail')) === 'iris@exemple.org' && !(await note(p)), 'une adresse seulement, déjà remplie ; l’ancien message effacé');
  await submit(p, 'Si un compte existe à cette adresse');
  const rec = p.calls.find(c => c.path === '/auth/v1/recover');
  ok(rec && rec.method === 'POST' && JSON.parse(rec.body).email === 'iris@exemple.org' && rec.search === '?redirect_to=' + encodeURIComponent(BASE + '/index.html'), 'la demande part, avec le retour vers cette page');
  ok((await note(p)).includes('Si un compte existe à cette adresse'), 'la réponse ne dit pas si l’adresse a un compte');
  await p.click('[data-act="auth-back"]'); await p.waitForTimeout(200);
  ok(await p.isVisible('#authPw') && await p.isVisible('[data-act="auth-forgot"]'), 'revenir à la connexion');
  // Le formulaire « mot de passe oublié » d'abord (plus de champ de mot de passe), puis le message ; ce qui s'affiche
  // est recopié si la vérification échoue (premier passage sous Firefox, le 6 octobre 2026).
  const oublie = async (pg, attendu) => {
    await pg.click('[data-act="auth-forgot"]'); await attendre(pg, () => !document.querySelector('#authPw'));
    await pg.fill('#authEmail', 'iris@exemple.org'); await submit(pg, attendu);
    pg.demande = pg.calls.some(c => c.path === '/auth/v1/recover');
    pg.formulaire = await pg.evaluate(() => !document.querySelector('#authForm') ? 'absent'
      : (document.querySelector('#authPw') ? 'de connexion' : 'de demande de lien') + ', adresse ' + ((document.querySelector('#authEmail') || {}).value ? 'remplie' : 'vide'));
    return note(pg);
  };
  // Si la vérification échoue : ce qui s'affiche, et si la demande est seulement partie (le premier échec d'A16, message
  // vide, n'a pas encore d'explication : la prochaine fois, le journal la donnera).
  const vu = (msg, attendu, pg) => msg.includes(attendu) ? '' : ` (affiché : « ${msg.trim()} » ; demande ${pg.demande ? 'partie' : 'jamais partie'} ; formulaire ${pg.formulaire})`;
  const pTrop = await open('', { trop: true }), trop = await oublie(pTrop, 'Trop de demandes');
  ok(trop.includes('Trop de demandes'), 'trop de demandes (429) : dit, en clair' + vu(trop, 'Trop de demandes', pTrop));
  const pSmtp = await open('', { nonAutorise: true }), smtp = await oublie(pSmtp, 'ne sait pas encore envoyer');
  ok(smtp.includes('ne sait pas encore envoyer') && !smtp.includes('not authorized'), 'envoi non configuré (SMTP intégré de Supabase) : dit, en français' + vu(smtp, 'ne sait pas encore envoyer', pSmtp));

  console.log('inscriptions fermées');
  ok(p.calls.filter(c => c.path === '/auth/v1/settings').length === 1, 'les inscriptions sont demandées une fois au serveur');
  const f = await open('', { fermees: true });
  await until(() => f.calls.some(c => c.path === '/auth/v1/settings')); await attendre(f, () => !document.querySelector('[data-act="auth-switch"]'));
  ok(!(await f.$('[data-act="auth-switch"]')) && (await f.textContent('#main')).includes('que sur invitation') && await f.isVisible('[data-act="auth-forgot"]'), 'fermées : plus de « Créer un compte », l’invitation est dite ; le mot de passe oublié reste');
  const s2 = await open();
  await s2.click('[data-act="auth-switch"]'); await s2.fill('#authEmail', 'nouvelle@exemple.org'); await s2.fill('#authPw', 'un-mot-de-passe'); await submit(s2, 'Les inscriptions sont fermées');
  ok((await note(s2)).includes('Les inscriptions sont fermées') && !(await s2.$('[data-act="auth-switch"]')) && await s2.isVisible('[data-act="auth-forgot"]'), 'fermées entre-temps : le refus du serveur est traduit, et l’écran revient à la connexion');

  console.log('le lien de l’e-mail');
  const r = await open(lien('recovery'));
  ok(await r.isVisible('#authPw2') && (await r.textContent('#main')).includes('Choisis un nouveau mot de passe'), 'le lien ouvre le choix du nouveau mot de passe');
  ok(!(await r.evaluate(() => location.href)).includes('jeton-lien'), 'le jeton quitte aussitôt l’adresse');
  await r.fill('#authPw', 'nouveau-mdp'); await r.fill('#authPw2', 'nouveau-mdq'); await submit(r);
  ok((await note(r)).includes('ne sont pas identiques') && !r.calls.some(c => c.path === '/auth/v1/user'), 'deux saisies différentes : refusé avant tout envoi');
  await r.fill('#authPw', 'ancien-mdp'); await r.fill('#authPw2', 'ancien-mdp'); await submit(r, 'déjà ton mot de passe');
  ok((await note(r)).includes('déjà ton mot de passe'), 'le même qu’avant : dit, en français');
  await r.fill('#authPw', 'nouveau-mdp'); await r.fill('#authPw2', 'nouveau-mdp'); await submit(r); await attendre(r, entree);
  const put = r.calls.filter(c => c.path === '/auth/v1/user').pop();
  ok(put && put.method === 'PUT' && put.auth === 'Bearer jeton-lien' && JSON.parse(put.body).password === 'nouveau-mdp', 'le mot de passe part, avec le jeton du lien');
  const s = JSON.parse(await storeGet(r, 'selene-auth-session') || '{}');
  // La bulle vient une fois le branchement fini : un branchement qui réussit (BL-23) fait plus d'allers-retours.
  await attendre(r, t => ((document.querySelector('#toast') || {}).textContent || '').includes(t), 'Mot de passe enregistré');
  ok(!(await r.$('#authForm')) && (await r.textContent('#toast')).includes('Mot de passe enregistré') && s.access_token === 'jeton-lien' && s.refresh_token === 'rafraichi' && s.user.id === UID, 'enregistré : connectée, la session est celle du lien');

  console.log('liens expirés ou fabriqués');
  const x = await open('#error=access_denied&error_code=otp_expired&error_description=Appelle+le+0600000000');
  ok((await note(x)).includes('Ce lien ne fonctionne plus') && !(await x.textContent('#main')).includes('0600000000') && !(await x.$('#authPw')), 'lien expiré : dit, sans reprendre le texte du lien, et propose d’en demander un autre');
  ok(!(await x.evaluate(() => location.href)).includes('error'), 'l’erreur quitte l’adresse');
  const e = await open(lien('recovery', 'jeton-perime'));
  await e.fill('#authPw', 'nouveau-mdp'); await e.fill('#authPw2', 'nouveau-mdp'); await submit(e, 'Ce lien ne fonctionne plus');
  ok((await note(e)).includes('Ce lien ne fonctionne plus') && !(await e.$('#authPw')) && await e.isVisible('#authEmail'), 'jeton refusé par le serveur : retour à la demande d’un nouveau lien');
  const n = await open(lien('signup'));
  ok(!(await n.evaluate(() => location.href)).includes('jeton-lien') && !(await n.$('#authPw2')), 'un autre type de lien : le jeton est effacé de l’adresse, rien d’autre');

  console.log('invitation, appareil déjà connecté');
  const i = await open(lien('invite'));
  ok((await i.textContent('#main')).includes('Bienvenue. Choisis le mot de passe de ton compte.'), 'une invitation : choisir son mot de passe');
  ok(!(await i.evaluate(() => location.href)).includes('jeton-lien'), 'le jeton de l’invitation quitte aussitôt l’adresse');
  await i.fill('#authPw', 'premier-mdp'); await i.fill('#authPw2', 'premier-mdp'); await submit(i); await attendre(i, entree);
  ok(!(await i.$('#authForm')), 'et entrer');
  // CPT-010, étape 3 : un compte neuf, sans ligne au serveur : l'accueil s'ouvre sur « Composer ton espace » et ses trois chemins.
  await i.evaluate(() => { location.hash = 'accueil'; }); await attendre(i, () => !!document.querySelector('#main .welcome'));
  const neuf = (await i.textContent('#main')).replace(/\s+/g, ' '), chemins = await i.$$eval('#main [data-act="welcome-path"]', xs => xs.length);
  ok(neuf.includes('Composer ton espace') && neuf.includes('Sur quoi travailles-tu ?') && chemins === 3 && (await storeGet(i, 'selene-auth-last-uid')) === UID,
    `l’invitation acceptée : connectée au compte invité, l’accueil d’un compte neuf, « Composer ton espace » et ses ${chemins} chemins (CPT-010, étape 3)`);
  const iv = await open(lien('invite', 'jeton-perime')); // une invitation déjà servie : le serveur refuse son jeton (CPT-010, étape 4)
  await iv.fill('#authPw', 'premier-mdp'); await iv.fill('#authPw2', 'premier-mdp'); await submit(iv, 'Cette invitation a expiré');
  ok((await note(iv)).includes("Cette invitation a expiré, ou elle a déjà servi : demande qu'on te la renvoie.") && !(await iv.$('#authPw2')) && await iv.isVisible('#authEmail'),
    'une invitation déjà servie : dit comme telle, et l’écran revient à la connexion');
  const d = await open(lien('recovery'), { session: AUTRE });
  ok(await d.isVisible('#authPw2') && !d.calls.some(c => c.path === '/rest/v1/app_state'), 'déjà connectée à un autre compte : le lien passe d’abord, la session gardée attend');
  await d.click('[data-act="auth-back"]'); await attendre(d, entree); await until(() => d.calls.some(c => c.path === '/rest/v1/app_state' && c.auth === 'Bearer jeton-garde'));
  ok(!(await d.$('#authForm')) && d.calls.some(c => c.path === '/rest/v1/app_state' && c.auth === 'Bearer jeton-garde'), 'annuler : la session gardée reprend');

  console.log('longueur minimale, mots de passe refusés');
  const m = await open();
  ok(!(await m.getAttribute('#authPw', 'minlength')), 'la connexion n’impose aucune longueur : un ancien mot de passe court entre toujours');
  await m.click('[data-act="auth-switch"]');
  ok((await m.getAttribute('#authPw', 'minlength')) === '10' && (await m.textContent('#authForm')).includes('10 caractères au moins'), 'à l’inscription : dix caractères au moins, et c’est écrit');
  // CPT-007, étapes 1 et 2 : l'aide entière, puis `court1234` (9 caractères) refusé par le navigateur, avant tout envoi.
  const aide = (await m.textContent('#authForm')).replace(/\s+/g, ' ');
  ok(aide.includes('10 caractères au moins. Une courte phrase fait un bon mot de passe, facile à retenir.'), 'l’aide sous le mot de passe : « 10 caractères au moins. Une courte phrase fait un bon mot de passe, facile à retenir. » (CPT-007, étape 1)');
  await m.fill('#authEmail', 'iris@exemple.org'); await m.fill('#authPw', 'court1234');
  const avantEnvoi = m.calls.length; await submit(m);
  const refus = await m.$eval('#authPw', i => ({ court: i.validity.tooShort, invalide: i.matches(':invalid'), bouton: document.querySelector('#authForm button[type="submit"]').textContent.trim() }));
  ok(refus.court && refus.invalide && refus.bouton === 'Créer le compte' && !m.calls.slice(avantEnvoi).some(x => x.path === '/auth/v1/signup'),
    `« ${refus.bouton} » avec « court1234 » : le navigateur refuse (champ en erreur, trop court), aucune requête /auth/v1/signup (CPT-007, étape 2)`);
  const c = await open(lien('recovery'));
  await c.fill('#authPw', 'court'); await c.fill('#authPw2', 'court'); await submit(c);
  ok(!c.calls.some(x => x.path === '/auth/v1/user') && (await c.getAttribute('#authPw', 'minlength')) === '10', 'nouveau mot de passe trop court : refusé avant tout envoi');
  await c.fill('#authPw', 'mot-de-passe-fuite'); await c.fill('#authPw2', 'mot-de-passe-fuite'); await submit(c, 'fuites de données connues');
  ok((await note(c)).includes('fuites de données connues'), 'refusé par le serveur (weak_password, pwned) : la raison, en français');

  console.log('changer de mot de passe');
  const w = await open();
  await w.fill('#authEmail', 'iris@exemple.org'); await w.fill('#authPw', 'court1'); await submit(w); await attendre(w, entree);
  await attendre(w, t => ((document.querySelector('#toast') || {}).textContent || '').includes(t), 'plus court que ce que le serveur demande');
  ok(!(await w.$('#authForm')) && (await w.textContent('#toast')).includes('plus court que ce que le serveur demande'), 'connexion avec un mot de passe devenu trop court : on entre, et Selene le dit');
  await w.evaluate(() => { location.hash = 'reglages'; }); await attendre(w, () => !!document.querySelector('#auth-pw #authPwForm'));
  await w.evaluate(() => document.querySelectorAll('details').forEach(d => { if (d.id !== 'auth-delete') d.open = true; }));
  ok(await w.isVisible('#authPwForm') && (await w.textContent('#auth-pw')).includes('choisis-en un nouveau'), 'Réglages, Compte : le changement est proposé, ouvert');
  // Le résultat du changement s'affiche dans la bulle (#toast), après une ou deux réponses du serveur : l'attendre.
  const change = async (cur, pw, attendu) => {
    await w.fill('#authCurPw', cur); await w.fill('#authNewPw', pw); await w.fill('#authNewPw2', pw); await w.click('#authPwForm button[type="submit"]');
    await attendre(w, a => (document.querySelector('#toast') || {}).textContent.includes(a), attendu);
  };
  await change('mauvais-mot-de-passe', 'une-phrase-de-saison', "actuel n'est pas le bon");
  ok((await w.textContent('#toast')).includes("actuel n'est pas le bon") && !w.calls.some(x => x.path === '/auth/v1/user'), 'mot de passe actuel faux : rien ne change');
  await w.evaluate(() => document.querySelectorAll('details').forEach(d => { if (d.id !== 'auth-delete') d.open = true; }));
  // CPT-011, étape 3 : l'actuel juste, le nouveau identique à l'actuel ; refusé par le serveur, dit en français.
  await change('mot-de-passe-actuel', 'mot-de-passe-actuel', 'déjà ton mot de passe');
  ok((await w.textContent('#toast')).trim() === 'C\'est déjà ton mot de passe : choisis-en un autre.' && !(await w.$('#authForm')), '« C’est déjà ton mot de passe : choisis-en un autre. » ; toujours connectée (CPT-011, étape 3)');
  await w.evaluate(() => document.querySelectorAll('details').forEach(d => { if (d.id !== 'auth-delete') d.open = true; }));
  await change('mot-de-passe-actuel', 'une-phrase-de-saison', 'Mot de passe changé');
  const sent = w.calls.filter(x => x.path === '/auth/v1/user' && x.method === 'PUT').pop();
  const body = sent && JSON.parse(sent.body), saved = JSON.parse(await storeGet(w, 'selene-auth-session') || '{}');
  ok(sent && sent.auth === 'Bearer jeton-frais' && body.password === 'une-phrase-de-saison' && body.current_password === 'mot-de-passe-actuel', 'vérifié par une connexion fraîche, puis envoyé avec le mot de passe actuel');
  ok((await w.textContent('#toast')).includes('Mot de passe changé') && saved.access_token === 'jeton-frais' && !(await w.textContent('#auth-pw')).includes('choisis-en un nouveau'), 'changé : la session fraîche est gardée, l’avertissement disparaît');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
