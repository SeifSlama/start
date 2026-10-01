/* ============================================================
   SEIF STUDIO v4 — vector garment placeholders (shown until a photo is uploaded)
   Each product: outline (union path for fill/clip/shading),
   paint (flat colors), folds (crease spines). Print areas live in r_panels.js.
   Design space 1600x1600, cx = 800.
   ============================================================ */

function FIT(pts, f){
  return pts.map(function(p){
    var q = [CX + (p[0]-CX)*f.w, p[1]*f.l];
    if(p[2]) q[2] = p[2];
    return q;
  });
}
function mir(right){
  var out = right.slice();
  for(var i = right.length-2; i >= 1; i--){
    var p = right[i];
    out.push(p[2] ? [2*CX-p[0], p[1], p[2]] : [2*CX-p[0], p[1]]);
  }
  return out;
}
function blobSub(ctx, pts){
  var n = pts.length;
  function P(i){ return pts[(i+n)%n]; }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for(var i=0;i<n;i++){
    var p0=P(i-1), p1=P(i), p2=P(i+1), p3=P(i+2);
    var c1 = p1[2]==='c' ? p1 : [p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6];
    var c2 = p2[2]==='c' ? p2 : [p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    ctx.bezierCurveTo(c1[0],c1[1], c2[0],c2[1], p2[0],p2[1]);
  }
  ctx.closePath();
}
function blob(ctx, pts){ ctx.beginPath(); blobSub(ctx, pts); }
function xform(pts, dx, dy, rot){
  var cr = Math.cos(rot), sr = Math.sin(rot);
  return pts.map(function(p){
    var q = [p[0]*cr - p[1]*sr + dx, p[0]*sr + p[1]*cr + dy];
    if(p[2]) q[2] = p[2];
    return q;
  });
}
function fillBlob(ctx, pts, color){ blob(ctx, pts); ctx.fillStyle = color; ctx.fill(); }
function strokeBlob(ctx, pts, color, w){ blob(ctx, pts); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
function line(ctx, pts, color, w, cap){
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for(var i=1;i<pts.length;i++){
    var prev = pts[i-1];
    ctx.quadraticCurveTo(prev[0], prev[1], (prev[0]+pts[i][0])/2, (prev[1]+pts[i][1])/2);
  }
  var l = pts[pts.length-1];
  ctx.lineTo(l[0], l[1]);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = cap || 'round';
  ctx.stroke();
}
function ribs(ctx, cx, cy, w, h, n, color, rot){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot || 0);
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.globalAlpha = 0.45;
  for(var i=0;i<n;i++){
    var x = -w/2 + (i+0.5)*(w/n);
    ctx.beginPath(); ctx.moveTo(x, -h/2+6); ctx.lineTo(x, h/2-6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
function dot(ctx, x, y, r, color){
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();
}
function ell(ctx, x, y, rx, ry, color, lw){
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2);
  if(lw){ ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
  else { ctx.fillStyle = color; ctx.fill(); }
}

/* ---------------- shared tops geometry ---------------- */
var TEE_BODY = [
  [895,248],[1042,282],[1150,352],[1218,405,'c'],[1200,470],[1150,540,'c'],
  [1088,562],[1055,505],[1042,900],[1040,1310,'c'],[800,1325]
];
function teeOutline(ctx, f){ blob(ctx, FIT(mir(TEE_BODY), f)); }
function teeCollar(ctx, C, f, backView){
  var cx = CX, cy = 258*f.l, rx = 118*f.w, ry = backView ? 30*f.l : 55*f.l;
  if(!backView){
    ctx.beginPath(); ctx.ellipse(cx, cy+6, rx*0.86, ry*0.88, 0, 0, Math.PI*2);
    ctx.fillStyle = C.inner; ctx.fill();
  }
  /* ribbed collar band: thin, dark, high-contrast — not a wide glow */
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
  ctx.strokeStyle = C.dark; ctx.lineWidth = backView ? 6 : 8; ctx.stroke();
  /* subtle catch-light just outside the band */
  ctx.beginPath(); ctx.ellipse(cx, cy - (backView?1:2), rx + (backView?3:4), ry + (backView?3:4), 0, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.6; ctx.stroke();
}
function teeFolds(f){
  function m(p){ return [2*CX-p[0], p[1]]; }
  var a = [[1085,600],[1010,700],[985,830]];
  var s = [[940,1090],[952,1230],[938,1330]];
  var sl = [[1112,400],[1168,455],[1185,515]];
  return [
    { pts: FIT(a, f), w:26, a:0.14 }, { pts: FIT(a.map(m), f), w:26, a:0.14 },
    { pts: FIT(s, f), w:22, a:0.10 }, { pts: FIT(s.map(m), f), w:22, a:0.10 },
    { pts: FIT([[790,1160],[798,1330]], f), w:18, a:0.07 },
    { pts: FIT([[700,520],[800,542],[900,520]], f), w:30, a:0.05 },
    { pts: FIT(sl, f), w:20, a:0.11 }, { pts: FIT(sl.map(m), f), w:20, a:0.11 }
  ];
}

var PRODUCTS = [];

/* 1 — TEE */
PRODUCTS.push({
  id:'tee', sku:'SS-01', name:'T-Shirt', cat:'Tops', spec:'240 GSM RINGSPUN \u00B7 DROP SHOULDER',
  views: {
    front: {
      outline: teeOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(TEE_BODY), f), C.base);
        teeCollar(ctx, C, f, false);
        line(ctx, FIT([[1108,455],[1195,420]], f), C.shade, 6);
        line(ctx, FIT([[492,420],[579,455]], f), C.shade, 6);
        line(ctx, FIT([[560,1300],[1040,1300]], f), C.shade, 6);
      },
      folds: teeFolds
    },
    back: {
      outline: teeOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(TEE_BODY), f), C.base);
        teeCollar(ctx, C, f, true);
        line(ctx, FIT([[560,1300],[1040,1300]], f), C.shade, 6);
      },
      folds: teeFolds
    }
  }
});

