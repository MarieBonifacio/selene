/* Scénario de navigateur : l'artefact claude.ai assemblé (selene.html), sur un faux claude.ai fidèle au contrat des
   capacités `db` et `user` (runtime 0.2.74) : `set` remplace le document, `delete` est idempotent ; `onSnapshot`
   donne l'état aussitôt, puis chaque changement (les écritures de la page tout de suite, celles des autres à la relève) ;
   sous `data/users/`, le sous-arbre d'un autre lecteur se lit comme absent (`exists: false`) et y écrire est refusé
   (`invalid_argument`). Une seule base, côté Node, pour tous les navigateurs : R1 (la propriétaire) dans deux
   navigateurs, R2 dans un troisième. PLT-011 (étapes 1 à 8) et TRV-008 (étape 6). Lancé par tests/browser/run.js. */
const path = require('node:path');
const { engine, BASE, launchOptions, check, ouvrir, demarree } = require('./helpers');
const PAGE = BASE + '/selene.html';
const base = new Map(), journal = []; // chemin → corps (texte JSON) ; chaque appel reçu : qui, quoi, où
const PIEGE = "<img src=x onerror=alert('TRV008')>";

// Le faux claude.ai, côté page : chaque appel passe par la liaison `__claude`, qui sait quel lecteur appelle.
const fauxClaude = ({ uid, owner }) => {
  const appel = (op, p, corps) => window.__claude(op, p, corps === undefined ? null : JSON.stringify(corps));
  const gele = o => { if (o && typeof o === 'object') { Object.values(o).forEach(gele); Object.freeze(o); } return o; };
  const instantane = (p, texte) => Object.freeze({ id: p.split('/').pop(), exists: texte != null, data: () => (texte == null ? undefined : gele(JSON.parse(texte))), metadata: Object.freeze({ fromCache: false, hasPendingWrites: false }) });
  const ecoutes = new Map(); // chemin → Set de relances
  const prevenir = p => (ecoutes.get(p) || new Set()).forEach(f => f());
  const doc = p => Object.freeze({
    id: p.split('/').pop(), path: p,
    get: async () => instantane(p, await appel('get', p)),
    set: async corps => { await appel('set', p, corps); prevenir(p); },
    update: async corps => { await appel('update', p, corps); prevenir(p); },
    delete: async () => { await appel('delete', p); prevenir(p); },
    onSnapshot(next, error) {
      let dernier, fini = false;
      const tirer = () => appel('get', p).then(t => { if (!fini && t !== dernier) { dernier = t; next(instantane(p, t)); } }, e => { if (!fini) { fini = true; if (error) error(e); } });
      const relance = () => { tirer(); };
      if (!ecoutes.has(p)) ecoutes.set(p, new Set());
      ecoutes.get(p).add(relance);
      const minuterie = setInterval(tirer, 300); setTimeout(tirer, 0);
      return () => { fini = true; clearInterval(minuterie); ecoutes.get(p).delete(relance); };
    },
    collection: () => { throw new Error('non utilisé par Selene'); }
  });
  const db = Object.freeze({ doc, collection: () => { throw new Error('non utilisé par Selene'); } });
  const user = Object.freeze({ id: async () => uid, isOwner: () => owner, canEdit: () => true, can: async () => true, me: async () => ({ id: uid }) });
  window.claude = Object.freeze({ use: async nom => (nom === 'db' ? db : nom === 'user' ? user : null) });
};

