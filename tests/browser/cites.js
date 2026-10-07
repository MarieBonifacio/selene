/* Scénario de navigateur : « cité par tes sources » (phase 3, vague 7b : docs/connexions.md).
   Version hébergée simulée (faux Supabase), OpenAlex simulé. Lancé par tests/browser/run.js. */
const { storeGet, storeJSON, until, suivre, calme, fauxSupabase, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
const src = (id, title, doi) => ({ id, title, subtitle: '', tag: 'article', due: '', text: '', status: 'À lire', kept: '2026-09-01', src: doi ? { url: `https://doi.org/${doi}`, doi } : { url: 'https://blog.example/billet' } });
demo.modules.sources = { type: 'collection', label: 'Sources', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, sources: true, display: 'liste', statuses: ['À lire', 'Lue'], doneFrom: 1,
  fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Résumé' } },
  entries: [src('s1', 'Depersonalization and the self', '10.1000/a'), src('s2', 'The feeling of being', '10.1000/b'), src('s3', 'Self and other', '10.1000/c'), src('s4', 'Un billet sans DOI')] };
demo.config.modules.push({ id: 'sources', on: true });
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const A = (id, name) => ({ author: { id: `https://openalex.org/${id}`, display_name: name } });
// Ce qu'OpenAlex sait de tes sources : a et b citent W100 et W101 (couplage : 2) ; c cite W100 ; a cite b (ta propre source, pas une suggestion).
const WORKS = {
  '10.1000/a': { id: 'W1', referenced_works: ['W100', 'W101', 'W2'].map(x => 'https://openalex.org/' + x), authorships: [A('A5023888391', 'Anna Ciaunica')] },
  '10.1000/b': { id: 'W2', referenced_works: ['W100', 'W101'].map(x => 'https://openalex.org/' + x), authorships: [A('A5023888391', 'Anna Ciaunica'), A('A5000000002', 'Bruno <i>X</i>')] },
  '10.1000/c': { id: 'W3', referenced_works: ['https://openalex.org/W100'], authorships: [A('A5023888391', 'Anna Ciaunica'), A('A5000000002', 'Bruno <i>X</i>')] },
  '10.1000/w100': { id: 'W100', referenced_works: [], authorships: [] }
};
const TITLES = {
  W100: { id: 'https://openalex.org/W100', doi: 'https://doi.org/10.1000/w100', title: 'The phenomenal self <img src=x onerror=window.__pwn=1>', publication_date: '1999-03-01', type: 'article',
    primary_location: { source: { display_name: 'Mind' } }, authorships: [A('A9', 'Thomas Metzinger')] },
  W101: { id: 'https://openalex.org/W101', doi: null, title: 'Being no one', publication_date: '2003-01-01', type: 'book', primary_location: null, authorships: [A('A9', 'Thomas Metzinger')] }
};
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const p = suivre(await ctx.newPage()); p.on('pageerror', e => errs.push(e.message));
  const asked = [];
  await ctx.route('https://api.openalex.org/**', r => {
    const u = new URL(r.request().url()), f = u.searchParams.get('filter') || ''; asked.push(u);
    const [field, vals] = [f.slice(0, f.indexOf(':')), f.slice(f.indexOf(':') + 1).split('|')];
    const results = field === 'doi' ? vals.filter(d => WORKS[d]).map(d => ({ ...WORKS[d], id: 'https://openalex.org/' + WORKS[d].id, doi: 'https://doi.org/' + d }))
      : field === 'openalex' ? vals.map(v => TITLES[v]).filter(Boolean) : [];
    r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results }) });
  });
  await fauxSupabase(ctx);
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
  await p.goto(BASE + '/index.html#sources'); await p.waitForTimeout(600);
  const data = () => storeJSON(p, 'selene-site-v1');
  const text = async sel => (await p.textContent(sel)).replace(/\s+/g, ' ');

  await p.waitForSelector('[data-act="cite-run"]', { timeout: 10000 }).catch(() => {});
  // Le branchement du démarrage se termine par un rendu de la page : un clic fait pendant qu'il court peut tomber sur un
  // bouton remplacé entre l'appui et le relâchement, et rien ne part (A27, sous Firefox). Le laisser finir d'abord.
  await calme(p);
  // Chaque contrôle attend ce qu'il lit (les requêtes, l'écriture) plutôt qu'un délai : sous Firefox, OpenAlex simulé
  // répondait après les 500 ms d'attente, et asked[0] n'existait pas encore (CI de la PR #124, 6 octobre 2026).
  const relu = async ok => { let d = null; for (const end = Date.now() + 10000; Date.now() < end; await p.waitForTimeout(100)) { d = await data(); if (ok(d)) break; } return d; };
  try {
  console.log('à la demande');
  ok(await p.isVisible('[data-act="cite-run"]') && !asked.length, 'un bouton ; rien n’est demandé à OpenAlex avant le clic');
  await p.click('[data-act="cite-run"]'); await until(() => asked.length >= 2); await p.waitForSelector('.cite-list b', { timeout: 10000 }).catch(() => {});
  if (!asked.length) throw new Error('le clic sur « Ce que tes sources ont en commun » n’a rien envoyé à OpenAlex en 10 s');
  const first = asked[0].searchParams.get('filter');
  ok(asked.length === 2 && first === 'doi:10.1000/a|10.1000/b|10.1000/c' && asked[1].searchParams.get('filter') === 'openalex:W100|W101',
    `deux appels : les bibliographies des trois sources à DOI, puis les titres des références communes (${asked.map(u => u.searchParams.get('filter')).join(' ; ')})`);
  ok(!asked.some(u => /billet|Depersonalization|feeling/i.test(decodeURIComponent(u.toString()))), 'OpenAlex ne reçoit que des DOI : ni titres, ni adresses');

  console.log('ce qu’elles ont en commun');
  let t = await text('.cite-bar');
  ok(t.includes('OpenAlex connaît 3 de tes 3 sources à DOI'), 'dit ce qu’OpenAlex connaît');
  const common = await p.$$eval('.cite-list b', bs => bs.map(x => x.textContent));
  ok(common.length === 2 && common[0].startsWith('The phenomenal self') && common[1] === 'Being no one', `les références communes, la plus citée d’abord ; tes propres sources exclues (${common.join(' | ')})`);
  ok(!common[0].includes('<img') && !(await p.evaluate(() => window.__pwn)), 'un titre piégé perd ses balises, rien ne s’exécute');
  ok((await text('.cite-list [data-w="W100"]')).includes('cité par 3 de tes sources : « Depersonalization and the self », « The feeling of being », « Self and other »'), 'par qui elle est citée, en liens');
  ok(t.includes('« Depersonalization and the self » et « The feeling of being » : 2 références en commun') && !t.includes('et « Self and other » :'), 'le couplage : deux sources qui citent les mêmes textes (une seule référence ne suffit pas)');
  ok(t.includes('Anna Ciaunica, dans 3 de tes sources') && t.includes('Bruno X, dans 2 de tes sources') && !(await p.$('.cite-authors i')), 'les auteurs qui reviennent (sans balises)');
  ok(!(await storeGet(p, 'selene-site-v1')).includes('W100') && (await storeGet(p, 'selene-cites')).includes('W100'), 'le résultat reste sur l’appareil, hors des données synchronisées');

  console.log('garder, suivre');
  await p.click('.cite-list [data-w="W100"] [data-act="cite-keep"]');
  const kept = (await relu(d => d.modules.sources.entries.some(e => e.src && e.src.doi === '10.1000/w100'))).modules.sources.entries.find(e => e.src && e.src.doi === '10.1000/w100');
  ok(kept && kept.title.startsWith('The phenomenal self') && kept.subtitle === 'Thomas Metzinger' && kept.src.site === 'Mind' && kept.origin.from === 'Cité par tes sources', 'gardée comme Source, avec sa provenance');
  ok((await text('.cite-list [data-w="W100"]')).includes('déjà gardée'), 'et se dit déjà gardée');
  await p.click('.cite-authors [data-a="A5023888391"] [data-act="cite-follow"]');
  await until(() => asked.some(u => (u.searchParams.get('filter') || '').startsWith('author.id:A5023888391')));
  await p.waitForFunction(() => (document.querySelector('.cite-authors [data-a="A5023888391"]') || {}).textContent?.includes('en veille'), null, { timeout: 10000 }).catch(() => {});
  const r = ((await relu(d => ((d.config.dehors || {}).research || []).length)).config.dehors || {}).research || [];
  ok(r.length === 1 && r[0].kind === 'author' && r[0].q === 'A5023888391' && r[0].name === 'Anna Ciaunica', 'un auteur qui revient se suit dans la veille, sous son nom');
  ok(asked.some(u => (u.searchParams.get('filter') || '').startsWith('author.id:A5023888391')) && (await text('.cite-authors [data-a="A5023888391"]')).includes('en veille'), 'première lecture de la veille ; le bouton dit « en veille »');

  console.log('relancé');
  const before = asked.length;
  await p.click('[data-act="cite-run"]'); await until(() => asked.length > before);
  await p.waitForTimeout(500); // une absence ne s'attend pas : le temps qu'une requête de trop parte, s'il devait en partir
  const again = asked.slice(before).map(u => u.searchParams.get('filter'));
  ok(again.length === 1 && again[0] === 'doi:10.1000/w100', `seule la nouvelle source est demandée ; le reste vient du cache (${again.join(' ; ')})`);
  ok(!(await p.$('.cite-list [data-w="W100"]')) && !!(await p.$('.cite-list [data-w="W101"]')), 'gardée, elle devient l’une de tes sources : plus une suggestion');

  console.log('sans assez de sources');
  const ctx2 = await b.newContext(); const a = await ctx2.newPage(); a.on('pageerror', e => errs.push(e.message));
  const one = JSON.parse(JSON.stringify(demo)); one.modules.sources.entries = one.modules.sources.entries.slice(0, 1);
  await ctx2.addInitScript(d => { window.claude = { use: async () => null }; localStorage.setItem('selene-site-v1', d); }, JSON.stringify(one));
  await a.goto(BASE + '/index.html#sources'); await a.waitForTimeout(400);
  ok(!(await a.$('[data-act="cite-run"]')), 'une seule source à DOI : rien à croiser, pas de bouton');
  } catch (e) { check(false, e.message.split('\n')[0]); }

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
