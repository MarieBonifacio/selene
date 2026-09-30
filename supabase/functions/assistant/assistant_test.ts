/* L'assistant de bout en bout, avec de faux Supabase Auth, PostgREST et Anthropic : qui peut l'appeler, ce que devient
   la clé, et ce qui part vers Anthropic. */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { assistant, chiffrer, dechiffrer, MAX_SORTIE, type Monde } from "./assistant.ts";

const MOI = "0b8f0c2e-1111-2222-3333-444455556666", ELLE = "9f9f9f9f-1111-2222-3333-444455556666";
const ORIGINE = "https://mariebonifacio.github.io";
const BONNE = "sk-ant-api03-" + "a".repeat(40) + "wxyz", MAUVAISE = "sk-ant-api03-" + "b".repeat(44);
const SECRET = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)));
const ENV = { SUPABASE_URL: "https://projet.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", ASSISTANT_KEY_SECRET: SECRET };

function monde(env: Record<string, string> = ENV) {
  const base = new Map<string, Record<string, string>>(), vers: { cle: string; corps: Record<string, unknown> }[] = [];
  const m: Monde = {
    env: n => env[n],
    fetch: async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString()), h = new Headers(init.headers);
      if (url.pathname === "/auth/v1/user") {
        const tok = h.get("authorization");
        return tok === "Bearer jeton-moi" ? Response.json({ id: MOI }) : tok === "Bearer jeton-elle" ? Response.json({ id: ELLE }) : new Response("{}", { status: 401 });
      }
      if (url.pathname === "/rest/v1/assistant_keys") {
        if (h.get("apikey") !== "service") return new Response("{}", { status: 401 });
        const id = (url.searchParams.get("user_id") || "").replace(/^eq\./, "");
        if (init.method === "POST") { const l = JSON.parse(String(init.body)); base.set(l.user_id, l); return new Response(null, { status: 201 }); }
        if (init.method === "DELETE") { base.delete(id); return new Response(null, { status: 204 }); }
        return Response.json(base.has(id) ? [base.get(id)] : []);
      }
      if (url.origin === "https://api.anthropic.com") {
        const cle = h.get("x-api-key") || "";
        if (cle !== BONNE) return Response.json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, { status: 401 });
        if (url.pathname === "/v1/models") return Response.json({ data: [{ type: "model", id: "claude-opus-5-5", display_name: "Claude Opus 5.5", created_at: "2026-01-01T00:00:00Z" }], has_more: false, first_id: "claude-opus-5-5", last_id: "claude-opus-5-5" });
        if (url.pathname === "/v1/messages") {
          vers.push({ cle, corps: JSON.parse(String(init.body)) });
          return Response.json({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "Bonsoir." }],
            stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 3 } });
        }
      }
      return new Response("introuvable", { status: 404 });
    }
  };
  return { h: assistant(m), base, vers };
}
const demande = (corps: unknown, { jeton = "jeton-moi", origine = ORIGINE } = {}) => new Request("https://projet.supabase.co/functions/v1/assistant", {
  method: "POST", body: JSON.stringify(corps), headers: { origin: origine, authorization: `Bearer ${jeton}`, apikey: "sb_publishable_x", "content-type": "application/json" } });
const REQUETE = { model: "claude-opus-5-5", max_tokens: 1500, system: "Tu es Claude.", messages: [{ role: "user", content: "Bonsoir ?" }] };

Deno.test("fermé : origine, session, configuration", async () => {
  const { h } = monde();
  assertEquals((await h(demande({ action: "etat" }, { origine: "https://ailleurs.example" }))).status, 403);
  assertEquals((await h(demande({ action: "etat" }, { jeton: "faux" }))).status, 401);
  assertEquals((await monde({ ...ENV, ASSISTANT_KEY_SECRET: "" }).h(demande({ action: "etat" }))).status, 503, "sans secret de chiffrement, rien");
  assertEquals((await monde({ ...ENV, ASSISTANT_KEY_SECRET: btoa("trop court") }).h(demande({ action: "etat" }))).status, 503);
  const pre = await h(new Request("https://projet.supabase.co/functions/v1/assistant", { method: "OPTIONS", headers: { origin: ORIGINE } }));
  assertEquals(pre.status, 204); assertEquals(pre.headers.get("access-control-allow-origin"), ORIGINE);
});