/* 2 — LONG SLEEVE */
var LS_BODY = [
  [905,252],[1058,298],[1180,378],[1238,700],[1218,938,'c'],[1092,950,'c'],
  [1058,690],[1035,565],[1042,980],[1046,1288,'c'],[800,1302]
];
function lsOutline(ctx, f){ blob(ctx, FIT(mir(LS_BODY), f)); }
function lsFolds(f){
  function m(p){ return [2*CX-p[0], p[1]]; }
  var a = [[1040,590],[985,700],[968,830]];
  var sl = [[1120,430],[1165,600],[1180,780]];
  return [
    { pts: FIT(a, f), w:24, a:0.13 }, { pts: FIT(a.map(m), f), w:24, a:0.13 },
    { pts: FIT(sl, f), w:18, a:0.11 }, { pts: FIT(sl.map(m), f), w:18, a:0.11 },
    { pts: FIT([[900,1080],[912,1240]], f), w:20, a:0.08 },
    { pts: FIT([[700,1080],[688,1240]], f), w:20, a:0.08 },
    { pts: FIT([[700,520],[800,540],[900,520]], f), w:30, a:0.05 }
  ];
}
function lsPaintCommon(ctx, C, f, backView){
  fillBlob(ctx, FIT(mir(LS_BODY), f), C.base);
  teeCollar(ctx, C, f, backView);
  ctx.save(); lsOutline(ctx, f); ctx.clip();
  /* rib cuffs */
  [[1155,948,0.12],[445,948,-0.12]].forEach(function(c){
    ctx.save(); ctx.translate(CX + (c[0]-CX)*f.w, c[1]*f.l); ctx.rotate(c[2]);
    ctx.fillStyle = C.shade;
    ctx.beginPath();
    var r = 12;
    ctx.roundRect ? ctx.roundRect(-72,-34,144,68,r) : ctx.rect(-72,-34,144,68);
    ctx.fill();
    ctx.restore();
    ribs(ctx, CX + (c[0]-CX)*f.w, c[1]*f.l, 132, 58, 9, C.dark, c[2]);
  });
  /* rib hem */
  ctx.fillStyle = C.shade;
  ctx.beginPath();
  var hw = 244*f.w;
  ctx.rect(CX-hw, 1248*f.l, hw*2, 56*f.l);
  ctx.fill();
  ribs(ctx, CX, 1276*f.l, hw*1.92, 46, 26, C.dark, 0);
  ctx.restore();
}
PRODUCTS.push({
  id:'longsleeve', sku:'SS-02', name:'Long Sleeve', cat:'Tops', spec:'220 GSM COTTON \u00B7 RIB CUFF',
  views: {
    front: { outline: lsOutline, paint: function(ctx,C,f){ lsPaintCommon(ctx,C,f,false); }, folds: lsFolds },
    back:  { outline: lsOutline, paint: function(ctx,C,f){ lsPaintCommon(ctx,C,f,true); }, folds: lsFolds }
  }
});

