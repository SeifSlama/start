/* ============================================================
   SEIF STUDIO — minimal access + payment server (no framework)

   Serves seif-studio.html with SEIF_CONFIG injected (demo:false),
   and implements:
     POST /api/redeem   {code}           -> signed httpOnly session cookie
     GET  /api/session                   -> {active, plan, expiresAt}
     POST /api/logout
     GET  /api/admin/codes               (Bearer ADMIN_TOKEN) -> {codes}
     POST /api/admin/codes {action,code} (Bearer ADMIN_TOKEN) create|revoke|restore
     POST /api/checkout {method}         -> Paymob iframe URL (card) / redirect (wallet) / reference (Fawry kiosk)
     POST /api/webhook                   <- Paymob transaction callback, HMAC verified, activates the subscription
   Rate limit: /api/redeem 10 attempts per IP per hour.

   Every secret comes from the environment (see .env.example). Nothing here is ever
   sent to the client except the session cookie and the public price.
   ============================================================ */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https'), url = require('url');

var ENV = process.env;
var PORT = +ENV.PORT || 8787;
var SESSION_SECRET = ENV.SESSION_SECRET;
var ADMIN_TOKEN = ENV.ADMIN_TOKEN;
var PRICE_EGP = +ENV.PRICE_EGP || 100;
var PAYMOB = {
  apiKey: ENV.PAYMOB_API_KEY, hmac: ENV.PAYMOB_HMAC, iframeId: ENV.PAYMOB_IFRAME_ID,
  card: ENV.PAYMOB_INTEGRATION_CARD, wallet: ENV.PAYMOB_INTEGRATION_WALLET, kiosk: ENV.PAYMOB_INTEGRATION_KIOSK
};
if(!SESSION_SECRET || SESSION_SECRET.length < 32){ console.error('SESSION_SECRET must be set (32+ random chars).'); process.exit(1); }
if(!ADMIN_TOKEN){ console.error('ADMIN_TOKEN must be set.'); process.exit(1); }

var DATA_DIR = path.join(__dirname, 'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
function loadJson(name, def){ try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); } catch(e){ return def; } }
function saveJson(name, obj){ fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(obj, null, 2)); }
var codes = loadJson('codes.json', { list: [] });        /* {c, active, uses, maxUses, expiresAt, days} */
var sessions = loadJson('sessions.json', { map: {} });  /* sid -> {active, plan, expiresAt, method, orderId} */

/* ---------- html with config injected ---------- */
var HTML_PATH = path.join(__dirname, '..', 'seif-studio.html');
function pageHtml(){
  var html = fs.readFileSync(HTML_PATH, 'utf8');
  var cfg = 'window.SEIF_CONFIG = { demo:false, price:' + JSON.stringify(PRICE_EGP + ' EGP') + ', pricePeriod:"/month", apiBase:"" };\n';
  /* the bundle's first <script> is p0_config.js, which only sets a default when nothing is defined */
  return html.replace('<script>\n', '<script>\n' + cfg);
}

