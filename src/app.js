/* ================= utils ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const todayISO = () => iso(new Date());
const addDaysTo = (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((new Date(a + "T12:00") - new Date(b + "T12:00")) / 86400000);
// Formater une date coûte cher (un formateur Intl reconstruit à chaque appel) et une liste de fragments en affiche
// des milliers : fonction pure, donc résultats gardés, dans une limite de taille.
const fmtCache = new Map();
const fmt = (s, o = { day: "numeric", month: "short" }) => {
  if (!s) return "";
  const k = s + JSON.stringify(o);
  let v = fmtCache.get(k);
  if (v === undefined) { v = new Date(s + "T12:00").toLocaleDateString("fr-FR", o); if (fmtCache.size >= 5000) fmtCache.clear(); fmtCache.set(k, v); }
  return v;
};
const clone = o => JSON.parse(JSON.stringify(o));
const ago = s => { if (!s) return "jamais"; const n = diffDays(todayISO(), s); return n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} j`; };
function toast(msg) { undoFn = null; const el = $("#toast"); el.textContent = msg; el.classList.remove("act"); el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3400); }
/* Un message avec une action proposée (« Annuler », « Ajouter »…), qui disparaît d'elle-même : jamais imposée. */
let undoFn = null;
function toastAction(msg, button, fn, ms = 6000) {
  const el = $("#toast");
  el.innerHTML = `${esc(msg)} <button class="btn sm" data-act="undo">${esc(button)}</button>`;
  el.classList.add("show", "act"); undoFn = fn;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.classList.remove("show", "act"); undoFn = null; }, ms);
}
/* « Annuler » pendant quelques secondes, au lieu d'une confirmation avant d'agir. */
const toastUndo = (msg, undo) => toastAction(msg, "Annuler", undo);
/* Retire un élément d'une liste d'un module (entries, scraps…) ; « Annuler » le remet à sa place. */
function removeWithUndo(id, list, itemId) {
  const inst = S().modules[id], i = inst[list].findIndex(x => x.id === itemId);
  if (i < 0) return;
  const item = inst[list][i], name = String(item.title || item.text || item.note || item.type || "l'élément");
  inst[list] = inst[list].filter(x => x.id !== itemId); site.save(); render();
  toastUndo(`Supprimé : « ${name.length > 40 ? name.slice(0, 40) + "…" : name} ».`, () => {
    const cur = S().modules[id]; // relu : une synchro a pu passer entre-temps
    if (!cur || cur[list].some(x => x.id === itemId)) return;
    cur[list].splice(Math.min(i, cur[list].length), 0, item); site.save(); render(); toast("Rétabli. Rien ne s'est passé.");
  });
}
/* Longues listes : les PAGE premiers éléments, puis « Voir les suivants ». Propre à l'appareil, remis à zéro
   quand on change de vue : une liste de milliers de fragments se calcule vite mais se parcourt mal au pouce. */
const PAGE = 100, pageSize = {};
function paged(key, list) {
  const n = pageSize[key] || PAGE, rest = list.length - n;
  return { items: list.slice(0, n), more: rest > 0 ? `<li class="more-row"><button class="btn ghost sm" data-act="page-more" data-k="${esc(key)}">Voir les ${Math.min(PAGE, rest)} suivants (${rest} de plus)</button></li>` : "" };
}
function setSaving(t) { $("#saving").textContent = t; }

/* ================= stores ================= */

