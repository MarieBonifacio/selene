/* Scénario de navigateur : l'assistant hébergé (ADR 12, docs/assistant.md). Faux Supabase, fausse fonction
   « assistant » : la clé part une fois au serveur et ne revient jamais ; un échange passe par la fonction, jamais par
   api.anthropic.com ; une clé laissée dans l'appareil par une ancienne version est confiée au serveur puis effacée.
   Lancé par tests/browser/run.js. */
const { fauxSupabase, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666', CLE = 'sk-ant-api03-' + 'a'.repeat(40) + 'wxyz';
const demo = JSON.parse(fixture());
demo.config.modules = demo.config.modules.filter(m => m.id !== 'assistant').concat({ id: 'assistant', on: true });
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const open = async (ancienne = '') => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.fn = []; p.anthropic = 0; p.serveur = { cle: null };
    await ctx.route('https://api.anthropic.com/**', r => { p.anthropic++; r.abort(); });
    await fauxSupabase(ctx, r => {
      const req = r.request(), u = new URL(req.url());
      if (u.pathname !== '/functions/v1/assistant') return;
      const q = req.postDataJSON(); p.fn.push(q);
      const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
      if (q.action === 'etat') return json(p.serveur.cle ? { cle: true, indice: '…' + p.serveur.cle.slice(-4) } : { cle: false });
      if (q.action === 'cle') { if (!/^sk-ant-/.test(q.cle)) return json({ erreur: "ce n'est pas une clé d'API Anthropic (sk-ant-…)" }, 400); if (q.cle.includes('RECETTE-fausse')) return json({ erreur: 'Anthropic refuse cette clé' }, 400); p.serveur.cle = q.cle; return json({ cle: true, indice: '…' + q.cle.slice(-4) }); }
      if (q.action === 'oublier') { p.serveur.cle = null; return json({ cle: false }); }
      if (q.action === 'message') return json({ id: 'm', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Bonsoir, lucidement.' }], stop_reason: 'end_turn' });
      return json({ erreur: 'action inconnue' }, 400);
    });
    await ctx.addInitScript(([d, s, uid, k]) => {
      if (localStorage.getItem('selene-site-v1')) return;
      localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
      if (k) localStorage.setItem('selene-api-key', k);
    }, [JSON.stringify(demo), session, UID, ancienne]);
    await p.goto(BASE + '/index.html#reglages'); await p.waitForSelector('#assistant-cfg', { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(300);
    return p;
  };

  console.log('la clé, confiée au serveur');
  const p = await open();
  ok(p.fn.some(q => q.action === 'etat'), 'l’état de la clé est demandé au serveur');
  // AST-001, étapes 1 à 3 : ce que devient la clé, le champ, et deux clés refusées (le refus du serveur, dit tel quel).
  const cfg = async () => (await p.textContent('#assistant-cfg')).replace(/\s+/g, ' '), cle = '[data-act="as-key"]';
  ok((await cfg()).includes('Dans la version hébergée, il faut ta propre clé API') && (await cfg()).includes('ne revient jamais dans la page')
    && (await p.getAttribute(cle, 'type')) === 'password' && (await p.inputValue(cle)) === '' && (await p.getAttribute(cle, 'placeholder')) === 'sk-ant-…' && !(await p.$('[data-act="as-forget"]')),
    'avant toute clé : ce qu’elle devient, un champ masqué et vide, pas de bouton « Oublier »');
  const bulle = t => p.waitForFunction(x => ((document.querySelector('#toast') || {}).textContent || '').includes(x), t, { timeout: 5000 }).then(() => true, () => false);
  for (const [v, attendu, quoi] of [['pas-une-cle', "Clé non enregistrée : ce n'est pas une clé d'API Anthropic (sk-ant-…)", 'pas une clé'], ['sk-ant-api03-RECETTE-fausse-cle-0000000000', 'Clé non enregistrée : Anthropic refuse cette clé', 'une clé qu’Anthropic refuse']]) {
    await p.fill(cle, v); await p.press(cle, 'Tab');
    ok(await bulle(attendu) && (await p.inputValue(cle)) === '' && p.serveur.cle === null, `${quoi} : le champ se vide, « ${attendu} »`);
  }
  await p.fill(cle, CLE); await p.press(cle, 'Tab'); await p.waitForTimeout(400);
  const envoi = p.fn.find(q => q.action === 'cle' && q.cle === CLE);
  ok(envoi && envoi.cle === CLE, 'la clé part une fois vers la fonction');
  ok((await p.inputValue('[data-act="as-key"]')) === '' && (await p.textContent('#assistant-cfg')).includes('…wxyz'), 'la page n’en garde que l’indice');
  ok(await bulle('Clé vérifiée et enregistrée.') && (await cfg()).includes('Clé API Anthropic (enregistrée : …wxyz)') && (await p.getAttribute(cle, 'placeholder')) === 'Coller une autre clé pour la remplacer' && !!(await p.$('[data-act="as-forget"]')),
    '« Clé vérifiée et enregistrée. », le libellé dit l’indice, le champ propose de la remplacer, « Oublier » apparaît');
  ok(await p.evaluate(k => !Object.values(localStorage).some(v => v.includes(k)), CLE), 'rien dans localStorage');
  const dansIdb = await p.evaluate(k => new Promise(res => { const r = indexedDB.open('selene'); r.onerror = () => res('illisible'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) { db.close(); return res('vide'); } const q = db.transaction('kv').objectStore('kv').getAll(); q.onsuccess = () => { db.close(); res(q.result.some(v => String(v).includes(k)) ? 'trouvée' : 'absente'); }; }; }), CLE);
  ok(dansIdb === 'absente' || dansIdb === 'vide', `ni dans IndexedDB (${dansIdb})`);

  console.log('un échange');
  await p.evaluate(() => location.hash = 'assistant'); await p.waitForTimeout(300);
  await p.fill('#chatIn', 'Bonsoir ?'); await p.click('[data-act="chat-send"]'); await p.waitForTimeout(600);
  const m = p.fn.find(q => q.action === 'message');
  ok(m && m.requete.messages.at(-1).content === 'Bonsoir ?' && m.requete.max_tokens === 1500 && !('x-api-key' in m), 'la question part vers la fonction, sans clé');
  ok((await p.textContent('.chat')).includes('Bonsoir, lucidement.'), 'la réponse s’affiche');
  ok(p.anthropic === 0, 'la page n’a jamais appelé api.anthropic.com');

  console.log('un nouvel espace, partagé puis gardé privé (ESP-010)');
  const vers = async (h, sel) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForSelector(sel, { state: 'attached' }); };
  await vers('reglages', '#newModType'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await p.selectOption('#newModType', 'notes'); await p.fill('#newModName', 'Journal privé ESP-010'); await p.click('[data-act="mod-add"]');
  await p.waitForFunction(() => [...document.querySelectorAll('#nav a')].some(a => a.textContent.includes('Journal privé ESP-010')), null, { timeout: 5000 }).catch(() => {});
  const jid = await p.evaluate(() => { const a = [...document.querySelectorAll('#nav a')].find(x => x.textContent.includes('Journal privé ESP-010')); return a ? a.getAttribute('href').slice(1) : ''; });
  await vers(jid, '#noteIn'); await p.fill('#noteIn', 'mot-témoin-ESP010'); await p.click('[data-act="note-add"]');
  await p.waitForFunction(() => document.querySelector('#main').textContent.includes('mot-témoin-ESP010'), null, { timeout: 5000 }).catch(() => {});
  ok(!!jid && (await p.textContent('#main')).includes('mot-témoin-ESP010'), `« Journal privé ESP-010 » dans la navigation, la note affichée dans l’espace (étape 1)`);
  const partage = async () => { await vers('reglages', `[data-act="as-share"][data-k="${jid}"]`); return p.$eval(`[data-act="as-share"][data-k="${jid}"]`, c => c.checked); };
  ok(await partage(), '« Ce que Claude peut lire » : le nouvel espace est coché d’office (étape 2)');
  // Ce que reçoit la fonction, l'espace encore partagé : le mot-témoin y est, la sonde le voit.
  const demander = async () => {
    const n = p.fn.length; await vers('assistant', '#chatIn');
    await p.fill('#chatIn', 'Cite le mot-témoin de mon journal privé.'); await p.click('[data-act="chat-send"]');
    for (let i = 0; i < 100 && !p.fn.slice(n).some(q => q.action === 'message'); i++) await p.waitForTimeout(50);
    return JSON.stringify(p.fn.slice(n).find(q => q.action === 'message') || null);
  };
  const avant = await demander();
  ok(avant.includes('mot-témoin-ESP010'), 'partagé : le mot-témoin part bien avec la question (la sonde le voit)');
  await partage(); await p.uncheck(`[data-act="as-share"][data-k="${jid}"]`);
  // Décoché, relu après un détour : l'état vient du réglage enregistré, pas de la case restée sous le doigt.
  await vers('accueil', '#nav a'); const decoche = !(await partage());
  await vers('assistant', '#main .status');
  const entete = (await p.textContent('#main .status')).replace(/\s+/g, ' ');
  ok(decoche && entete.includes('Données partagées') && !entete.includes('Journal privé ESP-010'), `décoché ; l’en-tête de l’assistant n’en parle plus (« ${entete.slice(entete.indexOf('Données partagées'), entete.indexOf('Données partagées') + 90)}… ») (étape 3)`);
  const apres = await demander();
  ok(apres !== 'null' && !apres.includes('mot-témoin-ESP010') && !apres.includes('Journal privé ESP-010'), 'la même question : ni le mot-témoin ni l’espace ne partent vers l’assistant (étape 4)');

  console.log('oublier');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForTimeout(300);
  await p.click('[data-act="as-forget"]'); await p.waitForTimeout(400);
  ok(p.serveur.cle === null && !(await p.isVisible('[data-act="as-forget"]')), 'la clé est effacée du serveur');

  console.log('une ancienne clé locale');
  const q = await open(CLE); await q.waitForTimeout(300);
  ok(q.fn.some(x => x.action === 'cle' && x.cle === CLE) && !q.fn.some(x => x.action === 'etat'), 'confiée au serveur au lancement');
  ok(await q.evaluate(() => localStorage.getItem('selene-api-key') === null), 'puis effacée de l’appareil');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
