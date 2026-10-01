/* ============================================================
   SEIF STUDIO — ARTBOARD EDITOR
   One flat panel, full width: checkerboard, cutting line, safe
   area, layer list, direct manipulation with snapping, inspector.
   Coordinates: artboard units (see artboardSize) -> screen via
   AB.zoom / AB.panX / AB.panY. Gestures coalesce into one undo.
   ============================================================ */

var AB = {
  panel: null, ab: null, sel: null, zoom: 1, panX: 0, panY: 0, fitted: false,
  drag: null, guides: [], pointers: {}, pinch: null, before: null, dpr: 1, touch: false
};
var SNAP_PX = 6, HANDLE_PX = 7, ROT_OFFSET = 28;

/* ---------- open / close ---------- */
function abOpen(panelId){
  var panel = panelById(project.productId, panelId); if(!panel) return;
  AB.panel = panelId; AB.ab = artboardSize(panel); AB.sel = null; AB.fitted = false;
  state.panel = panelId;
  $('abTitle').textContent = panel.label + ' · ' + panel.w_cm + ' × ' + panel.h_cm + ' cm';
  $('techSel').value = panelWork(panelId).technique || 'dtg';
  showPane('editor');
  abResize();
  abFit();
  abRenderLayers(); abRenderInspector(); abDraw();
  if(window.innerWidth <= 900 && window.sheetDetent) window.sheetDetent('peek');
}
function abClose(silent){
  if(!AB.panel) return;
  AB.panel = null; AB.sel = null; state.panel = null;
  abCloseMenus();
  if(!silent && state.mode === 'design') showPane('sheet');
}
function abResize(){
  var c = $('abCanvas'), st = $('abStage'); if(!c || !st) return;
  AB.dpr = window.devicePixelRatio || 1;
  var w = st.clientWidth, h = st.clientHeight;
  if(c.width !== Math.round(w*AB.dpr) || c.height !== Math.round(h*AB.dpr)){
    c.width = Math.round(w*AB.dpr); c.height = Math.round(h*AB.dpr);
    if(AB.panel && !AB.fitted) abFit();
    abDraw();
  }
}
function abFit(){
  var st = $('abStage'); if(!st || !AB.ab) return;
  var w = st.clientWidth, h = st.clientHeight, pad = 40;
  AB.zoom = Math.min((w - pad*2) / AB.ab.w, (h - pad*2) / AB.ab.h);
  AB.panX = (w - AB.ab.w * AB.zoom) / 2; AB.panY = (h - AB.ab.h * AB.zoom) / 2;
  AB.fitted = true;
  $('abZoom').textContent = Math.round(AB.zoom * 100) + '%';
}
function abOnProjectChanged(panelId){
  if(!AB.panel) return;
  if(panelId === AB.panel || panelId === null){ abRenderLayers(); abRenderInspector(); }
  abDraw();
}

