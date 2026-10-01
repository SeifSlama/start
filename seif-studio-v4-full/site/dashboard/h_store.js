/* ============================================================
   STORE — the theme editor. Every change redraws the live preview
   (the same renderer shoppers get); Save publishes it.
   ============================================================ */
var SEC_LABELS = { hero: 'Hero', marquee: 'Moving text', products: 'Products', categories: 'Categories', imageText: 'Image with text', usp: 'Selling points', testimonials: 'Reviews',
                   story: 'Text', gallery: 'Lookbook', faq: 'Questions', banner: 'Promo banner', drop: 'Drop countdown', whatsapp: 'WhatsApp' };
var SEC_HINT = { hero: 'Big opening photo and headline', marquee: 'A line that scrolls by', products: 'A row or grid of products', categories: 'Shop by category', imageText: 'Photo beside a story',
                 usp: 'Why buy from you', testimonials: 'Quotes from customers', story: 'A heading and a paragraph', gallery: 'A wall of photos', faq: 'Answers before they ask',
                 banner: 'An offer with a code', drop: 'Countdown to a launch', whatsapp: 'Invite people to chat' };
var CH = function(a){ return a.map(function(x){ return { v: x[0], t: x[1] }; }); };
var SF = {
  hero: [['layout', 'choice', 'Layout', CH([['split', 'Split'], ['full', 'Full photo'], ['center', 'Centered'], ['poster', 'Poster'], ['collage', 'Collage']])], ['eyebrow', 'text', 'Small line above'],
         ['title', 'text', 'Headline', '*Stars* around words give them the accent style.'], ['text', 'area', 'Text'], ['cta', 'text', 'Button text'], ['ctaHref', 'link', 'Button goes to'],
         ['image', 'image', 'Photo', 'Empty uses your product photos.'], ['height', 'choice', 'Height', CH([['medium', 'Medium'], ['tall', 'Tall'], ['screen', 'Full screen']])]],
  marquee: [['text', 'text', 'Text'], ['style', 'choice', 'Style', CH([['accent', 'Accent'], ['dark', 'Dark'], ['outline', 'Outline'], ['soft', 'Soft']])]],
  products: [['title', 'text', 'Title'], ['subtitle', 'text', 'Subtitle'], ['source', 'source', 'Show'], ['limit', 'number', 'How many', 1, 24], ['layout', 'choice', 'Layout', CH([['grid', 'Grid'], ['editorial', 'Editorial'], ['carousel', 'Carousel']])]],
  categories: [['title', 'text', 'Title'], ['style', 'choice', 'Style', CH([['tiles', 'Photo tiles'], ['pills', 'Pills'], ['big-type', 'Big type']])]],
  imageText: [['title', 'text', 'Title'], ['text', 'area', 'Text'], ['image', 'image', 'Photo', 'Empty uses a product photo.'], ['side', 'choice', 'Order', CH([['right', 'Photo first'], ['left', 'Text first']])], ['cta', 'text', 'Button text'], ['ctaHref', 'link', 'Button goes to']],
  usp: [['style', 'choice', 'Style', CH([['row', 'Row'], ['cards', 'Cards']])], ['items', 'list', 'Points', [['icon', 'icon'], ['title', 'text', 'Title'], ['text', 'text', 'Line']], 4]],
  testimonials: [['title', 'text', 'Title'], ['items', 'list', 'Reviews', [['quote', 'area', 'Quote'], ['name', 'text', 'Name'], ['meta', 'text', 'City or stars']], 6]],
  story: [['eyebrow', 'text', 'Small line above'], ['title', 'text', 'Heading'], ['text', 'area', 'Text'], ['align', 'choice', 'Align', CH([['center', 'Centered'], ['left', 'Left']])]],
  gallery: [['title', 'text', 'Title'], ['style', 'choice', 'Style', CH([['masonry', 'Masonry'], ['strip', 'Strip']])], ['images', 'images', 'Photos', 'Empty uses your product photos.']],
  faq: [['title', 'text', 'Title'], ['items', 'list', 'Questions', [['q', 'text', 'Question'], ['a', 'area', 'Answer']], 12]],
  banner: [['title', 'text', 'Title'], ['text', 'text', 'Line'], ['code', 'text', 'Code', 'Shoppers tap it to copy.'], ['cta', 'text', 'Button text'], ['ctaHref', 'link', 'Button goes to']],
  drop: [['title', 'text', 'Title'], ['text', 'text', 'Line'], ['endsAt', 'datetime', 'Count down to']],
  whatsapp: [['title', 'text', 'Title'], ['text', 'text', 'Line'], ['button', 'text', 'Button']]
};
var loadedFonts = {};
function ensureFont(f){
  if(!f || loadedFonts[f]) return; loadedFonts[f] = 1;
  var url = skFontsUrl([f]); if(!url) return;
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l);
}
/* ---------- colour helpers ---------- */
function hexRgb(h){ h = String(h || '').replace('#', ''); if(h.length === 3) h = h.split('').map(function(c){ return c + c; }).join(''); var n = parseInt(h.slice(0, 6), 16); return isFinite(n) ? [n >> 16 & 255, n >> 8 & 255, n & 255] : [0, 0, 0]; }
function rgbHex(r){ return '#' + r.map(function(v){ return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join('').toUpperCase(); }
function mixHex(a, b, t){ var x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map(function(v, i){ return v + (y[i] - v) * t; })); }
function lum(h){ var c = hexRgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
function sat(h){ var c = hexRgb(h).map(function(v){ return v / 255; }), mx = Math.max.apply(null, c), mn = Math.min.apply(null, c); return mx === 0 ? 0 : (mx - mn) / mx; }
function lineFor(text){ var c = hexRgb(text); return 'rgba(' + c.join(',') + ',.13)'; }
function toHex(c){ if(/^#/.test(c)) return c.length === 4 ? '#' + c.slice(1).split('').map(function(x){ return x + x; }).join('') : c.slice(0, 7); var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c); return m ? rgbHex([+m[1], +m[2], +m[3]]) : '#000000'; }
/* a palette read from a photo: the commonest light (or dark) tone for the page, the most vivid for the accent */
async function paletteFromPhoto(file){
  var im = await readImage(file), c = document.createElement('canvas'); c.width = c.height = 72;
  var g = c.getContext('2d'); g.drawImage(im, 0, 0, 72, 72);
  var d = g.getImageData(0, 0, 72, 72).data, buckets = {};
  for(var i = 0; i < d.length; i += 4){ var k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4); var b = buckets[k] || (buckets[k] = { n: 0, r: 0, g: 0, b: 0 }); b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; }
  var cols = Object.keys(buckets).map(function(k){ var b = buckets[k]; return { n: b.n, hex: rgbHex([b.r / b.n, b.g / b.n, b.b / b.n]) }; }).sort(function(a, b){ return b.n - a.n; }).slice(0, 40);
  var lights = cols.filter(function(x){ return lum(x.hex) > 0.72; }), darks = cols.filter(function(x){ return lum(x.hex) < 0.28; });
  var light = lights.length >= darks.length * 0.6 || !darks.length;
  var bg = light ? (lights[0] ? mixHex(lights[0].hex, '#FFFFFF', 0.35) : '#F6F2EA') : mixHex(darks[0].hex, '#000000', 0.25);
  var acc = cols.filter(function(x){ var l = lum(x.hex); return l > 0.18 && l < 0.82 && x.n > 6; }).sort(function(a, b){ return sat(b.hex) * Math.sqrt(b.n) - sat(a.hex) * Math.sqrt(a.n); })[0];
  var accent = acc ? acc.hex : (light ? '#222222' : '#E8C9A0');
  var text = light ? mixHex(darks[0] ? darks[0].hex : '#1A1A1A', '#000000', 0.45) : mixHex(lights[0] ? lights[0].hex : '#F2EEE6', '#FFFFFF', 0.4);
  if(Math.abs(lum(text) - lum(bg)) < 0.55) text = light ? '#161412' : '#F4F0E8';
  return { bg: bg, surface: light ? mixHex(bg, '#FFFFFF', 0.6) : mixHex(bg, '#FFFFFF', 0.06), text: text, muted: mixHex(text, bg, 0.42), accent: accent, accentText: skInk(accent), line: lineFor(text), sale: '#C2573A' };
}

VIEWS.theme = async function(){
  loading();
  var products = await needProducts();
  var th = clone(A.store.theme), saved = JSON.stringify(th), hist = [], typing = 0;
  var tab = sessionStorage.getItem('ds.etab') || 'sections', open = null, pv = null, lang = A.store.lang;
  var mode = matchMedia('(min-width:1100px)').matches ? 'desktop' : 'phone';
  var live = products.filter(function(p){ return p.status === 'active'; });
  function opts(){ return { theme: th, settings: A.store.settings, lang: lang, products: live.length ? live : SK_DEMO.products(lang), storeName: A.store.name, logo: A.store.logo, demo: !live.length,
    onselect: function(id){ tab = 'sections'; open = id; drawTabs(); drawBody(); var el = q('[data-sid2="' + id + '"]'); if(el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); },
    onroute: function(r){ var s = q('#pvPage'); if(s) s.value = ['home', 'shop', 'product', 'cart', 'checkout'].indexOf(r.page) >= 0 ? r.page : ''; } }; }
  var redrawT = 0;
  /* undo keeps a snapshot before each change; typing in one field is one step */
  function snap(){ hist.push(JSON.stringify(th)); if(hist.length > 60) hist.shift(); var u = q('#eUndo'); if(u) u.disabled = false; }
  function edit(fn, soft){
    if(!soft || !typing) snap();
    if(soft){ clearTimeout(typing); typing = setTimeout(function(){ typing = 0; }, 900); }
    fn();
    clearTimeout(redrawT); redrawT = setTimeout(function(){ if(pv) pv.update({ theme: th }, true); }, soft ? 260 : 0);
    var dirty = JSON.stringify(th) !== saved;
    if(dirty) savebar(true, { text: 'Unsaved changes to your store', label: 'Save', save: save, discard: function(){ th = JSON.parse(saved); hist = []; pv.update({ theme: th }, true); drawBody(); } });
    else savebar(false);
  }
  async function save(){
    th.edited = true;
    await saveStore({ theme: th });
    th = clone(A.store.theme); saved = JSON.stringify(th);
    savebar(false);
    DS.toast(A.store.published ? 'Saved — your store updates in a few seconds.' : 'Saved.', 'ok');
  }
  function undo(){ if(!hist.length) return; th = JSON.parse(hist.pop()); pv.update({ theme: th }, true); drawBody(); var dirty = JSON.stringify(th) !== saved; if(dirty) savebar(true, A.dirty || { text: 'Unsaved changes to your store', label: 'Save', save: save }); else savebar(false); q('#eUndo').disabled = !hist.length; }

  /* ---------- preview frame sizing ---------- */
  function fit(){
    var stage = q('#pvStage'), frame = q('#pvFrame'), f = q('#pvIf'); if(!stage) return;
    var W = stage.clientWidth, H = stage.clientHeight;
    stage.classList.toggle('phone', mode === 'phone');
    if(mode === 'desktop'){ var vw = 1280, k = W / vw; frame.style.width = W + 'px'; frame.style.height = H + 'px'; f.style.width = vw + 'px'; f.style.height = Math.ceil(H / k) + 'px'; f.style.transform = 'scale(' + k + ')'; }
    else { var pw = 390, ph = 844, k2 = Math.min(1, (H - 32) / ph, (W - 40) / pw); frame.style.width = Math.round(pw * k2) + 'px'; frame.style.height = Math.round(ph * k2) + 'px'; f.style.width = pw + 'px'; f.style.height = ph + 'px'; f.style.transform = 'scale(' + k2 + ')'; }
    qa('[data-mode]').forEach(function(b){ b.classList.toggle('on', b.dataset.mode === mode); });
  }

  /* ---------- form pieces ---------- */
  function linkOptions(cur){
    var o = [['shop', 'All products'], ['home', 'Home page']];
    SK.categories(live).forEach(function(c){ o.push(['c:' + c, 'Category · ' + c]); });
    live.slice(0, 60).forEach(function(p){ o.push(['p:' + p.handle, 'Product · ' + p.title]); });
    [['about', 'About'], ['returns', 'Returns'], ['shipping', 'Delivery'], ['track', 'Track order']].forEach(function(x){ o.push([x[0] === 'track' ? 'shop' : 'page:' + x[0], 'Page · ' + x[1]]); });
    if(cur && !o.some(function(x){ return x[0] === cur; })) o.push([cur, cur]);
    return o.map(function(x){ return '<option value="' + esc(x[0]) + '"' + (x[0] === cur ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  }
  function sourceOptions(cur){
    var o = [['featured', 'Featured products'], ['newest', 'Newest'], ['sale', 'On sale'], ['all', 'Everything']];
    SK.categories(live).forEach(function(c){ o.push(['category:' + c, 'Category · ' + c]); });
    return o.map(function(x){ return '<option value="' + esc(x[0]) + '"' + (x[0] === cur ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  }
  function chooser(name, choices, cur){ return '<div class="chooser" data-ch="' + name + '">' + choices.map(function(c){ return '<button data-v="' + esc(c.v) + '"' + (String(c.v) === String(cur) ? ' class="on"' : '') + '>' + esc(c.t) + '</button>'; }).join('') + '</div>'; }
  function imgField(key, url, hint){ return '<div class="imgfld"><span class="ph">' + (url ? '<img src="' + esc(url) + '" alt="">' : X.image) + '</span><div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn btn-ghost btn-xs" data-img="' + key + '">' + (url ? 'Change' : 'Upload') + '</button>' + (url ? '<button class="btn btn-ghost btn-xs" data-imgx="' + key + '">Remove</button>' : '') + '</div></div>' + (hint ? '<div class="hint">' + hint + '</div>' : ''); }
  function sectionEditor(x){
    return SF[x.type].map(function(f){
      var key = f[0], kind = f[1], label = f[2], v = x[key];
      if(kind === 'text') return '<label class="fld"><span>' + label + '</span><input class="input" data-k="' + key + '" value="' + esc(v || '') + '" maxlength="200" dir="auto"></label>' + (f[3] ? '<div class="hint">' + f[3] + '</div>' : '');
      if(kind === 'area') return '<label class="fld"><span>' + label + '</span><textarea class="textarea" data-k="' + key + '" maxlength="1500" dir="auto">' + esc(v || '') + '</textarea></label>';
      if(kind === 'number') return '<label class="fld"><span>' + label + ' <em>' + (v || 8) + '</em></span><input class="range" type="range" min="' + f[3] + '" max="' + f[4] + '" data-k="' + key + '" data-num value="' + (v || 8) + '"></label>';
      if(kind === 'choice') return '<div class="fld"><span>' + label + '</span>' + chooser(key, f[3], v) + '</div>';
      if(kind === 'link') return '<label class="fld"><span>' + label + '</span><select class="select" data-k="' + key + '">' + linkOptions(v || 'shop') + '</select></label>';
      if(kind === 'source') return '<label class="fld"><span>' + label + '</span><select class="select" data-k="' + key + '">' + sourceOptions(v || 'featured') + '</select></label>';
      if(kind === 'datetime') return '<label class="fld"><span>' + label + '</span><input class="input" type="datetime-local" data-k="' + key + '" value="' + esc(v || '') + '"></label>';
      if(kind === 'image') return '<div class="fld"><span>' + label + '</span>' + imgField(key, v, f[3]) + '</div>';
      if(kind === 'images') return '<div class="fld"><span>' + label + ' <em>' + (v || []).length + '/9</em></span><div class="photos" style="grid-template-columns:repeat(3,1fr);margin-top:4px">' + (v || []).map(function(u, i){ return '<div class="photo"><img src="' + esc(u) + '" alt=""><div class="pa"><button data-gx="' + i + '">' + X.trash + '</button></div></div>'; }).join('') + ((v || []).length < 9 ? '<label class="photo addp" data-gadd><span>' + X.image + 'Add</span></label>' : '') + '</div><div class="hint">' + f[3] + '</div></div>';
      if(kind === 'list') return '<div class="fld"><span>' + label + '</span><div class="items-ed">' + (v || []).map(function(it, i){
        return '<div class="item-ed"><button class="x" data-lx="' + i + '" aria-label="Remove">' + DS.I.close + '</button>' + f[3].map(function(sf){
          if(sf[1] === 'icon') return '<div class="chooser" style="margin-bottom:6px" data-lic="' + i + '">' + SK_ICONS.map(function(ic){ return '<button data-v="' + ic + '" title="' + ic + '"' + (it.icon === ic ? ' class="on"' : '') + ' style="width:34px;padding:0;display:grid;place-items:center"><span style="width:18px;height:18px;display:block">' + SK.IC[ic].replace('<svg', '<svg width="18" height="18"') + '</span></button>'; }).join('') + '</div>';
          return sf[1] === 'area' ? '<textarea class="textarea" style="min-height:64px;margin-top:6px" data-li="' + i + '" data-lk="' + sf[0] + '" placeholder="' + esc(sf[2]) + '" dir="auto">' + esc(it[sf[0]] || '') + '</textarea>'
            : '<input class="input" style="margin-top:6px" data-li="' + i + '" data-lk="' + sf[0] + '" value="' + esc(it[sf[0]] || '') + '" placeholder="' + esc(sf[2]) + '" dir="auto">';
        }).join('') + '</div>';
      }).join('') + ((v || []).length < f[4] ? '<button class="btn btn-ghost btn-xs" data-ladd>' + X.plus + 'Add</button>' : '') + '</div></div>';
      return '';
    }).join('');
  }
  function bindSection(el, x){
    qa('[data-k]', el).forEach(function(inp){
      var k = inp.dataset.k, isNum = inp.hasAttribute('data-num');
      var handler = function(){ edit(function(){ x[k] = isNum ? +inp.value : inp.value; }, inp.tagName !== 'SELECT' && !isNum ? true : false); if(isNum){ inp.previousElementSibling.querySelector('em').textContent = inp.value; } if(k === 'title' || k === 'text') { var sm = q('[data-sid2="' + x.id + '"] .nm small'); if(sm) sm.textContent = summary(x); } };
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', handler);
    });
    qa('[data-ch]', el).forEach(function(box){ qa('button', box).forEach(function(b){ b.onclick = function(){ edit(function(){ x[box.dataset.ch] = b.dataset.v; }); qa('button', box).forEach(function(o){ o.classList.toggle('on', o === b); }); }; }); });
    qa('[data-img]', el).forEach(function(b){ b.onclick = function(){ pickFiles(false, async function(files){ if(!files[0]) return; b.classList.add('is-busy'); try { var u = await uploadImage(files[0]); edit(function(){ x[b.dataset.img] = u; }); drawBody(); } catch(e){ DS.toast(e.message, 'bad'); b.classList.remove('is-busy'); } }); }; });
    qa('[data-imgx]', el).forEach(function(b){ b.onclick = function(){ edit(function(){ x[b.dataset.imgx] = null; }); drawBody(); }; });
    var gadd = q('[data-gadd]', el); if(gadd) gadd.onclick = function(e){ e.preventDefault(); pickFiles(true, async function(files){ for(var i = 0; i < files.length && (x.images || []).length < 9; i++){ try { var u = await uploadImage(files[i]); edit(function(){ x.images = (x.images || []).concat([u]); }); } catch(err){ DS.toast(err.message, 'bad'); } } drawBody(); }); };
    qa('[data-gx]', el).forEach(function(b){ b.onclick = function(){ edit(function(){ x.images.splice(+b.dataset.gx, 1); }); drawBody(); }; });
    qa('[data-li]', el).forEach(function(inp){ inp.oninput = function(){ edit(function(){ x.items[+inp.dataset.li][inp.dataset.lk] = inp.value; }, true); }; });
    qa('[data-lic]', el).forEach(function(box){ qa('button', box).forEach(function(b){ b.onclick = function(){ edit(function(){ x.items[+box.dataset.lic].icon = b.dataset.v; }); qa('button', box).forEach(function(o){ o.classList.toggle('on', o === b); }); }; }); });
    qa('[data-lx]', el).forEach(function(b){ b.onclick = function(){ edit(function(){ x.items.splice(+b.dataset.lx, 1); }); drawBody(); }; });
    var ladd = q('[data-ladd]', el); if(ladd) ladd.onclick = function(){ edit(function(){ var tmpl = clone(SK_SECTION_TYPES[x.type].d.items[0]); Object.keys(tmpl).forEach(function(k){ if(k !== 'icon') tmpl[k] = ''; }); x.items = (x.items || []).concat([tmpl]); }); drawBody(); };
  }
  function summary(x){ var t = x.title || x.text || ''; return String(t).replace(/\*/g, '').slice(0, 60) || SEC_HINT[x.type]; }

  /* ---------- tabs ---------- */
  function drawSections(body){
    body.innerHTML = '<div class="panel card"><h4>Sections <span class="subtle" style="text-transform:none;letter-spacing:0;font-weight:400">— drag to reorder, click to edit</span></h4><div class="secs" id="eSecs">' + th.sections.map(function(x){
      return '<div class="sitem" data-id="' + esc(x.id) + '"><div class="sec' + (x.on === false ? ' off' : '') + (open === x.id ? ' sel' : '') + '" data-sid2="' + esc(x.id) + '"><span class="hd" aria-label="Drag">' + X.drag + '</span>'
        + '<button class="nm" data-open="' + esc(x.id) + '"><b>' + esc(SEC_LABELS[x.type] || x.type) + '</b><small>' + esc(summary(x)) + '</small></button>'
        + '<button class="ib" data-vis="' + esc(x.id) + '" title="' + (x.on === false ? 'Show' : 'Hide') + '">' + (x.on === false ? X.eyeOff : X.eye) + '</button>'
        + '<button class="ib" data-dupe="' + esc(x.id) + '" title="Duplicate">' + X.dup + '</button><button class="ib" data-del="' + esc(x.id) + '" title="Delete">' + X.trash + '</button></div>'
        + (open === x.id ? '<div class="sec-ed" id="secEd">' + sectionEditor(x) + '</div>' : '') + '</div>';
    }).join('') + '</div><button class="btn btn-ghost btn-sm btn-block" style="margin-top:12px" id="eAdd">' + X.plus + 'Add a section</button></div>'
      + '<p class="tiny" style="margin:12px 4px 0">Header, footer and the announcement bar are under <b>Style</b>.</p>';
    var secs = q('#eSecs');
    qa('[data-open]', body).forEach(function(b){ b.onclick = function(){ open = open === b.dataset.open ? null : b.dataset.open; drawBody(); if(open && pv) pv.focus(open); }; });
    qa('[data-vis]', body).forEach(function(b){ b.onclick = function(){ var x = th.sections.filter(function(s){ return s.id === b.dataset.vis; })[0]; edit(function(){ x.on = x.on === false; }); drawBody(); }; });
    qa('[data-dupe]', body).forEach(function(b){ b.onclick = function(){ var i = th.sections.findIndex(function(s){ return s.id === b.dataset.dupe; }); edit(function(){ var c = clone(th.sections[i]); c.id = 's' + pid(); th.sections.splice(i + 1, 0, c); open = c.id; }); drawBody(); }; });
    qa('[data-del]', body).forEach(function(b){ b.onclick = function(){ var i = th.sections.findIndex(function(s){ return s.id === b.dataset.del; }); edit(function(){ th.sections.splice(i, 1); }); if(open === b.dataset.del) open = null; drawBody(); }; });
    q('#eAdd').onclick = function(){
      var box = DS.sheet('addsec', '<h2 class="display h-3">Add a section</h2><div class="addsec" style="margin-top:14px">' + Object.keys(SK_SECTION_TYPES).map(function(t){ return '<button data-t="' + t + '"><b>' + esc(SEC_LABELS[t]) + '</b><small>' + esc(SEC_HINT[t]) + '</small></button>'; }).join('') + '</div>');
      qa('[data-t]', box).forEach(function(b){ b.onclick = function(){
        var x = clone(SK_SECTION_TYPES[b.dataset.t].d); x.type = b.dataset.t; x.id = 's' + pid(); x.on = true;
        if(x.type === 'drop' && !x.endsAt){ var d = new Date(Date.now() + 7 * 864e5); d.setMinutes(0, 0, 0); x.endsAt = d.toISOString().slice(0, 16); }
        var at = open ? th.sections.findIndex(function(s){ return s.id === open; }) + 1 : th.sections.length;
        edit(function(){ th.sections.splice(at, 0, x); }); open = x.id; DS.closeSheet('addsec'); drawBody(); setTimeout(function(){ if(pv) pv.focus(x.id); }, 400);
      }; });
    };
    var ed = q('#secEd'); if(ed){ bindSection(ed, th.sections.filter(function(s){ return s.id === open; })[0]); }
    /* drag to reorder */
    secs.addEventListener('pointerdown', function(e){
      var hd = e.target.closest('.hd'); if(!hd) return;
      e.preventDefault();
      var item = hd.closest('.sitem'); item.querySelector('.sec').classList.add('dragging');
      try { hd.setPointerCapture(e.pointerId); } catch(err){}
      function move(ev){
        var others = qa('.sitem', secs).filter(function(r){ return r !== item; });
        var before = others.filter(function(r){ var b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; })[0];
        if(before) secs.insertBefore(item, before); else secs.appendChild(item);
      }
      function up(){
        hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
        item.querySelector('.sec').classList.remove('dragging');
        var order = qa('.sitem', secs).map(function(r){ return r.dataset.id; });
        if(order.join() !== th.sections.map(function(s){ return s.id; }).join()) edit(function(){ th.sections.sort(function(a, b){ return order.indexOf(a.id) - order.indexOf(b.id); }); });
      }
      hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
    });
  }
  function drawStyle(body){
    var s = th.s, c = s.colors, f = s.font;
    var fonts = lang === 'ar' ? [f.headingAr, f.bodyAr, f.heading, f.body] : [f.heading, f.body]; fonts.forEach(ensureFont);
    var colorKeys = [['bg', 'Background'], ['surface', 'Cards'], ['text', 'Text'], ['muted', 'Soft text'], ['accent', 'Accent'], ['accentText', 'On accent'], ['sale', 'Sale']];
    function fontSel(key, list){ return '<select class="select fontpick" data-font="' + key + '" style="font-family:\'' + f[key] + '\'">' + list.map(function(n){ return '<option' + (n === f[key] ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>'; }
    body.innerHTML = '<div class="panel card"><h4>Colours</h4><div class="pal">' + SK_PALETTES.map(function(p){ var on = p.c.bg === c.bg && p.c.accent === c.accent && p.c.text === c.text;
        return '<button data-pal="' + p.id + '"' + (on ? ' class="on"' : '') + ' title="' + esc(p.name) + '"><span class="chips"><i style="background:' + p.c.bg + '"></i><i style="background:' + p.c.surface + '"></i><i style="background:' + p.c.accent + '"></i><i style="background:' + p.c.text + '"></i></span><small>' + esc(p.name) + '</small></button>'; }).join('') + '</div>'
      + '<button class="btn btn-ghost btn-sm btn-block" style="margin-top:10px" id="ePhoto">' + X.image + 'Colours from a photo</button>'
      + '<div class="colors">' + colorKeys.map(function(k){ return '<label class="color"><input type="color" data-col="' + k[0] + '" value="' + toHex(c[k[0]]) + '">' + k[1] + '</label>'; }).join('') + '</div></div>'
      + '<div class="panel card"><h4>Type</h4>'
      + '<label class="fld"><span>Headings</span>' + fontSel('heading', SK_FONTS.display) + '</label><label class="fld"><span>Text</span>' + fontSel('body', SK_FONTS.body) + '</label>'
      + (lang === 'ar' ? '<label class="fld"><span>Arabic headings</span>' + fontSel('headingAr', SK_FONTS.arabic) + '</label><label class="fld"><span>Arabic text</span>' + fontSel('bodyAr', SK_FONTS.arabic) + '</label>' : '')
      + '<div class="fld"><span>Heading weight</span>' + chooser('font.weight', CH([[400, 'Regular'], [500, 'Medium'], [600, 'Semi'], [700, 'Bold'], [800, 'Black']]), f.weight) + '</div>'
      + '<label class="fld"><span>Heading size <em>' + Math.round(f.scale * 100) + '%</em></span><input class="range" type="range" min="0.8" max="1.4" step="0.02" data-rng="font.scale" value="' + f.scale + '"></label>'
      + '<label class="fld"><span>Letter spacing <em>' + f.track + '</em></span><input class="range" type="range" min="-0.06" max="0.2" step="0.005" data-rng="font.track" value="' + f.track + '"></label>'
      + '<div class="trow"><span><b>Capital letters</b><small>Headings in uppercase</small></span><span class="switch"><input type="checkbox" data-tog="font.upper"' + (f.upper ? ' checked' : '') + '><i></i></span></div></div>'
      + '<div class="panel card"><h4>Shapes</h4>'
      + '<label class="fld"><span>Roundness <em>' + s.radius + 'px</em></span><input class="range" type="range" min="0" max="40" step="1" data-rng="radius" value="' + s.radius + '"></label>'
      + '<div class="fld"><span>Buttons</span>' + chooser('button', CH([['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square'], ['outline', 'Outline'], ['underline', 'Underline'], ['brutal', 'Brutal']]), s.button) + '</div>'
      + '<div class="fld"><span>Product cards</span>' + chooser('card.style', CH([['plain', 'Plain'], ['framed', 'Framed'], ['raised', 'Raised'], ['polaroid', 'Polaroid'], ['brutal', 'Brutal']]), s.card.style) + '</div>'
      + '<div class="fld"><span>Photo shape</span>' + chooser('card.ratio', CH([['3/4', 'Portrait'], ['4/5', 'Tall'], ['1/1', 'Square'], ['2/3', 'Slim']]), s.card.ratio) + '</div>'
      + '<div class="fld"><span>On hover</span>' + chooser('card.hover', CH([['swap', 'Second photo'], ['zoom', 'Zoom'], ['lift', 'Lift'], ['none', 'Nothing']]), s.card.hover) + '</div>'
      + '<div class="fld"><span>Card text</span>' + chooser('card.align', CH([['left', 'Start'], ['center', 'Centre']]), s.card.align) + '</div></div>'
      + '<div class="panel card"><h4>Header</h4>'
      + '<div class="fld"><span>Layout</span>' + chooser('header.layout', CH([['left', 'Logo left'], ['center', 'Logo centre'], ['stack', 'Stacked']]), s.header.layout) + '</div>'
      + '<div class="fld"><span>Style</span>' + chooser('header.style', CH([['solid', 'Solid'], ['glass', 'Glass'], ['boxed', 'Floating'], ['transparent', 'Over the photo']]), s.header.style) + '</div>'
      + '<label class="fld"><span>Logo text</span><input class="input" data-txt="header.logoText" value="' + esc(s.header.logoText || '') + '" placeholder="' + esc(A.store.name) + '" maxlength="40" dir="auto"></label>'
      + '<label class="fld"><span>Logo size <em>' + Math.round(s.header.logoScale * 100) + '%</em></span><input class="range" type="range" min="0.6" max="2" step="0.05" data-rng="header.logoScale" value="' + s.header.logoScale + '"></label>'
      + '<p class="hint">Upload a logo image in <a class="link" href="/dashboard/settings">Settings</a>.</p></div>'
      + '<div class="panel card"><h4>Announcement bar</h4><div class="trow" style="padding-top:0"><span><b>Show it</b><small>A line above the header</small></span><span class="switch"><input type="checkbox" data-tog="announce.on"' + (s.announce.on ? ' checked' : '') + '><i></i></span></div>'
      + '<label class="fld"><span>Text</span><input class="input" data-txt="announce.text" value="' + esc(s.announce.text || '') + '" maxlength="200" dir="auto"></label>'
      + '<div class="fld"><span>Style</span>' + chooser('announce.style', CH([['solid', 'Still'], ['marquee', 'Moving']]), s.announce.style) + '</div></div>'
      + '<div class="panel card"><h4>Page</h4>'
      + '<div class="fld"><span>Spacing</span>' + chooser('density', CH([['compact', 'Compact'], ['regular', 'Regular'], ['airy', 'Airy']]), s.density) + '</div>'
      + '<div class="fld"><span>Width</span>' + chooser('width', CH([['normal', 'Normal'], ['wide', 'Wide'], ['full', 'Edge to edge']]), s.width) + '</div>'
      + '<div class="fld"><span>Products per row — computer</span>' + chooser('grid.d', CH([[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]), s.grid.d) + '</div>'
      + '<div class="fld"><span>Products per row — phone</span>' + chooser('grid.m', CH([[1, '1'], [2, '2']]), s.grid.m) + '</div>'
      + '<div class="fld"><span>Texture</span>' + chooser('texture', CH([['none', 'None'], ['paper', 'Paper'], ['grain', 'Grain'], ['grid', 'Grid'], ['dots', 'Dots']]), s.texture) + '</div>'
      + '<div class="fld"><span>Decoration</span>' + chooser('decor', CH([['none', 'None'], ['stickers', 'Stickers'], ['arabesque', 'Arabesque']]), s.decor) + '</div>'
      + '<div class="trow"><span><b>Animations</b><small>Things glide in as you scroll</small></span><span class="switch"><input type="checkbox" data-tog="motion"' + (s.motion ? ' checked' : '') + '><i></i></span></div></div>';
    function setPath(path, v){ var parts = path.split('.'), o = th.s; for(var i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; }
    qa('[data-ch]', body).forEach(function(box){ qa('button', box).forEach(function(b){ b.onclick = function(){ var v = b.dataset.v; edit(function(){ setPath(box.dataset.ch, /^\d+$/.test(v) && box.dataset.ch !== 'card.ratio' ? +v : v); }); qa('button', box).forEach(function(o){ o.classList.toggle('on', o === b); }); }; }); });
    qa('[data-rng]', body).forEach(function(r){ r.oninput = function(){ edit(function(){ setPath(r.dataset.rng, +r.value); }, true); var em = r.previousElementSibling.querySelector('em'); if(em) em.textContent = r.dataset.rng === 'radius' ? r.value + 'px' : /scale/i.test(r.dataset.rng) ? Math.round(r.value * 100) + '%' : r.value; }; });
    qa('[data-tog]', body).forEach(function(t){ t.onchange = function(){ edit(function(){ setPath(t.dataset.tog, t.checked); }); }; });
    qa('[data-txt]', body).forEach(function(t){ t.oninput = function(){ edit(function(){ setPath(t.dataset.txt, t.value); }, true); }; });
    qa('[data-font]', body).forEach(function(sel){ sel.onchange = function(){ ensureFont(sel.value); sel.style.fontFamily = "'" + sel.value + "'"; edit(function(){ th.s.font[sel.dataset.font] = sel.value; }); }; });
    qa('[data-col]', body).forEach(function(inp){ inp.oninput = function(){ edit(function(){ th.s.colors[inp.dataset.col] = inp.value.toUpperCase(); if(inp.dataset.col === 'text') th.s.colors.line = lineFor(inp.value); if(inp.dataset.col === 'accent') th.s.colors.accentText = skInk(inp.value); }, true); }; });
    qa('[data-pal]', body).forEach(function(b){ b.onclick = function(){ var p = SK_PALETTES.filter(function(x){ return x.id === b.dataset.pal; })[0]; edit(function(){ th.s.colors = clone(p.c); }); drawBody(); }; });
    q('#ePhoto').onclick = function(){ pickFiles(false, async function(files){ if(!files[0]) return; try { var pal = await paletteFromPhoto(files[0]); edit(function(){ th.s.colors = pal; }); drawBody(); DS.toast('Colours taken from your photo', 'ok'); } catch(e){ DS.toast(e.message, 'bad'); } }); };
  }
  function drawThemes(body){
    body.innerHTML = '<div class="panel card"><h4>Start from a theme</h4><div class="thgrid">' + SK_THEME_ORDER.map(function(id){
      var t = SK_THEMES[id], c = t.s.colors; ensureFont(t.s.font.heading);
      return '<button class="thc' + (th.id === id ? ' on' : '') + '" data-th="' + id + '"><span class="sw3" style="background:' + c.bg + '"><span class="tt" style="color:' + c.text + ';font-family:\'' + t.s.font.heading + '\'">Aa</span><i style="background:' + c.accent + '"></i><i style="background:' + c.text + '"></i><i style="background:' + c.surface + '"></i></span><span class="nm"><b>' + esc(t.name) + '</b><small>' + esc(t.tag) + '</small></span></button>';
    }).join('') + '</div></div>'
      + '<div class="panel card"><h4>Remix</h4><p class="sub" style="margin:0 0 12px">A new mix of colours, fonts and shapes that still suits ' + esc((SK_THEMES[th.id] || {}).name || 'your theme') + '. Press again for another. Undo brings the last one back.</p><button class="btn btn-primary btn-block" id="eRemix2">' + X.sparkle + 'Remix</button></div>';
    qa('[data-th]', body).forEach(function(b){ b.onclick = async function(){
      var id = b.dataset.th;
      var box = DS.sheet('usetheme', '<h2 class="display h-3">Switch to ' + esc(SK_THEMES[id].name) + '?</h2><p class="muted" style="margin-top:8px">Keep your sections and text, or start over with this theme’s sections too.</p>'
        + '<div class="fgrid"><button class="btn btn-primary btn-block" data-k="look">Use its look, keep my sections</button><button class="btn btn-ghost btn-block" data-k="all">Start fresh with its sections</button></div>');
      qa('[data-k]', box).forEach(function(k){ k.onclick = function(){
        var n = skNewTheme(id);
        edit(function(){ th.id = id; th.s = n.s; if(k.dataset.k === 'all'){ th.sections = lang === 'ar' && id !== 'souk' ? skNewTheme('souk').sections : n.sections; open = null; } });
        DS.closeSheet('usetheme'); drawBody();
      }; });
    }; });
    q('#eRemix2').onclick = remix;
  }
  function remix(){ edit(function(){ var r = skRemix(th); th.s = r.s; }); drawBody(); }
  function drawTabs(){ qa('.etabs button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === tab); }); try { sessionStorage.setItem('ds.etab', tab); } catch(e){} }
  function drawBody(){ var body = q('#eBody'); if(!body) return; if(tab === 'style') drawStyle(body); else if(tab === 'themes') drawThemes(body); else drawSections(body); }

  $app.innerHTML = '<div class="view">' + storeBar() + head('Your <span class="it">store.</span>', esc((SK_THEMES[th.id] || {}).name || 'Theme') + ' theme · changes show live, Save makes them public.',
      '<button class="btn btn-ghost btn-sm" id="eUndo" disabled>' + X.undo + 'Undo</button><button class="btn btn-ghost btn-sm" id="eRemix">' + X.sparkle + 'Remix</button>')
    + '<div class="ed"><div class="pv"><div class="pv-bar"><div class="seg seg-sm"><button data-mode="desktop" title="Computer">' + X.desktop + '</button><button data-mode="phone" title="Phone">' + X.mobile + '</button></div>'
    + '<span class="url">' + esc(location.host + '/' + A.store.slug) + '</span><select class="select" id="pvPage" style="height:32px;width:auto;font-size:13px;padding:0 30px 0 10px;border-radius:999px"><option value="home">Home</option><option value="shop">Shop</option><option value="product">Product</option><option value="cart">Bag</option><option value="checkout">Checkout</option></select>'
    + '<a class="icon-btn" style="width:34px;height:34px" href="' + esc(storeLink('')) + '" target="_blank" rel="noopener" title="Open store">' + X.ext + '</a></div>'
    + '<div class="pv-stage" id="pvStage"><div class="pv-frame" id="pvFrame"><iframe id="pvIf" title="Store preview"></iframe></div></div></div>'
    + '<div class="ctrl"><div class="etabs"><button data-t="sections">Sections</button><button data-t="style">Style</button><button data-t="themes">Themes</button></div><div id="eBody"></div></div></div></div>';
  var css = document.getElementById('edOrder');
  if(!css){ css = document.createElement('style'); css.id = 'edOrder'; css.textContent = '@media (min-width:1100px){.ed .ctrl{order:-1}}'; document.head.appendChild(css); }
  if(!live.length) DS.toast('Showing sample products until you add your own.', '', 3500);
  qa('.etabs button').forEach(function(b){ b.onclick = function(){ tab = b.dataset.t; drawTabs(); drawBody(); }; });
  qa('[data-mode]').forEach(function(b){ b.onclick = function(){ mode = b.dataset.mode; fit(); }; });
  q('#pvPage').onchange = function(){ var v = this.value, r = { page: v }; if(v === 'product'){ var p0 = (live.length ? live : SK_DEMO.products(lang))[0]; r.handle = p0 ? p0.handle : ''; } pv.go(r); };
  q('#eUndo').onclick = undo;
  q('#eRemix').onclick = remix;
  drawTabs(); drawBody();
  pv = SKP.make(q('#pvIf'), opts());
  fit();
  window.addEventListener('resize', fit);
  VIEWS.cleanup = function(){ window.removeEventListener('resize', fit); if(pv) pv.destroy(); };
};
