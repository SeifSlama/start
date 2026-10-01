/* ============================================================
   SETTINGS — the store's details, contact, delivery, checkout,
   policies, going live, and the account.
   ============================================================ */
var UPPER = ['Faiyum', 'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'New Valley', 'Red Sea', 'Matrouh', 'North Sinai', 'South Sinai'];
VIEWS.settings = async function(){
  var s = A.store, st = clone(s.settings || {});
  st.contact = st.contact || {}; st.policies = st.policies || {}; st.shipping = st.shipping || { flat: 60, freeOver: 0, govs: {} }; st.checkout = st.checkout || {}; st.seo = st.seo || {};
  st.shipping.govs = st.shipping.govs || {};
  var f = { name: s.name, slug: s.slug, lang: s.lang, logo: s.logo || '', settings: st }, base = JSON.stringify(f), slugOk = true, chk = 0;
  function changed(){ if(JSON.stringify(f) !== base) savebar(true, { text: 'Unsaved settings', label: 'Save settings', save: save, discard: function(){ VIEWS.settings(); } }); else savebar(false); }
  async function save(){
    if(!String(f.name).trim()){ DS.toast('Your store needs a name.', 'bad'); return; }
    if(f.slug !== s.slug){
      if(!slugOk){ DS.toast('Pick an available web address first.', 'bad'); return; }
      if(!(await ask('Change your address to /' + esc(f.slug) + '?', 'Links to /' + esc(s.slug) + ' will stop working — update your bio and anything you shared.', 'Change it'))) return;
    }
    var patch = { name: f.name.trim(), lang: f.lang, logo: f.logo, settings: f.settings };
    if(f.slug !== s.slug) patch.slug = f.slug;
    await saveStore(patch);
    if(JSON.stringify(f.settings.shipping) !== JSON.stringify(JSON.parse(base).settings.shipping)) doneFlag('ship', true);
    savebar(false); DS.toast('Settings saved', 'ok');
    VIEWS.settings();
  }
  function inp(path, label, opts){
    opts = opts || {};
    var parts = path.split('.'), v = parts.reduce(function(o, k){ return o == null ? '' : o[k]; }, f);
    var tag = opts.area ? '<textarea class="textarea" data-p="' + path + '" maxlength="' + (opts.max || 3000) + '" dir="auto" placeholder="' + esc(opts.ph || '') + '">' + esc(v || '') + '</textarea>'
      : (opts.addon ? '<div class="input-group"><input class="input" data-p="' + path + '"' + (opts.num ? ' data-num type="number" min="0" step="any" inputmode="decimal"' : '') + ' value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(opts.ph || '') + '"><span class="addon">' + opts.addon + '</span></div>'
        : '<input class="input" data-p="' + path + '"' + (opts.num ? ' data-num type="number" min="0" step="any" inputmode="decimal"' : '') + (opts.type ? ' type="' + opts.type + '"' : '') + ' value="' + esc(v == null ? '' : v) + '" maxlength="' + (opts.max || 200) + '" placeholder="' + esc(opts.ph || '') + '" dir="auto">');
    return field(label, tag, opts.hint, opts.cls);
  }
  function govRows(){
    var g = f.settings.shipping.govs, flat = +f.settings.shipping.flat || 0;
    return SK_GOVS.map(function(x){
      var v = g[x[0]], mode = v === false ? 'off' : v != null ? 'own' : 'flat';
      return '<div class="trow" style="padding:8px 0"><span style="min-width:0"><b style="font-size:14.5px">' + esc(x[0]) + '</b><small>' + esc(x[1]) + '</small></span><span class="row" style="gap:6px"><select class="select" data-gm="' + esc(x[0]) + '" style="height:38px;width:auto;font-size:13.5px;padding-right:30px">'
        + '<option value="flat"' + (mode === 'flat' ? ' selected' : '') + '>Standard · ' + flat + '</option><option value="own"' + (mode === 'own' ? ' selected' : '') + '>Own price</option><option value="off"' + (mode === 'off' ? ' selected' : '') + '>No delivery</option></select>'
        + (mode === 'own' ? '<input class="input" type="number" min="0" data-gf="' + esc(x[0]) + '" value="' + esc(v) + '" style="height:38px;width:84px;font-size:14px">' : '') + '</span></div>';
    }).join('');
  }
  var live = s.published && A.canPublish;
  $app.innerHTML = '<div class="view">' + storeBar() + head('Settings', 'Everything about ' + esc(s.name) + ' that isn’t the look.')
    + '<div class="cols"><div>'
    + '<div class="card panel" id="store"><h3>Store</h3><div class="fgrid">' + inp('name', 'Store name', { max: 60 })
    + '<label class="field"><span>Web address</span><div class="input-group slugrow"><span class="addon">' + esc(location.host) + '/</span><input class="input" id="sSlug" value="' + esc(f.slug) + '" maxlength="40" autocapitalize="off" spellcheck="false"></div><div class="slugmsg" id="sMsg"></div></label>'
    + '<div class="field"><span>Store language</span><div class="seg" id="sLang"><button data-l="en"' + (f.lang === 'en' ? ' class="on"' : '') + '>English</button><button data-l="ar"' + (f.lang === 'ar' ? ' class="on"' : '') + '>العربية</button></div><div class="hint">Changes the words shoppers see — your own text stays as you wrote it.</div></div>'
    + '<div class="field"><span>Logo</span><div class="imgfld"><span class="ph" id="sLogoPh" style="width:72px;height:72px">' + (f.logo ? '<img src="' + esc(f.logo) + '" alt="" style="object-fit:contain">' : X.image) + '</span><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-xs" id="sLogo">' + (f.logo ? 'Change' : 'Upload') + '</button>' + (f.logo ? '<button class="btn btn-ghost btn-xs" id="sLogoX">Remove</button>' : '') + '</div></div><div class="hint">A PNG with a transparent background looks best. Without one, your store shows its name.</div></div>'
    + inp('settings.seo.description', 'Search & share description', { area: true, max: 300, ph: 'Heavyweight tees designed in Cairo. Cash on delivery all over Egypt.', hint: 'Shown on Google and when your link is shared.' })
    + '</div></div>'
    + '<div class="card panel" id="contact"><h3>Contact</h3><p class="sub">Shown in your store’s footer and contact page.</p><div class="fgrid two">'
    + inp('settings.contact.whatsapp', 'WhatsApp number', { ph: '01xxxxxxxxx', type: 'tel' }) + inp('settings.contact.phone', 'Phone', { ph: '01xxxxxxxxx', type: 'tel' })
    + inp('settings.contact.email', 'Email', { type: 'email', ph: 'hello@yourbrand.com' }) + inp('settings.contact.instagram', 'Instagram', { ph: '@yourbrand' })
    + inp('settings.contact.facebook', 'Facebook', { ph: 'yourbrand' }) + inp('settings.contact.tiktok', 'TikTok', { ph: '@yourbrand' })
    + inp('settings.contact.address', 'Address', { ph: 'Optional', cls: 'full' }) + inp('settings.about', 'About your brand', { area: true, cls: 'full', max: 3000, ph: 'Who you are, what you make, why.' }) + '</div></div>'
    + '<div class="card panel" id="shipping"><h3>Delivery</h3><p class="sub">What shoppers pay for delivery, by governorate.</p><div class="fgrid two">'
    + inp('settings.shipping.flat', 'Standard delivery', { num: true, addon: 'EGP' }) + inp('settings.shipping.freeOver', 'Free delivery over', { num: true, addon: 'EGP', ph: 'Never', hint: 'Leave 0 for never.' }) + '</div>'
    + '<div class="row" style="margin-top:14px;flex-wrap:wrap"><button class="btn btn-ghost btn-xs" id="sUpper">Upper Egypt & far: +30</button><button class="btn btn-ghost btn-xs" id="sReset">All standard</button></div>'
    + '<div id="sGovs" style="margin-top:8px">' + govRows() + '</div></div>'
    + '<div class="card panel" id="checkout"><h3>Checkout</h3><div class="fgrid two">' + inp('settings.checkout.codFee', 'Cash-on-delivery fee', { num: true, addon: 'EGP', hint: 'Added to every order. Most stores use 0.' })
    + '<label class="field"><span>Email at checkout</span><select class="select" data-p="settings.checkout.email"><option value="optional"' + (st.checkout.email !== 'required' && st.checkout.email !== 'hidden' ? ' selected' : '') + '>Optional</option><option value="required"' + (st.checkout.email === 'required' ? ' selected' : '') + '>Required</option><option value="hidden"' + (st.checkout.email === 'hidden' ? ' selected' : '') + '>Don’t ask</option></select></label></div>'
    + '<div class="trow"><span><b>Order notes</b><small>Let shoppers add a note</small></span><span class="switch"><input type="checkbox" id="sNotes"' + (st.checkout.notes !== false ? ' checked' : '') + '><i></i></span></div></div>'
    + '<div class="card panel" id="policies"><h3>Policies</h3><p class="sub">Each one gets its own page linked from your footer.</p><div class="fgrid">'
    + inp('settings.policies.returns', 'Returns & exchanges', { area: true, max: 6000 }) + inp('settings.policies.shipping', 'Delivery', { area: true, max: 6000 })
    + inp('settings.policies.privacy', 'Privacy', { area: true, max: 8000, ph: 'Optional' }) + inp('settings.policies.terms', 'Terms', { area: true, max: 8000, ph: 'Optional' }) + '</div></div>'
    + '</div><div>'
    + '<div class="card panel"><h3>Your store is ' + (live ? '<span class="badge b-live">Live</span>' : '<span class="badge b-draft">Not live</span>') + '</h3>'
    + (live ? '<p class="sub">Anyone with your link can shop and order.</p><button class="btn btn-ghost btn-sm btn-block" style="margin-top:14px" id="sUnpub">Take it offline</button>'
      : A.canPublish ? '<p class="sub">Only you can see it. Go live when you’re ready.</p><button class="btn btn-primary btn-sm btn-block" style="margin-top:14px" id="sPub">Go live</button>'
      : '<p class="sub">' + (s.published ? 'Your membership has ended, so shoppers see “opening soon”.' : 'Going live needs a membership.') + '</p><a class="btn btn-primary btn-sm btn-block" style="margin-top:14px" href="/pricing">See membership</a>')
    + '</div>'
    + '<div class="card panel"><h3>Membership</h3><p class="sub">' + (A.session.owner ? 'Owner — always active.' : A.session.active ? 'Active' + (A.session.expiresAt ? ' until ' + DS.date(A.session.expiresAt) : '') + '.' : 'Not active.') + '</p><a class="btn btn-ghost btn-sm btn-block" style="margin-top:12px" href="/pricing">Membership details</a></div>'
    + '<div class="card panel"><h3>Account</h3><p class="sub">Signed in as ' + esc(A.session.email) + '</p><button class="btn btn-ghost btn-sm btn-block" style="margin-top:12px" id="sOut">Sign out</button></div>'
    + '</div></div></div>';
  function setPath(path, v){ var parts = path.split('.'), o = f; for(var i = 0; i < parts.length - 1; i++){ if(o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; } o[parts[parts.length - 1]] = v; }
  function bindAll(root){
    qa('[data-p]', root).forEach(function(el){ el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function(){ setPath(el.dataset.p, el.hasAttribute('data-num') ? (el.value === '' ? 0 : Math.max(0, +el.value)) : el.value); if(el.dataset.p === 'settings.shipping.flat'){ q('#sGovs').innerHTML = govRows(); bindGovs(); } changed(); }); });
  }
  function bindGovs(){
    qa('[data-gm]').forEach(function(sel){ sel.onchange = function(){ var g = sel.dataset.gm; if(sel.value === 'flat') delete f.settings.shipping.govs[g]; else if(sel.value === 'off') f.settings.shipping.govs[g] = false; else f.settings.shipping.govs[g] = +f.settings.shipping.flat || 0; q('#sGovs').innerHTML = govRows(); bindGovs(); changed(); }; });
    qa('[data-gf]').forEach(function(inp2){ inp2.oninput = function(){ f.settings.shipping.govs[inp2.dataset.gf] = Math.max(0, +inp2.value || 0); changed(); }; });
  }
  bindAll($app); bindGovs();
  q('#sUpper').onclick = function(){ var fl = +f.settings.shipping.flat || 0; UPPER.forEach(function(g){ if(f.settings.shipping.govs[g] !== false) f.settings.shipping.govs[g] = fl + 30; }); q('#sGovs').innerHTML = govRows(); bindGovs(); changed(); };
  q('#sReset').onclick = function(){ f.settings.shipping.govs = {}; q('#sGovs').innerHTML = govRows(); bindGovs(); changed(); };
  q('#sNotes').onchange = function(){ f.settings.checkout.notes = this.checked; changed(); };
  qa('#sLang button').forEach(function(b){ b.onclick = function(){ f.lang = b.dataset.l; qa('#sLang button').forEach(function(x){ x.classList.toggle('on', x === b); }); changed(); }; });
  var sl = q('#sSlug'), msg = q('#sMsg'), timer = 0;
  sl.oninput = function(){
    sl.value = sl.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); f.slug = sl.value; changed();
    clearTimeout(timer); slugOk = false;
    if(f.slug === s.slug){ slugOk = true; msg.textContent = ''; return; }
    if(!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(f.slug)){ msg.className = 'slugmsg bad'; msg.textContent = '3–40 letters, numbers or dashes.'; return; }
    msg.className = 'slugmsg'; msg.textContent = 'Checking…'; var my = ++chk;
    timer = setTimeout(async function(){ var r = await DS.api('/api/slug?s=' + encodeURIComponent(f.slug)); if(my !== chk) return; slugOk = r.ok; msg.className = 'slugmsg ' + (r.ok ? 'ok' : 'bad'); msg.textContent = r.ok ? '✓ Available' : r.reason === 'taken' ? 'Already taken.' : 'Not available.'; }, 320);
  };
  q('#sLogo').onclick = function(){ var b = this; pickFiles(false, async function(files){ if(!files[0]) return; b.classList.add('is-busy'); try { f.logo = await uploadImage(files[0], { max: 600, png: true }); q('#sLogoPh').innerHTML = '<img src="' + esc(f.logo) + '" alt="" style="object-fit:contain">'; changed(); } catch(e){ DS.toast(e.message, 'bad'); } b.classList.remove('is-busy'); }); };
  var lx = q('#sLogoX'); if(lx) lx.onclick = function(){ f.logo = ''; q('#sLogoPh').innerHTML = X.image; changed(); };
  var pub = q('#sPub'); if(pub) pub.onclick = function(){ goLive(pub); };
  var un = q('#sUnpub'); if(un) un.onclick = async function(){ if(!(await ask('Take ' + esc(s.name) + ' offline?', 'Shoppers will see “opening soon” until you go live again. Nothing is deleted.', 'Take offline', true))) return; try { await saveStore({ published: false }); DS.toast('Your store is offline', 'ok'); VIEWS.settings(); } catch(e){ DS.toast(e.message, 'bad'); } };
  q('#sOut').onclick = function(){ DS.signOut(); };
  if(location.hash){ var t = q(location.hash); if(t) setTimeout(function(){ t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.style.boxShadow = '0 0 0 3px var(--accent-soft), var(--shadow-card)'; }, 200); }
};
