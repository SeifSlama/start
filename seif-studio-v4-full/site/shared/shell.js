/* ============================================================
   DESIGN BY SEIF — app shell shared by every platform page
   Config + session, Google sign-in (Firebase popup -> /api/login cookie),
   the glass top bar, the liquid-glass tab bar (a pill you can drag between
   tabs, stretching with speed, springing into place), the menu sheet,
   sheets, toasts, the "add to home screen" banner, scroll reveals.
   ============================================================ */
var CFG = window.SEIF_CONFIG || { demo: true };
var DS = (function(){
  var DEMO = !!CFG.demo;
  var FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

  /* ---------- icons (24px) ---------- */
  var I = {
    home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.1 2.9a1.4 1.4 0 0 1 1.8 0l8 6.9c.4.3.6.8.6 1.3V20a1.9 1.9 0 0 1-1.9 1.9h-4.1a.9.9 0 0 1-.9-.9v-5.2a.9.9 0 0 0-.9-.9h-3.4a.9.9 0 0 0-.9.9V21a.9.9 0 0 1-.9.9H4.4A1.9 1.9 0 0 1 2.5 20v-8.9c0-.5.2-1 .6-1.3z"/></svg>',
    design: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.6 2.6c.3-.1.7 0 .9.3.5.9 1.4 1.5 2.5 1.5s2-.6 2.5-1.5c.2-.3.6-.4.9-.3l5.6 2.3c.4.2.6.6.5 1l-1 4a.9.9 0 0 1-1.1.6l-1.6-.4V20a1.9 1.9 0 0 1-1.9 1.9H7.1A1.9 1.9 0 0 1 5.2 20v-9.9l-1.6.4a.9.9 0 0 1-1.1-.6l-1-4c-.1-.4.1-.8.5-1z"/></svg>',
    products: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4.4A1.9 1.9 0 0 1 4.9 2.5h6.2c.5 0 1 .2 1.4.6l8.8 8.8c.7.7.7 1.9 0 2.7l-6.3 6.3c-.7.7-1.9.7-2.7 0L3.6 12.1c-.4-.4-.6-.9-.6-1.4zm5.2 5.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.4 7V6.6a4.6 4.6 0 0 1 9.2 0V7h2c.9 0 1.6.7 1.7 1.6l.9 11.2a2 2 0 0 1-2 2.2H4.8a2 2 0 0 1-2-2.2l.9-11.2C3.8 7.7 4.5 7 5.4 7zm1.9 0h5.4v-.4a2.7 2.7 0 0 0-5.4 0zm-1 3.2a.95.95 0 1 0 0-1.9.95.95 0 0 0 0 1.9zm7.4 0a.95.95 0 1 0 0-1.9.95.95 0 0 0 0 1.9z"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.6 3.2c.3-.5.8-.7 1.3-.7h12.2c.5 0 1 .3 1.3.7l2.2 3.6c.2.3.3.6.3 1a3.2 3.2 0 0 1-5.6 2.1 3.2 3.2 0 0 1-4.6 0 3.2 3.2 0 0 1-4.6 0A3.2 3.2 0 0 1 1.5 7.8c0-.4.1-.7.3-1zM3.7 12.4a4.8 4.8 0 0 0 4-.7c.6.4 1.4.6 2.2.6s1.5-.2 2.1-.6c.6.4 1.4.6 2.2.6s1.6-.2 2.2-.6a4.8 4.8 0 0 0 4 .7V20a1.9 1.9 0 0 1-1.9 1.9h-3.2v-4.8a1.7 1.7 0 0 0-1.7-1.7h-3.2a1.7 1.7 0 0 0-1.7 1.7v4.8H5.6A1.9 1.9 0 0 1 3.7 20z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    arrow: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
    features: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.3 2.9c.3-.9 1.5-.9 1.8 0l1.4 4.3c.3.9 1 1.6 1.9 1.9l4.3 1.4c.9.3.9 1.5 0 1.8l-4.3 1.4c-.9.3-1.6 1-1.9 1.9l-1.4 4.3c-.3.9-1.5.9-1.8 0l-1.4-4.3c-.3-.9-1-1.6-1.9-1.9l-4.3-1.4c-.9-.3-.9-1.5 0-1.8l4.3-1.4c.9-.3 1.6-1 1.9-1.9zM18.6 15.9c.1-.4.7-.4.8 0l.4 1.2c.1.4.4.7.8.8l1.2.4c.4.1.4.7 0 .8l-1.2.4c-.4.1-.7.4-.8.8l-.4 1.2c-.1.4-.7.4-.8 0l-.4-1.2c-.1-.4-.4-.7-.8-.8l-1.2-.4c-.4-.1-.4-.7 0-.8l1.2-.4c.4-.1.7-.4.8-.8z"/></svg>',
    themes: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c5.4 0 9.6 3.8 9.6 8.5 0 3-2.4 5.3-5.3 5.3h-1.6c-.8 0-1.4.6-1.4 1.4 0 .4.1.7.4 1 .4.4.6.9.6 1.5 0 1.3-1 2.3-2.3 2.3A9.5 9.5 0 0 1 12 2.5zM7 12.4a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm3.3-4.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm4.9 0a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm2.9 4.1a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z"/></svg>',
    pricing: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.2 7.6c-.2-.9.8-1.5 1.5-.9l3.6 3 2.9-5.3c.4-.8 1.5-.8 1.9 0l2.9 5.3 3.6-3c.7-.6 1.7 0 1.5.9l-1.8 9.6c-.2.9-.9 1.5-1.8 1.5H6.8c-.9 0-1.6-.6-1.8-1.5zM6 20.5h12a.9.9 0 0 1 0 1.8H6a.9.9 0 0 1 0-1.8z"/></svg>',
    google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1a6.5 6.5 0 0 1-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.9 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.2a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.2 7.1l3.7 2.8A6.5 6.5 0 0 1 12 5.4z"/></svg>'
  };

  /* ---------- where things are ---------- */
  function tabsFor(s){
    if(!(s && s.signedIn)) return [
      { id: 'home', label: 'Home', href: '/', icon: I.home },
      { id: 'features', label: 'Features', href: '/#features', icon: I.features },
      { id: 'design', label: 'Design', href: '/design', icon: I.design },
      { id: 'themes', label: 'Themes', href: '/#themes', icon: I.themes },
      { id: 'pricing', label: 'Pricing', href: '/pricing', icon: I.pricing }
    ];
    return [
      { id: 'home', label: 'Home', href: '/dashboard', icon: I.home },
      { id: 'design', label: 'Design', href: '/design', icon: I.design },
      { id: 'products', label: 'Products', href: '/dashboard/products', icon: I.products },
      { id: 'orders', label: 'Orders', href: '/dashboard/orders', icon: I.orders },
      { id: 'store', label: 'Store', href: '/dashboard/store', icon: I.store }
    ];
  }
  function navFor(s){
    if(s && s.signedIn) return [
      { id: 'home', label: 'Dashboard', href: '/dashboard' }, { id: 'orders', label: 'Orders', href: '/dashboard/orders' },
      { id: 'products', label: 'Products', href: '/dashboard/products' }, { id: 'customers', label: 'Customers', href: '/dashboard/customers' },
      { id: 'store', label: 'Store', href: '/dashboard/store' }, { id: 'design', label: 'Design', href: '/design' }
    ];
    return [
      { id: 'features', label: 'Features', href: '/#features' }, { id: 'themes', label: 'Themes', href: '/#themes' },
      { id: 'design', label: 'Design', href: '/design' }, { id: 'pricing', label: 'Pricing', href: '/pricing' }
    ];
  }
  function menuFor(s){
    if(s && s.signedIn) return [
      { id: 'home', label: 'Dashboard', href: '/dashboard' }, { id: 'orders', label: 'Orders', href: '/dashboard/orders' },
      { id: 'products', label: 'Products', href: '/dashboard/products' }, { id: 'customers', label: 'Customers', href: '/dashboard/customers' },
      { id: 'discounts', label: 'Discounts', href: '/dashboard/discounts' }, { id: 'store', label: 'Store & theme', href: '/dashboard/store' },
      { id: 'settings', label: 'Settings', href: '/dashboard/settings' }, { id: 'design', label: '3D Design', href: '/design' },
      { id: 'pricing', label: 'Membership', href: '/pricing' }
    ];
    return [
      { id: 'home', label: 'Home', href: '/' }, { id: 'features', label: 'Features', href: '/#features' },
      { id: 'themes', label: 'Themes', href: '/#themes' }, { id: 'design', label: '3D Design', href: '/design' },
      { id: 'pricing', label: 'Pricing', href: '/pricing' }
    ];
  }

  /* ---------- server ---------- */
  async function api(path, payload, method){
    var opts = { method: method || (payload !== undefined ? 'POST' : 'GET'), credentials: 'include', headers: {} };
    if(payload !== undefined){ opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(payload); }
    var r = await fetch((CFG.apiBase || '') + path, opts);
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok){ var e = new Error(j.error || ('Request failed (' + r.status + ')')); e.status = r.status; e.data = j; throw e; }
    return j;
  }
  var session = null;
  function cachedSession(){ try { var s = JSON.parse(sessionStorage.getItem('ds.session') || 'null'); return s && s.t > Date.now() - 600e3 ? s.s : null; } catch(e){ return null; } }
  function keepSession(s){ try { sessionStorage.setItem('ds.session', JSON.stringify({ t: Date.now(), s: s })); } catch(e){} }
  async function loadSession(){
    if(DEMO){ session = { signedIn: false, demo: true }; return session; }
    try { session = await api('/api/session'); } catch(e){ session = { signedIn: false, offline: true }; }
    keepSession(session);
    return session;
  }
  function visitorId(){
    var v = null;
    try { v = localStorage.getItem('ss:vid'); } catch(e){}
    if(!v){
      v = Array.from(crypto.getRandomValues(new Uint8Array(12)), function(b){ return 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]; }).join('');
      try { localStorage.setItem('ss:vid', v); } catch(e){}
    }
    return v;
  }
  function track(type, detail){
    if(DEMO || (session && session.owner)) return;
    var k = 'ds.t:' + type + '|' + (detail || '');
    try { if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch(e){}
    fetch((CFG.apiBase || '') + '/api/event', { method: 'POST', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, vid: visitorId(), product: null, detail: detail || null }) }).catch(function(){});
  }

  /* ---------- Google sign-in ---------- */
  var fbReady = null;
  function loadScript(src){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('could not load ' + src)); }; document.head.appendChild(s); }); }
  function loadFirebase(){
    if(DEMO) return Promise.reject(new Error('demo'));
    if(!fbReady){
      fbReady = loadScript(FIREBASE_SDK + 'firebase-app-compat.js').then(function(){ return loadScript(FIREBASE_SDK + 'firebase-auth-compat.js'); }).then(function(){
        if(!firebase.apps.length) firebase.initializeApp(CFG.firebase);
        var auth = firebase.auth();
        if(CFG.authEmulator) auth.useEmulator(CFG.authEmulator, { disableWarnings: true });
        return auth.setPersistence(firebase.auth.Auth.Persistence.NONE).then(function(){ return auth; });
      });
      fbReady.catch(function(){ fbReady = null; });
    }
    return fbReady;
  }
  async function signIn(next, btn, msgEl){
    function say(t, bad){ if(msgEl){ msgEl.textContent = t; msgEl.style.color = bad ? 'var(--clay)' : 'var(--muted)'; } }
    if(DEMO){ say('Sign-in works on the live site (this copy has no server).', true); return; }
    var auth = window.firebase && firebase.apps.length ? firebase.auth() : null;
    if(!auth){ say('Getting Google ready — tap again in a second.'); loadFirebase().catch(function(){ say('Could not reach Google. Check your connection.', true); }); return; }
    if(btn) btn.classList.add('is-busy');
    say('Waiting for Google…');
    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      var cred = await auth.signInWithPopup(provider);
      var s = await api('/api/login', { idToken: await cred.user.getIdToken(), vid: visitorId() });
      auth.signOut().catch(function(){});
      session = s; keepSession(s);
      say('Signed in — opening your dashboard…');
      location.href = next || '/dashboard';
    } catch(e){
      var c = e && e.code;
      say(c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' ? 'Sign-in was cancelled.'
        : c === 'auth/popup-blocked' ? 'Your browser blocked the Google window — allow pop-ups for this site and try again.'
        : 'Could not sign in: ' + (e.message || 'unknown error'), true);
      if(btn) btn.classList.remove('is-busy');
    }
  }
  async function signOut(){
    await fetch((CFG.apiBase || '') + '/api/logout', { method: 'POST', credentials: 'include' }).catch(function(){});
    try { sessionStorage.removeItem('ds.session'); } catch(e){}
    location.href = '/';
  }
  /* the sign-in sheet: Google only; no plans or prices here (that's /pricing) */
  function openSignIn(next, reason){
    loadFirebase().catch(function(){});
    var box = sheet('signin', '<div class="stack" style="--gap:16px;text-align:center;padding:6px 2px 4px">'
      + '<div style="display:flex;justify-content:center;margin-top:4px"><span class="logo"><span class="w">Design</span><span class="by">by Seif</span></span></div>'
      + '<h2 class="display h-3" style="margin-top:14px">' + esc(reason || 'Sign in to keep going.') + '</h2>'
      + '<p class="muted" style="font-size:15px">One Google account for your designs, your store, your orders and customers — on every device.</p>'
      + '<button class="btn btn-soft btn-block" id="dsGoogle" style="height:54px;margin-top:6px">' + I.google.replace('<svg', '<svg width="20" height="20"') + 'Continue with Google</button>'
      + '<p class="tiny" id="dsSignMsg" style="min-height:18px"></p>'
      + '<p class="tiny subtle">By continuing you agree to the <a class="link" href="/terms">Terms</a> and <a class="link" href="/privacy">Privacy</a>.</p></div>');
    var b = box.querySelector('#dsGoogle');
    b.onclick = function(){ signIn(next, b, box.querySelector('#dsSignMsg')); };
  }

  /* ---------- sheets (bottom on phones, centred on wide screens) ---------- */
  function sheet(id, html, opts){
    opts = opts || {};
    var el = $('sheet-' + id);
    if(!el){
      el = document.createElement('div'); el.className = 'sheet'; el.id = 'sheet-' + id;
      el.innerHTML = '<div class="scrim"></div><div class="box' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="grab"></div><button class="icon-btn x" aria-label="Close">' + I.close + '</button><div class="body"></div></div>';
      document.body.appendChild(el);
      el.querySelector('.scrim').onclick = function(){ closeSheet(id); };
      el.querySelector('.x').onclick = function(){ closeSheet(id); };
    }
    el.querySelector('.body').innerHTML = html;
    el._onclose = opts.onclose || null;
    requestAnimationFrame(function(){ el.classList.add('on'); });
    document.documentElement.style.overflow = 'hidden';
    return el.querySelector('.box');
  }
  function closeSheet(id){
    var el = $('sheet-' + id); if(!el) return;
    el.classList.remove('on');
    if(!document.querySelector('.sheet.on')) document.documentElement.style.overflow = '';
    if(el._onclose) el._onclose();
  }
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    var open = document.querySelectorAll('.sheet.on'); if(open.length){ closeSheet(open[open.length - 1].id.slice(6)); return; }
    if(document.querySelector('.menu.on')) toggleMenu(false);
  });

  /* ---------- toasts ---------- */
  function toast(text, kind, ms){
    var host = $('dsToasts');
    if(!host){ host = document.createElement('div'); host.id = 'dsToasts'; host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
    var t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = text;
    host.appendChild(t);
    setTimeout(function(){ t.classList.add('out'); setTimeout(function(){ t.remove(); }, 320); }, ms || 3200);
  }

  /* ---------- top bar + menu ---------- */
  var opts = {};
  function initials(s){ var n = (s && (s.name || s.email)) || '?'; return n.trim().charAt(0).toUpperCase(); }
  function renderTop(){
    var host = $('dsTop'); if(!host) return;
    var s = session || {}, nav = s.signedIn && opts.navItems ? opts.navItems : navFor(s), cur = opts.nav || opts.tab;
    var right = s.signedIn
      ? '<a class="glass avatar" href="/dashboard/settings" aria-label="Your account" title="' + esc(s.email || '') + '">' + esc(initials(s)) + '</a>'
      : '<button class="glass pill" data-ds-signin>Sign in</button><a class="pill primary dsk-only" href="/dashboard" data-ds-start>Start free</a>';
    host.innerHTML = '<div class="topbar"><div class="topbar-in">'
      + '<div class="l"><button class="glass icon-btn menu-btn" aria-label="Menu" data-ds-menu>' + I.menu + '</button></div>'
      + '<div class="c"><a href="' + (s.signedIn ? '/dashboard' : '/') + '" class="logo" aria-label="Design by Seif — home"><span class="w">Design</span><span class="by">by Seif</span></a></div>'
      + '<nav class="topnav" aria-label="Main">' + nav.map(function(n){ return '<a href="' + n.href + '" data-id="' + n.id + '"' + (n.id === cur ? ' class="on" aria-current="page"' : '') + '>' + n.label + (n.badge ? '<span class="nbadge">' + n.badge + '</span>' : '') + '</a>'; }).join('') + '</nav>'
      + '<div class="r">' + right + '</div></div></div>';
    var start = host.querySelector('[data-ds-start]');
    if(start && !matchMedia('(min-width:1024px)').matches) start.remove();
    host.querySelectorAll('[data-ds-signin]').forEach(function(b){ b.onclick = function(){ openSignIn(opts.next); }; });
    host.querySelector('[data-ds-menu]').onclick = function(){ toggleMenu(true); };
    host.querySelectorAll('.topnav a, .c a').forEach(function(a){ a.addEventListener('click', function(e){ if(opts.onNavigate && !e.metaKey && !e.ctrlKey && opts.onNavigate(a.getAttribute('href'), a.dataset.id || 'home') === true) e.preventDefault(); }); });
    renderMenu();
  }
  function renderMenu(){
    var m = $('dsMenu');
    if(!m){ m = document.createElement('div'); m.id = 'dsMenu'; m.className = 'menu'; document.body.appendChild(m); }
    var s = session || {}, items = s.signedIn && opts.menuItems ? opts.menuItems : menuFor(s), cur = opts.nav || opts.tab;
    m.innerHTML = '<div class="scrim"></div><div class="panel" role="dialog" aria-label="Menu">'
      + '<div class="mhead"><span class="logo left"><span class="w">Design</span><span class="by">by Seif</span></span><button class="icon-btn" aria-label="Close menu" data-x>' + I.close + '</button></div>'
      + '<nav>' + items.map(function(n, i){ return '<a href="' + n.href + '" data-id="' + n.id + '"' + (n.id === cur ? ' class="on"' : '') + '>' + n.label + '<small>' + String(i + 1).padStart(2, '0') + '</small></a>'; }).join('') + '</nav>'
      + '<div class="mfoot">' + (s.signedIn
          ? '<div class="tiny" style="text-align:center">Signed in as ' + esc(s.email || s.name || 'you') + '</div><button class="btn btn-ghost btn-block" data-out>Sign out</button>'
          : '<button class="btn btn-primary btn-block" data-in>Create your store ' + I.arrow + '</button><button class="btn btn-ghost btn-block" data-in2>I already have an account</button>')
      + '</div></div>';
    m.querySelector('.scrim').onclick = function(){ toggleMenu(false); };
    m.querySelector('[data-x]').onclick = function(){ toggleMenu(false); };
    m.querySelectorAll('nav a').forEach(function(a){ a.addEventListener('click', function(e){ toggleMenu(false); if(opts.onNavigate && !e.metaKey && !e.ctrlKey && opts.onNavigate(a.getAttribute('href'), a.dataset.id) === true) e.preventDefault(); }); });
    var o = m.querySelector('[data-out]'); if(o) o.onclick = signOut;
    var a1 = m.querySelector('[data-in]'), a2 = m.querySelector('[data-in2]');
    if(a1) a1.onclick = function(){ toggleMenu(false); openSignIn('/dashboard', 'Create your store — free to build.'); };
    if(a2) a2.onclick = function(){ toggleMenu(false); openSignIn(opts.next); };
  }
  function toggleMenu(on){ var m = $('dsMenu'); if(m) m.classList.toggle('on', on); }

  /* ============================================================
     THE TAB BAR — liquid glass. Press anywhere on it and the pill swells
     under your finger; drag and it follows, stretching with speed; let go
     and it springs onto the nearest tab, then that tab opens.
     ============================================================ */
  function Spring(v, k, c, m){ this.v = v; this.t = v; this.vel = 0; this.k = k; this.c = c; this.m = m || 1; }
  Spring.prototype.step = function(dt){
    var f = -this.k * (this.v - this.t) - this.c * this.vel;
    this.vel += f / this.m * dt; this.v += this.vel * dt;
    if(Math.abs(this.vel) < 1e-3 && Math.abs(this.v - this.t) < 1e-3){ this.v = this.t; this.vel = 0; return false; }
    return true;
  };
  Spring.prototype.jump = function(v){ this.v = this.t = v; this.vel = 0; };
  var TB = null;
  function renderTabs(){
    var host = $('dsTabs'); if(!host || opts.tabs === false) return;
    var tabs = tabsFor(session), cur = opts.tab;
    host.innerHTML = '<div class="tabbar-fade" aria-hidden="true"></div><nav class="tabbar" aria-label="Sections"><div class="tabbar-track">'
      + '<span class="tabbar-pill" aria-hidden="true"></span>'
      + tabs.map(function(t){ return '<a class="tabbar-item' + (t.id === cur ? ' is-active' : '') + '" href="' + t.href + '" draggable="false"' + (t.id === cur ? ' aria-current="page"' : '') + ' data-tab="' + t.id + '">'
        + '<span class="ti">' + t.icon + '<span class="tabbar-label">' + t.label + '</span></span></a>'; }).join('')
      + '</div></nav>';
    var track = host.querySelector('.tabbar-track'), pill = host.querySelector('.tabbar-pill'), items = Array.prototype.slice.call(host.querySelectorAll('.tabbar-item'));
    var active = items.findIndex(function(a){ return a.dataset.tab === cur; });
    TB = { track: track, pill: pill, items: items, active: active, x: new Spring(0, 420, 34, .7), w: new Spring(56, 420, 34, .7),
           sx: new Spring(1, 300, 20), press: new Spring(1, 300, 22), dragging: false, raf: 0 };
    pill.style.opacity = active >= 0 ? 1 : 0;
    function geo(i){ var a = items[i].getBoundingClientRect(), r = track.getBoundingClientRect(); return { left: a.left - r.left, width: a.width, center: a.left - r.left + a.width / 2 }; }
    function place(i, instant){
      var g = geo(i), w = Math.min(81, g.width + 17);
      if(instant){ TB.x.jump(g.center - w / 2); TB.w.jump(w); } else { TB.x.t = g.center - w / 2; TB.w.t = w; }
      kick();
    }
    function nearest(clientX){
      var x = clientX - track.getBoundingClientRect().left, best = 0, bd = 1e9;
      items.forEach(function(a, i){ var d = Math.abs(geo(i).center - x); if(d < bd){ bd = d; best = i; } });
      return best;
    }
    function draw(){
      var sx = TB.sx.v, sy = 1 - (sx - 1) * .35, p = TB.press.v;
      pill.style.width = TB.w.v + 'px';
      pill.style.transform = 'translateX(' + TB.x.v + 'px) scale(' + (sx * p).toFixed(4) + ',' + (sy * p).toFixed(4) + ')';
    }
    var last = 0;
    function frame(t){
      var dt = Math.min(.032, last ? (t - last) / 1000 : .016); last = t;
      var moving = false;
      [TB.x, TB.w, TB.sx, TB.press].forEach(function(s){ for(var k = 0; k < 4; k++) moving = s.step(dt / 4) || moving; });
      draw();
      if(moving || TB.dragging) TB.raf = requestAnimationFrame(frame); else { TB.raf = 0; last = 0; }
    }
    function kick(){ if(!TB.raf) TB.raf = requestAnimationFrame(frame); }
    place(Math.max(0, active), true); draw();
    window.addEventListener('resize', function(){ place(Math.max(0, TB.active), true); draw(); });
    var hover = -1, lastX = 0, lastT = 0;
    function setHover(i){ if(i === hover) return; if(hover >= 0) items[hover].classList.remove('is-hover'); hover = i; if(i >= 0) items[i].classList.add('is-hover'); }
    track.addEventListener('pointerdown', function(e){
      if(e.button > 0) return;
      try { track.setPointerCapture(e.pointerId); } catch(err){}
      TB.dragging = true; track.classList.add('is-dragging'); pill.style.opacity = 1;
      lastX = e.clientX; lastT = performance.now();
      TB.press.t = 1.18;
      var i = nearest(e.clientX); setHover(i); place(i);
    });
    track.addEventListener('pointermove', function(e){
      if(!TB.dragging) return;
      var r = track.getBoundingClientRect(), w = TB.w.v;
      TB.x.t = Math.min(r.width - w - 4, Math.max(4, e.clientX - r.left - w / 2));
      var now = performance.now(), v = Math.abs(e.clientX - lastX) / Math.max(1, now - lastT);
      TB.sx.t = 1 + Math.min(.9, .9 * v); lastX = e.clientX; lastT = now;
      setHover(nearest(e.clientX)); kick();
    });
    function up(e){
      if(!TB.dragging) return;
      TB.dragging = false; track.classList.remove('is-dragging');
      TB.sx.t = 1; TB.press.t = 1;
      var i = nearest(e.clientX); setHover(-1); place(i);
      if(e.type === 'pointercancel'){ place(Math.max(0, TB.active)); pill.style.opacity = TB.active >= 0 ? 1 : 0; return; }
      var target = items[i];
      if(i === TB.active){
        /* the tab you are on: back to the top (or the page's own "start of this section") */
        if(!(opts.onReselect && opts.onReselect(target.dataset.tab) === true)) window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      items.forEach(function(a, k){ a.classList.toggle('is-active', k === i); });
      TB.active = i;
      setTimeout(function(){ go(target.getAttribute('href'), target.dataset.tab); }, 120);
    }
    track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
    /* pointer clicks are handled above; keyboard "clicks" (detail 0) follow the link */
    items.forEach(function(a){ a.addEventListener('click', function(e){ if(e.detail !== 0) e.preventDefault(); }); });
  }
  /* a page can take tab navigation over (the dashboard switches views without reloading) */
  function go(href, tabId){
    if(opts.onNavigate && opts.onNavigate(href, tabId) === true) return;
    location.href = href;
  }
  function setTab(id){
    opts.tab = id;
    if(!TB) return;
    var i = TB.items.findIndex(function(a){ return a.dataset.tab === id; });
    TB.items.forEach(function(a, k){ a.classList.toggle('is-active', k === i); if(k === i) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    TB.active = i; TB.pill.style.opacity = i >= 0 ? 1 : 0;
    if(i >= 0){ var a = TB.items[i].getBoundingClientRect(), r = TB.track.getBoundingClientRect(), w = Math.min(81, a.width + 17); TB.x.t = a.left - r.left + a.width / 2 - w / 2; TB.w.t = w; if(!TB.raf) TB.raf = requestAnimationFrame(function f(t){ var m = false; [TB.x, TB.w].forEach(function(s){ for(var k = 0; k < 4; k++) m = s.step(.004) || m; }); TB.pill.style.width = TB.w.v + 'px'; TB.pill.style.transform = 'translateX(' + TB.x.v + 'px)'; TB.raf = m ? requestAnimationFrame(f) : 0; }); }
    opts.nav = id;
    var nav = $('dsTop'); if(nav) nav.querySelectorAll('.topnav a').forEach(function(a){ var on = a.dataset.id === id; a.classList.toggle('on', on); if(on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var mn = $('dsMenu'); if(mn) mn.querySelectorAll('nav a').forEach(function(a){ a.classList.toggle('on', a.dataset.id === id); });
  }

  /* ---------- footer ---------- */
  function renderFoot(){
    var host = $('dsFoot'); if(!host) return;
    var y = new Date().getFullYear();
    host.innerHTML = '<footer class="foot wrap"><div class="rule"></div>'
      + '<div class="grid3"><span class="logo left"><span class="w" style="font-size:19px;color:var(--muted)">Design</span><span class="by">by Seif</span></span>'
      + '<span style="text-align:center">Design it. Sell it. Ship it.</span><span style="text-align:right">© ' + y + ' Seif Studios</span></div>'
      + '<nav><a href="/pricing">Pricing</a><a href="/design">3D Design</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a><span class="copy-m" style="margin-left:auto">© ' + y + ' Seif Studios</span></nav></footer>';
  }

  /* ---------- add to home screen ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferredPrompt = e; });
  function standalone(){ return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function maybeInstallBanner(){
    if(opts.install === false || standalone()) return;
    try { if(localStorage.getItem('ds.install.off')) return; } catch(e){ return; }
    setTimeout(function(){
      if(!isIOS() && !deferredPrompt) return;
      var el = document.createElement('div'); el.className = 'install glass';
      el.innerHTML = '<img src="/icons/icon-180.png" alt=""><div style="flex:1;min-width:0"><b>Add Design to your home screen</b><span>'
        + (isIOS() ? 'Safari: Share → Add to Home Screen' : 'Open it like an app, one tap away') + '</span></div>'
        + (deferredPrompt ? '<button class="btn btn-primary btn-xs" data-i>Add</button>' : '') + '<button class="icon-btn" aria-label="Dismiss" data-x style="width:36px;height:36px">' + I.close + '</button>';
      document.body.appendChild(el);
      function off(){ try { localStorage.setItem('ds.install.off', '1'); } catch(e){} el.remove(); }
      el.querySelector('[data-x]').onclick = off;
      var add = el.querySelector('[data-i]'); if(add) add.onclick = function(){ deferredPrompt.prompt(); deferredPrompt.userChoice.finally(off); };
    }, 3500);
  }

  /* ---------- scroll reveals ---------- */
  function reveals(root){
    var els = (root || document).querySelectorAll('.reveal:not(.in)');
    if(!('IntersectionObserver' in window)){ els.forEach(function(e){ e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function(e){ io.observe(e); });
  }

  /* ---------- formatting ---------- */
  function money(n, cur){ n = +n || 0; var s = n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); return s + ' ' + (cur || 'EGP'); }
  function ago(t){
    var d = (Date.now() - t) / 1000;
    if(d < 60) return 'just now'; if(d < 3600) return Math.floor(d / 60) + 'm ago'; if(d < 86400) return Math.floor(d / 3600) + 'h ago';
    if(d < 86400 * 7) return Math.floor(d / 86400) + 'd ago';
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function date(t, withTime){ return new Date(t).toLocaleString('en-GB', withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' }); }

  /* ---------- boot ---------- */
  async function boot(o){
    opts = o || {};
    session = cachedSession();
    renderTop(); renderTabs(); renderFoot();
    reveals();
    if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(function(){});
    var fresh = await loadSession();
    var changed = JSON.stringify(fresh) !== JSON.stringify(cachedSessionAtBoot);
    if(changed){ renderTop(); renderTabs(); }
    track('visit', (opts.page || 'page') + ' · ' + (matchMedia('(max-width:900px)').matches ? 'phone' : 'computer'));
    maybeInstallBanner();
    if(opts.onSession) opts.onSession(session);
    return session;
  }
  var cachedSessionAtBoot = cachedSession();

  return { CFG: CFG, DEMO: DEMO, I: I, $: $, esc: esc, api: api, boot: boot, get session(){ return session; }, signIn: signIn, signOut: signOut,
           openSignIn: openSignIn, loadFirebase: loadFirebase, sheet: sheet, closeSheet: closeSheet, toast: toast, setTab: setTab, reveals: reveals,
           money: money, ago: ago, date: date, visitorId: visitorId, track: track, renderTop: renderTop, isIOS: isIOS, standalone: standalone,
           setOpts: function(o){ Object.keys(o).forEach(function(k){ opts[k] = o[k]; }); } };
})();
