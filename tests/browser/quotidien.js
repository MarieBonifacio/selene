/* Scénario de navigateur : quotidien. Lancé par tests/browser/run.js. */
const { engine, ouvrir, BASE, launchOptions, fixture, donnee, check } = require('./helpers');
const demo = JSON.parse(fixture());
demo.modules.kundalini.config.start = '2026-01-05';
demo.modules.kundalini.entries = [{ id: 'k1', date: '2026-01-05', value: 25, note: '' }];
demo.modules.moth.entries = [{ id: 'p1', title: 'Le lichen', subtitle: '', tag: 'Nigredo', due: '2020-01-01', text: '', status: 'Prêt' }];
(async () => {
  const b = await engine.launch(launchOptions);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // un iPhone
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, JSON.stringify(demo));
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
  const go = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(200); };
  const main = async () => (await p.textContent('#main')).replace(/\s+/g, ' ');
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')));
  const ok = check;
  const heroH = () => p.evaluate(() => document.querySelector('.hero svg').getBoundingClientRect().height);

  console.log('accueil');
  const h1 = await heroH();
  let t = await main();
  ok(t.includes('Noter 25 min') && t.includes('« Le lichen » : en retard'), 'séance en un geste, élément de collection en retard');
  await p.click('[data-act="entry-log"][data-mod="phidippus"] >> nth=0'); await p.waitForTimeout(200);
  ok((await data()).modules.phidippus.entries.length === 1, '« fait » sur un rappel, depuis l’accueil');
  await p.click('[data-act="prog-quick"]'); await p.waitForTimeout(200);
  ok((await main()).includes('Séance de kundalini faite'), 'séance notée avec la dernière durée');
  ok(await heroH() === h1, 'le paysage ne se replie pas en cours d’utilisation');
  await p.click('.over-wrap:has-text("Kundalini") summary'); await p.waitForTimeout(100);
  ok((await p.textContent('.over-wrap:has-text("Kundalini") .more')).includes('25 min'), 'ligne dépliée : derniers éléments');
  await p.reload(); await p.waitForTimeout(400);
  const h2 = await heroH();
  ok(h2 < h1 * 0.6, `deuxième ouverture du jour : paysage réduit (${Math.round(h1)} → ${Math.round(h2)} px)`);

  console.log('brouillons');
  await go('ecriture'); await p.fill('#scrapIn', 'une phrase qui passe');
  await p.reload(); await p.waitForTimeout(400); await go('ecriture');
  ok((await p.inputValue('#scrapIn')) === 'une phrase qui passe', 'brouillon restauré après fermeture');
  await p.click('[data-act="scrap-add"]'); await p.waitForTimeout(150);
  await p.reload(); await p.waitForTimeout(400); await go('ecriture');
  ok((await p.inputValue('#scrapIn')) === '', 'brouillon effacé une fois gardé');

  console.log('annuler');
  await p.click('li:has-text("une phrase qui passe") [data-act="scrap-del"]'); await p.waitForTimeout(150);
  ok(!(await main()).includes('une phrase qui passe') && await p.isVisible('#toast [data-act="undo"]'), 'supprimé sans confirmation, bouton « Annuler »');
  await p.click('#toast [data-act="undo"]'); await p.waitForTimeout(150);
  ok((await main()).includes('une phrase qui passe'), '« Annuler » le remet');

  console.log('écriture en mode total');
  await go('reglages'); await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await p.selectOption('#mreg-ecriture [data-set-mod="ecriture.entryMode"]', 'total'); await p.waitForTimeout(150);
  await go('ecriture'); await p.fill('#cumIn', '1200'); await p.click('[data-act="entry-add"]'); await p.waitForTimeout(150);
  await p.fill('#cumIn', '1850'); await p.click('[data-act="entry-add"]'); await p.waitForTimeout(150);
  const e = (await data()).modules.ecriture.entries.map(x => x.value);
  ok(e.join() === '1200,650', `total 1 200 puis 1 850 → +1 200 puis +650 (${e.join(', ')})`);
  ok((await main()).includes('objectif atteint vers le'), 'projection affichée');
  // MOD-009 : chaque saisie dit ce qu'elle a compté ; un total plus bas est une coupe, le même n'ajoute rien.
  ok((await p.textContent('#toast')).includes('+650 mots. Ça avance, que tu y croies ou non.'), 'un total plus haut : « +650 mots. Ça avance… »');
  await p.fill('#cumIn', '1650'); await p.click('[data-act="entry-add"]'); await p.waitForTimeout(150);
  ok((await p.textContent('#toast')).includes("-200 mots. Couper, c'est aussi écrire.") && (await data()).modules.ecriture.entries.at(-1).value === -200, 'un total plus bas : une coupe, « -200 mots. Couper, c’est aussi écrire. »');
  const n = (await data()).modules.ecriture.entries.length;
  await p.fill('#cumIn', '1650'); await p.click('[data-act="entry-add"]'); await p.waitForTimeout(150);
  ok((await p.textContent('#toast')).includes("Même total qu'avant. Rien de neuf, ou alors en silence.") && (await data()).modules.ecriture.entries.length === n, 'le même total : rien d’ajouté, et c’est dit');

  console.log('le jeu d’essai : Écriture, Yoga (MOD-009, MOD-007)');
  // Le jeu du cahier tel quel, sauf le début du protocole de Yoga, trois semaines avant aujourd'hui : son calendrier
  // couvre ainsi hier et aujourd'hui, quel que soit le jour où la CI passe.
  const jour = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const essai = donnee('jeu-essai.json'); essai.site.modules.yoga.config.start = jour(-21);
  const q = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(([s, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', s); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai.site), JSON.stringify(essai.board)]);
  const qmain = async () => (await q.textContent('#main')).replace(/\s+/g, ' ');
  const yoga = () => q.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.yoga.entries);
  await ouvrir(q, BASE + '/index.html#ecriture', () => !!document.querySelector('#cumIn'));
  ok((await qmain()).includes('5 300 mots sur 50 000'), 'Écriture : « 5 300 mots sur 50 000 »');
  await q.evaluate(() => { location.hash = 'reglages'; }); await q.waitForSelector('#mreg-ecriture [data-set-mod="ecriture.entryMode"]', { state: 'attached' });
  const mode = await q.$eval('#mreg-ecriture [data-set-mod="ecriture.entryMode"]', s => s.selectedOptions[0].textContent);
  ok(mode === "Le total atteint (l'app calcule la différence)", `« Je saisis » : « ${mode} »`);
  await q.evaluate(() => { location.hash = 'ecriture'; }); await q.waitForSelector('#cumIn');
  const total = async (n, dit) => {
    await q.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await q.fill('#cumIn', n); await q.click('[data-act="entry-add"]');
    await q.waitForFunction(t => (document.querySelector('#toast').textContent || '').includes(t), dit, { timeout: 5000 }).catch(() => {});
    return [(await q.textContent('#toast')).trim(), (await q.textContent('#main .big')).replace(/\s+/g, ' ').trim()];
  };
  let [dit, big] = await total('6000', '+700');
  ok(dit === '+700 mots. Ça avance, que tu y croies ou non.' && big.startsWith('6 000 mots sur 50 000'), `6000 : « ${dit} », ${big}`);
  [dit, big] = await total('5800', '-200');
  ok(dit === "-200 mots. Couper, c'est aussi écrire." && big.startsWith('5 800 mots sur 50 000'), `5800 : « ${dit} », ${big}`);
  [dit, big] = await total('5800', 'Même total');
  const ecrit = (await q.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.ecriture.entries)).slice(3).map(e => e.value).join();
  ok(dit === "Même total qu'avant. Rien de neuf, ou alors en silence." && ecrit === '700,-200', `5800 encore : « ${dit} », aucune entrée de plus (${ecrit})`);
  await q.evaluate(() => { location.hash = 'accueil'; }); await q.waitForSelector('[data-act="prog-quick"][data-mod="yoga"]');
  ok((await q.textContent('[data-act="prog-quick"][data-mod="yoga"]')).trim() === 'Noter 25 min', 'l’accueil propose « Noter 25 min » pour Yoga, sa dernière durée');
  await q.click('[data-act="prog-quick"][data-mod="yoga"]');
  await q.waitForFunction(d => JSON.parse(localStorage.getItem('selene-site-v1')).modules.yoga.entries.some(e => e.date === d), jour(0), { timeout: 5000 }).catch(() => {});
  await q.waitForFunction(() => document.querySelector('#main').textContent.includes('Séance de yoga faite.'), null, { timeout: 5000 }).catch(() => {});
  ok((await yoga()).some(e => e.date === jour(0) && +e.value === 25) && (await qmain()).includes('Séance de yoga faite.'), '« Séance de yoga faite. », une séance de 25 min datée d’aujourd’hui (C14)');
  await q.evaluate(() => { location.hash = 'yoga'; }); await q.waitForSelector('[data-act="entry-add"][data-mod="yoga"]');
  await q.click('[data-act="entry-add"][data-mod="yoga"]'); await q.waitForSelector('#form [name=date]');
  await q.fill('#form [name=date]', jour(-1)); await q.fill('#form [name=value]', '30'); await q.click('#form button[value=save]');
  await q.waitForFunction(d => JSON.parse(localStorage.getItem('selene-site-v1')).modules.yoga.entries.some(e => e.date === d), jour(-1), { timeout: 5000 }).catch(() => {});
  const vue = async () => ({ cal: await q.$$eval('#main .cal i', is => is.map(i => i.className.replace(/\s+/g, ' ').trim())), journal: await q.$$eval('#main .two > section:last-child li.item', ls => ls.map(l => `${l.querySelector('.jdate').textContent.trim()} · ${l.querySelector('div').textContent.replace(/\s+/g, ' ').trim()}`)) });
  // La date telle que ce moteur l'écrit en français (chaque moteur a sa table des formats), avec le « 1er » de l'app.
  const [auj, hier] = await q.evaluate(ds => ds.map(d => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    .formatToParts(new Date(d + 'T12:00')).map(x => x.type === 'day' && x.value === '1' ? '1er' : x.value).join('')), [jour(0), jour(-1)]);
  const date = n => (n ? hier : auj);
  let v = await vue();
  ok(v.cal[20] === 'on' && v.cal[21] === 'on today', `la séance d’hier au calendrier, à côté de celle du jour (${v.cal[20]} | ${v.cal[21]})`);
  ok(v.journal[0] === `${date(0)} · 25 min` && v.journal[1] === `${date(-1)} · 30 min`, `et dans le journal, à sa date (${v.journal.slice(0, 2).join(' | ')})`);
  await ouvrir(q, null, () => !!document.querySelector('#main .cal'));
  v = await vue();
  ok(v.cal[20] === 'on' && v.cal[21] === 'on today' && v.journal[0] === `${date(0)} · 25 min` && v.journal[1] === `${date(-1)} · 30 min` && (await yoga()).length === 6, 'rechargé : les deux séances sont là');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
