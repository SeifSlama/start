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
      b.className = 'rackitem' + (p.id === project.productId ? ' on' : '');
      b.dataset.pid = p.id;
      b.setAttribute('aria-label', p.name + (productHasWork(p.id) ? ' (has a design)' : ''));
      b.innerHTML = '<span class="sku">' + p.sku + '</span><span>' + p.name + '</span>' + (productHasWork(p.id) ? '<span class="dot" title="Has a design"></span>' : '');
      b.addEventListener('click', function(){ if(p.id !== project.productId) buildProduct(p.id); });
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
  ['swatches','swatches2'].forEach(function(hid){
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
  ['customColor','customColor2'].forEach(function(id){ var el = $(id); if(el) el.value = project.garmentColor; });
}

/* ---------- modes & panes ---------- */
function setMode(mode){
  state.mode = mode;
  document.querySelectorAll('#modeSeg button').forEach(function(b){
    var on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
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
  $('sheetSheet').classList.toggle('hidden', which !== 'sheet');
  $('sheetEditor').classList.toggle('hidden', which !== 'editor');
  $('sheetPreview').classList.toggle('hidden', which !== 'floor');
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
  if(state.mode === 'preview'){ renderViewSeg(); syncFitVisibility(); }
  else showPane('sheet');
  if(typeof abClose === 'function') abClose(true);
}
function onProjectChanged(panelId){
  syncRack();
  if(state.mode === 'design' && !state.panel) renderPanelSheet();
  if(typeof abOnProjectChanged === 'function') abOnProjectChanged(panelId);
  if(state.mode === 'preview') requestRender();
  $('saveStatus').textContent = 'UNSAVED';
}
function onHistoryChanged(){
  var u = $('undoBtn'), r = $('redoBtn');
  u.disabled = !hist.undo.length; r.disabled = !hist.redo.length;
  u.title = undoLabel() ? 'Undo ' + undoLabel().toLowerCase() + ' (Ctrl+Z)' : 'Nothing to undo';
  r.title = redoLabel() ? 'Redo ' + redoLabel().toLowerCase() + ' (Ctrl+Shift+Z)' : 'Nothing to redo';
}
function onAutosaved(ts){ $('saveStatus').textContent = 'SAVED ' + new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
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
  document.querySelectorAll('#modeSeg button').forEach(function(b){ b.addEventListener('click', function(){ setMode(b.dataset.mode); }); });
  $('psPreviewBtn').addEventListener('click', function(){ setMode('preview'); });
  $('editPanelsBtn').addEventListener('click', function(){ setMode('design'); });

  ['customColor','customColor2'].forEach(function(id){
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
    await store.del(K_ACCESS, false);
    if(!DEMO_MODE) fetch(API_BASE + '/api/logout', { method:'POST', credentials:'include' }).catch(function(){});
    lockStudio();
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
   ACCESS — preview lock / invite / pay
   DEMO_MODE: everything is local and nothing is enforced.
   Otherwise the server decides: /api/session, /api/redeem, /api/checkout.
   ============================================================ */
var locked = true;
function showStudio(){ $('app').classList.add('on'); }
function lockStudio(){
  locked = true;
  $('app').classList.add('locked');
  $('lockShield').classList.add('on');
  $('lockBar').classList.add('on');
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function unlockStudio(){
  locked = false;
  $('app').classList.remove('locked');
  $('lockShield').classList.remove('on');
  $('lockBar').classList.remove('on');
  closeModal('gate');
}
function openGate(){
  $('priceTag').textContent = PRICE + ' · PER ' + PRICE_PERIOD.replace('/', '').toUpperCase();
  $('inviteMsg').textContent = '';
  openModal('gate');
  var bar = $('lockBar');
  bar.classList.remove('shake'); void bar.offsetWidth; bar.classList.add('shake');
  setTimeout(function(){ try { $('inviteInput').focus(); } catch(e){} }, 50);
}
async function grant(method){
  await store.set(K_ACCESS, { m:method, ts:Date.now() }, false);
  closeModal('payModal'); closeModal('adminModal');
  $('inviteInput').value = ''; $('inviteBtn').disabled = false;
  unlockStudio();
}
async function api(path, body, opts){
  var o = { method: body ? 'POST' : 'GET', credentials:'include', headers:{} };
  if(body){ o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  if(opts && opts.token) o.headers['Authorization'] = 'Bearer ' + opts.token;
  var r = await fetch(API_BASE + path, o);
  var j = null; try { j = await r.json(); } catch(e){}
  if(!r.ok){ var err = new Error((j && j.error) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
  return j || {};
}
async function checkSession(){
  if(DEMO_MODE){ var acc = await store.get(K_ACCESS, false); return !!acc; }
  try { var s = await api('/api/session'); return !!s.active; } catch(e){ return false; }
}
function bindLock(){
  $('lockShield').addEventListener('click', function(e){ e.preventDefault(); openGate(); });
  $('lockBarBtn').addEventListener('click', openGate);
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
  $('inviteBtn').addEventListener('click', async function(){
    var code = $('inviteInput').value.trim().toUpperCase();
    if(!code){ gmsg('inviteMsg','Type your invite code first.'); return; }
    this.disabled = true;
    var btn = this;
    if(DEMO_MODE){
      var data = await store.get(K_INVITES, true);
      var list = (data && data.codes) ? data.codes : [];
      var hit = null;
      for(var i=0;i<list.length;i++){ if(list[i].c === code && list[i].active){ hit = list[i]; break; } }
      if(hit){ hit.uses = (hit.uses || 0) + 1; await store.set(K_INVITES, { codes:list }, true); }
      if(hit || code === FALLBACK_CODE){
        gmsg('inviteMsg','Code accepted — welcome in.', true);
        setTimeout(function(){ grant('invite'); }, 350);
      } else { gmsg('inviteMsg','That code isn’t valid or was revoked. (Demo build: the code DEMO always works.)'); btn.disabled = false; }
      return;
    }
    try {
      await api('/api/redeem', { code: code });
      gmsg('inviteMsg','Code accepted — welcome in.', true);
      setTimeout(function(){ grant('invite'); }, 350);
    } catch(e){
      gmsg('inviteMsg', e.status === 429 ? 'Too many attempts — try again in an hour.' : 'That code isn’t valid or was revoked.');
      btn.disabled = false;
    }
  });
  $('inviteInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('inviteBtn').click(); });

  $('payOpenBtn').addEventListener('click', function(){
    $('payPrice').textContent = PRICE + PRICE_PERIOD;
    $('payDemo').classList.toggle('hidden', !DEMO_MODE);
    $('payFrameWrap').classList.add('hidden');
    $('payMethods').classList.remove('hidden');
    $('payMsg').textContent = '';
    openModal('payModal');
  });
  document.querySelectorAll('#payMethods button').forEach(function(b){
    b.addEventListener('click', async function(){
      var method = b.dataset.pay;
      if(DEMO_MODE){
        gmsg('payMsg', 'Demo build — no provider connected. Entering the studio without payment.', true);
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

  /* admin */
  $('adminOpenBtn').addEventListener('click', function(){
    openModal('adminModal');
    $('pinInput').value = '';
    $('adminLock').classList.remove('hidden');
    $('adminPanel').classList.add('hidden');
  });
  $('pinBtn').addEventListener('click', async function(){
    var pin = $('pinInput').value;
    if(DEMO_MODE ? pin === ADMIN_PIN : false){
      adminToken = null; openAdminPanel(); return;
    }
    if(!DEMO_MODE){
      try { await api('/api/admin/codes', null, { token: pin }); adminToken = pin; openAdminPanel(); return; }
      catch(e){ gmsg('pinMsg', 'Not authorised.'); return; }
    }
    gmsg('pinMsg','Wrong PIN. (Demo build: the PIN is DEMO.)');
  });
  $('pinInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('pinBtn').click(); });
  $('genBtn').addEventListener('click', async function(){
    if(DEMO_MODE){
      var data = await store.get(K_INVITES, true);
      var list = (data && data.codes) ? data.codes : [];
      list.unshift({ c:'SEIF-' + rand4() + '-' + rand4(), active:true, uses:0 });
      var saved = await store.set(K_INVITES, { codes:list }, true);
      renderCodes(list, saved.ok);
      return;
    }
    try { await api('/api/admin/codes', { action:'create' }, { token: adminToken }); renderCodes(); }
    catch(e){ inlineErr('genBtn', 'Could not create a code: ' + e.message); }
  });
  $('adminEnterBtn').addEventListener('click', function(){ grant('admin'); });
  $('adTabCodes').addEventListener('click', function(){ adminTab('codes'); });
  $('adTabPhotos').addEventListener('click', function(){ adminTab('photos'); });
  $('adTabColors').addEventListener('click', function(){ adminTab('colors'); });
}
var adminToken = null, sessionPoll = null;
function pollSession(){
  clearInterval(sessionPoll);
  sessionPoll = setInterval(async function(){
    if(await checkSession()){ clearInterval(sessionPoll); grant('card'); }
  }, 4000);
}
function openAdminPanel(){
  $('adminLock').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  $('adCodesSub').textContent = DEMO_MODE
    ? 'Demo build: codes live in this browser only and are not enforced. The deployed build keeps them on the server.'
    : 'Invite codes are checked by the server. Revoked codes stop working immediately.';
  adminTab('codes');
  renderCodes();
  peInit();
  renderColorRows();
}
function adminTab(t){
  $('adTabCodes').classList.toggle('on', t === 'codes');
  $('adTabPhotos').classList.toggle('on', t === 'photos');
  $('adTabColors').classList.toggle('on', t === 'colors');
  $('adCodes').classList.toggle('hidden', t !== 'codes');
  $('adPhotos').classList.toggle('hidden', t !== 'photos');
  $('adColors').classList.toggle('hidden', t !== 'colors');
  if(t === 'photos') peStage(PE.stage);
}
function rand4(){
  var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = '';
  for(var i=0;i<4;i++) s += A[Math.floor(Math.random()*A.length)];
  return s;
}
async function renderCodes(list, savedFlag){
  var host = $('codeList');
  host.innerHTML = '';
  if(!list){
    if(DEMO_MODE){ var data = await store.get(K_INVITES, true); list = (data && data.codes) ? data.codes : []; }
    else { try { var r = await api('/api/admin/codes', null, { token: adminToken }); list = r.codes || []; } catch(e){ host.textContent = 'Could not load codes: ' + e.message; return; } }
  }
  if(DEMO_MODE && (!store.ok || savedFlag === false)){
    var w = document.createElement('div');
    w.className = 'demoflag';
    w.textContent = 'Storage is not available here, so codes won’t be saved between sessions.';
    host.appendChild(w);
  }
  if(!list.length){
    var e = document.createElement('div');
    e.className = 'tiny';
    e.textContent = 'No invite codes yet — generate your first one above.';
    host.appendChild(e);
    return;
  }
  list.forEach(function(row){
    var d = document.createElement('div');
    d.className = 'codeline' + (row.active ? '' : ' dead');
    var c = document.createElement('span'); c.className = 'c'; c.textContent = row.c;
    var u = document.createElement('span'); u.className = 'u'; u.textContent = (row.uses || 0) + '× used';
    var copy = document.createElement('button'); copy.className = 'btn ghost small'; copy.textContent = 'Copy'; copy.setAttribute('aria-label', 'Copy code ' + row.c);
    copy.addEventListener('click', function(){
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(row.c);
        copy.textContent = 'Copied'; setTimeout(function(){ copy.textContent = 'Copy'; }, 1200);
      }
    });
    var rev = document.createElement('button'); rev.className = 'btn ghost small';
    rev.textContent = row.active ? 'Revoke' : 'Restore';
    rev.setAttribute('aria-label', (row.active ? 'Revoke' : 'Restore') + ' code ' + row.c);
    rev.addEventListener('click', async function(){
      if(DEMO_MODE){
        var data = await store.get(K_INVITES, true);
        var fresh = (data && data.codes) ? data.codes : [];
        for(var i=0;i<fresh.length;i++){ if(fresh[i].c === row.c){ fresh[i].active = !row.active; } }
        await store.set(K_INVITES, { codes:fresh }, true);
        renderCodes(fresh);
      } else {
        try { await api('/api/admin/codes', { action: row.active ? 'revoke' : 'restore', code: row.c }, { token: adminToken }); renderCodes(); }
        catch(e){ inlineErr(d, e.message); }
      }
    });
    d.appendChild(c); d.appendChild(u); d.appendChild(copy); d.appendChild(rev);
    host.appendChild(d);
  });
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
  PRODUCTS.filter(function(p){ return !p.isCustom; }).forEach(function(p){
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
    $('exProgress').textContent = ''; $('exOpenMsg').textContent = '';
    var warns = [];
    panelsFor(project.productId).forEach(function(p){
      var d = panelLowestDpi(p.id);
      if(d !== null && d < 150) warns.push(p.label + ' has artwork at ' + d + ' DPI — it will print blurred.');
      techniqueWarnings(p.id).forEach(function(w){ warns.push(p.label + ': ' + w); });
      var px = printPxFor(p);
      if(px.capped) warns.push(p.label + ' exceeds 6000 px at 300 DPI; the print file is capped at 6000 px on the long edge.');
    });
    $('exWarn').textContent = warns.join(' ');
    $('exWm').checked = locked || DEMO_MODE;
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
  var prog = $('exProgress');
  var name = safeName(currentDef().name), items = [], i;
  function step(t){ prog.className = 'gmsg ok'; prog.textContent = t; }
  try {
    if($('exMock').checked){
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
        var ab = renderArtboard(p.id, px.px, null, { w: px.w, h: px.h });
        await downloadCanvas(ab, 'PRINT_' + name + '_' + p.id + '_' + p.w_cm + 'x' + p.h_cm + 'cm_300dpi.png');
        await wait(600);
      }
    }
    if($('exTech').checked){ step('Building tech pack…'); await wait(20); openTechPack(); await wait(600); }
    if($('exProj').checked){
      step('Writing project.json…'); await wait(20);
      downloadText(JSON.stringify(serialiseProject(true)), name + '_project.json');
    }
    step('Done.');
  } catch(e){ prog.className = 'gmsg err'; prog.textContent = 'Export failed: ' + e.message; }
  btn.disabled = false;
}
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
function openTechPack(){
  var def = currentDef(), panels = panelsFor(project.productId);
  var front = compositeView(project.productId, 'front', { px: 900, stamp:false }).toDataURL('image/png');
  var backHas = availableViews(project.productId).some(function(v){ return v.id === 'back'; });
  var back = backHas ? compositeView(project.productId, 'back', { px: 900, stamp:false }).toDataURL('image/png') : null;
  var rows = '', thumbs = '';
  panels.forEach(function(p){
    var ab = artboardSize(p), t = renderPanelThumb(p.id, 300, project.garmentColor);
    thumbs += '<figure><img src="' + t.toDataURL('image/png') + '"><figcaption>' + esc(p.label) + ' — ' + p.w_cm + ' × ' + p.h_cm + ' cm · ' + esc((panelWork(p.id).technique || 'dtg').toUpperCase()) + '</figcaption></figure>';
    layersFor(p.id).forEach(function(l){
      var wcm = (l.w / ab.pxPerCm).toFixed(1), hcm = (l.h / ab.pxPerCm).toFixed(1), xcm = (l.x / ab.pxPerCm).toFixed(1), ycm = (l.y / ab.pxPerCm).toFixed(1);
      var d = layerDpi(p.id, l);
      rows += '<tr><td>' + esc(p.label) + '</td><td>' + esc(l.name || l.type) + '</td><td>' + esc(l.type) + (l.type === 'text' ? ': “' + esc(l.text) + '”' : '') + '</td><td>' + wcm + ' × ' + hcm + '</td><td>' + xcm + ', ' + ycm + '</td><td>' + (l.rot || 0) + '°</td><td>' + (d === null ? '—' : d) + '</td></tr>';
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
  var active = await checkSession();
  $('boot').style.display = 'none';
  $('demoBanner').classList.toggle('hidden', !DEMO_MODE);
  showStudio();
  buildProduct('tee');
  setMode('design');
  onHistoryChanged();
  if(active){ unlockStudio(); } else { lockStudio(); }
  await offerResume();
  if(active) maybeOnboard();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
