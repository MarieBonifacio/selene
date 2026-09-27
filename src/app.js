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
  assistant: "Assistant"
};
const MODULE_ORDER = ["chantier", "kundalini", "ecriture", "moth", "phidippus", "musique", "budget", "assistant", "inbox"];
const OFF_BY_DEFAULT = ["assistant"];
const money = n => (+n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
function siteSeed() {
  const modules = {
    kundalini: { type: "programme", label: "Kundalini", config: { unitLabel: "min", start: null, weeks: 12, perWeek: 5 }, entries: [] },
    ecriture: { type: "cumul", label: "Écriture", config: { unitLabel: "mots", goal: 40000, title: "La spiritualité du spectre dissociatif", categories: [], categoryLabel: "Chapitre", scraps: true, scrapsLabel: "Fragments" }, entries: [], scraps: [] },
    phidippus: { type: "rappels", label: "Phidippus", config: { subtitle: "", types: [{ id: "repas", label: "Repas", every: 6 }, { id: "brumisation", label: "Brumisation", every: 3 }, { id: "mue", label: "Mue", every: 0 }] }, entries: [] },
    chantier: boardToModule([]),
    moth: SECTION_TO_MODULE.moth({ posts: [] }),
    musique: SECTION_TO_MODULE.musique({ albums: ["Ulver", "Dead Can Dance", "Kate Bush", "Jonathan Hultén", "Chelsea Wolfe", "Zola Jesus", "iamamiwhoami"]
      .map(a => ({ id: uid(), artist: a, album: "", status: "À écouter", note: "" })) }),
    inbox: SECTION_TO_MODULE.inbox({ items: [] }),
    budget: SECTION_TO_MODULE.budget({ entries: [], envelopes: [["Travaux", 500], ["Courses", 300], ["Loisirs", 100], ["Abonnements", 50]].map(([name, limit]) => ({ id: uid(), name, limit })) })
  };
  return {
    updatedAt: 0, schemaVersion: SCHEMA_VERSION, boardMerged: true,
    config: { name: "Selene", palette: "nigredo", mode: "auto", labels: {}, groups: {},
      modules: MODULE_ORDER.map(id => ({ id, on: !OFF_BY_DEFAULT.includes(id) })),
      assistant: { model: "claude-sonnet-5", actions: true, share: { chantier: true, kundalini: true, ecriture: true, moth: true, phidippus: true, musique: true, budget: false, inbox: true } } },
    modules
  };
}
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
/* Remet un document du site dans la forme attendue (migration des anciens formats, champs ajoutés
   depuis, entrées de navigation manquantes). Appelée par le store à chaque fois que des données y entrent
   (lecture locale, synchro, import) : S() n'a donc plus rien à corriger et se contente de lire. */
function normalizeSite(d) {
  const seed = siteSeed();
  migrateModules(d);
  if ((d.schemaVersion || 1) < SCHEMA_VERSION) d.schemaVersion = SCHEMA_VERSION;
  for (const k of Object.keys(seed)) if (d[k] == null) d[k] = seed[k];
  for (const k of Object.keys(seed.config)) if (d.config[k] == null) d.config[k] = seed.config[k];
  for (const id of Object.keys(MODULE_DEFS)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: !OFF_BY_DEFAULT.includes(id) });
  for (const id of Object.keys(d.modules)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: true });
  for (const k of Object.keys(seed)) if (k !== "modules" && typeof seed[k] === "object" && !Array.isArray(seed[k])) for (const f of Object.keys(seed[k])) if (d[k][f] == null) d[k][f] = seed[k][f];
  for (const inst of Object.values(d.modules)) if (Object.hasOwn(MODULE_TYPES, inst.type) && MODULE_TYPES[inst.type].normalize) MODULE_TYPES[inst.type].normalize(inst);
  const inbox = inboxId(d.modules); // une seule boîte de réception, même après une fusion entre appareils
  for (const [id, inst] of Object.entries(d.modules)) if (inst.type === "notes" && inst.config.inbox && id !== inbox) inst.config.inbox = false;
  return d;
}
const site = makeStore("selene-site-v1", "site/state", siteSeed, normalizeSite);
/* L'ancien document « board » (tâches du Chantier jusqu'au format 5) n'est plus qu'un point d'entrée :
   ce qu'il contient est versé dans le module Chantier du site, puis il est vidé, et le vidage part au
   serveur à la synchro suivante (sinon chaque nouvel appareil ressusciterait les tâches supprimées).
   Une ancienne version de l'app restée ouverte ailleurs peut encore y écrire : rien n'est perdu.
   Doit être connecté APRÈS le site : versé dans un site pas encore synchronisé (données de départ),
   le contenu rendrait ces données « non vierges » et la synchro les fusionnerait au lieu de les remplacer. */
