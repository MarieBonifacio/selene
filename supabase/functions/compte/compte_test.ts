/* La suppression de compte de bout en bout, avec de faux Supabase Auth et PostgREST : qui peut supprimer quoi, et
   dans quel ordre. */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { compteFn, type Monde, TABLES } from "./compte.ts";

const MOI = "0b8f0c2e-1111-2222-3333-444455556666", ELLE = "9f9f9f9f-1111-2222-3333-444455556666";
const ORIGINE = "https://mariebonifacio.github.io";
const ENV = { SUPABASE_URL: "https://projet.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service" };

function monde(env: Record<string, string> = ENV, { panne = "" } = {}) {
  const comptes = new Set([MOI, ELLE]), lignes = new Map(TABLES.map(t => [t, new Set([MOI, ELLE])])), journal: string[] = [];
  const m: Monde = {
    env: n => env[n],
    fetch: async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString()), h = new Headers(init.headers);
      if (url.pathname === "/auth/v1/user") {
        const tok = h.get("authorization");
        const id = tok === "Bearer jeton-moi" ? MOI : tok === "Bearer jeton-elle" ? ELLE : null;
        return id && comptes.has(id) ? Response.json({ id }) : new Response("{}", { status: 401 });
      }
      if (h.get("apikey") !== "service" || h.has("authorization")) return new Response("{}", { status: 401 });
      const table = url.pathname.match(/^\/rest\/v1\/(\w+)$/)?.[1];
      if (table && init.method === "DELETE") {
        if (panne === table) return new Response("{}", { status: 500 });
        const id = (url.searchParams.get("user_id") || "").replace(/^eq\./, "");
        lignes.get(table)?.delete(id); journal.push(`${table} ${id}`);
        return new Response(null, { status: 204 });
      }
      const u = url.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/)?.[1];
      if (u && init.method === "DELETE") {
        if (panne === "auth") return new Response("{}", { status: 500 });
        if (!comptes.delete(decodeURIComponent(u))) return new Response("{}", { status: 404 });
        journal.push(`auth ${u}`);
        return Response.json({});
      }
      return new Response("introuvable", { status: 404 });
    }
  };
  return { m, comptes, lignes, journal };
}
const appel = (m: Monde, corps: unknown, { jeton = "jeton-moi", origine = ORIGINE } = {}) =>
  compteFn(m)(new Request("https://f/compte", { method: "POST", body: JSON.stringify(corps),
    headers: { origin: origine, apikey: "publique", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) } }));

Deno.test("supprimer : les données puis le compte, seulement les siens", async () => {
  const w = monde();
  const r = await appel(w.m, { action: "supprimer", confirmation: "supprimer" });
  assertEquals(r.status, 200); assertEquals(await r.json(), { supprime: true });
  assertEquals(w.journal, [...TABLES.map(t => `${t} ${MOI}`), `auth ${MOI}`], "les données d'abord, le compte en dernier");
  assert(!w.comptes.has(MOI) && w.comptes.has(ELLE), "l'autre compte reste");
  for (const t of TABLES) assert(!w.lignes.get(t)!.has(MOI) && w.lignes.get(t)!.has(ELLE));
  assertEquals(r.headers.get("access-control-allow-origin"), ORIGINE);
});

Deno.test("refus : sans session, origine inconnue, sans confirmation, action inconnue, non configurée", async () => {
  const w = monde();
  assertEquals((await appel(w.m, { action: "supprimer", confirmation: "supprimer" }, { jeton: "" })).status, 401);
  assertEquals((await appel(w.m, { action: "supprimer", confirmation: "supprimer" }, { jeton: "faux" })).status, 401);
  assertEquals((await appel(w.m, { action: "supprimer", confirmation: "supprimer" }, { origine: "https://ailleurs.example" })).status, 403);
  assertEquals((await appel(w.m, { action: "supprimer" }, { jeton: "jeton-elle" })).status, 400);
  assertEquals((await appel(w.m, { action: "lister" }, { jeton: "jeton-elle" })).status, 400);
  assertEquals((await appel(monde({ SUPABASE_URL: "https://projet.supabase.co" }).m, { action: "supprimer", confirmation: "supprimer" }, { jeton: "jeton-elle" })).status, 503);
  assertEquals(w.journal, [], "rien d'effacé");
  const pre = await compteFn(w.m)(new Request("https://f/compte", { method: "OPTIONS", headers: { origin: ORIGINE } }));
  assertEquals(pre.status, 204);
});

Deno.test("panne : le compte n'est jamais effacé avant ses données ; un nouvel essai termine", async () => {
  const w = monde(ENV, { panne: "assistant_keys" });
  assertEquals((await appel(w.m, { action: "supprimer", confirmation: "supprimer" }, { jeton: "jeton-elle" })).status, 503);
  assert(w.comptes.has(ELLE), "données pas toutes effacées : le compte reste, on peut réessayer");
  const w2 = monde(ENV, { panne: "auth" });
  const r = await appel(w2.m, { action: "supprimer", confirmation: "supprimer" }, { jeton: "jeton-elle" });
  assertEquals(r.status, 503); assert((await r.json()).erreur.includes("compte non supprimé"));
});
