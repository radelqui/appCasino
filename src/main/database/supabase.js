// src/main/database/supabase.js
const { createClient } = require('@supabase/supabase-js');

class SupabaseSync {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    this.available = !!(url && key);
    if (this.available) this.client = createClient(url, key);
  }

  isAvailable() { return this.available; }

  async testConnection() {
    if (!this.available) return false;
    try {
      const { data, error } = await this.client.from('tickets').select('id').limit(1);
      if (error) throw error;
      return true;
    } catch (e) { return false; }
  }

  async getTicketByNumber(ticket_number) {
    if (!this.available) return null;
    const { data, error } = await this.client.from('tickets').select('*').eq('ticket_number', ticket_number).single();
    if (error) return null;
    return data || null;
  }

  async syncTickets(tickets) {
    if (!this.available || !Array.isArray(tickets) || tickets.length === 0) return { syncedTickets: [], errors: [] };
    try {
      const payload = tickets.map(t => ({
        id: t.id,
        ticket_number: t.ticket_number,
        valor: t.valor,
        moneda: t.moneda,
        estado: t.estado,
        qr_data: t.qr_data,
        hash_seguridad: t.hash_seguridad,
        mesa_id: t.mesa_id,
        usuario_emision: t.usuario_emision,
        usuario_canje: t.usuario_canje,
        created_at: t.created_at,
        redeemed_at: t.redeemed_at
      }));
      const { data, error } = await this.client.from('tickets').upsert(payload, { onConflict: 'ticket_number' }).select('id');
      if (error) throw error;
      return { syncedTickets: tickets, errors: [] };
    } catch (e) {
      return { syncedTickets: [], errors: [e.message] };
    }
  }
}

module.exports = SupabaseSync;
