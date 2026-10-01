# Design by Seif — design clothes in 3D, build a store, sell with cash on delivery

A small Shopify for Egyptian clothing brands. People design T-shirts on a real 3D model, turn a design into a product
in one tap, and sell it from their own store at `yoursite/store-name`, with cash-on-delivery orders from all 27
governorates. A private dashboard shows orders, customers, products and numbers; the look of each store is edited
live in a theme editor. Building is free; a monthly membership (`PRICE_EGP`, default 500) takes a store live.

Light beige design system shared by every page (Instrument Serif + Geist), with a top bar and an iOS-style
liquid-glass tab bar on phones; add it to the iPhone home screen and it opens like an app.

## What's where

| Path | What |
|---|---|
| `site/shared/ds.css`, `shell.js` | The design system and app shell: tokens, type, buttons, cards, forms, glass top bar, liquid-glass tab bar (drag the pill), menu sheet, sheets, toasts, Google sign-in, session, install banner |
| `site/pages/*.html` | Landing (`/`), membership (`/pricing`), `/terms`, `/privacy`, `/contact`. Includes: `<!--@head title="…" desc="…"-->`, `<!--@shell-->`, `<!--@engine-->` |
| `site/dashboard/` | The merchant app at `/dashboard/…` (and `/admin` for the owner): `_page.html` + CSS + JS parts joined in name order — core/routes, create-a-store wizard, home, orders, products, customers & discounts, theme editor, settings, admin, start |
| `site/store/i18n.js` | Store words in English and Arabic, Egypt's governorates, colour names → swatches |
| `site/store/themes.js` | Six themes (Atelier, Concrete, Bloom, Noir, Souk, Gallery), palettes, fonts, section types, Remix, and the checks that keep stored settings safe to put in CSS |
| `site/store/render.js` | The storefront renderer: one pure function from (theme, settings, products, page) to HTML. The server uses it for every store page; the dashboard and landing page use it for live previews |
| `site/store/store.css`, `runtime.js` | Every store's stylesheet and its one script: bag, options and stock, checkout, order tracking, countdowns, the preview bridge |
| `site/store/demo.js`, `preview.js` | Sample products (photos in `site/static/demo/`, rendered with the studio) and the in-page preview |
| `site/static/` | Icons, manifest, service worker, offline page, sample photos — copied into `dist/` |
| `worker/stores.js` | Stores, products, photos, orders, customers, discounts, numbers, store pages |
| `worker/index.js` | Accounts, sessions, membership, saved designs, the owner's API, routing |
| `src/` | The 3D studio (see below) |
| `tools/build.js` | Builds everything into `dist/` (also `seif-studio.html`, the studio on its own) |
| `tools/render-demo.mjs`, `render-hero.mjs` | Re-render the sample product photos with the studio |

## Build

```
./build.sh          # = node tools/build.js
```

`dist/` is exactly what gets uploaded to Cloudflare Pages: the pages, `design.html` (the studio), `ds/`, `sf/`,
`assets/`, icons and `_worker.js` (the store renderer + `worker/stores.js` + `worker/index.js`).

## Deploy (Cloudflare Pages + Firebase)

Zip the **contents** of `dist/` (files at the top of the zip) and upload it to the Pages project. Every upload is a
deployment you can roll back to.

Pages → Settings → Variables and Secrets (Production), then upload again so they apply:

| Name | Type | Value |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | the whole JSON from Firebase → Project settings → Service accounts → Generate new private key |
| `SESSION_SECRET` | Secret | 32+ random characters |
| `FIREBASE_API_KEY` | Text | the web app's `apiKey` (public by design) |
| `OWNER_EMAIL` | Text | the owner's Google address (several: comma-separated) |
| `PRICE_EGP` | Text | the monthly membership, default **500** |
| `PAYMOB_*` | Secret | for online payment later (not used by the pages yet) |

One-time Firebase setup: Authentication → Sign-in method → Google → Enable; Authentication → Settings →
Authorized domains → add the Pages domain (and any custom domain). Firestore stays in production mode with
deny-all rules — only the server's service account reads or writes it.

Until `SESSION_SECRET` and `FIREBASE_SERVICE_ACCOUNT` are set the site runs as a demo (no accounts, `/api/*` → 503).

## How it works

- **Accounts.** Google sign-in through Firebase Authentication in the browser; the server verifies the ID token once
  and sets its own signed `ss_session` cookie (40 days). Signing in is free.
