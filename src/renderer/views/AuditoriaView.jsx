import React, { useState } from 'react';

export default function AuditoriaView() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stats, setStats] = useState(null);
  const [log, setLog] = useState([]);
  const pushLog = (line) => setLog((prev) => [...prev.slice(-100), `[Auditoría] ${line}`]);

  const obtener = async () => {
    try {
      pushLog('Solicitar estadísticas...');
      const res = await window.api?.getStats?.({ dateFrom: from, dateTo: to });
      setStats(res.stats);
      pushLog('OK: estadísticas recibidas');
    } catch (e) { pushLog(`Error: ${e.message}`); }
  };

  const sync = async () => {
    try {
      pushLog('Forzar sincronización...');
      await window.api?.forceSync?.();
      pushLog('OK: sincronización disparada');
    } catch (e) { pushLog(`Error: ${e.message}`); }
  };

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <h3>Auditoría</h3>
          <div className="row">
            <div className="col">
              <div className="label">Desde</div>
              <input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
            </div>
            <div className="col">
              <div className="label">Hasta</div>
              <input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)} />
            </div>
          </div>
          <div style={{marginTop:12, display:'flex', gap:8}}>
            <button className="button" onClick={obtener}>Obtener</button>
            <button className="button secondary" onClick={sync}>Sincronizar Ahora</button>
          </div>
          <hr className="sep" />
          <div className="label">Resultados</div>
          <div className="preview">
            {stats ? <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(stats, null, 2)}</pre> : 'Sin datos'}
          </div>
          <hr className="sep" />
          <div className="label">Log</div>
          <div className="log">{log.map((l,i)=>(<div key={i}>{l}</div>))}</div>
        </div>
      </div>
    </div>
  );
}
