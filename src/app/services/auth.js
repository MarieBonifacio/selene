/* Comptes (Supabase, build hébergé uniquement).
   Parle directement aux API REST de Supabase (Auth + PostgREST) via fetch,
   sans client JS vendorisé — plus simple à vérifier ligne par ligne qu'un
   gros bundle recopié à la main. Inactif tant que SUPABASE_URL/SUPABASE_ANON_KEY
   ne sont pas renseignées, donc jamais actif dans l'artefact claude.ai. */
import { hosted, platform } from "../../platform.js";
import { CLICK } from "../registry.js";
import { $, esc, setSaving, toast } from "../lib/dom.js";
import { tr, trn, trp } from "../i18n/index.js";
import { serverError } from "./erreurs.js";
import { render } from "../shell/render.js";
import { deviceSignOutGuard } from "../modules/regulation.js";
import { DRAFT_PREFIX } from "../state/drafts.js";
import { localErase, localSwitch } from "../state/local.js";
import { board, site, siteSeed } from "../state/site.js";
import { ask } from "../ui/dialogs.js";

export const SUPABASE_URL = "https://pxnrzrmzritezftefdlj.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_vC_zBX0TN4jZqi1GRIvo2A_nD2WFW9T";
export const authReady = () => hosted() && !SUPABASE_URL.includes("YOUR-PROJECT-REF");
/* Sans compte (U1 de l'audit) : Selene marche entière sur l'appareil, comme dans l'artefact claude.ai, et rien de ce
   qu'on y écrit ne part au serveur. Un choix de l'appareil (platform.storage), pas un réglage du compte. Se connecter
   plus tard verse ce qui a été noté dans le compte (fusion à trois voies, ADR 3) ; Apple refuse d'ailleurs qu'une app
   dont l'essentiel ne dépend pas d'un compte en exige un (App Review Guidelines, 5.1.1 (v)). `authAsked` : depuis
   Réglages, l'écran de connexion demandé pour ce chargement seulement ; recharger revient à l'espace sans compte. */
const LOCAL_KEY = "selene-sans-compte";
let authAsked = false;
export const localOnly = () => { try { return platform.storage.get(LOCAL_KEY) === "1"; } catch { return false; } };
/* L'écran de connexion à la place de l'app : version hébergée, sans session, sans le choix « sans compte » (ou avec,
   quand on vient de demander à se connecter). */
export const authGate = () => authReady() && !authSession && (!localOnly() || authAsked);
/* Longueur minimale d'un nouveau mot de passe, à régler aussi dans Supabase (Authentication → Sign In / Providers →
   Email → Minimum password length) : c'est le serveur qui fait foi. La connexion n'impose rien : un compte plus ancien,
   au mot de passe plus court, entre toujours, et Selene lui propose d'en changer. */
export const PW_MIN = 10;
const pwHint = () => trn(PW_MIN, "{0} caractère au moins. Une courte phrase fait un bon mot de passe, facile à retenir.", "{0} caractères au moins. Une courte phrase fait un bon mot de passe, facile à retenir.");

const AUTH_KEY = "selene-auth-session";
export let authSession = null, authMode = "signin", authBusy = false, authRefreshTimer = null;
/* Le message sous le formulaire (une erreur, ou une confirmation : ok) et l'adresse tapée : gardés ici, puisque chaque
   rendu redessine l'écran de connexion. */
let authNote = { text: "", ok: false }, authEmail = "";
/* Les inscriptions : ouvertes tant que le serveur ne dit pas le contraire (GET /settings, public : disable_signup). Une
   fois fermées (Authentication → Sign In / Providers), Selene ne propose plus de créer un compte : on y entre par
   invitation. Demandé une fois, quand l'écran de connexion s'affiche après le démarrage. */
