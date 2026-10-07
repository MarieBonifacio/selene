/* Scénario de navigateur : bilan. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, donnee, ouvrir, check } = require('./helpers');
const demo = JSON.parse(fixture());
const iso = d => new Date(d - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
// L'horloge de la page est figée au milieu d'un mois : « le mois dernier » (33 jours avant, donc hors du cycle lunaire
// en cours) tombe alors toujours dans le mois civil précédent, ce que le jour réel ne garantit pas (le 1er octobre,
// 33 jours plus tôt, c'est le 29 août : septembre resterait vide).
const NOW = new Date('2026-09-20T12:00:00Z');
const today = iso(NOW.getTime()), lastMonth = iso(NOW.getTime() - 33 * 864e5);
demo.modules.kundalini.entries = [{ id: 'k1', date: today, value: 20, note: '' }, { id: 'k2', date: lastMonth, value: 30, note: '' }];
demo.modules.ecriture.entries = [{ id: 'e1', date: today, value: 1200, category: '' }];
(async () => {
  const b = await engine.launch(launchOptions);
  const p = await (await b.newContext({ viewport: { width: 900, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.clock.setFixedTime(NOW);
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const ok = check;
  await p.click('a[href="#bilan"]'); await p.waitForTimeout(200);
  let t = await main();
  ok(t.includes('Cycle du') && t.includes('1 séance, 20 min') && t.includes('+1 200 mots'), 'bilan du cycle en cours : séances, mots');
  await p.click('[data-act="bilan-mode"][data-m="mois"]'); await p.waitForTimeout(150);
  t = await main(); const name = NOW.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  ok(t.includes(name) && t.includes('avant : 1 séance, 30 min'), `mode mois (${name}), période précédente en regard`);
  await p.click('[data-act="bilan-nav"][data-d="1"]'); await p.waitForTimeout(150);
  ok((await main()).includes('1 séance, 30 min') && await p.isVisible('[data-act="bilan-nav"][data-d="-1"]'), 'remonter d’un mois, puis pouvoir revenir');
  await p.reload(); await p.waitForTimeout(300); await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(200);
  ok((await p.textContent('#main a[href="#bilan"]')).includes('Bilan du mois'), 'le mode choisi est retenu sur l’appareil');
  // PEN-010 sur le jeu d'essai du cahier, l'horloge figée au 7 octobre 2026 à Paris, un navigateur neuf.
  console.log('le jeu d’essai : cycle, mois, la période d’avant (PEN-010)');
  const cx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris' });
  const essai = donnee('jeu-essai.json');
  await cx.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  await cx.clock.setFixedTime(new Date('2026-10-07T10:00:00+02:00'));
  const q = await cx.newPage(); q.on('pageerror', e => errs.push(e.message));
  await ouvrir(q, BASE + '/index.html#bilan', () => !!document.querySelector('#main .over'));
  const texteQ = async () => (await q.textContent('#main')).replace(/\s+/g, ' ');
  const lignes = () => q.$$eval('#main .over', xs => xs.map(x => [x.querySelector('b').textContent.trim(), x.querySelector('span').textContent.replace(/\s+/g, ' ').trim(), (x.querySelector('em') || {}).textContent || '']));
  const ligne = (ls, nom) => (ls.find(([n]) => n === nom) || [, ''])[1];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const cyc = (await texteQ()).match(/Cycle du (\d+) (\S+) au (\d+) (\S+)/) || [];
  const jour = (d, m) => Date.UTC(2026, MOIS.indexOf(m), +d), duree = cyc.length ? (jour(cyc[3], cyc[4]) - jour(cyc[1], cyc[2])) / 864e5 + 1 : 0;
  const auj = Date.UTC(2026, 9, 7);
  check(await q.$eval('[data-act="bilan-mode"][data-m="lune"]', x => x.classList.contains('acc')).catch(() => false) && [29, 30].includes(duree) && jour(cyc[1], cyc[2]) <= auj && auj <= jour(cyc[3], cyc[4]),
    `ouvert en « Cycle lunaire » : « ${cyc[0] || '?'} », ${duree} jours, le 7 octobre dedans (étape 1)`);
  await q.click('[data-act="bilan-mode"][data-m="mois"]'); await q.waitForFunction(() => /octobre 2026/.test(document.querySelector('#main').textContent), null, { timeout: 5000 }).catch(() => {});
  await q.click('[data-act="bilan-nav"][data-d="1"]'); await q.waitForFunction(() => /septembre 2026/.test(document.querySelector('#main').textContent), null, { timeout: 5000 }).catch(() => {});
  const sept = await lignes();
  check(/septembre 2026/.test(await texteQ()) && ligne(sept, 'Yoga') === '2 séances, 55 min' && ligne(sept, 'Budget').startsWith('165,00 € dépensés') && ligne(sept, 'Plantes') === 'arrosage ×1'
    && sept.length >= 10 && sept.every(([, , av]) => av.startsWith('avant : ')) && sept.find(([n]) => n === 'Yoga')[2] === 'avant : 2 séances, 45 min',
    `septembre 2026 : Yoga « ${ligne(sept, 'Yoga')} », Budget « ${ligne(sept, 'Budget').slice(0, 20)}… », Plantes « ${ligne(sept, 'Plantes')} » ; les ${sept.length} lignes ont leur « avant : … » (étape 2)`);
  await q.click('[data-act="bilan-nav"][data-d="1"]'); await q.waitForFunction(() => /août 2026/.test(document.querySelector('#main').textContent), null, { timeout: 5000 }).catch(() => {});
  const aout = await lignes();
  check(/août 2026/.test(await texteQ()) && ligne(aout, 'Yoga') === '2 séances, 45 min' && ligne(aout, 'Budget').startsWith('210,00 € dépensés'),
    `août 2026 : Yoga « ${ligne(aout, 'Yoga')} », Budget « ${ligne(aout, 'Budget').slice(0, 20)}… » (étape 3)`);
  await ouvrir(q, null, () => !!document.querySelector('#main .over'));
  const apres = await texteQ();
  check(/‹\s*octobre 2026/.test(apres) && !/Cycle du/.test(apres), `rechargé : toujours en mois (${(apres.match(/‹\s*(\S+ 2026)/) || [])[1] || '?'}) (étape 4)`);
  const page = await texteQ();
  check(!page.includes('%') && !/trophée(?! :)|🏆|★|☆|score|réussite|\/\s?(10|20|100)\b/i.test(page.replace('Aucune note, aucun trophée : les chiffres suffisent à culpabiliser.', '')) && page.includes('Aucune note, aucun trophée'),
    'toute la page : ni note, ni trophée, ni pourcentage de réussite ; « Aucune note, aucun trophée » le dit (étape 5)');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
