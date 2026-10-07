/* Scénario de navigateur : Selene dans l'app de bureau (Tauri, ADR 16-17), avec un faux cœur Rust derrière
   window.__TAURI__.core.invoke (données côté Node, comme derrière l'IPC). Les coffres passent par les commandes ; le
   raccourci Ctrl+Alt+S ouvre la capture ; un lien selene://share arrive dans la boîte. Lancé par tests/browser/run.js. */
const { fauxSupabase, engine, BASE, launchOptions, fixture, check } = require('./helpers');
const UID = '0b8f0c2e-1111-2222-3333-444455556666';
(async () => {
  const b = await engine.launch(launchOptions);
  const ok = check, errs = [];
  const session = JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'a@b.c' } });
  const store = new Map([['selene-site-v1', fixture()], ['selene-auth-last-uid', UID]]), secret = new Map([['selene-auth-session', session]]), calls = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await fauxSupabase(ctx);
  await ctx.exposeBinding('tauriInvoke', (_, cmd, args) => {
    calls.push(cmd);
    const [kind, op] = cmd.split('_'), m = kind === 'store' ? store : secret;
    if (op === 'load') return [...m];
    if (op === 'write') m.set(args.key, args.value); else m.delete(args.key);
    return null;
  });
  await ctx.addInitScript(() => { window.__TAURI__ = { core: { invoke: (cmd, args) => window.tauriInvoke(cmd, args) } }; });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/dist/native/index.html#accueil'); await p.waitForSelector('#nav a', { timeout: 10000 }).catch(() => {});

  console.log('les coffres du cœur');
  ok((await p.textContent('#nav')).includes('Phidippus') && calls.includes('store_load') && calls.includes('secret_load'), 'données et session lues par store_load et secret_load');
  ok(await p.evaluate(() => localStorage.length === 0), 'rien dans localStorage');

  console.log('raccourci et lien selene://');
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('selene:capture'))); await p.waitForTimeout(300);
  ok(await p.isVisible('#capSheetIn'), 'Ctrl+Alt+S : la capture s’ouvre');
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('selene:share', { detail: { url: 'https://exemple.org/article', title: 'Un article', text: '' } })));
  let inbox = '';
  for (const end = Date.now() + 5000; Date.now() < end && !inbox.includes('exemple.org'); await p.waitForTimeout(100)) {
    const d = JSON.parse(store.get('selene-site-v1')), k = Object.keys(d.modules).find(x => d.modules[x].type === 'notes' && d.modules[x].config.inbox);
    inbox = JSON.stringify(d.modules[k].entries);
  }
  ok(inbox.includes('Un article') && inbox.includes('https://exemple.org/article'), 'selene://share : dans la boîte de réception, écrit par store_write');

  check(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})();