let authSignupOpen = true, authSignupAsked = false, authBooted = false;
async function authAskSignup() {
  authSignupAsked = true;
  try {
    const open = !(await authApi("/settings")).disable_signup;
    if (open === authSignupOpen) return;
    authSignupOpen = open;
    if (!open && authMode === "signup") authMode = "signin";
    if (!authSession) render();
  } catch {} // hors ligne, ou serveur ancien : on garde le bouton, et le refus du serveur le dira
}
const authSay = (text, ok = false) => { authNote = { text, ok }; };
export const authToggleMode = () => { authMode = authMode === "signup" ? "signin" : "signup"; authSay(""); };
/* Le lien d'un e-mail de Supabase (mot de passe oublié : type=recovery ; invitation : type=invite) ramène ici avec, après
   le #, un jeton qui ouvre la session le temps de choisir un mot de passe, ou l'erreur d'un lien expiré. On le lit avant
   le premier rendu et on l'efface aussitôt de l'adresse (ni l'historique ni un favori ne doivent le garder) ; il ne vit
   qu'en mémoire. Le texte d'erreur du lien n'est jamais affiché : n'importe qui peut fabriquer un lien. */
let authLink = null, authLinkBad = false;
function takeAuthLink() {
  try {
    const h = new window.URLSearchParams(location.hash.slice(1)), type = h.get("type");
    if (!h.get("access_token") && !h.get("error_code") && !h.get("error")) return;
    if (h.get("access_token") && (type === "recovery" || type === "invite")) {
      authLink = { type, access_token: h.get("access_token"), refresh_token: h.get("refresh_token") || "", expires_in: +h.get("expires_in") || 3600 };
      authMode = "reset";
    } else if (!h.get("access_token")) authLinkBad = true;
    window.history.replaceState(null, "", location.pathname + location.search + "#accueil");
  } catch {}
}
if (authReady()) takeAuthLink();
/* « Essayer sans compte », depuis la page de présentation (essai.html) : index.html#sans-compte entre directement dans
   l'app sans compte, sans repasser par l'écran d'entrée. Sans effet si une session est gardée sur cet appareil. */
function takeLocalLink() {
  try {
    if (location.hash !== "#sans-compte") return;
    if (!authLoad()) platform.storage.set(LOCAL_KEY, "1");
    window.history.replaceState(null, "", location.pathname + location.search + "#accueil");
  } catch {}
}
if (authReady()) takeLocalLink();

function authLoad() {
  try { const v = platform.secrets.get(AUTH_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function authPersist(s) {
  authSession = s;
  try { if (s) platform.secrets.set(AUTH_KEY, JSON.stringify(s)); else platform.secrets.remove(AUTH_KEY); } catch {}
}
const LAST_UID_KEY = "selene-auth-last-uid";
/* Déconnexion ou changement de compte : rien de la personne précédente ne doit rester sur l'appareil —
   ni ses données, ni sa conversation avec l'assistant, ni sa clé API (facturée à elle). */
const PERSONAL_KEYS = ["selene-chat", "selene-recent", "selene-dehors", "selene-mb-seen", "selene-radar", "selene-ics", "selene-zotero", "selene-cites", "selene-passeur-acces"]; // selene-recent : les derniers espaces ouverts ; puis ce que le dehors a apporté
const PERSONAL_SECRETS = platform.secretKeys.filter(k => k !== AUTH_KEY); // platform.secrets (la session a son propre sort)
/* `erase` : une déconnexion voulue ou une suppression de compte efface aussi ce qui n'existait que sur cet appareil (après
   la garde de la déconnexion) ; un changement de compte le met de côté pour son propriétaire (localSwitch, déjà fait). */
function authResetLocal(erase = true) {
  if (erase) localErase();
  board.reset({ updatedAt: 0, tasks: [] });
  site.reset(siteSeed());
  for (const k of PERSONAL_KEYS) platform.storage.remove(k);
  for (const k of PERSONAL_SECRETS) platform.secrets.remove(k);
  for (const k of platform.storage.keys()) if (k.startsWith(DRAFT_PREFIX)) platform.storage.remove(k); // brouillons
}
function authTimeout(ms = 10000) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }
async function authApi(path, opts = {}) {
  let res;
  try { res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, { ...opts, signal: authTimeout(), headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, ...opts.headers } }); }
  catch { throw new Error(tr`Impossible de joindre le serveur. Vérifie ta connexion.`); } // pas de .status : panne réseau
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error_code === "weak_password" ? weakText(body) : body.msg || body.error_description || body.error || tr`Erreur d'authentification.`);
    err.status = res.status; err.code = body.error_code || "";
    throw err;
  }
  return body;
}
/* Un mot de passe que le serveur refuse (weak_password) : la raison, en français, avec la longueur qu'il demande. */
function weakText(body) {
  const why = (body.weak_password || {}).reasons || [], n = +(String(body.msg || "").match(/at least (\d+) characters/) || [])[1] || PW_MIN;
  return why.includes("pwned") ? tr`Ce mot de passe figure dans des fuites de données connues : choisis-en un autre.`
    : why.includes("characters") ? tr`Le serveur demande des caractères de plusieurs sortes (minuscules, majuscules, chiffres, symboles).`
    : trn(n, "Mot de passe trop court : {0} caractère au moins.", "Mot de passe trop court : {0} caractères au moins.");
}
function toSession(body) {
  if (!body.access_token) return null;
  const user = { id: body.user.id, email: body.user.email };
  if (body.user.app_metadata?.selene_personnel === true) user.personnel = true;
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (body.expires_in || 3600), user };
}
/* Le compte de l'éditrice : celui dont les métadonnées serveur (app_metadata, que seule la clé serveur écrit, jamais la
   page) portent selene_personnel. Il voit les modules hors de l'offre publique (MODULE_TYPES, personal). La marque se
   pose dans l'éditeur SQL de Supabase (docs/regulation.md) ; une session ouverte la reçoit au rafraîchissement suivant. */