const MODULE_DEFS = {
  assistant: "Assistant"
};
const OFF_BY_DEFAULT = ["assistant"];
const money = n => (+n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
/* Données de départ d'un compte neuf : presque rien, et rien de personnel. L'accueil propose ensuite des
   modèles (MODULE_TEMPLATES). Doivent rester « vierges » (updatedAt 0, pas d'identifiant aléatoire) :
   un appareil vierge adopte le serveur tel quel au lieu de fusionner. */
function siteSeed() {
  return {
    updatedAt: 0, schemaVersion: SCHEMA_VERSION, boardMerged: true,
    config: { name: "Selene", palette: "nigredo", mode: "auto", labels: {}, groups: {}, welcome: true,
      modules: [{ id: "inbox", on: true }, { id: "assistant", on: !OFF_BY_DEFAULT.includes("assistant") }],
      assistant: { model: "claude-sonnet-5", actions: true, share: { inbox: true } } },
    modules: { inbox: SECTION_TO_MODULE.inbox({ items: [] }) }
  };
}
/* ================= moon ================= */
/* Mois synodique moyen (d'une nouvelle lune à la suivante) et une nouvelle lune de référence. */
const SYNODIC = 29.530588853, NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
const MOON_NAMES = ["Nouvelle lune", "Premier croissant", "Premier quartier", "Gibbeuse croissante", "Pleine lune", "Gibbeuse décroissante", "Dernier quartier", "Dernier croissant"];
const moonName = p => MOON_NAMES[Math.floor(((p + 1 / 16) % 1) * 8)];
function moon() {
  const syn = SYNODIC, ref = NEW_MOON_REF;
  const age = (((Date.now() - ref) / 86400000) % syn + syn) % syn;
  const p = age / syn;
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const nextFull = p < .5 ? (0.5 - p) * syn : (1.5 - p) * syn;
  const nextNew = (1 - p) * syn;
  return { p, age, illum, name: moonName(p), nextFull: Math.round(nextFull), nextNew: Math.round(nextNew) };
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
/* Trois plans superposés : le ciel et ses étoiles, la lune et son halo, les sapins et la brume. Le ciel et les sapins
   sont recadrés (« slice ») pour remplir toute largeur ; la lune ne l'est pas, sinon un écran étroit la coupe. Son
   repère (-150…150) est à l'échelle du ciel (300 de haut) : même taille qu'avant, centrée à 82 % de la largeur. */
function forestSVG(p) {
  if (!TREES) buildTrees();
  const r = 46, c = 50, rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  const lit = p < .5 ? `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${p < .25 ? 0 : 1} ${c},${c - r}Z`
                     : `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${p < .75 ? 0 : 1} ${c},${c - r}Z`;
  return `<svg class="scene" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Lune au-dessus d'une lisière de sapins">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bot)"/></linearGradient></defs>
    <rect width="1000" height="300" fill="url(#sky)"/>
    <g fill="var(--moon)" opacity="var(--star)" style="opacity:var(--star)">${TREES.stars}</g>
  </svg>
  <div class="moon" aria-hidden="true"><svg viewBox="-150 -150 300 300">
    <defs><radialGradient id="glow"><stop offset="0" stop-color="var(--glow)"/><stop offset="1" stop-color="var(--glow)" stop-opacity="0"/></radialGradient></defs>
    <circle r="${40 + 120 * (1 - Math.abs(1 - 2 * p)) * .9}" fill="url(#glow)"/>
    <g transform="scale(.84) translate(-50 -50)"><circle cx="50" cy="50" r="${r}" fill="var(--moon-shadow)" opacity=".85"/><path d="${lit}" fill="var(--moon)"/></g>
  </svg></div>
  <svg class="scene trees" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--mist)" stop-opacity="0"/><stop offset=".6" stop-color="var(--mist)"/><stop offset="1" stop-color="var(--mist)" stop-opacity="0"/></linearGradient></defs>
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
  // « welcome » n'est pas un réglage manquant : il n'existe que pour les comptes créés avec ce bloc d'accueil.
  for (const k of Object.keys(seed.config)) if (k !== "welcome" && d.config[k] == null) d.config[k] = seed.config[k];
  for (const id of Object.keys(MODULE_DEFS)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: !OFF_BY_DEFAULT.includes(id) });
  for (const id of Object.keys(d.modules)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: true });
  for (const k of Object.keys(seed)) if (k !== "modules" && k !== "config" && typeof seed[k] === "object" && !Array.isArray(seed[k])) for (const f of Object.keys(seed[k])) if (d[k][f] == null) d[k][f] = seed[k][f];
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

/* Sur téléphone, le paysage se réduit à un bandeau à partir de la deuxième ouverture du jour ; décidé une fois
   par chargement, pour qu'il ne se replie pas sous les yeux en cours d'utilisation. */
const HERO_COMPACT = (() => { try { const seen = localStorage.getItem("selene-hero-day") === todayISO(); localStorage.setItem("selene-hero-day", todayISO()); return seen; } catch { return false; } })();
VIEWS.accueil = () => {
  const m = moon(), s = S(), now = todayISO();
  const tod = todayTasks().slice(0, 3);
  const alerts = [];
  for (const [id, inst] of Object.entries(s.modules)) if (enabled(id) && TYPE_UI[inst.type].alerts) alerts.push(...TYPE_UI[inst.type].alerts(id, inst, now));
  const inbox = inboxId(s.modules), pending = inbox ? s.modules[inbox].entries.length : 0;
  // Toute la ligne mène au module ; un chevron la déplie sur ses derniers éléments, sans avoir à l'ouvrir.
  const rows = s.config.modules.filter(x => x.on && x.id !== inbox).map(x => {
    const inst = Object.hasOwn(s.modules, x.id) ? s.modules[x.id] : null, more = inst && TYPE_UI[inst.type].recent ? TYPE_UI[inst.type].recent(inst) : [];
    const r = inst && inst.resume, bridge = r ? `<small class="resume ${bridgeStale(r) ? "stale" : ""}">↳ ${esc(r.text)} · ${ago(r.at)}</small>` : "";
    return `<div class="over-wrap${more.length ? " has-more" : ""}"><a class="over" href="#${esc(x.id)}"><b>${esc(label(x.id))}</b><span>${summaryFor(x.id)}${bridge}</span></a>${more.length ? `<details class="more"><summary><span class="sr">Derniers éléments de ${esc(label(x.id))}</span></summary><ul>${more.map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : ""}</div>`;
  }).join("");
  return `
  ${s.config.welcome ? `<section><h2>Composer ton espace</h2><p class="hint">Ajoute ce que tu veux suivre, autant de fois que tu veux. Tout se renomme, se règle ou se supprime ensuite dans Réglages.</p>
    ${MODULE_TEMPLATES.map(t => `<div class="set" style="grid-template-columns:1fr auto"><div><b>${esc(t.name)}</b><div class="hint" style="margin:2px 0 0">${esc(t.hint)}</div></div><button class="btn sm" data-act="tpl-add" data-tpl="${esc(t.id)}">Ajouter</button></div>`).join("")}
    <div class="row" style="margin-top:12px"><button class="btn acc" data-act="welcome-done">C'est bon</button></div></section>` : ""}
  <section class="hero${HERO_COMPACT ? " compact" : ""}">${forestSVG(m.p)}<div class="txt">
    <div class="phase">${m.name}</div>
    <p>Éclairée à ${Math.round(m.illum * 100)} %, jour ${Math.floor(m.age) + 1} du cycle. ${m.p < .5 ? `Pleine lune dans ${m.nextFull} j.` : `Nouvelle lune dans ${m.nextNew} j.`}</p>
  </div></section>
  <div class="two">
    <section><h2>Aujourd'hui</h2><p class="hint">Trois choses. La forêt pousse très bien sans que tu la surveilles.</p>
      <ul class="plain">
        ${tod.map(([id, t]) => taskHTML(id, t)).join("")}
        ${alerts.map(a => `<li class="item alert"><span></span><div>${a.text}</div>${a.actions ? `<div class="row">${a.actions}</div>` : a.href ? `<a class="btn ghost sm" href="${esc(a.href)}">voir</a>` : ""}</li>`).join("")}
      </ul>
      ${!tod.length ? (taskModules().length ? `<p class="empty">Aucune tâche choisie. <button class="btn ghost sm" data-act="task-pick">Tirer une petite tâche au sort</button></p>` : `<p class="empty">Rien de prévu. Un module de tâches remplirait cet espace, si tu y tiens.</p>`) : ""}
    </section>
    <section><h2>Capturer</h2><p class="hint">Dépose-le ici comme une feuille morte, tu trieras l'humus plus tard.</p>
      ${inbox ? `<div class="capture"><input id="capIn" data-draft placeholder="${esc(s.modules[inbox].config.placeholder)}" aria-label="Capture rapide"><button class="btn acc" data-act="cap-add">Garder</button></div>
      ${pending ? `<p class="hint" style="margin-top:8px"><a href="#${esc(inbox)}">${pending} élément${pending > 1 ? "s" : ""} à trier</a></p>` : ""}`
      : `<p class="hint">Aucune boîte de réception. Coche « Boîte de réception » sur un module Notes, dans <a href="#reglages">Réglages</a>.</p>`}
    </section>
  </div>
  <section><div class="row" style="align-items:baseline"><h2>Où en sont les choses</h2><span class="spacer"></span><a class="btn ghost sm" href="#bilan">Bilan du ${bilanMode() === "mois" ? "mois" : "cycle"}</a></div>${rows}</section>
  ${sortesSection()}`;
};

/* ================= pont de reprise =================
   En haut de chaque module : le prochain geste noté la dernière fois, ou de quoi le noter en partant.
   Le champ s'ouvre de lui-même à la fin du minuteur ; l'ignorer suffit à le refuser. */
let bridgeOpen = null; // module dont le champ « prochain geste » est ouvert
const bridgeStale = r => diffDays(todayISO(), r.at) > 14; // un pont vieux de deux semaines ment peut-être
function bridgeBar(id, inst) {
  const r = inst.resume, m = esc(id);
  if (bridgeOpen === id) return `<div class="bridge"><input id="bridgeIn" data-mod="${m}" maxlength="200" value="${esc(r ? r.text : "")}" placeholder="Le prochain geste, pour la prochaine fois…" aria-label="Prochain geste"><button class="btn sm acc" data-act="bridge-save" data-mod="${m}">Garder</button><button class="btn ghost sm" data-act="bridge-close">plus tard</button></div>`;
  if (r) return `<div class="bridge on ${bridgeStale(r) ? "stale" : ""}"><span>↳ <b>Reprendre :</b> ${esc(r.text)} <span class="hint">· noté ${ago(r.at)}</span></span><span class="acts"><button class="btn ghost sm" data-act="bridge-done" data-mod="${m}">fait</button><button class="btn ghost sm" data-act="bridge-edit" data-mod="${m}">modifier</button></span></div>`;
  return `<div class="bridge off"><button class="btn ghost sm" data-act="bridge-edit" data-mod="${m}">Je m'arrête ici…</button></div>`;
}
function bridgeSave(id) {
  const inst = S().modules[id], inp = $("#bridgeIn"); if (!inst || !inp) return;
  setResume(inst, inp.value, todayISO()); bridgeOpen = null; site.save(); render();
  toast(inst.resume ? "Noté. La prochaine fois commencera ici." : "Pont levé.");
}

const SUMMARY = {
  assistant: () => { const b = backend(); return b === "sample" ? "Branché via claude.ai" : b === "api" ? "Branché via ta clé API" : "Pas encore branché"; }
};
function summaryFor(id) {
  const inst = Object.hasOwn(S().modules, id) ? S().modules[id] : null;
  return inst ? TYPE_UI[inst.type].summary(id, inst) : SUMMARY[id] ? SUMMARY[id]() : "";
}




/* ================= bilan =================
   Une période (cycle lunaire, d'une nouvelle lune à la suivante, ou mois civil), et pour chaque module la
   ligne de bilan que fournit son type (TYPE_UI[type].review), à côté de celle de la période précédente.
   Une information pour prendre du recul, pas un score. */
let bilanOffset = 0;
const bilanMode = () => { try { return localStorage.getItem("selene-bilan") === "mois" ? "mois" : "lune"; } catch { return "lune"; } };
/* [from, to[ en dates ISO ; offset 0 = la période en cours, 1 = la précédente… */
function periodOf(mode, offset, now = Date.now()) {
  if (mode === "mois") {
    const d = new Date(now), start = new Date(d.getFullYear(), d.getMonth() - offset, 1), end = new Date(d.getFullYear(), d.getMonth() - offset + 1, 1);
    return { from: iso(start), to: iso(end), name: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
  }
  const len = SYNODIC * 86400000, k = Math.floor((now - NEW_MOON_REF) / len) - offset, start = NEW_MOON_REF + k * len, end = start + len;
  return { from: iso(new Date(start)), to: iso(new Date(end)), name: `Cycle du ${fmt(iso(new Date(start)), { day: "numeric", month: "long" })} au ${fmt(iso(new Date(end - 86400000)), { day: "numeric", month: "long" })}` };
}

/* ================= test lunaire =================
   Test de Rayleigh (statistique circulaire) : l'activité (tout ce qui est daté, le même corpus que la
   recherche) se concentre-t-elle autour d'une phase de la lune, plutôt que d'être uniformément répartie sur
   le cycle ? Un résultat nul a de la valeur : il dit que la lune n'y est pour rien. Un seul test, ici — le
   répéter ailleurs avec d'autres découpages ferait courir le risque classique des tests multiples : à force
   d'essayer, on finit par trouver un faux signal. */
const LUNAR_MIN_N = 40;
const lunarPhase = date => { const t = ((Date.parse(date + "T12:00:00Z") - NEW_MOON_REF) / 86400000 % SYNODIC + SYNODIC) % SYNODIC; return t / SYNODIC; };
function lunarTest() {
  const angles = [];
  for (const inst of Object.values(S().modules)) {
    const ui = TYPE_UI[inst.type];
    if (!ui || !ui.texts || isConcordance(inst)) continue;
    for (const t of ui.texts(inst)) if (t.date) angles.push(lunarPhase(t.date) * 2 * Math.PI);
  }
  const n = angles.length;
  if (n < LUNAR_MIN_N) return { n, enough: false };
  let c = 0, s = 0;
  for (const a of angles) { c += Math.cos(a); s += Math.sin(a); }
  const R = Math.sqrt(c * c + s * s) / n, Z = n * R * R;
  // Approximation asymptotique classique du p (Zar, Biostatistical Analysis) ; suffisante au-delà de 40 événements.
  const p = Math.exp(-Z) * (1 + (2 * Z - Z * Z) / (4 * n) - (24 * Z - 132 * Z * Z + 76 * Z ** 3 - 9 * Z ** 4) / (288 * n * n));
  const meanPhase = (Math.atan2(s, c) / (2 * Math.PI) + 1) % 1;
  return { n, enough: true, R, p: Math.max(0, Math.min(1, p)), meanPhase };
}
function lunarSection() {
  const r = lunarTest();
  if (!r.enough) return `<section><h3>Lune</h3><p class="hint">Pas assez de matière pour un test honnête : ${r.n} événement${r.n > 1 ? "s" : ""} daté${r.n > 1 ? "s" : ""} au lieu de ${LUNAR_MIN_N} au moins. Reviens quand le corpus aura grandi.</p></section>`;
  const sig = r.p < .05;
  return `<section><h3>Lune</h3><p class="hint">Test de Rayleigh sur ${r.n} événement${r.n > 1 ? "s" : ""} daté${r.n > 1 ? "s" : ""} : ta lune éclaire-t-elle vraiment ton activité, ou est-ce une histoire qu'on se raconte ? Un seul test compte ici ; le refaire ailleurs sous d'autres formes userait sa valeur (tests multiples).</p>
    <p>${sig
      ? `Concentration autour de ${esc(moonName(r.meanPhase).toLowerCase())} (R = ${r.R.toFixed(2)}, p = ${r.p.toFixed(3)}). Ce n'est pas rien, mais ce n'est pas une preuve : une seule corrélation, jamais répétée ni contrôlée.`
      : `Rien de concentré (R = ${r.R.toFixed(2)}, p = ${r.p.toFixed(3)}) : la répartition ne se distingue pas de l'uniforme. La lune plaide non coupable, ce qui est aussi une réponse.`}</p></section>`;
}
VIEWS.bilan = () => {
  const mode = bilanMode(), cur = periodOf(mode, bilanOffset), prev = periodOf(mode, bilanOffset + 1), s = S();
  const rows = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id) && TYPE_UI[s.modules[m.id].type].review).map(m => {
    const inst = s.modules[m.id], review = TYPE_UI[inst.type].review, r = review(inst, cur.from, cur.to), p = review(inst, prev.from, prev.to);
    return `<div class="over-wrap"><div class="over"><b>${esc(label(m.id))}</b><span>${esc(r || "—")}</span><em class="hint" style="margin:0">avant : ${esc(p || "—")}</em></div></div>`;
  }).join("");
  const tab = (m, l) => `<button class="btn sm ${mode === m ? "acc" : "ghost"}" data-act="bilan-mode" data-m="${m}">${l}</button>`;
  // Ce que les idées notées pendant la période revendiquent de savoir ; chaque statut mène à la recherche.
  const eps = epCounts(cur.from, cur.to), epLine = Object.keys(EP_STATUS).filter(k => eps[k]).map(k => `<button class="btn ghost sm" data-act="search-for" data-q="statut:${esc(EP_STATUS[k])}">${plural(eps[k], EP_STATUS[k])}</button>`).join("");
  return `<div class="row" style="margin-bottom:6px"><h2 style="margin:0">Bilan</h2><span class="spacer"></span>${tab("lune", "Cycle lunaire")}${tab("mois", "Mois")}</div>
  <div class="row" style="margin-bottom:18px"><button class="btn ghost" data-act="bilan-nav" data-d="1" aria-label="Période précédente">‹</button><b style="text-transform:none">${esc(cur.name)}</b>${bilanOffset ? `<button class="btn ghost" data-act="bilan-nav" data-d="-1" aria-label="Période suivante">›</button>` : ""}</div>
  <p class="hint">Ce qui s'est passé dans chaque module pendant la période, et, en face, la période d'avant. Aucune note, aucun trophée : les chiffres suffisent à culpabiliser.</p>
  <section>${rows || `<p class="empty">Aucun module à résumer.</p>`}</section>
  ${epLine ? `<section><h3>Statut des idées notées</h3><p class="hint">Ce qu'elles revendiquent de savoir. Une hypothèse n'est pas une faiblesse, c'est une dette à rembourser.</p><div class="row">${epLine}</div></section>` : ""}
  ${driftSection(mode, cur)}
  ${tensionSection()}
  ${lunarSection()}`;
};
/* ================= tensions =================
   Une tension (« contredit ») reste ouverte tant qu'aucune entrée ne dérive des deux à la fois. Ce n'est pas
   une période : une contradiction ne s'éteint pas avec le cycle lunaire. Les plus anciennes d'abord. */
function openTensions() {
  const items = thoughtItems(), parents = [];
  for (const it of items) { const ps = new Set((it.e.links || []).filter(l => l.type === "derive").map(l => l.to)); if (ps.size > 1) parents.push(ps); }
  const resolved = (a, b) => parents.some(ps => ps.has(a) && ps.has(b));
  const out = [];
  for (const it of items) for (const l of it.e.links || []) if (l.type === "contredit" && refFind(l.to) && !resolved(it.ref, l.to)) out.push({ a: it.ref, b: l.to, date: l.date || "" });
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
/* ================= sortes =================
   Un tirage dans son propre matériau : un fragment ou une note qu'on n'a pas retouché depuis longtemps, une
   tension ouverte, un motif en jachère. Pondéré par l'oubli : plus c'est ancien, plus ça a de chances de
   sortir. Rien n'est enregistré ; le dernier tirage vit dans une variable, oublié à la prochaine ouverture. */
const SORTES_MIN_DAYS = 14; // en dessous, ce n'est pas de l'oubli, c'est hier
let sortesLast = null;
function sortesPool() {
  const now = todayISO(), out = [];
  for (const [mod, m] of Object.entries(S().modules)) {
    if (!enabled(mod)) continue;
    // Accolades obligatoires sur chaque branche : un « if » nu dans un for (comme celui des notes) capturerait
    // sinon le « else if » suivant (dangling else), et la branche motifs ne s'exécuterait jamais.
    if (m.type === "cumul") { for (const f of m.scraps || []) { const last = f.editedAt || f.date; if (last) out.push({ kind: "fragment", mod, e: f, days: diffDays(now, last) }); } }
    else if (m.type === "notes") { for (const e of m.entries) if (e.date) out.push({ kind: "note", mod, e, days: diffDays(now, e.date) }); }
    else if (isConcordance(m)) { for (const r of concordance(m)) if (fallow(m, r)) out.push({ kind: "motif", mod, e: r.e, days: r.last ? diffDays(now, r.last.date) : 3650 }); }
  }
  for (const t of openTensions()) out.push({ kind: "tension", a: t.a, b: t.b, days: t.date ? diffDays(now, t.date) : SORTES_MIN_DAYS });
  return out.filter(x => x.days >= SORTES_MIN_DAYS);
}
/* Tirage pondéré : chaque candidat pèse son nombre de jours de silence, donc davantage de chances pour ce qui
   dort depuis longtemps, sans jamais exclure ce qui vient tout juste de passer le seuil. */
function sortesDraw() {
  const pool = sortesPool(); if (!pool.length) return null;
  let r = Math.random() * pool.reduce((a, x) => a + x.days, 0);
  for (const x of pool) { r -= x.days; if (r <= 0) return x; }
  return pool.at(-1);
}
function sortesCard(x) {
  if (x.kind === "tension") return `<div class="card"><span class="tag">Tension ouverte</span><p>${refHTML(x.a)} <span class="hint">contredit</span> ${refHTML(x.b)}</p><div class="row"><button class="btn ghost sm" data-act="tension-resolve" data-a="${esc(x.a)}" data-b="${esc(x.b)}">résoudre</button><button class="btn ghost sm" data-act="tension-dossier" data-a="${esc(x.a)}" data-b="${esc(x.b)}">dossier</button></div></div>`;
  if (x.kind === "motif") return `<div class="card"><span class="tag">Motif en jachère, ${esc(label(x.mod))}</span><p><b>${esc(x.e.title)}</b></p><div class="row"><a class="btn ghost sm" href="#${esc(x.mod)}">voir</a><button class="btn ghost sm" data-act="search-for" data-q="${esc(x.e.title)}">chercher</button></div></div>`;
  return `<div class="card"><span class="tag">${esc(label(x.mod))}, ${x.kind === "fragment" ? "fragment" : "note"} endormi</span><p style="white-space:pre-wrap">${esc(excerpt(x.e, 200))}</p><div class="meta"><span>${plural(x.days, "jour")} sans y toucher</span></div><div class="row"><a class="btn ghost sm" href="#${esc(x.mod)}">voir</a></div></div>`;
}
function sortesSection() {
  return `<section><h2>Tirer un sort</h2><p class="hint">Un fragment endormi, une note oubliée, une tension ouverte ou un motif en jachère — le hasard pondéré par l'oubli, dans ton seul matériau.</p>
    ${sortesLast ? sortesCard(sortesLast) : ""}
    <button class="btn ${sortesLast ? "ghost" : ""} sm" data-act="sortes-draw">${sortesLast ? "Retirer" : "Tirer"}</button></section>`;
}
function tensionSection() {
  const ts = openTensions();
  if (!ts.length) return "";
  return `<section><h3>Tensions ouvertes</h3><p class="hint">Deux entrées qui se contredisent, en attente d'une synthèse qui dérive des deux. Aucune urgence : certaines contradictions sont plus fécondes que leurs solutions.</p>
    <ul class="plain">${ts.map(t => `<li class="item"><span></span><div>${refHTML(t.a)} <span class="hint">contredit</span> ${refHTML(t.b)}${t.date ? `<div class="meta"><span>ouverte ${ago(t.date)}</span></div>` : ""}</div><div class="row"><button class="btn ghost sm" data-act="tension-resolve" data-a="${esc(t.a)}" data-b="${esc(t.b)}">résoudre</button><button class="btn ghost sm" data-act="tension-dossier" data-a="${esc(t.a)}" data-b="${esc(t.b)}">dossier</button></div></li>`).join("")}</ul></section>`;
}
/* ================= dérive lexicale =================
   Les mots propres à la période, comparés aux six précédentes (même découpage : cycles ou mois), dans tous
   les textes datés de tous les modules. Un mot compte une fois par texte (fréquence documentaire) : un texte
   qui répète « lune » dix fois ne fait pas une obsession. Rien n'est enregistré ; tout est recalculé. */
const DRIFT_REF = 6, DRIFT_MIN_TEXTS = 5;
// Mots vides (repliés, sans accents) : ceux qui ne disent rien du sujet. Les mots de moins de 3 lettres sont écartés d'office.
const STOPWORDS = new Set(("les des une est pas que qui quoi dont par pour sur sous dans avec sans entre vers chez mais donc car comme aussi alors ainsi " +
  "encore deja bien tres trop plus moins tout toute tous toutes rien cette ces cet son ses mon mes ton tes notre nos votre vos leur leurs " +
  "elle elles ils nous vous lui eux meme autre autres cela ceci celui celle ceux celles quand puis apres avant depuis pendant jusqu ici " +
  "etre avoir fait faire faut peut peux sont etait etaient ete suis sommes etes avons avez ont avait avaient sera seront serait aurait " +
  "chaque aucun aucune quelque quelques parce lorsque oui non fois jour jours aujourd hui demain hier chose choses the and for with this " +
  "that from are was have not but").split(" "));
/* Les mots d'un texte, sous leur forme repliée (clé) et telle qu'écrite (pour l'afficher), pluriel en s/x ramené au singulier. */
const driftCache = new Map();
function driftWords(text) {
  let out = driftCache.get(text);
  if (!out) {
    out = new Map();
    // Replié une seule fois (un fold par mot remplirait son cache de mots isolés et en chasserait les textes) ;
    // fold garde lettres et séparateurs à leur place, donc les deux découpages se correspondent mot pour mot.
    const sep = /[^\p{L}\p{N}]+/u, raws = String(text).toLowerCase().split(sep), keys = fold(text).split(sep);
    for (let i = 0; i < raws.length; i++) {
      const raw = raws[i];
      let k = keys.length === raws.length ? keys[i] : fold(raw);
      if (k.length < 3 || /\d/.test(k) || STOPWORDS.has(k)) continue;
      if (k.length > 4 && /[sx]$/.test(k)) k = k.slice(0, -1);
      if (!out.has(k)) out.set(k, raw);
    }
    if (driftCache.size >= 20000) driftCache.clear();
    driftCache.set(text, out);
  }
  return out;
}
function lexicalDrift(mode, offset) {
  const cur = periodOf(mode, offset), oldest = periodOf(mode, offset + DRIFT_REF);
  const now = new Map(), before = new Map(), shown = new Map(); let nNow = 0, nBefore = 0;
  for (const inst of Object.values(S().modules)) {
    const ui = TYPE_UI[inst.type];
    if (!ui || !ui.texts || isConcordance(inst)) continue;
    for (const t of ui.texts(inst)) {
      if (!t.date || t.date < oldest.from || t.date >= cur.to) continue;
      const inCur = t.date >= cur.from, bag = inCur ? now : before;
      if (inCur) nNow++; else nBefore++;
      for (const [k, raw] of driftWords(t.text)) { bag.set(k, (bag.get(k) || 0) + 1); if (!shown.has(k)) shown.set(k, raw); }
    }
  }
  // Émergent : présent dans au moins deux textes de la période, et bien plus fréquent qu'avant (rapport lissé,
  // pondéré par le nombre de textes : un mot vu deux fois ne pèse pas autant qu'un mot vu dix fois).
  const rate = (n, total) => (n + 0.5) / (total + 1);
  const rising = [...now].filter(([, n]) => n >= 2).map(([k, n]) => ({ k, n, before: before.get(k) || 0, score: n * Math.log(rate(n, nNow) / rate(before.get(k) || 0, nBefore)) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.k.localeCompare(b.k)).slice(0, 8);
  // En extinction : fréquent avant (au moins trois textes), absent de la période.
  const fading = [...before].filter(([k, n]) => n >= 3 && !now.has(k)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([k, n]) => ({ k, n }));
  return { enough: nNow >= DRIFT_MIN_TEXTS && nBefore >= DRIFT_MIN_TEXTS, nNow, nBefore, rising, fading, word: k => shown.get(k) };
}
function driftSection(mode, cur) {
  const d = memoInRender("drift", () => lexicalDrift(mode, bilanOffset)), motifs = Object.keys(S().modules).find(k => enabled(k) && isConcordance(S().modules[k]));
  const unit = mode === "mois" ? "mois" : "cycles";
  if (!d.enough) return `<section><h3>Vocabulaire</h3><p class="hint">Pas encore assez de textes datés pour parler de dérive : ${plural(d.nNow, "texte")} dans la période, ${plural(d.nBefore, "texte")} dans les six ${unit} d'avant (${DRIFT_MIN_TEXTS} de chaque côté au moins).</p></section>`;
  const known = motifs ? new Set(S().modules[motifs].entries.map(e => fold(e.title))) : new Set();
  const chip = (k, extra) => `<span class="chip"><button class="btn ghost sm" data-act="search-for" data-q="${esc(d.word(k))}">${esc(d.word(k))}${extra}</button>${motifs && !known.has(fold(d.word(k))) ? `<button class="btn ghost sm" data-act="motif-add" data-mod="${esc(motifs)}" data-q="${esc(d.word(k))}" title="En faire un motif" aria-label="En faire un motif">+</button>` : ""}</span>`;
  return `<section><h3>Vocabulaire</h3><p class="hint">Les mots propres à la période, comparés aux six ${unit} d'avant (${plural(d.nNow, "texte")} contre ${d.nBefore}). Une piste, pas un diagnostic : deux occurrences ne font pas une obsession.${motifs ? " « + » en fait un motif." : ""}</p>
    ${d.rising.length ? `<p class="hint" style="margin:0 0 4px">Émergent</p><div class="row">${d.rising.map(x => chip(x.k, ` · ${x.n}${x.before ? ` (avant ${x.before})` : ""}`)).join("")}</div>` : `<p class="empty">Aucun mot ne se détache. Constance, ou routine.</p>`}
    ${d.fading.length ? `<p class="hint" style="margin:12px 0 4px">Absent cette fois, fréquent avant</p><div class="row">${d.fading.map(x => chip(x.k, ` · ${x.n} avant`)).join("")}</div>` : ""}</section>`;
}
function epCounts(from, to) {
  const out = {};
  for (const inst of Object.values(S().modules)) { const ui = TYPE_UI[inst.type]; if (ui && ui.texts) for (const t of ui.texts(inst)) if (t.ep && t.date && t.date >= from && t.date < to) out[t.ep] = (out[t.ep] || 0) + 1; }
  return out;
}

