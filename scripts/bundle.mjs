/* Assemble Selene pour build.py, qui l'appelle et lit sur la sortie standard, en JSON, deux fonctions immédiatement
   exécutées (esbuild, modules ES) :
   - platform : src/platform.js, qui pose `var __platform = { platform, hosted, … }`. Évaluée d'abord : elle ouvre le
     stockage (IndexedDB, coffres natifs) avant que quoi que ce soit ne le lise ;
   - app : src/app/index.js et tout ce qu'il importe (noyau compris), qui pose `var __selene = { …exportations }`.
     build.py la place dans platform.ready. Ses imports de src/platform.js ne l'embarquent pas une seconde fois : ils
     sont servis par `__platform` (une seule façade, un seul état). Les noms en sont lus, pas tenus à la main.
   Chemins relatifs à la racine du dépôt, où qu'on lance le script : la sortie est identique d'une machine à l'autre.
   L'édition (SELENE_EDITION) : complète par défaut ; « stores » pour Google Play et l'App Store, où le type « Reprendre
   la main » n'entre pas : src/app/modules/regulation.js y est remplacé par regulation.stores.js (docs/regulation.md). */
import { build } from "esbuild";
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
const plugins = EDITION === "stores" ? [sharedPlatform, storesEdition] : [sharedPlatform];
const app = await build({ ...common, entryPoints: ["src/app/index.js"], format: "iife", globalName: "__selene", plugins });
process.stdout.write(JSON.stringify({ edition: EDITION, platform: platformIife.outputFiles[0].text, app: app.outputFiles[0].text }));
