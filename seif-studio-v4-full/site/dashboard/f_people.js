/* ============================================================
   CUSTOMERS and DISCOUNTS
   ============================================================ */
var AV_COLORS = [['var(--accent-soft)', 'var(--accent)'], ['var(--olive-soft)', 'var(--olive)'], ['var(--sky-soft)', 'var(--sky)'], ['var(--clay-soft)', 'var(--clay)'], ['var(--amber-soft)', 'var(--amber)']];
function avStyle(s){ var h = 0; String(s || '').split('').forEach(function(c){ h = (h * 31 + c.charCodeAt(0)) >>> 0; }); var c = AV_COLORS[h % AV_COLORS.length]; return 'background:' + c[0] + ';color:' + c[1]; }
VIEWS.customers = async function(){
  loading();
  var res = await Promise.all([needCustomers(true), needOrders()]), list = res[0], term = '', sort = 'recent';
  function rows(){
    var t = term.trim().toLowerCase();
    var r = list.filter(function(c){ return !t || (c.name + ' ' + c.phone + ' ' + c.city + ' ' + c.gov + ' ' + (c.email || '')).toLowerCase().indexOf(t) >= 0; });
    if(sort === 'top') r = r.slice().sort(function(a, b){ return (b.spent || 0) - (a.spent || 0); });
    else if(sort === 'orders') r = r.slice().sort(function(a, b){ return (b.orders || 0) - (a.orders || 0); });
    q('#cList').innerHTML = r.length ? '<div class="card lcard"><div class="lst">' + r.map(function(c){
      return '<button class="lrow" data-ph="' + esc(c.phone) + '"><span class="av" style="' + avStyle(c.phone) + '">' + esc(initial(c.name)) + '</span><span class="mn"><b>' + esc(c.name) + '</b><small>' + esc(c.phone) + ' · ' + esc(govName(c.gov)) + ' · last ' + DS.ago(c.lastAt) + '</small></span>'
        + '<span class="rt"><b>' + money(c.spent) + '</b><small class="tiny">' + plural(c.orders || 0, 'order', 'orders') + '</small></span></button>';
    }).join('') + '</div></div>' : '<p class="muted" style="padding:30px 4px">Nothing matches.</p>';
    qa('[data-ph]').forEach(function(b){ b.onclick = function(){ person(list.filter(function(c){ return c.phone === b.dataset.ph; })[0]); }; });
  }
  function person(c){
    var theirs = (A.orders || []).filter(function(o){ return o.phone === c.phone; });
    var box = DS.sheet('cust', '<div class="row" style="gap:14px"><span class="av" style="width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:22px;font-family:var(--serif);' + avStyle(c.phone) + '">' + esc(initial(c.name)) + '</span><div><h2 class="display h-3">' + esc(c.name) + '</h2><p class="tiny">Customer since ' + DS.date(c.firstAt || c.lastAt) + '</p></div></div>'
      + '<div class="kpis" style="margin-top:18px;grid-template-columns:1fr 1fr"><div class="card kpi"><div class="l">Spent</div><div class="v">' + Math.round(c.spent || 0).toLocaleString('en-US') + '<small>EGP</small></div></div><div class="card kpi"><div class="l">Orders</div><div class="v">' + (c.orders || 0) + '</div></div></div>'
      + '<p style="margin-top:16px;line-height:1.6">' + esc(c.phone) + (c.email ? '<br>' + esc(c.email) : '') + '<br><span class="muted">' + [c.address, c.city, govName(c.gov)].filter(Boolean).map(esc).join(', ') + '</span></p>'
      + '<div class="row" style="margin-top:14px"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + esc(waLink(c.phone, '')) + '">' + X.wa + 'WhatsApp</a><a class="btn btn-ghost btn-sm" href="tel:' + esc(c.phone) + '">' + X.phone + 'Call</a></div>'
      + (theirs.length ? '<h3 style="margin-top:22px;font-size:15px">Orders</h3><div class="lst" style="margin-top:6px">' + theirs.map(orderRow).join('') + '</div>' : ''));
    qa('a[href^="/dashboard"]', box).forEach(function(a){ a.addEventListener('click', function(e){ e.preventDefault(); DS.closeSheet('cust'); go(a.getAttribute('href')); }); });
  }
  $app.innerHTML = '<div class="view">' + storeBar() + head('Customers', list.length ? plural(list.length, 'person', 'people') + ' have ordered from ' + esc(A.store.name) : 'Everyone who orders, with their details and history.', list.length ? '<button class="btn btn-ghost btn-sm" id="cCsv">Export CSV</button>' : '')
    + (list.length ? '<div class="toolbar"><input class="input" id="cQ" type="search" placeholder="Search name, phone, city…"><div class="seg seg-sm" id="cSort"><button data-s="recent" class="on">Recent</button><button data-s="top">Top spenders</button><button data-s="orders">Most orders</button></div></div><div id="cList"></div>'
      : empty(X.people, 'No customers yet.', 'Your first order creates your first customer — name, number, address and everything they bought.'))
    + '</div>';
  if(!list.length) return;
  q('#cQ').oninput = function(){ term = this.value; rows(); };
  qa('#cSort button').forEach(function(b){ b.onclick = function(){ sort = b.dataset.s; qa('#cSort button').forEach(function(x){ x.classList.toggle('on', x === b); }); rows(); }; });
  q('#cCsv').onclick = function(){ exportCsv('customers', ['Name', 'Phone', 'Email', 'Governorate', 'City', 'Address', 'Orders', 'Spent', 'First order', 'Last order'],
    list.map(function(c){ return [c.name, c.phone, c.email, c.gov, c.city, c.address, c.orders, c.spent, c.firstAt ? new Date(c.firstAt).toISOString().slice(0, 10) : '', c.lastAt ? new Date(c.lastAt).toISOString().slice(0, 10) : '']; })); };
  rows();
};

