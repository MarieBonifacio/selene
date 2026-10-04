/* Donner un fichier à l'utilisatrice : par claude.ai (artefact), la feuille de partage de l'app native, le partage
   du navigateur (téléphone) ou un téléchargement. */
import { toast } from "./dom.js";
import { tr } from "../i18n/index.js";
import { platform } from "../../platform.js";
import { downloadsNS } from "../services/host.js";

/* Donne un fichier à l'utilisatrice : via claude.ai, l'app native (sa WebView ne télécharge pas), le partage du
   navigateur ou un téléchargement. Refermer la feuille de partage n'est pas une erreur. */
export async function downloadFile(filename, data, type, title) {
  if (downloadsNS) { try { await downloadsNS.save({ filename, data }); } catch (e) { toast(tr`Export annulé.`); } return; }
  if (platform.files.supported()) {
    try { await platform.files.share(filename, data, title); } catch (e) { if (!/cancel/i.test(String((e && e.message) || e))) toast(tr`L'export n'a pas pu être préparé sur cet appareil.`); }
    return;
  }
  try { const file = new File([data], filename, { type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
