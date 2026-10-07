/* Scénario de navigateur : Musique et MusicBrainz (connexions externes, phase 1, vague 5b : docs/connexions.md). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const U = n => `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`.slice(-36);
const iso = d => new Date(d).toISOString().slice(0, 10);
const recent = iso(Date.now() - 30 * 86400000);
const demo = JSON.parse(fixture());
demo.modules.musique.config.music = true;
demo.modules.musique.entries = [
  { id: 'e1', title: 'Ulver', subtitle: '', tag: '', due: '', text: '', status: 'À écouter' },
  { id: 'e2', title: 'Dead Can Dance', subtitle: '', tag: '', due: '', text: '', status: 'À écouter' }
];
const ARTISTS = { Ulver: [{ id: U(1), name: 'Ulver', disambiguation: 'Norwegian band', country: 'NO', 'life-span': { begin: '1993' } }, { id: U(9), name: 'Ulver', disambiguation: 'autre', country: 'SE' }],
  'Dead Can Dance': [{ id: U(7), name: 'Dead Can Dance', country: 'AU', 'life-span': { begin: '1981' } }] };
const GROUPS = {
  [U(1)]: [{ id: U(2), title: 'Bergtatt', 'first-release-date': '1995-02', 'primary-type': 'Album', 'secondary-types': [] },
    { id: U(3), title: 'Liminal Animals <img src=x onerror=window.__pwn=1>', 'first-release-date': recent, 'primary-type': 'Album', 'secondary-types': [] },
    { id: U(4), title: 'Live', 'first-release-date': '2013', 'primary-type': 'Album', 'secondary-types': ['Live'] }],
  [U(7)]: [{ id: U(8), title: 'Within the Realm of a Dying Sun', 'first-release-date': '1987', 'primary-type': 'Album', 'secondary-types': [] }]
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (mbDown = false) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    // L'écart se mesure à l'envoi, dans la page, comme l'app le règle : à l'arrivée dans la route, la latence d'envoi s'y
    // ajoute ou s'en retranche (A26 : sous le processeur ralenti, 1 100 ms d'écart arrivaient à moins de 1 000).
    await ctx.addInitScript(() => {
      const envoyer = window.fetch; window.__mbEnvois = [];
      window.fetch = function (u, ...r) { if (String((u && u.url) || u).includes('musicbrainz.org')) window.__mbEnvois.push(Date.now()); return envoyer.call(this, u, ...r); };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.mb = [];
    await ctx.route('https://musicbrainz.org/**', r => {
      const u = new URL(r.request().url()); p.mb.push({ at: Date.now(), path: u.pathname });
      if (mbDown) return r.fulfill({ status: 503, body: '' });
      if (u.pathname.endsWith('/artist')) { const name = (u.searchParams.get('query').match(/"(.*)"/) || [])[1]; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ artists: ARTISTS[name] || [] }) }); }
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ 'release-groups': GROUPS[u.searchParams.get('artist')] || [] }) });
    });
    await ctx.route('https://coverartarchive.org/**', r => r.request().url().includes(U(2)) ? r.fulfill({ contentType: 'image/png', body: PNG }) : r.fulfill({ status: 404, body: '' }));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html#musique'); await p.waitForTimeout(400); return p;
  };
  const data = p => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.musique.entries);

  console.log('préciser un album');
  const p = await open();
  await p.click('[data-id="e1"] [data-act="mb-open"]:has-text("préciser")'); await p.waitForTimeout(1500);
  ok(await p.isVisible('#sheet.drawer') && (await p.textContent('#sheet')).includes('Plusieurs artistes portent ce nom'), 'deux Ulver : Selene demande lequel');
  await p.click(`#sheet [data-act="mb-artist"][data-a="${U(1)}"]`); await p.waitForTimeout(1600);
  const titles = await p.$$eval('#sheet .mb-albums b', bs => bs.map(x => x.textContent));
  ok(titles.length === 2 && titles[0] === 'Bergtatt' && !titles.join().includes('Live'), 'discographie studio, dans l’ordre, sans le live');
  ok(!(await p.evaluate(() => window.__pwn)) && titles[1].includes('<img'), 'un titre piégé s’affiche en texte');
  await p.click(`#sheet [data-rg="${U(2)}"] [data-act="mb-pick"]`); await p.waitForTimeout(300);
  let e = (await data(p)).find(x => x.id === 'e1');
  ok(e.subtitle === 'Bergtatt' && e.mb.a === U(1) && e.mb.rg === U(2) && e.mb.y === '1995', 'album choisi : titre, identifiants, année');
  ok((await p.textContent('#toast')).includes("« Bergtatt » : c'est noté."), 'et Selene le dit : « « Bergtatt » : c’est noté. »');
  await p.click(`#sheet [data-rg="${U(3)}"] [data-act="mb-add"]`); await p.waitForTimeout(300);
  ok((await data(p)).some(x => x.title === 'Ulver' && x.mb && x.mb.rg === U(3)), 'un autre album ajouté d’un geste');
  ok(!(await p.$(`#sheet [data-rg="${U(3)}"] [data-act="mb-add"]`)), 'et ne se propose plus');
  const envois = await p.evaluate(() => window.__mbEnvois), gaps = envois.slice(1).map((t, i) => t - envois[i]);
  ok(gaps.every(g => g >= 1000), `une requête par seconde au plus (écarts à l’envoi : ${gaps.join(', ')} ms)`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const cover = await p.$eval('[data-id="e1"] img.cover', i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, hidden: i.classList.contains('none') }));
  ok(cover.src.includes(`release-group/${U(2)}/front-250`) && cover.ok && !cover.hidden && (await p.textContent('[data-id="e1"]')).includes('(1995)'), 'la pochette et l’année dans la liste');
  await p.waitForTimeout(300);
  ok(await p.$eval(`img.cover[src*="${U(3)}"]`, i => i.classList.contains('none')), 'une pochette absente s’efface au lieu d’une icône cassée');

  console.log('un seul candidat, nouvelles sorties');
  await p.click('[data-id="e2"] [data-act="mb-open"]:has-text("préciser")'); await p.waitForTimeout(2600);
  ok((await p.textContent('#sheet')).includes('Within the Realm') && !(await p.textContent('#sheet')).includes('Plusieurs artistes'), 'un seul artiste de ce nom : directement sa discographie');
  await p.click(`#sheet [data-act="mb-pick"]`); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => localStorage.removeItem('selene-mb-seen'));
  await p.click('[data-act="mb-new"]'); await p.waitForTimeout(2800);
  let t = (await p.textContent('#sheetBody')).replace(/\s+/g, ' '); // sans le message qui se loge dans la feuille
  ok(t.includes('Liminal Animals') && !t.includes('Bergtatt') && !t.includes('Within the Realm'), 'première vérification : l’année écoulée seulement');
  ok(t.includes('déjà là'), 'ce qui est déjà dans la liste est signalé');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('[data-act="mb-new"]'); await p.waitForTimeout(2800);
  ok((await p.textContent('#sheet')).includes('Rien de neuf'), 'seconde vérification le même jour : rien de neuf');

  console.log('MusicBrainz muet, réglage');
  const d = await open(true);
  await d.click('[data-id="e1"] [data-act="mb-open"]:has-text("préciser")'); await d.waitForTimeout(600);
  ok((await d.textContent('#sheet')).includes('ne répond pas') && await d.isVisible('#sheet [data-act="mb-retry"]'), 'service muet : dit, et « Réessayer »');
  await d.keyboard.press('Escape'); await d.evaluate(() => location.hash = 'reglages'); await d.waitForTimeout(300);
  ok(!!(await d.$('[data-act="col-music"]')), 'réglable par collection (dans le bloc de réglages du module)');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
