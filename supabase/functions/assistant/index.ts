/* Point d'entrée de la fonction Supabase Edge « assistant » : le vrai réseau, les vrais secrets.
   Toute la logique est dans assistant.ts ; voir docs/assistant.md pour le déploiement. */
import { assistant } from "./assistant.ts";

Deno.serve(assistant({ fetch: (...a) => fetch(...a), env: n => Deno.env.get(n) }));
