/* ============================================================
   HOME — what happened, what to do next.
   ============================================================ */
function greeting(){ var h = new Date().getHours(); return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function doneFlag(k, v){ var key = 'ds.done:' + A.store.sid + ':' + k; try { if(v) localStorage.setItem(key, '1'); return !!localStorage.getItem(key); } catch(e){ return false; } }
async function goLive(btn){
  if(!A.canPublish){ location.href = '/pricing'; return; }
  if(btn) btn.classList.add('is-busy');
  try { await saveStore({ published: true }); DS.toast('You’re live — share your link!', 'ok', 4200); route(); }
  catch(e){ if(btn) btn.classList.remove('is-busy'); if(e.data && e.data.error === 'membership'){ location.href = '/pricing'; return; } DS.toast(e.message, 'bad'); }
}
function shareStore(){
  var url = storeBase();
  if(navigator.share) navigator.share({ title: A.store.name, url: url }).catch(function(){});
  else copyText(url, 'Store link copied');
}
VIEWS.home = async function(){
  loading();
  var res = await Promise.all([needProducts(), needOrders(), DS.api('/api/stores/' + A.store.sid + '/stats?days=30')]);
  var products = res[0], orders = res[1], days = res[2].days, s = A.store, live = s.published && A.canPublish;
  var first = (A.session.name || '').split(' ')[0];
  var st = s.settings || {};
  var checks = [
    { k: 'look', t: 'Choose your look', d: 'Colours, fonts and sections', ok: !!s.theme.edited, go: '/dashboard/store' },
    { k: 'product', t: 'Add your first product', d: 'Photos, sizes, price', ok: products.length > 0, go: '/dashboard/products/new' },
    { k: 'ship', t: 'Set your delivery prices', d: 'Flat, by governorate, free over an amount', ok: doneFlag('ship') || Object.keys((st.shipping || {}).govs || {}).length > 0, go: '/dashboard/settings#shipping' },
    { k: 'wa', t: 'Add your WhatsApp number', d: 'So customers can reach you', ok: !!(st.contact && st.contact.whatsapp), go: '/dashboard/settings#contact' },
    { k: 'live', t: A.canPublish ? 'Go live' : 'Start your membership & go live', d: A.canPublish ? 'Open your store to shoppers' : s.published ? 'Your membership has ended' : 'Shoppers can order once you’re live', ok: live, live: true }
  ];
  var nDone = checks.filter(function(c){ return c.ok; }).length, pct = nDone / checks.length;
  var range = 7;
  function sum(n, key){ return days.slice(-n).reduce(function(a, d){ return a + (+d[key] || 0); }, 0); }
  function kpis(){
    var rev = sum(range, 'revenue'), ord = sum(range, 'orders') - sum(range, 'cancelled'), vis = sum(range, 'visitors'), views = sum(range, 'views');
    var prevRev = days.slice(-2 * range, -range).reduce(function(a, d){ return a + (+d.revenue || 0); }, 0);
    var delta = range < 30 && prevRev > 0 ? Math.round((rev - prevRev) / prevRev * 100) : null;
    return '<div class="card kpi"><div class="l">Revenue</div><div class="v">' + Math.round(rev).toLocaleString('en-US') + '<small>EGP</small></div><div class="d' + (delta == null ? '' : delta >= 0 ? ' up' : ' down') + '">' + (delta == null ? 'cash on delivery' : (delta >= 0 ? '+' : '') + delta + '% vs before') + '</div></div>'
      + '<div class="card kpi"><div class="l">Orders</div><div class="v">' + Math.max(0, ord) + '</div><div class="d">' + (A.newOrders ? A.newOrders + ' waiting for you' : 'all caught up') + '</div></div>'
      + '<div class="card kpi"><div class="l">Visitors</div><div class="v">' + vis.toLocaleString('en-US') + '</div><div class="d">' + views.toLocaleString('en-US') + ' page views</div></div>'
      + '<div class="card kpi"><div class="l">Conversion</div><div class="v">' + (vis ? (Math.max(0, ord) / vis * 100).toFixed(1) : '0') + '<small>%</small></div><div class="d">visitors who ordered</div></div>';
  }
  function chart(){
    var max = Math.max.apply(null, days.map(function(d){ return +d.revenue || 0; }).concat([1]));
    return '<div class="chart">' + days.map(function(d, i){
      var v = +d.revenue || 0, h = Math.max(2, v / max * 100);
      return '<div class="b' + (i === days.length - 1 ? ' on' : '') + '" style="height:' + h + '%"><span class="tip">' + new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + Math.round(v).toLocaleString('en-US') + ' EGP · ' + (d.orders || 0) + ' orders</span></div>';
    }).join('') + '</div><div class="chart-x"><span>' + new Date(days[0].day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span><span>Today</span></div>';
  }
  var low = [];
  products.forEach(function(p){
    if(!p.trackStock) return;
    if(p.variants.length) p.variants.forEach(function(v){ if(v.stock != null && v.stock <= 2) low.push({ p: p, label: v.o.join(' / '), n: v.stock }); });
    else if(p.stock != null && p.stock <= 2) low.push({ p: p, label: '', n: p.stock });
  });
  var recent = orders.slice(0, 5);
  $app.innerHTML = '<div class="view">' + storeBar()
    + '<div class="dhead"><div><div class="hello">' + greeting() + (first ? ', <span class="it">' + esc(first) + '.</span>' : '.') + '</div><p>' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</p></div>'
    + '<div class="acts"><a class="btn btn-ghost btn-sm" href="' + esc(storeLink('')) + '" target="_blank" rel="noopener">' + X.ext + 'View store</a><button class="btn btn-primary btn-sm" data-share>' + X.share + 'Share</button></div></div>'
    + (nDone < checks.length ? '<div class="card checklist" style="margin-bottom:16px"><div class="cl-head"><div class="pring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(36,28,20,.1)" stroke-width="3"/><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--olive)" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + (pct * 97.4).toFixed(1) + ' 97.4"/></svg><b>' + nDone + '/' + checks.length + '</b></div>'
      + '<div><h2 class="display h-3">Get ' + esc(s.name) + ' <span class="it">ready to sell.</span></h2><p class="small muted">A few steps and the orders start.</p></div></div>'
      + '<div class="cl-items">' + checks.map(function(c){ return '<button class="cl-item' + (c.ok ? ' done' : '') + '" ' + (c.live ? 'data-golive' : 'data-go="' + c.go + '"') + '><span class="ck">' + DS.I.check + '</span><span class="tx"><b>' + c.t + '</b><small>' + c.d + '</small></span><span class="go">' + X.right + '</span></button>'; }).join('') + '</div></div>' : '')
    + (!live && nDone === checks.length - 1 ? '<div class="golive" style="margin-bottom:16px"><div><b>Everything’s ready.</b><small>' + (A.canPublish ? 'Open the doors — your link starts taking orders.' : 'Start your membership to open your store.') + '</small></div><button class="btn" data-golive>' + (A.canPublish ? 'Go live now' : 'See membership') + '</button></div>' : '')
    + '<div class="row" style="justify-content:space-between;margin:6px 0 12px"><span class="eyebrow">Your numbers</span><div class="seg seg-sm" id="hRange"><button data-r="1">Today</button><button data-r="7" class="on">7 days</button><button data-r="30">30 days</button></div></div>'
    + '<div class="kpis" id="hKpis">' + kpis() + '</div>'
    + '<div class="cols" style="margin-top:16px"><div><div class="card chartbox"><div class="row" style="justify-content:space-between"><span class="eyebrow">Last 30 days</span><span class="tiny">' + Math.round(sum(30, 'revenue')).toLocaleString('en-US') + ' EGP</span></div>' + chart() + '</div>'
    + '<div class="card lcard" style="margin-top:16px"><div class="panel" style="padding-bottom:6px"><h3>Latest orders <a class="tiny link" href="/dashboard/orders">View all</a></h3></div>'
    + (recent.length ? '<div class="lst">' + recent.map(orderRow).join('') + '</div>' : '<p class="muted" style="padding:0 22px 22px">No orders yet. Share your link — the first one is the best one.</p>') + '</div></div>'
    + '<div><div class="quick">'
    + '<button class="qa" data-go="/dashboard/products/new"><span class="ic" style="background:var(--fg)">' + X.plus + '</span>Add product</button>'
    + '<a class="qa" href="/design"><span class="ic" style="background:var(--clay)">' + DS.I.design + '</span>Design in 3D</a>'
    + '<button class="qa" data-go="/dashboard/store"><span class="ic" style="background:var(--accent)">' + X.sparkle + '</span>Edit look</button>'
    + '<button class="qa" data-go="/dashboard/discounts"><span class="ic" style="background:var(--olive)">' + X.percent + '</span>Discounts</button>'
    + '</div>'
    + (low.length ? '<div class="card panel" style="margin-top:16px"><h3>Running low <small>' + low.length + '</small></h3><div style="margin-top:8px">' + low.slice(0, 6).map(function(x){ return '<button class="trow" style="width:100%;text-align:left" data-go="/dashboard/products/' + esc(x.p.pid) + '"><span><b>' + esc(x.p.title) + '</b><small>' + esc(x.label || 'Stock') + '</small></span><span class="badge ' + (x.n ? 'b-shipped' : 'b-cancelled') + '">' + (x.n ? x.n + ' left' : 'Sold out') + '</span></button>'; }).join('') + '</div></div>' : '')
    + '<div class="card panel" style="margin-top:16px"><h3>Your link</h3><p class="sub">Put it in your Instagram bio and WhatsApp status.</p><div class="input-group" style="margin-top:12px"><input class="input" readonly value="' + esc(storeBase()) + '" style="font-family:var(--mono);font-size:13px"><button class="btn btn-sm btn-ghost" style="margin-right:4px" data-copylink>' + X.copy + 'Copy</button></div></div>'
    + '</div></div></div>';
  qa('[data-golive]').forEach(function(b){ b.onclick = function(){ goLive(b); }; });
  qa('[data-share]').forEach(function(b){ b.onclick = shareStore; });
  qa('[data-copylink]').forEach(function(b){ b.onclick = function(){ copyText(storeBase(), 'Store link copied'); }; });
  qa('#hRange button').forEach(function(b){ b.onclick = function(){ range = +b.dataset.r; qa('#hRange button').forEach(function(x){ x.classList.toggle('on', x === b); }); q('#hKpis').innerHTML = kpis(); }; });
};
function orderQty(o){ return Array.isArray(o.items) ? o.items.reduce(function(a, it){ return a + (+it.qty || 0); }, 0) : (+o.qty || 0); }
function orderRow(o){
  var fresh = o.status === 'new';
  return '<a class="lrow' + (fresh ? ' fresh' : '') + '" href="/dashboard/orders/' + o.number + '"><span class="av" style="background:' + (fresh ? 'var(--sky-soft);color:var(--sky)' : 'var(--accent-soft);color:var(--accent)') + '">' + esc(initial(o.name)) + '</span>'
    + '<span class="mn"><b>' + esc(o.name) + (o.test ? ' <span class="badge b-muted plain">test</span>' : '') + '</b><small><span class="num">#' + o.number + '</span> · ' + esc(govName(o.gov)) + ' · ' + plural(orderQty(o), 'item', 'items') + ' · ' + DS.ago(o.createdAt) + '</small></span>'
    + '<span class="rt"><b>' + money(o.total) + '</b>' + badge(o.status) + '</span></a>';
}
