/* Type « regulation » : l'espace « Reprendre la main » (docs/regulation.md). Un suivi par sujet (tabac, cannabis,
   alcool, réseaux sociaux), dont les règles vivent dans core/regulation.js. Sensible : aucun texte versé à la
   recherche ni aux analyses transversales (pas de hook texts), rien sur l'accueil au-delà de son nom, pas de rappel ni
   de pastille, partage avec l'assistant désactivé à la création et confirmé sur le résumé exact. Les actions de ce
   type commencent par « rlm- » (Reprendre la main). */
import { REGULATION_COMPARE_MIN, REGULATION_SUBJECTS, addDays, addRegulationGoal, closeRegulationDay, markUrgeDone, regulationComparable,
  regulationDay, regulationGoal, regulationGoalHistory, regulationNextGoal, regulationPause, regulationPeriod, regulationProgress, regulationRemaining,
  regulationSnapshot, regulationStart, regulationSubjectConflict, regulationSupports, saveRegulationEvent, saveRegulationTotal, setRegulationPlan, setupRegulation,
  startRegulationPause, stopRegulationPause, urgeActionId } from "../../core/regulation.js";
import { registerType } from "../registry.js";
import { esc, paged, toast, toastAction, toastUndo } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { fmt, iso, todayISO, uid } from "../lib/format.js";
import { N_, tr, trn, uiLocale } from "../i18n/index.js";
import { errMsg, regNum } from "../lib/labels.js";
import { render } from "../shell/render.js";
import { S, enabled, label, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";

/* ---- sujets, unités, intentions : ce que l'interface en dit ---- */
const SUBJECTS = {
  tabac: { name: () => tr`Tabac`, unit: () => tr`cigarettes`, qty: n => trn(n, "{1} cigarette", "{1} cigarettes", regNum(n)), step: 1,
    about: () => tr`Le nombre de cigarettes fumées. Les substituts nicotiniques (patch, gomme, pastille, spray) ne se comptent pas ici : ce ne sont pas des cigarettes fumées.` },
  cannabis: { name: () => tr`Cannabis`, unit: () => tr`grammes de produit`, qty: n => tr`${regNum(n)} g`, step: 0.01,
    about: () => tr`Une estimation en grammes de produit (herbe, résine…), pas une dose de THC : la teneur varie beaucoup d'un produit à l'autre, ces grammes ne mesurent donc ni l'effet ni le risque.` },
  alcool: { name: () => tr`Alcool`, unit: () => tr`verres standard`, qty: n => trn(n, "{1} verre standard", "{1} verres standard", regNum(n)), step: 0.1,
    about: () => tr`Un verre standard contient 10 g d'alcool pur, soit environ 25 cl de bière à 5 %, 10 cl de vin à 12 % ou 3 cl d'alcool fort à 40 %. Un verre servi, surtout à la maison, est souvent plus grand : il peut valoir plusieurs verres standard.` },
  reseaux: { name: () => tr`Réseaux sociaux`, unit: () => tr`minutes`, qty: n => trn(n, "{1} minute", "{1} minutes", regNum(n)), step: 1,
    about: () => tr`Des minutes que tu saisis toi-même, par exemple d'après le temps d'écran de ton téléphone. Selene ne mesure pas ton usage des autres applications et ne les bloque pas.` }
};
const MODES = [["observer", N_("Observer, sans cible")], ["reduire", N_("Réduire, avec une limite quotidienne que je choisis")], ["arreter", N_("Viser l'arrêt")]];
const OUTCOMES = { utile: N_("utile pour moi"), neutre: N_("sans changement"), difficile: N_("difficile") };
const subjectOf = inst => SUBJECTS[inst.config.subject] || null;
const qty = (inst, n) => (subjectOf(inst) ? subjectOf(inst).qty(n) : regNum(n));
const goalText = (inst, g) => !g ? tr`aucun objectif à cette date` : g.mode === "observer" ? tr`observer, sans cible` : g.mode === "arreter" ? tr`viser l'arrêt` : tr`au plus ${qty(inst, g.limit)} par jour`;
const longDate = d => fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } };
const modOf = el => el.dataset.mod || el.closest("[data-mod]").dataset.mod;
const entryOf = el => el.closest("[data-id]")?.dataset.id;
const save = () => { site.save(); render(); };
/* L'information propre à l'alcool : avant tout objectif (dans le formulaire), et repliée dans l'espace ensuite, pas
   répétée à chaque saisie. Sources et date de vérification : docs/regulation.md. */
const alcoholRisk = () => tr`En cas de dépendance à l'alcool (envie très difficile à contrôler, tremblements ou sueurs au réveil, besoin de boire pour aller bien), un arrêt brutal ou une réduction rapide peuvent être dangereux : le sevrage peut provoquer des convulsions ou un delirium tremens. Prépare ce changement avec un médecin ou un CSAPA (centre de soins, d'accompagnement et de prévention en addictologie, gratuit, où l'on peut rester anonyme). Selene ne propose ni calendrier de sevrage, ni dose, ni conseil de traitement.`;
const alcoholUrgent = () => tr`Confusion, hallucinations, convulsions, fortes sueurs avec tremblements : appelle le 15 (Samu) ou le 112. Par SMS ou en visio, le 114 pour les personnes sourdes ou malentendantes.`;
const alcoholHelp = () => tr`Alcool Info Service : 0 980 980 930, de 8 h à 2 h, 7 jours sur 7, anonyme et non surtaxé.`;

