/* « Sur cet appareil seulement » (ADR 27, docs/regulation.md) : les suivis sensibles, que Selene ne synchronise plus.
   Un second document, tenu par le même store que le site (makeStore), mais jamais relié au serveur. Le document
   synchronisé n'en garde qu'un talon (core/regulation.js, regulationStub) : le nom, la présence, l'appareil détenteur.
   Ce fichier ne lit pas le site lui-même (site.js l'importe : il lui passe son document) ; il garde :
     - l'identité de l'appareil (deviceId), non personnelle, qui survit à une déconnexion ;
     - le propriétaire du document (owner : le compte) : à un changement de compte, les suivis du compte précédent sont
       mis de côté, jamais montrés à l'autre ni effacés sans un geste (localSwitch) ;
     - la réconciliation à l'entrée du site (absorbDeviceTrackers) ;
     - la sauvegarde complète et sa restauration (withLocal, splitLocal). */
import { platform } from "../../platform.js";
import { tombKey } from "../../core/domain.js";
import { normalizeRegulation, regulationOnDevice, regulationStub } from "../../core/regulation.js";
import { todayISO, uid } from "../lib/format.js";
import { clone, makeStore } from "./store.js";

const KEY = "selene-local-v1", DEVICE_KEY = "selene-device-id", LAST_UID_KEY = "selene-auth-last-uid";
const stashKey = owner => `${KEY}:${owner}`;
export function deviceId() {
  let id = null;
  try { id = platform.storage.get(DEVICE_KEY); } catch {}
  if (!id || !/^[\w-]{1,64}$/.test(id)) { id = `d${uid()}${uid()}`; try { platform.storage.set(DEVICE_KEY, id); } catch {} }
  return id;
}
/* Ce que le talon dit de l'appareil détenteur, pour qu'on le reconnaisse (RLM-029) : le navigateur ou l'app, et le
   système, sans version ni rien d'autre. */
export function describeDevice(ua, runtime) {
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPod/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Windows/.test(ua) ? "Windows"
    : /CrOS/.test(ua) ? "ChromeOS" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const shell = ["capacitor", "tauri", "native"].includes(runtime) ? "App Selene" : /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [shell, os].filter(Boolean).join(" · ");
}
const deviceName = () => { try { return describeDevice(String(navigator.userAgent || ""), platform.runtime()); } catch { return ""; } };
// Le talon d'un suivi gardé ici, d'après sa copie locale (la date où cet appareil l'a pris).
const stubOf = (inst, me, own = inst) => regulationStub(inst, me, { name: deviceName(), since: own && own.config && own.config.holderSince });
const lastUid = () => { try { return platform.storage.get(LAST_UID_KEY) || ""; } catch { return ""; } };
const seed = () => ({ updatedAt: 0, owner: lastUid(), modules: {} });
function normalizeLocal(d) {
  if (!d.modules || typeof d.modules !== "object" || Array.isArray(d.modules)) d.modules = {};
  if (typeof d.owner !== "string") d.owner = "";
  for (const inst of Object.values(d.modules)) normalizeRegulation(inst);
  return d;
}
export const local = makeStore(KEY, null, seed, normalizeLocal);
export const localCopy = id => Object.hasOwn(local.data.modules, id) ? local.data.modules[id] : null;
export const localIds = () => Object.keys(local.data.modules);

/* Un suivi passe sur l'appareil : son contenu entier va dans le document local, le site n'en garde que le talon.
   `siteDoc` : le document du site (modifié ici) ; à l'appelant d'enregistrer les deux. */
export function moveToDevice(siteDoc, id) {
  const inst = siteDoc.modules[id], me = deviceId(), full = clone(inst);
  full.config.storage = "device"; full.config.holder = me; full.config.holderSince = todayISO(); delete full.config.consent;
  local.data.modules[id] = full;
  siteDoc.modules[id] = stubOf(inst, me, full);
  if (!local.data.owner) local.data.owner = lastUid();
  return full;
}
export function forgetLocal(id) { if (localCopy(id)) { delete local.data.modules[id]; local.save(); } }

/* À l'entrée de chaque version du site (lecture, synchronisation, import), sur l'appareil détenteur :
   - un talon qui porte des données (renvoyées par un appareil resté hors ligne) les rend ici, puis redevient un talon ;
   - un suivi local dont le talon a disparu du site retrouve son talon : un autre appareil ne peut pas effacer ce qu'il
     ne voit pas. Seulement pour le compte propriétaire du document local. Rend vrai si le site a changé. */
