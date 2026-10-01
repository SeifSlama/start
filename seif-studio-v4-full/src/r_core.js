/* ============================================================
   SEIF STUDIO v4 — engine core
   Panels (flat artboards with real cm sizes) hold layer stacks;
   renderArtboard() rasterises a panel; compositeView() maps the
   finished panels onto the photographed garment through their
   quads, clips to the fabric and shades them with the photo's
   own light. One render path feeds the editor, the thumbnails,
   the assembled mockup and the 300 DPI export.
   ============================================================ */
'use strict';

/* Runtime config comes from window.SEIF_CONFIG (injected by a server). Without it the
   app runs in DEMO_MODE: access is not enforced and demo credentials are used. */
var CFG           = window.SEIF_CONFIG || { demo: true };
var DEMO_MODE     = CFG.demo !== false;
var ADMIN_PIN     = DEMO_MODE ? 'DEMO' : null;     /* never in client code when not demo */
var PRICE         = CFG.price || '100 EGP';
var PRICE_PERIOD  = CFG.pricePeriod || '/month';
var API_BASE      = CFG.apiBase || '';
var K_ACCESS  = 'seifstudio:access';
var K_INVITES = 'seifstudio:invites';
var DEBUG     = /[?&]debug=1/.test(location.search);
var PROJECT_VERSION = 5;   /* 5: the tee's panels became full pattern pieces (3D); 4 still opens */

function $(id){ return document.getElementById(id); }

window.addEventListener('error', function(e){
  var box = $('errbox');
  if(box){ box.style.display = 'block'; box.textContent = 'Something went wrong: ' + (e.message || 'unknown error'); }
});

/* ---------------- storage ----------------
   window.storage (shared/personal) when the host provides it, localStorage
   otherwise. set() reports {ok, reason} so a full quota is not mistaken for
   an empty store; the UI shows a persistent strip when saving fails.
   On the live build, once the customer has an active account (store.cloud), personal keys —
   projects, images, my products — live in their account on the server (/api/data),
   so their work follows them to any device. Shared keys — the owner's garment photos,
   panel mapping and colours — live at /api/shared: everyone reads, only the owner writes.
   The owner can open a customer's design read-only (viewBase + readOnly). */
var CLOUD_CHUNK = 900000;   /* matches the server's INLINE_MAX / CHUNK_MAX */
var store = {
  backend: (typeof window !== 'undefined' && window.storage) ? 'host' : (function(){ try { return window.localStorage ? 'local' : 'none'; } catch(e){ return 'none'; } })(),
  cloud: false,
  sharedCloud: false,
  sharedKeys: null,     /* keys that exist on the server, so missing ones cost no request */
  viewBase: null,
  readOnly: false,
  ok: true,
  lastError: null,
  _lk: function(key, shared){ return 'ss:' + (shared ? 's:' : 'p:') + key; },
  _url: function(key, q, shared){ return API_BASE + (shared ? '/api/shared/' : (this.viewBase || '/api/data/')) + encodeURIComponent(key) + (q || ''); },
  _req: async function(url, opts){
    var r = await fetch(url, Object.assign({ credentials: 'include' }, opts || {}));
    if(!r.ok){ var j = null; try { j = await r.json(); } catch(e){} throw new Error((j && j.error) || ('server error ' + r.status)); }
    return r;
  },
  cloudGet: async function(key, shared){
    var j = await (await this._req(this._url(key, '', shared))).json();
    if(!j.found) return null;
    if(typeof j.inline === 'string') return JSON.parse(j.inline);
    var self = this, parts = [];
    for(var i=0;i<j.n;i++) parts.push(self._req(self._url(key, '?v=' + j.v + '&i=' + i, shared)).then(function(r){ return r.text(); }));
    return JSON.parse((await Promise.all(parts)).join(''));
  },
  cloudSet: async function(key, s, shared){
    var put = { method: 'PUT', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } };
    if(s.length <= CLOUD_CHUNK){ await this._req(this._url(key, '', shared), Object.assign({ body: s }, put)); return; }
    var v = Array.from(crypto.getRandomValues(new Uint8Array(10)), function(b){ return (b % 36).toString(36); }).join('');
    var n = Math.ceil(s.length / CLOUD_CHUNK);
    for(var i=0;i<n;i++) await this._req(this._url(key, '?v=' + v + '&i=' + i, shared), Object.assign({ body: s.slice(i * CLOUD_CHUNK, (i + 1) * CLOUD_CHUNK) }, put));
    await this._req(this._url(key, '?v=' + v + '&n=' + n + '&size=' + s.length, shared), put);
  },
  loadSharedKeys: async function(){
    var map = {};
    try { (await (await this._req(API_BASE + '/api/shared')).json()).keys.forEach(function(k){ map[k] = 1; }); } catch(e){}
    this.sharedKeys = map;
  },
  cloudKeys: async function(prefix){
    var j = await (await this._req(API_BASE + '/api/data?prefix=' + encodeURIComponent(prefix || ''))).json();
    return j.keys || [];
  },
  get: async function(key, shared){
    try {
      if(shared && this.sharedCloud) return this.sharedKeys && this.sharedKeys[key] ? await this.cloudGet(key, true) : null;
      if(!shared && (this.cloud || this.viewBase)) return await this.cloudGet(key, false);
      if(this.backend === 'host'){ var r = await window.storage.get(key, !!shared); return r ? JSON.parse(r.value) : null; }
      if(this.backend === 'local'){ var v = localStorage.getItem(this._lk(key, shared)); return v ? JSON.parse(v) : null; }
      return null;
    } catch(e){ return null; }
  },
  set: async function(key, val, shared){
    var s = JSON.stringify(val);
    try {
      if(!shared && this.readOnly){
        return this._fail('you are viewing a customer’s design, so changes are not saved');
      } else if(shared && this.sharedCloud){
        await this.cloudSet(key, s, true);
        if(this.sharedKeys) this.sharedKeys[key] = 1;
      } else if(this.cloud && !shared){
        await this.cloudSet(key, s, false);
      } else if(this.backend === 'host'){
        var r = await window.storage.set(key, s, !!shared);
        if(!r){ return this._fail('write rejected'); }
      } else if(this.backend === 'local'){
        localStorage.setItem(this._lk(key, shared), s);
      } else {
        return this._fail('no storage available');
      }
      this.ok = true; this.lastError = null;
      if(typeof onStoreStatus === 'function') onStoreStatus(true);
      return { ok:true };
    } catch(e){
      var quota = /quota|exceeded/i.test(String(e && (e.name + ' ' + e.message)));
      return this._fail(quota ? 'storage is full' : (e && e.message ? e.message : 'unknown error'));
    }
  },
  _fail: function(reason){
    this.ok = false; this.lastError = reason;
    if(typeof onStoreStatus === 'function') onStoreStatus(false, reason);
    return { ok:false, reason:reason };
  },
  del: async function(key, shared){
    try {
      if(!shared && this.readOnly) return;
      if(shared && this.sharedCloud){ await this._req(this._url(key, '', true), { method: 'DELETE' }); if(this.sharedKeys) delete this.sharedKeys[key]; }
      else if(this.cloud && !shared) await this._req(this._url(key), { method: 'DELETE' });
      else if(this.backend === 'host') await window.storage.delete(key, !!shared);
      else if(this.backend === 'local') localStorage.removeItem(this._lk(key, shared));
    } catch(e){}
  },
  /* list keys with a prefix (personal scope) — localStorage only; host storage has no listing */
  keys: function(prefix, shared){
    var out = [];
    if(this.backend !== 'local') return out;
    var p = this._lk(prefix, shared);
    for(var i=0;i<localStorage.length;i++){ var k = localStorage.key(i); if(k.indexOf(p) === 0) out.push(k.slice(this._lk('', shared).length)); }
    return out;
  }
};

/* ---------------- state ---------------- */
var DS = 1600, CX = 800;             /* design space */
/* Views form a turntable: each has an angle (degrees, garment turning to the
   viewer's left) so the preview can be dragged around. A view exists when a
   photo (or built-in render) exists for it; 'detail' is off the turntable. */
var VIEWS = [
  { id:'front',      label:'Front',      angle:0 },
  { id:'turn_030',   label:'30\u00B0',    angle:30 },
  { id:'turn_060',   label:'60\u00B0',    angle:60 },
  { id:'side_left',  label:'Left side',  angle:90 },
  { id:'turn_120',   label:'120\u00B0',   angle:120 },
  { id:'turn_150',   label:'150\u00B0',   angle:150 },
  { id:'back',       label:'Back',       angle:180 },
  { id:'turn_210',   label:'210\u00B0',   angle:210 },
  { id:'turn_240',   label:'240\u00B0',   angle:240 },
  { id:'side_right', label:'Right side', angle:270 },
  { id:'turn_300',   label:'300\u00B0',   angle:300 },
  { id:'turn_330',   label:'330\u00B0',   angle:330 },
  { id:'detail',     label:'Detail',     angle:null }
];
function viewById(id){ for(var i=0;i<VIEWS.length;i++){ if(VIEWS[i].id === id) return VIEWS[i]; } return null; }
/* Built-in garment renders shipped next to the HTML (assets/<product>/<view>.png,
   luminance + alpha, made with tools/prep-photos.js). An admin upload in
   storage overrides them. */
var BUILTIN_PHOTOS = {};      /* the tee is 3D now; other garments still map onto uploaded photos */
function builtinPhotoUrl(productId, view){
  return (BUILTIN_PHOTOS[productId] && BUILTIN_PHOTOS[productId][view]) ? (CFG.assetBase || 'assets/') + productId + '/' + view + '.png' : null;
}
var FABRICS = {
  cotton: { label:'Cotton', shadow:0.72, highlight:0.55, spec:0.5, midScale:1.0 },
  fleece: { label:'Fleece', shadow:0.62, highlight:0.40, spec:0.35, midScale:1.0 },
  nylon:  { label:'Nylon',  shadow:0.72, highlight:0.60, spec:0.8, midScale:0.85 }
};
var TECHNIQUES = {
  dtg:        { label:'DTG' },
  screen:     { label:'Screen print', maxColors:6 },
  embroidery: { label:'Embroidery' },
  vinyl:      { label:'Vinyl' }
};
var state = {
  product: 'tee',
  color: '#FAFAF7',                    /* mirror of project.garmentColor, read by the vector palette */
  accentMode: 'auto',
  accent: '#C3423F',
  fit: 'regular',
  view: 'front',                       /* front|back|side_left|side_right|detail — a real photo per view */
  mode: 'design',                      /* design (panel sheet / artboard) | preview (assembled garment) */
  fabric: 'cotton',
  followFabric: false,
  followStrength: 8,
  panel: null                          /* panel open in the artboard editor */
};

/* The project: everything the user has designed, keyed by product so switching
   garments never discards work. project.panels always points at the current
   product's panels. Only "New project" clears it. */
var project = {
  version: PROJECT_VERSION,
  productId: 'tee',
  garmentColor: '#FAFAF7',
  fabric: 'cotton',
  fabricNote: '',
  rev: 0,
  work: {},          /* productId -> { panels: { panelId -> { layers:[], technique:'dtg' } } } */
  panels: null
};
var panelRev = {};   /* productId|panelId -> revision, bumps on every mutation of that panel */
function workFor(productId){
  if(!project.work[productId]) project.work[productId] = { panels: {} };
  return project.work[productId];
}
function panelWork(panelId, productId){
  var w = workFor(productId || project.productId);
  if(!w.panels[panelId]) w.panels[panelId] = { layers: [], technique: 'dtg' };
  return w.panels[panelId];
}
function bindProjectProduct(productId){
  project.productId = productId;
  state.product = productId;
  project.panels = workFor(productId).panels;
}
function layersFor(panelId, productId){ return panelWork(panelId, productId).layers; }
function bumpRev(panelId){
  project.rev++;
  var k = project.productId + '|' + panelId;
  panelRev[k] = (panelRev[k] || 0) + 1;
  projectDirty = true;
  scheduleAutosave();
  if(typeof onProjectChanged === 'function') onProjectChanged(panelId);
}
function getPanelRev(panelId, productId){ return panelRev[(productId || project.productId) + '|' + panelId] || 0; }
function productHasWork(productId){
  var w = project.work[productId]; if(!w) return false;
  return Object.keys(w.panels).some(function(k){ return w.panels[k].layers.length > 0; });
}

