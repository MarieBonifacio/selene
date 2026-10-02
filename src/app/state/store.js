/* Un store = un document JSON gardé dans le stockage de l'appareil (platform.storage, source de vérité locale) et,
   une fois connecté, synchronisé avec une base distante par lecture → fusion à trois
   voies → écriture conditionnelle. La « base » (dernier état commun connu avec le
   serveur) est gardée à côté, sous `${key}-base` : c'est elle qui permet de savoir qui
   a modifié quoi, donc de ne rien écraser.
   Contrat de `db.doc(path)` : get() → {exists, data()} ; onSnapshot(cb, err, connu) → désabonnement, où `connu()` donne
   la date (updatedAt) de la dernière version commune quand l'appareil n'a rien à envoyer (null sinon) : une base qui
   relit par intervalles peut s'épargner le document quand le serveur a la même (facultatif) ;
   et soit replace(value, attendu, {keepalive}) → booléen (écriture conditionnelle, false = le
   serveur a changé entre-temps), soit à défaut set(value) (écriture inconditionnelle).
   `normalize(doc)` remet un document dans la forme attendue ; il est appliqué à tout ce qui entre
   dans le store (lecture locale, synchro, import, réinitialisation), jamais à la lecture. */
import { platform } from "../../platform.js";
import { SCHEMA_VERSION } from "../../core/domain.js";
import { deepEqual, mergeDocs } from "../../core/sync.js";
import { tr } from "../i18n/index.js";

// Une copie profonde d'un document JSON (ce que le stockage et le serveur échangent).
export const clone = o => JSON.parse(JSON.stringify(o));
/* Ce que pèse un document envoyé au serveur : ses octets en UTF-8 (sans TextEncoder, absent de certains bancs d'essai).
   Le serveur refuse un espace de plus de DOC_MAX (contrainte app_state_taille, supabase/schema.sql) ; Réglages prévient
   à partir de DOC_WARN. */
export const DOC_MAX = 5e6, DOC_WARN = 3e6;
export function utf8Bytes(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1; else if (c < 0x800) n += 2; else if (c >= 0xd800 && c < 0xdc00) { n += 4; i++; } else n += 3;
  }
  return n;
}
/* `onRemoteChange` : une synchronisation a changé le document (la page se redessine) ; `onStatus(message)` : l'état de
   l'enregistrement à montrer ("" quand tout est parti). Le store ne connaît pas l'interface : elle s'y abonne. */