function absorbBoard(d) {
  if (!Array.isArray(d.tasks)) d.tasks = [];
  if (!d.tasks.length) return d;
  const inst = site.data.modules.chantier;
  if (inst && inst.type === "taches") for (const t of d.tasks) if (!inst.entries.some(x => x.id === t.id)) inst.entries.push(t);
  d.tasks = []; d.schemaVersion = SCHEMA_VERSION;
  site.save();
  return d;
}
const board = makeStore("selene-board-v1", "board/state", () => ({ updatedAt: 0, tasks: [] }), absorbBoard);
const S = () => site.data; // lecture seule : la normalisation a lieu à l'entrée des données, pas ici
const label = id => { const s = S(); return s.config.labels[id] || (s.modules[id] && s.modules[id].label) || MODULE_DEFS[id]; };
const enabled = id => { const m = S().config.modules.find(m => m.id === id); return m ? m.on : false; };

/* Regroupement en pourcentage d'un module : fourni par son type (TYPE_UI[type].grouper), réglé dans inst.config.groups. */
function grouperFor(mod) {
  const inst = Object.hasOwn(S().modules, mod) ? S().modules[mod] : null;
  return inst && TYPE_UI[inst.type].grouper ? TYPE_UI[inst.type].grouper(inst, mod) : null;
}
const gcfg = mod => S().modules[mod].config.groups;
const groupBy = mod => { const G = grouperFor(mod), by = gcfg(mod).by; return G.fields[by] ? by : Object.keys(G.fields)[0]; }; // un champ désactivé depuis ne casse rien
function groupPanel(mod, hint) {
  const G = grouperFor(mod), c = gcfg(mod);
  if (!G || !c || !c.on) return "";
  const by = groupBy(mod);
  let gs = G.groups(by);
  if (c.hideDone) gs = gs.filter(g => g.pct !== 100);
  const sorters = { name: (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "fr"), pct: (a, b) => (b.pct ?? -1) - (a.pct ?? -1), left: (a, b) => ((a.pct ?? 101)) - ((b.pct ?? 101)) };
  gs.sort(sorters[c.sort] || sorters.name);
  const active = gFilter[mod];
  const title = c.title || `Par ${G.fields[by].toLowerCase()}`;
  return `<section><div class="row" style="margin-bottom:4px"><h3 style="margin:0">${esc(title)}</h3><span class="spacer"></span><a class="btn ghost sm" href="#reglages" data-act="goto-groups" data-mod="${esc(mod)}">régler</a></div>
    <p class="hint">${hint}</p>
    <div class="rooms">${gs.map(g => `<button class="room ${active === g.name ? "active" : ""} ${g.pct > 100 ? "over" : ""}" ${G.filterable ? `data-act="grp-filter" data-mod="${esc(mod)}" data-g="${esc(g.name)}"` : "disabled"}><div class="fill" style="height:${Math.min(100, g.pct ?? 0)}%"></div><small>${esc(g.name)}</small><b>${g.pct == null ? "—" : g.pct + " %"}</b><small>${esc(g.sub)}</small></button>`).join("") || `<p class="empty">Rien à regrouper pour l'instant.</p>`}</div></section>`;
}
const gMatch = (mod, it) => { const v = gFilter[mod]; if (!v) return true; return (grouperFor(mod).key(it, groupBy(mod)) || "Sans groupe") === v; };

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
  const cb = formCb; formCb = null;
  try { cb(v); } catch (e) { toast(e.message || "Saisie invalide."); } // sinon l'erreur disparaît en silence
});

/* ================= views ================= */
const VIEWS = {};

