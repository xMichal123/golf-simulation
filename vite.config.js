import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const deployServer = `import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const hidden = new Set(['server.js', 'package.json']);

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
  console.error('Missing index.html next to server.js.');
  process.exit(1);
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded.replace(/^\\/+/, '') || 'index.html';
  if (hidden.has(relative)) return null;
  const file = path.normalize(path.join(root, relative));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (file !== root && !file.startsWith(rootWithSep)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const file = fileFor(req.url || '/');
  if (!file) {
    send(res, 404, 'Not found');
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
  console.log(\`Listening on \${port}\`);
});
`;

const deployPackage = {
  name: 'golf-simulation',
  private: true,
  type: 'module',
  scripts: {
    start: 'node server.js',
  },
  engines: {
    node: '>=18',
  },
};

function stageDeploy() {
  return {
    name: 'stage-deploy',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist');
      fs.mkdirSync(dist, { recursive: true });
      fs.writeFileSync(path.join(dist, 'server.js'), deployServer);
      fs.writeFileSync(path.join(dist, 'package.json'), `${JSON.stringify(deployPackage, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [stageDeploy()],
});
