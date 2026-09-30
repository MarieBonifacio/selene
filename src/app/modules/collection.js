/* Type « collection » : des éléments à statuts, en colonnes (glisser-déposer, clavier) ou en liste filtrable ; mode
   révision. */
import { LINK_TYPES, saveCollectionItem } from "../../core/domain.js";
import { igDay, igEntry, igPosts } from "../../core/instagram.js";
import { registerType } from "../registry.js";
import { esc, paged, toast, toastUndo } from "../lib/dom.js";
import { fmt, plural, todayISO, uid } from "../lib/format.js";
import { concordanceSummary, concordanceView, isConcordance, motifsIn } from "../features/concordance.js";
import { refHTML } from "../features/links.js";
import { coverImg } from "../features/musique.js";
import { sourceBar, srcMeta } from "../features/sources.js";
import { instOf, originHTML, removeWithUndo, within } from "./entries.js";
import { gMatch, groupPanel, itemGroups } from "./groups.js";
import { idOf } from "../shell/actions.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";

/* ---- collection : éléments à statuts, en colonnes (tableau de production) ou en liste filtrable ---- */
export const colFilter = {};
 // filtre de statut du mode liste, par module (propre à l'appareil, non enregistré)
const colTab = {};
 // colonne montrée sur téléphone, par module (propre à l'appareil)
/* Change le statut d'un élément (une colonne du tableau) : flèches, glisser-déposer, touches [ et ]. */
function moveCardTo(mod, id, ci) {
  const inst = S().modules[mod], e = inst && inst.type === "collection" && inst.entries.find(x => x.id === id);
  if (!e) return;
  const c = inst.config, i = Math.max(0, Math.min(c.statuses.length - 1, ci));
  if (c.statuses[i] === e.status) return;
  e.status = c.statuses[i]; site.save(); render();
  if (i === c.statuses.length - 1) toast(collectionDoneLines[Math.floor(Math.random() * collectionDoneLines.length)].replace("%t", e.title).replace("%s", e.status));
}
export const modOf = el => el.closest("[data-mod]").dataset.mod;
const itemOf = el => S().modules[modOf(el)].entries.find(x => x.id === idOf(el));
const collectionDoneLines = ["« %t » est passé à « %s ». Le monde n'a rien remarqué, comme prévu.", "« %t » : %s. Une chose de moins qui attend ton attention.", "%s : « %t ». L'Œuvre avance, à pas de lichen."];
/* Dernier réexamen d'un élément (collection en mode révision) : quand, et ce qu'il en est sorti. */
const reviewedHTML = e => { const r = (e.reviews || []).at(-1); return r ? `<span>${esc(r.verdict)} le ${fmt(r.date)}</span>` : ""; };
/* `item` sans `id` préremplit un nouvel élément (ex. une décision suggérée par un autre module) sans en faire
   une modification : à l'enregistrement, c'est un identifiant neuf qui est utilisé, jamais celui, absent, de `item`. */
export function collectionForm(id, item, title) {
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
registerType("collection", {
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
});
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