/* Un navigateur pour un lecteur. Le serveur : sous data/users/, seul le sous-arbre de l'appelant existe pour lui. */
async function lecteur(b, errs, alertes, uid, owner) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const autrui = p => p.startsWith('data/users/') && p.split('/')[2] !== uid;
  await ctx.exposeBinding('__claude', (_source, op, p, corps) => {
    journal.push({ uid, op, p });
    if (op === 'get') return autrui(p) ? null : (base.has(p) ? base.get(p) : null);
    if (autrui(p)) throw Object.assign(new Error('invalid_argument'), { code: 'invalid_argument' });
    if (op === 'set') base.set(p, corps);
    else if (op === 'update') { if (!base.has(p)) throw Object.assign(new Error('invalid_argument'), { code: 'invalid_argument' }); base.set(p, JSON.stringify({ ...JSON.parse(base.get(p)), ...JSON.parse(corps) })); }
    else if (op === 'delete') base.delete(p);
    return null;
  });
  await ctx.addInitScript(fauxClaude, { uid, owner });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`${uid} : ${e.message}`));
  page.on('dialog', d => { alertes.push(d.message()); d.dismiss().catch(() => {}); });
  await ouvrir(page, PAGE, demarree);
  return { ctx, page };
}
const texte = async q => (await q.textContent('#main')).replace(/\s+/g, ' ');
const vers = async (q, h, sel = '#main > *') => { await q.evaluate(x => { location.hash = x; }, h); await q.waitForFunction(x => location.hash === '#' + x, h); await q.waitForSelector(sel, { state: 'attached' }); };
const attendre = async (cond, ms = 10000) => { for (const fin = Date.now() + ms; Date.now() < fin && !(await cond());) await new Promise(r => setTimeout(r, 100)); return !!(await cond()); };
const site = uid => base.get(`data/users/${uid}/site`) || '';