/* ---------- coordinate helpers ---------- */
function toScreen(x, y){ return [AB.panX + x*AB.zoom, AB.panY + y*AB.zoom]; }
function toArt(sx, sy){ return [(sx - AB.panX)/AB.zoom, (sy - AB.panY)/AB.zoom]; }
function evPos(e){ var r = $('abCanvas').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function layerCentre(l){ return [l.x + l.w/2, l.y + l.h/2]; }
/* world (artboard) -> layer local (centre origin, unrotated) */
function toLocal(l, x, y){
  var c = layerCentre(l), r = -(l.rot || 0) * Math.PI/180, dx = x - c[0], dy = y - c[1];
  return [dx*Math.cos(r) - dy*Math.sin(r), dx*Math.sin(r) + dy*Math.cos(r)];
}
function fromLocal(l, lx, ly){
  var c = layerCentre(l), r = (l.rot || 0) * Math.PI/180;
  return [c[0] + lx*Math.cos(r) - ly*Math.sin(r), c[1] + lx*Math.sin(r) + ly*Math.cos(r)];
}
function layerCorners(l){
  var hw = l.w/2, hh = l.h/2;
  return [fromLocal(l, -hw, -hh), fromLocal(l, hw, -hh), fromLocal(l, hw, hh), fromLocal(l, -hw, hh)];
}
function layerBounds(l){
  var cs = layerCorners(l), xs = cs.map(function(p){ return p[0]; }), ys = cs.map(function(p){ return p[1]; });
  return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
}
function selLayer(){ if(!AB.sel) return null; var f = findLayer(AB.panel, AB.sel); return f ? f.layer : null; }
function hitLayer(x, y){
  var ls = layersFor(AB.panel), tol = 2/AB.zoom;
  for(var i=ls.length-1;i>=0;i--){
    var l = ls[i]; if(l.visible === false || l.locked || l.type === 'fill') continue;
    var p = toLocal(l, x, y);
    if(Math.abs(p[0]) <= l.w/2 + tol && Math.abs(p[1]) <= l.h/2 + tol) return l;
  }
  return null;
}
var HANDLES = [
  { id:'nw', lx:-1, ly:-1 }, { id:'n', lx:0, ly:-1 }, { id:'ne', lx:1, ly:-1 }, { id:'e', lx:1, ly:0 },
  { id:'se', lx:1, ly:1 }, { id:'s', lx:0, ly:1 }, { id:'sw', lx:-1, ly:1 }, { id:'w', lx:-1, ly:0 }
];
function handlePoints(l){
  var out = {};
  HANDLES.forEach(function(h){ out[h.id] = fromLocal(l, h.lx * l.w/2, h.ly * l.h/2); });
  var top = fromLocal(l, 0, -l.h/2 - ROT_OFFSET/AB.zoom);
  out.rot = top;
  return out;
}
function hitHandle(l, sx, sy){
  var pts = handlePoints(l), r = AB.touch ? 22 : HANDLE_PX + 3;
  var ids = Object.keys(pts);
  for(var i=0;i<ids.length;i++){
    var s = toScreen(pts[ids[i]][0], pts[ids[i]][1]);
    if(Math.abs(s[0]-sx) <= r && Math.abs(s[1]-sy) <= r) return ids[i];
  }
  return null;
}

/* ---------- drawing ---------- */
function abDraw(){
  var c = $('abCanvas'); if(!c || !AB.panel || !AB.ab || state.mode === '3d') return;
  var ctx = c.getContext('2d'), dpr = AB.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.width/dpr, c.height/dpr);
  var o = toScreen(0, 0), w = AB.ab.w*AB.zoom, h = AB.ab.h*AB.zoom;
  /* checkerboard */
  ctx.save();
  ctx.beginPath(); ctx.rect(o[0], o[1], w, h); ctx.clip();
  ctx.fillStyle = '#fff'; ctx.fillRect(o[0], o[1], w, h);
  var s = 14; ctx.fillStyle = '#e7e7e2';
  var x0 = Math.floor(o[0]/s)*s, y0 = Math.floor(o[1]/s)*s;
  for(var yy=y0; yy<o[1]+h; yy+=s) for(var xx=x0; xx<o[0]+w; xx+=s){ if(((xx/s + yy/s) % 2) === 0) ctx.fillRect(xx, yy, s, s); }
  /* artwork at working resolution, scaled; a pattern piece shows its own shape on the fabric colour */
  var art = renderArtboard(AB.panel, PANEL_PX), piece = panelById(project.productId, AB.panel);
  ctx.imageSmoothingQuality = 'high';
  if(piece && piece.outline){
    var kx = w / piece.w_cm, ky = h / piece.h_cm;
    outlinePath(ctx, piece, kx, ky, o[0], o[1]); ctx.save(); ctx.clip();
    ctx.fillStyle = project.garmentColor; ctx.fillRect(o[0], o[1], w, h);
    if(art) ctx.drawImage(art, o[0], o[1], w, h);
    /* 1 cm seam allowance: the band that disappears into the seam */
    ctx.lineWidth = 2 * kx; ctx.strokeStyle = 'rgba(195,66,63,0.13)'; outlinePath(ctx, piece, kx, ky, o[0], o[1]); ctx.stroke();
    ctx.restore();
    if(art){ ctx.save(); ctx.globalAlpha = 0.18; ctx.drawImage(art, o[0], o[1], w, h); ctx.restore(); }
  } else if(art) ctx.drawImage(art, o[0], o[1], w, h);
  ctx.restore();
  var cmLabel = piece.w_cm + ' × ' + piece.h_cm + ' CM · CUT LINE';
  if(piece && piece.outline){
    ctx.save();
    outlinePath(ctx, piece, w / piece.w_cm, h / piece.h_cm, o[0], o[1]);
    ctx.strokeStyle = '#1E2749'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(30,39,73,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(o[0]+0.5, o[1]+0.5, w, h);
    ctx.setLineDash([]);
    ctx.font = '600 9.5px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#5A6178';
    ctx.fillText(cmLabel + ' · SHADED BAND = 1 CM SEAM', o[0], o[1] + h + 6);
    ctx.restore();
  } else {
    ctx.strokeStyle = '#1E2749'; ctx.lineWidth = 1; ctx.strokeRect(o[0]+0.5, o[1]+0.5, w, h);
    ctx.save();
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(195,66,63,0.85)';
    ctx.strokeRect(o[0] + w*0.05, o[1] + h*0.05, w*0.9, h*0.9);
    ctx.setLineDash([]);
    ctx.font = '600 9.5px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(195,66,63,0.9)'; ctx.textBaseline = 'bottom';
    ctx.fillText('SAFE AREA', o[0] + w*0.05 + 6, o[1] + h*0.05 - 3);
    ctx.textBaseline = 'top'; ctx.fillStyle = '#5A6178';
    ctx.fillText(cmLabel, o[0], o[1] + h + 6);
    ctx.restore();
  }
  /* snap guides */
  AB.guides.forEach(function(g){
    ctx.save(); ctx.strokeStyle = '#C3423F'; ctx.lineWidth = 1;
    ctx.beginPath();
    if(g.v !== undefined){ var sx = toScreen(g.v, 0)[0]; ctx.moveTo(sx, o[1]-20); ctx.lineTo(sx, o[1]+h+20); }
    else { var sy = toScreen(0, g.h)[1]; ctx.moveTo(o[0]-20, sy); ctx.lineTo(o[0]+w+20, sy); }
    ctx.stroke(); ctx.restore();
  });
  /* selection */
  var l = selLayer();
  if(l && l.type !== 'fill'){
    var cs = layerCorners(l).map(function(p){ return toScreen(p[0], p[1]); });
    ctx.save();
    ctx.strokeStyle = '#1E2749'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cs[0][0], cs[0][1]); for(var i=1;i<4;i++) ctx.lineTo(cs[i][0], cs[i][1]); ctx.closePath(); ctx.stroke();
    if(l.tile){ ctx.setLineDash([3,3]); ctx.strokeStyle = '#C3423F'; ctx.stroke(); ctx.setLineDash([]); }
    if(!l.locked){
      var hp = handlePoints(l), r = AB.touch ? 9 : HANDLE_PX;
      HANDLES.forEach(function(hh){
        var p = toScreen(hp[hh.id][0], hp[hh.id][1]);
        ctx.fillStyle = '#FBFBF7'; ctx.strokeStyle = '#1E2749'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(p[0]-r/2, p[1]-r/2, r, r); ctx.fill(); ctx.stroke();
      });
      var rp = toScreen(hp.rot[0], hp.rot[1]), tp = toScreen(hp.n[0], hp.n[1]);
      ctx.beginPath(); ctx.moveTo(tp[0], tp[1]); ctx.lineTo(rp[0], rp[1]); ctx.strokeStyle = '#1E2749'; ctx.stroke();
      ctx.beginPath(); ctx.arc(rp[0], rp[1], r/2 + 1.5, 0, Math.PI*2); ctx.fillStyle = '#C3423F'; ctx.fill(); ctx.strokeStyle = '#FBFBF7'; ctx.stroke();
    }
    ctx.restore();
  }
  $('abEmpty').classList.toggle('hidden', layersFor(AB.panel).length > 0);
}

/* ---------- gesture history (one undo entry per drag / slider sweep) ---------- */
function gestureStart(){
  var l = selLayer(); if(!l || AB.before) return;
  AB.before = cloneLayer(l);
}
function gestureEnd(label){
  var l = selLayer(), before = AB.before; AB.before = null;
  if(!l || !before) return;
  var changed = Object.keys(l).some(function(k){ return l[k] !== before[k]; });
  if(!changed) return;
  var after = cloneLayer(l), panelId = AB.panel, id = l.id;
  hPush({ label: label,
          undo: function(){ var f = findLayer(panelId, id); if(f) Object.keys(before).forEach(function(k){ f.layer[k] = before[k]; }); bumpRev(panelId); },
          redo: function(){ var f = findLayer(panelId, id); if(f) Object.keys(after).forEach(function(k){ f.layer[k] = after[k]; }); bumpRev(panelId); } });
}
function liveUpdate(patch){
  var l = selLayer(); if(!l) return;
  gestureStart();
  updateLayer(AB.panel, l.id, patch, { silent:true });
}

