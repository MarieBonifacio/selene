"""Construit index.html (version hébergée / iPhone) à partir de selene.html (version claude.ai)."""
import sys
src = open(sys.argv[1] if len(sys.argv) > 1 else "selene.html", encoding="utf-8").read()
head = """<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.anthropic.com https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'">
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
assert "<title>" in src and "</body>" in src
out = src.replace("<title>", head + "<title>", 1).replace("</body>", sw + "</body>", 1)
open("index.html", "w", encoding="utf-8").write(out)
print("index.html construit")
