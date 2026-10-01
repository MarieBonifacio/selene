/* Le passeur de Selene : une fonction Supabase Edge qui va chercher, pour toi seule, ce que le navigateur n'a pas
   le droit de lire lui-même (flux RSS, pages, calendriers : leurs serveurs n'envoient pas d'en-tête CORS).

   Fermé : une session Supabase valide, d'un compte listé dans le secret PASSEUR_USERS (sinon personne), appelée
   depuis une origine listée dans PASSEUR_ORIGINS. Protégé contre la SSRF (garde.ts), chaque redirection revérifiée,
   2 Mo et 8 secondes au plus. Il ne garde rien : ni journal des adresses, ni cache.

   Requête : POST { url, genre: "feed" | "page" | "ics" | "json", etag?, modifie? }  (etag et modifie : GET conditionnel)
   Réponse : { status, url, type, etag, modifie, texte } ; status 304 sans texte si rien n'a changé ;
             { erreur, code, detail? } avec un code HTTP 4xx ou 5xx sinon : erreur, le message en français (pour les
             versions de l'interface qui ne connaissent pas encore les codes) ; code, stable, que l'interface traduit ;
             detail, la partie variable (un type de contenu, le code d'une redirection refusée).
   Déploiement et secrets : docs/passeur.md. Point d'entrée : index.ts. */
import { cible, comptes, decoder, encodage, GENRES, type Genre, ipPublique, MAX_OCTETS, MAX_SAUTS, origines, typeAccepte } from "./garde.ts";
import { compte, limiteur, origineDe, prevol, reponse } from "../_shared/session.ts";

/* Ce dont le passeur a besoin du monde : injecté, pour que les tests (passeur_test.ts) le remplacent. */
export type Monde = {
  fetch: typeof fetch;
  resolveDns?: (host: string, type: "A" | "AAAA") => Promise<string[]>;
  env: (nom: string) => string | undefined;
};

const AGENT = "Selene-passeur/1 (lecteur personnel ; +https://github.com/MarieBonifacio/selene)";
const DELAI_MS = 8000;

/* Un débit raisonnable par compte : 150 appels par dizaine de minutes. */
const tropVite = limiteur(150, 600_000);

/* Toutes les adresses d'un nom doivent être publiques. Si l'environnement ne sait pas résoudre, la garde de l'URL
   (IP écrite, noms locaux) reste seule : le fetch du nuage ne joint de toute façon pas le réseau privé du projet. */
async function nomSur(m: Monde, host: string): Promise<boolean> {
  if (!m.resolveDns) return true;
  const ips: string[] = [];
  for (const t of ["A", "AAAA"] as const) { try { ips.push(...await m.resolveDns(host, t)); } catch { /* pas d'enregistrement de ce type */ } }
  return ips.length > 0 && ips.every(ipPublique);
}

async function lire(corps: ReadableStream<Uint8Array> | null): Promise<Uint8Array | null> {
  if (!corps) return new Uint8Array();
  const r = corps.getReader(), morceaux: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    n += value.length;
    if (n > MAX_OCTETS) { await r.cancel(); return null; }
    morceaux.push(value);
  }
  const out = new Uint8Array(n); let i = 0;
  for (const m of morceaux) { out.set(m, i); i += m.length; }
  return out;
}

export const passeur = (m: Monde) => async (req: Request): Promise<Response> => {
  const origine = origineDe(req, origines(m.env("PASSEUR_ORIGINS")));
  if (req.method === "OPTIONS") return prevol(origine);
  if (req.method !== "POST") return reponse({ erreur: "POST seulement", code: "post-seulement" }, 405, origine);
  if (!origine) return reponse({ erreur: "origine non autorisée", code: "origine" }, 403, null);
  const autorises = comptes(m.env("PASSEUR_USERS"));
  if (!autorises.size) return reponse({ erreur: "passeur non configuré : secret PASSEUR_USERS absent", code: "passeur-non-configure" }, 503, origine);
  const id = await compte(m, req);
  if (!id) return reponse({ erreur: "session absente ou expirée", code: "session" }, 401, origine);
  if (!autorises.has(id)) return reponse({ erreur: "ce compte n'est pas autorisé à utiliser ce passeur", code: "compte-non-autorise" }, 403, origine);
  if (tropVite(id)) return reponse({ erreur: "trop d'appels ; réessaie dans quelques minutes", code: "trop-d-appels" }, 429, origine);

  let q: { url?: unknown; genre?: unknown; etag?: unknown; modifie?: unknown };
  try { q = await req.json(); } catch { return reponse({ erreur: "requête illisible", code: "illisible" }, 400, origine); }
  const genre = (GENRES as readonly unknown[]).includes(q.genre) ? q.genre as Genre : null;
  if (!genre) return reponse({ erreur: "genre inconnu", code: "genre-inconnu" }, 400, origine);
  let c = cible(q.url);
  if ("refus" in c) return reponse({ erreur: c.refus, code: c.code }, 400, origine);

  const entetes: Record<string, string> = { "user-agent": AGENT, accept: genre === "json" ? "application/json" : genre === "ics" ? "text/calendar, text/plain" : genre === "page" ? "text/html, application/xhtml+xml" : "application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*;q=0.5" };
  if (typeof q.etag === "string" && q.etag.length < 300) entetes["if-none-match"] = q.etag;
  if (typeof q.modifie === "string" && q.modifie.length < 100) entetes["if-modified-since"] = q.modifie;
  const signal = AbortSignal.timeout(DELAI_MS);
  try {
    for (let saut = 0; ; saut++) {
      if (!await nomSur(m, c.url.hostname.replace(/^\[|\]$/g, ""))) return reponse({ erreur: "adresse privée, réservée ou introuvable", code: "adresse-privee" }, 400, origine);
      const r = await m.fetch(c.url, { headers: entetes, redirect: "manual", signal });
      if (r.status >= 300 && r.status < 400 && r.status !== 304) {
        await r.body?.cancel();
        const vers = r.headers.get("location");
        if (!vers || saut >= MAX_SAUTS) return reponse({ erreur: "trop de redirections", code: "trop-de-redirections" }, 502, origine);
        c = cible(new URL(vers, c.url).toString());
        if ("refus" in c) return reponse({ erreur: `redirection refusée : ${c.refus}`, code: "redirection", detail: c.code }, 502, origine);
        continue;
      }
      const meta = { url: c.url.toString(), type: r.headers.get("content-type"), etag: r.headers.get("etag"), modifie: r.headers.get("last-modified") };
      if (r.status === 304) return reponse({ status: 304, ...meta }, 200, origine);
      if (!r.ok) { await r.body?.cancel(); return reponse({ status: r.status, ...meta, erreur: `le site répond ${r.status}`, code: "site" }, 200, origine); }
      if (!typeAccepte(genre, meta.type)) { await r.body?.cancel(); return reponse({ erreur: `contenu inattendu (${(meta.type || "").split(";")[0]})`, code: "contenu", detail: (meta.type || "").split(";")[0] }, 415, origine); }
      const octets = await lire(r.body);
      if (!octets) return reponse({ erreur: "plus de 2 Mo : refusé", code: "trop-gros" }, 413, origine);
      return reponse({ status: r.status, ...meta, texte: decoder(octets, encodage(meta.type, octets)) }, 200, origine);
    }
  } catch (e) {
    const lent = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
    return reponse(lent ? { erreur: "le site met plus de 8 secondes à répondre", code: "lent" } : { erreur: "le site est injoignable", code: "injoignable" }, 504, origine);
  }
};
