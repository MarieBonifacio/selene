/* Commun aux fonctions de Selene (passeur, assistant) : qui appelle, et la réponse JSON avec son en-tête CORS. */

export type Base = { fetch: typeof fetch; env: (nom: string) => string | undefined };

/* Les origines autorisées à appeler (liste séparée par des virgules). Par défaut : le site publié et les apps
   Capacitor (https://localhost sous Android, capacitor://localhost sous iOS : docs/android.md). L'origine n'est
   qu'une première barrière : chaque appel demande de toute façon une session valide. */
export const ORIGINES_PAR_DEFAUT = "https://mariebonifacio.github.io,https://localhost,capacitor://localhost";
export function origines(env: string | undefined): string[] {
  return (env || ORIGINES_PAR_DEFAUT).split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
}

/* Qui appelle : la session est vérifiée auprès de Supabase Auth (valable avec les nouvelles clés comme les
   anciennes), puis gardée une minute en mémoire pour ne pas redemander à chaque appel. */
const vus = new Map<string, { id: string; jusqua: number }>();
export async function compte(m: Base, req: Request): Promise<string | null> {
  const jeton = (req.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1], cle = req.headers.get("apikey") || "";
  if (!jeton || !cle) return null;
  const v = vus.get(jeton);
  if (v && v.jusqua > Date.now()) return v.id;
  const base = m.env("SUPABASE_URL");
  if (!base) return null;
  try {
    const r = await m.fetch(`${base}/auth/v1/user`, { headers: { authorization: `Bearer ${jeton}`, apikey: cle }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const u = await r.json();
    if (typeof u?.id !== "string") return null;
    if (vus.size > 50) vus.clear();
    vus.set(jeton, { id: u.id.toLowerCase(), jusqua: Date.now() + 60_000 });
    return u.id.toLowerCase();
  } catch { return null; }
}

export function reponse(corps: unknown, status: number, origine: string | null): Response {
  const h = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", vary: "Origin" });
  if (origine) h.set("access-control-allow-origin", origine);
  return new Response(JSON.stringify(corps), { status, headers: h });
}

/* L'origine de la requête si elle est autorisée ; et la réponse au pré-vol CORS. */
export function origineDe(req: Request, liste: string[]): string | null {
  const o = (req.headers.get("origin") || "").replace(/\/$/, "");
  return liste.includes(o) ? o : null;
}
export function prevol(origine: string | null): Response {
  if (!origine) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": origine, "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type", "access-control-max-age": "86400", vary: "Origin" } });
}

/* Un débit par compte (au mieux : la mémoire d'une instance) : `n` appels par fenêtre de `ms`. */
export function limiteur(n: number, ms: number) {
  const debit = new Map<string, number[]>();
  return (id: string): boolean => {
    const t = Date.now(), l = (debit.get(id) || []).filter(x => t - x < ms);
    l.push(t); debit.set(id, l);
    return l.length > n;
  };
}
