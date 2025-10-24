const http = require('http');
const path = require('path');
const { generateTicketPDF } = require(path.join(__dirname, '..', 'src', 'main', 'utils', 'pdf-generator.js'));

const PORT = process.env.PREVIEW_PORT ? Number(process.env.PREVIEW_PORT) : 8088;

function pageHtml() {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>Vista previa voucher</title>
<style>
body{font-family:system-ui,Segoe UI,Arial;padding:20px;background:#0b1220;color:#e5e7eb}
.card{background:#0f172a;border:1px solid #1f2937;border-radius:12px;padding:16px;max-width:840px;margin:0 auto}
.row{display:flex;gap:12px;flex-wrap:wrap}
.col{flex:1 1 200px}
.label{font-size:12px;color:#9ca3af;margin-bottom:6px}
.input,select{width:100%;padding:8px;border-radius:8px;border:1px solid #334155;background:#111827;color:#e5e7eb}
.button{padding:8px 12px;border-radius:8px;border:1px solid #334155;background:#1f2937;color:#e5e7eb;cursor:pointer}
iframe{border:1px solid #334155;border-radius:8px}
small{color:#94a3b8}
</style>
</head><body>
<div class="card">
<h1 style="margin-top:0">Vista previa del voucher</h1>
<div class="row">
  <div class="col">
    <div class="label">Valor</div>
    <input id="valor" class="input" type="number" min="0" step="0.01" value="123.45" />
  </div>
  <div class="col">
    <div class="label">Moneda</div>
    <select id="moneda" class="input"><option value="DOP">DOP</option><option value="USD">USD</option></select>
  </div>
  <div class="col">
    <div class="label">Ancho (mm)</div>
    <select id="ancho" class="input"><option value="80">80</option><option value="58">58</option></select>
  </div>
  <div class="col">
    <div class="label">Alto (mm)</div>
    <input id="alto" class="input" type="number" min="50" max="400" step="1" value="120" />
  </div>
</div>
<div class="row">
  <div class="col">
    <div class="label">Mesa</div>
    <input id="mesa" class="input" value="P01" />
  </div>
  <div class="col">
    <div class="label">Emitido por</div>
    <input id="usuario" class="input" value="VistaPrevia" />
  </div>
</div>
<div style="margin-top:12px">
  <button class="button" id="btn">Generar vista previa</button>
  <small style="margin-left:8px">Usa los campos para personalizar el PDF.</small>
</div>
<hr style="border:none;border-top:1px solid #334155;margin:16px 0"/>
<iframe id="frame" src="/voucher.pdf" width="420" height="640"></iframe>
<p><a id="link" href="/voucher.pdf" target="_blank">Abrir PDF en otra pestaña</a></p>
</div>
<script>
const frame = document.getElementById('frame');
const link = document.getElementById('link');
function genUrl() {
  const valor = document.getElementById('valor').value || '123.45';
  const moneda = document.getElementById('moneda').value || 'DOP';
  const ancho = document.getElementById('ancho').value || '80';
  const alto = document.getElementById('alto').value || '120';
  const mesa = document.getElementById('mesa').value || 'P01';
  const usuario = document.getElementById('usuario').value || 'VistaPrevia';
  const qs = new URLSearchParams({valor, moneda, ancho, alto, mesa_id: mesa, usuario_emision: usuario});
  return '/voucher.pdf?' + qs.toString();
}
function applyUrl() {
  const u = genUrl();
  frame.src = u; link.href = u;
}
applyUrl();
document.getElementById('btn').addEventListener('click', applyUrl);
</script>
</body></html>`;
}

function readParams(reqUrl) {
  try {
    const u = new URL(reqUrl, 'http://localhost');
    const p = u.searchParams;
    return {
      valor: (p.get('valor') === null ? NaN : parseFloat(p.get('valor'))),
      moneda: (p.get('moneda') || 'DOP').toUpperCase(),
      ancho: Number(p.get('ancho') || '80'),
      alto: (p.get('alto') === null ? NaN : Number(p.get('alto'))),
      mesa_id: p.get('mesa_id') || 'P01',
      usuario_emision: p.get('usuario_emision') || 'VistaPrevia'
    };
  } catch { return null; }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/' || req.url.startsWith('/index')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageHtml());
      return;
    }
    if (req.url.startsWith('/voucher.pdf')) {
      const p = readParams(req.url) || {};
      const now = new Date();
      const ticket = {
        ticket_number: 'PREV-' + Math.floor((now.getTime() / 1000) % 1000000).toString().padStart(6, '0'),
        valor: isNaN(p.valor) ? 335.45 : p.valor,
        moneda: ['USD','DOP'].includes(p.moneda) ? p.moneda : 'DOP',
        fecha_emision: now.toISOString(),
        mesa_id: p.mesa_id,
        usuario_emision: p.usuario_emision,
        pageWidthMm: isNaN(p.ancho) ? 80 : p.ancho,
        pageHeightMm: isNaN(p.alto) ? undefined : p.alto // sin altura fija por defecto
      };
      const buf = await generateTicketPDF(ticket);
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(buf);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error generando vista previa: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`Preview server started: http://localhost:${PORT}/`);
});