/* ================= recherche =================
   Dans tous les textes de tous les modules (chaque type dit lesquels : TYPE_UI[type].texts), sans tenir
   compte des accents ni de la casse ; tous les mots doivent apparaître. */
let searchQuery = "";
// Chaque caractère devient sa forme sans accent et en minuscule, de même longueur exactement (sinon il reste tel
// quel : emoji sur deux unités, « İ » qui devient deux lettres) : les positions restent alignées pour surligner.
// Fonction pure et appelée sur tout l'historique à chaque recherche ou concordance : ses résultats sont gardés
// (jamais périmés, puisque la même entrée donne toujours la même sortie), dans une limite de taille.
const foldCache = new Map();
const fold = s => {
  s = String(s);
  let f = foldCache.get(s);
  if (f === undefined) {
    f = [...s].map(ch => { const b = ch.normalize("NFD")[0].toLowerCase(); return b.length === ch.length ? b : ch; }).join("");
    if (foldCache.size >= 20000) foldCache.clear();
    foldCache.set(s, f);
  }
  return f;
};
/* « statut:hypothèse » (ou « statut:hyp ») ne garde que ce qui porte ce statut ; seul, il les liste tous.
   Un statut inconnu ou vide ne trouve rien, plutôt que d'être ignoré en silence. */
