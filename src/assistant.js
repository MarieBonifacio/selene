/* ================= assistant =================
   Deux branchements : claude.ai (window.claude.use("sample"), sans clé) ou l'API Anthropic avec la clé
   de l'utilisatrice (build hébergé). Le contexte ne contient que les modules qu'elle a choisi de partager. */
let sampleNS = null, downloadsNS = null, chatBusy = false;
const hosted = () => !window.claude;
const getKey = () => { try { return localStorage.getItem("selene-api-key") || ""; } catch { return ""; } };
function backend() { if (!enabled("assistant")) return "off"; if (sampleNS) return "sample"; if (hosted() && getKey()) return "api"; return "none"; }
const chatLog = { get() { try { return JSON.parse(localStorage.getItem("selene-chat") || "[]"); } catch { return []; } }, set(v) { try { localStorage.setItem("selene-chat", JSON.stringify(v.slice(-40))); } catch {} } };
function contextText() {
  const s = S(), sh = s.config.assistant.share, now = todayISO(), m = moon(), L = [];
  L.push(`Date : ${fmt(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. Lune : ${m.name.toLowerCase()}, éclairée à ${Math.round(m.illum * 100)} %.`);
  for (const [id, inst] of Object.entries(s.modules)) {
    if (!sh[id] || !enabled(id)) continue;
    L.push(TYPE_UI[inst.type].context(inst, label(id).toUpperCase()));
  }
  return L.join("\n").slice(0, 14000);
}
function instructions() {
  const name = S().config.name || "Selene", permitted = availableTools();
  return `Tu es Claude, intégré au tableau de bord personnel de ${name}. Réponds en français, en prose, sans listes à puces sauf demande. Ton : lucide, cynique, humour noir glissé naturellement ; jamais de morale non demandée ni de justifications répétées. Chaque fois que tu emploies un terme technique ou savant, définis-le brièvement dans la phrase. Sois concis. Tu ne connais que les données ci-dessous, qu'elle a choisi de partager ; tu n'as aucun souvenir d'autres conversations.
${permitted.length ? "Tu peux agir uniquement avec les outils fournis. Ne les utilise que si c'est demandé ou clairement voulu, et dis ce que tu as fait." : "Tu ne peux rien modifier : conseille seulement."}

DONNÉES DU TABLEAU DE BORD
${contextText()}`;
}
const TOOLS = [
  { name: "ajouter_tache", module: () => firstOfType("taches"), description: "Ajoute une tâche au premier module de tâches (voir ses types dans les données). Renvoie une confirmation.", inputSchema: { type: "object", properties: { titre: { type: "string" }, piece: { type: "string", description: "pièce ou lieu" }, echeance: { type: "string", description: "AAAA-MM-JJ" }, type: { type: "string" } }, required: ["titre"] },
    execute(i) { const inst = S().modules[firstOfType("taches")]; const t = addTask(inst.entries, { title: i.titre, room: i.piece, cat: i.type || inst.config.cats[0], due: i.echeance, note: "Ajoutée par l'assistant" }, uid(), todayISO()); site.save(); render(); return `Tâche ajoutée : ${t.title}`; } },
  { name: "terminer_tache", module: () => firstOfType("taches"), description: "Marque comme faite une tâche, par son identifiant entre crochets.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    execute(i) {
      const found = allTasks().find(([, t]) => t.id === i.id); if (!found) throw new Error("Tâche introuvable");
      const t = setTaskDone(S().modules[found[0]].entries, i.id, true, todayISO()); site.save(); render(); return `Terminée : ${t.title}`;
    } },
  { name: "capturer", module: () => inboxId(S().modules), description: "Dépose une note dans la boîte de réception, à trier plus tard.", inputSchema: { type: "object", properties: { texte: { type: "string" } }, required: ["texte"] },
    execute(i) { addCapture(S().modules[inboxId(S().modules)].entries, i.texte, uid(), todayISO()); site.save(); render(); return "Capturé."; } },
  { name: "ajouter_operation", module: () => firstOfType("budget"), description: "Enregistre une dépense ou un revenu dans le premier module Budget.", inputSchema: { type: "object", properties: { montant: { type: "number" }, type: { type: "string", enum: ["dépense", "revenu"] }, enveloppe: { type: "string" }, note: { type: "string" }, date: { type: "string", description: "AAAA-MM-JJ, aujourd'hui par défaut" } }, required: ["montant"] },
    execute(i) { const entry = addBudgetEntry(S().modules[firstOfType("budget")].entries, { amount: i.montant, type: i.type, cat: i.enveloppe, note: i.note, date: i.date }, uid(), todayISO()); site.save(); render(); return `Enregistré : ${money(entry.amount)}`; } }
];
// Premier module actif d'un type, dans l'ordre de la navigation.
const firstOfType = type => (S().config.modules.find(m => m.on && Object.hasOwn(S().modules, m.id) && S().modules[m.id].type === type) || {}).id || null;
// Le module d'un outil peut dépendre des données (la boîte de réception est celle qu'on a désignée).
const toolModule = t => typeof t.module === "function" ? t.module() : t.module;
const availableTools = () => S().config.assistant.actions ? TOOLS.filter(t => { const m = toolModule(t); return m && enabled(m); }) : [];
const executeTool = (name, input) => {
  const tool = availableTools().find(t => t.name === name);
  if (!tool) throw new Error("Action non autorisée ou module désactivé");
  return tool.execute(input);
};
async function askAPI(history) {
  const a = S().config.assistant, tools = availableTools().map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  const msgs = history.map(m => ({ role: m.role, content: m.content })); let out = "";
  for (let round = 0; round < 5; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": getKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: a.model, max_tokens: 1500, system: instructions(), messages: msgs, ...(tools.length ? { tools } : {}) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    if (!Array.isArray(data.content)) throw new Error("réponse inattendue de l'API");
    const txt = data.content.filter(b => b.type === "text").map(b => b.text).join("\n"); if (txt) out += (out ? "\n\n" : "") + txt;
    if (data.stop_reason !== "tool_use") break;
    msgs.push({ role: "assistant", content: data.content });
    const results = [];
    for (const b of data.content.filter(b => b.type === "tool_use")) { let r; try { r = await executeTool(b.name, b.input || {}); } catch (e) { r = "Erreur : " + e.message; } results.push({ type: "tool_result", tool_use_id: b.id, content: String(r) }); }
    msgs.push({ role: "user", content: results });
  }
  return out || "(pas de réponse)";
}
async function askSample(history, onText) {
  const input = [{ role: "user", content: instructions() }, ...history];
  const opts = { onText: ({ text }) => onText(text) };
  if (availableTools().length) opts.tools = availableTools().map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, execute: i => executeTool(t.name, i) }));
  try { return (await sampleNS(input, opts)).text; }
  catch (e) { if (e && e.code === "tools_unavailable") { delete opts.tools; return (await sampleNS(input, opts)).text; } throw e; }
}
const mdLite = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>");
async function sendChat(text) {
  if (chatBusy || !text.trim()) return;
  const b = backend(); if (b !== "sample" && b !== "api") return toast("L'assistant n'est pas branché. Voir Réglages.");
  const log = chatLog.get(); log.push({ role: "user", content: text.trim().slice(0, 4000) }); chatLog.set(log); chatBusy = true; if ($("#chatIn")) $("#chatIn").value = ""; render();
  const onText = t => { const p = document.getElementById("pending"); if (p) p.textContent = t; };
  try {
    const hist = log.slice(-20).map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) })); while (hist.length && hist[0].role !== "user") hist.shift();
    const reply = b === "sample" ? await askSample(hist, onText) : await askAPI(hist);
    const l2 = chatLog.get(); l2.push({ role: "assistant", content: reply }); chatLog.set(l2);
  } catch (e) {
    const code = e && e.code, msg = code === "not_granted" ? "Accès refusé à Claude pour cette page." : code === "rate_limited" ? "Trop de demandes, réessaie dans un moment." : (e && e.message) || "Erreur inconnue.";
    toast(msg);
  }
  chatBusy = false; render();
  const log2 = document.querySelector(".chat"); if (log2) log2.lastElementChild?.scrollIntoView({ block: "nearest" });
}
// Une suggestion d'idées pour la première collection affichée en colonnes (un tableau de production).
const ideaChip = () => { const id = Object.keys(S().modules).find(k => S().modules[k].type === "collection" && S().modules[k].config.display === "colonnes" && enabled(k)); return id ? [`Propose trois idées pour ${label(id)}`] : []; };
VIEWS.assistant = () => {
  const b = backend(), a = S().config.assistant, log = chatLog.get();
  const status = b === "sample" ? "Branché via claude.ai : aucune clé requise, la première question te demandera ton accord." : b === "api" ? `Branché via ta clé API, modèle ${esc(a.model)}. Chaque échange est facturé sur ton compte.` : hosted() ? `Pas encore branché. Colle ta clé API dans <a href="#reglages">Réglages</a>.` : "Indisponible dans cette vue.";
  const shared = Object.entries(a.share).filter(([k, v]) => v && enabled(k)).map(([k]) => label(k)).join(", ") || "rien";
  return `<div class="row"><h2 style="margin:0">${esc(label("assistant"))}</h2><span class="spacer"></span>${log.length ? `<button class="btn ghost sm" data-act="chat-clear">Effacer la conversation</button>` : ""}</div>
  <p class="status">${status}<br>Données partagées : ${esc(shared)}. ${a.actions ? "Peut agir sur le tableau de bord." : "Lecture seule."}</p>
  <div class="chat">${log.map(m => `<div class="msg ${m.role === "user" ? "user" : "claude"}">${m.role === "user" ? esc(m.content) : mdLite(m.content)}</div>`).join("")}${chatBusy ? `<div class="msg claude" id="pending">…</div>` : ""}</div>
  ${!log.length ? `<div class="chips">${["Qu'est-ce que je fais aujourd'hui ?", ...(firstOfType("taches") ? [`Fais le point sur ${label(firstOfType("taches"))}`] : []), "Où en est mon budget ce mois-ci ?", ...ideaChip()].map(q => `<button class="btn sm" data-act="chat-chip">${esc(q)}</button>`).join("")}</div>` : ""}
  <div class="capture"><textarea id="chatIn" data-draft rows="2" placeholder="Écris à Claude…" aria-label="Message" ${b === "sample" || b === "api" ? "" : "disabled"}></textarea><button class="btn acc" data-act="chat-send" ${chatBusy ? "disabled" : ""}>Envoyer</button></div>`;
};
