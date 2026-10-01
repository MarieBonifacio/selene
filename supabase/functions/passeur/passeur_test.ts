/* Le passeur de bout en bout, avec un faux réseau et un faux DNS : qui peut l'appeler, et ce qu'il accepte d'aller chercher. */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { passeur, type Monde } from "./passeur.ts";

const MOI = "0b8f0c2e-1111-2222-3333-444455556666", ELLE = "9f9f9f9f-1111-2222-3333-444455556666";
const ORIGINE = "https://mariebonifacio.github.io";
const RSS = '<?xml version="1.0" encoding="utf-8"?><rss><channel><title>Revue</title></channel></rss>';

type Site = (url: URL, init: RequestInit) => Response;
function monde(sites: Record<string, Site>, dns: Record<string, string[]> = {}, env: Record<string, string> = { SUPABASE_URL: "https://projet.supabase.co", PASSEUR_USERS: MOI }) {
  const appels: string[] = [];
  const m: Monde = {
    env: n => env[n],
    resolveDns: async (h, t) => { const l = (dns[h] ?? ["93.184.216.34"]).filter(ip => (t === "A") === !ip.includes(":")); if (!l.length) throw new Error("NXDOMAIN"); return l; },
    fetch: async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      appels.push(url.toString());
      if (url.pathname === "/auth/v1/user") {
        const tok = new Headers(init.headers).get("authorization");
        return tok === "Bearer jeton-moi" ? Response.json({ id: MOI }) : tok === "Bearer jeton-elle" ? Response.json({ id: ELLE }) : new Response("{}", { status: 401 });
      }
      const s = sites[url.origin + url.pathname];
      return s ? s(url, init) : new Response("introuvable", { status: 404 });
    }
  };
  return { h: passeur(m), appels };
}
const demande = (corps: unknown, { jeton = "jeton-moi", origine = ORIGINE } = {}) => new Request("https://projet.supabase.co/functions/v1/passeur", {
  method: "POST", body: JSON.stringify(corps), headers: { origin: origine, authorization: `Bearer ${jeton}`, apikey: "sb_publishable_x", "content-type": "application/json" } });

Deno.test("fermé : origine, session, compte listé, liste obligatoire", async () => {
  const { h } = monde({ "https://revue.org/rss": () => new Response(RSS, { headers: { "content-type": "application/rss+xml" } }) });
  const q = { url: "https://revue.org/rss", genre: "feed" };
  assertEquals((await h(demande(q, { origine: "https://ailleurs.org" }))).status, 403);
  assertEquals((await h(demande(q, { jeton: "faux" }))).status, 401);
  assertEquals((await h(demande(q, { jeton: "jeton-elle" }))).status, 403);
  const ok = await h(demande(q));
  assertEquals(ok.status, 200); assertEquals(ok.headers.get("access-control-allow-origin"), ORIGINE);
  const sansListe = monde({}, {}, { SUPABASE_URL: "https://projet.supabase.co" });
  assertEquals((await sansListe.h(demande(q))).status, 503);
  const pre = await h(new Request("https://projet.supabase.co/functions/v1/passeur", { method: "OPTIONS", headers: { origin: ORIGINE } }));
  assertEquals(pre.status, 204); assert(pre.headers.get("access-control-allow-headers")!.includes("apikey"));
});

Deno.test("lecture : texte, métadonnées, GET conditionnel transmis, 304 sans corps", async () => {
  let recu: Headers | null = null;
  const { h } = monde({ "https://revue.org/rss": (_u, init) => {
    recu = new Headers(init.headers);
    return recu.get("if-none-match") === '"v2"' ? new Response(null, { status: 304, headers: { etag: '"v2"' } })
      : new Response(RSS, { headers: { "content-type": "application/rss+xml", etag: '"v2"', "last-modified": "Mon, 28 Sep 2026 08:00:00 GMT" } });
  } });
  const r = await (await h(demande({ url: "https://revue.org/rss", genre: "feed" }))).json();
  assertEquals(r.status, 200); assertEquals(r.texte, RSS); assertEquals(r.etag, '"v2"'); assertEquals(r.modifie, "Mon, 28 Sep 2026 08:00:00 GMT");
  assert(recu!.get("user-agent")!.startsWith("Selene-passeur"));
  const r2 = await (await h(demande({ url: "https://revue.org/rss", genre: "feed", etag: '"v2"' }))).json();
  assertEquals(r2.status, 304); assertEquals(r2.texte, undefined);
});

Deno.test("SSRF : IP privée écrite, nom qui résout vers le privé, redirection vers les métadonnées", async () => {
  const { h, appels } = monde({
    "https://piege.org/rss": () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } }),
    "https://relais.org/a": () => new Response(null, { status: 301, headers: { location: "/b" } }),
    "https://relais.org/b": () => new Response(RSS, { headers: { "content-type": "text/xml" } })
  }, { "rebind.org": ["10.0.0.5"], "mixte.org": ["93.184.216.34", "fd00::1"] });
  for (const url of ["http://127.0.0.1/rss", "http://[::ffff:10.0.0.1]/", "https://rebind.org/rss", "https://mixte.org/rss"]) {
    const r = await h(demande({ url, genre: "feed" }));
    assertEquals(r.status, 400, url);
  }
  const p = await h(demande({ url: "https://piege.org/rss", genre: "feed" }));
  assertEquals(p.status, 502);
  const pj = await p.json(); assert(pj.erreur.includes("redirection refusée")); assertEquals([pj.code, pj.detail], ["redirection", "adresse-privee"]);
  assert(!appels.some(a => a.includes("169.254")), "l'adresse des métadonnées n'a jamais été appelée");
  const ok = await (await h(demande({ url: "https://relais.org/a", genre: "feed" }))).json();
  assertEquals(ok.url, "https://relais.org/b"); assertEquals(ok.texte, RSS);
});

Deno.test("limites : binaire refusé, 2 Mo, genre inconnu, site en erreur", async () => {
  const { h } = monde({
    "https://revue.org/image": () => new Response(new Uint8Array(10), { headers: { "content-type": "image/png" } }),
    "https://revue.org/enorme": () => new Response("x".repeat(2 * 1024 * 1024 + 1), { headers: { "content-type": "text/xml" } }),
    "https://revue.org/panne": () => new Response("non", { status: 500 })
  });
  const image = await h(demande({ url: "https://revue.org/image", genre: "feed" }));
  assertEquals(image.status, 415); assertEquals((await image.json()).code, "contenu");
  assertEquals((await h(demande({ url: "https://revue.org/enorme", genre: "feed" }))).status, 413);
  assertEquals((await h(demande({ url: "https://revue.org/rss", genre: "video" }))).status, 400);
  const p = await (await h(demande({ url: "https://revue.org/panne", genre: "feed" }))).json();
  assertEquals(p.status, 500); assert(p.erreur.includes("500")); assertEquals(p.code, "site");
});