/* ---- formulaires ---- */
function subjectForm(id) {
  openForm(tr`Ce que je veux suivre`, [{ n: "subject", l: tr`Sujet du suivi`, t: "select", o: Object.keys(SUBJECTS).map(k => [k, SUBJECTS[k].name()]) }], { subject: "tabac" },
    v => goalForm(id, v.subject),
    tr`Un suivi, un sujet, une unité : le tabac en cigarettes, le cannabis en grammes de produit, l'alcool en verres standard, les réseaux sociaux en minutes déclarées. Pour en suivre plusieurs, crée un suivi par sujet : leurs unités, objectifs et marques ne se mélangent pas. Le sujet ne change plus ensuite.`);
}
function goalForm(id, setupSubject = null) {
  const inst = S().modules[id], subject = setupSubject || inst.config.subject, sub = SUBJECTS[subject], today = todayISO(), cur = regulationGoal(inst, today);
  const about = [sub.about(), subject === "alcool" ? `${alcoholRisk()}\n${alcoholUrgent()}\n${alcoholHelp()}` : "",
    tr`La limite ne sert qu'à réduire. Observer n'attribue ni réussite ni échec ; viser l'arrêt vise zéro. Selene ne baisse jamais une limite d'elle-même et ne propose aucun rythme. Les journées déjà confirmées gardent leur objectif.`].filter(Boolean).join("\n\n");
  openForm(setupSubject ? tr`Mon intention` : tr`Faire évoluer mon objectif`, [
    { n: "mode", l: tr`Intention`, t: "select", o: MODES.map(([k, l]) => [k, tr(l)]) },
    { row: [{ n: "limit", l: tr`Limite quotidienne pour réduire (${sub.unit()})`, t: "number", step: sub.step, min: 0 }, { n: "date", l: tr`À partir du`, t: "date", req: true }] }
  ], { mode: cur ? cur.mode : "observer", limit: cur && cur.mode === "reduire" ? cur.limit : "", date: today }, v => {
    const latest = S().modules[id]; if (!latest) return;
    if (setupSubject) setupRegulation(latest, { ...v, subject: setupSubject }, uid(), todayISO(), Date.now());
    else addRegulationGoal(latest, v, uid(), todayISO(), Date.now());
    save();
    toast(v.date > todayISO() ? tr`Objectif enregistré, à partir du ${fmt(v.date)}. D'ici là, rien ne change.` : tr`Objectif enregistré. Les journées déjà confirmées gardent le leur.`);
  }, about);
}
/* Noter une consommation (ou une durée) : une de plus, ou le total de la journée. Le total n'est jamais additionné à
   ses propres saisies : seule la différence s'ajoute (core/regulation.js). */
