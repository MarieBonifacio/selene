"""Generate the standalone Claude artifact and the hosted PWA from one source tree."""
from pathlib import Path
import base64
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
shell = (SOURCE / "shell.html").read_text(encoding="utf-8")
assert shell.count("<!-- SELENE_SCRIPT -->") == 1
# Le noyau (src/core, modules ES) d'abord, assemblé par esbuild (scripts/bundle-core.mjs) : il pose `__core`, dont
# chaque exportation devient une constante de la portée commune.
bundled = subprocess.run(["node", str(ROOT / "scripts" / "bundle-core.mjs")], cwd=ROOT, capture_output=True, encoding="utf-8")
if bundled.returncode:
    sys.exit(bundled.stderr + "\nAssemblage du noyau impossible (esbuild s'installe par `npm ci`)")
core = json.loads(bundled.stdout)
bridge = "const { " + ", ".join(core["exports"]) + " } = __core;\n"
# Puis les fichiers historiques, dans cet ordre : chacun ne peut utiliser au chargement que le noyau et ceux qui le précèdent.
scripts = ["store.js", "auth.js", "backup.js", "domain.js", "sky.js", "carte.js", "sources.js", "musique.js", "radar.js", "instagram.js", "passeur.js", "dehors.js", "veille.js", "agenda.js", "zotero.js", "app.js", "types.js", "assistant.js", "boot.js"]
js = core["code"] + bridge + "\n".join((SOURCE / name).read_text(encoding="utf-8") for name in scripts)
# Le script est posé tel quel dans une balise <script> : « </script » dans une chaîne le fermerait avant sa fin.
assert "</script" not in js.lower(), "« </script » dans le JavaScript : l'écrire en deux morceaux"
code = "\n(() => {\n" + js + "})();\n"
script = "<script>" + code + "</script>"
standalone = shell.replace("<!-- SELENE_SCRIPT -->", script)

sw_code = 'if ("serviceWorker" in navigator && !window.claude) navigator.serviceWorker.register("sw.js").catch(() => {});'
sw = "<script>" + sw_code + "</script>\n"
# Pas de 'unsafe-inline' pour les scripts : la CSP n'autorise que ces deux scripts-ci, par leur empreinte SHA-256
# (calculée sur le texte exact entre <script> et </script>). Un script injecté, ou un attribut onclick=…, est refusé.
def csp_hash(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode("ascii") + "'"
script_src = " ".join(["'self'", csp_hash(code), csp_hash(sw_code)])
# Les styles gardent 'unsafe-inline' : l'interface pose des attributs style="…", qu'une empreinte ne couvre pas.
head = """<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src """ + script_src + """; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://coverartarchive.org https://*.archive.org; connect-src 'self' https://api.anthropic.com https://fonts.googleapis.com https://fonts.gstatic.com https://*.supabase.co https://api.open-meteo.com https://geocoding-api.open-meteo.com https://api.crossref.org https://api.microlink.io https://musicbrainz.org https://opendata.lillemetropole.fr https://api.openalex.org https://api.zotero.org; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Selene">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0e1310" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#e2e6de" media="(prefers-color-scheme: light)">
"""

# Les ajouts de la version hébergée se font dans le squelette, avant d'y poser le script : le JavaScript peut contenir
# « <title> » ou « </body> » dans ses chaînes (la planche téléchargée en a), et un remplacement ne doit jamais l'atteindre.
assert shell.count("<title>") == 1 and shell.count("</body>") == 1
hosted = shell.replace("<title>", head + "<title>", 1).replace("</body>", sw + "</body>", 1).replace("<!-- SELENE_SCRIPT -->", script)

outputs = {"selene.html": standalone, "index.html": hosted}
if sys.argv[1:2] == ["--bundle"]:
    # Le script assemblé seul, pour l'analyse statique (eslint) : c'est lui, et non chaque fichier isolé, qui a une
    # portée cohérente, puisque les fichiers historiques de src/ partagent la même (ceux de src/core, eux, s'analysent un à un).
    out = ROOT / sys.argv[2]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("(() => {\n" + js + "})();\n", encoding="utf-8")
elif sys.argv[1:] == ["--check"]:
    stale = [name for name, content in outputs.items() if not (ROOT / name).exists() or (ROOT / name).read_text(encoding="utf-8") != content]
    if stale:
        sys.exit("Generated files are stale: " + ", ".join(stale))
else:
    for name, content in outputs.items():
        (ROOT / name).write_text(content, encoding="utf-8")
    print("selene.html and index.html built")
