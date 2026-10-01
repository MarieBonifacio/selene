/* Les deux documents de la personne (site, board) et leur lecture : modules fixes, données de départ, normalisation à
   l'entrée, S(), label(), enabled(). */
import { MODULE_TYPES, SCHEMA_VERSION, SECTION_TO_MODULE, inboxId, migrateModules } from "../../core/domain.js";
import { setSaving } from "../lib/dom.js";
import { N_, tr } from "../i18n/index.js";
import { render } from "../shell/render.js";
import { makeStore } from "./store.js";


// Les modules fixes et leur nom par défaut, affiché dans la langue de l'interface tant que la personne n'en choisit pas un.
export const MODULE_DEFS = {
  assistant: N_("Assistant")
};
const OFF_BY_DEFAULT = ["assistant"];
/* Données de départ d'un compte neuf : presque rien, et rien de personnel. L'accueil propose ensuite des
   modèles (MODULE_TEMPLATES). Doivent rester « vierges » (updatedAt 0, pas d'identifiant aléatoire) :
   un appareil vierge adopte le serveur tel quel au lieu de fusionner. */
export function siteSeed() {
  return {
    updatedAt: 0, schemaVersion: SCHEMA_VERSION, boardMerged: true,
    // lang : la langue de l'interface, suivie par le compte ; vide, celle de l'appareil (même valeur partout : le
    // départ reste vierge et identique d'un appareil à l'autre).
    config: { name: "Selene", palette: "nigredo", mode: "auto", lang: "", labels: {}, groups: {}, welcome: true,
      modules: [{ id: "inbox", on: true }, { id: "assistant", on: !OFF_BY_DEFAULT.includes("assistant") }],
      assistant: { model: "claude-sonnet-5", actions: true, share: { inbox: true } } },
    modules: { inbox: SECTION_TO_MODULE.inbox({ items: [] }) }
  };
}
/* Remet un document du site dans la forme attendue (migration des anciens formats, champs ajoutés
   depuis, entrées de navigation manquantes). Appelée par le store à chaque fois que des données y entrent
   (lecture locale, synchro, import) : S() n'a donc plus rien à corriger et se contente de lire. */
function normalizeSite(d) {
  const seed = siteSeed();
  migrateModules(d);
  if ((d.schemaVersion || 1) < SCHEMA_VERSION) d.schemaVersion = SCHEMA_VERSION;
  for (const k of Object.keys(seed)) if (d[k] == null) d[k] = seed[k];
  // « welcome » n'est pas un réglage manquant : il n'existe que pour les comptes créés avec ce bloc d'accueil.
  for (const k of Object.keys(seed.config)) if (k !== "welcome" && d.config[k] == null) d.config[k] = seed.config[k];
  for (const id of Object.keys(MODULE_DEFS)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: !OFF_BY_DEFAULT.includes(id) });
  for (const id of Object.keys(d.modules)) if (!d.config.modules.find(m => m.id === id)) d.config.modules.push({ id, on: true });
  for (const k of Object.keys(seed)) if (k !== "modules" && k !== "config" && typeof seed[k] === "object" && !Array.isArray(seed[k])) for (const f of Object.keys(seed[k])) if (d[k][f] == null) d[k][f] = seed[k][f];
  for (const inst of Object.values(d.modules)) if (Object.hasOwn(MODULE_TYPES, inst.type) && MODULE_TYPES[inst.type].normalize) MODULE_TYPES[inst.type].normalize(inst);
  const inbox = inboxId(d.modules); // une seule boîte de réception, même après une fusion entre appareils
  for (const [id, inst] of Object.entries(d.modules)) if (inst.type === "notes" && inst.config.inbox && id !== inbox) inst.config.inbox = false;
  return d;
}
// Ce que les deux documents disent à la page : redessiner après une synchronisation, l'état de l'enregistrement.
const storeHooks = { onRemoteChange: () => render(), onStatus: m => setSaving(m) };
export const site = makeStore("selene-site-v1", "site/state", siteSeed, normalizeSite, storeHooks);
/* L'ancien document « board » (tâches du Chantier jusqu'au format 5) n'est plus qu'un point d'entrée :
   ce qu'il contient est versé dans le module Chantier du site, puis il est vidé, et le vidage part au
   serveur à la synchro suivante (sinon chaque nouvel appareil ressusciterait les tâches supprimées).
   Une ancienne version de l'app restée ouverte ailleurs peut encore y écrire : rien n'est perdu.
   Doit être connecté APRÈS le site : versé dans un site pas encore synchronisé (données de départ),
   le contenu rendrait ces données « non vierges » et la synchro les fusionnerait au lieu de les remplacer. */
function absorbBoard(d) {
  if (!Array.isArray(d.tasks)) d.tasks = [];
  if (!d.tasks.length) return d;
  const inst = site.data.modules.chantier;
  if (inst && inst.type === "taches") for (const t of d.tasks) if (!inst.entries.some(x => x.id === t.id)) inst.entries.push(t);
  d.tasks = []; d.schemaVersion = SCHEMA_VERSION;
  site.save();
  return d;
}
export const board = makeStore("selene-board-v1", "board/state", () => ({ updatedAt: 0, tasks: [] }), absorbBoard, storeHooks);
export const S = () => site.data;
 // lecture seule : la normalisation a lieu à l'entrée des données, pas ici
export const label = id => { const s = S(); return s.config.labels[id] || (s.modules[id] && s.modules[id].label) || (Object.hasOwn(MODULE_DEFS, id) ? tr(MODULE_DEFS[id]) : undefined); };
export const enabled = id => { const m = S().config.modules.find(m => m.id === id); return m ? m.on : false; };