/* 3 — HOODIE */
var HD_BODY = [
  [930,268],[1105,318],[1250,405],[1300,720],[1278,952,'c'],[1148,964,'c'],
  [1112,705],[1085,585],[1092,1000],[1088,1295,'c'],[800,1312]
];
var HD_HOOD_F = mir([[800,182],[955,200],[1030,292],[1000,398],[800,436]]);
var HD_HOOD_B = mir([[800,168],[975,192],[1058,300],[1022,430],[800,470]]);
function hdOutlineF(ctx, f){ ctx.beginPath(); blobSub(ctx, FIT(HD_HOOD_F, f)); blobSub(ctx, FIT(mir(HD_BODY), f)); }
function hdOutlineB(ctx, f){ ctx.beginPath(); blobSub(ctx, FIT(HD_HOOD_B, f)); blobSub(ctx, FIT(mir(HD_BODY), f)); }
function hdFolds(f){
  function m(p){ return [2*CX-p[0], p[1]]; }
  var a = [[1090,610],[1030,720],[1012,860]];
  var sl = [[1180,450],[1225,620],[1242,800]];
  return [
    { pts: FIT(a, f), w:26, a:0.13 }, { pts: FIT(a.map(m), f), w:26, a:0.13 },
    { pts: FIT(sl, f), w:20, a:0.11 }, { pts: FIT(sl.map(m), f), w:20, a:0.11 },
    { pts: FIT([[690,470],[800,494],[910,470]], f), w:28, a:0.07 }
  ];
}
PRODUCTS.push({
  id:'hoodie', sku:'SS-03', name:'Hoodie', cat:'Tops', spec:'350 GSM BRUSHED FLEECE',
  views: {
    front: {
      outline: hdOutlineF,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(HD_HOOD_F, f), C.base);
        fillBlob(ctx, FIT(mir(HD_BODY), f), C.base);
        /* hood opening */
        ctx.beginPath();
        ctx.ellipse(CX, 330*f.l, 128*f.w, 88*f.l, 0, 0, Math.PI*2);
        ctx.fillStyle = C.dark; ctx.fill();
        ell(ctx, CX, 330*f.l, 128*f.w, 88*f.l, C.dark, 7);
        ell(ctx, CX, 328*f.l, 133*f.w, 92*f.l, 'rgba(255,255,255,0.16)', 1.6);
        /* drawstrings */
        line(ctx, FIT([[758,408],[748,520],[752,608]], f), C.accent, 11);
        line(ctx, FIT([[842,408],[852,520],[848,608]], f), C.accent, 11);
        dot(ctx, CX+(752-CX)*f.w, 614*f.l, 9, C.accent);
        dot(ctx, CX+(848-CX)*f.w, 614*f.l, 9, C.accent);
        /* kangaroo pocket */
        var pk = FIT([[640,962],[960,962],[992,1092,'c'],[978,1188,'c'],[622,1188,'c'],[608,1092,'c']], f);
        fillBlob(ctx, pk, C.base);
        strokeBlob(ctx, pk, C.shade, 9);
        line(ctx, FIT([[640,962],[672,1080]], f), C.shade, 8);
        line(ctx, FIT([[960,962],[928,1080]], f), C.shade, 8);
        /* rib cuffs + hem */
        ctx.save(); hdOutlineF(ctx, f); ctx.clip();
        [[1212,958,0.1],[388,958,-0.1]].forEach(function(c){
          ctx.save(); ctx.translate(CX+(c[0]-CX)*f.w, c[1]*f.l); ctx.rotate(c[2]);
          ctx.fillStyle = C.shade;
          ctx.beginPath(); ctx.rect(-76,-36,152,72); ctx.fill();
          ctx.restore();
          ribs(ctx, CX+(c[0]-CX)*f.w, c[1]*f.l, 140, 62, 9, C.dark, c[2]);
        });
        ctx.fillStyle = C.shade;
        ctx.beginPath(); ctx.rect(CX-286*f.w, 1252*f.l, 572*f.w, 62*f.l); ctx.fill();
        ribs(ctx, CX, 1282*f.l, 552*f.w, 50, 30, C.dark, 0);
        ctx.restore();
      },
      folds: hdFolds
    },
    back: {
      outline: hdOutlineB,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(HD_HOOD_B, f), C.base);
        strokeBlob(ctx, FIT(HD_HOOD_B, f), C.shade, 7);
        fillBlob(ctx, FIT(mir(HD_BODY), f), C.base);
        ctx.save(); hdOutlineB(ctx, f); ctx.clip();
        [[1212,958,0.1],[388,958,-0.1]].forEach(function(c){
          ctx.save(); ctx.translate(CX+(c[0]-CX)*f.w, c[1]*f.l); ctx.rotate(c[2]);
          ctx.fillStyle = C.shade;
          ctx.beginPath(); ctx.rect(-76,-36,152,72); ctx.fill();
          ctx.restore();
          ribs(ctx, CX+(c[0]-CX)*f.w, c[1]*f.l, 140, 62, 9, C.dark, c[2]);
        });
        ctx.fillStyle = C.shade;
        ctx.beginPath(); ctx.rect(CX-286*f.w, 1252*f.l, 572*f.w, 62*f.l); ctx.fill();
        ribs(ctx, CX, 1282*f.l, 552*f.w, 50, 30, C.dark, 0);
        ctx.restore();
      },
      folds: hdFolds
    }
  }
});

