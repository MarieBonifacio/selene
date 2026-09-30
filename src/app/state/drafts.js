/* Les brouillons : ce qu'on tapait dans un champ marqué data-draft survit à un rechargement, propre à l'appareil. */
import { platform } from "../../platform.js";
import { lastView } from "../shell/render.js";

/* ---- reprise : ce qui attend, sur l'accueil (dernier espace ouvert, son pont, les brouillons en cours) ---- */
const DRAFT_WHAT = { scrapIn: "un fragment", noteIn: "une note", rapNote: "une observation", chatIn: "un message", capSheetIn: "une capture" };
export function pendingDrafts() {
  const out = [];
  for (const k of platform.storage.keys()) { if (!k.startsWith(DRAFT_PREFIX)) continue;
    const [view, field] = k.slice(DRAFT_PREFIX.length).split(":"); if (view !== "accueil") out.push({ view, what: DRAFT_WHAT[field] || "un texte" }); }
  return out;
}
/* Brouillons : le texte en cours d'un champ libre survit à la fermeture de l'app (iOS tue volontiers une PWA
   en arrière-plan). Propres à l'appareil ; effacés quand le champ est envoyé, et à la déconnexion. */
export const DRAFT_PREFIX = "selene-draft:";
const draftKey = (view, el) => `${DRAFT_PREFIX}${view}:${el.id}`;
export function saveDraft(view, el) { if (!view || !el.id) return; try { if (el.value.trim()) platform.storage.set(draftKey(view, el), el.value); else platform.storage.remove(draftKey(view, el)); } catch {} }
export function loadDraft(view, el) { try { return platform.storage.get(draftKey(view, el)) || ""; } catch { return ""; } }
// Le brouillon d'une feuille (la capture de la barre basse) ne dépend pas de la vue ouverte derrière elle.
document.addEventListener("input", e => { if (e.target.dataset && e.target.dataset.draft !== undefined) saveDraft(e.target.closest && e.target.closest("dialog") ? "sheet" : lastView, e.target); });
