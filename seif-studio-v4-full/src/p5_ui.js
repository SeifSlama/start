/* ============================================================
   SEIF STUDIO — UI wiring: rack, swatches, modes, gate/access,
   admin (invites · photos · panel mapping · colours), my products,
   export, resume/autosave strip, bottom sheet, boot
   ============================================================ */

var CATS = ['Tops','Bottoms','Hats','Socks','Bags','Accessories'];

/* ---------- small helpers ---------- */
function inlineErr(afterEl, msg){
  var host = typeof afterEl === 'string' ? $(afterEl) : afterEl;
  if(!host) return;
  var e = host.nextElementSibling;
  if(!e || !e.classList.contains('inlineerr')){
    e = document.createElement('div'); e.className = 'inlineerr';
    host.parentNode.insertBefore(e, host.nextSibling);
  }
  e.textContent = msg || '';
}
function gmsg(id, txt, ok){
  var el = $(id); if(!el) return;
  el.textContent = txt;
  el.className = 'gmsg ' + (ok ? 'ok' : 'err');
}
function fmtTime(ts){
  var d = new Date(ts), now = new Date();
  var same = d.toDateString() === now.toDateString();
  return (same ? 'today' : d.toLocaleDateString()) + ' at ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
/* modals: open with focus trap, close returns focus to the trigger */
var modalTrigger = {};
function openModal(id){
  var m = $(id); if(!m) return;
  modalTrigger[id] = document.activeElement;
  m.classList.add('on');
  var f = m.querySelector('input:not([type=hidden]):not(.hidden), button:not(.x), select, textarea');
  if(f) setTimeout(function(){ try { f.focus(); } catch(e){} }, 30);
}
function closeModal(id){
  var m = $(id); if(!m) return;
  m.classList.remove('on');
  var t = modalTrigger[id];
  if(t && t.focus && document.body.contains(t)) try { t.focus(); } catch(e){}
}
function trapFocus(e){
  if(e.key !== 'Tab') return;
  var open = document.querySelector('.modal.top.on') || document.querySelector('.modal.on');
  if(!open) return;
  var els = Array.prototype.filter.call(open.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'), function(el){ return !el.disabled && el.offsetParent !== null; });
  if(!els.length) return;
  var first = els[0], last = els[els.length-1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
}

/* ---------- rack ---------- */
function renderRack(){
  var host = $('rack'); host.innerHTML = '';
  var cats = CATS.slice();
  PRODUCTS.forEach(function(p){ if(cats.indexOf(p.cat) < 0) cats.push(p.cat); });
  cats.forEach(function(cat){
    var items = PRODUCTS.filter(function(p){ return p.cat === cat; });
    if(!items.length) return;
    var head = document.createElement('div');
    head.className = 'rackcat';
    head.innerHTML = '<span class="speclabel">' + cat + '</span>';
    host.appendChild(head);
    items.forEach(function(p){
      var b = document.createElement('button');
      b.className = 'rackitem' + (p.id === project.productId ? ' on' : '') + (!hasFullAccess() && p.id !== TRIAL_PRODUCT ? ' trial-locked' : '');
      b.dataset.pid = p.id;
      b.setAttribute('aria-label', p.name + (productHasWork(p.id) ? ' (has a design)' : ''));
      b.innerHTML = '<span class="sku">' + p.sku + '</span><span>' + p.name + '</span>' + (productHasWork(p.id) ? '<span class="dot" title="Has a design"></span>' : '');
      b.addEventListener('click', function(){
        if(p.id === project.productId) return;
        if(p.id !== TRIAL_PRODUCT && !trialAllows('product', p.id)) return;
        buildProduct(p.id);
      });
      host.appendChild(b);
    });
  });
}
function syncRack(){
  document.querySelectorAll('.rackitem').forEach(function(x){
    x.classList.toggle('on', x.dataset.pid === project.productId);
    var has = productHasWork(x.dataset.pid), dot = x.querySelector('.dot');
    if(has && !dot){ dot = document.createElement('span'); dot.className = 'dot'; dot.title = 'Has a design'; x.appendChild(dot); }
    if(!has && dot) dot.remove();
  });
}

/* ---------- swatches (named colours) ---------- */
function renderSwatches(){
  ['swatches','swatches2','swatches3'].forEach(function(hid){
    var host = $(hid); if(!host) return;
    host.innerHTML = '';
    GARMENT_COLORS.forEach(function(s){
      var b = document.createElement('button');
      b.className = 'sw' + (s.hex.toLowerCase() === project.garmentColor.toLowerCase() ? ' on' : '');
      b.style.background = s.hex;
      b.title = s.name + (s.tcx ? ' · TCX ' + s.tcx : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-label', s.name);
      b.setAttribute('aria-selected', b.classList.contains('on') ? 'true' : 'false');
      b.innerHTML = '<span class="sr">' + s.name + '</span>';
      b.addEventListener('click', function(){ setGarmentColor(s.hex); });
      host.appendChild(b);
    });
  });
  syncSwatches();
}
function syncSwatches(){
  document.querySelectorAll('.sw').forEach(function(x){
    var on = x.style.backgroundColor && rgbToHex.apply(null, x.style.backgroundColor.match(/\d+/g).map(Number)).toLowerCase() === project.garmentColor.toLowerCase();
    x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  var cn = $('colorNameLine'); if(cn) cn.textContent = colorNameFor(project.garmentColor) + ' · ' + project.garmentColor.toUpperCase();
  ['customColor','customColor2','customColor3'].forEach(function(id){ var el = $(id); if(el) el.value = project.garmentColor; });
}

/* ---------- modes & panes ---------- */
/* the tee is designed in 3D (or flat); other garments in flat panels with a photo preview */
function syncModeButtons(){
  var three = is3D(project.productId);
  document.querySelectorAll('#modeSeg button').forEach(function(b){
    if(b.dataset.mode === '3d') b.classList.toggle('hidden', !three);
    if(b.dataset.mode === 'preview') b.classList.toggle('hidden', three);
    if(b.dataset.mode === 'design') b.textContent = three ? 'Flat' : 'Design';
  });
  var asm = $('psPreviewBtn'); if(asm) asm.textContent = three ? 'See it in 3D \u2192' : 'Assemble \u2192';
}
function setMode(mode){
  if(mode === '3d' && !is3D(project.productId)) mode = 'design';
  if(mode === 'preview' && is3D(project.productId)) mode = '3d';
  if(mode === '3d') state.flat3d = false;
  var was = state.mode;
  state.mode = mode;
  syncModeButtons();
  document.querySelectorAll('#modeSeg button').forEach(function(b){
    var on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  if(typeof s3dSetVisible === 'function') s3dSetVisible(mode === '3d' && S3D.ready);
  if(mode === '3d'){
    if(typeof abClose === 'function' && was !== '3d'){ AB.panel = null; AB.sel = null; state.panel = null; }
    showPane('3d');
    if(typeof s3dOpen === 'function') s3dOpen();
    return;
  }
  if(was === '3d'){ AB.panel = null; AB.sel = null; state.panel = null; }
  if(mode === 'preview'){
    showPane('floor');
    if(!mockCanvas) init2D();
    renderViewSeg();
    syncFitVisibility();
    requestRender();
  } else {
    showPane(state.panel ? 'editor' : 'sheet');
  }
}
function showPane(which){
  $('panelSheet').classList.toggle('hidden', which !== 'sheet');
  $('artboard').classList.toggle('hidden', which !== 'editor');
  $('floor').classList.toggle('hidden', which !== 'floor');
  $('studio3d').classList.toggle('hidden', which !== '3d');
  $('sheetSheet').classList.toggle('hidden', which !== 'sheet');
  $('sheetEditor').classList.toggle('hidden', which !== 'editor' && which !== '3d');
  $('sheetPreview').classList.toggle('hidden', which !== 'floor');
  $('sheet3d').classList.toggle('hidden', which !== '3d');
  $('s3dChips').classList.toggle('hidden', which !== '3d');
  $('sheet').classList.toggle('s3d', which === '3d');
  if(which === 'sheet') renderPanelSheet();
  if(which === 'editor' && typeof abResize === 'function') abResize();
}
function syncFitVisibility(){
  var sec = $('fitSec'); if(!sec) return;
  sec.classList.toggle('hidden', !!getPhotoAsset(project.productId, state.view));
}
function renderViewSeg(){
  var host = $('viewSeg'); if(!host) return;
  var views = availableViews(project.productId);
  if(!views.some(function(v){ return v.id === state.view; })) state.view = views.length ? views[0].id : 'front';
  host.innerHTML = '';
  views.filter(function(v){ return /^(front|back|side_left|side_right|detail)$/.test(v.id); }).forEach(function(v){
    var b = document.createElement('button');
    b.dataset.v = v.id; b.textContent = v.label;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', v.id === state.view ? 'true' : 'false');
    b.className = (v.id === state.view) ? 'on' : '';
    host.appendChild(b);
  });
  syncTurntable();
}
/* turntable row: slider + arrows over every photographed angle */
function syncTurntable(){
  var row = $('turnRow'), vs = turntableViews(project.productId), three = $('three');
  if(!row) return;
  var on = vs.length > 1;
  row.classList.toggle('hidden', !on);
  if(three) three.classList.toggle('turnable', on);
  if(!on) return;
  var idx = 0; vs.forEach(function(v, i){ if(v.id === state.view) idx = i; });
  var sl = $('turnSlider'); sl.max = vs.length - 1; sl.value = idx;
  var v = viewById(state.view);
  $('turnLabel').textContent = v ? (v.angle !== null ? v.label.toUpperCase() + (/°/.test(v.label) ? '' : ' · ' + v.angle + '°') : v.label.toUpperCase()) : '';
}
function bindTurntable(){
  $('turnPrev').addEventListener('click', function(){ var v = turnView(-1); if(v) viewSelect(v); });
  $('turnNext').addEventListener('click', function(){ var v = turnView(1); if(v) viewSelect(v); });
  $('turnSlider').addEventListener('input', function(){ var vs = turntableViews(project.productId); if(vs[+this.value]) viewSelect(vs[+this.value].id); });
  /* drag the garment to turn it: every 48 px of horizontal travel is one frame */
  var three = $('three'), drag = null;
  three.addEventListener('pointerdown', function(e){
    if(locked || turntableViews(project.productId).length < 2) return;
    drag = { x: e.clientX, acc: 0 }; three.classList.add('turning');
    try { three.setPointerCapture(e.pointerId); } catch(err){}
  });
  three.addEventListener('pointermove', function(e){
    if(!drag) return;
    var dx = e.clientX - drag.x; drag.x = e.clientX; drag.acc += dx;
    var step = 48;
    while(drag.acc >= step){ drag.acc -= step; var a = turnView(-1); if(a) viewSelect(a); }
    while(drag.acc <= -step){ drag.acc += step; var b = turnView(1); if(b) viewSelect(b); }
  });
  function up(){ drag = null; three.classList.remove('turning'); }
  three.addEventListener('pointerup', up); three.addEventListener('pointercancel', up);
  document.addEventListener('keydown', function(e){
    if(state.mode !== 'preview' || locked || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    if(e.key === 'ArrowLeft'){ var v = turnView(-1); if(v) viewSelect(v); }
    if(e.key === 'ArrowRight'){ var w = turnView(1); if(w) viewSelect(w); }
  });
}
function viewSelect(v){
  if(!availableViews(project.productId).some(function(x){ return x.id === v; })) return;
  state.view = v;
  document.querySelectorAll('#viewSeg button').forEach(function(b){ var on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  syncTurntable();
  syncFitVisibility();
  requestRender();
}
function segRadio(hostId, attr, value){
  document.querySelectorAll('#' + hostId + ' button').forEach(function(b){ var on = b.dataset[attr] === value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
}

/* ---------- engine hooks ---------- */
function onProductChanged(id){
  var def = PRODUCTS_BY_ID[id];
  ['specSku','psSku'].forEach(function(i){ $(i).textContent = def.sku + ' · ' + def.cat.toUpperCase(); });
  ['specName','psName'].forEach(function(i){ $(i).textContent = def.name; });
  $('specFab').textContent = def.spec;
  $('fabricNote').value = project.fabricNote || '';
  syncRack(); syncSwatches();
  if(typeof abClose === 'function') abClose(true);
  /* a 3D garment opens in 3D unless the customer switched it to Flat */
  if(is3D(id) && !state.flat3d){ setMode('3d'); return; }
  if(is3D(id) && state.mode !== 'design'){ setMode('design'); return; }
  if(!is3D(id) && state.mode === '3d'){ setMode('design'); return; }
  syncModeButtons();
  if(state.mode === 'preview'){ renderViewSeg(); syncFitVisibility(); }
  else showPane('sheet');
}
function onProjectChanged(panelId){
  $('saveStatus').textContent = 'UNSAVED';
  if(typeof S3D !== 'undefined' && S3D.ready){
    s3dMark(panelId);
    if(S3D.drag) return;                 /* mid-drag on the 3D tee: lists catch up on release */
    if(state.mode === '3d' && typeof s3dSyncPanelChips === 'function') s3dSyncPanelChips();
  }
  syncRack();
  if(panelId === null) syncSwatches();           /* the garment colour changed (or everything did) */
  if(state.mode === 'design' && !state.panel) renderPanelSheet();
  if(typeof abOnProjectChanged === 'function') abOnProjectChanged(panelId);
  if(state.mode === 'preview') requestRender();
}
/* a design font finished loading: every text using it is redrawn */
function onFontsLoaded(){
  if(typeof S3D !== 'undefined' && S3D.ready) s3dMarkAll();
  if(state.mode === 'design'){ if(state.panel && typeof abDraw === 'function') abDraw(); else renderPanelSheet(); }
  if(state.mode === 'preview') requestRender();
}
function onHistoryChanged(){
  var u = $('undoBtn'), r = $('redoBtn');
  u.disabled = !hist.undo.length; r.disabled = !hist.redo.length;
  u.title = undoLabel() ? 'Undo ' + undoLabel().toLowerCase() + ' (Ctrl+Z)' : 'Nothing to undo';
  r.title = redoLabel() ? 'Redo ' + redoLabel().toLowerCase() + ' (Ctrl+Shift+Z)' : 'Nothing to redo';
}
function onAutosaved(ts){
  $('saveStatus').textContent = 'SAVED ' + new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  if(!hasFullAccess()) track('trial_design', project.productId, null, true);
}
function onStoreStatus(ok, reason){
  var w = $('storageWarn'); if(!w) return;
  if(ok){ w.classList.add('hidden'); return; }
  w.textContent = 'Your work is not being saved: ' + reason + '. Export a project file from the Export menu to keep it.';
  w.classList.remove('hidden');
}
function onAssetsChanged(productId, view){
  if(productId !== project.productId) return;
  if(state.mode === 'preview'){ renderViewSeg(); syncFitVisibility(); requestRender(); }
  if(typeof peOnAssetsChanged === 'function') peOnAssetsChanged(productId, view);
}
function onPlacementsResolved(productId, view){
  mappedCache = {};
  if(productId === project.productId && state.mode === 'preview') requestRender();
  if(typeof mapOnPlacements === 'function') mapOnPlacements(productId, view);
}
function onRendered(ms){
  var p = $('perfLine'); if(!p) return;
  p.classList.toggle('hidden', !DEBUG);
  if(DEBUG) p.textContent = 'COMPOSITE ' + ms.toFixed(1) + ' MS';
}

/* ---------- main UI ---------- */
function bindUI(){
  document.querySelectorAll('#modeSeg button').forEach(function(b){ b.addEventListener('click', function(){
    if(is3D(project.productId)) state.flat3d = b.dataset.mode === 'design';
    setMode(b.dataset.mode);
  }); });
  $('psPreviewBtn').addEventListener('click', function(){ setMode('preview'); });
  $('editPanelsBtn').addEventListener('click', function(){ setMode('design'); });

  ['customColor','customColor2','customColor3'].forEach(function(id){
    var el = $(id); if(!el) return;
    el.addEventListener('input', function(){ hBegin('Custom dye'); setGarmentColor(this.value); });
    el.addEventListener('change', function(){ hCommit(); });
  });
  document.querySelectorAll('#fabricSeg button').forEach(function(b){
    b.addEventListener('click', function(){ segRadio('fabricSeg', 'fab', b.dataset.fab); setFabric(b.dataset.fab); });
  });
  $('followFabric').addEventListener('change', function(){ state.followFabric = this.checked; mappedCache = {}; requestRender(); });
  $('followStrength').addEventListener('input', function(){ state.followStrength = +this.value; mappedCache = {}; requestRender(); });
  document.querySelectorAll('#fitSeg button').forEach(function(b){
    b.addEventListener('click', function(){ state.fit = b.dataset.f; segRadio('fitSeg', 'f', b.dataset.f); mappedCache = {}; requestRender(); });
  });
  document.querySelectorAll('#accentSeg button').forEach(function(b){
    b.addEventListener('click', function(){
      state.accentMode = b.dataset.a; segRadio('accentSeg', 'a', b.dataset.a);
      $('accentRow').classList.toggle('hidden', state.accentMode !== 'custom');
      requestRender();
    });
  });
  $('accentColor').addEventListener('input', function(){ state.accent = this.value; requestRender(); });
  $('viewSeg').addEventListener('click', function(e){
    var b = e.target.closest('button');
    if(b && b.dataset.v) viewSelect(b.dataset.v);
  });
  $('fabricNote').addEventListener('input', function(){ project.fabricNote = this.value; projectDirty = true; scheduleAutosave(); });
  $('newProjectBtn').addEventListener('click', function(){
    if(Object.keys(project.work).some(productHasWork) && !window.confirm('Start a new project? Every panel design on every garment will be cleared. (Export a project file first if you want to keep it.)')) return;
    newProject();
    deleteSavedProject(project.productId);
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('contactSheetBtn').addEventListener('click', function(){
    var b = this; b.disabled = true; b.textContent = 'Rendering…';
    setTimeout(function(){
      var c = renderContactSheet(state.view);
      downloadCanvas(c, safeName(currentDef().name) + '_' + state.view + '_colours.png');
      b.disabled = false; b.textContent = 'Multi-colour sheet';
    }, 30);
  });
  $('signoutBtn').addEventListener('click', async function(){
    if(account.signedIn) await signOutAccount(); else openGate();
  });

  /* modals */
  document.querySelectorAll('[data-close]').forEach(function(b){
    b.addEventListener('click', function(){ closeModal(b.dataset.close); });
  });
  document.querySelectorAll('.modal').forEach(function(m){
    m.addEventListener('click', function(e){ if(e.target === m && m.id !== 'onboard') closeModal(m.id); });
  });
  document.addEventListener('keydown', function(e){
    trapFocus(e);
    if(e.key === 'Escape'){
      var open = document.querySelector('.modal.top.on') || document.querySelector('.modal.on');
      if(open && open.id !== 'onboard'){ closeModal(open.id); return; }
    }
    var typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if((e.ctrlKey || e.metaKey) && !typing && (e.key === 'z' || e.key === 'Z')){
      e.preventDefault();
      if(e.shiftKey) redo(); else undo();
    }
  });

  /* global drag & drop of image files: into the artboard when open, else ignored */
  ['dragover','dragenter'].forEach(function(t){ document.addEventListener(t, function(e){ e.preventDefault(); }); });
  document.addEventListener('drop', function(e){
    e.preventDefault();
    if(locked){ openGate(); return; }
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if(f && typeof abDropFile === 'function') abDropFile(f);
  });
}

/* ============================================================
   ACCESS
   Live build: the T-shirt is a free trial for everyone, kept in this browser. Other
   garments, exports and My products need a Google account with an active subscription;
   the owner (OWNER_EMAIL on the server) always has one. The server decides through
   /api/session and /api/checkout; nothing enforced here is trusted for payment.
   DEMO_MODE: everything is open and local; nothing is enforced.
   ============================================================ */
var TRIAL_PRODUCT = 'tee';
var locked = false;
function showStudio(){ $('app').classList.add('on'); }
function lockStudio(){
  locked = true;
  $('app').classList.add('locked');
  $('lockShield').classList.add('on');
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function unlockStudio(){
  locked = false;
  $('app').classList.remove('locked');
  $('lockShield').classList.remove('on');
  closeModal('gate');
}
function hasFullAccess(){ return DEMO_MODE || !!account.active; }
var WALL_TEXT = {
  product: 'The free trial covers the T-shirt. Every other garment comes with the subscription.',
  export: 'Exporting mockups and 300 DPI print files comes with the subscription.',
  my_products: 'Bringing your own blank products comes with the subscription.'
};
/* the wall between the free trial and the rest: sign in first, then pay */
function trialAllows(reason, product){
  if(hasFullAccess()) return true;
  track('wall', product || null, reason, true);
  if(account.signedIn){ openPay(WALL_TEXT[reason]); return false; }
  openGate(WALL_TEXT[reason]);
  return false;
}
function openGate(reasonText){
  $('priceTag').textContent = PRICE + ' · PER ' + PRICE_PERIOD.replace('/', '').toUpperCase();
  $('gateTitle').innerHTML = (reasonText ? 'SIGN IN TO CONTINUE' : 'SIGN IN TO SEIF STUDIO') + '<i>.</i>';
  $('gateTag').textContent = (reasonText ? reasonText + ' ' : '') + 'Sign in with Google — your T-shirt design comes with you, and your work follows you to any device.';
  $('payOpenMsg').textContent = '';
  openModal('gate');
  setTimeout(function(){ try { $('googleBtn').focus(); } catch(e){} }, 50);
}
function openPay(note){
  closeModal('gate');
  $('payPrice').textContent = PRICE + PRICE_PERIOD;
  $('payDemo').classList.toggle('hidden', !DEMO_MODE);
  $('payFrameWrap').classList.add('hidden');
  $('payMethods').classList.remove('hidden');
  document.querySelectorAll('#payMethods button').forEach(function(b){ b.disabled = false; });
  if(note) gmsg('payMsg', note, true); else $('payMsg').textContent = '';
  openModal('payModal');
}
async function grant(method){
  /* live build: start over, so the studio loads this account's designs */
  if(!DEMO_MODE){ location.reload(); return; }
  await store.set(K_ACCESS, { m:method, ts:Date.now() }, false);
  closeModal('payModal'); closeModal('adminModal');
  unlockStudio();
}
async function api(path, body, opts){
  var o = { method: body ? 'POST' : 'GET', credentials:'include', headers:{} };
  if(body){ o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  var r = await fetch(API_BASE + path, o);
  var j = null; try { j = await r.json(); } catch(e){}
  if(!r.ok){ var err = new Error((j && j.error) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
  return j || {};
}
async function checkSession(){
  if(DEMO_MODE) return true;
  try { account = await api('/api/session'); } catch(e){ account = { signedIn: false, active: false }; }
  /* the trial lives in this browser; an active account keeps its work on the server */
  store.cloud = !!(account.signedIn && account.active);
  store.sharedCloud = true;
  return !!account.active;
}

/* ============================================================
   ACTIVITY — what visitors and customers do, for the owner's dashboard.
   A visitor id ties what someone did before signing up to their account.
   ============================================================ */
var memVid = null, trackedOnce = {};
function visitorId(){
  var v = null;
  try { v = localStorage.getItem('ss:vid'); } catch(e){}
  if(!v) v = memVid;
  if(!v){
    v = Array.from(crypto.getRandomValues(new Uint8Array(12)), function(b){ return 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]; }).join('');
    memVid = v;
    try { localStorage.setItem('ss:vid', v); } catch(e){}
  }
  return v;
}
function track(type, product, detail, oncePerSession){
  if(DEMO_MODE || account.owner || store.readOnly) return;
  if(oncePerSession){
    var k = 'ss:t:' + type + '|' + (product || '') + '|' + (detail || '');
    try { if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); }
    catch(e){ if(trackedOnce[k]) return; trackedOnce[k] = 1; }
  }
  fetch(API_BASE + '/api/event', { method: 'POST', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: type, vid: visitorId(), product: product || null, detail: detail || null }) }).catch(function(){});
}
function trackVisit(){
  var ref = 'direct';
  try { if(document.referrer && new URL(document.referrer).host !== location.host) ref = new URL(document.referrer).host; } catch(e){}
  track('visit', null, ref + ' · ' + (matchMedia('(max-width:900px)').matches ? 'phone' : 'computer'), true);
}

/* ============================================================
   ACCOUNT (live build) — Google sign-in through Firebase Authentication.
   The browser only uses Firebase to prove who the customer is; the server swaps the
   ID token for its own session cookie, and everything else goes through /api.
   ============================================================ */
var account = { signedIn: false, active: false, owner: false };
var FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
var firebaseReady = null;
function loadScript(src){
  return new Promise(function(res, rej){
    var s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = function(){ rej(new Error('could not load ' + src)); };
    document.head.appendChild(s);
  });
}
/* loaded ahead of the click: a popup opened after an await is blocked by browsers */
function loadFirebase(){
  if(!firebaseReady){
    firebaseReady = loadScript(FIREBASE_SDK + 'firebase-app-compat.js')
      .then(function(){ return loadScript(FIREBASE_SDK + 'firebase-auth-compat.js'); })
      .then(function(){
        if(!firebase.apps.length) firebase.initializeApp(CFG.firebase);
        var auth = firebase.auth();
        if(CFG.authEmulator) auth.useEmulator(CFG.authEmulator, { disableWarnings: true });
        return auth.setPersistence(firebase.auth.Auth.Persistence.NONE).then(function(){ return auth; });
      });
    firebaseReady.catch(function(){ firebaseReady = null; });
  }
  return firebaseReady;
}
function renderAccount(){
  if(DEMO_MODE){
    $('signoutBtn').classList.add('hidden');
    $('ownerBtn').classList.remove('hidden');
    $('lockBar').classList.remove('on');
    return;
  }
  $('acctBox').classList.remove('hidden');
  $('googleBtn').classList.toggle('hidden', !!account.signedIn);
  $('acctOutBtn').classList.toggle('hidden', !account.signedIn);
  $('acctTxt').textContent = account.signedIn
    ? 'Signed in as ' + (account.email || account.name || 'your Google account') + (account.active ? '' : ' — subscribe below to unlock everything.')
    : 'Sign in so your designs and subscription follow you to any device.';
  $('signoutBtn').textContent = account.signedIn ? 'Sign out' : 'Sign in';
  $('signoutBtn').title = account.signedIn ? 'Sign out of ' + (account.email || 'your account') : 'Sign in with Google';
  $('signoutBtn').classList.toggle('primary', !account.signedIn);
  $('signoutBtn').classList.toggle('ghost', !!account.signedIn);
  $('ownerBtn').classList.toggle('hidden', !account.owner);
  /* the trial bar: what the free trial covers, and the way out of it */
  var trial = !account.active;
  $('lockBar').classList.toggle('on', trial);
  $('lbTitle').textContent = 'Free trial · T-shirt';
  $('lbSub').textContent = account.signedIn ? 'Subscribe to unlock every garment and export' : 'Sign in to unlock every garment and export';
  $('lockBarBtn').textContent = account.signedIn ? 'Subscribe' : 'Sign in';
  syncTrialRack();
}
function syncTrialRack(){
  var open = hasFullAccess();
  document.querySelectorAll('.rackitem').forEach(function(x){ x.classList.toggle('trial-locked', !open && x.dataset.pid !== TRIAL_PRODUCT); });
}
async function signInAccount(){
  var btn = $('googleBtn');
  var auth = window.firebase && firebase.apps.length ? firebase.auth() : null;
  if(!auth){ gmsg('acctMsg', 'Still loading Google sign-in — try again in a moment.'); loadFirebase().catch(function(){}); return; }
  btn.disabled = true; gmsg('acctMsg', 'Waiting for Google…', true);
  try {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    var cred = await auth.signInWithPopup(provider);
    account = await api('/api/login', { idToken: await cred.user.getIdToken(), vid: visitorId() });
    auth.signOut().catch(function(){});
    if(account.active){ gmsg('acctMsg', 'Welcome back — loading your designs…', true); location.reload(); return; }
    btn.disabled = false; $('acctMsg').textContent = '';
    renderAccount();
    /* signed in, not subscribed yet: straight to payment */
    openPay('Signed in as ' + (account.email || 'your Google account') + '. Choose how to pay to unlock every garment and export.');
    return;
  } catch(e){
    var code = e && e.code;
    gmsg('acctMsg', code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? 'Sign-in was cancelled.'
      : code === 'auth/popup-blocked' ? 'Your browser blocked the Google window — allow pop-ups for this site and try again.'
      : 'Could not sign in: ' + (e.message || 'unknown error'));
  }
  btn.disabled = false;
}
async function signOutAccount(){
  await fetch(API_BASE + '/api/logout', { method:'POST', credentials:'include' }).catch(function(){});
  location.href = '/';
}
/* designs saved in this browser before the customer had an active account move into it once,
   then leave the browser so they cannot end up in someone else's account later */
async function migrateLocalWork(){
  if(store.backend !== 'local') return;
  var keys = store.keys('seifstudio:', false).filter(function(k){ return k !== K_ACCESS; });
  if(!keys.length) return;
  $('saveStatus').textContent = 'MOVING YOUR DESIGNS TO YOUR ACCOUNT…';
  try {
    var have = {};
    (await store.cloudKeys('seifstudio:')).forEach(function(k){ have[k] = 1; });
    for(var i=0;i<keys.length;i++){
      if(have[keys[i]]) continue;
      var raw = localStorage.getItem(store._lk(keys[i], false));
      if(raw) await store.cloudSet(keys[i], raw, false);
    }
    keys.forEach(function(k){ localStorage.removeItem(store._lk(k, false)); });
    $('saveStatus').textContent = '';
  } catch(e){
    $('saveStatus').textContent = '';
    onStoreStatus(false, 'could not move the designs saved in this browser to your account (' + e.message + '); they are kept here and will be retried');
  }
}
/* the owner's photos, mapping and colours saved in this browser before they were shared go up once */
async function migrateSharedSettings(){
  if(store.backend !== 'local' || !account.owner) return;
  var keys = store.keys('seifstudio:', true).filter(function(k){ return k !== K_INVITES; });
  if(!keys.length) return;
  try {
    for(var i=0;i<keys.length;i++){
      var raw = localStorage.getItem(store._lk(keys[i], true));
      if(raw && !(store.sharedKeys && store.sharedKeys[keys[i]])){ await store.cloudSet(keys[i], raw, true); store.sharedKeys[keys[i]] = 1; }
    }
    keys.forEach(function(k){ localStorage.removeItem(store._lk(k, true)); });
  } catch(e){
    onStoreStatus(false, 'could not publish the settings saved in this browser (' + e.message + '); they are kept here and will be retried');
  }
}
function bindLock(){
  $('lockShield').addEventListener('click', function(e){ e.preventDefault(); openGate(); });
  $('lockBarBtn').addEventListener('click', function(){ if(account.signedIn) openPay(); else openGate(); });
  $('app').addEventListener('focusin', function(e){
    if(!locked) return;
    if(e.target && e.target.blur) e.target.blur();
    openGate();
  });
  $('app').addEventListener('keydown', function(e){
    if(!locked) return;
    e.preventDefault(); e.stopPropagation();
    openGate();
  }, true);
}
function bindGate(){
  $('googleBtn').addEventListener('click', signInAccount);
  $('acctOutBtn').addEventListener('click', signOutAccount);
  $('ownerBtn').addEventListener('click', function(){
    if(!DEMO_MODE){ location.href = '/admin'; return; }
    openModal('adminModal');
    $('pinInput').value = '';
    $('adminLock').classList.remove('hidden');
    $('adminPanel').classList.add('hidden');
  });
  $('viewBackBtn').addEventListener('click', function(){ location.reload(); });

  $('payOpenBtn').addEventListener('click', function(){
    if(!DEMO_MODE && !account.signedIn){ gmsg('payOpenMsg', 'Sign in with Google first (above), so your subscription is saved to your account.'); $('googleBtn').focus(); return; }
    openPay();
  });
  document.querySelectorAll('#payMethods button').forEach(function(b){
    b.addEventListener('click', async function(){
      var method = b.dataset.pay;
      if(DEMO_MODE){
        gmsg('payMsg', 'Demo build — no provider connected. Nothing is charged.', true);
        setTimeout(function(){ grant('demo'); }, 600);
        return;
      }
      b.disabled = true; gmsg('payMsg', 'Creating your order…', true);
      try {
        var r = await api('/api/checkout', { method: method });
        if(r.iframeUrl){
          $('payMethods').classList.add('hidden');
          $('payFrameWrap').classList.remove('hidden');
          $('payFrame').src = r.iframeUrl;
          gmsg('payMsg', 'Complete the payment in the form. This page unlocks automatically once it is confirmed.', true);
          pollSession();
        } else if(r.reference){
          gmsg('payMsg', 'Reference ' + r.reference + ' — pay at any Fawry outlet or in the wallet app. The studio unlocks when payment is confirmed.', true);
          pollSession();
        }
      } catch(e){ gmsg('payMsg', 'Could not start checkout: ' + e.message); b.disabled = false; }
    });
  });

  /* demo build only: the owner panel behind a PIN (the live build uses /admin) */
  $('pinBtn').addEventListener('click', function(){
    if(DEMO_MODE && $('pinInput').value === ADMIN_PIN){ openAdminPanel(); return; }
    gmsg('pinMsg', DEMO_MODE ? 'Wrong PIN. (Demo build: the PIN is DEMO.)' : 'The owner panel is at /admin.');
  });
  $('pinInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('pinBtn').click(); });
  $('adminEnterBtn').addEventListener('click', function(){ closeModal('adminModal'); });
  $('adTabOverview').addEventListener('click', function(){ adminTab('overview'); });
  $('adTabCustomers').addEventListener('click', function(){ adminTab('customers'); });
  $('adTabPhotos').addEventListener('click', function(){ adminTab('photos'); });
  $('adTabColors').addEventListener('click', function(){ adminTab('colors'); });
  $('ovRefresh').addEventListener('click', renderOverview);
}
var sessionPoll = null;
function pollSession(){
  clearInterval(sessionPoll);
  sessionPoll = setInterval(async function(){
    if(await checkSession()){ clearInterval(sessionPoll); grant('card'); }
  }, 4000);
}
/* demo build: photos and colours only */
function openAdminPanel(){
  $('adminLock').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  $('adTabOverview').classList.add('hidden');
  $('adTabCustomers').classList.add('hidden');
  adminTab('photos');
  peInit();
  renderColorRows();
}
function adminTab(t){
  [['overview', 'adTabOverview', 'adOverview'], ['customers', 'adTabCustomers', 'adCustomers'],
   ['photos', 'adTabPhotos', 'adPhotos'], ['colors', 'adTabColors', 'adColors']].forEach(function(x){
    $(x[1]).classList.toggle('on', t === x[0]);
    $(x[2]).classList.toggle('hidden', t !== x[0]);
  });
  if(t === 'overview') renderOverview();
  if(t === 'customers') renderCustomers();
  if(t === 'photos') peStage(PE.stage);
}

/* ============================================================
   OWNER DASHBOARD (live build, /admin) — who is on the site and what they do
   ============================================================ */
var EV_LABEL = {
  visit: 'Visited the site', trial_design: 'Designed on the free T-shirt', wall: 'Hit the sign-in wall',
  signup: 'Created an account', login: 'Signed in', design_created: 'Started working on', design_saved: 'Came back to work on',
  export: 'Exported', checkout_started: 'Opened checkout', checkout_failed: 'Checkout failed',
  payment: 'Paid', payment_failed: 'Payment failed', access_granted: 'Was given access', access_revoked: 'Access revoked'
};
var WALL_LABEL = { product: 'wanted another garment', export: 'wanted to export', my_products: 'wanted My products' };
var STAT_ROWS = [['visit', 'Visits'], ['trial_design', 'Free T-shirt designs'], ['wall', 'Hit the sign-in wall'], ['signup', 'New accounts'],
  ['login', 'Sign-ins'], ['design_created', 'Garments designed'], ['export', 'Exports'], ['checkout_started', 'Opened checkout'],
  ['checkout_failed', 'Checkout failed'], ['payment', 'Payments'], ['payment_failed', 'Failed payments']];
function productName(id){ var d = PRODUCTS_BY_ID[id]; return d ? d.name : (id || ''); }
function fmtWhen(ts){
  if(!ts) return '—';
  var d = new Date(ts);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDay(ts){ return ts ? new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
function openOwnerDashboard(){
  $('adminModal').querySelector('.card').classList.add('dash');
  $('adminTitle').textContent = 'Owner dashboard';
  $('adminLock').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  $('adminEnterBtn').textContent = 'Close the dashboard';
  openModal('adminModal');
  adminTab('overview');
  peInit();
  renderColorRows();
}
function renderEvents(host, events, opts){
  host.innerHTML = '';
  if(!events || !events.length){ host.appendChild(el('p', 'tiny', (opts && opts.empty) || 'Nothing yet.')); return; }
  events.forEach(function(e){
    var row = el('div', 'evrow');
    row.appendChild(el('span', 't', fmtWhen(e.t)));
    var who = el('span', 'who' + (e.email ? '' : ' anon'), e.email || ('Visitor ' + String(e.vid || '?').slice(0, 6)));
    if(e.uid && (!opts || !opts.noWho)){ who.style.cursor = 'pointer'; who.title = 'Open this customer'; who.addEventListener('click', function(){ adminTab('customers'); showCustomer(e.uid); }); }
    if(!opts || !opts.noWho) row.appendChild(who);
    var what = el('span', 'what');
    what.appendChild(el('b', null, EV_LABEL[e.type] || e.type));
    var extra = [];
    if(e.product) extra.push(productName(e.product));
    if(e.type === 'wall' && WALL_LABEL[e.detail]) extra.push(WALL_LABEL[e.detail]);
    else if(e.detail) extra.push(e.detail);
    if(extra.length) what.appendChild(el('small', null, extra.join(' · ')));
    row.appendChild(what);
    if(opts && opts.noWho) row.style.gridTemplateColumns = '118px minmax(0,1fr)';
    host.appendChild(row);
  });
}
async function renderOverview(){
  var host = $('ovStats'); host.textContent = 'Loading…'; $('ovFeed').innerHTML = '';
  var r;
  try { r = await api('/api/admin/overview'); } catch(e){ host.textContent = 'Could not load the dashboard: ' + e.message; return; }
  var t = el('table', 'dtable'), head = el('tr');
  head.appendChild(el('th', null, ''));
  r.days.forEach(function(d, i){ head.appendChild(el('th', 'n', i === 0 ? 'Today' : i === 1 ? 'Yesterday' : new Date(d.day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' }))); });
  head.appendChild(el('th', 'n', '7 days'));
  t.appendChild(head);
  STAT_ROWS.forEach(function(sr){
    var tr = el('tr'), sum = 0;
    tr.appendChild(el('td', null, sr[1]));
    r.days.forEach(function(d){ var v = d[sr[0]] || 0; sum += v; tr.appendChild(el('td', 'n', v ? String(v) : '·')); });
    var tot = el('td', 'n', String(sum)); tot.style.fontWeight = '700'; tr.appendChild(tot);
    t.appendChild(tr);
  });
  host.innerHTML = ''; host.appendChild(t);
  renderEvents($('ovFeed'), r.events, { empty: 'No activity yet — share the site and it shows up here.' });
}
function statusPill(a){
  if(a.owner) return el('span', 'pill own', 'Owner');
  if(a.activeNow) return el('span', 'pill on', 'Active · until ' + fmtDay(a.expiresAt));
  return el('span', 'pill off', a.plan === 'revoked' ? 'Revoked' : (a.expiresAt ? 'Expired' : 'Free trial'));
}
async function renderCustomers(){
  $('cuDetail').classList.add('hidden');
  var host = $('cuList'); host.classList.remove('hidden'); host.textContent = 'Loading…';
  var r;
  try { r = await api('/api/admin/accounts'); } catch(e){ host.textContent = 'Could not load customers: ' + e.message; return; }
  host.innerHTML = '';
  var paying = r.accounts.filter(function(a){ return a.activeNow && !a.owner; }).length;
  host.appendChild(el('div', 'sub', r.accounts.length + ' accounts · ' + paying + ' with access right now. Click a customer to see everything they did.'));
  if(!r.accounts.length){ host.appendChild(el('p', 'tiny', 'Nobody has signed in yet.')); return; }
  var wrap = el('div', 'dashwrap'), t = el('table', 'dtable'), head = el('tr');
  ['Customer', 'Status', 'How', 'Joined', 'Last seen'].forEach(function(h){ head.appendChild(el('th', null, h)); });
  t.appendChild(head);
  r.accounts.forEach(function(a){
    var tr = el('tr', 'click');
    var c = el('td'); c.appendChild(el('div', null, a.email || a.uid)); if(a.name) c.appendChild(el('div', 'tiny', a.name)); tr.appendChild(c);
    var st = el('td'); st.appendChild(statusPill(a)); tr.appendChild(st);
    tr.appendChild(el('td', null, a.owner ? '—' : ({ monthly: 'Paid', gift: 'Given by you', revoked: '—' }[a.plan] || '—')));
    tr.appendChild(el('td', null, fmtDay(a.createdAt)));
    tr.appendChild(el('td', null, fmtWhen(a.lastSeenAt || a.lastLoginAt)));
    tr.addEventListener('click', function(){ showCustomer(a.uid); });
    t.appendChild(tr);
  });
  wrap.appendChild(t); host.appendChild(wrap);
}
async function showCustomer(uid){
  $('cuList').classList.add('hidden');
  var host = $('cuDetail'); host.classList.remove('hidden'); host.textContent = 'Loading…';
  var r;
  try { r = await api('/api/admin/accounts/' + encodeURIComponent(uid)); } catch(e){ host.textContent = 'Could not load this customer: ' + e.message; return; }
  var a = r.account;
  host.innerHTML = '';
  var back = el('button', 'btn ghost small', '← All customers'); back.addEventListener('click', renderCustomers);
  host.appendChild(back);
  var hd = el('div', 'cuhead'); hd.style.marginTop = '14px';
  hd.appendChild(el('h4', null, a.email || a.uid)); hd.appendChild(statusPill(a));
  host.appendChild(hd);
  host.appendChild(el('div', 'sub', [a.name, 'joined ' + fmtDay(a.createdAt), 'last seen ' + fmtWhen(a.lastSeenAt || a.lastLoginAt)].filter(Boolean).join(' · ')));

  if(!a.owner){
    var acts = el('div', 'cuacts'), days = el('input', 'field'); days.type = 'number'; days.min = '1'; days.value = '30'; days.setAttribute('aria-label', 'Days of access');
    var give = el('button', 'btn primary small', 'Give access'), rev = el('button', 'btn ghost small', 'Revoke access'), msg = el('span', 'tiny');
    acts.appendChild(give); acts.appendChild(days); acts.appendChild(el('span', 'tiny', 'days')); if(a.activeNow) acts.appendChild(rev); acts.appendChild(msg);
    give.addEventListener('click', async function(){
      give.disabled = true;
      try { await api('/api/admin/accounts/' + encodeURIComponent(uid), { action: 'grant', days: +days.value || 30 }); showCustomer(uid); }
      catch(e){ msg.textContent = 'Could not give access: ' + e.message; give.disabled = false; }
    });
    rev.addEventListener('click', async function(){
      if(!window.confirm('Revoke access for ' + (a.email || 'this customer') + '? They keep their designs but cannot use the studio until they pay again.')) return;
      try { await api('/api/admin/accounts/' + encodeURIComponent(uid), { action: 'revoke' }); showCustomer(uid); }
      catch(e){ msg.textContent = 'Could not revoke: ' + e.message; }
    });
    host.appendChild(acts);
  }

  host.appendChild(el('div', 'speclabel cusec', 'Designs'));
  var projects = (r.designs || []).filter(function(d){ return /^seifstudio:project:/.test(d.k) && d.k !== 'seifstudio:project:index'; });
  var images = (r.designs || []).filter(function(d){ return /^seifstudio:img:/.test(d.k); });
  if(!projects.length) host.appendChild(el('p', 'tiny', 'No saved designs yet.'));
  else {
    var dt = el('table', 'dtable'), dh = el('tr');
    ['Garment', 'Last saved', ''].forEach(function(h){ dh.appendChild(el('th', null, h)); }); dt.appendChild(dh);
    projects.sort(function(x, y){ return (y.updatedAt || 0) - (x.updatedAt || 0); }).forEach(function(d){
      var pid = d.k.slice('seifstudio:project:'.length), tr = el('tr');
      tr.appendChild(el('td', null, productName(pid))); tr.appendChild(el('td', null, fmtWhen(d.updatedAt)));
      var td = el('td'), open = el('button', 'btn ghost small', 'Open (read only)');
      open.addEventListener('click', function(){ ownerViewDesign(uid, a.email, pid); });
      td.appendChild(open); tr.appendChild(td); dt.appendChild(tr);
    });
    host.appendChild(dt);
    host.appendChild(el('p', 'tiny', images.length + ' uploaded image' + (images.length === 1 ? '' : 's') + ' in their account.'));
  }

  host.appendChild(el('div', 'speclabel cusec', 'Payments'));
  if(!r.orders.length) host.appendChild(el('p', 'tiny', 'No payments started.'));
  else {
    var ot = el('table', 'dtable'), oh = el('tr');
    ['Started', 'Method', 'Status'].forEach(function(h){ oh.appendChild(el('th', null, h)); }); ot.appendChild(oh);
    r.orders.forEach(function(o){
      var tr = el('tr');
      tr.appendChild(el('td', null, fmtWhen(o.createdAt))); tr.appendChild(el('td', null, o.method || '—'));
      tr.appendChild(el('td', null, o.paid ? 'Paid ' + fmtWhen(o.paidAt) : 'Not paid'));
      ot.appendChild(tr);
    });
    host.appendChild(ot);
  }

  host.appendChild(el('div', 'speclabel cusec', 'Everything they did'));
  var tl = el('div'); host.appendChild(tl);
  renderEvents(tl, r.events, { noWho: true, empty: 'No activity recorded yet.' });
  if(r.before && r.before.length){
    host.appendChild(el('div', 'speclabel cusec', 'Before they signed up (same browser)'));
    var bl = el('div'); host.appendChild(bl);
    renderEvents(bl, r.before, { noWho: true });
  }
}
/* the owner opens a customer's design in the studio; nothing they change is saved */
async function ownerViewDesign(uid, email, pid){
  store.viewBase = '/api/admin/accounts/' + encodeURIComponent(uid) + '/data/';
  store.readOnly = true;
  closeModal('adminModal');
  $('viewTxt').textContent = 'Opening ' + (email || 'the customer') + '’s design…';
  $('viewBanner').classList.remove('hidden');
  try {
    await restoreSavedProject(pid);
    $('viewTxt').textContent = 'Viewing ' + (email || 'a customer') + '’s ' + productName(pid) + ' — read only, nothing you change is saved.';
  } catch(e){ $('viewTxt').textContent = 'Could not open this design: ' + e.message; }
}

/* ---------- admin: colours ---------- */
function renderColorRows(){
  var host = $('colorRows'); host.innerHTML = '';
  GARMENT_COLORS.forEach(function(c, i){
    var row = document.createElement('div'); row.className = 'colrow';
    row.innerHTML = '<span class="chip" style="background:' + c.hex + '"></span><span class="n">' + c.name + '</span><span class="h">' + c.hex.toUpperCase() + (c.tcx ? ' · ' + c.tcx : '') + '</span>';
    var del = document.createElement('button'); del.className = 'btn ghost small'; del.textContent = 'Remove'; del.setAttribute('aria-label', 'Remove colour ' + c.name);
    del.addEventListener('click', async function(){
      var list = GARMENT_COLORS.slice(); list.splice(i, 1);
      var r = await saveGarmentColors(list);
      if(!r.ok){ gmsg('colMsg', 'Could not save: ' + r.reason); return; }
      renderColorRows(); renderSwatches();
    });
    row.appendChild(del);
    host.appendChild(row);
  });
  if(!GARMENT_COLORS.length) host.innerHTML = '<p class="tiny">No colours yet — add the first one below.</p>';
}
function bindColorsAdmin(){
  $('colAddBtn').addEventListener('click', async function(){
    var name = $('colName').value.trim(), hex = $('colHex').value, tcx = $('colTcx').value.trim();
    if(!name){ gmsg('colMsg', 'Give the colour a name.'); return; }
    var list = GARMENT_COLORS.concat([{ name:name, hex:hex, tcx:tcx || '' }]);
    var r = await saveGarmentColors(list);
    if(!r.ok){ gmsg('colMsg', 'Could not save: ' + r.reason); return; }
    $('colName').value = ''; $('colTcx').value = '';
    gmsg('colMsg', 'Added.', true);
    renderColorRows(); renderSwatches();
  });
}

/* ============================================================
   shared photo-editor core (chroma key) — unchanged, it works
   ============================================================ */
function edDrawChecker(cx, x, y, w, h){
  var s = 10;
  cx.save(); cx.beginPath(); cx.rect(x, y, w, h); cx.clip();
  for(var yy = y; yy < y+h; yy += s){
    for(var xx = x; xx < x+w; xx += s){
      cx.fillStyle = ((((xx-x)/s|0) + ((yy-y)/s|0)) % 2 === 0) ? '#e7e7e2' : '#ffffff';
      cx.fillRect(xx, yy, s, s);
    }
  }
  cx.restore();
}
function edDrawPreview(ed, canvasId){
  var c = $(canvasId), cx = c.getContext('2d');
  cx.clearRect(0, 0, c.width, c.height);
  if(!ed.img) return;
  var iw = ed.img.naturalWidth, ih = ed.img.naturalHeight;
  var s = Math.min(c.width/iw, c.height/ih);
  var dw = iw*s, dh = ih*s, dx = (c.width-dw)/2, dy = (c.height-dh)/2;
  ed.draw = { dx:dx, dy:dy, dw:dw, dh:dh };
  if(ed.key){
    var sc = document.createElement('canvas'); sc.width = Math.round(dw); sc.height = Math.round(dh);
    var scx = sc.getContext('2d');
    scx.drawImage(ed.img, 0, 0, sc.width, sc.height);
    var d = scx.getImageData(0, 0, sc.width, sc.height);
    keyBackground(d, ed.key.r, ed.key.g, ed.key.b, 46);
    scx.putImageData(d, 0, 0);
    edDrawChecker(cx, dx, dy, dw, dh);
    cx.drawImage(sc, dx, dy, dw, dh);
  } else {
    cx.drawImage(ed.img, dx, dy, dw, dh);
  }
  if(ed.rect){
    cx.strokeStyle = '#C3423F'; cx.lineWidth = 2; cx.setLineDash([6,4]);
    cx.strokeRect(dx + ed.rect.x*dw, dy + ed.rect.y*dh, ed.rect.w*dw, ed.rect.h*dh);
    cx.setLineDash([]);
  }
}
function edCanvasPoint(canvasId, e){
  var c = $(canvasId), r = c.getBoundingClientRect();
  return { x: (e.clientX-r.left) * (c.width/r.width), y: (e.clientY-r.top) * (c.height/r.height) };
}
function edBindCanvas(ed, canvasId, onKey){
  var c = $(canvasId);
  c.addEventListener('pointerdown', function(e){
    if(!ed.img || !ed.draw) return;
    var p = edCanvasPoint(canvasId, e), d = ed.draw;
    if(p.x < d.dx || p.x > d.dx+d.dw || p.y < d.dy || p.y > d.dy+d.dh) return;
    if(ed.mode === 'key'){
      var sc = document.createElement('canvas'); sc.width = Math.round(d.dw); sc.height = Math.round(d.dh);
      var scx = sc.getContext('2d');
      scx.drawImage(ed.img, 0, 0, sc.width, sc.height);
      var px = scx.getImageData(Math.max(0,Math.round(p.x-d.dx)), Math.max(0,Math.round(p.y-d.dy)), 1, 1).data;
      ed.key = { r:px[0], g:px[1], b:px[2] };
      edDrawPreview(ed, canvasId);
      if(onKey) onKey();
    } else {
      ed.dragging = true;
      ed.dragStart = p;
    }
  });
  c.addEventListener('pointermove', function(e){
    if(!ed.dragging || !ed.draw) return;
    var p = edCanvasPoint(canvasId, e), d = ed.draw;
    var x0 = Math.min(ed.dragStart.x, p.x), y0 = Math.min(ed.dragStart.y, p.y);
    var x1 = Math.max(ed.dragStart.x, p.x), y1 = Math.max(ed.dragStart.y, p.y);
    ed.rect = { x:(x0-d.dx)/d.dw, y:(y0-d.dy)/d.dh, w:(x1-x0)/d.dw, h:(y1-y0)/d.dh };
    edDrawPreview(ed, canvasId);
  });
  window.addEventListener('pointerup', function(){ ed.dragging = false; });
}
function edResetState(ed){
  ed.img = null; ed.key = null; ed.rect = null; ed.mode = 'key'; ed.draw = null; ed.dragging = false;
}
async function edProcessedDataUrl(ed){
  var iw = ed.img.naturalWidth, ih = ed.img.naturalHeight;
  var maxDim = 1400;
  var scale = Math.min(1, maxDim/Math.max(iw, ih));
  var cw = Math.round(iw*scale), ch = Math.round(ih*scale);
  var c = document.createElement('canvas'); c.width = cw; c.height = ch;
  var cx = c.getContext('2d');
  cx.drawImage(ed.img, 0, 0, cw, ch);
  var data = cx.getImageData(0, 0, cw, ch);
  if(ed.key) keyBackground(data, ed.key.r, ed.key.g, ed.key.b, 46);
  toGrayscaleLuma(data);
  cx.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
}
/* does the image carry real transparency already? (sample the corners + a sparse grid) */
function edHasAlpha(img){
  var c = document.createElement('canvas'); c.width = 64; c.height = 64;
  var x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
  var d = x.getImageData(0, 0, 64, 64).data, clear = 0;
  for(var i=3;i<d.length;i+=4) if(d[i] < 16) clear++;
  return clear > 64 * 64 * 0.08;
}
function edLoadFile(ed, file, canvasId, cb){
  if(!file || !file.type || file.type.indexOf('image') !== 0) return;
  var rd = new FileReader();
  rd.onload = function(){
    var img = new Image();
    img.onload = function(){
      ed.img = img; ed.key = null; ed.rect = null; ed.mode = 'key';
      edDrawPreview(ed, canvasId);
      if(cb) cb();
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
/* the photo-to-design-space conversion the asset uses, so the admin can
   preview a freshly keyed photo exactly as the compositor will place it */
function photoRectToQuad(rect, iw, ih){
  var scale = Math.min(DS/iw, DS/ih) * 0.94;
  var dw = iw*scale, dh = ih*scale, dx = (DS-dw)/2, dy = (DS-dh)/2;
  return rectQuad(dx + rect.x*dw, dy + rect.y*dh, rect.w*dw, rect.h*dh);
}

/* ============================================================
   admin: garment photos + PANEL MAPPING (catalog, shared)
   ============================================================ */
var PE = { productId:null, view:'front', stage:'photo', img:null, key:null, rect:null, draw:null, mode:'key', dragging:false, dragStart:null };
var MAP = { list: [], sel: null, drag: null, base: null, baseKey: null };
var MAP_PX = 370, MAP_S = 370 / 1600, HANDLE_R = 7;

function pePopulateProducts(){
  var sel = $('peProduct');
  sel.innerHTML = '';
  PRODUCTS.filter(function(p){ return !p.isCustom && !is3D(p.id); }).forEach(function(p){   /* 3D garments need no photos */
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.name;
    sel.appendChild(o);
  });
}
function peInit(){
  pePopulateProducts();
  var vs = $('peView'); vs.innerHTML = '';
  VIEWS.forEach(function(v){ var o = document.createElement('option'); o.value = v.id; o.textContent = v.label + (v.angle !== null && !/°/.test(v.label) ? ' (' + v.angle + '°)' : ''); vs.appendChild(o); });
  PE.productId = $('peProduct').value;
  PE.view = 'front'; vs.value = 'front';
  peSyncView();
}
function peSyncView(){
  peResetEditor();
  mapLoad();
}
function peStage(s){
  PE.stage = s;
  $('peStagePhoto').classList.toggle('on', s === 'photo');
  $('peStageMap').classList.toggle('on', s === 'map');
  $('pePhotoStage').classList.toggle('hidden', s !== 'photo');
  $('peMapStage').classList.toggle('hidden', s !== 'map');
  if(s === 'map') mapDraw();
}
function peResetEditor(){
  edResetState(PE);
  edDrawPreview(PE, 'photoEditCanvas');
  $('peStatus').textContent = 'Upload a photo to begin. Click the background to remove it.';
  $('peSaveBtn').disabled = true;
  peSyncStatusLine();
}
function peSyncStatusLine(){
  var has = !!getPhotoAsset(PE.productId, PE.view), builtin = !!builtinPhotoUrl(PE.productId, PE.view);
  $('peStatusLine').textContent = has ? (builtin ? 'Using the built-in render for this view — upload to replace it.' : 'Photo uploaded for this view — in use now.') : 'No photo yet — using the illustrated placeholder.';
  $('peRemoveBtn').classList.toggle('hidden', !has || builtin);
}
function peOnAssetsChanged(productId, view){
  if(productId === PE.productId && view === PE.view){ peSyncStatusLine(); MAP.base = null; mapDraw(); }
}
function bindPhotoEditor(){
  edBindCanvas(PE, 'photoEditCanvas', function(){
    $('peStatus').textContent = 'Background sampled — looks wrong? Click a different spot.';
  });
  $('peProduct').addEventListener('change', function(){ PE.productId = this.value; peSyncView(); });
  $('peView').addEventListener('change', function(){ PE.view = this.value; peSyncView(); });
  $('peStagePhoto').addEventListener('click', function(){ peStage('photo'); });
  $('peStageMap').addEventListener('click', function(){ peStage('map'); });
  $('peUploadBtn').addEventListener('click', function(){ $('peFile').click(); });
  $('peFile').addEventListener('change', function(){
    var f = this.files[0]; this.value = '';
    edLoadFile(PE, f, 'photoEditCanvas', function(){
      PE.transparent = edHasAlpha(PE.img);
      $('peStatus').textContent = PE.transparent ? 'Transparent PNG — background already removed. Save it.' : 'Click on the background to remove it, then save.';
      $('peSaveBtn').disabled = false;
    });
  });
  $('peSaveBtn').addEventListener('click', async function(){
    if(!PE.img){ $('peStatus').textContent = 'Upload a photo first.'; return; }
    if(!PE.key && !PE.transparent){ $('peStatus').textContent = 'Click the background to remove it first.'; return; }
    this.disabled = true; this.textContent = 'Saving…';
    var dataUrl = await edProcessedDataUrl(PE);
    var r = await savePhotoAsset(PE.productId, PE.view, dataUrl);
    this.disabled = false; this.textContent = 'Save photo';
    if(!r.ok){ inlineErr('peSaveBtn', 'Could not save the photo: ' + r.reason + '. Try a smaller image.'); return; }
    inlineErr('peSaveBtn', '');
    $('peStatus').textContent = 'Saved — now map the panels onto it (next tab).';
    peSyncStatusLine();
  });
  $('peRemoveBtn').addEventListener('click', async function(){
    await removePhotoAsset(PE.productId, PE.view);
    peResetEditor();
  });

  /* ---- mapping stage ---- */
  var mc = $('mapCanvas');
  mc.addEventListener('pointerdown', mapDown);
  mc.addEventListener('pointermove', mapMove);
  window.addEventListener('pointerup', mapUp);
  $('pePanelSeg').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    MAP.sel = b.dataset.p; mapSyncPanelSeg(); mapDraw();
  });
  $('mapSnapBtn').addEventListener('click', function(){ var pl = mapSel(); if(pl){ pl.quad = snapQuadToRect(pl.quad); mapDraw(); } });
  $('mapResetBtn').addEventListener('click', function(){
    var pl = mapSel(); if(!pl) return;
    var def = builtInPlacements(PE.productId, PE.view).filter(function(x){ return x.panel === pl.panel; })[0];
    pl.quad = def ? def.quad : defaultQuadFor(panelById(PE.productId, pl.panel));
    mapDraw();
  });
  $('mapCopyBtn').addEventListener('click', function(){
    var front = placementsFor(PE.productId, 'front');
    MAP.list = front.map(function(pl){ return { panel: pl.panel, quad: mirrorQuad(pl.quad) }; });
    /* swap left/right panels so the mirrored quads land on the correct sleeve */
    MAP.list.forEach(function(pl){ if(/_l$/.test(pl.panel)) pl.panel = pl.panel.replace(/_l$/, '_r'); else if(/_r$/.test(pl.panel)) pl.panel = pl.panel.replace(/_r$/, '_l'); });
    var back = panelById(PE.productId, 'back'), hasFront = MAP.list.some(function(p){ return p.panel === 'front'; });
    if(back && hasFront) MAP.list.forEach(function(pl){ if(pl.panel === 'front') pl.panel = 'back'; });
    MAP.sel = MAP.list.length ? MAP.list[0].panel : null;
    mapSyncPanelSeg(); mapDraw();
    gmsg('mapMsg', 'Copied and mirrored from the front view. Adjust, then save.', true);
  });
  $('mapAddBtn').addEventListener('click', function(){
    var pid = $('mapAddSel').value; if(!pid) return;
    var p = panelById(PE.productId, pid); if(!p) return;
    MAP.list.push({ panel: pid, quad: defaultQuadFor(p) });
    MAP.sel = pid; mapSyncPanelSeg(); mapDraw();
  });
  $('mapDropBtn').addEventListener('click', function(){
    if(!MAP.sel) return;
    MAP.list = MAP.list.filter(function(pl){ return pl.panel !== MAP.sel; });
    MAP.sel = MAP.list.length ? MAP.list[0].panel : null;
    mapSyncPanelSeg(); mapDraw();
  });
  $('mapSaveBtn').addEventListener('click', async function(){
    this.disabled = true;
    var r = await savePlacements(PE.productId, PE.view, MAP.list);
    this.disabled = false;
    if(r.ok) gmsg('mapMsg', 'Mapping saved for ' + PRODUCTS_BY_ID[PE.productId].name + ' · ' + PE.view + '.', true);
    else gmsg('mapMsg', 'Could not save: ' + r.reason);
  });
}
function mapLoad(){
  MAP.list = cloneQuadList(placementsFor(PE.productId, PE.view));
  MAP.sel = MAP.list.length ? MAP.list[0].panel : null;
  MAP.base = null;
  $('mapCopyBtn').classList.toggle('hidden', PE.view !== 'back');
  $('mapMsg').textContent = '';
  mapSyncPanelSeg();
  mapDraw();
}
function mapOnPlacements(productId, view){
  if(productId === PE.productId && view === PE.view && !MAP.drag && $('adminModal').classList.contains('on')) mapLoad();
}
function mapSel(){ for(var i=0;i<MAP.list.length;i++){ if(MAP.list[i].panel === MAP.sel) return MAP.list[i]; } return null; }
function mapSyncPanelSeg(){
  var host = $('pePanelSeg'); host.innerHTML = '';
  MAP.list.forEach(function(pl){
    var p = panelById(PE.productId, pl.panel);
    var b = document.createElement('button'); b.dataset.p = pl.panel; b.textContent = p ? p.label : pl.panel;
    b.className = pl.panel === MAP.sel ? 'on' : '';
    host.appendChild(b);
  });
  if(!MAP.list.length){ var e = document.createElement('p'); e.className = 'tiny'; e.style.margin = '6px'; e.textContent = 'No panels placed in this view yet — add one below.'; host.appendChild(e); }
  var sel = $('mapAddSel'); sel.innerHTML = '';
  var placed = MAP.list.map(function(pl){ return pl.panel; });
  panelsFor(PE.productId).forEach(function(p){
    if(placed.indexOf(p.id) >= 0) return;
    var o = document.createElement('option'); o.value = p.id; o.textContent = p.label; sel.appendChild(o);
  });
  $('mapAddBtn').disabled = !sel.options.length;
}
function mapBase(){
  var asset = getPhotoAsset(PE.productId, PE.view);
  var key = PE.productId + '|' + PE.view + '|' + (asset ? asset.key : 'vec');
  if(MAP.base && MAP.baseKey === key) return MAP.base;
  var save = project.productId; /* compositeView reads project.work; draw the base only */
  var c = document.createElement('canvas'); c.width = c.height = MAP_PX;
  var ctx = c.getContext('2d');
  var def = PRODUCTS_BY_ID[PE.productId];
  if(asset){
    var base = recolorGarment(asset, '#D9D9D3', 'cotton'), p = asset.place;
    ctx.drawImage(base, p.dx*MAP_S, p.dy*MAP_S, p.dw*MAP_S, p.dh*MAP_S);
  } else if(def){
    var sc = state.color; state.color = '#D9D9D3';
    ctx.save(); ctx.scale(MAP_S, MAP_S); (def.views[PE.view] || def.views.front).paint(ctx, palette(), { w:1, l:1 }); ctx.restore();
    state.color = sc;
  }
  MAP.base = c; MAP.baseKey = key;
  return c;
}
function mapDraw(){
  var c = $('mapCanvas'); if(!c || $('peMapStage').classList.contains('hidden')) return;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, MAP_PX, MAP_PX);
  edDrawChecker(ctx, 0, 0, MAP_PX, MAP_PX);
  ctx.drawImage(mapBase(), 0, 0);
  MAP.list.forEach(function(pl){
    var q = pl.quad.map(function(p){ return [p[0]*MAP_S, p[1]*MAP_S]; }), on = pl.panel === MAP.sel;
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for(var i=1;i<4;i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath();
    ctx.fillStyle = on ? 'rgba(195,66,63,0.22)' : 'rgba(30,39,73,0.12)'; ctx.fill();
    ctx.strokeStyle = on ? '#C3423F' : '#1E2749'; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    var cc = quadCentre(q), p = panelById(PE.productId, pl.panel);
    ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(251,251,247,0.9)'; var tw = ctx.measureText((p ? p.label : pl.panel).toUpperCase()).width + 10;
    ctx.fillRect(cc[0]-tw/2, cc[1]-8, tw, 16);
    ctx.fillStyle = '#1E2749'; ctx.fillText((p ? p.label : pl.panel).toUpperCase(), cc[0], cc[1]);
    if(on){
      q.forEach(function(pt, i){
        ctx.beginPath(); ctx.arc(pt[0], pt[1], HANDLE_R, 0, Math.PI*2);
        ctx.fillStyle = i === 0 ? '#C3423F' : '#FBFBF7'; ctx.fill();
        ctx.strokeStyle = '#C3423F'; ctx.lineWidth = 2; ctx.stroke();
      });
    }
  });
}
function mapPoint(e){
  var c = $('mapCanvas'), r = c.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (MAP_PX / r.width), y: (e.clientY - r.top) * (MAP_PX / r.height) };
}
function mapDown(e){
  var p = mapPoint(e), pl = mapSel();
  if(pl){
    for(var i=0;i<4;i++){
      var hx = pl.quad[i][0]*MAP_S, hy = pl.quad[i][1]*MAP_S;
      if(Math.abs(p.x-hx) <= HANDLE_R*1.8 && Math.abs(p.y-hy) <= HANDLE_R*1.8){ MAP.drag = { corner:i }; try { $('mapCanvas').setPointerCapture(e.pointerId); } catch(err){} return; }
    }
    if(pointInQuad(pl.quad, p.x/MAP_S, p.y/MAP_S)){ MAP.drag = { move:true, last:p }; try { $('mapCanvas').setPointerCapture(e.pointerId); } catch(err){} return; }
  }
  /* click another panel's quad to select it */
  for(var k=MAP.list.length-1;k>=0;k--){
    if(pointInQuad(MAP.list[k].quad, p.x/MAP_S, p.y/MAP_S)){ MAP.sel = MAP.list[k].panel; mapSyncPanelSeg(); mapDraw(); return; }
  }
}
function mapMove(e){
  if(!MAP.drag) return;
  var p = mapPoint(e), pl = mapSel(); if(!pl) return;
  if(MAP.drag.corner !== undefined){
    pl.quad[MAP.drag.corner] = [Math.round(Math.max(0, Math.min(DS, p.x/MAP_S))), Math.round(Math.max(0, Math.min(DS, p.y/MAP_S)))];
  } else if(MAP.drag.move){
    var dx = (p.x - MAP.drag.last.x)/MAP_S, dy = (p.y - MAP.drag.last.y)/MAP_S;
    pl.quad = pl.quad.map(function(pt){ return [Math.round(pt[0]+dx), Math.round(pt[1]+dy)]; });
    MAP.drag.last = p;
  }
  mapDraw();
}
function mapUp(){ MAP.drag = null; }

/* ============================================================
   client: my own products (private, no PIN needed)
   ============================================================ */
var NP = { view:'front', img:null, key:null, rect:null, draw:null, mode:'key', dragging:false, dragStart:null, productId:null, hasBack:false };
var npViews = { front:{img:null,key:null,rect:null}, back:{img:null,key:null,rect:null} };
var npSavedViews = { front:false, back:false };

function npStashCurrent(){ npViews[NP.view] = { img:NP.img, key:NP.key, rect:NP.rect }; }
function npSyncModeBtns(){
  $('npModeKeyBtn').classList.toggle('on', NP.mode === 'key');
  $('npModeRectBtn').classList.toggle('on', NP.mode === 'rect');
}
function npUpdateStatus(){
  if(npSavedViews[NP.view]){ $('npStatus').textContent = 'Saved — upload again to replace it.'; return; }
  if(!NP.img){ $('npStatus').textContent = 'Upload a photo to begin.'; return; }
  if(!NP.key && !NP.transparent){ $('npStatus').textContent = 'Click on the background to remove it.'; return; }
  if(!NP.rect){ $('npStatus').textContent = 'Now switch to "Set print panel" and drag a box where prints should go.'; return; }
  $('npStatus').textContent = 'Looks good — hit "Save this view".';
}
function npUpdateDoneState(){
  var ready = npSavedViews.front && (!NP.hasBack || npSavedViews.back);
  $('npDoneBtn').disabled = !ready;
}
function npLoadView(v){
  NP.view = v;
  var s = npViews[v] || { img:null, key:null, rect:null };
  NP.img = s.img; NP.key = s.key; NP.rect = s.rect; NP.mode = 'key'; NP.draw = null;
  edDrawPreview(NP, 'npCanvas');
  npSyncModeBtns();
  npUpdateStatus();
  $('npSaveViewBtn').disabled = !NP.img;
}
function npResetAll(){
  NP.productId = null; NP.hasBack = false; NP.view = 'front';
  npViews = { front:{img:null,key:null,rect:null}, back:{img:null,key:null,rect:null} };
  npSavedViews = { front:false, back:false };
  $('mpName').value = '';
  $('npHasBack').checked = false;
  $('npViewBack').classList.add('hidden');
  document.querySelectorAll('#npViewSeg button').forEach(function(b){ b.classList.toggle('on', b.dataset.v === 'front'); });
  npLoadView('front');
  $('npDoneBtn').disabled = true;
}
function mpRenderList(){
  var host = $('mpListItems');
  host.innerHTML = '';
  if(!customProducts.length){
    var p = document.createElement('p');
    p.className = 'tiny'; p.textContent = 'No products yet — add your first one below.';
    host.appendChild(p);
    return;
  }
  customProducts.forEach(function(cp){
    var row = document.createElement('div');
    row.className = 'rowline'; row.style.justifyContent = 'space-between';
    var name = document.createElement('button');
    name.className = 'btn ghost small'; name.style.flex = '1'; name.style.textAlign = 'left';
    name.textContent = cp.name + (cp.hasBack ? ' (front + back)' : ' (front)');
    name.setAttribute('aria-label', 'Open ' + cp.name);
    name.addEventListener('click', function(){ closeModal('myProductsModal'); buildProduct(cp.id); });
    var del = document.createElement('button');
    del.className = 'btn ghost small'; del.textContent = 'Delete'; del.setAttribute('aria-label', 'Delete ' + cp.name);
    del.addEventListener('click', async function(){
      if(!window.confirm('Delete "' + cp.name + '"? Its photos and any design on it are removed. This can’t be undone.')) return;
      await deleteCustomProduct(cp.id);
      mpRenderList();
      renderRack();
    });
    row.appendChild(name); row.appendChild(del);
    host.appendChild(row);
  });
}
function bindMyProducts(){
  edBindCanvas(NP, 'npCanvas', function(){ npUpdateStatus(); });
  $('myProductsBtn').addEventListener('click', function(){
    if(!trialAllows('my_products')) return;
    $('mpCreate').classList.add('hidden');
    $('mpList').classList.remove('hidden');
    mpRenderList();
    openModal('myProductsModal');
  });
  $('mpAddBtn').addEventListener('click', function(){
    npResetAll();
    $('mpList').classList.add('hidden');
    $('mpCreate').classList.remove('hidden');
  });
  $('npCancelBtn').addEventListener('click', async function(){
    if(NP.productId && !(npSavedViews.front && (!NP.hasBack || npSavedViews.back))){
      await deleteCustomProduct(NP.productId);
      renderRack();
    }
    $('mpCreate').classList.add('hidden');
    $('mpList').classList.remove('hidden');
    mpRenderList();
  });
  $('npHasBack').addEventListener('change', function(){
    NP.hasBack = this.checked;
    $('npViewBack').classList.toggle('hidden', !NP.hasBack);
    npUpdateDoneState();
  });
  $('npViewSeg').addEventListener('click', function(e){
    var b = e.target.closest('button');
    if(!b || !b.dataset.v || b.classList.contains('hidden')) return;
    npStashCurrent();
    document.querySelectorAll('#npViewSeg button').forEach(function(x){ x.classList.toggle('on', x === b); });
    npLoadView(b.dataset.v);
  });
  $('npUploadBtn').addEventListener('click', function(){ $('npFile').click(); });
  $('npFile').addEventListener('change', function(){
    var f = this.files[0]; this.value = '';
    edLoadFile(NP, f, 'npCanvas', function(){
      NP.transparent = edHasAlpha(NP.img);
      if(NP.transparent) NP.mode = 'rect';
      npSavedViews[NP.view] = false;
      npSyncModeBtns();
      npUpdateStatus();
      $('npSaveViewBtn').disabled = false;
    });
  });
  $('npModeKeyBtn').addEventListener('click', function(){ NP.mode = 'key'; npSyncModeBtns(); npUpdateStatus(); });
  $('npModeRectBtn').addEventListener('click', function(){
    NP.mode = 'rect'; npSyncModeBtns();
    $('npStatus').textContent = 'Drag a box over where prints should go.';
  });
  $('npSaveViewBtn').addEventListener('click', async function(){
    if(!NP.img){ $('npStatus').textContent = 'Upload a photo first.'; return; }
    if(!NP.key && !NP.transparent){ $('npStatus').textContent = 'Click the background to remove it first.'; return; }
    if(!NP.rect || NP.rect.w < 0.03 || NP.rect.h < 0.03){ $('npStatus').textContent = 'Drag a print-panel box first.'; return; }
    var name = $('mpName').value.trim();
    if(!name){ $('npStatus').textContent = 'Give your product a name first.'; return; }
    var wcm = Math.max(1, +$('npWcm').value || 30), hcm = Math.max(1, +$('npHcm').value || 35);
    this.disabled = true; this.textContent = 'Saving…';
    if(!NP.productId){
      var panels = [ { id:'front', label:'Front', w_cm:wcm, h_cm:hcm } ];
      if(NP.hasBack) panels.push({ id:'back', label:'Back', w_cm:wcm, h_cm:hcm });
      var cp = await addCustomProduct(name, NP.hasBack, panels);
      NP.productId = cp.id;
    }
    var dataUrl = await edProcessedDataUrl(NP);
    var r = await savePhotoAsset(NP.productId, NP.view, dataUrl);
    if(r.ok){
      var iw = NP.img.naturalWidth, ih = NP.img.naturalHeight;
      await savePlacements(NP.productId, NP.view, [ { panel: NP.view === 'back' ? 'back' : 'front', quad: photoRectToQuad(NP.rect, iw, ih) } ]);
      npSavedViews[NP.view] = true;
      inlineErr('npSaveViewBtn', '');
    } else inlineErr('npSaveViewBtn', 'Could not save: ' + r.reason);
    this.disabled = false; this.textContent = 'Save this view';
    npUpdateStatus();
    npUpdateDoneState();
  });
  $('npDoneBtn').addEventListener('click', function(){
    closeModal('myProductsModal');
    $('mpCreate').classList.add('hidden');
    $('mpList').classList.remove('hidden');
    renderRack();
    buildProduct(NP.productId);
  });
}

/* ============================================================
   EXPORT
   ============================================================ */
function bindExport(){
  $('exportBtn').addEventListener('click', function(){
    if(!trialAllows('export', project.productId)) return;
    $('exProgress').textContent = ''; $('exOpenMsg').textContent = '';
    var warns = [];
    panelsFor(project.productId).forEach(function(p){
      var d = panelLowestDpi(p.id);
      if(d !== null && d < 150) warns.push(p.label + ' has artwork at ' + d + ' DPI — it will print blurred.');
      techniqueWarnings(p.id).forEach(function(w){ warns.push(p.label + ': ' + w); });
      var px = printPxFor(p);
      if(px.capped && layersFor(p.id).length) warns.push(p.label + ' prints at ' + px.dpi + ' DPI: a whole-piece file is capped at 6000 px on its long edge.');
    });
    $('exWarn').textContent = warns.join(' ');
    $('exWm').checked = locked || DEMO_MODE;
    var three = is3D(project.productId);
    $('exMockNote').textContent = three ? 'The 3D tee from six angles (front, back, three-quarter, both sides, underarm) at 2048 px, PNG' : 'Every photographed view at 2400 px, PNG';
    $('exPrintNote').textContent = three ? 'One transparent PNG per sewn piece, cut to its shape, up to 300 DPI' : 'One transparent PNG per designed panel at 300 DPI';
    openModal('exportModal');
  });
  $('exGo').addEventListener('click', runExport);
  $('exOpenBtn').addEventListener('click', function(){ $('exOpenFile').click(); });
  $('exOpenFile').addEventListener('change', function(){
    var f = this.files[0]; this.value = '';
    if(!f) return;
    var rd = new FileReader();
    rd.onload = async function(){
      try {
        var obj = JSON.parse(rd.result);
        await restoreProject(obj);
        gmsg('exOpenMsg', 'Project restored — ' + PRODUCTS_BY_ID[project.productId].name + '.', true);
        setTimeout(function(){ closeModal('exportModal'); }, 700);
      } catch(e){ gmsg('exOpenMsg', 'Could not open: ' + e.message); }
    };
    rd.readAsText(f);
  });
}
function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
async function runExport(){
  var btn = $('exGo'); btn.disabled = true;
  track('export', project.productId, [['exMock', 'mockups'], ['exPrint', 'print files'], ['exTech', 'tech pack'], ['exProj', 'project file']]
    .filter(function(x){ return $(x[0]).checked; }).map(function(x){ return x[1]; }).join(', '));
  var prog = $('exProgress');
  var name = safeName(currentDef().name), items = [], i;
  function step(t){ prog.className = 'gmsg ok'; prog.textContent = t; }
  try {
    if($('exMock').checked && is3D(project.productId)){
      var bg3 = document.querySelector('input[name=exBg]:checked').value, wm3 = $('exWm').checked;
      if(!(await s3dEnsure())) throw new Error(S3D.failed || 'the 3D studio could not start');
      var v3 = [['front', 'front'], ['back', 'back'], ['q34', 'three-quarter'], ['left', 'left'], ['right', 'right'], ['armpit', 'underarm']];
      for(i=0;i<v3.length;i++){
        step('Rendering 3D mockup ' + (i+1) + ' of ' + v3.length + '…'); await wait(30);
        var c3 = s3dRenderView(v3[i][0], 2048, { bg: bg3, watermark: wm3 });
        await downloadCanvas(c3, name + '_3d_' + v3[i][1] + '_' + safeName(colorNameFor(project.garmentColor)) + '.png');
        await wait(600);
      }
    } else if($('exMock').checked){
      var bg = document.querySelector('input[name=exBg]:checked').value, wm = $('exWm').checked;
      var views = VIEWS.filter(function(v){ return !!getPhotoAsset(project.productId, v.id); });
      if(!views.length) views = availableViews(project.productId);
      for(i=0;i<views.length;i++){
        step('Rendering mockup ' + (i+1) + ' of ' + views.length + '…'); await wait(20);
        var c = compositeView(project.productId, views[i].id, { px: 2400, bg: bg, watermark: wm });
        await downloadCanvas(c, name + '_' + views[i].id + '_' + safeName(colorNameFor(project.garmentColor)) + '.png');
        await wait(600);
      }
    }
    if($('exPrint').checked){
      var panels = panelsFor(project.productId).filter(function(p){ return layersFor(p.id).length > 0; });
      if(!panels.length) step('No panel has artwork yet — nothing to print.');
      for(i=0;i<panels.length;i++){
        var p = panels[i], px = printPxFor(p);
        step('Rendering print file ' + (i+1) + ' of ' + panels.length + ' (' + px.w + '×' + px.h + ' px)…'); await wait(20);
        var ab = printPiece(p, renderArtboard(p.id, px.px, null, { w: px.w, h: px.h }));
        await downloadCanvas(ab, 'PRINT_' + name + '_' + p.id + '_' + p.w_cm + 'x' + p.h_cm + 'cm_' + px.dpi + 'dpi.png');
        await wait(600);
      }
    }
    if($('exTech').checked){ step('Building tech pack…'); if(is3D(project.productId)) await s3dEnsure(); await wait(20); openTechPack(); await wait(600); }
    if($('exProj').checked){
      step('Writing project.json…'); await wait(20);
      downloadText(JSON.stringify(serialiseProject(true)), name + '_project.json');
    }
    step('Done.');
  } catch(e){ prog.className = 'gmsg err'; prog.textContent = 'Export failed: ' + e.message; }
  btn.disabled = false;
}
/* a pattern piece prints in its own shape: everything outside the cut line is transparent */
function printPiece(p, art){
  if(!p.outline || !p.outline.length) return art;
  var c = document.createElement('canvas'); c.width = art.width; c.height = art.height;
  var g = c.getContext('2d'), kx = art.width / p.w_cm, ky = art.height / p.h_cm;
  g.beginPath(); p.outline.forEach(function(q, i){ if(i) g.lineTo(q[0] * kx, q[1] * ky); else g.moveTo(q[0] * kx, q[1] * ky); }); g.closePath(); g.clip();
  g.drawImage(art, 0, 0);
  return c;
}
/* load the 3D studio on demand (exports can need it before the customer opened the 3D view) */
async function s3dEnsure(){
  if(typeof S3D === 'undefined') return false;
  if(S3D.ready) return true;
  return s3dInit($('gl3d'));
}
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
function openTechPack(){
  var def = currentDef(), panels = panelsFor(project.productId), front, back, backHas;
  if(is3D(project.productId) && S3D.ready){
    front = s3dRenderView('front', 900, { bg: 'studio' }).toDataURL('image/png');
    back = s3dRenderView('back', 900, { bg: 'studio' }).toDataURL('image/png');
  } else {
    front = compositeView(project.productId, 'front', { px: 900, stamp:false }).toDataURL('image/png');
    backHas = availableViews(project.productId).some(function(v){ return v.id === 'back'; });
    back = backHas ? compositeView(project.productId, 'back', { px: 900, stamp:false }).toDataURL('image/png') : null;
  }
  var rows = '', thumbs = '';
  panels.forEach(function(p){
    var ab = artboardSize(p), t = renderPanelThumb(p.id, 300, project.garmentColor);
    thumbs += '<figure><img src="' + t.toDataURL('image/png') + '"><figcaption>' + esc(p.label) + ' — ' + p.w_cm + ' × ' + p.h_cm + ' cm · ' + esc((panelWork(p.id).technique || 'dtg').toUpperCase()) + '</figcaption></figure>';
    layersFor(p.id).forEach(function(l){
      var wcm = (l.w / ab.pxPerCm).toFixed(1), hcm = (l.h / ab.pxPerCm).toFixed(1), xcm = (l.x / ab.pxPerCm).toFixed(1), ycm = (l.y / ab.pxPerCm).toFixed(1);
      var d = layerDpi(p.id, l);
      var kind = { image: 'Image', text: 'Text', shape: 'Shape', path: 'Brush stroke', fill: 'Fill' }[l.type] || l.type;
      rows += '<tr><td>' + esc(p.label) + '</td><td>' + esc(l.name || l.type) + '</td><td>' + esc(kind) + (l.type === 'text' ? ': “' + esc(l.text) + '”' : '') + '</td><td>' + wcm + ' × ' + hcm + '</td><td>' + xcm + ', ' + ycm + '</td><td>' + (l.rot || 0) + '°</td><td>' + (d === null ? '—' : d) + '</td></tr>';
    });
  });
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tech pack — ' + esc(def.name) + '</title><style>' +
    'body{font-family:Archivo,system-ui,sans-serif;color:#1E2749;margin:28px;font-size:12px}h1{font-family:Georgia,serif;font-size:26px;margin:0 0 4px}' +
    '.mono{font-family:"IBM Plex Mono",Menlo,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#5A6178}' +
    '.row{display:flex;gap:18px;margin:18px 0}.row img{width:46%;border:1px solid #CDD0C4}' +
    '.thumbs{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0}figure{margin:0;width:140px}figure img{width:100%;border:1px solid #CDD0C4}figcaption{font-size:10px;margin-top:4px}' +
    'table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border-bottom:1px solid #CDD0C4;padding:5px 6px;text-align:left;font-size:11px}th{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase}' +
    '.chip{display:inline-block;width:14px;height:14px;border:1px solid #999;vertical-align:middle;margin-right:6px}hr{border:none;border-top:1px solid #1E2749;margin:14px 0}@page{margin:14mm}</style></head><body>' +
    '<div class="mono">Seif Studio · tech pack · ' + new Date().toLocaleDateString() + '</div><h1>' + esc(def.name) + '</h1><div class="mono">SKU ' + esc(def.sku) + ' · ' + esc(def.spec) + '</div><hr>' +
    '<div><span class="chip" style="background:' + project.garmentColor + '"></span><b>' + esc(colorNameFor(project.garmentColor)) + '</b> ' + project.garmentColor.toUpperCase() + (project.fabricNote ? ' · ' + esc(project.fabricNote) : '') + ' · fabric preset: ' + esc(state.fabric) + '</div>' +
    '<div class="row"><img src="' + front + '">' + (back ? '<img src="' + back + '">' : '') + '</div>' +
    '<div class="mono">Panels</div><div class="thumbs">' + thumbs + '</div>' +
    '<div class="mono">Layers</div><table><thead><tr><th>Panel</th><th>Layer</th><th>Type</th><th>Size cm</th><th>Position cm</th><th>Rotation</th><th>DPI</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7">No layers.</td></tr>') + '</tbody></table>' +
    '</body></html>';
  var f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:900px;border:0';
  document.body.appendChild(f);
  f.srcdoc = html;
  f.onload = function(){
    setTimeout(function(){
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){}
      setTimeout(function(){ f.remove(); }, 60000);
    }, 400);
  };
}

/* ============================================================
   bottom sheet (phones): peek / half / full
   ============================================================ */
function bindSheet(){
  var sheet = $('sheet'), handle = $('sheetHandle'), st = null, order = ['peek','half','full'], cur = 'peek';
  function setDetent(d){ cur = d; sheet.classList.toggle('half', d === 'half'); sheet.classList.toggle('full', d === 'full'); }
  handle.addEventListener('pointerdown', function(e){ st = { y: e.clientY, t: Date.now() }; sheet.classList.add('dragging'); handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', function(e){
    if(!st) return;
    var dy = e.clientY - st.y, base = { peek: window.innerHeight*0.82 - 56, half: window.innerHeight*0.82 - window.innerHeight*0.46, full: 0 }[cur];
    sheet.style.transform = 'translateY(' + Math.max(0, base + dy) + 'px)';
  });
  handle.addEventListener('pointerup', function(e){
    if(!st) return;
    var dy = e.clientY - st.y; sheet.classList.remove('dragging'); sheet.style.transform = '';
    var i = order.indexOf(cur);
    if(dy < -40) i = Math.min(2, i + 1); else if(dy > 40) i = Math.max(0, i - 1);
    else if(Date.now() - st.t < 250) i = (i + 1) % 3;
    setDetent(order[i]); st = null;
  });
  handle.addEventListener('click', function(){ if(!st) setDetent(cur === 'peek' ? 'half' : (cur === 'half' ? 'full' : 'peek')); });
  window.sheetDetent = setDetent;
}

/* ============================================================
   panel sheet (DESIGN landing)
   ============================================================ */
function renderPanelSheet(){
  var host = $('panelCards'); if(!host) return;
  var panels = panelsFor(project.productId);
  host.innerHTML = '';
  $('psMeta').textContent = panels.length + ' PANEL' + (panels.length === 1 ? '' : 'S') + ' · ' + colorNameFor(project.garmentColor).toUpperCase();
  if(!panels.length){ host.innerHTML = '<p class="tiny">This product has no panels defined yet.</p>'; return; }
  var maxCm = 0; panels.forEach(function(p){ maxCm = Math.max(maxCm, p.w_cm, p.h_cm); });
  var k = 260 / maxCm, narrow = window.innerWidth <= 900;
  panels.forEach(function(p){
    var card = document.createElement('div'); card.className = 'pcard';
    card.setAttribute('role', 'button'); card.tabIndex = 0; card.setAttribute('aria-label', 'Edit ' + p.label + ' panel');
    var w = Math.max(112, p.w_cm * k), h = Math.max(60, p.h_cm * k);
    if(narrow){ card.style.width = '100%'; } else { card.style.width = w + 'px'; }
    var thumb = document.createElement('div'); thumb.className = 'thumb'; thumb.style.height = (narrow ? Math.min(240, h) : h) + 'px';
    var cnv = renderPanelThumb(p.id, 260, project.garmentColor);
    thumb.appendChild(cnv);
    var safe = document.createElement('div'); safe.className = 'safe'; thumb.appendChild(safe);
    var meta = document.createElement('div'); meta.className = 'meta';
    var n = layersFor(p.id).length, dpi = panelLowestDpi(p.id), tech = panelWork(p.id).technique || 'dtg';
    meta.innerHTML = '<b>' + p.label + '</b><span class="speclabel">' + p.w_cm + ' × ' + p.h_cm + ' cm</span>';
    var row = document.createElement('div'); row.className = 'metarow';
    if(dpi !== null){ var dot = document.createElement('span'); dot.className = 'dpidot ' + dpiGrade(dpi); dot.title = dpiTip(dpi); row.appendChild(dot); }
    var cnt = document.createElement('span'); cnt.className = 'speclabel'; cnt.textContent = n + ' layer' + (n === 1 ? '' : 's'); row.appendChild(cnt);
    if(tech !== 'dtg'){ var bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = TECHNIQUES[tech].label; row.appendChild(bd); }
    var ed = document.createElement('button'); ed.className = 'btn small primary edit'; ed.textContent = 'Edit'; ed.tabIndex = -1; row.appendChild(ed);
    meta.appendChild(row);
    card.appendChild(thumb); card.appendChild(meta);
    card.addEventListener('click', function(){ abOpen(p.id); });
    card.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abOpen(p.id); } });
    host.appendChild(card);
  });
}

/* ============================================================
   resume / onboarding / boot
   ============================================================ */
async function offerResume(){
  var idx = await loadSavedProjectIndex();
  if(!idx || !idx.productId) return;
  if(!hasFullAccess() && idx.productId !== TRIAL_PRODUCT) return;   /* the trial only reopens the T-shirt */
  $('resumeTxt').textContent = 'Continue where you left off? ' + idx.productName + ' — saved ' + fmtTime(idx.savedAt) + '.';
  $('resumeStrip').classList.remove('hidden');
  $('resumeYes').onclick = async function(){
    try { await restoreSavedProject(idx.productId); }
    catch(e){ inlineErr('resumeTxt', 'Could not restore: ' + e.message); return; }
    $('resumeStrip').classList.add('hidden');
  };
  $('resumeNo').onclick = function(){ $('resumeStrip').classList.add('hidden'); };
}
async function maybeOnboard(){
  var seen = await store.get('seifstudio:onboarded', false);
  if(seen) return;
  openModal('onboard');
  $('obGo').onclick = async function(){ await store.set('seifstudio:onboarded', { ts: Date.now() }, false); closeModal('onboard'); };
}
async function init(){
  /* the session decides where personal data lives (account or this browser), so it comes first */
  var active = await checkSession();
  if(!DEMO_MODE){
    if(!account.signedIn) loadFirebase().catch(function(){});
    await store.loadSharedKeys();
    if(active) await migrateLocalWork();
    if(account.owner) await migrateSharedSettings();
  }
  await loadGarmentColors();
  await loadCustomProducts();
  bindProjectProduct('tee');
  renderRack();
  renderSwatches();
  bindUI();
  bindGate();
  bindLock();
  bindPhotoEditor();
  bindColorsAdmin();
  bindMyProducts();
  bindExport();
  bindSheet();
  bindTurntable();
  if(typeof bindEditor === 'function') bindEditor();
  $('boot').style.display = 'none';
  $('demoBanner').classList.toggle('hidden', !DEMO_MODE);
  showStudio();
  if(typeof bindStudio3d === 'function') bindStudio3d();
  buildProduct(TRIAL_PRODUCT);
  setMode(is3D(TRIAL_PRODUCT) ? '3d' : 'design');
  onHistoryChanged();
  unlockStudio();          /* nobody is locked out: the T-shirt is the free trial */
  renderAccount();
  if(!DEMO_MODE) trackVisit();
  if(CFG.admin && account.owner){ openOwnerDashboard(); return; }
  await offerResume();
  maybeOnboard();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
