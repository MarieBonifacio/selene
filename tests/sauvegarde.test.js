/* La sauvegarde chiffrée de la base (T4 de l'audit ; workflow Sauvegarde, scripts/sauvegarde.sh, docs/compte.md
   « Sauvegarder la base »). Le script tourne avec une fausse CLI Supabase et un faux age en tête du PATH : aucune base,
   aucun réseau, des données synthétiques. Le workflow est lu tel quel : ce qu'il publie, combien de temps, avec quoi. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'sauvegarde.sh');
const WORKFLOW = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'sauvegarde.yml'), 'utf8');

/* Un banc : un dossier de sortie, et deux faux outils qui notent ce qu'on leur demande. La fausse CLI écrit des vidages
   synthétiques (le schéma avec ou sans app_state) ; le faux age garde le destinataire et ce qu'il a chiffré. */
function bench({ schema = 'CREATE TABLE IF NOT EXISTS "public"."app_state" ("user_id" uuid);' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selene-sauvegarde-')), bin = path.join(root, 'bin'), log = path.join(root, 'log');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'supabase'), `#!/usr/bin/env bash
set -e
file=""; kind=schema
while [ $# -gt 0 ]; do case "$1" in -f) file="$2"; shift;; --role-only) kind=roles;; --data-only) kind=data;; esac; shift; done
echo "supabase $kind $file" >> "${log}"
case "$kind" in
  roles) echo '-- rôles synthétiques' > "$file";;
  data) printf 'COPY "public"."app_state" ("user_id") FROM stdin;\\n00000000-0000-0000-0000-000000000001\\n\\\\.\\n' > "$file";;
  *) echo '${schema}' > "$file";;
esac
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'age'), `#!/usr/bin/env bash
set -e
while [ $# -gt 0 ]; do case "$1" in -r) r="$2"; shift;; -o) o="$2"; shift;; esac; shift; done
echo "age $r $o" >> "${log}"
{ echo "AGE:$r"; tar -tzf -; } > "$o"
`, { mode: 0o755 });
  const run = (env = {}) => spawnSync('bash', [SCRIPT, path.join(root, 'sortie')], {
    encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, SUPABASE_DB_URL: 'postgresql://postgres.ref:mdp-synthetique@localhost:5432/postgres', AGE_RECIPIENT: 'age1synthetique', ...env }
  });
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []);
  const out = () => (fs.existsSync(path.join(root, 'sortie')) ? fs.readdirSync(path.join(root, 'sortie')) : []);
  return { root, run, calls, out };
}

test('sauvegarde : rôles, schéma et données vidés, archivés, chiffrés pour la clé publique ; rien en clair ne reste', () => {
  const b = bench(), r = b.run();
  assert.equal(r.status, 0, r.stderr);
  const files = b.out();
  assert.equal(files.length, 1);
  assert.match(files[0], /^selene-base-\d{4}-\d{2}-\d{2}T\d{4}Z\.tar\.gz\.age$/);
  const sealed = fs.readFileSync(path.join(b.root, 'sortie', files[0]), 'utf8');
  assert.match(sealed, /^AGE:age1synthetique\n/, 'chiffré pour la clé publique donnée');
  assert.deepEqual(sealed.split('\n').slice(1).filter(Boolean).sort(), ['data.sql', 'roles.sql', 'schema.sql'], 'les trois vidages, dans l’archive');
  const dumps = b.calls().filter(c => c.startsWith('supabase '));
  assert.deepEqual(dumps.map(c => c.split(' ')[1]), ['roles', 'schema', 'data']);
  const work = path.dirname(dumps[0].split(' ')[2]);
  assert.ok(!fs.existsSync(work), 'le dossier temporaire des vidages en clair est effacé');
  assert.doesNotMatch(r.stdout + r.stderr, /mdp-synthetique/, 'le mot de passe n’est jamais écrit');
});

test('sauvegarde : refusée sans la table app_state, ou pour une clé privée, ou sans adresse ; jamais un fichier trompeur', () => {
  const empty = bench({ schema: 'CREATE TABLE "public"."autre" (id int);' }), r = empty.run();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pas la table public\.app_state/);
  assert.deepEqual(empty.out(), [], 'aucune sauvegarde vide qui passerait pour une sauvegarde');
  assert.ok(!empty.calls().some(c => c.startsWith('age ')), 'rien de chiffré');
  const work = path.dirname(empty.calls()[0].split(' ')[2]);
  assert.ok(!fs.existsSync(work), 'effacé aussi en cas d’échec');

  const secret = bench(), s = secret.run({ AGE_RECIPIENT: 'AGE-SECRET-KEY-1SYNTHETIQUE' });
  assert.notEqual(s.status, 0);
  assert.match(s.stderr, /clé publique age/);
  assert.deepEqual(secret.calls(), [], 'la base n’est même pas lue');

  const nourl = bench(), n = nourl.run({ SUPABASE_DB_URL: '' });
  assert.notEqual(n.status, 0);
  assert.deepEqual(nourl.calls(), []);
});

test('workflow Sauvegarde : planifié et à la demande, lecture seule, actions épinglées, seul le fichier chiffré publié, 30 jours', () => {
  assert.match(WORKFLOW, /^\s+workflow_dispatch:/m);
  assert.match(WORKFLOW, /^\s+- cron: '[^']+'/m);
  assert.match(WORKFLOW, /^permissions:\n\s+contents: read\n/m, 'le jeton du dépôt en lecture seule');
  const uses = [...WORKFLOW.matchAll(/uses: (\S+)/g)].map(m => m[1]);
  assert.ok(uses.length >= 3);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${u} : épinglée par empreinte`);
  assert.match(WORKFLOW, /SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/, 'l’adresse de la base : un secret');
  assert.match(WORKFLOW, /AGE_RECIPIENT: \$\{\{ vars\.SAUVEGARDE_CLE_AGE \}\}/, 'la clé publique : une simple variable');
  assert.match(WORKFLOW, /::add-mask::/, 'le mot de passe seul masqué aussi');
  const upload = WORKFLOW.slice(WORKFLOW.indexOf('actions/upload-artifact'));
  assert.match(upload, /path: \$\{\{ runner\.temp \}\}\/sauvegarde\/\*\.age\n/, 'seul le fichier chiffré est publié');
  assert.equal(Number(upload.match(/retention-days: (\d+)/)[1]) <= 30, true, '30 jours au plus, comme le promet la politique');
  assert.match(upload, /if-no-files-found: error/);
  assert.doesNotMatch(WORKFLOW, /set -x|echo "\$SUPABASE_DB_URL"|--debug/, 'rien qui recopierait l’adresse dans le journal');
});
