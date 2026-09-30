/* Le DOM au plus simple : sélecteur, échappement HTML, messages éphémères (avec « Annuler »), pagination des listes
   longues, état d'enregistrement. */
import { CLICK } from "../registry.js";
import { tr, trp } from "../i18n/index.js";

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* Le message loge dans la fenêtre modale ouverte (feuille, formulaire) s'il y en a une : sinon il passerait dessous,
   invisible, avec son « Annuler ». */
function toastHost() {
  const el = $("#toast");
  try { const open = [...document.querySelectorAll("dialog[open]")].pop(), host = open || document.body; if (el.parentNode !== host) host.appendChild(el); } catch {}
  return el;
}
export function toast(msg) { undoFn = null; const el = toastHost(); el.textContent = msg; el.classList.remove("act"); el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3400); }
/* Un message avec une action proposée (« Annuler », « Ajouter »…), qui disparaît d'elle-même : jamais imposée. */
let undoFn = null;
export function toastAction(msg, button, fn, ms = 6000) {
  const el = toastHost();
  el.innerHTML = `${esc(msg)} <button class="btn sm" data-act="undo">${esc(button)}</button>`;
  el.classList.add("show", "act"); undoFn = fn;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.classList.remove("show", "act"); undoFn = null; }, ms);
}
/* « Annuler » pendant quelques secondes, au lieu d'une confirmation avant d'agir. */
export const toastUndo = (msg, undo) => toastAction(msg, trp("toast", "Annuler"), undo);
/* Longues listes : les PAGE premiers éléments, puis « Voir les suivants ». Propre à l'appareil, remis à zéro
   quand on change de vue : une liste de milliers de fragments se calcule vite mais se parcourt mal au pouce. */
export const PAGE = 100, pageSize = {};
export function paged(key, list) {
  const n = pageSize[key] || PAGE, rest = list.length - n;
  return { items: list.slice(0, n), more: rest > 0 ? `<li class="more-row"><button class="btn ghost sm" data-act="page-more" data-k="${esc(key)}">${tr`Voir les ${Math.min(PAGE, rest)} suivants (${rest} de plus)`}</button></li>` : "" };
}
export function setSaving(t) { $("#saving").textContent = t; }
CLICK["undo"] = () => { const f = undoFn; undoFn = null; $("#toast").classList.remove("show", "act"); if (f) f(); };