- **Membership.** Publishing a store needs an active membership; building, designing and exporting don't. Online
  payment (Paymob) is not switched on yet: the membership page has *Request activation*, which shows up in the
  owner's admin (`/admin` → Accounts → *+31 days*). When a membership ends the store shows “opening soon”; nothing is
  deleted.
- **Stores** live at `/<slug>`. Pages: home, `/shop` (categories, search, sort), `/p/<handle>`, `/cart`, `/checkout`,
  `/order/<n>?k=<key>`, `/track`, `/pages/about|returns|shipping|privacy|terms`. Each store's data is kept in memory
  for 20 seconds per server instance, so a saved change shows within seconds. The owner sees an unpublished store
  with a preview bar and can place test orders.
- **Orders** are cash on delivery. The server re-prices everything, checks stock, the governorate's delivery price
  (or “no delivery”), the discount code and the Egyptian mobile number, then writes the order, the store's order
  counter, the stock, the customer and the day's numbers in one guarded commit. Cancelling puts stock back.
- **Photos** are resized in the browser (≤1600 px JPEG, logos PNG) and stored in Firestore (`media/{id}`), served
  from `/m/<id>` with a one-year cache.
- **Studio → store.** In `/design`, *Add to my store* photographs the design in each chosen colour on the brand
  backdrop and creates the product with Colour and Size options and a photo per colour.

Firestore:

| Path | Holds |
|---|---|
| `accounts/{uid}` | email, name, `active`, `plan`, `expiresAt`, `subRequestedAt`, `lastSeenAt`, visitor id |
| `accounts/{uid}/data/…`, `/chunks/…` | saved studio designs |
| `stores/{sid}` | owner, slug, name, `published`, language, theme, settings, discount codes, order counter, logo |
| `slugs/{slug}` | the address → store |
| `stores/{sid}/products/{pid}` | title, prices, photos, options, variants (price/stock), colour photos, stock tracking |
| `stores/{sid}/orders/{number}` | items, totals, customer, address, status + timeline, private note, key |
| `stores/{sid}/customers/{phone}` | name, address, orders, spent |
| `stores/{sid}/stats/{YYYY-MM-DD}` | views, visitors, orders, revenue, cancelled |
| `media/{id}` | an uploaded photo |
| `events/…`, `stats/…` | the platform's activity feed and daily counters (owner's admin) |

## Test locally

Firebase emulators (`firebase emulators:start --only auth,firestore --project demo-seif`) and
`npx wrangler pages dev dist` with a `.dev.vars` holding `SESSION_SECRET`, `FIREBASE_API_KEY="fake"`, `OWNER_EMAIL`,
`INSECURE_COOKIES="1"`, `FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"`, `FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"` and
`FIREBASE_PROJECT_ID="demo-seif"`. With `FIREBASE_AUTH_EMULATOR_HOST` set the server accepts the emulator's unsigned
tokens, so never set it in production — and never commit `.dev.vars`.

`server/server.js` is an older Node build kept for reference; it is not deployed.

## The 3D studio (/design)

Anyone can design; sign in (free) to save designs to the account, export, and add designs to a store.

### Source (joined in this order into `design.html`)

