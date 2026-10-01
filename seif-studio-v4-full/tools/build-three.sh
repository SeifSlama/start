#!/bin/bash
# Rebuilds assets/vendor/three-r186.min.js: three.js r186 + OrbitControls + RoomEnvironment
# as one self-contained ES module (MIT licence notices kept at the end of the file).
# The studio imports it at runtime; nothing else in the client uses npm.
set -e
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/vendor/three-r186.min.js"
cd "$(mktemp -d)"
npm init -y >/dev/null
npm i -s three@0.186.1 esbuild@0.24.2 >/dev/null
cat > entry.js <<'JS'
export * from 'three';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
JS
npx esbuild entry.js --bundle --minify --format=esm --legal-comments=eof --outfile=three.min.js
cp three.min.js "$OUT"
echo "Wrote assets/vendor/three-r186.min.js"
