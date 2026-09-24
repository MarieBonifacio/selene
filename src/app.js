/* ================= utils ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const todayISO = () => iso(new Date());
const addDaysTo = (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((new Date(a + "T12:00") - new Date(b + "T12:00")) / 86400000);
const fmt = (s, o = { day: "numeric", month: "short" }) => s ? new Date(s + "T12:00").toLocaleDateString("fr-FR", o) : "";
const clone = o => JSON.parse(JSON.stringify(o));
const ago = s => { if (!s) return "jamais"; const n = diffDays(todayISO(), s); return n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} j`; };
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3400); }
function setSaving(t) { $("#saving").textContent = t; }

/* ================= stores ================= */

const MODULE_DEFS = {
  chantier: "Chantier", kundalini: "Kundalini", ecriture: "Écriture",
  moth: "october.moth", phidippus: "Phidippus", musique: "Musique", budget: "Budget", assistant: "Assistant", inbox: "Capture"
};
const OFF_BY_DEFAULT = ["assistant"];
const money = n => (+n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
let budMonth = iso(new Date()).slice(0, 7);
function siteSeed() {
  return {
    updatedAt: 0,
    config: { name: "Selene", palette: "nigredo", mode: "auto", labels: {}, groups: {},
      modules: Object.keys(MODULE_DEFS).map(id => ({ id, on: !OFF_BY_DEFAULT.includes(id) })),
      assistant: { model: "claude-sonnet-5", actions: true, share: { chantier: true, kundalini: true, ecriture: true, moth: true, phidippus: true, musique: true, budget: false, inbox: true } } },
    budget: { entries: [], envelopes: [["Travaux", 500], ["Courses", 300], ["Loisirs", 100], ["Abonnements", 50]].map(([name, limit]) => ({ id: uid(), name, limit })) },
    kundalini: { start: null, weeks: 12, perWeek: 5, sessions: [] },
    ecriture: { title: "La spiritualité du spectre dissociatif", goal: 40000, chapters: [], sessions: [], fragments: [] },
    moth: { posts: [] },
    phidippus: { name: "", feedEvery: 6, mistEvery: 3, log: [] },
    musique: { albums: ["Ulver", "Dead Can Dance", "Kate Bush", "Jonathan Hultén", "Chelsea Wolfe", "Zola Jesus", "iamamiwhoami"]
      .map(a => ({ id: uid(), artist: a, album: "", status: "À écouter", note: "" })) },
    inbox: { items: [] }
  };
}
const board = makeStore("selene-board-v1", "board/state", () => ({ updatedAt: 0, tasks: [] }));
const site = makeStore("selene-site-v1", "site/state", siteSeed);
// migration douce : récupère l'ancien cache local du chantier

function S() { // site data with defaults filled in
  const d = site.data, seed = siteSeed();
  for (const k of Object.keys(seed)) if (d[k] == null) d[k] = seed[k];
  for (const k of Object.keys(seed.config)) if (d.config[k] == null) d.config[k] = seed.config[k];
  for (const id of Object.keys(MODULE_DEFS)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: !OFF_BY_DEFAULT.includes(id) });
  for (const [mod, g] of Object.entries(GROUPERS)) d.config.groups[mod] = { on: true, by: Object.keys(g.fields)[0], sort: "name", hideDone: false, title: "", ...(d.config.groups[mod] || {}) };
  for (const k of Object.keys(seed)) if (typeof seed[k] === "object" && !Array.isArray(seed[k])) for (const f of Object.keys(seed[k])) if (d[k][f] == null) d[k][f] = seed[k][f];
  if (!Array.isArray(d.moth.posts)) d.moth.posts = [];
  d.moth.posts.forEach(p => { if (!["Idée", "Brouillon", "Prêt", "Publié"].includes(p.status)) p.status = "Idée"; });
  return d;
}
const label = id => S().config.labels[id] || MODULE_DEFS[id];
const enabled = id => { const m = S().config.modules.find(m => m.id === id); return m ? m.on : false; };

/* ================= moon ================= */
function moon() {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((Date.now() - ref) / 86400000) % syn + syn) % syn;
  const p = age / syn;
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const names = ["Nouvelle lune", "Premier croissant", "Premier quartier", "Gibbeuse croissante", "Pleine lune", "Gibbeuse décroissante", "Dernier quartier", "Dernier croissant"];
  const name = names[Math.floor(((p + 1 / 16) % 1) * 8)];
  const nextFull = p < .5 ? (0.5 - p) * syn : (1.5 - p) * syn;
  const nextNew = (1 - p) * syn;
  return { p, age, illum, name, nextFull: Math.round(nextFull), nextNew: Math.round(nextNew) };
}
function moonSVG(p, size = 100) {
  const r = 46, c = 50, rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  let d;
  if (p < .5) d = `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${p < .25 ? 0 : 1} ${c},${c - r}Z`;
  else d = `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${p < .75 ? 0 : 1} ${c},${c - r}Z`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Phase de la lune"><circle cx="50" cy="50" r="${r}" fill="var(--moon-shadow)" stroke="var(--rule)" stroke-width=".8"/><path d="${d}" fill="var(--moon)"/></svg>`;
}


/* ================= forêt ================= */
let TREES = null;
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function fir(x, base, hgt, w) {
  let d = "";
  for (let i = 0; i < 4; i++) {
    const top = base - hgt + i * hgt * .2, bot = Math.min(base - hgt * .05, top + hgt * .42), hw = w * (.28 + .2 * i);
    d += `M${x.toFixed(1)},${top.toFixed(1)}L${(x + hw).toFixed(1)},${bot.toFixed(1)}L${(x - hw).toFixed(1)},${bot.toFixed(1)}Z`;
  }
  return d + `M${(x - w * .05).toFixed(1)},${(base - hgt * .06).toFixed(1)}h${(w * .1).toFixed(1)}v${(hgt * .08).toFixed(1)}h${(-w * .1).toFixed(1)}Z`;
}
function buildTrees() {
  const r = rng(1729), far = [], near = [], stars = [];
  for (let x = -20; x < 1030; x += 14 + r() * 18) far.push(fir(x, 262 + r() * 10, x < 540 ? 55 + r() * 50 : 70 + r() * 70, 26 + r() * 14));
  for (let x = -30; x < 1040; x += 26 + r() * 40) { if (x > 380 && x < 470 && r() < .7) continue; const low = x < 540; near.push(fir(x, 300 + r() * 6, low ? 70 + r() * 80 : 100 + r() * 120, 40 + r() * 26)); }
  for (let i = 0; i < 70; i++) stars.push(`<circle cx="${(r() * 1000).toFixed(0)}" cy="${(r() * 170).toFixed(0)}" r="${(r() * .9 + .3).toFixed(2)}"/>`);
  TREES = { far: far.join(""), near: near.join(""), stars: stars.join("") };
}
function forestSVG(p) {
  if (!TREES) buildTrees();
  const r = 46, c = 50, rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  const lit = p < .5 ? `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${p < .25 ? 0 : 1} ${c},${c - r}Z`
                     : `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${p < .75 ? 0 : 1} ${c},${c - r}Z`;
  return `<svg class="scene" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Lune au-dessus d'une lisière de sapins">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bot)"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="var(--glow)"/><stop offset="1" stop-color="var(--glow)" stop-opacity="0"/></radialGradient>
      <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--mist)" stop-opacity="0"/><stop offset=".6" stop-color="var(--mist)"/><stop offset="1" stop-color="var(--mist)" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1000" height="300" fill="url(#sky)"/>
    <g fill="var(--moon)" opacity="var(--star)" style="opacity:var(--star)">${TREES.stars}</g>
    <circle cx="790" cy="92" r="${40 + 120 * (1 - Math.abs(1 - 2 * p)) * .9}" fill="url(#glow)"/>
    <g transform="translate(748 50) scale(.84)"><circle cx="50" cy="50" r="${r}" fill="var(--moon-shadow)" opacity=".85"/><path d="${lit}" fill="var(--moon)"/></g>
    <path d="${TREES.far}" fill="var(--tree-far)"/>
    <rect y="205" width="1000" height="75" fill="url(#mist)"/>
    <path d="${TREES.near}" fill="var(--tree-near)"/>
  </svg>`;
}


