# Seif Studio v4 — panel-based 2D apparel mockups

A garment is a set of **flat panels** (the pieces a factory prints, with real cm sizes). The brand owner designs
each panel on its own artboard; the app assembles the finished panels back onto the photographed garment for the
mockup, and exports each panel as a 300 DPI print file.

Single-file web app, no bundler, no npm packages in the client. `build.sh` concatenates `src/` into
`seif-studio.html`.

## Source layout (concat order)

| File | What |
|---|---|
| `src/p0_config.js` | `window.SEIF_CONFIG` default (`{demo:true}`). The server injects the real config ahead of it. |
| `src/p1_head.html` | CSS — paper / tech-pack identity, panel sheet, artboard editor, responsive rules (bottom sheet under 900 px) |
| `src/p2_body.html` | Markup — lock/gate, header (Design / Preview), rack, panel sheet, artboard editor, preview floor, right pane, modals (export, admin, my products, onboarding, checkout) |
| `src/r_core.js` | Engine — storage wrapper, project + layer API, `renderArtboard()`, `recolorGarment()` (luminance ramp), `compositeView()` (24×24 affine quad mapping, silhouette clip, fold shading, optional displacement), history, autosave, exports, DPI / technique analysis, named colours |
| `src/r_models.js` | 16 vector garment drawings — **placeholders** shown until a photo is uploaded |
| `src/r_panels.js` | `PANEL_SETS` (panels per product, cm sizes), `PANEL_PLACEMENTS` (quads per product+view, stored), default quads, quad geometry |
| `src/p5_ui.js` | UI wiring — rack, swatches, modes, access (demo or server), admin (invites · photos · panel mapping · colours), my products, export, resume strip, bottom sheet, boot |
| `src/p5b_editor.js` | Panel sheet cards + the artboard editor (handles, rotate, snap, layer list, inspector, align, tile, keyboard, pinch) |
| `src/p6_tail.html` | closing tags |

`NOTES.md` is the Phase 0 audit of the v3 engine this replaced.

## Rebuild after edits

```
./build.sh
```

## Run it

Open `seif-studio.html` directly for the **demo build**: access is not enforced (amber banner), the invite code and
owner PIN are both `DEMO`, everything is stored in the browser (`localStorage`, or the host's `window.storage` when
present). Add `?debug=1` to draw the panel quads and safe areas over the assembled mockup and show composite timings.

### Deployed build (Phase 11)

Nothing enforced in client JavaScript is enforced. `server/server.js` is a dependency-free Node server that:

- serves `seif-studio.html` with `SEIF_CONFIG = {demo:false}` injected — the bundle cannot be flipped back to demo by a client flag;
- `POST /api/redeem {code}` → signed httpOnly session cookie; codes live in `server/data/codes.json` with use counts and expiry and are never sent to the client;
- `GET /api/session` → `{active, plan, expiresAt}`; the client shows the studio only if `active`;
- `GET/POST /api/admin/codes` behind `Authorization: Bearer $ADMIN_TOKEN` (the owner panel asks for the token where the PIN used to be);
- `POST /api/checkout {method: card|wallet|fawry}` → Paymob order + payment key → card iframe URL, Vodafone Cash redirect, or Fawry reference;
- `POST /api/webhook` ← Paymob transaction callback, HMAC-SHA512 verified, activates the subscription (31 days);
- rate limits `/api/redeem` to 10 attempts per IP per hour.

```
cp server/.env.example server/.env   # fill in SESSION_SECRET, ADMIN_TOKEN, Paymob keys
cd server && node server.js          # http://localhost:8787
```

Point Paymob's transaction-processed callback at `https://your-host/api/webhook`. Local dev over plain http needs
`INSECURE_COOKIES=1`. Deploy the server on Cloudflare Workers / Vercel / any Node host; the HTML can sit on the same
origin (simplest — cookies are `SameSite=Lax`).

### Cloudflare Pages + Firebase (current deployment)

`./build.sh` also writes `dist/`: `index.html`, `assets/` and `_worker.js` (a copy of `worker/index.js`). Drag
`dist/` (or a zip of it) onto a Cloudflare Pages project's upload page; every upload is kept as a deployment you can
roll back to. `server/server.js` is the older Node build (invite cookies only); it is not deployed.

**Free trial.** Anyone can open the site and design the T-shirt; that design stays in their browser. Another garment,
Export or My products shows *Sign in to continue* → Google sign-in → the payment window. Once the account is active
(payment, or access given by the owner) the T-shirt design moves into the account and everything unlocks.

**Accounts.** Google sign-in through Firebase Authentication (SDK from gstatic). The server verifies the ID token
once and sets its own signed cookie carrying the uid; subscriptions and designs belong to the account, so they
follow the customer to any device. Values over 900 KB (images) are stored in 900 KB chunks.

**Owner.** Whoever signs in with an address listed in `OWNER_EMAIL` always has full access, gets an *Admin*
button, and is the only one who can open **`/admin`** (everyone else gets 404). The dashboard shows:

- *Overview* — daily counts for the last 7 days (visits, free T-shirt designs, sign-in walls, new accounts,
  sign-ins, garments designed, exports, checkouts, payments) and the live activity feed.
- *Customers* — every account with status and last seen; each customer's page lists their designs (open any of
  them read-only in the studio), payments, everything they did, and what they did before signing up in the same
  browser. *Give access* for N days or *Revoke access*.
- *Photos & mapping*, *Colours* — saved on the server (`/api/shared`), so every visitor sees them.