| File | What |
|---|---|
| `src/p0_config.js` | `window.SEIF_CONFIG` default (`{demo:true}`). The server injects the real config ahead of it. |
| `src/p1_head.html` | CSS — beige Design by Seif identity, panel sheet, artboard editor, responsive rules (bottom sheet under 900 px) |
| `src/p2_body.html` | Markup — lock/gate, header (Design / Preview), rack, panel sheet, artboard editor, preview floor, right pane, modals (export, admin, my products, onboarding, checkout) |
| `src/r_core.js` | Engine — storage wrapper, project + layer API, `renderArtboard()`, `recolorGarment()` (luminance ramp), `compositeView()` (24×24 affine quad mapping, silhouette clip, fold shading, optional displacement), history, autosave, exports, DPI / technique analysis, named colours |
| `src/r_models.js` | 16 vector garment drawings — **placeholders** shown until a photo is uploaded |
| `src/r_tee3d.js` | The 3D tee, pure maths (no three.js): pattern pieces — front, back, two sleeves, neck rib — "sewn" into a hollow shell (size M, cm). Texture coordinates are the flattened pattern, so the 3D surface and the print files are the same thing; also the cut outlines the flat editor and the print files use |
| `src/r_panels.js` | `PANEL_SETS` (panels per product, cm sizes; the tee's come from `TEE3D.panels()`), `PANEL_PLACEMENTS` (quads per product+view, stored), default quads, quad geometry, `PRODUCTS_3D` |
| `src/p5_ui.js` | UI wiring — rack, swatches, modes (3D · Flat for the tee, Design · Preview for the rest), access (demo or server), admin (photos · panel mapping · colours), my products, export, resume strip, bottom sheet, boot |
| `src/p5b_editor.js` | Panel sheet cards + the artboard editor (handles, rotate, snap, layer list, inspector, align, tile, keyboard, pinch) |
| `src/p7_studio3d.js` | The 3D studio: three.js scene (studio light, knit fabric, soft shadow), textures composed from the artboards, raycast picking, designing on the surface (move across seams, resize, rotate, brush, eraser, fill, stickers, text styles), camera presets, export renders, its toolbar and options |
| `src/p6_tail.html` | closing tags |
| `assets/vendor/three-r186.min.js` | three.js r186 + OrbitControls + RoomEnvironment, one minified ES module (MIT). Rebuild with `tools/build-three.sh` |


- **3D studio (the T-shirt)** — drag to turn the tee any way (over the shoulders, underneath, into the sleeves),
  scroll / pinch to zoom, right-drag to pan, or jump to Front · Back · Left · Right · Top · Underarm · Below, or Spin.
  Tools: **Move** (click a design, drag it — across a seam it moves onto the next piece at the same real size —
  corner dots resize, the red dot rotates, Alt + wheel scales), **Text** (30 fonts, Latin and Arabic, gradient,
  outline, shadow / glow, arc, one-click styles: Bold, Neon, Retro, Script, Arc, Graffiti, Pixel, Stencil, Outline,
  Chrome, كوفي, رقعة), **Image** (or drop a file on the tee; brightness / contrast / saturation / hue / grey /
  invert / blur, remove white background), **Sticker** (19 shapes with gradients and outlines, 40 emoji),
  **Brush** (pen, marker, airbrush, neon, calligraphy, dots; size, opacity, colour, mirror left ↔ right; strokes
  continue across seams), **Eraser**, **Fill** (solid, gradient, radial, stripes, polka dots, checker, grid, waves,
  halftone, camo, tie-dye — one piece or the whole tee). Quick actions on a selected design: duplicate, copy to the
  other side, centre, repeat as a pattern, forward / backward. Keys: V T I S B E F for the tools, 1–7 for the views,
  [ ] brush size, Delete, arrows, Ctrl+D, Ctrl+Z. The layer list and inspector on the right work on the piece you
  touched (chips switch pieces). **Flat** shows the same pieces as cut-out artboards — both views edit the same layers.
- **Design mode** — the *panel sheet* lays the product out as flat cards, sized to scale (a tee: front, back, two
  sleeves). Opening a card gives a full-width *artboard*: checkerboard, cut line, dashed 5 % safe area, a layer stack
  (images, text with tracking / line-height / arc / stroke, shapes), drag / resize / rotate with snapping, align &
  distribute, fit to safe area, tile as pattern, per-panel print technique (DTG · screen · embroidery · vinyl) with
  warnings, DPI badges (green ≥ 300 / amber / red < 150).
- **Preview mode** — `compositeView()` maps every artboard through its quad onto the recoloured garment photo, clips
  it to the fabric and shades it with the photo's own folds. Fabric presets (cotton / fleece / nylon), optional
  "Follow the fabric" displacement, named garment colours, multi-colour contact sheet.
- **Export** — mockup PNGs (2400 px, transparent or studio background, optional watermark; for the tee six 3D renders
  at 2048 px), print-ready panel PNGs at 300 DPI (a whole tee piece is capped at 6000 px on its long edge, e.g.
  `PRINT_t-shirt_front_55.2x76.2cm_200dpi.png`, cut to the piece's shape), a printable tech pack, the multi-colour
  sheet, and `project.json` (re-openable, version-checked; version 4 files — the old photo tee — are converted).
- **Never losing work** — undo / redo (gestures coalesce to one step), autosave 2 s after every change with a
  "Continue where you left off" strip on boot, honest storage-failure warning, per-product designs that survive
  switching garments, `beforeunload` guard.
- **Owner panel** — garment photo upload (chroma key), per-panel quad mapping with draggable corners
  (snap / reset / copy-from-front), named colour list (the 3D tee needs no photos or mapping).
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
garment through every frame that exists. The tee no longer uses photos (it is 3D); no product ships renders now.

To add a product's renders: export the turntable as transparent PNGs named by view, then

```
node tools/prep-photos.js <folder-of-renders> assets/<productId> 1600
```

and list the views in `BUILTIN_PHOTOS` (`r_core.js`). **Deploy the `assets/` folder next to the HTML** — the
renders and the 3D engine are not embedded in the single file.