function useForm(id, old = null) {
  const inst = S().modules[id], sub = subjectOf(inst), today = todayISO();
  const fields = old ? [] : [{ n: "how", l: tr`Je note`, t: "select", o: [["add", tr`Une consommation de plus, qui s'ajoute aux autres saisies du jour`], ["total", tr`Le total de la journée : seule la différence avec ce qui est déjà noté s'ajoute`]] }];
  fields.push({ row: [{ n: "date", l: tr`Date`, t: "date", req: true, max: today }, { n: "value", l: tr`Quantité (${sub.unit()})`, t: "number", step: sub.step, min: 0, req: true }] },
    { n: "note", l: tr`Contexte, facultatif`, t: "textarea", rows: 2 });
  openForm(old ? tr`Corriger une saisie` : tr`Noter une consommation ou une durée`, fields, old ? { date: old.date, value: old.value, note: old.note } : { how: "add", date: today, value: "", note: "" }, v => {
    const cur = S().modules[id]; if (!cur) return;
    if (old && !cur.entries.some(e => e.id === old.id)) return toast(errMsg({ code: "reg-missing" }));
    const before = new Set([v.date, old && old.date].filter(Boolean).filter(d => regulationDay(cur, d).complete));
    if (v.how === "total") {
      const e = saveRegulationTotal(cur, { date: v.date, total: v.value, note: v.note }, uid(), todayISO(), Date.now(), zone());
      save();
      toast(e ? tr`Complément noté : ${qty(cur, e.value)}, pour un total déclaré de ${qty(cur, e.declared)}.` : tr`Rien à ajouter : ce total est déjà noté pour ce jour-là.`);
      return confirmDay(id, v.date); // un total déclaré dit que la journée est connue : la confirmation est proposée, jamais supposée
    }
    saveRegulationEvent(cur, { kind: "use", date: v.date, value: v.value, note: v.note }, old ? old.id : uid(), todayISO(), Date.now(), zone());
    save();
    const reopened = [...before].find(d => !regulationDay(S().modules[id], d).complete);
    if (reopened) toastAction(tr`Noté. La journée du ${fmt(reopened)} était confirmée : elle est à reconfirmer.`, tr`Confirmer`, () => confirmDay(id, reopened), 9000);
    else toast(old ? tr`Corrigé.` : tr`Noté.`);
  }, old ? sub.about() : `${tr`« Une de plus » s'ajoute aux saisies du jour. « Total de la journée » : ce que tu as consommé ce jour-là en tout ; Selene n'ajoute que ce qui manque, et refuse un total plus bas que ce qui est déjà noté.`}\n\n${sub.about()}`);
}
function urgeForm(id, old = null) {
  const inst = S().modules[id], sup = inst.config.supports;
  const choices = [["", tr`Aucun pour l'instant`], ...sup.map(s => [s, s]), ...(old && old.strategy && !sup.includes(old.strategy) ? [[old.strategy, old.strategy]] : [])];
  openForm(old ? tr`Modifier une envie` : tr`J'ai une envie`, [
    { row: [{ n: "date", l: tr`Date`, t: "date", req: true, max: todayISO() }, { n: "intensity", l: tr`Intensité de 0 à 10, facultative`, t: "number", min: 0, max: 10 }] },
    { n: "note", l: tr`Contexte ou déclencheur, facultatif`, t: "textarea", rows: 2 },
    { n: "strategy", l: tr`Un appui que je peux essayer, facultatif`, t: "select", o: choices },
    { n: "outcome", l: tr`Après coup, cet appui a été…`, t: "select", o: [["", tr`pas encore évalué`], ...Object.entries(OUTCOMES).map(([k, l]) => [k, tr(l)])] },
    ...(old ? [] : [{ n: "pause", l: tr`Prendre une pause de cinq minutes maintenant ?`, t: "select", o: [["", tr`Non`], ["oui", tr`Oui, lancer la pause`]] }])
  ], old ? { date: old.date, intensity: old.intensity ?? "", note: old.note, strategy: old.strategy, outcome: old.outcome } : { date: todayISO(), intensity: "", note: "", strategy: "", outcome: "", pause: "" }, v => {
    const cur = S().modules[id]; if (!cur) return;
    if (old && !cur.entries.some(e => e.id === old.id)) return toast(errMsg({ code: "reg-missing" }));
    const e = saveRegulationEvent(cur, { kind: "urge", ...v }, old ? old.id : uid(), todayISO(), Date.now(), zone());
    if (v.pause === "oui") startRegulationPause(cur, e.id, Date.now());
    save(); toast(v.pause === "oui" ? tr`Envie notée. Cinq minutes, à ton rythme.` : tr`Envie notée. Ce n'est pas un écart.`);
  }, tr`Une envie n'est ni un écart ni un échec, et ne donne pas de marque. Choisir un appui ne veut pas dire l'avoir fait : tu pourras le déclarer réalisé ensuite (« Je l'ai fait »).`);
}
function actionForm(id, old = null) {
  const inst = S().modules[id];
  openForm(old ? tr`Modifier une action` : tr`J'ai réalisé une action`, [
    { n: "date", l: tr`Date`, t: "date", req: true, max: todayISO() },
    { n: "strategy", l: tr`L'action de mon plan que j'ai faite`, req: true, list: `rlmSup-${id}` },
    { n: "note", l: tr`Note, facultative`, t: "textarea", rows: 2 }
  ], old ? { date: old.date, strategy: old.strategy, note: old.note } : { date: todayISO(), strategy: inst.config.supports[0] || "", note: "" }, v => {
    const cur = S().modules[id]; if (!cur) return;
    if (old && !cur.entries.some(e => e.id === old.id)) return toast(errMsg({ code: "reg-missing" }));
    saveRegulationEvent(cur, { kind: "action", ...v }, old ? old.id : uid(), todayISO(), Date.now(), zone());
    save(); toast(tr`Action gardée. Un écart, plus tard, ne l'efface pas.`);
  }, inst.config.rewards ? tr`Une action concrète de ton plan, faite pour de vrai, même un jour où tu as consommé. Une marque au plus par journée, quel que soit le nombre d'actions.` : tr`Une action concrète de ton plan, faite pour de vrai, même un jour où tu as consommé.`);
}
function planForm(id) {
  const c = S().modules[id].config;
  openForm(tr`Mes appuis et mes récompenses`, [
    { n: "supports", l: tr`Mes appuis, une action par ligne`, t: "textarea", rows: 5 },
    { n: "rewards", l: tr`Marques et jalons`, t: "select", o: [["", tr`Masqués`], ["on", tr`Affichés dans cet espace`]] },
    { row: [{ n: "reward", l: tr`Ma récompense, facultative` }, { n: "rewardAt", l: tr`À combien de marques ? (1 à 365)`, t: "number", min: 1, max: 365, req: true }] }
  ], { supports: c.supports.join("\n"), rewards: c.rewards ? "on" : "", reward: c.reward, rewardAt: c.rewardAt }, v => {
    const cur = S().modules[id]; if (!cur) return;
    setRegulationPlan(cur, { ...v, rewards: v.rewards === "on" }); save(); toast(tr`Enregistré.`);
  }, tr`Des actions concrètes et à ta portée : marcher, dessiner, éloigner un déclencheur, appeler quelqu'un… Les marques sont facultatives : une par journée où tu déclares une action réalisée, jalons fixes à 1, 3, 7, 14 et 30. Aucune série à tenir, rien ne se perd après un écart. La récompense est la tienne, gratuite si tu veux.`);
}
/* Confirmer une journée : la date et le total exacts d'abord. L'instantané vu ici est celui que le noyau exige au
   moment de valider ; s'il a changé pendant la boîte (une synchronisation), rien n'est validé. */
