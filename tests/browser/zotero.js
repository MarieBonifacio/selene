/* Scénario de navigateur : Zotero en lecture seule (connexions externes, phase 2, vague 6f : docs/connexions.md).
   Version hébergée simulée (faux Supabase, faux passeur), API Zotero simulée. Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.sources = { type: 'collection', label: 'Sources', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, sources: true, display: 'liste', statuses: ['À lire', 'Lue'], doneFrom: 1,
  fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Résumé' } }, entries: [] };
demo.config.modules.push({ id: 'sources', on: true });
const UID = '0b8f0c2e-1111-2222-3333-444455556666', KEY = 'CleZoteroLectureSeule1';
const ITEMS = [
  { key: 'ABCD2345', links: { alternate: { href: 'https://www.zotero.org/marie/items/ABCD2345' } }, meta: { parsedDate: '2020-05-12' },
    data: { itemType: 'journalArticle', title: 'Depersonalization <img src=x onerror=window.__pwn=1> and the self', publicationTitle: 'Consciousness and Cognition', DOI: '10.1016/j.concog.2020.102946',
      creators: [{ creatorType: 'author', firstName: 'Anna', lastName: 'Ciaunica' }], abstractNote: 'Un résumé.' } },
  { key: 'WXYZ6789', links: { alternate: { href: 'https://www.zotero.org/marie/items/WXYZ6789' } }, meta: { parsedDate: '1934' },
    data: { itemType: 'book', title: 'Les racines de la conscience', creators: [{ creatorType: 'author', firstName: 'C. G.', lastName: 'Jung' }], publisher: 'Buchet-Chastel' } },
  { key: 'PDF12345', data: { itemType: 'attachment', title: 'fichier.pdf' } }
];
(async () => {
  const b = await chromium.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (mode = 'direct', path = '/index.html#reglages') => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.zot = []; p.passeur = [];
    const reply = (url, key) => {
      if (key !== KEY) return { status: 403, body: 'Forbidden' };
      if (url.pathname.startsWith('/keys/')) return { status: 200, body: JSON.stringify({ key: KEY, userID: 475425, username: 'marie', access: { user: { library: true, notes: true, ...(mode === 'write' ? { write: true } : {}) } } }) };
      return { status: 200, body: JSON.stringify(ITEMS) };
    };
    await ctx.route('https://api.zotero.org/**', r => {
      const u = new URL(r.request().url()), h = r.request().headers(); p.zot.push({ u, key: h['zotero-api-key'] });
      if (mode === 'cors') return r.abort('failed'); // ce que voit le navigateur quand CORS est refusé
      const x = reply(u, h['zotero-api-key']); r.fulfill({ status: x.status, contentType: 'application/json', body: x.body });
    });
    await ctx.route('https://*.supabase.co/**', r => {
      const req = r.request(), u = new URL(req.url());
      if (u.pathname === '/functions/v1/passeur') {
        const q = req.postDataJSON(); p.passeur.push(q); const zu = new URL(q.url), x = reply(zu, zu.searchParams.get('key'));
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify(x.status === 200 ? { status: 200, url: q.url, type: 'application/json', texte: x.body } : { status: x.status, url: q.url, erreur: `le site répond ${x.status}` }) });
      }
      r.fulfill({ contentType: 'application/json', body: req.method() === 'GET' ? '[]' : '{}' });
    });
    const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
    await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
    await p.goto(BASE + path); await p.waitForTimeout(600); return p;
  };
  const setKey = async (p, k = KEY) => { await p.fill('[data-act="zot-key"]', k); await p.press('[data-act="zot-key"]', 'Tab'); await p.waitForTimeout(500); };
  const data = p => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));

  console.log('la clé, en lecture seule');
  const p = await open();
  ok(await p.isVisible('#zotero') && !p.zot.length, 'une section Zotero ; rien n’est demandé sans clé');
  await setKey(p);
  ok(p.zot.length === 1 && p.zot[0].u.pathname === '/keys/current' && p.zot[0].key === KEY && !p.zot[0].u.search.includes(KEY), 'la clé est vérifiée, en en-tête (jamais dans l’adresse)');
  ok((await p.textContent('#zotero')).includes('Bibliothèque de marie, en lecture seule'), 'à qui elle est, et qu’elle ne peut pas écrire');
  ok(!(await p.evaluate(() => localStorage.getItem('selene-site-v1'))).includes(KEY) && (await p.inputValue('[data-act="zot-key"]')).startsWith('•'), 'la clé reste hors des données synchronisées, et n’est pas réaffichée');

  console.log('chercher, garder');
  await p.evaluate(() => location.hash = 'sources'); await p.waitForTimeout(300);
  await p.fill('#zotIn', 'conscience'); await p.press('#zotIn', 'Enter'); await p.waitForTimeout(500);
  const last = p.zot[p.zot.length - 1].u;
  ok(last.pathname === '/users/475425/items/top' && last.searchParams.get('q') === 'conscience' && last.searchParams.get('qmode') === 'titleCreatorYear', 'une recherche dans ta bibliothèque (titre, auteur, année)');
  const titles = await p.$$eval('.zot-list b', bs => bs.map(x => x.textContent));
  ok(titles.length === 2 && titles[0].includes('<img') && !(await p.evaluate(() => window.__pwn)), 'deux fiches (la pièce jointe écartée) ; un titre piégé reste du texte');
  await p.click('.zot-list [data-zi="0"] [data-act="zot-keep"]'); await p.waitForTimeout(250);
  let e = (await data(p)).modules.sources.entries[0];
  ok(e && e.zot.k === 'ABCD2345' && e.zot.l === 'https://www.zotero.org/marie/items/ABCD2345' && e.src.doi === '10.1016/j.concog.2020.102946' && e.src.site === 'Consciousness and Cognition' && e.subtitle === 'Anna Ciaunica' && e.origin.from === 'Zotero', 'gardée comme Source, reliée à sa fiche Zotero, avec sa provenance');
  ok((await p.getAttribute(`[data-id="${e.id}"] .src-link:has-text("Zotero")`, 'href')) === 'https://www.zotero.org/marie/items/ABCD2345', 'un lien vers la fiche dans Zotero');
  await p.click('.zot-list [data-zi="1"] [data-act="zot-keep"]'); await p.waitForTimeout(250);
  ok((await p.$$('.zot-list [data-act="zot-keep"]')).length === 0 && (await p.textContent('.zot-list')).includes('déjà gardée'), 'un livre sans DOI ni adresse : reconnu par sa clé Zotero, pas de doublon');
  await p.click('[data-act="zot-recent"]'); await p.waitForTimeout(400);
  ok(p.zot[p.zot.length - 1].u.searchParams.get('sort') === 'dateAdded' && (await p.textContent('.zot-bar')).includes('dix dernières'), '« récents » : les dernières fiches ajoutées');

  console.log('CORS refusé : le passeur prend le relais');
  const c = await open('cors');
  await setKey(c);
  ok(c.passeur.length === 1 && c.passeur[0].genre === 'json' && c.passeur[0].url.includes(`/keys/${KEY}`) && (await c.textContent('#zotero')).includes('Bibliothèque de marie'), 'la vérification passe par le passeur (genre json)');
  await c.evaluate(() => location.hash = 'sources'); await c.waitForTimeout(300);
  await c.click('[data-act="zot-recent"]'); await c.waitForTimeout(500);
  ok(c.passeur.length === 2 && (await c.$$('.zot-list b')).length === 2, 'la recherche aussi');

  console.log('clé en écriture, clé refusée');
  const w = await open('write'); await setKey(w);
  ok((await w.textContent('#zotero')).includes('cette clé peut écrire'), 'une clé qui peut écrire : Selene le signale');
  const r = await open(); await setKey(r, 'mauvaise-cle');
  ok((await r.textContent('#toast')).includes('refuse cette clé'), 'une clé refusée : dit');

  console.log('hors version hébergée');
  const ctx = await b.newContext(); const a = await ctx.newPage(); a.on('pageerror', e2 => errs.push(e2.message));
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await a.goto(BASE + '/index.html#reglages'); await a.waitForTimeout(400);
  ok(!(await a.$('#zotero')), 'dans l’artefact claude.ai : pas de Zotero');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
