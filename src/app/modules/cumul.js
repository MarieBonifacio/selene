/* Type « cumul » : un total qui avance vers un objectif ; ses fragments datés, par chapitres, avec leurs versions. */
import { addJournalEntry, editFragmentText, epPrefix, inboxId } from "../../core/domain.js";
import { registerType } from "../registry.js";
import { $, esc, paged, toast } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { addDaysTo, ago, fmt, plural, streakOf, todayISO, uid } from "../lib/format.js";
import { tr, trn, trp, uiLocale } from "../i18n/index.js";
import { dossierFile } from "../features/dossier.js";
import { applyDerive, deriveBanner, epSelect, linksHTML, margHTML } from "../features/links.js";
import { instOf, recentBy, removeWithUndo, totalOf, within } from "./entries.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";

/* Fin estimée d'un cumul au rythme des 30 derniers jours : une phrase, ou rien sans objectif. */
export function projection(inst) {
  const c = inst.config, goal = +c.goal || 0, tot = totalOf(inst);
  if (!goal) return "";
  if (tot >= goal) return tr`Objectif atteint. Le reste relève de l'orgueil, ou de la réécriture.`;
  const recent = inst.entries.filter(x => x.date >= addDaysTo(todayISO(), -29)).reduce((a, x) => a + (+x.value || 0), 0);
  if (recent <= 0) return tr`Pas assez d'élan ces 30 derniers jours pour prédire une fin. La prophétie attendra.`;
  const perDay = recent / 30, end = addDaysTo(todayISO(), Math.ceil((goal - tot) / perDay));
  return tr`Au rythme des 30 derniers jours (${Math.round(perDay).toLocaleString(uiLocale())} ${c.unitLabel} par jour), objectif atteint vers le ${fmt(end, { day: "numeric", month: "long", year: "numeric" })}.`;
}
export const fragFilter = {};
 // filtre des fragments par chapitre, par module (propre à l'appareil)
/* Palimpseste : les versions antérieures d'un fragment, repliables, la plus récente d'abord. */
function versionsHTML(f) {
  const n = (f.versions || []).length; if (!n) return "";
  return `<details class="versions"><summary class="hint" style="cursor:pointer;margin:4px 0">${trn(n, "{0} version antérieure", "{0} versions antérieures")}</summary>${[...f.versions].reverse().map(v => `<p class="note" style="white-space:pre-wrap">${tr`${fmt(v.at)} : ${esc(v.text)}`}</p>`).join("")}</details>`;
}
/* Les fragments d'un cumul, rangés sous leurs chapitres, en Markdown : pour les reprendre dans un outil d'écriture. */
export function scrapsMarkdown(id, inst) {
  const c = inst.config, block = list => list.map(f => f.text.trim()).join("\n\n");
  const parts = [`# ${label(id)}`, c.title ? `*${c.title}*` : ""];
  for (const cat of c.categories) { const fs = inst.scraps.filter(f => f.category === cat.id); if (fs.length) parts.push(`## ${cat.name}`, block(fs)); }
  const loose = inst.scraps.filter(f => !c.categories.some(cat => cat.id === f.category));
  if (loose.length) parts.push(c.categories.length ? `## ${tr`Hors ${c.categoryLabel.toLowerCase()}`}` : "", block(loose));
  return parts.filter(Boolean).join("\n\n") + "\n";
}
function cumulGroupPanel(id) {
  const inst = S().modules[id], c = inst.config;
  const sum = catId => inst.entries.filter(x => (x.category || "") === catId).reduce((a, x) => a + (+x.value || 0), 0);
  const out = c.categories.map(cat => { const v = sum(cat.id), g = +cat.goal || 0; return { name: cat.name || tr`Sans titre`, pct: g ? Math.min(100, Math.round(100 * v / g)) : null, sub: g ? `${v.toLocaleString(uiLocale())} / ${g.toLocaleString(uiLocale())} ${c.unitLabel}` : `${v.toLocaleString(uiLocale())} ${c.unitLabel}` }; });
  const frags = catId => c.scraps ? (inst.scraps || []).filter(f => (f.category || "") === catId).length : 0;
  out.forEach((g, i) => { const n = frags(c.categories[i].id); if (n) g.sub += ` · ${plural(n, c.scrapsLabel.toLowerCase().replace(/s$/, ""))}`; });
  const loose = sum(""); if (loose && c.categories.length) out.push({ name: tr`Hors ${c.categoryLabel.toLowerCase()}`, pct: null, sub: `${loose.toLocaleString(uiLocale())} ${c.unitLabel}` });
  return `<section><h3 style="margin:0 0 4px">${tr`Par ${esc(c.categoryLabel).toLowerCase()}`}</h3><p class="hint">${tr`Chaque ${esc(c.categoryLabel).toLowerCase()} a son propre objectif.`}</p>
    <div class="rooms">${out.map(g => `<div class="room"><div class="fill" style="width:${Math.min(100, g.pct ?? 0)}%"></div><small>${esc(g.name)}</small><b>${g.pct == null ? "—" : tr`${g.pct} %`}</b><small>${esc(g.sub)}</small></div>`).join("")}</div></section>`;
}
/* Aucun fragment encore, mais des idées notées par Capturer attendent dans la boîte : le pont vers le tri, qui les range
   ici une à une. Sans lui, le dossier (qui part des fragments) restait introuvable à qui avait tout noté par ⊕
   (repéré en jouant les tâches d'E2 sur téléphone, docs/validation.md). */
