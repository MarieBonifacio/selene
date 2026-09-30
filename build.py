"""Generate the standalone Claude artifact and the hosted PWA from one source tree."""
from pathlib import Path
import base64
import hashlib
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
shell = (SOURCE / "shell.html").read_text(encoding="utf-8")
assert shell.count("<!-- SELENE_SCRIPT -->") == 1
# Deux assemblages esbuild (scripts/bundle.mjs) : la plateforme (src/platform.js), évaluée d'abord, puis l'application
# (src/app, modules ES, noyau compris), évaluée dans platform.ready : aussitôt sur le web, après l'ouverture
# d'IndexedDB ou l'hydratation des coffres d'une coquille native.
bundled = subprocess.run(["node", str(ROOT / "scripts" / "bundle.mjs")], cwd=ROOT, capture_output=True, encoding="utf-8")
if bundled.returncode:
    sys.exit(bundled.stderr + "\nAssemblage impossible (esbuild s'installe par `npm ci`)")
parts = json.loads(bundled.stdout)
js = parts["platform"] + "__platform.platform.ready(() => {\n" + parts["app"] + "});\n"
# Le script est posé tel quel dans une balise <script> : « </script » dans une chaîne le fermerait avant sa fin.
assert "</script" not in js.lower(), "« </script » dans le JavaScript : l'écrire en deux morceaux"
code = "\n(() => {\n" + js + "})();\n"
script = "<script>" + code + "</script>"
standalone = shell.replace("<!-- SELENE_SCRIPT -->", script)

sw_code = 'if ("serviceWorker" in navigator && !window.claude) navigator.serviceWorker.register("sw.js").catch(() => {});'
sw = "<script>" + sw_code + "</script>\n"
# Pas de 'unsafe-inline' pour les scripts : la CSP n'autorise que les scripts de la page, par leur empreinte SHA-256
# (calculée sur le texte exact entre <script> et </script>). Un script injecté, ou un attribut onclick=…, est refusé.
def csp_hash(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode("ascii") + "'"
CONNECT = ("'self' https://fonts.googleapis.com https://fonts.gstatic.com https://*.supabase.co https://api.open-meteo.com "
           "https://geocoding-api.open-meteo.com https://api.crossref.org https://api.microlink.io https://musicbrainz.org "
           "https://opendata.lillemetropole.fr https://api.openalex.org https://api.zotero.org")
# Les coquilles de bureau (Tauri) parlent à leur cœur par le protocole ipc (http://ipc.localhost sous Windows).
IPC = " ipc: http://ipc.localhost"
def csp(scripts, pwa):
    # Les styles gardent 'unsafe-inline' : l'interface pose des attributs style="…", qu'une empreinte ne couvre pas.
    return ("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src " + " ".join(["'self'"] + [csp_hash(x) for x in scripts])
            + "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
            + "img-src 'self' data: blob: https://coverartarchive.org https://*.archive.org; connect-src " + CONNECT + ("" if pwa else IPC) + "; "
            + ("worker-src 'self'; manifest-src 'self'; " if pwa else "") + "base-uri 'none'; form-action 'none'\">\n")
THEME = """<meta name="theme-color" content="#0e1310" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#e2e6de" media="(prefers-color-scheme: light)">
"""
head = csp([code, sw_code], pwa=True) + """<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Selene">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
""" + THEME
# La page des coquilles natives (Capacitor, Tauri) : la même, sans service worker ni manifeste (l'app est déjà installée,
# ses fichiers déjà sur l'appareil), donc un seul script à autoriser.
# Son premier script est l'amorçage natif (src/native/boot.js) : il pose les coffres de l'appareil avant Selene.
boot_code = "\n" + (SOURCE / "native" / "boot.js").read_text(encoding="utf-8")
assert "</script" not in boot_code.lower()
native_head = csp([boot_code, code], pwa=False) + THEME

# Les ajouts de la version hébergée se font dans le squelette, avant d'y poser le script : le JavaScript peut contenir
# « <title> » ou « </body> » dans ses chaînes (la planche téléchargée en a), et un remplacement ne doit jamais l'atteindre.
assert shell.count("<title>") == 1 and shell.count("</body>") == 1
hosted = shell.replace("<title>", head + "<title>", 1).replace("</body>", sw + "</body>", 1).replace("<!-- SELENE_SCRIPT -->", script)
native = shell.replace("<title>", native_head + "<title>", 1).replace("<!-- SELENE_SCRIPT -->", "<script>" + boot_code + "</script>\n" + script)

outputs = {"selene.html": standalone, "index.html": hosted}
if sys.argv[1:2] == ["--dist"]:
    # Les trois sorties, chacune dans son dossier (non versionné) : dist/web pour GitHub Pages, dist/artifact pour
    # claude.ai, dist/native pour les coquilles natives (Capacitor, Tauri).
    dist = ROOT / (sys.argv[2] if len(sys.argv) > 2 else "dist")
    web = {"index.html": hosted}
    files = {**{f"web/{n}": c for n, c in web.items()}, "artifact/selene.html": standalone, "native/index.html": native}
    for rel, content in files.items():
        (dist / rel).parent.mkdir(parents=True, exist_ok=True)
        (dist / rel).write_text(content, encoding="utf-8")
    for name in ["sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "confidentialite.html"]:
        shutil.copyfile(ROOT / name, dist / "web" / name)
    print(f"{dist.relative_to(ROOT) if dist.is_relative_to(ROOT) else dist}: web, artifact, native built")
elif sys.argv[1:] == ["--check"]:
    stale = [name for name, content in outputs.items() if not (ROOT / name).exists() or (ROOT / name).read_text(encoding="utf-8") != content]
    if stale:
        sys.exit("Generated files are stale: " + ", ".join(stale))
else:
    for name, content in outputs.items():
        (ROOT / name).write_text(content, encoding="utf-8")
    print("selene.html and index.html built")
