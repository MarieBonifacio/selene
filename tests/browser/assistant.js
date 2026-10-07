/* Scénario de navigateur : l'assistant hébergé (ADR 12, docs/assistant.md). Faux Supabase, fausse fonction
   « assistant » : la clé part une fois au serveur et ne revient jamais ; un échange passe par la fonction, jamais par
   api.anthropic.com ; « Oublier la clé » vaut pour tous les appareils du compte (AST-006) ; une clé laissée dans
   l'appareil par une ancienne version est confiée au serveur puis effacée.
   Lancé par tests/browser/run.js. */
const { fauxSupabase, storeJSON, donnee, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666', CLE = 'sk-ant-api03-' + 'a'.repeat(40) + 'wxyz';
const demo = JSON.parse(fixture());
demo.config.modules = demo.config.modules.filter(m => m.id !== 'assistant').concat({ id: 'assistant', on: true });
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  // `donnees`, `plateau` : un autre jeu que la démo (le jeu d'essai du cahier) ; `cle` : une clé déjà confiée au serveur.
  const open = async (ancienne = '', donnees = demo, plateau = null, cle = null) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.fn = []; p.anthropic = 0; p.serveur = { cle };
    await ctx.route('https://api.anthropic.com/**', r => { p.anthropic++; r.abort(); });
    await fauxSupabase(ctx, r => {
      const req = r.request(), u = new URL(req.url());
      if (u.pathname !== '/functions/v1/assistant') return;
      const q = req.postDataJSON(); p.fn.push(q);
      const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
      if (q.action === 'etat') return json(p.serveur.cle ? { cle: true, indice: '…' + p.serveur.cle.slice(-4) } : { cle: false });
      if (q.action === 'cle') { if (!/^sk-ant-/.test(q.cle)) return json({ erreur: "ce n'est pas une clé d'API Anthropic (sk-ant-…)" }, 400); if (q.cle.includes('RECETTE-fausse')) return json({ erreur: 'Anthropic refuse cette clé' }, 400); p.serveur.cle = q.cle; return json({ cle: true, indice: '…' + q.cle.slice(-4) }); }
      if (q.action === 'oublier') { p.serveur.cle = null; return json({ cle: false }); }
      if (q.action === 'message') return (async () => {
        if (p.retenir) await p.retenir; // AST-002, étape 2 : la réponse retenue, le temps de lire l'attente
        // Comme la vraie fonction : sans clé enregistrée pour le compte, un refus 409 au code « sans-cle » (AST-006).
        if (!p.serveur.cle) return json({ erreur: 'aucune clé enregistrée pour ce compte', code: 'sans-cle' }, 409);
        // Un modèle qui tente d'écrire même quand on ne lui offre aucun outil : l'app doit refuser à l'exécution (AST-005).
        const der = q.requete.messages.at(-1), dit = (b, stop = 'end_turn') => json({ id: 'm', type: 'message', role: 'assistant', content: b, stop_reason: stop });
        if (Array.isArray(der.content)) return dit([{ type: 'text', text: 'Résultat : ' + der.content.map(c => c.content).join(' | ') }]);
        if (/Fixer la tringle/.test(der.content)) return dit([{ type: 'tool_use', id: 'tu1', name: 'ajouter_tache', input: { titre: 'Fixer la tringle' } }], 'tool_use');
        if (/dépense de 9 €/.test(der.content)) return dit([{ type: 'tool_use', id: 'tu2', name: 'ajouter_operation', input: { montant: 9, type: 'dépense', enveloppe: 'Courses' } }], 'tool_use');
        return dit([{ type: 'text', text: 'Bonsoir, lucidement.' }]);
      })();
      return json({ erreur: 'action inconnue' }, 400);
    });
    await ctx.addInitScript(([d, bd, s, uid, k]) => {
      // Chaque fenêtre modale ouverte (une demande d'accord, une confirmation) est relevée.
      const montrer = HTMLDialogElement.prototype.showModal; window.__modales = [];
      HTMLDialogElement.prototype.showModal = function () { window.__modales.push(this.id + ':' + ((this.querySelector('#cmsg') || {}).textContent || '')); return montrer.call(this); };
      if (localStorage.getItem('selene-site-v1')) return;
      localStorage.setItem('selene-site-v1', d); if (bd) localStorage.setItem('selene-board-v1', bd);
      localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid);
      if (k) localStorage.setItem('selene-api-key', k);
    }, [JSON.stringify(donnees), plateau ? JSON.stringify(plateau) : '', session, UID, ancienne]);
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
  // AST-002, étape 1 : le modèle choisi dans les Réglages, puis l'en-tête de l'Assistant et ses suggestions.
  await p.selectOption('[data-act="as-model"]', 'claude-haiku-4-5-20251001');
  await p.evaluate(() => location.hash = 'assistant'); await p.waitForSelector('#chatIn');
  const tete = (await p.textContent('#main .status')).replace(/\s+/g, ' ').trim(), puces = await p.$$eval('[data-act="chat-chip"]', bs => bs.map(x => x.textContent.trim()));
  ok(tete.startsWith('Branché via ta clé API, modèle claude-haiku-4-5-20251001. Chaque échange est facturé sur ton compte.') && /Données partagées : .+\. Peut agir sur le tableau de bord\.$/.test(tete)
    && puces.includes('Qu\'est-ce que je fais aujourd\'hui ?') && puces.some(x => x.startsWith('Fais le point sur ')),
    `Haiku 4.5 choisi : « ${tete.slice(0, 110)}… » ; les suggestions « ${puces.slice(0, 2).join(' », « ')} » (AST-002, étape 1)`);
  // Étape 2 : la réponse retenue, l'attente se lit : la question affichée, « … », « Envoyer » désactivé.
  let lacher; p.retenir = new Promise(r => { lacher = r; });
  await p.fill('#chatIn', 'Bonsoir ?'); await p.click('[data-act="chat-send"]');
  await p.waitForSelector('#pending', { timeout: 5000 }).catch(() => {});
  const attente = await p.evaluate(() => ({ question: [...document.querySelectorAll('.chat .msg.user')].some(x => x.textContent === 'Bonsoir ?'), points: (document.querySelector('#pending') || {}).textContent, bouton: document.querySelector('[data-act="chat-send"]').disabled }));
  lacher(); p.retenir = null;
  ok(attente.question && attente.points === '…' && attente.bouton, `pendant l’attente : la question affichée, « ${attente.points} », « Envoyer » désactivé (étape 2)`);
  await p.waitForFunction(() => document.querySelector('.chat').textContent.includes('Bonsoir, lucidement.'), null, { timeout: 5000 }).catch(() => {});
  const m = p.fn.find(q => q.action === 'message');
  ok(m && m.requete.messages.at(-1).content === 'Bonsoir ?' && m.requete.max_tokens === 1500 && m.requete.model === 'claude-haiku-4-5-20251001' && !('x-api-key' in m), 'la question part vers la fonction, sans clé, le modèle choisi (claude-haiku-4-5-20251001)');
  ok((await p.textContent('.chat')).includes('Bonsoir, lucidement.') && !(await p.$('#pending')) && !(await p.$eval('[data-act="chat-send"]', b => b.disabled)), 'la réponse s’affiche, l’attente finie');
  // Étape 5 : rechargée, la conversation est toujours là, et les suggestions ne reviennent pas.
  await p.reload(); await p.evaluate(() => location.hash = 'assistant'); await p.waitForSelector('#chatIn');
  await p.waitForFunction(() => document.querySelector('.chat').textContent.includes('Bonsoir, lucidement.'), null, { timeout: 5000 }).catch(() => {});
  const relue = await p.evaluate(() => ({ q: [...document.querySelectorAll('.chat .msg.user')].map(x => x.textContent), r: document.querySelector('.chat').textContent.includes('Bonsoir, lucidement.'), puces: document.querySelectorAll('[data-act="chat-chip"]').length }));
  ok(relue.q.includes('Bonsoir ?') && relue.r && !relue.puces, 'rechargée : la question et la réponse toujours là, plus de suggestions (étape 5)');
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

  console.log('oublier (AST-006)');
  // L'appareil B : le même compte, ouvert sur l'Assistant pendant que A oublie la clé. Les deux pages partagent le
  // même faux serveur, comme deux appareils le même compte.
  const B = await open('', demo, null, CLE); B.serveur = p.serveur;
  await B.evaluate(() => location.hash = 'assistant'); await B.waitForFunction(() => !!document.querySelector('#chatIn') && !document.querySelector('#chatIn').disabled, null, { timeout: 5000 }).catch(() => {});
  const statut = async x => (await x.textContent('#main .status')).replace(/\s+/g, ' ').trim();
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForSelector('[data-act="as-forget"]');
  await p.evaluate(() => { document.querySelector('#toast').textContent = ''; });
  await p.click('[data-act="as-forget"]'); const dit6 = await bulle('Clé effacée du serveur.');
  await p.waitForFunction(() => !document.querySelector('[data-act="as-forget"]'), null, { timeout: 5000 }).catch(() => {});
  ok(dit6 && p.serveur.cle === null && !(await p.$('[data-act="as-forget"]')) && (await cfg()).includes('Clé API Anthropic') && !(await cfg()).includes('enregistrée : …') && (await p.getAttribute(cle, 'placeholder')) === 'sk-ant-…',
    '« Oublier la clé » : « Clé effacée du serveur. », la clé effacée du serveur ; le libellé redevient « Clé API Anthropic », l’indication « sk-ant-… », le bouton disparaît (AST-006, étape 1)');
  await p.evaluate(() => location.hash = 'assistant'); await p.waitForSelector('#chatIn');
  ok((await statut(p)).startsWith('Pas encore branché. Colle ta clé API dans Réglages.') && await p.isDisabled('#chatIn'), `A, l’Assistant : « ${(await statut(p)).slice(0, 51)} », la zone « Écris à Claude… » désactivée (étape 2)`);
  const avantB = await B.isDisabled('#chatIn');
  await B.fill('#chatIn', 'Bonjour ?'); await B.evaluate(() => { document.querySelector('#toast').textContent = ''; }); await B.click('[data-act="chat-send"]');
  await B.waitForFunction(() => /aucune clé enregistrée pour ce compte/.test(document.body.textContent), null, { timeout: 5000 }).catch(() => {});
  await B.waitForFunction(() => document.querySelector('#chatIn') && document.querySelector('#chatIn').disabled, null, { timeout: 5000 }).catch(() => {});
  const vuB = (await B.textContent('.chat')).replace(/\s+/g, ' '), ditB = (await B.textContent('body')).includes('aucune clé enregistrée pour ce compte');
  ok(!avantB && vuB.includes('Bonjour ?') && ditB && (await statut(B)).startsWith('Pas encore branché') && await B.isDisabled('#chatIn'),
    `B, resté ouvert : « Bonjour ? » affiché, « aucune clé enregistrée pour ce compte » ; l’en-tête « ${(await statut(B)).slice(0, 30)}… », la zone désactivée (étape 3)`);
  await B.reload(); await B.waitForSelector('#main .status');
  await B.waitForFunction(() => document.querySelector('#main .status').textContent.includes('Pas encore branché'), null, { timeout: 5000 }).catch(() => {});
  ok((await statut(B)).startsWith('Pas encore branché') && await B.isDisabled('#chatIn'), `B rechargé : « ${(await statut(B)).slice(0, 30)}… » dès l’ouverture (étape 4)`);
  await B.context().close();

  console.log('une ancienne clé locale');
  const q = await open(CLE); await q.waitForTimeout(300);
  ok(q.fn.some(x => x.action === 'cle' && x.cle === CLE) && !q.fn.some(x => x.action === 'etat'), 'confiée au serveur au lancement');
  ok(await q.evaluate(() => localStorage.getItem('selene-api-key') === null), 'puis effacée de l’appareil');

  console.log('le jeu d’essai : ce que Claude peut lire (AST-003)');
  const essai = donnee('jeu-essai.json');
  essai.site.config.modules.find(m => m.id === 'assistant').on = true; // le jeu l'a éteint ; AST-001 l'allume
  const e = await open('', essai.site, essai.board, CLE);
  const aller = async (h, sel) => { await e.evaluate(x => { location.hash = x; }, h); await e.waitForSelector(sel, { state: 'attached' }); };
  // Une question envoyée, et ce qui est parti vers la fonction : toutes les requêtes « message » de l'échange.
  const demande = async texte => {
    const n = e.fn.length; await aller('assistant', '#chatIn');
    await e.fill('#chatIn', texte); await e.click('[data-act="chat-send"]');
    await e.waitForFunction(() => !document.querySelector('#pending'), null, { timeout: 10000 }).catch(() => {});
    return e.fn.slice(n).filter(x => x.action === 'message');
  };
  // Les montants s'écrivent avec une espace fine insécable avant « € » : la ramener à une espace, sans quoi « 300,00 € » ne se trouverait jamais.
  const plat = x => String(x).replace(/[\u00a0\u202f]/g, ' ');
  const enTete = async () => { await aller('assistant', '#main .status'); return (await e.textContent('#main .status')).replace(/\s+/g, ' ').trim(); };
  // Lu d'un seul tenant dans la page : entre une poignée et sa lecture, un rendu peut remplacer la case.
  const lisible = async k => { await aller('reglages', '[data-act="as-actions"]'); return e.evaluate(x => { const c = document.querySelector(`[data-act="as-share"][data-k="${x}"]`); return c ? c.checked : null; }, k); };
  const allumer = async (nom, on) => { await aller('reglages', '[data-act="mod-on"]'); const c = `#main .set.mod:has(input[data-act="mod-label"][value="${nom}"]) [data-act="mod-on"]`; if (on) await e.check(c); else await e.uncheck(c); await e.waitForTimeout(200); };
  let r = await demande('Où en est mon budget ce mois-ci ?'), sys = r.length ? plat(r[0].requete.system) : '';
  check(sys.includes('DONNÉES DU TABLEAU DE BORD') && /Date : .*\. Lune : /.test(sys) && /BUDGET \(\d{4}-\d{2}\) : dépenses/.test(sys) && /Enveloppes : Courses .*sur 300,00 € ; Travaux .*sur 500,00 €/.test(sys)
    && sys.includes('CHANTIER : 4 tâches ouvertes sur 5.') && sys.includes('[t1]'), `la question part avec les données : la date et la lune, BUDGET et ses enveloppes, CHANTIER et ses tâches à identifiant (étape 1)${sys ? '' : ' (aucune requête)'}`);
  await lisible('budget'); await e.uncheck('[data-act="as-share"][data-k="budget"]'); await e.waitForTimeout(200);
  let t = await enTete();
  check(t.includes('Données partagées :') && !/Données partagées :[^.]*Budget/.test(t), `« Budget » décoché : l’en-tête n’en parle plus (${t.slice(t.indexOf('Données'), t.indexOf('Données') + 120)}) (étape 2)`);
  r = await demande('Où en est mon budget ce mois-ci ?'); sys = r.length ? plat(r[0].requete.system) : 'rien';
  check(r.length && sys.includes('DONNÉES DU TABLEAU DE BORD') && !sys.includes('BUDGET') && !sys.includes('Enveloppes') && !sys.includes('300,00 €') && !sys.includes('500,00 €'), 'la même question : les données partent, sans BUDGET, ni ses enveloppes, ni leurs montants (étape 3)');
  await allumer('Plantes', false);
  const plantesListe = await lisible('plantes'); t = await enTete(); r = await demande('Et les plantes ?'); sys = r.length ? plat(r[0].requete.system) : 'rien';
  check(plantesListe === null && !/Données partagées :[^.]*Plantes/.test(t) && sys.includes('CHANTIER') && !sys.includes('PLANTES'), 'Plantes éteinte : absente de « Ce que Claude peut lire », de l’en-tête et de la requête (étape 4)');
  await allumer('Plantes', true); t = await enTete();
  check((await lisible('plantes')) === true && /Données partagées :[^.]*Plantes/.test(t), 'rallumée : Plantes revient, cochée (son choix gardé), l’en-tête la cite (étape 5)');

  console.log('le jeu d’essai : ce que Claude peut faire (AST-005)');
  const modales = () => e.evaluate(() => window.__modales.length);
  const operations = async () => (await storeJSON(e, 'selene-site-v1')).modules.budget.entries.length;
  const ops0 = await operations();
  await allumer('Budget', false); let m0 = await modales();
  // Une fenêtre d'accord ouverte à tort est relevée, puis refusée : le scénario continue, et rien ne s'écrit.
  const refermer = async () => { const n = (await modales()) - m0; if (await e.$('#cdlg[open]')) { await e.click('#cdlg button[value="cancel"]'); await e.waitForTimeout(300); } return n; };
  r = await demande('Enregistre une dépense de 9 € en Courses.');
  const accords1 = await refermer();
  const outils = r.length && r[0].requete.tools ? r[0].requete.tools.map(x => x.name).join() : '';
  const refus = r.length > 1 ? JSON.stringify(r[1].requete.messages.at(-1).content) : '';
  await allumer('Budget', true);
  check(outils === 'ajouter_tache,terminer_tache,capturer' && !accords1 && refus.includes('Action non autorisée ou module désactivé') && (await operations()) === ops0,
    `Budget éteint : les outils offerts (${outils}), sans ajouter_operation ; le modèle qui l’appelle quand même est refusé, sans fenêtre d’accord, et aucune dépense de 9 € (étape 1)`);
  await aller('reglages', '[data-act="as-actions"]'); await e.uncheck('[data-act="as-actions"]'); await e.waitForTimeout(200);
  t = await enTete();
  check(t.endsWith('Lecture seule.'), `« Autoriser Claude à modifier… » décoché : l’en-tête finit par « Lecture seule. » (étape 2)`);
  m0 = await modales(); r = await demande('Ajoute au Chantier la tâche « Fixer la tringle ».');
  const accords3 = await refermer();
  const taches = JSON.stringify((await storeJSON(e, 'selene-site-v1')).modules.chantier.entries);
  check(r.length && !('tools' in r[0].requete) && r[0].requete.system.includes('Tu ne peux rien modifier : conseille seulement.') && !accords3 && !taches.includes('Fixer la tringle'),
    'lecture seule : la requête n’offre aucun outil et dit « Tu ne peux rien modifier : conseille seulement. » ; la tâche demandée n’est pas ajoutée, sans fenêtre d’accord (étape 3)');

  console.log('le jeu d’essai : effacer la conversation (AST-008)');
  await aller('assistant', '[data-act="chat-clear"]');
  const bulles = () => e.$$eval('.chat .msg', ms => ms.length), n0 = await bulles();
  await e.click('[data-act="chat-clear"]'); await e.waitForSelector('#cdlg[open]');
  const question = (await e.textContent('#cmsg')).trim();
  await e.click('#cdlg button[value="cancel"]'); await e.waitForTimeout(600); // une absence : le temps que le refus passe
  check(question === 'Effacer la conversation ?' && (await bulles()) === n0 && n0 >= 2, `« Effacer la conversation ? », puis « Annuler » : la conversation est intacte (${n0} messages) (étapes 1 et 2)`);
  await e.click('[data-act="chat-clear"]'); await e.waitForSelector('#cdlg[open]'); await e.click('#cdlg button[value="ok"]');
  await e.waitForFunction(() => !document.querySelector('.chat .msg'), null, { timeout: 5000 }).catch(() => {});
  check(!(await bulles()) && !(await e.$('[data-act="chat-clear"]')) && (await e.$$('[data-act="chat-chip"]')).length >= 2, 'confirmé : la conversation est vide, le bouton disparaît, les suggestions reviennent (étape 3)');
  await demande('Bonsoir ?');
  // La réponse affichée, son enregistrement peut suivre : attendre que la conversation gardée ait la question et la
  // réponse (A49 : lue trop tôt, elle n'avait que la question).
  let avantDeco = null;
  for (let i = 0; i < 50; i++) { avantDeco = await storeJSON(e, 'selene-chat').catch(() => null); if (Array.isArray(avantDeco) && avantDeco.length >= 2) break; await e.waitForTimeout(100); }
  await aller('reglages', '[data-act="auth-out"]'); await e.click('[data-act="auth-out"]');
  await e.waitForSelector('#authForm', { timeout: 10000 }).catch(() => {});
  const apresDeco = await storeJSON(e, 'selene-chat');
  // Se reconnecter : le compte A revient (la session reposée par le script d'initialisation, comme un retour de connexion).
  await e.reload(); await e.waitForSelector('#nav a', { timeout: 10000 }).catch(() => {});
  await aller('assistant', '#chatIn');
  check(Array.isArray(avantDeco) && avantDeco.length >= 2 && (apresDeco === null || (Array.isArray(apresDeco) && !apresDeco.length)) && !(await bulles()),
    `déconnectée puis reconnectée : la conversation est vide, et « selene-chat » absent du stockage (avant : ${(avantDeco || []).length} messages) (étape 4)`);

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
