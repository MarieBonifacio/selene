/* Scénario de navigateur : Sources oubliées et Sources qui documentent (phase 3, vague 7a : docs/connexions.md).
   Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
const days = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const demo = JSON.parse(fixture());
for (const m of Object.values(demo.modules)) { if (m.type === 'notes') m.entries = []; if (m.type === 'cumul') m.scraps = []; } // le bassin des sortes : les sources seules
demo.modules.ecriture.scraps = [{ id: 'f1', text: 'Le soi qui se regarde vivre, comme de l’extérieur', date: days(1) }];
demo.modules.sources = { type: 'collection', label: 'Sources', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), music: false, sources: true, display: 'liste', statuses: ['À lire', 'Lue', 'Utilisée'], doneFrom: 1,
  fields: { title: 'Titre', subtitle: 'Auteurs', tag: 'Type', due: '', text: 'Résumé et notes' } },
  entries: [{ id: 's1', title: 'Depersonalization and the self <img src=x onerror=window.__pwn=1>', subtitle: 'Anna Ciaunica', tag: 'article', due: '', text: '', status: 'À lire', kept: days(60),
    src: { url: 'https://doi.org/10.1016/j.concog.2020.102946', doi: '10.1016/j.concog.2020.102946', site: 'Consciousness and Cognition', date: '2020' } }] };
demo.config.modules.push({ id: 'sources', on: true });
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await ctx.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));

  console.log('tirer une source oubliée');
  ok((await p.textContent('body')).includes('une source gardée puis reliée à rien'), 'les sortes annoncent les sources');
  await p.click('[data-act="sortes-draw"]'); await p.waitForTimeout(200);
  const card = (await p.textContent('.card')).replace(/\s+/g, ' ');
  ok(card.includes('Source oubliée, Sources') && card.includes('Depersonalization and the self <img') && card.includes('Consciousness and Cognition') && card.includes('gardée il y a 2 lunaisons, jamais relue'), `la carte : titre, revue, depuis quand, jamais relue (${card.slice(0, 160)})`);
  ok(!(await p.evaluate(() => window.__pwn)) && (await p.getAttribute('.card a[target=_blank]', 'href')) === 'https://doi.org/10.1016/j.concog.2020.102946', 'un titre piégé reste du texte ; « ouvrir » mène à l’article');

  console.log('la relier');
  await p.click('.card [data-act="src-link"]'); await p.waitForTimeout(150);
  ok((await p.$$eval('#form [name=to] option', os => os.map(o => o.value))).join() === 'ecriture/f1', 'on choisit ce qu’elle documente parmi les notes et fragments');
  await p.selectOption('#form [name=to]', 'ecriture/f1'); await p.click('#form button[value=save]'); await p.waitForTimeout(200);
  const s = (await data()).modules.sources.entries[0];
  ok(s.links.length === 1 && s.links[0].to === 'ecriture/f1' && s.links[0].type === 'documente', 'la source documente le fragment');
  ok(!(await p.$('.card')) && (await p.textContent('#toast')).includes('Reliée'), 'la carte s’efface : elle n’est plus oubliée');
  await p.click('[data-act="sortes-draw"]'); await p.waitForTimeout(200);
  ok((await p.textContent('#toast')).includes('Rien d\'assez ancien'), 'plus rien à tirer : reliée, elle a quitté le bassin');

  console.log('en marge, dans la liste');
  await p.evaluate(() => location.hash = 'ecriture'); await p.waitForTimeout(300);
  ok((await p.textContent('#main')).includes('documenté par « Depersonalization and the self'), 'le fragment dit qui le documente');
  await p.evaluate(() => location.hash = 'sources'); await p.waitForTimeout(300);
  ok((await p.textContent('[data-id="s1"] .src-docs')).includes('documente « Le soi qui se regarde'), 'la source dit ce qu’elle documente');
  ok(!!(await p.$('[data-id="s1"] [data-act="src-link"]')), 'et se relie depuis sa ligne');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
