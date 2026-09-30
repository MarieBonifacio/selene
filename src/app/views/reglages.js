/* Les réglages : apparence, modules, réglages par module, comptes, sauvegarde. */
import { hosted } from "../../platform.js";
import { createBackup } from "../../core/backup.js";
import { MODULE_TEMPLATES, MODULE_TYPES, deleteModuleInstance } from "../../core/domain.js";
import { CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { todayISO } from "../lib/format.js";
import { agendaSettingsHTML } from "../features/agenda.js";
import { assistantKnown } from "../features/assistant.js";
import { notifySettingsHTML } from "../features/digest.js";
import { radarSettingsHTML } from "../features/radar.js";
import { shareSettingsHTML } from "../features/share.js";
import { zotSettingsHTML } from "../features/zotero.js";
import { gcfg, groupBy, grouperFor } from "../modules/groups.js";
import { skySettingsHTML } from "../scene/sky.js";
import { authReady, authSession } from "../services/auth.js";
import { passeurSettingsHTML } from "../services/passeur.js";
import { addModule, moveMod } from "../shell/actions.js";
import { SYSTEM, openOn } from "../shell/nav.js";
import { render } from "../shell/render.js";
import { sigilPicker } from "../shell/sigils.js";
import { S, board, enabled, label, site } from "../state/site.js";
import { openForm } from "../ui/dialogs.js";

const PALETTES = [["nigredo", "Nigredo, mousse", "#6f9a68"], ["albedo", "Albedo, lichen", "#aab7a6"], ["citrinitas", "Citrinitas, résine", "#c99a3c"], ["rubedo", "Rubedo, amanite", "#c0554a"]];
VIEWS.reglages = () => {
  const s = S(), c = s.config;
  return `<h2>Réglages</h2><p class="hint">Tout ici s'applique immédiatement.</p>
  <section><h3>Apparence</h3><p class="hint">Quatre étapes de l'Œuvre, prises dans le sous-bois.</p>
    <div class="swatches">${PALETTES.map(([id, n, col]) => `<button class="swatch ${c.palette === id ? "on" : ""}" data-act="pal" data-p="${id}"><i style="background:${col}"></i>${n}</button>`).join("")}</div>
    <div class="field-row" style="margin-top:14px"><label>Mode<select data-set="config.mode"><option value="auto" ${c.mode === "auto" ? "selected" : ""}>Suivre l'appareil</option><option value="dark" ${c.mode === "dark" ? "selected" : ""}>Toujours sombre</option><option value="light" ${c.mode === "light" ? "selected" : ""}>Toujours clair</option><option value="sun" ${c.mode === "sun" ? "selected" : ""}>Suivre le soleil</option></select></label>
    <label>Nom affiché<input data-set="config.name" value="${esc(c.name)}"></label></div>
    <div class="field-row" style="margin-top:12px"><label>Ouvrir sur (cet appareil)<select data-act="open-on"><option value="accueil" ${openOn() === "accueil" ? "selected" : ""}>L'accueil</option><option value="last" ${openOn() === "last" ? "selected" : ""}>Là où j'en étais</option></select></label><span></span></div></section>
  ${notifySettingsHTML()}
  ${skySettingsHTML()}
  ${radarSettingsHTML()}
  <section><h3>Modules</h3><p class="hint">Active, renomme, réordonne, range par domaine (Maison, Création… : la navigation les regroupe). Les modules personnalisés (marqués ✕) peuvent être supprimés définitivement.</p>
    <datalist id="domainList">${[...new Set(c.modules.map(m => String(m.group || "").trim()).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join("")}</datalist>
    ${c.modules.map((m, i) => `<div class="set mod" data-i="${i}"><input type="checkbox" data-act="mod-on" ${m.on ? "checked" : ""} aria-label="Activer ${esc(label(m.id))}"><input data-act="mod-label" value="${esc(label(m.id))}" aria-label="Nom du module">${SYSTEM.includes(m.id) ? "<span></span>" : `<input class="grp-in" data-act="mod-group" value="${esc(m.group || "")}" list="domainList" maxlength="40" placeholder="Domaine" aria-label="Domaine de ${esc(label(m.id))}">`}<div class="row">${s.modules[m.id] ? `<button class="btn ghost sm" data-act="mod-del" data-mod="${esc(m.id)}" aria-label="Supprimer définitivement" title="Supprimer définitivement">✕</button>` : ""}<button class="btn ghost sm" data-act="mod-up" aria-label="Monter">↑</button><button class="btn ghost sm" data-act="mod-down" aria-label="Descendre">↓</button></div></div>`).join("")}
    <details style="margin-top:14px"><summary class="hint" style="cursor:pointer;margin:0">+ Créer un module</summary>
      <div class="field-row" style="margin-top:10px"><label>Modèle ou type<select id="newModType"><optgroup label="Modèles">${MODULE_TEMPLATES.map(t => `<option value="tpl:${esc(t.id)}">${esc(t.name)} — ${esc(t.hint)}</option>`).join("")}</optgroup><optgroup label="Types vides">${Object.entries(MODULE_TYPES).map(([k, t]) => `<option value="${esc(k)}">${esc(t.label)}</option>`).join("")}</optgroup></select></label>
      <label>Nom<input id="newModName" placeholder="Nom du modèle si vide"></label></div>
      <button class="btn sm" data-act="mod-add" style="margin-top:8px">Créer</button></details>
  </section>
  <section id="modreg"><h3>Réglages par module</h3><p class="hint">Un bloc par module actif, dans l'ordre de la navigation : ses réglages propres, et le regroupement en pourcentage quand il existe.</p>
    ${c.modules.filter(m => enabled(m.id) && (s.modules[m.id] || grouperFor(m.id))).map(m => `<details id="mreg-${esc(m.id)}" data-mod="${esc(m.id)}" style="border-top:1px solid var(--rule);padding:12px 0">
        <summary style="cursor:pointer;font-size:1.05rem;font-weight:600">${esc(label(m.id))}</summary>
        <div style="margin-top:10px">${moduleSettingsHTML(m.id)}</div>
      </details>`).join("")}
  </section>
  ${enabled("assistant") ? `<section id="assistant-cfg"><h3>Assistant</h3><p class="hint">Claude dans le tableau de bord. Sur claude.ai, il passe par ton compte. Dans la version hébergée, il faut ta propre clé API : vérifiée auprès d'Anthropic, elle est gardée chiffrée sur le serveur de Selene, attachée à ton compte, et ne revient jamais dans la page.</p>
    <div class="field-row">${hosted() ? `<label>Clé API Anthropic${assistantKnown()?.cle ? ` (enregistrée : ${esc(assistantKnown().indice || "")})` : ""}<input type="password" data-act="as-key" value="" placeholder="${assistantKnown()?.cle ? "Coller une autre clé pour la remplacer" : "sk-ant-…"}" autocomplete="off"></label>` : ""}
    <label>Modèle<select data-act="as-model">${[["claude-haiku-4-5-20251001", "Haiku 4.5, rapide et peu cher"], ["claude-sonnet-5", "Sonnet 5, équilibré"], ["claude-opus-5-5", "Opus 5.5, le plus capable"]].map(([k, l]) => `<option value="${k}" ${s.config.assistant.model === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-act="as-actions" ${s.config.assistant.actions ? "checked" : ""}>Autoriser Claude à modifier le tableau de bord (tâches, capture, budget)</label>
    <p class="hint" style="margin:12px 0 4px">Ce que Claude peut lire :</p><div class="row">${Object.keys(s.config.assistant.share).filter(enabled).map(k => `<label style="display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" data-act="as-share" data-k="${esc(k)}" ${s.config.assistant.share[k] ? "checked" : ""}>${esc(label(k))}</label>`).join("")}</div>
    ${hosted() && assistantKnown()?.cle ? `<button class="btn ghost sm" data-act="as-forget" style="margin-top:10px">Oublier la clé (sur tous tes appareils)</button>` : ""}</section>` : ""}
  ${hosted() && authReady() && authSession ? `<section><h3>Compte</h3><p class="hint">Connecté en tant que ${esc(authSession.user.email)}. Tes données sont propres à ce compte et suivent sur tous tes appareils. Se déconnecter efface de cet appareil tes données et la conversation avec l'assistant ; ta clé API reste attachée à ton compte, chiffrée, jusqu'à ce que tu l'oublies.</p>
    <button class="btn ghost" data-act="auth-out">Se déconnecter</button>
    <details id="auth-delete" style="margin-top:16px"><summary class="hint" style="cursor:pointer;margin:0">Supprimer mon compte</summary>
      <p class="hint" style="margin-top:8px">Définitif : ton compte, tout ton tableau de bord sur le serveur et ta clé d'assistant sont effacés, puis cet appareil est vidé. Tes autres appareils perdent l'accès. Exporte d'abord une sauvegarde (plus bas) si tu veux garder quelque chose. Politique de confidentialité : <a href="https://mariebonifacio.github.io/selene/confidentialite.html" target="_blank" rel="noopener">ce que Selene garde, et où</a>.</p>
      <div class="field-row"><label>Tape « supprimer » pour confirmer<input id="authDelIn" autocomplete="off" autocapitalize="off" spellcheck="false"></label><span></span></div>
      <button class="btn sm" data-act="auth-delete" style="margin-top:8px;color:var(--alarm)">Supprimer définitivement</button></details></section>` : ""}
  ${hosted() ? shareSettingsHTML() : ""}
  ${hosted() && authReady() && authSession ? passeurSettingsHTML() : ""}
  ${hosted() && authReady() && authSession ? agendaSettingsHTML() : ""}
  ${hosted() ? zotSettingsHTML() : ""}
  <section><h3>Sauvegarde</h3><p class="hint">Tout ton état dans un fichier JSON, pour passer de claude.ai à GitHub Pages ou d'un navigateur à l'autre. La clé API n'y figure jamais.</p>
    <div class="row"><button class="btn" data-act="exp">Exporter</button><label class="btn" style="display:inline-block;font-weight:500">Importer<input type="file" accept="application/json,.json" data-act="imp" style="display:none"></label></div></section>
  <p class="hint" style="margin-top:24px"><a href="https://mariebonifacio.github.io/selene/confidentialite.html" target="_blank" rel="noopener">Confidentialité</a> : aucun traceur, aucune publicité ; ce que Selene garde, où, et comment tout effacer.</p>`;
};
/* Les réglages propres d'un module (son sigil, ceux de son type, son regroupement en pourcentage) : dans la page
   Réglages, et dans la feuille qu'ouvre « régler » depuis le module lui-même. */
export function moduleSettingsHTML(mod) {
  const s = S(), inst = s.modules[mod], G = grouperFor(mod), g = G ? gcfg(mod) : null, by = G ? groupBy(mod) : null;
  const names = G && G.renamable.includes(by) ? [...new Set(G.items().map(it => it[by]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")) : [];
  return `${sigilPicker(mod)}
        ${inst ? TYPE_UI[inst.type].settings(mod, inst) : ""}
        ${G ? `<div class="row" style="margin-top:0"><label style="display:flex;gap:8px;align-items:center;font-size:1rem"><input type="checkbox" data-act="grp-on" ${g.on ? "checked" : ""}>Regrouper en pourcentage</label></div>
          ${g.on ? `<div class="field-row" style="margin-top:8px">
            <label>Regrouper par<select data-act="grp-by">${Object.entries(G.fields).map(([k, l]) => `<option value="${esc(k)}" ${by === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
            <label>Trier par<select data-act="grp-sort"><option value="name" ${g.sort === "name" ? "selected" : ""}>Ordre naturel</option><option value="pct" ${g.sort === "pct" ? "selected" : ""}>Le plus avancé d'abord</option><option value="left" ${g.sort === "left" ? "selected" : ""}>Le plus en retard d'abord</option></select></label></div>
            <div class="field-row" style="margin-top:8px"><label>Titre du bloc<input data-act="grp-title" value="${esc(g.title)}" placeholder="Par ${esc(G.fields[by].toLowerCase())}"></label>
            <label style="display:flex;gap:8px;align-items:center;align-self:end;padding-bottom:10px"><input type="checkbox" data-act="grp-hide" ${g.hideDone ? "checked" : ""}>Masquer les groupes à 100 %</label></div>
            ${names.length ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer;margin:0">Renommer ou fusionner des ${esc(G.fields[by].toLowerCase())}s</summary><p class="hint" style="margin:6px 0">Donne le même nom à deux groupes pour les fusionner.</p>${names.map(n => `<div class="set" style="grid-template-columns:1fr"><input data-act="grp-rename" data-old="${esc(n)}" value="${esc(n)}" aria-label="Renommer ${esc(n)}"></div>`).join("")}</details>` : ""}
           ` : ""}` : ""}`;
}
CLICK["mod-add"] = () => {
  const choice = $("#newModType").value, tpl = MODULE_TEMPLATES.find(t => "tpl:" + t.id === choice);
  const name = $("#newModName").value.trim() || (tpl ? tpl.name : "");
  if (!name) return toast("Donne un nom au module.");
  addModule(tpl || { type: choice }, name);
};
CLICK["tpl-add"] = el => { const tpl = MODULE_TEMPLATES.find(t => t.id === el.dataset.tpl); if (tpl) addModule(tpl, tpl.name); };
CLICK["mod-del"] = el => {
  const id = el.dataset.mod, name = label(id);
  openForm(`Supprimer « ${name} »`, [{ n: "confirm", l: `Retape « ${name} » pour confirmer la suppression définitive de ses données.`, req: true }], {}, v => {
    if (v.confirm !== name) return toast("Nom incorrect, rien n'a été supprimé.");
    const s = S();
    deleteModuleInstance(s.modules, s.config.modules, id);
    delete s.config.labels[id]; delete s.config.groups[id]; delete s.config.assistant.share[id];
    site.save(); render(); toast(`« ${name} » supprimé.`);
  });
};
CLICK["exp"] = () => downloadFile(`selene-${todayISO()}.json`, createBackup(board.data, site.data), "application/json", "Sauvegarde Selene");
CLICK["pal"] = el => { S().config.palette = el.dataset.p; site.save(); render(); };
CLICK["mod-up"] = el => moveMod(el, -1);
