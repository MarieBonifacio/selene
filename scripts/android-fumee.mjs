/* Fumée de l'app Android sur émulateur (BL-07 du cahier de recette ; workflow android-fumee.yml). L'APK de débogage
   s'installe et démarre sur son écran d'entrée ; on entre sans compte et on capture une note ; tuée puis relancée,
   l'app la retrouve (le coffre de fichiers natif, src/native/boot.js : files/selene) ; mise à jour par l'APK de
   l'édition des stores (même signature de débogage), elle la garde encore, sans « Reprendre la main ».
   La page est pilotée par le protocole de débogage de Chrome (CDP), que la WebView d'une version de débogage expose sur
   une prise locale (webview_devtools_remote_<pid>, redirigée par adb forward) : Node 22 a WebSocket et fetch, rien à
   installer. L'émulateur est mis hors ligne d'abord : rien de cet essai ne part vers le vrai serveur.
   Usage : node scripts/android-fumee.mjs <apk complet> <apk des stores> <dossier des captures>
   Les fonctions qui parlent à la page (cdp, waitFor, les étapes) sont exportées : on les met au point contre un
   Chromium de bureau lancé avec --remote-debugging-port. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PKG = "io.github.mariebonifacio.selene";
export const NOTE = "Note de fumée, écrite sur l'émulateur";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Un client CDP minimal : evaluate (valeur rendue telle quelle, promesses attendues), et les exceptions de la page. */
export async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`CDP injoignable : ${wsUrl}`)); });
  let n = 0;
  const waiting = new Map(), errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) {
      const { res, rej } = waiting.get(d.id); waiting.delete(d.id);
      if (d.error) rej(new Error(d.error.message)); else res(d.result);
    } else if (d.method === "Runtime.exceptionThrown") {
      const x = d.params.exceptionDetails;
      errors.push((x.exception && x.exception.description) || x.text);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++n; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  await send("Runtime.enable");
  const evaluate = async expression => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  return { send, evaluate, errors, close: () => ws.close() };
}
/* Attendre qu'une expression de la page soit vraie (une page qui se charge peut aussi refuser l'évaluation : on réessaie). */
export async function waitFor(page, expression, what, ms = 30000) {
  let last = null;
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) {
    try { if (await page.evaluate(expression)) return; } catch (e) { last = e; }
  }
  throw new Error(`délai dépassé : ${what}${last ? ` (${last.message.split("\n")[0]})` : ""}`);
}
const js = v => JSON.stringify(v);
/* Les étapes, vues de la page. */
export const steps = {
  entrance: page => waitFor(page, `!!document.querySelector('[data-act="auth-local"]')`, "l'écran d'entrée"),
  native: page => page.evaluate(`({ capacitor: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()), runtime: window.seleneNative && window.seleneNative.runtime })`),
  async enterAndCapture(page) {
    await page.evaluate(`document.querySelector('[data-act="auth-local"]').click()`);
    await waitFor(page, `!!document.querySelector('[data-act="welcome-path"][data-path="ecrire"]')`, "la première question");
    await page.evaluate(`document.querySelector('[data-act="welcome-path"][data-path="ecrire"]').click()`);
    await waitFor(page, `!!document.querySelector('#capIn')`, "le champ de capture");
    await page.evaluate(`(() => { const i = document.querySelector('#capIn'); i.value = ${js(NOTE)}; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-act="cap-add"]').click(); })()`);
  },
  /* Ouverte de nouveau : ni écran d'entrée (le choix « sans compte » est gardé), ni note perdue. Sans mot de l'interface :
     l'émulateur parle anglais, et Selene suit la langue de l'appareil. */
  async noteKept(page) {
    await waitFor(page, `!!document.querySelector('#nav a') && !('auth' in document.documentElement.dataset)`, "la navigation, sans écran d'entrée");
    await page.evaluate(`location.hash = 'inbox'`);
    await waitFor(page, `document.querySelector('#main').innerText.includes(${js(NOTE)})`, "la note capturée");
  },
  edition: page => page.evaluate(`(() => { const s = [...document.scripts].map(x => x.textContent).join(''); return s.includes('"rlm-setup"') ? 'complete' : s.includes('absent: true') ? 'stores' : 'inconnue'; })()`)
};

