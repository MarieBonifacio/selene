/* ================= comptes (Supabase, build hébergé uniquement) =================
   Parle directement aux API REST de Supabase (Auth + PostgREST) via fetch,
   sans client JS vendorisé — plus simple à vérifier ligne par ligne qu'un
   gros bundle recopié à la main. Inactif tant que SUPABASE_URL/SUPABASE_ANON_KEY
   ne sont pas renseignées, donc jamais actif dans l'artefact claude.ai. */
const SUPABASE_URL = "https://pxnrzrmzritezftefdlj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vC_zBX0TN4jZqi1GRIvo2A_nD2WFW9T";
const authReady = () => hosted() && !SUPABASE_URL.includes("YOUR-PROJECT-REF");

const AUTH_KEY = "selene-auth-session";
let authSession = null, authMode = "signin", authBusy = false, authRefreshTimer = null;

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
const PERSONAL_KEYS = ["selene-chat", "selene-recent", "selene-dehors", "selene-mb-seen", "selene-radar", "selene-ics", "selene-zotero", "selene-cites"]; // selene-recent : les derniers espaces ouverts ; puis ce que le dehors a apporté
const PERSONAL_SECRETS = ["selene-api-key", "selene-openalex-key", "selene-ics-url", "selene-zotero-key"]; // platform.secrets
function authResetLocal() {
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
  catch { throw new Error("Impossible de joindre le serveur. Vérifie ta connexion."); } // pas de .status : panne réseau
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.msg || body.error_description || body.error || "Erreur d'authentification.");
    err.status = res.status;
    throw err;
  }
  return body;
}
function toSession(body) {
  if (!body.access_token) return null;
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (body.expires_in || 3600), user: { id: body.user.id, email: body.user.email } };
}
/* Marge > intervalle du minuteur (5 min) : sinon le jeton peut expirer entre deux vérifications. */
const REFRESH_MARGIN_S = 600;
let authRefreshing = null;
function authRefreshIfNeeded() {
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

const supabaseDb = {
  doc(path) {
    const col = path === "board/state" ? "board" : "site", table = `${SUPABASE_URL}/rest/v1/app_state`;
    const headers = extra => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authSession.access_token}`, ...extra });
    return {
      async get() {
        const res = await fetch(`${table}?user_id=eq.${authSession.user.id}&select=${col}`, { signal: authTimeout(), headers: headers() });
        if (!res.ok) throw new Error("Lecture Supabase impossible.");
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
          if (!res.ok) throw new Error("Écriture Supabase impossible.");
          return (await res.json()).length > 0;
        };
        if (await patch()) return true;
        if (keepalive) return false;
        // Aucune ligne touchée : conflit… ou compte tout neuf dont la ligne n'existe pas encore.
        // On la crée vide (sans rien écraser si elle existe : ignore-duplicates), puis on retente une fois.
        const ins = await fetch(table, { method: "POST", signal: authTimeout(),
          headers: headers({ "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }),
          body: JSON.stringify([{ user_id: uid }]) });
        if (!ins.ok) throw new Error("Écriture Supabase impossible.");
        return patch();
      },
      onSnapshot(cb, errCb) {
        const timer = setInterval(async () => {
          if (document.visibilityState !== "visible" || !authSession) return;
          try { cb(await this.get()); } catch (e) { errCb && errCb(e); }
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
  if (last && last !== uid) authResetLocal();
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
async function authBoot() {
  if (!authReady()) return null;
  authSession = authLoad();
  if (authSession) {
    const s = await authRefreshIfNeeded();
    if (s) { await authConnectStores(); authScheduleRefresh(); }
  }
  return authSession;
}
async function authSignIn(email, password) {
  const body = await authApi("/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  authPersist(toSession(body));
  await authConnectStores();
  authScheduleRefresh();
}
async function authSignUp(email, password) {
  const body = await authApi("/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  const s = toSession(body);
  if (s) { authPersist(s); await authConnectStores(); authScheduleRefresh(); }
  return !s;
}
async function authSignOut() {
  // Pousser d'abord ce qui attend encore : la déconnexion efface le local. Hors ligne, prévenir avant de perdre.
  for (const st of [board, site]) { clearTimeout(st.timer); st.timer = null; if (st.db) await st.sync(); }
  if ([board, site].some(st => st.unsynced()) &&
      !await ask("Des modifications n'ont pas pu être envoyées (hors ligne ?). Elles seront perdues si tu te déconnectes maintenant. Te déconnecter quand même ?")) return;
  try { if (authSession) await authApi("/logout", { method: "POST", headers: { Authorization: `Bearer ${authSession.access_token}` } }); } catch {}
  clearInterval(authRefreshTimer);
  board.disconnect(); site.disconnect(); // coupe aussi les pollers de 30 s
  authPersist(null);
  authResetLocal();
  render();
}
async function authSubmit() {
  const email = $("#authEmail").value.trim(), pw = $("#authPw").value, err = $("#authErr");
  if (authBusy) return;
  authBusy = true; err.style.color = "var(--alarm)"; err.textContent = "";
  try {
    if (authMode === "signup") {
      const needsConfirm = await authSignUp(email, pw);
      if (needsConfirm) { err.style.color = "var(--ok)"; err.textContent = "Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi."; }
    } else await authSignIn(email, pw);
  } catch (e) { err.textContent = e.message || "Connexion impossible."; }
  authBusy = false;
  render();
}
function authView() {
  return `<div class="wrap" style="max-width:420px;margin:60px auto 0"><h2>Selene</h2>
    <p class="hint">${authMode === "signup" ? "Crée ton compte pour retrouver tes données sur n'importe quel appareil." : "Connecte-toi pour retrouver tes données."}</p>
    <form id="authForm" style="display:grid;gap:12px">
      <label>E-mail<input type="email" id="authEmail" required autocomplete="email"></label>
      <label>Mot de passe<input type="password" id="authPw" required minlength="6" autocomplete="${authMode === "signup" ? "new-password" : "current-password"}"></label>
      <div class="row"><button class="btn acc" type="submit">${authMode === "signup" ? "Créer le compte" : "Se connecter"}</button>
      <button class="btn ghost" type="button" data-act="auth-switch">${authMode === "signup" ? "J'ai déjà un compte" : "Créer un compte"}</button></div>
      <p class="hint" id="authErr" style="margin:0"></p>
    </form></div>`;
}
document.addEventListener("submit", e => { if (e.target.id === "authForm") { e.preventDefault(); authSubmit(); } });
