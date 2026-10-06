/* Scénario de navigateur : le réseau fermé aux scénarios (BL-21 du cahier de recette ; A20). Une requête que ni les
   routes de Playwright ni le serveur des scénarios ne servent doit échouer, dans chaque moteur, y compris depuis une page
   tenue par le service worker : sous WebKit, celles-là échappent aux routes et partaient vers le vrai serveur (A20).
   La cible est une API publique en lecture seule, que la politique de sécurité d'index.html autorise : si la fermeture
   cédait, on n'y lirait qu'une prévision météo. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, check, ouvrir } = require('./helpers');
const DEHORS = 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m';
const ROUTEE = 'https://api.open-meteo.com/v1/sonde-bl21';
const essai = (p, u) => p.evaluate(async u => { try { return 'servie ' + (await fetch(u)).status; } catch (e) { return 'échoue : ' + e.message; } }, u);
(async () => {
  const b = await engine.launch({ ...launchOptions, proxy: undefined }), errs = []; // TEMPORAIRE : mutation BL-21, réseau ouvert
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); // service worker permis
  await ctx.route('https://*.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: r.request().method() === 'GET' ? '{"disable_signup":false}' : '{}' }));
  await ctx.route(ROUTEE, r => r.fulfill({ contentType: 'application/json', body: '{"routee":true}' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  try {
    await ouvrir(p, BASE + '/index.html#sans-compte');
    const dehors = await essai(p, DEHORS);
    check(dehors.startsWith('échoue'), `une requête que rien ne sert n'atteint aucun serveur (${dehors})`);
    const routee = await essai(p, ROUTEE);
    check(routee === 'servie 200', `une requête routée est servie, le serveur des scénarios aussi (${routee})`);

    const pret = await p.evaluate(() => navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]) : false);
    if (!pret) { console.log('  – pas de service worker dans ce moteur : rien de plus à vérifier'); }
    else {
      await ouvrir(p, null); // rechargée : la page est désormais tenue par le service worker
      check(await p.evaluate(() => !!navigator.serviceWorker.controller), 'le service worker tient la page');
      const tenue = await essai(p, DEHORS);
      check(tenue.startsWith('échoue'), `tenue par le service worker, non plus (${tenue})`);
    }
  } catch (e) { check(false, e.message.split('\n')[0]); }
  // L'échec voulu peut s'écrire à la console (WebKit : « … due to access control checks. », compté comme une erreur de
  // la page) : seuls les messages qui nomment la cible sont écartés, toute autre erreur compte.
  const autres = errs.filter(m => !m.includes('api.open-meteo.com/v1/forecast'));
  check(!autres.length, 'aucune erreur JavaScript' + (autres.length ? ' : ' + autres.join(' | ') : ''));
  await b.close();
})();
