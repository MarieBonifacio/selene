/* ================= fusion à trois voies (pure : ni DOM ni stockage) =================
   base   = dernier état connu commun avec le serveur (ce qu'on a lu ou écrit en dernier)
   local  = état de cet appareil ; remote = état actuel du serveur.
   Un côté qui n'a pas bougé par rapport à la base cède la place à l'autre. Si les deux
   ont bougé : les objets fusionnent clé par clé, les listes d'objets à `id` entrée par
   entrée (ajouts des deux côtés conservés, suppression appliquée seulement si l'autre
   côté n'a pas modifié l'entrée), et pour une simple valeur le plus récent gagne
   (`preferLocal`, décidé une fois pour tout le document d'après updatedAt). */
const isRecord = v => v !== null && typeof v === "object" && !Array.isArray(v);
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}
const idList = v => Array.isArray(v) && v.every(x => isRecord(x) && typeof x.id === "string");

// Fusionne deux collections indexées (clés d'objet ou ids de liste) ; renvoie les paires [clé, valeur] gardées.
function mergeEntries(keys, get, base, local, remote, preferLocal) {
  const out = [];
  for (const k of keys) {
    const inB = get.has(base, k), inL = get.has(local, k), inR = get.has(remote, k);
    const b = inB ? get.at(base, k) : undefined;
    if (inL && inR) out.push([k, merge3(b, get.at(local, k), get.at(remote, k), preferLocal)]);
    else if (inL) { if (!(inB && deepEqual(b, get.at(local, k)))) out.push([k, get.at(local, k)]); } // supprimé à distance, sauf si modifié ici
    else if (inR) { if (!(inB && deepEqual(b, get.at(remote, k)))) out.push([k, get.at(remote, k)]); }
  }
  return out;
}
const objAccess = { has: (o, k) => isRecord(o) && Object.hasOwn(o, k), at: (o, k) => o[k] };
const listAccess = { has: (l, k) => Array.isArray(l) && l.some(x => x && x.id === k), at: (l, k) => l.find(x => x.id === k) };

function merge3(base, local, remote, preferLocal) {
  if (deepEqual(local, remote)) return local;
  if (base !== undefined && deepEqual(base, local)) return remote;
  if (base !== undefined && deepEqual(base, remote)) return local;
  if (isRecord(local) && isRecord(remote)) {
    const keys = [...new Set([...Object.keys(remote), ...Object.keys(local), ...(isRecord(base) ? Object.keys(base) : [])])];
    return Object.fromEntries(mergeEntries(keys, objAccess, base, local, remote, preferLocal));
  }
  if (idList(local) && idList(remote)) {
    // Ordre : celui du serveur, puis les ajouts locaux dans leur ordre d'origine.
    const ids = [...new Set([...remote.map(x => x.id), ...local.map(x => x.id), ...(idList(base) ? base.map(x => x.id) : [])])];
    return mergeEntries(ids, listAccess, idList(base) ? base : undefined, local, remote, preferLocal).map(([, v]) => v);
  }
  return preferLocal ? local : remote;
}
/* Point d'entrée pour un document entier. Sans base (premier contact de cet appareil) :
   un appareil vierge (updatedAt nul, jamais modifié) adopte le serveur tel quel, sinon
   on fusionne sans rien supprimer — mieux vaut une entrée ressuscitée qu'une entrée perdue. */
function mergeDocs(base, local, remote) {
  if (!remote) return local;
  if (!base && !local.updatedAt) return remote;
  return merge3(base || undefined, local, remote, (local.updatedAt || 0) >= (remote.updatedAt || 0));
}
