/* ============================================================
   SEIF STUDIO — panel model
   A garment is a set of flat PANELS: the rectangles a factory
   actually prints, each with a real size in cm. A PLACEMENT is
   where a panel lands inside one garment view (a quad in the
   1600x1600 design space). Panels exist whether or not a photo
   has been uploaded; a photo never destroys a print area.
   ============================================================ */

var PANEL_PX = 1200;   /* working resolution of an artboard's long edge */

/* A panel is a flat artboard the user designs on.
   w_cm / h_cm are the real printable size and drive export DPI. */
var PANEL_SETS = {
  tee: [
    { id:'front',    label:'Front',        w_cm:32, h_cm:42 },
    { id:'back',     label:'Back',         w_cm:32, h_cm:42 },
    { id:'sleeve_l', label:'Left sleeve',  w_cm:10, h_cm:9 },
    { id:'sleeve_r', label:'Right sleeve', w_cm:10, h_cm:9 }
  ],
  longsleeve: [
    { id:'front',    label:'Front',        w_cm:32, h_cm:42 },
    { id:'back',     label:'Back',         w_cm:32, h_cm:42 },
    { id:'sleeve_l', label:'Left sleeve',  w_cm:10, h_cm:9 },
    { id:'sleeve_r', label:'Right sleeve', w_cm:10, h_cm:9 }
  ],
  polo: [
    { id:'front',    label:'Front',        w_cm:32, h_cm:42 },
    { id:'back',     label:'Back',         w_cm:32, h_cm:42 },
    { id:'sleeve_l', label:'Left sleeve',  w_cm:10, h_cm:9 },
    { id:'sleeve_r', label:'Right sleeve', w_cm:10, h_cm:9 }
  ],
  hoodie: [
    { id:'front',    label:'Front',        w_cm:30, h_cm:35 },
    { id:'back',     label:'Back',         w_cm:32, h_cm:42 },
    { id:'sleeve_l', label:'Left sleeve',  w_cm:10, h_cm:12 },
    { id:'sleeve_r', label:'Right sleeve', w_cm:10, h_cm:12 },
    { id:'hood',     label:'Hood',         w_cm:22, h_cm:14 }
  ],
  tank: [
    { id:'front', label:'Front', w_cm:26, h_cm:38 },
    { id:'back',  label:'Back',  w_cm:26, h_cm:38 }
  ],
  joggers: [
    { id:'leg_l', label:'Left leg',  w_cm:14, h_cm:18 },
    { id:'leg_r', label:'Right leg', w_cm:14, h_cm:18 },
    { id:'seat',  label:'Seat',      w_cm:20, h_cm:14 }
  ],
  shorts: [
    { id:'leg_l', label:'Left leg',  w_cm:14, h_cm:18 },
    { id:'leg_r', label:'Right leg', w_cm:14, h_cm:18 },
    { id:'seat',  label:'Seat',      w_cm:20, h_cm:14 }
  ],
  cap: [
    { id:'front',  label:'Front panel', w_cm:10, h_cm:6 },
    { id:'side_l', label:'Left side',   w_cm:7,  h_cm:5 },
    { id:'side_r', label:'Right side',  w_cm:7,  h_cm:5 },
    { id:'back',   label:'Back',        w_cm:10, h_cm:5 }
  ],
  beanie: [
    { id:'band',  label:'Fold band', w_cm:18, h_cm:6 },
    { id:'crown', label:'Crown',     w_cm:16, h_cm:10 }
  ],
  bucket: [
    { id:'crown', label:'Crown', w_cm:16, h_cm:10 },
    { id:'brim',  label:'Brim',  w_cm:30, h_cm:6 }
  ],
  socks: [
    { id:'outer', label:'Outer side', w_cm:8, h_cm:12 },
    { id:'inner', label:'Inner side', w_cm:8, h_cm:12 },
    { id:'cuff',  label:'Cuff',       w_cm:8, h_cm:5 }
  ],
  tote: [
    { id:'front', label:'Front', w_cm:30, h_cm:35 },
    { id:'back',  label:'Back',  w_cm:30, h_cm:35 }
  ],
  backpack: [
    { id:'pocket', label:'Front pocket', w_cm:22, h_cm:20 },
    { id:'face',   label:'Main face',    w_cm:26, h_cm:34 }
  ],
  tie:   [ { id:'blade', label:'Blade', w_cm:8,  h_cm:40 } ],
  scarf: [ { id:'face',  label:'Face',  w_cm:22, h_cm:140 } ],
  apron: [
    { id:'front',  label:'Front',  w_cm:40, h_cm:50 },
    { id:'bib',    label:'Bib',    w_cm:24, h_cm:18 },
    { id:'pocket', label:'Pocket', w_cm:26, h_cm:16 }
  ]
};

