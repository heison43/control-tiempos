import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  console.log('[NOTIFY ADMIN] Firebase retirado. Evento registrado sin push:', body?.requestId || body?.trackingCode || 'sin-id');
  return NextResponse.json({ ok: true, sent: 0, provider: 'postgresql-no-push' });
}
