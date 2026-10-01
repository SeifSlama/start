/* ============================================================
   SEIF STUDIO — access + payment server for Cloudflare Pages (_worker.js)

   build.sh copies this file to dist/_worker.js. Upload dist/ to a Cloudflare Pages
   project (drag and drop works). Same API as server/server.js (the Node build):
     POST /api/redeem   {code}           -> signed httpOnly session cookie
     GET  /api/session                   -> {active, plan, expiresAt}
     POST /api/logout
     GET  /api/admin/codes               (Bearer ADMIN_TOKEN) -> {codes}
     POST /api/admin/codes {action,code} (Bearer ADMIN_TOKEN) create|revoke|restore
     POST /api/checkout {method}         -> Paymob iframe URL (card) / redirect (wallet) / reference (Fawry kiosk)
     POST /api/webhook                   <- Paymob transaction callback, HMAC verified, activates the subscription
   Rate limit: /api/redeem 10 attempts per IP per hour, /api/checkout 20 (per worker instance, in memory).

   Data lives in Firebase Firestore, reached over its REST API with a service account:
     codes/{CODE}     {c, active, uses, maxUses, days, createdAt, expiresAt}
     sessions/{sid}   {active, plan, method, code, expiresAt, orderId, paidAt}
     orders/{orderId} {sid}       (Paymob order → session, for the webhook)
   Redeeming writes the code and the new session in one commit guarded by the code's
   updateTime, so concurrent redeems cannot push a code past maxUses. Session updates
   only touch their own fields, so a checkout and a webhook never overwrite each other.

   Secrets (Pages → Settings → Variables and Secrets):
     FIREBASE_SERVICE_ACCOUNT (the whole service-account JSON), SESSION_SECRET (32+ chars), ADMIN_TOKEN,
     PAYMOB_API_KEY, PAYMOB_HMAC, PAYMOB_IFRAME_ID,
     PAYMOB_INTEGRATION_CARD, PAYMOB_INTEGRATION_WALLET, PAYMOB_INTEGRATION_KIOSK
   Vars: PRICE_EGP (default 100), INSECURE_COOKIES (local http dev only),
         FIRESTORE_EMULATOR_HOST + FIREBASE_PROJECT_ID (local tests against the Firestore emulator).

   With none of SESSION_SECRET / ADMIN_TOKEN / FIREBASE_SERVICE_ACCOUNT set, the site is served
   as the demo build (access not enforced) and every /api route answers 503.
   ============================================================ */

/* ---------- config ---------- */
function config(env){
  var secret = env.SESSION_SECRET, admin = env.ADMIN_TOKEN, fb = env.FIREBASE_SERVICE_ACCOUNT || env.FIRESTORE_EMULATOR_HOST;
  if(!secret && !admin && !fb) return { live: false };
  if(!secret || secret.length < 32) return { live: true, error: 'SESSION_SECRET must be set (32+ random chars).' };
  if(!admin) return { live: true, error: 'ADMIN_TOKEN must be set.' };
  if(!fb) return { live: true, error: 'FIREBASE_SERVICE_ACCOUNT must be set (the service-account JSON).' };
  if(!env.FIRESTORE_EMULATOR_HOST){
    try { var sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT); if(!sa.project_id || !sa.client_email || !sa.private_key) throw 0; }
    catch(e){ return { live: true, error: 'FIREBASE_SERVICE_ACCOUNT is not a valid service-account JSON.' }; }
  }
  return { live: true };
}
function priceEgp(env){ return +env.PRICE_EGP || 100; }

