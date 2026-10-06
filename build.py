"""Generate the standalone Claude artifact and the hosted PWA from one source tree."""
from pathlib import Path
import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
shell = (SOURCE / "shell.html").read_text(encoding="utf-8")
assert shell.count("<!-- SELENE_SCRIPT -->") == 1 and shell.count("<!-- SELENE_FONTS -->") == 1
# Les polices. Le site et les apps les servent eux-mêmes (fonts/, sous licence OFL : voir fonts/LISEZMOI.md) : aucune
# adresse IP ne part chez Google à l'ouverture. L'artefact claude.ai, un seul fichier, garde Google Fonts, la seule
# source de feuilles de style que claude.ai admette.
FONTS_SELF = "<style>\n" + (ROOT / "fonts" / "polices.css").read_text(encoding="utf-8") + "</style>\n"
FONTS_GOOGLE = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=Spectral+SC:wght@500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
"""
# Deux assemblages esbuild (scripts/bundle.mjs) : la plateforme (src/platform.js), évaluée d'abord, puis l'application
# (src/app, modules ES, noyau compris), évaluée dans platform.ready : aussitôt sur le web, après l'ouverture
# d'IndexedDB ou l'hydratation des coffres d'une coquille native.
bundled = subprocess.run(["node", str(ROOT / "scripts" / "bundle.mjs")], cwd=ROOT, capture_output=True, encoding="utf-8")
if bundled.returncode:
    sys.exit(bundled.stderr + "\nAssemblage impossible (esbuild s'installe par `npm ci`)")
parts = json.loads(bundled.stdout)
# L'édition des stores (SELENE_EDITION=stores, scripts/bundle.mjs : sans « Reprendre la main ») ne sort que dans dist/ :
# les fichiers versionnés (selene.html, index.html), que le web et build.py --check lisent, restent l'édition complète.
if parts["edition"] != "complete" and sys.argv[1:2] != ["--dist"]:
    sys.exit(f"Édition « {parts['edition']} » : seulement avec --dist (les fichiers versionnés sont l'édition complète)")
# De même pour un autre projet Supabase (SELENE_SUPABASE_URL, la préproduction de la recette) : jamais dans les fichiers
# versionnés, que le web publie.
if parts["project"] != "app" and sys.argv[1:2] != ["--dist"]:
    sys.exit(f"Projet Supabase « {parts['supabase']['url']} » : seulement avec --dist (les fichiers versionnés parlent au projet de l'app)")
js = parts["platform"] + "__platform.platform.ready(() => {\n" + parts["app"] + "});\n"
# Le script est posé tel quel dans une balise <script> : « </script » dans une chaîne le fermerait avant sa fin.
assert "</script" not in js.lower(), "« </script » dans le JavaScript : l'écrire en deux morceaux"
# L'empreinte du code, pour le journal des erreurs (src/app/services/journal.js) : la même source donne la même empreinte,
# sans date ni commit, et build.py --check reste stable.
build_id = hashlib.sha256(js.encode("utf-8")).hexdigest()[:10]
code = "\n(() => {\nconst SELENE_BUILD = \"" + build_id + "\";\n" + js + "})();\n"
script = "<script>" + code + "</script>"
standalone = shell.replace("<!-- SELENE_FONTS -->\n", FONTS_GOOGLE).replace("<!-- SELENE_SCRIPT -->", script)

sw_code = 'if ("serviceWorker" in navigator && !window.claude) navigator.serviceWorker.register("sw.js").catch(() => {});'
sw = "<script>" + sw_code + "</script>\n"
# Pas de 'unsafe-inline' pour les scripts : la CSP n'autorise que les scripts de la page, par leur empreinte SHA-256
# (calculée sur le texte exact entre <script> et </script>). Un script injecté, ou un attribut onclick=…, est refusé.
def csp_hash(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode("ascii") + "'"
CONNECT = ("'self' https://*.supabase.co https://api.open-meteo.com "
           "https://geocoding-api.open-meteo.com https://api.crossref.org https://api.microlink.io https://musicbrainz.org "
           "https://public.opendatasoft.com https://api.openalex.org https://api.zotero.org")
# Les coquilles de bureau (Tauri) parlent à leur cœur par le protocole ipc (http://ipc.localhost sous Windows).
IPC = " ipc: http://ipc.localhost"
def csp(scripts, pwa):
    # Les styles gardent 'unsafe-inline' : l'interface pose des attributs style="…", qu'une empreinte ne couvre pas.
    return ("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src " + " ".join(["'self'"] + [csp_hash(x) for x in scripts])
            + "; style-src 'self' 'unsafe-inline'; font-src 'self'; "
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
own = shell.replace("<!-- SELENE_FONTS -->\n", FONTS_SELF)
hosted = own.replace("<title>", head + "<title>", 1).replace("</body>", sw + "</body>", 1).replace("<!-- SELENE_SCRIPT -->", script)
native = own.replace("<title>", native_head + "<title>", 1).replace("<!-- SELENE_SCRIPT -->", "<script>" + boot_code + "</script>\n" + script)

# La page publique de test (E3 de l'audit, docs/essai.md) : statique, à côté de l'app, sans son script. Le sien (src/essai.js)
# et ses deux feuilles de style sont autorisés par leur empreinte ; elle ne parle qu'au projet Supabase, dont l'adresse et
# la clé publique sont lues dans auth.js (une seule source). Ni cookie, ni stockage : voir src/essai.js.
supa_url, supa_key = parts["supabase"]["url"], parts["supabase"]["key"]  # lus dans auth.js par scripts/bundle.mjs
assert re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", supa_url) and re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]+", supa_key)
essai_js = "\n" + (SOURCE / "essai.js").read_text(encoding="utf-8").replace("__SUPABASE_URL__", supa_url).replace("__SUPABASE_KEY__", supa_key)
assert "</script" not in essai_js.lower() and "__SUPABASE" not in essai_js
essai_page = (SOURCE / "essai.html").read_text(encoding="utf-8")
assert all(essai_page.count(m) == 1 for m in ["<!-- ESSAI_CSP -->", "<!-- SELENE_FONTS -->", "<!-- ESSAI_SCRIPT -->"])
essai_page = essai_page.replace("<!-- SELENE_FONTS -->\n", FONTS_SELF).replace("<!-- ESSAI_SCRIPT -->", "<script>" + essai_js + "</script>")
essai_styles = re.findall(r"<style>(.*?)</style>", essai_page, re.S)
assert len(essai_styles) == 2 and "style=" not in essai_page, "essai.html : deux feuilles de style, aucun attribut style"
essai_csp = ("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src " + csp_hash(essai_js)
             + "; style-src " + " ".join(csp_hash(x) for x in essai_styles) + "; font-src 'self'; img-src 'self'; connect-src " + supa_url
             + "; base-uri 'none'; form-action 'none'\">")
essai = essai_page.replace("<!-- ESSAI_CSP -->", essai_csp)

outputs = {"selene.html": standalone, "index.html": hosted, "essai.html": essai}
if sys.argv[1:2] == ["--dist"]:
    # Les trois sorties, chacune dans son dossier (non versionné) : dist/web pour GitHub Pages, dist/artifact pour
    # claude.ai, dist/native pour les coquilles natives (Capacitor, Tauri).
    dist = ROOT / (sys.argv[2] if len(sys.argv) > 2 else "dist")
    web = {"index.html": hosted, "essai.html": essai}
    files = {**{f"web/{n}": c for n, c in web.items()}, "artifact/selene.html": standalone, "native/index.html": native}
    for rel, content in files.items():
        (dist / rel).parent.mkdir(parents=True, exist_ok=True)
        (dist / rel).write_text(content, encoding="utf-8")
    for name in ["sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "confidentialite.html", "privacy.html"]:
        shutil.copyfile(ROOT / name, dist / "web" / name)
    if (ROOT / "essai").is_dir():  # les captures de la page de test (npm run essai:captures ; absentes avant la première)
        shutil.copytree(ROOT / "essai", dist / "web" / "essai", dirs_exist_ok=True)
    for out in ["web", "native"]:  # les polices, avec leurs licences
        shutil.copytree(ROOT / "fonts", dist / out / "fonts", dirs_exist_ok=True)
    project = "" if parts["project"] == "app" else f", Supabase project {parts['supabase']['url']}"
    print(f"{dist.relative_to(ROOT) if dist.is_relative_to(ROOT) else dist}: web, artifact, native built ({parts['edition']} edition{project})")
elif sys.argv[1:] == ["--check"]:
    stale = [name for name, content in outputs.items() if not (ROOT / name).exists() or (ROOT / name).read_text(encoding="utf-8") != content]
    if stale:
        sys.exit("Generated files are stale: " + ", ".join(stale))
else:
    for name, content in outputs.items():
        (ROOT / name).write_text(content, encoding="utf-8")
    print("selene.html, index.html and essai.html built")
