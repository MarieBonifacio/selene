/* Scénario de navigateur : la taille d'un espace (docs/compte.md). Réglages → Sauvegarde dit ce qu'il pèse ; près de la
   limite, l'alerte nomme les modules les plus lourds ; un refus du serveur pour excès de taille (contrainte
   app_state_taille, code 23514) est dit en clair. Version hébergée simulée. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check, until, storeGet } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const open = async doc => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.patches = [];
    await ctx.route('https://*.supabase.co/**', r => {
      const req = r.request();
      if (req.method() === 'PATCH') {
        const n = Buffer.byteLength(req.postData() || ''); p.patches.push(n);
        // Le serveur, réduit : au-delà de 3 Mo, la contrainte de taille refuse l'écriture.
        if (n > 3e6) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '23514', message: 'new row for relation "app_state" violates check constraint "app_state_taille"' }) });
      }
      r.fulfill({ contentType: 'application/json', body: req.method() === 'GET' ? '[]' : req.method() === 'PATCH' ? `[{"user_id":"${UID}"}]` : '{}' });
    });
    await ctx.addInitScript(([d, s, uid]) => {
      if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
      localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
    }, [doc, session, UID]);
    await p.goto(BASE + '/index.html#reglages'); await p.waitForSelector('#reg-size', { timeout: 10000 }).catch(() => {});
    return p;
  };

  console.log('un espace ordinaire');
  const p = await open(fixture());
  const t = (await p.textContent('#reg-size')).replace(/\s+/g, ' '), stored = await storeGet(p, 'selene-site-v1');
  const ko = Math.max(1, Math.round(Buffer.byteLength(stored) / 1e3));
  ok(t.includes(`Ton espace pèse ${ko} Ko`) && t.includes('5,0 Mo au plus') && !t.includes('approche'), `sa taille, en octets UTF-8, et la limite (${t})`);

  console.log('près de la limite, puis au-delà');
  const demo = JSON.parse(fixture());
  demo.modules.inbox.entries.push({ id: 'lourd', text: '😀'.repeat(800000), date: '2026-09-01' }); // 3,2 Mo en UTF-8
  const g = await open(JSON.stringify(demo));
  const w = (await g.textContent('#reg-size')).replace(/\s+/g, ' ');
  ok(/Ton espace pèse 3,\d Mo/.test(w) && w.includes('approche de la limite') && w.includes(`${demo.modules.inbox.label} (3,2 Mo)`), `l'alerte nomme le module le plus lourd (${w.slice(0, 160)}…)`);
  ok(w.includes(`Exporte une sauvegarde, puis allège les plus lourds : ${demo.modules.inbox.label} (3,2 Mo)`), 'et conseille d’exporter une sauvegarde, puis d’alléger les plus lourds');
  await until(() => g.patches.length > 0); await g.waitForTimeout(400);
  ok((await g.textContent('#saving')).includes('Trop volumineux pour le serveur'), 'le serveur refuse : dit en clair, au lieu de « non synchronisé »');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
