/* Les sources de santé citées par « Reprendre la main » (npm run liens ; workflow Liens, une fois par mois) : chaque
   adresse https de docs/regulation.md et de l'interface du module est demandée, redirections suivies.
   - échoue (code 1) sur une page disparue : 404, 410, ou un domaine qui n'existe plus (DNS : ENOTFOUND) ;
   - signale seulement, sans échouer, un refus ou un incident : 401, 403, 429, 5xx, délai dépassé, connexion ou
     certificat refusés. Un site qui bloque le robot de GitHub ne dit rien de sa page, et une vérification qui échoue
     pour rien finit par ne plus être lue.
   Rien n'est réécrit : corriger une adresse reste un geste humain (et sa traduction, si le texte change). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
export const FILES = ["docs/regulation.md", "src/app/modules/regulation.js"];

/* Les adresses https d'un texte (Markdown ou JavaScript), sans ponctuation finale ni doublon. */
export function extractUrls(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/https:\/\/[^\s<>"'`)\]]+/g)) out.add(m[0].replace(/[.,;:!?»]+$/, ""));
  return [...out];
}
/* Le verdict d'une réponse : "ok", "refus" (signalé) ou "absente" (échec). `error` : une erreur réseau, par son code. */
export function verdict({ status = 0, error = "" } = {}) {
  if (error) return error.includes("ENOTFOUND") ? "absente" : "refus";
  if (status >= 200 && status < 400) return "ok";
  if (status === 404 || status === 410) return "absente";
  return "refus";
}
async function check(url) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ac.signal, headers: { "User-Agent": "selene-liens (+https://github.com/MarieBonifacio/selene)" } });
    return { url, status: r.status };
  } catch (e) {
    return { url, error: ac.signal.aborted ? "délai dépassé" : String(e?.cause?.code || e?.code || e?.message || e) };
  } finally { clearTimeout(t); }
}

async function main() {
  const urls = [...new Set(FILES.flatMap(f => extractUrls(fs.readFileSync(path.join(root, f), "utf8"))))].sort();
  const results = await Promise.all(urls.map(check));
  let missing = 0;
  for (const r of results) {
    const v = verdict(r), what = r.error || `HTTP ${r.status}`;
    if (v === "ok") console.log(`  ✓ ${r.url}`);
    else if (v === "refus") console.log(`::warning title=Lien non vérifiable::${r.url} (${what}) : le site refuse ou ne répond pas ; à vérifier à la main.`);
    else { missing++; console.log(`::error title=Lien mort::${r.url} (${what}) : la page n'existe plus ; corriger l'adresse (et sa source dans docs/regulation.md).`); }
  }
  console.log(`Adresses vérifiées : ${urls.length} ; absentes : ${missing}.`);
  if (missing) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