/* Where a panel lands inside a garment view.
   quad = 4 corners in the 1600x1600 design space, clockwise from top-left.
   Stored per product+view (shared storage for the catalog, personal for
   custom products) and editable by the admin. In-memory cache below. */
var PANEL_PLACEMENTS = {}; /* 'tee|front' -> [ {panel:'front', quad:[[x,y]x4]}, ... ] */

/* Built-in starting quads, derived from the outlines of the vector drawings
   in r_models.js. Rectangles here; the admin drags corners on a real photo. */
function rectQuad(x, y, w, h){ return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]; }
function mirrorQuad(q){
  /* x -> 1600 - x, then reverse the corner order so winding stays clockwise */
  var m = q.map(function(p){ return [DS - p[0], p[1]]; });
  return [m[1], m[0], m[3], m[2]];
}
var DEFAULT_PLACEMENTS = {
  /* tee: measured on the built-in turntable renders (assets/tee) */
  'tee|front': [
    { panel:'front',    quad:rectQuad(485,430,563,740) },
    { panel:'sleeve_r', quad:[[1160,420],[1330,470],[1300,630],[1130,585]] },
    { panel:'sleeve_l', quad:[[372,470],[542,420],[572,585],[402,630]] }
  ],
  'tee|back': [
    { panel:'back',     quad:rectQuad(485,380,563,740) },
    { panel:'sleeve_l', quad:[[1160,420],[1330,470],[1300,630],[1130,585]] },
    { panel:'sleeve_r', quad:[[372,470],[542,420],[572,585],[402,630]] }
  ],
  'tee|turn_030': [
    { panel:'front',    quad:[[585,440],[1090,470],[1075,1180],[600,1200]] },
    { panel:'sleeve_r', quad:[[1110,395],[1215,430],[1200,630],[1095,600]] },
    { panel:'sleeve_l', quad:[[300,450],[520,400],[540,690],[310,720]] }
  ],
  'tee|turn_060': [
    { panel:'front',    quad:[[560,450],[960,480],[950,1190],[575,1210]] },
    { panel:'sleeve_r', quad:[[930,430],[1160,470],[1150,720],[920,690]] },
    { panel:'sleeve_l', quad:[[445,470],[585,455],[580,715],[440,700]] }
  ],
  'tee|side_left':  [ { panel:'sleeve_l', quad:rectQuad(690,440,240,216) } ],
  'tee|turn_120': [
    { panel:'back',     quad:[[745,440],[1035,470],[1025,1200],[755,1220]] },
    { panel:'sleeve_l', quad:[[485,410],[715,440],[705,710],[475,690]] }
  ],
  'tee|turn_150': [
    { panel:'back',     quad:[[560,460],[1040,430],[1030,1180],[580,1210]] },
    { panel:'sleeve_l', quad:[[400,440],[560,400],[580,660],[410,690]] },
    { panel:'sleeve_r', quad:[[1080,420],[1200,450],[1190,650],[1070,620]] }
  ],
  'tee|side_right': [ { panel:'sleeve_r', quad:rectQuad(650,430,240,216) } ],
  'longsleeve|front': [
    { panel:'front',    quad:rectQuad(570,430,460,540) },
    { panel:'sleeve_r', quad:rectQuad(1098,480,118,320) },
    { panel:'sleeve_l', quad:mirrorQuad(rectQuad(1098,480,118,320)) }
  ],
  'longsleeve|back': [
    { panel:'back',     quad:rectQuad(570,400,460,580) },
    { panel:'sleeve_l', quad:rectQuad(1098,480,118,320) },
    { panel:'sleeve_r', quad:mirrorQuad(rectQuad(1098,480,118,320)) }
  ],
  'polo|front': [
    { panel:'front',    quad:rectQuad(560,430,480,560) },
    { panel:'sleeve_r', quad:rectQuad(1090,400,120,140) },
    { panel:'sleeve_l', quad:mirrorQuad(rectQuad(1090,400,120,140)) }
  ],
  'polo|back': [
    { panel:'back',     quad:rectQuad(580,400,440,580) },
    { panel:'sleeve_l', quad:rectQuad(1090,400,120,140) },
    { panel:'sleeve_r', quad:mirrorQuad(rectQuad(1090,400,120,140)) }
  ],
  'hoodie|front': [
    { panel:'front',    quad:rectQuad(600,486,400,430) },
    { panel:'sleeve_r', quad:rectQuad(1130,480,140,340) },
    { panel:'sleeve_l', quad:mirrorQuad(rectQuad(1130,480,140,340)) },
    { panel:'hood',     quad:rectQuad(660,215,280,180) }
  ],
  'hoodie|back': [
    { panel:'back',     quad:rectQuad(580,520,440,560) },
    { panel:'sleeve_l', quad:rectQuad(1130,480,140,340) },
    { panel:'sleeve_r', quad:mirrorQuad(rectQuad(1130,480,140,340)) },
    { panel:'hood',     quad:rectQuad(640,200,320,220) }
  ],
  'tank|front': [ { panel:'front', quad:rectQuad(590,500,420,520) } ],
  'tank|back':  [ { panel:'back',  quad:rectQuad(590,480,420,560) } ],
  'joggers|front': [
    { panel:'leg_r', quad:rectQuad(862,455,168,340) },
    { panel:'leg_l', quad:mirrorQuad(rectQuad(862,455,168,340)) }
  ],
  'joggers|back': [ { panel:'seat', quad:rectQuad(640,470,320,220) } ],
  'shorts|front': [
    { panel:'leg_r', quad:rectQuad(870,470,180,300) },
    { panel:'leg_l', quad:mirrorQuad(rectQuad(870,470,180,300)) }
  ],
  'shorts|back': [ { panel:'seat', quad:rectQuad(640,480,320,220) } ],
  'cap|front': [
    { panel:'front',  quad:rectQuad(672,520,256,240) },
    { panel:'side_r', quad:[[950,540],[1070,600],[1060,760],[950,740]] },
    { panel:'side_l', quad:[[530,600],[650,540],[650,740],[540,760]] }
  ],
  'cap|back': [ { panel:'back', quad:rectQuad(672,560,256,180) } ],
  'beanie|front': [
    { panel:'band',  quad:rectQuad(625,610,350,130) },
    { panel:'crown', quad:rectQuad(660,410,280,180) }
  ],
  'bucket|front': [
    { panel:'crown', quad:rectQuad(665,415,270,160) },
    { panel:'brim',  quad:rectQuad(560,600,480,110) }
  ],
  'socks|front': [
    { panel:'outer', quad:rectQuad(895,400,180,300) },
    { panel:'inner', quad:mirrorQuad(rectQuad(895,400,180,300)) },
    { panel:'cuff',  quad:rectQuad(895,300,180,90) }
  ],
  'tote|front': [ { panel:'front', quad:rectQuad(625,660,350,540) } ],
  'tote|back':  [ { panel:'back',  quad:rectQuad(625,660,350,540) } ],
  'backpack|front': [
    { panel:'pocket', quad:rectQuad(662,810,276,270) },
    { panel:'face',   quad:rectQuad(640,440,320,330) }
  ],
  'tie|front':   [ { panel:'blade', quad:rectQuad(715,520,170,560) } ],
  'scarf|front': [ { panel:'face',  quad:rectQuad(728,400,144,780) } ],
  'apron|front': [
    { panel:'front',  quad:rectQuad(600,690,400,240) },
    { panel:'bib',    quad:rectQuad(690,360,220,180) },
    { panel:'pocket', quad:rectQuad(660,970,280,170) }
  ]
};

