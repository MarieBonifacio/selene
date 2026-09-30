/* Le bilan : une période (mois ou cycle lunaire), module par module. */
import { platform } from "../../platform.js";
import { EP_STATUS } from "../../core/domain.js";
import { CLICK, TYPE_UI, VIEWS } from "../registry.js";
import { esc } from "../lib/dom.js";
import { fmt, iso, plural } from "../lib/format.js";
import { uiLocale } from "../i18n/index.js";
import { driftSection } from "../features/derive.js";
import { epCounts } from "../features/links.js";
import { lunarSection } from "../features/lunar.js";
import { tensionSection } from "../features/tensions.js";
import { NEW_MOON_REF, SYNODIC } from "../scene/moon.js";
import { routeOf } from "../shell/nav.js";
import { render } from "../shell/render.js";
import { S, label } from "../state/site.js";
import { plancheView } from "./planche.js";

/* Bilan.
   Une période (cycle lunaire, d'une nouvelle lune à la suivante, ou mois civil), et pour chaque module la
   ligne de bilan que fournit son type (TYPE_UI[type].review), à côté de celle de la période précédente.
   Une information pour prendre du recul, pas un score. */
export let bilanOffset = 0;
export const setBilanOffset = n => { bilanOffset = n; };
export const bilanMode = () => { try { return platform.storage.get("selene-bilan") === "mois" ? "mois" : "lune"; } catch { return "lune"; } };
/* [from, to[ en dates ISO ; offset 0 = la période en cours, 1 = la précédente… */
export function periodOf(mode, offset, now = Date.now()) {
  if (mode === "mois") {
    const d = new Date(now), start = new Date(d.getFullYear(), d.getMonth() - offset, 1), end = new Date(d.getFullYear(), d.getMonth() - offset + 1, 1);
    return { from: iso(start), to: iso(end), name: start.toLocaleDateString(uiLocale(), { month: "long", year: "numeric" }) };
  }
  const len = SYNODIC * 86400000, k = Math.floor((now - NEW_MOON_REF) / len) - offset, start = NEW_MOON_REF + k * len, end = start + len;
  return { k, start, from: iso(new Date(start)), to: iso(new Date(end)), name: `Cycle du ${fmt(iso(new Date(start)), { day: "numeric", month: "long" })} au ${fmt(iso(new Date(end - 86400000)), { day: "numeric", month: "long" })}` };
}
VIEWS.bilan = () => {
  if (routeOf().entry === "planche") return plancheView();
  const mode = bilanMode(), cur = periodOf(mode, bilanOffset), prev = periodOf(mode, bilanOffset + 1), s = S();
  const rows = s.config.modules.filter(m => m.on && Object.hasOwn(s.modules, m.id) && TYPE_UI[s.modules[m.id].type].review).map(m => {
    const inst = s.modules[m.id], review = TYPE_UI[inst.type].review, r = review(inst, cur.from, cur.to), p = review(inst, prev.from, prev.to);
    return `<div class="over-wrap"><div class="over"><b>${esc(label(m.id))}</b><span>${esc(r || "—")}</span><em class="hint" style="margin:0">avant : ${esc(p || "—")}</em></div></div>`;
  }).join("");
  const tab = (m, l) => `<button class="btn sm ${mode === m ? "acc" : "ghost"}" data-act="bilan-mode" data-m="${m}">${l}</button>`;
  // Ce que les idées notées pendant la période revendiquent de savoir ; chaque statut mène à la recherche.
  const eps = epCounts(cur.from, cur.to), epLine = Object.keys(EP_STATUS).filter(k => eps[k]).map(k => `<button class="btn ghost sm" data-act="search-for" data-q="statut:${esc(EP_STATUS[k])}">${plural(eps[k], EP_STATUS[k])}</button>`).join("");
  return `<div class="row" style="margin-bottom:6px"><h2 style="margin:0">Bilan</h2><span class="spacer"></span>${tab("lune", "Cycle lunaire")}${tab("mois", "Mois")}<button class="btn ghost sm" data-act="planche-open" title="Le cycle en planche A4, à imprimer ou enregistrer en PDF">Planche</button></div>
  <div class="row" style="margin-bottom:18px"><button class="btn ghost" data-act="bilan-nav" data-d="1" aria-label="Période précédente">‹</button><b style="text-transform:none">${esc(cur.name)}</b>${bilanOffset ? `<button class="btn ghost" data-act="bilan-nav" data-d="-1" aria-label="Période suivante">›</button>` : ""}</div>
  <p class="hint">Ce qui s'est passé dans chaque module pendant la période, et, en face, la période d'avant. Aucune note, aucun trophée : les chiffres suffisent à culpabiliser.</p>
  <section>${rows || `<p class="empty">Aucun module à résumer.</p>`}</section>
  ${epLine ? `<section><h3>Statut des idées notées</h3><p class="hint">Ce qu'elles revendiquent de savoir. Une hypothèse n'est pas une faiblesse, c'est une dette à rembourser.</p><div class="row">${epLine}</div></section>` : ""}
  ${driftSection(mode, cur)}
  ${tensionSection()}
  ${lunarSection()}`;
};
CLICK["bilan-mode"] = el => { platform.storage.set("selene-bilan", el.dataset.m); bilanOffset = 0; render(); };
CLICK["bilan-nav"] = el => { bilanOffset = Math.max(0, bilanOffset + +el.dataset.d); render(); };
