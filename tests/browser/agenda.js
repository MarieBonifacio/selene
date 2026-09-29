/* Scénario de navigateur : le calendrier dédié (connexions externes, phase 2, vague 6e : docs/connexions.md).
   Version hébergée simulée (faux Supabase, faux passeur qui sert un .ics), horloge fixée. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:a', 'SUMMARY:Chantier : plombier', 'LOCATION:Salle de bain', 'DTSTART;TZID=Europe/Paris:20260929T140000', 'DTEND;TZID=Europe/Paris:20260929T150000', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'SUMMARY:Yoga', 'DTSTART;TZID=Europe/Paris:20260901T183000', 'DTEND;TZID=Europe/Paris:20260901T193000', 'RRULE:FREQ=WEEKLY;BYDAY=TU', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c', 'SUMMARY:Anniversaire <img src=x onerror=window.__pwn=1>', 'DTSTART;VALUE=DATE:20260930', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:d', 'SUMMARY:Hier', 'DTSTART:20260928T100000Z', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
const SECRET = 'https://calendar.example/ical/secret-abc/basic.ics';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [], calls = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Europe/Paris' });
  await ctx.route('https://*.supabase.co/**', r => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/functions/v1/passeur') { const q = req.postDataJSON(); calls.push(q); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(q.url === SECRET ? { status: 200, url: q.url, type: 'text/calendar', texte: ICS } : { status: 404, url: q.url, erreur: 'le site répond 404' }) }); }
    r.fulfill({ contentType: 'application/json', body: req.method() === 'GET' ? '[]' : '{}' });
  });
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.parse('2026-09-29T07:00:00Z') / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  await ctx.addInitScript(([d, s, uid]) => { if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', d); localStorage.setItem('selene-auth-session', s); localStorage.setItem('selene-auth-last-uid', uid); } }, [fixture(), session, UID]);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-09-29T09:00:00+02:00'));
  await p.goto(BASE + '/index.html#reglages'); await p.waitForTimeout(600);

  console.log('régler l’adresse secrète');
  ok(await p.isVisible('#agenda') && !calls.length, 'une section Calendrier ; rien n’est lu sans adresse');
  await p.fill('[data-act="ics-url"]', 'webcal://calendar.example/ical/secret-abc/basic.ics'); await p.press('[data-act="ics-url"]', 'Tab'); await p.waitForTimeout(600);
  ok(calls.length === 1 && calls[0].genre === 'ics' && calls[0].url === SECRET, 'webcal:// devient https:// ; lu par le passeur, genre ics');
  ok((await p.evaluate(() => localStorage.getItem('selene-ics-url'))) === SECRET && !(await p.evaluate(() => localStorage.getItem('selene-site-v1'))).includes('secret-abc'), 'l’adresse reste dans ce navigateur, hors des données synchronisées');
  ok((await p.textContent('#agenda')).includes('Lu ') && (await p.inputValue('[data-act="ics-url"]')).startsWith('•'), 'l’état est dit ; l’adresse n’est pas réaffichée');

  console.log('aujourd’hui et demain');
  await p.evaluate(() => location.hash = ''); await p.waitForTimeout(400);
  const t = (await p.textContent('.agenda-day')).replace(/\s+/g, ' ');
  ok(t.includes('14 h–15 h') && t.includes('plombier') && t.includes('Salle de bain') && (await p.getAttribute('.agenda-day a.tag', 'href')) === '#chantier', 'le plombier à 14 h, rangé sous Chantier (préfixe), avec son lieu');
  ok(t.includes('18 h 30–19 h 30 Yoga'), 'une récurrence hebdomadaire, dépliée pour ce mardi');
  ok(!t.includes('Hier'), 'ce qui est passé ne s’affiche pas');
  const days = await p.$$eval('.agenda-day', ds => ds.map(d => d.textContent.replace(/\s+/g, ' ')));
  ok(days.length === 2 && days[1].includes('Demain') && days[1].includes('journée Anniversaire <img') && !(await p.evaluate(() => window.__pwn)), 'demain : la journée entière ; un titre piégé reste du texte');

  console.log('au plus une fois par heure, oublier');
  calls.length = 0;
  await p.reload(); await p.waitForTimeout(2200);
  ok(!calls.length && (await p.$('.agenda-day')), 'rouvert dans l’heure : servi par le cache, sans appel');
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('selene-ics')); c.at = Date.now() - 2 * 3600000; localStorage.setItem('selene-ics', JSON.stringify(c)); });
  await p.reload(); await p.waitForTimeout(2200);
  ok(calls.length === 1, 'plus tard : relu');
  await p.goto(BASE + '/index.html#reglages'); await p.waitForTimeout(300);
  await p.click('[data-act="ics-forget"]'); await p.waitForTimeout(200);
  await p.evaluate(() => location.hash = ''); await p.waitForTimeout(300);
  ok(!(await p.$('.agenda-day')) && !(await p.evaluate(() => localStorage.getItem('selene-ics-url') || localStorage.getItem('selene-ics'))), 'oublié : adresse et cache retirés, l’accueil se tait');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
