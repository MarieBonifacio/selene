/* ================= registre des types de module : la partie interface =================
   Un type = une entrée dans MODULE_TYPES (domain.js : défauts, forme des entrées, validation)
   + une entrée ici. Rien d'autre à toucher : le rendu, l'accueil, les réglages, l'assistant et
   les actions passent tous par ces deux registres.
     view(id)              écran du module
     settings(id, inst)    champs du bloc « Réglages par module »
     summary(id, inst)     ligne de l'accueil « Où en sont les choses » (HTML)
     alerts(id, inst, now) rappels du bloc « Aujourd'hui » : [{ text (HTML), href? , quick? }]
     context(inst, name)   paragraphe envoyé à l'assistant (texte brut)
     add(id, inst)         bouton « noter / ajouter » (data-act="entry-add")
     accept(id, inst, note) recevoir une note triée depuis un module Notes ; canAccept(inst) pour conditionner
     badge(inst)           nombre affiché à côté du nom dans la navigation
     recent(inst)          derniers éléments, en texte (lignes dépliables de l'accueil)
     texts(inst)           textes parcourus par la recherche : [{ text, date?, ep?, eid? }] (eid : l'entrée, pour y mener)
     timerDone(id, inst)   suite proposée à la fin du minuteur quand ce module est ouvert
     review(inst, from, to) une ligne de bilan pour la période [from, to[ (dates ISO), ou null
     click / change        actions propres au type, fusionnées dans CLICK / CHANGE */

const lastOf = (inst, type) => inst.entries.filter(x => x.type === type).map(x => x.date).sort().pop();
const totalOf = inst => inst.entries.reduce((a, x) => a + (+x.value || 0), 0);
const instOf = el => S().modules[el.dataset.mod];
const lastValue = inst => { const e = [...inst.entries].sort((a, b) => a.date.localeCompare(b.date)).reverse().find(x => x.value != null); return e ? e.value : null; };
const recentBy = (list, n = 3) => [...list].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, n);
const within = (list, from, to, key = "date") => list.filter(x => x[key] && x[key] >= from && x[key] < to);
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
/* D'où vient une entrée rangée depuis une boîte : le lieu et la date, et le texte d'origine s'il a changé. */
function originHTML(e, current) {
  const o = e.origin; if (!o) return "";
  const same = String(current ?? "").trim() === o.text.trim(), short = o.text.length > 90 ? o.text.slice(0, 90) + "…" : o.text;
  return `<span class="origin" title="${esc(o.text)}">↳ de ${esc(o.from)}${o.date ? `, ${fmt(o.date)}` : ""}${same ? "" : ` : « ${esc(short)} »`}</span>`;
}
/* ---- liaisons entre fragments et notes (ce qui se pense : fragments d'un cumul, notes) ---- */
function thoughtItems() {
  const out = [];
  for (const [mod, m] of Object.entries(S().modules)) {
    const list = m.type === "notes" ? m.entries : m.type === "cumul" ? m.scraps || [] : null;
    if (list) for (const e of list) out.push({ ref: `${mod}/${e.id}`, mod, e });
  }
  return out;
}
/* « module/id » → l'entrée, par un index des entrées du module construit une fois par rendu (une liste de
   fragments liés ferait sinon autant de parcours complets que de liens). */
