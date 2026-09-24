function makeStore(key, path, seed) {
  const s = { db: null, timer: null };
  try { const v = localStorage.getItem(key); s.data = v ? JSON.parse(v) : seed(); } catch { s.data = seed(); }
  const saveLS = () => { try { localStorage.setItem(key, JSON.stringify(s.data)); } catch {} };
  s.save = () => {
    s.data.updatedAt = Date.now(); saveLS();
    if (!s.db) return;
    setSaving("Enregistrement…"); clearTimeout(s.timer);
    s.timer = setTimeout(async () => {
      try { await s.db.doc(path).set(clone(s.data)); setSaving(""); }
      catch { setSaving("Enregistré sur cet appareil seulement"); }
    }, 900);
  };
  s.flush = () => { if (s.timer && s.db) { clearTimeout(s.timer); s.timer = null; s.db.doc(path).set(clone(s.data)).catch(() => {}); } };
  s.key = key; s.reload = () => { try { const v = localStorage.getItem(key); if (v) { const r = JSON.parse(v); if ((r.updatedAt || 0) > (s.data.updatedAt || 0)) { s.data = r; return true; } } } catch {} return false; };
  s.connect = async db => {
    s.db = db;
    try {
      const snap = await db.doc(path).get();
      if (snap.exists) {
        const r = snap.data();
        if ((r.updatedAt || 0) >= (s.data.updatedAt || 0)) { s.data = clone(r); saveLS(); render(); } else s.save();
      } else s.save();
      db.doc(path).onSnapshot(sn => {
        if (!sn.exists) return;
        const r = sn.data();
        if ((r.updatedAt || 0) > (s.data.updatedAt || 0)) { s.data = clone(r); saveLS(); render(); }
      }, () => {});
    } catch { s.db = null; }
  };
  return s;
}
