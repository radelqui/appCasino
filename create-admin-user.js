// create-admin-user.js - Script para crear usuario administrador completo
require('dotenv').config();
const path = require('path');
const CasinoDatabase = require('./Caja/database.js');
const { createUserSupabase } = require('./supabaseClient.js');

async function createAdminUser() {
    console.log('🔧 Creando usuario administrador completo...\n');
    
    // Configuración del usuario administrador
    const adminUser = {
        username: 'admin@casino',
        password: 'Admin2024!',
        role: 'ADMIN',
        activo: 1
    };
    
    let db = null;
    
    try {
        // 1. Crear en SQLite local (usar misma ruta que la app)
        const dbPath = process.env.CASINO_DB_PATH || path.join(__dirname, 'Caja', 'data', 'casino.db');
        console.log(`📊 Creando usuario en SQLite local (db: ${dbPath})...`);
        db = new CasinoDatabase(dbPath);
        
        // Verificar si ya existe
        const existingUser = db.getUserByUsername(adminUser.username);
        if (existingUser) {
            console.log(`⚠️  Usuario ${adminUser.username} ya existe en SQLite`);
        } else {
            const result = db.createUser(
                adminUser.username, 
                adminUser.password, 
                adminUser.role, 
                adminUser.activo
            );
            
            if (result.success) {
                console.log(`✅ Usuario ${adminUser.username} creado en SQLite`);
                
                // Agregar log de auditoría
                db.addAuditLog(
                    'user_create',
                    null,
                    'SYSTEM',
                    `Usuario administrador ${adminUser.username} creado`,
                    JSON.stringify({ role: adminUser.role, activo: adminUser.activo })
                );
            } else {
                console.error('❌ Error creando usuario en SQLite:', result.error);
            }
        }
        
        // 2. Crear en Supabase (si está configurado)
        const useSupabase = String(process.env.USE_SUPABASE || '').toLowerCase() === 'true';
        
        if (useSupabase) {
            console.log('\n☁️  Creando usuario en Supabase...');
            try {
                const supabaseResult = await createUserSupabase(
                    adminUser.username,
                    adminUser.password,
                    adminUser.role,
                    adminUser.activo
                );
                
                if (supabaseResult.success) {
                    console.log(`✅ Usuario ${adminUser.username} creado en Supabase`);
                }
            } catch (supabaseError) {
                if (supabaseError.message?.includes('duplicate key')) {
                    console.log(`⚠️  Usuario ${adminUser.username} ya existe en Supabase`);
                } else {
                    console.error('❌ Error creando usuario en Supabase:', supabaseError.message);
                }
            }
        } else {
            console.log('⚠️  Supabase deshabilitado (USE_SUPABASE=false)');
        }
        
        // 3. Mostrar información del usuario creado
        console.log('\n📋 INFORMACIÓN DEL USUARIO ADMINISTRADOR:');
        console.log('==========================================');
        console.log(`👤 Usuario: ${adminUser.username}`);
        console.log(`🔑 Contraseña: ${adminUser.password}`);
        console.log(`🛡️  Rol: ${adminUser.role}`);
        console.log(`📊 Estado: ${adminUser.activo ? 'Activo' : 'Inactivo'}`);
        console.log('\n🎯 PERMISOS COMPLETOS:');
        console.log('• ✅ Auditoría - Acceso completo a logs y reportes');
        console.log('• ✅ Caja - Configuración de parámetros de caja');
        console.log('• ✅ Mesa - Configuración de mesas y operadores');
        console.log('• ✅ Usuarios - Gestión completa de usuarios');
        console.log('• ✅ Sistema - Configuración general del sistema');
        
        console.log('\n🚀 Usuario administrador listo para usar!');
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    createAdminUser().catch(console.error);
}

module.exports = { createAdminUser };