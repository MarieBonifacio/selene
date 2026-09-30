/* Les actions : délégation des événements (clic, changement, clavier) vers CLICK et CHANGE, capture, ajout et
   installation de modules. */
import { platform } from "../../platform.js";
import { parseBackup } from "../../core/backup.js";
import { MODULE_TYPES, createFromTemplate, inboxId, slugId } from "../../core/domain.js";
import { CHANGE, CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { $, PAGE, pageSize, toast } from "../lib/dom.js";
import { assistantCall, assistantSetCle, sendChat } from "../features/assistant.js";
import { bridgeSave } from "../features/bridge.js";
import { NOTIFY_KEY, notifyConf } from "../features/digest.js";
import { RADAR_KEY } from "../features/radar.js";
import { removeWithUndo } from "../modules/entries.js";
import { gFilter, gcfg, groupBy, grouperFor } from "../modules/groups.js";
import { addNote, afterCapture } from "../modules/notes.js";
import { taskFilters } from "../modules/taches.js";
import { refreshWeather, skyConf, skySearch } from "../scene/sky.js";
import { openPalette } from "./palette.js";
import { rememberScroll, render } from "./render.js";
import { closeSheet } from "./sheets.js";
import { saveDraft } from "../state/drafts.js";
import { MODULE_DEFS, S, board, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";

export const idOf = el => el.closest("[data-id]")?.dataset.id;
/* Capture rapide, depuis l'accueil ou depuis la feuille « Capturer » (barre basse du téléphone). */
function capture(inp = $("#capIn")) {
  if (!inp || !inp.value.trim()) return;
  const id = inboxId(S().modules); if (!id) return toast("Aucune boîte de réception : voir Réglages.");
  const item = addNote(S().modules[id], inp.value); site.save(); inp.value = "";
  platform.haptic();
  if (inp.id === "capSheetIn") { saveDraft("sheet", inp); closeSheet(); } // fermée avant le message, qui passerait dessous
  render();
  afterCapture(id, item, "Gardé. Tu peux oublier, c'est écrit.");
}
function entryAdd(id) {
  const inst = S().modules[id], ui = TYPE_UI[inst.type];
  if (ui.add) ui.add(id, inst);
}
CLICK["cap-add"] = () => capture();
CLICK["cap-sheet-add"] = () => capture($("#capSheetIn"));
CLICK["page-more"] = el => { const k = el.dataset.k; pageSize[k] = (pageSize[k] || PAGE) + PAGE; render(); };
CLICK["entry-add"] = el => entryAdd(el.dataset.mod);
CLICK["entry-del"] = el => removeWithUndo(el.dataset.mod, "entries", idOf(el));
 CLICK["mod-down"] = el => moveMod(el, 1);
/* Ajoute un module (depuis un modèle ou un type vide), actif et partagé avec l'assistant. */
export function addModule(tpl, name) {
  if (tpl.type === "programme") {
    const defaults = { ...MODULE_TYPES.programme.defaults().config, ...tpl.config };
    return openForm("Choisir ton sport ou ta pratique", [
      { n: "name", l: "Nom du sport ou de la pratique", req: true },
      { n: "weeks", l: "Durée en semaines (1 à 520, proposition modifiable)", t: "number", req: true },
      { n: "perWeek", l: "Séances par semaine (1 à 7, proposition modifiable)", t: "number", req: true },
      { n: "unitLabel", l: "Unité suivie (min, km, longueurs…)", req: true }
    ], { name: name === tpl.name ? "" : name, ...defaults }, v => {
      const weeks = Number(v.weeks), perWeek = Number(v.perWeek), unitLabel = v.unitLabel.trim();
      if (!v.name.trim() || !unitLabel || !Number.isInteger(weeks) || weeks < 1 || weeks > 520 || !Number.isInteger(perWeek) || perWeek < 1 || perWeek > 7)
        throw new Error("Indique un nom, une unité, 1 à 520 semaines et 1 à 7 séances par semaine.");
      installModule({ ...tpl, config: { ...tpl.config, weeks, perWeek, unitLabel } }, v.name.trim());
    });
  }
  installModule(tpl, name);
}
function installModule(tpl, name) {
  try {
    const s = S(), id = slugId(name, [...s.config.modules.map(x => x.id), ...Object.keys(s.modules), ...Object.keys(VIEWS)]);
    createFromTemplate(s.modules, tpl, name, id);
    s.config.modules.push({ id, on: true });
    s.config.assistant.share[id] = true;
    site.save(); render(); toast(`Module « ${name} » créé.`);
  } catch (e) { toast(e.message); }
}
export function moveMod(el, d) { const ms = S().config.modules, i = +el.closest("[data-i]").dataset.i, j = i + d; if (j < 0 || j >= ms.length) return; [ms[i], ms[j]] = [ms[j], ms[i]]; site.save(); render(); }
document.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (a && CLICK[a.dataset.act] && a.tagName !== "SELECT" && !(a.tagName === "INPUT" && a.type !== "button")) CLICK[a.dataset.act](a, e); });
// « / » ouvre la recherche (sur ordinateur), sauf pendant une saisie.
document.addEventListener("keydown", e => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "")) return;
  // Dessiner tout de suite : attendre l'événement hashchange ferait courir le curseur contre le rendu.
  e.preventDefault(); rememberScroll(); location.hash = "recherche"; render(); const el = document.getElementById("searchIn"); if (el) el.focus();
});
// ⌘K (Ctrl+K) ouvre ou ferme la palette, même pendant une saisie.
document.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); openPalette(); } });
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "skyCity") skySearch(); });
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "srcIn") { e.preventDefault(); CLICK["src-fetch"](e.target); }
  if (e.key === "Enter" && e.target.id === "zotIn") { e.preventDefault(); CLICK["zot-search"](e.target); }
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "capIn") capture(); if (e.key === "Enter" && e.target.id === "capSheetIn") capture(e.target); if (e.key === "Enter" && e.target.id === "noteIn") CLICK["note-add"](e.target); if (e.key === "Enter" && e.target.id === "bridgeIn") bridgeSave(e.target.dataset.mod); if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatIn") { e.preventDefault(); sendChat(e.target.value); } });
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
  else if (act === "as-key") { // la clé part au serveur, qui la vérifie et la chiffre ; elle ne reste pas dans la page
    const v = el.value.trim(); el.value = ""; el.blur();
    if (v) assistantCall({ action: "cle", cle: v }).then(r => { assistantSetCle(r); toast("Clé vérifiée et enregistrée."); }, e => toast("Clé non enregistrée : " + e.message)).then(render);
  }
  else if (act === "as-model") { S().config.assistant.model = el.value; site.save(); render(); }
  else if (act === "as-actions") { S().config.assistant.actions = el.checked; site.save(); render(); }
  else if (act === "as-share") { S().config.assistant.share[el.dataset.k] = el.checked; site.save(); render(); }
  else if (act === "imp") {
    const f = el.files && el.files[0]; if (!f) return;
    f.text().then(async t => { const d = parseBackup(t); if (!await ask("Remplacer tout l'état actuel par celui du fichier ?")) return; site.replaceAll(d.site); board.replaceAll(d.board); /* le site d'abord : les tâches d'une ancienne sauvegarde y sont versées */ render(); toast("Sauvegarde importée."); }).catch(() => toast("Fichier illisible ou pas une sauvegarde Selene.")).finally(() => { el.value = ""; });
  }
  else if (act === "mod-group") {
    const m = S().config.modules[+el.closest("[data-i]").dataset.i], v = el.value.trim().slice(0, 40);
    if (v) m.group = v; else delete m.group;
    site.save(); el.blur(); render();
  }
  else if (act === "sky-weather" || act === "sky-moon") {
    const c = skyConf(); if (!c) return;
    c[act === "sky-weather" ? "weather" : "realMoon"] = el.checked; site.save(); render();
    if (act === "sky-weather" && el.checked) refreshWeather(true);
  }
  else if (act === "radar-words") {
    const v = el.value.replace(/\s+/g, " ").trim().slice(0, 300);
    if (v) S().config.radar = { words: v }; else delete S().config.radar;
    platform.storage.remove(RADAR_KEY); site.save(); el.blur(); render();
  }
  else if (act === "sky-live") { platform.storage.set("selene-sky-live", el.checked ? "on" : "off"); render(); }
  else if (act === "notify-on" || act === "notify-at") {
    const c = notifyConf(), save = () => { platform.storage.set(NOTIFY_KEY, JSON.stringify(c)); render(); };
    if (act === "notify-at") { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(el.value)) c.at = el.value; return save(); }
    if (!el.checked) { c.on = false; return save(); }
    platform.notifications.permission().then(p => {
      c.on = p === "granted"; save();
      toast(c.on ? `Chaque matin à ${c.at}, s'il y a quelque chose. Sinon, la paix.` : "Notifications refusées : elles s'autorisent dans les réglages du téléphone.");
    }, () => { el.checked = false; toast("Les notifications ne sont pas disponibles ici."); });
  }
  else if (act === "open-on") { platform.storage.set("selene-open", el.value); toast(el.value === "last" ? "L'app rouvrira le dernier espace où tu étais." : "L'app s'ouvrira sur l'accueil."); }
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
