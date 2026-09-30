/* Suivi autodéclaratif : aucune prescription, aucun accès au DOM, aucune horloge implicite.
   Les quantités ne deviennent un jour complet qu'après confirmation explicite. */
import { validDate } from "./domain.js";

export const REGULATION_SUBJECTS = {
  tabac: { label: "Tabac", unit: "cigarettes", step: 1 },
  cannabis: { label: "Cannabis", unit: "g", step: 0.01 },
  alcool: { label: "Alcool", unit: "verres standard", step: 0.1 },
  reseaux: { label: "Réseaux sociaux", unit: "min", step: 1 }
};
export const REGULATION_MODES = { observer: "Observer", reduire: "Réduire", arreter: "Viser l'arrêt" };
export const REGULATION_MILESTONES = [1, 3, 7, 14, 30];
export const regulationDefaults = () => ({ config: { subject: "tabac", strategies: "Marcher quelques minutes\nÉloigner un déclencheur\nContacter quelqu'un", rewards: false, reward: "", rewardAt: 7 }, entries: [], goals: [] });
const text = (s, max = 2000) => typeof s === "string" && s.length <= max;
const identifier = s => typeof s === "string" && /^[\w-]{1,64}$/.test(s);
const amount = n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100000;
const dateCheck = (date, today) => {
  if (!validDate(date) || !validDate(today) || date > today) throw new Error("Choisis une date valide, aujourd'hui ou dans le passé.");
};
export function validateRegulation(inst, v) {
  const c = inst.config;
  if (!Object.hasOwn(REGULATION_SUBJECTS, c.subject) || !text(c.strategies) || typeof c.rewards !== "boolean" || !text(c.reward, 200) || !Number.isInteger(c.rewardAt) || c.rewardAt < 1 || c.rewardAt > 365) v.fail("réglages du suivi");
  const goals = v.list(inst.goals, "objectifs");
  for (const g of goals) if (!identifier(g.id) || !validDate(g.date) || !Number.isFinite(g.at) || g.at < 0 || !Object.hasOwn(REGULATION_MODES, g.mode) || !amount(g.limit) || (g.mode === "arreter" && g.limit !== 0)) v.fail("objectif");
  if (new Set(goals.map(g => g.id)).size !== goals.length || new Set(inst.entries.map(e => e.id)).size !== inst.entries.length) v.fail("identifiant dupliqué");
  for (const e of inst.entries) {
    if (!identifier(e.id) || !validDate(e.date) || !Number.isFinite(e.at) || e.at < 0 || !text(e.zone, 80) || !text(e.note)) v.fail("entrée de suivi");
    if (e.kind === "use") { if (!amount(e.value) || e.value === 0 || (REGULATION_SUBJECTS[c.subject].step === 1 && !Number.isInteger(e.value))) v.fail("quantité"); }
    else if (e.kind === "urge") {
      if (e.intensity !== null && (!Number.isInteger(e.intensity) || e.intensity < 0 || e.intensity > 10)) v.fail("intensité");
      if (!text(e.strategy, 200) || !["", "utile", "neutre", "difficile"].includes(e.outcome) || (e.pauseEnd != null && (!Number.isFinite(e.pauseEnd) || e.pauseEnd < 0))) v.fail("envie");
    } else if (e.kind === "action") { if (!text(e.strategy, 200) || !e.strategy.trim()) v.fail("action"); }
    else if (e.kind === "day") {
      if (e.id !== `day-${e.date}` || !text(e.snapshot, 500000) || !goals.some(g => g.id === e.goalId)) v.fail("bilan quotidien");
    } else v.fail("type d'entrée");
  }
}
export function regulationGoal(inst, date) {
  return [...inst.goals].filter(g => g.date <= date).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at || b.id.localeCompare(a.id))[0] || null;
}
export function addRegulationGoal(inst, input, id, today, now) {
  dateCheck(input.date, today);
  if (!identifier(id) || inst.goals.some(g => g.id === id) || !Object.hasOwn(REGULATION_MODES, input.mode)) throw new Error("Objectif invalide.");
  const limit = input.mode === "reduire" ? Number(input.limit) : 0;
  if (input.mode === "reduire" && (input.limit === "" || input.limit == null || !amount(limit) || limit === 0)) throw new Error("Indique une limite positive ; pour zéro, choisis l'arrêt.");
  if (REGULATION_SUBJECTS[inst.config.subject].step === 1 && !Number.isInteger(limit)) throw new Error("Indique un nombre entier dans cette unité.");
  const g = { id, date: input.date, at: now, mode: input.mode, limit };
  inst.goals.push(g); return g;
}
export function saveRegulationEvent(inst, input, id, today, now, zone = "") {
  dateCheck(input.date, today);
  if (!identifier(id) || !["use", "urge", "action"].includes(input.kind)) throw new Error("Entrée invalide.");
  const previous = inst.entries.find(e => e.id === id);
  const e = { id, date: input.date, at: now, zone, kind: input.kind, note: String(input.note || "").slice(0, 2000) };
  if (e.kind === "use") e.value = Number(input.value);
  if (e.kind === "urge") Object.assign(e, { intensity: input.intensity === "" || input.intensity == null ? null : Number(input.intensity), strategy: String(input.strategy || "").slice(0, 200), outcome: input.outcome || "", pauseEnd: previous?.pauseEnd ?? null });
  if (e.kind === "action") e.strategy = String(input.strategy || "").trim().slice(0, 200);
  const next = { ...inst, entries: [...inst.entries.filter(x => x.id !== id), e] };
  validateRegulation(next, { list: x => x, fail: what => { throw new Error(`Saisie invalide : ${what}.`); } });
  inst.entries = next.entries; return e;
}
/* Instantané exact des consommations, stable quelle que soit l'ordre des listes après fusion.
   Un ajout / une correction / une suppression sur un autre appareil rouvre le jour : pas de faux zéro. */
