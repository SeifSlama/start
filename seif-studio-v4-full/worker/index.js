/* ============================================================
   SEIF STUDIO — accounts, access, payments and saved designs
   Cloudflare Pages advanced mode: build.sh copies this file to dist/_worker.js.

   Customers sign in with Google (Firebase Authentication, in the browser); the ID token is
   exchanged once for a signed httpOnly cookie that carries their uid. Subscriptions and
   designs belong to the account, so they follow the customer to any device.

     POST /api/login {idToken}           -> verifies the Firebase ID token, sets the session cookie
     GET  /api/session                   -> {signedIn, email, name, active, plan, expiresAt}
     POST /api/logout
     POST /api/redeem   {code}           (signed in) invite code -> activates / extends the account
     POST /api/checkout {method}         (signed in) Paymob iframe URL (card) / redirect (wallet) / reference (Fawry)
     POST /api/webhook                   <- Paymob transaction callback, HMAC verified, activates the account (31 days)
     GET  /api/admin/codes               (Bearer ADMIN_TOKEN) -> {codes}
     POST /api/admin/codes {action,code} (Bearer ADMIN_TOKEN) create|revoke|restore

   Saved designs — the client's personal store (projects, images, my products) when signed in:
     GET    /api/data?prefix=P           -> {keys}
     GET    /api/data/<key>              -> {found:false} | {found, inline:"<json>"} | {found, v, n}
     GET    /api/data/<key>?v=V&i=I      -> chunk I of version V (text)
     PUT    /api/data/<key>              body = JSON text up to INLINE_MAX chars  (active subscription)
     PUT    /api/data/<key>?v=V&i=I      body = one chunk of a larger value       (active subscription)
     PUT    /api/data/<key>?v=V&n=N      publishes version V once its N chunks exist
     DELETE /api/data/<key>
   Large values (images) travel in chunks so no single request holds more than ~1 MB:
   Firestore caps a document at 1 MiB and Pages Functions get little CPU per request.

   Firestore layout (REST API, service account):
     accounts/{uid}                  {uid, email, name, createdAt, lastLoginAt, active, plan, expiresAt, code, method, paidAt}
     accounts/{uid}/data/{id}        {k, inline | v+n, size, updatedAt}       id = base64url(key)
     accounts/{uid}/chunks/{id.v.i}  {d}
     codes/{CODE}                    {c, active, uses, maxUses, days, createdAt, expiresAt}
     orders/{orderId}                {uid, method, createdAt, paid, paidAt}
   Redeem and webhook commits are guarded by the documents' updateTime, so concurrent redeems
   stop at maxUses and a webhook delivered twice extends the subscription once.

   Pages → Settings → Variables and Secrets:
     secrets  FIREBASE_SERVICE_ACCOUNT (whole JSON), SESSION_SECRET (32+ chars), ADMIN_TOKEN,
              PAYMOB_API_KEY, PAYMOB_HMAC, PAYMOB_IFRAME_ID, PAYMOB_INTEGRATION_CARD / _WALLET / _KIOSK
     text     FIREBASE_API_KEY (Firebase web app config — public), PRICE_EGP (default 100)
     local    INSECURE_COOKIES, FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST, FIREBASE_PROJECT_ID

   With none of SESSION_SECRET / ADMIN_TOKEN / FIREBASE_SERVICE_ACCOUNT set, the site is served
   as the demo build (access not enforced) and every /api route answers 503.
   ============================================================ */

var INLINE_MAX = 900000;          /* chars of JSON stored inside the data document */
var CHUNK_MAX = 900000;           /* chars per chunk document */
var MAX_CHUNKS = 64;              /* ~57 MB per value */
var COOKIE_DAYS = 40;

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
  if(!env.FIREBASE_API_KEY) return { live: true, error: 'FIREBASE_API_KEY must be set (Firebase → Project settings → Your apps → Web app → apiKey).' };
  return { live: true };
}
function priceEgp(env){ return +env.PRICE_EGP || 100; }
function projectId(env){ return env.FIRESTORE_EMULATOR_HOST ? (env.FIREBASE_PROJECT_ID || 'demo-seif') : JSON.parse(env.FIREBASE_SERVICE_ACCOUNT).project_id; }

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
    var pid = projectId(env);
    var cfgJs = { demo: false, price: priceEgp(env) + ' EGP', pricePeriod: '/month', apiBase: '',
                  firebase: { apiKey: env.FIREBASE_API_KEY, authDomain: pid + '.firebaseapp.com', projectId: pid } };
    if(env.FIREBASE_AUTH_EMULATOR_HOST) cfgJs.authEmulator = 'http://' + env.FIREBASE_AUTH_EMULATOR_HOST;
    var html = await res.text();
    var headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store');
    headers.delete('ETag');
    return new Response(html.replace('<script>\n', '<script>\nwindow.SEIF_CONFIG = ' + JSON.stringify(cfgJs) + ';\n'), { status: res.status, headers: headers });
  }
};

