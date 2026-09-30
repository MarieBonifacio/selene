/* Scénario de navigateur : Sources (connexions externes, phase 1, vague 5a : docs/connexions.md). Lancé par tests/browser/run.js. */
const { until, storeJSON, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.sources = { type: 'collection', label: 'Sources',
  config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), display: 'liste', sources: true, statuses: ['À lire', 'Lue', 'Utilisée'], doneFrom: 1, addLabel: 'Ajouter à la main',
    fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Résumé et notes' } }, entries: [] };
demo.config.modules.push({ id: 'sources', on: true });
demo.modules.inbox.entries = [{ id: 'n1', text: 'à lire : doi:10.1016/j.concog.2020.102946', date: '2026-09-27' }];
const CROSSREF = { message: { DOI: '10.1016/j.concog.2020.102946', type: 'journal-article', title: ['Depersonalization and the self'], 'container-title': ['Consciousness and Cognition'],
  author: [{ given: 'Anna', family: 'Ciaunica' }, { given: 'B', family: 'C' }, { given: 'D', family: 'E' }, { given: 'F', family: 'G' }], issued: { 'date-parts': [[2020, 5, 12]] },
  URL: 'http://dx.doi.org/10.1016/j.concog.2020.102946', abstract: '<jats:p>Un résumé.</jats:p>' } };
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (opts = {}, path = '/index.html#sources', microlink = 'ok', hostedMode = false) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.calls = [];
    await ctx.route('https://api.crossref.org/**', r => { p.calls.push(r.request().url()); r.fulfill({ contentType: 'application/json', body: JSON.stringify(CROSSREF) }); });
    await ctx.route('https://api.microlink.io/**', r => {
      p.calls.push(r.request().url());
      if (microlink === 'quota') return r.fulfill({ status: 429, contentType: 'application/json', body: '{"status":"fail"}' });
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success', data: { title: 'La lisière <img src=x onerror=window.__pwn=1>', publisher: 'Revue des sous-bois', date: '2026-09-01T08:00:00Z', description: 'Un texte.', url: 'https://www.sousbois.fr/lisiere/?utm_source=mastodon&fbclid=x' } }) });
    });
    await ctx.addInitScript(([d, h]) => { if (!h) window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, [JSON.stringify(demo), hostedMode]);
    await p.goto(BASE + path); await p.waitForTimeout(400); return p;
  };
  const data = p => storeJSON(p, 'selene-site-v1');
  const search = async (p, v) => { await p.fill('#srcIn', v); await p.click('[data-act="src-fetch"]'); await p.waitForTimeout(300); };

  console.log('un DOI, complété par Crossref');
  const p = await open();
  await search(p, 'https://doi.org/10.1016/J.CONCOG.2020.102946');
  let prev = (await p.textContent('.src-prev')).replace(/\s+/g, ' ');
  ok(p.calls.length === 1 && p.calls[0].includes('api.crossref.org/works/10.1016'), 'un seul appel, à Crossref, pour le DOI reconnu dans l’adresse');
  ok(prev.includes('Depersonalization and the self') && prev.includes('Anna Ciaunica, B C, D E et al.') && prev.includes('Consciousness and Cognition') && prev.includes('2020'), 'aperçu : titre, auteurs, revue, date');
  await p.click('[data-act="src-keep"]'); await p.waitForTimeout(250);
  let e = (await data(p)).modules.sources.entries[0];
  ok(e && e.src.doi === '10.1016/j.concog.2020.102946' && e.src.site === 'Consciousness and Cognition' && e.src.date === '2020-05-12' && e.tag === 'article' && e.subtitle.includes('Ciaunica') && e.status === 'À lire', 'gardée, avec ses références et le statut « À lire »');
  const link = await p.$eval('#main .src-link', a => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel }));
  ok(link.href.startsWith('https://') && link.target === '_blank' && link.rel.includes('noopener'), 'le lien vers l’original s’ouvre à part, sans accès à Selene');
  ok((await p.inputValue('#srcIn')) === '', 'le champ se vide');

  console.log('doublon, page, quota');
  await p.fill('#srcIn', '10.1016/j.concog.2020.102946'); await p.press('#srcIn', 'Enter'); await p.waitForTimeout(300);
  ok((await p.textContent('.src-prev')).includes('Déjà gardée') && await p.isDisabled('[data-act="src-keep"]'), 'Entrée lance la recherche ; le doublon est reconnu, « Garder » désactivé');
  await p.click('[data-act="src-cancel"]'); await p.waitForTimeout(150);
  await search(p, 'https://sousbois.fr/lisiere?utm_campaign=z');
  prev = await p.textContent('.src-prev');
  ok(p.calls.some(u => u.includes('api.microlink.io')) && prev.includes('<img src=x') && !(await p.evaluate(() => window.__pwn)), 'une page passe par Microlink ; un titre piégé s’affiche en texte');
  await p.click('[data-act="src-keep"]'); await p.waitForTimeout(250);
  e = (await data(p)).modules.sources.entries[1];
  ok(e.src.url === 'https://www.sousbois.fr/lisiere' && e.src.site === 'Revue des sous-bois' && e.src.date === '2026-09-01', 'adresse normalisée (traceurs retirés), site, date');
  const q = await open({}, '/index.html#sources', 'quota');
  await search(q, 'https://inconnu.example/texte');
  ok((await q.textContent('.src-prev')).includes('Métadonnées indisponibles'), 'quota épuisé : dit, et gardable quand même');
  await q.click('[data-act="src-keep"]'); await q.waitForTimeout(200);
  e = (await data(q)).modules.sources.entries[0];
  ok(e.src.url === 'https://inconnu.example/texte' && e.src.site === 'inconnu.example', 'gardée avec son adresse seule');
  await q.fill('#srcIn', 'rien du tout'); await q.click('[data-act="src-fetch"]'); await q.waitForTimeout(150);
  ok((await q.textContent('#toast')).includes('Ni lien ni DOI'), 'ni lien ni DOI : aucun appel, un message');

  console.log('depuis la boîte de réception');
  const n = await open({}, '/index.html#inbox');
  await n.click('[data-id="n1"] [data-act="note-source"]'); await n.waitForTimeout(400);
  const d = await data(n), s = d.modules.sources.entries[0];
  ok(!d.modules.inbox.entries.length && s && s.src.doi === '10.1016/j.concog.2020.102946' && s.origin && s.origin.from === 'Capture' && s.origin.text.includes('à lire'), 'la note devient une source, avec sa provenance');

  console.log('recevoir un lien depuis ailleurs (version hébergée, compte Supabase simulé)');
  const rows = new Map(), json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const supabase = route => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (u.pathname.startsWith('/auth/')) return json(route, 200, {});
    const uid = (u.searchParams.get('user_id') || '').replace('eq.', ''), row = rows.get(uid);
    if (m === 'GET') return json(route, 200, row ? [{ [u.searchParams.get('select')]: row[u.searchParams.get('select')] }] : []);
    if (m === 'POST') { for (const x of req.postDataJSON()) if (!rows.has(x.user_id)) rows.set(x.user_id, { board: {}, site: {}, ...x }); return route.fulfill({ status: 201, body: '' }); }
    if (row) Object.assign(row, req.postDataJSON()); return json(route, 200, [{ user_id: uid }]);
  };
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c' } });
  const hctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await hctx.route('https://*.supabase.co/**', supabase);
  const r = await hctx.newPage(); r.on('pageerror', e => errs.push(e.message));
  const shared = '/index.html?url=' + encodeURIComponent('https://exemple.org/texte?utm_source=x') + '&title=' + encodeURIComponent('Un texte trouvé') + '#accueil';
  await r.goto(BASE + shared); await r.waitForTimeout(500);
  ok(await r.isVisible('#authEmail') && (await r.evaluate(() => sessionStorage.getItem('selene-share'))).includes('exemple.org'), 'pas encore connectée : le lien attend, rien n’est déposé dans le vide');
  await r.evaluate(s => { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', 'u1'); }, session);
  await r.reload(); // un vrai rechargement : la session est lue au démarrage ; le lien est déposé une fois connectée
  const inbox = () => storeJSON(r, 'selene-site-v1').then(d => { const k = Object.keys(d.modules).find(x => d.modules[x].type === 'notes' && d.modules[x].config.inbox); return d.modules[k].entries.map(e => e.text); }).catch(() => []);
  let box = [];
  for (const end = Date.now() + 10000; Date.now() < end && !(box = await inbox()).some(x => x.includes('exemple.org'));) await r.waitForTimeout(100);
  ok(box.includes('Un texte trouvé — https://exemple.org/texte?utm_source=x'), 'connectée : le lien partagé devient une note de la boîte');
  ok((await r.evaluate(() => location.search)) === '' && !(await r.evaluate(() => sessionStorage.getItem('selene-share'))), 'l’adresse est nettoyée, la file vidée');
  // Le dépôt synchronisé avant de recharger : sinon sa dernière écriture (keepalive) part pendant le rechargement.
  await until(() => JSON.stringify(rows.get('u1') || {}).includes('Un texte trouvé'));
  await r.reload(); await r.waitForTimeout(700);
  const again = await storeJSON(r, 'selene-site-v1').then(d => Object.values(d.modules).filter(m => m.type === 'notes').flatMap(m => m.entries).length);
  ok(again === box.length, 'un rechargement ne le dépose pas deux fois');

  console.log('réglages et manifeste');
  await r.evaluate(() => location.hash = 'reglages'); await r.waitForTimeout(300);
  const bm = await r.getAttribute('[data-act="bookmarklet"]', 'href');
  ok(bm.startsWith('javascript:') && bm.includes('/index.html?url='), 'le favori « Envoyer à Selene » vise cette installation');
  await r.click('[data-act="bookmarklet"]'); await r.waitForTimeout(200);
  ok((await r.evaluate(() => location.hash)) === '#reglages' && (await r.textContent('#toast')).includes('barre de favoris'), 'cliqué dans Selene, il explique au lieu d’agir');
  const manifest = await r.evaluate(async () => (await fetch('manifest.webmanifest')).json());
  ok(manifest.share_target && manifest.share_target.params.url === 'url' && manifest.share_target.method === 'GET', 'Android : Selene figure dans le menu « Partager »');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
