import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth';
import { adminAuth } from '../../../../lib/firebaseAdmin';
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

async function ensureFirebaseUser(email, displayName) {
  if (!adminAuth) return;

  try {
    let existing = null;

    try {
      existing = await adminAuth.getUserByEmail(email);
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    if (!existing) {
      await adminAuth.createUser({
        uid: email,
        email,
        emailVerified: true,
        displayName: displayName || undefined,
      });
      console.log('[resolve-user] Firebase Auth user creado:', email);
      return;
    }

    const updates = {};

    if (displayName && existing.displayName !== displayName) {
      updates.displayName = displayName;
    }

    if (existing.email !== email) {
      updates.email = email;
    }

    if (existing.emailVerified !== true) {
      updates.emailVerified = true;
    }

    if (Object.keys(updates).length > 0) {
      await adminAuth.updateUser(existing.uid, updates);
      console.log('[resolve-user] Firebase Auth user actualizado:', email);
    } else {
      console.log('[resolve-user] Firebase Auth user ya existía:', email);
    }
  } catch (error) {
    console.error('[resolve-user] Error en ensureFirebaseUser:', error);
    throw error;
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, reason: 'NO_SESSION' }, { status: 401 });
    }

    if (!adminAuth) {
      return NextResponse.json(
        { ok: false, reason: 'FIREBASE_ADMIN_NOT_READY' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const normalizedEmail = normalizeEmail(body?.email || session.user.email);
    const displayName = body?.name || session.user.name || normalizedEmail;

    console.log('[resolve-user] normalizedEmail:', normalizedEmail);

    if (!normalizedEmail) {
      return NextResponse.json({ ok: false, reason: 'NO_EMAIL' }, { status: 400 });
    }

    // 1) Admin
    const adminData = await findAdminByEmail(normalizedEmail);
    console.log('[resolve-user] adminData:', adminData);

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

      await ensureFirebaseUser(normalizedEmail, displayName);

      const firebaseCustomToken = await adminAuth.createCustomToken(normalizedEmail, {
        app_email: normalizedEmail,
        app_role: role,
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
        firebaseCustomToken,
      });
    }

    // 2) Existing user
    const userData = await findUserByEmail(normalizedEmail);
    console.log('[resolve-user] userData:', userData);

    if (userData) {
      if (userData.is_active === false || !userData.role) {
        return NextResponse.json(
          {
            ok: false,
            reason: 'USER_INACTIVE_OR_NO_ROLE',
            meta: userData,
          },
          { status: 403 }
        );
      }

      await ensureFirebaseUser(normalizedEmail, userData.name || displayName);

      const firebaseCustomToken = await adminAuth.createCustomToken(normalizedEmail, {
        app_email: normalizedEmail,
        app_role: userData.role,
        operatorId: userData.operator_id || null,
      });

      return NextResponse.json({
        ok: true,
        role: userData.role,
        meta: userData,
        firebaseCustomToken,
      });
    }

    // 3) Operator by corporate email
    const operatorData = await findOperatorByAuthEmail(normalizedEmail);
    console.log('[resolve-user] operatorData:', operatorData);

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

      await ensureFirebaseUser(normalizedEmail, operatorData.name || displayName);

      const firebaseCustomToken = await adminAuth.createCustomToken(normalizedEmail, {
        app_email: normalizedEmail,
        app_role: 'operator',
        operatorId: operatorData.id,
      });

      return NextResponse.json({
        ok: true,
        role: 'operator',
        meta: {
          ...operatorData,
          operatorId: operatorData.id,
          email: normalizedEmail,
          isActive: true,
          role: 'operator',
        },
        firebaseCustomToken,
      });
    }

    return NextResponse.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  } catch (error) {
    console.error('[resolve-user] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        reason: 'INTERNAL_ERROR',
        message: error?.message || 'Unexpected error',
      },
      { status: 500 }
    );
  }
}