/* ---------- helpers ---------- */
class HttpError extends Error { constructor(status, message){ super(message); this.status = status; } }
function json(code, obj, extraHeaders){
  var h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if(extraHeaders) Object.keys(extraHeaders).forEach(function(k){ h.append(k, extraHeaders[k]); });
  return new Response(JSON.stringify(obj), { status: code, headers: h });
}
async function bodyText(request, max){
  var t = await request.text();
  if(t.length > max) throw new HttpError(413, 'body too large');
  return t;
}
async function body(request){
  var t = await bodyText(request, 1e6);
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
function unb64url(s){ return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), function(c){ return c.charCodeAt(0); }); }
function unb64urlText(s){ return new TextDecoder().decode(unb64url(s)); }
function hex(bytes){ return Array.from(new Uint8Array(bytes), function(b){ return b.toString(16).padStart(2, '0'); }).join(''); }
async function hmac(hash, key, data){
  var k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: hash }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}
function rand4(){
  var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(4)), s = '';
  for(var i = 0; i < 4; i++) s += A[r[i] % A.length];
  return s;
}
function isActive(a){ return !!(a && a.active && (!a.expiresAt || a.expiresAt > Date.now())); }
function retryable(e){ return e.dbStatus === 'FAILED_PRECONDITION' || e.dbStatus === 'ABORTED' || e.dbStatus === 'ALREADY_EXISTS' || e.dbStatus === 'NOT_FOUND'; }

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
   Google service-account token (server → Firestore)
   ============================================================ */
