/* ============================================================
   SEIF STUDIO — access + payment server for Cloudflare Workers

   The same API as server/server.js (the Node build), ported to Workers:
     POST /api/redeem   {code}           -> signed httpOnly session cookie
     GET  /api/session                   -> {active, plan, expiresAt}
     POST /api/logout
     GET  /api/admin/codes               (Bearer ADMIN_TOKEN) -> {codes}
     POST /api/admin/codes {action,code} (Bearer ADMIN_TOKEN) create|revoke|restore
     POST /api/checkout {method}         -> Paymob iframe URL (card) / redirect (wallet) / reference (Fawry kiosk)
     POST /api/webhook                   <- Paymob transaction callback, HMAC verified, activates the subscription
   Rate limit: /api/redeem 10 attempts per IP per hour, /api/checkout 20.

   Codes and sessions live in one Durable Object (class Store), so every write is
   ordered and a code's use count cannot be raced past maxUses.

   Secrets (wrangler secret put / dashboard → Settings → Variables and Secrets):
     SESSION_SECRET (32+ chars), ADMIN_TOKEN,
     PAYMOB_API_KEY, PAYMOB_HMAC, PAYMOB_IFRAME_ID,
     PAYMOB_INTEGRATION_CARD, PAYMOB_INTEGRATION_WALLET, PAYMOB_INTEGRATION_KIOSK
   Vars: PRICE_EGP (default 100), INSECURE_COOKIES (local http dev only).

   With neither SESSION_SECRET nor ADMIN_TOKEN set, the site is served as the
   demo build (access not enforced) and every /api route answers 503.
   ============================================================ */
import { DurableObject } from 'cloudflare:workers';

/* ---------- config ---------- */
function config(env){
  var secret = env.SESSION_SECRET, admin = env.ADMIN_TOKEN;
  if(!secret && !admin) return { live: false };
  if(!secret || secret.length < 32) return { live: true, error: 'SESSION_SECRET must be set (32+ random chars).' };
  if(!admin) return { live: true, error: 'ADMIN_TOKEN must be set.' };
  return { live: true };
}
function priceEgp(env){ return +env.PRICE_EGP || 100; }

