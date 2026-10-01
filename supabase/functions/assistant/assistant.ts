/* L'assistant de Selene côté serveur : une fonction Supabase Edge qui garde la clé Anthropic de chaque compte et
   appelle Claude pour lui. La clé est entrée une fois, vérifiée auprès d'Anthropic, chiffrée (AES-GCM, liée au
   compte) et ne revient plus jamais dans le navigateur : une faille de la page ne peut plus la lire.

   Requête : POST { action, … } avec la session Supabase (Authorization: Bearer) et la clé publique (apikey).
   - { action: "etat" }            → { cle: boolean, indice? }   (indice : les 4 derniers caractères)
   - { action: "cle", cle }        → { cle: true, indice }        après vérification auprès d'Anthropic
   - { action: "oublier" }         → { cle: false }
   - { action: "message", requete: { model, max_tokens, system?, messages, tools? } } → le message d'Anthropic, tel quel
   { erreur, code, detail? } avec un code HTTP 4xx ou 5xx sinon : erreur, le message en français (pour les versions
   de l'interface qui ne connaissent pas encore les codes) ; code, stable, que l'interface traduit et dont elle se sert
   (sans-cle : redemander une clé) ; detail, ce qui précise ou varie (« illisible », le refus d'une requête).

   Ouvert à tout compte connecté (chacun paie avec sa clé), depuis une origine listée dans ASSISTANT_ORIGINS.
   Secrets : ASSISTANT_KEY_SECRET (32 octets en base64) ; la base est lue avec la clé serveur du projet. Il ne garde
   ni les questions ni les réponses. Déploiement : docs/assistant.md. Point d'entrée : index.ts. */
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";
import { type Base, compte, limiteur, origineDe, origines, prevol, reponse } from "../_shared/session.ts";

export type Monde = Base;

export const MAX_CORPS = 400_000; // octets d'une requête : l'historique récent et le contexte partagé, pas un livre
export const MAX_SORTIE = 4096;   // max_tokens au plus
const MAX_MESSAGES = 100, MAX_OUTILS = 32, MAX_SYSTEME = 50_000;
const DELAI_MS = 60_000;
const tropDeMessages = limiteur(60, 600_000), tropDeCles = limiteur(10, 600_000);

/* ---- chiffrement : AES-GCM, clé du serveur, identifiant du compte en données associées (une ligne copiée
   sous un autre compte ne se déchiffre pas) ---- */
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function cleServeur(m: Monde): Promise<CryptoKey | null> {
  const brut = m.env("ASSISTANT_KEY_SECRET");
  if (!brut) return null;
  let octets: Uint8Array<ArrayBuffer>;
  try { octets = deB64(brut.trim()); } catch { return null; }
  if (octets.length !== 32) return null;
  return await crypto.subtle.importKey("raw", octets, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function chiffrer(k: CryptoKey, id: string, texte: string): Promise<{ chiffre: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id) }, k, new TextEncoder().encode(texte));
  return { chiffre: b64(new Uint8Array(c)), iv: b64(iv) };
}
export async function dechiffrer(k: CryptoKey, id: string, l: { chiffre: string; iv: string }): Promise<string | null> {
  try {
    const t = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(l.iv), additionalData: new TextEncoder().encode(id) }, k, deB64(l.chiffre));
    return new TextDecoder().decode(t);
  } catch { return null; }
}

/* ---- la table assistant_keys (supabase/schema.sql), lue et écrite avec la clé serveur : aucune règle RLS ne
   l'ouvre aux navigateurs ---- */
type Ligne = { chiffre: string; iv: string; indice: string };
function table(m: Monde) {
  const base = m.env("SUPABASE_URL"), cle = m.env("ASSISTANT_DB_KEY") || m.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !cle) return null;
  const url = (id?: string) => `${base}/rest/v1/assistant_keys${id ? `?user_id=eq.${encodeURIComponent(id)}` : ""}`;
  const h = { apikey: cle, "content-type": "application/json" };
  const ok = async (r: Response) => { if (!r.ok) throw new Error(`base : ${r.status}`); return r; };
  return {
    lire: async (id: string): Promise<Ligne | null> => {
      const r = await ok(await m.fetch(url(id) + "&select=chiffre,iv,indice", { headers: h, signal: AbortSignal.timeout(5000) }));
      const l = await r.json();
      return Array.isArray(l) && l[0] ? l[0] : null;
    },
    ecrire: async (id: string, l: Ligne) => {
      await ok(await m.fetch(url(), { method: "POST", headers: { ...h, prefer: "resolution=merge-duplicates,return=minimal" }, signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ user_id: id, ...l, updated_at: new Date().toISOString() }) }));
    },
    effacer: async (id: string) => { await ok(await m.fetch(url(id), { method: "DELETE", headers: h, signal: AbortSignal.timeout(5000) })); }
  };
}

