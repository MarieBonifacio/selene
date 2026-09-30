/* Donner un fichier à l'utilisatrice : par claude.ai (artefact), le partage natif (téléphone) ou un téléchargement. */
import { toast } from "./dom.js";
import { downloadsNS } from "../services/host.js";

/* Donne un fichier à l'utilisatrice : via claude.ai, le partage natif (téléphone) ou un téléchargement. */
export async function downloadFile(filename, data, type, title) {
  if (downloadsNS) { try { await downloadsNS.save({ filename, data }); } catch (e) { toast("Export annulé."); } return; }
  try { const file = new File([data], filename, { type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
