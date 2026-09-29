import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT) || 3000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('Missing dist/index.html. Run npm run build before starting.');
  process.exit(1);
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const file = path.normalize(path.join(root, relative));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (file !== root && !file.startsWith(rootWithSep)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const file = fileFor(req.url || '/');
  if (!file) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (!err) {
      send(res, 200, data, types[path.extname(file)] || 'application/octet-stream');
      return;
    }
    fs.readFile(path.join(root, 'index.html'), (indexErr, index) => {
      if (indexErr) send(res, 404, 'Not found');
      else send(res, 200, index, types['.html']);
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Listening on ${port}`);
});
