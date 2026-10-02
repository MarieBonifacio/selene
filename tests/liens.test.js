/* La vérification mensuelle des sources de santé (scripts/liens.mjs) : ce qu'elle lit, et ce qui la fait échouer.
   Sans réseau : seules l'extraction et la décision sont testées ici ; l'appel réel tourne dans le workflow Liens. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const liens = import('../scripts/liens.mjs');

test('liens : les adresses https des sources et de l’interface, sans ponctuation ni doublon', async () => {
  const { extractUrls, FILES } = await liens;
  assert.deepEqual(extractUrls('Voir [la page](https://exemple.fr/a), puis https://exemple.fr/b. Et `https://exemple.fr/a` ; « https://exemple.fr/c ».'),
    ['https://exemple.fr/a', 'https://exemple.fr/b', 'https://exemple.fr/c']);
  assert.deepEqual(extractUrls('http://pas-https.fr et rien'), []);
  const found = FILES.flatMap(f => extractUrls(fs.readFileSync(f, 'utf8')));
  for (const host of ['www.alcool-info-service.fr', 'www.assurance-maladie.ameli.fr', 'lannuaire.service-public.gouv.fr'])
    assert.ok(found.some(u => new URL(u).host === host), `${host} vérifiée chaque mois`);
});

test('liens : une page disparue fait échouer, un refus est seulement signalé', async () => {
  const { verdict } = await liens;
  for (const status of [200, 204, 301, 308]) assert.equal(verdict({ status }), 'ok', String(status));
  for (const status of [404, 410]) assert.equal(verdict({ status }), 'absente', String(status));
  for (const status of [401, 403, 429, 500, 503]) assert.equal(verdict({ status }), 'refus', String(status));
  assert.equal(verdict({ error: 'ENOTFOUND' }), 'absente', 'un domaine qui n’existe plus');
  for (const error of ['ECONNREFUSED', 'ETIMEDOUT', 'délai dépassé', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'])
    assert.equal(verdict({ error }), 'refus', error);
});
