/* Scénario de navigateur : le réseau fermé aux scénarios (BL-21 du cahier de recette ; A20). Une requête que ni les
   routes de Playwright ni le serveur des scénarios ne servent doit échouer, dans chaque moteur, y compris depuis une page
   tenue par le service worker : sous WebKit, celles-là échappent aux routes et partaient vers le vrai serveur (A20).
   La cible est une API publique en lecture seule, que la politique de sécurité d'index.html autorise : si la fermeture
   cédait, on n'y lirait qu'une prévision météo. Deux temps : service worker bloqué, pour comparer une requête routée à
   une requête qui ne l'est pas (sous Firefox et WebKit, une requête vers un autre hôte passe par le service worker, que
   les routes n'atteignent pas : mutation du 6 octobre 2026) ; puis permis, la page tenue par lui. Lancé par
   tests/browser/run.js. */
const { engine, BASE, launchOptions, check, ouvrir } = require('./helpers');
const DEHORS = 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m';
const ROUTEE = 'https://api.open-meteo.com/v1/sonde-bl21';
const essai = (p, u) => p.evaluate(async u => { try { return 'servie ' + (await fetch(u)).status; } catch (e) { return 'échoue : ' + e.message; } }, u);
const supabase = r => r.fulfill({ contentType: 'application/json', body: r.request().method() === 'GET' ? '{"disable_signup":false}' : '{}' });
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  try {
    console.log('service worker bloqué');
    const sans = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await sans.route('https://*.supabase.co/**', supabase);
    await sans.route(ROUTEE, r => r.fulfill({ contentType: 'application/json', body: '{"routee":true}' }));
    const p = await sans.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ouvrir(p, BASE + '/index.html#sans-compte');
    const dehors = await essai(p, DEHORS);
    check(dehors.startsWith('échoue'), `une requête que rien ne sert n'atteint aucun serveur (${dehors})`);
    const routee = await essai(p, ROUTEE);
    check(routee === 'servie 200', `une requête routée est servie, le serveur des scénarios aussi (${routee})`);

    console.log('service worker permis');
    const avec = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await avec.route('https://*.supabase.co/**', supabase);
    const q = await avec.newPage(); q.on('pageerror', e => errs.push(e.message));
    await ouvrir(q, BASE + '/index.html#sans-compte');
    const pret = await q.evaluate(() => navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 10000))]) : false);
    if (!pret) console.log('  – pas de service worker dans ce moteur : rien de plus à vérifier');
    else {
      await ouvrir(q, null); // rechargée : la page est désormais tenue par le service worker
      check(await q.evaluate(() => !!navigator.serviceWorker.controller), 'le service worker tient la page');
      const tenue = await essai(q, DEHORS);
      check(tenue.startsWith('échoue'), `tenue par le service worker, non plus (${tenue})`);
    }
  } catch (e) { check(false, e.message.split('\n')[0]); }
  // L'échec voulu peut s'écrire à la console (WebKit : « … due to access control checks. », compté comme une erreur de
  // la page) : seuls les messages qui nomment la cible sont écartés, toute autre erreur compte.
  const autres = errs.filter(m => !m.includes('api.open-meteo.com/v1/forecast'));
  check(!autres.length, 'aucune erreur JavaScript' + (autres.length ? ' : ' + autres.join(' | ') : ''));
  await b.close();
})();
