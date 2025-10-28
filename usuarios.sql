[dotenv@17.2.3] injecting env (10) from .env -- tip: ⚙️  suppress all logs with { quiet: true }
🔧 Generando SQL para usuarios de Supabase...

🔗 Conectando a Supabase...
✅ 7 usuarios encontrados

-- ============================================
-- SQL PARA SINCRONIZAR USUARIOS DE SUPABASE
-- Copiar y ejecutar en SQLite
-- ============================================

-- Limpiar usuarios anteriores (excepto admin@local)
DELETE FROM usuarios WHERE username != 'admin@local';

-- Insertar usuarios de Supabase
INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  'admin@casinosusua.com',
  '728239fae2face9eba38a4a8f7e753f1fc9409ce899472219d5ceb2bb3815d809ff8891b566bbee4180c8d7f4f43ae630bbe16d3ea0df0c78e159ac47857bdeb',
  'e3087003ceabc82aed83d14ed2c5930126442ef413247578f280f07aa6411e8e',
  'admin@casinosusua.com',
  'ADMIN',
  1,
  '{"supabase_id":"22bafddb-b16a-44ff-a007-2138ded32793","full_name":"Administrador Principal","station_id":null}'
);
INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  'caja@casinosusua.com',
  'd6b6e3c41b1a91acd7a1de201e34fabb337347d99b9c5afe6b231cac23af8392597748809a4dc27afc8434ec9a445619226f14fbd3ae8b5418c35732bb802737',
  'aadcfd5c6df0c63cb0e3b39e3a73b75a1b6991fcaeedcce9e09639155bdfd0ab',
  'caja@casinosusua.com',
  'CAJA',
  1,
  '{"supabase_id":"8bb72d4e-15f8-4fdb-9466-0df23d34288f","full_name":"Cajero Principal","station_id":5}'
);
INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  'mesa1@casinosusua.com',
  '1088efbfb6afc05e84a2bb61accad49c73186f107edb31240119f7070bc2996a8c2ca3e504d256748737824cadbcbfdafe4aedd7d24a492439a6ef86589e46ad',
  'e954eb18d6436bcdb7b02158bc98bb915b0860178b24f21cd871c650016b7e98',
  'mesa1@casinosusua.com',
  'MESA',
  1,
  '{"supabase_id":"85397c30-3856-4d82-a4bb-06791b8cacd0","full_name":"Operador Mesa 1","station_id":1}'
);
INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  'mesa2@casinosusua.com',
  '98407ec60ee5d55e0cc1edd0443a4f7614df882342d765daf68a9af897b0dae7f0c3fd6f6f94961efacf6ca4036f1fa5d927bb6b692904294e9ade91f5dc7050',
  'ea649d3e137ca579ad202e3a628dfc94ad15d4c5b44a4b65e68e18386cad817f',
  'mesa2@casinosusua.com',
  'MESA',
  1,
  '{"supabase_id":"acadebbf-f401-4f67-8f4a-a5d5efecf2c6","full_name":"Operador Mesa 2","station_id":2}'
);
INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  'mesa3@casinosusua.com',
  '4d9d41c8cd2fa96260c19c475cce8f9d36cdcf9a2de3b0aea8df5e1054c63642ad058bd94bc310b8bd7c08f1f1b2840024056a772dd85ab141d36224f529da7e',
  '6a57fea61e88060a9b0047e1165259759349a80e49e3352f297353eb2ccc7eca',
  'mesa3@casinosusua.com',
  'MESA',
  1,
  '{"supabase_id":"14ec166d-dce3-4c65-be4f-9023df332ed2","full_name":"Operador Mesa 3","station_id":3}'
);
INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  'mesa4@casinosusua.com',
  'dbc6cb1cb6bcb7a5d82bf4bd290e7f020baca3c02f20bd7f335ecc8ec5144aa4b2589168696875306c67bfeb5b4e9d1c9557f77a5797aebd9bbd6209875bc676',
  'da481e68e17fc8903d1769900d6fda3a8df60d8028f68a71066c46283e461242',
  'mesa4@casinosusua.com',
  'MESA',
  1,
  '{"supabase_id":"babee96b-93bf-408a-9c0a-b9c662673e2d","full_name":"Operador Mesa 4","station_id":4}'
);
INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  'auditor@casinosusua.com',
  '0f4e60afb3f6d9393c907911fa4581b6c075089a115365c07d0d6773f6afbaf424cffae052843a0487ae26588c9e18601d72794b49b52b358cc412766bfe508d',
  '71a96950761467fe3130b6ab0f7f5eaf878828028e6fae97a5e17b9846d1496b',
  'auditor@casinosusua.com',
  'AUDITOR',
  1,
  '{"supabase_id":"9bfdf5c2-9c7e-4b1b-a815-3785cf278ca9","full_name":"Auditor Principal","station_id":null}'
);

-- Verificar
SELECT username, role FROM usuarios ORDER BY role;

-- ============================================
-- CREDENCIALES DE LOGIN:
-- ============================================
-- admin@casinosusua.com / 1234
-- caja@casinosusua.com / 5555
-- mesa1@casinosusua.com / 1111
-- mesa2@casinosusua.com / 2222
-- mesa3@casinosusua.com / 3333
-- mesa4@casinosusua.com / 4444
-- auditor@casinosusua.com / 9999
