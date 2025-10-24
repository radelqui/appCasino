import React, { useState } from 'react';

export default function CajaView() {
  const [qr, setQr] = useState('');
  const [log, setLog] = useState([]);
  const pushLog = (line) => setLog((prev) => [...prev.slice(-100), `[Caja] ${line}`]);

  const validar = async () => {
    try {
      pushLog(`Validar QR...`);
      const res = await window.api?.validateTicket?.(qr);
      pushLog(`OK: ticket ${res.ticket?.ticket_number || res.ticket?.id}`);
    } catch (e) { pushLog(`Error: ${e.message}`); }
  };

  const pagar = async () => {
    try {
      const ticket_number = qr?.trim();
      pushLog(`Pagar ticket ${ticket_number}...`);
      const res = await window.api?.processPayment?.({ ticket_number, usuario_canje: 'cajero' });
      pushLog(`OK: ${res.message}`);
    } catch (e) { pushLog(`Error: ${e.message}`); }
  };

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <h3>Caja</h3>
          <div className="label">QR / Número de ticket</div>
          <input className="input" value={qr} onChange={e=>setQr(e.target.value)} placeholder="Pegar QR o escribir número" />
          <div style={{marginTop:12, display:'flex', gap:8}}>
            <button className="button" onClick={validar}>Validar</button>
            <button className="button secondary" onClick={pagar}>Pagar</button>
          </div>
          <hr className="sep" />
          <div className="label">Log</div>
          <div className="log">{log.map((l,i)=>(<div key={i}>{l}</div>))}</div>
        </div>
      </div>
    </div>
  );
}
