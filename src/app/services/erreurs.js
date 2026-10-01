/* Les erreurs des fonctions serveur (supabase/functions : passeur, compte, assistant) : { erreur, code, detail? }.
   L'interface traduit par le code ; `erreur`, le message français, sert de repli face à une fonction déployée avant les
   codes. `detail` : ce qui varie (un type de contenu, le refus d'une redirection). tests/i18n.test.js vérifie que chaque
   code renvoyé par le serveur a sa phrase ici. */
import { tr } from "../i18n/index.js";

// Les refus d'une adresse (passeur/garde.ts), seuls ou au bout d'une redirection.
const REFUS = {
  "adresse-absente": () => tr`adresse absente ou trop longue`,
  "adresse-illisible": () => tr`adresse illisible`,
  "protocole": () => tr`seulement http et https`,
  "identifiants": () => tr`pas d'identifiants dans l'adresse`,
  "port": () => tr`port inhabituel`,
  "adresse-privee": () => tr`adresse privée, réservée ou introuvable`,
  "nom-local": () => tr`nom de réseau local`
};
const detail = j => String(j.detail || "");
export const SERVER_ERRORS = {
  ...REFUS,
  "post-seulement": () => tr`POST seulement`,
  "origine": () => tr`origine non autorisée`,
  "session": () => tr`session absente ou expirée`,
  "illisible": () => tr`requête illisible`,
  "trop-long": () => tr`requête trop longue`,
  "action-inconnue": () => tr`action inconnue`,
  "trop-d-essais": () => tr`trop d'essais ; réessaie dans quelques minutes`,
  // passeur
  "passeur-non-configure": () => tr`passeur non configuré : secret PASSEUR_USERS absent`,
  "compte-non-autorise": () => tr`ce compte n'est pas autorisé à utiliser ce passeur`,
  "trop-d-appels": () => tr`trop d'appels ; réessaie dans quelques minutes`,
  "genre-inconnu": () => tr`genre inconnu`,
  "trop-de-redirections": () => tr`trop de redirections`,
  "redirection": j => tr`redirection refusée : ${Object.hasOwn(REFUS, j.detail) ? REFUS[j.detail]() : detail(j)}`,
  "site": j => tr`le site répond ${j.status}`,
  "contenu": j => tr`contenu inattendu (${detail(j)})`,
  "trop-gros": () => tr`plus de 2 Mo : refusé`,
  "lent": () => tr`le site met plus de 8 secondes à répondre`,
  "injoignable": () => tr`le site est injoignable`,
  // compte
  "compte-non-configure": () => tr`suppression non configurée (voir docs/compte.md)`,
  "compte-illisible": () => tr`compte illisible`,
  "confirmation": () => tr`confirmation manquante`,
  "donnees-non-effacees": () => tr`données non effacées ; réessaie`,
  "compte-non-supprime": () => tr`données effacées, compte non supprimé ; réessaie`,
  // assistant
  "assistant-non-configure": () => tr`assistant non configuré (voir docs/assistant.md)`,
  "pas-une-cle": () => tr`ce n'est pas une clé d'API Anthropic (sk-ant-…)`,
  "cle": j => j.detail === "enregistree" ? tr`Anthropic refuse la clé enregistrée` : tr`Anthropic refuse cette clé`,
  "sans-cle": j => j.detail === "illisible" ? tr`clé enregistrée illisible : enregistre-la de nouveau` : tr`aucune clé enregistrée pour ce compte`,
  "anthropic-injoignable": () => tr`Anthropic injoignable ; réessaie`,
  "trop-de-messages": () => tr`trop de messages ; réessaie dans quelques minutes`,
  "requete": j => tr`requête refusée par le serveur (${detail(j)})`,
  "limite-anthropic": () => tr`limite de ton compte Anthropic atteinte ; réessaie plus tard`,
  "anthropic-requete": j => tr`Anthropic refuse la requête : ${detail(j)}`,
  "anthropic-muet": () => tr`Anthropic ne répond pas ; réessaie`,
  "anthropic-erreur": () => tr`Anthropic répond par une erreur ; réessaie`,
  "base-injoignable": () => tr`base de données injoignable`
};
/* Le message d'une réponse d'erreur, dans la langue de l'interface ; `fallback` si elle n'en dit rien. */
export const serverMsg = (j, fallback = "") => j && typeof j === "object" && typeof j.code === "string" && Object.hasOwn(SERVER_ERRORS, j.code)
  ? SERVER_ERRORS[j.code](j) : (j && typeof j === "object" && typeof j.erreur === "string" && j.erreur) || fallback;
/* Une erreur à lever : le message traduit, et le code, pour décider sans lire le texte. */
export const serverError = (j, fallback) => Object.assign(new Error(serverMsg(j, fallback)), { code: j && typeof j.code === "string" ? j.code : "" });
