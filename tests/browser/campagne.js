/* Scénario de navigateur : le cahier à cocher (dist/recette/campagne.html, BL-18 du cahier de recette). La page est
   générée par `npm run recette -- campagne`, puis ouverte avec une fausse base `window.claude` fidèle au contrat de la
   capacité « db » (runtime 0.2.74) : `set` remplace le document, `update` fusionne les objets imbriqués et refuse un
   document absent (`invalid_argument`), les instantanés sont gelés et portent leurs `docChanges`. La base vit dans le
   localStorage de la page, pour survivre au rechargement. Lancé par tests/browser/run.js. */
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { engine, BASE, launchOptions, check } = require('./helpers');
const RACINE = path.join(__dirname, '..', '..');
const PAGE = BASE + '/dist/recette/campagne.html';

/* La fausse base et le faux « user », posés avant le script de la page. `ecriture` : false pour un accès en lecture. */
const fausseBase = ({ ecriture = true } = {}) => {
  const KEY = 'fausse-base', ecoutes = new Set();
  const lire = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const ecrire = m => localStorage.setItem(KEY, JSON.stringify(m));
  const gele = o => { if (o && typeof o === 'object') { Object.values(o).forEach(gele); Object.freeze(o); } return o; };
  const instantane = (chemin, corps) => gele({ id: chemin.split('/').pop(), exists: corps !== undefined, data: () => (corps === undefined ? undefined : gele(JSON.parse(JSON.stringify(corps)))), metadata: { fromCache: false, hasPendingWrites: false } });
  const fusion = (a, b) => { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) ? fusion(out[k], v) : v; return out; };
  const prevenir = () => setTimeout(() => ecoutes.forEach(f => f()), 0);
  const db = {
    doc: chemin => ({
      id: chemin.split('/').pop(), path: chemin,
      async get() { return instantane(chemin, lire()[chemin]); },
      async set(corps) { const m = lire(); m[chemin] = JSON.parse(JSON.stringify(corps)); ecrire(m); prevenir(); },
      async update(corps) {
        const m = lire();
        if (!(chemin in m)) throw Object.assign(new Error('document absent'), { code: 'invalid_argument' });
        m[chemin] = fusion(m[chemin], JSON.parse(JSON.stringify(corps))); ecrire(m); prevenir();
      },
      async delete() { const m = lire(); delete m[chemin]; ecrire(m); prevenir(); }
    }),
    collection: chemin => ({
      limit: () => ({
        onSnapshot(cb) {
          let avant = new Map();
          const tirer = () => {
            const m = lire(), maintenant = new Map(Object.entries(m).filter(([k]) => k.startsWith(chemin + '/') && !k.slice(chemin.length + 1).includes('/')));
            const changements = [];
            for (const [k, v] of maintenant) if (!avant.has(k) || JSON.stringify(avant.get(k)) !== JSON.stringify(v)) changements.push({ type: avant.has(k) ? 'modified' : 'added', doc: instantane(k, v), oldIndex: -1, newIndex: -1 });
            for (const [k, v] of avant) if (!maintenant.has(k)) changements.push({ type: 'removed', doc: instantane(k, v), oldIndex: -1, newIndex: -1 });
            avant = maintenant;
            const docs = [...maintenant].map(([k, v]) => instantane(k, v));
            cb(gele({ docs, size: docs.length, empty: !docs.length, docChanges: () => changements, metadata: { fromCache: false, hasPendingWrites: false } }));
          };
          ecoutes.add(tirer); setTimeout(tirer, 0);
          return () => ecoutes.delete(tirer);
        }
      })
    })
  };
  const user = { id: async () => 'recette-u1', can: async () => ecriture, isOwner: () => true };
  window.claude = Object.freeze({ use: async nom => (nom === 'db' ? db : nom === 'user' ? user : null) });
};

