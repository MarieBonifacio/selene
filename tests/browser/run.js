/* Lance chaque scénario de navigateur contre un petit serveur de fichiers statique (la racine du dépôt,
   donc les index.html et sw.js générés par build.py). Usage : node tests/browser/run.js [nom…]
   Les scénarios tournent en parallèle (SELENE_JOBS, 6 par défaut : ils dorment presque tout le temps, le processeur
   n'est pas le facteur limitant) ; la sortie de chacun est affichée d'un bloc, à sa fin, pour rester lisible.
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
  const jobs = Math.max(1, Number(process.env.SELENE_JOBS) || 6);
  const failed = [];
  // Les plus lents d'abord : sinon l'un d'eux, lancé en dernier, prolongerait seul la fin de la suite.
  const size = f => { try { return fs.statSync(path.join(__dirname, f)).size; } catch { return 0; } };
  const queue = [...scenarios].sort((a, b) => size(b) - size(a));
  const run = f => new Promise(resolve => {
    let out = '';
    // Asynchrone : un lancement synchrone bloquerait ce processus, donc le serveur dont le scénario a besoin.
    const child = spawn(process.execPath, [path.join(__dirname, f)], { env: { ...process.env, SELENE_BASE: base } });
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { out += '  ✗ délai dépassé (3 min)\n'; child.kill(); }, 180000);
    child.on('exit', c => { clearTimeout(timer); resolve({ f, code: c, out }); });
  });
  const worker = async () => {
    for (let f; (f = queue.shift());) {
      const r = await run(f);
      console.log(`\n— ${r.f}${r.code === 0 ? '' : '  (ÉCHEC)'}\n${r.out.replace(/\n$/, '')}`);
      if (r.code !== 0) failed.push(r.f);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, scenarios.length) }, worker));
  server.close();
  console.log(failed.length ? `\n${failed.length}/${scenarios.length} scénario(s) en échec : ${failed.sort().join(', ')}` : `\n${scenarios.length} scénarios, tous verts.`);
  process.exit(failed.length ? 1 : 0);
});
