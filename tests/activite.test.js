/* La mesure d'usage de la bêta (services/activite.js, E4) : sur un faux Supabase, ce qui part et quand. Un jour, rien
   d'autre ; avec la session ; une fois par jour et par chargement ; seulement quand le contenu d'un espace change (pas un
   réglage, pas un espace neuf et vide) ; jamais sans compte ; coupée depuis les Réglages ; réseau coupé : la saisie
   suivante réessaie. La table (doublons, jour imposé, compte imposé, lecture refusée, purge) : supabase/schema.sql,
   essayée contre PostgreSQL 16 et PostgREST, docs/compte.md. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fakeSupabase, launchHosted, settle } = require('./hosted-harness');

const start = async (o = {}) => { const server = fakeSupabase(), app = launchHosted({ fetch: server.fetch, ...o }); await settle(); return { server, app }; };
const stop = app => { app.site.disconnect(); app.board.disconnect(); };
const noter = (app, text) => { app.addNote(app.S().modules.inbox, text); app.site.save(); };

test('activité : une saisie, un jour, avec la session ; rien de ce qui est écrit', async () => {
  const { server, app } = await start();
  noter(app, 'CONFIDENTIEL_ACTIVITE');
  assert.equal(server.activite.length, 1);
  const { body, headers } = server.activite[0];
  assert.deepEqual(Object.keys(body), ['jour']);
  assert.match(body.jour, /^\d{4}-\d{2}-\d{2}$/); assert.equal(body.jour, app.todayISO());
  assert.equal(headers.Authorization, `Bearer ${app.session().access_token}`, 'la session dit qui');
  assert.equal(headers.apikey, app.SUPABASE_ANON_KEY);
  assert.doesNotMatch(JSON.stringify(server.activite), /CONFIDENTIEL_ACTIVITE|a@b\.c/);
  noter(app, 'une autre');
  assert.equal(server.activite.length, 1, 'une fois par jour et par chargement');
  stop(app);
});

test('activité : un réglage, un espace neuf et vide ne comptent pas ; le contenu, si', async () => {
  const { server, app } = await start();
  await app.site.sync(); // la base : ce que le serveur a, contenu compris
  app.S().config.palette = 'albedo'; app.site.save();
  app.installModule({ type: 'notes' }, 'Vide pour l’instant');
  assert.equal(server.activite.length, 0, 'palette, espace vide : pas une saisie');
  const id = app.S().config.modules[app.S().config.modules.length - 1].id;
  app.addNote(app.S().modules[id], 'la première note'); app.site.save();
  assert.equal(server.activite.length, 1, 'une note dans cet espace : oui');
  stop(app);
});

test('activité : jamais sans compte, ni coupée ; réseau coupé, la saisie suivante réessaie', async () => {
  { const { server, app } = await start({ session: null }); noter(app, 'sans compte'); assert.equal(server.activite.length, 0, 'sans compte : rien'); stop(app); }
  { const { server, app } = await start();
    assert.equal(app.activityOn(), true); app.setActivity(false); noter(app, 'coupée');
    assert.equal(server.activite.length, 0, 'coupée : rien'); assert.equal(app.activityOn(), false); stop(app); }
  { const { server, app } = await start();
    server.offline = true; noter(app, 'hors ligne'); await settle();
    server.offline = false; noter(app, 'en ligne');
    assert.equal(server.activite.length, 1, 'le second essai part'); stop(app); }
});

test('activité : la clé du contenu ignore les réglages et les espaces vides', () => {
  const { contentKey } = launchHosted({ fetch: fakeSupabase().fetch });
  const a = { inbox: { type: 'notes', label: 'Boîte', config: { inbox: true }, entries: [] } };
  const b = { inbox: { type: 'notes', label: 'Autre nom', config: { inbox: false }, entries: [] }, neuf: { type: 'taches', config: {}, entries: [] } };
  assert.equal(contentKey(a), contentKey(b));
  assert.notEqual(contentKey(a), contentKey({ inbox: { ...a.inbox, entries: [{ id: 'n1', text: 'x' }] } }));
});

test('activité : la table, écrite pour soi seulement, jamais relue, bornée par son déclencheur', () => {
  const schema = fs.readFileSync('supabase/schema.sql', 'utf8'), part = schema.slice(schema.indexOf('create table public.activite'), schema.indexOf('create trigger activite_borne'));
  assert.match(part, /references auth\.users \(id\) on delete cascade/, 'supprimer le compte efface ses lignes');
  assert.match(part, /enable row level security/);
  assert.match(part, /for insert to authenticated with check \(user_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(part, /for (select|update|delete|all)/, 'aucune lecture, ni modification, par l’API');
  assert.match(part, /security definer set search_path = ''/);
  assert.match(part, /new\.user_id := auth\.uid\(\)/); assert.match(part, /jour < current_date - 90;/);
  assert.match(part, /revoke all on function public\.activite_borne\(\) from public, anon, authenticated/);
});
