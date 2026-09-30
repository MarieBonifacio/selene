/* Scénario de navigateur : la page Réglages, rangée en chapitres. Le sommaire mène au chapitre et le marque ; chaque
   espace n'y paraît qu'une fois, ses réglages sous sa ligne, et un bloc déplié le reste après un changement ; les
   infobulles s'ouvrent au clic, dans l'écran, et se ferment par Échap ou ailleurs (fermées, rien ne dépasse) ; le
   premier accueil se replie et se rouvre. Sur téléphone, rien ne déborde. Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check } = require('./helpers');
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  await p.goto(BASE + '/index.html#reglages'); await p.waitForTimeout(400);
  const visibleTips = () => p.evaluate(() => [...document.querySelectorAll('.tipb')].filter(t => t.getBoundingClientRect().width > 0).length);

  console.log('chapitres');
  const chaps = await p.$$eval('#main .chap', cs => cs.map(c => c.id + ':' + c.querySelector('.chap-h .n').textContent));
  ok(chaps.join(' ') === 'reg-apparence:I reg-espaces:II reg-ciel:III reg-assistant:IV reg-connexions:V reg-compte:VI', `six chapitres, du plus courant au plus rare (${chaps.join(' ')})`);
  ok((await p.$$eval('.reg-toc [data-to]', bs => bs.length)) === 6, 'un sommaire, une entrée par chapitre');
  const [n, once] = await p.evaluate(() => [document.querySelectorAll('#main .modblock').length, !!document.querySelector('.modblock:has([value="Chantier"]) > #mreg-chantier')]);
  ok(n === 9 && once, 'chaque espace une seule fois, ses réglages sous sa ligne');
  ok((await p.textContent('#reg-assistant')).includes("L'assistant est éteint"), 'assistant éteint : le chapitre dit comment l’allumer');
  ok((await p.textContent('#reg-connexions')).includes('artefact claude.ai'), 'dans l’artefact : les connexions disent où elles vivent');

  console.log('infobulles');
  ok(await visibleTips() === 0, 'fermées, les bulles ne s’affichent pas');
  const tipBtn = p.locator('.reg-keys .tip').first();
  await tipBtn.click(); await p.waitForTimeout(150);
  const box = await p.evaluate(() => { const o = document.querySelector('.tipb:popover-open'); if (!o) return null; const r = o.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight, txt: o.textContent }; });
  ok(box && box.txt.startsWith('Un mot libre') && box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b <= box.h, 'un clic ouvre la bulle, entière dans l’écran');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(await visibleTips() === 0, 'Échap la ferme');
  await tipBtn.click(); await p.waitForTimeout(100); await p.mouse.click(700, 40); await p.waitForTimeout(100);
  ok(await visibleTips() === 0, 'un clic ailleurs aussi');

  console.log('un bloc déplié le reste');
  await p.click('#mreg-chantier > summary'); await p.waitForTimeout(100);
  await p.click('#mreg-chantier [data-act="grp-on"]'); await p.waitForTimeout(200);
  ok(await p.$eval('#mreg-chantier', d => d.open), 'après un changement, les réglages de l’espace restent ouverts');

  console.log('sommaire');
  await p.click('[data-to="reg-compte"]'); await p.waitForTimeout(250);
  const top = await p.$eval('#reg-compte', c => c.getBoundingClientRect().top);
  ok(Math.abs(top) < 60 || await p.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4), 'le sommaire mène au chapitre');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'reg-compte-h'), 'le focus suit, pour le clavier');
  ok(!!(await p.$('[data-to="reg-compte"][aria-current]')), 'et le sommaire marque le chapitre lu');
  await p.click('#reg-assistant [data-act="reg-goto"]'); await p.waitForTimeout(250);
  ok(!!(await p.$('[data-to="reg-espaces"][aria-current]')), '« Aller aux espaces » depuis le chapitre de l’assistant');
  await p.check('.set.mod:has([value="Assistant"]) [data-act="mod-on"]'); await p.waitForTimeout(200);
  ok(!!(await p.$('#assistant-cfg')) && (await p.textContent('.modblock:has([value="Assistant"])')).includes('chapitre Assistant'), 'allumé : ses réglages au chapitre IV, signalés sous sa ligne');

  console.log('premier accueil');
  ok(await p.isVisible('.reg-guide'), 'la première fois, la page explique comment elle est rangée');
  await p.click('.reg-guide [data-act="reg-guide"]'); await p.waitForTimeout(150);
  await p.reload(); await p.waitForTimeout(400);
  ok(!(await p.$('.reg-guide')), 'replié, il le reste');
  await p.click('.reg-toc [data-act="reg-guide"]'); await p.waitForTimeout(150);
  ok(await p.isVisible('.reg-guide'), 'et se rouvre depuis le sommaire');

  console.log('téléphone');
  const ph = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const q = await ph.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(d => { window.claude = { use: async () => null }; if (!localStorage.getItem('selene-site-v1')) localStorage.setItem('selene-site-v1', d); }, fixture());
  await q.goto(BASE + '/index.html#reglages'); await q.waitForTimeout(400);
  await q.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await q.waitForTimeout(100);
  // Émulation mobile : un contenu qui déborde élargit la zone d'affichage (innerWidth le suit) ; on compare à l'écran.
  // Ce qui dépasse l'écran : les éléments les plus profonds dont le bord droit sort, pour que l'échec dise où chercher.
  const overflow = W => q.evaluate(W => {
    const out = [];
    // Un élément fixé (la barre du bas) s'étire avec la zone d'affichage : il subit le débordement, il ne le cause pas.
    const fixed = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect(); if (!r.width || r.right <= W + 0.5 || fixed(el)) continue;
      if ([...el.children].some(c => c.getBoundingClientRect().right > W + 0.5)) continue;
      const at = el.closest('[id]'), cls = typeof el.className === 'string' ? el.className.trim().replace(/\s+/g, '.') : '';
      out.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${el.dataset.act ? '[' + el.dataset.act + ']' : ''} dans #${at ? at.id : '?'} (${Math.round(r.left)}→${Math.round(r.right)})`);
    }
    // Rien ne dépasse à l'œil (du texte, l'intérieur d'un contrôle natif) : on cache tour à tour chaque enfant et l'on
    // descend dans celui dont l'absence rétrécit le plus la page, jusqu'au responsable.
    const sw = () => document.documentElement.scrollWidth, name = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().replace(/\s+/g, '.') : ''}${el.dataset && el.dataset.act ? '[' + el.dataset.act + ']' : ''}`;
    let node = document.body; const path = [];
    for (let depth = 0; !out.length && depth < 40; depth++) {
      let best = null, bestSw = sw();
      for (const c of node.children) { const d = c.style.display; c.style.display = 'none'; const s = sw(); c.style.display = d; if (s < bestSw) { best = c; bestSw = s; } }
      if (!best) break;
      node = best; path.push(`${name(node)} (${bestSw})`);
    }
    if (path.length) out.push(`${path.slice(-4).join(' › ')} = ${node.outerHTML.replace(/\s+/g, ' ').slice(0, 160)}`);
    return { sw: sw(), out: out.slice(0, 8) };
  }, W);
  const fits = async W => { const o = await overflow(W); return [o.sw <= W, o.sw <= W ? '' : ` : ${o.sw} px, ${o.out.join(' ; ') || 'introuvable'}`]; };
  let [fit, why] = await fits(390);
  ok(fit, 'tout déplié, rien ne déborde en largeur' + why);
  await q.setViewportSize({ width: 320, height: 640 }); await q.waitForTimeout(150); // le plus étroit des iPhone
  [fit, why] = await fits(320);
  ok(fit, 'à 320 px non plus : champs, menus et chemins suivent leur colonne' + why);
  // WebKit laisse le texte de l'option choisie déborder d'un menu et élargir la page (Chromium le rogne) : la cause,
  // mesurée dans n'importe quel moteur, c'est une option plus large que son menu.
  const wide = await q.evaluate(() => { const s = document.getElementById('newModType'), c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(s).font; return [...s.options].filter(o => c.measureText(o.text).width + 40 > s.clientWidth).map(o => o.text); });
  ok(!wide.length, 'à 320 px, chaque option du menu « Modèle ou type » tient dans sa largeur' + (wide.length ? ' : ' + wide.slice(0, 3).join(' | ') : ''));
  await q.tap('.reg-keys .tip >> nth=1'); await q.waitForTimeout(150);
  ok(await q.evaluate(() => { const o = document.querySelector('.tipb:popover-open'); if (!o) return false; const r = o.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), 'une bulle tient dans un écran de téléphone');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