(async () => {
  execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'recette.mjs'), 'campagne'], { cwd: RACINE, stdio: 'ignore' });
  const b = await engine.launch(launchOptions), errs = [], alertes = [];
  const ouvrir = async (avecBase, options) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { alertes.push(d.message()); d.dismiss().catch(() => {}); });
    if (avecBase) await ctx.addInitScript(fausseBase, options);
    await p.goto(PAGE); await p.waitForSelector('details.case');
    await p.waitForFunction(() => !/Connexion à la base/.test(document.getElementById('save').textContent), null, { timeout: 10000 }).catch(() => {});
    return { ctx, p };
  };
  const base = p => p.evaluate(() => JSON.parse(localStorage.getItem('fausse-base') || '{}'));
  try {
    console.log('sans base : le cahier se lit, rien ne s’enregistre');
    const L = await ouvrir(false), l = L.p;
    const lu = await l.evaluate(() => ({ cas: document.querySelectorAll('details.case').length, banniere: document.getElementById('banner').textContent, nouvelle: document.getElementById('newBtn').disabled, D: JSON.parse(document.getElementById('data').textContent) }));
    check(lu.cas === 192 && lu.cas === lu.D.cas.length && lu.banniere.includes('Les coches ne s\'enregistrent pas ici') && lu.nouvelle,
      `${lu.cas} cas, « Les coches ne s’enregistrent pas ici… », « Nouvelle campagne » désactivée`);
    await L.ctx.close();

    console.log('avec la base : une smoke, des coches, le rechargement');
    const A = await ouvrir(true), p = A.p, D = lu.D, premier = D.smoke[0].id, carte = '#' + premier.toLowerCase();
    await p.click('#newBtn'); await p.waitForSelector('#newPanel:not([hidden])');
    const annonce = (await p.textContent('#newCount')).trim();
    await p.click('#createBtn');
    await p.waitForFunction(() => document.getElementById('campSel').value, null, { timeout: 10000 }).catch(() => {});
    const cid = await p.inputValue('#campSel'), camp = (await base(p))[`campagnes/${cid}`] || {};
    check(new RegExp(`^${D.smoke.length} cas, \\d+ cases à cocher\\.`).test(annonce) && camp.type === 'smoke' && (camp.cas || []).length === D.smoke.length && camp.cahier === D.commit && camp.par === 'recette-u1',
      `« ${annonce} » ; la campagne « ${cid} » enregistrée : smoke, ${(camp.cas || []).length} cas, le commit du cahier`);
    await p.evaluate(s => { const d = document.querySelector(s); d.open = true; }, carte); await p.waitForSelector(`${carte} .step[data-k="1"] input`, { state: 'attached' });
    // Un clic, comme une personne : `check()` de Playwright échoue sur cette case (le numéro posé dessus, dans le libellé).
    await p.click(`${carte} .step[data-k="1"] input`); await p.click(`${carte} .step[data-k="2"] input`);
    const casDoc = () => base(p).then(m => m[`campagnes/${cid}/cas/${premier}`] || {});
    for (let i = 0; i < 50 && !((await casDoc()).etapes || {})['2']; i++) await p.waitForTimeout(100);
    const e2 = (await casDoc()).etapes || {};
    check(!!(e2['1'] && e2['1'].h) && !!(e2['2'] && e2['2'].h) && e2['1'].par === 'recette-u1', `${premier} : les étapes 1 et 2 cochées, toutes deux gardées par la base, chacune avec son empreinte`);
    const PIEGE = '<img src=x onerror=alert("campagne")>';
    await p.fill(`${carte} textarea[data-f="observe"]`, PIEGE); await p.press(`${carte} textarea[data-f="observe"]`, 'Tab');
    for (let i = 0; i < 50 && (await casDoc()).observe !== PIEGE; i++) await p.waitForTimeout(100);
    await p.reload(); await p.waitForSelector('details.case', { state: 'attached' });
    await p.waitForFunction(c => document.getElementById('campSel').value === c, cid, { timeout: 10000 }).catch(() => {});
    await p.evaluate(s => { document.querySelector(s).open = true; }, carte); await p.waitForSelector(`${carte} .step[data-k="1"] input`, { state: 'attached' });
    await p.waitForFunction(s => document.querySelector(`${s} .step[data-k="2"] input`).checked, carte, { timeout: 10000 }).catch(() => {});
    const visibles = await p.evaluate(() => [...document.querySelectorAll('details.case')].filter(d => !d.hidden).length);
    const r3 = await p.evaluate(s => ({ un: document.querySelector(`${s} .step[data-k="1"] input`).checked, deux: document.querySelector(`${s} .step[data-k="2"] input`).checked, trois: document.querySelector(`${s} .step[data-k="3"] input`)?.checked, obs: document.querySelector(`${s} textarea[data-f="observe"]`).value, img: document.querySelectorAll('img[src="x"]').length }), carte);
    check(visibles === D.smoke.length && r3.un && r3.deux && r3.trois === false && r3.obs === PIEGE && !r3.img && !alertes.length,
      `rechargée : la campagne retrouvée, ses ${visibles} cas affichés, les étapes 1 et 2 cochées, la 3 non ; le résultat observé piégé reste du texte, aucune alerte`);

    console.log('une étape réécrite depuis sa coche');
    await p.evaluate(([k]) => { const m = JSON.parse(localStorage.getItem('fausse-base')); m[k].etapes['1'].h = 'une-autre-version'; localStorage.setItem('fausse-base', JSON.stringify(m)); }, [`campagnes/${cid}/cas/${premier}`]);
    await p.reload(); await p.waitForSelector('details.case', { state: 'attached' });
    await p.waitForFunction(c => document.getElementById('campSel').value === c, cid, { timeout: 10000 }).catch(() => {});
    await p.evaluate(s => { document.querySelector(s).open = true; }, carte); await p.waitForSelector(`${carte} .step[data-k="1"] input`, { state: 'attached' });
    await p.waitForFunction(s => document.querySelector(`${s} .step[data-k="1"]`).classList.contains('stale'), carte, { timeout: 10000 }).catch(() => {});
    const r4 = await p.evaluate(s => ({ perime: document.querySelector(`${s} .step[data-k="1"]`).classList.contains('stale'), dit: !document.querySelector(`${s} .step[data-k="1"] .stale-msg`).hidden, intact: document.querySelector(`${s} .step[data-k="2"]`).classList.contains('done'), compte: document.getElementById('counts').textContent }), carte);
    check(r4.perime && r4.dit && r4.intact && /1 étape à revérifier/.test(r4.compte),
      `l’empreinte de l’étape 1 changée : « Étape réécrite depuis sa coche : à revérifier. », l’étape 2 intacte ; le compteur : « ${r4.compte.replace(/\s+/g, ' ').trim().slice(0, 90)} »`);
    await A.ctx.close();

    console.log('un accès en lecture seule');
    const R = await ouvrir(true, { ecriture: false }), q = R.p;
    const lecture = await q.evaluate(() => ({ banniere: document.getElementById('banner').textContent, nouvelle: document.getElementById('newBtn').disabled }));
    check(lecture.banniere.includes('Lecture seule : ton accès à cette page ne permet pas d\'enregistrer') && lecture.nouvelle, 'sans droit d’écriture : « Lecture seule… », « Nouvelle campagne » désactivée');
    await R.ctx.close();
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
