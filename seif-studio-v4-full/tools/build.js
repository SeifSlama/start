#!/usr/bin/env node
/* ============================================================
   BUILD — assembles dist/, the folder uploaded to Cloudflare Pages.

   dist/index.html, pricing.html, dashboard.html, …   site/pages/*.html with <!--@…--> includes
   dist/design.html                                     the 3D studio (src/ parts, in order)
   dist/ds/ds.css, ds/shell.js                          the platform's design system and app shell
   dist/sf/store.css, sf/runtime.js, sf/engine.js       every store's styles, browser script, and the
                                                        renderer for in-browser previews
   dist/_worker.js                                      the server: storefront renderer + API
   dist/assets/, icons/, demo/, manifest, sw.js         static files

   Page includes:
     <!--@head title="…" desc="…"-->   charset, viewport, icons, manifest, fonts, ds.css, config script
     <!--@shell-->                      the app shell script
     <!--@engine-->                     the store renderer (themes, words, sample products)
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), SRC = path.join(ROOT, 'src'), SITE = path.join(ROOT, 'site'), DIST = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
function copyDir(from, to){
  if(!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for(const e of fs.readdirSync(from, { withFileTypes: true })){
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if(e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

/* ---------- the 3D studio: one HTML file, config script first ---------- */
const STUDIO_PARTS = ['p1_head.html', 'p2_body.html', 'r_core.js', 'r_models.js', 'r_tee3d.js', 'r_panels.js', 'p5_ui.js', 'p5b_editor.js', 'p7_studio3d.js', 'p6_tail.html'];
const studio = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<script>\n' + read(path.join(SRC, 'p0_config.js')) + '</script>\n'
  + STUDIO_PARTS.map(f => read(path.join(SRC, f))).join('');
write(path.join(ROOT, 'seif-studio.html'), studio);

/* ---------- shared pieces ---------- */
const STORE_ENGINE = ['i18n.js', 'themes.js', 'demo.js', 'render.js'].map(f => read(path.join(SITE, 'store', f))).join('\n');
const DS_CSS = read(path.join(SITE, 'shared', 'ds.css')), SHELL = read(path.join(SITE, 'shared', 'shell.js'));
const STORE_CSS = read(path.join(SITE, 'store', 'store.css')), RUNTIME = read(path.join(SITE, 'store', 'runtime.js'));
const V = crypto.createHash('sha1').update(STORE_ENGINE + DS_CSS + SHELL + STORE_CSS + RUNTIME + read(path.join(SITE, 'store', 'preview.js'))).digest('hex').slice(0, 10);

function head(title, desc){
  const e = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<title>' + e(title) + '</title>',
    '<meta name="description" content="' + e(desc) + '">',
    '<meta name="theme-color" content="#EFE8DC">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="apple-mobile-web-app-title" content="Design">',
    '<meta property="og:title" content="' + e(title) + '">',
    '<meta property="og:description" content="' + e(desc) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:image" content="/icons/og.png">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/svg+xml" href="/icons/icon.svg">',
    '<link rel="apple-touch-icon" href="/icons/icon-180.png">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap">',
    '<link rel="stylesheet" href="/ds/ds.css?v=' + V + '">',
    /* the server writes the live config into this script (it replaces the first "<script>\n") */
    '<script>\nwindow.SEIF_CONFIG = window.SEIF_CONFIG || { demo: true };\nwindow.SEIF_V = "' + V + '";\n</script>'
  ].join('\n');
}
function expand(html, file){
  return html
    .replace(/<!--@head\s+title="([^"]*)"\s+desc="([^"]*)"\s*-->/, (m, t, d) => head(t, d))
    .replace(/<!--@shell-->/g, '<script src="/ds/shell.js?v=' + V + '"></script>')
    .replace(/<!--@engine-->/g, '<script src="/sf/engine.js?v=' + V + '"></script>')
    .replace(/<!--@v-->/g, V)
    .replace(/<!--@[a-z]+[^>]*-->/g, m => { throw new Error(file + ': unknown include ' + m); });
}

/* ---------- dist ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(SITE, 'static'), DIST);
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
write(path.join(DIST, 'design.html'), studio);
write(path.join(DIST, 'sw.js'), read(path.join(SITE, 'static', 'sw.js')).replace('__V__', V));
write(path.join(DIST, 'ds', 'ds.css'), DS_CSS);
write(path.join(DIST, 'ds', 'shell.js'), SHELL);
write(path.join(DIST, 'sf', 'store.css'), STORE_CSS);
write(path.join(DIST, 'sf', 'runtime.js'), RUNTIME);
write(path.join(DIST, 'sf', 'engine.js'), STORE_ENGINE + '\n' + read(path.join(SITE, 'store', 'preview.js')));
const pagesDir = path.join(SITE, 'pages');
let pages = [];
if(fs.existsSync(pagesDir)) for(const f of fs.readdirSync(pagesDir)){
  if(!f.endsWith('.html') || f.startsWith('_')) continue;
  write(path.join(DIST, f), expand(read(path.join(pagesDir, f)), f));
  pages.push(f);
}
/* the dashboard app is split into parts for editing; they are joined in name order */
const dashDir = path.join(SITE, 'dashboard');
if(fs.existsSync(dashDir) && fs.readdirSync(dashDir).length){
  const parts = fs.readdirSync(dashDir).sort();
  const css = parts.filter(f => f.endsWith('.css')).map(f => read(path.join(dashDir, f))).join('\n');
  const js = parts.filter(f => f.endsWith('.js')).map(f => read(path.join(dashDir, f))).join('\n');
  const shell = read(path.join(dashDir, '_page.html'));
  write(path.join(DIST, 'dashboard.html'), expand(shell.replace('/*@css*/', () => css).replace('/*@js*/', () => js), 'dashboard'));
  pages.push('dashboard.html');
}
/* the server: storefront renderer first (plain scripts), then the worker module */
write(path.join(DIST, '_worker.js'), '/* built ' + new Date().toISOString() + ' */\nvar SF_V = "' + V + '";\n' + STORE_ENGINE + '\n'
  + read(path.join(ROOT, 'worker', 'stores.js')) + '\n' + read(path.join(ROOT, 'worker', 'index.js')));
console.log('Built dist/ (v' + V + '): ' + pages.concat(['design.html', '_worker.js']).join(', '));
