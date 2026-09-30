/* Sur claude.ai, les espaces de noms de l'hôte : le modèle sans clé (sample) et les téléchargements (downloads).
   null ailleurs, et tant que connectHost n'a pas répondu. */
import { platform } from "../../platform.js";

export let sampleNS = null, downloadsNS = null;
export async function connectHost() {
  if (!platform.claude.available()) return false;
  sampleNS = await platform.claude.use("sample"); downloadsNS = await platform.claude.use("downloads");
  return true;
}
