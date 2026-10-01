/* Renders the sample tee photos in site/static/demo/ with the 3D studio.
   Run: build, serve this folder (python3 -m http.server 8790), then
   node tools/render-demo.mjs site/static/demo [tee-sand,tee-black,...]  */
import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync(process.env.FONT_CACHE || '/tmp/fontcache', { recursive: true });
const OUT = process.argv[2] || 'demo';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 } });
/* the sandbox proxy drops some font downloads: retry, and keep a copy on disk */
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async route => {
  const url = route.request().url(), key = (process.env.FONT_CACHE || '/tmp/fontcache') + '/' + Buffer.from(url).toString('base64url').slice(-120);
  if (fs.existsSync(key)) { const m = JSON.parse(fs.readFileSync(key + '.json')); return route.fulfill({ status: 200, headers: m, body: fs.readFileSync(key) }); }
  for (let i = 0; i < 6; i++) {
    try { const r = await route.fetch({ timeout: 20000 }); if (r.ok()) { const body = await r.body(); const h = { 'content-type': r.headers()['content-type'] || '', 'access-control-allow-origin': '*' }; fs.writeFileSync(key, body); fs.writeFileSync(key + '.json', JSON.stringify(h)); return route.fulfill({ status: 200, headers: h, body }); } } catch (e) {}
    await new Promise(r => setTimeout(r, 800 * (i + 1)));
  }
  return route.abort();
});
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8790/dist/design.html'); await p.waitForTimeout(1000);
if (await p.isVisible('#obGo')) await p.click('#obGo');
await p.waitForFunction(() => S3D.ready, null, { timeout: 60000 }); await p.waitForTimeout(600);
/* each: file, colour, front design, back design */
const items = [
  { f: 'tee-sand', c: '#D9C7A3', d: [['front', 'text', { text: 'CAIRO', font: 'Amiri', weight: 400, cm: 4.2, fill: '#2A2119', y: 13 }], ['front', 'text', { text: 'EST. 2026', font: 'Archivo', weight: 700, cm: 1.1, fill: '#2A2119', y: 19.5, tracking: 0.3 }]], back: [['back', 'text', { text: 'made slowly', font: 'Amiri', weight: 400, cm: 3, fill: '#2A2119', y: 9 }]] },
  { f: 'tee-black', c: '#141414', d: [['front', 'text', { text: 'سيف', font: 'Reem Kufi', weight: 700, cm: 9, fill: '#F2B33D', y: 12 }], ['front', 'text', { text: 'DESIGN DEPT.', font: 'Archivo', weight: 800, cm: 1.4, fill: '#FAFAF7', y: 27, tracking: 0.25 }]], back: [['back', 'text', { text: '01', font: 'Anton', weight: 400, cm: 16, fill: '#F2B33D', y: 10 }]] },
  { f: 'tee-white', c: '#F1ECE1', d: [['front', 'shape', { shape: 'bolt', fill: '#C3423F', cm: 7, y: 11 }], ['front', 'text', { text: 'NILE', font: 'Bungee', weight: 400, cm: 5, fill: '#1E2749', y: 21 }]], back: [['back', 'text', { text: 'NILE CLUB', font: 'Bungee', weight: 400, cm: 3, fill: '#C3423F', y: 8 }]] },
  { f: 'tee-olive', c: '#6B6B45', d: [['front', 'text', { text: 'Soft Club', font: 'Pacifico', weight: 400, cm: 2.4, fill: '#F3EEDF', y: 12, x: 0.66 }]], back: [['back', 'text', { text: 'SOFT CLUB', font: 'Archivo', weight: 800, cm: 4.2, fill: '#F3EEDF', y: 9 }], ['back', 'shape', { shape: 'sparkle', fill: '#EFDF9C', cm: 6, y: 17 }]] },
  { f: 'tee-navy', c: '#1D2A44', d: [['front', 'text', { text: 'SEIF', font: 'Archivo', weight: 800, cm: 8, fill: '#F2B33D', fill2: '#D9452B', stroke: '#FFFFFF', strokeW: 0.3, y: 15 }], ['front', 'shape', { shape: 'bolt', fill: '#F2B33D', cm: 6, y: 27 }]] },
  { f: 'tee-pink', c: '#E8AFC2', d: [['front', 'shape', { shape: 'heart', fill: '#C3423F', cm: 3, y: 12, x: 0.66 }]], back: [['back', 'text', { text: 'habibi', font: 'Pacifico', weight: 400, cm: 6, fill: '#6E2A35', y: 10 }]] },
  { f: 'tee-butter', c: '#EFDF9C', d: [['front', 'text', { text: 'SUNDAY', font: 'Anton', weight: 400, cm: 7, fill: '#FFFFFF', stroke: '#111111', strokeW: 0.25, y: 13 }], ['front', 'text', { text: 'SUNDAY', font: 'Anton', weight: 400, cm: 7, fill: '#111111', y: 21 }]] },
  { f: 'tee-grey', c: '#B2B2B0', d: [['front', 'text', { text: 'ATHLETIC DEPT.', font: 'Archivo', weight: 800, cm: 2.6, fill: '#1D2A44', y: 13, curve: 40, tracking: 0.05 }], ['front', 'text', { text: '26', font: 'Anton', weight: 400, cm: 10, fill: '#1D2A44', y: 18 }]] },
  { f: 'tee-chocolate', c: '#4A3326', d: [['front', 'text', { text: 'قهوة', font: 'Aref Ruqaa', weight: 700, cm: 7, fill: '#EFE6D2', y: 12 }], ['front', 'text', { text: 'COFFEE & CO.', font: 'Archivo', weight: 700, cm: 1.2, fill: '#C19A6B', y: 24, tracking: 0.3 }]] },
  { f: 'tee-sky', c: '#A9C6EA', d: [['front', 'shape', { shape: 'sparkle', fill: '#FFFFFF', cm: 5, y: 10 }], ['front', 'text', { text: 'daydream', font: 'Amiri', weight: 400, cm: 4.5, fill: '#1D2A44', y: 19 }]] },
];
const want = process.argv[3] ? process.argv[3].split(',') : null;
for (const it of items) {
  if (want && !want.includes(it.f)) continue;
  const shots = await p.evaluate(async (it) => {
    ['front', 'back', 'sleeve_r', 'sleeve_l'].forEach(id => layersFor(id).slice().forEach(l => removeLayer ? removeLayer(id, l.id) : 0));
    setGarmentColor(it.c);
    const all = it.d.concat(it.back || []), placed = [];
    for (const [panel, type, o] of all) {
      const ab = artboardSize(panelById('tee', panel)), k = ab.pxPerCm;
      let l;
      if (type === 'text') {
        const opts = { text: o.text, font: o.font, weight: o.weight, size: Math.round(o.cm * k), fill: o.fill };
        if (o.fill2) opts.fill2 = o.fill2; if (o.stroke) { opts.stroke = o.stroke; opts.strokeW = Math.round(o.strokeW * k); }
        if (o.curve) opts.curve = o.curve; if (o.tracking) opts.tracking = o.tracking;
        l = addTextLayer(panel, opts);
      } else l = addShapeLayer(panel, { shape: o.shape, fill: o.fill, w: Math.round(o.cm * k), h: Math.round(o.cm * k) });
      placed.push([panel, l.id, o, ab]);
      if (type === 'text') await document.fonts.load(fontString(l), l.text).catch(() => {});
    }
    await document.fonts.ready;
    textCache = {}; artboardCache = {}; refitTextLayers();
    for (const [panel, id, o, ab] of placed) {
      const l = layersFor(panel).find(x => x.id === id), k = ab.pxPerCm, cx = (o.x || 0.5) * ab.w;
      updateLayer(panel, id, { x: Math.round(cx - l.w / 2), y: Math.round(o.y * k) }, { silent: true });
    }
    s3dMarkAll();
    await new Promise(r => setTimeout(r, 300));
    const out = {};
    for (const view of (it.back ? ['front', 'back'] : ['front'])) {
      const px = 1200, c = s3dRenderView(view, px, {});
      const W = 900, H = 1200, o = document.createElement('canvas'); o.width = W; o.height = H;
      const g = o.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#F1ECE3'); gr.addColorStop(1, '#E4DCCF'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const rg = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, W * 0.8); rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
      g.save(); g.filter = 'blur(26px)'; g.fillStyle = 'rgba(60,45,30,.18)'; g.beginPath(); g.ellipse(W / 2, H * 0.9, W * 0.34, 34, 0, 0, Math.PI * 2); g.fill(); g.restore();
      const s = 1190; g.drawImage(c, (W - s) / 2, (H - s) / 2 - 24, s, s);
      out[view] = o.toDataURL('image/jpeg', 0.84);
    }
    return out;
  }, it);
  for (const [view, url] of Object.entries(shots)) {
    const name = `${OUT}/${it.f}${view === 'back' ? '-back' : ''}.jpg`;
    fs.writeFileSync(name, Buffer.from(url.split(',')[1], 'base64'));
    console.log(name, Math.round(fs.statSync(name).size / 1024) + 'KB');
  }
}
await b.close();