const epQuery = w => { const q = w.slice("statut:".length); return (q && Object.keys(EP_STATUS).find(k => fold(EP_STATUS[k]).startsWith(q))) || null; };
function searchAll(q) {
  const words = fold(q).split(/\s+/).filter(Boolean), st = words.find(w => w.startsWith("statut:")), want = st ? epQuery(st) : null;
  const terms = words.filter(w => !w.startsWith("statut:")), out = [];
  if ((st && !want) || (!terms.length && !want)) return out;
  for (const m of S().config.modules) {
    const inst = Object.hasOwn(S().modules, m.id) ? S().modules[m.id] : null, ui = inst && TYPE_UI[inst.type];
    if (!ui || !ui.texts) continue;
    for (const t of ui.texts(inst)) { const f = fold(t.text); if ((!want || t.ep === want) && terms.every(w => f.includes(w))) out.push({ id: m.id, ...t }); }
  }
  return out;
}
function highlight(text, q) {
  const f = fold(text), marks = [];
  for (const w of fold(q).split(/\s+/).filter(w => w && !w.startsWith("statut:"))) { let i = f.indexOf(w); while (i >= 0) { marks.push([i, i + w.length]); i = f.indexOf(w, i + w.length); } }
  marks.sort((a, b) => a[0] - b[0]);
  let html = "", pos = 0;
  for (const [a, b] of marks) { if (a < pos) continue; html += esc(text.slice(pos, a)) + `<mark>${esc(text.slice(a, b))}</mark>`; pos = b; }
  return html + esc(text.slice(pos));
}
VIEWS.recherche = () => {
  const hits = searchAll(searchQuery);
  return `<h2>Chercher</h2><p class="hint">Dans tous tes modules : notes, fragments, tâches, légendes, journaux. Les accents ne comptent pas. « statut:hypothèse » ne garde que les hypothèses (de même pour observé, interprétation, inexpliqué). Touche « / » pour venir ici.</p>
  <input id="searchIn" type="search" value="${esc(searchQuery)}" placeholder="Un mot, un bout de phrase…" aria-label="Chercher" autocomplete="off" style="max-width:520px">
  ${searchQuery.trim() ? `<div class="row" style="margin-top:12px"><p class="hint" style="margin:0">${hits.length ? plural(hits.length, "résultat") : "Rien. Soit ça n'existe pas, soit tu l'as pensé sans l'écrire."}</p>${hits.length ? `<span class="spacer"></span><button class="btn ghost sm" data-act="search-dossier" title="Tous les résultats, avec dates, statuts, provenance et liens, pour une lecture assistée">Exporter en dossier</button>` : ""}</div>
  <ul class="plain">${hits.slice(0, 80).map(h => `<li class="item"><span></span><div>${highlight(h.text.length > 240 ? h.text.slice(0, 240) + "…" : h.text, searchQuery)}<div class="meta"><span class="tag">${esc(label(h.id))}</span>${h.date ? `<span>${fmt(h.date)}</span>` : ""}${h.ep ? `<span>${esc(EP_STATUS[h.ep])}</span>` : ""}</div></div><a class="btn ghost sm" href="#${esc(h.id)}">ouvrir</a></li>`).join("")}</ul>` : ""}`;
};
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
      <div class="field-row" style="margin-top:10px"><label>Modèle ou type<select id="newModType"><optgroup label="Modèles">${MODULE_TEMPLATES.map(t => `<option value="tpl:${esc(t.id)}">${esc(t.name)} — ${esc(t.hint)}</option>`).join("")}</optgroup><optgroup label="Types vides">${Object.entries(MODULE_TYPES).map(([k, t]) => `<option value="${esc(k)}">${esc(t.label)}</option>`).join("")}</optgroup></select></label>
      <label>Nom<input id="newModName" placeholder="Nom du modèle si vide"></label></div>
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
/* Brouillons : le texte en cours d'un champ libre survit à la fermeture de l'app (iOS tue volontiers une PWA
   en arrière-plan). Propres à l'appareil ; effacés quand le champ est envoyé, et à la déconnexion. */
