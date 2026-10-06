/* Le script du cahier à cocher (dist/recette/campagne.html), inséré tel quel par scripts/recette-campagne.mjs.
   Les cas arrivent en JSON dans la page (#data), déjà convertis en HTML échappé par le générateur ; tout ce qui vient
   de la base (noms de campagne, notes, preuves) est du texte saisi par d'autres : il ne passe que par textContent et
   value, jamais par innerHTML.
   Base (capacité « db » de l'artefact) :
     campagnes/<campagne>            { nom, type, cas: [identifiants], version, env, cahier, creee, par, archivee }
     campagnes/<campagne>/cas/<ID>   { etapes: { "1": { h, t, par } | null, final, nettoyage }, resultat, observe,
                                       plateforme, preuve, anomalie, maj, par }
   `h` est l'empreinte du texte de l'étape au moment de la coche : si le cahier la réécrit, la coche ressort
   « à revérifier » au lieu de valoir pour un texte qu'elle n'a pas vu. Une écriture à la fois par document ; les
   gestes rapides s'accumulent dans un correctif unique, envoyé dès que la précédente est revenue. */
(function () {
  "use strict";
  const D = JSON.parse(document.getElementById("data").textContent);
  const $ = id => document.getElementById(id);
  const RES = { reussi: "réussi", echoue: "échoué", bloque: "bloqué", na: "non applicable", todo: "non exécuté" };
  const RES_ORDER = ["reussi", "echoue", "bloque", "na", "todo"];
  const TYPES = { smoke: "smoke", ciblee: "non-régression ciblée", complete: "recette complète" };
  const byId = new Map(D.cas.map(c => [c.id, c]));
  const fileOf = new Map(D.domaines.map(d => [d.p, d.f]));

  let db = null, me = null, readOnly = false, dbReady = false;
  let camps = new Map(), cid = "", unsubCas = null, firstCamps = true;
  let remote = new Map(), pending = new Map(), created = new Set();
  const justCreated = new Map();
  const rendered = new Set();

  /* ---------- petits outils ---------- */
  const clone = o => JSON.parse(JSON.stringify(o || {}));
  const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
  function merge(target, src) {
    for (const k of Object.keys(src)) {
      if (isObj(src[k]) && isObj(target[k])) merge(target[k], src[k]);
      else target[k] = isObj(src[k]) ? clone(src[k]) : src[k];
    }
    return target;
  }
  const now = () => new Date().toISOString();
  const fmt = iso => { try { return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso; } };
  const fmtDay = iso => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; } };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const docId = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9_.~:@+-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 120);
  const escH = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("selene-recette-campagne") || "{}"); } catch (e) { return {}; } },
    set(patch) { try { localStorage.setItem("selene-recette-campagne", JSON.stringify(Object.assign(this.get(), patch))); } catch (e) { /* stockage refusé : rien de grave */ } }
  };
  function banner(text) { const b = $("banner"); b.textContent = text || ""; b.hidden = !text; }
  function saved(text, err) { const s = $("save"); s.textContent = text || ""; s.classList.toggle("err", !!err); }

  /* ---------- l'état d'un cas ---------- */
  const camp = () => camps.get(cid) || null;
  const inCamp = id => { const c = camp(); return !!c && Array.isArray(c.cas) && c.cas.includes(id); };
  function view(id) {
    const v = clone(remote.get(id));
    const q = pending.get(id);
    if (q && q.inflight) merge(v, q.inflight);
    if (q) merge(v, q.patch);
    return v;
  }
  // Les cases d'un cas : ses étapes, puis l'état final, puis le nettoyage s'il y en a un.
  const boxes = c => [...c.e.map(s => ({ k: s.n, h: s.h })), { k: "final", h: c.fin.h }, ...(c.net ? [{ k: "nettoyage", h: c.net.h }] : [])];
  function tally(c, v) {
    let done = 0, stale = 0;
    const et = v.etapes || {};
    for (const b of boxes(c)) { const s = et[b.k]; if (s && s.h === b.h) done++; else if (s) stale++; }
    return { done, stale, total: boxes(c).length };
  }
  const resOf = v => (v.resultat && RES[v.resultat]) ? v.resultat : "todo";

  /* ---------- écrire ---------- */
  async function retry(fn) {
    try { return await fn(); } catch (e) {
      if (e && ["invalid_argument", "quota_exceeded", "revoked", "not_granted", "capability_disabled", "capability_removed", "transform_error"].includes(e.code)) throw e;
      await new Promise(r => setTimeout(r, 400 + Math.random() * 800));
      return fn();
    }
  }
  function writeError(e) {
    const code = e && e.code;
    if (code === "invalid_argument" || code === "not_granted" || code === "revoked" || code === "capability_disabled" || code === "capability_removed") {
      setReadOnly("Lecture seule : cette vue ne peut pas enregistrer (accès en lecture, ou accès retiré). Ce qui est déjà coché reste lisible.");
    } else if (code === "quota_exceeded") {
      banner("La base de cette page est pleine : archive puis supprime d'anciennes campagnes (demande-le à Claude), ou publie le cahier dans un nouvel artefact.");
      saved("Pas enregistré : base pleine", true);
    } else saved("Pas enregistré : réseau ou service indisponible, refais le geste", true);
  }
  function change(id, patch) {
    if (!cid || readOnly || !db || !inCamp(id)) return;
    const q = pending.get(id) || { patch: {}, inflight: null };
    merge(q.patch, patch);
    pending.set(id, q);
    refreshCase(id);
    flush(id, q);
  }
  async function flush(id, q) {
    if (q.inflight || !Object.keys(q.patch).length) return;
    const myCid = cid, patch = q.patch, key = `${myCid}/${id}`;
    q.patch = {}; q.inflight = patch;
    const meta = { maj: now(), par: me };
    const ref = db.doc(`campagnes/${myCid}/cas/${id}`);
    saved("Enregistrement…");
    try {
      if (remote.has(id) || created.has(key)) await retry(() => ref.update(Object.assign({}, patch, meta)));
      else { await retry(() => ref.set(merge(merge(clone(remote.get(id)), patch), meta))); created.add(key); }
      saved(`Enregistré à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (e) { writeError(e); }
    q.inflight = null;
    if (pending.get(id) !== q) return;
    if (Object.keys(q.patch).length) flush(id, q); else { pending.delete(id); refreshCase(id); }
  }
  // Le document de campagne : une écriture à la fois, et un correctif calculé au moment d'écrire (deux ajouts
  // rapprochés partent chacun de la liste qui contient déjà l'autre).
  let campQueue = Promise.resolve();
  function writeCamp(make) {
    const myCid = cid;
    campQueue = campQueue.then(async () => {
      const c = camps.get(myCid);
      if (!db || readOnly || !c) return;
      const patch = typeof make === "function" ? make(c) : make;
      try { await retry(() => db.doc(`campagnes/${myCid}`).update(patch)); camps.set(myCid, Object.assign({}, c, patch)); } catch (e) { writeError(e); }
    });
    return campQueue;
  }
  function setReadOnly(msg) {
    readOnly = true;
    banner(msg);
    $("newBtn").disabled = true;
    for (const id of rendered) applyState(id);
    renderInfo();
  }

  /* ---------- la liste ---------- */
  const list = $("list");
  function buildList() {
    const frag = document.createDocumentFragment();
    for (const d of D.domaines) {
      const sec = el("section", "dom"); sec.dataset.dom = d.p; sec.id = `dom-${d.p.toLowerCase()}`;
      const n = D.cas.filter(c => c.d === d.p).length;
      sec.innerHTML = `<h2>${escH(d.t)} <span class="n" data-domn>${n} cas</span></h2><details class="intro"><summary>Préconditions communes du domaine</summary>${d.intro}</details>`;
      for (const c of D.cas.filter(x => x.d === d.p)) {
        const det = el("details", "case"); det.id = c.id.toLowerCase(); det.dataset.id = c.id;
        const cov = escH(c.cov.join(" · "));
        det.innerHTML = `<summary><span class="cid">${c.id}</span><span class="ct">${c.t}</span><span class="sp" data-sp></span>`
          + `<span class="cm"><span class="prio prio-${c.pr[1]}">${c.pr}</span><span>${escH(c.pl.join(", "))}</span><span class="pill r-todo" data-res>non exécuté</span>${cov ? `<span>${cov}</span>` : ""}<span data-out></span></span></summary>`;
        sec.appendChild(det);
      }
      frag.appendChild(sec);
    }
    const empty = el("p", "empty", "Aucun cas ne répond à ces filtres."); empty.id = "empty"; empty.hidden = true;
    frag.appendChild(empty);
    list.appendChild(frag);
  }
  function body(c) {
    const step = (k, num, a, r, label, cls) => `<div class="step${cls ? " " + cls : ""}" data-k="${k}"><label class="ck"><input type="checkbox" data-k="${k}" aria-label="${label}"><span class="num">${num}</span></label>`
      + (r == null ? `<div class="a" style="grid-column:2/-1">${a}</div>` : `<div class="a">${a}</div><div class="r">${r}</div>`) + `<span class="stale-msg" hidden>Étape réécrite depuis sa coche : à revérifier.</span></div>`;
    const steps = c.e.map(s => step(s.n, s.n, s.a, s.r, `Étape ${s.n} faite, résultat attendu observé`))
      .concat(step("final", "✓", `<span class="lbl">État final attendu</span> ${c.fin.html}`, null, "État final constaté", "fin"))
      .concat(c.net ? [step("nettoyage", "✓", `<span class="lbl">Nettoyage</span> ${c.net.html}`, null, "Nettoyage fait", "fin")] : []);
    const radios = RES_ORDER.map(r => `<label class="r-${r}"><input type="radio" name="res-${c.id}" value="${r}"> ${RES[r]}</label>`).join("");
    return `<div class="body">`
      + (c.obj ? `<p><span class="lbl">Risque vérifié</span> — ${c.obj}</p>` : "")
      + `<p><span class="lbl">Préconditions</span> — ${c.pre}</p><p><span class="lbl">Données</span> — ${c.don}</p>`
      + (c.ctx.length ? `<details class="ctx"><summary>Règle, tests associés, source</summary>${c.ctx.map(([l, v]) => `<p><span class="lbl">${l}</span> — ${v}</p>`).join("")}</details>` : "")
      + `<p class="out-note" data-add hidden><button class="btn" type="button" data-act="add">Ajouter ce cas à la campagne</button></p>`
      + `<fieldset data-fs><div class="steps" role="group" aria-label="Étapes de ${c.id}"><div class="sh"><span></span><span>Action précise</span><span>Résultat attendu observable</span></div>${steps.join("")}</div>`
      + c.x.map(([l, v]) => `<p><span class="lbl">${escH(l)}</span> — ${v}</p>`).join("")
      + `<div class="res"><div class="seg" role="radiogroup" aria-label="Résultat de ${c.id}">${radios}</div><p class="warn" data-warn></p>`
      + `<div class="fields"><label>Résultat observé (obligatoire s'il n'est pas « réussi »)<textarea data-f="observe" rows="2"></textarea></label>`
      + `<label>Plateforme (navigateur, appareil, version)<input type="text" data-f="plateforme" autocomplete="off"></label>`
      + `<label>Preuve (capture, vidéo, extrait, ou une phrase précise)<input type="text" data-f="preuve" autocomplete="off"></label>`
      + `<label>Anomalie (ticket)<input type="text" data-f="anomalie" autocomplete="off"></label></div>`
      + `<p class="who" data-who></p></div></fieldset></div>`;
  }
  const card = id => document.getElementById(id.toLowerCase());
  function ensureBody(id) {
    if (rendered.has(id)) return;
    card(id).insertAdjacentHTML("beforeend", body(byId.get(id)));
    rendered.add(id);
    applyState(id);
  }
  function applyState(id) {
    const c = byId.get(id), det = card(id), v = view(id), res = resOf(v), et = v.etapes || {};
    const fs = det.querySelector("[data-fs]");
    if (!fs) return;
    fs.disabled = !cid || readOnly || !db || !inCamp(id);
    det.querySelector("[data-add]").hidden = !cid || !db || readOnly || inCamp(id);
    for (const b of boxes(c)) {
      const s = et[b.k], row = det.querySelector(`.step[data-k="${b.k}"]`);
      row.querySelector("input").checked = !!s;
      row.classList.toggle("done", !!s && s.h === b.h);
      row.classList.toggle("stale", !!s && s.h !== b.h);
      row.querySelector(".stale-msg").hidden = !(s && s.h !== b.h);
    }
    for (const r of det.querySelectorAll(`input[name="res-${id}"]`)) r.checked = r.value === res;
    for (const f of det.querySelectorAll("[data-f]")) if (document.activeElement !== f) f.value = v[f.dataset.f] || "";
    const t = tally(c, v), warns = [];
    if (res !== "reussi" && res !== "todo" && !(v.observe || "").trim()) warns.push("Le résultat observé est obligatoire pour tout résultat autre que « réussi ».");
    if (res === "reussi" && t.done < t.total) warns.push(`« Réussi », alors que ${t.total - t.done} case${t.total - t.done > 1 ? "s ne sont pas cochées" : " n'est pas cochée"}.`);
    if (res === "echoue" && !(v.anomalie || "").trim()) warns.push("Un échec appelle un ticket : note-le dans « Anomalie ».");
    if (res === "na" && !(v.observe || "").trim()) warns.push("« Non applicable » se justifie : écris pourquoi.");
    det.querySelector("[data-warn]").textContent = warns.join(" ");
    det.querySelector("[data-who]").textContent = v.maj ? `Dernière modification le ${fmt(v.maj)}${v.par ? (v.par === me ? ", par toi" : ", par une autre personne") : ""}.` : "";
  }
  function refreshSummary(id) {
    const c = byId.get(id), det = card(id), v = view(id), res = resOf(v), t = tally(c, v);
    det.querySelector("[data-sp]").textContent = cid ? `${t.done}/${t.total}${t.stale ? ` · ${t.stale} à revoir` : ""}` : "";
    const pill = det.querySelector("[data-res]");
    pill.textContent = RES[res]; pill.className = `pill r-${res}`;
    pill.hidden = !cid;
    det.querySelector("[data-out]").textContent = cid && !inCamp(id) ? "hors campagne" : "";
    det.classList.toggle("out", !!cid && !inCamp(id));
  }
  let countsQueued = false;
  function refreshCase(id) {
    refreshSummary(id);
    if (rendered.has(id)) applyState(id);
    if (!countsQueued) { countsQueued = true; requestAnimationFrame(() => { countsQueued = false; renderCounts(); if (!$("infoPanel").hidden) renderInfo(); if (!$("crPanel").hidden) renderCr(); }); }
  }
  function refreshAll() { for (const c of D.cas) refreshCase(c.id); applyFilters(true); }

  /* ---------- chiffres et critères ---------- */
  function stats() {
    const c = camp(), ids = c && Array.isArray(c.cas) ? c.cas : [];
    const s = { ids, by: { reussi: [], echoue: [], bloque: [], na: [], todo: [] }, stale: 0, prio: {} };
    for (const id of ids) {
      const cas = byId.get(id), v = view(id), r = resOf(v);
      s.by[r].push(id);
      if (cas) {
        s.stale += tally(cas, v).stale;
        const p = s.prio[cas.pr] || (s.prio[cas.pr] = { reussi: 0, echoue: 0, bloque: 0, na: 0, todo: 0 });
        p[r]++;
      }
    }
    return s;
  }
  function renderCounts() {
    const c = camp(), prog = $("prog"), counts = $("counts");
    prog.textContent = "";
    if (!c) { counts.textContent = dbReady && db ? "Choisis ou crée une campagne : les coches s'y rangent." : counts.textContent; return; }
    const s = stats(), n = s.ids.length || 1;
    for (const r of ["reussi", "echoue", "bloque", "na"]) { const sp = el("span", `p-${r}`); sp.style.width = `${(100 * s.by[r].length) / n}%`; prog.appendChild(sp); }
    const parts = [`${s.ids.length - s.by.todo.length}/${s.ids.length} cas avec un résultat`];
    for (const r of RES_ORDER) if (s.by[r].length) parts.push(`${s.by[r].length} ${RES[r]}${s.by[r].length > 1 ? "s" : ""}`);
    if (s.stale) parts.push(`${s.stale} étape${s.stale > 1 ? "s" : ""} à revérifier`);
    counts.textContent = parts.join(" · ");
  }
  function criteria(c, s) {
    const P = id => (byId.get(id) || {}).pr;
    const v = id => view(id);
    const noTicket = s.by.echoue.filter(id => !(v(id).anomalie || "").trim());
    const naNoWhy = s.by.na.filter(id => !(v(id).observe || "").trim());
    const items = [];
    let cls = "ok", title;
    if (c.type === "smoke") {
      if (s.by.echoue.length || s.by.bloque.length) { cls = "ko"; title = "No-go selon les critères de la smoke : un seul échoué ou bloqué suffit."; items.push(...s.by.echoue.map(id => `${id} échoué`), ...s.by.bloque.map(id => `${id} bloqué`)); }
      else if (s.by.todo.length) { cls = "wait"; title = `${s.by.todo.length} cas non exécuté${s.by.todo.length > 1 ? "s" : ""} : rien à conclure encore.`; }
      else title = "Critères de sortie remplis : tous les cas réussis, hors non applicables justifiés.";
    } else {
      const p1ko = s.by.echoue.filter(id => P(id) === "P1"), p1bl = s.by.bloque.filter(id => P(id) === "P1");
      if (p1ko.length) { cls = "ko"; items.push(...p1ko.map(id => `${id} (P1) échoué`)); }
      if (p1bl.length) { if (c.type === "ciblee") cls = "ko"; else if (cls === "ok") cls = "wait"; items.push(...p1bl.map(id => `${id} (P1) bloqué${c.type === "complete" ? " : acceptation écrite de la responsable nécessaire" : ""}`)); }
      if (s.by.todo.length) { if (cls === "ok") cls = "wait"; items.push(`${s.by.todo.length} cas non exécuté${s.by.todo.length > 1 ? "s" : ""}${c.type === "complete" ? " (aucun n'est admis à la clôture)" : ""}`); }
      title = cls === "ok" ? "Critères de sortie remplis selon ce qui est saisi." : cls === "ko" ? "Critères de sortie non remplis." : "Pas encore de conclusion possible.";
    }
    if (noTicket.length) { if (cls === "ok") cls = "wait"; items.push(...noTicket.map(id => `${id} échoué sans ticket`)); }
    if (naNoWhy.length) { if (cls === "ok") cls = "wait"; items.push(...naNoWhy.map(id => `${id} non applicable sans raison écrite`)); }
    if (s.stale) { if (cls === "ok") cls = "wait"; items.push(`${s.stale} étape${s.stale > 1 ? "s" : ""} réécrite${s.stale > 1 ? "s" : ""} depuis sa coche, à revérifier`); }
    return { cls, title, items };
  }
  function synTable(s) {
    const t = el("table", "syn"), head = t.createTHead().insertRow();
    for (const h of ["Priorité", "Réussis", "Échoués", "Bloqués", "Non applicables", "Non exécutés"]) head.appendChild(el("th", "", h));
    const b = t.createTBody();
    for (const p of ["P1", "P2", "P3"]) { const r = b.insertRow(), x = s.prio[p] || {}; r.appendChild(el("td", "", p)); for (const k of RES_ORDER) r.appendChild(el("td", "", String(x[k] || 0))); }
    return t;
  }
  function renderInfo() {
    const c = camp();
    if (!c) return;
    const s = stats();
    for (const [inp, k] of [[$("iVersion"), "version"], [$("iEnv"), "env"]]) { inp.disabled = readOnly || !db; if (document.activeElement !== inp) inp.value = c[k] || ""; }
    const missing = s.ids.filter(id => !byId.has(id));
    $("iMeta").textContent = `${c.nom || cid} · ${TYPES[c.type] || c.type} · ${s.ids.length} cas · créée le ${c.creee ? fmtDay(c.creee) : "?"}${c.par && c.par === me ? " par toi" : ""} · cahier de la campagne : ${c.cahier || "?"}${c.cahier && c.cahier !== D.commit ? ` (cette page : ${D.commit} ; les étapes réécrites depuis ressortent « à revérifier »)` : ""}${missing.length ? ` · absents de ce cahier : ${missing.join(", ")}` : ""}${c.archivee ? " · archivée" : ""}.`;
    const syn = $("iSyn"); syn.textContent = ""; syn.appendChild(synTable(s));
    const k = criteria(c, s), box = el("div", `crit ${k.cls}`);
    box.appendChild(el("strong", "", k.title));
    if (k.items.length) { const ul = el("ul"); for (const it of k.items.slice(0, 40)) ul.appendChild(el("li", "", it)); if (k.items.length > 40) ul.appendChild(el("li", "", `et ${k.items.length - 40} de plus`)); box.appendChild(ul); }
    box.appendChild(el("p", "hint", "Une lecture des critères de campagnes.md, pas une décision : go, go avec réserves ou no-go appartient à la responsable du produit."));
    const crit = $("iCrit"); crit.textContent = ""; crit.appendChild(box);
    $("archBtn").textContent = c.archivee ? "Désarchiver la campagne" : "Archiver la campagne";
    $("archBtn").disabled = readOnly || !db;
  }

  /* ---------- le compte rendu ---------- */
  const md = s => String(s || "").replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim();
  function renderCr() {
    const c = camp();
    if (!c) return;
    const s = stats(), dates = [];
    for (const id of s.ids) { const v = view(id); if (v.maj) dates.push(v.maj); }
    dates.sort();
    const from = dates[0] || c.creee, to = dates[dates.length - 1] || c.creee;
    const L = [];
    L.push(`# Compte rendu — ${md(c.nom || cid)}`, "", "## Identification", "", "| | |", "|---|---|");
    L.push(`| Identifiant de campagne | \`${md(c.nom || cid)}\` |`);
    L.push(`| Type | ${TYPES[c.type] || md(c.type)} ([campagnes.md](../campagnes.md)) |`);
    L.push(`| Date(s) | ${from ? (fmtDay(from) === fmtDay(to) ? `le ${fmtDay(from)}` : `du ${fmtDay(from)} au ${fmtDay(to)}`) : "…"} |`);
    L.push(`| Version testée | ${md(c.version) || "…"} |`);
    L.push(`| Commit du cahier utilisé | \`${md(c.cahier) || "…"}\` (résultat de \`npm run recette\` : …) |`);
    L.push(`| Environnement | ${md(c.env) || "…"} |`, "| Exécutant(s) | … |", "| Comptes et données | … |", "");
    L.push("## Résultats", "", "Cases cochées dans le cahier à cocher ; résultats saisis par les exécutants.", "");
    L.push("| Cas | Priorité | Plateforme | Résultat | Résultat observé | Preuve | Anomalie |", "|---|---|---|---|---|---|---|");
    for (const id of s.ids) {
      const cas = byId.get(id), v = view(id);
      if (!cas) { L.push(`| \`${md(id)}\` | | | absent du cahier ${D.commit} | | | |`); continue; }
      const t = tally(cas, v), r = resOf(v);
      const obs = [md(v.observe), r !== "todo" && t.done < t.total ? `(${t.done}/${t.total} cases cochées)` : "", t.stale ? `(${t.stale} à revérifier)` : ""].filter(Boolean).join(" ");
      L.push(`| [\`${id}\`](../${fileOf.get(cas.d)}#${id.toLowerCase()}) | ${cas.pr} | ${md(v.plateforme || c.env)} | ${RES[r]} | ${obs} | ${md(v.preuve)} | ${md(v.anomalie)} |`);
    }
    L.push("", "## Synthèse", "", "| Priorité | Réussis | Échoués | Bloqués | Non applicables | Non exécutés |", "|---|---|---|---|---|---|");
    for (const p of ["P1", "P2", "P3"]) { const x = s.prio[p] || {}; L.push(`| ${p} | ${RES_ORDER.map(k => x[k] || 0).join(" | ")} |`); }
    const k = criteria(c, s);
    L.push("", `Lecture des critères de sortie : ${k.title}${k.items.length ? " " + k.items.join(" ; ") + "." : ""}`, "");
    const tickets = [...new Set(s.ids.map(id => md(view(id).anomalie)).filter(Boolean))];
    L.push(`Anomalies ouvertes pendant la campagne : ${tickets.length ? tickets.join(", ") : "…"}`, "", "Écarts dus au cahier (attendu faux, étape ambiguë), corrigés par la PR … : …", "");
    L.push("## Réserves", "", "| Écart | Ticket | Accepté par | Jusqu'à |", "|---|---|---|---|", "| | | | |", "");
    L.push("## Décision", "", "*go* · *go avec réserves* · *no-go* — par …, le …, au regard des critères de sortie de la campagne.", "");
    $("crText").value = L.join("\n");
  }

  /* ---------- filtres ---------- */
  const F = { q: $("q"), dom: $("fDom"), prio: $("fPrio"), res: $("fRes"), scope: $("fScope") };
  // `keepOpen` : un rafraîchissement venu de la base ne fait pas disparaître la carte ouverte sous la main qui la
  // remplit ; un filtre changé par la personne s'applique à toutes.
  function applyFilters(keepOpen) {
    const q = F.q.value.trim().toLowerCase(), dom = F.dom.value, prio = F.prio.value, res = F.res.value, scope = cid ? F.scope.value : "all";
    let shown = 0;
    for (const sec of list.querySelectorAll("section.dom")) {
      let n = 0;
      for (const det of sec.querySelectorAll("details.case")) {
        const c = byId.get(det.dataset.id), v = view(c.id), r = resOf(v), t = tally(c, v);
        let ok = (!dom || c.d === dom) && (!prio || c.pr === prio) && (scope === "all" || inCamp(c.id));
        if (ok && q) ok = c.id.toLowerCase().includes(q) || c.tt.toLowerCase().includes(q);
        if (ok && res && cid) ok = res === "stale" ? t.stale > 0 : res === "encours" ? r === "todo" && (t.done + t.stale) > 0 : r === res;
        det.hidden = !(ok || keepOpen === true && det.open && !det.hidden);
        if (!det.hidden) n++;
      }
      sec.hidden = n === 0;
      sec.querySelector("[data-domn]").textContent = `${n} cas`;
      shown += n;
    }
    $("empty").hidden = shown > 0;
  }

  /* ---------- campagnes ---------- */
  function renderCampSel() {
    const sel = $("campSel"), show = $("showArch").checked, keep = cid;
    sel.textContent = "";
    sel.appendChild(new Option(db ? "Aucune campagne : lecture seule" : "Base indisponible : lecture seule", ""));
    const arr = [...camps.entries()].filter(([id, c]) => show || !c.archivee || id === keep).sort((a, b) => String(b[1].creee || "").localeCompare(String(a[1].creee || "")));
    for (const [id, c] of arr) sel.appendChild(new Option(`${c.nom || id} — ${TYPES[c.type] || c.type || "?"}${c.archivee ? " (archivée)" : ""}`, id));
    sel.value = keep && camps.has(keep) ? keep : "";
  }
  function select(id) {
    if (id === cid && unsubCas) return;
    if (unsubCas) { unsubCas(); unsubCas = null; }
    cid = id && camps.has(id) ? id : "";
    remote = new Map(); pending = new Map();
    store.set({ cid });
    $("campSel").value = cid;
    $("infoBtn").disabled = $("crBtn").disabled = !cid;
    if (!cid) { $("infoPanel").hidden = $("crPanel").hidden = true; }
    if (cid && db) {
      unsubCas = db.collection(`campagnes/${cid}/cas`).limit(1000).onSnapshot(snap => {
        for (const ch of snap.docChanges()) {
          if (ch.type === "removed" || !ch.doc.exists) remote.delete(ch.doc.id); else remote.set(ch.doc.id, ch.doc.data());
          if (byId.has(ch.doc.id)) refreshCase(ch.doc.id);
        }
        applyFilters(true);
      }, e => { if (e && e.code === "revoked") setReadOnly("Lecture seule : l'accès à la base de cette page a changé."); else saved("Lien avec la base perdu : recharge la page", true); });
    }
    refreshAll(); renderCounts();
    if (!$("infoPanel").hidden) renderInfo();
    if (!$("crPanel").hidden) renderCr();
  }

  /* ---------- nouvelle campagne ---------- */
  let nomTouched = false;
  const typeNow = () => (document.querySelector('input[name="type"]:checked') || {}).value || "smoke";
  function selection() {
    const type = typeNow(), out = [], seen = new Set(), add = id => { if (byId.has(id) && !seen.has(id)) { seen.add(id); out.push(id); } };
    let unknown = [];
    if (type === "smoke") {
      D.smoke.forEach(s => add(s.id));
      for (const cb of $("livraison").querySelectorAll("input:checked")) cb.value.split(" ").forEach(add);
    } else if (type === "complete") D.cas.forEach(c => add(c.id));
    else {
      const doms = new Set([...$("doms").querySelectorAll("input:checked")].map(i => i.value));
      const prios = new Set([...$("prios").querySelectorAll("input:checked")].map(i => i.value));
      const skip = $("skipAuto").checked;
      for (const c of D.cas) if (doms.has(c.d) && prios.has(c.pr) && !(skip && c.cov.length && c.cov.every(x => x === "couvert automatiquement"))) add(c.id);
      const extra = $("extra").value.toUpperCase().split(/[\s,;]+/).filter(Boolean);
      unknown = extra.filter(x => !byId.has(x));
      extra.forEach(add);
    }
    return { ids: out, unknown };
  }
  function renderNew() {
    const type = typeNow();
    $("optSmoke").hidden = type !== "smoke";
    $("optCiblee").hidden = type !== "ciblee";
    if (!nomTouched) $("nom").value = `${today()}-${type}`;
    const { ids, unknown } = selection();
    $("newCount").textContent = `${ids.length} cas, ${ids.reduce((n, id) => n + boxes(byId.get(id)).length, 0)} cases à cocher.${unknown.length ? ` Inconnus, ignorés : ${unknown.join(", ")}.` : ""}${type === "ciblee" ? " Identifiant conseillé : AAAA-MM-JJ-ciblee-<numéro de PR>." : ""}`;
    $("createBtn").disabled = !ids.length || !db || readOnly;
  }
  async function create() {
    const { ids } = selection(), nom = $("nom").value.trim() || `${today()}-${typeNow()}`;
    let id = docId(nom) || `${today()}-${typeNow()}`, n = 2;
    while (camps.has(id)) id = `${docId(nom) || today()}-${n++}`;
    $("createBtn").disabled = true;
    try {
      await retry(() => db.doc(`campagnes/${id}`).set({ nom, type: typeNow(), cas: ids, version: $("version").value.trim(), env: $("env").value.trim(), cahier: D.commit, creee: now(), par: me, archivee: false }));
      camps.set(id, { nom, type: typeNow(), cas: ids, version: $("version").value.trim(), env: $("env").value.trim(), cahier: D.commit, creee: now(), par: me, archivee: false });
      justCreated.set(id, camps.get(id));
      $("newPanel").hidden = true; nomTouched = false;
      F.scope.value = "camp";
      renderCampSel(); select(id);
      saved("Campagne créée");
    } catch (e) { writeError(e); }
    $("createBtn").disabled = false;
  }
  function buildNewForm() {
    for (const s of D.livraison) {
      const l = el("label"), cb = el("input"); cb.type = "checkbox"; cb.value = s.ids.join(" ");
      l.append(cb, ` ${s.ids.join(" et ")} (${s.why})`); $("livraison").appendChild(l);
    }
    for (const d of D.domaines) {
      const l = el("label"), cb = el("input"); cb.type = "checkbox"; cb.value = d.p;
      l.append(cb, ` ${d.p} — ${d.t} (${D.cas.filter(c => c.d === d.p).length})`); $("doms").appendChild(l);
      const o = new Option(`${d.p} — ${d.t}`, d.p); F.dom.appendChild(o);
    }
    for (const p of ["P1", "P2", "P3"]) {
      const l = el("label"), cb = el("input"); cb.type = "checkbox"; cb.value = p; cb.checked = p !== "P3";
      l.append(cb, ` ${p}`); $("prios").appendChild(l);
    }
  }

  /* ---------- aller à un cas ---------- */
  function goTo(hash) {
    const id = decodeURIComponent((hash || "").replace(/^#/, "")).toUpperCase();
    if (!byId.has(id)) return;
    const det = card(id);
    if (det.hidden) { F.q.value = ""; F.dom.value = ""; F.prio.value = ""; F.res.value = ""; if (!inCamp(id)) F.scope.value = "all"; applyFilters(false); }
    ensureBody(id); det.open = true;
    det.scrollIntoView({ block: "start" });
    det.classList.add("flash"); setTimeout(() => det.classList.remove("flash"), 1600);
  }

  /* ---------- gestes ---------- */
  list.addEventListener("toggle", e => { const det = e.target; if (det.matches && det.matches("details.case") && det.open) ensureBody(det.dataset.id); }, true);
  list.addEventListener("change", e => {
    const t = e.target, det = t.closest("details.case");
    if (!det) return;
    const id = det.dataset.id, c = byId.get(id);
    if (t.matches('input[type="checkbox"][data-k]')) {
      const b = boxes(c).find(x => x.k === t.dataset.k);
      change(id, { etapes: { [b.k]: t.checked ? { h: b.h, t: now(), par: me } : null } });
    } else if (t.matches('input[type="radio"]')) change(id, { resultat: t.value === "todo" ? null : t.value });
    else if (t.matches("[data-f]")) { const val = t.value.trim(); if (val !== (view(id)[t.dataset.f] || "")) change(id, { [t.dataset.f]: val }); }
  });
  list.addEventListener("click", async e => {
    const b = e.target.closest('[data-act="add"]');
    if (!b) return;
    const id = b.closest("details.case").dataset.id, c = camp();
    if (!c || readOnly) return;
    b.disabled = true;
    await writeCamp(cur => ({ cas: (cur.cas || []).includes(id) ? cur.cas : [...(cur.cas || []), id] }));
    refreshAll();
    b.disabled = false;
  });
  for (const k of ["q", "dom", "prio", "res", "scope"]) F[k].addEventListener(k === "q" ? "input" : "change", () => {
    applyFilters(false);
    store.set({ q: F.q.value, dom: F.dom.value, prio: F.prio.value, res: F.res.value, scope: F.scope.value });
  });
  $("campSel").addEventListener("change", e => select(e.target.value));
  $("newBtn").addEventListener("click", () => { $("newPanel").hidden = !$("newPanel").hidden; $("infoPanel").hidden = $("crPanel").hidden = true; renderNew(); });
  $("cancelNew").addEventListener("click", () => { $("newPanel").hidden = true; });
  $("newPanel").addEventListener("change", renderNew);
  $("newPanel").addEventListener("input", e => { if (e.target.id === "nom") nomTouched = true; if (e.target.id === "extra") renderNew(); });
  $("createBtn").addEventListener("click", create);
  $("infoBtn").addEventListener("click", () => { $("infoPanel").hidden = !$("infoPanel").hidden; $("newPanel").hidden = $("crPanel").hidden = true; renderInfo(); });
  $("crBtn").addEventListener("click", () => { $("crPanel").hidden = !$("crPanel").hidden; $("newPanel").hidden = $("infoPanel").hidden = true; renderCr(); });
  $("iVersion").addEventListener("change", e => writeCamp({ version: e.target.value.trim() }));
  $("iEnv").addEventListener("change", e => writeCamp({ env: e.target.value.trim() }));
  $("archBtn").addEventListener("click", () => writeCamp(c => ({ archivee: !c.archivee })).then(renderInfo));
  $("showArch").addEventListener("change", renderCampSel);
  $("copyBtn").addEventListener("click", async () => {
    const ta = $("crText");
    try { await navigator.clipboard.writeText(ta.value); $("copyMsg").textContent = "Copié."; }
    catch (e) { ta.removeAttribute("readonly"); ta.select(); ta.setAttribute("readonly", ""); $("copyMsg").textContent = "Copie refusée ici : le texte est sélectionné, copie-le à la main."; }
  });
  $("openAll").addEventListener("click", () => {
    const vis = [...list.querySelectorAll("details.case")].filter(d => !d.hidden);
    const open = vis.some(d => !d.open);
    for (const d of vis) { if (open) ensureBody(d.dataset.id); d.open = open; }
    $("openAll").textContent = open ? "Tout replier" : "Tout déplier";
  });
  window.addEventListener("beforeprint", () => { for (const d of list.querySelectorAll("details.case")) if (!d.hidden) { ensureBody(d.dataset.id); d.open = true; } });
  window.addEventListener("hashchange", () => goTo(location.hash));
  // Un lien vers le dépôt s'ouvre à côté : la page de recette garde sa place.
  document.addEventListener("click", e => { const a = e.target.closest && e.target.closest('a[href^="http"]'); if (a) { a.target = "_blank"; a.rel = "noopener"; } }, true);

  /* ---------- démarrage : la page d'abord, la base quand elle répond ---------- */
  buildList(); buildNewForm();
  const st = store.get();
  if (st.q) F.q.value = st.q;
  for (const k of ["dom", "prio", "res", "scope"]) if (st[k] && [...F[k].options].some(o => o.value === st[k])) F[k].value = st[k];
  refreshAll();
  $("newBtn").disabled = true;
  saved("Connexion à la base…");
  if (location.hash) goTo(location.hash);

  (async () => {
    const C = window.claude;
    try { db = C && C.use ? await C.use("db") : null; } catch (e) { db = null; }
    let user = null;
    try { user = C && C.use ? await C.use("user") : null; } catch (e) { user = null; }
    if (user) { try { me = await user.id(); } catch (e) { me = null; } }
    dbReady = true;
    if (!db) {
      saved("");
      banner("Les coches ne s'enregistrent pas ici : cette vue n'a pas accès à la base de la page (ouverte hors de claude.ai, ou sans être connectée). Le cahier reste lisible et imprimable.");
      renderCampSel(); renderCounts(); $("counts").textContent = "Lecture seule.";
      return;
    }
    let can = null;
    if (user) { try { can = await user.can("data.write"); } catch (e) { can = null; } }
    if (can === false) setReadOnly("Lecture seule : ton accès à cette page ne permet pas d'enregistrer. Les campagnes et leurs coches restent lisibles.");
    else $("newBtn").disabled = false;
    saved("");
    db.collection("campagnes").limit(500).onSnapshot(snap => {
      camps = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
      // Une campagne qu'on vient de créer n'est pas perdue par un instantané parti avant sa création.
      for (const [id, c] of justCreated) { if (camps.has(id)) justCreated.delete(id); else camps.set(id, c); }
      renderCampSel();
      if (firstCamps) { firstCamps = false; const want = store.get().cid; if (want && camps.has(want)) { select(want); return; } }
      if (cid && !camps.has(cid)) { select(""); return; }
      refreshAll(); renderCounts();
      if (!$("infoPanel").hidden) renderInfo();
      if (!$("crPanel").hidden) renderCr();
    }, e => { if (e && e.code === "revoked") setReadOnly("Lecture seule : l'accès à la base de cette page a changé."); else saved("Lien avec la base perdu : recharge la page", true); });
    renderCounts();
  })();
})();
