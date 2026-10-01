#!/bin/bash
# Assembles the source parts into the single deployable HTML file.
# Order: p0_config.js (inline <script> in <head>, first so a server can inject SEIF_CONFIG)
#        p1_head.html p2_body.html r_core.js r_models.js r_panels.js p5_ui.js p5b_editor.js p6_tail.html
set -e
cd "$(dirname "$0")/src"
{
  printf '<!DOCTYPE html>\n<html lang="en">\n<head>\n<script>\n'
  cat p0_config.js
  printf '</script>\n'
  cat p1_head.html p2_body.html r_core.js r_models.js r_panels.js p5_ui.js p5b_editor.js p6_tail.html
} > ../seif-studio.html
echo "Built seif-studio.html"