const DRAFT_PREFIX = "selene-draft:";
const draftKey = (view, el) => `${DRAFT_PREFIX}${view}:${el.id}`;
function saveDraft(view, el) { if (!view || !el.id) return; try { if (el.value.trim()) localStorage.setItem(draftKey(view, el), el.value); else localStorage.removeItem(draftKey(view, el)); } catch {} }
function loadDraft(view, el) { try { return localStorage.getItem(draftKey(view, el)) || ""; } catch { return ""; } }
document.addEventListener("input", e => { if (e.target.dataset && e.target.dataset.draft !== undefined) saveDraft(lastView, e.target); });
/* Calculs coûteux partagés par plusieurs parties d'un même rendu (la concordance sert la vue, l'accueil et
   le bilan) : gardés le temps d'un rendu seulement, pendant lequel les données ne bougent pas. */
let renderMemo = null;
function memoInRender(key, compute) {
  if (!renderMemo) return compute();
  if (!renderMemo.has(key)) renderMemo.set(key, compute());
  return renderMemo.get(key);
}
function render() {
  renderMemo = new Map();
  try { renderNow(); } finally { renderMemo = null; }
}
function renderNow() {
  applyTheme();
  if (hosted() && authReady() && !authSession) { $("#nav").innerHTML = ""; $("#main").innerHTML = authView(); return; }
  const s = S(), m = moon();
  let view = location.hash.slice(1) || "accueil";
  // Les vues fixes priment toujours ; hasOwn évite qu'un « #constructor » trouve Object.prototype.
  const fixed = v => v === "accueil" || v === "reglages" || v === "recherche" || v === "bilan";
  if (!fixed(view) && (!(Object.hasOwn(s.modules, view) || Object.hasOwn(VIEWS, view)) || !enabled(view))) view = "accueil";
  const inst = !fixed(view) && Object.hasOwn(s.modules, view) ? s.modules[view] : null;
  $("#brandName").textContent = s.config.name || "Selene";
  document.title = s.config.name || "Selene";
  $("#miniMoon").innerHTML = moonSVG(m.p, 40);
  $("#dateline").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + ", " + m.name.toLowerCase();
  const badge = id => { const m = Object.hasOwn(s.modules, id) && s.modules[id], n = m && TYPE_UI[m.type].badge ? TYPE_UI[m.type].badge(m) : 0; return n ? ` (${n})` : ""; };
  const links = [["accueil", "Accueil"], ...s.config.modules.filter(x => x.on).map(x => [x.id, label(x.id)]), ["recherche", "Chercher"], ["reglages", "Réglages"]];
  $("#nav").innerHTML = links.map(([id, l]) => `<a href="#${esc(id)}" class="${id === view ? "on" : ""}"${id === view ? ' aria-current="page"' : ""}>${esc(l)}${badge(id)}</a>`).join("");
  // Les champs des Réglages n'ont pas d'id (donc pas de restauration ci-dessous) : tant que l'un d'eux
  // a le focus, ne pas redessiner, sinon une synchro arrivant pendant la frappe effacerait la saisie.
  const ae = document.activeElement, typing = ae && ae.closest && ae.closest("#main") &&
    (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !["checkbox", "radio", "file", "button"].includes(ae.type)));
  if (typing && view === "reglages" && lastView === "reglages") return;
  const keep = {}; let focusId = null, caret = null;
  $("#main").querySelectorAll("[data-draft]").forEach(el => saveDraft(lastView, el)); // un champ vidé par l'envoi efface son brouillon
  if (view === lastView) $("#main").querySelectorAll("input[id],textarea[id],select[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
  if (document.activeElement && document.activeElement.id && keep[document.activeElement.id] != null) { focusId = document.activeElement.id; try { caret = document.activeElement.selectionStart; } catch {} }
  $("#main").innerHTML = inst ? bridgeBar(view, inst) + TYPE_UI[inst.type].view(view) : VIEWS[view]();
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && v !== "" && el.value !== v) el.value = v; }
  if (view !== lastView) $("#main").querySelectorAll("[data-draft]").forEach(el => { const v = loadDraft(view, el); if (v) el.value = v; });
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch {} } }
  if (view !== lastView) revealed = null;
  if (revealed) $("#main").querySelectorAll(".item[data-id], .card[data-id]").forEach(el => { if (el.dataset.id === revealed) el.classList.add("reveal"); });
  lastView = view;
}
/* Position de défilement de chaque vue, pour la session : revenir quelque part, c'est retrouver où l'on en était. */
const scrollMemo = (() => { try { return JSON.parse(sessionStorage.getItem("selene-scrolls")) || {}; } catch { return {}; } })();
function rememberScroll() {
  if (!lastView) return;
  scrollMemo[lastView] = Math.round(window.scrollY || 0);
  try { sessionStorage.setItem("selene-scrolls", JSON.stringify(scrollMemo)); } catch {}
}
window.addEventListener("hashchange", () => {
  if (lastView !== (location.hash.slice(1) || "accueil")) rememberScroll(); // « / » a déjà dessiné la recherche, et gardé la position d'avant
  openId = null; bridgeOpen = null; for (const k of Object.keys(pageSize)) delete pageSize[k]; render();
  const t = sessionStorage.getItem("selene-scroll"); sessionStorage.removeItem("selene-scroll"); const el = t && document.getElementById(t);
  if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView(); } else window.scrollTo(0, scrollMemo[lastView] || 0);
});
/* Sur un écran tactile, les actions d'une ligne (.ra) apparaissent quand on touche la ligne ailleurs que sur un contrôle.
   Une seule ligne à la fois ; retenue par son identifiant pour survivre aux rendus. */