/* ---------- signed cookies ---------- */
function sign(v){ return crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url'); }
function makeCookie(sid){ var v = Buffer.from(sid).toString('base64url'); return v + '.' + sign(v); }
function readCookie(req){
  var raw = (req.headers.cookie || '').split(';').map(function(s){ return s.trim(); }).filter(function(s){ return s.indexOf('ss_session=') === 0; })[0];
  if(!raw) return null;
  var parts = raw.slice('ss_session='.length).split('.');
  if(parts.length !== 2 || sign(parts[0]) !== parts[1]) return null;
  return Buffer.from(parts[0], 'base64url').toString();
}
function setCookie(res, sid){
  res.setHeader('Set-Cookie', 'ss_session=' + makeCookie(sid) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (60*60*24*40) + (ENV.INSECURE_COOKIES ? '' : '; Secure'));
}
function newSid(){ return crypto.randomBytes(18).toString('base64url'); }
function sessionFor(req){
  var sid = readCookie(req); if(!sid) return { sid: null, s: null };
  var s = sessions.map[sid] || null;
  if(s && s.expiresAt && s.expiresAt < Date.now()) s.active = false;
  return { sid: sid, s: s };
}

/* ---------- rate limit ---------- */
var buckets = {};
function limited(ip, key, max, windowMs){
  var k = key + '|' + ip, now = Date.now();
  var b = buckets[k] || (buckets[k] = []);
  while(b.length && b[0] < now - windowMs) b.shift();
  if(b.length >= max) return true;
  b.push(now); return false;
}

/* ---------- helpers ---------- */
function json(res, code, obj, extraHeaders){
  var h = { 'Content-Type':'application/json', 'Cache-Control':'no-store' };
  if(extraHeaders) Object.keys(extraHeaders).forEach(function(k){ h[k] = extraHeaders[k]; });
  res.writeHead(code, h); res.end(JSON.stringify(obj));
}
function body(req){
  return new Promise(function(res, rej){
    var d = ''; req.on('data', function(c){ d += c; if(d.length > 1e6) req.destroy(); });
    req.on('end', function(){ try { res(d ? JSON.parse(d) : {}); } catch(e){ rej(new Error('bad json')); } });
  });
}
function bearer(req){ var a = req.headers.authorization || ''; return a.indexOf('Bearer ') === 0 ? a.slice(7) : null; }
function safeEq(a, b){ a = String(a || ''); b = String(b || ''); return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
function rand4(){ var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = ''; for(var i=0;i<4;i++) s += A[Math.floor(Math.random()*A.length)]; return s; }
function postJson(host, p, payload, headers){
  return new Promise(function(res, rej){
    var data = JSON.stringify(payload);
    var h = { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(data) };
    if(headers) Object.keys(headers).forEach(function(k){ h[k] = headers[k]; });
    var r = https.request({ host: host, path: p, method:'POST', headers: h }, function(rs){
      var d = ''; rs.on('data', function(c){ d += c; }); rs.on('end', function(){ try { var j = JSON.parse(d); if(rs.statusCode >= 400) rej(new Error(j.message || j.detail || ('paymob ' + rs.statusCode))); else res(j); } catch(e){ rej(new Error('paymob: bad response')); } });
    });
    r.on('error', rej); r.write(data); r.end();
  });
}

/* ---------- Paymob (accept.paymob.com) ---------- */
async function paymobCheckout(method, sid){
  if(!PAYMOB.apiKey) throw new Error('payments are not configured');
  var integration = method === 'wallet' ? PAYMOB.wallet : (method === 'fawry' ? PAYMOB.kiosk : PAYMOB.card);
  if(!integration) throw new Error('that payment method is not enabled');
  var auth = await postJson('accept.paymob.com', '/api/auth/tokens', { api_key: PAYMOB.apiKey });
  var cents = Math.round(PRICE_EGP * 100);
  var order = await postJson('accept.paymob.com', '/api/ecommerce/orders', {
    auth_token: auth.token, delivery_needed: 'false', amount_cents: cents, currency: 'EGP',
    merchant_order_id: sid + '-' + Date.now(), items: [ { name: 'Seif Studio monthly', amount_cents: cents, quantity: 1 } ]
  });
  var key = await postJson('accept.paymob.com', '/api/acceptance/payment_keys', {
    auth_token: auth.token, amount_cents: cents, expiration: 3600, order_id: order.id, currency: 'EGP', integration_id: +integration,
    billing_data: { first_name:'Seif', last_name:'Studio', email:'client@seifstudio.local', phone_number:'+201000000000', apartment:'NA', floor:'NA', street:'NA', building:'NA', shipping_method:'NA', postal_code:'NA', city:'Cairo', country:'EG', state:'NA' }
  });
  sessions.map[sid] = sessions.map[sid] || { active:false };
  sessions.map[sid].orderId = order.id; sessions.map[sid].method = method;
  saveJson('sessions.json', sessions);
  if(method === 'card') return { iframeUrl: 'https://accept.paymob.com/api/acceptance/iframes/' + PAYMOB.iframeId + '?payment_token=' + key.token };
  var pay = await postJson('accept.paymob.com', '/api/acceptance/payments/pay', {
    source: method === 'wallet' ? { identifier: 'wallet', subtype: 'WALLET' } : { identifier: 'AGGREGATOR', subtype: 'AGGREGATOR' },
    payment_token: key.token
  });
  if(method === 'wallet') return { iframeUrl: pay.redirect_url || pay.iframe_redirection_url };
  return { reference: pay.data && (pay.data.bill_reference || pay.bill_reference) || pay.id };
}
/* Paymob HMAC: sha512 over these fields in this exact order */
var HMAC_FIELDS = ['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
function paymobHmacOk(obj, given){
  if(!PAYMOB.hmac) return false;
  var s = HMAC_FIELDS.map(function(f){ var v = f.split('.').reduce(function(o, k){ return o == null ? undefined : o[k]; }, obj); return v === undefined || v === null ? '' : String(v); }).join('');
  var h = crypto.createHmac('sha512', PAYMOB.hmac).update(s).digest('hex');
  return safeEq(h, given);
}

/* ---------- routes ---------- */
var server = http.createServer(async function(req, res){
  var u = url.parse(req.url, true), p = u.pathname, ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if(req.method === 'GET' && p.indexOf('/assets/') === 0){
      /* built-in garment renders (assets/<product>/<view>.png) */
      var fp = path.normalize(path.join(__dirname, '..', decodeURIComponent(p)));
      if(fp.indexOf(path.join(__dirname, '..', 'assets')) !== 0 || !fs.existsSync(fp)) return json(res, 404, { error:'not found' });
      res.writeHead(200, { 'Content-Type': /.png$/i.test(fp) ? 'image/png' : 'application/octet-stream', 'Cache-Control':'public, max-age=86400' });
      fs.createReadStream(fp).pipe(res); return;
    }
    if(req.method === 'GET' && (p === '/' || p === '/index.html' || p === '/seif-studio.html')){
      res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' }); res.end(pageHtml()); return;
    }
    if(p === '/api/session' && req.method === 'GET'){
      var ss = sessionFor(req);
      if(!ss.s || !ss.s.active) return json(res, 200, { active:false });
      return json(res, 200, { active:true, plan: ss.s.plan, expiresAt: ss.s.expiresAt });
    }
    if(p === '/api/logout' && req.method === 'POST'){
      res.setHeader('Set-Cookie', 'ss_session=; HttpOnly; Path=/; Max-Age=0'); return json(res, 200, { ok:true });
    }
    if(p === '/api/redeem' && req.method === 'POST'){
      if(limited(ip, 'redeem', 10, 3600e3)) return json(res, 429, { error:'too many attempts' });
      var b = await body(req), code = String(b.code || '').trim().toUpperCase();
      var hit = codes.list.filter(function(c){ return c.c === code; })[0];
      if(!hit || !hit.active) return json(res, 400, { error:'invalid code' });
      if(hit.expiresAt && hit.expiresAt < Date.now()) return json(res, 400, { error:'code expired' });
      if(hit.maxUses && hit.uses >= hit.maxUses) return json(res, 400, { error:'code used up' });
      hit.uses = (hit.uses || 0) + 1; saveJson('codes.json', codes);
      var sid = newSid();
      sessions.map[sid] = { active:true, plan:'invite', method:'invite', code: code, expiresAt: Date.now() + (hit.days || 30) * 86400e3 };
      saveJson('sessions.json', sessions);
      setCookie(res, sid);
      return json(res, 200, { active:true, plan:'invite', expiresAt: sessions.map[sid].expiresAt });
    }
    if(p === '/api/checkout' && req.method === 'POST'){
      if(limited(ip, 'checkout', 20, 3600e3)) return json(res, 429, { error:'too many attempts' });
      var cb = await body(req), method = ['card','wallet','fawry'].indexOf(cb.method) >= 0 ? cb.method : 'card';
      var cs = sessionFor(req), csid = cs.sid || newSid();
      var r = await paymobCheckout(method, csid);
      setCookie(res, csid);
      return json(res, 200, r);
    }
    if(p === '/api/webhook' && req.method === 'POST'){
      var wb = await body(req), obj = wb.obj || wb, hmac = u.query.hmac || wb.hmac;
      if(!paymobHmacOk(obj, hmac)) return json(res, 401, { error:'bad hmac' });
      var orderId = obj.order && obj.order.id, ok = obj.success === true || obj.success === 'true';
      var sid2 = Object.keys(sessions.map).filter(function(k){ return sessions.map[k].orderId === orderId; })[0];
      if(sid2 && ok){
        sessions.map[sid2].active = true; sessions.map[sid2].plan = 'monthly';
        sessions.map[sid2].expiresAt = Date.now() + 31 * 86400e3; sessions.map[sid2].paidAt = Date.now();
        saveJson('sessions.json', sessions);
      }
      return json(res, 200, { ok:true });
    }
    if(p === '/api/admin/codes'){
      if(!safeEq(bearer(req), ADMIN_TOKEN)) return json(res, 401, { error:'unauthorised' });
      if(req.method === 'GET') return json(res, 200, { codes: codes.list });
      var ab = await body(req);
      if(ab.action === 'create'){ codes.list.unshift({ c:'SEIF-' + rand4() + '-' + rand4(), active:true, uses:0, maxUses: +ab.maxUses || 0, days: +ab.days || 30, createdAt: Date.now(), expiresAt: ab.expiresAt || null }); }
      else if(ab.action === 'revoke' || ab.action === 'restore'){ codes.list.forEach(function(c){ if(c.c === ab.code) c.active = ab.action === 'restore'; }); }
      else return json(res, 400, { error:'unknown action' });
      saveJson('codes.json', codes);
      return json(res, 200, { codes: codes.list });
    }
    json(res, 404, { error:'not found' });
  } catch(e){
    json(res, 500, { error: e.message || 'server error' });
  }
});
server.listen(PORT, function(){ console.log('Seif Studio server on http://localhost:' + PORT + (ENV.INSECURE_COOKIES ? ' (insecure cookies: local dev only)' : '')); });