/* ---------- worker entry ---------- */
export default {
  async fetch(request, env){
    var u = new URL(request.url), cfg = config(env);
    if(u.pathname.indexOf('/api/') === 0){
      if(!cfg.live) return json(503, { error: 'demo build: no server configured' });
      if(cfg.error) return json(500, { error: cfg.error });
      return env.STORE.get(env.STORE.idFromName('main')).fetch(request);
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
class HttpError extends Error { constructor(status, message){ super(message); this.status = status; } }
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
async function postJson(path, payload){
  var r = await fetch('https://accept.paymob.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  var j; try { j = await r.json(); } catch(e){ throw new Error('paymob: bad response'); }
  if(r.status >= 400) throw new Error(j.message || j.detail || ('paymob ' + r.status));
  return j;
}

/* Paymob HMAC: sha512 over these fields in this exact order */
var HMAC_FIELDS = ['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
async function paymobHmacOk(env, obj, given){
  if(!env.PAYMOB_HMAC) return false;
  var s = HMAC_FIELDS.map(function(f){ var v = f.split('.').reduce(function(o, k){ return o == null ? undefined : o[k]; }, obj); return v === undefined || v === null ? '' : String(v); }).join('');
  return safeEq(hex(await hmac('SHA-512', env.PAYMOB_HMAC, s)), given);
}

/* ============================================================
   Store — one Durable Object instance ('main') holds all state:
     code:<CODE>    {c, active, uses, maxUses, expiresAt, days, createdAt}
     session:<sid>  {active, plan, expiresAt, method, orderId, code, paidAt}
     order:<id>     sid   (Paymob order → session, for the webhook)
   Requests run one at a time per object, so read-modify-write is safe.
   ============================================================ */
export class Store extends DurableObject {
  constructor(ctx, env){
    super(ctx, env);
    this.buckets = {};  /* rate limits; in memory, reset when the object is evicted */
  }

  limited(ip, key, max, windowMs){
    var k = key + '|' + ip, now = Date.now();
    var b = this.buckets[k] || (this.buckets[k] = []);
    while(b.length && b[0] < now - windowMs) b.shift();
    if(b.length >= max) return true;
    b.push(now); return false;
  }

  /* ---------- signed cookies ---------- */
  async sign(v){ return b64url(await hmac('SHA-256', this.env.SESSION_SECRET, v)); }
  async makeCookie(sid){ var v = b64url(new TextEncoder().encode(sid)); return v + '.' + await this.sign(v); }
  async readCookie(request){
    var raw = (request.headers.get('Cookie') || '').split(';').map(function(s){ return s.trim(); }).filter(function(s){ return s.indexOf('ss_session=') === 0; })[0];
    if(!raw) return null;
    var parts = raw.slice('ss_session='.length).split('.');
    if(parts.length !== 2 || !safeEq(await this.sign(parts[0]), parts[1])) return null;
    try { return atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')); } catch(e){ return null; }
  }
  async cookieHeader(sid){
    return 'ss_session=' + await this.makeCookie(sid) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (60*60*24*40) + (this.env.INSECURE_COOKIES ? '' : '; Secure');
  }
  async sessionFor(request){
    var sid = await this.readCookie(request); if(!sid) return { sid: null, s: null };
    var s = (await this.ctx.storage.get('session:' + sid)) || null;
    if(s && s.expiresAt && s.expiresAt < Date.now()) s.active = false;
    return { sid: sid, s: s };
  }
  async listCodes(){
    var m = await this.ctx.storage.list({ prefix: 'code:' });
    return Array.from(m.values()).sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  /* ---------- Paymob (accept.paymob.com) ---------- */
  async paymobCheckout(method, sid){
    var env = this.env;
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
    var s = (await this.ctx.storage.get('session:' + sid)) || { active: false };
    s.orderId = order.id; s.method = method;
    await this.ctx.storage.put({ ['session:' + sid]: s, ['order:' + order.id]: sid });
    if(method === 'card') return { iframeUrl: 'https://accept.paymob.com/api/acceptance/iframes/' + env.PAYMOB_IFRAME_ID + '?payment_token=' + key.token };
    var pay = await postJson('/api/acceptance/payments/pay', {
      source: method === 'wallet' ? { identifier: 'wallet', subtype: 'WALLET' } : { identifier: 'AGGREGATOR', subtype: 'AGGREGATOR' },
      payment_token: key.token
    });
    if(method === 'wallet') return { iframeUrl: pay.redirect_url || pay.iframe_redirection_url };
    return { reference: pay.data && (pay.data.bill_reference || pay.bill_reference) || pay.id };
  }

  /* ---------- routes ---------- */
  async fetch(request){
    var u = new URL(request.url), p = u.pathname, m = request.method, st = this.ctx.storage;
    var ip = request.headers.get('CF-Connecting-IP') || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim();
    try {
      if(p === '/api/session' && m === 'GET'){
        var ss = await this.sessionFor(request);
        if(!ss.s || !ss.s.active) return json(200, { active: false });
        return json(200, { active: true, plan: ss.s.plan, expiresAt: ss.s.expiresAt });
      }
      if(p === '/api/logout' && m === 'POST'){
        return json(200, { ok: true }, { 'Set-Cookie': 'ss_session=; HttpOnly; Path=/; Max-Age=0' });
      }
      if(p === '/api/redeem' && m === 'POST'){
        if(this.limited(ip, 'redeem', 10, 3600e3)) return json(429, { error: 'too many attempts' });
        var b = await body(request), code = String(b.code || '').trim().toUpperCase();
        var hit = code ? await st.get('code:' + code) : null;
        if(!hit || !hit.active) return json(400, { error: 'invalid code' });
        if(hit.expiresAt && hit.expiresAt < Date.now()) return json(400, { error: 'code expired' });
        if(hit.maxUses && hit.uses >= hit.maxUses) return json(400, { error: 'code used up' });
        hit.uses = (hit.uses || 0) + 1;
        var sid = newSid(), sess = { active: true, plan: 'invite', method: 'invite', code: code, expiresAt: Date.now() + (hit.days || 30) * 86400e3 };
        await st.put({ ['code:' + code]: hit, ['session:' + sid]: sess });
        return json(200, { active: true, plan: 'invite', expiresAt: sess.expiresAt }, { 'Set-Cookie': await this.cookieHeader(sid) });
      }
      if(p === '/api/checkout' && m === 'POST'){
        if(this.limited(ip, 'checkout', 20, 3600e3)) return json(429, { error: 'too many attempts' });
        var cb = await body(request), method = ['card','wallet','fawry'].indexOf(cb.method) >= 0 ? cb.method : 'card';
        var cs = await this.sessionFor(request), csid = cs.sid || newSid();
        var r = await this.paymobCheckout(method, csid);
        return json(200, r, { 'Set-Cookie': await this.cookieHeader(csid) });
      }
      if(p === '/api/webhook' && m === 'POST'){
        var wb = await body(request), obj = wb.obj || wb, given = u.searchParams.get('hmac') || wb.hmac;
        if(!(await paymobHmacOk(this.env, obj, given))) return json(401, { error: 'bad hmac' });
        var orderId = obj.order && obj.order.id, ok = obj.success === true || obj.success === 'true';
        var sid2 = orderId != null ? await st.get('order:' + orderId) : null;
        var s2 = sid2 ? await st.get('session:' + sid2) : null;
        if(s2 && ok){
          s2.active = true; s2.plan = 'monthly';
          s2.expiresAt = Date.now() + 31 * 86400e3; s2.paidAt = Date.now();
          await st.put('session:' + sid2, s2);
        }
        return json(200, { ok: true });
      }
      if(p === '/api/admin/codes'){
        if(!safeEq(bearer(request), this.env.ADMIN_TOKEN)) return json(401, { error: 'unauthorised' });
        if(m === 'GET') return json(200, { codes: await this.listCodes() });
        var ab = await body(request);
        if(ab.action === 'create'){
          var c = 'SEIF-' + rand4() + '-' + rand4();
          await st.put('code:' + c, { c: c, active: true, uses: 0, maxUses: +ab.maxUses || 0, days: +ab.days || 30, createdAt: Date.now(), expiresAt: ab.expiresAt || null });
        } else if(ab.action === 'revoke' || ab.action === 'restore'){
          var row = await st.get('code:' + ab.code);
          if(row){ row.active = ab.action === 'restore'; await st.put('code:' + ab.code, row); }
        } else return json(400, { error: 'unknown action' });
        return json(200, { codes: await this.listCodes() });
      }
      return json(404, { error: 'not found' });
    } catch(e){
      return json(e.status || 500, { error: e.message || 'server error' });
    }
  }
}
