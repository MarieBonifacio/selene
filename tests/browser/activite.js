/* Scénario de navigateur : la mesure d'usage de la bêta (services/activite.js, E4 de l'audit). Version hébergée, un
   faux Supabase. Ouvrir ne compte pas ; une capture, si : un jour, avec la session, rien d'autre ; une seconde capture
   le même jour, non ; l'interrupteur de Réglages → Compte la coupe. Rien n'est écrit sur l'appareil pour elle. Lancé
   par tests/browser/run.js. */
const { engine, BASE, launchOptions, check, until } = require('./helpers');
const session = JSON.stringify({ access_token: 'jeton-a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'iris@exemple.org' } });
(async () => {
  const b = await engine.launch(launchOptions), errs = [], recus = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(s => { if (!localStorage.getItem('selene-auth-session')) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); } }, session);
  const lignes = new Map();
  await ctx.route('https://*.supabase.co/**', route => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/rest/v1/activite') { recus.push({ corps: req.postDataJSON(), auth: req.headers().authorization }); return route.fulfill({ status: 201, body: '' }); }
    if (u.pathname.startsWith('/auth/')) return json(200, {});
    if (u.pathname === '/rest/v1/app_state') {
      const sel = u.searchParams.get('select') || '', ligne = lignes.get('u1');
      if (m === 'GET') { const d = sel.match(/^u:(\w+)->>updatedAt$/); return json(200, ligne ? [d ? { u: ligne[d[1]] && ligne[d[1]].updatedAt != null ? String(ligne[d[1]].updatedAt) : null } : { [sel]: ligne[sel] }] : []); }
      if (m === 'POST') { if (!ligne) lignes.set('u1', { board: {}, site: {} }); return route.fulfill({ status: 201, body: '' }); }
      if (m === 'PATCH') {
        if (!ligne) return json(200, []);
        for (const [k, g] of u.searchParams) if (k.includes('->>')) { const [c, f] = k.split('->>'), cur = ligne[c] && ligne[c][f]; if (!(g === 'is.null' ? cur == null : cur != null && String(cur) === g.slice(3))) return json(200, []); }
        Object.assign(ligne, req.postDataJSON()); return json(200, [{ user_id: 'u1' }]);
      }
    }
    return json(200, []);
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  // Les requêtes vers le faux Supabase encore en vol. Un rechargement en coupe une, et WebKit le signale comme une
  // erreur de la page (« due to access control checks »), qui n'en est pas une de Selene : la synchronisation
  // intercepte ses échecs. waitForLoadState('networkidle') n'y suffit pas : une page déjà chargée l'a atteint, et
  // l'attente rend la main tout de suite. On attend donc 1,2 s sans aucune requête, plus que les 900 ms après
  // lesquelles un enregistrement part au serveur.
  let enVol = 0;
  const vers = r => r.url().includes('.supabase.co/');
  p.on('request', r => { if (vers(r)) enVol++; });
  for (const ev of ['requestfinished', 'requestfailed']) p.on(ev, r => { if (vers(r)) enVol--; });
  const auCalme = async () => { for (let calme = 0, t = 0; calme < 12 && t < 100; t++) { await p.waitForTimeout(100); calme = enVol ? 0 : calme + 1; } };
  try {
    await p.goto(BASE + '/index.html'); await p.waitForSelector('#capIn'); await until(() => !!lignes.get('u1')?.site?.config); await p.waitForTimeout(500);
    check(!recus.length, 'ouvrir Selene ne compte pas');
    // TRV-011, étape 1 : rechargée, la palette changée, un espace vide créé depuis un type. Des gestes, et des
    // enregistrements, mais aucun contenu : rien ne part.
    await auCalme(); await p.reload(); await p.waitForSelector('#capIn');
    await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('[data-act="pal"][data-p="rubedo"]');
    await p.click('[data-act="pal"][data-p="rubedo"]'); await auCalme();
    const palette = await p.$eval('[data-act="pal"][data-p="rubedo"]', el => el.classList.contains('on'));
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    await p.selectOption('#newModType', 'notes'); await p.fill('#newModName', 'Vide TRV-011'); await p.click('[data-act="mod-add"]');
    await p.waitForFunction(() => [...document.querySelectorAll('#nav a')].some(a => a.textContent.includes('Vide TRV-011')), null, { timeout: 5000 }).catch(() => {});
    const vide = await p.evaluate(() => [...document.querySelectorAll('#nav a')].some(a => a.textContent.includes('Vide TRV-011'))); await auCalme();
    check(palette && vide && !recus.length, 'rechargée, la palette changée, un espace vide créé : aucune requête vers activite (TRV-011, étape 1)');
    await p.evaluate(() => { location.hash = 'accueil'; }); await p.waitForSelector('#capIn');
    await p.fill('#capIn', 'CONFIDENTIEL_JOUR'); await p.click('[data-act="cap-add"]');
    await until(() => recus.length > 0, 5000);
    check(recus.length === 1 && Object.keys(recus[0].corps).join() === 'jour' && /^\d{4}-\d{2}-\d{2}$/.test(recus[0].corps.jour), 'une capture : un jour, rien d’autre');
    check(recus[0] && recus[0].auth === 'Bearer jeton-a' && !JSON.stringify(recus).includes('CONFIDENTIEL'), 'avec la session, sans ce qui est écrit');
    await p.fill('#capIn', 'une autre'); await p.click('[data-act="cap-add"]'); await p.waitForTimeout(600);
    check(recus.length === 1, 'le même jour : une fois');
    // Étape 4 : localStorage, sessionStorage et chaque magasin de chaque base IndexedDB (le stockage de la version
    // hébergée). Ni une clé qui nomme la mesure, ni une valeur qui ne serait que le jour compté. Seule exception, et
    // nommée : « selene-hero-day », le jour où l'accueil a montré son grand en-tête, écrit à chaque chargement, mesure
    // ou non (views/accueil.js).
    const traces = await p.evaluate(async jour => {
      const out = [], vu = (ou, k, v) => { if (k === 'selene-hero-day') return; if (/activ|usage|mesure/i.test(String(k)) || String(k).includes(jour) || v === jour || v === JSON.stringify({ jour })) out.push(ou + ' ' + k); };
      for (const [nom, st] of [['localStorage', localStorage], ['sessionStorage', sessionStorage]]) for (let i = 0; i < st.length; i++) vu(nom, st.key(i), st.getItem(st.key(i)));
      const bases = indexedDB.databases ? await indexedDB.databases() : [{ name: 'selene' }];
      for (const { name } of bases) await new Promise(res => {
        const r = indexedDB.open(name); r.onupgradeneeded = () => r.transaction.abort(); r.onerror = () => res();
        r.onsuccess = () => {
          const db = r.result, magasins = [...db.objectStoreNames]; if (!magasins.length) { db.close(); return res(); }
          const t = db.transaction(magasins, 'readonly');
          for (const m of magasins) { const c = t.objectStore(m).openCursor(); c.onsuccess = () => { const k = c.result; if (k) { vu(name + '/' + m, k.key, k.value); k.continue(); } }; }
          t.oncomplete = () => { db.close(); res(); }; t.onerror = () => { db.close(); res(); };
        };
      });
      out.push('bases : ' + bases.length);
      return out;
    }, recus[0].corps.jour);
    const bases = traces.pop();
    check(!traces.length && bases !== 'bases : 0', 'rien sur l’appareil pour la mesure, IndexedDB compris (' + bases + ')' + (traces.length ? ' : ' + traces.join(', ') : ''));

    console.log('coupée depuis les Réglages');
    await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('[data-act="activity"]');
    check(await p.isChecked('[data-act="activity"]') && (await p.textContent('#main')).includes('Compter mes jours d\'usage'), 'Réglages → Compte : l’interrupteur, allumé, et ce qu’il compte');
    await p.uncheck('[data-act="activity"]');
    await p.evaluate(() => { location.hash = 'accueil'; }); await auCalme();
    await p.reload(); await p.waitForSelector('#capIn'); await p.waitForTimeout(300);
    await p.fill('#capIn', 'coupée'); await p.click('[data-act="cap-add"]'); await p.waitForTimeout(800);
    check(recus.length === 1, 'coupée : plus rien, même après un rechargement');
    await p.evaluate(() => { location.hash = 'reglages'; }); await p.waitForSelector('[data-act="activity"]');
    check(!(await p.isChecked('[data-act="activity"]')), 'rechargée, la case reste décochée (TRV-011, étape 5)');
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
