/* Le test d'isolation entre comptes (npm run isolation ; docs/compte.md, « Vérifier l'isolation entre comptes ») : deux
   comptes de test se connectent à un projet Supabase de préproduction, puis le compte A tente douze lectures ou
   écritures qui ne le regardent pas : la ligne de B, toutes les lignes, la table des clés d'assistant, l'administration
   des comptes, et les mêmes sans session. Chacune doit être refusée, par la base (RLS) ou par Supabase Auth.
   - code 0 : douze refus ;
   - code 1 : une requête au moins a été ACCEPTÉE, ou la ligne de B a changé : une fuite, ne rien publier ;
   - code 2 : impossible de conclure (variable manquante, projet de l'app, connexion, réseau, réponse imprévue).
   Avant les douze, un montage prouve que le test peut échouer : chaque compte crée, modifie et relit sa ligne. Sans
   lui, une table vide ou des droits cassés partout donneraient douze « refus » qui ne prouvent rien.
   Le projet de l'app (SUPABASE_URL de src/app/services/auth.js) est refusé : le test écrit (la date d'une ligne, et
   au pire, si la base fuit, dans celle de B), et ces écritures n'ont rien à faire dans les données de quelqu'un.
   Si la base fuit, la clé d'assistant du compte A (de test) est remplacée par un texte sans valeur.
   Aucun secret n'est affiché : ni mot de passe, ni jeton, ni adresse e-mail. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
export const VARIABLES = ["ISOLATION_URL", "ISOLATION_CLE", "ISOLATION_A_EMAIL", "ISOLATION_A_MOT_DE_PASSE", "ISOLATION_B_EMAIL", "ISOLATION_B_MOT_DE_PASSE"];
// La date écrite par les tentatives de modification : visible au premier coup d'œil si l'une d'elles passe.
export const DATE_TEST = "2000-01-01T00:00:00Z";

/* L'adresse du projet de l'app, lue dans le code (une seule source de vérité). */
export function projetDeLApp() {
  const src = fs.readFileSync(path.join(root, "src/app/services/auth.js"), "utf8");
  return src.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1] || "";
}
export function estProduction(url, appli = projetDeLApp()) {
  try { return !!appli && new URL(url).host === new URL(appli).host; } catch { return false; }
}

/* Une clé secrète (sb_secret_…, ou l'ancienne clé JWT au rôle service_role) passe outre toutes les règles RLS : le test
   crierait à la fuite à tort, et un secret n'a rien à faire dans .env.isolation. Seule la clé publique convient. */
export function estSecrete(cle) {
  const k = String(cle || "");
  if (k.startsWith("sb_secret_")) return true;
  try { return JSON.parse(Buffer.from(k.split(".")[1] || "", "base64url").toString()).role === "service_role"; } catch { return false; }
}

/* Les douze requêtes. `attendu` : "vide" (la base filtre en silence : 200 et une liste vide), "siennes" (seules les
   lignes du compte reviennent) ou "refus" (401 ou 403, code Postgres 42501 : la règle RLS refuse l'écriture).
   Les écritures « refus » demandent return=minimal, comme le ferait un compte malveillant : avec return=representation,
   Postgres applique aussi la règle de lecture à la ligne renvoyée, et ce second refus masquerait une règle d'écriture
   trop large (essayé contre PostgreSQL 16 et PostgREST 12, docs/compte.md). */
export const CONTROLES = [
  { quoi: "lire la ligne de B", attendu: "vide",
    req: c => ({ chemin: `/rest/v1/app_state?select=user_id,updated_at&user_id=eq.${c.b.id}`, jeton: c.a.jeton }) },
  { quoi: "lister toutes les lignes (seule la sienne doit revenir)", attendu: "siennes",
    req: c => ({ chemin: "/rest/v1/app_state?select=user_id", jeton: c.a.jeton }) },
  { quoi: "modifier la ligne de B", attendu: "vide",
    req: c => ({ methode: "PATCH", chemin: `/rest/v1/app_state?user_id=eq.${c.b.id}`, jeton: c.a.jeton, corps: { updated_at: DATE_TEST }, prefer: "return=representation" }) },
  { quoi: "supprimer la ligne de B", attendu: "vide",
    req: c => ({ methode: "DELETE", chemin: `/rest/v1/app_state?user_id=eq.${c.b.id}`, jeton: c.a.jeton, prefer: "return=representation" }) },
  { quoi: "créer une ligne au nom de B", attendu: "refus",
    req: c => ({ methode: "POST", chemin: "/rest/v1/app_state", jeton: c.a.jeton, corps: { user_id: c.b.id }, prefer: "return=minimal" }) },
  { quoi: "écraser la ligne de B par fusion (upsert)", attendu: "refus",
    req: c => ({ methode: "POST", chemin: "/rest/v1/app_state", jeton: c.a.jeton, corps: { user_id: c.b.id, updated_at: DATE_TEST }, prefer: "resolution=merge-duplicates,return=minimal" }) },
  { quoi: "donner sa propre ligne à B", attendu: "refus",
    req: c => ({ methode: "PATCH", chemin: `/rest/v1/app_state?user_id=eq.${c.a.id}`, jeton: c.a.jeton, corps: { user_id: c.b.id }, prefer: "return=minimal" }) },
  { quoi: "lire les clés d'assistant chiffrées", attendu: "vide",
    req: c => ({ chemin: "/rest/v1/assistant_keys?select=user_id", jeton: c.a.jeton }) },
  { quoi: "écrire une clé d'assistant (même la sienne)", attendu: "refus",
    req: c => ({ methode: "POST", chemin: "/rest/v1/assistant_keys", jeton: c.a.jeton, corps: { user_id: c.a.id, chiffre: "isolation", iv: "isolation", indice: "isolation" }, prefer: "resolution=merge-duplicates,return=minimal" }) },
  { quoi: "sans session : lire les lignes", attendu: "vide",
    req: () => ({ chemin: "/rest/v1/app_state?select=user_id" }) },
  { quoi: "sans session : modifier la ligne de A", attendu: "vide",
    req: c => ({ methode: "PATCH", chemin: `/rest/v1/app_state?user_id=eq.${c.a.id}`, corps: { updated_at: DATE_TEST }, prefer: "return=representation" }) },
  { quoi: "lister les comptes (administration de Supabase Auth)", attendu: "refus",
    req: c => ({ chemin: "/auth/v1/admin/users", jeton: c.a.jeton }) }
];