export async function confirmDay(id, date) {
  const inst = S().modules[id]; if (!inst) return;
  const d = regulationDay(inst, date), seen = regulationSnapshot(inst, date);
  const lines = [tr`${longDate(date)} : ${qty(inst, d.total)} au total.`,
    d.count ? trn(d.count, "{0} saisie : {1}.", "{0} saisies : {1}.", d.uses.map(u => qty(inst, u.value)).join(" + ")) : tr`Aucune consommation notée ce jour-là : confirmer en fait une journée à zéro.`,
    tr`Confirmer, c'est dire que toutes les consommations de cette journée sont notées. Annuler la laisse inconnue, sans pénalité.`];
  if (!await ask(lines.join("\n"))) return;
  const cur = S().modules[id]; if (!cur) return;
  try { closeRegulationDay(cur, date, seen, todayISO(), Date.now(), zone()); } catch (e) { return toast(errMsg(e)); }
  save(); toast(tr`Journée du ${fmt(date)} confirmée.`);
}
/* Partager un suivi sensible avec l'assistant : seulement après avoir lu ce qui partirait, mot pour mot. */
export async function confirmSensitiveShare(id) {
  const inst = S().modules[id]; if (!inst) return;
  const text = TYPE.context(inst, label(id).toUpperCase()).trim();
  if (!await ask(`${tr`Partager avec l'assistant ce résumé de « ${label(id)} » ? Il partira tel quel à chaque question :`}\n\n${text}\n\n${tr`Notes, envies, déclencheurs et appuis restent ici. Arrêter le partage plus tard n'efface pas ce qui aura déjà été envoyé.`}`)) return;
  if (!S().modules[id]) return;
  S().config.assistant.share[id] = true; save(); toast(tr`Résumé partagé avec l'assistant.`);
}

/* Retirer une entrée, avec « Annuler » quelques secondes (la convention de Selene). Retirer une confirmation rend la
   journée inconnue ; retirer une quantité rouvre une journée confirmée. */
function removeEntry(id, entryId) {
  const inst = S().modules[id], i = inst ? inst.entries.findIndex(x => x.id === entryId) : -1;
  if (i < 0) return;
  const e = inst.entries[i], wasComplete = e.kind === "use" && regulationDay(inst, e.date).complete;
  inst.entries = inst.entries.filter(x => x.id !== entryId); save();
  const what = e.kind === "day" ? tr`La journée du ${fmt(e.date)} redevient inconnue.` : e.kind === "use" ? tr`Supprimé : ${qty(inst, e.value)} le ${fmt(e.date)}.`
    : e.kind === "urge" ? tr`Envie du ${fmt(e.date)} supprimée.` : tr`Action du ${fmt(e.date)} supprimée.`;
  toastUndo(wasComplete ? `${what} ${tr`Cette journée est à reconfirmer.`}` : what, () => {
    const cur = S().modules[id]; // relu : une synchro a pu passer entre-temps
    if (!cur || cur.entries.some(x => x.id === entryId)) return;
    cur.entries.splice(Math.min(i, cur.entries.length), 0, e); save(); toast(tr`Rétabli. Rien ne s'est passé.`);
  });
}

/* ---- la pause : une échéance enregistrée, un affichage recalculé à chaque seconde et à chaque retour ---- */
let pauseTimer = null;
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function pauseTick() {
  clearTimeout(pauseTimer); pauseTimer = null;
  const el = document.getElementById("rlmPause"); if (!el) return;
  const left = regulationRemaining(Number(el.dataset.end), Date.now());
  if (!left) { if (el.dataset.done !== "1") render(); return; } // échue : l'écran passe à « terminée », sans bruit
  el.textContent = clock(left);
  pauseTimer = setTimeout(pauseTick, 1000);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) pauseTick(); });
function pauseHTML(id, inst) {
  const p = regulationPause(inst, Date.now()); if (!p) return "";
  setTimeout(pauseTick, 0);
  const until = new Date(p.end).toLocaleTimeString(uiLocale(), { hour: "2-digit", minute: "2-digit" });
  return `<section class="rlm-pause" aria-labelledby="rlmPauseH"><h3 id="rlmPauseH">${p.left ? tr`Cinq minutes de pause` : tr`Pause terminée`}</h3>
    ${p.left ? `<p class="big" id="rlmPause" role="timer" data-end="${p.end}">${clock(p.left)}</p><p class="hint">${tr`Jusqu'à ${until}. Elle continue si tu fermes l'app ou si l'écran se met en veille. Tu peux l'arrêter quand tu veux.`}</p>`
      : `<p id="rlmPause" data-end="${p.end}" data-done="1">${tr`Tu peux noter ce qui t'a aidé, ou simplement fermer cet encadré.`}</p>`}
    <div class="row">${p.urge.strategy && !inst.entries.some(e => e.id === urgeActionId(p.urge.id)) ? `<button class="btn sm" data-act="rlm-done" data-id="${esc(p.urge.id)}">${tr`J'ai fait : ${esc(p.urge.strategy)}`}</button>` : ""}<button class="btn ghost sm" data-act="rlm-pause-stop" data-id="${esc(p.urge.id)}">${p.left ? tr`Arrêter la pause` : tr`Fermer`}</button></div></section>`;
}

