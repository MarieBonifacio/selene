/* Les infobulles : un « ? » qui ouvre une courte explication, au toucher comme à la souris ou au clavier. Jamais au
   survol seul, qui n'existe pas sur un écran tactile. L'API popover du navigateur fait l'essentiel : couche supérieure
   (au-dessus des feuilles), fermeture par Échap ou par un geste ailleurs, bouton annoncé comme déplié ou replié. Il
   reste à poser la bulle sous son bouton, dans l'écran. Sans l'API (navigateurs anciens), le texte s'affiche en clair,
   comme une indication. */
import { esc } from "../lib/dom.js";

let seq = 0;
/* `about` nomme ce que la bulle explique, pour qui n'entend que le bouton (« En savoir plus : Domaine »). */
export function tip(text, about) {
  const id = `tip-${++seq}`;
  return `<button type="button" class="tip" popovertarget="${id}" aria-label="${esc(about)}">?</button><span class="tipb" id="${id}" popover role="note">${esc(text)}</span>`;
}
function place(pop) {
  const btn = document.querySelector(`[popovertarget="${pop.id}"]`); if (!btn) return;
  const b = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 12, W = window.innerWidth, H = window.innerHeight;
  const left = Math.max(m, Math.min(b.left + b.width / 2 - w / 2, W - w - m));
  // Dessous si elle y tient, sinon dessus : jamais coupée par le bas de l'écran (ni par la barre basse).
  const top = b.bottom + 6 + h > H - m && b.top - 6 - h > m ? b.top - 6 - h : b.bottom + 6;
  pop.style.left = `${Math.round(left)}px`; pop.style.top = `${Math.round(top)}px`;
}
// « toggle » ne remonte pas : écouté à la capture, pour toutes les bulles de la page.
document.addEventListener("toggle", e => { if (e.newState === "open" && e.target.classList && e.target.classList.contains("tipb")) place(e.target); }, true);
// La page défile ou change de taille : la bulle ouverte suit son bouton.
const follow = () => { try { const o = document.querySelector(".tipb:popover-open"); if (o) place(o); } catch { /* sélecteur inconnu : pas de bulle */ } };
window.addEventListener("scroll", follow, { passive: true });
window.addEventListener("resize", follow);
