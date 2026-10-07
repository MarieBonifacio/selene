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

  console.log('le jeu d’essai : des valeurs hors bornes dans les réglages de Yoga (DON-010)');
  await q.evaluate(() => { location.hash = 'reglages'; }); await q.waitForSelector('#mreg-yoga', { state: 'attached' });
  await q.evaluate(() => { document.querySelector('#mreg-yoga').open = true; });
  const borne = async (champ, v) => {
    const sel = `#mreg-yoga [data-set-mod="yoga.${champ}"]`;
    await q.fill(sel, v); await q.press(sel, 'Tab');
    await q.waitForFunction(([c, x]) => String(JSON.parse(localStorage.getItem('selene-site-v1')).modules.yoga.config[c]) !== x, [champ, v], { timeout: 5000 }).catch(() => {});
    return [(await q.evaluate(c => JSON.parse(localStorage.getItem('selene-site-v1')).modules.yoga.config[c], champ)), await q.inputValue(sel)];
  };
  let [g, aff] = await borne('weeks', '600');
  ok(g === 520 && aff === '520', `durée en semaines 600 : la valeur devient 520 (${g}, affiché ${aff}) (étape 1)`);
  [g, aff] = await borne('weeks', '-4');
  ok(g === 1 && aff === '1', `-4 : la valeur devient 1 (${g}, affiché ${aff}) (étape 2)`);
  [g, aff] = await borne('perWeek', '9');
  ok(g === 7 && aff === '7', `séances par semaine 9 : la valeur devient 7 (${g}, affiché ${aff}) (étape 3)`);
  const [dl] = await Promise.all([q.waitForEvent('download'), q.click('[data-act="exp"]')]);
  await q.setInputFiles('input[data-act="imp"]', await dl.path());
  await q.waitForFunction(() => document.querySelector('#cdlg[open]'), null, { timeout: 5000 }).catch(() => {});
  if (await q.$('#cdlg[open]')) await q.click('#cdlg button[value="ok"]');
  await q.waitForFunction(() => (document.querySelector('#toast').textContent || '').includes('Sauvegarde importée'), null, { timeout: 5000 }).catch(() => {});
  const relu = await q.evaluate(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.yoga.config);
  ok((await q.textContent('#toast')).includes('Sauvegarde importée.') && relu.weeks === 1 && relu.perWeek === 7, 'exportée puis réimportée : « Sauvegarde importée. », les bornes gardées (étape 4)');

  console.log('le jeu d’essai : la fin estimée d’Écriture (MOD-010)');
  // Un contexte neuf : le jeu tel quel, sans les saisies du jour faites plus haut. Sa dernière saisie d'Écriture date du
  // 2 septembre 2026 : passé le 2 octobre, rien dans les trente derniers jours.
  const r = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); r.on('pageerror', e => errs.push(e.message));
  const brut = donnee('jeu-essai.json');
  await r.addInitScript(([s, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', s); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(brut.site), JSON.stringify(brut.board)]);
  await ouvrir(r, BASE + '/index.html#ecriture', () => !!document.querySelector('#cumIn'));
  const prophetie = () => r.evaluate(() => { const p = [...document.querySelectorAll('#main p.hint')].find(x => x.textContent.includes('Dernière session')); return p ? p.textContent.replace(/\s+/g, ' ').trim() : ''; });
  let pr = await prophetie();
  ok(pr.endsWith("Pas assez d'élan ces 30 derniers jours pour prédire une fin. La prophétie attendra."), `sans saisie depuis trente jours : « ${pr} » (étape 1)`);
  await r.fill('#cumIn', '8300'); await r.click('[data-act="entry-add"]');
  await r.waitForFunction(() => document.querySelector('#main').textContent.includes('Au rythme des 30 derniers jours'), null, { timeout: 5000 }).catch(() => {});
  // 3 000 mots en trente jours : 100 par jour ; il en reste 41 700, soit 417 jours. La date telle que ce moteur l'écrit.
  const fin = await r.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 417); return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(d).map(x => x.type === 'day' && x.value === '1' ? '1er' : x.value).join(''); });
  pr = await prophetie();
  ok((await r.textContent('#main .big')).replace(/\s+/g, ' ').trim().startsWith('8 300 mots sur 50 000') && pr.endsWith(`Au rythme des 30 derniers jours (100 mots par jour), objectif atteint vers le ${fin}.`),
    `3 000 mots de plus, 8 300 en tout : « ${pr.slice(pr.indexOf('Au rythme'))} » (étape 2)`);

  console.log('le jeu d’essai : les rappels de Plantes (MOD-013)');
  // Le jeu d'essai, l'horloge figée le 7 octobre 2026 à 10 h à Paris ; Arrosage tous les 3 jours, fait le 1er septembre.
  const cr = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Paris' });
  const pl = await cr.newPage(); pl.on('pageerror', e => errs.push(e.message)); await pl.clock.setFixedTime(new Date('2026-10-07T10:00:00+02:00'));
  const essai13 = donnee('jeu-essai.json');
  await pl.addInitScript(([st, bd]) => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) { localStorage.setItem('selene-site-v1', st); localStorage.setItem('selene-board-v1', bd); } }, [JSON.stringify(essai13.site), JSON.stringify(essai13.board)]);
  await ouvrir(pl, BASE + '/index.html', () => !!document.querySelector('#main > *'));
  const versR = async (h, sel) => { await pl.evaluate(x => { location.hash = x; }, h); await pl.waitForSelector(sel, { state: 'attached' }); };
  const plantes = async () => JSON.parse(await pl.evaluate(() => localStorage.getItem('selene-site-v1'))).modules.plantes;
  // La ligne de Plantes dans « Aujourd'hui », avec son « fait », ou rien.
  const ligneP = () => pl.evaluate(() => { const x = document.querySelector('#main [data-act="entry-log"][data-mod="plantes"]'), li = x && x.closest('li'); return li ? li.querySelector('div').textContent.replace(/\s+/g, ' ').trim() + ' · ' + [...li.querySelectorAll('.row > *')].map(b => b.textContent.trim()).join(', ') : ''; });
  const l13 = await ligneP();
  check(l13.startsWith('Plantes : Arrosage (il y a 36 j)') && l13.includes('fait'), `l’accueil : « ${l13} » (MOD-013, étape 1)`);
  await pl.click('#main [data-act="entry-log"][data-mod="plantes"]');
  await pl.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.plantes.entries.some(e => e.type === 'arrosage' && e.date === '2026-10-07'), null, { timeout: 5000 }).catch(() => {});
  const parti = !(await ligneP());
  await versR('plantes', '#main [data-act="entry-log"][data-t="arrosage"]');
  const arrosage = await pl.evaluate(() => { const x = document.querySelector('#main [data-act="entry-log"][data-t="arrosage"]').closest('.set'); return `${x.querySelector('span').textContent.trim()} : ${x.querySelector('.hint').textContent.trim()}`; });
  check(parti && arrosage === 'Arrosage : aujourd\'hui, tous les 3 j', `« fait » : la ligne quitte l’accueil ; dans Plantes, « ${arrosage} » (MOD-013, étape 2)`);
  await pl.fill('#rapNote', 'Nouvelle pousse sur le ficus'); await pl.click('[data-act="entry-note"][data-mod="plantes"]');
  await pl.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.plantes.entries.some(e => e.note === 'Nouvelle pousse sur le ficus'), null, { timeout: 5000 }).catch(() => {});
  const obs13 = (await plantes()).entries.find(e => e.note === 'Nouvelle pousse sur le ficus') || {};
  const auJournal = await pl.evaluate(() => { const li = [...document.querySelectorAll('#main li.item')].find(l => l.textContent.includes('Nouvelle pousse sur le ficus')); return li ? li.querySelector('.jdate').textContent.trim() : ''; });
  check(obs13.date === '2026-10-07' && obs13.type === 'note' && auJournal === '7 oct.', `l’observation au journal, datée du ${auJournal} (MOD-013, étape 3)`);
  await versR('reglages', '#mreg-plantes'); await pl.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await pl.fill('#mreg-plantes [data-ti="0"] [data-act="typ-every"]', '1'); await pl.press('#mreg-plantes [data-ti="0"] [data-act="typ-every"]', 'Tab');
  await pl.waitForFunction(() => JSON.parse(localStorage.getItem('selene-site-v1')).modules.plantes.config.types[0].every === 1, null, { timeout: 5000 }).catch(() => {});
  await versR('accueil', '#main > *'); const memeJour = await ligneP();
  await pl.clock.setFixedTime(new Date('2026-10-08T10:00:00+02:00')); await ouvrir(pl, BASE + '/index.html', () => !!document.querySelector('#main > *'));
  const lendemain = await ligneP();
  check((await plantes()).config.types[0].every === 1 && !memeJour && lendemain.startsWith('Plantes : Arrosage (hier)'), `fréquence à 1 : rien le jour même ; le lendemain, « ${lendemain} » revient (MOD-013, étape 4)`);
  const rempotage = (await plantes()).config.types.find(t => t.id === 'rempotage') || {};
  check(!rempotage.every && !lendemain.includes('Rempotage') && !(await pl.evaluate(() => [...document.querySelectorAll('#main li.item.alert')].some(l => l.textContent.includes('Rempotage')))),
    'Rempotage, fréquence 0, fait il y a 54 jours : aucun rappel sur l’accueil (MOD-013, étape 5)');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
