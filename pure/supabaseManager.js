// pure/supabaseManager.js - Gestión centralizada de Supabase para sincronización
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

class SupabaseManager {
  constructor() {
    this.client = null; // SERVICE_ROLE client para operaciones admin
    this.anonClient = null; // ANON client para auth de usuarios
    this.available = false;
    this.isConnected = false;
    this._initClient();
  }

  _initClient() {
    try {
      const url = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = process.env.SUPABASE_ANON_KEY;

      if (!url) {
        console.warn('⚠️  Supabase no configurado (falta SUPABASE_URL)');
        return;
      }

      // Cliente con SERVICE_ROLE para operaciones admin
      if (serviceKey) {
        this.client = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        console.log('✅ Cliente Supabase SERVICE_ROLE inicializado');
      }

      // Cliente con ANON para autenticación de usuarios
      if (anonKey) {
        this.anonClient = createClient(url, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        console.log('✅ Cliente Supabase ANON inicializado');
      }

      this.available = (this.client !== null) || (this.anonClient !== null);
    } catch (error) {
      console.error('❌ Error inicializando Supabase:', error.message);
    }
  }

  isAvailable() {
    return this.available && this.client !== null;
  }

  /**
   * Prueba la conexión a Supabase
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    if (!this.isAvailable()) return false;

    try {
      const { error } = await this.client
        .from('vouchers')
        .select('voucher_code')
        .limit(1);

      this.isConnected = !error;
      return this.isConnected;
    } catch (error) {
      console.warn('⚠️  Error probando conexión Supabase:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Genera hash QR para el voucher
   */
  generateQRHash(qrData) {
    const secret = process.env.QR_SECRET || 'CASINO_SECRET_2024';
    return crypto.createHash('sha256').update(qrData + secret).digest('hex');
  }

  /**
   * Crea un voucher en Supabase (cloud)
   * @param {Object} voucherData - Datos del voucher
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async createVoucher(voucherData) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase no disponible (modo offline)' };
    }

    try {
      const {
        voucher_code,
        amount,
        currency,
        issued_by_user_id,
        issued_at_station_id,
        customer_name = null
      } = voucherData;

      // Generar QR data
      const qrData = `${voucher_code}|${amount}|${currency}`;
      const qrHash = this.generateQRHash(qrData);

      // Calcular fecha de expiración (365 días)
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + 365 * 24 * 60 * 60 * 1000);

      const payload = {
        voucher_code,
        qr_data: qrData,
        qr_hash: qrHash,
        amount: Number(amount),
        currency: String(currency).toUpperCase(),
        status: 'active',
        issued_by_user_id,
        issued_at_station_id,
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        customer_name
      };

      const { data, error } = await this.client
        .from('vouchers')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando voucher en Supabase:', error.message);
        return { success: false, error: error.message };
      }

      console.log('✅ Voucher creado en Supabase:', voucher_code);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error inesperado creando voucher:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca un voucher por código en Supabase
   * @param {string} voucherCode
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async getVoucher(voucherCode) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase no disponible (modo offline)' };
    }

    try {
      const { data, error } = await this.client
        .from('vouchers')
        .select('*')
        .eq('voucher_code', String(voucherCode).toUpperCase().trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Voucher no encontrado' };
        }
        console.error('❌ Error buscando voucher:', error.message);
        return { success: false, error: error.message };
      }

      console.log('✅ Voucher encontrado en Supabase:', voucherCode);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error inesperado buscando voucher:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualiza el estado de un voucher (redeem/cancel)
   * @param {string} voucherCode
   * @param {string} status - 'redeemed', 'cancelled', etc.
   * @param {string} redeemedByUserId - UUID del usuario que canjea
   * @param {number} redeemedAtStationId - ID de la estación donde se canjea
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async updateVoucherStatus(voucherCode, status, redeemedByUserId = null, redeemedAtStationId = null) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase no disponible (modo offline)' };
    }

    try {
      const updateData = {
        status: String(status).toLowerCase()
      };

      if (status === 'redeemed' || status === 'used') {
        updateData.status = 'redeemed';
        updateData.redeemed_at = new Date().toISOString();
        if (redeemedByUserId) updateData.redeemed_by_user_id = redeemedByUserId;
        if (redeemedAtStationId) updateData.redeemed_at_station_id = redeemedAtStationId;
      }

      const { data, error } = await this.client
        .from('vouchers')
        .update(updateData)
        .eq('voucher_code', String(voucherCode).toUpperCase().trim())
        .select()
        .single();

      if (error) {
        console.error('❌ Error actualizando voucher:', error.message);
        return { success: false, error: error.message };
      }

      console.log('✅ Voucher actualizado en Supabase:', voucherCode, '→', status);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error inesperado actualizando voucher:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene las estaciones (mesas) disponibles
   * @returns {Promise<Array>}
   */
  async getStations() {
    if (!this.isAvailable()) return [];

    try {
      const { data, error } = await this.client
        .from('stations')
        .select('*')
        .order('id');

      if (error) {
        console.error('❌ Error obteniendo estaciones:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error inesperado obteniendo estaciones:', error.message);
      return [];
    }
  }

  /**
   * Obtiene los usuarios disponibles
   * @returns {Promise<Array>}
   */
  async getUsers() {
    if (!this.isAvailable()) return [];

    try {
      const { data, error } = await this.client
        .from('users')
        .select('id, email, username')
        .order('email');

      if (error) {
        console.error('❌ Error obteniendo usuarios:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error inesperado obteniendo usuarios:', error.message);
      return [];
    }
  }

  /**
   * Sincroniza vouchers pendientes desde SQLite local a Supabase
   * @param {Array} vouchers - Array de vouchers a sincronizar
   * @returns {Promise<{synced: number, failed: number}>}
   */
  async syncPendingVouchers(vouchers) {
    if (!this.isAvailable() || !Array.isArray(vouchers) || vouchers.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const voucher of vouchers) {
      try {
        const result = await this.createVoucher({
          voucher_code: voucher.code,
          amount: voucher.amount,
          currency: voucher.currency,
          issued_by_user_id: voucher.issued_by_user_id || process.env.DEFAULT_USER_ID,
          issued_at_station_id: voucher.issued_at_station_id || 1,
          customer_name: voucher.customer_name || null
        });

        if (result.success) {
          synced++;
        } else {
          failed++;
          console.warn(`⚠️  No se pudo sincronizar voucher ${voucher.code}:`, result.error);
        }
      } catch (error) {
        failed++;
        console.error(`❌ Error sincronizando voucher ${voucher.code}:`, error.message);
      }
    }

    console.log(`📊 Sincronización completada: ${synced} exitosos, ${failed} fallidos`);
    return { synced, failed };
  }
}

// Singleton
let instance = null;

function getSupabaseManager() {
  if (!instance) {
    instance = new SupabaseManager();
  }
  return instance;
}

module.exports = { SupabaseManager, getSupabaseManager };
