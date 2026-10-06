/* L'espace `db` de l'artefact claude.ai (PLT-011 du cahier de recette ; ADR 33). Les documents d'un artefact sont
   partagés par défaut : toute personne connectée à qui l'on en donne le lien les lit, et, sur un abonnement d'équipe,
   les membres peuvent les réécrire. Selene range donc les siens dans le sous-arbre privé de la personne qui l'ouvre
   (data/users/<id>/…), que la plateforme cache à tous les autres, propriétaire de l'artefact comprise : partager le
   lien partage l'outil, pas le carnet. La publication déclare `db` et `user` (sans `user`, pas d'identité) ; sans
   identité, rien n'est synchronisé et tout reste dans ce navigateur, jamais sur un chemin partagé.
   Les versions d'avant écrivaient site/state et board/state, partagés. À l'ouverture par la propriétaire, ce qu'ils
   contiennent est versé dans ses documents (fusion sans base : rien de ce qui a été noté n'est perdu), puis effacé une
   fois ses deux documents privés synchronisés. Chez quelqu'un d'autre, la copie locale de ce carnet partagé est oubliée :
   elle appartenait à la propriétaire, qui la garde. */
import { platform } from "../../platform.js";
import { setSaving } from "../lib/dom.js";
import { tr } from "../i18n/index.js";
import { board, site, siteSeed } from "../state/site.js";

// L'identité claude.ai à qui appartiennent les données de ce navigateur, posée à la première synchronisation réussie.
export const ARTIFACT_UID_KEY = "selene-artifact-uid";
const LEGACY = ["site/state", "board/state"];
// "site/state" → "data/users/<id>/site" : un document (quatre segments) du sous-arbre de la personne.
export const privatePath = (uid, path) => `data/users/${uid}/${path.split("/")[0]}`;

/* Brancher les deux documents sur l'espace privé. Résout à true quand les deux sont synchronisés. */
export async function connectArtifact() {
  const db = await platform.claude.use("db");
  if (!db) return false;
  const user = await platform.claude.use("user");
  const uid = user ? await user.id() : null;
  if (!uid) { setSaving(tr`Non synchronisé — enregistré sur cet appareil seulement`); return false; }
  const mine = platform.storage.get(ARTIFACT_UID_KEY);
  if (mine && mine !== uid) { setSaving(tr`Non synchronisé : ce navigateur garde le Selene d'un autre compte claude.ai`); return false; }
  const legacy = {};
  if (!mine) {
    if (await user.isOwner()) {
      for (const p of LEGACY) { try { const s = await db.doc(p).get(); if (s.exists) legacy[p] = s.data(); } catch {} }
    } else if (site.base || board.base) {
      // Synchronisé autrefois avec le document partagé : c'est le carnet de la propriétaire, pas celui de cette personne.
      site.reset(siteSeed()); board.reset({ updatedAt: 0, tasks: [] });
    }
  }
  const own = { doc: path => db.doc(privatePath(uid, path)) };
  if (legacy[LEGACY[0]]) site.absorb(legacy[LEGACY[0]]);
  await site.connect(own); // le site d'abord (voir absorbBoard, state/site.js)
  if (legacy[LEGACY[1]]) board.absorb(legacy[LEGACY[1]]);
  await board.connect(own);
  if (site.db !== own || board.db !== own) return false; // l'ancien partagé reste, versé de nouveau la fois suivante
  platform.storage.set(ARTIFACT_UID_KEY, uid);
  for (const p of Object.keys(legacy)) { try { await db.doc(p).delete(); } catch {} }
  return true;
}