/* ---------------- color helpers ---------------- */
function hexToRgb(h){
  h = h.replace('#','');
  if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n = parseInt(h,16);
  return [ (n>>16)&255, (n>>8)&255, n&255 ];
}
function rgbToHex(r,g,b){
  function c(v){ v = Math.max(0,Math.min(255,Math.round(v))); return ('0'+v.toString(16)).slice(-2); }
  return '#'+c(r)+c(g)+c(b);
}
function mixHex(a,b,t){
  var x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t);
}
function lum(hex){ var c = hexToRgb(hex); return (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255; }
function shadeOf(hex){ return mixHex(hex, '#101018', 0.16); }
function darkOf(hex){ return mixHex(hex, '#0A0A10', 0.5); }
function autoAccent(hex){
  var L = lum(hex);
  if(L > 0.82) return '#20242E';
  if(L < 0.16) return '#E8E4DA';
  return mixHex(hex, L > 0.5 ? '#141821' : '#F2EFE6', 0.62);
}
function accentColor(){ return state.accentMode === 'custom' ? state.accent : autoAccent(state.color); }
function palette(){
  return {
    base: state.color,
    accent: accentColor(),
    shade: shadeOf(state.color),
    dark: darkOf(state.color),
    inner: '#5E626B',
    fixed: '#EFEBE0'
  };
}

/* ---------------- named garment colours (admin-managed) ---------------- */
var K_COLORS = 'seifstudio:colors';
var GARMENT_COLORS = [
  { name:'White',    hex:'#FAFAF7', tcx:'11-0601' }, { name:'Black',   hex:'#141414', tcx:'19-4007' },
  { name:'Charcoal', hex:'#3A3A3C', tcx:'19-3906' }, { name:'Heather', hex:'#B7B4AC', tcx:'14-4102' },
  { name:'Navy',     hex:'#1D2A44', tcx:'19-3921' }, { name:'Royal',   hex:'#2E4FA3', tcx:'19-3955' },
  { name:'Sky',      hex:'#A9C6E8', tcx:'14-4318' }, { name:'Forest',  hex:'#274D3D', tcx:'19-6110' },
  { name:'Olive',    hex:'#6B6B45', tcx:'18-0527' }, { name:'Sand',    hex:'#D9C7A3', tcx:'13-1010' },
  { name:'Maroon',   hex:'#6E2A35', tcx:'19-1627' }, { name:'Red',     hex:'#C3423F', tcx:'18-1662' },
  { name:'Orange',   hex:'#E07A3F', tcx:'16-1358' }, { name:'Pink',    hex:'#E8AFC2', tcx:'13-2806' },
  { name:'Lavender', hex:'#B7A6D9', tcx:'15-3817' }, { name:'Butter',  hex:'#EFDF9C', tcx:'12-0752' }
];
async function loadGarmentColors(){
  var rec = await store.get(K_COLORS, true);
  if(rec && rec.list && rec.list.length) GARMENT_COLORS = rec.list;
}
async function saveGarmentColors(list){
  GARMENT_COLORS = list;
  return store.set(K_COLORS, { list:list }, true);
}
function colorNameFor(hex){
  hex = (hex || '').toLowerCase();
  for(var i=0;i<GARMENT_COLORS.length;i++){ if(GARMENT_COLORS[i].hex.toLowerCase() === hex) return GARMENT_COLORS[i].name; }
  return hex.replace('#','').toUpperCase();
}

/* ---------------- deterministic value noise (vector placeholder grain) ---------------- */
function hash2(x,y){
  var s = Math.sin(x*127.1 + y*311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x,y){
  var xi = Math.floor(x), yi = Math.floor(y);
  var xf = x-xi, yf = y-yi;
  var u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
  var a = hash2(xi,yi), b = hash2(xi+1,yi), c = hash2(xi,yi+1), d = hash2(xi+1,yi+1);
  return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
}
function fbm(x,y){
  return vnoise(x,y)*0.55 + vnoise(x*2.13,y*2.13)*0.28 + vnoise(x*4.31,y*4.31)*0.17;
}

/* ---------------- garment photo assets ----------------
   A photo is greyscale + keyed alpha (see the admin editor). The asset carries
   its placement in design space and lazily computed luminance statistics. */
var PHOTO_PREFIX = 'seifstudio:photo:';
var photoCache = {};   /* "productId|view" -> undefined | 'pending' | null | asset */

function isCustomProduct(id){ return typeof id === 'string' && id.indexOf('custom_') === 0; }
function photoShared(id){ return !isCustomProduct(id); }
function photoKey(productId, view){ return PHOTO_PREFIX + productId + ':' + view; }

function getPhotoAsset(productId, view){
  var ck = productId + '|' + view;
  var v = photoCache[ck];
  if(v === undefined){
    photoCache[ck] = 'pending';
    store.get(photoKey(productId, view), photoShared(productId)).then(function(rec){
      var src = (rec && rec.data) ? rec.data : builtinPhotoUrl(productId, view);
      if(!src){ photoCache[ck] = null; onPhotoResolved(productId, view); return; }
      var img = new Image();
      img.onload = function(){
        var asset = buildPhotoAsset(img, productId, view);
        /* a file:// image taints the canvas; treat it as missing rather than crash later */
        try { photoStats(asset); photoCache[ck] = asset; } catch(e){ photoCache[ck] = null; }
        onPhotoResolved(productId, view);
      };
      img.onerror = function(){ photoCache[ck] = null; onPhotoResolved(productId, view); };
      img.src = src;
    });
    return null;
  }
  if(v === 'pending' || v === null) return null;
  return v;
}
function buildPhotoAsset(img, productId, view){
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  var scale = Math.min(DS/iw, DS/ih) * 0.94;
  var dw = iw*scale, dh = ih*scale, dx = (DS-dw)/2, dy = (DS-dh)/2;
  return { img: img, iw: iw, ih: ih, key: productId + '|' + view + '|' + iw + 'x' + ih + '|' + Date.now(),
           place: { dx:dx, dy:dy, dw:dw, dh:dh }, stats: null, disp: null, shade: null };
}
function onPhotoResolved(productId, view){
  if(typeof onAssetsChanged === 'function') onAssetsChanged(productId, view);
}
async function savePhotoAsset(productId, view, dataUrl){
  var r = await store.set(photoKey(productId, view), { data: dataUrl }, photoShared(productId));
  var img = new Image();
  await new Promise(function(res){ img.onload = res; img.onerror = res; img.src = dataUrl; });
  photoCache[productId + '|' + view] = buildPhotoAsset(img, productId, view);
  recolorCache.clear(); mappedCache = {};
  onPhotoResolved(productId, view);
  return r;
}
async function removePhotoAsset(productId, view){
  await store.del(photoKey(productId, view), photoShared(productId));
  delete photoCache[productId + '|' + view];   /* re-resolves to the built-in render, if any */
  recolorCache.clear(); mappedCache = {};
  onPhotoResolved(productId, view);
}
/* simple color-distance chroma key with a soft edge band */
function keyBackground(imgData, kr, kg, kb, tolerance){
  var d = imgData.data, lo = tolerance*0.55, hi = tolerance*1.35;
  for(var i=0;i<d.length;i+=4){
    var dr=d[i]-kr, dg=d[i+1]-kg, db=d[i+2]-kb;
    var dist = Math.sqrt(dr*dr+dg*dg+db*db), a;
    if(dist <= lo) a = 0;
    else if(dist >= hi) a = 255;
    else a = Math.round(255*(dist-lo)/(hi-lo));
    d[i+3] = Math.min(d[i+3], a);
  }
  return imgData;
}
function toGrayscaleLuma(imgData){
  var d = imgData.data;
  for(var i=0;i<d.length;i+=4){
    var l = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
    d[i]=d[i+1]=d[i+2]=l;
  }
  return imgData;
}
/* luminance statistics of the garment region: mean (mid) and 92nd percentile.
   Computed once per photo at reduced resolution. */
function photoStats(asset){
  if(asset.stats) return asset.stats;
  var W = 256, H = Math.max(1, Math.round(256 * asset.ih / asset.iw));
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var cx = c.getContext('2d'); cx.drawImage(asset.img, 0, 0, W, H);
  var d = cx.getImageData(0, 0, W, H).data, hist = new Uint32Array(256), n = 0, sum = 0;
  for(var i=0;i<d.length;i+=4){
    if(d[i+3] < 128) continue;
    hist[d[i]]++; sum += d[i]; n++;
  }
  var mid = n ? sum / n / 255 : 0.6;
  var acc = 0, p92 = 255, target = n * 0.92;
  for(var k=0;k<256;k++){ acc += hist[k]; if(acc >= target){ p92 = k; break; } }
  asset.stats = { mid: Math.min(0.9, Math.max(0.15, mid)), p92: p92 / 255, count: n };
  return asset.stats;
}

/* ---------- client-owned custom products (private, no PIN needed) ---------- */
var CUSTOM_KEY = 'seifstudio:myproducts';
var customProducts = [];
function stubOutline(ctx){ ctx.beginPath(); ctx.rect(300, 300, 1000, 1000); }
function stubPaint(ctx, C){ ctx.fillStyle = C.base; ctx.fillRect(300, 300, 1000, 1000); }
function stubFolds(){ return []; }
function slugify(name){
  var s = (name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24);
  return s || 'product';
}
function registerCustomProduct(cp){
  var views = { front: { outline: stubOutline, paint: stubPaint, folds: stubFolds } };
  if(cp.hasBack) views.back = { outline: stubOutline, paint: stubPaint, folds: stubFolds };
  var panels = cp.panels || [ { id:'front', label:'Front', w_cm:30, h_cm:35 } ];
  if(cp.hasBack && !panels.some(function(p){ return p.id === 'back'; })) panels.push({ id:'back', label:'Back', w_cm:30, h_cm:35 });
  var entry = { id: cp.id, sku: 'CUSTOM', name: cp.name, cat: 'My products', spec: 'Your own product', views: views, panels: panels, isCustom: true };
  PRODUCTS_BY_ID[cp.id] = entry;
  if(!PRODUCTS.some(function(p){ return p.id === cp.id; })) PRODUCTS.push(entry);
}
async function loadCustomProducts(){
  var rec = await store.get(CUSTOM_KEY, false);
  customProducts = (rec && rec.list) ? rec.list : [];
  customProducts.forEach(registerCustomProduct);
}
async function saveCustomProductsList(){
  return store.set(CUSTOM_KEY, { list: customProducts }, false);
}
async function addCustomProduct(name, hasBack, panels){
  var id = 'custom_' + slugify(name) + '_' + Math.random().toString(36).slice(2, 7);
  var cp = { id: id, name: (name || 'My product').slice(0, 40), hasBack: !!hasBack, panels: panels || null };
  customProducts.push(cp);
  await saveCustomProductsList();
  registerCustomProduct(cp);
  return cp;
}
async function deleteCustomProduct(id){
  for(var i=0;i<VIEWS.length;i++){ await removePhotoAsset(id, VIEWS[i].id); await store.del(placementKey(id, VIEWS[i].id), false); }
  customProducts = customProducts.filter(function(c){ return c.id !== id; });
  await saveCustomProductsList();
  delete PRODUCTS_BY_ID[id];
  var idx = PRODUCTS.findIndex(function(p){ return p.id === id; });
  if(idx >= 0) PRODUCTS.splice(idx, 1);
  delete project.work[id];
  await store.del('seifstudio:project:' + id, false);
  if(project.productId === id) buildProduct('tee');
}

/* ---------- canvas + vector bake cache (placeholder path only) ---------- */
var mockCanvas = null, mctx = null;
var grainPat = null;
var bakeCache = {};

function init2D(){
  mockCanvas = document.createElement('canvas');
  mockCanvas.width = mockCanvas.height = DS;
  mockCanvas.id = 'mock';
  $('three').appendChild(mockCanvas);
  mctx = mockCanvas.getContext('2d');
  var p = document.createElement('canvas'); p.width = p.height = 96;
  var px = p.getContext('2d');
  for(var y=0; y<96; y++) for(var x=0; x<96; x++){
    var n = fbm(x*0.5, y*0.5);
    var knit = 0.5 + 0.5*Math.sin(x*1.15 + Math.sin(y*0.8)*0.9);
    var v = n*0.6 + knit*0.4;
    px.fillStyle = 'rgba(' + (v>0.5?20:0) + ',' + (v>0.5?22:0) + ',' + (v>0.5?30:2) + ',' + (Math.abs(v-0.5)*0.065) + ')';
    px.fillRect(x,y,1,1);
  }
  grainPat = mctx.createPattern(p, 'repeat');
}

function FITF(){
  if(state.fit === 'slim')      return { w:0.92, l:0.99 };
  if(state.fit === 'oversized') return { w:1.10, l:1.04 };
  return { w:1, l:1 };
}
function currentDef(){ return PRODUCTS_BY_ID[state.product]; }
function viewDefFor(view){ var def = currentDef(); return def.views[view] || def.views.front; }
function hasBackView(){ return !!currentDef().views.back; }

function bakeShading(productId, viewName){
  var key = productId + '|' + viewName + '|' + state.fit;
  if(bakeCache[key]) return bakeCache[key];
  var f = FITF(), def = PRODUCTS_BY_ID[productId], view = def.views[viewName] || def.views.front;
  var shade = document.createElement('canvas'); shade.width = shade.height = DS;
  var sc = shade.getContext('2d');
  sc.save();
  view.outline(sc, f);
  sc.clip();
  sc.fillStyle = '#FFFFFF';
  sc.fillRect(0,0,DS,DS);
  var g = sc.createLinearGradient(0, 0, 0, DS);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(20,22,32,0.035)');
  g.addColorStop(1, 'rgba(20,22,32,0.09)');
  sc.fillStyle = g; sc.fillRect(0,0,DS,DS);
  var gl = sc.createLinearGradient(0, 0, DS, 0);
  gl.addColorStop(0, 'rgba(20,22,32,0.075)');
  gl.addColorStop(0.24, 'rgba(20,22,32,0)');
  gl.addColorStop(0.76, 'rgba(20,22,32,0)');
  gl.addColorStop(1, 'rgba(20,22,32,0.095)');
  sc.fillStyle = gl; sc.fillRect(0,0,DS,DS);
  sc.lineJoin = 'round'; sc.lineCap = 'round';
  sc.strokeStyle = 'rgba(18,20,28,0.07)'; sc.lineWidth = 18; view.outline(sc, f); sc.stroke();
  sc.strokeStyle = 'rgba(18,20,28,0.10)'; sc.lineWidth = 9;  view.outline(sc, f); sc.stroke();
  sc.strokeStyle = 'rgba(18,20,28,0.15)'; sc.lineWidth = 4;  view.outline(sc, f); sc.stroke();
  sc.strokeStyle = 'rgba(15,16,22,0.4)'; sc.lineWidth = 2.25; view.outline(sc, f); sc.stroke();
  var folds = view.folds ? view.folds(f) : [];
  folds.forEach(function(fd){
    airbrush(sc, fd.pts, (fd.w || 22) * 0.62, (fd.a !== undefined ? fd.a : 0.16) * 0.6, 'rgba(14,16,23,');
  });
  if(grainPat){ sc.fillStyle = grainPat; sc.fillRect(0,0,DS,DS); }
  sc.restore();

  var lite = document.createElement('canvas'); lite.width = lite.height = DS;
  var lc = lite.getContext('2d');
  lc.save();
  view.outline(lc, f);
  lc.clip();
  var tg = lc.createLinearGradient(0, 0, 0, DS*0.8);
  tg.addColorStop(0, 'rgba(255,255,255,0.10)');
  tg.addColorStop(1, 'rgba(255,255,255,0)');
  lc.fillStyle = tg; lc.fillRect(0,0,DS,DS);
  folds.forEach(function(fd){
    lc.save(); lc.translate(-6, -7);
    airbrush(lc, fd.pts, (fd.w || 22) * 0.4, (fd.a !== undefined ? fd.a : 0.16) * 0.45, 'rgba(255,255,255,');
    lc.restore();
  });
  lc.restore();

  bakeCache[key] = { shade: shade, lite: lite };
  return bakeCache[key];
}
function airbrush(ctx, pts, w, alpha, rgbPrefix){
  var samples = [];
  for(var i=0;i<pts.length-1;i++){
    var a = pts[i], b = pts[i+1], steps = 7;
    for(var s=0;s<steps;s++){
      var t = s/steps;
      samples.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]);
    }
  }
  samples.push(pts[pts.length-1]);
  var n = samples.length;
  for(var k=0;k<n;k++){
    var taper = Math.sin(Math.PI * (k/(n-1)));
    var r = w * (0.5 + 0.7*taper);
    var av = alpha * (0.3 + 0.85*taper);
    if(r < 1 || av < 0.004) continue;
    var pt = samples[k];
    var rg = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], r);
    rg.addColorStop(0, rgbPrefix + av + ')');
    rg.addColorStop(1, rgbPrefix + '0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, Math.PI*2); ctx.fill();
  }
}