/* ---------- entry ---------- */
export default {
  async fetch(request, env){
    var u = new URL(request.url), cfg = config(env);
    if(u.pathname.indexOf('/api/') === 0){
      if(!cfg.live) return json(503, { error: 'demo build: no server configured' });
      if(cfg.error) return json(500, { error: cfg.error });
      return api(request, env);
    }
    var res = await env.ASSETS.fetch(request);
    if(!cfg.live || !(res.headers.get('Content-Type') || '').startsWith('text/html')) return res;
    if(cfg.error) return new Response(cfg.error, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    /* every HTML page gets the live config, so no URL serves the demo build once secrets are set.
       The bundle's first <script> is p0_config.js, which only sets a default when nothing is defined. */
    var html = await res.text();
    var inject = 'window.SEIF_CONFIG = { demo:false, price:' + JSON.stringify(priceEgp(env) + ' EGP') + ', pricePeriod:"/month", apiBase:"" };\n';
    var headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store');
    headers.delete('ETag');
    return new Response(html.replace('<script>\n', '<script>\n' + inject), { status: res.status, headers: headers });
  }
};

/* ---------- helpers ---------- */
class HttpError extends Error { constructor(status, message){ super(message); this.status = status; } }
function json(code, obj, extraHeaders){
  var h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if(extraHeaders) Object.keys(extraHeaders).forEach(function(k){ h.append(k, extraHeaders[k]); });
  return new Response(JSON.stringify(obj), { status: code, headers: h });
}
async function body(request){
  var t = await request.text();
  if(t.length > 1e6) throw new HttpError(413, 'body too large');
  try { return t ? JSON.parse(t) : {}; } catch(e){ throw new HttpError(400, 'bad json'); }
}
function bearer(request){ var a = request.headers.get('Authorization') || ''; return a.indexOf('Bearer ') === 0 ? a.slice(7) : null; }
function safeEq(a, b){
  a = String(a || ''); b = String(b || '');
  if(a.length !== b.length) return false;
  var d = 0; for(var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function b64url(bytes){
  var s = ''; bytes = new Uint8Array(bytes);
  for(var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlText(s){ return b64url(new TextEncoder().encode(s)); }
function hex(bytes){ return Array.from(new Uint8Array(bytes), function(b){ return b.toString(16).padStart(2, '0'); }).join(''); }
async function hmac(hash, key, data){
  var k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: hash }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}
function newSid(){ return b64url(crypto.getRandomValues(new Uint8Array(18))); }
function rand4(){
  var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(4)), s = '';
  for(var i = 0; i < 4; i++) s += A[r[i] % A.length];
  return s;
}

/* rate limits: in memory, per worker instance */
var buckets = {};
function limited(ip, key, max, windowMs){
  var k = key + '|' + ip, now = Date.now();
  var b = buckets[k] || (buckets[k] = []);
  while(b.length && b[0] < now - windowMs) b.shift();
  if(b.length >= max) return true;
  b.push(now); return false;
}

/* ============================================================
   Firestore over REST
   ============================================================ */
var tokenCache = { key: null, token: null, exp: 0 };
async function googleToken(env){
  var sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if(tokenCache.key === sa.client_email && tokenCache.exp > Date.now() + 60e3) return tokenCache.token;
  var now = Math.floor(Date.now() / 1000);
  var head = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claims = b64urlText(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  var pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  var der = Uint8Array.from(atob(pem), function(c){ return c.charCodeAt(0); });
  var key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claims));
  var r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claims + '.' + b64url(sig)
  });
  var j = await r.json().catch(function(){ return {}; });
  if(!r.ok || !j.access_token) throw new Error('firebase auth failed: ' + (j.error_description || j.error || r.status));
  tokenCache = { key: sa.client_email, token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

function db(env){
  var emu = env.FIRESTORE_EMULATOR_HOST;
  var project = emu ? (env.FIREBASE_PROJECT_ID || 'demo-seif') : JSON.parse(env.FIREBASE_SERVICE_ACCOUNT).project_id;
  var root = 'projects/' + project + '/databases/(default)/documents';
  var base = (emu ? 'http://' + emu : 'https://firestore.googleapis.com') + '/v1/';

  async function call(method, path, payload){
    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (emu ? 'owner' : await googleToken(env)) };
    var r = await fetch(base + path, { method: method, headers: headers, body: payload ? JSON.stringify(payload) : undefined });
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok){
      var e = new Error('database: ' + ((j.error && j.error.message) || r.status));
      e.dbStatus = (j.error && j.error.status) || String(r.status);
      throw e;
    }
    return j;
  }
  function name(col, id){ return root + '/' + col + '/' + encodeURIComponent(String(id)); }

  return {
    /* -> {data, updateTime} or null */
    async get(col, id){
      try { var d = await call('GET', name(col, id)); return { data: fromFields(d.fields), updateTime: d.updateTime }; }
      catch(e){ if(e.dbStatus === 'NOT_FOUND') return null; throw e; }
    },
    /* writes: [{col, id, data, fields?: [paths to touch, default all of data], exists?: bool, updateTime?: string}]
       all-or-nothing; throws with dbStatus FAILED_PRECONDITION when a guard fails */
    async commit(writes){
      return call('POST', root.replace(/\/documents$/, '') + '/documents:commit', { writes: writes.map(function(w){
        var out = { update: { name: name(w.col, w.id), fields: toFields(w.data) } };
        if(w.fields) out.updateMask = { fieldPaths: w.fields };
        if(w.updateTime) out.currentDocument = { updateTime: w.updateTime };
        else if(w.exists !== undefined) out.currentDocument = { exists: w.exists };
        return out;
      }) });
    },
    async list(col, orderBy){
      var out = [], token = '';
      do {
        var j = await call('GET', root + '/' + col + '?pageSize=300' + (orderBy ? '&orderBy=' + encodeURIComponent(orderBy) : '') + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
        (j.documents || []).forEach(function(d){ out.push(fromFields(d.fields)); });
        token = j.nextPageToken;
      } while(token);
      return out;
    }
  };
}
function toValue(v){
  if(v === null || v === undefined) return { nullValue: null };
  if(typeof v === 'boolean') return { booleanValue: v };
  if(typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}
function toFields(obj){ var f = {}; Object.keys(obj).forEach(function(k){ f[k] = toValue(obj[k]); }); return f; }
function fromValue(v){
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue' in v) return v.doubleValue;
  if('booleanValue' in v) return v.booleanValue;
  if('stringValue' in v) return v.stringValue;
  if('timestampValue' in v) return Date.parse(v.timestampValue);
  return null;
}
function fromFields(f){ var o = {}; Object.keys(f || {}).forEach(function(k){ o[k] = fromValue(f[k]); }); return o; }

/* ---------- signed cookies ---------- */
async function sign(env, v){ return b64url(await hmac('SHA-256', env.SESSION_SECRET, v)); }
async function cookieHeader(env, sid){
  var v = b64urlText(sid);
  return 'ss_session=' + v + '.' + await sign(env, v) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (60*60*24*40) + (env.INSECURE_COOKIES ? '' : '; Secure');
}
async function readCookie(env, request){
  var raw = (request.headers.get('Cookie') || '').split(';').map(function(s){ return s.trim(); }).filter(function(s){ return s.indexOf('ss_session=') === 0; })[0];
  if(!raw) return null;
  var parts = raw.slice('ss_session='.length).split('.');
  if(parts.length !== 2 || !safeEq(await sign(env, parts[0]), parts[1])) return null;
  try { return atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')); } catch(e){ return null; }
}
async function sessionFor(env, store, request){
  var sid = await readCookie(env, request); if(!sid) return { sid: null, s: null };
  var doc = await store.get('sessions', sid), s = doc ? doc.data : null;
  if(s && s.expiresAt && s.expiresAt < Date.now()) s.active = false;
  return { sid: sid, s: s };
}

/* ---------- Paymob (accept.paymob.com) ---------- */
async function postJson(path, payload){
  var r = await fetch('https://accept.paymob.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  var j; try { j = await r.json(); } catch(e){ throw new Error('paymob: bad response'); }
  if(r.status >= 400) throw new Error(j.message || j.detail || ('paymob ' + r.status));
  return j;
}
async function paymobCheckout(env, store, method, sid){
  if(!env.PAYMOB_API_KEY) throw new Error('payments are not configured');
  var integration = method === 'wallet' ? env.PAYMOB_INTEGRATION_WALLET : (method === 'fawry' ? env.PAYMOB_INTEGRATION_KIOSK : env.PAYMOB_INTEGRATION_CARD);
  if(!integration) throw new Error('that payment method is not enabled');
  var auth = await postJson('/api/auth/tokens', { api_key: env.PAYMOB_API_KEY });
  var cents = Math.round(priceEgp(env) * 100);
  var order = await postJson('/api/ecommerce/orders', {
    auth_token: auth.token, delivery_needed: 'false', amount_cents: cents, currency: 'EGP',
    merchant_order_id: sid + '-' + Date.now(), items: [ { name: 'Seif Studio monthly', amount_cents: cents, quantity: 1 } ]
  });
  var key = await postJson('/api/acceptance/payment_keys', {
    auth_token: auth.token, amount_cents: cents, expiration: 3600, order_id: order.id, currency: 'EGP', integration_id: +integration,
    billing_data: { first_name:'Seif', last_name:'Studio', email:'client@seifstudio.local', phone_number:'+201000000000', apartment:'NA', floor:'NA', street:'NA', building:'NA', shipping_method:'NA', postal_code:'NA', city:'Cairo', country:'EG', state:'NA' }
  });
  /* only orderId/method: an existing session keeps its active/plan/expiresAt */
  await store.commit([
    { col: 'sessions', id: sid, data: { orderId: order.id, method: method }, fields: ['orderId', 'method'] },
    { col: 'orders', id: order.id, data: { sid: sid, createdAt: Date.now() } }
  ]);
  if(method === 'card') return { iframeUrl: 'https://accept.paymob.com/api/acceptance/iframes/' + env.PAYMOB_IFRAME_ID + '?payment_token=' + key.token };
  var pay = await postJson('/api/acceptance/payments/pay', {
    source: method === 'wallet' ? { identifier: 'wallet', subtype: 'WALLET' } : { identifier: 'AGGREGATOR', subtype: 'AGGREGATOR' },
    payment_token: key.token
  });
  if(method === 'wallet') return { iframeUrl: pay.redirect_url || pay.iframe_redirection_url };
  return { reference: pay.data && (pay.data.bill_reference || pay.bill_reference) || pay.id };
}
/* Paymob HMAC: sha512 over these fields in this exact order */
var HMAC_FIELDS = ['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
async function paymobHmacOk(env, obj, given){
  if(!env.PAYMOB_HMAC) return false;
  var s = HMAC_FIELDS.map(function(f){ var v = f.split('.').reduce(function(o, k){ return o == null ? undefined : o[k]; }, obj); return v === undefined || v === null ? '' : String(v); }).join('');
  return safeEq(hex(await hmac('SHA-512', env.PAYMOB_HMAC, s)), given);
}

/* ---------- redeem: read the code, then commit code+session guarded by the code's updateTime ---------- */
async function redeem(store, code){
  if(!/^[A-Z0-9-]{1,40}$/.test(code)) throw new HttpError(400, 'invalid code');
  for(var attempt = 0; attempt < 5; attempt++){
    var doc = await store.get('codes', code), hit = doc && doc.data;
    if(!hit || !hit.active) throw new HttpError(400, 'invalid code');
    if(hit.expiresAt && hit.expiresAt < Date.now()) throw new HttpError(400, 'code expired');
    if(hit.maxUses && hit.uses >= hit.maxUses) throw new HttpError(400, 'code used up');
    var sid = newSid(), sess = { active: true, plan: 'invite', method: 'invite', code: code, expiresAt: Date.now() + (hit.days || 30) * 86400e3 };
    try {
      await store.commit([
        { col: 'codes', id: code, data: { uses: (hit.uses || 0) + 1 }, fields: ['uses'], updateTime: doc.updateTime },
        { col: 'sessions', id: sid, data: sess, exists: false }
      ]);
      return { sid: sid, s: sess };
    } catch(e){ if(e.dbStatus !== 'FAILED_PRECONDITION' && e.dbStatus !== 'ABORTED') throw e; }
  }
  throw new HttpError(503, 'busy, try again');
}

/* ---------- routes ---------- */
async function api(request, env){
  var u = new URL(request.url), p = u.pathname, m = request.method, store = db(env);
  var ip = request.headers.get('CF-Connecting-IP') || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim();
  try {
    if(p === '/api/session' && m === 'GET'){
      var ss = await sessionFor(env, store, request);
      if(!ss.s || !ss.s.active) return json(200, { active: false });
      return json(200, { active: true, plan: ss.s.plan, expiresAt: ss.s.expiresAt });
    }
    if(p === '/api/logout' && m === 'POST'){
      return json(200, { ok: true }, { 'Set-Cookie': 'ss_session=; HttpOnly; Path=/; Max-Age=0' });
    }
    if(p === '/api/redeem' && m === 'POST'){
      if(limited(ip, 'redeem', 10, 3600e3)) return json(429, { error: 'too many attempts' });
      var b = await body(request), code = String(b.code || '').trim().toUpperCase();
      var got = await redeem(store, code);
      return json(200, { active: true, plan: 'invite', expiresAt: got.s.expiresAt }, { 'Set-Cookie': await cookieHeader(env, got.sid) });
    }
    if(p === '/api/checkout' && m === 'POST'){
      if(limited(ip, 'checkout', 20, 3600e3)) return json(429, { error: 'too many attempts' });
      var cb = await body(request), method = ['card','wallet','fawry'].indexOf(cb.method) >= 0 ? cb.method : 'card';
      var cs = await sessionFor(env, store, request), csid = cs.sid || newSid();
      var r = await paymobCheckout(env, store, method, csid);
      return json(200, r, { 'Set-Cookie': await cookieHeader(env, csid) });
    }
    if(p === '/api/webhook' && m === 'POST'){
      var wb = await body(request), obj = wb.obj || wb, given = u.searchParams.get('hmac') || wb.hmac;
      if(!(await paymobHmacOk(env, obj, given))) return json(401, { error: 'bad hmac' });
      var orderId = obj.order && obj.order.id, ok = obj.success === true || obj.success === 'true';
      var od = orderId != null ? await store.get('orders', orderId) : null;
      if(od && od.data.sid && ok){
        var now = Date.now();
        await store.commit([{ col: 'sessions', id: od.data.sid, fields: ['active', 'plan', 'expiresAt', 'paidAt'],
          data: { active: true, plan: 'monthly', expiresAt: now + 31 * 86400e3, paidAt: now } }]);
      }
      return json(200, { ok: true });
    }
    if(p === '/api/admin/codes'){
      if(!safeEq(bearer(request), env.ADMIN_TOKEN)) return json(401, { error: 'unauthorised' });
      if(m === 'GET') return json(200, { codes: await store.list('codes', 'createdAt desc') });
      var ab = await body(request);
      if(ab.action === 'create'){
        var c = 'SEIF-' + rand4() + '-' + rand4();
        await store.commit([{ col: 'codes', id: c, exists: false,
          data: { c: c, active: true, uses: 0, maxUses: +ab.maxUses || 0, days: +ab.days || 30, createdAt: Date.now(), expiresAt: ab.expiresAt || null } }]);
      } else if(ab.action === 'revoke' || ab.action === 'restore'){
        if(!/^[A-Z0-9-]{1,40}$/.test(String(ab.code || ''))) return json(400, { error: 'unknown code' });
        try { await store.commit([{ col: 'codes', id: String(ab.code || ''), exists: true, fields: ['active'], data: { active: ab.action === 'restore' } }]); }
        catch(e){ if(e.dbStatus !== 'NOT_FOUND' && e.dbStatus !== 'FAILED_PRECONDITION') throw e; }
      } else return json(400, { error: 'unknown action' });
      return json(200, { codes: await store.list('codes', 'createdAt desc') });
    }
    return json(404, { error: 'not found' });
  } catch(e){
    return json(e.status || 500, { error: e.message || 'server error' });
  }
}
