/* ============================================================
   ADMIN (/admin, owner only) — activity, accounts and memberships,
   every store on the platform.
   ============================================================ */
var EVENT_LABEL = { visit: 'Visit', signup: 'New account', login: 'Sign-in', export: 'Export', trial_design: 'Tried studio', wall: 'Sign-in wall', pricing: 'Pricing',
  sub_request: 'Wants membership', access_granted: 'Access given', access_revoked: 'Access removed', payment: 'Payment', payment_failed: 'Payment failed',
  checkout_started: 'Checkout', checkout_failed: 'Checkout failed', design_created: 'New design', design_saved: 'Design saved', store_created: 'New store',
  store_published: 'Store live', store_unpublished: 'Store offline', store_order: 'Store order', contact: 'Message', store_add: 'Design → store' };
VIEWS.admin = async function(){
  var tab = sessionStorage.getItem('ds.atab') || 'activity';
  async function draw(){
    $app.innerHTML = '<div class="view">' + head('Admin', 'Everything happening on Design by Seif.', '<a class="btn btn-ghost btn-sm" href="/dashboard">Your dashboard</a>')
      + '<div class="filters" id="aT"><button data-t="activity">Activity</button><button data-t="accounts">Accounts</button><button data-t="stores">Stores</button></div><div id="aBody"><div class="boot"><span class="spin"></span></div></div></div>';
    qa('#aT button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === tab); b.onclick = function(){ tab = b.dataset.t; try { sessionStorage.setItem('ds.atab', tab); } catch(e){} draw(); }; });
    var body = q('#aBody');
    try {
      if(tab === 'activity'){
        var o = await DS.api('/api/admin/overview'), d = o.days.slice().reverse();
        var keys = ['visit', 'signup', 'store_created', 'store_published', 'store_order', 'sub_request', 'export'];
        body.innerHTML = '<div class="card" style="overflow-x:auto"><table class="vtable" style="margin:0"><tr><th style="padding-left:16px">Day</th>' + keys.map(function(k){ return '<th>' + EVENT_LABEL[k] + '</th>'; }).join('') + '</tr>'
          + d.map(function(r){ return '<tr><td style="padding-left:16px">' + new Date(r.day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + '</td>' + keys.map(function(k){ return '<td>' + (r[k] || 0) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>'
          + '<div class="card lcard feed" style="margin-top:16px"><div class="lst">' + o.events.map(function(e){
            return '<div class="lrow"><span class="ty">' + esc(EVENT_LABEL[e.type] || e.type) + '</span><span class="mn"><b>' + esc(e.email || (e.vid ? 'visitor ' + e.vid.slice(0, 6) : 'someone')) + '</b><small>' + esc(e.detail || e.product || '') + '</small></span><span class="rt"><small class="tiny">' + DS.ago(e.t) + '</small></span></div>';
          }).join('') + '</div></div>';
      } else if(tab === 'accounts'){
        var ac = (await DS.api('/api/admin/accounts')).accounts;
        ac.sort(function(a, b){ return (b.subRequestedAt && !b.activeNow ? 1 : 0) - (a.subRequestedAt && !a.activeNow ? 1 : 0); });
        body.innerHTML = '<div class="card lcard"><div class="lst">' + ac.map(function(a){
          var wants = a.subRequestedAt && !a.activeNow;
          return '<div class="lrow' + (wants ? ' fresh' : '') + '"><span class="av" style="' + avStyle(a.email) + '">' + esc(initial(a.name || a.email)) + '</span><span class="mn"><b>' + esc(a.email || a.uid) + (a.owner ? ' <span class="badge b-ok plain">owner</span>' : '') + '</b><small>' + esc(a.name || '') + ' · joined ' + DS.ago(a.createdAt || a.lastLoginAt || 0) + ' · seen ' + DS.ago(a.lastSeenAt || a.lastLoginAt || 0)
            + (wants ? ' · <b style="color:var(--sky)">asked for membership ' + DS.ago(a.subRequestedAt) + '</b>' : '') + '</small></span>'
            + '<span class="rt">' + (a.activeNow ? '<span class="badge b-live">Member' + (a.expiresAt && !a.owner ? ' · ' + DS.date(a.expiresAt) : '') + '</span>' : '<span class="badge b-draft">Free</span>')
            + (a.owner ? '' : '<span class="row" style="gap:6px"><button class="btn btn-ghost btn-xs" data-grant="' + esc(a.uid) + '">+31 days</button>' + (a.activeNow ? '<button class="btn btn-danger btn-xs" data-revoke="' + esc(a.uid) + '">Revoke</button>' : '') + '</span>') + '</span></div>';
        }).join('') + '</div></div>';
        qa('[data-grant]', body).forEach(function(b){ b.onclick = async function(){ b.classList.add('is-busy'); try { await DS.api('/api/admin/accounts/' + b.dataset.grant, { action: 'grant', days: 31 }); DS.toast('Membership given for 31 days', 'ok'); draw(); } catch(e){ DS.toast(e.message, 'bad'); b.classList.remove('is-busy'); } }; });
        qa('[data-revoke]', body).forEach(function(b){ b.onclick = async function(){ if(!(await ask('Remove membership?', 'Their stores go offline for shoppers.', 'Revoke', true))) return; try { await DS.api('/api/admin/accounts/' + b.dataset.revoke, { action: 'revoke' }); DS.toast('Membership removed', 'ok'); draw(); } catch(e){ DS.toast(e.message, 'bad'); } }; });
      } else {
        var stores = (await DS.api('/api/admin/stores')).stores;
        body.innerHTML = stores.length ? '<div class="card lcard"><div class="lst">' + stores.map(function(s){
          return '<a class="lrow" href="/' + esc(s.slug) + '" target="_blank" rel="noopener"><span class="av">' + esc(initial(s.name)) + '</span><span class="mn"><b>' + esc(s.name) + '</b><small>/' + esc(s.slug) + ' · ' + esc(s.ownerEmail || '') + ' · ' + DS.ago(s.createdAt || 0) + '</small></span><span class="rt">' + (s.published ? '<span class="badge b-live">Published</span>' : '<span class="badge b-draft">Draft</span>') + '<small class="tiny">' + Math.max(0, (s.orderSeq || 1000) - 1000) + ' orders</small></span></a>';
        }).join('') + '</div></div>' : empty(DS.I.store, 'No stores yet.', 'They show up here as people create them.');
      }
    } catch(e){ body.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; }
  }
  draw();
};
