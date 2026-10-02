/* Renders the product placeholder photos in site/static/demo/ with the 3D studio:
   a small plain white T-shirt on white — the spot where a product photo goes.
   Run: build, serve this folder (python3 -m http.server 8790), then
   node tools/render-placeholder.mjs site/static/demo  */
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.argv[2] || 'site/static/demo';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8790/dist/design.html'); await p.waitForTimeout(1000);
if (await p.isVisible('#obGo')) await p.click('#obGo');
await p.waitForFunction(() => S3D.ready, null, { timeout: 60000 }); await p.waitForTimeout(600);
const shots = await p.evaluate(async () => {
  ['front', 'back', 'sleeve_r', 'sleeve_l'].forEach(id => layersFor(id).slice().forEach(l => removeLayer(id, l.id)));
  setGarmentColor('#FFFFFF'); s3dMarkAll();
  await new Promise(r => setTimeout(r, 300));
  const tee = s3dRenderView('front', 1200, {});
  function compose(W, H, size){
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const g = o.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
    /* a soft floor shadow, and a faint shadow around the shirt so white reads on white */
    g.save(); g.filter = 'blur(' + Math.round(size * 0.03) + 'px)'; g.fillStyle = 'rgba(0,0,0,.07)'; g.beginPath(); g.ellipse(W / 2, H / 2 + size * 0.36, size * 0.27, size * 0.028, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.save(); g.shadowColor = 'rgba(0,0,0,.10)'; g.shadowBlur = size * 0.03; g.shadowOffsetY = size * 0.008;
    g.drawImage(tee, (W - size) / 2, (H - size) / 2 - size * 0.02, size, size); g.restore();
    return o.toDataURL('image/jpeg', 0.9);
  }
  return { tall: compose(900, 1200, 640), wide: compose(1600, 900, 470) };
});
fs.writeFileSync(OUT + '/placeholder.jpg', Buffer.from(shots.tall.split(',')[1], 'base64'));
fs.writeFileSync(OUT + '/placeholder-wide.jpg', Buffer.from(shots.wide.split(',')[1], 'base64'));
console.log('wrote', OUT + '/placeholder.jpg', OUT + '/placeholder-wide.jpg');
await b.close();
