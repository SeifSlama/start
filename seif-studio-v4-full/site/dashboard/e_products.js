/* ============================================================
   PRODUCTS — the catalogue, and one product with photos, options,
   variants, stock and colour photos.
   ============================================================ */
var SIZE_PRESET = ['S', 'M', 'L', 'XL', 'XXL'];
function isColorOpt(o){ return /colou?r|لون/i.test(o && o.name || ''); }
function stockText(p){
  if(!p.trackStock) return 'Not tracked';
  var n = p.variants.length ? p.variants.reduce(function(a, v){ return v.stock == null ? Infinity : a + v.stock; }, 0) : (p.stock == null ? Infinity : p.stock);
  return n === Infinity ? 'In stock' : n <= 0 ? 'Sold out' : n + ' in stock';
}
function soldOut(p){ return p.trackStock && (p.variants.length ? p.variants.every(function(v){ return v.stock != null && v.stock <= 0; }) : p.stock != null && p.stock <= 0); }
function priceText(p){
  var ps = p.variants.length ? p.variants.map(function(v){ return v.price != null ? +v.price : +p.price; }) : [+p.price];
  var lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
  return lo === hi ? money(lo) : money(lo) + '–' + Math.round(hi).toLocaleString('en-US');
}
VIEWS.products = async function(){
  loading();
  var products = await needProducts(true), f = 'all', term = '';
  function list(){
    var t = term.trim().toLowerCase();
    var rows = products.filter(function(p){
      if(f === 'active' && p.status !== 'active') return false; if(f === 'draft' && p.status !== 'draft') return false; if(f === 'out' && !soldOut(p)) return false;
      return !t || (p.title + ' ' + p.category + ' ' + p.tags).toLowerCase().indexOf(t) >= 0;
    });
    q('#pList').innerHTML = '<div class="pgrid"><button class="pcard add" data-go="/dashboard/products/new"><span><i>' + X.plus + '</i>Add product</span></button>' + rows.map(function(p){
      return '<a class="pcard" href="/dashboard/products/' + esc(p.pid) + '"><div class="im">' + (p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="" loading="lazy">' : X.image)
        + (p.status === 'draft' ? '<span class="badge b-draft">Draft</span>' : soldOut(p) ? '<span class="badge b-cancelled">Sold out</span>' : '') + '</div>'
        + '<div class="tx"><b>' + esc(p.title) + '</b><small><span>' + priceText(p) + '</span><span>' + esc(stockText(p)) + '</span></small></div></a>';
    }).join('') + '</div>';
  }
  $app.innerHTML = '<div class="view">' + storeBar() + head('Products', products.length ? plural(products.length, 'product', 'products') + ' in ' + esc(A.store.name) : 'What you sell — with photos, sizes, colours and stock.',
      '<a class="btn btn-ghost btn-sm" href="/design">' + DS.I.design + 'Design in 3D</a><button class="btn btn-primary btn-sm" data-go="/dashboard/products/new">' + X.plus + 'Add product</button>')
    + (products.length ? '<div class="filters" id="pF"><button data-f="all" class="on">All</button><button data-f="active">Active</button><button data-f="draft">Drafts</button><button data-f="out">Sold out</button></div>'
      + '<div class="toolbar"><input class="input" id="pQ" type="search" placeholder="Search products…"></div><div id="pList"></div>'
      : empty(X.tag, 'Your shelves are empty.', 'Add a product with photos — or design a T-shirt in 3D and send it here in one tap.', '<div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn btn-primary" data-go="/dashboard/products/new">' + X.plus + 'Add a product</button><a class="btn btn-ghost" href="/design">Design in 3D</a></div>'))
    + '</div>';
  if(!products.length) return;
  qa('#pF button').forEach(function(b){ b.onclick = function(){ f = b.dataset.f; qa('#pF button').forEach(function(x){ x.classList.toggle('on', x === b); }); list(); }; });
  q('#pQ').oninput = function(){ term = this.value; list(); };
  list();
};

VIEWS.product = async function(id){
  loading();
  var all = await needProducts(), isNew = !id || id === 'new';
  var src = isNew ? null : all.filter(function(p){ return p.pid === id; })[0];
  if(!isNew && !src){ await needProducts(true); src = A.products.filter(function(p){ return p.pid === id; })[0]; }
  if(!isNew && !src){ $app.innerHTML = empty(X.tag, 'Product not found.', 'It may have been deleted.', '<button class="btn btn-primary" data-go="/dashboard/products">All products</button>'); return; }
  var p = src ? clone(src) : { title: '', description: '', price: '', compareAt: '', cost: '', category: '', tags: '', status: 'active', featured: true, images: [], options: [], variants: [], variantImages: {}, trackStock: false, stock: null, sizeGuide: '', designKey: '' };
  var draftKey = 'ds.pdraft:' + A.store.sid;
  if(isNew){ try { var dr = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); if(dr){ Object.assign(p, dr); sessionStorage.removeItem(draftKey); } } catch(e){} }
  var base = JSON.stringify(p), stockBase = { s: p.stock, v: {} }, uploading = 0;
  p.variants.forEach(function(v){ stockBase.v[v.id] = v.stock; });
  var cats = []; all.forEach(function(x){ if(x.category && cats.indexOf(x.category) < 0) cats.push(x.category); });

  function changed(){
    var dirty = JSON.stringify(p) !== base || uploading;
    if(dirty) savebar(true, { text: isNew ? 'New product' : 'Unsaved changes', label: isNew ? 'Save product' : 'Save', save: save, discard: isNew ? function(){ go('/dashboard/products'); } : function(){ p = JSON.parse(base); draw(); } });
    else savebar(false);
  }
  async function save(){
    if(uploading){ DS.toast('Wait for the photos to finish uploading.', 'bad'); return; }
    if(!String(p.title).trim()){ DS.toast('Give the product a name.', 'bad'); q('#pTitle').focus(); return; }
    if(p.price === '' || !(+p.price >= 0)){ DS.toast('Add a price.', 'bad'); q('#pPrice').focus(); return; }
    var body = clone(p); body.stockBase = stockBase;
    var r = isNew ? await DS.api('/api/stores/' + A.store.sid + '/products', body) : await DS.api('/api/stores/' + A.store.sid + '/products/' + src.pid, body, 'PUT');
    var saved = r.product;
    if(A.products){ if(isNew) A.products.unshift(saved); else A.products = A.products.map(function(x){ return x.pid === saved.pid ? saved : x; }); }
    savebar(false);
    DS.toast(isNew ? 'Product added' : 'Saved', 'ok');
    if(isNew){ history.replaceState({}, '', '/dashboard/products/' + saved.pid); }
    VIEWS.product(saved.pid);
  }
  function genVariants(){
    if(!p.options.length){ p.variants = []; return; }
    var combos = [[]];
    p.options.forEach(function(o){ var next = []; combos.forEach(function(c){ o.values.forEach(function(v){ next.push(c.concat([v])); }); }); combos = next; });
    combos = combos.slice(0, 200);
    var old = {}; p.variants.forEach(function(v){ old[v.o.join('\u0001')] = v; });
    p.variants = combos.map(function(c){ var k = c.join('\u0001'); return old[k] ? { id: old[k].id, o: c, price: old[k].price, stock: old[k].stock, sku: old[k].sku || '' } : { id: pid(), o: c, price: null, stock: null, sku: '' }; });
    Object.keys(p.variantImages).forEach(function(k){ if(!p.options.some(function(o){ return o.values.indexOf(k) >= 0; })) delete p.variantImages[k]; });
  }
  async function addFiles(files){
    files = files.filter(function(f){ return /^image\//.test(f.type); }).slice(0, 12 - p.images.length);
    if(!files.length) return;
    uploading += files.length; drawPhotos(); changed();
    for(var i = 0; i < files.length; i++){
      try { var url = await uploadImage(files[i]); p.images.push(url); }
      catch(e){ DS.toast(e.message, 'bad'); }
      uploading--; drawPhotos(); drawColorPhotos(); changed();
    }
  }
  function drawPhotos(){
    var el = q('#pPhotos'); if(!el) return;
    el.innerHTML = p.images.map(function(u, i){
      return '<div class="photo"><img src="' + esc(u) + '" alt="">' + (i === 0 ? '<span class="main">MAIN</span>' : '') + '<div class="pa">'
        + (i > 0 ? '<button data-pl="' + i + '" aria-label="Move left">' + X.left + '</button>' : '') + (i < p.images.length - 1 ? '<button data-pr="' + i + '" aria-label="Move right">' + X.right + '</button>' : '')
        + '<button data-px="' + i + '" aria-label="Remove">' + X.trash + '</button></div></div>';
    }).join('') + new Array(uploading + 1).join('<div class="photo up"><span class="spin"></span></div>')
      + (p.images.length + uploading < 12 ? '<label class="photo addp" id="pAdd"><span>' + X.image + 'Add photos<br><small class="subtle">or drop them here</small></span></label>' : '');
    qa('[data-pl]', el).forEach(function(b){ b.onclick = function(){ var i = +b.dataset.pl; p.images.splice(i - 1, 0, p.images.splice(i, 1)[0]); drawPhotos(); changed(); }; });
    qa('[data-pr]', el).forEach(function(b){ b.onclick = function(){ var i = +b.dataset.pr; p.images.splice(i + 1, 0, p.images.splice(i, 1)[0]); drawPhotos(); changed(); }; });
    qa('[data-px]', el).forEach(function(b){ b.onclick = function(){ var u = p.images.splice(+b.dataset.px, 1)[0]; Object.keys(p.variantImages).forEach(function(k){ if(p.variantImages[k] === u) delete p.variantImages[k]; }); drawPhotos(); drawColorPhotos(); changed(); }; });
    var add = q('#pAdd');
    if(add){
      add.onclick = function(e){ e.preventDefault(); pickFiles(true, addFiles); };
      add.ondragover = function(e){ e.preventDefault(); add.classList.add('drag'); };
      add.ondragleave = function(){ add.classList.remove('drag'); };
      add.ondrop = function(e){ e.preventDefault(); add.classList.remove('drag'); addFiles(Array.prototype.slice.call(e.dataTransfer.files || [])); };
    }
  }
  function drawOptions(){
    var el = q('#pOpts'); if(!el) return;
    el.innerHTML = p.options.map(function(o, oi){
      var col = isColorOpt(o);
      return '<div class="opt"><div class="opt-h"><input class="input" data-on="' + oi + '" value="' + esc(o.name) + '" maxlength="30" placeholder="Option name"><button class="icon-btn" data-ox="' + oi + '" aria-label="Remove option">' + X.trash + '</button></div>'
        + '<div class="vals">' + o.values.map(function(v, vi){ var c = col ? skColor(v) : null; return '<span class="val">' + (col ? '<i style="background:' + (c || 'repeating-linear-gradient(45deg,#ddd 0 3px,#fff 3px 6px)') + '"></i>' : '') + esc(v) + '<button data-vx="' + oi + ':' + vi + '" aria-label="Remove">' + DS.I.close + '</button></span>'; }).join('')
        + '<input class="val-in" data-vin="' + oi + '" placeholder="' + (col ? 'Add a colour (e.g. Black)' : 'Add a value') + '" maxlength="40"></div></div>';
    }).join('')
      + '<div class="presets">' + (!p.options.some(function(o){ return /size|مقاس/i.test(o.name); }) ? '<button class="btn btn-ghost btn-xs" data-preset="size">' + X.plus + 'Sizes S–XXL</button>' : '')
      + (!p.options.some(isColorOpt) ? '<button class="btn btn-ghost btn-xs" data-preset="color">' + X.plus + 'Colours</button>' : '')
      + (p.options.length < 3 ? '<button class="btn btn-ghost btn-xs" data-preset="custom">' + X.plus + 'Other option</button>' : '') + '</div>';
    qa('[data-on]', el).forEach(function(inp){ inp.onchange = function(){ p.options[+inp.dataset.on].name = inp.value.trim() || 'Option'; drawOptions(); drawVariants(); drawColorPhotos(); changed(); }; });
    qa('[data-ox]', el).forEach(function(b){ b.onclick = function(){ p.options.splice(+b.dataset.ox, 1); genVariants(); drawOptions(); drawVariants(); drawColorPhotos(); changed(); }; });
    qa('[data-vx]', el).forEach(function(b){ b.onclick = function(){ var a = b.dataset.vx.split(':'), o = p.options[+a[0]]; o.values.splice(+a[1], 1); if(!o.values.length) p.options.splice(+a[0], 1); genVariants(); drawOptions(); drawVariants(); drawColorPhotos(); changed(); }; });
    qa('[data-vin]', el).forEach(function(inp){
      function commit(){
        var o = p.options[+inp.dataset.vin], added = false;
        inp.value.split(/[,،]/).map(function(s){ return s.trim(); }).filter(Boolean).forEach(function(v){ if(o.values.length < 30 && !o.values.some(function(x){ return x.toLowerCase() === v.toLowerCase(); })){ o.values.push(v); added = true; } });
        inp.value = '';
        if(added){ genVariants(); drawOptions(); drawVariants(); drawColorPhotos(); changed(); var again = q('[data-vin="' + inp.dataset.vin + '"]'); if(again) again.focus(); }
      }
      inp.onkeydown = function(e){ if(e.key === 'Enter' || e.key === ','){ e.preventDefault(); commit(); } else if(e.key === 'Backspace' && !inp.value){ var o = p.options[+inp.dataset.vin]; if(o.values.length){ o.values.pop(); genVariants(); drawOptions(); drawVariants(); drawColorPhotos(); changed(); q('[data-vin="' + inp.dataset.vin + '"]').focus(); } } };
      inp.onblur = function(){ if(inp.value.trim()) commit(); };
    });
    qa('[data-preset]', el).forEach(function(b){ b.onclick = function(){
      var k = b.dataset.preset;
      if(k === 'size') p.options.push({ name: A.store.lang === 'ar' ? 'المقاس' : 'Size', values: SIZE_PRESET.slice(1, 4) });
      else if(k === 'color') p.options.unshift({ name: A.store.lang === 'ar' ? 'اللون' : 'Color', values: [] });
      else p.options.push({ name: 'Option', values: [] });
      genVariants(); drawOptions(); drawVariants(); drawColorPhotos(); changed();
      var ins = qa('[data-vin]'); var target = k === 'color' ? ins[0] : ins[ins.length - 1]; if(target && k !== 'size') target.focus();
    }; });
  }
  function drawVariants(){
    var el = q('#pVars'); if(!el) return;
    if(!p.variants.length){ el.innerHTML = p.trackStock ? field('Stock', '<input class="input" type="number" min="0" inputmode="numeric" id="pStock" value="' + (p.stock == null ? '' : p.stock) + '" placeholder="No limit" style="max-width:200px">', 'Leave empty for no limit.') : ''; var st = q('#pStock'); if(st) st.oninput = function(){ p.stock = st.value === '' ? null : Math.max(0, Math.round(+st.value)); changed(); }; return; }
    var col = p.options.findIndex(isColorOpt);
    el.innerHTML = '<div style="overflow-x:auto"><table class="vtable"><tr><th>Variant</th><th>Price</th>' + (p.trackStock ? '<th>Stock</th>' : '') + '</tr>' + p.variants.map(function(v, i){
      var c = col >= 0 ? skColor(v.o[col]) : null;
      return '<tr><td>' + (c ? '<span class="sw" style="background:' + c + '"></span>' : '') + esc(v.o.join(' / ')) + '</td><td><input class="input" type="number" min="0" step="any" data-vp="' + i + '" value="' + (v.price == null ? '' : v.price) + '" placeholder="' + esc(p.price === '' ? '—' : p.price) + '"></td>'
        + (p.trackStock ? '<td><input class="input" type="number" min="0" inputmode="numeric" data-vs="' + i + '" value="' + (v.stock == null ? '' : v.stock) + '" placeholder="∞"></td>' : '') + '</tr>';
    }).join('') + '</table></div><p class="hint">Empty price uses the product price' + (p.trackStock ? '; empty stock means no limit' : '') + '.</p>'
      + (p.trackStock ? '<div class="row" style="margin-top:8px"><span class="tiny">Set all stock to</span><input class="input" type="number" min="0" id="pAllStock" style="width:90px;height:36px"><button class="btn btn-ghost btn-xs" id="pAllGo">Apply</button></div>' : '');
    qa('[data-vp]', el).forEach(function(inp){ inp.oninput = function(){ p.variants[+inp.dataset.vp].price = inp.value === '' ? null : Math.max(0, +inp.value); changed(); }; });
    qa('[data-vs]', el).forEach(function(inp){ inp.oninput = function(){ p.variants[+inp.dataset.vs].stock = inp.value === '' ? null : Math.max(0, Math.round(+inp.value)); changed(); }; });
    var ag = q('#pAllGo'); if(ag) ag.onclick = function(){ var v = q('#pAllStock').value; if(v === '') return; p.variants.forEach(function(x){ x.stock = Math.max(0, Math.round(+v)); }); drawVariants(); changed(); };
  }
  function drawColorPhotos(){
    var el = q('#pCols'); if(!el) return;
    var o = p.options.filter(isColorOpt)[0];
    if(!o || !o.values.length || !p.images.length){ el.innerHTML = ''; el.parentNode.style.display = 'none'; return; }
    el.parentNode.style.display = '';
    el.innerHTML = o.values.map(function(v){
      var c = skColor(v);
      return '<div class="vimg"><span class="nm"><i style="background:' + (c || '#ddd') + '"></i>' + esc(v) + '</span><div class="pick">' + p.images.map(function(u){ return '<button data-cv="' + esc(v) + '" data-cu="' + esc(u) + '"' + (p.variantImages[v] === u ? ' class="on"' : '') + '><img src="' + esc(u) + '" alt=""></button>'; }).join('') + '</div></div>';
    }).join('');
    qa('[data-cv]', el).forEach(function(b){ b.onclick = function(){ var v = b.dataset.cv; if(p.variantImages[v] === b.dataset.cu) delete p.variantImages[v]; else p.variantImages[v] = b.dataset.cu; drawColorPhotos(); changed(); }; });
  }
  function draw(){
    var margin = +p.price > 0 && +p.cost > 0 ? Math.round((1 - p.cost / p.price) * 100) : null;
    $app.innerHTML = '<div class="view">' + head(isNew ? 'New <span class="it">product.</span>' : esc(p.title || 'Product'), isNew ? 'Photos, a name and a price are enough to start.' : (src.status === 'draft' ? 'Draft — hidden from your store.' : 'In your store at <a class="link" target="_blank" rel="noopener" href="' + esc(storeLink('/p/' + encodeURIComponent(src.handle))) + '">/p/' + esc(src.handle) + '</a>'),
        isNew ? '' : '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(storeLink('/p/' + encodeURIComponent(src.handle))) + '">' + X.ext + 'View</a>', ['/dashboard/products', 'Products'])
      + '<div class="cols side"><div>'
      + '<div class="card panel"><h3>Photos <small>' + p.images.length + '/12 · first one is the cover</small></h3><div class="photos" id="pPhotos"></div></div>'
      + '<div class="card panel"><h3>Details</h3><div class="fgrid">'
      + field('Name', '<input class="input" id="pTitle" maxlength="120" value="' + esc(p.title) + '" placeholder="e.g. Cairo Tee" dir="auto">')
      + field('Description', '<textarea class="textarea" id="pDesc" maxlength="6000" dir="auto" placeholder="Fabric, fit, how it’s made, how to wash it…">' + esc(p.description) + '</textarea>')
      + '<div class="fgrid two" style="margin-top:0">' + field('Category', '<input class="input" id="pCat" list="pCats" maxlength="40" value="' + esc(p.category) + '" placeholder="e.g. T-shirts" dir="auto"><datalist id="pCats">' + cats.map(function(c){ return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>', 'Shoppers can browse by category.')
      + field('Tags', '<input class="input" id="pTags" maxlength="200" value="' + esc(p.tags) + '" placeholder="oversized, summer" dir="auto">', 'Help search find it.') + '</div>'
      + '</div></div>'
      + '<div class="card panel"><h3>Price</h3><div class="fgrid three">'
      + field('Price', '<div class="input-group"><input class="input" id="pPrice" type="number" min="0" step="any" inputmode="decimal" value="' + esc(p.price) + '" placeholder="0"><span class="addon">EGP</span></div>')
      + field('Compare at', '<div class="input-group"><input class="input" id="pCmp" type="number" min="0" step="any" inputmode="decimal" value="' + esc(p.compareAt || '') + '" placeholder="—"><span class="addon">EGP</span></div>', 'Shows as a crossed-out price.')
      + field('Cost', '<div class="input-group"><input class="input" id="pCost" type="number" min="0" step="any" inputmode="decimal" value="' + esc(p.cost || '') + '" placeholder="—"><span class="addon">EGP</span></div>', margin != null ? 'Margin ' + margin + '% · ' + money(p.price - p.cost) + ' a piece' : 'Only you see it.')
      + '</div></div>'
      + '<div class="card panel"><h3>Options <small>sizes, colours…</small></h3><p class="sub">Each combination becomes a variant with its own price and stock.</p><div id="pOpts" style="margin-top:14px"></div></div>'
      + '<div class="card panel"><h3>' + (p.options.length ? 'Variants' : 'Stock') + '<label class="row" style="gap:10px;font-weight:400;font-size:14px">Track stock<span class="switch"><input type="checkbox" id="pTrack"' + (p.trackStock ? ' checked' : '') + '><i></i></span></label></h3><p class="sub">' + (p.trackStock ? 'Sold-out choices switch off by themselves; cancelled orders put stock back.' : 'Turn on to count pieces and stop selling at zero.') + '</p><div id="pVars" style="margin-top:12px"></div></div>'
      + '<div class="card panel"><h3>Colour photos</h3><p class="sub">Pick the photo that shows each colour — it appears when shoppers choose it.</p><div class="vimgs" id="pCols"></div></div>'
      + '<div class="card panel"><h3>Size guide <small>optional</small></h3><textarea class="textarea" id="pSize" style="margin-top:12px" maxlength="2000" dir="auto" placeholder="S — chest 104 cm, length 70 cm&#10;M — chest 110 cm, length 72 cm">' + esc(p.sizeGuide) + '</textarea></div>'
      + '</div><div>'
      + '<div class="card panel"><h3>Status</h3><div class="seg" style="margin-top:12px;width:100%" id="pStatus"><button data-s="active" style="flex:1"' + (p.status === 'active' ? ' class="on"' : '') + '>Active</button><button data-s="draft" style="flex:1"' + (p.status === 'draft' ? ' class="on"' : '') + '>Draft</button></div>'
      + '<p class="sub" style="margin-top:10px">' + (p.status === 'draft' ? 'Hidden from your store.' : 'Visible in your store.') + '</p>'
      + '<div class="trow" style="margin-top:6px"><span><b>Featured</b><small>Shown in “featured” sections</small></span><span class="switch"><input type="checkbox" id="pFeat"' + (p.featured ? ' checked' : '') + '><i></i></span></div></div>'
      + (p.designKey ? '<div class="card panel"><h3>3D design</h3><p class="sub">Made in the studio.</p><a class="btn btn-ghost btn-sm btn-block" style="margin-top:12px" href="/design">' + DS.I.design + 'Open the studio</a></div>' : '')
      + (!isNew ? '<div class="card panel"><h3>More</h3><button class="btn btn-ghost btn-sm btn-block" style="margin-top:12px" id="pDup">' + X.dup + 'Duplicate</button><button class="btn btn-danger btn-sm btn-block" style="margin-top:8px" id="pDel">' + X.trash + 'Delete product</button></div>' : '')
      + '</div></div></div>';
    drawPhotos(); drawOptions(); drawVariants(); drawColorPhotos();
    function bind(id, key, num){ var el = q(id); el.oninput = function(){ p[key] = num ? (el.value === '' ? '' : Math.max(0, +el.value)) : el.value; changed(); if(key === 'price') drawVariants(); }; }
    bind('#pTitle', 'title'); bind('#pDesc', 'description'); bind('#pCat', 'category'); bind('#pTags', 'tags'); bind('#pPrice', 'price', 1); bind('#pCmp', 'compareAt', 1); bind('#pCost', 'cost', 1); bind('#pSize', 'sizeGuide');
    q('#pTrack').onchange = function(){ p.trackStock = this.checked; draw(); changed(); };
    q('#pFeat').onchange = function(){ p.featured = this.checked; changed(); };
    qa('#pStatus button').forEach(function(b){ b.onclick = function(){ p.status = b.dataset.s; qa('#pStatus button').forEach(function(x){ x.classList.toggle('on', x === b); }); b.closest('.panel').querySelector('.sub').textContent = p.status === 'draft' ? 'Hidden from your store.' : 'Visible in your store.'; changed(); }; });
    var del = q('#pDel'); if(del) del.onclick = async function(){
      if(!(await ask('Delete “' + esc(p.title) + '”?', 'It disappears from your store. Past orders keep their details.', 'Delete', true))) return;
      try { await DS.api('/api/stores/' + A.store.sid + '/products/' + src.pid, undefined, 'DELETE'); A.products = (A.products || []).filter(function(x){ return x.pid !== src.pid; }); savebar(false); DS.toast('Deleted', 'ok'); go('/dashboard/products'); }
      catch(e){ DS.toast(e.message, 'bad'); }
    };
    var dup = q('#pDup'); if(dup) dup.onclick = function(){
      var c = clone(p); c.title = c.title + ' (copy)'; c.status = 'draft'; c.variants.forEach(function(v){ v.id = pid(); });
      try { sessionStorage.setItem(draftKey, JSON.stringify(c)); } catch(e){}
      savebar(false); go('/dashboard/products/new');
    };
    changed();
  }
  draw();
  if(isNew) setTimeout(function(){ var t = q('#pTitle'); if(t && !t.value) t.focus(); }, 80);
};