/* ================= groupes à pourcentage (génériques) ================= */
const gFilter = {};
const itemGroups = (items, keyFn, doneFn) => {
  const m = new Map();
  for (const it of items) { const k = keyFn(it) || "Sans groupe"; const g = m.get(k) || { name: k, num: 0, den: 0 }; g.den++; if (doneFn(it)) g.num++; m.set(k, g); }
  return [...m.values()].map(g => ({ ...g, pct: Math.round(100 * g.num / g.den), sub: `${g.num} sur ${g.den}` }));
};
const GROUPERS = {
  chantier: {
    fields: { room: "Pièce", cat: "Type", effort: "Effort" }, renamable: ["room", "cat"], filterable: true,
    items: () => board.data.tasks, key: (t, f) => f === "effort" ? ["", "Petit", "Moyen", "Gros"][t.effort || 1] : t[f], store: () => board,
    groups(f) { return itemGroups(this.items(), t => this.key(t, f), t => t.done); }
  },
  moth: {
    fields: { theme: "Thème" }, renamable: ["theme"], filterable: true,
    items: () => S().moth.posts, key: (p, f) => p[f], store: () => site,
    groups(f) { return itemGroups(this.items(), p => p[f], p => p.status === "Publié"); }
  },
  musique: {
    fields: { artist: "Artiste" }, renamable: ["artist"], filterable: true,
    items: () => S().musique.albums, key: (a, f) => a[f], store: () => site,
    groups(f) { return itemGroups(this.items(), a => a[f], a => a.status !== "À écouter"); }
  },
  kundalini: {
    fields: { week: "Semaine" }, renamable: [],
    groups() {
      const k = S().kundalini; if (!k.start) return [];
      const days = new Set(k.sessions.map(x => x.date)), now = todayISO(), cur = Math.min(52, +k.weeks || 12, Math.floor(diffDays(now, k.start) / 7) + 1), out = [];
      for (let w = 0; w < cur; w++) { let n = 0; for (let d = 0; d < 7; d++) if (days.has(addDaysTo(k.start, w * 7 + d))) n++; const den = +k.perWeek || 1; out.push({ name: `Semaine ${w + 1}`, num: n, den, pct: Math.min(100, Math.round(100 * n / den)), sub: `${n} sur ${den} séances`, order: w }); }
      return out;
    }
  },
  ecriture: {
    fields: { chapter: "Chapitre" }, renamable: [],
    groups() {
      const e = S().ecriture, sum = id => e.sessions.filter(s => (s.chapter || "") === id).reduce((a, s) => a + (+s.words || 0), 0);
      const out = e.chapters.map((c, i) => { const w = sum(c.id), g = +c.goal || 0; return { name: c.name || "Sans titre", num: w, den: g, pct: g ? Math.min(100, Math.round(100 * w / g)) : null, sub: g ? `${w.toLocaleString("fr-FR")} / ${g.toLocaleString("fr-FR")} mots` : `${w.toLocaleString("fr-FR")} mots`, order: i }; });
      const loose = sum(""); if (loose && e.chapters.length) out.push({ name: "Hors chapitre", num: loose, den: 0, pct: null, sub: `${loose.toLocaleString("fr-FR")} mots`, order: 999 });
      return out;
    }
  }
};
GROUPERS.budget = {
  fields: { cat: "Enveloppe" }, renamable: ["cat"], filterable: true,
  items: () => S().budget.entries, key: e => e.cat || "Sans enveloppe", store: () => site,
  groups() {
    const b = S().budget, sums = new Map();
    b.entries.filter(e => e.type === "dépense" && (e.date || "").slice(0, 7) === budMonth).forEach(e => { const k = e.cat || "Sans enveloppe"; sums.set(k, (sums.get(k) || 0) + (+e.amount || 0)); });
    const out = b.envelopes.map((v, i) => { const s = sums.get(v.name) || 0; sums.delete(v.name); return { name: v.name, num: s, den: +v.limit || 0, pct: +v.limit ? Math.round(100 * s / v.limit) : null, sub: `${money(s)} sur ${money(v.limit)}`, order: i }; });
    for (const [n, s] of sums) out.push({ name: n, num: s, den: 0, pct: null, sub: money(s), order: 900 });
    return out;
  }
};
const gcfg = mod => S().config.groups[mod];
function groupPanel(mod, hint) {
  const G = GROUPERS[mod], c = gcfg(mod);
  if (!c || !c.on) return "";
  let gs = G.groups(c.by);
  if (c.hideDone) gs = gs.filter(g => g.pct !== 100);
  const sorters = { name: (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "fr"), pct: (a, b) => (b.pct ?? -1) - (a.pct ?? -1), left: (a, b) => ((a.pct ?? 101)) - ((b.pct ?? 101)) };
  gs.sort(sorters[c.sort] || sorters.name);
  const active = gFilter[mod];
  const title = c.title || `Par ${G.fields[c.by].toLowerCase()}`;
  return `<section><div class="row" style="margin-bottom:4px"><h3 style="margin:0">${esc(title)}</h3><span class="spacer"></span><a class="btn ghost sm" href="#reglages" data-act="goto-groups" data-mod="${mod}">régler</a></div>
    <p class="hint">${hint}</p>
    <div class="rooms">${gs.map(g => `<button class="room ${active === g.name ? "active" : ""} ${g.pct > 100 ? "over" : ""}" ${G.filterable ? `data-act="grp-filter" data-mod="${mod}" data-g="${esc(g.name)}"` : "disabled"}><div class="fill" style="height:${Math.min(100, g.pct ?? 0)}%"></div><small>${esc(g.name)}</small><b>${g.pct == null ? "—" : g.pct + " %"}</b><small>${esc(g.sub)}</small></button>`).join("") || `<p class="empty">Rien à regrouper pour l'instant.</p>`}</div></section>`;
}
const gMatch = (mod, it) => { const v = gFilter[mod]; if (!v) return true; const G = GROUPERS[mod]; return (G.key(it, gcfg(mod).by) || "Sans groupe") === v; };