export const personalAccount = () => authSession?.user?.personnel === true;
/* Marge > intervalle du minuteur (5 min) : sinon le jeton peut expirer entre deux vérifications. */
const REFRESH_MARGIN_S = 600;
let authRefreshing = null;
export function authRefreshIfNeeded() {
  if (!authSession) return Promise.resolve(null);
  if (authSession.expires_at - Math.floor(Date.now() / 1000) > REFRESH_MARGIN_S) return Promise.resolve(authSession);
  // Le refresh token est à usage unique (rotation) : deux appels simultanés = le second est refusé.
  if (!authRefreshing) authRefreshing = authRefreshNow().finally(() => { authRefreshing = null; });
  return authRefreshing;
}
async function authRefreshNow() {
  try {
    const body = await authApi("/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: authSession.refresh_token }) });
    const s = toSession(body);
    authPersist(s);
    return s;
  } catch (e) {
    // Seul un refus explicite du serveur (jeton de rafraîchissement révoqué/invalide) met fin à la session.
    // Réseau coupé, délai dépassé, 5xx : on garde la session et l'app continue en local.
    if (e.status === 400 || e.status === 401) { authPersist(null); return null; }
    return authSession;
  }
}

/* Un refus d'écriture. Trop volumineux : la passerelle (413) ou la contrainte de taille de app_state (code Postgres
   23514, supabase/schema.sql). Le store le dit à part : sinon, « non synchronisé » sans fin, et sans raison. */
async function writeError(res) {
  const j = await res.json().catch(() => ({}));
  return Object.assign(new Error(tr`Écriture Supabase impossible.`), { tooBig: res.status === 413 || j.code === "23514" });
}
const supabaseDb = {
  doc(path) {
    const col = path === "board/state" ? "board" : "site", table = `${SUPABASE_URL}/rest/v1/app_state`;
    const headers = extra => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authSession.access_token}`, ...extra });
    return {
      async get() {
        const res = await fetch(`${table}?user_id=eq.${authSession.user.id}&select=${col}`, { signal: authTimeout(), headers: headers() });
        if (!res.ok) throw new Error(tr`Lecture Supabase impossible.`);
        const rows = await res.json();
        const v = rows[0] && rows[0][col];
        return { exists: !!(v && Object.keys(v).length), data: () => v };
      },
      /* Écriture conditionnelle (compare-and-swap) : le PATCH ne touche la ligne que si le champ
         updatedAt stocké dans la colonne JSON vaut encore `expected` (ce qu'on a lu). 0 ligne
         modifiée = quelqu'un a écrit entre-temps → false, le store relit et refusionne. */
      async replace(value, expected, { keepalive = false } = {}) {
        const uid = authSession.user.id;
        const guard = expected == null ? "is.null" : `eq.${expected}`;
        const patch = async () => {
          const res = await fetch(`${table}?user_id=eq.${uid}&${col}->>updatedAt=${guard}&select=user_id`, {
            method: "PATCH", keepalive, signal: keepalive ? undefined : authTimeout(),
            headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
            body: JSON.stringify({ [col]: value, updated_at: new Date().toISOString() })
          });
          if (!res.ok) throw await writeError(res);
          return (await res.json()).length > 0;
        };
        if (await patch()) return true;
        if (keepalive) return false;
        // Aucune ligne touchée : conflit… ou compte tout neuf dont la ligne n'existe pas encore.
        // On la crée vide (sans rien écraser si elle existe : ignore-duplicates), puis on retente une fois.
        const ins = await fetch(table, { method: "POST", signal: authTimeout(),
          headers: headers({ "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }),
          body: JSON.stringify([{ user_id: uid }]) });
        if (!ins.ok) throw await writeError(ins);
        return patch();
      },
      /* La date de la dernière écriture, seule : quelques octets au lieu du document (PostgREST lit le champ JSON). */
      async stamp() {
        const res = await fetch(`${table}?user_id=eq.${authSession.user.id}&select=u:${col}->>updatedAt`, { signal: authTimeout(), headers: headers() });
        if (!res.ok) throw new Error(tr`Lecture Supabase impossible.`);
        const rows = await res.json();
        return rows[0] && rows[0].u != null ? String(rows[0].u) : null;
      },
      /* Toutes les 30 s, page visible. `known()` : la date de la dernière version commune avec le serveur, si l'appareil
         n'a rien à envoyer. Le serveur a la même : rien n'a bougé, le document n'est pas relu. Sinon, ou sans date
         connue, on relit tout et le store fusionne (et renvoie ce qui attendait). */
      onSnapshot(cb, errCb, known = () => null) {
        const timer = setInterval(async () => {
          if (document.visibilityState !== "visible" || !authSession) return;
          try {
            const k = known();
            if (k != null && await this.stamp() === String(k)) return;
            cb(await this.get());
          } catch (e) { errCb && errCb(e); }
        }, 30000);
        return () => clearInterval(timer);
      }
    };
  }
};
async function authConnectStores() {
  const uid = authSession.user.id;
  let last = null;
  try { last = platform.storage.get(LAST_UID_KEY); } catch {}
  if (last !== uid) localSwitch(uid); // les suivis gardés sur cet appareil suivent leur compte (ADR 27)
  // Sans compte, ce qui a été noté appartient à qui se connecte maintenant (la déconnexion d'avant a vidé l'appareil) :
  // rien n'est effacé, tout rejoint le compte, dont les réglages l'emportent. Sinon, un autre compte : on repart de zéro.
  if (localOnly()) { site.yieldToRemote(); board.yieldToRemote(); platform.storage.remove(LOCAL_KEY); authAsked = false; }
  else if (last && last !== uid) authResetLocal(false);
  platform.storage.set(LAST_UID_KEY, uid);
  // Ne (re)connecte que les stores déconnectés : un store déjà branché a son propre poller, pas de doublon.
  // L'un après l'autre, le site d'abord : le board verse ses tâches dans un site déjà synchronisé (voir absorbBoard).
  for (const st of [site, board]) if (!st.db) await st.connect(supabaseDb);
  if (board.db && site.db) setSaving("");
}

/* Rafraîchit le jeton et, si la synchro était tombée (démarrage hors ligne), la rétablit. */
async function authKeepAlive() {
  if (!authSession) return;
  const s = await authRefreshIfNeeded();
  if (!s) { clearInterval(authRefreshTimer); board.disconnect(); site.disconnect(); render(); return; }
  if (!board.db || !site.db) { await authConnectStores(); render(); }
}
function authScheduleRefresh() {
  clearInterval(authRefreshTimer);
  authRefreshTimer = setInterval(authKeepAlive, 5 * 60 * 1000);
}
// Les minuteurs sont gelés quand un téléphone met l'onglet en veille : on rattrape au retour.
window.addEventListener("online", () => { if (authReady()) authKeepAlive(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && authReady()) authKeepAlive(); });
export async function authBoot() {
  if (!authReady()) return null;
  authBooted = true;
  if (authLink) return null; // le mot de passe d'abord : la session gardée sur cet appareil attend (ou cède la place)
  authSession = authLoad();
  if (authSession) {
    const s = await authRefreshIfNeeded();
    if (s) { await authConnectStores(); authScheduleRefresh(); }
  }
  if (authLinkBad) {
    authLinkBad = false;
    const msg = tr`Ce lien ne fonctionne plus : il a expiré, ou il a déjà servi. Demande-en un autre.`;
    if (authSession) toast(msg); else { authMode = "recover"; authSay(msg); }
  }
  return authSession;
}
let authWeak = false; // le serveur a signalé, à la connexion, un mot de passe plus faible que ses règles actuelles
async function authSignIn(email, password) {
  const body = await authApi("/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  authWeak = !!body.weak_password;
  authPersist(toSession(body));
  await authConnectStores();
  authScheduleRefresh();
}
/* Mot de passe oublié : Supabase envoie un lien, et répond pareil que l'adresse ait un compte ou non (personne ne peut
   s'en servir pour savoir qui est inscrit). Le lien ramène à cette page si elle figure parmi les adresses autorisées du
   projet (Authentication → URL Configuration), sinon à l'adresse du site. Les apps n'en donnent pas : le lien s'ouvre
   dans le navigateur, on y choisit le mot de passe, puis on se connecte dans l'app. */
async function authRecover(email) {
  const back = platform.runtime() === "web" ? `?redirect_to=${encodeURIComponent(location.origin + location.pathname)}` : "";
  try { await authApi(`/recover${back}`, { method: "POST", body: JSON.stringify({ email }) }); }
  catch (e) {
    if (e.status === 429) throw new Error(tr`Trop de demandes : le serveur limite les e-mails qu'il envoie. Réessaie dans un moment.`);
    // Le SMTP intégré de Supabase n'écrit qu'aux membres de l'équipe du projet : il faut en brancher un (docs/compte.md).
    if (e.code === "email_address_not_authorized") throw new Error(tr`Le serveur ne sait pas encore envoyer d'e-mail à cette adresse : son envoi n'est pas configuré. Préviens la personne qui gère Selene.`);
    throw e;
  }
}
/* Le nouveau mot de passe, avec le jeton du lien. Supabase répond par le compte : le jeton devient la session. */
async function authSetPassword(password) {
  const link = authLink;
  let user;
  try { user = await authApi("/user", { method: "PUT", headers: { Authorization: `Bearer ${link.access_token}` }, body: JSON.stringify({ password }) }); }
  catch (e) {
    if (e.code === "same_password") throw new Error(tr`C'est déjà ton mot de passe : choisis-en un autre.`);
    if (e.status !== 401 && e.status !== 403) throw e;
    authLink = null; authMode = link.type === "invite" ? "signin" : "recover";
    throw new Error(link.type === "invite" ? tr`Cette invitation a expiré, ou elle a déjà servi : demande qu'on te la renvoie.` : tr`Ce lien ne fonctionne plus : il a expiré, ou il a déjà servi. Demande-en un autre.`);
  }
  authLink = null; authMode = "signin";
  authPersist(toSession({ ...link, user }));
  await authConnectStores();
  authScheduleRefresh();
}
async function authSignUp(email, password) {
  const body = await authApi("/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  const s = toSession(body);
  if (s) { authPersist(s); await authConnectStores(); authScheduleRefresh(); }
  return !s;
}
export async function authSignOut() {
  // Ce qui n'existe que sur cet appareil (un suivi « Reprendre la main » non synchronisé) : l'exporter, le synchroniser
  // ou l'effacer, au choix, avant que la déconnexion n'efface l'appareil. Annuler ne déconnecte pas.
  if (!await deviceSignOutGuard()) return;
  // Pousser d'abord ce qui attend encore : la déconnexion efface le local. Hors ligne, prévenir avant de perdre.
  for (const st of [board, site]) { clearTimeout(st.timer); st.timer = null; if (st.db) await st.sync(); }
  if ([board, site].some(st => st.unsynced()) &&
      !await ask(tr`Des modifications n'ont pas pu être envoyées (hors ligne ?). Elles seront perdues si tu te déconnectes maintenant. Te déconnecter quand même ?`)) return;
  try { if (authSession) await authApi("/logout", { method: "POST", headers: { Authorization: `Bearer ${authSession.access_token}` } }); } catch {}
  clearInterval(authRefreshTimer);
  board.disconnect(); site.disconnect(); // coupe aussi les pollers de 30 s
  authPersist(null);
  authResetLocal();
  render();
}
/* Supprimer le compte (docs/compte.md) : la fonction serveur « compte » efface les données du compte, sa clé
   d'assistant, puis le compte lui-même ; ensuite, comme une déconnexion, l'appareil est vidé. Rien n'est poussé avant :
   ce qui attend encore n'a plus nulle part où aller. */
export async function authDeleteAccount() {
  const s = await authRefreshIfNeeded(); if (!s) throw new Error(tr`Session expirée : reconnecte-toi, puis recommence.`);
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/compte`, { method: "POST", signal: authTimeout(20000),
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}` },
      body: JSON.stringify({ action: "supprimer", confirmation: "supprimer" }) });
  } catch { throw new Error(tr`Impossible de joindre le serveur. Vérifie ta connexion.`); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error(tr`La suppression n'est pas encore installée sur le serveur (docs/compte.md).`);
  if (!r.ok || !j.supprime) throw serverError(j, tr`erreur ${r.status}`);
  clearInterval(authRefreshTimer);
  for (const st of [board, site]) { clearTimeout(st.timer); st.timer = null; }
  board.disconnect(); site.disconnect();
  authPersist(null);
  authResetLocal();
  render();
}
async function authSubmit() {
  if (authBusy) return;
  const field = id => { const el = $(id); return el ? el.value : ""; };
  const email = field("#authEmail").trim(), pw = field("#authPw");
  if (email) authEmail = email;
  authBusy = true; authSay("");
  try {
    if (authMode === "recover") {
      await authRecover(email);
      authSay(platform.runtime() === "web" ? tr`Si un compte existe à cette adresse, un e-mail vient de partir : son lien te ramène ici pour choisir un nouveau mot de passe. Regarde aussi dans les indésirables.`
        : tr`Si un compte existe à cette adresse, un e-mail vient de partir. Son lien s'ouvre dans ton navigateur : choisis-y ton nouveau mot de passe, puis reviens te connecter ici. Regarde aussi dans les indésirables.`, true);
    } else if (authMode === "reset") {
      if (pw !== field("#authPw2")) throw new Error(tr`Les deux mots de passe ne sont pas identiques.`);
      await authSetPassword(pw);
      toast(tr`Mot de passe enregistré.`);
    } else if (authMode === "signup") {
      const needsConfirm = await authSignUp(email, pw);
      if (needsConfirm) authSay(tr`Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.`, true);
    } else {
      await authSignIn(email, pw);
      if (authWeak) toast(tr`Ton mot de passe est plus court que ce que le serveur demande désormais : change-le dans Réglages, Compte.`);
    }
  } catch (e) {
    if (e.code === "signup_disabled") { authSignupOpen = false; authMode = "signin"; }
    authSay(e.code === "signup_disabled" ? tr`Les inscriptions sont fermées : Selene n'ouvre de compte que sur invitation.` : e.message || tr`Connexion impossible.`);
  }
  authBusy = false;
  render();
}
export function authView() {
  if (authBooted && !authSignupAsked) authAskSignup();
  const note = `<p class="hint" id="authErr" data-status style="margin:0${authNote.text ? `;color:var(${authNote.ok ? "--ok" : "--alarm"})` : ""}">${esc(authNote.text)}</p>`;
  const email = `<label>${tr`E-mail`}<input type="email" id="authEmail" required autocomplete="email" value="${esc(authEmail)}"></label>`;
  const form = (intro, fields, buttons) => `<p class="hint">${intro}</p>
    <form id="authForm" style="display:grid;gap:12px">${fields}<div class="row">${buttons}</div>${note}</form>`;
  const page = (title, intro, fields, buttons) => `<div class="auth"><div class="auth-form"><h2>${title}</h2>${form(intro, fields, buttons)}</div></div>`;
  if (authMode === "reset") return page(authLink && authLink.type === "invite" ? tr`Bienvenue` : tr`Nouveau mot de passe`, authLink && authLink.type === "invite" ? tr`Bienvenue. Choisis le mot de passe de ton compte.` : tr`Choisis un nouveau mot de passe.`,
    `<label>${tr`Nouveau mot de passe`}<input type="password" id="authPw" required minlength="${PW_MIN}" autocomplete="new-password"></label>
      <label>${tr`Le même, une seconde fois`}<input type="password" id="authPw2" required minlength="${PW_MIN}" autocomplete="new-password"></label>
      <p class="hint" style="margin:0">${pwHint()}</p>`,
    `<button class="btn acc" type="submit">${tr`Enregistrer et me connecter`}</button><button class="btn ghost" type="button" data-act="auth-back">${trp("formulaire", "Annuler")}</button>`);
  if (authMode === "recover") return page(tr`Mot de passe oublié`, tr`Indique l'adresse de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.`, email,
    `<button class="btn acc" type="submit">${tr`Envoyer le lien`}</button><button class="btn ghost" type="button" data-act="auth-back">${tr`Revenir à la connexion`}</button>`);
  // Connexion et inscription : d'abord ce que fait Selene, et de quoi commencer sans rien créer ; le compte ensuite.
  const promise = `<div class="auth-promise"><h2>${tr`Garde tes fragments, tes sources et tes hypothèses reliés.`}</h2>
    <p class="lead">${tr`Et retrouve ce que tu avais oublié, jusqu'au dernier chapitre.`}</p>
    <ul>
      <li>${tr`Un compteur de mots, des chapitres, des fragments datés`}</li>
      <li>${tr`Des sources complétées depuis un lien ou un DOI, reliées à ce qu'elles documentent`}</li>
      <li>${tr`Ni publicité ni traceur : tout vit d'abord sur ton appareil`}</li>
    </ul>
    <button class="btn acc" type="button" data-act="auth-local">${localOnly() ? tr`Revenir à Selene sans compte` : tr`Commencer sans compte`}</button>
    <p class="hint">${tr`Rien à créer : tout reste sur cet appareil. Un compte, plus tard, le retrouve sur tes autres appareils, avec ce que tu auras noté.`}</p></div>`;
  return `<div class="auth two-col">${promise}<div class="auth-form"><h3>${authMode === "signup" ? tr`Créer un compte` : tr`J'ai déjà un compte`}</h3>${form(authMode === "signup" ? tr`Crée ton compte pour retrouver tes données sur n'importe quel appareil.` : authSignupOpen ? tr`Connecte-toi pour retrouver tes données.` : tr`Connecte-toi pour retrouver tes données. Selene n'ouvre de compte que sur invitation.`,
    `${email}
      <label>${tr`Mot de passe`}<input type="password" id="authPw" required ${authMode === "signup" ? `minlength="${PW_MIN}" autocomplete="new-password"` : `autocomplete="current-password"`}></label>
      ${authMode === "signup" ? `<p class="hint" style="margin:0">${pwHint()}</p>` : ""}`,
    `<button class="btn solid" type="submit">${authMode === "signup" ? tr`Créer le compte` : tr`Se connecter`}</button>
      ${authSignupOpen || authMode === "signup" ? `<button class="btn ghost" type="button" data-act="auth-switch">${authMode === "signup" ? tr`J'ai déjà un compte` : tr`Créer un compte`}</button>` : ""}
      ${authMode === "signin" ? `<button class="btn ghost" type="button" data-act="auth-forgot">${tr`Mot de passe oublié ?`}</button>` : ""}`)}</div></div>`;
}
/* Réglages → Compte, sans compte : ce que ça veut dire, et la porte vers un compte. */
export function localAccountHTML() {
  return `<p class="hint">${tr`Sans compte : tout reste sur cet appareil, et rien de ce que tu écris ne part ailleurs. Effacer les données du navigateur, ou désinstaller l'app, efface tout : exporte une sauvegarde de temps en temps. Un compte retrouve ton espace sur tes autres appareils ; ce que tu as noté ici le rejoint.`}</p>
    <button class="btn" data-act="auth-open">${tr`Créer un compte ou me connecter`}</button>`;
}
/* Réglages → Compte : changer de mot de passe. Le mot de passe actuel est toujours demandé, et vérifié par une connexion
   fraîche (POST /token) : un appareil laissé ouvert ne suffit pas à le changer, et une session de moins de 24 heures
   passe l'option « Secure password change » du serveur. Il part aussi avec la demande (current_password), pour
   l'option « Require current password when updating ». La session fraîche remplace l'ancienne. */
export function passwordSettingsHTML() {
  return `<details id="auth-pw"${authWeak ? " open" : ""}><summary class="hint">${tr`Changer mon mot de passe`}</summary>
    ${authWeak ? `<p class="hint" style="margin:8px 0 0;color:var(--warn)">${tr`Ton mot de passe est plus court que ce que le serveur demande désormais : choisis-en un nouveau.`}</p>` : ""}
    <form id="authPwForm" style="display:grid;gap:10px;margin-top:8px;max-width:420px">
      <input type="email" autocomplete="username" value="${esc(authSession.user.email)}" hidden>
      <label>${tr`Mot de passe actuel`}<input type="password" id="authCurPw" required autocomplete="current-password"></label>
      <label>${tr`Nouveau mot de passe`}<input type="password" id="authNewPw" required minlength="${PW_MIN}" autocomplete="new-password"></label>
      <label>${tr`Le même, une seconde fois`}<input type="password" id="authNewPw2" required minlength="${PW_MIN}" autocomplete="new-password"></label>
      <p class="hint" style="margin:0">${pwHint()}</p>
      <div class="row"><button class="btn" type="submit">${tr`Changer le mot de passe`}</button></div>
    </form></details>`;
}
async function authChangePassword() {
  const val = id => ($(id) || {}).value || "", cur = val("#authCurPw"), pw = val("#authNewPw"), btn = $("#authPwForm button[type=submit]");
  if (pw !== val("#authNewPw2")) return toast(tr`Les deux mots de passe ne sont pas identiques.`);
  if (btn) btn.disabled = true;
  try {
    let fresh;
    try { fresh = await authApi("/token?grant_type=password", { method: "POST", body: JSON.stringify({ email: authSession.user.email, password: cur }) }); }
    catch (e) { throw e.code === "invalid_credentials" || e.status === 400 ? new Error(tr`Le mot de passe actuel n'est pas le bon.`) : e; }
    authPersist(toSession(fresh));
    await authApi("/user", { method: "PUT", headers: { Authorization: `Bearer ${authSession.access_token}` }, body: JSON.stringify({ password: pw, current_password: cur }) });
    authWeak = false;
    toast(tr`Mot de passe changé.`);
    render();
  } catch (e) {
    toast(e.code === "same_password" ? tr`C'est déjà ton mot de passe : choisis-en un autre.` : e.message || tr`Mot de passe inchangé.`);
    if (btn) btn.disabled = false;
  }
}
document.addEventListener("submit", e => {
  if (e.target.id === "authForm") { e.preventDefault(); authSubmit(); }
  else if (e.target.id === "authPwForm") { e.preventDefault(); authChangePassword(); }
});
const keepEmail = () => { const el = $("#authEmail"); if (el && el.value.trim()) authEmail = el.value.trim(); };
CLICK["auth-switch"] = () => { keepEmail(); authToggleMode(); render(); };
CLICK["auth-forgot"] = () => { keepEmail(); authMode = "recover"; authSay(""); render(); const el = $("#authEmail"); if (el) el.focus(); };
/* Revenir à la connexion ; depuis le nouveau mot de passe, le lien est abandonné et la session gardée reprend, s'il y en a une. */
CLICK["auth-back"] = async () => {
  keepEmail(); authSay(""); authMode = "signin";
  if (authLink) { authLink = null; try { await authBoot(); } catch {} }
  render();
};
CLICK["auth-out"] = () => authSignOut();
CLICK["auth-local"] = () => { try { platform.storage.set(LOCAL_KEY, "1"); } catch {} authAsked = false; authSay(""); location.hash = "#accueil"; render(); };
CLICK["auth-open"] = () => { authAsked = true; authMode = authSignupOpen ? "signup" : "signin"; authSay(""); render(); window.scrollTo(0, 0); };
/* Le mot à taper pour supprimer son compte : celui de la langue de l'interface, ou « supprimer » dans toutes. Le serveur,
   lui, reçoit toujours la constante du protocole (confirmation: "supprimer"), qui ne se traduit pas. */
export const deleteWord = () => trp("confirmation", "supprimer");
CLICK["auth-delete"] = async el => {
  const inp = $("#authDelIn"), typed = inp ? inp.value.trim().toLowerCase() : "";
  if (typed !== deleteWord().toLowerCase() && typed !== "supprimer") { toast(tr`Tape « ${deleteWord()} » pour confirmer.`); if (inp) inp.focus(); return; }
  if (!await ask(tr`Supprimer ton compte et toutes ses données, sur le serveur et sur cet appareil ? C'est définitif.`)) return;
  el.disabled = true;
  try { await authDeleteAccount(); toast(tr`Compte supprimé. Il ne reste rien de toi ici, ce qui est plus que la plupart des services peuvent dire.`); }
  catch (e) { el.disabled = false; toast(tr`Compte non supprimé : ${e.message}`); }
};
