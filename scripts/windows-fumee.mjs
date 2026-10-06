/* Fumée de l'app Windows installée (BL-08 du cahier de recette ; workflow desktop.yml). L'installateur NSIS s'installe
   en silence ; l'app démarre sur son écran d'entrée ; on entre sans compte et on capture une note ; tuée puis relancée,
   l'app la retrouve (le coffre de fichiers du cœur Rust, native/tauri/src/main.rs : %APPDATA%\<identifiant>\selene) ;
   une seconde Selene lancée pendant que la première tourne ne reste pas (une seule instance, qui ramène sa fenêtre).
   La page est pilotée comme sur Android (scripts/android-fumee.mjs : cdp, waitFor, steps) : WebView2 ouvre le protocole
   de débogage de Chrome quand WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS le lui demande, sans pilote à installer. Le
   workflow rend d'abord le projet Supabase injoignable : rien de cet essai ne part vers le vrai serveur.
   Usage : node scripts/windows-fumee.mjs <installateur .exe> <dossier des captures> */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cdp, steps, waitFor } from "./android-fumee.mjs";

const IDENTIFIER = "io.github.mariebonifacio.selene", EXE = "selene.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hex = s => Buffer.from(s, "utf8").toString("hex");
// Chaque commande système est bornée : un installateur ou un processus figé fait échouer, il ne bloque pas.
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 });

/* Où l'installateur a posé l'app : l'installation « pour l'utilisateur » de Tauri, ou une autre, cherchée sans deviner. */
export function findInstalled(env = process.env) {
  const roots = [env.LOCALAPPDATA, env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Programs"), env.ProgramFiles].filter(Boolean);
  for (const r of roots) { const p = path.join(r, "Selene", EXE); if (fs.existsSync(p)) return p; }
  return null;
}
const processes = () => { try { return run("tasklist", ["/FI", `IMAGENAME eq ${EXE}`, "/FO", "CSV", "/NH"]).split("\n").filter(l => l.toLowerCase().includes(EXE)).length; } catch { return 0; } };
const kill = () => { try { run("taskkill", ["/IM", EXE, "/F", "/T"]); } catch {} };
/* Lancer l'app et s'attacher à sa page, sur un port de débogage neuf à chaque lancement. */
async function launch(exe, port) {
  const child = spawn(exe, [], { detached: true, stdio: "ignore", env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
  child.unref();
  for (const end = Date.now() + 60000; Date.now() < end; await sleep(500)) {
    let list = [];
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { continue; }
    const target = list.find(t => t.type === "page" && /^https?:\/\/tauri\.localhost/.test(t.url));
    if (target) return cdp(target.webSocketDebuggerUrl || `ws://127.0.0.1:${port}/devtools/page/${target.id}`);
  }
  throw new Error(`la WebView2 de l'app n'a pas ouvert son port de débogage (${port}) en 60 s`);
}

async function main([installer, shots]) {
  if (!installer || !shots) throw new Error("usage : node scripts/windows-fumee.mjs <installateur .exe> <dossier des captures>");
  fs.mkdirSync(shots, { recursive: true });
  let failed = 0;
  const check = (cond, msg) => { console.log(cond ? "  ✓" : "  ✗", msg); if (!cond) failed++; };
  const shot = async (page, name) => { try { const { data } = await page.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(shots, name), Buffer.from(data, "base64")); } catch {} };
  const vault = path.join(process.env.APPDATA || "", IDENTIFIER, "selene");

  console.log("installée en silence, puis lancée");
  run(installer, ["/S"]);
  let exe = null;
  for (let i = 0; i < 30 && !exe; i++) { exe = findInstalled(); if (!exe) await sleep(1000); }
  check(!!exe, `installée : ${exe || "introuvable sous %LOCALAPPDATA% et %ProgramFiles%"}`);
  if (!exe) throw new Error("rien à lancer");
  let page = await launch(exe, 9333);
  await steps.entrance(page);
  check(true, "l'écran d'entrée s'affiche");
  const runtime = await page.evaluate("window.seleneNative && window.seleneNative.runtime");
  check(runtime === "tauri", `dans la coquille Tauri (${runtime})`);
  check(await steps.edition(page) === "complete", "l'édition complète (celle de Windows)");
  await shot(page, "1-entree.png");
  await steps.enterAndCapture(page);
  await sleep(3000); // l'écriture du coffre traverse l'appel au cœur Rust, puis le disque
  await shot(page, "2-capture.png");
  const errors1 = [...page.errors]; page.close();

  console.log("tuée, puis relancée");
  kill(); await sleep(2000);
  check(processes() === 0, "plus aucune Selene après l'avoir tuée");
  page = await launch(exe, 9334);
  await steps.noteKept(page);
  check(true, "la note est là, sans repasser par l'écran d'entrée");
  const files = fs.existsSync(vault) ? fs.readdirSync(vault) : [];
  console.log(`    ${vault} : ${files.join(", ") || "(vide)"}`);
  check(files.includes(hex("selene-site-v1")) && !files.some(f => f.endsWith(".tmp")), "le coffre de fichiers, sans temporaire resté au repos");
  await shot(page, "3-relance.png");

  console.log("une seconde Selene");
  spawn(exe, [], { detached: true, stdio: "ignore", env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9335" } }).unref();
  await sleep(6000);
  check(processes() === 1, `une seule Selene tourne (${processes()})`);
  await waitFor(page, "document.readyState === 'complete'", "la première, toujours là");
  check(true, "la première répond encore");
  const errors2 = [...page.errors]; page.close();

  const errors = [...errors1, ...errors2];
  check(!errors.length, "aucune exception JavaScript" + (errors.length ? " : " + errors.map(e => e.split("\n")[0]).join(" | ") : ""));
  kill();
  if (failed) throw new Error(`${failed} vérification(s) en échec`);
  console.log("Fumée verte.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.log("  ✗", e.message); kill(); process.exit(1); });
}
