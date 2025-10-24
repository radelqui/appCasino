// Simple preview server for Caja UI
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8090;
const indexPath = path.join(__dirname, '..', 'Caja', 'caja.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error cargando Caja/caja.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    // Serve static assets relative to Caja folder when requested (e.g., styles.css)
    const staticPath = path.join(__dirname, '..', 'Caja', req.url);
    fs.readFile(staticPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        const ext = path.extname(staticPath).toLowerCase();
        const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      }
    });
  }
});

server.listen(port, () => {
  console.log(`Caja preview server running at http://localhost:${port}/`);
});