/* ---- la requête relayée : seulement ces champs, bornés. Pas de flux (stream), pas d'en-tête choisi par la page. ---- */
export function requeteSure(q: unknown): { params: Anthropic.MessageCreateParamsNonStreaming } | { refus: string } {
  const r = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
  if (typeof r.model !== "string" || !/^claude-[a-z0-9.-]{1,60}$/.test(r.model)) return { refus: "modèle inconnu" };
  if (!Number.isInteger(r.max_tokens) || (r.max_tokens as number) < 1 || (r.max_tokens as number) > MAX_SORTIE) return { refus: `max_tokens entre 1 et ${MAX_SORTIE}` };
  if (!Array.isArray(r.messages) || !r.messages.length || r.messages.length > MAX_MESSAGES) return { refus: `de 1 à ${MAX_MESSAGES} messages` };
  if (!r.messages.every(x => x && typeof x === "object" && ["user", "assistant"].includes((x as { role?: unknown }).role as string))) return { refus: "message mal formé" };
  if (r.system !== undefined && (typeof r.system !== "string" || r.system.length > MAX_SYSTEME)) return { refus: "consigne système mal formée" };
  if (r.tools !== undefined && (!Array.isArray(r.tools) || r.tools.length > MAX_OUTILS)) return { refus: `${MAX_OUTILS} outils au plus` };
  return { params: { model: r.model, max_tokens: r.max_tokens as number, messages: r.messages as Anthropic.MessageParam[],
    ...(r.system ? { system: r.system as string } : {}), ...(r.tools ? { tools: r.tools as Anthropic.Tool[] } : {}) } };
}

// Adresse et authentification fixées ici : aucune variable d'environnement (ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN…)
// ne peut envoyer les clés ailleurs ni leur ajouter un autre jeton.
const client = (m: Monde, apiKey: string, timeout: number) =>
  new Anthropic({ apiKey, authToken: null, baseURL: "https://api.anthropic.com", fetch: m.fetch, timeout, maxRetries: 1 });

export const assistant = (m: Monde) => async (req: Request): Promise<Response> => {
  const origine = origineDe(req, origines(m.env("ASSISTANT_ORIGINS")));
  if (req.method === "OPTIONS") return prevol(origine);
  if (req.method !== "POST") return reponse({ erreur: "POST seulement", code: "post-seulement" }, 405, origine);
  if (!origine) return reponse({ erreur: "origine non autorisée", code: "origine" }, 403, null);
  const secret = await cleServeur(m), db = table(m);
  if (!secret || !db) return reponse({ erreur: "assistant non configuré (voir docs/assistant.md)", code: "assistant-non-configure" }, 503, origine);
  const id = await compte(m, req);
  if (!id) return reponse({ erreur: "session absente ou expirée", code: "session" }, 401, origine);

  const texte = await req.text();
  if (texte.length > MAX_CORPS) return reponse({ erreur: "requête trop longue", code: "trop-long" }, 413, origine);
  let q: { action?: unknown; cle?: unknown; requete?: unknown };
  try { q = JSON.parse(texte); } catch { return reponse({ erreur: "requête illisible", code: "illisible" }, 400, origine); }

  try {
    if (q.action === "etat") {
      const l = await db.lire(id);
      return reponse(l ? { cle: true, indice: l.indice } : { cle: false }, 200, origine);
    }
    if (q.action === "oublier") { await db.effacer(id); return reponse({ cle: false }, 200, origine); }
    if (q.action === "cle") {
      if (tropDeCles(id)) return reponse({ erreur: "trop d'essais ; réessaie dans quelques minutes", code: "trop-d-essais" }, 429, origine);
      const cle = typeof q.cle === "string" ? q.cle.trim() : "";
      if (!/^sk-ant-[A-Za-z0-9_-]{20,200}$/.test(cle)) return reponse({ erreur: "ce n'est pas une clé d'API Anthropic (sk-ant-…)", code: "pas-une-cle" }, 400, origine);
      try { await client(m, cle, 10_000).models.list({ limit: 1 }); } // gratuit : dit seulement si la clé est acceptée
      catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return reponse({ erreur: "Anthropic refuse cette clé", code: "cle" }, 400, origine);
        return reponse({ erreur: "Anthropic injoignable ; réessaie", code: "anthropic-injoignable" }, 502, origine);
      }
      const indice = "…" + cle.slice(-4);
      await db.ecrire(id, { ...await chiffrer(secret, id, cle), indice });
      return reponse({ cle: true, indice }, 200, origine);
    }
    if (q.action === "message") {
      if (tropDeMessages(id)) return reponse({ erreur: "trop de messages ; réessaie dans quelques minutes", code: "trop-de-messages" }, 429, origine);
      const sure = requeteSure(q.requete);
      if ("refus" in sure) return reponse({ erreur: sure.refus, code: "requete", detail: sure.refus }, 400, origine);
      const l = await db.lire(id);
      if (!l) return reponse({ erreur: "aucune clé enregistrée pour ce compte", code: "sans-cle" }, 409, origine);
      const cle = await dechiffrer(secret, id, l);
      if (!cle) return reponse({ erreur: "clé enregistrée illisible : enregistre-la de nouveau", code: "sans-cle", detail: "illisible" }, 409, origine);
      try {
        return reponse(await client(m, cle, DELAI_MS).messages.create(sure.params), 200, origine);
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return reponse({ erreur: "Anthropic refuse la clé enregistrée", code: "cle", detail: "enregistree" }, 400, origine);
        if (e instanceof Anthropic.RateLimitError) return reponse({ erreur: "limite de ton compte Anthropic atteinte ; réessaie plus tard", code: "limite-anthropic" }, 429, origine);
        if (e instanceof Anthropic.BadRequestError) return reponse({ erreur: e.message, code: "anthropic-requete", detail: e.message }, 400, origine);
        if (e instanceof Anthropic.APIConnectionError) return reponse({ erreur: "Anthropic ne répond pas ; réessaie", code: "anthropic-muet" }, 504, origine);
        return reponse({ erreur: "Anthropic répond par une erreur ; réessaie", code: "anthropic-erreur" }, 502, origine);
      }
    }
    return reponse({ erreur: "action inconnue", code: "action-inconnue" }, 400, origine);
  } catch {
    return reponse({ erreur: "base de données injoignable", code: "base-injoignable" }, 503, origine);
  }
};
