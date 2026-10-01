#!/bin/bash
# Assembles the source parts into the single deployable HTML file, then the Cloudflare Pages upload folder.
# Order: p0_config.js (inline <script> in <head>, first so a server can inject SEIF_CONFIG)
#        p1_head.html p2_body.html r_core.js r_models.js r_tee3d.js r_panels.js p5_ui.js p5b_editor.js p7_studio3d.js p6_tail.html
set -e
cd "$(dirname "$0")/src"
{
  printf '<!DOCTYPE html>\n<html lang="en">\n<head>\n<script>\n'
  cat p0_config.js
  printf '</script>\n'
  cat p1_head.html p2_body.html r_core.js r_models.js r_tee3d.js r_panels.js p5_ui.js p5b_editor.js p7_studio3d.js p6_tail.html
} > ../seif-studio.html
echo "Built seif-studio.html"

# dist/ is exactly what gets uploaded to Cloudflare Pages: the page, the garment renders, the server.
cd ..
rm -rf dist && mkdir -p dist
cp seif-studio.html dist/index.html
cp -r assets dist/assets
cp worker/index.js dist/_worker.js
echo "Built dist/ (upload this folder to Cloudflare Pages)"