/* ---------- snapping ---------- */
function snapMove(l){
  AB.guides = [];
  var b = layerBounds(l), ab = AB.ab, t = SNAP_PX / AB.zoom;
  var cx = (b.x0 + b.x1)/2, cy = (b.y0 + b.y1)/2;
  var vx = [ { at: ab.w/2, of: cx }, { at: ab.w*0.05, of: b.x0 }, { at: ab.w*0.95, of: b.x1 }, { at: ab.w*0.05, of: b.x1 }, { at: ab.w*0.95, of: b.x0 } ];
  var vy = [ { at: ab.h/2, of: cy }, { at: ab.h*0.05, of: b.y0 }, { at: ab.h*0.95, of: b.y1 }, { at: ab.h*0.05, of: b.y1 }, { at: ab.h*0.95, of: b.y0 } ];
  var dx = 0, dy = 0, bestX = t, bestY = t;
  vx.forEach(function(s){ var d = s.at - s.of; if(Math.abs(d) < Math.abs(bestX)){ bestX = d; dx = d; AB.guides = AB.guides.filter(function(g){ return g.v === undefined; }); AB.guides.push({ v: s.at }); } });
  vy.forEach(function(s){ var d = s.at - s.of; if(Math.abs(d) < Math.abs(bestY)){ bestY = d; dy = d; AB.guides = AB.guides.filter(function(g){ return g.h === undefined; }); AB.guides.push({ h: s.at }); } });
  l.x += dx; l.y += dy;
}

/* ---------- pointer handling ---------- */
function abPointerDown(e){
  if(locked) return;
  var c = $('abCanvas'); try { c.setPointerCapture(e.pointerId); } catch(err){}
  AB.touch = e.pointerType === 'touch';
  AB.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var ids = Object.keys(AB.pointers);
  if(ids.length === 2){
    /* second finger: pinch on the selected layer if the first finger started on it, else pan/zoom the artboard */
    var p1 = AB.pointers[ids[0]], p2 = AB.pointers[ids[1]];
    var onLayer = AB.drag && (AB.drag.type === 'move');
    AB.pinch = { onLayer: onLayer, d0: Math.hypot(p2.x-p1.x, p2.y-p1.y), a0: Math.atan2(p2.y-p1.y, p2.x-p1.x),
                 cx: (p1.x+p2.x)/2, cy: (p1.y+p2.y)/2, zoom0: AB.zoom, panX0: AB.panX, panY0: AB.panY,
                 l0: onLayer ? cloneLayer(selLayer()) : null };
    if(onLayer) gestureStart();
    AB.drag = null; AB.guides = [];
    return;
  }
  abCloseMenus();
  var s = evPos(e), a = toArt(s[0], s[1]);
  var l = selLayer();
  if(l && !l.locked){
    var h = hitHandle(l, s[0], s[1]);
    if(h === 'rot'){
      var cen = layerCentre(l);
      AB.drag = { type:'rotate', start: Math.atan2(a[1]-cen[1], a[0]-cen[0]), rot0: l.rot || 0 };
      gestureStart(); return;
    }
    if(h){
      AB.drag = { type:'resize', handle: h, l0: cloneLayer(l), shift: e.shiftKey };
      gestureStart(); return;
    }
  }
  var hit = hitLayer(a[0], a[1]);
  if(hit){
    if(AB.sel !== hit.id){ AB.sel = hit.id; abRenderLayers(); abRenderInspector(); }
    AB.drag = { type:'move', ox: a[0] - hit.x, oy: a[1] - hit.y, moved:false };
    gestureStart();
    c.classList.add('move');
  } else {
    AB.drag = { type:'pan', sx: e.clientX, sy: e.clientY, panX0: AB.panX, panY0: AB.panY, moved:false };
    c.classList.add('grab');
  }
  abDraw();
}
function abPointerMove(e){
  if(AB.pointers[e.pointerId]) AB.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if(AB.pinch){
    var ids = Object.keys(AB.pointers); if(ids.length < 2) return;
    var p1 = AB.pointers[ids[0]], p2 = AB.pointers[ids[1]];
    var d = Math.hypot(p2.x-p1.x, p2.y-p1.y), ang = Math.atan2(p2.y-p1.y, p2.x-p1.x);
    var k = d / AB.pinch.d0, da = (ang - AB.pinch.a0) * 180/Math.PI;
    if(AB.pinch.onLayer){
      var l = selLayer(), l0 = AB.pinch.l0; if(!l) return;
      var cx = (p1.x+p2.x)/2, cy = (p1.y+p2.y)/2, r = $('abCanvas').getBoundingClientRect();
      var m0 = toArt(AB.pinch.cx - r.left, AB.pinch.cy - r.top), m1 = toArt(cx - r.left, cy - r.top);
      var nw = Math.max(4, l0.w * k), nh = Math.max(4, l0.h * k);
      var c0 = [l0.x + l0.w/2 + (m1[0]-m0[0]), l0.y + l0.h/2 + (m1[1]-m0[1])];
      updateLayer(AB.panel, l.id, { w: nw, h: nh, x: c0[0]-nw/2, y: c0[1]-nh/2, rot: Math.round(((l0.rot||0) + da) * 10)/10 }, { silent:true });
    } else {
      var r2 = $('abCanvas').getBoundingClientRect(), cx2 = (p1.x+p2.x)/2 - r2.left, cy2 = (p1.y+p2.y)/2 - r2.top;
      var z = Math.max(0.05, Math.min(8, AB.pinch.zoom0 * k));
      var ox = AB.pinch.cx - r2.left, oy = AB.pinch.cy - r2.top;
      AB.panX = cx2 - (ox - AB.pinch.panX0) * (z / AB.pinch.zoom0);
      AB.panY = cy2 - (oy - AB.pinch.panY0) * (z / AB.pinch.zoom0);
      AB.zoom = z; $('abZoom').textContent = Math.round(z*100) + '%';
      abDraw();
    }
    return;
  }
  if(!AB.drag) return;
  var s = evPos(e), a = toArt(s[0], s[1]), l = selLayer();
  if(AB.drag.type === 'pan'){
    AB.panX = AB.drag.panX0 + (e.clientX - AB.drag.sx); AB.panY = AB.drag.panY0 + (e.clientY - AB.drag.sy);
    if(Math.abs(e.clientX - AB.drag.sx) + Math.abs(e.clientY - AB.drag.sy) > 3) AB.drag.moved = true;
    abDraw(); return;
  }
  if(!l) return;
  if(AB.drag.type === 'move'){
    l.x = a[0] - AB.drag.ox; l.y = a[1] - AB.drag.oy; AB.drag.moved = true;
    if(!e.altKey) snapMove(l);
    l.x = Math.round(l.x); l.y = Math.round(l.y);
    bumpRev(AB.panel);
  } else if(AB.drag.type === 'rotate'){
    var cen = layerCentre(l), ang = Math.atan2(a[1]-cen[1], a[0]-cen[0]);
    var deg = AB.drag.rot0 + (ang - AB.drag.start) * 180/Math.PI;
    if(e.shiftKey) deg = Math.round(deg/15)*15;
    else { var near = Math.round(deg/90)*90; if(Math.abs(deg-near) < 3) deg = near; }
    deg = ((deg + 180) % 360 + 360) % 360 - 180;
    updateLayer(AB.panel, l.id, { rot: Math.round(deg*10)/10 }, { silent:true });
  } else if(AB.drag.type === 'resize'){
    abResizeTo(l, AB.drag.l0, AB.drag.handle, a, e.shiftKey);
  }
}
function abResizeTo(l, l0, h, a, shift){
  var lp = toLocal(l0, a[0], a[1]);          /* pointer in the original layer's local space */
  var hx = h.indexOf('e') >= 0 ? 1 : (h.indexOf('w') >= 0 ? -1 : 0);
  var hy = h.indexOf('s') >= 0 ? 1 : (h.indexOf('n') >= 0 ? -1 : 0);
  var ax = -hx * l0.w/2, ay = -hy * l0.h/2;   /* anchor: the opposite edge/corner, fixed */
  var nw = hx ? Math.max(4, (lp[0] - ax) * hx) : l0.w;
  var nh = hy ? Math.max(4, (lp[1] - ay) * hy) : l0.h;
  var keepAspect = (l0.type === 'image' || l0.type === 'text') ? !shift : shift;
  if(keepAspect && hx && hy){
    var k = Math.max(nw / l0.w, nh / l0.h); nw = l0.w * k; nh = l0.h * k;
  } else if(keepAspect && (l0.type === 'text')){
    if(hx){ nh = l0.h * nw / l0.w; } else { nw = l0.w * nh / l0.h; }
  }
  /* new centre in local space: anchor + half the new size along the moving axes */
  var cxl = hx ? ax + hx * nw/2 : 0, cyl = hy ? ay + hy * nh/2 : 0;
  var cw = fromLocal(l0, cxl, cyl);
  var patch = { w: Math.round(nw), h: Math.round(nh), x: Math.round(cw[0] - nw/2), y: Math.round(cw[1] - nh/2) };
  if(l0.type === 'text'){ patch.size = Math.max(6, Math.round(l0.size * nw / l0.w)); }
  Object.keys(patch).forEach(function(k){ l[k] = patch[k]; });
  bumpRev(AB.panel);
}
function abPointerUp(e){
  delete AB.pointers[e.pointerId];
  var c = $('abCanvas'); c.classList.remove('move'); c.classList.remove('grab');
  if(AB.pinch){
    if(Object.keys(AB.pointers).length < 2){
      if(AB.pinch.onLayer) gestureEnd('Pinch layer');
      AB.pinch = null; AB.drag = null; abDraw();
    }
    return;
  }
  if(!AB.drag) return;
  var d = AB.drag; AB.drag = null; AB.guides = [];
  if(d.type === 'pan' && !d.moved){ AB.sel = null; AB.before = null; abRenderLayers(); abRenderInspector(); }
  else if(d.type === 'move'){ gestureEnd(d.moved ? 'Move layer' : 'Select layer'); }
  else if(d.type === 'rotate'){ gestureEnd('Rotate layer'); }
  else if(d.type === 'resize'){ gestureEnd('Resize layer'); }
  AB.before = null;
  abRenderInspector(); abDraw();
}
function abWheel(e){
  if(!AB.panel) return;
  e.preventDefault();
  var s = evPos(e);
  if(e.shiftKey && !e.ctrlKey){ AB.panX -= e.deltaY; abDraw(); return; }
  var k = Math.exp(-e.deltaY * 0.0015), z = Math.max(0.05, Math.min(8, AB.zoom * k));
  AB.panX = s[0] - (s[0] - AB.panX) * (z / AB.zoom);
  AB.panY = s[1] - (s[1] - AB.panY) * (z / AB.zoom);
  AB.zoom = z; $('abZoom').textContent = Math.round(z*100) + '%';
  abDraw();
}
function abKey(e){
  if(!AB.panel || locked) return;
  var typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
  if(e.key === 'Escape'){
    if(document.querySelector('.menu.on')){ abCloseMenus(); return; }
    if(typing){ e.target.blur(); return; }
    if(state.mode === '3d'){ if(typeof s3dSelect === 'function') s3dSelect(AB.panel, null); return; }
    abClose(); return;
  }
  if(typing) return;
  var l = selLayer();
  if((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')){ e.preventDefault(); if(l){ var d = duplicateLayer(AB.panel, l.id); if(d){ AB.sel = d.id; abRenderLayers(); abRenderInspector(); abDraw(); } } return; }
  if(!l || l.locked) return;
  var step = e.shiftKey ? 10 : 1;
  if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); removeLayer(AB.panel, l.id); AB.sel = null; abRenderLayers(); abRenderInspector(); abDraw(); if(state.mode === '3d') s3dMark(AB.panel); return; }
  if(l.type === 'fill') return;
  var dx = 0, dy = 0;
  if(e.key === 'ArrowLeft') dx = -step; else if(e.key === 'ArrowRight') dx = step;
  else if(e.key === 'ArrowUp') dy = -step; else if(e.key === 'ArrowDown') dy = step;
  if(dx || dy){ e.preventDefault(); updateLayer(AB.panel, l.id, { x: l.x + dx, y: l.y + dy }, { label:'Nudge layer' }); abDraw(); }
}