VIEWS.accueil = () => {
  const m = moon(), s = S(), now = todayISO();
  const tod = todayTasks().slice(0, 3);
  const alerts = [];
  for (const [id, inst] of Object.entries(s.modules)) if (enabled(id) && TYPE_UI[inst.type].alerts) alerts.push(...TYPE_UI[inst.type].alerts(id, inst, now));
  const inbox = inboxId(s.modules), pending = inbox ? s.modules[inbox].entries.length : 0;
  const rows = s.config.modules.filter(x => x.on && x.id !== inbox).map(x => `<a class="over" href="#${esc(x.id)}"><b>${esc(label(x.id))}</b><span>${summaryFor(x.id)}</span><em class="hint" style="margin:0">ouvrir</em></a>`).join("");
  return `
  <section class="hero">${forestSVG(m.p)}<div class="txt">
    <div class="phase">${m.name}</div>
    <p>Éclairée à ${Math.round(m.illum * 100)} %, jour ${Math.floor(m.age) + 1} du cycle. ${m.p < .5 ? `Pleine lune dans ${m.nextFull} j.` : `Nouvelle lune dans ${m.nextNew} j.`}</p>
  </div></section>
  <div class="two">
    <section><h2>Aujourd'hui</h2><p class="hint">Trois choses. La forêt pousse très bien sans que tu la surveilles.</p>
      <ul class="plain">
        ${tod.map(([id, t]) => taskHTML(id, t)).join("")}
        ${alerts.map(a => `<li class="item"><span></span><div>${a.text}</div>${a.href ? `<a class="btn ghost sm" href="${esc(a.href)}">voir</a>` : a.quick ? `<button class="btn ghost sm" data-act="entry-add" data-mod="${esc(a.quick)}">noter</button>` : ""}</li>`).join("")}
      </ul>
      ${!tod.length ? `<p class="empty">Aucune tâche choisie. <button class="btn ghost sm" data-act="task-pick">Tirer une petite tâche au sort</button></p>` : ""}
    </section>
    <section><h2>Capturer</h2><p class="hint">Dépose-le ici comme une feuille morte, tu trieras l'humus plus tard.</p>
      ${inbox ? `<div class="capture"><input id="capIn" placeholder="${esc(s.modules[inbox].config.placeholder)}" aria-label="Capture rapide"><button class="btn acc" data-act="cap-add">Garder</button></div>
      ${pending ? `<p class="hint" style="margin-top:8px"><a href="#${esc(inbox)}">${pending} élément${pending > 1 ? "s" : ""} à trier</a></p>` : ""}`
      : `<p class="hint">Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans <a href="#reglages">Réglages</a>.</p>`}
    </section>
  </div>
  <section><h2>Où en sont les choses</h2>${rows}</section>`;
};

const SUMMARY = {
  assistant: () => { const b = backend(); return b === "sample" ? "Branché via claude.ai" : b === "api" ? "Branché via ta clé API" : "Pas encore branché"; }
};
function summaryFor(id) {
  const inst = Object.hasOwn(S().modules, id) ? S().modules[id] : null;
  return inst ? TYPE_UI[inst.type].summary(id, inst) : SUMMARY[id] ? SUMMARY[id]() : "";
}




