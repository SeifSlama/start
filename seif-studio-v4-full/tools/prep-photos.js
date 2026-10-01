/* ============================================================
   prep-photos.js — turn garment renders/photos into studio assets
   Usage: node tools/prep-photos.js <inDir> <outDir> [maxPx]
   Reads every PNG (RGBA), resizes to maxPx (default 1600) on the
   long edge, converts to luminance (the compositor recolours from
   luminance) and keeps the alpha channel. Dependency-free: PNG is
   decoded/encoded with zlib only. Files are written as <name>.png.
   ============================================================ */
'use strict';
var fs = require('fs'), path = require('path'), zlib = require('zlib');

function crc32(buf){
  var t = crc32.t; if(!t){ t = crc32.t = new Int32Array(256); for(var n=0;n<256;n++){ var c = n; for(var k=0;k<8;k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } }
  var c2 = -1; for(var i=0;i<buf.length;i++) c2 = t[(c2 ^ buf[i]) & 255] ^ (c2 >>> 8); return (c2 ^ -1) >>> 0;
}
function decodePNG(buf){
  if(buf.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG');
  var pos = 8, w = 0, h = 0, depth = 8, ctype = 6, idat = [], palette = null, trns = null;
  while(pos < buf.length){
    var len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos+4, pos+8), data = buf.slice(pos+8, pos+8+len);
    if(type === 'IHDR'){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; if(data[12] !== 0) throw new Error('interlaced PNG not supported'); }
    else if(type === 'IDAT') idat.push(data);
    else if(type === 'PLTE') palette = data;
    else if(type === 'tRNS') trns = data;
    else if(type === 'IEND') break;
    pos += 12 + len;
  }
  if(depth !== 8) throw new Error('only 8-bit PNGs supported');
  var ch = { 0:1, 2:3, 3:1, 4:2, 6:4 }[ctype], bpp = ch, stride = w * bpp;
  var raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w*h*4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for(var y=0;y<h;y++){
    var f = raw[y*(stride+1)], off = y*(stride+1)+1;
    for(var x=0;x<stride;x++){
      var a = x >= bpp ? cur[x-bpp] : 0, b = prev[x], c = x >= bpp ? prev[x-bpp] : 0, v = raw[off+x], r;
      if(f === 0) r = v; else if(f === 1) r = v + a; else if(f === 2) r = v + b; else if(f === 3) r = v + ((a + b) >> 1);
      else { var p = a + b - c, pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c); r = v + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c)); }
      cur[x] = r & 255;
    }
    for(var px=0;px<w;px++){
      var o = (y*w+px)*4, i = px*bpp;
      if(ctype === 6){ out[o]=cur[i]; out[o+1]=cur[i+1]; out[o+2]=cur[i+2]; out[o+3]=cur[i+3]; }
      else if(ctype === 2){ out[o]=cur[i]; out[o+1]=cur[i+1]; out[o+2]=cur[i+2]; out[o+3]=255; }
      else if(ctype === 4){ out[o]=out[o+1]=out[o+2]=cur[i]; out[o+3]=cur[i+1]; }
      else if(ctype === 0){ out[o]=out[o+1]=out[o+2]=cur[i]; out[o+3]=255; }
      else { var pi = cur[i]*3; out[o]=palette[pi]; out[o+1]=palette[pi+1]; out[o+2]=palette[pi+2]; out[o+3]=trns && cur[i] < trns.length ? trns[cur[i]] : 255; }
    }
    var t = prev; prev = cur; cur = t;
  }
  return { w:w, h:h, data:out };
}
function encodePNG(w, h, rgba){
  var stride = w*4, raw = Buffer.alloc((stride+1)*h);
  for(var y=0;y<h;y++){ raw[y*(stride+1)] = 0; rgba.copy(raw, y*(stride+1)+1, y*stride, y*stride+stride); }
  function chunk(type, data){ var b = Buffer.alloc(12+data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(crc32(b.slice(4, 8+data.length)), 8+data.length); return b; }
  var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/* box-filter downscale (premultiplied so transparent pixels don't bleed), then luminance */
function shrink(img, maxPx){
  var s = Math.min(1, maxPx / Math.max(img.w, img.h)), W = Math.round(img.w*s), H = Math.round(img.h*s);
  var out = Buffer.alloc(W*H*4), d = img.data;
  for(var y=0;y<H;y++){
    var y0 = Math.floor(y/s), y1 = Math.min(img.h, Math.floor((y+1)/s)) || y0+1;
    for(var x=0;x<W;x++){
      var x0 = Math.floor(x/s), x1 = Math.min(img.w, Math.floor((x+1)/s)) || x0+1;
      var L = 0, A = 0, n = 0;
      for(var yy=y0;yy<y1;yy++) for(var xx=x0;xx<x1;xx++){
        var i = (yy*img.w+xx)*4, a = d[i+3]/255;
        L += (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]) * a; A += a; n++;
      }
      var o = (y*W+x)*4, lum = A > 0 ? Math.round(L / A) : 0;
      out[o] = out[o+1] = out[o+2] = lum; out[o+3] = Math.round(255 * A / n);
    }
  }
  return { w:W, h:H, data:out };
}
var inDir = process.argv[2], outDir = process.argv[3], maxPx = +process.argv[4] || 1600;
if(!inDir || !outDir){ console.error('usage: node tools/prep-photos.js <inDir> <outDir> [maxPx]'); process.exit(1); }
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.readdirSync(inDir).filter(function(f){ return /\.png$/i.test(f); }).sort().forEach(function(f){
  var img = decodePNG(fs.readFileSync(path.join(inDir, f)));
  var p = shrink(img, maxPx), png = encodePNG(p.w, p.h, p.data);
  fs.writeFileSync(path.join(outDir, f.toLowerCase()), png);
  console.log(f, img.w + 'x' + img.h, '->', p.w + 'x' + p.h, Math.round(png.length/1024) + ' KB');
});