/* 4 — POLO */
var PL_BODY = [
  [895,258],[1042,300],[1195,415],[1240,620,'c'],[1092,668,'c'],[1030,565],
  [1032,980],[1028,1302,'c'],[800,1315]
];
function plOutline(ctx, f){ blob(ctx, FIT(mir(PL_BODY), f)); }
PRODUCTS.push({
  id:'polo', sku:'SS-04', name:'Polo', cat:'Tops', spec:'210 GSM PIQUE KNIT',
  views: {
    front: {
      outline: plOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(PL_BODY), f), C.base);
        /* placket */
        var pl = FIT([[766,320],[834,320],[834,540,'c'],[766,540,'c']], f);
        fillBlob(ctx, pl, C.base);
        strokeBlob(ctx, pl, C.shade, 7);
        dot(ctx, CX, 392*f.l, 13, C.fixed);
        ctx.lineWidth = 3; ctx.strokeStyle = C.dark;
        ctx.beginPath(); ctx.arc(CX, 392*f.l, 13, 0, Math.PI*2); ctx.stroke();
        dot(ctx, CX, 472*f.l, 13, C.fixed);
        ctx.beginPath(); ctx.arc(CX, 472*f.l, 13, 0, Math.PI*2); ctx.stroke();
        /* collar wings */
        var wr = FIT([[800,262],[908,246],[952,306],[856,362],[800,326]], f);
        fillBlob(ctx, wr, C.base); strokeBlob(ctx, wr, C.shade, 7);
        var wl = FIT([[800,262],[692,246],[648,306],[744,362],[800,326]], f);
        fillBlob(ctx, wl, C.base); strokeBlob(ctx, wl, C.shade, 7);
        /* sleeve rib bands */
        ctx.save(); plOutline(ctx, f); ctx.clip();
        [[1160,640,0.32],[440,640,-0.32]].forEach(function(c){
          ctx.save(); ctx.translate(CX+(c[0]-CX)*f.w, c[1]*f.l); ctx.rotate(c[2]);
          ctx.fillStyle = C.shade;
          ctx.beginPath(); ctx.rect(-78,-22,156,44); ctx.fill();
          ctx.restore();
        });
        line(ctx, FIT([[588,1292],[1012,1292]], f), C.shade, 6);
        ctx.restore();
      },
      folds: function(f){
        function m(p){ return [2*CX-p[0], p[1]]; }
        var a = [[1030,590],[975,690],[958,810]];
        return [
          { pts: FIT(a, f), w:22, a:0.12 }, { pts: FIT(a.map(m), f), w:22, a:0.12 },
          { pts: FIT([[905,1080],[915,1240]], f), w:18, a:0.08 },
          { pts: FIT([[695,1080],[685,1240]], f), w:18, a:0.08 }
        ];
      }
    },
    back: {
      outline: plOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(PL_BODY), f), C.base);
        ell(ctx, CX, 268*f.l, 96*f.w, 26*f.l, C.dark, 6);
        line(ctx, FIT([[588,1292],[1012,1292]], f), C.shade, 6);
      },
      folds: function(f){
        function m(p){ return [2*CX-p[0], p[1]]; }
        var a = [[1030,590],[975,690],[958,810]];
        return [
          { pts: FIT(a, f), w:22, a:0.12 }, { pts: FIT(a.map(m), f), w:22, a:0.12 }
        ];
      }
    }
  }
});

/* 5 — TANK */
var TK_BODY = [
  [800,408],[858,374],[890,300],[902,252],[946,258],[976,330],[934,452],[1006,572],
  [1028,980],[1020,1298,'c'],[800,1312]
];
function tkOutline(ctx, f){ blob(ctx, FIT(mir(TK_BODY), f)); }
PRODUCTS.push({
  id:'tank', sku:'SS-05', name:'Tank Top', cat:'Tops', spec:'160 GSM JERSEY',
  views: {
    front: {
      outline: tkOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(TK_BODY), f), C.base);
        /* binding on neck + straps */
        ctx.save(); tkOutline(ctx, f); ctx.clip();
        line(ctx, FIT([[726,340],[800,398],[874,340]], f), C.shade, 12);
        line(ctx, FIT([[940,448],[972,340]], f), C.shade, 10);
        line(ctx, FIT([[660,448],[628,340]], f), C.shade, 10);
        line(ctx, FIT([[588,1290],[1012,1290]], f), C.shade, 6);
        ctx.restore();
      },
      folds: function(f){
        function m(p){ return [2*CX-p[0], p[1]]; }
        var a = [[1000,610],[955,710],[940,830]];
        return [
          { pts: FIT(a, f), w:22, a:0.12 }, { pts: FIT(a.map(m), f), w:22, a:0.12 },
          { pts: FIT([[800,560],[800,700]], f), w:26, a:0.05 },
          { pts: FIT([[905,1080],[915,1245]], f), w:18, a:0.08 },
          { pts: FIT([[695,1080],[685,1245]], f), w:18, a:0.08 }
        ];
      }
    },
    back: {
      outline: tkOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(TK_BODY), f), C.base);
        ctx.save(); tkOutline(ctx, f); ctx.clip();
        line(ctx, FIT([[712,408],[800,432],[888,408]], f), C.shade, 12);
        line(ctx, FIT([[588,1290],[1012,1290]], f), C.shade, 6);
        ctx.restore();
      },
      folds: function(f){
        return [ { pts: FIT([[800,560],[800,760]], f), w:26, a:0.05 } ];
      }
    }
  }
});