/* ============================================================
   LAYERS — a stack per panel, coordinates in ARTBOARD space
   ============================================================ */
function uid(prefix){ return (prefix || 'l_') + Math.random().toString(36).slice(2, 8); }
function baseLayer(type){
  return { id: uid('l_'), type: type, x:0, y:0, w:0, h:0, rot:0, opacity:1,
           blend:'source-over', visible:true, locked:false, name:'' };
}
function cloneLayer(l){
  var c = {};
  Object.keys(l).forEach(function(k){ c[k] = l[k]; });   /* src (Image/canvas) is shared, everything else is a value */
  return c;
}
function findLayer(panelId, layerId){
  var ls = layersFor(panelId);
  for(var i=0;i<ls.length;i++){ if(ls[i].id === layerId) return { layer: ls[i], index: i }; }
  return null;
}
/* addImageLayer: centred, longest edge 60% of the artboard, aspect preserved */
function addImageLayer(panelId, img, name, srcData, opts){
  var panel = panelById(project.productId, panelId); if(!panel) return null;
  var ab = artboardSize(panel);
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  var s = Math.min(ab.w, ab.h) * 0.6 / Math.max(iw, ih);
  if(Math.max(iw, ih) * s > Math.max(ab.w, ab.h) * 0.6) s = Math.max(ab.w, ab.h) * 0.6 / Math.max(iw, ih);
  var l = baseLayer('image');
  l.src = img; l.srcName = name || 'image'; l.srcW = iw; l.srcH = ih; l.srcHash = srcData ? hashString(srcData) : null;
  l.name = name || 'Image';
  l.w = Math.round(iw * s); l.h = Math.round(ih * s);
  l.x = Math.round((ab.w - l.w) / 2); l.y = Math.round((ab.h - l.h) / 2);
  if(srcData) imageStore[l.srcHash] = srcData;
  if(opts) Object.keys(opts).forEach(function(k){ l[k] = opts[k]; });
  return insertLayer(panelId, l, 'Add image');
}
function addTextLayer(panelId, opts){
  var panel = panelById(project.productId, panelId); if(!panel) return null;
  var ab = artboardSize(panel);
  var l = baseLayer('text');
  l.text = 'YOUR TEXT'; l.font = 'Archivo'; l.weight = 700; l.size = Math.round(Math.min(ab.w * 0.1, ab.h * 0.5));
  l.tracking = 0; l.lineHeight = 1.1; l.align = 'center'; l.fill = '#1E2749'; l.stroke = null; l.strokeW = 0; l.curve = 0;
  l.name = 'Text';
  if(opts) Object.keys(opts).forEach(function(k){ l[k] = opts[k]; });
  var m = textNaturalSize(l);
  l.w = m.w; l.h = m.h;
  if(opts && opts.x === undefined){ l.x = Math.round((ab.w - l.w) / 2); l.y = Math.round((ab.h - l.h) / 2); }
  return insertLayer(panelId, l, 'Add text');
}
function addShapeLayer(panelId, opts){
  var panel = panelById(project.productId, panelId); if(!panel) return null;
  var ab = artboardSize(panel);
  var l = baseLayer('shape');
  l.shape = 'rect'; l.fill = '#C3423F'; l.stroke = null; l.strokeW = 0;
  l.w = Math.round(Math.min(ab.w, ab.h) * 0.4); l.h = l.w;
  l.x = Math.round((ab.w - l.w) / 2); l.y = Math.round((ab.h - l.h) / 2);
  if(opts) Object.keys(opts).forEach(function(k){ l[k] = opts[k]; });
  var sh = SHAPES.filter(function(x){ return x.id === l.shape; })[0];
  l.name = sh ? sh.label : 'Shape';
  return insertLayer(panelId, l, 'Add shape');
}
/* a fill covers the whole panel and sits under everything else on it */
function addFillLayer(panelId, opts){
  var panel = panelById(project.productId, panelId); if(!panel) return null;
  var ab = artboardSize(panel), l = baseLayer('fill');
  l.x = 0; l.y = 0; l.w = ab.w; l.h = ab.h; l.fill = 'solid'; l.c1 = '#1E2749'; l.c2 = '#FFFFFF'; l.angle = 0;
  l.scale = Math.round(4 * ab.pxPerCm); l.seed = Math.floor(Math.random() * 1000) + 1;
  if(opts) Object.keys(opts).forEach(function(k){ l[k] = opts[k]; });
  var f = FILLS.filter(function(x){ return x.id === l.fill; })[0];
  l.name = (f ? f.label : 'Fill') + ' fill';
  var ls = layersFor(panelId), at = 0;
  while(at < ls.length && ls[at].type === 'fill') at++;
  return insertLayer(panelId, l, 'Add fill', at);
}
function insertLayer(panelId, l, label, index){
  var ls = layersFor(panelId);
  if(index === undefined || index > ls.length) index = ls.length;
  ls.splice(index, 0, l);
  hPush({ label: label || 'Add layer',
          undo: function(){ var f = findLayer(panelId, l.id); if(f) layersFor(panelId).splice(f.index, 1); bumpRev(panelId); },
          redo: function(){ layersFor(panelId).splice(Math.min(index, layersFor(panelId).length), 0, l); bumpRev(panelId); } });
  bumpRev(panelId);
  return l;
}
function updateLayer(panelId, layerId, patch, opts){
  var f = findLayer(panelId, layerId); if(!f) return null;
  var l = f.layer, before = {}, after = {};
  Object.keys(patch).forEach(function(k){ before[k] = l[k]; after[k] = patch[k]; l[k] = patch[k]; });
  if(l.type === 'text' && (patch.text !== undefined || patch.font !== undefined || patch.weight !== undefined || patch.size !== undefined ||
     patch.tracking !== undefined || patch.lineHeight !== undefined || patch.curve !== undefined || patch.strokeW !== undefined)){
    var m = textNaturalSize(l);
    before.w = l.w; before.h = l.h;
    var cx = l.x + l.w/2, cy = l.y + l.h/2;
    l.w = m.w; l.h = m.h; l.x = Math.round(cx - m.w/2); l.y = Math.round(cy - m.h/2);
    after.w = l.w; after.h = l.h; after.x = l.x; after.y = l.y; before.x = before.x !== undefined ? before.x : (cx - before.w/2); before.y = before.y !== undefined ? before.y : (cy - before.h/2);
  }
  if(!(opts && opts.silent)){
    hPush({ label: (opts && opts.label) || 'Edit layer',
            undo: function(){ var g = findLayer(panelId, layerId); if(g) Object.keys(before).forEach(function(k){ g.layer[k] = before[k]; }); bumpRev(panelId); },
            redo: function(){ var g = findLayer(panelId, layerId); if(g) Object.keys(after).forEach(function(k){ g.layer[k] = after[k]; }); bumpRev(panelId); } });
  }
  bumpRev(panelId);
  return l;
}
function removeLayer(panelId, layerId){
  var f = findLayer(panelId, layerId); if(!f) return;
  var l = f.layer, idx = f.index;
  layersFor(panelId).splice(idx, 1);
  hPush({ label:'Delete layer',
          undo: function(){ layersFor(panelId).splice(Math.min(idx, layersFor(panelId).length), 0, l); bumpRev(panelId); },
          redo: function(){ var g = findLayer(panelId, layerId); if(g) layersFor(panelId).splice(g.index, 1); bumpRev(panelId); } });
  bumpRev(panelId);
}
function reorderLayer(panelId, layerId, delta){
  var f = findLayer(panelId, layerId); if(!f) return;
  var ls = layersFor(panelId), from = f.index, to = Math.max(0, Math.min(ls.length - 1, from + delta));
  if(from === to) return;
  ls.splice(to, 0, ls.splice(from, 1)[0]);
  hPush({ label:'Reorder layer',
          undo: function(){ var a = layersFor(panelId); a.splice(from, 0, a.splice(to, 1)[0]); bumpRev(panelId); },
          redo: function(){ var a = layersFor(panelId); a.splice(to, 0, a.splice(from, 1)[0]); bumpRev(panelId); } });
  bumpRev(panelId);
}
function moveLayerTo(panelId, layerId, to){
  var f = findLayer(panelId, layerId); if(!f) return;
  reorderLayer(panelId, layerId, to - f.index);
}
function duplicateLayer(panelId, layerId){
  var f = findLayer(panelId, layerId); if(!f) return null;
  var c = cloneLayer(f.layer);
  c.id = uid('l_'); c.x += 24; c.y += 24; c.name = (f.layer.name || f.layer.type) + ' copy';
  return insertLayer(panelId, c, 'Duplicate layer', f.index + 1);
}
function setPanelTechnique(panelId, t){
  var pw = panelWork(panelId), before = pw.technique;
  pw.technique = t;
  hPush({ label:'Print technique', undo:function(){ panelWork(panelId).technique = before; bumpRev(panelId); }, redo:function(){ panelWork(panelId).technique = t; bumpRev(panelId); } });
  bumpRev(panelId);
}

/* ---------- text metrics ---------- */
var _measureCtx = null;
function fontString(l){ return (l.weight || 400) + ' ' + (l.size || 100) + 'px ' + fontFamilyCss(l.font); }
/* design fonts: system ones plus Google Fonts (Latin and Arabic), loaded on first use */
var DESIGN_FONTS = [
  { f:'Archivo', g:'Latin' }, { f:'Bricolage Grotesque', g:'Latin' }, { f:'Bebas Neue', g:'Latin' }, { f:'Anton', g:'Latin' },
  { f:'Bungee', g:'Latin' }, { f:'Black Ops One', g:'Latin' }, { f:'Rubik Mono One', g:'Latin' }, { f:'Righteous', g:'Latin' },
  { f:'Monoton', g:'Latin' }, { f:'Press Start 2P', g:'Latin' }, { f:'Permanent Marker', g:'Latin' }, { f:'Pacifico', g:'Latin' },
  { f:'Lobster', g:'Latin' }, { f:'Caveat', g:'Latin' }, { f:'IBM Plex Mono', g:'Latin' }, { f:'Georgia', g:'Latin' },
  { f:'Impact', g:'Latin' }, { f:'Script', g:'Latin' },
  { f:'Cairo', g:'Arabic' }, { f:'Tajawal', g:'Arabic' }, { f:'Lalezar', g:'Arabic' }, { f:'Reem Kufi', g:'Arabic' },
  { f:'Changa', g:'Arabic' }, { f:'El Messiri', g:'Arabic' }, { f:'Rakkas', g:'Arabic' }, { f:'Aref Ruqaa', g:'Arabic' },
  { f:'Amiri', g:'Arabic' }, { f:'Marhey', g:'Arabic' },
  { f:'Emoji', g:'Emoji' }
];
function fontFamilyCss(f){
  var map = {
    'Archivo': "'Archivo', system-ui, sans-serif",
    'Bricolage Grotesque': "'Bricolage Grotesque', Georgia, serif",
    'IBM Plex Mono': "'IBM Plex Mono', ui-monospace, monospace",
    'Georgia': "Georgia, 'Times New Roman', serif",
    'Impact': "Impact, 'Arial Black', sans-serif",
    'Script': "'Brush Script MT', 'Segoe Script', cursive",
    'Emoji': "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"
  };
  return map[f] || ("'" + f + "', sans-serif");
}
var fontPending = {};
/* canvas text needs the font file first; draw with the fallback now, redraw once it lands */
function ensureFont(l){
  if(!document.fonts || !document.fonts.check) return;
  var f = fontString(l);
  try { if(document.fonts.check(f)) return; } catch(e){ return; }
  if(fontPending[f]) return;
  fontPending[f] = 1;
  document.fonts.load(f, l.text || 'A').then(function(){
    textCache = {}; artboardCache = {};
    refitTextLayers();
    if(typeof onFontsLoaded === 'function') onFontsLoaded();
  }).catch(function(){});
}
/* text boxes measured while a font was still loading have the fallback's width; the height
   does not depend on the font, so keep it and give every text its real width again */