/* ---- côté émulateur ---- */
// Chaque appel est borné (trois minutes : une installation d'APK y tient) : un émulateur figé fait échouer, il ne bloque pas.
const adb = (...args) => execFileSync("adb", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 });
const adbBuffer = (...args) => execFileSync("adb", args, { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], timeout: 180000 });
const pid = () => { try { return adb("shell", "pidof", PKG).trim().split(/\s+/)[0] || null; } catch { return null; } };
let port = 9222;
/* Lancer l'app et s'attacher à sa page (une nouvelle prise, et un nouveau port, à chaque processus). */
async function launch() {
  adb("shell", "am", "start", "-W", "-n", `${PKG}/.MainActivity`);
  for (const end = Date.now() + 60000; Date.now() < end; await sleep(500)) {
    const p = pid(); if (!p) continue;
    if (!adb("shell", "cat", "/proc/net/unix").includes(`webview_devtools_remote_${p}`)) continue;
    const local = ++port;
    adb("forward", `tcp:${local}`, `localabstract:webview_devtools_remote_${p}`);
    let list = [];
    try { list = await (await fetch(`http://127.0.0.1:${local}/json/list`)).json(); } catch { continue; }
    const target = list.find(t => t.type === "page" && /^https?:\/\/localhost/.test(t.url));
    if (target) return cdp(`ws://127.0.0.1:${local}/devtools/page/${target.id}`);
  }
  throw new Error("la WebView de l'app n'est pas apparue en 60 s (débogage de la WebView désactivé ?)");
}
const stop = () => adb("shell", "am", "force-stop", PKG);

async function main([full, stores, shots]) {
  if (!full || !stores || !shots) throw new Error("usage : node scripts/android-fumee.mjs <apk complet> <apk des stores> <dossier des captures>");
  fs.mkdirSync(shots, { recursive: true });
  let failed = 0;
  const check = (cond, msg) => { console.log(cond ? "  ✓" : "  ✗", msg); if (!cond) failed++; };
  const shot = name => fs.writeFileSync(path.join(shots, name), adbBuffer("exec-out", "screencap", "-p"));
  // Hors ligne : les essais ne doivent rien écrire sur le vrai serveur (la page se sert elle-même : https://localhost).
  for (const cmd of [["cmd", "connectivity", "airplane-mode", "enable"], ["svc", "wifi", "disable"], ["svc", "data", "disable"]]) { try { adb("shell", ...cmd); } catch {} }
  try { adb("uninstall", PKG); } catch {}

  console.log("installée, puis lancée à froid");
  adb("install", full);
  let page = await launch();
  await steps.entrance(page);
  check(true, "l'écran d'entrée s'affiche");
  const n = await steps.native(page);
  check(n.capacitor && n.runtime === "capacitor", `dans la coquille Capacitor (${JSON.stringify(n)})`);
  check(await steps.edition(page) === "complete", "l'APK de débogage est l'édition complète");
  shot("1-entree.png");
  await steps.enterAndCapture(page);
  await sleep(3000); // l'écriture des coffres traverse le pont, puis le disque
  shot("2-capture.png");
  const errors1 = [...page.errors]; page.close();

  console.log("tuée, puis relancée");
  stop(); await sleep(1000);
  page = await launch();
  await steps.noteKept(page);
  check(true, "la note est là, sans repasser par l'écran d'entrée");
  const files = adb("shell", "run-as", PKG, "ls", "files/selene");
  check(files.includes("selene-site-v1") && !files.includes(".tmp"), `le coffre de fichiers, sans temporaire resté : ${files.trim().split(/\s+/).join(", ")}`);
  shot("3-relance.png");
  const errors2 = [...page.errors]; page.close();

  console.log("mise à jour par l'édition des stores");
  stop();
  adb("install", "-r", stores);
  page = await launch();
  await steps.noteKept(page);
  check(true, "la note survit à la mise à jour");
  check(await steps.edition(page) === "stores", "l'édition des stores, sans « Reprendre la main »");
  shot("4-stores.png");
  const errors3 = [...page.errors]; page.close();

  const errors = [...errors1, ...errors2, ...errors3];
  check(!errors.length, "aucune exception JavaScript" + (errors.length ? " : " + errors.map(e => e.split("\n")[0]).join(" | ") : ""));
  stop();
  if (failed) throw new Error(`${failed} vérification(s) en échec`);
  console.log("Fumée verte.");
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.log("  ✗", e.message); process.exit(1); });
}