/* 6/7 — JOGGERS + SHORTS */
function pantsOutline(body){
  return function(ctx, f){ blob(ctx, FIT(mir(body), f)); };
}
var JG_BODY = [
  [800,242,'c'],[1014,246,'c'],[1062,435],[1030,800],[992,1150],[960,1358,'c'],[846,1366,'c'],
  [868,1058],[810,690]
];
var SH_BODY = [
  [800,242,'c'],[1016,246,'c'],[1075,450],[1090,700],[1085,912,'c'],[848,918,'c'],
  [822,700]
];
function waistband(ctx, C, f, drawcord, outlineFn){
  if(outlineFn){ ctx.save(); outlineFn(ctx, f); ctx.clip(); }
  ctx.fillStyle = C.shade;
  var hw = 218*f.w;
  ctx.beginPath(); ctx.rect(CX-hw, 240*f.l, hw*2, 74*f.l); ctx.fill();
  ribs(ctx, CX, 277*f.l, hw*1.9, 60, 22, C.dark, 0);
  if(drawcord){
    line(ctx, FIT([[762,312],[752,392],[758,452]], f), C.accent, 9);
    line(ctx, FIT([[838,312],[848,392],[842,452]], f), C.accent, 9);
    dot(ctx, CX+(758-CX)*f.w, 458*f.l, 8, C.accent);
    dot(ctx, CX+(842-CX)*f.w, 458*f.l, 8, C.accent);
  }
  if(outlineFn){ ctx.restore(); }
}
PRODUCTS.push({
  id:'joggers', sku:'SS-06', name:'Joggers', cat:'Bottoms', spec:'FRENCH TERRY \u00B7 ELASTIC WAIST',
  views: {
    front: {
      outline: pantsOutline(JG_BODY),
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(JG_BODY), f), C.base);
        waistband(ctx, C, f, true, pantsOutline(JG_BODY));
        ctx.save(); pantsOutline(JG_BODY)(ctx, f); ctx.clip();
        [[901,1326],[699,1326]].forEach(function(c){
          ctx.fillStyle = C.shade;
          ctx.save(); ctx.translate(CX+(c[0]-CX)*f.w, c[1]*f.l);
          ctx.beginPath(); ctx.rect(-60,-28,120,56); ctx.fill();
          ctx.restore();
          ribs(ctx, CX+(c[0]-CX)*f.w, c[1]*f.l, 108, 46, 8, C.dark, 0);
        });
        line(ctx, FIT([[800,330],[800,660]], f), C.shade, 6);
        ctx.restore();
      },
      folds: function(f){
        function m(p){ return [2*CX-p[0], p[1]]; }
        var hip = [[1040,470],[985,570],[955,660]];
        var knee = [[928,940],[950,1010],[928,1080]];
        return [
          { pts: FIT(hip, f), w:24, a:0.12 }, { pts: FIT(hip.map(m), f), w:24, a:0.12 },
          { pts: FIT(knee, f), w:18, a:0.10 }, { pts: FIT(knee.map(m), f), w:18, a:0.10 },
          { pts: FIT([[880,700],[905,900]], f), w:20, a:0.08 },
          { pts: FIT([[720,700],[695,900]], f), w:20, a:0.08 }
        ];
      }
    }
  }
});
PRODUCTS.push({
  id:'shorts', sku:'SS-07', name:'Shorts', cat:'Bottoms', spec:'FRENCH TERRY \u00B7 7\u2033 INSEAM',
  views: {
    front: {
      outline: pantsOutline(SH_BODY),
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir(SH_BODY), f), C.base);
        waistband(ctx, C, f, true, pantsOutline(SH_BODY));
        line(ctx, FIT([[800,330],[800,640]], f), C.shade, 6);
        line(ctx, FIT([[852,905],[1082,898]], f), C.shade, 8);
        line(ctx, FIT([[518,898],[748,905]], f), C.shade, 8);
      },
      folds: function(f){
        function m(p){ return [2*CX-p[0], p[1]]; }
        var hip = [[1050,480],[1000,580],[975,680]];
        return [
          { pts: FIT(hip, f), w:24, a:0.12 }, { pts: FIT(hip.map(m), f), w:24, a:0.12 },
          { pts: FIT([[870,700],[885,850]], f), w:18, a:0.09 },
          { pts: FIT([[730,700],[715,850]], f), w:18, a:0.09 }
        ];
      }
    }
  }
});

