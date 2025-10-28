// Static server to preview Electron_Puro/*.html
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5513;
const ROOT = path.join(process.cwd(), 'Electron_Puro');

function send(res, status, content, type = 'text/html') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(content);
}

function resolveFile(urlPath) {
  const safePath = path.normalize(urlPath).replace(/^\/+/, '');
  const full = path.join(ROOT, safePath);
  return full;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let reqPath = url.pathname;
  if (reqPath === '/' || reqPath === '/index.html') {
    reqPath = 'config.html';
  }
  const filePath = resolveFile(reqPath);
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, `<h1>404</h1><p>Not found: ${reqPath}</p>`);
    }
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };
    const contentType = typeMap[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 500, `<h1>500</h1><pre>${readErr.message}</pre>`);
      send(res, 200, data, contentType);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Electron_Puro preview server running: http://localhost:${PORT}/config.html`);
});