VIEWS.discounts = async function(){
  var list = clone(A.store.discounts || []);
  function save(next, msg){
    return DS.api('/api/stores/' + A.store.sid, { discounts: next }, 'PATCH').then(function(r){ A.store = r.store; list = clone(A.store.discounts); draw(); if(msg) DS.toast(msg, 'ok'); });
  }
  function desc(d){ return d.type === 'ship' ? 'Free delivery' : d.type === 'percent' ? d.value + '% off' : money(d.value) + ' off'; }
  function editor(d, i){
    d = d ? clone(d) : { code: '', type: 'percent', value: 10, min: 0, maxUses: 0, endsAt: '', active: true };
    var box = DS.sheet('disc', '<h2 class="display h-3">' + (i == null ? 'New discount code' : 'Edit ' + esc(d.code)) + '</h2><div class="fgrid">'
      + '<label class="field"><span>Code</span><div class="input-group"><input class="input" id="dCode" maxlength="30" value="' + esc(d.code) + '" placeholder="WELCOME10" style="text-transform:uppercase;font-family:var(--mono)"><button class="btn btn-ghost btn-xs" style="margin-right:6px" id="dGen">Random</button></div></label>'
      + '<div class="field"><span>Type</span><div class="seg" id="dType"><button data-t="percent">% off</button><button data-t="fixed">EGP off</button><button data-t="ship">Free delivery</button></div></div>'
      + '<div class="fgrid two" style="margin-top:0"><label class="field" id="dValF"><span>Value</span><div class="input-group"><input class="input" id="dVal" type="number" min="0" step="any" value="' + esc(d.value) + '"><span class="addon" id="dUnit">%</span></div></label>'
      + field('Minimum order', '<div class="input-group"><input class="input" id="dMin" type="number" min="0" step="any" value="' + esc(d.min || '') + '" placeholder="None"><span class="addon">EGP</span></div>') + '</div>'
      + '<div class="fgrid two" style="margin-top:0">' + field('Usage limit', '<input class="input" id="dMax" type="number" min="0" value="' + esc(d.maxUses || '') + '" placeholder="Unlimited">', d.uses ? 'Used ' + d.uses + ' times so far.' : '')
      + field('Ends', '<input class="input" id="dEnd" type="datetime-local" value="' + esc(d.endsAt || '') + '">', 'Leave empty to keep it running.') + '</div>'
      + '<div class="trow"><span><b>Active</b><small>Turn off to pause the code</small></span><span class="switch"><input type="checkbox" id="dOn"' + (d.active !== false ? ' checked' : '') + '><i></i></span></div>'
      + '</div><div class="row" style="margin-top:18px;justify-content:space-between">' + (i != null ? '<button class="btn btn-danger btn-sm" id="dDel">' + X.trash + 'Delete</button>' : '<span></span>') + '<button class="btn btn-primary" id="dSave">Save code</button></div>');
    function typ(t){ d.type = t; qa('#dType button', box).forEach(function(b){ b.classList.toggle('on', b.dataset.t === t); }); box.querySelector('#dValF').style.display = t === 'ship' ? 'none' : ''; box.querySelector('#dUnit').textContent = t === 'percent' ? '%' : 'EGP'; }
    qa('#dType button', box).forEach(function(b){ b.onclick = function(){ typ(b.dataset.t); }; });
    typ(d.type);
    box.querySelector('#dGen').onclick = function(){ var w = ['NILE', 'CAIRO', 'DROP', 'HELLO', 'SEIF', 'SUN', 'GIFT']; box.querySelector('#dCode').value = w[Math.floor(Math.random() * w.length)] + Math.floor(10 + Math.random() * 89); };
    box.querySelector('#dSave').onclick = async function(){
      var b = this, code = box.querySelector('#dCode').value.trim().toUpperCase().replace(/\s+/g, '');
      if(!/^[A-Z0-9_\-؀-ۿ]{2,30}$/.test(code)){ DS.toast('Codes are 2–30 letters or numbers.', 'bad'); return; }
      if(list.some(function(x, k){ return x.code === code && k !== i; })){ DS.toast('You already have that code.', 'bad'); return; }
      var nd = { code: code, type: d.type, value: +box.querySelector('#dVal').value || 0, min: +box.querySelector('#dMin').value || 0, maxUses: +box.querySelector('#dMax').value || 0, endsAt: box.querySelector('#dEnd').value || '', active: box.querySelector('#dOn').checked };
      if(nd.type === 'percent' && (nd.value <= 0 || nd.value > 100)){ DS.toast('Pick a percentage between 1 and 100.', 'bad'); return; }
      if(nd.type === 'fixed' && nd.value <= 0){ DS.toast('Add an amount.', 'bad'); return; }
      var next = clone(list); if(i == null) next.unshift(nd); else next[i] = nd;
      b.classList.add('is-busy');
      try { await save(next, 'Code saved'); DS.closeSheet('disc'); } catch(e){ b.classList.remove('is-busy'); DS.toast(e.message, 'bad'); }
    };
    var del = box.querySelector('#dDel'); if(del) del.onclick = async function(){ var next = clone(list); next.splice(i, 1); try { await save(next, 'Code deleted'); DS.closeSheet('disc'); } catch(e){ DS.toast(e.message, 'bad'); } };
  }
  function draw(){
    $app.innerHTML = '<div class="view">' + storeBar() + head('Discounts', 'Codes shoppers type at checkout. Share them in a story, a drop or a thank-you note.', '<button class="btn btn-primary btn-sm" id="dNew">' + X.plus + 'New code</button>')
      + (list.length ? '<div class="card lcard"><div class="lst">' + list.map(function(d, i){
        var ended = d.endsAt && Date.parse(d.endsAt) < Date.now(), maxed = d.maxUses && d.uses >= d.maxUses;
        return '<button class="lrow" data-di="' + i + '"><span class="av" style="border-radius:14px;background:var(--surface-2);color:var(--fg);width:48px">' + X.percent + '</span><span class="mn"><b class="mono">' + esc(d.code) + '</b><small>' + desc(d) + (d.min ? ' · over ' + money(d.min) : '') + (d.endsAt ? ' · ends ' + DS.date(Date.parse(d.endsAt)) : '') + '</small></span>'
          + '<span class="rt">' + (d.active === false ? '<span class="badge b-muted">Paused</span>' : ended ? '<span class="badge b-cancelled">Ended</span>' : maxed ? '<span class="badge b-cancelled">Used up</span>' : '<span class="badge b-live">Active</span>') + '<small class="tiny">' + plural(d.uses || 0, 'use', 'uses') + (d.maxUses ? ' of ' + d.maxUses : '') + '</small></span></button>';
      }).join('') + '</div></div>'
        : empty(X.percent, 'No codes yet.', 'Try WELCOME10 for first orders, or free delivery for a weekend.', '<button class="btn btn-primary" id="dNew2">' + X.plus + 'Create a code</button>'))
      + '<div class="card panel" style="margin-top:16px"><h3>Tip</h3><p class="sub">Add a “Promo banner” section to your store with the code on it — shoppers tap to copy it.</p><button class="btn btn-ghost btn-sm" style="margin-top:12px" data-go="/dashboard/store">Edit your store</button></div></div>';
    q('#dNew').onclick = function(){ editor(null, null); };
    var n2 = q('#dNew2'); if(n2) n2.onclick = function(){ editor(null, null); };
    qa('[data-di]').forEach(function(b){ b.onclick = function(){ editor(list[+b.dataset.di], +b.dataset.di); }; });
  }
  draw();
};
