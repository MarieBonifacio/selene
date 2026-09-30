/* Le compte de Selene côté serveur : sa suppression, depuis l'app (exigée par l'App Store et Google Play pour toute
   app où l'on crée un compte). Une fonction Supabase Edge, parce que seule la clé serveur du projet peut effacer un
   utilisateur de Supabase Auth ; la page ne la voit jamais.

   Requête : POST { action: "supprimer", confirmation: "supprimer" } avec la session (Authorization: Bearer) et la clé
   publique (apikey). La personne ne peut supprimer que son propre compte (celui de la session).
   Ce qui part, dans l'ordre : la ligne app_state (tout le tableau de bord), la clé d'assistant chiffrée
   (assistant_keys), puis le compte Supabase Auth lui-même (les clés étrangères « on delete cascade » rattraperaient
   une table oubliée). → { supprime: true } ; { erreur } avec un code 4xx ou 5xx sinon. Si l'effacement du compte
   échoue après celui des données, un nouvel essai termine le travail : chaque étape tolère ce qui est déjà parti.

   Secrets : la clé serveur (COMPTE_DB_KEY, sinon SUPABASE_SERVICE_ROLE_KEY, fournie par Supabase). Origines :
   COMPTE_ORIGINS, sinon celles de _shared/session.ts. Déploiement : docs/compte.md. Point d'entrée : index.ts. */
import { type Base, compte, limiteur, origineDe, origines, prevol, reponse } from "../_shared/session.ts";

export type Monde = Base;
const MAX_CORPS = 1000;
const tropDEssais = limiteur(5, 600_000);
export const TABLES = ["app_state", "assistant_keys"];

function admin(m: Monde) {
  const base = m.env("SUPABASE_URL"), cle = m.env("COMPTE_DB_KEY") || m.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !cle) return null;
  // La clé seulement dans « apikey », comme la fonction assistant : la passerelle de Supabase en déduit le rôle
  // serveur (anciennes clés JWT comme nouvelles clés sb_secret_…, qui ne sont pas des JWT).
  const h = { apikey: cle };
  const appel = async (url: string) => {
    const r = await m.fetch(url, { method: "DELETE", headers: h, signal: AbortSignal.timeout(8000) });
    if (!r.ok && r.status !== 404) throw new Error(`${new URL(url).pathname} : ${r.status}`); // 404 : déjà parti
  };
  return {
    effacerDonnees: async (id: string) => { for (const t of TABLES) await appel(`${base}/rest/v1/${t}?user_id=eq.${encodeURIComponent(id)}`); },
    effacerCompte: (id: string) => appel(`${base}/auth/v1/admin/users/${encodeURIComponent(id)}`)
  };
}

export function compteFn(m: Monde) {
  const liste = origines(m.env("COMPTE_ORIGINS"));
  return async (req: Request): Promise<Response> => {
    const origine = origineDe(req, liste);
    if (req.method === "OPTIONS") return prevol(origine);
    if (req.method !== "POST") return reponse({ erreur: "POST seulement" }, 405, origine);
    if (!origine) return reponse({ erreur: "origine non autorisée" }, 403, null);
    const a = admin(m);
    if (!a) return reponse({ erreur: "suppression non configurée (voir docs/compte.md)" }, 503, origine);
    const id = await compte(m, req);
    if (!id) return reponse({ erreur: "session absente ou expirée" }, 401, origine);
    if (!/^[0-9a-f-]{36}$/.test(id)) return reponse({ erreur: "compte illisible" }, 400, origine);
    if (tropDEssais(id)) return reponse({ erreur: "trop d'essais ; réessaie dans quelques minutes" }, 429, origine);

    const texte = await req.text();
    if (texte.length > MAX_CORPS) return reponse({ erreur: "requête trop longue" }, 413, origine);
    let q: { action?: unknown; confirmation?: unknown };
    try { q = JSON.parse(texte); } catch { return reponse({ erreur: "requête illisible" }, 400, origine); }
    if (q.action !== "supprimer") return reponse({ erreur: "action inconnue" }, 400, origine);
    // Un garde-fou contre un appel parti par erreur : la page ne l'envoie qu'après une confirmation tapée.
    if (q.confirmation !== "supprimer") return reponse({ erreur: "confirmation manquante" }, 400, origine);

    try { await a.effacerDonnees(id); } catch { return reponse({ erreur: "données non effacées ; réessaie" }, 503, origine); }
    try { await a.effacerCompte(id); } catch { return reponse({ erreur: "données effacées, compte non supprimé ; réessaie" }, 503, origine); }
    return reponse({ supprime: true }, 200, origine);
  };
}