The owner's own activity is not counted.

Firestore (production mode, default deny-all rules — only the server's service account reads or writes it):

| Path | Holds |
|---|---|
| `accounts/{uid}` | email, name, `active`, `plan`, `expiresAt`, `lastSeenAt`, visitor id |
| `accounts/{uid}/data/{id}`, `/chunks/{id.v.i}` | the customer's designs |
| `accounts/{uid}/events/{eid}` | the customer's timeline |
| `events/{eid}` | every event (`t`, `type`, `uid`/`vid`, `product`, `detail`) |
| `stats/{YYYY-MM-DD}` | daily counters per event type |
| `shared/…`, `sharedchunks/…`, `sharedmeta/manifest` | the owner's photos, mapping and colours |
| `orders/{orderId}` | Paymob order → uid, `paid` (a repeated webhook is ignored) |

One-time Firebase setup: **Authentication → Sign-in method → Google → Enable**; **Authentication → Settings →
Authorized domains → add** `<project>.pages.dev` (and any custom domain); **Project settings → Your apps → Web (`</>`)**
to get the `apiKey`.

Pages → Settings → Variables and Secrets (Production), then upload again so they apply:

| Name | Type | Value |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | the whole JSON from Project settings → Service accounts → Generate new private key |
| `SESSION_SECRET` | Secret | 32+ random characters |
| `FIREBASE_API_KEY` | Text | the web app's `apiKey` (public by design) |
| `OWNER_EMAIL` | Text | the owner's Google address (several: comma-separated) |
| `PAYMOB_API_KEY`, `PAYMOB_HMAC`, `PAYMOB_IFRAME_ID`, `PAYMOB_INTEGRATION_CARD` / `_WALLET` / `_KIOSK` | Secret | from the Paymob dashboard |
| `PRICE_EGP` | Text | optional, default 100 |

`ADMIN_TOKEN` is no longer used. **Until `SESSION_SECRET` and `FIREBASE_SERVICE_ACCOUNT` are set the site serves the
demo build** (everything open, owner panel behind the PIN `DEMO`) and `/api/*` answers 503. Point Paymob's callback
at `https://<project>.pages.dev/api/webhook`.

Local test against the Firebase emulators (`firebase emulators:start --only auth,firestore --project demo-seif`): put
the secrets plus `FIREBASE_API_KEY="fake"`, `OWNER_EMAIL`, `INSECURE_COOKIES="1"`, `FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"`,
`FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"` and `FIREBASE_PROJECT_ID="demo-seif"` in `.dev.vars`, then
`npx wrangler pages dev dist`. With `FIREBASE_AUTH_EMULATOR_HOST` set the server accepts the emulator's unsigned
tokens, so never set it in production.

## What the studio does

- **Design mode** — the *panel sheet* lays the product out as flat cards, sized to scale (a tee: front, back, two
  sleeves). Opening a card gives a full-width *artboard*: checkerboard, cut line, dashed 5 % safe area, a layer stack
  (images, text with tracking / line-height / arc / stroke, shapes), drag / resize / rotate with snapping, align &
  distribute, fit to safe area, tile as pattern, per-panel print technique (DTG · screen · embroidery · vinyl) with
  warnings, DPI badges (green ≥ 300 / amber / red < 150).
- **Preview mode** — `compositeView()` maps every artboard through its quad onto the recoloured garment photo, clips
  it to the fabric and shades it with the photo's own folds. Fabric presets (cotton / fleece / nylon), optional
  "Follow the fabric" displacement, named garment colours, multi-colour contact sheet.
- **Export** — mockup PNGs (2400 px, transparent or studio background, optional watermark), print-ready panel PNGs at
  300 DPI (`PRINT_tee_front_32x42cm_300dpi.png` = 3780 × 4961), a printable tech pack, and `project.json` (re-openable,
  version-checked).
- **Never losing work** — undo / redo (gestures coalesce to one step), autosave 2 s after every change with a
  "Continue where you left off" strip on boot, honest storage-failure warning, per-product designs that survive
  switching garments, `beforeunload` guard.
- **Owner panel** — invite codes, garment photo upload (chroma key), per-panel quad mapping with draggable corners
  (snap / reset / copy-from-front), named colour list.
- **My products** — clients bring their own blank product (photo + panel size + print area), private to them.

## Photography

The compositor is only as good as the source photos: light grey or white garment, flat lay or ghost mannequin shot
straight on, soft light with one key direction, no blown highlights, plain background with clear colour separation,
≥ 2400 px. Views: front, back, optional left / right side and a detail shot.

## Turntable renders (built-in garment photos)

`assets/<product>/<view>.png` are luminance + alpha renders shipped next to the HTML; the compositor recolours
them and maps the panels through per-view quads (`DEFAULT_PLACEMENTS` in `r_panels.js`, editable in the owner
panel). Views are turntable frames — `front`, `turn_030`, `turn_060`, `side_left`, `turn_120`, `turn_150`, `back`,
`turn_210`, `turn_240`, `side_right`, `turn_300`, `turn_330`, plus `detail` — and Preview lets the client drag the
garment through every frame that exists. The tee ships with 8 frames.

To add a product's renders: export the turntable as transparent PNGs named by view, then

```
node tools/prep-photos.js <folder-of-renders> assets/<productId> 1600
```

and list the views in `BUILTIN_PHOTOS` (`r_core.js`). **Deploy the `assets/` folder next to the HTML** — the
renders are not embedded in the single file (4 MB for the tee).
