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
     click / change        actions propres au type, fusionnées dans CLICK / CHANGE */

const lastOf = (inst, type) => inst.entries.filter(x => x.type === type).map(x => x.date).sort().pop();
const totalOf = inst => inst.entries.reduce((a, x) => a + (+x.value || 0), 0);
const instOf = el => S().modules[el.dataset.mod];
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

function programmeGroupPanel(id) {
  const inst = S().modules[id], c = inst.config, now = todayISO();
  const days = new Set(inst.entries.map(x => x.date)), cur = Math.min(52, +c.weeks || 12, Math.floor(diffDays(now, c.start) / 7) + 1), out = [];
  for (let w = 0; w < cur; w++) { let n = 0; for (let d = 0; d < 7; d++) if (days.has(addDaysTo(c.start, w * 7 + d))) n++; const den = +c.perWeek || 1; out.push({ name: `Semaine ${w + 1}`, pct: Math.min(100, Math.round(100 * n / den)), sub: `${n} sur ${den} séances` }); }
  return `<section><h3 style="margin:0 0 4px">Par semaine</h3><p class="hint">Objectif : ${esc(c.perWeek)} séances par semaine, réglable dans Réglages.</p>
    <div class="rooms">${out.map(g => `<div class="room ${g.pct > 100 ? "over" : ""}"><div class="fill" style="height:${Math.min(100, g.pct)}%"></div><small>${esc(g.name)}</small><b>${g.pct} %</b><small>${esc(g.sub)}</small></div>`).join("") || `<p class="empty">Rien à regrouper pour l'instant.</p>`}</div></section>`;
}
function cumulGroupPanel(id) {
  const inst = S().modules[id], c = inst.config;
  const sum = catId => inst.entries.filter(x => (x.category || "") === catId).reduce((a, x) => a + (+x.value || 0), 0);
  const out = c.categories.map(cat => { const v = sum(cat.id), g = +cat.goal || 0; return { name: cat.name || "Sans titre", pct: g ? Math.min(100, Math.round(100 * v / g)) : null, sub: g ? `${v.toLocaleString("fr-FR")} / ${g.toLocaleString("fr-FR")} ${c.unitLabel}` : `${v.toLocaleString("fr-FR")} ${c.unitLabel}` }; });
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
    settings: (id, { config: c }) => `<div class="field-row"><label>Début du protocole<input type="date" data-set-mod="${esc(id)}.start" value="${esc(c.start || "")}"></label><label>Durée (semaines)<input type="number" min="1" data-set-mod="${esc(id)}.weeks" value="${esc(c.weeks)}"></label></div>
    <div class="field-row" style="margin-top:8px"><label>Unité<input data-set-mod="${esc(id)}.unitLabel" value="${esc(c.unitLabel)}" placeholder="min"></label><label>Séances visées par semaine<input type="number" min="1" max="7" data-set-mod="${esc(id)}.perWeek" value="${esc(c.perWeek)}"></label></div>`,
    summary(id, inst) {
      const c = inst.config;
      if (!c.start) return "Pas encore commencé";
      const w = Math.min(c.weeks, Math.floor(diffDays(todayISO(), c.start) / 7) + 1);
      return `Semaine ${w} sur ${esc(c.weeks)}, ${plural(inst.entries.length, "séance")}, série de ${streakOf(inst.entries.map(x => x.date))} j`;
    },
    alerts(id, inst, now) {
      if (!inst.config.start) return [];
      const done = inst.entries.some(x => x.date === now), name = esc(label(id)).toLowerCase();
      return [{ text: done ? `Séance de ${name} faite.` : `Pas encore de séance de ${name} aujourd'hui.`, quick: done ? null : id }];
    },
    context(inst, nm) {
      const c = inst.config;
      return `\n${nm} : ${c.start ? `protocole de ${c.weeks} semaines commencé le ${c.start}, ${inst.entries.length} séances, objectif ${c.perWeek}/semaine. Dernières notes : ${inst.entries.slice(-3).map(x => `${x.date} ${x.value ?? "?"} ${c.unitLabel} ${x.note || ""}`).join(" ; ")}` : "pas commencé"}`;
    },
    add(id, inst) {
      openForm("Noter une séance", [{ row: [{ n: "date", l: "Date", t: "date", req: true }, { n: "value", l: `Durée (${inst.config.unitLabel})`, t: "number" }] }, { n: "note", l: "Ce qui s'est passé", t: "textarea", rows: 4 }],
        { date: todayISO(), value: "" }, v => { addJournalEntry(inst, { date: v.date, value: v.value, note: v.note }, uid(), todayISO()); site.save(); render(); });
    },
    click: {
      "prog-start": el => { instOf(el).config.start = todayISO(); site.save(); render(); }
    }
  },

  cumul: {
    view(id) {
      const inst = S().modules[id], c = inst.config;
      const tot = totalOf(inst), pct = Math.min(100, Math.round(100 * tot / (+c.goal || 1)));
      const last = inst.entries.map(x => x.date).sort().pop();
      return `<h2>${esc(label(id))}</h2>${c.title ? `<p class="hint">${esc(c.title)}</p>` : ""}
  <div class="two"><section>
    <div class="big">${tot.toLocaleString("fr-FR")} <span class="hint" style="font-size:1.1rem">${esc(c.unitLabel)} sur ${(+c.goal).toLocaleString("fr-FR")}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">Dernière session ${ago(last)}. Série de ${streakOf(inst.entries.map(x => x.date))} jour(s).</p>
    <div class="row"><input type="number" id="cumIn" min="1" placeholder="${esc(c.unitLabel)} aujourd'hui" style="max-width:200px" inputmode="numeric">${c.categories.length ? `<select id="cumCat" aria-label="${esc(c.categoryLabel)}" style="max-width:220px"><option value="">Hors ${esc(c.categoryLabel).toLowerCase()}</option>${c.categories.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select>` : ""}<button class="btn acc" data-act="entry-add" data-mod="${esc(id)}">Ajouter</button></div>
    <div style="margin-top:28px">${c.categories.length ? cumulGroupPanel(id) : `<p class="hint">Ajoute des ${esc(c.categoryLabel).toLowerCase()}s dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a> pour suivre chacune en pourcentage.</p>`}</div>
  </section>${c.scraps ? `<section><h3>${esc(c.scrapsLabel)}</h3><p class="hint">Une phrase qui passe, avant qu'elle ne reparte.</p>
    <textarea id="scrapIn" rows="3" placeholder="…" aria-label="Nouveau"></textarea><div class="row" style="margin-top:8px"><button class="btn" data-act="scrap-add" data-mod="${esc(id)}">Garder</button></div>
    <ul class="plain" style="margin-top:14px">${[...inst.scraps].reverse().map(f => `<li class="item" data-id="${esc(f.id)}"><span></span><div style="white-space:pre-wrap">${esc(f.text)}<div class="meta">${fmt(f.date)}</div></div><button class="btn ghost sm" data-act="scrap-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Rien pour l'instant.</li>`}</ul>
  </section>` : ""}</div>`;
    },
    settings: (id, { config: c }) => `<div class="field-row"><label>Titre / sous-titre<input data-set-mod="${esc(id)}.title" value="${esc(c.title || "")}"></label><label>Objectif<input type="number" min="1" data-set-mod="${esc(id)}.goal" value="${esc(c.goal)}"></label></div>
    <div class="field-row" style="margin-top:8px"><label>Unité<input data-set-mod="${esc(id)}.unitLabel" value="${esc(c.unitLabel)}" placeholder="mots"></label><label>Nom des catégories<input data-set-mod="${esc(id)}.categoryLabel" value="${esc(c.categoryLabel)}" placeholder="Chapitre"></label></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">${esc(c.categoryLabel)}s</span>${c.categories.map((cat, i) => `<div class="set" data-ci="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="cat-name" data-mod="${esc(id)}" value="${esc(cat.name)}" aria-label="Nom"><input type="number" min="0" data-act="cat-goal" data-mod="${esc(id)}" value="${esc(cat.goal || "")}" placeholder="Objectif" aria-label="Objectif"><div class="row"><button class="btn ghost sm" data-act="cat-up" data-mod="${esc(id)}" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="cat-del" data-mod="${esc(id)}">suppr.</button></div></div>`).join("")}<button class="btn sm" data-act="cat-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter</button></div>`,
    summary(id, inst) {
      const c = inst.config;
      return `${totalOf(inst).toLocaleString("fr-FR")} ${esc(c.unitLabel)} sur ${(+c.goal).toLocaleString("fr-FR")}${c.scraps ? `, ${inst.scraps.length} ${esc(c.scrapsLabel).toLowerCase()}` : ""}`;
    },
    context(inst, nm) {
      const c = inst.config;
      return `\n${nm}${c.title ? ` « ${c.title} »` : ""} : ${totalOf(inst)} ${c.unitLabel} sur ${c.goal}.${c.categories.length ? ` ${c.categoryLabel}s : ${c.categories.map(x => x.name).join(", ")}.` : ""}${c.scraps ? ` Derniers ${c.scrapsLabel.toLowerCase()} : ${inst.scraps.slice(-3).map(f => f.text.slice(0, 200)).join(" / ") || "aucun"}` : ""}`;
    },
    add(id, inst) {
      const v = +$("#cumIn").value; if (!v) return;
      addJournalEntry(inst, { date: todayISO(), value: v, category: $("#cumCat") ? $("#cumCat").value : "" }, uid(), todayISO());
      $("#cumIn").value = ""; site.save(); render(); toast(`${v} ${inst.config.unitLabel}. Ça avance, que tu y croies ou non.`);
    },
    click: {
      "scrap-add": el => { const v = $("#scrapIn").value.trim(); if (!v) return; instOf(el).scraps.push({ id: uid(), text: v, date: todayISO() }); $("#scrapIn").value = ""; site.save(); render(); },
      "scrap-del": async el => { const inst = instOf(el); if (await ask("Supprimer ce fragment ?")) { inst.scraps = inst.scraps.filter(x => x.id !== idOf(el)); site.save(); render(); } },
      "cat-add": el => { const inst = instOf(el); inst.config.categories.push({ id: uid(), name: `${inst.config.categoryLabel} ${inst.config.categories.length + 1}`, goal: 0 }); site.save(); render(); },
      "cat-del": async el => { const inst = instOf(el), i = +el.closest("[data-ci]").dataset.ci, cat = inst.config.categories[i]; if (!await ask(`Supprimer « ${cat.name} » ? Les entrées déjà ajoutées passeront hors catégorie.`)) return; inst.entries.forEach(x => { if (x.category === cat.id) x.category = ""; }); inst.config.categories.splice(i, 1); site.save(); render(); },
      "cat-up": el => { const a = instOf(el).config.categories, i = +el.closest("[data-ci]").dataset.ci; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } }
    },
    change: {
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
    <div class="row" style="margin-top:14px"><input id="rapNote" placeholder="Observation…" aria-label="Observation"><button class="btn" data-act="entry-note" data-mod="${esc(id)}">Noter</button></div>
    <p class="hint" style="margin-top:10px">Réglable dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a>.</p>
  </section><section><h3>Journal</h3><ul class="plain">${recent.map(l => `<li class="item" data-id="${esc(l.id)}"><span></span><div><span class="tag">${esc(l.type)}</span> ${fmt(l.date)}${l.note ? `<div class="note" style="margin:2px 0 0">${esc(l.note)}</div>` : ""}</div><button class="btn ghost sm" data-act="entry-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Aucune entrée.</li>`}</ul></section></div>`;
    },
    settings: (id, { config: c }) => `<div class="field-row"><label>Sous-titre (ex. nom propre)<input data-set-mod="${esc(id)}.subtitle" value="${esc(c.subtitle || "")}"></label><span></span></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">Types et rappels</span>${c.types.map((t, i) => `<div class="set" data-ti="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="typ-name" data-mod="${esc(id)}" value="${esc(t.label)}" aria-label="Nom"><input type="number" min="0" data-act="typ-every" data-mod="${esc(id)}" value="${esc(t.every || "")}" placeholder="tous les X j" aria-label="Fréquence"><button class="btn ghost sm" data-act="typ-del" data-mod="${esc(id)}">suppr.</button></div>`).join("")}<button class="btn sm" data-act="typ-add" data-mod="${esc(id)}" style="margin-top:8px">Ajouter un type</button></div>`,
    summary(id, inst) {
      const t = inst.config.types[0];
      return t ? `${esc(t.label)} : ${ago(lastOf(inst, t.id))}` : plural(inst.entries.length, "entrée");
    },
    alerts: (id, inst, now) => inst.config.types.filter(t => t.every).flatMap(t => {
      const l = lastOf(inst, t.id);
      return !l || diffDays(now, l) >= t.every ? [{ text: `${esc(t.label)} : ${esc(label(id))} (${ago(l)})`, href: `#${id}` }] : [];
    }),
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
    saveCollectionItem(inst, v, item ? item.id : uid()); site.save(); render();
  });
}
function collectionCard(id, e, ci, last) {
  const f = S().modules[id].config.fields, meta = [f.tag && e.tag ? `<span class="tag">${esc(e.tag)}</span>` : "", f.due && e.due ? `<span>${fmt(e.due)}</span>` : ""].join("");
  return `<div class="card" data-id="${esc(e.id)}"><b>${esc(e.title)}</b>${f.subtitle && e.subtitle ? `, <i>${esc(e.subtitle)}</i>` : ""}${meta ? `<div class="meta">${meta}</div>` : ""}${f.text && e.text ? `<p>${esc(e.text.slice(0, 160))}${e.text.length > 160 ? "…" : ""}</p>` : ""}
      <div class="row">${ci > 0 ? `<button class="btn ghost sm" data-act="col-move" data-d="-1" aria-label="Reculer">←</button>` : ""}${ci < last ? `<button class="btn ghost sm" data-act="col-move" data-d="1" aria-label="Avancer">→</button>` : ""}<span class="spacer"></span><button class="btn ghost sm" data-act="col-edit">modifier</button><button class="btn ghost sm" data-act="col-del">suppr.</button></div></div>`;
}
TYPE_UI.collection = {
  view(id) {
    const inst = S().modules[id], c = inst.config, f = c.fields, items = inst.entries.filter(e => gMatch(id, e));
    const head = `<div class="row" style="margin-bottom:${c.display === "colonnes" ? 20 : 8}px"><h2 style="margin:0">${esc(label(id))}</h2><span class="spacer"></span><button class="btn acc" data-act="col-new">${esc(c.addLabel)}</button></div>${c.description ? `<p class="hint">${esc(c.description)}</p>` : ""}`;
    const panel = groupPanel(id, `Part arrivée à « ${esc(c.statuses[c.doneFrom])} » dans chaque groupe. Clique pour filtrer.`);
    if (c.display === "colonnes") {
      const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
      return `<div data-mod="${esc(id)}">${head}<div class="board" style="margin-bottom:34px">${c.statuses.map((st, ci) => { const col = items.filter(e => e.status === st).sort(byDue);
        return `<div class="col"><h3>${esc(st)} <span class="hint" style="font-size:.95rem">${col.length}</span></h3>${col.map(e => collectionCard(id, e, ci, c.statuses.length - 1)).join("") || `<p class="empty">Vide.</p>`}</div>`; }).join("")}</div>${panel}</div>`;
    }
    const filter = colFilter[id] || "", shown = items.filter(e => !filter || e.status === filter);
    return `<div data-mod="${esc(id)}">${head}
  <div class="row" style="margin-bottom:10px"><select data-act="col-f" aria-label="Filtrer"><option value="">Tous</option>${c.statuses.map(st => `<option ${st === filter ? "selected" : ""}>${esc(st)}</option>`).join("")}</select></div>
  <div class="two"><div><ul class="plain">${shown.map(e => `<li class="item" data-id="${esc(e.id)}"><span></span><div><b>${esc(e.title)}</b>${f.subtitle ? (e.subtitle ? `, <i>${esc(e.subtitle)}</i>` : ` <span class="hint">${esc(f.subtitle.toLowerCase())} à préciser</span>`) : ""}${f.tag && e.tag ? ` <span class="tag">${esc(e.tag)}</span>` : ""}${f.due && e.due ? ` <span class="hint">${fmt(e.due)}</span>` : ""}${f.text && e.text ? `<div class="note" style="margin:2px 0 0">${esc(e.text)}</div>` : ""}</div>
    <div class="row"><select data-act="col-st" aria-label="${esc(c.statusLabel)}">${c.statuses.map(st => `<option ${st === e.status ? "selected" : ""}>${esc(st)}</option>`).join("")}</select><button class="btn ghost sm" data-act="col-edit">modifier</button><button class="btn ghost sm" data-act="col-del">suppr.</button></div></li>`).join("") || `<li class="empty">Rien dans ce filtre.</li>`}</ul></div><div>${panel}</div></div></div>`;
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
    <div class="field-row" style="margin-top:10px"><label>Compte comme fait à partir de<select data-act="col-done" data-mod="${fid}">${c.statuses.map((st, i) => i ? `<option value="${i}" ${c.doneFrom === i ? "selected" : ""}>${esc(st)}</option>` : "").join("")}</select></label><span></span></div>`;
  },
  summary: (id, inst) => inst.config.statuses.map(st => [st, inst.entries.filter(e => e.status === st).length]).filter(([, n]) => n).map(([st, n]) => `${esc(st)} : ${n}`).join(", ") || "Vide",
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
    "col-del": async el => { const id = modOf(el), e = itemOf(el); if (!await ask(`Supprimer « ${e.title} » ?`)) return; const inst = S().modules[id]; inst.entries = inst.entries.filter(x => x.id !== e.id); site.save(); render(); },
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
    "st-name": el => {
      const inst = instOf(el), c = inst.config, i = +el.closest("[data-si]").dataset.si, from = c.statuses[i], to = el.value.trim();
      if (!to || to === from) return render();
      if (c.statuses.includes(to)) { toast(`« ${to} » existe déjà.`); return render(); }
      c.statuses[i] = to; inst.entries.forEach(e => { if (e.status === from) e.status = to; });
      site.save(); el.blur(); render();
    }
  }
};
// Les actions propres à chaque type rejoignent les tables d'actions globales (un nom en double serait un bug).
for (const [type, ui] of Object.entries(TYPE_UI)) for (const [table, acts] of [[CLICK, ui.click], [CHANGE, ui.change]]) for (const [act, fn] of Object.entries(acts || {})) {
  if (Object.hasOwn(table, act)) throw new Error(`Action « ${act} » du type ${type} déjà définie`);
  table[act] = fn;
}
