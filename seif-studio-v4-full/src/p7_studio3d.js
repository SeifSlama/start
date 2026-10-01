/* ============================================================
   SEIF STUDIO — 3D STUDIO (the tee)

   A hollow tee (r_tee3d.js) in a three.js scene the customer can turn in
   every direction and design on directly. Each pattern piece is a mesh
   whose texture is that piece's artboard (renderArtboard) over the fabric
   colour, plus stitches and the selection, so the 2D and 3D editors are
   two views of the same layers.
   three.js is loaded on demand from assets/vendor (one self-hosted module).
   ============================================================ */
var S3D = {
  T: null, ready: false, failed: null, loading: null, host: null,
  renderer: null, scene: null, camera: null, controls: null, group: null,
  panels: {}, order: [], insideMats: [], dirty: {}, needsRender: true, running: false,
  knit: null, fly: null, visible: false, lastFrame: 0,
  TEX_PX_PER_CM: 26,
  /* where pixels come from: the studio's layers and garment colour (the multi-colour sheet swaps the colour) */
  src: {
    art: function(panelId, px){ return renderArtboard(panelId, px); },
    base: function(panelId){ return project.garmentColor; },
    selection: function(){ return null; }
  }
};

function s3dSupported(){
  try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch(e){ return false; }
}
function s3dLoadThree(){
  if(!S3D.loading){
    /* a failed import is remembered by the browser, so a retry asks for a fresh URL */
    var url = new URL((CFG.assetBase || 'assets/') + 'vendor/three-r186.min.js' + (S3D.tries ? '?retry=' + S3D.tries : ''), location.href).href;
    S3D.tries = (S3D.tries || 0) + 1;
    S3D.loading = import(url).then(function(mod){ S3D.T = mod; return mod; });
    S3D.loading.catch(function(){ S3D.loading = null; });
  }
  return S3D.loading;
}

