/* Un espace par suivi. Aucun texte intime dans le corpus transversal, aucun rappel poussé. */
import { REGULATION_MILESTONES, REGULATION_MODES, REGULATION_SUBJECTS, addRegulationGoal, closeRegulationDay, regulationDay, regulationGoal, regulationMarks, regulationPeriod, regulationRemaining, saveRegulationEvent, regulationSnapshot } from "../../core/regulation.js";
import { registerType } from "../registry.js";
import { $, esc, paged, toast } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { addDaysTo, fmt, todayISO, uid } from "../lib/format.js";
import { render } from "../shell/render.js";
import { S, label, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";
import { removeWithUndo } from "./entries.js";

const subject = inst => REGULATION_SUBJECTS[inst.config.subject];
const number = n => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "";
const moduleId = el => el.dataset.mod || el.closest("[data-mod]").dataset.mod;
const entryId = el => el.closest("[data-id]")?.dataset.id;
const strategies = inst => inst.config.strategies.split("\n").map(s => s.trim().slice(0, 200)).filter(Boolean);
const goalLabel = (inst, g) => !g ? "À définir" : g.mode === "observer" ? "Observer sans cible" : g.mode === "arreter" ? "Viser l'arrêt" : `Au plus ${number(g.limit)} ${subject(inst).unit} par jour`;
const safety = inst => inst.config.subject === "alcool" ? `<p class="hint">Un arrêt brutal ou une réduction rapide de l'alcool peuvent être dangereux en cas de dépendance. Parle-en à un médecin ou à un CSAPA avant de changer ta consommation si tu es dépendant·e ou as des symptômes de manque. Selene ne prescrit aucun sevrage. En cas de confusion, hallucinations ou convulsions, appelle le 15 ou le 112. <a href="https://www.alcool-info-service.fr/questions-reponses/conseils-pour-larret-brutal" target="_blank" rel="noopener noreferrer">Alcool Info Service</a>.</p>` : "";
const unitHint = inst => inst.config.subject === "alcool" ? `Un verre standard = 10 g d'alcool pur, pas nécessairement un verre servi. <a href="https://www.alcool-info-service.fr/sinformer-et-evaluer-sa-consommation/alcool-et-sante/les-reperes-de-consommation-quest-ce-que-cest" target="_blank" rel="noopener noreferrer">Comprendre l'unité</a>.` : inst.config.subject === "cannabis" ? "Quantités estimées en grammes de produit, pas une dose de THC. La puissance et les formes peuvent varier : ces chiffres ne mesurent pas le risque." : inst.config.subject === "reseaux" ? "Minutes saisies à la main, par exemple depuis le temps d'écran du téléphone. Selene ne lit ni ne bloque les autres applications." : "Nombre de cigarettes fumées ; les substituts nicotiniques ne sont pas comptés ici.";
const save = () => { site.save(); render(); };

function goalForm(id) {
  const inst = S().modules[id], g = regulationGoal(inst, todayISO());
  openForm("Mon objectif — aucune diminution automatique", [
    ...(!inst.goals.length ? [{ n: "subject", l: "Ce que je suis", t: "select", o: Object.entries(REGULATION_SUBJECTS).map(([k, v]) => [k, v.label]) }] : []),
    { n: "mode", l: "Intention", t: "select", o: Object.entries(REGULATION_MODES) },
    { n: "limit", l: "Limite quotidienne en réduction (cigarettes / g / verres standard / min ; ignorée pour observer ou arrêter)", t: "number", step: 0.01 },
    { n: "date", l: "À partir du (les journées déjà confirmées gardent leur objectif)", t: "date", req: true }
  ], { subject: inst.config.subject, mode: g?.mode || "observer", limit: g?.mode === "reduire" ? g.limit : "", date: todayISO() }, v => {
    const cur = S().modules[id]; if (!cur) return;
    if (v.subject && cur.goals.length && v.subject !== cur.config.subject) throw new Error("Le suivi a changé sur un autre appareil. Rouvre le formulaire.");
    const next = { ...cur, config: { ...cur.config, subject: cur.goals.length ? cur.config.subject : v.subject }, goals: [...cur.goals] };
    addRegulationGoal(next, v, uid(), todayISO(), Date.now());
    cur.config = next.config; cur.goals = next.goals;
    save(); toast("Objectif enregistré. Les bilans déjà confirmés restent inchangés.");
  }, "Pour l’alcool : un arrêt brutal ou une réduction rapide peuvent être dangereux en cas de dépendance. Consulte un médecin ou un CSAPA pour préparer ce changement. Cette app ne prescrit pas de sevrage.");
}
function eventForm(id, kind, oldId = null) {
  const inst = S().modules[id], old = oldId && inst.entries.find(e => e.id === oldId), meta = subject(inst);
  const fields = [{ n: "date", l: "Date", t: "date", req: true }];
  if (kind === "use") fields.push({ n: "value", l: `Quantité à ajouter (${meta.unit}) — pas le total déjà saisi`, t: "number", step: meta.step, min: meta.step, max: 100000, req: true });
  if (kind === "urge") fields.push({ n: "intensity", l: "Intensité de l'envie, facultative (0 à 10)", t: "number", max: 10 }, { n: "strategy", l: "Ce que je peux essayer, facultatif", t: "select", o: [["", "Choisir plus tard"], ...strategies(inst).map(s => [s, s]), ...(old?.strategy && !strategies(inst).includes(old.strategy) ? [[old.strategy, old.strategy]] : [])] }, { n: "outcome", l: "Retour sur cette tentative", t: "select", o: [["", "Pas encore évaluée"], ["utile", "Utile pour moi"], ["neutre", "Sans changement"], ["difficile", "Difficile"]] });
  if (kind === "action") fields.push({ n: "strategy", l: "Action de mon plan que j'ai réalisée (une marque au plus par jour)", req: true });
  fields.push({ n: "note", l: "Contexte ou note, facultatif", t: "textarea" });
  openForm(kind === "use" ? "Noter une consommation ou une durée" : kind === "urge" ? "Une envie, pas un échec" : "Une action réalisée", fields, old || { date: todayISO(), strategy: kind === "action" ? strategies(inst)[0] || "" : "" }, v => {
    const cur = S().modules[id]; if (!cur) return;
    if (oldId && !cur.entries.some(e => e.id === oldId)) throw new Error("Cette entrée a été supprimée ailleurs. Rouvre le journal.");
    saveRegulationEvent(cur, { ...v, kind }, oldId || uid(), todayISO(), Date.now(), zone());
    save(); toast(kind === "action" ? "Action gardée. Un écart ultérieur n'efface pas ce geste." : "Noté.");
  });
}
function dayForm(id) {
  const inst = S().modules[id], date = todayISO(), d = regulationDay(inst, date);
  openForm("Confirmer une journée entièrement renseignée", [
    { n: "date", l: `Date — aujourd'hui : ${number(d.total)} ${subject(inst).unit} notés. Ajoute d'abord toute consommation manquante.`, t: "date", req: true },
    { n: "complete", l: "Toutes les consommations de cette journée sont saisies (aucune saisie = zéro seulement si tu confirmes)", t: "select", o: [["", "Je ne sais pas / laisser inconnue"], ["yes", "Oui, la journée est complète"]] }
  ], { date, complete: "" }, async v => {
    if (v.complete !== "yes") return;
    const cur = S().modules[id]; if (!cur) return;
    const state = regulationDay(cur, v.date), snapshot = regulationSnapshot(cur, v.date);
    if (!await ask(`Confirmer ${fmt(v.date)} : ${number(state.total)} ${subject(cur).unit} au total ?`)) return;
    const latest = S().modules[id]; if (!latest) return;
    // Une synchronisation pendant la confirmation ne doit pas valider une quantité jamais vue.
    if (regulationSnapshot(latest, v.date) !== snapshot) return toast("Le total a changé ailleurs. Vérifie-le puis confirme à nouveau.");
    closeRegulationDay(latest, v.date, todayISO(), Date.now(), zone()); save();
  });
}
let pauseTick = null;
function tickPause() {
  clearTimeout(pauseTick);
  const el = $("#regPauseClock"); if (!el?.dataset?.end) return;
  const left = regulationRemaining(Number(el.dataset.end), Date.now());
  el.textContent = left ? `${Math.floor(left / 60)} min ${left % 60} s` : "Pause terminée. Tu peux noter ce qui t'a aidé, ou fermer cet écran.";
  if (left) pauseTick = setTimeout(tickPause, 1000);
}
function progressHTML(inst) {
  if (!inst.config.rewards) return "";
  const marks = regulationMarks(inst), next = REGULATION_MILESTONES.find(n => n > marks);
  return `<section aria-label="Planche de progression"><h3>Les gestes restent</h3><p><b>${marks} marque${marks > 1 ? "s" : ""}</b> · une par journée avec une action réalisée.</p><ol class="plain">${REGULATION_MILESTONES.map(n => `<li>${marks >= n ? "✓" : "○"} ${n} marque${n > 1 ? "s" : ""} · ${marks >= n ? "jalon atteint" : "à venir"}</li>`).join("")}</ol>
    <p class="hint">${next ? `Prochain jalon : ${next} marques.` : "Tous les jalons sont atteints ; tes gestes continuent à compter."} Aucun jour consécutif exigé. Un écart ne retire rien. Corriger ou supprimer une action corrige aussi le compte.</p>
    ${inst.config.reward ? `<p>À ${inst.config.rewardAt} marques : <b>${esc(inst.config.reward)}</b> · ${marks >= inst.config.rewardAt ? "objectif atteint" : `${Math.max(0, inst.config.rewardAt - marks)} encore`}</p>` : ""}</section>`;
}
function periodHTML(inst) {
  const today = todayISO(), current = regulationPeriod(inst, addDaysTo(today, -6), addDaysTo(today, 1)), previous = regulationPeriod(inst, addDaysTo(today, -13), addDaysTo(today, -6));
  const desc = p => `${p.known} journée(s) renseignée(s), ${p.unknown} inconnue(s)${p.mean == null ? "" : ` ; moyenne sur les jours renseignés : ${number(p.mean)} ${subject(inst).unit}`}`;
  return `<section><h3>Mes sept derniers jours</h3><p>${desc(current)}.</p><p class="hint">Sept jours précédents : ${desc(previous)}. Les périodes commencent au premier objectif ; les jours inconnus ne valent jamais zéro. Des jours renseignés différents limitent la comparaison.</p>
    <p>${current.met} objectif(s) atteint(s) sur ${current.assessed} journée(s) évaluables. Le mode observation n'est pas noté.</p>
    <ul class="plain">${[...current.days].reverse().map(d => `<li>${fmt(d.date)} · ${d.complete ? `${number(d.total)} ${subject(inst).unit} · ${d.met === null ? "observé" : d.met ? "objectif atteint" : "au-delà de l'objectif"}` : d.reopened ? "à reconfirmer après modification" : "inconnue"}</li>`).join("")}</ul></section>`;
}
function eventLabel(inst, e) {
  if (e.kind === "use") return `${number(e.value)} ${subject(inst).unit}`;
  if (e.kind === "action") return `Action réalisée : ${e.strategy}`;
  if (e.kind === "day") return regulationDay(inst, e.date).complete ? "Journée confirmée" : "Journée à reconfirmer";
  return `Envie${e.intensity !== null ? ` · ${e.intensity}/10` : ""}${e.strategy ? ` · ${e.strategy}` : ""}${e.outcome ? ` · ${e.outcome}` : ""}`;
}
registerType("regulation", {
  sensitive: true,
  view(id) {
    const inst = S().modules[id], g = regulationGoal(inst, todayISO()), m = esc(id), d = regulationDay(inst, todayISO());
    const pause = [...inst.entries].filter(e => e.kind === "urge" && e.pauseEnd).sort((a, b) => b.pauseEnd - a.pauseEnd)[0];
    if (pause) { clearTimeout(pauseTick); pauseTick = setTimeout(tickPause, 0); }
    return `<div data-mod="${m}"><h2>${esc(label(id))}</h2><p class="hint">Suivi personnel autodéclaratif, sans diagnostic ni programme de sevrage. Les détails restent dans cet espace ; son nom reste visible dans la navigation.</p>${safety(inst)}
      <section><h3>${subject(inst).label} · ${goalLabel(inst, g)}</h3><p class="hint">${unitHint(inst)}</p><button class="btn sm" data-act="reg-goal">${inst.goals.length ? "Faire évoluer mon objectif" : "Définir mon suivi"}</button>
      ${inst.goals.length ? `<p>Aujourd'hui : ${number(d.total)} ${subject(inst).unit} notés · ${d.complete ? "journée confirmée" : "total provisoire"}.</p><div class="row"><button class="btn acc" data-act="reg-urge">J'ai une envie</button><button class="btn" data-act="reg-use">Noter une consommation / durée</button><button class="btn" data-act="reg-action">J'ai réalisé une action</button><button class="btn" data-act="reg-day">Faire mon point du jour</button></div>` : ""}</section>
      ${pause ? `<section><h3>Un temps de pause</h3><p id="regPauseClock" data-end="${pause.pauseEnd}" role="timer">${regulationRemaining(pause.pauseEnd, Date.now())} s</p><p class="hint">La pause est facultative, peut être interrompue et ne rapporte pas de marque automatique. Elle continue si tu fermes l'app.</p><button class="btn sm" data-act="reg-pause-stop" data-id="${esc(pause.id)}">Fermer la pause</button></section>` : ""}
      ${inst.goals.length ? periodHTML(inst) : ""}${progressHTML(inst)}
      <section><h3>Ce qui peut m'aider</h3><ul class="plain">${strategies(inst).map(s => `<li>${esc(s)}</li>`).join("")}</ul><button class="btn sm" data-act="reg-settings">Personnaliser mes appuis et récompenses</button></section>
      <section><h3>Journal</h3><ul class="plain">${(pg => pg.items.map(e => `<li class="item" data-id="${esc(e.id)}"><span class="jdate">${fmt(e.date)}</span><div>${esc(eventLabel(inst, e))}${e.note ? `<p>${esc(e.note)}</p>` : ""}<div class="row">${e.kind !== "day" ? `<button class="btn ghost sm" data-act="reg-edit">modifier</button>` : ""}${e.kind === "urge" ? `<button class="btn ghost sm" data-act="reg-pause">Pause de 5 min</button>` : ""}<button class="btn ghost sm" data-act="reg-del">supprimer</button></div></div></li>`).join("") + pg.more)(paged(`regulation:${id}`, [...inst.entries].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at))) || `<li class="empty">Rien de renseigné.</li>`}</ul></section>
      <details><summary>Historique des objectifs</summary><ul class="plain">${[...inst.goals].sort((a, b) => b.at - a.at).map(goal => `<li>${fmt(goal.date)} · ${goalLabel(inst, goal)}</li>`).join("")}</ul></details>
      <p class="hint">Cet espace suit le stockage et la synchronisation de ton compte. Non partagé avec l'assistant à sa création ; tu peux partager un résumé dans Réglages. Les sauvegardes complètes contiennent aussi ce suivi.</p>
      <div class="row"><button class="btn sm" data-act="reg-export">Exporter ce suivi</button><button class="btn ghost sm" data-act="mod-del" data-mod="${m}">Supprimer ce suivi</button></div></div>`;
  },
  settings: id => `<p class="hint">Détails exclus de l'accueil, du bilan global, des recherches, des motifs et du test lunaire. Le nom de l'espace reste visible. Les sauvegardes et la synchronisation incluent ces données.</p><button class="btn sm" data-act="reg-settings" data-mod="${esc(id)}">Appuis et récompenses</button>`,
  summary: () => "Suivi personnel — ouvrir pour consulter",
  context: (inst, name) => {
    const p = regulationPeriod(inst, addDaysTo(todayISO(), -6), addDaysTo(todayISO(), 1));
    return `\n${name} : suivi autodéclaratif de ${subject(inst).label}. ${p.known} jours renseignés, ${p.unknown} inconnus ; ${p.met}/${p.assessed} objectifs atteints. Sans notes ni déclencheurs. Ne pas proposer de protocole de sevrage.`;
  },
  recent: () => [],
  review: () => null,
  // Pas de hook texts : même une recherche explicite ne verse pas ces notes dans le corpus partagé.
  click: {
    "reg-goal": el => goalForm(moduleId(el)),
    "reg-use": el => eventForm(moduleId(el), "use"),
    "reg-urge": el => eventForm(moduleId(el), "urge"),
    "reg-action": el => eventForm(moduleId(el), "action"),
    "reg-day": el => dayForm(moduleId(el)),
    "reg-edit": el => { const id = moduleId(el), e = S().modules[id].entries.find(x => x.id === entryId(el)); if (e) eventForm(id, e.kind, e.id); },
    "reg-del": el => removeWithUndo(moduleId(el), "entries", entryId(el)),
    "reg-pause": el => { const e = S().modules[moduleId(el)].entries.find(x => x.id === entryId(el)); if (e) { e.pauseEnd = Date.now() + 300000; save(); } },
    "reg-pause-stop": el => { const e = S().modules[moduleId(el)].entries.find(x => x.id === el.dataset.id); if (e) { e.pauseEnd = null; save(); } },
    "reg-settings": el => {
      const id = moduleId(el), c = S().modules[id].config;
      openForm("Mes appuis et mes récompenses", [
        { n: "strategies", l: "Mes appuis (une action par ligne)", t: "textarea" },
        { n: "rewards", l: "Planche de progression (facultative)", t: "select", o: [["off", "Masquée"], ["on", "Afficher les marques des actions réalisées"]] },
        { n: "reward", l: "Récompense personnelle facultative, gratuite ou dans mon budget" },
        { n: "rewardAt", l: "À combien de marques ? (1 à 365)", t: "number", min: 1, max: 365, req: true }
      ], { ...c, rewards: c.rewards ? "on" : "off" }, v => {
        const inst = S().modules[id]; if (!inst) return;
        const target = Number(v.rewardAt); if (!Number.isInteger(target) || target < 1 || target > 365) throw new Error("Choisis de 1 à 365 marques.");
        Object.assign(inst.config, { strategies: v.strategies.slice(0, 2000), rewards: v.rewards === "on", reward: v.reward.slice(0, 200), rewardAt: target }); save();
      });
    },
    "reg-export": async el => {
      const inst = S().modules[moduleId(el)];
      if (await ask("Exporter les données sensibles de ce suivi dans un fichier lisible ?")) await downloadFile(`selene-suivi-${todayISO()}.json`, JSON.stringify({ format: "selene-regulation-v1", exportedAt: new Date().toISOString(), module: inst }, null, 2), "application/json", "Suivi personnel");
    }
  }
});
