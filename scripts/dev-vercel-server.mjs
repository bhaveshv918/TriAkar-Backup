/* Local stand-in for Vercel's cleanUrls + rewrites, so /products/:slug and
   /stories/:slug can be exercised the way production serves them. Dev only. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv', '.xml': 'application/xml',
};

const REWRITES = [
  [/^\/products\/(.+)$/, s => '/product-detail.html?slug=' + s],
  [/^\/stories\/(.+)$/, s => '/story.html?slug=' + s],
];

function resolveFile(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates = rel === ''
    ? ['index.html']
    : [rel, rel + '.html', path.join(rel, 'index.html')];
  for (const c of candidates) {
    const abs = path.join(ROOT, c);
    if (!abs.startsWith(ROOT)) continue;
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;

  for (const [re, to] of REWRITES) {
    const m = pathname.match(re);
    if (m) { pathname = to(m[1]).split('?')[0]; break; }
  }

  const file = resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.existsSync(path.join(ROOT, '404.html')) ? fs.readFileSync(path.join(ROOT, '404.html')) : 'Not found');
    return;
  }
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  /* Point the page at the live API so a local run renders real data instead
     of the "could not load" state. Set DEV_LOCAL_API=1 to keep localhost:3000. */
  if (['.html', '.js'].includes(path.extname(file)) && !process.env.DEV_LOCAL_API) {
    const body = fs.readFileSync(file, 'utf8').replace(/'http:\/\/localhost:3000'/g, "'https://triakar.onrender.com'");
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
    return;
  }
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
}).listen(8124, () => console.log('dev-vercel-server on http://localhost:8124'));
