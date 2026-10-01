/* Les boîtes de dialogue : confirmation (ask) et formulaire générique (openForm), construits à partir d'une
   description de champs. */
import { $, esc, toast } from "../lib/dom.js";
import { tr, trp } from "../i18n/index.js";
import { errMsg } from "../lib/labels.js";

export function ask(msg) { return new Promise(res => { const d = $("#cdlg"); $("#cmsg").textContent = msg; d.returnValue = ""; d.onclose = () => res(d.returnValue === "ok"); d.showModal(); }); }
export let formCb = null;
function fieldHTML(f, v) {
  const val = v[f.n] ?? "";
  const common = `name="${f.n}" ${f.req ? "required" : ""}`;
  let input;
  if (f.t === "textarea") input = `<textarea ${common} rows="${f.rows || 3}">${esc(val)}</textarea>`;
  else if (f.t === "select") input = `<select ${common}>${f.o.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${String(val) === String(k) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
  else input = `<input type="${f.t || "text"}" ${common} value="${esc(val)}" ${f.list ? `list="${f.list}"` : ""} ${f.t === "number" ? `min="${esc(f.min ?? 0)}" step="${esc(f.step ?? 1)}" inputmode="${f.step && f.step < 1 ? "decimal" : "numeric"}"${f.max != null ? ` max="${esc(f.max)}"` : ""}` : ""}${f.t === "date" && f.max ? ` max="${esc(f.max)}"` : ""}>`;
  return `<label>${esc(f.l)}${input}</label>`;
}
export function openForm(title, fields, values, cb, description = "") {
  formCb = cb;
  $("#form").innerHTML = `<h2>${esc(title)}</h2>${description ? `<p class="hint">${esc(description)}</p>` : ""}` + fields.map(f => f.row ? `<div class="field-row">${f.row.map(x => fieldHTML(x, values)).join("")}</div>` : fieldHTML(f, values)).join("") +
    `<div class="row"><button class="btn solid" value="save">${tr`Enregistrer`}</button><button class="btn" value="cancel" formnovalidate>${trp("formulaire", "Annuler")}</button></div>`;
  $("#dlg").showModal();
}
$("#dlg").addEventListener("close", () => {
  if ($("#dlg").returnValue !== "save" || !formCb) return;
  const v = {}; new FormData($("#form")).forEach((x, k) => v[k] = typeof x === "string" ? x.trim() : x);
  const cb = formCb; formCb = null;
  // Une suite asynchrone (une confirmation demandée après le formulaire) qui échoue le dit aussi.
  const failed = e => toast(errMsg(e, tr`Saisie invalide.`));
  try { const r = cb(v); if (r && typeof r.then === "function") r.then(null, failed); } catch (e) { failed(e); } // sinon l'erreur disparaît en silence
});
