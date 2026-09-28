/* Point d'entrée de la fonction Supabase Edge « passeur » : le vrai réseau, le vrai DNS, les vrais secrets.
   Toute la logique est dans passeur.ts (et garde.ts) ; voir docs/passeur.md pour le déploiement. */
import { passeur } from "./passeur.ts";

Deno.serve(passeur({
  fetch: (...a) => fetch(...a),
  resolveDns: typeof Deno.resolveDns === "function" ? (h, t) => Deno.resolveDns(h, t) : undefined,
  env: n => Deno.env.get(n)
}));
