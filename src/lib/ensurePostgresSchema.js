import { prisma } from './prisma';

let schemaReadyPromise = null;

/**
 * Prepara ajustes mínimos de PostgreSQL requeridos por la migración.
 * Esto evita que la app falle si la base fue creada con el script inicial
 * y todavía no tiene las columnas JSONB de compatibilidad.
 *
 * En producción se puede desactivar con:
 * POSTGRES_AUTO_PREPARE_SCHEMA=false
 */
export async function ensurePostgresSchema() {
  if (process.env.POSTGRES_AUTO_PREPARE_SCHEMA === 'false') {
    return;
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = prepareSchema();
  }

  return schemaReadyPromise;
}

async function prepareSchema() {
  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE admins ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE operators ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE assignment_requests ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE weekly_assignments ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE equipment_loans ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `CREATE TABLE IF NOT EXISTS admin_push_tokens (
      id TEXT PRIMARY KEY,
      token TEXT,
      email TEXT,
      user_id TEXT,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_admin_push_tokens_email ON admin_push_tokens(email)`,
    `CREATE TABLE IF NOT EXISTS operator_push_tokens (
      id TEXT PRIMARY KEY,
      token TEXT,
      operator_id TEXT,
      email TEXT,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_operator_push_tokens_operator_id ON operator_push_tokens(operator_id)`,
    `CREATE INDEX IF NOT EXISTS idx_operator_push_tokens_email ON operator_push_tokens(email)`,
    `CREATE TABLE IF NOT EXISTS portal_users (
      id TEXT PRIMARY KEY,
      email TEXT,
      user_id TEXT,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email)`,
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('[postgres] Esquema preparado para migración');
}
