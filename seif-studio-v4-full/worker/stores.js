/* ============================================================
   STORES — merchants' shops: settings, products, photos, orders (cash on
   delivery), customers, discounts, daily numbers, and every store's pages.
   Built into dist/_worker.js after the storefront renderer (SK, SK_*) and
   before worker/index.js, whose helpers (db, json, body, cookieUid, …) it uses.

   Merchant API (signed in, own stores only):
     GET    /api/stores                         -> {stores}
     POST   /api/stores {name, slug, theme, lang}             create (3 per account)
     GET    /api/slug?s=                        -> {ok, reason}
     GET    /api/stores/:sid                    -> {store}
     PATCH  /api/stores/:sid {name, slug, theme, settings, discounts, lang, logo, published}
     GET    /api/stores/:sid/products           -> {products}
     POST   /api/stores/:sid/products {…}       -> {product}
     PUT    /api/stores/:sid/products/:pid {…}  -> {product}
     DELETE /api/stores/:sid/products/:pid
     POST   /api/stores/:sid/media {data: dataURL, w, h}   -> {url: '/m/<id>'}
     GET    /api/stores/:sid/orders             -> {orders}
     GET    /api/stores/:sid/orders/:n          -> {order}
     PATCH  /api/stores/:sid/orders/:n {status, note}      (cancelling puts stock back)
     GET    /api/stores/:sid/customers          -> {customers}
     GET    /api/stores/:sid/stats?days=30      -> {days}
   Shoppers (no account):
     POST   /api/s/:slug/order {items, name, phone, …}     -> {ok, oid, number, token}
     POST   /api/s/:slug/discount {code, subtotal}         -> {ok, code, type, value, min}
     GET    /api/s/:slug/track?n=&phone=                   -> {ok, order}
     POST   /api/s/:slug/hit {p, pid, n}                   page view counter
   Pages: GET /<slug>[/shop|/p/<handle>|/cart|/checkout|/order/<n>?k=|/track|/pages/<id>],
          GET /m/<id> (photos, cached for a year).

   Firestore:
     stores/{sid}            {sid, owner, slug, name, published, lang, themeJson, settingsJson, discountsJson,
                              orderSeq, logo, createdAt, updatedAt}
     slugs/{slug}            {sid, owner}
     stores/{sid}/products/{pid}   {…, imagesJson, optionsJson, variantsJson, variantImagesJson}
     stores/{sid}/orders/{number}  {number, status, itemsJson, timelineJson, totals, customer fields, token}
     stores/{sid}/customers/{phone} {name, phone, email, gov, city, address, orders, spent, firstAt, lastAt}
     stores/{sid}/stats/{YYYY-MM-DD} {views, visitors, orders, revenue}
     media/{id}              {sid, owner, mime, d (base64), w, h, size, createdAt}
   An order is one commit: the order, the store's order counter (guarded by the store's
   updateTime), each stock-tracked product (guarded), the customer and the day's numbers.
   ============================================================ */

var STORE_LIMIT = 3;
var SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
var RESERVED = ('api admin dashboard design pricing terms privacy contact m sf ds icons assets demo static login logout signin signup '
  + 'account accounts settings help about blog store stores shop app www mail support offline manifest sw favicon robots sitemap cdn media '
  + 'seif design-by-seif null undefined new edit preview checkout cart order orders track www2 home index root system dbs').split(' ');
var ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
var PHONE_RE = /^01[0125]\d{8}$/;
var GOV_NAMES = SK_GOVS.map(function(g){ return g[0]; });
var STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

