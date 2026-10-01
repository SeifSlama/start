/* Renders the wide hero photos in site/static/demo/ (hero-dark, hero-light) with the 3D studio.
   Run: build, serve this folder (python3 -m http.server 8790), then node tools/render-hero.mjs site/static/demo  */
import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync(process.env.FONT_CACHE || '/tmp/fontcache', { recursive: true });
const OUT = process.argv[2] || 'demo';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 } });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async route => {
  const url = route.request().url(), key = (process.env.FONT_CACHE || '/tmp/fontcache') + '/' + Buffer.from(url).toString('base64url').slice(-120);
  if (fs.existsSync(key)) { const m = JSON.parse(fs.readFileSync(key + '.json')); return route.fulfill({ status: 200, headers: m, body: fs.readFileSync(key) }); }
  for (let i = 0; i < 6; i++) { try { const r = await route.fetch({ timeout: 20000 }); if (r.ok()) { const body = await r.body(); const h = { 'content-type': r.headers()['content-type'] || '', 'access-control-allow-origin': '*' }; fs.writeFileSync(key, body); fs.writeFileSync(key + '.json', JSON.stringify(h)); return route.fulfill({ status: 200, headers: h, body }); } } catch (e) {} await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  return route.abort();
});
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8790/dist/design.html'); await p.waitForTimeout(1000);
if (await p.isVisible('#obGo')) await p.click('#obGo');
await p.waitForFunction(() => S3D.ready, null, { timeout: 60000 }); await p.waitForTimeout(600);
const sets = {
  'hero-dark': { bg: ['#2A2622', '#0F0E0D'], glow: 'rgba(201,168,106,.20)', shadow: 'rgba(0,0,0,.55)', tees: [
    { c: '#141414', t: [{ text: 'سيف', font: 'Reem Kufi', weight: 700, cm: 9, fill: '#C9A86A', y: 12 }] },
    { c: '#EFE6D2', t: [{ text: 'CAIRO', font: 'Amiri', weight: 400, cm: 4.2, fill: '#2A2119', y: 13 }] },
    { c: '#4A3326', t: [{ text: 'قهوة', font: 'Aref Ruqaa', weight: 700, cm: 7, fill: '#EFE6D2', y: 12 }] } ] },
  'hero-light': { bg: ['#F3EDE3', '#E3D9C8'], glow: 'rgba(255,255,255,.6)', shadow: 'rgba(60,45,30,.22)', tees: [
    { c: '#6B6B45', t: [{ text: 'Soft Club', font: 'Pacifico', weight: 400, cm: 3.4, fill: '#F3EEDF', y: 13 }] },
    { c: '#F1ECE1', t: [{ text: 'NILE', font: 'Bungee', weight: 400, cm: 5, fill: '#1E2749', y: 15 }] },
    { c: '#A9C6EA', t: [{ text: 'daydream', font: 'Amiri', weight: 400, cm: 4.5, fill: '#1D2A44', y: 15 }] } ] }
};
for (const [name, set] of Object.entries(sets)) {
  const url = await p.evaluate(async (set) => {
    const renders = [];
    for (const tee of set.tees) {
      ['front', 'back', 'sleeve_r', 'sleeve_l'].forEach(id => layersFor(id).slice().forEach(l => removeLayer(id, l.id)));
      setGarmentColor(tee.c);
      const placed = [];
      for (const o of tee.t) {
        const ab = artboardSize(panelById('tee', 'front')), k = ab.pxPerCm;
        const l = addTextLayer('front', { text: o.text, font: o.font, weight: o.weight, size: Math.round(o.cm * k), fill: o.fill });
        await document.fonts.load(fontString(l), l.text).catch(() => {});
        placed.push([l.id, o, ab]);
      }
      await document.fonts.ready; textCache = {}; artboardCache = {}; refitTextLayers();
      for (const [id, o, ab] of placed) { const l = layersFor('front').find(x => x.id === id); updateLayer('front', id, { x: Math.round(ab.w / 2 - l.w / 2), y: Math.round(o.y * ab.pxPerCm) }, { silent: true }); }
      s3dMarkAll(); await new Promise(r => setTimeout(r, 300));
      renders.push(s3dRenderView('front', 1100, {}));
    }
    const W = 1920, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, set.bg[0]); gr.addColorStop(1, set.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, W * 0.55); rg.addColorStop(0, set.glow); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    const pos = [[W * 0.29, 1, -3], [W * 0.5, 1.06, 0], [W * 0.71, 1, 3]];
    [0, 2, 1].forEach(i => {
      const [cx, s, rot] = pos[i], size = 860 * s;
      g.save(); g.filter = 'blur(28px)'; g.fillStyle = set.shadow; g.beginPath(); g.ellipse(cx, H * 0.84, 180 * s, 26, 0, 0, Math.PI * 2); g.fill(); g.restore();
      g.save(); g.translate(cx, H * 0.47); g.rotate(rot * Math.PI / 180); g.drawImage(renders[i], -size / 2, -size / 2 - 10, size, size); g.restore();
    });
    return c.toDataURL('image/jpeg', 0.84);
  }, set);
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(name, Math.round(fs.statSync(`${OUT}/${name}.jpg`).size / 1024) + 'KB');
}
await b.close();
