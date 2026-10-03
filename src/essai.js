/* La page publique de test (essai.html, docs/essai.md ; E3 de l'audit). Un script sans dépendance, autorisé par son
   empreinte (build.py), qui ne lit ni n'écrit rien sur l'appareil : ni cookie, ni stockage.
   - Une ouverture de la page (pas un rechargement, ni un retour en arrière) laisse une ligne dans `audience`, avec le
     lien d'arrivée (?src=forum-a), un clic sur « Essayer » aussi ; ni adresse, ni identifiant.
   - La liste d'attente écrit dans `attente` : l'adresse, le lien d'arrivée, et le projet si la personne le dit.
   Les deux tables ne s'écrivent qu'avec la clé publique, ne se lisent que dans l'éditeur SQL (supabase/schema.sql).
   __SUPABASE_URL__ et __SUPABASE_KEY__ : posés par build.py, depuis src/app/services/auth.js. */
(() => {
  const BASE = "__SUPABASE_URL__/rest/v1/", KEY = "__SUPABASE_KEY__", PAGE = "essai";
  const source = (() => { const s = new URLSearchParams(location.search).get("src") || ""; return /^[a-z0-9-]{1,30}$/.test(s) ? s : ""; })();
  const send = (table, row, keepalive = false) => fetch(BASE + table, { method: "POST", keepalive,
    headers: { apikey: KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) });

  // Une ouverture : la première navigation vers la page, pas son rechargement (on compte des ouvertures, pas des clics sur F5).
  const nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  if (!nav || nav.type === "navigate") send("audience", { page: PAGE, evenement: "visite", source }).catch(() => {});
  // « Essayer » : la ligne part pendant que le lien s'ouvre (keepalive), sans retenir la navigation.
  for (const a of document.querySelectorAll("a[data-essai]")) a.addEventListener("click", () => { send("audience", { page: PAGE, evenement: "essai", source }, true).catch(() => {}); });

  const form = document.getElementById("attente"), status = document.getElementById("statut");
  const say = (text, ok) => { status.textContent = text; status.className = "status " + (ok ? "ok" : "err"); };
  let busy = false;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (busy) return;
    const email = form.email.value.trim(), projet = form.projet.value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) { say("Cette adresse ne semble pas complète.", false); form.email.focus(); return; }
    if (!form.accord.checked) { say("Coche la case pour que Selene puisse garder ton adresse.", false); form.accord.focus(); return; }
    busy = true; form.querySelector("button").disabled = true; say("Envoi…", true);
    try {
      const r = await send("attente", { email, source, projet });
      // 409 : la même adresse, inscrite au même instant par un autre envoi. Pour la personne, c'est fait.
      if (!r.ok && r.status !== 409) throw new Error(String(r.status));
      form.reset();
      say("C'est noté : tu recevras un seul e-mail, à l'ouverture de la bêta.", true);
    } catch {
      say("L'inscription n'est pas partie (réseau ?). Réessaie dans un moment, ou écris à mariebonifacio.pro@gmail.com.", false);
    } finally { busy = false; form.querySelector("button").disabled = false; }
  });
})();
