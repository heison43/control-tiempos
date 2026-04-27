import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth';
import { ensurePostgresSchema } from '../../../../lib/ensurePostgresSchema';
import {
  findAdminByEmail,
  findOperatorByAuthEmail,
  findUserByEmail,
  upsertUserFromAdmin,
  upsertUserFromOperator,
} from '../../../../lib/pgAuth';

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

export async function POST(req) {
  try {
    await ensurePostgresSchema();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, reason: 'NO_SESSION' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const normalizedEmail = normalizeEmail(body?.email || session.user.email);
    const displayName = body?.name || session.user.name || normalizedEmail;

    if (!normalizedEmail) {
      return NextResponse.json({ ok: false, reason: 'NO_EMAIL' }, { status: 400 });
    }

    const adminData = await findAdminByEmail(normalizedEmail);

    if (adminData) {
      if (adminData.is_active === false) {
        return NextResponse.json({ ok: false, reason: 'ADMIN_INACTIVE' }, { status: 403 });
      }

      const role = adminData.role || 'admin';

      await upsertUserFromAdmin({
        email: normalizedEmail,
        name: displayName,
        role,
      });

      return NextResponse.json({
        ok: true,
        role,
        meta: {
          email: normalizedEmail,
          isActive: true,
          role,
          name: displayName,
        },
      });
    }

    const userData = await findUserByEmail(normalizedEmail);

    if (userData) {
      if (userData.is_active === false || !userData.role) {
        return NextResponse.json(
          { ok: false, reason: 'USER_INACTIVE_OR_NO_ROLE', meta: userData },
          { status: 403 }
        );
      }

      return NextResponse.json({
        ok: true,
        role: userData.role,
        meta: {
          ...userData,
          isActive: userData.is_active,
          operatorId: userData.operator_id,
        },
      });
    }

    const operatorData = await findOperatorByAuthEmail(normalizedEmail);

    if (operatorData) {
      if (operatorData.is_active === false) {
        return NextResponse.json(
          { ok: false, reason: 'OPERATOR_INACTIVE', meta: operatorData },
          { status: 403 }
        );
      }

      await upsertUserFromOperator({
        email: normalizedEmail,
        name: operatorData.name || displayName,
        operatorId: operatorData.id,
      });

      return NextResponse.json({
        ok: true,
        role: 'operator',
        meta: {
          ...operatorData,
          operatorId: operatorData.id,
          operatorName: operatorData.name,
          operatorCode: operatorData.code,
          email: normalizedEmail,
          isActive: true,
          role: 'operator',
        },
      });
    }

    return NextResponse.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  } catch (error) {
    console.error('[resolve-user] Error:', error);
    return NextResponse.json(
      { ok: false, reason: 'INTERNAL_ERROR', message: error?.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
