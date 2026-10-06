/* Assemble Selene pour build.py, qui l'appelle et lit sur la sortie standard, en JSON, deux fonctions immédiatement
   exécutées (esbuild, modules ES) :
   - platform : src/platform.js, qui pose `var __platform = { platform, hosted, … }`. Évaluée d'abord : elle ouvre le
     stockage (IndexedDB, coffres natifs) avant que quoi que ce soit ne le lise ;
   - app : src/app/index.js et tout ce qu'il importe (noyau compris), qui pose `var __selene = { …exportations }`.
     build.py la place dans platform.ready. Ses imports de src/platform.js ne l'embarquent pas une seconde fois : ils
     sont servis par `__platform` (une seule façade, un seul état). Les noms en sont lus, pas tenus à la main.
   Chemins relatifs à la racine du dépôt, où qu'on lance le script : la sortie est identique d'une machine à l'autre.
   L'édition (SELENE_EDITION) : complète par défaut ; « stores » pour Google Play et l'App Store, où le type « Reprendre
   la main » n'entre pas : src/app/modules/regulation.js y est remplacé par regulation.stores.js (docs/regulation.md).
   Le projet Supabase (SELENE_SUPABASE_URL et SELENE_SUPABASE_KEY, ensemble) : celui de l'app par défaut ; un autre,
   de préproduction, pour la recette avec le compte P (docs/recette/README.md, « Le compte de recette P ») : jamais de
   compte de test ni d'écriture de recette sur le projet de l'app. Une adresse de projet et une clé publique seulement. */
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const PLATFORM = path.join(root, "src", "platform.js");
const common = { absWorkingDir: root, bundle: true, write: false, charset: "utf8", logLevel: "error" };

const [platformIife, platformEsm] = await Promise.all([
  build({ ...common, entryPoints: ["src/platform.js"], format: "iife", globalName: "__platform" }),
  build({ ...common, entryPoints: ["src/platform.js"], format: "esm", metafile: true })
]);
const names = Object.values(platformEsm.metafile.outputs).flatMap(o => o.exports).sort();

const sharedPlatform = {
  name: "plateforme-partagee",
  setup(b) {
    b.onResolve({ filter: /platform\.js$/ }, args => {
      const p = path.resolve(args.resolveDir, args.path);
      // Un chemin relatif : esbuild l'écrit en commentaire dans le script, qui doit être le même sur toute machine.
      return p === PLATFORM ? { path: "src/platform.js", namespace: "plateforme" } : undefined;
    });
    b.onLoad({ filter: /.*/, namespace: "plateforme" }, () => ({ contents: `export const { ${names.join(", ")} } = __platform;`, loader: "js" }));
  }
};
const EDITION = process.env.SELENE_EDITION || "complete";
if (!["complete", "stores"].includes(EDITION)) { process.stderr.write(`SELENE_EDITION : complete ou stores, pas « ${EDITION} »\n`); process.exit(1); }
const REGULATION = path.join(root, "src", "app", "modules", "regulation.js");
const storesEdition = {
  name: "edition-stores",
  setup(b) {
    b.onResolve({ filter: /regulation\.js$/ }, args => {
      if (path.resolve(args.resolveDir, args.path) !== REGULATION) return undefined;
      return { path: path.join(root, "src", "app", "modules", "regulation.stores.js") };
    });
  }
};
const AUTH = path.join(root, "src", "app", "services", "auth.js");
const authSource = await readFile(AUTH, "utf8");
const own = { url: authSource.match(/export const SUPABASE_URL = "([^"]*)"/)[1], key: authSource.match(/export const SUPABASE_ANON_KEY = "([^"]*)"/)[1] };
const asked = { url: process.env.SELENE_SUPABASE_URL || "", key: process.env.SELENE_SUPABASE_KEY || "" };
if ((asked.url || asked.key) && !(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(asked.url) && /^sb_publishable_[\w-]+$/.test(asked.key))) {
  process.stderr.write("SELENE_SUPABASE_URL (https://<ref>.supabase.co) et SELENE_SUPABASE_KEY (sb_publishable_…, jamais la clé secrète) : les deux, ou aucune\n");
  process.exit(1);
}
const supabase = asked.url ? asked : own;
const otherProject = {
  name: "autre-projet",
  setup(b) {
    b.onLoad({ filter: /auth\.js$/ }, args => {
      if (path.resolve(args.path) !== AUTH) return undefined;
      const contents = authSource.replace(/export const SUPABASE_URL = "[^"]*"/, `export const SUPABASE_URL = ${JSON.stringify(supabase.url)}`)
        .replace(/export const SUPABASE_ANON_KEY = "[^"]*"/, `export const SUPABASE_ANON_KEY = ${JSON.stringify(supabase.key)}`);
      return { contents, loader: "js" };
    });
  }
};
const plugins = [sharedPlatform, ...(EDITION === "stores" ? [storesEdition] : []), ...(asked.url && asked.url !== own.url ? [otherProject] : [])];
const app = await build({ ...common, entryPoints: ["src/app/index.js"], format: "iife", globalName: "__selene", plugins });
process.stdout.write(JSON.stringify({ edition: EDITION, project: supabase.url === own.url ? "app" : "autre", supabase, platform: platformIife.outputFiles[0].text, app: app.outputFiles[0].text }));