export function absorbDeviceTrackers(siteDoc) {
  if (!siteDoc.modules) return false;
  const me = deviceId(), owner = local.data.owner, here = lastUid();
  if (owner && here && owner !== here) return false;
  let changed = false, localChanged = false;
  for (const [id, inst] of Object.entries(siteDoc.modules)) {
    if (!regulationOnDevice(inst) || inst.config.holder !== me) continue;
    const stray = (inst.goals || []).length || (inst.entries || []).length;
    if (!stray && JSON.stringify(inst.config) === JSON.stringify(stubOf(inst, me, localCopy(id) || inst).config)) continue;
    const own = localCopy(id);
    if (!own) { local.data.modules[id] = { ...clone(inst), config: { ...clone(inst.config), storage: "device", holder: me } }; }
    else for (const list of ["goals", "entries"]) for (const x of inst[list] || []) {
      const i = own[list].findIndex(y => y.id === x.id), mine = own[list][i];
      if (!mine) own[list].push(clone(x)); // une saisie faite ailleurs avant le passage sur l'appareil : gardée
      else if ((x.editedAt || x.at || 0) > (mine.editedAt || mine.at || 0)) own[list][i] = clone(x); // la plus récente
    }
    siteDoc.modules[id] = stubOf(inst, me, localCopy(id));
    changed = true; localChanged = true;
  }
  for (const id of localIds()) if (!Object.hasOwn(siteDoc.modules, id)) {
    siteDoc.modules[id] = stubOf(localCopy(id), me); changed = true;
    if (siteDoc.config && siteDoc.config.deleted) delete siteDoc.config.deleted[tombKey(id)]; // son nom revient partout
  }
  if (localChanged) local.save();
  return changed;
}

/* Changement de compte sur cet appareil : les suivis locaux du compte précédent sont mis de côté (sous une clé à son
   nom), jamais montrés au nouveau ; ceux du nouveau, s'il en avait laissé ici, reviennent. */
export function localSwitch(uidNow) {
  const owner = local.data.owner;
  if (owner === uidNow) return;
  if (!owner) { local.data.owner = uidNow; local.save(); return; } // sans propriétaire : adopté, jamais vidé
  if (localIds().length) { try { platform.storage.set(stashKey(owner), JSON.stringify(local.data)); } catch {} }
  let back = null;
  try { const raw = platform.storage.get(stashKey(uidNow)); back = raw ? JSON.parse(raw) : null; platform.storage.remove(stashKey(uidNow)); } catch {}
  local.reset(back || { updatedAt: 0, owner: uidNow, modules: {} });
  local.data.owner = uidNow; local.save();
}
/* Déconnexion voulue ou suppression du compte : ce qui n'existait qu'ici est effacé (après la garde de la déconnexion). */
export function localErase() {
  const owner = local.data.owner;
  if (owner) { try { platform.storage.remove(stashKey(owner)); } catch {} }
  local.reset({ updatedAt: 0, owner: "", modules: {} });
}

/* La sauvegarde complète : le site, avec le contenu des suivis gardés sur cet appareil à la place de leurs talons.
   Une sauvegarde est un fichier que la personne télécharge : il doit tout contenir. */
export function withLocal(siteDoc) {
  const out = clone(siteDoc);
  for (const id of localIds()) if (Object.hasOwn(out.modules, id)) out.modules[id] = { ...clone(localCopy(id)), label: out.modules[id].label };
  return out;
}
/* La restauration : chaque suivi « sur l'appareil » qui a un contenu revient sur cet appareil-ci (qui en devient le
   détenteur) ; le site reçoit son talon. Un talon sans contenu (sauvegarde faite ailleurs que chez le détenteur) reste
   tel quel. Rend le document local à installer. */
export function splitLocal(siteDoc) {
  const me = deviceId(), modules = {};
  for (const [id, inst] of Object.entries(siteDoc.modules || {})) {
    if (!regulationOnDevice(inst) || !((inst.goals || []).length || (inst.entries || []).length || inst.config.holder === me)) continue;
    const since = inst.config.holder === me && inst.config.holderSince ? inst.config.holderSince : todayISO();
    modules[id] = { ...clone(inst), config: { ...clone(inst.config), holder: me, holderSince: since } };
    siteDoc.modules[id] = stubOf(inst, me, modules[id]);
  }
  return { updatedAt: 0, owner: lastUid(), modules };
}
