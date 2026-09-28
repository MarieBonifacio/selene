/* ================= agenda : un calendrier iCal dédié (pur, sans DOM ni réseau) =================
   Selene lit un seul calendrier (« Selene »), par son adresse iCal secrète, et n'en montre qu'aujourd'hui et demain.
   Ici : lire le format iCalendar (RFC 5545) juste assez — lignes repliées, journées entières, fuseaux (TZID), récurrences
   simples (RRULE quotidienne, hebdomadaire, mensuelle, annuelle ; INTERVAL, COUNT, UNTIL, BYDAY ; EXDATE).
   Le réseau (le passeur) et l'affichage sont dans types.js. Se teste seul (tests/agenda.test.js). */
const ICS_DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/* L'instant (UTC) d'une heure murale dans un fuseau : on devine, on mesure l'écart du fuseau, on corrige. */
function zoned(y, mo, d, h, mi, s, tz) {
  let t = Date.UTC(y, mo - 1, d, h, mi, s);
  if (!tz) return t;
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    for (let i = 0; i < 2; i++) {
      const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, +x.value]));
      t -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Date.UTC(y, mo - 1, d, h, mi, s);
    }
  } catch {} // fuseau inconnu : l'heure murale, prise pour UTC
  return t;
}
/* Une valeur DTSTART/DTEND/EXDATE → { t, allDay } ; `local` : la date d'une journée entière, en heure locale. */
function icsTime(v, params) {
  const m = String(v || "").trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h == null) return { t: new Date(+y, +mo - 1, +d).getTime(), allDay: true };
  if (z) return { t: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), allDay: false };
  const tz = (params.match(/TZID=("?)([^;:"]+)\1/) || [])[2];
  return { t: tz ? zoned(+y, +mo, +d, +h, +mi, +s, tz) : new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime(), allDay: false };
}
const icsUnescape = s => String(s || "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").replace(/\s+/g, " ").trim();
/* Le texte d'un calendrier → ses événements : { uid, summary, location, start, end, allDay, rrule, exdates }. */
function icsParse(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n"), out = [];
  let ev = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { ev = { exdates: [] }; continue; }
    if (line === "END:VEVENT") {
      if (ev && ev.start && ev.status !== "CANCELLED") {
        const end = ev.end ? ev.end.t : ev.start.t + (ev.start.allDay ? 86400000 : 3600000);
        out.push({ uid: ev.uid || "", summary: ev.summary || "(sans titre)", location: ev.location || "", start: ev.start.t, end: Math.max(end, ev.start.t), allDay: ev.start.allDay, rrule: ev.rrule || "", exdates: ev.exdates, recurrenceId: ev.recurrenceId || null });
      }
      ev = null; continue;
    }
    if (!ev) continue;
    const i = line.indexOf(":"); if (i < 0) continue;
    const head = line.slice(0, i), val = line.slice(i + 1), name = head.split(";")[0].toUpperCase(), params = head.slice(name.length);
    if (name === "SUMMARY") ev.summary = icsUnescape(val).slice(0, 200);
    else if (name === "LOCATION") ev.location = icsUnescape(val).slice(0, 200);
    else if (name === "UID") ev.uid = val.trim().slice(0, 300);
    else if (name === "STATUS") ev.status = val.trim().toUpperCase();
    else if (name === "DTSTART") ev.start = icsTime(val, params);
    else if (name === "DTEND") ev.end = icsTime(val, params);
    else if (name === "RRULE") ev.rrule = val.trim();
    else if (name === "RECURRENCE-ID") { const r = icsTime(val, params); if (r) ev.recurrenceId = r.t; }
    else if (name === "EXDATE") for (const x of val.split(",")) { const r = icsTime(x, params); if (r) ev.exdates.push(r.t); }
  }
  return out;
}
/* Les occurrences d'un événement dans [from, to[ (millisecondes). Une récurrence est dépliée jour après jour, en heure
   murale (un rendez-vous de 14 h reste à 14 h après le changement d'heure). 800 pas au plus : un garde-fou. */
function icsExpand(e, from, to) {
  const len = e.end - e.start, out = [];
  if (!e.rrule) return e.end > from && e.start < to ? [{ ...e }] : [];
  const r = Object.fromEntries(e.rrule.split(";").map(x => x.split("=")).map(([k, v]) => [String(k).toUpperCase(), v || ""]));
  const freq = r.FREQ, every = Math.max(1, +r.INTERVAL || 1), count = +r.COUNT || 0, until = r.UNTIL ? (icsTime(r.UNTIL, "") || {}).t : null;
  const byday = (r.BYDAY || "").split(",").map(x => ICS_DAYS[x.replace(/^[+-]?\d+/, "")]).filter(x => x != null);
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return e.end > from && e.start < to ? [{ ...e }] : [];
  const s0 = new Date(e.start), wall = (y, m, d) => new Date(y, m, d, s0.getHours(), s0.getMinutes(), s0.getSeconds()).getTime();
  const ex = new Set(e.exdates);
  let n = 0;
  for (let i = 0; i < 800; i++) {
    let cands;
    if (freq === "DAILY") cands = [wall(s0.getFullYear(), s0.getMonth(), s0.getDate() + i * every)];
    else if (freq === "WEEKLY") {
      const monday = s0.getDate() - ((s0.getDay() + 6) % 7) + i * 7 * every, days = byday.length ? byday : [s0.getDay()];
      cands = days.map(d => wall(s0.getFullYear(), s0.getMonth(), monday + ((d + 6) % 7))).sort((a, b) => a - b);
    } else if (freq === "MONTHLY") { const t = new Date(s0.getFullYear(), s0.getMonth() + i * every, 1); cands = t.getMonth() === new Date(s0.getFullYear(), s0.getMonth() + i * every, s0.getDate()).getMonth() ? [wall(t.getFullYear(), t.getMonth(), s0.getDate())] : []; }
    else { const y = s0.getFullYear() + i * every; cands = new Date(y, s0.getMonth(), s0.getDate()).getMonth() === s0.getMonth() ? [wall(y, s0.getMonth(), s0.getDate())] : []; }
    for (const t of cands) {
      if (t < e.start) continue;
      if ((until != null && t > until) || (count && n >= count) || t >= to) return out;
      n++;
      if (!ex.has(t) && t + len > from) out.push({ ...e, start: t, end: t + len });
    }
  }
  return out;
}
/* Ce qui se tient entre `from` et `to` : récurrences dépliées, exceptions (RECURRENCE-ID) à la place de l'occurrence
   qu'elles remplacent, dans l'ordre (les journées entières d'abord). */
function icsBetween(events, from, to) {
  const moved = new Set(events.filter(e => e.recurrenceId != null).map(e => `${e.uid}|${e.recurrenceId}`));
  const all = [];
  for (const e of events) {
    if (e.recurrenceId != null) { if (e.end > from && e.start < to) all.push({ ...e }); continue; }
    for (const o of icsExpand(e, from, to)) if (!moved.has(`${e.uid}|${o.start}`)) all.push(o);
  }
  return all.sort((a, b) => (b.allDay - a.allDay) || a.start - b.start);
}
