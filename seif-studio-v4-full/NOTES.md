# Seif Studio — engine notes (Phase 0 audit)

Written before the v4 panel rebuild, against the v3 source in `src/`.

## 1. Render pipeline map (rack click → pixels)

```
rack button click                                  p5_ui.js  renderRack()
  └─ buildProduct(id)                              r_core.js
       ├─ state.product = id;  state.arts = {}     ← WIPES ALL ARTWORK
       ├─ getPhotoAsset(id,'front'|'back')         async: store.get → Image → buildPhotoAsset()
       │     └─ onPhotoResolved() → re-picks zone, re-renders when the photo lands
       ├─ currentZones()                           merges def.zones with photo zones
       ├─ renderZoneSeg() / renderAngleSeg()       rebuild the two button strips
       ├─ syncArtControls() / syncFitVisibility()
       └─ render()
            ├─ renderBaseInto(state.view) → baseCanvas (1600×1600)
            │     ├─ photo present → renderPhotoBase(asset, view)
            │     │     fill(color) → destination-in(photo α) → draw arts (source-atop) → multiply(photo)
            │     └─ no photo      → renderVectorBase(view)
            │           view.paint(palette) → clip(outline) → draw arts → multiply(bakeShading.shade) → screen(bakeShading.lite)
            └─ state.angle === state.view ? drawImage(base)
               : left/right → drawTurned()   (skew −0.20 · scale 0.74 · gradient)   ← fake
               : top/bottom → drawCropped()  (alphaBBox crop of the same image)     ← fake

colour swatch click → state.color → applyColors() → render()
artwork drop        → loadImageFile() → setArtFromImage(img) → state.arts[state.zone] = {img,x,y,scale,rot} → render()
text apply          → setArtFromText() → renders text to a canvas → setArtFromImage(canvas)   ← REPLACES the image
pointer drag on canvas → bindPointer(): hit-test state.arts, move art.x/y, clampArt() → render()
Download PNG        → exportPNG(): mockCanvas.toDataURL() at 1600×1600, current angle only
```

Product definitions (`r_models.js`) are `{id, sku, name, cat, spec, views:{front,back}, zones:{...}}` where each
view has `outline(ctx,f)`, `paint(ctx,C,f)`, `folds(f)` and each zone is `Z(label, view, x, y, w, h, su)` — a
rectangle in the 1600×1600 design space plus `su`, the "size unit" that artwork scale is relative to.

## 2. Every place that assumes ONE artwork per print area

| Where | What |
|---|---|
| `state.arts` (r_core.js) | `zoneKey → single {img, aspect, x, y, scale, rot}` object. No array, no stack. |
| `setArtFromImage()` | assigns `state.arts[state.zone] = {...}` — overwrites whatever was there |
| `setArtFromText()` | rasterises text then calls `setArtFromImage()` → text destroys the uploaded logo |
| `removeArt()` | `delete state.arts[state.zone]` — removes "the" artwork |
| `setArtScale()`, `setArtRot()`, `centerArt()` | operate on `state.arts[state.zone]` singular |
| `syncArtControls()` | shows one size slider + one rotate slider for "the" art |
| `renderPhotoBase()` / `renderVectorBase()` | `Object.keys(state.arts)` → one draw per zone |
| `bindPointer()` | hit-tests one art per zone, `ptr.dragKey` is a zone key not a layer id |
| `#artControls` markup (p2_body.html) | single `#artSize`, `#artRot`, `#artRemoveBtn` |

## 3. Every place that assumes ONE print area per garment view

| Where | What |
|---|---|
| `buildPhotoAsset(img, view, zoneFrac)` | one `designZone` rect per photo, from the single `rec.zone` saved by the admin |
| `currentZones()` | when a photo exists for a view it **deletes every non-photo zone for that view** and inserts one `photo_<view>` zone — this is the blocker: a photographed tee goes from 4 print areas to 1 |
| `onPhotoResolved()` | re-picks `state.zone` from that collapsed set |
| Admin photo editor (`PE`, `peSaveBtn`) | `PE.rect` — one rectangle per product+view, saved as `rec.zone` |
| "My products" editor (`NP`) | same: one `rect` per view |
| `savePhotoAsset(productId, view, dataUrl, zoneFrac)` | stores exactly one zone with the photo |
| `renderPhotoBase()` | only draws arts whose zone `isPhoto && view === viewName` — i.e. the one photo zone |
| `state.zone` | a single "current zone" — fine as a selection, but everything keys off it |

