import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth';
import { prisma } from '../../../../lib/prisma';

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json(
        { ok: false, message: 'No hay sesión activa.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    if (body.id) {
      await prisma.notifications.updateMany({
        where: {
          id: body.id,
        },
        data: {
          is_read: true,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.notifications.updateMany({
        where: {
          OR: [
            { user_email: email },
            { role: 'admin' },
            { role: 'operator' },
          ],
          is_read: false,
        },
        data: {
          is_read: true,
          updated_at: new Date(),
        },
      });
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error('[notifications][mark-read]', error);

    return NextResponse.json(
      {
        ok: false,
        message: 'Error marcando notificaciones.',
        error: error?.message || 'Error inesperado',
      },
      { status: 500 }
    );
  }
}