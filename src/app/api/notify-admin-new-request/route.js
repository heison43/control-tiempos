// src/app/api/notify-admin-new-request/route.js
import { NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '../../../lib/firebaseAdmin';

// Aseguramos que sea función Node (necesario para firebase-admin)
export const runtime = 'nodejs';

// Esta API recibe en el body:
// {
//   requestId: string,
//   requesterName: string,
//   activity: string,
//   location: string
// }
export async function POST(request) {
  try {
    // 🛡️ Si no hay Firebase Admin (sin credenciales), salimos sin romper nada
    if (!adminDb || !adminMessaging) {
      console.warn(
        '[PUSH ADMIN] Firebase Admin no está configurado; no se enviarán notificaciones push.'
      );
      return NextResponse.json(
        { ok: false, reason: 'admin-not-configured' },
        { status: 200 } // 200 para que el frontend no lo trate como error
      );
    }

    const body = await request.json();
    const {
      requestId,
      requesterName = 'Solicitante desconocido',
      activity = 'una actividad',
      location = 'sin lugar especificado',
    } = body || {};

    if (!requestId) {
      return NextResponse.json(
        { ok: false, error: 'Falta requestId' },
        { status: 400 }
      );
    }

    // 1️⃣ Obtener todos los tokens de adminPushTokens
    const snapshot = await adminDb.collection('adminPushTokens').get();

    if (snapshot.empty) {
      console.log('[PUSH ADMIN] No hay tokens registrados');
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const tokens = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data?.token) tokens.push(data.token);
    });

    if (tokens.length === 0) {
      console.log('[PUSH ADMIN] Tokens vacíos');
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // 2️⃣ Construir mensaje FCM
    const title = 'Nueva solicitud de asignación';
    const bodyText = `${requesterName} solicitó equipo para ${activity}`;

    const message = {
      tokens,
      notification: {
        title,
        body: bodyText,
      },
      data: {
        type: 'NEW_ASSIGNMENT_REQUEST',
        requestId,
        requesterName,
        activity,
        location,
      },
      webpush: {
        fcmOptions: {
          link: '/admin', // al tocar la notificación abre el panel admin
        },
      },
    };

    const response = await adminMessaging.sendEachForMulticast(message);

    console.log('[PUSH ADMIN] Resultado:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    return NextResponse.json({
      ok: true,
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (err) {
    console.error('[PUSH ADMIN] Error en API:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Error interno' },
      { status: 500 }
    );
  }
}
