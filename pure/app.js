document.addEventListener('DOMContentLoaded', async () => {
  const selModo = document.getElementById('modo');
  const selAncho = document.getElementById('ancho');
  const btnGuardar = document.getElementById('btn-guardar');
  const btnPreview = document.getElementById('btn-preview');
  const btnTest = document.getElementById('btn-test');
  const status = document.getElementById('status');
  const iframe = document.getElementById('preview-frame');
  const empty = document.getElementById('preview-empty');
  const emitValor = document.getElementById('emit-valor');
  const emitMoneda = document.getElementById('emit-moneda');
  const emitMesa = document.getElementById('emit-mesa');
  const btnEmitir = document.getElementById('btn-emitir');

  function setStatus(msg, isError = false) {
    status.textContent = msg || '';
    status.style.color = isError ? '#b91c1c' : '#0f766e';
  }

  async function loadProfile() {
    try {
      const res = await (window.api?.getPrintProfile?.() ?? Promise.resolve(null));
      const profile = res?.current || res || null;
      if (profile) {
        if (profile.mode) selModo.value = profile.mode;
        const w = profile.paperWidth || profile.width_mm || profile.paperWidthMm;
        if (w) selAncho.value = String(w);
      }
    } catch (e) {
      console.warn('No se pudo cargar el perfil:', e);
    }
  }

  async function saveProfile() {
    try {
      const profile = { mode: selModo.value, width_mm: Number(selAncho.value) };
      await (window.api?.setPrintProfile?.(profile) ?? Promise.resolve());
      setStatus('Perfil guardado y menú actualizado.');
    } catch (e) {
      console.error('Error guardando perfil:', e);
      setStatus('Error guardando perfil', true);
    }
  }

  async function previewPdf() {
    try {
      setStatus('Generando vista previa...');
      const res = await (window.api?.getTicketPreview?.() ?? Promise.resolve(null));
      const dataUrl = res?.dataUrl || res;
      if (dataUrl) {
        iframe.src = dataUrl;
        iframe.style.display = 'block';
        empty.style.display = 'none';
        setStatus('Vista previa lista.');
      } else {
        setStatus('No se pudo generar la vista previa', true);
      }
    } catch (e) {
      console.error('Error en vista previa:', e);
      setStatus('Error generando la vista previa', true);
    }
  }

  async function testPrint() {
    try {
      setStatus('Enviando impresión de prueba...');
      await (window.api?.testPrinter?.() ?? Promise.resolve());
      setStatus('Impresión de prueba enviada.');
    } catch (e) {
      console.error('Error de prueba de impresión:', e);
      setStatus('Error en impresión de prueba', true);
    }
  }

  async function emitirTicket() {
    try {
      const valor = parseFloat(emitValor?.value || '0');
      const moneda = (emitMoneda?.value || 'DOP').toUpperCase();
      const mesa_id = emitMesa?.value || 'M-01';
      if (!valor || valor <= 0) { setStatus('Valor inválido', true); return; }
      setStatus('Emitiendo ticket...');
      const res = await (window.api?.generateTicket?.({ valor, moneda, mesa_id, usuario_emision: 'operador' }) ?? Promise.resolve(null));
      if (res?.ticket_number) {
        setStatus(`Ticket emitido: ${res.ticket_number} ${moneda} ${valor.toFixed(2)}`);
      } else {
        setStatus('No se pudo emitir ticket', true);
      }
    } catch (e) {
      console.error('Error emitiendo ticket:', e);
      setStatus(`Error emitiendo ticket: ${e.message}`, true);
    }
  }

  btnGuardar?.addEventListener('click', saveProfile);
  btnPreview?.addEventListener('click', previewPdf);
  btnTest?.addEventListener('click', testPrint);
  btnEmitir?.addEventListener('click', emitirTicket);

  await loadProfile();
});