/* 8 — CAP */
var CAP_CROWN = mir([[800,432],[992,472],[1082,596],[1104,742],[1090,832,'c'],[800,850]]);
var CAP_BRIM = [[560,838],[800,796],[1040,838],[1058,900],[800,962],[542,900]];
function capOutline(ctx, f){
  ctx.beginPath();
  blobSub(ctx, FIT(CAP_CROWN, f));
  blobSub(ctx, FIT(CAP_BRIM, f));
}
PRODUCTS.push({
  id:'cap', sku:'SS-08', name:'Cap', cat:'Hats', spec:'6-PANEL \u00B7 CURVED BRIM',
  views: {
    front: {
      outline: capOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(CAP_BRIM, f), C.shade);
        fillBlob(ctx, FIT(CAP_CROWN, f), C.base);
        dot(ctx, CX, 436*f.l, 17, C.accent);
        line(ctx, FIT([[800,438],[862,552],[886,830]], f), C.shade, 6);
        line(ctx, FIT([[800,438],[738,552],[714,830]], f), C.shade, 6);
      },
      folds: function(f){
        return [
          { pts: FIT([[690,560],[672,700],[688,820]], f), w:22, a:0.10 },
          { pts: FIT([[910,560],[928,700],[912,820]], f), w:22, a:0.10 }
        ];
      }
    }
  }
});

/* 9 — BEANIE */
var BN_DOME = mir([[800,362],[968,398],[1032,520],[1040,620],[800,640]]);
var BN_BAND = [[578,610],[800,592],[1022,610],[1040,742,'c'],[800,768],[560,742,'c']];
function bnOutline(ctx, f){
  ctx.beginPath();
  blobSub(ctx, FIT(BN_DOME, f));
  blobSub(ctx, FIT(BN_BAND, f));
}
PRODUCTS.push({
  id:'beanie', sku:'SS-09', name:'Beanie', cat:'Hats', spec:'RIBBED KNIT \u00B7 POM TOP',
  views: {
    front: {
      outline: bnOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(BN_DOME, f), C.base);
        fillBlob(ctx, FIT(BN_BAND, f), C.base);
        line(ctx, FIT([[578,614],[800,596],[1022,614]], f), C.shade, 8);
        ctx.save();
        blob(ctx, FIT(BN_BAND, f)); ctx.clip();
        ribs(ctx, CX, 682*f.l, 450*f.w, 150, 30, C.dark, 0);
        ctx.restore();
        ctx.save();
        blob(ctx, FIT(BN_DOME, f)); ctx.clip();
        ribs(ctx, CX, 500*f.l, 430*f.w, 260, 22, C.shade, 0);
        ctx.restore();
        dot(ctx, CX, 352*f.l, 55, C.accent);
      },
      folds: function(f){
        return [
          { pts: FIT([[700,430],[688,560]], f), w:20, a:0.08 },
          { pts: FIT([[900,430],[912,560]], f), w:20, a:0.08 }
        ];
      }
    }
  }
});

/* 10 — BUCKET */
var BK_CROWN = mir([[800,382],[952,412],[1015,510],[1022,592],[800,606]]);
var BK_BRIM = [[588,584],[800,566],[1012,584],[1108,712],[800,760],[492,712]];
function bkOutline(ctx, f){
  ctx.beginPath();
  blobSub(ctx, FIT(BK_CROWN, f));
  blobSub(ctx, FIT(BK_BRIM, f));
}
PRODUCTS.push({
  id:'bucket', sku:'SS-10', name:'Bucket Hat', cat:'Hats', spec:'COTTON TWILL \u00B7 WIDE BRIM',
  views: {
    front: {
      outline: bkOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(BK_BRIM, f), C.base);
        fillBlob(ctx, FIT(BK_CROWN, f), C.base);
        line(ctx, FIT([[588,588],[800,570],[1012,588]], f), C.shade, 7);
        ctx.save();
        blob(ctx, FIT(BK_BRIM, f)); ctx.clip();
        ctx.setLineDash([2,10]);
        line(ctx, FIT([[540,690],[800,650],[1060,690]], f), C.dark, 4);
        line(ctx, FIT([[510,718],[800,682],[1090,718]], f), C.dark, 4);
        ctx.setLineDash([]);
        ctx.restore();
      },
      folds: function(f){
        return [
          { pts: FIT([[705,430],[695,560]], f), w:18, a:0.09 },
          { pts: FIT([[895,430],[905,560]], f), w:18, a:0.09 }
        ];
      }
    }
  }
});