/* ================= chantier logic ================= */
function dueLabel(t) {
  if (!t.due) return { txt: "Sans date", cls: "" };
  const n = diffDays(t.due, todayISO());
  if (n < 0) return { txt: `En retard de ${-n} j`, cls: "late" };
  if (n === 0) return { txt: "Aujourd'hui", cls: "late" };
  if (n === 1) return { txt: "Demain", cls: "soon" };
  if (n <= 7) return { txt: `Dans ${n} j`, cls: "soon" };
  return { txt: fmt(t.due), cls: "" };
}
const rooms = () => [...new Set(board.data.tasks.map(t => t.room).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const openTasks = () => board.data.tasks.filter(t => !t.done);
const doneLines = ["Fait. L'appartement s'effondre un peu moins vite.", "Un de moins. L'entropie note ta résistance.", "Coché. Personne n'applaudit, alors je le fais.", "Terminé. Ton futur toi te déteste un peu moins.", "Réglé. Le chaos recule d'un centimètre."];
let roomFilter = "", catFilter = "", openId = null;

function taskHTML(t) {
  const d = dueLabel(t), sd = (t.steps || []).filter(s => s.d).length, ef = Math.min(3, Math.max(1, Math.round(+t.effort) || 1));
  return `<li class="item ${t.done ? "done" : ""} ${openId === t.id ? "open" : ""}" data-task="${esc(t.id)}">
    <input type="checkbox" class="check" data-act="task-done" ${t.done ? "checked" : ""} aria-label="Marquer comme fait">
    <div><button class="t-title" data-act="task-open">${esc(t.title)}</button>
      <div class="meta">${t.room ? `<span class="tag">${esc(t.room)}</span>` : ""}<span class="${t.done ? "" : d.cls}">${esc(d.txt)}</span><span>${esc(t.cat)}</span><span>${"●".repeat(ef)}${"○".repeat(3 - ef)}</span>${(t.steps || []).length ? `<span>${sd}/${t.steps.length} étapes</span>` : ""}${t.cost ? `<span>${esc(t.cost)} €</span>` : ""}</div></div>
    <button class="star ${t.today ? "on" : ""}" data-act="task-today" title="Faire aujourd'hui" aria-label="Faire aujourd'hui">★</button>
    <div class="details">
      ${(t.steps || []).length ? `<ul class="steps">${t.steps.map((s, i) => `<li><input type="checkbox" data-act="task-step" data-i="${i}" ${s.d ? "checked" : ""} id="s${esc(t.id)}-${i}"><label for="s${esc(t.id)}-${i}" style="font-weight:400;display:inline">${esc(s.t)}</label></li>`).join("")}</ul>` : ""}
      ${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}
      <div class="row"><button class="btn ghost sm" data-act="task-edit">Modifier</button><button class="btn ghost sm" data-act="task-del">Supprimer</button></div>
    </div></li>`;
}
function taskForm(t) {
  $("#roomList").innerHTML = rooms().map(r => `<option value="${esc(r)}">`).join("");
  openForm(t ? "Modifier la tâche" : "Nouvelle tâche", [
    { n: "title", l: "Tâche", req: true },
    { row: [{ n: "room", l: "Pièce", list: "roomList" }, { n: "cat", l: "Type", t: "select", o: ["Bricolage", "Administratif", "Achat", "Artisan", "Rangement", "Ménage"] }] },
    { row: [{ n: "due", l: "Date butoir", t: "date" }, { n: "effort", l: "Effort", t: "select", o: [["1", "Petit, moins de 30 min"], ["2", "Moyen, une demi-journée"], ["3", "Gros, un week-end"]] }] },
    { n: "cost", l: "Coût estimé (€)", t: "number" },
    { n: "steps", l: "Étapes (une par ligne)", t: "textarea", rows: 4 },
    { n: "note", l: "Note", t: "textarea", rows: 2 }
  ], t ? { ...t, effort: String(t.effort), steps: (t.steps || []).map(s => s.t).join("\n") } : { room: roomFilter || (gcfg("chantier").by === "room" ? gFilter.chantier || "" : ""), cat: "Bricolage", effort: "1" }, v => {
    const lines = v.steps.split("\n").map(s => s.trim()).filter(Boolean);
    const data = { title: v.title, room: v.room, cat: v.cat, due: v.due || null, effort: +v.effort, cost: v.cost ? +v.cost : null, note: v.note };
    if (t) t = board.data.tasks.find(x => x.id === t.id);
    if (!t) { board.data.tasks.push({ id: uid(), ...data, today: false, done: false, doneAt: null, created: todayISO(), steps: lines.map(l => ({ t: l, d: false })) }); board.save(); render(); return; }
    { const old = new Map((t.steps || []).map(s => [s.t, s.d])); Object.assign(t, data, { steps: lines.map(l => ({ t: l, d: old.get(l) || false })) }); }
    board.save(); render();
  });
}
function streakOf(dates) {
  const set = new Set(dates); let n = 0; const d = new Date();
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ================= confirmation ================= */
function ask(msg) { return new Promise(res => { const d = $("#cdlg"); $("#cmsg").textContent = msg; d.returnValue = ""; d.onclose = () => res(d.returnValue === "ok"); d.showModal(); }); }

/* ================= generic form ================= */
let formCb = null;
function fieldHTML(f, v) {
  const val = v[f.n] ?? "";
  const common = `name="${f.n}" ${f.req ? "required" : ""}`;
  let input;
  if (f.t === "textarea") input = `<textarea ${common} rows="${f.rows || 3}">${esc(val)}</textarea>`;
  else if (f.t === "select") input = `<select ${common}>${f.o.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${String(val) === String(k) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
  else input = `<input type="${f.t || "text"}" ${common} value="${esc(val)}" ${f.list ? `list="${f.list}"` : ""} ${f.t === "number" ? 'min="0" step="1" inputmode="numeric"' : ""}>`;
  return `<label>${esc(f.l)}${input}</label>`;
}
function openForm(title, fields, values, cb) {
  formCb = cb;
  $("#form").innerHTML = `<h2>${esc(title)}</h2>` + fields.map(f => f.row ? `<div class="field-row">${f.row.map(x => fieldHTML(x, values)).join("")}</div>` : fieldHTML(f, values)).join("") +
    `<div class="row"><button class="btn solid" value="save">Enregistrer</button><button class="btn" value="cancel" formnovalidate>Annuler</button></div>`;
  $("#dlg").showModal();
}
$("#dlg").addEventListener("close", () => {
  if ($("#dlg").returnValue !== "save" || !formCb) return;
  const v = {}; new FormData($("#form")).forEach((x, k) => v[k] = typeof x === "string" ? x.trim() : x);
  const cb = formCb; formCb = null; cb(v);
});

/* ================= views ================= */
const VIEWS = {};

VIEWS.accueil = () => {
  const m = moon(), s = S(), now = todayISO();
  const tod = openTasks().filter(t => t.today).slice(0, 3);
  const alerts = [];
  if (enabled("phidippus")) {
    const ph = s.phidippus, last = type => (ph.log.filter(l => l.type === type).map(l => l.date).sort().pop());
    const nm = ph.name || "l'araignée";
    const f = last("repas"), mi = last("brumisation");
    if (!f || diffDays(now, f) >= ph.feedEvery) alerts.push(`Nourrir ${esc(nm)} (dernier repas ${ago(f)})`);
    if (!mi || diffDays(now, mi) >= ph.mistEvery) alerts.push(`Brumiser le terrarium (${ago(mi)})`);
  }
  const kDone = s.kundalini.sessions.some(x => x.date === now);
  const rows = s.config.modules.filter(x => x.on && x.id !== "inbox").map(x => `<a class="over" href="#${x.id}"><b>${esc(label(x.id))}</b><span>${SUMMARY[x.id]()}</span><em class="hint" style="margin:0">ouvrir</em></a>`).join("");
  return `
  <section class="hero">${forestSVG(m.p)}<div class="txt">
    <div class="phase">${m.name}</div>
    <p>Éclairée à ${Math.round(m.illum * 100)} %, jour ${Math.floor(m.age) + 1} du cycle. ${m.p < .5 ? `Pleine lune dans ${m.nextFull} j.` : `Nouvelle lune dans ${m.nextNew} j.`}</p>
  </div></section>
  <div class="two">
    <section><h2>Aujourd'hui</h2><p class="hint">Trois choses. La forêt pousse très bien sans que tu la surveilles.</p>
      <ul class="plain">
        ${tod.map(taskHTML).join("")}
        ${alerts.map(a => `<li class="item"><span></span><div>${a}</div><a class="btn ghost sm" href="#phidippus">voir</a></li>`).join("")}
        ${enabled("kundalini") && s.kundalini.start ? `<li class="item"><span></span><div>${kDone ? "Séance de kundalini faite." : "Pas encore de séance aujourd'hui."}</div>${kDone ? "" : `<button class="btn ghost sm" data-act="k-add">noter</button>`}</li>` : ""}
      </ul>
      ${!tod.length ? `<p class="empty">Aucune tâche choisie. <button class="btn ghost sm" data-act="task-pick">Tirer une petite tâche au sort</button></p>` : ""}
    </section>
    <section><h2>Capturer</h2><p class="hint">Dépose-le ici comme une feuille morte, tu trieras l'humus plus tard.</p>
      <div class="capture"><input id="capIn" placeholder="Une idée, une course, un rêve…" aria-label="Capture rapide"><button class="btn acc" data-act="cap-add">Garder</button></div>
      ${s.inbox.items.length ? `<p class="hint" style="margin-top:8px"><a href="#inbox">${s.inbox.items.length} élément${s.inbox.items.length > 1 ? "s" : ""} à trier</a></p>` : ""}
    </section>
  </div>
  <section><h2>Où en sont les choses</h2>${rows}</section>`;
};

const SUMMARY = {
  chantier: () => { const o = openTasks(), now = todayISO(), late = o.filter(t => t.due && t.due < now).length; const all = board.data.tasks.length; return `${late ? `<span class="late">${late} en retard</span>, ` : ""}${o.length} à faire, ${all ? Math.round(100 * (all - o.length) / all) : 0} % du chantier`; },
  kundalini: () => { const k = S().kundalini; if (!k.start) return "Pas encore commencée"; const w = Math.min(k.weeks, Math.floor(diffDays(todayISO(), k.start) / 7) + 1); return `Semaine ${w} sur ${k.weeks}, ${k.sessions.length} séance${k.sessions.length > 1 ? "s" : ""}, série de ${streakOf(k.sessions.map(x => x.date))} j`; },
  ecriture: () => { const e = S().ecriture, tot = e.sessions.reduce((a, x) => a + (+x.words || 0), 0); return `${tot.toLocaleString("fr-FR")} mots sur ${(+e.goal).toLocaleString("fr-FR")}, ${e.fragments.length} fragment${e.fragments.length > 1 ? "s" : ""}`; },
  moth: () => { const p = S().moth.posts; const c = st => p.filter(x => x.status === st).length; return `${c("Idée")} idées, ${c("Brouillon")} brouillons, ${c("Prêt")} prêts`; },
  phidippus: () => { const ph = S().phidippus; const f = ph.log.filter(l => l.type === "repas").map(l => l.date).sort().pop(); return `Dernier repas ${ago(f)}`; },
  musique: () => { const a = S().musique.albums; return `${a.filter(x => x.status === "À écouter").length} à écouter, ${a.filter(x => x.status === "Retenu").length} retenus`; },
  budget: () => { const m = todayISO().slice(0, 7), es = S().budget.entries.filter(e => (e.date || "").slice(0, 7) === m); const out = es.filter(e => e.type === "dépense").reduce((a, e) => a + +e.amount, 0), inn = es.filter(e => e.type === "revenu").reduce((a, e) => a + +e.amount, 0); return `Ce mois-ci : ${money(out)} dépensés, solde <span class="${inn - out < 0 ? "neg" : "pos"}">${money(inn - out)}</span>`; },
  assistant: () => { const b = backend(); return b === "sample" ? "Branché via claude.ai" : b === "api" ? "Branché via ta clé API" : "Pas encore branché"; },
  inbox: () => `${S().inbox.items.length} à trier`
};

VIEWS.chantier = () => {
  const now = todayISO(), o = openTasks();
  const tod = o.filter(t => t.today).slice(0, 3);
  const cats = [...new Set(board.data.tasks.map(t => t.cat))];
  const filtered = o.filter(t => (!roomFilter || t.room === roomFilter) && (!catFilter || t.cat === catFilter) && gMatch("chantier", t)).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const groups = [
    ["En retard", "Le passé ne se repeint pas. Ça, si.", t => t.due && t.due < now, true],
    ["Cette semaine", "Assez proche pour paniquer utilement.", t => t.due && t.due >= now && diffDays(t.due, now) <= 7],
    ["Ce mois-ci", "Le problème de toi dans trois semaines.", t => t.due && diffDays(t.due, now) > 7 && diffDays(t.due, now) <= 31],
    ["Plus tard", "Hors de vue. Pas hors de l'appartement.", t => t.due && diffDays(t.due, now) > 31],
    ["Sans date", "Les tâches sans date ne meurent jamais. Elles hantent.", t => !t.due]
  ].map(([n, h, f, late]) => { const it = filtered.filter(f); return it.length ? `<div style="margin-bottom:22px"><h3 class="${late ? "late" : ""}">${n} <span class="hint" style="font-size:1rem">${it.length}</span></h3><p class="hint">${h}</p><ul class="plain">${it.map(taskHTML).join("")}</ul></div>` : ""; }).join("");
  const spent = board.data.tasks.filter(t => t.done && t.cost).reduce((a, t) => a + +t.cost, 0), left = o.filter(t => t.cost).reduce((a, t) => a + +t.cost, 0);
  const done = board.data.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 8);
  return `<div class="row" style="margin-bottom:24px"><h2 style="margin:0">${esc(label("chantier"))}</h2><span class="spacer"></span><button class="btn solid" data-act="task-new">Ajouter une tâche</button><button class="btn" data-act="task-pick">Tirer au sort</button></div>
  <div class="two"><div>
    <section><h3>Aujourd'hui</h3><p class="hint">Trois tâches maximum. Au-delà, c'est une liste de reproches.</p><ul class="plain">${tod.map(taskHTML).join("") || `<li class="empty">Coche l'étoile d'une tâche.</li>`}</ul></section>
    <section><div class="row" style="margin-bottom:12px"><h3 style="margin:0">Échéances</h3><span class="spacer"></span>
      <select data-act="f-room" aria-label="Pièce"><option value="">Toutes les pièces</option>${rooms().map(r => `<option ${r === roomFilter ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select data-act="f-cat" aria-label="Type"><option value="">Tous les types</option>${cats.map(c => `<option ${c === catFilter ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      ${groups || `<p class="empty">Plus rien ici. Soit c'est fini, soit tu as filtré trop fort.</p>`}</section>
  </div><aside>
    ${groupPanel("chantier", "La mousse gagne à mesure que tu finis. Clique pour filtrer.")}
    ${spent || left ? `<p class="hint">Budget estimé : ${spent} € engagés, ${left} € encore à prévoir.</p>` : ""}
    <section><h3>Fait récemment</h3><ul class="plain">${done.map(t => `<li class="item" data-task="${esc(t.id)}"><span></span><div>${esc(t.title)}<div class="meta">${fmt(t.doneAt)}</div></div><button class="btn ghost sm" data-act="task-undo">annuler</button></li>`).join("") || `<li class="empty">Rien pour l'instant. L'histoire ne retiendra rien.</li>`}</ul></section>
  </aside></div>`;
};

VIEWS.kundalini = () => {
  const k = S().kundalini, now = todayISO();
  if (!k.start) return `<h2>${esc(label("kundalini"))}</h2><p class="hint">Un protocole de ${k.weeks} semaines, une séance à la fois.</p><button class="btn acc" data-act="k-start">Commencer aujourd'hui</button> <a class="btn ghost" href="#reglages">ou choisir une autre date</a>`;
  const days = new Set(k.sessions.map(x => x.date)), W = Math.min(52, Math.max(1, Math.round(+k.weeks) || 12));
  const week = Math.min(W, Math.floor(diffDays(now, k.start) / 7) + 1);
  const pct = Math.min(100, Math.round(100 * (diffDays(now, k.start) + 1) / (W * 7)));
  const totalMin = k.sessions.reduce((a, x) => a + (+x.min || 0), 0);
  let cal = "";
  for (let w = 0; w < W; w++) { cal += `<span>S${w + 1}</span>`; for (let d = 0; d < 7; d++) { const day = addDaysTo(k.start, w * 7 + d); cal += `<i class="${days.has(day) ? "on" : ""} ${day === now ? "today" : ""} ${day > now ? "future" : ""}" title="${fmt(day)}"></i>`; } }
  const recent = [...k.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return `<div class="row" style="margin-bottom:20px"><h2 style="margin:0">${esc(label("kundalini"))}</h2><span class="spacer"></span><button class="btn acc" data-act="k-add">Noter une séance</button></div>
  <div class="two"><section>
    <div class="big">Semaine ${week} <span class="hint" style="font-size:1.1rem">sur ${W}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">${k.sessions.length} séances, ${totalMin} minutes au total, série actuelle de ${streakOf([...days])} jour(s).</p>
    <div class="cal">${cal}</div>
    <div style="margin-top:28px">${groupPanel("kundalini", `Objectif : ${k.perWeek} séances par semaine, réglable.`)}</div>
  </section><section><h3>Journal</h3><p class="hint">Ce que le corps a fait, ce que la tête en a pensé.</p>
    <ul class="plain">${recent.map(x => `<li class="item" data-id="${esc(x.id)}"><span></span><div>${fmt(x.date, { weekday: "short", day: "numeric", month: "short" })}, ${esc(x.min || "?")} min${x.note ? `<div class="note" style="margin:2px 0 0">${esc(x.note)}</div>` : ""}</div><button class="btn ghost sm" data-act="k-del">suppr.</button></li>`).join("") || `<li class="empty">Aucune séance notée.</li>`}</ul>
  </section></div>`;
};

VIEWS.ecriture = () => {
  const e = S().ecriture, tot = e.sessions.reduce((a, x) => a + (+x.words || 0), 0), pct = Math.min(100, Math.round(100 * tot / (+e.goal || 1)));
  const last = e.sessions.map(x => x.date).sort().pop();
  return `<h2>${esc(label("ecriture"))}</h2><p class="hint">${esc(e.title)}</p>
  <div class="two"><section>
    <div class="big">${tot.toLocaleString("fr-FR")} <span class="hint" style="font-size:1.1rem">mots sur ${(+e.goal).toLocaleString("fr-FR")}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">Dernière session ${ago(last)}. Série de ${streakOf(e.sessions.map(x => x.date))} jour(s).</p>
    <div class="row"><input type="number" id="wIn" min="1" placeholder="Mots écrits aujourd'hui" style="max-width:200px" inputmode="numeric">${e.chapters.length ? `<select id="wCh" aria-label="Chapitre" style="max-width:220px"><option value="">Hors chapitre</option>${e.chapters.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select>` : ""}<button class="btn acc" data-act="w-add">Ajouter</button></div>
    <div style="margin-top:28px">${e.chapters.length ? groupPanel("ecriture", "Chaque chapitre a son propre objectif.") : `<p class="hint">Découpe le livre en chapitres dans <a href="#reglages">Réglages</a> pour suivre chacun en pourcentage.</p>`}</div>
  </section><section><h3>Fragments</h3><p class="hint">Une phrase qui passe, avant qu'elle ne reparte.</p>
    <textarea id="fragIn" rows="3" placeholder="Fragment…" aria-label="Nouveau fragment"></textarea><div class="row" style="margin-top:8px"><button class="btn" data-act="frag-add">Garder le fragment</button></div>
    <ul class="plain" style="margin-top:14px">${[...e.fragments].reverse().map(f => `<li class="item" data-id="${esc(f.id)}"><span></span><div style="white-space:pre-wrap">${esc(f.text)}<div class="meta">${fmt(f.date)}</div></div><button class="btn ghost sm" data-act="frag-del">suppr.</button></li>`).join("") || `<li class="empty">Aucun fragment.</li>`}</ul>
  </section></div>`;
};

const MOTH_COLS = ["Idée", "Brouillon", "Prêt", "Publié"];
VIEWS.moth = () => {
  const posts = S().moth.posts.filter(p => gMatch("moth", p));
  return `<div class="row" style="margin-bottom:20px"><h2 style="margin:0">${esc(label("moth"))}</h2><span class="spacer"></span><button class="btn acc" data-act="post-new">Nouvelle idée de post</button></div>
  <div class="board" style="margin-bottom:34px">${MOTH_COLS.map((c, ci) => `<div class="col"><h3>${c} <span class="hint" style="font-size:.95rem">${posts.filter(p => p.status === c).length}</span></h3>
    ${posts.filter(p => p.status === c).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).map(p => `<div class="card" data-id="${esc(p.id)}"><b>${esc(p.title)}</b>${p.theme ? `<div class="meta"><span class="tag">${esc(p.theme)}</span>${p.due ? `<span>${fmt(p.due)}</span>` : ""}</div>` : p.due ? `<div class="meta">${fmt(p.due)}</div>` : ""}${p.caption ? `<p>${esc(p.caption.slice(0, 160))}${p.caption.length > 160 ? "…" : ""}</p>` : ""}
      <div class="row">${ci > 0 ? `<button class="btn ghost sm" data-act="post-move" data-d="-1" aria-label="Reculer">←</button>` : ""}${ci < 3 ? `<button class="btn ghost sm" data-act="post-move" data-d="1" aria-label="Avancer">→</button>` : ""}<span class="spacer"></span><button class="btn ghost sm" data-act="post-edit">modifier</button><button class="btn ghost sm" data-act="post-del">suppr.</button></div></div>`).join("") || `<p class="empty">Vide.</p>`}</div>`).join("")}</div>
  ${groupPanel("moth", "Part publiée de chaque thème. Clique pour filtrer le tableau.")}`;
};
function postForm(p) {
  openForm(p ? "Modifier le post" : "Nouvelle idée de post", [
    { n: "title", l: "Titre ou accroche", req: true },
    { row: [{ n: "theme", l: "Thème, archétype" }, { n: "due", l: "Publication prévue", t: "date" }] },
    { n: "status", l: "Étape", t: "select", o: MOTH_COLS },
    { n: "caption", l: "Légende", t: "textarea", rows: 6 }
  ], p || { status: "Idée" }, v => {
    const cur = p && S().moth.posts.find(x => x.id === p.id); if (cur) Object.assign(cur, v); else S().moth.posts.push({ id: uid(), ...v });
    site.save(); render();
  });
}

VIEWS.phidippus = () => {
  const ph = S().phidippus, now = todayISO(), last = t => ph.log.filter(l => l.type === t).map(l => l.date).sort().pop();
  const line = (t, every, lab) => { const l = last(t); const due = every && (!l || diffDays(now, l) >= every); return `<div class="set"><span class="${due ? "late" : ""}">${lab}</span><span class="hint" style="margin:0">${ago(l)}${every ? `, tous les ${every} j` : ""}</span><button class="btn sm" data-act="ph-log" data-t="${t}">Fait aujourd'hui</button></div>`; };
  return `<h2>${esc(label("phidippus"))}${ph.name ? ` <span class="hint" style="font-size:1.2rem">${esc(ph.name)}</span>` : ""}</h2><p class="hint">Huit yeux qui t'observent. Le minimum est de noter quand elle mange.</p>
  <div class="two"><section>
    ${line("repas", ph.feedEvery, "Repas")}${line("brumisation", ph.mistEvery, "Brumisation")}${line("mue", 0, "Mue")}
    <div class="row" style="margin-top:14px"><input id="phNote" placeholder="Observation (comportement, refus de proie, toile…)" aria-label="Observation"><button class="btn" data-act="ph-note">Noter</button></div>
    <p class="hint" style="margin-top:10px">Nom et fréquences se règlent dans <a href="#reglages">Réglages</a>.</p>
  </section><section><h3>Journal</h3><ul class="plain">${[...ph.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map(l => `<li class="item" data-id="${esc(l.id)}"><span></span><div><span class="tag">${esc(l.type)}</span> ${fmt(l.date)}${l.note ? `<div class="note" style="margin:2px 0 0">${esc(l.note)}</div>` : ""}</div><button class="btn ghost sm" data-act="ph-del">suppr.</button></li>`).join("") || `<li class="empty">Aucune entrée.</li>`}</ul></section></div>`;
};

const MUS_ST = ["À écouter", "Écouté", "Retenu"];
let musFilter = "";
VIEWS.musique = () => {
  const al = S().musique.albums.filter(a => (!musFilter || a.status === musFilter) && gMatch("musique", a));
  return `<div class="row" style="margin-bottom:8px"><h2 style="margin:0">${esc(label("musique"))}</h2><span class="spacer"></span><button class="btn acc" data-act="alb-new">Ajouter un album</button></div>
  <p class="hint">Albums de l'éveil, et artistes dont la mue stylistique fait elle-même le récit d'une transformation.</p>
  <div class="row" style="margin-bottom:10px"><select data-act="mus-f" aria-label="Filtrer"><option value="">Tous</option>${MUS_ST.map(s => `<option ${s === musFilter ? "selected" : ""}>${s}</option>`).join("")}</select></div>
  <div class="two"><div><ul class="plain">${al.map(a => `<li class="item" data-id="${esc(a.id)}"><span></span><div><b>${esc(a.artist)}</b>${a.album ? `, <i>${esc(a.album)}</i>` : ` <span class="hint">album à préciser</span>`}${a.note ? `<div class="note" style="margin:2px 0 0">${esc(a.note)}</div>` : ""}</div>
    <div class="row"><select data-act="alb-st" aria-label="Statut">${MUS_ST.map(s => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select><button class="btn ghost sm" data-act="alb-edit">modifier</button><button class="btn ghost sm" data-act="alb-del">suppr.</button></div></li>`).join("") || `<li class="empty">Rien dans ce filtre.</li>`}</ul></div><div>${groupPanel("musique", "Part écoutée de chaque artiste. Clique pour filtrer.")}</div></div>`;
};
function albForm(a) {
  openForm(a ? "Modifier l'album" : "Ajouter un album", [
    { row: [{ n: "artist", l: "Artiste", req: true }, { n: "album", l: "Album" }] },
    { n: "status", l: "Statut", t: "select", o: MUS_ST }, { n: "note", l: "Note", t: "textarea", rows: 3 }
  ], a || { status: "À écouter" }, v => { const cur = a && S().musique.albums.find(x => x.id === a.id); if (cur) Object.assign(cur, v); else S().musique.albums.push({ id: uid(), ...v }); site.save(); render(); });
}

VIEWS.inbox = () => {
  const it = S().inbox.items;
  return `<h2>${esc(label("inbox"))}</h2><p class="hint">Tout ce qui traîne dans ta tête, en attendant d'avoir une place.</p>
  <div class="capture" style="margin-bottom:18px"><input id="capIn" placeholder="Une idée, une course, un rêve…" aria-label="Capture rapide"><button class="btn acc" data-act="cap-add">Garder</button></div>
  <ul class="plain">${[...it].reverse().map(x => `<li class="item" data-id="${esc(x.id)}"><span></span><div>${esc(x.text)}<div class="meta">${fmt(x.date)}</div>
    <div class="row" style="margin-top:6px">${enabled("chantier") ? `<button class="btn sm" data-act="cap-to" data-to="chantier">→ Chantier</button>` : ""}${enabled("ecriture") ? `<button class="btn sm" data-act="cap-to" data-to="ecriture">→ Fragment</button>` : ""}${enabled("moth") ? `<button class="btn sm" data-act="cap-to" data-to="moth">→ Post</button>` : ""}${enabled("musique") ? `<button class="btn sm" data-act="cap-to" data-to="musique">→ Album</button>` : ""}</div></div>
    <button class="btn ghost sm" data-act="cap-del">suppr.</button></li>`).join("") || `<li class="empty">Vide. Le silence d'une clairière, ou celui d'un cerveau.</li>`}</ul>`;
};


VIEWS.budget = () => {
  const b = S().budget, es = b.entries.filter(e => (e.date || "").slice(0, 7) === budMonth);
  const out = es.filter(e => e.type === "dépense").reduce((a, e) => a + +e.amount, 0), inn = es.filter(e => e.type === "revenu").reduce((a, e) => a + +e.amount, 0);
  const shown = es.filter(e => gMatch("budget", e)).sort((a, x) => x.date.localeCompare(a.date));
  const mLabel = new Date(budMonth + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const chantierLeft = enabled("chantier") ? openTasks().filter(t => t.cost).reduce((a, t) => a + +t.cost, 0) : 0;
  const defDate = budMonth === todayISO().slice(0, 7) ? todayISO() : budMonth + "-01";
  return `<div class="row" style="margin-bottom:6px"><h2 style="margin:0">${esc(label("budget"))}</h2><span class="spacer"></span>
    <button class="btn ghost" data-act="bud-month" data-d="-1" aria-label="Mois précédent">‹</button><b style="min-width:9ch;text-align:center;text-transform:capitalize">${mLabel}</b><button class="btn ghost" data-act="bud-month" data-d="1" aria-label="Mois suivant">›</button></div>
  <div class="stats"><div><span>Revenus</span><b class="big pos">${money(inn)}</b></div><div><span>Dépenses</span><b class="big">${money(out)}</b></div><div><span>Solde</span><b class="big ${inn - out < 0 ? "neg" : "pos"}">${money(inn - out)}</b></div></div>
  <datalist id="envList">${b.envelopes.map(v => `<option value="${esc(v.name)}">`).join("")}</datalist>
  <div class="row" style="margin-bottom:26px">
    <select id="bType" style="max-width:130px" aria-label="Type"><option>dépense</option><option>revenu</option></select>
    <input id="bAmt" type="number" step="0.01" min="0" placeholder="Montant" style="max-width:130px" inputmode="decimal" aria-label="Montant">
    <input id="bCat" list="envList" placeholder="Enveloppe" style="max-width:170px" aria-label="Enveloppe">
    <input id="bNote" placeholder="Note" style="max-width:220px" aria-label="Note">
    <input id="bDate" type="date" value="${defDate}" style="max-width:160px" aria-label="Date">
    <button class="btn acc" data-act="bud-add">Ajouter</button></div>
  <div class="two"><section><h3>Opérations</h3><p class="hint">L'argent ne disparaît pas, il change simplement de propriétaire.</p>
    <ul class="plain">${shown.map(e => `<li class="item" data-id="${esc(e.id)}"><span></span><div>${esc(e.note || e.cat || e.type)}<div class="meta">${fmt(e.date)}${e.cat ? `<span class="tag">${esc(e.cat)}</span>` : ""}</div></div><div class="row"><b class="${e.type === "revenu" ? "pos" : ""}">${e.type === "revenu" ? "+" : "−"}${money(e.amount)}</b><button class="btn ghost sm" data-act="bud-del">suppr.</button></div></li>`).join("") || `<li class="empty">Aucune opération ce mois-ci. Suspect.</li>`}</ul></section>
  <div>${groupPanel("budget", "Part de chaque enveloppe mensuelle déjà consommée. Le rouge signale le dépassement.")}
    ${chantierLeft ? `<p class="hint">Le chantier estime encore ${money(chantierLeft)} de dépenses à venir.</p>` : ""}</div></div>`;
};

/* ---------- assistant ---------- */
let sampleNS = null, downloadsNS = null, chatBusy = false;
const hosted = () => !window.claude;
const getKey = () => { try { return localStorage.getItem("selene-api-key") || ""; } catch { return ""; } };
function backend() { if (!enabled("assistant")) return "off"; if (sampleNS) return "sample"; if (hosted() && getKey()) return "api"; return "none"; }
const chatLog = { get() { try { return JSON.parse(localStorage.getItem("selene-chat") || "[]"); } catch { return []; } }, set(v) { try { localStorage.setItem("selene-chat", JSON.stringify(v.slice(-40))); } catch {} } };
function contextText() {
  const s = S(), sh = s.config.assistant.share, now = todayISO(), m = moon(), L = [];
  L.push(`Date : ${fmt(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. Lune : ${m.name.toLowerCase()}, éclairée à ${Math.round(m.illum * 100)} %.`);
  if (sh.chantier && enabled("chantier")) { const o = openTasks().sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")); L.push(`\nCHANTIER (appartement) : ${o.length} tâches ouvertes sur ${board.data.tasks.length}.`); o.slice(0, 40).forEach(t => L.push(`- [${t.id}] ${t.title} | ${t.room || "?"} | ${t.due ? "échéance " + t.due : "sans date"}${t.today ? " | choisie pour aujourd'hui" : ""}${t.cost ? " | " + t.cost + " €" : ""}`)); }
  if (sh.kundalini && enabled("kundalini")) { const k = s.kundalini; L.push(`\nKUNDALINI : ${k.start ? `protocole de ${k.weeks} semaines commencé le ${k.start}, ${k.sessions.length} séances, objectif ${k.perWeek}/semaine. Dernières notes : ${k.sessions.slice(-3).map(x => `${x.date} ${x.min || "?"} min ${x.note || ""}`).join(" ; ")}` : "pas commencé"}`); }
  if (sh.ecriture && enabled("ecriture")) { const e = s.ecriture, tot = e.sessions.reduce((a, x) => a + (+x.words || 0), 0); L.push(`\nÉCRITURE « ${e.title} » : ${tot} mots sur ${e.goal}. Chapitres : ${e.chapters.map(c => c.name).join(", ") || "aucun"}. Derniers fragments : ${e.fragments.slice(-3).map(f => f.text.slice(0, 200)).join(" / ") || "aucun"}`); }
  if (sh.moth && enabled("moth")) L.push(`\nOCTOBER.MOTH (Instagram) : ${s.moth.posts.map(p => `${p.title} [${p.status}${p.theme ? ", " + p.theme : ""}]`).join(" ; ") || "aucun post"}`);
  if (sh.phidippus && enabled("phidippus")) { const ph = s.phidippus, last = t => ph.log.filter(l => l.type === t).map(l => l.date).sort().pop() || "jamais"; L.push(`\nPHIDIPPUS${ph.name ? " (" + ph.name + ")" : ""} : dernier repas ${last("repas")}, brumisation ${last("brumisation")}, mue ${last("mue")}.`); }
  if (sh.musique && enabled("musique")) L.push(`\nMUSIQUE (albums de l'éveil) : ${s.musique.albums.map(a => `${a.artist}${a.album ? " – " + a.album : ""} [${a.status}]`).join(" ; ")}`);
  if (sh.budget && enabled("budget")) { const mo = now.slice(0, 7), es = s.budget.entries.filter(e => (e.date || "").slice(0, 7) === mo); L.push(`\nBUDGET (${mo}) : dépenses ${es.filter(e => e.type === "dépense").reduce((a, e) => a + +e.amount, 0)} €, revenus ${es.filter(e => e.type === "revenu").reduce((a, e) => a + +e.amount, 0)} €. Enveloppes : ${GROUPERS.budget.groups().map(g => `${g.name} ${g.sub}`).join(" ; ")}`); }
  if (sh.inbox && enabled("inbox")) L.push(`\nCAPTURE (à trier) : ${s.inbox.items.map(i => i.text).join(" ; ") || "vide"}`);
  return L.join("\n").slice(0, 14000);
}
function instructions() {
  const a = S().config.assistant, name = S().config.name || "Selene";
  return `Tu es Claude, intégré au tableau de bord personnel de ${name}. Réponds en français, en prose, sans listes à puces sauf demande. Ton : lucide, cynique, humour noir glissé naturellement ; jamais de morale non demandée ni de justifications répétées. Chaque fois que tu emploies un terme technique ou savant, définis-le brièvement dans la phrase. Sois concis. Tu ne connais que les données ci-dessous, qu'elle a choisi de partager ; tu n'as aucun souvenir d'autres conversations.
${a.actions ? "Tu peux agir sur le tableau de bord avec les outils fournis (ajouter une tâche, terminer une tâche, capturer une note, enregistrer une opération de budget). Ne les utilise que si c'est demandé ou clairement voulu, et dis ce que tu as fait." : "Tu ne peux rien modifier : conseille seulement."}

DONNÉES DU TABLEAU DE BORD
${contextText()}`;
}
const TOOLS = [
  { name: "ajouter_tache", description: "Ajoute une tâche au module Chantier. Renvoie une confirmation.", inputSchema: { type: "object", properties: { titre: { type: "string" }, piece: { type: "string" }, echeance: { type: "string", description: "AAAA-MM-JJ" }, type: { type: "string", enum: ["Bricolage", "Administratif", "Achat", "Artisan", "Rangement", "Ménage"] } }, required: ["titre"] },
    execute(i) { const t = { id: uid(), title: String(i.titre).slice(0, 140), room: String(i.piece || ""), cat: String(i.type || "Bricolage"), due: /^\d{4}-\d{2}-\d{2}$/.test(i.echeance || "") ? i.echeance : null, effort: 1, cost: null, note: "Ajoutée par l'assistant", today: false, done: false, doneAt: null, created: todayISO(), steps: [] }; board.data.tasks.push(t); board.save(); render(); return `Tâche ajoutée : ${t.title}`; } },
  { name: "terminer_tache", description: "Marque comme faite une tâche du Chantier, par son identifiant entre crochets.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    execute(i) { const t = board.data.tasks.find(x => x.id === String(i.id)); if (!t) throw new Error("tâche introuvable"); t.done = true; t.doneAt = todayISO(); t.today = false; board.save(); render(); return `Terminée : ${t.title}`; } },
  { name: "capturer", description: "Dépose une note dans la boîte Capture, à trier plus tard.", inputSchema: { type: "object", properties: { texte: { type: "string" } }, required: ["texte"] },
    execute(i) { S().inbox.items.push({ id: uid(), text: String(i.texte).slice(0, 500), date: todayISO() }); site.save(); render(); return "Capturé."; } },
  { name: "ajouter_operation", description: "Enregistre une dépense ou un revenu dans le Budget.", inputSchema: { type: "object", properties: { montant: { type: "number" }, type: { type: "string", enum: ["dépense", "revenu"] }, enveloppe: { type: "string" }, note: { type: "string" }, date: { type: "string", description: "AAAA-MM-JJ, aujourd'hui par défaut" } }, required: ["montant"] },
    execute(i) { const amt = Math.abs(+i.montant); if (!amt) throw new Error("montant invalide"); S().budget.entries.push({ id: uid(), type: i.type === "revenu" ? "revenu" : "dépense", amount: amt, cat: String(i.enveloppe || ""), note: String(i.note || ""), date: /^\d{4}-\d{2}-\d{2}$/.test(i.date || "") ? i.date : todayISO() }); site.save(); render(); return `Enregistré : ${money(amt)}`; } }
];
async function askAPI(history) {
  const a = S().config.assistant, tools = a.actions ? TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) : undefined;
  const msgs = history.map(m => ({ role: m.role, content: m.content })); let out = "";
  for (let round = 0; round < 5; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": getKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: a.model, max_tokens: 1500, system: instructions(), messages: msgs, ...(tools ? { tools } : {}) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    if (!Array.isArray(data.content)) throw new Error("réponse inattendue de l'API");
    const txt = data.content.filter(b => b.type === "text").map(b => b.text).join("\n"); if (txt) out += (out ? "\n\n" : "") + txt;
    if (data.stop_reason !== "tool_use") break;
    msgs.push({ role: "assistant", content: data.content });
    const results = [];
    for (const b of data.content.filter(b => b.type === "tool_use")) { let r; try { r = await TOOLS.find(t => t.name === b.name).execute(b.input || {}); } catch (e) { r = "Erreur : " + e.message; } results.push({ type: "tool_result", tool_use_id: b.id, content: String(r) }); }
    msgs.push({ role: "user", content: results });
  }
  return out || "(pas de réponse)";
}
async function askSample(history, onText) {
  const input = [{ role: "user", content: instructions() }, ...history];
  const opts = { onText: ({ text }) => onText(text) };
  if (S().config.assistant.actions) opts.tools = TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, execute: i => t.execute(i) }));
  try { return (await sampleNS(input, opts)).text; }
  catch (e) { if (e && e.code === "tools_unavailable") { delete opts.tools; return (await sampleNS(input, opts)).text; } throw e; }
}
const mdLite = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>");
async function sendChat(text) {
  if (chatBusy || !text.trim()) return;
  const b = backend(); if (b !== "sample" && b !== "api") return toast("L'assistant n'est pas branché. Voir Réglages.");
  const log = chatLog.get(); log.push({ role: "user", content: text.trim().slice(0, 4000) }); chatLog.set(log); chatBusy = true; if ($("#chatIn")) $("#chatIn").value = ""; render();
  const onText = t => { const p = document.getElementById("pending"); if (p) p.textContent = t; };
  try {
    const hist = log.slice(-20).map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) })); while (hist.length && hist[0].role !== "user") hist.shift();
    const reply = b === "sample" ? await askSample(hist, onText) : await askAPI(hist);
    const l2 = chatLog.get(); l2.push({ role: "assistant", content: reply }); chatLog.set(l2);
  } catch (e) {
    const code = e && e.code, msg = code === "not_granted" ? "Accès refusé à Claude pour cette page." : code === "rate_limited" ? "Trop de demandes, réessaie dans un moment." : (e && e.message) || "Erreur inconnue.";
    toast(msg);
  }
  chatBusy = false; render();
  const log2 = document.querySelector(".chat"); if (log2) log2.lastElementChild?.scrollIntoView({ block: "nearest" });
}
VIEWS.assistant = () => {
  const b = backend(), a = S().config.assistant, log = chatLog.get();
  const status = b === "sample" ? "Branché via claude.ai : aucune clé requise, la première question te demandera ton accord." : b === "api" ? `Branché via ta clé API, modèle ${esc(a.model)}. Chaque échange est facturé sur ton compte.` : hosted() ? `Pas encore branché. Colle ta clé API dans <a href="#reglages">Réglages</a>.` : "Indisponible dans cette vue.";
  const shared = Object.entries(a.share).filter(([k, v]) => v && enabled(k)).map(([k]) => label(k)).join(", ") || "rien";
  return `<div class="row"><h2 style="margin:0">${esc(label("assistant"))}</h2><span class="spacer"></span>${log.length ? `<button class="btn ghost sm" data-act="chat-clear">Effacer la conversation</button>` : ""}</div>
  <p class="status">${status}<br>Données partagées : ${esc(shared)}. ${a.actions ? "Peut agir sur le tableau de bord." : "Lecture seule."}</p>
  <div class="chat">${log.map(m => `<div class="msg ${m.role === "user" ? "user" : "claude"}">${m.role === "user" ? esc(m.content) : mdLite(m.content)}</div>`).join("")}${chatBusy ? `<div class="msg claude" id="pending">…</div>` : ""}</div>
  ${!log.length ? `<div class="chips">${["Qu'est-ce que je fais aujourd'hui ?", "Fais le point sur le chantier", "Où en est mon budget ce mois-ci ?", "Propose trois idées de posts pour october.moth"].map(q => `<button class="btn sm" data-act="chat-chip">${q}</button>`).join("")}</div>` : ""}
  <div class="capture"><textarea id="chatIn" rows="2" placeholder="Écris à Claude…" aria-label="Message" ${b === "sample" || b === "api" ? "" : "disabled"}></textarea><button class="btn acc" data-act="chat-send" ${chatBusy ? "disabled" : ""}>Envoyer</button></div>`;
};

const PALETTES = [["nigredo", "Nigredo, mousse", "#6f9a68"], ["albedo", "Albedo, lichen", "#aab7a6"], ["citrinitas", "Citrinitas, résine", "#c99a3c"], ["rubedo", "Rubedo, amanite", "#c0554a"]];
VIEWS.reglages = () => {
  const s = S(), c = s.config;
  return `<h2>Réglages</h2><p class="hint">Tout ici s'applique immédiatement.</p>
  <section><h3>Apparence</h3><p class="hint">Quatre étapes de l'Œuvre, prises dans le sous-bois.</p>
    <div class="swatches">${PALETTES.map(([id, n, col]) => `<button class="swatch ${c.palette === id ? "on" : ""}" data-act="pal" data-p="${id}"><i style="background:${col}"></i>${n}</button>`).join("")}</div>
    <div class="field-row" style="margin-top:14px"><label>Mode<select data-set="config.mode"><option value="auto" ${c.mode === "auto" ? "selected" : ""}>Suivre l'appareil</option><option value="dark" ${c.mode === "dark" ? "selected" : ""}>Toujours sombre</option><option value="light" ${c.mode === "light" ? "selected" : ""}>Toujours clair</option></select></label>
    <label>Nom affiché<input data-set="config.name" value="${esc(c.name)}"></label></div></section>
  <section><h3>Modules</h3><p class="hint">Active, renomme, réordonne.</p>
    ${c.modules.map((m, i) => `<div class="set" data-i="${i}"><input type="checkbox" data-act="mod-on" ${m.on ? "checked" : ""} aria-label="Activer ${esc(MODULE_DEFS[m.id])}"><input data-act="mod-label" value="${esc(label(m.id))}" aria-label="Nom du module"><div class="row"><button class="btn ghost sm" data-act="mod-up" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="mod-down" aria-label="Descendre">↓</button></div></div>`).join("")}</section>
  <section id="groupes"><h3>Groupes à pourcentage</h3><p class="hint">Les tuiles qui se remplissent, module par module : on ou off, critère de regroupement, tri, titre, noms des groupes.</p>
    ${Object.keys(GROUPERS).filter(enabled).map(mod => { const G = GROUPERS[mod], g = gcfg(mod); const names = G.renamable.includes(g.by) ? [...new Set(G.items().map(it => it[g.by]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")) : [];
      return `<div style="border-top:1px solid var(--rule);padding:12px 0" data-mod="${mod}">
        <div class="row"><label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="grp-on" ${g.on ? "checked" : ""}>${esc(label(mod))}</label></div>
        ${g.on ? `<div class="field-row" style="margin-top:8px">
          <label>Regrouper par<select data-act="grp-by">${Object.entries(G.fields).map(([k, l]) => `<option value="${k}" ${g.by === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label>Trier par<select data-act="grp-sort"><option value="name" ${g.sort === "name" ? "selected" : ""}>Ordre naturel</option><option value="pct" ${g.sort === "pct" ? "selected" : ""}>Le plus avancé d'abord</option><option value="left" ${g.sort === "left" ? "selected" : ""}>Le plus en retard d'abord</option></select></label></div>
          <div class="field-row" style="margin-top:8px"><label>Titre du bloc<input data-act="grp-title" value="${esc(g.title)}" placeholder="Par ${esc(G.fields[g.by].toLowerCase())}"></label>
          <label style="display:flex;gap:8px;align-items:center;align-self:end;padding-bottom:10px"><input type="checkbox" data-act="grp-hide" ${g.hideDone ? "checked" : ""}>Masquer les groupes à 100 %</label></div>
          ${names.length ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer;margin:0">Renommer ou fusionner des ${esc(G.fields[g.by].toLowerCase())}s</summary><p class="hint" style="margin:6px 0">Donne le même nom à deux groupes pour les fusionner.</p>${names.map(n => `<div class="set" style="grid-template-columns:1fr"><input data-act="grp-rename" data-old="${esc(n)}" value="${esc(n)}" aria-label="Renommer ${esc(n)}"></div>`).join("")}</details>` : ""}
          ${mod === "budget" ? `<div style="margin-top:10px"><span class="hint" style="margin:0">Enveloppes mensuelles</span>${S().budget.envelopes.map((v, i) => `<div class="set" data-vi="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="env-name" value="${esc(v.name)}" aria-label="Nom de l'enveloppe"><input type="number" min="0" data-act="env-limit" value="${v.limit || ""}" placeholder="€ / mois" aria-label="Plafond mensuel"><button class="btn ghost sm" data-act="env-del">suppr.</button></div>`).join("")}<button class="btn sm" data-act="env-add" style="margin-top:8px">Ajouter une enveloppe</button></div>` : ""}
          ${mod === "kundalini" ? `<label style="margin-top:8px;max-width:260px">Séances visées par semaine<input type="number" min="1" max="7" data-set="kundalini.perWeek" value="${s.kundalini.perWeek}"></label>` : ""}
          ${mod === "ecriture" ? `<div style="margin-top:10px"><span class="hint" style="margin:0">Chapitres</span>${s.ecriture.chapters.map((c, i) => `<div class="set" data-ci="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="ch-name" value="${esc(c.name)}" aria-label="Nom du chapitre"><input type="number" min="0" data-act="ch-goal" value="${c.goal || ""}" placeholder="Objectif" aria-label="Objectif en mots"><div class="row"><button class="btn ghost sm" data-act="ch-up" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="ch-del">suppr.</button></div></div>`).join("")}<button class="btn sm" data-act="ch-add" style="margin-top:8px">Ajouter un chapitre</button></div>` : ""}` : ""}
      </div>`; }).join("")}
  </section>
  ${enabled("assistant") ? `<section id="assistant-cfg"><h3>Assistant</h3><p class="hint">Claude dans le tableau de bord. Sur claude.ai, il passe par ton compte. Hébergé ailleurs (GitHub Pages), il faut ta propre clé API, gardée uniquement dans ce navigateur.</p>
    <div class="field-row"><label>Clé API Anthropic (hébergé uniquement)<input type="password" data-act="as-key" value="${getKey() ? "••••••••" : ""}" placeholder="sk-ant-…" autocomplete="off"></label>
    <label>Modèle<select data-act="as-model">${[["claude-haiku-4-5-20251001", "Haiku 4.5, rapide et peu cher"], ["claude-sonnet-5", "Sonnet 5, équilibré"], ["claude-opus-5-5", "Opus 5.5, le plus capable"]].map(([k, l]) => `<option value="${k}" ${s.config.assistant.model === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-act="as-actions" ${s.config.assistant.actions ? "checked" : ""}>Autoriser Claude à modifier le tableau de bord (tâches, capture, budget)</label>
    <p class="hint" style="margin:12px 0 4px">Ce que Claude peut lire :</p><div class="row">${Object.keys(s.config.assistant.share).filter(enabled).map(k => `<label style="display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" data-act="as-share" data-k="${k}" ${s.config.assistant.share[k] ? "checked" : ""}>${esc(label(k))}</label>`).join("")}</div>
    ${getKey() ? `<button class="btn ghost sm" data-act="as-forget" style="margin-top:10px">Oublier la clé sur cet appareil</button>` : ""}</section>` : ""}
  <section><h3>Sauvegarde</h3><p class="hint">Tout ton état dans un fichier JSON, pour passer de claude.ai à GitHub Pages ou d'un navigateur à l'autre. La clé API n'y figure jamais.</p>
    <div class="row"><button class="btn" data-act="exp">Exporter</button><label class="btn" style="display:inline-block;font-weight:500">Importer<input type="file" accept="application/json,.json" data-act="imp" style="display:none"></label></div></section>
  <section><h3>Paramètres</h3>
    <div class="field-row"><label>Début du protocole kundalini<input type="date" data-set="kundalini.start" value="${esc(s.kundalini.start || "")}"></label><label>Durée (semaines)<input type="number" min="1" data-set="kundalini.weeks" value="${s.kundalini.weeks}"></label></div>
    <div class="field-row" style="margin-top:10px"><label>Titre du projet d'écriture<input data-set="ecriture.title" value="${esc(s.ecriture.title)}"></label><label>Objectif (mots)<input type="number" min="1" data-set="ecriture.goal" value="${s.ecriture.goal}"></label></div>
    <div class="field-row" style="margin-top:10px"><label>Nom de l'araignée<input data-set="phidippus.name" value="${esc(s.phidippus.name)}"></label><label>Repas tous les (jours)<input type="number" min="1" data-set="phidippus.feedEvery" value="${s.phidippus.feedEvery}"></label></div>
    <div class="field-row" style="margin-top:10px"><label>Brumisation tous les (jours)<input type="number" min="1" data-set="phidippus.mistEvery" value="${s.phidippus.mistEvery}"></label><span></span></div>
  </section>`;
};

/* ================= render ================= */
function applyTheme() {
  const c = S().config, r = document.documentElement;
  r.dataset.palette = c.palette;
  if (c.mode === "auto") delete r.dataset.mode; else r.dataset.mode = c.mode;
}
let lastView = null;
function render() {
  applyTheme();
  const s = S(), m = moon();
  let view = location.hash.slice(1) || "accueil";
  if (!VIEWS[view] || (view !== "accueil" && view !== "reglages" && !enabled(view))) view = "accueil";
  $("#brandName").textContent = s.config.name || "Selene";
  document.title = s.config.name || "Selene";
  $("#miniMoon").innerHTML = moonSVG(m.p, 40);
  $("#dateline").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + ", " + m.name.toLowerCase();
  const links = [["accueil", "Accueil"], ...s.config.modules.filter(x => x.on).map(x => [x.id, label(x.id)]), ["reglages", "Réglages"]];
  $("#nav").innerHTML = links.map(([id, l]) => `<a href="#${id}" class="${id === view ? "on" : ""}">${esc(l)}${id === "inbox" && s.inbox.items.length ? ` (${s.inbox.items.length})` : ""}</a>`).join("");
  const ae = document.activeElement, focused = ae && ae.dataset && (ae.dataset.set || (ae.tagName === "INPUT" && ae.type !== "checkbox" && ae.closest && (ae.closest("#groupes") || ae.closest("#assistant-cfg"))));
  if (focused && view === "reglages") return; // ne pas casser la saisie en cours
  const keep = {}; let focusId = null, caret = null;
  if (view === lastView) $("#main").querySelectorAll("input[id],textarea[id],select[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
  if (document.activeElement && document.activeElement.id && keep[document.activeElement.id] != null) { focusId = document.activeElement.id; try { caret = document.activeElement.selectionStart; } catch {} }
  $("#main").innerHTML = VIEWS[view]();
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && v !== "" && el.value !== v) el.value = v; }
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch {} } }
  lastView = view;
}
window.addEventListener("hashchange", () => { openId = null; render(); const t = sessionStorage.getItem("selene-scroll"); sessionStorage.removeItem("selene-scroll"); const el = t && document.getElementById(t); if (el) el.scrollIntoView(); else window.scrollTo(0, 0); });

/* ================= actions ================= */
const taskOf = el => { const li = el.closest("[data-task]"); return (li && board.data.tasks.find(t => t.id === li.dataset.task)) || null; };
const idOf = el => el.closest("[data-id]")?.dataset.id;
function capture() {
  const inp = $("#capIn"); if (!inp || !inp.value.trim()) return;
  S().inbox.items.push({ id: uid(), text: inp.value.trim(), date: todayISO() }); site.save(); inp.value = ""; render(); toast("Gardé. Tu peux oublier, c'est écrit.");
}
function pickTask() {
  const o = openTasks().filter(t => !t.today);
  if (openTasks().filter(t => t.today).length >= 3) return toast("Aujourd'hui est plein. Le hasard respecte les plafonds.");
  if (!o.length) return toast("Rien à tirer.");
  const small = o.filter(t => t.effort === 1), pool = (small.length ? small : o).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 5);
  const t = pool[Math.floor(Math.random() * pool.length)]; t.today = true; board.save(); render();
  toast(`Le sort a désigné : « ${t.title} ». Pas de recours possible.`);
}
function kAdd() {
  openForm("Noter une séance", [{ row: [{ n: "date", l: "Date", t: "date", req: true }, { n: "min", l: "Durée (min)", t: "number" }] }, { n: "note", l: "Ce qui s'est passé", t: "textarea", rows: 4 }],
    { date: todayISO(), min: "" }, v => { S().kundalini.sessions.push({ id: uid(), date: v.date, min: v.min ? +v.min : null, note: v.note }); site.save(); render(); });
}
const CLICK = {
  "task-open": el => { const t = taskOf(el); openId = openId === t.id ? null : t.id; render(); },
  "task-today": el => { const t = taskOf(el); if (!t.today && openTasks().filter(x => x.today).length >= 3) return toast("Trois, c'est le plafond. Termine ou retire-en une."); t.today = !t.today; board.save(); render(); },
  "task-edit": el => taskForm(taskOf(el)),
  "task-del": async el => { const t = taskOf(el); if (await ask(`Supprimer « ${t.title} » ?`)) { board.data.tasks = board.data.tasks.filter(x => x !== t); board.save(); render(); } },
  "task-undo": el => { const t = taskOf(el); t.done = false; t.doneAt = null; board.save(); render(); },
  "task-new": () => taskForm(null),
  "task-pick": pickTask,
  "grp-filter": el => { const m = el.dataset.mod, g = el.dataset.g; gFilter[m] = gFilter[m] === g ? "" : g; render(); },
  "goto-groups": el => { if (location.hash === "#reglages") $("#groupes")?.scrollIntoView(); else sessionStorage.setItem("selene-scroll", "groupes"); },
  "cap-add": capture,
  "cap-del": el => { const s = S(); s.inbox.items = s.inbox.items.filter(x => x.id !== idOf(el)); site.save(); render(); },
  "cap-to": el => {
    const s = S(), it = s.inbox.items.find(x => x.id === idOf(el)), to = el.dataset.to;
    const drop = () => { s.inbox.items = s.inbox.items.filter(x => x !== it); site.save(); };
    if (to === "ecriture") { s.ecriture.fragments.push({ id: uid(), text: it.text, date: it.date }); drop(); render(); toast("Rangé dans les fragments."); }
    else if (to === "chantier") { const t = { id: uid(), title: it.text, room: "", cat: "Bricolage", due: null, effort: 1, cost: null, note: "", today: false, done: false, doneAt: null, created: todayISO(), steps: [] }; board.data.tasks.push(t); board.save(); drop(); taskForm(t); }
    else if (to === "moth") { const p = { id: uid(), title: it.text, theme: "", due: "", status: "Idée", caption: "" }; s.moth.posts.push(p); drop(); render(); toast("Ajouté aux idées de posts."); }
    else if (to === "musique") { s.musique.albums.push({ id: uid(), artist: it.text, album: "", status: "À écouter", note: "" }); drop(); render(); toast("Ajouté à la musique."); }
  },
  "k-start": () => { S().kundalini.start = todayISO(); site.save(); render(); },
  "k-add": kAdd,
  "k-del": el => { const k = S().kundalini; k.sessions = k.sessions.filter(x => x.id !== idOf(el)); site.save(); render(); },
  "w-add": () => { const v = +$("#wIn").value; if (!v) return; S().ecriture.sessions.push({ id: uid(), date: todayISO(), words: v, chapter: $("#wCh") ? $("#wCh").value : "" }); $("#wIn").value = ""; site.save(); render(); toast(`${v} mots. Le livre avance, que tu y croies ou non.`); },
  "frag-add": () => { const v = $("#fragIn").value.trim(); if (!v) return; S().ecriture.fragments.push({ id: uid(), text: v, date: todayISO() }); $("#fragIn").value = ""; site.save(); render(); },
  "frag-del": async el => { const e = S().ecriture; if (await ask("Supprimer ce fragment ?")) { e.fragments = e.fragments.filter(x => x.id !== idOf(el)); site.save(); render(); } },
  "post-new": () => postForm(null),
  "post-edit": el => postForm(S().moth.posts.find(p => p.id === idOf(el))),
  "post-del": async el => { const m = S().moth; if (await ask("Supprimer ce post ?")) { m.posts = m.posts.filter(p => p.id !== idOf(el)); site.save(); render(); } },
  "post-move": el => { const p = S().moth.posts.find(x => x.id === idOf(el)); const i = MOTH_COLS.indexOf(p.status) + +el.dataset.d; p.status = MOTH_COLS[Math.max(0, Math.min(3, i))]; site.save(); render(); if (p.status === "Publié") toast("Publié. L'algorithme décidera de ta valeur."); },
  "ph-log": el => { S().phidippus.log.push({ id: uid(), date: todayISO(), type: el.dataset.t, note: "" }); site.save(); render(); },
  "ph-note": () => { const v = $("#phNote").value.trim(); if (!v) return; S().phidippus.log.push({ id: uid(), date: todayISO(), type: "note", note: v }); $("#phNote").value = ""; site.save(); render(); },
  "ph-del": el => { const p = S().phidippus; p.log = p.log.filter(x => x.id !== idOf(el)); site.save(); render(); },
  "alb-new": () => albForm(null),
  "alb-edit": el => albForm(S().musique.albums.find(a => a.id === idOf(el))),
  "alb-del": el => { const m = S().musique; m.albums = m.albums.filter(a => a.id !== idOf(el)); site.save(); render(); },
  "ch-add": () => { S().ecriture.chapters.push({ id: uid(), name: `Chapitre ${S().ecriture.chapters.length + 1}`, goal: 5000 }); site.save(); render(); },
  "ch-del": async el => { const e = S().ecriture, i = +el.closest("[data-ci]").dataset.ci, c = e.chapters[i]; if (!await ask(`Supprimer « ${c.name} » ? Les mots déjà écrits passeront hors chapitre.`)) return; e.sessions.forEach(s => { if (s.chapter === c.id) s.chapter = ""; }); e.chapters.splice(i, 1); site.save(); render(); },
  "ch-up": el => { const a = S().ecriture.chapters, i = +el.closest("[data-ci]").dataset.ci; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } },
  "bud-month": el => { const [y, mo] = budMonth.split("-").map(Number), d = new Date(y, mo - 1 + +el.dataset.d, 15); budMonth = iso(d).slice(0, 7); gFilter.budget = ""; render(); },
  "bud-add": () => { const amt = Math.abs(+$("#bAmt").value); if (!amt) return toast("Un montant, même symbolique."); S().budget.entries.push({ id: uid(), type: $("#bType").value, amount: amt, cat: $("#bCat").value.trim(), note: $("#bNote").value.trim(), date: $("#bDate").value || todayISO() }); ["#bAmt", "#bNote"].forEach(s => $(s).value = ""); site.save(); render(); },
  "bud-del": el => { const b = S().budget; b.entries = b.entries.filter(e => e.id !== idOf(el)); site.save(); render(); },
  "env-add": () => { S().budget.envelopes.push({ id: uid(), name: "Nouvelle enveloppe", limit: 100 }); site.save(); render(); },
  "env-del": async el => { const b = S().budget, i = +el.closest("[data-vi]").dataset.vi; if (await ask(`Supprimer l'enveloppe « ${b.envelopes[i].name} » ? Les opérations restent.`)) { b.envelopes.splice(i, 1); site.save(); render(); } },
  "chat-send": () => { const t = $("#chatIn").value; sendChat(t); },
  "chat-chip": el => sendChat(el.textContent),
  "chat-clear": async () => { if (await ask("Effacer la conversation ?")) { chatLog.set([]); render(); } },
  "as-forget": () => { try { localStorage.removeItem("selene-api-key"); } catch {} render(); toast("Clé oubliée sur cet appareil."); },
  "exp": async () => {
    const data = createBackup(board.data, site.data), filename = `selene-${todayISO()}.json`;
    if (downloadsNS) { try { await downloadsNS.save({ filename, data }); } catch (e) { toast("Export annulé."); } return; }
    try { const file = new File([data], filename, { type: "application/json" }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Sauvegarde Selene" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  },
  "pal": el => { S().config.palette = el.dataset.p; site.save(); render(); },
  "mod-up": el => moveMod(el, -1), "mod-down": el => moveMod(el, 1)
};
function moveMod(el, d) { const ms = S().config.modules, i = +el.closest("[data-i]").dataset.i, j = i + d; if (j < 0 || j >= ms.length) return; [ms[i], ms[j]] = [ms[j], ms[i]]; site.save(); render(); }
document.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (a && CLICK[a.dataset.act] && a.tagName !== "SELECT" && !(a.tagName === "INPUT" && a.type !== "button")) CLICK[a.dataset.act](a); });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "capIn") capture(); if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatIn") { e.preventDefault(); sendChat(e.target.value); } });
document.addEventListener("change", e => {
  const el = e.target, act = el.dataset.act;
  if (act === "task-done") { const t = taskOf(el); t.done = el.checked; t.doneAt = el.checked ? todayISO() : null; if (el.checked) t.today = false; board.save(); render(); if (el.checked) toast(doneLines[Math.floor(Math.random() * doneLines.length)]); }
  else if (act === "task-step") { const t = taskOf(el); t.steps[+el.dataset.i].d = el.checked; board.save(); render(); }
  else if (act === "f-room") { roomFilter = el.value; render(); }
  else if (act === "f-cat") { catFilter = el.value; render(); }
  else if (act === "mus-f") { musFilter = el.value; render(); }
  else if (act === "alb-st") { S().musique.albums.find(a => a.id === idOf(el)).status = el.value; site.save(); render(); }
  else if (act && act.startsWith("grp-") && act !== "grp-filter") {
    const mod = el.closest("[data-mod]").dataset.mod, g = gcfg(mod), G = GROUPERS[mod];
    if (act === "grp-on") g.on = el.checked;
    else if (act === "grp-by") { g.by = el.value; gFilter[mod] = ""; }
    else if (act === "grp-sort") g.sort = el.value;
    else if (act === "grp-hide") g.hideDone = el.checked;
    else if (act === "grp-title") g.title = el.value.trim();
    else if (act === "grp-rename") {
      const from = el.dataset.old, to = el.value.trim(); if (!to || to === from) return;
      G.items().forEach(it => { if (it[g.by] === from) it[g.by] = to; });
      if (mod === "budget") S().budget.envelopes.forEach(v => { if (v.name === from) v.name = to; });
      if (gFilter[mod] === from) gFilter[mod] = to;
      if (mod === "chantier" && roomFilter === from) roomFilter = to;
      G.store().save(); toast(`« ${from} » s'appelle désormais « ${to} ».`);
    }
    site.save(); el.blur(); render();
  }
  else if (act === "env-name" || act === "env-limit") { const b = S().budget, v = b.envelopes[+el.closest("[data-vi]").dataset.vi]; if (act === "env-name") { const to = el.value.trim(); if (to && to !== v.name) { b.entries.forEach(e => { if (e.cat === v.name) e.cat = to; }); v.name = to; } } else v.limit = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
  else if (act === "as-key") { const v = el.value.trim(); if (v && !v.startsWith("•")) { try { localStorage.setItem("selene-api-key", v); } catch {} toast(hosted() ? "Clé enregistrée dans ce navigateur." : "Clé enregistrée. Elle servira une fois le site hébergé."); } el.blur(); render(); }
  else if (act === "as-model") { S().config.assistant.model = el.value; site.save(); render(); }
  else if (act === "as-actions") { S().config.assistant.actions = el.checked; site.save(); render(); }
  else if (act === "as-share") { S().config.assistant.share[el.dataset.k] = el.checked; site.save(); render(); }
  else if (act === "imp") {
    const f = el.files && el.files[0]; if (!f) return;
    f.text().then(async t => { const d = parseBackup(t); if (!await ask("Remplacer tout l'état actuel par celui du fichier ?")) return; board.data = d.board; site.data = d.site; board.save(); site.save(); render(); toast("Sauvegarde importée."); }).catch(() => toast("Fichier illisible ou pas une sauvegarde Selene.")).finally(() => { el.value = ""; });
  }
  else if (act === "ch-name" || act === "ch-goal") { const c = S().ecriture.chapters[+el.closest("[data-ci]").dataset.ci]; if (act === "ch-name") c.name = el.value.trim() || c.name; else c.goal = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
  else if (act === "mod-on") { S().config.modules[+el.closest("[data-i]").dataset.i].on = el.checked; site.save(); render(); }
  else if (act === "mod-label") { const m = S().config.modules[+el.closest("[data-i]").dataset.i]; const v = el.value.trim(); if (v && v !== MODULE_DEFS[m.id]) S().config.labels[m.id] = v; else delete S().config.labels[m.id]; site.save(); render(); }
  else if (el.dataset.set) {
    const [k, f] = el.dataset.set.split("."), s = S();
    let v = el.value; if (el.type === "number") v = Math.max(1, +v || 1); if (el.type === "date") v = v || null;
    s[k][f] = v; site.save(); el.blur(); render();
  }
});

/* ================= timer ================= */
let left = 900, tick = null, endAt = 0;
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
function tickTimer() {
  left = Math.max(0, Math.round((endAt - Date.now()) / 1000)); $("#clock").textContent = mmss(left);
  if (left <= 0) { clearInterval(tick); tick = null; $("#clock").classList.add("done"); $("#timerBtn").textContent = "Relancer"; toast("Quinze minutes. Tu as le droit d'arrêter. Et celui de continuer."); try { navigator.vibrate && navigator.vibrate(200); } catch {} }
}
$("#timerBtn").addEventListener("click", () => {
  const b = $("#timerBtn");
  if (tick) { clearInterval(tick); tick = null; b.textContent = "Reprendre"; return; }
  if (left === 0) left = 900; endAt = Date.now() + left * 1000; $("#clock").classList.remove("done"); b.textContent = "Pause";
  tick = setInterval(tickTimer, 500);
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && tick) tickTimer(); });
$("#timerReset").addEventListener("click", () => { clearInterval(tick); tick = null; left = 900; $("#clock").textContent = mmss(left); $("#clock").classList.remove("done"); $("#timerBtn").textContent = "Lancer 15 min"; });

/* ================= cycle de vie ================= */
const flushAll = () => { board.flush(); site.flush(); };
window.addEventListener("pagehide", flushAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
window.addEventListener("storage", e => { if ((e.key === board.key && board.reload()) | (e.key === site.key && site.reload())) render(); });
if (!window.claude) { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {} }

/* ================= boot ================= */
render();
(async () => {
  try {
    if (!window.claude || !window.claude.use) return;
    const db = await window.claude.use("db");
    if (db) await Promise.all([board.connect(db), site.connect(db)]);
  } catch {}
  try { if (window.claude && window.claude.use) { sampleNS = await window.claude.use("sample"); downloadsNS = await window.claude.use("downloads"); render(); } } catch {}
})();