function refitTextLayers(){
  Object.keys(project.work || {}).forEach(function(pid){
    var w = project.work[pid]; if(!w || !w.panels) return;
    Object.keys(w.panels).forEach(function(pk){
      var changed = false;
      (w.panels[pk].layers || []).forEach(function(l){
        if(l.type !== 'text') return;
        var m = textNaturalSize(l); if(!(m.w > 0 && m.h > 0 && l.h > 0)) return;
        var nw = m.w * l.h / m.h;
        if(Math.abs(nw - l.w) < 0.5) return;
        var cx = l.x + l.w / 2; l.w = nw; l.x = cx - nw / 2; changed = true;
      });
      if(!changed) return;
      if(pid === project.productId) bumpRev(pk);
      else { var k = pid + '|' + pk; panelRev[k] = (panelRev[k] || 0) + 1; projectDirty = true; }
    });
  });
}
function textLines(l){ return String(l.text || '').split('\n'); }
function measureLine(ctx, l, line){
  var w = 0, tr = l.tracking || 0;
  if(!tr) return ctx.measureText(line).width;
  for(var i=0;i<line.length;i++) w += ctx.measureText(line[i]).width + (i < line.length-1 ? tr : 0);
  return w;
}
function textNaturalSize(l){
  if(!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  var ctx = _measureCtx; ctx.font = fontString(l);
  var lines = textLines(l), maxW = 1;
  lines.forEach(function(line){ maxW = Math.max(maxW, measureLine(ctx, l, line)); });
  var lh = (l.size || 100) * (l.lineHeight || 1.1);
  var h = lh * lines.length, w = maxW + (l.strokeW || 0) * 2;
  var curve = l.curve || 0;
  if(curve && lines.length === 1){
    /* a bent baseline needs extra height: sagitta of the arc */
    var r = curveRadius(l, maxW);
    var ang = maxW / r;
    var sag = r * (1 - Math.cos(Math.min(Math.PI, ang) / 2));
    h += sag;
    w = Math.max(w, 2 * r * Math.sin(Math.min(Math.PI, ang) / 2) + l.size);
  }
  return { w: Math.ceil(w + 4), h: Math.ceil(h + 4) };
}
function curveRadius(l, width){
  var c = Math.max(1, Math.min(100, Math.abs(l.curve || 0)));
  /* curve 100 -> half circle (radius = width/pi); curve 1 -> nearly flat */
  return width / (Math.PI * (c / 100));
}
/* draw a text layer at its natural size, origin top-left, into ctx */
function drawTextNatural(ctx, l, nat){
  ctx.font = fontString(l);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = l.fill || '#000';
  if(l.fill2){
    var gr = ctx.createLinearGradient(0, 0, 0, nat.h);
    gr.addColorStop(0, l.fill || '#000'); gr.addColorStop(1, l.fill2);
    ctx.fillStyle = gr;
  }
  if(l.shadow && l.shadow.color){
    ctx.shadowColor = l.shadow.color; ctx.shadowBlur = (l.shadow.blur || 0) * (ctx._k || 1);
    ctx.shadowOffsetX = (l.shadow.x || 0) * (ctx._k || 1); ctx.shadowOffsetY = (l.shadow.y || 0) * (ctx._k || 1);
  }
  var stroke = l.stroke && l.strokeW > 0;
  if(stroke){ ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeW; ctx.lineJoin = 'round'; }
  var lines = textLines(l), size = l.size || 100, lh = size * (l.lineHeight || 1.1), tr = l.tracking || 0;
  var curve = l.curve || 0;
  if(curve && lines.length === 1){
    var line = lines[0], width = measureLine(ctx, l, line);
    var r = curveRadius(l, width), dir = curve > 0 ? 1 : -1;
    var total = width / r;
    var cx = nat.w / 2, cy = dir > 0 ? (size + r) : (nat.h - size * 0.3 - r);
    var a = -total / 2;
    ctx.textAlign = 'center';
    for(var i=0;i<line.length;i++){
      var ch = line[i], cw = ctx.measureText(ch).width;
      var mid = a + (cw / 2) / r;
      ctx.save();
      ctx.translate(cx + Math.sin(mid) * r * dir, cy - Math.cos(mid) * r * dir);
      ctx.rotate(mid * dir);
      if(stroke) ctx.strokeText(ch, 0, 0);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a += (cw + tr) / r;
    }
    return;
  }
  lines.forEach(function(line, li){
    var y = size * 0.82 + li * lh + 2, lw = measureLine(ctx, l, line), x;
    if(l.align === 'left') x = 2 + (l.strokeW || 0);
    else if(l.align === 'right') x = nat.w - lw - 2 - (l.strokeW || 0);
    else x = (nat.w - lw) / 2;
    if(!tr){
      ctx.textAlign = 'left';
      if(stroke) ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
    } else {
      ctx.textAlign = 'left';
      for(var i=0;i<line.length;i++){
        if(stroke) ctx.strokeText(line[i], x, y);
        ctx.fillText(line[i], x, y);
        x += ctx.measureText(line[i]).width + tr;
      }
    }
  });
}
/* per-layer raster cache for text (keyed by the properties that change its pixels) */
var textCache = {};
function textLayerKey(l){
  return [l.text, l.font, l.weight, l.size, l.tracking, l.lineHeight, l.align, l.fill, l.fill2, l.stroke, l.strokeW, l.curve,
          l.shadow ? [l.shadow.color, l.shadow.blur, l.shadow.x, l.shadow.y].join(',') : ''].join('|');
}
/* margin around the text box that a shadow or glow needs, in artboard units */
function textPad(l){ return l.shadow && l.shadow.color ? Math.ceil((l.shadow.blur || 0) * 1.5 + Math.max(Math.abs(l.shadow.x || 0), Math.abs(l.shadow.y || 0))) : 0; }
/* rs = raster scale: text is rasterised at the size it is drawn, so print files stay sharp */
function textRaster(l, rs){
  rs = Math.max(0.5, Math.min(12, Math.ceil((rs || 1) * 2) / 2));
  var key = textLayerKey(l) + '@' + rs;
  if(textCache[key]) return textCache[key];
  ensureFont(l);
  var nat = textNaturalSize(l), pad = textPad(l);
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((nat.w + pad * 2) * rs)); c.height = Math.max(1, Math.ceil((nat.h + pad * 2) * rs));
  var g = c.getContext('2d');
  g.scale(rs, rs); g.translate(pad, pad); g._k = rs;
  drawTextNatural(g, l, nat);
  c._nat = nat; c._pad = pad;
  var keys = Object.keys(textCache);
  if(keys.length > 40) delete textCache[keys[0]];
  textCache[key] = c;
  return c;
}

/* ---------- renderArtboard: the single source of truth for a panel's pixels ---------- */
var artboardCache = {}; /* productId|panelId|px|rev|technique -> canvas */
/* l.tile = { gap: spacing multiplier, rot: degrees } repeats the layer across the
   whole artboard (an all-over print). ab = artboard size in artboard units. */
