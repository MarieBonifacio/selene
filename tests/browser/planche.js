/* Scénario de navigateur : planche de lunaison (évolution de l'interface, vague 4c : docs/evolution-ui.md). Lancé par tests/browser/run.js. */
const { chromium, BASE, launchOptions, fixture, check } = require('./helpers');
const fs = require('fs');
const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const today = iso(Date.now()), old = iso(Date.now() - 200 * 86400000);
// La lunaison de Meeus : 0 à la nouvelle lune du 6 janvier 2000, 18 h 14 TU.
const k = Math.floor((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / (29.530588853 * 86400000));
const demo = JSON.parse(fixture());
demo.modules.ecriture.config.scraps = true;
demo.modules.ecriture.scraps = [
  { id: 'a', text: 'La lune ancienne, déjà notée', date: old },
  { id: 'b', text: 'La mue du jour, et la lune encore', date: today, ep: 'hyp' },
  { id: 'c', text: 'Une contradiction <img src=x onerror=window.__pwn=1>', date: today, links: [{ id: 'l1', to: 'ecriture/b', type: 'contredit', date: today }] }
];
demo.modules.inbox.entries = [{ id: 'n1', text: 'une note du jour', date: today }];
demo.modules.motifs = { type: 'collection', label: 'Motifs', config: { ...JSON.parse(JSON.stringify(demo.modules.musique.config)), concordance: true, display: 'liste', statuses: ['Vivant', 'Épuisé'], doneFrom: 1, fallowDays: 90 },
  entries: [{ id: 'm1', title: 'lune', status: 'Vivant' }, { id: 'm2', title: 'mue', status: 'Vivant' }, { id: 'm3', title: 'contradiction <img src=x onerror=window.__pwn=1>', status: 'Vivant' }] };
demo.config.modules.push({ id: 'motifs', on: true });
(async () => {
  const b = await chromium.launch(launchOptions);
  const ok = check, errs = [];
  const open = async opts => {
    const ctx = await b.newContext({ acceptDownloads: true, ...opts }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await ctx.addInitScript(d => { window.claude = { use: async () => null }; window.print = () => { window.__printed = (window.__printed || 0) + 1; }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
    await p.goto(BASE + '/index.html#bilan'); await p.waitForTimeout(400); return p;
  };
  const text = async p => (await p.textContent('.planche')).replace(/\s+/g, ' ');

  console.log('la planche du cycle en cours');
  const p = await open({ viewport: { width: 1280, height: 1000 } });
  await p.click('[data-act="planche-open"]'); await p.waitForTimeout(350);
  let t = await text(p);
  ok((await p.evaluate(() => location.hash)) === '#bilan/planche' && t.includes(`Planche ${k}`) && t.includes(`lunaison n° ${k} de Meeus`), `numérotée par la lunaison de Meeus (${k})`);
  ok(t.includes('3 entrées datées') && (await p.$$('.pl-regle rect[height]')).length > 0, 'la règle compte les entrées datées du cycle, pas les anciennes');
  ok((await p.$$('.pl-regle circle')).length === 4, 'les quatre quartiers sur la règle');
  ok(t.includes('Écriture') && t.includes('avant :') && (await p.$$('.pl-spark svg')).length >= 2, 'une ligne par espace, la période d’avant, une sparkline');
  const appeared = await p.textContent('.pl-cols section:nth-child(2)');
  ok(appeared.includes('mue') && !appeared.includes('lune'), 'motifs apparus : « mue » est neuf, « lune » ne l’est pas');
  ok((await p.textContent('.pl-cols section:nth-child(3)')).includes('hypothèse') && (await p.textContent('.pl-cols section:nth-child(4)')).includes('1 à ce jour'), 'statuts et tension ouverte');

  console.log('naviguer, imprimer, télécharger');
  await p.click('[data-act="planche-nav"][data-d="1"]'); await p.waitForTimeout(250);
  t = await text(p);
  ok(t.includes(`Planche ${k - 1}`) && t.includes('0 entrée datée'), 'la lunaison précédente, vide');
  await p.click('[data-act="planche-nav"][data-d="-1"]'); await p.waitForTimeout(250);
  ok((await text(p)).includes(`Planche ${k}`), 'et retour');
  await p.click('[data-act="planche-print"]');
  ok((await p.evaluate(() => window.__printed)) === 1, '« Imprimer » passe par l’impression du navigateur');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="planche-dl"]')]);
  const file = fs.readFileSync(await dl.path(), 'utf8');
  ok(dl.suggestedFilename() === `planche-${k}.html` && file.startsWith('<!doctype html>') && file.includes(`Planche ${k}`) && file.includes('@page') && !/<script/i.test(file), 'le fichier téléchargé est une planche autonome, sans script');
  await p.emulateMedia({ media: 'print' });
  ok(!(await p.isVisible('.pl-tools')) && !(await p.isVisible('.app > .side')), 'à l’impression : ni barre latérale ni boutons');
  const pdf = await p.pdf({ format: 'A4' });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(pages === 1, `une seule page A4 (${pages})`);

  console.log('téléphone');
  const m = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.evaluate(() => location.hash = 'bilan/planche'); await m.waitForTimeout(350);
  ok(await m.isVisible('.planche') && await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'lisible sur téléphone, sans débordement');

  check(!(await p.evaluate(() => window.__pwn)) && !(await m.evaluate(() => window.__pwn)), 'un motif piégé ne s’exécute pas sur la planche');
  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