var tokenCache = { key: null, token: null, exp: 0 };
async function googleToken(env){
  var sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if(tokenCache.key === sa.client_email && tokenCache.exp > Date.now() + 60e3) return tokenCache.token;
  var now = Math.floor(Date.now() / 1000);
  var head = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claims = b64urlText(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  var pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  var key = await crypto.subtle.importKey('pkcs8', unb64url(pem.replace(/\+/g, '-').replace(/\//g, '_')), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
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

/* ============================================================
   Firebase ID token (browser → server), verified against Google's public keys
   ============================================================ */
var JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
var jwksCache = { keys: null, exp: 0 };
async function googleJwks(force){
  if(!force && jwksCache.keys && jwksCache.exp > Date.now()) return jwksCache.keys;
  var r = await fetch(JWKS_URL);
  if(!r.ok) throw new Error('could not fetch Google sign-in keys (' + r.status + ')');
  var j = await r.json();
  var m = /max-age=(\d+)/.exec(r.headers.get('Cache-Control') || '');
  jwksCache = { keys: j.keys || [], exp: Date.now() + (m ? +m[1] : 3600) * 1000 };
  return jwksCache.keys;
}
async function verifyIdToken(env, token){
  var parts = String(token || '').split('.');
  if(parts.length !== 3) throw new HttpError(401, 'bad sign-in token');
  var header, p;
  try { header = JSON.parse(unb64urlText(parts[0])); p = JSON.parse(unb64urlText(parts[1])); } catch(e){ throw new HttpError(401, 'bad sign-in token'); }
  var pid = projectId(env);
  if(!env.FIREBASE_AUTH_EMULATOR_HOST){   /* the Auth emulator issues unsigned tokens; production never does */
    if(header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'bad sign-in token');
    var keys = await googleJwks(false), jwk = keys.filter(function(k){ return k.kid === header.kid; })[0];
    if(!jwk){ keys = await googleJwks(true); jwk = keys.filter(function(k){ return k.kid === header.kid; })[0]; }
    if(!jwk) throw new HttpError(401, 'bad sign-in token');
    var key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    var ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if(!ok) throw new HttpError(401, 'bad sign-in token');
  }
  var now = Math.floor(Date.now() / 1000);
  if(p.aud !== pid || p.iss !== 'https://securetoken.google.com/' + pid) throw new HttpError(401, 'sign-in token is for another project');
  if(!(p.exp > now) || !(p.iat <= now + 300) || (p.auth_time && p.auth_time > now + 300)) throw new HttpError(401, 'sign-in token expired');
  if(typeof p.sub !== 'string' || !p.sub || p.sub.length > 128) throw new HttpError(401, 'bad sign-in token');
  return { uid: p.sub, email: p.email || '', name: p.name || '' };
}

/* ============================================================
   Firestore over REST
   ============================================================ */
function db(env){
  var emu = env.FIRESTORE_EMULATOR_HOST;
  var root = 'projects/' + projectId(env) + '/databases/(default)/documents';
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
  function name(col, id){ return root + '/' + col + '/' + String(id); }

  return {
    /* -> {data, updateTime} or null */
    async get(col, id){
      try { var d = await call('GET', name(col, id)); return { data: fromFields(d.fields), updateTime: d.updateTime }; }
      catch(e){ if(e.dbStatus === 'NOT_FOUND') return null; throw e; }
    },
    /* -> [{data, updateTime} | null] in the order asked; mask limits the fields returned */
    async getMany(col, ids, mask){
      if(!ids.length) return [];
      var j = await call('POST', root + ':batchGet', { documents: ids.map(function(id){ return name(col, id); }), mask: mask ? { fieldPaths: mask } : undefined });
      var by = {};
      (Array.isArray(j) ? j : [j]).forEach(function(x){ if(x.found) by[x.found.name] = { data: fromFields(x.found.fields), updateTime: x.found.updateTime }; });
      return ids.map(function(id){ return by[name(col, id)] || null; });
    },
    /* writes: [{col, id, data, fields?: [paths to touch, default all of data], exists?: bool, updateTime?: string}
                | {col, id, del: true}]
       all-or-nothing; a failed guard throws with dbStatus FAILED_PRECONDITION / NOT_FOUND / ALREADY_EXISTS */
    async commit(writes){
      return call('POST', root + ':commit', { writes: writes.map(function(w){
        if(w.del) return { delete: name(w.col, w.id) };
        var out = { update: { name: name(w.col, w.id), fields: toFields(w.data) } };
        if(w.fields) out.updateMask = { fieldPaths: w.fields };
        if(w.updateTime) out.currentDocument = { updateTime: w.updateTime };
        else if(w.exists !== undefined) out.currentDocument = { exists: w.exists };
        return out;
      }) });
    },
    async list(col, opts){
      var out = [], token = '';
      opts = opts || {};
      do {
        var q = '?pageSize=300' + (opts.orderBy ? '&orderBy=' + encodeURIComponent(opts.orderBy) : '')
              + (opts.mask || []).map(function(f){ return '&mask.fieldPaths=' + encodeURIComponent(f); }).join('')
              + (token ? '&pageToken=' + encodeURIComponent(token) : '');
        var j = await call('GET', root + '/' + col + q);
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

/* ---------- session cookie: signed "uid|issuedAt" ---------- */
async function sign(env, v){ return b64url(await hmac('SHA-256', env.SESSION_SECRET, v)); }
async function cookieHeader(env, uid){
  var v = b64urlText(uid + '|' + Date.now());
  return 'ss_session=' + v + '.' + await sign(env, v) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (60*60*24*COOKIE_DAYS) + (env.INSECURE_COOKIES ? '' : '; Secure');
}
async function cookieUid(env, request){
  var raw = (request.headers.get('Cookie') || '').split(';').map(function(s){ return s.trim(); }).filter(function(s){ return s.indexOf('ss_session=') === 0; })[0];
  if(!raw) return null;
  var parts = raw.slice('ss_session='.length).split('.');
  if(parts.length !== 2 || !safeEq(await sign(env, parts[0]), parts[1])) return null;
  var v; try { v = unb64urlText(parts[0]).split('|'); } catch(e){ return null; }
  if(v.length !== 2 || !v[0] || !(+v[1] > Date.now() - COOKIE_DAYS * 86400e3)) return null;
  return v[0];
}
function sessionJson(uid, a){
  if(!uid) return { signedIn: false, active: false };
  a = a || {};
  return { signedIn: true, email: a.email || '', name: a.name || '', active: isActive(a), plan: a.plan || null, expiresAt: a.expiresAt || null };
}

/* ---------- Paymob (accept.paymob.com) ---------- */
async function postJson(path, payload){
  var r = await fetch('https://accept.paymob.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  var j; try { j = await r.json(); } catch(e){ throw new Error('paymob: bad response'); }
  if(r.status >= 400) throw new Error(j.message || j.detail || ('paymob ' + r.status));
  return j;
}
async function paymobCheckout(env, store, method, uid, acct){
  if(!env.PAYMOB_API_KEY) throw new Error('payments are not configured');
  var integration = method === 'wallet' ? env.PAYMOB_INTEGRATION_WALLET : (method === 'fawry' ? env.PAYMOB_INTEGRATION_KIOSK : env.PAYMOB_INTEGRATION_CARD);
  if(!integration) throw new Error('that payment method is not enabled');
  var auth = await postJson('/api/auth/tokens', { api_key: env.PAYMOB_API_KEY });
  var cents = Math.round(priceEgp(env) * 100);
  var order = await postJson('/api/ecommerce/orders', {
    auth_token: auth.token, delivery_needed: 'false', amount_cents: cents, currency: 'EGP',
    merchant_order_id: uid + '-' + Date.now(), items: [ { name: 'Seif Studio monthly', amount_cents: cents, quantity: 1 } ]
  });
  var names = String(acct.name || 'Seif Studio').trim().split(/\s+/);
  var key = await postJson('/api/acceptance/payment_keys', {
    auth_token: auth.token, amount_cents: cents, expiration: 3600, order_id: order.id, currency: 'EGP', integration_id: +integration,
    billing_data: { first_name: names[0] || 'Seif', last_name: names.slice(1).join(' ') || 'Studio', email: acct.email || 'client@seifstudio.local', phone_number:'+201000000000', apartment:'NA', floor:'NA', street:'NA', building:'NA', shipping_method:'NA', postal_code:'NA', city:'Cairo', country:'EG', state:'NA' }
  });
  await store.commit([{ col: 'orders', id: order.id, data: { uid: uid, method: method, createdAt: Date.now(), paid: false } }]);
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

/* the account write that extends a subscription: guarded so a concurrent change retries */
function extendWrite(uid, acctDoc, days, fields){
  var a = acctDoc ? acctDoc.data : {}, now = Date.now();
  var from = isActive(a) && a.expiresAt ? a.expiresAt : now;
  var data = Object.assign({ active: true, expiresAt: from + days * 86400e3 }, fields);
  var w = { col: 'accounts', id: uid, data: data, fields: Object.keys(data) };
  if(acctDoc) w.updateTime = acctDoc.updateTime; else w.exists = false;
  return w;
}

/* ---------- redeem: code use count + account in one guarded commit ---------- */
async function redeem(store, uid, code){
  if(!/^[A-Z0-9-]{1,40}$/.test(code)) throw new HttpError(400, 'invalid code');
  for(var attempt = 0; attempt < 5; attempt++){
    var doc = await store.get('codes', code), hit = doc && doc.data;
    if(!hit || !hit.active) throw new HttpError(400, 'invalid code');
    if(hit.expiresAt && hit.expiresAt < Date.now()) throw new HttpError(400, 'code expired');
    if(hit.maxUses && hit.uses >= hit.maxUses) throw new HttpError(400, 'code used up');
    var acctDoc = await store.get('accounts', uid);
    if(acctDoc && acctDoc.data.code === code && isActive(acctDoc.data)) throw new HttpError(400, 'you already used this code');
    var aw = extendWrite(uid, acctDoc, hit.days || 30, { plan: 'invite', code: code, method: 'invite' });
    try {
      await store.commit([
        { col: 'codes', id: code, data: { uses: (hit.uses || 0) + 1 }, fields: ['uses'], updateTime: doc.updateTime },
        aw
      ]);
      return aw.data;
    } catch(e){ if(!retryable(e)) throw e; }
  }
  throw new HttpError(503, 'busy, try again');
}

/* ============================================================
   Saved designs
   ============================================================ */
var KEY_RE = /^[A-Za-z0-9:_.\-]{1,300}$/, VER_RE = /^[a-z0-9]{6,16}$/;
function dataId(key){ return b64urlText(key); }
function chunkIds(id, v, n){ var out = []; for(var i = 0; i < n; i++) out.push(id + '.' + v + '.' + i); return out; }
/* delete writes for the chunks of a stored version, if it was chunked */
function chunkDeletes(uid, id, meta){
  if(!meta || !meta.v || !meta.n) return [];
  return chunkIds(id, meta.v, meta.n).map(function(cid){ return { col: 'accounts/' + uid + '/chunks', id: cid, del: true }; });
}
async function dataRoute(request, env, store, uid, acct, key, u){
  var m = request.method, dcol = 'accounts/' + uid + '/data', ccol = 'accounts/' + uid + '/chunks';
  if(key === null){
    if(m !== 'GET') return json(405, { error: 'method not allowed' });
    var prefix = u.searchParams.get('prefix') || '';
    var rows = await store.list(dcol, { mask: ['k'] });
    return json(200, { keys: rows.map(function(r){ return r.k; }).filter(function(k){ return k && k.indexOf(prefix) === 0; }) });
  }
  if(!KEY_RE.test(key)) return json(400, { error: 'bad key' });
  var id = dataId(key), v = u.searchParams.get('v'), i = u.searchParams.get('i'), n = u.searchParams.get('n');
  if(v !== null && !VER_RE.test(v)) return json(400, { error: 'bad version' });
  if(i !== null && !(/^\d+$/.test(i) && +i < MAX_CHUNKS)) return json(400, { error: 'bad chunk' });
  if(n !== null && !(/^\d+$/.test(n) && +n >= 1 && +n <= MAX_CHUNKS)) return json(400, { error: 'bad chunk count' });

  if(m === 'GET'){
    if(v !== null && i !== null){
      var c = await store.get(ccol, id + '.' + v + '.' + i);
      if(!c) return json(404, { error: 'chunk missing' });
      return new Response(c.data.d || '', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    var meta = await store.get(dcol, id);
    if(!meta) return json(200, { found: false });
    if(meta.data.v) return json(200, { found: true, v: meta.data.v, n: meta.data.n });
    return json(200, { found: true, inline: meta.data.inline });
  }
  if(m === 'DELETE'){
    var old = await store.get(dcol, id);
    if(old) await store.commit([{ col: dcol, id: id, del: true }].concat(chunkDeletes(uid, id, old.data)));
    return json(200, { ok: true });
  }
  if(m !== 'PUT') return json(405, { error: 'method not allowed' });
  if(!isActive(acct)) return json(403, { error: 'subscription inactive — designs are read-only' });

  if(v !== null && i !== null){                        /* one chunk */
    var text = await bodyText(request, CHUNK_MAX);
    await store.commit([{ col: ccol, id: id + '.' + v + '.' + i, data: { d: text } }]);
    return json(200, { ok: true });
  }
  var prev = await store.get(dcol, id), prevMeta = prev && prev.data;
  if(v !== null && n !== null){                        /* publish a chunked version */
    var have = await store.getMany(ccol, chunkIds(id, v, +n), ['x']);
    if(have.some(function(x){ return !x; })) return json(409, { error: 'chunks missing' });
    var drop = prevMeta && prevMeta.v !== v ? chunkDeletes(uid, id, prevMeta) : [];
    await store.commit([{ col: dcol, id: id, data: { k: key, v: v, n: +n, size: +(u.searchParams.get('size') || 0), updatedAt: Date.now() } }].concat(drop));
    return json(200, { ok: true });
  }
  var inline = await bodyText(request, INLINE_MAX);    /* small value, stored in place */
  try { JSON.parse(inline); } catch(e){ return json(400, { error: 'value must be JSON' }); }
  await store.commit([{ col: dcol, id: id, data: { k: key, inline: inline, size: inline.length, updatedAt: Date.now() } }].concat(chunkDeletes(uid, id, prevMeta)));
  return json(200, { ok: true });
}

/* ---------- routes ---------- */
async function api(request, env){
  var u = new URL(request.url), p = u.pathname, m = request.method, store = db(env);
  var ip = request.headers.get('CF-Connecting-IP') || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim();
  try {
    if(p === '/api/login' && m === 'POST'){
      if(limited(ip, 'login', 60, 3600e3)) return json(429, { error: 'too many attempts' });
      var who = await verifyIdToken(env, (await body(request)).idToken);
      var existing = await store.get('accounts', who.uid), now = Date.now();
      var upd = { uid: who.uid, email: who.email, name: who.name, lastLoginAt: now };
      if(!existing) upd.createdAt = now;
      await store.commit([{ col: 'accounts', id: who.uid, data: upd, fields: Object.keys(upd) }]);
      var acct = Object.assign({}, existing ? existing.data : {}, upd);
      return json(200, sessionJson(who.uid, acct), { 'Set-Cookie': await cookieHeader(env, who.uid) });
    }
    if(p === '/api/logout' && m === 'POST'){
      return json(200, { ok: true }, { 'Set-Cookie': 'ss_session=; HttpOnly; Path=/; Max-Age=0' });
    }
    if(p === '/api/webhook' && m === 'POST'){
      var wb = await body(request), obj = wb.obj || wb, given = u.searchParams.get('hmac') || wb.hmac;
      if(!(await paymobHmacOk(env, obj, given))) return json(401, { error: 'bad hmac' });
      var orderId = obj.order && obj.order.id, ok = obj.success === true || obj.success === 'true';
      if(!ok || orderId == null) return json(200, { ok: true });
      for(var attempt = 0; attempt < 5; attempt++){
        var od = await store.get('orders', orderId);
        if(!od || !od.data.uid || od.data.paid) return json(200, { ok: true });   /* unknown order, or already applied */
        var ad = await store.get('accounts', od.data.uid);
        try {
          await store.commit([
            { col: 'orders', id: orderId, data: { paid: true, paidAt: Date.now(), txn: String(obj.id || '') }, fields: ['paid', 'paidAt', 'txn'], updateTime: od.updateTime },
            extendWrite(od.data.uid, ad, 31, { plan: 'monthly', method: od.data.method || 'card', paidAt: Date.now() })
          ]);
          return json(200, { ok: true });
        } catch(e){ if(!retryable(e)) throw e; }
      }
      return json(503, { error: 'busy, try again' });
    }
    if(p === '/api/admin/codes'){
      if(!safeEq(bearer(request), env.ADMIN_TOKEN)) return json(401, { error: 'unauthorised' });
      if(m === 'GET') return json(200, { codes: await store.list('codes', { orderBy: 'createdAt desc' }) });
      var ab = await body(request);
      if(ab.action === 'create'){
        var c = 'SEIF-' + rand4() + '-' + rand4();
        await store.commit([{ col: 'codes', id: c, exists: false,
          data: { c: c, active: true, uses: 0, maxUses: +ab.maxUses || 0, days: +ab.days || 30, createdAt: Date.now(), expiresAt: ab.expiresAt || null } }]);
      } else if(ab.action === 'revoke' || ab.action === 'restore'){
        if(!/^[A-Z0-9-]{1,40}$/.test(String(ab.code || ''))) return json(400, { error: 'unknown code' });
        try { await store.commit([{ col: 'codes', id: String(ab.code), exists: true, fields: ['active'], data: { active: ab.action === 'restore' } }]); }
        catch(e){ if(!retryable(e)) throw e; }
      } else return json(400, { error: 'unknown action' });
      return json(200, { codes: await store.list('codes', { orderBy: 'createdAt desc' }) });
    }

    /* everything below belongs to a signed-in account */
    var uid = await cookieUid(env, request);
    var acctDoc = uid ? await store.get('accounts', uid) : null, account = acctDoc ? acctDoc.data : null;
    if(p === '/api/session' && m === 'GET') return json(200, sessionJson(uid && account ? uid : null, account));
    if(!uid || !account) return json(401, { error: 'sign in first' });

    if(p === '/api/redeem' && m === 'POST'){
      if(limited(ip, 'redeem', 10, 3600e3)) return json(429, { error: 'too many attempts' });
      var b = await body(request);
      var a2 = await redeem(store, uid, String(b.code || '').trim().toUpperCase());
      return json(200, sessionJson(uid, Object.assign({}, account, a2)));
    }
    if(p === '/api/checkout' && m === 'POST'){
      if(limited(ip, 'checkout', 20, 3600e3)) return json(429, { error: 'too many attempts' });
      var cb = await body(request), method = ['card','wallet','fawry'].indexOf(cb.method) >= 0 ? cb.method : 'card';
      return json(200, await paymobCheckout(env, store, method, uid, account));
    }
    if(p === '/api/data' || p.indexOf('/api/data/') === 0){
      var key = p === '/api/data' ? null : (function(){ try { return decodeURIComponent(p.slice('/api/data/'.length)); } catch(e){ return ''; } })();
      return await dataRoute(request, env, store, uid, account, key, u);
    }
    return json(404, { error: 'not found' });
  } catch(e){
    return json(e.status || 500, { error: e.message || 'server error' });
  }
}
