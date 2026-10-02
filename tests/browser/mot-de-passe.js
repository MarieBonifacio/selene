/* Scénario de navigateur : mot de passe oublié, lien de récupération, invitation, et les messages de l'écran de
   connexion. Version hébergée simulée : un faux Supabase Auth. Lancé par tests/browser/run.js. */
const { storeGet, engine, BASE, launchOptions, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666', AUTRE = '9d1e5b7a-aaaa-bbbb-cccc-ddddeeeeffff';
const lien = (type, jeton = 'jeton-lien') => `#access_token=${jeton}&expires_at=${Math.floor(Date.now() / 1000) + 3600}&expires_in=3600&refresh_token=rafraichi&token_type=bearer&type=${type}`;
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (hash = '', { session = null, trop = false, fermees = false, nonAutorise = false } = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.calls = [];
    const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    await ctx.route('https://*.supabase.co/**', route => {
      const req = route.request(), u = new URL(req.url());
      p.calls.push({ method: req.method(), path: u.pathname, search: u.search, body: req.postData(), auth: req.headers().authorization });
      if (u.pathname === '/auth/v1/settings') return json(route, 200, { disable_signup: fermees, external: { email: true } });
      if (u.pathname === '/auth/v1/signup') return json(route, 422, { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' });
      if (u.pathname === '/auth/v1/recover') return trop ? json(route, 429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' })
        : nonAutorise ? json(route, 400, { code: 400, error_code: 'email_address_not_authorized', msg: 'Email address "iris@exemple.org" cannot be used as it is not authorized' }) : json(route, 200, {});
      if (u.pathname === '/auth/v1/user' && req.method() === 'PUT') {
        if (!['Bearer jeton-lien', 'Bearer jeton-frais'].includes(req.headers().authorization)) return json(route, 403, { code: 403, error_code: 'bad_jwt', msg: 'invalid JWT: token is expired' });
        const pw = JSON.parse(req.postData()).password;
        if (pw === 'ancien-mdp') return json(route, 422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' });
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
      if (req.method() === 'GET') return json(route, 200, []);
      return route.fulfill({ status: 201, body: '' });
    });
    if (session) await ctx.addInitScript(([s, uid]) => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } },
      [JSON.stringify({ access_token: 'jeton-garde', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: session, email: 'autre@exemple.org' } }), session]);
    await p.goto(BASE + '/index.html' + hash); await p.waitForTimeout(500);
    return p;
  };
  const note = async p => (await p.textContent('#authErr')).replace(/\s+/g, ' ');
  const submit = async p => { await p.click('#authForm button[type="submit"]'); await p.waitForTimeout(400); };

  console.log('les messages de l’écran de connexion');
  const p = await open();
  await p.fill('#authEmail', 'iris@exemple.org'); await p.fill('#authPw', 'mauvais-mdp'); await submit(p);
  ok((await note(p)).includes('Invalid login credentials'), 'une connexion refusée : le message reste affiché (il disparaissait au rendu suivant)');
  ok((await p.inputValue('#authEmail')) === 'iris@exemple.org', 'l’adresse tapée reste dans le champ');

  console.log('mot de passe oublié');
  await p.click('[data-act="auth-forgot"]'); await p.waitForTimeout(200);
  ok(!(await p.$('#authPw')) && (await p.inputValue('#authEmail')) === 'iris@exemple.org' && !(await note(p)), 'une adresse seulement, déjà remplie ; l’ancien message effacé');
  await submit(p);
  const rec = p.calls.find(c => c.path === '/auth/v1/recover');
  ok(rec && rec.method === 'POST' && JSON.parse(rec.body).email === 'iris@exemple.org' && rec.search === '?redirect_to=' + encodeURIComponent(BASE + '/index.html'), 'la demande part, avec le retour vers cette page');
  ok((await note(p)).includes('Si un compte existe à cette adresse'), 'la réponse ne dit pas si l’adresse a un compte');
  await p.click('[data-act="auth-back"]'); await p.waitForTimeout(200);
  ok(await p.isVisible('#authPw') && await p.isVisible('[data-act="auth-forgot"]'), 'revenir à la connexion');
  const t = await open('', { trop: true });
  await t.click('[data-act="auth-forgot"]'); await t.fill('#authEmail', 'iris@exemple.org'); await submit(t);
  ok((await note(t)).includes('Trop de demandes'), 'trop de demandes (429) : dit, en clair');
  const na = await open('', { nonAutorise: true });
  await na.click('[data-act="auth-forgot"]'); await na.fill('#authEmail', 'iris@exemple.org'); await submit(na);
  ok((await note(na)).includes('ne sait pas encore envoyer') && !(await note(na)).includes('not authorized'), 'envoi non configuré (SMTP intégré de Supabase) : dit, en français');

  console.log('inscriptions fermées');
  ok(p.calls.filter(c => c.path === '/auth/v1/settings').length === 1, 'les inscriptions sont demandées une fois au serveur');
  const f = await open('', { fermees: true });
  ok(!(await f.$('[data-act="auth-switch"]')) && (await f.textContent('#main')).includes('que sur invitation') && await f.isVisible('[data-act="auth-forgot"]'), 'fermées : plus de « Créer un compte », l’invitation est dite ; le mot de passe oublié reste');
  const s2 = await open();
  await s2.click('[data-act="auth-switch"]'); await s2.fill('#authEmail', 'nouvelle@exemple.org'); await s2.fill('#authPw', 'un-mot-de-passe'); await submit(s2);
  ok((await note(s2)).includes('Les inscriptions sont fermées') && !(await s2.$('[data-act="auth-switch"]')) && await s2.isVisible('[data-act="auth-forgot"]'), 'fermées entre-temps : le refus du serveur est traduit, et l’écran revient à la connexion');

  console.log('le lien de l’e-mail');
  const r = await open(lien('recovery'));
  ok(await r.isVisible('#authPw2') && (await r.textContent('#main')).includes('Choisis un nouveau mot de passe'), 'le lien ouvre le choix du nouveau mot de passe');
  ok(!(await r.evaluate(() => location.href)).includes('jeton-lien'), 'le jeton quitte aussitôt l’adresse');
  await r.fill('#authPw', 'nouveau-mdp'); await r.fill('#authPw2', 'nouveau-mdq'); await submit(r);
  ok((await note(r)).includes('ne sont pas identiques') && !r.calls.some(c => c.path === '/auth/v1/user'), 'deux saisies différentes : refusé avant tout envoi');
  await r.fill('#authPw', 'ancien-mdp'); await r.fill('#authPw2', 'ancien-mdp'); await submit(r);
  ok((await note(r)).includes('déjà ton mot de passe'), 'le même qu’avant : dit, en français');
  await r.fill('#authPw', 'nouveau-mdp'); await r.fill('#authPw2', 'nouveau-mdp'); await submit(r);
  const put = r.calls.filter(c => c.path === '/auth/v1/user').pop();
  ok(put && put.method === 'PUT' && put.auth === 'Bearer jeton-lien' && JSON.parse(put.body).password === 'nouveau-mdp', 'le mot de passe part, avec le jeton du lien');
  const s = JSON.parse(await storeGet(r, 'selene-auth-session') || '{}');
  ok(!(await r.$('#authForm')) && (await r.textContent('#toast')).includes('Mot de passe enregistré') && s.access_token === 'jeton-lien' && s.refresh_token === 'rafraichi' && s.user.id === UID, 'enregistré : connectée, la session est celle du lien');

  console.log('liens expirés ou fabriqués');
  const x = await open('#error=access_denied&error_code=otp_expired&error_description=Appelle+le+0600000000');
  ok((await note(x)).includes('Ce lien ne fonctionne plus') && !(await x.textContent('#main')).includes('0600000000') && !(await x.$('#authPw')), 'lien expiré : dit, sans reprendre le texte du lien, et propose d’en demander un autre');
  ok(!(await x.evaluate(() => location.href)).includes('error'), 'l’erreur quitte l’adresse');
  const e = await open(lien('recovery', 'jeton-perime'));
  await e.fill('#authPw', 'nouveau-mdp'); await e.fill('#authPw2', 'nouveau-mdp'); await submit(e);
  ok((await note(e)).includes('Ce lien ne fonctionne plus') && !(await e.$('#authPw')) && await e.isVisible('#authEmail'), 'jeton refusé par le serveur : retour à la demande d’un nouveau lien');
  const n = await open(lien('signup'));
  ok(!(await n.evaluate(() => location.href)).includes('jeton-lien') && !(await n.$('#authPw2')), 'un autre type de lien : le jeton est effacé de l’adresse, rien d’autre');

  console.log('invitation, appareil déjà connecté');
  const i = await open(lien('invite'));
  ok((await i.textContent('#main')).includes('Bienvenue. Choisis le mot de passe de ton compte.'), 'une invitation : choisir son mot de passe');
  await i.fill('#authPw', 'premier-mdp'); await i.fill('#authPw2', 'premier-mdp'); await submit(i);
  ok(!(await i.$('#authForm')), 'et entrer');
  const d = await open(lien('recovery'), { session: AUTRE });
  ok(await d.isVisible('#authPw2') && !d.calls.some(c => c.path === '/rest/v1/app_state'), 'déjà connectée à un autre compte : le lien passe d’abord, la session gardée attend');
  await d.click('[data-act="auth-back"]'); await d.waitForTimeout(500);
  ok(!(await d.$('#authForm')) && d.calls.some(c => c.path === '/rest/v1/app_state' && c.auth === 'Bearer jeton-garde'), 'annuler : la session gardée reprend');

  console.log('longueur minimale, mots de passe refusés');
  const m = await open();
  ok(!(await m.getAttribute('#authPw', 'minlength')), 'la connexion n’impose aucune longueur : un ancien mot de passe court entre toujours');
  await m.click('[data-act="auth-switch"]');
  ok((await m.getAttribute('#authPw', 'minlength')) === '10' && (await m.textContent('#authForm')).includes('10 caractères au moins'), 'à l’inscription : dix caractères au moins, et c’est écrit');
  const c = await open(lien('recovery'));
  await c.fill('#authPw', 'court'); await c.fill('#authPw2', 'court'); await submit(c);
  ok(!c.calls.some(x => x.path === '/auth/v1/user') && (await c.getAttribute('#authPw', 'minlength')) === '10', 'nouveau mot de passe trop court : refusé avant tout envoi');
  await c.fill('#authPw', 'mot-de-passe-fuite'); await c.fill('#authPw2', 'mot-de-passe-fuite'); await submit(c);
  ok((await note(c)).includes('fuites de données connues'), 'refusé par le serveur (weak_password, pwned) : la raison, en français');

  console.log('changer de mot de passe');
  const w = await open();
  await w.fill('#authEmail', 'iris@exemple.org'); await w.fill('#authPw', 'court1'); await submit(w);
  ok(!(await w.$('#authForm')) && (await w.textContent('#toast')).includes('plus court que ce que le serveur demande'), 'connexion avec un mot de passe devenu trop court : on entre, et Selene le dit');
  await w.evaluate(() => { location.hash = 'reglages'; }); await w.waitForTimeout(300);
  await w.evaluate(() => document.querySelectorAll('details').forEach(d => { if (d.id !== 'auth-delete') d.open = true; }));
  ok(await w.isVisible('#authPwForm') && (await w.textContent('#auth-pw')).includes('choisis-en un nouveau'), 'Réglages, Compte : le changement est proposé, ouvert');
  const change = async (cur, pw) => { await w.fill('#authCurPw', cur); await w.fill('#authNewPw', pw); await w.fill('#authNewPw2', pw); await w.click('#authPwForm button[type="submit"]'); await w.waitForTimeout(400); };
  await change('mauvais-mot-de-passe', 'une-phrase-de-saison');
  ok((await w.textContent('#toast')).includes("actuel n'est pas le bon") && !w.calls.some(x => x.path === '/auth/v1/user'), 'mot de passe actuel faux : rien ne change');
  await w.evaluate(() => document.querySelectorAll('details').forEach(d => { if (d.id !== 'auth-delete') d.open = true; }));
  await change('mot-de-passe-actuel', 'une-phrase-de-saison');
  const sent = w.calls.filter(x => x.path === '/auth/v1/user' && x.method === 'PUT').pop();
  const body = sent && JSON.parse(sent.body), saved = JSON.parse(await storeGet(w, 'selene-auth-session') || '{}');
  ok(sent && sent.auth === 'Bearer jeton-frais' && body.password === 'une-phrase-de-saison' && body.current_password === 'mot-de-passe-actuel', 'vérifié par une connexion fraîche, puis envoyé avec le mot de passe actuel');
  ok((await w.textContent('#toast')).includes('Mot de passe changé') && saved.access_token === 'jeton-frais' && !(await w.textContent('#auth-pw')).includes('choisis-en un nouveau'), 'changé : la session fraîche est gardée, l’avertissement disparaît');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
