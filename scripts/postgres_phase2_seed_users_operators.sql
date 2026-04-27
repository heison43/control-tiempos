-- =========================================
-- GESTION DE EQUIPOS - DATOS INICIALES
-- Admin principal y operadores base
-- =========================================

INSERT INTO users (id, email, name, role, is_active, created_at, updated_at)
VALUES (
  'heison.yepes.ext@continentalgold.com',
  'heison.yepes.ext@continentalgold.com',
  'Heison Yepes Pino',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO admins (email, is_active, role, created_at, updated_at)
VALUES (
  'heison.yepes.ext@continentalgold.com',
  true,
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET
  is_active = EXCLUDED.is_active,
  role = EXCLUDED.role,
  updated_at = NOW();

INSERT INTO operators (id, code, name, auth_email, is_active, created_at, updated_at)
VALUES
  ('OP001', 'OP001', 'YORMAN DAVID ARANGO MUÑOZ', 'yorman.arango@continentalgold.com', true, NOW(), NOW()),
  ('OP002', 'OP002', 'JOSE AYCARDO ARGAEZ', 'jose.argaez@continentalgold.com', true, NOW(), NOW()),
  ('OP003', 'OP003', 'VICTOR MANUEL QUIROZ DURANGO', 'victor.quiroz@continentalgold.com', true, NOW(), NOW()),
  ('OP004', 'OP004', 'DANIEL HIGUITA GEORGE', 'daniel.higuita@continentalgold.com', true, NOW(), NOW()),
  ('OP005', 'OP005', 'JHONATHAN CARVAJAL LOPEZ', 'jhonathan.carvajal@continentalgold.com', true, NOW(), NOW()),
  ('OP006', 'OP006', 'ANDRES CAMILO CAMPO DAVID', 'andres.campo@continentalgold.com', true, NOW(), NOW()),
  ('OP007', 'OP007', 'VICTOR MANUEL MORA MESA', 'victor.mora@continentalgold.com', true, NOW(), NOW()),
  ('OP008', 'OP008', 'ANDRES MAURICIO TUBERQUIA', 'andres.tuberquia@continentalgold.com', true, NOW(), NOW())
ON CONFLICT (auth_email) DO UPDATE
SET
  id = EXCLUDED.id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
