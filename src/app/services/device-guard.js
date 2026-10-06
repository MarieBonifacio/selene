/* La garde de déconnexion (ADR 27) : se déconnecter vide l'appareil, et un suivi « gardé sur cet appareil seulement »
   (state/local.js) n'existe nulle part ailleurs. Avant, la personne choisit : une sauvegarde complète, ou l'effacer.
   À part du type « regulation » : l'édition des stores (modules/regulation.stores.js) n'a pas ce type, mais un appareil
   peut encore garder une telle copie (une version précédente, une sauvegarde restaurée), et la déconnexion ne doit
   jamais la perdre en silence. */
import { createBackup } from "../../core/backup.js";
import { deleteModuleInstance } from "../../core/domain.js";
import { $, toast } from "../lib/dom.js";
import { downloadFile } from "../lib/download.js";
import { todayISO } from "../lib/format.js";
import { tr } from "../i18n/index.js";
import { errMsg } from "../lib/labels.js";
import { render } from "../shell/render.js";
import { forgetLocal, local, localCopy, localIds, withLocal } from "../state/local.js";
import { S, board, label, site } from "../state/site.js";
import { ask, openForm } from "../ui/dialogs.js";

const exportBackup = () => downloadFile(`selene-${todayISO()}.json`, createBackup(board.data, withLocal(site.data)), "application/json", tr`Sauvegarde Selene`);
/* « L'effacer définitivement » : le contenu part, et son talon avec lui. Un nom resté sur le compte survivrait à un
   effacement voulu et se présenterait, au retour, comme un accident (« ses données n'y sont plus »). La copie locale
   d'abord : tant qu'elle existe, absorbDeviceTrackers rend son talon au site. Le talon quitte le serveur avec la
   synchronisation que la déconnexion fait avant de vider l'appareil (authSignOut). */
function eraseTrackers(ids) {
  const s = S();
  for (const id of ids) {
    forgetLocal(id);
    if (Object.hasOwn(s.modules, id)) deleteModuleInstance(s.modules, s.config.modules, id, s.config.deleted);
    delete s.config.labels[id]; delete s.config.groups[id]; delete s.config.assistant.share[id];
  }
  site.save(); local.save(); render();
}
/* Avant une déconnexion (qui vide l'appareil) : ce qui n'existe qu'ici est exporté ou effacé, au choix.
   Rend faux si la personne annule : on ne se déconnecte pas. */
export function deviceSignOutGuard() {
  const ids = localIds(); if (!ids.length) return Promise.resolve(true);
  const names = ids.map(id => `« ${label(id) || localCopy(id).label} »`).join(", ");
  return new Promise(resolve => {
    openForm(tr`Avant de te déconnecter`, [{ n: "what", l: tr`Que faire de ce qui n'existe que sur cet appareil ?`, t: "select", o: [
      ["export", tr`Télécharger une sauvegarde complète, puis l'effacer d'ici`], ["erase", tr`L'effacer définitivement`]] }], { what: "export" },
    async v => {
      if (v.what === "export") { // un téléchargement qui échoue ne déconnecte pas : rien n'est encore effacé
        try { await exportBackup(); return resolve(true); } catch (e) { toast(errMsg(e, tr`Sauvegarde non téléchargée : rien n'a été effacé.`)); return resolve(false); }
      }
      const ok = await ask(tr`Effacer définitivement ${names} ? Il n'en existe aucune autre copie.`);
      if (ok) eraseTrackers(ids);
      resolve(ok);
    }, tr`${names} : gardé sur cet appareil seulement, nulle part ailleurs. Se déconnecter vide cet appareil.`);
    const d = $("#dlg"), onClose = () => { d.removeEventListener("close", onClose); if (d.returnValue !== "save") resolve(false); };
    if (d && d.addEventListener) d.addEventListener("close", onClose);
  });
}