/* Le verdict d'une réponse : "refusée" (attendu), "ACCEPTÉE" (une fuite) ou "douteuse" (rien obtenu, mais pas pour la
   bonne raison : un 409 dit qu'une contrainte a arrêté l'écriture, pas la règle RLS ; un 404, une table absente). */
export function verdict(attendu, r, moi) {
  if (!r.status) return "douteuse";
  if (r.status === 401 || r.status === 403 || r.json?.code === "42501") return "refusée";
  const ok = r.status >= 200 && r.status < 300;
  if (attendu === "refus") return ok ? "ACCEPTÉE" : "douteuse";
  if (!ok || !Array.isArray(r.json)) return "douteuse";
  return r.json.some(l => attendu === "vide" || l?.user_id !== moi) ? "ACCEPTÉE" : "refusée";
}
export function detail(r) {
  if (!r.status) return r.erreur || "pas de réponse";
  const code = r.json && !Array.isArray(r.json) ? r.json.code || r.json.error_code || "" : "";
  const liste = Array.isArray(r.json) ? (r.json.length ? `, ${r.json.length} ligne${r.json.length > 1 ? "s" : ""}` : ", liste vide") : "";
  return `${r.status}${code ? ` ${code}` : ""}${liste}`;
}

/* Une requête au projet ; jamais d'exception : une erreur réseau devient { status: 0, erreur }. */
async function appel(m, { methode = "GET", chemin, jeton, corps, prefer }) {
  const headers = { apikey: m.cle };
  if (jeton) headers.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  try {
    const r = await m.fetch(m.url + chemin, { method: methode, headers, body: corps === undefined ? undefined : JSON.stringify(corps), signal: AbortSignal.timeout(15000) });
    const texte = await r.text();
    let json = null;
    try { json = texte ? JSON.parse(texte) : null; } catch { /* une page d'erreur de la passerelle, pas du JSON */ }
    return { status: r.status, json };
  } catch (e) { return { status: 0, erreur: String(e?.cause?.code || e?.name || e) }; }
}

async function connecter(m, email, motDePasse) {
  const r = await appel(m, { methode: "POST", chemin: "/auth/v1/token?grant_type=password", corps: { email, password: motDePasse } });
  if (r.status !== 200 || !r.json?.access_token || !r.json?.user?.id) return { echec: detail(r) };
  return { id: String(r.json.user.id).toLowerCase(), jeton: r.json.access_token };
}
/* La ligne du compte : créée vide si elle n'existe pas (comme le fait l'app : ON CONFLICT DO NOTHING), marquée d'une
   date propre à ce passage, puis relue. La date prouve que le compte peut écrire chez lui (sans quoi un refus chez
   l'autre ne prouverait rien), et rend toute écriture étrangère visible au contrôle final, même une ligne supprimée puis
   recréée à l'identique. */
async function saLigne(m, compte) {
  const cree = await appel(m, { methode: "POST", chemin: "/rest/v1/app_state", jeton: compte.jeton, corps: { user_id: compte.id }, prefer: "resolution=ignore-duplicates,return=minimal" });
  if (cree.status < 200 || cree.status >= 300) return { echec: `n'a pas de ligne (création ${detail(cree)}) ; vérifier supabase/schema.sql` };
  const date = new Date(Date.now() - Math.floor(Math.random() * 1e6)).toISOString();
  const marque = await appel(m, { methode: "PATCH", chemin: `/rest/v1/app_state?user_id=eq.${compte.id}`, jeton: compte.jeton, corps: { updated_at: date }, prefer: "return=representation" });
  if (marque.status !== 200 || !Array.isArray(marque.json) || marque.json.length !== 1) return { echec: `ne peut pas modifier sa propre ligne (${detail(marque)}) ; un refus chez l'autre ne prouverait rien` };
  const lue = await appel(m, { chemin: `/rest/v1/app_state?select=*&user_id=eq.${compte.id}`, jeton: compte.jeton });
  if (lue.status !== 200 || !Array.isArray(lue.json) || lue.json.length !== 1) return { echec: `ne relit pas sa propre ligne (${detail(lue)})` };
  return { ligne: JSON.stringify(lue.json[0]) };
}

