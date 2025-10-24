import React, { useState } from 'react';

export default function MesaView() {
  const [valor, setValor] = useState('100');
  const [moneda, setMoneda] = useState('DOP');
  const [mesaId, setMesaId] = useState('M-01');
  const [log, setLog] = useState([]);

  const pushLog = (line) => setLog((prev) => [...prev.slice(-100), `[Mesa] ${line}`]);

  const emitir = async () => {
    try {
      const payload = { valor: parseFloat(valor), moneda, mesa_id: mesaId, usuario_emision: 'operador' };
      pushLog(`Emitir ticket: ${JSON.stringify(payload)}`);
      const res = await window.api?.generateTicket?.(payload);
      pushLog(`OK: ticket ${res.ticket_number} ${res.moneda} ${res.valor}`);
    } catch (e) {
      pushLog(`Error: ${e.message}`);
    }
  };

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <h3>Emisión de Ticket</h3>
          <div className="row">
            <div className="col">
              <div className="label">Valor</div>
              <input className="input" type="number" min="0" value={valor} onChange={e=>setValor(e.target.value)} />
            </div>
            <div className="col">
              <div className="label">Moneda</div>
              <select className="input" value={moneda} onChange={e=>setMoneda(e.target.value)}>
                <option>DOP</option>
                <option>USD</option>
              </select>
            </div>
            <div className="col">
              <div className="label">Mesa</div>
              <input className="input" value={mesaId} onChange={e=>setMesaId(e.target.value)} />
            </div>
          </div>
          <div style={{marginTop:12}}>
            <button className="button" onClick={emitir}>Emitir Ticket</button>
          </div>
          <hr className="sep" />
          <div className="label">Log</div>
          <div className="log">{log.map((l,i)=>(<div key={i}>{l}</div>))}</div>
        </div>
      </div>
    </div>
  );
}