function panelsFor(productId){
  if(PANEL_SETS[productId]) return PANEL_SETS[productId];
  var def = (typeof PRODUCTS_BY_ID !== 'undefined') ? PRODUCTS_BY_ID[productId] : null;
  if(def && def.panels) return def.panels;
  return [];
}
function panelById(productId, panelId){
  var list = panelsFor(productId);
  for(var i=0;i<list.length;i++){ if(list[i].id === panelId) return list[i]; }
  return null;
}
/* Artboard pixel size: w_cm x h_cm scaled so the long edge is PANEL_PX.
   The only place this conversion lives. */
function artboardSize(panel){
  var s = PANEL_PX / Math.max(panel.w_cm, panel.h_cm);
  return { w: Math.round(panel.w_cm * s), h: Math.round(panel.h_cm * s), pxPerCm: s };
}
/* A centred rectangle, used until an admin maps the panel properly. */
function defaultQuadFor(panel){
  var longEdge = 480;
  var s = longEdge / Math.max(panel.w_cm, panel.h_cm);
  var w = panel.w_cm * s, h = panel.h_cm * s;
  return rectQuad(CX - w/2, 760 - h/2, w, h);
}
function quadCopy(q){ return q.map(function(p){ return [p[0], p[1]]; }); }
function cloneQuadList(list){
  return list.map(function(pl){ return { panel: pl.panel, quad: quadCopy(pl.quad) }; });
}
function builtInPlacements(productId, view){
  var key = productId + '|' + view;
  if(DEFAULT_PLACEMENTS[key]) return cloneQuadList(DEFAULT_PLACEMENTS[key]);
  /* unknown product (custom): the panel whose id matches the view is centred, nothing else */
  var out = [];
  panelsFor(productId).forEach(function(p){
    if(p.id === view || (view === 'front' && p.id === 'front')) out.push({ panel: p.id, quad: defaultQuadFor(p) });
  });
  return out;
}

