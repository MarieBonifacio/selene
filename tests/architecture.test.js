/* L'architecture, vérifiée : qui peut importer quoi, et ce qui peut s'exécuter au chargement d'un module.
   - src/core est pur : il n'importe que src/core (ni interface, ni plateforme) ;
   - src/app n'importe que src/app, src/core et src/platform.js ; rien n'importe src/native (posé à part) ;
   - au chargement d'un module (hors des fonctions), il n'utilise un import que si ce module-là ne dépend pas, même
     de loin, de lui : pas de cycle dans ce qui s'exécute tout de suite. Les cycles entre fonctions restent permis (un
     appel a lieu après le chargement de tous), mais l'ordre d'évaluation, lui, ne peut jamais rien casser ;
   - aucun module n'écrit dans une variable d'un autre (un import est en lecture seule : on passe par une fonction). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const rel = f => path.relative(process.cwd(), f).split(path.sep).join('/');
const graph = (() => {
  const r = esbuild.buildSync({ entryPoints: ['src/platform.js', 'src/app/index.js'], bundle: true, write: false, metafile: true, format: 'esm', outdir: 'x', logLevel: 'silent' });
  return Object.fromEntries(Object.entries(r.metafile.inputs).map(([f, v]) => [f, v.imports.map(i => i.path)]));
})();
const reach = from => { const seen = new Set(), todo = [...(graph[from] || [])]; while (todo.length) { const f = todo.pop(); if (!seen.has(f)) { seen.add(f); todo.push(...(graph[f] || [])); } } return seen; };

test('les couches : le noyau est pur, l’application ne passe que par la plateforme', () => {
  const bad = [];
  for (const [f, deps] of Object.entries(graph)) for (const d of deps) {
    if (f.startsWith('src/core/') && !d.startsWith('src/core/')) bad.push(`${f} → ${d}`);
    if (f.startsWith('src/app/') && !(d.startsWith('src/app/') || d.startsWith('src/core/') || d === 'src/platform.js')) bad.push(`${f} → ${d}`);
    if (d.startsWith('src/native/')) bad.push(`${f} → ${d}`);
  }
  assert.deepEqual(bad, []);
  assert.deepEqual(graph['src/platform.js'], [], 'la plateforme ne dépend de rien');
  assert.deepEqual(graph['src/app/registry.js'], [], 'les registres ne dépendent de rien');
});

test('rien ne s’exécute au chargement qui dépende d’un module en cycle avec soi ; aucune écriture dans un import', async () => {
  const { parse } = await import('espree');
  const { analyze } = await import('eslint-scope');
  const bad = [];
  for (const f of Object.keys(graph).filter(f => f.startsWith('src/'))) {
    const code = fs.readFileSync(f, 'utf8');
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', loc: true, range: true });
    const scope = analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }).scopes.find(s => s.type === 'module');
    const from = new Map(); // nom importé → fichier qui le déclare
    for (const s of ast.body) if (s.type === 'ImportDeclaration') {
      const target = rel(path.resolve(path.dirname(f), s.source.value));
      for (const sp of s.specifiers) from.set(sp.local.name, target);
    }
    for (const v of scope.variables) {
      if (!from.has(v.name)) continue;
      const target = from.get(v.name);
      for (const r of v.references) {
        if (r.isWrite()) bad.push(`${f}:${r.identifier.loc.start.line} écrit ${v.name} (${target})`);
        let s = r.from; while (s.type !== 'function' && s.type !== 'module') s = s.upper;
        if (s.type === 'module' && reach(target).has(f)) bad.push(`${f}:${r.identifier.loc.start.line} utilise ${v.name} au chargement, mais ${target} dépend de ${f}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('aucun module n’est chargé sans servir : chaque fichier de src/app et src/core est atteint', () => {
  const files = ['src/app', 'src/core'].flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));
  const reached = new Set([...reach('src/app/index.js'), 'src/app/index.js']);
  assert.deepEqual(files.filter(f => !reached.has(f)), []);
});