/* ---- l'écran ---- */
function dayStatus(inst, d) {
  if (d.complete) {
    const verdict = d.met === null ? (d.goal ? (d.goal.mode === "observer" ? tr`observée` : "") : tr`sans objectif ce jour-là`) : d.met ? tr`objectif atteint` : tr`au-delà de l'objectif`;
    return [tr`complète : ${qty(inst, d.total)}`, verdict].filter(Boolean).join(" · ");
  }
  if (d.reopened) return tr`à reconfirmer : ${qty(inst, d.total)} après une modification`;
  return d.count ? tr`inconnue · déjà noté : ${qty(inst, d.total)}, pas encore confirmée` : tr`inconnue`;
}
function periodHTML(id, inst) {
  const today = todayISO(), cur = regulationPeriod(inst, addDays(today, -6), addDays(today, 1)), prev = regulationPeriod(inst, addDays(today, -13), addDays(today, -6));
  const cmp = regulationComparable(cur, prev);
  const cell = (p, f) => p.span ? f(p) : "—";
  const rows = [
    [tr`Journées suivies`, p => String(p.span)],
    [tr`Complètes (confirmées)`, p => String(p.complete)],
    [tr`Inconnues ou à reconfirmer`, p => String(p.incomplete)],
    [tr`Quantités déclarées, toutes journées`, p => qty(inst, p.declared)],
    [tr`Moyenne par journée complète`, p => p.mean == null ? "—" : qty(inst, p.mean)],
    [tr`Objectif atteint`, p => p.assessed ? trn(p.assessed, "{1} sur {0} journée évaluable", "{1} sur {0} journées évaluables", p.met) : "—"]
  ];
  const note = !prev.span ? tr`Pas encore de semaine précédente à mettre en regard.` : cmp.ok ? tr`Les deux périodes sont renseignées de façon voisine : leurs moyennes peuvent se comparer.`
    : cmp.reason === "few" ? tr`Moins de ${REGULATION_COMPARE_MIN} journées complètes dans l'une des périodes : leurs moyennes ne se comparent pas, l'écart dirait surtout ce qui manque.`
    : tr`Les deux périodes ne sont pas renseignées de la même façon (${cur.complete} et ${prev.complete} journées complètes) : leurs moyennes ne se comparent pas telles quelles.`;
  const first = regulationGoalHistory(inst).at(-1), changes = [...prev.goalChanges, ...cur.goalChanges].filter(g => g !== first); // la première version n'est pas un changement
  return `<section aria-labelledby="rlmWeekH-${esc(id)}"><h3 id="rlmWeekH-${esc(id)}">${tr`Mes sept derniers jours`}</h3>
    <p class="hint">${tr`Une journée inconnue ne vaut jamais zéro, ni un échec. Les jours d'avant le début du suivi ne comptent pas.`}</p>
    <div class="rlm-tablewrap"><table class="rlm-cmp"><thead><tr><th scope="col"><span class="sr">${tr`Mesure`}</span></th><th scope="col">${tr`Ces 7 jours`}</th><th scope="col">${tr`Les 7 d'avant`}</th></tr></thead>
    <tbody>${rows.map(([l, f]) => `<tr><th scope="row">${l}</th><td>${esc(cell(cur, f))}</td><td>${esc(cell(prev, f))}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">${note}</p>
    ${changes.length ? `<p>${tr`Objectif changé pendant ces deux semaines :`} ${changes.map(g => esc(tr`à partir du ${fmt(g.date)}, ${goalText(inst, g)}`)).join(" ; ")}.</p>` : ""}
    <ul class="plain rlm-days">${[...cur.days].reverse().map(d => `<li class="item" data-date="${esc(d.date)}"><span class="jdate">${fmt(d.date, { weekday: "short", day: "numeric" })}</span><div>${esc(dayStatus(inst, d))}${d.goal && d.met !== null ? `<div class="meta"><span>${esc(tr`objectif du jour : ${goalText(inst, d.goal)}`)}</span></div>` : ""}</div>
      <div class="row">${d.complete ? "" : `<button class="btn ghost sm" data-act="rlm-day-at" data-date="${esc(d.date)}" aria-label="${esc(tr`Confirmer le ${longDate(d.date)}`)}">${tr`confirmer`}</button>`}</div></li>`).join("") || `<li class="empty">${tr`Le suivi commence avec ta première saisie ou ton premier objectif.`}</li>`}</ul>
    <button class="btn ghost sm" data-act="rlm-day-other">${tr`Confirmer une autre journée…`}</button></section>`;
}
function progressHTML(inst) {
  if (!inst.config.rewards) return "";
  const p = regulationProgress(inst);
  return `<section class="rlm-progress" aria-labelledby="rlmProgH"><h3 id="rlmProgH">${tr`Les gestes restent`}</h3>
    <p><b>${trn(p.marks, "{0} marque", "{0} marques")}</b> · ${tr`une par journée où tu as déclaré une action réalisée.`}</p>
    <ol class="rlm-miles">${p.milestones.map(m => `<li class="${m.reached ? "on" : ""}"><span aria-hidden="true">${m.reached ? "●" : "○"}</span> ${m.reached ? trn(m.n, "{0} marque, jalon atteint", "{0} marques, jalon atteint") : trn(m.n, "{0} marque, à venir", "{0} marques, à venir")}</li>`).join("")}</ol>
    <p class="hint">${p.next ? trn(p.next, "Prochain jalon : {0} marque.", "Prochain jalon : {0} marques.") : tr`Tous les jalons sont atteints ; tes gestes continuent de compter.`} ${tr`Aucun jour consécutif exigé ; un écart ne retire rien ; supprimer une action erronée corrige le compte.`}</p>
    ${p.reward ? `<p>${trn(p.reward.at, "Ma récompense à {0} marque : {1}", "Ma récompense à {0} marques : {1}", `<b>${esc(p.reward.text)}</b>`)} · ${p.reward.reached ? tr`atteinte` : trn(p.reward.left, "encore {0}", "encore {0}")}</p>` : ""}</section>`;
}
function supportsHTML(id, inst) {
  const today = todayISO(), rows = regulationSupports(inst, addDays(today, -29), addDays(today, 1));
  return `<section aria-labelledby="rlmSupH-${esc(id)}"><h3 id="rlmSupH-${esc(id)}">${tr`Ce qui peut m'aider`}</h3>
    ${inst.config.supports.length ? `<ul class="plain rlm-supports">${inst.config.supports.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : `<p class="empty">${tr`Aucun appui pour l'instant.`}</p>`}
    <datalist id="rlmSup-${esc(id)}">${inst.config.supports.map(s => `<option value="${esc(s)}">`).join("")}</datalist>
    <button class="btn sm" data-act="rlm-plan">${tr`Personnaliser mes appuis et récompenses`}</button>
    ${rows.length ? `<h4>${tr`Ce que j'en ai dit, ces 30 derniers jours`}</h4><ul class="plain rlm-feedback">${rows.map(r => `<li><b>${esc(r.strategy)}</b> : ${esc([
      r.chosen ? trn(r.chosen, "choisi {0} fois lors d'une envie", "choisi {0} fois lors d'une envie") : "", r.done ? trn(r.done, "réalisé {0} fois", "réalisé {0} fois") : "",
      ...Object.keys(OUTCOMES).filter(k => r[k]).map(k => `${tr(OUTCOMES[k])} ×${r[k]}`)].filter(Boolean).join(" · "))}</li>`).join("")}</ul>
      <p class="hint">${tr`Une description, pas une conclusion : quelques retours ne disent ni qu'un appui marche, ni pourquoi.`}</p>` : ""}</section>`;
}
function entryHTML(inst, e) {
  let main = "";
  if (e.kind === "use") main = `<b>${esc(qty(inst, e.value))}</b>${e.declared != null ? ` <span class="hint">${esc(tr`(complément, total déclaré : ${qty(inst, e.declared)})`)}</span>` : ""}`;
  else if (e.kind === "action") main = esc(tr`Action réalisée : ${e.strategy}`);
  else if (e.kind === "day") main = esc(regulationDay(inst, e.date).complete ? tr`Journée confirmée` : tr`Confirmation à refaire : la journée a changé depuis`);
  else main = esc([tr`Envie`, e.intensity !== null ? tr`intensité ${e.intensity}/10` : "", e.strategy ? tr`appui choisi : ${e.strategy}` : "", e.outcome ? tr(OUTCOMES[e.outcome]) : ""].filter(Boolean).join(" · "));
  const done = e.kind === "urge" && e.strategy && !inst.entries.some(x => x.id === urgeActionId(e.id));
  const acts = [done ? `<button class="btn ghost sm" data-act="rlm-done">${tr`Je l'ai fait`}</button>` : "",
    e.kind === "urge" && !(e.pauseEnd && e.pauseEnd > Date.now()) ? `<button class="btn ghost sm ra" data-act="rlm-pause">${tr`Pause de 5 min`}</button>` : "",
    e.kind !== "day" ? `<button class="btn ghost sm ra" data-act="rlm-edit">${tr`modifier`}</button>` : "",
    `<button class="btn ghost sm ra" data-act="rlm-del">${e.kind === "day" ? tr`laisser inconnue` : tr`suppr.`}</button>`].join("");
  return `<li class="item" data-id="${esc(e.id)}"><span class="jdate">${fmt(e.date)}</span><div>${main}${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}${e.editedAt ? `<div class="meta"><span>${tr`corrigé`}</span></div>` : ""}</div><div class="row">${acts}</div></li>`;
}
function privacyHTML(id, inst) {
  const shared = !!S().config.assistant.share[id];
  return `<details class="rlm-privacy" id="rlmPriv-${esc(id)}"><summary>${tr`Confidentialité et données`}</summary>
    <ul class="plain rlm-facts">
      <li><b>${tr`Où vivent ces données.`}</b> ${tr`Sur cet appareil. Si tu es connectée à un compte Selene, elles sont aussi synchronisées avec le serveur de Selene, comme le reste de ton tableau de bord : chaque compte n'y lit que ses propres données, mais elles n'y sont pas chiffrées de bout en bout. Ce suivi n'est pas un coffre-fort à part.`}</li>
      <li><b>${tr`Sauvegardes.`}</b> ${tr`La sauvegarde complète (Réglages, Compte et données, Exporter) contient ce suivi en entier, notes comprises.`}</li>
      <li><b>${tr`Ce qui reste visible.`}</b> ${tr`Le nom de cet espace et sa présence : navigation, accueil, Réglages, palette de commandes. Les détails (quantités, envies, notes, appuis) restent ici : ni recherche, ni motifs, ni dérive lexicale, ni test lunaire, ni bilan général, ni planche de lunaison, ni reprise sur l'accueil, ni liens, ni widget, ni notifications.`}</li>
      <li><b>${tr`L'assistant.`}</b> ${shared ? tr`Partagé : il reçoit ce résumé, et rien d'autre, à chaque question.` : tr`Non partagé : l'assistant ne reçoit rien de ce suivi. Si tu le partages, il recevra ce résumé, et rien d'autre :`}
        <blockquote class="note rlm-quote">${esc(TYPE.context(inst, label(id).toUpperCase()).trim())}</blockquote>
        ${tr`Arrêter le partage empêche les envois suivants ; cela ne retire pas ce qui a déjà été envoyé (efface la conversation dans l'Assistant si tu veux).`}${enabled("assistant") ? "" : ` ${tr`L'assistant est désactivé en ce moment.`}`}</li>
      <li><b>${tr`Export de ce suivi.`}</b> ${tr`Un fichier JSON lisible, non chiffré : nom, sujet, objectifs et leur historique, journal complet avec les notes, appuis et récompense. Pour le consulter ou le garder ; une restauration passe par la sauvegarde complète.`}</li>
      <li><b>${tr`Suppression.`}</b> ${tr`Supprimer ce suivi efface ses données de cet appareil puis, à la synchronisation suivante, de ton compte et de tes autres appareils. Les sauvegardes et exports déjà téléchargés restent là où tu les as rangés.`}</li>
    </ul>
    <div class="row"><button class="btn sm" data-act="rlm-share">${shared ? tr`Ne plus partager avec l'assistant` : tr`Partager ce résumé avec l'assistant…`}</button><button class="btn sm" data-act="rlm-export">${tr`Exporter ce suivi`}</button><button class="btn ghost sm" data-act="mod-del" data-mod="${esc(id)}">${tr`Supprimer ce suivi…`}</button></div></details>`;
}
function setupHTML(id) {
  return `<section><p>${tr`Un espace pour observer, réduire ou arrêter le tabac, le cannabis, l'alcool ou les réseaux sociaux, à ton rythme. Tu notes ce que tu veux ; une journée ne compte que lorsque tu la confirmes.`}</p>
    <p class="hint">${tr`Ce n'est ni un diagnostic, ni un programme de soin : un carnet. Il ne calcule aucun sevrage et ne dit jamais qu'une quantité est sans risque.`}</p>
    <button class="btn acc" data-act="rlm-setup">${tr`Commencer : choisir ce que je veux suivre`}</button></section>`;
}
function viewHTML(id) {
  const inst = S().modules[id], m = esc(id);
  const head = `<h2>${esc(label(id))}</h2><p class="hint">${tr`Suivi personnel et autodéclaratif, sans diagnostic ni programme de sevrage. Privé par défaut : voir « Confidentialité et données ».`}</p>`;
  if (!subjectOf(inst)) return `<div data-mod="${m}" class="rlm">${head}${setupHTML(id)}${privacyHTML(id, inst)}</div>`;
  const today = todayISO(), g = regulationGoal(inst, today), next = regulationNextGoal(inst, today), d = regulationDay(inst, today), sub = subjectOf(inst);
  const journal = [...inst.entries].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.at - a.at));
  return `<div data-mod="${m}" class="rlm">${head}
    ${regulationSubjectConflict(inst) ? `<p class="hint rlm-warn" role="alert">${tr`Deux appareils ont commencé ce suivi avec deux sujets différents ; un seul a été gardé. Les quantités notées sur l'autre appareil sont peut-être dans une autre unité : vérifie le journal, et crée un suivi par sujet.`}</p>` : ""}
    <section class="rlm-now" aria-labelledby="rlmNowH"><h3 id="rlmNowH">${esc(sub.name())} · ${esc(goalText(inst, g))}</h3>
      <p class="hint">${esc(sub.about())}</p>
      ${next ? `<p class="hint">${esc(tr`À partir du ${fmt(next.date)} : ${goalText(inst, next)}.`)}</p>` : ""}
      <p>${tr`Aujourd'hui, déjà noté : ${esc(qty(inst, d.total))}`} · ${d.complete ? tr`journée confirmée` : d.reopened ? tr`à reconfirmer` : tr`pas encore confirmée`}</p>
      <div class="rlm-acts"><button class="btn acc" data-act="rlm-urge">${tr`J'ai une envie`}</button><button class="btn" data-act="rlm-use">${tr`Noter une consommation / durée`}</button><button class="btn" data-act="rlm-action">${tr`J'ai réalisé une action`}</button><button class="btn" data-act="rlm-day">${tr`Faire mon point du jour`}</button></div></section>
    ${pauseHTML(id, inst)}
    ${inst.config.subject === "alcool" ? `<details class="rlm-info" id="rlmAlc-${m}"><summary>${tr`Alcool : sevrage, urgences, aide`}</summary><p>${esc(alcoholRisk())}</p><p><b>${esc(alcoholUrgent())}</b></p><p>${esc(alcoholHelp())} <a href="https://www.alcool-info-service.fr/" target="_blank" rel="noopener noreferrer">alcool-info-service.fr</a></p></details>` : ""}
    ${periodHTML(id, inst)}
    ${progressHTML(inst)}
    ${supportsHTML(id, inst)}
    <section aria-labelledby="rlmLogH-${m}"><h3 id="rlmLogH-${m}">${tr`Journal`}</h3><ul class="plain">${(pg => pg.items.map(e => entryHTML(inst, e)).join("") + pg.more)(paged(`regulation:${id}`, journal)) || `<li class="empty">${tr`Rien de noté pour l'instant.`}</li>`}</ul></section>
    <section aria-labelledby="rlmGoalH-${m}"><h3 id="rlmGoalH-${m}">${tr`Mes objectifs`}</h3>
      <p>${tr`En ce moment : ${esc(goalText(inst, g))}.`}</p>
      <button class="btn sm" data-act="rlm-goal">${tr`Faire évoluer mon objectif`}</button>
      <details id="rlmHist-${m}"><summary class="hint">${trn(inst.goals.length, "Historique : {0} version", "Historique : {0} versions")}</summary><ul class="plain rlm-history">${regulationGoalHistory(inst).map(v => `<li>${esc(tr`à partir du ${fmt(v.date, { day: "numeric", month: "long", year: "numeric" })} : ${goalText(inst, v)}`)} <span class="hint">${esc(tr`(choisi le ${fmt(iso(new Date(v.at)))})`)}</span></li>`).join("")}</ul></details>
      <p class="hint">${tr`Début du suivi : ${fmt(regulationStart(inst), { day: "numeric", month: "long", year: "numeric" })}. Chaque journée confirmée garde l'objectif en vigueur au moment de sa confirmation.`}</p></section>
    ${privacyHTML(id, inst)}</div>`;
}

const TYPE = {
  sensitive: true,
  view: viewHTML,
  settings: id => `<p class="hint">${tr`Suivi privé : partage avec l'assistant désactivé à la création, détails exclus des vues générales. Son nom reste visible.`}</p><div class="row"><button class="btn sm" data-act="rlm-plan" data-mod="${esc(id)}">${tr`Appuis et récompenses`}</button><a class="btn ghost sm" href="#${esc(id)}">${tr`Ouvrir le suivi`}</a></div>`,
  summary: () => tr`Suivi privé : ouvrir pour consulter`,
  // Pour l'assistant (consigne en français, docs/i18n.md) : le résumé explicite, rien de ce qui est écrit à la main.
  context(inst, name) {
    const s = REGULATION_SUBJECTS[inst.config.subject];
    if (!s) return `\n${name} : suivi personnel autodéclaratif, pas encore configuré.`;
    const today = todayISO(), p = regulationPeriod(inst, addDays(today, -6), addDays(today, 1)), g = regulationGoal(inst, today);
    const goal = !g ? "aucun objectif en cours" : g.mode === "observer" ? "observer sans cible" : g.mode === "arreter" ? "viser l'arrêt" : `au plus ${g.limit} ${s.unit} par jour`;
    return `\n${name} : suivi personnel autodéclaratif (${s.fr}, en ${s.unit}). Objectif choisi : ${goal}. Sept derniers jours : ${p.span} jours suivis, ${p.complete} journées complètes, ${p.incomplete} inconnues ou à reconfirmer (une journée inconnue ne vaut pas zéro) ; ${p.declared} ${s.unit} déclarés en tout ; moyenne par journée complète : ${p.mean ?? "sans objet"} ; objectif atteint ${p.met} fois sur ${p.assessed} journées évaluables. Notes, envies, déclencheurs et appuis ne sont pas transmis. Ne propose ni diagnostic, ni calendrier de sevrage, ni dose.${inst.config.subject === "alcool" ? " Un arrêt brutal ou une réduction rapide peuvent être dangereux en cas de dépendance : oriente vers un médecin ou un CSAPA." : ""}`;
  },
  recent: () => [],
  review: () => null,
  // Pas de hook texts, ni alerts, ni badge, ni accept : voir l'en-tête.
  click: {
    "rlm-setup": el => subjectForm(modOf(el)),
    "rlm-goal": el => goalForm(modOf(el)),
    "rlm-use": el => useForm(modOf(el)),
    "rlm-urge": el => urgeForm(modOf(el)),
    "rlm-action": el => actionForm(modOf(el)),
    "rlm-plan": el => planForm(modOf(el)),
    "rlm-day": el => confirmDay(modOf(el), todayISO()),
    "rlm-day-at": el => confirmDay(modOf(el), el.dataset.date),
    "rlm-day-other": el => { const id = modOf(el); openForm(tr`Confirmer une journée`, [{ n: "date", l: tr`Journée`, t: "date", req: true, max: todayISO() }], { date: addDays(todayISO(), -1) }, v => confirmDay(id, v.date), tr`Tu verras d'abord son total exact. Une journée non confirmée reste inconnue : jamais zéro, jamais un échec.`); },
    "rlm-edit": el => {
      const id = modOf(el), e = S().modules[id].entries.find(x => x.id === entryOf(el)); if (!e) return;
      if (e.kind === "use") useForm(id, e); else if (e.kind === "urge") urgeForm(id, e); else if (e.kind === "action") actionForm(id, e);
    },
    "rlm-del": el => removeEntry(modOf(el), entryOf(el)),
    "rlm-done": el => {
      const id = modOf(el), inst = S().modules[id], urgeId = el.dataset.id || entryOf(el);
      const e = markUrgeDone(inst, urgeId, todayISO(), Date.now(), zone()); save();
      toast(tr`C'est noté : ${e.strategy}. Une action réalisée, pas seulement choisie.`);
    },
    "rlm-pause": el => { const id = modOf(el); startRegulationPause(S().modules[id], entryOf(el), Date.now()); save(); },
    "rlm-pause-stop": el => { stopRegulationPause(S().modules[modOf(el)], el.dataset.id); save(); },
    "rlm-share": el => {
      const id = modOf(el);
      if (!S().config.assistant.share[id]) return confirmSensitiveShare(id);
      S().config.assistant.share[id] = false; save(); toast(tr`Partage arrêté. Ce qui a déjà été envoyé dans une conversation n'en est pas retiré.`);
    },
    "rlm-export": async el => {
      const id = modOf(el), inst = S().modules[id];
      if (!await ask(tr`Exporter ce suivi dans un fichier lisible, non chiffré ? Il contient tout le journal, notes comprises.`)) return;
      await downloadFile(`selene-suivi-${todayISO()}.json`, JSON.stringify({ format: "selene-regulation-v1", exportedAt: new Date().toISOString(),
        about: "Export de consultation d'un suivi « Reprendre la main ». Restauration : par la sauvegarde complète de Selene.",
        module: { label: label(id), type: inst.type, config: inst.config, goals: inst.goals, entries: inst.entries } }, null, 2), "application/json", tr`Suivi personnel`);
    }
  }
};
registerType("regulation", TYPE);
