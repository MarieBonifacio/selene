/* Lance chaque scénario de navigateur contre un petit serveur de fichiers statique (la racine du dépôt,
   donc les index.html et sw.js générés par build.py). Usage : node tests/browser/run.js [nom…]
   Code de sortie 1 si un scénario échoue. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const only = process.argv.slice(2);
  const scenarios = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && !['helpers.js', 'run.js'].includes(f))
    .filter(f => !only.length || only.some(o => f.includes(o))).sort();
  const failed = [];
  for (const f of scenarios) {
    console.log(`\n— ${f}`);
    // Asynchrone : un lancement synchrone bloquerait ce processus, donc le serveur dont le scénario a besoin.
    const code = await new Promise(resolve => {
      const child = spawn(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', env: { ...process.env, SELENE_BASE: base } });
      const timer = setTimeout(() => { console.log('  ✗ délai dépassé (3 min)'); child.kill(); }, 180000);
      child.on('exit', c => { clearTimeout(timer); resolve(c); });
    });
    if (code !== 0) failed.push(f);
  }
  server.close();
  console.log(failed.length ? `\n${failed.length}/${scenarios.length} scénario(s) en échec : ${failed.join(', ')}` : `\n${scenarios.length} scénarios, tous verts.`);
  process.exit(failed.length ? 1 : 0);
});
