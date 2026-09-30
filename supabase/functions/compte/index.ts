/* Point d'entrée de la fonction Supabase Edge « compte » : le vrai réseau, les vrais secrets.
   Toute la logique est dans compte.ts ; voir docs/compte.md pour le déploiement. */
import { compteFn } from "./compte.ts";

Deno.serve(compteFn({ fetch: (...a) => fetch(...a), env: n => Deno.env.get(n) }));
