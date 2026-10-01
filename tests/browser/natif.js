/* Scénario de navigateur : Selene dans une coquille native simulée (ADR 11). La page reçoit, avant son script,
   `window.seleneNative` : deux coffres asynchrones dont les données vivent côté Node (comme derrière le pont de
   Capacitor ou de Tauri). Rien ne doit passer par localStorage ; tout doit survivre à un rechargement.
   Faux Supabase (compte connecté, serveur vide). Lancé par tests/browser/run.js. */
const { engine, BASE, launchOptions, fixture, check, until } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  // Les coffres : côté Node, donc intacts d'un chargement de page à l'autre.
  const notified = [];
  const vaults = { storage: new Map([['selene-site-v1', fixture()], ['selene-auth-last-uid', UID]]), secrets: new Map([['selene-auth-session', session]]) };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('https://*.supabase.co/**', r => r.fulfill({ contentType: 'application/json', body: r.request().method() === 'GET' ? '[]' : '{}' }));
  // Le pont : asynchrone, comme un vrai (chaque appel traverse le processus).
  await ctx.exposeBinding('nativeCall', (_, name, op, k, v) => {
    const m = vaults[name];
    if (name === 'notify') { notified.push(k); return op === 'permission' ? 'granted' : null; }
    if (op === 'load') return [...m];
    if (op === 'write') m.set(k, v); else m.delete(k);
    return null;
  });
  await ctx.addInitScript(() => {
    const vault = name => ({ load: () => window.nativeCall(name, 'load'), write: (k, v) => window.nativeCall(name, 'write', k, v), remove: k => window.nativeCall(name, 'remove', k) });
    window.seleneNative = { runtime: 'capacitor', storage: vault('storage'), secrets: vault('secrets'),
      notifications: { permission: () => window.nativeCall('notify', 'permission'), replace: l => window.nativeCall('notify', 'replace', l) },
      haptic: () => window.nativeCall('notify', 'haptic', 'haptic'),
      widget: { update: d => window.nativeCall('notify', 'widget', { widget: d }) } };
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  // La page des coquilles natives (npm run build:dist).
  await p.goto(BASE + '/dist/native/index.html#accueil'); await p.waitForSelector('#nav a', { timeout: 10000 }).catch(() => {});

  console.log('démarrage sur les coffres');
  ok((await p.textContent('#nav')).includes('Phidippus'), 'les données viennent du coffre natif (compte connecté, espaces du jeu d’essai)');
  ok(await p.evaluate(() => localStorage.length === 0), 'rien dans localStorage');

  console.log('écrire, puis relancer');
  await p.evaluate(() => location.hash = 'ecriture'); await p.waitForTimeout(300);
  await p.evaluate(() => location.hash = 'bilan'); await p.waitForTimeout(300);
  await p.click('[data-act="bilan-mode"][data-m="mois"]'); await p.waitForTimeout(300);
  ok(vaults.storage.get('selene-bilan') === 'mois', 'un réglage part vers le coffre');
  ok(vaults.storage.has('selene-recent'), 'les derniers espaces ouverts aussi');
  ok(await p.evaluate(() => localStorage.length === 0), 'et toujours rien dans localStorage');
  await p.reload(); await p.waitForSelector('#nav a', { timeout: 10000 }).catch(() => {});
  await p.evaluate(() => location.hash = 'bilan'); await p.waitForTimeout(300);
  ok(await p.$eval('[data-act="bilan-mode"][data-m="mois"]', el => el.classList.contains('acc')).catch(() => false), 'après relance, le réglage est relu depuis le coffre');
  ok((await p.textContent('#nav')).includes('Phidippus') && vaults.secrets.has('selene-auth-session'), 'le compte reste ouvert : la session est dans le coffre des secrets');

  console.log('widget d’écran d’accueil');
  await until(() => notified.some(x => x && x.widget));
  const w = (notified.filter(x => x && x.widget).pop() || {}).widget || {};
  ok(/ · \d{1,3} %$/.test(w.moon || '') && Array.isArray(w.lines) && w.lines.length <= 3, 'la page envoie au widget la lune du jour et trois lignes au plus');

  console.log('résumé du matin');
  await p.evaluate(() => location.hash = 'reglages'); await p.waitForSelector('[data-act="notify-on"]', { timeout: 5000 }).catch(() => {});
  ok(!!(await p.$('#notify-cfg')), 'dans la coquille, les réglages proposent les notifications');
  await p.check('[data-act="notify-on"]');
  await until(() => vaults.storage.get('selene-notify') && JSON.parse(vaults.storage.get('selene-notify')).on);
  ok(JSON.parse(vaults.storage.get('selene-notify') || '{}').on === true, 'activées, permission accordée : le réglage part au coffre');
  await until(() => notified.some(l => Array.isArray(l) && l.length));
  const plan = notified.filter(Array.isArray).pop() || [];
  ok(plan.length > 0 && plan.every(n => /^Selene : /.test(n.title) && n.body && !/</.test(n.body) && new Date(n.at).getHours() === 8), 'la semaine qui vient est programmée, à 8 h 30, en texte brut');
  await p.fill('[data-act="notify-at"]', '06:15'); await p.dispatchEvent('[data-act="notify-at"]', 'change');
  await until(() => (notified.filter(Array.isArray).pop() || []).some(n => new Date(n.at).getHours() === 6));
  ok((notified.filter(Array.isArray).pop() || []).every(n => new Date(n.at).getMinutes() === 15), 'changer l’heure reprogramme tout');
  await p.evaluate(() => location.hash = 'accueil'); await p.waitForTimeout(300);
  const nb = notified.filter(x => x === 'haptic').length;
  await p.fill('#capIn', 'une idée du matin').catch(() => {}); await p.press('#capIn', 'Enter').catch(() => {});
  await until(() => notified.filter(x => x === 'haptic').length > nb);
  ok(notified.filter(x => x === 'haptic').length > nb, 'une capture donne un léger retour haptique');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
