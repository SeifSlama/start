/* ============================================================
   LIVE PREVIEW — draws a store inside an iframe with the same renderer the
   server uses, and follows clicks inside it (shop, product, cart…) by
   redrawing in place. Used by the landing page's theme gallery and the
   dashboard's theme editor. Browser only.
   ============================================================ */
var SKP = (function(){
  function make(iframe, opts){
    var st = { route: { page: 'home' }, o: opts || {} };
    function ctx(){
      var o = st.o, r = st.route, products = o.products || [];
      var c = { theme: o.theme, settings: o.settings || {}, lang: o.lang || 'en', base: '', products: products, storeName: o.storeName || 'Your store', logoUrl: o.logo || '',
                preview: true, demo: !!o.demo, sfBase: '/sf/', v: window.SEIF_V || '1', sid: 'preview', slug: 'preview', page: r.page, query: r.query, pageId: r.pageId };
      if(r.page === 'product'){
        c.product = products.filter(function(p){ return p.handle === r.handle || p.pid === r.handle; })[0] || null;
        if(!c.product) c.page = 'shop';
      }
      return c;
    }
    function draw(keepScroll){
      var y = 0;
      try { if(keepScroll && iframe.contentWindow) y = iframe.contentWindow.scrollY || 0; } catch(e){}
      iframe.onload = function(){
        if(y) try { iframe.contentWindow.scrollTo(0, y); } catch(e){}
        if(st.o.onload) st.o.onload();
      };
      iframe.srcdoc = SK.page(ctx());
    }
    function onMsg(e){
      if(e.source !== iframe.contentWindow) return;
      var m = e.data || {};
      if(m.sk === 'nav'){
        var r = SK.route(m.href, '');
        if(r){ st.route = r; draw(false); if(st.o.onroute) st.o.onroute(r); }
      } else if(m.sk === 'select' && st.o.onselect) st.o.onselect(m.sec);
    }
    window.addEventListener('message', onMsg);
    draw(false);
    return {
      update: function(o, keep){ Object.keys(o || {}).forEach(function(k){ st.o[k] = o[k]; }); draw(keep !== false); },
      go: function(r){ st.route = r || { page: 'home' }; draw(false); if(st.o.onroute) st.o.onroute(st.route); },
      focus: function(sec){ try { iframe.contentWindow.postMessage({ sk: 'focus', sec: sec }, '*'); } catch(e){} },
      route: function(){ return st.route; },
      destroy: function(){ window.removeEventListener('message', onMsg); }
    };
  }
  return { make: make };
})();
