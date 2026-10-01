/* ============================================================
   DASHBOARD — core: state, routes, server calls, shared pieces.
   One page (/dashboard/...) that draws each section itself; the tab bar
   and the top bar switch sections without reloading.
   ============================================================ */
var A = { session: null, stores: [], store: null, canPublish: false, products: null, orders: null, customers: null, stats: null,
          view: '', tab: 'home', dirty: null, admin: !!DS.CFG.admin, newOrders: 0 };
var $app = document.getElementById('app');
var esc = DS.esc;
var X = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14l5-5 5 5"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.3 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  drag: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.3 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.8 3 .6.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1z"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-5-5-8.5 8.5"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="8" r="3.6"/><path d="M2.5 19.2C3.2 15.6 5.8 13.5 9 13.5s5.8 2.1 6.5 5.7c.1.6-.3 1.3-1 1.3H3.5c-.7 0-1.1-.7-1-1.3z"/><circle cx="17" cy="9" r="2.8"/><path d="M16.4 13.6c2.7-.3 4.6 1.6 5.1 4.6.1.6-.3 1.2-.9 1.2h-3.4c.1-2.4-.2-4.2-.8-5.8z"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4.4A1.9 1.9 0 0 1 4.9 2.5h6.2c.5 0 1 .2 1.4.6l8.8 8.8c.7.7.7 1.9 0 2.7l-6.3 6.3c-.7.7-1.9.7-2.7 0L3.6 12.1c-.4-.4-.6-.9-.6-1.4zm5.2 5.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z"/></svg>',
  percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  mobile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></svg>',
  dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>'
};
var STATUS = { new: 'New', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
var VIEWS = {};

/* ---------- small helpers ---------- */
function money(n){ return DS.money(Math.round((+n || 0) * 100) / 100); }
function badge(status){ return '<span class="badge b-' + esc(status) + '">' + esc(STATUS[status] || status) + '</span>'; }
function storeBase(){ return location.origin + '/' + (A.store ? A.store.slug : ''); }
function storeLink(path){ return '/' + A.store.slug + (path || ''); }
function initial(s){ return String(s || '?').trim().charAt(0).toUpperCase() || '?'; }
function pid(){ return Math.random().toString(36).slice(2, 8); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function q(sel, root){ return (root || document).querySelector(sel); }
function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function waNumber(phone){ var d = String(phone || '').replace(/\D/g, ''); if(/^01\d{9}$/.test(d)) d = '2' + d; return d; }
function waLink(phone, text){ return 'https://wa.me/' + waNumber(phone) + (text ? '?text=' + encodeURIComponent(text) : ''); }
function govName(g, lang){ var r = SK_GOVS.filter(function(x){ return x[0] === g; })[0]; return r ? (lang === 'ar' ? r[1] : r[0]) : (g || ''); }
function plural(n, one, many){ return n + ' ' + (n === 1 ? one : many); }
function copyText(t, label){ (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ DS.toast((label || 'Copied') + ' ✓', 'ok', 1800); }, function(){ prompt('Copy this:', t); }); }
function head(title, sub, acts, back){
  return (back ? '<button class="back" data-go="' + back[0] + '">' + X.left + esc(back[1]) + '</button>' : '')
    + '<div class="dhead"><div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
}
function empty(icon, title, text, btn){ return '<div class="card empty"><div class="art">' + icon + '</div><h3>' + title + '</h3><p>' + text + '</p>' + (btn || '') + '</div>'; }
function field(label, html, hint, cls){ return '<label class="field' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span>' + html + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</label>'; }
function loading(){ $app.innerHTML = '<div class="boot"><span class="spin"></span></div>'; }
function fail(e){ $app.innerHTML = empty(X.sparkle, 'That didn’t load.', esc(e && e.message || 'Check your connection and try again.'), '<button class="btn btn-primary" onclick="location.reload()">Try again</button>'); }
async function ask(title, text, ok, danger){
  return new Promise(function(res){
    var box = DS.sheet('ask', '<div style="padding:4px 2px"><h2 class="display h-3">' + title + '</h2>' + (text ? '<p class="muted" style="margin-top:10px">' + text + '</p>' : '')
      + '<div class="row" style="margin-top:22px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-n>Cancel</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + ' btn-sm" data-y>' + (ok || 'OK') + '</button></div></div>',
      { onclose: function(){ res(false); } });
    box.querySelector('[data-n]').onclick = function(){ box.parentNode._onclose = null; DS.closeSheet('ask'); res(false); };
    box.querySelector('[data-y]').onclick = function(){ box.parentNode._onclose = null; DS.closeSheet('ask'); res(true); };
  });
}

/* ---------- unsaved changes: the floating save bar ---------- */
var SB = null;
function savebar(on, opts){
  if(!SB){ SB = document.createElement('div'); SB.className = 'savebar'; document.body.appendChild(SB); }
  if(!on){ SB.classList.remove('on'); A.dirty = null; return; }
  A.dirty = opts;
  SB.innerHTML = '<div><span>' + esc(opts.text || 'Unsaved changes') + '</span>' + (opts.discard ? '<button class="btn btn-ghost" data-d>Discard</button>' : '') + '<button class="btn btn-primary" data-s>' + esc(opts.label || 'Save') + '</button></div>';
  SB.classList.add('on');
  var s = SB.querySelector('[data-s]');
  s.onclick = async function(){ s.classList.add('is-busy'); try { await opts.save(); } catch(e){ DS.toast(e.message || 'Could not save', 'bad'); } s.classList.remove('is-busy'); };
  var d = SB.querySelector('[data-d]'); if(d) d.onclick = function(){ A.dirty = null; savebar(false); opts.discard(); };
}
window.addEventListener('beforeunload', function(e){ if(A.dirty){ e.preventDefault(); e.returnValue = ''; } });

/* ---------- photos: resized in the browser, then stored ---------- */
function readImage(file){
  return new Promise(function(res, rej){
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function(){ res(im); setTimeout(function(){ URL.revokeObjectURL(url); }, 2000); };
    im.onerror = function(){ URL.revokeObjectURL(url); rej(new Error('That file is not an image we can read.')); };
    im.src = url;
  });
}
async function uploadImage(file, opts){
  opts = opts || {};
  var im = await readImage(file), side = opts.max || 1600, w = im.naturalWidth, h = im.naturalHeight, png = opts.png && /png|webp/.test(file.type);
  for(var tries = 0; tries < 5; tries++){
    var k = Math.min(1, side / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var g = c.getContext('2d');
    if(!png){ g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); }
    g.drawImage(im, 0, 0, cw, ch);
    var data = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
    if(!png && data.length > 900000) data = c.toDataURL('image/jpeg', 0.74);
    if(data.length <= 900000){
      var r = await DS.api('/api/stores/' + A.store.sid + '/media', { data: data, w: cw, h: ch });
      return r.url;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error('That image is too large.');
}
function pickFiles(multiple, cb){
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp'; inp.multiple = !!multiple;
  inp.onchange = function(){ cb(Array.prototype.slice.call(inp.files || [])); };
  inp.click();
}

/* ---------- data ---------- */
async function loadStores(){
  var r = await DS.api('/api/stores');
  A.stores = r.stores; A.canPublish = r.canPublish;
}
async function openStore(sid){
  var r = await DS.api('/api/stores/' + sid);
  A.store = r.store; A.canPublish = r.canPublish;
  A.products = A.orders = A.customers = A.stats = null;
  try { localStorage.setItem('ds.sid', sid); } catch(e){}
  document.documentElement.dataset.slug = A.store.slug;
}
async function saveStore(patch){
  var r = await DS.api('/api/stores/' + A.store.sid, patch, 'PATCH');
  A.store = r.store;
  var row = A.stores.filter(function(s){ return s.sid === A.store.sid; })[0];
  if(row){ row.name = A.store.name; row.slug = A.store.slug; row.published = A.store.published; row.logo = A.store.logo; row.lang = A.store.lang; }
  return A.store;
}
async function needProducts(force){ if(!A.products || force){ A.products = (await DS.api('/api/stores/' + A.store.sid + '/products')).products; } return A.products; }
async function needOrders(force){ if(!A.orders || force){ A.orders = (await DS.api('/api/stores/' + A.store.sid + '/orders')).orders; countNew(); } return A.orders; }
async function needCustomers(force){ if(!A.customers || force){ A.customers = (await DS.api('/api/stores/' + A.store.sid + '/customers')).customers; } return A.customers; }
function countNew(){
  var n = (A.orders || []).filter(function(o){ return o.status === 'new'; }).length;
  if(n === A.newOrders) return;
  A.newOrders = n;
  document.title = (n ? '(' + n + ') ' : '') + 'Dashboard — Design by Seif';
  DS.setOpts({ navItems: navItems() }); DS.renderTop(); DS.setTab(A.tab);
}

/* ---------- the store bar: which store, its address, live or not ---------- */
function storeBar(){
  var s = A.store, live = s.published && A.canPublish;
  return '<div class="storebar"><button class="sswitch" data-switch><span class="mono-av">' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="">' : esc(initial(s.name))) + '</span><span class="nm">' + esc(s.name) + '</span>' + (A.stores.length > 1 || true ? X.chev : '') + '</button>'
    + (live ? '<span class="badge b-live">Live</span>' : (s.published ? '<span class="badge b-off">Membership ended</span>' : '<span class="badge b-draft">Not live yet</span>'))
    + '<a class="slink" href="' + esc(storeLink('')) + '" target="_blank" rel="noopener">' + esc(location.host + '/' + s.slug) + '</a></div>';
}
function switcher(){
  var box = DS.sheet('stores', '<h2 class="display h-3">Your stores</h2><div class="lst" style="margin-top:14px">' + A.stores.map(function(s){
    return '<button class="lrow" data-sid="' + esc(s.sid) + '"><span class="av">' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : esc(initial(s.name))) + '</span><span class="mn"><b>' + esc(s.name) + '</b><small>/' + esc(s.slug) + '</small></span><span class="rt">' + (s.sid === A.store.sid ? '<span class="badge b-ok">Open</span>' : (s.published ? '<span class="badge b-live">Live</span>' : '<span class="badge b-draft">Draft</span>')) + '</span></button>';
  }).join('') + '</div>' + (A.stores.length < 3 || A.session.owner ? '<button class="btn btn-ghost btn-block" style="margin-top:14px" data-newstore>' + X.plus + 'New store</button>' : '<p class="tiny" style="margin-top:12px">You can run up to 3 stores on one account.</p>'));
  qa('[data-sid]', box).forEach(function(b){ b.onclick = async function(){ DS.closeSheet('stores'); if(b.dataset.sid === A.store.sid) return; loading(); try { await openStore(b.dataset.sid); route(); } catch(e){ fail(e); } }; });
  var n = box.querySelector('[data-newstore]'); if(n) n.onclick = function(){ DS.closeSheet('stores'); go('/dashboard/new'); };
}
document.addEventListener('click', function(e){
  var g = e.target.closest('[data-go]'); if(g && !e.metaKey && !e.ctrlKey){ e.preventDefault(); go(g.dataset.go); return; }
  var a = e.target.closest('a[href^="/dashboard"]'); if(a && !a.target && !e.metaKey && !e.ctrlKey && !e.defaultPrevented && $app.contains(a)){ e.preventDefault(); go(a.getAttribute('href')); return; }
  if(e.target.closest('[data-switch]')){ switcher(); return; }
});

/* ---------- routes ---------- */
var ROUTES = [
  [/^\/dashboard\/?$/, 'home', 'home'], [/^\/dashboard\/new\/?$/, 'create', 'home'],
  [/^\/dashboard\/orders\/?$/, 'orders', 'orders'], [/^\/dashboard\/orders\/(\d+)$/, 'order', 'orders'],
  [/^\/dashboard\/products\/?$/, 'products', 'products'], [/^\/dashboard\/products\/new$/, 'product', 'products'], [/^\/dashboard\/products\/([A-Za-z0-9_-]+)$/, 'product', 'products'],
  [/^\/dashboard\/customers\/?$/, 'customers', 'customers'], [/^\/dashboard\/discounts\/?$/, 'discounts', 'discounts'],
  [/^\/dashboard\/store\/?$/, 'theme', 'store'], [/^\/dashboard\/settings\/?$/, 'settings', 'settings'], [/^\/admin\/?$/, 'admin', 'admin']
];
function navItems(){
  var n = A.newOrders;
  var items = [{ id: 'home', label: 'Home', href: '/dashboard' }, { id: 'orders', label: 'Orders', href: '/dashboard/orders', badge: n || 0 },
    { id: 'products', label: 'Products', href: '/dashboard/products' }, { id: 'customers', label: 'Customers', href: '/dashboard/customers' },
    { id: 'discounts', label: 'Discounts', href: '/dashboard/discounts' }, { id: 'store', label: 'Store', href: '/dashboard/store' },
    { id: 'settings', label: 'Settings', href: '/dashboard/settings' }, { id: 'design', label: '3D Design', href: '/design' }];
  if(A.session && A.session.owner) items.push({ id: 'admin', label: 'Admin', href: '/admin' });
  return items;
}
function menuItems(){
  var m = [{ id: 'home', label: 'Home', href: '/dashboard' }, { id: 'orders', label: 'Orders', href: '/dashboard/orders' }, { id: 'products', label: 'Products', href: '/dashboard/products' },
    { id: 'customers', label: 'Customers', href: '/dashboard/customers' }, { id: 'discounts', label: 'Discounts', href: '/dashboard/discounts' },
    { id: 'store', label: 'Store & theme', href: '/dashboard/store' }, { id: 'settings', label: 'Settings', href: '/dashboard/settings' },
    { id: 'design', label: '3D Design', href: '/design' }, { id: 'pricing', label: 'Membership', href: '/pricing' }];
  if(A.session && A.session.owner) m.push({ id: 'admin', label: 'Admin', href: '/admin' });
  return m;
}
function go(path, replace){
  if(path === location.pathname + location.search && !replace) { route(); return true; }
  if(A.dirty && !confirm('Leave without saving your changes?')){ DS.setTab(A.tab); return false; }
  savebar(false);
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  route();
  return true;
}
window.addEventListener('popstate', function(){
  if(A.dirty && !confirm('Leave without saving your changes?')){ history.pushState({}, '', A.path); return; }
  savebar(false); route();
});
function route(){
  var p = location.pathname, hit = null;
  for(var i = 0; i < ROUTES.length; i++){ var m = ROUTES[i][0].exec(p); if(m){ hit = { view: ROUTES[i][1], tab: ROUTES[i][2], arg: m[1] }; break; } }
  if(!hit) hit = { view: 'home', tab: 'home' };
  if(hit.view === 'admin' && !A.session.owner) hit = { view: 'home', tab: 'home' };
  if(!A.store && hit.view !== 'admin') hit = { view: 'create', tab: 'home' };
  A.view = hit.view; A.tab = hit.tab; A.path = p;
  DS.setTab(hit.tab);
  window.scrollTo(0, 0);
  if(VIEWS.cleanup){ try { VIEWS.cleanup(); } catch(e){} VIEWS.cleanup = null; }
  Promise.resolve().then(function(){ return VIEWS[hit.view](hit.arg); }).catch(fail);
}
