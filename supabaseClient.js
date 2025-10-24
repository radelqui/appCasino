// supabaseClient.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

let client = null;

function getSupabaseClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase no configurado: faltan SUPABASE_URL y/o clave');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

async function loginOperatorSupabase(codigo, pin) {
  const supabase = getSupabaseClient();
  // Nota: idealmente el PIN debe estar hasheado y verificado vía RPC en el server
  const { data, error } = await supabase
    .from('operadores')
    .select('id,codigo,nombre,mesa_asignada,activo')
    .eq('codigo', String(codigo).trim())
    .eq('pin', String(pin).trim())
    .eq('activo', true)
    .single();

  if (error || !data) {
    return { success: false, error: 'Credenciales inválidas o usuario inactivo' };
  }

  // Intentar registrar auditoría (no crítico)
  try {
    await supabase.from('audit_logs').insert({
      tipo_evento: 'login_caja',
      usuario_id: data.codigo,
      descripcion: 'Login de operador en Caja',
      datos_adicionales: null
    });
  } catch (_) {}

  return { success: true, operator: data };
}

async function loginUserSupabase(username, password) {
  const supabase = getSupabaseClient();
  const { data: users, error } = await supabase
    .from('usuarios')
    .select('id, username, password_hash, password_salt, role, activo')
    .eq('username', String(username).trim())
    .limit(1);
  if (error) throw error;
  const user = users && users.length ? users[0] : null;
  if (!user || !user.activo) {
    return { success: false, error: 'Usuario inexistente o inactivo' };
  }
  const derived = crypto.pbkdf2Sync(String(password), user.password_salt, 100000, 64, 'sha512').toString('hex');
  if (derived !== user.password_hash) {
    return { success: false, error: 'Contraseña incorrecta' };
  }
  try {
    await supabase.from('audit_logs').insert({
      event_type: 'login_app',
      details: 'Login general en app',
      username: user.username,
      created_at: new Date().toISOString(),
    });
  } catch (e) {}
  return { success: true, user: { id: user.id, username: user.username, role: user.role } };
}

// --- Crear usuario en Supabase (con hash PBKDF2) ---
async function createUserSupabase(username, password, role = 'MESA', activo = true) {
  const supabase = getSupabaseClient();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  const payload = {
    username: String(username).trim(),
    password_hash: hash,
    password_salt: salt,
    role: String(role).toUpperCase(),
    activo: !!activo,
    creado: new Date().toISOString(),
  };
  const { error } = await supabase.from('usuarios').insert(payload);
  if (error) throw error;
  try {
    await supabase.from('audit_logs').insert({
      event_type: 'user_create',
      details: `Alta de usuario ${payload.username}`,
      username: payload.username,
      created_at: new Date().toISOString(),
    });
  } catch (e) {}
  return { success: true };
}

module.exports = { getSupabaseClient, loginOperatorSupabase, loginUserSupabase, createUserSupabase };