function rid(n){ return b64url(crypto.getRandomValues(new Uint8Array(n || 9))).replace(/[-_]/g, 'x'); }
function str(v, max){ return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 200); }
function num(v, lo, hi){ v = +v; if(!isFinite(v)) return 0; return Math.max(lo == null ? 0 : lo, Math.min(hi == null ? 1e7 : hi, Math.round(v * 100) / 100)); }
function arr(v){ return Array.isArray(v) ? v : []; }
function parseJ(s, d){ try { var v = JSON.parse(s); return v == null ? d : v; } catch(e){ return d; } }
function dayKey(t){ return new Date(t || Date.now()).toISOString().slice(0, 10); }
function digitsOnly(s){ return String(s || '').replace(/[٠-٩]/g, function(d){ return d.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function(d){ return d.charCodeAt(0) - 1776; }); }
function normPhone(s){ var d = digitsOnly(s).replace(/\D/g, ''); if(/^0020/.test(d)) d = d.slice(4); else if(/^20(1\d{9})$/.test(d)) d = d.slice(2); if(/^1\d{9}$/.test(d)) d = '0' + d; return d; }
function slugOk(s){ return SLUG_RE.test(s) && RESERVED.indexOf(s) < 0 && s.indexOf('--') < 0; }
function handleOf(t){ return String(t || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'; }
function canPublish(env, account){ return isOwner(env, account) || isActive(account); }

/* ---------- stored shapes <-> API shapes ---------- */
function storeOut(d){
  return { sid: d.sid, owner: d.owner, slug: d.slug, name: d.name, published: !!d.published, lang: d.lang || 'en', logo: d.logo || '',
           theme: skNormTheme(parseJ(d.themeJson, null)), settings: parseJ(d.settingsJson, {}), discounts: parseJ(d.discountsJson, []),
           orderSeq: d.orderSeq || 1000, createdAt: d.createdAt || 0, updatedAt: d.updatedAt || 0 };
}
function productOut(d){
  return { pid: d.pid, title: d.title || '', handle: d.handle || d.pid, description: d.description || '', price: +d.price || 0, compareAt: +d.compareAt || 0,
           cost: +d.cost || 0, category: d.category || '', tags: d.tags || '', status: d.status === 'draft' ? 'draft' : 'active', featured: !!d.featured,
           images: parseJ(d.imagesJson, []), options: parseJ(d.optionsJson, []), variants: parseJ(d.variantsJson, []), variantImages: parseJ(d.variantImagesJson, {}),
           trackStock: !!d.trackStock, stock: d.stock == null ? null : +d.stock, sizeGuide: d.sizeGuide || '', designKey: d.designKey || '', sort: +d.sort || 0,
           createdAt: d.createdAt || 0, updatedAt: d.updatedAt || 0, isNew: (d.createdAt || 0) > Date.now() - 14 * 864e5 };
}
function productDoc(p){
  return { pid: p.pid, title: p.title, handle: p.handle, description: p.description, price: p.price, compareAt: p.compareAt, cost: p.cost, category: p.category,
           tags: p.tags, status: p.status, featured: p.featured, imagesJson: JSON.stringify(p.images), optionsJson: JSON.stringify(p.options),
           variantsJson: JSON.stringify(p.variants), variantImagesJson: JSON.stringify(p.variantImages), trackStock: p.trackStock, stock: p.stock,
           sizeGuide: p.sizeGuide, designKey: p.designKey, sort: p.sort, createdAt: p.createdAt, updatedAt: p.updatedAt };
}
function orderOut(d){
  var o = Object.assign({}, d);
  o.items = parseJ(d.itemsJson, []); o.timeline = parseJ(d.timelineJson, []);
  delete o.itemsJson; delete o.timelineJson;
  o.oid = String(d.number);
  return o;
}

/* ---------- what merchants send, cleaned ---------- */
function cleanProduct(b, prev){
  var p = { pid: prev ? prev.pid : rid(9) };
  p.title = str(b.title, 120) || 'Untitled';
  p.description = str(b.description, 6000);
  p.price = num(b.price, 0, 1e6); p.compareAt = num(b.compareAt, 0, 1e6); p.cost = num(b.cost, 0, 1e6);
  p.category = str(b.category, 40); p.tags = str(b.tags, 200);
  p.status = b.status === 'draft' ? 'draft' : 'active';
  p.featured = !!b.featured;
  p.images = arr(b.images).map(String).filter(function(u){ return SK.safeUrl(u) && u.indexOf('data:') !== 0; }).slice(0, 12);
  var seenO = {};
  p.options = arr(b.options).slice(0, 3).map(function(o){
    var vals = [], seen = {};
    arr(o && o.values).forEach(function(v){ v = str(v, 40); if(v && !seen[v.toLowerCase()]){ seen[v.toLowerCase()] = 1; vals.push(v); } });
    return { name: str(o && o.name, 30) || 'Option', values: vals.slice(0, 30) };
  }).filter(function(o){ if(!o.values.length || seenO[o.name.toLowerCase()]) return false; seenO[o.name.toLowerCase()] = 1; return true; });
  var combos = {};
  p.variants = !p.options.length ? [] : arr(b.variants).slice(0, 200).map(function(v){
    v = v || {};
    return { id: /^[A-Za-z0-9_-]{1,24}$/.test(String(v.id || '')) ? String(v.id) : rid(6),
             o: p.options.map(function(op, i){ return str(v.o && v.o[i], 40); }),
             price: v.price === null || v.price === undefined || v.price === '' ? null : num(v.price, 0, 1e6),
             stock: v.stock === null || v.stock === undefined || v.stock === '' ? null : Math.round(num(v.stock, 0, 1e6)),
             sku: str(v.sku, 40) };
  }).filter(function(v){
    var ok = v.o.every(function(x, i){ return p.options[i].values.indexOf(x) >= 0; }), key = v.o.join('\u0001');
    if(!ok || combos[key]) return false; combos[key] = 1; return true;
  });
  p.variantImages = {};
  var vi = b.variantImages && typeof b.variantImages === 'object' ? b.variantImages : {};
  Object.keys(vi).slice(0, 60).forEach(function(k){ var u = String(vi[k] || ''); if(SK.safeUrl(u) && u.indexOf('data:') !== 0 && p.options.some(function(o){ return o.values.indexOf(k) >= 0; })) p.variantImages[k] = u; });
  p.trackStock = !!b.trackStock;
  p.stock = b.stock === null || b.stock === undefined || b.stock === '' ? null : Math.round(num(b.stock, 0, 1e6));
  p.sizeGuide = str(b.sizeGuide, 2000);
  p.designKey = str(b.designKey, 200);
  p.sort = Math.round(num(b.sort, -1e6, 1e6));
  p.handle = handleOf(b.handle || p.title);
  p.createdAt = prev ? prev.createdAt || Date.now() : Date.now();
  p.updatedAt = Date.now();
  return p;
}
function cleanSettings(b){
  b = b && typeof b === 'object' ? b : {};
  var c = b.contact || {}, po = b.policies || {}, sh = b.shipping || {}, co = b.checkout || {};
  var govs = {};
  Object.keys(sh.govs || {}).forEach(function(g){ if(GOV_NAMES.indexOf(g) < 0) return; var v = sh.govs[g]; if(v === false) govs[g] = false; else if(v !== null && v !== '' && isFinite(+v)) govs[g] = num(v, 0, 1e5); });
  return {
    contact: { whatsapp: str(c.whatsapp, 30), phone: str(c.phone, 30), email: str(c.email, 120), instagram: str(c.instagram, 120), facebook: str(c.facebook, 200), tiktok: str(c.tiktok, 120), address: str(c.address, 300) },
    about: str(b.about, 3000),
    policies: { returns: str(po.returns, 6000), shipping: str(po.shipping, 6000), privacy: str(po.privacy, 8000), terms: str(po.terms, 8000) },
    shipping: { flat: num(sh.flat, 0, 1e5), freeOver: num(sh.freeOver, 0, 1e7), govs: govs },
    checkout: { codFee: num(co.codFee, 0, 1e4), email: ['optional', 'required', 'hidden'].indexOf(co.email) >= 0 ? co.email : 'optional', notes: co.notes !== false },
    seo: { description: str(b.seo && b.seo.description, 300) }
  };
}
function cleanDiscounts(list, prev){
  var used = {}, seen = {};
  arr(prev).forEach(function(d){ used[d.code] = +d.uses || 0; });
  return arr(list).slice(0, 60).map(function(d){
    d = d || {};
    var code = str(d.code, 30).toUpperCase().replace(/\s+/g, '');
    return { code: code, type: ['percent', 'fixed', 'ship'].indexOf(d.type) >= 0 ? d.type : 'percent', value: d.type === 'percent' ? num(d.value, 0, 100) : num(d.value, 0, 1e6),
             min: num(d.min, 0, 1e7), maxUses: Math.round(num(d.maxUses, 0, 1e7)), uses: used[code] || 0, endsAt: /^\d{4}-\d\d-\d\d/.test(String(d.endsAt || '')) ? String(d.endsAt).slice(0, 16) : '',
             active: d.active !== false };
  }).filter(function(d){ if(!/^[A-Z0-9_\-؀-ۿ]{2,30}$/.test(d.code) || seen[d.code]) return false; seen[d.code] = 1; return true; });
}
function cleanTheme(t){
  var th = skNormTheme(t && typeof t === 'object' ? JSON.parse(JSON.stringify(t)) : null);
  th.sections = th.sections.slice(0, 30);
  var s = JSON.stringify(th);
  if(s.length > 160000) throw new HttpError(413, 'theme too large');
  return s;
}
function defaultSettings(lang){
  var ar = lang === 'ar';
  return cleanSettings({
    policies: { returns: ar ? 'تقدر تستبدل أي قطعة خلال ١٤ يوم من الاستلام بشرط تكون بحالتها الأصلية. كلّمنا على واتساب وهنرتب الاستبدال.' : 'You can exchange any piece within 14 days of delivery, as long as it is unworn with its tags. Message us and we will arrange it.',
                shipping: ar ? 'التوصيل خلال ٢–٤ أيام عمل للقاهرة والجيزة، و٣–٦ أيام لباقي المحافظات. الدفع كاش عند الاستلام.' : 'Delivery in 2–4 working days in Cairo and Giza, 3–6 days elsewhere. Pay in cash on delivery.' },
    shipping: { flat: 60, freeOver: 0, govs: {} }, checkout: { codFee: 0, email: 'optional', notes: true }
  });
}
/* an Arabic store starts with Arabic words: the theme's look, the Souk theme's copy */
function themeForNewStore(id, lang){
  var th = skNewTheme(id);
  if(lang === 'ar' && th.id !== 'souk'){
    var heroLayout = (th.sections.filter(function(x){ return x.type === 'hero'; })[0] || {}).layout;
    th.sections = skNewTheme('souk').sections.map(function(x){ if(x.type === 'hero' && heroLayout) x.layout = heroLayout; return x; });
    th.s.announce.text = SK_THEMES.souk.s.announce.text;
  }
  return th;
}

/* ---------- each store's data, kept briefly in memory per worker instance ---------- */
var SF_CACHE = {}, SF_TTL = 20e3;
function bust(slug){ delete SF_CACHE[slug]; }
async function storeBundle(env, store, slug, fresh){
  var c = SF_CACHE[slug];
  if(!fresh && c && c.t > Date.now() - SF_TTL) return c.b;
  var b = null, sl = await store.get('slugs', slug);
  if(sl){
    var sd = await store.get('stores', sl.data.sid);
    if(sd && sd.data.slug === slug){
      var r = await Promise.all([store.list('stores/' + sd.data.sid + '/products', { pageSize: 300, maxPages: 3 }), store.get('accounts', sd.data.owner)]);
      var acct = r[1] ? r[1].data : null;
      b = { sid: sd.data.sid, doc: sd, st: storeOut(sd.data), products: r[0].map(productOut).sort(function(x, y){ return (x.sort - y.sort) || (y.createdAt - x.createdAt); }),
            ownerActive: canPublish(env, acct) };
    }
  }
  var keys = Object.keys(SF_CACHE); if(keys.length > 300) keys.slice(0, 100).forEach(function(k){ delete SF_CACHE[k]; });
  SF_CACHE[slug] = { t: Date.now(), b: b };
  return b;
}
function storeLive(B){ return !!(B && B.st.published && B.ownerActive); }

/* ---------- photos ---------- */
async function mediaRoute(request, env, ctx, mid){
  if(!ID_RE.test(mid)) return new Response('Not found', { status: 404 });
  var cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(new URL('/m/' + mid, request.url).toString());
  if(cache){ var hit = await cache.match(key); if(hit) return hit; }
  var d = await db(env).get('media', mid);
  if(!d || !d.data.d) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  var bytes = Uint8Array.from(atob(d.data.d), function(ch){ return ch.charCodeAt(0); });
  var res = new Response(bytes, { headers: { 'Content-Type': d.data.mime || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  if(cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

/* ---------- a store's pages ---------- */
function htmlRes(html, status, priv){
  return new Response(html, { status: status || 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': priv ? 'private, no-store' : 'public, max-age=0, must-revalidate',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });
}
function noStorePage(slug){
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title><meta name="robots" content="noindex">'
    + '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FFFFFF;color:#241C14;font:16px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:24px}'
    + 'h1{font:400 44px/1 Georgia,serif;margin:0 0 12px}a{color:#9A6A3C}</style></head><body><div><h1>Nothing here.</h1><p>There is no store at /' + SK.esc(slug) + ' yet.</p>'
    + '<p><a href="/">Make one with Design by Seif →</a></p></div></body></html>';
}
async function storefront(request, env, ctx, u){
  var store = db(env), parts = u.pathname.split('/').filter(Boolean).map(function(x){ try { return decodeURIComponent(x); } catch(e){ return x; } });
  var slug = parts[0], rest = parts.slice(1);
  var B = await storeBundle(env, store, slug);
  if(!B) return htmlRes(noStorePage(slug), 404);
  var uid = (request.headers.get('Cookie') || '').indexOf('ss_session=') >= 0 ? await cookieUid(env, request) : null;
  var ownerView = !!uid && uid === B.st.owner, live = storeLive(B);
  var st = B.st, products = B.products.filter(function(p){ return p.status === 'active'; });
  var ctxR = { theme: st.theme, settings: st.settings, lang: st.lang, base: '/' + slug, products: products, storeName: st.name, logoUrl: st.logo,
               origin: u.origin, sid: st.sid, slug: slug, v: SF_V, sfBase: '/sf/', ownerPreview: !live && ownerView, page: 'home', seo: st.settings.seo };
  if(!live && !ownerView){ ctxR.page = 'closed'; return htmlRes(SK.page(ctxR), 200, true); }
  var status = 200, priv = ownerView;
  var r0 = rest[0] || '';
  if(!rest.length) ctxR.page = 'home';
  else if(r0 === 'shop' && rest.length === 1){ ctxR.page = 'shop'; ctxR.query = { c: str(u.searchParams.get('c'), 40), q: str(u.searchParams.get('q'), 60), s: str(u.searchParams.get('s'), 10) }; }
  else if(r0 === 'p' && rest.length === 2){
    ctxR.page = 'product';
    ctxR.product = products.filter(function(p){ return p.handle === rest[1] || p.pid === rest[1]; })[0] || null;
    if(!ctxR.product) status = 404;
  }
  else if(r0 === 'cart' && rest.length === 1) ctxR.page = 'cart';
  else if(r0 === 'checkout' && rest.length === 1){ ctxR.page = 'checkout'; priv = true; }
  else if(r0 === 'track' && rest.length === 1) ctxR.page = 'track';
  else if(r0 === 'pages' && rest.length === 2){ ctxR.page = 'info'; ctxR.pageId = rest[1]; }
  else if(r0 === 'order' && rest.length === 2 && /^\d{1,9}$/.test(rest[1])){
    ctxR.page = 'order'; priv = true;
    var od = await store.get('stores/' + st.sid + '/orders', rest[1]);
    if(od && safeEq(od.data.token, u.searchParams.get('k') || '')) ctxR.order = orderOut(od.data);
    else status = 404;
  }
  else { ctxR.page = '404'; status = 404; }
  ctxR.canonical = u.origin + u.pathname;
  return htmlRes(SK.page(ctxR), status, priv);
}

/* ---------- shoppers ---------- */
function shipFee(settings, gov, after, discount){
  var sh = settings.shipping || {}, g = (sh.govs || {})[gov];
  if(g === false) return false;
  var fee = g != null && isFinite(+g) ? +g : (+sh.flat || 0);
  if(sh.freeOver && after >= sh.freeOver) fee = 0;
  if(discount && discount.type === 'ship') fee = 0;
  return fee;
}
function findDiscount(discounts, code){
  code = str(code, 30).toUpperCase().replace(/\s+/g, '');
  if(!code) return null;
  var d = arr(discounts).filter(function(x){ return x.code === code; })[0];
  if(!d || d.active === false) return null;
  if(d.endsAt && Date.parse(d.endsAt) < Date.now()) return null;
  if(d.maxUses && (d.uses || 0) >= d.maxUses) return null;
  return d;
}
function discountAmount(d, sub){
  if(!d || (d.min && sub < d.min)) return 0;
  if(d.type === 'percent') return Math.round(sub * Math.min(100, d.value) / 100 * 100) / 100;
  if(d.type === 'fixed') return Math.min(sub, d.value);
  return 0;
}
async function placeOrder(request, env, ctx, store, slug, ip){
  if(limited(ip, 'order', 12, 3600e3)) return json(429, { error: 'too many orders' });
  var b = await body(request);
  if(b.website) return json(400, { error: 'rejected' });                       /* the hidden field only robots fill */
  var B = await storeBundle(env, store, slug, true);
  if(!B) return json(404, { error: 'no such store' });
  var uid = (request.headers.get('Cookie') || '').indexOf('ss_session=') >= 0 ? await cookieUid(env, request) : null;
  var test = !!uid && uid === B.st.owner;
  if(!storeLive(B) && !test) return json(409, { error: 'closed' });
  var st = B.st, settings = st.settings || {};
  var c = { name: str(b.name, 80), phone: normPhone(b.phone), email: str(b.email, 120), gov: str(b.gov, 40), city: str(b.city, 80), address: str(b.address, 200),
            landmark: str(b.landmark, 120), notes: (settings.checkout || {}).notes === false ? '' : str(b.notes, 400) };
  if(!c.name || !c.city || !c.address) return json(400, { error: 'missing' });
  if(!PHONE_RE.test(c.phone)) return json(400, { error: 'phone' });
  if(GOV_NAMES.indexOf(c.gov) < 0) return json(400, { error: 'gov' });
  if(c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return json(400, { error: 'email' });
  if((settings.checkout || {}).email === 'required' && !c.email) return json(400, { error: 'email' });
  var want = {}, order = [];
  arr(b.items).slice(0, 40).forEach(function(it){
    if(!it || !ID_RE.test(String(it.pid || ''))) return;
    var k = it.pid + '|' + str(it.vid, 24) + '|' + str(it.opts, 120);
    if(!want[k]){ want[k] = { pid: String(it.pid), vid: str(it.vid, 24), opts: str(it.opts, 120), qty: 0 }; order.push(k); }
    want[k].qty = Math.min(99, want[k].qty + Math.max(1, Math.min(99, Math.floor(+it.qty || 1))));
  });
  if(!order.length) return json(400, { error: 'empty' });
  var pcol = 'stores/' + st.sid + '/products';
  for(var attempt = 0; attempt < 6; attempt++){
    var sd = await store.get('stores', st.sid);
    if(!sd) return json(404, { error: 'no such store' });
    var pids = []; order.forEach(function(k){ if(pids.indexOf(want[k].pid) < 0) pids.push(want[k].pid); });
    var docs = await store.getMany(pcol, pids), byPid = {};
    pids.forEach(function(pid, i){ byPid[pid] = docs[i]; });
    var lines = [], short = [], touched = {};
    order.forEach(function(k){
      var w = want[k], doc = byPid[w.pid];
      if(!doc){ short.push({ pid: w.pid, vid: w.vid, left: 0 }); return; }
      var p = touched[w.pid] ? touched[w.pid].p : productOut(doc.data);
      if(p.status !== 'active'){ short.push({ pid: w.pid, vid: w.vid, left: 0 }); return; }
      var v = null;
      if(p.variants.length){ v = p.variants.filter(function(x){ return x.id === w.vid; })[0]; if(!v){ short.push({ pid: w.pid, vid: w.vid, left: 0 }); return; } }
      var price = v && v.price != null ? +v.price : p.price;
      if(p.trackStock){
        var have = v ? (v.stock == null ? Infinity : v.stock) : (p.stock == null ? Infinity : p.stock);
        if(have < w.qty){ short.push({ pid: w.pid, vid: w.vid, left: have === Infinity ? 99 : Math.max(0, have) }); return; }
        if(have !== Infinity){ if(v) v.stock = have - w.qty; else p.stock = have - w.qty; touched[w.pid] = { p: p, doc: doc }; }
      }
      var img = '';
      if(v && v.o) v.o.forEach(function(x){ if(!img && p.variantImages[x]) img = p.variantImages[x]; });
      lines.push({ pid: p.pid, vid: v ? v.id : '', title: p.title, variant: v ? v.o.join(' / ') : w.opts, price: price, qty: w.qty, image: img || p.images[0] || '', handle: p.handle });
    });
    if(short.length) return json(409, { error: 'stock', lines: short });
    var stNow = storeOut(sd.data), sub = lines.reduce(function(s, l){ return s + l.price * l.qty; }, 0);
    var disc = null;
    if(b.code){ disc = findDiscount(stNow.discounts, b.code); if(!disc) return json(400, { error: 'code' }); }
    var dAmt = discountAmount(disc, sub);
    var ship = shipFee(stNow.settings, c.gov, sub - dAmt, disc && (!disc.min || sub >= disc.min) ? disc : null);
    if(ship === false) return json(400, { error: 'gov' });
    var cod = +((stNow.settings.checkout || {}).codFee || 0);
    var total = Math.round((sub - dAmt + ship + cod) * 100) / 100;
    var number = (sd.data.orderSeq || 1000) + 1, now = Date.now(), token = rid(12);
    var od = Object.assign({ number: number, status: 'new', createdAt: now, updatedAt: now, itemsJson: JSON.stringify(lines), subtotal: sub, discount: dAmt,
                             code: disc && dAmt + (disc.type === 'ship' ? 1 : 0) > 0 ? disc.code : '', shipping: ship, codFee: cod, total: total, token: token,
                             timelineJson: JSON.stringify([{ t: now, s: 'new' }]), test: test, qty: lines.reduce(function(s, l){ return s + l.qty; }, 0) }, c);
    var storeUpd = { orderSeq: number, updatedAt: sd.data.updatedAt || now }, fields = ['orderSeq'];
    if(disc){ stNow.discounts.forEach(function(x){ if(x.code === disc.code) x.uses = (x.uses || 0) + 1; }); storeUpd.discountsJson = JSON.stringify(stNow.discounts); fields.push('discountsJson'); }
    var writes = [
      { col: 'stores', id: st.sid, data: storeUpd, fields: fields, updateTime: sd.updateTime },
      { col: 'stores/' + st.sid + '/orders', id: String(number), data: od, exists: false }
    ];
    Object.keys(touched).forEach(function(pid){
      var t = touched[pid];
      writes.push({ col: pcol, id: pid, data: { variantsJson: JSON.stringify(t.p.variants), stock: t.p.stock }, fields: ['variantsJson', 'stock'], updateTime: t.doc.updateTime });
    });
    if(!test){
      var cust = { phone: c.phone, name: c.name, email: c.email, gov: c.gov, city: c.city, address: c.address, lastAt: now, lastOrder: number };
      var custRow = await store.get('stores/' + st.sid + '/customers', c.phone);
      if(!custRow) cust.firstAt = now;
      writes.push({ col: 'stores/' + st.sid + '/customers', id: c.phone, data: cust, fields: Object.keys(cust), inc: { orders: 1, spent: total } });
      writes.push({ col: 'stores/' + st.sid + '/stats', id: dayKey(now), data: {}, fields: [], inc: { orders: 1, revenue: total } });
    }
    try { await store.commit(writes); }
    catch(e){ if(retryable(e)) continue; throw e; }
    bust(slug);
    if(!test) logEvent(ctx, store, { type: 'store_order', uid: st.owner, detail: slug + ' #' + number + ' · ' + total + ' EGP' });
    return json(200, { ok: true, oid: String(number), number: number, token: token, total: total });
  }
  return json(503, { error: 'busy, try again' });
}
async function shopperRoute(request, env, ctx, store, p, u, ip){
  var mm = /^\/api\/s\/([a-z0-9-]{3,40})\/(order|discount|track|hit)$/.exec(p), m = request.method;
  if(!mm) return json(404, { error: 'not found' });
  var slug = mm[1], what = mm[2];
  if(what === 'order' && m === 'POST') return placeOrder(request, env, ctx, store, slug, ip);
  if(what === 'discount' && m === 'POST'){
    if(limited(ip, 'discount', 40, 3600e3)) return json(429, { error: 'too many attempts' });
    var b = await body(request), B = await storeBundle(env, store, slug);
    if(!B) return json(404, { error: 'no such store' });
    var d = findDiscount(B.st.discounts, b.code);
    if(!d) return json(200, { ok: false });
    return json(200, { ok: true, code: d.code, type: d.type, value: d.value, min: d.min || 0 });
  }
  if(what === 'track' && m === 'GET'){
    if(limited(ip, 'track', 30, 3600e3)) return json(429, { error: 'too many attempts' });
    var n = String(u.searchParams.get('n') || '').replace(/\D/g, ''), ph = normPhone(u.searchParams.get('phone'));
    var B2 = await storeBundle(env, store, slug);
    if(!B2 || !/^\d{1,9}$/.test(n) || !PHONE_RE.test(ph)) return json(200, { ok: false });
    var od = await store.get('stores/' + B2.sid + '/orders', n);
    if(!od || !safeEq(od.data.phone, ph)) return json(200, { ok: false });
    var o = orderOut(od.data);
    return json(200, { ok: true, order: { number: o.number, status: o.status, createdAt: o.createdAt, total: o.total,
      items: o.items.map(function(it){ return { title: it.title, variant: it.variant, qty: it.qty, price: it.price, image: it.image }; }) } });
  }
  if(what === 'hit' && m === 'POST'){
    if(limited(ip, 'hit', 900, 3600e3)) return new Response(null, { status: 204 });
    var hb = {}; try { hb = JSON.parse(await bodyText(request, 2000) || '{}'); } catch(e){}
    var B3 = await storeBundle(env, store, slug);
    if(B3 && storeLive(B3)){
      var inc = { views: 1 }; if(hb.n) inc.visitors = 1;
      var pr = store.commit([{ col: 'stores/' + B3.sid + '/stats', id: dayKey(), data: {}, fields: [], inc: inc }]).catch(function(){});
      if(ctx && ctx.waitUntil) ctx.waitUntil(pr);
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  return json(405, { error: 'method not allowed' });
}

/* ---------- merchants ---------- */
async function myStores(store, uid){
  var rows = await store.query('stores', 'owner', uid, 50);
  return rows.map(function(d){ return { sid: d.sid, slug: d.slug, name: d.name, published: !!d.published, lang: d.lang || 'en', logo: d.logo || '',
    theme: (parseJ(d.themeJson, {}) || {}).id || 'atelier', createdAt: d.createdAt || 0, orderSeq: d.orderSeq || 1000 }; }).sort(function(a, b){ return a.createdAt - b.createdAt; });
}
async function merchantRoute(request, env, ctx, store, uid, account, p, u, ip){
  var m = request.method, platformOwner = isOwner(env, account);
  if(p === '/api/slug' && m === 'GET'){
    var s = str(u.searchParams.get('s'), 60).toLowerCase();
    if(!SLUG_RE.test(s) || s.indexOf('--') >= 0) return json(200, { ok: false, reason: 'invalid' });
    if(RESERVED.indexOf(s) >= 0) return json(200, { ok: false, reason: 'reserved' });
    var taken = await store.get('slugs', s);
    return json(200, taken ? { ok: false, reason: 'taken', mine: taken.data.owner === uid } : { ok: true });
  }
  if(p === '/api/stores' && m === 'GET') return json(200, { stores: await myStores(store, uid), canPublish: canPublish(env, account) });
  if(p === '/api/stores' && m === 'POST'){
    if(limited(ip, 'store-create', 10, 3600e3)) return json(429, { error: 'too many attempts' });
    var b = await body(request), mine = await myStores(store, uid);
    if(!platformOwner && mine.length >= STORE_LIMIT) return json(409, { error: 'You can run up to ' + STORE_LIMIT + ' stores on one account.' });
    var slug = str(b.slug, 60).toLowerCase(), name = str(b.name, 60), lang = b.lang === 'ar' ? 'ar' : 'en';
    if(!name) return json(400, { error: 'Give your store a name.' });
    if(!slugOk(slug)) return json(400, { error: 'That web address is not available.' });
    var sid = rid(9), now = Date.now(), th = themeForNewStore(SK_THEMES[b.theme] ? b.theme : 'atelier', lang);
    var doc = { sid: sid, owner: uid, ownerEmail: account.email || '', slug: slug, name: name, published: false, lang: lang, themeJson: JSON.stringify(th),
                settingsJson: JSON.stringify(defaultSettings(lang)), discountsJson: '[]', orderSeq: 1000, logo: '', createdAt: now, updatedAt: now };
    try {
      await store.commit([{ col: 'slugs', id: slug, data: { sid: sid, owner: uid, at: now }, exists: false }, { col: 'stores', id: sid, data: doc, exists: false }]);
    } catch(e){ if(e.dbStatus === 'ALREADY_EXISTS' || e.dbStatus === 'FAILED_PRECONDITION') return json(409, { error: 'That web address was just taken — try another.' }); throw e; }
    bust(slug);
    if(!platformOwner) logEvent(ctx, store, { type: 'store_created', uid: uid, email: account.email, detail: slug + ' · ' + (b.theme || 'atelier') });
    return json(200, { store: storeOut(doc) });
  }
  var mm = /^\/api\/stores\/([A-Za-z0-9_-]{6,32})(?:\/(products|media|orders|customers|stats)(?:\/([A-Za-z0-9_-]{1,32}))?)?$/.exec(p);
  if(!mm) return json(404, { error: 'not found' });
  var sid = mm[1], sub = mm[2], id = mm[3];
  var sd = await store.get('stores', sid);
  if(!sd || (sd.data.owner !== uid && !platformOwner)) return json(404, { error: 'no such store' });
  var st = storeOut(sd.data), slugNow = st.slug;

  if(!sub){
    if(m === 'GET') return json(200, { store: st, canPublish: canPublish(env, account) });
    if(m !== 'PATCH') return json(405, { error: 'method not allowed' });
    var pb = await body(request), upd = { updatedAt: Date.now() }, writes = [];
    if(pb.name !== undefined){ upd.name = str(pb.name, 60) || st.name; }
    if(pb.lang !== undefined) upd.lang = pb.lang === 'ar' ? 'ar' : 'en';
    if(pb.logo !== undefined){ var lg = String(pb.logo || ''); upd.logo = lg && SK.safeUrl(lg) && lg.indexOf('data:') !== 0 ? lg : ''; }
    if(pb.theme !== undefined) upd.themeJson = cleanTheme(pb.theme);
    if(pb.settings !== undefined){ var ss = JSON.stringify(cleanSettings(pb.settings)); if(ss.length > 120000) return json(413, { error: 'settings too large' }); upd.settingsJson = ss; }
    if(pb.discounts !== undefined) upd.discountsJson = JSON.stringify(cleanDiscounts(pb.discounts, st.discounts));
    if(pb.published !== undefined){
      if(pb.published && !canPublish(env, account)) return json(402, { error: 'membership', message: 'Publishing needs an active membership.' });
      upd.published = !!pb.published;
    }
    if(pb.slug !== undefined && pb.slug !== st.slug){
      var ns = str(pb.slug, 60).toLowerCase();
      if(!slugOk(ns)) return json(400, { error: 'That web address is not available.' });
      upd.slug = ns;
      writes.push({ col: 'slugs', id: ns, data: { sid: sid, owner: sd.data.owner, at: Date.now() }, exists: false }, { col: 'slugs', id: st.slug, del: true });
    }
    writes.unshift({ col: 'stores', id: sid, data: upd, fields: Object.keys(upd) });
    try { await store.commit(writes); }
    catch(e){ if(upd.slug && (e.dbStatus === 'ALREADY_EXISTS' || e.dbStatus === 'FAILED_PRECONDITION')) return json(409, { error: 'That web address is taken.' }); throw e; }
    bust(slugNow); if(upd.slug) bust(upd.slug);
    if(pb.published !== undefined && !!pb.published !== st.published && !platformOwner) logEvent(ctx, store, { type: pb.published ? 'store_published' : 'store_unpublished', uid: uid, email: account.email, detail: upd.slug || slugNow });
    var fresh = await store.get('stores', sid);
    return json(200, { store: storeOut(fresh.data) });
  }

  var pcol = 'stores/' + sid + '/products';
  if(sub === 'products'){
    if(!id && m === 'GET'){
      var rows = await store.list(pcol, { pageSize: 300, maxPages: 3 });
      return json(200, { products: rows.map(productOut).sort(function(a, b){ return (a.sort - b.sort) || (b.createdAt - a.createdAt); }) });
    }
    if(!id && m === 'POST'){
      if(limited(ip, 'product', 300, 3600e3)) return json(429, { error: 'too many changes, slow down' });
      var all = await store.list(pcol, { mask: ['handle'], pageSize: 300, maxPages: 3 });
      if(all.length >= 500) return json(409, { error: 'A store can hold up to 500 products.' });
      var np = cleanProduct(await body(request), null);
      np.handle = uniqueHandle(np.handle, all.map(function(r){ return r.handle; }));
      await store.commit([{ col: pcol, id: np.pid, data: productDoc(np), exists: false }]);
      bust(slugNow);
      return json(200, { product: productOut(productDoc(np)) });
    }
    if(id && (m === 'PUT' || m === 'DELETE')){
      var pd = await store.get(pcol, id);
      if(!pd) return json(404, { error: 'no such product' });
      if(m === 'DELETE'){ await store.commit([{ col: pcol, id: id, del: true }]); bust(slugNow); return json(200, { ok: true }); }
      var pb2 = await body(request), base = pb2.stockBase && typeof pb2.stockBase === 'object' ? pb2.stockBase : null;
      for(var tries = 0; tries < 4; tries++){
        var cur = productOut(pd.data), up = cleanProduct(pb2, cur);
        if(up.handle !== pd.data.handle){
          var others = (await store.list(pcol, { mask: ['handle', 'pid'], pageSize: 300, maxPages: 3 })).filter(function(r){ return r.pid !== id; });
          up.handle = uniqueHandle(up.handle, others.map(function(r){ return r.handle; }));
        }
        /* orders change stock while the merchant edits: a number they didn't touch takes the live value */
        if(base){
          if(up.stock === (base.s === undefined ? null : base.s)) up.stock = cur.stock;
          var bv = base.v && typeof base.v === 'object' ? base.v : {};
          up.variants.forEach(function(v){
            if(Object.prototype.hasOwnProperty.call(bv, v.id) && v.stock === bv[v.id]){ var cv = cur.variants.filter(function(x){ return x.id === v.id; })[0]; if(cv) v.stock = cv.stock; }
          });
        }
        try { await store.commit([{ col: pcol, id: id, data: productDoc(up), updateTime: pd.updateTime }]); }
        catch(e){ if(!retryable(e)) throw e; pd = await store.get(pcol, id); if(!pd) return json(404, { error: 'no such product' }); continue; }
        bust(slugNow);
        return json(200, { product: productOut(productDoc(up)) });
      }
      return json(503, { error: 'busy, try again' });
    }
    return json(405, { error: 'method not allowed' });
  }
  if(sub === 'media' && m === 'POST'){
    if(limited(ip, 'media', 200, 3600e3)) return json(429, { error: 'too many uploads, slow down' });
    var t = await bodyText(request, 1200000), mb;
    try { mb = JSON.parse(t); } catch(e){ return json(400, { error: 'bad json' }); }
    var mt = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(String(mb.data || ''));
    if(!mt) return json(400, { error: 'send a JPEG, PNG or WebP image' });
    if(mt[2].length > 1000000) return json(413, { error: 'image too large (max ~700 KB after resizing)' });
    var mid = rid(12);
    await store.commit([{ col: 'media', id: mid, data: { sid: sid, owner: sd.data.owner, mime: mt[1], d: mt[2], w: Math.round(num(mb.w, 0, 10000)), h: Math.round(num(mb.h, 0, 10000)), size: mt[2].length, createdAt: Date.now() } }]);
    return json(200, { url: '/m/' + mid });
  }
  var ocol = 'stores/' + sid + '/orders';
  if(sub === 'orders'){
    if(!id && m === 'GET'){
      var orders = await store.list(ocol, { orderBy: 'createdAt desc', pageSize: 300, maxPages: 1 });
      return json(200, { orders: orders.map(orderOut) });
    }
    if(id && /^\d{1,9}$/.test(id)){
      var od = await store.get(ocol, id);
      if(!od) return json(404, { error: 'no such order' });
      if(m === 'GET') return json(200, { order: orderOut(od.data) });
      if(m !== 'PATCH') return json(405, { error: 'method not allowed' });
      var ob = await body(request);
      for(var attempt = 0; attempt < 5; attempt++){
        var o = orderOut(od.data), oupd = { updatedAt: Date.now() }, ow = [];
        if(ob.note !== undefined) oupd.noteInternal = str(ob.note, 2000);
        if(ob.status !== undefined && STATUSES.indexOf(ob.status) >= 0 && ob.status !== o.status){
          o.timeline.push({ t: Date.now(), s: ob.status });
          oupd.status = ob.status; oupd.timelineJson = JSON.stringify(o.timeline.slice(-30));
          /* cancelling gives the stock back; un-cancelling takes it again (if it is still there) */
          var dir = ob.status === 'cancelled' ? 1 : (o.status === 'cancelled' ? -1 : 0);
          if(dir){
            var opids = []; o.items.forEach(function(it){ if(opids.indexOf(it.pid) < 0) opids.push(it.pid); });
            var odocs = await store.getMany(pcol, opids);
            for(var k = 0; k < opids.length; k++){
              var pdoc = odocs[k]; if(!pdoc) continue;
              var pp = productOut(pdoc.data); if(!pp.trackStock) continue;
              o.items.filter(function(it){ return it.pid === opids[k]; }).forEach(function(it){
                var v = it.vid ? pp.variants.filter(function(x){ return x.id === it.vid; })[0] : null;
                if(v){ if(v.stock != null) v.stock = Math.max(0, v.stock + dir * it.qty); }
                else if(!pp.variants.length && pp.stock != null) pp.stock = Math.max(0, pp.stock + dir * it.qty);
              });
              ow.push({ col: pcol, id: pp.pid, data: { variantsJson: JSON.stringify(pp.variants), stock: pp.stock }, fields: ['variantsJson', 'stock'], updateTime: pdoc.updateTime });
            }
            if(!o.test) ow.push({ col: 'stores/' + sid + '/stats', id: dayKey(o.createdAt), data: {}, fields: [], inc: { cancelled: dir, revenue: -dir * (+o.total || 0) } });
          }
        }
        try {
          await store.commit([{ col: ocol, id: id, data: oupd, fields: Object.keys(oupd), updateTime: od.updateTime }].concat(ow));
          bust(slugNow);
          var of = await store.get(ocol, id);
          return json(200, { order: orderOut(of.data) });
        } catch(e){ if(!retryable(e)) throw e; od = await store.get(ocol, id); if(!od) return json(404, { error: 'no such order' }); }
      }
      return json(503, { error: 'busy, try again' });
    }
    return json(404, { error: 'not found' });
  }
  if(sub === 'customers' && m === 'GET'){
    var custs = await store.list('stores/' + sid + '/customers', { orderBy: 'lastAt desc', pageSize: 300, maxPages: 5 });
    return json(200, { customers: custs });
  }
  if(sub === 'stats' && m === 'GET'){
    var nd = Math.max(1, Math.min(90, Math.round(+u.searchParams.get('days') || 30))), days = [];
    for(var di = nd - 1; di >= 0; di--) days.push(dayKey(Date.now() - di * 864e5));
    var rowsS = await store.getMany('stores/' + sid + '/stats', days);
    return json(200, { days: days.map(function(dk, i){ return Object.assign({ day: dk, views: 0, visitors: 0, orders: 0, revenue: 0, cancelled: 0 }, rowsS[i] ? rowsS[i].data : {}); }) });
  }
  return json(404, { error: 'not found' });
}
function uniqueHandle(h, taken){
  var set = {}; taken.forEach(function(x){ if(x) set[x] = 1; });
  if(!set[h]) return h;
  for(var i = 2; i < 1000; i++) if(!set[h + '-' + i]) return h + '-' + i;
  return h + '-' + rid(3);
}
/* the owner's view of every store */
async function adminStores(store){
  var rows = await store.list('stores', { mask: ['sid', 'slug', 'name', 'owner', 'ownerEmail', 'published', 'createdAt', 'orderSeq', 'lang'], pageSize: 300, maxPages: 10 });
  return rows.sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
}
