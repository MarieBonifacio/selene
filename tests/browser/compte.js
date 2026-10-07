/* Scénario de navigateur : supprimer son compte depuis l'app (ADR 20, docs/compte.md). Faux Supabase, fausse fonction
   « compte » : rien ne part sans la confirmation tapée puis acceptée ; une panne laisse tout en place ; une réussite
   vide l'appareil (données, session) et ramène à l'écran de connexion. Avant cela, la politique de confidentialité
   suivie depuis les Réglages, en français puis en anglais (TRV-012). Lancé par tests/browser/run.js. */
const path = require('node:path');
const { fauxSupabase, engine, BASE, launchOptions, fixture, check, until, storeGet } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [], appels = [];
  let panne = true;
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await fauxSupabase(ctx, r => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname !== '/functions/v1/compte') return;
    appels.push({ corps: req.postDataJSON(), auth: req.headers().authorization });
    if (panne) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erreur: 'données non effacées ; réessaie' }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ supprime: true }) });
  });
  await ctx.addInitScript(([d, s, uid]) => {
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
    localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
  }, [fixture(), session, UID]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#reglages'); await p.waitForSelector('#auth-delete', { timeout: 10000 }).catch(() => {});

  console.log('garde-fous');
  ok(!!(await p.$('#auth-delete')), 'connecté : Réglages → Compte propose la suppression');
  ok(!!(await p.$('a[href$="confidentialite.html"]')), 'la politique de confidentialité est liée depuis les Réglages');

  // TRV-012 : le lien suivi, dans la langue de l'interface. Le site publié est servi depuis les fichiers du dépôt
  // (le réseau des scénarios est fermé) ; la page s'ouvre dans un nouvel onglet, dont on note les scripts demandés.
  await ctx.route('https://mariebonifacio.github.io/selene/*.html', r => r.fulfill({ path: path.join(__dirname, '..', '..', new URL(r.request().url()).pathname.split('/').pop()), contentType: 'text/html; charset=utf-8' }));
  const MOIS = [['janvier', 'January'], ['février', 'February'], ['mars', 'March'], ['avril', 'April'], ['mai', 'May'], ['juin', 'June'], ['juillet', 'July'], ['août', 'August'], ['septembre', 'September'], ['octobre', 'October'], ['novembre', 'November'], ['décembre', 'December']];
  const politique = async () => {
    // Le lien est dans « Supprimer mon compte », replié : le suivre sans le déplier, pour laisser la page comme elle était.
    const lien = await p.$eval('a[href*="mariebonifacio.github.io/selene/"]', a => ({ href: a.href, cible: a.target, rel: a.rel }));
    const [onglet] = await Promise.all([ctx.waitForEvent('page'), p.$eval('a[href*="mariebonifacio.github.io/selene/"]', a => a.click())]);
    const scripts = []; onglet.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
    await onglet.waitForLoadState('load');
    const lu = await onglet.evaluate(() => {
      const t = document.body.textContent.replace(/\s+/g, ' '), m = t.match(/(?:Dernière mise à jour :|Last updated:) (\d{1,2})(?:er)? (\p{L}+) (\d{4})/u);
      const h = [...document.querySelectorAll('h2')], duree = h.find(x => /^(Combien de temps|How long)$/.test(x.textContent.trim()));
      return { date: m ? [m[1], m[2], m[3]] : null, sections: h.length, durees: duree ? duree.nextElementSibling.textContent.replace(/\s+/g, ' ') : '', scripts: document.scripts.length };
    });
    const url = onglet.url(); await onglet.close(); return { lien, url, ...lu, demandes: scripts };
  };
  const fr = await politique();
  ok(fr.url.endsWith('/confidentialite.html') && fr.lien.cible === '_blank' && /noopener/.test(fr.lien.rel) && !!fr.date && fr.sections >= 12 && !fr.scripts && !fr.demandes.length
    && fr.durees.includes('une donnée effacée peut y subsister 30 jours au plus') && fr.durees.includes('Le journal des erreurs : 30 jours') && fr.durees.includes('La mesure d\'usage : 90 jours'),
    `interface en français : confidentialite.html dans un nouvel onglet, mise à jour le ${fr.date && fr.date.join(' ')}, ${fr.sections} sections, aucun script ; les sauvegardes « 30 jours au plus », le journal des erreurs 30 jours, la mesure d'usage 90 jours (TRV-012, étapes 1, 2 et 5)`);
  await p.selectOption('select[data-set="config.lang"]', 'en'); await p.waitForFunction(() => document.documentElement.lang === 'en');
  const en = await politique();
  const memeDate = !!(fr.date && en.date) && fr.date[0] === en.date[0] && fr.date[2] === en.date[2] && MOIS.findIndex(x => x[0] === fr.date[1]) === MOIS.findIndex(x => x[1] === en.date[1]) && MOIS.some(x => x[1] === en.date[1]);
  ok(en.url.endsWith('/privacy.html') && memeDate && en.sections === fr.sections && !en.scripts && !en.demandes.length && en.durees.includes('erased data may remain in them for 30 days at most'),
    `interface en anglais : ${en.url.split('/').pop()}, mise à jour le ${en.date && en.date.join(' ')}, la même date, ${en.sections} sections comme en français, aucun script (TRV-012, étape 4)`);
  await p.selectOption('select[data-set="config.lang"]', 'fr'); await p.waitForFunction(() => document.documentElement.lang === 'fr');
  await p.click('#auth-delete summary');
  await p.click('[data-act="auth-delete"]'); await p.waitForTimeout(200);
  ok(appels.length === 0 && !(await p.isVisible('#cdlg')), 'sans « supprimer » tapé : rien ne part');
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]');
  await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=cancel]'); await p.waitForTimeout(200);
  ok(appels.length === 0, 'annulé à la confirmation : rien ne part');

  console.log('panne du serveur');
  await p.click('[data-act="auth-delete"]'); await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=ok]');
  await until(() => appels.length === 1); await p.waitForTimeout(300);
  ok(appels[0] && appels[0].corps.action === 'supprimer' && appels[0].corps.confirmation === 'supprimer' && appels[0].auth === 'Bearer a', 'la demande part avec la session');
  ok((await p.textContent('#toast').catch(() => '')).includes('non supprimé') || (await p.textContent('body')).includes('non supprimé'), 'l’échec est dit');
  ok(await p.evaluate(() => !!localStorage.getItem('selene-auth-session')) && !!(await p.$('#auth-delete')), 'et rien n’est effacé de l’appareil');

  console.log('suppression');
  panne = false;
  await p.fill('#authDelIn', 'supprimer'); await p.click('[data-act="auth-delete"]');
  await p.waitForSelector('#cdlg[open]', { timeout: 3000 }).catch(() => {});
  await p.click('#cdlg button[value=ok]');
  await until(() => appels.length === 2);
  await p.waitForFunction(() => !localStorage.getItem('selene-auth-session'), null, { timeout: 5000 }).catch(() => {});
  ok(await p.evaluate(() => !localStorage.getItem('selene-auth-session')), 'la session est effacée');
  const site = await storeGet(p, 'selene-site-v1');
  ok(!site || !site.includes('iamamiwhoami'), 'les données du compte ont quitté l’appareil');
  ok(!(await p.$('#auth-delete')), 'plus de compte à supprimer');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
