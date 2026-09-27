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
     click / change        actions propres au type, fusionnées dans CLICK / CHANGE */

const lastOf = (inst, type) => inst.entries.filter(x => x.type === type).map(x => x.date).sort().pop();
const totalOf = inst => inst.entries.reduce((a, x) => a + (+x.value || 0), 0);
const instOf = el => S().modules[el.dataset.mod];
const lastValue = inst => { const e = [...inst.entries].sort((a, b) => a.date.localeCompare(b.date)).reverse().find(x => x.value != null); return e ? e.value : null; };
const recentBy = (list, n = 3) => [...list].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, n);
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
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
      const done = inst.entries.some(x => x.date === now), name = esc(label(id)).toLowerCase(), last = lastValue(inst), m = esc(id);
      const actions = done ? "" : last != null
        ? `<button class="btn sm" data-act="prog-quick" data-mod="${m}">Noter ${esc(last)} ${esc(inst.config.unitLabel)}</button><button class="btn ghost sm" data-act="entry-add" data-mod="${m}">autre…</button>`
        : `<button class="btn ghost sm" data-act="entry-add" data-mod="${m}">noter</button>`;
      return [{ text: done ? `Séance de ${name} faite.` : `Pas encore de séance de ${name} aujourd'hui.`, actions }];
    },
    recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${x.value ?? "?"} ${inst.config.unitLabel}${x.note ? " · " + x.note : ""}`),
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
      return `<h2>${esc(label(id))}</h2>${c.title ? `<p class="hint">${esc(c.title)}</p>` : ""}
  <div class="two"><section>
    <div class="big">${tot.toLocaleString("fr-FR")} <span class="hint" style="font-size:1.1rem">${esc(c.unitLabel)} sur ${(+c.goal).toLocaleString("fr-FR")}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">Dernière session ${ago(last)}. Série de ${streakOf(inst.entries.map(x => x.date))} jour(s). ${esc(projection(inst))}</p>
    <div class="row"><input type="number" id="cumIn" min="${total ? 0 : 1}" placeholder="${total ? `Total atteint (${esc(c.unitLabel)})` : `${esc(c.unitLabel)} aujourd'hui`}" style="max-width:200px" inputmode="numeric" aria-label="${total ? "Total atteint" : "Ajout du jour"}">${c.categories.length ? `<select id="cumCat" aria-label="${esc(c.categoryLabel)}" style="max-width:220px"><option value="">Hors ${esc(c.categoryLabel).toLowerCase()}</option>${c.categories.map(x => `<option value="${esc(x.id)}" ${x.id === lastCat ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}<button class="btn acc" data-act="entry-add" data-mod="${esc(id)}">Ajouter</button></div>
    <div style="margin-top:28px">${c.categories.length ? cumulGroupPanel(id) : `<p class="hint">Ajoute des ${esc(c.categoryLabel).toLowerCase()}s dans <a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">Réglages</a> pour suivre chacune en pourcentage.</p>`}</div>
  </section>${c.scraps ? `<section><h3>${esc(c.scrapsLabel)}</h3><p class="hint">Une phrase qui passe, avant qu'elle ne reparte.</p>
    <textarea id="scrapIn" data-draft rows="3" placeholder="…" aria-label="Nouveau"></textarea><div class="row" style="margin-top:8px"><button class="btn" data-act="scrap-add" data-mod="${esc(id)}">Garder</button></div>
    <ul class="plain" style="margin-top:14px">${[...inst.scraps].reverse().map(f => `<li class="item" data-id="${esc(f.id)}"><span></span><div style="white-space:pre-wrap">${esc(f.text)}<div class="meta">${fmt(f.date)}</div></div><button class="btn ghost sm" data-act="scrap-del" data-mod="${esc(id)}">suppr.</button></li>`).join("") || `<li class="empty">Rien pour l'instant.</li>`}</ul>
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
    canAccept: inst => !!inst.config.scraps,
    accept: (id, inst, note) => { inst.scraps.push({ id: uid(), text: note.text, date: note.date }); },
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
      "scrap-add": el => { const v = $("#scrapIn").value.trim(); if (!v) return; instOf(el).scraps.push({ id: uid(), text: v, date: todayISO() }); $("#scrapIn").value = ""; site.save(); render(); },
      "scrap-del": el => removeWithUndo(el.dataset.mod, "scraps", idOf(el)),
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
    <div class="row" style="margin-top:14px"><input id="rapNote" data-draft placeholder="Observation…" aria-label="Observation"><button class="btn" data-act="entry-note" data-mod="${esc(id)}">Noter</button></div>
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
      return !l || diffDays(now, l) >= t.every ? [{ text: `${esc(t.label)} : ${esc(label(id))} (${ago(l)})`,
        actions: `<button class="btn sm" data-act="entry-log" data-mod="${esc(id)}" data-t="${esc(t.id)}">fait</button><a class="btn ghost sm" href="#${esc(id)}">voir</a>` }] : [];
    }),
    accept: (id, inst, note) => { addJournalEntry(inst, { date: note.date, type: "note", note: note.text }, uid(), todayISO()); },
    recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${(inst.config.types.find(t => t.id === x.type) || {}).label || x.type}${x.note ? " · " + x.note : ""}`),
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
  accept: (id, inst, note) => { saveCollectionItem(inst, { title: note.text }, uid()); },
  recent: inst => inst.entries.slice(-3).reverse().map(e => `${e.title}${e.subtitle ? " – " + e.subtitle : ""} · ${e.status}`),
  // Ce qui est prévu aujourd'hui ou en retard, et pas encore « fait ».
  alerts: (id, inst, now) => inst.config.fields.due ? inst.entries.filter(e => e.due && e.due <= now && inst.config.statuses.indexOf(e.status) < inst.config.doneFrom).map(e => ({
    text: `« ${esc(e.title)} » : ${e.due < now ? "en retard" : "prévu aujourd'hui"} (${esc(label(id))})`, href: `#${id}` })) : [],
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
      ${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}
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
    <label style="display:flex;gap:8px;align-items:center;align-self:start;margin-top:26px"><input type="checkbox" data-act="task-costs" data-mod="${esc(id)}" ${c.costs ? "checked" : ""}>Suivre les coûts estimés</label></div>`,
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
    "task-done": el => { setTaskDone(S().modules[taskMod(el)].entries, taskOf(el).id, el.checked, todayISO()); site.save(); render(); if (el.checked) toast(doneLines[Math.floor(Math.random() * doneLines.length)]); },
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
  <div class="capture" style="margin-bottom:18px"><input id="noteIn" data-draft placeholder="${esc(c.placeholder)}" aria-label="Nouvelle note"><button class="btn acc" data-act="note-add">Garder</button></div>
  <ul class="plain">${[...inst.entries].reverse().map(x => `<li class="item" data-id="${esc(x.id)}"><span></span><div>${esc(x.text)}<div class="meta">${fmt(x.date)}</div>
    ${targets.length ? `<div class="row" style="margin-top:6px">${targets.map(k => `<button class="btn sm" data-act="note-to" data-to="${esc(k)}">→ ${esc(label(k))}</button>`).join("")}</div>` : ""}</div>
    <button class="btn ghost sm" data-act="note-del">suppr.</button></li>`).join("") || `<li class="empty">${c.inbox ? "Vide. Le silence d'une clairière, ou celui d'un cerveau." : "Rien pour l'instant."}</li>`}</ul></div>`;
  },
  settings: (id, { config: c }) => `<label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="notes-inbox" data-mod="${esc(id)}" ${c.inbox ? "checked" : ""}>Boîte de réception : reçoit la capture rapide de l'accueil</label>
    <div class="field-row" style="margin-top:8px"><label>Description<input data-set-mod="${esc(id)}.description" value="${esc(c.description)}" placeholder="Une phrase sous le titre"></label><label>Texte d'invite<input data-set-mod="${esc(id)}.placeholder" value="${esc(c.placeholder)}" required></label></div>`,
  summary: (id, inst) => inst.config.inbox ? `${inst.entries.length} à trier` : plural(inst.entries.length, "note"),
  context: (inst, nm) => `\n${nm}${inst.config.inbox ? " (à trier)" : ""} : ${inst.entries.map(x => x.text).join(" ; ") || "vide"}`,
  badge: inst => inst.config.inbox ? inst.entries.length : 0,
  recent: inst => inst.entries.slice(-3).reverse().map(x => x.text.length > 80 ? x.text.slice(0, 80) + "…" : x.text),
  accept: (id, inst, note) => { addCapture(inst.entries, note.text, uid(), note.date); },
  click: {
    "note-add": el => {
      const inp = $("#noteIn"); if (!inp || !inp.value.trim()) return;
      addCapture(S().modules[modOf(el)].entries, inp.value, uid(), todayISO()); inp.value = ""; site.save(); render();
    },
    "note-del": el => removeWithUndo(modOf(el), "entries", idOf(el)),
    "note-to": el => {
      const s = S(), src = s.modules[modOf(el)], note = src.entries.find(x => x.id === idOf(el)), to = el.dataset.to;
      const drop = () => { src.entries = src.entries.filter(x => x !== note); site.save(); };
      const target = s.modules[to], then = TYPE_UI[target.type].accept(to, target, note);
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
// Les actions propres à chaque type rejoignent les tables d'actions globales (un nom en double serait un bug).
for (const [type, ui] of Object.entries(TYPE_UI)) for (const [table, acts] of [[CLICK, ui.click], [CHANGE, ui.change]]) for (const [act, fn] of Object.entries(acts || {})) {
  if (Object.hasOwn(table, act)) throw new Error(`Action « ${act} » du type ${type} déjà définie`);
  table[act] = fn;
}