let revealed = null;
const touchUI = () => { try { return window.matchMedia("(hover: none), (pointer: coarse)").matches; } catch { return false; } };
document.addEventListener("click", e => {
  const row = e.target.closest && e.target.closest(".item[data-id], .card[data-id]");
  if (!row || !row.querySelector(".ra") || e.target.closest("a,button,input,select,textarea,label,summary") || !touchUI()) return;
  revealed = revealed === row.dataset.id ? null : row.dataset.id;
  $("#main").querySelectorAll(".reveal").forEach(el => el.classList.remove("reveal"));
  if (revealed) row.classList.add("reveal");
});

/* ================= actions ================= */
const idOf = el => el.closest("[data-id]")?.dataset.id;
function capture() {
  const inp = $("#capIn"); if (!inp || !inp.value.trim()) return;
  const id = inboxId(S().modules); if (!id) return toast("Aucune boîte de réception : voir Réglages.");
  const item = addNote(S().modules[id], inp.value); site.save(); inp.value = ""; render();
  afterCapture(id, item, "Gardé. Tu peux oublier, c'est écrit.");
}
function entryAdd(id) {
  const inst = S().modules[id], ui = TYPE_UI[inst.type];
  if (ui.add) ui.add(id, inst);
}
const CLICK = {
  "grp-filter": el => { const m = el.dataset.mod, g = el.dataset.g; gFilter[m] = gFilter[m] === g ? "" : g; render(); },
  "goto-groups": el => { const id = "mreg-" + el.dataset.mod; if (location.hash === "#reglages") { const d = document.getElementById(id); if (d) { d.open = true; d.scrollIntoView(); } } else sessionStorage.setItem("selene-scroll", id); },
  "cap-add": capture,
  "bridge-edit": el => { bridgeOpen = el.dataset.mod; render(); const i = $("#bridgeIn"); if (i) i.focus(); },
  "bridge-save": el => bridgeSave(el.dataset.mod),
  "bridge-close": () => { bridgeOpen = null; render(); },
  "bridge-done": el => {
    const id = el.dataset.mod, inst = S().modules[id], old = inst.resume; if (!old) return;
    setResume(inst, "", todayISO()); site.save(); render();
    toastUndo("Repris. Le pont est levé.", () => {
      const cur = S().modules[id]; if (!cur || cur.resume) return;
      cur.resume = old; cur.resumeLog = (cur.resumeLog || []).slice(0, -1); site.save(); render();
    });
  },
  "motif-add": el => {
    const inst = S().modules[el.dataset.mod], word = el.dataset.q; if (!inst || !word) return;
    if (inst.entries.some(e => fold(e.title) === fold(word))) return toast(`« ${word} » est déjà un motif.`);
    saveCollectionItem(inst, { title: word }, uid()); site.save(); render();
    toast(`« ${word} » devient un motif de ${label(el.dataset.mod)}. On verra s'il revient.`);
  },
  // Tous les résultats (pas seulement les 80 affichés), dans l'ordre du temps ; un fragment ou une note garde ses
  // statut, provenance et liens (retrouvés par module et texte : la recherche ne renvoie que des textes).
  "search-dossier": () => {
    const q = searchQuery.trim(), thoughts = thoughtItems();
    const items = searchAll(q).map(h => ({ mod: h.id, text: h.text, date: h.date, e: (thoughts.find(x => x.mod === h.id && x.e.text === h.text) || {}).e }))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (items.length) dossierFile(`Recherche — ${q}`, `Résultats de la recherche « ${q} »`, items);
  },
  "page-more": el => { const k = el.dataset.k; pageSize[k] = (pageSize[k] || PAGE) + PAGE; render(); },
  "sortes-draw": () => { sortesLast = sortesDraw(); render(); if (!sortesLast) toast("Rien d'assez ancien à tirer. Reviens dans deux semaines."); },
  "search-for": el => { searchQuery = el.dataset.q; if (location.hash === "#recherche") render(); else location.hash = "recherche"; },
  "entry-add": el => entryAdd(el.dataset.mod),
  "entry-del": el => removeWithUndo(el.dataset.mod, "entries", idOf(el)),
  "bilan-mode": el => { try { localStorage.setItem("selene-bilan", el.dataset.m); } catch {} bilanOffset = 0; render(); },
  "bilan-nav": el => { bilanOffset = Math.max(0, bilanOffset + +el.dataset.d); render(); },
  "undo": () => { const f = undoFn; undoFn = null; $("#toast").classList.remove("show", "act"); if (f) f(); },
  "mod-add": () => {
    const choice = $("#newModType").value, tpl = MODULE_TEMPLATES.find(t => "tpl:" + t.id === choice);
    const name = $("#newModName").value.trim() || (tpl ? tpl.name : "");
    if (!name) return toast("Donne un nom au module.");
    addModule(tpl || { type: choice }, name);
  },
  "tpl-add": el => { const tpl = MODULE_TEMPLATES.find(t => t.id === el.dataset.tpl); if (tpl) addModule(tpl, tpl.name); },
  "welcome-done": () => { S().config.welcome = false; site.save(); render(); },
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
  "exp": () => downloadFile(`selene-${todayISO()}.json`, createBackup(board.data, site.data), "application/json", "Sauvegarde Selene"),
  "pal": el => { S().config.palette = el.dataset.p; site.save(); render(); },
  "mod-up": el => moveMod(el, -1), "mod-down": el => moveMod(el, 1),
  "auth-switch": () => { authMode = authMode === "signup" ? "signin" : "signup"; render(); },
  "auth-out": () => authSignOut()
};
/* Donne un fichier à l'utilisatrice : via claude.ai, le partage natif (téléphone) ou un téléchargement. */
async function downloadFile(filename, data, type, title) {
  if (downloadsNS) { try { await downloadsNS.save({ filename, data }); } catch (e) { toast("Export annulé."); } return; }
  try { const file = new File([data], filename, { type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
/* Ajoute un module (depuis un modèle ou un type vide), actif et partagé avec l'assistant. */
function addModule(tpl, name) {
  try {
    const s = S(), id = slugId(name, [...s.config.modules.map(x => x.id), ...Object.keys(s.modules), ...Object.keys(VIEWS)]);
    createFromTemplate(s.modules, tpl, name, id);
    s.config.modules.push({ id, on: true });
    s.config.assistant.share[id] = true;
    site.save(); render(); toast(`Module « ${name} » créé.`);
  } catch (e) { toast(e.message); }
}
function moveMod(el, d) { const ms = S().config.modules, i = +el.closest("[data-i]").dataset.i, j = i + d; if (j < 0 || j >= ms.length) return; [ms[i], ms[j]] = [ms[j], ms[i]]; site.save(); render(); }
document.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (a && CLICK[a.dataset.act] && a.tagName !== "SELECT" && !(a.tagName === "INPUT" && a.type !== "button")) CLICK[a.dataset.act](a); });
document.addEventListener("input", e => { if (e.target.id === "searchIn") { searchQuery = e.target.value; render(); } });
// « / » ouvre la recherche (sur ordinateur), sauf pendant une saisie.
document.addEventListener("keydown", e => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "")) return;
  // Dessiner tout de suite : attendre l'événement hashchange ferait courir le curseur contre le rendu.
  e.preventDefault(); rememberScroll(); location.hash = "recherche"; render(); const el = document.getElementById("searchIn"); if (el) el.focus();
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "capIn") capture(); if (e.key === "Enter" && e.target.id === "noteIn") CLICK["note-add"](e.target); if (e.key === "Enter" && e.target.id === "bridgeIn") bridgeSave(e.target.dataset.mod); if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatIn") { e.preventDefault(); sendChat(e.target.value); } });
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
    // Un nombre reste dans les bornes du champ, qui sont celles de la validation des sauvegardes :
    // sinon l'app accepterait une valeur que sa propre sauvegarde refuserait ensuite à l'import.
    let v = el.value; if (el.type === "number") v = Math.min(el.max ? +el.max : Infinity, Math.max(1, +v || 1)); if (el.type === "date") v = v || null;
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
/* Au bout des quinze minutes, le module ouvert peut proposer une suite (noter la séance, le nouveau total). */
function timerDone() {
  const view = location.hash.slice(1), inst = Object.hasOwn(S().modules, view) ? S().modules[view] : null, hook = inst && TYPE_UI[inst.type].timerDone;
  if (inst) { bridgeOpen = view; render(); } // et le prochain geste, pendant qu'on s'en souvient
  if (!(hook && hook(view, inst, 15))) toast("Quinze minutes. Tu as le droit d'arrêter. Et celui de continuer.");
}
let left = 900, tick = null, endAt = 0;
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
function tickTimer() {
  left = Math.max(0, Math.round((endAt - Date.now()) / 1000)); $("#clock").textContent = mmss(left);
  if (left <= 0) { clearInterval(tick); tick = null; $("#clock").classList.add("done"); $("#timerBtn").textContent = "Relancer"; timerDone(); try { navigator.vibrate && navigator.vibrate(200); } catch {} }
}
$("#timerBtn").addEventListener("click", () => {
  const b = $("#timerBtn");
  if (tick) { clearInterval(tick); tick = null; b.textContent = "Reprendre"; return; }
  if (left === 0) left = 900; endAt = Date.now() + left * 1000; $("#clock").classList.remove("done"); b.textContent = "Pause";
  tick = setInterval(tickTimer, 500);
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && tick) tickTimer(); });
$("#timerReset").addEventListener("click", () => { clearInterval(tick); tick = null; left = 900; $("#clock").textContent = mmss(left); $("#clock").classList.remove("done"); $("#timerBtn").textContent = "Lancer 15 min"; });