/* ---------- layer list ---------- */
function abRenderLayers(){
  var host = $('layerList'); if(!host || !AB.panel) return;
  var ls = layersFor(AB.panel);
  host.innerHTML = '';
  $('layerEmpty').classList.toggle('hidden', ls.length > 0);
  for(var i=ls.length-1;i>=0;i--){
    (function(l, idx){
      var row = document.createElement('div');
      row.className = 'lrow' + (l.id === AB.sel ? ' on' : ''); row.draggable = true; row.dataset.id = l.id;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', l.id === AB.sel ? 'true' : 'false'); row.tabIndex = 0;
      var grip = document.createElement('span'); grip.className = 'grip'; grip.textContent = '⠇'; grip.setAttribute('aria-hidden', 'true');
      var dpi = layerDpi(AB.panel, l);
      if(dpi !== null){ var dot = document.createElement('span'); dot.className = 'dpi ' + dpiGrade(dpi); dot.title = dpiTip(dpi); row.appendChild(dot); }
      var name = document.createElement('span'); name.className = 'ln';
      name.innerHTML = '<span></span><small>' + l.type.toUpperCase() + (l.tile ? ' · TILED' : '') + (dpi !== null ? ' · ' + dpi + ' DPI' : '') + '</small>';
      name.firstChild.textContent = (l.type === 'text' && (!l.name || l.name === 'Text') ? String(l.text || '').replace(/\s+/g, ' ').slice(0, 40) : l.name) || l.type;
      if(state.mode === '3d') row.addEventListener('dblclick', function(){ if(typeof s3dFocusPanel === 'function') s3dFocusPanel(AB.panel); });
      var eye = document.createElement('button'); eye.className = 'ib' + (l.visible === false ? ' off' : ''); eye.textContent = '◉'; eye.title = 'Toggle visibility'; eye.setAttribute('aria-label', (l.visible === false ? 'Show ' : 'Hide ') + (l.name || l.type));
      eye.addEventListener('click', function(e){ e.stopPropagation(); updateLayer(AB.panel, l.id, { visible: l.visible === false }, { label:'Toggle visibility' }); });
      var lock = document.createElement('button'); lock.className = 'ib' + (l.locked ? '' : ' off'); lock.textContent = '🔒'; lock.title = 'Lock'; lock.setAttribute('aria-label', (l.locked ? 'Unlock ' : 'Lock ') + (l.name || l.type));
      lock.addEventListener('click', function(e){ e.stopPropagation(); updateLayer(AB.panel, l.id, { locked: !l.locked }, { label:'Lock layer' }); });
      var dup = document.createElement('button'); dup.className = 'ib'; dup.textContent = '⎘'; dup.title = 'Duplicate'; dup.setAttribute('aria-label', 'Duplicate ' + (l.name || l.type));
      dup.addEventListener('click', function(e){ e.stopPropagation(); var d = duplicateLayer(AB.panel, l.id); if(d) AB.sel = d.id; });
      var del = document.createElement('button'); del.className = 'ib'; del.textContent = '✕'; del.title = 'Delete'; del.setAttribute('aria-label', 'Delete ' + (l.name || l.type));
      del.addEventListener('click', function(e){ e.stopPropagation(); if(AB.sel === l.id) AB.sel = null; removeLayer(AB.panel, l.id); });
      row.appendChild(grip); row.appendChild(name); row.appendChild(eye); row.appendChild(lock); row.appendChild(dup); row.appendChild(del);
      row.addEventListener('click', function(){ AB.sel = l.id; abRenderLayers(); abRenderInspector(); abDraw(); if(state.mode === '3d') s3dMark(AB.panel); });
      row.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ AB.sel = l.id; abRenderLayers(); abRenderInspector(); abDraw(); } });
      row.addEventListener('dragstart', function(e){ e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragover', function(e){ e.preventDefault(); row.classList.add('dragover'); });
      row.addEventListener('dragleave', function(){ row.classList.remove('dragover'); });
      row.addEventListener('drop', function(e){
        e.preventDefault(); row.classList.remove('dragover');
        var src = e.dataTransfer.getData('text/plain'); if(!src || src === l.id) return;
        var f = findLayer(AB.panel, l.id); if(f) moveLayerTo(AB.panel, src, f.index);
      });
      host.appendChild(row);
    })(ls[i], i);
  }
  $('techWarn').textContent = techniqueWarnings(AB.panel).join(' ');
}

