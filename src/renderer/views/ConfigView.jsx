import React, { useEffect, useState } from 'react';

export default function ConfigView() {
  const [mode, setMode] = useState('PDF');
  const [widthMm, setWidthMm] = useState(80);
  const [log, setLog] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const pushLog = (line) => setLog((prev) => [...prev.slice(-100), `[Config] ${line}`]);

  // Cargar perfil inicial desde main
  useEffect(() => {
    const load = async () => {
      try {
        const res = await window.api?.getPrintProfile?.();
        const cur = res?.current || {};
        if (cur.mode) setMode(cur.mode);
        if (cur.width_mm) setWidthMm(Number(cur.width_mm));
        pushLog(`Perfil cargado: modo=${cur.mode || 'PDF'}, ancho=${cur.width_mm || 80}mm`);
      } catch (e) {
        pushLog(`No se pudo cargar perfil: ${e.message}`);
      }
    };
    load();
  }, []);

  // Aplicar cambios de modo/ancho
  useEffect(() => {
    const applyProfile = async () => {
      try {
        const res = await window.api?.setPrintProfile?.({ mode, width_mm: Number(widthMm) });
        if (res?.success) {
          const cur = res.current || {};
          pushLog(`Perfil aplicado: modo=${cur.mode}, ancho=${cur.width_mm}mm, alto=${cur.height_mm}mm`);
        }
      } catch (e) {
        pushLog(`Error aplicando perfil: ${e.message}`);
      }
    };
    applyProfile();
  }, [mode, widthMm]);

  const probarImpresion = async () => {
    try {
      pushLog('Probar impresión...');
      const res = await window.api?.testPrinter?.();
      if (res?.success) pushLog('OK: prueba enviada');
    } catch (e) { pushLog(`Error: ${e.message}`); }
  };

  const probarCalibracion = async () => {
    try {
      pushLog('Probar calibración...');
      const res = await window.api?.testCalibration?.();
      if (res?.success) pushLog('OK: calibración enviada');
    } catch (e) { pushLog(`Error: ${e.message}`); }
  };

  const generarVistaPrevia = async () => {
    try {
      pushLog('Generando vista previa PDF...');
      const res = await window.api?.getTicketPreview?.();
      if (res?.success && res.dataUrl) {
        setPreviewUrl(res.dataUrl);
        pushLog('Vista previa actualizada');
      }
    } catch (e) {
      pushLog(`Error generando vista previa: ${e.message}`);
    }
  };

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <h3>Configuración de Impresión</h3>
          <div className="row">
            <div className="col">
              <div className="label">Modo</div>
              <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
                <option value="PDF">PDF (Spooler Windows)</option>
                <option value="ESCPOS">ESC/POS (Térmica directa)</option>
              </select>
            </div>
            <div className="col">
              <div className="label">Ancho papel</div>
              <select className="input" value={String(widthMm)} onChange={e=>setWidthMm(Number(e.target.value))}>
                <option value="80">80 mm</option>
                <option value="58">58 mm</option>
              </select>
            </div>
          </div>
          <div style={{marginTop:12, display:'flex', gap:8}}>
            <button className="button" onClick={probarImpresion}>Probar Impresión</button>
            <button className="button secondary" onClick={probarCalibracion}>Probar Calibración</button>
            <button className="button outline" onClick={generarVistaPrevia}>Vista previa PDF</button>
          </div>
          <hr className="sep" />
          <div className="label">Log</div>
          <div className="log">{log.map((l,i)=>(<div key={i}>{l}</div>))}</div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <h3>Vista previa de Ticket</h3>
          {previewUrl ? (
            <iframe title="preview" src={previewUrl} style={{width:'100%', height:400, border:'1px solid #ddd', borderRadius:6}}/>
          ) : (
            <div className="preview">Pulsa "Vista previa PDF" para generar una vista previa según el perfil actual.</div>
          )}
        </div>
      </div>
    </div>
  );
}