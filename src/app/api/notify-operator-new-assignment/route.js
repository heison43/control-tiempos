// src/app/api/notify-operator-new-assignment/route.js
import { NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '../../../lib/firebaseAdmin';

// Body esperado:
// {
//   assignmentId: string,
//   operatorUid?: string,   // o el identificador que uses para el operador
//   operatorName?: string,
//   activity?: string,
//   location?: string
// }
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      assignmentId,
      operatorUid,
      operatorName = 'Operador',
      activity = 'una actividad',
      location = 'sin lugar especificado',
    } = body || {};

    if (!assignmentId) {
      return NextResponse.json(
        { ok: false, error: 'Falta assignmentId' },
        { status: 400 }
      );
    }

    // 1️⃣ Buscar tokens del operador
    let snapshot;

    if (operatorUid) {
      // ⚠️ IMPORTANTE:
      // Asegúrate de que OperatorNotificationsManager guarde un campo "operatorUid"
      // con el mismo valor que usas al asignar el equipo.
      snapshot = await adminDb
        .collection('operatorPushTokens')
        .where('operatorUid', '==', operatorUid)
        .get();
    } else {
      // Fallback: todos los tokens de operadores (menos fino, pero funciona)
      snapshot = await adminDb.collection('operatorPushTokens').get();
    }

    if (snapshot.empty) {
      console.log('[PUSH OP] No hay tokens de operador registrados');
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const tokens = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data?.token) tokens.push(data.token);
    });

    if (tokens.length === 0) {
      console.log('[PUSH OP] Lista de tokens vacía');
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // 2️⃣ Mensaje de FCM
    const title = 'Nueva asignación de equipo';
    const bodyText = `${operatorName}, tienes una nueva asignación: ${activity}`;

    const message = {
      tokens,
      notification: {
        title,
        body: bodyText,
      },
      data: {
        type: 'NEW_ASSIGNMENT',
        assignmentId,
        operatorUid: operatorUid || '',
        operatorName,
        activity,
        location,
      },
      webpush: {
        fcmOptions: {
          // Cuando toquen la notificación en el celular / PWA,
          // puedes llevarlos a una ruta de operador
          link: '/operador',
        },
      },
    };

    const response = await adminMessaging.sendEachForMulticast(message);

    console.log('[PUSH OP] Resultado:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    return NextResponse.json({
      ok: true,
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (err) {
    console.error('[PUSH OP] Error en API:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Error interno' },
      { status: 500 }
    );
  }
}
