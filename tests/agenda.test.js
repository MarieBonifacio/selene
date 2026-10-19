/* Agenda (src/core/agenda.js) : lire un calendrier iCal, déplier ses récurrences, ne garder qu'une fenêtre. */
process.env.TZ = 'Europe/Paris'; // les heures murales et les journées entières se lisent en heure de Paris
const { test } = require('node:test');
const assert = require('node:assert/strict');

const A = require('../src/core/agenda.js');
const cal = (...evs) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...evs.flatMap(e => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const P = (d, h = 0, m = 0) => new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+02:00`).getTime();

test('lecture : lignes repliées, échappements, UTC, fuseau, journée entière, annulé écarté', () => {
  const ev = A.icsParse(cal(
    ['UID:1', 'SUMMARY:Chantier : plom', ' bier\\, vérifier la fuite', 'LOCATION:Salle de bain', 'DTSTART;TZID=Europe/Paris:20260929T140000', 'DTEND;TZID=Europe/Paris:20260929T150000'],
    ['UID:2', 'SUMMARY:Lecture', 'DTSTART:20260929T160000Z'],
    ['UID:3', 'SUMMARY:Anniversaire', 'DTSTART;VALUE=DATE:20260930'],
    ['UID:4', 'SUMMARY:Annulé', 'STATUS:CANCELLED', 'DTSTART:20260929T100000Z'],
    ['UID:5', 'SUMMARY:Tokyo', 'DTSTART;TZID=Asia/Tokyo:20260929T090000']));
  assert.equal(ev.length, 4);
  assert.equal(ev[0].summary, 'Chantier : plombier, vérifier la fuite'); assert.equal(ev[0].location, 'Salle de bain');
  assert.equal(ev[0].start, P('2026-09-29', 14)); assert.equal(ev[0].end, P('2026-09-29', 15));
  assert.equal(ev[1].start, Date.UTC(2026, 8, 29, 16)); assert.equal(ev[1].end - ev[1].start, 3600000);
  assert.ok(ev[2].allDay); assert.equal(ev[2].start, new Date(2026, 8, 30).getTime()); assert.equal(ev[2].end - ev[2].start, 86400000);
  assert.equal(ev[3].start, Date.UTC(2026, 8, 29, 0)); // 9 h à Tokyo = minuit UTC
});

test('récurrences : hebdomadaire par jours, quotidienne limitée, exception déplacée, exclusion', () => {
  const ev = A.icsParse(cal(
    ['UID:w', 'SUMMARY:Yoga', 'DTSTART;TZID=Europe/Paris:20260901T183000', 'DTEND;TZID=Europe/Paris:20260901T193000', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'EXDATE;TZID=Europe/Paris:20261001T183000'],
    ['UID:d', 'SUMMARY:Arroser', 'DTSTART;VALUE=DATE:20260927', 'RRULE:FREQ=DAILY;COUNT=3'],
    ['UID:w', 'SUMMARY:Yoga (déplacé)', 'RECURRENCE-ID;TZID=Europe/Paris:20260929T183000', 'DTSTART;TZID=Europe/Paris:20260929T200000', 'DTEND;TZID=Europe/Paris:20260929T210000']));
  const win = A.icsBetween(ev, P('2026-09-29'), P('2026-10-03'));
  assert.deepEqual([...win.map(o => `${o.summary}@${new Date(o.start).toISOString()}`)], [
    `Arroser@${new Date(2026, 8, 29).toISOString()}`,
    `Yoga (déplacé)@${new Date(P('2026-09-29', 20)).toISOString()}`
  ]); // jeudi 1er octobre exclu ; l'arrosage s'arrête après trois jours (27, 28, 29)
  const nov = A.icsBetween(ev, P('2026-11-03'), P('2026-11-04'));
  assert.equal(nov.length, 1); assert.equal(nov[0].start, new Date(2026, 10, 3, 18, 30).getTime(), 'après le changement d’heure, toujours 18 h 30 à Paris');
  const monthly = A.icsParse(cal(['UID:m', 'SUMMARY:Loyer', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY']));
  assert.deepEqual([...A.icsBetween(monthly, new Date(2026, 1, 1).getTime(), new Date(2026, 3, 1).getTime()).map(o => `${new Date(o.start).getMonth() + 1}/${new Date(o.start).getDate()}`)], ['3/31'], 'un 31 n’existe pas en février : sauté ; le 31 mars, si');
});

test('écriture : un événement en journées entières, relu tel quel ; échappements, repli à 75 octets, fin exclue (TU-AGD-03)', () => {
  const ics = A.icsEvent({ uid: 't1.chantier@selene', stamp: Date.UTC(2026, 9, 17, 8, 0, 0), start: '2026-11-14', end: '2026-11-15',
    summary: 'Exposition « Lumières du Nord », salle 2; étage \\ fin', location: 'La Condition publique, Roubaix',
    url: 'https://openagenda.com/lille/events/3', description: 'Roubaix\ndu 14 au 15 novembre 2026\n' + 'é'.repeat(60) + '🌙'.repeat(30) });
  const lines = ics.split('\r\n');
  assert.equal(lines.pop(), '', 'chaque ligne finit par CRLF');
  assert.ok(lines.every(l => Buffer.byteLength(l) <= 75), 'aucune ligne au-delà de 75 octets');
  assert.ok(!ics.replace(/\r\n/g, '').includes('\n') && !ics.includes('�'), 'pas de saut nu, aucun caractère coupé');
  for (const l of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:t1.chantier@selene', 'DTSTAMP:20261017T080000Z', 'DTSTART;VALUE=DATE:20261114',
    'DTEND;VALUE=DATE:20261116', 'SUMMARY:Exposition « Lumières du Nord »\\, salle 2\\; étage \\\\ fin', 'URL:https://openagenda.com/lille/events/3', 'END:VCALENDAR'])
    assert.ok(lines.includes(l), `ligne attendue : ${l}`);
  const [e] = A.icsParse(ics);
  assert.equal(e.summary, 'Exposition « Lumières du Nord », salle 2; étage \\ fin');
  assert.equal(e.location, 'La Condition publique, Roubaix');
  assert.ok(e.allDay && e.end - e.start === 2 * 86400000, 'deux journées entières, la fin exclue');
  // Une seule journée : DTEND au lendemain ; une fin avant le début compte pour une journée ; une adresse http est écartée.
  const one = A.icsEvent({ uid: 'x', stamp: 0, start: '2026-12-31', end: '2026-12-01', summary: 'Réveillon', url: 'http://exemple.fr' });
  assert.ok(one.includes('DTEND;VALUE=DATE:20270101\r\n') && !one.includes('URL:') && !one.includes('LOCATION:'), 'une journée, sans adresse non sûre ni lieu vide');
  assert.throws(() => A.icsEvent({ uid: 'x', stamp: 0, start: '2026-02-30', summary: 'x' }), /Date invalide/);
});
