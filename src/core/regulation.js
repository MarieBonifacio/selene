/* Type « regulation » (« Reprendre la main ») : un suivi personnel autodéclaratif du tabac, du cannabis, de l'alcool ou
   des réseaux sociaux. Aucun diagnostic, aucun protocole, aucune dose « sans risque » : des quantités déclarées, des
   journées confirmées à la main, des objectifs datés que la personne choisit.
   Pur : ni DOM, ni stockage, ni horloge implicite (`today`, la date locale, et `now`, l'instant, sont toujours passés).
   Règle fondamentale : l'absence de données n'est pas une consommation nulle. Une journée ne devient complète (et zéro,
   une donnée) que par une confirmation explicite, qui garde l'instantané exact des quantités vues à ce moment-là. */
import { coreError, requireText, validDate } from "./domain.js";

/* Les sujets et leur unité. `scale` : l'inverse du pas de saisie (cannabis au centième de gramme, alcool au dixième de
   verre) ; `max` : borne d'une saisie, et d'une journée quand `dayMax` est donné (une journée a 1440 minutes). Les noms
   français servent au résumé envoyé à l'assistant (sa consigne reste en français, docs/i18n.md) ; l'interface a les
   siens, traduits (src/app/modules/regulation.js). */
export const REGULATION_SUBJECTS = {
  tabac: { fr: "tabac", unit: "cigarettes", scale: 1, max: 200 },
  cannabis: { fr: "cannabis", unit: "grammes de produit", scale: 100, max: 100 },
  alcool: { fr: "alcool", unit: "verres standard (10 g d'alcool pur)", scale: 10, max: 100 },
  reseaux: { fr: "réseaux sociaux", unit: "minutes déclarées", scale: 1, max: 1440, dayMax: 1440 }
};
export const REGULATION_MODES = ["observer", "reduire", "arreter"];
export const REGULATION_STORAGES = ["account", "device"];
/* La version du texte d'accord à la synchronisation (modules/regulation.js) : un texte changé la redemande. */
export const REGULATION_CONSENT_VERSION = 1;
export const REGULATION_OUTCOMES = ["utile", "neutre", "difficile"];
/* Jalons fixes, annoncés d'avance : jamais tirés au sort, jamais retirés. */
export const REGULATION_MILESTONES = [1, 3, 7, 14, 30];
export const REGULATION_PAUSE_MS = 5 * 60000;
/* Une pause échue reste affichée un moment (« terminée »), puis disparaît d'elle-même : pas d'écran qui accuse. */
export const REGULATION_PAUSE_LINGER_MS = 10 * 60000;
const DAY_ID = date => `day-${date}`;
const MAX_TEXT = 2000;

export const regulationDefaults = () => ({
  config: { subject: null, supports: ["Marcher quelques minutes", "Dessiner", "Éloigner un déclencheur", "Contacter quelqu'un"], rewards: false, reward: "", rewardAt: 7 },
  goals: [], entries: []
});
/* Le talon synchronisé d'un suivi gardé sur un appareil : son nom et sa présence, et où il vit. Rien de ce qu'il
   contient : ni sujet, ni appuis, ni récompense, ni objectifs, ni journal, ni pont de reprise. */
export function regulationStub(inst, holder) {
  const d = regulationDefaults();
  return { type: inst.type, label: inst.label, config: { ...d.config, storage: "device", holder }, goals: [], entries: [] };
}
export const regulationOnDevice = inst => !!inst && !!inst.config && inst.config.storage === "device";
/* Les champs ajoutés depuis la création d'un suivi, complétés à l'entrée des données (store, import). */
export function normalizeRegulation(inst) {
  const def = regulationDefaults();
  inst.config = { ...def.config, ...(inst.config && typeof inst.config === "object" ? inst.config : {}) };
  if (!Array.isArray(inst.config.supports)) inst.config.supports = def.config.supports.slice();
  if (!Array.isArray(inst.goals)) inst.goals = [];
  if (!Array.isArray(inst.entries)) inst.entries = [];
}

