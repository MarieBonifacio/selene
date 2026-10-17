/* Scénario de navigateur : Radar culturel (connexions externes, phase 1, vague 5d : docs/connexions.md). Lancé par tests/browser/run.js. */
const { storeSet, storeJSON, until, fauxSupabase, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const LILLE = { name: 'Lille, Hauts-de-France, France', lat: 50.6, lon: 3.1, weather: false, realMoon: true };
const site = (sky, words) => { const d = JSON.parse(fixture()); d.config.sky = sky; if (words) d.config.radar = { words }; return JSON.stringify(d); };
const rec = (uid, title, from, to, extra = {}) => ({ uid, title_fr: title, firstdate_begin: from + 'T18:00:00+00:00', lastdate_end: (to || from) + 'T22:00:00+00:00',
  location_name: 'La Condition publique', location_city: 'Roubaix', canonicalurl: `https://openagenda.com/lille/events/${uid}`, keywords_fr: [], description_fr: '', ...extra });
const RESULTS = [
  rec(1, 'Marché aux puces', '2026-09-29'),
  rec(2, 'Nuit de la poésie <img src=x onerror=window.__pwn=1>', '2026-10-02', null, { description_fr: '<p>Lectures à voix haute, micro ouvert.</p>' }),
  rec(3, 'Exposition « Lumières du Nord »', '2026-09-01', '2026-11-15', { keywords_fr: ['Photographie'] }),
  rec(4, 'Soirée jazz manouche', '2026-10-06', null, { location_name: 'Le Biplan', location_city: 'Lille' }),
  ...[5, 6, 7, 8].map(n => rec(n, `Jazz au bar ${n}`, `2026-10-${String(n + 3).padStart(2, '0')}`))
];
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const open = async (sky, words, mode = 'ok', hash = '', hosted = false) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris', serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    p.asked = []; p.passeur = [];
    await ctx.route('https://public.opendatasoft.com/**', r => {
      const u = new URL(r.request().url()); p.asked.push(u);
      if (mode === 'cors') return r.abort('failed'); // ce que voit le navigateur quand le portail n'envoie pas d'en-tête CORS
      if (mode === 'down') return r.fulfill({ status: 503, body: '' });
      if (mode === 'renamed' && u.searchParams.get('select')) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error_code":"ODSQLError"}' });
      r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(RESULTS) }); // l’export : une liste
    });
    await fauxSupabase(ctx, r => {
      const req = r.request();
      if (new URL(req.url()).pathname === '/functions/v1/passeur') { const q = req.postDataJSON(); p.passeur.push(q); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 200, url: q.url, type: 'application/json; charset=utf-8', texte: JSON.stringify(RESULTS) }) }); }
    });
    const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.parse('2026-09-28T08:00:00Z') / 1000) + 3600, user: { id: '0b8f0c2e-1111-2222-3333-444455556666', email: 'a@b.c' } });
    await ctx.addInitScript(([d, h, s]) => { if (!h) window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); if (h) { localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', '0b8f0c2e-1111-2222-3333-444455556666'); } } }, [site(sky, words), hosted, session]);
    await p.clock.setFixedTime(new Date('2026-09-28T10:00:00+02:00')); await p.goto(BASE + '/index.html' + hash); await p.waitForTimeout(500);
    return p;
  };
  const sheet = async p => (await p.textContent('#sheetBody')).replace(/\s+/g, ' ');

  console.log('à la demande, depuis l’accueil');
  const p = await open(LILLE, 'Poésie, jazz, photographie');
  ok(!p.asked.length, 'rien n’est demandé à l’ouverture : on tire, rien n’est poussé');
  await p.click('[data-act="radar-open"]'); await p.waitForTimeout(400);
  ok(p.asked.length === 1, 'un appel, au clic');
  const u = p.asked[0], all = decodeURIComponent(u.toString()).toLowerCase();
  ok(!/poesie|poésie|jazz|photo/.test(all) && u.searchParams.get('where').includes("POINT(3.1 50.6)"), 'le portail reçoit la zone et les dates, jamais les mots');
  const titles = await p.$$eval('#sheet .radar b', bs => bs.map(x => x.textContent));
  ok(titles.length === 5 && titles[0].startsWith('Exposition') && titles[1].startsWith('Nuit de la poésie') && titles[2] === 'Soirée jazz manouche' && !titles.includes('Marché aux puces'), `cinq au plus, du plus tôt au plus tard, filtrés par tes mots (${titles.join(' | ')})`);
  let t = await sheet(p);
  ok(t.includes('parle de : Poésie, jazz, photographie') && t.includes('en cours, jusqu\'au 15 novembre') && t.includes('vendredi 2 octobre') && t.includes('La Condition publique, Roubaix'), 'quand et où, en clair');
  ok(t.includes('2 autres correspondent aussi') && !(await p.$('#sheet [data-act="radar-more"]')), 'le reste est compté, pas déroulé');
  ok(titles[1] === 'Nuit de la poésie' && !(await p.evaluate(() => window.__pwn)), 'un titre piégé perd ses balises, rien ne s’exécute');
  const link = await p.$eval('#sheet .radar a', a => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel }));
  ok(link.href.startsWith('https://openagenda.com/') && link.target === '_blank' && link.rel.includes('noopener'), 'le lien vers l’événement s’ouvre à part');
  await p.click('#sheet .radar li:nth-child(2) [data-act="radar-keep"]'); await p.waitForTimeout(250);
  const box = await storeJSON(p, 'selene-site-v1').then(d => { const k = Object.keys(d.modules).find(x => d.modules[x].type === 'notes' && d.modules[x].config.inbox); return d.modules[k].entries.map(e => e.text); });
  ok(box.some(x => x.startsWith('Nuit de la poésie') && x.includes('vendredi 2 octobre') && x.includes('https://openagenda.com/lille/events/2')), '« garder » le dépose dans la boîte, avec la date et le lien');
  ok((await p.textContent('#sheet .radar li:nth-child(2)')).includes('gardé'), 'et le dit');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('[data-act="radar-open"]'); await p.waitForTimeout(300);
  ok(p.asked.length === 1 && (await p.$$('#sheet .radar li')).length === 5, 'rouvert dans l’heure : servi par le cache de l’appareil, sans nouvel appel');

  console.log('en faire une sortie, puis l’ajouter au calendrier (E2)');
  // Le jeu de démo n'a qu'un espace Tâches, Chantier : la sortie y va sans question.
  const expo = p.locator('#sheet .radar li', { hasText: 'Exposition' });
  ok(await expo.locator('[data-act="radar-out"]').count() === 1 && await expo.locator('[data-act="radar-keep"]').count() === 1, '« en faire une sortie » à côté de « garder »');
  await expo.locator('[data-act="radar-out"]').click(); await p.waitForSelector('#dlg[open]');
  ok((await p.textContent('#dlg h2')) === 'Modifier la tâche' && await p.inputValue('#dlg [name="title"]') === 'Exposition « Lumières du Nord »', 'le formulaire s’ouvre, prérempli');
  // L'enregistrement se fait dans l'événement « close » de la boîte, qui passe par la file d'attente : on attend l'état,
  // pas un délai (A52).
  await p.fill('#dlg [name="steps"]', 'Réserver'); await p.fill('#dlg [name="cost"]', '12'); await p.click('#dlg button[value="save"]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.chantier.entries.some(t => (t.steps || []).length), null, { timeout: 5000 }).catch(() => {});
  let taches = (await storeJSON(p, 'selene-site-v1')).modules.chantier.entries;
  const e1 = taches.find(x => x.title.startsWith('Exposition'));
  ok(e1 && e1.due === '2026-11-15' && e1.room === 'La Condition publique' && /^Roubaix\ndu 1(er)? septembre au 15 novembre 2026\nhttps:\/\/openagenda\.com\/lille\/events\/3$/.test(e1.note) && e1.steps[0].t === 'Réserver' && e1.cost === 12,
    `déjà commencée : échéance au dernier jour, la salle en lieu, la ville, les dates et le lien en note (${JSON.stringify(e1 && { due: e1.due, room: e1.room, note: e1.note })})`);
  ok((await expo.textContent()).includes('sortie prévue'), 'la feuille le dit');
  await p.locator('#sheet .radar li', { hasText: 'Soirée jazz manouche' }).locator('[data-act="radar-out"]').click(); await p.waitForSelector('#dlg[open]');
  await p.click('#dlg button[value="cancel"]'); await p.waitForTimeout(250);
  taches = (await storeJSON(p, 'selene-site-v1')).modules.chantier.entries;
  const e2 = taches.find(x => x.title === 'Soirée jazz manouche');
  ok(e2 && e2.due === '2026-10-06' && e2.room === 'Le Biplan' && e2.note.startsWith('Lille\nle mardi 6 octobre 2026'), 'à venir : échéance au premier jour ; « Annuler » dans le formulaire garde la tâche, comme un rangement depuis la boîte');
  await p.keyboard.press('Escape'); await p.evaluate(() => { location.hash = 'chantier'; }); await p.waitForTimeout(300);
  const li = p.locator('#main li[data-task]', { hasText: 'Soirée jazz manouche' }).first();
  await li.locator('[data-act="task-open"]').click();
  ok(await li.locator('.note a[href="https://openagenda.com/lille/events/4"]').count() === 1, 'dans la tâche, le lien de l’événement se clique');
  const [dl] = await Promise.all([p.waitForEvent('download'), li.locator('[data-act="task-ics"]').click()]);
  const ics = require('node:fs').readFileSync(await dl.path(), 'utf8'), [ev] = require('../../src/core/agenda.js').icsParse(ics);
  ok(dl.suggestedFilename() === 'soiree-jazz-manouche-2026-10-06.ics' && ics.includes('DTSTART;VALUE=DATE:20261006\r\n') && ics.includes('URL:https://openagenda.com/lille/events/4\r\n') && ev && ev.summary === 'Soirée jazz manouche' && ev.location === 'Le Biplan' && ev.allDay,
    `« Ajouter à mon calendrier » donne un .ics d’une journée, relu tel quel (${dl.suggestedFilename()})`);
  // Sans espace Tâches : « garder » seul.
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('selene-site-v1')); d.config.modules.find(m => m.id === 'chantier').on = false; localStorage.setItem('selene-site-v1', JSON.stringify(d)); });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400); await p.click('[data-act="radar-open"]'); await p.waitForTimeout(300);
  ok(!(await p.$('#sheet [data-act="radar-out"]')) && (await p.$$('#sheet [data-act="radar-keep"]')).length > 0, 'sans espace Tâches : pas de « en faire une sortie », « garder » reste');

  // Deux espaces Tâches : on choisit où, puis le formulaire de la tâche suit ; un type « Sortie » est pris s'il existe.
  const deux = await open(LILLE, 'jazz');
  await deux.evaluate(() => { const d = JSON.parse(localStorage.getItem('selene-site-v1')); d.modules.sorties = { type: 'taches', label: 'Sorties', config: { ...d.modules.chantier.config, cats: ['Billet', 'Sortie'] }, entries: [] }; d.config.modules.push({ id: 'sorties', on: true }); localStorage.setItem('selene-site-v1', JSON.stringify(d)); });
  await deux.goto(BASE + '/index.html'); await deux.waitForTimeout(400); await deux.click('[data-act="radar-open"]'); await deux.waitForTimeout(300);
  await deux.locator('#sheet .radar li', { hasText: 'Soirée jazz manouche' }).locator('[data-act="radar-out"]').click(); await deux.waitForSelector('#dlg[open]');
  ok((await deux.textContent('#dlg h2')) === 'En faire une sortie' && (await deux.$$eval('#dlg [name="mod"] option', o => o.map(x => x.textContent))).join() === 'Chantier,Sorties', 'deux espaces Tâches : on choisit lequel');
  // Le formulaire de la tâche s'ouvre dans le « close » du choix, par la file d'attente : on l'attend, sans délai fixe.
  await deux.selectOption('#dlg [name="mod"]', 'sorties'); await deux.click('#dlg button[value="save"]');
  await deux.waitForFunction(() => (document.querySelector('#dlg[open] h2') || {}).textContent === 'Modifier la tâche', null, { timeout: 5000 }).catch(() => {});
  ok(await deux.isVisible('#dlg[open]') && (await deux.textContent('#dlg h2')) === 'Modifier la tâche', 'puis le formulaire de la tâche');
  await deux.click('#dlg button[value="save"]'); await deux.waitForTimeout(250);
  const so = (await storeJSON(deux, 'selene-site-v1')).modules;
  ok(so.sorties.entries.length === 1 && so.sorties.entries[0].cat === 'Sortie' && !so.chantier.entries.length, 'la sortie va dans l’espace choisi, au type « Sortie »');

  console.log('portail changé, portail muet');
  const r = await open(LILLE, 'jazz', 'renamed');
  await r.click('[data-act="radar-open"]'); await r.waitForTimeout(400);
  ok(r.asked.length === 2 && !r.asked[1].searchParams.get('select') && (await r.$$('#sheet .radar li')).length === 5, 'un champ inconnu (400) : second essai sans sélection, et ça passe');
  const d = await open(LILLE, 'jazz', 'down');
  await d.click('[data-act="radar-open"]'); await d.waitForTimeout(400);
  ok((await sheet(d)).includes('répond 503') && await d.isVisible('#sheet [data-act="radar-open"]'), 'portail en panne : dit, et « Réessayer »');

  console.log('CORS fermé (comme sur l’ancien portail de la MEL) : le passeur prend le relais');
  const c = await open(LILLE, 'jazz', 'cors', '', true);
  await c.click('[data-act="radar-open"]'); await until(() => c.passeur.length >= 1); // la réponse du passeur, pas un délai (BL-22)
  await c.waitForFunction(() => document.querySelectorAll('#sheet .radar li').length === 5, null, { timeout: 10000 }).catch(() => {});
  ok(c.asked.length === 1 && c.passeur.length === 1 && c.passeur[0].genre === 'json' && c.passeur[0].url.startsWith('https://public.opendatasoft.com/') && (await c.$$('#sheet .radar li')).length === 5, 'lecture directe refusée : le passeur lit l’agenda (genre json), les événements s’affichent');
  await c.keyboard.press('Escape'); await storeSet(c, 'selene-radar', null); await c.click('[data-act="radar-open"]'); await c.waitForTimeout(500);
  ok(c.asked.length === 1 && c.passeur.length === 2, 'la porte fermée est retenue : ensuite, directement par le passeur');
  const a = await open(LILLE, 'jazz', 'cors');
  await a.click('[data-act="radar-open"]'); await a.waitForTimeout(400);
  ok((await sheet(a)).includes('il faut ton passeur'), 'sans passeur (artefact claude.ai) : dit ce qui manque');
  // Connectée, mais le passeur n'est pas ouvert à ce compte (refus retenu) : ne pas lui dire de se connecter (A72).
  const f = await open(LILLE, 'jazz', 'cors', '', true);
  await storeSet(f, 'selene-passeur-acces', JSON.stringify({ uid: '0b8f0c2e-1111-2222-3333-444455556666', etat: 'refuse', at: Date.now() }));
  await f.click('[data-act="radar-open"]'); await f.waitForFunction(() => (document.querySelector('#sheetBody') || {}).textContent.includes('passeur'), null, { timeout: 5000 }).catch(() => {});
  const dit = await sheet(f);
  ok(dit.includes("n'est pas ouvert à ce compte") && !dit.includes('version hébergée, connectée') && !f.passeur.length, `connectée, passeur fermé à ce compte : le dit, sans renvoyer à une connexion déjà faite (A72) (« ${dit.slice(0, 160)} »)`);

  console.log('réglages');
  const n = await open(LILLE, '', 'ok', '#reglages');
  ok(!(await n.$('[data-act="radar-open"]')), 'sans mots : pas de bouton');
  await n.fill('[data-act="radar-words"]', '  cinéma,   danse '); await n.press('[data-act="radar-words"]', 'Tab'); await n.waitForTimeout(200);
  ok((await storeJSON(n, 'selene-site-v1').then(d => d.config.radar.words)) === 'cinéma, danse', 'les mots sont gardés dans le compte (synchronisés)');
  await n.evaluate(() => location.hash = ''); await n.waitForTimeout(300);
  ok(await n.isVisible('[data-act="radar-open"]'), 'et le bouton paraît sur l’accueil');
  console.log('partout en France');
  const m = await open({ ...LILLE, name: 'Marseille, Provence-Alpes-Côte d’Azur, France', lat: 43.3, lon: 5.4 }, 'jazz');
  await m.click('[data-act="radar-open"]'); await m.waitForTimeout(400);
  ok(m.asked.length === 1 && m.asked[0].searchParams.get('where').includes('POINT(5.4 43.3)') && (await sheet(m)).includes('Autour de Marseille'), 'loin de Lille : le radar cherche autour du lieu réglé');
  const s = await open(null, 'jazz', 'ok', '#reglages');
  ok((await s.textContent('#radar')).includes('Il lui faut un lieu') && !(await s.evaluate(() => { location.hash = ''; return new Promise(r => setTimeout(() => r(!!document.querySelector('[data-act="radar-open"]')), 300)); })), 'sans lieu : dit, et pas de bouton');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
