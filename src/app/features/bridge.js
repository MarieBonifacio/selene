/* Le pont de reprise : une phrase laissée en quittant un module, relue en y revenant. */
import { setResume } from "../../core/domain.js";
import { CLICK } from "../registry.js";
import { $, esc, toast, toastUndo } from "../lib/dom.js";
import { ago, diffDays, todayISO } from "../lib/format.js";
import { render } from "../shell/render.js";
import { S, site } from "../state/site.js";

/* Pont de reprise.
   En haut de chaque module : le prochain geste noté la dernière fois, ou de quoi le noter en partant.
   Le champ s'ouvre de lui-même à la fin du minuteur ; l'ignorer suffit à le refuser. */
export let bridgeOpen = null;
export const setBridgeOpen = id => { bridgeOpen = id; }; // le module dont le pont est ouvert (null : aucun)
 // module dont le champ « prochain geste » est ouvert
export const bridgeStale = r => diffDays(todayISO(), r.at) > 14;
 // un pont vieux de deux semaines ment peut-être
export function bridgeBar(id, inst) {
  const r = inst.resume, m = esc(id);
  if (bridgeOpen === id) return `<div class="bridge"><input id="bridgeIn" data-mod="${m}" maxlength="200" value="${esc(r ? r.text : "")}" placeholder="Le prochain geste, pour la prochaine fois…" aria-label="Prochain geste"><button class="btn sm acc" data-act="bridge-save" data-mod="${m}">Garder</button><button class="btn ghost sm" data-act="bridge-close">plus tard</button></div>`;
  if (r) return `<div class="bridge on ${bridgeStale(r) ? "stale" : ""}"><span>↳ <b>Reprendre :</b> ${esc(r.text)} <span class="hint">· noté ${ago(r.at)}</span></span><span class="acts"><button class="btn ghost sm" data-act="bridge-done" data-mod="${m}">fait</button><button class="btn ghost sm" data-act="bridge-edit" data-mod="${m}">modifier</button></span></div>`;
  return `<div class="bridge off"><button class="btn ghost sm" data-act="bridge-edit" data-mod="${m}">Je m'arrête ici…</button></div>`;
}
export function bridgeSave(id) {
  const inst = S().modules[id], inp = $("#bridgeIn"); if (!inst || !inp) return;
  setResume(inst, inp.value, todayISO()); bridgeOpen = null; site.save(); render();
  toast(inst.resume ? "Noté. La prochaine fois commencera ici." : "Pont levé.");
}
CLICK["bridge-edit"] = el => { bridgeOpen = el.dataset.mod; render(); const i = $("#bridgeIn"); if (i) i.focus(); };
CLICK["bridge-save"] = el => bridgeSave(el.dataset.mod);
CLICK["bridge-close"] = () => { bridgeOpen = null; render(); };
CLICK["bridge-done"] = el => {
  const id = el.dataset.mod, inst = S().modules[id], old = inst.resume; if (!old) return;
  setResume(inst, "", todayISO()); site.save(); render();
  toastUndo("Repris. Le pont est levé.", () => {
    const cur = S().modules[id]; if (!cur || cur.resume) return;
    cur.resume = old; cur.resumeLog = (cur.resumeLog || []).slice(0, -1); site.save(); render();
  });
};
