/* ============================================================
   START — sign-in check, load the stores, draw the section, then keep
   an eye out for new orders.
   ============================================================ */
function gate(){
  $app.innerHTML = '<div class="gate view"><span class="logo"><span class="w">Design</span><span class="by">by Seif</span></span>'
    + '<h1 style="margin-top:26px">Your stores, <span class="it">one sign-in away.</span></h1><p>Sign in with Google to open your dashboard — or to create your first store. It’s free to build.</p>'
    + '<button class="btn btn-soft btn-block" id="gIn" style="height:54px;margin-top:26px">' + DS.I.google.replace('<svg', '<svg width="20" height="20"') + 'Continue with Google</button><p class="tiny" id="gMsg" style="margin-top:12px;min-height:18px"></p>'
    + '<p class="tiny subtle">New here? <a class="link" href="/">See what you can build</a></p></div>';
  DS.loadFirebase().catch(function(){});
  var b = q('#gIn'); b.onclick = function(){ DS.signIn(location.pathname + location.search, b, q('#gMsg')); };
}
function tabFor(p){ for(var i = 0; i < ROUTES.length; i++) if(ROUTES[i][0].test(p)) return ROUTES[i][2]; return 'home'; }
(async function(){
  var t = tabFor(location.pathname), s;
  var roots = { home: '/dashboard', orders: '/dashboard/orders', products: '/dashboard/products', store: '/dashboard/store' };
  try {
    s = await DS.boot({ page: 'dashboard', tab: t, nav: t, next: location.pathname, navItems: navItems(), menuItems: menuItems(),
      onNavigate: function(href){ if(/^\/(dashboard|admin)(\/|$|\?|#)/.test(href)){ go(href); return true; } return false; },
      onReselect: function(id){ if(roots[id] && location.pathname !== roots[id]){ go(roots[id]); return true; } return false; } });
  } catch(e){ fail(e); return; }
  A.session = s;
  if(DS.DEMO){ $app.innerHTML = empty(DS.I.store, 'The dashboard needs the server.', 'This copy of the site runs without one, so there are no accounts or stores here. On the live site, sign in and your stores appear.', '<a class="btn btn-primary" href="/">Back home</a>'); return; }
  if(!s.signedIn){ gate(); return; }
  DS.setOpts({ navItems: navItems(), menuItems: menuItems() }); DS.renderTop(); DS.setTab(t);
  try {
    await loadStores();
    var want = null; try { want = localStorage.getItem('ds.sid'); } catch(e){}
    var pick = A.stores.filter(function(x){ return x.sid === want; })[0] || A.stores[0];
    if(pick) await openStore(pick.sid);
    if(A.store) needOrders().catch(function(){});
  } catch(e){ fail(e); return; }
  route();
  /* new orders: look every minute while the page is open */
  setInterval(async function(){
    if(document.hidden || !A.store || A.view === 'theme') return;
    try {
      var before = A.orders ? A.orders.length : null;
      await needOrders(true);
      if(before != null && A.orders.length > before){
        var o = A.orders[0];
        DS.toast('New order #' + o.number + ' · ' + o.name + ' · ' + money(o.total), 'ok', 6000);
        if(A.view === 'orders' || A.view === 'home') route();
      }
    } catch(e){}
  }, 60000);
})();