/* Le test complet. `fetch` et `log` remplaçables (les tests). Rend { code, resultats }. */
export async function isoler({ url, cle, a, b, fetch: f = fetch, log = console.log, appli } = {}) {
  const m = { url: String(url || "").replace(/\/+$/, ""), cle, fetch: f };
  const fin = (code, resultats = []) => ({ code, resultats });
  if (estProduction(m.url, appli)) {
    log(`Refusé : ${m.url} est le projet de l'app. Le test écrit dans les lignes qu'il vise ; il tourne sur un projet de préproduction (docs/compte.md).`);
    return fin(2);
  }
  if (estSecrete(cle)) {
    log("Refusé : ISOLATION_CLE est la clé secrète du projet, qui passe outre les règles. Prendre la clé publique (Publishable key, sb_publishable_…).");
    return fin(2);
  }
  log(`Isolation entre comptes : ${m.url}`);

  const c = { a: await connecter(m, a.email, a.motDePasse), b: await connecter(m, b.email, b.motDePasse) };
  for (const k of ["a", "b"]) if (c[k].echec) { log(`  Montage : le compte ${k.toUpperCase()} ne se connecte pas (${c[k].echec}).`); return fin(2); }
  if (c.a.id === c.b.id) { log("  Montage : A et B sont le même compte ; il en faut deux."); return fin(2); }
  const lignes = {};
  for (const k of ["a", "b"]) {
    const l = await saLigne(m, c[k]);
    if (l.echec) { log(`  Montage : le compte ${k.toUpperCase()} ${l.echec}.`); return fin(2); }
    lignes[k] = l.ligne;
  }
  log(`  Montage : A (${c.a.id.slice(0, 8)}…) et B (${c.b.id.slice(0, 8)}…) connectés ; chacun crée, modifie et relit sa ligne.`);

  const resultats = [];
  for (const [i, ctl] of CONTROLES.entries()) {
    const r = await appel(m, ctl.req(c));
    const v = verdict(ctl.attendu, r, c.a.id);
    resultats.push({ n: i + 1, quoi: ctl.quoi, verdict: v, detail: detail(r) });
    log(`  ${v === "refusée" ? "✓" : v === "ACCEPTÉE" ? "✗" : "?"} ${String(i + 1).padStart(2)}. ${ctl.quoi} : ${v} (${detail(r)})`);
  }

  // Le contrôle final : la ligne de B, relue par B, est celle d'avant (une écriture passée sans rien renvoyer se voit ici).
  const apres = await appel(m, { chemin: `/rest/v1/app_state?select=*&user_id=eq.${c.b.id}`, jeton: c.b.jeton });
  const intacte = apres.status === 200 && Array.isArray(apres.json) && apres.json.length === 1 && JSON.stringify(apres.json[0]) === lignes.b;
  log(intacte ? "  Contrôle final : la ligne de B n'a pas changé." : `  ✗ Contrôle final : la ligne de B a changé ou disparu pendant le test (${detail(apres)}).`);

  const n = v => resultats.filter(r => r.verdict === v).length;
  log(`Requêtes : ${resultats.length} ; refusées : ${n("refusée")} ; acceptées : ${n("ACCEPTÉE")} ; douteuses : ${n("douteuse")}.`);
  if (n("ACCEPTÉE") || !intacte) {
    log("Échec : un compte atteint les données d'un autre. Ne rien publier ; comparer les règles RLS du projet à supabase/schema.sql.");
    return fin(1, resultats);
  }
  if (n("douteuse")) { log("Impossible de conclure : relire les réponses marquées « ? » (table absente, contrainte, réseau)."); return fin(2, resultats); }
  return fin(0, resultats);
}

async function main() {
  const manque = VARIABLES.filter(v => !process.env[v]);
  if (manque.length) {
    console.log(`Variables manquantes : ${manque.join(", ")}. Les mettre dans .env.isolation (ignoré par git) ; voir docs/compte.md, « Vérifier l'isolation entre comptes ».`);
    process.exitCode = 2;
    return;
  }
  const e = process.env;
  const { code } = await isoler({ url: e.ISOLATION_URL, cle: e.ISOLATION_CLE,
    a: { email: e.ISOLATION_A_EMAIL, motDePasse: e.ISOLATION_A_MOT_DE_PASSE }, b: { email: e.ISOLATION_B_EMAIL, motDePasse: e.ISOLATION_B_MOT_DE_PASSE } });
  process.exitCode = code;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
