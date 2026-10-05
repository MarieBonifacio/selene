/* Les réglages : une page en chapitres, du plus courant au plus rare (apparence, espaces, ciel, assistant, connexions,
   compte et données), avec un sommaire, un premier accueil et des infobulles ; leurs textes sont dans reglages-aide.js.
   Chaque espace n'y paraît qu'une fois : sa ligne (afficher, nommer, ranger), et dessous ses réglages propres. */
import { hosted, platform } from "../../platform.js";
import { createBackup } from "../../core/backup.js";
import { MODULE_TEMPLATES, MODULE_TYPES, deleteModuleInstance } from "../../core/domain.js";
import { CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { todayISO } from "../lib/format.js";
import { N_, collate, langChoices, tr, uiLang, uiLocale } from "../i18n/index.js";
import { localTemplate } from "../lib/labels.js";
import { agendaSettingsHTML } from "../features/agenda.js";
import { assistantKnown, assistantProbleme } from "../features/assistant.js";
import { notifySettingsHTML } from "../features/digest.js";
import { radarSettingsHTML } from "../features/radar.js";
import { shareSettingsHTML } from "../features/share.js";
import { zotSettingsHTML } from "../features/zotero.js";
import { gcfg, groupBy, grouperFor } from "../modules/groups.js";
import { skySettingsHTML } from "../scene/sky.js";
import { authReady, authSession, deleteWord, localAccountHTML, localOnly, passwordSettingsHTML } from "../services/auth.js";
import { errorSettingsHTML } from "../services/journal.js";
import { activitySettingsHTML } from "../services/activite.js";
import { passeurSettingsHTML } from "../services/passeur.js";
import { addModule, moveMod, offered } from "../shell/actions.js";
import { SYSTEM, openOn, routeOf } from "../shell/nav.js";
import { render } from "../shell/render.js";
import { roman, sigil, sigilPicker, tintOf } from "../shell/sigils.js";
import { withLocal } from "../state/local.js";
import { DOC_MAX, DOC_WARN, utf8Bytes } from "../state/store.js";
import { S, absentModule, board, enabled, label, site } from "../state/site.js";
import { openForm } from "../ui/dialogs.js";
import { tip } from "../ui/tips.js";
import { CHAPTERS, GUIDE, TEXTS, TIPS, glossary } from "./reglages-aide.js";

const PALETTES = [["nigredo", N_("Nigredo, mousse"), "#6f9a68"], ["albedo", N_("Albedo, lichen"), "#aab7a6"], ["citrinitas", N_("Citrinitas, résine"), "#c99a3c"], ["rubedo", N_("Rubedo, amanite"), "#c0554a"]];
// La politique de confidentialité, dans la langue de l'interface quand elle existe (confidentialite.html, privacy.html).
const privacyUrl = () => `https://mariebonifacio.github.io/selene/${uiLang() === "en" ? "privacy" : "confidentialite"}.html`;
const signedIn = () => hosted() && authReady() && authSession;

/* ---- briques : chapitre, sous-titre, champ, marque « cet appareil » ---- */
const about = subject => TEXTS.tipAbout(subject);
function chapter(id, body, tipText = "") {
  const i = CHAPTERS.findIndex(c => c.id === id), c = CHAPTERS[i];
  return `<section class="chap" id="${c.id}" aria-labelledby="${c.id}-h"><div class="chap-h"><span class="n">${roman(i + 1)}</span><h3 id="${c.id}-h" tabindex="-1">${esc(c.title)}</h3>${tipText ? tip(tipText, about(c.title)) : ""}</div>
    <p class="hint">${esc(c.intro)}</p>${body}</section>`;
}
const sub = (title, tipText = "") => `<div class="reg-head"><h4>${esc(title)}</h4>${tipText ? tip(tipText, about(title)) : ""}</div>`;
const device = () => `<span class="dev" title="${esc(TEXTS.deviceTitle)}">${esc(TEXTS.device)}</span>`;
/* Un champ dont le libellé porte une infobulle : le « ? » est un bouton, qui n'a pas sa place dans un <label>
   (il en deviendrait la cible) ; le libellé nomme donc son champ par aria-labelledby. `control` reçoit cet id. */
let fieldSeq = 0;
function field(text, control, { tip: tipText = "", local = false } = {}) {
  const id = `fld-${++fieldSeq}`;
  return `<div class="fld"><span class="fld-h"><span id="${id}">${esc(text)}</span>${local ? device() : ""}${tipText ? tip(tipText, about(text)) : ""}</span>${control(id)}</div>`;
}
const opt = (value, text, cur) => `<option value="${esc(value)}" ${cur === value ? "selected" : ""}>${esc(text)}</option>`;

/* ---- premier accueil et sommaire ---- */
const GUIDE_KEY = "selene-reglages-guide";
const guideOpen = () => { try { return platform.storage.get(GUIDE_KEY) !== "vu"; } catch { return true; } };
function guideHTML() {
  return `<aside class="reg-guide" aria-label="${esc(GUIDE.title)}"><p class="reg-guide-t">${esc(GUIDE.title)}</p><p>${esc(GUIDE.body)}</p><p>${esc(GUIDE.device)}</p>
    <details id="reg-lexique"><summary>${esc(GUIDE.glossaryTitle)}</summary><dl class="lex">${glossary().map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join("")}</dl></details>
    <p class="hint">${esc(GUIDE.wit)}</p><button type="button" class="btn sm" data-act="reg-guide" data-v="vu">${esc(GUIDE.dismiss)}</button></aside>`;
}
function tocHTML() {
  return `<nav class="reg-toc" aria-label="${esc(TEXTS.toc)}"><p class="grp">${esc(TEXTS.toc)}</p><ol>${CHAPTERS.map((c, i) => `<li><button type="button" data-act="reg-goto" data-to="${c.id}"><span class="n">${roman(i + 1)}</span>${esc(c.title)}</button></li>`).join("")}</ol>
    ${guideOpen() ? "" : `<button type="button" class="btn ghost sm" data-act="reg-guide" data-v="">${esc(GUIDE.reopen)}</button>`}</nav>`;
}

/* ---- I. Apparence et rythme ---- */
/* La langue de l'interface, suivie par le compte (synchronisée) ; vide : celle de l'appareil. Chaque langue sous son
   propre nom (on cherche « English », pas « Anglais »). Absente tant qu'une seule langue est proposée (i18n). */
const langField = c => langChoices().length < 2 ? "<span></span>"
  : field(tr`Langue`, id => `<select aria-labelledby="${id}" data-set="config.lang">${opt("", tr`Langue de l'appareil`, c.lang || "")}${langChoices().map(([k, n]) => `<option value="${k}" lang="${k}" ${c.lang === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`, { tip: TIPS.langue });
function apparenceHTML(c) {
  return `${sub(tr`Palette`, TIPS.palette)}<p class="hint">${tr`Quatre étapes de l'Œuvre, prises dans le sous-bois.`}</p>
    <div class="swatches">${PALETTES.map(([id, n, col]) => `<button class="swatch ${c.palette === id ? "on" : ""}" data-act="pal" data-p="${id}"><i style="background:${col}"></i>${tr(n)}</button>`).join("")}</div>
    <div class="field-row" style="margin-top:18px">${field(tr`Mode`, id => `<select aria-labelledby="${id}" data-set="config.mode">${opt("auto", tr`Suivre l'appareil`, c.mode)}${opt("dark", tr`Toujours sombre`, c.mode)}${opt("light", tr`Toujours clair`, c.mode)}${opt("sun", tr`Suivre le soleil`, c.mode)}</select>`, { tip: TIPS.mode })}
    ${field(tr`Nom affiché`, id => `<input aria-labelledby="${id}" data-set="config.name" value="${esc(c.name)}">`, { tip: TIPS.name })}</div>
    <div class="field-row" style="margin-top:12px">${field(tr`Ouvrir sur`, id => `<select aria-labelledby="${id}" data-act="open-on">${opt("accueil", tr`L'accueil`, openOn())}${opt("last", tr`Là où j'en étais`, openOn())}</select>`, { tip: TIPS.openOn, local: true })}${langField(c)}</div>
    ${notifySettingsHTML()}`;
}

/* ---- II. Espaces : une ligne par espace, ses réglages dessous, puis de quoi en créer ---- */
// « Collection (éléments…) » → « Collection » : coupé en français, puis traduit (une traduction ne garde pas forcément la parenthèse).
const typeName = type => tr(String(MODULE_TYPES[type]?.label || "").split(" (")[0]);
function modBlock(s, m, i) {
  const name = label(m.id), inst = s.modules[m.id], sys = SYSTEM.includes(m.id), absent = absentModule(m.id);
  const settings = enabled(m.id) && (inst || grouperFor(m.id));
  // Un module dont cette édition n'a pas le type : ni activable ni réglable ici ; une phrase dit pourquoi, et il reste
  // supprimable (son type dit quoi en savoir avant : deleteNote).
  return `<div class="modblock ${tintOf(m.id)}${m.on && !absent ? "" : " off"}">
    <div class="set mod" data-i="${i}"><label class="tap"><input type="checkbox" data-act="mod-on" ${m.on && !absent ? "checked" : ""}${absent ? " disabled" : ""} aria-label="${tr`Activer ${esc(name)}`}"></label><div class="mod-name">${sigil(m.id)}<input data-act="mod-label" value="${esc(name)}" aria-label="${tr`Nom du module`}"></div>${sys ? "<span></span>" : `<input class="grp-in" data-act="mod-group" value="${esc(m.group || "")}" list="domainList" maxlength="40" placeholder="${esc(TEXTS.domaine)}" aria-label="${tr`Domaine de ${esc(name)}`}">`}<div class="row">${inst ? `<button class="btn ghost sm" data-act="mod-del" data-mod="${esc(m.id)}" aria-label="${tr`Supprimer définitivement`}" title="${tr`Supprimer définitivement`}">✕</button>` : ""}<button class="btn ghost sm" data-act="mod-up" aria-label="${tr`Monter`}">↑</button><button class="btn ghost sm" data-act="mod-down" aria-label="${tr`Descendre`}">↓</button></div></div>
    ${absent ? `<div class="mreg-note">${TYPE_UI[inst.type].settings(m.id, inst)}</div>` : settings ? `<details id="mreg-${esc(m.id)}" data-mod="${esc(m.id)}" class="mreg"><summary aria-label="${esc(TEXTS.regler(name))}">${esc(TEXTS.reglerShort)}${inst ? `<span class="mreg-type">${esc(typeName(inst.type))}</span>` : ""}</summary><div class="mreg-body">${moduleSettingsHTML(m.id)}</div></details>`
      : sys && m.on ? `<p class="mreg-note"><button type="button" class="btn ghost sm" data-act="reg-goto" data-to="reg-assistant">› ${esc(TEXTS.assistantHere)}</button></p>` : ""}
  </div>`;
}
/* « Sur mesure » : des noms courts dans le menu (la description des modèles est affichée juste au-dessus, le libellé
   complet reste en title). WebKit laisse le texte de l'option choisie déborder du menu et élargir la page. */
function espacesHTML(s, c) {
  return `<p class="hint">${esc(TEXTS.legend)}</p>
    <p class="reg-keys"><span>${esc(TEXTS.domaine)}${tip(TIPS.domaine, about(TEXTS.domaine))}</span><span>✕ ${esc(TEXTS.suppr)}${tip(TIPS.suppr, about(TEXTS.suppr))}</span><span>› ${esc(TEXTS.reglerShort)}${tip(TIPS.regler, about(TEXTS.reglerShort))}</span></p>
    <datalist id="domainList">${[...new Set(c.modules.map(m => String(m.group || "").trim()).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join("")}</datalist>
    <div class="modlist">${c.modules.map((m, i) => modBlock(s, m, i)).join("")}</div>
    <details id="mod-new" class="newmod"><summary class="btn sm">+ ${esc(TEXTS.create)}</summary><div class="newmod-body">
      ${sub(TEXTS.fromTemplate, TIPS.creer)}<p class="hint">${esc(TEXTS.fromTemplateHint)}</p>
      <div class="tpl-grid">${MODULE_TEMPLATES.filter(t => offered(t.type)).map(t => `<div class="tpl"><div><b>${esc(tr(t.name))}</b><p class="hint">${esc(tr(t.hint))}</p></div><button type="button" class="btn sm" data-act="tpl-add" data-tpl="${esc(t.id)}" aria-label="${esc(TEXTS.addAria(tr(t.name)))}">${esc(TEXTS.add)}</button></div>`).join("")}</div>
      ${sub(TEXTS.custom)}<p class="hint">${esc(TEXTS.customHint)}</p>
      <div class="field-row"><label>${tr`Modèle ou type`}<select id="newModType"><optgroup label="${tr`Modèles`}">${MODULE_TEMPLATES.filter(t => offered(t.type)).map(t => `<option value="tpl:${esc(t.id)}" title="${esc(tr(t.hint))}">${esc(tr(t.name))}</option>`).join("")}</optgroup><optgroup label="${tr`Types vides`}">${Object.entries(MODULE_TYPES).filter(([k]) => offered(k)).map(([k, t]) => `<option value="${esc(k)}" title="${esc(tr(t.label))}">${esc(typeName(k))}</option>`).join("")}</optgroup></select></label>
      <label>${tr`Nom`}<input id="newModName" placeholder="${tr`Nom du modèle si vide`}"></label></div>
      <button class="btn sm" data-act="mod-add" style="margin-top:8px">${esc(TEXTS.add)}</button></div></details>`;
}

/* ---- IV. Assistant ---- */
function assistantHTML(s) {
  if (!enabled("assistant")) return `<p class="empty">${esc(TEXTS.assistantOff)}</p><button type="button" class="btn sm" data-act="reg-goto" data-to="reg-espaces">${esc(TEXTS.toEspaces)}</button>`;
  const a = s.config.assistant, known = assistantKnown();
  return `<section id="assistant-cfg"><p class="hint">${tr`Sur claude.ai, il passe par ton compte. Dans la version hébergée, il faut ta propre clé API : vérifiée auprès d'Anthropic, elle est gardée chiffrée sur le serveur de Selene, attachée à ton compte, et ne revient jamais dans la page.`}</p>
    ${authReady() && !authSession ? `<p class="hint">${tr`Sans compte, pas d'assistant : ta clé serait gardée sur le serveur, attachée à un compte.`} <button type="button" class="btn ghost sm" data-act="auth-open">${tr`Créer un compte ou me connecter`}</button></p>` : ""}
    ${signedIn() && assistantProbleme() ? `<p class="hint" role="status">${esc(assistantProbleme())}</p>` : ""}
    <div class="field-row">${signedIn() ? field(known?.cle ? tr`Clé API Anthropic (enregistrée : ${known.indice || ""})` : tr`Clé API Anthropic`, id => `<input type="password" aria-labelledby="${id}" data-act="as-key" value="" placeholder="${known?.cle ? tr`Coller une autre clé pour la remplacer` : "sk-ant-…"}" autocomplete="off">`, { tip: TIPS.assistantKey }) : ""}
    ${field(tr`Modèle`, id => `<select aria-labelledby="${id}" data-act="as-model">${[["claude-haiku-4-5-20251001", tr`Haiku 4.5, rapide et peu cher`], ["claude-sonnet-5", tr`Sonnet 5, équilibré`], ["claude-opus-5-5", tr`Opus 5.5, le plus capable`]].map(([k, l]) => opt(k, l, a.model)).join("")}</select>`, { tip: TIPS.assistantModel })}</div>
    <div class="row" style="margin-top:12px"><label class="check-l"><input type="checkbox" data-act="as-actions" ${a.actions ? "checked" : ""}>${tr`Autoriser Claude à modifier le tableau de bord (tâches, capture, budget)`}</label>${tip(TIPS.assistantActions, about(tr`Autoriser Claude à modifier le tableau de bord`))}</div>
    <div class="fld-h" style="margin:16px 0 6px"><span>${tr`Ce que Claude peut lire`}</span>${tip(TIPS.assistantShare, about(tr`Ce que Claude peut lire`))}</div><div class="row">${Object.keys(a.share).filter(enabled).map(k => `<label class="check-l"><input type="checkbox" data-act="as-share" data-k="${esc(k)}" ${a.share[k] ? "checked" : ""}>${esc(label(k))}</label>`).join("")}</div>
    ${hosted() && known?.cle ? `<button class="btn ghost sm" data-act="as-forget" style="margin-top:10px">${tr`Oublier la clé (sur tous tes appareils)`}</button>` : ""}</section>`;
}

/* ---- V. Connexions : du plus simple (un favori) au plus exigeant (le passeur, puis ce qui en dépend) ---- */
function connexionsHTML() {
  if (!hosted()) return `<p class="empty">${esc(TEXTS.artifactOnly)}</p>`;
  return `${shareSettingsHTML()}${zotSettingsHTML()}${signedIn() ? passeurSettingsHTML() + agendaSettingsHTML() : ""}`;
}

/* ---- VI. Compte et données : la sauvegarde d'abord, l'irréversible en dernier ---- */
/* Ce que pèse l'espace sur le serveur, et sa limite ; près d'elle, les modules les plus lourds. Calculé à l'affichage
   des Réglages seulement. */
function sizeHTML() {
  const bytes = o => utf8Bytes(JSON.stringify(o)), total = bytes(S());
  const fmt = n => n < 1e6 ? tr`${Math.max(1, Math.round(n / 1e3))} Ko` : tr`${(n / 1e6).toLocaleString(uiLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mo`;
  const line = tr`Ton espace pèse ${fmt(total)} ; le serveur en garde ${fmt(DOC_MAX)} au plus.`;
  if (total < DOC_WARN) return `<p class="hint" id="reg-size">${line}</p>`;
  const heavy = Object.entries(S().modules).map(([k, m]) => [k, bytes(m)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${esc(label(k))} (${fmt(n)})`).join(", ");
  return `<p class="hint" id="reg-size" style="color:var(--warn)">${line} ${tr`Il approche de la limite : au-delà, il ne serait plus enregistré que sur cet appareil. Exporte une sauvegarde, puis allège les plus lourds : ${heavy}.`}</p>`;
}
function compteHTML() {
  return `<section>${sub(tr`Sauvegarde`)}<p class="hint">${tr`Tout ton état dans un fichier JSON, pour passer de claude.ai à GitHub Pages ou d'un navigateur à l'autre. La clé API n'y figure jamais.`}</p>
    <div class="row"><button class="btn" data-act="exp">${tr`Exporter`}</button><label class="btn" style="display:inline-block;font-weight:500">${tr`Importer`}<input type="file" accept="application/json,.json" data-act="imp" style="display:none"></label>${tip(TIPS.importer, about(tr`Importer`))}</div>${signedIn() ? sizeHTML() : ""}</section>
  ${signedIn() ? `<section>${sub(tr`Compte`)}<p class="hint">${tr`Connecté en tant que ${esc(authSession.user.email)}. Tes données sont propres à ce compte et suivent sur tous tes appareils. Se déconnecter efface de cet appareil tes données et la conversation avec l'assistant ; ta clé API reste attachée à ton compte, chiffrée, jusqu'à ce que tu l'oublies.`}</p>
    ${passwordSettingsHTML()}
    ${errorSettingsHTML()}
    ${activitySettingsHTML()}
    <button class="btn ghost" data-act="auth-out" style="margin-top:12px">${tr`Se déconnecter`}</button></section>
  <section class="danger">${sub(TEXTS.danger)}
    <details id="auth-delete"><summary class="hint">${tr`Supprimer mon compte`}</summary>
      <p class="hint" style="margin-top:8px">${tr`Définitif : ton compte, tout ton tableau de bord sur le serveur et ta clé d'assistant sont effacés, puis cet appareil est vidé. Tes autres appareils perdent l'accès. Exporte d'abord une sauvegarde (plus haut) si tu veux garder quelque chose. Politique de confidentialité : ${`<a href="${privacyUrl()}" target="_blank" rel="noopener">${tr`ce que Selene garde, et où`}</a>`}.`}</p>
      <div class="field-row"><label>${tr`Tape « ${deleteWord()} » pour confirmer`}<input id="authDelIn" autocomplete="off" autocapitalize="off" spellcheck="false"></label><span></span></div>
      <button class="btn sm" data-act="auth-delete" style="margin-top:8px;color:var(--alarm)">${tr`Supprimer définitivement`}</button></details></section>`
    : authReady() && localOnly() ? `<section>${sub(tr`Compte`)}${localAccountHTML()}${errorSettingsHTML()}</section>` : ""}
  <p class="hint" style="margin-top:24px">${tr`${`<a href="${privacyUrl()}" target="_blank" rel="noopener">${tr`Confidentialité`}</a>`} : aucun traceur, aucune publicité ; ce que Selene garde, où, et comment tout effacer.`}</p>`;
}

VIEWS.reglages = () => {
  const s = S(), c = s.config;
  setTimeout(markChapter, 0); // une fois la page posée : le sommaire marque le chapitre à l'écran
  return `<h2>${tr`Réglages`}</h2><p class="hint">${tr`Tout ici s'applique immédiatement.`}</p>
  ${guideOpen() ? guideHTML() : ""}
  <div class="reg">${tocHTML()}<div class="reg-body">
    ${chapter("reg-apparence", apparenceHTML(c))}
    ${chapter("reg-espaces", espacesHTML(s, c), TIPS.espaces)}
    ${chapter("reg-ciel", skySettingsHTML() + radarSettingsHTML(), TIPS.lieu)}
    ${chapter("reg-assistant", assistantHTML(s))}
    ${chapter("reg-connexions", connexionsHTML(), signedIn() ? TIPS.passeur : "")}
    ${chapter("reg-compte", compteHTML())}
  </div></div>`;
};
/* Les réglages propres d'un module (son sigil, ceux de son type, son regroupement en pourcentage) : dans la page
   Réglages, et dans la feuille qu'ouvre « régler » depuis le module lui-même. */
export function moduleSettingsHTML(mod) {
  const s = S(), inst = s.modules[mod], G = grouperFor(mod), g = G ? gcfg(mod) : null, by = G ? groupBy(mod) : null;
  const names = G && G.renamable.includes(by) ? [...new Set(G.items().map(it => it[by]).filter(Boolean))].sort(collate) : [];
  return `<div class="fld-h" style="margin:0 0 6px"><span>${esc(TEXTS.sigil)}</span>${tip(TIPS.sigil, about(TEXTS.sigil))}</div>${sigilPicker(mod)}
        ${inst ? TYPE_UI[inst.type].settings(mod, inst) : ""}
        ${G ? `<div class="row" style="margin-top:0"><label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="grp-on" ${g.on ? "checked" : ""}>${tr`Regrouper en pourcentage`}</label>${tip(TIPS.grouper, about(tr`Regrouper en pourcentage`))}</div>
          ${g.on ? `<div class="field-row" style="margin-top:8px">
            <label>${tr`Regrouper par`}<select data-act="grp-by">${Object.entries(G.fields).map(([k, l]) => `<option value="${esc(k)}" ${by === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
            <label>${tr`Trier par`}<select data-act="grp-sort"><option value="name" ${g.sort === "name" ? "selected" : ""}>${tr`Ordre naturel`}</option><option value="pct" ${g.sort === "pct" ? "selected" : ""}>${tr`Le plus avancé d'abord`}</option><option value="left" ${g.sort === "left" ? "selected" : ""}>${tr`Le plus en retard d'abord`}</option></select></label></div>
            <div class="field-row" style="margin-top:8px"><label>${tr`Titre du bloc`}<input data-act="grp-title" value="${esc(g.title)}" placeholder="${tr`Par ${esc(G.fields[by].toLowerCase())}`}"></label>
            <label style="display:flex;gap:8px;align-items:center;align-self:end;padding-bottom:10px"><input type="checkbox" data-act="grp-hide" ${g.hideDone ? "checked" : ""}>${tr`Masquer les groupes à 100 %`}</label></div>
            ${names.length ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer;margin:0">${tr`Renommer ou fusionner les groupes par ${esc(G.fields[by].toLowerCase())}`}</summary><p class="hint" style="margin:6px 0">${tr`Donne le même nom à deux groupes pour les fusionner.`}</p>${names.map(n => `<div class="set" style="grid-template-columns:1fr"><input data-act="grp-rename" data-old="${esc(n)}" value="${esc(n)}" aria-label="${tr`Renommer ${esc(n)}`}"></div>`).join("")}</details>` : ""}
           ` : ""}` : ""}`;
}
/* Le sommaire suit la lecture : le chapitre dont le titre a passé le haut de l'écran est marqué (le dernier, une fois
   en bas de page, même s'il est trop court pour y monter). */
function markChapter() {
  if (routeOf().view !== "reglages") return;
  const chaps = [...$("#main").querySelectorAll(".chap")], toc = chaps.length && document.querySelector(".reg-toc");
  if (!toc) return;
  let cur = chaps[0].id;
  for (const ch of chaps) if (ch.getBoundingClientRect().top < 160) cur = ch.id;
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = chaps[chaps.length - 1].id;
  toc.querySelectorAll("[data-to]").forEach(b => { if (b.dataset.to === cur) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
}
let spyQueued = false;
window.addEventListener("scroll", () => { if (spyQueued) return; spyQueued = true; requestAnimationFrame(() => { spyQueued = false; markChapter(); }); }, { passive: true });
CLICK["reg-goto"] = el => {
  const ch = document.getElementById(el.dataset.to); if (!ch) return;
  ch.scrollIntoView({ block: "start" });
  const h = ch.querySelector("h3"); if (h) h.focus({ preventScroll: true }); // le clavier repart du chapitre, pas du sommaire
};
CLICK["reg-guide"] = el => {
  if (el.dataset.v) platform.storage.set(GUIDE_KEY, el.dataset.v); else platform.storage.remove(GUIDE_KEY);
  render();
  if (!el.dataset.v) { const g = document.querySelector(".reg-guide"); if (g) g.scrollIntoView({ block: "nearest" }); }
};
CLICK["mod-add"] = () => {
  const choice = $("#newModType").value, found = MODULE_TEMPLATES.find(t => "tpl:" + t.id === choice), tpl = found ? localTemplate(found) : null;
  const name = $("#newModName").value.trim() || (tpl ? tpl.name : "");
  if (!name) return toast(tr`Donne un nom au module.`);
  addModule(tpl || { type: choice }, name);
};
CLICK["tpl-add"] = el => { const found = MODULE_TEMPLATES.find(t => t.id === el.dataset.tpl); if (found) { const tpl = localTemplate(found); addModule(tpl, tpl.name); } };
CLICK["mod-del"] = el => {
  const id = el.dataset.mod, name = label(id), ui = Object.hasOwn(S().modules, id) ? TYPE_UI[S().modules[id].type] : null;
  const note = ui && ui.deleteNote ? ui.deleteNote(id) : "";
  openForm(tr`Supprimer « ${name} »`, [{ n: "confirm", l: tr`Retape « ${name} » pour confirmer la suppression définitive de ses données.`, req: true }], {}, v => {
    if (v.confirm !== name) return toast(tr`Nom incorrect, rien n'a été supprimé.`);
    const s = S();
    if (ui && ui.onDelete) ui.onDelete(id); // une copie gardée sur cet appareil (ADR 27) part avec le module
    deleteModuleInstance(s.modules, s.config.modules, id);
    delete s.config.labels[id]; delete s.config.groups[id]; delete s.config.assistant.share[id];
    site.save(); render(); toast(tr`« ${name} » supprimé.`);
  }, note);
};
// La sauvegarde complète contient aussi ce qui n'est gardé que sur cet appareil (ADR 27) : c'est un fichier, il doit tout avoir.
CLICK["exp"] = () => downloadFile(`selene-${todayISO()}.json`, createBackup(board.data, withLocal(site.data)), "application/json", tr`Sauvegarde Selene`);
CLICK["pal"] = el => { S().config.palette = el.dataset.p; site.save(); render(); };
CLICK["mod-up"] = el => moveMod(el, -1);
