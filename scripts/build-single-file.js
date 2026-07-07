// Packs the expo web export (./dist) into one self-contained HTML file
// (./dist-single/index.html) with the font assets inlined as data URIs,
// so it can be hosted anywhere — including at a subpath — with zero
// additional requests.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(ROOT, 'dist-single');

const jsDir = path.join(DIST, '_expo/static/js/web');
const bundleFile = fs.readdirSync(jsDir).find((f) => f.endsWith('.js'));
let js = fs.readFileSync(path.join(jsDir, bundleFile), 'utf8');

const assetRefs = [...new Set(js.match(/\/assets\/[^"']+\.ttf/g) || [])];
for (const ref of assetRefs) {
  const file = path.join(DIST, ref.slice(1));
  const b64 = fs.readFileSync(file).toString('base64');
  js = js.split(ref).join(`data:font/ttf;base64,${b64}`);
  console.log('inlined', ref);
}

js = js.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>DOOMTYPE</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#EFEBFF" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⌨️</text></svg>" />
<style>
  html, body { height: 100%; margin: 0; padding: 0; background: #EFEBFF; }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
console.log('wrote dist-single/index.html', `(${(html.length / 1024 / 1024).toFixed(2)} MB)`);
