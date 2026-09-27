"""Generate the standalone Claude artifact and the hosted PWA from one source tree."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
shell = (SOURCE / "shell.html").read_text(encoding="utf-8")
assert shell.count("<!-- SELENE_SCRIPT -->") == 1
scripts = ["sync.js", "store.js", "auth.js", "backup.js", "domain.js", "app.js"]
js = "\n".join((SOURCE / name).read_text(encoding="utf-8") for name in scripts)
standalone = shell.replace("<!-- SELENE_SCRIPT -->", "<script>\n(() => {\n" + js + "})();\n</script>")

head = """<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.anthropic.com https://fonts.googleapis.com https://fonts.gstatic.com https://*.supabase.co; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'">
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
sw = """<script>if ("serviceWorker" in navigator && !window.claude) navigator.serviceWorker.register("sw.js").catch(() => {});</script>
"""
assert "<title>" in standalone and "</body>" in standalone
hosted = standalone.replace("<title>", head + "<title>", 1).replace("</body>", sw + "</body>", 1)

outputs = {"selene.html": standalone, "index.html": hosted}
if sys.argv[1:] == ["--check"]:
    stale = [name for name, content in outputs.items() if not (ROOT / name).exists() or (ROOT / name).read_text(encoding="utf-8") != content]
    if stale:
        sys.exit("Generated files are stale: " + ", ".join(stale))
else:
    for name, content in outputs.items():
        (ROOT / name).write_text(content, encoding="utf-8")
    print("selene.html and index.html built")