/* ---------- fabric: a knit normal map (jersey columns of V loops), made once ---------- */
function s3dKnitTexture(T){
  var N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  var g = c.getContext('2d'), img = g.createImageData(N, N), h = new Float32Array(N * N), x, y;
  for(y = 0; y < N; y++) for(x = 0; x < N; x++){
    var col = x % 16, cx = Math.abs(col - 8) / 8;
    var loop = Math.sin(Math.PI * 2 * (y / 16 + cx * 0.5));
    h[y * N + x] = 0.55 * Math.sin(Math.PI * col / 16) + 0.45 * loop * (1 - cx * 0.6) + 0.08 * Math.sin(x * 1.7 + y * 0.9);
  }
  for(y = 0; y < N; y++) for(x = 0; x < N; x++){
    var l = h[y * N + (x + N - 1) % N], r = h[y * N + (x + 1) % N], u = h[((y + N - 1) % N) * N + x], d = h[((y + 1) % N) * N + x];
    var nx = (l - r) * 1.2, ny = (u - d) * 1.2, nz = 1, k = 1 / Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    img.data[i] = (nx * k * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * k * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * k * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  var t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.NoColorSpace;
  return t;
}
/* soft contact shadow under the hem */
function s3dShadowTexture(T){
  var c = document.createElement('canvas'); c.width = 256; c.height = 128;
  var g = c.getContext('2d'), gr = g.createRadialGradient(128, 64, 4, 128, 64, 120);
  gr.addColorStop(0, 'rgba(20,24,40,0.55)'); gr.addColorStop(0.45, 'rgba(20,24,40,0.22)'); gr.addColorStop(1, 'rgba(20,24,40,0)');
  g.save(); g.scale(1, 0.5); g.translate(0, 64); g.fillStyle = gr; g.fillRect(0, -64, 256, 256); g.restore();
  var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

/* ---------- init: one at a time, whoever asks first (the studio, an export) ---------- */
function s3dInit(host){
  if(S3D.ready) return Promise.resolve(true);
  if(S3D.failed) return Promise.resolve(false);
  if(!S3D.initP){
    S3D.initP = s3dInitNow(host)
      .catch(function(e){ S3D.failed = 'The 3D studio could not start (' + ((e && e.message) || e) + ').'; return false; })
      .then(function(ok){
        S3D.initP = null;
        if(ok && !S3D.bound){ S3D.bound = true; s3dBindPointer(); }
        return ok;
      });
  }
  return S3D.initP;
}
async function s3dInitNow(host){
  S3D.canRetry = false;
  if(!s3dSupported()){ S3D.failed = 'This browser cannot show 3D (WebGL is turned off or not supported).'; return false; }
  var T;
  try { T = await s3dLoadThree(); }
  catch(e){ S3D.failed = 'Could not load the 3D engine (' + (e.message || 'network error') + ').'; S3D.canRetry = true; return false; }
  S3D.host = host;
  var renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  } catch(e){ S3D.failed = 'This device could not start 3D (' + (e.message || 'WebGL error') + ').'; return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'gl3d';
  host.appendChild(renderer.domElement);
  S3D.renderer = renderer;

  var scene = new T.Scene();
  var pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  var hemi = new T.HemisphereLight(0xffffff, 0xb8bac4, 0.38); scene.add(hemi);
  var key = new T.DirectionalLight(0xffffff, 0.95);
  key.position.set(55, 95, 120); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  var sc = key.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 400;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.35; key.shadow.radius = 4;
  scene.add(key); scene.add(key.target);
  var rim = new T.DirectionalLight(0xdfe6ff, 0.45); rim.position.set(-80, 40, -90); scene.add(rim); scene.add(rim.target); S3D.rim = rim;
  /* a soft light riding with the camera, so whichever side faces the viewer is lit */
  var head = new T.DirectionalLight(0xffffff, 0.35); head.position.set(0, 0.3, 1); S3D.headLight = head;
  S3D.scene = scene; S3D.key = key;

  var camera = new T.PerspectiveCamera(30, 1, 5, 2000);
  camera.position.set(0, 4, 205);
  camera.add(head); head.target.position.set(0, 0, -1); camera.add(head.target); scene.add(camera);
  S3D.camera = camera;
  var controls = new T.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.75; controls.zoomSpeed = 0.9; controls.panSpeed = 0.7;
  controls.minDistance = 38; controls.maxDistance = 420;
  controls.minPolarAngle = 0.001; controls.maxPolarAngle = Math.PI - 0.001;   /* over the top and underneath */
  controls.screenSpacePanning = true; controls.target.set(0, 2, 0);
  controls.addEventListener('change', function(){ S3D.needsRender = true; });
  controls.addEventListener('start', function(){ s3dStopFly(); });
  S3D.controls = controls;

  S3D.knit = s3dKnitTexture(T);
  s3dBuildGarment();
  var shadow = new T.Mesh(new T.PlaneGeometry(78, 34), new T.MeshBasicMaterial({ map: s3dShadowTexture(T), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -38.6, -1);
  scene.add(shadow); S3D.floorShadow = shadow;

  var ro = new ResizeObserver(function(){ s3dResize(); });
  ro.observe(host);
  renderer.domElement.addEventListener('webglcontextlost', function(e){ e.preventDefault(); S3D.lost = true; });
  renderer.domElement.addEventListener('webglcontextrestored', function(){ S3D.lost = false; s3dMarkAll(); });
  S3D.ready = true;
  var sheet = document.getElementById('sheet');
  if(sheet) new MutationObserver(s3dSheetInset).observe(sheet, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', s3dSheetInset);
  s3dSheetInset();
  s3dResize();
  s3dStart();
  return true;
}
function s3dResize(){
  if(!S3D.renderer || !S3D.host) return;
  var w = S3D.host.clientWidth, h = S3D.host.clientHeight;
  if(!w || !h) return;
  S3D.renderer.setSize(w, h, false);
  S3D.renderer.domElement.style.width = w + 'px'; S3D.renderer.domElement.style.height = h + 'px';
  S3D.camera.aspect = w / h;
  /* keep the whole tee in frame on tall, narrow screens */
  S3D.camera.fov = w / h < 0.8 ? 30 * Math.min(1.7, 0.8 / (w / h)) : 30;
  /* a phone's half-open sheet covers the bottom of the stage: the tee moves up into what is left */
  var inset = Math.min(S3D.inset || 0, h * 0.6);
  if(inset > 0){ S3D.camera.setViewOffset(w, h, 0, inset / 2, w, h); S3D.camera.zoom = Math.max(0.62, Math.min(1, (h - inset) / h * 1.2)); }
  else { S3D.camera.clearViewOffset(); S3D.camera.zoom = 1; }
  S3D.camera.updateProjectionMatrix();
  S3D.needsRender = true;
}
function s3dSheetInset(){
  var sheet = $('sheet'); if(!sheet || !S3D.ready) return;
  var px = window.innerWidth <= 900 && sheet.classList.contains('half') ? window.innerHeight * 0.46 : 0;
  if(px === (S3D.inset || 0)) return;
  S3D.inset = px; s3dResize();
}

/* ---------- the garment ---------- */
function s3dBuildGarment(){
  var T = S3D.T, b = TEE3D.build(), group = new T.Group();
  group.position.y = -36.5;
  b.panels.forEach(function(p){
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(p.pos, 3));
    geo.setAttribute('uv', new T.BufferAttribute(p.uv, 2));
    geo.setIndex(s3dUnfold(p.pos, p.idx));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    var W = Math.min(2048, Math.round(p.W * S3D.TEX_PX_PER_CM)), H = Math.max(16, Math.min(2048, Math.round(p.H * S3D.TEX_PX_PER_CM)));
    var canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    var tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = Math.min(8, S3D.renderer.capabilities.getMaxAnisotropy());
    tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter;
    var knit = S3D.knit.clone(); knit.needsUpdate = true; knit.repeat.set(p.W / 0.95, p.H / 0.95);
    var mat = new T.MeshPhysicalMaterial({ map: tex, roughness: 0.93, metalness: 0, sheen: 0.28, sheenRoughness: 0.8,
      sheenColor: new T.Color(0xffffff), normalMap: knit, normalScale: new T.Vector2(0.28, 0.28), side: T.FrontSide });
    var mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.panel = p.id;
    /* the inside of the cloth sits a hair behind the outside, so where the surface folds on itself the outside wins */
    var inMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: T.BackSide, normalMap: knit, normalScale: new T.Vector2(0.2, 0.2),
                                             polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
    var inner = new T.Mesh(geo, inMat); inner.receiveShadow = true; inner.castShadow = false;
    group.add(mesh); group.add(inner);
    S3D.panels[p.id] = { id: p.id, mesh: mesh, inner: inner, innerMat: inMat, mat: mat, tex: tex, canvas: canvas, ctx: canvas.getContext('2d'),
                         W: W, H: H, piece: p, detail: null, detailKey: '' };
    S3D.order.push(p.id);
  });
  var gi = new T.BufferGeometry();
  gi.setAttribute('position', new T.BufferAttribute(b.inside.pos, 3)); gi.setIndex(b.inside.idx); gi.computeVertexNormals();
  var insideMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  var insideMesh = new T.Mesh(gi, insideMat); insideMesh.receiveShadow = true;
  group.add(insideMesh); S3D.insideMat = insideMat;
  S3D.scene.add(group); S3D.group = group;
  s3dMarkAll();
}

/* where the pattern grid crowds (steep armhole and neck edges) a few slivers fold back on
   themselves; the surface is covered twice around them anyway, so they are dropped rather than
   showing the inside of the cloth through the outside as dark specks */
function s3dUnfold(pos, idx){
  var n = pos.length / 3, vn = new Float64Array(n * 3), fn = [], t, k, out = [];
  for(t = 0; t < idx.length; t += 3){
    var a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    var ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    var vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    fn.push(nx, ny, nz);
    [a, b, c].forEach(function(i){ vn[i] += nx; vn[i + 1] += ny; vn[i + 2] += nz; });
  }
  for(t = 0, k = 0; t < idx.length; t += 3, k += 3){
    var s = 0;
    for(var j = 0; j < 3; j++){ var i = idx[t + j] * 3; s += vn[i] * fn[k] + vn[i + 1] * fn[k + 1] + vn[i + 2] * fn[k + 2]; }
    if(s > 0) out.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return out;
}

/* ---------- textures ---------- */
function s3dMarkAll(){ S3D.order.forEach(function(id){ S3D.dirty[id] = true; }); S3D.needsRender = true; }
function s3dMark(panelId){ if(panelId && S3D.panels[panelId]) S3D.dirty[panelId] = true; else s3dMarkAll(); S3D.needsRender = true; }
/* stitches, rib knit and a soft shade along the seams: display only, never printed */
function s3dDetail(pp, base){
  var key = base + '|' + pp.W + 'x' + pp.H;
  if(pp.detail && pp.detailKey === key) return pp.detail;
  var c = document.createElement('canvas'); c.width = pp.W; c.height = pp.H;
  var g = c.getContext('2d'), k = pp.W / pp.piece.W, light = lum(base) > 0.45;
  var ink = light ? 'rgba(20,22,30,' : 'rgba(255,255,255,';
  var out = pp.piece.outline;
  if(out && out.length > 2){
    g.save(); g.beginPath(); out.forEach(function(q, i){ if(i) g.lineTo(q[0] * k, q[1] * k); else g.moveTo(q[0] * k, q[1] * k); }); g.closePath(); g.clip();
    for(var s = 4; s >= 1; s--){ g.lineWidth = s * 0.22 * k; g.strokeStyle = ink + (0.022 * (5 - s)) + ')'; g.stroke(); }
    g.restore();
  }
  function stitchRow(y){
    g.save(); g.setLineDash([0.32 * k, 0.2 * k]); g.lineWidth = Math.max(1, 0.07 * k); g.strokeStyle = ink + (light ? 0.28 : 0.22) + ')';
    g.beginPath(); g.moveTo(0, y); g.lineTo(pp.W, y); g.stroke(); g.restore();
  }
  if(pp.id === 'front' || pp.id === 'back' || pp.id === 'sleeve_l' || pp.id === 'sleeve_r'){
    stitchRow(pp.H - 2.0 * k); stitchRow(pp.H - 2.6 * k);
  }
  if(pp.id === 'collar'){
    g.fillStyle = ink + (light ? 0.07 : 0.06) + ')';
    for(var x = 0; x < pp.W; x += 0.2 * k) g.fillRect(x, 0, Math.max(1, 0.06 * k), pp.H);
  }
  pp.detail = c; pp.detailKey = key;
  return c;
}
function s3dCompose(panelId){
  var pp = S3D.panels[panelId]; if(!pp) return;
  var g = pp.ctx, base = S3D.src.base(panelId) || '#FAFAF7';
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = base; g.fillRect(0, 0, pp.W, pp.H);
  var art = S3D.src.art(panelId, Math.max(pp.W, pp.H));
  if(art) g.drawImage(art, 0, 0, pp.W, pp.H);
  g.drawImage(s3dDetail(pp, base), 0, 0);
  var sel = S3D.src.selection();
  if(sel && sel.panel === panelId && typeof s3dDrawSelection === 'function') s3dDrawSelection(pp, sel.layer);
  pp.tex.needsUpdate = true;
  var inside = mixHex(base, '#0E1018', 0.2);
  pp.innerMat.color.set(inside);
  if(S3D.insideMat) S3D.insideMat.color.set(inside);
}

/* ---------- loop: render only when something changed ---------- */
function s3dStart(){
  if(S3D.running) return;
  S3D.running = true;
  requestAnimationFrame(s3dFrame);
}
function s3dFrame(t){
  if(!S3D.running) return;
  requestAnimationFrame(s3dFrame);
  if(!S3D.visible || S3D.lost || document.hidden) return;
  var moved = S3D.controls.update();
  if(S3D.fly) s3dFlyStep(t);
  if(moved || S3D.fly || S3D.needsRender) s3dKeyFollow();
  var ids = Object.keys(S3D.dirty);
  if(ids.length){ ids.forEach(function(id){ s3dCompose(id); }); S3D.dirty = {}; S3D.needsRender = true; }
  if(moved || S3D.needsRender || S3D.controls.autoRotate){
    S3D.needsRender = false;
    S3D.renderer.render(S3D.scene, S3D.camera);
  }
}
/* the key light keeps its place relative to the viewer (upper right, in front), so every side
   of the tee is lit like the front and its shadows read the same way */
function s3dKeyFollow(){
  var T = S3D.T, cam = S3D.camera, k = S3D.key, tgt = S3D.controls.target;
  cam.updateMatrixWorld();
  var right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  var up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  var back = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 2);
  k.position.copy(tgt).addScaledVector(right, 55).addScaledVector(up, 90).addScaledVector(back, 120);
  k.target.position.copy(tgt); k.target.updateMatrixWorld();
  if(S3D.rim){ S3D.rim.position.copy(tgt).addScaledVector(right, -70).addScaledVector(up, 45).addScaledVector(back, -110); S3D.rim.target.position.copy(tgt); S3D.rim.target.updateMatrixWorld(); }
  /* the studio's reflections turn with the viewer too */
  var off = cam.position.clone().sub(tgt);
  if(S3D.scene.environmentRotation) S3D.scene.environmentRotation.y = Math.atan2(off.x, off.z);
}
function s3dSetVisible(on){
  S3D.visible = !!on;
  if(on){ s3dResize(); S3D.needsRender = true; }
}

/* ---------- camera presets ---------- */
var S3D_VIEWS = {
  front:  { dir: [0, 0.02, 1],     dist: 205, target: [0, 2, 0] },
  neck:   { dir: [0, 0.62, 0.78],  dist: 118, target: [0, 27, 0] },
  back:   { dir: [0, 0.02, -1],    dist: 205, target: [0, 2, 0] },
  left:   { dir: [-1, 0.03, 0.02], dist: 205, target: [0, 2, 0] },
  right:  { dir: [1, 0.03, 0.02],  dist: 205, target: [0, 2, 0] },
  q34:    { dir: [0.72, 0.16, 0.68], dist: 205, target: [0, 2, 0] },
  top:    { dir: [0, 1, 0.08],     dist: 190, target: [0, 6, 0] },
  bottom: { dir: [0, -1, 0.08],    dist: 190, target: [0, 0, 0] },
  armpit: { dir: [0.78, -0.42, 0.46], dist: 95, target: [21, 10.5, 1] }
};
function s3dView(name, instant){
  var v = S3D_VIEWS[name]; if(!v || !S3D.ready) return;
  var T = S3D.T, d = new T.Vector3(v.dir[0], v.dir[1], v.dir[2]).normalize();
  var target = new T.Vector3(v.target[0], v.target[1], v.target[2]);
  var to = target.clone().add(d.multiplyScalar(v.dist));
  s3dStillControls();
  if(instant){ S3D.camera.position.copy(to); S3D.controls.target.copy(target); S3D.controls.update(); S3D.camera.updateMatrixWorld(); S3D.needsRender = true; return; }
  S3D.fly = { t0: performance.now(), dur: 520, fromPos: S3D.camera.position.clone(), fromTarget: S3D.controls.target.clone(), toPos: to, toTarget: target };
}
function s3dStopFly(){ S3D.fly = null; }
/* drop any swing left over from a flick, so a preset view stays put */
function s3dStillControls(){
  var c = S3D.controls; if(!c) return;
  if(c._sphericalDelta) c._sphericalDelta.set(0, 0, 0);
  if(c._panOffset) c._panOffset.set(0, 0, 0);
  if(c._scale !== undefined) c._scale = 1;
}
function s3dFlyStep(t){
  var f = S3D.fly, k = Math.min(1, (performance.now() - f.t0) / f.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  /* travel around the tee, not through it: interpolate on a sphere about the target */
  var T = S3D.T, ft = f.fromTarget.clone().lerp(f.toTarget, e);
  var a = f.fromPos.clone().sub(f.fromTarget), b = f.toPos.clone().sub(f.toTarget);
  var la = a.length(), lb = b.length(), na = a.clone().normalize(), nb = b.clone().normalize();
  var ang = Math.acos(Math.max(-1, Math.min(1, na.dot(nb))));
  var dir;
  if(ang < 1e-4) dir = na;
  else if(Math.PI - ang < 1e-3){ var axis = new T.Vector3(0, 1, 0); dir = na.clone().applyAxisAngle(axis, Math.PI * e); }
  else { var s = Math.sin(ang); dir = na.multiplyScalar(Math.sin((1 - e) * ang) / s).add(nb.multiplyScalar(Math.sin(e * ang) / s)); }
  S3D.camera.position.copy(ft).add(dir.multiplyScalar(la + (lb - la) * e));
  S3D.controls.target.copy(ft);
  S3D.needsRender = true;
  if(k >= 1) S3D.fly = null;
}
function s3dAutoRotate(on){ if(!S3D.ready) return; S3D.controls.autoRotate = !!on; S3D.controls.autoRotateSpeed = 2.2; S3D.needsRender = true; }

/* ============================================================
   DESIGNING ON THE 3D TEE
   The selection is the editor's (AB.panel / AB.sel), so the layer list and
   inspector on the right work the same in 2D and 3D. A drag on a design
   moves it — across seams onto the next piece too — a drag on bare fabric
   turns the tee, a brush paints straight onto the surface.
   ============================================================ */
S3D.tool = 'select';
S3D.brush = { style: 'pen', color: '#C3423F', sizeCm: 0.8, opacity: 1, mirror: false };
S3D.fillOpts = { fill: 'solid', c1: '#1E2749', c2: '#F4F4F0', c3: '', angle: 0, scaleCm: 4 };
S3D.drag = null; S3D.lastHit = null;
var S3D_HANDLE_CM = 0.85, S3D_ROT_CM = 2.4;

/* pixels -> which piece, where on it (artboard units) */
function s3dHit(clientX, clientY){
  if(!S3D.ready) return null;
  var T = S3D.T, el = S3D.renderer.domElement, r = el.getBoundingClientRect();
  if(!S3D.ray) S3D.ray = new T.Raycaster();
  S3D.camera.updateMatrixWorld();                                      /* a click can come before the next frame */
  var ndc = new T.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  S3D.ray.setFromCamera(ndc, S3D.camera);
  var hits = S3D.ray.intersectObjects(S3D.order.map(function(id){ return S3D.panels[id].mesh; }), false);
  if(!hits.length || !hits[0].uv) return null;
  var h = hits[0], id = h.object.userData.panel, panel = panelById(project.productId, id);
  if(!panel) return null;
  var ab = artboardSize(panel);
  return { panel: id, x: h.uv.x * ab.w, y: (1 - h.uv.y) * ab.h, ab: ab, point: h.point.clone() };
}
/* the point of the tee in the middle of the screen: where new things go */
function s3dCentreHit(){
  var r = S3D.renderer.domElement.getBoundingClientRect();
  var h = s3dHit(r.left + r.width / 2, r.top + r.height * 0.45);
  if(h) return h;
  var p = panelById(project.productId, 'front'), ab = artboardSize(p);
  return { panel: 'front', x: ab.w / 2, y: ab.h * 0.33, ab: ab };
}
function s3dSelection(){
  if(state.mode !== '3d' || !AB.panel || !AB.sel) return null;
  var f = findLayer(AB.panel, AB.sel);
  return f ? { panel: AB.panel, layer: f.layer } : null;
}
S3D.src.selection = s3dSelection;

function s3dSelect(panelId, layerId){
  var prev = AB.panel;
  AB.panel = panelId; state.panel = null;
  var panel = panelById(project.productId, panelId);
  AB.ab = panel ? artboardSize(panel) : null;
  AB.sel = layerId || null;
  if(prev && prev !== panelId) s3dMark(prev);
  s3dMark(panelId);
  if(typeof abRenderLayers === 'function'){ abRenderLayers(); abRenderInspector(); }
  if(typeof s3dSyncPanelChips === 'function') s3dSyncPanelChips();
}
/* top-most design under a point; brush strokes hit on their line, not their box */
function s3dLayerAt(panelId, x, y, tolUnits){
  var ls = layersFor(panelId);
  for(var i = ls.length - 1; i >= 0; i--){
    var l = ls[i]; if(l.visible === false || l.locked || l.type === 'fill') continue;
    var p = toLocal(l, x, y);
    if(Math.abs(p[0]) > l.w / 2 + tolUnits || Math.abs(p[1]) > l.h / 2 + tolUnits) continue;
    if(l.type === 'path' && !s3dPathNear(l, p[0], p[1], tolUnits)) continue;
    return l;
  }
  return null;
}
function s3dPathNear(l, lx, ly, tol){
  var sx = l.w / (l.bw || l.w), sy = l.h / (l.bh || l.h), r = (l.size || 10) * Math.sqrt(Math.abs(sx * sy)) / 2 + tol, pts = l.pts || [];
  if(l.flipX) lx = -lx; if(l.flipY) ly = -ly;
  for(var i = 0; i < pts.length; i++){
    var a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
    var ax = a[0] * sx, ay = a[1] * sy, bx = b[0] * sx, by = b[1] * sy, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((lx - ax) * dx + (ly - ay) * dy) / L)) : 0;
    if(Math.hypot(lx - (ax + dx * t), ly - (ay + dy * t)) <= r) return true;
  }
  return false;
}
/* handles in artboard units: four corners resize, the dot above rotates */
function s3dHandles(l, ab){
  var hw = l.w / 2, hh = l.h / 2;
  return { nw: fromLocal(l, -hw, -hh), ne: fromLocal(l, hw, -hh), se: fromLocal(l, hw, hh), sw: fromLocal(l, -hw, hh),
           rot: fromLocal(l, 0, -hh - S3D_ROT_CM * ab.pxPerCm), top: fromLocal(l, 0, -hh) };
}
function s3dHandleAt(l, ab, x, y){
  if(l.type === 'fill' || l.locked) return null;
  var hs = s3dHandles(l, ab), tol = S3D_HANDLE_CM * 1.5 * ab.pxPerCm, best = null, bd = tol;
  ['rot', 'nw', 'ne', 'se', 'sw'].forEach(function(k){ var d = Math.hypot(hs[k][0] - x, hs[k][1] - y); if(d < bd){ bd = d; best = k; } });
  return best;
}
/* the selection, drawn into the piece's texture (display only) */
function s3dDrawSelection(pp, l){
  if(l.type === 'fill') return;
  var g = pp.ctx, ab = artboardSize(panelById(project.productId, pp.id)), k = pp.W / ab.w;
  var hs = s3dHandles(l, ab), pts = [hs.nw, hs.ne, hs.se, hs.sw];
  g.save();
  g.lineJoin = 'round';
  g.beginPath(); pts.forEach(function(q, i){ if(i) g.lineTo(q[0] * k, q[1] * k); else g.moveTo(q[0] * k, q[1] * k); }); g.closePath();
  g.lineWidth = Math.max(2, 0.16 * S3D.TEX_PX_PER_CM); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke();
  g.setLineDash([0.45 * S3D.TEX_PX_PER_CM, 0.3 * S3D.TEX_PX_PER_CM]);
  g.lineWidth = Math.max(1.5, 0.09 * S3D.TEX_PX_PER_CM); g.strokeStyle = '#C3423F'; g.stroke(); g.setLineDash([]);
  if(!l.locked){
    var r = S3D_HANDLE_CM * S3D.TEX_PX_PER_CM;
    g.beginPath(); g.moveTo(hs.top[0] * k, hs.top[1] * k); g.lineTo(hs.rot[0] * k, hs.rot[1] * k);
    g.lineWidth = Math.max(1.5, 0.08 * S3D.TEX_PX_PER_CM); g.strokeStyle = '#C3423F'; g.stroke();
    ['nw', 'ne', 'se', 'sw'].forEach(function(h){
      g.beginPath(); g.arc(hs[h][0] * k, hs[h][1] * k, r * 0.62, 0, Math.PI * 2);
      g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = Math.max(1.5, 0.1 * S3D.TEX_PX_PER_CM); g.strokeStyle = '#1E2749'; g.stroke();
    });
    g.beginPath(); g.arc(hs.rot[0] * k, hs.rot[1] * k, r * 0.7, 0, Math.PI * 2);
    g.fillStyle = '#C3423F'; g.fill(); g.lineWidth = Math.max(1.5, 0.1 * S3D.TEX_PX_PER_CM); g.strokeStyle = '#FFFFFF'; g.stroke();
  }
  g.restore();
}

/* ---------- moving a design onto another piece keeps its real size ---------- */
function s3dRescale(l, r){
  l.w = Math.max(2, l.w * r); l.h = Math.max(2, l.h * r);
  if(l.type === 'text'){ l.size = Math.max(4, l.size * r); if(l.tracking) l.tracking *= r; if(l.strokeW) l.strokeW *= r;
    if(l.shadow){ l.shadow = { color: l.shadow.color, blur: (l.shadow.blur || 0) * r, x: (l.shadow.x || 0) * r, y: (l.shadow.y || 0) * r }; } }
  if(l.type === 'shape' && l.strokeW) l.strokeW *= r;
}
function s3dTransfer(l, fromId, toId, cx, cy){
  var f = findLayer(fromId, l.id); if(!f) return;
  layersFor(fromId).splice(f.index, 1); bumpRev(fromId);
  var r = artboardSize(panelById(project.productId, toId)).pxPerCm / artboardSize(panelById(project.productId, fromId)).pxPerCm;
  s3dRescale(l, r);
  l.x = cx - l.w / 2; l.y = cy - l.h / 2;
  layersFor(toId).push(l); bumpRev(toId);
  return r;
}
/* one undo step for a drag, even when it changed pieces */
function s3dSnapshot(panelId, layerId){
  var f = findLayer(panelId, layerId); return f ? { panel: panelId, index: f.index, layer: cloneLayer(f.layer), ref: f.layer } : null;
}
function s3dPushMove(before, label){
  var cur = null;
  S3D.order.forEach(function(pid){ var f = findLayer(pid, before.ref.id); if(f) cur = { panel: pid, index: f.index }; });
  if(!cur) return;
  var after = { panel: cur.panel, index: cur.index, layer: cloneLayer(before.ref) }, ref = before.ref;
  var changed = after.panel !== before.panel || Object.keys(after.layer).some(function(k){ return after.layer[k] !== before.layer[k]; });
  if(!changed) return;
  function place(st){
    S3D.order.forEach(function(pid){ var f = findLayer(pid, ref.id); if(f){ layersFor(pid).splice(f.index, 1); bumpRev(pid); } });
    Object.keys(st.layer).forEach(function(k){ ref[k] = st.layer[k]; });
    var ls = layersFor(st.panel); ls.splice(Math.min(st.index, ls.length), 0, ref); bumpRev(st.panel);
    if(AB.sel === ref.id) s3dSelect(st.panel, ref.id);
  }
  hPush({ label: label, undo: function(){ place(before); }, redo: function(){ place(after); } });
}

/* ---------- brush strokes ---------- */
function s3dMirrorOf(panelId, x, y){
  var ab = artboardSize(panelById(project.productId, panelId));
  var other = { front: 'front', back: 'back', collar: 'collar', sleeve_r: 'sleeve_l', sleeve_l: 'sleeve_r' }[panelId] || panelId;
  var ab2 = artboardSize(panelById(project.productId, other));
  return { panel: other, x: (ab.w - x) * ab2.w / ab.w, y: y * ab2.h / ab.h };
}
function s3dSetPath(l, abs){
  var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  abs.forEach(function(p){ if(p[0] < minx) minx = p[0]; if(p[0] > maxx) maxx = p[0]; if(p[1] < miny) miny = p[1]; if(p[1] > maxy) maxy = p[1]; });
  var pad = l.size / 2 + 2;
  l.x = minx - pad; l.y = miny - pad; l.w = maxx - minx + pad * 2; l.h = maxy - miny + pad * 2; l.bw = l.w; l.bh = l.h; l.rot = 0;
  var cx = l.x + l.w / 2, cy = l.y + l.h / 2;
  l.pts = abs.map(function(p){ return [Math.round((p[0] - cx) * 10) / 10, Math.round((p[1] - cy) * 10) / 10]; });
}
function s3dNewStroke(panelId, x, y, erase){
  var ab = artboardSize(panelById(project.productId, panelId)), b = S3D.brush, l = baseLayer('path');
  l.style = erase ? 'pen' : b.style; l.color = b.color; l.size = Math.max(1, b.sizeCm * ab.pxPerCm);
  l.opacity = erase ? 1 : b.opacity; l.blend = erase ? 'destination-out' : (b.style === 'marker' ? 'multiply' : 'source-over');
  l.seed = Math.floor(Math.random() * 1e6) + 1; l.name = erase ? 'Eraser' : (BRUSHES.filter(function(x){ return x.id === b.style; })[0] || { label: 'Brush' }).label + ' stroke';
  var seg = { panel: panelId, layer: l, abs: [[x, y]] };
  s3dSetPath(l, seg.abs);
  layersFor(panelId).push(l); bumpRev(panelId);
  return seg;
}
function s3dStrokeTo(st, which, hit){
  var seg = st[which];
  if(!seg || seg.panel !== hit.panel){
    seg = s3dNewStroke(hit.panel, hit.x, hit.y, st.erase);
    st[which] = seg; st.made.push(seg);
    return;
  }
  var last = seg.abs[seg.abs.length - 1];
  if(Math.hypot(hit.x - last[0], hit.y - last[1]) < Math.max(1.2, seg.layer.size * 0.18)) return;
  seg.abs.push([hit.x, hit.y]);
  s3dSetPath(seg.layer, seg.abs);
  bumpRev(seg.panel);
}
function s3dEndStroke(st){
  var made = st.made.map(function(sg){ return { panel: sg.panel, layer: sg.layer }; });
  if(!made.length) return;
  hPush({ label: st.erase ? 'Erase' : 'Brush stroke',
          undo: function(){ made.forEach(function(m){ var f = findLayer(m.panel, m.layer.id); if(f){ layersFor(m.panel).splice(f.index, 1); bumpRev(m.panel); } }); },
          redo: function(){ made.forEach(function(m){ if(!findLayer(m.panel, m.layer.id)){ layersFor(m.panel).push(m.layer); bumpRev(m.panel); } }); } });
}

/* ---------- fills ---------- */
function s3dFillOptsFor(panelId){
  var ab = artboardSize(panelById(project.productId, panelId)), o = S3D.fillOpts;
  var out = { fill: o.fill, c1: o.c1, c2: o.c2, angle: o.angle, scale: Math.round(o.scaleCm * ab.pxPerCm) };
  out.c3 = o.c3 || null;
  return out;
}
function s3dFillPanel(panelId){
  var ls = layersFor(panelId), first = ls[0], opts = s3dFillOptsFor(panelId);
  var f = FILLS.filter(function(x){ return x.id === opts.fill; })[0];
  if(first && first.type === 'fill'){ opts.name = (f ? f.label : 'Fill') + ' fill'; updateLayer(panelId, first.id, opts, { label: 'Fill piece' }); return first; }
  return addFillLayer(panelId, opts);
}
function s3dFillAll(){
  hBegin('Fill the whole tee');
  S3D.order.forEach(function(pid){ s3dFillPanel(pid); });
  hCommit();
}
function s3dClearFills(){
  hBegin('Remove fills');
  S3D.order.forEach(function(pid){ layersFor(pid).filter(function(l){ return l.type === 'fill'; }).forEach(function(l){ removeLayer(pid, l.id); }); });
  hCommit();
}

/* ---------- adding things where the customer is looking ---------- */
function s3dPlace(l, hit){
  l.x = Math.round(hit.x - l.w / 2); l.y = Math.round(hit.y - l.h / 2);
  bumpRev(hit.panel);
  s3dSelect(hit.panel, l.id);
  return l;
}
function s3dAddText(text, opts){
  var hit = s3dCentreHit(), ab = hit.ab, o = { size: Math.round(3.2 * ab.pxPerCm) };
  Object.keys(opts || {}).forEach(function(k){ o[k] = opts[k]; });
  if(text) o.text = text;
  var l = addTextLayer(hit.panel, o); if(!l) return null;
  if(l.w > ab.w * 0.92){ var k = ab.w * 0.92 / l.w; updateLayer(hit.panel, l.id, { size: Math.max(6, Math.round(l.size * k)) }, { silent: true }); }
  return s3dPlace(l, hit);
}
function s3dAddShape(shape, fill){
  var hit = s3dCentreHit(), ab = hit.ab, side = Math.round(Math.min(10 * ab.pxPerCm, ab.h * 0.8, ab.w * 0.8));
  var l = addShapeLayer(hit.panel, { shape: shape, w: shape === 'line' ? side * 1.6 : side, h: shape === 'line' ? Math.max(4, 0.4 * ab.pxPerCm) : side, fill: fill || '#C3423F' });
  return l ? s3dPlace(l, hit) : null;
}
function s3dAddEmoji(ch){ return s3dAddText(ch, { font: 'Emoji', weight: 400, fill: '#000000', size: Math.round(7 * s3dCentreHit().ab.pxPerCm) }); }
/* at: where it goes (a hit from s3dHit, e.g. where a file was dropped); the middle of the view otherwise */
function s3dAddImageFile(file, done, at){
  if(!file || !/^image\//.test(file.type || '')){ done && done('That file is not an image.'); return; }
  var rd = new FileReader();
  rd.onload = function(){
    var img = new Image();
    img.onload = function(){
      var hit = at || s3dCentreHit(), ab = hit.ab, l = addImageLayer(hit.panel, img, file.name, rd.result);
      if(!l){ done && done('Could not add the image.'); return; }
      var want = Math.min(18 * ab.pxPerCm, ab.w * 0.8, ab.h * 0.8 * l.w / l.h), k = want / l.w;
      l.w = Math.round(l.w * k); l.h = Math.round(l.h * k);
      s3dPlace(l, hit);
      var d = layerDpi(hit.panel, l);
      done && done(d !== null && d < 150 ? file.name + ' is only ' + d + ' DPI at this size — it will print blurred. Make it smaller or use a bigger file.' : '');
    };
    img.onerror = function(){ done && done('Could not read ' + file.name + '.'); };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}

/* ---------- pointer ---------- */
function s3dTol(ab){ return 0.35 * ab.pxPerCm; }
function s3dPointerDown(e){
  if(!S3D.ready || e.button === 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if(S3D.touches && S3D.touches > 1) return;
  var tool = S3D.tool, hit = s3dHit(e.clientX, e.clientY);
  S3D.lastHit = hit;
  if(!hit) return;                                                     /* bare background: let the tee turn */
  if(tool === 'brush' || tool === 'eraser'){
    var st = { type: 'paint', erase: tool === 'eraser', made: [], main: null, twin: null };
    st.main = s3dNewStroke(hit.panel, hit.x, hit.y, st.erase); st.made.push(st.main);
    if(S3D.brush.mirror){ var m = s3dMirrorOf(hit.panel, hit.x, hit.y); st.twin = s3dNewStroke(m.panel, m.x, m.y, st.erase); st.made.push(st.twin); }
    s3dBeginDrag(e, st); return;
  }
  if(tool === 'fill'){
    var fl = s3dFillPanel(hit.panel); s3dSelect(hit.panel, fl ? fl.id : null);
    e.preventDefault(); e.stopPropagation(); return;
  }
  /* select tool */
  var cur = s3dSelection();
  if(cur && cur.panel === hit.panel){
    var hd = s3dHandleAt(cur.layer, hit.ab, hit.x, hit.y);
    if(hd){
      var c = layerCentre(cur.layer);
      var drag = hd === 'rot'
        ? { type: 'rotate', a0: Math.atan2(hit.y - c[1], hit.x - c[0]), rot0: cur.layer.rot || 0 }
        : { type: 'scale', d0: Math.max(1, Math.hypot(hit.x - c[0], hit.y - c[1])), l0: cloneLayer(cur.layer) };
      drag.before = s3dSnapshot(cur.panel, cur.layer.id); drag.panel = cur.panel;
      s3dBeginDrag(e, drag); return;
    }
  }
  var l = s3dLayerAt(hit.panel, hit.x, hit.y, s3dTol(hit.ab));
  if(l){
    if(AB.sel !== l.id || AB.panel !== hit.panel) s3dSelect(hit.panel, l.id);
    var cc = layerCentre(l);
    s3dBeginDrag(e, { type: 'move', panel: hit.panel, ox: hit.x - cc[0], oy: hit.y - cc[1], before: s3dSnapshot(hit.panel, l.id), moved: false });
    return;
  }
  /* bare fabric: deselect on a click (not a drag), and let the tee turn */
  S3D.clickAt = { x: e.clientX, y: e.clientY, panel: hit.panel };
}
function s3dBeginDrag(e, drag){
  S3D.drag = drag; S3D.controls.enabled = false;
  try { S3D.renderer.domElement.setPointerCapture(e.pointerId); } catch(err){}
  e.preventDefault(); e.stopPropagation();
}
function s3dPointerMove(e){
  if(!S3D.ready) return;
  var d = S3D.drag;
  if(!d){ s3dHover(e); return; }
  var hit = s3dHit(e.clientX, e.clientY); if(!hit) return;
  if(d.type === 'paint'){
    s3dStrokeTo(d, 'main', hit);
    if(S3D.brush.mirror){ var m = s3dMirrorOf(hit.panel, hit.x, hit.y); s3dStrokeTo(d, 'twin', { panel: m.panel, x: m.x, y: m.y }); }
    return;
  }
  var l = d.before && d.before.ref; if(!l) return;
  if(d.type === 'move'){
    if(hit.panel !== d.panel){
      var r = s3dTransfer(l, d.panel, hit.panel, hit.x - d.ox, hit.y - d.oy);
      d.ox *= r; d.oy *= r; d.panel = hit.panel; s3dSelect(hit.panel, l.id);
    } else {
      l.x = Math.round(hit.x - d.ox - l.w / 2); l.y = Math.round(hit.y - d.oy - l.h / 2); bumpRev(d.panel);
    }
    d.moved = true; return;
  }
  if(hit.panel !== d.panel) return;
  var c = layerCentre(l);
  if(d.type === 'rotate'){
    var deg = d.rot0 + (Math.atan2(hit.y - c[1], hit.x - c[0]) - d.a0) * 180 / Math.PI;
    if(e.shiftKey) deg = Math.round(deg / 15) * 15; else { var near = Math.round(deg / 90) * 90; if(Math.abs(deg - near) < 4) deg = near; }
    l.rot = Math.round((((deg + 180) % 360 + 360) % 360 - 180) * 10) / 10; bumpRev(d.panel);
  } else if(d.type === 'scale'){
    var k = Math.max(0.05, Math.hypot(hit.x - c[0], hit.y - c[1]) / d.d0), l0 = d.l0;
    var nw = Math.max(4, l0.w * k), nh = Math.max(4, l0.h * k);
    l.x = c[0] - nw / 2; l.y = c[1] - nh / 2; l.w = nw; l.h = nh;
    if(l.type === 'text'){ l.size = Math.max(4, l0.size * k); if(l0.strokeW) l.strokeW = l0.strokeW * k; if(l0.tracking) l.tracking = l0.tracking * k; }
    if(l.type === 'shape' && l0.strokeW) l.strokeW = l0.strokeW * k;
    bumpRev(d.panel);
  }
}
function s3dPointerUp(e){
  var d = S3D.drag;
  if(d){
    S3D.drag = null; S3D.controls.enabled = true;
    if(d.type === 'paint') s3dEndStroke(d);
    else if(d.before) s3dPushMove(d.before, d.type === 'move' ? 'Move design' : (d.type === 'rotate' ? 'Rotate design' : 'Resize design'));
    /* the lists were left alone while dragging (see onProjectChanged) */
    if(typeof abRenderLayers === 'function'){ abRenderLayers(); abRenderInspector(); }
    s3dSyncPanelChips();
    if(typeof syncRack === 'function') syncRack();
    return;
  }
  var c = S3D.clickAt; S3D.clickAt = null;
  if(c && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 5 && S3D.tool === 'select') s3dSelect(c.panel, null);
}
var _hoverT = 0;
function s3dHover(e){
  var el = S3D.renderer.domElement, now = performance.now();
  if(e.pointerType !== 'mouse' || now - _hoverT < 45) return;
  _hoverT = now;
  if(S3D.tool === 'brush' || S3D.tool === 'eraser' || S3D.tool === 'fill'){ el.style.cursor = 'crosshair'; return; }
  var hit = s3dHit(e.clientX, e.clientY), cur = s3dSelection();
  if(!hit){ el.style.cursor = 'grab'; return; }
  if(cur && cur.panel === hit.panel){
    var hd = s3dHandleAt(cur.layer, hit.ab, hit.x, hit.y);
    if(hd){ el.style.cursor = hd === 'rot' ? 'alias' : 'nwse-resize'; return; }
  }
  el.style.cursor = s3dLayerAt(hit.panel, hit.x, hit.y, s3dTol(hit.ab)) ? 'move' : 'grab';
}
/* the wheel over the selected design scales it with Alt held; otherwise it zooms the view */
function s3dWheel(e){
  if(!e.altKey) return;
  var cur = s3dSelection(); if(!cur) return;
  e.preventDefault(); e.stopPropagation();
  var l = cur.layer, k = Math.exp(-e.deltaY * 0.0015), c = layerCentre(l), before = s3dSnapshot(cur.panel, l.id);
  var l0 = cloneLayer(l), nw = Math.max(4, l.w * k), nh = Math.max(4, l.h * k);
  l.x = c[0] - nw / 2; l.y = c[1] - nh / 2; l.w = nw; l.h = nh;
  if(l.type === 'text'){ l.size = Math.max(4, l0.size * k); if(l0.strokeW) l.strokeW = l0.strokeW * k; }
  bumpRev(cur.panel);
  clearTimeout(S3D.wheelT);
  if(!S3D.wheelBefore) S3D.wheelBefore = before;
  S3D.wheelT = setTimeout(function(){ var b = S3D.wheelBefore; S3D.wheelBefore = null; if(b) s3dPushMove(b, 'Resize design'); if(typeof abRenderInspector === 'function') abRenderInspector(); }, 350);
}
function s3dBindPointer(){
  var el = S3D.renderer.domElement;
  el.addEventListener('pointerdown', function(e){ S3D.touches = (S3D.touches || 0) + (e.pointerType === 'touch' ? 1 : 0); s3dPointerDown(e); }, true);
  el.addEventListener('pointermove', s3dPointerMove);
  ['pointerup', 'pointercancel'].forEach(function(t){ el.addEventListener(t, function(e){ if(e.pointerType === 'touch') S3D.touches = Math.max(0, (S3D.touches || 1) - 1); s3dPointerUp(e); }); });
  el.addEventListener('wheel', s3dWheel, { capture: true, passive: false });
  el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
}
function s3dSetTool(t){
  S3D.tool = t;
  if(S3D.renderer) S3D.renderer.domElement.style.cursor = (t === 'brush' || t === 'eraser' || t === 'fill') ? 'crosshair' : 'grab';
  if(typeof onS3dTool === 'function') onS3dTool(t);
}

/* ---------- renders for export: any view, any size, transparent or on the studio backdrop ----------
   Rendered through the visible canvas (same tone mapping and colour as the screen), resized for one
   frame and restored before the browser paints. */
function s3dRenderView(view, px, opts){
  opts = opts || {};
  var T = S3D.T, r = S3D.renderer, cam = S3D.camera, v = S3D_VIEWS[view] || S3D_VIEWS.front;
  var saved = { pos: cam.position.clone(), quat: cam.quaternion.clone(), aspect: cam.aspect, fov: cam.fov,
                target: S3D.controls.target.clone(), pr: r.getPixelRatio(), sel: S3D.src.selection };
  var d = new T.Vector3(v.dir[0], v.dir[1], v.dir[2]).normalize(), tgt = new T.Vector3(v.target[0], v.target[1], v.target[2]);
  cam.position.copy(tgt).add(d.multiplyScalar(v.dist * 0.92)); cam.up.set(0, 1, 0); cam.lookAt(tgt);
  cam.clearViewOffset(); cam.zoom = 1;
  cam.aspect = 1; cam.fov = 30; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  S3D.src.selection = function(){ return null; };
  S3D.order.forEach(function(id){ s3dCompose(id); });
  S3D.controls.target.copy(tgt); s3dKeyFollow();
  r.setPixelRatio(1); r.setSize(px, px, false); r.setClearColor(0x000000, 0);
  r.render(S3D.scene, cam);
  var c = document.createElement('canvas'); c.width = c.height = px;
  c.getContext('2d').drawImage(r.domElement, 0, 0, px, px);
  r.setPixelRatio(saved.pr);
  cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat); cam.fov = saved.fov; cam.aspect = saved.aspect;
  S3D.controls.target.copy(saved.target); cam.updateProjectionMatrix();
  S3D.src.selection = saved.sel;
  s3dResize(); s3dKeyFollow(); s3dMarkAll();
  if(opts.bg && opts.bg !== 'transparent'){
    var out = document.createElement('canvas'); out.width = out.height = px;
    var o = out.getContext('2d'), gr = o.createRadialGradient(px / 2, px * 0.4, px * 0.05, px / 2, px * 0.45, px * 0.75);
    gr.addColorStop(0, '#FBFBF7'); gr.addColorStop(1, '#E2E3DC'); o.fillStyle = gr; o.fillRect(0, 0, px, px);
    o.drawImage(c, 0, 0); c = out;
  }
  if(opts.watermark && typeof drawWatermark === 'function') drawWatermark(c.getContext('2d'), px);
  return c;
}

/* ============================================================
   THE STUDIO AROUND THE TEE
   Toolbar, tool options, stickers, text styles, the piece chips over the
   layer list, shortcuts, file drops and the multi-colour sheet.
   ============================================================ */
var S3D_QUICK = ['#111111', '#FFFFFF', '#C3423F', '#F2B33D', '#2E7D5B', '#2E4FA3', '#7B4FA0', '#F28FB1'];
var S3D_EMOJI = ['🔥', '⚡', '✨', '💥', '⭐', '🌙', '☀️', '🌈', '❤️', '💀', '👑', '💎', '🎯', '🚀', '👽', '👻', '🦋', '🌹', '🌴', '🍕',
                 '😎', '😂', '🥳', '😍', '🤘', '✌️', '👀', '💯', '🎧', '🏀', '⚽', '🎮', '🐍', '🦁', '🐺', '🦅', '🌊', '🍀', '☮️', '♾️'];
var S3D_PIECE_VIEW = { front: 'front', back: 'back', sleeve_r: 'right', sleeve_l: 'left', collar: 'neck' };
/* one click restyles the selected text; sizes are fractions of the letter height */
var S3D_TEXT_STYLES = [
  { id: 'bold', label: 'Bold', css: "800 17px 'Archivo'", p: { font: 'Archivo', weight: 800, fill: '#1E2749' } },
  { id: 'neon', label: 'Neon', css: "400 15px 'Monoton'", color: '#FF3EA5', p: { font: 'Monoton', weight: 400, fill: '#FFF0FA', shadow: { color: '#FF3EA5', blur: 0.4, x: 0, y: 0 } } },
  { id: 'retro', label: 'Retro', css: "400 15px 'Bungee'", color: '#D9452B', p: { font: 'Bungee', weight: 400, fill: '#F2B33D', fill2: '#D9452B', stroke: '#1E2749', strokeW: 0.05, shadow: { color: '#1E2749', blur: 0, x: 0.05, y: 0.07 } } },
  { id: 'script', label: 'Script', css: "400 17px 'Pacifico'", color: '#C3423F', p: { font: 'Pacifico', weight: 400, fill: '#C3423F' } },
  { id: 'arc', label: 'Arc', css: "800 15px 'Archivo'", p: { font: 'Archivo', weight: 800, fill: '#1E2749', curve: 45, tracking: 0.04 } },
  { id: 'graffiti', label: 'Graffiti', css: "400 17px 'Permanent Marker'", p: { font: 'Permanent Marker', weight: 400, fill: '#111111', shadow: { color: '#F2B33D', blur: 0, x: 0.05, y: 0.05 } } },
  { id: 'pixel', label: 'Pixel', css: "400 11px 'Press Start 2P'", color: '#2E7D5B', p: { font: 'Press Start 2P', weight: 400, fill: '#2E7D5B' } },
  { id: 'stencil', label: 'Stencil', css: "400 16px 'Black Ops One'", color: '#3B4A2F', p: { font: 'Black Ops One', weight: 400, fill: '#3B4A2F' } },
  { id: 'outline', label: 'Outline', css: "400 18px 'Anton'", p: { font: 'Anton', weight: 400, fill: '#FFFFFF', stroke: '#111111', strokeW: 0.05 } },
  { id: 'chrome', label: 'Chrome', css: "400 17px 'Righteous'", color: '#56627A', p: { font: 'Righteous', weight: 400, fill: '#F5F7FA', fill2: '#6F7B91', stroke: '#2B3140', strokeW: 0.03 } },
  { id: 'kufi', label: 'كوفي', css: "700 18px 'Reem Kufi'", p: { font: 'Reem Kufi', weight: 700, fill: '#1E2749' } },
  { id: 'ruqaa', label: 'رقعة', css: "700 18px 'Aref Ruqaa'", color: '#6E2A35', p: { font: 'Aref Ruqaa', weight: 700, fill: '#6E2A35' } }
];

function s3dToast(text, ms){
  var el = $('s3dMsg'); if(!el) return;
  clearTimeout(S3D.toastT);
  if(!text){ el.classList.add('hidden'); return; }
  el.textContent = text; el.classList.remove('hidden');
  S3D.toastT = setTimeout(function(){ el.classList.add('hidden'); }, ms || 4200);
}

/* entering 3D: start the engine the first time, pick a piece so the layer list has one */
function s3dOpen(){
  if(!AB.panel || !panelById(project.productId, AB.panel)) s3dSelect('front', null);
  else s3dSyncPanelChips();
  s3dSyncSelActs();
  if(S3D.ready){ $('s3dLoading').classList.add('hidden'); s3dSetVisible(state.mode === '3d'); return Promise.resolve(true); }
  if(S3D.failed){ s3dShowFail(); return Promise.resolve(false); }
  $('s3dLoading').classList.remove('hidden'); $('s3dFail').classList.add('hidden');
  return s3dInit($('gl3d')).then(function(ok){
    $('s3dLoading').classList.add('hidden');
    if(!ok){ s3dShowFail(); return false; }
    s3dSetVisible(state.mode === '3d');
    s3dSetTool(S3D.tool);
    return true;
  });
}
function s3dShowFail(){
  var el = $('s3dFail'); el.innerHTML = '';
  var p = document.createElement('div'); p.textContent = S3D.failed || 'The 3D studio could not start.'; el.appendChild(p);
  if(S3D.canRetry){
    var again = document.createElement('button'); again.className = 'btn small'; again.type = 'button'; again.textContent = 'Try again';
    again.addEventListener('click', function(){ S3D.failed = null; s3dOpen(); });
    el.appendChild(again);
  }
  var flat = document.createElement('button'); flat.className = 'btn small ghost'; flat.type = 'button'; flat.textContent = 'Design on flat pieces';
  flat.addEventListener('click', function(){ setMode('design'); });
  el.appendChild(flat);
  el.classList.remove('hidden');
  $('s3dLoading').classList.add('hidden');
}

/* the pieces as chips over the layer list: which one the list shows, how many designs each has */
function s3dSyncPanelChips(){
  var host = $('s3dChips'); if(!host || !project) return;
  var ps = panelsFor(project.productId);
  if(host.dataset.product !== project.productId || host.children.length !== ps.length){
    host.innerHTML = ''; host.dataset.product = project.productId;
    ps.forEach(function(p){
      var b = document.createElement('button'); b.type = 'button'; b.dataset.panel = p.id; b.setAttribute('role', 'tab');
      var name = document.createElement('span'); name.textContent = p.label;
      var n = document.createElement('span'); n.className = 'n';
      b.appendChild(name); b.appendChild(n);
      b.addEventListener('click', function(){ s3dSelect(p.id, null); s3dFocusPanel(p.id); });
      host.appendChild(b);
    });
  }
  Array.prototype.forEach.call(host.children, function(b){
    var on = b.dataset.panel === AB.panel, n = layersFor(b.dataset.panel).length;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.lastChild.textContent = n ? String(n) : '';
  });
}
function s3dFocusPanel(id){
  var v = S3D_PIECE_VIEW[id]; if(!v || !S3D.ready) return;
  s3dSpin(false); s3dView(v);
}
function s3dSpin(on){
  s3dAutoRotate(on);
  var b = $('s3dSpin'); if(b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
}

/* ---------- tools ---------- */
var S3D_HINTS = {
  select: 'Drag a design to move it · drag the fabric to turn the tee · scroll to zoom',
  brush: 'Paint anywhere on the tee · drag the background to turn it',
  eraser: 'Rub out paint · drag the background to turn the tee',
  fill: 'Click a piece to fill it · drag the background to turn the tee'
};
function onS3dTool(t){
  document.querySelectorAll('#s3dTools button').forEach(function(b){
    var on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  var er = t === 'eraser';
  $('optSelect').classList.toggle('hidden', t !== 'select');
  $('optBrush').classList.toggle('hidden', t !== 'brush' && !er);
  $('optFill').classList.toggle('hidden', t !== 'fill');
  $('eraserNote').classList.toggle('hidden', !er);
  $('brushStyles').classList.toggle('hidden', er);
  $('brushColor').closest('.rowline').classList.toggle('hidden', er);
  $('brushOp').closest('.rowline').classList.toggle('hidden', er);
  $('optBrush').querySelector('.speclabel').textContent = er ? 'Eraser' : 'Brush';
  $('s3dHint').textContent = S3D_HINTS[t] || S3D_HINTS.select;
  s3dStickers(false);
}
/* text, image and sticker add something and go back to moving; the others are modes */
function s3dToolAction(t){
  if(locked){ openGate(); return; }
  if(t === 'text'){
    s3dSetTool('select');
    if(!s3dAddText()) return;
    /* phones: show the text box in the sheet without popping the keyboard over the tee */
    if(window.innerWidth <= 900){ if(window.sheetDetent) window.sheetDetent('half'); $('sheet').scrollTop = 0; return; }
    setTimeout(function(){ var el = $('s3dTxt'); if(el){ el.focus({ preventScroll: true }); el.select(); } }, 40);
    return;
  }
  if(t === 'image'){ s3dSetTool('select'); $('s3dFile').click(); return; }
  if(t === 'sticker'){ s3dStickers(); return; }
  s3dSetTool(t);
}

/* ---------- stickers: shapes and emoji ---------- */
S3D.stickColor = '#C3423F';
function s3dStickers(on){
  var pop = $('s3dStickers'), btn = document.querySelector('#s3dTools [data-tool="sticker"]');
  if(!pop) return;
  if(on === undefined) on = pop.classList.contains('hidden');
  pop.classList.toggle('hidden', !on);
  if(btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  if(on) s3dDrawStickerShapes();
}
function s3dDrawStickerShapes(){
  document.querySelectorAll('#stickShapes button').forEach(function(b){
    var c = b.querySelector('canvas'), g = c.getContext('2d'), sh = b.dataset.shape, n = c.width;
    g.clearRect(0, 0, n, n); g.save(); g.translate(n / 2, n / 2);
    g.fillStyle = S3D.stickColor; g.beginPath();
    shapePath(g, sh, sh === 'line' ? n * 0.8 : n * 0.72, sh === 'line' ? n * 0.08 : n * 0.72);
    g.fill(sh === 'ring' ? 'evenodd' : 'nonzero');
    if(lum(S3D.stickColor) > 0.85){ g.lineWidth = 1.5; g.strokeStyle = 'rgba(30,39,73,0.35)'; g.stroke(); }
    g.restore();
  });
}
function s3dBuildStickers(){
  var shapes = $('stickShapes'), emoji = $('stickEmoji'), sw = $('stickSw');
  shapes.innerHTML = ''; emoji.innerHTML = ''; sw.innerHTML = '';
  SHAPES.forEach(function(sh){
    var b = document.createElement('button'); b.type = 'button'; b.dataset.shape = sh.id; b.title = sh.label; b.setAttribute('aria-label', sh.label);
    var c = document.createElement('canvas'); c.width = c.height = 64; b.appendChild(c);
    b.addEventListener('click', function(){ if(s3dAddShape(sh.id, S3D.stickColor)) s3dStickers(false); });
    shapes.appendChild(b);
  });
  S3D_EMOJI.forEach(function(ch){
    var b = document.createElement('button'); b.type = 'button'; b.textContent = ch; b.setAttribute('aria-label', 'Emoji ' + ch);
    b.addEventListener('click', function(){ if(s3dAddEmoji(ch)) s3dStickers(false); });
    emoji.appendChild(b);
  });
  S3D_QUICK.forEach(function(hex){
    var b = document.createElement('button'); b.type = 'button'; b.style.background = hex; b.title = hex; b.setAttribute('aria-label', 'Shape colour ' + hex);
    b.addEventListener('click', function(){ S3D.stickColor = hex; $('stickColor').value = hex; s3dDrawStickerShapes(); });
    sw.appendChild(b);
  });
  $('stickColor').addEventListener('input', function(){ S3D.stickColor = this.value; s3dDrawStickerShapes(); });
}

/* ---------- brush and eraser options ---------- */
function s3dBuildBrushOptions(){
  var host = $('brushStyles'), sw = $('brushSw');
  host.innerHTML = ''; sw.innerHTML = '';
  BRUSHES.forEach(function(br){
    var b = document.createElement('button'); b.type = 'button'; b.textContent = br.label; b.dataset.style = br.id; b.setAttribute('role', 'radio');
    b.addEventListener('click', function(){ S3D.brush.style = br.id; s3dSyncBrush(); });
    host.appendChild(b);
  });
  S3D_QUICK.forEach(function(hex){
    var b = document.createElement('button'); b.type = 'button'; b.style.background = hex; b.title = hex; b.setAttribute('aria-label', 'Brush colour ' + hex);
    b.addEventListener('click', function(){ S3D.brush.color = hex; s3dSyncBrush(); });
    sw.appendChild(b);
  });
  $('brushColor').addEventListener('input', function(){ S3D.brush.color = this.value; });
  $('brushSize').addEventListener('input', function(){ S3D.brush.sizeCm = Math.max(0.1, +this.value / 10); s3dSyncBrush(); });
  $('brushOp').addEventListener('input', function(){ S3D.brush.opacity = Math.max(0.05, +this.value / 100); });
  $('brushMirror').addEventListener('change', function(){ S3D.brush.mirror = this.checked; });
  s3dSyncBrush();
}
function s3dSyncBrush(){
  var b = S3D.brush;
  document.querySelectorAll('#brushStyles button').forEach(function(x){ var on = x.dataset.style === b.style; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
  $('brushColor').value = b.color; $('brushSize').value = Math.round(b.sizeCm * 10);
  $('brushSizeV').textContent = (Math.round(b.sizeCm * 10) / 10).toFixed(1) + ' cm';
  $('brushOp').value = Math.round(b.opacity * 100); $('brushMirror').checked = !!b.mirror;
}

/* ---------- fill options: these set the next fill; a fill already made is edited in the inspector ---------- */
function s3dBuildFillOptions(){
  var host = $('fillKinds'); host.innerHTML = '';
  FILLS.forEach(function(f){
    var b = document.createElement('button'); b.type = 'button'; b.dataset.fill = f.id; b.setAttribute('role', 'radio');
    var c = document.createElement('canvas'); c.width = 84; c.height = 60;
    b.appendChild(c); b.appendChild(document.createTextNode(f.label));
    b.addEventListener('click', function(){ S3D.fillOpts.fill = f.id; s3dSyncFill(); });
    host.appendChild(b);
  });
  function opt(id, ev, fn){ $(id).addEventListener(ev, function(){ fn(this); s3dSyncFill(true); }); }
  opt('fillC1', 'input', function(el){ S3D.fillOpts.c1 = el.value; });
  opt('fillC2', 'input', function(el){ S3D.fillOpts.c2 = el.value; });
  opt('fillC3', 'input', function(el){ if($('fillUse3').checked) S3D.fillOpts.c3 = el.value; });
  opt('fillUse3', 'change', function(el){ S3D.fillOpts.c3 = el.checked ? $('fillC3').value : ''; });
  opt('fillAngle', 'input', function(el){ S3D.fillOpts.angle = +el.value; });
  opt('fillScale', 'input', function(el){ S3D.fillOpts.scaleCm = Math.max(1, +el.value); });
  $('fillAllBtn').addEventListener('click', function(){ if(locked){ openGate(); return; } s3dFillAll(); s3dToast('The whole tee is filled. Click a piece to select its fill and fine-tune it on the right.'); });
  $('fillClearBtn').addEventListener('click', function(){ s3dClearFills(); });
  s3dSyncFill();
}
function s3dSyncFill(soon){
  var o = S3D.fillOpts;
  document.querySelectorAll('#fillKinds button').forEach(function(b){ var on = b.dataset.fill === o.fill; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  $('fillC1').value = o.c1; $('fillC2').value = o.c2; $('fillUse3').checked = !!o.c3; if(o.c3) $('fillC3').value = o.c3;
  $('fillAngle').value = o.angle; $('fillScale').value = o.scaleCm; $('fillScaleV').textContent = o.scaleCm + ' cm';
  /* the previews redraw a moment after the last change (camo and tie-dye take a few ms each) */
  clearTimeout(S3D.fillPrevT);
  S3D.fillPrevT = setTimeout(s3dFillPreviews, soon ? 90 : 0);
}
function s3dFillPreviews(){
  var o = S3D.fillOpts;
  document.querySelectorAll('#fillKinds button').forEach(function(b){
    var c = b.querySelector('canvas'), g = c.getContext('2d');
    g.save(); g.clearRect(0, 0, c.width, c.height);
    drawFill(g, { fill: b.dataset.fill, c1: o.c1, c2: o.c2, c3: o.c3 || null, angle: o.angle, scale: 9 + o.scaleCm * 2.2, seed: 5 }, c.width, c.height, 1);
    g.restore();
  });
}

/* ---------- the selected design: quick actions, text styles ---------- */
function s3dSyncSelActs(){
  var acts = $('s3dSelActs'); if(!acts) return;
  var l = state.mode === '3d' && AB.panel && AB.sel ? (findLayer(AB.panel, AB.sel) || {}).layer : null;
  var design = !!(l && l.type !== 'fill');
  acts.classList.toggle('hidden', !design);
  $('s3dSelHelp').classList.toggle('hidden', design);
  $('s3dTextStyles').classList.toggle('hidden', !(l && l.type === 'text'));
  var tx = $('s3dTxt');
  if(l && l.type === 'text' && document.activeElement !== tx && tx.value !== l.text) tx.value = l.text;
  if(design){
    var tile = acts.querySelector('[data-act="tile"]');
    tile.textContent = l.tile ? 'Single' : 'Pattern';
    tile.title = l.tile ? 'Stop repeating it' : 'Repeat it across the whole piece';
  }
}
function s3dBuildTextStyles(){
  var host = $('textStyleGrid'); host.innerHTML = '';
  S3D_TEXT_STYLES.forEach(function(st){
    var b = document.createElement('button'); b.type = 'button'; b.textContent = st.label; b.title = st.id === 'kufi' || st.id === 'ruqaa' ? 'Arabic ' + st.p.font : st.label;
    b.style.font = st.css; if(st.color) b.style.color = st.color;
    if(st.id === 'outline'){ b.style.color = '#FFFFFF'; b.style.webkitTextStroke = '1px #111'; }
    if(st.id === 'neon') b.style.textShadow = '0 0 6px #FF3EA5';
    b.addEventListener('click', function(){ s3dApplyTextStyle(st); });
    host.appendChild(b);
  });
}
function s3dApplyTextStyle(st){
  var cur = s3dSelection(); if(!cur || cur.layer.type !== 'text') return;
  var l = cur.layer, sz = Math.max(1, l.size || 100), p = st.p;
  var arabic = /[؀-ۿ]/.test(l.text || '');
  var patch = { font: p.font, weight: p.weight || 400, fill: p.fill, fill2: p.fill2 || null,
                stroke: p.stroke || null, strokeW: p.strokeW ? Math.round(p.strokeW * sz * 10) / 10 : 0,
                shadow: p.shadow ? { color: p.shadow.color, blur: p.shadow.blur * sz, x: p.shadow.x * sz, y: p.shadow.y * sz } : null,
                curve: arabic ? 0 : (p.curve || 0), tracking: arabic ? 0 : Math.round((p.tracking || 0) * sz * 10) / 10 };
  updateLayer(cur.panel, l.id, patch, { label: st.label + ' text' });
  s3dSelect(cur.panel, l.id);
}
function s3dSelAction(act){
  var cur = s3dSelection(); if(!cur) return;
  var l = cur.layer, pid = cur.panel, ab = artboardSize(panelById(project.productId, pid));
  if(act === 'dup'){ var d = duplicateLayer(pid, l.id); if(d) s3dSelect(pid, d.id); return; }
  if(act === 'centre'){ updateLayer(pid, l.id, { x: Math.round((ab.w - l.w) / 2) }, { label: 'Centre on piece' }); s3dSelect(pid, l.id); return; }
  if(act === 'tile'){ updateLayer(pid, l.id, { tile: l.tile ? null : { gap: 0.25, rot: 0, offset: true } }, { label: l.tile ? 'Stop pattern' : 'Make a pattern' }); s3dSelect(pid, l.id); return; }
  if(act === 'up' || act === 'down'){ reorderLayer(pid, l.id, act === 'up' ? 1 : -1); s3dSelect(pid, l.id); return; }
  if(act === 'other'){
    /* the same spot on the other side: left chest <-> right chest, one sleeve <-> the other */
    var c = layerCentre(l), m = s3dMirrorOf(pid, c[0], c[1]), copy = cloneLayer(l);
    copy.id = uid('l_'); copy.name = (l.name || l.type) + ' (other side)'; copy.rot = -(l.rot || 0);
    if(l.type === 'path') copy.flipX = !l.flipX;
    if(m.panel !== pid) s3dRescale(copy, artboardSize(panelById(project.productId, m.panel)).pxPerCm / ab.pxPerCm);
    copy.x = m.x - copy.w / 2; copy.y = m.y - copy.h / 2;
    insertLayer(m.panel, copy, 'Copy to the other side');
    s3dSelect(m.panel, copy.id);
    if(m.panel !== pid) s3dFocusPanel(m.panel);
  }
}

/* ---------- keys (3D only, never while typing) ---------- */
function s3dKey(e){
  if(state.mode !== '3d' || locked || e.ctrlKey || e.metaKey || e.altKey) return;
  var t = e.target, typing = t && (/TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable ||
    (t.tagName === 'INPUT' && !/^(checkbox|radio|range|color|button|file)$/.test(t.type)));
  if(e.key === 'Escape'){ s3dStickers(false); return; }
  if(typing || document.querySelector('.modal.on')) return;
  var k = (e.key || '').toLowerCase();
  var tools = { v: 'select', t: 'text', i: 'image', s: 'sticker', b: 'brush', e: 'eraser', f: 'fill' };
  if(tools[k]){ e.preventDefault(); s3dToolAction(tools[k]); return; }
  var views = { '1': 'front', '2': 'back', '3': 'left', '4': 'right', '5': 'top', '6': 'armpit', '7': 'bottom' };
  if(views[k]){ e.preventDefault(); s3dSpin(false); s3dView(views[k]); return; }
  if(k === '[' || k === ']'){
    e.preventDefault();
    S3D.brush.sizeCm = Math.max(0.1, Math.min(6, Math.round((S3D.brush.sizeCm * (k === ']' ? 1.25 : 0.8)) * 10) / 10));
    s3dSyncBrush(); s3dToast('Brush ' + S3D.brush.sizeCm.toFixed(1) + ' cm', 1200);
  }
}

/* ---------- the design on the tee in every garment colour, as one PNG ---------- */
async function s3dContactSheet(){
  if(!trialAllows('export', project.productId)) return;
  var btn = $('contactSheet3dBtn'); if(btn.disabled) return;
  btn.disabled = true; var was = btn.textContent; btn.textContent = 'Rendering…';
  try {
    if(!(await s3dEnsure())){ s3dToast(S3D.failed || '3D is not available on this device.'); return; }
    await new Promise(function(r){ setTimeout(r, 30); });
    var view = !layersFor('front').length && layersFor('back').length ? 'back' : 'front';
    var cols = Math.min(4, GARMENT_COLORS.length), rows = Math.ceil(GARMENT_COLORS.length / cols), cell = 520, pad = 24, label = 44;
    var c = document.createElement('canvas');
    c.width = cols * (cell + pad) + pad; c.height = rows * (cell + label + pad) + pad;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ECEDE8'; ctx.fillRect(0, 0, c.width, c.height);
    var base = S3D.src.base;
    try {
      GARMENT_COLORS.forEach(function(col, i){
        var x = pad + (i % cols) * (cell + pad), y = pad + Math.floor(i / cols) * (cell + label + pad);
        S3D.src.base = function(){ return col.hex; };
        ctx.fillStyle = '#FBFBF7'; ctx.fillRect(x, y, cell, cell + label);
        ctx.drawImage(s3dRenderView(view, cell, { bg: 'studio' }), x, y);
        ctx.fillStyle = col.hex; ctx.fillRect(x + 12, y + cell + 12, 20, 20);
        ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.strokeRect(x + 12.5, y + cell + 12.5, 19, 19);
        ctx.font = '600 15px "IBM Plex Mono", monospace'; ctx.fillStyle = '#1E2749'; ctx.textBaseline = 'top';
        ctx.fillText(col.name.toUpperCase() + '  ' + col.hex.toUpperCase() + (col.tcx ? '  TCX ' + col.tcx : ''), x + 42, y + cell + 14);
      });
    } finally { S3D.src.base = base; s3dMarkAll(); }
    await downloadCanvas(c, safeName(currentDef().name) + '_3d_colours.png');
    track('export', project.productId, 'multi-colour sheet (3D)');
  } catch(e){
    s3dToast('Could not make the sheet: ' + (e.message || e));
  } finally { btn.disabled = false; btn.textContent = was; }
}

/* ---------- wiring (once) ---------- */
function bindStudio3d(){
  if(S3D.uiBound) return; S3D.uiBound = true;
  document.querySelectorAll('#s3dTools button').forEach(function(b){
    b.setAttribute('aria-pressed', b.dataset.tool === S3D.tool ? 'true' : 'false');
    b.addEventListener('click', function(){ s3dToolAction(b.dataset.tool); });
  });
  var st = document.querySelector('#s3dTools [data-tool="sticker"]'); if(st){ st.setAttribute('aria-haspopup', 'dialog'); st.setAttribute('aria-expanded', 'false'); st.removeAttribute('aria-pressed'); }
  document.querySelectorAll('#s3dViews button[data-view]').forEach(function(b){
    b.addEventListener('click', function(){ s3dSpin(false); s3dView(b.dataset.view); });
  });
  $('s3dSpin').addEventListener('click', function(){ s3dSpin(!(S3D.controls && S3D.controls.autoRotate)); });
  $('s3dFile').addEventListener('change', function(){
    var f = this.files && this.files[0]; this.value = '';
    if(f) s3dAddImageFile(f, function(msg){ s3dToast(msg); });
  });
  document.querySelectorAll('#s3dSelActs button').forEach(function(b){ b.addEventListener('click', function(){ s3dSelAction(b.dataset.act); }); });
  $('s3dTxt').addEventListener('input', function(){ var l = selLayer(); if(l && l.type === 'text') liveUpdate({ text: this.value }); });
  $('s3dTxt').addEventListener('change', function(){ gestureEnd('Edit text'); abRenderLayers(); });
  s3dBuildStickers(); s3dBuildBrushOptions(); s3dBuildFillOptions(); s3dBuildTextStyles();
  $('contactSheet3dBtn').addEventListener('click', s3dContactSheet);
  document.addEventListener('keydown', s3dKey);
  /* a click anywhere else closes the sticker popover */
  document.addEventListener('pointerdown', function(e){
    if(e.target.closest && !e.target.closest('#s3dStickers') && !e.target.closest('#s3dTools [data-tool="sticker"]')) s3dStickers(false);
  }, true);
  /* an image dropped on the tee lands where it was dropped */
  var stage = $('studio3d');
  ['dragenter', 'dragover'].forEach(function(t){ stage.addEventListener(t, function(e){ e.preventDefault(); stage.classList.add('hot'); }); });
  ['dragleave', 'drop'].forEach(function(t){ stage.addEventListener(t, function(){ stage.classList.remove('hot'); }); });
  stage.addEventListener('drop', function(e){
    e.preventDefault();
    if(locked || state.mode !== '3d') return;
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if(!f) return;
    s3dAddImageFile(f, function(msg){ s3dToast(msg); }, s3dHit(e.clientX, e.clientY));
  });
  onS3dTool(S3D.tool);
}