const PALETTES = [["nigredo", "Nigredo, mousse", "#6f9a68"], ["albedo", "Albedo, lichen", "#aab7a6"], ["citrinitas", "Citrinitas, résine", "#c99a3c"], ["rubedo", "Rubedo, amanite", "#c0554a"]];
VIEWS.reglages = () => {
  const s = S(), c = s.config;
  return `<h2>Réglages</h2><p class="hint">Tout ici s'applique immédiatement.</p>
  <section><h3>Apparence</h3><p class="hint">Quatre étapes de l'Œuvre, prises dans le sous-bois.</p>
    <div class="swatches">${PALETTES.map(([id, n, col]) => `<button class="swatch ${c.palette === id ? "on" : ""}" data-act="pal" data-p="${id}"><i style="background:${col}"></i>${n}</button>`).join("")}</div>
    <div class="field-row" style="margin-top:14px"><label>Mode<select data-set="config.mode"><option value="auto" ${c.mode === "auto" ? "selected" : ""}>Suivre l'appareil</option><option value="dark" ${c.mode === "dark" ? "selected" : ""}>Toujours sombre</option><option value="light" ${c.mode === "light" ? "selected" : ""}>Toujours clair</option></select></label>
    <label>Nom affiché<input data-set="config.name" value="${esc(c.name)}"></label></div></section>
  <section><h3>Modules</h3><p class="hint">Active, renomme, réordonne. Les modules personnalisés (marqués ✕) peuvent être supprimés définitivement.</p>
    ${c.modules.map((m, i) => `<div class="set" data-i="${i}"><input type="checkbox" data-act="mod-on" ${m.on ? "checked" : ""} aria-label="Activer ${esc(label(m.id))}"><input data-act="mod-label" value="${esc(label(m.id))}" aria-label="Nom du module"><div class="row">${s.modules[m.id] ? `<button class="btn ghost sm" data-act="mod-del" data-mod="${esc(m.id)}" aria-label="Supprimer définitivement" title="Supprimer définitivement">✕</button>` : ""}<button class="btn ghost sm" data-act="mod-up" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="mod-down" aria-label="Descendre">↓</button></div></div>`).join("")}
    <details style="margin-top:14px"><summary class="hint" style="cursor:pointer;margin:0">+ Créer un module</summary>
      <div class="field-row" style="margin-top:10px"><label>Type<select id="newModType">${Object.entries(MODULE_TYPES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join("")}</select></label>
      <label>Nom<input id="newModName" placeholder="ex. Lecture, Sport, Méditation…"></label></div>
      <button class="btn sm" data-act="mod-add" style="margin-top:8px">Créer</button></details>
  </section>
  <section id="modreg"><h3>Réglages par module</h3><p class="hint">Un bloc par module actif, dans l'ordre de la navigation : ses réglages propres, et le regroupement en pourcentage quand il existe.</p>
    ${c.modules.filter(m => enabled(m.id) && (s.modules[m.id] || grouperFor(m.id))).map(m => { const mod = m.id, inst = s.modules[mod], G = grouperFor(mod), g = G ? gcfg(mod) : null, by = G ? groupBy(mod) : null;
      const names = G && G.renamable.includes(by) ? [...new Set(G.items().map(it => it[by]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")) : [];
      return `<details id="mreg-${esc(mod)}" data-mod="${esc(mod)}" style="border-top:1px solid var(--rule);padding:12px 0">
        <summary style="cursor:pointer;font-size:1.05rem;font-weight:600">${esc(label(mod))}</summary>
        <div style="margin-top:10px">
        ${inst ? TYPE_UI[inst.type].settings(mod, inst) : ""}
        ${G ? `<div class="row" style="margin-top:0"><label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="grp-on" ${g.on ? "checked" : ""}>Regrouper en pourcentage</label></div>
          ${g.on ? `<div class="field-row" style="margin-top:8px">
            <label>Regrouper par<select data-act="grp-by">${Object.entries(G.fields).map(([k, l]) => `<option value="${esc(k)}" ${by === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
            <label>Trier par<select data-act="grp-sort"><option value="name" ${g.sort === "name" ? "selected" : ""}>Ordre naturel</option><option value="pct" ${g.sort === "pct" ? "selected" : ""}>Le plus avancé d'abord</option><option value="left" ${g.sort === "left" ? "selected" : ""}>Le plus en retard d'abord</option></select></label></div>
            <div class="field-row" style="margin-top:8px"><label>Titre du bloc<input data-act="grp-title" value="${esc(g.title)}" placeholder="Par ${esc(G.fields[by].toLowerCase())}"></label>
            <label style="display:flex;gap:8px;align-items:center;align-self:end;padding-bottom:10px"><input type="checkbox" data-act="grp-hide" ${g.hideDone ? "checked" : ""}>Masquer les groupes à 100 %</label></div>
            ${names.length ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer;margin:0">Renommer ou fusionner des ${esc(G.fields[by].toLowerCase())}s</summary><p class="hint" style="margin:6px 0">Donne le même nom à deux groupes pour les fusionner.</p>${names.map(n => `<div class="set" style="grid-template-columns:1fr"><input data-act="grp-rename" data-old="${esc(n)}" value="${esc(n)}" aria-label="Renommer ${esc(n)}"></div>`).join("")}</details>` : ""}
           ` : ""}` : ""}
        </div>
      </details>`; }).join("")}
  </section>
  ${enabled("assistant") ? `<section id="assistant-cfg"><h3>Assistant</h3><p class="hint">Claude dans le tableau de bord. Sur claude.ai, il passe par ton compte. Hébergé ailleurs (GitHub Pages), il faut ta propre clé API, gardée uniquement dans ce navigateur.</p>
    <div class="field-row"><label>Clé API Anthropic (hébergé uniquement)<input type="password" data-act="as-key" value="${getKey() ? "••••••••" : ""}" placeholder="sk-ant-…" autocomplete="off"></label>
    <label>Modèle<select data-act="as-model">${[["claude-haiku-4-5-20251001", "Haiku 4.5, rapide et peu cher"], ["claude-sonnet-5", "Sonnet 5, équilibré"], ["claude-opus-5-5", "Opus 5.5, le plus capable"]].map(([k, l]) => `<option value="${k}" ${s.config.assistant.model === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-act="as-actions" ${s.config.assistant.actions ? "checked" : ""}>Autoriser Claude à modifier le tableau de bord (tâches, capture, budget)</label>
    <p class="hint" style="margin:12px 0 4px">Ce que Claude peut lire :</p><div class="row">${Object.keys(s.config.assistant.share).filter(enabled).map(k => `<label style="display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" data-act="as-share" data-k="${esc(k)}" ${s.config.assistant.share[k] ? "checked" : ""}>${esc(label(k))}</label>`).join("")}</div>
    ${getKey() ? `<button class="btn ghost sm" data-act="as-forget" style="margin-top:10px">Oublier la clé sur cet appareil</button>` : ""}</section>` : ""}
  ${hosted() && authReady() && authSession ? `<section><h3>Compte</h3><p class="hint">Connecté en tant que ${esc(authSession.user.email)}. Tes données sont propres à ce compte et suivent sur tous tes appareils. Se déconnecter efface de cet appareil tes données, la conversation avec l'assistant et la clé API.</p>
    <button class="btn ghost" data-act="auth-out">Se déconnecter</button></section>` : ""}
  <section><h3>Sauvegarde</h3><p class="hint">Tout ton état dans un fichier JSON, pour passer de claude.ai à GitHub Pages ou d'un navigateur à l'autre. La clé API n'y figure jamais.</p>
    <div class="row"><button class="btn" data-act="exp">Exporter</button><label class="btn" style="display:inline-block;font-weight:500">Importer<input type="file" accept="application/json,.json" data-act="imp" style="display:none"></label></div></section>`;
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
  if (hosted() && authReady() && !authSession) { $("#nav").innerHTML = ""; $("#main").innerHTML = authView(); return; }
  const s = S(), m = moon();
  let view = location.hash.slice(1) || "accueil";
  // Les vues fixes priment toujours ; hasOwn évite qu'un « #constructor » trouve Object.prototype.
  const fixed = v => v === "accueil" || v === "reglages";
  if (!fixed(view) && (!(Object.hasOwn(s.modules, view) || Object.hasOwn(VIEWS, view)) || !enabled(view))) view = "accueil";
  const inst = !fixed(view) && Object.hasOwn(s.modules, view) ? s.modules[view] : null;
  $("#brandName").textContent = s.config.name || "Selene";
  document.title = s.config.name || "Selene";
  $("#miniMoon").innerHTML = moonSVG(m.p, 40);
  $("#dateline").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + ", " + m.name.toLowerCase();
  const badge = id => { const m = Object.hasOwn(s.modules, id) && s.modules[id], n = m && TYPE_UI[m.type].badge ? TYPE_UI[m.type].badge(m) : 0; return n ? ` (${n})` : ""; };
  const links = [["accueil", "Accueil"], ...s.config.modules.filter(x => x.on).map(x => [x.id, label(x.id)]), ["reglages", "Réglages"]];
  $("#nav").innerHTML = links.map(([id, l]) => `<a href="#${esc(id)}" class="${id === view ? "on" : ""}">${esc(l)}${badge(id)}</a>`).join("");
  // Les champs des Réglages n'ont pas d'id (donc pas de restauration ci-dessous) : tant que l'un d'eux
  // a le focus, ne pas redessiner, sinon une synchro arrivant pendant la frappe effacerait la saisie.
  const ae = document.activeElement, typing = ae && ae.closest && ae.closest("#main") &&
    (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !["checkbox", "radio", "file", "button"].includes(ae.type)));
  if (typing && view === "reglages" && lastView === "reglages") return;
  const keep = {}; let focusId = null, caret = null;
  if (view === lastView) $("#main").querySelectorAll("input[id],textarea[id],select[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
  if (document.activeElement && document.activeElement.id && keep[document.activeElement.id] != null) { focusId = document.activeElement.id; try { caret = document.activeElement.selectionStart; } catch {} }
  $("#main").innerHTML = inst ? TYPE_UI[inst.type].view(view) : VIEWS[view]();
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && v !== "" && el.value !== v) el.value = v; }
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch {} } }
  lastView = view;
}
window.addEventListener("hashchange", () => { openId = null; render(); const t = sessionStorage.getItem("selene-scroll"); sessionStorage.removeItem("selene-scroll"); const el = t && document.getElementById(t); if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView(); } else window.scrollTo(0, 0); });

/* ================= actions ================= */
const idOf = el => el.closest("[data-id]")?.dataset.id;
function capture() {
  const inp = $("#capIn"); if (!inp || !inp.value.trim()) return;
  const id = inboxId(S().modules); if (!id) return toast("Aucune boîte de réception : voir Réglages.");
  addCapture(S().modules[id].entries, inp.value, uid(), todayISO()); site.save(); inp.value = ""; render(); toast("Gardé. Tu peux oublier, c'est écrit.");
}
function entryAdd(id) {
  const inst = S().modules[id], ui = TYPE_UI[inst.type];
  if (ui.add) ui.add(id, inst);
}
const CLICK = {
  "grp-filter": el => { const m = el.dataset.mod, g = el.dataset.g; gFilter[m] = gFilter[m] === g ? "" : g; render(); },
  "goto-groups": el => { const id = "mreg-" + el.dataset.mod; if (location.hash === "#reglages") { const d = document.getElementById(id); if (d) { d.open = true; d.scrollIntoView(); } } else sessionStorage.setItem("selene-scroll", id); },
  "cap-add": capture,
  "entry-add": el => entryAdd(el.dataset.mod),
  "entry-del": el => { deleteJournalEntry(S().modules[el.dataset.mod], idOf(el)); site.save(); render(); },
  "mod-add": () => {
    const type = $("#newModType").value, name = $("#newModName").value.trim();
    if (!name) return toast("Donne un nom au module.");
    try {
      const s = S(), id = slugId(name, [...s.config.modules.map(x => x.id), ...Object.keys(s.modules), ...Object.keys(VIEWS)]);
      createModuleInstance(s.modules, type, name, id);
      s.config.modules.push({ id, on: true });
      s.config.assistant.share[id] = true;
      site.save(); render(); toast(`Module « ${name} » créé.`);
    } catch (e) { toast(e.message); }
  },
  "mod-del": el => {
    const id = el.dataset.mod, name = label(id);
    openForm(`Supprimer « ${name} »`, [{ n: "confirm", l: `Retape « ${name} » pour confirmer la suppression définitive de ses données.`, req: true }], {}, v => {
      if (v.confirm !== name) return toast("Nom incorrect, rien n'a été supprimé.");
      const s = S();
      deleteModuleInstance(s.modules, s.config.modules, id);
      delete s.config.labels[id]; delete s.config.groups[id]; delete s.config.assistant.share[id];
      site.save(); render(); toast(`« ${name} » supprimé.`);
    });
  },
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
  "mod-up": el => moveMod(el, -1), "mod-down": el => moveMod(el, 1),
  "auth-switch": () => { authMode = authMode === "signup" ? "signin" : "signup"; render(); },
  "auth-out": () => authSignOut()
};
function moveMod(el, d) { const ms = S().config.modules, i = +el.closest("[data-i]").dataset.i, j = i + d; if (j < 0 || j >= ms.length) return; [ms[i], ms[j]] = [ms[j], ms[i]]; site.save(); render(); }
document.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (a && CLICK[a.dataset.act] && a.tagName !== "SELECT" && !(a.tagName === "INPUT" && a.type !== "button")) CLICK[a.dataset.act](a); });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "capIn") capture(); if (e.key === "Enter" && e.target.id === "noteIn") CLICK["note-add"](e.target); if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatIn") { e.preventDefault(); sendChat(e.target.value); } });
const CHANGE = {}; // actions « change » des types de module (remplie par types.js)
document.addEventListener("change", e => {
  const el = e.target, act = el.dataset.act;
  if (act && Object.hasOwn(CHANGE, act)) CHANGE[act](el);
  else if (act && act.startsWith("grp-") && act !== "grp-filter") {
    const mod = el.closest("[data-mod]").dataset.mod, g = gcfg(mod), G = grouperFor(mod);
    if (act === "grp-on") g.on = el.checked;
    else if (act === "grp-by") { g.by = el.value; gFilter[mod] = ""; }
    else if (act === "grp-sort") g.sort = el.value;
    else if (act === "grp-hide") g.hideDone = el.checked;
    else if (act === "grp-title") g.title = el.value.trim();
    else if (act === "grp-rename") {
      const from = el.dataset.old, to = el.value.trim(); if (!to || to === from) return;
      const by = groupBy(mod); G.items().forEach(it => { if (it[by] === from) it[by] = to; });
      if (G.rename) G.rename(from, to); // ex. une enveloppe du budget porte le nom du groupe
      if (gFilter[mod] === from) gFilter[mod] = to;
      if (taskFilters[mod] && taskFilters[mod].room === from) taskFilters[mod].room = to;
      G.store().save(); toast(`« ${from} » s'appelle désormais « ${to} ».`);
    }
    site.save(); el.blur(); render();
  }
  else if (act === "as-key") { const v = el.value.trim(); if (v && !v.startsWith("•")) { try { localStorage.setItem("selene-api-key", v); } catch {} toast(hosted() ? "Clé enregistrée dans ce navigateur." : "Clé enregistrée. Elle servira une fois le site hébergé."); } el.blur(); render(); }
  else if (act === "as-model") { S().config.assistant.model = el.value; site.save(); render(); }
  else if (act === "as-actions") { S().config.assistant.actions = el.checked; site.save(); render(); }
  else if (act === "as-share") { S().config.assistant.share[el.dataset.k] = el.checked; site.save(); render(); }
  else if (act === "imp") {
    const f = el.files && el.files[0]; if (!f) return;
    f.text().then(async t => { const d = parseBackup(t); if (!await ask("Remplacer tout l'état actuel par celui du fichier ?")) return; site.replaceAll(d.site); board.replaceAll(d.board); /* le site d'abord : les tâches d'une ancienne sauvegarde y sont versées */ render(); toast("Sauvegarde importée."); }).catch(() => toast("Fichier illisible ou pas une sauvegarde Selene.")).finally(() => { el.value = ""; });
  }
  else if (act === "mod-on") { S().config.modules[+el.closest("[data-i]").dataset.i].on = el.checked; site.save(); render(); }
  else if (act === "mod-label") {
    const s = S(), m = s.config.modules[+el.closest("[data-i]").dataset.i], v = el.value.trim();
    if (s.modules[m.id]) { s.modules[m.id].label = v || s.modules[m.id].label; }
    else if (v && v !== MODULE_DEFS[m.id]) s.config.labels[m.id] = v; else delete s.config.labels[m.id];
    site.save(); render();
  }
  else if (el.dataset.setMod) {
    // « id.champ » ou « id.groupe.champ » ; jamais un chemin vers le prototype des objets.
    const [id, ...path] = el.dataset.setMod.split("."), f = path.pop();
    if ([...path, f].some(k => k === "__proto__" || k === "constructor" || k === "prototype")) return;
    const cfg = path.reduce((o, k) => o[k], S().modules[id].config);
    let v = el.value; if (el.type === "number") v = Math.max(1, +v || 1); if (el.type === "date") v = v || null;
    if (el.required && !String(v).trim()) { el.blur(); return render(); } // champ obligatoire vidé : on garde l'ancienne valeur
    cfg[f] = v; site.save(); el.blur(); render();
  }
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

