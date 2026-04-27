import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma } from '../../../lib/prisma';

export const runtime = 'nodejs';

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER o EMAIL_PASS no están configurados');
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    requireTLS: true,
  });
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-CO');
}

function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status) {
  const map = {
    pending: 'pendiente',
    in_progress: 'en_progreso',
    paused: 'pausado',
    completed: 'finalizado',
  };
  return map[status] || status || '-';
}

export async function POST(request) {
  try {
    const { startDate, endDate, email } = await request.json();

    const where = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.created_at = { gte: start, lte: end };
    }

    const data = await prisma.assignments.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: { operator: true, equipment: true },
    });

    if (data.length === 0) {
      return NextResponse.json({ success: false, message: 'No hay asignaciones en el rango seleccionado' });
    }

    const header = ['Fecha', 'Operador', 'Equipo', 'Actividad', 'Lugar', 'Estado', 'Inicio', 'Fin', 'Duración'];
    const rows = data.map((a) => [
      formatDate(a.created_at),
      a.operator?.name || a.operator_id || '-',
      a.equipment?.name || a.equipment_id || '-',
      a.activity || '-',
      a.location || '-',
      statusLabel(a.status),
      formatTime(a.start_time),
      formatTime(a.end_time),
      a.duration_minutes ?? '-',
    ]);

    const csvContent = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const now = new Date();
    const fileName = `reporte_exportado_${now.toISOString().split('T')[0]}.csv`;

    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"Sistema de Gestión de Equipos" <${process.env.EMAIL_USER}>`,
      to: email || process.env.REPORT_EMAILS || 'heisonyepes43@outlook.com',
      subject: `📊 Reporte Exportado - ${now.toLocaleDateString('es-CO')}`,
      html: `<h2>📊 Reporte Exportado</h2><p>Total asignaciones: ${data.length}</p>`,
      attachments: [{ filename: fileName, content: csvContent, contentType: 'text/csv' }],
    });

    return NextResponse.json({ success: true, message: `Reporte exportado con ${data.length} asignaciones`, messageId: info.messageId });
  } catch (err) {
    console.error('Error exportando:', err);
    return NextResponse.json({ success: false, error: err.message || 'Error desconocido al exportar' }, { status: 500 });
  }
}
