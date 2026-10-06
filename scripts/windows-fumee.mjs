/* Fumée de l'app Windows installée (BL-08 du cahier de recette ; workflow desktop.yml). L'installateur NSIS s'installe
   en silence ; l'app démarre sur son écran d'entrée ; on entre sans compte et on capture une note ; tuée puis relancée,
   l'app la retrouve (le coffre de fichiers du cœur Rust, native/tauri/src/main.rs : %APPDATA%\<identifiant>\selene) ;
   une seconde Selene lancée pendant que la première tourne ne reste pas (une seule instance, qui ramène sa fenêtre).
   La page est pilotée comme sur Android (scripts/android-fumee.mjs : cdp, waitFor, steps), par le protocole de débogage
   de Chrome, que WebView2 ouvre sur 127.0.0.1:PORT. Pas par la variable WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS : wry passe
   ses propres arguments à WebView2, qui ignore alors la variable (constaté le 6 octobre 2026). La fumée installe donc une
   variante, construite après le dépôt de l'installateur publié et jamais publiée elle-même : la même app, dont la
   fenêtre ajoute --remote-debugging-port (additionalBrowserArgs de Tauri). Le workflow rend d'abord le projet Supabase
   injoignable : rien de cet essai ne part vers le vrai serveur.
   Usage : node scripts/windows-fumee.mjs config <fichier>          (la configuration de la variante, pour tauri build --config)
           node scripts/windows-fumee.mjs <installateur .exe> <dossier des captures> */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cdp, steps, waitFor } from "./android-fumee.mjs";

const IDENTIFIER = "io.github.mariebonifacio.selene", EXE = "selene.exe", PORT = 9333;
// Les arguments que wry donne à WebView2 quand l'app n'en fixe pas : la variante les garde, et ajoute le port.
const WRY_DEFAULT_ARGS = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
/* La configuration de la variante : les fenêtres de native/tauri/tauri.conf.json, telles quelles, plus le port de
   débogage (un tableau se remplace en entier dans une fusion de configuration : on les recopie, on ne les réécrit pas). */
export function smokeConfig(conf) {
  return { app: { windows: conf.app.windows.map(w => ({ ...w, additionalBrowserArgs: `${WRY_DEFAULT_ARGS} --remote-debugging-port=${PORT}` })) } };
}
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
/* Démarrer l'app, sa sortie dans un fichier du dossier des captures (une panique du cœur Rust s'y lit), et savoir quand
   elle s'arrête. Le débogage de WebView2 est demandé par la variable d'environnement, sur un port neuf à chaque fois. */
function start(exe, name, shots) {
  const log = path.join(shots, `selene-${name}.log`), fd = fs.openSync(log, "w");
  const child = spawn(exe, [], { stdio: ["ignore", fd, fd] });
  const state = { child, log, exited: null };
  child.on("exit", code => { state.exited = code ?? "signal"; });
  child.on("error", e => { state.exited = e.message; });
  return state;
}
// Ce qui aide à comprendre un échec : les processus de l'app et de WebView2 (avec leurs arguments), les ports en écoute.
function diagnose(port) {
  const ps = cmd => { try { return run("powershell", ["-NoProfile", "-Command", cmd]).trim(); } catch (e) { return `(${e.message.split("\n")[0]})`; } };
  console.log(`    processus ${EXE} : ${processes()}`);
  console.log("    WebView2 : " + (ps("Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe'\" | Select-Object -First 2 -ExpandProperty CommandLine") || "(aucun)").replace(/\s+/g, " ").slice(0, 900));
  console.log(`    port ${port} : ` + (ps(`Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`) || "(personne n'écoute)"));
}
/* Lancer l'app et s'attacher à sa page. */
async function launch(exe, name, shots, port = PORT) {
  const app = start(exe, name, shots);
  for (const end = Date.now() + 60000; Date.now() < end; await sleep(500)) {
    if (app.exited !== null) throw new Error(`l'app s'est arrêtée (${app.exited}) : ${fs.readFileSync(app.log, "utf8").trim().slice(-600) || "rien sur sa sortie"}`);
    let list = [];
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { continue; }
    const target = list.find(t => t.type === "page" && /^https?:\/\/tauri\.localhost/.test(t.url));
    if (target) return cdp(target.webSocketDebuggerUrl || `ws://127.0.0.1:${port}/devtools/page/${target.id}`);
    if (list.length) console.log(`    pages vues : ${list.map(t => `${t.type} ${t.url}`).join(" ; ")}`);
  }
  diagnose(port);
  throw new Error(`la WebView2 de l'app n'a pas ouvert son port de débogage (${port}) en 60 s ; sortie de l'app : ${fs.readFileSync(app.log, "utf8").trim().slice(-400) || "rien"}`);
}

async function main([installer, shots]) {
  if (installer === "config") {
    const conf = JSON.parse(fs.readFileSync(new URL("../native/tauri/tauri.conf.json", import.meta.url), "utf8"));
    fs.writeFileSync(shots, JSON.stringify(smokeConfig(conf), null, 2));
    console.log(`variante de la fumée : ${shots}`);
    return;
  }
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
  let page = await launch(exe, "1", shots);
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
  page = await launch(exe, "2", shots);
  await steps.noteKept(page);
  check(true, "la note est là, sans repasser par l'écran d'entrée");
  const files = fs.existsSync(vault) ? fs.readdirSync(vault) : [];
  console.log(`    ${vault} : ${files.join(", ") || "(vide)"}`);
  check(files.includes(hex("selene-site-v1")) && !files.some(f => f.endsWith(".tmp")), "le coffre de fichiers, sans temporaire resté au repos");
  await shot(page, "3-relance.png");

  console.log("une seconde Selene");
  const second = start(exe, "seconde", shots);
  for (let i = 0; i < 20 && second.exited === null; i++) await sleep(500);
  check(second.exited !== null, `la seconde s'arrête d'elle-même${second.exited === null ? " (elle tourne encore)" : ""}`);
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
