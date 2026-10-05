/* Assistant.
   Deux branchements : claude.ai (platform.claude.use("sample"), sans clé) ou, dans la version hébergée connectée, la
   fonction « assistant » (supabase/functions/assistant, docs/assistant.md), qui garde la clé Anthropic du compte,
   chiffrée, et appelle Claude pour lui : la clé ne revient jamais dans la page. Le contexte ne contient que les
   modules que la personne a choisi de partager. */
import { hosted, platform } from "../../platform.js";
import { addBudgetEntry, addCapture, addTask, inboxId, setTaskDone } from "../../core/domain.js";
import { CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { $, esc, toast } from "../lib/dom.js";
import { fmt, money, todayISO, uid } from "../lib/format.js";
import { LANGS, tr, uiLang } from "../i18n/index.js";
import { serverError } from "../services/erreurs.js";
import { allTasks } from "../modules/taches.js";
import { moon } from "../scene/moon.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authReady, authRefreshIfNeeded, authSession } from "../services/auth.js";
import { sampleNS } from "../services/host.js";
import { routeOf } from "../shell/nav.js";
import { render } from "../shell/render.js";
import { S, enabled, label, shownModule, site } from "../state/site.js";
import { ask } from "../ui/dialogs.js";

export let chatBusy = false;
/* Ce que dit le serveur de la clé du compte : null tant qu'on ne sait pas, { cle, indice? } ensuite ; « absent »
   si la fonction n'est pas déployée (on n'insiste pas). Une demande qui échoue (hors ligne, fonction injoignable,
   refus CORS) n'est pas refaite avant ASSISTANT_PAUSE : la page, qui la déclenche en se dessinant, la relancerait
   sinon à chaque rendu. */
let assistantCle = null, assistantEtat = "", assistantAbsent = 0, assistantDemande = null, assistantPause = 0; // assistantAbsent : 404 ou 503, ce que la fonction a répondu
const ASSISTANT_PAUSE = 5 * 60000;
export const assistantSetCle = r => { assistantCle = r; }; // l'état de la clé, tel que le serveur vient de le dire
const assistantPret = () => hosted() && authReady() && !!authSession && assistantEtat !== "absent";
/* Ce qui empêche l'assistant hébergé de répondre, dit en une phrase (ou rien) : la fonction n'est pas déployée (404) ou pas
   configurée (503) : elle ne répondra pas, inutile d'insister ; ou elle est injoignable (hors ligne, refus CORS…). Une
   personne connectée à qui l'on répond « connecte-toi » ne comprend pas ce qui manque. */
export const assistantProbleme = () => !hosted() ? "" : assistantEtat === "absent" ? (assistantAbsent === 503 ? tr`Assistant non configuré.` : tr`Assistant non déployé (voir docs/assistant.md).`)
  : assistantEtat === "injoignable" ? tr`Assistant injoignable (hors ligne, ou pas encore déployé).` : "";
export async function assistantCall(corps, delai = 15000) {
  if (!assistantPret()) throw new Error(assistantProbleme() && authReady() && authSession ? assistantProbleme() : tr`L'assistant hébergé demande d'être connectée à ton compte.`);
  const s = await authRefreshIfNeeded(); if (!s) throw new Error(tr`Session expirée : reconnecte-toi.`);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), delai);
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, { method: "POST", signal: ac.signal,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}` }, body: JSON.stringify(corps) });
  } catch { if (!ac.signal.aborted) assistantEtat = "injoignable"; throw new Error(ac.signal.aborted ? tr`Claude met trop de temps à répondre.` : tr`Assistant injoignable (hors ligne, ou pas encore déployé).`); } finally { clearTimeout(t); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 404 || r.status === 503) { assistantEtat = "absent"; assistantAbsent = r.status; throw r.status === 404 ? new Error(tr`Assistant non déployé (voir docs/assistant.md).`) : serverError(j, tr`Assistant non configuré.`); }
  if (j && j.code === "sans-cle") assistantCle = { cle: false };
  if (!r.ok) throw serverError(j, tr`erreur ${r.status}`);
  assistantEtat = "ok";
  return j;
}
/* L'état de la clé, demandé une fois ; une clé laissée dans cet appareil par une ancienne version est d'abord
   confiée au serveur, puis effacée d'ici (même refusée : elle ne sert plus à rien ici). */
function assistantRefresh() {
  if (!assistantPret() || assistantDemande || Date.now() < assistantPause) return assistantDemande;
  const ancienne = platform.secrets.get("selene-api-key");
  assistantDemande = (async () => {
    const avant = assistantCle, avantProbleme = assistantProbleme();
    try {
      if (ancienne) {
        try { assistantCle = await assistantCall({ action: "cle", cle: ancienne }); platform.secrets.remove("selene-api-key"); }
        catch (e) { if (["cle", "pas-une-cle"].includes(e.code) || /refuse|clé d'API/.test(e.message)) platform.secrets.remove("selene-api-key"); throw e; } // le texte : un serveur d'avant les codes
      } else assistantCle = await assistantCall({ action: "etat" });
    } catch { assistantPause = Date.now() + ASSISTANT_PAUSE; } finally { assistantDemande = null; }
    // Redessiner seulement si la réponse change ce qu'on montre : jamais après un échec qui ne change rien (et un rendu
    // redemanderait aussitôt : la boucle qui rendait tous les boutons inertes, le 30 septembre 2026). Un échec qui change
    // ce qu'on dit (« non déployé », « injoignable » : la première fois seulement) redessine une fois, et seulement là où
    // cela se lit ; la pause de cinq minutes empêche que ce rendu redemande.
    if (assistantCle !== avant || (assistantProbleme() !== avantProbleme && ["assistant", "reglages"].includes(routeOf().view))) render();
  })();
  return assistantDemande;
}
export const assistantKnown = () => { if (!assistantCle) assistantRefresh(); return assistantCle; };
export function backend() { if (!enabled("assistant")) return "off"; if (sampleNS) return "sample"; if (hosted() && assistantKnown()?.cle) return "api"; return "none"; }
export const chatLog = { get() { try { return JSON.parse(platform.storage.get("selene-chat") || "[]"); } catch { return []; } }, set(v) { try { platform.storage.set("selene-chat", JSON.stringify(v.slice(-40))); } catch {} } };
export function contextText() {
  const s = S(), sh = s.config.assistant.share, now = todayISO(), m = moon(), L = [];
  L.push(`Date : ${fmt(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. Lune : ${m.name.toLowerCase()}, éclairée à ${Math.round(m.illum * 100)} %.`);
  for (const [id, inst] of Object.entries(s.modules)) {
    if (!sh[id] || !enabled(id)) continue;
    L.push(TYPE_UI[inst.type].context(inst, label(id).toUpperCase(), id));
  }
  return L.join("\n").slice(0, 14000);
}
function instructions() {
  const name = S().config.name || "Selene", permitted = availableTools();
  return `Tu es Claude, intégré au tableau de bord personnel de ${name}. Réponds en ${LANGS[uiLang()].frName}, en prose, sans listes à puces sauf demande. Ton : lucide, cynique, humour noir glissé naturellement ; jamais de morale non demandée ni de justifications répétées. Chaque fois que tu emploies un terme technique ou savant, définis-le brièvement dans la phrase. Sois concis. Tu ne connais que les données ci-dessous, qu'elle a choisi de partager ; tu n'as aucun souvenir d'autres conversations.
${permitted.length ? "Tu peux agir uniquement avec les outils fournis. Ne les utilise que si c'est demandé ou clairement voulu, et dis ce que tu as fait." : "Tu ne peux rien modifier : conseille seulement."}

DONNÉES DU TABLEAU DE BORD
${contextText()}`;
}
// Un texte venu du modèle, coupé pour la fenêtre d'accord (qui l'affiche en texte brut, jamais en HTML).
const short = v => { const t = String(v ?? "").replace(/\s+/g, " ").trim(); return t.length > 160 ? t.slice(0, 159) + "…" : t; };
export const TOOLS = [
  { name: "ajouter_tache", module: () => firstOfType("taches"), description: "Ajoute une tâche au premier module de tâches (voir ses types dans les données). Renvoie une confirmation.", inputSchema: { type: "object", properties: { titre: { type: "string" }, piece: { type: "string", description: "pièce ou lieu" }, echeance: { type: "string", description: "AAAA-MM-JJ" }, type: { type: "string" } }, required: ["titre"] },
    describe: i => tr`ajouter la tâche « ${short(i.titre)} »` + (i.echeance ? tr`, pour le ${short(i.echeance)}` : ""),
    execute(i) { const inst = S().modules[firstOfType("taches")]; const t = addTask(inst.entries, { title: i.titre, room: i.piece, cat: i.type || inst.config.cats[0], due: i.echeance, note: "Ajoutée par l'assistant" }, uid(), todayISO()); site.save(); render(); return `Tâche ajoutée : ${t.title}`; } },
  { name: "terminer_tache", module: () => firstOfType("taches"), description: "Marque comme faite une tâche, par son identifiant entre crochets.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    describe: i => { const found = allTasks().find(([, t]) => t.id === i.id); return tr`marquer comme faite la tâche « ${short(found ? found[1].title : i.id)} »`; },
    execute(i) {
      const found = allTasks().find(([, t]) => t.id === i.id); if (!found) throw new Error("Tâche introuvable");
      const t = setTaskDone(S().modules[found[0]].entries, i.id, true, todayISO()); site.save(); render(); return `Terminée : ${t.title}`;
    } },
  { name: "capturer", module: () => inboxId(S().modules), description: "Dépose une note dans la boîte de réception, à trier plus tard.", inputSchema: { type: "object", properties: { texte: { type: "string" } }, required: ["texte"] },
    describe: i => tr`déposer dans la boîte de réception : « ${short(i.texte)} »`,
    execute(i) { addCapture(S().modules[inboxId(S().modules)].entries, i.texte, uid(), todayISO()); site.save(); render(); return "Capturé."; } },
  { name: "ajouter_operation", module: () => firstOfType("budget"), description: "Enregistre une dépense ou un revenu dans le premier module Budget.", inputSchema: { type: "object", properties: { montant: { type: "number" }, type: { type: "string", enum: ["dépense", "revenu"] }, enveloppe: { type: "string" }, note: { type: "string" }, date: { type: "string", description: "AAAA-MM-JJ, aujourd'hui par défaut" } }, required: ["montant"] },
    describe: i => (i.type === "revenu" ? tr`enregistrer un revenu de ${money(Number(i.montant) || 0)}` : tr`enregistrer une dépense de ${money(Number(i.montant) || 0)}`) + (i.enveloppe ? ` (${short(i.enveloppe)})` : ""),
    execute(i) { const entry = addBudgetEntry(S().modules[firstOfType("budget")].entries, { amount: i.montant, type: i.type, cat: i.enveloppe, note: i.note, date: i.date }, uid(), todayISO()); site.save(); render(); return `Enregistré : ${money(entry.amount)}`; } }
];
// Premier module actif d'un type, dans l'ordre de la navigation.
export const firstOfType = type => (S().config.modules.find(m => shownModule(m) && S().modules[m.id].type === type) || {}).id || null;
// Le module d'un outil peut dépendre des données (la boîte de réception est celle qu'on a désignée).
const toolModule = t => typeof t.module === "function" ? t.module() : t.module;
export const availableTools = () => S().config.assistant.actions ? TOOLS.filter(t => { const m = toolModule(t); return m && enabled(m); }) : [];
export const executeTool = (name, input) => {
  const tool = availableTools().find(t => t.name === name);
  if (!tool) throw new Error("Action non autorisée ou module désactivé");
  return tool.execute(input);
};
/* Avant chaque écriture, l'accord de la personne (T14 de l'audit). Un texte que l'assistant lit (une source, un flux, une
   note) peut porter des consignes que le modèle prendrait pour les siennes : c'est l'injection indirecte. La fenêtre dit
   ce qui serait écrit, en texte brut ; un refus revient au modèle comme tel, et rien ne change. Les droits (module
   actif, actions permises) sont vérifiés avant de demander, puis de nouveau à l'exécution. */
export async function runTool(name, input) {
  const tool = availableTools().find(t => t.name === name);
  if (!tool) throw new Error("Action non autorisée ou module désactivé");
  if (!await ask(tr`L'assistant voudrait ${tool.describe(input || {})}. D'accord ?`)) return "Refusé par la personne : rien n'a été modifié.";
  return executeTool(name, input);
}
async function askAPI(history) {
  const a = S().config.assistant, tools = availableTools().map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  const msgs = history.map(m => ({ role: m.role, content: m.content })); let out = "";
  for (let round = 0; round < 5; round++) {
    const data = await assistantCall({ action: "message", requete: { model: a.model, max_tokens: 1500, system: instructions(), messages: msgs, ...(tools.length ? { tools } : {}) } }, 70000);
    if (!Array.isArray(data.content)) throw new Error(tr`réponse inattendue de l'API`);
    const txt = data.content.filter(b => b.type === "text").map(b => b.text).join("\n"); if (txt) out += (out ? "\n\n" : "") + txt;
    if (data.stop_reason !== "tool_use") break;
    msgs.push({ role: "assistant", content: data.content });
    const results = [];
    for (const b of data.content.filter(b => b.type === "tool_use")) { let r; try { r = await runTool(b.name, b.input || {}); } catch (e) { r = "Erreur : " + e.message; } results.push({ type: "tool_result", tool_use_id: b.id, content: String(r) }); }
    msgs.push({ role: "user", content: results });
  }
  return out || tr`(pas de réponse)`;
}
async function askSample(history, onText) {
  const input = [{ role: "user", content: instructions() }, ...history];
  const opts = { onText: ({ text }) => onText(text) };
  if (availableTools().length) opts.tools = availableTools().map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, execute: i => runTool(t.name, i) }));
  try { return (await sampleNS(input, opts)).text; }
  catch (e) { if (e && e.code === "tools_unavailable") { delete opts.tools; return (await sampleNS(input, opts)).text; } throw e; }
}
const mdLite = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>");
export async function sendChat(text) {
  if (chatBusy || !text.trim()) return;
  const b = backend(); if (b !== "sample" && b !== "api") return toast(tr`L'assistant n'est pas branché. Voir Réglages.`);
  const log = chatLog.get(); log.push({ role: "user", content: text.trim().slice(0, 4000) }); chatLog.set(log); chatBusy = true; if ($("#chatIn")) $("#chatIn").value = ""; render();
  const onText = t => { const p = document.getElementById("pending"); if (p) p.textContent = t; };
  try {
    const hist = log.slice(-20).map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) })); while (hist.length && hist[0].role !== "user") hist.shift();
    const reply = b === "sample" ? await askSample(hist, onText) : await askAPI(hist);
    const l2 = chatLog.get(); l2.push({ role: "assistant", content: reply }); chatLog.set(l2);
  } catch (e) {
    const code = e && e.code, msg = code === "not_granted" ? tr`Accès refusé à Claude pour cette page.` : code === "rate_limited" ? tr`Trop de demandes, réessaie dans un moment.` : (e && e.message) || tr`Erreur inconnue.`;
    toast(msg);
  }
  chatBusy = false; render();
  const log2 = document.querySelector(".chat"); if (log2) log2.lastElementChild?.scrollIntoView({ block: "nearest" });
}
// Une suggestion d'idées pour la première collection affichée en colonnes (un tableau de production).
const ideaChip = () => { const id = Object.keys(S().modules).find(k => S().modules[k].type === "collection" && S().modules[k].config.display === "colonnes" && enabled(k)); return id ? [tr`Propose trois idées pour ${label(id)}`] : []; };
VIEWS.assistant = () => {
  const b = backend(), a = S().config.assistant, log = chatLog.get();
  const status = b === "sample" ? tr`Branché via claude.ai : aucune clé requise, la première question te demandera ton accord.` : b === "api" ? tr`Branché via ta clé API, modèle ${esc(a.model)}. Chaque échange est facturé sur ton compte.` : hosted() ? (assistantProbleme() ? esc(assistantProbleme()) : tr`Pas encore branché. Colle ta clé API dans ${`<a href="#reglages">${tr`Réglages`}</a>`}.`) : tr`Indisponible dans cette vue.`;
  const shared = Object.entries(a.share).filter(([k, v]) => v && enabled(k)).map(([k]) => label(k)).join(", ") || tr`rien`;
  return `<div class="row"><h2 style="margin:0">${esc(label("assistant"))}</h2><span class="spacer"></span>${log.length ? `<button class="btn ghost sm" data-act="chat-clear">${tr`Effacer la conversation`}</button>` : ""}</div>
  <p class="status">${status}<br>${tr`Données partagées : ${esc(shared)}.`} ${a.actions ? tr`Peut agir sur le tableau de bord.` : tr`Lecture seule.`}</p>
  <div class="chat">${log.map(m => `<div class="msg ${m.role === "user" ? "user" : "claude"}">${m.role === "user" ? esc(m.content) : mdLite(m.content)}</div>`).join("")}${chatBusy ? `<div class="msg claude" id="pending">…</div>` : ""}</div>
  ${!log.length ? `<div class="chips">${[tr`Qu'est-ce que je fais aujourd'hui ?`, ...(firstOfType("taches") ? [tr`Fais le point sur ${label(firstOfType("taches"))}`] : []), tr`Où en est mon budget ce mois-ci ?`, ...ideaChip()].map(q => `<button class="btn sm" data-act="chat-chip">${esc(q)}</button>`).join("")}</div>` : ""}
  <div class="capture"><textarea id="chatIn" data-draft rows="2" placeholder="${tr`Écris à Claude…`}" aria-label="${tr`Message`}" ${b === "sample" || b === "api" ? "" : "disabled"}></textarea><button class="btn acc" data-act="chat-send" ${chatBusy ? "disabled" : ""}>${tr`Envoyer`}</button></div>`;
};
CLICK["chat-send"] = () => { const t = $("#chatIn").value; sendChat(t); };
CLICK["chat-chip"] = el => sendChat(el.textContent);
CLICK["chat-clear"] = async () => { if (await ask(tr`Effacer la conversation ?`)) { chatLog.set([]); render(); } };
CLICK["as-forget"] = async () => {
  try { assistantSetCle(await assistantCall({ action: "oublier" })); toast(tr`Clé effacée du serveur.`); } catch (e) { toast(tr`Clé non effacée : ${e.message}`); }
  render();
};
