/* Le Vasculum : trier la boîte de réception, une note à la fois. */
import { EP_STATUS, inboxId } from "../../core/domain.js";
import { CLICK, SHEETS } from "../registry.js";
import { $, esc } from "../lib/dom.js";
import { fmt } from "../lib/format.js";
import { epGlyph } from "./links.js";
import { captureIntent, noteTargets } from "../modules/notes.js";
import { closeSheet, openSheet } from "../shell/sheets.js";
import { sigil, tintOf } from "../shell/sigils.js";
import { S, label } from "../state/site.js";

/* Le Vasculum : trier la boîte de réception, une note à la fois.
   Comme la boîte d'herborisation où l'on met les spécimens avant de les presser : une décision à la fois, les espaces
   cibles en grands sigils, le rangement reconnu proposé en premier. Réutilise les actions de la boîte (note-to,
   note-file, note-del) ; « Plus tard » passe à la suivante sans rien toucher. */
let vascSkip = 0;
SHEETS.vasculum = () => {
  const s = S(), inbox = inboxId(s.modules);
  if (!inbox) return `<h2 id="sheetTitle">Vasculum</h2><p class="empty">Aucune boîte de réception.</p>`;
  const list = s.modules[inbox].entries, n = list.length;
  if (!n) return `<h2 id="sheetTitle">Vasculum</h2><p class="empty">La boîte est vide. Tout a trouvé sa place, ou presque.</p><div class="row"><button class="btn" data-act="sheet-close">Fermer</button></div>`;
  const i = vascSkip % n, note = list[i], intent = captureIntent(note.text), targets = noteTargets(inbox);
  return `<div class="vasc" data-mod="${esc(inbox)}" data-id="${esc(note.id)}"><h2 id="sheetTitle" class="sr">Vasculum : trier la boîte</h2>
    <p class="vasc-count">Vasculum · ${i + 1} sur ${n}</p>
    <blockquote class="spec-text">${esc(note.text)}</blockquote>
    <p class="meta">${fmt(note.date)}${note.ep ? `<span>${epGlyph(note.ep)}${esc(EP_STATUS[note.ep])}</span>` : ""}</p>
    ${intent && intent.to !== inbox ? `<button class="btn acc" data-act="note-file">Ranger : ${esc(intent.say)}</button>` : ""}
    ${targets.length ? `<div class="vasc-targets">${targets.map(k => `<button type="button" class="${tintOf(k)}" data-act="note-to" data-to="${esc(k)}">${sigil(k)}<span>${esc(label(k))}</span></button>`).join("")}</div>` : `<p class="hint">Aucun espace ne sait encore recevoir une note.</p>`}
    <div class="row"><button class="btn ghost" data-act="vasc-skip">Plus tard</button><span class="spacer"></span><button class="btn ghost" data-act="note-del">Supprimer</button></div></div>`;
};
CLICK["vasculum"] = () => { vascSkip = 0; openSheet("vasculum"); };
CLICK["vasc-skip"] = () => { vascSkip++; $("#sheetBody").innerHTML = SHEETS.vasculum(); };
CLICK["sheet-close"] = () => closeSheet();
