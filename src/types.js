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
     texts(inst)           textes parcourus par la recherche : [{ text, date? }]
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
  for (const it of thoughtItems()) for (const l of it.e.links || []) { if (!by.has(l.to)) by.set(l.to, []); by.get(l.to).push({ from: it.ref, type: l.type }); }
  return by;
});
const LINK_BACK = { derive: "a donné", contredit: "contredit par", echo: "écho de", documente: "documenté par" };
function refHTML(ref) {
  const hit = refFind(ref);
  return hit ? `<a href="#${esc(hit.mod)}">« ${esc(excerpt(hit.e))} »</a>` : `<i>(supprimé)</i>`;
}
/* Sous une entrée : ses liens sortants et entrants, puis « dériver » et « lier… ». */
function linksHTML(mod, e) {
  const out = (e.links || []).map(l => `<span>${esc(LINK_TYPES[l.type])} ${refHTML(l.to)}</span>`);
  const inc = (backlinks().get(`${mod}/${e.id}`) || []).map(b => `<span>${esc(LINK_BACK[b.type])} ${refHTML(b.from)}</span>`);
  return `<div class="meta links">${[...out, ...inc].join("")}<span class="acts"><button class="btn ghost sm" data-act="derive-start" data-mod="${esc(mod)}">dériver</button><button class="btn ghost sm" data-act="link-form" data-mod="${esc(mod)}">lier…</button></span></div>`;
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
/* Le statut épistémique d'un fragment ou d'une note, modifiable sur place ; vide par défaut. */
const epSelect = (id, e) => `<select class="ep ${e.ep ? "on" : ""}" data-act="ep-set" data-mod="${esc(id)}" aria-label="Statut">${[["", "statut…"], ...Object.entries(EP_STATUS)].map(([k, l]) => `<option value="${k}" ${(e.ep || "") === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
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
    <div class="rooms">${out.map(g => `<div class="room ${g.pct > 100 ? "over" : ""}"><div class="fill" style="height:${Math.min(100, g.pct)}%"></div><small>${esc(g.name)}</small><b>${g.pct} %</b><small>${esc(g.sub)}</small></div>`).join("") || `<p class="empty">Rien à regrouper pour l'instant.</p>`}</div></section>`;
}
const fragFilter = {}; // filtre des fragments par chapitre, par module (propre à l'appareil)
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
    <div class="rooms">${out.map(g => `<div class="room"><div class="fill" style="height:${Math.min(100, g.pct ?? 0)}%"></div><small>${esc(g.name)}</small><b>${g.pct == null ? "—" : g.pct + " %"}</b><small>${esc(g.sub)}</small></div>`).join("")}</div></section>`;
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
  </section><section><h3>Journal</h3><p class="hint">Ce que le corps a fait, ce que la tête en a pensé.</p>
    <ul class="plain">${recent.map(x => `<li class="item" data-id="${esc(x.id)}"><span></span><div>${fmt(x.date, { weekday: "short", day: "numeric", month: "short" })}, ${esc(x.value ?? "?")} ${esc(c.unitLabel)}${x.note ? `<div class="note" style="margin:2px 0 0">${esc(x.note)}</div>` : ""}</div><button class="btn ghost sm" data-act="entry-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Aucune séance notée.</li>`}</ul>
  </section></div>`;
    },
    settings: (id, { config: c }) => `<div class="field-row"><label>Début du protocole<input type="date" data-set-mod="${esc(id)}.start" value="${esc(c.start || "")}"></label><label>Durée (semaines)<input type="number" min="1" max="520" data-set-mod="${esc(id)}.weeks" value="${esc(c.weeks)}"></label></div>
    <div class="field-row" style="margin-top:8px"><label>Unité<input data-set-mod="${esc(id)}.unitLabel" value="${esc(c.unitLabel)}" placeholder="min"></label><label>Séances visées par semaine<input type="number" min="1" max="7" data-set-mod="${esc(id)}.perWeek" value="${esc(c.perWeek)}"></label></div>`,
    summary(id, inst) {
      const c = inst.config;
      if (!c.start) return "Pas encore commencé";
      const w = Math.min(c.weeks, Math.floor(diffDays(todayISO(), c.start) / 7) + 1);
      return `Semaine ${w} sur ${esc(c.weeks)}, ${plural(inst.entries.length, "séance")}, série de ${streakOf(inst.entries.map(x => x.date))} j`;
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
    texts: inst => inst.entries.filter(x => x.note).map(x => ({ text: x.note, date: x.date })),
    timerDone(id, inst, minutes) {
      if (!/^min/i.test(inst.config.unitLabel)) return false; // une séance comptée autrement qu'en minutes : rien à déduire
      toastAction(`Quinze minutes. Les noter dans ${label(id)} ?`, `Noter ${minutes} min`, () => {
        const cur = S().modules[id]; if (!cur) return;
        addJournalEntry(cur, { date: todayISO(), value: minutes }, uid(), todayISO()); site.save(); render(); toast("Noté. Le corps a fait sa part.");
      }, 15000);
      return true;
    },
    context(inst, nm) {
      const c = inst.config;
      return `\n${nm} : ${c.start ? `protocole de ${c.weeks} semaines commencé le ${c.start}, ${inst.entries.length} séances, objectif ${c.perWeek}/semaine. Dernières notes : ${inst.entries.slice(-3).map(x => `${x.date} ${x.value ?? "?"} ${c.unitLabel} ${x.note || ""}`).join(" ; ")}` : "pas commencé"}`;
    },
    add(id, inst) {
      openForm("Noter une séance", [{ row: [{ n: "date", l: "Date", t: "date", req: true }, { n: "value", l: `Durée (${inst.config.unitLabel})`, t: "number" }] }, { n: "note", l: "Ce qui s'est passé", t: "textarea", rows: 4 }],
        { date: todayISO(), value: lastValue(inst) ?? "" }, v => { addJournalEntry(inst, { date: v.date, value: v.value, note: v.note }, uid(), todayISO()); site.save(); render(); });
    },
    click: {
      "prog-quick": el => { const inst = instOf(el), v = lastValue(inst); addJournalEntry(inst, { date: todayISO(), value: v }, uid(), todayISO()); site.save(); render(); toast(`${v} ${inst.config.unitLabel} notées. Le corps a fait sa part.`); },
      "prog-start": el => { instOf(el).config.start = todayISO(); site.save(); render(); }
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
    <ul class="plain" style="margin-top:10px">${(pg => pg.items.map(f => `<li class="item" data-id="${esc(f.id)}"><span></span><div style="white-space:pre-wrap">${esc(f.text)}<div class="meta">${fmt(f.date)}${c.categories.length ? catSelect("", f.category || "", "", `data-act="scrap-cat" data-mod="${esc(id)}"`) : ""}${epSelect(id, f)}${originHTML(f, f.text)}</div>${linksHTML(id, f)}</div><button class="btn ghost sm" data-act="scrap-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") + pg.more)(paged(`scraps:${id}`, [...inst.scraps].reverse().filter(f => ff === "*" || (f.category || "") === ff))) || `<li class="empty">Rien pour l'instant.</li>`}</ul>
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
    texts: inst => [...(inst.scraps || []).map(f => ({ text: f.text, date: f.date, ep: f.ep })), ...inst.config.categories.map(c => ({ text: c.name }))],
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
  </section><section><h3>Journal</h3><ul class="plain">${recent.map(l => `<li class="item" data-id="${esc(l.id)}"><span></span><div><span class="tag">${esc(l.type)}</span> ${fmt(l.date)}${l.note ? `<div class="note" style="margin:2px 0 0">${esc(l.note)}</div>` : ""}${l.origin ? `<div class="meta">${originHTML(l, l.note)}</div>` : ""}</div><button class="btn ghost sm" data-act="entry-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Aucune entrée.</li>`}</ul></section></div>`;
    },
    settings: (id, { config: c }) => `<div class="field-row"><label>Sous-titre (ex. nom propre)<input data-set-mod="${esc(id)}.subtitle" value="${esc(c.subtitle || "")}"></label><span></span></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">Types et rappels</span>${c.types.map((t, i) => `<div class="set" data-ti="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="typ-name" data-mod="${esc(id)}" value="${esc(t.label)}" aria-label="Nom"><input type="number" min="0" data-act="typ-every" data-mod="${esc(id)}" value="${esc(t.every || "")}" placeholder="tous les X j" aria-label="Fréquence"><button class="btn ghost sm" data-act="typ-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}<button class="btn sm" data-act="typ-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter un type</button></div>`,
    summary(id, inst) {
      const t = inst.config.types[0];
      return t ? `${esc(t.label)} : ${ago(lastOf(inst, t.id))}` : plural(inst.entries.length, "entrée");
    },
    alerts: (id, inst, now) => inst.config.types.filter(t => t.every).flatMap(t => {
      const l = lastOf(inst, t.id);
      return !l || diffDays(now, l) >= t.every ? [{ text: `${esc(t.label)} : ${esc(label(id))} (${ago(l)})`,
        actions: `<button class="btn sm" data-act="entry-log" data-mod="${esc(id)}" data-t="${esc(t.id)}">fait</button><a class="btn ghost sm" href="#${esc(id)}">voir</a>` }] : [];
    }),
    accept: (id, inst, note) => { addJournalEntry(inst, { date: note.date, type: "note", note: note.text }, uid(), todayISO()); },
    recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${(inst.config.types.find(t => t.id === x.type) || {}).label || x.type}${x.note ? " · " + x.note : ""}`),
    review: (inst, from, to) => { const es = within(inst.entries, from, to); if (!es.length) return "Rien de noté"; const by = [...new Set(es.map(x => x.type))].map(t => `${((inst.config.types.find(y => y.id === t) || {}).label || t).toLowerCase()} ×${es.filter(x => x.type === t).length}`); return by.join(", "); },
    texts: inst => inst.entries.filter(x => x.note).map(x => ({ text: x.note, date: x.date })),
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
const modOf = el => el.closest("[data-mod]").dataset.mod;
const itemOf = el => S().modules[modOf(el)].entries.find(x => x.id === idOf(el));
const collectionDoneLines = ["« %t » est passé à « %s ». Le monde n'a rien remarqué, comme prévu.", "« %t » : %s. Une chose de moins qui attend ton attention.", "%s : « %t ». L'Œuvre avance, à pas de lichen."];
/* Dernier réexamen d'un élément (collection en mode révision) : quand, et ce qu'il en est sorti. */
const reviewedHTML = e => { const r = (e.reviews || []).at(-1); return r ? `<span>${esc(r.verdict)} le ${fmt(r.date)}</span>` : ""; };
function collectionForm(id, item) {
  const c = S().modules[id].config, f = c.fields;
  const extra = [f.subtitle && { n: "subtitle", l: f.subtitle }, f.tag && { n: "tag", l: f.tag }, f.due && { n: "due", l: f.due, t: "date" }].filter(Boolean);
  const fields = [{ n: "title", l: f.title, req: true }];
  for (let i = 0; i < extra.length; i += 2) fields.push({ row: extra.slice(i, i + 2) });
  fields.push({ n: "status", l: c.statusLabel, t: "select", o: c.statuses });
  if (f.text) fields.push({ n: "text", l: f.text, t: "textarea", rows: c.display === "colonnes" ? 6 : 3 });
  openForm(item ? `Modifier « ${item.title} »` : c.addLabel, fields, item || { status: c.statuses[0] }, v => {
    const inst = S().modules[id]; // relu : une synchro a pu remplacer les données pendant la saisie
    if (!inst) return toast("Ce module a été supprimé entre-temps.");
    saveCollectionItem(inst, v, item ? item.id : uid(), todayISO()); site.save(); render();
  });
}
function collectionCard(id, e, ci, last) {
  const f = S().modules[id].config.fields, meta = [f.tag && e.tag ? `<span class="tag">${esc(e.tag)}</span>` : "", f.due && e.due ? `<span>${fmt(e.due)}</span>` : "", originHTML(e, e.title)].join("");
  return `<div class="card" data-id="${esc(e.id)}"><b>${esc(e.title)}</b>${f.subtitle && e.subtitle ? `, <i>${esc(e.subtitle)}</i>` : ""}${meta ? `<div class="meta">${meta}</div>` : ""}${f.text && e.text ? `<p>${esc(e.text.slice(0, 160))}${e.text.length > 160 ? "…" : ""}</p>` : ""}
      <div class="row">${ci > 0 ? `<button class="btn ghost sm" data-act="col-move" data-d="-1" aria-label="Reculer">←</button>` : ""}${ci < last ? `<button class="btn ghost sm" data-act="col-move" data-d="1" aria-label="Avancer">→</button>` : ""}<span class="spacer"></span><button class="btn ghost sm" data-act="col-edit">modifier</button><button class="btn ghost sm" data-act="col-del">suppr.</button></div></div>`;
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
      <div class="row"><select data-act="col-st" aria-label="${esc(c.statusLabel)}">${c.statuses.map(st => `<option ${st === e.status ? "selected" : ""}>${esc(st)}</option>`).join("")}</select>${n ? `<button class="btn ghost sm" data-act="search-for" data-q="${esc(e.title)}">voir</button>` : ""}<button class="btn ghost sm" data-act="col-edit">modifier</button><button class="btn ghost sm" data-act="col-del">suppr.</button></div></li>`;
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
    const head = `<div class="row" style="margin-bottom:${c.display === "colonnes" ? 20 : 8}px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn acc" data-act="col-new">${esc(c.addLabel)}</button></div>${c.description ? `<p class="hint">${esc(c.description)}</p>` : ""}`;
    if (c.concordance) return concordanceView(id, inst, head);
    const panel = groupPanel(id, `Part arrivée à « ${esc(c.statuses[c.doneFrom])} » dans chaque groupe. Clique pour filtrer.`);
    if (c.display === "colonnes") {
      const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
      return `<div data-mod="${esc(id)}">${head}<div class="board" style="margin-bottom:34px">${c.statuses.map((st, ci) => { const col = items.filter(e => e.status === st).sort(byDue);
        return `<div class="col"><h3>${esc(st)} <span class="hint" style="font-size:.95rem">${col.length}</span></h3>${col.map(e => collectionCard(id, e, ci, c.statuses.length - 1)).join("") || `<p class="empty">Vide.</p>`}</div>`; }).join("")}</div>${panel}</div>`;
    }
    const filter = colFilter[id] || "", shown = items.filter(e => !filter || e.status === filter);
    return `<div data-mod="${esc(id)}">${head}
  <div class="row" style="margin-bottom:10px"><select data-act="col-f" aria-label="Filtrer"><option value="">Tous</option>${c.statuses.map(st => `<option ${st === filter ? "selected" : ""}>${esc(st)}</option>`).join("")}</select></div>
  <div class="two"><div><ul class="plain">${(pg => pg.items.map(e => `<li class="item" data-id="${esc(e.id)}"><span></span><div><b>${esc(e.title)}</b>${f.subtitle ? (e.subtitle ? `, <i>${esc(e.subtitle)}</i>` : ` <span class="hint">${esc(f.subtitle.toLowerCase())} à préciser</span>`) : ""}${f.tag && e.tag ? ` <span class="tag">${esc(e.tag)}</span>` : ""}${f.due && e.due ? ` <span class="hint">${c.review ? "à réexaminer le " : ""}${fmt(e.due)}</span>` : ""}${f.text && e.text ? `<div class="note" style="margin:2px 0 0">${esc(e.text)}</div>` : ""}${reviewedHTML(e) || e.origin ? `<div class="meta">${reviewedHTML(e)}${originHTML(e, e.title)}</div>` : ""}</div>
    <div class="row"><select data-act="col-st" aria-label="${esc(c.statusLabel)}">${c.statuses.map(st => `<option ${st === e.status ? "selected" : ""}>${esc(st)}</option>`).join("")}</select><button class="btn ghost sm" data-act="col-edit">modifier</button><button class="btn ghost sm" data-act="col-del">suppr.</button></div></li>`).join("") + pg.more)(paged(`col:${id}`, shown)) || `<li class="empty">Rien dans ce filtre.</li>`}</ul></div><div>${panel}</div></div></div>`;
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
  texts: inst => inst.entries.map(e => ({ text: [e.title, e.subtitle, e.tag, e.text].filter(Boolean).join(" · "), date: e.due || null })),
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
    "col-move": el => {
      const c = S().modules[modOf(el)].config, e = itemOf(el), i = Math.max(0, Math.min(c.statuses.length - 1, c.statuses.indexOf(e.status) + +el.dataset.d));
      e.status = c.statuses[i]; site.save(); render();
      if (i === c.statuses.length - 1) toast(collectionDoneLines[Math.floor(Math.random() * collectionDoneLines.length)].replace("%t", e.title).replace("%s", e.status));
    },
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
function taskHTML(id, t) {
  const c = S().modules[id].config, d = dueLabel(t), sd = (t.steps || []).filter(x => x.d).length, ef = Math.min(3, Math.max(1, Math.round(+t.effort) || 1));
  return `<li class="item ${t.done ? "done" : ""} ${openId === t.id ? "open" : ""}" data-task="${esc(t.id)}" data-mod="${esc(id)}">
    <input type="checkbox" class="check" data-act="task-done" ${t.done ? "checked" : ""} aria-label="Marquer comme fait">
    <div><button class="t-title" data-act="task-open">${esc(t.title)}</button>
      <div class="meta">${t.room ? `<span class="tag">${esc(t.room)}</span>` : ""}<span class="${t.done ? "" : d.cls}">${esc(d.txt)}</span><span>${esc(t.cat)}</span><span>${"●".repeat(ef)}${"○".repeat(3 - ef)}</span>${(t.steps || []).length ? `<span>${sd}/${t.steps.length} étapes</span>` : ""}${c.costs && t.cost ? `<span>${esc(t.cost)} €</span>` : ""}</div></div>
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
    const filtered = o.filter(t => (!f.room || t.room === f.room) && (!f.cat || t.cat === f.cat) && gMatch(id, t)).sort(byDue);
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
  texts: inst => inst.entries.map(t => ({ text: [t.title, t.room, t.note, ...(t.steps || []).map(x => x.t)].filter(Boolean).join(" · "), date: t.due || t.created })),
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
    <ul class="plain">${shown.map(e => `<li class="item" data-id="${esc(e.id)}"><span></span><div>${esc(e.note || e.cat || e.type)}<div class="meta">${fmt(e.date)}${e.cat ? `<span class="tag">${esc(e.cat)}</span>` : ""}</div></div><div class="row"><b class="${e.type === "revenu" ? "pos" : ""}">${e.type === "revenu" ? "+" : "−"}${money(e.amount)}</b><button class="btn ghost sm" data-act="bud-del">suppr.</button></div></li>`).join("") || `<li class="empty">Aucune opération ce mois-ci. Suspect.</li>`}</ul></section>
  <div>${groupPanel(id, "Part de chaque enveloppe mensuelle déjà consommée. Le rouge signale le dépassement.")}
    ${tasksLeft ? `<p class="hint">Les tâches en cours estiment encore ${money(tasksLeft)} de dépenses à venir.</p>` : ""}</div></div></div>`;
  },
  settings: (id, { config: c }) => `<div><span class="hint" style="margin:0">Enveloppes mensuelles</span>${c.envelopes.map((v, i) => `<div class="set" data-vi="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="env-name" data-mod="${esc(id)}" value="${esc(v.name)}" aria-label="Nom de l'enveloppe"><input type="number" min="0" data-act="env-limit" data-mod="${esc(id)}" value="${esc(v.limit || "")}" placeholder="€ / mois" aria-label="Plafond mensuel"><button class="btn ghost sm" data-act="env-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}<button class="btn sm" data-act="env-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter une enveloppe</button></div>`,
  recent: inst => recentBy(inst.entries).map(e => `${fmt(e.date)} · ${e.note || e.cat || e.type} · ${e.type === "revenu" ? "+" : "−"}${money(e.amount)}`),
  review: (inst, from, to) => { const es = within(inst.entries, from, to), out = sumOf(es, "dépense"), inn = sumOf(es, "revenu"); return `${money(out)} dépensés, ${money(inn)} reçus, solde ${money(inn - out)}`; },
  texts: inst => inst.entries.filter(e => e.note || e.cat).map(e => ({ text: [e.note, e.cat, money(e.amount)].filter(Boolean).join(" · "), date: e.date })),
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
    return `<div data-mod="${esc(id)}"><h2>${esc(label(id))}</h2>${c.description ? `<p class="hint">${esc(c.description)}</p>` : ""}
  ${deriveBanner(id)}<div class="capture" style="margin-bottom:18px"><input id="noteIn" data-draft placeholder="${esc(c.placeholder)}" aria-label="Nouvelle note"><button class="btn acc" data-act="note-add">Garder</button></div>
  <ul class="plain">${(pg => pg.items.map(x => { const intent = captureIntent(x.text); return `<li class="item" data-id="${esc(x.id)}"><span></span><div>${esc(x.text)}<div class="meta">${fmt(x.date)}${epSelect(id, x)}${originHTML(x, x.text)}</div>${linksHTML(id, x)}
    ${intent && intent.to !== id ? `<div class="row" style="margin-top:6px"><button class="btn sm acc" data-act="note-file">Ranger : ${esc(intent.say)}</button></div>` : ""}
    ${targets.length ? `<div class="row" style="margin-top:6px">${targets.map(k => `<button class="btn sm" data-act="note-to" data-to="${esc(k)}">→ ${esc(label(k))}</button>`).join("")}</div>` : ""}</div>
    <button class="btn ghost sm" data-act="note-del">suppr.</button></li>`; }).join("") + pg.more)(paged(`notes:${id}`, [...inst.entries].reverse())) || `<li class="empty">${c.inbox ? "Vide. Le silence d'une clairière, ou celui d'un cerveau." : "Rien pour l'instant."}</li>`}</ul></div>`;
  },
  settings: (id, { config: c }) => `<label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="notes-inbox" data-mod="${esc(id)}" ${c.inbox ? "checked" : ""}>Boîte de réception : reçoit la capture rapide de l'accueil</label>
    <div class="field-row" style="margin-top:8px"><label>Description<input data-set-mod="${esc(id)}.description" value="${esc(c.description)}" placeholder="Une phrase sous le titre"></label><label>Texte d'invite<input data-set-mod="${esc(id)}.placeholder" value="${esc(c.placeholder)}" required></label></div>`,
  summary: (id, inst) => inst.config.inbox ? `${inst.entries.length} à trier` : plural(inst.entries.length, "note"),
  context: (inst, nm) => `\n${nm}${inst.config.inbox ? " (à trier)" : ""} : ${inst.entries.map(x => x.text).join(" ; ") || "vide"}`,
  badge: inst => inst.config.inbox ? inst.entries.length : 0,
  recent: inst => inst.entries.slice(-3).reverse().map(x => x.text.length > 80 ? x.text.slice(0, 80) + "…" : x.text),
  review: (inst, from, to) => plural(within(inst.entries, from, to).length, "note"),
  texts: inst => inst.entries.map(x => ({ text: x.text, date: x.date, ep: x.ep })),
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
  deriveFrom[mod] = [`${mod}/${id}`]; render();
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
      return `<div class="card" data-id="${esc(p.id)}">${hit ? `<span class="tag">${esc(label(hit.mod))}</span><p style="margin:6px 0">${esc(excerpt(hit.e, 140))}</p>${hit.e.date ? `<div class="meta">${fmt(hit.e.date)}</div>` : ""}` : `<i>(supprimé)</i>`}<div class="row"><button class="btn ghost sm" data-act="arc-remove" data-mod="${esc(id)}">retirer</button></div></div>`;
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