(async () => {
  const b = await engine.launch(launchOptions), errs = [], alertes = [];
  try {
    console.log('R1 ouvre l’artefact (PLT-011, étapes 1 à 3 ; TRV-008, étape 6)');
    const A = await lecteur(b, errs, alertes, 'r1', true), a = A.page;
    // Le texte rendu et les boutons, pas textContent : le script en ligne de la page contient ces mots.
    const ouverture = await a.evaluate(() => ({ auth: !!document.querySelector('#authForm'), corps: document.body.innerText + ' ' + [...document.querySelectorAll('button, a, [role="button"]')].map(x => x.textContent).join(' ') }));
    check(!ouverture.auth && !/Se connecter|Créer un compte/.test(ouverture.corps), 'Selene s’ouvre directement : pas d’écran d’entrée, ni « Se connecter » ni « Créer un compte » (étape 1)');
    const garder = async (q, t) => {
      await vers(q, 'accueil', '#capIn'); await q.fill('#capIn', t); await q.press('#capIn', 'Enter');
      await q.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Gardé.'), null, { timeout: 5000 }).catch(() => {});
    };
    await garder(a, 'Artefact PLT-011'); await garder(a, PIEGE);
    await attendre(() => site('r1').includes('Artefact PLT-011') && site('r1').includes('TRV008'));
    await ouvrir(a, null, demarree); await vers(a, 'inbox');
    const boite = await texte(a), images = await a.evaluate(() => document.querySelectorAll('img[src="x"]').length);
    check(boite.includes('Artefact PLT-011') && boite.includes(PIEGE) && !images && !alertes.length,
      `rechargé : « Artefact PLT-011 » dans la Boîte, et le piège en texte, chevrons visibles ; aucune image, aucune alerte (étape 2 ; TRV-008, étape 6)`);
    check(site('r1').includes('Artefact PLT-011') && !!base.get('data/users/r1/board') && !base.has('site/state') && !base.has('board/state'),
      'la base : data/users/r1/site porte la note, data/users/r1/board existe ; aucun document partagé (site/state, board/state)');
    await vers(a, 'reglages');
    const connexions = await texte(a);
    check(connexions.includes("Les connexions (Envoyer à Selene, Zotero, le passeur, le calendrier) vivent dans la version web ou l'app installée. L'artefact claude.ai s'en passe."),
      'Réglages : « Les connexions (Envoyer à Selene, Zotero, le passeur, le calendrier) vivent dans la version web ou l’app installée. L’artefact claude.ai s’en passe. » (étape 3)');

    console.log('R1, un second navigateur ; R2, un troisième (étapes 4 à 6)');
    const A2 = await lecteur(b, errs, alertes, 'r1', true), a2 = A2.page;
    await vers(a2, 'inbox'); await attendre(async () => (await texte(a2)).includes('Artefact PLT-011'));
    const boite2 = await texte(a2), images2 = await a2.evaluate(() => document.querySelectorAll('img[src="x"]').length);
    check(boite2.includes('Artefact PLT-011') && boite2.includes(PIEGE) && !images2 && !alertes.length, 'le second navigateur de R1 : la note y est, et le piège reste du texte (étape 4)');
    const R = await lecteur(b, errs, alertes, 'r2', false), r = R.page;
    await r.waitForTimeout(800); await vers(r, 'inbox');
    const vide = await texte(r), nav = await r.textContent('#nav');
    const lus = journal.filter(x => x.uid === 'r2' && x.p.startsWith('data/users/r1/'));
    check(!vide.includes('Artefact PLT-011') && !vide.includes('TRV008') && !nav.includes('Artefact'), 'R2 : un Selene vide, ni la note de R1 ni son piège (étape 5)');
    await garder(r, 'Artefact PLT-011 R2');
    await attendre(() => site('r2').includes('Artefact PLT-011 R2'));
    await ouvrir(a, null, demarree); await vers(a, 'inbox'); await a.waitForTimeout(600);
    const chezR1 = await texte(a);
    await ouvrir(r, null, demarree); await vers(r, 'inbox');
    const chezR2 = await texte(r);
    check(!chezR1.includes('Artefact PLT-011 R2') && chezR2.includes('Artefact PLT-011 R2') && !site('r1').includes('Artefact PLT-011 R2') && !lus.length,
      `chez R1, rechargé, la note de R2 n’apparaît pas ; chez R2, elle est là ; R2 n’a rien demandé du sous-arbre de R1 (étape 6)`);

    console.log('R1 importe un ancien suivi synchronisé (étapes 7 et 8, A17)');
    await vers(a, 'reglages', 'input[data-act="imp"]');
    await a.setInputFiles('input[data-act="imp"]', path.join(__dirname, '..', '..', 'docs', 'recette', 'donnees', 'rlm-synchronise-ancien.json'));
    await a.waitForSelector('#cdlg[open]'); await a.click('#cdlg button[value="ok"]');
    await a.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('Sauvegarde importée.'), null, { timeout: 10000 }).catch(() => {});
    const bulle = (await a.textContent('#toast')).trim();
    await vers(a, 'carnet-du-soir', '#rlmPriv-carnet-du-soir');
    await a.evaluate(() => { document.querySelector('#rlmPriv-carnet-du-soir').open = true; });
    const suivi = await texte(a);
    await attendre(() => site('r1').includes('Carnet du soir'));
    await a.waitForTimeout(1200); // le temps qu'une écriture parte, si elle devait emporter le contenu
    check(bulle === "Sauvegarde importée. « Carnet du soir » est désormais gardé dans ce navigateur seulement : Selene ne synchronise plus les suivis de santé, pas même par claude.ai."
      && suivi.includes("Où vivent ces données. Dans ce navigateur seulement. L'espace privé de ton compte claude.ai n'en garde que le nom") && !suivi.includes('Ce suivi doit revenir sur un appareil'),
      `importé : « ${bulle} » ; « Où vivent ces données. Dans ce navigateur seulement. L’espace privé de ton compte claude.ai n’en garde que le nom… » ; pas de bandeau (étape 7)`);
    check(site('r1').includes('Carnet du soir') && !site('r1').includes('Pause café') && !site('r1').includes('"tabac"'), 'la base de R1 : le nom du suivi, ni « Pause café » ni le sujet');
    await ouvrir(a2, null, demarree); await vers(a2, 'carnet-du-soir');
    await attendre(async () => (await texte(a2)).includes('Ce suivi est gardé sur un autre de tes appareils'));
    const ailleurs = await texte(a2);
    check(ailleurs.includes('Ce suivi est gardé sur un autre de tes appareils, et seulement là') && !ailleurs.includes('Pause café') && !/tabac/i.test(ailleurs),
      'le second navigateur de R1 : « Ce suivi est gardé sur un autre de tes appareils, et seulement là… », ni « Pause café » ni le sujet (étape 8)');
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!alertes.length, 'aucune alerte' + (alertes.length ? ' : ' + alertes.join(' | ') : ''));
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
