/* Ce que partagent les deux pages tirées du cahier de recette, la page de lecture (npm run recette -- page) et le cahier
   à cocher (npm run recette -- campagne) : les chemins, l'échappement, les ancres calculées comme GitHub, les cellules
   de tableau, le texte en ligne, la palette de Selene. Tout le HTML du texte est échappé, sauf les ancres
   <a id="…"></a> : le cahier cite des pièges d'injection, qui doivent rester du texte. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const REC = path.join(ROOT, "docs/recette");
export const REPO = "https://github.com/MarieBonifacio/selene";
export const read = f => fs.readFileSync(f, "utf8");
export const git = args => { try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return ""; } };
export const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// L'ancre d'un titre telle que GitHub la calcule (même règle que scripts/recette.mjs) : les liens du cahier la visent.
export const slug = h => h.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`/g, "").toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/ /g, "-");

// Les cellules d'une ligne de tableau Markdown ; « \| » est une barre dans la cellule.
export function cellsOf(row) {
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let k = 0; k < s.length; k++) {
    if (s[k] === "\\" && s[k + 1] === "|") { cur += "|"; k++; continue; }
    if (s[k] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += s[k];
  }
  cells.push(cur.trim());
  return cells;
}

/* Le texte en ligne : code, ancres, adresses nues, liens, gras, barré, italique. La page dit où mène chaque lien
   (`href(cible, document) → { url, out }`) et quel identifiant porte chaque ancre (`anchor(document, id)`). */
export function inline(text, from, { href, anchor }) {
  const keep = [];
  const hold = html => `\u0000${keep.push(html) - 1}\u0000`;
  let s = text
    .replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`))
    .replace(/<a id="([^"]+)"><\/a>/g, (_, id) => hold(`<span class="anchor" id="${esc(anchor(from, id))}"></span>`))
    .replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => hold(`<a href="${esc(u)}" rel="noopener">${esc(u)}</a>`));
  s = esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
      const { url, out } = href(h.replace(/&amp;/g, "&"), from);
      return `<a href="${esc(url)}"${out ? ' rel="noopener"' : ""}>${t}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => keep[+n]);
}

/* La voix et la palette de Selene (src/shell.html) : polices, jetons de couleur clairs et sombres. */
export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Spectral+SC:wght@500&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap">`;
export const TOKENS = `:root{
  --bg:#e2e6de; --surface:#edf0e9; --surface-2:#f4f2ea; --ink:#1a211b; --ink-2:#394237; --muted:#5b6859;
  --rule:#c1c9bc; --rule-strong:#75816f; --accent:#3d6a45; --ok:#2f6f62; --warn:#7d5a12; --alarm:#a8431f; --info:#3f5d78;
  --hl:rgba(61,106,69,.13);
  --f-display:"Cormorant Garamond",Georgia,serif; --f-text:"Spectral",Georgia,"Times New Roman",serif;
  --f-label:"Spectral SC","Spectral",Georgia,serif; --f-ui:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0e1310; --surface:#151c17; --surface-2:#1a231d; --ink:#dde2d6; --ink-2:#b4bdb0; --muted:#8c998a;
  --rule:#243029; --rule-strong:#56665a; --accent:#8fbf86; --ok:#6fb3a2; --warn:#d2a24c; --alarm:#e5785a; --info:#8fa9c0;
  --hl:rgba(143,191,134,.14); color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0e1310; --surface:#151c17; --surface-2:#1a231d; --ink:#dde2d6; --ink-2:#b4bdb0; --muted:#8c998a;
  --rule:#243029; --rule-strong:#56665a; --accent:#8fbf86; --ok:#6fb3a2; --warn:#d2a24c; --alarm:#e5785a; --info:#8fa9c0;
  --hl:rgba(143,191,134,.14); color-scheme:dark}`;