/* ---------- inspector ---------- */
var inspBinding = false;
function abRenderInspector(){
  if(typeof s3dSyncSelActs === 'function') s3dSyncSelActs();
  var l = selLayer();
  $('inspEmpty').classList.toggle('hidden', !!l);
  $('inspBody').classList.toggle('hidden', !l);
  if(!l) return;
  inspBinding = true;
  $('inX').value = Math.round(l.x); $('inY').value = Math.round(l.y); $('inW').value = Math.round(l.w); $('inH').value = Math.round(l.h);
  $('inRot').value = Math.round((l.rot || 0)*10)/10; $('inOp').value = Math.round((l.opacity === undefined ? 1 : l.opacity)*100); $('inBlend').value = l.blend || 'source-over';
  var d = layerDpi(AB.panel, l); $('inDpi').textContent = d === null ? '' : dpiTip(d); $('inDpi').className = 'tiny' + (d !== null && d < 300 ? ' warn' : '');
  $('inText').classList.toggle('hidden', l.type !== 'text');
  $('inShape').classList.toggle('hidden', l.type !== 'shape');
  $('inImage').classList.toggle('hidden', l.type !== 'image');
  $('inPath').classList.toggle('hidden', l.type !== 'path');
  $('inFillL').classList.toggle('hidden', l.type !== 'fill');
  $('inFlipRow').classList.toggle('hidden', l.type === 'fill');
  $('inTile').classList.toggle('hidden', !l.tile);
  if(l.type === 'image'){
    var fx = l.fx || {};
    $('fxBright').value = fx.brightness === undefined ? 100 : fx.brightness; $('fxContrast').value = fx.contrast === undefined ? 100 : fx.contrast;
    $('fxSat').value = fx.saturate === undefined ? 100 : fx.saturate; $('fxHue').value = fx.hue || 0; $('fxGray').value = fx.gray || 0; $('fxBlur').value = fx.blur || 0;
  }
  if(l.type === 'path'){ $('inPathStyle').value = l.style || 'pen'; $('inPathColor').value = l.color || '#000000'; $('inPathSize').value = Math.max(1, Math.min(120, Math.round(l.size || 10))); $('inPathStyle').disabled = l.blend === 'destination-out'; }
  if(l.type === 'fill'){
    $('inFillKind').value = l.fill || 'solid'; $('inFC1').value = l.c1 || '#000000'; $('inFC2').value = l.c2 || '#FFFFFF'; $('inFUse3').checked = !!l.c3; $('inFC3').value = l.c3 || '#C3423F';
    $('inFAngle').value = l.angle || 0; $('inFScale').value = Math.max(1, Math.min(20, Math.round((l.scale || 60) / (AB.ab ? AB.ab.pxPerCm : 1))));
  }
  if(l.type === 'text'){
    $('inTxt').value = l.text; $('inFont').value = l.font; $('inWeight').value = String(l.weight); $('inSize').value = l.size;
    $('inTrack').value = l.tracking || 0; $('inLH').value = l.lineHeight || 1.1; $('inAlign').value = l.align || 'center';
    $('inFill').value = l.fill || '#000000'; $('inStroke').value = l.stroke || '#000000'; $('inStrokeW').value = l.strokeW || 0;
    $('inCurve').value = l.curve || 0; $('inCurveV').textContent = l.curve || 0;
    $('inGrad').checked = !!l.fill2; $('inFill2').value = l.fill2 || '#C3423F';
    $('inShadowOn').checked = !!(l.shadow && l.shadow.color); $('inShadowRow').classList.toggle('hidden', !(l.shadow && l.shadow.color));
    if(l.shadow){ $('inShadowC').value = l.shadow.color || '#000000'; $('inShadowB').value = Math.round((l.shadow.blur || 0) / Math.max(1, l.size) * 100); $('inShadowO').value = Math.round((l.shadow.y || 0) / Math.max(1, l.size) * 100); }
  }
  if(l.type === 'shape'){ $('inSFill').value = l.fill || '#000000'; $('inSStroke').value = l.stroke || '#000000'; $('inSStrokeW').value = l.strokeW || 0;
    $('inShapeKind').value = l.shape || 'rect'; $('inSGrad').checked = !!l.fill2; $('inSFill2').value = l.fill2 || '#1E2749'; }
  if(l.tile){ $('inTileGap').value = Math.round((l.tile.gap || 0)*100); $('inTileRot').value = l.tile.rot || 0; $('inTileOff').checked = !!l.tile.offset; }
  inspBinding = false;
}
function bindInspector(){
  function num(id, key, label, live){
    var el = $(id);
    el.addEventListener(live ? 'input' : 'change', function(){
      if(inspBinding) return; var l = selLayer(); if(!l) return;
      var v = parseFloat(this.value); if(isNaN(v)) return;
      var patch = {}; patch[key] = v;
      if(live){ liveUpdate(patch); } else updateLayer(AB.panel, l.id, patch, { label: label });
      abDraw();
    });
    if(live) el.addEventListener('change', function(){ gestureEnd(label); abRenderLayers(); });
  }
  num('inX', 'x', 'Move layer'); num('inY', 'y', 'Move layer'); num('inRot', 'rot', 'Rotate layer');
  $('inW').addEventListener('change', function(){ var l = selLayer(); if(!l || inspBinding) return; var w = Math.max(1, +this.value); var p = { w: w }; if(l.type !== 'shape'){ p.h = Math.round(l.h * w / l.w); if(l.type === 'text') p.size = Math.max(6, Math.round(l.size * w / l.w)); } updateLayer(AB.panel, l.id, p, { label:'Resize layer' }); abRenderInspector(); abDraw(); });
  $('inH').addEventListener('change', function(){ var l = selLayer(); if(!l || inspBinding) return; var h = Math.max(1, +this.value); var p = { h: h }; if(l.type !== 'shape'){ p.w = Math.round(l.w * h / l.h); if(l.type === 'text') p.size = Math.max(6, Math.round(l.size * h / l.h)); } updateLayer(AB.panel, l.id, p, { label:'Resize layer' }); abRenderInspector(); abDraw(); });
  $('inOp').addEventListener('input', function(){ if(inspBinding) return; liveUpdate({ opacity: +this.value/100 }); abDraw(); });
  $('inOp').addEventListener('change', function(){ gestureEnd('Opacity'); });
  $('inBlend').addEventListener('change', function(){ var l = selLayer(); if(l && !inspBinding) updateLayer(AB.panel, l.id, { blend: this.value }, { label:'Blend mode' }); abDraw(); });
  /* text */
  $('inTxt').addEventListener('input', function(){ if(inspBinding) return; liveUpdate({ text: this.value }); abDraw(); });
  $('inTxt').addEventListener('change', function(){ gestureEnd('Edit text'); abRenderLayers(); });
  ['inFont','inAlign'].forEach(function(id){ $(id).addEventListener('change', function(){ var l = selLayer(); if(!l || inspBinding) return; var p = {}; p[id === 'inFont' ? 'font' : 'align'] = this.value; updateLayer(AB.panel, l.id, p, { label:'Text style' }); abDraw(); }); });
  $('inWeight').addEventListener('change', function(){ var l = selLayer(); if(l && !inspBinding) updateLayer(AB.panel, l.id, { weight: +this.value }, { label:'Text weight' }); abDraw(); });
  num('inSize', 'size', 'Text size'); num('inTrack', 'tracking', 'Tracking'); num('inLH', 'lineHeight', 'Line height');
  $('inFill').addEventListener('input', function(){ if(inspBinding) return; liveUpdate({ fill: this.value }); abDraw(); });
  $('inFill').addEventListener('change', function(){ gestureEnd('Text colour'); });
  $('inStroke').addEventListener('input', function(){ if(inspBinding) return; liveUpdate({ stroke: this.value }); abDraw(); });
  $('inStroke').addEventListener('change', function(){ gestureEnd('Stroke colour'); });
  $('inStrokeW').addEventListener('change', function(){ var l = selLayer(); if(!l || inspBinding) return; updateLayer(AB.panel, l.id, { strokeW: Math.max(0, +this.value), stroke: l.stroke || $('inStroke').value }, { label:'Stroke width' }); abDraw(); });
  $('inCurve').addEventListener('input', function(){ if(inspBinding) return; $('inCurveV').textContent = this.value; liveUpdate({ curve: +this.value }); abDraw(); });
  $('inCurve').addEventListener('change', function(){ gestureEnd('Arc text'); abRenderInspector(); });
  /* shape */
  $('inSFill').addEventListener('input', function(){ if(inspBinding) return; liveUpdate({ fill: this.value }); abDraw(); });
  $('inSFill').addEventListener('change', function(){ gestureEnd('Shape colour'); });
  $('inSStroke').addEventListener('input', function(){ if(inspBinding) return; liveUpdate({ stroke: this.value }); abDraw(); });
  $('inSStroke').addEventListener('change', function(){ gestureEnd('Stroke colour'); });
  $('inSStrokeW').addEventListener('change', function(){ var l = selLayer(); if(!l || inspBinding) return; updateLayer(AB.panel, l.id, { strokeW: Math.max(0, +this.value), stroke: l.stroke || $('inSStroke').value }, { label:'Stroke width' }); abDraw(); });
  /* tile */
  function tilePatch(){ var l = selLayer(); if(!l || !l.tile) return null; return { tile: { gap: +$('inTileGap').value/100, rot: +$('inTileRot').value, offset: $('inTileOff').checked } }; }
  $('inTileGap').addEventListener('input', function(){ if(inspBinding) return; var p = tilePatch(); if(p){ liveUpdate(p); abDraw(); } });
  $('inTileGap').addEventListener('change', function(){ gestureEnd('Pattern spacing'); });
  $('inTileRot').addEventListener('input', function(){ if(inspBinding) return; var p = tilePatch(); if(p){ liveUpdate(p); abDraw(); } });
  $('inTileRot').addEventListener('change', function(){ gestureEnd('Pattern rotation'); });
  $('inTileOff').addEventListener('change', function(){ if(inspBinding) return; var p = tilePatch(); if(p){ var l = selLayer(); updateLayer(AB.panel, l.id, p, { label:'Pattern offset' }); abDraw(); } });
  $('inTileStop').addEventListener('click', function(){ var l = selLayer(); if(l){ updateLayer(AB.panel, l.id, { tile: null }, { label:'Stop tiling' }); abRenderInspector(); abDraw(); } });
  $('techSel').addEventListener('change', function(){ if(AB.panel) setPanelTechnique(AB.panel, this.value); });
  /* options built from the engine's lists */
  var fontSel = $('inFont'); fontSel.innerHTML = '';
  ['Latin', 'Arabic', 'Emoji'].forEach(function(gname){
    var og = document.createElement('optgroup'); og.label = gname === 'Latin' ? 'Latin' : (gname === 'Arabic' ? 'Arabic · عربي' : 'Emoji');
    DESIGN_FONTS.filter(function(f){ return f.g === gname; }).forEach(function(f){ var o = document.createElement('option'); o.value = f.f; o.textContent = f.f === 'Emoji' ? 'Colour emoji' : f.f; og.appendChild(o); });
    fontSel.appendChild(og);
  });
  SHAPES.forEach(function(sh){ var o = document.createElement('option'); o.value = sh.id; o.textContent = sh.label; $('inShapeKind').appendChild(o); });
  BRUSHES.forEach(function(b){ var o = document.createElement('option'); o.value = b.id; o.textContent = b.label; $('inPathStyle').appendChild(o); });
  FILLS.forEach(function(f){ var o = document.createElement('option'); o.value = f.id; o.textContent = f.label; $('inFillKind').appendChild(o); });
  function edit(patch, label){ var l = selLayer(); if(!l || inspBinding) return; updateLayer(AB.panel, l.id, patch, { label: label }); abRenderInspector(); abDraw(); }
  function live(id, label, make){
    $(id).addEventListener('input', function(){ if(inspBinding) return; var l = selLayer(); if(!l) return; liveUpdate(make(l, this)); abDraw(); });
    $(id).addEventListener('change', function(){ gestureEnd(label); abRenderLayers(); });
  }
  $('inFlipX').addEventListener('click', function(){ var l = selLayer(); if(l) edit({ flipX: !l.flipX }, 'Mirror'); });
  $('inFlipY').addEventListener('click', function(){ var l = selLayer(); if(l) edit({ flipY: !l.flipY }, 'Flip'); });
  /* text: gradient and shadow / glow (sizes relative to the letters, so they scale with them) */
  $('inGrad').addEventListener('change', function(){ edit({ fill2: this.checked ? $('inFill2').value : null }, 'Text gradient'); });
  live('inFill2', 'Text gradient', function(l, el){ return $('inGrad').checked ? { fill2: el.value } : {}; });
  function shadowFrom(l){ var sz = Math.max(1, l.size || 100), o = +$('inShadowO').value / 100 * sz; return { color: $('inShadowC').value, blur: +$('inShadowB').value / 100 * sz, x: o * 0.6, y: o }; }
  $('inShadowOn').addEventListener('change', function(){ var l = selLayer(); if(!l) return; edit({ shadow: this.checked ? shadowFrom(l) : null }, this.checked ? 'Add shadow' : 'Remove shadow'); });
  ['inShadowC', 'inShadowB', 'inShadowO'].forEach(function(id){ live(id, 'Shadow', function(l){ return $('inShadowOn').checked ? { shadow: shadowFrom(l) } : {}; }); });
  /* shape */
  $('inShapeKind').addEventListener('change', function(){ var sh = SHAPES.filter(function(x){ return x.id === $('inShapeKind').value; })[0]; edit({ shape: this.value, name: sh ? sh.label : 'Shape' }, 'Change shape'); });
  $('inSGrad').addEventListener('change', function(){ edit({ fill2: this.checked ? $('inSFill2').value : null }, 'Shape gradient'); });
  live('inSFill2', 'Shape gradient', function(l, el){ return $('inSGrad').checked ? { fill2: el.value } : {}; });
  /* image adjustments */
  [['fxBright', 'brightness'], ['fxContrast', 'contrast'], ['fxSat', 'saturate'], ['fxHue', 'hue'], ['fxGray', 'gray'], ['fxBlur', 'blur']].forEach(function(pair){
    live(pair[0], 'Adjust image', function(l, el){ var fx = Object.assign({}, l.fx || {}); fx[pair[1]] = +el.value; return { fx: fx }; });
  });
  $('fxInvert').addEventListener('click', function(){ var l = selLayer(); if(!l) return; var fx = Object.assign({}, l.fx || {}); fx.invert = fx.invert ? 0 : 100; edit({ fx: fx }, 'Invert colours'); });
  $('fxReset').addEventListener('click', function(){ edit({ fx: null }, 'Reset image'); });
  $('fxKnock').addEventListener('click', function(){ var l = selLayer(); if(l && l.type === 'image') knockOutWhite(AB.panel, l); });
  /* brush strokes */
  $('inPathStyle').addEventListener('change', function(){ var b = BRUSHES.filter(function(x){ return x.id === $('inPathStyle').value; })[0]; edit({ style: this.value, blend: this.value === 'marker' ? 'multiply' : 'source-over', name: (b ? b.label : 'Brush') + ' stroke' }, 'Brush style'); });
  live('inPathColor', 'Brush colour', function(l, el){ return { color: el.value }; });
  live('inPathSize', 'Brush size', function(l, el){ return { size: +el.value }; });
  /* fills */
  $('inFillKind').addEventListener('change', function(){ var f = FILLS.filter(function(x){ return x.id === $('inFillKind').value; })[0]; edit({ fill: this.value, name: (f ? f.label : 'Fill') + ' fill' }, 'Fill pattern'); });
  live('inFC1', 'Fill colour', function(l, el){ return { c1: el.value }; });
  live('inFC2', 'Fill colour', function(l, el){ return { c2: el.value }; });
  live('inFC3', 'Fill colour', function(l, el){ return $('inFUse3').checked ? { c3: el.value } : {}; });
  $('inFUse3').addEventListener('change', function(){ edit({ c3: this.checked ? $('inFC3').value : null }, 'Fill colour'); });
  live('inFAngle', 'Fill angle', function(l, el){ return { angle: +el.value }; });
  live('inFScale', 'Fill scale', function(l, el){ return { scale: Math.round(+el.value * (AB.ab ? AB.ab.pxPerCm : 1)) }; });
}
/* white (or near-white) pixels become transparent: logos shot on paper, scans */
function knockOutWhite(panelId, l){
  var src = l.src, w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d'); g.drawImage(src, 0, 0);
  var d; try { d = g.getImageData(0, 0, w, h); } catch(e){ inlineErr('inDpi', 'This image cannot be edited here.'); return; }
  var p = d.data;
  for(var i = 0; i < p.length; i += 4){
    var mn = Math.min(p[i], p[i + 1], p[i + 2]);
    if(mn > 238) p[i + 3] = 0;
    else if(mn > 205) p[i + 3] = Math.round(p[i + 3] * (238 - mn) / 33);
  }
  g.putImageData(d, 0, 0);
  var data = c.toDataURL('image/png'), img = new Image();
  img.onload = function(){
    var hash = hashString(data); imageStore[hash] = data;
    updateLayer(panelId, l.id, { src: img, srcHash: hash }, { label: 'Remove white background' });
    abRenderInspector(); abDraw();
  };
  img.src = data;
}