## 4. Global state that is silently reset and loses work

| Where | What is lost |
|---|---|
| `buildProduct()` → `state.arts = {}` | **every artwork on every zone**, on every rack click, no confirm, no undo |
| `deleteCustomProduct()` → `buildProduct('tee')` | same wipe, as a side effect of deleting a custom product |
| `setArtFromText()` → `setArtFromImage()` | the uploaded image on the current zone |
| `signoutBtn` → `store.del(K_ACCESS)` | not artwork, but returns to the gate; nothing is saved first |
| Page refresh | everything — `state` lives only in memory; no autosave, no project file |
| `photoCache` / `bakeCache` / `bboxCache` | not user work, but `bboxCache` key is `product|view|fit` and ignores which photo is loaded → stale crops after an admin re-uploads a photo |
| `store.get/set` | swallow every exception and return `null`/`false`, so a full quota looks identical to an empty store |

## 5. Other facts worth knowing before editing

- Design space is `DS = 1600`, centre `CX = 800`. Every coordinate in `r_models.js` is in this space.
- `FIT(pts, f)` scales vector points for the slim/regular/oversized fit; photos ignore fit (`syncFitVisibility()` hides the control).
- `store` = thin wrapper over `window.storage.get/set/delete(key, shared)`. Shared = catalog (photos, invites); personal = client work (custom products, access flag).
- Custom products are `custom_<slug>_<rand>`; `registerCustomProduct()` gives them stub `outline/paint/folds` so the vector path never runs for them.
- `keyBackground()` (chroma key) and `toGrayscaleLuma()` are used by both photo editors; the saved photo is greyscale + keyed alpha — that is what makes `multiply` recolouring possible.
- Access gate (added just before this audit): `locked` flag + `#lockShield` overlay + `#gate` modal; `grant()` writes `K_ACCESS` to personal storage. Entirely client-side.
- `ADMIN_PIN`, `FALLBACK_CODE`, `PRICE` are constants at the top of `r_core.js`; invite codes live in **shared** storage under `K_INVITES`.

## Working rules for the rebuild

- Edit `src/` only. Never hand-edit `seif-studio.html`; run `./build.sh` after each change.
- No npm packages, no CDN scripts, no framework. ES5-style JS (`var`, function declarations, no optional chaining).
- Keep the paper / tech-pack CSS variables in `p1_head.html`. Do not restyle.
- After each phase: list what changed and what to click to verify.

---

## Rebuild log (v4)

Every finding in Part A of the spec, and where it went:

| # | Finding | Resolution |
|---|---|---|
| 1 | photo mode collapsed print areas to one | zones deleted; panels + placements (`r_panels.js`) exist independently of photos |
| 2 | one artwork per area, text overwrote image | layer stack per panel (`layersFor`, `addImageLayer`, `addTextLayer`, `addShapeLayer`) |
| 3 | `buildProduct()` wiped `state.arts` | `project.work[productId]` keeps every product's design; only New project clears |
| 4 | fake angles | deleted; real view switcher over photographed views |
| 5 | multiply-only recolour | `recolorGarment()` luminance ramp + specular + fabric presets |
| 6 | fake payment, PIN in bundle, codes in shared storage | `server/server.js`; demo build keeps only `DEMO` credentials and an always-visible banner |
| 7 | no undo / save | `hist` command stack with transactions; autosave + image store; project.json |
| 8 | single 1600 px export | mockups at 2400, 300 DPI panel files, tech pack, project file |
| 9 | flat artwork | multiply/screen shade maps from the photo, optional displacement, blend modes per layer |
| 10 | unusable on phones | single column, chip rack, bottom sheet with detents, pinch gestures, 44 px targets |
| 11 | no resolution check | `layerDpi()` badges in the layer list, panel cards and export warnings |
| 12 | stale `bboxCache` | deleted with the fake angles; every cache is keyed on the photo asset key or the panel revision |
| 13 | "3D" title | "Seif Studio - 2D Apparel Mockups" |

Measured (Phase 12.7, tee with 4 panels × 5 layers, 1600 px): ~14 ms median composite while dragging,
~25 ms for a cold 2400 px re-composite, ~0.2 ms artboard re-render. "Follow the fabric" (per-pixel displacement)
costs ~300 ms and is opt-in.

`#errbox` remains only for uncaught exceptions; every user-facing failure now reports inline next to its control
(`inlineErr()` / `gmsg()`).