Deno.test("clé : vérifiée par Anthropic, chiffrée, jamais rendue ; oubliée", async () => {
  const { h, base } = monde();
  assertEquals(await (await h(demande({ action: "etat" }))).json(), { cle: false });
  assertEquals((await h(demande({ action: "cle", cle: "pas-une-cle" }))).status, 400);
  const refus = await h(demande({ action: "cle", cle: MAUVAISE }));
  assertEquals(refus.status, 400); assertEquals((await refus.json()).code, "cle");
  assertEquals(base.size, 0, "une clé refusée n'est pas gardée");
  const ok = await h(demande({ action: "cle", cle: BONNE }));
  assertEquals(await ok.json(), { cle: true, indice: "…wxyz" });
  const ligne = base.get(MOI)!;
  assert(!JSON.stringify(ligne).includes(BONNE.slice(10)), "la base ne contient pas la clé en clair");
  assertEquals(await (await h(demande({ action: "etat" }))).json(), { cle: true, indice: "…wxyz" }, "l'état ne rend que l'indice");
  assertEquals(await (await h(demande({ action: "etat" }, { jeton: "jeton-elle" }))).json(), { cle: false }, "chaque compte a sa clé");
  assertEquals(await (await h(demande({ action: "oublier" }))).json(), { cle: false });
  assertEquals(base.size, 0);
});

Deno.test("message : relayé avec la clé du compte, champs filtrés et bornés", async () => {
  const { h, vers } = monde();
  assertEquals((await h(demande({ action: "message", requete: REQUETE }))).status, 409, "sans clé enregistrée");
  await h(demande({ action: "cle", cle: BONNE }));
  const r = await h(demande({ action: "message", requete: { ...REQUETE, stream: true, metadata: { user_id: "x" }, betas: ["y"] } }));
  assertEquals(r.status, 200);
  assertEquals((await r.json()).content[0].text, "Bonsoir.");
  assertEquals(vers.length, 1); assertEquals(vers[0].cle, BONNE);
  assertEquals(Object.keys(vers[0].corps).sort(), ["max_tokens", "messages", "model", "system"], "seulement les champs permis : pas de flux, pas de métadonnées");
  for (const [q, pourquoi] of [[{ ...REQUETE, max_tokens: MAX_SORTIE + 1 }, "max_tokens"], [{ ...REQUETE, model: "gpt-4" }, "modèle"], [{ ...REQUETE, messages: [] }, "messages vides"],
    [{ ...REQUETE, messages: [{ role: "system", content: "x" }] }, "rôle"], [{ ...REQUETE, tools: Array(33).fill({}) }, "outils"]] as const)
    assertEquals((await h(demande({ action: "message", requete: q }))).status, 400, pourquoi);
  assertEquals(vers.length, 1, "rien de refusé n'est parti");
  assertEquals((await h(demande({ action: "message", requete: REQUETE }, { jeton: "jeton-elle" }))).status, 409, "l'autre compte n'utilise pas ma clé");
});

Deno.test("chiffrement lié au compte : une ligne copiée sous un autre compte ne se déchiffre pas", async () => {
  const k = await crypto.subtle.importKey("raw", Uint8Array.from(atob(SECRET), c => c.charCodeAt(0)), "AES-GCM", false, ["encrypt", "decrypt"]);
  const l = await chiffrer(k, MOI, BONNE);
  assertEquals(await dechiffrer(k, MOI, l), BONNE);
  assertEquals(await dechiffrer(k, ELLE, l), null);
  const { h, base } = monde();
  await h(demande({ action: "cle", cle: BONNE }));
  base.set(ELLE, { ...base.get(MOI)!, user_id: ELLE });
  assertEquals((await h(demande({ action: "message", requete: REQUETE }, { jeton: "jeton-elle" }))).status, 409);
});
