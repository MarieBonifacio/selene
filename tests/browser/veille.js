/* Scénario de navigateur : Research Watch dans Dehors (connexions externes, phase 2, vague 6d : docs/connexions.md).
   Version hébergée simulée (faux Supabase), OpenAlex simulé ; pas besoin du passeur. Lancé par tests/browser/run.js. */
const { storeGet, storeJSON, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.sources = { type: 'collection', label: 'Sources', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, sources: true, display: 'liste', statuses: ['À lire', 'Lue'], doneFrom: 1,
  fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Résumé' } }, entries: [] };
demo.config.modules.push({ id: 'sources', on: true });
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const WORK = (n, extra = {}) => ({ id: `https://openalex.org/W${n}`, doi: `https://doi.org/10.1000/test.${n}`, title: `Article ${n}`, publication_date: '2026-09-2' + (n % 10), type: 'article',
  primary_location: { source: { display_name: 'Consciousness and Cognition' } }, authorships: [{ author: { display_name: 'Anna Ciaunica' } }], abstract_inverted_index: { Un: [0], résumé: [1] }, ...extra });
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [], oa = [];
  let mode = 'ok';
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('https://*.supabase.co/**', r => { const req = r.request(); if (new URL(req.url()).pathname.startsWith('/functions/')) return r.fulfill({ status: 404, body: '' }); r.fulfill({ contentType: 'application/json', body: req.method() === 'GET' ? '[]' : '{}' }); });
  await ctx.route('https://api.openalex.org/**', r => {
    const u = new URL(r.request().url()); oa.push(u);
    if (mode === 'quota') return r.fulfill({ status: 429, body: '' });
    const results = u.searchParams.get('search') ? [WORK(1, { title: 'Depersonalization <img src=x onerror=window.__pwn=1> and the self' }), WORK(2, { doi: null })] : [WORK(3)];
    r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results }) });
  });
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#dehors'); await p.waitForTimeout(800);
  const data = () => storeJSON(p, 'selene-site-v1');
  const watch = async (q, mod = '') => { await p.fill('#oaIn', q); await p.selectOption('#oaMod', mod); await p.click('[data-act="oa-add"]'); await p.waitForTimeout(700); };

  console.log('une recherche, sans clé');
  ok(!oa.length, 'rien n’est demandé avant la première veille');
  await watch('depersonalization', 'ecriture');
  const u = oa[0];
  ok(oa.length === 1 && u.searchParams.get('search') === 'depersonalization' && /^from_publication_date:\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('filter')) && !u.searchParams.get('api_key'), 'une requête : la recherche, depuis un mois, sans clé');
  let t = (await p.textContent('.dehors')).replace(/\s+/g, ' ');
  ok(t.includes('Depersonalization and the self') && !(await p.evaluate(() => window.__pwn)) && t.includes('Veille : depersonalization') && t.includes('Consciousness and Cognition · Anna Ciaunica — Un résumé'), 'les articles, avec revue, autrice et résumé ; les balises d’un titre piégé retirées');
  ok((await p.textContent('#main h3')).includes('Écriture'), 'rangés sous leur projet');
  await p.click('[data-item="W1"] [data-act="dehors-keep"]'); await p.waitForTimeout(250);
  const s = (await data()).modules.sources.entries[0];
  ok(s && s.src.doi === '10.1000/test.1' && s.src.url === 'https://doi.org/10.1000/test.1' && s.src.site === 'Consciousness and Cognition' && s.subtitle === 'Anna Ciaunica' && s.origin.from === 'Veille' && s.origin.text === 'depersonalization', 'garder : une source avec son DOI, sa revue, son autrice, et sa provenance « Veille »');
  ok((await p.getAttribute('[data-item="W2"] a', 'href')) === 'https://openalex.org/W2', 'sans DOI : la notice OpenAlex');

  console.log('un auteur, avec une clé');
  await p.click('text=Clé OpenAlex (facultative)'); await p.fill('[data-act="oa-key"]', 'ma-cle-secrete'); await p.press('[data-act="oa-key"]', 'Tab'); await p.waitForTimeout(200);
  await watch('https://orcid.org/0000-0002-1825-0097');
  const a = oa[oa.length - 1];
  ok(a.searchParams.get('filter').startsWith('author.orcid:0000-0002-1825-0097,') && a.searchParams.get('api_key') === 'ma-cle-secrete', 'un ORCID : filtre auteur, et la clé saisie');
  ok(!JSON.stringify(await data()).includes('ma-cle-secrete') && (await data()).config.dehors.research.length === 2, 'la clé n’est pas dans les données synchronisées ; les veilles, si');
  await watch('Depersonalization');
  ok((await p.textContent('#toast')).includes('Déjà en veille'), 'une veille en double : dit');

  console.log('une fois par semaine, quota');
  const n = oa.length;
  await p.reload(); await p.waitForTimeout(2200);
  ok(oa.length === n, 'rouvert dans la semaine : OpenAlex n’est pas redemandé');
  mode = 'quota';
  await p.click('[data-act="dehors-refresh"]'); await p.waitForTimeout(1200);
  ok((await p.textContent('#main')).includes('quota du jour atteint'), 'quota épuisé : dit, avec le remède');

  console.log('déconnexion');
  await p.goto(BASE + '/index.html#reglages'); await p.waitForTimeout(300);
  await p.click('[data-act="auth-out"]'); await p.waitForTimeout(600);
  if (await p.isVisible('#cdlg')) { await p.click('#cdlg button[value=ok]'); await p.waitForTimeout(500); } // le faux Supabase n'accuse pas réception : Selene prévient d'abord
  ok(!(await storeGet(p, 'selene-openalex-key')) && !(await storeGet(p, 'selene-dehors')), 'se déconnecter efface la clé et ce que le dehors a apporté');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
