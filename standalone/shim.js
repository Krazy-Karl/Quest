/* Runtime autonome : remplace l'environnement Artifact de claude.ai quand la page est hébergée ailleurs
   (GitHub Pages, fichier local). Il fournit à l'application les mêmes briques :
   - db        : base de données (locale dans le navigateur, ou partagée via Firebase Firestore)
   - sample    : appel à Claude avec outils, via TA clé API Anthropic (facultatif)
   - downloads : enregistrement d'un fichier */
(function () {
  'use strict';
  if (window.claude && window.claude.use) return;           // dans claude.ai : rien à faire
  const LS = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { } }
  };
  const ME = LS.get('gc_me') || (() => { const v = 'u' + Math.random().toString(36).slice(2, 10); LS.set('gc_me', v); return v; })();
  const FB = window.__FB, CFG = window.FIREBASE_CONFIG;
  const ONLINE_OK = !!(FB && CFG && CFG.apiKey && CFG.projectId);
  const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fmt = c => norm(c).replace(/(.{4})(?=.)/g, '$1-');
  const genCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (const b of crypto.getRandomValues(new Uint8Array(12))) s += a[b % a.length]; return fmt(s); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const state = { mode: null, room: null };

  /* ---------- base locale (localStorage) ---------- */
  function localDb() {
    const KEY = 'gc_local_db'; let store = {};
    try { store = JSON.parse(LS.get(KEY) || '{}'); } catch (e) { }
    const subs = new Set(); const save = () => LS.set(KEY, JSON.stringify(store)); const fire = () => subs.forEach(f => f());
    window.addEventListener('storage', e => { if (e.key === KEY) { try { store = JSON.parse(e.newValue || '{}'); } catch (x) { } fire(); } });
    const docsOf = (col, ord, lim) => {
      let docs = Object.keys(store).filter(k => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/'))
        .map(k => ({ id: k.split('/').pop(), exists: true, data: () => store[k] }));
      if (ord) docs.sort((a, b) => ((a.data()[ord[0]] || 0) - (b.data()[ord[0]] || 0)) * (ord[1] === 'desc' ? -1 : 1));
      if (lim) docs = docs.slice(0, lim); return docs;
    };
    const mkDoc = p => ({
      id: p.split('/').pop(), path: p,
      get: async () => ({ id: p.split('/').pop(), exists: p in store, data: () => store[p] }),
      set: async d => { store[p] = clone(d); save(); fire(); },
      update: async d => { if (!(p in store)) throw { code: 'invalid_argument', message: 'absent ' + p }; store[p] = { ...store[p], ...clone(d) }; save(); fire(); },
      delete: async () => { delete store[p]; save(); fire(); },
      onSnapshot: cb => { let on = true; const run = () => { if (on) cb({ id: p.split('/').pop(), exists: p in store, data: () => store[p] }); }; subs.add(run); setTimeout(run, 0); return () => { on = false; subs.delete(run); }; }
    });
    const query = (col, ord, lim) => ({
      orderBy: (f, d) => query(col, [f, d || 'asc'], lim), limit: n => query(col, ord, n),
      get: async () => { const docs = docsOf(col, ord, lim); return { docs, empty: !docs.length, size: docs.length }; },
      onSnapshot: cb => { let on = true; const run = () => { if (on) cb({ docs: docsOf(col, ord, lim) }); }; subs.add(run); setTimeout(run, 0); return () => { on = false; subs.delete(run); }; }
    });
    return { doc: mkDoc, collection: c => ({ ...query(c), doc: id => mkDoc(c + '/' + (id || Math.random().toString(36).slice(2, 10))) }) };
  }

  /* ---------- base partagée (Firebase Firestore, une « table » = rooms/CODE) ---------- */
  async function firestoreDb(room) {
    if (!ONLINE_OK) throw new Error('Firebase n’est pas configuré (firebase-config.js).');
    const app = FB.initializeApp(CFG);
    const auth = FB.getAuth(app);
    const emu = window.FIREBASE_EMULATOR;
    if (emu) FB.connectAuthEmulator(auth, `http://${emu.host}:${emu.authPort}`, { disableWarnings: true });
    const cred = await FB.signInAnonymously(auth); state.uid = cred.user.uid;
    const fdb = FB.initializeFirestore(app, { ignoreUndefinedProperties: true });
    if (emu) FB.connectFirestoreEmulator(fdb, emu.host, emu.fsPort);
    const base = 'rooms/' + room;
    const snapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
    const err = e => (er => e && e({ code: er.code || 'unavailable', message: er.message }));
    const mkDoc = p => {
      const r = () => FB.doc(fdb, base + '/' + p);
      return {
        id: p.split('/').pop(), path: p,
        get: async () => snapDoc(await FB.getDoc(r())),
        set: d => FB.setDoc(r(), d),
        update: d => FB.setDoc(r(), d, { merge: true }),
        delete: () => FB.deleteDoc(r()),
        onSnapshot: (n, e) => FB.onSnapshot(r(), s => n(snapDoc(s)), err(e))
      };
    };
    const mkQuery = (col, ops) => {
      const q = () => FB.query(FB.collection(fdb, base + '/' + col), ...ops.map(o => o[0] === 'o' ? FB.orderBy(o[1], o[2]) : FB.limit(o[1])));
      return {
        orderBy: (f, d) => mkQuery(col, [...ops, ['o', f, d || 'asc']]), limit: n => mkQuery(col, [...ops, ['l', n]]),
        get: async () => { const s = await FB.getDocs(q()); return { docs: s.docs.map(snapDoc), empty: s.empty, size: s.size }; },
        onSnapshot: (n, e) => FB.onSnapshot(q(), s => n({ docs: s.docs.map(snapDoc) }), err(e))
      };
    };
    return {
      doc: mkDoc,
      collection: c => ({
        ...mkQuery(c, []),
        doc: id => mkDoc(c + '/' + (id || FB.doc(FB.collection(fdb, base + '/' + c)).id)),
        add: async d => { const r = FB.doc(FB.collection(fdb, base + '/' + c)); await FB.setDoc(r, d); return mkDoc(c + '/' + r.id); }
      })
    };
  }

  /* ---------- bestiaire fourni (graine) ---------- */
  async function seedBestiary(db) {
    try {
      const snap = await db.collection('bestiaire').limit(1).get();
      if (!snap.empty) return;
      const r = await fetch('data/bestiaire.json'); if (!r.ok) return;
      const all = await r.json();
      for (let i = 0; i < all.length; i += 15) await Promise.all(all.slice(i, i + 15).map(m => { const { id, ...rest } = m; return db.doc('bestiaire/' + id).set(rest); }));
    } catch (e) { /* la graine est facultative */ }
  }

  /* ---------- Claude via clé API (facultatif) ---------- */
  const MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5 (équilibré)'], ['claude-opus-5-5', 'Opus 5.5 (le plus fin, plus cher)'], ['claude-haiku-5-5', 'Haiku 5.5 (rapide, économique)']];
  const hasKey = () => !!LS.get('gc_apikey');
  async function callApi(body, signal) {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'x-api-key': LS.get('gc_apikey') || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(body)
      });
    } catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'annulé' }; throw { code: 'upstream_error', message: String(e && e.message || e) }; }
    if (!r.ok) {
      const code = r.status === 401 || r.status === 403 ? 'bad_key' : r.status === 429 ? 'rate_limited' : r.status === 413 ? 'prompt_too_large' : 'upstream_error';
      let m = ''; try { m = (await r.json()).error.message; } catch (e) { }
      throw { code, message: m || ('HTTP ' + r.status) };
    }
    return r.json();
  }
  async function sample(input, opts) {
    opts = opts || {};
    const messages = typeof input === 'string' ? [{ role: 'user', content: input }] : input.map(m => ({ role: m.role, content: m.content }));
    const tools = (opts.tools || []).map(t => ({ name: t.name, description: t.description, input_schema: { type: 'object', properties: {}, ...(t.inputSchema || {}) } }));
    const byName = Object.fromEntries((opts.tools || []).map(t => [t.name, t]));
    const model = LS.get('gc_model') || MODELS[0][0]; const texts = []; let truncated = false;
    for (let round = 0; round < 8; round++) {
      const res = await callApi({ model, max_tokens: 2048, messages, ...(tools.length ? { tools } : {}) }, opts.signal);
      const txt = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      if (txt.trim()) texts.push(txt.trim());
      if (opts.onText && texts.length) { const t = texts.join('\n\n'); opts.onText({ text: t, delta: t }); }
      if (res.stop_reason === 'max_tokens') truncated = true;
      const uses = (res.content || []).filter(b => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !uses.length) break;
      messages.push({ role: 'assistant', content: res.content });
      const results = [];
      for (const u of uses) {
        let out, isErr = false;
        try { const t = byName[u.name]; if (!t) throw new Error('outil inconnu'); const v = await t.execute(u.input || {}, { signal: opts.signal }); out = typeof v === 'string' ? v : JSON.stringify(v == null ? 'ok' : v); }
        catch (e) { isErr = true; out = 'Error: ' + (e && e.message || e); }
        results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out).slice(0, 8000), ...(isErr ? { is_error: true } : {}) });
      }
      messages.push({ role: 'user', content: results });
    }
    const text = texts.join('\n\n');
    if (!text) throw { code: 'empty_completion', message: 'aucun texte' };
    return { text, truncated };
  }
  sample.json = async (input, opts) => {
    const { text } = await sample(input, opts);
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (!m) throw { code: 'invalid_json', message: 'pas de JSON', text };
    try { return JSON.parse(m[0]); } catch (e) { throw { code: 'invalid_json', message: 'JSON invalide', text }; }
  };

  /* ---------- téléchargement ---------- */
  const downloads = {
    save: async ({ filename, data }) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };

  /* ---------- interface : écran d'accueil et réglages ---------- */
  const CSS = `.gcm{position:fixed;inset:0;z-index:100;background:rgba(8,5,2,.88);display:grid;place-items:center;padding:16px;overflow:auto}
  .gcm .box{width:min(560px,100%);background:var(--panel,#17100a);border:2px solid var(--gold-d,#8c6a26);border-radius:4px;box-shadow:0 10px 40px #000;padding:20px;color:var(--ink,#e8d9b5);font-family:var(--body,Georgia,serif)}
  .gcm h2{margin:0 0 6px}.gcm p{margin:6px 0}.gcm .opt{border:1px solid var(--line,#5a4322);background:#1c130b;border-radius:3px;padding:12px;margin:10px 0}
  .gcm .opt h3{margin:0 0 6px}.gcm .row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}.gcm input,.gcm select{flex:1;min-width:0}
  .gcm .small{font-size:14px;color:var(--ink2,#a08a62)}.gcm button:disabled{opacity:.45}`;
  function dialog(html) {
    if (!document.getElementById('gcm-css')) { const s = document.createElement('style'); s.id = 'gcm-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = document.createElement('div'); el.className = 'gcm'; el.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + html + '</div>'; document.body.appendChild(el); return el;
  }
  function apiBlock() {
    return `<div class="opt"><h3>MJ Claude (facultatif)</h3>
      <p class="small">Colle ta clé API Anthropic pour qu’un MJ Claude réponde. Elle reste dans ce navigateur (visible dans ses outils de développement) et chaque réponse est facturée sur ta clé. Sans clé, joue avec un MJ humain.</p>
      <div class="row"><input id="gc-key" type="password" autocomplete="off" placeholder="${hasKey() ? '•••••••• (clé enregistrée)' : 'sk-ant-…'}" aria-label="Clé API Anthropic">
      <select id="gc-model" aria-label="Modèle">${MODELS.map(m => `<option value="${m[0]}" ${(LS.get('gc_model') || MODELS[0][0]) === m[0] ? 'selected' : ''}>${m[1]}</option>`).join('')}</select></div></div>`;
  }
  function saveApi(el) {
    const k = el.querySelector('#gc-key').value.trim(); const had = hasKey();
    if (k) LS.set('gc_apikey', k); LS.set('gc_model', el.querySelector('#gc-model').value);
    return (k && !had) || !!k;
  }
  function startScreen() {
    return new Promise(resolve => {
      const fromUrl = norm(new URLSearchParams(location.search).get('table'));
      const el = dialog(`<h2>Grimoire de Campagne</h2><p class="small">Choisis comment jouer.</p>
        <div class="opt"><h3>Table en ligne (plusieurs joueurs)</h3>
          ${ONLINE_OK ? '' : '<p class="small" style="color:var(--bad,#e2584d)">Non configurée : remplis firebase-config.js (voir le README).</p>'}
          <div class="row"><input id="gc-name" placeholder="Ton pseudo" maxlength="24" value="${esc(LS.get('gc_name') || '')}" aria-label="Pseudo"><button class="b" id="gc-create" ${ONLINE_OK ? '' : 'disabled'}>Créer une table</button></div>
          <div class="row" style="margin-top:8px"><input id="gc-code" placeholder="Code de table (XXXX-XXXX-XXXX)" value="${esc(fromUrl ? fmt(fromUrl) : '')}" aria-label="Code de table"><button class="g" id="gc-join" ${ONLINE_OK ? '' : 'disabled'}>Rejoindre</button></div>
          <p class="small" id="gc-msg" role="status"></p></div>
        <div class="opt"><h3>Solo, dans ce navigateur</h3><p class="small">Sauvegarde locale, sans compte. Idéal pour essayer ou jouer seul.</p><button class="g" id="gc-solo">Jouer en solo</button></div>`);
      const msg = t => { el.querySelector('#gc-msg').textContent = t; };
      const go = (mode, room) => { LS.set('gc_name', (el.querySelector('#gc-name').value || '').trim()); LS.set('gc_mode', mode); if (room) LS.set('gc_room', room); el.remove(); resolve({ mode, room }); };
      el.querySelector('#gc-solo').onclick = () => go('local');
      el.querySelector('#gc-create').onclick = () => go('online', genCode());
      el.querySelector('#gc-join').onclick = () => { const c = norm(el.querySelector('#gc-code').value); if (c.length < 12) return msg('Le code a 12 caractères (ex : AB12-CD34-EF56).'); go('online', fmt(c)); };
      el.querySelector('#gc-code').addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('#gc-join').click(); });
    });
  }
  function openSettings() {
    const link = state.mode === 'online' ? location.origin + location.pathname + '?table=' + state.room : '';
    const el = dialog(`<h2>Réglages</h2>
      <div class="opt"><h3>${state.mode === 'online' ? 'Table en ligne' : 'Solo'}</h3>
        ${state.mode === 'online' ? `<p>Code : <b>${esc(state.room)}</b></p><p class="small">Partage ce lien : ceux qui l’ouvrent rejoignent ta table. Quiconque a le code peut lire et modifier la partie : ne le donne qu’à tes joueurs.</p>
        <div class="row"><input readonly id="gc-link" value="${esc(link)}" aria-label="Lien de la table"><button class="g" id="gc-copy">Copier le lien</button></div>` : '<p class="small">Les données restent dans ce navigateur.</p>'}
        <div class="row" style="margin-top:8px"><input id="gc-name" placeholder="Ton pseudo" maxlength="24" value="${esc(LS.get('gc_name') || '')}" aria-label="Pseudo"><button class="g" id="gc-switch">Changer de table</button></div></div>
      ${apiBlock()}
      <div class="row"><button class="b" id="gc-ok">Enregistrer</button><button class="g" id="gc-nokey" ${hasKey() ? '' : 'disabled'}>Retirer la clé</button><button class="g" id="gc-close">Fermer</button></div>`);
    el.querySelector('#gc-close').onclick = () => el.remove();
    const cp = el.querySelector('#gc-copy'); if (cp) cp.onclick = async () => { const i = el.querySelector('#gc-link'); i.select(); try { await navigator.clipboard.writeText(i.value); cp.textContent = 'Copié'; } catch (e) { document.execCommand && document.execCommand('copy'); } };
    el.querySelector('#gc-switch').onclick = () => { LS.del('gc_mode'); LS.del('gc_room'); location.href = location.pathname; };
    el.querySelector('#gc-nokey').onclick = () => { LS.del('gc_apikey'); location.reload(); };
    el.querySelector('#gc-ok').onclick = () => { const nk = saveApi(el); LS.set('gc_name', el.querySelector('#gc-name').value.trim()); if (nk) location.reload(); else el.remove(); };
  }

  /* ---------- démarrage ---------- */
  const ready = (async () => {
    const urlRoom = norm(new URLSearchParams(location.search).get('table'));
    let choice;
    if (urlRoom.length >= 12 && ONLINE_OK && LS.get('gc_name')) { choice = { mode: 'online', room: fmt(urlRoom) }; LS.set('gc_mode', 'online'); LS.set('gc_room', choice.room); }
    else if (LS.get('gc_mode') === 'local' || (LS.get('gc_mode') === 'online' && LS.get('gc_room') && ONLINE_OK)) choice = { mode: LS.get('gc_mode'), room: LS.get('gc_room') };
    else choice = await startScreen();
    state.mode = choice.mode; state.room = choice.room;
    let db;
    try { db = choice.mode === 'online' ? await firestoreDb(choice.room) : localDb(); }
    catch (e) { console.error(e); const d = dialog('<h2>Connexion impossible</h2><p>' + esc(e.message || e) + '</p><button class="b" id="gc-back">Revenir au choix</button>'); d.querySelector('#gc-back').onclick = () => { LS.del('gc_mode'); location.href = location.pathname; }; return null; }
    await seedBestiary(db);
    return db;
  })();
  window.claude = {
    standalone: true, me: ME, get mode() { return state.mode; }, get room() { return state.room; }, get uid() { return state.uid; },
    playerName: () => LS.get('gc_name') || '', openSettings,
    use: async name => {
      const db = await ready;
      if (name === 'db') return db;
      if (name === 'sample') return hasKey() ? sample : null;
      if (name === 'downloads') return downloads;
      return null;
    }
  };
})();
