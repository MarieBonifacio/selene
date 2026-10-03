/* Le journal des erreurs (T9 de l'audit ; docs/compte.md, « Journal des erreurs ») : une erreur de programmation qui
   échappe à l'app part, anonyme, dans la table `erreurs` du projet Supabase de Selene. (Les erreurs que renvoient les
   fonctions serveur, elles, se traduisent dans services/erreurs.js.) Ce qui part, et rien d'autre :
     - genre : le nom de l'erreur (TypeError, RangeError, QuotaExceededError…), jamais son message, qui peut citer ce
       que la personne a écrit ;
     - lieu : l'endroit du code (fichier:ligne:colonne du premier cadre de la pile), ou le nom de l'action ;
     - vue : l'écran (accueil, reglages…, module:<type>), jamais l'identifiant d'un module (tiré du nom choisi), et
       « module » seul pour un type sensible ;
     - version (l'empreinte du code, posée par build.py) et plateforme (web, capacitor, tauri).
   Ni compte, ni jeton : la requête ne porte que la clé publique. Les erreurs attendues ne partent pas : une
   validation (Error simple, ou une erreur du noyau avec son code), un réseau coupé, un abandon. Au plus cinq envois
   par chargement, une fois chacun. Jamais dans l'artefact claude.ai ; coupé, sur cet appareil, depuis les Réglages. */
import { hosted, platform } from "../../platform.js";
import { CHANGE, TYPE_UI, VIEWS } from "../registry.js";
import { tr } from "../i18n/index.js";
import { S } from "../state/site.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authReady } from "./auth.js";

/* L'empreinte du code, déclarée par build.py autour de l'application ; absente hors du script assemblé. */
/* global SELENE_BUILD */
export const BUILD = typeof SELENE_BUILD === "string" ? SELENE_BUILD : "dev";
const OFF_KEY = "selene-erreurs", MAX = 5;
const sent = new Set();
// Réseau coupé, requête abandonnée ou trop longue : la vie d'une app hors ligne, pas un défaut à corriger.
const EXPECTED = /failed to fetch|networkerror|load failed|network request failed|the user aborted|timed? ?out/i;

export const errorReportsOn = () => { try { return platform.storage.get(OFF_KEY) !== "off"; } catch { return true; } };
export function setErrorReports(on) { try { if (on) platform.storage.remove(OFF_KEY); else platform.storage.set(OFF_KEY, "off"); } catch {} }

/* Le premier cadre de la pile, réduit au fichier (sans chemin ni adresse) et à sa position. */
export function topFrame(stack) {
  for (const line of String(stack || "").split("\n")) {
    const m = line.match(/([^\s()@]*):(\d+):(\d+)\)?\s*$/);
    if (!m) continue;
    const file = (m[1].split(/[?#]/)[0].split("/").pop() || "page").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 60) || "page";
    return `${file}:${m[2]}:${m[3]}`;
  }
  return "";
}
/* L'écran ouvert : une vue du système par son nom, un module par son type. */
export function currentView() {
  try {
    const route = decodeURIComponent((typeof location !== "undefined" ? location.hash : "").slice(1).split("/")[0] || "accueil");
    const inst = Object.hasOwn(S().modules, route) ? S().modules[route] : null;
    if (inst) return TYPE_UI[inst.type]?.sensitive ? "module" : `module:${String(inst.type).slice(0, 30)}`;
    return Object.hasOwn(VIEWS, route) ? route.slice(0, 40) : "";
  } catch { return ""; }
}
/* Ce qui partirait pour cette erreur, ou null si elle ne part pas (attendue, ou rien d'une erreur). */
export function errorReport(err, lieu = "") {
  const name = err && typeof err === "object" ? String(err.name || "") : "";
  // Une erreur du noyau porte un code texte (une validation) ; celui d'une DOMException est un nombre.
  if (!/^[A-Za-z]{1,40}$/.test(name) || name === "Error" || name === "AbortError" || typeof err.code === "string") return null;
  if (EXPECTED.test(String(err.message || ""))) return null;
  return { version: BUILD.slice(0, 40), plateforme: String(platform.runtime()).slice(0, 20), genre: name, lieu: (lieu || topFrame(err.stack)).slice(0, 200), vue: currentView() };
}
/* Envoyer, sans attendre ni jamais échouer : une panne du journal ne doit rien casser, ni se signaler elle-même. */
export function reportError(err, lieu = "") {
  try {
    if (!hosted() || !authReady() || !errorReportsOn()) return;
    const r = errorReport(err, lieu); if (!r) return;
    const key = `${r.genre} ${r.lieu}`;
    if (sent.has(key) || sent.size >= MAX) return;
    sent.add(key);
    fetch(`${SUPABASE_URL}/rest/v1/erreurs`, { method: "POST", keepalive: true, body: JSON.stringify(r),
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" } }).catch(() => {});
  } catch { /* le journal ne parle jamais de lui-même */ }
}
export function errorSettingsHTML() {
  return `<label class="check-l" style="margin-top:12px"><input type="checkbox" data-act="err-reports" ${errorReportsOn() ? "checked" : ""}>${tr`Envoyer les erreurs de l'app, anonymes`}</label>
    <p class="hint">${tr`Seulement les erreurs de programmation : leur type, l'endroit du code, l'écran, la version et la plateforme. Jamais ton compte ni ce que tu écris. Gardées 30 jours, pour corriger Selene. Ce réglage vaut pour cet appareil.`}</p>`;
}
CHANGE["err-reports"] = el => setErrorReports(el.checked);