/* 11 — SOCKS */
var SOCK = [
  [-80,300],[80,300],[86,660],[100,860],[215,912],[302,938],[312,1022,'c'],[58,1046,'c'],
  [-62,988],[-86,740]
];
function sockPts(side, f){
  return FIT(xform(SOCK, side > 0 ? 985 : 615, 0, side*0.1).map(function(p){
    return side > 0 ? p : [2*(side>0?985:615)-p[0], p[1], p[2]];
  }), f);
}
function sockOutline(ctx, f){
  ctx.beginPath();
  blobSub(ctx, sockPts(1, f));
  blobSub(ctx, sockPts(-1, f));
}
PRODUCTS.push({
  id:'socks', sku:'SS-11', name:'Crew Socks', cat:'Socks', spec:'CREW CUT \u00B7 COMBED COTTON',
  views: {
    front: {
      outline: sockOutline,
      paint: function(ctx, C, f){
        [1,-1].forEach(function(s){
          var pts = sockPts(s, f);
          fillBlob(ctx, pts, C.base);
          ctx.save();
          blob(ctx, pts); ctx.clip();
          var cx0 = s > 0 ? 985 : 615;
          var cx = CX + (cx0-CX)*f.w;
          ctx.fillStyle = C.shade;
          ctx.save();
          ctx.translate(cx, 330*f.l); ctx.rotate(s*0.1);
          ctx.beginPath(); ctx.rect(-105,-40,210,80); ctx.fill();
          ctx.restore();
          ribs(ctx, cx, 330*f.l, 190, 66, 13, C.dark, s*0.1);
          ctx.save();
          ctx.translate(cx, 0); ctx.rotate(s*0.1);
          ctx.fillStyle = C.accent;
          ctx.beginPath(); ctx.rect(-100, 430, 200, 26); ctx.fill();
          ctx.beginPath(); ctx.rect(-100, 486, 200, 26); ctx.fill();
          ctx.restore();
          ctx.restore();
        });
        /* simpler accent toe/heel via arcs */
        [1,-1].forEach(function(s){
          var cx0 = s > 0 ? 985 : 615;
          var cx = CX + (cx0-CX)*f.w;
          ctx.save();
          blob(ctx, sockPts(s, f)); ctx.clip();
          ctx.fillStyle = C.accent;
          ctx.beginPath();
          ctx.ellipse(cx + s*268*f.w, 998*f.l, 76, 60, s*0.28, 0, Math.PI*2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx - s*58*f.w, 962*f.l, 55, 68, s*0.35, 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
        });
      },
      folds: function(f){
        return [
          { pts: FIT([[955,520],[948,700]], f), w:16, a:0.09 },
          { pts: FIT([[645,520],[652,700]], f), w:16, a:0.09 }
        ];
      }
    }
  }
});

/* 12 — TOTE */
var TOTE_BODY = [[585,545],[800,558],[1015,545],[1038,1320,'c'],[562,1320,'c']];
function toteOutline(ctx, f){ blob(ctx, FIT(TOTE_BODY, f)); }
function totePaint(ctx, C, f){
  fillBlob(ctx, FIT(TOTE_BODY, f), C.base);
  line(ctx, FIT([[640,548],[648,335],[700,300],[752,335],[758,551]], f), C.accent, 30);
  line(ctx, FIT([[842,551],[848,335],[900,300],[952,335],[960,548]], f), C.accent, 30);
  line(ctx, FIT([[598,590],[1002,590]], f), C.shade, 6);
}
function toteFolds(f){
  return [
    { pts: FIT([[655,700],[642,950],[655,1200]], f), w:22, a:0.10 },
    { pts: FIT([[945,700],[958,950],[945,1200]], f), w:22, a:0.10 },
    { pts: FIT([[770,640],[790,760]], f), w:18, a:0.07 },
    { pts: FIT([[600,1290],[1000,1290]], f), w:26, a:0.08 }
  ];
}
PRODUCTS.push({
  id:'tote', sku:'SS-12', name:'Tote Bag', cat:'Bags', spec:'12 OZ CANVAS \u00B7 WEB HANDLES',
  views: {
    front: { outline: toteOutline, paint: totePaint, folds: toteFolds },
    back:  { outline: toteOutline, paint: totePaint, folds: toteFolds }
  }
});

/* 13 — BACKPACK */
var BP_BODY = [[608,415],[800,392],[992,415],[1042,700],[1048,1140,'c'],[552,1140,'c'],[558,700]];
var BP_POCKET = [[648,772],[952,772],[978,1108,'c'],[622,1108,'c']];
function bpOutline(ctx, f){
  ctx.beginPath();
  blobSub(ctx, FIT(BP_BODY, f));
  blobSub(ctx, FIT(mir([[800,330],[878,344],[898,404],[800,418]]), f));
}
PRODUCTS.push({
  id:'backpack', sku:'SS-13', name:'Backpack', cat:'Bags', spec:'600D POLY \u00B7 PADDED BACK',
  views: {
    front: {
      outline: bpOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(mir([[800,330],[878,344],[898,404],[800,418]]), f), C.shade);
        fillBlob(ctx, FIT(BP_BODY, f), C.base);
        var pk = FIT(BP_POCKET, f);
        fillBlob(ctx, pk, C.base);
        strokeBlob(ctx, pk, C.shade, 9);
        /* zipper */
        ctx.setLineDash([12,9]);
        line(ctx, FIT([[600,706],[800,682],[1000,706]], f), C.dark, 7);
        ctx.setLineDash([]);
        dot(ctx, CX+(1000-CX)*f.w, 710*f.l, 9, C.accent);
        line(ctx, FIT([[1000,710],[1028,742]], f), C.accent, 7);
        /* side straps */
        [[1018,880],[582,880]].forEach(function(c){
          ctx.fillStyle = C.accent;
          ctx.beginPath();
          ctx.rect(CX+(c[0]-CX)*f.w-16, c[1]*f.l, 32, 78);
          ctx.fill();
        });
      },
      folds: function(f){
        return [
          { pts: FIT([[640,520],[628,660]], f), w:20, a:0.10 },
          { pts: FIT([[960,520],[972,660]], f), w:20, a:0.10 },
          { pts: FIT([[700,1125],[900,1125]], f), w:22, a:0.09 }
        ];
      }
    }
  }
});