function waitingHTML(inst) {
  const box = inboxId(S().modules), n = box && !inst.scraps.length ? S().modules[box].entries.length : 0;
  return n ? `<p class="hint" style="margin-top:10px">${trn(n, "{0} idée notée par Capturer attend dans la boîte de réception.", "{0} idées notées par Capturer attendent dans la boîte de réception.")} <button class="btn sm" data-act="vasculum">${tr`Les trier`}</button></p>` : "";
}
registerType("cumul", {
  view(id) {
    const inst = S().modules[id], c = inst.config;
    const tot = totalOf(inst), pct = Math.min(100, Math.round(100 * tot / (+c.goal || 1)));
    const last = inst.entries.map(x => x.date).sort().pop(), total = c.entryMode === "total";
    const lastCat = ([...inst.entries].reverse().find(x => x.category != null) || {}).category || ""; // la dernière catégorie servie
    const lastScrapCat = ([...(inst.scraps || [])].reverse().find(x => x.category != null) || {}).category ?? lastCat, ff = fragFilter[id] ?? "*";
    // Un menu des catégories (chapitres) : pour un nouveau fragment, ou pour en déplacer un.
    const catSelect = (domId, value, fallback, attrs = "") => c.categories.length ? `<select ${domId ? `id="${domId}"` : ""} ${attrs} aria-label="${esc(c.categoryLabel)}" style="max-width:220px"><option value="">${tr`Hors ${esc(c.categoryLabel).toLowerCase()}`}</option>${c.categories.map(x => `<option value="${esc(x.id)}" ${x.id === (value || fallback) ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : "";
    return `<h2>${esc(label(id))}</h2>${c.title ? `<p class="hint">${esc(c.title)}</p>` : ""}
  <div class="two"><section>
    <div class="big">${tot.toLocaleString(uiLocale())} <span class="hint" style="font-size:1.1rem">${trp("cumul", "{0} sur {1}", esc(c.unitLabel), (+c.goal).toLocaleString(uiLocale()))}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <p class="hint">${tr`Dernière session ${ago(last)}.`} ${trn(streakOf(inst.entries.map(x => x.date)), "Série de {0} jour.", "Série de {0} jours.")} ${esc(projection(inst))}</p>
    <div class="row"><input type="number" id="cumIn" min="${total ? 0 : 1}" placeholder="${total ? tr`Total atteint (${esc(c.unitLabel)})` : tr`${esc(c.unitLabel)} aujourd'hui`}" style="max-width:200px" inputmode="numeric" aria-label="${total ? tr`Total atteint` : tr`Ajout du jour`}">${c.categories.length ? `<select id="cumCat" aria-label="${esc(c.categoryLabel)}" style="max-width:220px"><option value="">${tr`Hors ${esc(c.categoryLabel).toLowerCase()}`}</option>${c.categories.map(x => `<option value="${esc(x.id)}" ${x.id === lastCat ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}<button class="btn acc" data-act="entry-add" data-mod="${esc(id)}">${tr`Ajouter`}</button></div>
    <div style="margin-top:28px">${c.categories.length ? cumulGroupPanel(id) : `<p class="hint">${tr`Ajoute des ${`${esc(c.categoryLabel).toLowerCase()}s`} dans ${`<a href="#reglages" data-act="goto-groups" data-mod="${esc(id)}">${tr`Réglages`}</a>`} pour suivre chacune en pourcentage.`}</p>`}</div>
  </section>${c.scraps ? `<section><h3>${esc(c.scrapsLabel)}</h3><p class="hint">${tr`Une phrase qui passe, avant qu'elle ne reparte. Un « ? » devant en fait une hypothèse.`}</p>
    ${deriveBanner(id)}<textarea id="scrapIn" data-draft rows="3" placeholder="…" aria-label="${tr`Nouveau`}"></textarea><div class="row" style="margin-top:8px">${catSelect("scrapCat", "", lastScrapCat)}<button class="btn" data-act="scrap-add" data-mod="${esc(id)}">${tr`Garder`}</button></div>
    ${waitingHTML(inst)}
    ${c.categories.length || inst.scraps.length ? `<div class="row" style="margin-top:14px">${c.categories.length ? `<select data-act="scrap-f" data-mod="${esc(id)}" aria-label="${tr`Filtrer`}"><option value="*">${tr`Tous`}</option>${[["", tr`Hors ${c.categoryLabel.toLowerCase()}`], ...c.categories.map(x => [x.id, x.name])].map(([k, n]) => `<option value="${esc(k)}" ${ff === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>` : ""}<span class="spacer"></span>${inst.scraps.length ? `<button class="btn ghost sm" data-act="scrap-md" data-mod="${esc(id)}">${tr`Exporter en Markdown`}</button><button class="btn ghost sm" data-act="scrap-dossier" data-mod="${esc(id)}" title="${tr`Avec dates, statuts, provenance et liens, pour une lecture assistée`}">${tr`Dossier`}</button>` : ""}</div>` : ""}
    <ul class="plain margins" style="margin-top:10px">${(pg => pg.items.map(f => `<li class="item" data-id="${esc(f.id)}"><span class="jdate">${fmt(f.date)}</span><div><div style="white-space:pre-wrap">${esc(f.text)}</div><div class="meta">${c.categories.length ? catSelect("", f.category || "", "", `data-act="scrap-cat" data-mod="${esc(id)}"`) : ""}${epSelect(id, f)}${linksHTML(id)}</div>${versionsHTML(f)}</div>${margHTML(id, f, f.text)}<div class="row"><button class="btn ghost sm ra" data-act="scrap-edit" data-mod="${esc(id)}">${tr`modifier`}</button><button class="btn ghost sm ra" data-act="scrap-del" data-mod="${esc(id)}">${tr`suppr.`}</button></div></li>`).join("") + pg.more)(paged(`scraps:${id}`, [...inst.scraps].reverse().filter(f => ff === "*" || (f.category || "") === ff))) || `<li class="empty">${tr`Rien pour l'instant.`}</li>`}</ul>
  </section>` : ""}</div>`;
  },
  settings: (id, { config: c }) => `<div class="field-row"><label>${tr`Titre / sous-titre`}<input data-set-mod="${esc(id)}.title" value="${esc(c.title || "")}"></label><label>${tr`Objectif`}<input type="number" min="1" data-set-mod="${esc(id)}.goal" value="${esc(c.goal)}"></label></div>
    <div class="field-row" style="margin-top:8px"><label>${tr`Je saisis`}<select data-set-mod="${esc(id)}.entryMode"><option value="delta" ${c.entryMode !== "total" ? "selected" : ""}>${tr`Ce que j'ai fait aujourd'hui`}</option><option value="total" ${c.entryMode === "total" ? "selected" : ""}>${tr`Le total atteint (l'app calcule la différence)`}</option></select></label><span></span></div>
    <div class="field-row" style="margin-top:8px"><label>${tr`Unité`}<input data-set-mod="${esc(id)}.unitLabel" value="${esc(c.unitLabel)}" placeholder="${tr`mots`}"></label><label>${tr`Nom des catégories`}<input data-set-mod="${esc(id)}.categoryLabel" value="${esc(c.categoryLabel)}" placeholder="${tr`Chapitre`}"></label></div>
    <div style="margin-top:10px"><span class="hint" style="margin:0">${esc(c.categoryLabel)}s</span>${c.categories.map((cat, i) => `<div class="set" data-ci="${i}" style="grid-template-columns:1fr 130px auto"><input data-act="cat-name" data-mod="${esc(id)}" value="${esc(cat.name)}" aria-label="${tr`Nom`}"><input type="number" min="0" data-act="cat-goal" data-mod="${esc(id)}" value="${esc(cat.goal || "")}" placeholder="${tr`Objectif`}" aria-label="${tr`Objectif`}"><div class="row"><button class="btn ghost sm" data-act="cat-up" data-mod="${esc(id)}" aria-label="${tr`Monter`}">↑</button><button class="btn ghost sm" data-act="cat-del" data-mod="${esc(id)}">${tr`suppr.`}</button></div></div>`).join("")}<button class="btn sm" data-act="cat-add" data-mod="${esc(id)}" style="margin-top:8px">${tr`Ajouter`}</button></div>`,
  summary(id, inst) {
    const c = inst.config;
    return `${trp("cumul", "{0} sur {1}", `${totalOf(inst).toLocaleString(uiLocale())} ${esc(c.unitLabel)}`, (+c.goal).toLocaleString(uiLocale()))}${c.scraps ? `, ${inst.scraps.length} ${esc(c.scrapsLabel).toLowerCase()}` : ""}`;
  },
  context(inst, nm) {
    const c = inst.config;
    return `\n${nm}${c.title ? ` « ${c.title} »` : ""} : ${totalOf(inst)} ${c.unitLabel} sur ${c.goal}. ${projection(inst)}${c.categories.length ? ` ${c.categoryLabel}s : ${c.categories.map(x => x.name).join(", ")}.` : ""}${c.scraps ? ` Derniers ${c.scrapsLabel.toLowerCase()} : ${inst.scraps.slice(-3).map(f => f.text.slice(0, 200)).join(" / ") || "aucun"}` : ""}`;
  },
  recent: inst => recentBy(inst.entries).map(x => `${fmt(x.date)} · ${x.value > 0 ? "+" : ""}${x.value ?? "?"} ${inst.config.unitLabel}`),
  review: (inst, from, to) => { const n = within(inst.entries, from, to).reduce((a, x) => a + (+x.value || 0), 0), f = within(inst.scraps || [], from, to).length; return `${n > 0 ? "+" : ""}${n.toLocaleString(uiLocale())} ${inst.config.unitLabel}${inst.config.scraps ? `, ${plural(f, inst.config.scrapsLabel.toLowerCase().replace(/s$/, ""))}` : ""}`; },
  texts: inst => [...(inst.scraps || []).map(f => ({ text: f.text, date: f.date, ep: f.ep, eid: f.id })), ...inst.config.categories.map(c => ({ text: c.name }))],
  timerDone(id, inst) {
    const inp = $("#cumIn"); if (!inp) return false;
    inp.focus();
    toast(`${tr`Quinze minutes.`} ${inst.config.entryMode === "total" ? tr`Quel total, maintenant ?` : tr`Combien de ${inst.config.unitLabel} ?`}`);
    return true;
  },
  canAccept: inst => !!inst.config.scraps,
  accept: (id, inst, note) => { const cat = ([...inst.scraps].reverse().find(x => x.category) || {}).category; inst.scraps.push({ id: uid(), text: note.text, date: note.date, ...(cat ? { category: cat } : {}) }); },
  add(id, inst) {
    const raw = $("#cumIn").value.trim(), n = +raw, unit = inst.config.unitLabel;
    if (!raw || !Number.isFinite(n)) return;
    // Mode « total » : la différence avec le total connu ; un total en baisse (coupes) est enregistré tel quel.
    const v = inst.config.entryMode === "total" ? n - totalOf(inst) : n;
    if (!v) return toast(inst.config.entryMode === "total" ? tr`Même total qu'avant. Rien de neuf, ou alors en silence.` : tr`Zéro. Noté mentalement, pas davantage.`);
    addJournalEntry(inst, { date: todayISO(), value: v, category: $("#cumCat") ? $("#cumCat").value : "" }, uid(), todayISO());
    $("#cumIn").value = ""; site.save(); render();
    toast(v > 0 ? tr`+${v.toLocaleString(uiLocale())} ${unit}. Ça avance, que tu y croies ou non.` : tr`${v.toLocaleString(uiLocale())} ${unit}. Couper, c'est aussi écrire.`);
  },
  click: {
    "scrap-add": el => {
      const v = $("#scrapIn").value.trim(); if (!v) return;
      const cat = $("#scrapCat") ? $("#scrapCat").value : "", p = epPrefix(v);
      const f = { id: uid(), text: p.text, date: todayISO(), ...(cat ? { category: cat } : {}), ...(p.ep ? { ep: p.ep } : {}) };
      instOf(el).scraps.push(f); const derived = applyDerive(el.dataset.mod, f); $("#scrapIn").value = ""; site.save(); render();
      if (derived) toast(derived > 1 ? tr`Synthèse gardée. La tension est levée.` : tr`Dérivé, et relié à sa source.`);
      else if (p.ep) toast(tr`Gardé comme hypothèse. Elle attendra ses preuves.`);
    },
    // Le dossier suit le filtre de chapitre affiché ; les fragments dans l'ordre où ils ont été écrits.
    "scrap-dossier": el => {
      const id = el.dataset.mod, inst = S().modules[id], ff = fragFilter[id] ?? "*", c = inst.config;
      const fs = inst.scraps.filter(f => ff === "*" || (f.category || "") === ff);
      const chap = ff === "*" ? "" : ff === "" ? ` — ${tr`hors ${c.categoryLabel.toLowerCase()}`}` : ` — ${(c.categories.find(x => x.id === ff) || {}).name || ""}`;
      dossierFile(`${label(id)}${chap}`, tr`${label(id)} : ${c.scrapsLabel.toLowerCase()}` + chap, fs.map(f => ({ mod: id, text: f.text, date: f.date, e: f })));
    },
    "scrap-md": el => { const id = el.dataset.mod; downloadFile(`${id}-${todayISO()}.md`, scrapsMarkdown(id, S().modules[id]), "text/markdown", label(id)); },
    "scrap-del": el => removeWithUndo(el.dataset.mod, "scraps", idOf(el)),
    "scrap-edit": el => {
      const id = el.dataset.mod, f = S().modules[id].scraps.find(x => x.id === idOf(el)); if (!f) return;
      openForm(tr`Modifier le fragment`, [{ n: "text", l: tr`Texte`, t: "textarea", rows: 6, req: true }], { text: f.text }, v => {
        const cur = S().modules[id], target = cur && cur.scraps.find(x => x.id === f.id);
        if (!target) return toast(tr`Ce fragment a disparu entre-temps.`);
        if (editFragmentText(target, v.text, todayISO())) { site.save(); render(); toast(tr`Modifié. L'ancienne version reste lisible dessous.`); }
      });
    },
    "cat-add": el => { const inst = instOf(el); inst.config.categories.push({ id: uid(), name: `${inst.config.categoryLabel} ${inst.config.categories.length + 1}`, goal: 0 }); site.save(); render(); },
    "cat-del": async el => { const inst = instOf(el), i = +el.closest("[data-ci]").dataset.ci, cat = inst.config.categories[i]; if (!await ask(tr`Supprimer « ${cat.name} » ? Les entrées déjà ajoutées passeront hors catégorie.`)) return; inst.entries.forEach(x => { if (x.category === cat.id) x.category = ""; }); (inst.scraps || []).forEach(f => { if (f.category === cat.id) delete f.category; }); inst.config.categories.splice(i, 1); site.save(); render(); },
    "cat-up": el => { const a = instOf(el).config.categories, i = +el.closest("[data-ci]").dataset.ci; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; site.save(); render(); } }
  },
  change: {
    "scrap-cat": el => { const f = instOf(el).scraps.find(x => x.id === idOf(el)); if (f) { if (el.value) f.category = el.value; else delete f.category; site.save(); render(); } },
    "scrap-f": el => { fragFilter[el.dataset.mod] = el.value; render(); },
    "cat-name": el => { const cat = instOf(el).config.categories[+el.closest("[data-ci]").dataset.ci]; cat.name = el.value.trim() || cat.name; site.save(); el.blur(); render(); },
    "cat-goal": el => { const cat = instOf(el).config.categories[+el.closest("[data-ci]").dataset.ci]; cat.goal = Math.max(0, +el.value || 0); site.save(); el.blur(); render(); }
  }
});
