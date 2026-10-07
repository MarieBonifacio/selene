/* Scénario de navigateur : Artist Watch dans Dehors (connexions externes, phase 2, vague 6c : docs/connexions.md).
   Version hébergée simulée (faux Supabase), MusicBrainz simulé ; pas besoin du passeur. Lancé par tests/browser/run.js. */
const { storeSet, storeJSON, until, ouvrir, entree, suivre, calme, fauxSupabase, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const U = n => `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`.slice(-36);
const iso = d => new Date(d).toISOString().slice(0, 10);
const demo = JSON.parse(fixture());
demo.modules.musique.config.music = true;
demo.modules.musique.entries = [
  { id: 'e1', title: 'Ulver', subtitle: 'Bergtatt', tag: '', due: '', text: '', status: 'À écouter', mb: { a: U(1), rg: U(2), y: '1995' } },
  { id: 'e2', title: 'Dead Can Dance', subtitle: '', tag: '', due: '', text: '', status: 'À écouter', mb: { a: U(7) } },
  { id: 'e3', title: 'Sans lien', subtitle: '', tag: '', due: '', text: '', status: 'À écouter' }
];
const GROUPS = {
  [U(1)]: [{ id: U(2), title: 'Bergtatt', 'first-release-date': '1995-02', 'primary-type': 'Album', 'secondary-types': [] },
    { id: U(3), title: 'Neptune <img src=x onerror=window.__pwn=1>', 'first-release-date': iso(Date.now() - 5 * 86400000), 'primary-type': 'Album', 'secondary-types': [] }],
  [U(7)]: [{ id: U(8), title: 'Dionysus', 'first-release-date': '2018', 'primary-type': 'Album', 'secondary-types': [] }]
};
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [], mb = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await fauxSupabase(ctx, (r, req, u) => u.pathname.startsWith('/functions/') ? r.fulfill({ status: 404, body: '' }) : undefined);
  await ctx.route('https://musicbrainz.org/**', r => { const u = new URL(r.request().url()); mb.push({ at: Date.now(), a: u.searchParams.get('artist') }); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ 'release-groups': GROUPS[u.searchParams.get('artist')] || [] }) }); });
  await ctx.route('https://coverartarchive.org/**', r => r.fulfill({ status: 404, body: '' }));
  // L'écart se mesure à l'envoi, dans la page, comme l'app le règle : à l'arrivée dans la route, la latence d'envoi s'y
  // ajoute ou s'en retranche (A26 : sous le processeur ralenti, 1 100 ms d'écart arrivaient à moins de 1 000).
  await ctx.addInitScript(() => {
    const envoyer = window.fetch; window.__mbEnvois = [];
    window.fetch = function (u, ...r) { if (String((u && u.url) || u).includes('musicbrainz.org')) window.__mbEnvois.push(Date.now()); return envoyer.call(this, u, ...r); };
  });
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [JSON.stringify(demo), session, UID]);
  const p = suivre(await ctx.newPage()); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#dehors'); await p.waitForTimeout(2000);
  const data = () => storeJSON(p, 'selene-site-v1');

  console.log('activer, première vérification');
  ok(!mb.length, 'rien n’est demandé tant qu’Artist Watch n’est pas coché');
  ok((await p.textContent('[data-act="dehors-artists"] >> xpath=..')).includes('2 artistes reliés'), 'le réglage dit combien d’artistes seront suivis (les reliés seulement)');
  await p.check('[data-act="dehors-artists"]'); await p.waitForTimeout(2800);
  ok(mb.length === 2 && mb.map(x => x.a).join() === [U(1), U(7)].join(), 'une requête par artiste relié');
  const envois = await p.evaluate(() => window.__mbEnvois);
  ok(envois.length >= 2 && envois[1] - envois[0] >= 1000, `une seconde entre deux requêtes (règle de MusicBrainz) (écart à l’envoi : ${envois[1] - envois[0]} ms)`);
  const t = (await p.textContent('.dehors')).replace(/\s+/g, ' ');
  ok(t.includes('Ulver — Neptune <img') && !t.includes('Bergtatt') && !t.includes('Dionysus') && !(await p.evaluate(() => window.__pwn)), 'le mois écoulé seulement ; un titre piégé reste du texte');
  ok((await p.textContent('#main h3')).includes('Musique') && t.includes('Sorties de tes artistes'), 'rangé sous Musique, au nom d’Artist Watch');
  ok((await data()).config.dehors.artists === true && !(await data()).config.dehors.feeds.length, 'réglage synchronisé, sans flux RSS pour autant');

  console.log('ajouter, marquer comme vu');
  await p.click(`[data-item="${U(3)}"] [data-act="dehors-mb-add"]`); await p.waitForTimeout(250);
  const e = (await data()).modules.musique.entries.find(x => x.mb && x.mb.rg === U(3));
  ok(e && e.title === 'Ulver' && e.subtitle.startsWith('Neptune') && e.mb.a === U(1) && /^\d{4}$/.test(e.mb.y), 'ajouté à Musique, relié à MusicBrainz');
  ok(!(await p.$(`[data-item="${U(3)}"]`)) && (await p.textContent('#main')).includes('Rien de neuf'), 'et quitte Dehors');
  await p.click('details.dehors-feeds summary', { timeout: 300 }).catch(() => {}); // s'il est là : sans délai court, Playwright attend 30 s

  console.log('une fois par semaine');
  mb.length = 0;
  await calme(p); await ouvrir(p, null, entree); await p.waitForTimeout(2500); // une absence ne s'attend pas : le délai court depuis le démarrage (A16)
  ok(!mb.length, 'rouvert dans la semaine : MusicBrainz n’est pas redemandé');
  { const c = await storeJSON(p, 'selene-dehors'); c.feeds['mb-artists'].at = await p.evaluate(() => Date.now()) - 8 * 86400000; await storeSet(p, 'selene-dehors', JSON.stringify(c)); }
  await calme(p); await ouvrir(p, null, entree); await until(() => mb.length >= 2);
  ok(mb.length === 2, 'une semaine plus tard : revérifié');
  ok(!(await p.$('.dehors [data-item]')), 'déjà vu, déjà ajouté : rien ne revient');

  console.log('désactiver');
  await p.uncheck('[data-act="dehors-artists"]'); await p.waitForTimeout(300);
  ok(!(await data()).config.dehors && !(await storeJSON(p, 'selene-dehors')).feeds['mb-artists'], 'décoché : réglage et cache retirés');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