/* 14 — TIE */
var TIE_KNOT = [[722,296,'c'],[878,296,'c'],[914,396],[800,458],[686,396]];
var TIE_BLADE = [[742,452],[858,452],[906,1148],[800,1302,'c'],[694,1148]];
function tieOutline(ctx, f){
  ctx.beginPath();
  blobSub(ctx, FIT(TIE_KNOT, f));
  blobSub(ctx, FIT(TIE_BLADE, f));
}
PRODUCTS.push({
  id:'tie', sku:'SS-14', name:'Tie', cat:'Accessories', spec:'WOVEN TWILL \u00B7 8 CM BLADE',
  views: {
    front: {
      outline: tieOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(TIE_BLADE, f), C.base);
        fillBlob(ctx, FIT(TIE_KNOT, f), C.base);
        line(ctx, FIT([[742,452],[858,452]], f), C.shade, 6);
      },
      folds: function(f){
        return [
          { pts: FIT([[800,470],[795,700],[802,1000]], f), w:24, a:0.06 },
          { pts: FIT([[760,340],[790,400]], f), w:14, a:0.12 },
          { pts: FIT([[840,340],[810,400]], f), w:14, a:0.12 }
        ];
      }
    }
  }
});

/* 15 — SCARF */
var SCARF_BODY = [
  [880,262],[898,520],[868,800],[892,1080],[880,1332,'c'],[720,1345,'c'],
  [708,1080],[732,800],[702,520],[720,262,'c']
];
function scarfOutline(ctx, f){ blob(ctx, FIT(SCARF_BODY, f)); }
PRODUCTS.push({
  id:'scarf', sku:'SS-15', name:'Scarf', cat:'Accessories', spec:'BRUSHED KNIT \u00B7 FRINGED',
  views: {
    front: {
      outline: scarfOutline,
      paint: function(ctx, C, f){
        fillBlob(ctx, FIT(SCARF_BODY, f), C.base);
        for(var i=0;i<7;i++){
          var x = 726 + i*24.5;
          line(ctx, FIT([[x,1338],[x-3,1398]], f), C.accent, 8);
        }
        line(ctx, FIT([[724,300],[876,300]], f), C.shade, 5);
      },
      folds: function(f){
        return [
          { pts: FIT([[712,540],[800,556],[890,540]], f), w:20, a:0.11 },
          { pts: FIT([[880,810],[800,826],[712,810]], f), w:20, a:0.11 },
          { pts: FIT([[712,1090],[800,1106],[888,1090]], f), w:20, a:0.11 }
        ];
      }
    }
  }
});

/* 16 — APRON */
var APRON_BODY = [
  [692,302,'c'],[908,302,'c'],[922,632],[985,672],[1058,700],[1042,1315,'c'],[558,1315,'c'],
  [542,700],[615,672],[678,632]
];
function apOutline(ctx, f){ blob(ctx, FIT(APRON_BODY, f)); }
PRODUCTS.push({
  id:'apron', sku:'SS-16', name:'Apron', cat:'Accessories', spec:'CANVAS \u00B7 ADJUSTABLE NECK',
  views: {
    front: {
      outline: apOutline,
      paint: function(ctx, C, f){
        line(ctx, FIT([[700,310],[800,208],[900,310]], f), C.accent, 24);
        fillBlob(ctx, FIT(APRON_BODY, f), C.base);
        line(ctx, FIT([[556,712],[430,790],[352,878]], f), C.accent, 20);
        line(ctx, FIT([[1044,712],[1170,790],[1248,878]], f), C.accent, 20);
        var pk = FIT([[642,952],[958,952],[968,1158,'c'],[632,1158,'c']], f);
        fillBlob(ctx, pk, C.base);
        strokeBlob(ctx, pk, C.shade, 8);
        line(ctx, FIT([[800,952],[800,1158]], f), C.shade, 6);
      },
      folds: function(f){
        return [
          { pts: FIT([[640,760],[628,1000],[640,1250]], f), w:22, a:0.09 },
          { pts: FIT([[960,760],[972,1000],[960,1250]], f), w:22, a:0.09 },
          { pts: FIT([[800,340],[800,600]], f), w:26, a:0.05 }
        ];
      }
    }
  }
});

var PRODUCTS_BY_ID = {};
PRODUCTS.forEach(function(p){ PRODUCTS_BY_ID[p.id] = p; });