export const regulationSnapshot = (inst, date) => JSON.stringify(inst.entries.filter(e => e.kind === "use" && e.date === date).map(e => [e.id, e.value]).sort((a, b) => a[0].localeCompare(b[0])));
export function closeRegulationDay(inst, date, today, now, zone = "") {
  dateCheck(date, today);
  const old = inst.entries.find(e => e.id === `day-${date}`), goal = inst.goals.find(g => g.id === old?.goalId) || regulationGoal(inst, date);
  if (!goal) throw new Error("Définis d'abord un objectif couvrant cette date.");
  const e = { id: `day-${date}`, kind: "day", date, at: now, zone, note: "", goalId: goal.id, snapshot: regulationSnapshot(inst, date) };
  inst.entries = [...inst.entries.filter(x => x.id !== e.id), e]; return e;
}
export function regulationDay(inst, date) {
  const uses = inst.entries.filter(e => e.kind === "use" && e.date === date), check = inst.entries.find(e => e.id === `day-${date}`);
  const total = Math.round(uses.reduce((n, e) => n + e.value, 0) * 10000) / 10000;
  const goal = inst.goals.find(g => g.id === check?.goalId) || regulationGoal(inst, date);
  const complete = !!check && !!goal && check.snapshot === regulationSnapshot(inst, date);
  return { date, total, complete, goal, met: complete && goal.mode !== "observer" ? total <= goal.limit : null, reopened: !!check && !complete };
}
export function regulationPeriod(inst, from, to) {
  const first = [...inst.goals].map(g => g.date).sort()[0];
  const days = [];
  if (!first || !validDate(from) || !validDate(to)) return { days, known: 0, unknown: 0, met: 0, assessed: 0, total: 0, mean: null };
  const start = from < first ? first : from;
  // Périodes d'interface bornées ; éviter une boucle démesurée sur un import malformé.
  for (let d = start; d < to && days.length < 366; d = new Date(Date.parse(d + "T12:00:00Z") + 86400000).toISOString().slice(0, 10)) days.push(regulationDay(inst, d));
  const known = days.filter(d => d.complete), assessed = known.filter(d => d.met !== null), total = known.reduce((n, d) => n + d.total, 0);
  return { days, known: known.length, unknown: days.length - known.length, met: assessed.filter(d => d.met).length, assessed: assessed.length, total, mean: known.length ? total / known.length : null };
}
/* Une marque par date d'action, pas par clic, par envie ou par consommation. Dérivée des événements à id
   fusionnables : jamais de solde incrémenté, jamais de récompense aléatoire ou de remise à zéro après un écart. */
export const regulationMarks = inst => new Set(inst.entries.filter(e => e.kind === "action").map(e => e.date)).size;
export const regulationRemaining = (end, now) => Math.max(0, Math.ceil((end - now) / 1000));
