// ============================================
// CLIENTE SUPABASE MEJORADO
// Sistema de Vouchers - Gran Casino Sosúa
// ============================================

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const EventEmitter = require('events');

// Cargar variables de entorno
dotenv.config();

class SupabaseManager extends EventEmitter {
  constructor() {
    super();
    
    this.supabase = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 segundos
    this.checkInterval = null;
    
    // Solo inicializar si está habilitado en .env
    if (process.env.USE_SUPABASE === 'true') {
      this.initialize();
    } else {
      console.log('ℹ️  Supabase desactivado (USE_SUPABASE=false)');
    }
  }

  /**
   * Inicializar cliente Supabase
   */
  initialize() {
    try {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!url || !key) {
        throw new Error('Faltan credenciales de Supabase en .env');
      }

      this.supabase = createClient(url, key, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'X-Client-Info': 'casino-susua-app'
          }
        }
      });

      console.log('✅ Cliente Supabase inicializado');
      this.startConnectionMonitor();
      
    } catch (error) {
      console.error('❌ Error al inicializar Supabase:', error.message);
      this.emit('error', error);
    }
  }

  /**
   * Monitorear conexión cada 30 segundos
   */
  startConnectionMonitor() {
    this.checkConnection();
    
    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, 30000); // Cada 30 segundos
  }

  /**
   * Detener monitoreo de conexión
   */
  stopConnectionMonitor() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Verificar si hay conexión a Supabase
   */
  async checkConnection() {
    if (!this.supabase) {
      this.isConnected = false;
      return false;
    }

    try {
      // Hacer una consulta simple para verificar conexión
      const { data, error } = await this.supabase
        .from('stations')
        .select('id')
        .limit(1);

      if (error) throw error;

      if (!this.isConnected) {
        console.log('✅ Conexión a Supabase establecida');
        this.isConnected = true;
        this.connectionRetries = 0;
        this.emit('connected');
      }

      return true;

    } catch (error) {
      if (this.isConnected) {
        console.log('⚠️  Conexión a Supabase perdida');
        this.isConnected = false;
        this.emit('disconnected');
      }

      // Intentar reconectar
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`🔄 Reintentando conexión (${this.connectionRetries}/${this.maxRetries})...`);
        
        setTimeout(() => {
          this.checkConnection();
        }, this.retryDelay);
      }

      return false;
    }
  }

  /**
   * Obtener estado de conexión
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      retries: this.connectionRetries,
      maxRetries: this.maxRetries
    };
  }

  // ============================================
  // MÉTODOS DE VOUCHERS
  // ============================================

  /**
   * Crear voucher en Supabase
   */
  async createVoucher(voucherData) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const { data, error } = await this.supabase
        .from('vouchers')
        .insert({
          id: voucherData.id,
          voucher_code: voucherData.voucher_code,
          qr_data: voucherData.qr_data,
          qr_hash: voucherData.qr_hash,
          amount: voucherData.amount,
          currency: voucherData.currency,
          issued_by_user_id: voucherData.issued_by_user_id,
          issued_at_station_id: voucherData.issued_at_station_id,
          expires_at: voucherData.expires_at,
          customer_name: voucherData.customer_name || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error al crear voucher en Supabase:', error);
      throw error;
    }
  }

  /**
   * Validar voucher en Supabase
   */
  async validateVoucher(voucherCode) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const { data, error } = await this.supabase
        .from('vouchers')
        .select(`
          *,
          issued_by:users!issued_by_user_id(full_name),
          station:stations!issued_at_station_id(station_name)
        `)
        .eq('voucher_code', voucherCode)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No encontrado
          return { valid: false, message: 'Voucher no encontrado o ya utilizado' };
        }
        throw error;
      }

      // Verificar expiración
      if (new Date(data.expires_at) < new Date()) {
        return { valid: false, message: 'Voucher expirado' };
      }

      return { valid: true, voucher: data };

    } catch (error) {
      console.error('Error al validar voucher en Supabase:', error);
      throw error;
    }
  }

  /**
   * Redimir voucher en Supabase
   */
  async redeemVoucher(voucherId, userId, stationId) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const { data, error } = await this.supabase
        .from('vouchers')
        .update({
          status: 'redeemed',
          redeemed_by_user_id: userId,
          redeemed_at_station_id: stationId,
          redeemed_at: new Date().toISOString()
        })
        .eq('id', voucherId)
        .eq('status', 'active')
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error al redimir voucher en Supabase:', error);
      throw error;
    }
  }

  /**
   * Obtener vouchers del día
   */
  async getTodayVouchers() {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await this.supabase
        .from('vouchers')
        .select(`
          *,
          issued_by:users!issued_by_user_id(full_name),
          station:stations!issued_at_station_id(station_name)
        `)
        .gte('issued_at', today.toISOString())
        .order('issued_at', { ascending: false });

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error al obtener vouchers del día:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas por estación
   */
  async getStationStats(stationId = null) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = this.supabase
        .from('vouchers')
        .select('issued_at_station_id, currency, amount, status')
        .gte('issued_at', today.toISOString());

      if (stationId) {
        query = query.eq('issued_at_station_id', stationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Procesar estadísticas
      const stats = {};
      
      data.forEach(voucher => {
        const stId = voucher.issued_at_station_id;
        if (!stats[stId]) {
          stats[stId] = {
            total_vouchers: 0,
            total_usd: 0,
            total_dop: 0,
            active_vouchers: 0,
            redeemed_vouchers: 0
          };
        }

        stats[stId].total_vouchers++;
        
        if (voucher.currency === 'USD') {
          stats[stId].total_usd += voucher.amount;
        } else {
          stats[stId].total_dop += voucher.amount;
        }

        if (voucher.status === 'active') {
          stats[stId].active_vouchers++;
        } else if (voucher.status === 'redeemed') {
          stats[stId].redeemed_vouchers++;
        }
      });

      return stats;

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE USUARIOS
  // ============================================

  /**
   * Login de usuario
   */
  async loginUser(email, password) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Actualizar último login
      await this.supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      return data;

    } catch (error) {
      console.error('Error al hacer login:', error);
      throw error;
    }
  }

  /**
   * Crear usuario
   */
  async createUser(userData) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert({
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          station_id: userData.station_id || null,
          pin_code: userData.pin_code || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE SINCRONIZACIÓN
  // ============================================

  /**
   * Sincronizar cambios locales a Supabase
   */
  async syncToSupabase(pendingChanges) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    const results = {
      success: [],
      failed: []
    };

    for (const change of pendingChanges) {
      try {
        switch (change.operation) {
          case 'CREATE_VOUCHER':
            await this.createVoucher(change.data);
            results.success.push(change.id);
            break;

          case 'REDEEM_VOUCHER':
            await this.redeemVoucher(
              change.data.voucher_id,
              change.data.user_id,
              change.data.station_id
            );
            results.success.push(change.id);
            break;

          default:
            console.warn('Operación desconocida:', change.operation);
        }

      } catch (error) {
        console.error(`Error al sincronizar cambio ${change.id}:`, error);
        results.failed.push({
          id: change.id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Obtener cambios desde Supabase
   */
  async syncFromSupabase(lastSyncTime) {
    if (!this.isConnected) {
      throw new Error('No hay conexión a Supabase');
    }

    try {
      const { data, error } = await this.supabase
        .from('vouchers')
        .select('*')
        .gte('updated_at', lastSyncTime)
        .order('updated_at', { ascending: true });

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error al obtener cambios de Supabase:', error);
      throw error;
    }
  }

  // ============================================
  // UTILIDADES
  // ============================================

  /**
   * Cerrar conexión
   */
  async close() {
    this.stopConnectionMonitor();
    this.isConnected = false;
    console.log('🔌 Cliente Supabase cerrado');
  }
}

// Singleton
let supabaseManager = null;

function getSupabaseManager() {
  if (!supabaseManager) {
    supabaseManager = new SupabaseManager();
  }
  return supabaseManager;
}

module.exports = {
  getSupabaseManager,
  SupabaseManager
};
