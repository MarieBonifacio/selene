/* La mesure d'usage de la bêta (E4 de l'audit ; docs/compte.md, « Mesure d'usage ») : les jours où un compte a saisi
   quelque chose. Une ligne (compte, jour) dans la table `activite` du projet Supabase, et rien d'autre : ni ce qui est
   écrit, ni l'heure, ni l'écran, ni l'appareil. Le serveur ignore une deuxième ligne du même jour ; la page n'en
   envoie qu'une par jour et par chargement, et ne garde rien sur l'appareil pour s'en souvenir.
   Une saisie, pas une ouverture : l'envoi suit un enregistrement que la personne a provoqué (un clic, une touche :
   l'activation utilisateur du navigateur) et qui change le contenu d'un espace (entrées, journal…), pas seulement un
   réglage ou un espace neuf et vide. Seulement avec un compte (la session dit qui ; sans compte, rien ne part), jamais
   dans l'artefact claude.ai ; coupée, sur cet appareil, depuis Réglages → Compte. Tant que la table n'existe pas sur
   le projet, rien n'est compté. */
import { hosted, platform } from "../../platform.js";
import { CHANGE, SAVED } from "../registry.js";
import { tr } from "../i18n/index.js";
import { todayISO } from "../lib/format.js";
import { site } from "../state/site.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authReady, authSession } from "./auth.js";

const OFF_KEY = "selene-activite";
let sentDay = "";

export const activityOn = () => { try { return platform.storage.get(OFF_KEY) !== "off"; } catch { return true; } };
export function setActivity(on) { try { if (on) platform.storage.remove(OFF_KEY); else platform.storage.set(OFF_KEY, "off"); } catch {} }

const SHAPE = new Set(["type", "label", "config"]);
/* Ce que contiennent les espaces (entrées, journal, fragments…), sans leurs réglages : un espace neuf et vide, une
   palette changée ne comptent pas. */
export function contentKey(modules) {
  const out = [];
  for (const id of Object.keys(modules || {}).sort()) {
    const m = modules[id] || {};
    for (const k of Object.keys(m).sort()) {
      const v = m[k];
      if (SHAPE.has(k) || v == null || (typeof v === "object" && !Object.keys(v).length)) continue;
      out.push(id, k, JSON.stringify(v));
    }
  }
  return out.join("\u0000");
}
// Provoqué par la personne : le navigateur le sait quelques secondes après un clic ou une touche. Sans l'information
// (navigateur ancien, tests), on compte.
const byPerson = () => { try { const u = globalThis.navigator && navigator.userActivation; return !u || u.isActive; } catch { return true; } };

/* Appelée à chaque enregistrement du site. Envoyer, sans attendre ni jamais échouer. */
export function noteActivity() {
  try {
    const day = todayISO();
    if (sentDay === day || !hosted() || !authReady() || !authSession || !activityOn() || !byPerson()) return;
    // Le contenu a-t-il changé depuis la dernière synchronisation (la base) ? Sans base, c'est un premier envoi.
    if (site.base && contentKey(site.data.modules) === contentKey(site.base.modules)) return;
    sentDay = day;
    fetch(`${SUPABASE_URL}/rest/v1/activite`, { method: "POST", keepalive: true, body: JSON.stringify({ jour: day }),
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authSession.access_token}`, "Content-Type": "application/json", Prefer: "return=minimal" } })
      .catch(() => { sentDay = ""; }); // réseau coupé : la saisie suivante réessaiera
  } catch { /* la mesure ne parle jamais d'elle-même */ }
}
SAVED.push(noteActivity);

export function activitySettingsHTML() {
  return `<label class="check-l" style="margin-top:12px"><input type="checkbox" data-act="activity" ${activityOn() ? "checked" : ""}>${tr`Compter mes jours d'usage, pour la bêta`}</label>
    <p class="hint">${tr`Un jour où tu as saisi quelque chose, et rien d'autre : ni ce que tu écris, ni l'heure, ni l'appareil. Gardé 13 mois, pour savoir si Selene sert encore au bout d'un mois. Ce réglage vaut pour cet appareil.`}</p>`;
}
CHANGE["activity"] = el => setActivity(el.checked);
