import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      message: 'Conexión PostgreSQL OK',
    });
  } catch (error) {
    console.error('[db/health] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'No se pudo conectar a PostgreSQL',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}