/* ---------- toolbar ---------- */
function abCloseMenus(){ document.querySelectorAll('.menu.on').forEach(function(m){ m.classList.remove('on'); }); }
function abAddImageFile(file){
  if(!file || !file.type || file.type.indexOf('image') !== 0){ inlineErr('abToolbar', 'That file is not an image.'); return; }
  var rd = new FileReader();
  rd.onload = function(){
    var img = new Image();
    img.onload = function(){
      var l = addImageLayer(AB.panel, img, file.name, rd.result);
      if(l){ AB.sel = l.id; abRenderLayers(); abRenderInspector(); abDraw(); }
      var d = layerDpi(AB.panel, l);
      if(d !== null && d < 150) inlineErr('abToolbar', file.name + ' is only ' + d + ' DPI at this size — it will print blurred. Shrink it or use a larger file.');
      else inlineErr('abToolbar', '');
    };
    img.onerror = function(){ inlineErr('abToolbar', 'Could not decode ' + file.name + '.'); };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
function abDropFile(file){
  if(state.mode !== 'design') return;
  if(!AB.panel){ var ps = panelsFor(project.productId); if(ps.length) abOpen(ps[0].id); else return; }
  abAddImageFile(file);
}
function abAlign(how){
  var l = selLayer(), ab = AB.ab; if(!ab) return;
  if(how === 'hdist' || how === 'vdist'){
    var ls = layersFor(AB.panel).filter(function(x){ return x.visible !== false && !x.locked; });
    if(ls.length < 2) return;
    var key = how === 'hdist' ? 'x' : 'y', size = how === 'hdist' ? 'w' : 'h', total = how === 'hdist' ? ab.w : ab.h;
    var sorted = ls.slice().sort(function(a, b){ return a[key] - b[key]; });
    var sum = 0; sorted.forEach(function(x){ sum += x[size]; });
    var gap = (total * 0.9 - sum) / (sorted.length - 1), pos = total * 0.05;
    hBegin('Distribute');
    sorted.forEach(function(x){ var p = {}; p[key] = Math.round(pos); updateLayer(AB.panel, x.id, p); pos += x[size] + gap; });
    hCommit(); abDraw(); return;
  }
  if(!l) return;
  var b = layerBounds(l), p = {};
  if(how === 'left') p.x = l.x + (ab.w*0.05 - b.x0);
  if(how === 'right') p.x = l.x + (ab.w*0.95 - b.x1);
  if(how === 'center') p.x = l.x + (ab.w/2 - (b.x0+b.x1)/2);
  if(how === 'top') p.y = l.y + (ab.h*0.05 - b.y0);
  if(how === 'bottom') p.y = l.y + (ab.h*0.95 - b.y1);
  if(how === 'middle') p.y = l.y + (ab.h/2 - (b.y0+b.y1)/2);
  Object.keys(p).forEach(function(k){ p[k] = Math.round(p[k]); });
  updateLayer(AB.panel, l.id, p, { label:'Align layer' }); abRenderInspector(); abDraw();
}
function bindEditor(){
  var c = $('abCanvas');
  c.addEventListener('pointerdown', abPointerDown);
  c.addEventListener('pointermove', abPointerMove);
  c.addEventListener('pointerup', abPointerUp);
  c.addEventListener('pointercancel', abPointerUp);
  c.addEventListener('wheel', abWheel, { passive:false });
  c.addEventListener('dblclick', function(){ abFit(); abDraw(); });
  document.addEventListener('keydown', abKey);
  window.addEventListener('resize', function(){ abResize(); if(state.mode === 'design' && !AB.panel) renderPanelSheet(); });
  $('abBackBtn').addEventListener('click', function(){ abClose(); });
  $('abUploadBtn').addEventListener('click', function(){ $('abFile').click(); });
  $('abFile').addEventListener('change', function(){ abAddImageFile(this.files[0]); this.value = ''; });
  $('abTextBtn').addEventListener('click', function(){ var l = addTextLayer(AB.panel); if(l){ AB.sel = l.id; abRenderLayers(); abRenderInspector(); abDraw(); setTimeout(function(){ $('inTxt').focus(); $('inTxt').select(); }, 30); } });
  $('abShapeBtn').addEventListener('click', function(e){ e.stopPropagation(); var m = $('abShapeMenu'), on = m.classList.contains('on'); abCloseMenus(); m.classList.toggle('on', !on); });
  $('abAlignBtn').addEventListener('click', function(e){ e.stopPropagation(); var m = $('abAlignMenu'), on = m.classList.contains('on'); abCloseMenus(); m.classList.toggle('on', !on); });
  document.querySelectorAll('#abShapeMenu button').forEach(function(b){ b.addEventListener('click', function(){ abCloseMenus(); var l = addShapeLayer(AB.panel, { shape: b.dataset.shape, h: b.dataset.shape === 'line' ? 8 : undefined }); if(l){ if(b.dataset.shape === 'line'){ l.h = 8; } AB.sel = l.id; abRenderLayers(); abRenderInspector(); abDraw(); } }); });
  document.querySelectorAll('#abAlignMenu button').forEach(function(b){ b.addEventListener('click', function(){ abCloseMenus(); abAlign(b.dataset.align); }); });
  document.addEventListener('click', function(e){ if(!e.target.closest('.menuwrap')) abCloseMenus(); });
  $('abFitBtn').addEventListener('click', function(){
    var l = selLayer(); if(!l) return;
    var ab = AB.ab, k = Math.min(ab.w*0.9 / l.w, ab.h*0.9 / l.h), nw = Math.round(l.w*k), nh = Math.round(l.h*k);
    var p = { w: nw, h: nh, x: Math.round((ab.w-nw)/2), y: Math.round((ab.h-nh)/2), rot: 0 };
    if(l.type === 'text') p.size = Math.max(6, Math.round(l.size * k));
    updateLayer(AB.panel, l.id, p, { label:'Fit to safe area' }); abRenderInspector(); abDraw();
  });
  $('abTileBtn').addEventListener('click', function(){
    var l = selLayer(); if(!l) return;
    updateLayer(AB.panel, l.id, { tile: l.tile ? null : { gap: 0.25, rot: 0, offset: false } }, { label: l.tile ? 'Stop tiling' : 'Tile as pattern' });
    abRenderInspector(); abRenderLayers(); abDraw();
  });
  var st = $('abStage');
  ['dragenter','dragover'].forEach(function(t){ st.addEventListener(t, function(e){ e.preventDefault(); st.classList.add('hot'); }); });
  ['dragleave','drop'].forEach(function(t){ st.addEventListener(t, function(){ st.classList.remove('hot'); }); });
  bindInspector();
}
