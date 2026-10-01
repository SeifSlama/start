/* ============================================================
   STOREFRONT RENDERER — one function, every page of every store.
   The worker calls it to serve /<slug>/...; the dashboard calls the same
   code to draw its live preview, so what the merchant sees is exactly
   what customers get. Pure strings in, HTML out (no DOM).
   ============================================================ */
var SK = (function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  /* "*italic*" in titles; line breaks in text */
  function rich(s){ return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
  function para(s){ return esc(s).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>'); }
  function safeUrl(u){ u = String(u || ''); return /^(\/m\/[A-Za-z0-9_-]+|\/demo\/[a-z0-9_.-]+|https:\/\/[^\s"'<>]+|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+)$/.test(u) ? u : ''; }
  function attr(s){ return esc(s); }
  function money(n, lang){ n = Math.round((+n || 0) * 100) / 100; var s = n.toLocaleString('en-US', { maximumFractionDigits: 2 }); return lang === 'ar' ? s + ' ج.م' : s + ' EGP'; }
  function waLink(num, text){
    var d = String(num || '').replace(/\D/g, '');
    if(/^01\d{9}$/.test(d)) d = '2' + d; else if(/^1\d{9}$/.test(d)) d = '20' + d;
    return d.length >= 10 ? 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '') : '';
  }

  /* ---------- icons ---------- */
  var IC = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    arrow: '<svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.3 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.8 3 .6.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.7h2.6l.4-3h-3V8.4c0-.9.3-1.5 1.5-1.5h1.6V4.2a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.3H7.8v3h2.6V21z"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2.3 1.7 3.7 4 3.9v3a7 7 0 0 1-4-1.3v6.1a5.7 5.7 0 1 1-5.7-5.7l.9.1v3.1a2.7 2.7 0 1 0 1.9 2.6V3z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    return: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="M8 5L4 9l4 4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/><path d="M8.8 12l2.2 2.2 4.4-4.6"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19l8-8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5v8h14v-8M12 8.5v12M12 8.5S10.5 4 8 4.5 7 8.5 12 8.5zM12 8.5S13.5 4 16 4.5 17 8.5 12 8.5z"/></svg>',
    ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 15.5L15.5 3 21 8.5 8.5 21z"/><path d="M7 11.5l1.8 1.8M10 8.5l1.8 1.8M13 5.5l1.8 1.8"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>'
  };
  /* a T-shirt drawing for products that have no photo yet */
  function teeSvg(fill, ink){
    return '<svg class="ph-tee" viewBox="0 0 200 200" aria-hidden="true"><path fill="' + fill + '" stroke="' + ink + '" stroke-opacity=".18" stroke-width="1.5" d="M74 30c6 10 15 15 26 15s20-5 26-15l38 16 14 34-25 9-6-12v95H53V77l-6 12-25-9 14-34z"/></svg>';
  }

  /* ---------- the theme as CSS variables + switches ---------- */
  function themeVars(th, lang){
    var s = th.s, c = s.colors, f = s.font, ar = lang === 'ar';
    var head = ar ? f.headingAr : f.heading, body = ar ? f.bodyAr : f.body;
    var pad = { airy: 'clamp(70px,10vw,130px)', regular: 'clamp(54px,8vw,96px)', compact: 'clamp(36px,6vw,64px)' }[s.density] || 'clamp(54px,8vw,96px)';
    var maxw = { normal: '1240px', wide: '1440px', full: '100%' }[s.width] || '1240px';
    var r = Math.max(0, Math.min(40, +s.radius || 0));
    var btnR = { pill: '999px', rounded: Math.min(14, r) + 'px', square: '0px', brutal: Math.min(8, r) + 'px', outline: r >= 20 ? '999px' : Math.min(10, r) + 'px', underline: '0px' }[s.button] || '999px';
    return ':root{--bg:' + c.bg + ';--surface:' + c.surface + ';--text:' + c.text + ';--muted:' + c.muted + ';--accent:' + c.accent + ';--accent-ink:' + (c.accentText || skInk(c.accent))
      + ';--line:' + c.line + ';--sale:' + (c.sale || '#C2573A') + ';--r:' + r + 'px;--r-btn:' + btnR + ';--ratio:' + (s.card.ratio || '3/4').replace('/', ' / ')
      + ';--fh:' + skFontStack(head, ar) + ';--fb:' + skFontStack(body, ar) + ';--hw:' + (f.weight || 400) + ';--hcase:' + (f.upper ? 'uppercase' : 'none')
      + ';--htrack:' + (ar ? 0 : (+f.track || 0)) + 'em;--hscale:' + (+f.scale || 1) + ';--pad:' + pad + ';--maxw:' + maxw + ';--gd:' + (s.grid.d || 4) + ';--gm:' + (s.grid.m || 2)
      + ';--logo-scale:' + (+s.header.logoScale || 1) + '}';
  }
  function htmlAttrs(th, lang){
    var s = th.s;
    return ' lang="' + lang + '" dir="' + (lang === 'ar' ? 'rtl' : 'ltr') + '" data-theme="' + attr(th.id) + '" data-btn="' + attr(s.button) + '" data-card="' + attr(s.card.style)
      + '" data-hover="' + attr(s.card.hover) + '" data-calign="' + attr(s.card.align) + '" data-header="' + attr(s.header.layout) + '" data-hstyle="' + attr(s.header.style)
      + '" data-tex="' + attr(s.texture) + '" data-decor="' + attr(s.decor) + '" data-density="' + attr(s.density) + '" data-motion="' + (s.motion ? 1 : 0) + '"';
  }

  /* ---------- links ---------- */
  function linker(base){
    return {
      home: base || '/', shop: base + '/shop', cat: function(c){ return base + '/shop?c=' + encodeURIComponent(c); }, product: function(h){ return base + '/p/' + encodeURIComponent(h); },
      cart: base + '/cart', checkout: base + '/checkout', track: base + '/track', page: function(p){ return base + '/pages/' + p; },
      to: function(href){
        href = String(href || '');
        if(!href || href === 'shop') return base + '/shop';
        if(href === 'home') return base || '/';
        if(href.indexOf('p:') === 0) return base + '/p/' + encodeURIComponent(href.slice(2));
        if(href.indexOf('c:') === 0) return base + '/shop?c=' + encodeURIComponent(href.slice(2));
        if(href.indexOf('page:') === 0) return base + '/pages/' + encodeURIComponent(href.slice(5));
        if(/^https:\/\/[^\s"'<>]+$/.test(href)) return href;
        return base + '/shop';
      }
    };
  }
  function categories(products){
    var seen = {}, out = [];
    products.forEach(function(p){ var c = (p.category || '').trim(); if(c && !seen[c.toLowerCase()]){ seen[c.toLowerCase()] = 1; out.push(c); } });
    return out;
  }
  function inStock(p){ if(!p.trackStock) return true; if(p.variants && p.variants.length) return p.variants.some(function(v){ return (+v.stock || 0) > 0; }); return (+p.stock || 0) > 0; }
  function priceRange(p){
    var ps = (p.variants || []).map(function(v){ return v.price != null && v.price !== '' ? +v.price : +p.price; });
    if(!ps.length) return { min: +p.price, max: +p.price };
    return { min: Math.min.apply(null, ps), max: Math.max.apply(null, ps) };
  }

  /* ---------- product card ---------- */
  function card(p, L, ctx, i){
    var lang = ctx.lang, img = safeUrl(p.images && p.images[0]), img2 = safeUrl(p.images && p.images[1]), pr = priceRange(p);
    var sale = p.compareAt && +p.compareAt > pr.min, out = !inStock(p);
    var colorOpt = (p.options || []).filter(function(o){ return /colou?r|لون/i.test(o.name); })[0];
    var sw = colorOpt ? '<div class="pc-sw">' + colorOpt.values.slice(0, 5).map(function(v){ var c = skColor(v); return c ? '<i style="background:' + c + '" title="' + attr(v) + '"></i>' : ''; }).join('') + (colorOpt.values.length > 5 ? '<small>+' + (colorOpt.values.length - 5) + '</small>' : '') + '</div>' : '';
    var media = img ? '<img src="' + attr(img) + '" alt="' + attr(p.title) + '" loading="' + (i < 4 ? 'eager' : 'lazy') + '" decoding="async">' + (img2 ? '<img class="pc-alt" src="' + attr(img2) + '" alt="" loading="lazy" decoding="async">' : '')
                    : '<div class="ph">' + teeSvg(ctx.th.s.colors.surface, ctx.th.s.colors.text) + '</div>';
    return '<a class="pc reveal" href="' + attr(L.product(p.handle)) + '" style="--i:' + (i % 8) + '">'
      + '<div class="pc-media">' + media + '<div class="pc-badges">' + (out ? '<span class="pb pb-out">' + esc(skT(lang, 'soldOut')) + '</span>' : (sale ? '<span class="pb pb-sale">' + esc(skT(lang, 'sale')) + '</span>' : (p.isNew ? '<span class="pb">' + esc(skT(lang, 'new')) + '</span>' : ''))) + '</div></div>'
      + '<div class="pc-info"><div class="pc-title">' + esc(p.title) + '</div><div class="pc-price">' + (pr.min !== pr.max ? '<span class="from">' + esc(skT(lang, 'from')) + '</span> ' : '')
      + '<span class="now">' + money(pr.min, lang) + '</span>' + (sale ? '<s>' + money(p.compareAt, lang) + '</s>' : '') + '</div>' + sw + '</div></a>';
  }
  function pickProducts(sec, products){
    var src = sec.source || 'featured', list = products.slice();
    if(src === 'featured'){ var f = list.filter(function(p){ return p.featured; }); list = f.length ? f : list; }
    else if(src === 'newest') list.sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
    else if(src === 'sale') list = list.filter(function(p){ return p.compareAt && +p.compareAt > +p.price; });
    else if(src.indexOf('category:') === 0){ var c = src.slice(9).toLowerCase(); list = list.filter(function(p){ return (p.category || '').toLowerCase() === c; }); }
    return list.slice(0, Math.max(1, Math.min(24, +sec.limit || 8)));
  }

  /* ---------- sections ---------- */
  var SEC = {};
  function copyHtml(x, ctx){
    return '<div class="hero-copy">' + (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + '</div>' : '') + '<h1 class="h-hero">' + rich(x.title) + '</h1>'
      + (x.text ? '<p class="lead">' + para(x.text) + '</p>' : '') + (x.cta ? '<div class="hero-cta"><a class="btn btn-main" href="' + attr(ctx.L.to(x.ctaHref)) + '">' + esc(x.cta) + IC.arrow + '</a></div>' : '') + '</div>';
  }
  SEC.hero = function(x, ctx){
    var L = ctx.L, lay = x.layout || 'split', imgs = [];
    var own = safeUrl(x.image);
    if(own) imgs.push(own);
    /* one photo per product first (front shots), then the rest */
    ctx.products.forEach(function(p){ var u = safeUrl(p.images && p.images[0]); if(u && imgs.length < 4 && imgs.indexOf(u) < 0) imgs.push(u); });
    ctx.products.forEach(function(p){ (p.images || []).forEach(function(u){ u = safeUrl(u); if(u && imgs.length < 4 && imgs.indexOf(u) < 0) imgs.push(u); }); });
    var img = imgs[0] || '';
    /* a full-width hero wants a wide photo: samples get a styled one, real stores a row of their products */
    if(lay === 'full' && !own){
      if(ctx.demo) img = skInk(ctx.th.s.colors.bg) === '#FFFFFF' ? '/demo/hero-dark.jpg' : '/demo/hero-light.jpg';
      else if(imgs.length >= 3) return '<section class="hero hero-full"' + ' data-h="' + attr(x.height || 'tall') + '"><div class="hero-bg trio">' + imgs.slice(0, 3).map(function(u){ return '<img src="' + attr(u) + '" alt="" decoding="async">'; }).join('') + '</div><div class="hero-shade"></div><div class="wrap">' + copyHtml(x, ctx) + '</div></section>';
    }
    var media = function(u, cls){ return u ? '<img class="' + (cls || '') + '" src="' + attr(u) + '" alt="" decoding="async" fetchpriority="high">' : '<div class="ph ' + (cls || '') + '">' + teeSvg(ctx.th.s.colors.surface, ctx.th.s.colors.text) + '</div>'; };
    var copy = copyHtml(x, ctx);
    var h = ' data-h="' + attr(x.height || 'tall') + '"';
    if(lay === 'full') return '<section class="hero hero-full"' + h + '>' + media(img, 'hero-bg') + '<div class="hero-shade"></div><div class="wrap">' + copy + '</div></section>';
    if(lay === 'center') return '<section class="hero hero-center"' + h + '><div class="wrap">' + copy + (img ? '<div class="hero-strip">' + imgs.slice(0, 3).map(function(u){ return media(u); }).join('') + '</div>' : '') + '</div></section>';
    if(lay === 'poster') return '<section class="hero hero-poster"' + h + '><div class="wrap"><div class="poster-media">' + media(img) + '</div>' + copy + '</div></section>';
    if(lay === 'collage') return '<section class="hero hero-collage"' + h + '><div class="wrap">' + copy + '<div class="collage">' + [0, 1, 2].map(function(k){ return '<div class="clg clg' + k + '">' + media(imgs[k] || img) + '</div>'; }).join('') + '<span class="sticker st1">✿ new</span><span class="sticker st2">COD ✓</span></div></div></section>';
    return '<section class="hero hero-split"' + h + '><div class="wrap">' + copy + '<div class="hero-media">' + media(img) + '</div></div></section>';
  };
  SEC.marquee = function(x){
    var t = esc(x.text || ''); var run = '<span>' + t + '</span>';
    return '<section class="marquee mq-' + attr(x.style || 'accent') + '" aria-label="' + t + '"><div class="mq-track">' + run + run + run + run + '</div></section>';
  };
  SEC.products = function(x, ctx){
    var list = pickProducts(x, ctx.products), L = ctx.L;
    if(!list.length) return '';
    var lay = x.layout || 'grid';
    if(lay === 'editorial' && list.length > 5) list = list.slice(0, list.length - list.length % 5);
    return '<section class="sec sec-products lay-' + attr(lay) + '"><div class="wrap"><div class="sec-head">' + (x.title ? '<h2 class="h-sec">' + rich(x.title) + '</h2>' : '') + (x.subtitle ? '<p class="muted">' + esc(x.subtitle) + '</p>' : '')
      + '<a class="more" href="' + attr(L.shop) + '">' + esc(skT(ctx.lang, 'viewAll')) + IC.arrow + '</a></div><div class="grid-p">' + list.map(function(p, i){ return card(p, L, ctx, i); }).join('') + '</div></div></section>';
  };
  SEC.categories = function(x, ctx){
    var cats = categories(ctx.products), L = ctx.L;
    if(!cats.length) return '';
    var st = x.style || 'tiles';
    var items = cats.slice(0, 8).map(function(c, i){
      var p = ctx.products.filter(function(q){ return (q.category || '').toLowerCase() === c.toLowerCase() && q.images && q.images.length; })[0], u = p ? safeUrl(p.images[0]) : '';
      if(st === 'big-type') return '<a class="cat-big reveal" href="' + attr(L.cat(c)) + '"><span>' + esc(c) + '</span>' + IC.arrow + '</a>';
      if(st === 'pills') return '<a class="cat-pill" href="' + attr(L.cat(c)) + '">' + esc(c) + '</a>';
      return '<a class="cat-tile reveal" href="' + attr(L.cat(c)) + '">' + (u ? '<img src="' + attr(u) + '" alt="" loading="lazy">' : '<div class="ph">' + teeSvg(ctx.th.s.colors.surface, ctx.th.s.colors.text) + '</div>') + '<span>' + esc(c) + '</span></a>';
    }).join('');
    return '<section class="sec sec-cats cats-' + attr(st) + '"><div class="wrap">' + (x.title ? '<div class="sec-head"><h2 class="h-sec">' + rich(x.title) + '</h2></div>' : '') + '<div class="cats">' + items + '</div></div></section>';
  };
  SEC.imageText = function(x, ctx){
    var u = safeUrl(x.image);
    if(!u){ var p = ctx.products.filter(function(q){ return q.images && q.images.length > 1; })[0] || ctx.products.filter(function(q){ return q.images && q.images.length; })[0]; if(p) u = safeUrl(p.images[p.images.length > 1 ? 1 : 0]); }
    return '<section class="sec sec-it it-' + (x.side === 'left' ? 'left' : 'right') + '"><div class="wrap it-grid"><div class="it-media reveal">' + (u ? '<img src="' + attr(u) + '" alt="" loading="lazy">' : '<div class="ph">' + teeSvg(ctx.th.s.colors.surface, ctx.th.s.colors.text) + '</div>') + '</div>'
      + '<div class="it-copy reveal"><h2 class="h-sec">' + rich(x.title) + '</h2>' + (x.text ? '<p class="lead">' + para(x.text) + '</p>' : '') + (x.cta ? '<a class="btn btn-ghost" href="' + attr(ctx.L.to(x.ctaHref)) + '">' + esc(x.cta) + IC.arrow + '</a>' : '') + '</div></div></section>';
  };
  SEC.usp = function(x){
    var items = (x.items || []).slice(0, 4);
    if(!items.length) return '';
    return '<section class="sec sec-usp usp-' + attr(x.style || 'row') + '"><div class="wrap"><div class="usps">' + items.map(function(it){ return '<div class="usp reveal"><span class="usp-ic">' + (IC[it.icon] || IC.sparkle) + '</span><div><b>' + esc(it.title) + '</b><span>' + esc(it.text) + '</span></div></div>'; }).join('') + '</div></div></section>';
  };
  SEC.testimonials = function(x){
    var items = (x.items || []).slice(0, 6); if(!items.length) return '';
    return '<section class="sec sec-quotes"><div class="wrap">' + (x.title ? '<div class="sec-head"><h2 class="h-sec">' + rich(x.title) + '</h2></div>' : '') + '<div class="quotes">' + items.map(function(q){
      return '<figure class="quote reveal"><blockquote>“' + esc(q.quote) + '”</blockquote><figcaption><b>' + esc(q.name) + '</b>' + (q.meta ? '<span>' + esc(q.meta) + '</span>' : '') + '</figcaption></figure>'; }).join('') + '</div></div></section>';
  };
  SEC.story = function(x){
    return '<section class="sec sec-story st-' + attr(x.align || 'center') + '"><div class="wrap narrow reveal">' + (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + '</div>' : '') + (x.title ? '<h2 class="h-story">' + rich(x.title) + '</h2>' : '') + (x.text ? '<p class="lead">' + para(x.text) + '</p>' : '') + '</div></section>';
  };
  SEC.gallery = function(x, ctx){
    var imgs = (x.images || []).map(safeUrl).filter(Boolean);
    if(!imgs.length) ctx.products.forEach(function(p){ (p.images || []).forEach(function(u){ u = safeUrl(u); if(u && imgs.length < 7 && imgs.indexOf(u) < 0) imgs.push(u); }); });
    if(!imgs.length) return '';
    return '<section class="sec sec-gallery gal-' + attr(x.style || 'masonry') + '"><div class="wrap">' + (x.title ? '<div class="sec-head"><h2 class="h-sec">' + rich(x.title) + '</h2></div>' : '') + '<div class="gal">' + imgs.slice(0, 9).map(function(u, i){ return '<figure class="g g' + i + ' reveal"><img src="' + attr(u) + '" alt="" loading="lazy"></figure>'; }).join('') + '</div></div></section>';
  };
  SEC.faq = function(x){
    var items = (x.items || []).slice(0, 12); if(!items.length) return '';
    return '<section class="sec sec-faq"><div class="wrap narrow">' + (x.title ? '<div class="sec-head"><h2 class="h-sec">' + rich(x.title) + '</h2></div>' : '') + items.map(function(q){ return '<details class="faq"><summary>' + esc(q.q) + '<i></i></summary><p>' + para(q.a) + '</p></details>'; }).join('') + '</div></section>';
  };
  SEC.banner = function(x, ctx){
    return '<section class="sec sec-banner"><div class="wrap"><div class="banner reveal"><div><h2 class="h-sec">' + rich(x.title) + '</h2>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + '</div>'
      + (x.code ? '<button class="code" data-copy="' + attr(x.code) + '">' + esc(x.code) + '</button>' : '') + (x.cta ? '<a class="btn btn-main" href="' + attr(ctx.L.to(x.ctaHref)) + '">' + esc(x.cta) + IC.arrow + '</a>' : '') + '</div></div></section>';
  };
  SEC.drop = function(x, ctx){
    var t = Date.parse(x.endsAt || '');
    return '<section class="sec sec-drop"><div class="wrap"><div class="drop reveal"><div><div class="eyebrow">' + esc(x.title || '') + '</div><p>' + esc(x.text || '') + '</p></div>'
      + '<div class="cd" data-cd="' + (isFinite(t) ? t : '') + '" data-l="' + attr(JSON.stringify({ d: skT(ctx.lang, 'days'), h: skT(ctx.lang, 'hours'), m: skT(ctx.lang, 'mins'), s: skT(ctx.lang, 'secs'), out: skT(ctx.lang, 'dropOut') })) + '">'
      + (isFinite(t) && t > Date.now() ? '<span><b>00</b>' + esc(skT(ctx.lang, 'days')) + '</span><span><b>00</b>' + esc(skT(ctx.lang, 'hours')) + '</span><span><b>00</b>' + esc(skT(ctx.lang, 'mins')) + '</span><span><b>00</b>' + esc(skT(ctx.lang, 'secs')) + '</span>'
         : '<a class="btn btn-main" href="' + attr(ctx.L.shop) + '">' + esc(skT(ctx.lang, 'dropOut')) + IC.arrow + '</a>') + '</div></div></div></section>';
  };
  SEC.whatsapp = function(x, ctx){
    var wa = waLink(ctx.st.contact.whatsapp || ctx.st.contact.phone, '');
    if(!wa && !ctx.preview) return '';
    return '<section class="sec sec-wa"><div class="wrap"><div class="wa reveal"><div><h2 class="h-sec">' + rich(x.title) + '</h2><p>' + esc(x.text || '') + '</p></div><a class="btn btn-main" href="' + attr(wa || '#') + '" target="_blank" rel="noopener">' + IC.wa + esc(x.button || skT(ctx.lang, 'messageUs')) + '</a></div></div></section>';
  };

  /* ---------- chrome: announcement, header, footer, cart drawer ---------- */
  function announce(ctx){
    var a = ctx.th.s.announce; if(!a || !a.on || !a.text) return '';
    var t = esc(a.text);
    if(a.style === 'marquee') return '<div class="ann ann-mq"><div class="mq-track"><span>' + t + '</span><span>' + t + '</span><span>' + t + '</span><span>' + t + '</span></div></div>';
    return '<div class="ann"><span>' + t + '</span></div>';
  }
  function logo(ctx){
    var h = ctx.th.s.header, img = ctx.logoUrl ? safeUrl(ctx.logoUrl) : '';
    return img ? '<img src="' + attr(img) + '" alt="' + attr(ctx.storeName) + '">' : '<span>' + esc(h.logoText || ctx.storeName) + '</span>';
  }
  function header(ctx){
    var L = ctx.L, lang = ctx.lang, cats = categories(ctx.products).slice(0, 4);
    var links = [{ h: L.shop, t: skT(lang, 'shop') }].concat(cats.map(function(c){ return { h: L.cat(c), t: c }; }));
    if(ctx.st.about) links.push({ h: L.page('about'), t: skT(lang, 'about') });
    var nav = links.map(function(l){ return '<a href="' + attr(l.h) + '">' + esc(l.t) + '</a>'; }).join('');
    return '<header class="sh" id="sh"><div class="sh-in wrap">'
      + '<button class="sh-ic sh-burger" aria-label="Menu" data-menu>' + IC.menu + '</button>'
      + '<nav class="sh-nav">' + nav + '</nav>'
      + '<a class="sh-logo" href="' + attr(L.home) + '">' + logo(ctx) + '</a>'
      + '<div class="sh-act"><a class="sh-ic" href="' + attr(L.shop) + '?q=" aria-label="' + attr(skT(lang, 'search')) + '" data-search>' + IC.search + '</a>'
      + '<button class="sh-ic sh-cart" aria-label="' + attr(skT(lang, 'cart')) + '" data-cart>' + IC.bag + '<span class="cnt" data-count hidden>0</span></button></div>'
      + '</div></header>'
      + '<div class="mnav" id="mnav" aria-hidden="true"><div class="mnav-scrim" data-menu-x></div><div class="mnav-panel"><div class="mnav-head"><span class="sh-logo">' + logo(ctx) + '</span><button class="sh-ic" data-menu-x aria-label="Close">' + IC.close + '</button></div>'
      + '<nav>' + [{ h: L.home, t: skT(lang, 'home') }].concat(links).concat([{ h: L.track, t: skT(lang, 'trackOrder') }]).map(function(l){ return '<a href="' + attr(l.h) + '">' + esc(l.t) + '</a>'; }).join('') + '</nav></div></div>';
  }
  function socials(ctx){
    var c = ctx.st.contact, out = '';
    if(c.instagram) out += '<a href="https://instagram.com/' + attr(String(c.instagram).replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, '').replace(/\/.*$/, '')) + '" target="_blank" rel="noopener" aria-label="Instagram">' + IC.ig + '</a>';
    if(c.facebook) out += '<a href="' + attr(/^https:\/\//.test(c.facebook) ? c.facebook : 'https://facebook.com/' + String(c.facebook).replace(/^@/, '')) + '" target="_blank" rel="noopener" aria-label="Facebook">' + IC.fb + '</a>';
    if(c.tiktok) out += '<a href="https://www.tiktok.com/@' + attr(String(c.tiktok).replace(/^@/, '').replace(/https?:\/\/(www\.)?tiktok\.com\/@?/, '')) + '" target="_blank" rel="noopener" aria-label="TikTok">' + IC.tt + '</a>';
    var wa = waLink(c.whatsapp, ''); if(wa) out += '<a href="' + attr(wa) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + IC.wa + '</a>';
    return out;
  }
  function footer(ctx){
    var L = ctx.L, lang = ctx.lang, st = ctx.st, pol = st.policies || {};
    var polLinks = [['returns', skT(lang, 'returns')], ['shipping', skT(lang, 'delivery')], ['privacy', skT(lang, 'privacy')], ['terms', skT(lang, 'terms')]].filter(function(p){ return pol[p[0]]; });
    return '<footer class="sf"><div class="wrap"><div class="sf-grid">'
      + '<div class="sf-brand"><a class="sh-logo" href="' + attr(L.home) + '">' + logo(ctx) + '</a>' + (st.about ? '<p>' + esc(String(st.about).slice(0, 180)) + (String(st.about).length > 180 ? '…' : '') + '</p>' : '') + '<div class="sf-soc">' + socials(ctx) + '</div></div>'
      + '<div><h4>' + esc(skT(lang, 'shop')) + '</h4><a href="' + attr(L.shop) + '">' + esc(skT(lang, 'all')) + '</a>' + categories(ctx.products).slice(0, 5).map(function(c){ return '<a href="' + attr(L.cat(c)) + '">' + esc(c) + '</a>'; }).join('') + '</div>'
      + '<div><h4>' + esc(skT(lang, 'contact')) + '</h4><a href="' + attr(L.track) + '">' + esc(skT(lang, 'trackOrder')) + '</a>' + (st.about ? '<a href="' + attr(L.page('about')) + '">' + esc(skT(lang, 'about')) + '</a>' : '')
      + (st.contact.phone ? '<a href="tel:' + attr(String(st.contact.phone).replace(/[^\d+]/g, '')) + '">' + esc(st.contact.phone) + '</a>' : '') + (st.contact.email ? '<a href="mailto:' + attr(st.contact.email) + '">' + esc(st.contact.email) + '</a>' : '') + '</div>'
      + (polLinks.length ? '<div><h4>' + esc(skT(lang, 'policies')) + '</h4>' + polLinks.map(function(p){ return '<a href="' + attr(L.page(p[0])) + '">' + esc(p[1]) + '</a>'; }).join('') + '</div>' : '')
      + '</div><div class="sf-base"><span>© ' + new Date().getFullYear() + ' ' + esc(ctx.storeName) + '</span><span class="sf-cod">' + IC.cash + esc(skT(lang, 'cod')) + '</span><a class="sf-pow" href="/" target="_blank" rel="noopener">' + esc(skT(lang, 'poweredBy')) + '</a></div></div></footer>';
  }
  function drawer(ctx){
    var lang = ctx.lang;
    return '<div class="drawer" id="drawer" aria-hidden="true"><div class="dr-scrim" data-cart-x></div><aside class="dr-panel" role="dialog" aria-label="' + attr(skT(lang, 'cart')) + '">'
      + '<div class="dr-head"><b>' + esc(skT(lang, 'bag')) + '</b><button class="sh-ic" data-cart-x aria-label="Close">' + IC.close + '</button></div>'
      + '<div class="dr-lines" data-lines></div><div class="dr-foot" data-cart-foot></div></aside></div>';
  }

  /* ---------- pages ---------- */
  function pageHome(ctx){
    var html = ctx.th.sections.filter(function(x){ return x.on !== false; }).map(function(x){
      try { return SEC[x.type] ? '<div class="secwrap" data-sec="' + attr(x.id) + '">' + SEC[x.type](x, ctx) + '</div>' : ''; } catch(e){ return ''; }
    }).join('');
    if(!ctx.products.length && !ctx.preview) html += '<section class="sec"><div class="wrap narrow" style="text-align:center"><p class="muted">' + esc(skT(ctx.lang, 'noResults')) + '</p></div></section>';
    return html;
  }
  function pageShop(ctx){
    var q = ctx.query || {}, L = ctx.L, lang = ctx.lang, list = ctx.products.slice(), cats = categories(ctx.products);
    var cat = q.c || '', term = (q.q || '').trim().toLowerCase(), sort = q.s || 'new';
    if(cat) list = list.filter(function(p){ return (p.category || '').toLowerCase() === cat.toLowerCase(); });
    if(term) list = list.filter(function(p){ return (p.title + ' ' + (p.category || '') + ' ' + (p.tags || '')).toLowerCase().indexOf(term) >= 0; });
    if(sort === 'low') list.sort(function(a, b){ return priceRange(a).min - priceRange(b).min; });
    else if(sort === 'high') list.sort(function(a, b){ return priceRange(b).min - priceRange(a).min; });
    else list.sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
    return '<section class="sec shop"><div class="wrap"><div class="shop-head"><h1 class="h-page">' + esc(cat || skT(lang, 'shop')) + '</h1><span class="muted">' + esc(skT(lang, 'results', { n: list.length })) + '</span></div>'
      + '<div class="shop-bar"><div class="chips"><a class="chip' + (!cat ? ' on' : '') + '" href="' + attr(L.shop) + '">' + esc(skT(lang, 'all')) + '</a>' + cats.map(function(c){ return '<a class="chip' + (c.toLowerCase() === cat.toLowerCase() ? ' on' : '') + '" href="' + attr(L.cat(c)) + '">' + esc(c) + '</a>'; }).join('') + '</div>'
      + '<form class="shop-tools" method="get" action="' + attr(L.shop) + '">' + (cat ? '<input type="hidden" name="c" value="' + attr(cat) + '">' : '') + '<input class="in" type="search" name="q" value="' + attr(q.q || '') + '" placeholder="' + attr(skT(lang, 'search')) + '">'
      + '<select class="in" name="s" data-autosubmit><option value="new"' + (sort === 'new' ? ' selected' : '') + '>' + esc(skT(lang, 'sortNewest')) + '</option><option value="low"' + (sort === 'low' ? ' selected' : '') + '>' + esc(skT(lang, 'sortLow')) + '</option><option value="high"' + (sort === 'high' ? ' selected' : '') + '>' + esc(skT(lang, 'sortHigh')) + '</option></select></form></div>'
      + (list.length ? '<div class="grid-p">' + list.map(function(p, i){ return card(p, L, ctx, i); }).join('') + '</div>' : '<p class="empty muted">' + esc(skT(lang, 'noResults')) + '</p>') + '</div></section>';
  }
  function pageProduct(ctx){
    var p = ctx.product, L = ctx.L, lang = ctx.lang, imgs = (p.images || []).map(safeUrl).filter(Boolean), pr = priceRange(p), st = ctx.st;
    var gal = imgs.length ? imgs.map(function(u, i){ return '<figure class="gi" data-i="' + i + '"><img src="' + attr(u) + '" alt="' + attr(p.title) + '" ' + (i ? 'loading="lazy"' : 'fetchpriority="high"') + ' decoding="async"></figure>'; }).join('')
      : '<figure class="gi"><div class="ph">' + teeSvg(ctx.th.s.colors.surface, ctx.th.s.colors.text) + '</div></figure>';
    var thumbs = imgs.length > 1 ? '<div class="thumbs">' + imgs.map(function(u, i){ return '<button class="th' + (i ? '' : ' on') + '" data-th="' + i + '" aria-label="' + (i + 1) + '"><img src="' + attr(u) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '';
    var opts = (p.options || []).map(function(o, oi){
      var isColor = /colou?r|لون/i.test(o.name);
      return '<fieldset class="opt" data-opt="' + oi + '"><legend>' + esc(o.name) + ': <b data-optv="' + oi + '"></b></legend><div class="opt-vals' + (isColor ? ' is-color' : '') + '">' + o.values.map(function(v){
        var c = isColor ? skColor(v) : null;
        return '<label class="ov' + (c ? ' sw' : '') + '"><input type="radio" name="o' + oi + '" value="' + attr(v) + '"><span' + (c ? ' style="--c:' + c + '"' : '') + '>' + (c ? '<i></i><em>' + esc(v) + '</em>' : esc(v)) + '</span></label>'; }).join('') + '</div></fieldset>';
    }).join('');
    var sale = p.compareAt && +p.compareAt > pr.min;
    var delivery = (st.policies && st.policies.shipping) || '';
    var related = ctx.products.filter(function(q){ return q.pid !== p.pid && (!p.category || (q.category || '') === p.category); }).slice(0, 4);
    if(related.length < 4) related = related.concat(ctx.products.filter(function(q){ return q.pid !== p.pid && related.indexOf(q) < 0; }).slice(0, 4 - related.length));
    return '<section class="pdp"><div class="wrap pdp-grid"><div class="pdp-gal"><div class="gallery" data-gallery>' + gal + '</div>' + thumbs + '</div>'
      + '<div class="pdp-info"><nav class="crumbs"><a href="' + attr(L.shop) + '">' + esc(skT(lang, 'shop')) + '</a>' + (p.category ? ' / <a href="' + attr(L.cat(p.category)) + '">' + esc(p.category) + '</a>' : '') + '</nav>'
      + '<h1 class="h-pdp">' + esc(p.title) + '</h1><div class="pdp-price"><span class="now" data-price>' + money(pr.min, lang) + '</span>' + (sale ? '<s data-compare>' + money(p.compareAt, lang) + '</s><span class="pb pb-sale">−' + Math.round((1 - pr.min / p.compareAt) * 100) + '%</span>' : '') + '</div>'
      + '<form class="buy" data-buy>' + opts
      + '<div class="buy-row"><div class="qty"><button type="button" data-q="-1" aria-label="−">' + IC.minus + '</button><input type="number" name="qty" value="1" min="1" max="99" inputmode="numeric" aria-label="' + attr(skT(lang, 'quantity')) + '"><button type="button" data-q="1" aria-label="+">' + IC.plus + '</button></div>'
      + '<button class="btn btn-main btn-add" type="submit" data-add>' + IC.bag + '<span>' + esc(skT(lang, 'addToCart')) + '</span></button></div>'
      + '<button class="btn btn-ghost btn-block" type="button" data-buynow>' + esc(skT(lang, 'buyNow')) + '</button><p class="stock" data-stock></p></form>'
      + '<div class="pdp-cod">' + IC.cash + '<span><b>' + esc(skT(lang, 'cod')) + '</b> — ' + esc(skT(lang, 'codNote')) + '</span></div>'
      + (p.description ? '<details class="acc" open><summary>' + esc(skT(lang, 'description')) + '<i></i></summary><div class="rte"><p>' + para(p.description) + '</p></div></details>' : '')
      + (p.sizeGuide ? '<details class="acc"><summary>' + esc(skT(lang, 'sizeGuide')) + '<i></i></summary><div class="rte sizeguide"><p>' + para(p.sizeGuide) + '</p></div></details>' : '')
      + (delivery ? '<details class="acc"><summary>' + esc(skT(lang, 'delivery')) + '<i></i></summary><div class="rte"><p>' + para(delivery) + '</p></div></details>' : '')
      + '</div></div></section>'
      + (related.length ? '<section class="sec sec-products"><div class="wrap"><div class="sec-head"><h2 class="h-sec">' + esc(skT(lang, 'youMayLike')) + '</h2></div><div class="grid-p">' + related.map(function(q, i){ return card(q, L, ctx, i); }).join('') + '</div></div></section>' : '')
      + '<div class="sticky-buy" data-sticky><div class="wrap"><span class="sb-t">' + esc(p.title) + '<b data-price2>' + money(pr.min, lang) + '</b></span><button class="btn btn-main" data-add2>' + esc(skT(lang, 'addToCart')) + '</button></div></div>';
  }
  function pageCart(ctx){
    return '<section class="sec cartpage"><div class="wrap narrow"><h1 class="h-page">' + esc(skT(ctx.lang, 'bag')) + '</h1><div class="cart-lines" data-lines></div><div class="cart-foot" data-cart-foot></div></div></section>';
  }
  function govOptions(lang){ return '<option value="">' + esc(skT(lang, 'chooseGov')) + '</option>' + SK_GOVS.map(function(g){ return '<option value="' + attr(g[0]) + '">' + esc(lang === 'ar' ? g[1] : g[0]) + '</option>'; }).join(''); }
  function pageCheckout(ctx){
    var lang = ctx.lang, co = ctx.st.checkout || {}, t = function(k, v){ return esc(skT(lang, k, v)); };
    var emailMode = co.email || 'optional';
    function f(name, label, type, req, extra){ return '<label class="fld"><span>' + label + (req ? '' : ' <i>(' + t('optional') + ')</i>') + '</span><input class="in" name="' + name + '" type="' + (type || 'text') + '"' + (req ? ' required' : '') + (extra || '') + '></label>'; }
    return '<section class="sec checkout"><div class="wrap co-grid"><form class="co-form" data-checkout novalidate>'
      + '<h1 class="h-page">' + t('checkout') + '</h1>'
      + '<fieldset><legend>' + t('contactInfo') + '</legend>' + f('name', t('fullName'), 'text', true, ' autocomplete="name" maxlength="80"') + f('phone', t('phone'), 'tel', true, ' autocomplete="tel" inputmode="tel" placeholder="01xxxxxxxxx" maxlength="20"')
      + (emailMode !== 'hidden' ? f('email', t('email'), 'email', emailMode === 'required', ' autocomplete="email" maxlength="120"') : '') + '</fieldset>'
      + '<fieldset><legend>' + t('deliveryAddress') + '</legend><label class="fld"><span>' + t('governorate') + '</span><select class="in" name="gov" required data-gov>' + govOptions(lang) + '</select></label>'
      + f('city', t('city'), 'text', true, ' autocomplete="address-level2" maxlength="80"') + f('address', t('address'), 'text', true, ' autocomplete="street-address" maxlength="200"') + f('landmark', t('landmark'), 'text', false, ' maxlength="120"')
      + (co.notes !== false ? '<label class="fld"><span>' + t('notes') + ' <i>(' + t('optional') + ')</i></span><textarea class="in" name="notes" rows="2" maxlength="400"></textarea></label>' : '') + '</fieldset>'
      + '<fieldset><legend>' + t('payment') + '</legend><label class="pay on"><input type="radio" name="pay" value="cod" checked><span><b>' + t('cod') + '</b><small>' + t('codNote') + '</small></span>' + IC.cash + '</label></fieldset>'
      + '<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">'
      + '<p class="co-err" data-err role="alert"></p><button class="btn btn-main btn-block btn-place" type="submit" data-place>' + t('placeOrder') + '</button></form>'
      + '<aside class="co-sum"><h2 class="h-small">' + t('orderSummary') + '</h2><div class="cart-lines mini" data-lines></div>'
      + '<div class="code-row"><input class="in" name="code" placeholder="' + attr(skT(lang, 'discountCode')) + '" data-code maxlength="30"><button class="btn btn-ghost" type="button" data-apply>' + t('apply') + '</button></div><p class="code-msg" data-code-msg></p>'
      + '<div class="totals" data-totals></div></aside></div></section>';
  }
  function pageOrder(ctx){
    var o = ctx.order, lang = ctx.lang, t = function(k, v){ return esc(skT(lang, k, v)); };
    if(!o) return pageNotFound(ctx);
    var items = o.items || [];
    var wa = waLink(ctx.st.contact.whatsapp || ctx.st.contact.phone, skT(lang, 'orderNumber') + ' #' + o.number);
    return '<section class="sec orderpage"><div class="wrap narrow"><div class="ok-mark">✓</div><div class="eyebrow">' + t('orderNumber') + ' #' + esc(o.number) + '</div><h1 class="h-page">' + t('thanks', { name: String(o.name || '').split(' ')[0] }) + '</h1>'
      + '<p class="lead">' + t('orderPlaced') + ' ' + t('weWillCall', { phone: o.phone || '' }) + '</p>'
      + '<div class="o-status">' + statusSteps(o.status, lang) + '</div>'
      + '<div class="card o-card"><div class="cart-lines mini">' + items.map(function(it){ var u = safeUrl(it.image); return '<div class="cl"><div class="cl-img">' + (u ? '<img src="' + attr(u) + '" alt="">' : '') + '<span class="q">' + (+it.qty) + '</span></div><div class="cl-t"><b>' + esc(it.title) + '</b><small>' + esc(it.variant || '') + '</small></div><span class="cl-p">' + money(it.price * it.qty, lang) + '</span></div>'; }).join('') + '</div>'
      + '<div class="totals">' + trow(t('subtotal'), money(o.subtotal, lang)) + (o.discount ? trow(t('discount') + (o.code ? ' · ' + esc(o.code) : ''), '−' + money(o.discount, lang)) : '') + trow(t('shipping'), o.shipping ? money(o.shipping, lang) : t('free')) + (o.codFee ? trow(t('codFee'), money(o.codFee, lang)) : '') + trow('<b>' + t('total') + '</b>', '<b>' + money(o.total, lang) + '</b>') + '</div>'
      + '<div class="o-addr"><b>' + t('deliveryAddress') + '</b><p>' + esc(o.name) + '<br>' + esc(o.address || '') + (o.landmark ? '<br>' + esc(o.landmark) : '') + '<br>' + esc(o.city || '') + ' — ' + esc(govName(o.gov, lang)) + '<br>' + esc(o.phone || '') + '</p></div></div>'
      + '<div class="o-acts"><a class="btn btn-main" href="' + attr(ctx.L.shop) + '">' + t('keepShopping') + '</a>' + (wa ? '<a class="btn btn-ghost" href="' + attr(wa) + '" target="_blank" rel="noopener">' + IC.wa + t('messageUs') + '</a>' : '') + '</div></div></section>';
  }
  function trow(a, b){ return '<div class="tr"><span>' + a + '</span><span>' + b + '</span></div>'; }
  function govName(g, lang){ var r = SK_GOVS.filter(function(x){ return x[0] === g; })[0]; return r ? (lang === 'ar' ? r[1] : r[0]) : (g || ''); }
  function statusSteps(status, lang){
    var steps = ['new', 'confirmed', 'shipped', 'delivered'], st = skT(lang, 'status');
    if(status === 'cancelled') return '<div class="steps"><span class="step x on">' + esc(st.cancelled) + '</span></div>';
    var at = Math.max(0, steps.indexOf(status));
    return '<div class="steps">' + steps.map(function(s, i){ return '<span class="step' + (i <= at ? ' on' : '') + '">' + esc(st[s]) + '</span>'; }).join('') + '</div>';
  }
  function pageTrack(ctx){
    var lang = ctx.lang, t = function(k){ return esc(skT(lang, k)); };
    return '<section class="sec trackpage"><div class="wrap narrow"><h1 class="h-page">' + t('trackOrder') + '</h1><p class="muted">' + t('trackHint') + '</p>'
      + '<form class="track-form" data-track><input class="in" name="n" inputmode="numeric" placeholder="#1001" required maxlength="10"><input class="in" name="phone" type="tel" placeholder="01xxxxxxxxx" required maxlength="20"><button class="btn btn-main" type="submit">' + t('track') + '</button></form>'
      + '<div data-track-out></div></div></section>';
  }
  function pageInfo(ctx){
    var id = ctx.pageId, lang = ctx.lang, st = ctx.st, title, body;
    if(id === 'about'){ title = skT(lang, 'about'); body = st.about; }
    else if(id === 'contact'){ title = skT(lang, 'contact'); body = [st.contact.phone, st.contact.email, st.contact.address].filter(Boolean).join('\n'); }
    else { var map = { returns: 'returns', shipping: 'delivery', privacy: 'privacy', terms: 'terms' }; title = map[id] ? skT(lang, map[id]) : ''; body = (st.policies || {})[id]; }
    if(!title || !body) return pageNotFound(ctx);
    return '<section class="sec infopage"><div class="wrap narrow"><h1 class="h-page">' + esc(title) + '</h1><div class="rte"><p>' + para(body) + '</p></div>'
      + (id === 'contact' || id === 'about' ? '<div class="sf-soc big">' + socials(ctx) + '</div>' : '') + '</div></section>';
  }
  function pageNotFound(ctx){ return '<section class="sec nf"><div class="wrap narrow" style="text-align:center"><div class="eyebrow">404</div><h1 class="h-page">' + esc(skT(ctx.lang, 'notFound')) + '</h1><a class="btn btn-main" href="' + attr(ctx.L.home) + '">' + esc(skT(ctx.lang, 'backHome')) + '</a></div></section>'; }
  function pageClosed(ctx){ return '<section class="closed"><div class="wrap narrow" style="text-align:center"><a class="sh-logo big" href="#">' + logo(ctx) + '</a><h1 class="h-hero">' + esc(skT(ctx.lang, 'closedTitle')) + '</h1><p class="lead">' + esc(skT(ctx.lang, 'closedText')) + '</p></div></section>'; }

  /* ---------- product data for the browser (variants, stock, prices) ---------- */
  function clientProduct(p){
    return { pid: p.pid, h: p.handle, t: p.title, p: +p.price || 0, c: +p.compareAt || 0, img: safeUrl(p.images && p.images[0]), imgs: (p.images || []).map(safeUrl).filter(Boolean),
             o: (p.options || []).map(function(o){ return { n: o.name, v: o.values }; }), v: (p.variants || []).map(function(v){ return { id: v.id, o: v.o, p: v.price != null && v.price !== '' ? +v.price : null, s: v.stock == null ? null : +v.stock }; }),
             vi: p.variantImages || {}, ts: !!p.trackStock, s: p.stock == null ? null : +p.stock };
  }

  /* ---------- the whole document ---------- */
  function page(ctx){
    var th = skNormTheme(ctx.theme), st = ctx.settings || {};
    st.contact = st.contact || {}; st.policies = st.policies || {}; st.checkout = st.checkout || {}; st.shipping = st.shipping || {};
    var lang = ctx.lang === 'ar' ? 'ar' : 'en';
    var base = ctx.base != null ? ctx.base : '';
    var products = (ctx.products || []).filter(function(p){ return p.status !== 'draft'; });
    var c = { th: th, st: st, lang: lang, L: linker(base), products: products, preview: !!ctx.preview, demo: !!ctx.demo, storeName: ctx.storeName || 'Store', logoUrl: ctx.logoUrl || '',
              query: ctx.query, product: ctx.product, order: ctx.order, pageId: ctx.pageId };
    var kind = ctx.page || 'home', main;
    if(kind === 'shop') main = pageShop(c);
    else if(kind === 'product') main = c.product ? pageProduct(c) : pageNotFound(c);
    else if(kind === 'cart') main = pageCart(c);
    else if(kind === 'checkout') main = pageCheckout(c);
    else if(kind === 'order') main = pageOrder(c);
    else if(kind === 'track') main = pageTrack(c);
    else if(kind === 'info') main = pageInfo(c);
    else if(kind === 'closed') main = pageClosed(c);
    else if(kind === '404') main = pageNotFound(c);
    else { kind = 'home'; main = pageHome(c); }
    var s = th.s, f = s.font, fonts = lang === 'ar' ? [f.headingAr, f.bodyAr, f.heading] : [f.heading, f.body];
    var title = (kind === 'product' && c.product ? c.product.title + ' · ' : kind === 'shop' ? skT(lang, 'shop') + ' · ' : kind === 'checkout' ? skT(lang, 'checkout') + ' · ' : '') + c.storeName;
    var desc = (ctx.seo && ctx.seo.description) || st.about || (c.storeName + ' — ' + skT(lang, 'cod'));
    var ogImg = kind === 'product' && c.product && c.product.images && c.product.images[0] ? safeUrl(c.product.images[0]) : (ctx.logoUrl ? safeUrl(ctx.logoUrl) : '');
    var origin = ctx.origin || '';
    var data = { sid: ctx.sid || '', slug: ctx.slug || '', base: base, lang: lang, preview: !!ctx.preview, page: kind, name: c.storeName,
                 shipping: { flat: +st.shipping.flat || 0, free: +st.shipping.freeOver || 0, govs: st.shipping.govs || {} }, codFee: +(st.checkout.codFee || 0),
                 emailMode: st.checkout.email || 'optional', products: kind === 'closed' ? [] : products.map(clientProduct), i18n: SK_I18N[lang], product: c.product ? c.product.pid : null,
                 whatsapp: st.contact.whatsapp || '', orderId: ctx.order ? ctx.order.oid : null };
    var chrome = kind !== 'closed';
    return '<!DOCTYPE html><html' + htmlAttrs(th, lang) + '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
      + '<title>' + esc(title) + '</title><meta name="description" content="' + attr(String(desc).slice(0, 160)) + '"><meta name="theme-color" content="' + attr(s.colors.bg) + '">'
      + '<meta property="og:title" content="' + attr(title) + '"><meta property="og:description" content="' + attr(String(desc).slice(0, 160)) + '"><meta property="og:type" content="' + (kind === 'product' ? 'product' : 'website') + '">'
      + (ogImg ? '<meta property="og:image" content="' + attr(/^https:/.test(ogImg) ? ogImg : origin + ogImg) + '">' : '') + (ctx.canonical ? '<link rel="canonical" href="' + attr(ctx.canonical) + '">' : '')
      + '<link rel="icon" href="' + attr(ctx.logoUrl ? safeUrl(ctx.logoUrl) : '/icons/icon-32.png') + '">'
      + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="' + attr(skFontsUrl(fonts)) + '">'
      + '<link rel="stylesheet" href="' + attr((ctx.sfBase || '/sf/') + 'store.css?v=' + (ctx.v || '1')) + '"><style>' + themeVars(th, lang) + '</style></head>'
      + '<body class="pg-' + kind + '">'
      + (ctx.ownerPreview ? '<div class="pv-bar">' + esc(skT(lang, 'previewBar')) + ' <a href="/dashboard/settings">Go live →</a></div>' : '')
      + (chrome ? announce(c) + header(c) : '') + '<main id="main">' + main + '</main>' + (chrome ? footer(c) + drawer(c) : '')
      + '<div class="toast-sk" data-toast role="status"></div>'
      + '<script>window.__SK__=' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script><script src="' + attr((ctx.sfBase || '/sf/') + 'runtime.js?v=' + (ctx.v || '1')) + '" defer></script>'
      + '</body></html>';
  }
  /* a link inside a store -> which page it is (for previews that draw pages in place) */
  function route(href, base){
    var u; try { u = new URL(href, 'https://x.invalid'); } catch(e){ return null; }
    if(u.host !== 'x.invalid') return null;
    var path = u.pathname; base = base || '';
    if(base && path.indexOf(base) === 0) path = path.slice(base.length);
    var parts = path.split('/').filter(Boolean).map(function(x){ try { return decodeURIComponent(x); } catch(e){ return x; } });
    var q = {}; u.searchParams.forEach(function(v, k){ q[k] = v; });
    if(!parts.length) return { page: 'home' };
    if(parts[0] === 'shop') return { page: 'shop', query: { c: q.c || '', q: q.q || '', s: q.s || '' } };
    if(parts[0] === 'p' && parts[1]) return { page: 'product', handle: parts[1] };
    if(parts[0] === 'cart') return { page: 'cart' };
    if(parts[0] === 'checkout') return { page: 'checkout' };
    if(parts[0] === 'track') return { page: 'track' };
    if(parts[0] === 'pages' && parts[1]) return { page: 'info', pageId: parts[1] };
    return { page: '404' };
  }
  return { page: page, route: route, esc: esc, money: money, safeUrl: safeUrl, waLink: waLink, categories: categories, priceRange: priceRange, inStock: inStock, govName: govName, IC: IC };
})();