/* ---- storage: shared for the catalog, personal for custom_* products ---- */
var PLACE_PREFIX = 'seifstudio:placements:';
function placementKey(productId, view){ return PLACE_PREFIX + productId + ':' + view; }
function placementsFor(productId, view){
  var ck = productId + '|' + view;
  var v = PANEL_PLACEMENTS[ck];
  if(v === undefined){
    PANEL_PLACEMENTS[ck] = 'pending';
    store.get(placementKey(productId, view), photoShared(productId)).then(function(rec){
      PANEL_PLACEMENTS[ck] = (rec && rec.list && rec.list.length) ? sanitisePlacements(productId, rec.list) : builtInPlacements(productId, view);
      if(typeof onPlacementsResolved === 'function') onPlacementsResolved(productId, view);
    });
    return builtInPlacements(productId, view);
  }
  if(v === 'pending') return builtInPlacements(productId, view);
  return v;
}
/* drop placements for panels that no longer exist, coerce numbers */
function sanitisePlacements(productId, list){
  var ids = panelsFor(productId).map(function(p){ return p.id; });
  var out = [];
  list.forEach(function(pl){
    if(ids.indexOf(pl.panel) < 0 || !pl.quad || pl.quad.length !== 4) return;
    out.push({ panel: pl.panel, quad: pl.quad.map(function(p){ return [+p[0] || 0, +p[1] || 0]; }) });
  });
  return out;
}
async function savePlacements(productId, view, list){
  var clean = sanitisePlacements(productId, list);
  var r = await store.set(placementKey(productId, view), { list: clean }, photoShared(productId));
  PANEL_PLACEMENTS[productId + '|' + view] = clean;
  if(typeof onPlacementsResolved === 'function') onPlacementsResolved(productId, view);
  return r;
}
async function resetPlacements(productId, view){
  await store.del(placementKey(productId, view), photoShared(productId));
  PANEL_PLACEMENTS[productId + '|' + view] = builtInPlacements(productId, view);
  if(typeof onPlacementsResolved === 'function') onPlacementsResolved(productId, view);
}
/* Panels of a product that have a quad in the given view */
function placedPanelIds(productId, view){
  return placementsFor(productId, view).map(function(pl){ return pl.panel; });
}
/* geometry helpers used by the mapper, the admin quad editor and the debug overlay */
function quadCentre(q){
  return [ (q[0][0]+q[1][0]+q[2][0]+q[3][0])/4, (q[0][1]+q[1][1]+q[2][1]+q[3][1])/4 ];
}
function quadEdgeLen(a, b){ return Math.sqrt((a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1])); }
function quadBounds(q){
  var xs = q.map(function(p){ return p[0]; }), ys = q.map(function(p){ return p[1]; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  return { x:x0, y:y0, w:x1-x0, h:y1-y0 };
}
/* square a quad up: axis-aligned rectangle through its bounding box */
function snapQuadToRect(q){ var b = quadBounds(q); return rectQuad(b.x, b.y, b.w, b.h); }
/* bilinear point inside a quad, u/v in 0..1 */
function quadPoint(q, u, v){
  var top = [ q[0][0] + (q[1][0]-q[0][0])*u, q[0][1] + (q[1][1]-q[0][1])*u ];
  var bot = [ q[3][0] + (q[2][0]-q[3][0])*u, q[3][1] + (q[2][1]-q[3][1])*u ];
  return [ top[0] + (bot[0]-top[0])*v, top[1] + (bot[1]-top[1])*v ];
}
function pointInQuad(q, x, y){
  var inside = false;
  for(var i=0, j=3; i<4; j=i++){
    var xi = q[i][0], yi = q[i][1], xj = q[j][0], yj = q[j][1];
    if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
