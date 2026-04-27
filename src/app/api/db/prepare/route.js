import { NextResponse } from 'next/server';
import { ensurePostgresSchema } from '../../../../lib/ensurePostgresSchema';

export async function GET() {
  try {
    await ensurePostgresSchema();
    return NextResponse.json({
      ok: true,
      message: 'Esquema PostgreSQL preparado correctamente',
    });
  } catch (error) {
    console.error('[db/prepare] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'No se pudo preparar el esquema PostgreSQL',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