function drawLayer(ctx, l, s, ab){
  if(l.visible === false) return;
  if(l.type === 'fill'){
    if(!ab) return;
    ctx.save();
    ctx.globalAlpha = l.opacity === undefined ? 1 : l.opacity;
    ctx.globalCompositeOperation = l.blend || 'source-over';
    drawFill(ctx, l, ab.w * s, ab.h * s, s);
    ctx.restore();
    return;
  }
  if(l.tile && ab){
    var stepX = l.w * (1 + (l.tile.gap || 0)), stepY = l.h * (1 + (l.tile.gap || 0));
    if(stepX < 8 || stepY < 8) return;
    ctx.save();
    ctx.translate(ab.w/2 * s, ab.h/2 * s);
    ctx.rotate((l.tile.rot || 0) * Math.PI / 180);
    ctx.translate(-ab.w/2 * s, -ab.h/2 * s);
    var reach = Math.max(ab.w, ab.h) * 1.5, one = cloneLayer(l); one.tile = null;
    var x0 = l.x + l.w/2, y0 = l.y + l.h/2;
    var nx = Math.ceil(reach / stepX), ny = Math.ceil(reach / stepY);
    for(var j=-ny;j<=ny;j++) for(var i=-nx;i<=nx;i++){
      var cx = x0 + i*stepX + (j % 2 && l.tile.offset ? stepX/2 : 0), cy = y0 + j*stepY;
      if(cx + l.w < -reach/2 || cy + l.h < -reach/2 || cx - l.w > ab.w + reach/2 || cy - l.h > ab.h + reach/2) continue;
      one.x = cx - l.w/2; one.y = cy - l.h/2;
      drawLayer(ctx, one, s, null);
    }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha = l.opacity === undefined ? 1 : l.opacity;
  ctx.globalCompositeOperation = l.blend || 'source-over';
  ctx.translate((l.x + l.w/2) * s, (l.y + l.h/2) * s);
  ctx.rotate((l.rot || 0) * Math.PI / 180);
  if(l.flipX || l.flipY) ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
  var fl = layerFilter(l, s); if(fl) ctx.filter = fl;
  var w = l.w * s, h = l.h * s;
  if(l.type === 'image' && l.src){
    ctx.drawImage(l.src, -w/2, -h/2, w, h);
  } else if(l.type === 'text'){
    var nat = textNaturalSize(l), k = w / Math.max(1, nat.w), r = textRaster(l, k), pad = (r._pad || 0) * k;
    ctx.drawImage(r, -w/2 - pad, -h/2 - pad, w + pad * 2, h + pad * 2);
  } else if(l.type === 'shape'){
    ctx.fillStyle = l.fill || '#000';
    if(l.fill2){ var sg = ctx.createLinearGradient(0, -h/2, 0, h/2); sg.addColorStop(0, l.fill || '#000'); sg.addColorStop(1, l.fill2); ctx.fillStyle = sg; }
    var stroke = l.stroke && l.strokeW > 0;
    if(stroke){ ctx.strokeStyle = l.stroke; ctx.lineWidth = l.strokeW * s; ctx.lineJoin = 'round'; }
    ctx.beginPath();
    shapePath(ctx, l.shape, w, h);
    ctx.fill(l.shape === 'ring' ? 'evenodd' : 'nonzero');
    if(stroke) ctx.stroke();
  } else if(l.type === 'path'){
    drawPath(ctx, l, s);
  }
  ctx.restore();
}
/* blur is in artboard units, so it looks the same on screen, on the tee and in the 300 DPI file */
function layerFilter(l, s){
  var f = l.fx; if(!f) return '';
  var out = [];
  if(f.brightness !== undefined && f.brightness !== 100) out.push('brightness(' + f.brightness + '%)');
  if(f.contrast !== undefined && f.contrast !== 100) out.push('contrast(' + f.contrast + '%)');
  if(f.saturate !== undefined && f.saturate !== 100) out.push('saturate(' + f.saturate + '%)');
  if(f.hue) out.push('hue-rotate(' + f.hue + 'deg)');
  if(f.gray) out.push('grayscale(' + f.gray + '%)');
  if(f.invert) out.push('invert(' + f.invert + '%)');
  if(f.blur) out.push('blur(' + Math.round(f.blur * (s || 1) * 10) / 10 + 'px)');
  return out.join(' ');
}

/* ---------- sticker shapes: drawn centred in a w x h box ---------- */
var SHAPES = [
  { id:'rect', label:'Square' }, { id:'ellipse', label:'Circle' }, { id:'triangle', label:'Triangle' }, { id:'star', label:'Star' },
  { id:'heart', label:'Heart' }, { id:'bolt', label:'Bolt' }, { id:'burst', label:'Burst' }, { id:'crown', label:'Crown' },
  { id:'flame', label:'Flame' }, { id:'drop', label:'Drop' }, { id:'moon', label:'Moon' }, { id:'sparkle', label:'Sparkle' },
  { id:'arrow', label:'Arrow' }, { id:'speech', label:'Speech' }, { id:'hexagon', label:'Hexagon' }, { id:'ring', label:'Ring' },
  { id:'plus', label:'Plus' }, { id:'diamond', label:'Diamond' }, { id:'line', label:'Line' }
];
function shapePath(ctx, kind, w, h){
  var i, n, a, r;
  function P(x, y){ return [x * w, y * h]; }
  function poly(pts){ pts.forEach(function(q, k){ var p = P(q[0], q[1]); if(k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  switch(kind){
    case 'ellipse': ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI * 2); break;
    case 'line': ctx.rect(-w/2, -Math.max(1, h/2), w, Math.max(2, h)); break;
    case 'triangle': poly([[0, -0.5], [0.5, 0.5], [-0.5, 0.5]]); break;
    case 'diamond': poly([[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]); break;
    case 'hexagon': var hx = []; for(i = 0; i < 6; i++){ a = Math.PI / 3 * i; hx.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]); } poly(hx); break;
    case 'star': case 'burst': case 'sparkle':
      n = kind === 'star' ? 5 : (kind === 'burst' ? 16 : 4);
      var inner = kind === 'star' ? 0.2 : (kind === 'burst' ? 0.36 : 0.12), pts = [];
      for(i = 0; i < n * 2; i++){ a = Math.PI * i / n - Math.PI / 2; r = i % 2 ? inner : 0.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      if(kind === 'sparkle'){
        pts.forEach(function(q, k){ var p = P(q[0], q[1]); if(!k){ ctx.moveTo(p[0], p[1]); return; } var prev = P(pts[k-1][0], pts[k-1][1]); ctx.quadraticCurveTo(0, 0, p[0], p[1]); });
        ctx.quadraticCurveTo(0, 0, P(pts[0][0], pts[0][1])[0], P(pts[0][0], pts[0][1])[1]); ctx.closePath();
      } else poly(pts);
      break;
    case 'heart':
      ctx.moveTo(0, 0.5 * h);
      ctx.bezierCurveTo(-0.62 * w, 0.02 * h, -0.5 * w, -0.52 * h, 0, -0.22 * h);
      ctx.bezierCurveTo(0.5 * w, -0.52 * h, 0.62 * w, 0.02 * h, 0, 0.5 * h); ctx.closePath(); break;
    case 'bolt': poly([[0.1, -0.5], [-0.32, 0.06], [-0.02, 0.06], [-0.12, 0.5], [0.32, -0.08], [0.02, -0.08], [0.18, -0.5]]); break;
    case 'crown': poly([[-0.5, 0.42], [-0.5, -0.32], [-0.25, 0.02], [0, -0.48], [0.25, 0.02], [0.5, -0.32], [0.5, 0.42]]); break;
    case 'flame':
      ctx.moveTo(0, 0.5 * h);
      ctx.bezierCurveTo(-0.5 * w, 0.48 * h, -0.5 * w, -0.05 * h, -0.18 * w, -0.25 * h);
      ctx.bezierCurveTo(-0.12 * w, -0.05 * h, -0.02 * w, -0.02 * h, 0.02 * w, -0.12 * h);
      ctx.bezierCurveTo(0.04 * w, -0.32 * h, -0.02 * w, -0.42 * h, 0.06 * w, -0.5 * h);
      ctx.bezierCurveTo(0.42 * w, -0.3 * h, 0.52 * w, 0.42 * h, 0, 0.5 * h); ctx.closePath(); break;
    case 'drop':
      ctx.moveTo(0, -0.5 * h);
      ctx.bezierCurveTo(0.12 * w, -0.25 * h, 0.5 * w, 0.02 * h, 0.5 * w, 0.18 * h);
      ctx.arc(0, 0.18 * h, 0.5 * Math.min(w, h * 0.64), 0, Math.PI, false);
      ctx.bezierCurveTo(-0.5 * w, 0.02 * h, -0.12 * w, -0.25 * h, 0, -0.5 * h); ctx.closePath(); break;
    case 'moon':
      ctx.ellipse(0, 0, w/2, h/2, 0, Math.PI * 0.5, Math.PI * 1.5, false);
      ctx.ellipse(-0.1 * w, 0, w * 0.32, h / 2, 0, Math.PI * 1.5, Math.PI * 0.5, true); ctx.closePath(); break;
    case 'arrow': poly([[-0.5, -0.14], [0.08, -0.14], [0.08, -0.4], [0.5, 0], [0.08, 0.4], [0.08, 0.14], [-0.5, 0.14]]); break;
    case 'plus': poly([[-0.16, -0.5], [0.16, -0.5], [0.16, -0.16], [0.5, -0.16], [0.5, 0.16], [0.16, 0.16], [0.16, 0.5], [-0.16, 0.5], [-0.16, 0.16], [-0.5, 0.16], [-0.5, -0.16], [-0.16, -0.16]]); break;
    case 'ring': ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI * 2); ctx.moveTo(w * 0.28, 0); ctx.ellipse(0, 0, w * 0.28, h * 0.28, 0, 0, Math.PI * 2); break;
    case 'speech':
      var rr = Math.min(w, h) * 0.18, bw = w, bh = h * 0.78, x0 = -bw/2, y0 = -h/2;
      ctx.moveTo(x0 + rr, y0); ctx.lineTo(x0 + bw - rr, y0); ctx.quadraticCurveTo(x0 + bw, y0, x0 + bw, y0 + rr);
      ctx.lineTo(x0 + bw, y0 + bh - rr); ctx.quadraticCurveTo(x0 + bw, y0 + bh, x0 + bw - rr, y0 + bh);
      ctx.lineTo(-0.05 * w, y0 + bh); ctx.lineTo(-0.28 * w, h / 2); ctx.lineTo(-0.22 * w, y0 + bh);
      ctx.lineTo(x0 + rr, y0 + bh); ctx.quadraticCurveTo(x0, y0 + bh, x0, y0 + bh - rr);
      ctx.lineTo(x0, y0 + rr); ctx.quadraticCurveTo(x0, y0, x0 + rr, y0); ctx.closePath(); break;
    default: ctx.rect(-w/2, -h/2, w, h);
  }
}

/* ---------- brush strokes: points relative to the box centre as first drawn (bw x bh) ---------- */
var BRUSHES = [
  { id:'pen', label:'Pen' }, { id:'marker', label:'Marker' }, { id:'airbrush', label:'Airbrush' },
  { id:'neon', label:'Neon' }, { id:'calligraphy', label:'Calligraphy' }, { id:'dots', label:'Dots' }
];
var _sprites = {};
function softDot(color){
  if(_sprites[color]) return _sprites[color];
  var c = document.createElement('canvas'); c.width = c.height = 64;
  var g = c.getContext('2d'), rgb = hexToRgb(color), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(' + rgb.join(',') + ',1)'); gr.addColorStop(0.45, 'rgba(' + rgb.join(',') + ',0.55)'); gr.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _sprites[color] = c; return c;
}
function seededRandom(seed){ var t = (seed >>> 0) || 1; return function(){ t += 0x6D2B79F5; var r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
function drawPath(ctx, l, s){
  var pts = l.pts || []; if(!pts.length) return;
  var sx = s * l.w / (l.bw || l.w || 1), sy = s * l.h / (l.bh || l.h || 1), k = Math.sqrt(Math.abs(sx * sy));
  ctx.scale(sx, sy);
  var size = l.size || 10, color = l.color || '#1E2749', style = l.style || 'pen';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = size;
  function trace(){
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    if(pts.length === 1){ ctx.lineTo(pts[0][0] + 0.01, pts[0][1]); return; }
    for(var i = 1; i < pts.length - 1; i++){
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }
  if(style === 'marker'){ ctx.lineCap = 'square'; ctx.lineJoin = 'bevel'; trace(); ctx.stroke(); return; }
  if(style === 'dots'){ ctx.setLineDash([0.001, size * 1.9]); trace(); ctx.stroke(); ctx.setLineDash([]); return; }
  if(style === 'neon'){
    ctx.shadowColor = color; ctx.shadowBlur = size * 1.6 * k;
    trace(); ctx.stroke(); ctx.stroke();
    ctx.shadowBlur = size * 0.6 * k; ctx.strokeStyle = mixHex(color, '#FFFFFF', 0.72); ctx.lineWidth = size * 0.38;
    trace(); ctx.stroke();
    ctx.shadowBlur = 0; return;
  }
  if(style === 'calligraphy'){
    var a = -0.7, nx = Math.cos(a) * size / 2, ny = Math.sin(a) * size / 2;
    ctx.fillStyle = color;
    for(var i = 1; i < pts.length; i++){
      var p0 = pts[i - 1], p1 = pts[i];
      ctx.beginPath(); ctx.moveTo(p0[0] + nx, p0[1] + ny); ctx.lineTo(p1[0] + nx, p1[1] + ny); ctx.lineTo(p1[0] - nx, p1[1] - ny); ctx.lineTo(p0[0] - nx, p0[1] - ny); ctx.closePath(); ctx.fill();
    }
    return;
  }
  if(style === 'airbrush'){
    var rnd = seededRandom(l.seed || 7), dot = softDot(color), step = Math.max(0.5, size * 0.16);
    ctx.globalAlpha *= 0.22;
    for(var j = 0; j < pts.length; j++){
      var q0 = pts[Math.max(0, j - 1)], q1 = pts[j], d = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]), n = Math.max(1, Math.ceil(d / step));
      for(var m = 0; m < n; m++){
        var t = j ? m / n : 0, x = q0[0] + (q1[0] - q0[0]) * t, y = q0[1] + (q1[1] - q0[1]) * t;
        for(var e = 0; e < 3; e++){
          var rr = size * (0.35 + rnd() * 0.45), ang = rnd() * Math.PI * 2, off = size * 0.35 * Math.sqrt(rnd());
          ctx.drawImage(dot, x + Math.cos(ang) * off - rr, y + Math.sin(ang) * off - rr, rr * 2, rr * 2);
        }
      }
    }
    return;
  }
  trace(); ctx.stroke();
}

/* ---------- fills: a whole panel in a colour, gradient or pattern ---------- */
var FILLS = [
  { id:'solid', label:'Solid' }, { id:'linear', label:'Gradient' }, { id:'radial', label:'Radial' }, { id:'stripes', label:'Stripes' },
  { id:'dots', label:'Polka dots' }, { id:'checker', label:'Checker' }, { id:'grid', label:'Grid' }, { id:'waves', label:'Waves' },
  { id:'halftone', label:'Halftone' }, { id:'camo', label:'Camo' }, { id:'tiedye', label:'Tie-dye' }
];
function drawFill(ctx, l, W, H, s){
  var c1 = l.c1 || '#1E2749', c2 = l.c2 || '#FFFFFF', c3 = l.c3 || c2, u = Math.max(2, (l.scale || 60) * s), ang = (l.angle || 0) * Math.PI / 180;
  var kind = l.fill || 'solid';
  if(kind === 'solid'){ ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H); return; }
  if(kind === 'linear'){
    var L = Math.abs(W * Math.cos(ang)) + Math.abs(H * Math.sin(ang)), dx = Math.cos(ang) * L / 2, dy = Math.sin(ang) * L / 2;
    var g = ctx.createLinearGradient(W/2 - dx, H/2 - dy, W/2 + dx, H/2 + dy);
    g.addColorStop(0, c1); if(l.c3){ g.addColorStop(0.5, c2); g.addColorStop(1, c3); } else g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
  }
  if(kind === 'radial'){
    var rg = ctx.createRadialGradient(W/2, H * 0.42, 0, W/2, H * 0.42, Math.max(W, H) * 0.72);
    rg.addColorStop(0, c1); if(l.c3){ rg.addColorStop(0.5, c2); rg.addColorStop(1, c3); } else rg.addColorStop(1, c2);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); return;
  }
  ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
  if(kind === 'camo' || kind === 'tiedye'){ ctx.drawImage(noiseFill(kind, c1, c2, c3, W / u, H / u, l.seed || 3), 0, 0, W, H); return; }
  var R = Math.hypot(W, H);
  ctx.save(); ctx.translate(W/2, H/2); ctx.rotate(ang);
  ctx.fillStyle = c2; ctx.strokeStyle = c2;
  var i, j, n = Math.ceil(R / u / 2) + 1;
  if(kind === 'stripes'){ for(i = -n; i <= n; i++) ctx.fillRect(i * u, -R, u / 2, R * 2); }
  else if(kind === 'dots'){ for(j = -n; j <= n; j++) for(i = -n; i <= n; i++){ ctx.beginPath(); ctx.arc(i * u + (j % 2 ? u / 2 : 0), j * u * 0.87, u * 0.27, 0, Math.PI * 2); ctx.fill(); } }
  else if(kind === 'checker'){ for(j = -n; j <= n; j++) for(i = -n; i <= n; i++) if((i + j) % 2 === 0) ctx.fillRect(i * u, j * u, u, u); }
  else if(kind === 'grid'){ ctx.lineWidth = Math.max(1, u * 0.08); for(i = -n; i <= n; i++){ ctx.beginPath(); ctx.moveTo(i * u, -R); ctx.lineTo(i * u, R); ctx.moveTo(-R, i * u); ctx.lineTo(R, i * u); ctx.stroke(); } }
  else if(kind === 'waves'){
    ctx.lineWidth = u * 0.32; ctx.lineCap = 'round';
    for(j = -n; j <= n; j++){ ctx.beginPath(); for(var x = -R; x <= R; x += u / 8){ var y = j * u + Math.sin(x / u * Math.PI * 2) * u * 0.22; if(x === -R) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  }
  else if(kind === 'halftone'){
    for(j = -n; j <= n; j++) for(i = -n; i <= n; i++){
      var t2 = Math.min(1, Math.max(0, (j * u + R / 2) / R)), rr = u * 0.48 * t2;
      if(rr < 0.4) continue;
      ctx.beginPath(); ctx.arc(i * u + (j % 2 ? u / 2 : 0), j * u, rr, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
/* camo blobs and tie-dye swirls: computed small, scaled up smooth */
var _noiseCache = {};
function noiseFill(kind, c1, c2, c3, cellsW, cellsH, seed){
  var key = [kind, c1, c2, c3, Math.round(cellsW * 10), Math.round(cellsH * 10), seed].join('|');
  if(_noiseCache[key]) return _noiseCache[key];
  var gw = 360, gh = Math.max(8, Math.round(gw * cellsH / Math.max(0.01, cellsW))), c = document.createElement('canvas'); c.width = gw; c.height = gh;
  var g = c.getContext('2d'), img = g.createImageData(gw, gh), A = hexToRgb(c1), B = hexToRgb(c2), C = hexToRgb(c3), x, y;
  var f = cellsW / gw, ox = seed * 13.7, oy = seed * 7.3;
  for(y = 0; y < gh; y++) for(x = 0; x < gw; x++){
    var col, i = (y * gw + x) * 4;
    if(kind === 'camo'){
      var n1 = fbm(x * f * 1.3 + ox, y * f * 1.3 + oy), n2 = fbm(x * f * 1.3 + ox + 40, y * f * 1.3 + oy + 40);
      col = n1 > 0.56 ? B : (n2 > 0.58 ? C : (n1 < 0.36 ? mixRgb(A, [0, 0, 0], 0.25) : A));
    } else {
      var cx = x - gw / 2, cy = y - gh / 2, r = Math.hypot(cx, cy) / gw * cellsW, a = Math.atan2(cy, cx);
      var v = 0.5 + 0.5 * Math.sin(a * 3 + r * 2.4 + fbm(x * f + ox, y * f + oy) * 4);
      col = v < 0.5 ? mixRgb(A, B, v * 2) : mixRgb(B, C, (v - 0.5) * 2);
    }
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  var keys = Object.keys(_noiseCache); if(keys.length > 12) delete _noiseCache[keys[0]];
  _noiseCache[key] = c;
  return c;
}
function mixRgb(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
/* exact = {w,h}: force the output pixel size (the 300 DPI exporter computes it from cm
   so a 32x42 cm panel is 3780x4961, not a rounding of the working size) */
function renderArtboard(panelId, px, productId, exact){
  productId = productId || project.productId;
  var panel = panelById(productId, panelId);
  if(!panel) return null;
  var pw = panelWork(panelId, productId);
  var key = productId + '|' + panelId + '|' + px + '|' + getPanelRev(panelId, productId) + '|' + (pw.technique || 'dtg') + (exact ? '|' + exact.w + 'x' + exact.h : '');
  if(artboardCache[key]) return artboardCache[key];
  var ab = artboardSize(panel), s = px / Math.max(ab.w, ab.h);
  var c = document.createElement('canvas');
  c.width = exact ? exact.w : Math.max(1, Math.round(ab.w * s));
  c.height = exact ? exact.h : Math.max(1, Math.round(ab.h * s));
  if(exact) s = Math.max(exact.w / ab.w, exact.h / ab.h);
  var ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  pw.layers.forEach(function(l){ drawLayer(ctx, l, s, ab); });
  if(pw.technique === 'embroidery' && pw.layers.length) applyEmbroidery(c);
  /* one canvas per panel and size: older revisions go (a drag on the 3D tee makes one per frame) */
  var stale = productId + '|' + panelId + '|' + px + '|';
  Object.keys(artboardCache).forEach(function(k){ if(k.indexOf(stale) === 0) delete artboardCache[k]; });
  var keys = Object.keys(artboardCache);
  if(keys.length > 48) delete artboardCache[keys[0]];
  artboardCache[key] = c;
  return c;
}
/* thumbnail with the garment colour behind it (panel sheet cards) */
function renderPanelThumb(panelId, px, color){
  var art = renderArtboard(panelId, px);
  if(!art) return null;
  var c = document.createElement('canvas'); c.width = art.width; c.height = art.height;
  var ctx = c.getContext('2d'), panel = panelById(project.productId, panelId);
  if(panel && panel.outline){ outlinePath(ctx, panel, c.width / panel.w_cm, c.height / panel.h_cm); ctx.clip(); }
  ctx.fillStyle = color || project.garmentColor; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(art, 0, 0);
  return c;
}
/* a pattern piece's cut line as a canvas path, kx/ky = pixels per cm */
function outlinePath(ctx, panel, kx, ky, ox, oy){
  ox = ox || 0; oy = oy || 0;
  ctx.beginPath();
  panel.outline.forEach(function(q, i){ if(i) ctx.lineTo(ox + q[0] * kx, oy + q[1] * ky); else ctx.moveTo(ox + q[0] * kx, oy + q[1] * ky); });
  ctx.closePath();
}

/* ---------- print techniques ---------- */
var THREAD_PALETTE = ['#111111','#FFFFFF','#C3423F','#1D2A44','#2E4FA3','#274D3D','#E0B075','#EFDF9C','#E07A3F','#6E2A35','#B7A6D9','#8FA6C9','#7A7A7A','#D9C7A3','#E8AFC2','#6B6B45'];
var _threadRgb = null;
function applyEmbroidery(c){
  if(!_threadRgb) _threadRgb = THREAD_PALETTE.map(hexToRgb);
  var ctx = c.getContext('2d'), d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for(var i=0;i<p.length;i+=4){
    if(p[i+3] < 100){ p[i+3] = 0; continue; }         /* rejects soft alpha / gradients */
    p[i+3] = 255;
    var best = 0, bd = 1e9;
    for(var k=0;k<_threadRgb.length;k++){
      var t = _threadRgb[k], dd = (p[i]-t[0])*(p[i]-t[0]) + (p[i+1]-t[1])*(p[i+1]-t[1]) + (p[i+2]-t[2])*(p[i+2]-t[2]);
      if(dd < bd){ bd = dd; best = k; }
    }
    p[i] = _threadRgb[best][0]; p[i+1] = _threadRgb[best][1]; p[i+2] = _threadRgb[best][2];
  }
  ctx.putImageData(d, 0, 0);
  /* stitch texture: fine diagonal lines, source-atop */
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
  var step = Math.max(3, Math.round(c.width / 220));
  ctx.beginPath();
  for(var x=-c.height; x<c.width; x+=step){ ctx.moveTo(x, 0); ctx.lineTo(x + c.height, c.height); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  for(var x2=-c.height + step/2; x2<c.width; x2+=step){ ctx.moveTo(x2, 0); ctx.lineTo(x2 + c.height, c.height); }
  ctx.stroke();
  ctx.restore();
}
/* colour count for screen print (quantised to 32 levels), and soft-edge share for vinyl */
function analysePanel(panelId){
  var art = renderArtboard(panelId, 200); if(!art) return { colors:0, softEdge:0, gradients:false };
  var d = art.getContext('2d').getImageData(0, 0, art.width, art.height).data;
  var seen = {}, soft = 0, opaque = 0, colors = 0;
  for(var i=0;i<d.length;i+=4){
    var a = d[i+3];
    if(a === 0) continue;
    if(a < 250) soft++; else opaque++;
    if(a < 128) continue;
    var k = (d[i]>>3) + ',' + (d[i+1]>>3) + ',' + (d[i+2]>>3);
    if(!seen[k]){ seen[k] = 1; colors++; }
  }
  return { colors: colors, softEdge: (soft + opaque) ? soft / (soft + opaque) : 0, gradients: colors > 40 };
}
function techniqueWarnings(panelId){
  var pw = panelWork(panelId), out = [];
  if(!pw.layers.length) return out;
  var t = pw.technique || 'dtg';
  if(t === 'screen'){
    var a = analysePanel(panelId);
    if(a.colors > TECHNIQUES.screen.maxColors) out.push('Screen print: about ' + a.colors + ' colours — more than ' + TECHNIQUES.screen.maxColors + ' screens.');
  } else if(t === 'vinyl'){
    var b = analysePanel(panelId);
    if(b.softEdge > 0.08) out.push('Vinyl: soft alpha edges (' + Math.round(b.softEdge*100) + '% of the print) cannot be cut.');
  } else if(t === 'embroidery'){
    var c = analysePanel(panelId);
    if(c.gradients) out.push('Embroidery: gradients are quantised to the thread palette.');
  }
  return out;
}

/* ---------- resolution ---------- */
function layerDpi(panelId, l){
  if(l.type !== 'image' || !l.srcW) return null;
  var panel = panelById(project.productId, panelId); if(!panel) return null;
  var ab = artboardSize(panel);
  var widthCm = l.w / ab.pxPerCm;
  if(widthCm <= 0) return null;
  return Math.round(l.srcW / (widthCm / 2.54));
}
function dpiGrade(dpi){ if(dpi === null) return null; return dpi >= 300 ? 'good' : (dpi >= 150 ? 'warn' : 'bad'); }
function dpiTip(dpi){
  if(dpi === null) return '';
  if(dpi >= 300) return dpi + ' DPI — prints sharp.';
  if(dpi >= 150) return dpi + ' DPI — fine for DTG at arm’s length, slightly soft up close.';
  return dpi + ' DPI — will print visibly blurred at this size. Use a larger source image or shrink it.';
}
function panelLowestDpi(panelId){
  var worst = null;
  layersFor(panelId).forEach(function(l){ var d = layerDpi(panelId, l); if(d !== null && (worst === null || d < worst)) worst = d; });
  return worst;
}

/* ============================================================
   RECOLOUR — luminance-ramp remap so any dye reads true
   ============================================================ */
var recolorCache = new Map();  /* productId|view|hex|fabric -> canvas, capped at 24 */
function rampLut(base, stats, fabricId){
  var fb = FABRICS[fabricId] || FABRICS.cotton;
  var b = hexToRgb(base);
  var shadow = [b[0]*(1-fb.shadow), b[1]*(1-fb.shadow), b[2]*(1-fb.shadow)];
  var hi = [b[0]+(255-b[0])*fb.highlight, b[1]+(255-b[1])*fb.highlight, b[2]+(255-b[2])*fb.highlight];
  var mid = Math.max(0.05, Math.min(0.95, stats.mid * fb.midScale));
  var p92 = Math.max(mid + 0.02, stats.p92);
  var lut = new Uint8ClampedArray(256 * 3);
  for(var i=0;i<256;i++){
    var L = i / 255, out = [0,0,0], t;
    if(L < mid){ t = L / mid; for(var c=0;c<3;c++) out[c] = shadow[c] + (b[c]-shadow[c]) * t; }
    else { t = (L - mid) / (1 - mid); for(var c2=0;c2<3;c2++) out[c2] = b[c2] + (hi[c2]-b[c2]) * t; }
    if(L > p92){
      /* specular: highlights above the 92nd percentile screened back at fb.spec strength */
      var spec = (L - p92) / (1 - p92) * fb.spec * 255;
      for(var c3=0;c3<3;c3++) out[c3] = 255 - (255 - out[c3]) * (255 - spec) / 255;
    }
    lut[i*3] = out[0]; lut[i*3+1] = out[1]; lut[i*3+2] = out[2];
  }
  return lut;
}
/* returns a canvas the size of the photo, coloured; alpha = original alpha */
function recolorGarment(asset, color, fabricId){
  var key = asset.key + '|' + color + '|' + (fabricId || 'cotton');
  if(recolorCache.has(key)){ var hit = recolorCache.get(key); recolorCache.delete(key); recolorCache.set(key, hit); return hit; }
  var stats = photoStats(asset);
  var lut = rampLut(color, stats, fabricId);
  var c = document.createElement('canvas'); c.width = asset.iw; c.height = asset.ih;
  var ctx = c.getContext('2d'); ctx.drawImage(asset.img, 0, 0);
  var d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for(var i=0;i<p.length;i+=4){
    if(p[i+3] === 0) continue;
    var L = p[i];
    p[i] = lut[L*3]; p[i+1] = lut[L*3+1]; p[i+2] = lut[L*3+2];
  }
  ctx.putImageData(d, 0, 0);
  recolorCache.set(key, c);
  if(recolorCache.size > 24){ var first = recolorCache.keys().next().value; recolorCache.delete(first); }
  return c;
}
/* shade / lite maps derived from the photo, normalised around mid so the
   print picks up the folds without being darkened twice (the fabric already
   has its shading from the ramp). Cached on the asset. */
function photoShadeMaps(asset, fabricId){
  var fb = FABRICS[fabricId] || FABRICS.cotton;
  var k = 'shade|' + fabricId;
  if(asset.shade && asset.shade.k === k) return asset.shade;
  var stats = photoStats(asset), mid = Math.max(0.05, stats.mid * fb.midScale);
  var shade = document.createElement('canvas'); shade.width = asset.iw; shade.height = asset.ih;
  var lite = document.createElement('canvas'); lite.width = asset.iw; lite.height = asset.ih;
  var sc = shade.getContext('2d'), lc = lite.getContext('2d');
  sc.drawImage(asset.img, 0, 0);
  var d = sc.getImageData(0, 0, asset.iw, asset.ih), p = d.data;
  var ld = lc.createImageData(asset.iw, asset.ih), q = ld.data;
  for(var i=0;i<p.length;i+=4){
    var L = p[i] / 255, a = p[i+3];
    var m = L < mid ? (L / mid) : 1;                            /* darken only */
    m = Math.round(255 * (0.15 + 0.85 * m));
    p[i] = p[i+1] = p[i+2] = m; p[i+3] = a;
    var h = L > mid ? (L - mid) / (1 - mid) * 0.35 : 0;         /* soft highlight */
    if(L > stats.p92) h += (L - stats.p92) / (1 - stats.p92) * fb.spec * 0.6;
    var hv = Math.round(255 * Math.min(1, h));
    q[i] = q[i+1] = q[i+2] = hv; q[i+3] = a;
  }
  sc.putImageData(d, 0, 0); lc.putImageData(ld, 0, 0);
  asset.shade = { k: k, shade: shade, lite: lite };
  return asset.shade;
}
/* displacement field: blurred luminance gradient, at a reduced resolution */
function photoDisplacement(asset){
  if(asset.disp) return asset.disp;
  var W = 320, H = Math.max(2, Math.round(320 * asset.ih / asset.iw));
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var ctx = c.getContext('2d');
  ctx.filter = 'blur(3px)';
  ctx.drawImage(asset.img, 0, 0, W, H);
  var d = ctx.getImageData(0, 0, W, H).data;
  var gx = new Float32Array(W*H), gy = new Float32Array(W*H);
  for(var y=1;y<H-1;y++) for(var x=1;x<W-1;x++){
    var i = y*W + x;
    gx[i] = (d[(i+1)*4] - d[(i-1)*4]) / 510;
    gy[i] = (d[(i+W)*4] - d[(i-W)*4]) / 510;
  }
  asset.disp = { w:W, h:H, gx:gx, gy:gy };
  return asset.disp;
}

/* ============================================================
   MAPPING — artboard rectangle onto a quad, 24x24 affine cells
   ============================================================ */
var GRID = 24;
function drawImageToQuad(ctx, img, quad, scale){
  var iw = img.width, ih = img.height, N = GRID, ov = 0.5;
  var cw = iw / N, ch = ih / N;
  var q = quad.map(function(p){ return [p[0]*scale, p[1]*scale]; });
  for(var j=0;j<N;j++){
    for(var i=0;i<N;i++){
      var u0 = i/N, u1 = (i+1)/N, v0 = j/N, v1 = (j+1)/N;
      var d0 = quadPoint(q, u0, v0), d1 = quadPoint(q, u1, v0), d2 = quadPoint(q, u1, v1), d3 = quadPoint(q, u0, v1);
      var a = (d1[0]-d0[0])/cw, b = (d1[1]-d0[1])/cw, c = (d3[0]-d0[0])/ch, dd = (d3[1]-d0[1])/ch;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d2[0], d2[1]); ctx.lineTo(d3[0], d3[1]); ctx.closePath();
      ctx.clip();
      ctx.setTransform(a, b, c, dd, d0[0], d0[1]);
      /* local space: (0,0) is source pixel (sx,sy); overdraw ov px on every side */
      var sx = i*cw, sy = j*ch;
      var x0 = Math.max(0, sx-ov), y0 = Math.max(0, sy-ov);
      var x1 = Math.min(iw, sx+cw+ov), y1 = Math.min(ih, sy+ch+ov);
      ctx.drawImage(img, x0, y0, x1-x0, y1-y0, x0-sx, y0-sy, x1-x0, y1-y0);
      ctx.restore();
    }
  }
}
function artPxForQuad(panel, quad, scale){
  var ab = artboardSize(panel);
  var top = quadEdgeLen(quad[0], quad[1]) * scale, left = quadEdgeLen(quad[0], quad[3]) * scale;
  var need = Math.max(top * Math.max(ab.w, ab.h) / ab.w, left * Math.max(ab.w, ab.h) / ab.h);
  return Math.max(256, Math.min(2400, Math.ceil(need / 128) * 128));
}
/* the mapped, silhouette-clipped, shaded artwork for a view — cached while
   no panel changes, so colour changes only re-tint the base */
var mappedCache = {};
function mappedArtwork(productId, view, px, asset){
  var scale = px / DS;
  var placements = placementsFor(productId, view);
  var revs = placements.map(function(pl){ return pl.panel + ':' + getPanelRev(pl.panel, productId); }).join(',');
  var key = productId + '|' + view + '|' + px + '|' + revs + '|' + (asset ? asset.key : 'vec') + '|' + state.fabric + '|' + (state.followFabric ? state.followStrength : 0) + '|' + state.fit;
  if(mappedCache[key]) return mappedCache[key];
  var art = document.createElement('canvas'); art.width = art.height = px;
  var ctx = art.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  var any = false;
  placements.forEach(function(pl){
    var panel = panelById(productId, pl.panel); if(!panel) return;
    if(!layersFor(pl.panel, productId).some(function(l){ return l.visible !== false; })) return;
    var ab = renderArtboard(pl.panel, artPxForQuad(panel, pl.quad, scale), productId);
    if(!ab) return;
    any = true;
    drawImageToQuad(ctx, ab, pl.quad, scale);
  });
  ctx.setTransform(1,0,0,1,0,0);
  if(any){
    if(asset && state.followFabric && state.followStrength > 0) displaceArt(art, asset, state.followStrength * scale);
    /* clip to the fabric silhouette */
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    if(asset){ var pl2 = asset.place; ctx.drawImage(asset.img, pl2.dx*scale, pl2.dy*scale, pl2.dw*scale, pl2.dh*scale); }
    else { ctx.scale(scale, scale); viewDefFor(view).outline(ctx, FITF()); ctx.fill(); }
    ctx.restore();
    /* shade with the real folds: multiply shade map, screen highlights, keep art alpha */
    var alphaCopy = document.createElement('canvas'); alphaCopy.width = alphaCopy.height = px;
    alphaCopy.getContext('2d').drawImage(art, 0, 0);
    ctx.save();
    if(asset){
      var maps = photoShadeMaps(asset, state.fabric), p = asset.place;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(maps.shade, p.dx*scale, p.dy*scale, p.dw*scale, p.dh*scale);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(maps.lite, p.dx*scale, p.dy*scale, p.dw*scale, p.dh*scale);
    } else {
      var baked = bakeShading(productId, view);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(baked.shade, 0, 0, px, px);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(baked.lite, 0, 0, px, px);
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(alphaCopy, 0, 0);
    ctx.restore();
  }
  var keys = Object.keys(mappedCache);
  if(keys.length > 12) delete mappedCache[keys[0]];
  mappedCache[key] = art;
  return art;
}
/* offset the artwork sampling along the luminance gradient ("Follow the fabric") */
function displaceArt(art, asset, strengthPx){
  var disp = photoDisplacement(asset), px = art.width, p = asset.place, scale = px / DS;
  var ctx = art.getContext('2d');
  var src = ctx.getImageData(0, 0, px, px), out = ctx.createImageData(px, px);
  var s = src.data, o = out.data;
  var ox = p.dx*scale, oy = p.dy*scale, sw = p.dw*scale, sh = p.dh*scale;
  for(var y=0;y<px;y++){
    var fy = (y - oy) / sh; if(fy < 0 || fy >= 1) continue;
    var gyRow = Math.min(disp.h-1, Math.max(0, Math.floor(fy * disp.h))) * disp.w;
    for(var x=0;x<px;x++){
      var fx = (x - ox) / sw; if(fx < 0 || fx >= 1) continue;
      var gi = gyRow + Math.min(disp.w-1, Math.max(0, Math.floor(fx * disp.w)));
      var dx = disp.gx[gi] * strengthPx, dy = disp.gy[gi] * strengthPx;
      var sx = Math.round(x + dx), sy = Math.round(y + dy);
      if(sx < 0 || sy < 0 || sx >= px || sy >= px) continue;
      var si = (sy*px + sx)*4, oi = (y*px + x)*4;
      o[oi] = s[si]; o[oi+1] = s[si+1]; o[oi+2] = s[si+2]; o[oi+3] = s[si+3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

/* ============================================================
   COMPOSITE — the assembled garment for one view
   opts: { px, bg:'transparent'|'studio', watermark, debug, color }
   ============================================================ */
function compositeView(productId, view, opts){
  opts = opts || {};
  var px = opts.px || DS, scale = px / DS;
  var color = opts.color || project.garmentColor;
  var out = document.createElement('canvas'); out.width = out.height = px;
  var ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if(opts.bg === 'studio'){
    var g = ctx.createRadialGradient(px*0.5, px*0.42, px*0.1, px*0.5, px*0.5, px*0.8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ECEDE8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, px, px);
  }
  var asset = getPhotoAsset(productId, view);
  var savedColor = state.color; state.color = color;
  if(opts.bg === 'studio'){
    /* soft contact shadow: the silhouette in ink, blurred, nudged down */
    var sil = document.createElement('canvas'); sil.width = sil.height = px;
    var sc = sil.getContext('2d');
    if(asset){ var pp = asset.place; sc.drawImage(asset.img, pp.dx*scale, pp.dy*scale, pp.dw*scale, pp.dh*scale); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#1E2749'; sc.fillRect(0, 0, px, px); }
    else { sc.scale(scale, scale); viewDefFor(view).outline(sc, FITF()); sc.fillStyle = '#1E2749'; sc.fill(); }
    ctx.save();
    ctx.filter = 'blur(' + Math.round(px*0.02) + 'px)';
    ctx.globalAlpha = 0.28;
    ctx.drawImage(sil, 0, px*0.03);
    ctx.restore();
  }
  /* 1. garment base */
  if(asset){
    var base = recolorGarment(asset, color, state.fabric), p = asset.place;
    ctx.drawImage(base, p.dx*scale, p.dy*scale, p.dw*scale, p.dh*scale);
  } else {
    ctx.save(); ctx.scale(scale, scale);
    viewDefFor(view).paint(ctx, palette(), FITF());
    ctx.restore();
    var baked = bakeShading(productId, view);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(baked.shade, 0, 0, px, px);
    ctx.globalCompositeOperation = 'screen';   ctx.drawImage(baked.lite, 0, 0, px, px);
    ctx.restore();
  }
  /* 2-5. mapped, clipped, shaded artwork */
  var art = mappedArtwork(productId, view, px, asset);
  ctx.drawImage(art, 0, 0);
  state.color = savedColor;
  if(!asset && opts.stamp !== false) drawPlaceholderStamp(ctx, px);
  if(opts.watermark) drawWatermark(ctx, px);
  if(opts.debug || DEBUG) drawDebugOverlay(ctx, productId, view, scale);
  return out;
}
function drawPlaceholderStamp(ctx, px){
  var s = (px || DS) / DS;
  ctx.save();
  ctx.scale(s, s);
  ctx.font = '600 26px "IBM Plex Mono", ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  var txt = 'PLACEHOLDER — NO PHOTO UPLOADED';
  var w = ctx.measureText(txt).width + 36;
  ctx.fillStyle = 'rgba(30,39,73,0.82)';
  ctx.fillRect(DS - 40 - w, DS - 40 - 46, w, 46);
  ctx.fillStyle = '#FBFBF7';
  ctx.fillText(txt, DS - 58, DS - 52);
  ctx.restore();
}
function drawWatermark(ctx, px){
  ctx.save();
  ctx.font = '700 ' + Math.round(px*0.022) + 'px "Bricolage Grotesque", Georgia, serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(30,39,73,0.55)';
  ctx.fillText('SEIF STUDIO · preview', px*0.03, px*0.975);
  ctx.restore();
}
function drawDebugOverlay(ctx, productId, view, scale){
  ctx.save();
  ctx.lineWidth = 2; ctx.font = '600 22px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
  placementsFor(productId, view).forEach(function(pl){
    var q = pl.quad.map(function(p){ return [p[0]*scale, p[1]*scale]; });
    ctx.strokeStyle = '#C3423F'; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for(var i=1;i<4;i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = 'rgba(195,66,63,0.6)'; ctx.setLineDash([8,6]);
    ctx.beginPath();
    var s0 = quadPoint(q, .05, .05), s1 = quadPoint(q, .95, .05), s2 = quadPoint(q, .95, .95), s3 = quadPoint(q, .05, .95);
    ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]); ctx.lineTo(s3[0], s3[1]); ctx.closePath(); ctx.stroke();
    var c = quadCentre(q);
    ctx.fillStyle = 'rgba(30,39,73,0.8)'; ctx.fillRect(c[0]-60, c[1]-16, 120, 30);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(pl.panel, c[0], c[1]);
  });
  ctx.restore();
}

/* ---------------- preview render (rAF-debounced) ---------------- */
var renderQueued = false;
function requestRender(){
  if(renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(function(){ renderQueued = false; render(); });
}
function render(){
  if(!mctx || !currentDef()) return;
  var t0 = performance.now();
  var c = compositeView(project.productId, state.view, { px: DS });
  mctx.clearRect(0, 0, DS, DS);
  mctx.drawImage(c, 0, 0);
  lastRenderMs = performance.now() - t0;
  if(typeof onRendered === 'function') onRendered(lastRenderMs);
}
var lastRenderMs = 0;
function applyColors(){ recolorCacheTouch(); requestRender(); if(typeof onProjectChanged === 'function') onProjectChanged(null); }
function recolorCacheTouch(){ /* recolour is cached per hex; nothing to invalidate */ }
function setGarmentColor(hex){
  var before = project.garmentColor;
  if(before === hex) return;
  project.garmentColor = hex; state.color = hex;
  hPush({ label:'Garment colour', undo:function(){ project.garmentColor = before; state.color = before; applyColors(); }, redo:function(){ project.garmentColor = hex; state.color = hex; applyColors(); } });
  projectDirty = true; scheduleAutosave();
  applyColors();
}
function setFabric(id){
  if(!FABRICS[id]) return;
  state.fabric = id; project.fabric = id;
  mappedCache = {};
  projectDirty = true; scheduleAutosave();
  requestRender();
}

/* ---------------- product ---------------- */
function availableViews(productId){
  var def = PRODUCTS_BY_ID[productId];
  var out = [];
  VIEWS.forEach(function(v){
    var hasPhoto = !!getPhotoAsset(productId, v.id);
    var hasVector = def && def.views && !!def.views[v.id] && (v.id === 'front' || v.id === 'back');
    if(hasPhoto || hasVector) out.push(v);
  });
  return out;
}
/* views on the turntable that exist for this product, ordered by angle */
function turntableViews(productId){
  return availableViews(productId).filter(function(v){ return v.angle !== null; }).sort(function(a, b){ return a.angle - b.angle; });
}
function turnView(delta){
  var vs = turntableViews(project.productId); if(vs.length < 2) return null;
  var i = -1; vs.forEach(function(v, k){ if(v.id === state.view) i = k; });
  if(i < 0) i = 0;
  return vs[((i + delta) % vs.length + vs.length) % vs.length].id;
}
/* Switching product keeps every product's work; only "New project" clears it. */
function buildProduct(id){
  var def = PRODUCTS_BY_ID[id];
  if(!def) return;
  bindProjectProduct(id);
  VIEWS.forEach(function(v){ getPhotoAsset(id, v.id); placementsFor(id, v.id); });
  var views = availableViews(id);
  if(!views.some(function(v){ return v.id === state.view; })) state.view = views.length ? views[0].id : 'front';
  state.panel = null;
  /* only a project with actual work is worth saving — never overwrite a saved
     design with an empty one just because a garment was clicked */
  if(Object.keys(project.work).some(productHasWork)){ projectDirty = true; scheduleAutosave(); }
  if(typeof onProductChanged === 'function') onProductChanged(id);
  requestRender();
}
function newProject(){
  project.work = {}; panelRev = {}; artboardCache = {}; mappedCache = {};
  project.garmentColor = '#FAFAF7'; state.color = project.garmentColor; project.fabricNote = '';
  hist.undo = []; hist.redo = []; hist.tx = null;
  bindProjectProduct(project.productId);
  projectDirty = false;
  if(typeof onProductChanged === 'function') onProductChanged(project.productId);
  if(typeof onHistoryChanged === 'function') onHistoryChanged();
  requestRender();
}

/* ============================================================
   HISTORY — command stack with coalesced gestures
   ============================================================ */
var hist = { undo: [], redo: [], tx: null, cap: 60 };
function hPush(entry){
  if(hist.tx){ hist.tx.entries.push(entry); return; }
  hist.undo.push(entry);
  if(hist.undo.length > hist.cap) hist.undo.shift();
  hist.redo = [];
  if(typeof onHistoryChanged === 'function') onHistoryChanged();
}
/* open a transaction on pointerdown / slider start; every mutation until commit
   collapses into one undo entry */
function hBegin(label){
  if(hist.tx) return;
  hist.tx = { label: label, entries: [] };
}
function hCommit(){
  var tx = hist.tx; hist.tx = null;
  if(!tx || !tx.entries.length) return;
  var es = tx.entries;
  /* keep only the first "before" and last "after" of the same layer by replaying in order */
  hPush({ label: tx.label,
          undo: function(){ for(var i=es.length-1;i>=0;i--) es[i].undo(); },
          redo: function(){ for(var i=0;i<es.length;i++) es[i].redo(); } });
}
function hCancel(){ hist.tx = null; }
function undo(){
  hCancel();
  var e = hist.undo.pop(); if(!e) return;
  e.undo(); hist.redo.push(e);
  if(typeof onHistoryChanged === 'function') onHistoryChanged();
}
function redo(){
  hCancel();
  var e = hist.redo.pop(); if(!e) return;
  e.redo(); hist.undo.push(e);
  if(typeof onHistoryChanged === 'function') onHistoryChanged();
}
function undoLabel(){ var e = hist.undo[hist.undo.length-1]; return e ? e.label : null; }
function redoLabel(){ var e = hist.redo[hist.redo.length-1]; return e ? e.label : null; }

/* ============================================================
   PERSISTENCE — project.json, autosave, image store
   ============================================================ */
var imageStore = {};   /* hash -> data URL, for image layers loaded this session */
var projectDirty = false;
var autosaveTimer = null;
function hashString(s){
  var h = 5381, i = s.length;
  while(i) h = (h * 33) ^ s.charCodeAt(--i);
  return (h >>> 0).toString(36) + '_' + s.length.toString(36);
}
function serialiseLayer(l, inline){
  var o = {};
  Object.keys(l).forEach(function(k){ if(k !== 'src') o[k] = l[k]; });
  if(l.type === 'image'){
    var data = l.srcHash && imageStore[l.srcHash];
    if(!data && l.src){ try { data = canvasDataUrl(l.src); l.srcHash = hashString(data); imageStore[l.srcHash] = data; o.srcHash = l.srcHash; } catch(e){} }
    if(inline) o.srcData = data || null;
  }
  return o;
}
function canvasDataUrl(src){
  if(src instanceof HTMLCanvasElement) return src.toDataURL('image/png');
  var c = document.createElement('canvas'); c.width = src.naturalWidth || src.width; c.height = src.naturalHeight || src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c.toDataURL('image/png');
}
function serialiseProject(inlineImages){
  var work = {};
  Object.keys(project.work).forEach(function(pid){
    var w = project.work[pid], panels = {};
    Object.keys(w.panels).forEach(function(k){
      panels[k] = { technique: w.panels[k].technique || 'dtg', layers: w.panels[k].layers.map(function(l){ return serialiseLayer(l, inlineImages); }) };
    });
    work[pid] = { panels: panels };
  });
  return { version: PROJECT_VERSION, savedAt: Date.now(), productId: project.productId, garmentColor: project.garmentColor,
           fabric: project.fabric, fabricNote: project.fabricNote, work: work };
}
function loadImageFromData(data){
  return new Promise(function(res){ var img = new Image(); img.onload = function(){ res(img); }; img.onerror = function(){ res(null); }; img.src = data; });
}
/* restore a serialised project; images from inline srcData or the image store.
   Fails loudly on a version mismatch rather than half-loading. */
/* v4 designed the tee on print-area rectangles (front/back 32x42 cm, sleeves 10x9 cm); v5 designs
   on the whole pattern piece. Old layers keep their real size and land where the print area sat. */
var V4_TEE_AREAS = { front: { w:32, h:42, top:11 }, back: { w:32, h:42, top:7 }, sleeve_l: { w:10, h:9, top:3.5 }, sleeve_r: { w:10, h:9, top:3.5 } };
function migrateV4(obj){
  var tee = obj.work && obj.work.tee;
  if(tee && tee.panels) Object.keys(tee.panels).forEach(function(pk){
    var area = V4_TEE_AREAS[pk], piece = panelById('tee', pk); if(!area || !piece) return;
    var oldK = PANEL_PX / Math.max(area.w, area.h), newK = artboardSize(piece).pxPerCm, r = newK / oldK;
    var ox = (piece.w_cm - area.w) / 2, oy = area.top;
    (tee.panels[pk].layers || []).forEach(function(l){
      l.x = Math.round((l.x / oldK + ox) * newK); l.y = Math.round((l.y / oldK + oy) * newK);
      l.w = Math.max(1, Math.round(l.w * r)); l.h = Math.max(1, Math.round(l.h * r));
      if(l.size) l.size = Math.max(4, Math.round(l.size * r));
      if(l.strokeW) l.strokeW = Math.round(l.strokeW * r * 10) / 10;
      if(l.tracking) l.tracking = Math.round(l.tracking * r * 10) / 10;
    });
  });
  obj.version = 5;
  return obj;
}
async function restoreProject(obj){
  if(obj && obj.version === 4) obj = migrateV4(JSON.parse(JSON.stringify(obj)));
  if(!obj || obj.version !== PROJECT_VERSION) throw new Error('This project file is version ' + (obj && obj.version) + '; this build reads version ' + PROJECT_VERSION + '.');
  var work = {};
  var pids = Object.keys(obj.work || {});
  for(var a=0;a<pids.length;a++){
    var pid = pids[a], src = obj.work[pid], panels = {};
    var pks = Object.keys(src.panels || {});
    for(var b=0;b<pks.length;b++){
      var pk = pks[b], layers = [];
      var ls = src.panels[pk].layers || [];
      for(var c=0;c<ls.length;c++){
        var l = cloneLayer(ls[c]);
        if(l.type === 'image'){
          var data = l.srcData || (l.srcHash ? (imageStore[l.srcHash] || await store.get('seifstudio:img:' + l.srcHash, false)) : null);
          if(data && data.data) data = data.data;
          delete l.srcData;
          if(!data) throw new Error('Image "' + (l.srcName || l.id) + '" is missing from storage; the project cannot be restored.');
          var img = await loadImageFromData(data);
          if(!img) throw new Error('Image "' + (l.srcName || l.id) + '" could not be decoded.');
          l.src = img; l.srcHash = l.srcHash || hashString(data); imageStore[l.srcHash] = data;
        }
        layers.push(l);
      }
      panels[pk] = { technique: src.panels[pk].technique || 'dtg', layers: layers };
    }
    work[pid] = { panels: panels };
  }
  project.work = work;
  project.garmentColor = obj.garmentColor || '#FAFAF7'; state.color = project.garmentColor;
  project.fabric = obj.fabric || 'cotton'; state.fabric = project.fabric;
  project.fabricNote = obj.fabricNote || '';
  panelRev = {}; artboardCache = {}; mappedCache = {};
  hist.undo = []; hist.redo = []; hist.tx = null;
  var pid2 = PRODUCTS_BY_ID[obj.productId] ? obj.productId : 'tee';
  bindProjectProduct(pid2);
  Object.keys(work).forEach(function(pid){ Object.keys(work[pid].panels).forEach(function(pk){ panelRev[pid + '|' + pk] = 1; }); });
  projectDirty = false;
  if(typeof onProductChanged === 'function') onProductChanged(pid2);
  if(typeof onHistoryChanged === 'function') onHistoryChanged();
  requestRender();
}
function scheduleAutosave(){
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(autosaveNow, 2000);
}
var K_PROJECT_INDEX = 'seifstudio:project:index';
async function autosaveNow(){
  if(!projectDirty) return;
  if(!Object.keys(project.work).some(productHasWork)) return;
  var data = serialiseProject(false);
  /* each image under its own key, referenced by hash */
  var hashes = {};
  Object.keys(project.work).forEach(function(pid){ Object.keys(project.work[pid].panels).forEach(function(pk){
    project.work[pid].panels[pk].layers.forEach(function(l){ if(l.type === 'image' && l.srcHash) hashes[l.srcHash] = 1; }); }); });
  var hs = Object.keys(hashes);
  for(var i=0;i<hs.length;i++){
    if(imageStore[hs[i]] && !savedImages[hs[i]]){
      var r = await store.set('seifstudio:img:' + hs[i], { data: imageStore[hs[i]] }, false);
      if(!r.ok) return;
      savedImages[hs[i]] = 1;
    }
  }
  var r2 = await store.set('seifstudio:project:' + project.productId, data, false);
  if(!r2.ok) return;
  var def = PRODUCTS_BY_ID[project.productId];
  await store.set(K_PROJECT_INDEX, { productId: project.productId, productName: def ? def.name : project.productId, savedAt: data.savedAt, hashes: hs }, false);
  projectDirty = false;
  if(typeof onAutosaved === 'function') onAutosaved(data.savedAt);
}
var savedImages = {};
async function loadSavedProjectIndex(){ return store.get(K_PROJECT_INDEX, false); }
async function restoreSavedProject(productId){
  var obj = await store.get('seifstudio:project:' + productId, false);
  if(!obj) throw new Error('No saved project found.');
  await restoreProject(obj);
}
/* drop unreferenced images when a project is deleted */
async function deleteSavedProject(productId){
  var idx = await store.get(K_PROJECT_INDEX, false);
  await store.del('seifstudio:project:' + productId, false);
  if(idx && idx.productId === productId){
    (idx.hashes || []).forEach(function(h){ store.del('seifstudio:img:' + h, false); delete savedImages[h]; });
    await store.del(K_PROJECT_INDEX, false);
  }
}
window.addEventListener('beforeunload', function(e){
  if(projectDirty){ e.preventDefault(); e.returnValue = ''; }
});

/* ============================================================
   EXPORT helpers (UI in p5_ui.js)
   ============================================================ */
function printPxFor(panel){
  var w = Math.round(panel.w_cm / 2.54 * 300), h = Math.round(panel.h_cm / 2.54 * 300), capped = false;
  var m = Math.max(w, h);
  if(m > 6000){ var s = 6000 / m; w = Math.round(w*s); h = Math.round(h*s); capped = true; }
  return { w:w, h:h, px: Math.max(w, h), capped: capped, dpi: Math.round(Math.max(w, h) / (Math.max(panel.w_cm, panel.h_cm) / 2.54)) };
}
function canvasToBlob(c){
  return new Promise(function(res){ if(c.toBlob) c.toBlob(res, 'image/png'); else res(null); });
}
function safeName(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
async function downloadCanvas(c, name){
  var blob = await canvasToBlob(c);
  var url = blob ? URL.createObjectURL(blob) : c.toDataURL('image/png');
  downloadUrl(url, name);
  if(blob) setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
}
function downloadUrl(url, name){
  var a = document.createElement('a'); a.download = name; a.href = url;
  document.body.appendChild(a); a.click(); a.remove();
}
function downloadText(text, name, mime){
  var blob = new Blob([text], { type: mime || 'application/json' });
  var url = URL.createObjectURL(blob);
  downloadUrl(url, name);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
}
/* contact sheet: the current design across every garment colour */
function renderContactSheet(view, cell){
  cell = cell || 520;
  var cols = Math.min(4, GARMENT_COLORS.length), rows = Math.ceil(GARMENT_COLORS.length / cols);
  var pad = 24, label = 44;
  var c = document.createElement('canvas');
  c.width = cols * (cell + pad) + pad; c.height = rows * (cell + label + pad) + pad;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#ECEDE8'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '600 15px "IBM Plex Mono", monospace'; ctx.fillStyle = '#1E2749'; ctx.textBaseline = 'top';
  GARMENT_COLORS.forEach(function(col, i){
    var x = pad + (i % cols) * (cell + pad), y = pad + Math.floor(i / cols) * (cell + label + pad);
    ctx.fillStyle = '#FBFBF7'; ctx.fillRect(x, y, cell, cell + label);
    var m = compositeView(project.productId, view, { px: cell, color: col.hex, stamp:false });
    ctx.drawImage(m, x, y);
    ctx.fillStyle = col.hex; ctx.fillRect(x + 12, y + cell + 12, 20, 20);
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.strokeRect(x + 12.5, y + cell + 12.5, 19, 19);
    ctx.fillStyle = '#1E2749';
    ctx.fillText(col.name.toUpperCase() + '  ' + col.hex.toUpperCase() + (col.tcx ? '  TCX ' + col.tcx : ''), x + 42, y + cell + 14);
  });
  return c;
}
