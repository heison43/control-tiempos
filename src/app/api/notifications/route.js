import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth';
import { prisma } from '../../../lib/prisma';

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

async function resolveUserRole(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return null;

  const admin = await prisma.admins.findUnique({
    where: { email: normalizedEmail },
  });

  if (admin?.is_active) {
    return admin.role || 'admin';
  }

  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
  });

  if (user?.is_active && user.role) {
    return user.role;
  }

  return null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json(
        { ok: false, message: 'No hay sesión activa.' },
        { status: 401 }
      );
    }

    const role = await resolveUserRole(email);

    const notifications = await prisma.notifications.findMany({
      where: {
        OR: [
          { user_email: email },
          role ? { role } : undefined,
          role === 'admin' || role === 'superAdmin' ? { role: 'admin' } : undefined,
        ].filter(Boolean),
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 30,
    });

    const unreadCount = notifications.filter((item) => !item.is_read).length;

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('[notifications][GET]', error);

    return NextResponse.json(
      {
        ok: false,
        message: 'Error consultando notificaciones.',
        error: error?.message || 'Error inesperado',
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const notification = await prisma.notifications.create({
      data: {
        id: body.id || `NOT-${crypto.randomUUID()}`,
        user_email: normalizeEmail(body.user_email || body.userEmail),
        role: body.role || null,
        title: body.title,
        message: body.message,
        type: body.type || null,
        related_id: body.related_id || body.relatedId || null,
        related_module: body.related_module || body.relatedModule || null,
        is_read: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      notification,
    });
  } catch (error) {
    console.error('[notifications][POST]', error);

    return NextResponse.json(
      {
        ok: false,
        message: 'Error creando notificación.',
        error: error?.message || 'Error inesperado',
      },
      { status: 500 }
    );
  }
}