export function makeStore(key, path, seed, normalize = d => d, { onRemoteChange = () => {}, onStatus = () => {} } = {}) {
  const BASE = key + "-base";
  const read = k => { try { const v = platform.storage.get(k); return v ? JSON.parse(v) : null; } catch { return null; } };
  const s = { db: null, timer: null, unsub: null, syncing: null, again: false, key };
  s.data = normalize(read(key) || seed());
  // Une migration faite au chargement est écrite aussitôt : sinon, sans synchro (artefact, hors ligne),
  // chaque chargement la referait depuis l'ancienne forme (et, pour le board, reverserait des tâches supprimées).
  try { const raw = platform.storage.get(key); if (raw && raw !== JSON.stringify(s.data)) platform.storage.set(key, JSON.stringify(s.data)); } catch {}
  s.base = read(BASE);
  const saveLS = () => { try { platform.storage.set(key, JSON.stringify(s.data)); } catch {} };
  const saveBase = () => { try { if (s.base) platform.storage.set(BASE, JSON.stringify(s.base)); else platform.storage.remove(BASE); } catch {} };
  const write = (doc, value, expected, opts) => doc.replace ? doc.replace(value, expected, opts) : doc.set(value).then(() => true);

  async function syncOnce(db, prefetched) {
    const doc = db.doc(path);
    for (let attempt = 0; attempt < 3; attempt++) {
      const snap = prefetched || await doc.get();
      prefetched = null;
      if (s.db !== db) return; // déconnecté pendant l'attente (déconnexion, changement de compte)
      const remote = snap.exists ? snap.data() : null, local = clone(s.data), force = s.force;
      if (remote && (remote.schemaVersion || 0) > SCHEMA_VERSION) throw Object.assign(new Error("Données au format plus récent"), { stale: true });
      let merged = force ? local : mergeDocs(s.base, local, remote); // import de sauvegarde : on remplace, on ne fusionne pas
      if (remote && deepEqual({ ...merged, updatedAt: 0 }, { ...remote, updatedAt: 0 })) merged = remote; // rien de neuf à envoyer
      else {
        merged = { ...merged, updatedAt: Math.max(Date.now(), ((remote && remote.updatedAt) || 0) + 1) };
        const ok = await write(doc, clone(merged), remote ? remote.updatedAt : null);
        if (s.db !== db) return;
        if (!ok) continue; // un autre appareil a écrit entre notre lecture et notre écriture : on relit
      }
      if (force) s.force = false;
      s.base = clone(merged); saveBase();
      // Ce que l'utilisatrice a modifié pendant l'aller-retour réseau est refusionné par-dessus.
      const next = normalize(deepEqual(s.data, local) ? clone(merged) : mergeDocs(local, s.data, merged));
      if (!deepEqual(next, merged)) s.again = true;
      const changed = !deepEqual(next, s.data);
      s.data = next; saveLS();
      if (changed) onRemoteChange();
      return;
    }
    throw new Error("Conflit d'écriture persistant");
  }
  /* Une seule synchro à la fois par store ; une demande pendant qu'une autre tourne la relance à la fin.
     Résout à true si tout est à jour, false si on est resté en local. */
  s.sync = prefetched => {
    const db = s.db;
    if (!db) return Promise.resolve(false);
    if (s.syncing) { s.again = true; return s.syncing; }
    s.syncing = (async () => {
      try {
        do { s.again = false; await syncOnce(db, prefetched); prefetched = null; } while (s.again && s.db === db);
        onStatus("");
        return true;
      } catch (e) {
        onStatus(e.stale ? tr`Selene a été mise à jour sur un autre appareil : recharge la page pour synchroniser`
          : e.tooBig ? tr`Trop volumineux pour le serveur : enregistré sur cet appareil seulement (Réglages, Sauvegarde)`
          : tr`Non synchronisé — enregistré sur cet appareil seulement`);
        return false;
      } finally { s.syncing = null; }
    })();
    return s.syncing;
  };
  s.save = () => {
    s.data.updatedAt = Date.now(); saveLS();
    if (!s.db) return;
    onStatus(tr`Enregistrement…`); clearTimeout(s.timer);
    s.timer = setTimeout(() => { s.timer = null; s.sync(); }, 900);
  };
  /* Fermeture ou mise en arrière-plan : pas le temps de relire, donc une seule écriture conditionnelle
     sur la base connue (keepalive = survit à la fermeture de l'onglet). Si le serveur a bougé, elle est
     refusée sans dégât : les données restent sur l'appareil et seront fusionnées au prochain lancement. */
  s.flush = () => {
    if (!s.timer || !s.db) return;
    clearTimeout(s.timer); s.timer = null;
    const expected = s.base ? s.base.updatedAt : null;
    const value = clone({ ...s.data, updatedAt: Math.max(s.data.updatedAt || 0, (expected || 0) + 1) });
    const db = s.db;
    write(db.doc(path), value, expected, { keepalive: true })
      .then(ok => { if (ok && s.db === db) { s.base = value; saveBase(); } }, () => {});
  };
  /* Remplacement total voulu (import d'une sauvegarde) : la prochaine synchro écrase le serveur
     au lieu de fusionner — toujours par écriture conditionnelle, donc sans course avec un autre appareil. */
  s.replaceAll = data => { s.data = normalize(data); s.force = true; s.save(); };
  /* Y a-t-il ici des changements que le serveur n'a pas (encore) reçus ? */
  s.unsynced = () => !s.base || !deepEqual({ ...s.data, updatedAt: 0 }, { ...s.base, updatedAt: 0 });
  s.reload = () => {
    const r = read(key);
    if (r && (r.updatedAt || 0) > (s.data.updatedAt || 0)) { s.data = normalize(r); s.base = read(BASE) || s.base; return true; }
    return false;
  };
  s.connect = async db => {
    s.db = db;
    if (!await s.sync()) { if (s.db === db) s.db = null; return; } // hors ligne, jeton expiré… : on reste en local
    if (s.db !== db) return;
    const unsub = db.doc(path).onSnapshot(snap => s.sync(snap), () => {}, () => s.base && !s.timer && !s.unsynced() ? s.base.updatedAt : null);
    s.unsub = typeof unsub === "function" ? unsub : null;
  };
  s.disconnect = () => {
    clearTimeout(s.timer); s.timer = null;
    if (s.unsub) s.unsub();
    s.unsub = null; s.db = null;
  };
  /* Changement de compte ou déconnexion : on oublie tout, y compris la base (elle appartenait à l'autre compte). */
  s.reset = data => {
    s.disconnect();
    s.data = normalize(data); s.base = null;
    platform.storage.remove(key); platform.storage.remove(BASE);
  };
  return s;
}
