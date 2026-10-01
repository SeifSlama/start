/* ============================================================
   STOREFRONT RUNTIME — the only script a store page loads.
   Bag (localStorage), product options, checkout with cash on delivery,
   order tracking, countdowns, and the dashboard's live-preview bridge.
   Reads everything it needs from window.__SK__ (written by the renderer).
   ============================================================ */
(function(){
  'use strict';
  var D = window.__SK__ || {}, T = D.i18n || {}, lang = D.lang || 'en', base = D.base || '';
  var PREVIEW = !!D.preview;
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function t(k, vars){ var v = T[k]; if(v == null) return k; v = String(v); if(vars) Object.keys(vars).forEach(function(n){ v = v.split('{' + n + '}').join(vars[n]); }); return v; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function money(n){ n = Math.round((+n || 0) * 100) / 100; var s = n.toLocaleString('en-US', { maximumFractionDigits: 2 }); return lang === 'ar' ? s + ' ج.م' : s + ' EGP'; }
  function store(k, v){ try { if(v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch(e){ return null; } }
  var IC = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    tee: '<svg viewBox="0 0 200 200" aria-hidden="true"><path fill="currentColor" opacity=".12" d="M74 30c6 10 15 15 26 15s20-5 26-15l38 16 14 34-25 9-6-12v95H53V77l-6 12-25-9 14-34z"/></svg>'
  };

  /* ---------- toast ---------- */
  var toastT;
  function toast(msg){
    var el = $('[data-toast]'); if(!el) return;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function(){ el.classList.remove('on'); }, 2600);
  }

  /* ---------- products ---------- */
  var PRODUCTS = {};
  (D.products || []).forEach(function(p){ PRODUCTS[p.pid] = p; });
  function variantOf(p, vid){ return (p.v || []).filter(function(v){ return v.id === vid; })[0] || null; }
  function priceOf(p, v){ return v && v.p != null ? v.p : p.p; }
  function stockOf(p, v){ if(!p.ts) return Infinity; if(v) return v.s == null ? Infinity : Math.max(0, v.s); return p.s == null ? Infinity : Math.max(0, p.s); }
  function imageOf(p, v){
    if(v && v.o && p.vi){ for(var i = 0; i < v.o.length; i++){ var u = p.vi[v.o[i]]; if(u) return u; } }
    return p.img || '';
  }
  function variantLabel(v){ return v && v.o ? v.o.join(' / ') : ''; }

  /* ---------- the bag ---------- */
  var CART_KEY = 'sk:cart:' + (D.sid || D.slug || 'x') + (PREVIEW ? ':pv' : '');
  function readCart(){
    var c = store(CART_KEY) || [];
    return c.filter(function(l){ var p = PRODUCTS[l.pid]; return p && (!l.vid || variantOf(p, l.vid) || !(p.v || []).length) && l.qty > 0; });
  }
  var cart = readCart();
  function saveCart(){ store(CART_KEY, cart.length ? cart : null); renderCart(); }
  function lineInfo(l){
    var p = PRODUCTS[l.pid], v = l.vid ? variantOf(p, l.vid) : null;
    var label = v ? variantLabel(v) : (l.opts || '');
    return { p: p, v: v, price: priceOf(p, v), title: p.t, label: label, img: imageOf(p, v), max: Math.min(99, stockOf(p, v)) };
  }
  function cartCount(){ return cart.reduce(function(n, l){ return n + l.qty; }, 0); }
  function subtotal(){ return cart.reduce(function(n, l){ return n + lineInfo(l).price * l.qty; }, 0); }
  function addToCart(pid, vid, qty, opts){
    var p = PRODUCTS[pid]; if(!p) return false;
    var v = vid ? variantOf(p, vid) : null, max = Math.min(99, stockOf(p, v));
    var line = cart.filter(function(l){ return l.pid === pid && (l.vid || '') === (vid || '') && (l.opts || '') === (opts || ''); })[0];
    var have = line ? line.qty : 0;
    if(max <= 0){ toast(t('soldOut')); return false; }
    var q = Math.min(max - have, qty);
    if(q <= 0){ toast(t('qtyMax', { n: max })); return false; }
    if(line) line.qty += q; else cart.push({ pid: pid, vid: vid || '', qty: q, opts: opts || '' });
    saveCart();
    var b = $('[data-cart]'); if(b){ b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    if(q < qty) toast(t('qtyMax', { n: max }));
    return true;
  }
  function setQty(i, q){
    var l = cart[i]; if(!l) return;
    var info = lineInfo(l);
    if(q <= 0) cart.splice(i, 1);
    else { if(q > info.max){ q = info.max; toast(t('qtyMax', { n: info.max })); } l.qty = q; }
    saveCart();
  }
  function lineHtml(l, i, mini){
    var x = lineInfo(l);
    var img = x.img ? '<img src="' + esc(x.img) + '" alt="">' : IC.tee;
    return '<div class="cl"><a class="cl-img" href="' + esc(base + '/p/' + encodeURIComponent(x.p.h)) + '">' + img + (mini ? '<span class="q">' + l.qty + '</span>' : '') + '</a>'
      + '<div class="cl-t"><b>' + esc(x.title) + '</b>' + (x.label ? '<small>' + esc(x.label) + '</small>' : '') + (mini ? '' : '<small>' + money(x.price) + '</small>'
      + '<div style="display:flex;align-items:center"><div class="qty"><button type="button" data-lq="' + i + '" data-d="-1" aria-label="−">' + IC.minus + '</button><input type="number" value="' + l.qty + '" min="0" max="99" data-li="' + i + '" inputmode="numeric" aria-label="' + esc(t('quantity')) + '"><button type="button" data-lq="' + i + '" data-d="1" aria-label="+">' + IC.plus + '</button></div><button type="button" class="rm" data-rm="' + i + '">' + esc(t('remove')) + '</button></div>')
      + '</div><span class="cl-p">' + money(x.price * l.qty) + '</span></div>';
  }
  function freeBar(sub){
    var free = D.shipping && D.shipping.free;
    if(!free || !sub) return '';
    var left = Math.max(0, free - sub), pct = Math.min(100, Math.round(sub / free * 100));
    return '<div class="freebar"><span>' + esc(left > 0 ? t('freeLeft', { x: money(left) }) : t('freeOk')) + '</span><i><b style="width:' + pct + '%"></b></i></div>';
  }
  function renderCart(){
    var n = cartCount();
    $$('[data-count]').forEach(function(el){ el.textContent = n; el.hidden = !n; });
    var sub = subtotal(), checkoutPage = D.page === 'checkout';
    $$('[data-lines]').forEach(function(el){
      var mini = el.classList.contains('mini');
      el.innerHTML = cart.length ? cart.map(function(l, i){ return lineHtml(l, i, mini); }).join('')
        : '<div class="cart-empty"><p>' + esc(t('emptyCart')) + '</p>' + (mini ? '' : '<a class="btn btn-main" href="' + esc(base + '/shop') + '">' + esc(t('keepShopping')) + '</a>') + '</div>';
    });
    $$('[data-cart-foot]').forEach(function(el){
      el.innerHTML = cart.length ? freeBar(sub) + '<div class="totals"><div class="tr"><span>' + esc(t('subtotal')) + '</span><span><b>' + money(sub) + '</b></span></div>'
        + '<div class="tr" style="border:0;padding:0;margin:0"><span>' + esc(t('shipping')) + '</span><span>' + esc(t('calcAtCheckout')) + '</span></div></div>'
        + '<a class="btn btn-main btn-block" href="' + esc(base + '/checkout') + '">' + esc(t('checkout')) + '</a>' : '';
    });
    if(checkoutPage) renderTotals();
  }
  function openCart(){ var d = $('#drawer'); if(!d) return; renderCart(); d.classList.add('on'); d.setAttribute('aria-hidden', 'false'); document.documentElement.style.overflow = 'hidden'; }
  function closeCart(){ var d = $('#drawer'); if(!d) return; d.classList.remove('on'); d.setAttribute('aria-hidden', 'true'); document.documentElement.style.overflow = ''; }
  function openMenu(on){ var m = $('#mnav'); if(!m) return; m.classList.toggle('on', on); m.setAttribute('aria-hidden', on ? 'false' : 'true'); document.documentElement.style.overflow = on ? 'hidden' : ''; }

  document.addEventListener('click', function(e){
    var a = e.target.closest('[data-cart]'); if(a){ e.preventDefault(); if(D.page === 'cart' || D.page === 'checkout') go(base + '/cart'); else openCart(); return; }
    if(e.target.closest('[data-cart-x]')){ closeCart(); return; }
    if(e.target.closest('[data-menu]')){ openMenu(true); return; }
    if(e.target.closest('[data-menu-x]')){ openMenu(false); return; }
    var q = e.target.closest('[data-lq]'); if(q){ var i = +q.dataset.lq; setQty(i, (cart[i] ? cart[i].qty : 0) + (+q.dataset.d)); return; }
    var rm = e.target.closest('[data-rm]'); if(rm){ setQty(+rm.dataset.rm, 0); return; }
    var cp = e.target.closest('[data-copy]'); if(cp){
      var code = cp.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function(){ toast(t('copied') + ' · ' + code); }, function(){ toast(code); });
      store('sk:code:' + D.sid, code);
      return;
    }
  });
  document.addEventListener('change', function(e){
    var li = e.target.closest('[data-li]'); if(li){ setQty(+li.dataset.li, Math.max(0, Math.floor(+li.value || 0))); return; }
    var as = e.target.closest('[data-autosubmit]'); if(as && as.form){ if(PREVIEW) previewNav(formHref(as.form)); else as.form.submit(); }
  });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeCart(); openMenu(false); } });

  /* ---------- product page: options, stock, gallery ---------- */
  function initProduct(){
    var p = PRODUCTS[D.product], form = $('[data-buy]'); if(!p || !form) return;
    var opts = p.o || [], sel = opts.map(function(){ return null; }), hasV = (p.v || []).length > 0;
    var qtyIn = form.querySelector('input[name=qty]'), addBtn = form.querySelector('[data-add]'), stockEl = $('[data-stock]');
    function match(s){ return (p.v || []).filter(function(v){ return s.every(function(x, i){ return x == null || (v.o && v.o[i] === x); }); }); }
    function current(){ if(sel.some(function(x){ return x == null; })) return null; return hasV ? match(sel)[0] || null : { id: '', o: sel.slice(), p: null, s: null }; }
    function available(i, val){
      if(!hasV) return !p.ts || stockOf(p, null) > 0;
      var s = sel.slice(); s[i] = val;
      return match(s).some(function(v){ return stockOf(p, v) > 0; });
    }
    function exists(i, val){ if(!hasV) return true; var s = sel.map(function(){ return null; }); s[i] = val; return match(s).length > 0; }
    // start on the first variant that is in stock; leave sizes for the shopper to pick
    var first = hasV ? (p.v.filter(function(v){ return stockOf(p, v) > 0; })[0] || p.v[0]) : null;
    opts.forEach(function(o, i){
      if(o.v.length === 1) sel[i] = o.v[0];
      else if(first && first.o && !/size|مقاس/i.test(o.n)) sel[i] = first.o[i];
    });
    function paint(){
      opts.forEach(function(o, i){
        var lab = $('[data-optv="' + i + '"]'); if(lab) lab.textContent = sel[i] || '';
        $$('fieldset[data-opt="' + i + '"] input', form).forEach(function(inp){
          inp.checked = inp.value === sel[i];
          var ok = exists(i, inp.value), av = ok && available(i, inp.value);
          inp.disabled = !ok; inp.parentNode.classList.toggle('na', ok && !av);
        });
      });
      var v = current(), price = v ? priceOf(p, v) : (hasV ? Math.min.apply(null, p.v.map(function(x){ return priceOf(p, x); })) : p.p);
      var pEl = $('[data-price]'), p2 = $('[data-price2]'), cmp = $('[data-compare]');
      if(pEl) pEl.textContent = money(price); if(p2) p2.textContent = money(price);
      if(cmp) cmp.hidden = !(p.c > price);
      var st = !hasV ? stockOf(p, null) : v ? stockOf(p, v) : Infinity, out = st <= 0;
      if(stockEl){ stockEl.textContent = out ? t('soldOut') : (st <= 5 ? t('onlyLeft', { n: st }) : ''); stockEl.classList.toggle('low', out || st <= 5); }
      addBtn.disabled = out; var bn = $('[data-buynow]'); if(bn) bn.disabled = out;
      var a2 = $('[data-add2]'); if(a2) a2.disabled = out;
      if(qtyIn){ qtyIn.max = Math.min(99, st); if(+qtyIn.value > +qtyIn.max && st > 0) qtyIn.value = Math.max(1, Math.min(99, st)); }
    }
    function showImage(val){
      var u = p.vi && p.vi[val]; if(!u) return;
      var k = (p.imgs || []).indexOf(u); if(k >= 0) goSlide(k, true);
    }
    form.addEventListener('change', function(e){
      var f = e.target.closest('fieldset[data-opt]'); if(!f) return;
      var i = +f.dataset.opt; sel[i] = e.target.value;
      if(hasV && !match(sel).length){ sel = sel.map(function(x, j){ return j === i ? x : null; }); var m = match(sel)[0]; if(m) opts.forEach(function(o, j){ if(o.v.length === 1 || !/size|مقاس/i.test(o.n)) sel[j] = m.o[j]; }); }
      showImage(e.target.value); paint();
    });
    form.addEventListener('click', function(e){
      var q = e.target.closest('[data-q]'); if(!q) return;
      qtyIn.value = Math.max(1, Math.min(+qtyIn.max || 99, (+qtyIn.value || 1) + (+q.dataset.q)));
    });
    function missing(){
      var i = sel.indexOf(null); if(i < 0) return false;
      var f = $('fieldset[data-opt="' + i + '"]'); toast(t('chooseOption', { o: opts[i].n.toLowerCase() }));
      if(f){ f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return true;
    }
    function add(){
      if(missing()) return false;
      var v = current(), qty = Math.max(1, Math.floor(+qtyIn.value || 1));
      return addToCart(p.pid, hasV ? v.id : '', qty, hasV ? '' : (v && v.o.length ? v.o.join(' / ') : ''));
    }
    form.addEventListener('submit', function(e){ e.preventDefault(); if(add()){ toast(t('added')); setTimeout(openCart, 250); } });
    var bn = $('[data-buynow]'); if(bn) bn.addEventListener('click', function(){ if(add()) go(base + '/checkout'); });
    var a2 = $('[data-add2]'); if(a2) a2.addEventListener('click', function(){ if(sel.indexOf(null) >= 0){ missing(); return; } if(add()){ toast(t('added')); setTimeout(openCart, 250); } });
    paint();
    if(first && sel.some(function(x){ return x; })){ var c = sel.filter(function(x){ return x && p.vi && p.vi[x]; })[0]; if(c) showImage(c); }

    // gallery + thumbs
    var gal = $('[data-gallery]'), thumbs = $$('[data-th]');
    function goSlide(k, smooth){
      if(!gal) return; var fig = gal.children[k]; if(!fig) return;
      if(getComputedStyle(gal).display === 'grid'){ if(k > 0 && smooth){ var img = fig.querySelector('img'), g0 = gal.children[0].querySelector('img'); if(img && g0){ var tmp = g0.src; g0.src = img.src; img.src = tmp; } } return; }
      gal.scrollTo({ left: fig.offsetLeft - gal.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
    }
    thumbs.forEach(function(b){ b.addEventListener('click', function(){ goSlide(+b.dataset.th, true); }); });
    if(gal && thumbs.length) gal.addEventListener('scroll', function(){
      var k = Math.round(Math.abs(gal.scrollLeft) / Math.max(1, gal.clientWidth));
      thumbs.forEach(function(b, i){ b.classList.toggle('on', i === k); });
    }, { passive: true });

    // sticky buy bar once the add button scrolls away
    var sticky = $('[data-sticky]');
    if(sticky && 'IntersectionObserver' in window) new IntersectionObserver(function(es){
      es.forEach(function(en){ sticky.classList.toggle('on', !en.isIntersecting && en.boundingClientRect.top < 0); });
    }).observe(addBtn);
  }

  /* ---------- checkout ---------- */
  var applied = null; // { code, type, value, min }
  function digits(s){ return String(s || '').replace(/[٠-٩]/g, function(d){ return d.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function(d){ return d.charCodeAt(0) - 1776; }); }
  function normPhone(s){ var d = digits(s).replace(/\D/g, ''); if(/^0020/.test(d)) d = d.slice(4); else if(/^20(1\d{9})$/.test(d)) d = d.slice(2); if(/^1\d{9}$/.test(d)) d = '0' + d; return d; }
  function shipFor(gov, after){
    var sh = D.shipping || {}, govs = sh.govs || {};
    if(!gov) return null;
    var g = govs[gov], fee;
    if(g === false || g === 'off') return false;
    fee = g != null && g !== '' && isFinite(+g) ? +g : (+sh.flat || 0);
    if(sh.free && after >= sh.free) fee = 0;
    if(applied && applied.type === 'ship') fee = 0;
    return fee;
  }
  function discountFor(sub){
    if(!applied) return 0;
    if(applied.min && sub < applied.min) return 0;
    if(applied.type === 'percent') return Math.round(sub * Math.min(100, applied.value) / 100 * 100) / 100;
    if(applied.type === 'fixed') return Math.min(sub, applied.value);
    return 0;
  }
  function renderTotals(){
    var box = $('[data-totals]'); if(!box) return;
    var form = $('[data-checkout]'), gov = form ? form.gov.value : '';
    var sub = subtotal(), dis = discountFor(sub), ship = shipFor(gov, sub - dis), cod = cart.length ? (+D.codFee || 0) : 0;
    var total = sub - dis + (ship || 0) + cod;
    var row = function(a, b){ return '<div class="tr"><span>' + a + '</span><span>' + b + '</span></div>'; };
    box.innerHTML = row(esc(t('subtotal')), money(sub))
      + (dis ? row(esc(t('discount')) + ' · ' + esc(applied.code), '−' + money(dis)) : '')
      + row(esc(t('shipping')), ship == null ? '<small>' + esc(t('chooseGovFirst')) + '</small>' : ship === false ? '<small style="color:var(--sale)">' + esc(t('noDelivery')) + '</small>' : ship ? money(ship) : esc(t('free')))
      + (cod ? row(esc(t('codFee')), money(cod)) : '')
      + row('<b>' + esc(t('total')) + '</b>', '<b>' + money(total) + '</b>');
    var place = $('[data-place]'); if(place) place.disabled = !cart.length || ship === false;
  }
  function api(path, body){
    return fetch('/api/s/' + encodeURIComponent(D.slug) + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; }); });
  }
  function initCheckout(){
    var form = $('[data-checkout]'); if(!form) return;
    var err = $('[data-err]'), saved = store('sk:buyer') || {};
    ['name', 'phone', 'email', 'gov', 'city', 'address', 'landmark'].forEach(function(k){ if(saved[k] && form[k]) form[k].value = saved[k]; });
    if(!cart.length){
      var grid = $('.co-grid');
      if(grid) grid.innerHTML = '<div class="cart-empty" style="grid-column:1/-1"><p>' + esc(t('emptyCart')) + '</p><a class="btn btn-main" href="' + esc(base + '/shop') + '">' + esc(t('keepShopping')) + '</a></div>';
      return;
    }
    form.gov.addEventListener('change', renderTotals);
    var codeIn = $('[data-code]'), codeMsg = $('[data-code-msg]'), applyBtn = $('[data-apply]');
    var remembered = store('sk:code:' + D.sid); if(remembered && codeIn) codeIn.value = remembered;
    function applyCode(){
      var code = (codeIn.value || '').trim().toUpperCase();
      if(!code){ applied = null; codeMsg.textContent = ''; renderTotals(); return; }
      if(PREVIEW){ codeMsg.textContent = t('previewOff'); return; }
      applyBtn.classList.add('busy');
      api('/discount', { code: code, subtotal: subtotal() }).then(function(j){
        applyBtn.classList.remove('busy');
        if(j.ok){
          applied = { code: j.code, type: j.type, value: +j.value || 0, min: +j.min || 0 };
          codeMsg.textContent = t('applied') + ' · ' + (j.type === 'ship' ? t('freeShipCode') : j.type === 'percent' ? '−' + j.value + '%' : '−' + money(j.value))
            + (applied.min && subtotal() < applied.min ? ' — ' + t('minOrder', { x: money(applied.min) }) : '');
          codeMsg.className = 'code-msg ok';
        } else { applied = null; codeMsg.textContent = j.status === 429 ? t('tooMany') : t('badCode'); codeMsg.className = 'code-msg bad'; }
        renderTotals();
      }, function(){ applyBtn.classList.remove('busy'); codeMsg.textContent = t('orderFailed'); });
    }
    if(applyBtn) applyBtn.addEventListener('click', applyCode);
    if(codeIn) codeIn.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); applyCode(); } });
    if(remembered) applyCode();

    form.addEventListener('submit', function(e){
      e.preventDefault();
      err.textContent = '';
      $$('.fld.bad', form).forEach(function(f){ f.classList.remove('bad'); });
      var bad = null;
      function fail(name, msg){ var el = form[name]; if(el && el.closest('.fld')) el.closest('.fld').classList.add('bad'); if(!bad){ bad = el; err.textContent = msg; } }
      var data = {};
      ['name', 'phone', 'email', 'gov', 'city', 'address', 'landmark', 'notes', 'website'].forEach(function(k){ data[k] = form[k] ? String(form[k].value || '').trim() : ''; });
      data.phone = normPhone(data.phone);
      ['name', 'phone', 'gov', 'city', 'address'].forEach(function(k){ if(!data[k]) fail(k, t('required')); });
      if(data.phone && !/^01[0125]\d{8}$/.test(data.phone)) fail('phone', t('badPhone'));
      if(D.emailMode === 'required' && !data.email) fail('email', t('required'));
      if(data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail('email', t('email'));
      if(shipFor(data.gov, 0) === false) fail('gov', t('noDelivery'));
      if(bad){ bad.focus(); return; }
      if(PREVIEW){ err.textContent = t('previewOff'); return; }
      store('sk:buyer', { name: data.name, phone: data.phone, email: data.email, gov: data.gov, city: data.city, address: data.address, landmark: data.landmark });
      var place = $('[data-place]'), label = place.textContent;
      place.classList.add('busy'); place.textContent = t('placing');
      data.items = cart.map(function(l){ return { pid: l.pid, vid: l.vid || '', qty: l.qty, opts: l.opts || '' }; });
      data.code = applied ? applied.code : '';
      data.vid = visitor();
      api('/order', data).then(function(j){
        if(j.ok && j.oid){
          cart = []; store(CART_KEY, null); store('sk:code:' + D.sid, null);
          var orders = store('sk:orders:' + D.sid) || []; orders.unshift({ n: j.number, oid: j.oid, k: j.token, at: Date.now() }); store('sk:orders:' + D.sid, orders.slice(0, 10));
          location.href = base + '/order/' + encodeURIComponent(j.oid) + '?k=' + encodeURIComponent(j.token);
          return;
        }
        place.classList.remove('busy'); place.textContent = label;
        if(j.error === 'stock' && j.lines){
          // the server says what is left; shrink the bag to match
          j.lines.forEach(function(x){ cart.forEach(function(l){ if(l.pid === x.pid && (l.vid || '') === (x.vid || '')) l.qty = Math.max(0, Math.min(l.qty, x.left)); }); });
          cart = cart.filter(function(l){ return l.qty > 0; }); saveCart();
          err.textContent = t('stockChanged');
          if(!cart.length) setTimeout(function(){ location.reload(); }, 1600);
        } else if(j.error === 'code'){ applied = null; renderTotals(); err.textContent = t('badCode'); }
        else if(j.error === 'gov'){ fail('gov', t('noDelivery')); }
        else if(j.error === 'phone'){ fail('phone', t('badPhone')); }
        else if(j.error === 'closed'){ err.textContent = t('closedOrders'); }
        else err.textContent = j.status === 429 ? t('tooMany') : t('orderFailed');
      }, function(){ place.classList.remove('busy'); place.textContent = label; err.textContent = t('orderFailed'); });
    });
    renderTotals();
  }

  /* ---------- order tracking ---------- */
  function steps(status){
    var all = ['new', 'confirmed', 'shipped', 'delivered'], st = T.status || {};
    if(status === 'cancelled') return '<div class="steps"><span class="step x on">' + esc(st.cancelled) + '</span></div>';
    var at = Math.max(0, all.indexOf(status));
    return '<div class="steps">' + all.map(function(s, i){ return '<span class="step' + (i <= at ? ' on' : '') + '">' + esc(st[s]) + '</span>'; }).join('') + '</div>';
  }
  function initTrack(){
    var form = $('[data-track]'), out = $('[data-track-out]'); if(!form) return;
    var last = (store('sk:orders:' + D.sid) || [])[0], buyer = store('sk:buyer') || {};
    if(last && !form.n.value) form.n.value = last.n;
    if(buyer.phone) form.phone.value = buyer.phone;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(PREVIEW){ out.innerHTML = '<p class="muted">' + esc(t('previewOff')) + '</p>'; return; }
      var n = digits(form.n.value).replace(/\D/g, ''), ph = normPhone(form.phone.value), btn = form.querySelector('button');
      if(!n || !/^01\d{9}$/.test(ph)){ out.innerHTML = '<p class="co-err">' + esc(t('trackNone')) + '</p>'; return; }
      btn.classList.add('busy');
      api('/track?n=' + encodeURIComponent(n) + '&phone=' + encodeURIComponent(ph)).then(function(j){
        btn.classList.remove('busy');
        if(!j.ok){ out.innerHTML = '<p class="co-err">' + esc(j.status === 429 ? t('tooMany') : t('trackNone')) + '</p>'; return; }
        var o = j.order, d = new Date(o.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        out.innerHTML = '<div class="card o-card"><div class="eyebrow">' + esc(t('orderNumber')) + ' #' + esc(o.number) + ' · ' + esc(t('placed', { d: d })) + '</div><div style="margin:14px 0">' + steps(o.status) + '</div>'
          + '<div class="cart-lines mini">' + (o.items || []).map(function(it){ return '<div class="cl"><div class="cl-img">' + (it.image ? '<img src="' + esc(it.image) + '" alt="">' : IC.tee) + '<span class="q">' + (+it.qty) + '</span></div><div class="cl-t"><b>' + esc(it.title) + '</b><small>' + esc(it.variant || '') + '</small></div><span class="cl-p">' + money(it.price * it.qty) + '</span></div>'; }).join('') + '</div>'
          + '<div class="totals"><div class="tr"><span><b>' + esc(t('total')) + '</b></span><span><b>' + money(o.total) + '</b></span></div></div></div>';
      }, function(){ btn.classList.remove('busy'); out.innerHTML = '<p class="co-err">' + esc(t('orderFailed')) + '</p>'; });
    });
  }

  /* ---------- countdowns ---------- */
  function initCountdowns(){
    $$('[data-cd]').forEach(function(el){
      var end = +el.dataset.cd; if(!end) return;
      var L = {}; try { L = JSON.parse(el.dataset.l || '{}'); } catch(e){}
      var b = $$('b', el);
      function tick(){
        var s = Math.max(0, Math.floor((end - Date.now()) / 1000));
        if(!s){ el.innerHTML = '<a class="btn btn-main" href="' + esc(base + '/shop') + '">' + esc(L.out || '') + '</a>'; return; }
        var v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
        b.forEach(function(x, i){ x.textContent = (v[i] < 10 ? '0' : '') + v[i]; });
        setTimeout(tick, 1000 - Date.now() % 1000);
      }
      tick();
    });
  }

  /* ---------- reveal on scroll, header state ---------- */
  function initMotion(){
    var els = $$('.reveal');
    if(PREVIEW || !('IntersectionObserver' in window) || document.documentElement.dataset.motion !== '1'){ els.forEach(function(e){ e.classList.add('seen'); }); }
    else {
      var io = new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('seen'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
      els.forEach(function(e){ io.observe(e); });
    }
    var root = document.documentElement, on = false;
    function sc(){ var s = window.scrollY > 24; if(s !== on){ on = s; root.classList.toggle('scrolled', s); } }
    window.addEventListener('scroll', sc, { passive: true }); sc();
    if(D.page === 'shop' && /[?&]q=(&|$)/.test(location.search)){ var q = $('.shop-tools input[name=q]'); if(q) q.focus(); }
  }

  /* ---------- analytics: one light beacon per page view ---------- */
  function visitor(){ var v = store('sk:vid'); if(!v){ v = Math.random().toString(36).slice(2, 12); store('sk:vid', v); } return v; }
  function hit(){
    if(PREVIEW || !D.slug || D.page === 'closed') return;
    var day = new Date().toISOString().slice(0, 10), dk = 'sk:day:' + D.sid, first = store(dk) !== day;
    if(first) store(dk, day);
    var body = JSON.stringify({ p: D.page, pid: D.product || '', n: first ? 1 : 0, r: document.referrer && document.referrer.indexOf(location.host) < 0 ? document.referrer.slice(0, 200) : '' });
    try { if(navigator.sendBeacon && navigator.sendBeacon('/api/s/' + encodeURIComponent(D.slug) + '/hit', new Blob([body], { type: 'application/json' }))) return; } catch(e){}
    fetch('/api/s/' + encodeURIComponent(D.slug) + '/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).catch(function(){});
  }

  /* ---------- preview bridge (the dashboard's live preview iframe) ---------- */
  function previewNav(href){ try { parent.postMessage({ sk: 'nav', href: href }, '*'); } catch(e){} }
  function formHref(f){ var q = new URLSearchParams(new FormData(f)).toString(); return (f.getAttribute('action') || base + '/shop') + (q ? '?' + q : ''); }
  function go(href){ if(PREVIEW) previewNav(href); else location.href = href; }
  function initPreview(){
    if(!PREVIEW) return;
    var css = document.createElement('style');
    css.textContent = '.secwrap{position:relative;cursor:pointer}.secwrap::after{content:"";position:absolute;inset:3px;border:2px solid transparent;border-radius:10px;pointer-events:none;transition:border-color .15s}'
      + '.secwrap:hover::after{border-color:color-mix(in srgb,var(--accent) 70%,transparent)}.secwrap.sel::after{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 20%,transparent)}';
    document.head.appendChild(css);
    document.addEventListener('click', function(e){
      var a = e.target.closest('a[href]');
      if(a){
        e.preventDefault();
        var h = a.getAttribute('href');
        if(/^https?:|^mailto:|^tel:/.test(h)) return;
        if(e.target.closest('.secwrap') && !e.target.closest('.pc,.btn,.cat-tile,.cat-pill,.cat-big,.more')){ /* fall through to select */ }
        else { previewNav(h); return; }
      }
      var s = e.target.closest('.secwrap');
      if(s && !e.target.closest('button,input,select,label,textarea,summary')){
        e.preventDefault();
        $$('.secwrap.sel').forEach(function(x){ x.classList.remove('sel'); }); s.classList.add('sel');
        try { parent.postMessage({ sk: 'select', sec: s.dataset.sec }, '*'); } catch(err){}
      }
    }, true);
    document.addEventListener('submit', function(e){
      var f = e.target; if(f.matches('[data-buy],[data-checkout],[data-track]')) return;
      e.preventDefault(); previewNav(formHref(f));
    }, true);
    window.addEventListener('message', function(e){
      var m = e.data || {};
      if(m.sk === 'focus'){ var s = $('.secwrap[data-sec="' + m.sec + '"]'); $$('.secwrap.sel').forEach(function(x){ x.classList.remove('sel'); }); if(s){ s.classList.add('sel'); s.scrollIntoView({ behavior: m.instant ? 'auto' : 'smooth', block: 'start' }); } }
    });
    try { parent.postMessage({ sk: 'ready', page: D.page }, '*'); } catch(e){}
  }

  /* ---------- go ---------- */
  renderCart();
  initProduct();
  initCheckout();
  initTrack();
  initCountdowns();
  initMotion();
  initPreview();
  hit();
  // a bag changed in another tab
  window.addEventListener('storage', function(e){ if(e.key === CART_KEY){ cart = readCart(); renderCart(); } });
  window.addEventListener('pageshow', function(e){ if(e.persisted){ cart = readCart(); renderCart(); } });
  window.SKR = { toast: toast, openCart: openCart, cart: function(){ return cart; } };
})();
