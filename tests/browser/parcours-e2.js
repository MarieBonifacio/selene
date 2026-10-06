/* Scénario de navigateur : les six tâches du test E2 (docs/validation.md), sur téléphone, sans compte, par le chemin
   qu'une personne prendrait : ⊕ Capturer pour noter, la feuille Espaces pour aller ailleurs, Chercher pour retrouver.
   Deux obstacles y ont été trouvés en les jouant : « documente… » est rangé dans le menu « … » d'une source (le message
   « Gardée » propose désormais de la relier), et le dossier de l'Écriture partait des seuls fragments, alors que les
   idées notées par ⊕ attendent dans la boîte (l'Écriture vide mène désormais au tri). Crossref simulé.
   Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, check, storeJSON } = require('./helpers');
const CROSSREF = { message: { DOI: '10.1016/j.concog.2020.102946', type: 'journal-article', title: ['Depersonalization and the self'], 'container-title': ['Consciousness and Cognition'], author: [{ given: 'Anna', family: 'Ciaunica' }], issued: { 'date-parts': [[2020, 5, 12]] } } };
const IDEES = ['Le phare comme horloge sociale', 'Les gardiens écrivaient pour la relève', 'Michelet idéalise la solitude'];
(async () => {
  const b = await engine.launch(launchOptions), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('https://*.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: r.request().method() === 'GET' ? '{"disable_signup":false}' : '{}' }));
  await ctx.route('https://api.crossref.org/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(CROSSREF) }));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  const data = () => storeJSON(p, 'selene-site-v1');
  const espace = async href => { await p.click('[data-act="sheet-espaces"]'); await p.click(`#sheet a[href="#${href}"]`); await p.waitForFunction(h => location.hash === '#' + h && !document.querySelector('#sheet').open, href); await p.waitForTimeout(100); };
  try {
    console.log('1. s’installer pour un long texte');
    await p.goto(BASE + '/index.html#sans-compte'); await p.click('[data-act="welcome-path"][data-path="ecrire"]');
    const ids = Object.keys((await data()).modules);
    check(['ecriture', 'sources'].every(k => ids.includes(k)), 'Écriture et Sources installées');

    console.log('2. noter trois idées, par ⊕');
    const t0 = Date.now();
    for (const idee of IDEES) { await p.click('[data-act="sheet-capture"]'); await p.fill('#capSheetIn', idee); await p.click('[data-act="cap-sheet-add"]'); }
    check((await data()).modules.inbox.entries.length === 3, `trois idées dans la boîte (${Math.round((Date.now() - t0) / 100) / 10} s, robot compris)`);

    console.log('3. une source par son DOI');
    await espace('sources');
    await p.fill('#srcIn', '10.1016/j.concog.2020.102946'); await p.click('[data-act="src-fetch"]'); await p.click('[data-act="src-keep"]');
    check((await data()).modules.sources.entries.some(e => e.title === 'Depersonalization and the self'), 'gardée avec son titre');

    console.log('4. la relier à une idée');
    await p.waitForSelector('#toast.show [data-act="undo"]');
    check((await p.textContent('#toast')).includes('La relier à une idée'), 'le message « Gardée » propose de la relier : « documente… » est dans le menu « … » de la ligne');
    await p.click('#toast [data-act="undo"]'); await p.waitForSelector('#form [name=to]');
    const cible = await p.$$eval('#form [name=to] option', os => os.find(o => o.textContent.includes('relève')).value);
    await p.selectOption('#form [name=to]', cible); await p.click('#form button[value=save]');
    // Le lien est écrit dans IndexedDB juste après le clic, en asynchrone : l'attendre, pas le lire aussitôt (échec du
    // job « démarrage lent » de la PR #120, la lecture arrivée avant l'écriture).
    const documente = x => !!(x && x.links && x.links.some(l => l.type === 'documente' && l.to === cible));
    let src = null;
    for (const end = Date.now() + 10000; Date.now() < end && !documente(src); await p.waitForTimeout(100)) src = (await data()).modules.sources.entries[0];
    check(documente(src), 'la source documente l’idée choisie');

    console.log('5. retrouver une idée');
    await p.click('#bar a[href="#recherche"]'); await p.fill('#searchIn', 'relève'); await p.waitForTimeout(300);
    check((await p.textContent('#main')).includes('Les gardiens écrivaient pour la relève'), 'Chercher la retrouve, sans accent ni casse à respecter');

    console.log('6. préparer un dossier');
    await espace('ecriture');
    check((await p.textContent('#main')).includes('3 idées notées par Capturer attendent dans la boîte de réception'), 'l’Écriture vide dit où sont les idées');
    await p.click('#main [data-act="vasculum"]');
    for (let i = 0; i < 3; i++) { await p.waitForSelector('#sheet [data-act="note-to"][data-to="ecriture"]'); await p.click('#sheet [data-act="note-to"][data-to="ecriture"]'); await p.waitForTimeout(150); }
    await p.evaluate(() => { const d = document.querySelector('#sheet'); if (d.open) d.close(); });
    const d = await data();
    check(d.modules.ecriture.scraps.length === 3 && !d.modules.inbox.entries.length, 'triées une à une : trois fragments, la boîte vide');
    check(d.modules.sources.entries[0].links.some(l => l.to.startsWith('ecriture/')), 'le lien de la source a suivi l’idée dans l’Écriture');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#main [data-act="scrap-dossier"]')]);
    check(/\.md$/.test(dl.suggestedFilename()), `le dossier se télécharge (${dl.suggestedFilename()})`);
  } catch (e) { check(false, e.message.split('\n')[0]); }
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
