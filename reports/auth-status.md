# Informe de Autenticación – Estado Actual y Checklist

Fecha: 2025-10-24
Ruta del proyecto: `c:\appCasino`

## Resumen Ejecutivo
- Autenticación local (SQLite) implementada y operativa dentro de Electron.
- Hash de contraseñas: `PBKDF2 (sha512, 100000 iteraciones)` con `salt` por usuario.
- Tabla `usuarios` local: `id, username, password_hash, password_salt, role, activo, creado`.
- Validación local: derivación PBKDF2 con el `password_salt` y comparación del hash.
- Supabase: uso de tabla pública `usuarios` (no `auth.users`), cliente creado con `SERVICE_ROLE` o `ANON` y sin RLS explícito en código.
- Problema conocido: scripts Node fuera de Electron fallan por incompatibilidad binaria de `better-sqlite3`.

## Respuestas – Información Necesaria

### SQLite (Local)
- Método de hash: `crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512')`.
- Campos en `usuarios`:
  - Sí: `id`, `username`, `password_hash`, `password_salt`, `role`, `activo`, `creado`.
  - No: `email`, `metadata`, `last_login`.
- Validación de credenciales: se obtiene el usuario por `username`, se deriva el hash con el `password_salt` y se compara igualdad.
- Errores de login posibles:
  - `Usuario inexistente o inactivo`.
  - `Contraseña incorrecta`.
  - En el handler de Electron: `Usuario y contraseña requeridos` si faltan datos.

### Supabase
- RLS habilitado: no se observa en el código; el cliente usa `SERVICE_ROLE` o `ANON` (si `SERVICE_ROLE` se usa, RLS se ignora).
- Usuarios: creados/consultados en tabla pública `usuarios`, no en `auth.users`.
- Políticas para rol admin: no se ven definidas en el repo; se recomienda implementarlas sobre `profiles` según el plan propuesto.

## Checklist de Verificación

### SQLite
- Tabla `usuarios` con campos mínimos: ✅ (faltan `email`, `metadata`, `last_login` si se requieren)
- Usuario admin de demo: ⚠️ `ensureDemoAdminUser()` crea `admin@local/admin1234` si no hay usuarios; crear uno propio recomendado.
- Contraseña hasheada (no texto plano): ✅ PBKDF2.
- Login con credenciales correctas: ✅ dentro de Electron (`window.api.loginApp`).
- Login falla con credenciales incorrectas: ✅ mensajes gestionados.
- Campo `activo=1` para admin: ✅ si se crea activo.

### Supabase
- Usuario en `auth.users`: ❌ actual implementación no usa `auth.users`.
- Perfil en `public.profiles`: ❌ no existe en el repositorio.
- RLS en `profiles`: ❌ no configurado.
- Política admin: ❌ pendiente.
- Login remoto con sesión: ⚠️ se usa cliente de datos; no gestiona sesión de `auth`.
- Metadata con rol: ❌ no aplica en el flujo actual.

## Recomendaciones de Alineación a la Guía

### Opción A – Mantener SQLite (más simple)
- Añadir campos opcionales a `usuarios`: `email`, `last_login`, `metadata` (JSON).
- Registrar `last_login` al validar credenciales.
- Mantener PBKDF2 (robusto). Bcrypt es opcional si se desea.

### Opción B – Supabase con `auth.users` + `profiles` y RLS
- Crear tabla `public.profiles` y activar RLS, con políticas:
  - Admin: acceso completo.
  - Usuarios: acceso propio.
- Trigger para crear `profiles` al alta en `auth.users`.
- Mover el flujo de login a `supabase.auth.signInWithPassword` y leer el rol desde `profiles`.

## Plan de Acción
1) Crear usuario ADMIN local confiable desde Electron:
   - En la consola de la app Electron: 
     - `await window.api.createUser({ username: 'admin@casino', password: 'Admin2024!', role: 'ADMIN', activo: 1 })`
     - `await window.api.loginApp('admin@casino', 'Admin2024!')`
   - Nota: si `USE_SUPABASE=false` en `.env`, el login usa SQLite local.
2) Asegurar el guard de sesión en `panel.html` (ya añadido) y acceso por rol.
3) Si se opta por Supabase:
   - Implementar `profiles` + RLS + policies (ver Sección Supabase de la guía).
   - Migrar creación de usuarios a `auth.signUp` con `raw_user_meta_data` y trigger.

## Troubleshooting
- "Usuario creado pero no puedo hacer login": verificar que el hash/compare usan el mismo método (PBKDF2 en ambos).
- "Supabase invalid login credentials": revisar confirmación de email en `auth.users` y políticas RLS.
- "Role es null": asegurar que `raw_user_meta_data` incluye `role` y el trigger actualiza `profiles`.

## Fuentes del Código
- Tabla y CRUD `usuarios`: `c:\appCasino\Caja\database.js` (métodos: `hashPassword`, `createUser`, `authenticateUserLocal`).
- Handlers de auth (Electron): `c:\appCasino\Electron_Puro\authHandlers.js`.
- Supabase cliente: `c:\appCasino\supabaseClient.js`.

## Estado de Servidores
- Panel: `http://localhost:5512/panel.html`.
- Vista previa PDF: `http://localhost:8088/`.
- Electron modo puro: `npm run start:pure`.
