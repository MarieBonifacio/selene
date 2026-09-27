/* ================= comptes (Supabase, build hébergé uniquement) =================
   Inactif tant que SUPABASE_URL/SUPABASE_ANON_KEY ne sont pas renseignées et que
   vendor/supabase.js n'est pas chargé (jamais le cas dans l'artefact claude.ai). */
const SUPABASE_URL = "https://pxnrzrmzritezftefdlj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vC_zBX0TN4jZqi1GRIvo2A_nD2WFW9T";

const sb = (typeof window !== "undefined" && window.supabase && !SUPABASE_URL.includes("YOUR-PROJECT-REF"))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
const authReady = () => !!sb;
let authSession = null, authMode = "signin", authBusy = false;

function authResetLocal() {
  board.data = { updatedAt: 0, tasks: [] };
  site.data = siteSeed();
  try { localStorage.removeItem(board.key); localStorage.removeItem(site.key); } catch {}
}
function authConnectStores() {
  return Promise.all([board.connect(supabaseDoc("board/state")), site.connect(supabaseDoc("site/state"))]);
}
async function authBoot() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  authSession = data.session || null;
  if (!authSession) authResetLocal();
  sb.auth.onAuthStateChange((event, session) => {
    authSession = session;
    if (event === "SIGNED_IN" && session) authConnectStores().then(render);
    else if (event === "SIGNED_OUT") { board.db = null; site.db = null; authResetLocal(); render(); }
    else render();
  });
  return authSession;
}

function supabaseDoc(path) {
  const col = path === "board/state" ? "board" : "site", userId = authSession && authSession.user && authSession.user.id;
  return {
    async get() {
      const { data, error } = await sb.from("app_state").select(col).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      const v = data && data[col];
      return { exists: !!(v && Object.keys(v).length), data: () => v };
    },
    async set(value) {
      const { error } = await sb.from("app_state").upsert({ user_id: userId, [col]: value, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSnapshot(cb, errCb) {
      sb.channel(`app_state-${col}-${userId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_state", filter: `user_id=eq.${userId}` }, payload => cb({ exists: true, data: () => payload.new[col] }))
        .subscribe(status => { if (status === "CHANNEL_ERROR" && errCb) errCb(new Error("realtime indisponible")); });
    }
  };
}

async function authSubmit() {
  const email = $("#authEmail").value.trim(), pw = $("#authPw").value, err = $("#authErr");
  if (authBusy) return;
  authBusy = true; err.textContent = "";
  try {
    const { error } = authMode === "signup" ? await sb.auth.signUp({ email, password: pw }) : await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    if (authMode === "signup") { err.style.color = "var(--ok)"; err.textContent = "Compte créé. Vérifie ta boîte mail si la confirmation est activée, sinon tu es déjà connecté(e)."; }
  } catch (e) { err.style.color = "var(--alarm)"; err.textContent = e.message || "Connexion impossible."; }
  authBusy = false;
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
