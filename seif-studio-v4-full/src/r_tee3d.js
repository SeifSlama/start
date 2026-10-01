/* ============================================================
   SEIF STUDIO — 3D T-SHIRT GEOMETRY (procedural, ghost mannequin)

   The tee is built the way a factory builds it: flat pattern pieces —
   front, back, two sleeves, a neck rib — "sewn" into a hollow shell.
   Every vertex knows where it sits on its flat piece (cm), so the
   texture coordinates ARE the print pattern: whatever is painted on the
   3D surface lands exactly on the piece that gets printed and sewn,
   seams and underarms included.

   Units: cm, size M. y up (hem at 0), z toward the viewer (front),
   x to the viewer's right in the front view.
     body   a generalised cylinder: an ellipse per height (half-width a(y),
            half-depth b(y), front and back each their own depth), closed
            over the shoulders by a rounded "roof" that meets on the
            shoulder seam, with armholes and the neckline cut away.
     sleeve lofted from the armhole loop to the cuff along the arm axis.
     rib    a folded band standing on the neckline.
   Pure maths, no three.js — the viewer turns these arrays into meshes.
   ============================================================ */
var TEE3D = (function(){
  var D = Math.PI / 180;
  var M = {
    AP: 46.5,             /* underarm height */
    SP: 67.5,             /* shoulder point height */
    TOP: 72,              /* high point shoulder (neck point) */
    neckHalf: 8.5, neckFrontY: 63.5, neckBackY: 70.5,
    shoulderHalf: 23,
    chestHalf: 20.8, hemFlare: 0.6,
    frontDepth: 12.9, backDepth: 12.0, hemDepth: 12.7, frontTop: 6.2, backTop: 5.6,
    roofR: 6.4,           /* how far below the shoulder seam the roof starts to round over */
    ahDeepY: 53.5, ahDeepTheta: 63 * D,
    armAngle: 47 * D, armForward: 0.12,
    sleeveTop: 20, cuffR: 6.15,
    ribH: 2.0, ribT: 0.34, hemTurn: 0.7, hemT: 0.42
  };
  function clamp(t, a, b){ return t < a ? a : (t > b ? b : t); }
  function smooth(t){ t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ---------- the body surface ---------- */
  function halfW(y){
    if(y <= M.AP){ var k = 1 - y / M.AP; return M.chestHalf + M.hemFlare * k * k; }
    return M.chestHalf + (M.shoulderHalf - M.chestHalf) * smooth((y - M.AP) / (M.SP - M.AP));
  }
  function depth(y, back){
    var chest = back ? M.backDepth : M.frontDepth, top = back ? M.backTop : M.frontTop, b;
    if(y < 34){ var k = 1 - y / 34; b = chest + (M.hemDepth - chest) * k * k; }
    else b = chest;
    /* the upper chest slopes back to the collar; the upper back stays fuller (shoulder blades) */
    var from = back ? 50 : 46;
    if(y > from) b -= (chest - top) * smooth((y - from) / (M.TOP - from));
    return b;
  }
  /* shoulder seam: straight from the neck point to the shoulder point (extended inside the neck) */
  function seamY(x){ return M.TOP - (Math.abs(x) - M.neckHalf) * (M.TOP - M.SP) / (M.shoulderHalf - M.neckHalf); }
  function roof(d){ if(d <= 0) return 0; if(d >= M.roofR) return 1; var u = 1 - d / M.roofR; return Math.sqrt(1 - u * u); }
  /* front: theta from centre front, + toward +x.  back: theta from centre back, + toward -x */
  /* soft drape: hem waves, side folds and the diagonal drag lines from the underarms.
     A function of the angle around the body and the height only, so front and back agree
     on every seam, and everything stitched to the body (sleeves, rib, hem) samples it too. */
  function drape(phi, y, x){
    var k, d = 0;
    if(y < 20){ k = 1 - y / 20; d += k * k * (0.42 * Math.sin(6 * phi + 0.7) + 0.2 * Math.sin(11 * phi + 2.1) + 0.12 * Math.sin(17 * phi + 0.4)); }
    var side = Math.pow(Math.abs(Math.sin(phi)), 6);
    if(y > 6 && y < 44) d += side * 0.3 * Math.sin(y * 0.42 + phi * 2.0) * Math.sin(Math.PI * (y - 6) / 38);
    var ax = Math.abs(x);
    if(y > 33 && y < 52 && ax > 7){
      var env = Math.sin(Math.PI * (y - 33) / 19) * smooth((ax - 7) / 8) * (1 - smooth((ax - 19) / 3));
      d += env * 0.32 * Math.sin((y + ax * 0.9) * 0.62 + (phi > 0 ? 0.4 : 1.3));
    }
    d += 0.12 * Math.sin(phi * 3 + y * 0.11 + 1.7) * Math.sin(y * 0.07);
    return d * (1 - smooth((y - 54) / 6));
  }
  function bodyPoint(back, th, y){
    var a = halfW(y), x = (back ? -1 : 1) * a * Math.sin(th);
    var z = depth(y, back) * Math.cos(th) * roof(seamY(x) - y);
    z = back ? -z : z;
    z += 0.55 * smooth((y - 30) / 14) * (1 - smooth((y - 58) / 10));   /* the chest sits slightly forward */
    var r = Math.hypot(x, z);
    if(r > 1e-6){
      var dd = drape(Math.atan2(x, z), y, x);
      x += x / r * dd; z += z / r * dd;
    }
    return [x, y, z];
  }

  /* ---------- outlines in (theta, y) ---------- */
  function neckX(y, back){
    var top = M.TOP, low = back ? M.neckBackY : M.neckFrontY;
    if(y <= low) return 0;
    var t = (top - y) / (top - low);
    return M.neckHalf * Math.sqrt(Math.max(0, 1 - t * t));
  }
  var thNeck = Math.asin(M.neckHalf / M.shoulderHalf);
  /* height of the panel's top edge at |theta|: the neckline inside the neck point, the shoulder seam outside */
  function topY(th, back){
    th = Math.abs(th);
    if(th >= thNeck) return Math.max(M.SP, seamY(M.shoulderHalf * Math.sin(th)));
    var lo = back ? M.neckBackY : M.neckFrontY, hi = M.TOP;
    for(var i = 0; i < 34; i++){
      var mid = (lo + hi) / 2, t = Math.asin(clamp(neckX(mid, back) / halfW(mid), 0, 1));
      if(t < th) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  /* armhole: an ellipse in (theta, y) from the underarm (90°, AP) via the deepest point to the shoulder point (90°, SP) */
  function armS(th){ return clamp((90 * D - Math.abs(th)) / (90 * D - M.ahDeepTheta), 0, 1); }
  function armLow(th){ var s = armS(th); return M.ahDeepY - (M.ahDeepY - M.AP) * Math.sqrt(1 - s * s); }
  function armHigh(th){ var s = armS(th); return M.ahDeepY + (M.SP - M.ahDeepY) * Math.sqrt(1 - s * s); }

  /* ---------- flattening tables: (theta, y) -> pattern (u, v) in cm ---------- */
  function flatTable(back){
    /* rows every 0.5 cm, then every 0.06 cm over the shoulders, where the cloth turns over the
       top (the roof meets the seam with a vertical tangent) and a coarse table would make the
       shoulder seam of the flat pattern zig-zag */
    var NT = 181, dth = 90 * D / (NT - 1), Y1 = 60, dy1 = 0.5, K1 = Math.round(Y1 / dy1), dy2 = 0.06;
    var NY = K1 + Math.ceil((M.TOP - Y1) / dy2) + 1;
    function yOf(k){ return k <= K1 ? k * dy1 : Math.min(M.TOP, Y1 + (k - K1) * dy2); }
    function rowOf(y){ return y <= Y1 ? y / dy1 : K1 + (y - Y1) / dy2; }
    var U = new Float32Array(NT * NY), V = new Float32Array(NT * NY);
    for(var k = 0; k < NY; k++){
      var y = yOf(k), prev = bodyPoint(back, 0, y), acc = 0;
      U[k * NT] = 0;
      for(var j = 1; j < NT; j++){
        var p = bodyPoint(back, j * dth, y);
        acc += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
        U[k * NT + j] = acc; prev = p;
      }
    }
    for(var j2 = 0; j2 < NT; j2++){
      var th = j2 * dth, prev2 = bodyPoint(back, th, 0), acc2 = 0;
      V[j2] = 0;
      for(var k2 = 1; k2 < NY; k2++){
        var y0 = yOf(k2 - 1), y1 = yOf(k2), SUB = Math.max(1, Math.ceil((y1 - y0) / 0.17));
        for(var s = 1; s <= SUB; s++){
          var p2 = bodyPoint(back, th, y0 + (y1 - y0) * s / SUB);
          acc2 += Math.hypot(p2[0] - prev2[0], p2[1] - prev2[1], p2[2] - prev2[2]);
          prev2 = p2;
        }
        V[k2 * NT + j2] = acc2;
      }
    }
    function lookup(T, th, y){
      var sg = th < 0 ? -1 : 1, a = Math.min(Math.abs(th) / dth, NT - 1.0001), b = clamp(rowOf(y), 0, NY - 1.0001);
      var j = Math.floor(a), k = Math.floor(b), fa = a - j, fb = b - k;
      var v00 = T[k * NT + j], v01 = T[k * NT + j + 1], v10 = T[(k + 1) * NT + j], v11 = T[(k + 1) * NT + j + 1];
      return (v00 * (1 - fa) * (1 - fb) + v01 * fa * (1 - fb) + v10 * (1 - fa) * fb + v11 * fa * fb) * sg;
    }
    return { u: function(th, y){ return lookup(U, th, y); }, v: function(th, y){ return Math.abs(lookup(V, th, y)); } };
  }

  /* ---------- small vector helpers ---------- */
  function sub(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b){ return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, k){ return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a){ return Math.hypot(a[0], a[1], a[2]); }
  function norm(a){ var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function lerp3(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  /* ---------- mesh accumulation ---------- */
  function Mesh(){ this.pos = []; this.uv = []; this.idx = []; this.pat = []; }
  Mesh.prototype.vert = function(p, pu, pv){ this.pos.push(p[0], p[1], p[2]); this.pat.push(pu || 0, pv || 0); return this.pos.length / 3 - 1; };
  /* grid of rows x cols vertex indices -> two triangles per cell, the face normals along `out`.
     The winding is decided once for the whole grid (an area-weighted vote), never per triangle:
     a sliver's own normal is noise (columns crowd together at the armhole and neck), and one
     sliver wound the wrong way is a pinhole in the cloth. */
  Mesh.prototype.grid = function(G, rows, cols, outFn){
    var P = this.pos, I = this.idx, tris = [], vote = 0, r, c;
    function pt(i){ return [P[i*3], P[i*3+1], P[i*3+2]]; }
    function add3(t){
      var pa = pt(t[0]), pb = pt(t[1]), pc = pt(t[2]), n = cross(sub(pb, pa), sub(pc, pa));
      if(len(n) < 1e-9) return;                                 /* drop degenerate cells (shoulder point) */
      vote += dot(n, outFn(mul(add(add(pa, pb), pc), 1 / 3)));
      tris.push(t);
    }
    for(r = 0; r < rows - 1; r++) for(c = 0; c < cols - 1; c++){
      var a = G[r][c], b = G[r][c + 1], d = G[r + 1][c], e = G[r + 1][c + 1];
      add3([a, b, e]); add3([a, e, d]);
    }
    tris.forEach(function(t){ if(vote < 0) I.push(t[0], t[2], t[1]); else I.push(t[0], t[1], t[2]); });
  };

  /* outward direction for the body: away from the body axis, up over the shoulders */
  function bodyOut(p){ var o = [p[0], 0, p[2] - 0.6]; if(p[1] > 60) o[1] = (p[1] - 60) * 0.6; return o; }

  /* ---------- one body panel (front or back) ---------- */
  function buildBody(back){
    var flat = flatTable(back), m = new Mesh();
    var cols = [], NC = 81, i;
    for(i = 0; i < NC; i++) cols.push(-90 * D + 180 * D * i / (NC - 1));
    [thNeck, -thNeck, M.ahDeepTheta, -M.ahDeepTheta, 0].forEach(function(t){ cols.push(t); });
    cols.sort(function(a, b){ return a - b; });
    cols = cols.filter(function(t, k){ return k === 0 || t - cols[k - 1] > 0.15 * D; });
    /* refine: where the neckline or armhole runs steeply, add columns until its points are < 0.85 cm apart */
    function edgePts(t){
      var out = [bodyPoint(back, t, topY(t, back))];
      if(Math.abs(t) >= M.ahDeepTheta - 1e-9){ out.push(bodyPoint(back, t, armLow(t))); out.push(bodyPoint(back, t, armHigh(t))); }
      return out;
    }
    for(var pass = 0; pass < 14; pass++){
      var next = [cols[0]], added = 0;
      for(var q = 1; q < cols.length; q++){
        var a0 = edgePts(cols[q - 1]), a1 = edgePts(cols[q]), gap = 0;
        for(var e = 0; e < Math.min(a0.length, a1.length); e++) gap = Math.max(gap, len(sub(a0[e], a1[e])));
        if(gap > 0.85 && cols[q] - cols[q - 1] > 0.02 * D){ next.push((cols[q - 1] + cols[q]) / 2); added++; }
        next.push(cols[q]);
      }
      cols = next;
      if(!added) break;
    }
    var NL = 62, NU = 30;
    function lowTop(th){ return Math.abs(th) <= M.ahDeepTheta ? M.ahDeepY : armLow(th); }
    function upBot(th){ return Math.abs(th) <= M.ahDeepTheta ? M.ahDeepY : armHigh(th); }
    function put(th, y){ return m.vert(bodyPoint(back, th, y), flat.u(th, y), flat.v(th, y)); }
    var GL = [], GU = [], r, c;
    for(r = 0; r < NL; r++){ GL.push([]); for(c = 0; c < cols.length; c++) GL[r].push(put(cols[c], lowTop(cols[c]) * r / (NL - 1))); }
    var B0 = cols.map(upBot), T0 = cols.map(function(t){ return topY(t, back); });
    for(r = 0; r < NU; r++){ GU.push([]); for(c = 0; c < cols.length; c++) GU[r].push(put(cols[c], B0[c] + (T0[c] - B0[c]) * r / (NU - 1))); }
    /* the shoulder seams in the flat pattern: the flattening tables are noisy right where the cloth
       turns over the crest (a few mm of zig-zag), so the top rows are smoothed along each seam,
       its ends (neck point, shoulder point) held */
    var cNr = -1, cNl = -1;
    cols.forEach(function(t, k){ if(Math.abs(t - thNeck) < 1e-9) cNr = k; if(Math.abs(t + thNeck) < 1e-9) cNl = k; });
    function smoothSeam(row, from, to, passes){
      for(var it = 0; it < passes; it++){
        var P = m.pat, old = [];
        for(var c2 = from; c2 <= to; c2++){ var vi = row[c2]; old.push([P[vi * 2], P[vi * 2 + 1]]); }
        for(c2 = from + 1; c2 < to; c2++){
          var k2 = c2 - from, vj = row[c2];
          P[vj * 2] = (old[k2 - 1][0] + 2 * old[k2][0] + old[k2 + 1][0]) / 4;
          P[vj * 2 + 1] = (old[k2 - 1][1] + 2 * old[k2][1] + old[k2 + 1][1]) / 4;
        }
      }
    }
    if(cNr > 0 && cNl >= 0) [[NU - 1, 10], [NU - 2, 6], [NU - 3, 3], [NU - 4, 1]].forEach(function(rp){
      smoothSeam(GU[rp[0]], cNr, cols.length - 1, rp[1]);
      smoothSeam(GU[rp[0]], 0, cNl, rp[1]);
    });
    m.grid(GL, NL, cols.length, bodyOut);
    m.grid(GU, NU, cols.length, bodyOut);
    m.edges = { hem: GL[0].slice(), cols: cols, GL: GL, GU: GU };
    /* the cut line, walked once round: hem, side seam, armhole, shoulder, neck, shoulder, armhole, side seam */
    var C = cols.length, cA = -1, cB = -1, o = [];
    cols.forEach(function(t, k){ if(Math.abs(t + M.ahDeepTheta) < 1e-9) cA = k; if(Math.abs(t - M.ahDeepTheta) < 1e-9) cB = k; });
    for(c = 0; c < C; c++) o.push(GL[0][c]);
    for(r = 1; r < NL; r++) o.push(GL[r][C - 1]);
    for(c = C - 2; c >= cB; c--) o.push(GL[NL - 1][c]);
    for(c = cB + 1; c < C; c++) o.push(GU[0][c]);
    for(c = C - 1; c >= 0; c--) o.push(GU[NU - 1][c]);
    for(c = 1; c <= cA; c++) o.push(GU[0][c]);
    for(c = cA - 1; c >= 0; c--) o.push(GL[NL - 1][c]);
    for(r = NL - 2; r >= 1; r--) o.push(GL[r][0]);
    m.outlineIdx = o;
    m.flipU = back;          /* the back is read from behind: its pattern runs the other way */
    return m;
  }

  /* ---------- the armhole loop (shared by body and sleeve) ---------- */
  /* side +1 = +x. Front edge from the underarm up to the shoulder point, back edge the same way. */
  function armEdge(back, side, n){
    var pts = [], i;
    for(i = 0; i <= n; i++){                                       /* lower branch: 90° -> deepest */
      var t = i / n, th = (90 * D) - (90 * D - M.ahDeepTheta) * Math.sin(t * Math.PI / 2);
      pts.push(bodyPoint(back, side * (back ? -1 : 1) * th, armLow(th)));
    }
    for(i = 1; i <= n; i++){                                       /* upper branch: deepest -> 90° */
      var t2 = i / n, th2 = M.ahDeepTheta + (90 * D - M.ahDeepTheta) * (1 - Math.cos(t2 * Math.PI / 2));
      pts.push(bodyPoint(back, side * (back ? -1 : 1) * th2, armHigh(th2)));
    }
    return pts;
  }
  function resample(pts, n){
    var acc = [0], i;
    for(i = 1; i < pts.length; i++) acc.push(acc[i - 1] + len(sub(pts[i], pts[i - 1])));
    var total = acc[acc.length - 1], out = [], j = 1;
    for(i = 0; i <= n; i++){
      var s = total * i / n;
      while(j < acc.length - 1 && acc[j] < s) j++;
      var f = (s - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1);
      out.push(lerp3(pts[j - 1], pts[j], clamp(f, 0, 1)));
    }
    return out;
  }

  /* ---------- sleeve ---------- */
  function buildSleeve(side){
    var N = 112, H = N / 2, K = 44, m = new Mesh(), i, k;
    var front = resample(armEdge(false, side, 160), H), backE = resample(armEdge(true, side, 160), H);
    var loop = front.slice();                                      /* 0..H: underarm -> front -> shoulder point */
    for(i = H - 1; i >= 1; i--) loop.push(backE[i]);               /* H+1..N-1: down the back edge */
    var C = [0, 0, 0]; loop.forEach(function(p){ C = add(C, p); }); C = mul(C, 1 / loop.length);
    var dir = norm([side * Math.sin(M.armAngle), -Math.cos(M.armAngle), M.armForward]);
    var up = norm(sub([0, 1, 0], mul(dir, dir[1])));
    var fr = norm(cross(dir, up)); if(fr[2] < 0) fr = mul(fr, -1);
    var shoulderPt = loop[H], r = M.cuffR;
    var lo = 4, hi = 30;
    for(var it = 0; it < 40; it++){                                 /* cuff distance that gives the target top length */
      var mid = (lo + hi) / 2, top = add(add(C, mul(dir, mid)), mul(up, r));
      if(len(sub(top, shoulderPt)) < M.sleeveTop) lo = mid; else hi = mid;
    }
    var Cc = add(C, mul(dir, (lo + hi) / 2));
    var cuff = [];
    for(i = 0; i < N; i++){ var al = 2 * Math.PI * i / N; cuff.push(add(Cc, add(mul(up, -Math.cos(al) * r), mul(fr, Math.sin(al) * r)))); }
    var seamDir = norm([side * (M.shoulderHalf - M.neckHalf), -(M.TOP - M.SP), 0]);
    var rings = [];
    for(k = 0; k <= K; k++){
      var s = Math.pow(k / K, 1.15), h00 = 2*s*s*s - 3*s*s + 1, h10 = s*s*s - 2*s*s + s, h01 = -2*s*s*s + 3*s*s, h11 = s*s*s - s*s;
      var ring = [];
      for(i = 0; i < N; i++){
        var P0 = loop[i], P1 = cuff[i], L = len(sub(P1, P0)), al2 = 2 * Math.PI * i / N;
        var w = Math.pow(Math.max(0, -Math.cos(al2)), 2) * 0.7;
        var T0 = mul(norm(lerp3(dir, seamDir, w)), L * 1.05), T1 = mul(dir, L * 0.75);
        var Q = add(add(mul(P0, h00), mul(T0, h10)), add(mul(P1, h01), mul(T1, h11)));
        var under = Math.pow(Math.max(0, Math.cos(al2)), 3), bulge = Math.sin(Math.PI * s);
        var fold = bulge * (0.38 * under * Math.sin(al2 * 9 + s * 5) + 0.16 * Math.sin(al2 * 5 + s * 9 + side));
        var rad = sub(Q, add(C, mul(dir, dot(sub(Q, C), dir))));
        ring.push(add(Q, mul(norm(rad), fold)));
      }
      rings.push(ring);
    }
    /* pattern coordinates: u around (0 at the top of the sleeve), v along (0 at the cuff) */
    var G = [];
    for(k = 0; k <= K; k++){
      var ringK = rings[k], arc = [0];
      for(i = 1; i <= N; i++) arc.push(arc[i - 1] + len(sub(ringK[i % N], ringK[i - 1])));
      var mid2 = arc[H], row = [];
      for(i = 0; i <= N; i++){
        var vAlong = 0;
        for(var kk = k; kk < K; kk++) vAlong += len(sub(rings[kk][i % N], rings[kk + 1][i % N]));
        var u = (arc[i] - mid2) * (side > 0 ? 1 : -1);
        row.push(m.vert(ringK[i % N], u, vAlong));
      }
      G.push(row);
    }
    var axisOut = function(p){ var q = sub(p, C), t = dot(q, dir); return sub(q, mul(dir, t)); };
    m.grid(G, K + 1, N + 1, axisOut);
    m.edges = { loop: loop, cuff: rings[K], dir: dir, C: Cc };
    var o = [];
    for(i = 0; i <= N; i++) o.push(G[0][i]);
    for(k = 1; k <= K; k++) o.push(G[k][N]);
    for(i = N - 1; i >= 0; i--) o.push(G[K][i]);
    for(k = K - 1; k >= 1; k--) o.push(G[k][0]);
    m.outlineIdx = o;
    return m;
  }

  /* ---------- neck rib ---------- */
  function neckLoop(){
    var pts = [], n = 120, i, th;
    for(i = 0; i <= n; i++){ th = thNeck * i / n; pts.push(bodyPoint(true, th, topY(th, true))); }          /* CB -> -x neck point */
    for(i = 1; i <= 2 * n; i++){ th = -thNeck + 2 * thNeck * i / (2 * n); pts.push(bodyPoint(false, th, topY(th, false))); } /* across the front */
    for(i = 1; i <= n; i++){ th = -thNeck + thNeck * i / n; pts.push(bodyPoint(true, th, topY(th, true))); }  /* +x neck point -> CB */
    return pts;
  }
  function buildRib(){
    var raw = neckLoop(), N = 200, loop = resample(raw, N), m = new Mesh(), inner = new Mesh(), i;
    var zc = (bodyPoint(false, 0, M.neckFrontY)[2] + bodyPoint(true, 0, M.neckBackY)[2]) / 2;
    var arc = [0]; for(i = 1; i <= N; i++) arc.push(arc[i - 1] + len(sub(loop[i], loop[i - 1])));
    var total = arc[N], G = [[], []], GI = [[], [], [], []];
    for(i = 0; i <= N; i++){
      var p = loop[i], inw = norm([-p[0], 0, zc - p[2]]);
      var upd = norm(add([0, 1, 0], mul(inw, 0.42)));
      var top = add(p, mul(upd, M.ribH));
      G[0].push(m.vert(p, arc[i], 0));
      G[1].push(m.vert(top, arc[i], M.ribH));
      var foldTop = add(top, add(mul(inw, M.ribT), [0, -0.1, 0]));
      var foldBot = add(p, add(mul(inw, M.ribT), [0, 0.12, 0]));
      GI[0].push(inner.vert(top)); GI[1].push(inner.vert(foldTop)); GI[2].push(inner.vert(foldTop)); GI[3].push(inner.vert(foldBot));
    }
    var outFn = function(q){ return [q[0], 0.25, q[2] - zc]; };
    m.grid(G, 2, N + 1, outFn);
    m.outlineIdx = G[0].concat(G[1].slice().reverse());
    inner.grid([GI[0], GI[1]], 2, N + 1, function(){ return [0, 1, 0]; });
    inner.grid([GI[2], GI[3]], 2, N + 1, function(q){ return [-q[0], 0, zc - q[2]]; });
    m.ribLength = total;
    return { rib: m, inner: inner };
  }

  /* ---------- turned-up hem and cuffs (inside, plain fabric) ---------- */
  /* the rim faces out of the opening (opposite to upVec); the folded strip faces the inside */
  function turnUp(edge, inwardFn, upVec, outM){
    var R = [[], []], S = [[], []];
    edge.forEach(function(p){
      var inw = inwardFn(p);
      var a = add(p, mul(inw, M.hemT)), b = add(a, mul(upVec(p), M.hemTurn));
      R[0].push(outM.vert(p)); R[1].push(outM.vert(a));
      S[0].push(outM.vert(a)); S[1].push(outM.vert(b));
    });
    outM.grid(R, 2, edge.length, function(q){ return mul(upVec(q), -1); });
    outM.grid(S, 2, edge.length, function(q){ return inwardFn(q); });
  }

  /* ---------- pattern pieces: normalise to a top-left origin in cm ---------- */
  function finishPanel(id, label, m, flipU){
    var n = m.pat.length / 2, i, minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
    for(i = 0; i < n; i++){
      var u = m.pat[i * 2] * (flipU ? -1 : 1), v = m.pat[i * 2 + 1];
      if(u < minU) minU = u; if(u > maxU) maxU = u; if(v < minV) minV = v; if(v > maxV) maxV = v;
    }
    var W = maxU - minU, Hh = maxV - minV, cm = new Float32Array(n * 2), uv = new Float32Array(n * 2);
    for(i = 0; i < n; i++){
      var X = m.pat[i * 2] * (flipU ? -1 : 1) - minU, Y = maxV - m.pat[i * 2 + 1];
      cm[i * 2] = X; cm[i * 2 + 1] = Y;
      uv[i * 2] = X / W; uv[i * 2 + 1] = 1 - Y / Hh;
    }
    return { id: id, label: label, w_cm: Math.round(W * 10) / 10, h_cm: Math.round(Hh * 10) / 10, W: W, H: Hh,
             pos: new Float32Array(m.pos), uv: uv, cm: cm, idx: m.idx, outline: outlineFrom(cm, m.outlineIdx) };
  }
  /* the cut line in cm, without repeated points (the shoulder point is a collapsed column) */
  function outlineFrom(cm, list){
    var out = [];
    list.forEach(function(i){
      var q = [Math.round(cm[i * 2] * 100) / 100, Math.round(cm[i * 2 + 1] * 100) / 100], last = out[out.length - 1];
      if(!last || Math.abs(last[0] - q[0]) > 0.02 || Math.abs(last[1] - q[1]) > 0.02) out.push(q);
    });
    return out;
  }
  var built = null;
  function build(){
    if(built) return built;
    var front = buildBody(false), back = buildBody(true);
    var sr = buildSleeve(1), sl = buildSleeve(-1), rb = buildRib();
    var inside = new Mesh();
    var bodyIn = function(p){ return norm([-p[0], 0, -p[2]]); };
    turnUp(front.edges.hem.map(function(i){ return [front.pos[i*3], front.pos[i*3+1], front.pos[i*3+2]]; }), bodyIn, function(){ return [0, 1, 0]; }, inside);
    turnUp(back.edges.hem.map(function(i){ return [back.pos[i*3], back.pos[i*3+1], back.pos[i*3+2]]; }), bodyIn, function(){ return [0, 1, 0]; }, inside);
    [sr, sl].forEach(function(s){
      var ax = s.edges.dir, C = s.edges.C;
      turnUp(s.edges.cuff.concat([s.edges.cuff[0]]), function(p){ var q = sub(p, C); return norm(mul(sub(q, mul(ax, dot(q, ax))), -1)); },
             function(){ return mul(ax, -1); }, inside);
    });
    built = {
      panels: [
        finishPanel('front', 'Front', front, false),
        finishPanel('back', 'Back', back, false),
        finishPanel('sleeve_r', 'Right sleeve', sr, false),
        finishPanel('sleeve_l', 'Left sleeve', sl, false),
        finishPanel('collar', 'Neck rib', rb.rib, false)
      ],
      inside: { pos: new Float32Array(inside.pos.concat(rb.inner.pos)), idx: inside.idx.concat(rb.inner.idx.map(function(i){ return i + inside.pos.length / 3; })) },
      dims: M
    };
    return built;
  }
  /* the tee's panels for the editor: real pattern pieces with their cut outlines */
  function panels(){
    return build().panels.map(function(p){ return { id: p.id, label: p.label, w_cm: p.w_cm, h_cm: p.h_cm, outline: p.outline, pattern: true }; });
  }
  return { build: build, panels: panels, dims: M, bodyPoint: bodyPoint, topY: topY };
})();
