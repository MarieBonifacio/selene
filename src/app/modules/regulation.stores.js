/* Le type « regulation » dans l'édition des stores (docs/regulation.md, « Hors de l'offre publique » ; ADR 32) : absent.
   scripts/bundle.mjs met ce fichier à la place de regulation.js quand SELENE_EDITION=stores, pour l'AAB de Google Play
   et l'archive de l'App Store : ni écran, ni formulaire, ni texte du suivi n'entrent dans ce qu'Apple et Google
   examinent (une fonction cachée dans le binaire enfreint la règle 2.3.1 d'Apple). Le web, l'APK de la Release GitHub
   et Windows gardent regulation.js.
   Un compte qui a créé un tel suivi ailleurs le retrouve ici inerte : gardé tel quel dans le document (le noyau,
   core/regulation.js, le valide et le normalise comme dans l'édition complète, et il revient au serveur comme il en
   est venu), jamais actif ni montré (state/site.js, absentModule), jamais partagé avec l'assistant. Les Réglages en
   gardent une ligne, qui dit ce qu'il est et permet de le supprimer. Une copie gardée sur cet appareil (une version
   précédente, une sauvegarde restaurée) reste protégée à la déconnexion (services/device-guard.js). */
import { regulationOnDevice } from "../../core/regulation.js";
import { registerType } from "../registry.js";
import { tr } from "../i18n/index.js";
import { deviceId, forgetLocal } from "../state/local.js";
import { S } from "../state/site.js";

const note = () => tr`Ce suivi a été créé avec une autre version de Selene. Celle-ci ne l'ouvre pas : il est gardé tel quel, sans être lu ni modifié, et reste entier dans la version où il a été créé.`;
registerType("regulation", {
  absent: true,
  sensitive: true,
  view: () => `<p class="empty">${note()}</p>`,
  settings: () => `<p class="hint">${note()}</p>`,
  summary: () => "",
  context: () => "",
  recent: () => [],
  review: () => null,
  deleteNote: id => { const inst = S().modules[id]; return regulationOnDevice(inst) && inst.config.holder !== deviceId() ? tr`Ici, il n'y a que le nom de ce suivi : son contenu est gardé sur un autre appareil. Si cet appareil existe encore, le suivi y reste entier et son nom reviendra : supprime-le plutôt depuis celui-ci. S'il est perdu, ou si Selene y a été réinstallée, retirer ce nom est définitif.` : tr`Cette version ne sait pas ouvrir ce suivi : le supprimer efface son contenu de ton compte, partout, sans retour.`; },
  onDelete: id => forgetLocal(id)
});
/* Ce que l'édition complète exporte et que d'autres fichiers importent (shell/actions.js) : ici, rien à partager. */
export async function confirmSensitiveShare() {}