/* ---- quantités et dates ---- */
const identifier = s => typeof s === "string" && /^[\w-]{1,64}$/.test(s);
const shortText = (s, max) => typeof s === "string" && s.length <= max;
const finite = (n, min, max) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
/* Un nombre saisi : « 2 », « 0,5 » ou « 0.5 ». Ni exposant, ni signe, ni « Infinity » : NaN, refusé ensuite. */
export function parseQuantity(raw) {
  if (typeof raw === "number") return raw;
  const s = String(raw ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
/* Une quantité dans l'unité du sujet : finie, au pas de l'unité (un entier de cigarettes, des centièmes de gramme),
   bornée. `zero` : le total d'une journée peut valoir zéro, pas une consommation. Arrondie au pas, sans flottant
   résiduel (0,1 + 0,2 vaut 0,3, pas 0,30000000000000004). */
export function regulationQuantity(subject, raw, { zero = false, max } = {}) {
  const s = REGULATION_SUBJECTS[subject]; if (!s) throw coreError("reg-setup", "Suivi pas encore configuré");
  const n = parseQuantity(raw), steps = Math.round(n * s.scale);
  if (!Number.isFinite(n) || Math.abs(n * s.scale - steps) > 1e-6 || steps < (zero ? 0 : 1) || n > (max ?? s.max))
    throw coreError("reg-quantity", "Quantité invalide pour cette unité", { subject });
  return steps / s.scale;
}
const sumOf = (subject, values) => { const k = REGULATION_SUBJECTS[subject]?.scale || 10000; return values.reduce((a, v) => a + Math.round(v * k), 0) / k; };
/* Une date déclarée : valide, et pas à venir (on ne déclare pas une consommation de demain). */
function pastDate(date, today) {
  if (!validDate(date) || !validDate(today) || date > today) throw coreError("reg-date", "Date invalide ou à venir");
  return date;
}
export const nextDay = d => new Date(Date.parse(d + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);

/* ---- validation d'une sauvegarde : la forme seulement ----
   Rien ici qu'une fusion légitime entre deux appareils puisse violer (sinon la sauvegarde de cet état ne se
   restaurerait plus) : le pas de l'unité, la date à venir ou le plafond quotidien sont vérifiés à la saisie. */
export function validateRegulation(inst, v) {
  const c = inst.config;
  if ((c.subject !== null && !Object.hasOwn(REGULATION_SUBJECTS, c.subject)) || !Array.isArray(c.supports) || c.supports.length > 30 ||
      c.supports.some(x => !shortText(x, 120)) || typeof c.rewards !== "boolean" || !shortText(c.reward, 200) ||
      !Number.isInteger(c.rewardAt) || c.rewardAt < 1 || c.rewardAt > 365) v.fail("réglages du suivi");
  // Où vit le suivi (ADR 27) : « account » (synchronisé, avec l'accord daté `consent`) ou « device » (sur l'appareil
  // `holder` seulement ; le document synchronisé n'en garde qu'un talon). Absent : un suivi d'avant ce choix.
  if ((c.storage != null && !REGULATION_STORAGES.includes(c.storage)) || (c.holder != null && !identifier(c.holder)) ||
      (c.consent != null && !(c.consent && typeof c.consent === "object" && finite(c.consent.at, 0, Infinity) && Number.isInteger(c.consent.version) && c.consent.version >= 1)))
    v.fail("stockage du suivi");
  const goals = v.list(inst.goals, "objectifs");
  for (const g of goals) {
    if (!identifier(g.id) || !validDate(g.date) || !finite(g.at, 0, Infinity) || !REGULATION_MODES.includes(g.mode) ||
        (g.subject != null && !Object.hasOwn(REGULATION_SUBJECTS, g.subject))) v.fail("objectif");
    if (g.mode === "observer" ? g.limit !== null : g.mode === "arreter" ? g.limit !== 0 : !(finite(g.limit, 0, 100000) && g.limit > 0)) v.fail("objectif");
  }
  const seen = new Set();
  for (const e of [...goals, ...inst.entries]) { if (seen.has(e.id)) v.fail("identifiant dupliqué"); seen.add(e.id); }
  for (const e of inst.entries) {
    if (!identifier(e.id) || !validDate(e.date) || !finite(e.at, 0, Infinity) || !shortText(e.zone, 80) || !shortText(e.note, MAX_TEXT) ||
        (e.editedAt != null && !finite(e.editedAt, 0, Infinity))) v.fail("entrée de suivi");
    if (e.kind === "use") { if (!(finite(e.value, 0, 100000) && e.value > 0) || (e.declared != null && !finite(e.declared, 0, 100000))) v.fail("quantité"); }
    else if (e.kind === "urge") {
      if ((e.intensity !== null && !(Number.isInteger(e.intensity) && e.intensity >= 0 && e.intensity <= 10)) || !shortText(e.strategy, 200) ||
          !["", ...REGULATION_OUTCOMES].includes(e.outcome) || (e.pauseEnd !== null && !finite(e.pauseEnd, 0, Infinity))) v.fail("envie");
    } else if (e.kind === "action") { if (!shortText(e.strategy, 200) || !e.strategy.trim() || (e.urge != null && !identifier(e.urge))) v.fail("action"); }
    else if (e.kind === "day") {
      if (e.id !== DAY_ID(e.date) || !shortText(e.snapshot, 500000) || (e.goalId !== null && !goals.some(g => g.id === e.goalId))) v.fail("bilan quotidien");
    } else v.fail("type d'entrée");
  }
}

/* ---- objectifs versionnés ----
   Chaque changement ajoute une version (identifiant stable, date d'effet, instant de création) ; aucune n'est réécrite.
   L'objectif d'une date : la version dont la date d'effet est la plus récente sans la dépasser (à date égale, la
   dernière créée). Une journée confirmée garde, elle, la version qu'elle a enregistrée. */
const byEffect = (a, b) => b.date.localeCompare(a.date) || b.at - a.at || b.id.localeCompare(a.id);
export const regulationGoal = (inst, date) => inst.goals.filter(g => g.date <= date).sort(byEffect)[0] || null;
/* La prochaine version programmée (date d'effet à venir), s'il y en a une. */
export const regulationNextGoal = (inst, today) => inst.goals.filter(g => g.date > today).sort((a, b) => -byEffect(a, b))[0] || null;
/* Les versions, de la plus récente date d'effet à la plus ancienne. */
export const regulationGoalHistory = inst => [...inst.goals].sort(byEffect);
/* Deux appareils hors ligne qui commencent le même suivi avec deux sujets : la fusion n'en garde qu'un. On ne le
   réinterprète pas en silence : l'interface le signale. */
export const regulationSubjectConflict = inst => inst.goals.some(g => g.subject && g.subject !== inst.config.subject);

function goalLimit(subject, input) {
  if (!REGULATION_MODES.includes(input.mode)) throw coreError("reg-mode", "Intention inconnue");
  if (input.mode === "observer") return null;
  if (input.mode === "arreter") return 0;
  if (input.limit === "" || input.limit == null) throw coreError("reg-limit", "Limite quotidienne à choisir");
  try { return regulationQuantity(subject, input.limit); } catch { throw coreError("reg-limit", "Limite quotidienne invalide"); }
}
/* Une date d'effet : passée, aujourd'hui, ou à venir dans l'année (« je commence lundi »). */
function effectDate(date, today) {
  if (!validDate(date) || !validDate(today) || date > addDays(today, 366)) throw coreError("reg-date", "Date invalide ou à venir");
  return date;
}
/* Premier réglage : le sujet (donc l'unité) et la première version d'objectif, ensemble. Le sujet ne change plus
   ensuite : ce serait relire l'historique dans une autre unité. Un autre sujet, c'est un autre suivi. */
export function setupRegulation(inst, input, goalId, today, now) {
  if (inst.config.subject !== null || inst.goals.length || inst.entries.length) throw coreError("reg-subject-locked", "Le sujet d'un suivi commencé ne change pas : crée un autre suivi");
  if (!Object.hasOwn(REGULATION_SUBJECTS, input.subject)) throw coreError("reg-subject", "Sujet inconnu");
  const date = effectDate(input.date, today), limit = goalLimit(input.subject, input);
  if (!identifier(goalId)) throw coreError("reg-entry", "Saisie invalide");
  inst.config.subject = input.subject;
  const g = { id: goalId, date, at: now, mode: input.mode, limit, subject: input.subject };
  inst.goals.push(g);
  return g;
}
export function addRegulationGoal(inst, input, id, today, now) {
  const subject = inst.config.subject;
  if (!subject) throw coreError("reg-setup", "Suivi pas encore configuré");
  if (input.subject != null && input.subject !== subject) throw coreError("reg-subject-locked", "Le sujet d'un suivi commencé ne change pas : crée un autre suivi");
  if (!identifier(id) || inst.goals.some(g => g.id === id)) throw coreError("reg-entry", "Saisie invalide");
  const date = effectDate(input.date, today), limit = goalLimit(subject, input);
  const g = { id, date, at: now, mode: input.mode, limit, subject };
  inst.goals.push(g);
  return g;
}

/* ---- journal : consommations, envies, actions ----
   Créer ou corriger : l'identifiant et l'instant de la première saisie restent (`at`), une correction est datée à part
   (`editedAt`). Le type d'une entrée ne change pas. */
const minutesCap = (inst, date, value, exceptId) => {
  const s = REGULATION_SUBJECTS[inst.config.subject];
  if (!s.dayMax) return;
  const others = inst.entries.filter(e => e.kind === "use" && e.date === date && e.id !== exceptId).map(e => e.value);
  if (sumOf(inst.config.subject, [...others, value]) > s.dayMax) throw coreError("reg-day-max", "Plus de 1440 minutes dans une journée");
};
export function saveRegulationEvent(inst, input, id, today, now, zone = "") {
  const subject = inst.config.subject;
  if (!subject) throw coreError("reg-setup", "Suivi pas encore configuré");
  if (!identifier(id) || !["use", "urge", "action"].includes(input.kind)) throw coreError("reg-entry", "Saisie invalide");
  const old = inst.entries.find(e => e.id === id) || null;
  if (old && old.kind !== input.kind) throw coreError("reg-entry", "Saisie invalide");
  const date = pastDate(input.date, today);
  const e = { id, kind: input.kind, date, at: old ? old.at : now, zone: old ? old.zone : String(zone || "").slice(0, 80), note: String(input.note ?? "").trim().slice(0, MAX_TEXT) };
  if (old) e.editedAt = now;
  if (e.kind === "use") {
    e.value = regulationQuantity(subject, input.value);
    minutesCap(inst, date, e.value, id);
    if (old && old.declared != null && old.value === e.value && old.date === date) e.declared = old.declared; // un complément de total, inchangé
  } else if (e.kind === "urge") {
    const raw = input.intensity, n = raw === "" || raw == null ? null : Number(raw);
    if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= 10)) throw coreError("reg-intensity", "Intensité de 0 à 10");
    if (input.outcome && !REGULATION_OUTCOMES.includes(input.outcome)) throw coreError("reg-entry", "Saisie invalide");
    Object.assign(e, { intensity: n, strategy: String(input.strategy ?? "").trim().slice(0, 120), outcome: input.outcome || "", pauseEnd: old ? old.pauseEnd : null });
  } else {
    e.strategy = requireText(input.strategy, "Action réalisée", 120);
    if (old && old.urge) e.urge = old.urge;
  }
  inst.entries = [...inst.entries.filter(x => x.id !== id), e];
  return e;
}
/* « Je l'ai fait » depuis une envie : déclarer réalisée la stratégie qu'elle avait choisie. Identifiant déduit de
   l'envie : un double appui, ou le même geste sur deux appareils, ne crée qu'une action. */
export const urgeActionId = urgeId => `act-${urgeId}`.slice(0, 64);
export function markUrgeDone(inst, urgeId, today, now, zone = "") {
  const u = inst.entries.find(e => e.id === urgeId && e.kind === "urge");
  if (!u) throw coreError("reg-missing", "Entrée introuvable");
  const id = urgeActionId(urgeId), old = inst.entries.find(e => e.id === id);
  if (old) return old;
  const e = saveRegulationEvent(inst, { kind: "action", date: u.date > today ? today : u.date, strategy: u.strategy, note: "" }, id, today, now, zone);
  e.urge = urgeId;
  return e;
}
/* Le total d'une journée, déclaré d'un coup. Jamais additionné à ses propres saisies : seule la différence avec ce qui
   est déjà noté s'ajoute (un complément, qui garde le total déclaré). Un total plus bas que les saisies est refusé :
   c'est elles qu'il faut corriger, la personne voit lesquelles. Renvoie le complément, ou null s'il n'y a rien à ajouter. */
export function saveRegulationTotal(inst, input, id, today, now, zone = "") {
  const subject = inst.config.subject;
  if (!subject) throw coreError("reg-setup", "Suivi pas encore configuré");
  const date = pastDate(input.date, today), total = regulationQuantity(subject, input.total, { zero: true, max: REGULATION_SUBJECTS[subject].dayMax || 100000 });
  const existing = regulationDay(inst, date).total;
  if (total < existing) throw coreError("reg-total-below", "Total déclaré inférieur aux quantités déjà notées", { total, existing, subject });
  if (total === existing) return null;
  const e = saveRegulationEvent(inst, { kind: "use", date, value: sumOf(subject, [total, -existing]), note: input.note }, id, today, now, zone);
  e.declared = total;
  return e;
}

/* ---- pause de cinq minutes ----
   Une échéance absolue, enregistrée dans l'envie : le temps restant se recalcule à chaque retour (rechargement,
   téléphone en veille, autre appareil). Elle s'interrompt sans commentaire et ne rapporte rien en s'achevant. */
export function startRegulationPause(inst, urgeId, now) {
  const u = inst.entries.find(e => e.id === urgeId && e.kind === "urge");
  if (!u) throw coreError("reg-missing", "Entrée introuvable");
  u.pauseEnd = now + REGULATION_PAUSE_MS;
  return u;
}
export function stopRegulationPause(inst, urgeId) {
  const u = inst.entries.find(e => e.id === urgeId && e.kind === "urge");
  if (u) u.pauseEnd = null;
  return u || null;
}
/* La pause à montrer : la plus récente, en cours ou échue depuis peu. */
export function regulationPause(inst, now) {
  const u = inst.entries.filter(e => e.kind === "urge" && e.pauseEnd && now < e.pauseEnd + REGULATION_PAUSE_LINGER_MS).sort((a, b) => b.pauseEnd - a.pauseEnd)[0];
  return u ? { urge: u, end: u.pauseEnd, left: regulationRemaining(u.pauseEnd, now) } : null;
}
export const regulationRemaining = (end, now) => Math.max(0, Math.ceil((end - now) / 1000));

/* ---- journées ---- */
/* Instantané exact des consommations d'une date : identifiants et quantités, triés. L'ordre des listes après une fusion
   n'y change rien ; un ajout, une correction de quantité, une suppression ou un déplacement de date, d'où qu'ils
   viennent, le changent, donc rouvrent la journée. Une note retouchée, non. */
export const regulationSnapshot = (inst, date) => JSON.stringify(inst.entries.filter(e => e.kind === "use" && e.date === date).map(e => [e.id, e.value]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
/* Confirmer qu'une journée est entièrement renseignée. `seen` : l'instantané que la personne avait sous les yeux en
   confirmant. S'il a changé entre-temps (une synchronisation pendant la boîte de confirmation), rien n'est validé.
   Une journée déjà confirmée puis rouverte garde son objectif : corriger une quantité ne change pas la cible du jour. */
export function closeRegulationDay(inst, date, seen, today, now, zone = "") {
  pastDate(date, today);
  const snapshot = regulationSnapshot(inst, date);
  if (seen !== snapshot) throw coreError("reg-day-changed", "Les consommations de cette journée ont changé : vérifie le total puis confirme à nouveau");
  const old = inst.entries.find(e => e.id === DAY_ID(date)), kept = old && inst.goals.find(g => g.id === old.goalId);
  const goal = kept || regulationGoal(inst, date);
  const e = { id: DAY_ID(date), kind: "day", date, at: now, zone: String(zone || "").slice(0, 80), note: "", goalId: goal ? goal.id : null, snapshot };
  inst.entries = [...inst.entries.filter(x => x.id !== e.id), e];
  return e;
}
/* L'état d'une date : quantités déclarées, complète ou non, rouverte (confirmée puis modifiée), objectif utilisé,
   verdict. `met` : null sans verdict (journée incomplète, observation, aucun objectif à cette date). */
export function regulationDay(inst, date) {
  const subject = inst.config.subject, uses = inst.entries.filter(e => e.kind === "use" && e.date === date);
  const check = inst.entries.find(e => e.id === DAY_ID(date) && e.kind === "day");
  const total = sumOf(subject, uses.map(e => e.value));
  const complete = !!check && check.snapshot === regulationSnapshot(inst, date);
  const goal = (check && inst.goals.find(g => g.id === check.goalId)) || regulationGoal(inst, date);
  const met = complete && goal && goal.mode !== "observer" ? total <= goal.limit : null;
  return { date, total, count: uses.length, uses, complete, reopened: !!check && !complete, goal, met };
}
/* Le début du suivi : la première date connue (objectif ou saisie). Rien d'antérieur ne compte, ni comme inconnu, ni
   comme échec. */
export function regulationStart(inst) {
  const dates = [...inst.goals.map(g => g.date), ...inst.entries.map(e => e.date)].sort();
  return dates[0] || null;
}
/* Une période [from, to[ : chaque date suivie, les journées complètes (seules à compter pour une moyenne ou un
   verdict), les autres (inconnues ou à reconfirmer), les quantités déclarées (toutes journées : un total partiel
   reste partiel), les objectifs atteints parmi les journées évaluables et les versions d'objectif entrées en vigueur. */
export function regulationPeriod(inst, from, to) {
  const start = regulationStart(inst), days = [];
  const empty = { from, to, days, span: 0, complete: 0, incomplete: 0, declared: 0, completeTotal: 0, mean: null, assessed: 0, met: 0, goalChanges: [] };
  if (!start || !validDate(from) || !validDate(to)) return empty;
  for (let d = from < start ? start : from; d < to && days.length < 366; d = nextDay(d)) days.push(regulationDay(inst, d));
  const subject = inst.config.subject, known = days.filter(d => d.complete), assessed = known.filter(d => d.met !== null);
  const completeTotal = sumOf(subject, known.map(d => d.total));
  return { ...empty, days, span: days.length, complete: known.length, incomplete: days.length - known.length,
    declared: sumOf(subject, days.map(d => d.total)), completeTotal, mean: known.length ? Math.round(completeTotal / known.length * 100) / 100 : null,
    assessed: assessed.length, met: assessed.filter(d => d.met).length,
    goalChanges: inst.goals.filter(g => g.date >= from && g.date < to).sort((a, b) => -byEffect(a, b)) };
}
/* Deux périodes ne se comparent que si chacune a assez de journées complètes et une couverture voisine : sinon la
   différence des moyennes dirait surtout la différence de ce qui a été noté. */
export const REGULATION_COMPARE_MIN = 4, REGULATION_COMPARE_GAP = 2;
export function regulationComparable(a, b) {
  if (a.complete < REGULATION_COMPARE_MIN || b.complete < REGULATION_COMPARE_MIN) return { ok: false, reason: "few" };
  if (Math.abs(a.complete - b.complete) > REGULATION_COMPARE_GAP) return { ok: false, reason: "uneven" };
  return { ok: true, reason: "" };
}
/* Les retours sur les appuis, décrits sans plus : combien de fois choisi lors d'une envie, réalisé, et ce qu'en a dit la
   personne. Aucune efficacité n'en est tirée : quelques associations ne font pas une cause. */
export function regulationSupports(inst, from, to) {
  const out = new Map(), row = s => { if (!out.has(s)) out.set(s, { strategy: s, chosen: 0, done: 0, utile: 0, neutre: 0, difficile: 0 }); return out.get(s); };
  for (const e of inst.entries) {
    if (e.date < from || e.date >= to) continue;
    if (e.kind === "urge" && e.strategy) { const r = row(e.strategy); r.chosen++; if (e.outcome) r[e.outcome]++; }
    else if (e.kind === "action") row(e.strategy).done++;
  }
  return [...out.values()].sort((a, b) => b.chosen + b.done - (a.chosen + a.done) || (a.strategy < b.strategy ? -1 : 1));
}

/* ---- marques ----
   Une marque par date locale où au moins une action du plan a été déclarée réalisée, dans ce suivi seulement. Dérivées
   des actions (identifiants stables, fusionnables) : jamais un solde incrémenté, donc pas de double gain entre deux
   appareils ou deux clics, pas de perte après un écart, et une correction (supprimer une action erronée) corrige le
   compte. Ni envie, ni consommation, ni ouverture, ni pause achevée n'en donnent. */
export const regulationMarkDates = inst => [...new Set(inst.entries.filter(e => e.kind === "action").map(e => e.date))].sort();
export const regulationMarks = inst => regulationMarkDates(inst).length;
export function regulationProgress(inst) {
  const marks = regulationMarks(inst), c = inst.config;
  return { marks, milestones: REGULATION_MILESTONES.map(n => ({ n, reached: marks >= n })), next: REGULATION_MILESTONES.find(n => n > marks) ?? null,
    reward: c.reward ? { text: c.reward, at: c.rewardAt, reached: marks >= c.rewardAt, left: Math.max(0, c.rewardAt - marks) } : null };
}
/* Appuis et récompenses : la liste des appuis (une action par ligne, vingt au plus), l'affichage des marques, la
   récompense personnelle et son seuil. */
export function setRegulationPlan(inst, input) {
  const supports = [...new Set(String(input.supports ?? "").split("\n").map(s => s.trim().slice(0, 120)).filter(Boolean))].slice(0, 20);
  const at = Number(input.rewardAt);
  if (!Number.isInteger(at) || at < 1 || at > 365) throw coreError("reg-reward", "Seuil de récompense : 1 à 365 marques");
  Object.assign(inst.config, { supports, rewards: !!input.rewards, reward: String(input.reward ?? "").trim().slice(0, 200), rewardAt: at });
  return inst.config;
}
