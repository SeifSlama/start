/* ============================================================
   CREATE A STORE — name and address, then a look, then it exists.
   ============================================================ */
function slugify(s){ return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 40); }
VIEWS.create = function(){
  var first = !A.stores.length, qs = new URLSearchParams(location.search);
  var st = { step: 1, name: '', slug: '', slugTouched: false, ok: false, lang: 'en', theme: SK_THEMES[qs.get('theme')] ? qs.get('theme') : 'atelier' };
  var pv = null, chk = 0, timer = 0;
  VIEWS.cleanup = function(){ if(pv) pv.destroy(); };
  function step1(){
    $app.innerHTML = '<div class="wiz view"><div class="wiz-steps"><i class="on"></i><i></i><i></i></div>'
      + (first ? '<span class="eyebrow c-accent">Welcome, ' + esc((A.session.name || '').split(' ')[0] || 'there') + '</span>' : '<button class="back" data-go="/dashboard">' + X.left + 'Dashboard</button>')
      + '<h1 style="margin-top:12px">' + (first ? 'Create your <span class="it">first website.</span>' : 'A new store, <span class="it">a new brand.</span>') + '</h1>'
      + '<p class="lead">Give it a name and an address. You can change both later — nothing is public until you go live.</p>'
      + '<div class="card wiz-card"><div class="fgrid">'
      + field('Store name', '<input class="input" id="wName" maxlength="60" placeholder="e.g. Maison Nour" autocomplete="off">')
      + '<label class="field"><span>Web address</span><div class="input-group slugrow"><span class="addon">' + esc(location.host) + '/</span><input class="input" id="wSlug" maxlength="40" placeholder="maison-nour" autocapitalize="off" autocomplete="off" spellcheck="false"></div><div class="slugmsg" id="wMsg"></div></label>'
      + '<div class="field"><span>Store language</span><div class="seg" id="wLang"><button data-l="en" class="on">English</button><button data-l="ar">العربية</button></div><div class="hint">The words shoppers see. Arabic stores read right to left.</div></div>'
      + '</div><div class="wiz-nav"><button class="btn btn-primary" id="wNext" disabled>Choose a look ' + DS.I.arrow + '</button></div></div></div>';
    var n = q('#wName'), s = q('#wSlug'), msg = q('#wMsg');
    n.value = st.name; s.value = st.slug;
    function check(){
      var v = s.value.trim().toLowerCase();
      st.slug = v; st.ok = false; update();
      clearTimeout(timer);
      if(!v){ msg.textContent = ''; return; }
      if(!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(v) || v.indexOf('--') >= 0){ msg.className = 'slugmsg bad'; msg.textContent = '3–40 letters, numbers or dashes (a–z, 0–9).'; return; }
      msg.className = 'slugmsg'; msg.textContent = 'Checking…';
      var my = ++chk;
      timer = setTimeout(async function(){
        try {
          var r = await DS.api('/api/slug?s=' + encodeURIComponent(v));
          if(my !== chk) return;
          st.ok = !!r.ok;
          msg.className = 'slugmsg ' + (r.ok ? 'ok' : 'bad');
          msg.textContent = r.ok ? '✓ ' + location.host + '/' + v + ' is yours' : r.reason === 'taken' ? 'Already taken — try another.' : 'That address is reserved — try another.';
          update();
        } catch(e){ msg.className = 'slugmsg bad'; msg.textContent = e.message; }
      }, 320);
    }
    function update(){ q('#wNext').disabled = !(st.name.trim() && st.ok); }
    n.oninput = function(){ st.name = n.value; if(!st.slugTouched){ s.value = slugify(n.value); check(); } update(); };
    s.oninput = function(){ st.slugTouched = true; s.value = s.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); check(); };
    qa('#wLang button').forEach(function(b){ b.classList.toggle('on', b.dataset.l === st.lang); b.onclick = function(){ st.lang = b.dataset.l; qa('#wLang button').forEach(function(x){ x.classList.toggle('on', x === b); }); }; });
    q('#wNext').onclick = step2;
    if(st.slug) check();
    setTimeout(function(){ n.focus(); }, 60);
  }
  function step2(){
    $app.innerHTML = '<div class="wiz view" style="max-width:1160px"><div class="wiz-steps"><i class="on"></i><i class="on"></i><i></i></div>'
      + '<button class="back" id="wBack">' + X.left + 'Name & address</button>'
      + '<h1>Pick a <span class="it">look.</span></h1><p class="lead">Every colour, font and section can change later — this is just where you start. Click around the preview: it’s a working store.</p>'
      + '<div class="wiz-themes"><div class="wiz-list" id="wThemes">' + SK_THEME_ORDER.map(function(id){
        var t = SK_THEMES[id], c = t.s.colors;
        return '<button data-t="' + id + '"><span class="sq" style="background:' + c.bg + ';color:' + c.accent + ';box-shadow:inset 0 0 0 1px ' + c.line + ';font-family:\'' + t.s.font.heading + '\',serif">Aa</span><span><b>' + esc(t.name) + '</b><small>' + esc(t.tag) + '</small></span></button>';
      }).join('') + '</div><div><div class="wiz-pv"><div class="vp" id="wVp"><iframe id="wIf" title="Preview"></iframe></div></div>'
      + '<div class="wiz-nav" style="justify-content:flex-end"><button class="btn btn-ghost" id="wRemix">' + X.sparkle + 'Remix</button><button class="btn btn-primary" id="wCreate">Create my store ' + DS.I.arrow + '</button></div></div></div></div>';
    var theme = skNewTheme(st.theme);
    function fit(){ var vp = q('#wVp'), f = q('#wIf'); if(!vp) return; var w = vp.clientWidth < 600 ? 400 : 1280, k = vp.clientWidth / w; f.style.width = w + 'px'; f.style.height = Math.ceil(vp.clientHeight / k) + 'px'; f.style.transform = 'scale(' + k + ')'; }
    function opts(){ return { theme: theme, settings: { contact: {}, shipping: { flat: 60 }, checkout: {} }, lang: st.lang, products: SK_DEMO.products(st.lang), storeName: st.name || 'Your store', demo: true }; }
    function pick(id){
      st.theme = id; theme = skNewTheme(id);
      if(st.lang === 'ar' && id !== 'souk'){ var lay = (theme.sections.filter(function(x){ return x.type === 'hero'; })[0] || {}).layout; theme.sections = skNewTheme('souk').sections.map(function(x){ if(x.type === 'hero' && lay) x.layout = lay; return x; }); theme.s.announce.text = SK_THEMES.souk.s.announce.text; }
      qa('#wThemes button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === id); });
      if(pv){ pv.update(opts(), false); pv.go({ page: 'home' }); } else pv = SKP.make(q('#wIf'), opts());
    }
    fit(); window.addEventListener('resize', fit);
    var old = VIEWS.cleanup; VIEWS.cleanup = function(){ window.removeEventListener('resize', fit); if(old) old(); };
    qa('#wThemes button').forEach(function(b){ b.onclick = function(){ pick(b.dataset.t); }; });
    q('#wBack').onclick = function(){ if(pv){ pv.destroy(); pv = null; } step1(); };
    q('#wRemix').onclick = function(){ theme = skRemix(theme); pv.update({ theme: theme }, true); };
    q('#wCreate').onclick = async function(){
      var b = this; b.classList.add('is-busy');
      try {
        var r = await DS.api('/api/stores', { name: st.name.trim(), slug: st.slug, theme: st.theme, lang: st.lang });
        /* keep a remixed look */
        if(JSON.stringify(theme.s) !== JSON.stringify(skNewTheme(st.theme).s)) await DS.api('/api/stores/' + r.store.sid, { theme: Object.assign(r.store.theme, { s: theme.s }) }, 'PATCH');
        await loadStores(); await openStore(r.store.sid);
        if(pv){ pv.destroy(); pv = null; }
        done();
      } catch(e){ b.classList.remove('is-busy'); DS.toast(e.message, 'bad'); }
    };
    pick(st.theme);
  }
  function done(){
    history.replaceState({}, '', '/dashboard/new');
    $app.innerHTML = '<div class="wiz view"><div class="wiz-steps"><i class="on"></i><i class="on"></i><i class="on"></i></div><div class="done-hero"><div class="big">' + DS.I.check + '</div>'
      + '<h1><span class="it">' + esc(A.store.name) + '</span> exists.</h1><p class="lead" style="margin:16px auto 0">It’s built and private at <b>' + esc(location.host + '/' + A.store.slug) + '</b>. Add a few products, set your delivery prices, then go live.</p>'
      + '<div class="wiz-nav" style="justify-content:center"><a class="btn btn-primary" href="/dashboard/products/new">' + X.plus + 'Add your first product</a><a class="btn btn-ghost" href="/dashboard/store">Customize the look</a><a class="btn btn-ghost" href="/dashboard">Go to dashboard</a></div></div></div>';
  }
  step1();
};
