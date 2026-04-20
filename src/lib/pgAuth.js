import { prisma } from './prisma';

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

export async function findAdminByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  return prisma.admins.findUnique({
    where: { email: normalizedEmail },
  });
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  return prisma.users.findUnique({
    where: { email: normalizedEmail },
  });
}

export async function findOperatorByAuthEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  return prisma.operators.findFirst({
    where: { auth_email: normalizedEmail },
  });
}

export async function upsertUserFromAdmin({ email, name, role = 'admin' }) {
  const normalizedEmail = normalizeEmail(email);

  return prisma.users.upsert({
    where: { email: normalizedEmail },
    update: {
      name,
      role,
      is_active: true,
      updated_at: new Date(),
    },
    create: {
      id: normalizedEmail,
      email: normalizedEmail,
      name,
      role,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}

export async function upsertUserFromOperator({ email, name, operatorId }) {
  const normalizedEmail = normalizeEmail(email);

  return prisma.users.upsert({
    where: { email: normalizedEmail },
    update: {
      name,
      role: 'operator',
      operator_id: operatorId,
      is_active: true,
      updated_at: new Date(),
    },
    create: {
      id: normalizedEmail,
      email: normalizedEmail,
      name,
      role: 'operator',
      operator_id: operatorId,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}