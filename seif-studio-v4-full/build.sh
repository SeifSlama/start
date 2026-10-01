#!/bin/bash
# Builds seif-studio.html (the 3D studio on its own) and dist/ (upload this folder to Cloudflare Pages).
# Everything happens in tools/build.js; see the comment at its top for what goes where.
set -e
cd "$(dirname "$0")"
node tools/build.js
