/* Assemble le noyau (src/core, modules ES) pour build.py, qui l'appelle et lit sur la sortie standard, en JSON :
   - code : une fonction immédiatement exécutée qui pose `var __core = { …exportations }` ;
   - exports : les noms exportés, triés. esbuild ne les liste (métafichier) que pour une sortie ESM : d'où un second
     assemblage, jamais écrit, qui ne sert qu'à les lire. Aucune liste tenue à la main.
   Chemins relatifs à la racine du dépôt, où qu'on lance le script : la sortie est identique d'une machine à l'autre. */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const common = { absWorkingDir: root, entryPoints: ["src/core/index.js"], bundle: true, write: false, charset: "utf8", logLevel: "error" };
const [iife, esm] = await Promise.all([
  build({ ...common, format: "iife", globalName: "__core" }),
  build({ ...common, format: "esm", metafile: true })
]);
const exports = Object.values(esm.metafile.outputs).flatMap(o => o.exports).sort();
process.stdout.write(JSON.stringify({ code: iife.outputFiles[0].text, exports }));
