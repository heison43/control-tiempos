import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { Buffer } from 'buffer';
import { prisma } from '../../../lib/prisma';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO');
}

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status) {
  const map = { pending: 'pendiente', in_progress: 'en_progreso', paused: 'pausado', completed: 'finalizado' };
  return map[status] || status || '';
}

async function generateTodayCsv() {
  const { start, end } = getTodayRange();
  const assignments = await prisma.assignments.findMany({
    where: { created_at: { gte: start, lte: end } },
    orderBy: { created_at: 'asc' },
    include: { operator: true, equipment: true },
  });

  const rows = [[
    'Fecha', 'Operador', 'Equipo', 'Actividad', 'Lugar', 'Estado', 'Inicio', 'Fin', 'Duración', 'Notas'
  ]];

  assignments.forEach((a) => {
    const meta = a.metadata || {};
    rows.push([
      formatDate(a.created_at),
      a.operator?.name || a.operator_id || '',
      a.equipment?.name || a.equipment_id || '',
      a.activity || '',
      a.location || '',
      statusLabel(a.status),
      formatTime(a.start_time),
      formatTime(a.end_time),
      a.duration_minutes ?? '',
      Array.isArray(meta.evidences) ? meta.evidences.map((ev) => ev.content || '').join(' | ') : '',
    ]);
  });

  const csv = rows.map((row) => row.map(csvEscape).join(';')).join('\n');
  return { csv, count: assignments.length };
}

function getRecipients() {
  const raw = process.env.REPORT_EMAILS;
  if (!raw) return ['heisonyepes43@outlook.com'];
  return raw.split(',').map((e) => e.trim()).filter(Boolean);
}

async function sendDailyReport() {
  try {
    const now = new Date();
    const { csv, count } = await generateTodayCsv();
    const fileName = `asignaciones_${now.toISOString().slice(0, 10)}.csv`;
    const recipients = getRecipients();
    const fromEmail = process.env.RESEND_FROM || 'Reportes MiningSoft <yepes@yepesdevstudio.com>';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: `📊 Reporte Diario Automático - ${now.toLocaleDateString('es-CO')}`,
      html: `<h2>📊 Reporte Diario Automático</h2><p>Total de asignaciones del día: ${count}</p>`,
      attachments: [{ filename: fileName, content: Buffer.from(csv, 'utf-8'), contentType: 'text/csv' }],
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message || 'Error enviando correo diario' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Reporte diario enviado exitosamente', id: data.id, count });
  } catch (err) {
    console.error('Error en /api/sendReportDaily:', err);
    return NextResponse.json({ success: false, error: err.message || 'Error interno' }, { status: 500 });
  }
}

export async function GET() {
  return sendDailyReport();
}

export async function POST() {
  return sendDailyReport();
}