function refFind(ref) {
  const [mod, id] = String(ref).split("/"), m = Object.hasOwn(S().modules, mod) ? S().modules[mod] : null;
  if (!m) return null;
  const e = memoInRender("refs:" + mod, () => new Map([...m.entries, ...(m.scraps || [])].map(x => [x.id, x]))).get(id);
  return e ? { mod, e } : null;
}
const excerpt = (e, n = 60) => { const t = String(e.text || e.title || e.note || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
/* Liens entrants : pour chaque entrée, qui la vise et comment. Calculé une fois par rendu. */
const backlinks = () => memoInRender("backlinks", () => {
  const by = new Map();
  for (const it of [...thoughtItems(), ...sourceItems()]) for (const l of it.e.links || []) { if (!by.has(l.to)) by.set(l.to, []); by.get(l.to).push({ from: it.ref, type: l.type }); }
  return by;
});
/* Les Sources (éléments des collections de sources) : elles ne pensent pas, elles documentent. Leurs liens partent
   vers les notes et fragments qu'elles appuient (« documente »), et reviennent en marge de ceux-ci (« documenté par »). */
function sourceItems() {
  const out = [];
  for (const [mod, m] of Object.entries(S().modules)) if (m.type === "collection" && m.config.sources && enabled(mod)) for (const e of m.entries) out.push({ ref: `${mod}/${e.id}`, mod, e });
  return out;
}
const LINK_BACK = { derive: "a donné", contredit: "contredit par", echo: "écho de", documente: "documenté par" };
function refHTML(ref) {
  const hit = refFind(ref);
  return hit ? `<a href="#${esc(hit.mod)}/${esc(hit.e.id)}">« ${esc(excerpt(hit.e))} »</a>` : `<i>(supprimé)</i>`;
}
/* Sur la ligne du statut : « fiche », « dériver » et « lier… » (les liens eux-mêmes sont dans la marge, margHTML). */
function linksHTML(mod) {
  return `<span class="acts ra"><button class="btn ghost sm" data-act="specimen" data-mod="${esc(mod)}">fiche</button><button class="btn ghost sm" data-act="derive-start" data-mod="${esc(mod)}">dériver</button><button class="btn ghost sm" data-act="link-form" data-mod="${esc(mod)}">lier…</button></span>`;
}
/* Les marginalia : ce qui accompagne une pensée sans en être (retouche, provenance, liens sortants et entrants,
   motifs présents), dans un <aside> rendu une seule fois. Le CSS seul le place : dans la marge droite, face au texte,
   sur un grand écran (notes latérales à la Tufte) ; sous le texte ailleurs. Rendu même vide, pour que la colonne de
   texte garde la même largeur d'une ligne à l'autre. */
function margHTML(mod, e, text) {
  const out = (e.links || []).map(l => `<span>${esc(LINK_TYPES[l.type])} ${refHTML(l.to)}</span>`);
  const inc = (backlinks().get(`${mod}/${e.id}`) || []).map(b => `<span>${esc(LINK_BACK[b.type])} ${refHTML(b.from)}</span>`);
  const motifs = motifsOf(text);
  const parts = [e.editedAt ? `<span class="hint">modifié ${ago(e.editedAt)}</span>` : "", originHTML(e, text),
    out.length || inc.length ? `<span class="links">${[...out, ...inc].join("")}</span>` : "",
    motifs.length ? `<span class="m-motifs"><span class="m-lab">motifs</span>${motifs.map(m => `<button type="button" data-act="search-for" data-q="${esc(m.e.title)}">${esc(m.e.title)}</button>`).join("")}</span>` : ""];
  return `<aside class="marg" aria-label="En marge">${parts.join("")}</aside>`;
}
/* Dérivation en cours, par module : la prochaine entrée écrite dérivera de ces références (une, ou deux pour
   résoudre une tension). Propre à l'appareil, oubliée si l'on quitte l'app. */
const deriveFrom = {};
function deriveBanner(mod) {
  const refs = deriveFrom[mod]; if (!refs || !refs.length) return "";
  return `<div class="derive">${refs.length > 1 ? "Synthèse de" : "Dérivé de"} ${refs.map(refHTML).join(" et ")} <button class="btn ghost sm" data-act="derive-cancel" data-mod="${esc(mod)}">annuler</button></div>`;
}
function applyDerive(mod, item) {
  for (const ref of deriveFrom[mod] || []) if (ref !== `${mod}/${item.id}`) addLink(item, ref, "derive", uid(), todayISO());
  const n = (deriveFrom[mod] || []).length; delete deriveFrom[mod];
  return n;
}
function linkForm(mod, id) {
  const self = `${mod}/${id}`, choices = thoughtItems().filter(x => x.ref !== self).sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).slice(0, 300);
  if (!choices.length) return toast("Rien d'autre à quoi le lier. Une pensée seule ne se contredit pas encore.");
  openForm("Lier à une autre entrée", [
    { n: "type", l: "Cette entrée…", t: "select", o: Object.entries(LINK_TYPES) },
    { n: "to", l: "…quelle autre", t: "select", o: choices.map(x => [x.ref, `${label(x.mod)} · ${x.e.date ? fmt(x.e.date) + " · " : ""}${excerpt(x.e, 70)}`]) }
  ], { type: "echo" }, v => {
    const hit = refFind(self); if (!hit) return toast("Cette entrée a disparu entre-temps.");
    if (!addLink(hit.e, v.to, v.type, uid(), todayISO())) return toast("Déjà lié ainsi.");
    site.save(); render(); toast(v.type === "contredit" ? "Tension ouverte. Elle attendra sa synthèse." : "Lié.");
  });
}
/* ---- dossier de passation : un périmètre exporté en Markdown pour être relu ailleurs (NotebookLM, Claude,
   Obsidian). Chaque entrée garde sa date, son module, son statut, sa provenance ; ses liens deviennent des renvois
   numérotés quand leur cible est dans le dossier. Le préambule dit comment lire les statuts, pour qu'un modèle ne
   traite pas une hypothèse comme un fait. items : [{ mod, text, date?, e? }] (e : l'entrée, si on la connaît). */
const yamlStr = v => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
function dossierMarkdown(title, scope, items) {
  const num = new Map(items.map((it, i) => [it.e ? `${it.mod}/${it.e.id}` : "", i + 1]).filter(([k]) => k));
  const refText = ref => { if (num.has(ref)) return `[${num.get(ref)}]`; const hit = refFind(ref); return hit ? `« ${excerpt(hit.e, 80)} » (hors dossier)` : "(supprimé)"; };
  const head = ["---", `titre: ${yamlStr(title)}`, `source: "Selene"`, `exporte_le: "${todayISO()}"`, `perimetre: ${yamlStr(scope)}`, `entrees: ${items.length}`, "---", "", `# ${title}`, "",
    "> Chaque entrée porte sa date, son module et, s'il est indiqué, son statut épistémique : *observé* (ce qui s'est présenté), " +
    "*hypothèse* (une conjecture à tester), *interprétation* (une lecture, un cadre appliqué), *inexpliqué* (laissé ouvert à dessein). " +
    "Ne pas traiter une hypothèse comme un fait, ni combler un inexpliqué. Les renvois [n] désignent les entrées de ce dossier.", ""];
  const body = items.map((it, i) => {
    const e = it.e || {}, meta = [it.date ? fmt(it.date, { day: "numeric", month: "long", year: "numeric" }) : "", label(it.mod), e.ep ? EP_STATUS[e.ep] : ""].filter(Boolean).join(" · ");
    const lines = [`## ${i + 1}. ${meta}`, "", String(it.text).trim(), ""];
    if (e.origin && e.origin.text.trim() !== String(it.text).trim()) lines.push(`*Provenance : ${e.origin.from}${e.origin.date ? `, ${fmt(e.origin.date, { day: "numeric", month: "long", year: "numeric" })}` : ""} : « ${e.origin.text.trim()} »*`, "");
    if ((e.links || []).length) lines.push(`*Liens : ${e.links.map(l => `${LINK_TYPES[l.type]} ${refText(l.to)}`).join(" ; ")}*`, "");
    return lines.join("\n");
  });
  return [...head, ...body].join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
const dossierFile = (title, scope, items) => downloadFile(`dossier-${slugId(title, [])}-${todayISO()}.md`, dossierMarkdown(title, scope, items), "text/markdown", title);
/* Le statut épistémique d'un fragment ou d'une note, modifiable sur place ; vide par défaut. Vide, c'est une action
   (discrète, comme les autres actions de ligne) ; posé, c'est une information, toujours visible. */
const epSelect = (id, e) => `<select class="ep ${e.ep ? "on" : "ra"}" data-act="ep-set" data-mod="${esc(id)}" aria-label="Statut">${[["", "statut…"], ...Object.entries(EP_STATUS)].map(([k, l]) => `<option value="${k}" ${(e.ep || "") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
/* Fin estimée d'un cumul au rythme des 30 derniers jours : une phrase, ou rien sans objectif. */
function projection(inst) {
  const c = inst.config, goal = +c.goal || 0, tot = totalOf(inst);
  if (!goal) return "";
  if (tot >= goal) return "Objectif atteint. Le reste relève de l'orgueil, ou de la réécriture.";
  const recent = inst.entries.filter(x => x.date >= addDaysTo(todayISO(), -29)).reduce((a, x) => a + (+x.value || 0), 0);
  if (recent <= 0) return "Pas assez d'élan ces 30 derniers jours pour prédire une fin. La prophétie attendra.";
  const perDay = recent / 30, end = addDaysTo(todayISO(), Math.ceil((goal - tot) / perDay));
  return `Au rythme des 30 derniers jours (${Math.round(perDay).toLocaleString("fr-FR")} ${c.unitLabel} par jour), objectif atteint vers le ${fmt(end, { day: "numeric", month: "long", year: "numeric" })}.`;
}

function programmeGroupPanel(id) {
  const inst = S().modules[id], c = inst.config, now = todayISO();
  const days = new Set(inst.entries.map(x => x.date)), cur = Math.min(52, +c.weeks || 12, Math.floor(diffDays(now, c.start) / 7) + 1), out = [];
  for (let w = 0; w < cur; w++) { let n = 0; for (let d = 0; d < 7; d++) if (days.has(addDaysTo(c.start, w * 7 + d))) n++; const den = +c.perWeek || 1; out.push({ name: `Semaine ${w + 1}`, pct: Math.min(100, Math.round(100 * n / den)), sub: `${n} sur ${den} séances` }); }
  return `<section><h3 style="margin:0 0 4px">Par semaine</h3><p class="hint">Objectif : ${esc(c.perWeek)} séances par semaine, réglable dans Réglages.</p>
    <div class="rooms">${out.map(g => `<div class="room ${g.pct > 100 ? "over" : ""}"><div class="fill" style="width:${Math.min(100, g.pct)}%"></div><small>${esc(g.name)}</small><b>${g.pct} %</b><small>${esc(g.sub)}</small></div>`).join("") || `<p class="empty">Rien à regrouper pour l'instant.</p>`}</div></section>`;
}
const fragFilter = {}; // filtre des fragments par chapitre, par module (propre à l'appareil)
/* Palimpseste : les versions antérieures d'un fragment, repliables, la plus récente d'abord. */
function versionsHTML(f) {
  const n = (f.versions || []).length; if (!n) return "";
  return `<details class="versions"><summary class="hint" style="cursor:pointer;margin:4px 0">${n} version${n > 1 ? "s" : ""} antérieure${n > 1 ? "s" : ""}</summary>${[...f.versions].reverse().map(v => `<p class="note" style="white-space:pre-wrap">${fmt(v.at)} : ${esc(v.text)}</p>`).join("")}</details>`;
}
/* Les fragments d'un cumul, rangés sous leurs chapitres, en Markdown : pour les reprendre dans un outil d'écriture. */
function scrapsMarkdown(id, inst) {
  const c = inst.config, block = list => list.map(f => f.text.trim()).join("\n\n");
  const parts = [`# ${label(id)}`, c.title ? `*${c.title}*` : ""];
  for (const cat of c.categories) { const fs = inst.scraps.filter(f => f.category === cat.id); if (fs.length) parts.push(`## ${cat.name}`, block(fs)); }
  const loose = inst.scraps.filter(f => !c.categories.some(cat => cat.id === f.category));
  if (loose.length) parts.push(c.categories.length ? `## Hors ${c.categoryLabel.toLowerCase()}` : "", block(loose));
  return parts.filter(Boolean).join("\n\n") + "\n";
}
function cumulGroupPanel(id) {
  const inst = S().modules[id], c = inst.config;
  const sum = catId => inst.entries.filter(x => (x.category || "") === catId).reduce((a, x) => a + (+x.value || 0), 0);
  const out = c.categories.map(cat => { const v = sum(cat.id), g = +cat.goal || 0; return { name: cat.name || "Sans titre", pct: g ? Math.min(100, Math.round(100 * v / g)) : null, sub: g ? `${v.toLocaleString("fr-FR")} / ${g.toLocaleString("fr-FR")} ${c.unitLabel}` : `${v.toLocaleString("fr-FR")} ${c.unitLabel}` }; });
  const frags = catId => c.scraps ? (inst.scraps || []).filter(f => (f.category || "") === catId).length : 0;
  out.forEach((g, i) => { const n = frags(c.categories[i].id); if (n) g.sub += ` · ${plural(n, c.scrapsLabel.toLowerCase().replace(/s$/, ""))}`; });
  const loose = sum(""); if (loose && c.categories.length) out.push({ name: `Hors ${c.categoryLabel.toLowerCase()}`, pct: null, sub: `${loose.toLocaleString("fr-FR")} ${c.unitLabel}` });
  return `<section><h3 style="margin:0 0 4px">Par ${esc(c.categoryLabel).toLowerCase()}</h3><p class="hint">Chaque ${esc(c.categoryLabel).toLowerCase()} a son propre objectif.</p>
    <div class="rooms">${out.map(g => `<div class="room"><div class="fill" style="width:${Math.min(100, g.pct ?? 0)}%"></div><small>${esc(g.name)}</small><b>${g.pct == null ? "—" : g.pct + " %"}</b><small>${esc(g.sub)}</small></div>`).join("")}</div></section>`;
}

/* ---- paliers d'un programme : des critères rédigés et cochés à la main, jamais un passage automatique ---- */
const tierCurrent = c => (c.tiers || []).find(t => !t.advancedAt) || null;
/* Premier module Décisions (une collection réglée en mode révision) actif, ou aucun. */
const firstDecisions = () => (S().config.modules.find(m => m.on && Object.hasOwn(S().modules, m.id) && S().modules[m.id].type === "collection" && S().modules[m.id].config.review) || {}).id || null;
function tiersPanel(id) {
  const inst = S().modules[id], c = inst.config;
  if (!c.tiers.length) return "";
  const passed = c.tiers.filter(t => t.advancedAt), cur = tierCurrent(c), crit = cur ? (cur.criteria || []) : [];
  const done = crit.filter(cr => cr.done).length;
  return `<section style="margin-top:28px"><h3 style="margin:0 0 4px">Paliers</h3>
    ${passed.length ? `<p class="hint">${passed.map(t => `« ${esc(t.name)} » atteint le ${fmt(t.advancedAt)}`).join(" · ")}</p>` : ""}
    ${cur ? `<b>${esc(cur.name)}</b>
      <ul class="plain">${crit.map(cr => `<li class="item" data-id="${esc(cr.id)}"><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" data-act="tier-check" data-mod="${esc(id)}" ${cr.done ? "checked" : ""}>${esc(cr.text)}</label></li>`).join("") || `<li class="empty">Aucun critère écrit. Ajoutes-en dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a>.</li>`}</ul>
      <p class="hint" style="margin:4px 0">${crit.length ? `${done} sur ${plural(crit.length, "critère")} coché${done > 1 ? "s" : ""}. ` : ""}${crit.length && done === crit.length ? "Tous cochés. Le passage reste ton choix, pas une formalité automatique." : "Coché ou non, rien ne fait avancer le palier à ta place."}</p>
      <button class="btn sm" data-act="tier-advance" data-mod="${esc(id)}">Passer au palier suivant</button>`
      : `<p class="hint">Tous les paliers sont franchis.</p>`}
  </section>`;
}

const TYPE_UI = {
  programme: {
    view(id) {
      const inst = S().modules[id], c = inst.config, now = todayISO();
      if (!c.start) return `<h2>${esc(label(id))}</h2><p class="hint">Un protocole de ${esc(c.weeks)} semaines, une séance à la fois.</p><button class="btn acc" data-act="prog-start" data-mod="${esc(id)}">Commencer aujourd'hui</button> <a class="btn ghost" href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">ou choisir une autre date</a>`;
      const days = new Set(inst.entries.map(x => x.date)), W = Math.min(52, Math.max(1, Math.round(+c.weeks) || 12));
      const week = Math.min(W, Math.floor(diffDays(now, c.start) / 7) + 1);
      const pct = Math.min(100, Math.round(100 * (diffDays(now, c.start) + 1) / (W * 7)));
      let cal = "";
      for (let w = 0; w < W; w++) { cal += `<span>S${w + 1}</span>`; for (let d = 0; d < 7; d++) { const day = addDaysTo(c.start, w * 7 + d); cal += `<i class="${days.has(day) ? "on" : ""} ${day === now ? "today" : ""} ${day > now ? "future" : ""}" title="${fmt(day)}"></i>`; } }
      const recent = [...inst.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
      return `<div class="row" style="margin-bottom:20px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn acc" data-act="entry-add" data-mod="${esc(id)}">Noter une séance</button></div>
  <div class="two"><section>
    <div class="big">Semaine ${week} <span class="hint" style="font-size:1.1rem">sur ${W}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">${inst.entries.length} séances, ${totalOf(inst)} ${esc(c.unitLabel)} au total, série actuelle de ${streakOf([...days])} jour(s).</p>
    <div class="cal">${cal}</div>
    <div style="margin-top:28px">${programmeGroupPanel(id)}</div>
    ${tiersPanel(id)}
  </section><section><h3>Journal</h3><p class="hint">Ce que le corps a fait, ce que la tête en a pensé.</p>
    <ul class="plain">${recent.map(x => `<li class="item" data-id="${esc(x.id)}"><span class="jdate">${fmt(x.date, { weekday: "short", day: "numeric", month: "short" })}</span><div>${esc(x.value ?? "?")} ${esc(c.unitLabel)}${x.note ? `<div class="note" style="margin:2px 0 0">${esc(x.note)}</div>` : ""}</div><button class="btn ghost sm ra" data-act="entry-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Aucune séance notée.</li>`}</ul>
  </section></div>`;
    },
    settings: (id, { config: c }) => `<div class="field-row"><label>Début du protocole<input type="date" data-set-mod="${esc(id)}.start" value="${esc(c.start || "")}"></label><label>Durée (semaines)<input type="number" min="1" max="520" data-set-mod="${esc(id)}.weeks" value="${esc(c.weeks)}"></label></div>
    <div class="field-row" style="margin-top:8px"><label>Unité<input data-set-mod="${esc(id)}.unitLabel" value="${esc(c.unitLabel)}" placeholder="min"></label><label>Séances visées par semaine<input type="number" min="1" max="7" data-set-mod="${esc(id)}.perWeek" value="${esc(c.perWeek)}"></label></div>
    <div style="margin-top:14px"><span class="hint" style="margin:0">Paliers : des critères que tu écris, jamais franchis tout seuls</span>
    ${c.tiers.map((t, ti) => `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--rule)">
      <div class="set" data-tri="${ti}" style="grid-template-columns:1fr auto"><input data-act="tier-name" data-mod="${esc(id)}" value="${esc(t.name)}" aria-label="Nom du palier"><div class="row"><button class="btn ghost sm" data-act="tier-up" data-mod="${esc(id)}" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="tier-del" data-mod="${esc(id)}">suppr.</button></div></div>
      <div style="margin:6px 0 0 10px">${(t.criteria || []).map((cr, ci) => `<div class="set" data-tri="${ti}" data-cri="${ci}" style="grid-template-columns:1fr auto"><input data-act="crit-text" data-mod="${esc(id)}" value="${esc(cr.text)}" placeholder="12 séances à 20 min…" aria-label="Critère"><button class="btn ghost sm" data-act="crit-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}
      <button class="btn ghost sm" data-act="crit-add" data-mod="${esc(id)}" data-tri="${ti}" style="margin-top:4px">+ critère</button></div></div>`).join("")}
    <button class="btn sm" data-act="tier-add" data-mod="${esc(id)}" style="margin-top:10px">Ajouter un palier</button></div>`,
    summary(id, inst) {
      const c = inst.config;
      if (!c.start) return "Pas encore commencé";
      const w = Math.min(c.weeks, Math.floor(diffDays(todayISO(), c.start) / 7) + 1), cur = tierCurrent(c);
      return `Semaine ${w} sur ${esc(c.weeks)}, ${plural(inst.entries.length, "séance")}, série de ${streakOf(inst.entries.map(x => x.date))} j${cur ? `, palier « ${esc(cur.name)} »` : ""}`;
    },
    alerts(id, inst, now) {
      if (!inst.config.start) return [];
      const done = inst.entries.some(x => x.date === now), name = esc(label(id)).toLowerCase(), last = lastValue(inst), m = esc(id);
      const actions = done ? "" : last != null
        ? `<button class="btn sm" data-act="prog-quick" data-mod="${m}">Noter ${esc(last)} ${esc(inst.config.unitLabel)}</button><button class="btn ghost sm" data-act="entry-add" data-mod="${m}">autre…</button>`
        : `<button class="btn ghost sm" data-act="entry-add" data-mod="${m}">noter</button>`;
      return [{ text: done ? `Séance de ${name} faite.` : `Pas encore de séance de ${name} aujourd'hui.`, actions }];
    },
    recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${x.value ?? "?"} ${inst.config.unitLabel}${x.note ? " · " + x.note : ""}`),
    review: (inst, from, to) => { const es = within(inst.entries, from, to); return `${plural(es.length, "séance")}, ${es.reduce((a, x) => a + (+x.value || 0), 0)} ${inst.config.unitLabel}`; },
    texts: inst => inst.entries.filter(x => x.note).map(x => ({ text: x.note, date: x.date, eid: x.id })),
    timerDone(id, inst, minutes) {
      if (!/^min/i.test(inst.config.unitLabel)) return false; // une séance comptée autrement qu'en minutes : rien à déduire
      toastAction(`Quinze minutes. Les noter dans ${label(id)} ?`, `Noter ${minutes} min`, () => {
        const cur = S().modules[id]; if (!cur) return;
        addJournalEntry(cur, { date: todayISO(), value: minutes }, uid(), todayISO()); site.save(); render(); toast("Noté. Le corps a fait sa part.");
      }, 15000);
      return true;
    },
    context(inst, nm) {
      const c = inst.config, cur = tierCurrent(c);
      const tier = cur ? ` Palier actuel : « ${cur.name} » (${(cur.criteria || []).filter(x => x.done).length}/${(cur.criteria || []).length} critères cochés).` : "";
      return `\n${nm} : ${c.start ? `protocole de ${c.weeks} semaines commencé le ${c.start}, ${inst.entries.length} séances, objectif ${c.perWeek}/semaine. Dernières notes : ${inst.entries.slice(-3).map(x => `${x.date} ${x.value ?? "?"} ${c.unitLabel} ${x.note || ""}`).join(" ; ")}${tier}` : "pas commencé"}`;
    },
    add(id, inst) {
      openForm("Noter une séance", [{ row: [{ n: "date", l: "Date", t: "date", req: true }, { n: "value", l: `Durée (${inst.config.unitLabel})`, t: "number" }] }, { n: "note", l: "Ce qui s'est passé", t: "textarea", rows: 4 }],
        { date: todayISO(), value: lastValue(inst) ?? "" }, v => { addJournalEntry(inst, { date: v.date, value: v.value, note: v.note }, uid(), todayISO()); site.save(); render(); });
    },
    click: {
      "prog-quick": el => { const inst = instOf(el), v = lastValue(inst); addJournalEntry(inst, { date: todayISO(), value: v }, uid(), todayISO()); site.save(); render(); toast(`${v} ${inst.config.unitLabel} notées. Le corps a fait sa part.`); },
      "prog-start": el => { instOf(el).config.start = todayISO(); site.save(); render(); },
      "tier-add": el => { instOf(el).config.tiers.push({ id: uid(), name: `Palier ${instOf(el).config.tiers.length + 1}`, criteria: [] }); site.save(); render(); },
      "tier-up": el => { const a = instOf(el).config.tiers, i = +el.closest("[data-tri]").dataset.tri; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } },
      "tier-del": async el => {
        const t = instOf(el).config.tiers[+el.closest("[data-tri]").dataset.tri];
        if (!await ask(`Supprimer le palier « ${t.name} » ? Ses critères disparaissent avec lui ; l'historique du palier franchi n'y touche pas.`)) return;
        instOf(el).config.tiers.splice(+el.closest("[data-tri]").dataset.tri, 1); site.save(); render();
      },
      "crit-add": el => { instOf(el).config.tiers[+el.dataset.tri].criteria.push({ id: uid(), text: "", done: false }); site.save(); render(); },
      "crit-del": el => { const r = el.closest("[data-cri]").dataset; instOf(el).config.tiers[+r.tri].criteria.splice(+r.cri, 1); site.save(); render(); },
      // Le passage est le geste ; la décision reste à rédiger, jamais créée toute seule.
      "tier-advance": el => {
        const inst = instOf(el), cur = tierCurrent(inst.config); if (!cur) return;
        cur.advancedAt = todayISO(); site.save(); render();
        const dec = firstDecisions();
        if (!dec) return toast(`Palier « ${cur.name} » atteint.`);
        const dc = S().modules[dec].config;
        collectionForm(dec, { title: `Palier « ${cur.name} » atteint (${label(el.dataset.mod)})`, status: dc.statuses[Math.min(1, dc.statuses.length - 1)] }, `Noter la décision : « ${cur.name} »`);
      }
    },
    change: {
      "tier-check": el => { const cur = tierCurrent(instOf(el).config), cr = cur && (cur.criteria || []).find(x => x.id === idOf(el)); if (cr) { cr.done = el.checked; site.save(); render(); } },
      "tier-name": el => { const t = instOf(el).config.tiers[+el.closest("[data-tri]").dataset.tri]; t.name = el.value.trim() || t.name; site.save(); el.blur(); render(); },
      "crit-text": el => { const r = el.closest("[data-cri]").dataset, cr = instOf(el).config.tiers[+r.tri].criteria[+r.cri]; cr.text = el.value.trim(); if (!cr.text) instOf(el).config.tiers[+r.tri].criteria.splice(+r.cri, 1); site.save(); el.blur(); render(); }
    }
  },

  cumul: {
    view(id) {
      const inst = S().modules[id], c = inst.config;
      const tot = totalOf(inst), pct = Math.min(100, Math.round(100 * tot / (+c.goal || 1)));
      const last = inst.entries.map(x => x.date).sort().pop(), total = c.entryMode === "total";
      const lastCat = ([...inst.entries].reverse().find(x => x.category != null) || {}).category || ""; // la dernière catégorie servie
      const lastScrapCat = ([...(inst.scraps || [])].reverse().find(x => x.category != null) || {}).category ?? lastCat, ff = fragFilter[id] ?? "*";
      // Un menu des catégories (chapitres) : pour un nouveau fragment, ou pour en déplacer un.
      const catSelect = (domId, value, fallback, attrs = "") => c.categories.length ? `<select ${domId ? `id="${domId}"` : ""} ${attrs} aria-label="${esc(c.categoryLabel)}" style="max-width:220px"><option value="">Hors ${esc(c.categoryLabel).toLowerCase()}</option>${c.categories.map(x => `<option value="${esc(x.id)}" ${x.id === (value || fallback) ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : "";
      return `<h2>${esc(label(id))}</h2>${c.title ? `<p class="hint">${esc(c.title)}</p>` : ""}
  <div class="two"><section>
    <div class="big">${tot.toLocaleString("fr-FR")} <span class="hint" style="font-size:1.1rem">${esc(c.unitLabel)} sur ${(+c.goal).toLocaleString("fr-FR")}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">Dernière session ${ago(last)}. Série de ${streakOf(inst.entries.map(x => x.date))} jour(s). ${esc(projection(inst))}</p>
    <div class="row"><input type="number" id="cumIn" min="${total ? 0 : 1}" placeholder="${total ? `Total atteint (${esc(c.unitLabel)})` : `${esc(c.unitLabel)} aujourd'hui`}" style="max-width:200px" inputmode="numeric" aria-label="${total ? "Total atteint" : "Ajout du jour"}">${c.categories.length ? `<select id="cumCat" aria-label="${esc(c.categoryLabel)}" style="max-width:220px"><option value="">Hors ${esc(c.categoryLabel).toLowerCase()}</option>${c.categories.map(x => `<option value="${esc(x.id)}" ${x.id === lastCat ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}<button class="btn acc" data-act="entry-add" data-mod="${esc(id)}">Ajouter</button></div>
    <div style="margin-top:28px">${c.categories.length ? cumulGroupPanel(id) : `<p class="hint">Ajoute des ${esc(c.categoryLabel).toLowerCase()}s dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a> pour suivre chacune en pourcentage.</p>`}</div>
  </section>${c.scraps ? `<section><h3>${esc(c.scrapsLabel)}</h3><p class="hint">Une phrase qui passe, avant qu'elle ne reparte. Un « ? » devant en fait une hypothèse.</p>
    ${deriveBanner(id)}<textarea id="scrapIn" data-draft rows="3" placeholder="…" aria-label="Nouveau"></textarea><div class="row" style="margin-top:8px">${catSelect("scrapCat", "", lastScrapCat)}<button class="btn" data-act="scrap-add" data-mod="${esc(id)}">Garder</button></div>
    ${c.categories.length || inst.scraps.length ? `<div class="row" style="margin-top:14px">${c.categories.length ? `<select data-act="scrap-f" data-mod="${esc(id)}" aria-label="Filtrer"><option value="*">Tous</option>${[["", `Hors ${c.categoryLabel.toLowerCase()}`], ...c.categories.map(x => [x.id, x.name])].map(([k, n]) => `<option value="${esc(k)}" ${ff === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>` : ""}<span class="spacer"></span>${inst.scraps.length ? `<button class="btn ghost sm" data-act="scrap-md" data-mod="${esc(id)}">Exporter en Markdown</button><button class="btn ghost sm" data-act="scrap-dossier" data-mod="${esc(id)}" title="Avec dates, statuts, provenance et liens, pour une lecture assistée">Dossier</button>` : ""}</div>` : ""}
    <ul class="plain margins" style="margin-top:10px">${(pg => pg.items.map(f => `<li class="item" data-id="${esc(f.id)}"><span class="jdate">${fmt(f.date)}</span><div><div style="white-space:pre-wrap">${esc(f.text)}</div><div class="meta">${c.categories.length ? catSelect("", f.category || "", "", `data-act="scrap-cat" data-mod="${esc(id)}"`) : ""}${epSelect(id, f)}${linksHTML(id)}</div>${versionsHTML(f)}</div>${margHTML(id, f, f.text)}<div class="row"><button class="btn ghost sm ra" data-act="scrap-edit" data-mod="${esc(id)}">modifier</button><button class="btn ghost sm ra" data-act="scrap-del" data-mod="${esc(id)}">suppr.</button></div></li>`).join("") + pg.more)(paged(`scraps:${id}`, [...inst.scraps].reverse().filter(f => ff === "*" || (f.category || "") === ff))) || `<li class="empty">Rien pour l'instant.</li>`}</ul>
  </section>` : ""}</div>`;
    },
    settings: (id, { config: c }) => `<div class="field-row"><label>Titre / sous-titre<input data-set-mod="${esc(id)}.title" value="${esc(c.title || "")}"></label><label>Objectif<input type="number" min="1" data-set-mod="${esc(id)}.goal" value="${esc(c.goal)}"></label></div>
    <div class="field-row" style="margin-top:8px"><label>Je saisis<select data-set-mod="${esc(id)}.entryMode"><option value="delta" ${c.entryMode !== "total" ? "selected" : ""}>Ce que j'ai fait aujourd'hui</option><option value="total" ${c.entryMode === "total" ? "selected" : ""}>Le total atteint (l'app calcule la différence)</option></select></label><span></span></div>
    <div class="field-row" style="margin-top:8px"><label>Unité<input data-set-mod="${esc(id)}.unitLabel" value="${esc(c.unitLabel)}" placeholder="mots"></label><label>Nom des catégories<input data-set-mod="${esc(id)}.categoryLabel" value="${esc(c.categoryLabel)}" placeholder="Chapitre"></label></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">${esc(c.categoryLabel)}s</span>${c.categories.map((cat, i) => `<div class="set" data-ci="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="cat-name" data-mod="${esc(id)}" value="${esc(cat.name)}" aria-label="Nom"><input type="number" min="0" data-act="cat-goal" data-mod="${esc(id)}" value="${esc(cat.goal || "")}" placeholder="Objectif" aria-label="Objectif"><div class="row"><button class="btn ghost sm" data-act="cat-up" data-mod="${esc(id)}" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="cat-del" data-mod="${esc(id)}">suppr.</button></div></div>`).join("")}<button class="btn sm" data-act="cat-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter</button></div>`,
    summary(id, inst) {
      const c = inst.config;
      return `${totalOf(inst).toLocaleString("fr-FR")} ${esc(c.unitLabel)} sur ${(+c.goal).toLocaleString("fr-FR")}${c.scraps ? `, ${inst.scraps.length} ${esc(c.scrapsLabel).toLowerCase()}` : ""}`;
    },
    context(inst, nm) {
      const c = inst.config;
      return `\n${nm}${c.title ? ` « ${c.title} »` : ""} : ${totalOf(inst)} ${c.unitLabel} sur ${c.goal}. ${projection(inst)}${c.categories.length ? ` ${c.categoryLabel}s : ${c.categories.map(x => x.name).join(", ")}.` : ""}${c.scraps ? ` Derniers ${c.scrapsLabel.toLowerCase()} : ${inst.scraps.slice(-3).map(f => f.text.slice(0, 200)).join(" / ") || "aucun"}` : ""}`;
    },
    recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${x.value > 0 ? "+" : ""}${x.value ?? "?"} ${inst.config.unitLabel}`),
    review: (inst, from, to) => { const n = within(inst.entries, from, to).reduce((a, x) => a + (+x.value || 0), 0), f = within(inst.scraps || [], from, to).length; return `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR")} ${inst.config.unitLabel}${inst.config.scraps ? `, ${plural(f, inst.config.scrapsLabel.toLowerCase().replace(/s$/, ""))}` : ""}`; },
    texts: inst => [...(inst.scraps || []).map(f => ({ text: f.text, date: f.date, ep: f.ep, eid: f.id })), ...inst.config.categories.map(c => ({ text: c.name }))],
    timerDone(id, inst) {
      const inp = $("#cumIn"); if (!inp) return false;
      inp.focus();
      toast(`Quinze minutes. ${inst.config.entryMode === "total" ? "Quel total, maintenant ?" : `Combien de ${inst.config.unitLabel} ?`}`);
      return true;
    },
    canAccept: inst => !!inst.config.scraps,
    accept: (id, inst, note) => { const cat = ([...inst.scraps].reverse().find(x => x.category) || {}).category; inst.scraps.push({ id: uid(), text: note.text, date: note.date, ...(cat ? { category: cat } : {}) }); },
    add(id, inst) {
      const raw = $("#cumIn").value.trim(), n = +raw, unit = inst.config.unitLabel;
      if (!raw || !Number.isFinite(n)) return;
      // Mode « total » : la différence avec le total connu ; un total en baisse (coupes) est enregistré tel quel.
      const v = inst.config.entryMode === "total" ? n - totalOf(inst) : n;
      if (!v) return toast(inst.config.entryMode === "total" ? "Même total qu'avant. Rien de neuf, ou alors en silence." : "Zéro. Noté mentalement, pas davantage.");
      addJournalEntry(inst, { date: todayISO(), value: v, category: $("#cumCat") ? $("#cumCat").value : "" }, uid(), todayISO());
      $("#cumIn").value = ""; site.save(); render();
      toast(v > 0 ? `+${v.toLocaleString("fr-FR")} ${unit}. Ça avance, que tu y croies ou non.` : `${v.toLocaleString("fr-FR")} ${unit}. Couper, c'est aussi écrire.`);
    },
    click: {
      "scrap-add": el => {
        const v = $("#scrapIn").value.trim(); if (!v) return;
        const cat = $("#scrapCat") ? $("#scrapCat").value : "", p = epPrefix(v);
        const f = { id: uid(), text: p.text, date: todayISO(), ...(cat ? { category: cat } : {}), ...(p.ep ? { ep: p.ep } : {}) };
        instOf(el).scraps.push(f); const derived = applyDerive(el.dataset.mod, f); $("#scrapIn").value = ""; site.save(); render();
        if (derived) toast(derived > 1 ? "Synthèse gardée. La tension est levée." : "Dérivé, et relié à sa source.");
        else if (p.ep) toast("Gardé comme hypothèse. Elle attendra ses preuves.");
      },
      // Le dossier suit le filtre de chapitre affiché ; les fragments dans l'ordre où ils ont été écrits.
      "scrap-dossier": el => {
        const id = el.dataset.mod, inst = S().modules[id], ff = fragFilter[id] ?? "*", c = inst.config;
        const fs = inst.scraps.filter(f => ff === "*" || (f.category || "") === ff);
        const chap = ff === "*" ? "" : ff === "" ? ` — hors ${c.categoryLabel.toLowerCase()}` : ` — ${(c.categories.find(x => x.id === ff) || {}).name || ""}`;
        dossierFile(`${label(id)}${chap}`, `${label(id)} : ${c.scrapsLabel.toLowerCase()}${chap}`, fs.map(f => ({ mod: id, text: f.text, date: f.date, e: f })));
      },
      "scrap-md": el => { const id = el.dataset.mod; downloadFile(`${id}-${todayISO()}.md`, scrapsMarkdown(id, S().modules[id]), "text/markdown", label(id)); },
      "scrap-del": el => removeWithUndo(el.dataset.mod, "scraps", idOf(el)),
      "scrap-edit": el => {
        const id = el.dataset.mod, f = S().modules[id].scraps.find(x => x.id === idOf(el)); if (!f) return;
        openForm("Modifier le fragment", [{ n: "text", l: "Texte", t: "textarea", rows: 6, req: true }], { text: f.text }, v => {
          const cur = S().modules[id], target = cur && cur.scraps.find(x => x.id === f.id);
          if (!target) return toast("Ce fragment a disparu entre-temps.");
          if (editFragmentText(target, v.text, todayISO())) { site.save(); render(); toast("Modifié. L'ancienne version reste lisible dessous."); }
        });
      },
      "cat-add": el => { const inst = instOf(el); inst.config.categories.push({ id: uid(), name: `${inst.config.categoryLabel} ${inst.config.categories.length + 1}`, goal: 0 }); site.save(); render(); },
      "cat-del": async el => { const inst = instOf(el), i = +el.closest("[data-ci]").dataset.ci, cat = inst.config.categories[i]; if (!await ask(`Supprimer « ${cat.name} » ? Les entrées déjà ajoutées passeront hors catégorie.`)) return; inst.entries.forEach(x => { if (x.category === cat.id) x.category = ""; }); (inst.scraps || []).forEach(f => { if (f.category === cat.id) delete f.category; }); inst.config.categories.splice(i, 1); site.save(); render(); },
      "cat-up": el => { const a = instOf(el).config.categories, i = +el.closest("[data-ci]").dataset.ci; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } }
    },
    change: {
      "scrap-cat": el => { const f = instOf(el).scraps.find(x => x.id === idOf(el)); if (f) { if (el.value) f.category = el.value; else delete f.category; site.save(); render(); } },
      "scrap-f": el => { fragFilter[el.dataset.mod] = el.value; render(); },
      "cat-name": el => { const cat = instOf(el).config.categories[+el.closest("[data-ci]").dataset.ci]; cat.name = el.value.trim() || cat.name; site.save(); el.blur(); render(); },
      "cat-goal": el => { const cat = instOf(el).config.categories[+el.closest("[data-ci]").dataset.ci]; cat.goal = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
    }
  },

  rappels: {
    view(id) {
      const inst = S().modules[id], c = inst.config, now = todayISO();
      const line = t => { const l = lastOf(inst, t.id), due = t.every && (!l || diffDays(now, l) >= t.every); return `<div class="set"><span class="${due ? "late" : ""}">${esc(t.label)}</span><span class="hint" style="margin:0">${ago(l)}${t.every ? `, tous les ${esc(t.every)} j` : ""}</span><button class="btn sm" data-act="entry-log" data-mod="${esc(id)}" data-t="${esc(t.id)}">Fait aujourd'hui</button></div>`; };
      const recent = [...inst.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
      return `<h2>${esc(label(id))}${c.subtitle ? ` <span class="hint" style="font-size:1.2rem">${esc(c.subtitle)}</span>` : ""}</h2>
  <div class="two"><section>
    ${c.types.map(line).join("")}
    <div class="row" style="margin-top:14px"><input id="rapNote" data-draft placeholder="Observation…" aria-label="Observation"><button class="btn" data-act="entry-note" data-mod="${esc(id)}">Noter</button></div>
    <p class="hint" style="margin-top:10px">Réglable dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a>.</p>
  </section><section><h3>Journal</h3><ul class="plain">${recent.map(l => `<li class="item" data-id="${esc(l.id)}"><span class="jdate">${fmt(l.date)}</span><div><span class="tag">${esc(l.type)}</span>${l.note ? `<div class="note" style="margin:2px 0 0">${esc(l.note)}</div>` : ""}${l.origin ? `<div class="meta">${originHTML(l, l.note)}</div>` : ""}</div><button class="btn ghost sm ra" data-act="entry-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Aucune entrée.</li>`}</ul></section></div>`;
    },
    settings: (id, { config: c }) => `<div class="field-row"><label>Sous-titre (ex. nom propre)<input data-set-mod="${esc(id)}.subtitle" value="${esc(c.subtitle || "")}"></label><span></span></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">Types et rappels</span>${c.types.map((t, i) => `<div class="set" data-ti="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="typ-name" data-mod="${esc(id)}" value="${esc(t.label)}" aria-label="Nom"><input type="number" min="0" data-act="typ-every" data-mod="${esc(id)}" value="${esc(t.every || "")}" placeholder="tous les X j" aria-label="Fréquence"><button class="btn ghost sm" data-act="typ-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}<button class="btn sm" data-act="typ-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter un type</button></div>`,
    summary(id, inst) {
      const t = inst.config.types[0];
      return t ? `${esc(t.label)} : ${ago(lastOf(inst, t.id))}` : plural(inst.entries.length, "entrée");
    },
    // Une seule ligne par module sur l'accueil, quel que soit le nombre de rappels dus : « Phidippus : Repas (jamais) · Brumisation (jamais) ».
    alerts(id, inst, now) {
      const due = inst.config.types.filter(t => { const l = lastOf(inst, t.id); return t.every && (!l || diffDays(now, l) >= t.every); });
      if (!due.length) return [];
      const one = due.length === 1;
      return [{ text: `<b>${esc(label(id))}</b> : ${due.map(t => `${esc(t.label)} (${ago(lastOf(inst, t.id))})`).join(" · ")}`,
        actions: due.map(t => `<button class="btn sm" data-act="entry-log" data-mod="${esc(id)}" data-t="${esc(t.id)}">${one ? "fait" : `${esc(t.label.toLowerCase())} : fait`}</button>`).join("") + `<a class="btn ghost sm" href="#${esc(id)}">voir</a>` }];
    },
    accept: (id, inst, note) => { addJournalEntry(inst, { date: note.date, type: "note", note: note.text }, uid(), todayISO()); },
    recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${(inst.config.types.find(t => t.id === x.type) || {}).label || x.type}${x.note ? " · " + x.note : ""}`),
    review: (inst, from, to) => { const es = within(inst.entries, from, to); if (!es.length) return "Rien de noté"; const by = [...new Set(es.map(x => x.type))].map(t => `${((inst.config.types.find(y => y.id === t) || {}).label || t).toLowerCase()} ×${es.filter(x => x.type === t).length}`); return by.join(", "); },
    texts: inst => inst.entries.filter(x => x.note).map(x => ({ text: x.note, date: x.date, eid: x.id })),
    context(inst, nm) {
      const c = inst.config;
      return `\n${nm}${c.subtitle ? ` (${c.subtitle})` : ""} : ${c.types.map(t => `${t.label.toLowerCase()} ${lastOf(inst, t.id) || "jamais"}`).join(", ")}.`;
    },
    click: {
      "entry-log": el => { addJournalEntry(instOf(el), { date: todayISO(), type: el.dataset.t, note: "" }, uid(), todayISO()); site.save(); render(); },
      "entry-note": el => { const v = $("#rapNote").value.trim(); if (!v) return; addJournalEntry(instOf(el), { date: todayISO(), type: "note", note: v }, uid(), todayISO()); $("#rapNote").value = ""; site.save(); render(); },
      "typ-add": el => { instOf(el).config.types.push({ id: uid(), label: "Nouveau type", every: 0 }); site.save(); render(); },
      "typ-del": async el => { const inst = instOf(el), i = +el.closest("[data-ti]").dataset.ti; if (await ask(`Supprimer « ${inst.config.types[i].label} » ?`)) { inst.config.types.splice(i, 1); site.save(); render(); } }
    },
    change: {
      "typ-name": el => { const t = instOf(el).config.types[+el.closest("[data-ti]").dataset.ti]; t.label = el.value.trim() || t.label; site.save(); el.blur(); render(); },
      "typ-every": el => { const t = instOf(el).config.types[+el.closest("[data-ti]").dataset.ti]; t.every = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
    }
  }
};
/* ---- collection : éléments à statuts, en colonnes (tableau de production) ou en liste filtrable ---- */
const colFilter = {}; // filtre de statut du mode liste, par module (propre à l'appareil, non enregistré)
const colTab = {}; // colonne montrée sur téléphone, par module (propre à l'appareil)
/* Change le statut d'un élément (une colonne du tableau) : flèches, glisser-déposer, touches [ et ]. */
function moveCardTo(mod, id, ci) {
  const inst = S().modules[mod], e = inst && inst.type === "collection" && inst.entries.find(x => x.id === id);
  if (!e) return;
  const c = inst.config, i = Math.max(0, Math.min(c.statuses.length - 1, ci));
  if (c.statuses[i] === e.status) return;
  e.status = c.statuses[i]; site.save(); render();
  if (i === c.statuses.length - 1) toast(collectionDoneLines[Math.floor(Math.random() * collectionDoneLines.length)].replace("%t", e.title).replace("%s", e.status));
}
const modOf = el => el.closest("[data-mod]").dataset.mod;
const itemOf = el => S().modules[modOf(el)].entries.find(x => x.id === idOf(el));
const collectionDoneLines = ["« %t » est passé à « %s ». Le monde n'a rien remarqué, comme prévu.", "« %t » : %s. Une chose de moins qui attend ton attention.", "%s : « %t ». L'Œuvre avance, à pas de lichen."];
/* Dernier réexamen d'un élément (collection en mode révision) : quand, et ce qu'il en est sorti. */
const reviewedHTML = e => { const r = (e.reviews || []).at(-1); return r ? `<span>${esc(r.verdict)} le ${fmt(r.date)}</span>` : ""; };
/* `item` sans `id` préremplit un nouvel élément (ex. une décision suggérée par un autre module) sans en faire
   une modification : à l'enregistrement, c'est un identifiant neuf qui est utilisé, jamais celui, absent, de `item`. */
function collectionForm(id, item, title) {
  const c = S().modules[id].config, f = c.fields;
  const extra = [f.subtitle && { n: "subtitle", l: f.subtitle }, f.tag && { n: "tag", l: f.tag }, f.due && { n: "due", l: f.due, t: "date" }].filter(Boolean);
  const fields = [{ n: "title", l: f.title, req: true }];
  for (let i = 0; i < extra.length; i += 2) fields.push({ row: extra.slice(i, i + 2) });
  fields.push({ n: "status", l: c.statusLabel, t: "select", o: c.statuses });
  if (f.text) fields.push({ n: "text", l: f.text, t: "textarea", rows: c.display === "colonnes" ? 6 : 3 });
  openForm(title || (item ? `Modifier « ${item.title} »` : c.addLabel), fields, item || { status: c.statuses[0] }, v => {
    const inst = S().modules[id]; // relu : une synchro a pu remplacer les données pendant la saisie
    if (!inst) return toast("Ce module a été supprimé entre-temps.");
    saveCollectionItem(inst, v, item && item.id ? item.id : uid(), todayISO()); site.save(); render();
  });
}
function collectionCard(id, e, ci, last) {
  const f = S().modules[id].config.fields, meta = [f.tag && e.tag ? `<span class="tag">${esc(e.tag)}</span>` : "", f.due && e.due ? `<span>${fmt(e.due)}</span>` : "", srcMeta(e), originHTML(e, e.title)].join("");
  return `<div class="card" data-id="${esc(e.id)}" data-ci="${ci}" draggable="true" tabindex="0" aria-label="${esc(e.title)} : [ pour reculer, ] pour avancer"><b>${esc(e.title)}</b>${f.subtitle && e.subtitle ? `, <i>${esc(e.subtitle)}</i>` : ""}${meta ? `<div class="meta">${meta}</div>` : ""}${f.text && e.text ? `<p>${esc(e.text.slice(0, 160))}${e.text.length > 160 ? "…" : ""}</p>` : ""}
      <div class="row">${ci > 0 ? `<button class="btn ghost sm" data-act="col-move" data-d="-1" aria-label="Reculer">←</button>` : ""}${ci < last ? `<button class="btn ghost sm" data-act="col-move" data-d="1" aria-label="Avancer">→</button>` : ""}<span class="spacer"></span><button class="btn ghost sm ra" data-act="specimen">fiche</button><button class="btn ghost sm ra" data-act="col-edit">modifier</button><button class="btn ghost sm ra" data-act="col-del">suppr.</button></div></div>`;
}
/* ---- concordance : une collection de motifs, comptés dans les textes de tous les autres modules ----
   Mot entier (« lune » ne trouve pas « lunettes »), sans accents ni casse, pluriel en s/x toléré ; les variantes
   (sous-titre, séparées par des virgules) comptent comme le motif. Tout est calculé à la lecture, sur l'historique
   existant : rien n'est enregistré, donc rien à migrer ni à synchroniser. */
const isConcordance = inst => inst.type === "collection" && !!inst.config.concordance;
const reEscape = v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* Les mots d'un texte déjà replié, découpé une fois pour toutes (même frontière de mot que motifMatcher). */
const wordsCache = new Map();
function wordsOf(f) {
  let w = wordsCache.get(f);
  if (!w) { w = new Set(f.split(/[^\p{L}\p{N}]+/u)); if (wordsCache.size >= 20000) wordsCache.clear(); wordsCache.set(f, w); }
  return w;
}
/* Un motif et ses variantes, repliés : celles d'un seul mot (cherchées dans l'ensemble des mots d'un texte,
   pluriel en s/x compris) et, pour celles de plusieurs mots, une expression régulière au mot entier. */
function motifForms(e) {
  const vs = [e.title, ...String(e.subtitle || "").split(",")].map(v => fold(v.trim())).filter(v => v.length >= 2);
  const single = vs.filter(v => !/[^\p{L}\p{N}]/u.test(v)), multi = vs.filter(v => !single.includes(v));
  return { single, re: multi.length ? new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${multi.map(v => reEscape(v).replace(/\s+/g, "\\s+")).join("|")})(?:s|x)?(?=$|[^\\p{L}\\p{N}])`, "u") : null };
}
/* Pour chaque motif : les textes où il apparaît ({ mod, date }), et ses voisins (motifs présents dans les mêmes textes). */
const concordance = inst => memoInRender(inst, () => computeConcordance(inst));
function computeConcordance(inst) {
  const corpus = [];
  for (const [mid, m] of Object.entries(S().modules)) {
    const ui = TYPE_UI[m.type];
    if (!isConcordance(m) && ui && ui.texts) for (const t of ui.texts(m)) { const f = fold(t.text); corpus.push({ mod: mid, f, w: wordsOf(f), date: t.date || null }); }
  }
  // Index inversé : chaque forme de mot → les motifs qu'elle désigne. Un texte se parcourt alors mot à mot,
  // au lieu d'être confronté à chaque motif (le coût suit la longueur des textes, plus leur nombre × motifs).
  const forms = new Map(), multi = [], hits = inst.entries.map(() => []), near = inst.entries.map(() => new Map());
  inst.entries.forEach((e, i) => {
    const m = motifForms(e);
    for (const v of m.single) for (const f of [v, v + "s", v + "x"]) { if (!forms.has(f)) forms.set(f, new Set()); forms.get(f).add(i); }
    if (m.re) multi.push([i, m.re]);
  });
  for (const d of corpus) {
    const set = new Set();
    for (const w of d.w) { const ms = forms.get(w); if (ms) for (const i of ms) set.add(i); }
    for (const [i, re] of multi) if (!set.has(i) && re.test(d.f)) set.add(i);
    const found = [...set];
    for (const i of found) { hits[i].push(d); for (const j of found) if (j !== i) near[i].set(j, (near[i].get(j) || 0) + 1); }
  }
  return inst.entries.map((e, i) => {
    const dated = hits[i].filter(d => d.date).sort((a, b) => b.date.localeCompare(a.date));
    // Un voisinage d'une seule rencontre n'est pas une constellation : au moins deux.
    const neighbours = [...near[i]].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([j, n]) => ({ name: inst.entries[j].title, n }));
    return { e, hits: hits[i], last: dated[0] || null, neighbours };
  });
}
const alive = (inst, e) => inst.config.statuses.indexOf(e.status) < inst.config.doneFrom;
/* En jachère : un motif vivant déjà apparu, mais plus depuis fallowDays jours (en lunaisons pour le dire). */
const fallow = (inst, r) => alive(inst, r.e) && r.last && diffDays(todayISO(), r.last.date) > (+inst.config.fallowDays || 90);
const moons = days => Math.max(1, Math.floor(days / SYNODIC));
function concordanceView(id, inst, head) {
  const c = inst.config, rows = concordance(inst), sleeping = rows.filter(r => fallow(inst, r));
  const order = (a, b) => alive(inst, b.e) - alive(inst, a.e) || b.hits.length - a.hits.length || a.e.title.localeCompare(b.e.title, "fr");
  const line = r => {
    const e = r.e, n = r.hits.length;
    const where = r.last ? ` · dernière ${ago(r.last.date)} (${esc(label(r.last.mod))})` : n ? " · jamais daté" : "";
    return `<li class="item motif" data-id="${esc(e.id)}"><span></span><div><b>${esc(e.title)}</b>${e.subtitle ? ` <i class="hint">${esc(e.subtitle)}</i>` : ""}${c.fields.tag && e.tag ? ` <span class="tag">${esc(e.tag)}</span>` : ""}
      <div class="meta"><span>${n ? plural(n, "occurrence") : "jamais rencontré"}${where}</span>${fallow(inst, r) ? `<span class="late">en jachère</span>` : ""}</div>
      ${r.neighbours.length ? `<div class="meta"><span>voisins : ${r.neighbours.map(x => `${esc(x.name)} (${x.n})`).join(", ")}</span></div>` : ""}
      ${c.fields.text && e.text ? `<div class="note" style="margin:2px 0 0">${esc(e.text)}</div>` : ""}</div>
      <div class="row"><select data-act="col-st" aria-label="${esc(c.statusLabel)}">${c.statuses.map(st => `<option ${st === e.status ? "selected" : ""}>${esc(st)}</option>`).join("")}</select>${n ? `<button class="btn ghost sm" data-act="search-for" data-q="${esc(e.title)}">voir</button><button class="btn ghost sm ra" data-act="carte" data-k="motif" data-v="${esc(id)}/${esc(e.id)}">carte</button>` : ""}<button class="btn ghost sm ra" data-act="specimen">fiche</button><button class="btn ghost sm ra" data-act="col-edit">modifier</button><button class="btn ghost sm ra" data-act="col-del">suppr.</button></div></li>`;
  };
  return `<div data-mod="${esc(id)}">${head}
  ${sleeping.length ? `<section><h3>En jachère</h3><p class="hint">Vivants, mais absents depuis plus de ${esc(c.fallowDays)} jours. Reposés, pas perdus.</p><div class="row">${sleeping.map(r => `<button class="btn ghost sm" data-act="search-for" data-q="${esc(r.e.title)}">${esc(r.e.title)} · ${plural(moons(diffDays(todayISO(), r.last.date)), "lunaison")}</button>`).join("")}</div></section>` : ""}
  <ul class="plain">${[...rows].sort(order).map(line).join("") || `<li class="empty">Aucun motif. Ajoute un mot qui revient ; l'app comptera ses retours.</li>`}</ul></div>`;
}
function concordanceSummary(inst) {
  const sleeping = concordance(inst).filter(r => fallow(inst, r)).length;
  return `${plural(inst.entries.length, "motif")}${sleeping ? `, ${sleeping} en jachère` : ""}`;
}
/* Les motifs apparus dans une période, les plus fréquents d'abord : une ligne de bilan. */
function motifsIn(inst, from, to) {
  return concordance(inst).map(r => ({ name: r.e.title, n: r.hits.filter(d => d.date && d.date >= from && d.date < to).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
}
TYPE_UI.collection = {
  view(id) {
    const inst = S().modules[id], c = inst.config, f = c.fields, items = inst.entries.filter(e => gMatch(id, e));
    const head = `<div class="row" style="margin-bottom:${c.display === "colonnes" ? 20 : 8}px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn acc" data-act="col-new">${esc(c.addLabel)}</button></div>${c.description ? `<p class="hint">${esc(c.description)}</p>` : ""}${c.sources ? sourceBar(id) : ""}${c.music && inst.entries.some(e => e.mb && e.mb.a) ? `<div class="row" style="margin:-2px 0 12px"><button class="btn ghost sm" data-act="mb-new" title="Demande à MusicBrainz ce qu'ont publié tes artistes reliés depuis ta dernière vérification">Nouvelles sorties</button></div>` : ""}`;
    if (c.concordance) return concordanceView(id, inst, head);
    const panel = groupPanel(id, `Part arrivée à « ${esc(c.statuses[c.doneFrom])} » dans chaque groupe. Clique pour filtrer.`);
    if (c.display === "colonnes") {
      const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
      // Sur téléphone, une colonne à la fois, choisie par un sélecteur ; sur ordinateur, toutes, et l'on y glisse les cartes.
      const tab = Math.min(c.statuses.length - 1, colTab[id] || 0);
      const seg = `<div class="seg" role="tablist" aria-label="${esc(c.statusLabel)}">${c.statuses.map((st, ci) => `<button type="button" role="tab" aria-selected="${ci === tab}" class="${ci === tab ? "on" : ""}" data-act="col-tab" data-i="${ci}">${esc(st)} <span>${items.filter(e => e.status === st).length}</span></button>`).join("")}</div>`;
      return `<div data-mod="${esc(id)}">${head}${seg}<div class="board" style="margin-bottom:34px">${c.statuses.map((st, ci) => { const col = items.filter(e => e.status === st).sort(byDue);
        return `<div class="col ${ci === tab ? "on" : ""}" data-ci="${ci}"><h3>${esc(st)} <span class="hint" style="font-size:.95rem">${col.length}</span></h3>${col.map(e => collectionCard(id, e, ci, c.statuses.length - 1)).join("") || `<p class="col-empty"><span class="sr">Aucun élément.</span></p>`}</div>`; }).join("")}</div>${panel}</div>`;
    }
    const filter = colFilter[id] || "", shown = items.filter(e => !filter || e.status === filter);
    return `<div data-mod="${esc(id)}">${head}
  <div class="row" style="margin-bottom:10px"><select data-act="col-f" aria-label="Filtrer"><option value="">Tous</option>${c.statuses.map(st => `<option ${st === filter ? "selected" : ""}>${esc(st)}</option>`).join("")}</select></div>
  <div class="two"><div><ul class="plain col-list">${(pg => pg.items.map(e => `<li class="item" data-id="${esc(e.id)}"><span>${c.music && e.mb && e.mb.rg ? coverImg(e.mb.rg) : ""}</span><div><b>${esc(e.title)}</b>${f.subtitle ? (e.subtitle ? `, <i>${esc(e.subtitle)}</i>${c.music && e.mb && e.mb.y ? ` <span class="hint">(${esc(e.mb.y)})</span>` : ""}` : c.music ? ` <button class="btn ghost sm" data-act="mb-open">préciser ${esc(f.subtitle.toLowerCase())}</button>` : ` <span class="hint">${esc(f.subtitle.toLowerCase())} à préciser</span>`) : ""}${f.tag && e.tag ? ` <span class="tag">${esc(e.tag)}</span>` : ""}${f.due && e.due ? ` <span class="hint">${c.review ? "à réexaminer le " : ""}${fmt(e.due)}</span>` : ""}${f.text && e.text ? `<div class="note" style="margin:2px 0 0">${esc(e.text)}</div>` : ""}${reviewedHTML(e) || e.origin || e.src ? `<div class="meta">${srcMeta(e)}${reviewedHTML(e)}${originHTML(e, e.title)}</div>` : ""}${c.sources && (e.links || []).length ? `<div class="meta src-docs">${e.links.map(l => `<span>${esc(LINK_TYPES[l.type])} ${refHTML(l.to)}</span>`).join("")}</div>` : ""}</div>
    <div class="row"><select data-act="col-st" aria-label="${esc(c.statusLabel)}">${c.statuses.map(st => `<option ${st === e.status ? "selected" : ""}>${esc(st)}</option>`).join("")}</select><button class="btn ghost sm ra" data-act="specimen">fiche</button>${c.music ? `<button class="btn ghost sm ra" data-act="mb-open">discographie</button>` : ""}${c.sources ? `<button class="btn ghost sm ra" data-act="src-link">documente…</button>` : ""}<button class="btn ghost sm ra" data-act="col-edit">modifier</button><button class="btn ghost sm ra" data-act="col-del">suppr.</button></div></li>`).join("") + pg.more)(paged(`col:${id}`, shown)) || `<li class="empty">Rien dans ce filtre.</li>`}</ul></div><div>${panel}</div></div></div>`;
  },
  settings: (id, { config: c }) => {
    const f = c.fields, fid = esc(id);
    const field = (k, l, hint) => `<label>${l}<input data-set-mod="${fid}.fields.${k}" value="${esc(f[k])}" placeholder="${hint}" ${k === "title" ? "required" : ""}></label>`;
    return `<div class="field-row"><label>Affichage<select data-set-mod="${fid}.display"><option value="liste" ${c.display === "liste" ? "selected" : ""}>Liste filtrable</option><option value="colonnes" ${c.display === "colonnes" ? "selected" : ""}>Colonnes (une par statut)</option></select></label><label>Bouton d'ajout<input data-set-mod="${fid}.addLabel" value="${esc(c.addLabel)}" required></label></div>
    <div class="field-row" style="margin-top:8px"><label>Description<input data-set-mod="${fid}.description" value="${esc(c.description)}" placeholder="Une phrase sous le titre"></label><label>Nom des statuts<input data-set-mod="${fid}.statusLabel" value="${esc(c.statusLabel)}" required></label></div>
    <p class="hint" style="margin:12px 0 4px">Champs d'un élément. Laisser un nom vide masque le champ.</p>
    <div class="field-row">${field("title", "Titre", "Titre")}${field("subtitle", "Sous-titre", "(masqué)")}</div>
    <div class="field-row" style="margin-top:8px">${field("tag", "Étiquette (sert au regroupement)", "(masquée)")}${field("due", "Date", "(masquée)")}</div>
    <div class="field-row" style="margin-top:8px">${field("text", "Texte long", "(masqué)")}<span></span></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">${esc(c.statusLabel)}s, dans l'ordre</span>${c.statuses.map((st, i) => `<div class="set" data-si="${i}" style="grid-template-columns:1fr auto"><input data-act="st-name" data-mod="${fid}" value="${esc(st)}" aria-label="Nom du statut"><div class="row"><button class="btn ghost sm" data-act="st-up" data-mod="${fid}" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="st-del" data-mod="${fid}">suppr.</button></div></div>`).join("")}<button class="btn sm" data-act="st-add" data-mod="${fid}" style="margin-top:8px">Ajouter un statut</button></div>
    <div class="field-row" style="margin-top:10px"><label>Compte comme fait à partir de<select data-act="col-done" data-mod="${fid}">${c.statuses.map((st, i) => i ? `<option value="${i}" ${c.doneFrom === i ? "selected" : ""}>${esc(st)}</option>` : "").join("")}</select></label><span></span></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-weight:400"><input type="checkbox" data-act="col-concordance" data-mod="${fid}" ${c.concordance ? "checked" : ""}>Concordance : chaque élément est un motif, compté dans les textes de tous les autres modules (variantes dans le sous-titre)</label>
    ${c.concordance ? `<div class="field-row" style="margin-top:8px"><label>En jachère après (jours d'absence)<input type="number" min="1" max="3650" data-set-mod="${fid}.fallowDays" value="${esc(c.fallowDays)}"></label><span></span></div>` : ""}
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-weight:400"><input type="checkbox" data-act="col-music" data-mod="${fid}" ${c.music ? "checked" : ""}>Musique : le titre est un artiste, le sous-titre un album, précisés par MusicBrainz (discographie, pochettes, nouvelles sorties)</label>
    <div style="margin-top:12px"><label class="btn sm" style="display:inline-block;font-weight:500">Importer un export Instagram<input type="file" accept="application/json,.json" multiple data-act="col-ig" data-mod="${fid}" style="display:none"></label>
      <p class="hint" style="margin:4px 0 0">Import manuel de tes publications : aucune connexion à Instagram, aucune synchronisation automatique. Choisis le compte voulu lors de l’export Meta. Pour plusieurs comptes, crée une collection par compte et donne-lui son nom ; les archives ne sont pas vérifiées par compte. Légende et date uniquement (pas de lien, l’export n’en contient pas). Centre de comptes Meta → Tes informations et autorisations → Télécharger tes informations, format JSON ; puis <code>posts_1.json</code> et <code>reels.json</code> (dossier <code>your_instagram_activity/media</code>). Le fichier est lu sur cet appareil ; les publications importées sont ensuite enregistrées dans ton espace et suivent sa synchronisation. Un second import dans la même collection n’ajoute que les nouvelles.</p></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-weight:400"><input type="checkbox" data-act="col-review" data-mod="${fid}" ${c.review ? "checked" : ""}>La date est un rendez-vous de révision : elle revient sur l'accueil quel que soit le ${esc(c.statusLabel.toLowerCase())}, sauf le dernier</label>`;
  },
  accept: (id, inst, note) => { saveCollectionItem(inst, { title: note.text }, uid()); },
  recent: inst => inst.entries.slice(-3).reverse().map(e => `${e.title}${e.subtitle ? " – " + e.subtitle : ""} · ${e.status}`),
  // Sans date de changement de statut, le bilan ne peut compter que ce qui était prévu dans la période.
  review: (inst, from, to) => {
    const c = inst.config;
    if (c.concordance) { const ms = motifsIn(inst, from, to); return ms.length ? ms.slice(0, 5).map(x => `${x.name} ×${x.n}`).join(", ") : "Aucun motif rencontré"; }
    if (!c.fields.due) return null;
    if (c.review) {
      const due = within(inst.entries, from, to, "due").filter(e => e.status !== c.statuses.at(-1)).length, done = inst.entries.flatMap(e => within(e.reviews || [], from, to)).length;
      return due || done ? `${due} à réexaminer, ${plural(done, "réexamen")} fait${done > 1 ? "s" : ""}` : "Rien à réexaminer";
    } const es = within(inst.entries, from, to, "due"); return es.length ? `${plural(es.length, "prévu")}, dont ${es.filter(e => c.statuses.indexOf(e.status) >= c.doneFrom).length} « ${c.statuses[c.doneFrom]} »` : "Rien de prévu"; },
  texts: inst => inst.entries.map(e => ({ text: [e.title, e.subtitle, e.tag, e.text, e.src && e.src.site, e.src && e.src.doi].filter(Boolean).join(" · "), date: e.due || null, eid: e.id })),
  // Ce qui est prévu aujourd'hui ou en retard, et pas encore « fait ».
  alerts: (id, inst, now) => {
    const c = inst.config; if (!c.fields.due) return [];
    // Mode révision : le rendez-vous revient quel que soit le statut, sauf le dernier ; relire la raison d'abord.
    if (c.review) return inst.entries.filter(e => e.due && e.due <= now && e.status !== c.statuses.at(-1)).map(e => ({
      text: `« ${esc(e.title)} » : à réexaminer (${esc(label(id))})`,
      actions: `<button class="btn sm" data-act="col-reread" data-mod="${esc(id)}" data-id="${esc(e.id)}">relire</button><button class="btn ghost sm" data-act="col-keep" data-mod="${esc(id)}" data-id="${esc(e.id)}">maintenue</button>` }));
    return inst.entries.filter(e => e.due && e.due <= now && c.statuses.indexOf(e.status) < c.doneFrom).map(e => ({
      text: `« ${esc(e.title)} » : ${e.due < now ? "en retard" : "prévu aujourd'hui"} (${esc(label(id))})`, href: `#${id}` }));
  },
  summary: (id, inst) => isConcordance(inst) ? concordanceSummary(inst) : inst.config.statuses.map(st => [st, inst.entries.filter(e => e.status === st).length]).filter(([, n]) => n).map(([st, n]) => `${esc(st)} : ${n}`).join(", ") || "Vide",
  context(inst, nm) {
    const c = inst.config;
    return `\n${nm}${c.description ? ` (${c.description})` : ""} : ${inst.entries.map(e => `${e.title}${e.subtitle ? " – " + e.subtitle : ""} [${e.status}${e.tag ? ", " + e.tag : ""}${e.due ? ", " + e.due : ""}]`).join(" ; ") || "vide"}`;
  },
  grouper(inst) {
    const c = inst.config, fields = Object.fromEntries(["tag", "title", "subtitle"].filter(k => c.fields[k]).map(k => [k, c.fields[k]]));
    return { fields, renamable: Object.keys(fields), filterable: true, items: () => inst.entries, key: (e, k) => e[k], store: () => site,
      groups: k => itemGroups(inst.entries, e => e[k], e => c.statuses.indexOf(e.status) >= c.doneFrom) };
  },
  click: {
    "col-new": el => collectionForm(modOf(el), null),
    "col-edit": el => collectionForm(modOf(el), itemOf(el)),
    "col-reread": el => { const e = itemOf(el); if (e) collectionForm(modOf(el), e); },
    // Réexaminée, rien ne change : noté, et le rendez-vous est levé (« Annuler » le remet).
    "col-keep": el => {
      const id = modOf(el), e = itemOf(el); if (!e) return;
      const due = e.due, itemId = e.id;
      e.reviews = [...(e.reviews || []), { date: todayISO(), verdict: "maintenue" }]; e.due = ""; site.save(); render();
      toastUndo("Maintenue. La raison d'alors tient encore.", () => {
        const cur = S().modules[id] && S().modules[id].entries.find(x => x.id === itemId); if (!cur) return;
        cur.due = due; cur.reviews = (cur.reviews || []).slice(0, -1); site.save(); render();
      });
    },
    "col-del": el => removeWithUndo(modOf(el), "entries", idOf(el)),
    "col-move": el => { const e = itemOf(el), c = S().modules[modOf(el)].config; if (e) moveCardTo(modOf(el), e.id, c.statuses.indexOf(e.status) + +el.dataset.d); },
    "col-tab": el => { colTab[modOf(el)] = +el.dataset.i; render(); },
    "st-add": el => { const c = instOf(el).config; if (c.statuses.length >= 12) return toast("Douze statuts. Au-delà, ce n'est plus un suivi, c'est une bureaucratie."); c.statuses.push(`Statut ${c.statuses.length + 1}`); site.save(); render(); },
    "st-up": el => {
      const c = instOf(el).config, a = c.statuses, i = +el.closest("[data-si]").dataset.si;
      if (i <= 0) return;
      const done = a[c.doneFrom]; // le seuil « fait » suit son statut, pas sa position
      [a[i - 1], a[i]] = [a[i], a[i - 1]];
      c.doneFrom = Math.min(a.length - 1, Math.max(1, a.indexOf(done)));
      site.save(); render();
    },
    "st-del": async el => {
      const inst = instOf(el), c = inst.config, i = +el.closest("[data-si]").dataset.si, st = c.statuses[i];
      if (c.statuses.length <= 2) return toast("Deux statuts minimum : sinon rien ne peut avancer.");
      const n = inst.entries.filter(e => e.status === st).length, to = c.statuses[i === 0 ? 1 : i - 1];
      if (!await ask(`Supprimer le statut « ${st} » ?${n ? ` Ses ${n} élément(s) passeront à « ${to} ».` : ""}`)) return;
      inst.entries.forEach(e => { if (e.status === st) e.status = to; });
      c.statuses.splice(i, 1); c.doneFrom = Math.min(c.statuses.length - 1, Math.max(1, c.doneFrom - (i < c.doneFrom ? 1 : 0)));
      site.save(); render();
    }
  },
  change: {
    "col-f": el => { colFilter[modOf(el)] = el.value; render(); },
    "col-st": el => { itemOf(el).status = el.value; site.save(); render(); },
    "col-done": el => { instOf(el).config.doneFrom = +el.value; site.save(); render(); },
    "col-review": el => { instOf(el).config.review = el.checked; site.save(); render(); },
    "col-concordance": el => { instOf(el).config.concordance = el.checked; site.save(); render(); },
    "col-music": el => { instOf(el).config.music = el.checked; site.save(); render(); },
    /* L'export Instagram : lu sur l'appareil, confirmé (combien, de quand à quand), versé au dernier statut. */
    "col-ig": async el => {
      const mod = modOf(el), files = [...(el.files || [])]; el.value = ""; if (!files.length) return;
      let posts = [], bad = 0;
      for (const f of files) { try { posts = posts.concat(igPosts(JSON.parse(await f.text()))); } catch { bad++; } }
      const inst = S().modules[mod], have = new Set(inst.entries.filter(e => e.ig).map(e => `${e.ig.k}:${e.ig.t}`)), seen = new Set();
      const fresh = posts.filter(p => { const k = `${p.k}:${p.t}`; if (have.has(k) || seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.t - b.t);
      if (!fresh.length) return toast(bad === files.length ? "Ce fichier n'est pas un export Instagram lisible (JSON)." : posts.length ? "Rien de nouveau : tout est déjà là." : "Aucune publication dans ce fichier. C'est posts_1.json ou reels.json qu'il faut.");
      const c = inst.config, last = c.statuses[c.statuses.length - 1], day = t => fmt(igDay(t), { day: "numeric", month: "long", year: "numeric" });
      const q = `Importer ${fresh.length} publication${fresh.length > 1 ? "s" : ""} (du ${day(fresh[0].t)} au ${day(fresh[fresh.length - 1].t)}) dans ${label(mod)}, au statut « ${last} » ?${posts.length > fresh.length ? ` ${posts.length - fresh.length} déjà là, ignorée${posts.length - fresh.length > 1 ? "s" : ""}.` : ""}`;
      if (!await ask(q)) return;
      for (const p of fresh) { const x = igEntry(p), n = saveCollectionItem(inst, { title: x.title, text: x.text, due: x.due, status: last }, uid()); n.ig = x.ig; }
      site.save(); render(); toast(`${fresh.length} publication${fresh.length > 1 ? "s" : ""} importée${fresh.length > 1 ? "s" : ""} dans ${label(mod)}.`);
    },
    "st-name": el => {
      const inst = instOf(el), c = inst.config, i = +el.closest("[data-si]").dataset.si, from = c.statuses[i], to = el.value.trim();
      if (!to || to === from) return render();
      if (c.statuses.includes(to)) { toast(`« ${to} » existe déjà.`); return render(); }
      c.statuses[i] = to; inst.entries.forEach(e => { if (e.status === from) e.status = to; });
      site.save(); el.blur(); render();
    }
  }
};
/* ---- tâches : échéances, lieux, étapes, coûts ; « Aujourd'hui » plafonné à trois, tous modules confondus ---- */
const taskModules = () => Object.keys(S().modules).filter(k => S().modules[k].type === "taches" && enabled(k));
const allTasks = () => taskModules().flatMap(id => S().modules[id].entries.map(t => [id, t]));
const todayTasks = () => allTasks().filter(([, t]) => !t.done && t.today);
const todayElsewhere = id => todayTasks().filter(([m]) => m !== id).length;
const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
const taskFilters = {}; // filtres par module : { room, cat } (propres à l'appareil, non enregistrés)
const tf = id => taskFilters[id] || (taskFilters[id] = { room: "", cat: "" });
const roomsOf = id => [...new Set(S().modules[id].entries.map(t => t.room).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const doneLines = ["Fait. Le monde s'effondre un peu moins vite.", "Un de moins. L'entropie note ta résistance.", "Coché. Personne n'applaudit, alors je le fais.", "Terminé. Ton futur toi te déteste un peu moins.", "Réglé. Le chaos recule d'un centimètre."];
let openId = null;
const taskOf = el => { const li = el.closest("[data-task]"), inst = li && S().modules[li.dataset.mod]; return (inst && inst.entries.find(t => t.id === li.dataset.task)) || null; };
const taskMod = el => el.closest("[data-task]").dataset.mod;
function dueLabel(t) {
  if (!t.due) return { txt: "Sans date", cls: "" };
  const n = diffDays(t.due, todayISO());
  if (n < 0) return { txt: `En retard de ${-n} j`, cls: "late" };
  if (n === 0) return { txt: "Aujourd'hui", cls: "late" };
  if (n === 1) return { txt: "Demain", cls: "soon" };
  if (n <= 7) return { txt: `Dans ${n} j`, cls: "soon" };
  return { txt: fmt(t.due), cls: "" };
}
/* Une tâche à ciel ouvert (un des mots réglés dans son titre ou son lieu) : la pluie des cinq prochains jours, lue dans
   la prévision déjà gardée par la Fenêtre (aucun appel de plus). Sans lieu réglé ou sans météo : rien. */
function outdoorRain(c, t) {
  if (t.done) return "";
  const words = String(c.outdoor || "").split(",").map(w => fold(w.trim())).filter(w => w.length > 1), f = fold(`${t.title} ${t.room || ""}`);
  if (!words.some(w => f.includes(w))) return "";
  const sc = skyConf(), w = sc && sc.weather !== false ? freshWeather(sc) : null;
  if (!w || !Array.isArray(w.days) || !w.days.length) return "";
  const today = todayISO(), rain = rainDays(w.days, today, 5), day = d => fmt(d, { weekday: "short", day: "numeric" });
  const tip = `title="Prévision Open-Meteo pour ${esc(sc.name)}, cinq jours"`;
  if (!rain.length) return `<span class="wx" ${tip}>sec jusqu'à ${esc(day(addDaysTo(today, 4)))}</span>`;
  return `<span class="wx rain" ${tip}>pluie prévue ${esc(rain.map(day).join(", "))}${t.due && rain.includes(t.due) ? ", le jour prévu" : ""}</span>`;
}
function taskHTML(id, t) {
  const c = S().modules[id].config, d = dueLabel(t), sd = (t.steps || []).filter(x => x.d).length, ef = Math.min(3, Math.max(1, Math.round(+t.effort) || 1));
  return `<li class="item ${t.done ? "done" : ""} ${openId === t.id ? "open" : ""}" data-task="${esc(t.id)}" data-mod="${esc(id)}">
    <input type="checkbox" class="check" data-act="task-done" ${t.done ? "checked" : ""} aria-label="Marquer comme fait">
    <div><button class="t-title" data-act="task-open">${esc(t.title)}</button>
      <div class="meta">${t.room ? `<span class="tag">${esc(t.room)}</span>` : ""}<span class="${t.done ? "" : d.cls}">${esc(d.txt)}</span><span>${esc(t.cat)}</span><span>${"●".repeat(ef)}${"○".repeat(3 - ef)}</span>${(t.steps || []).length ? `<span>${sd}/${t.steps.length} étapes</span>` : ""}${c.costs && t.cost ? `<span>${esc(t.cost)} €</span>` : ""}${outdoorRain(c, t)}</div></div>
    <button class="star ${t.today ? "on" : ""}" data-act="task-today" title="Faire aujourd'hui" aria-label="Faire aujourd'hui">★</button>
    <div class="details">
      ${(t.steps || []).length ? `<ul class="steps">${t.steps.map((x, i) => `<li><input type="checkbox" data-act="task-step" data-i="${i}" ${x.d ? "checked" : ""} id="s${esc(t.id)}-${i}"><label for="s${esc(t.id)}-${i}" style="font-weight:400;display:inline">${esc(x.t)}</label></li>`).join("")}</ul>` : ""}
      ${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}${t.origin ? `<p class="meta">${originHTML(t, t.title)}</p>` : ""}
      <div class="row"><button class="btn ghost sm" data-act="task-edit">Modifier</button><button class="btn ghost sm" data-act="task-del">Supprimer</button></div>
    </div></li>`;
}
function taskForm(id, t) {
  const c = S().modules[id].config;
  $("#roomList").innerHTML = roomsOf(id).map(r => `<option value="${esc(r)}">`).join("");
  openForm(t ? "Modifier la tâche" : "Nouvelle tâche", [
    { n: "title", l: "Tâche", req: true },
    { row: [{ n: "room", l: c.groupLabel, list: "roomList" }, { n: "cat", l: c.catLabel, t: "select", o: !t || !t.cat || c.cats.includes(t.cat) ? c.cats : [...c.cats, t.cat] }] },
    { row: [{ n: "due", l: "Date butoir", t: "date" }, { n: "effort", l: "Effort", t: "select", o: [["1", "Petit, moins de 30 min"], ["2", "Moyen, une demi-journée"], ["3", "Gros, un week-end"]] }] },
    ...(c.costs ? [{ n: "cost", l: "Coût estimé (€)", t: "number" }] : []),
    { n: "steps", l: "Étapes (une par ligne)", t: "textarea", rows: 4 },
    { n: "note", l: "Note", t: "textarea", rows: 2 }
  ], t ? { ...t, effort: String(t.effort), steps: (t.steps || []).map(x => x.t).join("\n") } : { room: tf(id).room || (gcfg(id).by === "room" ? gFilter[id] || "" : ""), cat: c.cats[0], effort: "1" }, v => {
    const inst = S().modules[id]; // relu : une synchro a pu remplacer les données pendant la saisie
    if (!inst) return toast("Ce module a été supprimé entre-temps.");
    const lines = v.steps.split("\n").map(x => x.trim()).filter(Boolean);
    const data = { title: v.title, room: v.room, cat: v.cat, due: v.due || null, effort: +v.effort, cost: "cost" in v ? (v.cost ? +v.cost : null) : (t ? t.cost : null), note: v.note }; // champ absent (coûts désactivés) ≠ champ vidé
    const cur = t && inst.entries.find(x => x.id === t.id);
    if (!cur) addTask(inst.entries, { ...data, steps: lines.map(l => ({ t: l, d: false })) }, uid(), todayISO());
    else { const old = new Map((cur.steps || []).map(x => [x.t, x.d])); Object.assign(cur, data, { steps: lines.map(l => ({ t: l, d: old.get(l) || false })) }); }
    site.save(); render();
  });
}
/* Enveloppe où vont les coûts d'un module de tâches : celle réglée, sinon une enveloppe « Travaux », sinon aucune. */
function costEnvelope(id, bud) {
  const c = S().modules[id].config, envs = bud ? S().modules[bud].config.envelopes : [];
  return c.costEnvelope != null ? c.costEnvelope : ((envs.find(v => /travaux/i.test(v.name)) || {}).name || "");
}
/* Tirage au sort : dans un module (sa page) ou parmi tous (accueil), plafond de trois respecté. */
function pickTask(only) {
  if (todayTasks().length >= 3) return toast("Aujourd'hui est plein. Le hasard respecte les plafonds.");
  const o = allTasks().filter(([m, t]) => !t.done && !t.today && (!only || m === only));
  if (!o.length) return toast("Rien à tirer.");
  const small = o.filter(([, t]) => t.effort === 1), pool = (small.length ? small : o).sort(([, a], [, b]) => byDue(a, b)).slice(0, 5);
  const [id, t] = pool[Math.floor(Math.random() * pool.length)];
  setTaskToday(S().modules[id].entries, t.id, true, todayElsewhere(id)); site.save(); render();
  toast(`Le sort a désigné : « ${t.title} ». Pas de recours possible.`);
}
TYPE_UI.taches = {
  view(id) {
    const inst = S().modules[id], c = inst.config, now = todayISO(), o = inst.entries.filter(t => !t.done), f = tf(id);
    const tod = o.filter(t => t.today);
    const cats = [...new Set(inst.entries.map(t => t.cat))];
    // Une tâche du jour vit dans « Aujourd'hui », pas une seconde fois dans les échéances.
    const filtered = o.filter(t => !t.today && (!f.room || t.room === f.room) && (!f.cat || t.cat === f.cat) && gMatch(id, t)).sort(byDue);
    const groups = [
      ["En retard", "Le passé ne se repeint pas. Ça, si.", t => t.due && t.due < now, true],
      ["Cette semaine", "Assez proche pour paniquer utilement.", t => t.due && t.due >= now && diffDays(t.due, now) <= 7],
      ["Ce mois-ci", "Le problème de toi dans trois semaines.", t => t.due && diffDays(t.due, now) > 7 && diffDays(t.due, now) <= 31],
      ["Plus tard", "Hors de vue. Pas hors de ta vie.", t => t.due && diffDays(t.due, now) > 31],
      ["Sans date", "Les tâches sans date ne meurent jamais. Elles hantent.", t => !t.due]
    ].map(([n, h, fn, late]) => { const it = filtered.filter(fn); return it.length ? `<div style="margin-bottom:22px"><h3 class="${late ? "late" : ""}">${n} <span class="hint" style="font-size:1rem">${it.length}</span></h3><p class="hint">${h}</p><ul class="plain">${it.map(t => taskHTML(id, t)).join("")}</ul></div>` : ""; }).join("");
    const spent = inst.entries.filter(t => t.done && t.cost).reduce((a, t) => a + +t.cost, 0), left = o.filter(t => t.cost).reduce((a, t) => a + +t.cost, 0);
    const done = inst.entries.filter(t => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 8);
    return `<div data-mod="${esc(id)}"><div class="row" style="margin-bottom:24px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn solid" data-act="task-new">Ajouter une tâche</button><button class="btn" data-act="task-pick">Tirer au sort</button></div>
  <div class="two"><div>
    <section><h3>Aujourd'hui</h3><p class="hint">Trois tâches maximum, tous modules confondus. Au-delà, c'est une liste de reproches.</p><ul class="plain">${tod.map(t => taskHTML(id, t)).join("") || `<li class="empty">Coche l'étoile d'une tâche.</li>`}</ul></section>
    <section><div class="row" style="margin-bottom:12px"><h3 style="margin:0">Échéances</h3><span class="spacer"></span>
      <select data-act="f-room" aria-label="${esc(c.groupLabel)}"><option value="">${esc(c.groupLabel)} : tout</option>${roomsOf(id).map(r => `<option ${r === f.room ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select data-act="f-cat" aria-label="${esc(c.catLabel)}"><option value="">${esc(c.catLabel)} : tout</option>${cats.map(x => `<option ${x === f.cat ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      ${groups || `<p class="empty">Plus rien ici. Soit c'est fini, soit tu as filtré trop fort.</p>`}</section>
  </div><aside>
    ${groupPanel(id, "La mousse gagne à mesure que tu finis. Clique pour filtrer.")}
    ${c.costs && (spent || left) ? `<p class="hint">Budget estimé : ${spent} € engagés, ${left} € encore à prévoir.</p>` : ""}
    <section><h3>Fait récemment</h3><ul class="plain">${done.map(t => `<li class="item" data-task="${esc(t.id)}" data-mod="${esc(id)}"><span></span><div>${esc(t.title)}<div class="meta">${fmt(t.doneAt)}</div></div><button class="btn ghost sm" data-act="task-undo">annuler</button></li>`).join("") || `<li class="empty">Rien pour l'instant. L'histoire ne retiendra rien.</li>`}</ul></section>
  </aside></div></div>`;
  },
  settings: (id, { config: c }) => `<div class="field-row"><label>Nom du regroupement<input data-set-mod="${esc(id)}.groupLabel" value="${esc(c.groupLabel)}" placeholder="Pièce, lieu, client…" required></label><label>Nom des types<input data-set-mod="${esc(id)}.catLabel" value="${esc(c.catLabel)}" required></label></div>
    <label style="margin-top:8px;display:block">Tâches à ciel ouvert (mots dans le titre ou le lieu, séparés par des virgules)<input data-set-mod="${esc(id)}.outdoor" value="${esc(c.outdoor || "")}" placeholder="extérieur, balcon, jardin…" maxlength="300"></label>
    <p class="hint" style="margin:4px 0 0">Elles montrent la pluie des cinq prochains jours, si un lieu est réglé (Réglages → Ciel).</p>
    <div class="field-row" style="margin-top:8px"><label>Types de tâche (un par ligne)<textarea data-act="task-cats" data-mod="${esc(id)}" rows="4">${esc(c.cats.join("\n"))}</textarea></label>
    <label style="display:flex;gap:8px;align-items:center;align-self:start;margin-top:26px"><input type="checkbox" data-act="task-costs" data-mod="${esc(id)}" ${c.costs ? "checked" : ""}>Suivre les coûts estimés</label></div>
    ${c.costs && firstOfType("budget") ? `<div class="field-row" style="margin-top:8px"><label>Enveloppe du budget pour les coûts<input data-set-mod="${esc(id)}.costEnvelope" value="${esc(costEnvelope(id, firstOfType("budget")))}" list="env-${esc(id)}" placeholder="aucune"><datalist id="env-${esc(id)}">${S().modules[firstOfType("budget")].config.envelopes.map(v => `<option value="${esc(v.name)}">`).join("")}</datalist></label><span></span></div>` : ""}`,
  summary(id, inst) {
    const now = todayISO(), o = inst.entries.filter(t => !t.done), late = o.filter(t => t.due && t.due < now).length, all = inst.entries.length;
    return `${late ? `<span class="late">${late} en retard</span>, ` : ""}${o.length} à faire, ${all ? Math.round(100 * (all - o.length) / all) : 0} % fait`;
  },
  context(inst, nm) {
    const o = inst.entries.filter(t => !t.done).sort(byDue), c = inst.config;
    return `\n${nm} : ${o.length} tâches ouvertes sur ${inst.entries.length}.` + o.slice(0, 40).map(t => `\n- [${t.id}] ${t.title} | ${t.room || "?"} | ${t.due ? "échéance " + t.due : "sans date"}${t.today ? " | choisie pour aujourd'hui" : ""}${c.costs && t.cost ? " | " + t.cost + " €" : ""}`).join("");
  },
  grouper: (inst, id) => {
    const c = inst.config, fields = { room: c.groupLabel, cat: c.catLabel, effort: "Effort" };
    const key = (t, f) => f === "effort" ? ["", "Petit", "Moyen", "Gros"][t.effort || 1] : t[f];
    return { fields, renamable: ["room", "cat"], filterable: true, items: () => inst.entries, key, store: () => site,
      groups: f => itemGroups(inst.entries, t => key(t, f), t => t.done) };
  },
  recent: inst => inst.entries.filter(t => !t.done).sort(byDue).slice(0, 3).map(t => `${t.title} · ${dueLabel(t).txt}`),
  review: (inst, from, to) => { const done = within(inst.entries, from, to, "doneAt"), cost = done.reduce((a, t) => a + (+t.cost || 0), 0); return `${plural(done.length, "tâche")} terminée${done.length > 1 ? "s" : ""}${inst.config.costs && cost ? `, ${money(cost)} de coûts estimés` : ""}`; },
  texts: inst => inst.entries.map(t => ({ text: [t.title, t.room, t.note, ...(t.steps || []).map(x => x.t)].filter(Boolean).join(" · "), date: t.due || t.created, eid: t.id })),
  accept(id, inst, note) { const t = addTask(inst.entries, { title: note.text, cat: inst.config.cats[0] }, uid(), todayISO()); return () => taskForm(id, t); },
  click: {
    "task-open": el => { const t = taskOf(el); openId = openId === t.id ? null : t.id; render(); },
    "task-today": el => { const id = taskMod(el), t = taskOf(el); try { setTaskToday(S().modules[id].entries, t.id, !t.today, todayElsewhere(id)); } catch { return toast("Trois, c'est le plafond. Termine ou retire-en une."); } site.save(); render(); },
    "task-edit": el => taskForm(taskMod(el), taskOf(el)),
    "task-del": el => removeWithUndo(taskMod(el), "entries", taskOf(el).id),
    "task-undo": el => { setTaskDone(S().modules[taskMod(el)].entries, taskOf(el).id, false, todayISO()); site.save(); render(); },
    "task-new": el => taskForm(modOf(el), null),
    "task-pick": el => pickTask(el.closest("[data-mod]") ? modOf(el) : null)
  },
  change: {
    "task-done": el => {
      const id = taskMod(el), t = setTaskDone(S().modules[id].entries, taskOf(el).id, el.checked, todayISO()); site.save(); render();
      if (!el.checked) return;
      const bud = firstOfType("budget"), c = S().modules[id].config;
      if (!(c.costs && t.cost && bud)) return toast(doneLines[Math.floor(Math.random() * doneLines.length)]);
      // Proposer, jamais imposer : le coût estimé n'est pas forcément le coût réel.
      const env = costEnvelope(id, bud);
      toastAction(`Fait. ${money(t.cost)} estimés : les passer au budget${env ? ` (${env})` : ""} ?`, "Ajouter", () => {
        const b = S().modules[bud]; if (!b) return;
        addBudgetEntry(b.entries, { amount: +t.cost, type: "dépense", cat: env, note: t.title, date: todayISO() }, uid(), todayISO());
        site.save(); render(); toast(`Ajouté à ${label(bud)}. L'argent, lui, était déjà parti.`);
      }, 10000);
    },
    "task-step": el => { const t = taskOf(el); t.steps[+el.dataset.i].d = el.checked; site.save(); render(); },
    "f-room": el => { tf(modOf(el)).room = el.value; render(); },
    "f-cat": el => { tf(modOf(el)).cat = el.value; render(); },
    "task-cats": el => { const cats = [...new Set(el.value.split("\n").map(x => x.trim()).filter(Boolean))]; if (cats.length) instOf(el).config.cats = cats; site.save(); el.blur(); render(); },
    "task-costs": el => { instOf(el).config.costs = el.checked; site.save(); render(); }
  }
};

/* ---- budget : opérations, enveloppes à plafond mensuel ---- */
const budMonths = {}; // mois affiché, par module (propre à l'appareil, non enregistré)
const monthOf = id => budMonths[id] || (budMonths[id] = todayISO().slice(0, 7));
const inMonth = (inst, m) => inst.entries.filter(e => (e.date || "").slice(0, 7) === m);
const sumOf = (es, type) => es.filter(e => e.type === type).reduce((a, e) => a + (+e.amount || 0), 0);
TYPE_UI.budget = {
  view(id) {
    const inst = S().modules[id], m = monthOf(id), es = inMonth(inst, m), out = sumOf(es, "dépense"), inn = sumOf(es, "revenu");
    const shown = es.filter(e => gMatch(id, e)).sort((a, x) => x.date.localeCompare(a.date));
    const mLabel = new Date(m + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const tasksLeft = allTasks().filter(([m, t]) => !t.done && t.cost && S().modules[m].config.costs).reduce((a, [, t]) => a + +t.cost, 0);
    const defDate = m === todayISO().slice(0, 7) ? todayISO() : m + "-01";
    return `<div data-mod="${esc(id)}"><div class="row" style="margin-bottom:6px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span>
    <button class="btn ghost" data-act="bud-month" data-d="-1" aria-label="Mois précédent">‹</button><b style="min-width:9ch;text-align:center;text-transform:capitalize">${mLabel}</b><button class="btn ghost" data-act="bud-month" data-d="1" aria-label="Mois suivant">›</button></div>
  <div class="stats"><div><span>Revenus</span><b class="big pos">${money(inn)}</b></div><div><span>Dépenses</span><b class="big">${money(out)}</b></div><div><span>Solde</span><b class="big ${inn - out < 0 ? "neg" : "pos"}">${money(inn - out)}</b></div></div>
  <datalist id="envList">${inst.config.envelopes.map(v => `<option value="${esc(v.name)}">`).join("")}</datalist>
  <div class="row" style="margin-bottom:26px">
    <select id="bType" style="max-width:130px" aria-label="Type"><option>dépense</option><option>revenu</option></select>
    <input id="bAmt" type="number" step="0.01" min="0" placeholder="Montant" style="max-width:130px" inputmode="decimal" aria-label="Montant">
    <input id="bCat" list="envList" placeholder="Enveloppe" style="max-width:170px" aria-label="Enveloppe">
    <input id="bNote" placeholder="Note" style="max-width:220px" aria-label="Note">
    <input id="bDate" type="date" value="${defDate}" style="max-width:160px" aria-label="Date">
    <button class="btn acc" data-act="bud-add">Ajouter</button></div>
  <div class="two"><section><h3>Opérations</h3><p class="hint">L'argent ne disparaît pas, il change simplement de propriétaire.</p>
    <ul class="plain">${shown.map(e => `<li class="item" data-id="${esc(e.id)}"><span class="jdate">${fmt(e.date)}</span><div>${esc(e.note || e.cat || e.type)}<div class="meta">${e.cat ? `<span class="tag">${esc(e.cat)}</span>` : ""}</div></div><div class="row"><b class="${e.type === "revenu" ? "pos" : ""}">${e.type === "revenu" ? "+" : "−"}${money(e.amount)}</b><button class="btn ghost sm ra" data-act="bud-del">suppr.</button></div></li>`).join("") || `<li class="empty">Aucune opération ce mois-ci. Suspect.</li>`}</ul></section>
  <div>${groupPanel(id, "Part de chaque enveloppe mensuelle déjà consommée. Le rouge signale le dépassement.")}
    ${tasksLeft ? `<p class="hint">Les tâches en cours estiment encore ${money(tasksLeft)} de dépenses à venir.</p>` : ""}</div></div></div>`;
  },
  settings: (id, { config: c }) => `<div><span class="hint" style="margin:0">Enveloppes mensuelles</span>${c.envelopes.map((v, i) => `<div class="set" data-vi="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="env-name" data-mod="${esc(id)}" value="${esc(v.name)}" aria-label="Nom de l'enveloppe"><input type="number" min="0" data-act="env-limit" data-mod="${esc(id)}" value="${esc(v.limit || "")}" placeholder="€ / mois" aria-label="Plafond mensuel"><button class="btn ghost sm" data-act="env-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}<button class="btn sm" data-act="env-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter une enveloppe</button></div>`,
  recent: inst => recentBy(inst.entries).map(e => `${fmt(e.date)} · ${e.note || e.cat || e.type} · ${e.type === "revenu" ? "+" : "−"}${money(e.amount)}`),
  review: (inst, from, to) => { const es = within(inst.entries, from, to), out = sumOf(es, "dépense"), inn = sumOf(es, "revenu"); return `${money(out)} dépensés, ${money(inn)} reçus, solde ${money(inn - out)}`; },
  texts: inst => inst.entries.filter(e => e.note || e.cat).map(e => ({ text: [e.note, e.cat, money(e.amount)].filter(Boolean).join(" · "), date: e.date, eid: e.id })),
  summary(id, inst) {
    const es = inMonth(inst, todayISO().slice(0, 7)), out = sumOf(es, "dépense"), bal = sumOf(es, "revenu") - out;
    return `Ce mois-ci : ${money(out)} dépensés, solde <span class="${bal < 0 ? "neg" : "pos"}">${money(bal)}</span>`;
  },
  context(inst, nm) {
    const mo = todayISO().slice(0, 7), es = inMonth(inst, mo);
    return `\n${nm} (${mo}) : dépenses ${sumOf(es, "dépense")} €, revenus ${sumOf(es, "revenu")} €. Enveloppes : ${TYPE_UI.budget.envelopeGroups(inst, mo).map(g => `${g.name} ${g.sub}`).join(" ; ")}`;
  },
  // Consommation de chaque enveloppe sur un mois ; les dépenses hors enveloppe connue forment leur propre groupe.
  envelopeGroups(inst, m) {
    const sums = new Map();
    inMonth(inst, m).filter(e => e.type === "dépense").forEach(e => { const k = e.cat || "Sans enveloppe"; sums.set(k, (sums.get(k) || 0) + (+e.amount || 0)); });
    const out = inst.config.envelopes.map((v, i) => { const s = sums.get(v.name) || 0; sums.delete(v.name); return { name: v.name, num: s, den: +v.limit || 0, pct: +v.limit ? Math.round(100 * s / v.limit) : null, sub: `${money(s)} sur ${money(v.limit)}`, order: i }; });
    for (const [n, s] of sums) out.push({ name: n, num: s, den: 0, pct: null, sub: money(s), order: 900 });
    return out;
  },
  grouper: (inst, id) => ({
    fields: { cat: "Enveloppe" }, renamable: ["cat"], filterable: true,
    items: () => inst.entries, key: e => e.cat || "Sans enveloppe", store: () => site,
    groups: () => TYPE_UI.budget.envelopeGroups(inst, monthOf(id)),
    rename: (from, to) => inst.config.envelopes.forEach(v => { if (v.name === from) v.name = to; })
  }),
  click: {
    "bud-month": el => { const id = modOf(el), [y, mo] = monthOf(id).split("-").map(Number), d = new Date(y, mo - 1 + +el.dataset.d, 15); budMonths[id] = iso(d).slice(0, 7); gFilter[id] = ""; render(); },
    "bud-add": el => {
      const amt = Math.abs(+$("#bAmt").value); if (!Number.isFinite(amt) || !amt) return toast("Un montant, même symbolique.");
      try { addBudgetEntry(S().modules[modOf(el)].entries, { amount: amt, type: $("#bType").value, cat: $("#bCat").value.trim(), note: $("#bNote").value.trim(), date: $("#bDate").value }, uid(), todayISO()); } catch (e) { return toast(e.message); }
      ["#bAmt", "#bNote"].forEach(q => $(q).value = ""); site.save(); render();
    },
    "bud-del": el => removeWithUndo(modOf(el), "entries", idOf(el)),
    "env-add": el => { instOf(el).config.envelopes.push({ id: uid(), name: "Nouvelle enveloppe", limit: 100 }); site.save(); render(); },
    "env-del": async el => { const c = instOf(el).config, i = +el.closest("[data-vi]").dataset.vi; if (await ask(`Supprimer l'enveloppe « ${c.envelopes[i].name} » ? Les opérations restent.`)) { c.envelopes.splice(i, 1); site.save(); render(); } }
  },
  change: {
    "env-name": el => { const inst = instOf(el), v = inst.config.envelopes[+el.closest("[data-vi]").dataset.vi], to = el.value.trim(); if (to && to !== v.name) { inst.entries.forEach(e => { if (e.cat === v.name) e.cat = to; }); v.name = to; } site.save(); el.blur(); render(); },
    "env-limit": el => { instOf(el).config.envelopes[+el.closest("[data-vi]").dataset.vi].limit = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
  }
};

/* ---- notes : textes datés ; l'une des boîtes reçoit la capture rapide de l'accueil ---- */
/* Trois motifs reconnus à la capture, pas davantage, pour rester prévisible :
     « 12 € courses »          → une dépense dans le premier budget (enveloppe devinée d'après le texte)
     « 25 min kundalini »      → une séance dans le protocole nommé
     « phidippus : une note »  → la note rangée dans le module nommé
   La note part toujours d'abord dans la boîte : reconnaître ne fait que proposer un rangement. */
function captureIntent(text) {
  const s = S(), t = String(text).trim();
  const mods = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id)).map(m => ({ id: m.id, inst: s.modules[m.id], name: fold(label(m.id)) }));
  let m = t.match(/^(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:os?)?\b)\s*(.*)$/i);
  const bud = firstOfType("budget");
  if (m && bud && +m[1].replace(",", ".") > 0) {
    const amount = +m[1].replace(",", "."), rest = m[2].trim(), env = rest && s.modules[bud].config.envelopes.find(v => fold(rest).includes(fold(v.name)));
    return { to: bud, kind: "budget", amount, note: rest, cat: env ? env.name : "", say: `${money(amount)} en dépense dans ${label(bud)}${env ? ` (${env.name})` : ""}` };
  }
  m = t.match(/^(\d+)\s*min(?:utes?)?\s+(.+)$/i);
  if (m) {
    const target = mods.find(x => x.inst.type === "programme" && fold(m[2]).includes(x.name));
    if (target) return { to: target.id, kind: "minutes", value: +m[1], say: `${m[1]} min dans ${label(target.id)}` };
  }
  m = t.match(/^([^:]{2,40}?)\s*:\s*(.+)$/);
  if (m) {
    const target = mods.find(x => x.name === fold(m[1].trim())), ui = target && TYPE_UI[target.inst.type];
    if (target && ui.accept && (!ui.canAccept || ui.canAccept(target.inst)))
      return { to: target.id, kind: "accept", text: m[2].trim(), say: `« ${m[2].trim().slice(0, 40)} » dans ${label(target.id)}` };
  }
  return null;
}
/* Range une note de la boîte selon un motif reconnu, puis l'en retire. */
function fileIntent(intent, fromId, noteId) {
  const s = S(), src = s.modules[fromId], note = src && src.entries.find(x => x.id === noteId), target = s.modules[intent.to];
  if (!note || !target || intent.to === fromId) return;
  let then;
  if (intent.kind === "budget") addBudgetEntry(target.entries, { amount: intent.amount, type: "dépense", cat: intent.cat, note: intent.note, date: note.date }, uid(), todayISO());
  else if (intent.kind === "minutes") addJournalEntry(target, { date: note.date, value: intent.value }, uid(), todayISO());
  else then = acceptNote(intent.to, fromId, note, intent.text);
  src.entries = src.entries.filter(x => x.id !== noteId); site.save(); render();
  if (typeof then === "function") then(); else toast(`Rangé : ${intent.say}.`);
}
/* Confie une note à un autre module ; ce qui en naît garde sa provenance (et son statut, là où il se lit). */
function acceptNote(toId, fromId, note, text = note.text) {
  const target = S().modules[toId], before = entryIds(target);
  const then = TYPE_UI[target.type].accept(toId, target, { ...note, text });
  const born = stampOrigin(target, before, note, label(fromId));
  if (born.length) retargetLinks(S().modules, `${fromId}/${note.id}`, `${toId}/${born[0].id}`); // les liens la suivent
  return then;
}
/* Saisie d'une note : un « ? » en tête la range parmi les hypothèses. */
function addNote(inst, raw) {
  const p = epPrefix(raw), item = addCapture(inst.entries, p.text, uid(), todayISO());
  if (p.ep) item.ep = p.ep;
  return item;
}
/* Après une capture : proposer le rangement reconnu, sinon le message habituel. */
function afterCapture(boxId, item, fallback) {
  const intent = captureIntent(item.text);
  if (intent && intent.to !== boxId) toastAction(`${intent.say} ?`, "Ranger", () => fileIntent(intent, boxId, item.id), 10000);
  else if (item.ep) toast("Gardé comme hypothèse. Elle attendra ses preuves.");
  else if (fallback) toast(fallback);
}
/* Où une note peut être rangée : les modules actifs qui savent la recevoir, dans l'ordre de la navigation.
   Un type peut renvoyer une suite à donner (le formulaire d'une tâche, pour la compléter). */
function noteTargets(fromId) {
  const s = S();
  return s.config.modules.filter(m => m.on && m.id !== fromId).map(m => m.id).filter(id => {
    const inst = Object.hasOwn(s.modules, id) ? s.modules[id] : null, ui = inst && TYPE_UI[inst.type];
    return ui && ui.accept && (!ui.canAccept || ui.canAccept(inst));
  });
}
TYPE_UI.notes = {
  view(id) {
    const inst = S().modules[id], c = inst.config, targets = noteTargets(id);
    return `<div data-mod="${esc(id)}"><div class="row" style="align-items:baseline"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span>${c.inbox && inst.entries.length > 1 ? `<button class="btn sm" data-act="vasculum">Trier une à une</button>` : ""}</div>${c.description ? `<p class="hint">${esc(c.description)}</p>` : ""}
  ${deriveBanner(id)}<div class="capture" style="margin-bottom:18px"><input id="noteIn" data-draft placeholder="${esc(c.placeholder)}" aria-label="Nouvelle note"><button class="btn acc" data-act="note-add">Garder</button></div>
  <ul class="plain margins">${(pg => pg.items.map(x => { const intent = captureIntent(x.text); return `<li class="item" data-id="${esc(x.id)}"><span class="jdate">${fmt(x.date)}</span><div>${esc(x.text)}<div class="meta">${epSelect(id, x)}${linksHTML(id)}</div>
    ${intent && intent.to !== id ? `<div class="row" style="margin-top:6px"><button class="btn sm acc" data-act="note-file">Ranger : ${esc(intent.say)}</button></div>` : ""}
    ${sourcesModule() && (findDoi(x.text) || findUrl(x.text)) ? `<div class="row" style="margin-top:6px"><button class="btn sm" data-act="note-source">Garder comme source</button></div>` : ""}
    ${targets.length ? `<div class="row${c.inbox ? "" : " ra"}" style="margin-top:6px">${targets.map(k => `<button class="btn sm" data-act="note-to" data-to="${esc(k)}">→ ${esc(label(k))}</button>`).join("")}</div>` : ""}</div>
    ${margHTML(id, x, x.text)}<button class="btn ghost sm ra" data-act="note-del">suppr.</button></li>`; }).join("") + pg.more)(paged(`notes:${id}`, [...inst.entries].reverse())) || `<li class="empty">${c.inbox ? "Vide. Le silence d'une clairière, ou celui d'un cerveau." : "Rien pour l'instant."}</li>`}</ul></div>`;
  },
  settings: (id, { config: c }) => `<label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="notes-inbox" data-mod="${esc(id)}" ${c.inbox ? "checked" : ""}>Boîte de réception : reçoit la capture rapide de l'accueil</label>
    <div class="field-row" style="margin-top:8px"><label>Description<input data-set-mod="${esc(id)}.description" value="${esc(c.description)}" placeholder="Une phrase sous le titre"></label><label>Texte d'invite<input data-set-mod="${esc(id)}.placeholder" value="${esc(c.placeholder)}" required></label></div>`,
  summary: (id, inst) => inst.config.inbox ? `${inst.entries.length} à trier` : plural(inst.entries.length, "note"),
  context: (inst, nm) => `\n${nm}${inst.config.inbox ? " (à trier)" : ""} : ${inst.entries.map(x => x.text).join(" ; ") || "vide"}`,
  badge: inst => inst.config.inbox ? inst.entries.length : 0,
  recent: inst => inst.entries.slice(-3).reverse().map(x => x.text.length > 80 ? x.text.slice(0, 80) + "…" : x.text),
  review: (inst, from, to) => plural(within(inst.entries, from, to).length, "note"),
  texts: inst => inst.entries.map(x => ({ text: x.text, date: x.date, ep: x.ep, eid: x.id })),
  accept: (id, inst, note) => { addCapture(inst.entries, note.text, uid(), note.date); },
  click: {
    "note-add": el => {
      const inp = $("#noteIn"); if (!inp || !inp.value.trim()) return;
      const id = modOf(el), item = addNote(S().modules[id], inp.value), derived = applyDerive(id, item); inp.value = ""; site.save(); render();
      if (derived) toast(derived > 1 ? "Synthèse gardée. La tension est levée." : "Dérivé, et relié à sa source."); else afterCapture(id, item);
    },
    "note-file": el => { const id = modOf(el), note = S().modules[id].entries.find(x => x.id === idOf(el)), intent = note && captureIntent(note.text); if (intent) fileIntent(intent, id, note.id); },
    "note-del": el => removeWithUndo(modOf(el), "entries", idOf(el)),
    "note-to": el => {
      const s = S(), src = s.modules[modOf(el)], note = src.entries.find(x => x.id === idOf(el)), to = el.dataset.to;
      const drop = () => { src.entries = src.entries.filter(x => x !== note); site.save(); };
      const then = acceptNote(to, modOf(el), note);
      drop(); render();
      if (typeof then === "function") then(); else toast(`Rangé dans ${label(to)}.`);
    }
  },
  change: {
    "notes-inbox": el => {
      const id = el.dataset.mod;
      for (const [k, inst] of Object.entries(S().modules)) if (inst.type === "notes") inst.config.inbox = el.checked ? k === id : (k === id ? false : inst.config.inbox);
      site.save(); render();
    }
  }
};
/* Liaisons, communes aux fragments et aux notes (l'entrée est cherchée par sa référence « module/id »). */
CLICK["derive-start"] = el => {
  const mod = el.dataset.mod, id = idOf(el); if (!refFind(`${mod}/${id}`)) return;
  deriveFrom[mod] = [`${mod}/${id}`]; closeSheet(); // depuis une fiche : on va écrire dans l'espace de l'entrée
  if (routeOf().view !== mod) { location.hash = mod; return; }
  render();
  const inp = $("#scrapIn") || $("#noteIn"); if (inp) inp.focus();
};
CLICK["derive-cancel"] = el => { delete deriveFrom[el.dataset.mod]; render(); };
CLICK["link-form"] = el => linkForm(el.dataset.mod, idOf(el));
/* Résoudre une tension : écrire, dans le module de la première entrée, une synthèse qui dérive des deux. */
CLICK["tension-resolve"] = el => {
  const a = el.dataset.a, b = el.dataset.b, hit = refFind(a); if (!hit) return;
  deriveFrom[hit.mod] = [a, b];
  if (location.hash === "#" + hit.mod) render(); else location.hash = hit.mod;
};
/* Dossier d'une tension : les deux entrées, puis leur voisinage direct (ce qui les lie ou les vise). */
CLICK["tension-dossier"] = el => {
  const refs = [el.dataset.a, el.dataset.b], seen = new Set(refs);
  for (const it of thoughtItems()) for (const l of it.e.links || []) {
    if (refs.includes(it.ref) && !seen.has(l.to)) seen.add(l.to);
    if (refs.includes(l.to) && !seen.has(it.ref)) seen.add(it.ref);
  }
  const items = [...seen].map(refFind).filter(Boolean).map(h => ({ mod: h.mod, text: h.e.text, date: h.e.date, e: h.e }));
  if (items.length < 2) return toast("L'une des deux entrées a disparu.");
  dossierFile(`Tension — ${excerpt(items[0].e, 40)}`, `« ${excerpt(items[0].e, 80)} » contredit « ${excerpt(items[1].e, 80)} », et leur voisinage`, items);
};
/* Statut épistémique, commun aux fragments et aux notes : l'élément est cherché dans les deux listes du module. */
CHANGE["ep-set"] = el => {
  const inst = S().modules[modOf(el)], id = idOf(el), item = inst && [...inst.entries, ...(inst.scraps || [])].find(x => x.id === id);
  if (!item) return;
  setEpStatus(item, el.value, todayISO()); site.save(); render();
};

/* ---- arc : des étapes, où l'on loge des fragments et des éléments de collection venus d'autres modules ----
   Un arc n'impose aucune grille ; ses étapes sont nommées par l'utilisatrice. Ce qui n'est logé nulle part
   ne se voit pas ici : c'est le vide dans une colonne qui porte l'information, pas une liste de manquants. */
function arcCandidates() {
  const out = [];
  for (const [mod, m] of Object.entries(S().modules)) {
    if (m.type === "cumul") for (const e of m.scraps || []) out.push({ ref: `${mod}/${e.id}`, mod, e });
    else if (m.type === "collection" && !isConcordance(m)) for (const e of m.entries) out.push({ ref: `${mod}/${e.id}`, mod, e });
  }
  return out;
}
function arcPlace(id) {
  const inst = S().modules[id], c = inst.config;
  if (!c.stations.length) return toast("Ajoute une étape avant de placer quoi que ce soit.");
  const choices = arcCandidates().filter(x => x.mod !== id).sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).slice(0, 300);
  if (!choices.length) return toast("Rien à placer pour l'instant : un fragment ou un élément de collection, d'abord.");
  openForm("Placer dans l'arc", [
    { n: "station", l: "Étape", t: "select", o: c.stations.map(s => [s.id, s.name]) },
    { n: "ref", l: "Élément", t: "select", o: choices.map(x => [x.ref, `${label(x.mod)} · ${x.e.date ? fmt(x.e.date) + " · " : ""}${excerpt(x.e, 70)}`]) }
  ], {}, v => {
    const cur = S().modules[id]; // relu : une synchro a pu remplacer les données pendant la saisie
    if (!cur) return toast("Ce module a été supprimé entre-temps.");
    if (cur.entries.some(p => p.station === v.station && p.ref === v.ref)) return toast("Déjà à cette étape.");
    cur.entries.push({ id: uid(), station: v.station, ref: v.ref, at: todayISO() });
    site.save(); render();
  });
}
function arcEmpty(inst) { return inst.config.stations.filter(st => !inst.entries.some(p => p.station === st.id)); }
TYPE_UI.arc = {
  view(id) {
    const inst = S().modules[id], c = inst.config;
    const placed = st => [...inst.entries].filter(p => p.station === st.id).sort((a, b) => (a.at || "").localeCompare(b.at || ""));
    const card = p => {
      const hit = refFind(p.ref);
      return `<div class="card" data-id="${esc(p.id)}">${hit ? `<span class="tag">${esc(label(hit.mod))}</span><p style="margin:6px 0"><a href="#${esc(hit.mod)}/${esc(hit.e.id)}">${esc(excerpt(hit.e, 140))}</a></p>${hit.e.date ? `<div class="meta">${fmt(hit.e.date)}</div>` : ""}` : `<i>(supprimé)</i>`}<div class="row"><button class="btn ghost sm ra" data-act="arc-remove" data-mod="${esc(id)}">retirer</button></div></div>`;
    };
    return `<div data-mod="${esc(id)}"><div class="row" style="margin-bottom:20px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn acc" data-act="arc-place" data-mod="${esc(id)}">Placer un élément</button></div>
    ${c.stations.length ? `<div class="board">${c.stations.map(st => `<div class="col"><h3>${esc(st.name)} <span class="hint" style="font-size:.95rem">${placed(st).length}</span></h3>${placed(st).map(card).join("") || `<p class="empty">Vide.</p>`}</div>`).join("")}</div>`
      : `<p class="hint">Aucune étape pour l'instant. Ajoute-en dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a>.</p>`}</div>`;
  },
  settings: (id, { config: c }) => `<div><span class="hint" style="margin:0">Étapes, dans l'ordre</span>${c.stations.map((st, i) => `<div class="set" data-sti="${i}" style="grid-template-columns:1fr auto"><input data-act="stat-name" data-mod="${esc(id)}" value="${esc(st.name)}" aria-label="Nom de l'étape"><div class="row"><button class="btn ghost sm" data-act="stat-up" data-mod="${esc(id)}" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="stat-del" data-mod="${esc(id)}">suppr.</button></div></div>`).join("")}<button class="btn sm" data-act="stat-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter une étape</button></div>`,
  summary(id, inst) {
    const empty = arcEmpty(inst).length;
    return `${plural(inst.entries.length, "élément")} sur ${plural(inst.config.stations.length, "étape")}${empty ? `, ${plural(empty, "vide")}` : ""}`;
  },
  recent: inst => [...inst.entries].sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 3).map(p => {
    const hit = refFind(p.ref), st = inst.config.stations.find(s => s.id === p.station);
    return `${st ? st.name : "?"} · ${hit ? excerpt(hit.e, 50) : "(supprimé)"}`;
  }),
  review: (inst, from, to) => { const n = within(inst.entries, from, to, "at").length; return n ? `${n} placé${n > 1 ? "s" : ""}` : "Rien placé"; },
  context(inst, nm) {
    const c = inst.config, empty = arcEmpty(inst).map(s => s.name);
    return `\n${nm} : arc de ${c.stations.length} étapes (${c.stations.map(s => s.name).join(" → ")}), ${inst.entries.length} éléments placés${empty.length ? `, vide à : ${empty.join(", ")}` : ""}.`;
  },
  click: {
    "arc-place": el => arcPlace(el.dataset.mod),
    "arc-remove": el => removeWithUndo(el.dataset.mod, "entries", idOf(el)),
    "stat-add": el => { const c = instOf(el).config; if (c.stations.length >= 12) return toast("Douze étapes. Au-delà, ce n'est plus un arc, c'est un calendrier."); c.stations.push({ id: uid(), name: `Étape ${c.stations.length + 1}` }); site.save(); render(); },
    "stat-up": el => { const a = instOf(el).config.stations, i = +el.closest("[data-sti]").dataset.sti; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } },
    "stat-del": async el => {
      const inst = instOf(el), c = inst.config, i = +el.closest("[data-sti]").dataset.sti, st = c.stations[i];
      const n = inst.entries.filter(p => p.station === st.id).length;
      if (!await ask(`Supprimer l'étape « ${st.name} » ?${n ? ` ${plural(n, "placement")} seront retirés.` : ""}`)) return;
      inst.entries = inst.entries.filter(p => p.station !== st.id);
      c.stations.splice(i, 1); site.save(); render();
    }
  },
  change: {
    "stat-name": el => { const st = instOf(el).config.stations[+el.closest("[data-sti]").dataset.sti]; st.name = el.value.trim() || st.name; site.save(); el.blur(); render(); }
  }
};
// Les actions propres à chaque type rejoignent les tables d'actions globales (un nom en double serait un bug).
for (const [type, ui] of Object.entries(TYPE_UI)) for (const [table, acts] of [[CLICK, ui.click], [CHANGE, ui.change]]) for (const [act, fn] of Object.entries(acts || {})) {
  if (Object.hasOwn(table, act)) throw new Error(`Action « ${act} » du type ${type} déjà définie`);
  table[act] = fn;
}

/* ================= la fiche Spécimen : tout ce qu'on sait d'une entrée, au même endroit =================
   Le texte, son étiquette (date, chapitre, étiquette, état, statut épistémique), sa provenance, ses liens sortants et
   entrants, les motifs qui s'y trouvent, l'histoire de son statut et de ses réexamens. Un tiroir sur ordinateur, une
   feuille sur téléphone ; elle se redessine à chaque changement. */
/* Les motifs (collections en concordance) présents dans un texte, selon la règle même de la concordance. */
/* Les motifs et leurs formes, calculés une fois par rendu : les marges en demandent pour chaque ligne affichée, et
   chaque forme à plusieurs mots est une expression régulière qu'on ne recompilerait pas cent fois. */
const motifIndex = () => memoInRender("motifIndex", () => {
  const out = [];
  for (const [id, inst] of Object.entries(S().modules)) if (isConcordance(inst) && enabled(id)) for (const e of inst.entries) out.push({ id, e, m: motifForms(e) });
  return out;
});
/* Un texte contient-il ce motif (ses formes, motifForms) ? Au pluriel près, sans accents. */
function motifHit(m, text) {
  const f = fold(text), w = wordsOf(f);
  return m.single.some(v => w.has(v) || w.has(v + "s") || w.has(v + "x")) || !!(m.re && m.re.test(f));
}
function motifsOf(text) {
  return motifIndex().filter(({ m }) => motifHit(m, text)).map(({ id, e }) => ({ id, e }));
}
/* Le statut épistémique codé par la forme, pas par la couleur : observé plein, hypothèse pointillée,
   interprétation à moitié, inexpliqué pointé. */
const EP_GLYPH = { obs: `<circle cx="8" cy="8" r="5" fill="currentColor"/>`, hyp: `<circle cx="8" cy="8" r="5" stroke-dasharray="2 2"/>`,
  int: `<circle cx="8" cy="8" r="5"/><path d="M8 3a5 5 0 0 1 0 10z" fill="currentColor" stroke="none"/>`, inx: `<circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/>` };
const epGlyph = ep => Object.hasOwn(EP_GLYPH, ep || "") ? `<svg class="ep-glyph" viewBox="0 0 16 16" aria-hidden="true">${EP_GLYPH[ep]}</svg>` : "";
SHEETS.specimen = ref => {
  const hit = refFind(ref); if (!hit) return `<p class="empty">Cette entrée n'existe plus.</p>`;
  const { mod, e } = hit, inst = S().modules[mod], c = inst.config, text = String(e.text || e.note || "");
  const thought = inst.type === "notes" || (inst.type === "cumul" && (inst.scraps || []).includes(e));
  const long = d => fmt(d, { day: "numeric", month: "long", year: "numeric" }), when = e.date || e.due || e.created;
  const chapter = inst.type === "cumul" && e.category ? (c.categories.find(x => x.id === e.category) || {}).name : "";
  const links = [...(e.links || []).map(l => `<li>${esc(LINK_TYPES[l.type])} ${refHTML(l.to)}</li>`), ...(backlinks().get(`${mod}/${e.id}`) || []).map(b => `<li>${esc(LINK_BACK[b.type])} ${refHTML(b.from)}</li>`)];
  const motifs = motifsOf([e.title, e.subtitle, text].filter(Boolean).join(" "));
  const statusOf = k => k ? EP_STATUS[k] : "sans statut";
  const log = [...(e.epLog || [])].reverse().map(x => `<li>${x.date ? long(x.date) + " : " : ""}${esc(statusOf(x.from))} → ${epGlyph(x.to)}${esc(statusOf(x.to))}</li>`);
  const reviews = [...(e.reviews || [])].reverse().map(r => `<li>${esc(r.verdict)}, le ${long(r.date)}</li>`);
  return `<div class="spec ${tintOf(mod)}" data-mod="${esc(mod)}" data-id="${esc(e.id)}">
    <div class="plate">${sigil(mod)}<span class="pl">${esc(label(mod))}</span></div>
    ${e.title ? `<h2 id="sheetTitle">${esc(e.title)}</h2>${e.subtitle ? `<p class="hint">${esc(e.subtitle)}</p>` : ""}` : `<h2 id="sheetTitle" class="sr">Fiche de l'entrée</h2>`}
    ${text ? `<blockquote class="spec-text">${esc(text)}</blockquote>` : ""}
    <p class="spec-label">${[when ? long(when) : "", chapter, e.tag, e.status].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("")}${e.ep ? `<span>${epGlyph(e.ep)}${esc(EP_STATUS[e.ep])}</span>` : ""}</p>
    ${thought ? `<div class="row">${epSelect(mod, e)}<span class="spacer"></span>${links.length ? `<button class="btn ghost sm" data-act="carte" data-k="ref" data-v="${esc(mod)}/${esc(e.id)}">carte du voisinage</button>` : ""}<button class="btn ghost sm" data-act="derive-start" data-mod="${esc(mod)}">dériver</button><button class="btn ghost sm" data-act="link-form" data-mod="${esc(mod)}">lier…</button></div>`
      : inst.type === "collection" && inst.config.sources ? `<div class="row"><span class="spacer"></span><button class="btn ghost sm" data-act="src-link" data-ref="${esc(mod)}/${esc(e.id)}">documente…</button></div>` : ""}
    ${e.src ? `<p class="meta">${srcMeta(e)}</p>` : ""}
    ${e.origin ? `<h3>Provenance</h3><p class="meta">${originHTML(e, text || e.title)}</p>` : ""}
    ${links.length ? `<h3>Liens</h3><ul>${links.join("")}</ul>` : ""}
    ${motifs.length ? `<h3>Motifs</h3><div class="row">${motifs.map(m => `<button class="btn ghost sm" data-act="search-for" data-q="${esc(m.e.title)}">${esc(m.e.title)}</button>`).join("")}</div>` : ""}
    ${log.length ? `<h3>Statut, au fil du temps</h3><ul class="meta" style="display:block">${log.join("")}</ul>` : ""}
    ${reviews.length ? `<h3>Réexamens</h3><ul>${reviews.join("")}</ul>` : ""}
    <div class="row" style="margin-top:18px"><a class="btn sm" href="#${esc(mod)}/${esc(e.id)}">Voir dans ${esc(label(mod))}</a>${inst.type === "collection" ? `<button class="btn ghost sm" data-act="col-edit">modifier</button>` : ""}</div>
  </div>`;
};
CLICK["specimen"] = el => { const mod = modOf(el), id = idOf(el); if (mod && id) openSheet("specimen", `${mod}/${id}`); };

/* ================= le Vasculum : trier la boîte de réception, une note à la fois =================
   Comme la boîte d'herborisation où l'on met les spécimens avant de les presser : une décision à la fois, les espaces
   cibles en grands sigils, le rangement reconnu proposé en premier. Réutilise les actions de la boîte (note-to,
   note-file, note-del) ; « Plus tard » passe à la suivante sans rien toucher. */
let vascSkip = 0;
SHEETS.vasculum = () => {
  const s = S(), inbox = inboxId(s.modules);
  if (!inbox) return `<h2 id="sheetTitle">Vasculum</h2><p class="empty">Aucune boîte de réception.</p>`;
  const list = s.modules[inbox].entries, n = list.length;
  if (!n) return `<h2 id="sheetTitle">Vasculum</h2><p class="empty">La boîte est vide. Tout a trouvé sa place, ou presque.</p><div class="row"><button class="btn" data-act="sheet-close">Fermer</button></div>`;
  const i = vascSkip % n, note = list[i], intent = captureIntent(note.text), targets = noteTargets(inbox);
  return `<div class="vasc" data-mod="${esc(inbox)}" data-id="${esc(note.id)}"><h2 id="sheetTitle" class="sr">Vasculum : trier la boîte</h2>
    <p class="vasc-count">Vasculum · ${i + 1} sur ${n}</p>
    <blockquote class="spec-text">${esc(note.text)}</blockquote>
    <p class="meta">${fmt(note.date)}${note.ep ? `<span>${epGlyph(note.ep)}${esc(EP_STATUS[note.ep])}</span>` : ""}</p>
    ${intent && intent.to !== inbox ? `<button class="btn acc" data-act="note-file">Ranger : ${esc(intent.say)}</button>` : ""}
    ${targets.length ? `<div class="vasc-targets">${targets.map(k => `<button type="button" class="${tintOf(k)}" data-act="note-to" data-to="${esc(k)}">${sigil(k)}<span>${esc(label(k))}</span></button>`).join("")}</div>` : `<p class="hint">Aucun espace ne sait encore recevoir une note.</p>`}
    <div class="row"><button class="btn ghost" data-act="vasc-skip">Plus tard</button><span class="spacer"></span><button class="btn ghost" data-act="note-del">Supprimer</button></div></div>`;
};
CLICK["vasculum"] = () => { vascSkip = 0; openSheet("vasculum"); };
CLICK["vasc-skip"] = () => { vascSkip++; $("#sheetBody").innerHTML = SHEETS.vasculum(); };
CLICK["sheet-close"] = () => closeSheet();

/* Glisser-déposer entre les colonnes d'un tableau (ordinateur), et touches [ ] sur une carte qui a le focus. */
let dragCard = null;
document.addEventListener("dragstart", e => {
  const card = e.target.closest && e.target.closest(".board .card[draggable][data-id]"); if (!card) return;
  dragCard = { mod: modOf(card), id: card.dataset.id }; card.classList.add("dragging");
  try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.dataset.id); } catch {}
});
const dropCols = () => document.querySelectorAll(".board .col.drop");
document.addEventListener("dragend", () => { dragCard = null; dropCols().forEach(x => x.classList.remove("drop")); });
document.addEventListener("dragover", e => {
  const col = dragCard && e.target.closest && e.target.closest(".board .col[data-ci]"); if (!col) return;
  e.preventDefault(); dropCols().forEach(x => { if (x !== col) x.classList.remove("drop"); }); col.classList.add("drop");
});
document.addEventListener("drop", e => {
  const col = dragCard && e.target.closest && e.target.closest(".board .col[data-ci]"); if (!col) return;
  e.preventDefault(); const d = dragCard; dragCard = null; moveCardTo(d.mod, d.id, +col.dataset.ci);
});
document.addEventListener("keydown", e => {
  const card = (e.key === "[" || e.key === "]") && e.target.closest && e.target.closest(".board .card[data-ci][data-id]"); if (!card) return;
  e.preventDefault(); const id = card.dataset.id;
  moveCardTo(modOf(card), id, +card.dataset.ci + (e.key === "]" ? 1 : -1));
  document.querySelectorAll(".board .card[data-id]").forEach(c => { if (c.dataset.id === id) c.focus(); });
});

/* ================= la carte céleste des liaisons =================
   Une lentille secondaire (carte.js pour la géométrie) : le voisinage d'une entrée (fiche Spécimen) ou les entrées
   d'un motif (Motifs) et leurs liens directs, jamais la totalité. Le type de lien se lit à la forme du trait, pas à la
   couleur (comme les statuts) ; la tension ouverte s'ajoute en cinabre. Chaque étoile est un lien, au clavier aussi ;
   la table des liaisons dit la même chose en texte, et c'est elle seule qu'on voit d'abord sur un téléphone. */
function carteData(arg) {
  const cut = String(arg).indexOf(":"), kind = String(arg).slice(0, cut), ref = String(arg).slice(cut + 1);
  const items = thoughtItems(), byRef = new Map(items.map(it => [it.ref, it])), adj = new Map();
  const add = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (const it of items) for (const l of it.e.links || []) if (byRef.has(l.to) && l.to !== it.ref) { add(it.ref, l.to); add(l.to, it.ref); }
  let refs, capped = false, title, center = null;
  if (kind === "ref") {
    const hit = byRef.get(ref); if (!hit) return null;
    ({ refs, capped } = carteNeighbourhood(ref, adj, 2)); center = ref; title = `Voisinage de « ${excerpt(hit.e, 50)} »`;
  } else {
    const [mod, id] = ref.split("/"), inst = Object.hasOwn(S().modules, mod) ? S().modules[mod] : null, motif = inst && isConcordance(inst) && inst.entries.find(x => x.id === id);
    if (!motif) return null;
    const m = motifForms(motif), core = items.filter(it => motifHit(m, it.e.text || "")).sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).map(it => it.ref);
    const set = new Set(core.slice(0, CARTE_MAX));
    capped = core.length > CARTE_MAX;
    for (const r of [...set]) for (const n of [...(adj.get(r) || [])].sort()) { if (set.has(n)) continue; if (set.size < CARTE_MAX) set.add(n); else capped = true; }
    refs = [...set]; title = `Motif « ${motif.title} »`;
  }
  const inSet = new Set(refs), open = new Set(openTensions().map(t => `${t.a}|${t.b}`)), edges = [];
  const nodes = refs.map(r => byRef.get(r)).filter(Boolean).map(it => ({ ref: it.ref, mod: it.mod, date: it.e.date, links: (adj.get(it.ref) || new Set()).size }));
  for (const r of refs) for (const l of (byRef.get(r) || { e: {} }).e.links || []) if (inSet.has(l.to) && l.to !== r) edges.push({ from: r, to: l.to, type: l.type, open: l.type === "contredit" && open.has(`${r}|${l.to}`) });
  return { title, center, capped, byRef, edges, layout: carteLayout(nodes, edges, S().config.modules.map(m => m.id)) };
}
const LINE_DASH = { derive: "", contredit: "2 3", echo: "6 4", documente: "7 3 1.5 3" };
const lineSample = (type, open) => `<svg width="30" height="8" aria-hidden="true"><path class="ln ln-${type}${open ? " open" : ""}" d="M1,4H29"${LINE_DASH[type] ? ` stroke-dasharray="${LINE_DASH[type]}"` : ""}/></svg>`;
SHEETS.carte = arg => {
  const c = carteData(arg); if (!c) return `<p class="empty">Cette entrée ou ce motif n'existe plus.</p>`;
  const L = c.layout, when = d => esc(fmt(d, { day: "numeric", month: "short", year: "numeric" }));
  const star = s => { const it = c.byRef.get(s.ref), e = it.e;
    return `<a href="#${esc(it.mod)}/${esc(e.id)}" class="${tintOf(it.mod)}${s.ref === c.center ? " center" : ""}"><title>${esc(excerpt(e, 90))} · ${esc(label(it.mod))}${e.date ? ` · ${when(e.date)}` : ""}</title><circle class="hit" cx="${s.x}" cy="${s.y}" r="12"/><circle cx="${s.x}" cy="${s.y}" r="${s.r}"/></a>`; }; // .hit : une cible de doigt, invisible
  const svg = `<svg viewBox="0 0 ${L.width} ${L.height}" class="carte-svg" role="group" aria-label="Carte : ${L.stars.length} étoile${L.stars.length > 1 ? "s" : ""}, ${L.lines.length} lien${L.lines.length > 1 ? "s" : ""}">
    ${L.bands.map((b, i) => `<g class="band"><rect x="0" y="${b.y}" width="${L.width}" height="64"${i % 2 ? ` class="odd"` : ""}/><text x="6" y="${b.y + 36}">${esc(label(b.mod).slice(0, 16))}</text></g>`).join("")}
    ${L.span && L.span.from !== L.span.to ? `<text class="axis" x="${L.span.x0}" y="${L.height - 3}">${when(L.span.from)}</text><text class="axis" x="${L.span.x1}" y="${L.height - 3}" text-anchor="end">${when(L.span.to)}</text>` : ""}
    <g>${L.lines.map(l => `<path class="ln ln-${l.type}${l.open ? " open" : ""}" d="${l.d}"${LINE_DASH[l.type] ? ` stroke-dasharray="${LINE_DASH[l.type]}"` : ""}/>`).join("")}</g>
    <g class="stars">${L.stars.map(star).join("")}</g></svg>`;
  const linked = new Set(c.edges.flatMap(e => [e.from, e.to])), lonely = L.stars.filter(s => !linked.has(s.ref));
  return `<div class="carte">
    <h2 id="sheetTitle">${esc(c.title)}</h2>
    <p class="hint">${L.stars.length} étoile${L.stars.length > 1 ? "s" : ""}, ${L.lines.length} lien${L.lines.length > 1 ? "s" : ""}. Le temps de gauche à droite, une bande par espace ; la taille d'une étoile dit son nombre de liens.${c.capped ? ` ${CARTE_MAX} étoiles au plus : au-delà, c'est une nébuleuse, pas une carte ; les plus proches sont gardées.` : ""}</p>
    <button class="btn sm carte-toggle" data-act="carte-toggle" aria-expanded="false">Voir la carte</button>
    <div class="carte-sky">${svg}</div>
    <p class="carte-legend">${Object.keys(LINK_TYPES).map(k => `<span>${lineSample(k)}${esc(LINK_TYPES[k])}</span>`).join("")}<span>${lineSample("contredit", true)}tension ouverte</span></p>
    <h3>Table des liaisons</h3>
    <ul class="carte-table">${c.edges.map(e => `<li>${refHTML(e.from)} <span class="hint">${esc(LINK_TYPES[e.type])}</span> ${refHTML(e.to)}${e.open ? ` <span class="late">tension ouverte</span>` : ""}</li>`).join("") || `<li class="empty">Aucun lien entre ces étoiles.</li>`}</ul>
    ${lonely.length ? `<p class="hint" style="margin-top:10px">Sans lien ici : ${lonely.map(s => refHTML(s.ref)).join(", ")}.</p>` : ""}
  </div>`;
};
CLICK["carte"] = el => openSheet("carte", `${el.dataset.k}:${el.dataset.v}`);
CLICK["carte-toggle"] = el => { const on = el.closest(".carte").classList.toggle("show-sky"); el.setAttribute("aria-expanded", on); el.textContent = on ? "Masquer la carte" : "Voir la carte"; };

/* ================= sources : un lien ou un DOI, complété puis gardé =================
   Tirer, jamais pousser : rien ne part vers un service sans un geste (« Chercher », « Garder comme source »). Un DOI
   va à Crossref (sans clé), une page à Microlink (sans clé, 25 par jour, qui voit l'adresse demandée). Hors ligne,
   service muet ou quota épuisé : la source est gardée avec son adresse seule, et le dit. La traduction des réponses
   est dans sources.js ; la validation de `src`, dans domain.js. */
const srcPreview = {}; // aperçu en cours, par module (propre à l'appareil, oublié au rechargement)
const sourcesModule = () => S().config.modules.map(m => m.id).find(k => enabled(k) && Object.hasOwn(S().modules, k) && S().modules[k].type === "collection" && S().modules[k].config.sources) || null;
function pubDate(d) {
  if (!d) return "";
  if (d.length === 10) return fmt(d, { day: "numeric", month: "short", year: "numeric" });
  if (d.length === 7) return new Date(d + "-15T12:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return d;
}
/* Sous une source : son site, sa date, son DOI, et le lien vers elle (seul lien externe de l'app, jamais « javascript: »). */
function srcMeta(e) {
  const x = e.src; if (!x) return "";
  const url = x.url && /^https?:\/\//i.test(x.url) ? x.url : "";
  return [x.site && `<span>${esc(x.site)}</span>`, x.date && `<span>${esc(pubDate(x.date))}</span>`, x.doi && `<span>doi:${esc(x.doi)}</span>`,
    url && `<a class="src-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">ouvrir ↗</a>`,
    e.zot && e.zot.l && /^https:\/\/www\.zotero\.org\//.test(e.zot.l) && `<a class="src-link" href="${esc(e.zot.l)}" target="_blank" rel="noopener noreferrer">Zotero ↗</a>`].filter(Boolean).join("");
}
async function fetchSource(raw) {
  const doi = findDoi(raw), url = findUrl(raw);
  if (!doi && !url) return null;
  const get = async u => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
    try { const r = await fetch(u, { signal: ac.signal }); return r.ok ? await r.json() : null; } finally { clearTimeout(t); }
  };
  try {
    if (doi) { const j = await get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`); if (j && j.message) return crossrefToSource(j.message, doi); }
    else {
      // Le passeur d'abord (la page elle-même, et les flux qu'elle annonce) ; Microlink s'il manque ou échoue.
      if (passeurPret()) {
        try {
          const r = await passeurFetch(url, "page");
          if (r.texte) {
            const pg = pageToSource(r.texte, r.url || url);
            if (pg.doi) { const j = await get(`https://api.crossref.org/works/${encodeURIComponent(pg.doi)}`).catch(() => null); if (j && j.message) return { ...crossrefToSource(j.message, pg.doi), feeds: pg.feeds }; }
            return pg;
          }
        } catch {}
      }
      const j = await get(`https://api.microlink.io/?url=${encodeURIComponent(url)}`); if (j && j.status === "success" && j.data) return microlinkToSource(j.data, url);
    }
  } catch {} // hors ligne, délai dépassé, réponse illisible : voir plus bas
  return { ...bareSource(url, doi), partial: true };
}
/* Une source déjà gardée, dans n'importe quel module de sources : même DOI, ou même adresse. */
function findSourceDup(src) {
  const key = sourceKey(src), zk = src && src.zot && src.zot.k; if (!key && !zk) return null;
  for (const [mod, m] of Object.entries(S().modules)) {
    if (m.type !== "collection" || !m.config.sources) continue;
    const e = m.entries.find(x => (key && x.src && sourceKey(x.src) === key) || (zk && x.zot && x.zot.k === zk));
    if (e) return { mod, e };
  }
  return null;
}
function keepSource(mod, x, origin) {
  const e = saveCollectionItem(S().modules[mod], { title: x.title || x.url || x.doi, subtitle: x.authors || "", tag: x.kind || "", text: x.abstract || "" }, uid());
  e.src = Object.fromEntries(Object.entries({ url: x.url, doi: x.doi, site: x.site, date: x.date }).filter(([, v]) => v));
  if (x.zot) e.zot = { ...x.zot }; // reliée à sa fiche Zotero
  e.kept = todayISO(); // le jour où elle a été gardée : les Sortes savent ainsi depuis quand elle attend
  if (origin) e.origin = origin;
  return e;
}
function sourceBar(id) {
  const p = srcPreview[id], d = p && p.data;
  const prev = !p ? "" : p.busy ? `<p class="hint" role="status">Recherche…</p>` : `<div class="src-prev" role="status">
    <b>${esc(d.title)}</b>${d.authors ? `<div>${esc(d.authors)}</div>` : ""}
    <div class="meta">${[d.site, pubDate(d.date), d.kind].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("")}${d.doi ? `<span>doi:${esc(d.doi)}</span>` : ""}</div>
    ${d.abstract ? `<p class="note">${esc(d.abstract)}</p>` : ""}
    ${d.feeds && d.feeds.length ? `<p class="hint">Ce site publie un flux : ${d.feeds.map(f => `<span class="tag">${esc(f.title || f.url)}</span>`).join(" ")}${passeurPret() && !dehorsFeeds().some(x => sourceKey({ url: x.url }) === sourceKey({ url: d.feeds[0].url })) ? ` <button class="btn ghost sm" data-act="dehors-follow" data-url="${esc(d.feeds[0].url)}">le suivre dans Dehors</button>` : ""}</p>` : ""}
    ${d.partial ? `<p class="hint">Métadonnées indisponibles (hors ligne, service muet ou quota du jour atteint) : elle sera gardée avec son adresse seule.</p>` : ""}
    ${p.dup ? `<p class="hint">Déjà gardée${p.dup.mod !== id ? ` dans ${esc(label(p.dup.mod))}` : ""} : <a href="#${esc(p.dup.mod)}/${esc(p.dup.e.id)}">« ${esc(excerpt(p.dup.e, 60))} »</a>.</p>` : ""}
    <div class="row"><button class="btn acc sm" data-act="src-keep" ${p.dup ? "disabled" : ""}>Garder</button><button class="btn ghost sm" data-act="src-cancel">Annuler</button></div></div>`;
  return `<div class="capture src-bar"><input id="srcIn" inputmode="url" autocomplete="off" placeholder="Un lien ou un DOI…" aria-label="Lien ou DOI"><button class="btn" data-act="src-fetch">Chercher</button></div>
  <p class="hint" style="margin:4px 0 12px">Un DOI est complété par Crossref ; une page, ${passeurPret() ? "par ton passeur (sinon Microlink, qui voit l'adresse demandée, 25 par jour)" : "par Microlink, qui voit l'adresse demandée (25 par jour)"}.</p>${prev}${zotBar(id)}`;
}
CLICK["src-fetch"] = async el => {
  const id = modOf(el), inp = $("#srcIn"), raw = inp ? inp.value.trim() : "";
  if (!raw) return;
  if (!findDoi(raw) && !findUrl(raw)) return toast("Ni lien ni DOI reconnu. Un lien commence par https://, un DOI par 10.");
  srcPreview[id] = { busy: true }; render();
  const data = await fetchSource(raw);
  if (!srcPreview[id] || !srcPreview[id].busy) return; // annulé entre-temps
  srcPreview[id] = { data, dup: findSourceDup(data) }; render();
};
CLICK["src-keep"] = el => {
  const id = modOf(el), p = srcPreview[id]; if (!p || !p.data || p.dup) return;
  const e = keepSource(id, p.data); delete srcPreview[id];
  const inp = $("#srcIn"); if (inp) inp.value = "";
  site.save(); render(); toast(`Gardée : « ${excerpt(e, 50)} ».`);
};
CLICK["src-cancel"] = el => { delete srcPreview[modOf(el)]; render(); };
/* Une note de la boîte qui contient un lien ou un DOI devient une source, avec sa provenance ; ses liens la suivent. */
CLICK["note-source"] = async el => {
  const from = modOf(el), to = sourcesModule(), nid = idOf(el), note = S().modules[from].entries.find(x => x.id === nid);
  if (!note || !to) return;
  el.disabled = true; el.textContent = "Recherche…";
  const data = await fetchSource(note.text);
  const box = S().modules[from], n = box && box.entries.find(x => x.id === nid); // relu : une synchro a pu passer
  if (!n || !data) return render();
  const dup = findSourceDup(data);
  if (dup) { render(); return toast(`Déjà gardée dans ${label(dup.mod)}. La note reste où elle est.`); }
  const e = keepSource(to, data, n.origin || { from: label(from), text: n.text, date: n.date });
  retargetLinks(S().modules, `${from}/${n.id}`, `${to}/${e.id}`);
  box.entries = box.entries.filter(x => x !== n); site.save(); render();
  toast(data.partial ? `Rangée dans ${label(to)}, avec son adresse seule : métadonnées indisponibles pour l'instant.` : `Rangée dans ${label(to)} : « ${excerpt(e, 50)} ».`);
};

/* ================= musique : MusicBrainz et Cover Art Archive =================
   Préciser l'album d'un artiste dans sa discographie réelle, avec les pochettes ; en ajouter d'autres ; et, sur
   demande seulement, les nouvelles sorties des artistes reliés. Sans clé ; une requête par seconde au plus (règle de
   MusicBrainz), en file. Les pochettes sont des images (<img>) : elles n'ont pas besoin de CORS, seulement de la CSP.
   Traduction des réponses : musique.js ; validation de `mb` : domain.js. */
const MB = "https://musicbrainz.org/ws/2";
let mbLast = 0;
async function mbFetch(path) {
  const wait = Math.max(0, mbLast + 1100 - Date.now()); mbLast = Date.now() + wait;
  if (wait) await new Promise(r => setTimeout(r, wait));
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
  try { const r = await fetch(`${MB}${path}${path.includes("?") ? "&" : "?"}fmt=json`, { signal: ac.signal }); return r.ok ? await r.json() : null; } finally { clearTimeout(t); }
}
const coverImg = rg => `<img class="cover" src="${esc(coverUrl(rg))}" alt="" loading="lazy" width="44" height="44">`;
// Une pochette absente (404) : l'image s'efface au lieu d'afficher une icône cassée.
document.addEventListener("error", e => { if (e.target && e.target.classList && e.target.classList.contains("cover")) e.target.classList.add("none"); }, true);
let mbState = null; // { ref, step: "artist"|"albums", artists, albums, busy, err } : la feuille en cours
const mbEntry = ref => { const hit = refFind(ref); return hit && S().modules[hit.mod].config.music ? hit : null; };
async function mbLoadAlbums(aid) {
  mbState.busy = true; mbState.step = "albums"; $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref);
  const j = await mbFetch(`/release-group?artist=${aid}&type=album|ep&limit=100`).catch(() => null);
  if (!mbState) return;
  Object.assign(mbState, { busy: false, aid, albums: j ? mbAlbums(j) : null, err: j ? "" : "MusicBrainz ne répond pas (hors ligne, ou trop de demandes). Réessaie dans un instant." });
  if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref);
}
SHEETS.mb = ref => {
  const hit = mbEntry(ref); if (!hit || !mbState) return `<p class="empty">Cet élément n'existe plus.</p>`;
  const { mod, e } = hit, inst = S().modules[mod], st = mbState;
  const head = `<h2 id="sheetTitle">${esc(e.title)}</h2><p class="hint">Discographie studio (albums et EP) selon MusicBrainz, base libre et collaborative.</p>`;
  if (st.busy) return head + `<p class="hint" role="status">Recherche…</p>`;
  if (st.err) return head + `<p class="hint" role="status">${esc(st.err)}</p><button class="btn sm" data-act="mb-retry">Réessayer</button>`;
  if (st.step === "artist") {
    if (!st.artists.length) return head + `<p class="empty">Aucun artiste de ce nom dans MusicBrainz. Vérifie l'orthographe du titre.</p>`;
    return head + `<p>Plusieurs artistes portent ce nom :</p><ul class="plain">${st.artists.map(a => `<li class="item"><span></span><div><b>${esc(a.name)}</b><div class="meta">${[a.note, a.country, a.begin && `depuis ${a.begin}`].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("")}</div></div><button class="btn sm" data-act="mb-artist" data-a="${esc(a.id)}">choisir</button></li>`).join("")}</ul>`;
  }
  const have = new Set(inst.entries.filter(x => x.mb && x.mb.rg).map(x => x.mb.rg));
  const haveTitle = new Set(inst.entries.filter(x => fold(x.title) === fold(e.title) && x.subtitle).map(x => fold(x.subtitle)));
  if (!st.albums.length) return head + `<p class="empty">Aucun album ni EP studio référencé pour cet artiste.</p>`;
  return head + `<ul class="plain mb-albums">${st.albums.map(a => { const mine = e.mb && e.mb.rg === a.id, inList = have.has(a.id) || haveTitle.has(fold(a.title));
    return `<li class="item" data-rg="${esc(a.id)}"><span>${coverImg(a.id)}</span><div><b>${esc(a.title)}</b><div class="meta"><span>${esc(a.date.slice(0, 4) || "sans date")}</span><span>${esc(a.type)}</span></div></div>
      <div class="row">${mine ? `<span class="hint">choisi</span>` : `<button class="btn sm" data-act="mb-pick">${e.subtitle ? "remplacer" : "choisir"}</button>`}${inList ? "" : `<button class="btn ghost sm" data-act="mb-add">ajouter</button>`}</div></li>`; }).join("")}</ul>`;
};
async function mbOpen(ref) {
  const hit = mbEntry(ref); if (!hit) return;
  mbState = { ref, step: "artist", artists: [], albums: [], busy: true, err: "" };
  openSheet("mb", ref);
  if (hit.e.mb && hit.e.mb.a) return mbLoadAlbums(hit.e.mb.a);
  const j = await mbFetch(`/artist?query=${encodeURIComponent(mbArtistQuery(hit.e.title))}&limit=6`).catch(() => null);
  if (!mbState || mbState.ref !== ref) return;
  Object.assign(mbState, { busy: false, artists: j ? mbArtists(j) : [], err: j ? "" : "MusicBrainz ne répond pas (hors ligne, ou trop de demandes). Réessaie dans un instant." });
  if (mbState.artists.length === 1 && !mbState.err) return mbLoadAlbums(mbState.artists[0].id); // un seul candidat : pas de question
  if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS.mb(ref);
}
CLICK["mb-open"] = el => mbOpen(`${modOf(el)}/${idOf(el)}`);
CLICK["mb-retry"] = () => { if (mbState) mbOpen(mbState.ref); };
CLICK["mb-artist"] = el => mbLoadAlbums(el.dataset.a);
CLICK["mb-pick"] = el => {
  const hit = mbState && mbEntry(mbState.ref), rg = el.closest("[data-rg]").dataset.rg, a = hit && mbState.albums.find(x => x.id === rg); if (!a) return;
  hit.e.subtitle = a.title; hit.e.mb = { a: mbState.aid, rg: a.id, ...(a.date ? { y: a.date.slice(0, 4) } : {}) };
  site.save(); render(); $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref); toast(`« ${a.title} » : c'est noté.`);
};
CLICK["mb-add"] = el => {
  const hit = mbState && mbEntry(mbState.ref), rg = el.closest("[data-rg]").dataset.rg, a = hit && mbState.albums.find(x => x.id === rg); if (!a) return;
  const n = saveCollectionItem(S().modules[hit.mod], { title: hit.e.title, subtitle: a.title }, uid());
  n.mb = { a: mbState.aid, rg: a.id, ...(a.date ? { y: a.date.slice(0, 4) } : {}) };
  site.save(); render(); $("#sheetBody").innerHTML = SHEETS.mb(mbState.ref); toast(`Ajouté : ${hit.e.title}, « ${a.title} ».`);
};
/* Nouvelles sorties : pour chaque artiste relié, ce qu'il a publié depuis la dernière vérification (sur cet appareil ;
   la toute première fois, l'année écoulée). Sur demande seulement : jamais en arrière-plan. */
const MB_SEEN = "selene-mb-seen";
let mbNews = null; // { mod, done, total, items: [{ artist, aid, album }] }
SHEETS["mb-new"] = mod => {
  const n = mbNews, lab = esc(label(mod));
  if (!n) return "";
  const head = `<h2 id="sheetTitle">Nouvelles sorties</h2><p class="hint">Ce que tes artistes reliés dans ${lab} ont publié depuis ta dernière vérification, selon MusicBrainz. Rien n'est vérifié sans toi.</p>`;
  if (n.done < n.total) return head + `<p class="hint" role="status">${n.done} sur ${n.total} artistes…</p>`;
  const inst = S().modules[mod], have = new Set(inst.entries.filter(x => x.mb && x.mb.rg).map(x => x.mb.rg));
  return head + (n.items.length ? `<ul class="plain mb-albums">${n.items.map(x => `<li class="item" data-rg="${esc(x.album.id)}" data-a="${esc(x.aid)}"><span>${coverImg(x.album.id)}</span><div><b>${esc(x.album.title)}</b><div class="meta"><span>${esc(x.artist)}</span><span>${esc(x.album.date)}</span><span>${esc(x.album.type)}</span></div></div>${have.has(x.album.id) ? `<span class="hint">déjà là</span>` : `<button class="btn sm" data-act="mb-new-add">ajouter</button>`}</li>`).join("")}</ul>` : `<p class="empty">Rien de neuf. Le silence est aussi une nouvelle.</p>`)
    + (n.failed ? `<p class="hint">${n.failed} artiste${n.failed > 1 ? "s" : ""} sans réponse : réessaie plus tard.</p>` : "");
};
CLICK["mb-new"] = async el => {
  const mod = modOf(el), inst = S().modules[mod], artists = new Map();
  for (const e of inst.entries) if (e.mb && e.mb.a && !artists.has(e.mb.a)) artists.set(e.mb.a, e.title);
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(MB_SEEN) || "{}") || {}; } catch {}
  const today = todayISO(), yearAgo = addDaysTo(today, -365);
  mbNews = { mod, done: 0, total: artists.size, items: [], failed: 0 };
  openSheet("mb-new", mod);
  for (const [aid, name] of artists) {
    const j = await mbFetch(`/release-group?artist=${aid}&type=album|ep&limit=100`).catch(() => null);
    if (!mbNews || mbNews.mod !== mod) return;
    if (j) { for (const album of mbSince(mbAlbums(j), seen[aid] || yearAgo)) mbNews.items.push({ artist: name, aid, album }); seen[aid] = today; }
    else mbNews.failed++;
    mbNews.done++;
    if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS["mb-new"](mod);
  }
  mbNews.items.sort((a, b) => b.album.date.localeCompare(a.album.date));
  try { localStorage.setItem(MB_SEEN, JSON.stringify(seen)); } catch {}
  if ($("#sheet").open) $("#sheetBody").innerHTML = SHEETS["mb-new"](mod);
};
CLICK["mb-new-add"] = el => {
  const li = el.closest("[data-rg]"), x = mbNews && mbNews.items.find(i => i.album.id === li.dataset.rg); if (!x) return;
  const n = saveCollectionItem(S().modules[mbNews.mod], { title: x.artist, subtitle: x.album.title }, uid());
  n.mb = { a: x.aid, rg: x.album.id, ...(x.album.date ? { y: x.album.date.slice(0, 4) } : {}) };
  site.save(); render(); $("#sheetBody").innerHTML = SHEETS["mb-new"](mbNews.mod); toast(`Ajouté : ${x.artist}, « ${x.album.title} ».`);
};

/* ---- Radar culturel (radar.js) : sur demande, ce qui se tient dans la Métropole de Lille et parle de tes mots ----
   Le portail reçoit la zone (lieu du ciel, arrondi) et les dates ; les mots restent ici, le tri se fait sur l'appareil. */
const RADAR_KEY = "selene-radar"; // cache de l'appareil : { at, key, events }, six heures
const radarConf = () => { const r = S().config.radar; return { words: r && typeof r.words === "string" ? r.words : "" }; };
const radarPlace = () => { const c = skyConf(); return c && nearLille(+c.lat, +c.lon) ? c : null; };
let radarState = null; // { busy, err, items, total, words, kept } : la feuille en cours
/* Une lecture de l'agenda : directe d'abord ; si le navigateur n'a pas le droit d'en lire la réponse (le portail de
   la MEL n'envoie pas d'en-tête CORS : constaté le 29 septembre 2026), par le passeur, qui lit du JSON pour toi. L'échec
   direct est retenu pour la session : on ne refrappe pas à une porte qu'on sait fermée. */
let radarDirect = true;
async function radarGet(url) {
  if (radarDirect) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
    try { const r = await fetch(url, { signal: ac.signal }); return { status: r.status, json: r.ok ? await r.json() : null }; }
    catch { radarDirect = false; } finally { clearTimeout(t); }
  }
  if (!passeurPret()) throw new Error("Le portail de la Métropole ne se laisse pas lire directement par le navigateur : il faut ton passeur (version hébergée, connectée).");
  const q = await passeurFetch(url, "json");
  return { status: q.status || 0, json: q.status === 200 && typeof q.texte === "string" ? JSON.parse(q.texte) : null };
}
async function radarFetch(c, from) {
  const key = `${+c.lat},${+c.lon},${from}`;
  try { const x = JSON.parse(localStorage.getItem(RADAR_KEY) || "null"), age = x ? Date.now() - x.at : NaN; if (x && x.key === key && age > -300000 && age < 6 * 3600000 && Array.isArray(x.events)) return x.events; } catch {}
  let r = await radarGet(radarUrl(c, from, { lean: true }));
  if (r.status === 400) r = await radarGet(radarUrl(c, from, { lean: false })); // un champ renommé par le portail : tout recevoir plutôt que rien
  if (!r.json) throw new Error(`L'agenda de la Métropole répond ${r.status || "par une erreur"} (le portail a peut-être changé). Réessaie plus tard.`);
  const events = radarEvents(r.json);
  try { localStorage.setItem(RADAR_KEY, JSON.stringify({ at: Date.now(), key, events })); } catch {}
  return events;
}
function radarWhen(x, today) {
  const dm = d => fmt(d, { day: "numeric", month: "long" });
  if (!x.from) return "";
  if (x.from <= today) return x.to > today ? `en cours, jusqu'au ${dm(x.to)}` : "aujourd'hui";
  if (x.to === x.from) return fmt(x.from, { weekday: "long", day: "numeric", month: "long" });
  return `du ${dm(x.from)} au ${dm(x.to)}`;
}
SHEETS.radar = () => {
  const st = radarState, c = radarPlace(); if (!st) return "";
  const head = `<h2 id="sheetTitle">Radar culturel</h2><p class="hint">Autour de ${esc(c ? c.name.split(",")[0] : "Lille")}, les deux semaines à venir, ce qui parle de : ${esc(st.words.map(w => st.said[w] || w).join(", "))}. Cinq au plus ; le reste attendra que tu reviennes.</p>`;
  const foot = `<p class="hint" style="margin-top:12px">Source : OpenAgenda, par l'open data de la Métropole européenne de Lille. Le portail voit la zone (arrondie) et les dates, jamais tes mots : le tri se fait ici.</p>`;
  if (st.busy) return head + `<p class="hint" role="status">Recherche…</p>`;
  if (st.err) return head + `<p class="hint" role="status">${esc(st.err)}</p><button class="btn sm" data-act="radar-open">Réessayer</button>` + foot;
  if (!st.items.length) return head + `<p class="empty">Rien qui te ressemble, cette fois. La ville continuera sans toi, elle a l'habitude.</p>` + foot;
  const today = todayISO();
  return head + `<ul class="plain radar">${st.items.map(x => `<li class="item" data-rid="${esc(x.id)}"><span></span><div><b>${esc(x.title)}</b>
      <div class="meta"><span>${esc(radarWhen(x, today))}</span>${x.place || x.city ? `<span>${esc([x.place, x.city].filter(Boolean).join(", "))}</span>` : ""}${x.on.map(w => `<span class="tag">${esc(st.said[w] || w)}</span>`).join("")}</div>
      ${x.text ? `<p class="hint" style="margin:4px 0 0">${esc(x.text)}</p>` : ""}</div>
      <div class="row">${/^https:\/\//.test(x.url) ? `<a class="btn ghost sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">voir</a>` : ""}${st.kept.has(x.id) ? `<span class="hint">gardé</span>` : `<button class="btn sm" data-act="radar-keep">garder</button>`}</div></li>`).join("")}</ul>`
    + (st.total > st.items.length ? `<p class="hint">${st.total - st.items.length} autre${st.total - st.items.length > 1 ? "s" : ""} correspond${st.total - st.items.length > 1 ? "ent" : ""} aussi : des mots plus précis choisiraient mieux.</p>` : "") + foot;
};
CLICK["radar-open"] = async () => {
  const c = radarPlace(), words = radarWords(radarConf().words); if (!c || !words.length) return;
  const said = Object.create(null); for (const w of radarConf().words.split(",")) { const t = w.trim(); if (t.length > 1 && !said[radarFold(t)]) said[radarFold(t)] = t; } // pour l'affichage : tes mots tels que tu les écris
  radarState = { busy: true, err: "", items: [], total: 0, words, said, kept: new Set() };
  if ($("#sheet").open && sheetKind === "radar") $("#sheetBody").innerHTML = SHEETS.radar(); else openSheet("radar");
  let events = null, err = "";
  try { events = await radarFetch(c, todayISO()); } catch (e) { err = e.message || "L'agenda de la Métropole ne répond pas. Réessaie plus tard."; }
  const st = radarState; if (!st) return;
  Object.assign(st, { busy: false, err }, events ? radarMatch(events, words, 5) : {});
  if ($("#sheet").open && sheetKind === "radar") $("#sheetBody").innerHTML = SHEETS.radar();
};
CLICK["radar-keep"] = el => {
  const st = radarState, x = st && st.items.find(i => i.id === el.closest("[data-rid]").dataset.rid), box = inboxId(S().modules); if (!x) return;
  if (!box) return toast("Aucune boîte de réception où le garder. Crée un Carnet et fais-en ta boîte (Réglages).");
  addNote(S().modules[box], [x.title, radarWhen(x, todayISO()), [x.place, x.city].filter(Boolean).join(", "), x.url].filter(Boolean).join(" — ").slice(0, 2000));
  st.kept.add(x.id); site.save(); render(); $("#sheetBody").innerHTML = SHEETS.radar(); toast(`Gardé dans ${label(box)}.`);
};
function radarSettingsHTML() {
  const c = skyConf(), near = radarPlace();
  return `<section id="radar"><h3>Radar culturel · Métropole de Lille uniquement</h3><p class="hint">Couverture locale : changer de ville n’étend pas ce service à une autre région. Pour suivre des événements ailleurs, ajoute tes propres flux dans Dehors.</p><p class="hint">Sur demande, depuis l'accueil : les événements de la Métropole de Lille (OpenAgenda, open data de la MEL) des deux semaines à venir qui parlent de tes mots. Cinq au plus, jamais de notification.</p>
    <label>Tes mots, séparés par des virgules (cherchés dans le titre, les mots-clés, la description et le lieu)<input data-act="radar-words" value="${esc(radarConf().words)}" placeholder="poésie, jazz, photographie, lecture…" maxlength="300" autocomplete="off"></label>
    ${near ? "" : `<p class="hint" style="margin-top:6px">${c ? `Le radar ne couvre que la Métropole de Lille : le lieu réglé (${esc(c.name)}) en est trop loin.` : "Il lui faut un lieu près de Lille : règle-le dans Ciel, ci-dessus."}</p>`}</section>`;
}

/* Réglages → Passeur (passeur.js) : vérifier en lisant la page de Selene elle-même, copier l'identifiant. */
CLICK["passeur-check"] = async el => {
  el.disabled = true; passeurEtat = "";
  try { await passeurFetch(location.origin + location.pathname, "page"); toast("Passeur : il répond, et il te reconnaît."); }
  catch (e) { toast(e.message); }
  render();
};
CLICK["passeur-copy"] = async () => {
  try { await navigator.clipboard.writeText(authSession.user.id); toast("Identifiant copié."); } catch { toast("Copie impossible ici : sélectionne-le à la main."); }
};

/* ================= Dehors : la seule porte vers le dehors (dehors.js pour la lecture des flux) =================
   Une vue qu'on ouvre, jamais poussée : le nouveau depuis ta dernière visite, douze au plus, par projet. Les flux
   suivis et leur « vu jusqu'à » sont synchronisés (quelques octets, config.dehors) ; ce qu'ils contiennent reste sur
   l'appareil (cache, un mois). Les flux sont relus par le passeur, un par un, en GET conditionnel, au plus toutes
   les trois heures, à l'ouverture ou sur demande. */
const DEHORS_KEY = "selene-dehors";
const dehorsFeeds = () => (S().config.dehors && Array.isArray(S().config.dehors.feeds) ? S().config.dehors.feeds : []);
const dehorsConf = () => S().config.dehors || {};
/* Écrit la configuration de Dehors en gardant le reste (flux, Artist Watch) ; vide, elle disparaît. */
function dehorsSet(patch) {
  const d = { ...dehorsConf(), feeds: dehorsFeeds(), ...patch };
  if (!d.artists) { delete d.artists; delete d.artistsSeen; }
  if (!Array.isArray(d.research) || !d.research.length) delete d.research;
  if (!d.feeds.length && !d.artists && !d.research) delete S().config.dehors; else S().config.dehors = d;
  site.save();
}
/* Research Watch (veille.js) : des recherches et des auteurs, relus une fois par semaine ; la clé OpenAlex, facultative,
   reste sur l'appareil (jamais synchronisée, effacée à la déconnexion). */
const OA_KEY = "selene-openalex-key";
const oaKey = () => { try { return localStorage.getItem(OA_KEY) || ""; } catch { return ""; } };
const dehorsResearch = () => (Array.isArray(dehorsConf().research) ? dehorsConf().research : []);
/* Artist Watch : un flux de plus, fabriqué ici (MusicBrainz, sans passeur), rangé sous le premier module de musique. */
const MB_WATCH = "mb-artists";
const musicMods = () => Object.keys(S().modules).filter(k => enabled(k) && S().modules[k].type === "collection" && S().modules[k].config.music);
function watchedArtists() {
  const m = new Map();
  for (const k of musicMods()) for (const e of S().modules[k].entries) if (e.mb && e.mb.a) { m.delete(e.mb.a); m.set(e.mb.a, { name: e.title, mod: k }); }
  return [...m].slice(-30); // trente au plus, les plus récemment ajoutés : trente secondes de MusicBrainz, une fois par semaine
}
const dehorsAll = () => [...dehorsFeeds(), ...(dehorsConf().artists ? [{ id: MB_WATCH, title: "Sorties de tes artistes", mod: musicMods()[0] || "", seen: dehorsConf().artistsSeen || 0, watch: true }] : []),
  ...dehorsResearch().map(r => ({ id: "oa-" + r.id, title: `Veille : ${r.q}`, mod: r.mod || "", seen: r.seen || 0, research: r }))];
const dehorsOn = () => hosted() && authReady() && !!authSession;
function dehorsCache() {
  try { const c = JSON.parse(localStorage.getItem(DEHORS_KEY) || "null"); if (c && typeof c === "object" && c.feeds && typeof c.feeds === "object") return { at: +c.at || 0, feeds: c.feeds, hidden: Array.isArray(c.hidden) ? c.hidden : [] }; } catch {}
  return { at: 0, feeds: {}, hidden: [] };
}
function dehorsStore(c) {
  const ids = new Set(dehorsAll().map(f => f.id));
  for (const k of Object.keys(c.feeds)) if (!ids.has(k)) delete c.feeds[k]; // un flux retiré emporte son cache
  c.hidden = c.hidden.slice(-500);
  try { localStorage.setItem(DEHORS_KEY, JSON.stringify(c)); } catch {}
}
const dehorsTest = () => memoInRender("dehorsTest", () => text => motifsOf(text).map(({ e }) => e.title));
function dehorsNow() { const c = dehorsCache(); return dehorsNew(dehorsAll(), c.feeds, new Set(c.hidden), Date.now(), dehorsTest()); }
let dehorsBusy = false;
async function dehorsRefresh(force = false) {
  if (dehorsBusy || !dehorsOn() || document.visibilityState !== "visible") return;
  const feeds = dehorsFeeds(), due = feeds.length && passeurPret() && (force || Date.now() - dehorsCache().at >= 3 * 3600000);
  const watchDue = dehorsConf().artists && (force || Date.now() - ((dehorsCache().feeds[MB_WATCH] || {}).at || 0) >= 7 * 86400000);
  const research = dehorsResearch().filter(r => force || Date.now() - ((dehorsCache().feeds["oa-" + r.id] || {}).at || 0) >= 7 * 86400000);
  if (!due && !watchDue && !research.length) return;
  dehorsBusy = true; if (routeOf().view === "dehors") render();
  try {
    if (due) {
      for (const f of feeds) {
        const c = dehorsCache(), fc = c.feeds[f.id] || { items: [] };
        try {
          const r = await passeurFetch(f.url, "feed", { etag: fc.etag, modifie: fc.modifie });
          if (r.status === 304) fc.err = "";
          else if (r.status >= 200 && r.status < 300 && typeof r.texte === "string") {
            const pf = parseFeed(r.texte, r.url || f.url);
            if (!pf) fc.err = "ce n'est plus un flux lisible";
            else { fc.items = feedMerge(fc.items, pf.items, Date.now()); fc.etag = r.etag || ""; fc.modifie = r.modifie || ""; fc.err = ""; }
          } else fc.err = r.erreur || `le site répond ${r.status}`;
        } catch (e) { fc.err = e.message; }
        fc.at = Date.now(); c.feeds[f.id] = fc; dehorsStore(c);
        if (passeurEtat === "absent") break;
      }
      const c = dehorsCache(); c.at = Date.now(); dehorsStore(c);
    }
    if (watchDue) await artistWatch();
    for (const r of research) await researchWatch(r);
  } finally { dehorsBusy = false; render(); }
}
/* Une veille : ce qui est paru depuis la dernière relecture (la première fois, le mois écoulé). Comme les sorties
   d'artistes, un article compte à partir de sa découverte (OpenAlex indexe avec retard) ; sa date reste affichée. */
async function researchWatch(r) {
  const c0 = dehorsCache(), fc = c0.feeds["oa-" + r.id] || { items: [] };
  const since = fc.at ? new Date(fc.at - 14 * 86400000).toISOString().slice(0, 10) : addDaysTo(todayISO(), -30);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(oaUrl(r, since, oaKey()), { signal: ac.signal });
    if (res.status === 429) fc.err = "quota du jour atteint (une clé OpenAlex gratuite le décuple)";
    else if (!res.ok) fc.err = `OpenAlex répond ${res.status}`;
    else {
      const got = oaWorks(await res.json()).map(x => ({ ...x, text: [x.oa.day && pubDate(x.oa.day), x.text].filter(Boolean).join(" · ") }));
      fc.items = feedMerge(fc.items, got, Date.now()); fc.err = "";
    }
  } catch { fc.err = "OpenAlex injoignable"; } finally { clearTimeout(t); }
  fc.at = Date.now(); const c = dehorsCache(); c.feeds["oa-" + r.id] = fc; dehorsStore(c);
}
/* Artist Watch : pour chaque artiste relié, ce qu'il a publié depuis la dernière vérification (la même mémoire que
   « Nouvelles sorties », selene-mb-seen ; la première fois, le mois écoulé). Ces éléments comptent à partir du jour où
   on les découvre, pas de leur date de parution : MusicBrainz enregistre souvent une sortie après coup. */
async function artistWatch() {
  const artists = watchedArtists(); if (!artists.length) return;
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(MB_SEEN) || "{}") || {}; } catch {}
  const today = todayISO(), got = []; let failed = 0;
  for (const [aid, a] of artists) {
    const j = await mbFetch(`/release-group?artist=${aid}&type=album|ep&limit=100`).catch(() => null);
    if (!j) { failed++; continue; }
    for (const al of mbSince(mbAlbums(j), seen[aid] || addDaysTo(today, -30)))
      got.push({ id: al.id, title: `${a.name} — ${al.title}`, link: `https://musicbrainz.org/release-group/${al.id}`, date: "", text: [al.type, pubDate(al.date)].filter(Boolean).join(" · "),
        mb: { a: aid, rg: al.id, ...(al.date ? { y: al.date.slice(0, 4) } : {}), artist: a.name, album: al.title, mod: a.mod } });
    seen[aid] = today;
  }
  try { localStorage.setItem(MB_SEEN, JSON.stringify(seen)); } catch {}
  const c = dehorsCache(), fc = c.feeds[MB_WATCH] || { items: [] };
  fc.items = feedMerge(fc.items, got, Date.now()); fc.at = Date.now(); fc.err = failed ? `${failed} artiste${failed > 1 ? "s" : ""} sans réponse de MusicBrainz` : "";
  c.feeds[MB_WATCH] = fc; dehorsStore(c);
}
/* Suivre un flux : l'adresse d'un flux, ou d'un site dont la page annonce son flux (découverte). */
async function dehorsFind(raw) {
  const url = normalizeUrl(raw) || normalizeUrl("https://" + String(raw).replace(/^\/+/, ""));
  if (!url) throw new Error("Ce n'est pas une adresse.");
  const r = await passeurFetch(url, "feed");
  if (r.status >= 300 || typeof r.texte !== "string") throw new Error(r.erreur || `Le site répond ${r.status}.`);
  const pf = parseFeed(r.texte, r.url || url);
  if (pf) return { url: r.url || url, title: pf.title, items: pf.items, etag: r.etag, modifie: r.modifie };
  const found = pageToSource(r.texte, r.url || url).feeds[0];
  if (!found) throw new Error("Aucun flux à cette adresse, ni annoncé par la page.");
  const r2 = await passeurFetch(found.url, "feed"), pf2 = r2.status < 300 && typeof r2.texte === "string" ? parseFeed(r2.texte, r2.url || found.url) : null;
  if (!pf2) throw new Error("La page annonce un flux, mais il est illisible.");
  return { url: r2.url || found.url, title: pf2.title || found.title, items: pf2.items, etag: r2.etag, modifie: r2.modifie };
}
async function dehorsFollow(raw, mod) {
  const got = await dehorsFind(raw);
  const feeds = dehorsFeeds();
  if (feeds.some(f => sourceKey({ url: f.url }) === sourceKey({ url: got.url }))) throw new Error("Ce flux est déjà suivi.");
  if (feeds.length >= 100) throw new Error("Cent flux, c'est déjà un kiosque. Retire-en avant d'en ajouter.");
  const f = { id: uid(), url: got.url, title: clip(got.title || new URL(got.url).hostname, 200), mod: mod && Object.hasOwn(S().modules, mod) ? mod : "", seen: Date.now() - 7 * 86400000 };
  dehorsSet({ feeds: [...feeds, f] });
  const c = dehorsCache(); c.feeds[f.id] = { items: feedMerge([], got.items, Date.now()), etag: got.etag || "", modifie: got.modifie || "", err: "", at: Date.now() }; dehorsStore(c);
  return f;
}
/* Sur l'accueil, une ligne de texte, et seulement s'il y a du nouveau : pas de pastille. */
function dehorsLine() {
  if (!dehorsOn() || !dehorsAll().length) return "";
  const n = dehorsNow().total;
  return n ? `<p class="hint dehors-go"><a href="#dehors">Dehors : ${n} nouveauté${n > 1 ? "s" : ""}</a></p>` : "";
}
const dehorsWhen = t => { const d = new Date(t), days = Math.round((Date.now() - t) / 86400000); return days < 1 ? `aujourd'hui, ${hm(t)}` : days < 7 ? d.toLocaleDateString("fr-FR", { weekday: "long" }) : fmt(d.toISOString().slice(0, 10)); };
VIEWS.dehors = () => {
  const feeds = dehorsFeeds(), mods = S().config.modules.filter(m => m.on && Object.hasOwn(S().modules, m.id) && !SYSTEM.includes(m.id)).map(m => m.id);
  const head = `<h2>Dehors</h2><p class="hint">Ce qui est paru depuis ta dernière visite, dans les flux que tu suis. Douze au plus : le reste attend, rien ne défile. Garde ce qui compte, le reste s'efface en un mois.</p>`;
  if (!dehorsOn()) return head + `<p class="empty">Dehors passe par le passeur : il n'existe que dans la version hébergée, connectée à ton compte.</p>`;
  const cache = dehorsCache(), { items, total } = dehorsNow(), byMod = new Map();
  for (const it of items) { const k = it.f.mod && Object.hasOwn(S().modules, it.f.mod) ? it.f.mod : ""; if (!byMod.has(k)) byMod.set(k, []); byMod.get(k).push(it); }
  const itemHTML = ({ f, x, t, motifs }) => `<li class="item" data-feed="${esc(f.id)}" data-item="${esc(x.id)}"><span></span><div>
      ${x.link ? `<a class="t-title" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${esc(x.title)} ↗</a>` : `<b>${esc(x.title)}</b>`}
      <div class="meta"><span>${esc(f.title)}</span><span>${esc(dehorsWhen(t))}</span>${(motifs || []).map(m => `<span class="tag">${esc(m)}</span>`).join("")}</div>
      ${x.text ? `<p class="hint" style="margin:4px 0 0">${esc(x.text)}</p>` : ""}</div>
    <div class="row">${x.mb ? (Object.hasOwn(S().modules, x.mb.mod) && S().modules[x.mb.mod].entries.some(e => e.mb && e.mb.rg === x.mb.rg) ? `<span class="hint">déjà dans ${esc(label(x.mb.mod))}</span>` : Object.hasOwn(S().modules, x.mb.mod) ? `<button class="btn sm" data-act="dehors-mb-add">ajouter à ${esc(label(x.mb.mod))}</button>` : "")
      : sourcesModule() && x.link ? `<button class="btn sm" data-act="dehors-keep">garder</button>` : ""}${inboxId(S().modules) ? `<button class="btn ghost sm" data-act="dehors-note">vers une note</button>` : ""}<button class="btn ghost sm" data-act="dehors-hide" aria-label="Écarter">vu</button></div></li>`;
  const list = !dehorsAll().length ? `<p class="empty">Aucun flux suivi. Colle ci-dessous l'adresse d'un site, d'une revue, d'une chaîne : Selene trouve son flux.</p>`
    : !items.length ? `<p class="empty">${dehorsBusy ? "Lecture des flux…" : "Rien de neuf. Le monde a pu se passer de toi, et toi de lui."}</p>`
    : [...byMod].map(([k, its]) => `<h3>${esc(k ? label(k) : "Sans projet")}</h3><ul class="plain dehors">${its.map(itemHTML).join("")}</ul>`).join("")
      + `<div class="row" style="margin-top:12px">${total > items.length ? `<span class="hint" style="margin:0">Et ${total - items.length} autre${total - items.length > 1 ? "s" : ""}, qui attendront.</span>` : ""}<span class="spacer"></span><button class="btn sm" data-act="dehors-seen">Tout marquer comme vu</button></div>`;
  const opts = sel => `<option value="">Sans projet</option>${mods.map(m => `<option value="${esc(m)}" ${sel === m ? "selected" : ""}>${esc(label(m))}</option>`).join("")}`;
  const state = f => { const fc = cache.feeds[f.id]; return !fc ? "pas encore lu" : fc.err ? `ne répond pas : ${fc.err}` : `lu ${dehorsWhen(fc.at)}`; };
  return `<div class="dehors-view">` + head + `<div class="row" style="margin:-4px 0 12px"><span class="hint" style="margin:0">${dehorsBusy ? "Lecture des flux…" : cache.at ? `Flux relus ${esc(dehorsWhen(cache.at))}.` : ""}</span><span class="spacer"></span>${dehorsAll().length ? `<button class="btn ghost sm" data-act="dehors-refresh" ${dehorsBusy ? "disabled" : ""}>Relire maintenant</button>` : ""}</div>
    ${list}
    <h3 style="margin-top:28px">Suivre</h3>
    <div class="capture capture-wrap"><input id="dehorsIn" inputmode="url" autocomplete="off" placeholder="L'adresse d'un site ou d'un flux…" aria-label="Adresse à suivre"><select id="dehorsMod" aria-label="Projet">${opts("")}</select><button class="btn" data-act="dehors-add">Suivre</button></div>
    ${watchedArtists().length || dehorsConf().artists ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin:8px 0 4px"><input type="checkbox" data-act="dehors-artists" ${dehorsConf().artists ? "checked" : ""}>Les sorties de mes artistes : MusicBrainz, une fois par semaine, pour ${watchedArtists().length} artiste${watchedArtists().length > 1 ? "s" : ""} relié${watchedArtists().length > 1 ? "s" : ""} (trente au plus)</label>` : ""}
    <p class="hint" style="margin:4px 0 10px">Une newsletter : abonne-toi avec une adresse de <a href="https://kill-the-newsletter.com/" target="_blank" rel="noopener noreferrer">Kill the Newsletter</a>, puis suis le flux Atom qu'il te donne (il garde les lettres chez lui : pas pour une correspondance privée).</p>
    <h3 style="margin-top:28px">Veille de recherche</h3>
    <p class="hint" style="margin:0 0 8px">Une recherche (« biodiversity », « renewable energy ») ou un auteur (identifiant OpenAlex ou ORCID) : chaque semaine, ce qui vient de paraître, selon OpenAlex. Elle ne trie pas selon ce qui te donnerait raison ; les liens, c'est toi qui les poses.</p>
    <div class="capture capture-wrap"><input id="oaIn" autocomplete="off" placeholder="Une recherche, un ORCID, un identifiant OpenAlex…" aria-label="Recherche ou auteur à suivre"><select id="oaMod" aria-label="Projet">${opts("")}</select><button class="btn" data-act="oa-add">Veiller</button></div>
    ${dehorsResearch().length ? `<ul class="plain dehors-cfg">${dehorsResearch().map(r => { const fc = cache.feeds["oa-" + r.id]; return `<li class="item" data-oa="${esc(r.id)}"><span></span><div><b>${esc(r.q)}</b><div class="meta"><span>${r.kind === "author" ? "auteur" : "recherche"}</span><span>${esc(!fc ? "pas encore lue" : fc.err ? `ne répond pas : ${fc.err}` : `lue ${dehorsWhen(fc.at)}`)}</span></div></div>
      <div class="row"><select data-act="oa-mod" aria-label="Projet de cette veille">${opts(r.mod || "")}</select><button class="btn ghost sm" data-act="oa-del">retirer</button></div></li>`; }).join("")}</ul>` : ""}
    <details style="margin-top:8px"><summary class="hint">Clé OpenAlex (facultative)</summary>
      <p class="hint" style="margin:6px 0">Sans clé, OpenAlex répond dans une petite limite quotidienne ; une clé gratuite (<a href="https://openalex.org/settings/api" target="_blank" rel="noopener noreferrer">openalex.org</a>) la décuple. Elle reste dans ce navigateur, n'est jamais synchronisée, et s'efface à la déconnexion.</p>
      <label>Clé API OpenAlex<input type="password" data-act="oa-key" value="${oaKey() ? "••••••••" : ""}" autocomplete="off" placeholder="colle ta clé"></label></details>
    ${feeds.length ? `<details class="dehors-feeds"><summary>Flux suivis (${feeds.length})</summary>
      <ul class="plain dehors-cfg">${feeds.map(f => `<li class="item" data-feed="${esc(f.id)}"><span></span><div><b>${esc(f.title)}</b><div class="meta"><span>${esc((() => { try { return new URL(f.url).hostname.replace(/^www\./, ""); } catch { return ""; } })())}</span><span>${esc(state(f))}</span></div>
        <label style="display:flex;gap:6px;align-items:center;font-weight:400;margin-top:4px"><input type="checkbox" data-act="dehors-motifs" ${f.motifs ? "checked" : ""}>Seulement ce qui touche mes motifs</label></div>
        <div class="row"><select data-act="dehors-mod" aria-label="Projet de ce flux">${opts(f.mod)}</select><button class="btn ghost sm" data-act="dehors-del">retirer</button></div></li>`).join("")}</ul>
    </details>` : ""}</div>`;
};
const dehorsHit = el => { const li = el.closest("[data-feed]"), f = dehorsAll().find(x => x.id === li.dataset.feed); const fc = f && dehorsCache().feeds[f.id]; return { li, f, x: fc && li.dataset.item ? fc.items.find(i => i.id === li.dataset.item) : null }; };
const dehorsHideItem = (f, x) => { const c = dehorsCache(); c.hidden.push(`${f.id}|${x.id}`); dehorsStore(c); };
CLICK["dehors-add"] = async el => {
  const inp = $("#dehorsIn"), raw = inp ? inp.value.trim() : ""; if (!raw) return;
  el.disabled = true; el.textContent = "Recherche…";
  try { const f = await dehorsFollow(raw, ($("#dehorsMod") || {}).value || ""); if (inp) inp.value = ""; toast(`Suivi : ${f.title}.`); }
  catch (e) { toast(e.message); }
  render();
};
CLICK["dehors-refresh"] = () => dehorsRefresh(true);
CLICK["dehors-seen"] = () => {
  const now = Date.now(); dehorsSet({ feeds: dehorsFeeds().map(f => ({ ...f, seen: now })), ...(dehorsConf().artists ? { artistsSeen: now } : {}), ...(dehorsResearch().length ? { research: dehorsResearch().map(r => ({ ...r, seen: now })) } : {}) });
  const c = dehorsCache(); c.hidden = []; dehorsStore(c); render(); toast("Tout est vu. Dehors se tait jusqu'à la prochaine parution.");
};
CLICK["dehors-hide"] = el => { const { f, x } = dehorsHit(el); if (!x) return; dehorsHideItem(f, x); render(); };
CLICK["dehors-note"] = el => {
  const { f, x } = dehorsHit(el), box = inboxId(S().modules); if (!x || !box) return;
  addNote(S().modules[box], [x.title, x.link].filter(Boolean).join(" — ").slice(0, 2000)); dehorsHideItem(f, x); site.save(); render(); toast(`Dans ${label(box)}.`);
};
CLICK["dehors-keep"] = el => {
  const { f, x } = dehorsHit(el), to = sourcesModule(); if (!x || !to) return;
  const src = x.oa ? { title: x.title, url: x.link, doi: x.oa.doi || null, site: x.oa.site, date: x.oa.day, kind: x.oa.kind === "article" ? "article" : x.oa.kind || "article", authors: x.oa.authors, abstract: x.text }
    : { title: x.title, url: normalizeUrl(x.link), doi: findDoi(x.link), site: f.title, date: x.date.slice(0, 10), kind: "page", abstract: x.text };
  const dup = findSourceDup(src);
  if (dup) { dehorsHideItem(f, x); render(); return toast(`Déjà gardée dans ${label(dup.mod)}.`); }
  const e = keepSource(to, src, { from: f.research ? "Veille" : "Dehors", text: f.research ? f.research.q : f.title, date: todayISO() }); dehorsHideItem(f, x); site.save(); render(); toast(`Gardée dans ${label(to)} : « ${excerpt(e, 50)} ».`);
};
CLICK["dehors-del"] = async el => {
  const { f } = dehorsHit(el); if (!f || !await ask(`Ne plus suivre « ${f.title} » ?`)) return;
  dehorsSet({ feeds: dehorsFeeds().filter(x => x.id !== f.id) }); dehorsStore(dehorsCache()); render();
};
/* Depuis l'aperçu d'une source : suivre le flux que la page annonce. */
CLICK["dehors-follow"] = async el => {
  el.disabled = true;
  try { const f = await dehorsFollow(el.dataset.url, ""); toast(`Suivi dans Dehors : ${f.title}.`); } catch (e) { toast(e.message); el.disabled = false; }
};
CHANGE["dehors-mod"] = el => { const { f } = dehorsHit(el); if (!f) return; dehorsSet({ feeds: dehorsFeeds().map(x => x.id === f.id ? { ...x, mod: el.value } : x) }); render(); };
CHANGE["dehors-motifs"] = el => { const { f } = dehorsHit(el); if (!f) return; dehorsSet({ feeds: dehorsFeeds().map(x => x.id === f.id ? { ...x, motifs: el.checked } : x) }); render(); };
CHANGE["dehors-artists"] = el => {
  dehorsSet(el.checked ? { artists: true, artistsSeen: Date.now() - 7 * 86400000 } : { artists: false });
  dehorsStore(dehorsCache()); render();
  if (el.checked) { toast("Artist Watch : première vérification, une seconde par artiste."); dehorsRefresh(); }
};
CLICK["oa-add"] = () => {
  const inp = $("#oaIn"), w = oaWatch(inp ? inp.value : ""); if (!w) return toast("Une recherche de deux cents caractères au plus, ou un auteur.");
  const list = dehorsResearch();
  if (list.some(r => r.kind === w.kind && fold(r.q) === fold(w.q))) return toast("Déjà en veille.");
  if (list.length >= 30) return toast("Trente veilles, c'est une thèse. Retires-en avant d'en ajouter.");
  const mod = ($("#oaMod") || {}).value || "";
  dehorsSet({ research: [...list, { id: uid(), kind: w.kind, q: w.q, ...(mod && Object.hasOwn(S().modules, mod) ? { mod } : {}), seen: Date.now() - 7 * 86400000 }] });
  if (inp) inp.value = ""; render(); toast(`En veille : ${w.q}. Première lecture…`); dehorsRefresh();
};
CLICK["oa-del"] = async el => {
  const id = el.closest("[data-oa]").dataset.oa, r = dehorsResearch().find(x => x.id === id); if (!r || !await ask(`Arrêter la veille « ${r.q} » ?`)) return;
  dehorsSet({ research: dehorsResearch().filter(x => x.id !== id) }); dehorsStore(dehorsCache()); render();
};
CHANGE["oa-mod"] = el => { const id = el.closest("[data-oa]").dataset.oa; dehorsSet({ research: dehorsResearch().map(r => r.id === id ? { ...r, mod: el.value } : r) }); render(); };
CHANGE["oa-key"] = el => {
  const v = el.value.trim(); if (v.startsWith("•")) return;
  try { if (v) localStorage.setItem(OA_KEY, v); else localStorage.removeItem(OA_KEY); } catch {}
  el.blur(); render(); toast(v ? "Clé OpenAlex gardée dans ce navigateur." : "Clé OpenAlex oubliée.");
};
CLICK["dehors-mb-add"] = el => {
  const { f, x } = dehorsHit(el); if (!x || !x.mb || !Object.hasOwn(S().modules, x.mb.mod)) return;
  const n = saveCollectionItem(S().modules[x.mb.mod], { title: x.mb.artist, subtitle: x.mb.album }, uid());
  n.mb = { a: x.mb.a, rg: x.mb.rg, ...(x.mb.y ? { y: x.mb.y } : {}) };
  dehorsHideItem(f, x); site.save(); render(); toast(`Ajouté à ${label(x.mb.mod)} : ${x.mb.artist}, « ${x.mb.album} ».`);
};

/* ================= Agenda : un calendrier dédié, aujourd'hui et demain (agenda.js pour la lecture iCal) =================
   L'adresse iCal secrète est une capacité au porteur : qui la possède lit l'agenda. Elle reste donc dans ce navigateur
   (jamais synchronisée, effacée à la déconnexion) et ne voyage que vers ton passeur, qui ne garde rien. Lue au plus
   une fois par heure, onglet visible. Un préfixe « Chantier : » range l'événement sous l'espace de ce nom. */
const ICS_URL = "selene-ics-url", ICS_CACHE = "selene-ics";
const icsUrl = () => { try { return localStorage.getItem(ICS_URL) || ""; } catch { return ""; } };
function icsCache() { try { const c = JSON.parse(localStorage.getItem(ICS_CACHE) || "null"); if (c && Array.isArray(c.events)) return c; } catch {} return { at: 0, events: [], err: "" }; }
let agendaBusy = false;
async function agendaRefresh(force = false) {
  const url = icsUrl();
  if (agendaBusy || !url || !passeurPret() || document.visibilityState !== "visible") return;
  if (!force && Date.now() - icsCache().at < 3600000) return;
  agendaBusy = true;
  const c = icsCache();
  try {
    const r = await passeurFetch(url, "ics");
    if (r.status >= 200 && r.status < 300 && typeof r.texte === "string") {
      const now = Date.now(), ev = icsParse(r.texte);
      // On ne garde que ce qui peut encore servir : les récurrences, et ce qui n'est pas fini depuis plus d'un jour.
      c.events = ev.filter(e => e.rrule || e.end > now - 86400000).slice(0, 800); c.err = ev.length || /BEGIN:VCALENDAR/.test(r.texte) ? "" : "ce n'est pas un calendrier iCal";
    } else c.err = r.erreur || `le calendrier répond ${r.status}`;
  } catch (e) { c.err = e.message; }
  c.at = Date.now();
  try { localStorage.setItem(ICS_CACHE, JSON.stringify(c)); } catch {}
  agendaBusy = false; render();
}
/* « Chantier : plombier » → l'espace Chantier, et « plombier ». */
function agendaRoute(summary) {
  const m = String(summary).match(/^([^:]{2,40}?)\s*:\s*(.+)$/); if (!m) return { mod: "", text: summary };
  const mod = S().config.modules.find(x => x.on && Object.hasOwn(S().modules, x.id) && fold(label(x.id)) === fold(m[1].trim()));
  return mod ? { mod: mod.id, text: m[2].trim() } : { mod: "", text: summary };
}
function agendaHTML() {
  if (!dehorsOn() || !icsUrl()) return "";
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const day = n => { const a = new Date(t0); a.setDate(a.getDate() + n); return a.getTime(); };
  const hhmm = t => hm(t).replace(" h 00", " h");
  const block = (n, name) => {
    const occ = icsBetween(icsCache().events, Math.max(day(n), n ? 0 : Date.now() - 3600000), day(n + 1));
    if (!occ.length) return "";
    return `<div class="agenda-day"><p class="hint" style="margin:10px 0 2px">${name}</p><ul class="plain">${occ.slice(0, 8).map(o => { const r = agendaRoute(o.summary);
      return `<li class="agenda-ev"><span class="when">${o.allDay ? "journée" : `${esc(hhmm(o.start))}${o.end - o.start > 0 && o.end - o.start < 86400000 ? `–${esc(hhmm(o.end))}` : ""}`}</span> ${r.mod ? `<a class="tag" href="#${esc(r.mod)}">${esc(label(r.mod))}</a> ` : ""}${esc(r.text)}${o.location ? ` <span class="hint" style="margin:0">· ${esc(o.location)}</span>` : ""}</li>`; }).join("")}</ul></div>`;
  };
  return block(0, "Aujourd'hui, au calendrier") + block(1, "Demain");
}
function agendaSettingsHTML() {
  const c = icsCache(), has = !!icsUrl();
  return `<section id="agenda"><h3>Calendrier</h3><p class="hint">Un seul calendrier, dédié (crée-en un « Selene ») : aujourd'hui et demain s'affichent sous « Aujourd'hui ». Un titre « Chantier : plombier » se range sous Chantier. Google : paramètres de l'agenda → Intégrer l'agenda → Adresse secrète au format iCal. Apple : partager en public, lien webcal.</p>
    <label>Adresse iCal secrète<input type="password" data-act="ics-url" value="${has ? "••••••••" : ""}" autocomplete="off" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></label>
    <p class="hint" style="margin-top:6px">Qui possède cette adresse lit tout le calendrier : elle reste dans ce navigateur, n'est jamais synchronisée, ne passe que par ton passeur (qui ne garde rien), et s'efface à la déconnexion. Si elle fuit, réinitialise-la dans l'agenda.</p>
    ${has ? `<p class="row" style="margin:0"><span>${esc(agendaBusy ? "Lecture…" : c.err ? `Ne répond pas : ${c.err}` : c.at ? `Lu ${dehorsWhen(c.at)} : ${c.events.length} événement${c.events.length > 1 ? "s" : ""} à venir ou récurrent${c.events.length > 1 ? "s" : ""}.` : "Pas encore lu.")}</span><button class="btn sm" data-act="ics-check">Relire</button><button class="btn ghost sm" data-act="ics-forget">oublier</button></p>` : ""}</section>`;
}
CHANGE["ics-url"] = el => {
  let v = el.value.trim(); if (v.startsWith("•")) return;
  v = v.replace(/^webcal:\/\//i, "https://");
  if (v && !/^https:\/\//i.test(v)) { el.value = ""; return toast("Une adresse https:// (ou webcal://) est attendue."); }
  try { if (v) localStorage.setItem(ICS_URL, v); else localStorage.removeItem(ICS_URL); localStorage.removeItem(ICS_CACHE); } catch {}
  el.blur(); render();
  if (v) { toast("Adresse gardée dans ce navigateur. Lecture…"); agendaRefresh(true); }
};
CLICK["ics-check"] = () => agendaRefresh(true);
CLICK["ics-forget"] = () => { try { localStorage.removeItem(ICS_URL); localStorage.removeItem(ICS_CACHE); } catch {} render(); toast("Calendrier oublié sur cet appareil."); };

/* ================= Zotero : ta bibliothèque, en lecture seule (zotero.js pour la traduction des fiches) =================
   La clé reste dans ce navigateur (jamais synchronisée, effacée à la déconnexion). Un appel part directement vers
   api.zotero.org ; si le navigateur n'a pas le droit d'en lire la réponse (CORS), il passe par ton passeur. Tirer,
   jamais pousser : rien n'est importé en masse, on garde une fiche à la fois. */
const ZOT_KEY = "selene-zotero-key", ZOT_INFO = "selene-zotero";
const zotKey = () => { try { return localStorage.getItem(ZOT_KEY) || ""; } catch { return ""; } };
const zotInfo = () => { try { const x = JSON.parse(localStorage.getItem(ZOT_INFO) || "null"); return x && Number.isInteger(x.userID) ? x : null; } catch { return null; } };
async function zotGet(path, viaPasseur = path) {
  const key = zotKey(); if (!key) throw new Error("Pas de clé Zotero (Réglages → Zotero).");
  const refuse = s => new Error(s === 403 ? "Zotero refuse cette clé (révoquée, ou sans accès à ta bibliothèque)." : `Zotero répond ${s}.`);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
  let r = null;
  try { r = await fetch(ZOT_API + path, { headers: { "Zotero-API-Key": key, "Zotero-API-Version": "3" }, signal: ac.signal }); } catch {} finally { clearTimeout(t); }
  if (r) { if (!r.ok) throw refuse(r.status); return r.json(); }
  // Pas de réponse lisible : CORS refusé, hors ligne, ou trop lent. Le passeur, s'il existe, essaie à son tour.
  if (!passeurPret()) throw new Error("Zotero injoignable depuis le navigateur, et pas de passeur pour le relayer.");
  const q = await passeurFetch(`${ZOT_API}${viaPasseur}${viaPasseur.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`, "json");
  if (q.status !== 200 || typeof q.texte !== "string") throw q.status ? refuse(q.status) : new Error(q.erreur || "Zotero injoignable.");
  return JSON.parse(q.texte);
}
async function zotCheck() {
  const key = zotKey(); if (!key) return null;
  const info = zotKeyInfo(await zotGet("/keys/current", `/keys/${encodeURIComponent(key)}`));
  if (!info) throw new Error("Réponse inattendue de Zotero.");
  if (!info.library) throw new Error("Cette clé n'a pas accès à ta bibliothèque personnelle (coche « Allow library access »).");
  try { localStorage.setItem(ZOT_INFO, JSON.stringify(info)); } catch {}
  return info;
}
const zotState = {}; // par module de sources : { busy, err, items, label } (propre à l'appareil, oublié au rechargement)
function zotBar(id) {
  if (!hosted() || !zotKey()) return "";
  const st = zotState[id];
  const list = !st ? "" : st.busy ? `<p class="hint" role="status">Recherche dans Zotero…</p>` : st.err ? `<p class="hint" role="status">${esc(st.err)}</p>`
    : !st.items.length ? `<p class="empty">Rien de tel dans ta bibliothèque.</p>`
    : `<p class="hint" style="margin:6px 0 0">${esc(st.label)}</p><ul class="plain zot-list">${st.items.map((x, i) => { const dup = findSourceDup(x);
      return `<li class="item" data-zi="${i}"><span></span><div><b>${esc(x.title)}</b><div class="meta">${[x.authors, x.site, pubDate(x.date), x.kind].filter(Boolean).map(v => `<span>${esc(v)}</span>`).join("")}</div></div>
        <div class="row">${dup ? `<a class="hint" href="#${esc(dup.mod)}/${esc(dup.e.id)}">déjà gardée</a>` : `<button class="btn sm" data-act="zot-keep">garder</button>`}</div></li>`; }).join("")}</ul>`;
  return `<div class="zot-bar" style="margin:4px 0 14px"><div class="capture capture-wrap"><input id="zotIn" autocomplete="off" placeholder="Dans ta bibliothèque Zotero : titre, auteur, année…" aria-label="Chercher dans Zotero"><button class="btn" data-act="zot-search">Chercher</button><button class="btn ghost sm" data-act="zot-recent">récents</button></div>${list}</div>`;
}
async function zotList(id, path, label) {
  zotState[id] = { busy: true, items: [], err: "", label }; render();
  try {
    const info = zotInfo() || await zotCheck();
    const items = zotItems(await zotGet(`/users/${info.userID}${path}`));
    zotState[id] = { busy: false, items, err: "", label };
  } catch (e) { zotState[id] = { busy: false, items: [], err: e.message, label }; }
  render();
}
CLICK["zot-search"] = el => {
  const id = modOf(el), q = (($("#zotIn") || {}).value || "").trim().slice(0, 200); if (!q) return;
  zotList(id, `/items/top?q=${encodeURIComponent(q)}&qmode=titleCreatorYear&limit=10&sort=dateModified&direction=desc&format=json`, `Dans ta bibliothèque : « ${q} »`);
};
CLICK["zot-recent"] = el => zotList(modOf(el), `/items/top?limit=10&sort=dateAdded&direction=desc&format=json`, "Les dix dernières fiches ajoutées à ta bibliothèque");
CLICK["zot-keep"] = el => {
  const id = modOf(el), st = zotState[id], x = st && st.items[+el.closest("[data-zi]").dataset.zi]; if (!x || findSourceDup(x)) return;
  const e = keepSource(id, x, { from: "Zotero", text: (zotInfo() || {}).username || "ta bibliothèque", date: todayISO() });
  site.save(); render(); toast(`Gardée, reliée à Zotero : « ${excerpt(e, 50)} ».`);
};
function zotSettingsHTML() {
  const info = zotInfo(), has = !!zotKey();
  return `<section id="zotero"><h3>Zotero</h3><p class="hint">Ta bibliothèque Zotero, en lecture seule : dans un module de Sources, cherche une fiche (ou les dernières ajoutées) et garde-la comme Source, reliée à sa fiche Zotero. Zotero reste l'archive ; Selene, l'endroit où tu t'en sers.</p>
    <p class="hint">Crée une clé sur <a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noopener noreferrer">zotero.org/settings/keys/new</a> : sous « Personal Library », coche <b>Allow library access</b> seulement (ni « Allow write access », ni les groupes). Elle reste dans ce navigateur, n'est jamais synchronisée et s'efface à la déconnexion.</p>
    <label>Clé API Zotero<input type="password" data-act="zot-key" value="${has ? "••••••••" : ""}" autocomplete="off" placeholder="colle ta clé"></label>
    ${has ? `<p class="row" style="margin:6px 0 0"><span>${esc(info ? `Bibliothèque de ${info.username || "#" + info.userID}${info.write ? " : attention, cette clé peut écrire ; une clé en lecture seule suffit." : ", en lecture seule."}` : "Pas encore vérifiée.")}</span><button class="btn sm" data-act="zot-check">Vérifier</button><button class="btn ghost sm" data-act="zot-forget">oublier</button></p>` : ""}</section>`;
}
CHANGE["zot-key"] = async el => {
  const v = el.value.trim(); if (v.startsWith("•")) return;
  try { if (v) localStorage.setItem(ZOT_KEY, v); else localStorage.removeItem(ZOT_KEY); localStorage.removeItem(ZOT_INFO); } catch {}
  el.blur(); render();
  if (v) CLICK["zot-check"]();
};
CLICK["zot-check"] = async () => {
  try { localStorage.removeItem(ZOT_INFO); } catch {}
  try { const i = await zotCheck(); toast(`Zotero : bibliothèque de ${i.username || "#" + i.userID}${i.write ? " (clé en écriture : préfère une clé en lecture seule)" : ", lecture seule"}.`); }
  catch (e) { toast(e.message); }
  render();
};
CLICK["zot-forget"] = () => { try { localStorage.removeItem(ZOT_KEY); localStorage.removeItem(ZOT_INFO); } catch {} for (const k of Object.keys(zotState)) delete zotState[k]; render(); toast("Clé Zotero oubliée sur cet appareil."); };

/* ---- une Source documente une note ou un fragment ---- */
function sourceLinkForm(mod, id) {
  const choices = thoughtItems().sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")).slice(0, 300);
  if (!choices.length) return toast("Aucune note ni aucun fragment à documenter pour l'instant.");
  openForm("Cette source documente…", [
    { n: "to", l: "…quelle note ou quel fragment", t: "select", o: choices.map(x => [x.ref, `${label(x.mod)} · ${x.e.date ? fmt(x.e.date) + " · " : ""}${excerpt(x.e, 70)}`]) }
  ], {}, v => {
    const hit = refFind(`${mod}/${id}`); if (!hit) return toast("Cette source a disparu entre-temps.");
    if (!addLink(hit.e, v.to, "documente", uid(), todayISO())) return toast("Déjà reliée ainsi.");
    if (sortesLast && sortesLast.e === hit.e) sortesLast = null; // elle n'est plus oubliée
    site.save(); render(); toast("Reliée. Elle apparaît en marge de ce qu'elle documente.");
  });
}
CLICK["src-link"] = el => { const ref = el.dataset.ref; if (ref) { const [m, i] = ref.split("/"); return sourceLinkForm(m, i); } sourceLinkForm(modOf(el), idOf(el)); };


