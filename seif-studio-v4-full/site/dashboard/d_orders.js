/* ============================================================
   ORDERS — the list, one order, its customer, its journey.
   ============================================================ */
var NEXT = { new: ['confirmed', 'Confirm order'], confirmed: ['shipped', 'Mark as shipped'], shipped: ['delivered', 'Mark as delivered'] };
VIEWS.orders = async function(){
  loading();
  var orders = await needOrders(true), f = sessionStorage.getItem('ds.of') || 'all', term = '';
  function counts(){ var c = { all: orders.length }; Object.keys(STATUS).forEach(function(k){ c[k] = orders.filter(function(o){ return o.status === k; }).length; }); return c; }
  function list(){
    var t = term.trim().toLowerCase();
    var rows = orders.filter(function(o){ return (f === 'all' || o.status === f) && (!t || (o.name + ' ' + o.phone + ' ' + o.number + ' ' + o.city + ' ' + o.gov).toLowerCase().indexOf(t) >= 0); });
    q('#oList').innerHTML = rows.length ? '<div class="card lcard"><div class="lst">' + rows.map(orderRow).join('') + '</div></div>'
      : (orders.length ? '<p class="muted" style="padding:30px 4px">Nothing matches.</p>' : empty(DS.I.orders, 'No orders yet.', 'When someone orders from ' + esc(A.store.name) + ', it shows up here — with their number, address and what they bought.', '<button class="btn btn-primary" data-share2>' + X.share + 'Share your store</button>'));
    var sh = q('[data-share2]'); if(sh) sh.onclick = shareStore;
  }
  var c = counts();
  $app.innerHTML = '<div class="view">' + storeBar() + head('Orders', orders.length ? plural(orders.length, 'order', 'orders') + ' · ' + money(orders.filter(function(o){ return o.status !== 'cancelled' && !o.test; }).reduce(function(a, o){ return a + (+o.total || 0); }, 0)) + ' in total' : 'Cash on delivery, from every governorate.',
      orders.length ? '<button class="btn btn-ghost btn-sm" id="oCsv">Export CSV</button>' : '')
    + '<div class="filters" id="oF">' + ['all', 'new', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(function(k){ return '<button data-f="' + k + '"' + (k === f ? ' class="on"' : '') + '>' + (k === 'all' ? 'All' : STATUS[k]) + ' <span class="c">' + c[k] + '</span></button>'; }).join('') + '</div>'
    + (orders.length ? '<div class="toolbar"><input class="input" id="oQ" type="search" placeholder="Search name, phone, order number…"></div>' : '')
    + '<div id="oList"></div></div>';
  qa('#oF button').forEach(function(b){ b.onclick = function(){ f = b.dataset.f; try { sessionStorage.setItem('ds.of', f); } catch(e){} qa('#oF button').forEach(function(x){ x.classList.toggle('on', x === b); }); list(); }; });
  var qi = q('#oQ'); if(qi) qi.oninput = function(){ term = qi.value; list(); };
  var csv = q('#oCsv'); if(csv) csv.onclick = function(){ exportCsv('orders', ['Number', 'Date', 'Status', 'Name', 'Phone', 'Email', 'Governorate', 'City', 'Address', 'Landmark', 'Items', 'Subtotal', 'Discount', 'Code', 'Shipping', 'COD fee', 'Total', 'Notes'],
    orders.map(function(o){ return [o.number, new Date(o.createdAt).toISOString().slice(0, 16).replace('T', ' '), STATUS[o.status], o.name, o.phone, o.email, o.gov, o.city, o.address, o.landmark,
      (o.items || []).map(function(it){ return it.qty + '× ' + it.title + (it.variant ? ' (' + it.variant + ')' : ''); }).join('; '), o.subtotal, o.discount, o.code, o.shipping, o.codFee, o.total, o.notes]; })); };
  list();
};
function exportCsv(name, header, rows){
  var cell = function(v){ v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var text = '﻿' + [header].concat(rows).map(function(r){ return r.map(cell).join(','); }).join('\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = A.store.slug + '-' + name + '-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function waTemplates(o){
  var ar = A.store.lang === 'ar', first = String(o.name || '').split(' ')[0], tot = ar ? Math.round(o.total) + ' ج.م' : money(o.total);
  var addr = [o.address, o.landmark, o.city, govName(o.gov, ar ? 'ar' : 'en')].filter(Boolean).join(ar ? '، ' : ', ');
  return ar ? [
    ['تأكيد الطلب', 'أهلاً ' + first + '، معاك ' + A.store.name + ' 👋\nشكراً على طلبك رقم ' + o.number + ' (' + tot + ').\nممكن تأكد إن العنوان ده صح؟\n' + addr],
    ['الطلب في الطريق', 'أهلاً ' + first + '! طلبك رقم ' + o.number + ' خرج للتوصيل 🚚\nجهّز ' + tot + ' كاش لو سمحت. شكراً لاختيارك ' + A.store.name + '.'],
    ['رسالة عادية', 'أهلاً ' + first + '، معاك ' + A.store.name + ' بخصوص طلبك رقم ' + o.number + '.']
  ] : [
    ['Confirm the order', 'Hi ' + first + ', this is ' + A.store.name + ' 👋\nThanks for your order #' + o.number + ' (' + tot + ').\nCan you confirm we should deliver to:\n' + addr + '?'],
    ['It’s on its way', 'Hi ' + first + '! Your order #' + o.number + ' is out for delivery 🚚\nPlease have ' + tot + ' ready in cash. Thank you for shopping with ' + A.store.name + '.'],
    ['Just a message', 'Hi ' + first + ', this is ' + A.store.name + ' about your order #' + o.number + '.']
  ];
}
function waSheet(o){
  var T = waTemplates(o);
  var box = DS.sheet('wa', '<h2 class="display h-3">Message ' + esc(String(o.name || '').split(' ')[0]) + ' on WhatsApp</h2>'
    + '<div class="chooser" style="margin-top:14px" id="waT">' + T.map(function(t, i){ return '<button data-i="' + i + '"' + (i === 0 ? ' class="on"' : '') + '>' + esc(t[0]) + '</button>'; }).join('') + '</div>'
    + '<textarea class="textarea" id="waTx" style="margin-top:12px;min-height:150px" dir="auto"></textarea>'
    + '<a class="btn btn-wa btn-block" style="margin-top:12px" id="waGo" target="_blank" rel="noopener">' + X.wa + 'Open WhatsApp</a>');
  var tx = box.querySelector('#waTx'), goB = box.querySelector('#waGo');
  function set(i){ tx.value = T[i][1]; upd(); qa('#waT button', box).forEach(function(b){ b.classList.toggle('on', +b.dataset.i === i); }); }
  function upd(){ goB.href = waLink(o.phone, tx.value); }
  tx.oninput = upd;
  qa('#waT button', box).forEach(function(b){ b.onclick = function(){ set(+b.dataset.i); }; });
  goB.onclick = function(){ setTimeout(function(){ DS.closeSheet('wa'); }, 300); };
  set(o.status === 'shipped' || o.status === 'confirmed' ? 1 : 0);
}
function printSlip(o){
  var el = q('#slip'); if(!el){ el = document.createElement('div'); el.id = 'slip'; document.body.appendChild(el); }
  var ar = A.store.lang === 'ar';
  el.innerHTML = '<h2>' + esc(A.store.name) + '</h2><div>' + esc(location.host + '/' + A.store.slug) + '</div>'
    + '<p style="margin-top:14px"><b>Order #' + o.number + '</b> · ' + DS.date(o.createdAt, true) + '</p>'
    + '<p style="margin-top:10px"><b>' + esc(o.name) + '</b><br>' + esc(o.phone) + '<br>' + esc(o.address) + (o.landmark ? '<br>' + esc(o.landmark) : '') + '<br>' + esc(o.city) + ' — ' + esc(govName(o.gov, ar ? 'ar' : 'en')) + '</p>'
    + (o.notes ? '<p><i>' + esc(o.notes) + '</i></p>' : '')
    + '<table><tr><th>Item</th><th>Qty</th><th>Price</th></tr>' + o.items.map(function(it){ return '<tr><td>' + esc(it.title) + (it.variant ? ' — ' + esc(it.variant) : '') + '</td><td>' + it.qty + '</td><td>' + money(it.price * it.qty) + '</td></tr>'; }).join('') + '</table>'
    + '<p>Subtotal ' + money(o.subtotal) + (o.discount ? ' · Discount −' + money(o.discount) : '') + ' · Delivery ' + money(o.shipping) + (o.codFee ? ' · COD fee ' + money(o.codFee) : '') + '</p>'
    + '<p class="tot">Collect on delivery: ' + money(o.total) + '</p>';
  document.body.classList.add('printing');
  setTimeout(function(){ window.print(); setTimeout(function(){ document.body.classList.remove('printing'); }, 300); }, 50);
}
VIEWS.order = async function(n){
  loading();
  var o = (await DS.api('/api/stores/' + A.store.sid + '/orders/' + n)).order;
  function setStatus(s, btn){
    return (async function(){
      if(s === 'cancelled' && !(await ask('Cancel order #' + o.number + '?', 'The items go back into stock. You can restore it later.', 'Cancel order', true))) return;
      if(btn) btn.classList.add('is-busy');
      try {
        o = (await DS.api('/api/stores/' + A.store.sid + '/orders/' + o.number, { status: s }, 'PATCH')).order;
        if(A.orders) A.orders = A.orders.map(function(x){ return x.number === o.number ? o : x; });
        countNew(); A.products = null; draw();
        DS.toast('Order #' + o.number + ' · ' + STATUS[s], 'ok');
      } catch(e){ if(btn) btn.classList.remove('is-busy'); DS.toast(e.message, 'bad'); }
    })();
  }
  function draw(){
    var steps = ['new', 'confirmed', 'shipped', 'delivered'], at = steps.indexOf(o.status), nx = NEXT[o.status];
    var addr = [o.address, o.landmark, o.city, govName(o.gov)].filter(Boolean);
    $app.innerHTML = '<div class="view">' + head('Order <span class="it">#' + o.number + '</span>', DS.date(o.createdAt, true) + ' · ' + badge(o.status) + (o.test ? ' <span class="badge b-muted plain">test order</span>' : ''),
        '<button class="btn btn-ghost btn-sm" id="oPrint">' + X.print + 'Packing slip</button>', ['/dashboard/orders', 'Orders'])
      + '<div class="odet"><div>'
      + '<div class="card panel"><h3>' + plural(orderQty(o), 'item', 'items') + '</h3><div class="oitems" style="margin-top:6px">' + o.items.map(function(it){
          return '<div class="oit"><div class="ph">' + (it.image ? '<img src="' + esc(it.image) + '" alt="">' : '') + '<span class="q">' + it.qty + '</span></div><div><b>' + esc(it.title) + '</b><small>' + esc(it.variant || '') + ' · ' + money(it.price) + ' each</small></div><b>' + money(it.price * it.qty) + '</b></div>';
        }).join('') + '</div>'
      + '<div class="tots"><div><span>Subtotal</span><span>' + money(o.subtotal) + '</span></div>' + (o.discount ? '<div><span>Discount' + (o.code ? ' · ' + esc(o.code) : '') + '</span><span>−' + money(o.discount) + '</span></div>' : '')
      + '<div><span>Delivery · ' + esc(govName(o.gov)) + '</span><span>' + (o.shipping ? money(o.shipping) : 'Free') + '</span></div>' + (o.codFee ? '<div><span>Cash-on-delivery fee</span><span>' + money(o.codFee) + '</span></div>' : '')
      + '<div><span>Collect on delivery</span><span>' + money(o.total) + '</span></div></div></div>'
      + '<div class="card panel"><h3>Journey</h3>' + (o.status === 'cancelled' ? '<div class="stepper x"><span></span><span></span><span></span><span></span></div>' : '<div class="stepper">' + steps.map(function(s, i){ return '<span' + (i <= at ? ' class="on"' : '') + '></span>'; }).join('') + '</div><div class="stepper-l">' + steps.map(function(s){ return '<span>' + STATUS[s] + '</span>'; }).join('') + '</div>')
      + '<div class="flowbtns">' + (nx ? '<button class="btn btn-primary" data-st="' + nx[0] + '">' + nx[1] + '</button>' : '') + (o.status === 'cancelled' ? '<button class="btn btn-primary" data-st="new">Restore order</button>' : o.status !== 'delivered' ? '<button class="btn btn-danger" data-st="cancelled">Cancel order</button>' : '<button class="btn btn-ghost" data-st="shipped">Back to shipped</button>') + '</div>'
      + '<div class="timeline" style="margin-top:16px">' + (o.timeline || []).slice().reverse().map(function(t){ return '<div><i style="background:' + (t.s === 'cancelled' ? 'var(--clay)' : 'var(--accent)') + '"></i><span>' + STATUS[t.s] + '</span><small>' + DS.date(t.t, true) + '</small></div>'; }).join('') + '</div></div>'
      + '<div class="card panel"><h3>Private note <small>only you see this</small></h3><textarea class="textarea" id="oNote" style="margin-top:12px;min-height:80px" placeholder="Courier, tracking number, anything…">' + esc(o.noteInternal || '') + '</textarea></div>'
      + '</div><div>'
      + '<div class="card panel cust"><span class="eyebrow">Customer</span><div style="margin-top:10px"><b>' + esc(o.name) + '</b><p><a class="link" href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a>' + (o.email ? '<br>' + esc(o.email) : '') + '</p>'
      + '<p style="color:var(--fg)">' + addr.map(esc).join('<br>') + '</p>' + (o.notes ? '<p><i>“' + esc(o.notes) + '”</i></p>' : '') + '</div>'
      + '<div class="acts"><button class="btn btn-wa btn-sm" id="oWa">' + X.wa + 'WhatsApp</button><a class="btn btn-ghost btn-sm" href="tel:' + esc(o.phone) + '">' + X.phone + 'Call</a></div>'
      + '<button class="btn btn-ghost btn-sm btn-block" style="margin-top:8px" id="oCopy">' + X.copy + 'Copy address</button></div>'
      + '<div class="card panel"><h3>Payment</h3><p class="sub">Cash on delivery — collect <b style="color:var(--fg)">' + money(o.total) + '</b>.</p></div>'
      + '</div></div></div>';
    qa('[data-st]').forEach(function(b){ b.onclick = function(){ setStatus(b.dataset.st, b); }; });
    q('#oWa').onclick = function(){ waSheet(o); };
    q('#oCopy').onclick = function(){ copyText([o.name, o.phone].concat(addr).join('\n'), 'Address copied'); };
    q('#oPrint').onclick = function(){ printSlip(o); };
    var note = q('#oNote'), saved = o.noteInternal || '';
    note.onblur = async function(){
      if(note.value === saved) return;
      try { o = (await DS.api('/api/stores/' + A.store.sid + '/orders/' + o.number, { note: note.value }, 'PATCH')).order; saved = o.noteInternal || ''; DS.toast('Note saved', 'ok', 1500); }
      catch(e){ DS.toast(e.message, 'bad'); }
    };
  }
  draw();
};
